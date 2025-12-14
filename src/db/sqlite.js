const path = require("path");
const fs = require("fs");
const { ensureActiveBinary } = require("../utils/betterSqlite3Manager");
const {
  seedLayoutsFromJson,
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
    const unpackedPath = __dirname.replace('app.asar', 'app.asar.unpacked');
    const betterSqlite3Path = path.join(unpackedPath, '../../node_modules/better-sqlite3');
    Database = require(betterSqlite3Path);
  } catch (err2) {
    // No es posible cargar better-sqlite3. Crash early and give instructions.
    const mensaje = `\n\n❌ better-sqlite3 no pudo ser cargado: ${err2 && err2.message ? err2.message : err2}\n\n` +
      'Para usar SQLite (obligatorio), reconstruye los módulos nativos para el runtime de Electron y la versión objetivo.\n' +
      'Ejemplos:\n' +
      '  npm ci\n' +
      '  npx electron-rebuild -f -v 30.0.0\n' +
      '  npm rebuild better-sqlite3 --runtime=electron --target=30.0.0 --disturl=https://electronjs.org/headers\n\n' +
      'Si estás construyendo el paquete, asegúrate de ejecutar `electron-builder install-app-deps` antes de empaquetar.\n\n';
    console.error(mensaje);
    // Throw an explicit error - SQLite is required for full functionality and we don't fall back to JSON
    throw new Error('better-sqlite3 no pudo ser cargado; reconstruye módulos nativos para Electron.');
  }
}

const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { MODULOS } = require("../config/modulos");
const { EMPRESAS } = require("../config/empresas");

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
      rutas.push(path.join(electronModule.app.getAppPath(), "datos", NOMBRE_DB));
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
      if (candidato && fs.existsSync(candidato) && fs.statSync(candidato).size > 0) {
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
    const row = db.prepare(`SELECT COUNT(*) as total FROM layout_cuentas`).get();
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
    console.warn("No se encontr¢ base de datos semilla para poblar layouts iniciales.");
    return;
  }

  if (rutaDbActiva && path.resolve(rutaSemilla) === path.resolve(rutaDbActiva)) {
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
    const row = seedDb.prepare(`SELECT COUNT(*) as total FROM layout_cuentas`).get();
    layoutsSemilla = row ? row.total : 0;
  } catch (err) {
    console.warn("La base semilla no tiene layout_cuentas:", err.message);
  }

  if (!layoutsSemilla) {
    seedDb.close();
    return;
  }

  const tablas = [
    "layout_cuentas",
    "layout_operaciones",
    "layout_secciones",
  ];

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
          `INSERT INTO ${tabla} (${columnas.join(",")}) VALUES (${placeholders})`
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
    console.log(`? Layouts iniciales restaurados (${copias.join(", ")}) desde ${rutaSemilla}`);
  } else {
    console.warn("No se copiaron layouts desde la base semilla (posiblemente ya exist¡an datos).");
  }
};

const crearConexion = () => {
  if (!SQLITE_AVAILABLE) {
    throw new Error('better-sqlite3 no disponible: no se puede crear conexion');
  }
  const rutaBase = obtenerRutaBaseDatos();
  asegurarDirectorio(rutaBase);
  const rutaDb = path.join(rutaBase, NOMBRE_DB);
  rutaDbActiva = rutaDb;
  console.log("Conectando a SQLite en:", rutaDb);
  db = new Database(rutaDb);
  db.pragma("foreign_keys = ON");
  return db;
};

let db = null;

const crearTablas = () => {
  // Must have a valid DB connection
  if (!db) {
    throw new Error('crearTablas: DB no inicializada');
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
  const tieneCapituloEstado = infoEstado.some(col => col.name === 'capitulo');
  if (!tieneCapituloEstado) {
    db.prepare(`ALTER TABLE presupuestos_estado ADD COLUMN capitulo TEXT NOT NULL DEFAULT 'DEFAULT'`).run();
    console.log('✅ Columna capitulo agregada a presupuestos_estado');
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
  const infoEstadoHist = db.prepare(`PRAGMA table_info(presupuestos_estado_historial)`).all();
  const tieneCapituloEstadoHist = infoEstadoHist.some(col => col.name === 'capitulo');
  if (!tieneCapituloEstadoHist) {
    db.prepare(`ALTER TABLE presupuestos_estado_historial ADD COLUMN capitulo TEXT NOT NULL DEFAULT 'DEFAULT'`).run();
    console.log('✅ Columna capitulo agregada a presupuestos_estado_historial');
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
  const tieneCapitulo = infoBorradores.some(col => col.name === 'capitulo');
  if (!tieneCapitulo) {
    db.prepare(`ALTER TABLE PLAN_BORRADORES ADD COLUMN capitulo TEXT NOT NULL DEFAULT 'DEFAULT'`).run();
    console.log('✅ Columna capitulo agregada a PLAN_BORRADORES');
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
  const infoHistorial = db.prepare(`PRAGMA table_info(PLAN_BORRADORES_HISTORIAL)`).all();
  const tieneCapituloHistorial = infoHistorial.some(col => col.name === 'capitulo');
  if (!tieneCapituloHistorial) {
    db.prepare(`ALTER TABLE PLAN_BORRADORES_HISTORIAL ADD COLUMN capitulo TEXT NOT NULL DEFAULT 'DEFAULT'`).run();
    console.log('✅ Columna capitulo agregada a PLAN_BORRADORES_HISTORIAL');
  }

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
  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_layout_cuentas_lookup 
    ON layout_cuentas(empresa_id, modulo, anio, capitulo)
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_layout_operaciones_lookup 
    ON layout_operaciones(empresa_id, modulo, anio, capitulo)
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_layout_secciones_lookup 
    ON layout_secciones(empresa_id, modulo, anio, capitulo)
  `).run();
};

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
        // Create user with real data from JSON
        const apellido1 = u.apellidoPrimero || u.username;
        const apellido2 = u.apellidoSegundo || '';
        const apellidosCompletos = [apellido1, apellido2].filter(Boolean).join(' ');
        const esAdminGlobal = u.esAdminGlobal ? 1 : 0;
        const puedeAgregar = u.puedeAgregar ? 1 : 0;
        const puedeModificar = u.puedeModificar ? 1 : 0;
        const puedeEliminar = u.puedeEliminar ? 1 : 0;
        console.log(
          `Seeding user: ${u.username}`,
          u.nombres,
          apellido1,
          apellido2,
          esAdminGlobal ? '(ADMIN)' : ''
        );
        insertUser.run(
          u.username,
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

        const userRow = getUser.get(u.username);
        if (!userRow) return;

        // Asignar permisos
        if (Array.isArray(u.permissions)) {
          u.permissions.forEach((p) => {
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
        }
      });
    });

    transaction(); // Execute
    console.log(`Seeding completed: ${seedUsers.length} users processed.`);
  } catch (error) {
    console.error("Error seeding users:", error);
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

  const insertarPermiso = db.prepare(`
    INSERT OR IGNORE INTO permisos_modulo (
      usuario_id, empresa_id, modulo, puede_leer, puede_cargar_guardar, puede_revisar, puede_aprobar
    ) VALUES (?, ?, ?, 1, 1, 1, 1)
  `);

  EMPRESAS.forEach((empresa) => {
    MODULOS.forEach((modulo) => {
      insertarPermiso.run(usuarioId, empresa.id, modulo);
    });
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
  try {
    const resultado = seedLayoutsFromJson({
      db,
      baseDir: resolverDirectorioInfoImportante(),
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
};

const inicializarBaseDatos = () => {
  if (!SQLITE_AVAILABLE) {
    throw new Error('better-sqlite3 no disponible; inicialización de SQLite fallida');
  }
  db = crearConexion();
  crearTablas();
  copiarLayoutsDesdeSemillaSiFaltan();
  intentarSembrarLayoutsIniciales();
  crearAdministradorGlobal();
  sembrarUsuariosDesdeJson();
  console.log('✓ Base de datos SQLite inicializada');
  return true;
};

// Inicializar base de datos automáticamente al cargar el módulo
if (require.main !== module) {
  // Solo inicializar si se está importando, no si se ejecuta directamente
  try {
    inicializarBaseDatos();
  } catch (error) {
    console.error('Error al inicializar base de datos:', error);
  }
}

module.exports = {
  db,
  crearConexion,
  inicializarBaseDatos,
  isSQLiteAvailable: () => SQLITE_AVAILABLE,
  registrarPresupuestoGuardado,
};
