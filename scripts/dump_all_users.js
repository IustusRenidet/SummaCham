const fs = require("fs");
const path = require("path");
const { db, inicializarBaseDatos } = require("../src/db/sqlite");

try {
  inicializarBaseDatos();

  let output = "--- USER DUMP START ---\n";

  const users = db
    .prepare(
      "SELECT id, usuario, es_admin_global FROM usuarios ORDER BY usuario"
    )
    .all();

  users.forEach((u) => {
    output += `\nUser: ${u.usuario} (ID: ${u.id}, Admin: ${
      u.es_admin_global ? "YES" : "NO"
    })\n`;

    if (u.es_admin_global) {
      output += "  - Full Global Access (Admin)\n";
    } else {
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
        output += "  - No specific module permissions.\n";
      }

      perms.forEach((p) => {
        const rights = [];
        if (p.puede_cargar_guardar) rights.push("Editor");
        if (p.puede_revisar) rights.push("Revisor");
        if (p.puede_aprobar) rights.push("Aprobador");

        output += `  - ${p.empresa_id} | ${p.modulo}: [${rights.join(", ")}]\n`;
      });
    }
  });

  output += "\n--- USER DUMP END ---\n";

  const dumpPath = path.join(__dirname, "users_dump.txt");
  fs.writeFileSync(dumpPath, output);
  console.log(`Dump written to ${dumpPath}`);
} catch (error) {
  console.error("Error dumping users:", error);
}
