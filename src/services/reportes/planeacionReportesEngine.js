const { obtenerDatosPlaneacionResumen } = require('../planeacionCuentasService');
const { MESES } = require('../saldosService');
const layoutService = require('../layoutService');

// Claves estables: mayúsculas + sin tildes/diacríticos.
// Evita duplicados por diferencias como "Comités" vs "Comites" y por
// caracteres invisibles/controles que suelen colarse desde Excel/CSV.
const LIMPIAR_CLAVE = (valor = '') => valor
  .toString()
  .replace(/\u0000/g, '') // null bytes (e.g. Firebird exports)
  .replace(/[\u200B-\u200D\uFEFF]/g, '') // zero-width & BOM
  .replace(/\s+/g, ' ')
  .trim();
const NORMALIZAR_CLAVE = (valor = '') => LIMPIAR_CLAVE(valor)
  .toUpperCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');
const NORMALIZAR_CAPITULO = (valor = '') => NORMALIZAR_CLAVE(valor);

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

const normalizarTexto = (valor = '') => LIMPIAR_CLAVE(valor)
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

const normalizarOperador = (valor) => {
  const raw = (valor || '+').toString().trim();
  if (raw === '×') return '*';
  if (raw === '÷') return '/';
  return raw || '+';
};

const numeroSeguro = (valor) => {
  const num = Number(valor);
  return Number.isFinite(num) ? num : 0;
};

const clonarTotales = (origen) => ({
  actualMonth: numeroSeguro(origen?.actualMonth),
  planMonth: numeroSeguro(origen?.planMonth),
  prevMonth: numeroSeguro(origen?.prevMonth),
  actualYTD: numeroSeguro(origen?.actualYTD),
  planYTD: numeroSeguro(origen?.planYTD),
  prevYTD: numeroSeguro(origen?.prevYTD),
});

const escalarTotales = (origen, factor) => {
  const base = clonarTotales(origen);
  base.actualMonth *= factor;
  base.planMonth *= factor;
  base.prevMonth *= factor;
  base.actualYTD *= factor;
  base.planYTD *= factor;
  base.prevYTD *= factor;
  return base;
};

const multiplicarTotales = (a, b) => ({
  actualMonth: numeroSeguro(a?.actualMonth) * numeroSeguro(b?.actualMonth),
  planMonth: numeroSeguro(a?.planMonth) * numeroSeguro(b?.planMonth),
  prevMonth: numeroSeguro(a?.prevMonth) * numeroSeguro(b?.prevMonth),
  actualYTD: numeroSeguro(a?.actualYTD) * numeroSeguro(b?.actualYTD),
  planYTD: numeroSeguro(a?.planYTD) * numeroSeguro(b?.planYTD),
  prevYTD: numeroSeguro(a?.prevYTD) * numeroSeguro(b?.prevYTD),
});

const dividirTotales = (a, b) => {
  const dividir = (num, den) => {
    const denom = numeroSeguro(den);
    if (!denom) return 0;
    return numeroSeguro(num) / denom;
  };
  return {
    actualMonth: dividir(a?.actualMonth, b?.actualMonth),
    planMonth: dividir(a?.planMonth, b?.planMonth),
    prevMonth: dividir(a?.prevMonth, b?.prevMonth),
    actualYTD: dividir(a?.actualYTD, b?.actualYTD),
    planYTD: dividir(a?.planYTD, b?.planYTD),
    prevYTD: dividir(a?.prevYTD, b?.prevYTD),
  };
};

const aplicarOperacionTotales = (acumulado, origen, operador) => {
  const op = normalizarOperador(operador);
  if (!acumulado) {
    if (op === '-') return escalarTotales(origen, -1);
    return clonarTotales(origen);
  }
  switch (op) {
    case '-':
      return sumarTotales(acumulado, origen, -1);
    case '*':
      return multiplicarTotales(acumulado, origen);
    case '/':
      return dividirTotales(acumulado, origen);
    default:
      return sumarTotales(acumulado, origen, 1);
  }
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

const construirReporteResumen = (
  definiciones,
  configAgrupacion,
  capituloSeleccionado,
  planeacionData,
  opciones = {}
) => {
  const definicionCuentas = new Map();
  const principalMap = new Map();

  const capituloClave = NORMALIZAR_CAPITULO(capituloSeleccionado || '');
  const manualOrderRequested = Boolean(opciones?.ordenManualTotal);

  // CAMBIO CRÍTICO: usar el índice del JSON directamente para preservar el orden
  const seccionOrden = new Map();
  const principalOrden = new Map();
  const consolidadoOrden = new Map();
  const operativoOrden = new Map();
  const resultOrden = new Map();
  const netOrden = new Map();
  const finalOrden = new Map();
  const freeOpsOrden = new Map();
  // Labels que generan filas agregadas (CONSOLIDATED/OPERATING/NET/FINAL).
  // Permite overrides manuales creando una operación libre con el mismo nombre.
  const aggLabelByKey = new Map();
  const registrarAggLabel = (label) => {
    if (!label) return;
    const limpio = label.toString().trim();
    if (!limpio) return;
    const key = normalizarTexto(limpio);
    if (!key) return;
    if (!aggLabelByKey.has(key)) {
      aggLabelByKey.set(key, limpio);
    }
  };

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
        // En modo manual (RESUMEN), el Gestor ordena por primera aparición del label
        // consolidado. En modo legado, mantenemos comportamiento de "última aparición".
        const preferirUltimaAparicion = !manualOrderRequested;
        let debeActualizar = false;
        if (preferirUltimaAparicion) {
          debeActualizar = existente == null || ordenConfig > existente;
        } else if (existente == null) {
          debeActualizar = true;
        } else {
          const actual = Number(existente);
          const nuevo = Number(ordenConfig);
          if (!Number.isFinite(actual)) {
            debeActualizar = true;
          } else if (Number.isFinite(nuevo)) {
            const actualEsCero = actual === 0;
            const nuevoEsCero = nuevo === 0;
            // Cuando existe ruido legacy (muchos 0), priorizar órdenes manuales > 0.
            if (actualEsCero && !nuevoEsCero) {
              debeActualizar = true;
            } else if (!actualEsCero && nuevoEsCero) {
              debeActualizar = false;
            } else {
              debeActualizar = nuevo < actual;
            }
          }
        }
        if (debeActualizar) {
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

      // Registrar labels agregados para permitir overrides manuales
      registrarAggLabel(consolidado);
      registrarAggLabel(operativo);
      registrarAggLabel(operativoConsolidado);
      registrarAggLabel(resultRow);
      registrarAggLabel(netRow);
      registrarAggLabel(netRowAdicional);
      registrarAggLabel(resultNetRow);

      if (esOperacionLibre(cfg)) {
        const opKey = normalizarTexto(obtenerNombreOperacion(cfg));
        if (opKey) {
          const existente = freeOpsOrden.get(opKey);
          if (existente == null || ordenConfig < existente) {
            freeOpsOrden.set(opKey, ordenConfig);
          }
        }
        // Las operaciones libres no tienen campos de config (net-row, result-row, etc.)
        // Si continúan, sobreescriben configPorSeccion con valores vacíos,
        // destruyendo la config real de esa sección.
        return;
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
        orden: ordenConfig,
        seccionLabel: seccion
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
      (!manualOrderRequested ? (config.principal || 'GENERAL') : '');
    if (!config || !Object.keys(config).length) {
      const principalKeyFallback = `${capituloClave}|PRINCIPAL|${principalLabel.toUpperCase()}`;
      config = configPorPrincipal.get(principalKeyFallback) || {};
      const itemPrincipalValor =
        item['SECCIÓN Principal'] ||
        item['SECCION Principal'] ||
        item['SECCIàN Principal'] ||
        '';
      if (
        !manualOrderRequested &&
        (!itemPrincipalValor || !itemPrincipalValor.toString().trim()) &&
        config.principal
      ) {
        principalLabel = config.principal;
      }
    }
    principalLabel = (principalLabel || '').toString().trim();
    const principalKey = principalLabel ? NORMALIZAR_CLAVE(principalLabel) : '__ROOT__';

    let cuentaCanonica = normalizarCuentaCanonica(item.CUENTA);
    const cuentaOriginal = (item.CUENTA || '').toString().trim();
    const esCuentaVirtual =
      !cuentaCanonica && (!cuentaOriginal || cuentaOriginal === '-' || cuentaOriginal === '0');
    if (esCuentaVirtual) {
      cuentaCanonica = `VIRTUAL|${capituloClave}|${principalLabel}|${seccion}|${idx}`;
      item.__esVirtual = true;
    }

    if (!cuentaCanonica) return;

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
      principalKey,
      cuentaOrden,
      idx
    );

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
        orden: principalFirstAppearance.get(principalKey)?.orden ?? 0,
        ordenIndex: principalFirstAppearance.get(principalKey)?.idx ?? 0,
        secciones: new Map()
      });
    }

    const principalNode = principalMap.get(principalKey);
    // En modo manual: subsección sin principal no existe -> tratar como "libre" (sin sección).
    let seccionLabel = seccion || '';
    if (manualOrderRequested && !principalLabel) {
      seccionLabel = '';
    }
    const seccionKey = seccionLabel ? NORMALIZAR_CLAVE(seccionLabel) : '__SECTION_LEVEL__';
    const seccionOrderKey = `${principalKey}||${seccionKey}`;

    // Registrar la primera aparición de cada Secundaria (orden mínimo)
    actualizarPrimeraAparicion(
      seccionFirstAppearance,
      seccionOrderKey,
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
        label: seccionLabel,
        cuentas: [],
        orden: seccionFirstAppearance.get(seccionOrderKey)?.orden ?? 0,
        ordenIndex: seccionFirstAppearance.get(seccionOrderKey)?.idx ?? 0
      });
    }

    // Las cuentas se agregan en el orden que aparecen en el JSON
    principalNode.secciones.get(seccionKey).cuentas.push(cuentaCanonica);
  });

  const asegurarPrincipalDesdeConfig = (cfg = {}, etiquetaPrincipal = '') => {
    const principalLabel = (etiquetaPrincipal || cfg.principalLabel || cfg.principal || '')
      .toString()
      .trim();
    if (!principalLabel) return null;
    const principalKey = NORMALIZAR_CLAVE(principalLabel);
    const existente = principalMap.get(principalKey);
    if (existente) {
      if (!existente.clase && cfg.clase) existente.clase = (cfg.clase || '').toString();
      if (!existente.consolidadoLabel && cfg.consolidado) existente.consolidadoLabel = cfg.consolidado;
      if (!existente.operativoLabel && cfg.operativo) existente.operativoLabel = cfg.operativo;
      if (!existente.operativoConsolidado && cfg.operativoConsolidado) existente.operativoConsolidado = cfg.operativoConsolidado;
      if (!existente.resultRow && cfg.resultRow) existente.resultRow = cfg.resultRow;
      if (!existente.netRow && cfg.netRow) existente.netRow = cfg.netRow;
      if (!existente.netRowAdicional && cfg.netRowAdicional) existente.netRowAdicional = cfg.netRowAdicional;
      if (!existente.resultNetRow && cfg.resultNetRow) existente.resultNetRow = cfg.resultNetRow;
      return existente;
    }
    const ordenCfg = Number.isFinite(Number(cfg?.orden))
      ? Number(cfg.orden)
      : null;
    const ordenPrincipal = principalOrden.has(principalLabel)
      ? principalOrden.get(principalLabel)
      : ordenCfg != null
        ? ordenCfg
        : principalMap.size + principalOrden.size;
    const principal = {
      key: principalKey,
      label: principalLabel,
      clase: (cfg.clase || '').toString(),
      consolidadoLabel: cfg.consolidado || '',
      operativoLabel: cfg.operativo || '',
      operativoConsolidado: cfg.operativoConsolidado || '',
      resultRow: cfg.resultRow || '',
      netRow: cfg.netRow || '',
      netRowAdicional: cfg.netRowAdicional || '',
      resultNetRow: cfg.resultNetRow || '',
      orden: ordenPrincipal,
      ordenIndex: principalMap.size + principalOrden.size,
      secciones: new Map(),
      esVirtual: true
    };
    principalMap.set(principalKey, principal);
    return principal;
  };

  // En modo 100% manual no queremos que aparezcan secciones/principales "fantasma"
  // creados a partir de configAgrupacion. Solo deben existir si hay cuentas reales.
  // manualOrderRequested ya está declarado al inicio de la función
  const includeEmptyConfiguredSections = Boolean(
    opciones?.includeEmptyConfiguredSections ?? !manualOrderRequested
  );

  if (includeEmptyConfiguredSections) {
    // Asegurar que Principales definidos en configuración existan aunque no haya cuentas
    configPorPrincipal.forEach((cfg) => {
      if (!cfg) return;
      asegurarPrincipalDesdeConfig(cfg, cfg.principalLabel);
    });

    // Asegurar que todas las secciones configuradas existan aunque estén vacías.
    // Nota: no forzamos 'GENERAL' si la config no define principal; eso genera secciones duplicadas no deseadas.
    configPorSeccion.forEach((cfg = {}) => {
      const seccionLabel = normalizarConfigValor(cfg.seccionLabel || '');
      if (!seccionLabel) return;

      const principalLabel = normalizarConfigValor(
        cfg.principalLabel || cfg.principal || ''
      );
      if (!principalLabel) return;

      const principal = asegurarPrincipalDesdeConfig(cfg, principalLabel);
      if (!principal) return;
      const seccionKey = seccionLabel ? NORMALIZAR_CLAVE(seccionLabel) : '__SECTION_LEVEL__';
      if (principal.secciones.has(seccionKey)) return;

      const ordenSeccion = Number.isFinite(Number(cfg?.orden))
        ? Number(cfg.orden)
        : seccionOrden.has(seccionLabel)
          ? seccionOrden.get(seccionLabel)
          : principal.secciones.size;
      principal.secciones.set(seccionKey, {
        label: seccionLabel || '',
        cuentas: [],
        orden: ordenSeccion,
        ordenIndex: principal.secciones.size
      });
    });
  }

  // === Manual order: considerar operaciones para el orden de headers ===
  // Si el usuario coloca operaciones dentro de una sección/subsección antes de la primera cuenta,
  // el header debe moverse con ellas (orden = primera aparición entre cuentas + operaciones).
  if (manualOrderRequested) {
    const principalPorSubseccion = new Map(); // normalizarTexto(secundaria) -> Set(principalLabel)
    principalMap.forEach((principal) => {
      if (!principal?.label) return;
      principal.secciones?.forEach((sec) => {
        const label = (sec?.label || '').toString().trim();
        if (!label) return;
        const key = normalizarTexto(label);
        if (!key) return;
        if (!principalPorSubseccion.has(key)) {
          principalPorSubseccion.set(key, new Set());
        }
        principalPorSubseccion.get(key).add(principal.label);
      });
    });

    const ensurePrincipalNode = (label) => {
      const clean = (label || '').toString().trim();
      if (!clean) return null;
      const key = NORMALIZAR_CLAVE(clean);
      if (!key) return null;
      if (!principalMap.has(key)) {
        // Crear principal virtual (solo headers/operaciones, sin cuentas)
        principalMap.set(key, {
          key,
          label: clean,
          clase: '',
          consolidadoLabel: '',
          operativoLabel: '',
          operativoConsolidado: '',
          resultRow: '',
          netRow: '',
          netRowAdicional: '',
          resultNetRow: '',
          orden: principalFirstAppearance.get(key)?.orden ?? 0,
          ordenIndex: principalFirstAppearance.get(key)?.idx ?? 0,
          secciones: new Map(),
          esVirtual: true,
        });
      }
      return principalMap.get(key);
    };

    const ensureSeccionNode = (principalNode, seccionLabel) => {
      if (!principalNode) return null;
      const label = (seccionLabel || '').toString().trim();
      const seccionKey = label ? NORMALIZAR_CLAVE(label) : '__SECTION_LEVEL__';
      if (!principalNode.secciones.has(seccionKey)) {
        const orderKey = `${principalNode.key}||${seccionKey}`;
        principalNode.secciones.set(seccionKey, {
          label: label || '',
          cuentas: [],
          orden: seccionFirstAppearance.get(orderKey)?.orden ?? principalNode.orden ?? 0,
          ordenIndex: seccionFirstAppearance.get(orderKey)?.idx ?? principalNode.secciones.size,
        });
      }
      return principalNode.secciones.get(seccionKey);
    };

    const opsOrdenadas = (Array.isArray(configAgrupacion) ? configAgrupacion : [])
      .filter((op) => NORMALIZAR_CAPITULO(op.CAPITULO) === capituloClave)
      .filter((op) => !esOperacionConfigColumnas(op))
      .map((op, idx) => ({ op, idx, orden: obtenerOrden(op, idx) }))
      .sort((a, b) => (a.orden - b.orden) || (a.idx - b.idx));

    opsOrdenadas.forEach(({ op, idx, orden }) => {
      const placement = (op?.SECCION || op?.seccion || '').toString().trim();
      const parentSection = (op?.parentSection || '').toString().trim();
      const parentSubsection = (op?.parentSubsection || '').toString().trim();

      let principalLabel = parentSection;
      let seccionLabel = parentSubsection;

      if (!principalLabel && placement) {
        // placement puede ser principal o subsección (secundaria)
        const placementKey = normalizarTexto(placement);
        const principalMatch = Array.from(principalMap.values()).find(
          (p) => normalizarTexto(p?.label || '') === placementKey
        );
        if (principalMatch?.label) {
          principalLabel = principalMatch.label;
        } else {
          const candidates = principalPorSubseccion.get(placementKey);
          if (candidates && candidates.size === 1) {
            principalLabel = Array.from(candidates)[0];
            seccionLabel = placement;
          }
        }
      }

      if (principalLabel && !seccionLabel && placement) {
        const placementKey = normalizarTexto(placement);
        if (placementKey && normalizarTexto(principalLabel) !== placementKey) {
          const principalNode = principalMap.get(NORMALIZAR_CLAVE(principalLabel));
          const hasSecInPrincipal = principalNode
            ? Array.from(principalNode.secciones.values()).some(
              (sec) => normalizarTexto(sec?.label || '') === placementKey
            )
            : false;
          const candidates = principalPorSubseccion.get(placementKey);
          if (hasSecInPrincipal || (candidates && candidates.has(principalLabel))) {
            seccionLabel = placement;
          }
        }
      }

      if (!principalLabel) {
        return;
      }

      const principalKey = NORMALIZAR_CLAVE(principalLabel);
      // Solo operaciones libres deben influir en el orden de principales/secciones.
      // Las operaciones de config (sum-row, result-row, etc.) tienen orden_presentacion=0
      // y contaminan principalFirstAppearance haciendo que todos los principales tengan orden=0.
      if (esOperacionLibre(op)) {
        actualizarPrimeraAparicion(principalFirstAppearance, principalKey, orden, idx);
      }
      const principalNode = ensurePrincipalNode(principalLabel);

      if (seccionLabel) {
        const seccionKey = NORMALIZAR_CLAVE(seccionLabel);
        const seccionOrderKey = `${principalKey}||${seccionKey}`;
        if (esOperacionLibre(op)) {
          actualizarPrimeraAparicion(seccionFirstAppearance, seccionOrderKey, orden, idx);
        }
        ensureSeccionNode(principalNode, seccionLabel);
      }
    });

    // Reaplicar ordenes a principales/sections ya creadas.
    principalMap.forEach((principal) => {
      const info = principalFirstAppearance.get(principal.key);
      if (info) {
        principal.orden = info.orden;
        principal.ordenIndex = info.idx;
      }
      principal.secciones?.forEach((sec, secKey) => {
        const k = `${principal.key}||${secKey}`;
        const infoSec = seccionFirstAppearance.get(k);
        if (infoSec) {
          sec.orden = infoSec.orden;
          sec.ordenIndex = infoSec.idx;
        }
      });
    });
  }

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

  const normalizarEtiqueta = (valor = '') => NORMALIZAR_CLAVE(valor);

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
  const claveEtiqueta = (valor = '') => NORMALIZAR_CLAVE(limpiarEtiqueta(valor));
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

  // === Mapas base para fórmulas (secciones, cuentas, operaciones) ===
  const mapSecciones = new Map();
  const buildSeccionKey = (parent, label) => {
    if (!label) return '';
    if (parent) return normalizarTexto(`${parent}||${label}`);
    return normalizarTexto(label);
  };
  const rebuildMapSecciones = () => {
    mapSecciones.clear();
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
        const totals = {
          actualMonth: Number(sec.totalActualMonth ?? 0),
          planMonth: Number(sec.totalPlanMonth ?? 0),
          prevMonth: Number(sec.totalPrevMonth ?? 0),
          actualYTD: Number(sec.totalActualYTD ?? 0),
          planYTD: Number(sec.totalPlanYTD ?? 0),
          prevYTD: Number(sec.totalPrevYTD ?? 0)
        };
        mapSecciones.set(normalizarTexto(sec.label), totals);
        const keyConPadre = buildSeccionKey(principal.label, sec.label);
        if (keyConPadre) {
          mapSecciones.set(keyConPadre, totals);
        }
      });
    });
  };
  rebuildMapSecciones();
  const seccionNodeByKey = new Map();
  principalList.forEach((principal) => {
    (principal.children || []).forEach((sec) => {
      const key = buildSeccionKey(principal.label, sec.label);
      if (key) seccionNodeByKey.set(key, sec);
      const simple = normalizarTexto(sec.label);
      if (simple && !seccionNodeByKey.has(simple)) {
        seccionNodeByKey.set(simple, sec);
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
  const calcularTotalesOperacion = (op) => {
    const terms = obtenerTerminosOperacion(op);
    if (!terms.length) return crearAcumulador();
    let totals = null;
    terms.forEach((term) => {
      if (!term) return;
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
        if (!origen) {
          const parent = (term.parentSection || op?.parentSection || '').toString().trim();
          const keyConPadre = buildSeccionKey(parent, valor);
          origen = (keyConPadre && mapSecciones.get(keyConPadre)) || null;
          if (!origen) {
            origen = mapSecciones.get(normalizarTexto(valor)) || null;
          }
          if (!origen) {
            origen = mapOperaciones.get(normalizarTexto(valor)) || null;
          }
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
      totals = aplicarOperacionTotales(totals, origen, term.operator);
    });

    if (!totals) {
      totals = crearAcumulador();
    }

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
  const getOperacionKey = (op) =>
    normalizarTexto(
      op?.OperacionId ||
      op?.operacion_id ||
      op?.id ||
      op?.Clase ||
      op?.clase ||
      op?.operacion_etiqueta ||
      op?.['sum-row-sumavarios'] ||
      op?.['sum-row'] ||
      ''
    );
  const storeOperacionTotals = (op, totals) => {
    const opKey = getOperacionKey(op);
    if (opKey) mapOperaciones.set(opKey, totals);
  };
  const hasManualFormula = (op = {}) => {
    if (Array.isArray(op.formula_terms) && op.formula_terms.length) return true;
    if (op.formula_json) {
      try {
        const parsed = JSON.parse(op.formula_json);
        return Array.isArray(parsed) && parsed.length > 0;
      } catch (err) {
        // continuar: puede venir fórmula legacy en seccion_1/signos
      }
    }

    // Legacy: fórmula expresada en campos seccion_1, seccion_2, ... (y/o signos).
    try {
      const signos = op?.signos;
      if (signos && typeof signos === 'object') {
        const keys = Object.keys(signos).filter((k) => k && k.startsWith('seccion_'));
        if (keys.some((k) => Boolean(op?.[k]))) return true;
      }
      const ownKeys = Object.keys(op || {});
      if (ownKeys.some((k) => /^seccion_\d+$/i.test(k) && op?.[k])) return true;
    } catch (_) {
      /* ignore */
    }

    return false;
  };
  const applyTotalsToSection = (sec, totals) => {
    if (!sec || !totals) return;
    sec.totalActualMonth = totals.actualMonth;
    sec.totalPlanMonth = totals.planMonth;
    sec.totalPrevMonth = totals.prevMonth;
    sec.totalActualYTD = totals.actualYTD;
    sec.totalPlanYTD = totals.planYTD;
    sec.totalPrevYTD = totals.prevYTD;
    sec.total = totals.actualYTD;
    sec.__manualFormula = true;
  };
  const applyTotalsToPrincipal = (principal, totals) => {
    if (!principal || !totals) return;
    principal.actualMonth = totals.actualMonth;
    principal.planMonth = totals.planMonth;
    principal.prevMonth = totals.prevMonth;
    principal.actualYTD = totals.actualYTD;
    principal.planYTD = totals.planYTD;
    principal.prevYTD = totals.prevYTD;
    principal.total = totals.actualYTD;
    principal.__manualFormula = true;
  };

  // Operaciones cuya fórmula se aplicó a headers (principal/secundaria).
  // Para evitar duplicar filas (header + operación con el mismo nombre),
  // las excluimos del render como "operación libre".
  const headerOverrideOps = new Set(); // opKey (normalizarTexto)

  // === Override de fórmulas en sum-row / sum-row-sumavarios (solo si se habilita) ===
  if (opciones?.permitirFormulaSecciones) {
    const opsConFormula = (Array.isArray(configAgrupacion) ? configAgrupacion : [])
      .filter((op) => NORMALIZAR_CAPITULO(op.CAPITULO) === capituloClave)
      .filter((op) => !esOperacionConfigColumnas(op))
      .map((op, idx) => ({ op, idx, orden: obtenerOrden(op, idx) }))
      .filter(({ op }) => hasManualFormula(op))
      .sort((a, b) => (a.orden - b.orden) || (a.idx - b.idx));

    const manualPrincipalKeys = new Set();
    const appliedOps = headerOverrideOps;
    const manualSeccionOps = opsConFormula;
    const manualPrincipalOps = opsConFormula.filter(
      ({ op }) => op['sum-row-sumavarios']
    );

    const resolveSectionNode = (label, parent) => {
      if (!label) return null;
      const key = buildSeccionKey(parent, label);
      return (
        (key && seccionNodeByKey.get(key)) ||
        seccionNodeByKey.get(normalizarTexto(label)) ||
        null
      );
    };

    const resolvePrincipalNode = (label) => {
      if (!label) return null;
      return obtenerPrincipalPorEtiqueta(label);
    };

    manualSeccionOps.forEach(({ op }) => {
      const opKey = getOperacionKey(op);
      const totals = calcularTotalesOperacion(op);
      if (!totals) return;
      const rowLabel = (op['sum-row'] || '').toString().trim();
      const seccionValor = (op.SECCION || op.seccion || '').toString().trim();
      const parentSection = (op.parentSection || '').toString().trim();
      const parentSubsection = (op.parentSubsection || '').toString().trim();

      const sectionCandidates = [
        { label: rowLabel, parent: parentSection || seccionValor },
        { label: parentSubsection, parent: parentSection },
        { label: seccionValor, parent: parentSection }
      ].filter((item) => item.label);

      let applied = false;
      for (const candidate of sectionCandidates) {
        const secNode = resolveSectionNode(candidate.label, candidate.parent);
        if (!secNode) continue;
        applyTotalsToSection(secNode, totals);
        storeOperacionTotals(op, totals);
        applied = true;
        if (opKey) appliedOps.add(opKey);
        break;
      }

      if (applied) return;

      const principalCandidates = [
        rowLabel,
        seccionValor,
        parentSection,
        op.Clase,
        op.operacion_etiqueta
      ].filter(Boolean);

      for (const candidate of principalCandidates) {
        const principal = resolvePrincipalNode(candidate);
        if (!principal) continue;
        const key = normalizarEtiqueta(principal.label);
        if (manualPrincipalKeys.has(key)) break;
        applyTotalsToPrincipal(principal, totals);
        manualPrincipalKeys.add(key);
        storeOperacionTotals(op, totals);
        if (opKey) appliedOps.add(opKey);
        break;
      }
    });

    rebuildMapSecciones();

    manualPrincipalOps.forEach(({ op }) => {
      const opKey = getOperacionKey(op);
      const label = (op['sum-row-sumavarios'] || '').toString().trim();
      if (!label) return;
      const principal = obtenerPrincipalPorEtiqueta(label);
      if (!principal) return;
      const totals = calcularTotalesOperacion(op);
      if (!totals) return;
      applyTotalsToPrincipal(principal, totals);
      manualPrincipalKeys.add(normalizarEtiqueta(label));
      storeOperacionTotals(op, totals);
      if (opKey) appliedOps.add(opKey);
    });

    const principalPorSubseccion = new Map();
    principalList.forEach((principal) => {
      (principal.children || []).forEach((sec) => {
        const key = normalizarTexto(sec?.label || '');
        if (!key) return;
        if (!principalPorSubseccion.has(key)) {
          principalPorSubseccion.set(key, new Set());
        }
        principalPorSubseccion.get(key).add(principal.label);
      });
    });

    const inferPrincipalFromTerms = (op) => {
      const terms = obtenerTerminosOperacion(op);
      if (!terms.length) return null;
      const candidates = new Set();
      let hasSectionTerms = false;
      terms.forEach((term) => {
        if (!term) return;
        const tipo = normalizarTerminoTipo(term);
        if (tipo !== 'section' && tipo !== 'seccion') return;
        const value = (term.value ?? term.cuenta ?? term.id ?? '').toString().trim();
        if (!value) return;
        hasSectionTerms = true;
        const parentHint = (term.parentSection || op?.parentSection || '').toString().trim();
        if (parentHint) {
          const principal = obtenerPrincipalPorEtiqueta(parentHint);
          if (principal) {
            candidates.add(principal.label);
            return;
          }
        }
        const principalDirect = obtenerPrincipalPorEtiqueta(value);
        if (principalDirect) {
          candidates.add(principalDirect.label);
          return;
        }
        const key = normalizarTexto(value);
        const posibles = principalPorSubseccion.get(key);
        if (posibles) {
          posibles.forEach((label) => candidates.add(label));
        }
      });
      if (!hasSectionTerms) return null;
      if (candidates.size !== 1) return null;
      const [label] = Array.from(candidates);
      return obtenerPrincipalPorEtiqueta(label);
    };

    opsConFormula.forEach(({ op }) => {
      const opKey = getOperacionKey(op);
      if (opKey && appliedOps.has(opKey)) return;
      const principal = inferPrincipalFromTerms(op);
      if (!principal) return;
      const key = normalizarEtiqueta(principal.label);
      if (manualPrincipalKeys.has(key)) return;
      const totals = calcularTotalesOperacion(op);
      if (!totals) return;
      applyTotalsToPrincipal(principal, totals);
      manualPrincipalKeys.add(key);
      storeOperacionTotals(op, totals);
      if (opKey) appliedOps.add(opKey);
    });

    principalList.forEach((principal) => {
      if (!principal?.label) return;
      const key = normalizarEtiqueta(principal.label);
      if (manualPrincipalKeys.has(key)) return;
      const totales = (principal.children || []).reduce(
        (acc, nodo) => ({
          actualMonth: acc.actualMonth + (Number(nodo.totalActualMonth) || 0),
          planMonth: acc.planMonth + (Number(nodo.totalPlanMonth) || 0),
          prevMonth: acc.prevMonth + (Number(nodo.totalPrevMonth) || 0),
          actualYTD: acc.actualYTD + (Number(nodo.totalActualYTD) || 0),
          planYTD: acc.planYTD + (Number(nodo.totalPlanYTD) || 0),
          prevYTD: acc.prevYTD + (Number(nodo.totalPrevYTD) || 0)
        }),
        crearAcumulador()
      );
      applyTotalsToPrincipal(principal, totales);
    });

    rebuildMapSecciones();
  }

  // === Overrides manuales para filas agregadas (CONSOLIDATED/OPERATING/NET/FINAL) ===
  // Si existe una operación (libre o de fila) cuyo nombre/label coincide con una fila agregada:
  // - su `orden_presentacion` ancla la posición de esa fila agregada
  // - y si además trae fórmula manual, sobreescribe los totales de esa fila agregada.
  const manualAggOverrides = new Map(); // key = normalizarTexto(label) -> { label, order, totals }
  const manualAggOverrideOps = new Set(); // opKey para excluir del render como operación libre
  if (aggLabelByKey.size) {
    const resolverAggLabelByNombreOperacion = (operationName = "") => {
      const clean = (operationName || "").toString().trim();
      if (!clean) return null;
      const key = normalizarTexto(clean);
      if (!key) return null;

      const candidates = new Set([key]);
      if (key.endsWith("S")) {
        candidates.add(key.slice(0, -1));
      } else {
        candidates.add(`${key}S`);
      }
      if (key.includes("EXPENSES")) {
        candidates.add(key.replace("EXPENSES", "EXPENSE"));
      } else if (key.includes("EXPENSE")) {
        candidates.add(key.replace("EXPENSE", "EXPENSES"));
      }

      for (const candidate of candidates) {
        const label = aggLabelByKey.get(candidate);
        if (label) return label;
      }
      return null;
    };

    // Evita que múltiples anchors explícitos del mismo label sobreescriban el primero.
    const aggOrderAnchored = new Set();

    const anchors = (Array.isArray(configAgrupacion) ? configAgrupacion : [])
      .filter((op) => NORMALIZAR_CAPITULO(op.CAPITULO) === capituloClave)
      .filter((op) => !esOperacionConfigColumnas(op))
      .map((op, idx) => ({ op, idx, orden: obtenerOrden(op, idx) }))
      .sort((a, b) => (a.orden - b.orden) || (a.idx - b.idx));

    anchors.forEach(({ op, orden }) => {
      const name = (obtenerNombreOperacion(op) || "").toString().trim();
      const label = resolverAggLabelByNombreOperacion(name);
      const labelKey = label ? normalizarTexto(label) : "";
      const matchedAny = Boolean(label);

      if (label) {
        // Solo anclar por nombre/clase explícito de la operación.
        // Usar también labels de fila (sum-row, consolidated, net, etc.) como ancla
        // puede arrastrar múltiples filas agregadas cuando una operación define
        // varios campos legacy, causando desorden global.
        if (hasManualFormula(op)) {
          const totals = calcularTotalesOperacion(op);
          if (totals) {
            const prev = manualAggOverrides.get(labelKey);
            if (!prev || Number(orden) < Number(prev.order)) {
              manualAggOverrides.set(labelKey, { label, order: orden, totals });
            }
          }
        }

        const overrideOrdenEnMapa = (mapa, mapName) => {
          if (!mapa || !mapa.has(label)) return;
          const marker = `${mapName}::${labelKey}`;
          if (aggOrderAnchored.has(marker)) return;
          mapa.set(label, orden);
          aggOrderAnchored.add(marker);
        };
        overrideOrdenEnMapa(consolidadoOrden, "consolidado");
        overrideOrdenEnMapa(operativoOrden, "operativo");
        overrideOrdenEnMapa(resultOrden, "result");
        overrideOrdenEnMapa(netOrden, "net");
        overrideOrdenEnMapa(finalOrden, "final");
      }

      if (matchedAny) {
        const opKey = getOperacionKey(op);
        if (opKey) manualAggOverrideOps.add(opKey);
      }
    });
  }

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

  // Aplicar overrides manuales a filas agregadas ya construidas.
  const applyAggOverride = (row) => {
    if (!row?.label) return;
    const key = normalizarTexto(row.label);
    if (!key) return;
    const override = manualAggOverrides.get(key);
    if (!override) return;
    row.totals = override.totals;
    row.manualFormula = true;
    if (Number.isFinite(Number(override.order))) {
      row.orden = Number(override.order);
    }
  };
  Array.from(consolidatedMap.values()).forEach(applyAggOverride);
  Array.from(operativoRowMap.values()).forEach(applyAggOverride);
  Array.from(resultRowMap.values()).forEach(applyAggOverride);
  Array.from(netRowMap.values()).forEach(applyAggOverride);
  Array.from(finalRowMap.values()).forEach(applyAggOverride);

  // === ASEGURAR que filas con anchors/overrides manuales existan ===
  // Esto garantiza que las filas con fórmulas manuales aparezcan aunque no haya principals.
  // Solo se crean si tienen un override manual (anchor con fórmula).
  const asegurarFilasConOverride = (ordenMapa, agregadorMapa) => {
    ordenMapa.forEach((orden, etiqueta) => {
      const etiquetaLimpia = limpiarEtiqueta(etiqueta);
      const clave = claveEtiqueta(etiquetaLimpia);
      if (!clave || !etiquetaLimpia) return;

      // Si ya existe, no hacer nada
      if (agregadorMapa.has(clave)) return;

      // Solo crear si hay un override manual con fórmula
      const override = manualAggOverrides.get(clave);
      if (!override || !override.totals) return;

      // Crear la fila con el override
      agregadorMapa.set(clave, {
        label: etiquetaLimpia,
        orden: Number.isFinite(Number(override.order)) ? Number(override.order) :
          Number.isFinite(Number(orden)) ? Number(orden) : agregadorMapa.size,
        ordenIndex: agregadorMapa.size,
        totals: override.totals,
        principals: [],
        operaciones: [],
        manualFormula: true,
        esVacia: false
      });
    });
  };

  // Asegurar solo las filas con overrides manuales
  asegurarFilasConOverride(consolidadoOrden, consolidatedMap);
  asegurarFilasConOverride(operativoOrden, operativoRowMap);
  asegurarFilasConOverride(resultOrden, resultRowMap);
  asegurarFilasConOverride(netOrden, netRowMap);
  asegurarFilasConOverride(finalOrden, finalRowMap);

  // Aplicar overrides manuales a las filas recién creadas también
  Array.from(consolidatedMap.values()).forEach(applyAggOverride);
  Array.from(operativoRowMap.values()).forEach(applyAggOverride);
  Array.from(resultRowMap.values()).forEach(applyAggOverride);
  Array.from(netRowMap.values()).forEach(applyAggOverride);
  Array.from(finalRowMap.values()).forEach(applyAggOverride);

  const layout = [];
  const layoutOps = [];

  // Función para agregar un principal con sus secundarias y cuentas
  const agregarPrincipalConHijos = (principal) => {
    if (!principal.children || !principal.children.length) {
      return;
    }
    const principalLabel = (principal.label || '').toString().trim();
    const shouldRenderPrincipal = Boolean(principalLabel);
    if (shouldRenderPrincipal) {
      layout.push({
        type: 'principal',
        label: principalLabel,
        order: Number.isFinite(Number(principal.orden)) ? Number(principal.orden) : 0,
        orderIndex: principal.ordenIndex ?? 0,
        manualFormula: Boolean(principal.__manualFormula),
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
    }

    (principal.children || []).forEach((secundaria) => {
      const secundariaLabel = (secundaria.label || '').toString().trim();
      const shouldRenderSecundaria = Boolean(secundariaLabel);
      if (shouldRenderSecundaria) {
        layout.push({
          type: 'secundaria',
          label: secundariaLabel,
          order: Number.isFinite(Number(secundaria.orden))
            ? Number(secundaria.orden)
            : Number.isFinite(Number(principal.orden)) ? Number(principal.orden) : 0,
          orderIndex: secundaria.ordenIndex ?? 0,
          manualFormula: Boolean(secundaria.__manualFormula),
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
      }

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
      manualFormula: Boolean(row.manualFormula),
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
  let layoutFinal = layout.concat(layoutOps);

  // === Operaciones libres (sin fila) ===
  const operacionesLibres = (Array.isArray(configAgrupacion) ? configAgrupacion : [])
    .filter((op) => NORMALIZAR_CAPITULO(op.CAPITULO) === capituloClave)
    .filter((op) => esOperacionLibre(op))
    .filter((op) => {
      const opKey = getOperacionKey(op);
      if (!opKey) return true;
      if (manualAggOverrideOps.has(opKey)) return false;
      if (headerOverrideOps.has(opKey)) return false;
      return true;
    })
    .filter((op) => !esOperacionConfigColumnas(op));

  const ordenarLibre = (op, idx) => obtenerOrden(op, idx);
  const operacionesLibresOrdenadas = operacionesLibres
    .map((op, idx) => ({ op, idx, orden: ordenarLibre(op, idx) }))
    .sort((a, b) => (a.orden - b.orden) || (a.idx - b.idx))
    .map((item) => item.op);

  const toNumberOrNull = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const compareByOrder = (a, b, idxA = 0, idxB = 0) => {
    const orderA = toNumberOrNull(a?.order);
    const orderB = toNumberOrNull(b?.order);
    if (orderA != null && orderB != null && orderA !== orderB) {
      return orderA - orderB;
    }
    if (orderA != null && orderB == null) return -1;
    if (orderA == null && orderB != null) return 1;
    const orderIdxA = toNumberOrNull(a?.orderIndex) ?? idxA;
    const orderIdxB = toNumberOrNull(b?.orderIndex) ?? idxB;
    if (orderIdxA !== orderIdxB) return orderIdxA - orderIdxB;
    return idxA - idxB;
  };
  const ordenarLayoutGlobal = (items = []) =>
    (Array.isArray(items) ? items : [])
      .map((item, idx) => ({ item, idx }))
      .sort((a, b) => compareByOrder(a.item, b.item, a.idx, b.idx))
      .map(({ item }) => item);

  const insertarOperacionEnLayout = (layoutArr, opBlock, targetLabel) => {
    const targetKey = normalizarTexto(targetLabel);
    if (targetKey) {
      const findIndex = (type) =>
        layoutArr.findIndex(
          (block) => block?.type === type && normalizarTexto(block.label) === targetKey
        );

      let idx = findIndex('secundaria');
      let stopTypes = new Set(['secundaria', 'principal', 'group', 'result', 'net', 'final']);
      if (idx < 0) {
        idx = findIndex('principal');
        stopTypes = new Set(['principal', 'group', 'result', 'net', 'final']);
      }

      if (idx >= 0) {
        let insertAt = idx + 1;
        while (insertAt < layoutArr.length) {
          const next = layoutArr[insertAt];
          if (!next || stopTypes.has(next.type) || next.type === 'principal' || next.type === 'secundaria') {
            break;
          }

          // Si ya hay operaciones en ese bloque, respetar el orden relativo de las operaciones.
          if (next.type === 'operation') {
            const currentOrder = toNumberOrNull(opBlock?.order);
            const nextOrder = toNumberOrNull(next?.order);
            if (currentOrder != null && nextOrder != null && currentOrder < nextOrder) {
              break;
            }
          }

          insertAt += 1;
        }
        layoutArr.splice(insertAt, 0, opBlock);
        return;
      }
    }

    // Sin destino claro: usar orden explícito global si existe.
    if (toNumberOrNull(opBlock?.order) != null) {
      let insertAt = layoutArr.length;
      for (let i = 0; i < layoutArr.length; i += 1) {
        if (compareByOrder(opBlock, layoutArr[i], 0, i) < 0) {
          insertAt = i;
          break;
        }
      }
      layoutArr.splice(insertAt, 0, opBlock);
      return;
    }

    layoutArr.push(opBlock);
  };

  const manualOrder = Boolean(opciones?.ordenManualTotal);
  const opBlocks = [];

  operacionesLibresOrdenadas.forEach((op, idx) => {
    const totals = calcularTotalesOperacion(op);
    if (!totals) return;
    const label = obtenerNombreOperacion(op);
    const opKey = normalizarTexto(
      op?.OperacionId || op?.operacion_id || op?.id || label
    );
    if (opKey) mapOperaciones.set(opKey, totals);
    const rowStyle =
      op?.rowStyle ||
      op?.estilo_fila ||
      "operation-row";
    const opBlock = {
      type: 'operation',
      label,
      order: obtenerOrden(op, idx),
      orderIndex: idx,
      manualFormula: hasManualFormula(op),
      totals,
      rowStyle,
      estilo_fila: rowStyle || op?.estilo_fila,
      tipo_operacion: op?.tipo_operacion
    };
    if (manualOrder) {
      opBlocks.push(opBlock);
      return;
    }
    const target =
      op.parentSubsection || op.parentSection || op.SECCION || op.seccion || '';
    insertarOperacionEnLayout(layoutFinal, opBlock, target);
  });

  if (manualOrder) {
    // En modo manual debemos respetar el orden global fila-a-fila del Gestor
    // (incluyendo headers, cuentas, consolidados y operaciones libres).
    // Reagrupar por principal puede mover operaciones fuera de su posición visual.
    layoutFinal = ordenarLayoutGlobal(layout.concat(layoutOps, opBlocks));
  }

  // DEBUG: diagnóstico net results
  try {
    const fs = require('fs');
    const path = require('path');
    const debugFile = path.join(require('os').homedir(), 'Desktop', 'debug-net-results.txt');
    const lines = ['=== PRINCIPALS netRow ==='];
    principalList.forEach((p) => {
      lines.push(`  "${p.label}" netRow="${p.netRow}" resultRow="${p.resultRow}" consolidadoLabel="${p.consolidadoLabel}" resultNetRow="${p.resultNetRow}"`);
    });
    lines.push('', '=== configPorPrincipal ===');
    configPorPrincipal.forEach((cfg, key) => {
      lines.push(`  key="${key}" principal="${cfg.principal}" netRow="${cfg.netRow}" resultRow="${cfg.resultRow}" consolidado="${cfg.consolidado}"`);
    });
    lines.push('', '=== configPorSeccion (con net-row) ===');
    configPorSeccion.forEach((cfg, key) => {
      if (cfg.netRow || cfg.resultRow || cfg.resultNetRow) {
        lines.push(`  key="${key}" principal="${cfg.principal}" seccion="${cfg.seccionLabel}" netRow="${cfg.netRow}" resultRow="${cfg.resultRow}" resultNetRow="${cfg.resultNetRow}"`);
      }
    });
    lines.push('', '=== configAgrupacion entries con net-row ===');
    (Array.isArray(configAgrupacion) ? configAgrupacion : []).forEach((cfg, idx) => {
      const nr = normalizarConfigValor(cfg['net-row']);
      const rr = normalizarConfigValor(cfg['result-row']);
      const rnr = normalizarConfigValor(cfg['result-net-row']);
      if (nr || rr || rnr) {
        lines.push(`  [${idx}] SECCION="${cfg.SECCION}" parentSection="${cfg.parentSection}" sum-row-sumavarios="${cfg['sum-row-sumavarios']}" net-row="${nr}" result-row="${rr}" result-net-row="${rnr}" orden_presentacion=${cfg.orden_presentacion}`);
      }
    });
    lines.push('', '=== principalMap netRow (raw) ===');
    principalMap.forEach((p, key) => {
      lines.push(`  key="${key}" label="${p.label}" netRow="${p.netRow}" resultRow="${p.resultRow}" consolidadoLabel="${p.consolidadoLabel}"`);
    });
    fs.writeFileSync(debugFile, lines.join('\n'), 'utf8');
  } catch (e) { /* ignore */ }

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
    planeacionData,
    {
      permitirFormulaSecciones: tipoReporte === 'RESUMEN' || tipoReporte === 'SUMMARY',
      ordenManualTotal: tipoReporte === 'RESUMEN' || tipoReporte === 'SUMMARY'
    }
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
