/**
 * layoutService.js
 * Servicio para gestionar layouts de módulos por año y capítulo en SQLite
 */

const db = require('../db/sqlite').db;

/**
 * Obtener layout completo para un módulo, año y capítulo
 */
const obtenerLayout = ({ empresaId = 'EMPRESA01', modulo, anio, capitulo }) => {
  // 1. Obtener cuentas
  const cuentas = db.prepare(`
    SELECT 
      cuenta AS CUENTA,
      nombre AS NOMBRE,
      capitulo AS CAPITULO,
      seccion_principal AS "SECCIÓN Principal",
      seccion_secundaria AS "SECCION Secundaria",
      orden
    FROM layout_cuentas
    WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ?
    ORDER BY orden ASC, cuenta ASC
  `).all(empresaId, modulo, anio, capitulo);

  // 2. Obtener operaciones
  const operaciones = db.prepare(`
    SELECT 
      capitulo AS CAPITULO,
      clase AS Clase,
      seccion AS SECCION,
      operacion_tipo,
      operacion_label,
      signo,
      orden
    FROM layout_operaciones
    WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ?
    ORDER BY orden ASC
  `).all(empresaId, modulo, anio, capitulo);

  // 3. Construir objeto de operaciones por clase
  const operacionesMap = {};
  operaciones.forEach(op => {
    if (!operacionesMap[op.Clase]) {
      operacionesMap[op.Clase] = {
        CAPITULO: op.CAPITULO,
        Clase: op.Clase,
        SECCION: op.SECCION
      };
    }
    operacionesMap[op.Clase][op.operacion_tipo] = op.operacion_label;
  });

  return {
    [modulo]: cuentas,
    'SUMA DE VARIAS SECCIONES': Object.values(operacionesMap)
  };
};

/**
 * Obtener todos los capítulos disponibles para un módulo y año
 */
const obtenerCapitulos = ({ empresaId = 'EMPRESA01', modulo, anio }) => {
  const capitulos = db.prepare(`
    SELECT DISTINCT capitulo
    FROM layout_cuentas
    WHERE empresa_id = ? AND modulo = ? AND anio = ?
    ORDER BY capitulo ASC
  `).all(empresaId, modulo, anio);

  return capitulos.map(c => c.capitulo);
};

/**
 * Obtener años disponibles para un módulo
 */
const obtenerAniosDisponibles = ({ empresaId = 'EMPRESA01', modulo }) => {
  const anios = db.prepare(`
    SELECT DISTINCT anio
    FROM layout_cuentas
    WHERE empresa_id = ? AND modulo = ?
    ORDER BY anio DESC
  `).all(empresaId, modulo);

  return anios.map(a => a.anio);
};

/**
 * Guardar cuentas de un layout
 */
const guardarCuentas = ({ empresaId = 'EMPRESA01', modulo, anio, capitulo, cuentas }) => {
  const insertCuenta = db.prepare(`
    INSERT OR REPLACE INTO layout_cuentas (
      empresa_id, modulo, anio, cuenta, nombre, capitulo, 
      seccion_principal, seccion_secundaria, orden, actualizado_en
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  const transaction = db.transaction((cuentasArray) => {
    cuentasArray.forEach((cuenta, index) => {
      // Validar campos obligatorios
      if (!cuenta.CUENTA) {
        console.warn(`⚠️  Cuenta sin código en ${modulo}/${capitulo}, ignorando`);
        return;
      }
      
      // Soportar diferentes formatos de secciones
      const seccionPrincipal = cuenta['SECCIÓN Principal'] || cuenta.SECCION || cuenta.seccion || '';
      const seccionSecundaria = cuenta['SECCION Secundaria'] || cuenta.seccion_secundaria || null;
      const nombre = cuenta.NOMBRE || cuenta.nombre || cuenta.CUENTA || 'Sin nombre';
      
      insertCuenta.run(
        empresaId,
        modulo,
        anio,
        cuenta.CUENTA,
        nombre,
        capitulo,
        seccionPrincipal,
        seccionSecundaria,
        cuenta.orden || index
      );
    });
  });

  transaction(cuentas);
  return { success: true, insertadas: cuentas.length };
};

/**
 * Guardar operaciones de un layout
 */
const guardarOperaciones = ({ empresaId = 'EMPRESA01', modulo, anio, operaciones }) => {
  const insertOperacion = db.prepare(`
    INSERT OR REPLACE INTO layout_operaciones (
      empresa_id, modulo, anio, capitulo, clase, seccion,
      operacion_tipo, operacion_label, signo, orden, actualizado_en
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  const transaction = db.transaction((operacionesArray) => {
    operacionesArray.forEach((op, index) => {
      // Procesar cada tipo de operación en el objeto
      const tiposOperacion = [
        'sum-row', 'sum-row-sumavarios', 'sum-row-sumavarios-consolidado',
        'sum-row-operativo', 'sum-row-operativo-consolidado',
        'result-row', 'net-row', 'net-row-adicional', 'result-net-row'
      ];

      tiposOperacion.forEach((tipo, tipoIndex) => {
        if (op[tipo]) {
          // Determinar signo basado en la clase
          let signo = 1;
          if (op.Clase && op.Clase.toLowerCase().includes('expense')) {
            signo = -1;
          }

          insertOperacion.run(
            empresaId,
            modulo,
            anio,
            op.CAPITULO || op.HOJA,
            op.Clase,
            op.SECCION,
            tipo,
            op[tipo],
            signo,
            index * 100 + tipoIndex
          );
        }
      });
    });
  });

  transaction(operaciones);
  return { success: true, insertadas: operaciones.length };
};

/**
 * Copiar layout de un año a otro (útil para crear nuevo año)
 */
const copiarLayout = ({ empresaId = 'EMPRESA01', modulo, anioOrigen, anioDestino }) => {
  const copiarCuentas = db.prepare(`
    INSERT INTO layout_cuentas (
      empresa_id, modulo, anio, cuenta, nombre, capitulo,
      seccion_principal, seccion_secundaria, orden
    )
    SELECT 
      empresa_id, modulo, ?, cuenta, nombre, capitulo,
      seccion_principal, seccion_secundaria, orden
    FROM layout_cuentas
    WHERE empresa_id = ? AND modulo = ? AND anio = ?
  `);

  const copiarOperaciones = db.prepare(`
    INSERT INTO layout_operaciones (
      empresa_id, modulo, anio, capitulo, clase, seccion,
      operacion_tipo, operacion_label, signo, orden
    )
    SELECT 
      empresa_id, modulo, ?, capitulo, clase, seccion,
      operacion_tipo, operacion_label, signo, orden
    FROM layout_operaciones
    WHERE empresa_id = ? AND modulo = ? AND anio = ?
  `);

  const transaction = db.transaction(() => {
    copiarCuentas.run(anioDestino, empresaId, modulo, anioOrigen);
    copiarOperaciones.run(anioDestino, empresaId, modulo, anioOrigen);
  });

  transaction();
  return { success: true, mensaje: `Layout copiado de ${anioOrigen} a ${anioDestino}` };
};

/**
 * Eliminar layout completo de un año
 */
const eliminarLayout = ({ empresaId = 'EMPRESA01', modulo, anio }) => {
  const deleteCuentas = db.prepare(`
    DELETE FROM layout_cuentas
    WHERE empresa_id = ? AND modulo = ? AND anio = ?
  `);

  const deleteOperaciones = db.prepare(`
    DELETE FROM layout_operaciones
    WHERE empresa_id = ? AND modulo = ? AND anio = ?
  `);

  const transaction = db.transaction(() => {
    deleteCuentas.run(empresaId, modulo, anio);
    deleteOperaciones.run(empresaId, modulo, anio);
  });

  transaction();
  return { success: true, mensaje: `Layout eliminado para año ${anio}` };
};

/**
 * Verificar si existe un layout para un año específico
 */
const existeLayout = ({ empresaId = 'EMPRESA01', modulo, anio }) => {
  const resultado = db.prepare(`
    SELECT COUNT(*) as count
    FROM layout_cuentas
    WHERE empresa_id = ? AND modulo = ? AND anio = ?
    LIMIT 1
  `).get(empresaId, modulo, anio);

  return resultado.count > 0;
};

/**
 * Obtener estadísticas de un layout
 */
const obtenerEstadisticasLayout = ({ empresaId = 'EMPRESA01', modulo, anio }) => {
  const stats = db.prepare(`
    SELECT 
      COUNT(DISTINCT capitulo) as capitulos,
      COUNT(DISTINCT seccion_principal) as secciones,
      COUNT(*) as cuentas
    FROM layout_cuentas
    WHERE empresa_id = ? AND modulo = ? AND anio = ?
  `).get(empresaId, modulo, anio);

  const operaciones = db.prepare(`
    SELECT COUNT(*) as operaciones
    FROM layout_operaciones
    WHERE empresa_id = ? AND modulo = ? AND anio = ?
  `).get(empresaId, modulo, anio);

  return {
    ...stats,
    operaciones: operaciones.operaciones
  };
};

module.exports = {
  obtenerLayout,
  obtenerCapitulos,
  obtenerAniosDisponibles,
  guardarCuentas,
  guardarOperaciones,
  copiarLayout,
  eliminarLayout,
  existeLayout,
  obtenerEstadisticasLayout
};
