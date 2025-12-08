const express = require('express');
const Joi = require('joi');
const { obtenerLayout, guardarLayout, eliminarLayout } = require('../services/layoutsService');
const { requireAuth } = require('../middleware/auth');
const { obtenerEmpresaPorId } = require('../config/empresas');

const router = express.Router();
router.use(requireAuth);

const esquemaContexto = Joi.object({
  empresaId: Joi.string().trim().required(),
  modulo: Joi.string().trim().required(),
  anio: Joi.number().integer().min(2000).max(2100).required(),
});

router.get('/', (req, res) => {
  const merged = { ...req.query };
  if (!merged.empresaId) merged.empresaId = req.headers['x-empresa-activa'] || null;
  const { value, error } = esquemaContexto.validate(merged, { abortEarly: false });
  if (error) return res.status(400).json({ mensaje: 'Verifica parámetros', detalles: error.details.map(d=>d.message) });
  const empresa = obtenerEmpresaPorId(value.empresaId);
  if (!empresa) return res.status(404).json({ mensaje: 'Empresa no encontrada' });
  // Permission check: allow admin or module permission cargar/guardar
  const layout = obtenerLayout({ empresaId: value.empresaId, modulo: value.modulo, anio: value.anio });
  return res.json({ layout });
});

router.post('/', (req, res) => {
  const merged = { ...req.body };
  if (!merged.empresaId) merged.empresaId = req.headers['x-empresa-activa'] || null;
  const esquema = esquemaContexto.keys({ datos: Joi.any().required() });
  const { value, error } = esquema.validate(merged, { abortEarly: false });
  if (error) return res.status(400).json({ mensaje: 'Verifica parámetros', detalles: error.details.map(d=>d.message) });
  const empresa = obtenerEmpresaPorId(value.empresaId);
  if (!empresa) return res.status(404).json({ mensaje: 'Empresa no encontrada' });
  try {
    // permission check: require admin or 'Cargar y guardar'
    if (!req.esAdmin && !req.mapaPermisos?.[empresa.id]?.[value.modulo]?.['Cargar y guardar']) {
      return res.status(403).json({ mensaje: 'No cuentas con permisos para guardar templates.' });
    }
    const saved = guardarLayout({ empresaId: value.empresaId, modulo: value.modulo, anio: value.anio, layout: value.datos, usuarioId: req.usuarioActual?.id });
    if (!saved) return res.status(500).json({ mensaje: 'No fue posible guardar el layout.' });
    return res.json({ mensaje: 'Plantilla guardada', success: true });
  } catch (err) {
    console.error('Error al guardar layout:', err);
    return res.status(500).json({ mensaje: 'Ocurrió un error al guardar la plantilla.' });
  }
});

router.delete('/', (req, res) => {
  const merged = { ...req.query };
  if (!merged.empresaId) merged.empresaId = req.headers['x-empresa-activa'] || null;
  const { value, error } = esquemaContexto.validate(merged, { abortEarly: false });
  if (error) return res.status(400).json({ mensaje: 'Verifica parámetros', detalles: error.details.map(d=>d.message) });
  const empresa = obtenerEmpresaPorId(value.empresaId);
  if (!empresa) return res.status(404).json({ mensaje: 'Empresa no encontrada' });
  try {
    if (!req.esAdmin && !req.mapaPermisos?.[empresa.id]?.[value.modulo]?.['Cargar y guardar']) {
      return res.status(403).json({ mensaje: 'No cuentas con permisos para eliminar templates.' });
    }
    const eliminado = eliminarLayout({ empresaId: value.empresaId, modulo: value.modulo, anio: value.anio });
    return res.json({ mensaje: eliminado ? 'Plantilla eliminada' : 'No encontrada', success: eliminado });
  } catch (err) {
    console.error('Error al eliminar layout:', err);
    return res.status(500).json({ mensaje: 'Ocurrió un error al eliminar la plantilla.' });
  }
});

module.exports = router;
