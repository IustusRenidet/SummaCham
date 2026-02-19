const { db, registrarPresupuestoGuardado } = require("../db/sqlite");

const ESTADOS = {
  EDITANDO: "EDITANDO",
  PENDIENTE: "PENDIENTE",
  REVISADO: "REVISADO",
  RECHAZADO: "RECHAZADO",
  APROBADO: "APROBADO",
  GUARDADO: "GUARDADO",
};

const HISTORIAL_ACCIONES = {
  GUARDAR_BORRADOR: {
    clave: "guardar-borrador",
    etiqueta: "Guardó el borrador",
  },
  ENVIAR_REVISION: { clave: "enviar-revision", etiqueta: "Envió a revisión" },
  RECHAZAR: { clave: "rechazar", etiqueta: "Rechazó el borrador" },
  MARCAR_REVISADO: {
    clave: "marcar-revision",
    etiqueta: "Marcó como revisado",
  },
  CANCELAR_REVISION: {
    clave: "cancelar-revision",
    etiqueta: "Regresó a edición",
  },
  AUTORIZAR: { clave: "autorizar", etiqueta: "Autorizó el borrador" },
  AUTO_AUTORIZAR: {
    clave: "autorizar-automatica",
    etiqueta: "Autorización automática",
  },
  GUARDAR_COI: { clave: "guardar-coi", etiqueta: "Guardó en COI" },
  DESCARTAR: { clave: "descartar", etiqueta: "Descartó el borrador" },
};

const ETIQUETAS_ESTADO = {
  EDITANDO: "En edición",
  PENDIENTE: "Pendiente de revisión",
  REVISADO: "Revisado",
  RECHAZADO: "Rechazado",
  APROBADO: "Autorizado",
  GUARDADO: "Guardado en COI",
};

const progresoRecontabilizacion = new Map();
const colaRecontabilizacion = new Map();
const statsRecontabilizacion = new Map();
const guardadoCoiEnCurso = new Map();

const STATS_ALPHA = 0.25;
const GLOBAL_STATS_KEY = "__GLOBAL__";

const normalizarMs = (valor) => {
  const ms = typeof valor === "number" ? valor : Date.parse(valor);
  return Number.isFinite(ms) ? ms : null;
};

const actualizarStatsRecontabilizacion = (colaKey, muestra = {}) => {
  const actualizarKey = (key) => {
    if (!key) return;
    const duracion = Number(muestra?.duracionMs);
    if (!Number.isFinite(duracion) || duracion <= 0) return;

    const previo = statsRecontabilizacion.get(key) || {
      muestras: 0,
      duracionPromedioMs: 0,
      unidadesPromedio: 0,
      msPorUnidadPromedio: 0,
    };

    const alpha = STATS_ALPHA;
    const muestras = (previo.muestras || 0) + 1;
    const duracionPromedioMs =
      previo.muestras > 0
        ? Math.round(previo.duracionPromedioMs * (1 - alpha) + duracion * alpha)
        : Math.round(duracion);

    let unidadesPromedio = previo.unidadesPromedio || 0;
    let msPorUnidadPromedio = previo.msPorUnidadPromedio || 0;

    const unidadesNum = Number(muestra?.unidades);
    if (Number.isFinite(unidadesNum) && unidadesNum > 0) {
      const msPorUnidad = duracion / unidadesNum;
      unidadesPromedio =
        previo.muestras > 0
          ? Math.round(unidadesPromedio * (1 - alpha) + unidadesNum * alpha)
          : Math.round(unidadesNum);
      msPorUnidadPromedio =
        previo.muestras > 0
          ? Math.round(msPorUnidadPromedio * (1 - alpha) + msPorUnidad * alpha)
          : Math.round(msPorUnidad);
    }

    statsRecontabilizacion.set(key, {
      muestras,
      duracionPromedioMs,
      unidadesPromedio,
      msPorUnidadPromedio,
      actualizadoEn: new Date().toISOString(),
    });
  };

  actualizarKey(colaKey);
  if (colaKey !== GLOBAL_STATS_KEY) {
    actualizarKey(GLOBAL_STATS_KEY);
  }
};

const obtenerClaveCola = (empresaId, anio) =>
  `${empresaId || ""}-${Number(anio) || ""}`;

const encolarRecontabilizacion = ({ empresaId, anio, borradorId }, tarea) => {
  const clave = obtenerClaveCola(empresaId, anio);
  const info = colaRecontabilizacion.get(clave) || {
    cola: Promise.resolve(),
    tamanio: 0,
  };

  info.tamanio += 1;
  const posicion = info.tamanio;

  const ejecucion = info.cola
    .catch(() => undefined)
    .then(() => tarea())
    .finally(() => {
      info.tamanio = Math.max(0, info.tamanio - 1);
      if (info.tamanio === 0) {
        colaRecontabilizacion.delete(clave);
      } else {
        colaRecontabilizacion.set(clave, info);
      }
    });

  info.cola = ejecucion;
  colaRecontabilizacion.set(clave, info);

  if (borradorId) {
    const ahora = new Date().toISOString();
    actualizarProgresoRecontabilizacion(borradorId, {
      estado: "en-cola",
      posicion,
      colaKey: clave,
      empresaId: empresaId || null,
      anio: Number(anio) || null,
      enColaDesde: ahora,
    });
  }

  return { posicion, ejecucion };
};

const iniciarProgresoRecontabilizacion = (
  borradorId,
  { empresaId = null, anio = null } = {}
) => {
  if (!borradorId) return;
  const colaKey = empresaId && Number.isInteger(Number(anio))
    ? obtenerClaveCola(empresaId, anio)
    : null;
  progresoRecontabilizacion.set(String(borradorId), {
    estado: "iniciando",
    total: 0,
    actual: 0,
    porcentaje: 0,
    colaKey,
    empresaId: empresaId || null,
    anio: Number.isInteger(Number(anio)) ? Number(anio) : null,
    enColaDesde: null,
    inicioTrabajo: null,
    inicioRecontabilizacion: null,
    finalizadoEn: null,
    actualizadoEn: new Date().toISOString(),
  });
};

const actualizarProgresoRecontabilizacion = (borradorId, data = {}) => {
  if (!borradorId) return;
  const clave = String(borradorId);
  const previo = progresoRecontabilizacion.get(clave) || {
    estado: "iniciando",
    total: 0,
    actual: 0,
    porcentaje: 0,
  };
  const total = Number.isFinite(data.total) ? data.total : previo.total;
  const actual = Number.isFinite(data.actual) ? data.actual : previo.actual;
  const porcentaje = total > 0 ? Math.min(100, Math.round((actual / total) * 100)) : 0;
  progresoRecontabilizacion.set(clave, {
    ...previo,
    ...data,
    total,
    actual,
    porcentaje,
    actualizadoEn: new Date().toISOString(),
  });
};

const finalizarProgresoRecontabilizacion = (borradorId, estado = "completado") => {
  if (!borradorId) return;
  const clave = String(borradorId);
  const previo = progresoRecontabilizacion.get(clave) || null;
  const yaFinalizado = Boolean(previo?.finalizadoEn);
  const finalizadoEn = new Date().toISOString();
  actualizarProgresoRecontabilizacion(borradorId, {
    estado,
    porcentaje: 100,
    finalizadoEn,
  });

  if (yaFinalizado || estado !== "completado") {
    return;
  }

  const inicioTrabajoMs = normalizarMs(previo?.inicioTrabajo);
  const finalizadoMs = normalizarMs(finalizadoEn);
  const duracionMs =
    inicioTrabajoMs != null && finalizadoMs != null
      ? finalizadoMs - inicioTrabajoMs
      : null;

  if (
    previo?.colaKey &&
    Number.isFinite(duracionMs) &&
    duracionMs > 0
  ) {
    actualizarStatsRecontabilizacion(previo.colaKey, {
      duracionMs,
      unidades: Number(previo.total) || null,
    });
  }
};

const obtenerProgresoRecontabilizacion = (borradorId) => {
  if (!borradorId) return null;
  const base = progresoRecontabilizacion.get(String(borradorId)) || null;
  if (!base) return null;

  const ahoraMs = Date.now();
  const progreso = { ...base };
  const colaKey =
    progreso.colaKey ||
    (progreso.empresaId && Number.isInteger(Number(progreso.anio))
      ? obtenerClaveCola(progreso.empresaId, progreso.anio)
      : null);
  const stats =
    (colaKey && statsRecontabilizacion.get(colaKey)) ||
    statsRecontabilizacion.get(GLOBAL_STATS_KEY) ||
    null;

  if (progreso.estado === "en-cola") {
    const enColaDesdeMs =
      normalizarMs(progreso.enColaDesde) || normalizarMs(progreso.actualizadoEn);
    if (enColaDesdeMs != null) {
      progreso.tiempoEnColaMs = Math.max(0, ahoraMs - enColaDesdeMs);
    }
    const posicion = Number(progreso.posicion) || 1;
    if (stats?.duracionPromedioMs && posicion > 1) {
      progreso.esperaEstimadaMs = Math.max(
        0,
        Math.round((posicion - 1) * stats.duracionPromedioMs)
      );
      if (Number.isFinite(progreso.tiempoEnColaMs)) {
        progreso.esperaRestanteMs = Math.max(
          0,
          progreso.esperaEstimadaMs - progreso.tiempoEnColaMs
        );
      }
    }
  }

  if (progreso.estado === "guardando") {
    const inicioMs =
      normalizarMs(progreso.inicioTrabajo) || normalizarMs(progreso.actualizadoEn);
    if (inicioMs != null) {
      progreso.tiempoTranscurridoMs = Math.max(0, ahoraMs - inicioMs);
    }
    if (stats?.duracionPromedioMs && Number.isFinite(progreso.tiempoTranscurridoMs)) {
      const restante = stats.duracionPromedioMs - progreso.tiempoTranscurridoMs;
      progreso.restanteEstimadoMs = Math.max(0, Math.round(restante));
    }
  }

  if (progreso.estado === "recontabilizando") {
    const inicioMs =
      normalizarMs(progreso.inicioRecontabilizacion) ||
      normalizarMs(progreso.inicioTrabajo) ||
      normalizarMs(progreso.actualizadoEn);
    if (inicioMs != null) {
      progreso.tiempoTranscurridoMs = Math.max(0, ahoraMs - inicioMs);
    }
    const total = Number(progreso.total) || 0;
    const actual = Number(progreso.actual) || 0;
    if (
      total > 0 &&
      actual > 0 &&
      Number.isFinite(progreso.tiempoTranscurridoMs) &&
      progreso.tiempoTranscurridoMs > 0
    ) {
      const msPorUnidad = progreso.tiempoTranscurridoMs / actual;
      const restante = Math.max(0, total - actual) * msPorUnidad;
      if (Number.isFinite(restante)) {
        progreso.restanteEstimadoMs = Math.max(0, Math.round(restante));
      }
    } else if (total > 0 && actual === 0 && stats?.msPorUnidadPromedio) {
      progreso.restanteEstimadoMs = Math.max(
        0,
        Math.round(total * stats.msPorUnidadPromedio)
      );
    }
  }

  if (stats) {
    progreso.statsCola = {
      muestras: stats.muestras,
      duracionPromedioMs: stats.duracionPromedioMs,
      unidadesPromedio: stats.unidadesPromedio,
      msPorUnidadPromedio: stats.msPorUnidadPromedio,
    };
  }

  return progreso;
};

const obtenerEtiquetaAccion = (clave) => {
  if (!clave) return "";
  const entrada = Object.values(HISTORIAL_ACCIONES).find(
    (accion) => accion.clave === clave
  );
  return entrada?.etiqueta || clave;
};

const obtenerEtiquetaEstado = (estado) => ETIQUETAS_ESTADO[estado] || estado;

const registrarEventoHistorial = ({
  borradorId,
  empresaId,
  modulo,
  anio,
  capitulo = 'DEFAULT',
  estado,
  accion,
  descripcion = "",
  comentarios = "",
  usuarioId = null,
}) => {
  if (
    !empresaId ||
    !modulo ||
    !Number.isInteger(Number(anio)) ||
    !estado ||
    !accion
  ) {
    return;
  }
  db.prepare(
    `
    INSERT INTO PLAN_BORRADORES_HISTORIAL (
      borradorId, empresaId, modulo, anio, capitulo, estado, accion, descripcion, comentarios, usuarioId, registradoEn
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `
  ).run(
    borradorId || null,
    empresaId,
    modulo,
    Number(anio),
    capitulo || 'DEFAULT',
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

const resumirCambiosBorrador = (datos) => {
  let parsed = null;
  try {
    parsed = typeof datos === "string" ? JSON.parse(datos) : datos;
  } catch (_) {
    return "";
  }

  const presupuesto = Array.isArray(parsed?.presupuesto) ? parsed.presupuesto : [];
  const tieneLayout = Boolean(parsed?.layout) || Array.isArray(parsed?.filas);

  if (!presupuesto.length && !tieneLayout) {
    return "";
  }

  let celdas = 0;
  const meses = new Set();
  const cuentasEjemplo = [];

  for (const cambio of presupuesto) {
    const cuenta = (cambio?.cuenta || "").toString().trim();
    if (cuenta && cuentasEjemplo.length < 6 && !cuentasEjemplo.includes(cuenta)) {
      cuentasEjemplo.push(cuenta);
    }

    const valores = cambio?.valores || {};
    for (const clave of Object.keys(valores)) {
      if (!clave.startsWith("budget-")) continue;
      celdas += 1;
      meses.add(clave.slice("budget-".length));
    }
  }

  const ordenMeses = [
    ["ene", "ENE"],
    ["feb", "FEB"],
    ["mar", "MAR"],
    ["abr", "ABR"],
    ["may", "MAY"],
    ["jun", "JUN"],
    ["jul", "JUL"],
    ["ago", "AGO"],
    ["sep", "SEP"],
    ["oct", "OCT"],
    ["nov", "NOV"],
    ["dic", "DIC"],
  ];
  const mesesEtiqueta = ordenMeses
    .filter(([mes]) => meses.has(mes))
    .map(([, etiqueta]) => etiqueta);

  const partes = [];
  if (presupuesto.length) {
    partes.push(
      `${presupuesto.length} cuenta${presupuesto.length === 1 ? "" : "s"}`
    );
  }
  if (celdas) {
    partes.push(`${celdas} cambio${celdas === 1 ? "" : "s"}`);
  }
  if (mesesEtiqueta.length) {
    partes.push(`meses: ${mesesEtiqueta.join(", ")}`);
  }
  if (tieneLayout) {
    partes.push("layout");
  }

  let resumen = `Cambios: ${partes.join(" · ")}`;
  if (cuentasEjemplo.length) {
    resumen += ` · Ej.: ${cuentasEjemplo.join(", ")}${
      presupuesto.length > cuentasEjemplo.length ? "…" : ""
    }`;
  }

  return resumen.length > 900 ? `${resumen.slice(0, 900)}…` : resumen;
};

const normalizarContexto = (contexto) => {
  if (!contexto) {
    throw new Error("Contexto del borrador no proporcionado.");
  }
  const empresaId = (contexto.empresaId || "").toString().trim();
  const modulo = (contexto.modulo || "").toString().trim();
  const anio = Number(contexto.anio);
  const capitulo = (contexto.capitulo || 'DEFAULT').toString().trim();
  const usuarioId = (contexto.usuarioId || "").toString().trim();
  if (!empresaId || !modulo || !Number.isInteger(anio) || !usuarioId) {
    throw new Error("Contexto incompleto para el borrador.");
  }
  return {
    empresaId,
    modulo,
    anio,
    capitulo,
    usuarioId,
    comentarios: contexto.comentarios
      ? contexto.comentarios.toString().trim()
      : null,
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
    capitulo: fila.capitulo || 'DEFAULT',
    usuarioId: fila.usuarioId,
    data: mapData(fila.data),
    estado: fila.estado,
    fechaCreacion: fila.fechaCreacion,
    fechaEnvio: fila.fechaEnvio,
    comentarios: fila.comentarios,
  };
};

const mapearResumen = (fila) => {
  if (!fila) return null;
  const autorNombre = fila.autorNombre || "";
  return {
    id: fila.id,
    empresaId: fila.empresaId,
    modulo: fila.modulo,
    anio: fila.anio,
    capitulo: fila.capitulo || 'DEFAULT',
    usuarioId: fila.usuarioId,
    estado: fila.estado,
    fechaCreacion: fila.fechaCreacion,
    fechaEnvio: fila.fechaEnvio,
    comentarios: fila.comentarios,
    autorUsuario: fila.autorUsuario || "",
    autorNombre: autorNombre.trim() || fila.autorUsuario || "",
    data: null,
  };
};

const obtenerBorradorPorId = (id) => {
  if (!id) {
    return null;
  }
  const fila = db
    .prepare(
      `
    SELECT *
    FROM PLAN_BORRADORES
    WHERE id = ?
  `
    )
    .get(id);
  return mapearFila(fila);
};

const listarBorradores = ({ empresaId, modulo, anio, capitulo, estado } = {}) => {
  const condiciones = [];
  const parametros = [];
  if (empresaId) {
    condiciones.push("b.empresaId = ?");
    parametros.push(empresaId);
  }
  if (modulo) {
    condiciones.push("b.modulo = ?");
    parametros.push(modulo);
  }
  if (Number.isInteger(anio)) {
    condiciones.push("b.anio = ?");
    parametros.push(anio);
  }
  if (capitulo) {
    condiciones.push("b.capitulo = ?");
    parametros.push(capitulo);
  }
  if (estado) {
    condiciones.push("b.estado = ?");
    parametros.push(estado);
  }

  const whereClause = condiciones.length
    ? `WHERE ${condiciones.join(" AND ")}`
    : "";

  const filas = db
    .prepare(
      `
    SELECT
      b.*,
      u.usuario AS autorUsuario,
      TRIM(COALESCE(u.nombres, '') || ' ' || COALESCE(u.apellidos, '')) AS autorNombre
    FROM PLAN_BORRADORES b
    LEFT JOIN usuarios u ON u.id = CAST(b.usuarioId AS INTEGER)
    ${whereClause}
    ORDER BY b.fechaEnvio DESC NULLS LAST, b.fechaCreacion DESC
  `
    )
    .all(...parametros);

  return filas.map(mapearResumen).filter(Boolean);
};

const buildBaseWhere = ({ empresaId, modulo, anio }) => {
  const condiciones = [];
  const parametros = [];
  if (empresaId) {
    condiciones.push("empresaId = ?");
    parametros.push(empresaId);
  }
  if (modulo) {
    condiciones.push("modulo = ?");
    parametros.push(modulo);
  }
  if (Number.isInteger(Number(anio))) {
    condiciones.push("anio = ?");
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
  limite = 100,
} = {}) => {
  const condiciones = [];
  const parametros = [];
  const base = buildBaseWhere({ empresaId, modulo, anio });
  if (base.condiciones.length) {
    condiciones.push(...base.condiciones);
    parametros.push(...base.parametros);
  }
  if (estado) {
    condiciones.push("estado = ?");
    parametros.push(estado);
  }
  if (accion) {
    condiciones.push("accion = ?");
    parametros.push(accion);
  }
  if (usuarioId) {
    condiciones.push("usuarioId = ?");
    parametros.push(String(usuarioId));
  }
  if (buscar) {
    condiciones.push("(descripcion LIKE ? OR comentarios LIKE ?)");
    const termino = `%${buscar.trim()}%`;
    parametros.push(termino, termino);
  }
  if (desde) {
    condiciones.push("DATE(registradoEn) >= DATE(?)");
    parametros.push(desde);
  }
  if (hasta) {
    condiciones.push("DATE(registradoEn) <= DATE(?)");
    parametros.push(hasta);
  }
  const whereClause = condiciones.length
    ? `WHERE ${condiciones.join(" AND ")}`
    : "";
  const limiteSeguro = Math.min(Math.max(Number(limite) || 50, 1), 500);

  const filas = db
    .prepare(
      `
    SELECT h.*, u.usuario AS autorUsuario, u.correo AS autorCorreo,
           TRIM(COALESCE(u.nombres, '') || ' ' || COALESCE(u.apellidos, '')) AS autorNombre
    FROM PLAN_BORRADORES_HISTORIAL h
    LEFT JOIN usuarios u ON u.id = CAST(h.usuarioId AS INTEGER)
    ${whereClause}
    ORDER BY h.registradoEn DESC
    LIMIT ?
  `
    )
    .all(...parametros, limiteSeguro);

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
    descripcion: fila.descripcion || "",
    comentarios: fila.comentarios || "",
    fecha: fila.registradoEn,
    usuario: {
      id: fila.usuarioId ? Number(fila.usuarioId) : null,
      usuario: fila.autorUsuario || "",
      nombre: (fila.autorNombre || "").trim() || fila.autorUsuario || "",
      correo: fila.autorCorreo || "",
    },
  }));
};

const obtenerFiltrosHistorial = ({ empresaId, modulo, anio } = {}) => {
  const base = buildBaseWhere({ empresaId, modulo, anio });
  const filtros = { estados: [], acciones: [], usuarios: [] };
  const whereClause = base.condiciones.length
    ? `WHERE ${base.condiciones.join(" AND ")}`
    : "";
  const params = base.parametros;

  const estados = db
    .prepare(
      `
    SELECT DISTINCT estado FROM PLAN_BORRADORES_HISTORIAL ${whereClause} ORDER BY estado
  `
    )
    .all(...params);
  filtros.estados = estados
    .map((row) => row.estado)
    .filter(Boolean)
    .map((valor) => ({ valor, etiqueta: obtenerEtiquetaEstado(valor) }));

  const acciones = db
    .prepare(
      `
    SELECT DISTINCT accion FROM PLAN_BORRADORES_HISTORIAL ${whereClause} ORDER BY accion
  `
    )
    .all(...params);
  filtros.acciones = acciones
    .map((row) => row.accion)
    .filter(Boolean)
    .map((valor) => ({ valor, etiqueta: obtenerEtiquetaAccion(valor) }));

  const usuarios = db
    .prepare(
      `
    SELECT DISTINCT h.usuarioId AS id,
      u.usuario AS cuenta,
      TRIM(COALESCE(u.nombres, '') || ' ' || COALESCE(u.apellidos, '')) AS nombre
    FROM PLAN_BORRADORES_HISTORIAL h
    LEFT JOIN usuarios u ON u.id = CAST(h.usuarioId AS INTEGER)
    ${whereClause}
    ORDER BY nombre
  `
    )
    .all(...params);
  filtros.usuarios = usuarios
    .filter((row) => row.id)
    .map((row) => ({
      id: Number(row.id),
      etiqueta: (row.nombre || "").trim() || row.cuenta || `Usuario ${row.id}`,
    }));

  return filtros;
};

const persistirEnFirebird = async (borrador) => {
  // 1. Guardar LAYOUT (estructura de tabla: cuentas/descripciones/filas) en layout_cuentas (SQLite)
  const { guardarLayout } = require("./layoutsService");

  // 2. Guardar en Firebird PRESUP table (solo valores numéricos)
  const { ejecutarLote } = require("./firebirdService");

  let datos;
  try {
    datos =
      typeof borrador.data === "string"
        ? JSON.parse(borrador.data)
        : borrador.data;
  } catch (parseError) {
    console.error("❌ Error al parsear datos del borrador:", parseError);
    throw new Error("Los datos del borrador están corruptos.");
  }

  const presupuesto = Array.isArray(datos?.presupuesto)
    ? datos.presupuesto
    : [];

  // ✅ PASO 1: Guardar LAYOUT (estructura) en layout_cuentas
  // El layout incluye: cuentas, descripciones, orden de filas, secciones creadas
  if (datos?.layout || datos?.filas) {
    const layoutData = datos.layout || { filas: datos.filas || [] };
    try {
      guardarLayout({
        empresaId: borrador.empresaId,
        modulo: borrador.modulo,
        anio: borrador.anio,
        layout: layoutData,
        usuarioId: Number(borrador.usuarioId) || null
      });
      console.log(`✅ Layout actualizado en layout_cuentas (${borrador.empresaId}/${borrador.modulo}/${borrador.anio})`);
    } catch (layoutError) {
      console.error(`❌ Error guardando layout:`, layoutError);
      // No bloquear - continuar con presupuesto
    }
  }

  // ✅ PASO 2: Validar que hay datos de presupuesto antes de proceder
  if (!presupuesto || presupuesto.length === 0) {
    console.warn(
      `⚠️ Borrador ${borrador.id} (${borrador.empresaId}/${borrador.modulo}/${borrador.anio}) sin datos presupuestarios`
    );
    // No lanzar error - puede ser un borrador solo con cambios de layout
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
  const sufijo = anio.toString().slice(-2).padStart(2, "0");
  const tablaPresup = `PRESUP${sufijo}`;

  // ✅ MEJORA: Registrar intent de guardar
  console.log(
    `📝 Persistencia en Firebird: ${presupuesto.length} cambios → ${tablaPresup} ` +
      `(empresa: ${borrador.empresaId}, módulo: ${borrador.modulo})`
  );

  // Mapeo de claves a columnas PRESUP01-PRESUP12
  const MESES_COLUMNAS = {
    "budget-ene": "PRESUP01",
    "budget-feb": "PRESUP02",
    "budget-mar": "PRESUP03",
    "budget-abr": "PRESUP04",
    "budget-may": "PRESUP05",
    "budget-jun": "PRESUP06",
    "budget-jul": "PRESUP07",
    "budget-ago": "PRESUP08",
    "budget-sep": "PRESUP09",
    "budget-oct": "PRESUP10",
    "budget-nov": "PRESUP11",
    "budget-dic": "PRESUP12",
  };

  let contadorOmitidas = 0;
  const presupuestosEditados = new Map();
  let manualBaseMap = null;

  try {
    manualBaseMap = await calcularManualPadres(
      borrador.empresaId,
      anio,
      tablaPresup
    );
  } catch (manualError) {
    console.warn(
      `⚠️ No fue posible calcular manual base de cuentas padre: ${manualError.message}`
    );
  }

  for (const cambio of presupuesto) {
    const cuenta = (cambio.cuenta || "").toString().trim();
    const valores = cambio.valores || {};

    if (!cuenta) {
      console.warn(`⚠️ Cambio sin número de cuenta, ignorando`);
      contadorOmitidas++;
      continue;
    }

    const columnasVariables = [];
    const valoresVariables = [];

    // SOLO procesar cambios numéricos (meses), ignorar campos de texto
    Object.entries(valores).forEach(([clave, valor]) => {
      // Ignorar cambios de texto (cuenta, descripcion, nombre)
      // Estos ya fueron guardados en layout_cuentas arriba
      if (clave === 'cuenta' || clave === 'descripcion' || clave === 'nombre') {
        return;
      }
      
      const columna = MESES_COLUMNAS[clave];
      if (!columna) return;
      columnasVariables.push(columna);
      const numero = Number(valor);
      valoresVariables.push(Number.isFinite(numero) ? numero : 0);
    });

    if (!columnasVariables.length) {
      console.warn(`⚠️ Cuenta ${cuenta} sin valores numéricos`);
      contadorOmitidas++;
      continue;
    }

    const registroEditado = presupuestosEditados.get(cuenta) || {};
    columnasVariables.forEach((columna, index) => {
      registroEditado[columna] = valoresVariables[index];
    });
    presupuestosEditados.set(cuenta, registroEditado);
  }

  const COLUMNAS_PRESUP = Object.values(MESES_COLUMNAS);
  const ensureQuery = `
    INSERT INTO ${tablaPresup} (NUM_CTA, EJERCICIO, ${COLUMNAS_PRESUP.join(", ")})
    SELECT ?, ?, ${COLUMNAS_PRESUP.map(() => "0").join(", ")}
    FROM RDB$DATABASE
    WHERE NOT EXISTS (
      SELECT 1
      FROM ${tablaPresup}
      WHERE NUM_CTA = ? AND EJERCICIO = ?
    )
  `;

  const indiceOrden = new Map(COLUMNAS_PRESUP.map((col, idx) => [col, idx]));
  const ordenarColumnas = (cols) =>
    (cols || []).slice().sort((a, b) => {
      const ia = indiceOrden.has(a) ? indiceOrden.get(a) : 999;
      const ib = indiceOrden.has(b) ? indiceOrden.get(b) : 999;
      if (ia !== ib) return ia - ib;
      return String(a).localeCompare(String(b));
    });

  const operaciones = [];
  for (const [cuenta, registroEditado] of presupuestosEditados.entries()) {
    const columnas = ordenarColumnas(Object.keys(registroEditado || {}));
    if (!columnas.length) continue;

    operaciones.push({
      consulta: ensureQuery,
      parametros: [cuenta, anio, cuenta, anio],
      meta: { cuenta },
    });

    const setClause = columnas.map((col) => `${col} = ?`).join(", ");
    const updateQuery = `
      UPDATE ${tablaPresup}
      SET ${setClause}
      WHERE NUM_CTA = ? AND EJERCICIO = ?
    `;
    const valoresUpdate = columnas.map((col) => registroEditado[col]);
    operaciones.push({
      consulta: updateQuery,
      parametros: [...valoresUpdate, cuenta, anio],
      meta: { cuenta },
    });
  }

  if (!operaciones.length) {
    console.warn(
      `⚠️ No hay operaciones numéricas que persistir en ${tablaPresup} (borrador ${borrador.id})`
    );
    return;
  }

  await ejecutarLote(borrador.empresaId, operaciones);

  console.log(
    `✅ Persistencia completada: ${presupuestosEditados.size} cuentas actualizadas${
      contadorOmitidas ? `, ${contadorOmitidas} omitidas` : ""
    }`
  );

  // Guardar snapshot en SQLite SOLO si Firebird terminó correctamente
  registrarPresupuestoGuardado({
    empresaId: borrador.empresaId,
    modulo: borrador.modulo,
    anio: borrador.anio,
    datos: borrador.data,
    guardadoPor: Number(borrador.usuarioId) || null,
  });

  // ✅ PASO 3: Actualizar cuentas padre (acumulativas) con la suma de sus cuentas hijas
  try {
    await actualizarCuentasPadre(
      borrador.empresaId,
      anio,
      tablaPresup,
      presupuestosEditados,
      manualBaseMap,
      borrador.id
    );
  } catch (errorPadre) {
    console.error(`❌ Error al actualizar cuentas padre:`, errorPadre);
    // No bloquear - las cuentas de detalle ya se guardaron correctamente
  }
};

/**
 * Actualiza las cuentas padre con la suma de sus cuentas hijas.
 * Nota: en COI puede haber presupuesto capturado en cuentas acumulativas (TIPO='A').
 * Para no excluir montos válidos, la suma considera hijas sin importar su TIPO.
 */
const calcularManualPadres = async (empresaId, anio, tablaPresup) => {
  const { ejecutarConsulta } = require("./firebirdService");
  const tablaCuentas = `CUENTAS${anio.toString().slice(-2).padStart(2, '0')}`;

  const queryCuentasPadre = `
    SELECT DISTINCT p.NUM_CTA
    FROM ${tablaCuentas} h
    JOIN ${tablaCuentas} p
      ON TRIM(p.NUM_CTA) = TRIM(h.CTA_PAPA)
    WHERE h.STATUS = 'A'
      AND p.STATUS = 'A'
      AND TRIM(h.CTA_PAPA) <> ''
  `;

  const cuentasPadre = await ejecutarConsulta(empresaId, queryCuentasPadre, []);
  if (!cuentasPadre || cuentasPadre.length === 0) {
    return new Map();
  }

  const manualMap = new Map();

  for (const cuentaPadre of cuentasPadre) {
    const numCta = (cuentaPadre.NUM_CTA || '').trim();
    if (!numCta) continue;

    const queryHijas = `
      SELECT 
        h.NUM_CTA,
        p.PRESUP01, p.PRESUP02, p.PRESUP03, p.PRESUP04, p.PRESUP05, p.PRESUP06,
        p.PRESUP07, p.PRESUP08, p.PRESUP09, p.PRESUP10, p.PRESUP11, p.PRESUP12
      FROM ${tablaCuentas} h
      LEFT JOIN ${tablaPresup} p ON p.NUM_CTA = h.NUM_CTA AND p.EJERCICIO = ?
      WHERE h.STATUS = 'A'
        AND TRIM(h.CTA_PAPA) = ?
    `;

    const cuentasHijas = await ejecutarConsulta(empresaId, queryHijas, [anio, numCta]);
    const sumasMensuales = {
      PRESUP01: 0, PRESUP02: 0, PRESUP03: 0, PRESUP04: 0,
      PRESUP05: 0, PRESUP06: 0, PRESUP07: 0, PRESUP08: 0,
      PRESUP09: 0, PRESUP10: 0, PRESUP11: 0, PRESUP12: 0
    };

    (cuentasHijas || []).forEach((hija) => {
      for (let mes = 1; mes <= 12; mes++) {
        const col = `PRESUP${mes.toString().padStart(2, '0')}`;
        const valor = Number(hija[col]) || 0;
        sumasMensuales[col] += valor;
      }
    });

    const queryPadrePresup = `
      SELECT 
        PRESUP01, PRESUP02, PRESUP03, PRESUP04, PRESUP05, PRESUP06,
        PRESUP07, PRESUP08, PRESUP09, PRESUP10, PRESUP11, PRESUP12
      FROM ${tablaPresup}
      WHERE NUM_CTA = ? AND EJERCICIO = ?
    `;
    const padrePresupRows = await ejecutarConsulta(empresaId, queryPadrePresup, [numCta, anio]);
    const padrePresup = padrePresupRows && padrePresupRows[0] ? padrePresupRows[0] : null;

    const manualCalculado = {};
    Object.keys(sumasMensuales).forEach((col) => {
      if (!padrePresup) {
        manualCalculado[col] = 0;
        return;
      }
      const actual = Number(padrePresup[col]) || 0;
      const manual = actual - sumasMensuales[col];
      // Manual es ADITIVO: no permitir que reste a la suma de hijas.
      manualCalculado[col] = manual > 0 ? manual : 0;
    });

    manualMap.set(numCta, manualCalculado);
  }

  return manualMap;
};

const actualizarCuentasPadre = async (
  empresaId,
  anio,
  tablaPresup,
  presupuestosEditados = new Map(),
  manualBaseMap = null,
  borradorId = null,
  opciones = {}
) => {
  const { ejecutarConsulta } = require("./firebirdService");
  const { usarManual = true } = opciones || {};
  console.log(`\n📊 ============================================`);
  console.log(`📊 Actualizando cuentas padre en ${tablaPresup}...`);
  console.log(`📊 Empresa: ${empresaId}, Año: ${anio}`);
  console.log(`📊 ============================================\n`);
  
  const tablaCuentas = `CUENTAS${anio.toString().slice(-2).padStart(2, '0')}`;
  
  // Obtener todas las cuentas que funcionan como padre (tienen hijas directas).
  const queryCuentasPadre = `
    SELECT DISTINCT p.NUM_CTA, p.CTA_PAPA, p.NIVEL, p.NOMBRE, p.TIPO
    FROM ${tablaCuentas} h
    JOIN ${tablaCuentas} p
      ON TRIM(p.NUM_CTA) = TRIM(h.CTA_PAPA)
    WHERE h.STATUS = 'A'
      AND p.STATUS = 'A'
      AND TRIM(h.CTA_PAPA) <> ''
    ORDER BY p.NIVEL DESC, p.NUM_CTA
  `;
  
  console.log(`🔍 Buscando cuentas padre (con hijas) en ${tablaCuentas}...`);
  const cuentasPadre = await ejecutarConsulta(empresaId, queryCuentasPadre, []);
  
  if (!cuentasPadre || cuentasPadre.length === 0) {
    console.log(`⚠️ No se encontraron cuentas padre (con hijas) en ${tablaCuentas}`);
    console.log(`⚠️ Verificar que existan cuentas con CTA_PAPA y STATUS='A'`);
    finalizarProgresoRecontabilizacion(borradorId, "sin-datos");
    return;
  }
  
  console.log(`✅ Se encontraron ${cuentasPadre.length} cuentas padre (con hijas)`);
  console.log(`📋 Procesando de nivel más profundo a más superficial...\n`);
  
  let contadorActualizadas = 0;
  let contadorSinHijas = 0;
  let contadorSinValores = 0;
  let contadorProcesadas = 0;
  let contadorEditadasManualmente = 0;
  actualizarProgresoRecontabilizacion(borradorId, {
    estado: "recontabilizando",
    total: cuentasPadre.length,
    actual: 0,
    inicioRecontabilizacion: new Date().toISOString(),
  });
  
  // Procesar de nivel más profundo a más superficial para calcular correctamente la jerarquía
  for (const cuentaPadre of cuentasPadre) {
    const numCta = cuentaPadre.NUM_CTA.trim();
    const nivel = cuentaPadre.NIVEL;
    const nombre = (cuentaPadre.NOMBRE || '').trim();
    
    console.log(`\n  🔹 Procesando cuenta padre: ${numCta}`);
    console.log(`     Nombre: ${nombre}`);
    console.log(`     Nivel: ${nivel}`);
    
    // ✅ RESPETAR CAPTURA MANUAL EN CUENTAS PADRE (ADITIVO)
    // Si el usuario capturó un valor manual en la cuenta padre, se interpreta como "manual adicional"
    // y se SUMA a la suma de hijas (en vez de anular el recálculo).
    // Esto garantiza: padre = SUM(hijas) + manual.
    const fueEditadaManualmente =
      presupuestosEditados instanceof Map && presupuestosEditados.has(numCta);
    if (fueEditadaManualmente) {
      contadorEditadasManualmente++;
      console.log(
        `     🔒 Cuenta con captura manual - se conservará como manual adicional (se suma al recálculo)`
      );
    }
    
    // Obtener todas las cuentas hijas directas (donde CTA_PAPA = numCta)
    const queryHijas = `
      SELECT 
        h.NUM_CTA,
        h.NOMBRE,
        h.TIPO,
        h.NIVEL,
        h.CTA_PAPA,
        p.PRESUP01, p.PRESUP02, p.PRESUP03, p.PRESUP04, p.PRESUP05, p.PRESUP06,
        p.PRESUP07, p.PRESUP08, p.PRESUP09, p.PRESUP10, p.PRESUP11, p.PRESUP12
      FROM ${tablaCuentas} h
      LEFT JOIN ${tablaPresup} p ON p.NUM_CTA = h.NUM_CTA AND p.EJERCICIO = ?
      WHERE h.STATUS = 'A' 
        AND TRIM(h.CTA_PAPA) = ?
    `;
    
    const cuentasHijas = await ejecutarConsulta(empresaId, queryHijas, [anio, numCta]);
    
    console.log(`     → Cuentas hijas encontradas: ${cuentasHijas ? cuentasHijas.length : 0}`);
    
    console.log(`     → Cuentas hijas encontradas: ${cuentasHijas ? cuentasHijas.length : 0}`);
    
    if (!cuentasHijas || cuentasHijas.length === 0) {
      console.log(`     ⚠️ Esta cuenta padre no tiene hijas (o CTA_PAPA no coincide)`);
      contadorSinHijas++;
      contadorProcesadas++;
      actualizarProgresoRecontabilizacion(borradorId, {
        actual: contadorProcesadas,
      });
      continue;
    }
    
    // Mostrar las hijas encontradas
    cuentasHijas.forEach(hija => {
      const hijaNombre = (hija.NOMBRE || '').trim().substring(0, 40);
      console.log(`        • ${hija.NUM_CTA} - ${hijaNombre} (Nivel ${hija.NIVEL}, TIPO=${hija.TIPO})`);
    });
    
    // Calcular suma de presupuestos por mes (hijas)
    const sumasMensuales = {
      PRESUP01: 0, PRESUP02: 0, PRESUP03: 0, PRESUP04: 0, 
      PRESUP05: 0, PRESUP06: 0, PRESUP07: 0, PRESUP08: 0,
      PRESUP09: 0, PRESUP10: 0, PRESUP11: 0, PRESUP12: 0
    };
    
    cuentasHijas.forEach(hija => {
      for (let mes = 1; mes <= 12; mes++) {
        const col = `PRESUP${mes.toString().padStart(2, '0')}`;
        const valor = Number(hija[col]) || 0;
        sumasMensuales[col] += valor;
      }
    });

    if (usarManual) {
      const manualEditado = presupuestosEditados instanceof Map
        ? presupuestosEditados.get(numCta)
        : (presupuestosEditados || {})[numCta];

      const manualPrecalculado = manualBaseMap instanceof Map
        ? manualBaseMap.get(numCta)
        : null;

      let manualCalculado = manualPrecalculado;

      if (!manualCalculado) {
        // Obtener presupuesto actual del padre para conservar la parte manual
        const queryPadrePresup = `
          SELECT 
            PRESUP01, PRESUP02, PRESUP03, PRESUP04, PRESUP05, PRESUP06,
            PRESUP07, PRESUP08, PRESUP09, PRESUP10, PRESUP11, PRESUP12
          FROM ${tablaPresup}
          WHERE NUM_CTA = ? AND EJERCICIO = ?
        `;
        const padrePresupRows = await ejecutarConsulta(empresaId, queryPadrePresup, [numCta, anio]);
        const padrePresup = padrePresupRows && padrePresupRows[0] ? padrePresupRows[0] : null;

        manualCalculado = {};
        Object.keys(sumasMensuales).forEach((col) => {
          if (!padrePresup) {
            manualCalculado[col] = 0;
            return;
          }
          const actual = Number(padrePresup[col]) || 0;
          const manual = actual - sumasMensuales[col];
          // Manual es ADITIVO: no permitir que reste a la suma de hijas.
          manualCalculado[col] = manual > 0 ? manual : 0;
        });
      }

      Object.keys(sumasMensuales).forEach((col) => {
        const valorManual = manualEditado && Object.prototype.hasOwnProperty.call(manualEditado, col)
          ? Number(manualEditado[col]) || 0
          : Number(manualCalculado[col]) || 0;
        sumasMensuales[col] += valorManual;
      });
      console.log(`     ➕ Presupuesto manual agregado a ${numCta}`);
    
    } else {
      console.log(`     Presupuesto manual omitido para ${numCta}`);
    }

    // Verificar si hay valores para actualizar
    const tieneValores = Object.values(sumasMensuales).some((val) => val !== 0);
    
    if (!tieneValores) {
      console.log(`     ⚠️ Las cuentas hijas no tienen presupuestos (todos en cero)`);
      contadorSinValores++;
    }
    
    // Mostrar totales calculados
    const totalAnual = Object.values(sumasMensuales).reduce((sum, val) => sum + val, 0);
    console.log(`     💰 Total anual calculado: ${totalAnual.toFixed(2)}`);
    console.log(`     💰 Enero (PRESUP01): ${sumasMensuales.PRESUP01.toFixed(2)}`);
    
    // Actualizar o insertar la cuenta padre con las sumas
    const columnas = ["NUM_CTA", "EJERCICIO", 
      "PRESUP01", "PRESUP02", "PRESUP03", "PRESUP04", "PRESUP05", "PRESUP06",
      "PRESUP07", "PRESUP08", "PRESUP09", "PRESUP10", "PRESUP11", "PRESUP12"
    ];
    
    const valores = [
      numCta, anio,
      sumasMensuales.PRESUP01, sumasMensuales.PRESUP02, sumasMensuales.PRESUP03,
      sumasMensuales.PRESUP04, sumasMensuales.PRESUP05, sumasMensuales.PRESUP06,
      sumasMensuales.PRESUP07, sumasMensuales.PRESUP08, sumasMensuales.PRESUP09,
      sumasMensuales.PRESUP10, sumasMensuales.PRESUP11, sumasMensuales.PRESUP12
    ];
    
    const placeholders = columnas.map(() => "?").join(", ");
    
    const updateQuery = `
      UPDATE OR INSERT INTO ${tablaPresup} (${columnas.join(", ")})
      VALUES (${placeholders})
      MATCHING (NUM_CTA, EJERCICIO)
    `;
    
    try {
      await ejecutarConsulta(empresaId, updateQuery, valores);
      contadorActualizadas++;
      console.log(`     ✅ Cuenta padre actualizada exitosamente`);
    } catch (error) {
      console.error(`     ❌ Error actualizando cuenta padre ${numCta}:`, error.message);
    }
    contadorProcesadas++;
    actualizarProgresoRecontabilizacion(borradorId, {
      actual: contadorProcesadas,
    });
  }
  
  console.log(`\n📊 ============================================`);
  console.log(`📊 RESUMEN DE ACTUALIZACIÓN:`);
  console.log(`   ✅ Actualizadas (recalculadas): ${contadorActualizadas}`);
  console.log(`   🔒 Editadas manualmente (respetadas): ${contadorEditadasManualmente}`);
  console.log(`   ⚠️ Sin hijas: ${contadorSinHijas}`);
  console.log(`   ⚠️ Sin valores: ${contadorSinValores}`);
  console.log(`   📊 Total procesadas: ${cuentasPadre.length}`);
  console.log(`📊 ============================================\n`);
  finalizarProgresoRecontabilizacion(borradorId, "completado");
};

const FINALIZADORES = {
  PRESUPUESTOS: persistirEnFirebird,
};

const obtenerFinalizador = (modulo) => {
  const clave = (modulo || "").toString().trim().toUpperCase();
  return FINALIZADORES[clave] || persistirEnFirebird;
};

const eliminarBorrador = (empresaId, modulo, anio, capitulo, usuarioId) => {
  if (!empresaId || !modulo || !Number.isInteger(Number(anio))) {
    throw new Error("Contexto incompleto para descartar.");
  }
  const existente = obtenerBorrador({ empresaId, modulo, anio, capitulo: capitulo || 'DEFAULT' });
  if (!existente) {
    return null;
  }
  db.prepare(
    "DELETE FROM PLAN_BORRADORES WHERE empresaId = ? AND modulo = ? AND anio = ? AND capitulo = ?"
  ).run(empresaId, modulo, anio, capitulo || 'DEFAULT');
  registrarEventoHistorial({
    borradorId: existente.id,
    empresaId,
    modulo,
    anio,
    capitulo: capitulo || 'DEFAULT',
    estado: existente.estado,
    accion: HISTORIAL_ACCIONES.DESCARTAR.clave,
    descripcion: "Descartó el borrador en edición",
    usuarioId,
  });
  return existente;
};

const obtenerBorrador = ({ empresaId, modulo, anio, capitulo = 'DEFAULT' }) => {
  try {
    console.log("[obtenerBorrador] called with:", { empresaId, modulo, anio, capitulo });
    const estadosValidos = [
      ESTADOS.EDITANDO,
      ESTADOS.PENDIENTE,
      ESTADOS.RECHAZADO,
      ESTADOS.REVISADO,
      ESTADOS.APROBADO,
    ];
    const placeholders = estadosValidos.map(() => "?").join(",");
    const query = `
      SELECT *
      FROM PLAN_BORRADORES
      WHERE empresaId = ? AND modulo = ? AND anio = ? AND capitulo = ?
        AND estado IN (${placeholders})
      ORDER BY fechaEnvio DESC NULLS LAST, id DESC
      LIMIT 1
    `;
    const fila = db
      .prepare(query)
      .get(empresaId, modulo, anio, capitulo || 'DEFAULT', ...estadosValidos);
    console.log(
      "[obtenerBorrador] result:",
      fila ? `found id=${fila.id}, estado=${fila.estado}, capitulo=${fila.capitulo}` : "null"
    );
    return mapearFila(fila);
  } catch (err) {
    console.error("[obtenerBorrador] error:", err.message, err.stack);
    throw err;
  }
};

const guardarBorrador = (contexto, datos) => {
  const cfg = normalizarContexto(contexto);
  const contenido =
    typeof datos === "string" ? datos : JSON.stringify(datos || {});
  const resumenCambios = resumirCambiosBorrador(datos);
  const existente = db
    .prepare(
      `
    SELECT id
    FROM PLAN_BORRADORES
    WHERE empresaId = ? AND modulo = ? AND anio = ? AND capitulo = ?
  `
    )
    .get(cfg.empresaId, cfg.modulo, cfg.anio, cfg.capitulo);

  if (existente) {
    db.prepare(
      `
      UPDATE PLAN_BORRADORES
      SET data = ?, estado = ?, fechaEnvio = NULL, comentarios = NULL, usuarioId = ?
      WHERE id = ?
    `
    ).run(contenido, ESTADOS.EDITANDO, cfg.usuarioId, existente.id);
    const actualizado = obtenerBorradorPorId(existente.id);
    registrarEventoHistorial({
      borradorId: actualizado.id,
      empresaId: actualizado.empresaId,
      modulo: actualizado.modulo,
      anio: actualizado.anio,
      capitulo: actualizado.capitulo,
      estado: actualizado.estado,
      accion: HISTORIAL_ACCIONES.GUARDAR_BORRADOR.clave,
      descripcion: "Guardó cambios para continuar editando",
      comentarios: resumenCambios,
      usuarioId: cfg.usuarioId,
    });
    return actualizado;
  }

  const resultado = db
    .prepare(
      `
    INSERT INTO PLAN_BORRADORES (empresaId, anio, modulo, capitulo, usuarioId, data, estado, comentarios)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `
    )
    .run(
      cfg.empresaId,
      cfg.anio,
      cfg.modulo,
      cfg.capitulo,
      cfg.usuarioId,
      contenido,
      ESTADOS.EDITANDO,
      cfg.comentarios
    );

  const nuevo = obtenerBorradorPorId(resultado.lastInsertRowid);
  registrarEventoHistorial({
    borradorId: nuevo.id,
    empresaId: nuevo.empresaId,
    modulo: nuevo.modulo,
    anio: nuevo.anio,
    capitulo: nuevo.capitulo,
    estado: nuevo.estado,
    accion: HISTORIAL_ACCIONES.GUARDAR_BORRADOR.clave,
    descripcion: "Creó un nuevo borrador",
    comentarios: resumenCambios,
    usuarioId: cfg.usuarioId,
  });
  return nuevo;
};

const enviarRevision = async (borradorId, usuarioRol, usuarioId) => {
  const borrador = obtenerBorradorPorId(borradorId);
  if (!borrador) {
    throw new Error("Borrador no encontrado.");
  }

  if (usuarioRol === "ADMIN_GLOBAL") {
    db.prepare(
      `
      UPDATE PLAN_BORRADORES
      SET estado = ?, fechaEnvio = CURRENT_TIMESTAMP
      WHERE id = ?
    `
    ).run(ESTADOS.APROBADO, borradorId);
    const actualizado = obtenerBorradorPorId(borradorId);
    registrarEventoHistorial({
      borradorId,
      empresaId: actualizado.empresaId,
      modulo: actualizado.modulo,
      anio: actualizado.anio,
      capitulo: actualizado.capitulo,
      estado: actualizado.estado,
      accion: HISTORIAL_ACCIONES.AUTO_AUTORIZAR.clave,
      descripcion: "Autorización automática por administrador global",
      usuarioId,
    });
    return { autoAutorizado: true, borrador: actualizado };
  }

  db.prepare(
    `
    UPDATE PLAN_BORRADORES
    SET estado = ?, fechaEnvio = CURRENT_TIMESTAMP
    WHERE id = ?
  `
  ).run(ESTADOS.PENDIENTE, borradorId);

  const actualizado = obtenerBorradorPorId(borradorId);
  registrarEventoHistorial({
    borradorId,
    empresaId: actualizado.empresaId,
    modulo: actualizado.modulo,
    anio: actualizado.anio,
    capitulo: actualizado.capitulo,
    estado: actualizado.estado,
    accion: HISTORIAL_ACCIONES.ENVIAR_REVISION.clave,
    descripcion: "Envió el borrador a revisión",
    usuarioId,
  });
  return { autoAutorizado: false, borrador: actualizado };
};

const marcarRevisado = (borradorId, cancelar = false, usuarioId) => {
  const borrador = obtenerBorradorPorId(borradorId);
  if (!borrador) {
    throw new Error("Borrador no encontrado.");
  }
  const destino = cancelar ? ESTADOS.EDITANDO : ESTADOS.REVISADO;
  db.prepare(
    `
    UPDATE PLAN_BORRADORES
    SET estado = ?, comentarios = NULL
    WHERE id = ?
  `
  ).run(destino, borradorId);
  const actualizado = obtenerBorradorPorId(borradorId);
  registrarEventoHistorial({
    borradorId,
    empresaId: actualizado.empresaId,
    modulo: actualizado.modulo,
    anio: actualizado.anio,
    capitulo: actualizado.capitulo,
    estado: actualizado.estado,
    accion: cancelar
      ? HISTORIAL_ACCIONES.CANCELAR_REVISION.clave
      : HISTORIAL_ACCIONES.MARCAR_REVISADO.clave,
    descripcion: cancelar
      ? "Canceló la revisión y devolvió a edición"
      : "Marcó el borrador como revisado",
    usuarioId,
  });
  return actualizado;
};

const autorizarBorrador = async (borradorId, usuarioId) => {
  const borrador = obtenerBorradorPorId(borradorId);
  if (!borrador) {
    throw new Error("Borrador no encontrado.");
  }

  if (![ESTADOS.REVISADO, ESTADOS.APROBADO].includes(borrador.estado)) {
    throw new Error("El borrador debe estar revisado antes de autorizar.");
  }

  db.prepare(
    `
    UPDATE PLAN_BORRADORES
    SET estado = ?, fechaEnvio = CURRENT_TIMESTAMP
    WHERE id = ?
  `
  ).run(ESTADOS.APROBADO, borradorId);

  const actualizado = obtenerBorradorPorId(borradorId);
  registrarEventoHistorial({
    borradorId,
    empresaId: actualizado.empresaId,
    modulo: actualizado.modulo,
    anio: actualizado.anio,
    capitulo: actualizado.capitulo,
    estado: actualizado.estado,
    accion: HISTORIAL_ACCIONES.AUTORIZAR.clave,
    descripcion: "Autorizó el borrador",
    usuarioId,
  });
  return actualizado;
};

const rechazarBorrador = (borradorId, motivo, usuarioId) => {
  const borrador = obtenerBorradorPorId(borradorId);
  if (!borrador) {
    throw new Error("Borrador no encontrado.");
  }

  db.prepare(
    `
    UPDATE PLAN_BORRADORES
    SET estado = ?, comentarios = ?, fechaEnvio = CURRENT_TIMESTAMP
    WHERE id = ?
  `
  ).run(ESTADOS.RECHAZADO, motivo || null, borradorId);

  const actualizado = obtenerBorradorPorId(borradorId);
  registrarEventoHistorial({
    borradorId,
    empresaId: actualizado.empresaId,
    modulo: actualizado.modulo,
    anio: actualizado.anio,
    capitulo: actualizado.capitulo,
    estado: actualizado.estado,
    accion: HISTORIAL_ACCIONES.RECHAZAR.clave,
    descripcion: "Rechazó el borrador",
    comentarios: motivo || "",
    usuarioId,
  });
  return actualizado;
};

const guardarAutorizado = async (borradorId, usuarioId) => {
  const key = String(borradorId);
  const existente = guardadoCoiEnCurso.get(key);
  if (existente) {
    return await existente;
  }

  const operacion = (async () => {
    const borrador = obtenerBorradorPorId(borradorId);
    if (!borrador) {
      throw new Error("Borrador no encontrado.");
    }
    if (borrador.estado !== ESTADOS.APROBADO) {
      throw new Error("El borrador debe estar autorizado antes de guardar.");
    }
    const resumenCambios = resumirCambiosBorrador(borrador.data);
    iniciarProgresoRecontabilizacion(borradorId, {
      empresaId: borrador.empresaId,
      anio: borrador.anio,
    });
    const finalizador = obtenerFinalizador(borrador.modulo);
    const tarea = async () => {
      actualizarProgresoRecontabilizacion(borradorId, {
        estado: "guardando",
        inicioTrabajo: new Date().toISOString(),
        total: 0,
        actual: 0,
        porcentaje: 0,
      });
      try {
        if (finalizador) {
          await finalizador(borrador);
        }
        finalizarProgresoRecontabilizacion(borradorId, "completado");
      } catch (error) {
        actualizarProgresoRecontabilizacion(borradorId, {
          estado: "error",
          errorMensaje:
            error?.message || "No fue posible completar la operación.",
        });
        finalizarProgresoRecontabilizacion(borradorId, "error");
        throw error;
      }
    };
    const { ejecucion } = encolarRecontabilizacion(
      { empresaId: borrador.empresaId, anio: borrador.anio, borradorId },
      tarea
    );
    await ejecucion;
    db.prepare(
      `
      UPDATE PLAN_BORRADORES
      SET estado = ?, fechaEnvio = CURRENT_TIMESTAMP
      WHERE id = ?
    `
    ).run(ESTADOS.GUARDADO, borradorId);
    const actualizado = obtenerBorradorPorId(borradorId);
    if (actualizado) {
      registrarEventoHistorial({
        borradorId,
        empresaId: actualizado.empresaId,
        modulo: actualizado.modulo,
        anio: actualizado.anio,
        capitulo: actualizado.capitulo,
        estado: actualizado.estado,
        accion: HISTORIAL_ACCIONES.GUARDAR_COI.clave,
        descripcion: "Guardó la versión autorizada en COI",
        comentarios: resumenCambios,
        usuarioId,
      });
    } else {
      console.warn(
        "No fue posible registrar historial tras guardado en COI: borrador ya no existe.",
        { borradorId }
      );
    }
    // Remove the draft from the table as it was persisted in COI
    try {
      db.prepare(`DELETE FROM PLAN_BORRADORES WHERE id = ?`).run(borradorId);
    } catch (err) {
      console.warn("No fue posible eliminar borrador tras guardado en COI:", err);
    }
    // Return a snapshot-like response to the client (the object with estado = GUARDADO)
    const snapshot = {
      ...(actualizado || { ...borrador, estado: ESTADOS.GUARDADO }),
      eliminado: true,
    };
    return snapshot;
  })();

  guardadoCoiEnCurso.set(key, operacion);
  try {
    return await operacion;
  } finally {
    if (guardadoCoiEnCurso.get(key) === operacion) {
      guardadoCoiEnCurso.delete(key);
    }
  }
};

/**
 * Recontabilizar TODAS las cuentas para una empresa y año
 * Se ejecuta al iniciar la app para asegurar integridad
 */
const recontabilizarTodasLasCuentas = async ({ empresaId, anio }) => {
  const { ejecutarConsulta } = require("./firebirdService");

  console.log(`\n🔄 ==========================================`);
  console.log(`🔄 RECONTABILIZACIÓN COMPLETA INICIADA`);
  console.log(`🔄 Empresa: ${empresaId}, Año: ${anio}`);
  console.log(`🔄 ==========================================\n`);

  const sufijo = anio.toString().slice(-2).padStart(2, "0");
  const tablaPresup = `PRESUP${sufijo}`;
  const tablaCuentas = `CUENTAS${sufijo}`;

  // Calcular base manual de cuentas padre ANTES de recontabilizar
  let manualBaseMap = null;
  try {
    console.log(`📊 Calculando base manual de cuentas padre...`);
    manualBaseMap = await calcularManualPadres(empresaId, anio, tablaPresup);
    console.log(`✅ Base manual calculada para ${manualBaseMap.size} cuentas padre\n`);
  } catch (manualError) {
    console.warn(`⚠️ No se pudo calcular base manual:`, manualError.message);
  }

  // Actualizar cuentas padre con presupuestos vacíos (forzar recálculo)
  await actualizarCuentasPadre(
    empresaId,
    anio,
    tablaPresup,
    new Map(), // Sin ediciones - solo suma de hijas
    manualBaseMap,
    null, // Sin borradorId
    { usarManual: true }
  );

  console.log(`\n✅ ==========================================`);
  console.log(`✅ RECONTABILIZACIÓN COMPLETADA`);
  console.log(`✅ Empresa: ${empresaId}, Año: ${anio}`);
  console.log(`✅ Todas las cuentas han sido recontabilizadas`);
  console.log(`✅ ==========================================\n`);
};

/**
 * Recontabilizar todas las empresas para un año
 */
const recontabilizarTodasLasEmpresas = async (anio) => {
  const { EMPRESAS } = require("../config/empresas");

  console.log(`\n🌐 ==========================================`);
  console.log(`🌐 RECONTABILIZACIÓN GLOBAL - AÑO ${anio}`);
  console.log(`🌐 Procesando ${EMPRESAS.length} empresas...`);
  console.log(`🌐 ==========================================\n`);

  const resultados = [];

  for (const empresa of EMPRESAS) {
    try {
      console.log(`\n🏢 Procesando: ${empresa.id} (${empresa.nombre})...`);
      await recontabilizarTodasLasCuentas({
        empresaId: empresa.id,
        anio: anio
      });
      resultados.push({
        empresaId: empresa.id,
        nombre: empresa.nombre,
        exito: true
      });
      console.log(`✅ ${empresa.id} completada\n`);
    } catch (error) {
      console.error(`❌ Error en ${empresa.id}:`, error.message);
      resultados.push({
        empresaId: empresa.id,
        nombre: empresa.nombre,
        exito: false,
        error: error.message
      });
    }
  }

  const exitosas = resultados.filter(r => r.exito).length;
  const fallidas = resultados.filter(r => !r.exito).length;

  console.log(`\n🌐 ==========================================`);
  console.log(`🌐 RECONTABILIZACIÓN GLOBAL COMPLETADA`);
  console.log(`   ✅ Exitosas: ${exitosas}`);
  console.log(`   ❌ Fallidas: ${fallidas}`);
  console.log(`🌐 ==========================================\n`);

  return resultados;
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
  obtenerProgresoRecontabilizacion,
  actualizarCuentasPadre,
  recontabilizarTodasLasCuentas,
  recontabilizarTodasLasEmpresas,
  ESTADOS,
  HISTORIAL_ACCIONES,
};
