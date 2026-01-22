(() => {
  const form = document.getElementById("plantillasGraficasForm");
  if (!form) return;

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
  const detailAddBtn = document.getElementById("plantillasGraficasDetailAdd");
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

  const getModuloOptions = () => {
    if (moduloSelect) return moduloSelect.innerHTML;
    return [
      '<option value="RESUMEN">RESUMEN</option>',
      '<option value="SUMMARY">SUMMARY</option>',
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
    ].join("");
  };

  const applyModuloOptions = (select, value) => {
    if (!select) return;
    select.innerHTML = getModuloOptions();
    if (value) {
      select.value = value;
    }
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

  const readLatestSnapshot = () => {
    if (typeof localStorage === "undefined") return null;
    let latest = null;
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(SNAPSHOT_PREFIX)) continue;
      try {
        const snapshot = JSON.parse(localStorage.getItem(key) || "null");
        if (!snapshot || !Array.isArray(snapshot.filas)) continue;
        if (!latest || (snapshot.createdAt || 0) > (latest.createdAt || 0)) {
          latest = snapshot;
        }
      } catch (err) {
        continue;
      }
    }
    return latest;
  };

  const getSnapshotLabels = () => {
    const snapshot = readLatestSnapshot();
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

  const resolveApiBase = () => {
    const override = window.API_BASE || window.__API_BASE__;
    if (typeof override === "string" && override.trim()) {
      return override.replace(/\/api\/?$/, "");
    }
    if (window.location.protocol === "file:") {
      return "http://localhost:3005";
    }
    const origin = window.location.origin.replace(/\/$/, "");
    if (/localhost:3000$/.test(origin) || /127\.0\.0\.1:3000$/.test(origin)) {
      return origin.replace(/:3000$/, ":3005");
    }
    return origin;
  };

  const API_BASE = resolveApiBase();
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

  const getPreviewYear = (snapshot) => {
    const selected = Number(document.getElementById("anioSelect")?.value);
    if (Number.isInteger(selected)) return selected;
    const snapYear = Number(snapshot?.anio);
    if (Number.isInteger(snapYear)) return snapYear;
    const ctxYear = Number(readPlaneacionContext()?.anio);
    if (Number.isInteger(ctxYear)) return ctxYear;
    return null;
  };

  const getPreviewEmpresaId = (snapshot) =>
    snapshot?.empresaId ||
    window.Sesion?.obtenerEmpresaActiva?.()?.id ||
    null;

  const getPreviewContext = () => {
    const snapshot = readLatestSnapshot();
    return {
      snapshot,
      snapshotMap: buildSnapshotMap(snapshot),
      empresaId: getPreviewEmpresaId(snapshot),
      anio: getPreviewYear(snapshot),
      capitulo: snapshot?.capitulo || "",
    };
  };

  const resumenMensualCache = new Map();

  const fetchResumenMes = async (empresaId, anio, mes) => {
    const params = new URLSearchParams({
      empresaId: empresaId || "",
      anio: String(anio || ""),
      mes: String(mes || ""),
    });
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

  const loadResumenMensual = async (empresaId, anio) => {
    if (!empresaId || !anio) return [];
    const key = `${empresaId}:${anio}`;
    const cached = resumenMensualCache.get(key);
    if (cached?.data) return cached.data;
    if (cached?.promise) return cached.promise;
    const promise = Promise.all(
      MONTH_LABELS.map((_, idx) =>
        fetchResumenMes(empresaId, anio, idx + 1).catch((error) => {
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

  const snapshotLabelOptions = getSnapshotLabels();

  const renderCustomChartItem = (chart = {}) => {
    if (!customTemplate || !customList) return null;
    const node = customTemplate.content.firstElementChild.cloneNode(true);
    const id = chart.id || buildCustomChartId();
    node.dataset.customId = id;
    const titleInput = node.querySelector("[data-custom-title]");
    const subtitleInput = node.querySelector("[data-custom-subtitle]");
    const moduleSelect = node.querySelector("[data-custom-module]");
    const typeSelect = node.querySelector("[data-custom-type]");
    const rowsInput = node.querySelector("[data-custom-rows]");
    const enabledInput = node.querySelector("[data-custom-enabled]");
    const removeBtn = node.querySelector("[data-custom-remove]");
    const sourcePicker = node.querySelector("[data-custom-source-picker]");
    const addSourceBtn = node.querySelector("[data-custom-add-source]");

    if (titleInput) titleInput.value = chart.title || "";
    if (subtitleInput) subtitleInput.value = chart.subtitle || "";
    if (moduleSelect) {
      applyModuloOptions(moduleSelect, chart.module || "RESUMEN");
    }
    if (typeSelect) typeSelect.value = chart.chartType || "inherit";
    if (rowsInput) rowsInput.value = formatCustomRows(chart.rows);
    if (enabledInput) enabledInput.checked = chart.enabled !== false;

    if (sourcePicker) {
      fillSelectOptions(sourcePicker, snapshotLabelOptions, "Selecciona una fila");
    }
    if (addSourceBtn) {
      addSourceBtn.disabled = !snapshotLabelOptions.length;
      addSourceBtn.addEventListener("click", () => {
        if (!sourcePicker || !rowsInput) return;
        const selected = sourcePicker.value;
        appendRowValue(rowsInput, selected);
        sourcePicker.value = "";
      });
    }

    if (removeBtn) {
      removeBtn.addEventListener("click", () => {
        node.remove();
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

  const initializeSourcePickers = () => {
    if (summarySourcePicker) {
      fillSelectOptions(
        summarySourcePicker,
        snapshotLabelOptions,
        "Selecciona una fila"
      );
    }
    if (summarySourceAdd) {
      summarySourceAdd.disabled = !snapshotLabelOptions.length;
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

    const consolidatedPickers = form.querySelectorAll(
      "[data-consolidated-source-picker]"
    );
    consolidatedPickers.forEach((picker) => {
      fillSelectOptions(picker, snapshotLabelOptions, "Selecciona una fila");
    });
    form.querySelectorAll("[data-consolidated-source-add]").forEach((btn) => {
      btn.disabled = !snapshotLabelOptions.length;
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

    if (ingresoSourcePicker) {
      fillSelectOptions(
        ingresoSourcePicker,
        snapshotLabelOptions,
        "Selecciona una fila"
      );
    }
    if (ingresoSourceAdd) {
      ingresoSourceAdd.disabled = !snapshotLabelOptions.length;
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

    if (ingresoNacionalSourcePicker) {
      fillSelectOptions(
        ingresoNacionalSourcePicker,
        snapshotLabelOptions,
        "Selecciona una fila"
      );
    }
    if (ingresoNacionalSourceAdd) {
      ingresoNacionalSourceAdd.disabled = !snapshotLabelOptions.length;
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

    const customCharts = [];
    if (customList) {
      customList.querySelectorAll("[data-custom-chart]").forEach((item) => {
        const id = item.dataset.customId || buildCustomChartId();
        const title = item.querySelector("[data-custom-title]")?.value?.trim() || "";
        const subtitle =
          item.querySelector("[data-custom-subtitle]")?.value?.trim() || "";
        const module =
          item.querySelector("[data-custom-module]")?.value || "RESUMEN";
        const chartType =
          item.querySelector("[data-custom-type]")?.value || "inherit";
        const enabled =
          item.querySelector("[data-custom-enabled]")?.checked !== false;
        const rowsText = item.querySelector("[data-custom-rows]")?.value || "";
        const rows = parseCustomRows(rowsText);
        customCharts.push({
          id,
          title,
          subtitle,
          module,
          chartType,
          enabled,
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
      return { operating, net, isCdmx: key === "cdmx" };
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

    return { operating: [], net: [], isCdmx: false };
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
        dataMatrix[index].push(toNumber(totals?.[serie.key]));
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
    if (!empresaId || !anio) return null;
    const ingresoConfig = config?.[kind] || defaults?.[kind] || {};
    if (ingresoConfig.enabled === false) return null;
    const ingresoSources =
      config?.sources?.[kind] || defaults?.sources?.[kind] || {};
    const responses = await loadResumenMensual(empresaId, anio);
    if (!responses || !responses.length) return null;

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
    if (!datasetsConfig.length) return null;

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

  const buildPreviewData = (definition, config, defaults, context) => {
    const baseType = config.chart?.type || "bar";
    const chartType = resolveChartType(definition.chartType, baseType);
    const snapshotMap = context?.snapshotMap;
    const capituloLabel = (context?.capitulo || "").toString().trim();
    const seriesList =
      Array.isArray(config.series) && config.series.length
        ? config.series
        : defaults.series || [];

    if (definition.previewKind === "summary") {
      if (!snapshotMap) return null;
      const summarySources =
        config.sources?.summary || defaults.sources?.summary || {};
      const rowsConfig = resolveSummaryRows(
        capituloLabel,
        summarySources,
        defaults.sources?.summary || {}
      );
      const rows =
        definition.chartKey === "net" ? rowsConfig.net : rowsConfig.operating;
      const data = buildDatasetsFromSnapshot({
        rows,
        snapshotMap,
        seriesList,
        chartType,
        capituloLabel,
      });
      return data ? { chartType, ...data } : null;
    }
    if (definition.previewKind === "consolidated") {
      if (!snapshotMap) return null;
      const consolidatedSources =
        config.sources?.consolidated || defaults.sources?.consolidated || {};
      const opTotals = getRowTotals(
        snapshotMap,
        getConsolidatedVariants(
          consolidatedSources,
          "operating",
          defaults.sources?.consolidated || {}
        )
      );
      const netTotals = getRowTotals(
        snapshotMap,
        getConsolidatedVariants(
          consolidatedSources,
          "net",
          defaults.sources?.consolidated || {}
        )
      );
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
      const opData = activeSeries.map((serie) => toNumber(opTotals?.[serie.key]));
      const netData = activeSeries.map((serie) => toNumber(netTotals?.[serie.key]));
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
    if (definition.previewKind === "custom") {
      if (!snapshotMap) return null;
      const rows = Array.isArray(definition.rows) ? definition.rows : [];
      const data = buildDatasetsFromSnapshot({
        rows,
        snapshotMap,
        seriesList,
        chartType,
        capituloLabel,
        looseMatch: true,
      });
      return data ? { chartType, ...data } : null;
    }
    return null;
  };

  const renderPreviewFallback = (container, message) => {
    if (!container) return;
    container.innerHTML = "";
    const text = document.createElement("div");
    text.className = "text-muted small text-center p-3";
    text.textContent = message || "Vista previa no disponible.";
    container.appendChild(text);
  };

  const renderPreviewChart = (chartId, preview, canvas, previewData) => {
    if (
      !window.Chart ||
      !previewData ||
      !canvas ||
      !preview ||
      !Array.isArray(previewData.datasets) ||
      previewData.datasets.length === 0
    ) {
      renderPreviewFallback(
        preview,
        !window.Chart ? "Chart.js no disponible." : "Sin datos."
      );
      return;
    }
    const view = canvas.ownerDocument?.defaultView;
    if (!view || typeof view.getComputedStyle !== "function") {
      renderPreviewFallback(preview, "Vista previa no disponible.");
      return;
    }
    const ctx = canvas.getContext ? canvas.getContext("2d") : null;
    if (!ctx) {
      renderPreviewFallback(preview, "Vista previa no disponible.");
      return;
    }
    const current = galleryState.previews.get(chartId);
    if (current) {
      current.destroy();
    }
    try {
      const chart = new window.Chart(ctx, {
        type: previewData.chartType,
        data: {
          labels: previewData.labels || [],
          datasets: previewData.datasets,
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
    } catch (error) {
      console.warn("No se pudo renderizar la vista previa de graficas", error);
      renderPreviewFallback(preview, "Vista previa no disponible.");
    }
  };

  const getPreviewFallbackMessage = (definition, context) => {
    if (definition.previewKind === "operativo" || definition.previewKind === "gastos") {
      return "Vista previa disponible al abrir el modulo.";
    }
    if (
      (definition.previewKind === "ingreso" ||
        definition.previewKind === "ingreso-nacional") &&
      (!context?.empresaId || !context?.anio)
    ) {
      return "Selecciona empresa y ano para ver datos.";
    }
    if (!context?.snapshotMap) {
      return "Sin snapshot de RESUMEN.";
    }
    return "Sin datos.";
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
    const summaryOperatingSources = buildSummarySourceLabels(
      summarySources,
      "operating"
    );
    const summaryNetSources = buildSummarySourceLabels(summarySources, "net");
    const consolidatedLabels = uniqueList([
      consolidatedSources?.operating?.label,
      consolidatedSources?.net?.label,
    ]);
    const ingresoSourceLabels = buildSourceVariantsList(ingresoSources);
    const ingresoNacionalSourceLabels =
      buildSourceVariantsList(ingresoNacionalSources);
    const defs = [
      {
        id: "summary-operating",
        title:
          config.charts?.operating?.title || "Resultado Operativo por Capitulo",
        subtitle: config.charts?.operating?.subtitle || "",
        category: "Resumen",
        chartType: resolveChartType(
          config.charts?.operating?.chartType,
          baseType
        ),
        enabled: config.charts?.operating?.enabled !== false,
        previewKind: "summary",
        chartKey: "operating",
        sourcesText: buildSourcesText(summaryOperatingSources),
        sourcesMeta: buildSourcesMeta(summaryOperatingSources),
        target: {
          collapseId: "plantillasGraficasResumenCollapse",
          focusSelector: '[data-chart-key="operating"]',
        },
      },
      {
        id: "summary-net",
        title: config.charts?.net?.title || "Resumen Neto por Capitulo",
        subtitle: config.charts?.net?.subtitle || "",
        category: "Resumen",
        chartType: resolveChartType(config.charts?.net?.chartType, baseType),
        enabled: config.charts?.net?.enabled !== false,
        previewKind: "summary",
        chartKey: "net",
        sourcesText: buildSourcesText(summaryNetSources),
        sourcesMeta: buildSourcesMeta(summaryNetSources),
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
        category: "Resumen",
        chartType: resolveChartType(
          config.charts?.consolidated?.chartType,
          baseType
        ),
        enabled: config.charts?.consolidated?.enabled !== false,
        previewKind: "consolidated",
        chartKey: "consolidated",
        sourcesText: buildSourcesText(consolidatedLabels, "Fuente"),
        sourcesMeta: buildSourcesMeta(consolidatedLabels, "Fuente"),
        target: {
          collapseId: "plantillasGraficasResumenCollapse",
          focusSelector: '[data-chart-key="consolidated"]',
        },
      },
      {
        id: "ingreso-capitulo",
        title: config.ingreso?.title || "Ingreso por capitulo",
        subtitle: config.ingreso?.subtitle || "",
        category: "Ingreso",
        chartType: resolveChartType(config.ingreso?.chartType, baseType),
        enabled: config.ingreso?.enabled !== false,
        previewKind: "ingreso",
        sourcesText: buildSourcesText(ingresoSourceLabels),
        sourcesMeta: buildSourcesMeta(ingresoSourceLabels),
        target: {
          collapseId: "plantillasGraficasIngresoCollapse",
          focusSelector: "[data-ingreso-title]",
        },
      },
      {
        id: "ingreso-nacional",
        title: config.ingresoNacional?.title || "Ingreso nacional",
        subtitle: config.ingresoNacional?.subtitle || "",
        category: "Ingreso",
        chartType: resolveChartType(
          config.ingresoNacional?.chartType,
          baseType
        ),
        enabled: config.ingresoNacional?.enabled !== false,
        previewKind: "ingreso-nacional",
        sourcesText: buildSourcesText(ingresoNacionalSourceLabels),
        sourcesMeta: buildSourcesMeta(ingresoNacionalSourceLabels),
        target: {
          collapseId: "plantillasGraficasIngresoNacionalCollapse",
          focusSelector: "[data-ingreso-nacional-title]",
        },
      },
      {
        id: "operativo-panel",
        title: config.operativo?.title || "Operativo",
        subtitle: "Panel operativo",
        category: "Operativo",
        chartType: resolveChartType(config.operativo?.chartType, baseType),
        enabled: config.operativo?.enabled !== false,
        previewKind: "operativo",
        sourcesText: "Fuente: tabla del modulo (resultado operativo)",
        sourcesMeta: "Tabla del modulo",
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
        category: "Gastos Generales",
        chartType: resolveChartType(
          config.gastosGenerales?.charts?.rendimientos?.chartType,
          baseType
        ),
        enabled:
          config.gastosGenerales?.enabled !== false &&
          config.gastosGenerales?.charts?.rendimientos?.enabled !== false,
        previewKind: "gastos",
        chartKey: "rendimientos",
        sourcesText: "Fuente: tabla de gastos generales",
        sourcesMeta: "Tabla gastos",
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
        category: "Gastos Generales",
        chartType: resolveChartType(
          config.gastosGenerales?.charts?.plusvalia?.chartType,
          baseType
        ),
        enabled:
          config.gastosGenerales?.enabled !== false &&
          config.gastosGenerales?.charts?.plusvalia?.enabled !== false,
        previewKind: "gastos",
        chartKey: "plusvalia",
        sourcesText: "Fuente: tabla de gastos generales",
        sourcesMeta: "Tabla gastos",
        target: {
          collapseId: "plantillasGraficasGastosCollapse",
          focusSelector: '[data-gg-chart-key="plusvalia"]',
        },
      },
    ];

    const customCharts = Array.isArray(config.customCharts)
      ? config.customCharts
      : [];
    customCharts.forEach((chart, index) => {
      const chartType = resolveChartType(chart?.chartType, baseType);
      const rowLabels = getCustomRowLabels(
        Array.isArray(chart?.rows) ? chart.rows : []
      );
      defs.push({
        id: `custom-${chart?.id || index + 1}`,
        title: chart?.title || `Grafica personalizada ${index + 1}`,
        subtitle: chart?.subtitle || "",
        category: `Personalizada (${chart?.module || "RESUMEN"})`,
        chartType,
        enabled: chart?.enabled !== false,
        previewKind: "custom",
        rows: Array.isArray(chart?.rows) ? chart.rows : [],
        sourcesText: buildSourcesText(rowLabels, "Filas"),
        sourcesMeta: buildSourcesMeta(rowLabels, "Filas"),
        target: {
          collapseId: "plantillasGraficasCustomCollapse",
          focusSelector: `[data-custom-chart][data-custom-id="${chart?.id || ""}"]`,
        },
      });
    });

    return defs;
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
      if (sourcesEl) {
        sourcesEl.textContent = "";
        sourcesEl.classList.add("d-none");
      }
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
      infoEl.textContent = `${definition.category} · ${formatChartTypeLabel(
        definition.chartType
      )}${definition.enabled ? "" : " · Inactiva"}`;
    }
    if (sourcesEl) {
      const sourcesText = definition.sourcesText || "";
      sourcesEl.textContent = sourcesText;
      sourcesEl.classList.toggle("d-none", !sourcesText);
    }
    if (detailEditBtn) detailEditBtn.classList.remove("d-none");
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

  const renderGallery = (config) => {
    if (!galleryEl || !galleryCardTemplate) return;
    if (!config) {
      galleryEl.innerHTML = "";
      updateDetailCard(null);
      return;
    }
    const prevSelected = galleryState.selectedId;
    destroyGalleryPreviews();
    galleryState.cards.clear();
    galleryState.selectedId = null;
    galleryEl.innerHTML = "";

    const definitions = buildCardDefinitions(config);
    const defaults = clone(getGraficasConfigApi()?.defaults || {});
    const previewContext = getPreviewContext();
    definitions.forEach((definition) => {
      const node = galleryCardTemplate.content.firstElementChild.cloneNode(true);
      node.dataset.chartId = definition.id;
      const titleEl = node.querySelector("[data-chart-title]");
      const subtitleEl = node.querySelector("[data-chart-subtitle]");
      const statusEl = node.querySelector("[data-chart-status]");
      const metaEl = node.querySelector("[data-chart-meta]");
      const preview = node.querySelector(".plantillas-graficas-preview");
      const canvas = node.querySelector("[data-chart-canvas]");

      if (titleEl) titleEl.textContent = definition.title || "";
      if (subtitleEl) subtitleEl.textContent = definition.subtitle || "";
      if (statusEl) {
        statusEl.textContent = definition.enabled ? "Activa" : "Inactiva";
        statusEl.classList.toggle("text-muted", !definition.enabled);
      }
      if (metaEl) {
        const metaParts = [
          `${definition.category} - ${formatChartTypeLabel(definition.chartType)}`,
        ];
        if (definition.sourcesMeta) {
          metaParts.push(definition.sourcesMeta);
        }
        metaEl.textContent = metaParts.join(" - ");
      }
      node.classList.toggle("is-disabled", !definition.enabled);

      galleryState.cards.set(definition.id, { node, definition });
      galleryEl.appendChild(node);

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
        renderPreviewChart(definition.id, preview, canvas, data);
      };
      if (previewData && typeof previewData.then === "function") {
        renderPreviewFallback(preview, "Cargando datos...");
        previewData
          .then((data) => {
            if (!node.isConnected) return;
            handlePreview(data);
          })
          .catch(() => {
            if (!node.isConnected) return;
            renderPreviewFallback(
              preview,
              getPreviewFallbackMessage(definition, previewContext)
            );
          });
      } else {
          handlePreview(previewData);
        }

      node.addEventListener("click", () => {
        const prev = galleryState.selectedId;
        if (prev && galleryState.cards.has(prev)) {
          galleryState.cards.get(prev).node.classList.remove("active");
        }
        galleryState.selectedId = definition.id;
        node.classList.add("active");
        updateDetailCard(definition);
      });
    });

    if (galleryAddTemplate) {
      const addNode = galleryAddTemplate.content.firstElementChild.cloneNode(true);
      addNode.addEventListener("click", () => {
        openConfigSection({
          target: { collapseId: "plantillasGraficasCustomCollapse" },
        });
        customAddBtn?.click();
      });
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
      const draft = readConfigFromForm();
      renderGallery(draft);
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
    renderGallery(saved);
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
      renderGallery(fallback || restored);
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
    return;
  }
  const configInicial = api.load();
  applyConfigToForm(configInicial);
  renderGallery(configInicial);
  setStatus(
    adminAllowed ? "Listo para editar." : "Acceso restringido a administradores.",
    adminAllowed ? "muted" : "danger"
  );

  window.addEventListener("graficas-config-updated", (event) => {
    const nextConfig = event?.detail?.config;
    if (!nextConfig) return;
    applyConfigToForm(nextConfig);
    renderGallery(nextConfig);
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

  if (detailEditBtn) {
    detailEditBtn.addEventListener("click", () => {
      const selected = galleryState.selectedId;
      const item = selected ? galleryState.cards.get(selected) : null;
      if (!item) return;
      openConfigSection(item.definition);
    });
  }

  if (detailAddBtn) {
    detailAddBtn.addEventListener("click", () => {
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

  if (customAddBtn) {
    customAddBtn.addEventListener("click", () => {
      const chart = {
        id: buildCustomChartId(),
        module: moduloSelect?.value || "RESUMEN",
        chartType: "inherit",
        enabled: true,
        rows: [],
      };
      const item = renderCustomChartItem(chart);
      item?.querySelector("[data-custom-title]")?.focus();
      scheduleGalleryUpdate();
    });
  }
})();
