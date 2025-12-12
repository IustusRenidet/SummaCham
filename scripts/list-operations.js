const sqlite = require('../src/db/sqlite');
const db = sqlite.db;

try {
  const ops = db.prepare(`SELECT operacion_tipo,operacion_label,signo,clase,seccion FROM layout_operaciones WHERE modulo = ? AND anio = ? ORDER BY orden ASC`).all('RH', 2025);
  console.log('Operations for RH (2025):', ops.length);
  ops.slice(0,30).forEach(o => console.log(o));
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
