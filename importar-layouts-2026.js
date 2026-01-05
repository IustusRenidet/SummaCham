/**
 * Script para importar los layouts JSON 2026-2030 a la base de datos SQLite
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Ruta a la base de datos
const dbPath = path.join(__dirname, 'datos', 'panel.sqlite');
const db = new Database(dbPath);

// Carpeta con los layouts
const layoutsFolder = path.join(__dirname, 'PLANTILLAS 2026+');

// Capítulos
const capitulos = [
  'CIUDAD DE MEXICO 2026',
  'GUADALAJARA 2026',
  'NORESTE 2026',
  'NOROESTE 2026'
];

// Función para limpiar nombre de capítulo
function cleanCapitulo(nombre) {
  return nombre.replace(' 2026', '').toUpperCase();
}

// Función para importar un layout JSON
function importarLayout(capitulo, modulo, anio, jsonPath) {
  try {
    console.log(`\n📂 Importando: ${modulo} - ${capitulo} - ${anio}`);
    
    // Leer JSON
    const content = fs.readFileSync(jsonPath, 'utf8');
    const data = JSON.parse(content);
    
    // Obtener cuentas y operaciones
    const cuentas = [];
    const operaciones = [];
    
    // El JSON puede tener diferentes estructuras
    Object.keys(data).forEach(key => {
      const items = Array.isArray(data[key]) ? data[key] : [data[key]];
      
      items.forEach(item => {
        if (item.CUENTA && !item.OperacionId) {
          // Es una cuenta
          cuentas.push(item);
        } else if (item.OperacionId || item.Clase) {
          // Es una operación
          operaciones.push(item);
        }
      });
    });
    
    console.log(`  ✅ ${cuentas.length} cuentas, ${operaciones.length} operaciones`);
    
    // Insertar en la base de datos
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO layouts_config 
      (modulo, anio, capitulo, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    `);
    
    const layoutData = {
      modulo: modulo,
      anio: anio,
      capitulo: capitulo,
      cuentas: cuentas,
      operaciones: operaciones
    };
    
    stmt.run(modulo, anio, capitulo, JSON.stringify(layoutData));
    
    console.log(`  💾 Guardado en base de datos`);
    return true;
    
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    return false;
  }
}

// Verificar si existe la tabla
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS layouts_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      modulo TEXT NOT NULL,
      anio INTEGER NOT NULL,
      capitulo TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(modulo, anio, capitulo)
    )
  `);
  console.log('✅ Tabla layouts_config verificada');
} catch (err) {
  console.error('❌ Error creando tabla:', err.message);
  process.exit(1);
}

// Importar todos los layouts
let totalImportados = 0;
let totalErrores = 0;

capitulos.forEach(capituloFolder => {
  const capituloPath = path.join(layoutsFolder, capituloFolder);
  const capituloNombre = cleanCapitulo(capituloFolder);
  
  console.log(`\n📍 Capítulo: ${capituloNombre}`);
  
  if (!fs.existsSync(capituloPath)) {
    console.log(`  ⚠️ Carpeta no encontrada: ${capituloPath}`);
    return;
  }
  
  // Leer archivos JSON
  const files = fs.readdirSync(capituloPath).filter(f => f.endsWith('_layout.json'));
  
  files.forEach(file => {
    const moduloNombre = file.replace('_layout.json', '');
    const jsonPath = path.join(capituloPath, file);
    
    // Importar para años 2026-2030
    for (let anio = 2026; anio <= 2030; anio++) {
      if (importarLayout(capituloNombre, moduloNombre, anio, jsonPath)) {
        totalImportados++;
      } else {
        totalErrores++;
      }
    }
  });
});

// Resumen
console.log(`\n${'='.repeat(60)}`);
console.log(`✅ Importación completada`);
console.log(`   Total importados: ${totalImportados}`);
console.log(`   Total errores: ${totalErrores}`);
console.log(`${'='.repeat(60)}\n`);

// Mostrar layouts en DB
const layouts = db.prepare(`
  SELECT modulo, anio, capitulo, 
         length(data) as tamaño,
         created_at
  FROM layouts_config 
  WHERE anio >= 2026
  ORDER BY capitulo, modulo, anio
`).all();

console.log(`\n📊 Layouts en base de datos (2026+):`);
layouts.forEach(l => {
  console.log(`   ${l.capitulo} | ${l.modulo} | ${l.anio} | ${(l.tamaño / 1024).toFixed(1)} KB`);
});

db.close();
