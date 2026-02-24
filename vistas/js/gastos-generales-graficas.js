(() => {
  "use strict";

  const MODULO = "gastosgenerales";
  const MESES = [
    "ene",
    "feb",
    "mar",
    "abr",
    "may",
    "jun",
    "jul",
    "ago",
    "sep",
    "oct",
    "nov",
    "dic",
  ];
  const MESES_LABELS = [
    "ENE",
    "FEB",
    "MAR",
    "ABR",
    "MAY",
    "JUN",
    "JUL",
    "AGO",
    "SEP",
    "OCT",
    "NOV",
    "DIC",
  ];
  const TARGETS = [
    {
      id: "rendimientos",
      title: "Rendimientos de Inversion",
      canvasId: "ggChartRendimientos",
      match: (texto) => /RENDIMIENTOS/.test(texto) && /INVERSION/.test(texto),
    },
    {
      id: "plusvalia",
      title: "Plusvalia/Minusvalia",
      canvasId: "ggChartPlusvalia",
      match: (texto) => /PLUSVALIA|MINUSVALIA/.test(texto),
    },
  ];
  const DEFAULT_GASTOS_CONFIG = {
    enabled: true,
    subtitleTemplate: "Real {year} vs {prev}",
    charts: {
      rendimientos: {
        enabled: true,
        title: "Rendimientos de Inversion",
        chartType: "line",
        series: {
          actual: { label: "Real {year}", color: "#ffc000", enabled: true },
          prev: { label: "Real {prev}", color: "#2f5496", enabled: true },
        },
      },
      plusvalia: {
        enabled: true,
        title: "Plusvalia/Minusvalia",
        chartType: "line",
        series: {
          actual: { label: "Real {year}", color: "#ffc000", enabled: true },
          prev: { label: "Real {prev}", color: "#2f5496", enabled: true },
        },
      },
    },
  };
  const API_BASE = (() => {
    if (window.location.protocol === "file:") {
      return "http://localhost:3005/api";
    }
    return `${window.location.origin.replace(/\/$/, "")}/api`;
  })();

  const charts = {};
  const customCharts = {};
  let updateTimer = null;
  let requestId = 0;

  const getGraficasConfig = () => {
    if (window.GraficasConfig && typeof window.GraficasConfig.load === "function") {
      return window.GraficasConfig.load();
    }
    return { gastosGenerales: DEFAULT_GASTOS_CONFIG };
  };

  const isManualOnlyEnabled = (config) => config?.manualOnly === true;

  const getGastosConfig = () => {
    const config = getGraficasConfig();
    return config.gastosGenerales || DEFAULT_GASTOS_CONFIG;
  };

  const applyTemplate = (template, values = {}) => {
    if (!template) return "";
    const year = values.year || "";
    const prev = values.prev || "";
    return template
      .replace(/\{year\}/gi, year)
      .replace(/\{prev\}/gi, prev);
  };

  const normalizarTexto = (valor) => {
    if (valor == null) return "";
    return valor
      .toString()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();
  };

  const normalizarClaveModulo = (valor) => {
    const clean = normalizarTexto(valor);
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
    normalizarClaveModulo(
      document.body?.dataset?.modulo ||
        document.body?.dataset?.moduloAlias ||
        document.body?.dataset?.moduloId ||
        "Gastos Generales"
    );

  const moduleMatchesCurrent = (moduleValue) =>
    normalizarClaveModulo(moduleValue || "Gastos Generales") ===
    getCurrentModuleKey();

  const obtenerVariableCss = (nombre, fallback) => {
    if (!window.getComputedStyle) return fallback;
    const valor = getComputedStyle(document.documentElement)
      .getPropertyValue(nombre)
      .trim();
    return valor || fallback;
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

  const resolverIdentificadorFila = (row) => {
    if (!row) return "";
    const cells = row.cells || [];
    const fromCell = normalizeWhitespace(getCellText(cells?.[0]));
    if (fromCell) return fromCell;
    const data = row.dataset || {};
    return (
      normalizeWhitespace(data.cuentaVisible) ||
      normalizeWhitespace(data.cuenta21) ||
      normalizeWhitespace(data.cuenta) ||
      normalizeWhitespace(data.operationId) ||
      normalizeWhitespace(data.operacionClave) ||
      normalizeWhitespace(data.layoutOrder) ||
      ""
    );
  };

  const formatLabelWithId = (label, identifier) => {
    const cleanLabel = normalizeWhitespace(label);
    const cleanId = normalizeWhitespace(identifier);
    if (!cleanLabel) return "";
    if (!cleanId) return cleanLabel;
    if (cleanLabel.includes(cleanId)) return cleanLabel;
    return `${cleanLabel} (${cleanId})`;
  };

  const formatearNumero = (valor) => {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return "0.00";
    const fijo = numero.toFixed(2);
    const [entero, decimales] = fijo.split(".");
    const enteroConComas = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return `${enteroConComas}.${decimales}`;
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
    if (normalized === "inherit") return baseType || "line";
    return normalized;
  };

  const filterSeriesByKeys = (seriesList = [], keys = []) => {
    if (!Array.isArray(keys) || !keys.length) return seriesList;
    const keySet = new Set(
      keys.map((key) => String(key || "").trim()).filter(Boolean)
    );
    if (!keySet.size) return seriesList;
    const filtered = (seriesList || []).filter((serie) =>
      keySet.has(String(serie?.key || "").trim())
    );
    return filtered.length ? filtered : seriesList;
  };

  const applyCustomSeriesOverrides = (seriesList = [], chart = {}) => {
    const overrides = Array.isArray(chart?.series) ? chart.series : [];
    if (!overrides.length) return seriesList;
    const map = new Map(
      overrides
        .map((item) => {
          const key = String(item?.key || "").trim();
          if (!key) return null;
          return [key, item];
        })
        .filter(Boolean)
    );
    return (seriesList || []).map((serie) => {
      const override = map.get(String(serie?.key || "").trim());
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

  const obtenerAnioSeleccionado = () => {
    const select =
      document.querySelector('[data-role="module-year-select"]') ||
      document.querySelector('select[id$="YearSelect"]');
    const valorSelect = Number(select?.value);
    if (Number.isInteger(valorSelect)) return valorSelect;
    const ctx =
      typeof window.Sesion?.obtenerContextoPlaneacion === "function"
        ? window.Sesion.obtenerContextoPlaneacion()
        : null;
    const ctxAnio = Number(ctx?.anio);
    if (Number.isInteger(ctxAnio)) return ctxAnio;
    const dataAnio = Number(document.body?.dataset?.anio);
    if (Number.isInteger(dataAnio)) return dataAnio;
    return null;
  };

  const obtenerEmpresaId = () =>
    window.Sesion?.obtenerEmpresaActiva?.()?.id || null;

  const obtenerCapitulo = (empresaId) => {
    if (!empresaId) return null;
    return window.CapitulosModulos?.obtenerCapituloPorEmpresa?.(empresaId) || null;
  };

  const obtenerNombreModulo = () =>
    window.CapitulosModulos?.obtenerSheetPorModulo?.(MODULO) ||
    "Gastos Generales";

  const cargarLayoutSqlite = async ({ empresaId, anio, capitulo }) => {
    if (!empresaId || !Number.isInteger(anio) || !capitulo) return null;
    try {
      const params = new URLSearchParams({ empresaId });
      const moduloNombre = obtenerNombreModulo();
      const url = `${API_BASE}/layouts/${encodeURIComponent(
        moduloNombre
      )}/${anio}/${encodeURIComponent(capitulo)}?${params.toString()}`;
      const headers =
        typeof window.Sesion?.headersAutenticacion === "function"
          ? window.Sesion.headersAutenticacion()
          : {};
      const resp = await fetch(url, { headers });
      if (!resp.ok) return null;
      const data = await resp.json();
      return data?.layout || null;
    } catch (error) {
      console.warn("No fue posible cargar layout SQL para graficas", error);
      return null;
    }
  };

  const normalizarCuentaBase = (cuenta) => {
    if (!cuenta) return "";
    return cuenta
      .toString()
      .replace(/[^0-9A-Za-z]/g, "")
      .toUpperCase()
      .trim();
  };

  const deducirNivel = (baseVisible) => {
    const visible = normalizarCuentaBase(baseVisible)
      .slice(0, 11)
      .padEnd(11, "0");
    const b = visible.slice(3, 6);
    const c = visible.slice(6, 9);
    const d = visible.slice(9, 11);
    if (b === "000" && c === "000" && d === "00") return "1";
    if (c === "000" && d === "00") return "2";
    if (d === "00") return "3";
    return "4";
  };

  const convertirCuenta21 = (cuentaLegible) => {
    if (typeof window.cuentaLarga === "function") {
      const desdeVista = window.cuentaLarga(cuentaLegible);
      if (desdeVista) return desdeVista;
    }
    const entrada = normalizarCuentaBase(cuentaLegible);
    if (!entrada) return "";
    if (entrada.length >= 21) {
      return entrada.slice(0, 21);
    }
    const visible = entrada.slice(0, 11).padEnd(11, "0");
    const nivel = deducirNivel(visible);
    return visible.padEnd(20, "0") + nivel;
  };

  const obtenerCuentaDesdeFila = (fila) => {
    const cuenta21 = (fila?.dataset?.cuenta21 || "").trim();
    if (cuenta21) return cuenta21;
    const cuentaTexto = fila?.cells?.[0]?.textContent || "";
    return cuentaTexto ? convertirCuenta21(cuentaTexto) : "";
  };

  const obtenerCuentasDesdeTabla = (targets = TARGETS) => {
    const mapa = new Map();
    const filas = document.querySelectorAll(
      "#tablaComparacion tbody tr.fila-cuenta"
    );
    filas.forEach((fila) => {
      const nombre = normalizarTexto(fila?.cells?.[1]?.textContent || "");
      if (!nombre) return;
      const cuenta21 = obtenerCuentaDesdeFila(fila);
      if (!cuenta21) return;
      targets.forEach((target) => {
        if (mapa.has(target.id)) return;
        if (target.match(nombre)) {
          mapa.set(target.id, [cuenta21]);
        }
      });
    });
    return mapa;
  };

  const obtenerCuentasDesdeCatalogo = async (
    empresaId,
    anio,
    capitulo,
    targets = TARGETS
  ) => {
    const layout = await cargarLayoutSqlite({ empresaId, anio, capitulo });
    const registros = Array.isArray(layout?.cuentas) ? layout.cuentas : [];
    const mapa = new Map();
    registros.forEach((registro) => {
      if (!registro) return;
      const nombre = normalizarTexto(registro.NOMBRE || registro.nombre || "");
      if (!nombre) return;
      targets.forEach((target) => {
        if (!target.match(nombre)) return;
        const cuenta = convertirCuenta21(registro.CUENTA || registro.cuenta || "");
        if (!cuenta) return;
        const lista = mapa.get(target.id) || [];
        if (!lista.includes(cuenta)) {
          lista.push(cuenta);
        }
        mapa.set(target.id, lista);
      });
    });
    return mapa;
  };

  const resolverCuentasObjetivo = async (
    empresaId,
    anio,
    targets = TARGETS
  ) => {
    const resultado = new Map();
    const desdeTabla = obtenerCuentasDesdeTabla(targets);
    targets.forEach((target) => {
      const cuentas = desdeTabla.get(target.id) || [];
      if (cuentas.length) {
        resultado.set(target.id, cuentas);
      }
    });
    if (resultado.size === targets.length) {
      return resultado;
    }
    const capitulo = obtenerCapitulo(empresaId);
    const desdeCatalogo = await obtenerCuentasDesdeCatalogo(
      empresaId,
      anio,
      capitulo,
      targets
    );
    targets.forEach((target) => {
      if (resultado.has(target.id)) return;
      const cuentas = desdeCatalogo.get(target.id) || [];
      if (cuentas.length) {
        resultado.set(target.id, cuentas);
      }
    });
    return resultado;
  };

  const obtenerMapaCuentas = (cuentasPorObjetivo, targets = TARGETS) => {
    const todas = [];
    targets.forEach((target) => {
      const cuentas = cuentasPorObjetivo.get(target.id) || [];
      cuentas.forEach((cuenta) => {
        if (cuenta && !todas.includes(cuenta)) {
          todas.push(cuenta);
        }
      });
    });
    return todas;
  };

  const fetchDatos = async ({ empresaId, anio, cuentas }) => {
    if (!empresaId || !Number.isInteger(anio) || !cuentas.length) {
      return new Map();
    }
    const payload = {
      empresaId,
      anio,
      modulo: MODULO,
      cuentas,
    };
    const respuesta = await fetch(`${API_BASE}/planeacion/cuentas`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(window.Sesion?.headersAutenticacion?.() || {}),
      },
      body: JSON.stringify(payload),
    });
    const datos = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) {
      throw new Error(
        datos?.mensaje || "No fue posible obtener la informacion contable."
      );
    }
    const mapa = new Map();
    (datos.cuentas || []).forEach((registro) => {
      if (registro?.cuenta) {
        mapa.set(registro.cuenta, registro);
      }
    });
    return mapa;
  };

  const sumarRealPorMes = (mapa, cuentas) =>
    MESES.map((mes) => {
      let total = 0;
      cuentas.forEach((cuenta) => {
        const registro = mapa.get(cuenta);
        const valor = Number(registro?.real?.[mes]);
        if (Number.isFinite(valor)) {
          total += valor;
        }
      });
      return total;
    });

  const toggleEmpty = (targetId, mostrar, mensaje) => {
    const empty = document.querySelector(`[data-gg-empty="${targetId}"]`);
    if (!empty) return;
    if (mensaje) {
      empty.textContent = mensaje;
    }
    empty.style.display = mostrar ? "flex" : "none";
  };

  const clearDefaultCharts = () => {
    TARGETS.forEach((target) => {
      const chart = charts[target.id];
      if (chart) {
        chart.destroy();
        charts[target.id] = null;
      }
      const container = document.querySelector(`[data-gg-chart="${target.id}"]`);
      const col =
        container?.closest(".col-12") || container?.closest(".chart-block");
      if (col) col.style.display = "none";
      const canvas = container?.querySelector("canvas");
      if (canvas) canvas.style.display = "none";
      toggleEmpty(target.id, true, "Sin datos para graficar.");
    });
  };

  const clearCustomCharts = (container) => {
    Object.keys(customCharts).forEach((key) => {
      customCharts[key]?.destroy?.();
      delete customCharts[key];
    });
    if (!container) return;
    container.querySelectorAll("[data-gg-custom-chart]").forEach((node) => {
      node.remove();
    });
  };

  const buildChartDatasets = ({
    labels,
    dataActual,
    dataPrev,
    labelActual,
    labelPrev,
    colorActual,
    colorPrev,
    enabledActual,
    enabledPrev,
    chartType,
  }) => {
    const resolvedType = chartType || "line";
    const isPie = isPieType(resolvedType);
    const buildDataset = (label, data, color, enabled) => {
      const dataset = {
        label,
        data,
        borderWidth: resolvedType === "line" ? 2 : 1,
        hidden: enabled === false,
      };
      if (isPie) {
        dataset.backgroundColor = buildSlicePalette(labels.length, color);
        dataset.borderColor = "#ffffff";
        dataset.borderWidth = 1;
        return dataset;
      }
      dataset.backgroundColor = color;
      dataset.borderColor = color;
      if (resolvedType === "line") {
        dataset.pointBackgroundColor = color;
        dataset.pointBorderColor = color;
        dataset.tension = 0.3;
        dataset.pointRadius = 3;
        dataset.pointHoverRadius = 4;
        dataset.fill = false;
      } else if (resolvedType === "bar") {
        dataset.borderRadius = 8;
        dataset.maxBarThickness = 20;
      }
      return dataset;
    };
    return [
      buildDataset(labelActual, dataActual, colorActual, enabledActual),
      buildDataset(labelPrev, dataPrev, colorPrev, enabledPrev),
    ];
  };

  const construirChart = ({
    ctx,
    labels,
    dataActual,
    dataPrev,
    labelActual,
    labelPrev,
    colorActual,
    colorPrev,
    enabledActual,
    enabledPrev,
    chartType,
  }) => {
    const gridColor = "rgba(47, 84, 150, 0.08)";
    const axisColor = "rgba(47, 84, 150, 0.55)";
    const resolvedType = chartType || "line";
    const isPie = isPieType(resolvedType);
    return new Chart(ctx, {
      type: resolvedType,
      data: {
        labels,
        datasets: buildChartDatasets({
          labels,
          dataActual,
          dataPrev,
          labelActual,
          labelPrev,
          colorActual,
          colorPrev,
          enabledActual,
          enabledPrev,
          chartType: resolvedType,
        }),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: isPie ? "nearest" : "index",
          intersect: isPie,
        },
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              boxWidth: 12,
              boxHeight: 12,
              usePointStyle: true,
            },
          },
          tooltip: {
            backgroundColor: "#0f172a",
            borderColor: "rgba(255, 255, 255, 0.1)",
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: (ctx) => {
                const label = ctx.dataset?.label || "";
                return `${label}: ${formatearNumero(getParsedValue(ctx))}`;
              },
            },
          },
        },
        scales: isPie
          ? {}
          : {
              x: {
                grid: {
                  display: false,
                },
                ticks: {
                  color: axisColor,
                  font: { size: 11, weight: "600" },
                },
              },
              y: {
                ...(resolvedType === "bar" ? { beginAtZero: true } : {}),
                grid: {
                  color: gridColor,
                },
                ticks: {
                  color: axisColor,
                  font: { size: 11, weight: "500" },
                  callback: (valor) => formatearNumero(valor),
                },
              },
            },
      },
    });
  };

  const actualizarChart = ({
    target,
    dataActual,
    dataPrev,
    anio,
    chartConfig,
    chartType,
  }) => {
    const canvas = document.getElementById(target.canvasId);
    if (!canvas) return;

    const baseChart = DEFAULT_GASTOS_CONFIG.charts?.[target.id] || {};
    const resolvedChart = chartConfig || baseChart;
    const seriesCfg = resolvedChart.series || {};
    const actualCfg = seriesCfg.actual || baseChart.series?.actual || {};
    const prevCfg = seriesCfg.prev || baseChart.series?.prev || {};

    const actualEnabled = actualCfg.enabled !== false;
    const prevEnabled = prevCfg.enabled !== false;
    const resolvedType = chartType || "line";
    const hasEnabledSeries = actualEnabled || prevEnabled;

    const hasActualData = actualEnabled && dataActual.some((valor) => Number(valor) !== 0);
    const hasPrevData = prevEnabled && dataPrev.some((valor) => Number(valor) !== 0);
    const tieneDatos = hasEnabledSeries && (hasActualData || hasPrevData);
    if (!tieneDatos) {
      if (charts[target.id]) {
        charts[target.id].destroy();
        charts[target.id] = null;
      }
      canvas.style.display = "none";
      toggleEmpty(target.id, true, "Sin datos para graficar.");
      return;
    }
    toggleEmpty(target.id, false);
    canvas.style.display = "block";
    const ctx = canvas.getContext("2d");

    const colorActual =
      actualCfg.color || obtenerVariableCss("--color-real", "#ffc000");
    const colorPrev =
      prevCfg.color || obtenerVariableCss("--color-primary", "#2f5496");
    const labelActualTemplate = actualCfg.label || "Real {year}";
    const labelPrevTemplate = prevCfg.label || "Real {prev}";
    const labelActual =
      applyTemplate(labelActualTemplate, { year: anio, prev: anio - 1 }).trim() ||
      `Real ${anio}`;
    const labelPrev =
      applyTemplate(labelPrevTemplate, { year: anio, prev: anio - 1 }).trim() ||
      `Real ${anio - 1}`;

    if (charts[target.id] && charts[target.id]._chartType !== resolvedType) {
      charts[target.id].destroy();
      charts[target.id] = null;
    }

    if (!charts[target.id]) {
      charts[target.id] = construirChart({
        ctx,
        labels: MESES_LABELS,
        dataActual,
        dataPrev,
        labelActual,
        labelPrev,
        colorActual,
        colorPrev,
        enabledActual: actualEnabled,
        enabledPrev: prevEnabled,
        chartType: resolvedType,
      });
      charts[target.id]._chartType = resolvedType;
    } else {
      const chart = charts[target.id];
      chart.data.labels = MESES_LABELS;
      chart.data.datasets = buildChartDatasets({
        labels: MESES_LABELS,
        dataActual,
        dataPrev,
        labelActual,
        labelPrev,
        colorActual,
        colorPrev,
        enabledActual: actualEnabled,
        enabledPrev: prevEnabled,
        chartType: resolvedType,
      });
      chart.update();
    }
  };

  const getGastosTableIndices = (tabla) => {
    const headerRows = Array.from(tabla?.querySelectorAll("thead tr") || []);
    if (!headerRows.length) {
      return { annualIndex: -1, budgetMonthIndices: [], realMonthIndices: [] };
    }
    const leafCells = Array.from(headerRows[headerRows.length - 1].cells || []);

    let annualIndex = -1;
    const budgetMonthIndices = [];
    const realMonthIndices = [];
    let colIndex = 0;
    leafCells.forEach((th) => {
      const idx = colIndex;
      colIndex += Number(th?.colSpan) || 1;
      if (th.classList.contains("month-budget")) {
        budgetMonthIndices.push(idx);
      } else if (th.classList.contains("month-real")) {
        realMonthIndices.push(idx);
      } else if (annualIndex < 0 && th.classList.contains("budget-annual-column")) {
        annualIndex = idx;
      }
    });
    return { annualIndex, budgetMonthIndices, realMonthIndices };
  };

  const getSeriesValue = (row, key) => {
    const clean = String(key || "").trim().toLowerCase();
    if (clean === "budget") return Number(row?.budget) || 0;
    if (clean === "annual") return Number(row?.annual) || 0;
    return Number(row?.real) || 0;
  };

  const getRowsDataFromTable = (tabla) => {
    if (!tabla) return [];
    const indices = getGastosTableIndices(tabla);
    if (
      !indices.budgetMonthIndices.length &&
      !indices.realMonthIndices.length &&
      indices.annualIndex < 0
    ) {
      return [];
    }
    const rows = Array.from(tabla.querySelectorAll("tbody tr"));
    return rows
      .map((row) => {
        const style = window.getComputedStyle(row);
        if (style.display === "none" || style.visibility === "hidden") {
          return null;
        }
        const cells = Array.from(row.cells || []);
        if (cells.length < 2) return null;
        const labelRaw = getCellText(cells[1]);
        const identifier = resolverIdentificadorFila(row);
        const accountRaw = identifier || getCellText(cells[0]);
        if (!labelRaw && !accountRaw) return null;
        const budget = indices.budgetMonthIndices.reduce(
          (sum, idx) => sum + parseNumero(getCellText(cells[idx])),
          0
        );
        const real = indices.realMonthIndices.reduce(
          (sum, idx) => sum + parseNumero(getCellText(cells[idx])),
          0
        );
        const annual =
          indices.annualIndex >= 0
            ? parseNumero(getCellText(cells[indices.annualIndex]))
            : budget;
        const label = labelRaw || accountRaw;
        const displayLabel = formatLabelWithId(label, accountRaw);
        return {
          label,
          displayLabel,
          key: normalizarTexto(label),
          accountKey: normalizarTexto(accountRaw),
          budget,
          real,
          annual,
          identifier: accountRaw,
        };
      })
      .filter(Boolean);
  };

  const matchRowByVariants = (rowsData = [], variants = []) => {
    const normalized = (Array.isArray(variants) ? variants : [])
      .map((value) => normalizarTexto(value))
      .filter(Boolean);
    if (!normalized.length) return null;
    for (const key of normalized) {
      const exact = rowsData.find(
        (row) => row.key === key || row.accountKey === key
      );
      if (exact) return exact;
    }
    for (const key of normalized) {
      const partial = rowsData.find(
        (row) => row.key.includes(key) || key.includes(row.key)
      );
      if (partial) return partial;
    }
    return null;
  };

  const buildManualDatasets = ({
    labels,
    rows,
    chart,
    chartType,
    datasetDefs,
  }) => {
    if (!Array.isArray(labels) || !labels.length) return [];
    const selected = applyCustomSeriesOverrides(
      filterSeriesByKeys(datasetDefs, chart?.seriesKeys || []),
      chart
    );
    if (!selected.length) return [];
    const pie = isPieType(chartType);
    const defs = pie ? [selected[0]] : selected;
    return defs.map((datasetDef) => {
      const data = rows.map((row) => getSeriesValue(row, datasetDef.key));
      const dataset = {
        label: datasetDef.label || datasetDef.key,
        data,
        hidden: datasetDef.enabled === false,
      };
      if (pie) {
        dataset.backgroundColor = buildSlicePalette(labels.length, datasetDef.color);
        dataset.borderColor = "#ffffff";
        dataset.borderWidth = 1;
      } else {
        const color = datasetDef.color || "#2f5496";
        dataset.backgroundColor = color;
        dataset.borderColor = color;
        dataset.borderWidth = chartType === "line" ? 2 : 1;
        if (chartType === "line") {
          dataset.pointBackgroundColor = color;
          dataset.pointBorderColor = color;
          dataset.pointRadius = 3;
          dataset.pointHoverRadius = 4;
          dataset.tension = 0.3;
          dataset.fill = false;
        } else if (chartType === "bar") {
          dataset.borderRadius = 8;
          dataset.maxBarThickness = 28;
        }
      }
      return dataset;
    });
  };

  const renderManualCustomCharts = ({ panel, graficasConfig, tabla }) => {
    const container = panel?.querySelector(".row.g-3");
    if (!container || !tabla) return 0;
    clearCustomCharts(container);
    clearDefaultCharts();

    const list = Array.isArray(graficasConfig?.customCharts)
      ? graficasConfig.customCharts
      : [];
    const moduleCharts = list.filter(
      (chart) => chart?.enabled !== false && moduleMatchesCurrent(chart?.module)
    );
    if (!moduleCharts.length) {
      const emptyCol = document.createElement("div");
      emptyCol.className = "col-12";
      emptyCol.setAttribute("data-gg-custom-chart", "empty");
      emptyCol.innerHTML = `
        <div class="sidebar-empty" style="display:flex; min-height:120px;">
          No hay graficas manuales configuradas para este modulo.
        </div>
      `;
      container.appendChild(emptyCol);
      return 0;
    }

    const rowsData = getRowsDataFromTable(tabla);
    const chartTypeBase = graficasConfig?.chart?.type || "bar";
    const operativoDatasets =
      graficasConfig?.operativo?.datasets || DEFAULT_OPERATIVO_CONFIG.datasets;
    const anio = obtenerAnioSeleccionado();
    const datasetDefs = Object.keys(operativoDatasets || {})
      .map((key) => {
        const serie = operativoDatasets[key] || {};
        const labelTemplate = serie.label || key;
        return {
          key,
          label: applyTemplate(labelTemplate, {
            year: anio,
            annual: Number.isInteger(anio) ? anio : "",
          }),
          color: serie.color || "#2f5496",
          enabled: serie.enabled !== false,
        };
      })
      .filter((serie) => serie.enabled !== false);

    let rendered = 0;
      moduleCharts.forEach((chart, index) => {
        const rowsCfg = Array.isArray(chart?.rows) ? chart.rows : [];
        if (!rowsCfg.length) return;
        const resolvedRows = rowsCfg.map((row) => {
          const variants = Array.isArray(row?.variants) ? row.variants : [];
          const match = matchRowByVariants(rowsData, variants);
          const labelBase =
            (typeof row?.alias === "string" && row.alias.trim()
              ? row.alias.trim()
              : (variants[0] || "").toString().trim()) ||
            `Fila ${index + 1}`;
          return {
            baseLabel: labelBase,
            label: match ? formatLabelWithId(labelBase, match.identifier) : labelBase,
            budget: match ? match.budget : 0,
            real: match ? match.real : 0,
            annual: match ? match.annual : 0,
          };
        });
        const labels = resolvedRows.map((row) => row.label);
        const baseLabels = resolvedRows.map((row) => row.baseLabel || row.label);
        const chartType = resolveChartType(chart?.chartType, chartTypeBase);
        const datasets = buildManualDatasets({
          labels,
          rows: resolvedRows,
          chart,
        chartType,
        datasetDefs,
      });
      if (!datasets.length) return;

      const chartId = (chart?.id || `custom-${index + 1}`)
        .toString()
        .replace(/[^a-zA-Z0-9_-]/g, "");
      const canvasId = `ggCustomChart_${chartId || index + 1}`;
      const col = document.createElement("div");
      col.className = "col-12 col-lg-6";
      col.setAttribute("data-gg-custom-chart", canvasId);
      col.innerHTML = `
        <div class="chart-block" data-custom-chart="${canvasId}">
          <div class="chart-title">${(chart?.title || `Grafica manual ${index + 1}`)
            .toString()
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")}</div>
          ${
            chart?.subtitle
              ? `<div class="chart-subtitle text-muted small mb-2">${String(
                  chart.subtitle
                )
                  .replace(/</g, "&lt;")
                  .replace(/>/g, "&gt;")}</div>`
              : ""
          }
          <div class="chart-container">
            <canvas id="${canvasId}"></canvas>
          </div>
        </div>
      `;
      container.appendChild(col);

      const canvas = col.querySelector("canvas");
      const ctx = canvas?.getContext("2d");
      if (!ctx) return;
      const customChart = new Chart(ctx, {
        type: chartType,
        data: {
          labels,
          datasets,
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: isPieType(chartType) ? "nearest" : "index",
            intersect: isPieType(chartType),
          },
          plugins: {
            legend: {
              position: "bottom",
              labels: {
                boxWidth: 12,
                boxHeight: 12,
                usePointStyle: true,
              },
            },
            tooltip: {
              callbacks: {
                title: (items) => {
                  const item = items?.[0];
                  const index = Number(item?.dataIndex);
                  const stored = item?.chart?.$baseLabels;
                  const fallback = item?.label || "";
                  if (!Number.isInteger(index)) return fallback;
                  if (!Array.isArray(stored)) return fallback;
                  const base = stored[index];
                  return (base || "").toString().trim() || fallback;
                },
                label: (ctx) =>
                  `${ctx.dataset?.label || ""}: ${formatearNumero(
                    getParsedValue(ctx)
                  )}`,
              },
            },
          },
          scales: isPieType(chartType)
            ? {}
            : {
                y: {
                  beginAtZero: true,
                  ticks: {
                    callback: (value) => formatearNumero(value),
                  },
                },
              },
        },
      });
      customChart.$baseLabels = baseLabels;
      customCharts[canvasId] = customChart;
      rendered += 1;
    });

    if (rendered === 0) {
      const emptyCol = document.createElement("div");
      emptyCol.className = "col-12";
      emptyCol.setAttribute("data-gg-custom-chart", "empty");
      emptyCol.innerHTML = `
        <div class="sidebar-empty" style="display:flex; min-height:120px;">
          Las graficas manuales no tienen filas/columnas validas.
        </div>
      `;
      container.appendChild(emptyCol);
    }
    return rendered;
  };

  const actualizarSubtitulo = (anio, config) => {
    const subtitle = document.getElementById("gastosGeneralesChartsSubtitle");
    if (!subtitle || !Number.isInteger(anio)) return;
    const gastosConfig = config || getGastosConfig();
    const template =
      gastosConfig.subtitleTemplate ||
      DEFAULT_GASTOS_CONFIG.subtitleTemplate;
    subtitle.textContent = applyTemplate(template, {
      year: anio,
      prev: anio - 1,
    });
  };

  const actualizarGraficas = async () => {
    const panel = document.getElementById("gastosGeneralesChartsPanel");
    const toggleBtn = document.querySelector(
      '[data-bs-target="#gastosGeneralesChartsPanel"]'
    );
    const gastosConfig = getGastosConfig();
    const graficasConfig = getGraficasConfig();
    const manualOnly = isManualOnlyEnabled(graficasConfig);
    const hasManualCharts = Array.isArray(graficasConfig?.customCharts)
      ? graficasConfig.customCharts.some(
        (chart) =>
          chart?.enabled !== false &&
          moduleMatchesCurrent(chart?.module) &&
          Array.isArray(chart?.rows) &&
          chart.rows.length > 0
      )
      : false;
    const hasAutomaticCharts = TARGETS.some((target) => {
      const chartCfg =
        gastosConfig?.charts?.[target.id] || DEFAULT_GASTOS_CONFIG.charts?.[target.id] || {};
      return chartCfg?.enabled !== false;
    });
    const shouldShowChartsPanel =
      gastosConfig.enabled !== false &&
      ((manualOnly && hasManualCharts) || (!manualOnly && (hasAutomaticCharts || hasManualCharts)));
    const baseChartType = graficasConfig.chart?.type || "bar";
    if (panel) {
      if (!shouldShowChartsPanel) {
        panel.style.display = "none";
        if (toggleBtn) toggleBtn.style.display = "none";
        return;
      }
      panel.style.display = "";
      if (toggleBtn) toggleBtn.style.display = "";
    }

    const table = document.getElementById("tablaComparacion");
    const rowContainer = panel?.querySelector(".row.g-3");
    if (manualOnly) {
      if (typeof Chart === "undefined") {
        clearDefaultCharts();
        clearCustomCharts(rowContainer);
        if (rowContainer) {
          const emptyCol = document.createElement("div");
          emptyCol.className = "col-12";
          emptyCol.setAttribute("data-gg-custom-chart", "empty");
          emptyCol.innerHTML = `
            <div class="sidebar-empty" style="display:flex; min-height:120px;">
              Chart.js no disponible.
            </div>
          `;
          rowContainer.appendChild(emptyCol);
        }
        return;
      }
      const subtitle = document.getElementById("gastosGeneralesChartsSubtitle");
      if (subtitle) subtitle.textContent = "Graficas manuales del modulo";
      renderManualCustomCharts({
        panel,
        graficasConfig,
        tabla: table,
      });
      return;
    }

    clearCustomCharts(rowContainer);

    const baseCharts = DEFAULT_GASTOS_CONFIG.charts || {};
    const configById = new Map();
    TARGETS.forEach((target) => {
      const chartCfg = gastosConfig.charts?.[target.id] || baseCharts[target.id] || {};
      const resolvedChartType = resolveChartType(chartCfg.chartType, baseChartType);
      configById.set(target.id, { chart: chartCfg, chartType: resolvedChartType });
      const chartEnabled = chartCfg.enabled !== false;
      const chartContainer = document.querySelector(`[data-gg-chart="${target.id}"]`);
      const chartCol =
        chartContainer?.closest(".col-12") || chartContainer?.closest(".chart-block");
      if (chartCol) {
        chartCol.style.display = chartEnabled ? "" : "none";
      }
      const titleEl = chartContainer
        ?.closest(".chart-block")
        ?.querySelector(".chart-title");
      const fallbackTitle = chartCfg.title || baseCharts[target.id]?.title || target.title;
      if (titleEl && fallbackTitle) {
        titleEl.textContent = fallbackTitle;
      }
      if (!chartEnabled) {
        if (charts[target.id]) {
          charts[target.id].destroy();
          charts[target.id] = null;
        }
        const canvas = chartContainer?.querySelector("canvas");
        if (canvas) {
          canvas.style.display = "none";
        }
      }
    });

    const targetsEnabled = TARGETS.filter((target) => {
      const entry = configById.get(target.id);
      const chartCfg = entry?.chart;
      return chartCfg ? chartCfg.enabled !== false : true;
    });

    if (!targetsEnabled.length) return;

    if (typeof Chart === "undefined") {
      targetsEnabled.forEach((target) => {
        toggleEmpty(target.id, true, "Chart.js no disponible.");
      });
      return;
    }
    const empresaId = obtenerEmpresaId();
    const anio = obtenerAnioSeleccionado();
    if (!empresaId || !Number.isInteger(anio)) {
      targetsEnabled.forEach((target) => {
        toggleEmpty(target.id, true, "Selecciona empresa y ejercicio.");
      });
      return;
    }
    const cuentasPorObjetivo = await resolverCuentasObjetivo(
      empresaId,
      anio,
      targetsEnabled
    );
    targetsEnabled.forEach((target) => {
      const cuentas = cuentasPorObjetivo.get(target.id) || [];
      if (!cuentas.length) {
        toggleEmpty(
          target.id,
          true,
          "Cuenta no disponible para este capitulo."
        );
      }
    });
    const cuentasSolicitadas = obtenerMapaCuentas(cuentasPorObjetivo, targetsEnabled);
    if (!cuentasSolicitadas.length) return;

    requestId += 1;
    const currentRequest = requestId;

    const resultados = await Promise.allSettled([
      fetchDatos({ empresaId, anio, cuentas: cuentasSolicitadas }),
      fetchDatos({ empresaId, anio: anio - 1, cuentas: cuentasSolicitadas }),
    ]);
    if (currentRequest !== requestId) return;

    const datosActual =
      resultados[0].status === "fulfilled" ? resultados[0].value : new Map();
    const datosPrev =
      resultados[1].status === "fulfilled" ? resultados[1].value : new Map();

    actualizarSubtitulo(anio, gastosConfig);
    targetsEnabled.forEach((target) => {
      const cuentas = cuentasPorObjetivo.get(target.id) || [];
      if (!cuentas.length) return;
      const dataActual = sumarRealPorMes(datosActual, cuentas);
      const dataPrev = sumarRealPorMes(datosPrev, cuentas);
      const entry = configById.get(target.id);
      actualizarChart({
        target,
        dataActual,
        dataPrev,
        anio,
        chartConfig: entry?.chart,
        chartType: entry?.chartType,
      });
    });
  };

  const scheduleUpdate = () => {
    if (updateTimer) clearTimeout(updateTimer);
    updateTimer = setTimeout(actualizarGraficas, 160);
  };

  const initObserver = () => {
    const cuerpo = document.querySelector("#tablaCuentasBody");
    if (!cuerpo || typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(() => scheduleUpdate());
    observer.observe(cuerpo, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  };

  const init = () => {
    const panel = document.getElementById("gastosGeneralesChartsPanel");
    if (!panel) return;
    scheduleUpdate();
    panel.addEventListener("shown.bs.collapse", () => {
      scheduleUpdate();
      Object.values(charts).forEach((chart) => chart?.resize?.());
      Object.values(customCharts).forEach((chart) => chart?.resize?.());
    });
    window.addEventListener("modulo-planeacion:tabla-actualizada", scheduleUpdate);
    window.addEventListener("planeacion:contexto-actualizado", scheduleUpdate);
    window.addEventListener("modulo-planeacion:presupuesto-editado", scheduleUpdate);
    window.addEventListener("modulo:ready", scheduleUpdate);
    window.addEventListener("graficas-config-updated", scheduleUpdate);
    if (window.Sesion?.EVENTO_EMPRESA) {
      window.addEventListener(window.Sesion.EVENTO_EMPRESA, scheduleUpdate);
    }
    initObserver();
  };

  document.addEventListener("DOMContentLoaded", init);
})();
