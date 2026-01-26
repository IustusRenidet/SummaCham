const express = require("express");
const helmet = require("helmet");
const fs = require("fs");
const path = require("path");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const { inicializarBaseDatos, getDb } = require("./db/sqlite");
const backupService = require("./services/backupService");
const SqliteStore = require("better-sqlite3-session-store")(session);

let instanciaServidor = null;

const JWT_SECRET_DEFAULT = "cambia-este-secreto";
const SESSION_SECRET_DEFAULT = "cambia-este-secreto-de-sesion-en-produccion";

const asegurarSecretos = () => {
  const faltantes = [];
  const jwtSecret = process.env.PANELAMCHAM_JWT_SECRET || "";
  const sessionSecret = process.env.SESSION_SECRET || "";

  // En producción, los secretos pueden haber sido generados automáticamente
  // por secretsManager en main.js, así que verificamos que existan
  if (!jwtSecret || jwtSecret === JWT_SECRET_DEFAULT) {
    faltantes.push("PANELAMCHAM_JWT_SECRET");
  }
  if (!sessionSecret || sessionSecret === SESSION_SECRET_DEFAULT) {
    faltantes.push("SESSION_SECRET");
  }

  if (faltantes.length === 0) {
    console.log("✓ Secretos de seguridad validados");
    return;
  }

  const mensaje = `Secrets no configurados o inseguros: ${faltantes.join(", ")}.`;

  // Solo lanzar error en producción si NO es una aplicación Electron
  // (en Electron, los secretos se generan automáticamente en main.js)
  const isElectron = process.versions && process.versions.electron;
  const isProduction = (process.env.NODE_ENV || "development") === "production";

  if (isProduction && !isElectron) {
    throw new Error(mensaje);
  }

  if (faltantes.length > 0) {
    console.warn(`⚠️ ${mensaje}`);
    console.warn("   Los secretos deberían configurarse para mayor seguridad.");
  }
};

const iniciarServidor = (puerto = Number(process.env.PORT || 3005)) => {
  if (instanciaServidor) {
    console.log(
      "⚠️ Servidor ya está ejecutándose, retornando instancia existente",
    );
    return instanciaServidor;
  }

  console.log("🚀 Iniciando servidor Express...");
  console.log("  Puerto configurado:", puerto);
  console.log("  NODE_ENV:", process.env.NODE_ENV || "development");

  asegurarSecretos();

  try {
    inicializarBaseDatos();
    console.log("✓ Base de datos SQLite inicializada");
  } catch (error) {
    console.error("❌ No se pudo inicializar SQLite:", error);
    throw error;
  }

  // Inicializar y comenzar servicio de backups
  try {
    backupService.initialize({
      enabled: process.env.BACKUP_ENABLED !== "false",
      intervalMinutes: parseInt(process.env.BACKUP_INTERVAL_MINUTES) || 60,
      maxBackups: parseInt(process.env.BACKUP_MAX_BACKUPS) || 24,
      backupPath: process.env.BACKUP_PATH || undefined,
    });
    backupService.start();
  } catch (error) {
    console.error("⚠ Error iniciando servicio de backups:", error);
  }

  const rutasAuth = require("./routes/auth");
  const rutasUsuarios = require("./routes/usuarios");
  const rutasEmpresas = require("./routes/empresas");
  const rutasModulos = require("./routes/modulos");
  const rutasPresupuestos = require("./routes/presupuestos");
  const rutasComites = require("./routes/comitesRoutes");
  const rutasPlaneacion = require("./routes/planeacion");
  const rutasLayouts = require("./routes/layouts");
  const rutasLayoutsPorAnio = require("./routes/layoutRoutes");
  const rutasNotificaciones = require("./routes/notificaciones");
  const rutasComentarios = require("./routes/comentarios");
  const rutasSaldos = require("./routes/saldos");
  const rutasCuentas = require("./routes/cuentas");
  const rutasReportes = require("./routes/reportes");
  const rutasBorradores = require("./routes/borradores");
  const rutasEstructura = require("./routes/estructuraRoutes");
  const rutasInsercion = require("./routes/insercion");
  const rutasPerfil = require("./routes/perfil");
  const rutasBackups = require("./routes/backups");
  const rutasFirebirdConfig = require("./routes/firebird-config");
  const rutasGraficasConfig = require("./routes/graficas-config");

  const app = express();

  // Confiar en proxy reverso (para túneles HTTPS como cloudflare, ngrok, etc.)
  app.set("trust proxy", 1);
  // CORS restringido: permitir orígenes configurados (por defecto localhost y file:// -> null origin)
  const allowedOrigins = (
    process.env.PANELAMCHAM_ALLOW_ORIGINS ||
    "http://localhost:3005,https://panelamcham.iconetcloud.com.mx,http://192.99.189.113,http://192.99.189.113:3005,null,file://"
  )
    .split(",")
    .map((o) => o.trim());
  app.use((req, res, next) => {
    const origin = req.headers.origin || "null";
    if (
      allowedOrigins.includes(origin) ||
      (origin === "null" && allowedOrigins.includes("file://"))
    ) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Credentials", "true");
    }
    res.header("Vary", "Origin");
    res.header(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    );
    res.header(
      "Access-Control-Allow-Headers",
      "Content-Type, X-Usuario-Actual, X-Empresa-Activa, Authorization",
    );
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    next();
  });

  app.use(cookieParser());

  const sessionSecret = process.env.SESSION_SECRET || SESSION_SECRET_DEFAULT;
  const sessionStore = new SqliteStore({
    client: getDb(),
    expired: {
      clear: true,
      intervalMs: 15 * 60 * 1000,
    },
  });

  // Configuración de sesiones para múltiples usuarios simultáneos
  app.use(
    session({
      store: sessionStore,
      secret: sessionSecret,
      name: "panelamcham.sid",
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        // Habilitar secure solo si viene por HTTPS (túnel)
        secure: process.env.NODE_ENV === "production" ? "auto" : false,
        httpOnly: true,
        maxAge: 30 * 60 * 1000, // 30 minutos de persistencia
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", // 'none' permite cookies cross-site en HTTPS
        domain: process.env.COOKIE_DOMAIN || undefined, // Para túnel: '.iconetcloud.com.mx'
      },
      // Store en SQLite para sesiones persistentes
    }),
  );

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false }));

  // Ruta raíz para servir la interfaz web
  const vistasPath = path.join(__dirname, "..", "vistas");
  const iconoPath = path.join(__dirname, "..", "icono");
  const infoImportantePath = path.join(__dirname, "..", "info IMPORTANTE");
  const infoImportanteAltPath = path.join(__dirname, "..", "info_importante");

  app.get("/", (req, res) => {
    // Si no hay sesión activa, redirigir a login
    if (!req.session || !req.session.usuario) {
      return res.redirect("/login.html");
    }
    res.sendFile(path.join(vistasPath, "app.html"));
  });

  // Servir archivos estáticos de la carpeta vistas (CSS, JS, imágenes, otras vistas HTML)
  // Deshabilitar caché para archivos JS y CSS en desarrollo
  app.use(
    express.static(vistasPath, {
      etag: false,
      lastModified: false,
      setHeaders: (res, filepath) => {
        // No cachear archivos JavaScript y CSS
        if (filepath.endsWith(".js") || filepath.endsWith(".css")) {
          res.setHeader(
            "Cache-Control",
            "no-store, no-cache, must-revalidate, proxy-revalidate",
          );
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");
        }
      },
    }),
  );

  // Servir archivos estáticos de la carpeta icono (logos, íconos)
  // Servir archivos estaticos de info IMPORTANTE si existe.
  if (fs.existsSync(infoImportantePath)) {
    app.use("/info IMPORTANTE", express.static(infoImportantePath));
  }
  if (fs.existsSync(infoImportanteAltPath)) {
    app.use("/info_importante", express.static(infoImportanteAltPath));
  }

  // Servir archivos estaticos de la carpeta icono.
  app.use("/icono", express.static(iconoPath));

  // Info de la API
  app.get("/api", (req, res) => {
    res.json({
      aplicacion: "Panel AMCHAM",
      version: "1.0.1",
      estado: "activo",
      mensaje: "API funcionando correctamente",
      endpoints: {
        salud: "/api/salud",
        autenticacion: "/api/auth",
        usuarios: "/api/usuarios",
        empresas: "/api/empresas",
        modulos: "/api/modulos",
        presupuestos: "/api/presupuestos",
        planeacion: "/api/planeacion",
        reportes: "/api/reportes",
      },
    });
  });

  app.get("/api/salud", (req, res) => {
    res.json({ estado: "ok" });
  });

  // Endpoint para buscar cuentas activas (STATUS='A') para autocompletar
  const { requireAuth } = require("./middleware/auth");
  app.get("/api/cuentas-activas", requireAuth, async (req, res) => {
    try {
      const anio = parseInt(req.query.anio, 10) || new Date().getFullYear();
      const empresaId = req.query.empresaId || "EMPRESA01";
      const rawQuery = (req.query.q || "").toString().trim();
      const query = rawQuery.slice(0, 50);
      const firebirdService = require("./services/firebirdService");

      // Consultar cuentas activas del catálogo
      const condiciones = ["STATUS = 'A'"];
      const parametros = [];
      if (query) {
        condiciones.push("(CUENTA CONTAINING ? OR NOMBRE CONTAINING ?)");
        parametros.push(query, query);
      }
      const limite = query ? 200 : 500;
      const sql = `
        SELECT FIRST ${limite} CUENTA, NOMBRE
        FROM CATCTA${anio.toString().slice(-2)}
        WHERE ${condiciones.join(" AND ")}
        ORDER BY CUENTA
      `;

      const cuentas = await firebirdService.ejecutarConsulta(
        empresaId,
        sql,
        parametros
      );
      res.json(cuentas || []);
    } catch (error) {
      console.error("Error al obtener cuentas activas:", error);
      res
        .status(500)
        .json({ mensaje: "Error al obtener cuentas", error: error.message });
    }
  });

  app.use("/api/auth", rutasAuth);
  app.use("/api/usuarios", rutasUsuarios);
  app.use("/api/empresas", rutasEmpresas);
  app.use("/api/modulos", rutasModulos);
  app.use("/api/presupuestos", rutasPresupuestos);
  app.use("/api/comites", rutasComites);
  app.use("/api/planeacion", rutasPlaneacion);
  // Compat: algunos clientes usan `/api/layouts/:modulo/:anio/:capitulo`
  // (layoutRoutes) y otros el endpoint legacy `/api/layouts` con querystring.
  // Montar ambos routers bajo `/api/layouts` en orden (rutas específicas primero).
  app.use("/api/layouts", (req, res, next) => {
    console.log(
      `[DEBUG] Request to /api/layouts detected: ${req.method} ${req.originalUrl}`,
    );
    next();
  });
  app.use("/api/layouts", rutasLayoutsPorAnio);
  app.use("/api/layouts", rutasLayouts);
  // Alias histórico usado por el Gestor de Plantillas
  app.use("/api/layouts-config", rutasLayoutsPorAnio);
  app.use("/api/borradores", rutasBorradores);
  app.use("/api/notificaciones", rutasNotificaciones);
  app.use("/api/comentarios", rutasComentarios);
  app.use("/api/reportes", rutasReportes);
  app.use("/api/perfil", rutasPerfil);
  app.use("/api/saldos", rutasSaldos);
  app.use("/api/cuentas", rutasCuentas);
  app.use("/api/backups", rutasBackups);
  app.use("/api/firebird-config", rutasFirebirdConfig);
  app.use("/api/graficas-config", rutasGraficasConfig);
  app.use("/api", rutasEstructura);
  app.use("/api/insercion", rutasInsercion);

  // 404 para rutas no encontradas
  app.use((req, res) => {
    // Si es una petición a /api/*, devolver JSON
    if (req.path.startsWith("/api/")) {
      console.log(
        `[DEBUG] 404 Not Found for API path: ${req.method} ${req.originalUrl}`,
      );
      return res.status(404).json({ mensaje: "Recurso no encontrado." });
    }
    // Para otras rutas, redirigir a la raíz (SPA)
    res.redirect("/");
  });

  app.use((error, req, res, next) => {
    // eslint-disable-line no-unused-vars
    console.error("Error no controlado:", error);
    res.status(500).json({ mensaje: "Ocurrió un error inesperado." });
  });

  // Escuchar en 0.0.0.0 para permitir acceso externo vía túnel
  instanciaServidor = app.listen(puerto, "0.0.0.0", () => {
    console.log("✓✓✓ SERVIDOR NODE.JS INICIADO EXITOSAMENTE ✓✓✓");
    console.log(`  → Servidor corriendo en http://localhost:${puerto}`);
    console.log(`  → Acceso local: http://localhost:${puerto}`);
    console.log(`  → Acceso público: https://panelamcham.iconetcloud.com.mx`);
    console.log(
      `  → Soporta múltiples usuarios simultáneos con sesiones independientes`,
    );
    console.log(`  → Sesiones expiran después de 30 minutos de inactividad`);
    console.log(`  → O abre la app Electron con: npm start`);
  });

  instanciaServidor.on("error", (error) => {
    console.error("❌ Error en el servidor:", error);
    if (error.code === "EADDRINUSE") {
      console.error(`  ❌ CRÍTICO: El puerto ${puerto} ya está en uso.`);
      console.error(
        `  → Cierre otras instancias de la aplicación o procesos usando el puerto ${puerto}`,
      );
    }
    throw error;
  });

  return instanciaServidor;
};

module.exports = iniciarServidor;

if (require.main === module) {
  try {
    iniciarServidor();
  } catch (error) {
    console.error("Error al iniciar servidor:", error);
    process.exit(1);
  }
}
