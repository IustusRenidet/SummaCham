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
  'Gastos Generales',
  'Nomina',
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
  'SERV MEMBRESIA': 'Serv Membresía',
  'SERV MEMBRESÍA': 'Serv Membresía',
  'SERVMEMBRESIA': 'Serv Membresía',
  'SERVICIO_MEMBRESIA': 'Serv Membresía',
  'SERVICIO MEMBRESIA': 'Serv Membresía',
  'SERVICIO MEMBRESÍA': 'Serv Membresía',
  'SERVICIO_MEMBRESÍA': 'Serv Membresía',
  'SERVICIO A LA MEMBRESIA': 'Serv Membresía',
  'SERVICIO A LA MEMBRESÍA': 'Serv Membresía',
  'COMITES': 'Comités',
  'COMITÉS': 'Comités',
  'TIC': 'T&IC',
  'T&IC': 'T&IC',
  'RH': 'RH',
  'VPE': 'VPE',
  'FINANZAS': 'Finanzas',
  'GASTOS GENERALES': 'Gastos Generales',
  'GASTOS_GENERALES': 'Gastos Generales',
  'GASTOSGENERALES': 'Gastos Generales',
  'NOMINA': 'Nomina',
  'NÓMINA': 'Nomina',
  'GTOS_CORPORATIVOS': 'Gtos Corporativos',
  'GTOS CORPORATIVOS': 'Gtos Corporativos',
  'SUMMARY': 'SUMMARY',
  'PRESUPUESTOS': 'Presupuestos',
  'RESUMEN': 'RESUMEN'
};

const normalizarNombreModulo = (nombre) => {
  if (!nombre) return null;
  // Normalizar espacios múltiples, guiones y guiones bajos a espacio simple
  const normalizado = nombre.toString()
    .trim()
    .replace(/[-_\s]+/g, ' ')  // Reemplazar separadores por espacio simple
    .toUpperCase();
  
  return MAPA_NORMALIZACION_MODULOS[normalizado] || nombre;
};

const ACCIONES = ['Ver', 'Cargar y guardar', 'Revisar', 'Aprobar'];

module.exports = {
  MODULOS,
  ACCIONES,
  MAPA_NORMALIZACION_MODULOS,
  normalizarNombreModulo
};
