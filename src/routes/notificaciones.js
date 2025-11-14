const express = require('express');
const { db } = require('../db/sqlite');
const {
  listarNotificacionesPorUsuario,
  marcarNotificacionComoLeida
} = require('../services/notificacionesService');

const router = express.Router();

const normalizarUsuario = (valor) => (valor || '').toString().trim().toUpperCase();

const cargarUsuarioActual = (req, res, next) => {
  const usuarioEncabezado = normalizarUsuario(req.headers['x-usuario-actual']);
  if (!usuarioEncabezado) {
    return res.status(401).json({ mensaje: 'No fue posible validar al usuario actual.' });
  }
  const registro = db.prepare(`
    SELECT id, usuario
    FROM usuarios
    WHERE usuario = ?
  `).get(usuarioEncabezado);
  if (!registro) {
    return res.status(401).json({ mensaje: 'No fue posible validar al usuario actual.' });
  }
  req.usuarioActual = registro;
  next();
};

router.use(cargarUsuarioActual);

router.get('/', (req, res) => {
  const soloNoLeidas = req.query.leidas === 'false' || req.query.estado === 'pendientes';
  const limite = Number(req.query.limite) || 20;
  const notificaciones = listarNotificacionesPorUsuario(req.usuarioActual.id, {
    soloNoLeidas,
    limite
  });
  res.json({ notificaciones });
});

router.patch('/:id/leida', (req, res) => {
  const notificacionId = Number(req.params.id);
  if (!Number.isInteger(notificacionId) || notificacionId <= 0) {
    return res.status(400).json({ mensaje: 'El identificador proporcionado no es válido.' });
  }
  const actualizado = marcarNotificacionComoLeida(req.usuarioActual.id, notificacionId);
  if (!actualizado) {
    return res.status(404).json({ mensaje: 'No se encontró la notificación solicitada.' });
  }
  res.json({ mensaje: 'Notificación actualizada.' });
});

module.exports = router;
