const { ejecutarConsulta } = require('./firebirdService');

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

const construirExpresionSaldoMensual = (periodo, alias) => {
  const camposCargo = Array.from(
    { length: periodo },
    (_, indice) => `COALESCE(s.cargo${formatearPeriodo(indice + 1)}, 0)`
  );
  const camposAbono = Array.from(
    { length: periodo },
    (_, indice) => `COALESCE(s.abono${formatearPeriodo(indice + 1)}, 0)`
  );

  const sumaCargos = camposCargo.length ? camposCargo.join(' + ') : '0';
  const sumaAbonos = camposAbono.length ? camposAbono.join(' + ') : '0';

  return `CASE WHEN c.NATURALEZA = 'H' THEN
    COALESCE(s.inicial, 0) - (${sumaCargos}) + (${sumaAbonos})
  ELSE
    COALESCE(s.inicial, 0) + (${sumaCargos}) - (${sumaAbonos})
  END AS ${alias}`;
};

const construirExpresionSaldoAnual = () => {
  const camposCargo = Array.from(
    { length: 12 },
    (_, indice) => `COALESCE(s.cargo${formatearPeriodo(indice + 1)}, 0)`
  );
  const camposAbono = Array.from(
    { length: 12 },
    (_, indice) => `COALESCE(s.abono${formatearPeriodo(indice + 1)}, 0)`
  );

  const sumaCargos = camposCargo.length ? camposCargo.join(' + ') : '0';
  const sumaAbonos = camposAbono.length ? camposAbono.join(' + ') : '0';

  return `CASE WHEN c.NATURALEZA = 'H' THEN
    COALESCE(s.inicial, 0) - (${sumaCargos}) + (${sumaAbonos})
  ELSE
    COALESCE(s.inicial, 0) + (${sumaCargos}) - (${sumaAbonos})
  END AS ANUAL`;
};

const mapearRegistro = (registro) => {
  const datos = {
    numCta: registro.CUENTA,
    descripcion: registro.DESCRIPCION,
    naturaleza: (registro.NATURALEZA || '').trim()
  };

  MESES.forEach(({ alias, clave }) => {
    datos[clave] = Number(registro[alias] ?? 0);
  });

  datos.anual = Number(registro.ANUAL ?? 0);

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

  const columnasMensuales = MESES.map(({ periodo, alias }) => construirExpresionSaldoMensual(periodo, alias));
  const columnaAnual = construirExpresionSaldoAnual();

  const consulta = `
    SELECT
      c.NUM_CTA AS CUENTA,
      c.NOMBRE AS DESCRIPCION,
      c.NATURALEZA AS NATURALEZA,
      ${[...columnasMensuales, columnaAnual].join(',\n      ')}
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
  return resultados.map((registro) => mapearRegistro(registro));
};

module.exports = {
  obtenerPresupuestosMayor,
  PERIODOS
};
