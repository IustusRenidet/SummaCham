const express = require('express');
const Joi = require('joi');
const { generarSummary } = require('../services/engines/summaryEngine');
const { generarResumenEjecutivo } = require('../services/engines/resumenEngine');
const { obtenerEmpresaPorId } = require('../config/empresas');

const router = express.Router();

const esquemaConsulta = Joi.object({
  empresaId: Joi.string().trim().required(),
  anio: Joi.number().integer().min(2000).max(2100).optional(),
  mes: Joi.alternatives().try(
    Joi.number().integer().min(1).max(12),
    Joi.string().trim()
  ).optional()
});

const normalizarAnio = (valor) => {
  const numero = Number(valor);
  if (Number.isInteger(numero) && numero >= 2000 && numero <= 2100) {
    return numero;
  }
  return new Date().getFullYear();
};

const normalizarMes = (valor) => {
  if (valor == null) return null;
  const texto = valor.toString().trim().toLowerCase();
  if (!texto) return null;
  const numero = Number(texto);
  if (Number.isInteger(numero) && numero >= 1 && numero <= 12) {
    return numero;
  }
  const nombres = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];
  const indice = nombres.findIndex((nombre) => nombre.startsWith(texto));
  return indice >= 0 ? indice + 1 : null;
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
    const data = await generarSummary(value.empresaId, normalizarAnio(value.anio), normalizarMes(value.mes));
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
    // Usar el nuevo motor unificado
    const { generarReporte } = require('../services/reportes/planeacionReportesEngine');
    const data = await generarReporte('RESUMEN', value.empresaId, normalizarAnio(value.anio), normalizarMes(value.mes));
    res.json(data);
  } catch (errorRes) {
    console.error('Error generando Resumen:', errorRes);
    res.status(500).json({ mensaje: 'No fue posible generar el reporte de Resumen.' });
  }
});

module.exports = router;
