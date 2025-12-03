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

const construirNodoSeccion = ({ seccion, cuentas, definicion, claveMes, planeacionActual, planeacionPrevio }) => {
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

    return {
      cuenta: definicion.get(cuentaId)?.visible || cuentaId,
      descripcion: definicion.get(cuentaId)?.descripcion || '',
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
    totalActualMonth: totales.actualMonth,
    totalPlanMonth: totales.planMonth,
    totalPrevMonth: totales.prevMonth,
    totalActualYTD: totales.actualYTD,
    totalPlanYTD: totales.planYTD,
    totalPrevYTD: totales.prevYTD,
    total: totales.actualYTD
  };
};

const construirReporteResumen = (definiciones, claveMes, planeacionActual, planeacionPrevio) => {
  const definicionCuentas = new Map();
  const agrupado = new Map();

  definiciones.forEach((item) => {
    const capitulo = item['SECCIÓN Principal'] || item['SECCION Principal'] || item['SECCION'] || item['SECCIÓN'];
    const seccion = item['SECCION Secundaria'] || item['Sección'] || item['SECCION'];
    const cuentaCanonica = normalizarCuentaCanonica(item.CUENTA);
    if (!capitulo || !seccion || !cuentaCanonica) return;

    definicionCuentas.set(cuentaCanonica, {
      descripcion: item.NOMBRE || '',
      visible: item.CUENTA || cuentaVisibleDesdeCanonica(cuentaCanonica)
    });

    if (!agrupado.has(capitulo)) {
      agrupado.set(capitulo, new Map());
    }

    const secciones = agrupado.get(capitulo);
    if (!secciones.has(seccion)) {
      secciones.set(seccion, []);
    }
    secciones.get(seccion).push(cuentaCanonica);
  });

  const resumen = [];

  agrupado.forEach((secciones, capitulo) => {
    const children = [];

    secciones.forEach((cuentas, seccion) => {
      children.push(construirNodoSeccion({ seccion, cuentas, definicion: definicionCuentas, claveMes, planeacionActual, planeacionPrevio }));
    });

    const totalesCapitulo = children.reduce(
      (acc, nodo) => ({
        actualMonth: acc.actualMonth + nodo.totalActualMonth,
        planMonth: acc.planMonth + nodo.totalPlanMonth,
        prevMonth: acc.prevMonth + nodo.totalPrevMonth,
        actualYTD: acc.actualYTD + nodo.totalActualYTD,
        planYTD: acc.planYTD + nodo.totalPlanYTD,
        prevYTD: acc.prevYTD + nodo.totalPrevYTD
      }),
      { actualMonth: 0, planMonth: 0, prevMonth: 0, actualYTD: 0, planYTD: 0, prevYTD: 0 }
    );

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

  const resumen = construirReporteResumen(listaFiltrada, claveMes, planeacionActual, planeacionPrevio);

  return {
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
