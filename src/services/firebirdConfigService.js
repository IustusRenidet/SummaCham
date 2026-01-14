const fs = require("fs");
const path = require("path");

const CONFIG_FILENAME = "firebird-connections.json";

const resolverDataDir = () => {
  if (process.env.PANELAMCHAM_DATA_DIR) {
    return path.resolve(process.env.PANELAMCHAM_DATA_DIR);
  }

  const rutaLocal = path.resolve(__dirname, "../../datos");
  if (fs.existsSync(rutaLocal)) {
    return rutaLocal;
  }

  try {
    const electron = require("electron");
    if (electron?.app?.getPath) {
      return path.join(electron.app.getPath("userData"), "datos");
    }
  } catch (_) {
    // Electron no disponible
  }

  return path.join(process.cwd(), "datos");
};

const obtenerRutaConfig = () => {
  return path.join(resolverDataDir(), CONFIG_FILENAME);
};

const leerConfig = () => {
  const ruta = obtenerRutaConfig();
  if (!fs.existsSync(ruta)) {
    return null;
  }
  try {
    const contenido = fs.readFileSync(ruta, "utf-8");
    const data = JSON.parse(contenido);
    return data && typeof data === "object" ? data : null;
  } catch (error) {
    console.warn("No fue posible leer configuracion Firebird:", error.message);
    return null;
  }
};

const guardarConfig = (config) => {
  const ruta = obtenerRutaConfig();
  const dir = path.dirname(ruta);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const contenido = JSON.stringify(config || {}, null, 2);
  fs.writeFileSync(ruta, contenido);
  return ruta;
};

const normalizarTexto = (valor) => {
  if (valor == null) return "";
  return valor.toString().trim();
};

const normalizarRuta = (valor) => {
  if (!valor) return null;
  if (typeof valor === "string") {
    const limpio = valor.trim();
    return limpio ? path.normalize(limpio) : null;
  }
  if (typeof valor === "object") {
    const ruta = valor.rutaBaseDatos || valor.ruta || valor.path || null;
    return normalizarRuta(ruta);
  }
  return null;
};

const obtenerOverridesEmpresas = () => {
  const config = leerConfig();
  const empresas = config?.empresas;
  if (!empresas || typeof empresas !== "object") {
    return {};
  }
  return empresas;
};

const obtenerRutaOverride = (empresaId) => {
  if (!empresaId) return null;
  const overrides = obtenerOverridesEmpresas();
  return normalizarRuta(overrides?.[empresaId]);
};

const obtenerConfigBase = () => {
  const config = leerConfig() || {};
  const host =
    normalizarTexto(config.host) ||
    normalizarTexto(process.env.FIREBIRD_HOST) ||
    "127.0.0.1";
  const portRaw =
    config.port ?? process.env.FIREBIRD_PORT ?? process.env.FIREBIRD_PORT;
  const port = Number(portRaw) || 3050;
  const user =
    normalizarTexto(config.user) ||
    normalizarTexto(process.env.FIREBIRD_USER) ||
    "sysdba";
  const password =
    config.password != null
      ? config.password.toString()
      : process.env.FIREBIRD_PASSWORD || "masterkey";

  return { host, port, user, password };
};

module.exports = {
  obtenerRutaConfig,
  leerConfig,
  guardarConfig,
  obtenerConfigBase,
  obtenerOverridesEmpresas,
  obtenerRutaOverride,
  normalizarRuta,
};
