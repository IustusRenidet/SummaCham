const express = require('express');
const Joi = require('joi');
const bcrypt = require('bcryptjs');
const { db } = require('../db/sqlite');
const { EMPRESAS } = require('../config/empresas');
const { MODULOS, construirMapaPermisos } = require('../services/permisosService');

const router = express.Router();

const normalizarUsuario = (valor = '') => valor.toString().trim().toUpperCase();

const schemaPermisosModulo = Joi.object(
  MODULOS.reduce((acumulado, modulo) => {
    acumulado[modulo] = Joi.object({
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
  usuario: Joi.string().trim().min(3).max(32).required(),
  nombres: Joi.string().trim().allow('').default(''),
  apellidos: Joi.string().trim().allow('').default(''),
  correo: Joi.string().trim().email({ tlds: { allow: false } }).allow('').default(''),
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
    SELECT empresa_id, modulo, puede_cargar_guardar, puede_revisar, puede_aprobar
    FROM permisos_modulo
    WHERE usuario_id = ?
  `).all(usuarioId);
  return construirMapaPermisos(permisos);
};

const aplicarPermisos = (usuarioId, permisos) => {
  const limpiarPermisos = db.prepare('DELETE FROM permisos_modulo WHERE usuario_id = ?');
  const insertarPermiso = db.prepare(`
    INSERT INTO permisos_modulo (
      usuario_id, empresa_id, modulo, puede_cargar_guardar, puede_revisar, puede_aprobar
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  const transaccion = db.transaction(() => {
    limpiarPermisos.run(usuarioId);
    Object.entries(permisos).forEach(([empresaId, modulos]) => {
      if (!modulos) return;
      Object.entries(modulos).forEach(([modulo, acciones]) => {
        const tienePermiso = acciones['Cargar y guardar'] || acciones.Revisar || acciones.Aprobar;
        if (!tienePermiso) {
          return;
        }
        insertarPermiso.run(
          usuarioId,
          empresaId,
          modulo,
          acciones['Cargar y guardar'] ? 1 : 0,
          acciones.Revisar ? 1 : 0,
          acciones.Aprobar ? 1 : 0
        );
      });
    });
  });

  transaccion();
};

const cargarUsuarioActual = (req, res, next) => {
  const usuarioEncabezado = normalizarUsuario(req.headers['x-usuario-actual']);
  if (!usuarioEncabezado) {
    return res.status(401).json({ mensaje: 'No se pudo validar al usuario actual.' });
  }

  const registro = db.prepare(`
    SELECT id, usuario, es_admin_global, puede_agregar, puede_modificar, puede_eliminar
    FROM usuarios
    WHERE usuario = ?
  `).get(usuarioEncabezado);

  if (!registro) {
    return res.status(401).json({ mensaje: 'No se pudo validar al usuario actual.' });
  }

  const esIconet = registro.usuario === 'ICONET';
  const esAdmin = Boolean(registro.es_admin_global) || esIconet;

  if (!esAdmin) {
    return res.status(403).json({ mensaje: 'No cuentas con permisos para administrar usuarios.' });
  }

  req.usuarioActual = {
    id: registro.id,
    usuario: registro.usuario,
    esAdminGlobal: esAdmin,
    permisosGenerales: {
      puedeAgregar: true,
      puedeModificar: true,
      puedeEliminar: true
    }
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

router.use(cargarUsuarioActual);

router.get('/', (req, res) => {
  const registros = db.prepare(`
    SELECT id, usuario, nombres, apellidos, correo, es_admin_global,
           puede_agregar, puede_modificar, puede_eliminar
    FROM usuarios
    ORDER BY usuario ASC
  `).all();

  const usuarios = registros.map((registro) => ({
    id: registro.id,
    usuario: registro.usuario,
    nombres: registro.nombres,
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
    SELECT id, usuario, nombres, apellidos, correo, es_admin_global,
           puede_agregar, puede_modificar, puede_eliminar
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

  const usuarioNormalizado = normalizarUsuario(value.usuario);
  const existente = db.prepare('SELECT id FROM usuarios WHERE usuario = ?').get(usuarioNormalizado);
  if (existente) {
    return res.status(409).json({ mensaje: 'El usuario ya existe.' });
  }

  const totalPermisos = Object.values(value.permisos || {}).reduce((acum, modulos) => {
    return acum + Object.values(modulos || {}).length;
  }, 0);

  if (!value.esAdminGlobal && totalPermisos === 0) {
    return res.status(400).json({ mensaje: 'Debes asignar al menos un permiso por empresa.' });
  }

  const hash = bcrypt.hashSync(value.contrasena, 12);

  const permisosGenerales = value.esAdminGlobal ? { puedeAgregar: 1, puedeModificar: 1, puedeEliminar: 1 } : { puedeAgregar: 0, puedeModificar: 0, puedeEliminar: 0 };

  const insertar = db.prepare(`
    INSERT INTO usuarios (
      usuario, nombres, apellidos, correo, contrasena, es_admin_global,
      puede_agregar, puede_modificar, puede_eliminar
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const resultado = insertar.run(
    usuarioNormalizado,
    value.nombres,
    value.apellidos,
    value.correo,
    hash,
    value.esAdminGlobal ? 1 : 0,
    permisosGenerales.puedeAgregar,
    permisosGenerales.puedeModificar,
    permisosGenerales.puedeEliminar
  );

  aplicarPermisos(resultado.lastInsertRowid, value.permisos);

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

  if (existente.es_admin_global && !value.esAdminGlobal) {
    return res.status(400).json({ mensaje: 'No es posible retirar el rol de administrador global.' });
  }

  const totalPermisos = Object.values(value.permisos || {}).reduce((acum, modulos) => {
    return acum + Object.values(modulos || {}).length;
  }, 0);

  if (!value.esAdminGlobal && totalPermisos === 0) {
    return res.status(400).json({ mensaje: 'Debes asignar al menos un permiso por empresa.' });
  }

  const actualizar = db.prepare(`
    UPDATE usuarios
    SET usuario = ?, nombres = ?, apellidos = ?, correo = ?, es_admin_global = ?,
        puede_agregar = ?, puede_modificar = ?, puede_eliminar = ?
    WHERE id = ?
  `);

  const permisosGenerales = value.esAdminGlobal ? { puedeAgregar: 1, puedeModificar: 1, puedeEliminar: 1 } : { puedeAgregar: 0, puedeModificar: 0, puedeEliminar: 0 };

  actualizar.run(
    normalizarUsuario(value.usuario),
    value.nombres,
    value.apellidos,
    value.correo,
    value.esAdminGlobal ? 1 : 0,
    permisosGenerales.puedeAgregar,
    permisosGenerales.puedeModificar,
    permisosGenerales.puedeEliminar,
    usuarioId
  );

  if (value.contrasena) {
    const hash = bcrypt.hashSync(value.contrasena, 12);
    db.prepare('UPDATE usuarios SET contrasena = ? WHERE id = ?').run(hash, usuarioId);
  }

  aplicarPermisos(usuarioId, value.permisos);

  res.json({ mensaje: 'Usuario actualizado correctamente.' });
});

router.delete('/:id', asegurarPermisoGeneral('puedeEliminar'), (req, res) => {
  const usuarioId = Number(req.params.id);
  const existente = db.prepare('SELECT es_admin_global FROM usuarios WHERE id = ?').get(usuarioId);
  if (!existente) {
    return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
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
