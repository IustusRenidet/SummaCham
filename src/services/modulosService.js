const { MODULOS } = require('../config/modulos');

const CIUDADES_BASE = [
  { id: 'CDMX', etiqueta: 'Ciudad de México' },
  { id: 'GDL', etiqueta: 'Guadalajara' },
  { id: 'MTY', etiqueta: 'Noreste' },
  { id: 'NO', etiqueta: 'Noroeste' }
];

const METADATOS_RESUMEN = {
  ciudades: CIUDADES_BASE,
  anios: [2024, 2025],
  tabla: [],
  gastosCorporativos: {}
};

const METADATOS_SUMMARY = {
  periodos: [],
  ejercicios: [],
  resumenAnual: [],
  tablas: []
};

const DATOS_POR_DEFECTO = {
  items: []
};

function normalizarId(nombre) {
  return nombre
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9]+/g, '-');
}

const CATALOGO = MODULOS.map((nombre) => ({
  id: normalizarId(nombre),
  nombre
}));

const DATOS_MODULOS = {
  resumen: METADATOS_RESUMEN,
  'summary-resumen-e': METADATOS_SUMMARY,
  presupuestos: { cuentas: [], ejercicios: [] },
  membresia: DATOS_POR_DEFECTO,
  eventos: DATOS_POR_DEFECTO,
  comunicacion: DATOS_POR_DEFECTO,
  'serv-membresia': DATOS_POR_DEFECTO,
  comites: DATOS_POR_DEFECTO,
  tic: DATOS_POR_DEFECTO,
  rh: DATOS_POR_DEFECTO,
  vpe: DATOS_POR_DEFECTO,
  finanzas: DATOS_POR_DEFECTO,
  'gastos-generales': DATOS_POR_DEFECTO,
  nomina: DATOS_POR_DEFECTO,
  'gtos-corporativos': DATOS_POR_DEFECTO
};

function listarModulos() {
  return CATALOGO.slice();
}

function obtenerDatosModulo(id) {
  const clave = id || '';
  const datos = DATOS_MODULOS[clave];
  if (datos) {
    return JSON.parse(JSON.stringify(datos));
  }
  return JSON.parse(JSON.stringify(DATOS_POR_DEFECTO));
}

module.exports = {
  listarModulos,
  obtenerDatosModulo,
  normalizarId
};
