const { ejecutarConsulta } = require('./firebirdService');
const {
  obtenerAniosDisponibles: obtenerAniosDesdeSaldos,
  obtenerCuentasPorAnio,
  MESES
} = require('./saldosService');

const ES_CUENTA_COMITE = (codigo = '') => {
  const clean = String(codigo || '').trim();
  return /^404/.test(clean) || /^502/.test(clean) || /^504/.test(clean);
};

const construirNombreTabla = (prefijo, anio) => `${prefijo}${anio.toString().slice(-2).padStart(2, '0')}`;

const EXPRESION_MONTO = `CASE
      WHEN a.debe_haber IN ('D','1','DEBE')  THEN a.montomov
      WHEN a.debe_haber IN ('H','2','HABER') THEN -a.montomov
      ELSE 0
    END`;

const mapearFila = (row) => {
  const resultado = {
    numCta: String(row.NUM_CTA || '').trim(),
    nombre: String(row.NOMBRE || '').trim(),
    naturaleza: String(row.NATURALEZA || '').trim()
  };

  MESES.forEach(({ alias, clave }) => {
    resultado[clave] = Number(row[alias] ?? 0);
  });

  resultado.ajuste13 = Number(row.AJUSTE13 ?? 0);
  resultado.ajuste14 = Number(row.AJUSTE14 ?? 0);
  resultado.anual = Number(row.ANUAL ?? 0);

  return resultado;
};

async function obtenerAniosDisponibles(empresaId) {
  return obtenerAniosDesdeSaldos(empresaId);
}

async function obtenerCuentasDisponibles(empresaId, anio) {
  const cuentas = await obtenerCuentasPorAnio(empresaId, anio);
  return cuentas.filter((row) => ES_CUENTA_COMITE(row.cuenta));
}

async function obtenerComites(empresaId, anio) {
  const cuentas = await obtenerCuentasDisponibles(empresaId, anio);
  const mapa = new Map();

  cuentas.forEach(({ cuenta, nombre }) => {
    const codigo = String(cuenta || '').slice(0, 13);
    if (!codigo || mapa.has(codigo)) return;
    mapa.set(codigo, nombre || codigo);
  });

  return Array.from(mapa.entries()).map(([codigo, nombre]) => ({
    codigo,
    nombre
  }));
}

async function obtenerMovimientosPorCuentas(empresaId, anio, cuentas = []) {
  if (!empresaId) throw new Error('Empresa obligatoria');

  const ejercicio = Number(anio);
  if (!Number.isInteger(ejercicio) || ejercicio < 2000 || ejercicio > 2100) {
    throw new Error('Ejercicio inválido');
  }

  const lista = Array.isArray(cuentas)
    ? Array.from(new Set(cuentas.map((c) => String(c || '').trim()).filter(Boolean)))
    : [];

  if (lista.length === 0) {
    return [];
  }

  const tablaAuxiliar = construirNombreTabla('AUXILIAR', ejercicio);
  const tablaCuentas = construirNombreTabla('CUENTAS', ejercicio);

  const columnasMeses = MESES.map(({ periodo, alias }) => `
      COALESCE(SUM(CASE WHEN a.periodo = ${periodo} THEN ${EXPRESION_MONTO} ELSE 0 END), 0) AS ${alias}
    `).join(', ');

  const placeholders = lista.map(() => '?').join(',');
  const parametros = [ejercicio, ...lista];

  const sql = `
    SELECT
      c.num_cta AS NUM_CTA,
      c.nombre AS NOMBRE,
      c.naturaleza AS NATURALEZA,
      ${columnasMeses},
      COALESCE(SUM(CASE WHEN a.periodo = 13 THEN ${EXPRESION_MONTO} ELSE 0 END), 0) AS AJUSTE13,
      COALESCE(SUM(CASE WHEN a.periodo = 14 THEN ${EXPRESION_MONTO} ELSE 0 END), 0) AS AJUSTE14,
      COALESCE(SUM(CASE WHEN a.periodo BETWEEN 1 AND 14 THEN ${EXPRESION_MONTO} ELSE 0 END), 0) AS ANUAL
    FROM ${tablaCuentas} c
    LEFT JOIN ${tablaAuxiliar} a
      ON a.num_cta = c.num_cta
     AND a.ejercicio = ?
     AND a.periodo BETWEEN 1 AND 14
    WHERE c.status = 'A'
      AND c.num_cta IN (${placeholders})
    GROUP BY c.num_cta, c.nombre, c.naturaleza
    ORDER BY c.num_cta
  `;

  const filas = await ejecutarConsulta(empresaId, sql, parametros);
  return filas.map(mapearFila);
}

module.exports = {
  MESES,
  obtenerAniosDisponibles,
  obtenerComites,
  obtenerCuentasDisponibles,
  obtenerMovimientosPorCuentas
};
