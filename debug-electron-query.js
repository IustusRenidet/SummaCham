// Run with: .\node_modules\electron\dist\electron.exe --no-sandbox debug-electron-query.js
const path = require('path');
const fs = require('fs');

// Try to load better-sqlite3 (electron-compiled version)
let Database;
try {
    Database = require('better-sqlite3');
} catch (e) {
    console.error('Failed to load better-sqlite3:', e.message);
    process.exit(1);
}

const dbPath = path.join(__dirname, 'datos', 'panel.sqlite');
if (!fs.existsSync(dbPath)) {
    console.error('DB not found at:', dbPath);
    process.exit(1);
}

const db = new Database(dbPath, { readonly: true });

// Check what tables exist
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('TABLES:', JSON.stringify(tables.map(t => t.name)));

// Check layout_operaciones for RESUMEN CDMX
try {
    const ops = db.prepare(`
    SELECT * FROM layout_operaciones 
    WHERE (UPPER(hoja) LIKE '%RESUMEN%' OR UPPER(capitulo) LIKE '%CIUDAD%' OR UPPER(capitulo) LIKE '%MEXICO%')
    LIMIT 50
  `).all();
    console.log('\nRESUMEN/CDMX OPERATIONS:', JSON.stringify(ops, null, 2));
} catch (e) {
    console.error('Error querying layout_operaciones:', e.message);
    // Try alternate table name
    const altTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%oper%'").all();
    console.log('Oper-related tables:', JSON.stringify(altTables));
}

db.close();
console.log('\nDONE');
process.exit(0);
