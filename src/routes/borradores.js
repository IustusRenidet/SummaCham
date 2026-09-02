const express = require("express");
const Joi = require("joi");
const { db } = require("../db/sqlite");
const { obtenerEmpresaPorId } = require("../config/empresas");
const { MODULOS, normalizarNombreModulo } = require("../config/modulos");
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
  listarHistorialBorradores,
  obtenerFiltrosHistorial,
  obtenerProgresoRecontabilizacion,
  ESTADOS,
  eliminarBorrador,
  recontabilizarTodasLasCuentas,
  recontabilizarTodasLasEmpresas,
} = require("../services/borradoresService");
const {
  notificarWorkflowPresupuesto,
} = require("../services/notificacionesService");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

const obtenerModuloCanonico = (valor) => {
  if (!valor) return null;
  // Usar normalización de modulos.js
  const normalizado = normalizarNombreModulo(valor);
  return MODULOS.includes(normalizado) ? normalizado : null;
};

const resolverEmpresaId = (req) => {
  if (!req) return null;
  return (
    req.headers["x-empresa-activa"] ||
    (req.body && req.body.empresaId) ||
    (req.query && req.query.empresaId) ||
    null
  );
};

const tienePermisoEnModulo = (mapaPermisos, empresaId, modulo, accion) => {
  const permisos =
    mapaPermisos && mapaPermisos[empresaId] && mapaPermisos[empresaId][modulo];
  if (!permisos) {
    return false;
  }
  if (!accion) {
    return Object.values(permisos).some(Boolean);
  }
  return Boolean(permisos[accion]);
};

const obtenerBloqueoGuardadoCoi = (borradorId) => {
  if (!borradorId) return null;
  const progreso = obtenerProgresoRecontabilizacion(borradorId);
  if (!progreso) return null;
  if (progreso.finalizadoEn) return null;
  return progreso;
};

const esquemaContexto = Joi.object({
  empresaId: Joi.string().trim().required(),
  modulo: Joi.string().trim().required(),
  anio: Joi.number().integer().min(2000).max(2100).required(),
  capitulo: Joi.string().trim().default('DEFAULT'),
});

const esquemaGuardar = esquemaContexto.keys({
  datos: Joi.any().required(),
});

const esquemaBorradorId = Joi.object({
  borradorId: Joi.number().integer().required(),
});

const esquemaRechazo = esquemaBorradorId.keys({
  motivo: Joi.string().trim().allow("").optional(),
});

const esquemaRevision = esquemaBorradorId.keys({
  cancelar: Joi.boolean().default(false),
});

const esquemaFinalizar = esquemaBorradorId;

const esquemaListado = Joi.object({
  empresaId: Joi.string().trim().required(),
  modulo: Joi.string().trim().required(),
  anio: Joi.number().integer().min(2000).max(2100).optional(),
  capitulo: Joi.string().trim().optional(),
  estado: Joi.string()
    .valid(...Object.values(ESTADOS))
    .optional(),
});

const esquemaDescartar = Joi.object({
  empresaId: Joi.string().trim().optional(),
  modulo: Joi.string().trim().optional(),
  anio: Joi.number().integer().min(2000).max(2100).optional(),
  capitulo: Joi.string().trim().optional(),
  borradorId: Joi.number().integer().optional(),
}).or("borradorId", "empresaId");

const resetearEstadoPresupuesto = (empresaId, modulo, anio, capitulo, usuarioId) => {
  if (!empresaId || !modulo || !Number.isInteger(Number(anio))) return;
  db.prepare(
    `
    INSERT INTO presupuestos_estado (empresa_id, modulo, anio, capitulo, estado, actualizado_por, actualizado_en)
    VALUES (?, ?, ?, ?, 'sin-cargar', ?, CURRENT_TIMESTAMP)
    ON CONFLICT(empresa_id, modulo, anio, capitulo) DO UPDATE SET
      estado = 'sin-cargar',
      actualizado_por = excluded.actualizado_por,
      actualizado_en = CURRENT_TIMESTAMP
  `
  ).run(empresaId, modulo, Number(anio), capitulo || 'DEFAULT', usuarioId || null);
};

const esquemaHistorial = Joi.object({
  empresaId: Joi.string().trim().optional(),
  modulo: Joi.string().trim().optional(),
  anio: Joi.number().integer().min(2000).max(2100).optional(),
  estado: Joi.string().trim().optional(),
  accion: Joi.string().trim().optional(),
  usuarioId: Joi.number().integer().optional(),
  buscar: Joi.string().trim().allow("").optional(),
  desde: Joi.date().iso().optional(),
  hasta: Joi.date().iso().optional(),
  limite: Joi.number().integer().min(1).max(500).optional(),
});

const esquemaDetalle = Joi.object({
  id: Joi.number().integer().required(),
});

const ROLES_VISIBILIDAD = {
  EDITANDO: ["autor"],
  PENDIENTE: ["autor", "revision"],
  RECHAZADO: ["autor", "revision"],
  REVISADO: ["autor", "autorizar"],
  APROBADO: ["autor", "guardar"],
  GUARDADO: ["autor", "revision", "autorizar", "guardar"],
};

const tienePermisoRol = (permisos = {}, rol) => {
  switch (rol) {
    case "revision":
      return Boolean(permisos.Revisar);
    case "autorizar":
      return Boolean(permisos.Aprobar);
    case "guardar":
      return Boolean(permisos["Cargar y guardar"]);
    case "lectura":
      return Boolean(permisos.Ver || permisos.Lectura);
    default:
      return false;
  }
};

const puedeVerBorrador = (req, borrador) => {
  if (!borrador) return false;
  if (req.esAdmin) return true;
  const esAutor = String(borrador.usuarioId) === String(req.usuarioActual.id);
  if (esAutor) return true;
  const permisos = req.mapaPermisos?.[borrador.empresaId]?.[borrador.modulo];
  if (!permisos) return false;
  const roles = ROLES_VISIBILIDAD[borrador.estado] || [];
  return roles.some((rol) => {
    if (rol === "autor") return false;
    return tienePermisoRol(permisos, rol);
  });
};

router.get("/listar", (req, res) => {
  const merged = {
    ...req.query,
  };
  if (!merged.empresaId) {
    merged.empresaId = resolverEmpresaId(req);
  }
  const { value, error } = esquemaListado.validate(merged, {
    abortEarly: false,
  });
  if (error) {
    return res.status(400).json({
      mensaje: "Verifica los parámetros del listado.",
      detalles: error.details.map((detalle) => detalle.message),
    });
  }

  const empresa = obtenerEmpresaPorId(value.empresaId);
  if (!empresa) {
    return res.status(404).json({ mensaje: "Empresa no encontrada." });
  }

  const modulo = obtenerModuloCanonico(value.modulo);
  if (!modulo) {
    return res
      .status(400)
      .json({ mensaje: "El módulo indicado no es válido." });
  }

  if (
    !req.esAdmin &&
    !tienePermisoEnModulo(req.mapaPermisos, empresa.id, modulo)
  ) {
    return res
      .status(403)
      .json({ mensaje: "No cuentas con permisos en este módulo." });
  }

  const borradores = listarBorradores({
    empresaId: empresa.id,
    modulo,
    anio: value.anio,
    capitulo: value.capitulo,
    estado: value.estado,
  }).filter((borrador) => puedeVerBorrador(req, borrador));

  return res.json({ borradores });
});

router.get("/historial", (req, res) => {
  const merged = { ...req.query };
  if (!merged.empresaId) {
    merged.empresaId = resolverEmpresaId(req);
  }
  const { value, error } = esquemaHistorial.validate(merged, {
    abortEarly: false,
  });
  if (error) {
    return res.status(400).json({
      mensaje: "Verifica los parámetros del historial.",
      detalles: error.details.map((detalle) => detalle.message),
    });
  }

  const empresa = value.empresaId ? obtenerEmpresaPorId(value.empresaId) : null;
  if (value.empresaId && !empresa) {
    return res.status(404).json({ mensaje: "Empresa no encontrada." });
  }

  let modulo = null;
  if (value.modulo) {
    modulo = obtenerModuloCanonico(value.modulo);
    if (!modulo) {
      return res
        .status(400)
        .json({ mensaje: "El módulo indicado no es válido." });
    }
  }

  if (!req.esAdmin) {
    if (!empresa) {
      return res.status(400).json({
        mensaje: "Debes indicar una empresa para consultar el historial.",
      });
    }
    if (modulo && !tienePermisoEnModulo(req.mapaPermisos, empresa.id, modulo)) {
      return res
        .status(403)
        .json({ mensaje: "No cuentas con permisos en este módulo." });
    }
    if (!modulo) {
      return res.status(400).json({
        mensaje: "Debes indicar el módulo para consultar el historial.",
      });
    }
  }

  const filtros = {
    empresaId: empresa?.id || null,
    modulo: modulo || null,
    anio: value.anio,
    estado: value.estado,
    accion: value.accion,
    usuarioId: value.usuarioId,
    buscar: value.buscar,
    desde: value.desde,
    hasta: value.hasta,
    limite: value.limite,
  };

  const historial = listarHistorialBorradores(filtros);
  const opciones = obtenerFiltrosHistorial({
    empresaId: filtros.empresaId,
    modulo: filtros.modulo,
    anio: filtros.anio,
  });

  return res.json({
    historial,
    filtros: opciones,
  });
});

router.get("/estado", (req, res) => {
  try {
    const empresaId = resolverEmpresaId(req);
    const { value, error } = esquemaContexto.validate(
      { ...req.query, empresaId },
      { abortEarly: false }
    );
    if (error) {
      return res.status(400).json({
        mensaje: "Verifica los parámetros de consulta.",
        detalles: error.details.map((detalle) => detalle.message),
      });
    }
    const empresa = obtenerEmpresaPorId(value.empresaId);
    if (!empresa) {
      return res
        .status(404)
        .json({ mensaje: "La empresa indicada no existe." });
    }
    const modulo = obtenerModuloCanonico(value.modulo);
    if (!modulo) {
      return res
        .status(400)
        .json({ mensaje: "El módulo indicado no es válido." });
    }
    if (
      !req.esAdmin &&
      !tienePermisoEnModulo(req.mapaPermisos, empresa.id, modulo)
    ) {
      return res
        .status(403)
        .json({ mensaje: "No cuentas con permisos en este módulo." });
    }

    console.debug("[borradores] GET /estado params:", {
      empresaId: value.empresaId,
      modulo: value.modulo,
      anio: value.anio,
      capitulo: value.capitulo,
      usuario: req.usuarioActual?.id,
    });

    const borrador = obtenerBorrador({
      empresaId: empresa.id,
      modulo,
      anio: value.anio,
      capitulo: value.capitulo || 'DEFAULT',
    });

    const progreso = borrador?.id
      ? obtenerProgresoRecontabilizacion(borrador.id)
      : null;
    return res.json({ borrador, progreso });
  } catch (err) {
    console.error("Error en GET /api/borradores/estado:", err);
    return res.status(500).json({
      mensaje: "Ocurrió un error inesperado al obtener el estado del borrador.",
    });
  }
});

// Resumen del estado de TODOS los módulos de un capítulo en una sola
// consulta -- para el quick view de la barra superior ("¿qué módulos tienen
// avance distinto de 'Sin cargar'?"). PLAN_BORRADORES solo guarda filas
// mientras hay trabajo en curso (EDITANDO/PENDIENTE/REVISADO/RECHAZADO/
// APROBADO); en cuanto se guarda en COI la fila se borra, así que listar
// lo que hay en la tabla ya excluye "Sin cargar" y "Guardado" por diseño.
// Sin filtro de año a propósito: un usuario puede tener trabajo en curso en
// el año actual Y en el siguiente (ej. cerrando 2026 mientras arma el
// presupuesto 2027) -- filtrar por "el año de hoy" escondía justo ese caso.
// Como estas filas son pocas por naturaleza (solo existen mientras hay
// trabajo pendiente), no hay volumen de datos que cuidar.
// El filtrado por permiso de módulo lo hace el cliente (ya tiene la lista
// de módulos visibles para el usuario); aquí solo se exige algún acceso a
// la empresa.
router.get("/estado/resumen", (req, res) => {
  try {
    const empresaId = resolverEmpresaId(req);
    if (!empresaId) {
      return res.status(400).json({ mensaje: "Debes indicar una empresa." });
    }
    const empresa = obtenerEmpresaPorId(empresaId);
    if (!empresa) {
      return res.status(404).json({ mensaje: "La empresa indicada no existe." });
    }
    if (!req.esAdmin && !req.mapaPermisos?.[empresa.id]) {
      return res.status(403).json({ mensaje: "No cuentas con permisos para consultar esta empresa." });
    }
    const borradores = listarBorradores({ empresaId: empresa.id });
    const estados = borradores.map((b) => ({
      modulo: b.modulo,
      capitulo: b.capitulo,
      anio: b.anio,
      estado: b.estado,
      actualizadoEn: b.fechaEnvio || b.fechaCreacion,
      actualizadoPor: b.autorNombre || b.autorUsuario || "",
    }));
    res.json({ estados });
  } catch (err) {
    console.error("Error en GET /api/borradores/estado/resumen:", err);
    res.status(500).json({
      mensaje: "Ocurrió un error inesperado al obtener el estado de los módulos.",
    });
  }
});

router.get("/detalle/:id", (req, res) => {
  const { value, error } = esquemaDetalle.validate(req.params, {
    abortEarly: false,
  });
  if (error) {
    return res.status(400).json({
      mensaje: "Identificador de borrador inválido.",
      detalles: error.details.map((detalle) => detalle.message),
    });
  }

  const borrador = obtenerBorradorPorId(value.id);
  if (!borrador) {
    return res.status(404).json({ mensaje: "Borrador no encontrado." });
  }

  const empresa = obtenerEmpresaPorId(borrador.empresaId);
  if (!empresa) {
    return res.status(404).json({ mensaje: "Empresa asociada no existe." });
  }

  if (!puedeVerBorrador(req, borrador)) {
    return res
      .status(403)
      .json({ mensaje: "No puedes consultar este borrador." });
  }

  return res.json({ borrador });
});

router.get("/progreso/:id", (req, res) => {
  const { value, error } = esquemaDetalle.validate(req.params, {
    abortEarly: false,
  });
  if (error) {
    return res.status(400).json({
      mensaje: "Identificador de borrador inválido.",
      detalles: error.details.map((detalle) => detalle.message),
    });
  }

  const borrador = obtenerBorradorPorId(value.id);
  if (!borrador) {
    return res.status(404).json({ mensaje: "Borrador no encontrado." });
  }

  const empresa = obtenerEmpresaPorId(borrador.empresaId);
  if (!empresa) {
    return res.status(404).json({ mensaje: "Empresa asociada no existe." });
  }

  if (!puedeVerBorrador(req, borrador)) {
    return res
      .status(403)
      .json({ mensaje: "No puedes consultar este borrador." });
  }

  const progreso = obtenerProgresoRecontabilizacion(value.id);
  return res.json({ progreso });
});

router.post("/guardar", async (req, res) => {
  const empresaId = resolverEmpresaId(req);
  const { value, error } = esquemaGuardar.validate(
    { ...req.body, empresaId },
    { abortEarly: false }
  );

  if (error) {
    return res.status(400).json({
      mensaje: "Verifica la información proporcionada.",
      detalles: error.details.map((detalle) => detalle.message),
    });
  }
  const empresa = obtenerEmpresaPorId(value.empresaId);
  if (!empresa) {
    return res.status(404).json({ mensaje: "La empresa indicada no existe." });
  }
  const modulo = obtenerModuloCanonico(value.modulo);
  if (!modulo) {
    return res
      .status(400)
      .json({ mensaje: "El módulo indicado no es válido." });
  }
  if (
    !req.esAdmin &&
    !tienePermisoEnModulo(
      req.mapaPermisos,
      empresa.id,
      modulo,
      "Cargar y guardar"
    )
  ) {
    return res
      .status(403)
      .json({ mensaje: "No cuentas con permisos para guardar este módulo." });
  }

  try {
    const capitulo = value.capitulo || 'DEFAULT';
    const borradorExistente = obtenerBorrador({
      empresaId: empresa.id,
      modulo,
      anio: value.anio,
      capitulo,
    });
    const bloqueo = borradorExistente?.id
      ? obtenerBloqueoGuardadoCoi(borradorExistente.id)
      : null;
    if (bloqueo) {
      return res.status(409).json({
        mensaje:
          "Este presupuesto está en proceso de guardado en COI. Espera a que finalice para editarlo.",
        progreso: bloqueo,
      });
    }
    const borrador = guardarBorrador(
      {
        empresaId: empresa.id,
        modulo,
        anio: value.anio,
        capitulo,
        usuarioId: req.usuarioActual.id,
      },
      value.datos
    );
    return res.json({ mensaje: "Borrador guardado.", borrador });
  } catch (errorGuardar) {
    console.error("Error al guardar borrador:", errorGuardar);
    return res
      .status(500)
      .json({ mensaje: "No fue posible guardar el borrador." });
  }
});

router.post("/enviar", async (req, res) => {
  const { value, error } = esquemaBorradorId.validate(req.body, {
    abortEarly: false,
  });
  if (error) {
    return res.status(400).json({
      mensaje: "Verifica el identificador del borrador.",
      detalles: error.details.map((detalle) => detalle.message),
    });
  }

  const borrador = obtenerBorradorPorId(value.borradorId);
  if (!borrador) {
    return res.status(404).json({ mensaje: "Borrador no encontrado." });
  }
  const bloqueo = obtenerBloqueoGuardadoCoi(borrador.id);
  if (bloqueo) {
    return res.status(409).json({
      mensaje:
        "Este presupuesto está en proceso de guardado en COI. Espera a que finalice para continuar con el flujo.",
      progreso: bloqueo,
    });
  }
  const empresa = obtenerEmpresaPorId(borrador.empresaId);
  if (!empresa) {
    return res
      .status(404)
      .json({ mensaje: "Empresa asociada al borrador no existe." });
  }
  if (
    !req.esAdmin &&
    !tienePermisoEnModulo(
      req.mapaPermisos,
      empresa.id,
      borrador.modulo,
      "Cargar y guardar"
    )
  ) {
    return res
      .status(403)
      .json({ mensaje: "No cuentas con permisos para enviar a revisión." });
  }

  try {
    const resultado = await enviarRevision(
      value.borradorId,
      req.esAdmin ? "ADMIN_GLOBAL" : "USUARIO",
      req.usuarioActual.id
    );
    
    // ✅ CORRECCIÓN: NO auto-guardar en COI al enviar
    // Solo cambiar estado a APROBADO si es admin, pero NO persistir en Firebird
    // El guardado en Firebird solo ocurre con el botón "Guardar en COI"
    
    notificarWorkflowPresupuesto({
      empresaId: empresa.id,
      modulo: borrador.modulo,
      anio: borrador.anio,
      accion: resultado.autoAutorizado ? "autorizar" : "enviar",
      estado: resultado.borrador?.estado,
      ejecutor: {
        id: req.usuarioActual.id,
        usuario: req.usuarioActual.usuario,
        nombre:
          `${req.usuarioActual.nombres || ""} ${
            req.usuarioActual.apellidos || ""
          }`.trim() || req.usuarioActual.usuario,
      },
    }).catch((notifError) =>
      console.warn(
        "No se enviaron todas las notificaciones de borradores.",
        notifError
      )
    );
    return res.json({
      mensaje: resultado.autoAutorizado
        ? "Presupuesto aprobado. Usa 'Guardar en COI' para insertar en la base de datos."
        : "Borrador enviado a revisión.",
      ...resultado,
    });
  } catch (errorEnviar) {
    console.error("Error al enviar borrador:", errorEnviar);
    return res
      .status(500)
      .json({ mensaje: "No fue posible enviar el borrador." });
  }
});

router.post("/autorizar", async (req, res) => {
  const { value, error } = esquemaBorradorId.validate(req.body, {
    abortEarly: false,
  });
  if (error) {
    return res.status(400).json({
      mensaje: "Verifica el identificador del borrador.",
      detalles: error.details.map((detalle) => detalle.message),
    });
  }

  const borrador = obtenerBorradorPorId(value.borradorId);
  if (!borrador) {
    return res.status(404).json({ mensaje: "Borrador no encontrado." });
  }
  const bloqueo = obtenerBloqueoGuardadoCoi(borrador.id);
  if (bloqueo) {
    return res.status(409).json({
      mensaje:
        "Este presupuesto está en proceso de guardado en COI. Espera a que finalice para continuar con el flujo.",
      progreso: bloqueo,
    });
  }
  const empresa = obtenerEmpresaPorId(borrador.empresaId);
  if (!empresa) {
    return res
      .status(404)
      .json({ mensaje: "Empresa asociada al borrador no existe." });
  }
  if (
    !req.esAdmin &&
    !tienePermisoEnModulo(
      req.mapaPermisos,
      empresa.id,
      borrador.modulo,
      "Aprobar"
    )
  ) {
    return res
      .status(403)
      .json({ mensaje: "No cuentas con permisos para autorizar borradores." });
  }

  try {
    const aprobado = await autorizarBorrador(
      value.borradorId,
      req.usuarioActual.id
    );
    notificarWorkflowPresupuesto({
      empresaId: empresa.id,
      modulo: borrador.modulo,
      anio: borrador.anio,
      accion: "autorizar",
      estado: aprobado.estado,
      ejecutor: {
        id: req.usuarioActual.id,
        usuario: req.usuarioActual.usuario,
        nombre:
          `${req.usuarioActual.nombres || ""} ${
            req.usuarioActual.apellidos || ""
          }`.trim() || req.usuarioActual.usuario,
      },
    }).catch((notifError) =>
      console.warn(
        "No se enviaron todas las notificaciones de borradores.",
        notifError
      )
    );
    return res.json({ mensaje: "Borrador autorizado.", borrador: aprobado });
  } catch (errorAutorizar) {
    console.error("Error al autorizar borrador:", errorAutorizar);
    return res
      .status(500)
      .json({ mensaje: "No fue posible autorizar el borrador." });
  }
});

router.post("/rechazar", (req, res) => {
  const { value, error } = esquemaRechazo.validate(req.body, {
    abortEarly: false,
  });
  if (error) {
    return res.status(400).json({
      mensaje: "Verifica los datos proporcionados.",
      detalles: error.details.map((detalle) => detalle.message),
    });
  }

  const borrador = obtenerBorradorPorId(value.borradorId);
  if (!borrador) {
    return res.status(404).json({ mensaje: "Borrador no encontrado." });
  }
  const bloqueo = obtenerBloqueoGuardadoCoi(borrador.id);
  if (bloqueo) {
    return res.status(409).json({
      mensaje:
        "Este presupuesto está en proceso de guardado en COI. Espera a que finalice para continuar con el flujo.",
      progreso: bloqueo,
    });
  }
  const empresa = obtenerEmpresaPorId(borrador.empresaId);
  if (!empresa) {
    return res
      .status(404)
      .json({ mensaje: "Empresa asociada al borrador no existe." });
  }
  if (
    !req.esAdmin &&
    !tienePermisoEnModulo(
      req.mapaPermisos,
      empresa.id,
      borrador.modulo,
      "Aprobar"
    )
  ) {
    return res
      .status(403)
      .json({ mensaje: "No cuentas con permisos para rechazar borradores." });
  }

  try {
    const rechazado = rechazarBorrador(
      value.borradorId,
      value.motivo,
      req.usuarioActual.id
    );
    notificarWorkflowPresupuesto({
      empresaId: empresa.id,
      modulo: borrador.modulo,
      anio: borrador.anio,
      accion: "rechazar",
      estado: rechazado.estado,
      ejecutor: {
        id: req.usuarioActual.id,
        usuario: req.usuarioActual.usuario,
        nombre:
          `${req.usuarioActual.nombres || ""} ${
            req.usuarioActual.apellidos || ""
          }`.trim() || req.usuarioActual.usuario,
      },
    }).catch((notifError) =>
      console.warn(
        "No se enviaron todas las notificaciones de borradores.",
        notifError
      )
    );
    return res.json({ mensaje: "Borrador rechazado.", borrador: rechazado });
  } catch (errorRechazar) {
    console.error("Error al rechazar borrador:", errorRechazar);
    return res
      .status(500)
      .json({ mensaje: "No fue posible rechazar el borrador." });
  }
});

router.post("/revisar", (req, res) => {
  const { value, error } = esquemaRevision.validate(req.body, {
    abortEarly: false,
  });
  if (error) {
    return res.status(400).json({
      mensaje: "Verifica los datos proporcionados.",
      detalles: error.details.map((detalle) => detalle.message),
    });
  }

  const borrador = obtenerBorradorPorId(value.borradorId);
  if (!borrador) {
    return res.status(404).json({ mensaje: "Borrador no encontrado." });
  }
  const bloqueo = obtenerBloqueoGuardadoCoi(borrador.id);
  if (bloqueo) {
    return res.status(409).json({
      mensaje:
        "Este presupuesto está en proceso de guardado en COI. Espera a que finalice para continuar con el flujo.",
      progreso: bloqueo,
    });
  }
  const empresa = obtenerEmpresaPorId(borrador.empresaId);
  if (!empresa) {
    return res
      .status(404)
      .json({ mensaje: "Empresa asociada al borrador no existe." });
  }
  if (
    !req.esAdmin &&
    !tienePermisoEnModulo(
      req.mapaPermisos,
      empresa.id,
      borrador.modulo,
      "Revisar"
    )
  ) {
    return res
      .status(403)
      .json({ mensaje: "No cuentas con permisos para revisar borradores." });
  }

  try {
    const resultado = marcarRevisado(
      value.borradorId,
      value.cancelar,
      req.usuarioActual.id
    );
    notificarWorkflowPresupuesto({
      empresaId: empresa.id,
      modulo: borrador.modulo,
      anio: borrador.anio,
      accion: value.cancelar ? "revisar-cancelar" : "revisar",
      estado: resultado.estado,
      ejecutor: {
        id: req.usuarioActual.id,
        usuario: req.usuarioActual.usuario,
        nombre:
          `${req.usuarioActual.nombres || ""} ${
            req.usuarioActual.apellidos || ""
          }`.trim() || req.usuarioActual.usuario,
      },
    }).catch((notifError) =>
      console.warn(
        "No se enviaron todas las notificaciones de borradores.",
        notifError
      )
    );
    const mensaje = value.cancelar
      ? "Revisión cancelada y devuelta a edición."
      : "Borrador marcado como revisado.";
    return res.json({ mensaje, borrador: resultado });
  } catch (errorRevision) {
    console.error("Error al marcar revisión:", errorRevision);
    return res
      .status(500)
      .json({ mensaje: "No fue posible actualizar la revisión." });
  }
});

router.post("/descartar", async (req, res) => {
  const { value, error } = esquemaDescartar.validate(req.body, {
    abortEarly: false,
  });
  if (error) {
    return res.status(400).json({
      mensaje: "Verifica los datos para descartar.",
      detalles: error.details.map((detalle) => detalle.message),
    });
  }

  const { empresaId, modulo, anio, capitulo, borradorId } = value;
  // Si viene borradorId, lo usaremos preferentemente, de lo contrario contexto
  try {
    let borrador = null;
    if (borradorId) {
      borrador = obtenerBorradorPorId(borradorId);
    } else if (empresaId && modulo && Number.isInteger(anio)) {
      borrador = obtenerBorrador({ 
        empresaId, 
        modulo, 
        anio, 
        capitulo: capitulo || 'DEFAULT' 
      });
      if (!borrador) {
        // Nada que descartar, devolvemos éxito silencioso o 404
        return res
          .status(404)
          .json({ mensaje: "No hay borrador activo para descartar." });
      }
    } else {
      return res
        .status(400)
        .json({ mensaje: "Faltan parámetros para identificar el borrador." });
    }

    if (!borrador) {
      return res.status(404).json({ mensaje: "Borrador no encontrado." });
    }

    const bloqueo = obtenerBloqueoGuardadoCoi(borrador.id);
    if (bloqueo) {
      return res.status(409).json({
        mensaje:
          "Este presupuesto está en proceso de guardado en COI. Espera a que finalice antes de descartar.",
        progreso: bloqueo,
      });
    }

    const empresa = obtenerEmpresaPorId(borrador.empresaId);
    if (!empresa) {
      return res.status(404).json({ mensaje: "Empresa no existe." });
    }

    // Verificar permisos: Solo autor o admin o alguien con permiso de editar/eliminar
    if (
      !req.esAdmin &&
      String(borrador.usuarioId) !== String(req.usuarioActual.id) &&
      !tienePermisoEnModulo(
        req.mapaPermisos,
        empresa.id,
        borrador.modulo,
        "Cargar y guardar"
      )
    ) {
      return res
        .status(403)
        .json({ mensaje: "No tienes permiso para descartar este borrador." });
    }

    const eliminado = eliminarBorrador(
      borrador.empresaId,
      borrador.modulo,
      borrador.anio,
      borrador.capitulo,
      req.usuarioActual.id
    );
    return res.json({
      mensaje: "Borrador descartado correctamente.",
      borrador: eliminado,
    });
  } catch (error) {
    console.error("Error al descartar borrador:", error);
    return res.status(500).json({ mensaje: "Error al descartar el borrador." });
  }
});

router.post("/finalizar", async (req, res) => {
  const { value, error } = esquemaFinalizar.validate(req.body, {
    abortEarly: false,
  });
  if (error) {
    return res.status(400).json({
      mensaje: "Verifica los datos proporcionados.",
      detalles: error.details.map((detalle) => detalle.message),
    });
  }

  const borrador = obtenerBorradorPorId(value.borradorId);
  if (!borrador) {
    return res.status(404).json({ mensaje: "Borrador no encontrado." });
  }
  const empresa = obtenerEmpresaPorId(borrador.empresaId);
  if (!empresa) {
    return res
      .status(404)
      .json({ mensaje: "Empresa asociada al borrador no existe." });
  }
  if (
    !req.esAdmin &&
    !tienePermisoEnModulo(
      req.mapaPermisos,
      empresa.id,
      borrador.modulo,
      "Cargar y guardar"
    )
  ) {
    return res.status(403).json({
      mensaje: "No cuentas con permisos para guardar en base de datos.",
    });
  }
  if (borrador.estado !== ESTADOS.APROBADO) {
    return res.status(409).json({
      mensaje:
        "El borrador debe estar autorizado para guardar en base de datos.",
    });
  }

  try {
    const guardado = await guardarAutorizado(
      value.borradorId,
      req.usuarioActual.id
    );
    const ejecutor = {
      id: req.usuarioActual.id,
      usuario: req.usuarioActual.usuario,
      nombre:
        `${req.usuarioActual.nombres || ""} ${
          req.usuarioActual.apellidos || ""
        }`.trim() || req.usuarioActual.usuario,
    };
    notificarWorkflowPresupuesto({
      empresaId: empresa.id,
      modulo: borrador.modulo,
      anio: borrador.anio,
      accion: "guardar",
      estado: guardado.estado,
      ejecutor,
    }).catch((notifError) =>
      console.warn(
        "No se enviaron todas las notificaciones de borradores.",
        notifError
      )
    );
    return res.json({
      mensaje: `Presupuesto marcado como guardado por ${ejecutor.nombre} en el flujo de borradores (${borrador.modulo}).`,
      ejecutor,
      borrador: guardado,
    });
  } catch (errorFinal) {
    console.error("Error al guardar borrador autorizado:", errorFinal);
    return res
      .status(500)
      .json({
        mensaje:
          errorFinal?.message || "No fue posible guardar en la base de datos.",
      });
  }
});

// ========================================
// RECONTABILIZACIÓN DE CUENTAS
// ========================================

/**
 * POST /api/borradores/recontabilizar
 * Recontabiliza todas las cuentas padre para una empresa y año
 */
router.post("/recontabilizar", async (req, res) => {
  const schema = Joi.object({
    empresaId: Joi.string().trim().required(),
    anio: Joi.number().integer().min(2000).max(2100).required(),
  });

  const { value, error } = schema.validate(req.body, { abortEarly: false });

  if (error) {
    return res.status(400).json({
      mensaje: "Verifica los datos de recontabilización.",
      detalles: error.details.map((d) => d.message),
    });
  }

  const empresa = obtenerEmpresaPorId(value.empresaId);
  if (!empresa) {
    return res.status(404).json({ mensaje: "Empresa no encontrada." });
  }

  // Verificar permisos: debe tener al menos un permiso en la empresa
  if (!req.esAdmin) {
    const tienePermisosEmpresa = req.mapaPermisos && req.mapaPermisos[empresa.id];
    if (!tienePermisosEmpresa) {
      return res.status(403).json({
        mensaje: "No tienes permisos en esta empresa para recontabilizar."
      });
    }
  }

  try {
    console.log(`\n🔄 Recontabilización solicitada por: ${req.usuarioActual.usuario}`);
    console.log(`   Empresa: ${value.empresaId}`);
    console.log(`   Año: ${value.anio}\n`);

    await recontabilizarTodasLasCuentas({
      empresaId: value.empresaId,
      anio: value.anio
    });

    return res.json({
      mensaje: `Recontabilización completada para ${empresa.nombre} (${value.anio})`,
      empresaId: value.empresaId,
      anio: value.anio,
      empresa: empresa.nombre
    });
  } catch (errorRecontabilizar) {
    console.error("❌ Error en recontabilización:", errorRecontabilizar);
    return res.status(500).json({
      mensaje: "Error al recontabilizar cuentas.",
      error: errorRecontabilizar.message
    });
  }
});

/**
 * POST /api/borradores/recontabilizar/todas
 * Recontabiliza TODAS las empresas para un año específico
 */
router.post("/recontabilizar/todas", async (req, res) => {
  // Solo administradores pueden recontabilizar todas las empresas
  if (!req.esAdmin) {
    return res.status(403).json({
      mensaje: "Solo administradores pueden recontabilizar todas las empresas."
    });
  }

  const schema = Joi.object({
    anio: Joi.number().integer().min(2000).max(2100).required(),
  });

  const { value, error } = schema.validate(req.body, { abortEarly: false });

  if (error) {
    return res.status(400).json({
      mensaje: "Verifica el año.",
      detalles: error.details.map((d) => d.message),
    });
  }

  try {
    console.log(`\n🌐 Recontabilización GLOBAL solicitada por: ${req.usuarioActual.usuario}`);
    console.log(`   Año: ${value.anio}\n`);

    const resultados = await recontabilizarTodasLasEmpresas(value.anio);

    const exitosas = resultados.filter(r => r.exito).length;
    const fallidas = resultados.filter(r => !r.exito).length;

    return res.json({
      mensaje: `Recontabilización global completada`,
      anio: value.anio,
      exitosas,
      fallidas,
      resultados
    });
  } catch (errorRecontabilizar) {
    console.error("❌ Error en recontabilización global:", errorRecontabilizar);
    return res.status(500).json({
      mensaje: "Error al recontabilizar todas las empresas.",
      error: errorRecontabilizar.message
    });
  }
});

module.exports = router;
