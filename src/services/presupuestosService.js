const { ejecutarConsulta } = require('./firebirdService');
const { listarAniosPresupuestos } = require('./presupuestosMetadataService');

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

const mapearRegistro = (registro) => {
  const presupuestoMensual = {};
  const realMensual = {};
  let acumuladoPresupuesto = 0;

  const datos = {
    numCta: registro.CUENTA,
    descripcion: registro.DESCRIPCION,
    naturaleza: registro.NATURALEZA || ''
  };

  MESES.forEach(({ clave, periodo }) => {
    const sufijo = formatearPeriodo(periodo);
    const valorPresupuesto = Number(registro[`PRESUP${sufijo}`] ?? 0);
    const valorReal = Number(registro[`REAL${sufijo}`] ?? 0);

    presupuestoMensual[clave] = valorPresupuesto;
    realMensual[clave] = valorReal;

    datos[`presup${sufijo}`] = valorPresupuesto;
    datos[`real${sufijo}`] = valorReal;

    acumuladoPresupuesto += valorPresupuesto;
    datos[clave] = acumuladoPresupuesto;
  });

  datos.presupuesto = presupuestoMensual;
  datos.real = realMensual;
  datos.anual = acumuladoPresupuesto;

  return datos;
};

const obtenerPresupuestosMayor = async (empresaId, anio) => {
  if (!empresaId) {
    throw new Error('La empresa es obligatoria.');
  }
  const ejercicio = Number(anio);
  if (!Number.isInteger(ejercicio) || ejercicio < 2000 || ejercicio > 2100) {
    throw new Error('El ejercicio indicado no es valido.');
  }

  const tablaCuentas = construirNombreTabla('CUENTAS', ejercicio);
  const tablaPresupuesto = construirNombreTabla('PRESUP', ejercicio);
  const tablaSaldos = construirNombreTabla('SALDOS', ejercicio);

  const columnasPresupuesto = MESES.map(({ periodo }) => {
    const sufijo = formatearPeriodo(periodo);
    return `COALESCE(p.PRESUP${sufijo}, 0) AS PRESUP${sufijo}`;
  });

  const columnasReal = MESES.map(({ periodo }) => {
    const sufijo = formatearPeriodo(periodo);
    const sumaCargos = Array.from({ length: periodo }, (_, i) => `COALESCE(s.CARGO${formatearPeriodo(i + 1)}, 0)`).join(' + ') || '0';
    const sumaAbonos = Array.from({ length: periodo }, (_, i) => `COALESCE(s.ABONO${formatearPeriodo(i + 1)}, 0)`).join(' + ') || '0';
    return `COALESCE(s.INICIAL, 0) + (${sumaCargos}) - (${sumaAbonos}) AS REAL${sufijo}`;
  });

  const consulta = `
    SELECT
      c.NUM_CTA AS CUENTA,
      c.NOMBRE AS DESCRIPCION,
      c.NATURALEZA,
      ${[...columnasPresupuesto, ...columnasReal].join(',\n      ')}
    FROM ${tablaCuentas} c
    LEFT JOIN ${tablaPresupuesto} p
      ON p.NUM_CTA = c.NUM_CTA
     AND p.EJERCICIO = ?
    LEFT JOIN ${tablaSaldos} s
      ON s.NUM_CTA = c.NUM_CTA
     AND s.EJERCICIO = ?
    WHERE c.STATUS = 'A'
      AND c.TIPO = 'A'
      AND c.NIVEL = '1'
    ORDER BY c.NUM_CTA
  `;

  const resultados = await ejecutarConsulta(empresaId, consulta, [ejercicio, ejercicio]);
  return resultados.map((registro) => mapearRegistro(registro));
};

module.exports = {
  obtenerPresupuestosMayor,
  listarAniosPresupuestos,
  PERIODOS
};
