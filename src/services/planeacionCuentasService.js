const { ejecutarConsulta } = require('./firebirdService');
const { obtenerSaldosPorCuentas, MESES } = require('./saldosService');

const nombreTabla = (prefijo, anio) => `${prefijo}${anio.toString().slice(-2).padStart(2, '0')}`;
const pad2 = (numero) => numero.toString().padStart(2, '0');
const toNumero = (valor) => {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
};

const mapearPresupuesto = (fila = {}) => {
  const salida = {
    cuenta: String(fila.NUM_CTA || '').trim()
  };
  MESES.forEach(({ alias }) => {
    salida[alias.toLowerCase()] = Number(fila[alias] ?? 0);
  });
  return salida;
};

async function obtenerPresupuestosPorCuentas(empresaId, anio, cuentas = []) {
  if (!cuentas.length) {
    return [];
  }

  const tabla = nombreTabla('PRESUP', anio);
  const columnasMes = MESES.map(({ alias, periodo }) => `COALESCE(p.PRESUP${pad2(periodo)}, 0) AS ${alias}`);
  const marcadores = cuentas.map(() => '?').join(',');
  const parametros = [Number(anio), ...cuentas];

  const sql = `
    SELECT
      p.NUM_CTA AS NUM_CTA,
      ${columnasMes.join(',\n      ')}
    FROM ${tabla} p
    WHERE p.EJERCICIO = ?
      AND p.NUM_CTA IN (${marcadores})
  `;

  const filas = await ejecutarConsulta(empresaId, sql, parametros);
  return filas.map(mapearPresupuesto);
}

async function obtenerCatalogoCuentasPresupuesto(empresaId, anio) {
  const tabla = nombreTabla('CUENTAS', anio);
  // Solo cuentas 400-950 (presupuesto). Evita descargar todo el catálogo.
  const sql = `
    SELECT NUM_CTA, CTA_PAPA, NIVEL, TIPO
    FROM ${tabla}
    WHERE STATUS = 'A'
      AND SUBSTRING(NUM_CTA FROM 1 FOR 3) BETWEEN '400' AND '950'
  `;
  const filas = await ejecutarConsulta(empresaId, sql, []);
  return (filas || []).map((fila) => ({
    numCta: String(fila.NUM_CTA || '').trim(),
    papa: String(fila.CTA_PAPA || '').trim(),
    nivel: Number(fila.NIVEL) || 0,
    tipo: String(fila.TIPO || '').trim().toUpperCase()
  })).filter((fila) => fila.numCta);
}

const sumarArreglos = (destino, origen) => {
  for (let i = 0; i < destino.length; i += 1) {
    destino[i] += toNumero(origen[i]);
  }
};

const construirArrayMeses = (obj = {}) => {
  return MESES.map(({ clave }) => toNumero(obj[clave]));
};

const construirSalidaMeses = (arr = []) => {
  const salida = {};
  MESES.forEach(({ clave }, idx) => {
    salida[clave] = toNumero(arr[idx]);
  });
  return salida;
};

const construirArrayAcumulados = (obj = {}) => {
  return MESES.map(({ clave }) => toNumero(obj[`${clave}_acum`] ?? obj[clave]));
};

const construirSalidaAcumulados = (arrMes = [], arrAcum = []) => {
  const salida = {};
  MESES.forEach(({ clave }, idx) => {
    salida[clave] = toNumero(arrMes[idx]);
    salida[`${clave}_acum`] = toNumero(arrAcum[idx]);
  });
  return salida;
};

const calcularAgregados = ({ cuentasCatalogo, presupuestoMap, realMap }) => {
  const cuentasSet = new Set(cuentasCatalogo.map((c) => c.numCta));
  const hijosPorPadre = new Map();

  cuentasCatalogo.forEach((cuenta) => {
    if (!cuenta.papa || !cuentasSet.has(cuenta.papa)) return;
    const lista = hijosPorPadre.get(cuenta.papa) || [];
    lista.push(cuenta.numCta);
    hijosPorPadre.set(cuenta.papa, lista);
  });

  const orden = [...cuentasCatalogo].sort((a, b) => (b.nivel || 0) - (a.nivel || 0));
  const aggPres = new Map();
  const aggRealMes = new Map();
  const aggRealAcum = new Map();

  orden.forEach((cuenta) => {
    const hijos = hijosPorPadre.get(cuenta.numCta) || [];
    if (!hijos.length) {
      aggPres.set(cuenta.numCta, presupuestoMap.get(cuenta.numCta) || Array.from({ length: 12 }, () => 0));
      aggRealMes.set(cuenta.numCta, realMap.get(cuenta.numCta)?.mes || Array.from({ length: 12 }, () => 0));
      aggRealAcum.set(cuenta.numCta, realMap.get(cuenta.numCta)?.acum || Array.from({ length: 12 }, () => 0));
      return;
    }

    const sumPres = Array.from({ length: 12 }, () => 0);
    const sumRealMes = Array.from({ length: 12 }, () => 0);
    const sumRealAcum = Array.from({ length: 12 }, () => 0);

    hijos.forEach((hijo) => {
      const p = aggPres.get(hijo) || presupuestoMap.get(hijo) || Array.from({ length: 12 }, () => 0);
      sumarArreglos(sumPres, p);

      const rMes = aggRealMes.get(hijo) || realMap.get(hijo)?.mes || Array.from({ length: 12 }, () => 0);
      const rAcum = aggRealAcum.get(hijo) || realMap.get(hijo)?.acum || Array.from({ length: 12 }, () => 0);
      sumarArreglos(sumRealMes, rMes);
      sumarArreglos(sumRealAcum, rAcum);
    });

    aggPres.set(cuenta.numCta, sumPres);
    aggRealMes.set(cuenta.numCta, sumRealMes);
    aggRealAcum.set(cuenta.numCta, sumRealAcum);
  });

  return { hijosPorPadre, aggPres, aggRealMes, aggRealAcum };
};

const limpiarCuentaBase = (valor = '') => valor.toString().replace(/[^0-9A-Za-z]/g, '').toUpperCase();

const deducirNivel = (base) => {
  const limpio = base.padEnd(11, '0').slice(0, 11);
  const b = limpio.slice(3, 6);
  const c = limpio.slice(6, 9);
  const d = limpio.slice(9, 11);
  if (b === '000' && c === '000' && d === '00') return '1';
  if (c === '000' && d === '00') return '2';
  if (d === '00') return '3';
  return '4';
};

const formatearCuentaAspel = (valor) => {
  const limpio = limpiarCuentaBase(valor);
  if (!limpio) {
    return '';
  }
  if (limpio.length >= 21) {
    const cuenta = limpio.slice(0, 21);
    const last = cuenta.slice(-1);
    const digitsOnly = /^\d+$/.test(cuenta);
    if (digitsOnly && !['1', '2', '3', '4'].includes(last)) {
      const base = cuenta.slice(0, 11).padEnd(11, '0');
      const nivel = deducirNivel(base);
      return base.padEnd(20, '0') + nivel;
    }
    return cuenta;
  }
  const base = limpio.slice(0, 11).padEnd(11, '0');
  const nivel = deducirNivel(base);
  return base.padEnd(20, '0') + nivel;
};

const normalizarListaCuentas = (cuentas) => {
  const lista = Array.isArray(cuentas) ? cuentas : [];
  const unico = new Set();
  lista.forEach((cuenta) => {
    const formateada = formatearCuentaAspel(cuenta);
    if (formateada) {
      unico.add(formateada);
    }
  });
  return Array.from(unico);
};

async function obtenerDatosPlaneacion({ empresaId, anio, cuentas = [] }) {
  const lista = normalizarListaCuentas(cuentas);
  if (!empresaId || !lista.length) {
    return [];
  }

  // Recontabilizar (en lectura) los padres a partir de sus hijas:
  // 1) Cargar el catalogo de cuentas (400-950) para conocer jerarquias.
  // 2) Expandir la consulta para incluir descendientes y poder sumar correctamente.
  const catalogo = await obtenerCatalogoCuentasPresupuesto(empresaId, anio);
  const catalogoMap = new Map(catalogo.map((c) => [c.numCta, c]));
  const hijosPorPadre = new Map();
  catalogo.forEach((cuenta) => {
    if (!cuenta.papa || !catalogoMap.has(cuenta.papa)) return;
    const listaHijos = hijosPorPadre.get(cuenta.papa) || [];
    listaHijos.push(cuenta.numCta);
    hijosPorPadre.set(cuenta.papa, listaHijos);
  });

  const expandir = (cuentasBase = []) => {
    const requeridas = new Set();
    const stack = [...cuentasBase];
    while (stack.length) {
      const actual = stack.pop();
      if (!actual || requeridas.has(actual)) continue;
      requeridas.add(actual);
      const hijos = hijosPorPadre.get(actual) || [];
      hijos.forEach((h) => stack.push(h));
    }
    return Array.from(requeridas);
  };

  const cuentasNecesarias = catalogo.length ? expandir(lista) : lista;

  const [presupuestos, saldos] = await Promise.all([
    obtenerPresupuestosPorCuentas(empresaId, anio, cuentasNecesarias),
    obtenerSaldosPorCuentas(empresaId, anio, cuentasNecesarias)
  ]);

  const mapaPresupuesto = new Map(presupuestos.map((registro) => [registro.cuenta, registro]));
  const mapaSaldos = new Map(saldos.map((registro) => [registro.numCta, registro]));

  const presupuestoMapArr = new Map();
  cuentasNecesarias.forEach((cuenta) => {
    presupuestoMapArr.set(cuenta, construirArrayMeses(mapaPresupuesto.get(cuenta) || {}));
  });

  const realMapArr = new Map();
  cuentasNecesarias.forEach((cuenta) => {
    const real = mapaSaldos.get(cuenta) || {};
    realMapArr.set(cuenta, {
      mes: construirArrayMeses(real),
      acum: construirArrayAcumulados(real),
      ajuste14: toNumero(real.ajuste14)
    });
  });

  const { aggPres, aggRealMes, aggRealAcum } = catalogo.length
    ? calcularAgregados({ cuentasCatalogo: catalogo, presupuestoMap: presupuestoMapArr, realMap: realMapArr })
    : { aggPres: presupuestoMapArr, aggRealMes: new Map(), aggRealAcum: new Map() };

  return lista.map((cuenta) => {
    const datosPresupuesto = construirSalidaMeses(aggPres.get(cuenta) || construirArrayMeses(mapaPresupuesto.get(cuenta) || {}));
    const realMes = aggRealMes.get(cuenta) || construirArrayMeses(mapaSaldos.get(cuenta) || {});
    const realAcum = aggRealAcum.get(cuenta) || construirArrayAcumulados(mapaSaldos.get(cuenta) || {});
    const datosReal = construirSalidaAcumulados(realMes, realAcum);

    const ajuste14 = toNumero(mapaSaldos.get(cuenta)?.ajuste14);
    datosReal.ajuste14 = ajuste14;
    const dicAcum = toNumero(datosReal.dic_acum ?? datosReal.dic);
    datosReal.dic_acum = dicAcum;
    datosReal.dic = toNumero(datosReal.dic ?? dicAcum);

    return {
      cuenta,
      presupuesto: datosPresupuesto,
      real: datosReal,
      ajuste14
    };
  });
}

module.exports = {
  obtenerDatosPlaneacion
};
