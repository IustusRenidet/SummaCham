const express = require('express');
const Joi = require('joi');
const bcrypt = require('bcryptjs');
const { db } = require('../db/sqlite');
const { construirMapaPermisos } = require('../services/permisosService');
const { EMPRESAS } = require('../config/empresas');
const { probarConexion } = require('../services/firebirdService');
const { emitirTokens, verificarRefreshToken } = require('../middleware/auth');

const router = express.Router();
const attempts = new Map();
const WINDOW_MS = 10 * 60 * 1000; // 10 minutos
const MAX_ATTEMPTS = 10;
const BLOCK_MS = 5 * 60 * 1000; // 5 minutos

const now = () => Date.now();
const pruneAttempts = () => {
  const cutoff = now() - WINDOW_MS;
  for (const [key, data] of attempts.entries()) {
    if (data.first < cutoff && (!data.blockedUntil || data.blockedUntil < cutoff)) {
      attempts.delete(key);
    }
  }
};

const registerAttempt = (key, success) => {
  if (success) {
    attempts.delete(key);
    return;
  }
  const current = attempts.get(key);
  const withinWindow = current && current.first > now() - WINDOW_MS;
  const base = withinWindow ? current : { count: 0, first: now(), blockedUntil: 0 };
  const updated = {
    count: base.count + 1,
    first: base.first,
    blockedUntil: base.blockedUntil
  };
  if (updated.count >= MAX_ATTEMPTS) {
    updated.blockedUntil = now() + BLOCK_MS;
  }
  attempts.set(key, updated);
};

const checkRateLimit = (req, res) => {
  pruneAttempts();
  const key = (req.headers['x-forwarded-for'] || req.ip || '').toString();
  const record = attempts.get(key);
  if (record?.blockedUntil && record.blockedUntil > now()) {
    res.status(429).json({ mensaje: 'Demasiados intentos. Intenta de nuevo en unos minutos.' });
    return null;
  }
  return key;
};

const esquemaLogin = Joi.object({
  usuario: Joi.string().trim().min(2).required(),
  contrasena: Joi.string().min(6).required()
});

const serializarEmpresa = (empresa) => {
  if (!empresa) {
    return null;
  }
  return {
    id: empresa.id,
    nombre: empresa.nombre,
    etiqueta: empresa.etiqueta
  };
};

const construirSesion = async (registro) => {
  const permisos = db.prepare(`
    SELECT empresa_id, modulo, puede_leer, puede_cargar_guardar, puede_revisar, puede_aprobar
    FROM permisos_modulo
    WHERE usuario_id = ?
  `).all(registro.id);
  const mapaPermisos = construirMapaPermisos(permisos);

  const esIconet = registro.usuario === 'ICONET';
  const esAdminGlobal = Boolean(registro.es_admin_global) || esIconet;

  const empresasDisponibles = EMPRESAS.filter((empresa) => {
    if (esAdminGlobal) {
      return true;
    }
    const permisosEmpresa = mapaPermisos[empresa.id];
    if (!permisosEmpresa) {
      return false;
    }
    return Object.values(permisosEmpresa).some(
      (acciones) => acciones.Lectura || acciones['Cargar y guardar'] || acciones.Revisar || acciones.Aprobar
    );
  });

  if (empresasDisponibles.length === 0) {
    const err = new Error('NO_EMPRESAS');
    err.codigo = 'NO_EMPRESAS';
    throw err;
  }

  const empresaActiva = empresasDisponibles[0];
  const disponible = await probarConexion(empresaActiva.id);

  return {
    usuario: {
      id: registro.id,
      usuario: registro.usuario,
      nombres: registro.nombres,
      apellidoPrimero: registro.apellido_primero,
      apellidoSegundo: registro.apellido_segundo,
      apellidos: registro.apellidos,
      correo: registro.correo,
      esAdminGlobal,
      permisosGenerales: {
        puedeAgregar: Boolean(registro.puede_agregar),
        puedeModificar: Boolean(registro.puede_modificar),
        puedeEliminar: Boolean(registro.puede_eliminar)
      },
      permisosPorEmpresa: mapaPermisos
    },
    empresaActiva: serializarEmpresa(empresaActiva),
    empresasDisponibles: empresasDisponibles.map(serializarEmpresa),
    firebirdDisponible: disponible
  };
};

router.post('/login', async (req, res) => {
  console.log('🔐 Intento de login:', req.body);
  const rateKey = checkRateLimit(req, res);
  if (!rateKey) return;

  const { error, value } = esquemaLogin.validate(req.body || {}, { abortEarly: false });
  if (error) {
    console.log('❌ Validación fallida:', error.details);
    registerAttempt(rateKey, false);
    return res.status(400).json({
      mensaje: 'Verifica los datos capturados.',
      detalles: error.details.map((detalle) => detalle.message)
    });
  }

  const usuarioBuscado = value.usuario.trim().toUpperCase();
  console.log('🔍 Buscando usuario:', usuarioBuscado);

  const registro = db.prepare(`
    SELECT id, usuario, nombres, apellido_primero, apellido_segundo, apellidos,
           correo, contrasena, es_admin_global,
           puede_agregar, puede_modificar, puede_eliminar
    FROM usuarios
    WHERE usuario = ?
  `).get(usuarioBuscado);

  console.log('👤 Usuario encontrado:', registro ? registro.usuario : 'NO ENCONTRADO');

  if (!registro) {
    registerAttempt(rateKey, false);
    return res.status(401).json({ mensaje: 'Usuario o contrase¤a incorrectos.' });
  }

  console.log('🔑 Comparando contraseñas...');
  console.log('   Contraseña recibida:', value.contrasena);
  console.log('   Hash en DB:', registro.contrasena ? registro.contrasena.substring(0, 20) + '...' : 'NULL');
  
  const contrasenaCorrecta = await bcrypt.compare(value.contrasena, registro.contrasena);
  console.log('✅ Contraseña correcta:', contrasenaCorrecta);
  
  if (!contrasenaCorrecta) {
    registerAttempt(rateKey, false);
    return res.status(401).json({ mensaje: 'Usuario o contrase¤a incorrectos.' });
  }
  registerAttempt(rateKey, true);

  try {
    const sesion = await construirSesion(registro);
    const tokens = emitirTokens({ id: registro.id, usuario: registro.usuario });
    
    // Establecer sesión con cookie
    req.session.userId = registro.id;
    req.session.usuario = registro.usuario;
    req.session.esAdminGlobal = sesion.usuario.esAdminGlobal;
    
    // Establecer cookie con token de acceso (opcional, para compatibilidad)
    res.cookie('tokenAcceso', tokens.tokenAcceso, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
      sameSite: 'lax'
    });
    
    res.json({
      ...sesion,
      tokenAcceso: tokens.tokenAcceso,
      tokenRefresco: tokens.tokenRefresco
    });
  } catch (err) {
    if (err?.codigo === 'NO_EMPRESAS') {
      return res.status(403).json({ mensaje: 'No cuentas con empresas habilitadas.' });
    }
    console.error('Error al armar sesión de login:', err);
    res.status(500).json({ mensaje: 'No fue posible completar el inicio de sesión.' });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const token = req.body?.tokenRefresco || req.body?.refreshToken || req.headers['x-refresh-token'];
    const payload = verificarRefreshToken(token);
    if (!payload?.sub) {
      return res.status(401).json({ mensaje: 'Token de sesión inválido.' });
    }
    const registro = db
      .prepare(`
        SELECT id, usuario, nombres, apellido_primero, apellido_segundo, apellidos,
               correo, es_admin_global,
               puede_agregar, puede_modificar, puede_eliminar
        FROM usuarios
        WHERE id = ?
      `)
      .get(payload.sub);
    if (!registro) {
      return res.status(401).json({ mensaje: 'Usuario no encontrado.' });
    }
    const sesion = await construirSesion(registro);
    const tokens = emitirTokens({ id: registro.id, usuario: registro.usuario });
    
    // Actualizar sesión
    req.session.userId = registro.id;
    req.session.usuario = registro.usuario;
    req.session.esAdminGlobal = sesion.usuario.esAdminGlobal;
    
    res.json({
      ...sesion,
      tokenAcceso: tokens.tokenAcceso,
      tokenRefresco: tokens.tokenRefresco
    });
  } catch (error) {
    console.error('Error en refresh:', error);
    res.status(401).json({ mensaje: 'No fue posible refrescar la sesión.' });
  }
});

// DEBUG: ver información de usuario (solo en desarrollo)
if (process.env.NODE_ENV !== 'production') {
  router.get('/debug/user/:usuario', async (req, res) => {
    try {
      const usuario = (req.params.usuario || '').toString().trim().toUpperCase();
      const registro = db.prepare(`
        SELECT id, usuario, nombres, apellido_primero, apellido_segundo, apellidos, correo, es_admin_global
        FROM usuarios WHERE UPPER(usuario) = ?
      `).get(usuario);
      if (!registro) return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
      const permisos = db.prepare('SELECT COUNT(*) as total FROM permisos_modulo WHERE usuario_id = ?').get(registro.id);
      const permisosDetalles = db.prepare('SELECT empresa_id, modulo, puede_leer, puede_cargar_guardar, puede_revisar, puede_aprobar FROM permisos_modulo WHERE usuario_id = ? LIMIT 200').all(registro.id);
      res.json({ registro, permisosCount: permisos.total, permisosSample: permisosDetalles });
    } catch (err) {
      console.error('Error debug user:', err);
      res.status(500).json({ mensaje: 'Error interno.' });
    }
  });
}

router.post('/logout', (req, res) => {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        console.error('Error al destruir sesión:', err);
        return res.status(500).json({ mensaje: 'Error al cerrar sesión.' });
      }
      res.clearCookie('panelamcham.sid');
      res.clearCookie('tokenAcceso');
      res.json({ mensaje: 'Sesión cerrada correctamente.' });
    });
  } else {
    res.clearCookie('tokenAcceso');
    res.json({ mensaje: 'Sesión cerrada.' });
  }
});

module.exports = router;
