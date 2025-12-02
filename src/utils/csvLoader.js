const fs = require('fs/promises');
const path = require('path');
const { parse } = require('csv-parse/sync');

const normalizarTexto = (valor) => {
  if (valor == null) return '';
  const texto = valor.toString();
  if (typeof texto.normalize === 'function') {
    return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
  }
  return texto.trim().toUpperCase();
};

const construirMapaCabeceras = (fila = {}) => {
  return Object.keys(fila || {}).reduce((acumulado, campo) => {
    acumulado[normalizarTexto(campo)] = campo;
    return acumulado;
  }, {});
};

const buscarValor = (fila = {}, mapaCabeceras = {}, alias = []) => {
  for (let idx = 0; idx < alias.length; idx += 1) {
    const nombre = normalizarTexto(alias[idx]);
    if (nombre && mapaCabeceras[nombre]) {
      return fila[mapaCabeceras[nombre]];
    }
  }
  return null;
};

const cargarCsv = async (ruta) => {
  const contenido = await fs.readFile(ruta, 'utf-8');
  return parse(contenido, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    relax_column_count: true,
    trim: true
  });
};

const resolverRuta = (ruta, basePath) => {
  if (!ruta) return null;
  if (path.isAbsolute(ruta)) return ruta;
  return path.join(basePath || '.', ruta);
};

module.exports = {
  normalizarTexto,
  construirMapaCabeceras,
  buscarValor,
  cargarCsv,
  resolverRuta
};
