/**
 * layoutRoutes.js
 * API REST para gestión de layouts por año y capítulo
 */

const express = require("express");
const router = express.Router();
const layoutService = require("../services/layoutService");
const { requireAuth } = require("../middleware/auth");
const { MODULOS, normalizarNombreModulo } = require("../config/modulos");
const fs = require("fs");
const path = require("path");

const { db } = require("../db/sqlite");

const normalizarEmpresaPermiso = (empresaId) => {
  const raw = (empresaId || "").toString().trim().toLowerCase();
  if (!raw) return "";
  const match = raw.match(/empresa0*(\d+)/i);
  if (!match) return raw;
  const numero = parseInt(match[1], 10);
  if (!Number.isInteger(numero) || numero <= 0) return raw;
  if (numero >= 9 && numero <= 12) {
    return `empresa${numero - 8}`;
  }
  return `empresa${numero}`;
};

const resolverPermisosEmpresa = (mapaPermisos, empresaId) => {
  if (!mapaPermisos || !empresaId) return null;
  const claves = new Set([
    empresaId,
    empresaId.toString().toLowerCase(),
    normalizarEmpresaPermiso(empresaId),
  ]);
  for (const clave of claves) {
    if (!clave) continue;
    if (mapaPermisos[clave]) return mapaPermisos[clave];
  }
  return null;
};

const tienePermisoCapitulo = (usuarioId, capitulo) => {
  if (!usuarioId) return false;
  // Si el usuario no tiene registro en la tabla, por defecto NO tiene permiso granular
  // (a menos que sea admin global, que se checkea antes)
  const row = db
    .prepare(
      "SELECT puede_editar FROM permisos_edicion_capitulo WHERE usuario_id = ? AND capitulo = ?",
    )
    .get(usuarioId, capitulo);
  return row ? row.puede_editar === 1 : false;
};

const tienePermisoGuardar = (req, empresaId, modulo, capitulo) => {
  if (req.esAdmin) return true;
  const moduloNormalizado = normalizarNombreModulo(modulo) || modulo;
  const permisosEmpresa = resolverPermisosEmpresa(req.mapaPermisos, empresaId);
  const tienePermisoGral = Boolean(
    permisosEmpresa?.[moduloNormalizado]?.["Cargar y guardar"],
  );

  if (!tienePermisoGral) return false;

  // Si tiene permiso general y hay un capítulo específico, verificar permiso granular
  if (capitulo && capitulo !== "DEFAULT") {
    return tienePermisoCapitulo(req.usuarioActual?.id, capitulo);
  }

  return tienePermisoGral;
};

// Middleware de debug para ESTE router
router.use((req, res, next) => {
  if (req.path.includes("/RESUMEN") || req.path.includes("2025")) {
    console.log(
      `[DEBUG-ROUTER] layoutRoutes request: ${req.method} ${req.originalUrl} (Path: ${req.path})`,
    );
  }
  next();
});

const NORMALIZE_REGEX = /[^a-zA-Z0-9]+/g;
const normalizeKey = (value) =>
  (value || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(NORMALIZE_REGEX, "")
    .toUpperCase();

const normalizeCapituloKey = (value) => {
  const base = normalizeKey(value);
  if (base === "CDMX") return "CIUDADDEMEXICO";
  if (base === "NORESTE") return "NE";
  if (base === "NOROESTE") return "NO";
  return base;
};

const normalizeModuloKey = (value) => normalizeKey(value);

const inferPlacementFields = (nombre, moduloKey) => {
  const key = normalizeKey(nombre);
  const modKey = normalizeModuloKey(moduloKey);
  if (!key) return [];

  if (modKey === "RESUMEN" || modKey === "SUMMARY") {
    if (key.includes("CONSOLIDATEDNETRESULTS")) return ["result-net-row"];
    if (key.includes("NETRESULTS")) return ["net-row"];
    if (key.includes("CONSOLIDATEDOPERATINGRESULTS"))
      return ["sum-row-operativo-consolidado"];
    if (key.includes("OPERATINGRESULTS")) return ["sum-row-operativo"];
    if (key.includes("CONSOLIDATEDINCOME") || key.includes("CONSOLIDATEDEXPENSE"))
      return ["sum-row-sumavarios-consolidado"];
    if (key.includes("CONSOLIDATED")) return ["sum-row-sumavarios-consolidado"];
    if (key.includes("RESULTS")) return ["result-row"];
    return ["sum-row"];
  }

  if (key.includes("RESULTADOOPERATIVO")) return ["sum-row-operativo"];
  if (key.includes("RESULTADO")) return ["result-row"];
  if (key.includes("NET")) return ["net-row"];
  return ["sum-row"];
};

let operacionesPredefCache = null;
let operacionesPredefCacheAt = 0;
const OPERACIONES_CACHE_TTL_MS = 5 * 60 * 1000;

const buildOperacionesPredefinidas = () => {
  const now = Date.now();
  if (
    operacionesPredefCache &&
    now - operacionesPredefCacheAt < OPERACIONES_CACHE_TTL_MS
  ) {
    return operacionesPredefCache;
  }

  const baseDir = path.resolve(__dirname, "../../PLANTILLAS 2026+");
  if (!fs.existsSync(baseDir)) {
    operacionesPredefCache = {};
    operacionesPredefCacheAt = now;
    return operacionesPredefCache;
  }

  const map = {};
  const capituloDirs = fs
    .readdirSync(baseDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  capituloDirs.forEach((dirName) => {
    const capituloLabel = dirName.replace(/\s*\d{4}\s*$/, "").trim();
    const capKey = normalizeCapituloKey(capituloLabel);
    if (!capKey) return;
    const dirPath = path.join(baseDir, dirName);
    const files = fs
      .readdirSync(dirPath)
      .filter((file) => /_layout\.json$/i.test(file));

    files.forEach((file) => {
      const moduloLabel = file.replace(/_layout\.json$/i, "").trim();
      const modKey = normalizeModuloKey(moduloLabel);
      if (!modKey) return;

      const filePath = path.join(dirPath, file);
      let jsonData = null;
      try {
        jsonData = JSON.parse(fs.readFileSync(filePath, "utf8"));
      } catch (error) {
        console.warn(
          `[operaciones-predefinidas] No se pudo leer ${filePath}: ${error.message}`
        );
        return;
      }

      const ops =
        jsonData?.Operaciones ||
        jsonData?.operaciones ||
        jsonData?.OPERACIONES ||
        [];
      if (!Array.isArray(ops) || !ops.length) return;

      const mapped = ops
        .map((op, idx) => {
          const nombre = (op?.nombre || op?.Nombre || op?.Clase || op?.clase || "")
            .toString()
            .trim();
          if (!nombre) return null;
          const formula = (op?.expresion || op?.Expresion || op?.formula || "")
            .toString()
            .trim();
          const section = (op?.seccion || op?.Seccion || op?.SECCION || "")
            .toString()
            .trim();
          const placements = inferPlacementFields(nombre, modKey);
          return {
            nombre,
            formula,
            section,
            aparece: placements,
            orden: Number.isFinite(Number(op?.orden)) ? Number(op?.orden) : idx,
            source: "plantillas-2026",
          };
        })
        .filter(Boolean);

      if (!mapped.length) return;

      if (!map[capKey]) map[capKey] = {};
      if (!map[capKey][modKey]) map[capKey][modKey] = [];
      map[capKey][modKey].push(...mapped);
    });
  });

  operacionesPredefCache = map;
  operacionesPredefCacheAt = now;
  return operacionesPredefCache;
};

/**
 * GET /api/layouts-config/operaciones-predefinidas
 * Operaciones predefinidas (solo fórmulas) desde PLANTILLAS 2026+
 */
router.get("/operaciones-predefinidas", requireAuth, (req, res) => {
  try {
    const data = buildOperacionesPredefinidas();
    res.json({ success: true, data });
  } catch (error) {
    console.error("Error al cargar operaciones predefinidas:", error);
    res.status(500).json({
      success: false,
      mensaje: "Error al cargar operaciones predefinidas",
      error: error.message,
    });
  }
});

/**
 * GET /api/layouts/:modulo/anios
 * Obtener años disponibles para un módulo
 */
router.get("/:modulo/anios", requireAuth, (req, res) => {
  try {
    const { modulo } = req.params;
    const { empresaId = "EMPRESA01" } = req.query;

    const anios = layoutService.obtenerAniosDisponibles({ empresaId, modulo });

    res.json({
      success: true,
      modulo,
      anios,
    });
  } catch (error) {
    console.error("Error al obtener años:", error);
    res.status(500).json({
      success: false,
      mensaje: "Error al obtener años disponibles",
      error: error.message,
    });
  }
});

/**
 * GET /api/layouts/:modulo/:anio/capitulos
 * Obtener capítulos disponibles para un módulo y año
 */
router.get("/:modulo/:anio/capitulos", requireAuth, (req, res) => {
  try {
    const { modulo, anio } = req.params;
    const { empresaId = "EMPRESA01" } = req.query;

    const capitulos = layoutService.obtenerCapitulos({
      empresaId,
      modulo,
      anio: parseInt(anio),
    });

    res.json({
      success: true,
      modulo,
      anio: parseInt(anio),
      capitulos,
    });
  } catch (error) {
    console.error("Error al obtener capítulos:", error);
    res.status(500).json({
      success: false,
      mensaje: "Error al obtener capítulos",
      error: error.message,
    });
  }
});

/**
 * GET /api/layouts/:modulo/:anio/estadisticas
 * Obtener estadísticas de un layout
 */
router.get("/:modulo/:anio/estadisticas", requireAuth, (req, res) => {
  try {
    const { modulo, anio } = req.params;
    const { empresaId = "EMPRESA01" } = req.query;

    const stats = layoutService.obtenerEstadisticasLayout({
      empresaId,
      modulo,
      anio: parseInt(anio),
    });

    res.json({
      success: true,
      modulo,
      anio: parseInt(anio),
      estadisticas: stats,
    });
  } catch (error) {
    console.error("Error al obtener estadísticas:", error);
    res.status(500).json({
      success: false,
      mensaje: "Error al obtener estadísticas",
      error: error.message,
    });
  }
});

/**
 * GET /api/layouts/:modulo/:anio/completo
 * Obtener layout completo de un módulo (todos los capítulos) en formato legacy
 */
router.get("/:modulo/:anio/completo", requireAuth, (req, res) => {
  try {
    const { modulo, anio } = req.params;
    const { empresaId = "EMPRESA01" } = req.query;

    const capitulos = layoutService.obtenerCapitulos({
      empresaId,
      modulo,
      anio: parseInt(anio),
    });

    const layoutCompleto = {};
    const operacionesGlobales = [];

    // Cargar cada capítulo y agrupar
    capitulos.forEach((cap) => {
      const layout = layoutService.obtenerLayout({
        empresaId,
        modulo,
        anio: parseInt(anio),
        capitulo: cap.capitulo,
      });

      // Convertir cuentas a formato legacy
      layoutCompleto[cap.capitulo] = layout.cuentas.map((cuenta) => ({
        CAPITULO: cap.capitulo,
        CUENTA: cuenta.CUENTA,
        NOMBRE: cuenta.NOMBRE,
        "SECCIÓN Principal": cuenta["SECCIÓN Principal"],
        "SECCION Secundaria": cuenta["SECCION Secundaria"],
        SECCION: cuenta["SECCIÓN Principal"], // Para módulos operativos
      }));

      // Recolectar operaciones
      if (layout.operaciones && layout.operaciones.length > 0) {
        operacionesGlobales.push(...layout.operaciones);
      }
    });

    // Agregar operaciones globales si existen
    if (operacionesGlobales.length > 0) {
      layoutCompleto["SUMA DE VARIAS SECCIONES"] = operacionesGlobales;
    }

    res.json({
      success: true,
      modulo,
      anio: parseInt(anio),
      layout: layoutCompleto,
    });
  } catch (error) {
    console.error("Error al obtener layout completo:", error);
    res.status(500).json({
      success: false,
      mensaje: "Error al obtener layout completo",
      error: error.message,
    });
  }
});

/**
 * GET /api/layouts/:modulo/:anio/existe
 * Verificar si existe un layout para un año
 */
router.get("/:modulo/:anio/existe", requireAuth, (req, res) => {
  try {
    const { modulo, anio } = req.params;
    const { empresaId = "EMPRESA01" } = req.query;

    const existe = layoutService.existeLayout({
      empresaId,
      modulo,
      anio: parseInt(anio),
    });

    res.json({
      success: true,
      modulo,
      anio: parseInt(anio),
      existe,
    });
  } catch (error) {
    console.error("Error al verificar layout:", error);
    res.status(500).json({
      success: false,
      mensaje: "Error al verificar layout",
      error: error.message,
    });
  }
});

/**
 * GET /api/layouts/:modulo/:anio/:capitulo
 * Obtener layout completo para un módulo, año y capítulo
 */
router.get("/:modulo/:anio/:capitulo", requireAuth, (req, res) => {
  console.log(
    `[DEBUG] Route /:modulo/:anio/:capitulo hit. Params:`,
    req.params,
  );
  try {
    const { modulo, anio, capitulo } = req.params;
    const { empresaId = "EMPRESA01", includeSecciones } = req.query;

    const layout = layoutService.obtenerLayout({
      empresaId,
      modulo,
      anio: parseInt(anio),
      capitulo: decodeURIComponent(capitulo),
      incluirSecciones: includeSecciones,
    });

    res.json({
      success: true,
      modulo,
      anio: parseInt(anio),
      capitulo,
      layout,
    });
  } catch (error) {
    console.error("Error al obtener layout:", error);
    res.status(500).json({
      success: false,
      mensaje: "Error al obtener layout",
      error: error.message,
    });
  }
});

/**
 * POST /api/layouts/:modulo/:anio/:capitulo
 * Reemplazar layout completo (cuentas + operaciones) para un capitulo
 */
router.post("/:modulo/:anio/:capitulo", requireAuth, (req, res, next) => {
  try {
    const { modulo, anio, capitulo } = req.params;
    const capituloRuta = (capitulo || "").toString().trim().toLowerCase();
    // Evitar colisión con endpoints específicos como:
    // POST /:modulo/:anio/operaciones
    // Si no se delega, "operaciones" se interpreta como capítulo.
    if (capituloRuta === "operaciones") {
      return next();
    }
    const {
      empresaId = "EMPRESA01",
      cuentas = [],
      operaciones = [],
    } = req.body;

    if (!tienePermisoGuardar(req, empresaId, modulo, capitulo)) {
      return res.status(403).json({
        success: false,
        mensaje: "No cuentas con permisos para editar este capitulo",
      });
    }

    if (!Array.isArray(cuentas) || !Array.isArray(operaciones)) {
      return res.status(400).json({
        success: false,
        mensaje: "cuentas y operaciones deben ser arrays",
      });
    }

    const anioNumero = parseInt(anio);
    layoutService.eliminarLayoutCapitulo({
      empresaId,
      modulo,
      anio: anioNumero,
      capitulo,
    });

    const resultadoCuentas = cuentas.length
      ? layoutService.guardarCuentas({
        empresaId,
        modulo,
        anio: anioNumero,
        capitulo,
        cuentas,
      })
      : { insertadas: 0 };

    const operacionesNormalizadas = operaciones.map((op) => ({
      ...op,
      CAPITULO: op?.CAPITULO || capitulo,
      HOJA: op?.HOJA || modulo,
    }));

    const resultadoOps = operacionesNormalizadas.length
      ? layoutService.guardarOperaciones({
        empresaId,
        modulo,
        anio: anioNumero,
        operaciones: operacionesNormalizadas,
      })
      : { insertadas: 0 };

    // Snapshot/version para permitir deshacer.
    try {
      const usuarioId = req.usuarioActual?.id ?? null;
      layoutService.crearLayoutVersion({
        empresaId,
        modulo,
        anio: anioNumero,
        capitulo,
        usuarioId,
        source: "replace-layout",
        motivo: "Reemplazar layout",
      });
    } catch (versionErr) {
      console.warn(
        "[layoutRoutes] No se pudo crear snapshot de layout (reemplazar):",
        versionErr?.message || versionErr
      );
    }

    res.json({
      success: true,
      mensaje: "Layout reemplazado exitosamente",
      cuentas: resultadoCuentas.insertadas,
      operaciones: resultadoOps.insertadas,
    });
  } catch (error) {
    console.error("Error al reemplazar layout:", error);
    res.status(500).json({
      success: false,
      mensaje: "Error al reemplazar layout",
      error: error.message,
    });
  }
});

/**
 * POST /api/layouts/:modulo/:anio/:capitulo/cuentas
 * Guardar cuentas de un layout
 */
router.post("/:modulo/:anio/:capitulo/cuentas", requireAuth, (req, res) => {
  try {
    const { modulo, anio, capitulo } = req.params;
    const { empresaId = "EMPRESA01", cuentas } = req.body;

    if (!tienePermisoGuardar(req, empresaId, modulo, capitulo)) {
      return res.status(403).json({
        success: false,
        mensaje: "No cuentas con permisos para editar este capítulo",
      });
    }

    if (!Array.isArray(cuentas)) {
      return res.status(400).json({
        success: false,
        mensaje: "cuentas debe ser un array",
      });
    }

    const resultado = layoutService.guardarCuentas({
      empresaId,
      modulo,
      anio: parseInt(anio),
      capitulo,
      cuentas,
    });

    // Snapshot/version (undo/restore). Guardar cuentas también debe generar versión,
    // porque el orden manual vive principalmente en `orden_presentacion` de cuentas.
    try {
      const usuarioId = req.usuarioActual?.id ?? null;
      layoutService.crearLayoutVersion({
        empresaId,
        modulo,
        anio: parseInt(anio),
        capitulo,
        usuarioId,
        source: "save-cuentas",
        motivo: "Guardar cuentas",
      });
    } catch (versionErr) {
      console.warn(
        "[layoutRoutes] No se pudo crear snapshot de layout (cuentas):",
        versionErr?.message || versionErr
      );
    }

    res.json({
      success: true,
      mensaje: "Cuentas guardadas exitosamente",
      ...resultado,
    });
  } catch (error) {
    console.error("Error al guardar cuentas:", error);
    res.status(500).json({
      success: false,
      mensaje: "Error al guardar cuentas",
      error: error.message,
    });
  }
});

/**
 * POST /api/layouts/:modulo/:anio/operaciones
 * Guardar operaciones de un layout
 */
router.post("/:modulo/:anio/operaciones", requireAuth, (req, res) => {
  try {
    const { modulo, anio } = req.params;
    const { empresaId = "EMPRESA01", operaciones, capitulo } = req.body;

    if (!Array.isArray(operaciones)) {
      return res.status(400).json({
        success: false,
        mensaje: "operaciones debe ser un array",
      });
    }

    const capitulosObjetivo = new Set();
    if (capitulo) {
      capitulosObjetivo.add(capitulo);
    }
    operaciones.forEach((op) => {
      const cap = op?.CAPITULO;
      if (cap) capitulosObjetivo.add(cap);
    });

    if (!capitulosObjetivo.size) {
      return res.status(400).json({
        success: false,
        mensaje: "capitulo es requerido para reemplazar operaciones",
      });
    }

    capitulosObjetivo.forEach((cap) => {
      layoutService.eliminarOperacionesCapitulo({
        empresaId,
        modulo,
        anio: parseInt(anio),
        capitulo: cap,
      });
    });

    const resultado = operaciones.length
      ? layoutService.guardarOperaciones({
        empresaId,
        modulo,
        anio: parseInt(anio),
        operaciones,
      })
      : { success: true, insertadas: 0 };

    // Crear snapshot/version para permitir deshacer (evitar duplicados por hash).
    try {
      const usuarioId = req.usuarioActual?.id ?? null;
      capitulosObjetivo.forEach((cap) => {
        layoutService.crearLayoutVersion({
          empresaId,
          modulo,
          anio: parseInt(anio),
          capitulo: cap,
          usuarioId,
          source: "save-operaciones",
          motivo: "Guardar layout",
        });
      });
    } catch (versionErr) {
      console.warn("[layoutRoutes] No se pudo crear snapshot de layout:", versionErr?.message || versionErr);
    }

    res.json({
      success: true,
      mensaje: "Operaciones guardadas exitosamente",
      ...resultado,
    });
  } catch (error) {
    console.error("Error al guardar operaciones:", error);
    res.status(500).json({
      success: false,
      mensaje: "Error al guardar operaciones",
      error: error.message,
    });
  }
});

/**
 * GET /api/layouts-config/:modulo/:anio/:capitulo/versions
 * Historial de versiones (snapshots) para deshacer/restaurar.
 */
router.get("/:modulo/:anio/:capitulo/versions", requireAuth, (req, res) => {
  try {
    const { modulo, anio, capitulo } = req.params;
    const { empresaId = "EMPRESA01", limit } = req.query;
    const versions = layoutService.listarLayoutVersiones({
      empresaId,
      modulo,
      anio: parseInt(anio),
      capitulo: decodeURIComponent(capitulo),
      limit: limit ? parseInt(limit) : 30,
    });
    res.json({ success: true, versions });
  } catch (error) {
    console.error("Error al listar versiones:", error);
    res.status(500).json({
      success: false,
      mensaje: "Error al listar versiones",
      error: error.message,
    });
  }
});

/**
 * POST /api/layouts-config/:modulo/:anio/:capitulo/versions/:id/restore
 * Restaurar un snapshot.
 */
router.post("/:modulo/:anio/:capitulo/versions/:id/restore", requireAuth, (req, res) => {
  try {
    const { modulo, anio, capitulo, id } = req.params;
    const { empresaId = "EMPRESA01", motivo } = req.body || {};

    if (!tienePermisoGuardar(req, empresaId, modulo, decodeURIComponent(capitulo))) {
      return res.status(403).json({
        success: false,
        mensaje: "No cuentas con permisos para restaurar versiones",
      });
    }

    const usuarioId = req.usuarioActual?.id ?? null;
    const resultado = layoutService.restaurarLayoutVersion({
      empresaId,
      modulo,
      anio: parseInt(anio),
      capitulo: decodeURIComponent(capitulo),
      versionId: parseInt(id),
      usuarioId,
      source: "restore",
      motivo: motivo || `Restaurar versión ${id}`,
    });

    if (!resultado?.success) {
      return res.status(400).json({
        success: false,
        mensaje: resultado?.message || "No fue posible restaurar la versión",
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error al restaurar versión:", error);
    res.status(500).json({
      success: false,
      mensaje: "Error al restaurar versión",
      error: error.message,
    });
  }
});

/**
 * POST /api/layouts-config/copiar
 * Copiar layouts de un año a otro (varios módulos)
 *
 * Body:
 * - empresaId (opcional)
 * - anioOrigen (requerido)
 * - anioDestino (requerido)
 * - modulos (opcional: array de módulos). Si no se manda, copia todos los módulos del catálogo (excepto "Layouts").
 *
 * Reglas:
 * - Se omiten módulos sin permiso de "Cargar y guardar"
 * - Se omiten módulos que no tienen layout en el año origen (para no borrar el destino por accidente)
 * - Para módulos copiados, el destino se sobrescribe (borra + inserta)
 */
router.post("/copiar", requireAuth, (req, res) => {
  try {
    const { empresaId = "EMPRESA01", anioOrigen, anioDestino, modulos } = req.body || {};

    if (!anioOrigen || !anioDestino) {
      return res.status(400).json({
        success: false,
        mensaje: "anioOrigen y anioDestino son requeridos",
      });
    }

    const origen = parseInt(anioOrigen, 10);
    const destino = parseInt(anioDestino, 10);
    if (!Number.isInteger(origen) || !Number.isInteger(destino)) {
      return res.status(400).json({
        success: false,
        mensaje: "anioOrigen y anioDestino deben ser números enteros",
      });
    }

    if (origen === destino) {
      return res.status(400).json({
        success: false,
        mensaje: "anioDestino debe ser diferente a anioOrigen",
      });
    }

    const modulosDestino = Array.isArray(modulos) && modulos.length
      ? modulos
      : MODULOS.filter((m) => m !== "Layouts");

    const copiados = [];
    const omitidosSinPermiso = [];
    const omitidosSinOrigen = [];
    const errores = [];

    modulosDestino.forEach((modulo) => {
      if (!tienePermisoGuardar(req, empresaId, modulo)) {
        omitidosSinPermiso.push(modulo);
        return;
      }

      const existeOrigen = layoutService.existeLayout({
        empresaId,
        modulo,
        anio: origen,
      });
      if (!existeOrigen) {
        omitidosSinOrigen.push(modulo);
        return;
      }

      try {
        layoutService.copiarLayout({
          empresaId,
          modulo,
          anioOrigen: origen,
          anioDestino: destino,
        });
        copiados.push(modulo);
      } catch (err) {
        errores.push({ modulo, error: err?.message || String(err) });
      }
    });

    // Copiar gráficas por año.
    // Regla: si el año destino YA tiene config, sobrescribir.
    // Origen: primero `graficas_config_anio(anioOrigen)`, fallback a `graficas_config` legacy.
    let graficasCopiadas = false;
    let graficasSource = null;
    try {
      if (copiados.length > 0) {
        const fromYear = db
          .prepare(
            "SELECT config_json FROM graficas_config_anio WHERE empresa_id = ? AND anio = ?",
          )
          .get(empresaId, origen);

        const fromLegacy = !fromYear
          ? db
            .prepare("SELECT config_json FROM graficas_config WHERE empresa_id = ?")
            .get(empresaId)
          : null;

        const payload = fromYear?.config_json || fromLegacy?.config_json || null;
        if (payload) {
          db.prepare(
            `
              INSERT INTO graficas_config_anio (empresa_id, anio, config_json, updated_at)
              VALUES (?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(empresa_id, anio) DO UPDATE SET
                config_json = excluded.config_json,
                updated_at = CURRENT_TIMESTAMP
            `,
          ).run(empresaId, destino, payload);
          graficasCopiadas = true;
          graficasSource = fromYear ? "anio" : "legacy";
        }
      }
    } catch (err) {
      console.warn("[layoutRoutes] No se pudieron copiar gráficas (bulk):", err?.message || err);
    }

    res.json({
      success: true,
      copiados,
      omitidosSinPermiso,
      omitidosSinOrigen,
      errores,
      graficasCopiadas,
      graficasSource,
    });
  } catch (error) {
    console.error("Error al copiar layouts (bulk):", error);
    res.status(500).json({
      success: false,
      mensaje: "Error al copiar layouts",
      error: error.message,
    });
  }
});

/**
 * POST /api/layouts/:modulo/copiar
 * Copiar layout de un año a otro
 */
router.post("/:modulo/copiar", requireAuth, (req, res) => {
  try {
    const { modulo } = req.params;
    const { empresaId = "EMPRESA01", anioOrigen, anioDestino } = req.body;

    if (!tienePermisoGuardar(req, empresaId, modulo)) {
      return res.status(403).json({
        success: false,
        mensaje: "No cuentas con permisos para copiar layouts",
      });
    }

    if (!anioOrigen || !anioDestino) {
      return res.status(400).json({
        success: false,
        mensaje: "anioOrigen y anioDestino son requeridos",
      });
    }

    const origen = parseInt(anioOrigen, 10);
    const destino = parseInt(anioDestino, 10);
    if (!Number.isInteger(origen) || !Number.isInteger(destino)) {
      return res.status(400).json({
        success: false,
        mensaje: "anioOrigen y anioDestino deben ser números enteros",
      });
    }
    if (origen === destino) {
      return res.status(400).json({
        success: false,
        mensaje: "anioDestino debe ser diferente a anioOrigen",
      });
    }

    const resultado = layoutService.copiarLayout({
      empresaId,
      modulo,
      anioOrigen: origen,
      anioDestino: destino,
    });

    // Copiar gráficas por año.
    // Regla: si el año destino YA tiene config, sobrescribir.
    // Origen: primero `graficas_config_anio(anioOrigen)`, fallback a `graficas_config` legacy.
    let graficasCopiadas = false;
    let graficasSource = null;
    try {
      if (Number.isInteger(origen) && Number.isInteger(destino) && origen !== destino) {
        const fromYear = db
          .prepare(
            "SELECT config_json FROM graficas_config_anio WHERE empresa_id = ? AND anio = ?",
          )
          .get(empresaId, origen);

        const fromLegacy = !fromYear
          ? db
            .prepare("SELECT config_json FROM graficas_config WHERE empresa_id = ?")
            .get(empresaId)
          : null;

        const payload = fromYear?.config_json || fromLegacy?.config_json || null;
        if (payload) {
          db.prepare(
            `
              INSERT INTO graficas_config_anio (empresa_id, anio, config_json, updated_at)
              VALUES (?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(empresa_id, anio) DO UPDATE SET
                config_json = excluded.config_json,
                updated_at = CURRENT_TIMESTAMP
            `,
          ).run(empresaId, destino, payload);
          graficasCopiadas = true;
          graficasSource = fromYear ? "anio" : "legacy";
        }
      }
    } catch (err) {
      console.warn("[layoutRoutes] No se pudieron copiar gráficas:", err?.message || err);
    }

    res.json({
      success: true,
      ...resultado,
      graficasCopiadas,
      graficasSource,
    });
  } catch (error) {
    console.error("Error al copiar layout:", error);
    res.status(500).json({
      success: false,
      mensaje: "Error al copiar layout",
      error: error.message,
    });
  }
});

/**
 * POST /api/layouts/:modulo/:anio/demo
 * Crear plantilla demo para un módulo, año y capítulo
 */
router.post("/:modulo/:anio/demo", requireAuth, (req, res) => {
  try {
    const { modulo, anio } = req.params;
    const {
      empresaId = "EMPRESA01",
      capitulo = "DEFAULT",
      overwrite = false,
    } = req.body || {};

    if (!tienePermisoGuardar(req, empresaId, modulo)) {
      return res.status(403).json({
        success: false,
        mensaje: "No cuentas con permisos para crear plantillas",
      });
    }

    const resultado = layoutService.crearLayoutDemo({
      empresaId,
      modulo,
      anio: parseInt(anio, 10),
      capitulo,
      overwrite: Boolean(overwrite),
    });

    if (resultado.conflict) {
      return res.status(409).json({
        success: false,
        mensaje: resultado.mensaje,
        existe: true,
        capitulo,
      });
    }

    if (!resultado.success) {
      return res.status(400).json({
        success: false,
        mensaje: resultado.mensaje || "No fue posible crear la plantilla.",
      });
    }

    res.json({
      success: true,
      ...resultado,
    });
  } catch (error) {
    console.error("Error al crear plantilla demo:", error);
    res.status(500).json({
      success: false,
      mensaje: "Error al crear plantilla demo",
      error: error.message,
    });
  }
});

/**
 * DELETE /api/layouts/:modulo/:anio
 * Eliminar layout completo de un año
 */
router.delete("/:modulo/:anio", requireAuth, (req, res) => {
  try {
    const { modulo, anio } = req.params;
    const { empresaId = "EMPRESA01" } = req.query;

    // Verificar que no sea el único año disponible
    const aniosDisponibles = layoutService.obtenerAniosDisponibles({
      empresaId,
      modulo,
    });
    if (
      aniosDisponibles.length === 1 &&
      aniosDisponibles[0] === parseInt(anio)
    ) {
      return res.status(400).json({
        success: false,
        mensaje: "No se puede eliminar el único año disponible",
      });
    }

    const resultado = layoutService.eliminarLayout({
      empresaId,
      modulo,
      anio: parseInt(anio),
    });

    res.json({
      success: true,
      ...resultado,
    });
  } catch (error) {
    console.error("Error al eliminar layout:", error);
    res.status(500).json({
      success: false,
      mensaje: "Error al eliminar layout",
      error: error.message,
    });
  }
});

/**
 * POST /api/layouts/:modulo/:anio/reseed
 * Forzar recarga de operaciones desde JSON para un módulo y año
 */
router.post("/:modulo/:anio/reseed", requireAuth, (req, res) => {
  try {
    const { modulo, anio } = req.params;
    const { empresaId = "EMPRESA01" } = req.body;
    const path = require("path");
    const fs = require("fs");

    // Buscar el archivo JSON correcto
    const baseDir = path.resolve(__dirname, "../../info IMPORTANTE");
    const archivoAnio = `CUENTAS SUMMARY y RESUMEN ${anio}.json`;
    const archivoGenerico = "CUENTAS SUMMARY y RESUMEN.json";

    let archivoJson = path.join(baseDir, archivoAnio);
    if (!fs.existsSync(archivoJson)) {
      archivoJson = path.join(baseDir, archivoGenerico);
    }

    if (!fs.existsSync(archivoJson)) {
      return res.status(404).json({
        success: false,
        mensaje: `No se encontró archivo de configuración para ${modulo} ${anio}`,
      });
    }

    const contenido = JSON.parse(fs.readFileSync(archivoJson, "utf8"));
    const operacionesCompletas = contenido["SUMA DE VARIAS SECCIONES"] || [];

    // Filtrar por HOJA (módulo)
    const operaciones = operacionesCompletas.filter(
      (op) => (op.HOJA || "").toUpperCase() === modulo.toUpperCase(),
    );

    if (!operaciones.length) {
      return res.json({
        success: true,
        mensaje: `No hay operaciones de ${modulo} en el archivo`,
        operaciones: 0,
      });
    }

    // Guardar operaciones
    const resultado = layoutService.guardarOperaciones({
      empresaId,
      modulo,
      anio: parseInt(anio),
      operaciones,
    });

    res.json({
      success: true,
      mensaje: `Operaciones recargadas exitosamente desde ${path.basename(
        archivoJson,
      )}`,
      operaciones: operaciones.length,
      resultado,
    });
  } catch (error) {
    console.error("Error al recargar operaciones:", error);
    res.status(500).json({
      success: false,
      mensaje: "Error al recargar operaciones",
      error: error.message,
    });
  }
});

/**
 * PUT /api/layouts/:modulo/:anio/:capitulo/cuenta/:cuenta
 * Actualizar una cuenta específica
 */
router.put(
  "/:modulo/:anio/:capitulo/cuenta/:cuenta",
  requireAuth,
  (req, res) => {
    try {
      const { modulo, anio, capitulo, cuenta } = req.params;
      const { empresaId = "EMPRESA01", datos } = req.body;

      if (!tienePermisoGuardar(req, empresaId, modulo)) {
        return res.status(403).json({
          success: false,
          mensaje: "No cuentas con permisos para editar",
        });
      }

      const resultado = layoutService.actualizarCuenta({
        empresaId,
        modulo,
        anio: parseInt(anio),
        capitulo,
        cuentaOriginal: cuenta,
        datos,
      });

      res.json({
        success: true,
        mensaje: "Cuenta actualizada",
        ...resultado,
      });
    } catch (error) {
      console.error("Error al actualizar cuenta:", error);
      res.status(500).json({
        success: false,
        mensaje: "Error al actualizar cuenta",
        error: error.message,
      });
    }
  },
);

/**
 * DELETE /api/layouts/:modulo/:anio/:capitulo/cuenta/:cuenta
 * Eliminar una cuenta específica
 */
router.delete(
  "/:modulo/:anio/:capitulo/cuenta/:cuenta",
  requireAuth,
  (req, res) => {
    try {
      const { modulo, anio, capitulo, cuenta } = req.params;
      const { empresaId = "EMPRESA01" } = req.query;

      if (!tienePermisoGuardar(req, empresaId, modulo)) {
        return res.status(403).json({
          success: false,
          mensaje: "No cuentas con permisos para eliminar",
        });
      }

      const resultado = layoutService.eliminarCuenta({
        empresaId,
        modulo,
        anio: parseInt(anio),
        capitulo,
        cuenta,
      });

      res.json({
        success: true,
        mensaje: "Cuenta eliminada",
        ...resultado,
      });
    } catch (error) {
      console.error("Error al eliminar cuenta:", error);
      res.status(500).json({
        success: false,
        mensaje: "Error al eliminar cuenta",
        error: error.message,
      });
    }
  },
);

/**
 * POST /api/layouts/:modulo/:anio/:capitulo/reordenar
 * Reordenar cuentas de un layout
 */
router.post("/:modulo/:anio/:capitulo/reordenar", requireAuth, (req, res) => {
  try {
    const { modulo, anio, capitulo } = req.params;
    const { empresaId = "EMPRESA01", orden } = req.body;

    if (!tienePermisoGuardar(req, empresaId, modulo)) {
      return res.status(403).json({
        success: false,
        mensaje: "No cuentas con permisos para reordenar",
      });
    }

    if (!Array.isArray(orden)) {
      return res.status(400).json({
        success: false,
        mensaje: "orden debe ser un array de objetos { cuenta, orden }",
      });
    }

    const resultado = layoutService.reordenarCuentas({
      empresaId,
      modulo,
      anio: parseInt(anio),
      capitulo,
      orden,
    });

    res.json({
      success: true,
      mensaje: "Orden actualizado",
      ...resultado,
    });
  } catch (error) {
    console.error("Error al reordenar:", error);
    res.status(500).json({
      success: false,
      mensaje: "Error al reordenar",
      error: error.message,
    });
  }
});

/**
 * PUT /api/layouts/:modulo/:anio/operacion/:clase
 * Actualizar una operación específica
 */
router.put("/:modulo/:anio/operacion/:clase", requireAuth, (req, res) => {
  try {
    const { modulo, anio, clase } = req.params;
    const { empresaId = "EMPRESA01", datos, capitulo } = req.body;

    if (!tienePermisoGuardar(req, empresaId, modulo)) {
      return res.status(403).json({
        success: false,
        mensaje: "No cuentas con permisos para editar operaciones",
      });
    }

    const resultado = layoutService.actualizarOperacion({
      empresaId,
      modulo,
      anio: parseInt(anio),
      capitulo,
      claseOriginal: decodeURIComponent(clase),
      datos,
    });

    res.json({
      success: true,
      mensaje: "Operación actualizada",
      ...resultado,
    });
  } catch (error) {
    console.error("Error al actualizar operación:", error);
    res.status(500).json({
      success: false,
      mensaje: "Error al actualizar operación",
      error: error.message,
    });
  }
});

/**
 * DELETE /api/layouts/:modulo/:anio/operacion/:clase
 * Eliminar una operación específica
 */
router.delete("/:modulo/:anio/operacion/:clase", requireAuth, (req, res) => {
  try {
    const { modulo, anio, clase } = req.params;
    const { empresaId = "EMPRESA01", capitulo } = req.query;

    if (!tienePermisoGuardar(req, empresaId, modulo)) {
      return res.status(403).json({
        success: false,
        mensaje: "No cuentas con permisos para eliminar operaciones",
      });
    }

    const resultado = layoutService.eliminarOperacion({
      empresaId,
      modulo,
      anio: parseInt(anio),
      capitulo,
      clase: decodeURIComponent(clase),
    });

    res.json({
      success: true,
      mensaje: "Operación eliminada",
      ...resultado,
    });
  } catch (error) {
    console.error("Error al eliminar operación:", error);
    res.status(500).json({
      success: false,
      mensaje: "Error al eliminar operación",
      error: error.message,
    });
  }
});

/**
 * POST /api/layouts/:modulo/:anio/:capitulo/seccion
 * Crear o actualizar una sección
 */
router.post("/:modulo/:anio/:capitulo/seccion", requireAuth, (req, res) => {
  try {
    const { modulo, anio, capitulo } = req.params;
    const {
      empresaId = "EMPRESA01",
      tipo,
      nombre,
      principal,
      orden,
    } = req.body;

    if (!tienePermisoGuardar(req, empresaId, modulo)) {
      return res.status(403).json({
        success: false,
        mensaje: "No cuentas con permisos para crear secciones",
      });
    }

    if (!tipo || !nombre) {
      return res.status(400).json({
        success: false,
        mensaje: "tipo y nombre son requeridos",
      });
    }

    const resultado = layoutService.crearSeccion({
      empresaId,
      modulo,
      anio: parseInt(anio),
      capitulo,
      tipo,
      nombre,
      principal: principal || null,
      orden: orden || 1,
    });

    res.json({
      success: true,
      mensaje: "Sección creada",
      ...resultado,
    });
  } catch (error) {
    console.error("Error al crear sección:", error);
    res.status(500).json({
      success: false,
      mensaje: "Error al crear sección",
      error: error.message,
    });
  }
});

/**
 * PUT /api/layouts/:modulo/:anio/:capitulo/seccion/:nombre
 * Renombrar una sección (actualiza todas las cuentas asociadas)
 */
router.put(
  "/:modulo/:anio/:capitulo/seccion/:nombre",
  requireAuth,
  (req, res) => {
    try {
      const { modulo, anio, capitulo, nombre } = req.params;
      const { empresaId = "EMPRESA01", nuevoNombre, tipo } = req.body;

      if (!tienePermisoGuardar(req, empresaId, modulo)) {
        return res.status(403).json({
          success: false,
          mensaje: "No cuentas con permisos para editar secciones",
        });
      }

      if (!nuevoNombre) {
        return res.status(400).json({
          success: false,
          mensaje: "nuevoNombre es requerido",
        });
      }

      const resultado = layoutService.renombrarSeccion({
        empresaId,
        modulo,
        anio: parseInt(anio),
        capitulo,
        nombreOriginal: decodeURIComponent(nombre),
        nuevoNombre,
        tipo: tipo || "principal",
      });

      res.json({
        success: true,
        mensaje: "Sección renombrada",
        ...resultado,
      });
    } catch (error) {
      console.error("Error al renombrar sección:", error);
      res.status(500).json({
        success: false,
        mensaje: "Error al renombrar sección",
        error: error.message,
      });
    }
  },
);

/**
 * GET /api/layouts-config/:modulo/:anio/:capitulo/bitacora
 * Obtener historial de cambios
 */
router.get("/:modulo/:anio/:capitulo/bitacora", requireAuth, (req, res) => {
  try {
    const { modulo, anio, capitulo } = req.params;
    const { empresaId = "EMPRESA01" } = req.query;

    const bitacora = db
      .prepare(
        `
      SELECT b.*, u.usuario as nombre_usuario
      FROM layout_bitacora b
      LEFT JOIN usuarios u ON b.usuario_id = u.id
      WHERE b.empresa_id = ? AND b.modulo = ? AND b.anio = ? AND b.capitulo = ?
      ORDER BY b.fecha DESC
      LIMIT 100
    `,
      )
      .all(empresaId, modulo, anio, capitulo);

    res.json({ success: true, bitacora });
  } catch (error) {
    res.status(500).json({ success: false, mensaje: error.message });
  }
});

/**
 * POST /api/layouts-config/bitacora
 * Registrar acción en bitácora
 */
router.post("/bitacora", requireAuth, (req, res) => {
  try {
    const { empresaId, modulo, anio, capitulo, accion, detalles } = req.body;
    const usuarioId = req.usuarioActual?.id;

    db.prepare(
      `
      INSERT INTO layout_bitacora (empresa_id, modulo, anio, capitulo, usuario_id, accion, detalles)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    ).run(empresaId, modulo, anio, capitulo, usuarioId, accion, detalles);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, mensaje: error.message });
  }
});

/**
 * GET /api/layouts-config/permisos
 * Obtener mapa de usuarios y permisos por capítulo
 */
router.get("/permisos/capitulos", requireAuth, (req, res) => {
  try {
    if (!req.esAdmin)
      return res
        .status(403)
        .json({ success: false, mensaje: "Solo administradores" });

    const usuarios = db
      .prepare(
        "SELECT id, usuario, nombres FROM usuarios WHERE es_admin_global = 0",
      )
      .all();
    const permisos = db
      .prepare("SELECT * FROM permisos_edicion_capitulo")
      .all();

    res.json({ success: true, usuarios, permisos });
  } catch (error) {
    res.status(500).json({ success: false, mensaje: error.message });
  }
});

/**
 * POST /api/layouts-config/permisos
 * Asignar permisos por capítulo
 */
router.post("/permisos/capitulos", requireAuth, (req, res) => {
  try {
    if (!req.esAdmin)
      return res
        .status(403)
        .json({ success: false, mensaje: "Solo administradores" });

    const { usuarioId, capitulo, puedeEditar } = req.body;

    db.prepare(
      `
      INSERT INTO permisos_edicion_capitulo (usuario_id, capitulo, puede_editar)
      VALUES (?, ?, ?)
      ON CONFLICT(usuario_id, capitulo) DO UPDATE SET puede_editar = excluded.puede_editar
    `,
    ).run(usuarioId, capitulo, puedeEditar ? 1 : 0);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, mensaje: error.message });
  }
});

/**
 * GET /api/layouts-config/:modulo/:anio/exportar-json
 * Exportar layout completo a JSON para seed
 */
router.get("/:modulo/:anio/exportar-json", requireAuth, (req, res) => {
  try {
    const { modulo, anio } = req.params;
    const { empresaId = "EMPRESA01" } = req.query;
    const fs = require("fs");
    const path = require("path");

    const empresaLayoutSource =
      layoutService.obtenerEmpresaLayoutSource(empresaId);
    const anioNumero = parseInt(anio);

    // Obtener cuentas del layout
    const cuentas = db
      .prepare(
        `
      SELECT capitulo as CAPITULO, seccion_principal as "SECCIÓN Principal", 
             seccion_secundaria as "SECCION Secundaria", cuenta as CUENTA, 
             nombre as NOMBRE, operacion_factor, valor_plantilla, visible, orden, orden_presentacion
      FROM layout_cuentas
      WHERE empresa_id = ? AND modulo = ? AND anio = ?
      ORDER BY COALESCE(orden_presentacion, orden), capitulo, seccion_principal, seccion_secundaria
    `,
      )
      .all(empresaLayoutSource, modulo, anioNumero);

    // Obtener operaciones del layout
    const operaciones = db
      .prepare(
        `
      SELECT capitulo as CAPITULO, clase as OperacionId, operacion_etiqueta, clase as Clase, seccion as SECCION,
             operacion_tipo, operacion_label, signo, orden, orden_presentacion, visible, formula_json
      FROM layout_operaciones
      WHERE empresa_id = ? AND modulo = ? AND anio = ?
      ORDER BY COALESCE(orden_presentacion, orden), orden
    `,
      )
      .all(empresaLayoutSource, modulo, anioNumero);

    // Desglosar operaciones con toda la metadata (sin agrupar)
    const operacionesDetalladas = operaciones.map((op) => ({
      CAPITULO: op.CAPITULO,
      OperacionId: op.OperacionId || op.Clase,
      Clase: op.operacion_etiqueta || op.Clase,
      SECCION: op.SECCION,
      tipo: op.operacion_tipo,
      etiqueta: op.operacion_label,
      signo: op.signo,
      orden: op.orden,
      orden_presentacion: op.orden_presentacion,
      visible: op.visible,
      formula_json: op.formula_json,
    }));

    // Organizar operaciones por capítulo para navegación rápida
    const operacionesPorCapitulo = {};
    operacionesDetalladas.forEach((op) => {
      if (!operacionesPorCapitulo[op.CAPITULO]) {
        operacionesPorCapitulo[op.CAPITULO] = [];
      }
      operacionesPorCapitulo[op.CAPITULO].push(op);
    });

    // Agrupar operaciones por clase
    const operacionesAgrupadas = [];
    const operacionesPorClase = {};
    operaciones.forEach((op) => {
      const operacionId = op.OperacionId || op.Clase;
      const operacionEtiqueta = op.operacion_etiqueta || op.Clase;
      if (!operacionesPorClase[operacionId]) {
        operacionesPorClase[operacionId] = {
          CAPITULO: op.CAPITULO,
          OperacionId: operacionId,
          Clase: operacionEtiqueta,
          SECCION: op.SECCION,
          orden: op.orden,
          orden_presentacion: op.orden_presentacion,
          visible: op.visible,
          formula_json: op.formula_json,
          signos: {},
        };
        operacionesAgrupadas.push(operacionesPorClase[operacionId]);
      }
      operacionesPorClase[operacionId][op.operacion_tipo] = op.operacion_label;
      operacionesPorClase[operacionId].signos[op.operacion_tipo] = op.signo;
    });

    const resultado = {
      empresaId: empresaLayoutSource,
      modulo,
      anio: anioNumero,
      cuentasPorCapitulo: cuentas.reduce((acc, cuenta) => {
        if (!acc[cuenta.CAPITULO]) acc[cuenta.CAPITULO] = [];
        acc[cuenta.CAPITULO].push(cuenta);
        return acc;
      }, {}),
      operacionesAgrupadas,
      operacionesDetalladas,
      operacionesPorCapitulo,
      generadoEn: new Date().toISOString(),
    };

    // Guardar archivos JSON centralizados por empresa/año
    const baseDir = path.join(
      process.cwd(),
      "info IMPORTANTE",
      "layouts",
      empresaLayoutSource,
      String(anioNumero),
    );
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }

    const layoutFileName = `${modulo}_layout.json`;
    const layoutFilePath = path.join(baseDir, layoutFileName);
    fs.writeFileSync(
      layoutFilePath,
      JSON.stringify(resultado, null, 2),
      "utf8",
    );

    const operacionesFileName = `${modulo}_operaciones_detalle.json`;
    const operacionesFilePath = path.join(baseDir, operacionesFileName);
    fs.writeFileSync(
      operacionesFilePath,
      JSON.stringify({ operaciones: operacionesDetalladas }, null, 2),
      "utf8",
    );

    // Also export cuentas separately
    const cuentasFileName = `${modulo}_cuentas.json`;
    const cuentasFilePath = path.join(baseDir, cuentasFileName);
    fs.writeFileSync(
      cuentasFilePath,
      JSON.stringify(
        { cuentas, cuentasPorCapitulo: resultado.cuentasPorCapitulo },
        null,
        2,
      ),
      "utf8",
    );

    res.json({
      success: true,
      mensaje: `Layout exportado y centralizado en ${baseDir}`,
      carpeta: baseDir,
      archivoLayout: layoutFilePath,
      archivoOperaciones: operacionesFilePath,
      archivoCuentas: cuentasFilePath,
      cuentas: cuentas.length,
      operaciones: operacionesDetalladas.length,
      data: resultado,
    });
  } catch (error) {
    console.error("Error al exportar layout:", error);
    res.status(500).json({
      success: false,
      mensaje: "Error al exportar layout",
      error: error.message,
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTACIÓN / EXPORTACIÓN MASIVA (plantilla normalizada v2)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convierte tokens V2 a texto legible para referencia (campo "formula_texto").
 * Formato: "+ ACC::401-00-000-00 (Nombre)" etc. El V2 JSON es la fuente de
 * verdad en la importación; este campo es solo informativo.
 */
const formulaTextoDesdeTokensV2 = (tokens = []) => {
  if (!Array.isArray(tokens) || !tokens.length) return "";
  return tokens
    .map((t) => {
      if (!t) return "";
      const op = (t.operator || "+").trim();
      if (t.kind === "ref") {
        const ref = (t.refId || "").toString();
        const lbl = (t.label && String(t.label).trim()) ? ` "${t.label}"` : "";
        return `${op} ${ref}${lbl}`;
      }
      if (t.kind === "const") return `${op} ${t.value ?? 0}`;
      if (t.kind === "op") return (t.value || "").toString();
      return "";
    })
    .filter(Boolean)
    .join(" ")
    .trim();
};

/**
 * Normaliza ID al formato V2: MAYUSCULAS_CON_UNDERSCORES.
 * Replica NORMALIZAR_ID_SEGMENTO del servicio.
 */
const normalizarIdV2 = (valor = "") => {
  const limpio = (valor || "")
    .toString()
    .replace(/\s+/g, " ")
    .trim();
  return limpio
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
};

/**
 * GET /api/layouts-config/:modulo/:anio/plantilla-masiva
 * Exporta el layout completo (operaciones + cuentas) de TODOS los capítulos
 * del módulo/año en un JSON reutilizable para importar-masivo.
 * Parámetro query: ?empresaId=EMPRESA01  (default EMPRESA01)
 */
router.get("/:modulo/:anio/plantilla-masiva", requireAuth, (req, res) => {
  try {
    const { modulo, anio } = req.params;
    const empresaId =
      req.query.empresaId ||
      req.headers["x-empresa-id"] ||
      req.session?.empresaId ||
      "EMPRESA01";
    const anioNum = parseInt(anio, 10);
    if (!modulo || !Number.isInteger(anioNum)) {
      return res
        .status(400)
        .json({ success: false, mensaje: "Parámetros inválidos" });
    }

    const empresaCanonica = layoutService.obtenerEmpresaLayoutSource(empresaId);

    // ── Cargar operaciones (todos los capítulos) ──────────────────────────────
    const opRows = db
      .prepare(`
        SELECT capitulo, clase, operacion_etiqueta, seccion,
               operacion_tipo, operacion_label, signo,
               orden, orden_presentacion, visible, formula_json
        FROM layout_operaciones
        WHERE empresa_id = ? AND modulo = ? AND anio = ?
        ORDER BY COALESCE(orden_presentacion, orden, 0), capitulo, clase
      `)
      .all(empresaCanonica, modulo, anioNum);

    // ── Agrupar por capitulo → clase normalizada ───────────────────────────────
    // Para cada clase, recolectamos: todos sus tipos + la fórmula
    const capMap = {};
    opRows.forEach((row) => {
      const cap = row.capitulo || "DEFAULT";
      const idNorm = normalizarIdV2(row.clase);
      if (!capMap[cap]) capMap[cap] = new Map();
      const key = idNorm || row.clase;
      if (!capMap[cap].has(key)) {
        let fJson = null;
        let fTokens = [];
        try {
          const parsed = JSON.parse(row.formula_json || "null");
          if (parsed && typeof parsed === "object" && Number(parsed.version) === 2 && Array.isArray(parsed.tokens)) {
            fJson = parsed;
            fTokens = parsed.tokens;
          } else if (Array.isArray(parsed) && parsed.length) {
            // legacy → pass-through; el import lo re-normaliza
            fJson = parsed;
          }
        } catch (_) { }
        capMap[cap].set(key, {
          operacion_id: idNorm || row.clase,
          clase: row.operacion_etiqueta || row.clase,
          seccion: row.seccion || "",
          tipos: [],
          formula_texto: formulaTextoDesdeTokensV2(fTokens),
          formula_json: fJson,
          orden: Number.isFinite(Number(row.orden_presentacion))
            ? Number(row.orden_presentacion)
            : Number.isFinite(Number(row.orden))
              ? Number(row.orden)
              : 0,
          visible: row.visible !== 0,
        });
      }
      const entry = capMap[cap].get(key);
      if (row.operacion_tipo && typeof row.operacion_label === "string" && row.operacion_label.trim()) {
        const ya = entry.tipos.find((t) => t.tipo === row.operacion_tipo);
        if (!ya) entry.tipos.push({ tipo: row.operacion_tipo, etiqueta: row.operacion_label.trim() });
      }
      // Si este row tiene formula y el entry no tenía aún, usar la de este row
      if (!entry.formula_json && row.formula_json) {
        try {
          const p = JSON.parse(row.formula_json);
          entry.formula_json = p;
          if (p && Number(p.version) === 2) {
            entry.formula_texto = formulaTextoDesdeTokensV2(p.tokens || []);
          }
        } catch (_) { }
      }
    });

    // ── Cargar cuentas (todos los capítulos) ──────────────────────────────────
    const cuentaRows = db
      .prepare(`
        SELECT capitulo, cuenta, nombre, seccion_principal, seccion_secundaria,
               operacion_factor, valor_plantilla, visible, orden_presentacion
        FROM layout_cuentas
        WHERE empresa_id = ? AND modulo = ? AND anio = ?
        ORDER BY COALESCE(orden_presentacion, orden, 0), capitulo, seccion_principal
      `)
      .all(empresaCanonica, modulo, anioNum);

    const cuentasMap = {};
    cuentaRows.forEach((row) => {
      const cap = row.capitulo || "DEFAULT";
      if (!cuentasMap[cap]) cuentasMap[cap] = [];
      cuentasMap[cap].push({
        cuenta: row.cuenta,
        nombre: row.nombre || "",
        seccion_principal: row.seccion_principal || "",
        seccion_secundaria: row.seccion_secundaria || "",
        factor: Number.isFinite(Number(row.operacion_factor)) ? Number(row.operacion_factor) : 1,
        valor_plantilla: Number.isFinite(Number(row.valor_plantilla)) ? Number(row.valor_plantilla) : 0,
        visible: row.visible !== 0,
      });
    });

    // ── Armar plantilla completa ───────────────────────────────────────────────
    const todosCapitulos = new Set([...Object.keys(capMap), ...Object.keys(cuentasMap)]);
    const capitulos = {};
    todosCapitulos.forEach((cap) => {
      capitulos[cap] = {
        operaciones: Array.from((capMap[cap] || new Map()).values()),
        cuentas: cuentasMap[cap] || [],
      };
    });

    const totalOps = opRows.length;
    const totalCuentas = cuentaRows.length;
    const totalOpsUnicas = Object.values(capMap).reduce((s, m) => s + m.size, 0);

    const plantilla = {
      _meta: {
        version: "2",
        modo: "datos",
        empresa: empresaId,
        empresa_canonica: empresaCanonica,
        modulo,
        anio: anioNum,
        generado: new Date().toISOString(),
        total_capitulos: todosCapitulos.size,
        total_operaciones_unicas: totalOpsUnicas,
        total_registros_db: totalOps,
        total_cuentas: totalCuentas,
      },
      _instrucciones: {
        descripcion:
          "Backup completo de operaciones y cuentas de todos los capítulos. " +
          "Se puede re-importar directamente con 'Importar todos los capítulos'.",
        advertencia:
          "La importación hace OVERWRITE de los capítulos incluidos en este archivo. " +
          "Los capítulos que NO aparezcan aquí no se modifican.",
        campos_operacion: {
          operacion_id: "ID único. Se normaliza automáticamente a MAYUSCULAS_CON_UNDERSCORES.",
          clase: "Nombre legible de la operación.",
          tipos: "Tipos de fila (sum-row, result-row, net-row, operation-row, etc.).",
          formula_texto: "SOLO LECTURA. Referencia legible de la fórmula.",
          formula_json:
            "EDITABLE. { version:2, tokens:[{kind,refType,refId,label,operator}] } " +
            "o texto con ACC::, OP::, SEC::.",
        },
        campos_cuenta: {
          cuenta: "Código de cuenta (ej: 401-00-000-00).",
          nombre: "Nombre descriptivo.",
          seccion_principal: "Sección principal donde aparece la cuenta.",
          seccion_secundaria: "Subsección (opcional).",
          factor: "Multiplicador: 1 suma, -1 resta. Default: 1.",
          visible: "true/false. Default: true.",
        },
      },
      capitulos,
    };

    const nombreArchivo = `layout_${modulo}_${anioNum}_${empresaCanonica}.json`;
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${nombreArchivo}"`,
    );
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.send(JSON.stringify(plantilla, null, 2));
  } catch (error) {
    console.error("[plantilla-masiva] Error al exportar:", error);
    res.status(500).json({
      success: false,
      mensaje: "Error al exportar layout",
      error: error.message,
    });
  }
});

/**
 * POST /api/layouts-config/:modulo/:anio/importar-masivo
 * Importa un JSON (generado por plantilla-masiva) y hace OVERWRITE de
 * los capítulos incluidos en el archivo.  Para cada capítulo:
 *   1) Elimina operaciones, cuentas y secciones existentes.
 *   2) Guarda las operaciones del archivo (normaliza fórmulas → V2).
 *   3) Guarda las cuentas del archivo.
 *   4) Crea snapshot de versión para poder deshacer.
 *
 * Body: JSON con la misma estructura que el export de arriba.
 * Header opcional: X-Empresa-Id (sobreescribe _meta.empresa del archivo)
 */
router.post("/:modulo/:anio/importar-masivo", requireAuth, (req, res) => {
  try {
    const { modulo, anio } = req.params;
    const anioNum = parseInt(anio, 10);

    if (!modulo || !Number.isInteger(anioNum)) {
      return res
        .status(400)
        .json({ success: false, mensaje: "Parámetros inválidos" });
    }

    const payload = req.body;
    if (!payload || typeof payload !== "object" || !payload.capitulos) {
      return res.status(400).json({
        success: false,
        mensaje:
          "El archivo no tiene el formato esperado. " +
          "Genera el archivo con 'Exportar todos los capítulos'.",
      });
    }

    // Empresa: header > archivo > sesión > default
    const empresaId =
      req.headers["x-empresa-id"] ||
      payload._meta?.empresa ||
      req.session?.empresaId ||
      "EMPRESA01";

    // Verificar permiso a nivel módulo (sin capitulo = verifica permiso general)
    if (!tienePermisoGuardar(req, empresaId, modulo)) {
      return res.status(403).json({
        success: false,
        mensaje: "Sin permiso para guardar layouts en este módulo.",
      });
    }

    const usuarioId = req.usuarioActual?.id ?? null;
    const resumen = {
      empresa: empresaId,
      modulo,
      anio: anioNum,
      capitulos_procesados: [],
      total_operaciones: 0,
      total_cuentas: 0,
      total_errores: 0,
      errores: [],
    };

    for (const [capituloRaw, capData] of Object.entries(payload.capitulos)) {
      const capitulo = (capituloRaw || "").trim();
      if (!capitulo) continue;

      const operacionesTemplate = Array.isArray(capData?.operaciones)
        ? capData.operaciones
        : [];
      const cuentasTemplate = Array.isArray(capData?.cuentas)
        ? capData.cuentas
        : [];

      try {
        // ── 1. Borrar todo lo existente en este capítulo ──
        layoutService.eliminarLayoutCapitulo({
          empresaId,
          modulo,
          anio: anioNum,
          capitulo,
        });

        // ── 2. Guardar operaciones ────────────────────────────────────────────
        let opsGuardadas = 0;
        if (operacionesTemplate.length) {
          const opsParaGuardar = operacionesTemplate
            .map((op, idx) => {
              const rawId = String(
                op.operacion_id || op.clase || "",
              ).trim();
              const rawClase = String(
                op.clase || op.operacion_id || "",
              ).trim();
              if (!rawId && !rawClase) return null;

              const idNormal = normalizarIdV2(rawId || rawClase);

              const opObj = {
                OperacionId: idNormal,
                Clase: rawClase || idNormal,
                operacion_etiqueta: rawClase || idNormal,
                CAPITULO: capitulo,
                SECCION: String(op.seccion || "").trim(),
                formula_json: op.formula_json
                  ? typeof op.formula_json === "string"
                    ? op.formula_json
                    : JSON.stringify(op.formula_json)
                  : null,
                signo: Number.isFinite(Number(op.signo)) ? Number(op.signo) : 1,
                orden: Number.isFinite(Number(op.orden)) ? Number(op.orden) : idx,
                orden_presentacion: Number.isFinite(Number(op.orden))
                  ? Number(op.orden)
                  : idx,
                visible: op.visible !== false,
              };

              // Tipos de fila
              if (Array.isArray(op.tipos) && op.tipos.length) {
                op.tipos.forEach((t) => {
                  if (t?.tipo && typeof t.etiqueta === "string") {
                    opObj[t.tipo] = t.etiqueta.trim();
                  }
                });
              } else {
                opObj["sum-row"] = rawClase || idNormal;
              }

              return opObj;
            })
            .filter(Boolean);

          if (opsParaGuardar.length) {
            const r = layoutService.guardarOperaciones({
              empresaId,
              modulo,
              anio: anioNum,
              operaciones: opsParaGuardar,
            });
            opsGuardadas = r?.insertadas ?? opsParaGuardar.length;
          }
        }

        // ── 3. Guardar cuentas ────────────────────────────────────────────────
        let cuentasGuardadas = 0;
        if (cuentasTemplate.length) {
          // Normalizar campos al formato que espera guardarCuentas:
          // acepta lowercase (cuenta, seccion_principal, seccion_secundaria,
          // factor, operacion_factor, valor_plantilla, visible, nombre)
          const cuentasNorm = cuentasTemplate.map((c) => ({
            cuenta: c.cuenta || c.CUENTA || "",
            CUENTA: c.cuenta || c.CUENTA || "",
            nombre: c.nombre || c.NOMBRE || "",
            NOMBRE: c.nombre || c.NOMBRE || "",
            seccion_principal:
              c.seccion_principal || c.SECCION || c.seccion || "",
            seccion_secundaria:
              c.seccion_secundaria || c.subseccion || "",
            operacion_factor: c.factor ?? c.operacion_factor ?? 1,
            factor: c.factor ?? c.operacion_factor ?? 1,
            valor_plantilla: c.valor_plantilla ?? c.valor ?? 0,
            visible: c.visible !== false,
            orden_presentacion: c.orden_presentacion ?? c.orden ?? 0,
          }));

          const rc = layoutService.guardarCuentas({
            empresaId,
            modulo,
            anio: anioNum,
            capitulo,
            cuentas: cuentasNorm,
          });
          cuentasGuardadas = rc?.insertadas ?? cuentasNorm.length;
        }

        // ── 4. Snapshot de versión (para deshacer) ────────────────────────────
        try {
          layoutService.crearLayoutVersion({
            empresaId,
            modulo,
            anio: anioNum,
            capitulo,
            usuarioId,
            source: "importar-masivo",
            motivo: `Importación masiva: ${opsGuardadas} ops, ${cuentasGuardadas} cuentas`,
          });
        } catch (vErr) {
          console.warn(
            `[importar-masivo] No se pudo crear snapshot para ${capitulo}:`,
            vErr?.message,
          );
        }

        resumen.capitulos_procesados.push({
          capitulo,
          operaciones: opsGuardadas,
          cuentas: cuentasGuardadas,
        });
        resumen.total_operaciones += opsGuardadas;
        resumen.total_cuentas += cuentasGuardadas;
      } catch (err) {
        console.error(
          `[importar-masivo] Error en capítulo ${capitulo}:`,
          err.message,
        );
        resumen.total_errores += 1;
        resumen.errores.push({ capitulo, error: err.message });
        resumen.capitulos_procesados.push({
          capitulo,
          operaciones: 0,
          cuentas: 0,
          error: err.message,
        });
      }
    }

    const ok = resumen.total_errores === 0;
    res.status(ok ? 200 : 207).json({
      success: ok,
      mensaje: ok
        ? `Importación completada: ${resumen.total_operaciones} operaciones y ` +
        `${resumen.total_cuentas} cuentas en ${resumen.capitulos_procesados.length} capítulo(s)`
        : `Importación con ${resumen.total_errores} error(es). ` +
        `${resumen.capitulos_procesados.length - resumen.total_errores} capítulo(s) OK.`,
      ...resumen,
    });
  } catch (error) {
    console.error("[importar-masivo] Error general:", error);
    res.status(500).json({
      success: false,
      mensaje: "Error al importar layout",
      error: error.message,
    });
  }
});

/**
 * POST /api/layouts-config/:modulo/:anio/seed-operaciones
 * Seed operations from JSON file to SQLite database
 */
router.post("/:modulo/:anio/seed-operaciones", requireAuth, (req, res) => {
  try {
    const { modulo, anio } = req.params;
    const { empresaId = "EMPRESA01" } = req.body;
    const fs = require("fs");
    const path = require("path");

    // Read operations from JSON file
    const jsonPath = path.join(
      process.cwd(),
      "info IMPORTANTE",
      "CUENTAS SUMMARY y RESUMEN 2025.json",
    );

    if (!fs.existsSync(jsonPath)) {
      return res.status(404).json({
        success: false,
        mensaje: "Archivo JSON no encontrado: " + jsonPath,
      });
    }

    const contenido = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    const operacionesJSON = contenido["SUMA DE VARIAS SECCIONES"] || [];

    if (operacionesJSON.length === 0) {
      return res.status(400).json({
        success: false,
        mensaje: "No se encontraron operaciones en el archivo JSON",
      });
    }

    // Filter operations for the requested module
    const operacionesFiltradas = operacionesJSON.filter(
      (op) => op.HOJA === modulo || op.HOJA === undefined, // Include if matches module or is global
    );

    // Save to SQLite using existing service
    const resultado = layoutService.guardarOperaciones({
      empresaId,
      modulo,
      anio: parseInt(anio),
      operaciones: operacionesFiltradas,
    });

    res.json({
      success: true,
      mensaje: `Seeded ${operacionesFiltradas.length} operaciones for ${modulo} ${anio}`,
      operacionesEnJSON: operacionesJSON.length,
      operacionesFiltradas: operacionesFiltradas.length,
      ...resultado,
    });
  } catch (error) {
    console.error("Error seeding operaciones:", error);
    res.status(500).json({
      success: false,
      mensaje: "Error al hacer seed de operaciones",
      error: error.message,
    });
  }
});

module.exports = router;
