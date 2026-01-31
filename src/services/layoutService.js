/**
 * layoutService.js
 * Servicio para gestionar layouts de módulos por año y capítulo en SQLite
 */

const { EMPRESAS } = require("../config/empresas");
const db = require("../db/sqlite").db;

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
    deleteCuentas.run(empresaCanonica, modulo, anioNumero, capitulo);
    deleteOperaciones.run(empresaCanonica, modulo, anioNumero, capitulo);
    deleteSecciones.run(empresaCanonica, modulo, anioNumero, capitulo);
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

  const capituloObjetivo = capitulo || "DEFAULT";

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
      .all(empresaConsulta, modulo, anioObjetivo, capituloObjetivo);

  const normalizarVisible = (value) => {
    if (value === null || value === undefined) return true;
    if (typeof value === "boolean") return value;
    return Number(value) !== 0;
  };

  const normalizarOrden = (value) => {
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
      orden
    FROM layout_secciones
    WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ?
    ORDER BY orden ASC, seccion_principal ASC, seccion_secundaria ASC
  `
      )
      .all(empresaConsulta, modulo, anioObjetivo, capituloObjetivo);

  const normalizarClave = (valor) =>
    (valor || "").toString().trim().toUpperCase();

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
    .all(empresaConsulta, modulo, anioUsado, capituloObjetivo);

  const operacionesMap = {};
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
    operacionesMap[mapKey][op.operacion_tipo] = op.operacion_label;
    operacionesMap[mapKey].signos[op.operacion_tipo] = op.signo ?? 1;
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
        const orden = Number.isFinite(Number(row.orden))
          ? Number(row.orden)
          : idx;
        if (!principalInfo.has(principalKey)) {
          principalInfo.set(principalKey, { name: principalRaw, order: orden });
        }
        if (secundariaRaw) {
          const list = secondaryInfo.get(principalKey) || [];
          list.push({
            principalName: principalRaw,
            name: secundariaRaw,
            order: orden,
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
          const orderHint = principalOrder * 1000 + (sec.order ?? 0);
          placeholders.push(
            makePlaceholder({
              principal: principalName,
              secundaria: sec.name,
              type: "secundaria",
              orderHint,
            })
          );
        });
      });

      principalInfo.forEach((meta, principalKey) => {
        if (secondaryInfo.has(principalKey)) return;
        if (principalSet.has(principalKey)) return;
        placeholders.push(
          makePlaceholder({
            principal: meta.name,
            secundaria: "",
            type: "principal",
            orderHint: meta.order ?? 0,
          })
        );
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

  let capitulos = db
    .prepare(
      `
    SELECT DISTINCT capitulo
    FROM layout_cuentas
    WHERE empresa_id = ? AND modulo = ? AND anio = ?
    ORDER BY capitulo ASC
  `
    )
    .all(empresaConsulta, modulo, anioNumero);

  // Sin fallback automático: devolver capítulos del año solicitado.

  return (capitulos || []).map((c) => ({ capitulo: c.capitulo }));
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
  const empresaCanonica = obtenerEmpresaCanonica(empresaId);
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
      seccion_secundaria, tipo, orden, actualizado_en
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  const normalizarSeccion = (valor) =>
    (valor || "").toString().trim();

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
    const ordenPrincipal = new Map();
    const ordenSecundaria = new Map();
    let siguienteOrdenPrincipal = 0;

    const registrarPrincipal = (principal) => {
      const clave = normalizarSeccion(principal);
      if (!clave) return null;
      if (!ordenPrincipal.has(clave)) {
        ordenPrincipal.set(clave, siguienteOrdenPrincipal);
        siguienteOrdenPrincipal += 1;
      }
      return clave;
    };

    const registrarSecundaria = (principal, secundaria) => {
      const principalClave = normalizarSeccion(principal);
      const secundariaClave = normalizarSeccion(secundaria);
      if (!principalClave || !secundariaClave) return null;
      let mapa = ordenSecundaria.get(principalClave);
      if (!mapa) {
        mapa = new Map();
        ordenSecundaria.set(principalClave, mapa);
      }
      if (!mapa.has(secundariaClave)) {
        mapa.set(secundariaClave, mapa.size);
      }
      return { principalClave, secundariaClave, orden: mapa.get(secundariaClave) };
    };

    const seccionesRegistradas = new Set();
    deleteCuentas.run(empresaCanonica, modulo, anio, capitulo);
    deleteSecciones.run(empresaCanonica, modulo, anio, capitulo);

    const cuentasOrdenadas = (cuentasArray || [])
      .map((cuenta, index) => ({
        cuenta,
        index,
        orden: obtenerOrden(cuenta, index),
      }))
      .sort((a, b) => a.orden - b.orden || a.index - b.index);

    cuentasOrdenadas.forEach(({ cuenta, index }) => {
      const cuentaCodigo = (obtenerCuentaCodigo(cuenta) || "").toString().trim();
      let seccionPrincipal = obtenerSeccionPrincipal(cuenta);
      let seccionSecundaria = obtenerSeccionSecundaria(cuenta) || null;
      if (!seccionPrincipal && seccionSecundaria) {
        seccionPrincipal = seccionSecundaria;
        seccionSecundaria = null;
      }

      if (!cuentaCodigo) {
        if (!seccionPrincipal && !seccionSecundaria) {
          console.warn(
            `[layoutService] Cuenta sin codigo en ${modulo}/${capitulo}, ignorando`
          );
          return;
        }
        const principalClave = registrarPrincipal(seccionPrincipal);
        if (principalClave) {
          const keyPrincipal = `${principalClave}||`;
          if (!seccionesRegistradas.has(keyPrincipal)) {
            seccionesRegistradas.add(keyPrincipal);
            insertSeccion.run(
              empresaCanonica,
              modulo,
              anio,
              capitulo,
              principalClave,
              "",
              "principal",
              ordenPrincipal.get(principalClave) ?? 0
            );
          }
        }

        if (seccionSecundaria) {
          const info = registrarSecundaria(seccionPrincipal, seccionSecundaria);
          if (info) {
            const keySecundaria = `${info.principalClave}||${info.secundariaClave}`;
            if (!seccionesRegistradas.has(keySecundaria)) {
              seccionesRegistradas.add(keySecundaria);
              insertSeccion.run(
                empresaCanonica,
                modulo,
                anio,
                capitulo,
                info.principalClave,
                info.secundariaClave,
                "secundaria",
                info.orden ?? 0
              );
            }
          }
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
      const ordenPresentacion = obtenerOrden(cuenta, index);
      const visible = cuenta.visible === false ? 0 : 1;

      insertCuenta.run(
        empresaCanonica,
        modulo,
        anio,
        cuentaCodigo,
        nombre,
        capitulo,
        seccionPrincipal,
        seccionSecundaria,
        operacionFactorFinal,
        ordenPresentacion,
        ordenPresentacion,
        visible
      );

      const principalClave = registrarPrincipal(seccionPrincipal);
      if (principalClave) {
        const keyPrincipal = `${principalClave}||`;
        if (!seccionesRegistradas.has(keyPrincipal)) {
          seccionesRegistradas.add(keyPrincipal);
          insertSeccion.run(
            empresaCanonica,
            modulo,
            anio,
            capitulo,
            principalClave,
            "",
            "principal",
            ordenPrincipal.get(principalClave) ?? 0
          );
        }
      }

      if (seccionSecundaria) {
        const info = registrarSecundaria(seccionPrincipal, seccionSecundaria);
        if (info) {
          const keySecundaria = `${info.principalClave}||${info.secundariaClave}`;
          if (!seccionesRegistradas.has(keySecundaria)) {
            seccionesRegistradas.add(keySecundaria);
            insertSeccion.run(
              empresaCanonica,
              modulo,
              anio,
              capitulo,
              info.principalClave,
              info.secundariaClave,
              "secundaria",
              info.orden ?? 0
            );
          }
        }
      }
    });
  });

  transaction(cuentas);
  return { success: true, insertadas: cuentas.length };
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
  const empresaCanonica = obtenerEmpresaCanonica(empresaId);
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
        "Etiqueta",
        "etiqueta",
        "SECCION",
        "seccion",
        "formula_json",
        "formula_terms",
        "signo",
        "signos",
        "orden",
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
        if (op[tipo]) {
          const signoDesdeMapa = op.signos?.[tipo];
          const signoConfigurado = Number.isFinite(Number(signoDesdeMapa))
            ? Number(signoDesdeMapa)
            : Number(op.signo);
          let signo =
            Number.isFinite(signoConfigurado) && signoConfigurado !== 0
              ? signoConfigurado
              : 1;
          if (
            !Number.isFinite(signoConfigurado) &&
            op.Clase &&
            op.Clase.toLowerCase().includes("expense")
          ) {
            signo = -1;
          }

          const capitulo = op.CAPITULO || op.HOJA || "DEFAULT";
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
              capitulo,
              clase,
              operacionEtiqueta,
              seccion,
              tipo,
              op[tipo],
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
        const capitulo = op.CAPITULO || op.HOJA || "DEFAULT";
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
            capitulo,
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
          console.error(
            `Error inserting free operation ${clase}:`,
            err.message
          );
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
  const empresaCanonica = obtenerEmpresaCanonica(empresaId);
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
      seccion_principal, seccion_secundaria, orden, orden_presentacion, visible
    )
    SELECT 
      empresa_id, modulo, ?, cuenta, nombre, capitulo,
      seccion_principal, seccion_secundaria, orden, orden_presentacion, visible
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
      seccion_secundaria, tipo, orden
    )
    SELECT 
      empresa_id, modulo, ?, capitulo, seccion_principal,
      seccion_secundaria, tipo, orden
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
  const empresaCanonica = obtenerEmpresaCanonica(empresaId);
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
  const empresaCanonica = obtenerEmpresaCanonica(empresaId);
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
  const empresaCanonica = obtenerEmpresaCanonica(empresaId);
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
  const empresaCanonica = obtenerEmpresaCanonica(empresaId);

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
  const empresaCanonica = obtenerEmpresaCanonica(empresaId);

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
  const empresaCanonica = obtenerEmpresaCanonica(empresaId);

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
      .all(empresaConsulta, modulo, anioNumero, empresaConsulta, modulo, anioNumero);
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
      empresaCanonica,
      modulo,
      anio,
      capituloObjetivo,
      claseOriginal,
      claseOriginal
    );

  // Primero eliminar la operación existente
  const del = db.prepare(`
    DELETE FROM layout_operaciones
    WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ? COLLATE NOCASE AND (clase = ? OR operacion_etiqueta = ?)
  `);
  del.run(
    empresaCanonica,
    modulo,
    anio,
    capituloObjetivo,
    claseOriginal,
    claseOriginal
  );

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
        anio,
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
  const del = db.prepare(`
    DELETE FROM layout_operaciones
    WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ? COLLATE NOCASE
  `);
  const result = del.run(
    empresaCanonica,
    modulo,
    anio,
    capitulo || "DEFAULT"
  );
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

  const insert = db.prepare(`
    INSERT OR REPLACE INTO layout_secciones (empresa_id, modulo, anio, capitulo, seccion_principal, seccion_secundaria, tipo, orden)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  if (tipo === "principal") {
    insert.run(
      empresaCanonica,
      modulo,
      anio,
      capitulo,
      nombre,
      "",
      tipo,
      orden
    );
  } else {
    insert.run(
      empresaCanonica,
      modulo,
      anio,
      capitulo,
      principal || "",
      nombre,
      tipo,
      orden
    );
  }

  return { success: true };
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
  const empresaCanonica = obtenerEmpresaCanonica(empresaId);

  const transaction = db.transaction(() => {
    if (tipo === "principal") {
      // Update layout_cuentas
      db.prepare(
        `
        UPDATE layout_cuentas
        SET seccion_principal = ?
        WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ? AND seccion_principal = ?
      `
      ).run(
        nuevoNombre,
        empresaCanonica,
        modulo,
        anio,
        capitulo,
        nombreOriginal
      );

      // Update layout_secciones
      db.prepare(
        `
        UPDATE layout_secciones
        SET seccion_principal = ?
        WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ? AND seccion_principal = ?
      `
      ).run(
        nuevoNombre,
        empresaCanonica,
        modulo,
        anio,
        capitulo,
        nombreOriginal
      );
    } else {
      // Update layout_cuentas for secundaria
      db.prepare(
        `
        UPDATE layout_cuentas
        SET seccion_secundaria = ?
        WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ? AND seccion_secundaria = ?
      `
      ).run(
        nuevoNombre,
        empresaCanonica,
        modulo,
        anio,
        capitulo,
        nombreOriginal
      );

      // Update layout_secciones
      db.prepare(
        `
        UPDATE layout_secciones
        SET seccion_secundaria = ?
        WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ? AND seccion_secundaria = ?
      `
      ).run(
        nuevoNombre,
        empresaCanonica,
        modulo,
        anio,
        capitulo,
        nombreOriginal
      );
    }
  });

  transaction();
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
};
