/**
 * layoutService.js
 * Servicio para gestionar layouts de módulos por año y capítulo en SQLite
 */

const { EMPRESAS } = require("../config/empresas");
const db = require("../db/sqlite").db;
const crypto = require("crypto");

const CANONICAL_EMPRESA_DEFAULT = "EMPRESA01";
// Fallbacks desactivados: no autoclone ni herencia implícita de layouts.
const AUTO_LAYOUT_CLONE = false;
// Alias explícito de layouts para comparativas (no es fallback).
const LAYOUT_EMPRESA_ALIAS = {
  EMPRESA09: "EMPRESA01",
  EMPRESA10: "EMPRESA02",
  EMPRESA11: "EMPRESA03",
  EMPRESA12: "EMPRESA04",
};

// Normalización fuerte de claves para evitar duplicados por:
// - tildes/diacríticos ("MÉXICO" vs "MEXICO")
// - caracteres invisibles (zero-width/BOM) colados desde Excel/CSV
// - múltiples espacios
const LIMPIAR_CLAVE = (valor = "") =>
  (valor || "")
    .toString()
    .replace(/\u0000/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const NORMALIZAR_CLAVE = (valor = "") =>
  LIMPIAR_CLAVE(valor)
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const NORMALIZAR_CAPITULO = (valor = "") => NORMALIZAR_CLAVE(valor);

const canonizarCapituloLabel = (capitulo = "") => {
  const key = NORMALIZAR_CAPITULO(capitulo || "");
  return key || "DEFAULT";
};

const listarCapitulosDb = ({ empresaId, modulo, anio }) => {
  const anioNumero = Number(anio);
  if (!empresaId || !modulo || !Number.isInteger(anioNumero)) return [];
  const rows = db
    .prepare(
      `
    SELECT DISTINCT capitulo
    FROM (
      SELECT capitulo FROM layout_cuentas WHERE empresa_id = ? AND modulo = ? AND anio = ?
      UNION
      SELECT capitulo FROM layout_operaciones WHERE empresa_id = ? AND modulo = ? AND anio = ?
      UNION
      SELECT capitulo FROM layout_secciones WHERE empresa_id = ? AND modulo = ? AND anio = ?
    )
    ORDER BY capitulo ASC
  `
    )
    .all(
      empresaId,
      modulo,
      anioNumero,
      empresaId,
      modulo,
      anioNumero,
      empresaId,
      modulo,
      anioNumero
    );
  return (rows || [])
    .map((r) => (r?.capitulo || "").toString())
    .map((c) => LIMPIAR_CLAVE(c))
    .filter(Boolean);
};

const obtenerCapitulosEquivalentes = ({
  empresaId,
  modulo,
  anio,
  capitulo,
}) => {
  const original = LIMPIAR_CLAVE(capitulo || "DEFAULT") || "DEFAULT";
  const key = NORMALIZAR_CAPITULO(original);
  if (!key) return [original];

  const existentes = listarCapitulosDb({ empresaId, modulo, anio });
  const matches = existentes.filter((c) => NORMALIZAR_CAPITULO(c) === key);
  const uniq = new Map();
  [original, ...matches].forEach((c) => {
    const clean = LIMPIAR_CLAVE(c);
    if (!clean) return;
    if (NORMALIZAR_CAPITULO(clean) !== key) return;
    if (!uniq.has(clean)) uniq.set(clean, clean);
  });
  return Array.from(uniq.values());
};

const obtenerStatsCapituloDb = ({ empresaId, modulo, anio, capitulo }) => {
  const anioNumero = Number(anio);
  if (!empresaId || !modulo || !Number.isInteger(anioNumero) || !capitulo) {
    return {
      total: 0,
      maxUpdated: "",
      cuentas: { total: 0, maxUpdated: "" },
      operaciones: { total: 0, maxUpdated: "" },
      secciones: { total: 0, maxUpdated: "" },
    };
  }

  const readStats = (tabla) => {
    try {
      const row = db
        .prepare(
          `
        SELECT COUNT(*) as total, MAX(actualizado_en) as maxUpdated
        FROM ${tabla}
        WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ?
      `
        )
        .get(empresaId, modulo, anioNumero, capitulo);
      return {
        total: Number(row?.total) || 0,
        maxUpdated: (row?.maxUpdated || "").toString(),
      };
    } catch (err) {
      // Si la tabla/columna no existe en alguna BD vieja, no reventar la lectura.
      return { total: 0, maxUpdated: "" };
    }
  };

  const cuentas = readStats("layout_cuentas");
  const operaciones = readStats("layout_operaciones");
  const secciones = readStats("layout_secciones");
  const maxUpdated = [cuentas.maxUpdated, operaciones.maxUpdated, secciones.maxUpdated]
    .filter(Boolean)
    .sort()
    .slice(-1)[0] || "";
  return {
    total: cuentas.total + operaciones.total + secciones.total,
    maxUpdated,
    cuentas,
    operaciones,
    secciones,
  };
};

// Cuando existen capítulos duplicados por tildes/espacios invisibles (p.ej. "MÉXICO" vs "MEXICO"),
// NO debemos leer "capitulo IN (...)" porque duplica filas. Elegimos una única fuente.
const resolverCapituloConsulta = ({
  empresaId,
  modulo,
  anio,
  capituloSolicitado,
  capituloCanonico,
  candidatos = [],
}) => {
  const requested = LIMPIAR_CLAVE(capituloSolicitado || "DEFAULT") || "DEFAULT";
  const canon = LIMPIAR_CLAVE(capituloCanonico || requested) || requested;

  const uniq = new Map();
  (Array.isArray(candidatos) ? candidatos : [])
    .map((c) => LIMPIAR_CLAVE(c))
    .filter(Boolean)
    .forEach((c) => {
      if (!uniq.has(c)) uniq.set(c, c);
    });

  const list = Array.from(uniq.values());
  if (!list.length) return canon;
  if (list.length === 1) return list[0];

  const canonicalCandidate = list.find(
    (c) => LIMPIAR_CLAVE(c).toUpperCase() === canon
  );
  const requestedCandidate = list.find((c) => c === requested);

  const stats = list.map((cap) => ({
    capitulo: cap,
    ...obtenerStatsCapituloDb({ empresaId, modulo, anio, capitulo: cap }),
  }));

  stats.sort((a, b) => {
    const byUpdated = (b.maxUpdated || "").localeCompare(a.maxUpdated || "");
    if (byUpdated) return byUpdated;
    const byTotal = (b.total || 0) - (a.total || 0);
    if (byTotal) return byTotal;
    // Preferir canónico sin tildes si existe.
    if (canonicalCandidate && a.capitulo === canonicalCandidate) return -1;
    if (canonicalCandidate && b.capitulo === canonicalCandidate) return 1;
    // Si el usuario pidió exactamente una variante, preferirla.
    if (requestedCandidate && a.capitulo === requestedCandidate) return -1;
    if (requestedCandidate && b.capitulo === requestedCandidate) return 1;
    return a.capitulo.localeCompare(b.capitulo);
  });

  const elegido = stats[0]?.capitulo || canon;
  if (list.length > 1 && elegido) {
    console.warn(
      `[layoutService] Capitulos equivalentes detectados (${requested}): [${list.join(
        ", "
      )}] -> usando "${elegido}"`
    );
  }
  return elegido;
};

const generarVariantesEmpresa = (empresaId = CANONICAL_EMPRESA_DEFAULT) => {
  const variantes = new Set();
  const base = (empresaId || "").toString().trim();
  if (!base) return [CANONICAL_EMPRESA_DEFAULT];

  variantes.add(base);
  const upper = base.toUpperCase();
  variantes.add(upper);

  // Intentar extraer número de diferentes formatos
  let numero = null;

  // Manejar formato EMPRESA01, EMPRESA02, EMPRESA 01, etc.
  let match = upper.match(/EMPRESA\s*0*(\d+)/i);
  if (match) {
    numero = parseInt(match[1], 10);
  }

  // Manejar formato empresa1, empresa2, etc. (minúsculas sin ceros)
  if (!numero) {
    match = base.match(/empresa(\d+)/i);
    if (match) {
      numero = parseInt(match[1], 10);
    }
  }

  // Buscar en metadatos de empresas
  if (!numero) {
    const meta = EMPRESAS?.find(
      (empresa) => empresa.id?.toLowerCase() === base.toLowerCase()
    );
    if (meta && meta.numero != null) {
      numero = meta.numero;
    }
  }

  // Si encontramos un número, generar TODAS las variantes posibles
  if (numero && Number.isInteger(numero) && numero > 0) {
    // Formato canónico: EMPRESA01, EMPRESA02, etc.
    variantes.add(`EMPRESA${String(numero).padStart(2, "0")}`);

    // Formato sin ceros: EMPRESA1, EMPRESA2, etc.
    variantes.add(`EMPRESA${numero}`);

    // Formato minúscula con ceros: empresa01, empresa02, etc.
    variantes.add(`empresa${String(numero).padStart(2, "0")}`);

    // Formato minúscula sin ceros: empresa1, empresa2, etc.
    variantes.add(`empresa${numero}`);
  }

  const resultado = Array.from(variantes).filter(Boolean);
  console.log(`[generarVariantesEmpresa] ${base} -> [${resultado.join(', ')}]`);
  return resultado;
};

const obtenerEmpresaCanonica = (empresaId = CANONICAL_EMPRESA_DEFAULT) => {
  const variantes = generarVariantesEmpresa(empresaId);
  const canonica = variantes.find((valor) => /^EMPRESA\d{2}$/i.test(valor));
  if (canonica) {
    // Normalizar para que alias por comparativas (EMPRESA09-12) funcione sin depender del case.
    return canonica.toUpperCase();
  }
  return variantes[variantes.length - 1] || CANONICAL_EMPRESA_DEFAULT;
};

const resolverEmpresaLayoutSource = (empresaId = CANONICAL_EMPRESA_DEFAULT) => {
  const canonica = obtenerEmpresaCanonica(empresaId);
  return LAYOUT_EMPRESA_ALIAS[canonica] || canonica;
};

const existeLayoutAnio = ({ empresaId, modulo, anio }) => {
  const row = db
    .prepare(
      `
    SELECT COUNT(*) as total
    FROM layout_cuentas
    WHERE empresa_id = ? AND modulo = ? AND anio = ?
    LIMIT 1
  `
    )
    .get(empresaId, modulo, anio);
  return Boolean(row && row.total);
};

const existeLayoutCapitulo = ({ empresaId, modulo, anio, capitulo }) => {
  const row = db
    .prepare(
      `
    SELECT COUNT(*) as total
    FROM layout_cuentas
    WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ?
    LIMIT 1
  `
    )
    .get(empresaId, modulo, anio, capitulo);
  return Boolean(row && row.total);
};

const buscarAnioReferencia = ({ empresaId, modulo, anio }) => {
  const menorIgual = db
    .prepare(
      `
    SELECT MAX(anio) as anio
    FROM layout_cuentas
    WHERE empresa_id = ? AND modulo = ? AND anio <= ?
  `
    )
    .get(empresaId, modulo, anio);
  if (menorIgual && Number.isInteger(menorIgual.anio)) {
    return menorIgual.anio;
  }
  const mayor = db
    .prepare(
      `
    SELECT MIN(anio) as anio
    FROM layout_cuentas
    WHERE empresa_id = ? AND modulo = ? AND anio > ?
  `
    )
    .get(empresaId, modulo, anio);
  if (mayor && Number.isInteger(mayor.anio)) {
    return mayor.anio;
  }
  const cualquiera = db
    .prepare(
      `
    SELECT MIN(anio) as anio
    FROM layout_cuentas
    WHERE empresa_id = ? AND modulo = ?
  `
    )
    .get(empresaId, modulo);
  if (cualquiera && Number.isInteger(cualquiera.anio)) {
    return cualquiera.anio;
  }
  return null;
};

const asegurarLayoutAnio = ({ empresaId, modulo, anio }) => {
  const empresaCanonica = resolverEmpresaLayoutSource(empresaId);
  const anioNumero = Number(anio);
  if (!Number.isInteger(anioNumero)) {
    return false;
  }
  if (
    existeLayoutAnio({ empresaId: empresaCanonica, modulo, anio: anioNumero })
  ) {
    return true;
  }
  const anioReferencia = buscarAnioReferencia({
    empresaId: empresaCanonica,
    modulo,
    anio: anioNumero,
  });
  if (!anioReferencia || anioReferencia === anioNumero) {
    return false;
  }
  try {
    copiarLayout({
      empresaId: empresaCanonica,
      modulo,
      anioOrigen: anioReferencia,
      anioDestino: anioNumero,
    });
    console.log(
      `[layoutService] Layout ${modulo} ${anioNumero} generado desde ${anioReferencia}`
    );
    return true;
  } catch (err) {
    console.warn(
      `[layoutService] No se pudo clonar layout ${modulo}/${anioNumero}:`,
      err?.message || err
    );
    return false;
  }
};

const resolverEmpresaConsulta = ({ empresaId, modulo, anio }) => {
  const variantes = generarVariantesEmpresa(empresaId);
  if (!modulo || !anio) {
    return obtenerEmpresaCanonica(empresaId);
  }
  for (const candidata of variantes) {
    const row = db
      .prepare(
        `
      SELECT COUNT(*) as total
      FROM layout_cuentas
      WHERE empresa_id = ? AND modulo = ? AND anio = ?
      LIMIT 1
    `
      )
      .get(candidata, modulo, anio);
    if (row && row.total > 0) {
      return candidata;
    }
  }
  // Sin fallback a EMPRESA01 ni a otras empresas.
  return obtenerEmpresaCanonica(empresaId);
};

const construirRespuestaLayout = ({
  empresaId,
  modulo,
  anio,
  capitulo,
  cuentas,
  operaciones,
}) => {
  const respuesta = {
    empresaId,
    modulo,
    anio,
    capitulo,
    cuentas,
    operaciones,
  };
  respuesta[modulo] = cuentas;
  respuesta["SUMA DE VARIAS SECCIONES"] = operaciones;
  return respuesta;
};

const eliminarLayoutCapitulo = ({
  empresaId = "EMPRESA01",
  modulo,
  anio,
  capitulo,
}) => {
  const empresaCanonica = resolverEmpresaLayoutSource(empresaId);
  const anioNumero = Number(anio);
  if (!modulo || !Number.isInteger(anioNumero) || !capitulo) {
    return { success: false };
  }

  const capituloSolicitado = LIMPIAR_CLAVE(capitulo || "DEFAULT") || "DEFAULT";
  const capitulosEquivalentes = obtenerCapitulosEquivalentes({
    empresaId: empresaCanonica,
    modulo,
    anio: anioNumero,
    capitulo: capituloSolicitado,
  });
  const capitulosBorrar = capitulosEquivalentes.length
    ? capitulosEquivalentes
    : [capituloSolicitado];

  const deleteCuentas = db.prepare(`
    DELETE FROM layout_cuentas
    WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ?
  `);
  const deleteOperaciones = db.prepare(`
    DELETE FROM layout_operaciones
    WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ?
  `);
  const deleteSecciones = db.prepare(`
    DELETE FROM layout_secciones
    WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ?
  `);

  const transaction = db.transaction(() => {
    capitulosBorrar.forEach((cap) => {
      deleteCuentas.run(empresaCanonica, modulo, anioNumero, cap);
      deleteOperaciones.run(empresaCanonica, modulo, anioNumero, cap);
      deleteSecciones.run(empresaCanonica, modulo, anioNumero, cap);
    });
  });

  transaction();
  return { success: true };
};

const construirPlantillaDemo = ({ modulo, capitulo }) => {
  const moduloNormalizado = (modulo || "").toString().trim().toUpperCase();
  const esSummary = moduloNormalizado === "SUMMARY";
  const esResumen = moduloNormalizado === "RESUMEN";
  const formato = esSummary ? "summary" : "resumen";
  const cuentas = [];
  let orden = 0;

  const crearCodigo = (prefijo, index) => {
    if (formato === "summary") {
      return `${prefijo}${String(index + 1).padStart(3, "0")}`;
    }
    return `${prefijo}${String(index + 1).padStart(2, "0")}`;
  };

  const seccionesResumen = [
    {
      principal: "INGRESOS",
      secundaria: "Membresías",
      prefijoSummary: "401000000000000000",
      prefijoResumen: "401-001-000-",
      cuentas: ["Cuotas netas", "Ingresos socios nuevos"],
    },
    {
      principal: "GASTOS",
      secundaria: "Operativos",
      prefijoSummary: "601000000000000000",
      prefijoResumen: "601-001-000-",
      cuentas: ["Servicios", "Administración"],
    },
    {
      principal: "GASTOS",
      secundaria: "Financieros",
      prefijoSummary: "701000000000000000",
      prefijoResumen: "701-001-000-",
      cuentas: ["Intereses", "Comisiones bancarias"],
    },
  ];

  const seccionesModulos = [
    {
      principal: "Operaciones",
      prefijoResumen: "401-002-000-",
      cuentas: ["Servicios recurrentes", "Eventos especiales"],
    },
    {
      principal: "Administración",
      prefijoResumen: "501-001-000-",
      cuentas: ["Nómina", "Sistemas"],
    },
    {
      principal: "Soporte",
      prefijoResumen: "601-005-000-",
      cuentas: ["Capacitación", "Viajes"],
    },
  ];

  const secciones =
    esSummary || esResumen ? seccionesResumen : seccionesModulos;

  secciones.forEach((seccion) => {
    seccion.cuentas.forEach((nombre, index) => {
      const prefijo = esSummary
        ? seccion.prefijoSummary
        : seccion.prefijoResumen;
      const codigo = crearCodigo(prefijo, index);
      const cuenta = {
        CAPITULO: capitulo,
        CUENTA: codigo,
        NOMBRE: nombre,
        orden,
      };
      if (esSummary || esResumen) {
        cuenta["SECCIàN Principal"] = seccion.principal;
        cuenta["SECCION Secundaria"] = seccion.secundaria;
      } else {
        cuenta.SECCION = seccion.principal;
      }
      cuentas.push(cuenta);
      orden += 1;
    });
  });

  const operaciones = [];
  if (esSummary || esResumen) {
    operaciones.push({
      HOJA: modulo,
      CAPITULO: capitulo,
      Clase: "Resultado Operativo",
      SECCION: "RESULTADOS",
      "sum-row": "INGRESOS / Membresías",
      "sum-row-operativo": "GASTOS / Operativos",
      "result-row": "UTILIDAD NETA",
      signo: 1,
      signos: {
        "sum-row": 1,
        "sum-row-operativo": -1,
        "result-row": 1,
      },
    });
  }

  return { cuentas, operaciones };
};

const crearLayoutDemo = ({
  empresaId = "EMPRESA01",
  modulo,
  anio,
  capitulo,
  overwrite = false,
}) => {
  const empresaCanonica = resolverEmpresaLayoutSource(empresaId);
  const anioNumero = Number(anio);
  const capituloObjetivo = capitulo || "DEFAULT";
  if (!modulo || !Number.isInteger(anioNumero)) {
    return {
      success: false,
      mensaje: "Datos inválidos para generar plantilla.",
    };
  }

  if (
    existeLayoutCapitulo({
      empresaId: empresaCanonica,
      modulo,
      anio: anioNumero,
      capitulo: capituloObjetivo,
    })
  ) {
    if (!overwrite) {
      return {
        success: false,
        conflict: true,
        mensaje: "El capítulo ya tiene layout en ese año.",
      };
    }
    eliminarLayoutCapitulo({
      empresaId: empresaCanonica,
      modulo,
      anio: anioNumero,
      capitulo: capituloObjetivo,
    });
  }

  const { cuentas, operaciones } = construirPlantillaDemo({
    modulo,
    capitulo: capituloObjetivo,
  });
  guardarCuentas({
    empresaId: empresaCanonica,
    modulo,
    anio: anioNumero,
    capitulo: capituloObjetivo,
    cuentas,
  });
  if (operaciones.length) {
    guardarOperaciones({
      empresaId: empresaCanonica,
      modulo,
      anio: anioNumero,
      operaciones,
    });
  }

  return {
    success: true,
    cuentas: cuentas.length,
    operaciones: operaciones.length,
    capitulo: capituloObjetivo,
  };
};

/**
 * Obtener layout completo para un módulo, año y capítulo
 */

const obtenerLayout = ({
  empresaId = "EMPRESA01",
  modulo,
  anio,
  capitulo,
  incluirSecciones = false,
}) => {
  const anioNumero = Number(anio);
  const moduloNorm = (modulo || "").toString().trim().toUpperCase();
  const empresaCanonica = resolverEmpresaLayoutSource(empresaId);

  console.log(`[obtenerLayout] Solicitado: empresaId=${empresaId}, modulo=${modulo}, anio=${anio}, capitulo=${capitulo}`);
  console.log(`[obtenerLayout] Empresa canónica: ${empresaCanonica}`);

  if (AUTO_LAYOUT_CLONE) {
    asegurarLayoutAnio({ empresaId: empresaCanonica, modulo, anio: anioNumero });
  }
  const empresaConsulta = resolverEmpresaConsulta({
    empresaId: empresaCanonica,
    modulo,
    anio: anioNumero,
  });

  console.log(`[obtenerLayout] Empresa consulta: ${empresaConsulta}`);

  // Capítulo: canonizar para evitar que existan dos variantes del mismo capítulo
  // (p.ej. "CIUDAD DE MEXICO" vs "CIUDAD DE MÉXICO") y que el guardado/orden parezca "no aplicar".
  const capituloSolicitado = LIMPIAR_CLAVE(capitulo || "DEFAULT") || "DEFAULT";
  const capituloCanonico = canonizarCapituloLabel(capituloSolicitado);
  const capitulosEquivalentes = obtenerCapitulosEquivalentes({
    empresaId: empresaConsulta,
    modulo,
    anio: anioNumero,
    capitulo: capituloSolicitado,
  });
  const capituloConsulta = resolverCapituloConsulta({
    empresaId: empresaConsulta,
    modulo,
    anio: anioNumero,
    capituloSolicitado,
    capituloCanonico,
    candidatos: capitulosEquivalentes,
  });

  const capituloObjetivo = capituloCanonico;

  const consultarCuentas = (anioObjetivo) =>
    db
      .prepare(
        `
    SELECT 
      cuenta AS CUENTA,
      nombre AS NOMBRE,
      capitulo AS CAPITULO,
      seccion_principal AS "SECCIàN Principal",
      seccion_secundaria AS "SECCION Secundaria",
      operacion_factor,
      orden,
      orden_presentacion,
      visible
    FROM layout_cuentas
    WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ?
    ORDER BY COALESCE(orden_presentacion, orden) ASC
  `
      )
      .all(empresaConsulta, modulo, anioObjetivo, capituloConsulta);

  const normalizarVisible = (value) => {
    if (value === null || value === undefined) return true;
    if (typeof value === "boolean") return value;
    return Number(value) !== 0;
  };

  // Importante: Number(null) y Number('') dan 0; aquí queremos tratar null/'' como "sin orden"
  // para que el fallback a `orden` (o al índice) funcione y no colapse todo al orden 0.
  const normalizarOrden = (value) => {
    if (value === null || value === undefined) return undefined;
    if (typeof value === "string" && value.trim() === "") return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const normalizarCuentas = (list) =>
    (list || []).map((cuenta) => {
      const orden = normalizarOrden(cuenta.orden);
      const ordenPresentacion = normalizarOrden(cuenta.orden_presentacion);
      return {
        ...cuenta,
        orden_presentacion:
          ordenPresentacion === undefined ? orden : ordenPresentacion,
        visible: normalizarVisible(cuenta.visible),
      };
    });

  const normalizarSeccionesCuenta = (cuenta = {}) => {
    const seccionPrincipal =
      cuenta["SECCIÓN Principal"] ||
      cuenta["SECCION PRINCIPAL"] ||
      cuenta["SECCION Principal"] ||
      cuenta["SECCI…N Principal"] ||
      cuenta["SECCIàN Principal"] ||
      cuenta.SECCION ||
      cuenta.seccion_principal ||
      cuenta.seccion ||
      "";
    const seccionSecundaria =
      cuenta["SECCIÓN Secundaria"] ||
      cuenta["SECCION SECUNDARIA"] ||
      cuenta["SECCION Secundaria"] ||
      cuenta["SECCIàN Secundaria"] ||
      cuenta.seccion_secundaria ||
      cuenta.seccionSecundaria ||
      "";
    return {
      ...cuenta,
      "SECCION Principal": seccionPrincipal,
      "SECCION Secundaria": seccionSecundaria,
      SECCION: seccionPrincipal,
      seccion_principal: seccionPrincipal,
      seccion_secundaria: seccionSecundaria,
    };
  };

  const consultarSecciones = (anioObjetivo) =>
    db
      .prepare(
        `
    SELECT 
      seccion_principal as seccion_principal,
      seccion_secundaria as seccion_secundaria,
      tipo,
      orden,
      orden_presentacion
    FROM layout_secciones
    WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ?
    ORDER BY COALESCE(orden_presentacion, orden) ASC, orden ASC, seccion_principal ASC, seccion_secundaria ASC
  `
      )
      .all(empresaConsulta, modulo, anioObjetivo, capituloConsulta);

  const normalizarClave = (valor) => NORMALIZAR_CLAVE(valor);

  let cuentas = normalizarCuentas(consultarCuentas(anioNumero)).map(
    normalizarSeccionesCuenta
  );
  let anioUsado = anioNumero;

  // Sin fallback automático: respetar el año solicitado y dejar vacío si no hay datos.

  const incluirSeccionesFlag =
    incluirSecciones === true ||
    incluirSecciones === "true" ||
    incluirSecciones === "1";

  if (!cuentas || !cuentas.length) {
    if (!incluirSeccionesFlag) {
      return construirRespuestaLayout({
        empresaId: empresaConsulta,
        modulo,
        anio: anioUsado,
        capitulo: capituloObjetivo,
        cuentas: [],
        operaciones: [],
      });
    }
  }

  const operaciones = db
    .prepare(
      `
    SELECT 
      capitulo AS CAPITULO,
      clase AS OperacionId,
      operacion_etiqueta,
      seccion AS SECCION,
      operacion_tipo,
      operacion_label,
      signo,
      orden,
      orden_presentacion,
      visible,
      formula_json
    FROM layout_operaciones
    WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ?
    ORDER BY COALESCE(orden_presentacion, orden) ASC, orden ASC
  `
    )
    .all(empresaConsulta, modulo, anioUsado, capituloConsulta);

  const operacionesMap = {};
  const tiposOperacionIgnorados = new Set([
    // Estos pueden colarse si alguna versión anterior persistió metadatos
    // como si fueran "operacion_tipo". Ignorarlos evita sobreescribir
    // campos reales (orden_presentacion/visible) al reconstruir el objeto.
    "orden_presentacion",
    "ordenPresentacion",
    "visible",
    "operacion_tipo",
    "operacionTipo",
    "operacion_label",
    "operacionLabel",
    "orden",
    "cuentas",
    "secciones",
  ]);
  operaciones.forEach((op, idx) => {
    const ordenPresentacion = normalizarOrden(op.orden_presentacion);
    const ordenBase = Number.isFinite(ordenPresentacion)
      ? ordenPresentacion
      : Number.isFinite(Number(op.orden))
      ? Math.floor(Number(op.orden) / 100)
      : idx;
    const operacionId = op.OperacionId || op.Clase || op.clase;
    const operacionEtiqueta =
      op.operacion_etiqueta || op.Clase || operacionId || "Operacion";
    const mapKey = operacionId || operacionEtiqueta;

    // Parsear formula_json si existe
    let formulaTerms = [];
    let signos = {};
    try {
      if (op.formula_json) {
        const parsed = JSON.parse(op.formula_json);
        if (Array.isArray(parsed)) {
          formulaTerms = parsed;
          // Reconstruir signos desde formula_terms
          parsed.forEach((term, termIdx) => {
            const key = `seccion_${termIdx + 1}`;
            signos[key] = term.operator === '-' ? -1 : 1;
          });
        }
      }
    } catch (err) {
      console.warn(`Error parsing formula_json for ${operacionId}:`, err);
    }

    if (!operacionesMap[mapKey]) {
      operacionesMap[mapKey] = {
        HOJA: modulo, // Agregar HOJA para que el filtro en planeacionReportesEngine funcione
        CAPITULO: op.CAPITULO,
        Clase: operacionEtiqueta,
        OperacionId: operacionId || operacionEtiqueta,
        SECCION: op.SECCION,
        signo: op.signo ?? 1,
        signos: signos,
        formula_terms: formulaTerms,
        orden: ordenBase,
        orden_presentacion:
          ordenPresentacion === undefined ? ordenBase : ordenPresentacion,
        visible: normalizarVisible(op.visible),
      };
    } else if (
      Number.isFinite(ordenBase) &&
      (operacionesMap[mapKey].orden == null ||
        ordenBase < operacionesMap[mapKey].orden)
    ) {
      operacionesMap[mapKey].orden = ordenBase;
    }
    const tipo = (op.operacion_tipo || "").toString().trim();
    if (tipo && !tiposOperacionIgnorados.has(tipo)) {
      operacionesMap[mapKey][tipo] = op.operacion_label;
      operacionesMap[mapKey].signos[tipo] = op.signo ?? 1;
    }
    if (op.formula_json && !operacionesMap[mapKey].formula_json) {
      operacionesMap[mapKey].formula_json = op.formula_json;
    }
    if (operacionesMap[mapKey].orden_presentacion === undefined) {
      operacionesMap[mapKey].orden_presentacion =
        ordenPresentacion === undefined ? ordenBase : ordenPresentacion;
    }
    if (operacionesMap[mapKey].visible === undefined) {
      operacionesMap[mapKey].visible = normalizarVisible(op.visible);
    }
  });

  const operacionesOrdenadas = Object.values(operacionesMap).sort(
    (a, b) =>
      (a.orden_presentacion ?? a.orden ?? 0) -
      (b.orden_presentacion ?? b.orden ?? 0)
  );

  if (incluirSeccionesFlag) {
    const secciones = consultarSecciones(anioUsado) || [];
    if (secciones.length) {
      const principalSet = new Set();
      const secondarySet = new Set();

      (cuentas || []).forEach((cuenta) => {
        const principal = normalizarClave(
          cuenta["SECCION Principal"] ||
            cuenta.SECCION ||
            cuenta.seccion_principal ||
            ""
        );
        const secundaria = normalizarClave(
          cuenta["SECCION Secundaria"] ||
            cuenta.seccion_secundaria ||
            ""
        );
        if (principal) principalSet.add(principal);
        if (principal && secundaria)
          secondarySet.add(`${principal}||${secundaria}`);
      });

      const principalInfo = new Map();
      const secondaryInfo = new Map();

      secciones.forEach((row, idx) => {
        const principalRaw = (row.seccion_principal || "").toString().trim();
        const secundariaRaw = (row.seccion_secundaria || "").toString().trim();
        const principalKey = normalizarClave(principalRaw);
        if (!principalKey) return;
        const ordenPresentacion = normalizarOrden(row.orden_presentacion);
        const orden = Number.isFinite(ordenPresentacion)
          ? Number(ordenPresentacion)
          : Number.isFinite(Number(row.orden))
          ? Number(row.orden)
          : idx;
        if (!principalInfo.has(principalKey)) {
          principalInfo.set(principalKey, {
            name: principalRaw,
            order: orden,
            orderPresentacion: ordenPresentacion,
          });
        }
        if (secundariaRaw) {
          const list = secondaryInfo.get(principalKey) || [];
          list.push({
            principalName: principalRaw,
            name: secundariaRaw,
            order: orden,
            orderPresentacion: ordenPresentacion,
          });
          secondaryInfo.set(principalKey, list);
        }
      });

      const placeholders = [];
      const makePlaceholder = ({ principal, secundaria, type, orderHint }) => ({
        CUENTA: "",
        NOMBRE: secundaria
          ? `[Subseccion: ${secundaria}]`
          : `[Seccion: ${principal}]`,
        "SECCION Principal": principal,
        "SECCION Secundaria": secundaria || "",
        SECCION: principal,
        seccion_principal: principal,
        seccion_secundaria: secundaria || "",
        orden: null,
        orden_presentacion: null,
        visible: false,
        __layoutPlaceholder: true,
        __placeholderType: type,
        __placeholderOrder: orderHint,
      });

      secondaryInfo.forEach((list, principalKey) => {
        const principalMeta = principalInfo.get(principalKey);
        const principalName =
          principalMeta?.name || list[0]?.principalName || "";
        const principalOrder = principalMeta?.order ?? 0;
        list.forEach((sec) => {
          const secundariaKey = normalizarClave(sec.name);
          if (!secundariaKey) return;
          const pairKey = `${principalKey}||${secundariaKey}`;
          if (secondarySet.has(pairKey)) return;
          const storedOrder = normalizarOrden(sec.orderPresentacion);
          const orderHint =
            Number.isFinite(storedOrder) ? storedOrder : principalOrder * 1000 + (sec.order ?? 0);
          placeholders.push(
            makePlaceholder({
              principal: principalName,
              secundaria: sec.name,
              type: "secundaria",
              orderHint,
            })
          );
          // Si viene `orden_presentacion` persistido, usarlo directamente para posicionar el placeholder.
          if (Number.isFinite(storedOrder)) {
            placeholders[placeholders.length - 1].orden = storedOrder;
            placeholders[placeholders.length - 1].orden_presentacion = storedOrder;
            placeholders[placeholders.length - 1].__placeholderOrder = storedOrder;
          }
        });
      });

      principalInfo.forEach((meta, principalKey) => {
        if (secondaryInfo.has(principalKey)) return;
        if (principalSet.has(principalKey)) return;
        const storedOrder = normalizarOrden(meta.orderPresentacion);
        const orderHint = Number.isFinite(storedOrder) ? storedOrder : meta.order ?? 0;
        placeholders.push(
          makePlaceholder({
            principal: meta.name,
            secundaria: "",
            type: "principal",
            orderHint,
          })
        );
        if (Number.isFinite(storedOrder)) {
          placeholders[placeholders.length - 1].orden = storedOrder;
          placeholders[placeholders.length - 1].orden_presentacion = storedOrder;
          placeholders[placeholders.length - 1].__placeholderOrder = storedOrder;
        }
      });

      if (placeholders.length) {
        const maxOrder = (cuentas || []).reduce((max, cuenta, idx) => {
          const orden =
            normalizarOrden(cuenta.orden_presentacion) ??
            normalizarOrden(cuenta.orden) ??
            idx;
          return Math.max(max, orden);
        }, -1);

        placeholders
          .sort((a, b) => (a.__placeholderOrder ?? 0) - (b.__placeholderOrder ?? 0))
          .forEach((placeholder, idx) => {
            // Si ya trae orden persistido (orden_presentacion), respetarlo.
            const existingOrder = normalizarOrden(placeholder.orden_presentacion);
            if (Number.isFinite(existingOrder)) {
              placeholder.orden = existingOrder;
              placeholder.orden_presentacion = existingOrder;
              return;
            }
            const ordenFinal = maxOrder + idx + 1;
            placeholder.orden = ordenFinal;
            placeholder.orden_presentacion = ordenFinal;
          });

        cuentas = [...(cuentas || []), ...placeholders];
      }
    }
  }

  return construirRespuestaLayout({
    empresaId: empresaConsulta,
    modulo,
    anio: anioUsado,
    capitulo: capituloObjetivo,
    cuentas,
    operaciones: operacionesOrdenadas,
  });
};

/**
 * Obtener todos los capítulos disponibles para un módulo y año
 */

const obtenerCapitulos = ({ empresaId = "EMPRESA01", modulo, anio }) => {
  const anioNumero = Number(anio);
  const moduloNorm = (modulo || "").toString().trim().toUpperCase();
  const empresaCanonica = resolverEmpresaLayoutSource(empresaId);
  if (AUTO_LAYOUT_CLONE) {
    asegurarLayoutAnio({ empresaId: empresaCanonica, modulo, anio: anioNumero });
  }
  const empresaConsulta = resolverEmpresaConsulta({
    empresaId: empresaCanonica,
    modulo,
    anio: anioNumero,
  });

  // Sin fallback automático: devolver capítulos del año solicitado.
  // Importante: deduplicar capítulos equivalentes (p.ej. "MÉXICO" vs "MEXICO")
  // para que el usuario no edite un capítulo "duplicado" sin darse cuenta.
  const capitulosRaw = listarCapitulosDb({
    empresaId: empresaConsulta,
    modulo,
    anio: anioNumero,
  });
  const dedup = new Map(); // key -> canonical label
  capitulosRaw.forEach((cap) => {
    const key = NORMALIZAR_CAPITULO(cap);
    if (!key) return;
    if (!dedup.has(key)) {
      dedup.set(key, canonizarCapituloLabel(cap));
    }
  });

  return Array.from(dedup.values())
    .sort((a, b) => a.localeCompare(b))
    .map((capitulo) => ({ capitulo }));
};

/**
 * Obtener años disponibles para un módulo
 */

const obtenerAniosDisponibles = ({ empresaId = "EMPRESA01", modulo }) => {
  const empresaCanonica = resolverEmpresaLayoutSource(empresaId);
  const anios = db
    .prepare(
      `
    SELECT DISTINCT anio
    FROM layout_cuentas
    WHERE empresa_id = ? AND modulo = ?
    ORDER BY anio DESC
  `
    )
    .all(empresaCanonica, modulo);

  return anios.map((a) => a.anio);
};

/**
 * Guardar cuentas de un layout
 */

const guardarCuentas = ({
  empresaId = "EMPRESA01",
  modulo,
  anio,
  capitulo,
  cuentas,
}) => {
  // Usar el mismo "source" que lectura (alias comparativas EMPRESA09-12).
  const empresaCanonica = resolverEmpresaLayoutSource(empresaId);
  const anioNumero = Number(anio);

  const capituloSolicitado = LIMPIAR_CLAVE(capitulo || "DEFAULT") || "DEFAULT";
  const capituloCanonico = canonizarCapituloLabel(capituloSolicitado);
  const capitulosEquivalentes = obtenerCapitulosEquivalentes({
    empresaId: empresaCanonica,
    modulo,
    anio: anioNumero,
    capitulo: capituloSolicitado,
  });
  const capitulosBorrar = capitulosEquivalentes.length
    ? capitulosEquivalentes
    : [capituloSolicitado];

  const insertCuenta = db.prepare(`
    INSERT OR REPLACE INTO layout_cuentas (
      empresa_id, modulo, anio, cuenta, nombre, capitulo, 
      seccion_principal, seccion_secundaria, operacion_factor,
      orden, orden_presentacion, visible, actualizado_en
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);
  const deleteCuentas = db.prepare(`
    DELETE FROM layout_cuentas
    WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ?
  `);
  const deleteSecciones = db.prepare(`
    DELETE FROM layout_secciones
    WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ?
  `);
  const insertSeccion = db.prepare(`
    INSERT OR REPLACE INTO layout_secciones (
      empresa_id, modulo, anio, capitulo, seccion_principal,
      seccion_secundaria, tipo, orden, orden_presentacion, actualizado_en
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  const limpiarEtiqueta = (valor) => LIMPIAR_CLAVE(valor);
  const claveEtiqueta = (valor) => NORMALIZAR_CLAVE(valor);

  const obtenerValorCampo = (obj, keys = []) => {
    for (const key of keys) {
      if (obj && obj[key] != null && String(obj[key]).trim() !== "") {
        return obj[key];
      }
    }
    return "";
  };

  const obtenerCuentaCodigo = (cuenta) =>
    obtenerValorCampo(cuenta, ["CUENTA", "cuenta", "Cuenta"]);

  const obtenerSeccionPrincipal = (cuenta) =>
    obtenerValorCampo(cuenta, [
      "SECCIÓN Principal",
      "SECCION Principal",
      "SECCIàN Principal",
      "SECCI…N Principal",
      "SECCI.N Principal",
      "SECCION PRINCIPAL",
      "SECCION",
      "SECCIÓN",
      "seccion_principal",
      "seccion",
    ]);

  const obtenerSeccionSecundaria = (cuenta) =>
    obtenerValorCampo(cuenta, [
      "SECCIÓN Secundaria",
      "SECCION Secundaria",
      "SECCIàN Secundaria",
      "SECCION SECUNDARIA",
      "seccion_secundaria",
      "seccion_secondary",
    ]);

  const obtenerOrden = (cuenta, fallback) => {
    const raw = cuenta?.orden_presentacion ?? cuenta?.orden ?? fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const transaction = db.transaction((cuentasArray) => {
    // Borrar TODAS las variantes equivalentes para evitar el bug "guardo pero no aplica".
    capitulosBorrar.forEach((cap) => {
      deleteCuentas.run(empresaCanonica, modulo, anioNumero, cap);
      deleteSecciones.run(empresaCanonica, modulo, anioNumero, cap);
    });

    // Metadatos de secciones/subsecciones con orden GLOBAL (manual).
    // - orden_presentacion: posición real en el preview (incluye headers).
    // - orden: fallback legacy (lo igualamos a orden_presentacion).
    const principalMeta = new Map(); // principalKey -> { label, orden }
    const secundariaMeta = new Map(); // principalKey -> Map(secKey -> { label, orden })

    const registrarPrincipal = (principalRaw, ordenHint) => {
      const clean = limpiarEtiqueta(principalRaw);
      const key = claveEtiqueta(clean);
      if (!key) return null;
      const orden = Number.isFinite(Number(ordenHint)) ? Number(ordenHint) : 0;
      const existente = principalMeta.get(key);
      if (!existente) {
        principalMeta.set(key, { label: clean, orden });
      } else {
        if (!existente.label && clean) existente.label = clean;
        if (orden < existente.orden) existente.orden = orden;
      }
      return { key, label: principalMeta.get(key)?.label || clean };
    };

    const registrarSecundaria = (principalInfo, secundariaRaw, ordenHint) => {
      if (!principalInfo?.key) return null;
      const clean = limpiarEtiqueta(secundariaRaw);
      const secKey = claveEtiqueta(clean);
      if (!secKey) return null;
      const orden = Number.isFinite(Number(ordenHint)) ? Number(ordenHint) : 0;
      let mapa = secundariaMeta.get(principalInfo.key);
      if (!mapa) {
        mapa = new Map();
        secundariaMeta.set(principalInfo.key, mapa);
      }
      const existente = mapa.get(secKey);
      if (!existente) {
        mapa.set(secKey, { label: clean, orden });
      } else {
        if (!existente.label && clean) existente.label = clean;
        if (orden < existente.orden) existente.orden = orden;
      }
      return {
        principalKey: principalInfo.key,
        principalLabel: principalInfo.label,
        secundariaKey: secKey,
        secundariaLabel: mapa.get(secKey)?.label || clean,
      };
    };

    const cuentasOrdenadas = (cuentasArray || [])
      .map((cuenta, index) => ({
        cuenta,
        index,
        orden: obtenerOrden(cuenta, index),
      }))
      .sort((a, b) => a.orden - b.orden || a.index - b.index);

    cuentasOrdenadas.forEach(({ cuenta, index }) => {
      const cuentaCodigo = (obtenerCuentaCodigo(cuenta) || "").toString().trim();
      const seccionPrincipalRaw = obtenerSeccionPrincipal(cuenta);
      const seccionSecundariaRaw = obtenerSeccionSecundaria(cuenta) || "";
      const principalClean = limpiarEtiqueta(seccionPrincipalRaw);
      const secundariaClean = limpiarEtiqueta(seccionSecundariaRaw);
      const ordenPresentacion = obtenerOrden(cuenta, index);
      const principalInfo = principalClean
        ? registrarPrincipal(principalClean, ordenPresentacion)
        : null;
      const secundariaInfo =
        principalInfo && secundariaClean
          ? registrarSecundaria(principalInfo, secundariaClean, ordenPresentacion)
          : null;

      const seccionPrincipal = principalInfo?.label || "";
      const seccionSecundaria = secundariaInfo?.secundariaLabel || null;

      if (!cuentaCodigo) {
        // Placeholder (header de sección/subsección). Ya registró metadatos.
        if (!seccionPrincipal && !seccionSecundaria) {
          console.warn(
            `[layoutService] Placeholder sin seccion en ${modulo}/${capitulo}, ignorando`
          );
        }
        return;
      }

      const nombre =
        cuenta.NOMBRE || cuenta.nombre || cuentaCodigo || "Sin nombre";
      const factorRaw =
        cuenta.operacion_factor ?? cuenta.operacionFactor ?? cuenta.factor;
      const operacionFactor =
        factorRaw === "" || factorRaw === null || factorRaw === undefined
          ? 1
          : Number(factorRaw);
      const operacionFactorFinal = Number.isFinite(operacionFactor)
        ? operacionFactor
        : 1;
      const visible = cuenta.visible === false ? 0 : 1;

      insertCuenta.run(
        empresaCanonica,
        modulo,
        anioNumero,
        cuentaCodigo,
        nombre,
        capituloCanonico,
        seccionPrincipal,
        seccionSecundaria,
        operacionFactorFinal,
        ordenPresentacion,
        ordenPresentacion,
        visible
      );
    });

    // Persistir orden global de headers (layout_secciones).
    // Esto es clave para poder reordenar secciones vacías y que el orden se conserve.
    principalMeta.forEach((meta, principalKey) => {
      const orden = Number.isFinite(Number(meta?.orden)) ? Number(meta.orden) : 0;
      insertSeccion.run(
        empresaCanonica,
        modulo,
        anioNumero,
        capituloCanonico,
        (meta?.label || "").toString(),
        "",
        "principal",
        orden,
        orden,
      );
    });

    secundariaMeta.forEach((mapa, principalKey) => {
      const principalLabel = principalMeta.get(principalKey)?.label || "";
      (mapa || new Map()).forEach((meta) => {
        const orden = Number.isFinite(Number(meta?.orden)) ? Number(meta.orden) : 0;
        insertSeccion.run(
          empresaCanonica,
          modulo,
          anioNumero,
          capituloCanonico,
          principalLabel,
          (meta?.label || "").toString(),
          "secundaria",
          orden,
          orden,
        );
      });
    });
  });

  transaction(cuentas);
  return { success: true, insertadas: cuentas.length, capitulo: capituloCanonico };
};

/**
 * Guardar operaciones de un layout
 */

const guardarOperaciones = ({
  empresaId = "EMPRESA01",
  modulo,
  anio,
  operaciones,
}) => {
  // Usar el mismo "source" que lectura (alias comparativas EMPRESA09-12).
  const empresaCanonica = resolverEmpresaLayoutSource(empresaId);
  const insertOperacion = db.prepare(`
    INSERT OR REPLACE INTO layout_operaciones (
      empresa_id, modulo, anio, capitulo, clase, operacion_etiqueta, seccion,
      operacion_tipo, operacion_label, signo, orden, orden_presentacion, visible, formula_json, actualizado_en
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  const transaction = db.transaction((operacionesArray) => {
    operacionesArray.forEach((op, index) => {
      const tiposOperacionBase = [
        "sum-row",
        "sum-row-sumavarios",
        "sum-row-sumavarios-consolidado",
        "sum-row-operativo",
        "sum-row-operativo-consolidado",
        "result-row",
        "net-row",
        "net-row-adicional",
        "result-net-row",
      ];
      const clavesReservadas = new Set([
        "HOJA",
        "CAPITULO",
        "Clase",
        "clase",
        "OperacionId",
        "operacion_id",
        "operacion_etiqueta",
        // Campos del modelo/BD que NO deben persistirse como operacion_tipo extra
        // (ya existen como columnas o son metadatos internos).
        "operacion_tipo",
        "operacion_label",
        "Etiqueta",
        "etiqueta",
        "SECCION",
        "seccion",
        "formula_json",
        "formula_terms",
        "signo",
        "signos",
        "orden",
        "orden_presentacion",
        "ordenPresentacion",
        "visible",
        "cuentas",
        "tipo",
        "secciones",
      ]);
      const tiposOperacionExtra = Object.keys(op || {})
        .filter((key) => key && !clavesReservadas.has(key))
        .filter((key) => !tiposOperacionBase.includes(key));
      const tiposOperacion = [...tiposOperacionBase, ...tiposOperacionExtra];
      const formulaJson =
        op.formula_json ||
        (Array.isArray(op.formula_terms)
          ? JSON.stringify(op.formula_terms)
          : null);

      const ordenPresentacion = Number.isFinite(
        Number(op.orden_presentacion)
      )
        ? Number(op.orden_presentacion)
        : Number.isFinite(Number(op.orden))
        ? Number(op.orden)
        : index;
      const baseOrden = ordenPresentacion;
      const visible = op.visible === false ? 0 : 1;
      let insertados = 0;

      tiposOperacion.forEach((tipo, tipoIndex) => {
        const rawValue = op?.[tipo];
        // Persistimos solo labels string no vacíos. Evita insertar arrays/objetos/flags
        // (p.ej. visible/orden_presentacion) como si fueran tipos de operación.
        if (typeof rawValue === "string" && rawValue.trim()) {
          const value = rawValue.trim();
          const signoDesdeMapa = op.signos?.[tipo];
          const signoConfigurado = Number.isFinite(Number(signoDesdeMapa))
            ? Number(signoDesdeMapa)
            : Number(op.signo);
          let signo =
            Number.isFinite(signoConfigurado) && signoConfigurado !== 0
              ? signoConfigurado
              : 1;

          const capituloRaw = LIMPIAR_CLAVE(op.CAPITULO || "DEFAULT") || "DEFAULT";
          const capituloCanonico = canonizarCapituloLabel(capituloRaw);
          const operacionId =
            op.OperacionId || op.operacion_id || op.id || op.clase || op.Clase;
          const operacionEtiqueta =
            op.Etiqueta ||
            op.etiqueta ||
            op.operacion_etiqueta ||
            op.Clase ||
            op.clase ||
            operacionId ||
            `Operacion ${index + 1}`;
          const clase = operacionId || operacionEtiqueta;
          const seccion = op.SECCION || op.seccion || "";
          try {
            insertOperacion.run(
              empresaCanonica,
              modulo,
              anio,
              capituloCanonico,
              clase,
              operacionEtiqueta,
              seccion,
              tipo,
              value,
              signo,
              baseOrden * 100 + tipoIndex,
              ordenPresentacion,
              visible,
              formulaJson
            );
            insertados += 1;
          } catch (err) {
            console.error(
              `Error inserting operation ${clase} (${tipo}):`,
              err.message
            );
          }
        }
      });

      if (insertados === 0) {
        const capituloRaw = LIMPIAR_CLAVE(op.CAPITULO || "DEFAULT") || "DEFAULT";
        const capituloCanonico = canonizarCapituloLabel(capituloRaw);
        const operacionId =
          op.OperacionId || op.operacion_id || op.id || op.clase || op.Clase;
        const operacionEtiqueta =
          op.Etiqueta ||
          op.etiqueta ||
          op.operacion_etiqueta ||
          op.Clase ||
          op.clase ||
          operacionId ||
          `Operacion ${index + 1}`;
        const clase = operacionId || operacionEtiqueta;
        const seccion = op.SECCION || op.seccion || "";
        const signo =
          Number.isFinite(Number(op.signo)) && Number(op.signo) !== 0
            ? Number(op.signo)
            : 1;
        try {
          insertOperacion.run(
            empresaCanonica,
            modulo,
            anio,
            capituloCanonico,
            clase,
            operacionEtiqueta,
            seccion,
            "free-operation",
            operacionEtiqueta,
            signo,
            baseOrden * 100,
            ordenPresentacion,
            visible,
            formulaJson
          );
        } catch (err) {
          console.error(`Error inserting free operation ${clase}:`, err.message);
        }
      }
    });
  });

  transaction(operaciones);
  return { success: true, insertadas: operaciones.length };
};

/**
 * Copiar layout de un año a otro (útil para crear nuevo año)
 */

const copiarLayout = ({
  empresaId = "EMPRESA01",
  modulo,
  anioOrigen,
  anioDestino,
}) => {
  const empresaCanonica = resolverEmpresaLayoutSource(empresaId);
  const limpiarCuentas = db.prepare(`
    DELETE FROM layout_cuentas
    WHERE empresa_id = ? AND modulo = ? AND anio = ?
  `);
  const limpiarOperaciones = db.prepare(`
    DELETE FROM layout_operaciones
    WHERE empresa_id = ? AND modulo = ? AND anio = ?
  `);
  const limpiarSecciones = db.prepare(`
    DELETE FROM layout_secciones
    WHERE empresa_id = ? AND modulo = ? AND anio = ?
  `);
  const copiarCuentas = db.prepare(`
    INSERT INTO layout_cuentas (
      empresa_id, modulo, anio, cuenta, nombre, capitulo,
      seccion_principal, seccion_secundaria, operacion_factor, orden, orden_presentacion, visible
    )
    SELECT 
      empresa_id, modulo, ?, cuenta, nombre, capitulo,
      seccion_principal, seccion_secundaria, operacion_factor, orden, orden_presentacion, visible
    FROM layout_cuentas
    WHERE empresa_id = ? AND modulo = ? AND anio = ?
  `);

  const copiarOperaciones = db.prepare(`
    INSERT INTO layout_operaciones (
      empresa_id, modulo, anio, capitulo, clase, operacion_etiqueta, seccion,
      operacion_tipo, operacion_label, signo, orden, orden_presentacion, visible, formula_json
    )
    SELECT 
      empresa_id, modulo, ?, capitulo, clase, operacion_etiqueta, seccion,
      operacion_tipo, operacion_label, signo, orden, orden_presentacion, visible, formula_json
    FROM layout_operaciones
    WHERE empresa_id = ? AND modulo = ? AND anio = ?
  `);

  const copiarSecciones = db.prepare(`
    INSERT INTO layout_secciones (
      empresa_id, modulo, anio, capitulo, seccion_principal,
      seccion_secundaria, tipo, orden, orden_presentacion
    )
    SELECT 
      empresa_id, modulo, ?, capitulo, seccion_principal,
      seccion_secundaria, tipo, orden, orden_presentacion
    FROM layout_secciones
    WHERE empresa_id = ? AND modulo = ? AND anio = ?
  `);

  const transaction = db.transaction(() => {
    limpiarCuentas.run(empresaCanonica, modulo, anioDestino);
    limpiarOperaciones.run(empresaCanonica, modulo, anioDestino);
    limpiarSecciones.run(empresaCanonica, modulo, anioDestino);
    copiarCuentas.run(anioDestino, empresaCanonica, modulo, anioOrigen);
    copiarOperaciones.run(anioDestino, empresaCanonica, modulo, anioOrigen);
    copiarSecciones.run(anioDestino, empresaCanonica, modulo, anioOrigen);
  });

  transaction();
  return {
    success: true,
    mensaje: `Layout copiado de ${anioOrigen} a ${anioDestino}`,
  };
};

/**
 * Eliminar layout completo de un año
 */

const eliminarLayout = ({ empresaId = "EMPRESA01", modulo, anio }) => {
  const empresaCanonica = resolverEmpresaLayoutSource(empresaId);
  const deleteCuentas = db.prepare(`
    DELETE FROM layout_cuentas
    WHERE empresa_id = ? AND modulo = ? AND anio = ?
  `);

  const deleteOperaciones = db.prepare(`
    DELETE FROM layout_operaciones
    WHERE empresa_id = ? AND modulo = ? AND anio = ?
  `);

  const deleteSecciones = db.prepare(`
    DELETE FROM layout_secciones
    WHERE empresa_id = ? AND modulo = ? AND anio = ?
  `);

  const transaction = db.transaction(() => {
    deleteCuentas.run(empresaCanonica, modulo, anio);
    deleteOperaciones.run(empresaCanonica, modulo, anio);
    deleteSecciones.run(empresaCanonica, modulo, anio);
  });

  transaction();
  return { success: true, mensaje: `Layout eliminado para año ${anio}` };
};

/**
 * Verificar si existe un layout para un año específico
 */

const existeLayout = ({ empresaId = "EMPRESA01", modulo, anio }) => {
  const empresaCanonica = resolverEmpresaLayoutSource(empresaId);
  const resultado = db
    .prepare(
      `
    SELECT COUNT(*) as count
    FROM layout_cuentas
    WHERE empresa_id = ? AND modulo = ? AND anio = ?
    LIMIT 1
  `
    )
    .get(empresaCanonica, modulo, anio);

  return resultado.count > 0;
};

/**
 * Obtener estadísticas de un layout
 */

const obtenerEstadisticasLayout = ({
  empresaId = "EMPRESA01",
  modulo,
  anio,
}) => {
  const empresaCanonica = resolverEmpresaLayoutSource(empresaId);
  const stats = db
    .prepare(
      `
    SELECT 
      COUNT(DISTINCT capitulo) as capitulos,
      COUNT(DISTINCT seccion_principal) as secciones,
      COUNT(*) as cuentas
    FROM layout_cuentas
    WHERE empresa_id = ? AND modulo = ? AND anio = ?
  `
    )
    .get(empresaCanonica, modulo, anio);

  const operaciones = db
    .prepare(
      `
    SELECT COUNT(*) as operaciones
    FROM layout_operaciones
    WHERE empresa_id = ? AND modulo = ? AND anio = ?
  `
    )
    .get(empresaCanonica, modulo, anio);

  return {
    ...stats,
    operaciones: operaciones.operaciones,
  };
};

/**
 * Actualizar una cuenta específica
 */
const actualizarCuenta = ({
  empresaId = "EMPRESA01",
  modulo,
  anio,
  capitulo,
  cuentaOriginal,
  datos,
}) => {
  const empresaCanonica = resolverEmpresaLayoutSource(empresaId);

  const update = db.prepare(`
    UPDATE layout_cuentas
    SET cuenta = ?, nombre = ?, seccion_principal = ?, seccion_secundaria = ?,
        operacion_factor = ?, orden = ?, orden_presentacion = ?
    WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ? AND cuenta = ?
  `);

  const factorRaw =
    datos.operacion_factor ?? datos.operacionFactor ?? datos.factor;
  const operacionFactor =
    factorRaw === "" || factorRaw === null || factorRaw === undefined
      ? 1
      : Number(factorRaw);
  const operacionFactorFinal = Number.isFinite(operacionFactor)
    ? operacionFactor
    : 1;
  const ordenRaw = datos.orden_presentacion ?? datos.orden;
  const ordenFinal = Number.isFinite(Number(ordenRaw)) ? Number(ordenRaw) : 1;

  const result = update.run(
    datos.cuenta || cuentaOriginal,
    datos.nombre,
    datos.seccion_principal,
    datos.seccion_secundaria || "",
    operacionFactorFinal,
    ordenFinal,
    ordenFinal,
    empresaCanonica,
    modulo,
    anio,
    capitulo,
    cuentaOriginal
  );

  return { success: true, changes: result.changes };
};

/**
 * Eliminar una cuenta específica
 */
const eliminarCuenta = ({
  empresaId = "EMPRESA01",
  modulo,
  anio,
  capitulo,
  cuenta,
}) => {
  const empresaCanonica = resolverEmpresaLayoutSource(empresaId);

  const del = db.prepare(`
    DELETE FROM layout_cuentas
    WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ? AND cuenta = ?
  `);

  const result = del.run(empresaCanonica, modulo, anio, capitulo, cuenta);
  return { success: true, changes: result.changes };
};

/**
 * Reordenar cuentas de un layout
 */
const reordenarCuentas = ({
  empresaId = "EMPRESA01",
  modulo,
  anio,
  capitulo,
  orden,
}) => {
  const empresaCanonica = resolverEmpresaLayoutSource(empresaId);

  const update = db.prepare(`
    UPDATE layout_cuentas
    SET orden = ?, orden_presentacion = ?
    WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ? AND cuenta = ?
  `);

  const transaction = db.transaction(() => {
    orden.forEach((item) => {
      const ordenValue =
        item.orden_presentacion ?? item.orden ?? item.Orden ?? 0;
      update.run(
        ordenValue,
        ordenValue,
        empresaCanonica,
        modulo,
        anio,
        capitulo,
        item.cuenta
      );
    });
  });

  transaction();
  return { success: true, updated: orden.length };
};

/**
 * Actualizar una operación específica
 */
const actualizarOperacion = ({
  empresaId = "EMPRESA01",
  modulo,
  anio,
  capitulo,
  claseOriginal,
  datos,
}) => {
  const empresaCanonica = resolverEmpresaLayoutSource(empresaId);
  const anioNumero = Number(anio);
  if (!modulo || !Number.isInteger(anioNumero)) {
    return { success: false, mensaje: "Parámetros inválidos" };
  }
  const empresaConsulta = resolverEmpresaConsulta({
    empresaId: empresaCanonica,
    modulo,
    anio: anioNumero,
  });
  const normalizarCapitulo = (value = "") =>
    value
      .toString()
      .replace(/\u0000/g, "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toUpperCase();

  let capituloObjetivo = capitulo || "DEFAULT";
  const capituloNormalizado = normalizarCapitulo(capituloObjetivo);

  const resolverCapituloCoincidente = () => {
    if (!capituloNormalizado) return capituloObjetivo;
    const rows = db
      .prepare(
        `
      SELECT DISTINCT capitulo FROM layout_cuentas
      WHERE empresa_id = ? AND modulo = ? AND anio = ?
      UNION
      SELECT DISTINCT capitulo FROM layout_operaciones
      WHERE empresa_id = ? AND modulo = ? AND anio = ?
      `
      )
      .all(
        empresaConsulta,
        modulo,
        anioNumero,
        empresaConsulta,
        modulo,
        anioNumero
      );
    const capitulos = (rows || [])
      .map((row) => row?.capitulo)
      .filter(Boolean);
    if (!capitulos.length) return capituloObjetivo;
    const exactMatch = capitulos.find(
      (value) => normalizarCapitulo(value) === capituloNormalizado
    );
    return exactMatch || capituloObjetivo;
  };

  capituloObjetivo = resolverCapituloCoincidente();

  const empresaParaLectura = empresaConsulta || empresaCanonica;
  const existente = db
    .prepare(
      `
      SELECT orden_presentacion, orden, visible
      FROM layout_operaciones
      WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ? AND (clase = ? OR operacion_etiqueta = ?)
      LIMIT 1
    `
    )
    .get(
      empresaParaLectura,
      modulo,
      anioNumero,
      capituloObjetivo,
      claseOriginal,
      claseOriginal
    );

  // Primero eliminar la operación existente
  const del = db.prepare(`
    DELETE FROM layout_operaciones
    WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ? COLLATE NOCASE AND (clase = ? OR operacion_etiqueta = ?)
  `);
  // Borrar tanto del origen real (por si venía con case/variante) como del destino canónico.
  const empresasBorrar = new Set([empresaParaLectura, empresaCanonica].filter(Boolean));
  empresasBorrar.forEach((empresaToDelete) => {
    del.run(
      empresaToDelete,
      modulo,
      anioNumero,
      capituloObjetivo,
      claseOriginal,
      claseOriginal
    );
  });

  // Luego insertar la actualizada
  const insert = db.prepare(`
    INSERT INTO layout_operaciones (
      empresa_id, modulo, anio, capitulo, clase, operacion_etiqueta, seccion,
      operacion_tipo, operacion_label, signo, orden, orden_presentacion,
      visible, formula_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Process operaciones object
  const operaciones = datos.operaciones || {};
  const formulaJson =
    datos.formula_json ||
    (Array.isArray(datos.formula_terms)
      ? JSON.stringify(datos.formula_terms)
      : null);
  const operacionId =
    datos.OperacionId ||
    datos.operacion_id ||
    datos.id ||
    claseOriginal ||
    datos.clase;
  const operacionEtiqueta =
    datos.Etiqueta ||
    datos.etiqueta ||
    datos.operacion_etiqueta ||
    datos.Clase ||
    datos.clase ||
    operacionId ||
    claseOriginal;
  const ordenRaw =
    datos.orden_presentacion ??
    datos.orden ??
    datos.Orden ??
    existente?.orden_presentacion ??
    existente?.orden;
  const ordenFinal = Number.isFinite(Number(ordenRaw)) ? Number(ordenRaw) : 0;
  const visibleFinal =
    datos.visible === false ? 0 : existente?.visible === 0 ? 0 : 1;
  Object.entries(operaciones).forEach(([tipo, label]) => {
      if (label) {
        insert.run(
          empresaCanonica,
          modulo,
          anioNumero,
          capituloObjetivo,
          operacionId,
          operacionEtiqueta,
          datos.seccion || "",
        tipo,
        label,
        datos.signo || 1,
        ordenFinal,
        ordenFinal,
        visibleFinal,
        formulaJson
      );
    }
  });

  return { success: true };
};

/**
 * Eliminar una operación específica
 */
const eliminarOperacion = ({
  empresaId = "EMPRESA01",
  modulo,
  anio,
  capitulo,
  clase,
}) => {
  const empresaCanonica = resolverEmpresaLayoutSource(empresaId);

  const del = db.prepare(`
    DELETE FROM layout_operaciones
    WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ? AND (clase = ? OR operacion_etiqueta = ?)
  `);

  const result = del.run(
    empresaCanonica,
    modulo,
    anio,
    capitulo || "DEFAULT",
    clase,
    clase
  );
  return { success: true, changes: result.changes };
};

/**
 * Eliminar todas las operaciones de un capítulo
 */
const eliminarOperacionesCapitulo = ({
  empresaId = "EMPRESA01",
  modulo,
  anio,
  capitulo,
}) => {
  const empresaCanonica = resolverEmpresaLayoutSource(empresaId);
  const anioNumero = Number(anio);
  const capituloSolicitado = LIMPIAR_CLAVE(capitulo || "DEFAULT") || "DEFAULT";
  const capitulosEquivalentes = obtenerCapitulosEquivalentes({
    empresaId: empresaCanonica,
    modulo,
    anio: anioNumero,
    capitulo: capituloSolicitado,
  });
  const caps = capitulosEquivalentes.length ? capitulosEquivalentes : [capituloSolicitado];
  const placeholders = caps.map(() => "?").join(", ");
  const del = db.prepare(`
    DELETE FROM layout_operaciones
    WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo IN (${placeholders})
  `);
  const result = del.run(empresaCanonica, modulo, anioNumero, ...caps);
  return { success: true, changes: result.changes };
};

/**
 * Crear una sección
 */
const crearSeccion = ({
  empresaId = "EMPRESA01",
  modulo,
  anio,
  capitulo,
  tipo,
  nombre,
  principal,
  orden,
}) => {
  const empresaCanonica = resolverEmpresaLayoutSource(empresaId);
  const anioNumero = Number(anio);
  const capituloSolicitado = LIMPIAR_CLAVE(capitulo || "DEFAULT") || "DEFAULT";
  const capituloCanonico = canonizarCapituloLabel(capituloSolicitado);
  const tipoNorm = (tipo || "").toString().trim();
  const ordenNumero = Number.isFinite(Number(orden)) ? Number(orden) : 0;
  const nombreClean = LIMPIAR_CLAVE(nombre || "");
  const principalClean = LIMPIAR_CLAVE(principal || "");

  const insert = db.prepare(`
    INSERT OR REPLACE INTO layout_secciones (
      empresa_id, modulo, anio, capitulo,
      seccion_principal, seccion_secundaria, tipo, orden, orden_presentacion, actualizado_en
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  if (tipoNorm === "principal") {
    insert.run(
      empresaCanonica,
      modulo,
      anioNumero,
      capituloCanonico,
      nombreClean,
      "",
      "principal",
      ordenNumero,
      ordenNumero
    );
  } else {
    insert.run(
      empresaCanonica,
      modulo,
      anioNumero,
      capituloCanonico,
      principalClean,
      nombreClean,
      tipoNorm || "secundaria",
      ordenNumero,
      ordenNumero
    );
  }

  return { success: true, capitulo: capituloCanonico };
};

/**
 * Renombrar una sección (actualiza todas las cuentas asociadas)
 */
const renombrarSeccion = ({
  empresaId = "EMPRESA01",
  modulo,
  anio,
  capitulo,
  nombreOriginal,
  nuevoNombre,
  tipo,
}) => {
  // Usar el mismo "source" que lectura/guardado (alias comparativas EMPRESA09-12).
  const empresaCanonica = resolverEmpresaLayoutSource(empresaId);
  const anioNumero = Number(anio);
  const capituloSolicitado = LIMPIAR_CLAVE(capitulo || "DEFAULT") || "DEFAULT";
  const capitulosEquivalentes = obtenerCapitulosEquivalentes({
    empresaId: empresaCanonica,
    modulo,
    anio: anioNumero,
    capitulo: capituloSolicitado,
  });
  const caps = capitulosEquivalentes.length ? capitulosEquivalentes : [capituloSolicitado];

  const nombreOriginalClean = LIMPIAR_CLAVE(nombreOriginal || "");
  const nuevoNombreClean = LIMPIAR_CLAVE(nuevoNombre || "");

  const transaction = db.transaction(() => {
    const actualizarFormulaJson = (scope) => {
      // Nota: no hacemos LIKE en SQL porque SQLite puede estar en modo case-sensitive;
      // mejor iterar y reemplazar con normalización en JS.
      const ops = db.prepare(
        `
          SELECT DISTINCT clase, formula_json
          FROM layout_operaciones
          WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ?
            AND formula_json IS NOT NULL
            AND TRIM(formula_json) != ''
        `
      ).all(...scope);

      ops.forEach((row) => {
        const raw = (row?.formula_json || "").toString().trim();
        if (!raw) return;
        let parsed = null;
        try {
          parsed = JSON.parse(raw);
        } catch {
          return;
        }
        if (!Array.isArray(parsed) || !parsed.length) return;

        let changed = false;
        const updated = parsed.map((term) => {
          if (!term || typeof term !== "object") return term;
          const termType = (term.type || "").toString().toLowerCase();
          const value = (term.value ?? term.cuenta ?? term.id ?? "").toString();
          if (
            (termType === "section" || termType === "seccion") &&
            value.trim() === nombreOriginalClean
          ) {
            changed = true;
            return { ...term, value: nuevoNombreClean };
          }
          return term;
        });

        if (!changed) return;
        const newJson = JSON.stringify(updated);
        db.prepare(
          `
            UPDATE layout_operaciones
            SET formula_json = ?
            WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ? AND clase = ?
          `
        ).run(newJson, ...scope, row.clase);
      });

      // Legacy: seccion_1, seccion_2... (guardadas como operacion_tipo)
      db.prepare(
        `
          UPDATE layout_operaciones
          SET operacion_label = ?
          WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ?
            AND operacion_tipo LIKE 'seccion_%'
            AND operacion_label = ?
        `
      ).run(nuevoNombreClean, ...scope, nombreOriginalClean);
    };

    caps.forEach((cap) => {
      const scope = [empresaCanonica, modulo, anioNumero, cap];

      if (tipo === "principal") {
        // Update layout_cuentas
        db.prepare(
          `
          UPDATE layout_cuentas
          SET seccion_principal = ?
          WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ? AND seccion_principal = ?
        `
        ).run(
          nuevoNombreClean,
          empresaCanonica,
          modulo,
          anioNumero,
          cap,
          nombreOriginalClean
        );

        // Update layout_secciones
        db.prepare(
          `
          UPDATE layout_secciones
          SET seccion_principal = ?
          WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ? AND seccion_principal = ?
        `
        ).run(
          nuevoNombreClean,
          empresaCanonica,
          modulo,
          anioNumero,
          cap,
          nombreOriginalClean
        );

        // Update operations placement + metadata
        db.prepare(
          `
            UPDATE layout_operaciones
            SET seccion = ?
            WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ? AND seccion = ?
          `
        ).run(nuevoNombreClean, ...scope, nombreOriginalClean);

        db.prepare(
          `
            UPDATE layout_operaciones
            SET operacion_label = ?
            WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ?
              AND operacion_tipo IN ('parentSection', 'parent_section')
              AND operacion_label = ?
          `
        ).run(nuevoNombreClean, ...scope, nombreOriginalClean);

        actualizarFormulaJson(scope);
      } else {
        // Update layout_cuentas for secundaria
        db.prepare(
          `
          UPDATE layout_cuentas
          SET seccion_secundaria = ?
          WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ? AND seccion_secundaria = ?
        `
        ).run(
          nuevoNombreClean,
          empresaCanonica,
          modulo,
          anioNumero,
          cap,
          nombreOriginalClean
        );

        // Update layout_secciones
        db.prepare(
          `
          UPDATE layout_secciones
          SET seccion_secundaria = ?
          WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ? AND seccion_secundaria = ?
        `
        ).run(
          nuevoNombreClean,
          empresaCanonica,
          modulo,
          anioNumero,
          cap,
          nombreOriginalClean
        );

        // Update operations placement + metadata
        db.prepare(
          `
            UPDATE layout_operaciones
            SET seccion = ?
            WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ? AND seccion = ?
          `
        ).run(nuevoNombreClean, ...scope, nombreOriginalClean);

        db.prepare(
          `
            UPDATE layout_operaciones
            SET operacion_label = ?
            WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ?
              AND operacion_tipo IN ('parentSubsection', 'parent_subsection')
              AND operacion_label = ?
          `
        ).run(nuevoNombreClean, ...scope, nombreOriginalClean);

        actualizarFormulaJson(scope);
      }
    });
  });

  transaction();
  return { success: true };
};

// ============================
// Version History (Undo/Restore)
// ============================

const crearLayoutVersion = ({
  empresaId = "EMPRESA01",
  modulo,
  anio,
  capitulo,
  usuarioId = null,
  source = null,
  motivo = null,
  maxVersions = 30,
} = {}) => {
  const empresaCanonica = resolverEmpresaLayoutSource(empresaId);
  const anioNumero = Number(anio);
  const capituloSolicitado = LIMPIAR_CLAVE(capitulo || "DEFAULT") || "DEFAULT";
  const capituloCanonico = canonizarCapituloLabel(capituloSolicitado);
  const capitulosEquivalentes = obtenerCapitulosEquivalentes({
    empresaId: empresaCanonica,
    modulo,
    anio: anioNumero,
    capitulo: capituloSolicitado,
  });
  const capituloConsulta = resolverCapituloConsulta({
    empresaId: empresaCanonica,
    modulo,
    anio: anioNumero,
    capituloSolicitado,
    capituloCanonico,
    candidatos: capitulosEquivalentes,
  });
  if (!empresaCanonica || !modulo || !Number.isInteger(anioNumero)) {
    return { success: false, created: false, message: "Contexto inválido" };
  }

  const scopeQuery = [empresaCanonica, modulo, anioNumero, capituloConsulta];
  const scopeVersion = [empresaCanonica, modulo, anioNumero, capituloCanonico];

  const cuentasRaw = db
    .prepare(
      `
      SELECT
        cuenta,
        nombre,
        capitulo,
        seccion_principal,
        seccion_secundaria,
        operacion_factor,
        orden,
        orden_presentacion,
        visible
      FROM layout_cuentas
      WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ?
      ORDER BY COALESCE(orden_presentacion, orden) ASC, id ASC
    `,
    )
    .all(...scopeQuery);

  const seccionesRaw = db
    .prepare(
      `
      SELECT
        seccion_principal,
        seccion_secundaria,
        tipo,
        orden,
        orden_presentacion
      FROM layout_secciones
      WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ?
      ORDER BY COALESCE(orden_presentacion, orden) ASC, orden ASC, seccion_principal ASC, seccion_secundaria ASC
    `,
    )
    .all(...scopeQuery);

  const operacionesRaw = db
    .prepare(
      `
      SELECT
        capitulo,
        clase,
        operacion_etiqueta,
        seccion,
        operacion_tipo,
        operacion_label,
        signo,
        orden,
        orden_presentacion,
        visible,
        formula_json
      FROM layout_operaciones
      WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ?
      ORDER BY COALESCE(orden_presentacion, orden) ASC, orden ASC, operacion_tipo ASC
    `,
    )
    .all(...scopeQuery);

  const snapshot = {
    schema: 1,
    empresa_id: empresaCanonica,
    modulo,
    anio: anioNumero,
    capitulo: capituloCanonico,
    cuentas: (cuentasRaw || []).map((row) => ({
      cuenta: (row.cuenta ?? "").toString(),
      nombre: (row.nombre ?? "").toString(),
      capitulo: capituloCanonico,
      seccion_principal: (row.seccion_principal ?? "").toString(),
      seccion_secundaria: row.seccion_secundaria == null ? null : row.seccion_secundaria.toString(),
      operacion_factor:
        row.operacion_factor == null || row.operacion_factor === ""
          ? 1
          : Number(row.operacion_factor),
      orden: Number.isFinite(Number(row.orden)) ? Number(row.orden) : 0,
      orden_presentacion:
        row.orden_presentacion == null || row.orden_presentacion === ""
          ? null
          : Number(row.orden_presentacion),
      visible: row.visible == null ? 1 : Number(row.visible),
    })),
    secciones: (seccionesRaw || []).map((row) => ({
      seccion_principal: (row.seccion_principal ?? "").toString(),
      seccion_secundaria: row.seccion_secundaria == null ? null : row.seccion_secundaria.toString(),
      tipo: (row.tipo ?? "").toString(),
      orden: Number.isFinite(Number(row.orden)) ? Number(row.orden) : 0,
      orden_presentacion:
        row.orden_presentacion == null || row.orden_presentacion === ""
          ? null
          : Number(row.orden_presentacion),
    })),
    operaciones: (operacionesRaw || []).map((row) => ({
      capitulo: capituloCanonico,
      clase: (row.clase ?? "").toString(),
      operacion_etiqueta: row.operacion_etiqueta == null ? null : row.operacion_etiqueta.toString(),
      seccion: (row.seccion ?? "").toString(),
      operacion_tipo: (row.operacion_tipo ?? "").toString(),
      operacion_label: row.operacion_label == null ? null : row.operacion_label.toString(),
      signo: Number.isFinite(Number(row.signo)) ? Number(row.signo) : 1,
      orden: Number.isFinite(Number(row.orden)) ? Number(row.orden) : 0,
      orden_presentacion:
        row.orden_presentacion == null || row.orden_presentacion === ""
          ? null
          : Number(row.orden_presentacion),
      visible: row.visible == null ? 1 : Number(row.visible),
      formula_json: row.formula_json == null ? null : row.formula_json.toString(),
    })),
  };

  const snapshotJson = JSON.stringify(snapshot);
  const hash = crypto.createHash("sha256").update(snapshotJson).digest("hex");

  const last = db
    .prepare(
      `
      SELECT id, hash
      FROM layout_versions
      WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ?
      ORDER BY id DESC
      LIMIT 1
    `,
    )
    .get(...scopeVersion);

  if (last?.hash && last.hash === hash) {
    return { success: true, created: false, duplicate: true, id: last.id, hash };
  }

  const insert = db.prepare(
    `
    INSERT INTO layout_versions (
      empresa_id, modulo, anio, capitulo,
      usuario_id, source, motivo, hash, snapshot_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  );

  const run = insert.run(
    empresaCanonica,
    modulo,
    anioNumero,
    capituloCanonico,
    usuarioId != null ? usuarioId : null,
    source != null ? String(source) : null,
    motivo != null ? String(motivo) : null,
    hash,
    snapshotJson,
  );

  const newId = run?.lastInsertRowid ? Number(run.lastInsertRowid) : null;

  const keep = Number.isFinite(Number(maxVersions)) ? Math.max(1, Number(maxVersions)) : 30;
  db.prepare(
    `
      DELETE FROM layout_versions
      WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ?
        AND id NOT IN (
          SELECT id
          FROM layout_versions
          WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ?
          ORDER BY id DESC
          LIMIT ?
        )
    `,
  ).run(...scopeVersion, ...scopeVersion, keep);

  return { success: true, created: true, id: newId, hash };
};

const listarLayoutVersiones = ({
  empresaId = "EMPRESA01",
  modulo,
  anio,
  capitulo,
  limit = 30,
} = {}) => {
  const empresaCanonica = resolverEmpresaLayoutSource(empresaId);
  const anioNumero = Number(anio);
  const capituloSolicitado = LIMPIAR_CLAVE(capitulo || "DEFAULT") || "DEFAULT";
  const capituloCanonico = canonizarCapituloLabel(capituloSolicitado);
  if (!empresaCanonica || !modulo || !Number.isInteger(anioNumero)) {
    return [];
  }
  const take = Number.isFinite(Number(limit)) ? Math.max(1, Math.min(200, Number(limit))) : 30;

  // Permitir listar versiones aunque antes se hayan guardado con variantes del capítulo
  // (p.ej. con tildes o caracteres invisibles).
  const key = NORMALIZAR_CAPITULO(capituloSolicitado);
  const capitulosVersiones = db
    .prepare(
      `
      SELECT DISTINCT capitulo
      FROM layout_versions
      WHERE empresa_id = ? AND modulo = ? AND anio = ?
    `
    )
    .all(empresaCanonica, modulo, anioNumero)
    .map((r) => LIMPIAR_CLAVE(r?.capitulo || ""))
    .filter(Boolean)
    .filter((c) => NORMALIZAR_CAPITULO(c) === key);
  const caps = capitulosVersiones.length ? capitulosVersiones : [capituloCanonico];
  const placeholders = caps.map(() => "?").join(", ");

  return db
    .prepare(
      `
      SELECT
        v.id,
        v.created_at,
        v.usuario_id,
        u.usuario as nombre_usuario,
        v.source,
        v.motivo,
        v.hash
      FROM layout_versions v
      LEFT JOIN usuarios u ON v.usuario_id = u.id
      WHERE v.empresa_id = ? AND v.modulo = ? AND v.anio = ? AND v.capitulo IN (${placeholders})
      ORDER BY v.id DESC
      LIMIT ?
    `,
    )
    .all(empresaCanonica, modulo, anioNumero, ...caps, take);
};

const restaurarLayoutVersion = ({
  empresaId = "EMPRESA01",
  modulo,
  anio,
  capitulo,
  versionId,
  usuarioId = null,
  source = "restore",
  motivo = null,
} = {}) => {
  const empresaCanonica = resolverEmpresaLayoutSource(empresaId);
  const anioNumero = Number(anio);
  const capituloSolicitado = LIMPIAR_CLAVE(capitulo || "DEFAULT") || "DEFAULT";
  const capituloCanonico = canonizarCapituloLabel(capituloSolicitado);
  const idNumero = Number(versionId);
  if (!empresaCanonica || !modulo || !Number.isInteger(anioNumero) || !Number.isInteger(idNumero)) {
    return { success: false, message: "Contexto inválido" };
  }

  // Backup automático antes de restaurar (si cambia, se deduplica por hash).
  crearLayoutVersion({
    empresaId: empresaCanonica,
    modulo,
    anio: anioNumero,
    capitulo: capituloCanonico,
    usuarioId,
    source: "pre-restore-backup",
    motivo: `Backup antes de restaurar versión ${idNumero}`,
  });

  const version = db
    .prepare(
      `
      SELECT capitulo, snapshot_json
      FROM layout_versions
      WHERE id = ? AND empresa_id = ? AND modulo = ? AND anio = ?
      LIMIT 1
    `,
    )
    .get(idNumero, empresaCanonica, modulo, anioNumero);

  if (!version?.snapshot_json) {
    return { success: false, message: "Versión no encontrada" };
  }

  // Validar que la versión pertenece al mismo capítulo "equivalente" (tildes/invisibles).
  const requestedKey = NORMALIZAR_CAPITULO(capituloSolicitado);
  const versionKey = NORMALIZAR_CAPITULO(version?.capitulo || "");
  if (requestedKey && versionKey && requestedKey !== versionKey) {
    return { success: false, message: "Versión no pertenece a este capítulo" };
  }

  let snapshot = null;
  try {
    snapshot = JSON.parse(version.snapshot_json);
  } catch (err) {
    return { success: false, message: "Snapshot inválido" };
  }

  if (!snapshot || snapshot.schema !== 1) {
    return { success: false, message: "Snapshot incompatible" };
  }

  const cuentas = Array.isArray(snapshot.cuentas) ? snapshot.cuentas : [];
  const secciones = Array.isArray(snapshot.secciones) ? snapshot.secciones : [];
  const operaciones = Array.isArray(snapshot.operaciones) ? snapshot.operaciones : [];

  const insertCuenta = db.prepare(
    `
      INSERT INTO layout_cuentas (
        empresa_id, modulo, anio, cuenta, nombre, capitulo,
        seccion_principal, seccion_secundaria, operacion_factor,
        orden, orden_presentacion, visible, actualizado_en
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `,
  );

  const insertSeccion = db.prepare(
    `
      INSERT OR REPLACE INTO layout_secciones (
        empresa_id, modulo, anio, capitulo,
        seccion_principal, seccion_secundaria, tipo, orden, orden_presentacion, actualizado_en
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `,
  );

  const insertOperacion = db.prepare(
    `
      INSERT OR REPLACE INTO layout_operaciones (
        empresa_id, modulo, anio, capitulo,
        clase, operacion_etiqueta, seccion,
        operacion_tipo, operacion_label, signo,
        orden, orden_presentacion, visible, formula_json, actualizado_en
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `,
  );

  const delCuentas = db.prepare(
    `
      DELETE FROM layout_cuentas
      WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ?
    `,
  );
  const delSecciones = db.prepare(
    `
      DELETE FROM layout_secciones
      WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ?
    `,
  );
  const delOperaciones = db.prepare(
    `
      DELETE FROM layout_operaciones
      WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ?
    `,
  );

  const tx = db.transaction(() => {
    const capitulosEquivalentes = obtenerCapitulosEquivalentes({
      empresaId: empresaCanonica,
      modulo,
      anio: anioNumero,
      capitulo: capituloSolicitado,
    });
    const capsToDelete = Array.from(
      new Set([capituloCanonico, ...capitulosEquivalentes].filter(Boolean))
    );

    capsToDelete.forEach((cap) => {
      delCuentas.run(empresaCanonica, modulo, anioNumero, cap);
      delOperaciones.run(empresaCanonica, modulo, anioNumero, cap);
      delSecciones.run(empresaCanonica, modulo, anioNumero, cap);
    });

    secciones.forEach((row) => {
      insertSeccion.run(
        empresaCanonica,
        modulo,
        anioNumero,
        capituloCanonico,
        (row.seccion_principal ?? "").toString(),
        row.seccion_secundaria == null ? "" : row.seccion_secundaria.toString(),
        (row.tipo ?? "").toString(),
        Number.isFinite(Number(row.orden)) ? Number(row.orden) : 0,
        row.orden_presentacion == null || row.orden_presentacion === ""
          ? null
          : Number(row.orden_presentacion),
      );
    });

    cuentas.forEach((row) => {
      insertCuenta.run(
        empresaCanonica,
        modulo,
        anioNumero,
        (row.cuenta ?? "").toString(),
        (row.nombre ?? "").toString(),
        capituloCanonico,
        (row.seccion_principal ?? "").toString(),
        row.seccion_secundaria == null ? null : row.seccion_secundaria.toString(),
        row.operacion_factor == null || row.operacion_factor === ""
          ? 1
          : Number(row.operacion_factor),
        Number.isFinite(Number(row.orden)) ? Number(row.orden) : 0,
        row.orden_presentacion == null || row.orden_presentacion === ""
          ? null
          : Number(row.orden_presentacion),
        row.visible == null ? 1 : Number(row.visible),
      );
    });

    operaciones.forEach((row) => {
      insertOperacion.run(
        empresaCanonica,
        modulo,
        anioNumero,
        capituloCanonico,
        (row.clase ?? "").toString(),
        row.operacion_etiqueta == null ? null : row.operacion_etiqueta.toString(),
        (row.seccion ?? "").toString(),
        (row.operacion_tipo ?? "").toString(),
        row.operacion_label == null ? "" : row.operacion_label.toString(),
        Number.isFinite(Number(row.signo)) ? Number(row.signo) : 1,
        Number.isFinite(Number(row.orden)) ? Number(row.orden) : 0,
        row.orden_presentacion == null || row.orden_presentacion === ""
          ? null
          : Number(row.orden_presentacion),
        row.visible == null ? 1 : Number(row.visible),
        row.formula_json == null ? null : row.formula_json.toString(),
      );
    });
  });

  tx();

  crearLayoutVersion({
    empresaId: empresaCanonica,
    modulo,
    anio: anioNumero,
    capitulo: capituloCanonico,
    usuarioId,
    source: source || "restore",
    motivo: motivo || `Restaurar versión ${idNumero}`,
  });

  return { success: true };
};

module.exports = {
  obtenerLayout,
  obtenerCapitulos,
  obtenerAniosDisponibles,
  guardarCuentas,
  guardarOperaciones,
  copiarLayout,
  eliminarLayout,
  eliminarLayoutCapitulo,
  existeLayout,
  obtenerEstadisticasLayout,
  obtenerEmpresaCanonica,
  crearLayoutDemo,
  actualizarCuenta,
  eliminarCuenta,
  reordenarCuentas,
  actualizarOperacion,
  eliminarOperacion,
  eliminarOperacionesCapitulo,
  crearSeccion,
  renombrarSeccion,
  crearLayoutVersion,
  listarLayoutVersiones,
  restaurarLayoutVersion,
};
