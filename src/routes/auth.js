const express = require('express');
const Joi = require('joi');
const bcrypt = require('bcryptjs');
const { db } = require('../db/sqlite');
const { construirMapaPermisos } = require('../services/permisosService');
const { obtenerEmpresaPorId } = require('../config/empresas');
const { probarConexion } = require('../services/firebirdService');

const router = express.Router();

const esquemaLogin = Joi.object({
  usuario: Joi.string().trim().min(3).required(),
  contrasena: Joi.string().min(6).required(),
  empresaId: Joi.string().trim().required()
});

router.post('/login', async (req, res) => {
  const { error, value } = esquemaLogin.validate(req.body || {}, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      mensaje: 'Verifica los datos capturados.',
      detalles: error.details.map((detalle) => detalle.message)
    });
  }

  const usuarioBuscado = value.usuario.trim().toUpperCase();
  const empresaSeleccionada = obtenerEmpresaPorId(value.empresaId);
  if (!empresaSeleccionada) {
    return res.status(404).json({ mensaje: 'La empresa indicada no existe.' });
  }

  const registro = db.prepare(`
    SELECT id, usuario, nombres, apellidos, correo, contrasena, es_admin_global,
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

  if (!registro.es_admin_global) {
    const permisosEmpresa = mapaPermisos[value.empresaId];
    if (!permisosEmpresa) {
      return res.status(403).json({ mensaje: 'No cuentas con permisos en la empresa seleccionada.' });
    }
  }

  const disponible = await probarConexion(value.empresaId);

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
      permisosPorEmpresa: mapaPermisos
    },
    empresa: empresaSeleccionada,
    firebirdDisponible: disponible
  });
});

module.exports = router;
