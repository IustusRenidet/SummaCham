const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

// Buscar base de datos
const dbPaths = [
  "src/backend/database/summacham.db",
  "src/backend/database/layouts-config.db",
  "datos/panel.sqlite",
];

let db = null;
for (const dbPath of dbPaths) {
  if (fs.existsSync(dbPath)) {
    console.log(`✅ Encontrada base de datos: ${dbPath}`);
    try {
      db = new Database(dbPath, { readonly: true });
      break;
    } catch (err) {
      console.log(`❌ Error abriendo ${dbPath}:`, err.message);
    }
  }
}

if (!db) {
  console.log("❌ No se encontró ninguna base de datos válida");
  process.exit(1);
}

console.log("\n=== TABLAS DISPONIBLES ===");
const tables = db
  .prepare(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
  )
  .all();
tables.forEach((t) => console.log(`  - ${t.name}`));

// Buscar tabla de layouts
const layoutTable = tables.find(
  (t) =>
    t.name.includes("layout") ||
    t.name.includes("config") ||
    t.name === "RESUMEN"
);

if (layoutTable) {
  console.log(`\n=== ESTRUCTURA DE ${layoutTable.name} ===`);
  const pragma = db.pragma(`table_info(${layoutTable.name})`);
  pragma.forEach((col) => console.log(`  ${col.name}: ${col.type}`));

  console.log(`\n=== LAYOUTS RESUMEN EN ${layoutTable.name} ===`);
  try {
    const layouts = db
      .prepare(
        `SELECT * FROM ${layoutTable.name} WHERE modulo = 'RESUMEN' OR nombre LIKE '%RESUMEN%' LIMIT 5`
      )
      .all();
    console.log(`Encontrados ${layouts.length} layouts RESUMEN`);
    layouts.forEach((l) => {
      console.log("\n📄 Layout:");
      Object.keys(l).forEach((key) => {
        const value = l[key];
        if (typeof value === "string" && value.length > 100) {
          console.log(`  ${key}: [${value.length} chars]`);
        } else {
          console.log(`  ${key}: ${value}`);
        }
      });
    });
  } catch (err) {
    console.log(`Error consultando ${layoutTable.name}:`, err.message);
  }
}

// Verificar si existe tabla layouts_config
try {
  console.log("\n=== LAYOUTS_CONFIG ===");
  const layoutsConfig = db
    .prepare(
      `SELECT modulo, anio, capitulo, COUNT(*) as count FROM layouts_config 
     WHERE modulo = 'RESUMEN' 
     GROUP BY modulo, anio, capitulo`
    )
    .all();
  console.log(`Encontrados ${layoutsConfig.length} layouts RESUMEN`);
  layoutsConfig.forEach((l) =>
    console.log(
      `  ${l.modulo} ${l.anio} ${l.capitulo}: ${l.count} registros`
    )
  );
} catch (err) {
  console.log("Tabla layouts_config no existe o error:", err.message);
}

// Buscar todas las tablas que contengan RESUMEN
console.log("\n=== BÚSQUEDA EN TODAS LAS TABLAS ===");
tables.forEach((table) => {
  try {
    const stmt = db.prepare(
      `SELECT COUNT(*) as count FROM ${table.name}`
    );
    const result = stmt.get();
    if (result.count > 0) {
      console.log(`  ${table.name}: ${result.count} registros`);
    }
  } catch (err) {
    // Ignorar errores
  }
});

db.close();
