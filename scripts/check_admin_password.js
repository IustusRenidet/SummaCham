const {
  ensureActiveBinary,
} = require('../src/utils/betterSqlite3Manager');
ensureActiveBinary();
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.resolve(__dirname, '../datos/panel.sqlite');
console.log('Opening DB:', dbPath);

try {
  const db = new Database(dbPath, { readonly: true });
  const row = db.prepare("SELECT id, usuario, contrasena FROM usuarios WHERE usuario = 'ICONET'").get();
  if (!row) {
    console.error('User ICONET not found');
    process.exit(2);
  }
  console.log('Found user:', row.usuario, 'id', row.id);
  console.log('Stored hash:', row.contrasena);

  const tests = [
    '4zxb63NyI43?', // code default (capital I)
    '4zxb63Nyl43?', // common typo (lowercase 'l')
  ];

  tests.forEach(pw => {
    const ok = bcrypt.compareSync(pw, row.contrasena);
    console.log(`Test '${pw}' => ${ok ? 'MATCH' : 'NO MATCH'}`);
  });
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
