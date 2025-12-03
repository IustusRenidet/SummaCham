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
  listarBorradores,
  obtenerHistorial,
  eliminarBorrador,
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

const normalizarEstados = (valor) => {
  if (!valor) return [];
  if (Array.isArray(valor)) {
    return valor.map((item) => item.toString().trim().toUpperCase()).filter(Boolean);
  }
  return valor
    .toString()
    .split(',')
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
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

const esquemaListado = Joi.object({
  empresaId: Joi.string().trim(),
  anio: Joi.number().integer().min(2000).max(2100),
  estado: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())),
  modulo: Joi.string().trim(),
  busca: Joi.string().allow('')
});

const esquemaId = Joi.object({
  id: Joi.number().integer().required()
});

router.use(cargarUsuarioActual);

router.get('/', (req, res) => {
  const { value, error } = esquemaListado.validate(req.query || {}, { abortEarly: false });
  if (error) {
    return res.status(400).json({ mensaje: 'Verifica los filtros proporcionados.', detalles: error.details });
  }

  const moduloCanonico = value.modulo ? obtenerModuloCanonico(value.modulo) : null;
  if (value.modulo && !moduloCanonico) {
    return res.status(400).json({ mensaje: 'El módulo indicado no es válido.' });
  }

  const filtros = {
    empresaId: value.empresaId || null,
    anio: value.anio || null,
    estados: normalizarEstados(value.estado),
    modulo: moduloCanonico,
    busqueda: value.busca ? value.busca.toString().trim() : null
  };

  try {
    const borradores = listarBorradores(filtros).filter((borrador) => {
      if (req.esAdmin) return true;
      return tienePermisoEnModulo(req.mapaPermisos, borrador.empresaId, borrador.modulo);
    });

    const resumen = borradores.reduce(
      (acc, borrador) => {
        acc.total += 1;
        const estado = borrador.estado || 'SIN_ESTADO';
        acc.porEstado[estado] = (acc.porEstado[estado] || 0) + 1;
        return acc;
      },
      { total: 0, porEstado: {} }
    );

    return res.json({ borradores, resumen });
  } catch (listError) {
    console.error('Error al listar borradores:', listError);
    return res.status(500).json({ mensaje: 'No fue posible obtener los borradores.' });
  }
});

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
    const resultado = await enviarRevision(value.borradorId, {
      rol: req.esAdmin ? 'ADMIN_GLOBAL' : 'USUARIO',
      usuarioId: req.usuarioActual.id
    });
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
    const aprobado = await autorizarBorrador(value.borradorId, { usuarioId: req.usuarioActual.id });
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
    const rechazado = rechazarBorrador(value.borradorId, value.motivo, { usuarioId: req.usuarioActual.id });
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
    const resultado = marcarRevisado(value.borradorId, value.cancelar, { usuarioId: req.usuarioActual.id });
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
    const guardado = await guardarAutorizado(value.borradorId, { usuarioId: req.usuarioActual.id });
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

router.get('/:id/historial', (req, res) => {
  const { value, error } = esquemaId.validate(req.params, { abortEarly: false });
  if (error) {
    return res.status(400).json({ mensaje: 'Identificador de borrador inválido.' });
  }

  const borrador = obtenerBorradorPorId(value.id);
  if (!borrador) {
    return res.status(404).json({ mensaje: 'Borrador no encontrado.' });
  }

  if (!req.esAdmin && !tienePermisoEnModulo(req.mapaPermisos, borrador.empresaId, borrador.modulo)) {
    return res.status(403).json({ mensaje: 'No cuentas con permisos para ver este borrador.' });
  }

  try {
    const historial = obtenerHistorial(value.id);
    return res.json({ historial });
  } catch (histError) {
    console.error('Error al consultar historial de borrador:', histError);
    return res.status(500).json({ mensaje: 'No fue posible obtener el historial.' });
  }
});

router.get('/:id', (req, res) => {
  const { value, error } = esquemaId.validate(req.params, { abortEarly: false });
  if (error) {
    return res.status(400).json({ mensaje: 'Identificador de borrador inválido.' });
  }

  const borrador = obtenerBorradorPorId(value.id);
  if (!borrador) {
    return res.status(404).json({ mensaje: 'Borrador no encontrado.' });
  }

  if (!req.esAdmin && !tienePermisoEnModulo(req.mapaPermisos, borrador.empresaId, borrador.modulo)) {
    return res.status(403).json({ mensaje: 'No cuentas con permisos para ver este borrador.' });
  }

  try {
    const historial = obtenerHistorial(value.id);
    return res.json({ borrador, historial });
  } catch (detailError) {
    console.error('Error al consultar detalle de borrador:', detailError);
    return res.status(500).json({ mensaje: 'No fue posible obtener el borrador.' });
  }
});

router.delete('/:id', (req, res) => {
  const { value, error } = esquemaId.validate(req.params, { abortEarly: false });
  if (error) {
    return res.status(400).json({ mensaje: 'Identificador de borrador inválido.' });
  }

  const borrador = obtenerBorradorPorId(value.id);
  if (!borrador) {
    return res.status(404).json({ mensaje: 'Borrador no encontrado.' });
  }

  const esPropio = String(borrador.usuarioId || '') === String(req.usuarioActual.id || '');
  if (!req.esAdmin && !esPropio) {
    return res.status(403).json({ mensaje: 'Solo el creador o un administrador pueden eliminar este borrador.' });
  }

  try {
    eliminarBorrador(value.id);
    return res.json({ mensaje: 'Borrador eliminado.' });
  } catch (deleteError) {
    console.error('Error al eliminar borrador:', deleteError);
    return res.status(500).json({ mensaje: 'No fue posible eliminar el borrador.' });
  }
});

module.exports = router;
