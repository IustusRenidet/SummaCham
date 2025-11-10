const {
  obtenerSaldosPorCuentas,
  obtenerAniosDisponibles: obtenerAniosDesdeSaldos,
  obtenerCuentasPorAnio,
  MESES
} = require('./saldosService');

const ES_CUENTA_COMITE = (codigo = '') => {
  const clean = String(codigo || '').trim();
  return /^404/.test(clean) || /^502/.test(clean) || /^504/.test(clean);
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
  const lista = Array.isArray(cuentas)
    ? cuentas.map((c) => String(c || '').trim()).filter(Boolean)
    : [];
  if (lista.length === 0) return [];
  return obtenerSaldosPorCuentas(empresaId, anio, lista);
}

module.exports = {
  MESES,
  obtenerAniosDisponibles,
  obtenerComites,
  obtenerCuentasDisponibles,
  obtenerMovimientosPorCuentas
};
