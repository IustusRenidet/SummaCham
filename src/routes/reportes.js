const express = require('express');
const Joi = require('joi');
const { generarSummary } = require('../services/engines/summaryEngine');
const { generarResumenEjecutivo } = require('../services/engines/resumenEngine');
const { obtenerEmpresaPorId } = require('../config/empresas');
const { requireAuth, tienePermisoEmpresa, tienePermisoModulo } = require('../middleware/auth');
const { generarOperativoExcel } = require('../services/reportes/operativoExcelService');
const { generarResumenExcel } = require('../services/reportes/resumenExcelService');
const {
  createNativeExcelJob,
  getJobForUser,
  getJobDownloadForUser,
} = require('../services/reportes/exportJobsService');

const router = express.Router();

router.use(requireAuth);

const rawExcelParser = express.raw({
  type: 'application/octet-stream',
  // Archivos base con estilos/merges pueden crecer bastante.
  // Aumentamos margen para evitar rechazos 413 en exportación nativa.
  limit: '80mb',
});

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
  dataSheetName: Joi.string().allow("").optional(),
  chartsSheetName: Joi.string().allow("").optional(),
  filas: Joi.array()
    .items(
      Joi.object({
        etiqueta: Joi.string().trim().required(),
        presupuesto: Joi.alternatives().try(Joi.number(), Joi.string()).optional(),
        real: Joi.alternatives().try(Joi.number(), Joi.string()).optional(),
        anual: Joi.alternatives().try(Joi.number(), Joi.string()).optional(),
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
  if (
    !req.esAdmin &&
    !tienePermisoModulo(req.mapaPermisos, value.empresaId, 'SUMMARY', null, {
      ignorarUniversales: true
    })
  ) {
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

// Mapa de empresas comparativas → empresa principal para verificar permisos
const COMPARATIVA_A_PRINCIPAL = {
  empresa9: 'empresa1',
  empresa10: 'empresa2',
  empresa11: 'empresa3',
  empresa12: 'empresa4',
};

router.get('/resumen', async (req, res) => {
  const { value, error } = esquemaConsulta.validate(req.query, { abortEarly: false });
  if (error) {
    return res.status(400).json({ mensaje: 'Parámetros inválidos.', detalles: error.details.map((d) => d.message) });
  }
  const empresa = obtenerEmpresaPorId(value.empresaId);
  if (!empresa) {
    return res.status(404).json({ mensaje: 'Empresa no encontrada.' });
  }
  // Para empresas comparativas (9-12), verificar permisos de la empresa principal (1-4)
  const empresaIdPermisos = COMPARATIVA_A_PRINCIPAL[value.empresaId.toLowerCase()] || value.empresaId;
  if (!req.esAdmin && !tienePermisoEmpresa(req.mapaPermisos, empresaIdPermisos)) {
    return res.status(403).json({ mensaje: 'No cuentas con permisos para esta empresa.' });
  }
  if (
    !req.esAdmin &&
    !tienePermisoModulo(req.mapaPermisos, empresaIdPermisos, 'RESUMEN', null, {
      ignorarUniversales: true
    })
  ) {
    return res.status(403).json({ mensaje: 'No cuentas con permisos para este reporte.' });
  }
  try {
    // Usar el nuevo motor unificado
    const { generarReporte } = require('../services/reportes/planeacionReportesEngine');
    const data = await generarReporte('RESUMEN', value.empresaId, normalizarAnio(value.anio), normalizarMes(value.mes), value.capitulo);
    res.json(data);
  } catch (errorRes) {
    console.error('Error generando Resumen:', errorRes);
    res.status(500).json({
      mensaje: 'No fue posible generar el reporte de Resumen.',
      detalle: errorRes?.message || null
    });
  }
});

// Diagnóstico rápido de conexión Firebird por empresa
router.get('/diagnostico-firebird', async (req, res) => {
  const { empresaId } = req.query || {};
  if (!empresaId) {
    return res.status(400).json({ mensaje: 'empresaId es requerido.' });
  }
  const empresa = obtenerEmpresaPorId(empresaId);
  if (!empresa) {
    return res.status(404).json({ mensaje: 'Empresa no encontrada.' });
  }
  if (!req.esAdmin && !tienePermisoEmpresa(req.mapaPermisos, empresaId)) {
    return res.status(403).json({ mensaje: 'No cuentas con permisos para esta empresa.' });
  }
  try {
    const { probarConexion } = require('../services/firebirdService');
    const ok = await probarConexion(empresaId);
    return res.json({
      success: true,
      empresaId,
      ok: Boolean(ok),
      mensaje: ok ? 'Conexion Firebird OK.' : 'Conexion Firebird no disponible.'
    });
  } catch (errorDiag) {
    console.error('Error diagnóstico Firebird:', errorDiag);
    return res.status(500).json({
      success: false,
      empresaId,
      ok: false,
      mensaje: 'No fue posible conectar con Firebird.',
      detalle: errorDiag?.message || null
    });
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
    res.setHeader("Content-Length", buffer.length);
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

router.post('/operativo-excel-native', rawExcelParser, async (req, res) => {
  if (!req.body || !Buffer.isBuffer(req.body) || req.body.length === 0) {
    return res.status(400).send('Archivo Excel no recibido.');
  }

  const leerQuery = (valor) => {
    if (typeof valor === 'string') return valor;
    if (Array.isArray(valor)) return valor[0];
    return '';
  };

  try {
    const { buffer, filename } = await generarOperativoExcel({
      libroBuffer: req.body,
      nombreArchivo: leerQuery(req.query.nombreArchivo),
      empresa: leerQuery(req.query.empresa),
      mes: leerQuery(req.query.mes),
      anio: leerQuery(req.query.anio),
      dataSheetName: leerQuery(req.query.dataSheetName),
      chartsSheetName: leerQuery(req.query.chartsSheetName),
      tableSheetName: leerQuery(req.query.tableSheetName),
      chartMode: leerQuery(req.query.chartMode),
      seriesMeta: leerQuery(req.query.seriesMeta),
    });
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (errorExcel) {
    console.error('Error generando Excel operativo (native):', errorExcel);
    res
      .status(500)
      .send(
        `No fue posible generar el Excel con graficas. ${errorExcel.message || ""}`.trim()
      );
  }
});

router.post('/resumen-excel-native', rawExcelParser, async (req, res) => {
  if (!req.body || !Buffer.isBuffer(req.body) || req.body.length === 0) {
    return res.status(400).send('Archivo Excel no recibido.');
  }

  const leerQuery = (valor) => {
    if (typeof valor === 'string') return valor;
    if (Array.isArray(valor)) return valor[0];
    return '';
  };

  try {
    const { buffer, filename } = await generarResumenExcel({
      libroBuffer: req.body,
      nombreArchivo: leerQuery(req.query.nombreArchivo),
      empresa: leerQuery(req.query.empresa),
      mes: leerQuery(req.query.mes),
      anio: leerQuery(req.query.anio),
      dataSheetName: leerQuery(req.query.dataSheetName),
      chartsSheetName: leerQuery(req.query.chartsSheetName),
      tableSheetName: leerQuery(req.query.tableSheetName),
      seriesMeta: leerQuery(req.query.seriesMeta),
    });
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (errorExcel) {
    console.error('Error generando Excel resumen (native):', errorExcel);
    res
      .status(500)
      .send(
        `No fue posible generar el Excel con graficas. ${errorExcel.message || ""}`.trim()
      );
  }
});

router.post('/export-jobs/native', rawExcelParser, async (req, res) => {
  if (!req.body || !Buffer.isBuffer(req.body) || req.body.length === 0) {
    return res.status(400).json({ mensaje: 'Archivo Excel no recibido.' });
  }
  const tipoRaw = (req.query?.tipo || '').toString().trim().toLowerCase();
  const tipo = tipoRaw === 'resumen' ? 'resumen' : tipoRaw === 'operativo' ? 'operativo' : '';
  if (!tipo) {
    return res.status(400).json({ mensaje: "Parámetro 'tipo' inválido. Usa 'operativo' o 'resumen'." });
  }
  try {
    const job = createNativeExcelJob({
      userId: req.usuarioActual?.id,
      tipo,
      libroBuffer: req.body,
      params: req.query || {},
    });
    return res.status(202).json({ job });
  } catch (error) {
    console.error('Error creando export job:', error);
    return res.status(500).json({
      mensaje: 'No fue posible crear el trabajo de exportación.',
      detalle: error?.message || null,
    });
  }
});

router.get('/export-jobs/:jobId', (req, res) => {
  const jobId = (req.params?.jobId || '').toString().trim();
  if (!jobId) {
    return res.status(400).json({ mensaje: 'jobId es requerido.' });
  }
  const job = getJobForUser({
    userId: req.usuarioActual?.id,
    jobId,
  });
  if (!job) {
    return res.status(404).json({ mensaje: 'Export job no encontrado.' });
  }
  return res.json({ job });
});

router.get('/export-jobs/:jobId/download', (req, res) => {
  const jobId = (req.params?.jobId || '').toString().trim();
  if (!jobId) {
    return res.status(400).json({ mensaje: 'jobId es requerido.' });
  }
  const job = getJobDownloadForUser({
    userId: req.usuarioActual?.id,
    jobId,
  });
  if (!job) {
    return res.status(404).json({ mensaje: 'Export job no encontrado.' });
  }
  if (job.status === 'failed') {
    return res.status(422).json({
      mensaje: 'El trabajo de exportación falló.',
      detalle: job.error || null,
    });
  }
  if (job.status !== 'completed' || !Buffer.isBuffer(job.buffer)) {
    return res.status(409).json({
      mensaje: 'El archivo todavía no está listo.',
      status: job.status,
    });
  }
  const filename = job.filename || `Export_${job.tipo || 'excel'}.xlsx`;
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', job.buffer.length);
  return res.send(job.buffer);
});

module.exports = router;
