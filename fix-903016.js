const Database = require('better-sqlite3');
const db = new Database('datos/panel.sqlite');

// Ver qué cuentas 903* existen en GUADALAJARA para EMPRESA02
const rows = db.prepare(
    "SELECT empresa_id, modulo, anio, capitulo, cuenta, seccion_principal, seccion_secundaria FROM layout_cuentas WHERE empresa_id='EMPRESA02' AND capitulo='GUADALAJARA' AND cuenta LIKE '903%'"
).all();
console.log('Cuentas 903* en GUADALAJARA EMPRESA02:');
console.log(JSON.stringify(rows, null, 2));

// También verificar si existe en cualquier otro capitulo con seccion_secundaria='Cargos Administrativos'
const rowsCA = db.prepare(
    "SELECT empresa_id, modulo, anio, capitulo, cuenta, seccion_principal, seccion_secundaria FROM layout_cuentas WHERE empresa_id='EMPRESA02' AND seccion_secundaria='Cargos Administrativos'"
).all();
console.log('\nCuentas con seccion_secundaria=Cargos Administrativos EMPRESA02:');
console.log(JSON.stringify(rowsCA, null, 2));

db.close();
