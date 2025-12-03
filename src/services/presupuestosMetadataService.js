const { ejecutarConsulta } = require('./firebirdService');

const SQL_LISTAR_TABLAS_PRESUP = `
  SELECT TRIM(RDB$RELATION_NAME) AS NOMBRE
  FROM RDB$RELATIONS
  WHERE (RDB$SYSTEM_FLAG = 0 OR RDB$SYSTEM_FLAG IS NULL)
    AND RDB$VIEW_BLR IS NULL
    AND UPPER(RDB$RELATION_NAME) LIKE 'PRESUP%'
`;

const normalizarNombre = (valor) => (valor || '').toString().trim().toUpperCase();
const construirNombreTabla = (anio) => `PRESUP${anio.toString().slice(-2).padStart(2, '0')}`;
const ANIO_MIN = 2000;
const ANIO_MAX = 2100;

const esErrorConexionFirebird = (error) => {
  const codigo = (error?.code || '').toString().toUpperCase();
  if (['ECONNREFUSED', 'EHOSTUNREACH', 'ENETUNREACH', 'ETIMEDOUT'].includes(codigo)) {
    return true;
  }
  const mensaje = (error?.message || '').toString().toUpperCase();
  return (
    mensaje.includes('UNABLE TO COMPLETE NETWORK REQUEST') ||
    mensaje.includes('FAILED TO ESTABLISH A CONNECTION') ||
    mensaje.includes('NETWORK REQUEST') ||
    mensaje.includes('CONNECTION REJECTED')
  );
};

const extraerAnio = (nombre) => {
  const normalizado = normalizarNombre(nombre);
  const match = normalizado.match(/^PRESUP[_]?(\d{1,4})$/);
  if (!match) return null;
  const sufijo = match[1];
  const numero = parseInt(sufijo, 10);
  if (!Number.isFinite(numero)) return null;

  if (sufijo.length >= 4) {
    if (numero >= ANIO_MIN && numero <= ANIO_MAX) {
      return numero;
    }
    return null;
  }

  const anio = 2000 + numero;
  if (anio >= ANIO_MIN && anio <= ANIO_MAX) {
    return anio;
  }
  return null;
};

async function listarDesdeMetadata(empresaId) {
  try {
    const filas = await ejecutarConsulta(empresaId, SQL_LISTAR_TABLAS_PRESUP, []);
    const anios = new Set();
    (filas || []).forEach((row) => {
      const nombre = row?.NOMBRE ?? row?.nombre ?? '';
      const anio = extraerAnio(nombre);
      if (anio != null) anios.add(anio);
    });
    return Array.from(anios);
  } catch (error) {
    if (esErrorConexionFirebird(error)) {
      throw error;
    }
    console.warn('No fue posible consultar RDB$RELATIONS para PRESUP.', error);
    return [];
  }
}

async function detectarPorInspeccion(empresaId) {
  const anios = [];
  for (let anio = ANIO_MIN; anio <= ANIO_MAX; anio += 1) {
    const tabla = construirNombreTabla(anio);
    const sql = `SELECT COUNT(*) AS TOTAL FROM ${tabla}`;
    try {
      const rows = await ejecutarConsulta(empresaId, sql, []);
      if (Array.isArray(rows)) {
        const registro = rows[0] || {};
        const total = Number(registro.TOTAL ?? registro.total ?? 0);
        // Si la consulta no falla, asumimos que la tabla existe para ese ano.
        if (total >= 0) {
          anios.push(anio);
        }
      }
    } catch (error) {
      if (esErrorConexionFirebird(error)) {
        throw error;
      }
      // Tabla inexistente o sin permisos, continuar con el siguiente ano.
    }
  }
  return anios;
}

async function listarAniosPresupuestos(empresaId) {
  if (!empresaId) {
    throw new Error('Empresa obligatoria');
  }

  const desdeMetadata = await listarDesdeMetadata(empresaId);
  if (desdeMetadata.length) {
    return desdeMetadata.sort((a, b) => a - b);
  }

  const fallback = await detectarPorInspeccion(empresaId);
  return fallback.sort((a, b) => a - b);
}

module.exports = {
  listarAniosPresupuestos
};
