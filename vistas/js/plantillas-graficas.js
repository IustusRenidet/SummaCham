(() => {
  const form = document.getElementById("plantillasGraficasForm");
  if (!form) {
    // No mostrar error ya que el formulario puede no existir en otras paginas
    return;
  }

  const fieldset = document.getElementById("plantillasGraficasFieldset");
  const statusEl = document.getElementById("plantillasGraficasStatus");
  const warningEl = document.getElementById("plantillasGraficasWarning");
  const saveBtn = document.getElementById("plantillasGraficasSave");
  const resetBtn = document.getElementById("plantillasGraficasReset");
  const legendShowToggle = document.getElementById("plantillasLegendShowToggle");
  const legendPositionSelect = document.getElementById(
    "plantillasLegendPosition"
  );
  const chartTypeSelect = document.getElementById("plantillasChartType");
  const chartStackedToggle = document.getElementById("plantillasChartStacked");
  const customList = document.getElementById("plantillasGraficasCustomList");
  const customTemplate = document.getElementById(
    "plantillasGraficasCustomTemplate"
  );
  const customAddBtn = document.getElementById("plantillasGraficasAddCustom");
  const moduloSelect = document.getElementById("moduloSelect");
  const galleryEl = document.getElementById("plantillasGraficasGallery");
  const galleryCardTemplate = document.getElementById(
    "plantillasGraficasCardTemplate"
  );
  const galleryAddTemplate = document.getElementById(
    "plantillasGraficasAddTemplate"
  );
  const detailCard = document.getElementById("plantillasGraficasDetailCard");
  const detailHint = document.getElementById("plantillasGraficasDetailHint");
  const detailMeta = document.getElementById("plantillasGraficasDetailMeta");
  const detailEditBtn = document.getElementById("plantillasGraficasDetailEdit");
  const detailDeleteBtn = document.getElementById("plantillasGraficasDetailDelete");
  const detailAddBtn = document.getElementById("plantillasGraficasDetailAdd");
  const contextModuloEl = document.getElementById(
    "plantillasGraficasContextModulo"
  );
  const contextAnioEl = document.getElementById("plantillasGraficasContextAnio");
  const contextCapituloEl = document.getElementById(
    "plantillasGraficasContextCapitulo"
  );
  const summarySourceSelect = document.getElementById(
    "plantillasSummarySourceSelect"
  );
  const summarySourceTarget = document.getElementById(
    "plantillasSummarySourceTarget"
  );
  const summarySourceType = document.getElementById("plantillasSummarySourceType");
  const summarySourcePicker = document.getElementById(
    "plantillasSummarySourcePicker"
  );
  const summarySourceAdd = document.getElementById("plantillasSummarySourceAdd");
  const ingresoSourceSeries = document.getElementById(
    "plantillasIngresoSourceSeries"
  );
  const ingresoSourcePicker = document.getElementById(
    "plantillasIngresoSourcePicker"
  );
  const ingresoSourceAdd = document.getElementById("plantillasIngresoSourceAdd");
  const ingresoNacionalSourceSeries = document.getElementById(
    "plantillasIngresoNacionalSourceSeries"
  );
  const ingresoNacionalSourcePicker = document.getElementById(
    "plantillasIngresoNacionalSourcePicker"
  );
  const ingresoNacionalSourceAdd = document.getElementById(
    "plantillasIngresoNacionalSourceAdd"
  );
  const summarySourcesGrid = document.getElementById(
    "plantillasSummarySourcesGrid"
  );

  const setStatus = (message, tone = "muted") => {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.setAttribute("data-tone", tone);
  };

  const isAdmin = () => {
    if (!window.Sesion || typeof window.Sesion.puedeAdministrarUsuarios !== "function") {
      return false;
    }
    return window.Sesion.puedeAdministrarUsuarios();
  };

  const clone = (value) => JSON.parse(JSON.stringify(value || {}));
  const escapeAttr = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const getModuloOptions = () => {
    if (moduloSelect?.options?.length) {
      const visibleOptions = Array.from(moduloSelect.options)
        .filter((option) => {
          if (!option) return false;
          if (option.disabled) return false;
          if (option.hidden) return false;
          if (
            option.style?.display &&
            option.style.display.toLowerCase() === "none"
          ) {
            return false;
          }
          const value = (option.value || "").toString().trim();
          return Boolean(value);
        })
        .map(
          (option) =>
            `<option value="${escapeAttr(option.value)}">${escapeAttr(
              option.textContent || option.value || ""
            ).trim()}</option>`
        );
      if (visibleOptions.length) {
        return visibleOptions.join("");
      }
    }
    return [
      '<option value="RESUMEN">RESUMEN</option>',
      '<option value="Finanzas">Finanzas</option>',
      '<option value="Gastos Generales">Gastos Generales</option>',
      '<option value="Nomina">Nomina</option>',
      '<option value="Membresia">Membresia</option>',
      '<option value="Serv Membresia">Serv Membresia</option>',
      '<option value="RH">RH</option>',
      '<option value="Eventos">Eventos</option>',
      '<option value="Comites">Comites</option>',
      '<option value="Comunicacion">Comunicacion</option>',
      '<option value="Direccion">Direccion</option>',
      '<option value="Gtos Corporativos">Gtos Corporativos</option>',
      '<option value="T&IC">T&IC</option>',
      '<option value="VPE">VPE</option>',
      '<option value="Presupuestos">Presupuestos</option>',
    ].join("");
  };

  const applyModuloOptions = (select, value) => {
    if (!select) return;
    select.innerHTML = getModuloOptions();
    const normalizedValue = normalizeModuleValue(value, "RESUMEN");
    const hasValue = Array.from(select.options).some(
      (option) => option.value === normalizedValue
    );
    if (normalizedValue && !hasValue) {
      const opt = document.createElement("option");
      opt.value = normalizedValue;
      opt.textContent = normalizedValue;
      select.appendChild(opt);
    }
    select.value = normalizedValue;
  };

  const buildCustomChartId = () =>
    `custom-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;

  const parseCustomRows = (text) => {
    if (!text) return [];
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        let alias = "";
        let raw = line;
        if (line.includes("=")) {
          const parts = line.split(/=(.+)/);
          alias = (parts[0] || "").trim();
          raw = (parts[1] || "").trim();
        }
        const variants = raw
          .split("|")
          .map((item) => item.trim())
          .filter(Boolean);
        if (!variants.length) return null;
        return {
          alias: alias || variants[0],
          variants,
        };
      })
      .filter(Boolean);
  };

  const formatCustomRows = (rows) => {
    if (!Array.isArray(rows)) return "";
    return rows
      .map((row) => {
        const variants = Array.isArray(row?.variants) ? row.variants : [];
        const cleaned = variants.map((v) => (v || "").trim()).filter(Boolean);
        if (!cleaned.length) return "";
        const alias = (row?.alias || "").trim();
        const raw = cleaned.join("|");
        if (alias && alias !== cleaned[0]) {
          return `${alias}=${raw}`;
        }
        return raw;
      })
      .filter(Boolean)
      .join("\n");
  };

  const SUMMARY_TABLE_SERIES = [
    { key: "actual", label: "Real", color: "#1d4ed8", enabled: true },
    { key: "plan", label: "Ppto.", color: "#60a5fa", enabled: true },
    { key: "prev", label: "Real comparativo", color: "#94a3b8", enabled: true },
    {
      key: "varMonthPlan",
      label: "B/(W)% vs. ppto.",
      color: "#f59e0b",
      enabled: true,
    },
    {
      key: "varMonthPrev",
      label: "B/(W)% vs. real comparativo",
      color: "#f97316",
      enabled: true,
    },
    { key: "actualYTD", label: "Real acumulado", color: "#0d47a1", enabled: true },
    {
      key: "planYTD",
      label: "Ppto. acumulado",
      color: "#60a5fa",
      enabled: true,
    },
    {
      key: "prevYTD",
      label: "Real acumulado AA",
      color: "#94a3b8",
      enabled: true,
    },
    {
      key: "varYTDPlan",
      label: "B/(W)% vs. ppto. acumulado",
      color: "#eab308",
      enabled: true,
    },
    {
      key: "varYTDPrev",
      label: "B/(W)% vs. real acumulado AA",
      color: "#fb923c",
      enabled: true,
    },
  ];

  const parseVariantsList = (text) => {
    if (!text) return [];
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .flatMap((line) => {
        let raw = line;
        if (line.includes("=")) {
          const parts = line.split(/=(.+)/);
          raw = (parts[1] || "").trim();
        }
        return raw.split("|");
      })
      .map((item) => item.trim())
      .filter(Boolean);
  };

  const formatVariantsList = (variants) => {
    if (!Array.isArray(variants)) return "";
    return variants
      .map((item) => (item || "").trim())
      .filter(Boolean)
      .join(" | ");
  };

  const parseSummaryRows = (text) =>
    parseCustomRows(text).map((row) => ({
      label: row.alias,
      variants: row.variants,
    }));

  const formatSummaryRows = (rows) => {
    if (!Array.isArray(rows)) return "";
    return formatCustomRows(
      rows.map((row) => ({
        alias: row.label || row.alias || "",
        variants: Array.isArray(row.variants) ? row.variants : [],
      }))
    );
  };

  const SNAPSHOT_PREFIX = "resumen_tabla_snapshot";

  const getSelectedCapitulo = () => {
    const select = document.getElementById("capituloSelect");
    const value =
      select?.value ||
      document.getElementById("capituloLabel")?.textContent ||
      "";
    return value.toString().trim();
  };

  const getSelectedAnio = () => {
    const select = document.getElementById("anioSelect");
    const value =
      select?.value || document.getElementById("anioLabel")?.textContent || "";
    return value.toString().trim();
  };

  const updateContextChips = () => {
    if (contextModuloEl) {
      contextModuloEl.textContent = getCurrentModuleValue() || "-";
    }
    if (contextAnioEl) {
      contextAnioEl.textContent = getSelectedAnio() || "-";
    }
    if (contextCapituloEl) {
      contextCapituloEl.textContent = getSelectedCapitulo() || "Sin capitulo";
    }
  };

  const readLatestSnapshot = (capitulo = "") => {
    if (typeof localStorage === "undefined") return null;
    let latest = null;
    let latestMatch = null;
    const target = normalizeLabel(capitulo || "");
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(SNAPSHOT_PREFIX)) continue;
      try {
        const snapshot = JSON.parse(localStorage.getItem(key) || "null");
        if (!snapshot || !Array.isArray(snapshot.filas)) continue;
        if (!latest || (snapshot.createdAt || 0) > (latest.createdAt || 0)) {
          latest = snapshot;
        }
        if (target) {
          const snapCap = normalizeLabel(snapshot.capitulo || "");
          if (snapCap && snapCap === target) {
            if (
              !latestMatch ||
              (snapshot.createdAt || 0) > (latestMatch.createdAt || 0)
            ) {
              latestMatch = snapshot;
            }
          }
        }
      } catch (err) {
        continue;
      }
    }
    return latestMatch || latest;
  };

  const getSnapshotLabels = () => {
    const snapshot = readLatestSnapshot(getSelectedCapitulo());
    if (!snapshot || !Array.isArray(snapshot.filas)) return [];
    const labels = snapshot.filas
      .map((row) => (row?.label || "").toString().trim())
      .filter(Boolean);
    return Array.from(new Set(labels)).sort((a, b) => a.localeCompare(b));
  };

  const EMPTY_TOTALS = {
    actual: 0,
    plan: 0,
    prev: 0,
    actualYTD: 0,
    planYTD: 0,
    prevYTD: 0,
  };

  const normalizeLabel = (texto = "") =>
    texto
      .toString()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/\s+/g, " ");

  const MODULE_VALUE_BY_KEY = new Map([
    ["RESUMEN", "RESUMEN"],
    ["SUMMARY", "RESUMEN"],
    ["FINANZAS", "Finanzas"],
    ["GASTOSGENERALES", "Gastos Generales"],
    ["NOMINA", "Nomina"],
    ["MEMBRESIA", "Membresia"],
    ["SERVMEMBRESIA", "Serv Membresia"],
    ["SERVICIOSALAMEMBRESIA", "Serv Membresia"],
    ["RH", "RH"],
    ["EVENTOS", "Eventos"],
    ["COMITES", "Comites"],
    ["COMITESINCOME", "Comites"],
    ["COMUNICACION", "Comunicacion"],
    ["DIRECCION", "Direccion"],
    ["GTOSCORPORATIVOS", "Gtos Corporativos"],
    ["TIC", "T&IC"],
    ["TANDIC", "T&IC"],
    ["VPE", "VPE"],
    ["PRESUPUESTOS", "Presupuestos"],
  ]);

  const normalizeModuleRawKey = (value = "") => {
    const clean = value
      .toString()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();
    if (!clean) return "";
    const withoutPath = clean.split(/[\\/]/).pop() || clean;
    const withoutQuery = withoutPath.split("?")[0].split("#")[0];
    const withoutExt = withoutQuery.replace(/\.[A-Z0-9]+$/, "");
    return withoutExt.replace(/[^A-Z0-9]/g, "");
  };

  const normalizeModuleKey = (value = "", fallback = "RESUMEN") => {
    const resolve = (raw) => {
      if (!raw) return "";
      if (MODULE_VALUE_BY_KEY.has(raw)) return raw;
      if (raw.endsWith("HTML")) {
        const withoutHtml = raw.slice(0, -4);
        if (MODULE_VALUE_BY_KEY.has(withoutHtml)) return withoutHtml;
      }
      return "";
    };
    const direct = resolve(normalizeModuleRawKey(value));
    if (direct) return direct;
    const fallbackKey = resolve(normalizeModuleRawKey(fallback));
    if (fallbackKey) return fallbackKey;
    return "RESUMEN";
  };

  const normalizeModuleValue = (value = "", fallback = "RESUMEN") =>
    MODULE_VALUE_BY_KEY.get(normalizeModuleKey(value, fallback)) ||
    MODULE_VALUE_BY_KEY.get(normalizeModuleKey(fallback, "RESUMEN")) ||
    "RESUMEN";

  const isSummaryModuleKey = (moduleKey = "") => moduleKey === "RESUMEN";

  const getCurrentModuleValue = () =>
    normalizeModuleValue(
      moduloSelect?.value || document.body?.dataset?.modulo || "RESUMEN",
      "RESUMEN"
    );

  const getCurrentModuleKey = () =>
    normalizeModuleKey(getCurrentModuleValue());

  const isCdmxCapitulo = (capitulo = "") => {
    const normalized = normalizeLabel(capitulo || "");
    if (!normalized) return false;
    return (
      normalized.includes("CIUDAD DE MEXICO") ||
      normalized.includes("CDMX") ||
      normalized.includes("MEXICO")
    );
  };

  const buildSnapshotMap = (snapshot) => {
    if (!snapshot || !Array.isArray(snapshot.filas)) return null;
    const map = new Map();
    snapshot.filas.forEach((row) => {
      const label = normalizeLabel(row?.label || "");
      if (!label) return;
      map.set(label, row?.totals || EMPTY_TOTALS);
    });
    return map;
  };

  const buildSnapshotMapFromLayout = (layout) => {
    if (!Array.isArray(layout) || !layout.length) return null;
    const map = new Map();
    layout.forEach((row) => {
      const label = normalizeLabel(row?.label || "");
      if (!label) return;
      map.set(label, row?.totals || EMPTY_TOTALS);
    });
    return map;
  };

  const getRowTotals = (snapshotMap, labels) => {
    if (!snapshotMap) return EMPTY_TOTALS;
    const variants = Array.isArray(labels) ? labels : [labels];
    for (const raw of variants) {
      const key = normalizeLabel(raw);
      if (!key) continue;
      const hit = snapshotMap.get(key);
      if (hit) return hit;
    }
    return EMPTY_TOTALS;
  };

  const getRowTotalsLoose = (snapshotMap, labels) => {
    if (!snapshotMap) return EMPTY_TOTALS;
    const variants = Array.isArray(labels) ? labels : [labels];
    const normalized = variants.map(normalizeLabel).filter(Boolean);
    if (!normalized.length) return EMPTY_TOTALS;
    for (const key of normalized) {
      const exact = snapshotMap.get(key);
      if (exact) return exact;
    }
    for (const [key, value] of snapshotMap.entries()) {
      if (normalized.some((variant) => key.includes(variant))) {
        return value;
      }
    }
    return EMPTY_TOTALS;
  };

  const API_BASE = (() => {
    if (window.location.protocol === "file:") {
      return "http://localhost:3005";
    }
    return window.location.origin;
  })();
  const API_RESUMEN = `${API_BASE.replace(/\/$/, "")}/api/reportes/resumen`;

  const MONTH_LABELS = [
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
  ];

  const readPlaneacionContext = () => {
    try {
      return JSON.parse(localStorage.getItem("planeacion_contexto") || "{}");
    } catch {
      return {};
    }
  };

  const resolvePreviewMonthIndex = () => {
    const ctx = readPlaneacionContext();
    const mes = Number(ctx?.mes);
    if (Number.isFinite(mes) && mes >= 1 && mes <= 12) {
      return mes - 1;
    }
    return null;
  };

  const readUrlSearchParams = () => {
    try {
      return new URLSearchParams(window.location.search || "");
    } catch {
      return new URLSearchParams();
    }
  };

  const getPreviewYear = (snapshot) => {
    const anioSelect = document.getElementById("anioSelect");
    const selected = Number(anioSelect?.value);
    if (Number.isInteger(selected)) return selected;
    const firstOption = Number(anioSelect?.options?.[0]?.value);
    if (Number.isInteger(firstOption)) return firstOption;
    const yearFromUrl = Number(readUrlSearchParams().get("year"));
    if (Number.isInteger(yearFromUrl)) return yearFromUrl;
    const snapYear = Number(snapshot?.anio);
    if (Number.isInteger(snapYear)) return snapYear;
    const ctxYear = Number(readPlaneacionContext()?.anio);
    if (Number.isInteger(ctxYear)) return ctxYear;
    return null;
  };

  const getPreviewEmpresaId = (snapshot) =>
    snapshot?.empresaId ||
    readUrlSearchParams().get("empresa") ||
    readPlaneacionContext()?.empresaId ||
    readPlaneacionContext()?.empresa ||
    window.Sesion?.obtenerEmpresaActiva?.()?.id ||
    null;

  const getPreviewContext = () => {
    const capituloSeleccionado = getSelectedCapitulo();
    const snapshot = readLatestSnapshot(capituloSeleccionado);
    return {
      snapshot,
      snapshotMap: buildSnapshotMap(snapshot),
      empresaId: getPreviewEmpresaId(snapshot),
      anio: getPreviewYear(snapshot),
      capitulo: snapshot?.capitulo || capituloSeleccionado || "",
    };
  };

  const resumenMensualCache = new Map();

  const fetchResumenMes = async (empresaId, anio, mes, capitulo) => {
    const params = new URLSearchParams({
      empresaId: empresaId || "",
      anio: String(anio || ""),
      mes: String(mes || ""),
    });
    if (capitulo) {
      params.set("capitulo", capitulo);
    }
    const headers =
      typeof window.Sesion?.headersAutenticacion === "function"
        ? window.Sesion.headersAutenticacion()
        : {};
    const res = await fetch(`${API_RESUMEN}?${params.toString()}`, { headers });
    if (!res.ok) {
      throw new Error(`No fue posible cargar resumen ${anio}-${mes}`);
    }
    return res.json();
  };

  const loadResumenMensual = async (empresaId, anio, capitulo) => {
    if (!empresaId || !anio) return [];
    const key = `${empresaId}:${anio}:${capitulo || ""}`;
    const cached = resumenMensualCache.get(key);
    if (cached?.data) return cached.data;
    if (cached?.promise) return cached.promise;
    const promise = Promise.all(
      MONTH_LABELS.map((_, idx) =>
        fetchResumenMes(empresaId, anio, idx + 1, capitulo).catch((error) => {
          console.warn("No fue posible cargar resumen mensual", error);
          return null;
        })
      )
    ).then((data) => {
      resumenMensualCache.set(key, { data, at: Date.now() });
      return data;
    });
    resumenMensualCache.set(key, { promise });
    return promise;
  };

  const fillSelectOptions = (select, options, placeholder) => {
    if (!select) return;
    select.innerHTML = "";
    if (!Array.isArray(options) || options.length === 0) {
      const empty = document.createElement("option");
      empty.value = "";
      empty.textContent = placeholder || "Sin datos disponibles";
      select.appendChild(empty);
      select.disabled = true;
      return;
    }
    const option = document.createElement("option");
    option.value = "";
    option.textContent = placeholder || "Selecciona una opcion";
    select.appendChild(option);
    options.forEach((value) => {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = value;
      select.appendChild(opt);
    });
    select.disabled = false;
  };

  const appendRowValue = (input, value) => {
    if (!input || !value) return;
    const current = input.value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (!current.includes(value)) {
      current.push(value);
    }
    input.value = current.join("\n");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const appendVariantValue = (input, value) => {
    if (!input || !value) return;
    const current = input.value
      .split("|")
      .map((item) => item.trim())
      .filter(Boolean);
    if (!current.includes(value)) {
      current.push(value);
    }
    input.value = current.join(" | ");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };

  let snapshotLabelOptions = getSnapshotLabels();

  const refreshSnapshotLabelOptions = () => {
    snapshotLabelOptions = getSnapshotLabels();
    return snapshotLabelOptions;
  };

  const setCustomSourceControlsState = (moduleValue, sourcePicker, addSourceBtn) => {
    const moduleKey = normalizeModuleKey(moduleValue || "RESUMEN");
    const useSnapshotPicker = isSummaryModuleKey(moduleKey);
    if (useSnapshotPicker) {
      if (sourcePicker) {
        fillSelectOptions(sourcePicker, snapshotLabelOptions, "Selecciona una fila");
      }
      if (addSourceBtn) {
        addSourceBtn.disabled = !snapshotLabelOptions.length;
      }
      return;
    }
    if (sourcePicker) {
      fillSelectOptions(
        sourcePicker,
        [],
        "Usa filas manuales del modulo seleccionado"
      );
    }
    if (addSourceBtn) {
      addSourceBtn.disabled = true;
    }
  };

  const renderCustomChartItem = (chart = {}) => {
    if (!customTemplate || !customList) return null;
    const node = customTemplate.content.firstElementChild.cloneNode(true);
    const id = chart.id || buildCustomChartId();
    node.dataset.customId = id;
    if (chart.sourceType) {
      node.dataset.customSourceType = chart.sourceType;
    }
    if (Array.isArray(chart.seriesKeys) && chart.seriesKeys.length) {
      node.dataset.customSeriesKeys = chart.seriesKeys.join("|");
    }
    const titleInput = node.querySelector("[data-custom-title]");
    const subtitleInput = node.querySelector("[data-custom-subtitle]");
    const moduleSelect = node.querySelector("[data-custom-module]");
    const typeSelect = node.querySelector("[data-custom-type]");
    const rowsInput = node.querySelector("[data-custom-rows]");
    const enabledInput = node.querySelector("[data-custom-enabled]");
    const removeBtn = node.querySelector("[data-custom-remove]");
    const moveUpBtn = node.querySelector("[data-custom-move-up]");
    const moveDownBtn = node.querySelector("[data-custom-move-down]");
    const sourcePicker = node.querySelector("[data-custom-source-picker]");
    const addSourceBtn = node.querySelector("[data-custom-add-source]");
    const moduleValue = normalizeModuleValue(chart.module || "RESUMEN", "RESUMEN");

    if (titleInput) titleInput.value = chart.title || "";
    if (subtitleInput) subtitleInput.value = chart.subtitle || "";
    if (moduleSelect) {
      applyModuloOptions(moduleSelect, moduleValue);
    }
    if (typeSelect) typeSelect.value = chart.chartType || "inherit";
    if (rowsInput) rowsInput.value = formatCustomRows(chart.rows);
    if (enabledInput) enabledInput.checked = chart.enabled !== false;
    setCustomSourceControlsState(moduleValue, sourcePicker, addSourceBtn);
    if (addSourceBtn) {
      addSourceBtn.addEventListener("click", () => {
        if (!sourcePicker || !rowsInput) return;
        const selected = sourcePicker.value;
        appendRowValue(rowsInput, selected);
        sourcePicker.value = "";
      });
    }
    moduleSelect?.addEventListener("change", () => {
      setCustomSourceControlsState(moduleSelect.value, sourcePicker, addSourceBtn);
    });

    if (removeBtn) {
      removeBtn.addEventListener("click", () => {
        node.remove();
        scheduleGalleryUpdate();
      });
    }

    if (moveUpBtn) {
      moveUpBtn.addEventListener("click", (event) => {
        event.preventDefault();
        const prev = node.previousElementSibling;
        if (!prev) return;
        customList.insertBefore(node, prev);
        scheduleGalleryUpdate();
      });
    }

    if (moveDownBtn) {
      moveDownBtn.addEventListener("click", (event) => {
        event.preventDefault();
        const next = node.nextElementSibling;
        if (!next) return;
        customList.insertBefore(next, node);
        scheduleGalleryUpdate();
      });
    }

    customList.appendChild(node);
    return node;
  };

  const getGraficasConfigApi = () => {
    if (!window.GraficasConfig || typeof window.GraficasConfig.load !== "function") {
      return null;
    }
    return window.GraficasConfig;
  };

  const applySummarySourceFilter = (value) => {
    if (!summarySourcesGrid) return;
    const groups = Array.from(
      summarySourcesGrid.querySelectorAll("[data-summary-source-group]")
    );
    const selected = value || "all";
    groups.forEach((group) => {
      const key = group.getAttribute("data-summary-source-group") || "";
      const visible = selected === "all" || selected === key;
      group.style.display = visible ? "" : "none";
    });
  };

  const findSummarySourceInput = (groupKey, typeKey) =>
    form.querySelector(
      `[data-summary-rows][data-summary-key="${groupKey}"][data-summary-type="${typeKey}"]`
    );

  let sourcePickersInitialized = false;

  const updateSourcePickerOptions = () => {
    const options = refreshSnapshotLabelOptions();
    if (summarySourcePicker) {
      fillSelectOptions(summarySourcePicker, options, "Selecciona una fila");
    }
    if (summarySourceAdd) {
      summarySourceAdd.disabled = !options.length;
    }

    const consolidatedPickers = form.querySelectorAll(
      "[data-consolidated-source-picker]"
    );
    consolidatedPickers.forEach((picker) => {
      fillSelectOptions(picker, options, "Selecciona una fila");
    });
    form.querySelectorAll("[data-consolidated-source-add]").forEach((btn) => {
      btn.disabled = !options.length;
    });

    form.querySelectorAll("[data-custom-chart]").forEach((card) => {
      const moduleValue =
        card.querySelector("[data-custom-module]")?.value || "RESUMEN";
      const picker = card.querySelector("[data-custom-source-picker]");
      const addBtn = card.querySelector("[data-custom-add-source]");
      setCustomSourceControlsState(moduleValue, picker, addBtn);
    });

    if (ingresoSourcePicker) {
      fillSelectOptions(ingresoSourcePicker, options, "Selecciona una fila");
    }
    if (ingresoSourceAdd) {
      ingresoSourceAdd.disabled = !options.length;
    }

    if (ingresoNacionalSourcePicker) {
      fillSelectOptions(
        ingresoNacionalSourcePicker,
        options,
        "Selecciona una fila"
      );
    }
    if (ingresoNacionalSourceAdd) {
      ingresoNacionalSourceAdd.disabled = !options.length;
    }
  };

  const initializeSourcePickers = () => {
    if (!sourcePickersInitialized) {
      sourcePickersInitialized = true;
      if (summarySourceAdd) {
        summarySourceAdd.addEventListener("click", () => {
          const groupKey =
            summarySourceTarget?.value ||
            summarySourceSelect?.value ||
            "cdmx";
          const typeKey = summarySourceType?.value || "operating";
          const target = findSummarySourceInput(groupKey, typeKey);
          appendRowValue(target, summarySourcePicker?.value);
          if (summarySourcePicker) summarySourcePicker.value = "";
        });
      }

      form.querySelectorAll("[data-consolidated-source-add]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const key =
            btn.getAttribute("data-consolidated-source-key") ||
            btn.dataset.consolidatedSourceKey ||
            "";
          if (!key) return;
          const target = form.querySelector(
            `[data-consolidated-source][data-consolidated-source-key="${key}"]`
          );
          const picker = form.querySelector(
            `[data-consolidated-source-picker][data-consolidated-source-key="${key}"]`
          );
          appendVariantValue(target, picker?.value);
          if (picker) picker.value = "";
        });
      });

      if (ingresoSourceAdd) {
        ingresoSourceAdd.addEventListener("click", () => {
          const serieKey = ingresoSourceSeries?.value || "";
          if (!serieKey) return;
          const target = form.querySelector(
            `[data-ingreso-series-row][data-ingreso-series-key="${serieKey}"] [data-ingreso-series-sources]`
          );
          appendVariantValue(target, ingresoSourcePicker?.value);
          if (ingresoSourcePicker) ingresoSourcePicker.value = "";
        });
      }

      if (ingresoNacionalSourceAdd) {
        ingresoNacionalSourceAdd.addEventListener("click", () => {
          const serieKey = ingresoNacionalSourceSeries?.value || "";
          if (!serieKey) return;
          const target = form.querySelector(
            `[data-ingreso-nacional-series-row][data-ingreso-nacional-series-key="${serieKey}"] [data-ingreso-nacional-series-sources]`
          );
          appendVariantValue(target, ingresoNacionalSourcePicker?.value);
          if (ingresoNacionalSourcePicker) ingresoNacionalSourcePicker.value = "";
        });
      }
    }

    updateSourcePickerOptions();
  };

  const applyConfigToForm = (config) => {
    if (!config) return;
    const defaults = clone(getGraficasConfigApi()?.defaults || {});
    const sources = config.sources || {};
    const defaultSources = defaults.sources || {};
    const summarySources = sources.summary || defaultSources.summary || {};
    const consolidatedSources =
      sources.consolidated || defaultSources.consolidated || {};
    const ingresoSources = sources.ingreso || defaultSources.ingreso || {};
    const ingresoNacionalSources =
      sources.ingresoNacional || defaultSources.ingresoNacional || {};

    const rows = Array.from(form.querySelectorAll("[data-series-row]"));
    rows.forEach((row) => {
      const key = row.getAttribute("data-series-key");
      const serie =
        (config.series || []).find((item) => item.key === key) ||
        (defaults.series || []).find((item) => item.key === key);
      if (!serie) return;
      const labelInput = row.querySelector("[data-series-label]");
      const colorInput = row.querySelector("[data-series-color]");
      const enabledInput = row.querySelector("[data-series-enabled]");
      if (labelInput) labelInput.value = serie.label || "";
      if (colorInput) colorInput.value = serie.color || "#0d47a1";
      if (enabledInput) enabledInput.checked = Boolean(serie.enabled);
    });

    const chartRows = Array.from(form.querySelectorAll("[data-chart-key]"));
    chartRows.forEach((row) => {
      const key = row.getAttribute("data-chart-key");
      const chartCfg = (config.charts || {})[key] || (defaults.charts || {})[key];
      if (!chartCfg) return;
      const titleInput = row.querySelector("[data-chart-title]");
      const subtitleInput = row.querySelector("[data-chart-subtitle]");
      const enabledInput = row.querySelector("[data-chart-enabled]");
      const typeSelect = row.querySelector("[data-chart-type]");
      if (titleInput) titleInput.value = chartCfg.title || "";
      if (subtitleInput) subtitleInput.value = chartCfg.subtitle || "";
      if (enabledInput) enabledInput.checked = Boolean(chartCfg.enabled);
      if (typeSelect) {
        const fallbackType = defaults.charts?.[key]?.chartType || "inherit";
        typeSelect.value = normalizeChartType(chartCfg.chartType, fallbackType);
      }
    });

    const consolidatedRows = Array.from(
      form.querySelectorAll("[data-consolidated-key]")
    );
    consolidatedRows.forEach((row) => {
      const key = row.getAttribute("data-consolidated-key");
      const serie =
        (config.consolidatedSeries || {})[key] ||
        (defaults.consolidatedSeries || {})[key];
      if (!serie) return;
      const labelInput = row.querySelector("[data-consolidated-label]");
      const colorInput = row.querySelector("[data-consolidated-color]");
      if (labelInput) labelInput.value = serie.label || "";
      if (colorInput) colorInput.value = serie.color || "#0d47a1";
    });

    if (legendShowToggle) legendShowToggle.checked = config.legend?.show !== false;
    if (legendPositionSelect) {
      legendPositionSelect.value = config.legend?.position || "bottom";
    }
    if (chartTypeSelect) chartTypeSelect.value = config.chart?.type || "bar";
    if (chartStackedToggle) {
      chartStackedToggle.checked = Boolean(config.chart?.stacked);
    }

    const ingresoEnabled = form.querySelector("[data-ingreso-enabled]");
    const ingresoTitle = form.querySelector("[data-ingreso-title]");
    const ingresoSubtitle = form.querySelector("[data-ingreso-subtitle]");
    const ingresoChartTypeSelect = form.querySelector("[data-ingreso-chart-type]");
    if (ingresoEnabled) {
      ingresoEnabled.checked = config.ingreso?.enabled !== false;
    }
    if (ingresoTitle) ingresoTitle.value = config.ingreso?.title || "";
    if (ingresoSubtitle) ingresoSubtitle.value = config.ingreso?.subtitle || "";
    if (ingresoChartTypeSelect) {
      const fallbackType = defaults.ingreso?.chartType || "inherit";
      ingresoChartTypeSelect.value = normalizeChartType(
        config.ingreso?.chartType,
        fallbackType
      );
    }
    form
      .querySelectorAll("[data-ingreso-series-row]")
      .forEach((row) => {
        const key = row.getAttribute("data-ingreso-series-key");
        const serie =
          (config.ingreso?.series || {})[key] ||
          (defaults.ingreso?.series || {})[key];
        if (!serie) return;
        const labelInput = row.querySelector("[data-ingreso-series-label]");
        const colorInput = row.querySelector("[data-ingreso-series-color]");
        const enabledInput = row.querySelector("[data-ingreso-series-enabled]");
        const sourcesInput = row.querySelector("[data-ingreso-series-sources]");
        if (labelInput) labelInput.value = serie.label || "";
        if (colorInput) colorInput.value = serie.color || "#0d47a1";
        if (enabledInput) enabledInput.checked = Boolean(serie.enabled);
        if (sourcesInput) {
          const variants =
            ingresoSources[key] || defaultSources.ingreso?.[key] || [];
          sourcesInput.value = formatVariantsList(variants);
        }
      });

    const ingresoNacionalEnabled = form.querySelector(
      "[data-ingreso-nacional-enabled]"
    );
    const ingresoNacionalTitle = form.querySelector(
      "[data-ingreso-nacional-title]"
    );
    const ingresoNacionalSubtitle = form.querySelector(
      "[data-ingreso-nacional-subtitle]"
    );
    const ingresoNacionalChartTypeSelect = form.querySelector(
      "[data-ingreso-nacional-chart-type]"
    );
    if (ingresoNacionalEnabled) {
      ingresoNacionalEnabled.checked =
        config.ingresoNacional?.enabled !== false;
    }
    if (ingresoNacionalTitle) {
      ingresoNacionalTitle.value = config.ingresoNacional?.title || "";
    }
    if (ingresoNacionalSubtitle) {
      ingresoNacionalSubtitle.value = config.ingresoNacional?.subtitle || "";
    }
    if (ingresoNacionalChartTypeSelect) {
      const fallbackType = defaults.ingresoNacional?.chartType || "inherit";
      ingresoNacionalChartTypeSelect.value = normalizeChartType(
        config.ingresoNacional?.chartType,
        fallbackType
      );
    }
    form
      .querySelectorAll("[data-ingreso-nacional-series-row]")
      .forEach((row) => {
        const key = row.getAttribute("data-ingreso-nacional-series-key");
        const serie =
          (config.ingresoNacional?.series || {})[key] ||
          (defaults.ingresoNacional?.series || {})[key];
        if (!serie) return;
        const labelInput = row.querySelector(
          "[data-ingreso-nacional-series-label]"
        );
        const colorInput = row.querySelector(
          "[data-ingreso-nacional-series-color]"
        );
        const enabledInput = row.querySelector(
          "[data-ingreso-nacional-series-enabled]"
        );
        const sourcesInput = row.querySelector(
          "[data-ingreso-nacional-series-sources]"
        );
        if (labelInput) labelInput.value = serie.label || "";
        if (colorInput) colorInput.value = serie.color || "#0d47a1";
        if (enabledInput) enabledInput.checked = Boolean(serie.enabled);
        if (sourcesInput) {
          const variants =
            ingresoNacionalSources[key] ||
            defaultSources.ingresoNacional?.[key] ||
            [];
          sourcesInput.value = formatVariantsList(variants);
        }
      });

    form.querySelectorAll("[data-summary-rows]").forEach((input) => {
      const key = input.getAttribute("data-summary-key");
      const type = input.getAttribute("data-summary-type");
      if (!key || !type) return;
      const rows =
        summarySources?.[key]?.[type] ||
        defaultSources.summary?.[key]?.[type] ||
        [];
      input.value = formatSummaryRows(rows);
    });

    form.querySelectorAll("[data-consolidated-source]").forEach((input) => {
      const key = input.getAttribute("data-consolidated-source-key");
      if (!key) return;
      const row =
        consolidatedSources?.[key] ||
        defaultSources.consolidated?.[key] ||
        {};
      const variants = Array.isArray(row?.variants) ? row.variants : [];
      input.value = formatVariantsList(variants);
    });

    const operativoEnabled = form.querySelector("[data-operativo-enabled]");
    const operativoTitle = form.querySelector("[data-operativo-title]");
    const operativoChartTypeSelect = form.querySelector(
      "[data-operativo-chart-type]"
    );
    if (operativoEnabled) {
      operativoEnabled.checked = config.operativo?.enabled !== false;
    }
    if (operativoTitle) operativoTitle.value = config.operativo?.title || "";
    if (operativoChartTypeSelect) {
      const fallbackType = defaults.operativo?.chartType || "bar";
      operativoChartTypeSelect.value = normalizeChartType(
        config.operativo?.chartType,
        fallbackType
      );
    }
    form
      .querySelectorAll("[data-operativo-series-row]")
      .forEach((row) => {
        const key = row.getAttribute("data-operativo-series-key");
        const serie =
          (config.operativo?.datasets || {})[key] ||
          (defaults.operativo?.datasets || {})[key];
        if (!serie) return;
        const labelInput = row.querySelector("[data-operativo-series-label]");
        const colorInput = row.querySelector("[data-operativo-series-color]");
        const enabledInput = row.querySelector("[data-operativo-series-enabled]");
        if (labelInput) labelInput.value = serie.label || "";
        if (colorInput) colorInput.value = serie.color || "#0d47a1";
        if (enabledInput) enabledInput.checked = Boolean(serie.enabled);
      });

    const ggEnabled = form.querySelector("[data-gg-enabled]");
    const ggSubtitle = form.querySelector("[data-gg-subtitle]");
    if (ggEnabled) ggEnabled.checked = config.gastosGenerales?.enabled !== false;
    if (ggSubtitle) {
      ggSubtitle.value = config.gastosGenerales?.subtitleTemplate || "";
    }

    const ggCharts = Array.from(form.querySelectorAll("[data-gg-chart-key]"));
    ggCharts.forEach((chart) => {
      const key = chart.getAttribute("data-gg-chart-key");
      const chartCfg =
        (config.gastosGenerales?.charts || {})[key] ||
        (defaults.gastosGenerales?.charts || {})[key];
      if (!chartCfg) return;
      const titleInput = chart.querySelector("[data-gg-chart-title]");
      const enabledInput = chart.querySelector("[data-gg-chart-enabled]");
      const typeSelect = chart.querySelector("[data-gg-chart-type]");
      if (titleInput) titleInput.value = chartCfg.title || "";
      if (enabledInput) enabledInput.checked = Boolean(chartCfg.enabled);
      if (typeSelect) {
        const fallbackType =
          defaults.gastosGenerales?.charts?.[key]?.chartType || "line";
        typeSelect.value = normalizeChartType(chartCfg.chartType, fallbackType);
      }
      chart.querySelectorAll("[data-gg-series-row]").forEach((row) => {
        const serieKey = row.getAttribute("data-gg-series-key");
        const serie =
          (chartCfg.series || {})[serieKey] ||
          (defaults.gastosGenerales?.charts?.[key]?.series || {})[serieKey];
        if (!serie) return;
        const labelInput = row.querySelector("[data-gg-series-label]");
        const colorInput = row.querySelector("[data-gg-series-color]");
        const enabledInput = row.querySelector("[data-gg-series-enabled]");
        if (labelInput) labelInput.value = serie.label || "";
        if (colorInput) colorInput.value = serie.color || "#0d47a1";
        if (enabledInput) enabledInput.checked = Boolean(serie.enabled);
      });
    });

    if (customList) {
      customList.innerHTML = "";
      const customCharts = Array.isArray(config.customCharts)
        ? config.customCharts
        : Array.isArray(defaults.customCharts)
        ? defaults.customCharts
        : [];
      customCharts.forEach((chart) => renderCustomChartItem(chart));
    }
  };

  const readConfigFromForm = () => {
    const api = getGraficasConfigApi();
    const baseConfig = clone(api?.load?.() || {});
    const defaults = clone(api?.defaults || {});
    const sources = clone(baseConfig.sources || defaults.sources || {});

    const series = [];
    form.querySelectorAll("[data-series-row]").forEach((row) => {
      const key = row.getAttribute("data-series-key");
      if (!key) return;
      const labelInput = row.querySelector("[data-series-label]");
      const colorInput = row.querySelector("[data-series-color]");
      const enabledInput = row.querySelector("[data-series-enabled]");
      const fallback =
        (defaults.series || []).find((item) => item.key === key) || {};
      series.push({
        key,
        label: labelInput?.value?.trim() || fallback.label || "",
        color: colorInput?.value || fallback.color || "#0d47a1",
        enabled: Boolean(enabledInput?.checked),
      });
    });

    const charts = {};
    form.querySelectorAll("[data-chart-key]").forEach((row) => {
      const key = row.getAttribute("data-chart-key");
      if (!key) return;
      const titleInput = row.querySelector("[data-chart-title]");
      const subtitleInput = row.querySelector("[data-chart-subtitle]");
      const enabledInput = row.querySelector("[data-chart-enabled]");
      const typeSelect = row.querySelector("[data-chart-type]");
      const fallback = (defaults.charts || {})[key] || {};
      charts[key] = {
        title: titleInput?.value?.trim() || fallback.title || "",
        subtitle: subtitleInput?.value?.trim() || fallback.subtitle || "",
        enabled: Boolean(enabledInput?.checked),
        chartType: normalizeChartType(
          typeSelect?.value,
          fallback.chartType || "inherit"
        ),
      };
    });

    const consolidatedSeries = {};
    form.querySelectorAll("[data-consolidated-key]").forEach((row) => {
      const key = row.getAttribute("data-consolidated-key");
      if (!key) return;
      const labelInput = row.querySelector("[data-consolidated-label]");
      const colorInput = row.querySelector("[data-consolidated-color]");
      const fallback = (defaults.consolidatedSeries || {})[key] || {};
      consolidatedSeries[key] = {
        label: labelInput?.value?.trim() || fallback.label || "",
        color: colorInput?.value || fallback.color || "#0d47a1",
      };
    });

    const ingresoSeries = {};
    const ingresoSources = {};
    const ingresoChartTypeSelect = form.querySelector(
      "[data-ingreso-chart-type]"
    );
    form.querySelectorAll("[data-ingreso-series-row]").forEach((row) => {
      const key = row.getAttribute("data-ingreso-series-key");
      if (!key) return;
      const labelInput = row.querySelector("[data-ingreso-series-label]");
      const colorInput = row.querySelector("[data-ingreso-series-color]");
      const enabledInput = row.querySelector("[data-ingreso-series-enabled]");
      const sourcesInput = row.querySelector("[data-ingreso-series-sources]");
      const fallback = (defaults.ingreso?.series || {})[key] || {};
      ingresoSeries[key] = {
        label: labelInput?.value?.trim() || fallback.label || "",
        color: colorInput?.value || fallback.color || "#0d47a1",
        enabled: Boolean(enabledInput?.checked),
      };
      ingresoSources[key] = parseVariantsList(sourcesInput?.value || "");
    });

    const ingresoNacionalSeries = {};
    const ingresoNacionalSources = {};
    const ingresoNacionalChartTypeSelect = form.querySelector(
      "[data-ingreso-nacional-chart-type]"
    );
    form.querySelectorAll("[data-ingreso-nacional-series-row]").forEach((row) => {
      const key = row.getAttribute("data-ingreso-nacional-series-key");
      if (!key) return;
      const labelInput = row.querySelector("[data-ingreso-nacional-series-label]");
      const colorInput = row.querySelector("[data-ingreso-nacional-series-color]");
      const enabledInput = row.querySelector(
        "[data-ingreso-nacional-series-enabled]"
      );
      const sourcesInput = row.querySelector(
        "[data-ingreso-nacional-series-sources]"
      );
      const fallback = (defaults.ingresoNacional?.series || {})[key] || {};
      ingresoNacionalSeries[key] = {
        label: labelInput?.value?.trim() || fallback.label || "",
        color: colorInput?.value || fallback.color || "#0d47a1",
        enabled: Boolean(enabledInput?.checked),
      };
      ingresoNacionalSources[key] = parseVariantsList(
        sourcesInput?.value || ""
      );
    });

    const summarySources = sources.summary || {};
    form.querySelectorAll("[data-summary-rows]").forEach((input) => {
      const key = input.getAttribute("data-summary-key");
      const type = input.getAttribute("data-summary-type");
      if (!key || !type) return;
      if (!summarySources[key]) summarySources[key] = {};
      summarySources[key][type] = parseSummaryRows(input.value || "");
    });
    sources.summary = summarySources;

    const consolidatedSources = sources.consolidated || {};
    form.querySelectorAll("[data-consolidated-source]").forEach((input) => {
      const key = input.getAttribute("data-consolidated-source-key");
      if (!key) return;
      const fallback =
        consolidatedSources[key] || defaults.sources?.consolidated?.[key] || {};
      consolidatedSources[key] = {
        label: fallback.label || "",
        variants: parseVariantsList(input.value || ""),
      };
    });
    sources.consolidated = consolidatedSources;
    sources.ingreso = ingresoSources;
    sources.ingresoNacional = ingresoNacionalSources;

    const operativoDatasets = {};
    const operativoChartTypeSelect = form.querySelector(
      "[data-operativo-chart-type]"
    );
    form.querySelectorAll("[data-operativo-series-row]").forEach((row) => {
      const key = row.getAttribute("data-operativo-series-key");
      if (!key) return;
      const labelInput = row.querySelector("[data-operativo-series-label]");
      const colorInput = row.querySelector("[data-operativo-series-color]");
      const enabledInput = row.querySelector("[data-operativo-series-enabled]");
      const fallback = (defaults.operativo?.datasets || {})[key] || {};
      operativoDatasets[key] = {
        label: labelInput?.value?.trim() || fallback.label || "",
        color: colorInput?.value || fallback.color || "#0d47a1",
        enabled: Boolean(enabledInput?.checked),
      };
    });

    const ggCharts = {};
    form.querySelectorAll("[data-gg-chart-key]").forEach((chart) => {
      const key = chart.getAttribute("data-gg-chart-key");
      if (!key) return;
      const titleInput = chart.querySelector("[data-gg-chart-title]");
      const enabledInput = chart.querySelector("[data-gg-chart-enabled]");
      const typeSelect = chart.querySelector("[data-gg-chart-type]");
      const fallback = (defaults.gastosGenerales?.charts || {})[key] || {};
      const series = {};
      chart.querySelectorAll("[data-gg-series-row]").forEach((row) => {
        const serieKey = row.getAttribute("data-gg-series-key");
        if (!serieKey) return;
        const labelInput = row.querySelector("[data-gg-series-label]");
        const colorInput = row.querySelector("[data-gg-series-color]");
        const enabledInput = row.querySelector("[data-gg-series-enabled]");
        const fallbackSerie = (fallback.series || {})[serieKey] || {};
        series[serieKey] = {
          label: labelInput?.value?.trim() || fallbackSerie.label || "",
          color: colorInput?.value || fallbackSerie.color || "#0d47a1",
          enabled: Boolean(enabledInput?.checked),
        };
      });
      ggCharts[key] = {
        title: titleInput?.value?.trim() || fallback.title || "",
        enabled: Boolean(enabledInput?.checked),
        chartType: normalizeChartType(typeSelect?.value, fallback.chartType || "line"),
        series,
      };
    });

    const summarySeriesMap = new Map(
      (Array.isArray(baseConfig.series)
        ? baseConfig.series
        : Array.isArray(defaults.series)
        ? defaults.series
        : []
      )
        .map((serie) => [String(serie?.key || "").trim(), serie])
        .filter(([key]) => Boolean(key))
    );
    const summarySeriesDefs = SUMMARY_TABLE_SERIES.map((base) => {
      const override = summarySeriesMap.get(base.key) || {};
      return {
        ...base,
        label:
          (typeof override.label === "string" && override.label.trim()
            ? override.label.trim()
            : null) || base.label,
        color:
          (typeof override.color === "string" && override.color.trim()
            ? override.color.trim()
            : null) || base.color,
        enabled:
          typeof override.enabled === "boolean"
            ? override.enabled
            : base.enabled !== false,
      };
    });
    const operativoSeriesSource =
      baseConfig.operativo?.datasets || defaults.operativo?.datasets || {};
    const operativoSeriesDefs = Object.keys(operativoSeriesSource).map((key) => ({
      key,
      ...(operativoSeriesSource[key] || {}),
    }));
    const resolveSeriesFallback = (moduleValue, key) => {
      const moduleKey = normalizeModuleKey(moduleValue || "RESUMEN");
      const source = isSummaryModuleKey(moduleKey)
        ? summarySeriesDefs
        : operativoSeriesDefs;
      return (
        source.find((item) => String(item?.key || "").trim() === String(key).trim()) ||
        {}
      );
    };

    const customCharts = [];
    if (customList) {
      const existingCustomCharts = Array.isArray(baseConfig.customCharts)
        ? baseConfig.customCharts
        : [];
      const existingMap = new Map(
        existingCustomCharts
          .filter((chart) => chart && chart.id)
          .map((chart) => [String(chart.id), chart])
      );
      customList.querySelectorAll("[data-custom-chart]").forEach((item) => {
        const id = item.dataset.customId || buildCustomChartId();
        const title = item.querySelector("[data-custom-title]")?.value?.trim() || "";
        const subtitle =
          item.querySelector("[data-custom-subtitle]")?.value?.trim() || "";
        const module = normalizeModuleValue(
          item.querySelector("[data-custom-module]")?.value || "RESUMEN",
          "RESUMEN"
        );
        const chartType =
          item.querySelector("[data-custom-type]")?.value || "inherit";
        const enabled =
          item.querySelector("[data-custom-enabled]")?.checked !== false;
        const rowsText = item.querySelector("[data-custom-rows]")?.value || "";
        const rows = parseCustomRows(rowsText);
        const existing = existingMap.get(String(id)) || {};
        const rawSourceType =
          item.dataset.customSourceType ||
          existing.sourceType ||
          "snapshot";
        const sourceType =
          typeof rawSourceType === "string" && rawSourceType.trim()
            ? rawSourceType.trim()
            : "snapshot";
        const rawSeriesKeys =
          item.dataset.customSeriesKeys ||
          (Array.isArray(existing.seriesKeys)
            ? existing.seriesKeys.join("|")
            : "");
        const seriesKeys = rawSeriesKeys
          ? rawSeriesKeys
              .split("|")
              .map((value) => value.trim())
              .filter(Boolean)
          : [];
        const existingSeriesMap = new Map(
          (Array.isArray(existing.series) ? existing.series : [])
            .map((serie) => {
              const key = String(serie?.key || "").trim();
              if (!key) return null;
              return [key, serie];
            })
            .filter(Boolean)
        );
        const series = seriesKeys.map((key) => {
          const existingSerie = existingSeriesMap.get(String(key).trim()) || {};
          const fallbackSerie = resolveSeriesFallback(module, key);
          return {
            key,
            label:
              (typeof existingSerie.label === "string" &&
              existingSerie.label.trim()
                ? existingSerie.label.trim()
                : null) ||
              (typeof fallbackSerie.label === "string" &&
              fallbackSerie.label.trim()
                ? fallbackSerie.label.trim()
                : key),
            color:
              (typeof existingSerie.color === "string" &&
              existingSerie.color.trim()
                ? existingSerie.color.trim()
                : null) ||
              (typeof fallbackSerie.color === "string" &&
              fallbackSerie.color.trim()
                ? fallbackSerie.color.trim()
                : "#0d47a1"),
            enabled:
              typeof existingSerie.enabled === "boolean"
                ? existingSerie.enabled
                : fallbackSerie.enabled !== false,
          };
        });
        customCharts.push({
          id,
          title,
          subtitle,
          module,
          chartType,
          enabled,
          sourceType,
          seriesKeys,
          series,
          rows,
        });
      });
    }

    return {
      ...baseConfig,
      version: defaults.version || 2,
      series,
      charts,
      consolidatedSeries,
      legend: {
        show: legendShowToggle ? legendShowToggle.checked : true,
        position: legendPositionSelect ? legendPositionSelect.value : "bottom",
      },
      chart: {
        type: chartTypeSelect ? chartTypeSelect.value : "bar",
        stacked: chartStackedToggle ? chartStackedToggle.checked : false,
      },
      ingreso: {
        enabled:
          form.querySelector("[data-ingreso-enabled]")?.checked !== false,
        title: form.querySelector("[data-ingreso-title]")?.value?.trim() || "",
        subtitle:
          form.querySelector("[data-ingreso-subtitle]")?.value?.trim() || "",
        chartType: normalizeChartType(
          ingresoChartTypeSelect?.value,
          defaults.ingreso?.chartType || "inherit"
        ),
        series: ingresoSeries,
      },
      ingresoNacional: {
        enabled:
          form.querySelector("[data-ingreso-nacional-enabled]")?.checked !==
          false,
        title:
          form.querySelector("[data-ingreso-nacional-title]")?.value?.trim() ||
          "",
        subtitle:
          form.querySelector("[data-ingreso-nacional-subtitle]")?.value?.trim() ||
          "",
        chartType: normalizeChartType(
          ingresoNacionalChartTypeSelect?.value,
          defaults.ingresoNacional?.chartType || "inherit"
        ),
        series: ingresoNacionalSeries,
      },
      operativo: {
        enabled:
          form.querySelector("[data-operativo-enabled]")?.checked !== false,
        title:
          form.querySelector("[data-operativo-title]")?.value?.trim() || "",
        chartType: normalizeChartType(
          operativoChartTypeSelect?.value,
          defaults.operativo?.chartType || "bar"
        ),
        datasets: operativoDatasets,
      },
      gastosGenerales: {
        enabled: form.querySelector("[data-gg-enabled]")?.checked !== false,
        subtitleTemplate:
          form.querySelector("[data-gg-subtitle]")?.value?.trim() || "",
        charts: ggCharts,
      },
      sources,
      customCharts,
    };
  };

  const galleryState = {
    cards: new Map(),
    previews: new Map(),
    selectedId: null,
  };

  const destroyGalleryPreviews = () => {
    galleryState.previews.forEach((chart) => {
      chart?.destroy?.();
    });
    galleryState.previews.clear();
  };

  const listFromMap = (map) =>
    Object.keys(map || {}).map((key) => ({ key, ...(map[key] || {}) }));

  const CHART_TYPE_LABELS = {
    inherit: "Global",
    bar: "Barras",
    line: "Linea",
    pie: "Pastel",
    doughnut: "Dona",
  };

  const FLASH_CLASS = "plantillas-graficas-flash";
  const detailState = {
    seriesByChart: new Map(),
  };
  let detailUpdating = false;

  const filterSeriesByKeys = (seriesList = [], keys = []) => {
    if (!Array.isArray(keys) || keys.length === 0) return seriesList;
    const keySet = new Set(
      keys.map((key) => (key != null ? String(key).trim() : "")).filter(Boolean)
    );
    if (!keySet.size) return seriesList;
    const filtered = (seriesList || []).filter((serie) => keySet.has(serie?.key));
    return filtered.length ? filtered : seriesList;
  };

  const normalizeChartType = (value, fallback = "inherit") => {
    if (typeof value !== "string") return fallback;
    const clean = value.trim();
    if (!clean) return fallback;
    if (clean === "inherit") return "inherit";
    if (["bar", "line", "pie", "doughnut"].includes(clean)) return clean;
    return fallback;
  };

  const resolveChartType = (value, baseType) => {
    const normalized = normalizeChartType(value, "inherit");
    if (normalized === "inherit") return baseType || "bar";
    return normalized;
  };

  const PREVIEW_PALETTE = [
    "#2563eb",
    "#f59e0b",
    "#10b981",
    "#ef4444",
    "#8b5cf6",
    "#14b8a6",
    "#f97316",
    "#e11d48",
  ];

  const isPieType = (type) => type === "pie" || type === "doughnut";

  const buildSlicePalette = (count, baseColor) => {
    const palette = baseColor
      ? [baseColor, ...PREVIEW_PALETTE.filter((color) => color !== baseColor)]
      : PREVIEW_PALETTE;
    return Array.from({ length: count }, (_, idx) => palette[idx % palette.length]);
  };

  const formatChartTypeLabel = (type) =>
    CHART_TYPE_LABELS[type] || CHART_TYPE_LABELS.bar;

  const uniqueList = (items) => Array.from(new Set((items || []).filter(Boolean)));

  const formatKeyLabel = (key, label) => {
    const cleanKey = (key || "").toString().trim();
    const cleanLabel = (label || "").toString().trim();
    if (!cleanKey && !cleanLabel) return "";
    if (!cleanLabel || cleanLabel === cleanKey) return cleanKey || cleanLabel;
    return `${cleanLabel} (${cleanKey})`;
  };

  const getSelectedValues = (select) =>
    Array.from(select?.selectedOptions || [])
      .map((option) => option.value)
      .filter(Boolean);

  const setSelectOptions = (
    select,
    options,
    selectedValues = [],
    { placeholder = "Sin opciones", disabled = false } = {}
  ) => {
    if (!select) return;
    const selectedSet = new Set(
      (Array.isArray(selectedValues) ? selectedValues : [])
        .map((value) => (value || "").toString().trim())
        .filter(Boolean)
    );
    const normalizedOptions = Array.isArray(options) ? options : [];
    const values = normalizedOptions
      .map((option) =>
        typeof option === "string"
          ? { value: option, label: option }
          : option
      )
      .filter((option) => option && option.value);
    const missingSelected = Array.from(selectedSet).filter(
      (value) => !values.some((option) => option.value === value)
    );
    const finalOptions = [
      ...values,
      ...missingSelected.map((value) => ({ value, label: value })),
    ];
    select.innerHTML = "";
    if (!finalOptions.length) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = placeholder;
      opt.disabled = true;
      opt.selected = true;
      select.appendChild(opt);
      select.disabled = true;
      return;
    }
    finalOptions.forEach((option) => {
      const node = document.createElement("option");
      node.value = option.value;
      node.textContent = option.label || option.value;
      node.selected = selectedSet.has(option.value);
      select.appendChild(node);
    });
    select.disabled = Boolean(disabled);
  };

  const collectRowsFromState = () => {
    const labels = [];
    const push = (value) => {
      const clean = (value || "").toString().trim();
      if (!clean) return;
      labels.push(clean);
    };
    const cuentas = Array.isArray(window.state?.cuentas)
      ? window.state.cuentas
      : [];
    cuentas.forEach((cuenta) => {
      if (!cuenta) return;
      push(cuenta.SECCION || cuenta.seccion || cuenta.PRINCIPAL || cuenta.principal);
      push(
        cuenta.SUBSECCION ||
          cuenta.subseccion ||
          cuenta.SECUNDARIA ||
          cuenta.secundaria
      );
      push(cuenta.NOMBRE || cuenta.nombre);
      push(cuenta.CUENTA || cuenta.cuenta);
    });
    const operaciones = Array.isArray(window.state?.operaciones)
      ? window.state.operaciones
      : [];
    operaciones.forEach((op) => {
      if (!op) return;
      push(
        op.Operacion ||
          op.operacion ||
          op.clase ||
          op.label ||
          op.NOMBRE ||
          op.nombre
      );
    });
    return uniqueList(labels);
  };

  const collectRowsFromLayoutPreview = () => {
    const labels = [];
    const push = (value) => {
      const clean = (value || "").toString().trim();
      if (!clean) return;
      labels.push(clean);
    };
    const layoutPreview = document.getElementById("layoutPreview");
    if (!layoutPreview) return [];
    layoutPreview
      .querySelectorAll(".template-list-view .list-item[data-row-type]")
      .forEach((item) => {
        const rowType = (item.dataset.rowType || "").toLowerCase();
        if (rowType === "section") {
          push(item.dataset.section);
          return;
        }
        if (rowType === "subsection") {
          push(item.dataset.subsection);
          return;
        }
        if (rowType === "account") {
          push(item.dataset.nombre);
          push(item.dataset.cuenta);
          return;
        }
        if (rowType === "operation") {
          push(item.dataset.operationLabel || item.dataset.operationId);
        }
      });
    layoutPreview
      .querySelectorAll(".template-table tr[data-row-type]")
      .forEach((row) => {
        const rowType = (row.dataset.rowType || "").toLowerCase();
        const cells = Array.from(row.querySelectorAll("td"));
        if (!cells.length) return;
        if (rowType === "section" || rowType === "subsection") {
          push(cells[1]?.textContent || cells[0]?.textContent || "");
          return;
        }
        if (rowType === "account") {
          push(cells[1]?.textContent || "");
          push(cells[0]?.textContent || "");
          return;
        }
        if (rowType === "operation") {
          push(cells[1]?.textContent || cells[0]?.textContent || "");
        }
      });
    return uniqueList(labels);
  };

  const getModuleRowOptions = (moduleValue) => {
    const moduleKey = normalizeModuleKey(moduleValue || "RESUMEN");
    if (isSummaryModuleKey(moduleKey)) {
      return refreshSnapshotLabelOptions();
    }
    const combined = [
      ...collectRowsFromState(),
      ...collectRowsFromLayoutPreview(),
    ];
    return uniqueList(combined).sort((a, b) => a.localeCompare(b));
  };

  const buildSummarySeriesList = (config, defaults) => {
    const seriesSource =
      Array.isArray(config?.series) && config.series.length
        ? config.series
        : defaults?.series || [];
    const overrides = new Map(
      seriesSource
        .map((serie) => [String(serie?.key || "").trim(), serie])
        .filter(([key]) => Boolean(key))
    );
    return SUMMARY_TABLE_SERIES.map((base) => {
      const override = overrides.get(base.key) || {};
      return {
        key: base.key,
        label:
          (typeof override.label === "string" && override.label.trim()
            ? override.label.trim()
            : null) || base.label,
        enabled:
          typeof override.enabled === "boolean"
            ? override.enabled
            : base.enabled !== false,
      };
    });
  };

  const buildOperativoSeriesList = (config, defaults) =>
    listFromMap(config?.operativo?.datasets || defaults?.operativo?.datasets || {})
      .map((serie) => ({
        key: serie.key,
        label: serie.label || serie.key,
        enabled: serie.enabled !== false,
      }))
      .filter((serie) => serie.key);

  const buildGastosSeriesList = (config, defaults, chartKey) =>
    listFromMap(
      (config?.gastosGenerales?.charts || defaults?.gastosGenerales?.charts || {})?.[
        chartKey
      ]?.series || {}
    )
      .map((serie) => ({
        key: serie.key,
        label: serie.label || serie.key,
        enabled: serie.enabled !== false,
      }))
      .filter((serie) => serie.key);

  const getSummarySourceVariants = (summarySources, key, type) => {
    const rows = summarySources?.[key]?.[type] || [];
    const variants = [];
    rows.forEach((row) => {
      if (typeof row === "string") {
        variants.push(row);
        return;
      }
      if (Array.isArray(row?.variants)) {
        variants.push(...row.variants);
        return;
      }
      if (Array.isArray(row?.labels)) {
        variants.push(...row.labels);
        return;
      }
      if (row?.label || row?.alias) {
        variants.push(row.label || row.alias);
      }
    });
    return uniqueList(variants.map((item) => (item || "").toString().trim()).filter(Boolean));
  };

  const formatListSummary = (items, limit = 4) => {
    const list = uniqueList(items);
    if (!list.length) return "";
    const head = list.slice(0, limit).join(", ");
    const extra = list.length > limit ? ` +${list.length - limit} mas` : "";
    return `${head}${extra}`;
  };

  const buildSourcesText = (items, label = "Fuentes") => {
    const summary = formatListSummary(items);
    return summary ? `${label}: ${summary}` : "";
  };

  const buildSourcesMeta = (items, label = "Fuentes") => {
    const list = uniqueList(items);
    return list.length ? `${label}: ${list.length}` : "";
  };

  const MODULE_FILE_BY_KEY = {
    RESUMEN: "RESUMEN.html",
    SUMMARY: "RESUMEN.html",
    MEMBRESIA: "Membresía.html",
    EVENTOS: "Eventos.html",
    COMUNICACION: "Comunicación.html",
    DIRECCION: "Dirección.html",
    SERVMEMBRESIA: "Serv_Membresía.html",
    SERVICIOSALAMEMBRESIA: "Serv_Membresía.html",
    COMITES: "Comités.html",
    COMITESINCOME: "Comités.html",
    TIC: "T&IC.html",
    RH: "RH.html",
    VPE: "VPE.html",
    FINANZAS: "Finanzas.html",
    GASTOSGENERALES: "GastosGenerales.html",
    NOMINA: "Nomina.html",
    GTOSCORPORATIVOS: "Gtos_Corporativos.html",
  };

  const resolveModuleFileName = (moduleValue = "") => {
    const key = normalizeModuleKey(moduleValue || "RESUMEN");
    return MODULE_FILE_BY_KEY[key] || `${(moduleValue || "RESUMEN").toString().trim()}.html`;
  };

  const toDisplayList = (items) =>
    uniqueList(
      (Array.isArray(items) ? items : [])
        .map((item) => (item || "").toString().trim())
        .filter(Boolean)
    );

  const buildRowsColumnsInfo = ({
    moduleValue,
    rows = [],
    columns = [],
    tableLabel,
  }) => {
    const moduleFile = resolveModuleFileName(moduleValue);
    const tableName = tableLabel || moduleFile;
    const rowList = toDisplayList(rows);
    const columnList = toDisplayList(columns);
    const fullRows = formatListSummary(rowList, 999) || "No definidas";
    const fullColumns = formatListSummary(columnList, 999) || "No definidas";
    return {
      moduleFile,
      tableLabel: tableName,
      rowList,
      columnList,
      sourcesText: [
        `Tabla: ${tableName}`,
        `Filas: ${fullRows}`,
        `Columnas: ${fullColumns}`,
      ].join("\n"),
      sourcesMeta: `Tabla: ${tableName} · Filas: ${
        formatListSummary(rowList, 2) || "No definidas"
      } · Columnas: ${formatListSummary(columnList, 2) || "No definidas"}`,
    };
  };

  const SUMMARY_SOURCE_LABELS = {
    cdmx: "CDMX",
    gdl: "Guadalajara",
    ne: "Noreste",
    no: "Noroeste",
    generic: "Generico",
  };

  const buildSummarySourceLabels = (summarySources, type) => {
    if (!summarySources) return [];
    return Object.entries(summarySources)
      .filter(([, group]) => Array.isArray(group?.[type]) && group[type].length)
      .map(([key]) => SUMMARY_SOURCE_LABELS[key] || key.toUpperCase());
  };

  const resolveSummaryRows = (capitulo, sources, fallbackSources) => {
    const cap = normalizeLabel(capitulo || "");
    const resolveGroup = (key) => {
      const group = sources?.[key];
      if (!group) return null;
      const operating = Array.isArray(group.operating) ? group.operating : [];
      const net = Array.isArray(group.net) ? group.net : [];
      if (!operating.length && !net.length) return null;
      return { operating, net, isCdmx: key === "cdmx", sourceKey: key };
    };

    if (sources) {
      if (cap.includes("CIUDAD DE MEXICO") || cap.includes("CDMX") || cap.includes("MEXICO")) {
        const resolved = resolveGroup("cdmx");
        if (resolved) return resolved;
      }
      if (cap.includes("GUADALAJARA") || cap.includes("GDL")) {
        const resolved = resolveGroup("gdl");
        if (resolved) return resolved;
      }
      if (cap.includes("NORESTE") || cap.includes("NE ") || cap.includes("MONTERREY")) {
        const resolved = resolveGroup("ne");
        if (resolved) return resolved;
      }
      if (cap.includes("NOROESTE") || cap.includes("NO ") || cap.includes("NORTHWEST")) {
        const resolved = resolveGroup("no");
        if (resolved) return resolved;
      }
      const fallback = resolveGroup("generic");
      if (fallback) return fallback;
    }

    if (fallbackSources) {
      return resolveSummaryRows(capitulo, fallbackSources, null);
    }

    return { operating: [], net: [], isCdmx: false, sourceKey: "generic" };
  };

  const buildSourceVariantsList = (sourceMap) => {
    if (!sourceMap || typeof sourceMap !== "object") return [];
    const labels = [];
    Object.values(sourceMap).forEach((variants) => {
      if (Array.isArray(variants) && variants.length) {
        labels.push(variants[0]);
      }
    });
    return uniqueList(labels);
  };

  const getCustomRowLabels = (rows) =>
    uniqueList(
      (Array.isArray(rows) ? rows : [])
        .map((row) => row?.alias || row?.label || row?.variants?.[0])
        .filter(Boolean)
    );

  const buildSampleValues = (count, start, drop) => {
    const result = [];
    let value = start;
    for (let i = 0; i < count; i += 1) {
      result.push(Math.max(0, Math.round(value)));
      value -= drop;
    }
    return result;
  };

  const buildDatasetsFromList = (seriesList, labels, chartType) => {
    if (!Array.isArray(seriesList)) return [];
    const active = seriesList.filter((serie) => serie?.enabled !== false);
    const isPie = isPieType(chartType);
    return active.map((serie, index) => {
      const color = serie?.color || "#0d47a1";
      const data = buildSampleValues(
        labels.length,
        140 + index * 35,
        12 + index * 2
      );
      const dataset = {
        label: serie?.label || serie?.key || `Serie ${index + 1}`,
        data,
        borderWidth: chartType === "line" ? 2 : 1,
      };
      if (isPie) {
        dataset.backgroundColor = buildSlicePalette(labels.length, color);
        dataset.borderColor = "#ffffff";
        dataset.borderWidth = 1;
        return dataset;
      }

      dataset.backgroundColor = color;
      dataset.borderColor = color;

      if (chartType === "line") {
        dataset.fill = false;
        dataset.tension = 0.3;
        dataset.pointRadius = 3;
        dataset.pointHoverRadius = 4;
        dataset.pointBackgroundColor = color;
      } else {
        dataset.borderRadius = 4;
        dataset.maxBarThickness = 18;
      }
      return dataset;
    });
  };

  const buildSampleSummaryPreview = (rows, seriesList, chartType, capituloLabel) => {
    let labels = (Array.isArray(rows) ? rows : [])
      .map((row) => resolveRowLabel(row, capituloLabel))
      .filter(Boolean);
    if (!labels.length) {
      const fallback = (capituloLabel || "").toString().trim();
      labels = fallback ? [fallback] : ["Fila 1", "Fila 2", "Fila 3"];
    }
    const datasets = buildDatasetsFromList(seriesList, labels, chartType);
    if (!datasets.length) return null;
    return { chartType, labels, datasets };
  };

  const toNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  };

  const ocultarCeros = (value) => {
    const num = Number(value) || 0;
    return num === 0 ? null : num;
  };

  const resolveRowLabel = (row, capituloLabel) => {
    const raw =
      row?.label ||
      row?.alias ||
      row?.variants?.[0] ||
      row?.labels?.[0] ||
      "";
    if (!raw) return "";
    if (capituloLabel) {
      return raw.toString().replace(/\{capitulo\}/gi, capituloLabel);
    }
    return raw.toString();
  };

  const buildCustomSamplePreview = (rows, seriesList, chartType, capituloLabel) => {
    let labels = (Array.isArray(rows) ? rows : [])
      .map((row) => resolveRowLabel(row, capituloLabel))
      .filter(Boolean);
    if (!labels.length) {
      const fallback = (capituloLabel || "").toString().trim();
      labels = fallback ? [fallback] : ["Fila 1", "Fila 2", "Fila 3"];
    }
    const datasets = buildDatasetsFromList(seriesList, labels, chartType);
    if (!datasets.length) return null;
    return { chartType, labels, datasets };
  };

  const percentageDelta = (baseValue, compareValue) => {
    const base = toNumber(baseValue);
    const compare = toNumber(compareValue);
    if (!Number.isFinite(base) || !Number.isFinite(compare) || compare === 0) {
      return 0;
    }
    return ((base / compare) - 1) * 100;
  };

  const resolveSummarySeriesValue = (totals = {}, key = "") => {
    const raw = toNumber(totals?.[key]);
    if (Number.isFinite(raw) && raw !== 0) return raw;
    if (key === "varMonthPlan") {
      return percentageDelta(totals?.actual, totals?.plan);
    }
    if (key === "varMonthPrev") {
      return percentageDelta(totals?.actual, totals?.prev);
    }
    if (key === "varYTDPlan") {
      return percentageDelta(totals?.actualYTD, totals?.planYTD);
    }
    if (key === "varYTDPrev") {
      return percentageDelta(totals?.actualYTD, totals?.prevYTD);
    }
    return Number.isFinite(raw) ? raw : 0;
  };

  const buildDatasetsFromSnapshot = ({
    rows,
    snapshotMap,
    seriesList,
    chartType,
    capituloLabel,
    looseMatch,
  }) => {
    if (!Array.isArray(rows) || !rows.length) return null;
    const activeSeries = (seriesList || []).filter(
      (serie) => serie?.enabled !== false
    );
    if (!activeSeries.length) return null;

    const labels = [];
    const dataMatrix = activeSeries.map(() => []);
    rows.forEach((row) => {
      const label = resolveRowLabel(row, capituloLabel);
      if (!label) return;
      const variants = Array.isArray(row?.variants)
        ? row.variants
        : Array.isArray(row?.labels)
        ? row.labels
        : row?.label
        ? [row.label]
        : [];
      const totals = looseMatch
        ? getRowTotalsLoose(snapshotMap, variants)
        : getRowTotals(snapshotMap, variants);
      labels.push(label);
      activeSeries.forEach((serie, index) => {
        dataMatrix[index].push(
          resolveSummarySeriesValue(totals || {}, serie.key)
        );
      });
    });

    if (!labels.length) return null;

    const isPie = isPieType(chartType);
    const datasets = activeSeries.map((serie, index) => {
      const data = dataMatrix[index] || [];
      const dataset = {
        label: serie?.label || serie?.key || `Serie ${index + 1}`,
        data: isPie ? data : data.map((value) => ocultarCeros(value)),
        borderWidth: chartType === "line" ? 2 : 1,
      };
      if (isPie) {
        dataset.backgroundColor = buildSlicePalette(
          data.length,
          serie?.color || "#0d47a1"
        );
        dataset.borderColor = "#ffffff";
        dataset.borderWidth = 1;
        return dataset;
      }
      const color = serie?.color || "#0d47a1";
      dataset.backgroundColor = color;
      dataset.borderColor = color;
      if (chartType === "line") {
        dataset.fill = false;
        dataset.tension = 0.3;
        dataset.pointRadius = 3;
        dataset.pointHoverRadius = 4;
        dataset.pointBackgroundColor = color;
      } else {
        dataset.borderRadius = 4;
        dataset.maxBarThickness = 18;
      }
      return dataset;
    });

    return { labels, datasets };
  };

  const getSourceVariants = (sources, key, fallback) => {
    const fromSources = sources?.[key];
    if (Array.isArray(fromSources) && fromSources.length) {
      return fromSources;
    }
    const fromFallback = fallback?.[key];
    return Array.isArray(fromFallback) ? fromFallback : [];
  };

  const getConsolidatedVariants = (sources, key, fallback) => {
    const variants = sources?.[key]?.variants;
    if (Array.isArray(variants) && variants.length) return variants;
    const fallbackVariants = fallback?.[key]?.variants;
    return Array.isArray(fallbackVariants) ? fallbackVariants : [];
  };

  const collectVariantsFromSourceMap = (sourceMap) => {
    if (!sourceMap || typeof sourceMap !== "object") return [];
    const list = [];
    Object.values(sourceMap).forEach((entry) => {
      if (Array.isArray(entry)) {
        list.push(...entry);
        return;
      }
      if (Array.isArray(entry?.variants)) {
        list.push(...entry.variants);
      }
    });
    return uniqueList(
      list.map((item) => (item || "").toString().trim()).filter(Boolean)
    );
  };

  const buildSourceHintText = ({
    tableLabel,
    rows = [],
    columns = [],
    extra = "",
  }) => {
    const formatFullList = (items) =>
      uniqueList(items)
        .map((item) => (item || "").toString().trim())
        .filter(Boolean)
        .join(", ");
    const rowText = formatFullList(rows) || "No definidas";
    const columnText = formatFullList(columns) || "No definidas";
    const parts = [];
    if (tableLabel) parts.push(`Tabla: ${tableLabel}`);
    parts.push(`Filas: ${rowText}`);
    parts.push(`Columnas: ${columnText}`);
    if (extra) parts.push(extra);
    return parts.join("\n");
  };

  const setSourceHint = (key, text) => {
    if (!form) return;
    const el = form.querySelector(`[data-source-hint="${key}"]`);
    if (!el) return;
    el.textContent = text || "";
    el.classList.toggle("d-none", !text);
  };

  const updateSourceHints = (configInput) => {
    if (!form) return;
    const apiDefaults = clone(getGraficasConfigApi()?.defaults || {});
    const config = configInput || readConfigFromForm();
    if (!config) return;
    const sources = config.sources || {};
    const summarySources = sources.summary || apiDefaults.sources?.summary || {};
    const selectedCapitulo = getSelectedCapitulo();
    const rowsConfig = resolveSummaryRows(
      selectedCapitulo,
      summarySources,
      apiDefaults.sources?.summary || {}
    );
    const summarySeries = Array.isArray(config.series) && config.series.length
      ? config.series
      : apiDefaults.series || [];
    const summaryColumns = summarySeries
      .filter((serie) => serie?.enabled !== false)
      .map((serie) => formatKeyLabel(serie?.key, serie?.label))
      .filter(Boolean);
    const operatingRows = (rowsConfig.operating || [])
      .map((row) => resolveRowLabel(row, selectedCapitulo))
      .filter(Boolean);
    const netRows = (rowsConfig.net || [])
      .map((row) => resolveRowLabel(row, selectedCapitulo))
      .filter(Boolean);
    const consolidatedSources =
      sources.consolidated || apiDefaults.sources?.consolidated || {};
    const consolidatedRows = uniqueList([
      ...getConsolidatedVariants(
        consolidatedSources,
        "operating",
        apiDefaults.sources?.consolidated || {}
      ),
      ...getConsolidatedVariants(
        consolidatedSources,
        "net",
        apiDefaults.sources?.consolidated || {}
      ),
    ]);
    const ingresoRows = collectVariantsFromSourceMap(
      sources.ingreso || apiDefaults.sources?.ingreso || {}
    );
    const ingresoNacionalRows = collectVariantsFromSourceMap(
      sources.ingresoNacional || apiDefaults.sources?.ingresoNacional || {}
    );

    const operativoSeries = listFromMap(
      config.operativo?.datasets || apiDefaults.operativo?.datasets || {}
    )
      .filter((serie) => serie?.enabled !== false)
      .map((serie) => formatKeyLabel(serie?.key, serie?.label))
      .filter(Boolean);

    const ggCharts =
      config.gastosGenerales?.charts || apiDefaults.gastosGenerales?.charts || {};
    const ggRendimientosSeries = listFromMap(
      ggCharts?.rendimientos?.series || {}
    )
      .filter((serie) => serie?.enabled !== false)
      .map((serie) => formatKeyLabel(serie?.key, serie?.label))
      .filter(Boolean);
    const ggPlusvaliaSeries = listFromMap(ggCharts?.plusvalia?.series || {})
      .filter((serie) => serie?.enabled !== false)
      .map((serie) => formatKeyLabel(serie?.key, serie?.label))
      .filter(Boolean);

    const resumenFile = resolveModuleFileName("RESUMEN");
    const gastosFile = resolveModuleFileName("Gastos Generales");
    const operativoFile = resolveModuleFileName(getCurrentModuleValue() || "RESUMEN");

    setSourceHint(
      "operating",
      buildSourceHintText({
        tableLabel: `${resumenFile} (tabla actual)`,
        rows: operatingRows,
        columns: summaryColumns,
      })
    );
    setSourceHint(
      "net",
      buildSourceHintText({
        tableLabel: `${resumenFile} (tabla actual)`,
        rows: netRows,
        columns: summaryColumns,
      })
    );
    setSourceHint(
      "consolidated",
      buildSourceHintText({
        tableLabel: `${resumenFile} (tabla actual)`,
        rows: consolidatedRows,
        columns: summaryColumns,
      })
    );
    setSourceHint(
      "ingreso",
      buildSourceHintText({
        tableLabel: `${resumenFile} (resumen mensual Ene-Dic)`,
        rows: ingresoRows,
        columns: ["Actual acumulado (actualYTD)"],
      })
    );
    setSourceHint(
      "ingreso-nacional",
      buildSourceHintText({
        tableLabel: `${resumenFile} (resumen mensual Ene-Dic)`,
        rows: ingresoNacionalRows,
        columns: ["Actual acumulado (actualYTD)"],
      })
    );
    setSourceHint(
      "operativo",
      buildSourceHintText({
        tableLabel: `${operativoFile} (tabla actual)`,
        rows: ["Filas visibles del modulo"],
        columns: operativoSeries,
      })
    );
    setSourceHint(
      "gastos-rendimientos",
      buildSourceHintText({
        tableLabel: `${gastosFile} (resumen mensual Ene-Dic)`,
        rows: ["Meses del ejercicio (Ene-Dic)"],
        columns: ggRendimientosSeries,
      })
    );
    setSourceHint(
      "gastos-plusvalia",
      buildSourceHintText({
        tableLabel: `${gastosFile} (resumen mensual Ene-Dic)`,
        rows: ["Meses del ejercicio (Ene-Dic)"],
        columns: ggPlusvaliaSeries,
      })
    );
  };

  const obtenerFilaIngreso = (layout = [], variants = []) => {
    if (!Array.isArray(layout) || !layout.length) return null;
    const candidates = Array.isArray(variants) ? variants : [variants];
    const normalized = candidates.map(normalizeLabel);
    return layout.find((row) => {
      const label = normalizeLabel(row?.label || "");
      return normalized.some((variant) => label.includes(variant));
    });
  };

  const buildIngresoPreviewData = async ({
    kind,
    config,
    defaults,
    context,
    chartType,
  }) => {
    const empresaId = context?.empresaId;
    const anio = context?.anio;
    const capitulo =
      kind === "ingresoNacional" ? "" : (context?.capitulo || "").trim();
    const ingresoConfig = config?.[kind] || defaults?.[kind] || {};
    if (ingresoConfig.enabled === false) return null;
    const ingresoSources =
      config?.sources?.[kind] || defaults?.sources?.[kind] || {};
    const datasetsConfig = Object.entries(ingresoConfig.series || {})
      .map(([key, serie]) => ({
        key,
        label: serie?.label || key,
        color: serie?.color || "#0d47a1",
        enabled: serie?.enabled !== false,
        variants: getSourceVariants(
          ingresoSources,
          key,
          defaults?.sources?.[kind] || {}
        ),
      }))
      .filter((serie) => serie.enabled && serie.variants.length);
    const fallbackSeries = Object.entries(ingresoConfig.series || {})
      .map(([key, serie]) => ({
        key,
        label: serie?.label || key,
        color: serie?.color || "#0d47a1",
        enabled: serie?.enabled !== false,
      }))
      .filter((serie) => serie.enabled);

    const buildSample = (seriesFallback = datasetsConfig) => {
      const seriesToUse = Array.isArray(seriesFallback) && seriesFallback.length
        ? seriesFallback
        : fallbackSeries;
      if (!seriesToUse.length) return null;
      const datasets = buildDatasetsFromList(seriesToUse, MONTH_LABELS, chartType);
      return datasets.length
        ? { chartType, labels: MONTH_LABELS, datasets }
        : null;
    };

    if (!empresaId || !anio) return buildSample(fallbackSeries);

    if (!datasetsConfig.length) return buildSample(fallbackSeries);

    const responses = await loadResumenMensual(empresaId, anio, capitulo);
    if (!responses || !responses.length) return buildSample();

    const series = datasetsConfig.reduce((acc, item) => {
      acc[item.key] = [];
      return acc;
    }, {});

    responses.forEach((data, idx) => {
      const layout = data?.resumen?.[0]?.layout || [];
      datasetsConfig.forEach((dataset) => {
        const row = obtenerFilaIngreso(layout, dataset.variants);
        const value = toNumber(row?.totals?.actualYTD);
        series[dataset.key][idx] = value;
      });
    });

    const isPie = isPieType(chartType);
    return {
      labels: MONTH_LABELS,
      datasets: datasetsConfig.map((dataset) => {
        const data = series[dataset.key] || [];
        const entry = {
          label: dataset.label,
          data,
          borderWidth: chartType === "line" ? 2 : 1,
        };
        if (isPie) {
          entry.backgroundColor = buildSlicePalette(data.length, dataset.color);
          entry.borderColor = "#ffffff";
          entry.borderWidth = 1;
          return entry;
        }
        entry.backgroundColor = dataset.color;
        entry.borderColor = dataset.color;
        if (chartType === "line") {
          entry.tension = 0.2;
          entry.fill = false;
          entry.pointRadius = 3;
          entry.pointHoverRadius = 4;
        } else if (chartType === "bar") {
          entry.borderRadius = 6;
          entry.maxBarThickness = 18;
        }
        return entry;
      }),
      chartType,
    };
  };

  const buildCustomMensualPreviewData = async ({
    rows,
    seriesList,
    context,
    chartType,
  }) => {
    const empresaId = context?.empresaId;
    const anio = context?.anio;
    if (!empresaId || !anio) return null;
    const capitulo = (context?.capitulo || "").trim();
    const customRows = Array.isArray(rows) ? rows : [];
    if (!customRows.length) return null;
    const activeSeries = (seriesList || []).filter(
      (serie) => serie?.enabled !== false
    );
    if (!activeSeries.length) return null;

    const responses = await loadResumenMensual(empresaId, anio, capitulo);
    if (!responses || !responses.length) return null;

    const seriesData = activeSeries.reduce((acc, serie) => {
      acc[serie.key] = Array.from({ length: MONTH_LABELS.length }, () => 0);
      return acc;
    }, {});

    responses.forEach((data, idx) => {
      const layout = data?.resumen?.[0]?.layout || [];
      if (!Array.isArray(layout) || !layout.length) return;
      customRows.forEach((row) => {
        const variants = Array.isArray(row?.variants)
          ? row.variants
          : Array.isArray(row?.labels)
          ? row.labels
          : row?.label
          ? [row.label]
          : row?.alias
          ? [row.alias]
          : [];
        if (!variants.length) return;
        const match = obtenerFilaIngreso(layout, variants);
        if (!match?.totals) return;
        activeSeries.forEach((serie) => {
          seriesData[serie.key][idx] += resolveSummarySeriesValue(
            match.totals || {},
            serie.key
          );
        });
      });
    });

    const isPie = isPieType(chartType);
    const datasets = activeSeries.map((serie, index) => {
      const data = seriesData[serie.key] || [];
      const dataset = {
        label: serie?.label || serie?.key || `Serie ${index + 1}`,
        data: isPie ? data : data.map((value) => ocultarCeros(value)),
        borderWidth: chartType === "line" ? 2 : 1,
      };
      if (isPie) {
        dataset.backgroundColor = buildSlicePalette(
          data.length,
          serie?.color || "#0d47a1"
        );
        dataset.borderColor = "#ffffff";
        dataset.borderWidth = 1;
        return dataset;
      }
      const color = serie?.color || "#0d47a1";
      dataset.backgroundColor = color;
      dataset.borderColor = color;
      if (chartType === "line") {
        dataset.fill = false;
        dataset.tension = 0.3;
        dataset.pointRadius = 3;
        dataset.pointHoverRadius = 4;
        dataset.pointBackgroundColor = color;
      } else {
        dataset.borderRadius = 4;
        dataset.maxBarThickness = 18;
      }
      return dataset;
    });

    const hasData = datasets.some((dataset) =>
      (dataset.data || []).some((value) => Number(value) !== 0 && value !== null)
    );
    if (!hasData) return buildSample();

    return {
      chartType,
      labels: MONTH_LABELS,
      datasets,
    };
  };

  const buildPreviewData = (definition, config, defaults, context) => {
    const baseType = config.chart?.type || "bar";
    const chartType = resolveChartType(definition.chartType, baseType);
    const snapshotMap = context?.snapshotMap;
    const capituloLabel = (context?.capitulo || "").toString().trim();
    const empresaId = context?.empresaId;
    const anio = context?.anio;
    const summarySeriesMap = new Map(
      (Array.isArray(config.series) && config.series.length
        ? config.series
        : defaults.series || []
      )
        .map((serie) => [String(serie?.key || "").trim(), serie])
        .filter(([key]) => Boolean(key))
    );
    const summarySeriesList = SUMMARY_TABLE_SERIES.map((base) => {
      const override = summarySeriesMap.get(base.key) || {};
      return {
        ...base,
        label:
          (typeof override.label === "string" && override.label.trim()
            ? override.label.trim()
            : null) || base.label,
        color:
          (typeof override.color === "string" && override.color.trim()
            ? override.color.trim()
            : null) || base.color,
        enabled:
          typeof override.enabled === "boolean"
            ? override.enabled
            : base.enabled !== false,
      };
    });
    const customModuleKey = normalizeModuleKey(
      definition?.module || getCurrentModuleValue() || "RESUMEN"
    );
    const customIsSummaryModule = isSummaryModuleKey(customModuleKey);
    const operativoSeriesList = listFromMap(
      config.operativo?.datasets || defaults.operativo?.datasets || {}
    ).map((dataset) => ({
      key: dataset.key,
      label: dataset.label || dataset.key || "",
      color: dataset.color || "#0d47a1",
      enabled: dataset.enabled !== false,
    }));
    const seriesList =
      Array.isArray(config.series) && config.series.length
        ? config.series
        : defaults.series || [];
    const customSeriesBase = customIsSummaryModule
      ? summarySeriesList
      : operativoSeriesList;
    const customSeriesList = filterSeriesByKeys(
      customSeriesBase,
      definition.seriesKeys
    );

    const pickLayoutFromResponses = (responses) => {
      if (!Array.isArray(responses) || responses.length === 0) return [];
      const preferredIdx = resolvePreviewMonthIndex();
      if (
        Number.isInteger(preferredIdx) &&
        responses[preferredIdx]?.resumen?.[0]?.layout?.length
      ) {
        return responses[preferredIdx].resumen[0].layout;
      }
      for (let i = responses.length - 1; i >= 0; i -= 1) {
        const layout = responses[i]?.resumen?.[0]?.layout;
        if (Array.isArray(layout) && layout.length) return layout;
      }
      return [];
    };

    if (definition.previewKind === "summary") {
      const summarySources =
        config.sources?.summary || defaults.sources?.summary || {};
      const rowsConfig = resolveSummaryRows(
        capituloLabel,
        summarySources,
        defaults.sources?.summary || {}
      );
      const rows =
        definition.chartKey === "net" ? rowsConfig.net : rowsConfig.operating;
      const samplePreview = () =>
        buildSampleSummaryPreview(rows, summarySeriesList, chartType, capituloLabel);
      if (snapshotMap) {
      const data = buildDatasetsFromSnapshot({
        rows,
        snapshotMap,
        seriesList,
        chartType,
        capituloLabel,
        looseMatch: true,
      });
        return data ? { chartType, ...data } : samplePreview();
      }
      if (!empresaId || !anio) return samplePreview();
      return loadResumenMensual(empresaId, anio, capituloLabel).then(
        (responses) => {
          const layout = pickLayoutFromResponses(responses);
          if (!layout.length) return samplePreview();
          const liveMap = buildSnapshotMapFromLayout(layout);
          if (!liveMap) return samplePreview();
          const data = buildDatasetsFromSnapshot({
            rows,
            snapshotMap: liveMap,
            seriesList,
            chartType,
            capituloLabel,
            looseMatch: true,
          });
          return data ? { chartType, ...data } : samplePreview();
        }
      );
    }
    if (definition.previewKind === "consolidated") {
      const consolidatedSources =
        config.sources?.consolidated || defaults.sources?.consolidated || {};
      const activeSeries = seriesList.filter(
        (serie) => serie?.enabled !== false
      );
      if (!activeSeries.length) return null;
      const labels = activeSeries.map((serie) => serie.label || serie.key);
      const operatingCfg =
        config.consolidatedSeries?.operating ||
        defaults.consolidatedSeries?.operating ||
        {};
      const netCfg =
        config.consolidatedSeries?.net ||
        defaults.consolidatedSeries?.net ||
        {};
      const buildConsolidatedDataset = (cfg, data) => {
        const color = cfg.color || "#0d47a1";
        const dataset = {
          label: cfg.label || "CONSOLIDATED",
          data,
          borderWidth: chartType === "line" ? 2 : 1,
        };
        if (isPieType(chartType)) {
          dataset.backgroundColor = buildSlicePalette(data.length, color);
          dataset.borderColor = "#ffffff";
          dataset.borderWidth = 1;
          return dataset;
        }
        dataset.backgroundColor = color;
        dataset.borderColor = color;
        if (chartType === "line") {
          dataset.fill = false;
          dataset.tension = 0.3;
          dataset.pointRadius = 3;
          dataset.pointHoverRadius = 4;
          dataset.pointBackgroundColor = color;
        } else {
          dataset.borderRadius = 4;
          dataset.maxBarThickness = 18;
        }
        return dataset;
      };
      const buildSample = () => {
        if (!labels.length) return null;
        const opData = buildSampleValues(labels.length, 150, 12);
        const netData = buildSampleValues(labels.length, 110, 9);
        return {
          chartType,
          labels,
          datasets: [
            buildConsolidatedDataset(
              {
                label:
                  operatingCfg.label || "CONSOLIDATED OPERATING RESULTS",
                color: operatingCfg.color || "#0d47a1",
              },
              opData
            ),
            buildConsolidatedDataset(
              {
                label: netCfg.label || "CONSOLIDATED NET RESULTS",
                color: netCfg.color || "#94a3b8",
              },
              netData
            ),
          ],
        };
      };
      const resolveTotals = (map) => {
        const opTotals = getRowTotalsLoose(
          map,
          getConsolidatedVariants(
            consolidatedSources,
            "operating",
            defaults.sources?.consolidated || {}
          )
        );
        const netTotals = getRowTotalsLoose(
          map,
          getConsolidatedVariants(
            consolidatedSources,
            "net",
            defaults.sources?.consolidated || {}
          )
        );
        const opData = activeSeries.map((serie) =>
          toNumber(opTotals?.[serie.key])
        );
        const netData = activeSeries.map((serie) =>
          toNumber(netTotals?.[serie.key])
        );
        return {
          chartType,
          labels,
          datasets: [
            buildConsolidatedDataset(
              {
                label:
                  operatingCfg.label || "CONSOLIDATED OPERATING RESULTS",
                color: operatingCfg.color || "#0d47a1",
              },
              opData
            ),
            buildConsolidatedDataset(
              {
                label: netCfg.label || "CONSOLIDATED NET RESULTS",
                color: netCfg.color || "#94a3b8",
              },
              netData
            ),
          ],
        };
      };
      if (snapshotMap) {
        return resolveTotals(snapshotMap);
      }
      if (!empresaId || !anio) return buildSample();
      return loadResumenMensual(empresaId, anio, capituloLabel).then(
        (responses) => {
          const layout = pickLayoutFromResponses(responses);
          if (!layout.length) return buildSample();
          const liveMap = buildSnapshotMapFromLayout(layout);
          if (!liveMap) return buildSample();
          return resolveTotals(liveMap);
        }
      );
    }
    if (definition.previewKind === "ingreso") {
      return buildIngresoPreviewData({
        kind: "ingreso",
        config,
        defaults,
        context,
        chartType,
      });
    }
    if (definition.previewKind === "ingreso-nacional") {
      return buildIngresoPreviewData({
        kind: "ingresoNacional",
        config,
        defaults,
        context,
        chartType,
      });
    }
    if (definition.previewKind === "operativo") {
      const labels = ["Fila 1", "Fila 2", "Fila 3"];
      const datasets = buildDatasetsFromList(
        operativoSeriesList,
        labels,
        chartType
      );
      return datasets.length ? { chartType, labels, datasets } : null;
    }
    if (definition.previewKind === "gastos") {
      const ggCharts =
        config.gastosGenerales?.charts || defaults.gastosGenerales?.charts || {};
      const chartKey = definition.chartKey || "rendimientos";
      const chartCfg = ggCharts?.[chartKey] || {};
      const seriesList = listFromMap(chartCfg.series || {}).map((serie) => ({
        key: serie.key,
        label: serie.label || serie.key,
        color: serie.color || "#0d47a1",
        enabled: serie.enabled !== false,
      }));
      const datasets = buildDatasetsFromList(
        seriesList,
        MONTH_LABELS,
        chartType
      );
      return datasets.length
        ? { chartType, labels: MONTH_LABELS, datasets }
        : null;
    }
    if (definition.previewKind === "custom") {
      const rows = Array.isArray(definition.rows) ? definition.rows : [];
      const samplePreview = () =>
        buildCustomSamplePreview(rows, customSeriesList, chartType, capituloLabel);
      if (!customIsSummaryModule) return samplePreview();
      const sourceType = (definition.sourceType || "snapshot").toString().toLowerCase();
      if (sourceType === "mensual") {
        return buildCustomMensualPreviewData({
          rows,
          seriesList: customSeriesList,
          context,
          chartType,
        }).then((data) => data || samplePreview());
      }
      const buildFromMap = (map) => {
        if (!map) return null;
        const data = buildDatasetsFromSnapshot({
          rows,
          snapshotMap: map,
          seriesList: customSeriesList,
          chartType,
          capituloLabel,
          looseMatch: true,
        });
        return data ? { chartType, ...data } : null;
      };
      if (snapshotMap) {
        return buildFromMap(snapshotMap) || samplePreview();
      }
      if (!empresaId || !anio) return samplePreview();
      return loadResumenMensual(empresaId, anio, capituloLabel).then(
        (responses) => {
          const layout = pickLayoutFromResponses(responses);
          if (!layout.length) return samplePreview();
          const liveMap = buildSnapshotMapFromLayout(layout);
          return buildFromMap(liveMap) || samplePreview();
        }
      );
    }
    return null;
  };

  const renderPreviewFallback = (container, message) => {
    if (!container) return;
    const existingCanvas = container.querySelector("canvas");
    container.innerHTML = "";
    if (existingCanvas) {
      existingCanvas.classList.add("d-none");
      container.appendChild(existingCanvas);
    }
    const text = document.createElement("div");
    text.className = "text-muted small text-center p-3 preview-fallback";
    text.textContent = message || "Vista previa no disponible.";
    container.appendChild(text);
  };

  const renderMiniPreview = (canvas, previewData) => {
    if (!canvas || !previewData) return false;
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width || 240));
    const height = Math.max(1, Math.floor(rect.height || 120));
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);

    const labels = Array.isArray(previewData.labels) ? previewData.labels : [];
    const datasets = Array.isArray(previewData.datasets) ? previewData.datasets : [];
    if (!labels.length || !datasets.length) return false;

    const chartType = normalizeChartType(previewData.chartType, "bar");
    const primary = datasets[0] || {};
    const values = Array.isArray(primary.data) ? primary.data : [];
    const numericValues = values.map((value) =>
      Number.isFinite(Number(value)) ? Number(value) : 0
    );
    const maxValue = Math.max(1, ...numericValues);
    const padding = 10;
    const usableWidth = width - padding * 2;
    const usableHeight = height - padding * 2;

    const pickColor = (dataset, index) => {
      if (Array.isArray(dataset?.backgroundColor)) {
        return dataset.backgroundColor[index % dataset.backgroundColor.length];
      }
      return dataset?.backgroundColor || dataset?.borderColor || "#3b82f6";
    };

    if (chartType === "line") {
      ctx.strokeStyle = pickColor(primary, 0);
      ctx.lineWidth = 2;
      ctx.beginPath();
      numericValues.forEach((value, idx) => {
        const x = padding + (usableWidth / Math.max(1, labels.length - 1)) * idx;
        const y =
          height - padding - (value / maxValue) * Math.max(1, usableHeight);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      return true;
    }

    if (chartType === "pie" || chartType === "doughnut") {
      const total = numericValues.reduce((acc, value) => acc + value, 0) || 1;
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(usableWidth, usableHeight) / 2;
      let startAngle = -Math.PI / 2;
      numericValues.forEach((value, idx) => {
        const slice = (value / total) * Math.PI * 2;
        ctx.fillStyle = pickColor(primary, idx);
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, startAngle + slice);
        ctx.closePath();
        ctx.fill();
        startAngle += slice;
      });
      if (chartType === "doughnut") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      }
      return true;
    }

    const barWidth = usableWidth / Math.max(1, labels.length);
    numericValues.forEach((value, idx) => {
      const barHeight = (value / maxValue) * Math.max(1, usableHeight);
      const x = padding + idx * barWidth;
      const y = height - padding - barHeight;
      ctx.fillStyle = pickColor(primary, idx);
      ctx.fillRect(x + 2, y, Math.max(2, barWidth - 4), barHeight);
    });
    return true;
  };

  const renderPreviewChart = (chartId, preview, canvas, previewData) => {
    if (
      !previewData ||
      !canvas ||
      !preview ||
      !Array.isArray(previewData.datasets) ||
      previewData.datasets.length === 0
    ) {
      renderPreviewFallback(preview, "Sin datos.");
      return;
    }
    if (!window.Chart) {
      if (preview && canvas && !preview.contains(canvas)) {
        preview.innerHTML = "";
        preview.appendChild(canvas);
      }
      preview
        ?.querySelectorAll?.(".preview-fallback")
        ?.forEach?.((node) => node.remove());
      canvas?.classList?.remove?.("d-none");
      if (!renderMiniPreview(canvas, previewData)) {
        renderPreviewFallback(preview, "Chart.js no disponible.");
      }
      return;
    }
    if (typeof canvas.getContext !== "function") {
      renderPreviewFallback(preview, "Vista previa no disponible.");
      return;
    }
    if (!canvas.ownerDocument?.defaultView?.getComputedStyle) {
      if (!renderMiniPreview(canvas, previewData)) {
        renderPreviewFallback(preview, "Vista previa no disponible.");
      }
      return;
    }
    const resolvedType = normalizeChartType(previewData.chartType, "bar");
    const chartType = resolvedType === "inherit" ? "bar" : resolvedType;
    const labels = Array.isArray(previewData.labels)
      ? previewData.labels.filter((label) => label != null && label !== "")
      : [];
    if (!labels.length) {
      renderPreviewFallback(preview, "Sin datos.");
      return;
    }
    const datasets = previewData.datasets.map((dataset) => {
      const data = Array.isArray(dataset?.data) ? dataset.data : [];
      const normalized = data.map((value) =>
        Number.isFinite(Number(value)) ? Number(value) : 0
      );
      const padded =
        labels.length && normalized.length !== labels.length
          ? normalized
              .slice(0, labels.length)
              .concat(
                Array.from(
                  { length: Math.max(0, labels.length - normalized.length) },
                  () => 0
                )
              )
          : normalized;
      return {
        ...dataset,
        data: padded,
      };
    });
    if (preview && canvas) {
      if (!preview.contains(canvas)) {
        preview.innerHTML = "";
        preview.appendChild(canvas);
      }
      preview
        .querySelectorAll(".preview-fallback")
        .forEach((node) => node.remove());
      canvas.classList.remove("d-none");
    }

    const current = galleryState.previews.get(chartId);
    if (current) {
      current.destroy();
    }
    try {
      const chart = new window.Chart(canvas, {
        type: chartType,
        data: {
          labels,
          datasets,
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false },
          },
          scales: {
            x: { display: false },
            y: { display: false },
          },
        },
      });
      galleryState.previews.set(chartId, chart);
    } catch (chartError) {
      console.warn(
        "plantillas-graficas: Error al renderizar preview",
        chartId,
        chartError
      );
      if (!renderMiniPreview(canvas, previewData)) {
        renderPreviewFallback(preview, "Sin datos.");
      }
    }
  };

  const getPreviewFallbackMessage = (definition, context) => {
    if (definition.previewKind === "operativo" || definition.previewKind === "gastos") {
      return "Activa al menos una serie para ver la vista previa.";
    }
    if (definition.previewKind === "custom") {
      const chartModule = normalizeModuleKey(definition.module || "RESUMEN");
      if (!isSummaryModuleKey(chartModule)) {
        return "Agrega filas y columnas para ver la vista previa.";
      }
    }
    if (
      (definition.previewKind === "ingreso" ||
        definition.previewKind === "ingreso-nacional") &&
      (!context?.empresaId || !context?.anio)
    ) {
      return "Selecciona empresa y ano para ver datos.";
    }
    if (
      (definition.previewKind === "summary" ||
        definition.previewKind === "consolidated") &&
      !context?.snapshotMap &&
      (!context?.empresaId || !context?.anio)
    ) {
      return "Selecciona empresa y ano para ver datos.";
    }
    const isCustomMensual =
      definition.previewKind === "custom" &&
      (definition.sourceType || "").toString().toLowerCase() === "mensual";
    if (isCustomMensual && (!context?.empresaId || !context?.anio)) {
      return "Selecciona empresa y ano para ver datos.";
    }
    const isCustomSnapshot =
      definition.previewKind === "custom" && !isCustomMensual;
    if (
      isCustomSnapshot &&
      !context?.snapshotMap &&
      (!context?.empresaId || !context?.anio)
    ) {
      return "Selecciona empresa y ano para ver datos.";
    }
    if (!context?.snapshotMap && !isCustomMensual) {
      return "Sin snapshot de RESUMEN.";
    }
    return "Sin datos.";
  };

  const resolveViewLabel = (definition) =>
    definition?.viewLabel || definition?.category || "Vista";

  const filterDefinitionsByCapitulo = (definitions, context) => {
    const list = Array.isArray(definitions) ? definitions : [];
    if (!list.length) return [];

    const moduleKey = getCurrentModuleKey();
    const isSummaryModule = isSummaryModuleKey(moduleKey);
    const isGastosModule = moduleKey === "GASTOSGENERALES";
    const capituloRaw = (context?.capitulo || "").toString().trim();
    const allowCdmxOnlyCharts = capituloRaw
      ? isCdmxCapitulo(capituloRaw)
      : true;

    return list.filter((definition) => {
      if (!definition) return false;
      const kind = definition.previewKind || "";
      const isGlobalKind =
        kind === "summary" ||
        kind === "consolidated" ||
        kind === "ingreso" ||
        kind === "ingreso-nacional";
      const allowGlobal =
        isGlobalKind &&
        (kind !== "consolidated" && kind !== "ingreso-nacional"
          ? true
          : allowCdmxOnlyCharts);

      if (kind === "custom") {
        return true;
      }

      if (isSummaryModule) {
        if (kind === "summary" || kind === "ingreso") return true;
        if (kind === "consolidated" || kind === "ingreso-nacional") {
          return allowCdmxOnlyCharts;
        }
        return false;
      }

      if (isGastosModule) {
        return kind === "gastos" || allowGlobal;
      }

      return kind === "operativo" || allowGlobal;
    });
  };

  const buildCardDefinitions = (config) => {
    const baseType = config.chart?.type || "bar";
    const defaults = clone(getGraficasConfigApi()?.defaults || {});
    const baseSources = defaults.sources || {};
    const sources = config.sources || baseSources || {};
    const summarySources = sources.summary || baseSources.summary || {};
    const consolidatedSources =
      sources.consolidated || baseSources.consolidated || {};
    const ingresoSources = sources.ingreso || baseSources.ingreso || {};
    const ingresoNacionalSources =
      sources.ingresoNacional || baseSources.ingresoNacional || {};
    const ingresoSourceLabels = collectVariantsFromSourceMap(ingresoSources);
    const ingresoNacionalSourceLabels = collectVariantsFromSourceMap(
      ingresoNacionalSources
    );
    const selectedCapitulo = getSelectedCapitulo();
    const resumenFile = resolveModuleFileName("RESUMEN");
    const operativoFile = resolveModuleFileName(getCurrentModuleValue() || "RESUMEN");
    const gastosFile = resolveModuleFileName("Gastos Generales");
    const summaryRowsConfig = resolveSummaryRows(
      selectedCapitulo,
      summarySources,
      baseSources.summary || {}
    );
    const summarySourceKey = summaryRowsConfig.sourceKey || "generic";
    const summarySeriesMap = new Map(
      (Array.isArray(config.series) && config.series.length
        ? config.series
        : defaults.series || []
      )
        .map((serie) => [String(serie?.key || "").trim(), serie])
        .filter(([key]) => Boolean(key))
    );
    const summarySeriesList = SUMMARY_TABLE_SERIES.map((base) => {
      const override = summarySeriesMap.get(base.key) || {};
      return {
        ...base,
        label:
          (typeof override.label === "string" && override.label.trim()
            ? override.label.trim()
            : null) || base.label,
        color:
          (typeof override.color === "string" && override.color.trim()
            ? override.color.trim()
            : null) || base.color,
        enabled:
          typeof override.enabled === "boolean"
            ? override.enabled
            : base.enabled !== false,
      };
    });
    const summaryColumns = summarySeriesList
      .filter((serie) => serie?.enabled !== false)
      .map((serie) => formatKeyLabel(serie?.key, serie?.label))
      .filter(Boolean);
    const summaryOperatingRows = (summaryRowsConfig.operating || []).map((row) =>
      resolveRowLabel(row, selectedCapitulo || "")
    );
    const summaryNetRows = (summaryRowsConfig.net || []).map((row) =>
      resolveRowLabel(row, selectedCapitulo || "")
    );
    const consolidatedRows = uniqueList([
      ...getConsolidatedVariants(
        consolidatedSources,
        "operating",
        baseSources.consolidated || {}
      ),
      ...getConsolidatedVariants(
        consolidatedSources,
        "net",
        baseSources.consolidated || {}
      ),
    ]);
    const ingresoColumns = ["Actual acumulado (actualYTD)"];
    const ingresoNacionalColumns = ["Actual acumulado (actualYTD)"];
    const operativoDatasets = config.operativo?.datasets || {};
    const operativoColumns = Object.keys(operativoDatasets)
      .map((key) => ({ key, ...(operativoDatasets[key] || {}) }))
      .filter((dataset) => dataset.enabled !== false)
      .map((dataset) => formatKeyLabel(dataset.key, dataset.label))
      .filter(Boolean);
    const gastosRendimientosSeries =
      config.gastosGenerales?.charts?.rendimientos?.series || {};
    const gastosPlusvaliaSeries =
      config.gastosGenerales?.charts?.plusvalia?.series || {};
    const gastosRendimientosColumns = Object.keys(gastosRendimientosSeries)
      .map((key) => ({ key, ...(gastosRendimientosSeries[key] || {}) }))
      .filter((serie) => serie.enabled !== false)
      .map((serie) => formatKeyLabel(serie.key, serie.label))
      .filter(Boolean);
    const gastosPlusvaliaColumns = Object.keys(gastosPlusvaliaSeries)
      .map((key) => ({ key, ...(gastosPlusvaliaSeries[key] || {}) }))
      .filter((serie) => serie.enabled !== false)
      .map((serie) => formatKeyLabel(serie.key, serie.label))
      .filter(Boolean);
    const summaryOperatingInfo = buildRowsColumnsInfo({
      moduleValue: "RESUMEN",
      rows: summaryOperatingRows,
      columns: summaryColumns,
      tableLabel: `${resumenFile} (tabla actual)`,
    });
    const summaryNetInfo = buildRowsColumnsInfo({
      moduleValue: "RESUMEN",
      rows: summaryNetRows,
      columns: summaryColumns,
      tableLabel: `${resumenFile} (tabla actual)`,
    });
    const consolidatedInfo = buildRowsColumnsInfo({
      moduleValue: "RESUMEN",
      rows: consolidatedRows,
      columns: summaryColumns,
      tableLabel: `${resumenFile} (tabla actual)`,
    });
    const ingresoInfo = buildRowsColumnsInfo({
      moduleValue: "RESUMEN",
      rows: ingresoSourceLabels,
      columns: ingresoColumns,
      tableLabel: `${resumenFile} (resumen mensual Ene-Dic)`,
    });
    const ingresoNacionalInfo = buildRowsColumnsInfo({
      moduleValue: "RESUMEN",
      rows: ingresoNacionalSourceLabels,
      columns: ingresoNacionalColumns,
      tableLabel: `${resumenFile} (resumen mensual Ene-Dic)`,
    });
    const operativoInfo = buildRowsColumnsInfo({
      moduleValue: getCurrentModuleValue() || "RESUMEN",
      rows: ["Filas visibles del modulo"],
      columns: operativoColumns,
      tableLabel: `${operativoFile} (tabla actual)`,
    });
    const ggRendimientosInfo = buildRowsColumnsInfo({
      moduleValue: "Gastos Generales",
      rows: ["Meses del ejercicio (Ene-Dic)"],
      columns: gastosRendimientosColumns,
      tableLabel: `${gastosFile} (resumen mensual Ene-Dic)`,
    });
    const ggPlusvaliaInfo = buildRowsColumnsInfo({
      moduleValue: "Gastos Generales",
      rows: ["Meses del ejercicio (Ene-Dic)"],
      columns: gastosPlusvaliaColumns,
      tableLabel: `${gastosFile} (resumen mensual Ene-Dic)`,
    });
    const enabledSummarySeries = summarySeriesList.filter(
      (serie) => serie?.enabled !== false
    );
    const enabledOperativoSeries = Object.keys(operativoDatasets)
      .map((key) => ({ key, ...(operativoDatasets[key] || {}) }))
      .filter((dataset) => dataset.enabled !== false);
    const resolveCustomColumns = (
      moduleValue,
      seriesKeys = [],
      seriesOverrides = []
    ) => {
      const moduleKey = normalizeModuleKey(moduleValue || "RESUMEN");
      const baseSeries = isSummaryModuleKey(moduleKey)
        ? enabledSummarySeries
        : enabledOperativoSeries;
      const overrideMap = new Map(
        (Array.isArray(seriesOverrides) ? seriesOverrides : [])
          .map((item) => {
            const key = (item?.key || "").toString().trim();
            if (!key) return null;
            return [key, item];
          })
          .filter(Boolean)
      );
      return filterSeriesByKeys(baseSeries, seriesKeys).map((serie) => {
        const override = overrideMap.get((serie?.key || "").toString().trim());
        if (typeof override?.label === "string" && override.label.trim()) {
          return override.label.trim();
        }
        return serie?.label || serie?.key;
      });
    };
    const defs = [];
    defs.push(
      {
        id: "summary-operating",
        title:
          config.charts?.operating?.title || "Resultado Operativo por Capitulo",
        subtitle: config.charts?.operating?.subtitle || "",
        module: "RESUMEN",
        category: "Resumen",
        viewLabel: "Resumen",
        chartType: resolveChartType(
          config.charts?.operating?.chartType,
          baseType
        ),
        enabled: config.charts?.operating?.enabled !== false,
        previewKind: "summary",
        chartKey: "operating",
        summarySourceKey,
        summaryType: "operating",
        ...summaryOperatingInfo,
        target: {
          collapseId: "plantillasGraficasResumenCollapse",
          focusSelector: '[data-chart-key="operating"]',
        },
      },
      {
        id: "summary-net",
        title: config.charts?.net?.title || "Resumen Neto por Capitulo",
        subtitle: config.charts?.net?.subtitle || "",
        module: "RESUMEN",
        category: "Resumen",
        viewLabel: "Resumen",
        chartType: resolveChartType(config.charts?.net?.chartType, baseType),
        enabled: config.charts?.net?.enabled !== false,
        previewKind: "summary",
        chartKey: "net",
        summarySourceKey,
        summaryType: "net",
        ...summaryNetInfo,
        target: {
          collapseId: "plantillasGraficasResumenCollapse",
          focusSelector: '[data-chart-key="net"]',
        },
      },
      {
        id: "summary-consolidated",
        title:
          config.charts?.consolidated?.title ||
          "Consolidados Operativos vs Netos",
        subtitle: config.charts?.consolidated?.subtitle || "",
        module: "RESUMEN",
        category: "Resumen",
        viewLabel: "Resumen",
        chartType: resolveChartType(
          config.charts?.consolidated?.chartType,
          baseType
        ),
        enabled: config.charts?.consolidated?.enabled !== false,
        previewKind: "consolidated",
        chartKey: "consolidated",
        ...consolidatedInfo,
        target: {
          collapseId: "plantillasGraficasResumenCollapse",
          focusSelector: '[data-chart-key="consolidated"]',
        },
      },
      {
        id: "ingreso-capitulo",
        title: config.ingreso?.title || "Ingreso por capitulo",
        subtitle: config.ingreso?.subtitle || "",
        module: "RESUMEN",
        category: "Ingreso",
        viewLabel: "Ingreso",
        chartType: resolveChartType(config.ingreso?.chartType, baseType),
        enabled: config.ingreso?.enabled !== false,
        previewKind: "ingreso",
        ...ingresoInfo,
        target: {
          collapseId: "plantillasGraficasIngresoCollapse",
          focusSelector: "[data-ingreso-title]",
        },
      },
      {
        id: "ingreso-nacional",
        title: config.ingresoNacional?.title || "Ingreso nacional",
        subtitle: config.ingresoNacional?.subtitle || "",
        module: "RESUMEN",
        category: "Ingreso",
        viewLabel: "Ingreso nacional",
        chartType: resolveChartType(
          config.ingresoNacional?.chartType,
          baseType
        ),
        enabled: config.ingresoNacional?.enabled !== false,
        previewKind: "ingreso-nacional",
        ...ingresoNacionalInfo,
        target: {
          collapseId: "plantillasGraficasIngresoNacionalCollapse",
          focusSelector: "[data-ingreso-nacional-title]",
        },
      },
      {
        id: "operativo-panel",
        title: config.operativo?.title || "Operativo",
        subtitle: "Panel operativo",
        module: getCurrentModuleValue() || "RESUMEN",
        category: "Operativo",
        viewLabel: "Operativo",
        chartType: resolveChartType(config.operativo?.chartType, baseType),
        enabled: config.operativo?.enabled !== false,
        previewKind: "operativo",
        ...operativoInfo,
        target: {
          collapseId: "plantillasGraficasOperativoCollapse",
          focusSelector: "[data-operativo-title]",
        },
      },
      {
        id: "gg-rendimientos",
        title:
          config.gastosGenerales?.charts?.rendimientos?.title || "Rendimientos",
        subtitle: "Gastos Generales",
        module: "Gastos Generales",
        category: "Gastos Generales",
        viewLabel: "Gastos Generales",
        chartType: resolveChartType(
          config.gastosGenerales?.charts?.rendimientos?.chartType,
          baseType
        ),
        enabled:
          config.gastosGenerales?.enabled !== false &&
          config.gastosGenerales?.charts?.rendimientos?.enabled !== false,
        previewKind: "gastos",
        chartKey: "rendimientos",
        ...ggRendimientosInfo,
        target: {
          collapseId: "plantillasGraficasGastosCollapse",
          focusSelector: '[data-gg-chart-key="rendimientos"]',
        },
      },
      {
        id: "gg-plusvalia",
        title:
          config.gastosGenerales?.charts?.plusvalia?.title || "Plusvalia",
        subtitle: "Gastos Generales",
        module: "Gastos Generales",
        category: "Gastos Generales",
        viewLabel: "Gastos Generales",
        chartType: resolveChartType(
          config.gastosGenerales?.charts?.plusvalia?.chartType,
          baseType
        ),
        enabled:
          config.gastosGenerales?.enabled !== false &&
          config.gastosGenerales?.charts?.plusvalia?.enabled !== false,
        previewKind: "gastos",
        chartKey: "plusvalia",
        ...ggPlusvaliaInfo,
        target: {
          collapseId: "plantillasGraficasGastosCollapse",
          focusSelector: '[data-gg-chart-key="plusvalia"]',
        },
      },
    );

    const customCharts = Array.isArray(config.customCharts)
      ? config.customCharts
      : [];
    customCharts.forEach((chart, index) => {
      const chartType = resolveChartType(chart?.chartType, baseType);
      const rowLabels = getCustomRowLabels(
        Array.isArray(chart?.rows) ? chart.rows : []
      );
      const rawId =
        typeof chart?.id === "string" && chart.id.trim()
          ? chart.id.trim()
          : `custom-${index + 1}`;
      const rawModule =
        typeof chart?.module === "string" && chart.module.trim()
          ? chart.module.trim()
          : "RESUMEN";
      const normalizedModule = normalizeModuleValue(rawModule, "RESUMEN");
      const customModuleKey = normalizeModuleKey(normalizedModule, "RESUMEN");
      const isCustomSummary = isSummaryModuleKey(customModuleKey);
      const customSourceType = (chart?.sourceType || "snapshot")
        .toString()
        .toLowerCase();
      const customTableLabel = isCustomSummary
        ? `${resolveModuleFileName("RESUMEN")} (${
            customSourceType === "mensual"
              ? "resumen mensual Ene-Dic"
              : "tabla actual"
          })`
        : `${resolveModuleFileName(normalizedModule)} (tabla actual)`;
      const customColumns = resolveCustomColumns(
        normalizedModule,
        Array.isArray(chart?.seriesKeys) ? chart.seriesKeys : [],
        Array.isArray(chart?.series) ? chart.series : []
      );
      const customInfo = buildRowsColumnsInfo({
        moduleValue: normalizedModule,
        rows: rowLabels,
        columns: customColumns,
        tableLabel: customTableLabel,
      });
      defs.push({
        id: rawId,
        chartId: rawId,
        module: normalizedModule,
        title: chart?.title || `Grafica personalizada ${index + 1}`,
        subtitle: chart?.subtitle || "",
        category: `Personalizada (${normalizedModule})`,
        viewLabel: `Personalizada (${normalizedModule})`,
        chartType,
        enabled: chart?.enabled !== false,
        previewKind: "custom",
        sourceType: chart?.sourceType || "snapshot",
        seriesKeys: Array.isArray(chart?.seriesKeys) ? chart.seriesKeys : [],
        series: Array.isArray(chart?.series) ? chart.series : [],
        rows: Array.isArray(chart?.rows) ? chart.rows : [],
        ...customInfo,
        target: {
          collapseId: "plantillasGraficasCustomCollapse",
          focusSelector: `[data-custom-chart][data-custom-id="${rawId}"]`,
        },
      });
    });

    const deletedIds = new Set(
      normalizeDeletedChartIds(config?.deletedChartIds || [])
    );
    return defs.filter((definition) => {
      const defId = canonicalizeChartId(definition?.chartId || definition?.id);
      if (!defId) return true;
      const isCustom =
        definition?.previewKind === "custom" || defId.startsWith("custom-");
      if (!isCustom) return true;
      return !deletedIds.has(defId);
    });
  };

  const openCustomEditorForDefinition = (definition) => {
    if (!definition) return false;
    if (typeof window.openChartEditor !== "function") {
      openConfigSection(definition);
      return false;
    }
    const chartData = {
      id: definition.chartId || definition.id,
      module: definition.module || "RESUMEN",
      title: definition.title,
      subtitle: definition.subtitle,
      chartType: definition.chartType,
      enabled: definition.enabled,
      sourceType: definition.sourceType || "snapshot",
      seriesKeys: Array.isArray(definition.seriesKeys) ? definition.seriesKeys : [],
      series: Array.isArray(definition.series) ? definition.series : [],
      rows: definition.rows || [],
    };
    window.openChartEditor(definition.chartId || definition.id, chartData);
    return true;
  };

  const getDetailSeriesKey = (definition, seriesSelect, fallback = "") => {
    if (!definition) return "";
    const stored = detailState.seriesByChart.get(definition.id);
    if (seriesSelect?.value) return seriesSelect.value;
    if (stored) return stored;
    return fallback;
  };

  const updateDetailSelects = (definition) => {
    if (!detailCard) return;
    const rowsSelect = detailCard.querySelector("[data-detail-rows-select]");
    const columnsSelect = detailCard.querySelector("[data-detail-columns-select]");
    const seriesSelect = detailCard.querySelector("[data-detail-series-select]");
    const seriesLabel = detailCard.querySelector("[data-detail-series-label]");
    if (!rowsSelect || !columnsSelect) return;

    detailUpdating = true;

    if (!definition) {
      if (seriesSelect) seriesSelect.classList.add("d-none");
      if (seriesLabel) seriesLabel.classList.add("d-none");
      setSelectOptions(rowsSelect, [], []);
      setSelectOptions(columnsSelect, [], []);
      detailUpdating = false;
      return;
    }

    const api = getGraficasConfigApi();
    const defaults = clone(api?.defaults || {});
    const config = readConfigFromForm();
    const kind = definition.previewKind || "";

    let seriesOptions = [];
    let seriesKey = "";
    const showSeries =
      kind === "ingreso" ||
      kind === "ingreso-nacional" ||
      kind === "consolidated";

    if (kind === "ingreso") {
      seriesOptions = Object.entries(config.ingreso?.series || {}).map(
        ([key, serie]) => ({
          value: key,
          label: formatKeyLabel(key, serie?.label),
        })
      );
    } else if (kind === "ingreso-nacional") {
      seriesOptions = Object.entries(config.ingresoNacional?.series || {}).map(
        ([key, serie]) => ({
          value: key,
          label: formatKeyLabel(key, serie?.label),
        })
      );
    } else if (kind === "consolidated") {
      seriesOptions = [
        { value: "operating", label: "Operativo" },
        { value: "net", label: "Neto" },
      ];
    }

    if (showSeries) {
      const stored = detailState.seriesByChart.get(definition.id);
      const candidate = stored && seriesOptions.some((opt) => opt.value === stored)
        ? stored
        : seriesOptions[0]?.value || "";
      seriesKey = candidate;
      detailState.seriesByChart.set(definition.id, candidate);
      if (seriesSelect) {
        seriesSelect.classList.remove("d-none");
        setSelectOptions(seriesSelect, seriesOptions, [candidate], {
          placeholder: "Sin series",
        });
      }
      if (seriesLabel) seriesLabel.classList.remove("d-none");
    } else {
      if (seriesSelect) seriesSelect.classList.add("d-none");
      if (seriesLabel) seriesLabel.classList.add("d-none");
    }

    const summarySources =
      config.sources?.summary || defaults.sources?.summary || {};
    const consolidatedSources =
      config.sources?.consolidated || defaults.sources?.consolidated || {};
    const ingresoSources = config.sources?.ingreso || defaults.sources?.ingreso || {};
    const ingresoNacionalSources =
      config.sources?.ingresoNacional || defaults.sources?.ingresoNacional || {};

    let rowOptions = [];
    let rowSelected = [];
    let rowsDisabled = false;
    if (kind === "summary") {
      rowOptions = getModuleRowOptions("RESUMEN");
      const summaryKey = definition.summarySourceKey || "generic";
      const summaryType =
        definition.summaryType || definition.chartKey || "operating";
      rowSelected = getSummarySourceVariants(
        summarySources,
        summaryKey,
        summaryType
      );
    } else if (kind === "consolidated") {
      rowOptions = getModuleRowOptions("RESUMEN");
      rowSelected = getConsolidatedVariants(
        consolidatedSources,
        seriesKey || "operating",
        defaults.sources?.consolidated || {}
      );
    } else if (kind === "ingreso") {
      rowOptions = getModuleRowOptions("RESUMEN");
      rowSelected = getSourceVariants(
        ingresoSources,
        seriesKey,
        defaults.sources?.ingreso || {}
      );
    } else if (kind === "ingreso-nacional") {
      rowOptions = getModuleRowOptions("RESUMEN");
      rowSelected = getSourceVariants(
        ingresoNacionalSources,
        seriesKey,
        defaults.sources?.ingresoNacional || {}
      );
    } else if (kind === "gastos") {
      rowOptions = MONTH_LABELS.slice();
      rowSelected = MONTH_LABELS.slice();
      rowsDisabled = true;
    } else if (kind === "operativo") {
      rowOptions = getModuleRowOptions(getCurrentModuleValue());
      rowSelected = rowOptions.slice();
      rowsDisabled = true;
    } else if (kind === "custom") {
      rowOptions = getModuleRowOptions(definition.module || "RESUMEN");
      rowSelected = getCustomRowLabels(definition.rows || []);
    } else {
      rowOptions = definition.rowList || [];
      rowSelected = definition.rowList || [];
    }
    setSelectOptions(rowsSelect, rowOptions, rowSelected, {
      placeholder: "Sin filas",
      disabled: rowsDisabled,
    });

    let columnOptions = [];
    let columnSelected = [];
    let columnsDisabled = false;
    if (kind === "summary" || kind === "consolidated") {
      const seriesList = buildSummarySeriesList(config, defaults);
      columnOptions = seriesList.map((serie) => ({
        value: serie.key,
        label: formatKeyLabel(serie.key, serie.label),
      }));
      columnSelected = seriesList
        .filter((serie) => serie.enabled !== false)
        .map((serie) => serie.key);
    } else if (kind === "operativo") {
      const seriesList = buildOperativoSeriesList(config, defaults);
      columnOptions = seriesList.map((serie) => ({
        value: serie.key,
        label: formatKeyLabel(serie.key, serie.label),
      }));
      columnSelected = seriesList
        .filter((serie) => serie.enabled !== false)
        .map((serie) => serie.key);
    } else if (kind === "gastos") {
      const seriesList = buildGastosSeriesList(
        config,
        defaults,
        definition.chartKey || "rendimientos"
      );
      columnOptions = seriesList.map((serie) => ({
        value: serie.key,
        label: formatKeyLabel(serie.key, serie.label),
      }));
      columnSelected = seriesList
        .filter((serie) => serie.enabled !== false)
        .map((serie) => serie.key);
    } else if (kind === "ingreso" || kind === "ingreso-nacional") {
      columnOptions = [
        { value: "actualYTD", label: "Actual acumulado (actualYTD)" },
      ];
      columnSelected = ["actualYTD"];
      columnsDisabled = true;
    } else if (kind === "custom") {
      const moduleKey = normalizeModuleKey(definition.module || "RESUMEN");
      const seriesList = isSummaryModuleKey(moduleKey)
        ? buildSummarySeriesList(config, defaults)
        : buildOperativoSeriesList(config, defaults);
      columnOptions = seriesList.map((serie) => ({
        value: serie.key,
        label: formatKeyLabel(serie.key, serie.label),
      }));
      const preferred = Array.isArray(definition.seriesKeys)
        ? definition.seriesKeys
        : [];
      columnSelected = preferred.length
        ? preferred
        : seriesList
            .filter((serie) => serie.enabled !== false)
            .map((serie) => serie.key);
    } else {
      columnOptions = (definition.columnList || []).map((value) => ({
        value,
        label: value,
      }));
      columnSelected = definition.columnList || [];
    }
    setSelectOptions(columnsSelect, columnOptions, columnSelected, {
      placeholder: "Sin columnas",
      disabled: columnsDisabled,
    });

    detailUpdating = false;
  };

  const updateCustomChartConfig = (definition, changes = {}) => {
    if (!definition) return false;
    const api = getGraficasConfigApi();
    if (!api?.load || !api?.save) return false;
    const current = api.load();
    const nextConfig = clone(current || {});
    const charts = Array.isArray(nextConfig.customCharts)
      ? nextConfig.customCharts
      : [];
    const chartId = String(definition.chartId || definition.id || "").trim();
    if (!chartId) return false;
    const index = charts.findIndex((chart) => String(chart?.id || "") === chartId);
    if (index === -1) return false;
    charts[index] = { ...(charts[index] || {}), ...changes };
    nextConfig.customCharts = charts;
    api.save(nextConfig);
    applyConfigToForm(nextConfig);
    renderGallery(nextConfig);
    updateSourceHints(nextConfig);
    return true;
  };

  const applySeriesCheckboxSelection = (
    rows,
    keyAttr,
    checkboxSelector,
    selectedKeys
  ) => {
    const selectedSet = new Set(selectedKeys);
    rows.forEach((row) => {
      const key = row.getAttribute(keyAttr);
      if (!key) return;
      const checkbox = row.querySelector(checkboxSelector);
      if (!checkbox) return;
      checkbox.checked = selectedSet.has(key);
      checkbox.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };

  const handleDetailRowsChange = () => {
    if (detailUpdating) return;
    const selected = galleryState.selectedId;
    const item = selected ? galleryState.cards.get(selected) : null;
    if (!item?.definition || !detailCard) return;
    const definition = item.definition;
    const rowsSelect = detailCard.querySelector("[data-detail-rows-select]");
    const seriesSelect = detailCard.querySelector("[data-detail-series-select]");
    if (!rowsSelect) return;
    const rows = getSelectedValues(rowsSelect);
    const kind = definition.previewKind || "";
    if (kind === "summary") {
      const summaryKey = definition.summarySourceKey || "generic";
      const summaryType =
        definition.summaryType || definition.chartKey || "operating";
      const input = findSummarySourceInput(summaryKey, summaryType);
      if (input) {
        const nextRows = rows.map((row) => ({
          label: row,
          variants: [row],
        }));
        input.value = formatSummaryRows(nextRows);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
      return;
    }
    if (kind === "consolidated") {
      const seriesKey = getDetailSeriesKey(definition, seriesSelect, "operating");
      const input = form.querySelector(
        `[data-consolidated-source][data-consolidated-source-key="${seriesKey}"]`
      );
      if (input) {
        input.value = formatVariantsList(rows);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
      return;
    }
    if (kind === "ingreso") {
      const seriesKey = getDetailSeriesKey(definition, seriesSelect);
      const input = form.querySelector(
        `[data-ingreso-series-row][data-ingreso-series-key="${seriesKey}"] [data-ingreso-series-sources]`
      );
      if (input) {
        input.value = formatVariantsList(rows);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
      return;
    }
    if (kind === "ingreso-nacional") {
      const seriesKey = getDetailSeriesKey(definition, seriesSelect);
      const input = form.querySelector(
        `[data-ingreso-nacional-series-row][data-ingreso-nacional-series-key="${seriesKey}"] [data-ingreso-nacional-series-sources]`
      );
      if (input) {
        input.value = formatVariantsList(rows);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
      return;
    }
    if (kind === "custom") {
      const nextRows = rows.map((row) => ({
        alias: row,
        variants: [row],
      }));
      updateCustomChartConfig(definition, { rows: nextRows });
    }
  };

  const handleDetailColumnsChange = () => {
    if (detailUpdating) return;
    const selected = galleryState.selectedId;
    const item = selected ? galleryState.cards.get(selected) : null;
    if (!item?.definition || !detailCard) return;
    const definition = item.definition;
    const columnsSelect = detailCard.querySelector(
      "[data-detail-columns-select]"
    );
    if (!columnsSelect) return;
    const selectedKeys = getSelectedValues(columnsSelect);
    const kind = definition.previewKind || "";
    if (kind === "summary" || kind === "consolidated") {
      const rows = Array.from(form.querySelectorAll("[data-series-row]"));
      applySeriesCheckboxSelection(
        rows,
        "data-series-key",
        "[data-series-enabled]",
        selectedKeys
      );
      return;
    }
    if (kind === "operativo") {
      const rows = Array.from(form.querySelectorAll("[data-operativo-series-row]"));
      applySeriesCheckboxSelection(
        rows,
        "data-operativo-series-key",
        "[data-operativo-series-enabled]",
        selectedKeys
      );
      return;
    }
    if (kind === "gastos") {
      const rows = Array.from(
        form.querySelectorAll(
          `[data-gg-chart-key="${definition.chartKey || "rendimientos"}"] [data-gg-series-row]`
        )
      );
      applySeriesCheckboxSelection(
        rows,
        "data-gg-series-key",
        "[data-gg-series-enabled]",
        selectedKeys
      );
      return;
    }
    if (kind === "custom") {
      updateCustomChartConfig(definition, { seriesKeys: selectedKeys });
    }
  };

  const handleDetailSeriesChange = () => {
    if (detailUpdating) return;
    const selected = galleryState.selectedId;
    const item = selected ? galleryState.cards.get(selected) : null;
    if (!item?.definition || !detailCard) return;
    const seriesSelect = detailCard.querySelector("[data-detail-series-select]");
    if (!seriesSelect) return;
    detailState.seriesByChart.set(item.definition.id, seriesSelect.value || "");
    updateDetailSelects(item.definition);
  };

  const updateDetailCard = (definition) => {
    if (!detailCard) return;
    const titleEl = detailCard.querySelector("[data-detail-title]");
    const subtitleEl = detailCard.querySelector("[data-detail-subtitle]");
    const infoEl = detailCard.querySelector("[data-detail-info]");
    const sourcesEl = detailCard.querySelector("[data-detail-sources]");
    if (!definition) {
      if (detailMeta) detailMeta.classList.add("d-none");
      if (detailHint) detailHint.classList.remove("d-none");
      if (detailEditBtn) detailEditBtn.classList.add("d-none");
      if (detailDeleteBtn) detailDeleteBtn.classList.add("d-none");
      if (sourcesEl) {
        sourcesEl.textContent = "";
        sourcesEl.classList.add("d-none");
      }
      updateDetailSelects(null);
      return;
    }
    if (detailHint) detailHint.classList.add("d-none");
    if (detailMeta) detailMeta.classList.remove("d-none");
    if (titleEl) titleEl.textContent = definition.title || "";
    if (subtitleEl) {
      subtitleEl.textContent = definition.subtitle || "";
      subtitleEl.classList.toggle(
        "d-none",
        !(definition.subtitle || "").trim()
      );
    }
    if (infoEl) {
      const tableLabel = definition.tableLabel || definition.moduleFile;
      const tableText = tableLabel ? ` · Tabla: ${tableLabel}` : "";
      infoEl.textContent = `Vista: ${resolveViewLabel(
        definition
      )} · ${formatChartTypeLabel(definition.chartType)}${tableText}${
        definition.enabled === false ? " · Inactiva" : ""
      }`;
    }
    if (sourcesEl) {
      sourcesEl.textContent = "";
      sourcesEl.classList.add("d-none");
    }
    updateDetailSelects(definition);
    if (detailEditBtn) detailEditBtn.classList.remove("d-none");
    if (detailDeleteBtn) {
      const chartId = String(definition?.chartId || definition?.id || "").trim();
      detailDeleteBtn.classList.toggle("d-none", !chartId);
    }
  };

  const openConfigSection = (definition) => {
    if (!definition?.target) return;
    const configTabBtn = document.getElementById(
      "plantillas-graficas-config-tab"
    );
    configTabBtn?.click();
    const collapseId = definition.target?.collapseId;
    const focusSelector = definition.target?.focusSelector;
    if (collapseId) {
      const collapseEl = document.getElementById(collapseId);
      if (collapseEl && window.bootstrap?.Collapse) {
        const instance = window.bootstrap.Collapse.getOrCreateInstance(
          collapseEl,
          { toggle: false }
        );
        instance.show();
      } else if (collapseEl) {
        collapseEl.classList.add("show");
      }
    }
    if (focusSelector) {
      setTimeout(() => {
        const focusEl = document.querySelector(focusSelector);
        focusEl?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 150);
    }
  };

  const buildNewCustomChartDraft = () => ({
    id: buildCustomChartId(),
    module: getCurrentModuleValue() || "RESUMEN",
    title: "",
    subtitle: "",
    chartType: "inherit",
    enabled: true,
    sourceType: "snapshot",
    seriesKeys: [],
    series: [],
    rows: [],
  });

  const openNewCustomChartEditor = () => {
    if (typeof window.openChartEditor !== "function") return false;
    const draft = buildNewCustomChartDraft();
    window.openChartEditor(draft.id, draft);
    return true;
  };

  const isCustomChartDefinition = (definition) => {
    if (!definition) return false;
    if (definition.previewKind === "custom") return true;
    const id = String(definition.id || "").trim();
    const chartId = String(definition.chartId || "").trim();
    return id.startsWith("custom-") || chartId.startsWith("custom-");
  };

  const CHART_ID_ALIASES = Object.freeze({
    ingreso: "ingreso-capitulo",
    "ingreso-capitulo": "ingreso-capitulo",
    operativo: "operativo-panel",
    "operativo-panel": "operativo-panel",
    "gastos-rendimientos": "gg-rendimientos",
    "gg-rendimientos": "gg-rendimientos",
    "gastos-plusvalia": "gg-plusvalia",
    "gg-plusvalia": "gg-plusvalia",
  });

  const canonicalizeChartId = (value) => {
    const id = String(value || "").trim();
    if (!id) return "";
    return CHART_ID_ALIASES[id] || id;
  };

  const normalizeDeletedChartIds = (values = []) =>
    Array.from(
      new Set(
        (Array.isArray(values) ? values : [])
          .map((value) => canonicalizeChartId(value))
          .filter(Boolean)
      )
    );

  const disableBuiltInChartById = (config, chartId) => {
    const id = canonicalizeChartId(chartId);
    if (!id || !config || typeof config !== "object") return;
    switch (id) {
      case "summary-operating":
        config.charts = { ...(config.charts || {}) };
        config.charts.operating = {
          ...(config.charts.operating || {}),
          enabled: false,
        };
        break;
      case "summary-net":
        config.charts = { ...(config.charts || {}) };
        config.charts.net = {
          ...(config.charts.net || {}),
          enabled: false,
        };
        break;
      case "summary-consolidated":
        config.charts = { ...(config.charts || {}) };
        config.charts.consolidated = {
          ...(config.charts.consolidated || {}),
          enabled: false,
        };
        break;
      case "ingreso-capitulo":
        config.ingreso = { ...(config.ingreso || {}), enabled: false };
        break;
      case "ingreso-nacional":
        config.ingresoNacional = {
          ...(config.ingresoNacional || {}),
          enabled: false,
        };
        break;
      case "operativo-panel":
        config.operativo = { ...(config.operativo || {}), enabled: false };
        break;
      case "gg-rendimientos":
        config.gastosGenerales = {
          ...(config.gastosGenerales || {}),
          charts: {
            ...((config.gastosGenerales || {}).charts || {}),
            rendimientos: {
              ...(((config.gastosGenerales || {}).charts || {}).rendimientos || {}),
              enabled: false,
            },
          },
        };
        break;
      case "gg-plusvalia":
        config.gastosGenerales = {
          ...(config.gastosGenerales || {}),
          charts: {
            ...((config.gastosGenerales || {}).charts || {}),
            plusvalia: {
              ...(((config.gastosGenerales || {}).charts || {}).plusvalia || {}),
              enabled: false,
            },
          },
        };
        break;
      default:
        break;
    }
  };

  const deleteChartDefinition = (definition) => {
    const targetId = canonicalizeChartId(definition?.chartId || definition?.id);
    if (!targetId) return false;
    const api = getGraficasConfigApi();
    if (!api || typeof api.load !== "function" || typeof api.save !== "function") {
      return false;
    }
    const current = api.load();
    const nextConfig = clone(current || {});
    nextConfig.deletedChartIds = normalizeDeletedChartIds(
      nextConfig.deletedChartIds
    );

    if (isCustomChartDefinition(definition)) {
      const currentCharts = Array.isArray(nextConfig.customCharts)
        ? nextConfig.customCharts
        : [];
      const filteredCharts = currentCharts.filter(
        (chart) => String(chart?.id || "").trim() !== targetId
      );
      if (filteredCharts.length === currentCharts.length) return false;
      nextConfig.customCharts = filteredCharts;
      nextConfig.deletedChartIds = nextConfig.deletedChartIds.filter(
        (id) => id !== targetId
      );
      if (
        nextConfig.manualOnly === true &&
        !filteredCharts.some(
          (chart) =>
            chart?.enabled !== false &&
            Array.isArray(chart?.rows) &&
            chart.rows.length > 0
        )
      ) {
        nextConfig.manualOnly = false;
      }
    } else {
      if (!nextConfig.deletedChartIds.includes(targetId)) {
        nextConfig.deletedChartIds.push(targetId);
      }
      disableBuiltInChartById(nextConfig, targetId);
    }
    api.save(nextConfig);
    return true;
  };

  const renderGallery = (config) => {
    // Validar elementos requeridos
    if (!galleryEl) {
      console.warn("plantillas-graficas: galleryEl no encontrado");
      return;
    }
    if (!galleryCardTemplate) {
      console.warn("plantillas-graficas: galleryCardTemplate no encontrado");
      // Mostrar mensaje de error en la galería
      galleryEl.innerHTML = '<div class="text-muted text-center p-4">Error: plantilla de tarjetas no encontrada</div>';
      return;
    }
    if (!config) {
      galleryEl.innerHTML = '<div class="text-muted text-center p-4">Sin configuracion disponible</div>';
      updateDetailCard(null);
      return;
    }
    const prevSelected = galleryState.selectedId;
    destroyGalleryPreviews();
    galleryState.cards.clear();
    galleryState.selectedId = null;
    galleryEl.innerHTML = "";

    let definitions = [];
    try {
      definitions = buildCardDefinitions(config);
    } catch (error) {
      console.error("plantillas-graficas: Error al construir definiciones", error);
      galleryEl.innerHTML = '<div class="text-muted text-center p-4">Error al cargar graficas</div>';
      return;
    }

    const defaults = clone(getGraficasConfigApi()?.defaults || {});
    const previewContext = getPreviewContext();
    definitions = Array.isArray(definitions) ? definitions : [];
    definitions = filterDefinitionsByCapitulo(definitions, previewContext);
    const currentModuleKey = getCurrentModuleKey();
    definitions = definitions.slice().sort((a, b) => {
      const aCustom = a?.previewKind === "custom";
      const bCustom = b?.previewKind === "custom";
      if (!aCustom || !bCustom) return 0;
      const aMatch =
        normalizeModuleKey(a?.module || "RESUMEN") === currentModuleKey;
      const bMatch =
        normalizeModuleKey(b?.module || "RESUMEN") === currentModuleKey;
      if (aMatch === bMatch) return 0;
      return aMatch ? -1 : 1;
    });
    const hasDefinitions = definitions.length > 0;
    if (!hasDefinitions) {
      galleryEl.innerHTML = "";
    }

    const resolveCategoryGroup = (definition) => {
      const raw = (definition?.category || "").toString().trim();
      if (!raw) return "Otras";
      if (raw.toLowerCase().startsWith("personalizada")) return "Personalizadas";
      return raw;
    };
    const appendCategoryHeading = (label) => {
      const heading = document.createElement("div");
      heading.className = "plantillas-graficas-group";
      heading.textContent = label;
      galleryEl.appendChild(heading);
    };
    let currentGroup = null;
    let cardIndex = 0;

    definitions.forEach((definition) => {
      try {
        const templateContent = galleryCardTemplate.content;
        if (!templateContent || !templateContent.firstElementChild) {
          console.warn("plantillas-graficas: template content vacio para", definition.id);
          return;
        }
        const node = templateContent.firstElementChild.cloneNode(true);
        node.dataset.chartId = definition.id;
        const titleEl = node.querySelector("[data-chart-title]");
        const subtitleEl = node.querySelector("[data-chart-subtitle]");
        const statusEl = node.querySelector("[data-chart-status]");
        const categoryEl = node.querySelector("[data-chart-category]");
        const moduleEl = node.querySelector("[data-chart-module]");
        const metaEl = node.querySelector("[data-chart-meta]");
        const sourceEl = node.querySelector("[data-chart-source]");
        const preview = node.querySelector(".plantillas-graficas-preview");
        const canvas = node.querySelector("[data-chart-canvas]");
        const groupLabel = resolveCategoryGroup(definition);
        if (groupLabel !== currentGroup) {
          appendCategoryHeading(groupLabel);
          currentGroup = groupLabel;
        }
        cardIndex += 1;
        node.style.setProperty("--stagger", cardIndex.toString());

        if (titleEl) titleEl.textContent = definition.title || "";
        if (subtitleEl) subtitleEl.textContent = definition.subtitle || "";
        if (statusEl) {
          statusEl.textContent = definition.enabled ? "Activa" : "Inactiva";
          statusEl.classList.toggle("text-muted", !definition.enabled);
        }
        if (categoryEl) {
          categoryEl.textContent = definition.category || "Grafica";
          categoryEl.classList.toggle("d-none", !definition.category);
        }
        if (moduleEl) {
          moduleEl.textContent = definition.module || definition.moduleFile || "";
          moduleEl.classList.toggle("d-none", !moduleEl.textContent.trim());
        }
        if (metaEl) {
          const metaParts = [
            `Vista: ${resolveViewLabel(definition)}`,
            `Tipo: ${formatChartTypeLabel(definition.chartType)}`,
          ];
          if (definition.enabled === false) metaParts.push("Inactiva");
          metaEl.textContent = metaParts.join(" · ");
        }
        if (sourceEl) {
          sourceEl.textContent = "";
          sourceEl.classList.add("d-none");
        }
        node.classList.toggle("is-disabled", definition.enabled === false);
        galleryEl.appendChild(node);

        // Render preview con manejo de errores (post-append)
        try {
          const previewData = buildPreviewData(
            definition,
            config,
            defaults,
            previewContext
          );
          const handlePreview = (data) => {
            if (!data) {
              renderPreviewFallback(
                preview,
                getPreviewFallbackMessage(definition, previewContext)
              );
              return;
            }
            try {
              renderPreviewChart(definition.id, preview, canvas, data);
            } catch (chartError) {
              console.warn(
                "plantillas-graficas: Error rendering chart",
                definition.id,
                chartError
              );
              renderPreviewFallback(
                preview,
                getPreviewFallbackMessage(definition, previewContext)
              );
            }
          };
          if (previewData && typeof previewData.then === "function") {
            renderPreviewFallback(preview, "Cargando datos...");
            previewData
              .then((data) => {
                if (!node.isConnected) return;
                handlePreview(data);
              })
              .catch((err) => {
                console.warn(
                  "plantillas-graficas: Error loading preview data",
                  definition.id,
                  err
                );
                if (!node.isConnected) return;
                renderPreviewFallback(
                  preview,
                  getPreviewFallbackMessage(definition, previewContext)
                );
              });
          } else {
            handlePreview(previewData);
          }
        } catch (previewError) {
          console.warn(
            "plantillas-graficas: Error en preview",
            definition.id,
            previewError
          );
          renderPreviewFallback(
            preview,
            getPreviewFallbackMessage(definition, previewContext)
          );
        }

        node.addEventListener("click", () => {
          const prev = galleryState.selectedId;
          if (prev && galleryState.cards.has(prev)) {
            galleryState.cards.get(prev).node.classList.remove("active");
          }
          galleryState.selectedId = definition.id;
          node.classList.add("active");
          updateDetailCard(definition);
          openConfigSection(definition);
        });

        galleryState.cards.set(definition.id, { node, definition });
      } catch (cardError) {
        console.error("plantillas-graficas: Error rendering card", definition?.id, cardError);
      }
    });

    const handleAddCustomChart = () => {
      if (openNewCustomChartEditor()) return;
      openConfigSection({
        target: { collapseId: "plantillasGraficasCustomCollapse" },
      });
      customAddBtn?.click();
    };

    const customGroupLabel = "Personalizadas";
    const ensureCustomGroup = () => {
      if (currentGroup !== customGroupLabel) {
        appendCategoryHeading(customGroupLabel);
        currentGroup = customGroupLabel;
      }
    };

    if (galleryAddTemplate?.content?.firstElementChild) {
      ensureCustomGroup();
      const addNode = galleryAddTemplate.content.firstElementChild.cloneNode(true);
      addNode.addEventListener("click", handleAddCustomChart);
      cardIndex += 1;
      addNode.style.setProperty("--stagger", cardIndex.toString());
      galleryEl.appendChild(addNode);
    } else {
      ensureCustomGroup();
      const addNode = document.createElement("button");
      addNode.type = "button";
      addNode.className = "plantillas-graficas-card plantillas-graficas-card-add";
      addNode.innerHTML = `
        <div class="plantillas-graficas-card-inner">
          <div class="plantillas-graficas-preview d-flex align-items-center justify-content-center">
            <div class="plantillas-graficas-add-icon">
              <i class="bi bi-plus-circle"></i>
            </div>
          </div>
          <div class="plantillas-graficas-card-body">
            <div class="plantillas-graficas-card-title">Nueva grafica manual</div>
            <div class="text-muted small">
              Define modulo, filas y columnas exactas.
            </div>
          </div>
        </div>
      `;
      addNode.addEventListener("click", handleAddCustomChart);
      cardIndex += 1;
      addNode.style.setProperty("--stagger", cardIndex.toString());
      galleryEl.appendChild(addNode);
    }

    if (prevSelected && galleryState.cards.has(prevSelected)) {
      const { node, definition } = galleryState.cards.get(prevSelected);
      galleryState.selectedId = prevSelected;
      node.classList.add("active");
      updateDetailCard(definition);
    } else {
      updateDetailCard(null);
    }
  };

  const validateConfig = (config) => {
    const enabledSeries = (config.series || []).filter((serie) => serie.enabled);
    if (enabledSeries.length === 0) {
      return "Selecciona al menos una serie activa.";
    }
    return null;
  };

  let galleryUpdateTimer = null;
  const scheduleGalleryUpdate = () => {
    if (!galleryEl) return;
    if (galleryUpdateTimer) {
      clearTimeout(galleryUpdateTimer);
    }
    galleryUpdateTimer = setTimeout(() => {
      updateContextChips();
      const draft = readConfigFromForm();
      renderGallery(draft);
      updateSourceHints(draft);
      galleryUpdateTimer = null;
    }, 250);
  };

  const handleSave = () => {
    if (saveBtn) saveBtn.disabled = true;
    const draft = readConfigFromForm();
    const error = validateConfig(draft);
    if (error) {
      setStatus(error, "danger");
      if (saveBtn) saveBtn.disabled = false;
      return;
    }
    const api = getGraficasConfigApi();
    const saved = api?.save ? api.save(draft) : draft;
    applyConfigToForm(saved);
    updateContextChips();
    renderGallery(saved);
    updateSourceHints(saved);
    setStatus("Configuracion guardada. Recarga las vistas con graficas.", "success");
    if (saveBtn) saveBtn.disabled = false;
  };

  const handleReset = () => {
    const confirmado = window.confirm(
      "Restaurar la configuracion por defecto?"
    );
    if (!confirmado) return;
    const api = getGraficasConfigApi();
    const restored = api?.reset ? api.reset() : null;
    const fallback = restored || api?.load?.();
    applyConfigToForm(fallback || restored);
    if (fallback || restored) {
      updateContextChips();
      renderGallery(fallback || restored);
      updateSourceHints(fallback || restored);
    }
    setStatus("Configuracion restaurada a valores por defecto.", "success");
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    handleSave();
  });

  if (resetBtn) {
    resetBtn.addEventListener("click", (event) => {
      event.preventDefault();
      handleReset();
    });
  }

  const adminAllowed = isAdmin();
  if (!adminAllowed) {
    if (fieldset) fieldset.disabled = true;
    if (warningEl) warningEl.classList.remove("d-none");
  }

  const api = getGraficasConfigApi();
  if (!api) {
    setStatus("No se encontro GraficasConfig en esta vista.", "danger");
    console.warn("plantillas-graficas: GraficasConfig API no disponible");
    return;
  }

  // Verificar elementos de galeria
  if (!galleryEl) {
    console.warn("plantillas-graficas: Elemento de galeria no encontrado (plantillasGraficasGallery)");
  }
  if (!galleryCardTemplate) {
    console.warn("plantillas-graficas: Template de tarjeta no encontrado (plantillasGraficasCardTemplate)");
  }

  const configInicial = api.load();
  applyConfigToForm(configInicial);
  updateContextChips();
  renderGallery(configInicial);
  updateSourceHints(configInicial);

  // Verificar estado de la galeria despues de renderizar
  const cardCount = galleryState.cards.size;
  const statusMessage = adminAllowed
    ? `Listo para editar. ${cardCount} graficas cargadas.`
    : "Acceso restringido a administradores.";
  setStatus(statusMessage, adminAllowed ? "muted" : "danger");

  window.addEventListener("graficas-config-updated", (event) => {
    const nextConfig = event?.detail?.config;
    if (!nextConfig) return;
    applyConfigToForm(nextConfig);
    updateContextChips();
    renderGallery(nextConfig);
    updateSourceHints(nextConfig);
    if (adminAllowed) {
      setStatus("Configuracion sincronizada con el servidor.", "muted");
    }
  });
  if (!adminAllowed) {
    return;
  }

  if (summarySourceSelect) {
    applySummarySourceFilter(summarySourceSelect.value);
    summarySourceSelect.addEventListener("change", (event) => {
      applySummarySourceFilter(event.target.value);
    });
  }
  initializeSourcePickers();

  const detailRowsSelect = detailCard?.querySelector("[data-detail-rows-select]");
  if (detailRowsSelect) {
    detailRowsSelect.addEventListener("change", handleDetailRowsChange);
  }

  const detailColumnsSelect = detailCard?.querySelector(
    "[data-detail-columns-select]"
  );
  if (detailColumnsSelect) {
    detailColumnsSelect.addEventListener("change", handleDetailColumnsChange);
  }

  const detailSeriesSelect = detailCard?.querySelector(
    "[data-detail-series-select]"
  );
  if (detailSeriesSelect) {
    detailSeriesSelect.addEventListener("change", handleDetailSeriesChange);
  }

  if (detailEditBtn) {
    detailEditBtn.addEventListener("click", () => {
      const selected = galleryState.selectedId;
      const item = selected ? galleryState.cards.get(selected) : null;
      if (!item) return;

      // Si es una grafica personalizada o de tipo custom, abrir editor inline
      if (
        item.definition.previewKind === "custom" ||
        item.definition.id.startsWith("custom-")
      ) {
        openCustomEditorForDefinition(item.definition);
      } else {
        // Para graficas predefinidas, abrir la seccion de configuracion
        openConfigSection(item.definition);
      }
    });
  }

  if (detailDeleteBtn) {
    detailDeleteBtn.addEventListener("click", () => {
      const selected = galleryState.selectedId;
      const item = selected ? galleryState.cards.get(selected) : null;
      if (!item?.definition) return;
      const chartId = String(
        item.definition.chartId || item.definition.id || ""
      ).trim();
      if (!chartId) {
        setStatus("No se encontro el identificador de la grafica.", "danger");
        return;
      }
      const title = (item.definition.title || "esta grafica").toString().trim();
      const customChart = isCustomChartDefinition(item.definition);
      const confirmed = window.confirm(
        customChart
          ? `Eliminar la grafica "${title}"? Esta accion no se puede deshacer.`
          : `Eliminar la grafica "${title}" del gestor? Quedara oculta en panel/exportaciones. Puedes restaurarla con "Restaurar".`
      );
      if (!confirmed) return;
      const removed = deleteChartDefinition(item.definition);
      if (!removed) {
        setStatus("No se pudo eliminar la grafica seleccionada.", "danger");
        return;
      }
      const api = getGraficasConfigApi();
      const refreshed = api?.load ? api.load() : null;
      if (refreshed) {
        applyConfigToForm(refreshed);
        renderGallery(refreshed);
      }
      setStatus("Grafica eliminada correctamente.", "success");
    });
  }

  if (detailAddBtn) {
    detailAddBtn.addEventListener("click", () => {
      if (openNewCustomChartEditor()) return;
      openConfigSection({
        target: { collapseId: "plantillasGraficasCustomCollapse" },
      });
      customAddBtn?.click();
    });
  }

  if (form && galleryEl) {
    form.addEventListener("input", scheduleGalleryUpdate);
  }
  const anioSelect = document.getElementById("anioSelect");
  if (anioSelect) {
    anioSelect.addEventListener("change", scheduleGalleryUpdate);
  }
  const capituloSelect = document.getElementById("capituloSelect");
  if (capituloSelect) {
    capituloSelect.addEventListener("change", () => {
      updateSourcePickerOptions();
      scheduleGalleryUpdate();
    });
  }
  if (moduloSelect) {
    moduloSelect.addEventListener("change", () => {
      scheduleGalleryUpdate();
    });
  }

  const bindContextObserver = (select, onMutate) => {
    if (!select || typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(() => {
      onMutate();
    });
    observer.observe(select, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["value", "selected"],
    });
  };

  bindContextObserver(anioSelect, scheduleGalleryUpdate);
  bindContextObserver(capituloSelect, () => {
    updateSourcePickerOptions();
    scheduleGalleryUpdate();
  });
  bindContextObserver(moduloSelect, scheduleGalleryUpdate);

  // El contexto (anio/capitulo/modulo) puede llegar de forma asíncrona.
  setTimeout(scheduleGalleryUpdate, 350);
  setTimeout(scheduleGalleryUpdate, 1200);

  if (customAddBtn) {
    customAddBtn.addEventListener("click", () => {
      const chart = {
        id: buildCustomChartId(),
        module: getCurrentModuleValue(),
        chartType: "inherit",
        enabled: true,
        rows: [],
      };
      const item = renderCustomChartItem(chart);
      item?.querySelector("[data-custom-title]")?.focus();
      scheduleGalleryUpdate();
    });
  }

  // Exponer funcion para recargar graficas personalizadas desde el editor inline
  window.reloadCustomCharts = () => {
    const api = getGraficasConfigApi();
    if (!api) return;
    const config = api.load();
    renderGallery(config);
    setStatus("Graficas actualizadas.", "success");
  };
})();
