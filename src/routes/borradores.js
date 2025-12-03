const express = require('express');
const Joi = require('joi');
const { db } = require('../db/sqlite');
const { obtenerEmpresaPorId } = require('../config/empresas');
const { MODULOS, construirMapaPermisos } = require('../services/permisosService');
const {
  guardarBorrador,
  obtenerBorrador,
  enviarRevision,
  autorizarBorrador,
  rechazarBorrador,
  obtenerBorradorPorId,
  marcarRevisado,
  guardarAutorizado,
  ESTADOS
} = require('../services/borradoresService');
const { notificarWorkflowPresupuesto } = require('../services/notificacionesService');

const router = express.Router();

const normalizarUsuario = (valor) => (valor || '').toString().trim().toUpperCase();

const normalizarTexto = (valor) => {
  if (!valor) return '';
  const base = valor.toString().trim().toLowerCase();
  if (typeof String.prototype.normalize === 'function') {
    return base.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  return base;
};

const cargarUsuarioActual = (req, res, next) => {
  const encabezado = normalizarUsuario(req.headers['x-usuario-actual']);
  if (!encabezado) {
    return res.status(401).json({ mensaje: 'No fue posible validar al usuario actual.' });
  }
  const registro = db.prepare(`
    SELECT id, usuario, es_admin_global, nombres, apellido_primero, apellido_segundo, apellidos
    FROM usuarios
    WHERE usuario = ?
  `).get(encabezado);
  if (!registro) {
    return res.status(401).json({ mensaje: 'No fue posible validar al usuario actual.' });
  }
  req.usuarioActual = registro;
  const esIconet = registro.usuario === 'ICONET';
  req.esAdmin = esIconet || Boolean(registro.es_admin_global);
  if (!req.esAdmin) {
    const permisos = db.prepare(`
      SELECT empresa_id, modulo, puede_leer, puede_cargar_guardar, puede_revisar, puede_aprobar
      FROM permisos_modulo
      WHERE usuario_id = ?
    `).all(registro.id);
    req.mapaPermisos = construirMapaPermisos(permisos);
  } else {
    req.mapaPermisos = {};
  }
  next();
};

const obtenerModuloCanonico = (valor) => {
  const buscado = normalizarTexto(valor);
  if (!buscado) {
    return null;
  }
  return MODULOS.find((modulo) => normalizarTexto(modulo) === buscado) || null;
};

const resolverEmpresaId = (req) => {
  if (!req) return null;
  return req.headers['x-empresa-activa']
    || (req.body && req.body.empresaId)
    || (req.query && req.query.empresaId)
    || null;
};

const tienePermisoEnModulo = (mapaPermisos, empresaId, modulo, accion) => {
  const permisos = mapaPermisos && mapaPermisos[empresaId] && mapaPermisos[empresaId][modulo];
  if (!permisos) {
    return false;
  }
  if (!accion) {
    return Object.values(permisos).some(Boolean);
  }
  return Boolean(permisos[accion]);
};

const esquemaContexto = Joi.object({
  empresaId: Joi.string().trim().required(),
  modulo: Joi.string().trim().required(),
  anio: Joi.number().integer().min(2000).max(2100).required()
});

const esquemaGuardar = esquemaContexto.keys({
  datos: Joi.any().required()
});

const esquemaBorradorId = Joi.object({
  borradorId: Joi.number().integer().required()
});

const esquemaRechazo = esquemaBorradorId.keys({
  motivo: Joi.string().trim().required()
});

const esquemaRevision = esquemaBorradorId.keys({
  cancelar: Joi.boolean().default(false)
});

const esquemaFinalizar = esquemaBorradorId;

router.use(cargarUsuarioActual);

router.get('/estado', (req, res) => {
  const empresaId = resolverEmpresaId(req);
  const { value, error } = esquemaContexto.validate({ ...req.query, empresaId }, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      mensaje: 'Verifica los parámetros de consulta.',
      detalles: error.details.map((detalle) => detalle.message)
    });
  }
  const empresa = obtenerEmpresaPorId(value.empresaId);
  if (!empresa) {
    return res.status(404).json({ mensaje: 'La empresa indicada no existe.' });
  }
  const modulo = obtenerModuloCanonico(value.modulo);
  if (!modulo) {
    return res.status(400).json({ mensaje: 'El módulo indicado no es válido.' });
  }
  if (!req.esAdmin && !tienePermisoEnModulo(req.mapaPermisos, empresa.id, modulo)) {
    return res.status(403).json({ mensaje: 'No cuentas con permisos en este módulo.' });
  }

  const borrador = obtenerBorrador({
    empresaId: empresa.id,
    modulo,
    anio: value.anio
  });

  return res.json({ borrador });
});

router.post('/guardar', async (req, res) => {
  const empresaId = resolverEmpresaId(req);
  const { value, error } = esquemaGuardar.validate({ ...req.body, empresaId }, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      mensaje: 'Verifica la información proporcionada.',
      detalles: error.details.map((detalle) => detalle.message)
    });
  }
  const empresa = obtenerEmpresaPorId(value.empresaId);
  if (!empresa) {
    return res.status(404).json({ mensaje: 'La empresa indicada no existe.' });
  }
  const modulo = obtenerModuloCanonico(value.modulo);
  if (!modulo) {
    return res.status(400).json({ mensaje: 'El módulo indicado no es válido.' });
  }
  if (!req.esAdmin && !tienePermisoEnModulo(req.mapaPermisos, empresa.id, modulo, 'Cargar y guardar')) {
    return res.status(403).json({ mensaje: 'No cuentas con permisos para guardar este módulo.' });
  }

  try {
    const borrador = guardarBorrador(
      {
        empresaId: empresa.id,
        modulo,
        anio: value.anio,
        usuarioId: req.usuarioActual.id
      },
      value.datos
    );
    return res.json({ mensaje: 'Borrador guardado.', borrador });
  } catch (errorGuardar) {
    console.error('Error al guardar borrador:', errorGuardar);
    return res.status(500).json({ mensaje: 'No fue posible guardar el borrador.' });
  }
});

router.post('/enviar', async (req, res) => {
  const { value, error } = esquemaBorradorId.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      mensaje: 'Verifica el identificador del borrador.',
      detalles: error.details.map((detalle) => detalle.message)
    });
  }

  const borrador = obtenerBorradorPorId(value.borradorId);
  if (!borrador) {
    return res.status(404).json({ mensaje: 'Borrador no encontrado.' });
  }
  const empresa = obtenerEmpresaPorId(borrador.empresaId);
  if (!empresa) {
    return res.status(404).json({ mensaje: 'Empresa asociada al borrador no existe.' });
  }
  if (!req.esAdmin && !tienePermisoEnModulo(req.mapaPermisos, empresa.id, borrador.modulo, 'Revisar')) {
    return res.status(403).json({ mensaje: 'No cuentas con permisos para enviar a revisión.' });
  }

  try {
    const resultado = await enviarRevision(value.borradorId, req.esAdmin ? 'ADMIN_GLOBAL' : 'USUARIO');
    notificarWorkflowPresupuesto({
      empresaId: empresa.id,
      modulo: borrador.modulo,
      anio: borrador.anio,
      accion: resultado.autoAutorizado ? 'autorizar' : 'enviar',
      estado: resultado.borrador?.estado,
      ejecutor: {
        id: req.usuarioActual.id,
        usuario: req.usuarioActual.usuario,
        nombre: `${req.usuarioActual.nombres || ''} ${req.usuarioActual.apellidos || ''}`.trim() || req.usuarioActual.usuario
      }
    }).catch((notifError) => console.warn('No se enviaron todas las notificaciones de borradores.', notifError));
    return res.json({
      mensaje: resultado.autoAutorizado ? 'Borrador autorizado automáticamente.' : 'Borrador enviado a revisión.',
      ...resultado
    });
  } catch (errorEnviar) {
    console.error('Error al enviar borrador:', errorEnviar);
    return res.status(500).json({ mensaje: 'No fue posible enviar el borrador.' });
  }
});

router.post('/autorizar', async (req, res) => {
  const { value, error } = esquemaBorradorId.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      mensaje: 'Verifica el identificador del borrador.',
      detalles: error.details.map((detalle) => detalle.message)
    });
  }

  const borrador = obtenerBorradorPorId(value.borradorId);
  if (!borrador) {
    return res.status(404).json({ mensaje: 'Borrador no encontrado.' });
  }
  const empresa = obtenerEmpresaPorId(borrador.empresaId);
  if (!empresa) {
    return res.status(404).json({ mensaje: 'Empresa asociada al borrador no existe.' });
  }
  if (!req.esAdmin && !tienePermisoEnModulo(req.mapaPermisos, empresa.id, borrador.modulo, 'Aprobar')) {
    return res.status(403).json({ mensaje: 'No cuentas con permisos para autorizar borradores.' });
  }

  try {
    const aprobado = await autorizarBorrador(value.borradorId);
    notificarWorkflowPresupuesto({
      empresaId: empresa.id,
      modulo: borrador.modulo,
      anio: borrador.anio,
      accion: 'autorizar',
      estado: aprobado.estado,
      ejecutor: {
        id: req.usuarioActual.id,
        usuario: req.usuarioActual.usuario,
        nombre: `${req.usuarioActual.nombres || ''} ${req.usuarioActual.apellidos || ''}`.trim() || req.usuarioActual.usuario
      }
    }).catch((notifError) => console.warn('No se enviaron todas las notificaciones de borradores.', notifError));
    return res.json({ mensaje: 'Borrador autorizado.', borrador: aprobado });
  } catch (errorAutorizar) {
    console.error('Error al autorizar borrador:', errorAutorizar);
    return res.status(500).json({ mensaje: 'No fue posible autorizar el borrador.' });
  }
});

router.post('/rechazar', (req, res) => {
  const { value, error } = esquemaRechazo.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      mensaje: 'Verifica los datos proporcionados.',
      detalles: error.details.map((detalle) => detalle.message)
    });
  }

  const borrador = obtenerBorradorPorId(value.borradorId);
  if (!borrador) {
    return res.status(404).json({ mensaje: 'Borrador no encontrado.' });
  }
  const empresa = obtenerEmpresaPorId(borrador.empresaId);
  if (!empresa) {
    return res.status(404).json({ mensaje: 'Empresa asociada al borrador no existe.' });
  }
  if (!req.esAdmin && !tienePermisoEnModulo(req.mapaPermisos, empresa.id, borrador.modulo, 'Aprobar')) {
    return res.status(403).json({ mensaje: 'No cuentas con permisos para rechazar borradores.' });
  }

  try {
    const rechazado = rechazarBorrador(value.borradorId, value.motivo);
    notificarWorkflowPresupuesto({
      empresaId: empresa.id,
      modulo: borrador.modulo,
      anio: borrador.anio,
      accion: 'rechazar',
      estado: rechazado.estado,
      ejecutor: {
        id: req.usuarioActual.id,
        usuario: req.usuarioActual.usuario,
        nombre: `${req.usuarioActual.nombres || ''} ${req.usuarioActual.apellidos || ''}`.trim() || req.usuarioActual.usuario
      }
    }).catch((notifError) => console.warn('No se enviaron todas las notificaciones de borradores.', notifError));
    return res.json({ mensaje: 'Borrador rechazado.', borrador: rechazado });
  } catch (errorRechazar) {
    console.error('Error al rechazar borrador:', errorRechazar);
    return res.status(500).json({ mensaje: 'No fue posible rechazar el borrador.' });
  }
});

router.post('/revisar', (req, res) => {
  const { value, error } = esquemaRevision.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      mensaje: 'Verifica los datos proporcionados.',
      detalles: error.details.map((detalle) => detalle.message)
    });
  }

  const borrador = obtenerBorradorPorId(value.borradorId);
  if (!borrador) {
    return res.status(404).json({ mensaje: 'Borrador no encontrado.' });
  }
  const empresa = obtenerEmpresaPorId(borrador.empresaId);
  if (!empresa) {
    return res.status(404).json({ mensaje: 'Empresa asociada al borrador no existe.' });
  }
  if (!req.esAdmin && !tienePermisoEnModulo(req.mapaPermisos, empresa.id, borrador.modulo, 'Revisar')) {
    return res.status(403).json({ mensaje: 'No cuentas con permisos para revisar borradores.' });
  }

  try {
    const resultado = marcarRevisado(value.borradorId, value.cancelar);
    notificarWorkflowPresupuesto({
      empresaId: empresa.id,
      modulo: borrador.modulo,
      anio: borrador.anio,
      accion: value.cancelar ? 'revisar-cancelar' : 'revisar',
      estado: resultado.estado,
      ejecutor: {
        id: req.usuarioActual.id,
        usuario: req.usuarioActual.usuario,
        nombre: `${req.usuarioActual.nombres || ''} ${req.usuarioActual.apellidos || ''}`.trim() || req.usuarioActual.usuario
      }
    }).catch((notifError) => console.warn('No se enviaron todas las notificaciones de borradores.', notifError));
    const mensaje = value.cancelar ? 'Revisión cancelada y devuelta a edición.' : 'Borrador marcado como revisado.';
    return res.json({ mensaje, borrador: resultado });
  } catch (errorRevision) {
    console.error('Error al marcar revisión:', errorRevision);
    return res.status(500).json({ mensaje: 'No fue posible actualizar la revisión.' });
  }
});

router.post('/finalizar', async (req, res) => {
  const { value, error } = esquemaFinalizar.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      mensaje: 'Verifica los datos proporcionados.',
      detalles: error.details.map((detalle) => detalle.message)
    });
  }

  const borrador = obtenerBorradorPorId(value.borradorId);
  if (!borrador) {
    return res.status(404).json({ mensaje: 'Borrador no encontrado.' });
  }
  const empresa = obtenerEmpresaPorId(borrador.empresaId);
  if (!empresa) {
    return res.status(404).json({ mensaje: 'Empresa asociada al borrador no existe.' });
  }
  if (!req.esAdmin && !tienePermisoEnModulo(req.mapaPermisos, empresa.id, borrador.modulo, 'Cargar y guardar')) {
    return res.status(403).json({ mensaje: 'No cuentas con permisos para guardar en base de datos.' });
  }
  if (borrador.estado !== ESTADOS.APROBADO) {
    return res.status(409).json({ mensaje: 'El borrador debe estar autorizado para guardar en base de datos.' });
  }

  try {
    const guardado = await guardarAutorizado(value.borradorId);
    const ejecutor = {
      id: req.usuarioActual.id,
      usuario: req.usuarioActual.usuario,
      nombre: `${req.usuarioActual.nombres || ''} ${req.usuarioActual.apellidos || ''}`.trim() || req.usuarioActual.usuario
    };
    notificarWorkflowPresupuesto({
      empresaId: empresa.id,
      modulo: borrador.modulo,
      anio: borrador.anio,
      accion: 'guardar',
      estado: guardado.estado,
      ejecutor
    }).catch((notifError) => console.warn('No se enviaron todas las notificaciones de borradores.', notifError));
    return res.json({
      mensaje: `Presupuesto marcado como guardado por ${ejecutor.nombre} en el flujo de borradores (${borrador.modulo}).`,
      ejecutor,
      borrador: guardado
    });
  } catch (errorFinal) {
    console.error('Error al guardar borrador autorizado:', errorFinal);
    return res.status(500).json({ mensaje: 'No fue posible guardar en la base de datos.' });
  }
});

module.exports = router;
