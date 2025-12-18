const { db } = require('../db/sqlite');
const { registrarNotificacionesMasivas } = require('./notificacionesService');
const { obtenerEmpresaPorId } = require('../config/empresas');

const ESTADOS_VALIDOS = ['activo', 'descartado', 'rechazado'];

const normalizarEstado = (valor) => {
  const limpio = (valor || '').toString().trim().toLowerCase();
  return ESTADOS_VALIDOS.includes(limpio) ? limpio : 'activo';
};

const obtenerUsuariosConAccesoModulo = (empresaId, modulo, excluirId) => {
  const consulta = db.prepare(`
    SELECT DISTINCT u.id, u.usuario, u.nombres, u.apellido_primero, u.apellido_segundo
    FROM permisos_modulo pm
    INNER JOIN usuarios u ON u.id = pm.usuario_id
    WHERE pm.empresa_id = ?
      AND pm.modulo = ?
      AND (pm.puede_leer = 1 OR pm.puede_cargar_guardar = 1 OR pm.puede_revisar = 1 OR pm.puede_aprobar = 1)
      AND u.id != COALESCE(?, -1)
  `);
  return consulta.all(empresaId, modulo, excluirId || -1);
};

const mapAutor = (row) => ({
  id: row.creado_por,
  usuario: row.usuario,
  nombres: row.nombres,
  apellidoPrimero: row.apellido_primero,
  apellidoSegundo: row.apellido_segundo
});

const listarComentarios = ({ empresaId, modulo, celdaId, anio }) => {
  const query = db.prepare(`
    SELECT c.id, c.empresa_id AS empresaId, c.modulo, c.celda_id AS celdaId,
           c.anio, c.capitulo, c.texto, c.parent_id AS parentId,
           c.estado, c.creado_por, c.creado_en,
           u.usuario, u.nombres, u.apellido_primero, u.apellido_segundo
    FROM comentarios_celdas c
    INNER JOIN usuarios u ON u.id = c.creado_por
    WHERE c.modulo = ?
      AND c.celda_id = ?
      AND (c.empresa_id IS NULL OR c.empresa_id = ?)
      AND (c.anio IS NULL OR c.anio = ?)
    ORDER BY c.creado_en ASC, c.id ASC
  `);
  return query.all(modulo, celdaId, empresaId || null, anio || null).map((row) => ({
    id: row.id,
    empresaId: row.empresaId,
    modulo: row.modulo,
    celdaId: row.celdaId,
    anio: row.anio,
    capitulo: row.capitulo,
    texto: row.texto,
    parentId: row.parentId,
    estado: row.estado,
    creadoEn: row.creado_en,
    autor: mapAutor(row)
  }));
};

const obtenerComentario = (id) => {
  const stmt = db.prepare(`
    SELECT c.*, u.usuario, u.nombres, u.apellido_primero, u.apellido_segundo
    FROM comentarios_celdas c
    INNER JOIN usuarios u ON u.id = c.creado_por
    WHERE c.id = ?
  `);
  const row = stmt.get(id);
  if (!row) return null;
  return {
    id: row.id,
    empresaId: row.empresa_id,
    modulo: row.modulo,
    celdaId: row.celda_id,
    anio: row.anio,
    capitulo: row.capitulo,
    texto: row.texto,
    parentId: row.parent_id,
    estado: row.estado,
    creadoEn: row.creado_en,
    autor: mapAutor(row)
  };
};

const crearComentario = ({ empresaId, modulo, celdaId, anio, capitulo, texto, parentId, usuario }) => {
  const estado = 'activo';
  const insert = db.prepare(`
    INSERT INTO comentarios_celdas (empresa_id, modulo, celda_id, anio, capitulo, texto, parent_id, estado, creado_por)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const resultado = insert.run(
    empresaId || null,
    modulo,
    celdaId,
    anio || null,
    capitulo || null,
    texto,
    parentId || null,
    estado,
    usuario.id
  );
  const creado = obtenerComentario(resultado.lastInsertRowid);
  if (creado) {
    notificarCambioComentario(creado, usuario, 'nuevo');
  }
  return creado;
};

const actualizarEstadoComentario = ({ comentarioId, estado, usuario }) => {
  const nuevoEstado = normalizarEstado(estado);
  const update = db.prepare(`
    UPDATE comentarios_celdas
    SET estado = ?
    WHERE id = ?
  `);
  const resultado = update.run(nuevoEstado, comentarioId);
  if (resultado.changes === 0) {
    return null;
  }
  const actualizado = obtenerComentario(comentarioId);
  if (actualizado) {
    notificarCambioComentario(actualizado, usuario, nuevoEstado);
  }
  return actualizado;
};

const notificarCambioComentario = (comentario, actor, accion) => {
  const empresa = obtenerEmpresaPorId(comentario.empresaId);
  const destino = obtenerUsuariosConAccesoModulo(comentario.empresaId, comentario.modulo, actor?.id);
  if (!destino || destino.length === 0) return [];

  const tituloBase = accion === 'nuevo'
    ? `Nuevo comentario en ${comentario.modulo}`
    : `Comentario ${accion} en ${comentario.modulo}`;
  const mensaje = `${actor?.usuario || 'Un colaborador'} ${accion === 'nuevo' ? 'agregó' : 'marcó'} un comentario (celda ${comentario.celdaId}) para ${empresa?.etiqueta || empresa?.nombre || comentario.empresaId || 'empresa'}.`;

  return registrarNotificacionesMasivas(destino, {
    empresaId: comentario.empresaId || null,
    modulo: comentario.modulo,
    titulo: tituloBase,
    mensaje,
    tipo: accion === 'rechazado' ? 'danger' : accion === 'descartado' ? 'warning' : 'info',
    enlace: ''
  });
};

module.exports = {
  listarComentarios,
  crearComentario,
  actualizarEstadoComentario,
  obtenerComentario
};
