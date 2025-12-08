const Firebird = require("node-firebird");
const { obtenerEmpresaPorId } = require("../config/empresas");

const OPCIONES_BASE = {
  host: process.env.FIREBIRD_HOST || "127.0.0.1",
  port: Number(process.env.FIREBIRD_PORT || 15350),
  user: process.env.FIREBIRD_USER || "sysdba",
  password: process.env.FIREBIRD_PASSWORD || "masterkey",
  lowercase_keys: false,
  pageSize: 4096,
};

const crearOpciones = (empresaId) => {
  const empresa = obtenerEmpresaPorId(empresaId);
  if (!empresa) {
    throw new Error("Empresa no encontrada");
  }

  return {
    ...OPCIONES_BASE,
    database: empresa.rutaBaseDatos,
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
    await ejecutarConsulta(
      empresaId,
      "SELECT 1 AS RESULTADO FROM RDB$DATABASE"
    );
    return true;
  } catch (error) {
    return false;
  }
};

module.exports = {
  ejecutarConsulta,
  probarConexion,
};
