const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(require('os').homedir(), 'AppData', 'Roaming', 'panel-amcham', 'datos', 'panel.sqlite');
console.log('Checking DB at', dbPath);
try {
  const db = new Database(dbPath, { readonly: true });
  ['AA', 'AMB'].forEach((u) => {
    const usuario = u.toUpperCase();
    const registro = db.prepare('SELECT id, usuario, nombres, es_admin_global FROM usuarios WHERE UPPER(usuario)=?').get(usuario);
    console.log('\nUser:', usuario);
    console.log('  registro:', registro);
    if (registro && registro.id) {
      const permisosCount = db.prepare('SELECT COUNT(*) as c FROM permisos_modulo WHERE usuario_id = ?').get(registro.id);
      const permisosSample = db.prepare('SELECT empresa_id, modulo, puede_leer, puede_cargar_guardar, puede_revisar, puede_aprobar FROM permisos_modulo WHERE usuario_id = ? LIMIT 5').all(registro.id);
      console.log('  permisos count:', permisosCount.c);
      console.log('  permisos sample:', permisosSample);
    }
  });
  db.close();
} catch (err) {
  console.error('Error reading DB:', err.message || err);
  process.exit(2);
}
