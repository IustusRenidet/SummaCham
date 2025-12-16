const express = require('express');
const Joi = require('joi');
const bcrypt = require('bcryptjs');
const { db } = require('../db/sqlite');
const { EMPRESAS } = require('../config/empresas');
const { MODULOS, construirMapaPermisos } = require('../services/permisosService');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const ACCIONES_PERMISOS = ['Ver', 'Cargar y guardar', 'Revisar', 'Aprobar'];

const normalizarUsuario = (valor = '') => valor.toString().trim().toUpperCase();

const schemaPermisosModulo = Joi.object(
  MODULOS.reduce((acumulado, modulo) => {
    acumulado[modulo] = Joi.object({
      Ver: Joi.boolean().required(),
      'Cargar y guardar': Joi.boolean().required(),
      Revisar: Joi.boolean().required(),
      Aprobar: Joi.boolean().required()
    }).required();
    return acumulado;
  }, {})
);

const schemaPermisos = Joi.object(
  EMPRESAS.reduce((acumulado, empresa) => {
    acumulado[empresa.id] = schemaPermisosModulo;
    return acumulado;
  }, {})
).default({});

const schemaGenerales = Joi.object({
  puedeAgregar: Joi.boolean().required(),
  puedeModificar: Joi.boolean().required(),
  puedeEliminar: Joi.boolean().required()
}).required();

const schemaUsuarioBase = {
  usuario: Joi.string().trim().min(2).max(32).required(),
  // Nombres y correo obligatorios en validación de código (no a nivel DB)
  nombres: Joi.string().trim().min(1).max(80).required(),
  apellidoPrimero: Joi.string().trim().min(1).max(120).required(),
  apellidoSegundo: Joi.string().trim().allow('').default(''),
  correo: Joi.string().trim().email({ tlds: { allow: false } }).required(),
  permisosGenerales: schemaGenerales,
  permisos: schemaPermisos,
  esAdminGlobal: Joi.boolean().default(false)
};

const schemaCrearUsuario = Joi.object({
  ...schemaUsuarioBase,
  contrasena: Joi.string().min(8).required()
});

const schemaActualizarUsuario = Joi.object({
  ...schemaUsuarioBase,
  contrasena: Joi.string().min(8).optional()
});

const schemaRestablecer = Joi.object({
  contrasena: Joi.string().min(8).required()
});

const MENSAJES_PERMISOS = {
  puedeAgregar: 'agregar usuarios',
  puedeModificar: 'modificar usuarios',
  puedeEliminar: 'eliminar usuarios'
};

const obtenerPermisosPorUsuario = (usuarioId) => {
  const permisos = db.prepare(`
    SELECT empresa_id, modulo, puede_leer, puede_cargar_guardar, puede_revisar, puede_aprobar
    FROM permisos_modulo
    WHERE usuario_id = ?
  `).all(usuarioId);
  return construirMapaPermisos(permisos);
};

const aplicarPermisos = (usuarioId, permisos) => {
  const limpiarPermisos = db.prepare('DELETE FROM permisos_modulo WHERE usuario_id = ?');
  const insertarPermiso = db.prepare(`
    INSERT INTO permisos_modulo (
      usuario_id, empresa_id, modulo, puede_leer, puede_cargar_guardar, puede_revisar, puede_aprobar
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const transaccion = db.transaction(() => {
    limpiarPermisos.run(usuarioId);
    Object.entries(permisos).forEach(([empresaId, modulos]) => {
      if (!modulos) return;
      Object.entries(modulos).forEach(([modulo, acciones]) => {
        // Si cualquier otro permiso está activo, Ver también debe estar activo
        const tieneOtroPermiso = acciones['Cargar y guardar'] || acciones.Revisar || acciones.Aprobar;
        const puedeLeer = acciones.Ver || tieneOtroPermiso;
        
        // Solo insertar si tiene al menos el permiso de Ver
        if (!puedeLeer) {
          return;
        }
        insertarPermiso.run(
          usuarioId,
          empresaId,
          modulo,
          puedeLeer ? 1 : 0,
          acciones['Cargar y guardar'] ? 1 : 0,
          acciones.Revisar ? 1 : 0,
          acciones.Aprobar ? 1 : 0
        );
      });
    });
  });

  transaccion();
};

// Asignar todos los permisos (leer, cargar, revisar, aprobar) para todas las empresas y módulos
const asignarPermisosCompletos = (usuarioId) => {
  const insertarPermiso = db.prepare(`
    INSERT OR IGNORE INTO permisos_modulo (
      usuario_id, empresa_id, modulo, puede_leer, puede_cargar_guardar, puede_revisar, puede_aprobar
    ) VALUES (?, ?, ?, 1, 1, 1, 1)
  `);

  EMPRESAS.forEach((empresa) => {
    MODULOS.forEach((modulo) => {
      try {
        insertarPermiso.run(usuarioId, empresa.id, modulo);
      } catch (err) {
        // No bloquear por error individual
        console.warn('No fue posible insertar permiso completo:', err?.message || err);
      }
    });
  });
};

const construirPermisosCompletos = (permisosActuales = {}) => {
  const resultado = {};

  const asegurarPermiso = (empresaId, modulo, accion) => {
    if (!resultado[empresaId]) {
      resultado[empresaId] = {};
    }
    if (!resultado[empresaId][modulo]) {
      resultado[empresaId][modulo] = {};
    }
    resultado[empresaId][modulo][accion] = true;
  };

  EMPRESAS.forEach((empresa) => {
    MODULOS.forEach((modulo) => {
      ACCIONES_PERMISOS.forEach((accion) => asegurarPermiso(empresa.id, modulo, accion));
    });
  });

  Object.entries(permisosActuales || {}).forEach(([empresaId, modulos]) => {
    Object.entries(modulos || {}).forEach(([modulo, acciones]) => {
      Object.keys(acciones || {}).forEach((accion) => asegurarPermiso(empresaId, modulo, accion));
    });
  });

  return resultado;
};

const forzarPermisosIconet = (datos = {}) => ({
  ...datos,
  usuario: 'ICONET',
  esAdminGlobal: true,
  permisosGenerales: {
    puedeAgregar: true,
    puedeModificar: true,
    puedeEliminar: true
  },
  permisos: construirPermisosCompletos(datos.permisos)
});

const asegurarAccesoUsuarios = (req, res, next) => {
  const puedeAgregar = Boolean(req.usuarioActual?.permisosGenerales?.puedeAgregar);
  const puedeModificar = Boolean(req.usuarioActual?.permisosGenerales?.puedeModificar);
  const puedeEliminar = Boolean(req.usuarioActual?.permisosGenerales?.puedeEliminar);
  const tienePermisosGestion = puedeAgregar && puedeModificar && puedeEliminar;
  const esIconet = normalizarUsuario(req.usuarioActual?.usuario) === 'ICONET';
  const esAdminGlobal = Boolean(req.esAdmin || req.usuarioActual?.esAdminGlobal);
  const esAdminUsuarios = esAdminGlobal || tienePermisosGestion || esIconet;

  if (!esAdminUsuarios) {
    return res.status(403).json({ mensaje: 'No cuentas con permisos para administrar usuarios.' });
  }

  req.usuarioActual.esAdminGlobal = esAdminGlobal;
  req.usuarioActual.permisosGenerales = req.usuarioActual.permisosGenerales || {
    puedeAgregar,
    puedeModificar,
    puedeEliminar
  };
  next();
};

const asegurarPermisoGeneral = (campo) => (req, res, next) => {
  const permitido = req.usuarioActual?.permisosGenerales?.[campo];
  if (!permitido) {
    const descripcion = MENSAJES_PERMISOS[campo] || 'realizar esta acción';
    return res.status(403).json({ mensaje: `No cuentas con permiso para ${descripcion}.` });
  }
  next();
};

router.use(requireAuth, asegurarAccesoUsuarios);

router.get('/', (req, res) => {
  const registros = db.prepare(`
    SELECT id, usuario, nombres, apellido_primero, apellido_segundo, apellidos,
           correo, es_admin_global, puede_agregar, puede_modificar, puede_eliminar
    FROM usuarios
    ORDER BY usuario ASC
  `).all();

  const usuarios = registros.map((registro) => ({
    id: registro.id,
    usuario: registro.usuario,
    nombres: registro.nombres,
    apellidoPrimero: registro.apellido_primero,
    apellidoSegundo: registro.apellido_segundo,
    apellidos: registro.apellidos,
    correo: registro.correo,
    esAdminGlobal: Boolean(registro.es_admin_global),
    permisosGenerales: {
      puedeAgregar: Boolean(registro.puede_agregar),
      puedeModificar: Boolean(registro.puede_modificar),
      puedeEliminar: Boolean(registro.puede_eliminar)
    },
    permisosPorEmpresa: obtenerPermisosPorUsuario(registro.id)
  }));

  res.json({ usuarios });
});

router.get('/:id', (req, res) => {
  const usuarioId = Number(req.params.id);
  const registro = db.prepare(`
    SELECT id, usuario, nombres, apellido_primero, apellido_segundo, apellidos,
           correo, es_admin_global, puede_agregar, puede_modificar, puede_eliminar
    FROM usuarios
    WHERE id = ?
  `).get(usuarioId);

  if (!registro) {
    return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
  }

  const permisosPorEmpresa = obtenerPermisosPorUsuario(registro.id);

  res.json({
    usuario: {
      id: registro.id,
      usuario: registro.usuario,
      nombres: registro.nombres,
      apellidoPrimero: registro.apellido_primero,
      apellidoSegundo: registro.apellido_segundo,
      apellidos: registro.apellidos,
      correo: registro.correo,
      esAdminGlobal: Boolean(registro.es_admin_global),
      permisosGenerales: {
        puedeAgregar: Boolean(registro.puede_agregar),
        puedeModificar: Boolean(registro.puede_modificar),
        puedeEliminar: Boolean(registro.puede_eliminar)
      },
      permisosPorEmpresa
    }
  });
});

router.post('/', asegurarPermisoGeneral('puedeAgregar'), (req, res) => {
  const { error, value } = schemaCrearUsuario.validate(req.body || {}, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      mensaje: 'Verifica la información del usuario.',
      detalles: error.details.map((detalle) => detalle.message)
    });
  }

  let payload = { ...value };
  let usuarioNormalizado = normalizarUsuario(payload.usuario);
  const esIconetDestino = usuarioNormalizado === 'ICONET';
  if (esIconetDestino) {
    payload = forzarPermisosIconet(payload);
    usuarioNormalizado = 'ICONET';
  }

  const existente = db.prepare('SELECT id FROM usuarios WHERE usuario = ?').get(usuarioNormalizado);
  if (existente) {
    return res.status(409).json({ mensaje: 'El usuario ya existe.' });
  }

  const totalPermisos = Object.values(payload.permisos || {}).reduce((acum, modulos) => {
    return acum + Object.values(modulos || {}).length;
  }, 0);

  if (!payload.esAdminGlobal && totalPermisos === 0) {
    return res.status(400).json({ mensaje: 'Debes asignar al menos un permiso por empresa.' });
  }

  const hash = bcrypt.hashSync(payload.contrasena, 12);
  const apellidosCompletos = [payload.apellidoPrimero, payload.apellidoSegundo].filter(Boolean).join(' ');

  const permisosGenerales = payload.esAdminGlobal
    ? { puedeAgregar: 1, puedeModificar: 1, puedeEliminar: 1 }
    : {
        puedeAgregar: payload.permisosGenerales?.puedeAgregar ? 1 : 0,
        puedeModificar: payload.permisosGenerales?.puedeModificar ? 1 : 0,
        puedeEliminar: payload.permisosGenerales?.puedeEliminar ? 1 : 0
      };

  const insertar = db.prepare(`
    INSERT INTO usuarios (
      usuario, nombres, apellido_primero, apellido_segundo, apellidos,
      correo, contrasena, es_admin_global,
      puede_agregar, puede_modificar, puede_eliminar
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const resultado = insertar.run(
    usuarioNormalizado,
    payload.nombres,
    payload.apellidoPrimero,
    payload.apellidoSegundo,
    apellidosCompletos,
    payload.correo,
    hash,
    payload.esAdminGlobal ? 1 : 0,
    permisosGenerales.puedeAgregar,
    permisosGenerales.puedeModificar,
    permisosGenerales.puedeEliminar
  );

  aplicarPermisos(resultado.lastInsertRowid, payload.permisos);
  // Si es administrador global, asegurarse de que tenga permisos completos por empresa y módulo
  if (payload.esAdminGlobal) {
    asignarPermisosCompletos(resultado.lastInsertRowid);
  }
  res.status(201).json({ mensaje: 'Usuario creado correctamente.' });
});

router.put('/:id', asegurarPermisoGeneral('puedeModificar'), (req, res) => {
  const { error, value } = schemaActualizarUsuario.validate(req.body || {}, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      mensaje: 'Verifica la información del usuario.',
      detalles: error.details.map((detalle) => detalle.message)
    });
  }

  const usuarioId = Number(req.params.id);
  const existente = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(usuarioId);
  if (!existente) {
    return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
  }

  const esIconet = (existente.usuario || '').toString().trim().toUpperCase() === 'ICONET';
  if (esIconet && req.usuarioActual?.id !== usuarioId) {
    return res.status(403).json({ mensaje: 'El usuario ICONET solo puede modificarse a si mismo.' });
  }

  // Solo impedir quitar el rol de admin global al usuario ICONET.
  if (esIconet && existente.es_admin_global && !value.esAdminGlobal) {
    return res.status(400).json({ mensaje: 'No es posible retirar el rol de administrador global del usuario ICONET.' });
  }

  let payload = { ...value };
  if (esIconet) {
    payload.usuario = 'ICONET';
  }

  let usuarioNormalizado = normalizarUsuario(payload.usuario);
  const esIconetDestino = usuarioNormalizado === 'ICONET';
  if (esIconet || esIconetDestino) {
    payload = forzarPermisosIconet(payload);
    usuarioNormalizado = 'ICONET';
  }

  const totalPermisos = Object.values(payload.permisos || {}).reduce((acum, modulos) => {
    return acum + Object.values(modulos || {}).length;
  }, 0);

  if (!payload.esAdminGlobal && totalPermisos === 0) {
    return res.status(400).json({ mensaje: 'Debes asignar al menos un permiso por empresa.' });
  }

  const actualizar = db.prepare(`
    UPDATE usuarios
    SET usuario = ?, nombres = ?, apellido_primero = ?, apellido_segundo = ?, apellidos = ?,
        correo = ?, es_admin_global = ?, puede_agregar = ?, puede_modificar = ?, puede_eliminar = ?
    WHERE id = ?
  `);

  const permisosGenerales = payload.esAdminGlobal
    ? { puedeAgregar: 1, puedeModificar: 1, puedeEliminar: 1 }
    : {
        puedeAgregar: payload.permisosGenerales?.puedeAgregar ? 1 : 0,
        puedeModificar: payload.permisosGenerales?.puedeModificar ? 1 : 0,
        puedeEliminar: payload.permisosGenerales?.puedeEliminar ? 1 : 0
      };

  const apellidosCompletos = [payload.apellidoPrimero, payload.apellidoSegundo].filter(Boolean).join(' ');

  actualizar.run(
    usuarioNormalizado,
    payload.nombres,
    payload.apellidoPrimero,
    payload.apellidoSegundo,
    apellidosCompletos,
    payload.correo,
    payload.esAdminGlobal ? 1 : 0,
    permisosGenerales.puedeAgregar,
    permisosGenerales.puedeModificar,
    permisosGenerales.puedeEliminar,
    usuarioId
  );

  if (payload.contrasena) {
    const hash = bcrypt.hashSync(payload.contrasena, 12);
    db.prepare('UPDATE usuarios SET contrasena = ? WHERE id = ?').run(hash, usuarioId);
  }

  // Asegurar permisos completos si se establece el rol de administrador global
  if (payload.esAdminGlobal) {
    asignarPermisosCompletos(usuarioId);
  }

  aplicarPermisos(usuarioId, payload.permisos);

  res.json({ mensaje: 'Usuario actualizado correctamente.' });
});

router.delete('/:id', asegurarPermisoGeneral('puedeEliminar'), (req, res) => {
  const usuarioId = Number(req.params.id);
  const existente = db.prepare('SELECT usuario, es_admin_global FROM usuarios WHERE id = ?').get(usuarioId);
  if (!existente) {
    return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
  }

  if (normalizarUsuario(existente.usuario) === 'ICONET') {
    return res.status(400).json({ mensaje: 'No es posible eliminar al usuario ICONET.' });
  }

  if (existente.es_admin_global) {
    return res.status(400).json({ mensaje: 'No es posible eliminar al administrador global.' });
  }

  db.prepare('DELETE FROM usuarios WHERE id = ?').run(usuarioId);
  res.json({ mensaje: 'Usuario eliminado correctamente.' });
});

router.post('/:id/restablecer-contrasena', asegurarPermisoGeneral('puedeModificar'), (req, res) => {
  const { error, value } = schemaRestablecer.validate(req.body || {}, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      mensaje: 'Verifica la nueva contraseña.',
      detalles: error.details.map((detalle) => detalle.message)
    });
  }

  const usuarioId = Number(req.params.id);
  const existente = db.prepare('SELECT id FROM usuarios WHERE id = ?').get(usuarioId);
  if (!existente) {
    return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
  }

  const hash = bcrypt.hashSync(value.contrasena, 12);
  db.prepare('UPDATE usuarios SET contrasena = ? WHERE id = ?').run(hash, usuarioId);

  res.json({ mensaje: 'Contraseña actualizada correctamente.' });
});

module.exports = router;
