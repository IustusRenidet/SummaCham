const express = require('express');
const Joi = require('joi');
const { generarSummary } = require('../services/engines/summaryEngine');
const { generarResumenEjecutivo } = require('../services/engines/resumenEngine');
const { obtenerEmpresaPorId } = require('../config/empresas');
const { requireAuth, tienePermisoEmpresa } = require('../middleware/auth');
const { esUsuarioPermitidoResumen } = require('../services/usuariosPolicy');
const { generarOperativoExcel } = require('../services/reportes/operativoExcelService');

const router = express.Router();

router.use(requireAuth);

const esquemaConsulta = Joi.object({
  empresaId: Joi.string().trim().required(),
  anio: Joi.number().integer().min(2000).max(2100).optional(),
  mes: Joi.alternatives().try(
    Joi.number().integer().min(1).max(12),
    Joi.string().trim()
  ).optional(),
  capitulo: Joi.string().trim().optional()
});

const esquemaOperativo = Joi.object({
  label: Joi.string().allow("").optional(),
  empresa: Joi.string().allow("").optional(),
  anio: Joi.alternatives().try(Joi.number().integer(), Joi.string()).optional(),
  mes: Joi.string().allow("").optional(),
  nombreArchivo: Joi.string().allow("").optional(),
  filas: Joi.array()
    .items(
      Joi.object({
        etiqueta: Joi.string().trim().required(),
        presupuesto: Joi.alternatives().try(Joi.number(), Joi.string()).optional(),
        real: Joi.alternatives().try(Joi.number(), Joi.string()).optional(),
      })
    )
    .min(1)
    .required(),
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
  if (!req.esAdmin && !tienePermisoEmpresa(req.mapaPermisos, value.empresaId)) {
    return res.status(403).json({ mensaje: 'No cuentas con permisos para esta empresa.' });
  }
  if (!req.esAdmin && !esUsuarioPermitidoResumen(req.usuarioActual?.usuario)) {
    return res.status(403).json({ mensaje: 'No cuentas con permisos para este reporte.' });
  }
  try {
    const data = await generarSummary(value.empresaId, normalizarAnio(value.anio), normalizarMes(value.mes), value.capitulo);
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
  if (!req.esAdmin && !tienePermisoEmpresa(req.mapaPermisos, value.empresaId)) {
    return res.status(403).json({ mensaje: 'No cuentas con permisos para esta empresa.' });
  }
  if (!req.esAdmin && !esUsuarioPermitidoResumen(req.usuarioActual?.usuario)) {
    return res.status(403).json({ mensaje: 'No cuentas con permisos para este reporte.' });
  }
  try {
    // Usar el nuevo motor unificado
    const { generarReporte } = require('../services/reportes/planeacionReportesEngine');
    const data = await generarReporte('RESUMEN', value.empresaId, normalizarAnio(value.anio), normalizarMes(value.mes), value.capitulo);
    res.json(data);
  } catch (errorRes) {
    console.error('Error generando Resumen:', errorRes);
    res.status(500).json({ mensaje: 'No fue posible generar el reporte de Resumen.' });
  }
});

router.post('/operativo-excel', async (req, res) => {
  const { value, error } = esquemaOperativo.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).send("Parametros invalidos.");
  }

  try {
    const { buffer, filename } = await generarOperativoExcel(value);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (errorExcel) {
    console.error("Error generando Excel operativo:", errorExcel);
    res
      .status(500)
      .send(
        `No fue posible generar el Excel con graficas. ${errorExcel.message || ""}`.trim()
      );
  }
});

module.exports = router;
