const path = require('path');
const fs = require('fs/promises');
const { parse } = require('csv-parse/sync');
const { ejecutarConsulta } = require('./firebirdService');
const { construirSelectResumen } = require('./saldosResumenHelper');
const { obtenerEmpresaPorId } = require('../config/empresas');

const DEFAULT_SUMMARY_BASE = path.join(__dirname, '..', 'info IMPORTANTE');

const MAPEOS_SUMMARY = {
  CDMX: 'SUMMARY Ciudad de México.csv',
  GDL: 'SUMMARY GUADALAJARA.csv',
  MTY: 'SUMMARY NOROESTE.csv'
};

const DEFAULT_REGLAS = path.join(DEFAULT_SUMMARY_BASE, 'SUMAS CIUDAD DE MEXICO.csv');

const DEFAULT_ALIAS_EMPRESAS = {
  'CDMX': 'CDMX',
  'CIUDAD DE MEXICO': 'CDMX',
  'CDMX INCOME': 'CDMX',
  'CDMX EXPENSE': 'CDMX',
  'GDL': 'GDL',
  'GUADALAJARA': 'GDL',
  'MTY': 'MTY',
  'NOROESTE': 'MTY'
};

const normalizeKey = (valor) => {
  if (valor == null) {
    return '';
  }
  return valor.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
};

const buildHeaderMap = (row) => {
  const mapa = {};
  Object.keys(row || {}).forEach((header) => {
    mapa[normalizeKey(header)] = header;
  });
  return mapa;
};

const findCellValue = (row, headerMap, aliases = []) => {
  for (let idx = 0; idx < aliases.length; idx += 1) {
    const alias = normalizeKey(aliases[idx]);
    if (alias && headerMap[alias]) {
      return row[headerMap[alias]];
    }
  }
  return null;
};

const parseCsv = (texto) => {
  return parse(texto, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    relax_column_count: true,
    trim: true
  });
};

const getMappingFile = (empresa, options) => {
  const overrides = options.mappingFiles || {};
  const override = overrides[empresa];
  if (override) {
    return path.isAbsolute(override) ? override : path.join(options.basePath, override);
  }
  const archivo = MAPEOS_SUMMARY[empresa];
  if (!archivo) {
    return null;
  }
  return path.join(options.basePath, archivo);
};

const ALIAS_CUENTAS = ['cuentas', 'cuenta', 'number', 'codigo', 'numcta', 'num cta', 'num'];
const ALIAS_SECCION = ['seccion', 'seccion hija', 'section', 'categoria', 'category', 'sumrow', 'label'];
const ALIAS_SECCION_MAYOR = ['seccion mayor', 'seccionpadre', 'parent', 'parentlabel', 'categoria padre', 'destino'];

const loadMapping = async (empresa, options) => {
  const ruta = getMappingFile(empresa, options);
  if (!ruta) {
    throw new Error(`No se encontró un resumen asociado a ${empresa}`);
  }
  const contenido = await fs.readFile(ruta, 'utf-8');
  const filas = parseCsv(contenido);
  const cuentas = new Map();
  filas.forEach((fila) => {
    const headers = buildHeaderMap(fila);
    const cuentaRaw = findCellValue(fila, headers, ALIAS_CUENTAS) || '';
    const seccionRaw = findCellValue(fila, headers, ALIAS_SECCION) || '';
    const seccionMayorRaw = findCellValue(fila, headers, ALIAS_SECCION_MAYOR) || '';
    const cuentaKey = normalizeKey(cuentaRaw);
    if (!cuentaKey) {
      return;
    }
    cuentas.set(cuentaKey, {
      sectionKey: normalizeKey(seccionRaw) || 'SIN_SECCION',
      sectionLabel: seccionRaw?.toString().trim() || 'Sin sección',
      parentKey: normalizeKey(seccionMayorRaw) || 'SIN_PADRE',
      parentLabel: seccionMayorRaw?.toString().trim() || ''
    });
  });
  return { cuentas };
};

const ALIAS_SECTION = ['seccion', 'section', 'label', 'sumrow', 'resultado', 'categoria', 'elemento', 'concepto'];
const ALIAS_PARENT = ['seccion mayor', 'parent', 'destino', 'resultado padre', 'categoria padre', 'resultado', 'padre'];
const ALIAS_LABEL = ['label', 'etiqueta', 'titulo', 'nombre', 'resultado', 'name'];
const ALIAS_OPERATION = ['operacion', 'operación', 'accion', 'action', 'tipo', 'modo', 'operation'];
const ALIAS_COMPANY = ['empresa', 'company', 'region', 'division', 'ciudad'];

const parseRules = (filas) => {
  return filas.map((fila) => {
    const headers = buildHeaderMap(fila);
    const sectionRaw = findCellValue(fila, headers, ALIAS_SECTION) || '';
    const parentRaw = findCellValue(fila, headers, ALIAS_PARENT) || '';
    const labelRaw = findCellValue(fila, headers, ALIAS_LABEL) || sectionRaw || parentRaw || '';
    const operationRaw = (findCellValue(fila, headers, ALIAS_OPERATION) || '').toString().toLowerCase();
    const companyRaw = findCellValue(fila, headers, ALIAS_COMPANY) || '';
    const operation = operationRaw.includes('rest')
      || operationRaw.includes('minus')
      || operationRaw.includes('sustr')
      || operationRaw.includes('-')
      ? 'resta'
      : 'sumar';
    return {
      sectionKey: normalizeKey(sectionRaw),
      sectionLabel: sectionRaw?.toString().trim(),
      parentKey: normalizeKey(parentRaw || labelRaw) || 'RAIZ',
      parentLabel: parentRaw?.toString().trim() || labelRaw?.toString().trim(),
      label: labelRaw?.toString().trim() || sectionRaw?.toString().trim(),
      operation,
      companyRaw: normalizeKey(companyRaw),
      companyLabel: companyRaw?.toString().trim()
    };
  });
};

const ensureNode = (map, key, label) => {
  const existente = map.get(key);
  if (existente) {
    if (!existente.label && label) {
      existente.label = label;
    }
    return existente;
  }
  const nodo = {
    key,
    label: label || key,
    total: 0,
    children: []
  };
  map.set(key, nodo);
  return nodo;
};

const crearTotalesPorSeccion = async (empresaIdReal, anio, mapping) => {
  const codigos = Array.from(mapping.cuentas.keys());
  if (!codigos.length) {
    return { sections: new Map(), cuentas: mapping.cuentas };
  }
  const consulta = construirSelectResumen({
    anio,
    periodo: 13,
    usarAjusteEnYTD: true,
    codigos
  });
  const filas = await ejecutarConsulta(empresaIdReal, consulta.sql, consulta.parametros);
  const sections = new Map();
  filas.forEach((fila) => {
    const codigo = normalizeKey(fila.CODIGO);
    if (!codigo) {
      return;
    }
    const info = mapping.cuentas.get(codigo);
    if (!info) {
      return;
    }
    const ytd = Number(fila.YTD ?? 0) || 0;
    const claveSeccion = info.sectionKey || 'SIN_SECCION';
    sections.set(claveSeccion, (sections.get(claveSeccion) || 0) + ytd);
  });
  return { sections, cuentas: mapping.cuentas };
};

const resolveEmpresaKey = (empresaId, options) => {
  const tex = normalizeKey(empresaId || '');
  if (!tex) return '';
  const alias = options.companyAliases?.[tex];
  return alias || DEFAULT_ALIAS_EMPRESAS[tex] || tex;
};

const DEFAULT_OPTIONS = {
  basePath: DEFAULT_SUMMARY_BASE,
  mappingFiles: {},
  rulesPath: DEFAULT_REGLAS,
  companyAliases: DEFAULT_ALIAS_EMPRESAS
};

async function generarReporteSummary(empresaId, anio, opciones = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...opciones };
  const empresaReal = obtenerEmpresaPorId(empresaId);
  if (!empresaReal) {
    throw new Error(`Empresa ${empresaId} no encontrada`);
  }
  const ejercicio = Number(anio);
  if (!Number.isInteger(ejercicio)) {
    throw new Error('Ejercicio inválido');
  }
  const baseKey = resolveEmpresaKey(empresaReal.id, opts);
  const mappingCache = new Map();
  const totalsCache = new Map();

  const cargarTotales = async (empresaClave) => {
    if (totalsCache.has(empresaClave)) {
      return totalsCache.get(empresaClave);
    }
    const mapping = await loadMapping(empresaClave, opts).catch((error) => {
      console.warn(`No se pudo cargar el mapa para ${empresaClave}:`, error.message);
      return { cuentas: new Map() };
    });
    mappingCache.set(empresaClave, mapping);
    const empresaConfig = obtenerEmpresaPorId(empresaClave);
    if (!empresaConfig) {
      console.warn(`No existe configuración Firebird para ${empresaClave}`);
      const vacio = { sections: new Map(), cuentas: mapping.cuentas };
      totalsCache.set(empresaClave, vacio);
      return vacio;
    }
    try {
      const totales = await crearTotalesPorSeccion(empresaConfig.id, ejercicio, mapping);
      totalsCache.set(empresaClave, totales);
      return totales;
    } catch (error) {
      console.warn(`Error consultando saldos para ${empresaClave}:`, error.message);
      const fallback = { sections: new Map(), cuentas: mapping.cuentas };
      totalsCache.set(empresaClave, fallback);
      return fallback;
    }
  };

  const reglasRaw = await fs.readFile(opts.rulesPath, 'utf-8').catch((error) => {
    throw new Error(`No fue posible leer el archivo de reglas (${opts.rulesPath}): ${error.message}`);
  });
  const reglas = parseRules(parseCsv(reglasRaw));
  const empresasNecesarias = new Set([baseKey]);
  reglas.forEach((regla) => {
    if (regla.companyRaw) {
      empresasNecesarias.add(resolveEmpresaKey(regla.companyRaw, opts));
    }
  });
  const totalsPorEmpresa = new Map();
  await Promise.all(Array.from(empresasNecesarias).map(async (clave) => {
    if (!clave) return;
    const totales = await cargarTotales(clave);
    totalsPorEmpresa.set(clave, totales);
  }));

  const arbol = new Map();
  reglas.forEach((regla) => {
    const companyKey = regla.companyRaw ? resolveEmpresaKey(regla.companyRaw, opts) : baseKey;
    const totalesEmpresa = totalsPorEmpresa.get(companyKey) || { sections: new Map() };
    const amount = regla.sectionKey
      ? (totalesEmpresa.sections.get(regla.sectionKey) || 0)
      : 0;
    const aplicado = regla.operation === 'resta' ? -amount : amount;
    const nodo = ensureNode(arbol, regla.parentKey, regla.parentLabel || regla.parentKey);
    nodo.total += aplicado;
    nodo.children.push({
      label: regla.label || regla.sectionLabel || 'Detalle',
      total: aplicado,
      valor: amount,
      company: companyKey,
      operation: regla.operation,
      section: regla.sectionLabel,
      empresaLabel: regla.companyLabel
    });
  });

  const salida = {};
  arbol.forEach((nodo) => {
    const valor = nodo.children.length
      ? {
        key: nodo.key,
        label: nodo.label,
        total: nodo.total,
        children: nodo.children
      }
      : nodo.total;
    salida[nodo.key] = valor;
  });

  return {
    empresa: empresaReal.id,
    anio: ejercicio,
    resultado: salida,
    reglasAplicadas: reglas.length
  };
}

module.exports = {
  generarReporteSummary
};
