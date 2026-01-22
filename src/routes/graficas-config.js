const express = require("express");
const router = express.Router();
const { db } = require("../db/sqlite");
const { getDefaultGraficasConfig } = require("../config/graficasDefaults");
const { requireAuth, extraerEmpresaActiva } = require("../middleware/auth");

const obtenerEmpresa = (req) => extraerEmpresaActiva(req) || "EMPRESA01";

const leerConfig = (empresaId) => {
  const row = db
    .prepare("SELECT config_json FROM graficas_config WHERE empresa_id = ?")
    .get(empresaId);
  if (!row?.config_json) return null;
  try {
    return JSON.parse(row.config_json);
  } catch (error) {
    return null;
  }
};

const guardarConfig = (empresaId, config) => {
  const payload = JSON.stringify(config);
  db.prepare(
    `
      INSERT INTO graficas_config (empresa_id, config_json, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(empresa_id) DO UPDATE SET
        config_json = excluded.config_json,
        updated_at = CURRENT_TIMESTAMP
    `
  ).run(empresaId, payload);
};

const obtenerConfigInicial = (empresaId) => {
  const existente = leerConfig(empresaId);
  if (existente) return existente;
  const defaults = getDefaultGraficasConfig();
  guardarConfig(empresaId, defaults);
  return defaults;
};

router.get("/", requireAuth, (req, res) => {
  try {
    const empresaId = obtenerEmpresa(req);
    const config = obtenerConfigInicial(empresaId);
    return res.json({ success: true, empresaId, config });
  } catch (error) {
    console.error("Error al cargar graficas-config:", error);
    return res.status(500).json({
      success: false,
      mensaje: "Error al cargar la configuracion de graficas",
    });
  }
});

router.post("/", requireAuth, (req, res) => {
  if (!req.esAdmin) {
    return res.status(403).json({
      success: false,
      mensaje: "No cuentas con permisos para editar la configuracion.",
    });
  }
  try {
    const empresaId = obtenerEmpresa(req);
    const config = req.body?.config;
    if (!config || typeof config !== "object") {
      return res.status(400).json({
        success: false,
        mensaje: "Configuracion invalida.",
      });
    }
    guardarConfig(empresaId, config);
    return res.json({ success: true, empresaId, config });
  } catch (error) {
    console.error("Error al guardar graficas-config:", error);
    return res.status(500).json({
      success: false,
      mensaje: "Error al guardar la configuracion de graficas",
    });
  }
});

router.delete("/", requireAuth, (req, res) => {
  if (!req.esAdmin) {
    return res.status(403).json({
      success: false,
      mensaje: "No cuentas con permisos para editar la configuracion.",
    });
  }
  try {
    const empresaId = obtenerEmpresa(req);
    db.prepare("DELETE FROM graficas_config WHERE empresa_id = ?").run(empresaId);
    return res.json({ success: true, empresaId });
  } catch (error) {
    console.error("Error al reiniciar graficas-config:", error);
    return res.status(500).json({
      success: false,
      mensaje: "Error al restaurar la configuracion de graficas",
    });
  }
});

module.exports = router;
