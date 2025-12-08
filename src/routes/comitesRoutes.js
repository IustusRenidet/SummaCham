const express = require('express');
const Joi = require('joi');
const { obtenerEmpresaPorId } = require('../config/empresas');
const {
  MESES,
  obtenerAniosDisponibles,
  obtenerComites,
  obtenerCuentasDisponibles,
  obtenerMovimientosPorCuentas
} = require('../services/comitesService');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const puede = (mapa, empresaId) => {
  const registro = mapa[empresaId];
  return registro && Object.values(registro).some((a) => a['Cargar y guardar'] || a.Revisar || a.Aprobar);
};

const asegurarPermiso = (req, empresaId) => {
  const empresa = obtenerEmpresaPorId(empresaId);
  if (!empresa) {
    const err = new Error('Empresa no existe.');
    err.status = 404;
    throw err;
  }
  if (!req.esAdmin && !puede(req.mapaPermisos || {}, empresa.id)) {
    const err = new Error('Sin permiso para esta empresa.');
    err.status = 403;
    throw err;
  }
  return empresa;
};

const schemaEmpresa = Joi.object({
  empresaId: Joi.string().required()
});

const schemaEmpresaAnio = Joi.object({
  empresaId: Joi.string().required(),
  anio: Joi.number().integer().min(2000).max(2100).required()
});

const schemaMovimientos = Joi.object({
  empresaId: Joi.string().required(),
  anio: Joi.number().integer().min(2000).max(2100).required(),
  cuentas: Joi.alternatives().try(
    Joi.array().items(Joi.string().trim()).min(1),
    Joi.string().trim()
  ).required()
});

router.use(requireAuth);

router.get('/anios', async (req, res) => {
  try {
    const { value, error } = schemaEmpresa.validate(req.query, { abortEarly: false });
    if (error) {
      return res.status(400).json({ mensaje: 'Parámetros inválidos', detalles: error.details.map((d) => d.message) });
    }

    const empresa = asegurarPermiso(req, value.empresaId);
    const anios = await obtenerAniosDisponibles(empresa.id);
    res.json({ anios });
  } catch (error) {
    console.error('Error /api/comites/anios:', error);
    res.status(error.status || 500).json({
      mensaje: error.status ? error.message : 'No fue posible obtener los años disponibles.'
    });
  }
});

router.get('/lista', async (req, res) => {
  try {
    const { value, error } = schemaEmpresaAnio.validate(req.query, { abortEarly: false });
    if (error) {
      return res.status(400).json({ mensaje: 'Parámetros inválidos', detalles: error.details.map((d) => d.message) });
    }

    const empresa = asegurarPermiso(req, value.empresaId);
    const comites = await obtenerComites(empresa.id, value.anio);
    res.json({ comites });
  } catch (error) {
    console.error('Error /api/comites/lista:', error);
    res.status(error.status || 500).json({
      mensaje: error.status ? error.message : 'No fue posible obtener los comités.'
    });
  }
});

router.get('/cuentas', async (req, res) => {
  try {
    const { value, error } = schemaEmpresaAnio.validate(req.query, { abortEarly: false });
    if (error) {
      return res.status(400).json({ mensaje: 'Parámetros inválidos', detalles: error.details.map((d) => d.message) });
    }

    const empresa = asegurarPermiso(req, value.empresaId);
    const cuentas = await obtenerCuentasDisponibles(empresa.id, value.anio);
    res.json({ cuentas });
  } catch (error) {
    console.error('Error /api/comites/cuentas:', error);
    res.status(error.status || 500).json({
      mensaje: error.status ? error.message : 'No fue posible obtener las cuentas.'
    });
  }
});

router.get('/movimientos', async (req, res) => {
  try {
    const { value, error } = schemaMovimientos.validate({ ...req.query, cuentas: req.query.cuentas }, { abortEarly: false });
    if (error) {
      return res.status(400).json({ mensaje: 'Parámetros inválidos', detalles: error.details.map((d) => d.message) });
    }

    const empresa = asegurarPermiso(req, value.empresaId);
    const cuentas = Array.isArray(value.cuentas)
      ? value.cuentas
      : value.cuentas.split(',').map((c) => c.trim()).filter(Boolean);

    if (!cuentas.length) {
      return res.json({ cuentas: [], meses: MESES });
    }

    const movimientos = await obtenerMovimientosPorCuentas(empresa.id, value.anio, cuentas);
    res.json({ cuentas: movimientos, meses: MESES });
  } catch (error) {
    console.error('Error /api/comites/movimientos:', error);
    res.status(error.status || 500).json({
      mensaje: error.status ? error.message : 'No fue posible obtener los movimientos.'
    });
  }
});

module.exports = router;
