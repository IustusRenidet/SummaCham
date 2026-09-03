/**
 * importar-layouts-2026-seed.js
 *
 * Siembra el SQLite local (layout_cuentas / layout_operaciones) con los
 * layouts de 2026 de los 14 modulos x 4 capitulos, extraidos en vivo de
 * panelamcham.amcham.com.mx y guardados en seed-data/layouts_2026_todos.json.
 *
 * Pensado para un entorno de prueba que arranca con la base vacia y no
 * tiene forma de generar esta data (no hay Firebird local con la misma
 * captura). Usa layoutService directo -- mismo codigo que usa la ruta
 * POST /api/layouts/:modulo/:anio/:capitulo -- asi que el resultado es
 * indistinguible de haberlo cargado desde la UI.
 *
 * Requiere que better-sqlite3 este compilado para el runtime con el que
 * corras este script (node "npm run server" vs Electron "npm start").
 * Si truena con NODE_MODULE_VERSION, corre primero:
 *   npm run native:use-node   (si ya tienes un build guardado para node)
 *   npm run rebuild-native-node   (si no, y tienes build tools instalados)
 * o simplemente corre este script DESDE la app en modo Electron.
 *
 * Uso:
 *   node scripts/importar-layouts-2026-seed.js
 *   node scripts/importar-layouts-2026-seed.js --archivo=ruta/otro.json
 */

const fs = require("fs");
const path = require("path");

const EMPRESA_ID = "EMPRESA01"; // Mismo default que uso el panel al extraer los datos.

const argArchivo = process.argv.find((a) => a.startsWith("--archivo="));
const rutaJson = argArchivo
  ? path.resolve(argArchivo.split("=")[1])
  : path.join(__dirname, "..", "seed-data", "layouts_2026_todos.json");

if (!fs.existsSync(rutaJson)) {
  console.error(`No se encontró el archivo: ${rutaJson}`);
  process.exit(1);
}

let layoutService;
try {
  layoutService = require("../src/services/layoutService");
} catch (err) {
  console.error("No se pudo cargar layoutService (probablemente better-sqlite3 no está compilado para este runtime):");
  console.error(err.message);
  console.error('\nPrueba: npm run native:use-node   (o rebuild-native-node si no hay build guardado)');
  process.exit(1);
}

const datos = JSON.parse(fs.readFileSync(rutaJson, "utf8"));
const anio = Number(datos._meta?.anio) || 2026;

let totalCuentas = 0;
let totalOperaciones = 0;
let capitulosOk = 0;
let capitulosOmitidos = 0;

for (const [modulo, porCapitulo] of Object.entries(datos.modulos || {})) {
  for (const [capitulo, layout] of Object.entries(porCapitulo || {})) {
    if (!layout || layout._error) {
      console.warn(`⚠ Saltando ${modulo} / ${capitulo}: ${layout?._error || "sin datos"}`);
      capitulosOmitidos += 1;
      continue;
    }
    const cuentas = Array.isArray(layout.cuentas) ? layout.cuentas : [];
    const operaciones = Array.isArray(layout.operaciones) ? layout.operaciones : [];
    if (!cuentas.length && !operaciones.length) {
      capitulosOmitidos += 1;
      continue;
    }

    try {
      // Mismo orden que la ruta POST /:modulo/:anio/:capitulo: limpiar antes
      // de volver a insertar, para que el script se pueda correr más de una
      // vez sin duplicar filas.
      layoutService.eliminarLayoutCapitulo({ empresaId: EMPRESA_ID, modulo, anio, capitulo });

      if (cuentas.length) {
        layoutService.guardarCuentas({ empresaId: EMPRESA_ID, modulo, anio, capitulo, cuentas });
      }
      if (operaciones.length) {
        const operacionesNormalizadas = operaciones.map((op) => ({
          ...op,
          CAPITULO: op?.CAPITULO || capitulo,
          HOJA: op?.HOJA || modulo,
        }));
        layoutService.guardarOperaciones({
          empresaId: EMPRESA_ID,
          modulo,
          anio,
          operaciones: operacionesNormalizadas,
        });
      }

      totalCuentas += cuentas.length;
      totalOperaciones += operaciones.length;
      capitulosOk += 1;
      console.log(`✓ ${modulo} / ${capitulo}: ${cuentas.length} cuentas, ${operaciones.length} operaciones`);
    } catch (err) {
      console.error(`✗ ${modulo} / ${capitulo}: ${err.message}`);
      capitulosOmitidos += 1;
    }
  }
}

console.log("\n──────────────────────────────────────────");
console.log(`Listo. ${capitulosOk} capítulo(s) importados, ${capitulosOmitidos} omitido(s).`);
console.log(`Total: ${totalCuentas} cuentas, ${totalOperaciones} operaciones.`);
