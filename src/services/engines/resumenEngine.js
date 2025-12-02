const path = require('path');
const { obtenerSaldosPorCuentas } = require('../saldosService');
const { cargarCsv, construirMapaCabeceras, buscarValor, resolverRuta, normalizarTexto } = require('../../utils/csvLoader');
const { obtenerEmpresaPorId } = require('../../config/empresas');

const DEFAULT_BASE_PATH = path.join(__dirname, '..', '..', 'info IMPORTANTE');
const RESUMEN_MAPPING_FILE = 'Resumen Guadalajara.csv';
const ALIAS_CUENTA = ['CUENTA', 'CODIGO', 'NUMCTA', 'CTA'];
const ALIAS_DESCRIPCION = ['DESCRIPCION', 'NOMBRE', 'LABEL', 'TITULO'];
const ALIAS_GRUPO = ['GRUPO', 'CATEGORIA', 'SECCION', 'AREA', 'HEADROW'];

const normalizeKey = (valor) => {
  if (valor == null) return '';
  const texto = valor.toString();
  if (typeof texto.normalize === 'function') {
    return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
  }
  return texto.trim().toUpperCase();
};

const getResumenPath = (options = {}) => resolverRuta(options.mappingPath || RESUMEN_MAPPING_FILE, options.basePath);

const parseRows = (rows = []) => {
  return rows.map((fila) => {
    const headers = construirMapaCabeceras(fila);
    const cuenta = normalizeKey(buscarValor(fila, headers, ALIAS_CUENTA));
    const descripcion = buscarValor(fila, headers, ALIAS_DESCRIPCION) || '';
    const grupo = buscarValor(fila, headers, ALIAS_GRUPO) || 'GENERAL';
    return {
      cuenta,
      descripcion,
      grupo
    };
  }).filter((item) => item.cuenta);
};

const agruparFilas = (filas = []) => {
  const agrupados = {};
  filas.forEach((item) => {
    const key = normalizeKey(item.grupo) || 'GENERAL';
    if (!agrupados[key]) {
      agrupados[key] = {
        grupo: item.grupo,
        total: 0,
        cuentas: []
      };
    }
    agrupados[key].cuentas.push(item);
  });
  return agrupados;
};

async function generarResumenEjecutivo(empresaId, anio, opciones = {}) {
  const opts = {
    basePath: DEFAULT_BASE_PATH,
    mappingPath: RESUMEN_MAPPING_FILE,
    ...opciones
  };

  const empresa = obtenerEmpresaPorId(empresaId);
  if (!empresa) {
    throw new Error(`Empresa ${empresaId} no encontrada`);
  }

  const mappingPath = getResumenPath(opts);
  const filaMapeo = await cargarCsv(mappingPath);
  const reglas = parseRows(filaMapeo);
  const cuentas = reglas.map((item) => item.cuenta);
  const saldos = await obtenerSaldosPorCuentas(empresaId, anio, cuentas);

  const mapaSaldos = new Map();
  saldos.forEach((saldo) => {
    mapaSaldos.set(normalizeKey(saldo.numCta), saldo);
  });

  const filas = reglas.map((item) => {
    const saldo = mapaSaldos.get(item.cuenta);
    return {
      cuenta: item.cuenta,
      descripcion: item.descripcion,
      grupo: item.grupo,
      anual: Number(saldo?.anual ?? saldo?.dic_acum ?? 0),
      dic: Number(saldo?.dic ?? 0),
      dic_acum: Number(saldo?.dic_acum ?? 0)
    };
  });

  const agrupados = agruparFilas(filas);
  const resumen = Object.keys(agrupados).map((clave) => {
    const nodo = agrupados[clave];
    nodo.total = nodo.cuentas.reduce((acc, item) => acc + Number(item.anual || 0), 0);
    return nodo;
  });

  return {
    empresa: empresa.id,
    anio,
    filas,
    grupos: resumen
  };
}

module.exports = {
  generarResumenEjecutivo
};
