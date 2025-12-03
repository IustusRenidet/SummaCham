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

const construirReporteResumen = (definiciones, configAgrupacion, capituloSeleccionado, claveMes, planeacionActual, planeacionPrevio) => {
  const definicionCuentas = new Map();
  // Mapa: Capitulo -> Operativo -> Principal -> Secundaria -> [Cuentas]
  const estructura = new Map();

  // 1. Indexar configuración de agrupación para búsqueda rápida
  // Clave: "CAPITULO|SECCION" -> { operativo, principal }
  const mapaConfig = new Map();
  if (Array.isArray(configAgrupacion)) {
    configAgrupacion.forEach((cfg) => {
      const cap = NORMALIZAR_CAPITULO(cfg.CAPITULO);
      const sec = (cfg.SECCION || '').trim();
      if (!cap || !sec) return;
      const key = `${cap}|${sec.toUpperCase()}`;
      mapaConfig.set(key, {
        operativo: cfg['sum-row-operativo'] || 'OTROS',
        principal: cfg['sum-row-sumavarios'] || cfg['SECCIÓN Principal'] || 'GENERAL'
      });
    });
  }

  // 2. Procesar definiciones de cuentas
  definiciones.forEach((item) => {
    const capitulo = item['SECCIÓN Principal'] || item['SECCION Principal'] || item['SECCION'] || item['SECCIÓN']; // Ojo: En el JSON 'CAPITULO' es la columna CAPITULO, pero aquí parece que se usaba diferente.
    // Corrección: Usar la columna CAPITULO del JSON
    const capReal = item.CAPITULO || capitulo;
    
    // Si no coincide con el capítulo seleccionado, saltar (aunque ya filtramos antes, doble check)
    if (NORMALIZAR_CAPITULO(capReal) !== NORMALIZAR_CAPITULO(capituloSeleccionado)) return;

    const seccion = item['SECCION Secundaria'] || item['Sección'] || item['SECCION'];
    const cuentaCanonica = normalizarCuentaCanonica(item.CUENTA);
    
    if (!capReal || !seccion || !cuentaCanonica) return;

    definicionCuentas.set(cuentaCanonica, {
      descripcion: item.NOMBRE || '',
      visible: item.CUENTA || cuentaVisibleDesdeCanonica(cuentaCanonica)
    });

    // Determinar jerarquía usando mapaConfig
    // La 'SECCION' en configAgrupacion parece corresponder a 'SECCION Secundaria' en DEFINICIONES (o una parte de ella)
    // En el JSON:
    // DEFINICIONES: CAPITULO="CIUDAD DE MÉXICO", SECCION Secundaria="Membership"
    // AGRUPACION: CAPITULO="CIUDAD DE MÉXICO", SECCION="Membership"
    
    const keyConfig = `${NORMALIZAR_CAPITULO(capReal)}|${seccion.trim().toUpperCase()}`;
    const config = mapaConfig.get(keyConfig) || { 
      operativo: 'SIN CLASIFICAR', 
      principal: item['SECCIÓN Principal'] || 'GENERAL' 
    };

    const nivelOperativo = config.operativo;
    const nivelPrincipal = config.principal;

    if (!estructura.has(nivelOperativo)) {
      estructura.set(nivelOperativo, new Map());
    }
    const mapaPrincipal = estructura.get(nivelOperativo);
    
    if (!mapaPrincipal.has(nivelPrincipal)) {
      mapaPrincipal.set(nivelPrincipal, new Map());
    }
    const mapaSecundario = mapaPrincipal.get(nivelPrincipal);

    if (!mapaSecundario.has(seccion)) {
      mapaSecundario.set(seccion, []);
    }
    mapaSecundario.get(seccion).push(cuentaCanonica);
  });

  const resumen = [];

  // 3. Construir árbol de resultados
  estructura.forEach((mapaPrincipal, keyOperativo) => {
    const childrenOperativo = [];

    mapaPrincipal.forEach((mapaSecundario, keyPrincipal) => {
      const childrenPrincipal = [];

      mapaSecundario.forEach((cuentas, keySecundaria) => {
        childrenPrincipal.push(construirNodoSeccion({ 
          seccion: keySecundaria, 
          cuentas, 
          definicion: definicionCuentas, 
          claveMes, 
          planeacionActual, 
          planeacionPrevio 
        }));
      });

      // Totales Nivel Principal
      const totalesPrincipal = childrenPrincipal.reduce(
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

      childrenOperativo.push({
        key: NORMALIZAR_CLAVE(keyPrincipal),
        label: keyPrincipal,
        children: childrenPrincipal,
        ...totalesPrincipal,
        total: totalesPrincipal.actualYTD
      });
    });

    // Totales Nivel Operativo
    const totalesOperativo = childrenOperativo.reduce(
      (acc, nodo) => ({
        actualMonth: acc.actualMonth + nodo.actualMonth,
        planMonth: acc.planMonth + nodo.planMonth,
        prevMonth: acc.prevMonth + nodo.prevMonth,
        actualYTD: acc.actualYTD + nodo.actualYTD,
        planYTD: acc.planYTD + nodo.planYTD,
        prevYTD: acc.prevYTD + nodo.prevYTD
      }),
      { actualMonth: 0, planMonth: 0, prevMonth: 0, actualYTD: 0, planYTD: 0, prevYTD: 0 }
    );

    resumen.push({
      key: NORMALIZAR_CLAVE(keyOperativo),
      label: keyOperativo,
      children: childrenOperativo,
      ...totalesOperativo,
      total: totalesOperativo.actualYTD
    });
  });

  return resumen;
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

  const resumen = construirReporteResumen(
    listaFiltrada, 
    configAgrupacion, 
    capituloEncontrado?.etiqueta || capituloSeleccionado, 
    claveMes, 
    planeacionActual, 
    planeacionPrevio
  );

  return {
    empresaId,
    reportKey: tipoReporte,
    anio,
    resumen,
    capituloSeleccionado: capituloEncontrado?.etiqueta || capitulosDisponibles[0]?.etiqueta || null,
    capitulosDisponibles
  };
}

module.exports = {
  generarReporte
};
