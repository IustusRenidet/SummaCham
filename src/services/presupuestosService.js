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

const construirExpresionSaldoPeriodo = (periodo, alias) => {
  // Construir suma de cargos hasta el periodo
  const camposCargo = [];
  for (let i = 1; i <= periodo; i++) {
    camposCargo.push(`COALESCE(s.cargo${formatearPeriodo(i)},0)`);
  }
  
  // Construir suma de abonos hasta el periodo
  const camposAbono = [];
  for (let i = 1; i <= periodo; i++) {
    camposAbono.push(`COALESCE(s.abono${formatearPeriodo(i)},0)`);
  }

  const sumaCargos = camposCargo.join(' + ');
  const sumaAbonos = camposAbono.join(' + ');

  // Saldo base tal como está en tu query original (sin modificar por naturaleza)
  return `COALESCE(s.inicial,0) + (${sumaCargos}) - (${sumaAbonos}) AS ${alias}`;
};

const obtenerPresupuestosMayor = async (empresaId, anio) => {
  if (!empresaId) {
    throw new Error('La empresa es obligatoria.');
  }
  const ejercicio = Number(anio);
  if (!Number.isInteger(ejercicio) || ejercicio < 2000 || ejercicio > 2100) {
    throw new Error('El ejercicio indicado no es válido.');
  }

  const tablaCuentas = construirNombreTabla('cuentas', ejercicio);
  const tablaSaldos = construirNombreTabla('saldos', ejercicio);

  // Construir expresiones para cada periodo (P1 a P12)
  const columnasSaldo = [];
  for (let p = 1; p <= 12; p++) {
    columnasSaldo.push(construirExpresionSaldoPeriodo(p, `saldo_p${p}_${ejercicio}`));
  }

  // Query exacto a tu estructura original
  const consulta = `
    SELECT 
      c.num_cta,
      c.nombre,
      c.naturaleza,
      ${columnasSaldo.join(',\n      ')}
    FROM ${tablaCuentas} c
    LEFT JOIN ${tablaSaldos} s
      ON s.num_cta = c.num_cta
     AND s.ejercicio = ?
    WHERE c.status = 'A'
      AND c.tipo = 'A'
      AND c.nivel = '1'
    ORDER BY c.num_cta
  `;

  const resultados = await ejecutarConsulta(empresaId, consulta, [ejercicio]);
  
  // Mapear los resultados al formato esperado por el frontend
  return resultados.map((registro) => {
    const datos = {
      numCta: registro.NUM_CTA,
      descripcion: registro.NOMBRE,
      naturaleza: registro.NATURALEZA || null
    };

    // Extraer los valores de cada periodo tal como vienen de la BD
    MESES.forEach(({ periodo, clave }) => {
      const nombreColumna = `SALDO_P${periodo}_${ejercicio}`.toUpperCase();
      datos[clave] = Number(registro[nombreColumna] ?? 0);
    });

    // El anual es el saldo del periodo 12
    datos.anual = Number(registro[`SALDO_P12_${ejercicio}`.toUpperCase()] ?? 0);

    return datos;
  });
};

module.exports = {
  obtenerPresupuestosMayor,
  PERIODOS
};