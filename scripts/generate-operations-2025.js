/**
 * Generate layout_operaciones entries for operational modules for the year 2025
 * - Looks at layout_cuentas for each module/capitulo and creates sum-row and result-row
 * - Skips modules SUMMARY and RESUMEN
 */
const layoutService = require('../src/services/layoutService');
const db = require('../src/db/sqlite').db;

const TARGET_ANIO = 2025;
const skipModules = new Set(['SUMMARY', 'RESUMEN']);

const detectarSigno = (label) => {
  if (!label) return 1;
  if (/EXPENS|GASTO|EXPENSE|GASTOS/i.test(label)) return -1;
  return 1;
};

const ejecutar = () => {
  // Obtener mods usados en layout_cuentas para 2025
  const mods = db.prepare('SELECT DISTINCT modulo FROM layout_cuentas WHERE anio = ?').all(TARGET_ANIO).map(r => r.modulo);
  const modulosObjetivo = mods.filter(m => !skipModules.has((m || '').toString().toUpperCase()));

  modulosObjetivo.forEach(modulo => {
    console.log('Procesando modulo:', modulo);
    const capitulos = db.prepare('SELECT DISTINCT capitulo FROM layout_cuentas WHERE modulo = ? AND anio = ?').all(modulo, TARGET_ANIO).map(r=>r.capitulo);
    capitulos.forEach(capitulo => {
      console.log('  capitulo:', capitulo);
      const secciones = db.prepare('SELECT DISTINCT seccion_principal FROM layout_cuentas WHERE modulo = ? AND anio = ? AND capitulo = ?').all(modulo, TARGET_ANIO, capitulo).map(r => r.seccion_principal);
      const operaciones = [];
      secciones.forEach(seccion => {
        const sign = detectarSigno(seccion);
        const clase = seccion || '';
        const op = {
          CAPITULO: capitulo,
          Clase: clase,
          SECCION: seccion,
          'sum-row': `SUMA DE ${seccion}`,
          'result-row': `Resultado Operativo ${seccion}`
        };
        // Avoid duplicating if operations already exist
        const existe = db.prepare('SELECT COUNT(*) as c FROM layout_operaciones WHERE modulo = ? AND anio = ? AND capitulo = ? AND clase = ?').get(modulo, TARGET_ANIO, capitulo, clase);
        if (!existe || existe.c === 0) operaciones.push(op);
      });

      if (operaciones.length === 0) {
        console.log('    Ninguna operación a crear para capitulo', capitulo);
        return;
      }

      console.log(`    Creando ${operaciones.length} operaciones para ${modulo}/${capitulo}`);
      const res = layoutService.guardarOperaciones({ empresaId: 'empresa1', modulo, anio: TARGET_ANIO, operaciones });
      console.log('    Resultado:', res);
    });
  });
};

if (require.main === module) {
  try {
    ejecutar();
    console.log('Operaciones generadas.');
  } catch (err) {
    console.error('Error generando operaciones:', err && err.message);
    process.exit(1);
  }
}

module.exports = { ejecutar };
