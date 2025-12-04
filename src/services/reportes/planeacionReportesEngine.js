const path = require('path');
const fs = require('fs');
const { obtenerDatosPlaneacion } = require('../planeacionCuentasService');
const { MESES } = require('../saldosService');

const DEFAULT_BASE_PATH = path.join(__dirname, '..', '..', '..', 'info IMPORTANTE');
const DEFINICIONES_FILE = path.join(DEFAULT_BASE_PATH, 'CUENTAS SUMMARY y RESUMEN.json');

const NORMALIZAR_CLAVE = (valor = '') => valor.toString().trim().toUpperCase();
const NORMALIZAR_CAPITULO = (valor = '') => valor.toString().trim().toUpperCase();

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

const cargarDefiniciones = () => {
  const contenido = fs.readFileSync(DEFINICIONES_FILE, 'utf8');
  return JSON.parse(contenido);
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

const obtenerMesActualClave = () => {
  const ahora = new Date();
  const indice = Math.min(Math.max(ahora.getMonth(), 0), 11);
  return MESES[indice]?.clave || 'dic';
};

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

const calcularTotales = (cuentas, claveMes, planeacionActual, planeacionPrevio) => {
  const claveAcum = `${claveMes}_acum`;

  return cuentas.reduce(
    (acc, cuenta) => {
      const actual = planeacionActual.find((p) => p.cuenta === cuenta);
      const previo = planeacionPrevio.find((p) => p.cuenta === cuenta);

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

const construirNodoSeccion = ({ seccion, cuentas, definicion, claveMes, planeacionActual, planeacionPrevio, orden = 0 }) => {
  const totales = calcularTotales(cuentas, claveMes, planeacionActual, planeacionPrevio);

  const cuentasDetalle = cuentas.map((cuentaId) => {
    const actual = planeacionActual.find((p) => p.cuenta === cuentaId) || {};
    const previo = planeacionPrevio.find((p) => p.cuenta === cuentaId) || {};

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

const construirReporteResumen = (definiciones, configAgrupacion, capituloSeleccionado, claveMes, planeacionActual, planeacionPrevio) => {
  const definicionCuentas = new Map();
  const principalMap = new Map();

  const capituloClave = NORMALIZAR_CAPITULO(capituloSeleccionado || '');

  const seccionOrden = new Map();
  const principalOrden = new Map();
  const consolidadoOrden = new Map();
  const resultOrden = new Map();
  const netOrden = new Map();
  const finalOrden = new Map();

  const configPorSeccion = new Map();
  if (Array.isArray(configAgrupacion)) {
    configAgrupacion.forEach((cfg) => {
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
        resultNetRow: cfg['result-net-row'] || '',
        clase: cfg.Clase || ''
      });

      if (!seccionOrden.has(seccion)) {
        seccionOrden.set(seccion, seccionOrden.size);
      }
      const principal = cfg['sum-row-sumavarios'];
      if (principal && !principalOrden.has(principal)) {
        principalOrden.set(principal, principalOrden.size);
      }
      const consolidado = cfg['sum-row-sumavarios-consolidado'];
      if (consolidado && !consolidadoOrden.has(consolidado)) {
        consolidadoOrden.set(consolidado, consolidadoOrden.size);
      }
      const resultRow = cfg['result-row'];
      if (resultRow && !resultOrden.has(resultRow)) {
        resultOrden.set(resultRow, resultOrden.size);
      }
      const netRow = cfg['net-row'];
      if (netRow && !netOrden.has(netRow)) {
        netOrden.set(netRow, netOrden.size);
      }
      const finalRow = cfg['result-net-row'];
      if (finalRow && !finalOrden.has(finalRow)) {
        finalOrden.set(finalRow, finalOrden.size);
      }
    });
  }

  definiciones.forEach((item) => {
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

    const principalLabel = config.principal || item['SECCIÓN Principal'] || 'GENERAL';
    if (principalLabel && !principalOrden.has(principalLabel)) {
      principalOrden.set(principalLabel, principalOrden.size);
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
        resultNetRow: config.resultNetRow || '',
        orden: principalOrden.has(principalLabel) ? principalOrden.get(principalLabel) : principalOrden.size + principalMap.size,
        secciones: new Map()
      });
    }

    const principalNode = principalMap.get(principalKey);
    const seccionKey = seccion || 'SIN SECCIÓN';
    if (!seccionOrden.has(seccionKey)) {
      seccionOrden.set(seccionKey, seccionOrden.size + 1);
    }
    if (!principalNode.secciones.has(seccionKey)) {
      principalNode.secciones.set(seccionKey, {
        label: seccionKey,
        cuentas: [],
        orden: seccionOrden.get(seccionKey)
      });
    }
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
      planeacionPrevio,
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
      resultNetRow: principal.resultNetRow || '',
      sign
    };
  }).sort((a, b) => a.orden - b.orden);

  const consolidatedMap = new Map();
  const resultRowMap = new Map();
  const netRowMap = new Map();
  const finalRowMap = new Map();

  const ensureAggregator = (mapa, etiqueta, ordenMapa) => {
    if (!etiqueta) return null;
    if (!mapa.has(etiqueta)) {
      mapa.set(etiqueta, {
        label: etiqueta,
        orden: ordenMapa.has(etiqueta) ? ordenMapa.get(etiqueta) : mapa.size + ordenMapa.size,
        totals: crearAcumulador(),
        principals: []
      });
    }
    return mapa.get(etiqueta);
  };

  principalList.forEach((principal) => {
    const consolidated = ensureAggregator(consolidatedMap, principal.consolidadoLabel || principal.label, consolidadoOrden);
    if (consolidated) {
      consolidated.principals.push(principal.label);
      sumarTotales(consolidated.totals, principal);
    }

    const resultRow = ensureAggregator(resultRowMap, principal.resultRow, resultOrden);
    if (resultRow) {
      sumarTotales(resultRow.totals, principal, principal.sign);
    }

    const netRow = ensureAggregator(netRowMap, principal.netRow, netOrden);
    if (netRow) {
      sumarTotales(netRow.totals, principal, principal.sign);
    }

    const finalRow = ensureAggregator(finalRowMap, principal.resultNetRow, finalOrden);
    if (finalRow) {
      sumarTotales(finalRow.totals, principal, principal.sign);
    }
  });

  let ordenGeneral = 0;
  const siguienteOrden = () => {
    ordenGeneral += 1;
    return ordenGeneral;
  };

  const layout = [];

  Array.from(consolidatedMap.values())
    .sort((a, b) => a.orden - b.orden)
    .forEach((grupo) => {
      layout.push({
        type: 'group',
        label: grupo.label,
        order: siguienteOrden(),
        totals: grupo.totals,
        principals: grupo.principals
      });
    });

  const agregarBloques = (mapa, tipo) => {
    Array.from(mapa.values())
      .sort((a, b) => a.orden - b.orden)
      .forEach((row) => {
        layout.push({
          type: tipo,
          label: row.label,
          order: siguienteOrden(),
          totals: row.totals
        });
      });
  };

  agregarBloques(resultRowMap, 'result');
  agregarBloques(netRowMap, 'net');
  agregarBloques(finalRowMap, 'final');

  return {
    principals: principalList,
    layout
  };
};


async function generarReporte(tipoReporte, empresaId, anio, mesSeleccionado, capituloSeleccionado) {
  const definiciones = cargarDefiniciones();
  
  // Mapeo: Si es RESUMEN, usar SUMMARY
  const tipoReal = (tipoReporte === 'RESUMEN') ? 'SUMMARY' : tipoReporte;
  
  const lista = definiciones[tipoReal];
  if (!Array.isArray(lista) || !lista.length) {
    throw new Error(`No hay definiciones para ${tipoReal}`);
  }

  const configAgrupacion = definiciones['SUMA DE VARIAS SECCIONES'] || [];

  const capitulosDisponibles = extraerCapitulos(lista);
  const capituloClave = NORMALIZAR_CAPITULO(capituloSeleccionado || capitulosDisponibles[0]?.etiqueta || '');
  const capituloEncontrado = capitulosDisponibles.find(({ clave }) => clave === capituloClave);
  
  // Filtrar definiciones por capítulo
  const listaFiltrada = capituloEncontrado
    ? lista.filter((item) => NORMALIZAR_CAPITULO(item.CAPITULO) === capituloClave)
    : lista;

  const cuentas = listaFiltrada.map((item) => NORMALIZAR_CLAVE(item.CUENTA)).filter(Boolean);
  const claveMes = normalizarClaveMes(mesSeleccionado) || obtenerMesActualClave();

  const [planeacionActual, planeacionPrevio] = await Promise.all([
    obtenerDatosPlaneacion({ empresaId, anio, cuentas }),
    obtenerDatosPlaneacion({ empresaId, anio: Number(anio) - 1, cuentas })
  ]);

  const { principals, layout } = construirReporteResumen(
    listaFiltrada, 
    configAgrupacion, 
    capituloEncontrado?.etiqueta || capituloSeleccionado, 
    claveMes, 
    planeacionActual, 
    planeacionPrevio
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
