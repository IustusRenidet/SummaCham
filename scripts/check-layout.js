try {
  const sqlite = require('../src/db/sqlite');
  var db = sqlite.db;
} catch (err) {
  console.error('Error cargando sqlite module:', err && err.message);
  process.exit(2);
}

if (!db) {
  console.error('DB not available');
  process.exit(1);
}

const moduloVariations = ['serv-membresia','serv_membresia','servmembresia','SERVMEMBRESIA','SERV_MEMBRESIA'];

try {
  for (const modulo of moduloVariations) {
    const capitulos = db.prepare('SELECT DISTINCT capitulo FROM layout_cuentas WHERE modulo = ? ORDER BY capitulo ASC').all(modulo);
    console.log('Modulo:', modulo, 'capitulos:', capitulos.map(c=>c.capitulo).join(', '));
    const count = db.prepare('SELECT COUNT(*) as c FROM layout_cuentas WHERE modulo = ?').get(modulo);
    console.log('  cuentas:', count.c);

    const ops = db.prepare('SELECT COUNT(*) as c FROM layout_operaciones WHERE modulo = ?').get(modulo);
    console.log('  operaciones:', ops.c);
  }
} catch (err) {
  console.error('Error consultando DB:', err && err.message);
  process.exit(3);
}
