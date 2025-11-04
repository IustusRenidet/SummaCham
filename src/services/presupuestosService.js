const { ejecutarConsulta } = require('./firebirdService');

const PERIODOS = Array.from({ length: 12 }, (_, indice) => indice + 1);
const PERIODOS_AJUSTE = [13, 14];

const formatearPeriodo = (valor) => valor.toString().padStart(2, '0');

const construirNombreTabla = (prefijo, anio) => {
  const sufijo = anio.toString().slice(-2).padStart(2, '0');
  return `${prefijo}${sufijo}`;
};

const construirExpresionSaldo = (prefijo, periodo, anio) => {
  const camposCargo = Array.from({ length: periodo }, (_, indice) => `COALESCE(s.cargo${formatearPeriodo(indice + 1)}, 0)`);
  const camposAbono = Array.from({ length: periodo }, (_, indice) => `COALESCE(s.abono${formatearPeriodo(indice + 1)}, 0)`);
  const alias = `${prefijo.toUpperCase()}_P${periodo}_${anio}`;
  const sumaCargos = camposCargo.length ? ` + (${camposCargo.join(' + ')})` : '';
  const sumaAbonos = camposAbono.length ? ` - (${camposAbono.join(' + ')})` : '';
  return `COALESCE(s.inicial, 0)${sumaCargos}${sumaAbonos} AS ${alias}`;
};

const mapearRegistro = (registro, anio) => {
  const datos = {
    numCta: registro.NUM_CTA,
    nombre: registro.NOMBRE,
    naturaleza: registro.NATURALEZA,
    periodos: {},
    ajustes: {}
  };

  PERIODOS.forEach((periodo) => {
    const clave = `SALDO_P${periodo}_${anio}`;
    datos.periodos[periodo] = Number(registro[clave] ?? 0);
  });

  PERIODOS_AJUSTE.forEach((periodo) => {
    const clave = `SALDO_P${periodo}_${anio}`;
    if (registro[clave] != null) {
      datos.ajustes[periodo] = Number(registro[clave]);
    }
  });

  return datos;
};

const obtenerPresupuestosMayor = async (empresaId, anio) => {
  if (!empresaId) {
    throw new Error('La empresa es obligatoria.');
  }
  const ejercicio = Number(anio);
  if (!Number.isInteger(ejercicio) || ejercicio < 2000 || ejercicio > 2100) {
    throw new Error('El ejercicio indicado no es válido.');
  }

  const tablaCuentas = construirNombreTabla('CUENTAS', ejercicio);
  const tablaSaldos = construirNombreTabla('SALDOS', ejercicio);

  const columnasPeriodos = PERIODOS.map((periodo) => construirExpresionSaldo('saldo', periodo, ejercicio));
  const columnasAjustes = PERIODOS_AJUSTE.map((periodo) => construirExpresionSaldo('saldo', periodo, ejercicio));

  const consulta = `
    SELECT
      c.NUM_CTA,
      c.NOMBRE,
      c.NATURALEZA,
      ${[...columnasPeriodos, ...columnasAjustes].join(',\n      ')}
    FROM ${tablaCuentas} c
    LEFT JOIN ${tablaSaldos} s
      ON s.NUM_CTA = c.NUM_CTA
     AND s.EJERCICIO = ?
    WHERE c.STATUS = 'A'
      AND c.TIPO = 'A'
      AND c.NIVEL = '1'
    ORDER BY c.NUM_CTA
  `;

  const resultados = await ejecutarConsulta(empresaId, consulta, [ejercicio]);
  return resultados.map((registro) => mapearRegistro(registro, ejercicio));
};

module.exports = {
  obtenerPresupuestosMayor,
  PERIODOS
};
