/**
 * Script para migrar operaciones del layout JSON a la base de datos SQLite
 * con estructura de fórmulas persistente
 */

const db = require('../src/db/sqlite').db;
const fs = require('fs');
const path = require('path');

// Estructura de tabla para operaciones con fórmulas
const crearTablaOperaciones = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS layout_operaciones_formulas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa_id TEXT NOT NULL,
      modulo TEXT NOT NULL,
      anio INTEGER NOT NULL,
      capitulo TEXT DEFAULT 'DEFAULT',
      operacion_id TEXT NOT NULL,
      clase TEXT,
      orden INTEGER DEFAULT 0,
      formula_json TEXT, -- JSON con array de terms
      signos_json TEXT,  -- JSON con map de signos
      visible INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(empresa_id, modulo, anio, capitulo, operacion_id)
    );

    CREATE INDEX IF NOT EXISTS idx_operaciones_formulas_lookup
      ON layout_operaciones_formulas(empresa_id, modulo, anio, capitulo);
  `);
  console.log('✅ Tabla layout_operaciones_formulas creada');
};

// Migrar operaciones desde archivos JSON
const migrarOperacionesDesdeJSON = (empresaId, modulo, anio, capitulo, operaciones) => {
  if (!Array.isArray(operaciones) || operaciones.length === 0) {
    return 0;
  }

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO layout_operaciones_formulas
    (empresa_id, modulo, anio, capitulo, operacion_id, clase, orden, formula_json, signos_json, visible)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let migradas = 0;

  db.transaction(() => {
    operaciones.forEach((op, idx) => {
      const operacionId = op.operacion_id || op.OPERACION || `OP_${idx + 1}`;
      const clase = op.clase || op.Clase || op.label || '';
      const orden = op.orden !== undefined ? op.orden : idx;
      const visible = op.visible !== false ? 1 : 0;

      // Convertir formula_terms a JSON
      const formulaJson = JSON.stringify(op.formula_terms || []);
      const signosJson = JSON.stringify(op.signos || {});

      stmt.run(
        empresaId,
        modulo,
        anio,
        capitulo,
        operacionId,
        clase,
        orden,
        formulaJson,
        signosJson,
        visible
      );

      migradas++;
    });
  })();

  return migradas;
};

// Buscar y migrar todos los layouts
const migrarTodosLosLayouts = () => {
  const infoDir = path.join(__dirname, '../info IMPORTANTE/layouts');

  if (!fs.existsSync(infoDir)) {
    console.error('❌ Directorio de layouts no encontrado:', infoDir);
    return;
  }

  let totalMigradas = 0;
  const empresas = fs.readdirSync(infoDir);

  empresas.forEach(empresa => {
    const empresaDir = path.join(infoDir, empresa);
    if (!fs.statSync(empresaDir).isDirectory()) return;

    const empresaId = `EMPRESA0${empresa === 'CDMX' ? '1' : empresa === 'GUADALAJARA' ? '2' : empresa === 'NORESTE' ? '3' : '4'}`;
    const anios = fs.readdirSync(empresaDir);

    anios.forEach(anio => {
      const anioDir = path.join(empresaDir, anio);
      if (!fs.statSync(anioDir).isDirectory()) return;

      const anioNum = parseInt(anio);
      if (!Number.isInteger(anioNum)) return;

      // Buscar archivos de operaciones
      const archivos = fs.readdirSync(anioDir);
      archivos.forEach(archivo => {
        if (!archivo.endsWith('_operaciones_detalle.json')) return;

        const modulo = archivo.split('_')[0];
        const archivoPath = path.join(anioDir, archivo);

        try {
          const contenido = fs.readFileSync(archivoPath, 'utf8');
          const operaciones = JSON.parse(contenido);

          const migradas = migrarOperacionesDesdeJSON(
            empresaId,
            modulo.toUpperCase(),
            anioNum,
            'DEFAULT',
            operaciones
          );

          totalMigradas += migradas;
          console.log(`✅ ${empresaId} ${modulo} ${anioNum}: ${migradas} operaciones migradas`);
        } catch (error) {
          console.error(`❌ Error en ${archivo}:`, error.message);
        }
      });
    });
  });

  console.log(`\n🎉 Total: ${totalMigradas} operaciones migradas a la base de datos`);
};

// Ejecutar migración
console.log('🔄 Iniciando migración de operaciones...\n');
crearTablaOperaciones();
migrarTodosLosLayouts();
console.log('\n✅ Migración completada');
