const jwt = require('jsonwebtoken');
const { db } = require('../db/sqlite');
const { construirMapaPermisos } = require('../services/permisosService');

const JWT_SECRET = process.env.PANELAMCHAM_JWT_SECRET || 'cambia-este-secreto';
const JWT_REFRESH_SECRET = process.env.PANELAMCHAM_REFRESH_SECRET || `${JWT_SECRET}-refresh`;
const ACCESS_TOKEN_TTL = process.env.PANELAMCHAM_ACCESS_TTL || '1h';
const REFRESH_TOKEN_TTL = process.env.PANELAMCHAM_REFRESH_TTL || '7d';

const normalizarUsuario = (valor) => (valor || '').toString().trim().toUpperCase();

const extraerToken = (req) => {
  // 1. Primero verificar si hay sesión activa
  if (req.session?.userId) {
    // Usuario autenticado por sesión
    return 'SESSION_AUTH';
  }
  
  // 2. Luego verificar cookie de token
  if (req.cookies?.tokenAcceso) {
    return req.cookies.tokenAcceso;
  }
  
  // 3. Finalmente verificar header Authorization
  const auth = req.headers.authorization || '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  
  return null;
};

const emitirTokens = ({ id, usuario }) => {
  const base = { sub: id, usuario: normalizarUsuario(usuario) };
  return {
    tokenAcceso: jwt.sign(base, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL }),
    tokenRefresco: jwt.sign(base, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_TTL })
  };
};

const verificarRefreshToken = (token) => {
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET);
  } catch (err) {
    return null;
  }
};

const cargarUsuario = (usuarioId) => {
  return db
    .prepare(`
      SELECT id, usuario, nombres, apellido_primero, apellido_segundo, apellidos,
             correo, es_admin_global, puede_agregar, puede_modificar, puede_eliminar
      FROM usuarios
      WHERE id = ?
    `)
    .get(usuarioId);
};

const construirContexto = (registro) => {
  const esIconet = normalizarUsuario(registro.usuario) === 'ICONET';
  const esAdmin = esIconet || Boolean(registro.es_admin_global);
  const permisosGenerales = {
    puedeAgregar: Boolean(registro.puede_agregar),
    puedeModificar: Boolean(registro.puede_modificar),
    puedeEliminar: Boolean(registro.puede_eliminar)
  };

  let mapaPermisos = {};
  if (!esAdmin) {
    const permisos = db
      .prepare(
        `
        SELECT empresa_id, modulo, puede_leer, puede_cargar_guardar, puede_revisar, puede_aprobar
        FROM permisos_modulo
        WHERE usuario_id = ?
      `
      )
      .all(registro.id);
    mapaPermisos = construirMapaPermisos(permisos);
  }

  return { esAdmin, permisosGenerales, mapaPermisos };
};

const requireAuth = (req, res, next) => {
  try {
    const token = extraerToken(req);
    if (!token) {
      return res.status(401).json({ mensaje: 'Sesión no válida o expirada.' });
    }
    
    let payload;
    let registro;
    
    // Autenticación por sesión
    if (token === 'SESSION_AUTH') {
      registro = cargarUsuario(req.session.userId);
      if (!registro) {
        req.session.destroy();
        return res.status(401).json({ mensaje: 'Usuario no encontrado.' });
      }
    } else {
      // Autenticación por JWT
      payload = jwt.verify(token, JWT_SECRET);
      registro = cargarUsuario(payload.sub);
      if (!registro) {
        return res.status(401).json({ mensaje: 'Usuario no encontrado.' });
      }
    }
    
    const contexto = construirContexto(registro);
    req.usuarioActual = {
      id: registro.id,
      usuario: registro.usuario,
      nombres: registro.nombres,
      apellido_primero: registro.apellido_primero,
      apellido_segundo: registro.apellido_segundo,
      apellidos: registro.apellidos,
      correo: registro.correo,
      es_admin_global: registro.es_admin_global,
      esAdminGlobal: contexto.esAdmin,
      permisosGenerales: contexto.permisosGenerales
    };
    req.esAdmin = contexto.esAdmin;
    req.mapaPermisos = contexto.mapaPermisos;
    next();
  } catch (err) {
    const status = err?.name === 'TokenExpiredError' ? 401 : 401;
    return res.status(status).json({ mensaje: 'No se pudo validar la sesión.' });
  }
};

const extraerEmpresaActiva = (req) => {
  return req.headers['x-empresa-activa'] || req.body?.empresaId || req.query?.empresaId || null;
};

const tienePermisoEmpresa = (mapaPermisos, empresaId) => {
  if (!empresaId) return false;
  const permisos = mapaPermisos?.[empresaId];
  if (!permisos) return false;
  return Object.values(permisos).some(
    (acciones) => acciones.Lectura || acciones['Cargar y guardar'] || acciones.Revisar || acciones.Aprobar
  );
};

const tienePermisoModulo = (mapaPermisos, empresaId, modulo, accion) => {
  if (!empresaId || !modulo) return false;
  const permisos = mapaPermisos?.[empresaId]?.[modulo];
  if (!permisos) return false;
  if (!accion) {
    return Boolean(permisos.Lectura || permisos['Cargar y guardar'] || permisos.Revisar || permisos.Aprobar);
  }
  return Boolean(permisos[accion]);
};

module.exports = {
  requireAuth,
  emitirTokens,
  verificarRefreshToken,
  tienePermisoEmpresa,
  tienePermisoModulo,
  extraerEmpresaActiva,
  extraerToken
};
