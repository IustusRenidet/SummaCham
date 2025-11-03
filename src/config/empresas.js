const path = require('path');

// Catálogo centralizado de empresas y sus respectivas bases de datos Firebird
const EMPRESAS = [
  {
    id: 'empresa1',
    nombre: 'Empresa 1',
    etiqueta: 'CDMX',
    rutaBaseDatos: 'C:/Program Files (x86)/Common Files/Aspel/Sistemas Aspel/COI10.00/Datos/Empresa1/COI10EMPRE1.FDB'
  },
  {
    id: 'empresa2',
    nombre: 'Empresa 2',
    etiqueta: 'GDL',
    rutaBaseDatos: 'C:/Program Files (x86)/Common Files/Aspel/Sistemas Aspel/COI10.00/Datos/Empresa2/COI10EMPRE2.FDB'
  },
  {
    id: 'empresa3',
    nombre: 'Empresa 3',
    etiqueta: 'MTY',
    rutaBaseDatos: 'C:/Program Files (x86)/Common Files/Aspel/Sistemas Aspel/COI10.00/Datos/Empresa3/COI10EMPRE3.FDB'
  },
  {
    id: 'empresa4',
    nombre: 'Empresa 4',
    etiqueta: 'Noroeste',
    rutaBaseDatos: 'C:/Program Files (x86)/Common Files/Aspel/Sistemas Aspel/COI10.00/Datos/Empresa4/COI10EMPRE4.FDB'
  }
];

const obtenerEmpresaPorId = (id) => EMPRESAS.find((empresa) => empresa.id === id);

module.exports = {
  EMPRESAS,
  obtenerEmpresaPorId
};
