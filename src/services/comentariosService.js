const { db } = require('../db/sqlite');
const { registrarNotificacionesMasivas } = require('./notificacionesService');
const { obtenerEmpresaPorId } = require('../config/empresas');
const { normalizarNombreModulo } = require('../config/modulos');

const ESTADOS_VALIDOS = new Set(['activo', 'descartado', 'rechazado']);
const ESTADOS_ALIAS = {
  cerrar: 'descartado',
  cerrado: 'descartado',
  cerrada: 'descartado',
  resuelto: 'descartado',
  resuelta: 'descartado'
};

const normalizarEstado = (valor) => {
  const limpio = (valor || '').toString().trim().toLowerCase();
  const estado = ESTADOS_ALIAS[limpio] || limpio;
  return ESTADOS_VALIDOS.has(estado) ? estado : 'activo';
};

const normalizarClaveModulo = (valor) => (valor || '')
  .toString()
  .trim()
  .toUpperCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^A-Z0-9]+/g, '');

const moduloCoincide = (a, b) => {
  const canonA = normalizarNombreModulo(a) || a;
  const canonB = normalizarNombreModulo(b) || b;
  if (!canonA || !canonB) return false;
  if (canonA === canonB) return true;
  return normalizarClaveModulo(canonA) === normalizarClaveModulo(canonB);
};

const obtenerUsuariosConAccesoModulo = (empresaId, modulo, excluirId) => {
  const consulta = db.prepare(`
    SELECT DISTINCT u.id, u.usuario, u.nombres, u.apellido_primero, u.apellido_segundo, pm.modulo
    FROM permisos_modulo pm
    INNER JOIN usuarios u ON u.id = pm.usuario_id
    WHERE pm.empresa_id = ?
      AND (pm.puede_leer = 1 OR pm.puede_cargar_guardar = 1 OR pm.puede_revisar = 1 OR pm.puede_aprobar = 1)
      AND u.id != COALESCE(?, -1)
  `);
  const filas = consulta.all(empresaId, excluirId || -1);
  const filtradas = filas.filter((row) => moduloCoincide(row.modulo, modulo));
  const mapa = new Map();
  filtradas.forEach((row) => {
    if (!mapa.has(row.id)) {
      mapa.set(row.id, {
        id: row.id,
        usuario: row.usuario,
        nombres: row.nombres,
        apellido_primero: row.apellido_primero,
        apellido_segundo: row.apellido_segundo
      });
    }
  });
  return Array.from(mapa.values());
};

const mapAutor = (row) => ({
  id: row.creado_por,
  usuario: row.usuario,
  nombres: row.nombres,
  apellidoPrimero: row.apellido_primero,
  apellidoSegundo: row.apellido_segundo
});

const construirEnlaceComentario = (comentario) => {
  if (!comentario?.modulo || !comentario?.celdaId) {
    return '';
  }
  const params = new URLSearchParams({
    destino: 'comentario',
    modulo: comentario.modulo,
    celdaId: comentario.celdaId
  });
  if (comentario.empresaId) {
    params.set('empresaId', comentario.empresaId);
  }
  if (Number.isInteger(comentario.anio)) {
    params.set('anio', comentario.anio);
  }
  if (comentario.capitulo) {
    params.set('capitulo', comentario.capitulo);
  }
  return `app.html?${params.toString()}`;
};

const resumirComentariosPorModulo = ({ empresaId, modulo, anio, capitulo, incluirNoActivos = false }) => {
  const condiciones = ['c.modulo = ?'];
  const params = [modulo];
  if (!incluirNoActivos) {
    condiciones.push("c.estado = 'activo'");
  }
  if (empresaId) {
    condiciones.push('(c.empresa_id IS NULL OR c.empresa_id = ?)');
    params.push(empresaId);
  }
  if (Number.isInteger(anio)) {
    condiciones.push('(c.anio IS NULL OR c.anio = ?)');
    params.push(anio);
  }
  if (capitulo) {
    condiciones.push('(c.capitulo IS NULL OR c.capitulo = ?)');
    params.push(capitulo);
  }
  const query = db.prepare(`
    SELECT c.id, c.empresa_id AS empresaId, c.modulo, c.celda_id AS celdaId,
           c.anio, c.capitulo, c.texto, c.parent_id AS parentId,
           c.estado, c.creado_por, c.creado_en,
           u.usuario, u.nombres, u.apellido_primero, u.apellido_segundo
    FROM comentarios_celdas c
    INNER JOIN usuarios u ON u.id = c.creado_por
    WHERE ${condiciones.join(' AND ')}
    ORDER BY c.celda_id ASC, c.creado_en ASC, c.id ASC
  `);
  const lista = query.all(...params);
  const mapa = new Map();
  lista.forEach((row) => {
    const existente = mapa.get(row.celdaId) || {
      celdaId: row.celdaId,
      empresaId: row.empresaId,
      modulo: row.modulo,
      anio: row.anio,
      capitulo: row.capitulo,
      totalComentarios: 0,
      totalActivos: 0,
      comentarios: [],
      ultimo: null
    };
    const comentario = {
      id: row.id,
      texto: row.texto,
      estado: row.estado,
      creadoEn: row.creado_en,
      parentId: row.parentId,
      autor: mapAutor(row)
    };
    existente.totalComentarios += 1;
    if (row.estado === 'activo') {
      existente.totalActivos += 1;
    }
    existente.comentarios.push(comentario);
    existente.ultimo = comentario;
    mapa.set(row.celdaId, existente);
  });
  return Array.from(mapa.values());
};

const listarComentarios = ({ empresaId, modulo, celdaId, anio, capitulo, incluirNoActivos = false }) => {
  const condiciones = ['c.modulo = ?', 'c.celda_id = ?'];
  const params = [modulo, celdaId];
  if (!incluirNoActivos) {
    condiciones.push("c.estado = 'activo'");
  }
  if (empresaId) {
    condiciones.push('(c.empresa_id IS NULL OR c.empresa_id = ?)');
    params.push(empresaId);
  }
  if (Number.isInteger(anio)) {
    condiciones.push('(c.anio IS NULL OR c.anio = ?)');
    params.push(anio);
  }
  if (capitulo) {
    condiciones.push('(c.capitulo IS NULL OR c.capitulo = ?)');
    params.push(capitulo);
  }

  const query = db.prepare(`
    SELECT c.id, c.empresa_id AS empresaId, c.modulo, c.celda_id AS celdaId,
           c.anio, c.capitulo, c.texto, c.parent_id AS parentId,
           c.estado, c.creado_por, c.creado_en,
           u.usuario, u.nombres, u.apellido_primero, u.apellido_segundo
    FROM comentarios_celdas c
    INNER JOIN usuarios u ON u.id = c.creado_por
    WHERE ${condiciones.join(' AND ')}
    ORDER BY c.creado_en ASC, c.id ASC
  `);
  return query.all(...params).map((row) => ({
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

  const accionMeta = {
    nuevo: { titulo: 'Nuevo comentario', verbo: 'agregó', tipo: 'info' },
    activo: { titulo: 'Comentario reabierto', verbo: 'reabrió', tipo: 'info' },
    descartado: { titulo: 'Comentario cerrado', verbo: 'cerró', tipo: 'warning' },
    rechazado: { titulo: 'Comentario rechazado', verbo: 'rechazó', tipo: 'danger' }
  }[accion] || { titulo: `Comentario ${accion}`, verbo: 'actualizó', tipo: 'info' };
  const tituloBase = `${accionMeta.titulo} en ${comentario.modulo}`;
  const mensaje = `${actor?.usuario || 'Un colaborador'} ${accionMeta.verbo} un comentario (celda ${comentario.celdaId}) para ${empresa?.etiqueta || empresa?.nombre || comentario.empresaId || 'empresa'}.`;

  return registrarNotificacionesMasivas(destino, {
    empresaId: comentario.empresaId || null,
    modulo: comentario.modulo,
    titulo: tituloBase,
    mensaje,
    tipo: accionMeta.tipo,
    enlace: construirEnlaceComentario(comentario)
  });
};

module.exports = {
  listarComentarios,
  crearComentario,
  actualizarEstadoComentario,
  obtenerComentario,
  resumirComentariosPorModulo
};
