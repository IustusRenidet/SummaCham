const { ejecutarConsulta, ejecutarLote } = require('./firebirdService');
const { listarAniosPresupuestos } = require('./presupuestosMetadataService');
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
 * Lee el presupuesto completo del año origen (todas las cuentas que tengan
 * fila en PRESUP{origen}, sin filtrarlas contra el catálogo de cuentas del
 * año destino) y de una vez ve cuáles de esas cuentas ya tienen presupuesto
 * capturado en el año destino, para saber si hay que confirmar antes de
 * sobrescribir. Es un solo paso interno -- no es una pantalla de vista
 * previa aparte, la usa directo copiarPresupuestoEntreAnios().
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

  const tablaPresupOrigen = construirNombreTabla('PRESUP', origen);
  const tablaPresupDestino = construirNombreTabla('PRESUP', destino);
  const columnas = columnasPresupuesto();

  const [presupOrigen, presupDestinoExistente] = await Promise.all([
    ejecutarConsulta(empresaId, `SELECT * FROM ${tablaPresupOrigen} WHERE EJERCICIO = ?`, [origen]),
    ejecutarConsulta(empresaId, `SELECT NUM_CTA FROM ${tablaPresupDestino} WHERE EJERCICIO = ?`, [destino]),
  ]);

  const setPresupDestino = new Set(presupDestinoExistente.map((r) => String(r.NUM_CTA).trim()));

  // Presupuesto completo: se copia toda cuenta que tenga fila en el año
  // origen, exista o no todavía en el catálogo de cuentas del año destino
  // (una fila de más en PRESUP sin cuenta correspondiente simplemente no
  // aparece en ningún reporte -- no rompe nada, y así no hay que andar
  // adivinando qué cuentas "sí cuentan").
  const cuentas = presupOrigen
    .map((fila) => {
      const cuenta = String(fila.NUM_CTA).trim();
      if (!cuenta) return null;
      return {
        cuenta,
        sobrescribe: setPresupDestino.has(cuenta),
        valores: columnas.map((col) => Number(fila[col] ?? 0)),
      };
    })
    .filter(Boolean);

  return {
    empresaId,
    anioOrigen: origen,
    anioDestino: destino,
    cuentas,
    totalACopiar: cuentas.length,
    sobrescribiran: cuentas.filter((item) => item.sobrescribe).length,
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
    const err = new Error(`${datos.anioOrigen} no tiene presupuesto capturado para esta empresa. No hay nada que copiar.`);
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
    parametros: [item.cuenta, datos.anioDestino, ...item.valores],
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
  };

  try {
    logger.info('presupuesto.copiado_entre_anios', {
      ...resultado,
      usuarioId: usuarioId ? String(usuarioId) : null,
    });
  } catch (_) {
    // No debe impedir devolver el resultado exitoso.
  }

  return resultado;
}

module.exports = {
  obtenerPresupuestosMayor,
  obtenerTotalesPresupuestoCapitulo,
  listarAniosPresupuestos,
  copiarPresupuestoEntreAnios,
  PERIODOS
};
