// Catálogo de módulos disponibles por empresa y sus acciones permitidas
const MODULOS = [
  'Membresía',
  'Eventos',
  'Comunicación',
  'Dirección',
  'Serv Membresía',
  'Comités',
  'T&IC',
  'RH',
  'VPE',
  'Finanzas',
  'Gtos Corporativos',
  'SUMMARY',
  'Presupuestos',
  'RESUMEN'
];

// Mapa de normalización: frontend → backend
const MAPA_NORMALIZACION_MODULOS = {
  'MEMBRESIA': 'Membresía',
  'EVENTOS': 'Eventos',
  'COMUNICACION': 'Comunicación',
  'DIRECCION': 'Dirección',
  'SERV_MEMBRESIA': 'Serv Membresía',
  'SERVICIO_MEMBRESIA': 'Serv Membresía',
  'COMITES': 'Comités',
  'TIC': 'T&IC',
  'T&IC': 'T&IC',
  'RH': 'RH',
  'VPE': 'VPE',
  'FINANZAS': 'Finanzas',
  'GTOS_CORPORATIVOS': 'Gtos Corporativos',
  'SUMMARY': 'SUMMARY',
  'PRESUPUESTOS': 'Presupuestos',
  'RESUMEN': 'RESUMEN'
};

const normalizarNombreModulo = (nombre) => {
  if (!nombre) return null;
  const clave = nombre.toString().trim().toUpperCase();
  return MAPA_NORMALIZACION_MODULOS[clave] || nombre;
};

const ACCIONES = ['Lectura', 'Cargar y guardar', 'Revisar', 'Aprobar'];

module.exports = {
  MODULOS,
  ACCIONES,
  MAPA_NORMALIZACION_MODULOS,
  normalizarNombreModulo
};
