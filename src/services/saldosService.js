
const { ejecutarConsulta } = require('./firebirdService');

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

const exprSaldoAcumMes = (periodo, alias) => {
  const c = Array.from({length: periodo}, (_,i)=>`COALESCE(s.cargo${formatearPeriodo(i+1)},0)`).join(' + ') || '0';
  const a = Array.from({length: periodo}, (_,i)=>`COALESCE(s.abono${formatearPeriodo(i+1)},0)`).join(' + ') || '0';
  return `COALESCE(s.inicial,0) + (${c}) - (${a}) AS ${alias}`;
};

const exprAnual = () => {
  const c = Array.from({length: 12}, (_,i)=>`COALESCE(s.cargo${formatearPeriodo(i+1)},0)`).join(' + ');
  const a = Array.from({length: 12}, (_,i)=>`COALESCE(s.abono${formatearPeriodo(i+1)},0)`).join(' + ');
  return `COALESCE(s.inicial,0) + (${c}) - (${a}) AS ANUAL`;
};

const mapRow = (r) => {
  const out = {
    numCta: r.CUENTA,
    nombre: r.NOMBRE,
    naturaleza: r.NATURALEZA || ''
  };
  MESES.forEach(({alias, clave}) => out[clave] = Number(r[alias] ?? 0));
  out.ajuste13 = Number((r.AJU13 ?? 0));
  out.ajuste14 = Number((r.AJU14 ?? 0));
  out.anual = Number(r.ANUAL ?? 0);
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

  const colsMeses = MESES.map(({periodo, alias}) => exprSaldoAcumMes(periodo, alias)).join(',\n      ');
  const colsAjustes = `
      COALESCE(s.cargo13,0) - COALESCE(s.abono13,0) AS AJU13,
      COALESCE(s.cargo14,0) - COALESCE(s.abono14,0) AS AJU14
  `;
  const colAnual = exprAnual();

  // Placeholders para IN (?, ?, ...)
  const binds = cuentas.map(()=>'?').join(',');
  const params = [ejercicio, ...cuentas];

  const sql = `
    SELECT
      c.num_cta AS CUENTA,
      c.nombre  AS NOMBRE,
      c.naturaleza AS NATURALEZA,
      ${colsMeses},
      ${colsAjustes},
      ${colAnual}
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
  if (!empresaId) throw new Error('Empresa obligatoria');

  // Buscar años disponibles en tablas SALDOS desde 2000 hasta 2100
  const anios = [];
  for (let anio = 2000; anio <= 2100; anio++) {
    const tSal = construirNombreTabla('SALDOS', anio);
    const sql = `SELECT COUNT(*) as count FROM ${tSal} WHERE ejercicio = ?`;
    try {
      const rows = await ejecutarConsulta(empresaId, sql, [anio]);
      if (rows.length > 0 && rows[0].count > 0) {
        anios.push(anio);
      }
    } catch (e) {
      // Tabla no existe o error, continuar
    }
  }

  return anios.sort((a, b) => a - b); // Orden ascendente
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
