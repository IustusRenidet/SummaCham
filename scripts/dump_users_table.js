const { db } = require("../src/db/sqlite");

const users = db
  .prepare(
    "SELECT id, usuario, nombres, apellido_primero, correo FROM usuarios"
  )
  .all();
console.log("--- USERS TABLE DUMP ---");
users.forEach((u) => {
  console.log(
    `${u.id} | ${u.usuario} | ${u.nombres} ${u.apellido_primero} | ${u.correo}`
  );
});
console.log("--- END DUMP ---");
