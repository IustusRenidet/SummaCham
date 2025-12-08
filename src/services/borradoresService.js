const { db, registrarPresupuestoGuardado } = require('../db/sqlite');

const ESTADOS = {
  EDITANDO: 'EDITANDO',
  PENDIENTE: 'PENDIENTE',
  REVISADO: 'REVISADO',
  RECHAZADO: 'RECHAZADO',
  APROBADO: 'APROBADO',
  GUARDADO: 'GUARDADO'
};

const HISTORIAL_ACCIONES = {
  GUARDAR_BORRADOR: { clave: 'guardar-borrador', etiqueta: 'Guardó el borrador' },
  ENVIAR_REVISION: { clave: 'enviar-revision', etiqueta: 'Envió a revisión' },
  RECHAZAR: { clave: 'rechazar', etiqueta: 'Rechazó el borrador' },
  MARCAR_REVISADO: { clave: 'marcar-revision', etiqueta: 'Marcó como revisado' },
  CANCELAR_REVISION: { clave: 'cancelar-revision', etiqueta: 'Regresó a edición' },
  AUTORIZAR: { clave: 'autorizar', etiqueta: 'Autorizó el borrador' },
  AUTO_AUTORIZAR: { clave: 'autorizar-automatica', etiqueta: 'Autorización automática' },
  GUARDAR_COI: { clave: 'guardar-coi', etiqueta: 'Guardó en COI' },
  DESCARTAR: { clave: 'descartar', etiqueta: 'Descartó el borrador' }
};

const ETIQUETAS_ESTADO = {
  EDITANDO: 'En edición',
  PENDIENTE: 'Pendiente de revisión',
  REVISADO: 'Revisado',
  RECHAZADO: 'Rechazado',
  APROBADO: 'Autorizado',
  GUARDADO: 'Guardado en COI'
};

const obtenerEtiquetaAccion = (clave) => {
  if (!clave) return '';
  const entrada = Object.values(HISTORIAL_ACCIONES).find((accion) => accion.clave === clave);
  return entrada?.etiqueta || clave;
};

const obtenerEtiquetaEstado = (estado) => ETIQUETAS_ESTADO[estado] || estado;

const registrarEventoHistorial = ({
  borradorId,
  empresaId,
  modulo,
  anio,
  estado,
  accion,
  descripcion = '',
  comentarios = '',
  usuarioId = null
}) => {
  if (!empresaId || !modulo || !Number.isInteger(Number(anio)) || !estado || !accion) {
    return;
  }
  db.prepare(`
    INSERT INTO PLAN_BORRADORES_HISTORIAL (
      borradorId, empresaId, modulo, anio, estado, accion, descripcion, comentarios, usuarioId, registradoEn
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(
    borradorId || null,
    empresaId,
    modulo,
    Number(anio),
    estado,
    accion,
    descripcion,
    comentarios || null,
    usuarioId ? String(usuarioId) : null
  );
};

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

const mapearResumen = (fila) => {
  if (!fila) return null;
  const autorNombre = fila.autorNombre || '';
  return {
    id: fila.id,
    empresaId: fila.empresaId,
    modulo: fila.modulo,
    anio: fila.anio,
    usuarioId: fila.usuarioId,
    estado: fila.estado,
    fechaCreacion: fila.fechaCreacion,
    fechaEnvio: fila.fechaEnvio,
    comentarios: fila.comentarios,
    autorUsuario: fila.autorUsuario || '',
    autorNombre: autorNombre.trim() || fila.autorUsuario || '',
    data: null
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

const listarBorradores = ({ empresaId, modulo, anio, estado } = {}) => {
  const condiciones = [];
  const parametros = [];
  if (empresaId) {
    condiciones.push('b.empresaId = ?');
    parametros.push(empresaId);
  }
  if (modulo) {
    condiciones.push('b.modulo = ?');
    parametros.push(modulo);
  }
  if (Number.isInteger(anio)) {
    condiciones.push('b.anio = ?');
    parametros.push(anio);
  }
  if (estado) {
    condiciones.push('b.estado = ?');
    parametros.push(estado);
  }

  const whereClause = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  const filas = db.prepare(`
    SELECT
      b.*,
      u.usuario AS autorUsuario,
      TRIM(COALESCE(u.nombres, '') || ' ' || COALESCE(u.apellidos, '')) AS autorNombre
    FROM PLAN_BORRADORES b
    LEFT JOIN usuarios u ON u.id = CAST(b.usuarioId AS INTEGER)
    ${whereClause}
    ORDER BY b.fechaEnvio DESC NULLS LAST, b.fechaCreacion DESC
  `).all(...parametros);

  return filas.map(mapearResumen).filter(Boolean);
};

const buildBaseWhere = ({ empresaId, modulo, anio }) => {
  const condiciones = [];
  const parametros = [];
  if (empresaId) {
    condiciones.push('empresaId = ?');
    parametros.push(empresaId);
  }
  if (modulo) {
    condiciones.push('modulo = ?');
    parametros.push(modulo);
  }
  if (Number.isInteger(Number(anio))) {
    condiciones.push('anio = ?');
    parametros.push(Number(anio));
  }
  return { condiciones, parametros };
};

const listarHistorialBorradores = ({
  empresaId,
  modulo,
  anio,
  estado,
  accion,
  usuarioId,
  buscar,
  desde,
  hasta,
  limite = 100
} = {}) => {
  const condiciones = [];
  const parametros = [];
  const base = buildBaseWhere({ empresaId, modulo, anio });
  if (base.condiciones.length) {
    condiciones.push(...base.condiciones);
    parametros.push(...base.parametros);
  }
  if (estado) {
    condiciones.push('estado = ?');
    parametros.push(estado);
  }
  if (accion) {
    condiciones.push('accion = ?');
    parametros.push(accion);
  }
  if (usuarioId) {
    condiciones.push('usuarioId = ?');
    parametros.push(String(usuarioId));
  }
  if (buscar) {
    condiciones.push('(descripcion LIKE ? OR comentarios LIKE ?)');
    const termino = `%${buscar.trim()}%`;
    parametros.push(termino, termino);
  }
  if (desde) {
    condiciones.push('DATE(registradoEn) >= DATE(?)');
    parametros.push(desde);
  }
  if (hasta) {
    condiciones.push('DATE(registradoEn) <= DATE(?)');
    parametros.push(hasta);
  }
  const whereClause = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const limiteSeguro = Math.min(Math.max(Number(limite) || 50, 1), 500);

  const filas = db.prepare(`
    SELECT h.*, u.usuario AS autorUsuario,
           TRIM(COALESCE(u.nombres, '') || ' ' || COALESCE(u.apellidos, '')) AS autorNombre
    FROM PLAN_BORRADORES_HISTORIAL h
    LEFT JOIN usuarios u ON u.id = CAST(h.usuarioId AS INTEGER)
    ${whereClause}
    ORDER BY h.registradoEn DESC
    LIMIT ?
  `).all(...parametros, limiteSeguro);

  return filas.map((fila) => ({
    id: fila.id,
    borradorId: fila.borradorId,
    empresaId: fila.empresaId,
    modulo: fila.modulo,
    anio: fila.anio,
    estado: fila.estado,
    estadoEtiqueta: obtenerEtiquetaEstado(fila.estado),
    accion: fila.accion,
    accionEtiqueta: obtenerEtiquetaAccion(fila.accion),
    descripcion: fila.descripcion || '',
    comentarios: fila.comentarios || '',
    fecha: fila.registradoEn,
    usuario: {
      id: fila.usuarioId ? Number(fila.usuarioId) : null,
      usuario: fila.autorUsuario || '',
      nombre: (fila.autorNombre || '').trim() || fila.autorUsuario || ''
    }
  }));
};

const obtenerFiltrosHistorial = ({ empresaId, modulo, anio } = {}) => {
  const base = buildBaseWhere({ empresaId, modulo, anio });
  const filtros = { estados: [], acciones: [], usuarios: [] };
  const whereClause = base.condiciones.length ? `WHERE ${base.condiciones.join(' AND ')}` : '';
  const params = base.parametros;

  const estados = db.prepare(`
    SELECT DISTINCT estado FROM PLAN_BORRADORES_HISTORIAL ${whereClause} ORDER BY estado
  `).all(...params);
  filtros.estados = estados
    .map((row) => row.estado)
    .filter(Boolean)
    .map((valor) => ({ valor, etiqueta: obtenerEtiquetaEstado(valor) }));

  const acciones = db.prepare(`
    SELECT DISTINCT accion FROM PLAN_BORRADORES_HISTORIAL ${whereClause} ORDER BY accion
  `).all(...params);
  filtros.acciones = acciones
    .map((row) => row.accion)
    .filter(Boolean)
    .map((valor) => ({ valor, etiqueta: obtenerEtiquetaAccion(valor) }));

  const usuarios = db.prepare(`
    SELECT DISTINCT h.usuarioId AS id,
      u.usuario AS cuenta,
      TRIM(COALESCE(u.nombres, '') || ' ' || COALESCE(u.apellidos, '')) AS nombre
    FROM PLAN_BORRADORES_HISTORIAL h
    LEFT JOIN usuarios u ON u.id = CAST(h.usuarioId AS INTEGER)
    ${whereClause}
    ORDER BY nombre
  `).all(...params);
  filtros.usuarios = usuarios
    .filter((row) => row.id)
    .map((row) => ({
      id: Number(row.id),
      etiqueta: (row.nombre || '').trim() || row.cuenta || `Usuario ${row.id}`
    }));

  return filtros;
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
  
  let datos;
  try {
    datos = typeof borrador.data === 'string' ? JSON.parse(borrador.data) : borrador.data;
  } catch (parseError) {
    console.error('❌ Error al parsear datos del borrador:', parseError);
    throw new Error('Los datos del borrador están corruptos.');
  }

  const presupuesto = Array.isArray(datos?.presupuesto) ? datos.presupuesto : [];
  
  // ✅ MEJORA: Validar que hay datos antes de proceder
  if (!presupuesto || presupuesto.length === 0) {
    console.warn(`⚠️ Borrador ${borrador.id} (${borrador.empresaId}/${borrador.modulo}/${borrador.anio}) sin datos presupuestarios`);
    // No lanzar error - permitir guardar estado como GUARDADO pero registrar en logs
    return;
  }

  // ✅ MEJORA: Validar que hay valores numéricos válidos
  const tieneValoresValidos = presupuesto.some((cambio) => {
    if (!cambio || !cambio.valores) return false;
    return Object.values(cambio.valores).some((v) => {
      const num = Number(v);
      return Number.isFinite(num) && num !== 0;
    });
  });

  if (!tieneValoresValidos) {
    console.warn(
      `⚠️ Borrador ${borrador.id} (${borrador.empresaId}/${borrador.modulo}/${borrador.anio}) ` +
      `con solo ceros o valores inválidos`
    );
    // Registrar pero permitir - puede ser presupuesto legítimo de ceros
  }

  const anio = Number(borrador.anio);
  const sufijo = anio.toString().slice(-2).padStart(2, '0');
  const tablaPresup = `PRESUP${sufijo}`;

  // ✅ MEJORA: Registrar intent de guardar
  console.log(
    `📝 Persistencia en Firebird: ${presupuesto.length} cuentas → ${tablaPresup} ` +
    `(empresa: ${borrador.empresaId}, módulo: ${borrador.modulo})`
  );

  // Mapeo de claves a columnas PRESUP01-PRESUP12
  const MESES_COLUMNAS = {
    'budget-ene': 'PRESUP01', 'budget-feb': 'PRESUP02', 'budget-mar': 'PRESUP03',
    'budget-abr': 'PRESUP04', 'budget-may': 'PRESUP05', 'budget-jun': 'PRESUP06',
    'budget-jul': 'PRESUP07', 'budget-ago': 'PRESUP08', 'budget-sep': 'PRESUP09',
    'budget-oct': 'PRESUP10', 'budget-nov': 'PRESUP11', 'budget-dic': 'PRESUP12'
  };

  let contadorExitosas = 0;
  let contadorErrores = 0;

  for (const cambio of presupuesto) {
    const cuenta = (cambio.cuenta || '').toString().trim();
    const valores = cambio.valores || {};

    if (!cuenta) {
      console.warn(`⚠️ Cambio sin número de cuenta, ignorando`);
      contadorErrores++;
      continue;
    }

    const columnasVariables = [];
    const valoresVariables = [];

    Object.entries(valores).forEach(([clave, valor]) => {
      const columna = MESES_COLUMNAS[clave];
      if (!columna) return;
      columnasVariables.push(columna);
      const numero = Number(valor);
      valoresVariables.push(Number.isFinite(numero) ? numero : 0);
    });

    if (!columnasVariables.length) {
      console.warn(`⚠️ Cuenta ${cuenta} sin valores numéricos`);
      contadorErrores++;
      continue;
    }

    const columnas = ['NUM_CTA', 'EJERCICIO', ...columnasVariables];
    const parametros = [cuenta, anio, ...valoresVariables];
    const placeholders = columnas.map(() => '?').join(', ');

    // Firebird permite UPSERT con MATCHING; no perdemos registros nuevos.
    const upsertQuery = `
      UPDATE OR INSERT INTO ${tablaPresup} (${columnas.join(', ')})
      VALUES (${placeholders})
      MATCHING (NUM_CTA, EJERCICIO)
    `;

    try {
      await ejecutarConsulta(borrador.empresaId, upsertQuery, parametros);
      contadorExitosas++;
    } catch (error) {
      console.error(`❌ Error al guardar cuenta ${cuenta} en ${tablaPresup}:`, error.message);
      contadorErrores++;
      // No lanzar - continuar con otras cuentas para no perder todo
    }
  }

  console.log(
    `✅ Persistencia completada: ${contadorExitosas} cuentas exitosas, ${contadorErrores} errores`
  );
};

const FINALIZADORES = {
  PRESUPUESTOS: persistirEnFirebird
};

const obtenerFinalizador = (modulo) => {
  const clave = (modulo || '').toString().trim().toUpperCase();
  return FINALIZADORES[clave] || persistirEnFirebird;
};

const eliminarBorrador = (empresaId, modulo, anio, usuarioId) => {
  if (!empresaId || !modulo || !Number.isInteger(Number(anio))) {
    throw new Error('Contexto incompleto para descartar.');
  }
  const existente = obtenerBorrador({ empresaId, modulo, anio });
  if (!existente) {
    return null;
  }
  db.prepare('DELETE FROM PLAN_BORRADORES WHERE empresaId = ? AND modulo = ? AND anio = ?').run(
    empresaId,
    modulo,
    anio
  );
  registrarEventoHistorial({
    borradorId: existente.id,
    empresaId,
    modulo,
    anio,
    estado: existente.estado,
    accion: HISTORIAL_ACCIONES.DESCARTAR.clave,
    descripcion: 'Descartó el borrador en edición',
    usuarioId
  });
  return existente;
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
    registrarEventoHistorial({
      borradorId: actualizado.id,
      empresaId: actualizado.empresaId,
      modulo: actualizado.modulo,
      anio: actualizado.anio,
      estado: actualizado.estado,
      accion: HISTORIAL_ACCIONES.GUARDAR_BORRADOR.clave,
      descripcion: 'Guardó cambios para continuar editando',
      usuarioId: cfg.usuarioId
    });
    return actualizado;
  }

  const resultado = db.prepare(`
    INSERT INTO PLAN_BORRADORES (empresaId, anio, modulo, usuarioId, data, estado, comentarios)
    VALUES (?, ?, ?, ?, ?, '${ESTADOS.EDITANDO}', ?)
  `).run(cfg.empresaId, cfg.anio, cfg.modulo, cfg.usuarioId, contenido, cfg.comentarios);

  const nuevo = obtenerBorradorPorId(resultado.lastInsertRowid);
  registrarEventoHistorial({
    borradorId: nuevo.id,
    empresaId: nuevo.empresaId,
    modulo: nuevo.modulo,
    anio: nuevo.anio,
    estado: nuevo.estado,
    accion: HISTORIAL_ACCIONES.GUARDAR_BORRADOR.clave,
    descripcion: 'Creó un nuevo borrador',
    usuarioId: cfg.usuarioId
  });
  return nuevo;
};

const enviarRevision = async (borradorId, usuarioRol, usuarioId) => {
  const borrador = obtenerBorradorPorId(borradorId);
  if (!borrador) {
    throw new Error('Borrador no encontrado.');
  }

  if (usuarioRol === 'ADMIN_GLOBAL') {
    db.prepare(`
      UPDATE PLAN_BORRADORES
      SET estado = '${ESTADOS.APROBADO}', fechaEnvio = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(borradorId);
    const actualizado = obtenerBorradorPorId(borradorId);
    registrarEventoHistorial({
      borradorId,
      empresaId: actualizado.empresaId,
      modulo: actualizado.modulo,
      anio: actualizado.anio,
      estado: actualizado.estado,
      accion: HISTORIAL_ACCIONES.AUTO_AUTORIZAR.clave,
      descripcion: 'Autorización automática por administrador global',
      usuarioId
    });
    return { autoAutorizado: true, borrador: actualizado };
  }

  db.prepare(`
    UPDATE PLAN_BORRADORES
    SET estado = '${ESTADOS.PENDIENTE}', fechaEnvio = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(borradorId);

  const actualizado = obtenerBorradorPorId(borradorId);
  registrarEventoHistorial({
    borradorId,
    empresaId: actualizado.empresaId,
    modulo: actualizado.modulo,
    anio: actualizado.anio,
    estado: actualizado.estado,
    accion: HISTORIAL_ACCIONES.ENVIAR_REVISION.clave,
    descripcion: 'Envió el borrador a revisión',
    usuarioId
  });
  return { autoAutorizado: false, borrador: actualizado };
};

const marcarRevisado = (borradorId, cancelar = false, usuarioId) => {
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
  const actualizado = obtenerBorradorPorId(borradorId);
  registrarEventoHistorial({
    borradorId,
    empresaId: actualizado.empresaId,
    modulo: actualizado.modulo,
    anio: actualizado.anio,
    estado: actualizado.estado,
    accion: cancelar ? HISTORIAL_ACCIONES.CANCELAR_REVISION.clave : HISTORIAL_ACCIONES.MARCAR_REVISADO.clave,
    descripcion: cancelar ? 'Canceló la revisión y devolvió a edición' : 'Marcó el borrador como revisado',
    usuarioId
  });
  return actualizado;
};

const autorizarBorrador = async (borradorId, usuarioId) => {
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

  const actualizado = obtenerBorradorPorId(borradorId);
  registrarEventoHistorial({
    borradorId,
    empresaId: actualizado.empresaId,
    modulo: actualizado.modulo,
    anio: actualizado.anio,
    estado: actualizado.estado,
    accion: HISTORIAL_ACCIONES.AUTORIZAR.clave,
    descripcion: 'Autorizó el borrador',
    usuarioId
  });
  return actualizado;
};

const rechazarBorrador = (borradorId, motivo, usuarioId) => {
  const borrador = obtenerBorradorPorId(borradorId);
  if (!borrador) {
    throw new Error('Borrador no encontrado.');
  }

  db.prepare(`
    UPDATE PLAN_BORRADORES
    SET estado = '${ESTADOS.RECHAZADO}', comentarios = ?, fechaEnvio = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(motivo || null, borradorId);

  const actualizado = obtenerBorradorPorId(borradorId);
  registrarEventoHistorial({
    borradorId,
    empresaId: actualizado.empresaId,
    modulo: actualizado.modulo,
    anio: actualizado.anio,
    estado: actualizado.estado,
    accion: HISTORIAL_ACCIONES.RECHAZAR.clave,
    descripcion: 'Rechazó el borrador',
    comentarios: motivo || '',
    usuarioId
  });
  return actualizado;
};

const guardarAutorizado = async (borradorId, usuarioId) => {
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
  const actualizado = obtenerBorradorPorId(borradorId);
  registrarEventoHistorial({
    borradorId,
    empresaId: actualizado.empresaId,
    modulo: actualizado.modulo,
    anio: actualizado.anio,
    estado: actualizado.estado,
    accion: HISTORIAL_ACCIONES.GUARDAR_COI.clave,
    descripcion: 'Guardó la versión autorizada en COI',
    usuarioId
  });
  return actualizado;
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
  eliminarBorrador,
  listarBorradores,
  listarHistorialBorradores,
  obtenerFiltrosHistorial,
  ESTADOS,
  HISTORIAL_ACCIONES
};
