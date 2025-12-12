const sqlite = require('../src/db/sqlite');
const db = sqlite.db;
try {
  const ops = db.prepare("SELECT modulo,anio,operacion_tipo,operacion_label,signo,clase,seccion FROM layout_operaciones WHERE operacion_label LIKE '%' || ? || '%' OR seccion LIKE '%' || ? || '%' LIMIT 200").all('RH','RH');
  console.log('FOUND', ops.length);
  ops.forEach(o => console.log(o));
} catch (err) {
  console.error('ERROR:', err.message);
  process.exit(1);
}
