const express = require('express');
const Joi = require('joi');
const bcrypt = require('bcryptjs');
const { db } = require('../db/sqlite');
const { construirMapaPermisos } = require('../services/permisosService');
const { EMPRESAS } = require('../config/empresas');
const { probarConexion } = require('../services/firebirdService');

const router = express.Router();

const esquemaLogin = Joi.object({
  usuario: Joi.string().trim().min(3).required(),
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

router.post('/login', async (req, res) => {
  const { error, value } = esquemaLogin.validate(req.body || {}, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      mensaje: 'Verifica los datos capturados.',
      detalles: error.details.map((detalle) => detalle.message)
    });
  }

  const usuarioBuscado = value.usuario.trim().toUpperCase();

  const registro = db.prepare(`
    SELECT id, usuario, nombres, apellido_primero, apellido_segundo, apellidos,
           correo, contrasena, contrasena_visible, es_admin_global,
           puede_agregar, puede_modificar, puede_eliminar
    FROM usuarios
    WHERE usuario = ?
  `).get(usuarioBuscado);

  if (!registro) {
    return res.status(401).json({ mensaje: 'Usuario o contraseña incorrectos.' });
  }

  const contrasenaCorrecta = await bcrypt.compare(value.contrasena, registro.contrasena);
  if (!contrasenaCorrecta) {
    return res.status(401).json({ mensaje: 'Usuario o contraseña incorrectos.' });
  }

  const permisos = db.prepare(`
    SELECT empresa_id, modulo, puede_cargar_guardar, puede_revisar, puede_aprobar
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
    return Object.values(permisosEmpresa).some((acciones) => acciones['Cargar y guardar'] || acciones.Revisar || acciones.Aprobar);
  });

  if (empresasDisponibles.length === 0) {
    return res.status(403).json({ mensaje: 'No cuentas con empresas habilitadas.' });
  }

  const empresaActiva = empresasDisponibles[0];
  const disponible = await probarConexion(empresaActiva.id);

  res.json({
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
      permisosPorEmpresa: mapaPermisos,
      contrasenaVisible: registro.contrasena_visible
    },
    empresaActiva: serializarEmpresa(empresaActiva),
    empresasDisponibles: empresasDisponibles.map(serializarEmpresa),
    firebirdDisponible: disponible
  });
});

module.exports = router;
