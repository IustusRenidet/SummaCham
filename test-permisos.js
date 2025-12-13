const { db } = require('./src/db/sqlite');
const { construirMapaPermisos } = require('./src/services/permisosService');

// Obtener permisos del usuario 2 (AA)
const permisos = db.prepare(`
  SELECT empresa_id, modulo, puede_leer, puede_cargar_guardar, puede_revisar, puede_aprobar
  FROM permisos_modulo
  WHERE usuario_id = 2
`).all();

console.log('Permisos raw de DB:');
console.log(JSON.stringify(permisos, null, 2));

console.log('\nPermisos procesados (mapa):');
const mapa = construirMapaPermisos(permisos);
console.log(JSON.stringify(mapa, null, 2));

process.exit(0);
