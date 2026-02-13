/**
 * Script para identificar operaciones huérfanas/innecesarias en layout_operaciones
 *
 * Compara las operaciones en la base de datos con las que realmente se usan
 * en los reportes y genera queries SQL para limpiar las innecesarias.
 */

const db = require('../src/db/sqlite').db;
const layoutService = require('../src/services/layoutService');

const NORMALIZAR_CLAVE = (valor = '') =>
  (valor || '')
    .toString()
    .replace(/\u0000/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const EMPRESA_ID = 'EMPRESA01';
const ANIO = 2025;
const MODULOS = ['RESUMEN', 'SUMMARY'];

console.log('='.repeat(80));
console.log('ANÁLISIS DE OPERACIONES HUÉRFANAS');
console.log('='.repeat(80));
console.log('');

// Campos que identifican operaciones de configuración real
const CAMPOS_OPERACION_REAL = [
  'sum-row',
  'sum-row-sumavarios',
  'sum-row-sumavarios-consolidado',
  'sum-row-operativo',
  'sum-row-operativo-consolidado',
  'result-row',
  'net-row',
  'net-row-adicional',
  'result-net-row'
];

const esOperacionReal = (op) => {
  // Si tiene formula_json, es operación real
  if (op.formula_json) {
    try {
      const parsed = JSON.parse(op.formula_json);
      if (Array.isArray(parsed) && parsed.length > 0) return true;
    } catch (e) {
      // ignore
    }
  }

  // Si tiene algún campo de operación real con valor
  const tipoNorm = (op.operacion_tipo || '').toString().toLowerCase();
  if (CAMPOS_OPERACION_REAL.includes(tipoNorm) && op.operacion_label) {
    return true;
  }

  // Si es operación libre (free-operation)
  if (tipoNorm === 'free-operation') return true;

  return false;
};

const analizarModulo = (modulo) => {
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`MÓDULO: ${modulo}`);
  console.log('─'.repeat(80));

  // Obtener capítulos del módulo
  const capitulos = layoutService.obtenerCapitulos({
    empresaId: EMPRESA_ID,
    modulo,
    anio: ANIO
  });

  if (!capitulos || !capitulos.length) {
    console.log(`  ⚠️  No hay capítulos para ${modulo}`);
    return { total: 0, reales: 0, huerfanas: 0, queries: [] };
  }

  const estadisticas = {
    total: 0,
    reales: 0,
    huerfanas: 0,
    queries: []
  };

  const operacionesHuerfanas = [];

  capitulos.forEach((capObj) => {
    const capitulo = capObj.capitulo || capObj;
    console.log(`\n  Capítulo: ${capitulo}`);

    // Consultar todas las operaciones de este capítulo
    const operaciones = db.prepare(`
      SELECT
        id,
        clase,
        operacion_etiqueta,
        seccion,
        operacion_tipo,
        operacion_label,
        formula_json,
        orden_presentacion,
        visible
      FROM layout_operaciones
      WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ?
      ORDER BY COALESCE(orden_presentacion, orden) ASC
    `).all(EMPRESA_ID, modulo, ANIO, capitulo);

    console.log(`    Total operaciones en BD: ${operaciones.length}`);

    // Agrupar por clase para deduplicar (en BD están normalizadas una fila por tipo)
    const operacionesPorClase = new Map();
    operaciones.forEach((op) => {
      const clase = op.clase || op.operacion_etiqueta || 'sin-clase';
      if (!operacionesPorClase.has(clase)) {
        operacionesPorClase.set(clase, []);
      }
      operacionesPorClase.get(clase).push(op);
    });

    console.log(`    Operaciones únicas (por clase): ${operacionesPorClase.size}`);

    let realesCapitulo = 0;
    let huerfanasCapitulo = 0;

    // Analizar cada grupo de operaciones
    operacionesPorClase.forEach((ops, clase) => {
      estadisticas.total++;

      // Verificar si al menos una fila del grupo es operación real
      const algunaEsReal = ops.some(esOperacionReal);

      if (algunaEsReal) {
        realesCapitulo++;
        estadisticas.reales++;
      } else {
        huerfanasCapitulo++;
        estadisticas.huerfanas++;

        // Guardar info para el query de limpieza
        operacionesHuerfanas.push({
          modulo,
          capitulo,
          clase,
          operacion_etiqueta: ops[0].operacion_etiqueta,
          ids: ops.map(o => o.id),
          tipos: ops.map(o => o.operacion_tipo).filter(Boolean),
          visible: ops[0].visible
        });

        console.log(`      ❌ HUÉRFANA: "${clase}" (${ops.length} filas en BD)`);
        ops.forEach((op, idx) => {
          console.log(`         [${idx + 1}] tipo="${op.operacion_tipo}" label="${op.operacion_label}" visible=${op.visible}`);
        });
      }
    });

    console.log(`    ✅ Reales: ${realesCapitulo}`);
    console.log(`    ❌ Huérfanas: ${huerfanasCapitulo}`);
  });

  // Generar queries de limpieza
  if (operacionesHuerfanas.length > 0) {
    console.log(`\n  📋 QUERIES DE LIMPIEZA PARA ${modulo}:`);
    console.log('  ' + '─'.repeat(76));

    operacionesHuerfanas.forEach((op, idx) => {
      const query = `
-- ${idx + 1}. Eliminar operación huérfana: "${op.clase}" en ${op.capitulo}
DELETE FROM layout_operaciones
WHERE empresa_id = '${EMPRESA_ID}'
  AND modulo = '${modulo}'
  AND anio = ${ANIO}
  AND capitulo = '${op.capitulo}'
  AND clase = '${op.clase}';
`;
      estadisticas.queries.push(query.trim());
      console.log(query);
    });
  }

  return estadisticas;
};

// Analizar todos los módulos
const resultados = {};
MODULOS.forEach((modulo) => {
  resultados[modulo] = analizarModulo(modulo);
});

// Resumen global
console.log('\n' + '='.repeat(80));
console.log('RESUMEN GLOBAL');
console.log('='.repeat(80));

let totalGlobal = 0;
let realesGlobal = 0;
let huerfanasGlobal = 0;

MODULOS.forEach((modulo) => {
  const stats = resultados[modulo];
  totalGlobal += stats.total;
  realesGlobal += stats.reales;
  huerfanasGlobal += stats.huerfanas;

  console.log(`\n${modulo}:`);
  console.log(`  Total operaciones: ${stats.total}`);
  console.log(`  ✅ Reales (usadas): ${stats.reales}`);
  console.log(`  ❌ Huérfanas (no usadas): ${stats.huerfanas}`);
});

console.log(`\n${'─'.repeat(80)}`);
console.log(`TOTAL: ${totalGlobal} operaciones`);
console.log(`  ✅ Reales: ${realesGlobal} (${((realesGlobal/totalGlobal)*100).toFixed(1)}%)`);
console.log(`  ❌ Huérfanas: ${huerfanasGlobal} (${((huerfanasGlobal/totalGlobal)*100).toFixed(1)}%)`);

// Generar archivo SQL con todos los queries de limpieza
if (huerfanasGlobal > 0) {
  const fs = require('fs');
  const path = require('path');

  const sqlFile = path.join(__dirname, 'limpiar-operaciones-huerfanas.sql');

  let sqlContent = `-- ============================================================================
-- Script de limpieza de operaciones huérfanas
-- Generado automáticamente: ${new Date().toISOString()}
-- Total operaciones a eliminar: ${huerfanasGlobal}
-- ============================================================================

-- IMPORTANTE: Respaldar la base de datos antes de ejecutar este script
-- Backup: cp panel.sqlite panel.sqlite.backup.$(date +%Y%m%d_%H%M%S)

BEGIN TRANSACTION;

`;

  MODULOS.forEach((modulo) => {
    const stats = resultados[modulo];
    if (stats.queries.length > 0) {
      sqlContent += `\n-- ${modulo}: ${stats.queries.length} operaciones huérfanas\n`;
      sqlContent += stats.queries.join('\n\n') + '\n';
    }
  });

  sqlContent += `
-- Verificación post-eliminación
SELECT
  modulo,
  capitulo,
  COUNT(*) as operaciones_restantes
FROM layout_operaciones
WHERE empresa_id = '${EMPRESA_ID}' AND anio = ${ANIO}
GROUP BY modulo, capitulo
ORDER BY modulo, capitulo;

COMMIT;

-- Para revertir en caso de error:
-- ROLLBACK;
`;

  fs.writeFileSync(sqlFile, sqlContent, 'utf8');

  console.log(`\n${'─'.repeat(80)}`);
  console.log(`📄 Script SQL generado: ${sqlFile}`);
  console.log(`\nPara limpiar la base de datos:`);
  console.log(`  1. Respaldar: cp panel.sqlite panel.sqlite.backup`);
  console.log(`  2. Ejecutar: sqlite3 panel.sqlite < limpiar-operaciones-huerfanas.sql`);
  console.log('');
}

console.log('='.repeat(80));
