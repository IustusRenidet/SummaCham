const express = require("express");
const {
  listarNotificacionesPorUsuario,
  marcarNotificacionComoLeida,
  marcarTodasNotificacionesComoLeidas,
} = require("../services/notificacionesService");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

router.get("/", (req, res) => {
  const soloNoLeidas =
    req.query.leidas === "false" || req.query.estado === "pendientes";
  const limite = Number(req.query.limite) || 20;
  const notificaciones = listarNotificacionesPorUsuario(req.usuarioActual.id, {
    soloNoLeidas,
    limite,
  });
  res.json({ notificaciones });
});

// Mark all notifications as read
router.patch("/limpiar", (req, res) => {
  const afectadas = marcarTodasNotificacionesComoLeidas(req.usuarioActual.id);
  res.json({ mensaje: "Notificaciones marcadas como leídas.", afectadas });
});

router.patch("/:id/leida", (req, res) => {
  const notificacionId = Number(req.params.id);
  if (!Number.isInteger(notificacionId) || notificacionId <= 0) {
    return res
      .status(400)
      .json({ mensaje: "El identificador proporcionado no es válido." });
  }
  const actualizado = marcarNotificacionComoLeida(
    req.usuarioActual.id,
    notificacionId
  );
  if (!actualizado) {
    return res
      .status(404)
      .json({ mensaje: "No se encontró la notificación solicitada." });
  }
  res.json({ mensaje: "Notificación actualizada." });
});

module.exports = router;
