// Asegurar que node-firebird se cargue desde .asar.unpacked en producción
let Firebird;
try {
  // Intentar cargar desde ruta normal (desarrollo)
  Firebird = require("node-firebird");
} catch (err) {
  // Si falla, intentar desde .asar.unpacked
  const path = require("path");
  const unpackedPath = __dirname.replace("app.asar", "app.asar.unpacked");
  const firebirdPath = path.join(
    unpackedPath,
    "../../node_modules/node-firebird",
  );
  Firebird = require(firebirdPath);
}

const { obtenerEmpresaPorId } = require("../config/empresas");
const { obtenerConfigBase } = require("./firebirdConfigService");

// Detectar si es conexión remota (puerto diferente a 3050 o host diferente a localhost/127.0.0.1)
const esConexionRemota = (base = obtenerConfigBase()) => {
  const host = base?.host || "127.0.0.1";
  const port = Number(base?.port) || 3050;
  return port !== 3050 || (host !== "127.0.0.1" && host !== "localhost");
};

// Configuración base desde variables de entorno
const obtenerOpcionesBase = () => {
  const base = obtenerConfigBase();
  const host = base?.host || "127.0.0.1";
  const port = Number(base?.port) || 3050;
  const user = base?.user || "sysdba";
  const password = base?.password || "masterkey";
  const esRemota = esConexionRemota({ host, port });

  return {
    host,
    port,
    user,
    password,
    lowercase_keys: false,
    pageSize: 4096,
    // Configuración optimizada para conexiones remotas
    retryLimit: esRemota ? 3 : 0, // 3 reintentos para remoto, 0 para local
    connectTimeout: esRemota ? 120000 : 3000, // 120s remoto, 3s local
    timeout: esRemota ? 120000 : 10000, // 120s query timeout remoto, 10s local
  };
};

const opcionesIniciales = obtenerOpcionesBase();
const tipoConexion = esConexionRemota(opcionesIniciales)
  ? "📡 REMOTA"
  : "🏠 LOCAL";
console.log(
  `🔥 Firebird ${tipoConexion}: ${opcionesIniciales.host}:${opcionesIniciales.port}`,
);

const crearOpciones = (empresaId) => {
  const empresa = obtenerEmpresaPorId(empresaId);
  if (!empresa) {
    throw new Error("Empresa no encontrada");
  }
  if (!empresa.rutaBaseDatos) {
    throw new Error("Empresa sin ruta de base de datos");
  }

  return {
    ...obtenerOpcionesBase(),
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

    const tiempoInicio = Date.now();
    const esRemoto = esConexionRemota(opciones);

    Firebird.attach(opciones, (errorConexion, conexion) => {
      if (errorConexion) {
        const tiempoTranscurrido = Date.now() - tiempoInicio;
        console.error(
          `❌ Error conexión ${
            esRemoto ? "REMOTA" : "LOCAL"
          } (${tiempoTranscurrido}ms):`,
          errorConexion.message,
        );
        return reject(errorConexion);
      }

      conexion.query(consulta, parametros, (errorConsulta, resultados) => {
        const tiempoTotal = Date.now() - tiempoInicio;

        // Detach siempre, incluso si hay error
        conexion.detach();

        if (errorConsulta) {
          console.error(
            `❌ Error query ${
              esRemoto ? "REMOTA" : "LOCAL"
            } (${tiempoTotal}ms):`,
            errorConsulta.message,
          );
          return reject(errorConsulta);
        }

        // Log solo si tarda más de 2 segundos
        if (tiempoTotal > 2000) {
          let numFilas = Array.isArray(resultados)
            ? resultados.length
            : resultados
              ? 1
              : 0;
          console.warn(
            `⏱️ Query lenta ${
              esRemoto ? "REMOTA" : "LOCAL"
            }: ${tiempoTotal}ms (${numFilas} filas)`,
          );
        }

        resolve(resultados);
      });
    });
  });
};

const ejecutarLote = (
  empresaId,
  operaciones = [],
  { isolation = Firebird.ISOLATION_READ_COMMITTED, usarTransaccion = true } = {},
) => {
  return new Promise((resolve, reject) => {
    let opciones;
    try {
      opciones = crearOpciones(empresaId);
    } catch (error) {
      return reject(error);
    }

    const tiempoInicio = Date.now();
    const esRemoto = esConexionRemota(opciones);

    Firebird.attach(opciones, (errorConexion, conexion) => {
      if (errorConexion) {
        const tiempoTranscurrido = Date.now() - tiempoInicio;
        console.error(
          `❌ Error conexión ${
            esRemoto ? "REMOTA" : "LOCAL"
          } (${tiempoTranscurrido}ms):`,
          errorConexion.message,
        );
        return reject(errorConexion);
      }

      const detachSeguro = (cb) => {
        try {
          conexion.detach(cb);
        } catch (err) {
          cb?.(err);
        }
      };

      const ejecutarQuery = (runner, consulta, parametros) =>
        new Promise((res, rej) => {
          runner.query(consulta, parametros || [], (err, resultados) => {
            if (err) return rej(err);
            res(resultados);
          });
        });

      const ejecutar = async () => {
        if (!Array.isArray(operaciones) || operaciones.length === 0) {
          return [];
        }

        if (!usarTransaccion) {
          const resultados = [];
          for (let i = 0; i < operaciones.length; i += 1) {
            const op = operaciones[i] || {};
            const consulta = op.consulta;
            const parametros = op.parametros || [];
            resultados.push(await ejecutarQuery(conexion, consulta, parametros));
          }
          return resultados;
        }

        const tx = await new Promise((res, rej) => {
          conexion.transaction(isolation, (err, transaction) => {
            if (err) return rej(err);
            res(transaction);
          });
        });

        try {
          const resultados = [];
          for (let i = 0; i < operaciones.length; i += 1) {
            const op = operaciones[i] || {};
            try {
              resultados.push(
                await ejecutarQuery(tx, op.consulta, op.parametros || []),
              );
            } catch (err) {
              const meta = op.meta || {};
              const cuenta = meta.cuenta ? ` (cuenta ${meta.cuenta})` : "";
              const wrapped = new Error(
                `Error ejecutando operación ${i + 1}/${operaciones.length}${cuenta}: ${err.message}`,
              );
              wrapped.cause = err;
              throw wrapped;
            }
          }

          await new Promise((res, rej) => {
            tx.commit((err) => {
              if (err) return rej(err);
              res();
            });
          });

          return resultados;
        } catch (err) {
          try {
            await new Promise((res) => tx.rollback(() => res()));
          } catch (_) {
            // ignore rollback errors
          }
          throw err;
        }
      };

      Promise.resolve()
        .then(() => ejecutar())
        .then((resultados) => {
          const tiempoTotal = Date.now() - tiempoInicio;
          detachSeguro(() => {
            if (tiempoTotal > 2000) {
              console.warn(
                `⏱️ Lote Firebird ${esRemoto ? "REMOTO" : "LOCAL"}: ${tiempoTotal}ms (${operaciones.length} ops)`,
              );
            }
            resolve(resultados);
          });
        })
        .catch((errorConsulta) => {
          const tiempoTotal = Date.now() - tiempoInicio;
          detachSeguro(() => {
            console.error(
              `❌ Error lote ${
                esRemoto ? "REMOTO" : "LOCAL"
              } (${tiempoTotal}ms):`,
              errorConsulta.message,
            );
            reject(errorConsulta);
          });
        });
    });
  });
};

const probarConexion = async (empresaId) => {
  try {
    await ejecutarConsulta(
      empresaId,
      "SELECT 1 AS RESULTADO FROM RDB$DATABASE",
    );
    return true;
  } catch (error) {
    return false;
  }
};

module.exports = {
  ejecutarConsulta,
  ejecutarLote,
  probarConexion,
};
