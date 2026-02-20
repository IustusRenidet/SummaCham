const Database = require('better-sqlite3');
const db = new Database('./datos/panel.sqlite', { readonly: true });
const cols = db.prepare("PRAGMA table_info(layout_operaciones)").all();
console.log('COLS:', JSON.stringify(cols.map(c => c.name)));
const sample = db.prepare("SELECT * FROM layout_operaciones LIMIT 3").all();
console.log('SAMPLE:', JSON.stringify(sample, null, 2));
db.close();
process.exit(0);
