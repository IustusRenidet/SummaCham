const { db, inicializarBaseDatos } = require("../src/db/sqlite");

try {
  // Trigger initialization which should run seeding
  inicializarBaseDatos();

  console.log("--- DB VERIFICATION START ---");

  const users = db
    .prepare("SELECT usuario, es_admin_global FROM usuarios")
    .all();
  console.log(`Total users in DB: ${users.length}`);

  const fsUser = db
    .prepare("SELECT * FROM usuarios WHERE usuario = ?")
    .get("FS");
  if (fsUser) {
    console.log("User FS found ✅");
    const perms = db
      .prepare("SELECT * FROM permisos_modulo WHERE usuario_id = ?")
      .all(fsUser.id);
    console.log(`FS Permissions count: ${perms.length}`);
    if (perms.length > 0) {
      console.log("Sample FS Permission:", perms[0]);
    }
  } else {
    console.log("User FS NOT found ❌");
  }

  const ambUser = db
    .prepare("SELECT * FROM usuarios WHERE usuario = ?")
    .get("AMB");
  if (ambUser) {
    console.log("User AMB found ✅");
    const permsAMB = db
      .prepare(
        "SELECT * FROM permisos_modulo WHERE usuario_id = ? AND puede_aprobar = 1"
      )
      .all(ambUser.id);
    console.log(`AMB Approval Permissions count: ${permsAMB.length}`);
  }

  console.log("--- DB VERIFICATION END ---");
} catch (error) {
  console.error("Error verifying DB:", error);
}
