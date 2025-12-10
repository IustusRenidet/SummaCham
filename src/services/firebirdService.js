// Asegurar que node-firebird se cargue desde .asar.unpacked en producción
let Firebird;
try {
  // Intentar cargar desde ruta normal (desarrollo)
  Firebird = require('node-firebird');
} catch (err) {
  // Si falla, intentar desde .asar.unpacked
  const path = require('path');
  const unpackedPath = __dirname.replace('app.asar', 'app.asar.unpacked');
  const firebirdPath = path.join(unpackedPath, '../../node_modules/node-firebird');
  Firebird = require(firebirdPath);
}

const { obtenerEmpresaPorId } = require('../config/empresas');

// Configuración base desde variables de entorno
const OPCIONES_BASE = {
  host: process.env.FIREBIRD_HOST || '127.0.0.1',
  port: Number(process.env.FIREBIRD_PORT) || 3050,
  user: process.env.FIREBIRD_USER || 'sysdba',
  password: process.env.FIREBIRD_PASSWORD || 'masterkey',
  lowercase_keys: false,
  pageSize: 4096
};

console.log(`🔥 Firebird configurado: ${OPCIONES_BASE.host}:${OPCIONES_BASE.port}`);

const crearOpciones = (empresaId) => {
  const empresa = obtenerEmpresaPorId(empresaId);
  if (!empresa) {
    throw new Error('Empresa no encontrada');
  }

  return {
    ...OPCIONES_BASE,
    database: empresa.rutaBaseDatos
  };
};

const ejecutarConsulta = (empresaId, consulta, parametros = []) => {
  return new Promise((resolve, reject) => {
    let opciones;
    try {
      opciones = crearOpciones(empresaId);
    } catch (error) {
      return reject(error);
    }

    Firebird.attach(opciones, (errorConexion, conexion) => {
      if (errorConexion) {
        return reject(errorConexion);
      }

      conexion.query(consulta, parametros, (errorConsulta, resultados) => {
        conexion.detach();
        if (errorConsulta) {
          return reject(errorConsulta);
        }
        resolve(resultados);
      });
    });
  });
};

const probarConexion = async (empresaId) => {
  try {
    await ejecutarConsulta(empresaId, 'SELECT 1 AS RESULTADO FROM RDB$DATABASE');
    return true;
  } catch (error) {
    return false;
  }
};

module.exports = {
  ejecutarConsulta,
  probarConexion
};
