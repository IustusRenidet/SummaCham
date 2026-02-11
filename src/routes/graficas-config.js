const express = require("express");
const router = express.Router();
const { db } = require("../db/sqlite");
const { requireAuth, extraerEmpresaActiva } = require("../middleware/auth");

const obtenerEmpresa = (req) => extraerEmpresaActiva(req) || "EMPRESA01";

const obtenerAnio = (req) => {
  const raw =
    req.query?.anio ??
    req.query?.year ??
    req.body?.anio ??
    req.body?.year ??
    null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) ? parsed : null;
};

const parseConfigJson = (value) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
};

const leerConfig = (empresaId, anio = null) => {
  if (anio != null) {
    const row = db
      .prepare(
        "SELECT config_json FROM graficas_config_anio WHERE empresa_id = ? AND anio = ?"
      )
      .get(empresaId, anio);
    const parsed = parseConfigJson(row?.config_json);
    if (parsed) {
      return { config: parsed, source: "anio" };
    }
  }

  const legacy = db
    .prepare("SELECT config_json FROM graficas_config WHERE empresa_id = ?")
    .get(empresaId);
  const parsedLegacy = parseConfigJson(legacy?.config_json);
  if (parsedLegacy) {
    return { config: parsedLegacy, source: "legacy" };
  }
  return { config: null, source: anio != null ? "missing" : "legacy" };
};

router.get("/", requireAuth, (req, res) => {
  try {
    const empresaId = obtenerEmpresa(req);
    const anio = obtenerAnio(req);
    const { config, source } = leerConfig(empresaId, anio);
    return res.json({ success: true, empresaId, anio, source, config });
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
    const anio = obtenerAnio(req);
    const config = req.body?.config;
    if (!config || typeof config !== "object") {
      return res.status(400).json({
        success: false,
        mensaje: "Configuracion invalida.",
      });
    }
    const payload = JSON.stringify(config);

    if (anio != null) {
      db.prepare(
        `
        INSERT INTO graficas_config_anio (empresa_id, anio, config_json, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(empresa_id, anio) DO UPDATE SET
          config_json = excluded.config_json,
          updated_at = CURRENT_TIMESTAMP
      `
      ).run(empresaId, anio, payload);
      return res.json({ success: true, empresaId, anio, source: "anio", config });
    }

    // Legacy (sin año): mantener compatibilidad.
    db.prepare(
      `
        INSERT INTO graficas_config (empresa_id, config_json, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(empresa_id) DO UPDATE SET
          config_json = excluded.config_json,
          updated_at = CURRENT_TIMESTAMP
      `
    ).run(empresaId, payload);
    return res.json({ success: true, empresaId, anio: null, source: "legacy", config });
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
    const anio = obtenerAnio(req);
    if (anio != null) {
      db.prepare(
        "DELETE FROM graficas_config_anio WHERE empresa_id = ? AND anio = ?"
      ).run(empresaId, anio);
      return res.json({ success: true, empresaId, anio, source: "anio" });
    }
    db.prepare("DELETE FROM graficas_config WHERE empresa_id = ?").run(empresaId);
    return res.json({ success: true, empresaId, anio: null, source: "legacy" });
  } catch (error) {
    console.error("Error al reiniciar graficas-config:", error);
    return res.status(500).json({
      success: false,
      mensaje: "Error al restaurar la configuracion de graficas",
    });
  }
});

module.exports = router;
