const express = require('express');
const router = express.Router();
const { requireAuth, extraerEmpresaActiva, tienePermisoModulo } = require('../middleware/auth');
const {
  listarComentarios,
  crearComentario,
  actualizarEstadoComentario,
  obtenerComentario,
  resumirComentariosPorModulo
} = require('../services/comentariosService');

router.use(requireAuth);

router.get('/resumen', (req, res) => {
  const modulo = (req.query.modulo || '').toString().trim();
  const anio = req.query.anio ? Number(req.query.anio) : null;
  const capitulo = (req.query.capitulo || '').toString().trim() || null;
  const empresaId = extraerEmpresaActiva(req) || req.query.empresaId || null;

  if (!modulo) {
    return res.status(400).json({ mensaje: 'Parametros insuficientes: modulo es obligatorio.' });
  }

  const resumen = resumirComentariosPorModulo({ empresaId, modulo, anio, capitulo });
  return res.json({ resumen });
});

router.get('/', (req, res) => {
  const modulo = (req.query.modulo || '').toString().trim();
  const celdaId = (req.query.celdaId || '').toString().trim();
  const anio = req.query.anio ? Number(req.query.anio) : null;
  const empresaId = extraerEmpresaActiva(req) || req.query.empresaId || null;

  if (!modulo || !celdaId) {
    return res.status(400).json({ mensaje: 'Parametros insuficientes: modulo y celdaId son obligatorios.' });
  }

  const comentarios = listarComentarios({ empresaId, modulo, celdaId, anio });
  return res.json({ comentarios });
});

router.post('/', (req, res) => {
  const modulo = (req.body.modulo || '').toString().trim();
  const celdaId = (req.body.celdaId || '').toString().trim();
  const texto = (req.body.texto || '').toString().trim();
  const anio = req.body.anio ? Number(req.body.anio) : null;
  const capitulo = (req.body.capitulo || '').toString().trim() || null;
  const parentId = req.body.parentId ? Number(req.body.parentId) : null;
  const empresaId = extraerEmpresaActiva(req) || req.body.empresaId || null;

  if (!modulo || !celdaId || !texto) {
    return res.status(400).json({ mensaje: 'modulo, celdaId y texto son obligatorios.' });
  }

  const tienePermiso = empresaId
    ? tienePermisoModulo(req.mapaPermisos, empresaId, modulo, 'Lectura')
    : true;
  if (!tienePermiso) {
    return res.status(403).json({ mensaje: 'Sin permisos para comentar en este módulo.' });
  }

  try {
    const creado = crearComentario({
      empresaId,
      modulo,
      celdaId,
      anio,
      capitulo,
      texto,
      parentId,
      usuario: req.usuarioActual
    });
    return res.status(201).json({ comentario: creado });
  } catch (error) {
    console.error('No se pudo crear comentario', error);
    return res.status(500).json({ mensaje: 'No fue posible crear el comentario.' });
  }
});

router.patch('/:id', (req, res) => {
  const comentarioId = Number(req.params.id);
  const estado = (req.body.estado || '').toString().trim().toLowerCase();
  if (!Number.isInteger(comentarioId) || comentarioId <= 0) {
    return res.status(400).json({ mensaje: 'ID inválido.' });
  }
  if (!estado) {
    return res.status(400).json({ mensaje: 'Estado requerido.' });
  }

  const existente = obtenerComentario(comentarioId);
  if (!existente) {
    return res.status(404).json({ mensaje: 'Comentario no encontrado.' });
  }

  const empresaId = existente.empresaId || extraerEmpresaActiva(req) || null;
  const modulo = existente.modulo;
  const tienePermiso = empresaId
    ? tienePermisoModulo(req.mapaPermisos, empresaId, modulo, 'Lectura')
    : true;
  if (!tienePermiso) {
    return res.status(403).json({ mensaje: 'Sin permisos para actualizar este comentario.' });
  }

  try {
    const actualizado = actualizarEstadoComentario({
      comentarioId,
      estado,
      usuario: req.usuarioActual
    });
    if (!actualizado) {
      return res.status(400).json({ mensaje: 'No se pudo actualizar el comentario.' });
    }
    return res.json({ comentario: actualizado });
  } catch (error) {
    console.error('No se pudo actualizar estado de comentario', error);
    return res.status(500).json({ mensaje: 'No fue posible actualizar el comentario.' });
  }
});

module.exports = router;
