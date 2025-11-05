const MESES = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic'
];

const redondear = (valor) => {
  const numero = Number(valor) || 0;
  const redondeado = Math.round((numero + Number.EPSILON) * 100) / 100;
  return Object.is(redondeado, -0) ? 0 : redondeado;
};

const BASE_CUENTAS = [
  {
    numCta: '4000',
    descripcion: 'Cuotas de membresía',
    naturaleza: 'D',
    montos: [
      115000,
      118000,
      120500,
      122000,
      123500,
      124000,
      126500,
      127500,
      129000,
      130500,
      132000,
      133500
    ]
  },
  {
    numCta: '5100',
    descripcion: 'Gastos operativos',
    naturaleza: 'C',
    montos: [
      48000,
      47500,
      49000,
      48500,
      49200,
      49800,
      50500,
      51200,
      52000,
      51800,
      52500,
      53300
    ]
  },
  {
    numCta: '6100',
    descripcion: 'Programas especiales',
    naturaleza: 'D',
    montos: [
      22000,
      21500,
      23000,
      24000,
      24500,
      26000,
      27000,
      26500,
      25800,
      25000,
      24000,
      23500
    ]
  }
];

const calcularFactorAnio = (anio) => {
  const base = 2024;
  const delta = Number(anio) - base;
  const factor = 1 + (Number.isFinite(delta) ? delta * 0.015 : 0);
  return Math.max(0.5, factor);
};

const construirCuenta = (configuracion, anio) => {
  const factor = calcularFactorAnio(anio);
  const datos = {
    numCta: configuracion.numCta,
    descripcion: configuracion.descripcion,
    naturaleza: configuracion.naturaleza
  };

  let acumulado = 0;

  configuracion.montos.forEach((valor, indice) => {
    const claveMes = MESES[indice];
    const monto = redondear(valor * factor);
    datos[claveMes] = monto;
    acumulado += monto;
  });

  datos.anual = redondear(acumulado);

  return datos;
};

const obtenerPresupuestosMock = (empresaId, anio) => {
  const ejercicio = Number(anio);
  return BASE_CUENTAS.map((cuenta) => construirCuenta(cuenta, ejercicio));
};

module.exports = {
  obtenerPresupuestosMock
};
