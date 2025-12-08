const express = require('express');
const Joi = require('joi');
const { obtenerEmpresaPorId } = require('../config/empresas');
const { obtenerSaldosPorCuentas, MESES, obtenerAniosDisponibles, obtenerCuentasPorAnio } = require('../services/saldosService');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const esquema = Joi.object({
  anio: Joi.number().integer().min(2000).max(2100).required(),
  empresaId: Joi.string().required(),
  cuentas: Joi.alternatives().try(
    Joi.array().items(Joi.string().trim()).min(1),
    Joi.string().trim() // CSV
  ).required()
});

const puede = (mapa, empresaId) => {
  const p = mapa[empresaId];
  return p && Object.values(p).some((a) => a.Lectura || a['Cargar y guardar'] || a.Revisar || a.Aprobar);
};

router.use(requireAuth);

router.get('/', async (req, res) => {
  const { value, error } = esquema.validate(
    { ...req.query, cuentas: req.query.cuentas },
    { abortEarly: false }
  );

  if (error) {
    return res.status(400).json({ mensaje: 'Parámetros inválidos', detalles: error.details.map((d) => d.message) });
  }

  const empresa = obtenerEmpresaPorId(value.empresaId);
  if (!empresa) return res.status(404).json({ mensaje: 'Empresa no existe.' });

  const mapa = req.mapaPermisos || {};
  if (!req.esAdmin && !puede(mapa, empresa.id)) {
    return res.status(403).json({ mensaje: 'Sin permiso para esta empresa.' });
  }

  const cuentas = Array.isArray(value.cuentas)
    ? value.cuentas
    : value.cuentas.split(',').map((s) => s.trim()).filter(Boolean);

  try {
    const data = await obtenerSaldosPorCuentas(empresa.id, value.anio, cuentas);
    res.json({
      empresa: { id: empresa.id, nombre: empresa.nombre, etiqueta: empresa.etiqueta },
      anio: value.anio,
      meses: MESES,
      cuentas: data
    });
  } catch (e) {
    console.error('Error /api/saldos:', e);
    res.status(500).json({ mensaje: 'No fue posible obtener saldos.' });
  }
});

router.get('/anios', async (req, res) => {
  const { value, error } = Joi.object({
    empresaId: Joi.string().required()
  }).validate(req.query, { abortEarly: false });

  if (error) {
    return res.status(400).json({ mensaje: 'Parámetros inválidos', detalles: error.details.map((d) => d.message) });
  }

  const empresa = obtenerEmpresaPorId(value.empresaId);
  if (!empresa) return res.status(404).json({ mensaje: 'Empresa no existe.' });

  const mapa = req.mapaPermisos || {};
  if (!req.esAdmin && !puede(mapa, empresa.id)) {
    return res.status(403).json({ mensaje: 'Sin permiso para esta empresa.' });
  }

  try {
    const anios = await obtenerAniosDisponibles(empresa.id);
    res.json({ anios });
  } catch (e) {
    console.error('Error /api/saldos/anios:', e);
    res.status(500).json({ mensaje: 'No fue posible obtener años disponibles.' });
  }
});

router.get('/cuentas', async (req, res) => {
  const { value, error } = Joi.object({
    empresaId: Joi.string().required(),
    anio: Joi.number().integer().min(2000).max(2100).required(),
    cuentas: Joi.alternatives().try(
      Joi.array().items(Joi.string().trim()).min(1),
      Joi.string().trim()
    ).optional()
  }).validate(req.query, { abortEarly: false, allowUnknown: true });

  if (error) {
    return res.status(400).json({ mensaje: 'Parámetros inválidos', detalles: error.details.map((d) => d.message) });
  }

  const empresa = obtenerEmpresaPorId(value.empresaId);
  if (!empresa) return res.status(404).json({ mensaje: 'Empresa no existe.' });

  const mapa = req.mapaPermisos || {};
  if (!req.esAdmin && !puede(mapa, empresa.id)) {
    return res.status(403).json({ mensaje: 'Sin permiso para esta empresa.' });
  }

  const cuentas = Array.isArray(value.cuentas)
    ? value.cuentas
    : (value.cuentas || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

  try {
    const cuentasEncontradas = await obtenerCuentasPorAnio(empresa.id, value.anio, cuentas);
    res.json({ cuentas: cuentasEncontradas });
  } catch (e) {
    console.error('Error /api/saldos/cuentas:', e);
    res.status(500).json({ mensaje: 'No fue posible obtener cuentas.' });
  }
});

const esquemaCatalogo = Joi.object({
  empresaId: Joi.string().required(),
  anio: Joi.number().integer().min(2000).max(2100).required()
});

router.get('/catalogo', async (req, res) => {
  const { value, error } = esquemaCatalogo.validate({ ...req.query, empresaId: req.query.empresaId || req.headers['x-empresa-activa'] }, {
    abortEarly: false,
    allowUnknown: true
  });

  if (error) {
    return res.status(400).json({ mensaje: 'Parámetros inválidos', detalles: error.details.map((d) => d.message) });
  }

  const empresa = obtenerEmpresaPorId(value.empresaId);
  if (!empresa) return res.status(404).json({ mensaje: 'Empresa no existe.' });

  const mapa = req.mapaPermisos || {};
  if (!req.esAdmin && !puede(mapa, empresa.id)) {
    return res.status(403).json({ mensaje: 'Sin permiso para esta empresa.' });
  }

  try {
    const cuentas = await obtenerCuentasPorAnio(empresa.id, value.anio);
    return res.json({ cuentas });
  } catch (e) {
    console.error('Error /api/saldos/catalogo:', e);
    return res.status(500).json({ mensaje: 'No fue posible obtener cuentas.' });
  }
});

module.exports = router;
