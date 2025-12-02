
const { ejecutarConsulta } = require('./firebirdService');
const { listarAniosSaldos } = require('./saldosMetadataService');

const MESES = [
  { periodo: 1, alias: 'ENE', clave: 'ene' },
  { periodo: 2, alias: 'FEB', clave: 'feb' },
  { periodo: 3, alias: 'MAR', clave: 'mar' },
  { periodo: 4, alias: 'ABR', clave: 'abr' },
  { periodo: 5, alias: 'MAY', clave: 'may' },
  { periodo: 6, alias: 'JUN', clave: 'jun' },
  { periodo: 7, alias: 'JUL', clave: 'jul' },
  { periodo: 8, alias: 'AGO', clave: 'ago' },
  { periodo: 9, alias: 'SEP', clave: 'sep' },
  { periodo: 10, alias: 'OCT', clave: 'oct' },
  { periodo: 11, alias: 'NOV', clave: 'nov' },
  { periodo: 12, alias: 'DIC', clave: 'dic' }
];

const formatearPeriodo = (v) => v.toString().padStart(2, '0');
const construirNombreTabla = (prefijo, anio) => `${prefijo}${anio.toString().slice(-2).padStart(2,'0')}`;

const determinarNaturalezaReal = (numCta, naturalezaCampo) => {
  const cuenta = String(numCta || '').trim();
  if (/^1/.test(cuenta)) return 'D';
  if (/^2/.test(cuenta)) return 'A';
  if (/^3/.test(cuenta)) return 'A';
  if (/^4/.test(cuenta)) return 'A';
  if (/^[5-9]/.test(cuenta)) return 'D';
  const nat = String(naturalezaCampo || '').trim().toUpperCase();
  return ['A', '2', 'C'].includes(nat) ? 'A' : 'D';
};

const calcularSaldosCoiPorMes = (row) => {
  const naturalezaReal = determinarNaturalezaReal(row.CUENTA, row.NATURALEZA);
  const inicial = Number(row.INICIAL ?? 0);
  let cargosAcum = 0;
  let abonosAcum = 0;
  const meses = {};

  MESES.forEach(({ periodo, clave }) => {
    const cargo = Number(row[`CARGO${formatearPeriodo(periodo)}`] ?? 0);
    const abono = Number(row[`ABONO${formatearPeriodo(periodo)}`] ?? 0);
    cargosAcum += cargo;
    abonosAcum += abono;
    const acumulado =
      naturalezaReal === 'D'
        ? Math.abs(inicial + cargosAcum - abonosAcum)
        : Math.abs(inicial + abonosAcum - cargosAcum);
    const movimiento = naturalezaReal === 'D' ? cargo - abono : abono - cargo;
    meses[clave] = {
      movimiento,
      acumulado
    };
  });

  return {
    naturalezaReal,
    meses,
    anual: meses.dic?.acumulado ?? 0
  };
};

const mapRow = (r) => {
  const { naturalezaReal, meses, anual } = calcularSaldosCoiPorMes(r);
  const out = {
    numCta: String(r.CUENTA || '').trim(),
    nombre: r.NOMBRE,
    naturaleza: r.NATURALEZA || '',
    naturalezaReal
  };
  MESES.forEach(({ clave }) => {
    const datosMes = meses[clave] || { movimiento: 0, acumulado: 0 };
    out[clave] = Number(datosMes.movimiento ?? 0);
    out[`${clave}_acum`] = Number(datosMes.acumulado ?? 0);
  });
  const dicAcum = Number(meses.dic?.acumulado ?? 0);
  out.dic = dicAcum;
  out.dic_acum = dicAcum;
  out.anual = Number(anual ?? dicAcum);
  out.ajuste14 = Number(r.AJU14 ?? 0);
  return out;
};

async function obtenerSaldosPorCuentas(empresaId, anio, cuentas = []) {
  if (!empresaId) throw new Error('Empresa obligatoria');
  const ejercicio = Number(anio);
  if (!Number.isInteger(ejercicio) || ejercicio < 2000 || ejercicio > 2100) {
    throw new Error('Ejercicio inválido');
  }
  if (!Array.isArray(cuentas) || cuentas.length === 0) return [];

  const tCtas = construirNombreTabla('CUENTAS', ejercicio);
  const tSal = construirNombreTabla('SALDOS', ejercicio);

  const colsCargos = MESES.map(({periodo}) => `COALESCE(s.cargo${formatearPeriodo(periodo)},0) AS CARGO${formatearPeriodo(periodo)}`).join(',\n      ');
  const colsAbonos = MESES.map(({periodo}) => `COALESCE(s.abono${formatearPeriodo(periodo)},0) AS ABONO${formatearPeriodo(periodo)}`).join(',\n      ');

  // Placeholders para IN (?, ?, ...)
  const binds = cuentas.map(()=>'?').join(',');
  const params = [ejercicio, ...cuentas];

  const sql = `
    SELECT
      c.num_cta AS CUENTA,
      c.nombre  AS NOMBRE,
      c.naturaleza AS NATURALEZA,
      COALESCE(s.inicial,0) AS INICIAL,
      ${colsCargos},
      ${colsAbonos},
      COALESCE(s.cargo14,0) - COALESCE(s.abono14,0) AS AJU14
    FROM ${tCtas} c
    LEFT JOIN ${tSal} s
      ON s.num_cta = c.num_cta
     AND s.ejercicio = ?
    WHERE c.status = 'A'
      AND c.num_cta IN (${binds})
    ORDER BY c.num_cta
  `;

  const rows = await ejecutarConsulta(empresaId, sql, params);
  return rows.map(mapRow);
}

async function obtenerAniosDisponibles(empresaId) {
  return listarAniosSaldos(empresaId);
}

async function obtenerCuentasPorAnio(empresaId, anio) {
  if (!empresaId) throw new Error('Empresa obligatoria');
  const ejercicio = Number(anio);
  if (!Number.isInteger(ejercicio) || ejercicio < 2000 || ejercicio > 2100) {
    throw new Error('Ejercicio inválido');
  }

  const tCtas = construirNombreTabla('CUENTAS', ejercicio);
  const tSal = construirNombreTabla('SALDOS', ejercicio);

  const sql = `
    SELECT DISTINCT
      c.num_cta AS cuenta,
      c.nombre AS nombre,
      c.naturaleza AS naturaleza
    FROM ${tCtas} c
    INNER JOIN ${tSal} s ON s.num_cta = c.num_cta AND s.ejercicio = ?
    WHERE c.status = 'A'
    ORDER BY c.num_cta
  `;

  const rows = await ejecutarConsulta(empresaId, sql, [ejercicio]);
  return rows.map(row => ({
    cuenta: String(row.cuenta).trim(),
    nombre: String(row.nombre || '').trim(),
    naturaleza: String(row.naturaleza || '').trim()
  }));
}

module.exports = { obtenerSaldosPorCuentas, MESES, obtenerAniosDisponibles, obtenerCuentasPorAnio };
