/**
 * Graficas RESUMEN - Lee datos EXCLUSIVAMENTE del snapshot de la tabla RESUMEN.html
 *
 * Columnas del snapshot (indices en la tabla RESUMEN):
 * - actual: Real (col 1)
 * - plan: Ppto. (col 2)
 * - prev: Real mes año anterior (col 3)
 * - actualYTD: Real acumulado (col 7)
 * - planYTD: Ppto. acumulado (col 8)
 * - prevYTD: Real acumulado año anterior (col 9)
 *
 * Filas por capítulo:
 *
 * CDMX (Ciudad de México) - Contiene los 4 capítulos consolidados:
 *   Operating: OPERATING RESULTS MEXICO, GUADALAJARA, MONTERREY, NORTHWEST, CONSOLIDATED
 *   Net: NET RESULTS MEXICO, GUADALAJARA, MONTERREY, NORTHWEST, CONSOLIDATED
 *
 * GUADALAJARA:
          ...(chartType === "line"
            ? {
                fill: false,
                tension: 0.32,
                pointRadius: POINT_RADIUS,
                pointHoverRadius: POINT_HOVER_RADIUS,
                pointBackgroundColor: col.color,
              }
            : { minBarLength: MIN_BAR_LENGTH }),
 * NORESTE:
 *   Operating: NE OPERATING RESULTS
 *   Net: NET RESULTS
 *
 * NOROESTE:
 *   Operating: NO OPERATING RESULTS
 *   Net: NET RESULTS
 */
(() => {
  const base =
    window.location.protocol === "file:"
      ? "http://localhost:3005"
      : window.location.origin;
  const API_ENDPOINT = `${base}/api/reportes/resumen`;
  const API_ANIOS = `${base}/api/saldos/anios`;

  const yearSelect = document.getElementById("grafYearSelect");
  const monthSelect = document.getElementById("grafMonthSelect");
  const empresaLabel = document.getElementById("empresaLabel");
  const consolidatedCard = document.getElementById("consolidatedCard");
  const ingresoPorCapituloCanvas = document.getElementById(
    "chartIngresoPorCapitulo"
  );
  const ingresoPorCapituloCard = document.getElementById(
    "incomeByChapterCard"
  );
  const ingresoNacionalCanvas = document.getElementById("chartIngresoNacional");
  const ingresoNacionalCard = document.getElementById("incomeNationalCard");
  const charts = {};

                grace: "10%",
  // === UTILIDADES ===
  const toNumber = (val) => {
    const n = Number(val);
    return Number.isFinite(n) ? n : 0;
  };

  const normalizarLabel = (texto = "") =>
    texto
      .toString()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/\s+/g, " ");

  const formatNumber = (n) =>
    new Intl.NumberFormat("es-MX", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);

  const MIN_BAR_LENGTH = 14;
  const POINT_RADIUS = 6;
  const POINT_HOVER_RADIUS = 8;
  const ocultarCeros = (valor) => {
    const numero = Number(valor) || 0;
    return numero === 0 ? null : numero;
  };

  const MONTH_LABELS = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];

  const INCOME_LABELS = {
    mex: ["CDMX INCOME", "MEXICO INCOME", "CIUDAD DE MEXICO INCOME"],
    gdl: ["GUADALAJARA INCOME", "GDL INCOME", "GUADALAJARA INCOMEA"],
    mty: ["MONTERREY INCOME", "MTY INCOME"],
    nw: [
      "NORTHWEST INCOME",
      "NW INCOME",
      "NOROESTE INCOME",
      "NO INCOME",
    ],
  };

  const INGRESO_NACIONAL_LABELS = {
    committees: [
      "COMMITTEES",
      "COMITES",
      "COMITÉS",
      "COMMITTEES (INCOME)",
    ],
    membership: ["MEMBERSHIP", "MEMBERSHIP (INCOME)"],
    events: ["EVENTS", "EVENTS (INCOME)"],
    services: [
      "SERVICES TO MEMBERS",
      "SERVICES MEMBERS",
      "SERVICES TO MEMBERS (INCOME)",
    ],
    tic: ["T&IC", "T&IC (INCOME)", "T&IC INCOME"],
  };

  // === CONTEXTO Y PERSISTENCIA ===
  const CONTEXT_KEY = "planeacion_contexto";

  const leerContexto = () => {
    try {
      return JSON.parse(localStorage.getItem(CONTEXT_KEY) || "{}");
    } catch {
      return {};
    }
  };

  const persistirContexto = (anio, mes) => {
    const ctx = leerContexto();
    if (anio != null) ctx.anio = anio;
    if (mes != null) ctx.mes = mes;
    try {
      localStorage.setItem(CONTEXT_KEY, JSON.stringify(ctx));
    } catch {}
  };

  // === SNAPSHOT DE LA TABLA RESUMEN ===
  const SNAPSHOT_PREFIX = "resumen_tabla_snapshot";

  const buildSnapshotKey = (empresaId, anio, mes) =>
    `${SNAPSHOT_PREFIX}:${empresaId || "sin"}:${anio || "sin"}:${mes || "sin"}`;

  /**
   * Lee el snapshot de la tabla RESUMEN desde localStorage
   * Retorna un Map con las filas indexadas por label normalizado
   */
  const leerSnapshot = (empresaId, anio, mes) => {
    try {
      const key = buildSnapshotKey(empresaId, anio, mes);
      const raw = localStorage.getItem(key);

      if (!raw) {
        console.warn("📊 Graficas: No hay snapshot para", key);
        return null;
      }

      const data = JSON.parse(raw);
      const map = new Map();

      (data?.filas || []).forEach((fila) => {
        const lbl = normalizarLabel(fila?.label || "");
        if (!lbl) return;

        // Detectar duplicados
        if (map.has(lbl)) {
          console.warn("📊 Graficas: DUPLICADO detectado para label:", lbl);
          console.warn("📊   Valor anterior:", map.get(lbl));
          console.warn("📊   Nuevo valor:", fila.totals);
        }

        map.set(lbl, {
          label: fila.label,
          actual: toNumber(fila?.totals?.actual),
          plan: toNumber(fila?.totals?.plan),
          prev: toNumber(fila?.totals?.prev),
          actualYTD: toNumber(fila?.totals?.actualYTD),
          planYTD: toNumber(fila?.totals?.planYTD),
          prevYTD: toNumber(fila?.totals?.prevYTD),
        });
      });

      console.log("📊 Graficas: Snapshot cargado con", map.size, "filas");
      console.log("📊 Graficas: Labels disponibles:", Array.from(map.keys()));

      return { ...data, map };
    } catch (err) {
      console.error("📊 Graficas: Error leyendo snapshot", err);
      return null;
    }
  };

  /**
   * Obtiene los datos de una fila por su label
   * Busca variantes del label si no encuentra la exacta
   */
  const getRowData = (snapshotMap, labels) => {
    const arr = Array.isArray(labels) ? labels : [labels];
    for (const lbl of arr) {
      const normalizado = normalizarLabel(lbl);
      const hit = snapshotMap.get(normalizado);
      if (hit) {
        // Para CONSOLIDATED, mostrar valores específicos
        if (lbl.toUpperCase().includes("CONSOLIDATED")) {
          console.log(
            `📊 Graficas: ENCONTRADO ${lbl} -> actual=${hit.actual}, plan=${hit.plan}, actualYTD=${hit.actualYTD}`
          );
        }
        return hit;
      }
    }
    console.log("📊 Graficas: NO encontrado:", arr[0]);
    return {
      actual: 0,
      plan: 0,
      prev: 0,
      actualYTD: 0,
      planYTD: 0,
      prevYTD: 0,
    };
  };

  const ingresoCache = new Map();

  const buildIngresoCacheKey = (empresaId, anio) =>
    `${empresaId || "sin"}:${anio || "sin"}`;

  const obtenerFilaIngreso = (layout = [], variants = []) => {
    if (!Array.isArray(layout) || !layout.length) return null;
    const candidatos = Array.isArray(variants) ? variants : [variants];
    const normalizados = candidatos.map((v) => normalizarLabel(v));
    return layout.find((row) => {
      const label = normalizarLabel(row?.label || "");
      return normalizados.some((v) => label.includes(v));
    });
  };

  const fetchResumenMes = async (empresaId, anio, mes) => {
    const params = new URLSearchParams({
      empresaId: empresaId || "",
      anio: String(anio || ""),
      mes: String(mes || ""),
    });
    const res = await fetch(`${API_ENDPOINT}?${params.toString()}`, {
      headers: window.Sesion?.headersAutenticacion?.() || {},
    });
    if (!res.ok) {
      throw new Error(`No fue posible cargar resumen ${anio}-${mes}`);
    }
    return res.json();
  };

  const buildIngresoPorCapituloSeries = async (empresaId, anio) => {
    if (!empresaId || !anio) return null;
    const cacheKey = buildIngresoCacheKey(empresaId, anio);
    if (ingresoCache.has(cacheKey)) {
      return ingresoCache.get(cacheKey);
    }

    const meses = MONTH_LABELS.map((_, idx) => idx + 1);
    const responses = await Promise.all(
      meses.map(async (mes) => {
        try {
          return await fetchResumenMes(empresaId, anio, mes);
        } catch (err) {
          console.warn("📊 Graficas: Error cargando resumen mes", mes, err);
          return null;
        }
      })
    );

    const datasetsConfig = [
      { key: "mex", label: "CDMX INCOME", color: "#0d47a1" },
      { key: "gdl", label: "GUADALAJARA INCOME", color: "#60a5fa" },
      { key: "mty", label: "MONTERREY INCOME", color: "#22c55e" },
      { key: "nw", label: "NORTHWEST INCOME", color: "#f59e0b" },
    ];

    const series = datasetsConfig.reduce((acc, item) => {
      acc[item.key] = [];
      return acc;
    }, {});

    responses.forEach((data, idx) => {
      const layout = data?.resumen?.[0]?.layout || [];
      datasetsConfig.forEach((dataset) => {
        const row = obtenerFilaIngreso(layout, INCOME_LABELS[dataset.key]);
        const val = toNumber(row?.totals?.actualYTD);
        series[dataset.key][idx] = val;
      });
    });

    const hasData = datasetsConfig.some((dataset) =>
      (series[dataset.key] || []).some((val) => Number(val) !== 0)
    );
    if (!hasData) {
      return null;
    }

    const result = {
      labels: MONTH_LABELS,
      datasets: datasetsConfig.map((dataset) => ({
        label: dataset.label,
        data: series[dataset.key] || [],
        borderColor: dataset.color,
        backgroundColor: dataset.color,
        borderWidth: 2,
        tension: 0.2,
        fill: false,
        pointRadius: POINT_RADIUS,
        pointHoverRadius: POINT_HOVER_RADIUS,
      })),
    };

    ingresoCache.set(cacheKey, result);
    return result;
  };

  const ingresoNacionalCache = new Map();
  const buildIngresoNacionalCacheKey = (empresaId, anio) =>
    `${empresaId || "sin"}:${anio || "sin"}`;

  const buildIngresoNacionalSeries = async (empresaId, anio) => {
    if (!empresaId || !anio) return null;
    const cacheKey = buildIngresoNacionalCacheKey(empresaId, anio);
    if (ingresoNacionalCache.has(cacheKey)) {
      return ingresoNacionalCache.get(cacheKey);
    }

    const meses = MONTH_LABELS.map((_, idx) => idx + 1);
    const responses = await Promise.all(
      meses.map(async (mes) => {
        try {
          return await fetchResumenMes(empresaId, anio, mes);
        } catch (err) {
          console.warn("📊 Graficas: Error cargando ingreso nacional", mes, err);
          return null;
        }
      })
    );

    const datasetsConfig = [
      { key: "committees", label: "Committees", color: "#0d47a1" },
      { key: "membership", label: "Membership", color: "#60a5fa" },
      { key: "events", label: "Events", color: "#22c55e" },
      { key: "services", label: "Services to Members", color: "#f59e0b" },
      { key: "tic", label: "T&IC", color: "#a855f7" },
    ];

    const series = datasetsConfig.reduce((acc, item) => {
      acc[item.key] = [];
      return acc;
    }, {});

    responses.forEach((data, idx) => {
      const layout = data?.resumen?.[0]?.layout || [];
      datasetsConfig.forEach((dataset) => {
        const row = obtenerFilaIngreso(layout, INGRESO_NACIONAL_LABELS[dataset.key]);
        const val = toNumber(row?.totals?.actualYTD);
        series[dataset.key][idx] = val;
      });
    });

    const hasData = datasetsConfig.some((dataset) =>
      (series[dataset.key] || []).some((val) => Number(val) !== 0)
    );
    if (!hasData) {
      return null;
    }

    const result = {
      labels: MONTH_LABELS,
      datasets: datasetsConfig.map((dataset) => ({
        label: dataset.label,
        data: series[dataset.key] || [],
        borderColor: dataset.color,
        backgroundColor: dataset.color,
        borderWidth: 2,
        tension: 0.2,
        fill: false,
        pointRadius: POINT_RADIUS,
        pointHoverRadius: POINT_HOVER_RADIUS,
      })),
    };

    ingresoNacionalCache.set(cacheKey, result);
    return result;
  };

  // === CONFIGURACIÓN DE GRÁFICAS POR CAPÍTULO ===

  /**
   * Define las filas que se deben mostrar en las gráficas según el capítulo
   */
  const getRowsConfig = (capitulo) => {
    const cap = normalizarLabel(capitulo);

    // CDMX - Contiene todos los capítulos consolidados
    if (
      cap.includes("CIUDAD DE MEXICO") ||
      cap.includes("CDMX") ||
      cap.includes("MEXICO")
    ) {
      return {
        operating: [
          {
            label: "OPERATING RESULTS MEXICO",
            variants: ["OPERATING RESULTS MEXICO"],
          },
          {
            label: "OPERATING RESULTS GUADALAJARA",
            variants: [
              "OPERATING RESULTS GUADALAJARA",
              "GDL OPERATING RESULTS",
            ],
          },
          {
            label: "OPERATING RESULTS MONTERREY",
            variants: ["OPERATING RESULTS MONTERREY", "MTY OPERATING RESULTS"],
          },
          {
            label: "OPERATING RESULTS NORTHWEST",
            variants: [
              "OPERATING RESULTS NORTHWEST",
              "OPERATING RESULTS NO",
              "NO OPERATING RESULTS",
            ],
          },
          {
            label: "CONSOLIDATED OPERATING RESULTS",
            variants: [
              "CONSOLIDATED OPERATING RESULTS",
              "CONSOLIDATED OPERATING RESULT",
            ],
          },
        ],
        net: [
          { label: "NET RESULTS MEXICO", variants: ["NET RESULTS MEXICO"] },
          {
            label: "NET RESULTS GUADALAJARA",
            variants: ["NET RESULTS GUADALAJARA", "GDL NET RESULTS"],
          },
          {
            label: "NET RESULTS MONTERREY",
            variants: ["NET RESULTS MONTERREY", "MTY NET RESULTS"],
          },
          {
            label: "NET RESULTS NORTHWEST",
            variants: [
              "NET RESULTS NORTHWEST",
              "NET RESULTS NO",
              "NO NET RESULTS",
            ],
          },
          {
            label: "CONSOLIDATED NET RESULTS",
            variants: ["CONSOLIDATED NET RESULTS", "CONSOLIDATED NET RESULT"],
          },
        ],
        isCdmx: true,
      };
    }

    // GUADALAJARA
    if (cap.includes("GUADALAJARA") || cap.includes("GDL")) {
      return {
        operating: [
          {
            label: "GDL OPERATING RESULTS",
            variants: [
              "GDL OPERATING RESULTS",
              "OPERATING RESULTS GUADALAJARA",
              "OPERATING RESULTS",
            ],
          },
        ],
        net: [
          {
            label: "NET RESULTS",
            variants: [
              "NET RESULTS",
              "GDL NET RESULTS",
              "NET RESULTS GUADALAJARA",
            ],
          },
        ],
        isCdmx: false,
      };
    }

    // NORESTE
    if (
      cap.includes("NORESTE") ||
      cap.includes("NE ") ||
      cap.includes("MONTERREY")
    ) {
      return {
        operating: [
          {
            label: "NE OPERATING RESULTS",
            variants: [
              "NE OPERATING RESULTS",
              "OPERATING RESULTS MONTERREY",
              "OPERATING RESULTS",
            ],
          },
        ],
        net: [
          {
            label: "NET RESULTS",
            variants: [
              "NET RESULTS",
              "NE NET RESULTS",
              "NET RESULTS MONTERREY",
            ],
          },
        ],
        isCdmx: false,
      };
    }

    // NOROESTE
    if (
      cap.includes("NOROESTE") ||
      cap.includes("NO ") ||
      cap.includes("NORTHWEST")
    ) {
      return {
        operating: [
          {
            label: "NO OPERATING RESULTS",
            variants: [
              "NO OPERATING RESULTS",
              "OPERATING RESULTS NORTHWEST",
              "OPERATING RESULTS",
            ],
          },
        ],
        net: [
          {
            label: "NET RESULTS",
            variants: [
              "NET RESULTS",
              "NO NET RESULTS",
              "NET RESULTS NORTHWEST",
            ],
          },
        ],
        isCdmx: false,
      };
    }

    // Capítulo genérico
    return {
      operating: [
        {
          label: "OPERATING RESULTS",
          variants: ["OPERATING RESULTS", "RESULTADO OPERATIVO"],
        },
      ],
      net: [
        { label: "NET RESULTS", variants: ["NET RESULTS", "RESULTADO NETO"] },
      ],
      isCdmx: false,
    };
  };

  // === CONFIGURACIÓN DE GRÁFICAS ===
  const GRAFICAS_CONFIG_KEY = "graficas_config_v1";
  const DEFAULT_GRAFICAS_CONFIG = {
    version: 1,
    series: [
      {
        key: "actualYTD",
        label: "Real acumulado",
        color: "#0d47a1",
        enabled: true,
      },
      {
        key: "planYTD",
        label: "Ppto. acumulado",
        color: "#60a5fa",
        enabled: true,
      },
      {
        key: "prevYTD",
        label: "Real acumulado año anterior",
        color: "#94a3b8",
        enabled: true,
      },
    ],
    charts: {
      operating: {
        enabled: true,
        title: "Resultado Operativo por Capítulo",
        subtitle: "Real Acum · Ppto. Acum · Real Acum AA",
      },
      net: {
        enabled: true,
        title: "Resumen Neto por Capítulo",
        subtitle: "Real Acum · Ppto. Acum · Real Acum AA",
      },
      consolidated: {
        enabled: true,
        title: "Consolidados Operativos vs Netos",
        subtitle: "Real Acum · Ppto. Acum · Real Acum AA",
      },
    },
    consolidatedSeries: {
      operating: {
        label: "CONSOLIDATED OPERATING RESULTS",
        color: "#0d47a1",
      },
      net: {
        label: "CONSOLIDATED NET RESULTS",
        color: "#94a3b8",
      },
    },
    legend: {
      show: true,
      position: "bottom",
    },
    chart: {
      type: "bar",
      stacked: false,
    },
  };

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const ALLOWED_SERIES_KEYS = new Set(["actualYTD", "planYTD", "prevYTD"]);

  const normalizeGraficasConfig = (config = {}) => {
    const base = clone(DEFAULT_GRAFICAS_CONFIG);
    if (!config || typeof config !== "object") {
      return base;
    }

    if (Array.isArray(config.series)) {
      const seriesMap = new Map();
      config.series.forEach((serie) => {
        if (!serie || typeof serie !== "object") return;
        if (!serie.key) return;
        seriesMap.set(String(serie.key), serie);
      });

      base.series = base.series.map((serie) => {
        const override = seriesMap.get(serie.key) || {};
        const label =
          typeof override.label === "string" && override.label.trim()
            ? override.label.trim()
            : serie.label;
        const color =
          typeof override.color === "string" && override.color.trim()
            ? override.color.trim()
            : serie.color;
        const enabled =
          typeof override.enabled === "boolean" ? override.enabled : serie.enabled;
        return { ...serie, label, color, enabled };
      });
    }

    if (config.charts && typeof config.charts === "object") {
      ["operating", "net", "consolidated"].forEach((key) => {
        const override = config.charts[key] || {};
        if (typeof override.enabled === "boolean") {
          base.charts[key].enabled = override.enabled;
        }
        if (typeof override.title === "string" && override.title.trim()) {
          base.charts[key].title = override.title.trim();
        }
        if (typeof override.subtitle === "string" && override.subtitle.trim()) {
          base.charts[key].subtitle = override.subtitle.trim();
        }
      });
    }

    if (config.consolidatedSeries && typeof config.consolidatedSeries === "object") {
      ["operating", "net"].forEach((key) => {
        const override = config.consolidatedSeries[key] || {};
        if (typeof override.label === "string" && override.label.trim()) {
          base.consolidatedSeries[key].label = override.label.trim();
        }
        if (typeof override.color === "string" && override.color.trim()) {
          base.consolidatedSeries[key].color = override.color.trim();
        }
      });
    }

    if (config.legend && typeof config.legend === "object") {
      if (typeof config.legend.show === "boolean") {
        base.legend.show = config.legend.show;
      }
      if (
        typeof config.legend.position === "string" &&
        ["top", "bottom", "left", "right"].includes(config.legend.position)
      ) {
        base.legend.position = config.legend.position;
      }
    }

    if (config.chart && typeof config.chart === "object") {
      if (
        typeof config.chart.type === "string" &&
        ["bar", "line"].includes(config.chart.type)
      ) {
        base.chart.type = config.chart.type;
      }
      if (typeof config.chart.stacked === "boolean") {
        base.chart.stacked = config.chart.stacked;
      }
    }

    return base;
  };

  const loadGraficasConfig = () => {
    try {
      const raw = localStorage.getItem(GRAFICAS_CONFIG_KEY);
      if (!raw) return clone(DEFAULT_GRAFICAS_CONFIG);
      return normalizeGraficasConfig(JSON.parse(raw));
    } catch (error) {
      return clone(DEFAULT_GRAFICAS_CONFIG);
    }
  };

  const getGraficasConfig = () => {
    if (window.GraficasConfig && typeof window.GraficasConfig.load === "function") {
      return window.GraficasConfig.load();
    }
    return loadGraficasConfig();
  };

  const getColumnDefs = (config) => {
    const series = Array.isArray(config.series)
      ? config.series
      : DEFAULT_GRAFICAS_CONFIG.series;
    return series
      .filter((serie) => ALLOWED_SERIES_KEYS.has(serie.key))
      .filter((serie) => serie.enabled !== false)
      .map((serie) => ({
        key: serie.key,
        label: serie.label,
        color: serie.color,
      }));
  };

  // === RENDERIZADO DE GRÁFICAS ===
  const renderChart = (id, cfg) => {
    const ctx = document.getElementById(id);
    if (!ctx) return;
    if (charts[id]) charts[id].destroy();
    charts[id] = new Chart(ctx, cfg);
  };

  const clearChart = (id) => {
    if (charts[id]) {
      charts[id].destroy();
      delete charts[id];
    }
  };

  const applyCommonChartOptions = (options = {}, config) => {
    const legend = options.plugins?.legend || {};
    legend.display = Boolean(config.legend?.show);
    legend.position = config.legend?.position || "bottom";
    options.plugins = { ...(options.plugins || {}), legend };

    options.scales = options.scales || {};
    options.scales.x = options.scales.x || {};
    options.scales.y = options.scales.y || {};

    const shouldStack =
      config.chart?.type === "bar" && Boolean(config.chart?.stacked);
    options.scales.x.stacked = shouldStack;
    options.scales.y.stacked = shouldStack;

    return options;
  };

  const updateChartHeaders = (config) => {
    const mapping = {
      operating: {
        titleId: "operatingChartTitle",
        subtitleId: "operatingChartSubtitle",
        cardId: "operatingCard",
      },
      net: {
        titleId: "netChartTitle",
        subtitleId: "netChartSubtitle",
        cardId: "netCard",
      },
      consolidated: {
        titleId: "consolidatedChartTitle",
        subtitleId: "consolidatedChartSubtitle",
        cardId: "consolidatedCard",
      },
    };

    Object.entries(mapping).forEach(([key, value]) => {
      const chartCfg = config.charts?.[key] || {};
      const titleEl = document.getElementById(value.titleId);
      const subtitleEl = document.getElementById(value.subtitleId);
      const cardEl = document.getElementById(value.cardId);

      if (titleEl && chartCfg.title) {
        titleEl.textContent = chartCfg.title;
      }
      if (subtitleEl) {
        subtitleEl.textContent = chartCfg.subtitle || "";
      }

      if (cardEl && key !== "consolidated") {
        cardEl.style.display = chartCfg.enabled === false ? "none" : "";
      }
    });
  };

  /**
   * Construye los datasets para un conjunto de filas
   */
  const buildDatasets = (rows, snapshotMap, columnDefs, chartType) => {
    return columnDefs.map((col) => {
      const dataset = {
        label: col.label,
        data: rows.map((row) => {
          const data = getRowData(snapshotMap, row.variants);
          return ocultarCeros(toNumber(data[col.key]));
        }),
        backgroundColor: col.color,
        borderColor: col.color,
        borderWidth: 2,
      };

      if (chartType === "line") {
        dataset.fill = false;
        dataset.tension = 0.32;
        dataset.pointRadius = POINT_RADIUS;
        dataset.pointHoverRadius = POINT_HOVER_RADIUS;
        dataset.pointBackgroundColor = col.color;
      } else if (chartType === "bar") {
        dataset.minBarLength = MIN_BAR_LENGTH;
      }

      return dataset;
    });
  };

  /**
   * Renderiza todas las gráficas usando datos del snapshot
   * Solo 3 gráficas:
   * 1. Resultado Operativo por Capítulo
   * 2. Resumen Neto por Capítulo
   * 3. Consolidados Operativos vs Netos
   */
  const renderAllCharts = (snapshotMap, capitulo, etiqueta) => {
    if (!snapshotMap || snapshotMap.size === 0) {
      console.warn("📊 Graficas: No hay datos en el snapshot");
      return;
    }

    const graficasConfig = getGraficasConfig();
    const columnDefs = getColumnDefs(graficasConfig);
    const chartType = graficasConfig.chart?.type || "bar";
    updateChartHeaders(graficasConfig);

    const config = getRowsConfig(capitulo);

    // === 1. Resultado Operativo por Capítulo ===
    // === 2. Resumen Neto por Capítulo ===
    // Estos se renderizan en renderChapterSummaryCharts
    renderChapterSummaryCharts(snapshotMap, config.isCdmx);

    // === 3. Consolidados Operativos vs Netos (SOLO PARA CDMX) ===
    const showConsolidated =
      config.isCdmx && graficasConfig.charts?.consolidated?.enabled !== false;
    if (consolidatedCard) {
      consolidatedCard.style.display = showConsolidated ? "block" : "none";
    }

    if (showConsolidated) {
      const consolidatedOp = getRowData(snapshotMap, [
        "CONSOLIDATED OPERATING RESULTS",
      ]);
      const consolidatedNet = getRowData(snapshotMap, [
        "CONSOLIDATED NET RESULTS",
      ]);

      const consolidatedColumns = columnDefs.length
        ? columnDefs
        : getColumnDefs(DEFAULT_GRAFICAS_CONFIG);
      const consolidatedLabels = consolidatedColumns.map((col) => col.label);

      console.log("📊 Graficas: Consolidados -", {
        operating: consolidatedOp,
        net: consolidatedNet,
      });

      renderChart("chartConsolidatedResults", {
        type: chartType,
        data: {
          labels: consolidatedLabels,
          datasets: [
            {
              label:
                graficasConfig.consolidatedSeries?.operating?.label ||
                "CONSOLIDATED OPERATING RESULTS",
              data: consolidatedColumns.map((col) =>
                toNumber(consolidatedOp[col.key])
              ),
              backgroundColor:
                graficasConfig.consolidatedSeries?.operating?.color || "#0d47a1",
              borderColor:
                graficasConfig.consolidatedSeries?.operating?.color || "#0d47a1",
              borderWidth: chartType === "line" ? 2 : 1,
              ...(chartType === "line"
                ? {
                    fill: false,
                    tension: 0.32,
                    pointRadius: POINT_RADIUS,
                    pointHoverRadius: POINT_HOVER_RADIUS,
                    pointBackgroundColor:
                      graficasConfig.consolidatedSeries?.operating?.color ||
                      "#0d47a1",
                  }
                : { minBarLength: MIN_BAR_LENGTH }),
            },
            {
              label:
                graficasConfig.consolidatedSeries?.net?.label ||
                "CONSOLIDATED NET RESULTS",
              data: consolidatedColumns.map((col) =>
                toNumber(consolidatedNet[col.key])
              ),
              backgroundColor:
                graficasConfig.consolidatedSeries?.net?.color || "#94a3b8",
              borderColor:
                graficasConfig.consolidatedSeries?.net?.color || "#94a3b8",
              borderWidth: chartType === "line" ? 2 : 1,
              ...(chartType === "line"
                ? {
                    fill: false,
                    tension: 0.32,
                    pointRadius: POINT_RADIUS,
                    pointHoverRadius: POINT_HOVER_RADIUS,
                    pointBackgroundColor:
                      graficasConfig.consolidatedSeries?.net?.color || "#94a3b8",
                  }
                : { minBarLength: MIN_BAR_LENGTH }),
            },
          ],
        },
        options: applyCommonChartOptions(
          {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              title: {
                display: false,
              },
              tooltip: {
                callbacks: {
                  label: function(context) {
                    let label = context.dataset.label || '';
                    if (label) {
                      label += ': ';
                    }
                    label += formatNumber(context.parsed.y);
                    return label;
                  }
                }
              }
            },
            scales: { 
              y: { 
                beginAtZero: false,
                ticks: {
                  callback: function(value) {
                    return formatNumber(value);
                  }
                }
              },
              x: {
                ticks: {
                  font: { size: 11 }
                }
              }
            },
          },
          graficasConfig
        ),
      });
    }
  };

  /**
   * Renderiza gráficas de resumen comparando todos los capítulos/regiones
   * Para CDMX: Usa las filas de OPERATING RESULTS y NET RESULTS por región del snapshot actual
   * Para otros capítulos: Usa sus propios datos
   */
  const renderChapterSummaryCharts = async (snapshotMap, isCdmx) => {
    const graficasConfig = getGraficasConfig();
    const columnDefs = getColumnDefs(graficasConfig);
    const chartType = graficasConfig.chart?.type || "bar";
    const showOperating = graficasConfig.charts?.operating?.enabled !== false;
    const showNet = graficasConfig.charts?.net?.enabled !== false;

    // Si es CDMX, usar los datos del snapshot actual que ya contiene todos los capítulos
    if (isCdmx && snapshotMap && snapshotMap.size > 0) {
      // Definir las 4 regiones en orden para CDMX
      const regiones = [
        {
          label: "Ciudad de México",
          operKey: "OPERATING RESULTS MEXICO",
          netKey: "NET RESULTS MEXICO",
        },
        {
          label: "Guadalajara",
          operKey: "OPERATING RESULTS GUADALAJARA",
          netKey: "NET RESULTS GUADALAJARA",
        },
        {
          label: "Noreste",
          operKey: "OPERATING RESULTS MONTERREY",
          netKey: "NET RESULTS MONTERREY",
        },
        {
          label: "Noroeste",
          operKey: "OPERATING RESULTS NORTHWEST",
          netKey: "NET RESULTS NORTHWEST",
        },
      ];

      const summaries = regiones.map((region) => ({
        capitulo: region.label,
        operating: getRowData(snapshotMap, [region.operKey]),
        net: getRowData(snapshotMap, [region.netKey]),
      }));

      const labels = summaries.map((s) => s.capitulo);

      console.log("📊 Graficas: Resumen por capítulo (CDMX):", summaries);

      // Resumen Operativo por capítulo
      if (showOperating) {
        const operatingDatasets = columnDefs.map((col) => ({
          label: col.label,
          data: summaries.map((s) => ocultarCeros(toNumber(s.operating[col.key]))),
          backgroundColor: col.color,
          borderColor: col.color,
          borderWidth: chartType === "line" ? 2 : 1,
          ...(chartType === "line"
            ? {
                fill: false,
                tension: 0.32,
                pointRadius: POINT_RADIUS,
                pointHoverRadius: POINT_HOVER_RADIUS,
                pointBackgroundColor: col.color,
              }
            : { minBarLength: MIN_BAR_LENGTH }),
        }));

        renderChart("chartOperatingSummaryByChapter", {
          type: chartType,
          data: {
            labels,
            datasets: operatingDatasets,
          },
          options: applyCommonChartOptions(
            {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                title: {
                  display: false,
                },
                tooltip: {
                  callbacks: {
                    label: function(context) {
                      let label = context.dataset.label || '';
                      if (label) {
                        label += ': ';
                      }
                      label += formatNumber(context.parsed.y);
                      return label;
                    }
                  }
                }
              },
              scales: { 
                y: { 
                  beginAtZero: false,
                  ticks: {
                    callback: function(value) {
                      return formatNumber(value);
                    }
                  }
                },
                x: {
                  ticks: {
                    font: { size: 11 }
                  }
                }
              },
            },
            graficasConfig
          ),
        });
      } else {
        clearChart("chartOperatingSummaryByChapter");
      }

      // Resumen Neto por capítulo
      if (showNet) {
        const netDatasets = columnDefs.map((col) => ({
          label: col.label,
          data: summaries.map((s) => ocultarCeros(toNumber(s.net[col.key]))),
          backgroundColor: col.color,
          borderColor: col.color,
          borderWidth: chartType === "line" ? 2 : 1,
          ...(chartType === "line"
            ? { fill: false, tension: 0.32, pointRadius: 3, pointBackgroundColor: col.color }
            : {}),
        }));

        renderChart("chartNetSummaryByChapter", {
          type: chartType,
          data: {
            labels,
            datasets: netDatasets,
          },
          options: applyCommonChartOptions(
            {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                title: {
                  display: false,
                },
                tooltip: {
                  callbacks: {
                    label: function(context) {
                      let label = context.dataset.label || '';
                      if (label) {
                        label += ': ';
                      }
                      label += formatNumber(context.parsed.y);
                      return label;
                    }
                  }
                }
              },
              scales: { 
                y: { 
                  beginAtZero: false,
                  grace: "10%",
                  ticks: {
                    callback: function(value) {
                      return formatNumber(value);
                    }
                  }
                },
                x: {
                  ticks: {
                    font: { size: 11 }
                  }
                }
              },
            },
            graficasConfig
          ),
        });
      } else {
        clearChart("chartNetSummaryByChapter");
      }

      return;
    }

    // Para otros capítulos: usar el snapshot actual con un solo resultado
    if (snapshotMap && snapshotMap.size > 0) {
      const empresa = window.Sesion?.obtenerEmpresaActiva?.();
      const config = window.CapitulosModulos?.obtenerConfigEmpresa?.(
        empresa?.id
      );
      const etiqueta = config?.etiqueta || empresa?.etiqueta || "Capítulo";

      const summaries = [
        {
          capitulo: etiqueta,
          operating: getRowData(snapshotMap, [
            "OPERATING RESULTS",
            "GDL OPERATING RESULTS",
            "NE OPERATING RESULTS",
            "NO OPERATING RESULTS",
          ]),
          net: getRowData(snapshotMap, ["NET RESULTS"]),
        },
      ];

      const labels = [etiqueta];

      // Resumen Operativo (solo un capítulo)
      if (showOperating) {
        const operatingDatasets = columnDefs.map((col) => ({
          label: col.label,
          data: summaries.map((s) => ocultarCeros(toNumber(s.operating[col.key]))),
          backgroundColor: col.color,
          borderColor: col.color,
          borderWidth: chartType === "line" ? 2 : 1,
          ...(chartType === "line"
            ? {
                fill: false,
                tension: 0.32,
                pointRadius: POINT_RADIUS,
                pointHoverRadius: POINT_HOVER_RADIUS,
                pointBackgroundColor: col.color,
              }
            : { minBarLength: MIN_BAR_LENGTH }),
        }));

        renderChart("chartOperatingSummaryByChapter", {
          type: chartType,
          data: {
            labels,
            datasets: operatingDatasets,
          },
          options: applyCommonChartOptions(
            {
              responsive: true,
              maintainAspectRatio: false,
              plugins: { 
                title: {
                  display: false,
                },
                tooltip: {
                  callbacks: {
                    label: function(context) {
                      let label = context.dataset.label || '';
                      if (label) {
                        label += ': ';
                      }
                      label += formatNumber(context.parsed.y);
                      return label;
                    }
                  }
                }
              },
              scales: { 
                y: { 
                  beginAtZero: false,
                  grace: "10%",
                  ticks: {
                    callback: function(value) {
                      return formatNumber(value);
                    }
                  }
                },
                x: {
                  ticks: {
                    font: { size: 11 }
                  }
                }
              },
            },
            graficasConfig
          ),
        });
      } else {
        clearChart("chartOperatingSummaryByChapter");
      }

      // Resumen Neto (solo un capítulo)
      if (showNet) {
        const netDatasets = columnDefs.map((col) => ({
          label: col.label,
          data: summaries.map((s) => ocultarCeros(toNumber(s.net[col.key]))),
          backgroundColor: col.color,
          borderColor: col.color,
          borderWidth: chartType === "line" ? 2 : 1,
          ...(chartType === "line"
            ? {
                fill: false,
                tension: 0.32,
                pointRadius: POINT_RADIUS,
                pointHoverRadius: POINT_HOVER_RADIUS,
                pointBackgroundColor: col.color,
              }
            : { minBarLength: MIN_BAR_LENGTH }),
        }));

        renderChart("chartNetSummaryByChapter", {
          type: chartType,
          data: {
            labels,
            datasets: netDatasets,
          },
          options: applyCommonChartOptions(
            {
              responsive: true,
              maintainAspectRatio: false,
              plugins: { 
                title: {
                  display: false,
                },
                tooltip: {
                  callbacks: {
                    label: function(context) {
                      let label = context.dataset.label || '';
                      if (label) {
                        label += ': ';
                      }
                      label += formatNumber(context.parsed.y);
                      return label;
                    }
                  }
                }
              },
              scales: { 
                y: { 
                  beginAtZero: false,
                  grace: "10%",
                  ticks: {
                    callback: function(value) {
                      return formatNumber(value);
                    }
                  }
                },
                x: {
                  ticks: {
                    font: { size: 11 }
                  }
                }
              },
            },
            graficasConfig
          ),
        });
      } else {
        clearChart("chartNetSummaryByChapter");
      }
    }
  };

  const renderIngresoPorCapituloChart = async (empresaId, anio) => {
    if (!ingresoPorCapituloCanvas) return;
    if (ingresoPorCapituloCard) {
      ingresoPorCapituloCard.style.display = "none";
    }
    if (charts.chartIngresoPorCapitulo) {
      charts.chartIngresoPorCapitulo.destroy();
      charts.chartIngresoPorCapitulo = null;
    }

    try {
      const series = await buildIngresoPorCapituloSeries(empresaId, anio);
      if (!series || !Array.isArray(series.labels) || !series.labels.length) {
        return;
      }

      if (ingresoPorCapituloCard) {
        ingresoPorCapituloCard.style.display = "block";
      }

      renderChart("chartIngresoPorCapitulo", {
        type: "line",
        data: {
          labels: series.labels,
          datasets: series.datasets,
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "bottom",
              labels: { padding: 15, font: { size: 12 } },
            },
            title: {
              display: true,
              text: "Ingreso por capítulo (Real acumulado)",
              font: { size: 16, weight: "bold" },
              padding: 20,
            },
            tooltip: {
              callbacks: {
                label: function (context) {
                  let label = context.dataset.label || "";
                  if (label) {
                    label += ": ";
                  }
                  label += formatNumber(context.parsed.y);
                  return label;
                },
              },
            },
          },
          scales: {
            y: {
              beginAtZero: false,
              grace: "10%",
              ticks: {
                callback: function (value) {
                  return formatNumber(value);
                },
              },
            },
            x: {
              ticks: { font: { size: 11 } },
            },
          },
        },
      });
    } catch (err) {
      console.warn("📊 Graficas: No se pudo renderizar ingreso por capítulo", err);
    }
  };

  const renderIngresoNacionalChart = async (empresaId, anio) => {
    if (!ingresoNacionalCanvas) return;
    if (ingresoNacionalCard) {
      ingresoNacionalCard.style.display = "none";
    }
    if (charts.chartIngresoNacional) {
      charts.chartIngresoNacional.destroy();
      charts.chartIngresoNacional = null;
    }

    try {
      const series = await buildIngresoNacionalSeries(empresaId, anio);
      if (!series || !Array.isArray(series.labels) || !series.labels.length) {
        return;
      }

      if (ingresoNacionalCard) {
        ingresoNacionalCard.style.display = "block";
      }

      renderChart("chartIngresoNacional", {
        type: "line",
        data: {
          labels: series.labels,
          datasets: series.datasets,
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "bottom",
              labels: { padding: 15, font: { size: 12 } },
            },
            title: {
              display: true,
              text: "Ingreso nacional (Real acumulado)",
              font: { size: 16, weight: "bold" },
              padding: 20,
            },
            tooltip: {
              callbacks: {
                label: function (context) {
                  let label = context.dataset.label || "";
                  if (label) {
                    label += ": ";
                  }
                  label += formatNumber(context.parsed.y);
                  return label;
                },
              },
            },
          },
          scales: {
            y: {
              beginAtZero: false,
              grace: "10%",
              ticks: {
                callback: function (value) {
                  return formatNumber(value);
                },
              },
            },
            x: {
              ticks: { font: { size: 11 } },
            },
          },
        },
      });
    } catch (err) {
      console.warn("📊 Graficas: No se pudo renderizar ingreso nacional", err);
    }
  };

  // === CARGA DE DATOS ===
  const loadData = async () => {
    const empresa = window.Sesion?.obtenerEmpresaActiva?.();

    // Usar las funciones correctas de CapitulosModulos
    const capitulo = window.CapitulosModulos?.obtenerCapituloPorEmpresa?.(
      empresa?.id
    );
    const config = window.CapitulosModulos?.obtenerConfigEmpresa?.(empresa?.id);
    const etiqueta = config?.etiqueta || null;

    console.log(
      "📊 Graficas: empresa=",
      empresa?.id,
      "capitulo=",
      capitulo,
      "etiqueta=",
      etiqueta
    );

    if (!empresa?.id || !capitulo) {
      console.warn("📊 Graficas: No hay empresa o capítulo seleccionado");
      empresaLabel.textContent = "Capitulo: -";
      return;
    }

    const etiquetaFinal =
      etiqueta || empresa.etiqueta || empresa.nombre || capitulo;
    empresaLabel.textContent = `Capitulo: ${etiquetaFinal}`;

    const anio = Number(yearSelect?.value);
    const mes = Number(monthSelect?.value);

          ...(chartType === "line"
            ? {
                fill: false,
                tension: 0.32,
                pointRadius: POINT_RADIUS,
                pointHoverRadius: POINT_HOVER_RADIUS,
                pointBackgroundColor: col.color,
              }
            : { minBarLength: MIN_BAR_LENGTH }),
    }

    persistirContexto(anio, mes);

    // Leer el snapshot de la tabla RESUMEN
    const snapshot = leerSnapshot(empresa.id, anio, mes);

    if (!snapshot?.map) {
      console.warn(
        "📊 Graficas: No hay snapshot disponible para esta empresa/año/mes. Visita primero RESUMEN."
      );
      // Ocultar gráfica de consolidados si no hay datos
      if (consolidatedCard) {
        consolidatedCard.style.display = "none";
      }
      // Limpiar gráficas que dependen del snapshot
      [
        "chartOperatingSummaryByChapter",
        "chartNetSummaryByChapter",
        "chartConsolidatedResults",
      ].forEach((id) => {
        if (charts[id]) {
          charts[id].destroy();
          charts[id] = null;
        }
      });

      // Renderizar las gráficas de ingresos aunque no haya snapshot
      await renderIngresoPorCapituloChart(empresa.id, anio);
      await renderIngresoNacionalChart(empresa.id, anio);
                grace: "10%",
      return;
    }

    console.log(
      "📊 Graficas: Usando snapshot del",
      new Date(snapshot.createdAt).toLocaleString()
    );

    // Renderizar todas las gráficas usando exclusivamente el snapshot
    renderAllCharts(snapshot.map, capitulo, etiquetaFinal);
    await renderIngresoPorCapituloChart(empresa.id, anio);
    await renderIngresoNacionalChart(empresa.id, anio);
  };

  // === CARGA DE AÑOS ===
  const loadYears = async (preferido) => {
    const empresa = window.Sesion?.obtenerEmpresaActiva?.();
    if (!empresa?.id || !yearSelect) {
      return { lista: [], seleccionado: null };
    }

    try {
      const res = await fetch(
        `${API_ANIOS}?empresaId=${encodeURIComponent(empresa.id)}`,
        { headers: window.Sesion?.headersAutenticacion?.() || {} }
      );

      if (!res.ok) throw new Error("No se pudieron cargar años");

      const data = await res.json();
      const lista = Array.isArray(data?.anios)
        ? data.anios
            .filter((a) => Number.isInteger(Number(a)))
            .sort((a, b) => b - a)
        : [];

      yearSelect.innerHTML = "";

      if (!lista.length) {
        yearSelect.innerHTML = '<option value="">Sin años disponibles</option>';
        yearSelect.disabled = true;
        return { lista: [], seleccionado: null };
      }

      lista.forEach((anio) => {
        const opt = document.createElement("option");
        opt.value = anio;
        opt.textContent = anio;
        yearSelect.appendChild(opt);
      });

      const seleccionado =
        preferido && lista.includes(Number(preferido))
          ? Number(preferido)
          : lista[0];

      yearSelect.value = String(seleccionado);
      yearSelect.disabled = false;

      return { lista, seleccionado };
    } catch (e) {
      console.error("Error cargando años:", e);
      yearSelect.innerHTML = '<option value="">Error cargando años</option>';
      yearSelect.disabled = true;
      return { lista: [], seleccionado: null };
    }
  };

  // === INICIALIZACIÓN ===
  const inicializar = async () => {
    const sesion = window.Sesion?.requerirSesion?.();
    if (!sesion) return;

    const ctx = leerContexto();
    const { seleccionado } = await loadYears(ctx.anio);

    if (seleccionado && yearSelect) {
      yearSelect.value = String(seleccionado);
    }

    if (ctx.mes && monthSelect) {
      monthSelect.value = String(ctx.mes);
    }

    await loadData();
  };

  // === EVENT LISTENERS ===
  if (monthSelect) {
    monthSelect.addEventListener("change", loadData);
  }
  if (yearSelect) {
    yearSelect.addEventListener("change", loadData);
  }

  // Sincronizar con cambios en el selector de empresa global
  const sincronizarEmpresa = () => {
    const selector = window.parent?.document?.getElementById("companyFilter");
    if (selector) {
      selector.addEventListener("change", async () => {
        await loadData();
      });
    }
  };

  // === EXPORTACIÓN A EXCEL Y PDF ===
  
  /**
   * Obtiene los datos actuales de las gráficas para exportación
   */
  const obtenerDatosParaExportar = () => {
    const empresa = window.Sesion?.obtenerEmpresaActiva?.();
    const capitulo = window.CapitulosModulos?.obtenerCapituloPorEmpresa?.(empresa?.id);
    const anio = Number(yearSelect?.value);
    const mes = Number(monthSelect?.value);
    
    const snapshot = leerSnapshot(empresa?.id, anio, mes);
    if (!snapshot?.map) {
      alert('No hay datos disponibles para exportar. Por favor, visita primero la vista RESUMEN.');
      return null;
    }
    
    const config = getRowsConfig(capitulo);
    
    // Preparar datos para exportación
    const datos = {
      empresa: empresa?.nombre || empresa?.id,
      capitulo: capitulo,
      anio: anio,
      mes: mes,
      fecha: new Date().toLocaleString('es-MX'),
      operativos: [],
      netos: [],
      consolidados: config.isCdmx ? [] : null
    };
    
    // Datos operativos
    config.operating.forEach(row => {
      const data = getRowData(snapshot.map, row.variants);
      datos.operativos.push({
        concepto: row.label,
        realAcumulado: data.actualYTD,
        pptoAcumulado: data.planYTD,
        realAcumAA: data.prevYTD
      });
    });
    
    // Datos netos
    config.net.forEach(row => {
      const data = getRowData(snapshot.map, row.variants);
      datos.netos.push({
        concepto: row.label,
        realAcumulado: data.actualYTD,
        pptoAcumulado: data.planYTD,
        realAcumAA: data.prevYTD
      });
    });
    
    // Datos consolidados (solo CDMX)
    if (config.isCdmx) {
      const consolidatedOp = getRowData(snapshot.map, ['CONSOLIDATED OPERATING RESULTS']);
      const consolidatedNet = getRowData(snapshot.map, ['CONSOLIDATED NET RESULTS']);
      
      datos.consolidados.push(
        {
          concepto: 'CONSOLIDATED OPERATING RESULTS',
          realAcumulado: consolidatedOp.actualYTD,
          pptoAcumulado: consolidatedOp.planYTD,
          realAcumAA: consolidatedOp.prevYTD
        },
        {
          concepto: 'CONSOLIDATED NET RESULTS',
          realAcumulado: consolidatedNet.actualYTD,
          pptoAcumulado: consolidatedNet.planYTD,
          realAcumAA: consolidatedNet.prevYTD
        }
      );
    }
    
    return datos;
  };
  
  /**
   * Exporta los datos y gráficas a Excel usando ExcelJS
   */
  window.exportarGraficasExcel = async () => {
    const datos = obtenerDatosParaExportar();
    if (!datos) return;
    
    // Verificar que ExcelJS esté disponible
    if (typeof ExcelJS === 'undefined') {
      // Fallback a SheetJS si ExcelJS no está disponible
      if (typeof XLSX === 'undefined') {
        alert('La librería de exportación no está disponible.');
        return;
      }
      await exportarGraficasExcelLegacy(datos);
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'SummaCham';
      workbook.created = new Date();

      // === HOJA 1: Resultados Operativos con Gráfica ===
      const wsOperativos = workbook.addWorksheet('Resultados Operativos');
      
      // Información general
      wsOperativos.addRow(['GRÁFICAS DE RESUMEN - DATOS ACUMULADOS']);
      wsOperativos.addRow(['Empresa:', datos.empresa]);
      wsOperativos.addRow(['Capítulo:', datos.capitulo]);
      wsOperativos.addRow(['Año:', datos.anio]);
      wsOperativos.addRow(['Mes:', datos.mes]);
      wsOperativos.addRow(['Fecha de exportación:', datos.fecha]);
      wsOperativos.addRow([]);

      // Tabla de datos
      wsOperativos.addRow(['RESULTADOS OPERATIVOS POR CAPÍTULO']);
      const headerRowOp = wsOperativos.addRow(['Concepto', 'Real Acumulado', 'Ppto. Acumulado', 'Real Acum. Año Anterior']);
      headerRowOp.font = { bold: true };
      headerRowOp.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D47A1' } };
      headerRowOp.font = { bold: true, color: { argb: 'FFFFFFFF' } };

      datos.operativos.forEach(row => {
        wsOperativos.addRow([row.concepto, row.realAcumulado, row.pptoAcumulado, row.realAcumAA]);
      });

      // Ajustar anchos
      wsOperativos.columns = [
        { width: 40 },
        { width: 18 },
        { width: 18 },
        { width: 25 }
      ];

      // Agregar gráfica como imagen
      const chartOp = document.getElementById('chartOperatingSummaryByChapter');
      if (chartOp) {
        const imageId = workbook.addImage({
          base64: chartOp.toDataURL('image/png'),
          extension: 'png',
        });
        wsOperativos.addImage(imageId, {
          tl: { col: 0, row: datos.operativos.length + 11 },
          ext: { width: 800, height: 400 }
        });
      }

      // === HOJA 2: Resultados Netos con Gráfica ===
      const wsNetos = workbook.addWorksheet('Resultados Netos');
      
      wsNetos.addRow(['GRÁFICAS DE RESUMEN - DATOS ACUMULADOS']);
      wsNetos.addRow(['Empresa:', datos.empresa]);
      wsNetos.addRow(['Capítulo:', datos.capitulo]);
      wsNetos.addRow(['Año:', datos.anio]);
      wsNetos.addRow(['Mes:', datos.mes]);
      wsNetos.addRow(['Fecha de exportación:', datos.fecha]);
      wsNetos.addRow([]);

      wsNetos.addRow(['RESULTADOS NETOS POR CAPÍTULO']);
      const headerRowNet = wsNetos.addRow(['Concepto', 'Real Acumulado', 'Ppto. Acumulado', 'Real Acum. Año Anterior']);
      headerRowNet.font = { bold: true };
      headerRowNet.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D47A1' } };
      headerRowNet.font = { bold: true, color: { argb: 'FFFFFFFF' } };

      datos.netos.forEach(row => {
        wsNetos.addRow([row.concepto, row.realAcumulado, row.pptoAcumulado, row.realAcumAA]);
      });

      wsNetos.columns = [
        { width: 40 },
        { width: 18 },
        { width: 18 },
        { width: 25 }
      ];

      // Agregar gráfica
      const chartNet = document.getElementById('chartNetSummaryByChapter');
      if (chartNet) {
        const imageId = workbook.addImage({
          base64: chartNet.toDataURL('image/png'),
          extension: 'png',
        });
        wsNetos.addImage(imageId, {
          tl: { col: 0, row: datos.netos.length + 11 },
          ext: { width: 800, height: 400 }
        });
      }

      // === HOJA 3: Consolidados (solo CDMX) ===
      if (datos.consolidados) {
        const wsConsolidados = workbook.addWorksheet('Consolidados');
        
        wsConsolidados.addRow(['GRÁFICAS DE RESUMEN - DATOS ACUMULADOS']);
        wsConsolidados.addRow(['Empresa:', datos.empresa]);
        wsConsolidados.addRow(['Capítulo:', datos.capitulo]);
        wsConsolidados.addRow(['Año:', datos.anio]);
        wsConsolidados.addRow(['Mes:', datos.mes]);
        wsConsolidados.addRow(['Fecha de exportación:', datos.fecha]);
        wsConsolidados.addRow([]);

        wsConsolidados.addRow(['RESULTADOS CONSOLIDADOS']);
        const headerRowCons = wsConsolidados.addRow(['Concepto', 'Real Acumulado', 'Ppto. Acumulado', 'Real Acum. Año Anterior']);
        headerRowCons.font = { bold: true };
        headerRowCons.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D47A1' } };
        headerRowCons.font = { bold: true, color: { argb: 'FFFFFFFF' } };

        datos.consolidados.forEach(row => {
          wsConsolidados.addRow([row.concepto, row.realAcumulado, row.pptoAcumulado, row.realAcumAA]);
        });

        wsConsolidados.columns = [
          { width: 40 },
          { width: 18 },
          { width: 18 },
          { width: 25 }
        ];

        // Agregar gráfica consolidada
        const chartCons = document.getElementById('chartConsolidatedResults');
        if (chartCons) {
          const imageId = workbook.addImage({
            base64: chartCons.toDataURL('image/png'),
            extension: 'png',
          });
          wsConsolidados.addImage(imageId, {
            tl: { col: 0, row: datos.consolidados.length + 11 },
            ext: { width: 800, height: 400 }
          });
        }
      }

      // Descargar archivo
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Graficas_Resumen_${datos.anio}_${datos.mes}_${Date.now()}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);

      console.log('✅ Excel con gráficas exportado correctamente');
    } catch (error) {
      console.error('Error al exportar con ExcelJS:', error);
      alert('Error al generar el archivo Excel. Verifica la consola para más detalles.');
    }
  };

  /**
   * Exportación legacy usando SheetJS (sin gráficas)
   */
  async function exportarGraficasExcelLegacy(datos) {
    const workbook = XLSX.utils.book_new();
    
    // Información general
    const info = [
      ['GRÁFICAS DE RESUMEN - DATOS ACUMULADOS'],
      ['Empresa:', datos.empresa],
      ['Capítulo:', datos.capitulo],
      ['Año:', datos.anio],
      ['Mes:', datos.mes],
      ['Fecha de exportación:', datos.fecha],
      []
    ];
    
    // Hoja 1: Resultados Operativos
    const wsOperativos = XLSX.utils.aoa_to_sheet([
      ...info,
      ['RESULTADOS OPERATIVOS POR CAPÍTULO'],
      ['Concepto', 'Real Acumulado', 'Ppto. Acumulado', 'Real Acum. Año Anterior']
    ]);
    
    XLSX.utils.sheet_add_json(wsOperativos, datos.operativos, {
      origin: -1,
      skipHeader: true,
      header: ['concepto', 'realAcumulado', 'pptoAcumulado', 'realAcumAA']
    });
    
    wsOperativos['!cols'] = [
      { wch: 40 },
      { wch: 18 },
      { wch: 18 },
      { wch: 25 }
    ];
    
    XLSX.utils.book_append_sheet(workbook, wsOperativos, 'Resultados Operativos');
    
    // Hoja 2: Resultados Netos
    const wsNetos = XLSX.utils.aoa_to_sheet([
      ...info,
      ['RESULTADOS NETOS POR CAPÍTULO'],
      ['Concepto', 'Real Acumulado', 'Ppto. Acumulado', 'Real Acum. Año Anterior']
    ]);
    
    XLSX.utils.sheet_add_json(wsNetos, datos.netos, {
      origin: -1,
      skipHeader: true,
      header: ['concepto', 'realAcumulado', 'pptoAcumulado', 'realAcumAA']
    });
    
    wsNetos['!cols'] = [
      { wch: 40 },
      { wch: 18 },
      { wch: 18 },
      { wch: 25 }
    ];
    
    XLSX.utils.book_append_sheet(workbook, wsNetos, 'Resultados Netos');
    
    // Hoja 3: Consolidados
    if (datos.consolidados) {
      const wsConsolidados = XLSX.utils.aoa_to_sheet([
        ...info,
        ['RESULTADOS CONSOLIDADOS'],
        ['Concepto', 'Real Acumulado', 'Ppto. Acumulado', 'Real Acum. Año Anterior']
      ]);
      
      XLSX.utils.sheet_add_json(wsConsolidados, datos.consolidados, {
        origin: -1,
        skipHeader: true,
        header: ['concepto', 'realAcumulado', 'pptoAcumulado', 'realAcumAA']
      });
      
      wsConsolidados['!cols'] = [
        { wch: 40 },
        { wch: 18 },
        { wch: 18 },
        { wch: 25 }
      ];
      
      XLSX.utils.book_append_sheet(workbook, wsConsolidados, 'Consolidados');
    }
    
    const fileName = `Graficas_Resumen_${datos.anio}_${datos.mes}_${Date.now()}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  }
  
  /**
   * Exporta las gráficas a PDF usando jsPDF y html2canvas
   */
  window.exportarGraficasPDF = async () => {
    const datos = obtenerDatosParaExportar();
    if (!datos) return;
    
    // Verificar que las librerías estén disponibles
    if (typeof jspdf === 'undefined' || typeof html2canvas === 'undefined') {
      alert('Las librerías de exportación no están disponibles.');
      return;
    }
    
    try {
      const { jsPDF } = jspdf;
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      let yPosition = margin;
      
      // Título y metadatos
      pdf.setFontSize(16);
      pdf.setFont(undefined, 'bold');
      pdf.text('GRÁFICAS DE RESUMEN - DATOS ACUMULADOS', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 10;
      
      pdf.setFontSize(10);
      pdf.setFont(undefined, 'normal');
      pdf.text(`Empresa: ${datos.empresa}`, margin, yPosition);
      yPosition += 6;
      pdf.text(`Capítulo: ${datos.capitulo}`, margin, yPosition);
      yPosition += 6;
      pdf.text(`Año: ${datos.anio} - Mes: ${datos.mes}`, margin, yPosition);
      yPosition += 6;
      pdf.text(`Fecha: ${datos.fecha}`, margin, yPosition);
      yPosition += 10;
      
      // Función para agregar tabla al PDF
      const agregarTabla = (titulo, datos, startY) => {
        pdf.setFontSize(12);
        pdf.setFont(undefined, 'bold');
        pdf.text(titulo, margin, startY);
        startY += 8;
        
        // Encabezados de tabla con wrap text
        const headers = [['Concepto', 'Real\nAcumulado', 'Ppto.\nAcumulado', 'Real Acum.\nAño Anterior']];
        const rows = datos.map(item => [
          item.concepto,
          formatNumber(item.realAcumulado),
          formatNumber(item.pptoAcumulado),
          formatNumber(item.realAcumAA)
        ]);
        
        pdf.autoTable({
          startY: startY,
          head: headers,
          body: rows,
          theme: 'grid',
          headStyles: {
            fillColor: [13, 71, 161],
            textColor: 255,
            fontSize: 9,
            fontStyle: 'bold',
            halign: 'center',
            valign: 'middle',
            cellPadding: 3,
            minCellHeight: 12
          },
          bodyStyles: {
            fontSize: 8,
            cellPadding: 2,
            valign: 'middle'
          },
          columnStyles: {
            0: { cellWidth: 80, halign: 'left' },
            1: { cellWidth: 30, halign: 'right' },
            2: { cellWidth: 30, halign: 'right' },
            3: { cellWidth: 35, halign: 'right' }
          },
          margin: { left: margin, right: margin },
          styles: {
            overflow: 'linebreak',
            cellWidth: 'wrap'
          }
        });
        
        return pdf.lastAutoTable.finalY + 10;
      };
      
      // Agregar tablas
      yPosition = agregarTabla('RESULTADOS OPERATIVOS POR CAPÍTULO', datos.operativos, yPosition);
      
      // Nueva página si es necesario
      if (yPosition > pageHeight - 60) {
        pdf.addPage();
        yPosition = margin;
      }
      
      yPosition = agregarTabla('RESULTADOS NETOS POR CAPÍTULO', datos.netos, yPosition);
      
      // Consolidados (solo CDMX)
      if (datos.consolidados) {
        if (yPosition > pageHeight - 60) {
          pdf.addPage();
          yPosition = margin;
        }
        yPosition = agregarTabla('RESULTADOS CONSOLIDADOS', datos.consolidados, yPosition);
      }
      
      // Agregar gráficas como imágenes
      const capturaGraficas = async () => {
        pdf.addPage();
        yPosition = margin;
        
        pdf.setFontSize(14);
        pdf.setFont(undefined, 'bold');
        pdf.text('GRÁFICAS VISUALES', pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 10;
        
        // Capturar cada gráfica
        const graficas = [
          { id: 'chartOperatingSummaryByChapter', titulo: 'Resultado Operativo por Capítulo' },
          { id: 'chartNetSummaryByChapter', titulo: 'Resumen Neto por Capítulo' },
          { id: 'chartIngresoPorCapitulo', titulo: 'Ingreso por Capítulo' },
          { id: 'chartIngresoNacional', titulo: 'Ingreso nacional' }
        ];
        
        if (datos.consolidados) {
          graficas.push({ id: 'chartConsolidatedResults', titulo: 'Consolidados Operativos vs Netos' });
        }
        
        for (const grafica of graficas) {
          const canvas = document.getElementById(grafica.id);
          if (canvas) {
            const imgData = await html2canvas(canvas, {
              scale: 2,
              backgroundColor: '#ffffff'
            });
            
            const imgWidth = pageWidth - 2 * margin;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            
            if (yPosition + imgHeight > pageHeight - margin) {
              pdf.addPage();
              yPosition = margin;
            }
            
            pdf.setFontSize(10);
            pdf.setFont(undefined, 'bold');
            pdf.text(grafica.titulo, margin, yPosition);
            yPosition += 5;
            
            pdf.addImage(imgData.toDataURL('image/png'), 'PNG', margin, yPosition, imgWidth, imgHeight);
            yPosition += imgHeight + 10;
          }
        }
      };
      
      await capturaGraficas();
      
      // Descargar PDF
      const fileName = `Graficas_Resumen_${datos.anio}_${datos.mes}_${Date.now()}.pdf`;
      pdf.save(fileName);
      
    } catch (error) {
      console.error('Error al exportar PDF:', error);
      alert('Error al generar el PDF. Por favor, intente nuevamente.');
    }
  };
  
  /**
   * Imprime las gráficas
   */
  window.imprimirGraficas = () => {
    window.print();
  };

  // Iniciar
  sincronizarEmpresa();
  inicializar();
})();
