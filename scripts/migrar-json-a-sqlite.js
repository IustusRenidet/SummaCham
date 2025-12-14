/**
 * migrar-json-a-sqlite.js
 * Script para forzar la migración de los layouts desde los JSON legacy hacia SQLite.
 * Ahora utiliza el layoutSeeder centralizado para garantizar un solo origen de datos.
 */

const path = require("path");
const sqlite = require("../src/db/sqlite");
const {
  seedLayoutsFromJson,
  resolverDirectorioInfoImportante,
} = require("../src/services/layoutSeeder");

const ejecutarMigracion = ({ force = true } = {}) => {
  console.log("🚀 Iniciando migración de layouts JSON → SQLite\n");
  console.log("=".repeat(60));

  const baseDir =
    resolverDirectorioInfoImportante() ||
    path.join(__dirname, "../info IMPORTANTE");

  if (!baseDir) {
    console.error(
      "❌ No se encontró ninguna carpeta 'info IMPORTANTE' ni 'info_importante'."
    );
    process.exit(1);
  }

  console.log(`📁 Usando fuente de datos: ${baseDir}`);

  try {
    const resultado = seedLayoutsFromJson({
      db: sqlite.db,
      baseDir,
      force,
    });

    if (!resultado.ejecutado) {
      console.warn(
        `⚠️  Migración omitida (${
          resultado.motivo || "ya existían registros"
        })`
      );
      return;
    }

    console.log(
      `\n✅ Migración completada: ${resultado.cuentas} cuentas y ${resultado.operaciones} operaciones.`
    );
    if (resultado.detalles.length) {
      console.log("📊 Detalles:");
      resultado.detalles.forEach((detalle) => console.log(`  • ${detalle}`));
    }
  } catch (error) {
    console.error("\n❌ Error durante la migración:", error);
    console.error(error.stack);
    process.exit(1);
  }
};

if (require.main === module) {
  ejecutarMigracion({ force: true });
}

module.exports = { ejecutarMigracion };
