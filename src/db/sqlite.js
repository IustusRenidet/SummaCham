const path = require("path");
const fs = require("fs");
const { ensureActiveBinary } = require("../utils/betterSqlite3Manager");
const {
  seedLayoutsFromJson,
  seedLayoutsDesdeExcelCdMx,
  resolverDirectorioInfoImportante,
} = require("../services/layoutSeeder");

// Asegurar que better-sqlite3 se cargue desde .asar.unpacked en producción
let Database;
let SQLITE_AVAILABLE = true;
try {
  ensureActiveBinary();
  // Intentar cargar desde ruta normal (desarrollo)
  Database = require("better-sqlite3");
} catch (err) {
  try {
    // Si falla, intentar desde .asar.unpacked
    const unpackedPath = __dirname.replace("app.asar", "app.asar.unpacked");
    const betterSqlite3Path = path.join(
      unpackedPath,
      "../../node_modules/better-sqlite3"
    );
    Database = require(betterSqlite3Path);
  } catch (err2) {
    // No es posible cargar better-sqlite3. Crash early and give instructions.
    const mensaje =
      `\n\n❌ better-sqlite3 no pudo ser cargado: ${
        err2 && err2.message ? err2.message : err2
      }\n\n` +
      "Para usar SQLite (obligatorio), reconstruye los módulos nativos para el runtime de Electron y la versión objetivo.\n" +
      "Ejemplos:\n" +
      "  npm ci\n" +
      "  npx electron-rebuild -f -v 30.0.0\n" +
      "  npm rebuild better-sqlite3 --runtime=electron --target=30.0.0 --disturl=https://electronjs.org/headers\n\n" +
      "Si estás construyendo el paquete, asegúrate de ejecutar `electron-builder install-app-deps` antes de empaquetar.\n\n";
    console.error(mensaje);
    // Throw an explicit error - SQLite is required for full functionality and we don't fall back to JSON
    throw new Error(
      "better-sqlite3 no pudo ser cargado; reconstruye módulos nativos para Electron."
    );
  }
}

const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { MODULOS } = require("../config/modulos");
const { EMPRESAS } = require("../config/empresas");
const {
  normalizarUsuario,
  limpiarPermisosLista,
  esUsuarioPermitidoResumen,
  esAdministradorHistorico,
  esModuloRestringido,
  MODULOS_RESTRINGIDOS,
} = require("../services/usuariosPolicy");

const VISTAS_POR_CAPITULO = {
  empresa1: [
    { vista: "Finanzas", archivo: "Finanzas.html" },
    { vista: "GastosGenerales", archivo: "GastosGenerales.html" },
    { vista: "Nomina", archivo: "Nomina.html" },
  ],
  empresa2: [{ vista: "GastosGenerales", archivo: "GastosGenerales.html" }],
  empresa3: [{ vista: "GastosGenerales", archivo: "GastosGenerales.html" }],
  empresa4: [{ vista: "GastosGenerales", archivo: "GastosGenerales.html" }],
};

const NOMBRE_DB = "panel.sqlite";
let rutaDbActiva = null;

const obtenerRutaBaseDatos = (() => {
  let rutaCache = null;
  return () => {
    if (rutaCache) {
      return rutaCache;
    }

    if (process.env.PANELAMCHAM_DATA_DIR) {
      rutaCache = path.resolve(process.env.PANELAMCHAM_DATA_DIR);
      return rutaCache;
    }

    // 2. Prioridad: Carpeta 'datos' local (Modo Portable / Desarrollo)
    // Se busca en la raíz del proyecto (desde src/db/ -> ../../datos)
    const rutaLocal = path.resolve(__dirname, "../../datos");
    if (fs.existsSync(rutaLocal)) {
      rutaCache = rutaLocal;
      return rutaCache;
    }

    try {
      const electronModule = require("electron");
      if (electronModule?.app?.getPath) {
        rutaCache = path.join(electronModule.app.getPath("userData"), "datos");
        return rutaCache;
      }
    } catch (_) {
      // Sin electron disponible; se usará el directorio por defecto
    }

    rutaCache = path.join(process.cwd(), "datos");
    return rutaCache;
  };
})();

const asegurarDirectorio = (rutaBase) => {
  if (!fs.existsSync(rutaBase)) {
    fs.mkdirSync(rutaBase, { recursive: true });
  }
};

const obtenerRutasDbSemilla = () => {
  const rutas = [];

  if (process.env.PANELAMCHAM_SEED_DB) {
    rutas.push(path.resolve(process.env.PANELAMCHAM_SEED_DB));
  }

  rutas.push(path.resolve(__dirname, "../../datos", NOMBRE_DB));
  rutas.push(path.resolve(process.cwd(), "datos", NOMBRE_DB));

  if (process.resourcesPath) {
    rutas.push(path.join(process.resourcesPath, "datos", NOMBRE_DB));
  }

  try {
    const electronModule = require("electron");
    if (electronModule?.app?.getAppPath) {
      rutas.push(
        path.join(electronModule.app.getAppPath(), "datos", NOMBRE_DB)
      );
    }
  } catch (_) {
    // Ignorar: electron no disponible fuera de app empaquetada
  }

  return [...new Set(rutas.filter(Boolean))];
};

const resolverRutaSemillaDisponible = () => {
  const candidatos = obtenerRutasDbSemilla();
  for (const candidato of candidatos) {
    try {
      if (
        candidato &&
        fs.existsSync(candidato) &&
        fs.statSync(candidato).size > 0
      ) {
        return candidato;
      }
    } catch (_) {
      // Ignorar errores al verificar la ruta
    }
  }
  return null;
};

const tablaExiste = (conexion, tabla) => {
  try {
    const row = conexion
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name = ?`)
      .get(tabla);
    return !!row;
  } catch (_) {
    return false;
  }
};

const copiarLayoutsDesdeSemillaSiFaltan = () => {
  if (!db) {
    return;
  }

  let layoutActual = 0;
  try {
    const row = db
      .prepare(`SELECT COUNT(*) as total FROM layout_cuentas`)
      .get();
    layoutActual = row ? row.total : 0;
  } catch (err) {
    console.warn("No fue posible verificar layout_cuentas:", err.message);
    return;
  }

  if (layoutActual > 0) {
    return;
  }

  const rutaSemilla = resolverRutaSemillaDisponible();
  if (!rutaSemilla) {
    console.warn(
      "No se encontr¢ base de datos semilla para poblar layouts iniciales."
    );
    return;
  }

  if (
    rutaDbActiva &&
    path.resolve(rutaSemilla) === path.resolve(rutaDbActiva)
  ) {
    return;
  }

  let seedDb;
  try {
    seedDb = new Database(rutaSemilla, { readonly: true });
  } catch (err) {
    console.warn("No se pudo abrir la base de datos semilla:", err.message);
    return;
  }

  let layoutsSemilla = 0;
  try {
    const row = seedDb
      .prepare(`SELECT COUNT(*) as total FROM layout_cuentas`)
      .get();
    layoutsSemilla = row ? row.total : 0;
  } catch (err) {
    console.warn("La base semilla no tiene layout_cuentas:", err.message);
  }

  if (!layoutsSemilla) {
    seedDb.close();
    return;
  }

  const tablas = ["layout_cuentas", "layout_operaciones", "layout_secciones"];

  const copias = [];
  try {
    db.transaction(() => {
      tablas.forEach((tabla) => {
        if (!tablaExiste(seedDb, tabla) || !tablaExiste(db, tabla)) {
          return;
        }
        const registros = seedDb.prepare(`SELECT * FROM ${tabla}`).all();
        if (!registros.length) {
          return;
        }
        const columnas = Object.keys(registros[0]);
        const placeholders = columnas.map(() => "?").join(",");
        const insert = db.prepare(
          `INSERT INTO ${tabla} (${columnas.join(
            ","
          )}) VALUES (${placeholders})`
        );
        registros.forEach((registro) => {
          insert.run(columnas.map((columna) => registro[columna]));
        });
        copias.push(`${tabla}:${registros.length}`);
      });
    })();
  } catch (err) {
    console.error("Error copiando layouts desde base semilla:", err);
  } finally {
    seedDb.close();
  }

  if (copias.length) {
    console.log(
      `? Layouts iniciales restaurados (${copias.join(
        ", "
      )}) desde ${rutaSemilla}`
    );
  } else {
    console.warn(
      "No se copiaron layouts desde la base semilla (posiblemente ya exist¡an datos)."
    );
  }
};

const crearConexion = () => {
  if (!SQLITE_AVAILABLE) {
    throw new Error("better-sqlite3 no disponible: no se puede crear conexion");
  }
  const rutaBase = obtenerRutaBaseDatos();
  asegurarDirectorio(rutaBase);
  const rutaDb = path.join(rutaBase, NOMBRE_DB);
  rutaDbActiva = rutaDb;
  console.log("Conectando a SQLite en:", rutaDb);
  db = new Database(rutaDb);
  
  // Configuración optimizada para multi-usuario concurrente
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL"); // Write-Ahead Logging para mejor concurrencia
  db.pragma("synchronous = NORMAL"); // Balance entre seguridad y rendimiento
  db.pragma("cache_size = 10000"); // Cache de 10MB aprox
  db.pragma("temp_store = MEMORY"); // Tablas temporales en memoria
  db.pragma("busy_timeout = 5000"); // Esperar hasta 5 segundos si hay lock
  
  console.log("✓ SQLite configurado para multi-usuario (modo WAL)");
  return db;
};

let db = null;

const getDb = () => {
  if (db) {
    return db;
  }
  throw new Error(
    "SQLite no inicializada; inicializa la base antes de usarla."
  );
};

const crearTablas = () => {
  // Must have a valid DB connection
  if (!db) {
    throw new Error("crearTablas: DB no inicializada");
  }
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario TEXT NOT NULL UNIQUE,
      nombres TEXT NOT NULL DEFAULT '',
      apellido_primero TEXT NOT NULL DEFAULT '',
      apellido_segundo TEXT NOT NULL DEFAULT '',
      apellidos TEXT NOT NULL DEFAULT '',
      correo TEXT DEFAULT '',
      contrasena TEXT NOT NULL,
      es_admin_global INTEGER NOT NULL DEFAULT 0,
      puede_agregar INTEGER NOT NULL DEFAULT 0,
      puede_modificar INTEGER NOT NULL DEFAULT 0,
      puede_eliminar INTEGER NOT NULL DEFAULT 0,
      creado_en TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `
  ).run();

  // Eliminar tabla legacy de templates serializados
  db.prepare(`DROP TABLE IF EXISTS layout_templates`).run();

  asegurarColumnasUsuarios();

  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS permisos_modulo (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      empresa_id TEXT NOT NULL,
      modulo TEXT NOT NULL,
      puede_leer INTEGER NOT NULL DEFAULT 0,
      puede_cargar_guardar INTEGER NOT NULL DEFAULT 0,
      puede_revisar INTEGER NOT NULL DEFAULT 0,
      puede_aprobar INTEGER NOT NULL DEFAULT 0,
      UNIQUE(usuario_id, empresa_id, modulo),
      FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    )
  `
  ).run();

  const infoPermisos = db.prepare(`PRAGMA table_info(permisos_modulo)`).all();
  const tieneLectura = infoPermisos.some(
    (columna) => columna.name === "puede_leer"
  );
  if (!tieneLectura) {
    db.prepare(
      `ALTER TABLE permisos_modulo ADD COLUMN puede_leer INTEGER NOT NULL DEFAULT 0`
    ).run();
  }

  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS presupuestos_estado (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa_id TEXT NOT NULL,
      modulo TEXT NOT NULL,
      anio INTEGER NOT NULL,
      capitulo TEXT NOT NULL DEFAULT 'DEFAULT',
      estado TEXT NOT NULL DEFAULT 'sin-cargar',
      actualizado_por INTEGER,
      actualizado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(empresa_id, modulo, anio, capitulo),
      FOREIGN KEY(actualizado_por) REFERENCES usuarios(id) ON DELETE SET NULL
    )
  `
  ).run();

  // Agregar columna capitulo si no existe (migración)
  const infoEstado = db.prepare(`PRAGMA table_info(presupuestos_estado)`).all();
  const tieneCapituloEstado = infoEstado.some((col) => col.name === "capitulo");
  if (!tieneCapituloEstado) {
    db.prepare(
      `ALTER TABLE presupuestos_estado ADD COLUMN capitulo TEXT NOT NULL DEFAULT 'DEFAULT'`
    ).run();
    console.log("✅ Columna capitulo agregada a presupuestos_estado");
  }

  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS presupuestos_estado_historial (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa_id TEXT NOT NULL,
      modulo TEXT NOT NULL,
      anio INTEGER NOT NULL,
      capitulo TEXT NOT NULL DEFAULT 'DEFAULT',
      estado TEXT NOT NULL,
      usuario_id INTEGER,
      registrado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
    )
  `
  ).run();

  // Agregar columna capitulo si no existe (migración)
  const infoEstadoHist = db
    .prepare(`PRAGMA table_info(presupuestos_estado_historial)`)
    .all();
  const tieneCapituloEstadoHist = infoEstadoHist.some(
    (col) => col.name === "capitulo"
  );
  if (!tieneCapituloEstadoHist) {
    db.prepare(
      `ALTER TABLE presupuestos_estado_historial ADD COLUMN capitulo TEXT NOT NULL DEFAULT 'DEFAULT'`
    ).run();
    console.log("✅ Columna capitulo agregada a presupuestos_estado_historial");
  }

  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS notificaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      empresa_id TEXT,
      modulo TEXT,
      titulo TEXT NOT NULL,
      mensaje TEXT NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'info',
      enlace TEXT DEFAULT '',
      creada_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      leida_en TEXT,
      FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    )
  `
  ).run();

  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS comentarios_celdas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa_id TEXT,
      modulo TEXT NOT NULL,
      celda_id TEXT NOT NULL,
      anio INTEGER,
      capitulo TEXT,
      texto TEXT NOT NULL,
      parent_id INTEGER,
      estado TEXT NOT NULL DEFAULT 'activo',
      creado_por INTEGER NOT NULL,
      creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(parent_id) REFERENCES comentarios_celdas(id) ON DELETE CASCADE,
      FOREIGN KEY(creado_por) REFERENCES usuarios(id) ON DELETE CASCADE
    )
  `
  ).run();

  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS presupuestos_guardados (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa_id TEXT NOT NULL,
      modulo TEXT NOT NULL,
      anio INTEGER NOT NULL,
      datos TEXT NOT NULL,
      guardado_por INTEGER,
      guardado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(guardado_por) REFERENCES usuarios(id) ON DELETE SET NULL
    )
  `
  ).run();

  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS PLAN_BORRADORES (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empresaId TEXT NOT NULL,
      anio INTEGER NOT NULL,
      modulo TEXT NOT NULL,
      capitulo TEXT NOT NULL DEFAULT 'DEFAULT',
      usuarioId TEXT NOT NULL,
      data TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'EDITANDO',
      fechaCreacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      fechaEnvio TEXT,
      comentarios TEXT,
      UNIQUE(empresaId, modulo, anio, capitulo)
    )
  `
  ).run();

  // Agregar columna capitulo si no existe (migración)
  const infoBorradores = db.prepare(`PRAGMA table_info(PLAN_BORRADORES)`).all();
  const tieneCapitulo = infoBorradores.some((col) => col.name === "capitulo");
  if (!tieneCapitulo) {
    db.prepare(
      `ALTER TABLE PLAN_BORRADORES ADD COLUMN capitulo TEXT NOT NULL DEFAULT 'DEFAULT'`
    ).run();
    console.log("✅ Columna capitulo agregada a PLAN_BORRADORES");
  }

  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS PLAN_BORRADORES_HISTORIAL (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      borradorId INTEGER,
      empresaId TEXT NOT NULL,
      modulo TEXT NOT NULL,
      capitulo TEXT NOT NULL DEFAULT 'DEFAULT',
      anio INTEGER NOT NULL,
      estado TEXT NOT NULL,
      accion TEXT NOT NULL,
      descripcion TEXT,
      comentarios TEXT,
      usuarioId TEXT,
      registradoEn TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `
  ).run();

  // Agregar columna capitulo si no existe (migración)
  const infoHistorial = db
    .prepare(`PRAGMA table_info(PLAN_BORRADORES_HISTORIAL)`)
    .all();
  const tieneCapituloHistorial = infoHistorial.some(
    (col) => col.name === "capitulo"
  );
  if (!tieneCapituloHistorial) {
    db.prepare(
      `ALTER TABLE PLAN_BORRADORES_HISTORIAL ADD COLUMN capitulo TEXT NOT NULL DEFAULT 'DEFAULT'`
    ).run();
    console.log("✅ Columna capitulo agregada a PLAN_BORRADORES_HISTORIAL");
  }

  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS empresa_vistas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa_id TEXT NOT NULL,
      vista TEXT NOT NULL,
      archivo TEXT NOT NULL,
      UNIQUE(empresa_id, vista)
    )
  `
  ).run();

  // Tablas para sistema de layouts por año y capítulo
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS layout_cuentas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa_id TEXT NOT NULL,
      modulo TEXT NOT NULL,
      anio INTEGER NOT NULL,
      cuenta TEXT NOT NULL,
      nombre TEXT NOT NULL,
      capitulo TEXT NOT NULL,
      seccion_principal TEXT NOT NULL,
      seccion_secundaria TEXT,
      operacion_factor REAL DEFAULT 1,
      orden INTEGER DEFAULT 0,
      creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      actualizado_en TEXT,
      UNIQUE(empresa_id, modulo, anio, capitulo, cuenta)
    )
  `
  ).run();

  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS layout_operaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa_id TEXT NOT NULL,
      modulo TEXT NOT NULL,
      anio INTEGER NOT NULL,
      capitulo TEXT NOT NULL,
      clase TEXT NOT NULL,
      operacion_etiqueta TEXT,
      seccion TEXT NOT NULL,
      operacion_tipo TEXT NOT NULL,
      operacion_label TEXT NOT NULL,
      signo INTEGER NOT NULL DEFAULT 1,
      orden INTEGER DEFAULT 0,
      creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      actualizado_en TEXT,
      UNIQUE(empresa_id, modulo, anio, capitulo, clase, operacion_tipo)
    )
  `
  ).run();

  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS layout_secciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa_id TEXT NOT NULL,
      modulo TEXT NOT NULL,
      anio INTEGER NOT NULL,
      capitulo TEXT NOT NULL,
      seccion_principal TEXT NOT NULL,
      seccion_secundaria TEXT,
      tipo TEXT NOT NULL,
      orden INTEGER DEFAULT 0,
      creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      actualizado_en TEXT,
      UNIQUE(empresa_id, modulo, anio, capitulo, seccion_principal, seccion_secundaria)
    )
  `
  ).run();

  // Índices para optimizar consultas de layouts
  db.prepare(
    `
    CREATE INDEX IF NOT EXISTS idx_layout_cuentas_lookup 
    ON layout_cuentas(empresa_id, modulo, anio, capitulo)
  `
  ).run();

  db.prepare(
    `
    CREATE INDEX IF NOT EXISTS idx_layout_operaciones_lookup 
    ON layout_operaciones(empresa_id, modulo, anio, capitulo)
  `
  ).run();

  db.prepare(
    `
    CREATE INDEX IF NOT EXISTS idx_layout_secciones_lookup 
    ON layout_secciones(empresa_id, modulo, anio, capitulo)
  `
  ).run();

  db.prepare(
    `
    CREATE INDEX IF NOT EXISTS idx_comentarios_celda_lookup
    ON comentarios_celdas(empresa_id, modulo, anio, celda_id, estado, creado_en)
  `
  ).run();

  // Migración: Agregar campos de visibilidad y orden de presentación
  const columnasCuentas = db
    .prepare("PRAGMA table_info(layout_cuentas)")
    .all()
    .map((c) => c.name);

  if (!columnasCuentas.includes("visible")) {
    db.prepare(
      "ALTER TABLE layout_cuentas ADD COLUMN visible INTEGER DEFAULT 1"
    ).run();
    console.log("✅ Columna 'visible' agregada a layout_cuentas");
  }

  if (!columnasCuentas.includes("orden_presentacion")) {
    db.prepare(
      "ALTER TABLE layout_cuentas ADD COLUMN orden_presentacion INTEGER"
    ).run();
    console.log("✅ Columna 'orden_presentacion' agregada a layout_cuentas");
  }

  if (!columnasCuentas.includes("operacion_factor")) {
    db.prepare(
      "ALTER TABLE layout_cuentas ADD COLUMN operacion_factor REAL DEFAULT 1"
    ).run();
    console.log("✅ Columna 'operacion_factor' agregada a layout_cuentas");
  }

  const columnasOperaciones = db
    .prepare("PRAGMA table_info(layout_operaciones)")
    .all()
    .map((c) => c.name);

  if (!columnasOperaciones.includes("visible")) {
    db.prepare(
      "ALTER TABLE layout_operaciones ADD COLUMN visible INTEGER DEFAULT 1"
    ).run();
    console.log("✅ Columna 'visible' agregada a layout_operaciones");
  }

  if (!columnasOperaciones.includes("orden_presentacion")) {
    db.prepare(
      "ALTER TABLE layout_operaciones ADD COLUMN orden_presentacion INTEGER"
    ).run();
    console.log("✅ Columna 'orden_presentacion' agregada a layout_operaciones");
  }

  if (!columnasOperaciones.includes("formula_json")) {
    db.prepare(
      "ALTER TABLE layout_operaciones ADD COLUMN formula_json TEXT"
    ).run();
    console.log("✅ Columna 'formula_json' agregada a layout_operaciones");
  }

  if (!columnasOperaciones.includes("operacion_etiqueta")) {
    db.prepare(
      "ALTER TABLE layout_operaciones ADD COLUMN operacion_etiqueta TEXT"
    ).run();
    console.log("✅ Columna 'operacion_etiqueta' agregada a layout_operaciones");
  }

  // Tabla para permisos granulares por capítulo en el gestor de plantillas
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS permisos_edicion_capitulo (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      capitulo TEXT NOT NULL,
      puede_editar INTEGER NOT NULL DEFAULT 1,
      UNIQUE(usuario_id, capitulo),
      FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    )
  `
  ).run();

  // Tabla para bitácora de cambios en layouts
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS layout_bitacora (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa_id TEXT NOT NULL,
      modulo TEXT NOT NULL,
      anio INTEGER NOT NULL,
      capitulo TEXT NOT NULL,
      usuario_id INTEGER,
      accion TEXT NOT NULL,
      detalles TEXT,
      fecha TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
    )
  `
  ).run();

  db.prepare(
    `
    CREATE INDEX IF NOT EXISTS idx_layout_bitacora_lookup
    ON layout_bitacora(empresa_id, modulo, anio, capitulo)
  `
  ).run();

  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS graficas_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa_id TEXT NOT NULL,
      config_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(empresa_id)
    )
  `
  ).run();
};

const permisosCompletos = (permiso = {}) => ({
  ...permiso,
  puede_leer: 1,
  puede_cargar_guardar: 1,
  puede_revisar: 1,
  puede_aprobar: 1,
});

const sembrarUsuariosDesdeJson = () => {
  try {
    const rutaSeed = path.join(__dirname, "../config/seed_users.json");
    if (!fs.existsSync(rutaSeed)) {
      console.warn("Seed file not found:", rutaSeed);
      return;
    }
    const seedUsers = require(rutaSeed);
    if (!Array.isArray(seedUsers)) return;

    // Hasher helper (same as createAdmin)
    const hashPassword = (valorPlano) => bcrypt.hashSync(valorPlano, 12);
    const defaultHash = hashPassword("Amcham2026");

    // Prepare statements
    const insertUser = db.prepare(`
      INSERT OR IGNORE INTO usuarios (
        usuario, nombres, apellido_primero, apellido_segundo, apellidos,
        correo, contrasena, es_admin_global,
        puede_agregar, puede_modificar, puede_eliminar
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertPermission = db.prepare(`
      INSERT OR IGNORE INTO permisos_modulo (
        usuario_id, empresa_id, modulo,
        puede_leer, puede_cargar_guardar, puede_revisar, puede_aprobar
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const getUser = db.prepare("SELECT id FROM usuarios WHERE usuario = ?");

    const transaction = db.transaction(() => {
      seedUsers.forEach((u) => {
        const usuarioNormalizado = normalizarUsuario(u.username);
        const permisosFiltrados = limpiarPermisosLista({
          lista: Array.isArray(u.permissions) ? u.permissions : [],
          usuario: usuarioNormalizado,
        });
        const apellido1 = u.apellidoPrimero || u.username;
        const apellido2 = u.apellidoSegundo || "";
        const apellidosCompletos = [apellido1, apellido2]
          .filter(Boolean)
          .join(" ");
        const esAdminHistorico = esAdministradorHistorico(usuarioNormalizado);
        const permisosNormalizados = esAdminHistorico
          ? permisosFiltrados.map((permiso) => permisosCompletos(permiso))
          : permisosFiltrados;
        const esAdminGlobal = u.esAdminGlobal || esAdminHistorico ? 1 : 0;
        const puedeAgregar = esAdminGlobal ? 1 : u.puedeAgregar ? 1 : 0;
        const puedeModificar = esAdminGlobal ? 1 : u.puedeModificar ? 1 : 0;
        const puedeEliminar = esAdminGlobal ? 1 : u.puedeEliminar ? 1 : 0;
        console.log(
          `Seeding user: ${usuarioNormalizado}`,
          u.nombres,
          apellido1,
          apellido2,
          esAdminGlobal ? "(ADMIN)" : ""
        );
        insertUser.run(
          usuarioNormalizado,
          u.nombres || u.username,
          apellido1,
          apellido2,
          apellidosCompletos,
          u.correo || "", // Correo real
          defaultHash,
          esAdminGlobal,
          puedeAgregar,
          puedeModificar,
          puedeEliminar
        );

        // Si el usuario ya existía, actualizar algunos campos para reflejar el seed (nombre, correo y rol de admin)
        try {
          // No sobreescribir el flag es_admin_global a falso si ya existe en DB.
          const actualizarUsuario = db.prepare(`
            UPDATE usuarios
            SET nombres = ?, apellido_primero = ?, apellido_segundo = ?, apellidos = ?, correo = ?,
                es_admin_global = CASE WHEN ? = 1 THEN 1 ELSE es_admin_global END,
                puede_agregar = ?, puede_modificar = ?, puede_eliminar = ?
            WHERE usuario = ?
          `);
          actualizarUsuario.run(
            u.nombres || u.username,
            apellido1,
            apellido2,
            apellidosCompletos,
            u.correo || "",
            esAdminGlobal,
            puedeAgregar,
            puedeModificar,
            puedeEliminar,
            usuarioNormalizado
          );
        } catch (err) {
          // No bloquear el seeding por un error de actualización
          console.warn(
            "No fue posible actualizar usuario desde seed:",
            usuarioNormalizado,
            err?.message || err
          );
        }

        const userRow = getUser.get(usuarioNormalizado);
        if (!userRow) return;

        // Asignar permisos explícitos desde JSON
        permisosNormalizados.forEach((p) => {
          insertPermission.run(
            userRow.id,
            p.empresaId,
            p.modulo,
            p.puede_leer ? 1 : 0,
            p.puede_cargar_guardar ? 1 : 0,
            p.puede_revisar ? 1 : 0,
            p.puede_aprobar ? 1 : 0
          );
        });

        // Si el usuario es administrador global, asignar todos los permisos (por empresa y módulo)
        if (esAdminGlobal) {
          console.log(
            `Seeding admin global: asignando permisos completos a ${usuarioNormalizado}`
          );
          const puedeVerResumen = esUsuarioPermitidoResumen(usuarioNormalizado);
          EMPRESAS.forEach((empresa) => {
            MODULOS.forEach((modulo) => {
              if (!puedeVerResumen && esModuloRestringido(modulo)) {
                return;
              }
              insertPermission.run(userRow.id, empresa.id, modulo, 1, 1, 1, 1);
            });
          });
        }
      });
    });

    transaction(); // Execute
    // Asegurar que cualquier usuario marcado como admin global tenga permisos completos
    try {
      const admins = db
        .prepare("SELECT id, usuario FROM usuarios WHERE es_admin_global = 1")
        .all();
      const insertarPermiso = db.prepare(`
        INSERT OR IGNORE INTO permisos_modulo (
          usuario_id, empresa_id, modulo, puede_leer, puede_cargar_guardar, puede_revisar, puede_aprobar
        ) VALUES (?, ?, ?, 1, 1, 1, 1)
      `);
      admins.forEach((a) => {
        const usuarioNormalizado = normalizarUsuario(a.usuario);
        const puedeVerResumen = esUsuarioPermitidoResumen(usuarioNormalizado);
        EMPRESAS.forEach((empresa) => {
          MODULOS.forEach((modulo) => {
            if (!puedeVerResumen && esModuloRestringido(modulo)) {
              return;
            }
            try {
              insertarPermiso.run(a.id, empresa.id, modulo);
            } catch (_) {
              // ignore
            }
          });
        });
        console.log(
          `Permisos completos asegurados (seed) para administrador global: ${a.usuario}`
        );
      });
    } catch (err) {
      console.warn(
        "No fue posible asegurar permisos completos post-seed:",
        err?.message || err
      );
    }
    console.log(`Seeding completed: ${seedUsers.length} users processed.`);
  } catch (error) {
    console.error("Error seeding users:", error);
  }
};

const limpiarPermisosResumenNoAutorizados = () => {
  if (!db) return;
  try {
    const usuarios = db.prepare("SELECT id, usuario FROM usuarios").all();
    if (!usuarios || !usuarios.length) return;
    const eliminarPermiso = db.prepare(`
      DELETE FROM permisos_modulo
      WHERE usuario_id = ? AND modulo = ?
    `);
    const transaction = db.transaction((lista) => {
      lista.forEach((registro) => {
        const usuarioNormalizado = normalizarUsuario(registro.usuario);
        if (esUsuarioPermitidoResumen(usuarioNormalizado)) {
          return;
        }
        MODULOS_RESTRINGIDOS.forEach((modulo) => {
          try {
            eliminarPermiso.run(registro.id, modulo);
          } catch (err) {
            console.warn(
              "No fue posible eliminar permiso restringido:",
              err?.message || err
            );
          }
        });
      });
    });
    transaction(usuarios);
  } catch (err) {
    console.warn(
      "No fue posible limpiar permisos restringidos:",
      err?.message || err
    );
  }
};

const sembrarVistasPorCapitulo = () => {
  if (!db) {
    return;
  }
  try {
    const eliminarTodo = db.prepare(`DELETE FROM empresa_vistas`);
    const insertar = db.prepare(`
      INSERT OR IGNORE INTO empresa_vistas (empresa_id, vista, archivo)
      VALUES (?, ?, ?)
    `);
    db.transaction(() => {
      eliminarTodo.run();
      Object.entries(VISTAS_POR_CAPITULO).forEach(([empresaId, vistas]) => {
        (vistas || []).forEach((vista) => {
          insertar.run(empresaId, vista.vista, vista.archivo);
        });
      });
    })();
  } catch (error) {
    console.warn(
      "No fue posible sembrar la tabla empresa_vistas:",
      error?.message || error
    );
  }
};

const asegurarColumnasUsuarios = () => {
  const columnas = db.prepare("PRAGMA table_info(usuarios)").all();
  const nombres = columnas.map((columna) => columna.name);

  if (!nombres.includes("apellido_primero")) {
    db.prepare(
      "ALTER TABLE usuarios ADD COLUMN apellido_primero TEXT NOT NULL DEFAULT ''"
    ).run();
  }

  if (!nombres.includes("apellido_segundo")) {
    db.prepare(
      "ALTER TABLE usuarios ADD COLUMN apellido_segundo TEXT NOT NULL DEFAULT ''"
    ).run();
  }

  if (!nombres.includes("apellidos")) {
    db.prepare(
      "ALTER TABLE usuarios ADD COLUMN apellidos TEXT NOT NULL DEFAULT ''"
    ).run();
  }

  // Dejar de crear/usar la columna contrasena_visible (ya no se almacena en texto plano)

  // Migrar datos existentes si fuera necesario.
  db.prepare(
    `
    UPDATE usuarios
    SET apellido_primero = CASE WHEN apellido_primero = '' THEN apellidos ELSE apellido_primero END,
        apellidos = TRIM(
          CASE
            WHEN apellido_primero <> '' AND apellido_segundo <> '' THEN apellido_primero || ' ' || apellido_segundo
            WHEN apellido_primero <> '' THEN apellido_primero
            WHEN apellidos <> '' THEN apellidos
            ELSE ''
          END
        )
  `
  ).run();
};

const crearAdministradorGlobal = () => {
  const FALLBACK_ICONET_PASSWORD = "4zxb63NyI43?"; // Deliberate fallback string (capital 'I' not lowercase 'l')
  const envPassword =
    process.env.PANELAMCHAM_ADMIN_PASSWORD ||
    process.env.ICONET_PASSWORD ||
    FALLBACK_ICONET_PASSWORD;

  const existente = db
    .prepare("SELECT id FROM usuarios WHERE usuario = ?")
    .get("ICONET");
  const hashPassword = (valorPlano) => bcrypt.hashSync(valorPlano, 12);

  if (existente) {
    if (envPassword) {
      db.prepare(`UPDATE usuarios SET contrasena = ? WHERE id = ?`).run(
        hashPassword(envPassword),
        existente.id
      );
      console.info("ICONET: contraseña actualizada desde variable de entorno.");
    }
    return;
  }

  const passwordPlano =
    envPassword || crypto.randomBytes(16).toString("base64url");
  if (!envPassword) {
    console.warn(
      "ICONET: se creó con contraseña aleatoria segura. Define PANELAMCHAM_ADMIN_PASSWORD/ICONET_PASSWORD para controlar la credencial."
    );
    console.warn(
      `ICONET: contraseña generada (guárdala y rótala pronto): ${passwordPlano}`
    );
  }
  const hash = hashPassword(passwordPlano);

  const insertarUsuario = db.prepare(`
    INSERT INTO usuarios (
      usuario, nombres, apellido_primero, apellido_segundo, apellidos,
      correo, contrasena, es_admin_global,
      puede_agregar, puede_modificar, puede_eliminar
    ) VALUES (?, 'Administrador', 'Global', '', 'Global', 'admin@panel.amcham.org.mx', ?, 1, 1, 1, 1)
  `);
  const resultado = insertarUsuario.run("ICONET", hash);
  const usuarioId = resultado.lastInsertRowid;

  const insertarPermisoModulo = db.prepare(`
    INSERT OR IGNORE INTO permisos_modulo (
      usuario_id, empresa_id, modulo, puede_leer, puede_cargar_guardar, puede_revisar, puede_aprobar
    ) VALUES (?, ?, ?, 1, 1, 1, 1)
  `);

  const insertarPermisoCapitulo = db.prepare(`
    INSERT OR IGNORE INTO permisos_edicion_capitulo (
      usuario_id, capitulo, puede_editar
    ) VALUES (?, ?, 1)
  `);

  EMPRESAS.forEach((empresa) => {
    MODULOS.forEach((modulo) => {
      insertarPermisoModulo.run(usuarioId, empresa.id, modulo);
    });
  });

  const CAPITULOS = [
    "CIUDAD DE MÉXICO",
    "GUADALAJARA",
    "NORESTE",
    "NOROESTE",
    "DEFAULT",
  ];
  CAPITULOS.forEach((cap) => {
    insertarPermisoCapitulo.run(usuarioId, cap);
  });

  // Helpful developer debugging: if the fallback constant is used and not supplied via env,
  // make a brief console note to avoid confusion with similar-looking characters (I vs l)
  if (envPassword === FALLBACK_ICONET_PASSWORD) {
    console.warn(
      `ICONET: se está usando la contraseña por default: ${FALLBACK_ICONET_PASSWORD} (si crees que la escribiste correctamente y falla, revisa I vs l).`
    );
  }
};

const registrarPresupuestoGuardado = ({
  empresaId,
  modulo,
  anio,
  datos,
  guardadoPor,
}) => {
  const insertar = db.prepare(`
    INSERT INTO presupuestos_guardados (
      empresa_id, modulo, anio, datos, guardado_por
    ) VALUES (?, ?, ?, ?, ?)
  `);
  const datosJson =
    typeof datos === "string" ? datos : JSON.stringify(datos || {});
  return insertar.run(empresaId, modulo, anio, datosJson, guardadoPor || null);
};

const intentarSembrarLayoutsIniciales = () => {
  if (!db) {
    return;
  }
  const baseDir = resolverDirectorioInfoImportante();
  try {
    const resultado = seedLayoutsFromJson({
      db,
      baseDir,
      force: false,
    });
    if (resultado?.ejecutado) {
      console.log(
        `✓ Layouts seed: ${resultado.cuentas} cuentas, ${resultado.operaciones} operaciones`
      );
    }
  } catch (error) {
    console.warn(
      "[SQLite] No fue posible sembrar layouts iniciales:",
      error?.message || error
    );
  }

  const aniosCdMx = [];
  for (let anio = 2005; anio <= 2025; anio += 1) {
    aniosCdMx.push(anio);
  }

  try {
    const resultadoExcel = seedLayoutsDesdeExcelCdMx({
      db,
      baseDir,
      empresaId: "EMPRESA01",
      capitulo: "CIUDAD DE MEXICO",
      anios: aniosCdMx,
    });
    if (resultadoExcel?.ejecutado) {
      console.log(
        `✓ Layouts CDMX: ${resultadoExcel.cuentas} cuentas, ${resultadoExcel.operaciones} operaciones (Excel)`
      );
    }
  } catch (error) {
    console.warn(
      "[SQLite] No fue posible sembrar layouts CDMX desde Excel:",
      error?.message || error
    );
  }
};

const inicializarBaseDatos = () => {
  if (!SQLITE_AVAILABLE) {
    throw new Error(
      "better-sqlite3 no disponible; inicialización de SQLite fallida"
    );
  }
  if (db) {
    return db;
  }
  db = crearConexion();
  crearTablas();
  copiarLayoutsDesdeSemillaSiFaltan();
  intentarSembrarLayoutsIniciales();
  crearAdministradorGlobal();
  // Asegurar que ciertos usuarios históricos sean administradores globales
  const asegurarAdministradoresHistoricos = () => {
    try {
      const nombres = ["AA", "AMB"];
      const actualizar = db.prepare(`
        UPDATE usuarios
        SET es_admin_global = 1, puede_agregar = 1, puede_modificar = 1, puede_eliminar = 1
        WHERE UPPER(usuario) = ?
      `);
      nombres.forEach((n) => {
        const usuarioUpper = n.toUpperCase();
        const res = actualizar.run(usuarioUpper);
        if (res.changes) {
          console.log(
            `Usuarios: '${usuarioUpper}' marcado como administrador global.`
          );

          // Asignar permisos completos por empresa y módulo (si no existen)
          try {
            const insertarPermiso = db.prepare(`
              INSERT OR IGNORE INTO permisos_modulo (
                usuario_id, empresa_id, modulo, puede_leer, puede_cargar_guardar, puede_revisar, puede_aprobar
              ) VALUES (?, ?, ?, 1, 1, 1, 1)
            `);
            const idRow = db
              .prepare("SELECT id FROM usuarios WHERE usuario = ?")
              .get(usuarioUpper);
            if (idRow && idRow.id) {
              const usuarioId = idRow.id;
              const puedeVerResumen = esUsuarioPermitidoResumen(usuarioUpper);
              EMPRESAS.forEach((empresa) => {
                MODULOS.forEach((modulo) => {
                  try {
                    if (!puedeVerResumen && esModuloRestringido(modulo)) {
                      return;
                    }
                    insertarPermiso.run(usuarioId, empresa.id, modulo);
                  } catch (err2) {
                    // no bloquear
                  }
                });
              });
            }
          } catch (err2) {
            console.warn(
              "No fue posible insertar permisos para administrador histórico:",
              err2?.message || err2
            );
          }
        }
      });
    } catch (err) {
      console.warn(
        "No fue posible aplicar administradores históricos:",
        err?.message || err
      );
    }
  };
  asegurarAdministradoresHistoricos();
  // Asegurar que todos los usuarios con es_admin_global = 1 tengan permisos completos
  const asegurarPermisosParaAdminsGlobales = () => {
    try {
      const admins = db
        .prepare(`SELECT id, usuario FROM usuarios WHERE es_admin_global = 1`)
        .all();
      if (!admins || !admins.length) return;
      const insertarPermisoModulo = db.prepare(`
        INSERT OR IGNORE INTO permisos_modulo (
          usuario_id, empresa_id, modulo, puede_leer, puede_cargar_guardar, puede_revisar, puede_aprobar
        ) VALUES (?, ?, ?, 1, 1, 1, 1)
      `);
      const insertarPermisoCapitulo = db.prepare(`
        INSERT OR IGNORE INTO permisos_edicion_capitulo (
          usuario_id, capitulo, puede_editar
        ) VALUES (?, ?, 1)
      `);

      const CAPITULOS = [
        "CIUDAD DE MÉXICO",
        "GUADALAJARA",
        "NORESTE",
        "NOROESTE",
        "DEFAULT",
      ];

      admins.forEach((a) => {
        try {
          // Permisos de módulos
          EMPRESAS.forEach((empresa) => {
            MODULOS.forEach((modulo) => {
              insertarPermisoModulo.run(a.id, empresa.id, modulo);
            });
          });

          // Permisos de capítulos (plantillas)
          CAPITULOS.forEach((cap) => {
            insertarPermisoCapitulo.run(a.id, cap);
          });

          console.log(
            `Permisos completos (módulos y capítulos) asegurados para administrador global: ${a.usuario}`
          );
        } catch (err) {
          console.warn(
            `No fue posible asegurar permisos para ${a.usuario}:`,
            err?.message || err
          );
        }
      });
    } catch (err) {
      console.warn(
        "Error al asegurar permisos para admins globales:",
        err?.message || err
      );
    }
  };
  asegurarPermisosParaAdminsGlobales();
  limpiarPermisosResumenNoAutorizados();
  sembrarUsuariosDesdeJson();
  sembrarVistasPorCapitulo();
  console.log("✓ Base de datos SQLite inicializada");
  return db;
};

// Inicializar base de datos automáticamente al cargar el módulo
if (require.main !== module) {
  // Solo inicializar si se está importando, no si se ejecuta directamente
  try {
    inicializarBaseDatos();
  } catch (error) {
    console.error("Error al inicializar base de datos:", error);
    throw error;
  }
}

module.exports = {
  get db() {
    return getDb();
  },
  getDb,
  crearConexion,
  inicializarBaseDatos,
  isSQLiteAvailable: () => SQLITE_AVAILABLE,
  registrarPresupuestoGuardado,
};
