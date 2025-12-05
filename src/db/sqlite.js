const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { MODULOS } = require('../config/modulos');
const { EMPRESAS } = require('../config/empresas');

const NOMBRE_DB = 'panel.sqlite';

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

    try {
      const electronModule = require('electron');
      if (electronModule?.app?.getPath) {
        rutaCache = path.join(electronModule.app.getPath('userData'), 'datos');
        return rutaCache;
      }
    } catch (_) {
      // Sin electron disponible; se usará el directorio por defecto
    }

    rutaCache = path.join(process.cwd(), 'datos');
    return rutaCache;
  };
})();

const asegurarDirectorio = (rutaBase) => {
  if (!fs.existsSync(rutaBase)) {
    fs.mkdirSync(rutaBase, { recursive: true });
  }
};

const crearConexion = () => {
  const rutaBase = obtenerRutaBaseDatos();
  asegurarDirectorio(rutaBase);
  const rutaDb = path.join(rutaBase, NOMBRE_DB);
  const conexion = new Database(rutaDb);
  conexion.pragma('foreign_keys = ON');
  return conexion;
};

const db = crearConexion();

const crearTablas = () => {
  db.prepare(`
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
  `).run();

  asegurarColumnasUsuarios();

  db.prepare(`
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
  `).run();

  const infoPermisos = db.prepare(`PRAGMA table_info(permisos_modulo)`).all();
  const tieneLectura = infoPermisos.some((columna) => columna.name === 'puede_leer');
  if (!tieneLectura) {
    db.prepare(`ALTER TABLE permisos_modulo ADD COLUMN puede_leer INTEGER NOT NULL DEFAULT 0`).run();
  }

  db.prepare(`
    CREATE TABLE IF NOT EXISTS presupuestos_estado (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa_id TEXT NOT NULL,
      modulo TEXT NOT NULL,
      anio INTEGER NOT NULL,
      estado TEXT NOT NULL DEFAULT 'sin-cargar',
      actualizado_por INTEGER,
      actualizado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(empresa_id, modulo, anio),
      FOREIGN KEY(actualizado_por) REFERENCES usuarios(id) ON DELETE SET NULL
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS presupuestos_estado_historial (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa_id TEXT NOT NULL,
      modulo TEXT NOT NULL,
      anio INTEGER NOT NULL,
      estado TEXT NOT NULL,
      usuario_id INTEGER,
      registrado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
    )
  `).run();

  db.prepare(`
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
  `).run();

  db.prepare(`
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
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS PLAN_BORRADORES (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empresaId TEXT NOT NULL,
      anio INTEGER NOT NULL,
      modulo TEXT NOT NULL,
      usuarioId TEXT NOT NULL,
      data TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'EDITANDO',
      fechaCreacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      fechaEnvio TEXT,
      comentarios TEXT,
      UNIQUE(empresaId, modulo, anio)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS PLAN_BORRADORES_HISTORIAL (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      borradorId INTEGER,
      empresaId TEXT NOT NULL,
      modulo TEXT NOT NULL,
      anio INTEGER NOT NULL,
      estado TEXT NOT NULL,
      accion TEXT NOT NULL,
      descripcion TEXT,
      comentarios TEXT,
      usuarioId TEXT,
      registradoEn TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
};

const asegurarColumnasUsuarios = () => {
  const columnas = db.prepare('PRAGMA table_info(usuarios)').all();
  const nombres = columnas.map((columna) => columna.name);

  if (!nombres.includes('apellido_primero')) {
    db.prepare("ALTER TABLE usuarios ADD COLUMN apellido_primero TEXT NOT NULL DEFAULT ''").run();
  }

  if (!nombres.includes('apellido_segundo')) {
    db.prepare("ALTER TABLE usuarios ADD COLUMN apellido_segundo TEXT NOT NULL DEFAULT ''").run();
  }

  if (!nombres.includes('apellidos')) {
    db.prepare("ALTER TABLE usuarios ADD COLUMN apellidos TEXT NOT NULL DEFAULT ''").run();
  }

  // Dejar de crear/usar la columna contrasena_visible (ya no se almacena en texto plano)

  // Migrar datos existentes si fuera necesario.
  db.prepare(`
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
  `).run();
};

const crearAdministradorGlobal = () => {
  const envPassword = process.env.PANELAMCHAM_ADMIN_PASSWORD || process.env.ICONET_PASSWORD || null;
  const existente = db.prepare('SELECT id FROM usuarios WHERE usuario = ?').get('ICONET');
  const hashPassword = (valorPlano) => bcrypt.hashSync(valorPlano, 12);

  if (existente) {
    if (envPassword) {
      db.prepare(`UPDATE usuarios SET contrasena = ? WHERE id = ?`).run(hashPassword(envPassword), existente.id);
      console.info('ICONET: contraseña actualizada desde variable de entorno.');
    }
    return;
  }

  const passwordPlano = envPassword || crypto.randomBytes(16).toString('base64url');
  if (!envPassword) {
    console.warn('ICONET: se creó con contraseña aleatoria segura. Define PANELAMCHAM_ADMIN_PASSWORD/ICONET_PASSWORD para controlar la credencial.');
    console.warn(`ICONET: contraseña generada (guárdala y rótala pronto): ${passwordPlano}`);
  }
  const hash = hashPassword(passwordPlano);

  const insertarUsuario = db.prepare(`
    INSERT INTO usuarios (
      usuario, nombres, apellido_primero, apellido_segundo, apellidos,
      correo, contrasena, es_admin_global,
      puede_agregar, puede_modificar, puede_eliminar
    ) VALUES (?, 'Administrador', 'General', '', 'General', 'admin@amcham.org', ?, 1, 1, 1, 1)
  `);
  const resultado = insertarUsuario.run('ICONET', hash);
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
};

const registrarPresupuestoGuardado = ({ empresaId, modulo, anio, datos, guardadoPor }) => {
  const insertar = db.prepare(`
    INSERT INTO presupuestos_guardados (
      empresa_id, modulo, anio, datos, guardado_por
    ) VALUES (?, ?, ?, ?, ?)
  `);
  const datosJson = typeof datos === 'string' ? datos : JSON.stringify(datos || {});
  return insertar.run(empresaId, modulo, anio, datosJson, guardadoPor || null);
};

const inicializarBaseDatos = () => {
  crearTablas();
  crearAdministradorGlobal();
};

module.exports = {
  db,
  inicializarBaseDatos,
  registrarPresupuestoGuardado
};
