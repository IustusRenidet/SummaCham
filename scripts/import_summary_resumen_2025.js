const fs = require("fs");
const path = require("path");

const dbModule = require("../src/db/sqlite");
const { ahoraSql } = dbModule;

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_CUENTAS = [
  "info IMPORTANTE/RESUMEN CUENTAS 2025.json",
  "info IMPORTANTE/CUENTAS SUMMARY y RESUMEN 2025.json",
  "info IMPORTANTE/CUENTAS SUMMARY y RESUMEN.json",
];
const DEFAULT_OPERACIONES = [
  "info IMPORTANTE/CUENTAS SUMMARY y RESUMEN 2025.json",
  "info IMPORTANTE/CUENTAS SUMMARY y RESUMEN.json",
];
const EMPRESA_ID = "EMPRESA01";
const TARGET_YEAR = 2025;

const KEY_PRINCIPAL_TARGET = "SECCI\u00e0N Principal";
const KEY_SECUNDARIA_TARGET = "SECCION Secundaria";
const PRINCIPAL_KEYS = [
  "SECCI\u00f3N Principal",
  "SECCI\u00e0N Principal",
  "SECCI\u00f3N",
  "SECCI\u00e0N",
  "SECCION Principal",
  "SECCION",
];
const SECUNDARIA_KEYS = [
  "SECCION Secundaria",
  "SECCI\u00f3N Secundaria",
  "SECCI\u00e0N Secundaria",
  "Seccion Secundaria",
  "SECCION",
  "SECCI\u00f3N",
  "SECCI\u00e0N",
];
const OPERATION_KEYS = [
  "sum-row",
  "sum-row-sumavarios",
  "sum-row-sumavarios-consolidado",
  "sum-row-operativo",
  "sum-row-operativo-consolidado",
  "result-row",
  "net-row",
  "net-row-adicional",
  "result-net-row",
];

const resolvePath = (value, fallbacks) => {
  if (value) {
    const candidate = path.resolve(value);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    throw new Error(`No existe el archivo ${candidate}`);
  }
  for (const fallback of fallbacks) {
    const candidate = path.resolve(ROOT, fallback);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error(
    "No se encontro archivo de entrada. Usa --cuentas o --operaciones para definirlo."
  );
};

const loadJson = (filePath) => {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
};

const cleanText = (value) => {
  if (value == null) return "";
  return String(value).trim();
};

const normalizePrincipal = (row) => {
  for (const key of PRINCIPAL_KEYS) {
    if (row[key]) {
      return cleanText(row[key]);
    }
  }
  return "";
};

const normalizeSecundaria = (row) => {
  for (const key of SECUNDARIA_KEYS) {
    if (row[key]) {
      return cleanText(row[key]);
    }
  }
  return "";
};

const groupAccounts = (rows) => {
  const grouped = {};
  for (const row of rows) {
    const capitulo = cleanText(row.CAPITULO);
    if (!capitulo) {
      continue;
    }
    const cuenta = cleanText(row.CUENTA);
    const nombre = cleanText(row.NOMBRE);
    if (!cuenta) {
      continue;
    }
    if (!grouped[capitulo]) {
      grouped[capitulo] = [];
    }
    grouped[capitulo].push({
      CUENTA: cuenta,
      NOMBRE: nombre,
      [KEY_PRINCIPAL_TARGET]: normalizePrincipal(row),
      [KEY_SECUNDARIA_TARGET]: normalizeSecundaria(row),
    });
  }
  return grouped;
};

const buildOperations = (rawOps, hojaExpected) => {
  const hojaUpper = hojaExpected.toUpperCase();
  const filtrados = rawOps.filter(
    (op) => cleanText(op.HOJA).toUpperCase() === hojaUpper
  );
  const operaciones = [];
  filtrados.forEach((op, idx) => {
    const capitulo = cleanText(op.CAPITULO);
    const clase = cleanText(op.Clase);
    const seccion = cleanText(op.SECCION);
    if (!capitulo || !clase || !seccion) {
      return;
    }
    const signo = clase.toLowerCase().includes("expense") ? -1 : 1;
    OPERATION_KEYS.forEach((tipo, tipoIdx) => {
      const etiqueta = cleanText(op[tipo]);
      if (!etiqueta) {
        return;
      }
      operaciones.push({
        capitulo,
        clase,
        seccion,
        tipo,
        label: etiqueta,
        signo,
        orden: idx * 100 + tipoIdx,
      });
    });
  });
  return operaciones;
};

const insertCuentas = async (db, modulo, grouped, empresaId, anio) => {
  await db.layout_cuentas.remove(
    { empresa_id: empresaId, modulo, anio },
    { multi: true }
  );
  await db.layout_secciones.remove(
    { empresa_id: empresaId, modulo, anio },
    { multi: true }
  );

  let total = 0;
  const now = ahoraSql();

  for (const [capitulo, cuentas] of Object.entries(grouped)) {
    const principales = new Set();
    const secundarias = new Set();

    for (const [index, cuenta] of cuentas.entries()) {
      const principal = cuenta[KEY_PRINCIPAL_TARGET];
      const secundaria = cuenta[KEY_SECUNDARIA_TARGET] || null;
      await db.layout_cuentas.upsertByKey({
        empresa_id: empresaId,
        modulo,
        anio,
        cuenta: cuenta.CUENTA,
        nombre: cuenta.NOMBRE,
        capitulo,
        seccion_principal: principal,
        seccion_secundaria: secundaria,
        orden: index,
        creado_en: now,
        actualizado_en: now,
      });
      total += 1;

      if (principal && !principales.has(`${capitulo}|${principal}`)) {
        principales.add(`${capitulo}|${principal}`);
        await db.layout_secciones.upsertByKey({
          empresa_id: empresaId,
          modulo,
          anio,
          capitulo,
          seccion_principal: principal,
          seccion_secundaria: null,
          tipo: "principal",
          orden: index,
          creado_en: now,
          actualizado_en: now,
        });
      }

      if (secundaria) {
        const key = `${capitulo}|${principal}|${secundaria}`;
        if (!secundarias.has(key)) {
          secundarias.add(key);
          await db.layout_secciones.upsertByKey({
            empresa_id: empresaId,
            modulo,
            anio,
            capitulo,
            seccion_principal: principal,
            seccion_secundaria: secundaria,
            tipo: "secundaria",
            orden: index,
            creado_en: now,
            actualizado_en: now,
          });
        }
      }
    }
  }

  return total;
};

const insertOperaciones = async (db, modulo, operaciones, empresaId, anio) => {
  await db.layout_operaciones.remove(
    { empresa_id: empresaId, modulo, anio },
    { multi: true }
  );
  const now = ahoraSql();

  for (const op of operaciones) {
    await db.layout_operaciones.upsertByKey({
      empresa_id: empresaId,
      modulo,
      anio,
      capitulo: op.capitulo,
      clase: op.clase,
      seccion: op.seccion,
      operacion_tipo: op.tipo,
      operacion_label: op.label,
      operacion_etiqueta: op.clase,
      signo: op.signo,
      orden: op.orden,
      creado_en: now,
      actualizado_en: now,
    });
  }

  return operaciones.length;
};

const importModule = async (db, modulo, cuentas, operaciones, empresaId, anio) => {
  const totalCuentas = await insertCuentas(db, modulo, cuentas, empresaId, anio);
  const totalOperaciones = await insertOperaciones(
    db,
    modulo,
    operaciones,
    empresaId,
    anio
  );
  console.log(
    `[${modulo}] ${totalCuentas} cuentas y ${totalOperaciones} operaciones cargadas para ${anio}`
  );
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const getValue = (flag) => {
    const idx = args.indexOf(`--${flag}`);
    if (idx >= 0 && idx < args.length - 1) {
      return args[idx + 1];
    }
    return null;
  };
  return {
    cuentasPath: getValue("cuentas"),
    opsPath: getValue("operaciones"),
    empresaId: getValue("empresa") || EMPRESA_ID,
    anio: Number(getValue("anio") || TARGET_YEAR),
  };
};

const ensureRows = (data, key, fallbackFiles) => {
  const rows = Array.isArray(data?.[key]) ? data[key] : [];
  if (rows.length) {
    return rows;
  }
  for (const candidate of fallbackFiles) {
    const filePath = path.resolve(ROOT, candidate);
    if (fs.existsSync(filePath)) {
      const contenido = loadJson(filePath);
      const alterno = Array.isArray(contenido?.[key]) ? contenido[key] : [];
      if (alterno.length) {
        return alterno;
      }
    }
  }
  return [];
};

const main = async () => {
  const args = parseArgs();
  const anio = Number.isFinite(args.anio) ? args.anio : TARGET_YEAR;

  const cuentasPath = resolvePath(args.cuentasPath, DEFAULT_CUENTAS);
  const operacionesPath = resolvePath(args.opsPath, DEFAULT_OPERACIONES);

  const cuentasData = loadJson(cuentasPath);
  const operacionesData = loadJson(operacionesPath);
  const operacionesRaw = operacionesData["SUMA DE VARIAS SECCIONES"] || [];

  const summaryRows = ensureRows(cuentasData, "SUMMARY", [
    "info IMPORTANTE/CUENTAS SUMMARY.json",
  ]);
  const resumenRows = ensureRows(cuentasData, "RESUMEN", [
    "info IMPORTANTE/CUENTAS SUMMARY y RESUMEN 2025.json",
  ]);

  if (!summaryRows.length) {
    throw new Error("No hay datos de SUMMARY en el archivo proporcionado.");
  }
  if (!resumenRows.length) {
    throw new Error("No hay datos de RESUMEN en el archivo proporcionado.");
  }

  const summaryAccounts = groupAccounts(summaryRows);
  const resumenAccounts = groupAccounts(resumenRows);
  const summaryOps = buildOperations(operacionesRaw, "SUMMARY");
  const resumenOps = buildOperations(operacionesRaw, "RESUMEN");

  await dbModule.inicializarBaseDatos();
  const layoutService = require("../src/services/layoutService");
  const empresaCanonica = layoutService.obtenerEmpresaCanonica(args.empresaId);
  const { db } = dbModule;

  await importModule(db, "RESUMEN", resumenAccounts, resumenOps, empresaCanonica, anio);
  await importModule(db, "SUMMARY", summaryAccounts, summaryOps, empresaCanonica, anio);

  console.log(`Base de datos actualizada para ${empresaCanonica} (${anio}).`);
};

if (require.main === module) {
  main().catch((error) => {
    console.error("Error importando layouts:", error.message || error);
    process.exit(1);
  });
}
