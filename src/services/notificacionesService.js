const nodemailer = require("nodemailer");
const { db } = require("../db/sqlite");
const { obtenerEmpresaPorId } = require("../config/empresas");

let transporter = null;
let transporterInicializado = false;

const obtenerTransporter = () => {
  if (transporterInicializado) {
    return transporter;
  }
  transporterInicializado = true;
  const host = process.env.SMTP_HOST;
  if (!host) {
    return null;
  }
  const puerto = Number(process.env.SMTP_PORT || 587);
  const seguro = String(process.env.SMTP_SECURE || "").toLowerCase() === "true";
  const usuario = process.env.SMTP_USER;
  const contrasena = process.env.SMTP_PASS;
  transporter = nodemailer.createTransport({
    host,
    port: puerto,
    secure: seguro,
    auth:
      usuario && contrasena ? { user: usuario, pass: contrasena } : undefined,
  });
  return transporter;
};

const enviarCorreoNotificacion = async ({ para, asunto, cuerpo }) => {
  const activo = obtenerTransporter();
  if (!activo) {
    console.info("SMTP no configurado, notificación solo local.", {
      para,
      asunto,
    });
    return false;
  }
  try {
    await activo.sendMail({
      from: process.env.SMTP_FROM || "notificaciones@amcham.org",
      to: para,
      subject: asunto,
      html: cuerpo,
    });
    return true;
  } catch (error) {
    console.warn("No fue posible enviar el correo de notificación.", error);
    return false;
  }
};

const registrarNotificacion = (notificacion) => {
  const insert = db.prepare(`
    INSERT INTO notificaciones (
      usuario_id, empresa_id, modulo, titulo, mensaje, tipo, enlace
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const resultado = insert.run(
    notificacion.usuarioId,
    notificacion.empresaId || null,
    notificacion.modulo || null,
    notificacion.titulo || "Notificación",
    notificacion.mensaje || "",
    notificacion.tipo || "info",
    notificacion.enlace || ""
  );
  return resultado.lastInsertRowid;
};

const registrarNotificacionesMasivas = (destinatarios = [], datosBase = {}) => {
  const transaccion = db.transaction((items) => {
    return items.map((dest) => {
      const id = registrarNotificacion({
        usuarioId: dest.id,
        empresaId: datosBase.empresaId,
        modulo: datosBase.modulo,
        titulo: datosBase.titulo,
        mensaje: datosBase.mensaje,
        tipo: datosBase.tipo,
        enlace: datosBase.enlace,
      });
      return { id, ...datosBase, usuarioId: dest.id };
    });
  });
  return transaccion(destinatarios);
};

const listarNotificacionesPorUsuario = (
  usuarioId,
  { soloNoLeidas = false, limite = 20 } = {}
) => {
  const limiteSeguro = Math.max(1, Math.min(Number(limite) || 20, 50));
  const query = `
    SELECT id, empresa_id AS empresaId, modulo, titulo, mensaje, tipo, enlace,
           creada_en AS creadaEn, leida_en AS leidaEn
    FROM notificaciones
    WHERE usuario_id = ?
      ${soloNoLeidas ? "AND leida_en IS NULL" : ""}
    ORDER BY creada_en DESC
    LIMIT ?
  `;
  return db.prepare(query).all(usuarioId, limiteSeguro);
};

const marcarNotificacionComoLeida = (usuarioId, notificacionId) => {
  const update = db.prepare(`
    UPDATE notificaciones
    SET leida_en = CURRENT_TIMESTAMP
    WHERE id = ? AND usuario_id = ? AND leida_en IS NULL
  `);
  const resultado = update.run(notificacionId, usuarioId);
  return resultado.changes > 0;
};

const marcarTodasNotificacionesComoLeidas = (usuarioId) => {
  const update = db.prepare(`
    UPDATE notificaciones
    SET leida_en = CURRENT_TIMESTAMP
    WHERE usuario_id = ? AND leida_en IS NULL
  `);
  const resultado = update.run(usuarioId);
  return resultado.changes;
};

const mapearColumnaPermiso = (permiso) => {
  switch (permiso) {
    case "Cargar y guardar":
      return "puede_cargar_guardar";
    case "Revisar":
      return "puede_revisar";
    case "Aprobar":
      return "puede_aprobar";
    default:
      return null;
  }
};

const obtenerUsuariosPorPermiso = (empresaId, modulo, columnaPermiso) => {
  if (!columnaPermiso) {
    return [];
  }
  const consulta = db.prepare(`
    SELECT u.id, u.correo,
           TRIM(COALESCE(u.nombres, '') || ' ' || COALESCE(u.apellidos, '')) AS nombre
    FROM permisos_modulo pm
    INNER JOIN usuarios u ON u.id = pm.usuario_id
    WHERE pm.empresa_id = ?
      AND pm.modulo = ?
      AND pm.${columnaPermiso} = 1
  `);
  return consulta.all(empresaId, modulo);
};

const construirMensajeCorreo = ({ titulo, mensaje, enlace }) => {
  const cuerpo = [`<p>${mensaje}</p>`];
  if (enlace) {
    cuerpo.push(`<p><a href="${enlace}">Abrir detalle</a></p>`);
  }
  return cuerpo.join("");
};

const MAPA_DESTINATARIOS = {
  cargar: { permiso: "Revisar", asunto: "listo para revisión" },
  enviar: { permiso: "Revisar", asunto: "enviado para revisión" },
  revisar: { permiso: "Aprobar", asunto: "requiere autorización" },
  "revisar-cancelar": {
    permiso: "Cargar y guardar",
    asunto: "regresado a edición",
  },
  autorizar: {
    permiso: "Cargar y guardar",
    asunto: "autorizado y listo para guardar",
  },
  rechazar: {
    permiso: "Cargar y guardar",
    asunto: "rechazado, requiere ajustes",
  },
  aprobar: { permiso: "Cargar y guardar", asunto: "aprobado y cerrado" },
  guardar: {
    permiso: "Cargar y guardar",
    asunto: "guardado y listo para operación",
  },
};

const notificarWorkflowPresupuesto = async ({
  empresaId,
  modulo,
  anio,
  accion,
  estado,
  ejecutor,
}) => {
  const destino = MAPA_DESTINATARIOS[accion];
  if (!destino) {
    return [];
  }
  const columna = mapearColumnaPermiso(destino.permiso);
  const usuarios = obtenerUsuariosPorPermiso(empresaId, modulo, columna).filter(
    (usuario) => usuario.id !== ejecutor?.id
  );
  if (usuarios.length === 0) {
    return [];
  }
  const empresa = obtenerEmpresaPorId(empresaId);
  const encabezado = `Presupuesto ${modulo}: ${destino.asunto}`;
  const mensaje = `${
    ejecutor?.nombre || ejecutor?.usuario || "Un colaborador"
  } actualizó el presupuesto ${modulo} (${
    empresa?.etiqueta || empresa?.nombre || empresaId
  }) al estado ${estado} (${anio}).`;
  const notificaciones = registrarNotificacionesMasivas(usuarios, {
    empresaId,
    modulo,
    titulo: encabezado,
    mensaje,
    tipo: "info",
    enlace: "",
  });
  await Promise.all(
    usuarios
      .filter((usuario) => usuario.correo)
      .map((usuario) =>
        enviarCorreoNotificacion({
          para: usuario.correo,
          asunto: encabezado,
          cuerpo: construirMensajeCorreo({
            titulo: encabezado,
            mensaje,
            enlace: "",
          }),
        })
      )
  ).catch((error) => {
    console.warn(
      "No fue posible enviar todos los correos de notificación.",
      error
    );
  });
  return notificaciones;
};

module.exports = {
  registrarNotificacion,
  registrarNotificacionesMasivas,
  listarNotificacionesPorUsuario,
  marcarNotificacionComoLeida,
  marcarTodasNotificacionesComoLeidas,
  notificarWorkflowPresupuesto,
};
