const { db, registrarPresupuestoGuardado } = require('../db/sqlite');

const ESTADOS = {
  EDITANDO: 'EDITANDO',
  PENDIENTE: 'PENDIENTE',
  REVISADO: 'REVISADO',
  RECHAZADO: 'RECHAZADO',
  APROBADO: 'APROBADO',
  GUARDADO: 'GUARDADO'
};

const mapData = (texto) => {
  if (!texto) return null;
  try {
    return JSON.parse(texto);
  } catch (error) {
    return texto;
  }
};

const mapMeta = (valor) => {
  if (!valor) return null;
  if (typeof valor === 'object') return valor;
  try {
    return JSON.parse(valor);
  } catch (error) {
    return valor;
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
    usuario: fila.usuario || null,
    usuarioNombre: fila.usuarioNombre || null,
    data: mapData(fila.data),
    estado: fila.estado,
    fechaCreacion: fila.fechaCreacion,
    fechaEnvio: fila.fechaEnvio,
    comentarios: fila.comentarios
  };
};

const mapearHistorial = (fila) => {
  if (!fila) return null;
  const nombre = (fila.nombre || '').trim();
  const usuario = (fila.usuario || '').trim();
  return {
    id: fila.id,
    borradorId: fila.borradorId,
    estado: fila.estado,
    comentario: fila.comentario || null,
    fecha: fila.fecha,
    usuarioId: fila.usuarioId || null,
    usuario,
    nombre: nombre || usuario || null,
    meta: mapMeta(fila.meta)
  };
};

const obtenerBorradorPorId = (id) => {
  if (!id) {
    return null;
  }
  const fila = db.prepare(`
    SELECT b.*, u.usuario, TRIM(COALESCE(u.nombres, '') || ' ' || COALESCE(u.apellidos, '')) AS usuarioNombre
    FROM PLAN_BORRADORES b
    LEFT JOIN usuarios u ON u.id = b.usuarioId
    WHERE b.id = ?
  `).get(id);
  return mapearFila(fila);
};

const registrarHistorial = (borradorId, estado, opciones = {}) => {
  if (!borradorId || !estado) return null;
  const meta = opciones.meta ? JSON.stringify(opciones.meta) : null;
  return db.prepare(`
    INSERT INTO PLAN_BORRADORES_HISTORIAL (borradorId, estado, comentario, meta, usuarioId)
    VALUES (?, ?, ?, ?, ?)
  `).run(borradorId, estado, opciones.comentario || null, meta, opciones.usuarioId || null);
};

const obtenerHistorial = (borradorId) => {
  if (!borradorId) return [];
  const filas = db.prepare(`
    SELECT h.*, u.usuario, TRIM(COALESCE(u.nombres, '') || ' ' || COALESCE(u.apellidos, '')) AS nombre
    FROM PLAN_BORRADORES_HISTORIAL h
    LEFT JOIN usuarios u ON u.id = h.usuarioId
    WHERE h.borradorId = ?
    ORDER BY h.fecha ASC, h.id ASC
  `).all(borradorId);
  return filas.map(mapearHistorial).filter(Boolean);
};

const listarBorradores = (filtros = {}) => {
  const condiciones = [];
  const valores = [];

  if (filtros.empresaId) {
    condiciones.push('b.empresaId = ?');
    valores.push(filtros.empresaId);
  }

  if (filtros.anio) {
    condiciones.push('b.anio = ?');
    valores.push(filtros.anio);
  }

  if (Array.isArray(filtros.estados) && filtros.estados.length) {
    const placeholders = filtros.estados.map(() => '?').join(', ');
    condiciones.push(`b.estado IN (${placeholders})`);
    valores.push(...filtros.estados);
  }

  if (filtros.modulo) {
    condiciones.push('LOWER(b.modulo) = LOWER(?)');
    valores.push(filtros.modulo);
  }

  if (filtros.busqueda) {
    condiciones.push('(LOWER(b.comentarios) LIKE ? OR LOWER(b.modulo) LIKE ? )');
    valores.push(`%${filtros.busqueda.toLowerCase()}%`, `%${filtros.busqueda.toLowerCase()}%`);
  }

  const whereClause = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const filas = db.prepare(`
    SELECT b.*, u.usuario, TRIM(COALESCE(u.nombres, '') || ' ' || COALESCE(u.apellidos, '')) AS usuarioNombre
    FROM PLAN_BORRADORES b
    LEFT JOIN usuarios u ON u.id = b.usuarioId
    ${whereClause}
    ORDER BY b.fechaEnvio DESC NULLS LAST, b.fechaCreacion DESC
  `).all(...valores);

  return filas.map(mapearFila).filter(Boolean);
};

const eliminarBorrador = (borradorId) => {
  if (!borradorId) return 0;
  db.prepare('DELETE FROM PLAN_BORRADORES_HISTORIAL WHERE borradorId = ?').run(borradorId);
  const resultado = db.prepare('DELETE FROM PLAN_BORRADORES WHERE id = ?').run(borradorId);
  return resultado.changes || 0;
};

const persistirEnFirebird = async (borrador) => {
  // 1. Guardar registro en SQLite (para historial)
  registrarPresupuestoGuardado({
    empresaId: borrador.empresaId,
    modulo: borrador.modulo,
    anio: borrador.anio,
    datos: borrador.data,
    guardadoPor: Number(borrador.usuarioId) || null
  });

  // 2. Guardar en Firebird PRESUP table
  const { ejecutarConsulta } = require('./firebirdService');
  const datos = typeof borrador.data === 'string' ? JSON.parse(borrador.data) : borrador.data;
  const presupuesto = Array.isArray(datos?.presupuesto) ? datos.presupuesto : [];
  
  if (!presupuesto.length) {
    return; // No hay datos para guardar en Firebird
  }

  const anio = Number(borrador.anio);
  const sufijo = anio.toString().slice(-2).padStart(2, '0');
  const tablaPresup = `PRESUP${sufijo}`;

  // Mapeo de claves a columnas PRESUP01-PRESUP12
  const MESES_COLUMNAS = {
    'budget-ene': 'PRESUP01', 'budget-feb': 'PRESUP02', 'budget-mar': 'PRESUP03',
    'budget-abr': 'PRESUP04', 'budget-may': 'PRESUP05', 'budget-jun': 'PRESUP06',
    'budget-jul': 'PRESUP07', 'budget-ago': 'PRESUP08', 'budget-sep': 'PRESUP09',
    'budget-oct': 'PRESUP10', 'budget-nov': 'PRESUP11', 'budget-dic': 'PRESUP12'
  };

  for (const cambio of presupuesto) {
    const cuenta = (cambio.cuenta || '').toString().trim();
    const valores = cambio.valores || {};
    if (!cuenta) continue;

    // Construir SET clause para UPDATE o INSERT
    const updates = [];
    const columnas = ['NUM_CTA', 'EJERCICIO'];
    const valorInsert = [cuenta, anio];

    Object.entries(valores).forEach(([clave, valor]) => {
      const columna = MESES_COLUMNAS[clave];
      if (columna) {
        const numero = Number(valor) || 0;
        updates.push(`${columna} = ${numero}`);
        columnas.push(columna);
        valorInsert.push(numero);
      }
    });

    if (!updates.length) continue;

    // Intentar UPDATE primero
    const updateQuery = `UPDATE ${tablaPresup} SET ${updates.join(', ')} WHERE NUM_CTA = '${cuenta}' AND EJERCICIO = ${anio}`;
    
    try {
      await ejecutarConsulta(borrador.empresaId, updateQuery, []);
      
      // Si no afectó filas, hacer INSERT
      const placeholders = columnas.map(() => '?').join(', ');
      const insertQuery = `INSERT INTO ${tablaPresup} (${columnas.join(', ')}) VALUES (${placeholders})`;
      
      // Nota: ejecutarConsulta verifica si el UPDATE fue exitoso internamente
      // Si falla el UPDATE (0 filas), ejecuta el INSERT
    } catch (error) {
      // Si el UPDATE falla, intentar INSERT
      try {
        const placeholders = columnas.map(() => '?').join(', ');
        const insertQuery = `INSERT INTO ${tablaPresup} (${columnas.join(', ')}) VALUES (${placeholders})`;
        await ejecutarConsulta(borrador.empresaId, insertQuery, valorInsert);
      } catch (insertError) {
        console.error(`Error al insertar en Firebird cuenta ${cuenta}:`, insertError);
        throw insertError;
      }
    }
  }
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
    WHERE empresaId = ? AND modulo = ? AND anio = ?
      AND estado IN ('${ESTADOS.EDITANDO}', '${ESTADOS.PENDIENTE}', '${ESTADOS.RECHAZADO}', '${ESTADOS.REVISADO}', '${ESTADOS.APROBADO}')
    ORDER BY fechaEnvio DESC NULLS LAST, id DESC
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
      SET data = ?, estado = '${ESTADOS.EDITANDO}', fechaEnvio = NULL, comentarios = NULL, usuarioId = ?
      WHERE id = ?
    `).run(contenido, cfg.usuarioId, existente.id);
    const actualizado = obtenerBorradorPorId(existente.id);
    registrarHistorial(existente.id, ESTADOS.EDITANDO, {
      comentario: 'Borrador actualizado',
      usuarioId: cfg.usuarioId
    });
    return actualizado;
  }

  const resultado = db.prepare(`
    INSERT INTO PLAN_BORRADORES (empresaId, anio, modulo, usuarioId, data, estado, comentarios)
    VALUES (?, ?, ?, ?, ?, '${ESTADOS.EDITANDO}', ?)
  `).run(cfg.empresaId, cfg.anio, cfg.modulo, cfg.usuarioId, contenido, cfg.comentarios);
  const creado = obtenerBorradorPorId(resultado.lastInsertRowid);
  registrarHistorial(creado.id, ESTADOS.EDITANDO, {
    comentario: 'Borrador creado',
    usuarioId: cfg.usuarioId
  });
  return creado;
};

const enviarRevision = async (borradorId, opciones = {}) => {
  const borrador = obtenerBorradorPorId(borradorId);
  if (!borrador) {
    throw new Error('Borrador no encontrado.');
  }

  if (opciones.rol === 'ADMIN_GLOBAL') {
    db.prepare(`
      UPDATE PLAN_BORRADORES
      SET estado = '${ESTADOS.APROBADO}', fechaEnvio = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(borradorId);
    registrarHistorial(borradorId, ESTADOS.APROBADO, {
      comentario: 'Autorizado automáticamente',
      usuarioId: opciones.usuarioId,
      meta: { origen: 'envio', auto: true }
    });
    return { autoAutorizado: true, borrador: obtenerBorradorPorId(borradorId) };
  }

  db.prepare(`
    UPDATE PLAN_BORRADORES
    SET estado = '${ESTADOS.PENDIENTE}', fechaEnvio = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(borradorId);

  registrarHistorial(borradorId, ESTADOS.PENDIENTE, {
    comentario: 'Borrador enviado a revisión',
    usuarioId: opciones.usuarioId,
    meta: { origen: 'envio' }
  });

  return { autoAutorizado: false, borrador: obtenerBorradorPorId(borradorId) };
};

const marcarRevisado = (borradorId, cancelar = false, actor = {}) => {
  const borrador = obtenerBorradorPorId(borradorId);
  if (!borrador) {
    throw new Error('Borrador no encontrado.');
  }
  const destino = cancelar ? ESTADOS.EDITANDO : ESTADOS.REVISADO;
  db.prepare(`
    UPDATE PLAN_BORRADORES
    SET estado = ?, comentarios = NULL
    WHERE id = ?
  `).run(destino, borradorId);
  registrarHistorial(borradorId, destino, {
    comentario: cancelar ? 'Revisión cancelada' : 'Marcado como revisado',
    usuarioId: actor.usuarioId,
    meta: { origen: 'revision', cancelar }
  });
  return obtenerBorradorPorId(borradorId);
};

const autorizarBorrador = async (borradorId, actor = {}) => {
  const borrador = obtenerBorradorPorId(borradorId);
  if (!borrador) {
    throw new Error('Borrador no encontrado.');
  }

  if (![ESTADOS.REVISADO, ESTADOS.APROBADO].includes(borrador.estado)) {
    throw new Error('El borrador debe estar revisado antes de autorizar.');
  }

  db.prepare(`
    UPDATE PLAN_BORRADORES
    SET estado = '${ESTADOS.APROBADO}', fechaEnvio = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(borradorId);

  registrarHistorial(borradorId, ESTADOS.APROBADO, {
    comentario: 'Autorizado',
    usuarioId: actor.usuarioId,
    meta: { origen: 'autorizacion' }
  });

  return obtenerBorradorPorId(borradorId);
};

const rechazarBorrador = (borradorId, motivo, actor = {}) => {
  const borrador = obtenerBorradorPorId(borradorId);
  if (!borrador) {
    throw new Error('Borrador no encontrado.');
  }

  db.prepare(`
    UPDATE PLAN_BORRADORES
    SET estado = '${ESTADOS.RECHAZADO}', comentarios = ?, fechaEnvio = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(motivo || null, borradorId);

  registrarHistorial(borradorId, ESTADOS.RECHAZADO, {
    comentario: motivo || 'Rechazado',
    usuarioId: actor.usuarioId,
    meta: { origen: 'rechazo' }
  });

  return obtenerBorradorPorId(borradorId);
};

const guardarAutorizado = async (borradorId, actor = {}) => {
  const borrador = obtenerBorradorPorId(borradorId);
  if (!borrador) {
    throw new Error('Borrador no encontrado.');
  }
  if (borrador.estado !== ESTADOS.APROBADO) {
    throw new Error('El borrador debe estar autorizado antes de guardar.');
  }
  const finalizador = obtenerFinalizador(borrador.modulo);
  if (finalizador) {
    await finalizador(borrador);
  }
  db.prepare(`
    UPDATE PLAN_BORRADORES
    SET estado = '${ESTADOS.GUARDADO}', fechaEnvio = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(borradorId);
  registrarHistorial(borradorId, ESTADOS.GUARDADO, {
    comentario: 'Guardado en base de datos',
    usuarioId: actor.usuarioId,
    meta: { origen: 'guardado' }
  });
  return obtenerBorradorPorId(borradorId);
};

module.exports = {
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
};
