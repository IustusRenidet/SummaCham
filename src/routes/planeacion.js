const express = require('express');
const Joi = require('joi');
const { obtenerEmpresaPorId } = require('../config/empresas');
const { construirMapaPermisos } = require('../services/permisosService');
const { obtenerDatosPlaneacion } = require('../services/planeacionCuentasService');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const normalizarModulo = (valor = '') => {
  return valor
    .toString()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
};

const MODULOS_PLANEACION = new Set([
  'comites',
  'comunicacion',
  'direccion',
  'eventos',
  'finanzas',
  'gtoscorporativos',
  'membresia',
  'presupuestos',
  'rh',
  'servmembresia',
  'tic',
  'vpe'
]);

const asegurarEmpresa = (empresaId) => {
  const empresa = obtenerEmpresaPorId(empresaId);
  if (!empresa) {
    const err = new Error('Empresa no encontrada.');
    err.status = 404;
    throw err;
  }
  return empresa;
};

const puedeEnEmpresa = (mapa, empresaId) => {
  const registro = mapa[empresaId];
  if (!registro) {
    return false;
  }
  return Object.values(registro).some((acciones) => acciones['Cargar y guardar'] || acciones.Revisar || acciones.Aprobar);
};

const esquemaConsulta = Joi.object({
  empresaId: Joi.string().trim().required(),
  anio: Joi.number().integer().min(2000).max(2100).required(),
  modulo: Joi.string().trim().required(),
  cuentas: Joi.array().items(Joi.string().trim().min(1).max(24)).min(1).required()
});

router.use(requireAuth);

router.post('/cuentas', async (req, res) => {
  try {
    const { value, error } = esquemaConsulta.validate(req.body || {}, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        mensaje: 'Parámetros inválidos',
        detalles: error.details.map((detalle) => detalle.message)
      });
    }

    const moduloId = normalizarModulo(value.modulo);
    if (!MODULOS_PLANEACION.has(moduloId)) {
      return res.status(400).json({ mensaje: 'Módulo no soportado para consulta de cuentas.' });
    }

    const esAdmin = Boolean(req.esAdmin);
    const mapaPermisos = req.mapaPermisos || construirMapaPermisos([]);
    const empresa = asegurarEmpresa(value.empresaId);

    if (!esAdmin && !puedeEnEmpresa(mapaPermisos, empresa.id)) {
      return res.status(403).json({ mensaje: 'Sin permiso para consultar esta empresa.' });
    }

    const datos = await obtenerDatosPlaneacion({
      empresaId: empresa.id,
      anio: value.anio,
      cuentas: value.cuentas
    });

    res.json({ cuentas: datos });
  } catch (err) {
    console.error('Error en POST /api/planeacion/cuentas', err);
    res.status(err.status || 500).json({
      mensaje: err.status ? err.message : 'No fue posible obtener la información solicitada.'
    });
  }
});

router.get('/catalogo', (req, res) => {
  res.json({ cuentas: [] });
});

module.exports = router;
