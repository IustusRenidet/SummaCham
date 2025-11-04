const express = require('express');
const Joi = require('joi');
const { db } = require('../db/sqlite');
const { obtenerEmpresaPorId } = require('../config/empresas');
const { construirMapaPermisos } = require('../services/permisosService');
const { obtenerPresupuestosMayor, PERIODOS } = require('../services/presupuestosService');

const router = express.Router();

const normalizarUsuario = (valor) => (valor || '').toString().trim().toUpperCase();

const esquemaConsulta = Joi.object({
  anio: Joi.number().integer().min(2000).max(2100).optional(),
  empresaId: Joi.string().trim().optional()
});

const serializarEmpresa = (empresa) => {
  if (!empresa) {
    return null;
  }
  return {
    id: empresa.id,
    nombre: empresa.nombre,
    etiqueta: empresa.etiqueta
  };
};

const tienePermisoEnEmpresa = (mapaPermisos, empresaId) => {
  const permisos = mapaPermisos[empresaId];
  if (!permisos) {
    return false;
  }
  return Object.values(permisos).some((acciones) => acciones['Cargar y guardar'] || acciones.Revisar || acciones.Aprobar);
};

router.get('/', async (req, res) => {
  const usuarioEncabezado = normalizarUsuario(req.headers['x-usuario-actual']);
  if (!usuarioEncabezado) {
    return res.status(401).json({ mensaje: 'No fue posible validar al usuario actual.' });
  }

  const consultaDatosSesion = db.prepare(`
    SELECT id, usuario, es_admin_global
    FROM usuarios
    WHERE usuario = ?
  `);
  const usuario = consultaDatosSesion.get(usuarioEncabezado);
  if (!usuario) {
    return res.status(401).json({ mensaje: 'No fue posible validar al usuario actual.' });
  }

  const esIconet = usuario.usuario === 'ICONET';
  const esAdmin = esIconet || Boolean(usuario.es_admin_global);

  const { value, error } = esquemaConsulta.validate(req.query, { abortEarly: false });
  if (error) {
    return res.status(400).json({ mensaje: 'Los parámetros proporcionados no son válidos.', detalles: error.details.map((detalle) => detalle.message) });
  }

  const empresaId = value.empresaId || req.headers['x-empresa-activa'];
  if (!empresaId) {
    return res.status(400).json({ mensaje: 'Debes indicar una empresa.' });
  }

  const empresa = obtenerEmpresaPorId(empresaId);
  if (!empresa) {
    return res.status(404).json({ mensaje: 'La empresa indicada no existe.' });
  }

  let mapaPermisos = {};
  if (!esAdmin) {
    const permisos = db.prepare(`
      SELECT empresa_id, modulo, puede_cargar_guardar, puede_revisar, puede_aprobar
      FROM permisos_modulo
      WHERE usuario_id = ?
    `).all(usuario.id);
    mapaPermisos = construirMapaPermisos(permisos);
    if (!tienePermisoEnEmpresa(mapaPermisos, empresa.id)) {
      return res.status(403).json({ mensaje: 'No cuentas con permisos para consultar esta empresa.' });
    }
  }

  const anioActual = new Date().getFullYear();
  const ejercicio = value.anio || anioActual;

  try {
    const cuentas = await obtenerPresupuestosMayor(empresa.id, ejercicio);
    res.json({
      empresa: serializarEmpresa(empresa),
      anio: ejercicio,
      periodos: PERIODOS,
      cuentas
    });
  } catch (err) {
    console.error('Error al consultar presupuestos:', err);
    res.status(500).json({ mensaje: 'No fue posible obtener la información de presupuestos.' });
  }
});

module.exports = router;
