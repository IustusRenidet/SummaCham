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

const FORMULA_V2_VERSION = 2;
const FORMULA_OPERADORES_VALIDOS = new Set(["+", "-", "*", "/", "(", ")"]);
const FORMULA_KIND_REF = "ref";
const FORMULA_KIND_CONST = "const";
const FORMULA_KIND_OP = "op";

const NORMALIZAR_ID_SEGMENTO = (valor = "") =>
  LIMPIAR_CLAVE(valor)
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

const NORMALIZAR_CUENTA_REF = (valor = "") =>
  LIMPIAR_CLAVE(valor)
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^0-9A-Z]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

const construirRefIdSeccion = (principal = "") => {
  const key = NORMALIZAR_ID_SEGMENTO(principal);
  return key ? `SEC::${key}` : "";
};

const construirRefIdSubseccion = (principal = "", secundaria = "") => {
  const p = NORMALIZAR_ID_SEGMENTO(principal);
  const s = NORMALIZAR_ID_SEGMENTO(secundaria);
  return p && s ? `SUB::${p}::${s}` : "";
};

const construirRefIdCuenta = (cuenta = "") => {
  const key = NORMALIZAR_CUENTA_REF(cuenta);
  return key ? `ACC::${key}` : "";
};

const construirRefIdOperacion = (operationId = "") => {
  const key = NORMALIZAR_ID_SEGMENTO(operationId);
  return key ? `OP::${key}` : "";
};

const esFormulaV2 = (value) =>
  Boolean(
    value &&
      typeof value === "object" &&
      Number(value.version) === FORMULA_V2_VERSION &&
      Array.isArray(value.tokens),
  );

const parseJsonSeguro = (raw) => {
  if (raw == null || raw === "") return null;
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(String(raw));
  } catch (_) {
    return null;
  }
};

const esListaTerminosLegacy = (arr) =>
  Array.isArray(arr) &&
  arr.length > 0 &&
  arr.every(
    (term) =>
      term &&
      typeof term === "object" &&
      ("operator" in term ||
        "type" in term ||
        "value" in term ||
        "cuenta" in term ||
        "constant" in term ||
        "id" in term),
  );

const crearContextoFormula = ({ cuentas = [], operaciones = [] } = {}) => {
  const sectionsByKey = new Map(); // key(label) -> refId
  const subsectionsByComposite = new Map(); // key(principal||sub) -> refId
  const subsectionsByName = new Map(); // key(sub) -> Set(refId)
  const operationsByKey = new Map(); // key(id/label) -> refId

  (cuentas || []).forEach((cuenta) => {
    const principal =
      cuenta["SECCION Principal"] ||
      cuenta["SECCIÓN Principal"] ||
      cuenta["SECCIàN Principal"] ||
      cuenta.seccion_principal ||
      cuenta.SECCION ||
      "";
    const secundaria =
      cuenta["SECCION Secundaria"] ||
      cuenta["SECCIÓN Secundaria"] ||
      cuenta["SECCIàN Secundaria"] ||
      cuenta.seccion_secundaria ||
      "";
    const principalClean = LIMPIAR_CLAVE(principal);
    const secundariaClean = LIMPIAR_CLAVE(secundaria);
    if (principalClean) {
      const secRefId = construirRefIdSeccion(principalClean);
      const secKey = NORMALIZAR_CLAVE(principalClean);
      if (secRefId && secKey && !sectionsByKey.has(secKey)) {
        sectionsByKey.set(secKey, secRefId);
      }
    }
    if (principalClean && secundariaClean) {
      const subRefId = construirRefIdSubseccion(principalClean, secundariaClean);
      const compositeKey = `${NORMALIZAR_CLAVE(principalClean)}||${NORMALIZAR_CLAVE(
        secundariaClean,
      )}`;
      if (subRefId && !subsectionsByComposite.has(compositeKey)) {
        subsectionsByComposite.set(compositeKey, subRefId);
      }
      const subKey = NORMALIZAR_CLAVE(secundariaClean);
      if (subKey) {
        if (!subsectionsByName.has(subKey)) {
          subsectionsByName.set(subKey, new Set());
        }
        subsectionsByName.get(subKey).add(subRefId);
      }
    }
  });

  (operaciones || []).forEach((op) => {
    const opId = LIMPIAR_CLAVE(op.OperacionId || op.Clase || op.clase || "");
    const opLabel = LIMPIAR_CLAVE(
      op.operacion_etiqueta || op.operacion_label || op.Clase || "",
    );
    const refId = construirRefIdOperacion(opId || opLabel);
    if (!refId) return;
    const keys = [opId, opLabel]
      .map((v) => NORMALIZAR_CLAVE(v))
      .filter(Boolean);
    keys.forEach((k) => {
      if (!operationsByKey.has(k)) operationsByKey.set(k, refId);
    });
  });

  return {
    sectionsByKey,
    subsectionsByComposite,
    subsectionsByName,
    operationsByKey,
  };
};

const resolverRefIdTerminoLegacy = (term = {}, context = {}) => {
  const tipo = (term.type || "").toString().trim().toLowerCase();
  const valorRaw = (term.value ?? term.cuenta ?? term.id ?? "").toString().trim();
  const parentRaw = (term.parentSection || "").toString().trim();
  const valor = LIMPIAR_CLAVE(valorRaw);
  const parent = LIMPIAR_CLAVE(parentRaw);

  if (tipo === "constant" || tipo === "constante") {
    const numero =
      term.constant != null ? Number(term.constant) : Number(term.value);
    return {
      token: {
        kind: FORMULA_KIND_CONST,
        value: Number.isFinite(numero) ? numero : 0,
      },
      unresolved: false,
    };
  }

  if (tipo === "account" || tipo === "cuenta") {
    const refId = construirRefIdCuenta(valor);
    return {
      token: {
        kind: FORMULA_KIND_REF,
        refType: "account",
        refId,
        label: valorRaw || valor,
      },
      unresolved: !refId,
    };
  }

  if (tipo === "operation" || tipo === "operacion") {
    const key = NORMALIZAR_CLAVE(valor);
    const mapped = key ? context.operationsByKey?.get(key) : "";
    const refId = mapped || construirRefIdOperacion(valor);
    return {
      token: {
        kind: FORMULA_KIND_REF,
        refType: "operation",
        refId,
        label: valorRaw || valor,
        unresolved: !mapped && Boolean(valor),
      },
      unresolved: !mapped && Boolean(valor),
    };
  }

  // Section/Subsection fallback
  const parentKey = NORMALIZAR_CLAVE(parent);
  const valueKey = NORMALIZAR_CLAVE(valor);
  if (parentKey && valueKey) {
    const composite = `${parentKey}||${valueKey}`;
    const mappedSub = context.subsectionsByComposite?.get(composite);
    const subRefId = mappedSub || construirRefIdSubseccion(parent, valor);
    return {
      token: {
        kind: FORMULA_KIND_REF,
        refType: "subsection",
        refId: subRefId,
        label: valorRaw || valor,
        unresolved: !mappedSub && Boolean(valor),
      },
      unresolved: !mappedSub && Boolean(valor),
    };
  }

  if (valueKey) {
    const mappedSec = context.sectionsByKey?.get(valueKey);
    if (mappedSec) {
      return {
        token: {
          kind: FORMULA_KIND_REF,
          refType: "section",
          refId: mappedSec,
          label: valorRaw || valor,
        },
        unresolved: false,
      };
    }
    const subCandidates = context.subsectionsByName?.get(valueKey);
    if (subCandidates && subCandidates.size === 1) {
      const [subRefId] = Array.from(subCandidates);
      return {
        token: {
          kind: FORMULA_KIND_REF,
          refType: "subsection",
          refId: subRefId,
          label: valorRaw || valor,
        },
        unresolved: false,
      };
    }
  }

  const secRefId = construirRefIdSeccion(valor);
  return {
    token: {
      kind: FORMULA_KIND_REF,
      refType: "section",
      refId: secRefId,
      label: valorRaw || valor,
      unresolved: Boolean(valor),
    },
    unresolved: Boolean(valor),
  };
};

const repararTerminosLegacyCuentaFragmentada = (terms = []) => {
  const list = Array.isArray(terms) ? terms : [];
  const out = [];
  const toType = (term) => (term?.type || "").toString().toLowerCase();
  const isAccount = (term) => {
    const t = toType(term);
    return t === "account" || t === "cuenta";
  };
  const readValue = (term) =>
    (term?.value ?? term?.cuenta ?? term?.id ?? "").toString().trim();
  const isChunk = (value) => /^\d{1,3}$/.test(value);
  const buildAccountCode = (a, b, c, d) =>
    `${String(a).padStart(3, "0")}-${String(b).padStart(3, "0")}-${String(
      c
    ).padStart(3, "0")}-${String(d).padStart(2, "0")}`;

  for (let i = 0; i < list.length; i += 1) {
    const t0 = list[i];
    if (!t0 || typeof t0 !== "object") continue;

    const t1 = list[i + 1];
    const t2 = list[i + 2];
    const t3 = list[i + 3];
    const v0 = readValue(t0);
    const v1 = readValue(t1);
    const v2 = readValue(t2);
    const v3 = readValue(t3);
    const op1 = (t1?.operator || "").toString().trim();
    const op2 = (t2?.operator || "").toString().trim();
    const op3 = (t3?.operator || "").toString().trim();

    const mergeable =
      isAccount(t0) &&
      isAccount(t1) &&
      isAccount(t2) &&
      isAccount(t3) &&
      isChunk(v0) &&
      isChunk(v1) &&
      isChunk(v2) &&
      isChunk(v3) &&
      op1 === "-" &&
      op2 === "-" &&
      op3 === "-";

    if (mergeable) {
      out.push({
        ...t0,
        type: "account",
        value: buildAccountCode(v0, v1, v2, v3),
      });
      i += 3;
      continue;
    }

    out.push(t0);
  }

  return out;
};

const convertirTerminosLegacyATokensV2 = (terms = [], context = {}) => {
  const tokens = [];
  let unresolved = 0;
  const list = repararTerminosLegacyCuentaFragmentada(terms);

  list.forEach((term, idx) => {
    if (!term || typeof term !== "object") return;
    const rawOperator = (term.operator || "+").toString().trim();
    const operator = FORMULA_OPERADORES_VALIDOS.has(rawOperator)
      ? rawOperator
      : rawOperator === "×"
      ? "*"
      : rawOperator === "÷"
      ? "/"
      : "+";

    const resolved = resolverRefIdTerminoLegacy(term, context);
    if (!resolved?.token) return;

    if (idx === 0) {
      if (operator === "-") {
        tokens.push({ kind: FORMULA_KIND_CONST, value: 0 });
        tokens.push({ kind: FORMULA_KIND_OP, value: "-" });
      } else if (operator === "+" || operator === "*" || operator === "/") {
        // sin prefijo
      } else {
        tokens.push({ kind: FORMULA_KIND_OP, value: "+" });
      }
    } else {
      tokens.push({ kind: FORMULA_KIND_OP, value: operator });
    }

    tokens.push(resolved.token);
    if (resolved.unresolved) unresolved += 1;
  });

  return { tokens, unresolved };
};

const normalizarTokenV2 = (token = {}, context = {}) => {
  if (!token || typeof token !== "object") return null;
  const kind = (token.kind || token.type || "").toString().trim().toLowerCase();

  if (kind === FORMULA_KIND_OP || kind === "operator") {
    const valueRaw = (token.value || token.operator || "").toString().trim();
    const value =
      valueRaw === "×"
        ? "*"
        : valueRaw === "÷"
        ? "/"
        : FORMULA_OPERADORES_VALIDOS.has(valueRaw)
        ? valueRaw
        : "";
    if (!value) return null;
    return { token: { kind: FORMULA_KIND_OP, value }, unresolved: false };
  }

  if (kind === FORMULA_KIND_CONST || kind === "constant") {
    const raw = token.value ?? token.constant;
    const num = Number(raw);
    return {
      token: {
        kind: FORMULA_KIND_CONST,
        value: Number.isFinite(num) ? num : 0,
      },
      unresolved: false,
    };
  }

  if (kind === FORMULA_KIND_REF || kind === "reference") {
    const refType = (token.refType || token.typeRef || token.type || "section")
      .toString()
      .trim()
      .toLowerCase();
    const label = (token.label || token.value || "").toString().trim();
    let refId = (token.refId || "").toString().trim();
    let unresolved = Boolean(token.unresolved);

    if (!refId && label) {
      if (refType === "account" || refType === "cuenta") {
        refId = construirRefIdCuenta(label);
      } else if (refType === "operation" || refType === "operacion") {
        const key = NORMALIZAR_CLAVE(label);
        refId = context.operationsByKey?.get(key) || construirRefIdOperacion(label);
      } else if (refType === "subsection" || refType === "subseccion") {
        const parent = (token.parentSection || "").toString().trim();
        refId = construirRefIdSubseccion(parent, label);
        unresolved = true;
      } else {
        const key = NORMALIZAR_CLAVE(label);
        refId = context.sectionsByKey?.get(key) || construirRefIdSeccion(label);
      }
    }

    const normalizedRefType =
      refType === "cuenta"
        ? "account"
        : refType === "operacion"
        ? "operation"
        : refType === "subseccion"
        ? "subsection"
        : refType === "seccion"
        ? "section"
        : refType || "section";

    if (!refId) {
      return {
        token: {
          kind: FORMULA_KIND_REF,
          refType: normalizedRefType,
          refId: "",
          label,
          unresolved: true,
        },
        unresolved: true,
      };
    }

    return {
      token: {
        kind: FORMULA_KIND_REF,
        refType: normalizedRefType,
        refId,
        label: label || refId,
        unresolved: Boolean(unresolved),
      },
      unresolved: Boolean(unresolved),
    };
  }

  return null;
};

const convertirTokensV2ATerminosLegacy = (tokens = []) => {
  const terms = [];
  let pendingOperator = "+";

  (Array.isArray(tokens) ? tokens : []).forEach((token) => {
    if (!token || typeof token !== "object") return;
    if (token.kind === FORMULA_KIND_OP) {
      const op = (token.value || "").toString().trim();
      if (op === "+" || op === "-" || op === "*" || op === "/") {
        pendingOperator = op;
      }
      return;
    }

    if (token.kind === FORMULA_KIND_CONST) {
      terms.push({
        operator: pendingOperator,
        type: "constant",
        value: String(Number(token.value) || 0),
        constant: Number(token.value) || 0,
      });
      pendingOperator = "+";
      return;
    }

    if (token.kind === FORMULA_KIND_REF) {
      const refType = (token.refType || "section").toString().toLowerCase();
      const legacyType =
        refType === "subsection"
          ? "section"
          : refType === "operation"
          ? "operation"
          : refType === "account"
          ? "account"
          : "section";
      terms.push({
        operator: pendingOperator,
        type: legacyType,
        value: token.label || token.refId || "",
      });
      pendingOperator = "+";
    }
  });

  return terms;
};

const tokenizarFormulaTexto = (formula = "") => {
  const source = String(formula || "");
  const tokens = [];
  let buffer = "";

  const flushBuffer = () => {
    const value = buffer.trim();
    if (value) tokens.push({ kind: "value", value });
    buffer = "";
  };

  const getPrevNonSpace = (idx) => {
    for (let i = idx - 1; i >= 0; i -= 1) {
      const ch = source[i];
      if (!/\s/.test(ch)) return ch;
    }
    return "";
  };

  const getNextNonSpace = (idx) => {
    for (let i = idx + 1; i < source.length; i += 1) {
      const ch = source[i];
      if (!/\s/.test(ch)) return ch;
    }
    return "";
  };

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    const op = ch === "×" ? "*" : ch === "÷" ? "/" : ch;
    if (op === "+" || op === "*" || op === "/" || op === "(" || op === ")") {
      flushBuffer();
      tokens.push({ kind: FORMULA_KIND_OP, value: op });
      continue;
    }
    if (op === "-") {
      const prev = getPrevNonSpace(i);
      const next = getNextNonSpace(i);
      const isOperatorDash =
        !prev ||
        !next ||
        /\s/.test(source[i - 1] || "") ||
        /\s/.test(source[i + 1] || "") ||
        ["+", "-", "*", "/", "("].includes(prev) ||
        next === "(";
      if (isOperatorDash) {
        flushBuffer();
        tokens.push({ kind: FORMULA_KIND_OP, value: "-" });
        continue;
      }
    }
    buffer += ch;
  }
  flushBuffer();
  return tokens;
};

const parsearSeleccionFormulaTexto = (value = "") => {
  const raw = (value || "").toString().trim();
  if (!raw) return { label: "", parent: "" };
  const parts = raw.split("||");
  if (parts.length > 1) {
    const parent = parts[0]?.trim() || "";
    const label = parts.slice(1).join("||").trim();
    return { label, parent };
  }
  return { label: raw, parent: "" };
};

const construirTokenDesdeTexto = (valueRaw = "", context = {}) => {
  const raw = (valueRaw || "").toString().trim();
  if (!raw) return null;

  const numericValue = Number(raw);
  if (Number.isFinite(numericValue) && /^[-+]?\d+(\.\d+)?$/.test(raw)) {
    return {
      token: { kind: FORMULA_KIND_CONST, value: numericValue },
      unresolved: false,
    };
  }

  const normalizedRawKey = NORMALIZAR_CLAVE(raw);
  if (normalizedRawKey && context.operationsByKey?.has(normalizedRawKey)) {
    return {
      token: {
        kind: FORMULA_KIND_REF,
        refType: "operation",
        refId: context.operationsByKey.get(normalizedRawKey),
        label: raw,
      },
      unresolved: false,
    };
  }

  if (/^\d{3}[-\d]/.test(raw)) {
    const refId = construirRefIdCuenta(raw);
    return {
      token: {
        kind: FORMULA_KIND_REF,
        refType: "account",
        refId,
        label: raw,
        unresolved: !refId,
      },
      unresolved: !refId,
    };
  }

  const selection = parsearSeleccionFormulaTexto(raw);
  const label = selection.label || raw;
  const parent = selection.parent || "";
  const labelKey = NORMALIZAR_CLAVE(label);
  const parentKey = NORMALIZAR_CLAVE(parent);

  if (parentKey && labelKey) {
    const composite = `${parentKey}||${labelKey}`;
    const mappedSub = context.subsectionsByComposite?.get(composite);
    const refId = mappedSub || construirRefIdSubseccion(parent, label);
    return {
      token: {
        kind: FORMULA_KIND_REF,
        refType: "subsection",
        refId,
        label,
        unresolved: !mappedSub,
      },
      unresolved: !mappedSub,
    };
  }

  if (labelKey && context.sectionsByKey?.has(labelKey)) {
    return {
      token: {
        kind: FORMULA_KIND_REF,
        refType: "section",
        refId: context.sectionsByKey.get(labelKey),
        label,
      },
      unresolved: false,
    };
  }

  if (labelKey) {
    const candidates = context.subsectionsByName?.get(labelKey);
    if (candidates && candidates.size === 1) {
      const [subRefId] = Array.from(candidates);
      return {
        token: {
          kind: FORMULA_KIND_REF,
          refType: "subsection",
          refId: subRefId,
          label,
        },
        unresolved: false,
      };
    }
  }

  const refId = construirRefIdSeccion(label);
  return {
    token: {
      kind: FORMULA_KIND_REF,
      refType: "section",
      refId,
      label,
      unresolved: !refId,
    },
    unresolved: !refId,
  };
};

const parsearFormulaTextoATokensV2 = (formulaRaw = "", context = {}) => {
  const raw = String(formulaRaw || "").trim();
  if (!raw) return { valid: true, tokens: [], unresolved: 0 };

  const lexical = tokenizarFormulaTexto(raw);
  const tokens = [];
  let balance = 0;
  let unresolved = 0;
  let expectingValue = true;

  for (let idx = 0; idx < lexical.length; idx += 1) {
    const item = lexical[idx];
    if (!item) continue;

    if (item.kind === FORMULA_KIND_OP) {
      const opValue = (item.value || "").toString().trim();
      if (!FORMULA_OPERADORES_VALIDOS.has(opValue)) {
        return { valid: false, tokens: [], unresolved: 0 };
      }

      if (opValue === "(") {
        if (!expectingValue) return { valid: false, tokens: [], unresolved: 0 };
        balance += 1;
        tokens.push({ kind: FORMULA_KIND_OP, value: "(" });
        expectingValue = true;
        continue;
      }

      if (opValue === ")") {
        if (expectingValue || balance <= 0) {
          return { valid: false, tokens: [], unresolved: 0 };
        }
        balance -= 1;
        tokens.push({ kind: FORMULA_KIND_OP, value: ")" });
        expectingValue = false;
        continue;
      }

      if (expectingValue) {
        if (opValue === "+" || opValue === "-") {
          tokens.push({ kind: FORMULA_KIND_OP, value: opValue });
          expectingValue = true;
          continue;
        }
        return { valid: false, tokens: [], unresolved: 0 };
      }

      tokens.push({ kind: FORMULA_KIND_OP, value: opValue });
      expectingValue = true;
      continue;
    }

    if (!expectingValue) {
      return { valid: false, tokens: [], unresolved: 0 };
    }

    const resolved = construirTokenDesdeTexto(item.value, context);
    if (!resolved?.token) return { valid: false, tokens: [], unresolved: 0 };
    tokens.push(resolved.token);
    if (resolved.unresolved) unresolved += 1;
    expectingValue = false;
  }

  if (balance !== 0 || expectingValue) {
    return { valid: false, tokens: [], unresolved: 0 };
  }

  return { valid: true, tokens, unresolved };
};

const esFormulaVaciaExplicita = (rawText = "", parsed = null) => {
  const raw = (rawText || "").toString().trim();
  if (!raw) return false;
  if (raw === "[]") return true;
  if (Array.isArray(parsed)) return parsed.length === 0;
  if (esFormulaV2(parsed)) {
    return !Array.isArray(parsed.tokens) || parsed.tokens.length === 0;
  }
  return false;
};

const normalizarFormulaOperacion = ({
  formulaJsonRaw,
  formulaTermsRaw,
  context = {},
} = {}) => {
  const formulaRawText =
    formulaJsonRaw == null ? "" : String(formulaJsonRaw).trim();
  let parsed = parseJsonSeguro(formulaJsonRaw);
  let tokens = [];
  let unresolved = 0;

  if (esFormulaV2(parsed)) {
    (parsed.tokens || []).forEach((token) => {
      const normalized = normalizarTokenV2(token, context);
      if (!normalized?.token) return;
      tokens.push(normalized.token);
      if (normalized.unresolved) unresolved += 1;
    });
  } else if (Array.isArray(parsed) && esListaTerminosLegacy(parsed)) {
    const converted = convertirTerminosLegacyATokensV2(parsed, context);
    tokens = converted.tokens;
    unresolved += converted.unresolved;
  } else if (esListaTerminosLegacy(formulaTermsRaw)) {
    const converted = convertirTerminosLegacyATokensV2(formulaTermsRaw, context);
    tokens = converted.tokens;
    unresolved += converted.unresolved;
  } else if (!parsed && formulaRawText) {
    const parsedText = parsearFormulaTextoATokensV2(formulaRawText, context);
    if (parsedText.valid && parsedText.tokens.length) {
      tokens = parsedText.tokens;
      unresolved += parsedText.unresolved;
    }
  }

  if (!tokens.length && formulaRawText && !esFormulaVaciaExplicita(formulaRawText, parsed)) {
    return {
      formulaObj: null,
      formula_json: formulaRawText,
      formula_terms: [],
      tokens: [],
      unresolved: 0,
      hasManualFormula: false,
      passthrough: true,
    };
  }

  const formulaObj = {
    version: FORMULA_V2_VERSION,
    tokens,
  };
  const formula_json = JSON.stringify(formulaObj);
  const formula_terms = convertirTokensV2ATerminosLegacy(tokens);
  const hasManualFormula = tokens.some(
    (t) => t?.kind === FORMULA_KIND_REF || t?.kind === FORMULA_KIND_CONST,
  );

  return {
    formulaObj,
    formula_json,
    formula_terms,
    tokens,
    unresolved,
    hasManualFormula,
  };
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
      valor_plantilla,
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
      const valorPlantilla = Number(cuenta.valor_plantilla);
      return {
        ...cuenta,
        valor_plantilla: Number.isFinite(valorPlantilla) ? valorPlantilla : 0,
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

  const contextoFormula = crearContextoFormula({
    cuentas,
    operaciones: (operaciones || []).map((row) => ({
      OperacionId: row.OperacionId || row.clase || row.operacion_etiqueta,
      Clase: row.operacion_etiqueta || row.OperacionId || row.clase,
      operacion_etiqueta: row.operacion_etiqueta,
      operacion_label: row.operacion_label,
    })),
  });

  const normalizarFormulaRaw = (raw) =>
    raw == null ? "" : raw.toString().trim();

  const parsearFormulaOperacion = (opRow = {}) => {
    const operacionId =
      opRow.OperacionId || opRow.clase || opRow.operacion_etiqueta || "operacion";
    try {
      const normalized = normalizarFormulaOperacion({
        formulaJsonRaw: opRow.formula_json,
        formulaTermsRaw: opRow.formula_terms,
        context: contextoFormula,
      });
      return {
        formulaRaw: normalized.formula_json || "",
        formulaTerms: normalized.formula_terms || [],
        formulaTokens: normalized.tokens || [],
        hasManualFormula: Boolean(normalized.hasManualFormula),
        unresolvedRefs: Number(normalized.unresolved) || 0,
        passthrough: Boolean(normalized.passthrough),
      };
    } catch (err) {
      console.warn(`Error parsing formula_json for ${operacionId}:`, err);
      return {
        formulaRaw: normalizarFormulaRaw(opRow.formula_json),
        formulaTerms: [],
        formulaTokens: [],
        hasManualFormula: false,
        unresolvedRefs: 0,
        passthrough: true,
      };
    }
  };
  const obtenerOperacionKey = (op = {}) => {
    const id = LIMPIAR_CLAVE(op.OperacionId || op.Clase || op.clase || "");
    if (id) return `ID:${NORMALIZAR_CLAVE(id)}`;
    const etiqueta = LIMPIAR_CLAVE(
      op.operacion_etiqueta || op.operacion_label || ""
    );
    if (etiqueta) return `ETQ:${NORMALIZAR_CLAVE(etiqueta)}`;
    return "";
  };

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

  // Compatibilidad: cuando coexisten filas legacy (sin orden_presentacion) y
  // filas actuales para la misma operación, mantener solo las actuales.
  const keysConOrdenPersistido = new Set();
  operaciones.forEach((op) => {
    const key = obtenerOperacionKey(op);
    if (!key) return;
    const ordenPresentacion = normalizarOrden(op.orden_presentacion);
    if (Number.isFinite(ordenPresentacion)) {
      keysConOrdenPersistido.add(key);
    }
  });

  operaciones.forEach((op, idx) => {
    const keyNormalizada = obtenerOperacionKey(op);
    const ordenPresentacion = normalizarOrden(op.orden_presentacion);
    if (
      keyNormalizada &&
      keysConOrdenPersistido.has(keyNormalizada) &&
      !Number.isFinite(ordenPresentacion)
    ) {
      return;
    }

    const ordenBase = Number.isFinite(ordenPresentacion)
      ? ordenPresentacion
      : Number.isFinite(Number(op.orden))
      ? Math.floor(Number(op.orden) / 100)
      : idx;
    const operacionId = op.OperacionId || op.Clase || op.clase;
    const operacionEtiqueta =
      op.operacion_etiqueta || op.Clase || operacionId || "Operacion";
    const mapKey = keyNormalizada || operacionId || operacionEtiqueta;

    const parsedFormula = parsearFormulaOperacion(op);
    const formulaTerms = parsedFormula.formulaTerms;
    const signos = {};
    formulaTerms.forEach((term, termIdx) => {
      const key = `seccion_${termIdx + 1}`;
      signos[key] = term.operator === "-" ? -1 : 1;
    });

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
        formula_json: parsedFormula.formulaRaw || undefined,
        formula_v2:
          parsedFormula.formulaTokens && parsedFormula.formulaTokens.length
            ? {
                version: FORMULA_V2_VERSION,
                tokens: parsedFormula.formulaTokens,
              }
            : undefined,
        orden: ordenBase,
        orden_presentacion:
          ordenPresentacion === undefined ? ordenBase : ordenPresentacion,
        visible: normalizarVisible(op.visible),
        __hasManualFormula: parsedFormula.hasManualFormula,
        __hasExplicitOrder: Number.isFinite(ordenPresentacion),
      };
    } else if (
      Number.isFinite(ordenBase) &&
      (operacionesMap[mapKey].orden == null ||
        ordenBase < operacionesMap[mapKey].orden)
    ) {
      operacionesMap[mapKey].orden = ordenBase;
    }

    if (
      Number.isFinite(ordenPresentacion) &&
      !operacionesMap[mapKey].__hasExplicitOrder
    ) {
      operacionesMap[mapKey].orden_presentacion = ordenPresentacion;
      operacionesMap[mapKey].orden = ordenBase;
      if (operacionId) {
        operacionesMap[mapKey].OperacionId = operacionId;
      }
      operacionesMap[mapKey].Clase = operacionEtiqueta;
      if (op.SECCION) {
        operacionesMap[mapKey].SECCION = op.SECCION;
      }
      operacionesMap[mapKey].__hasExplicitOrder = true;
    } else if (!operacionesMap[mapKey].SECCION && op.SECCION) {
      operacionesMap[mapKey].SECCION = op.SECCION;
    }

    const tipoRaw = (op.operacion_tipo || "").toString().trim();
    const tipo =
      tipoRaw === "parent_section"
        ? "parentSection"
        : tipoRaw === "parent_subsection"
        ? "parentSubsection"
        : tipoRaw;
    if (tipo && !tiposOperacionIgnorados.has(tipo)) {
      operacionesMap[mapKey][tipo] = op.operacion_label;
      operacionesMap[mapKey].signos[tipo] = op.signo ?? 1;
    }

    const currentFormulaRaw = normalizarFormulaRaw(
      operacionesMap[mapKey].formula_json
    );
    const incomingFormulaRaw = parsedFormula.formulaRaw;
    const incomingHasManualFormula = parsedFormula.hasManualFormula;
    const currentHasManualFormula = Boolean(operacionesMap[mapKey].__hasManualFormula);
    if (
      incomingHasManualFormula &&
      (!currentHasManualFormula ||
        formulaTerms.length >=
          (Array.isArray(operacionesMap[mapKey].formula_terms)
            ? operacionesMap[mapKey].formula_terms.length
            : 0))
    ) {
      operacionesMap[mapKey].formula_terms = formulaTerms;
      operacionesMap[mapKey].formula_json = incomingFormulaRaw;
      operacionesMap[mapKey].formula_v2 =
        parsedFormula.formulaTokens && parsedFormula.formulaTokens.length
          ? {
              version: FORMULA_V2_VERSION,
              tokens: parsedFormula.formulaTokens,
            }
          : undefined;
      operacionesMap[mapKey].__hasManualFormula = true;
      formulaTerms.forEach((term, termIdx) => {
        const key = `seccion_${termIdx + 1}`;
        operacionesMap[mapKey].signos[key] = term.operator === "-" ? -1 : 1;
      });
    } else if (
      incomingFormulaRaw &&
      incomingFormulaRaw !== "[]" &&
      (!currentFormulaRaw || currentFormulaRaw === "[]")
    ) {
      // Ejemplo: operación de columnas sin fórmula de términos.
      operacionesMap[mapKey].formula_json = incomingFormulaRaw;
    }

    if (operacionesMap[mapKey].orden_presentacion === undefined) {
      operacionesMap[mapKey].orden_presentacion =
        ordenPresentacion === undefined ? ordenBase : ordenPresentacion;
    }
    if (operacionesMap[mapKey].visible === undefined) {
      operacionesMap[mapKey].visible = normalizarVisible(op.visible);
    }
  });

  const operacionesOrdenadas = Object.values(operacionesMap)
    .map((op) => {
      const { __hasManualFormula, __hasExplicitOrder, ...clean } = op;
      return clean;
    })
    .sort(
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
 * Obtener metadatos de secciones/subsecciones (layout_secciones) para un módulo/año/capítulo.
 * Útil para reproducir el orden manual de headers en reportes (RESUMEN/SUMMARY) y para
 * renderizar secciones vacías en el Gestor.
 */
const obtenerSeccionesLayout = ({
  empresaId = "EMPRESA01",
  modulo,
  anio,
  capitulo,
} = {}) => {
  const anioNumero = Number(anio);
  const empresaCanonica = resolverEmpresaLayoutSource(empresaId);

  if (AUTO_LAYOUT_CLONE) {
    asegurarLayoutAnio({ empresaId: empresaCanonica, modulo, anio: anioNumero });
  }

  const empresaConsulta = resolverEmpresaConsulta({
    empresaId: empresaCanonica,
    modulo,
    anio: anioNumero,
  });

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

  const secciones = db
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
    `,
    )
    .all(empresaConsulta, modulo, anioNumero, capituloConsulta);

  return {
    empresaId: empresaConsulta,
    modulo,
    anio: anioNumero,
    capitulo: capituloCanonico,
    secciones: Array.isArray(secciones) ? secciones : [],
  };
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
      valor_plantilla, orden, orden_presentacion, visible, actualizado_en
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
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
      const valorPlantillaRaw =
        cuenta.valor_plantilla ?? cuenta.valorPlantilla ?? cuenta.valor;
      const valorPlantilla = Number(valorPlantillaRaw);
      const valorPlantillaFinal = Number.isFinite(valorPlantilla)
        ? valorPlantilla
        : 0;
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
        valorPlantillaFinal,
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
  const contextoFormula = crearContextoFormula({
    cuentas: [],
    operaciones: Array.isArray(operaciones) ? operaciones : [],
  });
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
        "sum-row-sumavarios2",
        "sum-row-sumavarios-consolidado",
        "sum-row-operativo",
        "sum-row-operativo-consolidado",
        "parentSection",
        "parentSubsection",
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
        // Metadatos de UI/placement: se persisten parentSection/parentSubsection
        // para resolver secciones homónimas en distintos principales.
        "parent_section",
        "parent_subsection",
        "parentSeccion",
        "parentSubseccion",
        "parentSección",
        "parentSubsección",
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
        .filter((key) => !tiposOperacionBase.includes(key))
        // Campos legacy de fórmula (seccion_1/operacion_1, etc.) NO deben persistirse como "operacion_tipo".
        // La fuente de verdad es `formula_json`.
        .filter((key) => !/^(seccion|operacion)_\d+$/i.test(key));
      const tiposOperacion = [...tiposOperacionBase, ...tiposOperacionExtra];
      const formulaNormalizada = normalizarFormulaOperacion({
        formulaJsonRaw: op.formula_json,
        formulaTermsRaw: op.formula_terms,
        context: contextoFormula,
      });
      const formulaJson = formulaNormalizada.formula_json || null;
      if (!formulaNormalizada.passthrough) {
        op.formula_json = formulaJson;
        op.formula_terms = formulaNormalizada.formula_terms || [];
      }

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
            op.OperacionId || op.operacion_id || op.clase || op.Clase || op.id;
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
          op.OperacionId || op.operacion_id || op.clase || op.Clase || op.id;
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
      seccion_principal, seccion_secundaria, operacion_factor, valor_plantilla, orden, orden_presentacion, visible
    )
    SELECT 
      empresa_id, modulo, ?, cuenta, nombre, capitulo,
      seccion_principal, seccion_secundaria, operacion_factor, valor_plantilla, orden, orden_presentacion, visible
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
        operacion_factor = ?, valor_plantilla = ?, orden = ?, orden_presentacion = ?
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
  const valorPlantillaRaw =
    datos.valor_plantilla ?? datos.valorPlantilla ?? datos.valor;
  const valorPlantilla = Number(valorPlantillaRaw);
  const valorPlantillaFinal = Number.isFinite(valorPlantilla)
    ? valorPlantilla
    : 0;
  const ordenRaw = datos.orden_presentacion ?? datos.orden;
  const ordenFinal = Number.isFinite(Number(ordenRaw)) ? Number(ordenRaw) : 1;

  const result = update.run(
    datos.cuenta || cuentaOriginal,
    datos.nombre,
    datos.seccion_principal,
    datos.seccion_secundaria || "",
    operacionFactorFinal,
    valorPlantillaFinal,
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
  const formulaNormalizada = normalizarFormulaOperacion({
    formulaJsonRaw: datos.formula_json,
    formulaTermsRaw: datos.formula_terms,
    context: crearContextoFormula({
      cuentas: [],
      operaciones: [datos],
    }),
  });
  const formulaJson = formulaNormalizada.formula_json || null;
  const operacionId =
    datos.OperacionId ||
    datos.operacion_id ||
    datos.clase ||
    claseOriginal ||
    datos.id;
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

      const oldSectionRef = construirRefIdSeccion(nombreOriginalClean);
      const newSectionRef = construirRefIdSeccion(nuevoNombreClean);
      const oldSectionPrefix = `SUB::${NORMALIZAR_ID_SEGMENTO(nombreOriginalClean)}::`;
      const newSectionPrefix = `SUB::${NORMALIZAR_ID_SEGMENTO(nuevoNombreClean)}::`;
      const oldSubSuffix = `::${NORMALIZAR_ID_SEGMENTO(nombreOriginalClean)}`;
      const newSubSuffix = `::${NORMALIZAR_ID_SEGMENTO(nuevoNombreClean)}`;

      ops.forEach((row) => {
        const raw = (row?.formula_json || "").toString().trim();
        if (!raw) return;
        const parsed = parseJsonSeguro(raw);
        if (!parsed) return;

        let changed = false;
        let newJson = raw;

        if (esFormulaV2(parsed)) {
          const updatedTokens = (parsed.tokens || []).map((token) => {
            if (!token || typeof token !== "object") return token;
            if ((token.kind || "").toString().toLowerCase() !== FORMULA_KIND_REF)
              return token;

            const refType = (token.refType || "").toString().toLowerCase();
            const labelKey = NORMALIZAR_CLAVE(token.label || "");
            let refId = (token.refId || "").toString().trim();
            let label = token.label;
            let tokenChanged = false;

            if (tipo === "principal") {
              if (refType === "section") {
                if (
                  refId === oldSectionRef ||
                  labelKey === NORMALIZAR_CLAVE(nombreOriginalClean)
                ) {
                  refId = newSectionRef;
                  if (labelKey === NORMALIZAR_CLAVE(nombreOriginalClean)) {
                    label = nuevoNombreClean;
                  }
                  tokenChanged = true;
                }
              } else if (refType === "subsection" && refId.startsWith(oldSectionPrefix)) {
                refId = `${newSectionPrefix}${refId.slice(oldSectionPrefix.length)}`;
                tokenChanged = true;
              }
            } else if (refType === "subsection") {
              if (refId.endsWith(oldSubSuffix)) {
                refId = `${refId.slice(0, -oldSubSuffix.length)}${newSubSuffix}`;
                tokenChanged = true;
              }
              if (labelKey === NORMALIZAR_CLAVE(nombreOriginalClean)) {
                label = nuevoNombreClean;
                tokenChanged = true;
              }
            }

            if (!tokenChanged) return token;
            changed = true;
            return {
              ...token,
              refId,
              label,
            };
          });

          if (changed) {
            newJson = JSON.stringify({
              version: FORMULA_V2_VERSION,
              tokens: updatedTokens,
            });
          }
        } else if (Array.isArray(parsed) && parsed.length) {
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
          if (changed) {
            newJson = JSON.stringify(updated);
          }
        }

        if (!changed) return;
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
        valor_plantilla,
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
      valor_plantilla:
        row.valor_plantilla == null || row.valor_plantilla === ""
          ? 0
          : Number(row.valor_plantilla),
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
        seccion_principal, seccion_secundaria, operacion_factor, valor_plantilla,
        orden, orden_presentacion, visible, actualizado_en
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
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
        row.valor_plantilla == null || row.valor_plantilla === ""
          ? 0
          : Number(row.valor_plantilla),
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
  obtenerSeccionesLayout,
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
