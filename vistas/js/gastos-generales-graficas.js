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
  let updateTimer = null;
  let requestId = 0;

  const getGraficasConfig = () => {
    if (window.GraficasConfig && typeof window.GraficasConfig.load === "function") {
      return window.GraficasConfig.load();
    }
    return { gastosGenerales: DEFAULT_GASTOS_CONFIG };
  };

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

  const obtenerVariableCss = (nombre, fallback) => {
    if (!window.getComputedStyle) return fallback;
    const valor = getComputedStyle(document.documentElement)
      .getPropertyValue(nombre)
      .trim();
    return valor || fallback;
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

  const buildSlicePalette = (count, baseColor) => {
    const palette = baseColor
      ? [baseColor, ...CHART_PALETTE.filter((color) => color !== baseColor)]
      : CHART_PALETTE;
    return Array.from({ length: count }, (_, idx) => palette[idx % palette.length]);
  };

  const getParsedValue = (context) => {
    if (!context) return 0;
    if (typeof context.parsed === "number") return context.parsed;
    if (typeof context.parsed?.y === "number") return context.parsed.y;
    if (typeof context.raw === "number") return context.raw;
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
    const gastosConfig = getGastosConfig();
    const graficasConfig = getGraficasConfig();
    const baseChartType = graficasConfig.chart?.type || "bar";
    if (panel) {
      if (gastosConfig.enabled === false) {
        panel.style.display = "none";
        return;
      }
      panel.style.display = "";
    }

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
      Object.values(charts).forEach((chart) => chart?.resize());
    });
    window.addEventListener("modulo-planeacion:tabla-actualizada", scheduleUpdate);
    window.addEventListener("planeacion:contexto-actualizado", scheduleUpdate);
    window.addEventListener("modulo-planeacion:presupuesto-editado", scheduleUpdate);
    window.addEventListener("modulo:ready", scheduleUpdate);
    if (window.Sesion?.EVENTO_EMPRESA) {
      window.addEventListener(window.Sesion.EVENTO_EMPRESA, scheduleUpdate);
    }
    initObserver();
  };

  document.addEventListener("DOMContentLoaded", init);
})();
