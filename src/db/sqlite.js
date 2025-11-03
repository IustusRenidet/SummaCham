const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const { MODULOS } = require('../config/modulos');
const { EMPRESAS } = require('../config/empresas');

const RUTA_BASE = path.join(__dirname, 'datos');
const RUTA_DB = path.join(RUTA_BASE, 'panel.sqlite');

const asegurarDirectorio = () => {
  if (!fs.existsSync(RUTA_BASE)) {
    fs.mkdirSync(RUTA_BASE, { recursive: true });
  }
};

const crearConexion = () => {
  asegurarDirectorio();
  const conexion = new Database(RUTA_DB);
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

  db.prepare(`
    CREATE TABLE IF NOT EXISTS permisos_modulo (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      empresa_id TEXT NOT NULL,
      modulo TEXT NOT NULL,
      puede_cargar_guardar INTEGER NOT NULL DEFAULT 0,
      puede_revisar INTEGER NOT NULL DEFAULT 0,
      puede_aprobar INTEGER NOT NULL DEFAULT 0,
      UNIQUE(usuario_id, empresa_id, modulo),
      FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    )
  `).run();
};

const crearAdministradorGlobal = () => {
  const existente = db.prepare('SELECT id FROM usuarios WHERE usuario = ?').get('ICONET');
  if (existente) {
    return;
  }

  const hash = bcrypt.hashSync('4zxb63Nyl43?', 12);
  const insertarUsuario = db.prepare(`
    INSERT INTO usuarios (
      usuario, nombres, apellidos, correo, contrasena, es_admin_global,
      puede_agregar, puede_modificar, puede_eliminar
    ) VALUES (?, '', '', '', ?, 1, 1, 1, 1)
  `);
  const resultado = insertarUsuario.run('ICONET', hash);
  const usuarioId = resultado.lastInsertRowid;

  const insertarPermiso = db.prepare(`
    INSERT OR IGNORE INTO permisos_modulo (
      usuario_id, empresa_id, modulo, puede_cargar_guardar, puede_revisar, puede_aprobar
    ) VALUES (?, ?, ?, 1, 1, 1)
  `);

  EMPRESAS.forEach((empresa) => {
    MODULOS.forEach((modulo) => {
      insertarPermiso.run(usuarioId, empresa.id, modulo);
    });
  });
};

const inicializarBaseDatos = () => {
  crearTablas();
  crearAdministradorGlobal();
};

module.exports = {
  db,
  inicializarBaseDatos
};
