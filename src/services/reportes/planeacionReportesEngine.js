const path = require('path');
const fs = require('fs');
const { obtenerDatosPlaneacion } = require('../planeacionCuentasService');
const { MESES } = require('../saldosService');
const layoutService = require('../layoutService');

// Helper para resolver rutas en ASAR
const resolveUnpackedPath = (relativePath) => {
  let basePath = __dirname;
  // Si estamos dentro de app.asar, usar app.asar.unpacked
  if (basePath.includes('app.asar') && !basePath.includes('app.asar.unpacked')) {
    basePath = basePath.replace('app.asar', 'app.asar.unpacked');
  }
  return path.join(basePath, relativePath);
};

const DEFAULT_BASE_PATH = resolveUnpackedPath('../../../info IMPORTANTE');
const DEFINICIONES_FILE = path.join(DEFAULT_BASE_PATH, 'CUENTAS SUMMARY y RESUMEN.json');

const NORMALIZAR_CLAVE = (valor = '') => valor.toString().trim().toUpperCase();
const NORMALIZAR_CAPITULO = (valor = '') => valor.toString().trim().toUpperCase();

/**
 * Cargar definiciones desde SQLite con fallback a JSON
 */
function cargarDefinicionesModulo(modulo, empresaId = 'EMPRESA01', anio = new Date().getFullYear()) {
  try {
    // Intentar cargar desde SQLite
    const capitulos = layoutService.obtenerCapitulos({ empresaId, modulo, anio });
    
    if (capitulos && capitulos.length > 0) {
      const definiciones = {};
      
      for (const cap of capitulos) {
        const layout = layoutService.obtenerLayout({ 
          empresaId, 
          modulo, 
          anio, 
          capitulo: cap.capitulo 
        });
        
        // Convertir a formato legacy
        definiciones[cap.capitulo] = layout.cuentas.map(cuenta => ({
          CAPITULO: cap.capitulo,
          CUENTA: cuenta.CUENTA,
          NOMBRE: cuenta.NOMBRE,
          'SECCIÓN Principal': cuenta['SECCIÓN Principal'],
          'SECCION Secundaria': cuenta['SECCION Secundaria']
        }));
        
        // Agregar operaciones si existen
        if (layout.operaciones && layout.operaciones.length > 0) {
          definiciones['SUMA DE VARIAS SECCIONES'] = layout.operaciones;
        }
      }
      
      return definiciones;
    }
  } catch (error) {
    console.warn(`⚠️ No se pudo cargar desde SQLite para ${modulo}, usando JSON:`, error.message);
  }
  
  // Fallback: cargar desde JSON
  try {
    const contenido = fs.readFileSync(DEFINICIONES_FILE, 'utf-8');
    return JSON.parse(contenido);
  } catch (error) {
    console.error('❌ Error al cargar definiciones:', error);
    return {};
  }
}

const normalizarCuentaCanonica = (valor = '') => {
  const limpio = valor.toString().replace(/[^0-9]/g, '');
  if (!limpio) return '';

  if (limpio.length >= 21) {
    return limpio.slice(0, 21);
  }

  const visible = limpio.slice(0, 11).padEnd(11, '0');
  const b = visible.slice(3, 6);
  const c = visible.slice(6, 9);
  const d = visible.slice(9, 11);

  const nivel = (() => {
    if (b === '000' && c === '000' && d === '00') return '1';
    if (c === '000' && d === '00') return '2';
    if (d === '00') return '3';
    return '4';
  })();

  return visible.padEnd(20, '0') + nivel;
};

const cuentaVisibleDesdeCanonica = (cuentaCanonica = '') => {
  const base = cuentaCanonica.toString().padStart(21, '0');
  const visible = base.slice(0, 11);
  return `${visible.slice(0, 3)}-${visible.slice(3, 6)}-${visible.slice(6, 9)}-${visible.slice(9, 11)}`;
};

/**
 * Cargar definiciones (usa SQLite con fallback a JSON)
 */
const cargarDefiniciones = (modulo = 'SUMMARY', empresaId = 'EMPRESA01', anio = new Date().getFullYear()) => {
  return cargarDefinicionesModulo(modulo, empresaId, anio);
};

const extraerCapitulos = (lista = []) => {
  const vistos = new Map();
  lista.forEach((item) => {
    const etiqueta = (item.CAPITULO || '').toString().trim();
    if (!etiqueta) return;
    const clave = NORMALIZAR_CAPITULO(etiqueta);
    if (!vistos.has(clave)) {
      vistos.set(clave, etiqueta);
    }
  });
  return Array.from(vistos, ([clave, etiqueta]) => ({ clave, etiqueta }));
};

const NOMBRES_MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre'
];

const normalizarClaveMes = (mesEntrada) => {
  if (mesEntrada == null) return null;
  const numero = Number(mesEntrada);
  if (Number.isInteger(numero) && numero >= 1 && numero <= 12) {
    return MESES[numero - 1].clave;
  }

  const texto = mesEntrada.toString().trim().toLowerCase();
  if (!texto) return null;

  const coincidencia = MESES.find(({ alias, clave }, idx) => {
    return (
      alias.toLowerCase() === texto
      || clave.toLowerCase() === texto
      || NOMBRES_MESES[idx] === texto
      || NOMBRES_MESES[idx].startsWith(texto)
    );
  });

  return coincidencia ? coincidencia.clave : null;
};

const obtenerClaveMesAnterior = (claveMes) => {
  const idx = MESES.findIndex(({ clave }) => clave === claveMes);
  if (idx > 0) {
    return MESES[idx - 1].clave;
  }
  return null;
};

const calcularTotales = (cuentas, claveMes, planeacionActual, planeacionPrev) => {
  const claveAcum = `${claveMes}_acum`;

  return cuentas.reduce(
    (acc, cuenta) => {
      const actual = planeacionActual.find((p) => p.cuenta === cuenta);
      const previo = planeacionPrev?.find((p) => p.cuenta === cuenta);

      acc.actualMonth += Number(actual?.real?.[claveMes] ?? 0);
      acc.planMonth += Number(actual?.presupuesto?.[claveMes] ?? 0);
      acc.prevMonth += Number(previo?.real?.[claveMes] ?? 0);

      acc.actualYTD += Number(actual?.real?.[claveAcum] ?? 0);
      acc.planYTD += MESES.reduce((total, { clave }) => {
        if (total.detener) return total;
        const nuevo = total.total + Number(actual?.presupuesto?.[clave] ?? 0);
        if (clave === claveMes) return { total: nuevo, detener: true };
        return { total: nuevo, detener: false };
      }, { total: 0, detener: false }).total;
      acc.prevYTD += Number(previo?.real?.[claveAcum] ?? 0);

      return acc;
    },
    { actualMonth: 0, planMonth: 0, prevMonth: 0, actualYTD: 0, planYTD: 0, prevYTD: 0 }
  );
};

const crearAcumulador = () => ({
  actualMonth: 0,
  planMonth: 0,
  prevMonth: 0,
  actualYTD: 0,
  planYTD: 0,
  prevYTD: 0
});

const sumarTotales = (destino, origen, factor = 1) => {
  if (!destino || !origen) return destino;
  destino.actualMonth += factor * Number(origen.actualMonth ?? 0);
  destino.planMonth += factor * Number(origen.planMonth ?? 0);
  destino.prevMonth += factor * Number(origen.prevMonth ?? 0);
  destino.actualYTD += factor * Number(origen.actualYTD ?? 0);
  destino.planYTD += factor * Number(origen.planYTD ?? 0);
  destino.prevYTD += factor * Number(origen.prevYTD ?? 0);
  return destino;
};

const construirNodoSeccion = ({ seccion, cuentas, definicion, claveMes, planeacionActual, planeacionPrev, orden = 0 }) => {
  const totales = calcularTotales(cuentas, claveMes, planeacionActual, planeacionPrev);

  const cuentasDetalle = cuentas.map((cuentaId) => {
    const actual = planeacionActual.find((p) => p.cuenta === cuentaId) || {};
    const previo = planeacionPrev?.find((p) => p.cuenta === cuentaId) || {};

    const planYTD = MESES.reduce((acc, { clave }) => {
      if (acc.detener) return acc;
      const nuevo = acc.total + Number(actual.presupuesto?.[clave] ?? 0);
      if (clave === claveMes) return { total: nuevo, detener: true };
      return { total: nuevo, detener: false };
    }, { total: 0, detener: false }).total;

    const metadataCuenta = definicion.get(cuentaId) || {};
    return {
      cuenta: metadataCuenta.visible || cuentaId,
      cuentaCanonica: cuentaId,
      descripcion: metadataCuenta.descripcion || '',
      actualMonth: Number(actual.real?.[claveMes] ?? 0),
      planMonth: Number(actual.presupuesto?.[claveMes] ?? 0),
      prevMonth: Number(previo.real?.[claveMes] ?? 0),
      actualYTD: Number(actual.real?.[`${claveMes}_acum`] ?? 0),
      planYTD,
      prevYTD: Number(previo.real?.[`${claveMes}_acum`] ?? 0)
    };
  });

  return {
    label: seccion,
    cuentas: cuentasDetalle,
    orden,
    totalActualMonth: totales.actualMonth,
    totalPlanMonth: totales.planMonth,
    totalPrevMonth: totales.prevMonth,
    totalActualYTD: totales.actualYTD,
    totalPlanYTD: totales.planYTD,
    totalPrevYTD: totales.prevYTD,
    total: totales.actualYTD
  };
};

const construirReporteResumen = (definiciones, configAgrupacion, capituloSeleccionado, claveMes, planeacionActual, planeacionPrev) => {
  const definicionCuentas = new Map();
  const principalMap = new Map();

  const capituloClave = NORMALIZAR_CAPITULO(capituloSeleccionado || '');

  // CAMBIO CRÍTICO: usar el índice del JSON directamente para preservar el orden
  const seccionOrden = new Map();
  const principalOrden = new Map();
  const consolidadoOrden = new Map();
  const resultOrden = new Map();
  const netOrden = new Map();
  const finalOrden = new Map();

  const configPorSeccion = new Map();
  if (Array.isArray(configAgrupacion)) {
    configAgrupacion.forEach((cfg, idx) => {
      const cap = NORMALIZAR_CAPITULO(cfg.CAPITULO);
      const seccion = (cfg.SECCION || '').toString().trim();
      if (!seccion || cap !== capituloClave) return;
      const key = `${cap}|${seccion.toUpperCase()}`;
      configPorSeccion.set(key, {
        sumRow: cfg['sum-row'] || '',
        principal: cfg['sum-row-sumavarios'] || '',
        consolidado: cfg['sum-row-sumavarios-consolidado'] || '',
        operativo: cfg['sum-row-operativo'] || '',
        operativoConsolidado: cfg['sum-row-operativo-consolidado'] || '',
        resultRow: cfg['result-row'] || '',
        netRow: cfg['net-row'] || '',
        netRowAdicional: cfg['net-row-adicional'] || '',
        resultNetRow: cfg['result-net-row'] || '',
        clase: cfg.Clase || ''
      });

      if (!seccionOrden.has(seccion)) {
        seccionOrden.set(seccion, idx);
      }
      const principal = cfg['sum-row-sumavarios'];
      if (principal && !principalOrden.has(principal)) {
        principalOrden.set(principal, idx);
      }
      const consolidado = cfg['sum-row-sumavarios-consolidado'];
      if (consolidado && !consolidadoOrden.has(consolidado)) {
        consolidadoOrden.set(consolidado, idx);
      }
      const resultRow = cfg['result-row'];
      if (resultRow && !resultOrden.has(resultRow)) {
        resultOrden.set(resultRow, idx);
      }
      const netRow = cfg['net-row'];
      if (netRow && !netOrden.has(netRow)) {
        netOrden.set(netRow, idx);
      }
      const netRowAdicional = cfg['net-row-adicional'];
      if (netRowAdicional && !netOrden.has(netRowAdicional)) {
        netOrden.set(netRowAdicional, idx);
      }
      const finalRow = cfg['result-net-row'];
      if (finalRow && !finalOrden.has(finalRow)) {
        finalOrden.set(finalRow, idx);
      }
    });
  }

  // Procesar definiciones RESPETANDO el orden de aparición en el JSON
  // Necesitamos un orden jerárquico: Principal (orden global) → Secundaria (orden dentro de Principal)
  const principalFirstAppearance = new Map(); // Guardar índice global de primera aparición de cada Principal
  const seccionFirstAppearance = new Map(); // Guardar índice global de primera aparición de cada Secundaria
  
  definiciones.forEach((item, idx) => {
    const capReal = NORMALIZAR_CAPITULO(item.CAPITULO || '');
    if (capReal !== capituloClave) return;

    const seccion = (item['SECCION Secundaria'] || item['Secci¢n'] || item['SECCION'] || '').toString().trim();
    const cuentaCanonica = normalizarCuentaCanonica(item.CUENTA);
    if (!seccion || !cuentaCanonica) return;

    definicionCuentas.set(cuentaCanonica, {
      descripcion: item.NOMBRE || '',
      visible: item.CUENTA || cuentaVisibleDesdeCanonica(cuentaCanonica)
    });

    const keyConfig = `${capituloClave}|${seccion.toUpperCase()}`;
    const config = configPorSeccion.get(keyConfig) || {};

    const principalLabel = item['SECCIÓN Principal'] || config.principal || 'GENERAL';
    
    // Registrar la PRIMERA aparición de cada Principal (índice global)
    if (!principalFirstAppearance.has(principalLabel)) {
      principalFirstAppearance.set(principalLabel, idx);
    }

    const principalKey = NORMALIZAR_CLAVE(principalLabel);
    if (!principalMap.has(principalKey)) {
      principalMap.set(principalKey, {
        key: principalKey,
        label: principalLabel,
        clase: (config.clase || '').toString(),
        consolidadoLabel: config.consolidado || '',
        operativoLabel: config.operativo || '',
        resultRow: config.resultRow || '',
        netRow: config.netRow || '',
        netRowAdicional: config.netRowAdicional || '',
        resultNetRow: config.resultNetRow || '',
        orden: principalFirstAppearance.get(principalLabel),
        secciones: new Map()
      });
    }

    const principalNode = principalMap.get(principalKey);
    const seccionKey = seccion || 'SIN SECCIÓN';
    
    // Registrar la PRIMERA aparición de cada Secundaria (índice global)
    if (!seccionFirstAppearance.has(seccionKey)) {
      seccionFirstAppearance.set(seccionKey, idx);
    }
    
    if (!principalNode.secciones.has(seccionKey)) {
      principalNode.secciones.set(seccionKey, {
        label: seccionKey,
        cuentas: [],
        orden: seccionFirstAppearance.get(seccionKey)
      });
    }
    
    // Las cuentas se agregan en el orden que aparecen en el JSON
    principalNode.secciones.get(seccionKey).cuentas.push(cuentaCanonica);
  });

  const principalList = Array.from(principalMap.values()).map((principal) => {
    const seccionesOrdenadas = Array.from(principal.secciones.values()).sort((a, b) => a.orden - b.orden);
    const children = seccionesOrdenadas.map((sec) => construirNodoSeccion({
      seccion: sec.label,
      cuentas: sec.cuentas,
      definicion: definicionCuentas,
      claveMes,
      planeacionActual,
      planeacionPrev,
      orden: sec.orden
    }));

    const totalesPrincipal = children.reduce(
      (acc, nodo) => ({
        actualMonth: acc.actualMonth + nodo.totalActualMonth,
        planMonth: acc.planMonth + nodo.totalPlanMonth,
        prevMonth: acc.prevMonth + nodo.totalPrevMonth,
        actualYTD: acc.actualYTD + nodo.totalActualYTD,
        planYTD: acc.planYTD + nodo.totalPlanYTD,
        prevYTD: acc.prevYTD + nodo.totalPrevYTD
      }),
      crearAcumulador()
    );

    const clase = (principal.clase || '').toLowerCase();
    const sign = clase.includes('expense') ? -1 : 1;

    return {
      label: principal.label,
      children,
      ...totalesPrincipal,
      total: totalesPrincipal.actualYTD,
      orden: principal.orden,
      consolidadoLabel: principal.consolidadoLabel || '',
      operativoLabel: principal.operativoLabel || '',
      resultRow: principal.resultRow || '',
      netRow: principal.netRow || '',
      netRowAdicional: principal.netRowAdicional || '',
      resultNetRow: principal.resultNetRow || '',
      sign
    };
  }).sort((a, b) => a.orden - b.orden);

  const consolidatedMap = new Map();
  const resultRowMap = new Map();
  const netRowMap = new Map();
  const finalRowMap = new Map();

  const describirPrincipalOperacion = (principal, factor = null) => ({
    principal: principal.label,
    factor: factor != null ? factor : principal.sign,
    sections: (principal.children || []).map((sec) => sec.label || '')
  });

  const ensureAggregator = (mapa, etiqueta, ordenMapa) => {
    if (!etiqueta) return null;
    if (!mapa.has(etiqueta)) {
      mapa.set(etiqueta, {
        label: etiqueta,
        orden: ordenMapa.has(etiqueta) ? ordenMapa.get(etiqueta) : mapa.size + ordenMapa.size,
        totals: crearAcumulador(),
        principals: [],
        operaciones: []
      });
    }
    return mapa.get(etiqueta);
  };

  principalList.forEach((principal) => {
    const consolidated = ensureAggregator(consolidatedMap, principal.consolidadoLabel || principal.label, consolidadoOrden);
    if (consolidated) {
      consolidated.principals.push(principal.label);
      consolidated.operaciones.push(describirPrincipalOperacion(principal, 1));
      sumarTotales(consolidated.totals, principal);
    }

    const resultRow = ensureAggregator(resultRowMap, principal.resultRow, resultOrden);
    if (resultRow) {
      resultRow.principals.push(principal.label);
      resultRow.operaciones.push(describirPrincipalOperacion(principal));
      sumarTotales(resultRow.totals, principal, principal.sign);
    }

    const netRow = ensureAggregator(netRowMap, principal.netRow, netOrden);
    if (netRow) {
      netRow.principals.push(principal.label);
      netRow.operaciones.push(describirPrincipalOperacion(principal));
      sumarTotales(netRow.totals, principal, principal.sign);
    }

    // Procesar net-row-adicional (para sucursales en el capítulo consolidado)
    const netRowAdicional = ensureAggregator(netRowMap, principal.netRowAdicional, netOrden);
    if (netRowAdicional) {
      netRowAdicional.principals.push(principal.label);
      netRowAdicional.operaciones.push(describirPrincipalOperacion(principal));
      sumarTotales(netRowAdicional.totals, principal, principal.sign);
    }

    const finalRow = ensureAggregator(finalRowMap, principal.resultNetRow, finalOrden);
    if (finalRow) {
      finalRow.principals.push(principal.label);
      finalRow.operaciones.push(describirPrincipalOperacion(principal));
      sumarTotales(finalRow.totals, principal, principal.sign);
    }
  });

  // Construir layout intercalando Principales, Secundarias y Sumas en orden jerárquico
  let ordenGeneral = 0;
  const siguienteOrden = () => {
    ordenGeneral += 1;
    return ordenGeneral;
  };

  const layout = [];
  
  // Para cada Principal (ya ordenadas), agregar sus Secundarias y luego las sumas correspondientes
  principalList.forEach((principal) => {
    // 1. Agregar la Principal como header
    layout.push({
      type: 'principal',
      label: principal.label,
      order: siguienteOrden(),
      totals: {
        actualMonth: principal.actualMonth,
        planMonth: principal.planMonth,
        prevMonth: principal.prevMonth,
        actualYTD: principal.actualYTD,
        planYTD: principal.planYTD,
        prevYTD: principal.prevYTD
      },
      children: principal.children,
      consolidadoLabel: principal.consolidadoLabel,
      operativoLabel: principal.operativoLabel,
      resultRow: principal.resultRow,
      netRow: principal.netRow,
      netRowAdicional: principal.netRowAdicional
    });
    
    // 2. Agregar cada Secundaria con sus cuentas
    (principal.children || []).forEach((secundaria) => {
      layout.push({
        type: 'secundaria',
        label: secundaria.label,
        order: siguienteOrden(),
        totals: {
          actualMonth: secundaria.totalActualMonth,
          planMonth: secundaria.totalPlanMonth,
          prevMonth: secundaria.totalPrevMonth,
          actualYTD: secundaria.totalActualYTD,
          planYTD: secundaria.totalPlanYTD,
          prevYTD: secundaria.totalPrevYTD
        },
        cuentas: secundaria.cuentas || []
      });
      
      // 3. Agregar cada cuenta de esta Secundaria
      (secundaria.cuentas || []).forEach((cuenta) => {
        layout.push({
          type: 'cuenta',
          label: cuenta.label,
          nombre: cuenta.descripcion || cuenta.label,
          cuenta: cuenta.cuenta,
          order: siguienteOrden(),
          totals: {
            actualMonth: cuenta.actualMonth,
            planMonth: cuenta.planMonth,
            prevMonth: cuenta.prevMonth,
            actualYTD: cuenta.actualYTD,
            planYTD: cuenta.planYTD,
            prevYTD: cuenta.prevYTD
          }
        });
      });
    });
  });
  
  // Ahora agregar las filas de consolidación al final
  const agregarBloques = (mapa, tipo) => {
    Array.from(mapa.values())
      .sort((a, b) => a.orden - b.orden)
      .forEach((row) => {
        layout.push({
          type: tipo,
          label: row.label,
          order: siguienteOrden(),
          totals: row.totals,
          principals: row.principals || [],
          operaciones: row.operaciones || []
        });
      });
  };

  agregarBloques(consolidatedMap, 'group');
  agregarBloques(resultRowMap, 'result');
  agregarBloques(netRowMap, 'net');
  agregarBloques(finalRowMap, 'final');

  return {
    principals: principalList,
    layout
  };
};


async function generarReporte(tipoReporte, empresaId, anio, mesSeleccionado, capituloSeleccionado) {
  // Cargar definiciones desde SQLite (con fallback a JSON)
  const modulo = (tipoReporte === 'RESUMEN' || tipoReporte === 'SUMMARY') ? tipoReporte : 'MODULOS';
  const definiciones = cargarDefiniciones(modulo, empresaId, anio);
  
  // Determinar el tipo real: RESUMEN usa las mismas cuentas que SUMMARY pero con diferente agrupación
  const tipoReal = (tipoReporte === 'RESUMEN') ? 'SUMMARY' : tipoReporte;
  const hojaConfig = tipoReporte; // Mantener el tipo original para filtrar configuración
  
  // Para módulos con SQLite, las cuentas están agrupadas por capítulo
  let lista = [];
  if (definiciones && typeof definiciones === 'object' && !Array.isArray(definiciones)) {
    // Es un objeto con capítulos, aplanar todas las cuentas
    Object.keys(definiciones).forEach(capitulo => {
      if (capitulo !== 'SUMA DE VARIAS SECCIONES' && Array.isArray(definiciones[capitulo])) {
        lista = lista.concat(definiciones[capitulo]);
      }
    });
  } else {
    // Es un array directo (formato legacy)
    lista = definiciones[tipoReal] || [];
  }
  
  if (!Array.isArray(lista) || !lista.length) {
    throw new Error(`No hay definiciones para ${tipoReal}`);
  }

  // Filtrar configuración de agrupación por HOJA (SUMMARY o RESUMEN)
  const configCompleta = definiciones['SUMA DE VARIAS SECCIONES'] || [];
  const configAgrupacion = configCompleta.filter(cfg => cfg.HOJA === hojaConfig);

  const capitulosDisponibles = extraerCapitulos(lista);
  const capituloClave = NORMALIZAR_CAPITULO(capituloSeleccionado || capitulosDisponibles[0]?.etiqueta || '');
  const capituloEncontrado = capitulosDisponibles.find(({ clave }) => clave === capituloClave);
  
  // Filtrar definiciones por capítulo
  const listaFiltrada = capituloEncontrado
    ? lista.filter((item) => NORMALIZAR_CAPITULO(item.CAPITULO) === capituloClave)
    : lista;

  const cuentas = listaFiltrada.map((item) => NORMALIZAR_CLAVE(item.CUENTA)).filter(Boolean);
  const claveMes = normalizarClaveMes(mesSeleccionado) || MESES[Math.min(Math.max(new Date().getMonth(), 0), 11)].clave;
  const anioPrevio = Number(anio) - 1;

  const [planeacionActual, planeacionPrev] = await Promise.all([
    obtenerDatosPlaneacion({ empresaId, anio, cuentas }),
    obtenerDatosPlaneacion({ empresaId, anio: anioPrevio, cuentas })
  ]);

  const { principals, layout } = construirReporteResumen(
    listaFiltrada, 
    configAgrupacion,
    capituloEncontrado?.etiqueta || capituloSeleccionado,
    claveMes,
    planeacionActual,
    planeacionPrev
  );

  const nodoResumen = {
    label: capituloEncontrado?.etiqueta || capituloSeleccionado,
    children: principals,
    layout
  };

  return {
    empresaId,
    reportKey: tipoReporte,
    anio,
    resumen: [nodoResumen],
    capituloSeleccionado: capituloEncontrado?.etiqueta || capitulosDisponibles[0]?.etiqueta || null,
    capitulosDisponibles
  };
}

module.exports = {
  generarReporte
};
