const layoutService = require("./layoutService");
const { db } = require("../db/sqlite");

const MODULO_MAP = {
  SUMMARY: "SUMMARY",
  RESUMEN: "RESUMEN",
  MEMBRESIA: "Membresía",
  SERV_MEMBRESIA: "Serv Membresía",
  COMITES: "Comités",
  COMUNICACION: "Comunicación",
  DIRECCION: "Dirección",
  EVENTOS: "Eventos",
  FINANZAS: "Finanzas",
  GTOS_CORPORATIVOS: "Gtos Corporativos",
  PRESUPUESTOS: "Presupuestos",
  RH: "RH",
  TIC: "T&IC",
  VPE: "VPE",
};

const resolverModuloDesdeTipo = (moduleType = "") => {
  if (!moduleType) return null;
  if (moduleType === "SUMMARY" || moduleType === "RESUMEN") {
    return moduleType;
  }
  if (moduleType.startsWith("MODULOS_")) {
    const clave = moduleType.replace("MODULOS_", "").toUpperCase();
    return MODULO_MAP[clave] || moduleType.replace("MODULOS_", "");
  }
  if (moduleType === "MODULOS") {
    return "Finanzas";
  }
  const clave = moduleType.toUpperCase();
  return MODULO_MAP[clave] || moduleType;
};

const formatearCuentaDesdeSqlite = (cuenta, capitulo) => {
  const seccionPrincipal =
    cuenta["SECCION Principal"] ||
    cuenta["SECCIàN Principal"] ||
    cuenta["SECCIÓN Principal"] ||
    cuenta.SECCION ||
    cuenta.seccion_principal ||
    "";
  const seccionSecundaria =
    cuenta["SECCION Secundaria"] ||
    cuenta["SECCIÓN Secundaria"] ||
    cuenta.seccion_secundaria ||
    "";
  const ordenPresentacion = Number.isFinite(Number(cuenta.orden_presentacion))
    ? Number(cuenta.orden_presentacion)
    : Number.isFinite(Number(cuenta.orden))
    ? Number(cuenta.orden)
    : 0;
  return {
    CAPITULO: capitulo,
    CUENTA: cuenta.CUENTA,
    NOMBRE: cuenta.NOMBRE,
    "SECCION Principal": seccionPrincipal,
    "SECCIàN Principal": seccionPrincipal,
    "SECCIÓN Principal": seccionPrincipal,
    "SECCION Secundaria": seccionSecundaria,
    SECCION: seccionPrincipal,
    seccion_principal: seccionPrincipal,
    seccion_secundaria: seccionSecundaria,
    orden: ordenPresentacion,
    orden_presentacion: ordenPresentacion,
  };
};

const agruparPorCapitulo = (items = []) => {
  const mapa = new Map();
  items.forEach((item) => {
    const capitulo = item.CAPITULO || "DEFAULT";
    if (!mapa.has(capitulo)) {
      mapa.set(capitulo, []);
    }
    mapa.get(capitulo).push(item);
  });
  return mapa;
};

const loadLayoutConfig = (moduleType, opciones = {}) => {
  const empresaId = opciones.empresaId || "EMPRESA01";
  const anio = Number(opciones.anio) || new Date().getFullYear();
  const moduloReal = resolverModuloDesdeTipo(moduleType);

  if (!moduloReal) {
    throw new Error("Módulo desconocido: " + moduleType);
  }

  const capitulos =
    layoutService.obtenerCapitulos({ empresaId, modulo: moduloReal, anio }) ||
    [];

  const resultado = {
    [moduleType]: [],
    "SUMA DE VARIAS SECCIONES": [],
  };

  for (const cap of capitulos) {
    const layout = layoutService.obtenerLayout({
      empresaId,
      modulo: moduloReal,
      anio,
      capitulo: cap.capitulo,
    });

    (layout.cuentas || []).forEach((cuenta) => {
      resultado[moduleType].push(
        formatearCuentaDesdeSqlite(cuenta, cap.capitulo)
      );
    });

    if (Array.isArray(layout.operaciones)) {
      resultado["SUMA DE VARIAS SECCIONES"].push(
        ...layout.operaciones.map((op) => ({
          ...op,
          CAPITULO: op.CAPITULO || cap.capitulo,
        }))
      );
    }
  }

  return resultado;
};

const saveLayoutConfig = (moduleType, data, opciones = {}) => {
  const empresaId = opciones.empresaId || "EMPRESA01";
  const anio = Number(opciones.anio) || new Date().getFullYear();
  const moduloReal = resolverModuloDesdeTipo(moduleType);

  if (!moduloReal) {
    throw new Error("Módulo desconocido: " + moduleType);
  }

  const cuentas = data[moduleType] || [];
  const operaciones = data["SUMA DE VARIAS SECCIONES"] || [];

  // Snapshot existing formula_json values before deleting to prevent corruption
  // during the delete-and-reinsert round-trip.
  let formulaBackup = new Map();
  try {
    const rows = db.prepare(`
      SELECT DISTINCT clase, formula_json
      FROM layout_operaciones
      WHERE empresa_id = ? AND modulo = ? AND anio = ?
        AND formula_json IS NOT NULL AND formula_json != '' AND formula_json != '[]'
    `).all(empresaId, moduloReal, anio);
    rows.forEach((r) => {
      if (r.clase && r.formula_json) formulaBackup.set(r.clase, r.formula_json);
    });
  } catch (err) {
    console.warn("[saveLayoutConfig] No se pudo hacer backup de fórmulas:", err.message);
  }

  layoutService.eliminarLayout({ empresaId, modulo: moduloReal, anio });

  const porCapitulo = agruparPorCapitulo(cuentas);
  porCapitulo.forEach((cuentasCapitulo, capitulo) => {
    layoutService.guardarCuentas({
      empresaId,
      modulo: moduloReal,
      anio,
      capitulo,
      cuentas: cuentasCapitulo,
    });
  });

  if (operaciones.length) {
    layoutService.guardarOperaciones({
      empresaId,
      modulo: moduloReal,
      anio,
      operaciones,
    });
  }

  // Restore formula_json for pre-existing operations.
  // saveLayoutConfig is only called when adding/editing cuentas or secciones,
  // never for explicit formula edits (those go through layoutRoutes → actualizarOperacion).
  // Always restoring from backup prevents ANY round-trip corruption including
  // cases where normalizarFormulaOperacion produces a different non-null value.
  if (formulaBackup.size > 0) {
    try {
      const restoreStmt = db.prepare(`
        UPDATE layout_operaciones
        SET formula_json = ?
        WHERE empresa_id = ? AND modulo = ? AND anio = ? AND clase = ?
      `);
      formulaBackup.forEach((formulaJson, clase) => {
        restoreStmt.run(formulaJson, empresaId, moduloReal, anio, clase);
      });
    } catch (err) {
      console.warn("[saveLayoutConfig] No se pudo restaurar fórmulas:", err.message);
    }
  }

  return true;
};

module.exports = {
  loadLayoutConfig,
  saveLayoutConfig,
  resolverModuloDesdeTipo,
};
