const fs = require("fs");
const path = require("path");

// Set explicit data dir to project 'datos' folder
process.env.PANELAMCHAM_DATA_DIR = path.join(__dirname, "../datos");

// Force delete before requiring sqlite (to ensure new connection creates it)
const dbPath = path.join(process.env.PANELAMCHAM_DATA_DIR, "panel.sqlite");
if (fs.existsSync(dbPath)) {
  console.log("Deleting existing DB at:", dbPath);
  try {
    fs.unlinkSync(dbPath);
    console.log("DB Deleted.");
  } catch (e) {
    console.error("Error deleting DB:", e);
  }
} else {
  console.log("No DB found at:", dbPath);
}

// Now require sqlite, which triggers creation and seeding via inicializarBaseDatos
const { db, inicializarBaseDatos } = require("../src/db/sqlite");

try {
  console.log("Initializing DB...");
  inicializarBaseDatos();

  console.log("--- DB INITIALIZED. DUMPING USERS ---");

  let output = "--- USER DUMP START ---\n";

  const users = db
    .prepare(
      "SELECT id, usuario, es_admin_global FROM usuarios ORDER BY usuario"
    )
    .all();

  users.forEach((u) => {
    output += `\nUser: ${u.usuario} (ID: ${u.id}, Admin: ${u.es_admin_global})\n`;

    const perms = db
      .prepare(
        `
        SELECT empresa_id, modulo, puede_cargar_guardar, puede_revisar, puede_aprobar 
        FROM permisos_modulo 
        WHERE usuario_id = ?
        ORDER BY empresa_id, modulo
    `
      )
      .all(u.id);

    if (perms.length === 0) {
      output += "  - No permissions.\n";
    }

    perms.forEach((p) => {
      const rights = [];
      if (p.puede_cargar_guardar) rights.push("Editor");
      if (p.puede_revisar) rights.push("Revisor");
      if (p.puede_aprobar) rights.push("Aprobador");

      output += `  - ${p.empresa_id} | ${p.modulo}: [${rights.join(", ")}]\n`;
    });
  });

  output += "\n--- USER DUMP END ---\n";

  const dumpPath = path.join(__dirname, "users_dump_verified.txt");
  fs.writeFileSync(dumpPath, output);
  console.log(`Dump written to ${dumpPath}`);
  console.log(`Total users in DB: ${users.length}`);
} catch (error) {
  console.error("Error in verification:", error);
}
