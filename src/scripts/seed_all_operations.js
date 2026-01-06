const { db } = require("../db/sqlite");
const layoutService = require("../services/layoutService");
const fs = require("fs");
const path = require("path");

const YEARS = [2025, 2026];
const CAPITULOS = ["CDMX", "GUADALAJARA", "MONTERREY", "NOROESTE"];

// Load definitions from JSON schema
const SCHEMA_PATH = path.join(__dirname, "../config/master_layout_schema.json");
let DEFINITIONS = {};

try {
  const rawData = fs.readFileSync(SCHEMA_PATH, "utf8");
  DEFINITIONS = JSON.parse(rawData);
} catch (error) {
  console.error("Error reading master_layout_schema.json:", error);
  process.exit(1);
}

const config = DEFINITIONS.configuration || {};
const YEARS_TO_SEED = config.years || YEARS;
const CAPITULOS_TO_SEED = config.chapters || CAPITULOS;
const reservedKeys = ["configuration"];

function detectTermType(term) {
  if (!term) return "section";
  if (/^[\d-]+$/.test(term)) return "account";
  return "operation";
}

function parseExpression(expression, operationsMap) {
  const terms = [];
  expression = expression || "";
  // Simplified parser that handles signs correctly?
  // "A - B + C" -> A, -B, +C
  // Regex to split but keep delimiters
  const parts = expression
    .split(/([+-])/)
    .map((p) => p.trim())
    .filter(Boolean);

  let currentOp = "+";

  // Logic: Look ahead or maintain strict order.
  // "A" -> term A, op +
  // "+" -> set op +
  // "B" -> term B, op +

  // Fix: Classic parser loop
  for (let i = 0; i < parts.length; i++) {
    const token = parts[i];
    if (token === "+" || token === "-") {
      currentOp = token;
    } else {
      // It's a term
      terms.push({
        value: token,
        operator: currentOp,
        type: detectTermType(token),
        id: Date.now() + i,
      });
      // Reset default? No, the operator precedes the term usually in "A - B".
      // First term "A" has implicit +.
      // "A + B" -> A (impl +), +, B (op +).
    }
  }
  return terms;
}

async function seed() {
  console.log("Starting Global Operation Seeding from Schema...");
  console.log("Chapters:", CAPITULOS_TO_SEED);
  console.log("Years:", YEARS_TO_SEED);

  // Handle aliases like SUMMARY which copy RESUMEN
  for (const [key, val] of Object.entries(DEFINITIONS)) {
    if (reservedKeys.includes(key)) continue;
    if (val.use_resumen) {
      DEFINITIONS[key] = { operations: [...DEFINITIONS["RESUMEN"].operations] };
    }
  }

  for (const year of YEARS_TO_SEED) {
    for (const moduleName of Object.keys(DEFINITIONS)) {
      if (reservedKeys.includes(moduleName)) continue;
      const moduleDef = DEFINITIONS[moduleName];
      const opsDef = moduleDef.operations;

      if (!opsDef || !opsDef.length) continue;

      // Prepare operations objects
      const preparedOps = opsDef.map((def, idx) => {
        const terms = parseExpression(def.exp);

        const opObj = {
          Clase: def.label,
          operacion_etiqueta: def.alias || def.label,
          SECCION: def.section || "",
          operacion_tipo: def.type,
          operacion_label: def.label,
          signo: 1,
          orden: (idx + 1) * 10,
          orden_presentacion: (idx + 1) * 10,
          visible: 1,
          formula_terms: terms,
        };
        return opObj;
      });

      // Insert into DB
      for (const capitulo of CAPITULOS_TO_SEED) {
        console.log(`Seeding ${moduleName} ${year} of ${capitulo}...`);

        const opsWithChapter = preparedOps.map((op) => ({
          ...op,
          CAPITULO: capitulo,
          HOJA: moduleName, // Explicit
        }));

        await layoutService.guardarOperaciones({
          empresaId: "EMPRESA01",
          modulo: moduleName,
          anio: year,
          operaciones: opsWithChapter,
        });
      }
    }
  }
  console.log("Seeding Complete.");
}

seed().catch((err) => console.error(err));
