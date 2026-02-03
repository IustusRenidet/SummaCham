const { obtenerDatosPlaneacionResumen } = require('../planeacionCuentasService');
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
          orden: cuenta.orden,
          orden_presentacion: cuenta.orden_presentacion,
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

  if (limpio.length >= 21) {
    const cuenta = limpio.slice(0, 21);
    const last = cuenta.slice(-1);
    if (['1', '2', '3', '4'].includes(last)) {
      return cuenta;
    }
    return visible.padEnd(20, '0') + nivel;
  }

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

const calcularTotales = (cuentas, planeacionData, definicion = new Map()) => {
  return cuentas.reduce(
    (acc, cuenta) => {
      const actual = planeacionData.find((p) => p.cuenta === cuenta);
      const meta = definicion.get(cuenta) || {};
      const factorRaw = meta.operacion_factor ?? meta.operacionFactor ?? meta.factor;
      const factor = Number.isFinite(Number(factorRaw)) ? Number(factorRaw) : 1;
      acc.actualMonth += factor * Number(actual?.actualMonth ?? 0);
      acc.planMonth += factor * Number(actual?.planMonth ?? 0);
      acc.prevMonth += factor * Number(actual?.prevMonth ?? 0);
      acc.actualYTD += factor * Number(actual?.actualYTD ?? 0);
      acc.planYTD += factor * Number(actual?.planYTD ?? 0);
      acc.prevYTD += factor * Number(actual?.prevYTD ?? 0);
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

const normalizarTexto = (valor = '') => valor
  .toString()
  .trim()
  .toUpperCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

const CAMPOS_FILA_OPERACION = [
  'sum-row',
  'sum-row-sumavarios',
  'sum-row-sumavarios2',
  'sum-row-sumavarios-consolidado',
  'sum-row-operativo',
  'sum-row-operativo-consolidado',
  'result-row',
  'net-row',
  'result-net-row'
];

const COLUMN_CONFIG_ID = 'COLUMN_CONFIG';
const esOperacionConfigColumnas = (op = {}) => {
  const rawId = op.OperacionId || op.operacion_id || op.id || op.Clase || op.clase || '';
  const id = rawId.toString().trim().toUpperCase();
  if (id === COLUMN_CONFIG_ID) return true;
  if (op['column-config'] || op['columnas-config'] || op.column_config) return true;
  return false;
};

const esOperacionLibre = (op = {}) =>
  !CAMPOS_FILA_OPERACION.some((campo) => Boolean(op?.[campo]));

const obtenerNombreOperacion = (op = {}) =>
  op.operacion_etiqueta || op.Clase || op.clase || op.OperacionId || op.id || 'Operacion';

const obtenerTerminosOperacion = (op = {}) => {
  if (Array.isArray(op.formula_terms) && op.formula_terms.length) {
    return op.formula_terms;
  }
  if (op.formula_json) {
    try {
      const parsed = JSON.parse(op.formula_json);
      if (Array.isArray(parsed)) return parsed;
    } catch (err) {
      /* ignore */
    }
  }
  const terms = [];
  if (op.signos && typeof op.signos === 'object') {
    Object.entries(op.signos).forEach(([clave, signo]) => {
      if (!clave || !clave.startsWith('seccion_')) return;
      const valor = op[clave];
      if (!valor) return;
      terms.push({
        operator: Number(signo) < 0 ? '-' : '+',
        type: 'section',
        value: valor
      });
    });
  }
  if (!terms.length && op.SECCION) {
    terms.push({
      operator: '+',
      type: 'section',
      value: op.SECCION
    });
  }
  return terms;
};

const normalizarTerminoTipo = (term) => {
  if (!term) return 'section';
  const tipo = (term.type || '').toString().toLowerCase();
  if (tipo) return tipo;
  const valor = term.value ?? term.cuenta ?? term.id ?? '';
  return normalizarCuentaCanonica(valor) ? 'account' : 'section';
};

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

const construirNodoSeccion = ({
  seccion,
  cuentas,
  definicion,
  planeacionData,
  orden = 0,
  ordenIndex = 0
}) => {
  const totales = calcularTotales(cuentas, planeacionData, definicion);

  const cuentasDetalle = cuentas.map((cuentaId) => {
    const actual = planeacionData.find((p) => p.cuenta === cuentaId) || {};

    const metadataCuenta = definicion.get(cuentaId) || {};
    const factorRaw =
      metadataCuenta.operacion_factor ??
      metadataCuenta.operacionFactor ??
      metadataCuenta.factor;
    const factor = Number.isFinite(Number(factorRaw)) ? Number(factorRaw) : 1;
    return {
      cuenta: metadataCuenta.visible || cuentaId,
      cuentaCanonica: cuentaId,
      orden: metadataCuenta.orden,
      ordenIndex: metadataCuenta.ordenIndex ?? 0,
      descripcion: metadataCuenta.descripcion || '',
      actualMonth: factor * Number(actual.actualMonth ?? 0),
      planMonth: factor * Number(actual.planMonth ?? 0),
      prevMonth: factor * Number(actual.prevMonth ?? 0),
      actualYTD: factor * Number(actual.actualYTD ?? 0),
      planYTD: factor * Number(actual.planYTD ?? 0),
      prevYTD: factor * Number(actual.prevYTD ?? 0),
      factor
    };
  });

  return {
    label: seccion,
    cuentas: cuentasDetalle,
    orden,
    ordenIndex,
    totalActualMonth: totales.actualMonth,
    totalPlanMonth: totales.planMonth,
    totalPrevMonth: totales.prevMonth,
    totalActualYTD: totales.actualYTD,
    totalPlanYTD: totales.planYTD,
    totalPrevYTD: totales.prevYTD,
    total: totales.actualYTD
  };
};

const construirReporteResumen = (definiciones, configAgrupacion, capituloSeleccionado, planeacionData) => {
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
  const freeOpsOrden = new Map();

  const obtenerOrden = (item, fallback = 0) => {
    const raw =
      item?.orden_presentacion ??
      item?.orden ??
      item?.Orden ??
      item?.order ??
      fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const normalizarConfigValor = (valor) => {
    if (valor == null) return '';
    return valor.toString().trim();
  };

  const configPorSeccion = new Map();
  const configPorPrincipal = new Map();
  if (Array.isArray(configAgrupacion)) {
    configAgrupacion.forEach((cfg, idx) => {
      const cap = NORMALIZAR_CAPITULO(cfg.CAPITULO);
      if (cap !== capituloClave) return;
      const seccion = (cfg.SECCION || '').toString().trim();
      const ordenConfig = obtenerOrden(cfg, idx);

      const sumRow = normalizarConfigValor(cfg['sum-row']);
      const principal = normalizarConfigValor(cfg['sum-row-sumavarios']);
      const consolidado = normalizarConfigValor(cfg['sum-row-sumavarios-consolidado']);
      const operativo = normalizarConfigValor(cfg['sum-row-operativo']);
      const operativoConsolidado = normalizarConfigValor(cfg['sum-row-operativo-consolidado']);
      const resultRow = normalizarConfigValor(cfg['result-row']);
      const netRow = normalizarConfigValor(cfg['net-row']);
      const netRowAdicional = normalizarConfigValor(cfg['net-row-adicional']);
      const resultNetRow = normalizarConfigValor(cfg['result-net-row']);
      const clase = normalizarConfigValor(cfg.Clase);

      const registrarOrden = (mapa, label) => {
        if (!label) return;
        const existente = mapa.get(label);
        if (existente == null || ordenConfig < existente) {
          mapa.set(label, ordenConfig);
        }
      };

      registrarOrden(consolidadoOrden, consolidado);
      registrarOrden(operativoOrden, operativo);
      registrarOrden(operativoOrden, operativoConsolidado);
      registrarOrden(resultOrden, resultRow);
      registrarOrden(netOrden, netRow);
      registrarOrden(netOrden, netRowAdicional);
      registrarOrden(finalOrden, resultNetRow);

      if (esOperacionLibre(cfg)) {
        const opKey = normalizarTexto(obtenerNombreOperacion(cfg));
        if (opKey) {
          const existente = freeOpsOrden.get(opKey);
          if (existente == null || ordenConfig < existente) {
            freeOpsOrden.set(opKey, ordenConfig);
          }
        }
      }

      if (!seccion) return;
      const key = `${cap}|${seccion.toUpperCase()}`;
      const configEntry = {
        sumRow,
        principal,
        consolidado,
        operativo,
        operativoConsolidado,
        resultRow,
        netRow,
        netRowAdicional,
        resultNetRow,
        clase,
        orden: ordenConfig
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
        seccionOrden.set(seccionLimpia, ordenConfig);
      }
      if (principal && !principalOrden.has(principal)) {
        principalOrden.set(principal, ordenConfig);
      }
    });
  }

  const definicionesOrdenadas = Array.isArray(definiciones)
    ? definiciones
        .map((item, idx) => ({ item, idx }))
        .sort((a, b) => {
          const ordenA = obtenerOrden(a.item, a.idx);
          const ordenB = obtenerOrden(b.item, b.idx);
          if (ordenA !== ordenB) return ordenA - ordenB;
          return a.idx - b.idx;
        })
        .map(({ item }) => item)
    : [];

  // Procesar definiciones RESPETANDO el orden de presentación
  // Necesitamos un orden jerárquico: Principal (orden global) → Secundaria (orden dentro de Principal)
  const principalFirstAppearance = new Map(); // Guardar orden mínimo + índice de cada Principal
  const seccionFirstAppearance = new Map(); // Guardar orden mínimo + índice de cada Secundaria

  const actualizarPrimeraAparicion = (mapa, key, orden, idx) => {
    if (!key) return;
    const ordenNum = Number.isFinite(Number(orden)) ? Number(orden) : 0;
    const idxNum = Number.isFinite(Number(idx)) ? Number(idx) : 0;
    const existente = mapa.get(key);
    if (
      !existente ||
      ordenNum < existente.orden ||
      (ordenNum === existente.orden && idxNum < existente.idx)
    ) {
      mapa.set(key, { orden: ordenNum, idx: idxNum });
    }
  };
  
  definicionesOrdenadas.forEach((item, idx) => {
    const capReal = NORMALIZAR_CAPITULO(item.CAPITULO || '');
    if (capReal !== capituloClave) return;
    const cuentaOrden = obtenerOrden(item, idx);

    const seccion = (
      item['SECCION Secundaria'] ||
      item['SECCIÓN Secundaria'] ||
      item['Sección'] ||
      item['SECCION'] ||
      ''
    ).toString().trim();
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

    let cuentaCanonica = normalizarCuentaCanonica(item.CUENTA);
    const cuentaOriginal = (item.CUENTA || '').toString().trim();
    const esCuentaVirtual =
      !cuentaCanonica && (!cuentaOriginal || cuentaOriginal === '-' || cuentaOriginal === '0');
    if (esCuentaVirtual) {
      cuentaCanonica = `VIRTUAL|${capituloClave}|${principalLabel}|${seccion}|${idx}`;
      item.__esVirtual = true;
    }

    if (!seccion || !cuentaCanonica) return;

    const cuentaVisible = esCuentaVirtual
      ? (item.NOMBRE || seccion || principalLabel)
      : cuentaVisibleDesdeCanonica(cuentaCanonica);
    const factorRaw = item.operacion_factor ?? item.operacionFactor ?? item.factor;
    const factor = Number.isFinite(Number(factorRaw)) ? Number(factorRaw) : 1;

    definicionCuentas.set(cuentaCanonica, {
      descripcion: item.NOMBRE || '',
      visible: cuentaVisible,
      orden: cuentaOrden,
      ordenIndex: idx,
      esVirtual: esCuentaVirtual,
      operacion_factor: factor
    });
    
    // Registrar la primera aparición de cada Principal (orden mínimo)
    actualizarPrimeraAparicion(
      principalFirstAppearance,
      principalLabel,
      cuentaOrden,
      idx
    );

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
        orden: principalFirstAppearance.get(principalLabel)?.orden ?? 0,
        ordenIndex: principalFirstAppearance.get(principalLabel)?.idx ?? 0,
        secciones: new Map()
      });
    }

    const principalNode = principalMap.get(principalKey);
    const seccionKey = seccion || 'SIN SECCIÓN';
    
    // Registrar la primera aparición de cada Secundaria (orden mínimo)
    actualizarPrimeraAparicion(
      seccionFirstAppearance,
      seccionKey,
      cuentaOrden,
      idx
    );
    
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
        orden: seccionFirstAppearance.get(seccionKey)?.orden ?? 0,
        ordenIndex: seccionFirstAppearance.get(seccionKey)?.idx ?? 0
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
        orden: principalOrden.has(cfg.principalLabel)
          ? principalOrden.get(cfg.principalLabel)
          : principalMap.size + principalOrden.size,
        ordenIndex: principalMap.size + principalOrden.size,
        secciones: new Map(),
        esVirtual: true
      });
    }
  });

  const sortByOrden = (a = {}, b = {}) => {
    const ordenA = Number.isFinite(Number(a.orden)) ? Number(a.orden) : 0;
    const ordenB = Number.isFinite(Number(b.orden)) ? Number(b.orden) : 0;
    if (ordenA !== ordenB) return ordenA - ordenB;
    const idxA = Number.isFinite(Number(a.ordenIndex)) ? Number(a.ordenIndex) : 0;
    const idxB = Number.isFinite(Number(b.ordenIndex)) ? Number(b.ordenIndex) : 0;
    return idxA - idxB;
  };

  let principalList = Array.from(principalMap.values()).map((principal) => {
    const seccionesOrdenadas = Array.from(principal.secciones.values()).sort(sortByOrden);
    const children = seccionesOrdenadas.map((sec) => {
      const cuentasOrdenadas = (sec.cuentas || [])
        .slice()
        .sort(
          (a, b) =>
            (definicionCuentas.get(a)?.orden ?? 0) -
              (definicionCuentas.get(b)?.orden ?? 0) ||
            (definicionCuentas.get(a)?.ordenIndex ?? 0) -
              (definicionCuentas.get(b)?.ordenIndex ?? 0)
        );
      return construirNodoSeccion({
        seccion: sec.label,
        cuentas: cuentasOrdenadas,
        definicion: definicionCuentas,
        planeacionData,
        orden: sec.orden,
        ordenIndex: sec.ordenIndex ?? 0
      });
    });

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
      ordenIndex: principal.ordenIndex ?? 0,
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
  }).sort(sortByOrden);

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
const etiquetaIncluye = (valor = '', texto = '') =>
  claveEtiqueta(valor).includes(claveEtiqueta(texto));

const combinarTotales = (a = {}, b = {}, factor = 1) => ({
  actualMonth: Number(a.actualMonth || 0) + factor * Number(b.actualMonth || 0),
  planMonth: Number(a.planMonth || 0) + factor * Number(b.planMonth || 0),
  prevMonth: Number(a.prevMonth || 0) + factor * Number(b.prevMonth || 0),
  actualYTD: Number(a.actualYTD || 0) + factor * Number(b.actualYTD || 0),
  planYTD: Number(a.planYTD || 0) + factor * Number(b.planYTD || 0),
  prevYTD: Number(a.prevYTD || 0) + factor * Number(b.prevYTD || 0)
});

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
        orden: ordenMapa.has(etiquetaLimpia)
          ? ordenMapa.get(etiquetaLimpia)
          : mapa.size + ordenMapa.size,
        ordenIndex: mapa.size,
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

  const participaEnOperativo = (principal) =>
    Boolean(principal && principal.operativoLabel);

  principalList.forEach((principal) => {
    const consolidated = ensureAggregator(
      consolidatedMap,
      principal.consolidadoLabel,
      consolidadoOrden
    );
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

    const netRow = ensureAggregator(netRowMap, principal.netRow, netOrden);
    if (netRow) {
      netRow.principals.push(principal.label);
      netRow.operaciones.push(describirPrincipalOperacion(principal));
      sumarTotales(netRow.totals, principal, principal.sign);
    }

    const netRowAdicional = ensureAggregator(
      netRowMap,
      principal.netRowAdicional,
      netOrden
    );
    if (netRowAdicional) {
      netRowAdicional.principals.push(principal.label);
      netRowAdicional.operaciones.push(describirPrincipalOperacion(principal));
      sumarTotales(netRowAdicional.totals, principal, principal.sign);
    }

    const finalRow = ensureAggregator(
      finalRowMap,
      principal.resultNetRow,
      finalOrden
    );
    if (finalRow) {
      finalRow.principals.push(principal.label);
      finalRow.operaciones.push(describirPrincipalOperacion(principal));
      sumarTotales(finalRow.totals, principal, principal.sign);
    }
  });

  const layout = [];
  const layoutOps = [];

  // Función para agregar un principal con sus secundarias y cuentas
  const agregarPrincipalConHijos = (principal) => {
    if (principal.esVirtual || !principal.children || !principal.children.length) {
      return;
    }
    layout.push({
      type: 'principal',
      label: principal.label,
      order: Number.isFinite(Number(principal.orden)) ? Number(principal.orden) : 0,
      orderIndex: principal.ordenIndex ?? 0,
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
        order: Number.isFinite(Number(secundaria.orden))
          ? Number(secundaria.orden)
          : Number.isFinite(Number(principal.orden)) ? Number(principal.orden) : 0,
        orderIndex: secundaria.ordenIndex ?? 0,
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
        const cuentaOrden = Number.isFinite(Number(cuenta.orden))
          ? Number(cuenta.orden)
          : Number.isFinite(Number(secundaria.orden))
          ? Number(secundaria.orden)
          : Number.isFinite(Number(principal.orden)) ? Number(principal.orden) : 0;
        layout.push({
          type: 'cuenta',
          label: cuenta.label,
          nombre: cuenta.descripcion || cuenta.label,
          cuenta: cuenta.cuenta,
          order: cuentaOrden,
          orderIndex: cuenta.ordenIndex ?? 0,
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
    if (!row || !row.label) return;
    layoutOps.push({
      type: tipo,
      label: row.label,
      order: Number.isFinite(Number(row.orden)) ? Number(row.orden) : 0,
      orderIndex: Number.isFinite(Number(row.ordenIndex)) ? Number(row.ordenIndex) : 0,
      totals: row.totals,
      principals: row.principals || [],
      operaciones: row.operaciones || []
    });
  };

  principalList.forEach(agregarPrincipalConHijos);

  Array.from(consolidatedMap.values()).forEach((row) =>
    agregarFilaConsolidacion(row, 'group')
  );
  Array.from(operativoRowMap.values()).forEach((row) =>
    agregarFilaConsolidacion(row, 'result')
  );
  Array.from(resultRowMap.values()).forEach((row) =>
    agregarFilaConsolidacion(row, 'result')
  );
  Array.from(netRowMap.values()).forEach((row) =>
    agregarFilaConsolidacion(row, 'net')
  );
  Array.from(finalRowMap.values()).forEach((row) =>
    agregarFilaConsolidacion(row, 'final')
  );

  const sortLayoutOps = (a = {}, b = {}) => {
    const orderA = Number.isFinite(Number(a.order)) ? Number(a.order) : 0;
    const orderB = Number.isFinite(Number(b.order)) ? Number(b.order) : 0;
    if (orderA !== orderB) return orderA - orderB;
    const idxA = Number.isFinite(Number(a.orderIndex)) ? Number(a.orderIndex) : 0;
    const idxB = Number.isFinite(Number(b.orderIndex)) ? Number(b.orderIndex) : 0;
    return idxA - idxB;
  };

  layoutOps.sort(sortLayoutOps);
  const layoutFinal = layout.concat(layoutOps);

  // === Operaciones libres (sin fila) ===
  const mapSecciones = new Map();
  const buildSeccionKey = (parent, label) => {
    if (!label) return '';
    if (parent) return normalizarTexto(`${parent}||${label}`);
    return normalizarTexto(label);
  };
  principalList.forEach((principal) => {
    if (!principal?.label) return;
    mapSecciones.set(normalizarTexto(principal.label), {
      actualMonth: principal.actualMonth,
      planMonth: principal.planMonth,
      prevMonth: principal.prevMonth,
      actualYTD: principal.actualYTD,
      planYTD: principal.planYTD,
      prevYTD: principal.prevYTD
    });
    (principal.children || []).forEach((sec) => {
      if (!sec?.label) return;
      mapSecciones.set(normalizarTexto(sec.label), {
        actualMonth: Number(sec.totalActualMonth ?? 0),
        planMonth: Number(sec.totalPlanMonth ?? 0),
        prevMonth: Number(sec.totalPrevMonth ?? 0),
        actualYTD: Number(sec.totalActualYTD ?? 0),
        planYTD: Number(sec.totalPlanYTD ?? 0),
        prevYTD: Number(sec.totalPrevYTD ?? 0)
      });
      const keyConPadre = buildSeccionKey(principal.label, sec.label);
      if (keyConPadre) {
        mapSecciones.set(keyConPadre, {
          actualMonth: Number(sec.totalActualMonth ?? 0),
          planMonth: Number(sec.totalPlanMonth ?? 0),
          prevMonth: Number(sec.totalPrevMonth ?? 0),
          actualYTD: Number(sec.totalActualYTD ?? 0),
          planYTD: Number(sec.totalPlanYTD ?? 0),
          prevYTD: Number(sec.totalPrevYTD ?? 0)
        });
      }
    });
  });

  const mapPlaneacion = new Map(
    (Array.isArray(planeacionData) ? planeacionData : []).map((p) => [
      p.cuenta,
      p
    ])
  );
  const mapCuentas = new Map();
  definicionCuentas.forEach((meta, cuentaCanonica) => {
    const actual = mapPlaneacion.get(cuentaCanonica) || {};
    const factorRaw =
      meta.operacion_factor ?? meta.operacionFactor ?? meta.factor;
    const factor = Number.isFinite(Number(factorRaw)) ? Number(factorRaw) : 1;
    const totals = {
      actualMonth: factor * Number(actual.actualMonth ?? 0),
      planMonth: factor * Number(actual.planMonth ?? 0),
      prevMonth: factor * Number(actual.prevMonth ?? 0),
      actualYTD: factor * Number(actual.actualYTD ?? 0),
      planYTD: factor * Number(actual.planYTD ?? 0),
      prevYTD: factor * Number(actual.prevYTD ?? 0)
    };
    const canonKey = normalizarTexto(cuentaCanonica);
    if (canonKey) mapCuentas.set(canonKey, totals);
    const visible = meta.visible || meta.cuenta || meta.CUENTA || '';
    const visibleKey = normalizarTexto(visible);
    if (visibleKey) mapCuentas.set(visibleKey, totals);
  });

  const mapOperaciones = new Map();
  const operacionesLibres = (Array.isArray(configAgrupacion) ? configAgrupacion : [])
    .filter((op) => NORMALIZAR_CAPITULO(op.CAPITULO) === capituloClave)
    .filter((op) => esOperacionLibre(op))
    .filter((op) => !esOperacionConfigColumnas(op));

  const ordenarLibre = (op, idx) => obtenerOrden(op, idx);
  const operacionesLibresOrdenadas = operacionesLibres
    .map((op, idx) => ({ op, idx, orden: ordenarLibre(op, idx) }))
    .sort((a, b) => (a.orden - b.orden) || (a.idx - b.idx))
    .map((item) => item.op);

  const calcularTotalesOperacion = (op) => {
    const terms = obtenerTerminosOperacion(op);
    if (!terms.length) return crearAcumulador();
    const totals = crearAcumulador();
    terms.forEach((term) => {
      if (!term) return;
      const operador = (term.operator || '+').toString().trim() === '-' ? -1 : 1;
      const tipo = normalizarTerminoTipo(term);
      const valor = term.value ?? term.cuenta ?? term.id ?? '';
      let origen = null;
      const buildFromPlaneacion = (record) => {
        if (!record) return null;
        return {
          actualMonth: Number(record.actualMonth ?? 0),
          planMonth: Number(record.planMonth ?? 0),
          prevMonth: Number(record.prevMonth ?? 0),
          actualYTD: Number(record.actualYTD ?? 0),
          planYTD: Number(record.planYTD ?? 0),
          prevYTD: Number(record.prevYTD ?? 0)
        };
      };

      if (tipo === 'section' || tipo === 'seccion') {
        const parent = (term.parentSection || op?.parentSection || '').toString().trim();
        const keyConPadre = buildSeccionKey(parent, valor);
        origen = (keyConPadre && mapSecciones.get(keyConPadre)) || null;
        if (!origen) {
          origen = mapSecciones.get(normalizarTexto(valor)) || null;
        }
      } else if (tipo === 'account' || tipo === 'cuenta') {
        const claveCuenta = normalizarTexto(
          normalizarCuentaCanonica(valor) || valor
        );
        origen = mapCuentas.get(claveCuenta) || null;
        if (!origen) {
          const canon = normalizarCuentaCanonica(valor);
          const visible = canon ? cuentaVisibleDesdeCanonica(canon) : null;
          const record =
            mapPlaneacion.get(valor) ||
            (visible ? mapPlaneacion.get(visible) : null) ||
            (canon ? mapPlaneacion.get(canon) : null);
          origen = buildFromPlaneacion(record);
        }
      } else if (tipo === 'operation' || tipo === 'operacion') {
        origen = mapOperaciones.get(normalizarTexto(valor)) || null;
      } else if (tipo === 'constant') {
        const numero =
          term.constant != null ? Number(term.constant) : Number(valor);
        origen = {
          actualMonth: Number.isFinite(numero) ? numero : 0,
          planMonth: Number.isFinite(numero) ? numero : 0,
          prevMonth: Number.isFinite(numero) ? numero : 0,
          actualYTD: Number.isFinite(numero) ? numero : 0,
          planYTD: Number.isFinite(numero) ? numero : 0,
          prevYTD: Number.isFinite(numero) ? numero : 0
        };
      } else {
        origen = mapSecciones.get(normalizarTexto(valor));
        if (!origen) {
          const claveCuenta = normalizarTexto(
            normalizarCuentaCanonica(valor) || valor
          );
          origen = mapCuentas.get(claveCuenta) || null;
          if (!origen) {
            const canon = normalizarCuentaCanonica(valor);
            const visible = canon ? cuentaVisibleDesdeCanonica(canon) : null;
            const record =
              mapPlaneacion.get(valor) ||
              (visible ? mapPlaneacion.get(visible) : null) ||
              (canon ? mapPlaneacion.get(canon) : null);
            origen = buildFromPlaneacion(record);
          }
        }
      }

      if (!origen) return;
      sumarTotales(totals, origen, operador);
    });

    const signo = Number(op?.signo);
    if (Number.isFinite(signo) && signo !== 1) {
      totals.actualMonth *= signo;
      totals.planMonth *= signo;
      totals.prevMonth *= signo;
      totals.actualYTD *= signo;
      totals.planYTD *= signo;
      totals.prevYTD *= signo;
    }
    return totals;
  };

  const insertarOperacionEnLayout = (layoutArr, opBlock, targetLabel) => {
    if (!targetLabel) {
      layoutArr.push(opBlock);
      return;
    }
    const targetKey = normalizarTexto(targetLabel);
    if (!targetKey) {
      layoutArr.push(opBlock);
      return;
    }
    const findIndex = (type) =>
      layoutArr.findIndex(
        (block) => block?.type === type && normalizarTexto(block.label) === targetKey
      );
    let idx = findIndex('secundaria');
    let stopTypes = new Set(['secundaria', 'principal', 'group', 'result', 'net', 'final', 'operation']);
    if (idx < 0) {
      idx = findIndex('principal');
      stopTypes = new Set(['principal', 'group', 'result', 'net', 'final', 'operation']);
    }
    if (idx < 0) {
      layoutArr.push(opBlock);
      return;
    }
    let insertAt = idx + 1;
    while (insertAt < layoutArr.length) {
      const next = layoutArr[insertAt];
      if (!next || stopTypes.has(next.type) || next.type === 'principal' || next.type === 'secundaria') {
        break;
      }
      insertAt += 1;
    }
    layoutArr.splice(insertAt, 0, opBlock);
  };

  operacionesLibresOrdenadas.forEach((op, idx) => {
    const totals = calcularTotalesOperacion(op);
    if (!totals) return;
    const label = obtenerNombreOperacion(op);
    const opKey = normalizarTexto(
      op?.OperacionId || op?.operacion_id || op?.id || label
    );
    if (opKey) mapOperaciones.set(opKey, totals);
    const opBlock = {
      type: 'operation',
      label,
      order: obtenerOrden(op, idx),
      orderIndex: idx,
      totals
    };
    const target =
      op.SECCION || op.seccion || op.parentSubsection || op.parentSection || '';
    insertarOperacionEnLayout(layoutFinal, opBlock, target);
  });

  return {
    principals: principalList,
    layout: layoutFinal
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
  const configAgrupacion = configCompleta
    .filter((cfg) => cfg.HOJA === hojaConfig)
    .filter((cfg) => !esOperacionConfigColumnas(cfg));

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
  const mesNumero = MESES.find(({ clave }) => clave === claveMes)?.periodo
    ?? Math.min(Math.max(new Date().getMonth() + 1, 1), 12);

  const planeacionData = await obtenerDatosPlaneacionResumen({
    empresaId,
    anio,
    mes: mesNumero,
    cuentas
  });

  const { principals, layout } = construirReporteResumen(
    listaFiltrada, 
    configAgrupacion,
    capituloEncontrado?.etiqueta || capituloSeleccionado,
    planeacionData
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
