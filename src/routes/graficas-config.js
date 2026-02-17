const express = require("express");
const router = express.Router();
const { db } = require("../db/sqlite");
const { requireAuth, extraerEmpresaActiva } = require("../middleware/auth");

const normalizarEmpresaId = (value) => {
  const raw = (value || "").toString().trim();
  if (!raw) return "";
  const compact = raw.replace(/\s+/g, "").toUpperCase();
  const matchCanon = compact.match(/^EMPRESA0*([1-9][0-9]*)$/i);
  if (matchCanon) {
    const num = Number.parseInt(matchCanon[1], 10);
    if (Number.isInteger(num)) return `empresa${num}`;
  }
  const matchEmpresa = raw.match(/empresa\s*0*([1-9][0-9]*)/i);
  if (matchEmpresa) {
    const num = Number.parseInt(matchEmpresa[1], 10);
    if (Number.isInteger(num)) return `empresa${num}`;
  }
  return raw;
};

const obtenerEmpresa = (req) => {
  const raw = extraerEmpresaActiva(req) || "EMPRESA01";
  return {
    raw,
    normalizada: normalizarEmpresaId(raw) || raw,
  };
};

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
    const empresa = obtenerEmpresa(req);
    const anio = obtenerAnio(req);
    const empresaIds = Array.from(
      new Set([empresa.normalizada, empresa.raw].filter(Boolean))
    );
    let result = { config: null, source: anio != null ? "missing" : "legacy" };
    for (const empresaId of empresaIds) {
      const { config, source } = leerConfig(empresaId, anio);
      if (config) {
        result = { config, source, empresaIdEncontrada: empresaId };
        break;
      }
      result = { config: null, source };
    }
    return res.json({
      success: true,
      empresaId: empresa.normalizada,
      empresaIdOriginal: empresa.raw,
      empresaIdEncontrada: result.empresaIdEncontrada || null,
      anio,
      source: result.source,
      config: result.config,
    });
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
    const empresa = obtenerEmpresa(req);
    const empresaId = empresa.normalizada;
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
    const empresa = obtenerEmpresa(req);
    const empresaId = empresa.normalizada;
    const empresaIds = Array.from(
      new Set([empresa.normalizada, empresa.raw].filter(Boolean))
    );
    const anio = obtenerAnio(req);
    if (anio != null) {
      empresaIds.forEach((id) => {
        db.prepare(
          "DELETE FROM graficas_config_anio WHERE empresa_id = ? AND anio = ?"
        ).run(id, anio);
      });
      return res.json({ success: true, empresaId, anio, source: "anio" });
    }
    empresaIds.forEach((id) => {
      db.prepare("DELETE FROM graficas_config WHERE empresa_id = ?").run(id);
    });
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
