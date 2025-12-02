const { db, registrarPresupuestoGuardado } = require('../db/sqlite');

const mapData = (texto) => {
  if (!texto) return null;
  try {
    return JSON.parse(texto);
  } catch (error) {
    return texto;
  }
};

const normalizarContexto = (contexto) => {
  if (!contexto) {
    throw new Error('Contexto del borrador no proporcionado.');
  }
  const empresaId = (contexto.empresaId || '').toString().trim();
  const modulo = (contexto.modulo || '').toString().trim();
  const anio = Number(contexto.anio);
  const usuarioId = (contexto.usuarioId || '').toString().trim();
  if (!empresaId || !modulo || !Number.isInteger(anio) || !usuarioId) {
    throw new Error('Contexto incompleto para el borrador.');
  }
  return {
    empresaId,
    modulo,
    anio,
    usuarioId,
    comentarios: contexto.comentarios ? contexto.comentarios.toString().trim() : null
  };
};

const mapearFila = (fila) => {
  if (!fila) {
    return null;
  }
  return {
    id: fila.id,
    empresaId: fila.empresaId,
    modulo: fila.modulo,
    anio: fila.anio,
    usuarioId: fila.usuarioId,
    data: mapData(fila.data),
    estado: fila.estado,
    fechaCreacion: fila.fechaCreacion,
    fechaEnvio: fila.fechaEnvio,
    comentarios: fila.comentarios
  };
};

const obtenerBorradorPorId = (id) => {
  if (!id) {
    return null;
  }
  const fila = db.prepare(`
    SELECT *
    FROM PLAN_BORRADORES
    WHERE id = ?
  `).get(id);
  return mapearFila(fila);
};

const persistirEnFirebird = async (borrador) => {
  registrarPresupuestoGuardado({
    empresaId: borrador.empresaId,
    modulo: borrador.modulo,
    anio: borrador.anio,
    datos: borrador.data,
    guardadoPor: Number(borrador.usuarioId) || null
  });
};

const FINALIZADORES = {
  PRESUPUESTOS: persistirEnFirebird
};

const obtenerFinalizador = (modulo) => {
  const clave = (modulo || '').toString().trim().toUpperCase();
  return FINALIZADORES[clave] || persistirEnFirebird;
};

const obtenerBorrador = ({ empresaId, modulo, anio }) => {
  const fila = db.prepare(`
    SELECT *
    FROM PLAN_BORRADORES
    WHERE empresaId = ? AND modulo = ? AND anio = ? AND estado IN ('EDITANDO', 'PENDIENTE')
    ORDER BY id DESC
    LIMIT 1
  `).get(empresaId, modulo, anio);
  return mapearFila(fila);
};

const guardarBorrador = (contexto, datos) => {
  const cfg = normalizarContexto(contexto);
  const contenido = typeof datos === 'string' ? datos : JSON.stringify(datos || {});
  const existente = db.prepare(`
    SELECT id
    FROM PLAN_BORRADORES
    WHERE empresaId = ? AND modulo = ? AND anio = ?
  `).get(cfg.empresaId, cfg.modulo, cfg.anio);

  if (existente) {
    db.prepare(`
      UPDATE PLAN_BORRADORES
      SET data = ?, estado = 'EDITANDO', fechaEnvio = NULL, comentarios = NULL, usuarioId = ?
      WHERE id = ?
    `).run(contenido, cfg.usuarioId, existente.id);
    return obtenerBorradorPorId(existente.id);
  }

  const resultado = db.prepare(`
    INSERT INTO PLAN_BORRADORES (empresaId, anio, modulo, usuarioId, data, estado, comentarios)
    VALUES (?, ?, ?, ?, ?, 'EDITANDO', ?)
  `).run(cfg.empresaId, cfg.anio, cfg.modulo, cfg.usuarioId, contenido, cfg.comentarios);

  return obtenerBorradorPorId(resultado.lastInsertRowid);
};

const enviarRevision = async (borradorId, usuarioRol) => {
  const borrador = obtenerBorradorPorId(borradorId);
  if (!borrador) {
    throw new Error('Borrador no encontrado.');
  }

  if (usuarioRol === 'ADMIN_GLOBAL') {
    const autorizado = await autorizarBorrador(borradorId);
    return { autoAutorizado: true, borrador: autorizado };
  }

  db.prepare(`
    UPDATE PLAN_BORRADORES
    SET estado = 'PENDIENTE', fechaEnvio = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(borradorId);

  return { autoAutorizado: false, borrador: obtenerBorradorPorId(borradorId) };
};

const autorizarBorrador = async (borradorId) => {
  const borrador = obtenerBorradorPorId(borradorId);
  if (!borrador) {
    throw new Error('Borrador no encontrado.');
  }

  const finalizador = obtenerFinalizador(borrador.modulo);
  if (finalizador) {
    await finalizador(borrador);
  }

  db.prepare(`
    UPDATE PLAN_BORRADORES
    SET estado = 'APROBADO', fechaEnvio = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(borradorId);

  return obtenerBorradorPorId(borradorId);
};

const rechazarBorrador = (borradorId, motivo) => {
  const borrador = obtenerBorradorPorId(borradorId);
  if (!borrador) {
    throw new Error('Borrador no encontrado.');
  }

  db.prepare(`
    UPDATE PLAN_BORRADORES
    SET estado = 'RECHAZADO', comentarios = ?, fechaEnvio = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(motivo || null, borradorId);

  return obtenerBorradorPorId(borradorId);
};

module.exports = {
  guardarBorrador,
  obtenerBorrador,
  enviarRevision,
  autorizarBorrador,
  rechazarBorrador,
  obtenerBorradorPorId
};
