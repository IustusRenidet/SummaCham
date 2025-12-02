const path = require('path');
const { obtenerSaldosPorCuentas } = require('../saldosService');
const { cargarCsv, construirMapaCabeceras, buscarValor, resolverRuta, normalizarTexto } = require('../../utils/csvLoader');
const { EMPRESAS, obtenerEmpresaPorId } = require('../../config/empresas');

const DEFAULT_BASE_PATH = path.join(__dirname, '..', '..', 'info IMPORTANTE');
const SUMMARY_MAP_FILES = {
  empresa1: 'SUMMARY Ciudad de México.csv',
  empresa2: 'SUMMARY GUADALAJARA.csv',
  empresa3: 'SUMMARY NOROESTE.csv',
  empresa4: 'SUMMARY NOROESTE.csv'
};
const SUMMARY_RULES_FILE = 'SUMAS CIUDAD DE MEXICO.csv';
const DEFAULT_COMPANY_ALIASES = {
  CDMX: 'empresa1',
  'CIUDAD DE MEXICO': 'empresa1',
  GDL: 'empresa2',
  GUADALAJARA: 'empresa2',
  NORESTE: 'empresa3',
  MTY: 'empresa3',
  'NORESTE': 'empresa3',
  'NORESTE MEXICO': 'empresa3',
  NOROESTE: 'empresa4'
};

const ALIAS_CUENTA = ['CUENTA', 'CODIGO', 'NUMCTA', 'CTACTE', 'CTA'];
const ALIAS_SECCION = ['SECCION', 'SECCION HIJA', 'SECTION', 'CATEGORIA', 'CATEGORY', 'SECCION_LABEL', 'SUMROW'];
const ALIAS_PADRE = ['SECCION MAYOR', 'PADRE', 'PARENT', 'TARGET', 'GRUPO', 'DESTINO'];
const ALIAS_OPERACION = ['OPERACION', 'OPERACION', 'OPERATION', 'ACCION', 'ACTION', 'TIPO'];
const ALIAS_EMPRESA = ['EMPRESA', 'COMPANY', 'CIUDAD', 'REGION', 'DIVISION'];

const normalizeKey = (valor) => {
  const texto = normalizarTexto(valor);
  return texto;
};

const garantizarNode = (mapa, clave, etiqueta) => {
  const existente = mapa.get(clave);
  if (existente) {
    if (!existente.label && etiqueta) {
      existente.label = etiqueta;
    }
    return existente;
  }
  const nodo = {
    key: clave,
    label: etiqueta || clave,
    total: 0,
    children: []
  };
  mapa.set(clave, nodo);
  return nodo;
};

const obtenerEmpresaAlias = (header, hoja = {}) => {
  const headers = construirMapaCabeceras(hoja);
  const valor = buscarValor(hoja, headers, ALIAS_EMPRESA) || '';
  return normalizeKey(valor || header || '');
};

const obtenerOperacion = (row, headers) => {
  const valor = buscarValor(row, headers, ALIAS_OPERACION) || '';
  const texto = normalizeKey(valor);
  if (texto.includes('REST')) return 'resta';
  if (texto.includes('SUB')) return 'resta';
  return 'sumar';
};

const getMappingPath = (empresaId, options) => {
  const overrides = options.mappingFiles || {};
  const override = overrides[empresaId];
  if (override) {
    return resolverRuta(override, options.basePath);
  }
  const archivo = SUMMARY_MAP_FILES[empresaId];
  if (!archivo) {
    return null;
  }
  return resolverRuta(path.join(options.basePath, archivo));
};

const getRulesPath = (options) => resolverRuta(options.rulesPath || SUMMARY_RULES_FILE, options.basePath);

const parseMapping = (rows) => {
  const mapa = new Map();
  rows.forEach((fila) => {
    const headers = construirMapaCabeceras(fila);
    const cuenta = normalizeKey(buscarValor(fila, headers, ALIAS_CUENTA));
    if (!cuenta) return;
    const seccion = buscarValor(fila, headers, ALIAS_SECCION) || '';
    const padre = buscarValor(fila, headers, ALIAS_PADRE) || '';
    mapa.set(cuenta, {
      sectionKey: normalizeKey(seccion) || 'SIN_SECCION',
      sectionLabel: seccion || 'Sin sección',
      parentKey: normalizeKey(padre) || 'SIN_PADRE',
      parentLabel: padre || ''
    });
  });
  return mapa;
};

const parseRules = (rows) => {
  return rows.map((fila) => {
    const headers = construirMapaCabeceras(fila);
    const section = buscarValor(fila, headers, ALIAS_SECCION) || '';
    const parent = buscarValor(fila, headers, ALIAS_PADRE) || '';
    const company = buscarValor(fila, headers, ALIAS_EMPRESA) || '';
    return {
      sectionKey: normalizeKey(section) || 'SIN_SECCION',
      sectionLabel: section || 'Sin sección',
      parentKey: normalizeKey(parent) || 'RAIZ',
      parentLabel: parent || 'Resultado',
      operation: obtenerOperacion(fila, headers),
      companyLabel: normalizeKey(company),
      companyRaw: company
    };
  });
};

const resolveEmpresaId =
  (aliasMap = DEFAULT_COMPANY_ALIASES) =>
  (empresaId, alias) => {
    if (!alias) return empresaId;
    const key = normalizeKey(alias);
    if (aliasMap[key]) return aliasMap[key];
    const encontrada = EMPRESAS.find(
      (empresa) => normalizeKey(empresa.id) === key || normalizeKey(empresa.nombre) === key || normalizeKey(empresa.etiqueta) === key
    );
    return encontrada ? encontrada.id : aliasMap[key] || empresaId;
  };

const buildSectionTotals = async (empresaId, anio, mapping, options) => {
  const cuentas = Array.from(mapping.keys());
  if (!cuentas.length) {
    return new Map();
  }
  const saldos = await obtenerSaldosPorCuentas(empresaId, anio, cuentas);
  const totals = new Map();
  saldos.forEach((fila) => {
    const key = normalizeKey(fila.numCta);
    const info = mapping.get(key);
    if (!info) return;
    const valor = Number(fila.dic_acum ?? fila.anual ?? 0);
    totals.set(info.sectionKey, (totals.get(info.sectionKey) || 0) + valor);
  });
  return totals;
};

async function generarSummary(empresaId, anio, opciones = {}) {
  const opts = {
    basePath: DEFAULT_BASE_PATH,
    mappingFiles: {},
    rulesPath: SUMMARY_RULES_FILE,
    companyAliases: DEFAULT_COMPANY_ALIASES,
    ...opciones
  };

  const empresa = obtenerEmpresaPorId(empresaId);
  if (!empresa) {
    throw new Error(`Empresa ${empresaId} no encontrada`);
  }

  const baseMappingPath = getMappingPath(empresaId, opts);
  if (!baseMappingPath) {
    throw new Error(`No se encontró el archivo de mapeo para ${empresaId}`);
  }

  const rawMapping = await cargarCsv(baseMappingPath);
  const mapping = parseMapping(rawMapping);
  const rulesPath = getRulesPath(opts);
  const rawRules = await cargarCsv(rulesPath);
  const rules = parseRules(rawRules);

  const resolverEmpresa = resolveEmpresaId(opts.companyAliases);
  const empresasNecesarias = new Set([empresaId]);
  rules.forEach((rule) => {
    if (rule.companyLabel) {
      empresasNecesarias.add(resolverEmpresa(empresaId, rule.companyLabel));
    }
  });

  const totalsPorEmpresa = new Map();
  const mappingPorEmpresa = new Map();
  for (const targetId of empresasNecesarias) {
    const pathMap = getMappingPath(targetId, opts) || baseMappingPath;
    const filas = await cargarCsv(pathMap);
    const parsed = parseMapping(filas);
    mappingPorEmpresa.set(targetId, parsed);
    const totals = await buildSectionTotals(targetId, anio, parsed, opts);
    totalsPorEmpresa.set(targetId, totals);
  }

  const detalle = Array.from((totalsPorEmpresa.get(empresaId) || new Map()).entries()).map(([key, value]) => ({
    seccion: key,
    total: value
  }));

  const resumen = new Map();
  rules.forEach((rule) => {
    const targetEmpresa = resolverEmpresa(empresaId, rule.companyLabel);
    const totals = totalsPorEmpresa.get(targetEmpresa) || new Map();
    const sectionTotal = totals.get(rule.sectionKey) || 0;
    const amount = rule.operation === 'resta' ? -sectionTotal : sectionTotal;
    const padre = garantizarNode(resumen, rule.parentKey, rule.parentLabel);
    padre.total += amount;
    padre.children.push({
      label: rule.sectionLabel,
      total: amount,
      section: rule.sectionKey,
      empresa: targetEmpresa,
      operation: rule.operation
    });
  });

  return {
    empresa: empresa.id,
    anio,
    detalle,
    resumen: Array.from(resumen.values()),
    reglasAplicadas: rules.length
  };
}

module.exports = {
  generarSummary
};
