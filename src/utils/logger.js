/**
 * logger.js
 * Registro estructurado a archivo, con rotación diaria y retención de 30 días.
 * Sin dependencias nuevas: usa solo fs/path del propio Node. Cada línea es un
 * JSON compacto (fecha, nivel, evento y datos), fácil de filtrar o de subir a
 * un visor si más adelante se agrega uno. Un fallo al escribir el log nunca
 * debe tumbar la app -- todo va envuelto en try/catch.
 */

const path = require("path");
const fs = require("fs");

const RETENCION_DIAS = 30;
const NIVELES = ["debug", "info", "warn", "error"];

const _getDataDirectory = () => {
  if (process.env.PANELAMCHAM_DATA_DIR) {
    return path.resolve(process.env.PANELAMCHAM_DATA_DIR);
  }
  try {
    // eslint-disable-next-line global-require
    const electron = require("electron");
    if (electron && electron.app) {
      return path.join(electron.app.getPath("userData"), "datos");
    }
  } catch (_) {
    // No estamos dentro de Electron (p.ej. `node src/server.js` en modo servidor).
  }
  return path.join(process.cwd(), "datos");
};

let logDirCache = null;
const _obtenerLogDir = () => {
  if (logDirCache) return logDirCache;
  const dir = path.join(_getDataDirectory(), "logs");
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    console.error("[logger] no se pudo crear el directorio de logs:", err.message);
  }
  logDirCache = dir;
  return dir;
};

const _archivoDeHoy = () => {
  const hoy = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return path.join(_obtenerLogDir(), `${hoy}.log`);
};

let ultimaLimpieza = 0;
const _limpiarArchivosViejos = () => {
  const ahora = Date.now();
  if (ahora - ultimaLimpieza < 6 * 60 * 60 * 1000) return; // como mucho cada 6 horas
  ultimaLimpieza = ahora;
  try {
    const dir = _obtenerLogDir();
    const limite = ahora - RETENCION_DIAS * 24 * 60 * 60 * 1000;
    fs.readdirSync(dir)
      .filter((archivo) => /^\d{4}-\d{2}-\d{2}\.log$/.test(archivo))
      .forEach((archivo) => {
        const fecha = Date.parse(archivo.replace(".log", ""));
        if (Number.isFinite(fecha) && fecha < limite) {
          try {
            fs.unlinkSync(path.join(dir, archivo));
          } catch (_) {
            // Si no se pudo borrar un archivo viejo, no es motivo para fallar.
          }
        }
      });
  } catch (_) {
    // La limpieza es best-effort; nunca debe interrumpir el registro normal.
  }
};

const registrar = (nivel, evento, detalle = {}) => {
  const nivelSeguro = NIVELES.includes(nivel) ? nivel : "info";
  const linea = {
    ts: new Date().toISOString(),
    nivel: nivelSeguro,
    evento: String(evento || "").slice(0, 200),
    ...detalle,
  };
  try {
    fs.appendFileSync(_archivoDeHoy(), `${JSON.stringify(linea)}\n`, "utf8");
  } catch (err) {
    console.error("[logger] no se pudo escribir el log:", err.message);
  }
  _limpiarArchivosViejos();

  const metodo =
    nivelSeguro === "error"
      ? console.error
      : nivelSeguro === "warn"
        ? console.warn
        : console.log;
  const extra = detalle && Object.keys(detalle).length ? detalle : "";
  metodo(`[${nivelSeguro.toUpperCase()}] ${evento}`, extra);
};

module.exports = {
  debug: (evento, detalle) => registrar("debug", evento, detalle),
  info: (evento, detalle) => registrar("info", evento, detalle),
  warn: (evento, detalle) => registrar("warn", evento, detalle),
  error: (evento, detalle) => registrar("error", evento, detalle),
  obtenerLogDir: _obtenerLogDir,
};
