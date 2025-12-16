const express = require('express');
const Joi = require('joi');
const bcrypt = require('bcryptjs');
const { db } = require('../db/sqlite');
const { construirMapaPermisos } = require('../services/permisosService');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const passwordSchema = Joi.object({
  contrasenaActual: Joi.string().min(8).required(),
  nuevaContrasena: Joi.string().min(8).required()
});

const construirPermisosUsuario = (usuarioId) => {
  const registros = db
    .prepare(`
      SELECT empresa_id, modulo, puede_leer, puede_cargar_guardar, puede_revisar, puede_aprobar
      FROM permisos_modulo
      WHERE usuario_id = ?
    `)
    .all(usuarioId);
  return construirMapaPermisos(registros);
};

router.use(requireAuth);

router.get('/', (req, res) => {
  const usuarioId = req.usuarioActual?.id;
  if (!usuarioId) {
    return res.status(401).json({ mensaje: 'Sesi¢n inv lida.' });
  }

  const registro = db
    .prepare(`
      SELECT id, usuario, nombres, apellido_primero, apellido_segundo, apellidos,
             correo, es_admin_global, puede_agregar, puede_modificar, puede_eliminar
      FROM usuarios
      WHERE id = ?
    `)
    .get(usuarioId);

  if (!registro) {
    return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
  }

  const permisosPorEmpresa = construirPermisosUsuario(registro.id);

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

router.patch('/password', async (req, res) => {
  const { error, value } = passwordSchema.validate(req.body || {}, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      mensaje: 'Verifica la informaci¢n enviada.',
      detalles: error.details.map((detalle) => detalle.message)
    });
  }

  const usuarioId = req.usuarioActual?.id;
  if (!usuarioId) {
    return res.status(401).json({ mensaje: 'Sesi¢n inv lida.' });
  }

  const registro = db
    .prepare('SELECT contrasena FROM usuarios WHERE id = ?')
    .get(usuarioId);

  if (!registro) {
    return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
  }

  const coincide = await bcrypt.compare(value.contrasenaActual, registro.contrasena || '');
  if (!coincide) {
    return res.status(400).json({ mensaje: 'La contrase¤a actual no es correcta.' });
  }

  const hash = bcrypt.hashSync(value.nuevaContrasena, 12);
  db.prepare('UPDATE usuarios SET contrasena = ? WHERE id = ?').run(hash, usuarioId);

  res.json({ mensaje: 'Contrase¤a actualizada correctamente.' });
});

module.exports = router;
