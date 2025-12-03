const path = require('path');
const fs = require('fs');
const { obtenerDatosPlaneacion } = require('../planeacionCuentasService');
const { MESES } = require('../saldosService');

const DEFAULT_BASE_PATH = path.join(__dirname, '..', '..', '..', 'info IMPORTANTE');
const DEFINICIONES_FILE = path.join(DEFAULT_BASE_PATH, 'CUENTAS SUMMARY y RESUMEN.json');

const NORMALIZAR_CLAVE = (valor = '') => valor.toString().trim().toUpperCase();
const NORMALIZAR_CAPITULO = (valor = '') => valor.toString().trim().toUpperCase();

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
  const acumulados = {
    actualMonth: 0,
    planMonth: 0,
    prevMonth: 0,
    actualYTD: 0,
    planYTD: 0,
    prevYTD: 0
  };
};

  const sumaHastaMes = (registro, incluirPrevio) => {
    let total = 0;
    for (const { clave } of MESES) {
      total += Number(registro?.presupuesto?.[clave] ?? 0);
      if (clave === claveMes) break;
    }
    if (incluirPrevio) return total;
    return total;
  };

  const claveAcum = `${claveMes}_acum`;

  cuentas.forEach((cuenta) => {
    const actual = planeacionActual.find((p) => p.cuenta === cuenta);
    const previo = planeacionPrevio.find((p) => p.cuenta === cuenta);

    acumulados.actualMonth += Number(actual?.real?.[claveMes] ?? 0);
    acumulados.planMonth += Number(actual?.presupuesto?.[claveMes] ?? 0);
    acumulados.prevMonth += Number(previo?.real?.[claveMes] ?? 0);

    acumulados.actualYTD += Number(actual?.real?.[claveAcum] ?? 0);
    acumulados.planYTD += sumaHastaMes(actual, false);
    acumulados.prevYTD += Number(previo?.real?.[claveAcum] ?? 0);
  });

  return acumulados;
};

const construirNodoSeccion = ({ seccion, cuentas, definicion, claveMes, planeacionActual, planeacionPrevio }) => {
  const totales = calcularTotales(cuentas, claveMes, planeacionActual, planeacionPrevio);
  return {
    label: seccion,
    cuentas: cuentas.map((cuentaId) => {
      const actual = planeacionActual.find((p) => p.cuenta === cuentaId) || {};
      const previo = planeacionPrevio.find((p) => p.cuenta === cuentaId) || {};
      return {
        cuenta: cuentaId,
        descripcion: definicion.get(cuentaId)?.descripcion || '',
        actualMonth: Number(actual.real?.[claveMes] ?? 0),
        planMonth: Number(actual.presupuesto?.[claveMes] ?? 0),
        prevMonth: Number(previo.real?.[claveMes] ?? 0),
        actualYTD: Number(actual.real?.[`${claveMes}_acum`] ?? 0),
        planYTD: MESES.reduce((acc, { clave }) => {
          if (acc.detener) return acc;
          const nuevo = acc.total + Number(actual.presupuesto?.[clave] ?? 0);
          if (clave === claveMes) return { total: nuevo, detener: true };
          return { total: nuevo, detener: false };
        }, { total: 0, detener: false }).total,
        prevYTD: Number(previo.real?.[`${claveMes}_acum`] ?? 0)
      };
    }),
    totalActualMonth: totales.actualMonth,
    totalPlanMonth: totales.planMonth,
    totalPrevMonth: totales.prevMonth,
    totalActualYTD: totales.actualYTD,
    totalPlanYTD: totales.planYTD,
    totalPrevYTD: totales.prevYTD,
    total: totales.actualYTD
  };
};

const construirReporte = (definiciones, claveMes, planeacionActual, planeacionPrevio) => {
  const definicionCuentas = new Map();
  const agrupado = new Map();

  definiciones.forEach((item) => {
    const capitulo = item['SECCIÓN Principal'] || item['SECCION Principal'] || item['SECCION'] || item['SECCIÓN'];
    const seccion = item['SECCION Secundaria'] || item['Sección'] || item['SECCION'];
    const cuenta = NORMALIZAR_CLAVE(item.CUENTA);
    if (!capitulo || !seccion || !cuenta) return;

    definicionCuentas.set(cuenta, { descripcion: item.NOMBRE || '' });
    if (!agrupado.has(capitulo)) {
      agrupado.set(capitulo, new Map());
    }
    const secciones = agrupado.get(capitulo);
    if (!secciones.has(seccion)) {
      secciones.set(seccion, []);
    }
    secciones.get(seccion).push(cuenta);
  });

  const resumen = [];

  agrupado.forEach((secciones, capitulo) => {
    const children = [];
    secciones.forEach((cuentas, seccion) => {
      children.push(construirNodoSeccion({ seccion, cuentas, definicion: definicionCuentas, claveMes, planeacionActual, planeacionPrevio }));
    });

    const totalesCapitulo = children.reduce((acc, nodo) => {
      acc.actualMonth += nodo.totalActualMonth;
      acc.planMonth += nodo.totalPlanMonth;
      acc.prevMonth += nodo.totalPrevMonth;
      acc.actualYTD += nodo.totalActualYTD;
      acc.planYTD += nodo.totalPlanYTD;
      acc.prevYTD += nodo.totalPrevYTD;
      return acc;
    }, { actualMonth: 0, planMonth: 0, prevMonth: 0, actualYTD: 0, planYTD: 0, prevYTD: 0 });

    resumen.push({
      key: NORMALIZAR_CLAVE(capitulo),
      label: capitulo,
      children,
      totalActualMonth: totalesCapitulo.actualMonth,
      totalPlanMonth: totalesCapitulo.planMonth,
      totalPrevMonth: totalesCapitulo.prevMonth,
      totalActualYTD: totalesCapitulo.actualYTD,
      totalPlanYTD: totalesCapitulo.planYTD,
      totalPrevYTD: totalesCapitulo.prevYTD,
      total: totalesCapitulo.actualYTD
    });
  });

  return resumen;
};

async function generarReporte(tipoReporte, empresaId, anio, mesSeleccionado, capituloSeleccionado) {
  const definiciones = cargarDefiniciones();
  const lista = definiciones[tipoReporte];
  if (!Array.isArray(lista) || !lista.length) {
    throw new Error(`No hay definiciones para ${tipoReporte}`);
  }

  const capitulosDisponibles = extraerCapitulos(lista);
  const capituloClave = NORMALIZAR_CAPITULO(capituloSeleccionado || capitulosDisponibles[0]?.etiqueta || '');
  const capituloEncontrado = capitulosDisponibles.find(({ clave }) => clave === capituloClave);
  const listaFiltrada = capituloEncontrado
    ? lista.filter((item) => NORMALIZAR_CAPITULO(item.CAPITULO) === capituloClave)
    : lista;

  const cuentas = listaFiltrada.map((item) => NORMALIZAR_CLAVE(item.CUENTA)).filter(Boolean);
  const claveMes = normalizarClaveMes(mesSeleccionado) || obtenerMesActualClave();

  const [planeacionActual, planeacionPrevio] = await Promise.all([
    obtenerDatosPlaneacion({ empresaId, anio, cuentas }),
    obtenerDatosPlaneacion({ empresaId, anio: Number(anio) - 1, cuentas })
  ]);

  const resumen = construirReporte(listaFiltrada, claveMes, planeacionActual, planeacionPrevio);
  const payload = {
    empresaId,
    reportKey: tipoReporte,
    anio,
    resumen,
    capituloSeleccionado: capituloEncontrado?.etiqueta || capitulosDisponibles[0]?.etiqueta || null,
    capitulosDisponibles
  };

  return payload;
}

module.exports = {
  generarReporte
};
