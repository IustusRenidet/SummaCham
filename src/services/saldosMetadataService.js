const { ejecutarConsulta } = require('./firebirdService');

const SQL_LISTAR_TABLAS_SALDOS = `
  SELECT TRIM(RDB$RELATION_NAME) AS NOMBRE
  FROM RDB$RELATIONS
  WHERE (RDB$SYSTEM_FLAG = 0 OR RDB$SYSTEM_FLAG IS NULL)
    AND RDB$VIEW_BLR IS NULL
    AND UPPER(RDB$RELATION_NAME) LIKE 'SALDOS%'
`;

const normalizarNombre = (valor) => (valor || '').toString().trim().toUpperCase();
const construirNombreTabla = (anio) => `SALDOS${anio.toString().slice(-2).padStart(2, '0')}`;
const ANIO_MIN = 2000;
const ANIO_MAX = 2100;

const extraerAnio = (nombre) => {
  const normalizado = normalizarNombre(nombre);
  const match = normalizado.match(/^SALDOS[_]?(\d{1,4})$/);
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
    const filas = await ejecutarConsulta(empresaId, SQL_LISTAR_TABLAS_SALDOS, []);
    const anios = new Set();
    (filas || []).forEach((row) => {
      const nombre = row?.NOMBRE ?? row?.nombre ?? '';
      const anio = extraerAnio(nombre);
      if (anio != null) anios.add(anio);
    });
    return Array.from(anios);
  } catch (error) {
    console.warn('No fue posible consultar RDB$RELATIONS.', error);
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
        // El conteo puede ser cero si la tabla existe pero está vacía, así que
        // basta con que la consulta no arroje error para considerar el año válido.
        if (total >= 0) {
          anios.push(anio);
        }
      }
    } catch (error) {
      // Tabla inexistente o sin permisos, continuar con el siguiente año.
    }
  }
  return anios;
}

async function listarAniosSaldos(empresaId) {
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
  listarAniosSaldos
};
