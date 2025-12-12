// Usage: node ./scripts/reset_iconet_password.js YourNewPassword

const fs = require('fs');
const path = require('path');
const {
  ensureActiveBinary,
} = require('../src/utils/betterSqlite3Manager');
ensureActiveBinary();
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const newPassword = process.argv[2];
if (!newPassword) {
  console.error('Usage: node reset_iconet_password.js <newPassword>');
  process.exit(2);
}

const dbPath = path.resolve(__dirname, '../datos/panel.sqlite');
console.log('Opening DB:', dbPath);

try {
  const db = new Database(dbPath);
  const hash = bcrypt.hashSync(newPassword, 12);
  const res = db.prepare("UPDATE usuarios SET contrasena = ? WHERE usuario = 'ICONET'").run(hash);
  if (res.changes === 0) {
    console.error('No rows updated; ICONET user might not exist.');
    process.exit(1);
  }
  console.log('ICONET password reset to:', newPassword);
  process.exit(0);
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
