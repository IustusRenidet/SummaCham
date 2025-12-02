const express = require('express');
const Joi = require('joi');
const { generarSummary } = require('../services/engines/summaryEngine');
const { generarResumenEjecutivo } = require('../services/engines/resumenEngine');
const { obtenerEmpresaPorId } = require('../config/empresas');
const path = require('path');

const router = express.Router();

const esquemaConsulta = Joi.object({
  empresaId: Joi.string().trim().required(),
  anio: Joi.number().integer().min(2000).max(2100).optional()
});

const normalizarAnio = (valor) => {
  const numero = Number(valor);
  if (Number.isInteger(numero) && numero >= 2000 && numero <= 2100) {
    return numero;
  }
  return new Date().getFullYear();
};

router.get('/summary', async (req, res) => {
  const { value, error } = esquemaConsulta.validate(req.query, { abortEarly: false });
  if (error) {
    return res.status(400).json({ mensaje: 'Parámetros inválidos.', detalles: error.details.map((d) => d.message) });
  }
  const empresa = obtenerEmpresaPorId(value.empresaId);
  if (!empresa) {
    return res.status(404).json({ mensaje: 'Empresa no encontrada.' });
  }
  try {
    const data = await generarSummary(value.empresaId, normalizarAnio(value.anio), { basePath: path.join(__dirname, '..', '..', 'info IMPORTANTE') });
    res.json(data);
  } catch (errorSum) {
    console.error('Error generando Summary:', errorSum);
    res.status(500).json({ mensaje: 'No fue posible generar el reporte de Summary.' });
  }
});

router.get('/resumen', async (req, res) => {
  const { value, error } = esquemaConsulta.validate(req.query, { abortEarly: false });
  if (error) {
    return res.status(400).json({ mensaje: 'Parámetros inválidos.', detalles: error.details.map((d) => d.message) });
  }
  const empresa = obtenerEmpresaPorId(value.empresaId);
  if (!empresa) {
    return res.status(404).json({ mensaje: 'Empresa no encontrada.' });
  }
  try {
    const data = await generarResumenEjecutivo(value.empresaId, normalizarAnio(value.anio), {
      basePath: path.join(__dirname, '..', '..', 'info IMPORTANTE')
    });
    res.json(data);
  } catch (errorRes) {
    console.error('Error generando Resumen:', errorRes);
    res.status(500).json({ mensaje: 'No fue posible generar el reporte de Resumen.' });
  }
});

module.exports = router;
