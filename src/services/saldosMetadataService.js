const { ejecutarConsulta } = require('./firebirdService');

const SQL_LISTAR_TABLAS_SALDOS = `
  SELECT TRIM(RDB$RELATION_NAME) AS NOMBRE
  FROM RDB$RELATIONS
  WHERE (RDB$SYSTEM_FLAG = 0 OR RDB$SYSTEM_FLAG IS NULL)
    AND RDB$VIEW_BLR IS NULL
    AND UPPER(RDB$RELATION_NAME) LIKE 'SALDOS%'
`;

const normalizarNombre = (valor) => (valor || '').toString().trim().toUpperCase();

const extraerAnio = (nombre) => {
  const normalizado = normalizarNombre(nombre);
  const match = normalizado.match(/^SALDOS[_]?(\d{1,4})$/);
  if (!match) return null;
  const sufijo = match[1];
  const numero = parseInt(sufijo, 10);
  if (!Number.isFinite(numero)) return null;

  if (sufijo.length >= 4) {
    if (numero >= 1900 && numero <= 2100) {
      return numero;
    }
    return null;
  }

  const anio = 2000 + numero;
  if (anio >= 2000 && anio <= 2100) {
    return anio;
  }
  return null;
};

async function listarAniosSaldos(empresaId) {
  if (!empresaId) {
    throw new Error('Empresa obligatoria');
  }

  const filas = await ejecutarConsulta(empresaId, SQL_LISTAR_TABLAS_SALDOS, []);
  const anios = new Set();

  (filas || []).forEach((row) => {
    const nombre = row?.NOMBRE ?? row?.nombre ?? '';
    const anio = extraerAnio(nombre);
    if (anio != null) {
      anios.add(anio);
    }
  });

  return Array.from(anios).sort((a, b) => a - b);
}

module.exports = {
  listarAniosSaldos
};
