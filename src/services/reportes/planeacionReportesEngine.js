const path = require('path');
const { obtenerSaldosPorCuentas } = require('../saldosService');
const { cargarCsv, construirMapaCabeceras, buscarValor, resolverRuta, normalizarTexto } = require('../../utils/csvLoader');
const { obtenerEmpresaPorId } = require('../../config/empresas');

const DEFAULT_BASE_PATH = path.join(__dirname, '..', '..', '..', 'info IMPORTANTE');

const REPORT_CONFIG = {
  SUMMARY: {
    mapFiles: {
      empresa1: 'SUMMARY Ciudad de México.csv',
      empresa2: 'SUMMARY GUADALAJARA.csv',
      empresa3: 'SUMMARY NOROESTE.csv',
      empresa4: 'SUMMARY NOROESTE.csv'
    },
    aliases: {
      CUENTA: ['CUENTA', 'Cuentas', 'CODIGO'],
      DESCRIPCION: ['DESCRIPCION', 'Descripción', 'NOMBRE'],
      SECCION: ['Sección', 'SECCION', 'CATEGORIA'],
      CAPITULO: ['SECCIÓN MAYOR', 'CAPITULO', 'CHAPTER']
    }
  },
  RESUMEN: {
    mapFiles: {
      empresa1: 'Resumen Guadalajara.csv', // Ajustar según corresponda si hay más archivos
      empresa2: 'Resumen Guadalajara.csv',
      empresa3: 'Resumen Guadalajara.csv',
      empresa4: 'Resumen Guadalajara.csv'
    },
    aliases: {
      CUENTA: ['CUENTA', 'CODIGO'],
      DESCRIPCION: ['DESCRIPCION', 'NOMBRE'],
      GRUPO: ['GRUPO', 'SECCION']
    }
  }
};

const normalizeKey = (valor) => {
  if (valor == null) return '';
  return valor.toString().trim().toUpperCase();
};

const getReportPath = (tipo, empresaId) => {
  const config = REPORT_CONFIG[tipo];
  if (!config) return null;
  const filename = config.mapFiles[empresaId];
  if (!filename) return null;
  return path.join(DEFAULT_BASE_PATH, filename);
};

const parseRows = (rows, aliases) => {
  return rows.map((fila) => {
    const headers = construirMapaCabeceras(fila);
    const cuenta = buscarValor(fila, headers, aliases.CUENTA);
    const descripcion = buscarValor(fila, headers, aliases.DESCRIPCION);
    const seccion = buscarValor(fila, headers, aliases.SECCION) || buscarValor(fila, headers, aliases.GRUPO);
    const capitulo = buscarValor(fila, headers, aliases.CAPITULO) || 'GENERAL';
    
    if (!cuenta) return null;

    return {
      cuenta: normalizeKey(cuenta),
      descripcion: descripcion || '',
      seccion: seccion || 'OTROS',
      capitulo: capitulo
    };
  }).filter(Boolean);
};

const isExpense = (label) => {
  const text = normalizeKey(label);
  return text.includes('EXPENSE') || text.includes('GASTO') || text.includes('COSTO');
};

const buildHierarchy = (items, saldosMap) => {
  const root = {
    label: 'Reporte',
    total: 0,
    children: []
  };

  const chapters = new Map();

  items.forEach(item => {
    const saldo = saldosMap.get(item.cuenta);
    const valor = Number(saldo?.dic_acum ?? saldo?.anual ?? 0);
    
    // Agrupar por Capítulo (ej. CDMX Income)
    if (!chapters.has(item.capitulo)) {
      chapters.set(item.capitulo, {
        label: item.capitulo,
        total: 0,
        children: [], // Secciones
        sectionsMap: new Map(),
        type: isExpense(item.capitulo) ? 'expense' : 'income'
      });
    }
    const chapterNode = chapters.get(item.capitulo);

    // Agrupar por Sección (ej. Membership)
    if (!chapterNode.sectionsMap.has(item.seccion)) {
      chapterNode.sectionsMap.set(item.seccion, {
        label: item.seccion,
        total: 0,
        cuentas: []
      });
      chapterNode.children.push(chapterNode.sectionsMap.get(item.seccion));
    }
    const sectionNode = chapterNode.sectionsMap.get(item.seccion);

    // Agregar cuenta
    sectionNode.cuentas.push({
      cuenta: item.cuenta,
      descripcion: item.descripcion,
      valor: valor
    });
    
    sectionNode.total += valor;
    chapterNode.total += valor;
  });

  // Convertir mapa a array y calcular resultados operativos si es necesario
  // Aquí podríamos implementar la lógica de Income - Expense si los capítulos están relacionados
  // Por ahora devolvemos la lista de capítulos como nodos de primer nivel
  
  root.children = Array.from(chapters.values()).map(chap => {
    delete chap.sectionsMap; // Limpiar propiedad auxiliar
    return chap;
  });
  
  // Calcular total global (simple suma por ahora)
  root.total = root.children.reduce((acc, curr) => {
    return acc + (curr.type === 'expense' ? -curr.total : curr.total);
  }, 0);

  return root.children;
};

async function generarReporte(tipoReporte, empresaId, anio) {
  const config = REPORT_CONFIG[tipoReporte];
  if (!config) throw new Error(`Tipo de reporte no soportado: ${tipoReporte}`);

  const filePath = getReportPath(tipoReporte, empresaId);
  if (!filePath) throw new Error(`No hay configuración para ${tipoReporte} en empresa ${empresaId}`);

  const rawRows = await cargarCsv(filePath);
  const items = parseRows(rawRows, config.aliases);
  
  const cuentas = items.map(i => i.cuenta);
  const saldos = await obtenerSaldosPorCuentas(empresaId, anio, cuentas);
  
  const saldosMap = new Map();
  saldos.forEach(s => saldosMap.set(normalizeKey(s.numCta), s));

  const resumen = buildHierarchy(items, saldosMap);

  return {
    empresa: empresaId,
    anio,
    resumen
  };
}

module.exports = {
  generarReporte
};
