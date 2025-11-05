const { ejecutarConsulta } = require('./firebirdService');
const { obtenerPresupuestosMock } = require('./presupuestosMockService');

const PERIODOS = Array.from({ length: 12 }, (_, indice) => indice + 1);

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

const formatearPeriodo = (valor) => valor.toString().padStart(2, '0');

const construirNombreTabla = (prefijo, anio) => {
  const sufijo = anio.toString().slice(-2).padStart(2, '0');
  return `${prefijo}${sufijo}`;
};

const construirColumnasMovimientos = () => {
  const columnas = [`COALESCE(s.INICIAL, 0) AS INICIAL`];

  PERIODOS.forEach((periodo) => {
    const sufijo = formatearPeriodo(periodo);
    columnas.push(`COALESCE(s.CARGO${sufijo}, 0) AS CARGO${sufijo}`);
    columnas.push(`COALESCE(s.ABONO${sufijo}, 0) AS ABONO${sufijo}`);
  });

  return columnas;
};

const normalizarNumero = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
};

const redondearSaldo = (valor) => {
  const redondeado = Math.round((valor + Number.EPSILON) * 100) / 100;
  return Object.is(redondeado, -0) ? 0 : redondeado;
};

const calcularSaldo = (naturaleza, inicial, cargosAcumulados, abonosAcumulados) => {
  const esAcreedora = naturaleza === 'H';
  if (esAcreedora) {
    return inicial - cargosAcumulados + abonosAcumulados;
  }
  return inicial + cargosAcumulados - abonosAcumulados;
};

const mapearRegistro = (registro) => {
  const naturaleza = (registro.NATURALEZA || '').trim().toUpperCase();
  const inicial = normalizarNumero(registro.INICIAL);

  let cargosAcumulados = 0;
  let abonosAcumulados = 0;

  const datos = {
    numCta: registro.CUENTA,
    descripcion: registro.DESCRIPCION,
    naturaleza
  };

  MESES.forEach(({ periodo, clave }) => {
    const sufijo = formatearPeriodo(periodo);
    cargosAcumulados += normalizarNumero(registro[`CARGO${sufijo}`]);
    abonosAcumulados += normalizarNumero(registro[`ABONO${sufijo}`]);
    const saldo = calcularSaldo(naturaleza, inicial, cargosAcumulados, abonosAcumulados);
    datos[clave] = redondearSaldo(saldo);
  });

  const saldoAnual = calcularSaldo(naturaleza, inicial, cargosAcumulados, abonosAcumulados);
  datos.anual = redondearSaldo(saldoAnual);

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

  const columnasMovimientos = construirColumnasMovimientos();

  const consulta = `
    SELECT
      c.NUM_CTA AS CUENTA,
      c.NOMBRE AS DESCRIPCION,
      c.NATURALEZA AS NATURALEZA,
      ${columnasMovimientos.join(',\n      ')}
    FROM ${tablaCuentas} c
    LEFT JOIN ${tablaSaldos} s
      ON s.NUM_CTA = c.NUM_CTA
     AND s.EJERCICIO = ?
    WHERE c.STATUS = 'A'
      AND c.TIPO = 'A'
      AND c.NIVEL = '1'
    ORDER BY c.NUM_CTA
  `;

  try {
    const resultados = await ejecutarConsulta(empresaId, consulta, [ejercicio]);
    return resultados.map((registro) => mapearRegistro(registro));
  } catch (error) {
    const permitirMock = process.env.USE_PRESUPUESTOS_MOCK !== 'false';
    if (!permitirMock) {
      throw error;
    }

    console.warn(
      `No fue posible consultar presupuestos en Firebird para la empresa "${empresaId}". Se utilizarán datos simulados.`,
      error
    );
    return obtenerPresupuestosMock(empresaId, ejercicio);
  }
};

module.exports = {
  obtenerPresupuestosMayor,
  PERIODOS
};
