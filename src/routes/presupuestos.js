const express = require('express');
const Joi = require('joi');
const { db } = require('../db/sqlite');
const { obtenerEmpresaPorId } = require('../config/empresas');
const { MODULOS, construirMapaPermisos } = require('../services/permisosService');
const { obtenerPresupuestosMayor, PERIODOS } = require('../services/presupuestosService');
const { notificarWorkflowPresupuesto } = require('../services/notificacionesService');

const router = express.Router();

const normalizarUsuario = (valor) => (valor || '').toString().trim().toUpperCase();

const esquemaConsulta = Joi.object({
  anio: Joi.number().integer().min(2000).max(2100).optional(),
  empresaId: Joi.string().trim().optional()
});

const esquemaEstado = Joi.object({
  modulo: Joi.string().trim().required(),
  anio: Joi.number().integer().min(2000).max(2100).required()
});

const esquemaTransicion = Joi.object({
  modulo: Joi.string().trim().required(),
  anio: Joi.number().integer().min(2000).max(2100).required(),
  accion: Joi.string().valid('cargar', 'revisar', 'autorizar', 'aprobar').required()
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

const ESTADOS_VALIDOS = ['sin-cargar', 'borrador', 'revisado', 'autorizado', 'aprobado'];

const TRANSICIONES = {
  cargar: { destino: 'borrador', requiere: 'Cargar y guardar', habilita: (estado) => ['sin-cargar', 'borrador'].includes(estado) },
  revisar: { destino: 'revisado', requiere: 'Revisar', habilita: (estado) => estado === 'borrador' },
  autorizar: { destino: 'autorizado', requiere: 'Aprobar', habilita: (estado) => estado === 'revisado' },
  aprobar: { destino: 'aprobado', requiere: 'Aprobar', habilita: (estado) => estado === 'autorizado' }
};

const construirNombreUsuario = (registro) => {
  const partes = [registro?.nombres, registro?.apellido_primero, registro?.apellido_segundo].filter(Boolean);
  const nombre = partes.join(' ').trim();
  return nombre || registro?.usuario || 'Usuario';
};

const cargarUsuarioActual = (req, res, next) => {
  const usuarioEncabezado = normalizarUsuario(req.headers['x-usuario-actual']);
  if (!usuarioEncabezado) {
    return res.status(401).json({ mensaje: 'No fue posible validar al usuario actual.' });
  }
  const registro = db.prepare(`
    SELECT id, usuario, es_admin_global, nombres, apellido_primero, apellido_segundo, apellidos
    FROM usuarios
    WHERE usuario = ?
  `).get(usuarioEncabezado);
  if (!registro) {
    return res.status(401).json({ mensaje: 'No fue posible validar al usuario actual.' });
  }
  req.usuarioActual = registro;
  const esIconet = registro.usuario === 'ICONET';
  req.esAdmin = esIconet || Boolean(registro.es_admin_global);
  if (!req.esAdmin) {
    const permisos = db.prepare(`
      SELECT empresa_id, modulo, puede_cargar_guardar, puede_revisar, puede_aprobar
      FROM permisos_modulo
      WHERE usuario_id = ?
    `).all(registro.id);
    req.mapaPermisos = construirMapaPermisos(permisos);
  } else {
    req.mapaPermisos = {};
  }
  next();
};

router.use(cargarUsuarioActual);

const tienePermisoEnEmpresa = (mapaPermisos, empresaId) => {
  const permisos = mapaPermisos?.[empresaId];
  if (!permisos) {
    return false;
  }
  return Object.values(permisos).some((acciones) => acciones['Cargar y guardar'] || acciones.Revisar || acciones.Aprobar);
};

const tienePermisoEnModulo = (mapaPermisos, empresaId, modulo, accion) => {
  const permisos = mapaPermisos?.[empresaId]?.[modulo];
  if (!permisos) {
    return false;
  }
  if (!accion) {
    return Boolean(permisos['Cargar y guardar'] || permisos.Revisar || permisos.Aprobar);
  }
  return Boolean(permisos[accion]);
};

const validarModulo = (modulo) => MODULOS.includes(modulo);

const obtenerEstadoPresupuesto = (empresaId, modulo, anio) => {
  const estadoActual = db.prepare(`
    SELECT e.estado,
           e.actualizado_en AS actualizadoEn,
           TRIM(COALESCE(u.nombres, '') || ' ' || COALESCE(u.apellidos, '')) AS actualizadoPor
    FROM presupuestos_estado e
    LEFT JOIN usuarios u ON u.id = e.actualizado_por
    WHERE e.empresa_id = ? AND e.modulo = ? AND e.anio = ?
  `).get(empresaId, modulo, anio);
  const historial = db.prepare(`
    SELECT h.estado, h.registrado_en AS fecha,
           TRIM(COALESCE(u.nombres, '') || ' ' || COALESCE(u.apellidos, '')) AS usuario
    FROM presupuestos_estado_historial h
    LEFT JOIN usuarios u ON u.id = h.usuario_id
    WHERE h.empresa_id = ? AND h.modulo = ? AND h.anio = ?
    ORDER BY h.registrado_en DESC
    LIMIT 10
  `).all(empresaId, modulo, anio);
  return {
    estado: estadoActual?.estado || 'sin-cargar',
    actualizadoEn: estadoActual?.actualizadoEn || null,
    actualizadoPor: estadoActual?.actualizadoPor || '',
    historial: historial.map((registro) => ({
      estado: registro.estado,
      fecha: registro.fecha,
      usuario: registro.usuario
    }))
  };
};

const guardarEstadoPresupuesto = (empresaId, modulo, anio, estado, usuarioId) => {
  db.prepare(`
    INSERT INTO presupuestos_estado (
      empresa_id, modulo, anio, estado, actualizado_por, actualizado_en
    ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(empresa_id, modulo, anio) DO UPDATE SET
      estado = excluded.estado,
      actualizado_por = excluded.actualizado_por,
      actualizado_en = CURRENT_TIMESTAMP
  `).run(empresaId, modulo, anio, estado, usuarioId);
  db.prepare(`
    INSERT INTO presupuestos_estado_historial (
      empresa_id, modulo, anio, estado, usuario_id, registrado_en
    ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(empresaId, modulo, anio, estado, usuarioId);
  return obtenerEstadoPresupuesto(empresaId, modulo, anio);
};

router.get('/', async (req, res) => {
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
  if (!req.esAdmin && !tienePermisoEnEmpresa(req.mapaPermisos, empresa.id)) {
    return res.status(403).json({ mensaje: 'No cuentas con permisos para consultar esta empresa.' });
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

router.get('/estado', (req, res) => {
  const { value, error } = esquemaEstado.validate(req.query, { abortEarly: false });
  if (error) {
    return res.status(400).json({ mensaje: 'Los parámetros proporcionados no son válidos.', detalles: error.details.map((detalle) => detalle.message) });
  }
  const empresaId = req.headers['x-empresa-activa'];
  if (!empresaId) {
    return res.status(400).json({ mensaje: 'Debes indicar una empresa.' });
  }
  const modulo = value.modulo;
  if (!validarModulo(modulo)) {
    return res.status(400).json({ mensaje: 'El módulo indicado no es válido.' });
  }
  const empresa = obtenerEmpresaPorId(empresaId);
  if (!empresa) {
    return res.status(404).json({ mensaje: 'La empresa indicada no existe.' });
  }
  if (!req.esAdmin && !tienePermisoEnModulo(req.mapaPermisos, empresaId, modulo)) {
    return res.status(403).json({ mensaje: 'No cuentas con permisos para este módulo.' });
  }
  const estado = obtenerEstadoPresupuesto(empresaId, modulo, value.anio);
  res.json(estado);
});

router.post('/estado', (req, res) => {
  const { value, error } = esquemaTransicion.validate(req.body || {}, { abortEarly: false });
  if (error) {
    return res.status(400).json({ mensaje: 'Verifica la información proporcionada.', detalles: error.details.map((detalle) => detalle.message) });
  }
  const empresaId = req.headers['x-empresa-activa'];
  if (!empresaId) {
    return res.status(400).json({ mensaje: 'Debes indicar una empresa.' });
  }
  const modulo = value.modulo;
  if (!validarModulo(modulo)) {
    return res.status(400).json({ mensaje: 'El módulo indicado no existe.' });
  }
  const empresa = obtenerEmpresaPorId(empresaId);
  if (!empresa) {
    return res.status(404).json({ mensaje: 'La empresa indicada no existe.' });
  }
  const transicion = TRANSICIONES[value.accion];
  if (!transicion) {
    return res.status(400).json({ mensaje: 'Acción no reconocida.' });
  }
  if (!req.esAdmin && !tienePermisoEnModulo(req.mapaPermisos, empresaId, modulo, transicion.requiere)) {
    return res.status(403).json({ mensaje: 'No cuentas con permisos para realizar esta acción.' });
  }
  const estadoActual = obtenerEstadoPresupuesto(empresaId, modulo, value.anio);
  if (!transicion.habilita(estadoActual.estado)) {
    return res.status(409).json({ mensaje: `El estado actual no permite ejecutar la acción ${value.accion}.` });
  }
  const nuevoEstado = guardarEstadoPresupuesto(empresaId, modulo, value.anio, transicion.destino, req.usuarioActual.id);
  const mensaje = `El presupuesto se actualizó a ${transicion.destino}.`;
  res.json({ mensaje, ...nuevoEstado });
  notificarWorkflowPresupuesto({
    empresaId,
    modulo,
    anio: value.anio,
    accion: value.accion,
    estado: transicion.destino,
    ejecutor: {
      id: req.usuarioActual.id,
      usuario: req.usuarioActual.usuario,
      nombre: construirNombreUsuario(req.usuarioActual)
    }
  }).catch((notifError) => {
    console.warn('No fue posible enviar notificaciones del workflow.', notifError);
  });
});

module.exports = router;
