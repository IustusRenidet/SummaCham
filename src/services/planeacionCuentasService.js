const { ejecutarConsulta } = require('./firebirdService');
const { obtenerSaldosPorCuentas, MESES } = require('./saldosService');

const nombreTabla = (prefijo, anio) => `${prefijo}${anio.toString().slice(-2).padStart(2, '0')}`;
const pad2 = (numero) => numero.toString().padStart(2, '0');

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

// COI trabaja NUM_CTA numérico; conservar letras puede romper el match exacto.
const limpiarCuentaBase = (valor = '') => valor.toString().replace(/[^0-9]/g, '');

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
    // Respetar cuenta COI completa para no alterar niveles auxiliares válidos.
    return limpio.slice(0, 21);
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

  const [presupuestos, saldos] = await Promise.all([
    obtenerPresupuestosPorCuentas(empresaId, anio, lista),
    obtenerSaldosPorCuentas(empresaId, anio, lista)
  ]);

  const mapaPresupuesto = new Map(presupuestos.map((registro) => [registro.cuenta, registro]));
  const mapaSaldos = new Map(saldos.map((registro) => [registro.numCta, registro]));

  return lista.map((cuenta) => {
    const presupuesto = mapaPresupuesto.get(cuenta) || {};
    const real = mapaSaldos.get(cuenta) || {};
    const datosPresupuesto = {};
    const datosReal = {};

    MESES.forEach(({ clave }) => {
      datosPresupuesto[clave] = Number(presupuesto[clave] ?? 0);
      const valorMes = Number(real[clave] ?? 0);
      const acumuladoMes = Number(real[`${clave}_acum`] ?? valorMes);
      datosReal[clave] = valorMes;
      datosReal[`${clave}_acum`] = acumuladoMes;
    });
    datosReal.ajuste14 = Number(real.ajuste14 ?? 0);
    const dicAcum = Number(real.dic_acum ?? real.dic ?? 0);
    datosReal.dic_acum = dicAcum;
    datosReal.dic = Number(real.dic ?? dicAcum);

    return {
      cuenta,
      presupuesto: datosPresupuesto,
      real: datosReal,
      ajuste14: Number(real.ajuste14 ?? 0)
    };
  });
}

const sumarColumnas = (prefijo, hasta) => {
  const limite = Math.max(1, Math.min(12, Number(hasta) || 1));
  const partes = [];
  for (let i = 1; i <= limite; i += 1) {
    partes.push(`COALESCE(${prefijo}${pad2(i)}, 0)`);
  }
  return partes.join(' + ');
};

const normalizarPeriodo = (valor) => {
  const numero = Number(valor);
  if (Number.isInteger(numero) && numero >= 1 && numero <= 12) {
    return numero;
  }
  return Math.min(Math.max(new Date().getMonth() + 1, 1), 12);
};

async function obtenerDatosPlaneacionResumen({ empresaId, anio, mes, cuentas = [] }) {
  const lista = normalizarListaCuentas(cuentas);
  if (!empresaId || !lista.length) {
    return [];
  }

  const ejercicio = Number(anio);
  if (!Number.isInteger(ejercicio)) {
    throw new Error('Ejercicio inválido');
  }
  const periodo = normalizarPeriodo(mes);
  const periodoTxt = pad2(periodo);
  const ejercicioPrevio = ejercicio - 1;

  const tCtas = nombreTabla('CUENTAS', ejercicio);
  const tSal = nombreTabla('SALDOS', ejercicio);
  const tSalPrev = nombreTabla('SALDOS', ejercicioPrevio);
  const tPres = nombreTabla('PRESUP', ejercicio);

  const cargoMes = `COALESCE(s.CARGO${periodoTxt}, 0)`;
  const abonoMes = `COALESCE(s.ABONO${periodoTxt}, 0)`;
  const cargosAcum = sumarColumnas('s.CARGO', periodo);
  const abonosAcum = sumarColumnas('s.ABONO', periodo);

  const cargoMesAnt = `COALESCE(sa.CARGO${periodoTxt}, 0)`;
  const abonoMesAnt = `COALESCE(sa.ABONO${periodoTxt}, 0)`;
  const cargosAcumAnt = sumarColumnas('sa.CARGO', periodo);
  const abonosAcumAnt = sumarColumnas('sa.ABONO', periodo);

  const presupMes = `COALESCE(pr.PRESUP${periodoTxt}, 0)`;
  const presupAcum = sumarColumnas('pr.PRESUP', periodo);

  const marcadores = lista.map(() => '?').join(',');
  const params = [ejercicio, ejercicioPrevio, ejercicio, ...lista];

  const natz = `
    CASE
      WHEN c.NUM_CTA STARTING WITH '1' THEN 'D'
      WHEN c.NUM_CTA STARTING WITH '2' THEN 'A'
      WHEN c.NUM_CTA STARTING WITH '3' THEN 'A'
      WHEN c.NUM_CTA STARTING WITH '4' THEN 'A'
      WHEN c.NUM_CTA STARTING WITH '5' THEN 'D'
      WHEN c.NUM_CTA STARTING WITH '6' THEN 'D'
      WHEN c.NUM_CTA STARTING WITH '7' THEN 'D'
      WHEN c.NUM_CTA STARTING WITH '8' THEN 'D'
      WHEN c.NUM_CTA STARTING WITH '9' THEN 'D'
      ELSE CASE
        WHEN UPPER(CAST(c.NATURALEZA AS VARCHAR(5))) IN ('A','2','C') THEN 'A'
        ELSE 'D'
      END
    END
  `;

  const sql = `
    WITH base AS (
      SELECT
        c.NUM_CTA AS NUM_CTA,
        c.NOMBRE AS NOMBRE,
        c.NIVEL AS NIVEL,
        ${natz} AS NATZ,
        ${cargoMes} AS CARGO_MES,
        ${abonoMes} AS ABONO_MES,
        ${cargosAcum} AS CARGOS_ACUM,
        ${abonosAcum} AS ABONOS_ACUM,
        ${cargoMesAnt} AS CARGO_MES_ANT,
        ${abonoMesAnt} AS ABONO_MES_ANT,
        ${cargosAcumAnt} AS CARGOS_ACUM_ANT,
        ${abonosAcumAnt} AS ABONOS_ACUM_ANT,
        ${presupMes} AS PRESUP_MES,
        ${presupAcum} AS PRESUP_ACUM
      FROM ${tCtas} c
      LEFT JOIN ${tSal} s
        ON s.NUM_CTA = c.NUM_CTA
       AND s.EJERCICIO = ?
      LEFT JOIN ${tSalPrev} sa
        ON sa.NUM_CTA = c.NUM_CTA
       AND sa.EJERCICIO = ?
      LEFT JOIN ${tPres} pr
        ON pr.NUM_CTA = c.NUM_CTA
       AND pr.EJERCICIO = ?
      WHERE c.STATUS = 'A'
        AND c.NUM_CTA IN (${marcadores})
    )
    SELECT
      b.NUM_CTA,
      b.NOMBRE,
      b.NIVEL,
      b.NATZ,
      CASE WHEN b.NATZ = 'D'
        THEN (b.CARGO_MES - b.ABONO_MES)
        ELSE (b.ABONO_MES - b.CARGO_MES)
      END AS REAL_MES,
      CASE WHEN b.NATZ = 'D'
        THEN (b.CARGOS_ACUM - b.ABONOS_ACUM)
        ELSE (b.ABONOS_ACUM - b.CARGOS_ACUM)
      END AS REAL_ACUM,
      CASE WHEN b.NATZ = 'D'
        THEN (b.CARGO_MES_ANT - b.ABONO_MES_ANT)
        ELSE (b.ABONO_MES_ANT - b.CARGO_MES_ANT)
      END AS REAL_MES_ANT,
      CASE WHEN b.NATZ = 'D'
        THEN (b.CARGOS_ACUM_ANT - b.ABONOS_ACUM_ANT)
        ELSE (b.ABONOS_ACUM_ANT - b.CARGOS_ACUM_ANT)
      END AS REAL_ACUM_ANT,
      b.PRESUP_MES,
      b.PRESUP_ACUM
    FROM base b
    ORDER BY b.NUM_CTA
  `;

  const filas = await ejecutarConsulta(empresaId, sql, params);
  return filas.map((row) => ({
    cuenta: String(row.NUM_CTA || '').trim(),
    nombre: row.NOMBRE || '',
    nivel: row.NIVEL,
    actualMonth: Number(row.REAL_MES ?? 0),
    planMonth: Number(row.PRESUP_MES ?? 0),
    prevMonth: Number(row.REAL_MES_ANT ?? 0),
    actualYTD: Number(row.REAL_ACUM ?? 0),
    planYTD: Number(row.PRESUP_ACUM ?? 0),
    prevYTD: Number(row.REAL_ACUM_ANT ?? 0)
  }));
}

module.exports = {
  obtenerDatosPlaneacion,
  obtenerDatosPlaneacionResumen
};
