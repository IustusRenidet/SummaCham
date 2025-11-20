const { ejecutarConsulta } = require('./firebirdService');
const { obtenerSaldosPorCuentas, MESES } = require('./saldosService');

const nombreTabla = (prefijo, anio) => `${prefijo}${anio.toString().slice(-2).padStart(2, '0')}`;
const pad2 = (numero) => numero.toString().padStart(2, '0');

const mapearPresupuesto = (fila = {}) => {
  const salida = {
    cuenta: String(fila.NUM_CTA || '').trim()
  };
  MESES.forEach(({ alias }) => {
    salida[alias.toLowerCase()] = Number(fila[alias] ?? 0);
  });
  return salida;
};

async function obtenerPresupuestosPorCuentas(empresaId, anio, cuentas = []) {
  if (!cuentas.length) {
    return [];
  }

  const tabla = nombreTabla('PRESUP', anio);
  const columnasMes = MESES.map(({ alias, periodo }) => `COALESCE(p.PRESUP${pad2(periodo)}, 0) AS ${alias}`);
  const marcadores = cuentas.map(() => '?').join(',');
  const parametros = [Number(anio), ...cuentas];

  const sql = `
    SELECT
      p.NUM_CTA AS NUM_CTA,
      ${columnasMes.join(',\n      ')}
    FROM ${tabla} p
    WHERE p.EJERCICIO = ?
      AND p.NUM_CTA IN (${marcadores})
  `;

  const filas = await ejecutarConsulta(empresaId, sql, parametros);
  return filas.map(mapearPresupuesto);
}

const normalizarListaCuentas = (cuentas) => {
  const lista = Array.isArray(cuentas) ? cuentas : [];
  const unico = new Set(
    lista
      .map((cuenta) => (cuenta == null ? '' : String(cuenta).trim()))
      .filter((cuenta) => cuenta.length > 0)
  );
  return Array.from(unico);
};

async function obtenerDatosPlaneacion({ empresaId, anio, cuentas = [] }) {
  const lista = normalizarListaCuentas(cuentas);
  if (!empresaId || !lista.length) {
    return [];
  }

  const [presupuestos, saldos] = await Promise.all([
    obtenerPresupuestosPorCuentas(empresaId, anio, lista),
    obtenerSaldosPorCuentas(empresaId, anio, lista)
  ]);

  const mapaPresupuesto = new Map(presupuestos.map((registro) => [registro.cuenta, registro]));
  const mapaSaldos = new Map(saldos.map((registro) => [registro.numCta, registro]));

  return lista.map((cuenta) => {
    const presupuesto = mapaPresupuesto.get(cuenta) || {};
    const real = mapaSaldos.get(cuenta) || {};
    const datosPresupuesto = {};
    const datosReal = {};

    MESES.forEach(({ clave }) => {
      datosPresupuesto[clave] = Number(presupuesto[clave] ?? 0);
      datosReal[clave] = Number(real[clave] ?? 0);
    });

    return {
      cuenta,
      presupuesto: datosPresupuesto,
      real: datosReal
    };
  });
}

module.exports = {
  obtenerDatosPlaneacion
};
