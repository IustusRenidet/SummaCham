(() => {
  "use strict";
  if (window.__OperativoSidebarInitialized) {
    window.__OperativoSidebarReady = true;
    return;
  }
  window.__OperativoSidebarInitialized = true;

  const TABLE_SELECTOR = "#tablaComparacion";
  const PANEL_SELECTOR = ".operativo-panel, .operativo-sidebar";
  const PANEL_ID = "operativoPanel";
  const TOGGLE_SELECTOR = '[data-operativo-toggle="panel"]';
  const CANVAS_COMBINED_ID = "operativoChartCombined";
  const charts = { combined: null, combinedType: null, custom: {} };
  // 0 = proporción real (sin "inflar" barras pequeñas).
  const MIN_BAR_LENGTH = 0;
  const POINT_RADIUS = 6;
  const POINT_HOVER_RADIUS = 8;
  const DEFAULT_OPERATIVO_CONFIG = {
    enabled: true,
    title: "Ppto. Acumulado vs Real + {annual}",
    chartType: "bar",
    datasets: {
      budget: { label: "Ppto. Acumulado", color: "#4472c4", enabled: true },
      real: { label: "Real Acumulado", color: "#ffc000", enabled: true },
      annual: { label: "Presupuesto {year}", color: "#22c55e", enabled: true },
    },
  };

  const normalizeWhitespace = (value) =>
    (value || "").toString().replace(/\s+/g, " ").trim();

  const getHeaderCellStartIndex = (cell) => {
    if (!cell) return -1;
    let idx = 0;
    let cursor = cell;
    while ((cursor = cursor.previousElementSibling)) {
      idx += Number(cursor.colSpan) || 1;
    }
    return idx;
  };

  const getCellText = (cell) => {
    if (!cell) return "";
    try {
      const input = cell.querySelector?.("input, textarea, select");
      if (input) {
        if (input.tagName === "SELECT") {
          const option = input.options?.[input.selectedIndex];
          return normalizeWhitespace(option?.textContent || input.value || "");
        }
        return normalizeWhitespace(input.value || "");
      }
      const dataset =
        cell.dataset?.rawValue ??
        cell.dataset?.value ??
        cell.dataset?.valor ??
        cell.getAttribute?.("data-raw-value") ??
        cell.getAttribute?.("data-value") ??
        cell.getAttribute?.("data-valor");
      if (dataset != null && String(dataset).trim() !== "") {
        return normalizeWhitespace(dataset);
      }
      const dataEl = cell.querySelector?.(
        "[data-raw-value],[data-value],[data-valor]"
      );
      if (dataEl) {
        const inner =
          dataEl.getAttribute("data-raw-value") ||
          dataEl.getAttribute("data-value") ||
          dataEl.getAttribute("data-valor") ||
          "";
        if (inner && inner.trim()) return normalizeWhitespace(inner);
      }
    } catch (_) {
      // ignore
    }
    return normalizeWhitespace(cell.textContent || "");
  };

  const resolverIdentificadorFila = (fila) => {
    if (!fila) return "";
    const cells = fila.cells || [];
    const fromCell = normalizeWhitespace(getCellText(cells?.[0]));
    if (fromCell) return fromCell;
    const data = fila.dataset || {};
    const fromDataset =
      normalizeWhitespace(data.cuentaVisible) ||
      normalizeWhitespace(data.cuenta21) ||
      normalizeWhitespace(data.cuenta) ||
      normalizeWhitespace(data.operationId) ||
      normalizeWhitespace(data.operacionClave) ||
      normalizeWhitespace(data.layoutOrder);
    return fromDataset || "";
  };

  const formatLabelWithId = (label, identifier) => {
    const cleanLabel = normalizeWhitespace(label);
    const cleanId = normalizeWhitespace(identifier);
    if (!cleanLabel) return "";
    if (!cleanId) return cleanLabel;
    if (cleanLabel.includes(cleanId)) return cleanLabel;
    return `${cleanLabel} (${cleanId})`;
  };

  const normalizarSerie = (values = []) => {
    return values.map((value) => {
      const numero = Number(value);
      return Number.isFinite(numero) ? numero : 0;
    });
  };
  let updateTimer = null;

  const getGraficasConfig = () => {
    if (window.GraficasConfig && typeof window.GraficasConfig.load === "function") {
      return window.GraficasConfig.load();
    }
    return { operativo: DEFAULT_OPERATIVO_CONFIG };
  };

  const getOperativoConfig = () => {
    const config = getGraficasConfig();
    return config.operativo || DEFAULT_OPERATIVO_CONFIG;
  };

  const applyTemplate = (template, values = {}) => {
    if (template == null) return "";
    const source = String(template);
    return source.replace(/\{([^}]+)\}/g, (_, token) => {
      const key = String(token || "")
        .trim()
        .toLowerCase();
      if (!key) return "";
      const value = values[key];
      return value == null ? "" : String(value);
    });
  };

  const CHART_PALETTE = [
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

  const filterSeriesByKeys = (seriesList = [], keys = []) => {
    if (!Array.isArray(keys) || keys.length === 0) return seriesList;
    const keySet = new Set(
      keys
        .map((key) => normalizeSeriesSelectionKey(key))
        .filter(Boolean)
    );
    if (!keySet.size) return seriesList;
    const filtered = (seriesList || []).filter((serie) =>
      keySet.has(normalizeSeriesSelectionKey(serie?.key))
    );
    return filtered.length ? filtered : seriesList;
  };

  const applyCustomSeriesOverrides = (seriesList = [], chart = {}) => {
    const overrides = Array.isArray(chart?.series) ? chart.series : [];
    if (!overrides.length) return seriesList;
    const overrideMap = new Map(
      overrides
        .map((item) => {
          const key = item?.key != null ? String(item.key).trim() : "";
          if (!key) return null;
          return [normalizeSeriesSelectionKey(key), item];
        })
        .filter(Boolean)
    );
    return (seriesList || []).map((serie) => {
      const override = overrideMap.get(normalizeSeriesSelectionKey(serie?.key));
      if (!override) return serie;
      return {
        ...serie,
        label:
          typeof override.label === "string" && override.label.trim()
            ? override.label.trim()
            : serie.label,
        color:
          typeof override.color === "string" && override.color.trim()
            ? override.color.trim()
            : serie.color,
      };
    });
  };

  const buildSlicePalette = (count, baseColor) => {
    const palette = baseColor
      ? [baseColor, ...CHART_PALETTE.filter((color) => color !== baseColor)]
      : CHART_PALETTE;
    return Array.from({ length: count }, (_, idx) => palette[idx % palette.length]);
  };

  const getParsedValue = (context) => {
    if (!context) return 0;
    const parsed = context.parsed;
    if (typeof parsed === "number" && Number.isFinite(parsed)) return parsed;
    if (parsed && typeof parsed === "object") {
      const parsedX = Number(parsed.x);
      const parsedY = Number(parsed.y);
      const hasX = Number.isFinite(parsedX);
      const hasY = Number.isFinite(parsedY);
      if (hasX && hasY) {
        const isHorizontal = context?.chart?.options?.indexAxis === "y";
        return isHorizontal ? parsedX : parsedY;
      }
      if (hasY) return parsedY;
      if (hasX) return parsedX;
    }
    const raw = context?.raw;
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (raw && typeof raw === "object") {
      const rawY = Number(raw.y);
      const rawX = Number(raw.x);
      if (Number.isFinite(rawY)) return rawY;
      if (Number.isFinite(rawX)) return rawX;
    }
    return 0;
  };

  const normalizeKey = (value) =>
    (value || "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "")
      .toUpperCase();

  const normalizeModuleKey = (value) => {
    const clean = (value || "")
      .toString()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();
    if (!clean) return "";
    const withoutPath = clean.split(/[\\/]/).pop() || clean;
    const withoutQuery = withoutPath.split("?")[0].split("#")[0];
    const withoutExt = withoutQuery.replace(/\.[A-Z0-9]+$/, "");
    let key = withoutExt.replace(/[^A-Z0-9]/g, "");
    if (!key) return "";
    if (key === "SUMMARY") return "RESUMEN";
    if (key.endsWith("HTML")) {
      const withoutHtml = key.slice(0, -4);
      if (withoutHtml) key = withoutHtml;
      if (key === "SUMMARY") return "RESUMEN";
    }
    return key;
  };

  const getCurrentModuleKey = () =>
    normalizeModuleKey(
      document.body?.dataset?.modulo ||
      document.body?.dataset?.moduloAlias ||
      document.body?.dataset?.moduloId ||
      ""
    );

  const hasEnabledCustomChartsForModule = (graficasConfig, moduleKey) => {
    if (!moduleKey) return false;
    return (
      Array.isArray(graficasConfig?.customCharts) &&
      graficasConfig.customCharts.some((chart) => {
        if (chart?.enabled === false) return false;
        if (!Array.isArray(chart?.rows) || chart.rows.length === 0) return false;
        const chartModuleKey = normalizeModuleKey(chart?.module || "RESUMEN");
        return chartModuleKey === moduleKey;
      })
    );
  };

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const capitalizeLabel = (value = "") => {
    const clean = String(value || "").trim();
    if (!clean) return "";
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  };

  const getModuleLabel = () =>
    (
      document.body?.dataset?.moduloAlias ||
      document.body?.dataset?.modulo ||
      document.body?.dataset?.moduloId ||
      "modulo"
    )
      .toString()
      .trim();

  const getDefaultOperativoLabel = () => {
    const moduleLabel = getModuleLabel();
    const normalized = normalizeKey(moduleLabel);
    if (normalized === "GTOSCORPORATIVOS") return "gasto corporativo";
    if (normalized === "SERVMEMBRESIA") return "servicio";
    return moduleLabel ? moduleLabel.toLowerCase() : "modulo";
  };

  const obtenerVariableCss = (nombre, fallback) => {
    if (!window.getComputedStyle) return fallback;
    const valor = getComputedStyle(document.documentElement)
      .getPropertyValue(nombre)
      .trim();
    return valor || fallback;
  };

  const parseNumero = (texto) => {
    const raw = (texto ?? "").toString();
    const trimmed = raw.trim();
    if (!trimmed) return 0;
    const parenNegative =
      trimmed.includes("(") && trimmed.includes(")") && !trimmed.includes("-");
    let limpio = raw
      .replace(/[−–—]/g, "-")
      .replace(/[()]/g, "")
      .replace(/[^0-9+.,-]/g, "");
    if (!limpio) return 0;
    const tieneComma = limpio.indexOf(",") >= 0;
    const tieneDot = limpio.indexOf(".") >= 0;
    if (tieneComma && tieneDot) {
      const lastDot = limpio.lastIndexOf(".");
      const lastComma = limpio.lastIndexOf(",");
      if (lastDot > lastComma) {
        limpio = limpio.replace(/,/g, "");
      } else {
        limpio = limpio.replace(/\./g, "");
        limpio = limpio.replace(/,/g, ".");
      }
    } else if (tieneComma && !tieneDot) {
      const partes = limpio.split(",");
      if (partes.length > 1 && partes[1].length === 3) {
        limpio = limpio.replace(/,/g, "");
      } else {
        limpio = limpio.replace(/,/g, ".");
      }
    }
    if ((limpio.match(/\./g) || []).length > 1) {
      const partes = limpio.split(".");
      const decimal = partes.pop();
      limpio = `${partes.join("")}.${decimal}`;
    }
    const numero = Number(limpio);
    if (!Number.isFinite(numero)) return 0;
    return parenNegative ? -Math.abs(numero) : numero;
  };

  const formatearNumero = (valor) => {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return "0.00";
    const fijo = numero.toFixed(2);
    const [entero, decimales] = fijo.split(".");
    const enteroConComas = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return `${enteroConComas}.${decimales}`;
  };

  const ensureToggleButton = () => {
    const existing = document.querySelector(TOGGLE_SELECTOR);
    if (existing) return existing;
    const toolbar =
      document.querySelector(".row.mb-3 .d-flex.flex-column.flex-md-row.gap-2") ||
      document.querySelector(".row.mb-3 .d-flex.flex-column.flex-md-row") ||
      document.getElementById("btnExportExcel")?.parentElement ||
      document.getElementById("btnPrintPDF")?.parentElement;
    if (!toolbar) return null;

    const existingToolbarToggle =
      toolbar.querySelector(`[data-bs-target="#${PANEL_ID}"]`) ||
      toolbar.querySelector(
        `[data-bs-toggle="collapse"][href="#${PANEL_ID}"]`
      );
    if (existingToolbarToggle) {
      existingToolbarToggle.setAttribute("data-operativo-toggle", "panel");
      return existingToolbarToggle;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-outline-primary btn-sm";
    button.setAttribute("data-bs-toggle", "collapse");
    button.setAttribute("data-bs-target", `#${PANEL_ID}`);
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", PANEL_ID);
    button.setAttribute("data-operativo-toggle", "panel");
    button.innerHTML = '<i class="bi bi-bar-chart"></i> Graficas';

    const excelBtn = document.getElementById("btnExportExcel");
    if (excelBtn && excelBtn.parentElement === toolbar) {
      toolbar.insertBefore(button, excelBtn);
    } else {
      toolbar.appendChild(button);
    }
    return button;
  };

  const ensureSidebarPanel = () => {
    const existing = document.querySelector(PANEL_SELECTOR);
    if (existing) return existing;
    const table = document.querySelector(TABLE_SELECTOR);
    if (!table) return null;

    const parentRow =
      table.closest(".row") ||
      document.querySelector(".row.g-4.align-items-start") ||
      null;
    const host = parentRow?.parentElement;
    if (!host) return null;

    const row = document.createElement("div");
    row.className = "row mb-3";
    row.innerHTML = `
      <div class="col-12">
        <div class="collapse operativo-panel" id="${PANEL_ID}" data-operativo-label="${escapeHtml(
      getDefaultOperativoLabel()
    )}">
          <div class="sidebar-card">
            <div class="d-flex align-items-start justify-content-between gap-2 mb-3">
              <div>
                <h5 class="sidebar-title">Graficas manuales</h5>
                <div class="sidebar-subtitle" data-operativo-subtitle>
                  Por ${escapeHtml(getDefaultOperativoLabel())}
                </div>
              </div>
              <div class="d-flex align-items-center gap-2">
                <span class="badge text-bg-light border">Manual</span>
                <button
                  type="button"
                  class="btn-close"
                  data-bs-toggle="collapse"
                  data-bs-target="#${PANEL_ID}"
                  aria-label="Cerrar"
                ></button>
              </div>
            </div>
            <div class="row g-3">
              <div class="col-12">
                <div class="chart-block">
                  <div class="chart-title">Ppto. Acumulado vs Real + Presupuesto</div>
                  <div class="chart-container" data-operativo-chart="combined">
                    <div class="sidebar-empty" data-operativo-empty="combined">
                      Sin datos de resultado operativo.
                    </div>
                    <canvas id="${CANVAS_COMBINED_ID}"></canvas>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    if (parentRow) {
      parentRow.insertAdjacentElement("beforebegin", row);
    } else {
      host.appendChild(row);
    }
    return row.querySelector(PANEL_SELECTOR);
  };

  const ensureSidebarUi = () => {
    const toggle = ensureToggleButton();
    const sidebar = ensureSidebarPanel();
    return { toggle, sidebar };
  };

  const obtenerIndices = (tabla) => {
    const headerRows = Array.from(tabla?.querySelectorAll("thead tr") || []);
    if (!headerRows.length) {
      console.log("📊 obtenerIndices: No se encontraron filas de encabezado");
      return { budgetTotal: -1, realTotal: -1, annual: -1 };
    }

    let idxTotalBudget = -1;
    let idxTotalReal = -1;
    let idxBudgetAnnual = -1;

    console.log("📊 obtenerIndices: Analizando", headerRows.length, "filas de encabezado");

    const buscarPorTexto = (matcher) => {
      // Preferir celdas "hoja" (sin colspan) para que el índice coincida con tbody.
      for (let pass = 0; pass < 2; pass += 1) {
        const allowColspan = pass === 1;
        for (const row of headerRows) {
          const headers = Array.from(row.children || []);
          for (const headerCell of headers) {
            const span = Number(headerCell?.colSpan) || 1;
            if (!allowColspan && span > 1) continue;
            const text = normalizeWhitespace(headerCell?.textContent || "").toLowerCase();
            if (!text) continue;
            if (matcher(text)) {
              const idx = getHeaderCellStartIndex(headerCell);
              console.log(
                `📊 obtenerIndices: Encontrada columna en índice ${idx} con texto: "${text}"`
              );
              return idx;
            }
          }
        }
      }
      return -1;
    };

    headerRows.forEach((row) => {
      const headers = Array.from(row.children || []);
      headers.forEach((th) => {
        const idx = getHeaderCellStartIndex(th);
        const text = normalizeWhitespace(th?.textContent || "");

        if (idxTotalBudget < 0 && th.classList.contains("total-budget-column")) {
          console.log(`📊 obtenerIndices: total-budget-column encontrada en índice ${idx}: "${text}"`);
          idxTotalBudget = idx;
        }
        if (idxTotalReal < 0 && th.classList.contains("total-real-column")) {
          console.log(`📊 obtenerIndices: total-real-column encontrada en índice ${idx}: "${text}"`);
          idxTotalReal = idx;
        }
        if (idxBudgetAnnual < 0 && th.classList.contains("budget-annual-column")) {
          console.log(`📊 obtenerIndices: budget-annual-column encontrada en índice ${idx}: "${text}"`);
          idxBudgetAnnual = idx;
        }
      });
    });

    if (idxTotalBudget < 0) {
      console.log("📊 obtenerIndices: Buscando total-budget por texto...");
      idxTotalBudget = buscarPorTexto(
        (text) =>
          (text.includes("ppto") || text.includes("presupuesto")) &&
          text.includes("acum")
      );
    }
    if (idxTotalReal < 0) {
      console.log("📊 obtenerIndices: Buscando total-real por texto...");
      idxTotalReal = buscarPorTexto(
        (text) => text.includes("real") && text.includes("acum")
      );
    }
    if (idxBudgetAnnual < 0) {
      console.log("📊 obtenerIndices: Buscando budget-annual por texto (anual/annual)...");
      // Buscar primero por "anual" o "annual"
      idxBudgetAnnual = buscarPorTexto(
        (text) =>
          text.includes("anual") || text.includes("annual")
      );
    }
    if (idxBudgetAnnual < 0) {
      console.log("📊 obtenerIndices: Buscando budget-annual por texto (presupuesto sin acumulado)...");
      // Si no encuentra, buscar por presupuesto sin acumulado
      idxBudgetAnnual = buscarPorTexto(
        (text) =>
          (text.includes("ppto") || text.includes("presupuesto")) &&
          !text.includes("acum") &&
          !text.includes("accumulated")
      );
    }

    console.log("📊 obtenerIndices: budgetTotal =", idxTotalBudget, ", realTotal =", idxTotalReal, ", annual =", idxBudgetAnnual);

    return {
      budgetTotal: idxTotalBudget >= 0 ? idxTotalBudget : idxBudgetAnnual,
      realTotal: idxTotalReal,
      annual: idxBudgetAnnual,
    };
  };

  const MONTH_LABELS = {
    ene: "Ene",
    feb: "Feb",
    mar: "Mar",
    abr: "Abr",
    may: "May",
    jun: "Jun",
    jul: "Jul",
    ago: "Ago",
    sep: "Sep",
    oct: "Oct",
    nov: "Nov",
    dic: "Dic",
  };

  const normalizeSeriesSelectionKey = (value) => {
    const normalized = normalizeKey(value);
    if (!normalized) return "";
    if (normalized === "BUDGET") return "TOTALBUDGET";
    if (normalized === "REAL") return "TOTALREAL";
    if (normalized === "ANNUAL") return "BUDGETANNUAL";
    return normalized;
  };

  const buildColumnDefinitions = (tabla) => {
    const headerRows = Array.from(tabla?.querySelectorAll("thead tr") || []);
    if (!headerRows.length) return [];
    const headerCells = Array.from(headerRows[headerRows.length - 1].cells || []);
    const defs = [];
    const seen = new Set();
    const pushDef = (definition) => {
      if (!definition || !Number.isInteger(definition.index) || definition.index < 0) {
        return;
      }
      if (!definition.key || seen.has(definition.key)) return;
      seen.add(definition.key);
      defs.push(definition);
    };

    let colIndex = 0;
    headerCells.forEach((cell) => {
      const index = colIndex;
      const span = Number(cell?.colSpan) || 1;
      colIndex += span;
      const text = normalizeWhitespace(cell?.textContent || "");
      if (cell.classList.contains("budget-annual-column")) {
        pushDef({
          key: "budgetAnnual",
          index,
          label: text || "Presupuesto anual",
          color: "#22c55e",
        });
        return;
      }
      if (cell.classList.contains("month-budget")) {
        const month = ((cell.dataset?.mes || "").toString().trim() || `m${index}`).toLowerCase();
        const monthLabel = MONTH_LABELS[month] || capitalizeLabel(month);
        pushDef({
          key: `monthBudget_${month}`,
          index,
          label: `${monthLabel} Ppto.`,
          color: "#60a5fa",
        });
        return;
      }
      if (cell.classList.contains("month-real")) {
        const month = ((cell.dataset?.mes || "").toString().trim() || `m${index}`).toLowerCase();
        const monthLabel = MONTH_LABELS[month] || capitalizeLabel(month);
        pushDef({
          key: `monthReal_${month}`,
          index,
          label: `${monthLabel} Real`,
          color: "#f59e0b",
        });
        return;
      }
      if (cell.classList.contains("total-budget-column")) {
        pushDef({
          key: "totalBudget",
          index,
          label: text || "Ppto. acumulado",
          color: "#4472c4",
        });
        return;
      }
      if (cell.classList.contains("total-real-column")) {
        pushDef({
          key: "totalReal",
          index,
          label: text || "Real acumulado",
          color: "#ffc000",
        });
      }
    });

    return defs.sort((a, b) => a.index - b.index);
  };

  const limpiarEtiqueta = (texto) => {
    const base = (texto || "").toString().trim();
    if (!base) return "";
    const lower = base.toLowerCase();
    const prefijo = "resultado operativo";
    if (lower.startsWith(prefijo)) {
      const recorte = base.slice(prefijo.length).trim();
      return recorte || base;
    }
    return base;
  };

  const resolverEtiquetaFila = (fila) => {
    const cells = Array.from(fila?.cells || []);
    if (!cells.length) return "";
    for (let idx = 1; idx < cells.length; idx += 1) {
      const text = getCellText(cells[idx]);
      if (/[A-Za-z\u00c0-\u024f]/.test(text)) {
        return text;
      }
    }
    return getCellText(cells[1] || cells[0]);
  };

  const obtenerFilasOperativas = (tabla) => {
    const rows = Array.from(tabla?.querySelectorAll("tbody tr") || []);
    if (!rows.length) return [];
    const direct = rows.filter(
      (row) =>
        row.classList.contains("sum-row-operativo") ||
        row.classList.contains("sum-row-operativo-consolidado")
    );
    if (direct.length) return direct;

    return rows.filter((row) => {
      const etiqueta = resolverEtiquetaFila(row).toLowerCase();
      return (
        etiqueta.includes("resultado operativo") ||
        etiqueta.includes("operating result")
      );
    });
  };

  const obtenerDatos = (tabla) => {
    const indices = obtenerIndices(tabla);
    if (
      indices.budgetTotal == null ||
      indices.budgetTotal < 0 ||
      indices.realTotal < 0
    ) {
      console.log("📊 obtenerDatos: Indices invalidos:", indices);
      return [];
    }
    const annualIdx = indices.annual >= 0 ? indices.annual : indices.budgetTotal;
    console.log("📊 obtenerDatos: usando annualIdx =", annualIdx, ", indices.annual =", indices.annual);

    const filas = obtenerFilasOperativas(tabla);
    const datos = filas
      .map((fila) => {
        const etiqueta = resolverEtiquetaFila(fila);
        if (!etiqueta) return null;
        const identifier = resolverIdentificadorFila(fila);
        const displayLabel = formatLabelWithId(etiqueta, identifier);
        const presupuesto = parseNumero(getCellText(fila.cells?.[indices.budgetTotal]));
        const real = parseNumero(getCellText(fila.cells?.[indices.realTotal]));
        const anual = parseNumero(getCellText(fila.cells?.[annualIdx]));

        if (etiqueta) {
          console.log(`📊 obtenerDatos: ${etiqueta} - presupuesto: ${presupuesto}, real: ${real}, anual: ${anual}`);
        }

        return { etiqueta, displayLabel, identifier, presupuesto, real, anual };
      })
      .filter((item) => item.etiqueta);

    console.log("📊 obtenerDatos: Total filas obtenidas:", datos.length);
    return datos;
  };

  const obtenerDatosFilas = (tabla, columnDefs = []) => {
    const indices = obtenerIndices(tabla);
    if (
      indices.budgetTotal == null ||
      indices.budgetTotal < 0 ||
      indices.realTotal < 0
    ) {
      return [];
    }
    const annualIdx = indices.annual >= 0 ? indices.annual : indices.budgetTotal;
    const filas = Array.from(tabla.querySelectorAll("tbody tr"));
    return filas
      .map((fila) => {
        const cells = fila.cells || [];
        const identifier = resolverIdentificadorFila(fila);
        const etiqueta = resolverEtiquetaFila(fila);
        if (!etiqueta) return null;
        const displayLabel = formatLabelWithId(etiqueta, identifier);
        const values = {};
        columnDefs.forEach((def) => {
          values[def.key] = parseNumero(getCellText(cells?.[def.index]));
        });
        const totalBudgetValue = Number(values.totalBudget);
        const totalRealValue = Number(values.totalReal);
        const budgetAnnualValue = Number(values.budgetAnnual);
        const presupuesto = Number.isFinite(totalBudgetValue)
          ? totalBudgetValue
          : parseNumero(getCellText(cells?.[indices.budgetTotal]));
        const real = Number.isFinite(totalRealValue)
          ? totalRealValue
          : parseNumero(getCellText(cells?.[indices.realTotal]));
        const anual = Number.isFinite(budgetAnnualValue)
          ? budgetAnnualValue
          : parseNumero(getCellText(cells?.[annualIdx]));

        if (!Number.isFinite(totalBudgetValue)) {
          values.totalBudget = presupuesto;
        }
        if (!Number.isFinite(totalRealValue)) {
          values.totalReal = real;
        }
        if (!Number.isFinite(budgetAnnualValue)) {
          values.budgetAnnual = anual;
        }
        return {
          etiqueta,
          displayLabel,
          key: normalizeKey(etiqueta),
          accountKey: normalizeKey(identifier),
          presupuesto,
          real,
          anual,
          identifier,
          values,
        };
      })
      .filter(Boolean);
  };

  const matchRowByVariants = (rowsData, variants = []) => {
    if (!rowsData?.length) return null;
    const keys = (Array.isArray(variants) ? variants : [variants])
      .map((value) => normalizeKey(value))
      .filter(Boolean);
    if (!keys.length) return null;
    for (const key of keys) {
      const exact = rowsData.find(
        (row) => row.key === key || row.accountKey === key
      );
      if (exact) return exact;
    }
    const keysByLength = [...keys].sort((a, b) => b.length - a.length);
    for (const key of keysByLength) {
      if (key.length < 3) continue;
      const partial = rowsData.find(
        (row) =>
          row.key.includes(key) ||
          (row.accountKey && row.accountKey.includes(key)) ||
          key.includes(row.key) ||
          (row.accountKey && key.includes(row.accountKey))
      );
      if (partial) return partial;
    }
    return null;
  };

  const eliminarGraficaManual = (chartId) => {
    const targetId = String(chartId || "").trim();
    if (!targetId) return false;
    const api = window.GraficasConfig;
    if (
      !api ||
      typeof api.load !== "function" ||
      typeof api.save !== "function"
    ) {
      return false;
    }
    try {
      const current = api.load();
      const currentCharts = Array.isArray(current?.customCharts)
        ? current.customCharts
        : [];
      const defaultCharts = Array.isArray(api.defaults?.customCharts)
        ? api.defaults.customCharts
        : [];
      const isDefault = defaultCharts.some(
        (chart) => String(chart?.id || "").trim() === targetId
      );
      const filteredCharts = currentCharts.filter(
        (chart) => String(chart?.id || "").trim() !== targetId
      );
      if (filteredCharts.length === currentCharts.length) {
        return false;
      }
      const nextConfig = {
        ...current,
        customCharts: filteredCharts,
      };
      if (isDefault) {
        const deletedIds = Array.isArray(current?.deletedChartIds)
          ? [...current.deletedChartIds]
          : [];
        if (!deletedIds.includes(targetId)) {
          deletedIds.push(targetId);
        }
        nextConfig.deletedChartIds = deletedIds;
      }
      const hasEnabledCharts = filteredCharts.some(
        (chart) =>
          chart?.enabled !== false &&
          Array.isArray(chart?.rows) &&
          chart.rows.length > 0
      );
      if (!hasEnabledCharts) {
        nextConfig.manualOnly = false;
      }
      api.save(nextConfig);
      return true;
    } catch (error) {
      console.warn("No se pudo eliminar la grafica manual.", error);
      return false;
    }
  };

  const ajustarAltura = (contenedor, total) => {
    if (!contenedor) return;
    const altura = Math.min(760, Math.max(260, total * 36 + 140));
    contenedor.style.height = `${altura}px`;
  };

  const buildCombinedDatasets = ({
    labels,
    presupuestos,
    reales,
    anuales,
    colors,
    labelsConfig,
    enabledConfig,
    chartType,
  }) => {
    const labelsSafe = labelsConfig || {};
    const enabledSafe = enabledConfig || {};
    const labelBudget =
      labelsSafe.budget || DEFAULT_OPERATIVO_CONFIG.datasets.budget.label;
    const labelReal =
      labelsSafe.real || DEFAULT_OPERATIVO_CONFIG.datasets.real.label;
    const labelAnnual =
      labelsSafe.annual || DEFAULT_OPERATIVO_CONFIG.datasets.annual.label;
    const budgetEnabled = enabledSafe.budget !== false;
    const realEnabled = enabledSafe.real !== false;
    const annualEnabled = enabledSafe.annual !== false;
    const isPie = isPieType(chartType);

    if (isPie) {
      return [
        {
          type: chartType,
          label: labelBudget,
          data: presupuestos,
          backgroundColor: buildSlicePalette(labels.length, colors.budget),
          borderColor: "#ffffff",
          borderWidth: 1,
          hidden: !budgetEnabled,
        },
        {
          type: chartType,
          label: labelReal,
          data: reales,
          backgroundColor: buildSlicePalette(labels.length, colors.real),
          borderColor: "#ffffff",
          borderWidth: 1,
          hidden: !realEnabled,
        },
        {
          type: chartType,
          label: labelAnnual,
          data: anuales,
          backgroundColor: buildSlicePalette(labels.length, colors.annual),
          borderColor: "#ffffff",
          borderWidth: 1,
          hidden: !annualEnabled,
        },
      ];
    }

    if (chartType === "line") {
      return [
        {
          type: "line",
          label: labelBudget,
          data: presupuestos,
          borderColor: colors.budget,
          backgroundColor: colors.budget,
          borderWidth: 2,
          tension: 0.3,
          pointRadius: POINT_RADIUS,
          pointHoverRadius: POINT_HOVER_RADIUS,
          fill: false,
          hidden: !budgetEnabled,
        },
        {
          type: "line",
          label: labelReal,
          data: reales,
          borderColor: colors.real,
          backgroundColor: colors.real,
          borderWidth: 2,
          tension: 0.3,
          pointRadius: POINT_RADIUS,
          pointHoverRadius: POINT_HOVER_RADIUS,
          fill: false,
          hidden: !realEnabled,
        },
        {
          type: "line",
          label: labelAnnual,
          data: anuales,
          borderColor: colors.annual,
          backgroundColor: colors.annual,
          borderWidth: 2,
          tension: 0.3,
          pointRadius: POINT_RADIUS,
          pointHoverRadius: POINT_HOVER_RADIUS,
          fill: false,
          hidden: !annualEnabled,
        },
      ];
    }

    return [
      {
        type: "bar",
        label: labelBudget,
        data: presupuestos,
        backgroundColor: colors.budget,
        borderColor: colors.budget,
        borderRadius: 10,
        borderWidth: 1,
        borderSkipped: false,
        maxBarThickness: 26,
        minBarLength: MIN_BAR_LENGTH,
        order: 1,
        hidden: !budgetEnabled,
      },
      {
        type: "bar",
        label: labelReal,
        data: reales,
        backgroundColor: colors.real,
        borderColor: colors.real,
        borderRadius: 10,
        borderWidth: 1,
        borderSkipped: false,
        maxBarThickness: 26,
        minBarLength: MIN_BAR_LENGTH,
        order: 2,
        hidden: !realEnabled,
      },
      {
        type: "line",
        label: labelAnnual,
        data: anuales,
        borderColor: colors.annual,
        backgroundColor: colors.annual,
        borderWidth: 2,
        tension: 0.3,
        pointRadius: POINT_RADIUS,
        pointHoverRadius: POINT_HOVER_RADIUS,
        fill: false,
        spanGaps: false,
        order: 3,
        hidden: !annualEnabled,
      },
    ];
  };

  const construirChart = ({
    ctx,
    labels,
    presupuestos,
    reales,
    anuales,
    colors,
    labelsConfig,
    enabledConfig,
    chartType,
  }) => {
    const gridColor = "rgba(47, 84, 150, 0.08)";
    const axisColor = "rgba(47, 84, 150, 0.55)";
    const resolvedType = chartType || "bar";
    return new Chart(ctx, {
      type: resolvedType,
      data: {
        labels,
        datasets: buildCombinedDatasets({
          labels,
          presupuestos,
          reales,
          anuales,
          colors,
          labelsConfig,
          enabledConfig,
          chartType: resolvedType,
        }),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: resolvedType === "bar" ? "y" : "x",
        layout: {
          padding: { left: 6, right: 16, top: 8, bottom: 8 },
        },
        plugins: {
          legend: {
            display: true,
            position: "bottom",
            labels: { color: "#1f2937", font: { size: 11, weight: "600" } },
          },
          tooltip: {
            backgroundColor: "#0f172a",
            borderColor: "rgba(255, 255, 255, 0.1)",
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: (ctx) => formatearNumero(ctx.raw),
            },
          },
        },
        scales: {
          x: {
            ...(resolvedType === "bar" ? { beginAtZero: true } : {}),
            grid: {
              color: gridColor,
              drawBorder: false,
            },
            ticks: {
              color: axisColor,
              font: { size: 11, weight: "500" },
              callback: (valor) => formatearNumero(valor),
            },
          },
          y: {
            grid: { display: false },
            ticks: {
              autoSkip: false,
              color: "#1f2937",
              font: { size: 13, weight: "700" },
              padding: 10,
              callback: (valor, idx, ticks) => ticks?.[idx]?.label || "",
            },
          },
        },
      },
    });
  };

  const actualizarChart = ({
    labels,
    presupuestos,
    reales,
    anuales,
    colors,
    labelsConfig,
    enabledConfig,
    chartType,
  }) => {
    const canvas = document.getElementById(CANVAS_COMBINED_ID);
    const empty = document.querySelector('[data-operativo-empty="combined"]');
    if (!canvas) return;
    if (!labels.length) {
      if (charts.combined) {
        charts.combined.destroy();
        charts.combined = null;
        charts.combinedType = null;
      }
      if (empty) empty.style.display = "flex";
      canvas.style.display = "none";
      return;
    }

    if (empty) empty.style.display = "none";
    canvas.style.display = "block";
    const ctx = canvas.getContext("2d");
    const resolvedType = chartType || "bar";
    if (charts.combined && charts.combinedType !== resolvedType) {
      charts.combined.destroy();
      charts.combined = null;
      charts.combinedType = null;
    }

    const datasets = buildCombinedDatasets({
      labels,
      presupuestos,
      reales,
      anuales,
      colors,
      labelsConfig,
      enabledConfig,
      chartType: resolvedType,
    });

    if (!charts.combined || charts.combined.data.datasets.length !== 3) {
      charts.combined = construirChart({
        ctx,
        labels,
        presupuestos,
        reales,
        anuales,
        colors,
        labelsConfig,
        enabledConfig,
        chartType: resolvedType,
      });
      charts.combinedType = resolvedType;
      return;
    }

    charts.combined.data.labels = labels;
    charts.combined.data.datasets = datasets;
    charts.combined.options.indexAxis =
      resolvedType === "bar" ? "y" : "x";
    charts.combined.update();
  };

  const clearCustomCharts = (container) => {
    Object.values(charts.custom || {}).forEach((chart) => {
      chart?.destroy?.();
    });
    charts.custom = {};
    container?.querySelectorAll("[data-operativo-custom]").forEach((node) => {
      node.remove();
    });
  };

  const renderCustomCharts = ({
    sidebar,
    tabla,
    graficasConfig,
    labelsConfig,
    colors,
    enabledConfig,
    templateValues,
  }) => {
    if (!sidebar || !tabla) return 0;
    const container = sidebar.querySelector(".row.g-3");
    if (!container) return 0;

    clearCustomCharts(container);

    const customChartsList = Array.isArray(graficasConfig.customCharts)
      ? graficasConfig.customCharts
      : [];
    if (!customChartsList.length) return 0;

    const moduleKey = getCurrentModuleKey();
    if (!moduleKey) return 0;

    const columnDefs = buildColumnDefinitions(tabla);
    const rowsData = obtenerDatosFilas(tabla, columnDefs);
    if (!rowsData.length) return 0;

    const baseDatasetDefs = columnDefs.map((definition) => ({
      key: definition.key,
      valueKey: definition.key,
      label: definition.label,
      color: definition.color || "#0d47a1",
      enabled: true,
    }));

    if (!baseDatasetDefs.some((def) => def.key === "budgetAnnual")) {
      baseDatasetDefs.push({
        key: "budgetAnnual",
        valueKey: "budgetAnnual",
        label: labelsConfig?.annual || "Presupuesto anual",
        color: colors?.annual || "#22c55e",
        enabled: true,
      });
    }

    if (!baseDatasetDefs.length) return 0;

    const baseChartType = graficasConfig.chart?.type || "bar";
    let rendered = 0;

    customChartsList.forEach((chart, index) => {
      if (chart?.enabled === false) return;
      const chartModuleKey = normalizeModuleKey(chart?.module || "RESUMEN");
      if (chartModuleKey && chartModuleKey !== moduleKey) return;
      const rows = Array.isArray(chart?.rows) ? chart.rows : [];
      if (!rows.length) return;

      const chartType = resolveChartType(chart?.chartType, baseChartType);
      const isPie = isPieType(chartType);
      const requestedSeriesKeys =
        Array.isArray(chart?.seriesKeys) && chart.seriesKeys.length
          ? chart.seriesKeys
          : ["totalBudget", "totalReal", "budgetAnnual"];
      const datasetDefs = applyCustomSeriesOverrides(
        filterSeriesByKeys(baseDatasetDefs, requestedSeriesKeys),
        chart
      ).map((def) => {
        const resolvedLabel = applyTemplate(def.label, templateValues || {}).trim();
        return {
          ...def,
          label: resolvedLabel || def.label || "",
        };
      });
      if (!datasetDefs.length) return;

      const labels = [];
      const seriesData = datasetDefs.reduce((acc, def) => {
        acc[def.key] = [];
        return acc;
      }, {});

      rows.forEach((row, rowIndex) => {
        const variants =
          Array.isArray(row?.variants) && row.variants.length
            ? row.variants
            : row?.label
              ? [row.label]
              : row?.alias
                ? [row.alias]
                : [];
        const label =
          row?.alias || row?.label || variants[0] || `Fila ${rowIndex + 1}`;
        const match = matchRowByVariants(rowsData, variants);
        labels.push(match ? formatLabelWithId(label, match.identifier) : label);
        datasetDefs.forEach((def) => {
          const value = match ? Number(match.values?.[def.valueKey]) || 0 : 0;
          seriesData[def.key].push(value);
        });
      });

      const datasets = datasetDefs.map((def) => {
        const rawValues = seriesData[def.key] || [];
        const data = rawValues;
        const dataset = {
          label: def.label,
          data,
          borderWidth: isPie ? 1 : chartType === "line" ? 2 : 1,
        };
        if (isPie) {
          dataset.backgroundColor = buildSlicePalette(data.length, def.color);
          dataset.borderColor = "#ffffff";
          return dataset;
        }
        dataset.backgroundColor = def.color;
        dataset.borderColor = def.color;
        if (chartType === "line") {
          dataset.fill = false;
          dataset.tension = 0.3;
          dataset.pointRadius = POINT_RADIUS;
          dataset.pointHoverRadius = POINT_HOVER_RADIUS;
          dataset.pointBackgroundColor = def.color;
        } else if (chartType === "bar") {
          dataset.borderRadius = 10;
          dataset.maxBarThickness = 26;
          dataset.minBarLength = MIN_BAR_LENGTH;
        }
        return dataset;
      });

      const hasData = rows.some((row) => {
        const variants =
          Array.isArray(row?.variants) && row.variants.length
            ? row.variants
            : row?.label
              ? [row.label]
              : row?.alias
                ? [row.alias]
                : [];
        return Boolean(matchRowByVariants(rowsData, variants));
      });

      const safeId = (chart?.id || `custom-${index + 1}`)
        .toString()
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, "");
      const canvasId = `operativoChartCustom-${safeId || index + 1}`;
      const chartKey = `custom-${safeId || index + 1}`;
      const chartIdRaw = String(chart?.id || "").trim();
      const titleTemplate = chart?.title || `Grafica personalizada ${index + 1}`;
      const titleText =
        applyTemplate(titleTemplate, templateValues || {}).trim() ||
        `Grafica personalizada ${index + 1}`;
      const subtitleText = applyTemplate(
        chart?.subtitle || "",
        templateValues || {}
      ).trim();

      const wrapper = document.createElement("div");
      wrapper.className = "col-12";
      wrapper.setAttribute("data-operativo-custom", "true");
      wrapper.innerHTML = `
        <div class="chart-block">
          <div class="d-flex align-items-center justify-content-between gap-2 mb-1">
            <div class="chart-title mb-0">${escapeHtml(titleText)}</div>
            ${chartIdRaw
          ? `<button type="button" class="btn btn-outline-danger btn-sm py-0 px-2" data-operativo-delete-chart data-chart-id="${escapeHtml(
            chartIdRaw
          )}" title="Eliminar grafica">
                    <i class="bi bi-trash"></i>
                  </button>`
          : ""
        }
          </div>
          ${subtitleText ? `<div class="text-muted small mb-1">${escapeHtml(subtitleText)}</div>` : ""}
          <div class="chart-container" data-operativo-chart="${chartKey}">
            <div class="sidebar-empty" data-operativo-empty="${chartKey}">
              Sin datos para esta grafica.
            </div>
            <canvas id="${canvasId}"></canvas>
          </div>
        </div>
      `;

      container.appendChild(wrapper);
      rendered += 1;

      const deleteButton = wrapper.querySelector("[data-operativo-delete-chart]");
      if (deleteButton) {
        deleteButton.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const chartId = deleteButton.getAttribute("data-chart-id") || "";
          const confirmed = window.confirm(
            "Esta grafica se eliminara del gestor. Deseas continuar?"
          );
          if (!confirmed) return;
          eliminarGraficaManual(chartId);
        });
      }

      const canvas = wrapper.querySelector("canvas");
      const empty = wrapper.querySelector(`[data-operativo-empty="${chartKey}"]`);
      const chartContainer = wrapper.querySelector(".chart-container");
      if (chartContainer) {
        if (isPie) {
          chartContainer.style.height = "320px";
        } else {
          ajustarAltura(chartContainer, labels.length);
        }
      }

      if (!canvas) return;
      if (!hasData) {
        if (empty) empty.style.display = "flex";
        canvas.style.display = "none";
        return;
      }

      if (empty) empty.style.display = "none";
      canvas.style.display = "block";

      const ctx = canvas.getContext("2d");
      charts.custom[canvasId] = new Chart(ctx, {
        type: chartType,
        data: {
          labels,
          datasets,
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: chartType === "bar" ? "y" : "x",
          plugins: {
            legend: {
              display: true,
              position: "bottom",
              labels: { color: "#1f2937", font: { size: 11, weight: "600" } },
            },
            tooltip: {
              backgroundColor: "#0f172a",
              borderColor: "rgba(255, 255, 255, 0.1)",
              borderWidth: 1,
              padding: 10,
              callbacks: {
                label: (ctx) => {
                  const label = ctx.dataset?.label ? `${ctx.dataset.label}: ` : "";
                  return `${label}${formatearNumero(getParsedValue(ctx))}`;
                },
              },
            },
          },
          scales: isPie
            ? {}
            : {
              x: {
                ...(chartType === "bar" ? { beginAtZero: true } : {}),
                grid: { color: "rgba(47, 84, 150, 0.08)", drawBorder: false },
                ticks: {
                  color: "rgba(47, 84, 150, 0.55)",
                  font: { size: 11, weight: "500" },
                  callback: (valor) => formatearNumero(valor),
                },
              },
              y: {
                grid: { display: false },
                ticks: {
                  autoSkip: false,
                  color: "#1f2937",
                  font: { size: 12, weight: "700" },
                  padding: 10,
                  callback: (valor, idx, ticks) => ticks?.[idx]?.label || "",
                },
              },
            },
        },
      });
    });
    return rendered;
  };

  const actualizarSidebar = () => {
    const sidebar = document.querySelector(PANEL_SELECTOR);
    const toggleButton = document.querySelector(TOGGLE_SELECTOR);
    const tabla = document.querySelector(TABLE_SELECTOR);
    if (!sidebar || !tabla || typeof Chart === "undefined") return;

    const graficasConfig = getGraficasConfig();
    const operativoConfig = graficasConfig.operativo || DEFAULT_OPERATIVO_CONFIG;
    const moduleKey = getCurrentModuleKey();
    const hasCustomCharts = hasEnabledCustomChartsForModule(
      graficasConfig,
      moduleKey
    );
    const showOperativo = operativoConfig.enabled !== false;
    const shouldShowPanel = showOperativo || hasCustomCharts;
    const baseChartType = graficasConfig.chart?.type || "bar";
    const resolvedChartType = resolveChartType(
      operativoConfig.chartType,
      baseChartType
    );
    if (!shouldShowPanel) {
      sidebar.style.display = "none";
      if (toggleButton) toggleButton.style.display = "none";
      return;
    }
    sidebar.style.display = "";
    if (toggleButton) toggleButton.style.display = "";

    const contenedor = sidebar.querySelector(
      '[data-operativo-chart="combined"]'
    );
    const combinedBlock = contenedor?.closest(".chart-block");
    const datasetDefaults = DEFAULT_OPERATIVO_CONFIG.datasets;
    const datasetConfig = operativoConfig.datasets || {};
    const budgetCfg = datasetConfig.budget || datasetDefaults.budget;
    const realCfg = datasetConfig.real || datasetDefaults.real;
    const annualCfg = datasetConfig.annual || datasetDefaults.annual;
    const enabledConfig = {
      budget: budgetCfg.enabled !== false,
      real: realCfg.enabled !== false,
      annual: annualCfg.enabled !== false,
    };

    const colorBudget =
      budgetCfg.color || obtenerVariableCss("--color-budget", "#4472c4");
    const colorReal =
      realCfg.color || obtenerVariableCss("--color-real", "#ffc000");
    const colorAnnual =
      annualCfg.color || obtenerVariableCss("--color-annual", "#22c55e");

    const headerYear =
      tabla
        ?.querySelector("thead .budget-annual-column .anio")
        ?.textContent?.trim() || "";
    const parsedYear = Number.parseInt(
      String(headerYear || "").replace(/[^0-9]/g, ""),
      10
    );
    const prevYear = Number.isFinite(parsedYear) ? String(parsedYear - 1) : "";
    const annualFallback = headerYear ? `Presupuesto ${headerYear}` : "Presupuesto";
    const annualTemplate = annualCfg.label || datasetDefaults.annual.label;
    const budgetTemplate = budgetCfg.label || datasetDefaults.budget.label;
    const realTemplate = realCfg.label || datasetDefaults.real.label;
    const annualLabel =
      applyTemplate(annualTemplate, {
        year: headerYear,
        prev: prevYear,
        annual: annualFallback,
      }).trim() ||
      annualFallback;
    const budgetLabel =
      applyTemplate(budgetTemplate, {
        year: headerYear,
        prev: prevYear,
        annual: annualLabel,
      }).trim() ||
      budgetTemplate;
    const realLabel =
      applyTemplate(realTemplate, {
        year: headerYear,
        prev: prevYear,
        annual: annualLabel,
      }).trim() ||
      realTemplate;

    const tituloEl = contenedor
      ?.closest(".chart-block")
      ?.querySelector(".chart-title");
    if (tituloEl && showOperativo) {
      const titleTemplate = operativoConfig.title || DEFAULT_OPERATIVO_CONFIG.title;
      const titleText =
        applyTemplate(titleTemplate, {
          year: headerYear,
          prev: prevYear,
          annual: annualLabel,
        }).trim() ||
        titleTemplate;
      tituloEl.textContent = titleText;
    }

    if (showOperativo) {
      console.log(
        "📊 actualizarSidebar: Iniciando actualización de gráficas operativas"
      );
      const datos = obtenerDatos(tabla);
      console.log("📊 actualizarSidebar: Datos obtenidos:", datos);

      const labels = datos.map((item) => item.displayLabel || item.etiqueta);
      const presupuestos = normalizarSerie(
        datos.map((item) => item.presupuesto)
      );
      const reales = normalizarSerie(datos.map((item) => item.real));
      const anuales = normalizarSerie(datos.map((item) => item.anual));

      console.log("📊 actualizarSidebar: labels =", labels);
      console.log("📊 actualizarSidebar: presupuestos =", presupuestos);
      console.log("📊 actualizarSidebar: reales =", reales);
      console.log("📊 actualizarSidebar: anuales =", anuales);

      const hasEnabledDatasets = Object.values(enabledConfig).some(Boolean);
      const effectiveLabels = hasEnabledDatasets ? labels : [];
      ajustarAltura(contenedor, effectiveLabels.length);

      if (combinedBlock) combinedBlock.style.display = "";
      actualizarChart({
        labels: effectiveLabels,
        presupuestos,
        reales,
        anuales,
        colors: { budget: colorBudget, real: colorReal, annual: colorAnnual },
        labelsConfig: {
          budget: budgetLabel,
          real: realLabel,
          annual: annualLabel,
        },
        enabledConfig,
        chartType: resolvedChartType,
      });
    } else {
      if (combinedBlock) combinedBlock.style.display = "none";
      if (charts.combined) {
        charts.combined.destroy();
        charts.combined = null;
        charts.combinedType = null;
      }
    }

    renderCustomCharts({
      sidebar,
      tabla,
      graficasConfig,
      labelsConfig: {
        budget: budgetLabel,
        real: realLabel,
        annual: annualLabel,
      },
      colors: { budget: colorBudget, real: colorReal, annual: colorAnnual },
      enabledConfig,
      templateValues: {
        year: headerYear,
        prev: prevYear,
        annual: annualLabel,
      },
    });
  };

  const scheduleUpdate = () => {
    if (updateTimer) clearTimeout(updateTimer);
    updateTimer = setTimeout(actualizarSidebar, 120);
  };

  const resizeChartIfPossible = (chart) => {
    if (chart && typeof chart.resize === "function") {
      chart.resize();
    }
  };

  const resizeOperativoCharts = () => {
    resizeChartIfPossible(charts.combined);
    Object.values(charts.custom || {}).forEach((chart) =>
      resizeChartIfPossible(chart)
    );
  };

  const initObserver = () => {
    const tabla = document.querySelector(TABLE_SELECTOR);
    const cuerpo = tabla?.querySelector("tbody");
    if (!cuerpo || typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(() => scheduleUpdate());
    observer.observe(cuerpo, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  };

  const init = () => {
    const { sidebar } = ensureSidebarUi();
    if (!sidebar) return;
    if (!sidebar.dataset.operativoLabel) {
      sidebar.dataset.operativoLabel = getDefaultOperativoLabel();
    }
    const label = sidebar.dataset.operativoLabel;
    const subtitle = sidebar.querySelector("[data-operativo-subtitle]");
    if (label && subtitle) {
      subtitle.textContent = `Por ${label}`;
    }
    scheduleUpdate();
    sidebar.addEventListener("shown.bs.collapse", () => {
      scheduleUpdate();
      resizeOperativoCharts();
    });
    window.addEventListener("modulo-planeacion:tabla-actualizada", scheduleUpdate);
    window.addEventListener("modulo-planeacion:presupuesto-editado", scheduleUpdate);
    window.addEventListener("modulo-planeacion:contexto-actualizado", scheduleUpdate);
    window.addEventListener("modulo:ready", scheduleUpdate);
    window.addEventListener("graficas-config-updated", scheduleUpdate);
    initObserver();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
  window.__OperativoSidebarReady = true;
})();
