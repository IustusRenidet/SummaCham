// src/services/comitesService.js
const { ejecutarConsulta } = require('./firebirdService');
const { listarAniosSaldos } = require('./saldosMetadataService');

/**
 * Construye el nombre de tabla según el año
 * @param {string} prefijo - AUXILIAR, CUENTAS, SALDOS
 * @param {number} anio - Año completo (ej: 2025)
 * @returns {string} Nombre de tabla (ej: AUXILIAR25)
 */
const construirNombreTabla = (prefijo, anio) => {
  const sufijo = anio.toString().slice(-2).padStart(2, '0');
  return `${prefijo}${sufijo}`;
};

/**
 * Obtiene años disponibles desde las tablas SALDOS
 */
async function obtenerAniosDisponibles(empresaId) {
  if (!empresaId) throw new Error('Empresa obligatoria');
  return listarAniosSaldos(empresaId);
}

/**
 * Obtiene lista de comités únicos para un año específico
 */
async function obtenerComites(empresaId, anio) {
  if (!empresaId) throw new Error('Empresa obligatoria');
  
  const ejercicio = Number(anio);
  if (!Number.isInteger(ejercicio) || ejercicio < 2000 || ejercicio > 2100) {
    throw new Error('Ejercicio inválido');
  }

  const tablaAux = construirNombreTabla('AUXILIAR', ejercicio);
  const tablaCtas = construirNombreTabla('CUENTAS', ejercicio);

  const sql = `
    SELECT DISTINCT
      SUBSTRING(a.NUM_CTA FROM 1 FOR 13) AS codigo_comite,
      FIRST 1 c.NOMBRE AS nombre_comite
    FROM ${tablaAux} a
    JOIN ${tablaCtas} c ON c.NUM_CTA = a.NUM_CTA AND c.STATUS = 'A'
    WHERE a.EJERCICIO = ?
      AND (
        a.NUM_CTA STARTING WITH '404' OR
        a.NUM_CTA STARTING WITH '502' OR
        a.NUM_CTA STARTING WITH '504'
      )
    GROUP BY SUBSTRING(a.NUM_CTA FROM 1 FOR 13)
    ORDER BY 1
  `;

  const rows = await ejecutarConsulta(empresaId, sql, [ejercicio]);
  return rows.map(row => ({
    codigo: String(row.CODIGO_COMITE || row.codigo_comite || '').trim(),
    nombre: String(row.NOMBRE_COMITE || row.nombre_comite || '').trim()
  }));
}

/**
 * Obtiene cuentas disponibles para autocompletado
 */
async function obtenerCuentasDisponibles(empresaId, anio) {
  if (!empresaId) throw new Error('Empresa obligatoria');
  
  const ejercicio = Number(anio);
  if (!Number.isInteger(ejercicio) || ejercicio < 2000 || ejercicio > 2100) {
    throw new Error('Ejercicio inválido');
  }

  const tablaCtas = construirNombreTabla('CUENTAS', ejercicio);

  const sql = `
    SELECT DISTINCT
      c.NUM_CTA AS cuenta,
      c.NOMBRE AS nombre,
      c.NATURALEZA AS naturaleza
    FROM ${tablaCtas} c
    WHERE c.STATUS = 'A'
      AND (
        c.NUM_CTA STARTING WITH '404' OR
        c.NUM_CTA STARTING WITH '502' OR
        c.NUM_CTA STARTING WITH '504'
      )
    ORDER BY c.NUM_CTA
  `;

  const rows = await ejecutarConsulta(empresaId, sql, []);
  return rows.map(row => ({
    cuenta: String(row.CUENTA || row.cuenta || '').trim(),
    nombre: String(row.NOMBRE || row.nombre || '').trim(),
    naturaleza: String(row.NATURALEZA || row.naturaleza || '').trim()
  }));
}

/**
 * Obtiene movimientos por quincena para cuentas específicas
 */
async function obtenerMovimientosQuincenales(empresaId, anio, cuentas = []) {
  if (!empresaId) throw new Error('Empresa obligatoria');
  
  const ejercicio = Number(anio);
  if (!Number.isInteger(ejercicio) || ejercicio < 2000 || ejercicio > 2100) {
    throw new Error('Ejercicio inválido');
  }

  if (!Array.isArray(cuentas) || cuentas.length === 0) {
    return [];
  }

  const tablaAux = construirNombreTabla('AUXILIAR', ejercicio);
  const tablaCtas = construirNombreTabla('CUENTAS', ejercicio);

  // Construir placeholders para IN clause
  const placeholders = cuentas.map(() => '?').join(',');
  const params = [ejercicio, ...cuentas];

  const sql = `
    SELECT
      a.NUM_CTA,
      c.NOMBRE,
      c.NATURALEZA,
      
      SUM(CASE 
        WHEN a.PERIODO = 1 AND EXTRACT(DAY FROM a.FECHA_POL) <= 15 THEN
          CASE 
            WHEN a.DEBE_HABER IN ('D','1','DEBE') THEN a.MONTOMOV
            WHEN a.DEBE_HABER IN ('H','2','HABER') THEN -a.MONTOMOV
            ELSE 0 
          END
        ELSE 0
      END) AS ene_1,
      
      SUM(CASE 
        WHEN a.PERIODO = 1 AND EXTRACT(DAY FROM a.FECHA_POL) > 15 THEN
          CASE 
            WHEN a.DEBE_HABER IN ('D','1','DEBE') THEN a.MONTOMOV
            WHEN a.DEBE_HABER IN ('H','2','HABER') THEN -a.MONTOMOV
            ELSE 0 
          END
        ELSE 0
      END) AS ene_2,

      SUM(CASE 
        WHEN a.PERIODO = 2 AND EXTRACT(DAY FROM a.FECHA_POL) <= 15 THEN
          CASE 
            WHEN a.DEBE_HABER IN ('D','1','DEBE') THEN a.MONTOMOV
            WHEN a.DEBE_HABER IN ('H','2','HABER') THEN -a.MONTOMOV
            ELSE 0 
          END
        ELSE 0
      END) AS feb_1,
      
      SUM(CASE 
        WHEN a.PERIODO = 2 AND EXTRACT(DAY FROM a.FECHA_POL) > 15 THEN
          CASE 
            WHEN a.DEBE_HABER IN ('D','1','DEBE') THEN a.MONTOMOV
            WHEN a.DEBE_HABER IN ('H','2','HABER') THEN -a.MONTOMOV
            ELSE 0 
          END
        ELSE 0
      END) AS feb_2,

      SUM(CASE 
        WHEN a.PERIODO = 3 AND EXTRACT(DAY FROM a.FECHA_POL) <= 15 THEN
          CASE 
            WHEN a.DEBE_HABER IN ('D','1','DEBE') THEN a.MONTOMOV
            WHEN a.DEBE_HABER IN ('H','2','HABER') THEN -a.MONTOMOV
            ELSE 0 
          END
        ELSE 0
      END) AS mar_1,
      
      SUM(CASE 
        WHEN a.PERIODO = 3 AND EXTRACT(DAY FROM a.FECHA_POL) > 15 THEN
          CASE 
            WHEN a.DEBE_HABER IN ('D','1','DEBE') THEN a.MONTOMOV
            WHEN a.DEBE_HABER IN ('H','2','HABER') THEN -a.MONTOMOV
            ELSE 0 
          END
        ELSE 0
      END) AS mar_2,

      SUM(CASE 
        WHEN a.PERIODO = 4 AND EXTRACT(DAY FROM a.FECHA_POL) <= 15 THEN
          CASE 
            WHEN a.DEBE_HABER IN ('D','1','DEBE') THEN a.MONTOMOV
            WHEN a.DEBE_HABER IN ('H','2','HABER') THEN -a.MONTOMOV
            ELSE 0 
          END
        ELSE 0
      END) AS abr_1,
      
      SUM(CASE 
        WHEN a.PERIODO = 4 AND EXTRACT(DAY FROM a.FECHA_POL) > 15 THEN
          CASE 
            WHEN a.DEBE_HABER IN ('D','1','DEBE') THEN a.MONTOMOV
            WHEN a.DEBE_HABER IN ('H','2','HABER') THEN -a.MONTOMOV
            ELSE 0 
          END
        ELSE 0
      END) AS abr_2,

      SUM(CASE 
        WHEN a.PERIODO = 5 AND EXTRACT(DAY FROM a.FECHA_POL) <= 15 THEN
          CASE 
            WHEN a.DEBE_HABER IN ('D','1','DEBE') THEN a.MONTOMOV
            WHEN a.DEBE_HABER IN ('H','2','HABER') THEN -a.MONTOMOV
            ELSE 0 
          END
        ELSE 0
      END) AS may_1,
      
      SUM(CASE 
        WHEN a.PERIODO = 5 AND EXTRACT(DAY FROM a.FECHA_POL) > 15 THEN
          CASE 
            WHEN a.DEBE_HABER IN ('D','1','DEBE') THEN a.MONTOMOV
            WHEN a.DEBE_HABER IN ('H','2','HABER') THEN -a.MONTOMOV
            ELSE 0 
          END
        ELSE 0
      END) AS may_2,

      SUM(CASE 
        WHEN a.PERIODO = 6 AND EXTRACT(DAY FROM a.FECHA_POL) <= 15 THEN
          CASE 
            WHEN a.DEBE_HABER IN ('D','1','DEBE') THEN a.MONTOMOV
            WHEN a.DEBE_HABER IN ('H','2','HABER') THEN -a.MONTOMOV
            ELSE 0 
          END
        ELSE 0
      END) AS jun_1,
      
      SUM(CASE 
        WHEN a.PERIODO = 6 AND EXTRACT(DAY FROM a.FECHA_POL) > 15 THEN
          CASE 
            WHEN a.DEBE_HABER IN ('D','1','DEBE') THEN a.MONTOMOV
            WHEN a.DEBE_HABER IN ('H','2','HABER') THEN -a.MONTOMOV
            ELSE 0 
          END
        ELSE 0
      END) AS jun_2,

      SUM(CASE 
        WHEN a.PERIODO = 7 AND EXTRACT(DAY FROM a.FECHA_POL) <= 15 THEN
          CASE 
            WHEN a.DEBE_HABER IN ('D','1','DEBE') THEN a.MONTOMOV
            WHEN a.DEBE_HABER IN ('H','2','HABER') THEN -a.MONTOMOV
            ELSE 0 
          END
        ELSE 0
      END) AS jul_1,
      
      SUM(CASE 
        WHEN a.PERIODO = 7 AND EXTRACT(DAY FROM a.FECHA_POL) > 15 THEN
          CASE 
            WHEN a.DEBE_HABER IN ('D','1','DEBE') THEN a.MONTOMOV
            WHEN a.DEBE_HABER IN ('H','2','HABER') THEN -a.MONTOMOV
            ELSE 0 
          END
        ELSE 0
      END) AS jul_2,

      SUM(CASE 
        WHEN a.PERIODO = 8 AND EXTRACT(DAY FROM a.FECHA_POL) <= 15 THEN
          CASE 
            WHEN a.DEBE_HABER IN ('D','1','DEBE') THEN a.MONTOMOV
            WHEN a.DEBE_HABER IN ('H','2','HABER') THEN -a.MONTOMOV
            ELSE 0 
          END
        ELSE 0
      END) AS ago_1,
      
      SUM(CASE 
        WHEN a.PERIODO = 8 AND EXTRACT(DAY FROM a.FECHA_POL) > 15 THEN
          CASE 
            WHEN a.DEBE_HABER IN ('D','1','DEBE') THEN a.MONTOMOV
            WHEN a.DEBE_HABER IN ('H','2','HABER') THEN -a.MONTOMOV
            ELSE 0 
          END
        ELSE 0
      END) AS ago_2,

      SUM(CASE 
        WHEN a.PERIODO = 9 AND EXTRACT(DAY FROM a.FECHA_POL) <= 15 THEN
          CASE 
            WHEN a.DEBE_HABER IN ('D','1','DEBE') THEN a.MONTOMOV
            WHEN a.DEBE_HABER IN ('H','2','HABER') THEN -a.MONTOMOV
            ELSE 0 
          END
        ELSE 0
      END) AS sep_1,
      
      SUM(CASE 
        WHEN a.PERIODO = 9 AND EXTRACT(DAY FROM a.FECHA_POL) > 15 THEN
          CASE 
            WHEN a.DEBE_HABER IN ('D','1','DEBE') THEN a.MONTOMOV
            WHEN a.DEBE_HABER IN ('H','2','HABER') THEN -a.MONTOMOV
            ELSE 0 
          END
        ELSE 0
      END) AS sep_2,

      SUM(CASE 
        WHEN a.PERIODO = 10 AND EXTRACT(DAY FROM a.FECHA_POL) <= 15 THEN
          CASE 
            WHEN a.DEBE_HABER IN ('D','1','DEBE') THEN a.MONTOMOV
            WHEN a.DEBE_HABER IN ('H','2','HABER') THEN -a.MONTOMOV
            ELSE 0 
          END
        ELSE 0
      END) AS oct_1,
      
      SUM(CASE 
        WHEN a.PERIODO = 10 AND EXTRACT(DAY FROM a.FECHA_POL) > 15 THEN
          CASE 
            WHEN a.DEBE_HABER IN ('D','1','DEBE') THEN a.MONTOMOV
            WHEN a.DEBE_HABER IN ('H','2','HABER') THEN -a.MONTOMOV
            ELSE 0 
          END
        ELSE 0
      END) AS oct_2,

      SUM(CASE 
        WHEN a.PERIODO = 11 AND EXTRACT(DAY FROM a.FECHA_POL) <= 15 THEN
          CASE 
            WHEN a.DEBE_HABER IN ('D','1','DEBE') THEN a.MONTOMOV
            WHEN a.DEBE_HABER IN ('H','2','HABER') THEN -a.MONTOMOV
            ELSE 0 
          END
        ELSE 0
      END) AS nov_1,
      
      SUM(CASE 
        WHEN a.PERIODO = 11 AND EXTRACT(DAY FROM a.FECHA_POL) > 15 THEN
          CASE 
            WHEN a.DEBE_HABER IN ('D','1','DEBE') THEN a.MONTOMOV
            WHEN a.DEBE_HABER IN ('H','2','HABER') THEN -a.MONTOMOV
            ELSE 0 
          END
        ELSE 0
      END) AS nov_2,

      SUM(CASE 
        WHEN a.PERIODO = 12 AND EXTRACT(DAY FROM a.FECHA_POL) <= 15 THEN
          CASE 
            WHEN a.DEBE_HABER IN ('D','1','DEBE') THEN a.MONTOMOV
            WHEN a.DEBE_HABER IN ('H','2','HABER') THEN -a.MONTOMOV
            ELSE 0 
          END
        ELSE 0
      END) AS dic_1,
      
      SUM(CASE 
        WHEN a.PERIODO = 12 AND EXTRACT(DAY FROM a.FECHA_POL) > 15 THEN
          CASE 
            WHEN a.DEBE_HABER IN ('D','1','DEBE') THEN a.MONTOMOV
            WHEN a.DEBE_HABER IN ('H','2','HABER') THEN -a.MONTOMOV
            ELSE 0 
          END
        ELSE 0
      END) AS dic_2,

      SUM(CASE 
        WHEN a.PERIODO = 13 THEN
          CASE 
            WHEN a.DEBE_HABER IN ('D','1','DEBE') THEN a.MONTOMOV
            WHEN a.DEBE_HABER IN ('H','2','HABER') THEN -a.MONTOMOV
            ELSE 0 
          END
        ELSE 0
      END) AS ajuste13,
      
      SUM(CASE 
        WHEN a.PERIODO = 14 THEN
          CASE 
            WHEN a.DEBE_HABER IN ('D','1','DEBE') THEN a.MONTOMOV
            WHEN a.DEBE_HABER IN ('H','2','HABER') THEN -a.MONTOMOV
            ELSE 0 
          END
        ELSE 0
      END) AS ajuste14,
      
      SUM(CASE 
        WHEN a.DEBE_HABER IN ('D','1','DEBE') THEN a.MONTOMOV
        WHEN a.DEBE_HABER IN ('H','2','HABER') THEN -a.MONTOMOV
        ELSE 0 
      END) AS anual

    FROM ${tablaAux} a
    JOIN ${tablaCtas} c ON c.NUM_CTA = a.NUM_CTA AND c.STATUS = 'A'
    WHERE a.EJERCICIO = ?
      AND a.NUM_CTA IN (${placeholders})
    GROUP BY a.NUM_CTA, c.NOMBRE, c.NATURALEZA
    ORDER BY a.NUM_CTA
  `;

  const rows = await ejecutarConsulta(empresaId, sql, params);
  
  return rows.map(row => ({
    numCta: String(row.NUM_CTA || '').trim(),
    nombre: String(row.NOMBRE || '').trim(),
    naturaleza: String(row.NATURALEZA || '').trim(),
    ene: Number(row.ENE_1 || 0),
    feb: Number(row.FEB_1 || 0) + Number(row.FEB_2 || 0),
    mar: Number(row.MAR_1 || 0) + Number(row.MAR_2 || 0),
    abr: Number(row.ABR_1 || 0) + Number(row.ABR_2 || 0),
    may: Number(row.MAY_1 || 0) + Number(row.MAY_2 || 0),
    jun: Number(row.JUN_1 || 0) + Number(row.JUN_2 || 0),
    jul: Number(row.JUL_1 || 0) + Number(row.JUL_2 || 0),
    ago: Number(row.AGO_1 || 0) + Number(row.AGO_2 || 0),
    sep: Number(row.SEP_1 || 0) + Number(row.SEP_2 || 0),
    oct: Number(row.OCT_1 || 0) + Number(row.OCT_2 || 0),
    nov: Number(row.NOV_1 || 0) + Number(row.NOV_2 || 0),
    dic: Number(row.DIC_1 || 0) + Number(row.DIC_2 || 0),
    ajuste13: Number(row.AJUSTE13 || 0),
    ajuste14: Number(row.AJUSTE14 || 0),
    anual: Number(row.ANUAL || 0)
  }));
}

module.exports = {
  obtenerAniosDisponibles,
  obtenerComites,
  obtenerCuentasDisponibles,
  obtenerMovimientosQuincenales
};