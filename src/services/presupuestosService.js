const { ejecutarConsulta } = require('./firebirdService');
const { listarAniosPresupuestos } = require('./presupuestosMetadataService');

const PERIODOS = Array.from({ length: 12 }, (_, indice) => indice + 1);

const MESES = [
  { periodo: 1, alias: 'ENE', clave: 'ene' },
  { periodo: 2, alias: 'FEB', clave: 'feb' },
  { periodo: 3, alias: 'MAR', clave: 'mar' },
  { periodo: 4, alias: 'ABR', clave: 'abr' },
  { periodo: 5, alias: 'MAY', clave: 'may' },
  { periodo: 6, alias: 'JUN', clave: 'jun' },
  { periodo: 7, alias: 'JUL', clave: 'jul' },
  { periodo: 8, alias: 'AGO', clave: 'ago' },
  { periodo: 9, alias: 'SEP', clave: 'sep' },
  { periodo: 10, alias: 'OCT', clave: 'oct' },
  { periodo: 11, alias: 'NOV', clave: 'nov' },
  { periodo: 12, alias: 'DIC', clave: 'dic' }
];

const formatearPeriodo = (valor) => valor.toString().padStart(2, '0');

const construirNombreTabla = (prefijo, anio) => {
  const sufijo = anio.toString().slice(-2).padStart(2, '0');
  return `${prefijo}${sufijo}`;
};

const mapearRegistro = (registro) => {
  const presupuestoMensual = {};
  const realMensual = {};
  let acumuladoPresupuesto = 0;

  const datos = {
    numCta: registro.CUENTA,
    descripcion: registro.DESCRIPCION,
    naturaleza: registro.NATURALEZA || ''
  };

  MESES.forEach(({ clave, periodo }) => {
    const sufijo = formatearPeriodo(periodo);
    const valorPresupuesto = Number(registro[`PRESUP${sufijo}`] ?? 0);
    const valorReal = Number(registro[`REAL${sufijo}`] ?? 0);

    presupuestoMensual[clave] = valorPresupuesto;
    realMensual[clave] = valorReal;

    datos[`presup${sufijo}`] = valorPresupuesto;
    datos[`real${sufijo}`] = valorReal;

    datos[clave] = valorPresupuesto;
    acumuladoPresupuesto += valorPresupuesto;
  });

  datos.presupuesto = presupuestoMensual;
  datos.real = realMensual;
  datos.anual = acumuladoPresupuesto;

  return datos;
};

const normalizarCuenta = (valor) => (valor == null ? '' : String(valor).trim());

const sumarArreglos = (destino, origen) => {
  for (let i = 0; i < destino.length; i += 1) {
    destino[i] += Number(origen[i] || 0);
  }
};

const construirSalidaCuenta = (base, presupuestosArr, realesArr) => {
  const presupuestoMensual = {};
  const realMensual = {};
  let acumuladoPresupuesto = 0;

  const datos = {
    numCta: base.numCta,
    descripcion: base.descripcion,
    naturaleza: base.naturaleza || '',
  };

  MESES.forEach(({ clave, periodo }) => {
    const idx = periodo - 1;
    const sufijo = formatearPeriodo(periodo);
    const valorPresupuesto = Number(presupuestosArr[idx] || 0);
    const valorReal = Number(realesArr[idx] || 0);

    presupuestoMensual[clave] = valorPresupuesto;
    realMensual[clave] = valorReal;

    datos[`presup${sufijo}`] = valorPresupuesto;
    datos[`real${sufijo}`] = valorReal;
    datos[clave] = valorPresupuesto;
    acumuladoPresupuesto += valorPresupuesto;
  });

  datos.presupuesto = presupuestoMensual;
  datos.real = realMensual;
  datos.anual = acumuladoPresupuesto;
  return datos;
};

const obtenerPresupuestosMayor = async (empresaId, anio) => {
  if (!empresaId) {
    throw new Error('La empresa es obligatoria.');
  }
  const ejercicio = Number(anio);
  if (!Number.isInteger(ejercicio) || ejercicio < 2000 || ejercicio > 2100) {
    throw new Error('El ejercicio indicado no es valido.');
  }

  const tablaCuentas = construirNombreTabla('CUENTAS', ejercicio);
  const tablaPresupuesto = construirNombreTabla('PRESUP', ejercicio);
  const tablaSaldos = construirNombreTabla('SALDOS', ejercicio);

  const columnasPresupuesto = MESES.map(({ periodo }) => {
    const sufijo = formatearPeriodo(periodo);
    return `COALESCE(p.PRESUP${sufijo}, 0) AS PRESUP${sufijo}`;
  });

  const columnasReal = MESES.map(({ periodo }) => {
    const sufijo = formatearPeriodo(periodo);
    // Real mensual = CARGO del mes - ABONO del mes (no acumulado)
    return `(COALESCE(s.CARGO${sufijo}, 0) - COALESCE(s.ABONO${sufijo}, 0)) AS REAL${sufijo}`;
  });

  const consulta = `
    SELECT
      c.NUM_CTA AS CUENTA,
      c.NOMBRE AS DESCRIPCION,
      c.NATURALEZA,
      c.NIVEL,
      c.TIPO,
      c.CTA_PAPA,
      ${[...columnasPresupuesto, ...columnasReal].join(',\n      ')}
    FROM ${tablaCuentas} c
    LEFT JOIN ${tablaPresupuesto} p
      ON p.NUM_CTA = c.NUM_CTA
     AND p.EJERCICIO = ?
    LEFT JOIN ${tablaSaldos} s
      ON s.NUM_CTA = c.NUM_CTA
     AND s.EJERCICIO = ?
    WHERE c.STATUS = 'A'
      AND SUBSTRING(c.NUM_CTA FROM 1 FOR 3) BETWEEN '400' AND '950'
    ORDER BY c.NUM_CTA
  `;

  const resultados = await ejecutarConsulta(empresaId, consulta, [ejercicio, ejercicio]);
  const mapa = new Map();
  const hijosPorPadre = new Map();

  resultados.forEach((registro) => {
    const numCta = normalizarCuenta(registro.CUENTA);
    if (!numCta) return;
    const base = {
      numCta,
      descripcion: registro.DESCRIPCION,
      naturaleza: registro.NATURALEZA || '',
      nivel: Number(registro.NIVEL),
      tipo: normalizarCuenta(registro.TIPO),
      papa: normalizarCuenta(registro.CTA_PAPA)
    };

    const presupArr = Array.from({ length: 12 }, (_, idx) => {
      const sufijo = formatearPeriodo(idx + 1);
      return Number(registro[`PRESUP${sufijo}`] ?? 0);
    });
    const realArr = Array.from({ length: 12 }, (_, idx) => {
      const sufijo = formatearPeriodo(idx + 1);
      return Number(registro[`REAL${sufijo}`] ?? 0);
    });

    mapa.set(numCta, { base, presupArr, realArr });
  });

  // Construir relaciones padre -> hijos solo si el padre existe en el set consultado.
  for (const [numCta, entry] of mapa.entries()) {
    const papa = entry.base.papa;
    if (!papa || !mapa.has(papa)) continue;
    const lista = hijosPorPadre.get(papa) || [];
    lista.push(numCta);
    hijosPorPadre.set(papa, lista);
  }

  const memo = new Map();
  const enProceso = new Set();
  const resolverAgregado = (numCta) => {
    if (memo.has(numCta)) return memo.get(numCta);
    if (enProceso.has(numCta)) {
      const vacio = {
        presupArr: Array.from({ length: 12 }, () => 0),
        realArr: Array.from({ length: 12 }, () => 0),
      };
      memo.set(numCta, vacio);
      return vacio;
    }
    enProceso.add(numCta);

    const actual = mapa.get(numCta);
    const hijos = hijosPorPadre.get(numCta) || [];
    const presupArr = Array.from({ length: 12 }, () => 0);
    const realArr = Array.from({ length: 12 }, () => 0);

    if (hijos.length) {
      hijos.forEach((hijo) => {
        const agregadoHijo = resolverAgregado(hijo);
        sumarArreglos(presupArr, agregadoHijo.presupArr);
        sumarArreglos(realArr, agregadoHijo.realArr);
      });
    } else if (actual) {
      sumarArreglos(presupArr, actual.presupArr);
      sumarArreglos(realArr, actual.realArr);
    }

    const resultado = { presupArr, realArr };
    memo.set(numCta, resultado);
    enProceso.delete(numCta);
    return resultado;
  };

  // Solo devolver cuentas de mayor: NIVEL 1 y TIPO A, pero con valores recalculados.
  const salida = [];
  for (const [numCta, entry] of mapa.entries()) {
    if (entry.base.tipo !== 'A') continue;
    if (entry.base.nivel !== 1) continue;
    const agregado = resolverAgregado(numCta);
    salida.push(construirSalidaCuenta(entry.base, agregado.presupArr, agregado.realArr));
  }

  // Mantener orden por cuenta.
  salida.sort((a, b) => normalizarCuenta(a.numCta).localeCompare(normalizarCuenta(b.numCta)));
  return salida;
};

/**
 * Obtiene los totales de presupuesto mensual sumando cuentas específicas de PRESUP
 * Usado para consolidación de capítulos en CDMX
 * 
 * @param {string} empresaId - ID de la empresa (empresa2, empresa3, empresa4)
 * @param {number} anio - Año del presupuesto
 * @returns {Promise<{income: Object, expense: Object}>} Totales mensuales
 */
const obtenerTotalesPresupuestoCapitulo = async (empresaId, anio) => {
  if (!empresaId) {
    throw new Error('La empresa es obligatoria.');
  }
  const ejercicio = Number(anio);
  if (!Number.isInteger(ejercicio) || ejercicio < 2000 || ejercicio > 2100) {
    throw new Error('El ejercicio indicado no es valido.');
  }

  const tablaPresupuesto = construirNombreTabla('PRESUP', ejercicio);
  const tablaCuentas = construirNombreTabla('CUENTAS', ejercicio);

  // Consultar todas las cuentas 400-950
  const consulta = `
    SELECT
      c.NUM_CTA AS CUENTA,
      ${MESES.map(({ periodo }) => {
        const sufijo = formatearPeriodo(periodo);
        return `COALESCE(p.PRESUP${sufijo}, 0) AS PRESUP${sufijo}`;
      }).join(',\n      ')}
    FROM ${tablaCuentas} c
    LEFT JOIN ${tablaPresupuesto} p
      ON p.NUM_CTA = c.NUM_CTA
     AND p.EJERCICIO = ?
    WHERE c.STATUS = 'A'
      AND c.TIPO = 'D'
      AND SUBSTRING(c.NUM_CTA FROM 1 FOR 3) BETWEEN '400' AND '950'
  `;

  const resultados = await ejecutarConsulta(empresaId, consulta, [ejercicio]);

  // Inicializar acumuladores
  const income = {};
  const expense = {};
  MESES.forEach(({ clave }) => {
    income[clave] = 0;
    expense[clave] = 0;
  });

  // Sumar por rango de cuentas
  resultados.forEach((registro) => {
    const cuenta = registro.CUENTA || '';
    const prefijo = parseInt(cuenta.substring(0, 3), 10);
    
    if (isNaN(prefijo)) return;

    MESES.forEach(({ clave, periodo }) => {
      const sufijo = formatearPeriodo(periodo);
      const valor = Number(registro[`PRESUP${sufijo}`] || 0);

      if (prefijo >= 400 && prefijo <= 450) {
        // INCOME: cuentas 400-450
        income[clave] += valor;
      } else if (prefijo >= 451 && prefijo <= 950) {
        // EXPENSE: cuentas 451-950
        expense[clave] += valor;
      }
    });
  });

  return { income, expense };
};

module.exports = {
  obtenerPresupuestosMayor,
  obtenerTotalesPresupuestoCapitulo,
  listarAniosPresupuestos,
  PERIODOS
};
