(() => {
  "use strict";

  const TABLE_SELECTOR = "#tablaComparacion";
  const PANEL_SELECTOR = ".operativo-panel, .operativo-sidebar";
  const CANVAS_COMBINED_ID = "operativoChartCombined";
  const charts = { combined: null, combinedType: null, custom: {} };
  const MIN_BAR_LENGTH = 18;
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
  const ocultarCeros = (valor) => {
    const numero = Number(valor) || 0;
    return numero === 0 ? null : numero;
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
    if (!template) return "";
    const year = values.year || "";
    const annual = values.annual || "";
    return template
      .replace(/\{year\}/gi, year)
      .replace(/\{annual\}/gi, annual);
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

  const normalizeKey = (value) =>
    (value || "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "")
      .toUpperCase();

  const getCurrentModuleKey = () =>
    normalizeKey(
      document.body?.dataset?.modulo ||
        document.body?.dataset?.moduloAlias ||
        document.body?.dataset?.moduloId ||
        ""
    );

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const obtenerVariableCss = (nombre, fallback) => {
    if (!window.getComputedStyle) return fallback;
    const valor = getComputedStyle(document.documentElement)
      .getPropertyValue(nombre)
      .trim();
    return valor || fallback;
  };

  const parseNumero = (texto) => {
    let limpio = (texto || "").replace(/[^0-9+.,-]/g, "");
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
    return Number.isFinite(numero) ? numero : 0;
  };

  const formatearNumero = (valor) => {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return "0.00";
    const fijo = numero.toFixed(2);
    const [entero, decimales] = fijo.split(".");
    const enteroConComas = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return `${enteroConComas}.${decimales}`;
  };

  const obtenerIndices = (tabla) => {
    const headerRow = tabla?.querySelector("thead tr");
    const headers = headerRow ? Array.from(headerRow.children) : [];
    const buscar = (clase) =>
      headers.findIndex((th) => th.classList.contains(clase));
    const idxTotalBudget = buscar("total-budget-column");
    const idxTotalReal = buscar("total-real-column");
    const idxBudgetAnnual = buscar("budget-annual-column");
    return {
      budgetTotal: idxTotalBudget >= 0 ? idxTotalBudget : idxBudgetAnnual,
      realTotal: idxTotalReal,
      annual: idxBudgetAnnual,
    };
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

  const obtenerDatos = (tabla) => {
    const indices = obtenerIndices(tabla);
    if (
      indices.budgetTotal == null ||
      indices.budgetTotal < 0 ||
      indices.realTotal < 0
    ) {
      return [];
    }
    const annualIdx = indices.annual >= 0 ? indices.annual : indices.budgetTotal;
    const filas = Array.from(
      tabla.querySelectorAll("tbody tr.sum-row-operativo")
    );
    return filas
      .map((fila) => {
        const etiqueta = limpiarEtiqueta(fila.cells?.[1]?.textContent || "");
        const presupuesto = parseNumero(
          fila.cells?.[indices.budgetTotal]?.textContent
        );
        const real = parseNumero(fila.cells?.[indices.realTotal]?.textContent);
        const anual = parseNumero(fila.cells?.[annualIdx]?.textContent);
        return { etiqueta, presupuesto, real, anual };
      })
      .filter((item) => item.etiqueta);
  };

  const obtenerDatosFilas = (tabla) => {
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
        const etiqueta = limpiarEtiqueta(fila.cells?.[1]?.textContent || "");
        if (!etiqueta) return null;
        const presupuesto = parseNumero(
          fila.cells?.[indices.budgetTotal]?.textContent
        );
        const real = parseNumero(fila.cells?.[indices.realTotal]?.textContent);
        const anual = parseNumero(fila.cells?.[annualIdx]?.textContent);
        return {
          etiqueta,
          key: normalizeKey(etiqueta),
          presupuesto,
          real,
          anual,
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
      const exact = rowsData.find((row) => row.key === key);
      if (exact) return exact;
    }
    for (const key of keys) {
      const partial = rowsData.find(
        (row) => row.key.includes(key) || key.includes(row.key)
      );
      if (partial) return partial;
    }
    return null;
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
  }) => {
    if (!sidebar || !tabla) return;
    const container = sidebar.querySelector(".row.g-3");
    if (!container) return;

    clearCustomCharts(container);

    const customChartsList = Array.isArray(graficasConfig.customCharts)
      ? graficasConfig.customCharts
      : [];
    if (!customChartsList.length) return;

    const moduleKey = getCurrentModuleKey();
    if (!moduleKey) return;

    const rowsData = obtenerDatosFilas(tabla);
    if (!rowsData.length) return;

    const datasetDefs = [
      {
        key: "budget",
        valueKey: "presupuesto",
        label: labelsConfig.budget,
        color: colors.budget,
        enabled: enabledConfig.budget,
      },
      {
        key: "real",
        valueKey: "real",
        label: labelsConfig.real,
        color: colors.real,
        enabled: enabledConfig.real,
      },
      {
        key: "annual",
        valueKey: "anual",
        label: labelsConfig.annual,
        color: colors.annual,
        enabled: enabledConfig.annual,
      },
    ].filter((item) => item.enabled !== false);

    if (!datasetDefs.length) return;

    const baseChartType = graficasConfig.chart?.type || "bar";

    customChartsList.forEach((chart, index) => {
      if (chart?.enabled === false) return;
      const chartModuleKey = normalizeKey(chart?.module || "RESUMEN");
      if (chartModuleKey && chartModuleKey !== moduleKey) return;
      const rows = Array.isArray(chart?.rows) ? chart.rows : [];
      if (!rows.length) return;

      const chartType = resolveChartType(chart?.chartType, baseChartType);
      const isPie = isPieType(chartType);

      const labels = [];
      const seriesData = datasetDefs.reduce((acc, def) => {
        acc[def.key] = [];
        return acc;
      }, {});

      rows.forEach((row, rowIndex) => {
        const variants = Array.isArray(row?.variants)
          ? row.variants
          : row?.label
          ? [row.label]
          : row?.alias
          ? [row.alias]
          : [];
        const label =
          row?.alias || row?.label || variants[0] || `Fila ${rowIndex + 1}`;
        const match = matchRowByVariants(rowsData, variants);
        labels.push(label);
        datasetDefs.forEach((def) => {
          const value = match ? match[def.valueKey] : 0;
          seriesData[def.key].push(value);
        });
      });

      const datasets = datasetDefs.map((def) => {
        const rawValues = seriesData[def.key] || [];
        const data = isPie
          ? rawValues
          : rawValues.map((value) => ocultarCeros(value));
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

      const hasData = datasets.some((dataset) =>
        (dataset.data || []).some((value) => Number(value) !== 0 && value !== null)
      );

      const safeId = (chart?.id || `custom-${index + 1}`)
        .toString()
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, "");
      const canvasId = `operativoChartCustom-${safeId || index + 1}`;
      const chartKey = `custom-${safeId || index + 1}`;
      const titleText = chart?.title || `Grafica personalizada ${index + 1}`;
      const subtitleText = (chart?.subtitle || "").trim();

      const wrapper = document.createElement("div");
      wrapper.className = "col-12";
      wrapper.setAttribute("data-operativo-custom", "true");
      wrapper.innerHTML = `
        <div class="chart-block">
          <div class="chart-title">${escapeHtml(titleText)}</div>
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
  };

  const actualizarSidebar = () => {
    const sidebar = document.querySelector(PANEL_SELECTOR);
    const tabla = document.querySelector(TABLE_SELECTOR);
    if (!sidebar || !tabla || typeof Chart === "undefined") return;

    const graficasConfig = getGraficasConfig();
    const operativoConfig = graficasConfig.operativo || DEFAULT_OPERATIVO_CONFIG;
    const baseChartType = graficasConfig.chart?.type || "bar";
    const resolvedChartType = resolveChartType(
      operativoConfig.chartType,
      baseChartType
    );
    if (operativoConfig.enabled === false) {
      sidebar.style.display = "none";
      return;
    }
    sidebar.style.display = "";

    const datos = obtenerDatos(tabla);
    const labels = datos.map((item) => item.etiqueta);
    const presupuestos = datos.map((item) => ocultarCeros(item.presupuesto));
    const reales = datos.map((item) => ocultarCeros(item.real));
    const anuales = datos.map((item) => ocultarCeros(item.anual));

    const contenedor = sidebar.querySelector(
      '[data-operativo-chart="combined"]'
    );
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
    const hasEnabledDatasets = Object.values(enabledConfig).some(Boolean);
    const effectiveLabels = hasEnabledDatasets ? labels : [];
    ajustarAltura(contenedor, effectiveLabels.length);

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
    const annualFallback = headerYear ? `Presupuesto ${headerYear}` : "Presupuesto";
    const annualTemplate = annualCfg.label || datasetDefaults.annual.label;
    const budgetTemplate = budgetCfg.label || datasetDefaults.budget.label;
    const realTemplate = realCfg.label || datasetDefaults.real.label;
    const annualLabel =
      applyTemplate(annualTemplate, { year: headerYear, annual: annualFallback }).trim() ||
      annualFallback;
    const budgetLabel =
      applyTemplate(budgetTemplate, { year: headerYear, annual: annualLabel }).trim() ||
      budgetTemplate;
    const realLabel =
      applyTemplate(realTemplate, { year: headerYear, annual: annualLabel }).trim() ||
      realTemplate;

    const tituloEl = contenedor
      ?.closest(".chart-block")
      ?.querySelector(".chart-title");
    if (tituloEl) {
      const titleTemplate = operativoConfig.title || DEFAULT_OPERATIVO_CONFIG.title;
      const titleText =
        applyTemplate(titleTemplate, { year: headerYear, annual: annualLabel }).trim() ||
        titleTemplate;
      tituloEl.textContent = titleText;
    }

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
    });
  };

  const scheduleUpdate = () => {
    if (updateTimer) clearTimeout(updateTimer);
    updateTimer = setTimeout(actualizarSidebar, 120);
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
    const sidebar = document.querySelector(PANEL_SELECTOR);
    if (!sidebar) return;
    const label = sidebar.dataset.operativoLabel;
    const subtitle = sidebar.querySelector("[data-operativo-subtitle]");
    if (label && subtitle) {
      subtitle.textContent = `Por ${label}`;
    }
    scheduleUpdate();
    sidebar.addEventListener("shown.bs.collapse", () => {
      scheduleUpdate();
      Object.values(charts).forEach((chart) => chart?.resize());
    });
    window.addEventListener("modulo-planeacion:tabla-actualizada", scheduleUpdate);
    window.addEventListener("modulo-planeacion:presupuesto-editado", scheduleUpdate);
    window.addEventListener("modulo-planeacion:contexto-actualizado", scheduleUpdate);
    window.addEventListener("modulo:ready", scheduleUpdate);
    window.addEventListener("graficas-config-updated", scheduleUpdate);
    initObserver();
  };

  document.addEventListener("DOMContentLoaded", init);
})();
