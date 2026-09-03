const { ejecutarConsulta, ejecutarLote } = require('./firebirdService');
const { listarAniosPresupuestos } = require('./presupuestosMetadataService');
const { db, registrarPresupuestoGuardado } = require('../db/sqlite');
const logger = require('../utils/logger');

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
      ${[...columnasPresupuesto, ...columnasReal].join(',\n      ')}
    FROM ${tablaCuentas} c
    LEFT JOIN ${tablaPresupuesto} p
      ON p.NUM_CTA = c.NUM_CTA
     AND p.EJERCICIO = ?
    LEFT JOIN ${tablaSaldos} s
      ON s.NUM_CTA = c.NUM_CTA
     AND s.EJERCICIO = ?
    WHERE c.STATUS = 'A'
      AND c.TIPO = 'A'
      AND c.NIVEL = '1'
      AND SUBSTRING(c.NUM_CTA FROM 1 FOR 3) BETWEEN '400' AND '950'
    ORDER BY c.NUM_CTA
  `;

  const resultados = await ejecutarConsulta(empresaId, consulta, [ejercicio, ejercicio]);
  return resultados.map((registro) => mapearRegistro(registro));
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

  // Consultar SOLO cuentas nivel 1 (mayor) para evitar doble conteo:
  // en COI es común que PRESUP se capture tanto en cuentas mayor como en auxiliares.
  // Si sumamos todos los niveles (A/D) se duplican montos (ej: 405000 + 405001).
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
      AND c.TIPO IN ('A', 'D')
      AND c.NIVEL = '1'
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

const ANIO_MIN = 2000;
const ANIO_MAX = 2100;

const validarAnio = (valor, etiqueta) => {
  const anio = Number(valor);
  if (!Number.isInteger(anio) || anio < ANIO_MIN || anio > ANIO_MAX) {
    const err = new Error(`${etiqueta} inválido.`);
    err.status = 400;
    throw err;
  }
  return anio;
};

const columnasPresupuesto = () => PERIODOS.map((p) => `PRESUP${formatearPeriodo(p)}`);

/**
 * Lee el presupuesto del año origen y arma el detalle completo de una copia
 * entre años: SOLO se copia a cuentas que ya existen en el catálogo del año
 * destino (CUENTAS{destino}) -- si una cuenta de origen no existe todavía en
 * destino, se omite (no se crean cuentas nuevas en el año destino).
 *
 * Clasifica cada cuenta candidata en tres grupos:
 * - nuevas: no existe fila en PRESUP{destino}, o existe pero en ceros --
 *   escribir ahí no sobrescribe nada real.
 * - sobrescriben: PRESUP{destino} ya tiene algún valor distinto de cero en
 *   alguno de los 12 meses -- aquí sí se pierde un valor capturado.
 * - omitidas: la cuenta de origen no existe en el catálogo del año destino.
 *
 * Esto alimenta tanto el aviso de confirmación como el reporte descargable
 * -- no es una pantalla de vista previa aparte, la usa directo
 * copiarPresupuestoEntreAnios() y la ruta de detalle para el modal/reporte.
 */
async function _leerPresupuestoParaCopiar({ empresaId, anioOrigen, anioDestino }) {
  const origen = validarAnio(anioOrigen, 'El año de origen');
  const destino = validarAnio(anioDestino, 'El año de destino');
  if (origen === destino) {
    const err = new Error('El año de origen y el de destino deben ser distintos.');
    err.status = 400;
    throw err;
  }
  if (!empresaId) {
    const err = new Error('Falta indicar la empresa/capítulo.');
    err.status = 400;
    throw err;
  }

  const tablaCuentasOrigen = construirNombreTabla('CUENTAS', origen);
  const tablaCuentasDestino = construirNombreTabla('CUENTAS', destino);
  const tablaPresupOrigen = construirNombreTabla('PRESUP', origen);
  const tablaPresupDestino = construirNombreTabla('PRESUP', destino);
  const columnas = columnasPresupuesto();

  const [cuentasOrigenCat, cuentasDestinoCat, presupOrigen, presupDestino] = await Promise.all([
    ejecutarConsulta(empresaId, `SELECT NUM_CTA, NOMBRE FROM ${tablaCuentasOrigen} WHERE STATUS = 'A'`),
    ejecutarConsulta(empresaId, `SELECT NUM_CTA, NOMBRE FROM ${tablaCuentasDestino} WHERE STATUS = 'A'`),
    ejecutarConsulta(empresaId, `SELECT * FROM ${tablaPresupOrigen} WHERE EJERCICIO = ?`, [origen]),
    ejecutarConsulta(empresaId, `SELECT * FROM ${tablaPresupDestino} WHERE EJERCICIO = ?`, [destino]),
  ]);

  const nombreOrigenPorCuenta = new Map(cuentasOrigenCat.map((r) => [String(r.NUM_CTA).trim(), (r.NOMBRE || '').trim()]));
  const nombreDestinoPorCuenta = new Map(cuentasDestinoCat.map((r) => [String(r.NUM_CTA).trim(), (r.NOMBRE || '').trim()]));
  const setCuentasDestino = new Set(cuentasDestinoCat.map((r) => String(r.NUM_CTA).trim()));
  const presupDestinoPorCuenta = new Map(presupDestino.map((r) => [String(r.NUM_CTA).trim(), r]));

  const tieneValorReal = (fila) => columnas.some((col) => Math.abs(Number(fila?.[col] ?? 0)) > 0.004);

  const cuentas = [];
  const omitidasDetalle = [];

  presupOrigen.forEach((fila) => {
    const cuenta = String(fila.NUM_CTA).trim();
    if (!cuenta) return;
    const nombre = nombreOrigenPorCuenta.get(cuenta) || '';
    if (!setCuentasDestino.has(cuenta)) {
      omitidasDetalle.push({ cuenta, nombre });
      return;
    }
    const filaDestino = presupDestinoPorCuenta.get(cuenta);
    const sobrescribe = tieneValorReal(filaDestino);
    cuentas.push({
      cuenta,
      nombre: nombreDestinoPorCuenta.get(cuenta) || nombre,
      sobrescribe,
      valoresOrigen: columnas.map((col) => Number(fila[col] ?? 0)),
      valoresDestinoActual: filaDestino ? columnas.map((col) => Number(filaDestino[col] ?? 0)) : columnas.map(() => 0),
    });
  });

  return {
    empresaId,
    anioOrigen: origen,
    anioDestino: destino,
    cuentas,
    omitidasDetalle,
    totalACopiar: cuentas.length,
    sobrescribiran: cuentas.filter((item) => item.sobrescribe).length,
    nuevas: cuentas.filter((item) => !item.sobrescribe).length,
    omitidas: omitidasDetalle.length,
  };
}

/**
 * Copia el presupuesto de un año a otro dentro de la misma empresa/capítulo.
 * Todo el lote se escribe en una sola transacción de Firebird (ejecutarLote
 * con usarTransaccion: true): si una sola cuenta falla, ninguna se guarda --
 * el año destino queda exactamente como estaba antes de intentarlo.
 *
 * Si alguna cuenta ya tiene presupuesto capturado en el año destino, por
 * default se detiene y pide confirmación explícita (permitirSobrescritura)
 * en vez de sobrescribir en silencio.
 */
async function copiarPresupuestoEntreAnios({
  empresaId,
  anioOrigen,
  anioDestino,
  usuarioId = null,
  permitirSobrescritura = false,
}) {
  const datos = await _leerPresupuestoParaCopiar({ empresaId, anioOrigen, anioDestino });

  if (!datos.totalACopiar) {
    const razon = datos.omitidas > 0
      ? `ninguna de las cuentas con presupuesto en ${datos.anioOrigen} existe en el catálogo de ${datos.anioDestino}`
      : `${datos.anioOrigen} no tiene presupuesto capturado para esta empresa`;
    const err = new Error(`No hay nada que copiar: ${razon}.`);
    err.status = 400;
    throw err;
  }

  if (datos.sobrescribiran > 0 && !permitirSobrescritura) {
    const err = new Error(
      `${datos.anioDestino} ya tiene presupuesto capturado en ${datos.sobrescribiran} de las ${datos.totalACopiar} cuentas de ${datos.anioOrigen}. Confirma para sobrescribirlo.`
    );
    err.status = 409;
    err.codigo = 'REQUIERE_CONFIRMACION';
    err.preview = {
      totalACopiar: datos.totalACopiar,
      sobrescribiran: datos.sobrescribiran,
      omitidas: datos.omitidas,
    };
    throw err;
  }

  const tablaPresupDestino = construirNombreTabla('PRESUP', datos.anioDestino);
  const columnas = columnasPresupuesto();
  const consulta = `
    UPDATE OR INSERT INTO ${tablaPresupDestino}
      (NUM_CTA, EJERCICIO, ${columnas.join(', ')})
    VALUES (?, ?, ${columnas.map(() => '?').join(', ')})
    MATCHING (NUM_CTA, EJERCICIO)
  `;

  const operaciones = datos.cuentas.map((item) => ({
    consulta,
    parametros: [item.cuenta, datos.anioDestino, ...item.valoresOrigen],
    meta: { cuenta: item.cuenta },
  }));

  try {
    await ejecutarLote(empresaId, operaciones, { usarTransaccion: true });
  } catch (error) {
    const mensajeAmigable = `No se pudo copiar el presupuesto de ${datos.anioOrigen} a ${datos.anioDestino} — no se guardó ningún cambio, el presupuesto de ${datos.anioDestino} sigue como estaba.`;
    try {
      logger.error('presupuesto.copia_fallida', {
        empresaId,
        anioOrigen: datos.anioOrigen,
        anioDestino: datos.anioDestino,
        usuarioId: usuarioId ? String(usuarioId) : null,
        mensajeTecnico: error?.message,
      });
    } catch (_) {
      // El log es secundario; lo importante es propagar el error real hacia abajo.
    }
    const errUsuario = new Error(mensajeAmigable);
    errUsuario.status = 500;
    errUsuario.causaOriginal = error?.message;
    throw errUsuario;
  }

  const resultado = {
    empresaId,
    anioOrigen: datos.anioOrigen,
    anioDestino: datos.anioDestino,
    copiadas: operaciones.length,
    sobrescritas: datos.sobrescribiran,
    omitidas: datos.omitidas,
  };

  try {
    logger.info('presupuesto.copiado_entre_anios', {
      ...resultado,
      usuarioId: usuarioId ? String(usuarioId) : null,
    });
  } catch (_) {
    // No debe impedir devolver el resultado exitoso.
  }

  // Historial de cambios en COI: mismo mecanismo que ya usa "Guardar en COI"
  // normal (registrarPresupuestoGuardado -> tabla presupuestos_guardados),
  // asi que una copia entre años queda en el mismo historial unificado, con
  // el detalle cuenta por cuenta (valor anterior en destino y valor nuevo)
  // para poder reconstruir exactamente que cambio.
  try {
    registrarPresupuestoGuardado({
      empresaId,
      modulo: 'COPIA_PRESUPUESTO',
      anio: datos.anioDestino,
      datos: {
        tipo: 'copia_entre_anios',
        anioOrigen: datos.anioOrigen,
        anioDestino: datos.anioDestino,
        copiadas: operaciones.length,
        sobrescritas: datos.sobrescribiran,
        omitidas: datos.omitidas,
        cuentas: datos.cuentas.map((item) => ({
          cuenta: item.cuenta,
          nombre: item.nombre,
          valorAnterior: item.valoresDestinoActual,
          valorNuevo: item.valoresOrigen,
        })),
      },
      guardadoPor: usuarioId ? Number(usuarioId) : null,
    });
  } catch (histError) {
    console.warn('[presupuestosService] No se pudo registrar en el historial de COI:', histError.message);
    // No es motivo para deshacer la copia -- ya se escribio en Firebird.
  }

  return resultado;
}

/**
 * Detalle completo de lo que copiaría (o copió) una operación año->año, para
 * el modal de revisión y el reporte descargable. No escribe nada.
 */
async function obtenerDetalleCopiaPresupuesto({ empresaId, anioOrigen, anioDestino }) {
  return _leerPresupuestoParaCopiar({ empresaId, anioOrigen, anioDestino });
}

/**
 * Historial de cambios guardados en COI desde este programa (incluye tanto
 * los "Guardar en COI" normales por módulo como las copias entre años,
 * porque ambos pasan por registrarPresupuestoGuardado). Es el control de
 * versiones del presupuesto: quién cambió qué y cuándo.
 */
function listarHistorialCoi({ empresaId, anio, limite = 100 } = {}) {
  const condiciones = [];
  const parametros = [];
  if (empresaId) {
    condiciones.push('pg.empresa_id = ?');
    parametros.push(empresaId);
  }
  if (anio) {
    condiciones.push('pg.anio = ?');
    parametros.push(Number(anio));
  }
  const whereSql = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const limiteSeguro = Math.min(Math.max(Number(limite) || 100, 1), 500);

  const filas = db
    .prepare(
      `
      SELECT pg.id, pg.empresa_id, pg.modulo, pg.anio, pg.datos, pg.guardado_en,
             u.usuario AS guardado_por_usuario, u.nombres AS guardado_por_nombres
      FROM presupuestos_guardados pg
      LEFT JOIN usuarios u ON u.id = pg.guardado_por
      ${whereSql}
      ORDER BY pg.id DESC
      LIMIT ${limiteSeguro}
    `
    )
    .all(...parametros);

  return filas.map((fila) => {
    let datos = null;
    try {
      datos = JSON.parse(fila.datos);
    } catch (_) {
      datos = null;
    }
    const esCopiaEntreAnios = datos?.tipo === 'copia_entre_anios';
    const cuentasAfectadas = esCopiaEntreAnios
      ? datos.copiadas
      : Array.isArray(datos?.presupuesto)
        ? datos.presupuesto.length
        : null;
    return {
      id: fila.id,
      empresaId: fila.empresa_id,
      modulo: fila.modulo,
      anio: fila.anio,
      guardadoEn: fila.guardado_en,
      guardadoPor: fila.guardado_por_nombres || fila.guardado_por_usuario || 'Desconocido',
      tipo: esCopiaEntreAnios ? 'Copia entre años' : 'Guardado en COI',
      resumen: esCopiaEntreAnios
        ? `Copió ${datos.copiadas} cuenta(s) de ${datos.anioOrigen} a ${datos.anioDestino} (${datos.sobrescritas} sobrescritas, ${datos.omitidas} omitidas)`
        : `${cuentasAfectadas ?? '?'} cuenta(s) actualizadas`,
      cuentasAfectadas,
      detalle: datos,
    };
  });
}

/**
 * Detalle completo de un registro del historial de COI: qué cuentas y qué
 * valores mensuales se introdujeron exactamente en ese guardado (o esa
 * copia entre años), con el nombre de cada cuenta resuelto contra el
 * catálogo de Firebird del año correspondiente.
 */
async function obtenerDetalleHistorialCoi({ id }) {
  const fila = db
    .prepare(
      `
      SELECT pg.id, pg.empresa_id, pg.modulo, pg.anio, pg.datos, pg.guardado_en,
             u.usuario AS guardado_por_usuario, u.nombres AS guardado_por_nombres
      FROM presupuestos_guardados pg
      LEFT JOIN usuarios u ON u.id = pg.guardado_por
      WHERE pg.id = ?
    `
    )
    .get(Number(id));

  if (!fila) {
    const error = new Error('No existe ese registro en el historial de COI.');
    error.status = 404;
    throw error;
  }

  let datos = null;
  try {
    datos = JSON.parse(fila.datos);
  } catch (_) {
    datos = null;
  }

  const base = {
    id: fila.id,
    empresaId: fila.empresa_id,
    modulo: fila.modulo,
    anio: fila.anio,
    guardadoEn: fila.guardado_en,
    guardadoPor: fila.guardado_por_nombres || fila.guardado_por_usuario || 'Desconocido',
  };

  const esCopiaEntreAnios = datos?.tipo === 'copia_entre_anios';

  if (esCopiaEntreAnios) {
    return {
      ...base,
      tipo: 'Copia entre años',
      anioOrigen: datos.anioOrigen,
      anioDestino: datos.anioDestino,
      cuentas: (datos.cuentas || []).map((item) => ({
        cuenta: item.cuenta,
        nombre: item.nombre || '',
        sobrescribe: (item.valorAnterior || []).some((v) => Math.abs(Number(v) || 0) > 0.004),
        valores: item.valorNuevo || [],
      })),
    };
  }

  const presupuesto = Array.isArray(datos?.presupuesto) ? datos.presupuesto : [];
  let nombrePorCuenta = new Map();
  try {
    const tablaCuentas = construirNombreTabla('CUENTAS', fila.anio);
    const catalogo = await ejecutarConsulta(
      fila.empresa_id,
      `SELECT NUM_CTA, NOMBRE FROM ${tablaCuentas}`
    );
    nombrePorCuenta = new Map(
      catalogo.map((registro) => [String(registro.NUM_CTA).trim(), (registro.NOMBRE || '').trim()])
    );
  } catch (error) {
    logger.warn('No fue posible resolver nombres de cuenta para el detalle del historial de COI.', {
      mensaje: error?.message,
    });
  }

  return {
    ...base,
    tipo: 'Guardado en COI',
    cuentas: presupuesto.map((item) => ({
      cuenta: item.cuenta,
      nombre: nombrePorCuenta.get(String(item.cuenta).trim()) || '',
      valores: MESES.map(({ clave }) => Number(item.valores?.[`budget-${clave}`] ?? 0)),
    })),
  };
}

module.exports = {
  obtenerPresupuestosMayor,
  obtenerTotalesPresupuestoCapitulo,
  listarAniosPresupuestos,
  copiarPresupuestoEntreAnios,
  obtenerDetalleCopiaPresupuesto,
  listarHistorialCoi,
  obtenerDetalleHistorialCoi,
  PERIODOS
};
