const { obtenerDatosPlaneacion } = require('../planeacionCuentasService');
const { MESES } = require('../saldosService');
const layoutService = require('../layoutService');

const NORMALIZAR_CLAVE = (valor = '') => valor.toString().trim().toUpperCase();
const NORMALIZAR_CAPITULO = (valor = '') => valor.toString().trim().toUpperCase();

/**
 * Cargar definiciones desde SQLite
 */
function cargarDefinicionesModulo(modulo, empresaId = 'EMPRESA01', anio = new Date().getFullYear()) {
  try {
    const capitulos = layoutService.obtenerCapitulos({ empresaId, modulo, anio });

    if (capitulos && capitulos.length > 0) {
      const definiciones = {};
      const operacionesGlobales = [];

      for (const cap of capitulos) {
        const capituloEtiqueta = (cap && typeof cap === 'object') ? cap.capitulo : cap;
        if (!capituloEtiqueta) continue;

        const layout = layoutService.obtenerLayout({ 
          empresaId, 
          modulo, 
          anio, 
          capitulo: capituloEtiqueta 
        });

        const cuentasLayout = (layout && Array.isArray(layout.cuentas))
          ? layout.cuentas
          : (layout && Array.isArray(layout[modulo])) ? layout[modulo] : [];

        definiciones[capituloEtiqueta] = cuentasLayout.map((cuenta) => ({
          CAPITULO: capituloEtiqueta,
          CUENTA: cuenta.CUENTA,
          NOMBRE: cuenta.NOMBRE,
          'SECCIÓN Principal':
            cuenta['SECCIÓN Principal'] ||
            cuenta['SECCION Principal'] ||
            cuenta['SECCIàN Principal'] ||
            '',
          'SECCION Secundaria':
            cuenta['SECCION Secundaria'] ||
            cuenta['SECCIÓN Secundaria'] ||
            ''
        }));

        const operacionesLayout = Array.isArray(layout && layout.operaciones)
          ? layout.operaciones
          : Array.isArray(layout && layout['SUMA DE VARIAS SECCIONES'])
            ? layout['SUMA DE VARIAS SECCIONES']
            : [];

        if (operacionesLayout.length) {
          operacionesLayout.forEach((operacion) => operacionesGlobales.push(operacion));
        }
      }

      if (operacionesGlobales.length) {
        definiciones['SUMA DE VARIAS SECCIONES'] = operacionesGlobales;
      }

      return definiciones;
    }
  } catch (error) {
    console.error(
      `[planeacionReportesEngine] No se pudo cargar layout ${modulo} / ${empresaId} / ${anio} desde SQLite:`,
      error && error.message ? error.message : error
    );
  }

  throw new Error(
    `No existen capitulos definidos en SQLite para ${modulo} / ${empresaId} / ${anio}`
  );
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

const construirNodoSeccion = ({ seccion, cuentas, definicion, claveMes, planeacionActual, planeacionPrev, orden = 0, capituloClave = '' }) => {
  let totales = calcularTotales(cuentas, claveMes, planeacionActual, planeacionPrev);

  // Excluir Cargos Administrativos de SUMAS de EXPENSE para capítulo Guadalajara
  const seccionNorm = (seccion || '').toString().trim().toUpperCase();
  const capNorm = (capituloClave || '').toString().trim().toUpperCase();
  const CAPITULOS_EXCLUSION_CARGOS = [
    'GUADALAJARA',
    'GDL',
    'NORESTE',
    'MONTERREY',
    'NOROESTE',
    'NORTHWEST',
    'NO'
  ];
  const debeExcluirCapitulo = CAPITULOS_EXCLUSION_CARGOS.some((token) => capNorm.includes(token));
  const esCargosAdminExcluido = debeExcluirCapitulo && seccionNorm.includes('CARGOS ADMINISTRATIVOS');
  if (esCargosAdminExcluido) {
    // No sumar estos totales en los niveles superiores
    totales = { actualMonth: 0, planMonth: 0, prevMonth: 0, actualYTD: 0, planYTD: 0, prevYTD: 0 };
  }

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
      // Flag to indicate excluded-from-expense sections (useful for UI)
      excludeFromExpense: esCargosAdminExcluido || false,
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
  const operativoOrden = new Map();
  const resultOrden = new Map();
  const netOrden = new Map();
  const finalOrden = new Map();

  const normalizarConfigValor = (valor) => {
    if (valor == null) return '';
    return valor.toString().trim();
  };

  const configPorSeccion = new Map();
  const configPorPrincipal = new Map();
  if (Array.isArray(configAgrupacion)) {
    configAgrupacion.forEach((cfg, idx) => {
      const cap = NORMALIZAR_CAPITULO(cfg.CAPITULO);
      const seccion = (cfg.SECCION || '').toString().trim();
      if (!seccion || cap !== capituloClave) return;
      const key = `${cap}|${seccion.toUpperCase()}`;
      const configEntry = {
        sumRow: normalizarConfigValor(cfg['sum-row']),
        principal: normalizarConfigValor(cfg['sum-row-sumavarios']),
        consolidado: normalizarConfigValor(cfg['sum-row-sumavarios-consolidado']),
        operativo: normalizarConfigValor(cfg['sum-row-operativo']),
        operativoConsolidado: normalizarConfigValor(cfg['sum-row-operativo-consolidado']),
        resultRow: normalizarConfigValor(cfg['result-row']),
        netRow: normalizarConfigValor(cfg['net-row']),
        netRowAdicional: normalizarConfigValor(cfg['net-row-adicional']),
        resultNetRow: normalizarConfigValor(cfg['result-net-row']),
        clase: normalizarConfigValor(cfg.Clase)
      };
      const principalBase = configEntry.principal;
      configEntry.principalLabel = principalBase;
      configPorSeccion.set(key, configEntry);
      if (principalBase) {
        const principalKey = `${cap}|PRINCIPAL|${principalBase.toUpperCase()}`;
        if (!configPorPrincipal.has(principalKey)) {
          configPorPrincipal.set(principalKey, configEntry);
        }
      }

      const seccionLimpia = normalizarConfigValor(seccion);
      if (seccionLimpia && !seccionOrden.has(seccionLimpia)) {
        seccionOrden.set(seccionLimpia, idx);
      }
      const principal = configEntry.principal;
      if (principal && !principalOrden.has(principal)) {
        principalOrden.set(principal, idx);
      }
      const consolidado = configEntry.consolidado;
      if (consolidado && !consolidadoOrden.has(consolidado)) {
        consolidadoOrden.set(consolidado, idx);
      }
      const operativo = configEntry.operativo;
      if (operativo && !operativoOrden.has(operativo)) {
        operativoOrden.set(operativo, idx);
      }
      const operativoConsolidado = configEntry.operativoConsolidado;
      if (operativoConsolidado && !operativoOrden.has(operativoConsolidado)) {
        operativoOrden.set(operativoConsolidado, idx);
      }
      const resultRow = configEntry.resultRow;
      if (resultRow && !resultOrden.has(resultRow)) {
        resultOrden.set(resultRow, idx);
      }
      const netRow = configEntry.netRow;
      if (netRow && !netOrden.has(netRow)) {
        netOrden.set(netRow, idx);
      }
      const netRowAdicional = configEntry.netRowAdicional;
      if (netRowAdicional && !netOrden.has(netRowAdicional)) {
        netOrden.set(netRowAdicional, idx);
      }
      const finalRow = configEntry.resultNetRow;
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

    const seccion = (
      item['SECCION Secundaria'] ||
      item['SECCIÓN Secundaria'] ||
      item['Sección'] ||
      item['SECCION'] ||
      ''
    ).toString().trim();
    let cuentaCanonica = normalizarCuentaCanonica(item.CUENTA);
    const cuentaOriginal = (item.CUENTA || '').toString().trim();
    const esCuentaVirtual = !cuentaCanonica && (!cuentaOriginal || cuentaOriginal === '-' || cuentaOriginal === '0');
    if (esCuentaVirtual) {
      cuentaCanonica = `VIRTUAL|${capituloClave}|${principalLabel}|${seccion}|${idx}`;
      item.__esVirtual = true;
    }

    if (!seccion || !cuentaCanonica) return;

    definicionCuentas.set(cuentaCanonica, {
      descripcion: item.NOMBRE || '',
      visible: esCuentaVirtual ? (item.NOMBRE || seccion || principalLabel) : (item.CUENTA || cuentaVisibleDesdeCanonica(cuentaCanonica)),
      esVirtual: esCuentaVirtual
    });

    const keyConfig = `${capituloClave}|${seccion.toUpperCase()}`;
    let config = configPorSeccion.get(keyConfig) || {};

    let principalLabel =
      item['SECCIÓN Principal'] ||
      item['SECCION Principal'] ||
      item['SECCIàN Principal'] ||
      config.principal ||
      'GENERAL';
    if (!config || !Object.keys(config).length) {
      const principalKeyFallback = `${capituloClave}|PRINCIPAL|${principalLabel.toUpperCase()}`;
      config = configPorPrincipal.get(principalKeyFallback) || {};
      const itemPrincipalValor =
        item['SECCIÓN Principal'] ||
        item['SECCION Principal'] ||
        item['SECCIàN Principal'] ||
        '';
      if ((!itemPrincipalValor || !itemPrincipalValor.toString().trim()) && config.principal) {
        principalLabel = config.principal;
      }
    }
    
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
        operativoConsolidado: config.operativoConsolidado || '',
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
    
    if (config.consolidado && !principalNode.consolidadoLabel) {
      principalNode.consolidadoLabel = config.consolidado;
    }
    if (config.operativo && !principalNode.operativoLabel) {
      principalNode.operativoLabel = config.operativo;
    }
    if (config.operativoConsolidado && !principalNode.operativoConsolidado) {
      principalNode.operativoConsolidado = config.operativoConsolidado;
    }
    if (config.resultRow && !principalNode.resultRow) {
      principalNode.resultRow = config.resultRow;
    }
    if (config.netRow && !principalNode.netRow) {
      principalNode.netRow = config.netRow;
    }
    if (config.netRowAdicional && !principalNode.netRowAdicional) {
      principalNode.netRowAdicional = config.netRowAdicional;
    }
    if (config.resultNetRow && !principalNode.resultNetRow) {
      principalNode.resultNetRow = config.resultNetRow;
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


  // Asegurar que Principales definidos en configuración existan aunque no haya cuentas
  configPorPrincipal.forEach((cfg) => {
    if (!cfg || !cfg.principalLabel) return;
    const principalKey = NORMALIZAR_CLAVE(cfg.principalLabel);
    if (!principalMap.has(principalKey)) {
      principalMap.set(principalKey, {
        key: principalKey,
        label: cfg.principalLabel,
        clase: (cfg.clase || '').toString(),
        consolidadoLabel: cfg.consolidado || '',
        operativoLabel: cfg.operativo || '',
        operativoConsolidado: cfg.operativoConsolidado || '',
        resultRow: cfg.resultRow || '',
        netRow: cfg.netRow || '',
        netRowAdicional: cfg.netRowAdicional || '',
        resultNetRow: cfg.resultNetRow || '',
        orden: principalOrden.has(cfg.principalLabel) ? principalOrden.get(cfg.principalLabel) : principalMap.size + principalOrden.size,
        secciones: new Map(),
        esVirtual: true
      });
    }
  });

  let principalList = Array.from(principalMap.values()).map((principal) => {
    const seccionesOrdenadas = Array.from(principal.secciones.values()).sort((a, b) => a.orden - b.orden);
    const children = seccionesOrdenadas.map((sec) => construirNodoSeccion({
      seccion: sec.label,
      cuentas: sec.cuentas,
      definicion: definicionCuentas,
      claveMes,
      planeacionActual,
      planeacionPrev,
      orden: sec.orden,
      capituloClave: capituloSeleccionado
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
      label: principal.label ? principal.label.trim() : '',
      children,
      ...totalesPrincipal,
      total: totalesPrincipal.actualYTD,
      orden: principal.orden,
      consolidadoLabel: normalizarConfigValor(principal.consolidadoLabel),
      operativoLabel: normalizarConfigValor(principal.operativoLabel),
      operativoConsolidado: normalizarConfigValor(principal.operativoConsolidado),
      resultRow: normalizarConfigValor(principal.resultRow),
      netRow: normalizarConfigValor(principal.netRow),
      netRowAdicional: normalizarConfigValor(principal.netRowAdicional),
      resultNetRow: normalizarConfigValor(principal.resultNetRow),
      sign,
      esVirtual: Boolean(principal.esVirtual)
    };
  }).sort((a, b) => a.orden - b.orden);

  const esCapituloConsolidado =
    capituloClave.includes('CIUDAD') ||
    capituloClave.includes('MEXICO') ||
    capituloClave.includes('MÉXICO');

  if (esCapituloConsolidado) {
    const normalizarEtiqueta = (valor = '') => valor.toString().trim().toUpperCase();
    const otherPrincipal = principalList.find((principal) => normalizarEtiqueta(principal.label) === 'OTHER');
    if (otherPrincipal) {
      otherPrincipal.label = 'Other (Mexico)';
    }
    principalList = principalList.filter(
      (principal) => !(principal.esVirtual && normalizarEtiqueta(principal.label) === 'OTHER (MEXICO)')
    );
  }

  const normalizarEtiqueta = (valor = '') => valor.toString().trim().toUpperCase();

  const principalPorEtiqueta = new Map();
  principalList.forEach((principal) => {
    principalPorEtiqueta.set(normalizarEtiqueta(principal.label), principal);
  });

  const seccionPorEtiqueta = new Map();
  principalList.forEach((principal) => {
    (principal.children || []).forEach((sec) => {
      const key = normalizarEtiqueta(sec.label);
      if (key && !seccionPorEtiqueta.has(key)) {
        seccionPorEtiqueta.set(key, sec);
      }
    });
  });

  const obtenerPrincipalPorEtiqueta = (etiqueta = '') => {
    const key = normalizarEtiqueta(etiqueta);
    return principalPorEtiqueta.get(key) || null;
  };

  const obtenerSeccionPorEtiqueta = (etiqueta = '') => {
    const key = normalizarEtiqueta(etiqueta);
    return seccionPorEtiqueta.get(key) || null;
  };

  const convertirSeccionATotales = (sec) => {
    if (!sec) return null;
    return {
      actualMonth: Number(sec.totalActualMonth ?? 0),
      planMonth: Number(sec.totalPlanMonth ?? 0),
      prevMonth: Number(sec.totalPrevMonth ?? 0),
      actualYTD: Number(sec.totalActualYTD ?? 0),
      planYTD: Number(sec.totalPlanYTD ?? 0),
      prevYTD: Number(sec.totalPrevYTD ?? 0)
    };
  };

  const limpiarEtiqueta = (valor = '') => {
    if (valor == null) return '';
    return valor.toString().replace(/\s+/g, ' ').trim();
  };
  const claveEtiqueta = (valor = '') => limpiarEtiqueta(valor).toUpperCase();

  const consolidatedMap = new Map();
  const operativoRowMap = new Map();
  const resultRowMap = new Map();
  const netRowMap = new Map();
  const finalRowMap = new Map();

  const describirPrincipalOperacion = (principal, factor = null) => ({
    principal: principal.label,
    factor: factor != null ? factor : principal.sign,
    sections: (principal.children || []).map((sec) => sec.label || '')
  });

  const ensureAggregator = (mapa, etiqueta, ordenMapa) => {
    const etiquetaLimpia = limpiarEtiqueta(etiqueta);
    const clave = claveEtiqueta(etiquetaLimpia);
    if (!clave) return null;
    if (!mapa.has(clave)) {
      mapa.set(clave, {
        label: etiquetaLimpia,
        orden: ordenMapa.has(etiquetaLimpia) ? ordenMapa.get(etiquetaLimpia) : mapa.size + ordenMapa.size,
        totals: crearAcumulador(),
        principals: [],
        operaciones: []
      });
    }
    const agregador = mapa.get(clave);
    if (etiquetaLimpia && (!agregador.label || agregador.label !== etiquetaLimpia)) {
      agregador.label = etiquetaLimpia;
    }
    return agregador;
  };

  const participaEnOperativo = (principal) => {
    if (!principal || !principal.operativoLabel) return false;
    const etiqueta = (principal.label || '').toUpperCase();
    return !etiqueta.includes('MEMBER') && !etiqueta.includes('CENTRICITY') && !etiqueta.includes('OTHER');
  };

  principalList.forEach((principal) => {
    const consolidated = ensureAggregator(consolidatedMap, principal.consolidadoLabel || principal.label, consolidadoOrden);
    if (consolidated) {
      consolidated.principals.push(principal.label);
      consolidated.operaciones.push(describirPrincipalOperacion(principal, 1));
      sumarTotales(consolidated.totals, principal);
    }

    const operativo = participaEnOperativo(principal)
      ? ensureAggregator(operativoRowMap, principal.operativoLabel || '', operativoOrden)
      : null;
    if (operativo) {
      operativo.principals.push(principal.label);
      operativo.operaciones.push(describirPrincipalOperacion(principal));
      sumarTotales(operativo.totals, principal, principal.sign);
    }

    const operativoConsolidado = participaEnOperativo(principal)
      ? ensureAggregator(operativoRowMap, principal.operativoConsolidado || '', operativoOrden)
      : null;
    if (operativoConsolidado) {
      operativoConsolidado.principals.push(principal.label);
      operativoConsolidado.operaciones.push(describirPrincipalOperacion(principal));
      sumarTotales(operativoConsolidado.totals, principal, principal.sign);
    }

    const resultRow = ensureAggregator(resultRowMap, principal.resultRow, resultOrden);
    if (resultRow) {
      resultRow.principals.push(principal.label);
      resultRow.operaciones.push(describirPrincipalOperacion(principal));
      sumarTotales(resultRow.totals, principal, principal.sign);
    }

    ensureAggregator(netRowMap, principal.netRow, netOrden);
    ensureAggregator(netRowMap, principal.netRowAdicional, netOrden);
    ensureAggregator(finalRowMap, principal.resultNetRow, finalOrden);
  });

  // Construir layout intercalando Principales, Secundarias y Sumas en orden jerárquico
  // ORDEN PARA RESUMEN:
  // Para CIUDAD DE MÉXICO (capítulo consolidado):
  //   1. Secciones INCOME (CDMX Income, Guadalajara Income, etc.)
  //   2. CONSOLIDATED INCOME
  //   3. Secciones EXPENSE
  //   4. CONSOLIDATED EXPENSES
  //   5. OPERATING RESULTS por capítulo
  //   6. CONSOLIDATED OPERATING RESULTS
  //   7. Member Centricity, Other (por región)
  //   8. NET RESULTS por capítulo
  //   9. CONSOLIDATED NET RESULTS
  //
  // Para otros capítulos (GUADALAJARA, NORESTE, NOROESTE):
  //   1. Secciones INCOME → Total INCOME
  //   2. Secciones EXPENSE → Total EXPENSE
  //   3. OPERATING RESULTS (= INCOME - EXPENSE)
  //   4. Member Centricity
  //   5. Other
  //   6. NET RESULTS (= OPERATING RESULTS - Member Centricity + Other)
  
  let ordenGeneral = 0;
  const siguienteOrden = () => {
    ordenGeneral += 1;
    return ordenGeneral;
  };

  const layout = [];
  
  const establecerNetRowSegunFormula = ({ netLabel, operLabel, ajustes = [] }) => {
    if (!netLabel || !operLabel) return;
    const netRow = ensureAggregator(netRowMap, netLabel, netOrden);
    if (!netRow) return;
    netRow.totals = crearAcumulador();
    netRow.principals = [];
    netRow.operaciones = [];

    const operRow = operativoRowMap.get(operLabel);
    if (operRow) {
      sumarTotales(netRow.totals, operRow.totals, 1);
      netRow.principals.push(operRow.label);
      netRow.operaciones.push({ principal: operRow.label, factor: 1, sections: operRow.principals || [] });
    }

    ajustes.forEach(({ label, factor = 1 }) => {
      const objetivoLabel = label || '';
      const principalAjuste = obtenerPrincipalPorEtiqueta(objetivoLabel);
      if (principalAjuste) {
        sumarTotales(netRow.totals, principalAjuste, factor);
        netRow.principals.push(principalAjuste.label);
        netRow.operaciones.push(describirPrincipalOperacion(principalAjuste, factor));
        return;
      }
      const seccionAjuste = obtenerSeccionPorEtiqueta(objetivoLabel);
      if (seccionAjuste) {
        const totalesSeccion = convertirSeccionATotales(seccionAjuste);
        if (process.env.DEBUG_NET_FORMULAS === '1') {
          console.log('[debug-net] Ajuste sección', {
            netLabel,
            seccion: seccionAjuste.label,
            factor,
            totales: totalesSeccion
          });
        }
        sumarTotales(netRow.totals, totalesSeccion, factor);
        netRow.principals.push(seccionAjuste.label);
        netRow.operaciones.push({
          principal: seccionAjuste.label,
          factor,
          sections: [seccionAjuste.label]
        });
      }
    });
  };

  if (esCapituloConsolidado) {
    const netConfig = [
      {
        netLabel: 'NET RESULTS MEXICO',
        operLabel: 'OPERATING RESULTS MEXICO',
        ajustes: [
          { label: 'Member Centricity', factor: -1 },
          { label: 'Other (Mexico)', factor: 1 }
        ]
      },
      {
        netLabel: 'NET RESULTS GUADALAJARA',
        operLabel: 'OPERATING RESULTS GUADALAJARA',
        ajustes: [
          { label: 'Guadalajara Other Income', factor: 1 }
        ]
      },
      {
        netLabel: 'NET RESULTS MONTERREY',
        operLabel: 'OPERATING RESULTS MONTERREY',
        ajustes: [
          { label: 'Monterrey Other Income', factor: 1 }
        ]
      },
      {
        netLabel: 'NET RESULTS NORTHWEST',
        operLabel: 'OPERATING RESULTS NORTHWEST',
        ajustes: [
          { label: 'Northwest Other Income', factor: 1 }
        ]
      }
    ];

    netConfig.forEach(establecerNetRowSegunFormula);

    const finalRow = ensureAggregator(finalRowMap, 'CONSOLIDATED NET RESULTS', finalOrden);
    if (finalRow) {
      finalRow.totals = crearAcumulador();
      finalRow.principals = [];
      finalRow.operaciones = [];
      netConfig.forEach(({ netLabel }) => {
        const netRow = netRowMap.get(netLabel);
        if (netRow) {
          sumarTotales(finalRow.totals, netRow.totals, 1);
          finalRow.principals.push(netRow.label);
        }
      });
    }
  } else {
    establecerNetRowSegunFormula({
      netLabel: 'NET RESULTS',
      operLabel: 'OPERATING RESULTS',
      ajustes: [
        { label: 'Member Centricity', factor: -1 },
        { label: 'Other', factor: 1 }
      ]
    });
  }
  // Clasificar principales por tipo (INCOME, EXPENSE, OTHER, MEMBER CENTRICITY)
  const esIncome = (label) => {
    const upper = (label || '').toUpperCase();
    return upper.includes('INCOME') && !upper.includes('OTHER') && !upper.includes('CONSOLIDATED');
  };
  const esExpense = (label) => {
    const upper = (label || '').toUpperCase();
    return upper.includes('EXPENSE') && !upper.includes('CONSOLIDATED');
  };
  const esMemberCentricity = (label) => {
    const upper = (label || '').toUpperCase();
    return upper.includes('MEMBER') || upper.includes('CENTRICITY');
  };
  const esOther = (label) => {
    const upper = (label || '').toUpperCase();
    return upper.includes('OTHER');
  };
  
  const principalesVisibles = principalList.filter(p => !p.esVirtual);
  const principalesIncome = principalesVisibles.filter(p => esIncome(p.label));
  const principalesExpense = principalesVisibles.filter(p => esExpense(p.label));
  const principalesMember = principalesVisibles.filter(p => esMemberCentricity(p.label));
  const principalesOther = principalesVisibles.filter(p => esOther(p.label));
  const principalesRestantes = principalesVisibles.filter(p => 
    !esIncome(p.label) && !esExpense(p.label) && !esMemberCentricity(p.label) && !esOther(p.label)
  );
  const principalLabels = new Set(principalesVisibles.map((p) => (p.label || '').toUpperCase().trim()));

  // Función para agregar un principal con sus secundarias y cuentas
  const agregarPrincipalConHijos = (principal) => {
    if (principal.esVirtual || !principal.children || !principal.children.length) {
      return;
    }
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
  };

  // Función para agregar una fila de consolidación
  const agregarFilaConsolidacion = (row, tipo) => {
    if (!row) return;
    layout.push({
      type: tipo,
      label: row.label,
      order: siguienteOrden(),
      totals: row.totals,
      principals: row.principals || [],
      operaciones: row.operaciones || []
    });
  };

  // Buscar fila consolidada por etiqueta (parcial)
  const buscarConsolidado = (mapa, busqueda) => {
    const upper = (busqueda || '').toUpperCase();
    return Array.from(mapa.values()).find(row => 
      (row.label || '').toUpperCase().includes(upper)
    );
  };

  // Buscar fila exacta o genérica
  const buscarFilaExacta = (mapa, busqueda) => {
    const upper = (busqueda || '').toUpperCase().trim();
    // Primero buscar coincidencia exacta
    let found = Array.from(mapa.values()).find(row => 
      (row.label || '').toUpperCase().trim() === upper
    );
    // Si no hay exacta, buscar parcial
    if (!found) {
      found = Array.from(mapa.values()).find(row => 
        (row.label || '').toUpperCase().includes(upper)
      );
    }
    return found;
  };

  if (esCapituloConsolidado) {
    // ===== LÓGICA PARA CIUDAD DE MÉXICO (CAPÍTULO CONSOLIDADO) =====
    
    // 1. Agregar todas las secciones INCOME
    principalesIncome.forEach(agregarPrincipalConHijos);
    
    // 2. CONSOLIDATED INCOME (después de todos los incomes)
    agregarFilaConsolidacion(buscarConsolidado(consolidatedMap, 'CONSOLIDATED INCOME'), 'group');
    
    // 3. Agregar todas las secciones EXPENSE
    principalesExpense.forEach(agregarPrincipalConHijos);
    
    // 4. CONSOLIDATED EXPENSES (después de todos los expenses)
    agregarFilaConsolidacion(buscarConsolidado(consolidatedMap, 'CONSOLIDATED EXPENSE'), 'group');
    
    // 5. OPERATING RESULTS por capítulo (en orden: Mexico, Guadalajara, Monterrey/NE, Northwest/NO)
    const operatingResultsOrden = ['MEXICO', 'GUADALAJARA', 'MONTERREY', 'NORESTE', 'NE', 'NORTHWEST', 'NOROESTE', 'NO'];
    const operatingResultsAgregados = new Set();
    
    operatingResultsOrden.forEach(region => {
      const opResult = Array.from(operativoRowMap.values()).find(row => {
        const label = (row.label || '').toUpperCase();
        return label.includes('OPERATING') && label.includes('RESULT') && 
               label.includes(region) && !label.includes('CONSOLIDATED');
      });
      if (opResult && !operatingResultsAgregados.has(opResult.label)) {
        agregarFilaConsolidacion(opResult, 'result');
        operatingResultsAgregados.add(opResult.label);
      }
    });
    
    // 6. CONSOLIDATED OPERATING RESULTS
    agregarFilaConsolidacion(buscarConsolidado(resultRowMap, 'CONSOLIDATED OPERATING'), 'result');
    
    // 7. Member Centricity y Other (en orden)
    principalesMember.forEach(agregarPrincipalConHijos);
    principalesOther.forEach(agregarPrincipalConHijos);

    const otrosIngresosEtiquetas = [
      'Guadalajara Other Income',
      'Monterrey Other Income',
      'Northwest Other Income'
    ];
    otrosIngresosEtiquetas.forEach((etiqueta) => {
      agregarFilaConsolidacion(buscarConsolidado(consolidatedMap, etiqueta), 'group');
    });
    
    // 8. Principales restantes
    principalesRestantes.forEach(agregarPrincipalConHijos);
    
    // 9. NET RESULTS por capítulo (en orden: Mexico, Guadalajara, Monterrey/NE, Northwest/NO)
    const netResultsOrden = ['MEXICO', 'GUADALAJARA', 'MONTERREY', 'NORESTE', 'NE', 'NORTHWEST', 'NOROESTE', 'NO'];
    const netResultsAgregados = new Set();
    
    netResultsOrden.forEach(region => {
      const netResult = Array.from(netRowMap.values()).find(row => {
        const label = (row.label || '').toUpperCase();
        return label.includes('NET') && label.includes('RESULT') && label.includes(region);
      });
      if (netResult && !netResultsAgregados.has(netResult.label)) {
        agregarFilaConsolidacion(netResult, 'net');
        netResultsAgregados.add(netResult.label);
      }
    });
    
    // 10. CONSOLIDATED NET RESULTS
    agregarFilaConsolidacion(buscarConsolidado(finalRowMap, 'CONSOLIDATED NET'), 'final');
    
  } else {
    // ===== LÓGICA PARA CAPÍTULOS SIMPLES (GUADALAJARA, NORESTE, NOROESTE) =====
    // Orden: INCOME → EXPENSE → OPERATING RESULTS → Member Centricity → Other → NET RESULTS
    
    // 1. Agregar secciones INCOME
    principalesIncome.forEach(agregarPrincipalConHijos);
    
    // 2. Agregar secciones EXPENSE
    principalesExpense.forEach(agregarPrincipalConHijos);
    
    // 3. OPERATING RESULTS (= INCOME - EXPENSE)
    agregarFilaConsolidacion(buscarFilaExacta(operativoRowMap, 'OPERATING RESULTS'), 'result');
    
    // 4. Member Centricity
    principalesMember.forEach(agregarPrincipalConHijos);
    
    // 5. Other
    principalesOther.forEach(agregarPrincipalConHijos);
    
    // 6. Principales restantes
    principalesRestantes.forEach(agregarPrincipalConHijos);
    
    // 7. NET RESULTS (= OPERATING RESULTS - Member Centricity + Other)
    agregarFilaConsolidacion(buscarFilaExacta(netRowMap, 'NET RESULTS'), 'net');
  }
  
  // Agregar cualquier fila de consolidación que no se haya agregado todavía
  const filasAgregadas = new Set(layout.filter(l => ['group', 'result', 'net', 'final'].includes(l.type)).map(l => l.label));
  const esEtiquetaPrincipal = (label = '') => principalLabels.has((label || '').toUpperCase().trim());
  const etiquetasSobrantesConsolidado = new Set([
    'OTHER (MEXICO)',
    'GUADALAJARA OTHER INCOME',
    'MONTERREY OTHER INCOME',
    'NORTHWEST OTHER INCOME',
    'MEMBER CENTRICITY',
    'OTHER'
  ]);
  const debeExcluirFilaExtra = (label = '') => etiquetasSobrantesConsolidado.has((label || '').toUpperCase().trim());

  Array.from(consolidatedMap.values())
    .filter(row => !filasAgregadas.has(row.label) && !esEtiquetaPrincipal(row.label) && !debeExcluirFilaExtra(row.label))
    .sort((a, b) => a.orden - b.orden)
    .forEach(row => agregarFilaConsolidacion(row, 'group'));
    
  Array.from(operativoRowMap.values())
    .filter(row => !filasAgregadas.has(row.label))
    .sort((a, b) => a.orden - b.orden)
    .forEach(row => agregarFilaConsolidacion(row, 'result'));
    
  Array.from(resultRowMap.values())
    .filter(row => !filasAgregadas.has(row.label))
    .sort((a, b) => a.orden - b.orden)
    .forEach(row => agregarFilaConsolidacion(row, 'result'));
    
  Array.from(netRowMap.values())
    .filter(row => !filasAgregadas.has(row.label))
    .sort((a, b) => a.orden - b.orden)
    .forEach(row => agregarFilaConsolidacion(row, 'net'));
    
  Array.from(finalRowMap.values())
    .filter(row => !filasAgregadas.has(row.label))
    .sort((a, b) => a.orden - b.orden)
    .forEach(row => agregarFilaConsolidacion(row, 'final'));

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

  const cuentas = listaFiltrada
    .filter((item) => !item.__esVirtual)
    .map((item) => NORMALIZAR_CLAVE(item.CUENTA))
    .filter(Boolean);
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
