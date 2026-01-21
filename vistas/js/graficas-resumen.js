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
  const customChartsRow = document.getElementById("customChartsRow");
  const charts = {};
  const customCharts = {};

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
    if (typeof context.parsed?.y === "number") return getParsedValue(context);
    if (typeof context.raw === "number") return context.raw;
    return 0;
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

  const buildIngresoCacheKey = (empresaId, anio, signature = "") =>
    `${empresaId || "sin"}:${anio || "sin"}:${signature || "base"}`;

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

    const graficasConfig = getGraficasConfig();
    const ingresoConfig =
      graficasConfig.ingreso || DEFAULT_GRAFICAS_CONFIG.ingreso;
    const ingresoSources =
      graficasConfig.sources?.ingreso ||
      DEFAULT_GRAFICAS_CONFIG.sources?.ingreso ||
      {};
    if (ingresoConfig.enabled === false) {
      return null;
    }

    const baseChartType = graficasConfig.chart?.type || "bar";
    const chartType = resolveChartType(ingresoConfig.chartType, baseChartType);
    const cacheSignature = JSON.stringify({
      ingreso: ingresoConfig,
      sources: ingresoSources,
      chartType,
    });
    const cacheKey = buildIngresoCacheKey(empresaId, anio, cacheSignature);
    if (ingresoCache.has(cacheKey)) {
      return ingresoCache.get(cacheKey);
    }

    const meses = MONTH_LABELS.map((_, idx) => idx + 1);
    const responses = await Promise.all(
      meses.map(async (mes) => {
        try {
          return await fetchResumenMes(empresaId, anio, mes);
        } catch (err) {
          console.warn("?? Graficas: Error cargando resumen mes", mes, err);
          return null;
        }
      })
    );

    const datasetsConfig = Object.entries(ingresoConfig.series || {})
      .map(([key, serie]) => ({
        key,
        label: serie.label,
        color: serie.color,
        enabled: serie.enabled !== false,
        variants: getSourceVariants(ingresoSources, key, INCOME_LABELS),
      }))
      .filter((serie) => serie.enabled && serie.variants.length);
    if (!datasetsConfig.length) {
      return null;
    }

    const series = datasetsConfig.reduce((acc, item) => {
      acc[item.key] = [];
      return acc;
    }, {});

    responses.forEach((data, idx) => {
      const layout = data?.resumen?.[0]?.layout || [];
      datasetsConfig.forEach((dataset) => {
        const row = obtenerFilaIngreso(layout, dataset.variants);
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

    const isPie = isPieType(chartType);
    const result = {
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
          entry.pointRadius = POINT_RADIUS;
          entry.pointHoverRadius = POINT_HOVER_RADIUS;
        } else if (chartType === "bar") {
          entry.borderRadius = 6;
          entry.maxBarThickness = 18;
        }
        return entry;
      }),
    };

    ingresoCache.set(cacheKey, result);
    return result;
  };

  const ingresoNacionalCache = new Map();
  const buildIngresoNacionalCacheKey = (empresaId, anio, signature = "") =>
    `${empresaId || "sin"}:${anio || "sin"}:${signature || "base"}`;

  const buildIngresoNacionalSeries = async (empresaId, anio) => {
    if (!empresaId || !anio) return null;

    const graficasConfig = getGraficasConfig();
    const ingresoConfig =
      graficasConfig.ingresoNacional || DEFAULT_GRAFICAS_CONFIG.ingresoNacional;
    const ingresoSources =
      graficasConfig.sources?.ingresoNacional ||
      DEFAULT_GRAFICAS_CONFIG.sources?.ingresoNacional ||
      {};
    if (ingresoConfig.enabled === false) {
      return null;
    }

    const baseChartType = graficasConfig.chart?.type || "bar";
    const chartType = resolveChartType(
      ingresoConfig.chartType,
      baseChartType
    );
    const cacheSignature = JSON.stringify({
      ingresoNacional: ingresoConfig,
      sources: ingresoSources,
      chartType,
    });
    const cacheKey = buildIngresoNacionalCacheKey(empresaId, anio, cacheSignature);
    if (ingresoNacionalCache.has(cacheKey)) {
      return ingresoNacionalCache.get(cacheKey);
    }

    const meses = MONTH_LABELS.map((_, idx) => idx + 1);
    const responses = await Promise.all(
      meses.map(async (mes) => {
        try {
          return await fetchResumenMes(empresaId, anio, mes);
        } catch (err) {
          console.warn("?? Graficas: Error cargando ingreso nacional", mes, err);
          return null;
        }
      })
    );

    const datasetsConfig = Object.entries(ingresoConfig.series || {})
      .map(([key, serie]) => ({
        key,
        label: serie.label,
        color: serie.color,
        enabled: serie.enabled !== false,
        variants: getSourceVariants(ingresoSources, key, INGRESO_NACIONAL_LABELS),
      }))
      .filter((serie) => serie.enabled && serie.variants.length);
    if (!datasetsConfig.length) {
      return null;
    }

    const series = datasetsConfig.reduce((acc, item) => {
      acc[item.key] = [];
      return acc;
    }, {});

    responses.forEach((data, idx) => {
      const layout = data?.resumen?.[0]?.layout || [];
      datasetsConfig.forEach((dataset) => {
        const row = obtenerFilaIngreso(layout, dataset.variants);
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

    const isPie = isPieType(chartType);
    const result = {
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
          entry.pointRadius = POINT_RADIUS;
          entry.pointHoverRadius = POINT_HOVER_RADIUS;
        } else if (chartType === "bar") {
          entry.borderRadius = 6;
          entry.maxBarThickness = 18;
        }
        return entry;
      }),
    };

    ingresoNacionalCache.set(cacheKey, result);
    return result;
  };

  // === CONFIGURACIÓN DE GRÁFICAS POR CAPÍTULO ===

  /**
   * Define las filas que se deben mostrar en las gráficas según el capítulo
   */
  const getRowsConfig = (capitulo, graficasConfig = {}) => {
    const cap = normalizarLabel(capitulo);
    const sources =
      graficasConfig?.sources?.summary ||
      DEFAULT_GRAFICAS_CONFIG.sources?.summary ||
      null;

    const resolveGroup = (key) => {
      const group = sources?.[key];
      if (!group) return null;
      const operating = Array.isArray(group.operating) ? group.operating : [];
      const net = Array.isArray(group.net) ? group.net : [];
      if (!operating.length && !net.length) return null;
      return { operating, net, isCdmx: key === "cdmx" };
    };

    if (sources) {
      if (
        cap.includes("CIUDAD DE MEXICO") ||
        cap.includes("CDMX") ||
        cap.includes("MEXICO")
      ) {
        const resolved = resolveGroup("cdmx");
        if (resolved) return resolved;
      }

      if (cap.includes("GUADALAJARA") || cap.includes("GDL")) {
        const resolved = resolveGroup("gdl");
        if (resolved) return resolved;
      }

      if (
        cap.includes("NORESTE") ||
        cap.includes("NE ") ||
        cap.includes("MONTERREY")
      ) {
        const resolved = resolveGroup("ne");
        if (resolved) return resolved;
      }

      if (
        cap.includes("NOROESTE") ||
        cap.includes("NO ") ||
        cap.includes("NORTHWEST")
      ) {
        const resolved = resolveGroup("no");
        if (resolved) return resolved;
      }

      const fallback = resolveGroup("generic");
      if (fallback) return fallback;
    }

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
    version: 2,
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
    ingreso: {
      enabled: true,
      title: "Ingreso por capitulo",
      subtitle: "Real acumulado por mes",
      series: {
        mex: { label: "CDMX INCOME", color: "#0d47a1", enabled: true },
        gdl: { label: "GUADALAJARA INCOME", color: "#60a5fa", enabled: true },
        mty: { label: "MONTERREY INCOME", color: "#22c55e", enabled: true },
        nw: { label: "NORTHWEST INCOME", color: "#f59e0b", enabled: true },
      },
    },
    ingresoNacional: {
      enabled: true,
      title: "Ingreso nacional",
      subtitle: "Real acumulado por mes",
      series: {
        committees: { label: "Committees", color: "#0d47a1", enabled: true },
        membership: { label: "Membership", color: "#60a5fa", enabled: true },
        events: { label: "Events", color: "#22c55e", enabled: true },
        services: { label: "Services to Members", color: "#f59e0b", enabled: true },
        tic: { label: "T&IC", color: "#a855f7", enabled: true },
      },
    },
    sources: {
      summary: {
        cdmx: {
          operating: [
            { label: "Ciudad de Mexico", variants: ["OPERATING RESULTS MEXICO"] },
            {
              label: "Guadalajara",
              variants: ["OPERATING RESULTS GUADALAJARA", "GDL OPERATING RESULTS"],
            },
            {
              label: "Noreste",
              variants: ["OPERATING RESULTS MONTERREY", "MTY OPERATING RESULTS"],
            },
            {
              label: "Noroeste",
              variants: [
                "OPERATING RESULTS NORTHWEST",
                "OPERATING RESULTS NO",
                "NO OPERATING RESULTS",
              ],
            },
          ],
          net: [
            { label: "Ciudad de Mexico", variants: ["NET RESULTS MEXICO"] },
            {
              label: "Guadalajara",
              variants: ["NET RESULTS GUADALAJARA", "GDL NET RESULTS"],
            },
            {
              label: "Noreste",
              variants: ["NET RESULTS MONTERREY", "MTY NET RESULTS"],
            },
            {
              label: "Noroeste",
              variants: ["NET RESULTS NORTHWEST", "NET RESULTS NO", "NO NET RESULTS"],
            },
          ],
        },
        gdl: {
          operating: [
            {
              label: "{capitulo}",
              variants: [
                "GDL OPERATING RESULTS",
                "OPERATING RESULTS GUADALAJARA",
                "OPERATING RESULTS",
              ],
            },
          ],
          net: [
            {
              label: "{capitulo}",
              variants: ["NET RESULTS", "GDL NET RESULTS", "NET RESULTS GUADALAJARA"],
            },
          ],
        },
        ne: {
          operating: [
            {
              label: "{capitulo}",
              variants: [
                "NE OPERATING RESULTS",
                "OPERATING RESULTS MONTERREY",
                "OPERATING RESULTS",
              ],
            },
          ],
          net: [
            {
              label: "{capitulo}",
              variants: ["NET RESULTS", "NE NET RESULTS", "NET RESULTS MONTERREY"],
            },
          ],
        },
        no: {
          operating: [
            {
              label: "{capitulo}",
              variants: [
                "NO OPERATING RESULTS",
                "OPERATING RESULTS NORTHWEST",
                "OPERATING RESULTS",
              ],
            },
          ],
          net: [
            {
              label: "{capitulo}",
              variants: ["NET RESULTS", "NO NET RESULTS", "NET RESULTS NORTHWEST"],
            },
          ],
        },
        generic: {
          operating: [
            {
              label: "{capitulo}",
              variants: ["OPERATING RESULTS", "RESULTADO OPERATIVO"],
            },
          ],
          net: [
            { label: "{capitulo}", variants: ["NET RESULTS", "RESULTADO NETO"] },
          ],
        },
      },
      consolidated: {
        operating: {
          label: "CONSOLIDATED OPERATING RESULTS",
          variants: [
            "CONSOLIDATED OPERATING RESULTS",
            "CONSOLIDATED OPERATING RESULT",
          ],
        },
        net: {
          label: "CONSOLIDATED NET RESULTS",
          variants: ["CONSOLIDATED NET RESULTS", "CONSOLIDATED NET RESULT"],
        },
      },
      ingreso: {
        mex: ["CDMX INCOME", "MEXICO INCOME", "CIUDAD DE MEXICO INCOME"],
        gdl: ["GUADALAJARA INCOME", "GDL INCOME", "GUADALAJARA INCOMEA"],
        mty: ["MONTERREY INCOME", "MTY INCOME"],
        nw: ["NORTHWEST INCOME", "NW INCOME", "NOROESTE INCOME", "NO INCOME"],
      },
      ingresoNacional: {
        committees: ["COMMITTEES", "COMITES", "COMITS", "COMMITTEES (INCOME)"],
        membership: ["MEMBERSHIP", "MEMBERSHIP (INCOME)"],
        events: ["EVENTS", "EVENTS (INCOME)"],
        services: [
          "SERVICES TO MEMBERS",
          "SERVICES MEMBERS",
          "SERVICES TO MEMBERS (INCOME)",
        ],
        tic: ["T&IC", "T&IC (INCOME)", "T&IC INCOME"],
      },
    },
    operativo: {
      enabled: true,
      title: "Ppto. Acumulado vs Real + {annual}",
      datasets: {
        budget: { label: "Ppto. Acumulado", color: "#4472c4", enabled: true },
        real: { label: "Real Acumulado", color: "#ffc000", enabled: true },
        annual: { label: "Presupuesto {year}", color: "#22c55e", enabled: true },
      },
    },
    gastosGenerales: {
      enabled: true,
      subtitleTemplate: "Real {year} vs {prev}",
      charts: {
        rendimientos: {
          enabled: true,
          title: "Rendimientos de Inversion",
          series: {
            actual: { label: "Real {year}", color: "#ffc000", enabled: true },
            prev: { label: "Real {prev}", color: "#2f5496", enabled: true },
          },
        },
        plusvalia: {
          enabled: true,
          title: "Plusvalia/Minusvalia",
          series: {
            actual: { label: "Real {year}", color: "#ffc000", enabled: true },
            prev: { label: "Real {prev}", color: "#2f5496", enabled: true },
          },
        },
      },
    },
  };

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const ALLOWED_SERIES_KEYS = new Set(["actualYTD", "planYTD", "prevYTD"]);

  const normalizeSeriesMap = (defaultsMap, overrideMap) => {
    const result = {};
    const baseMap = defaultsMap && typeof defaultsMap === "object" ? defaultsMap : {};
    const overrides = overrideMap && typeof overrideMap === "object" ? overrideMap : {};
    Object.keys(baseMap).forEach((key) => {
      const base = baseMap[key] || {};
      const override = overrides[key] || {};
      result[key] = {
        ...base,
        label:
          typeof override.label === "string" && override.label.trim()
            ? override.label.trim()
            : base.label,
        color:
          typeof override.color === "string" && override.color.trim()
            ? override.color.trim()
            : base.color,
        enabled:
          typeof override.enabled === "boolean" ? override.enabled : base.enabled,
      };
    });
    return result;
  };

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

    if (config.ingreso && typeof config.ingreso === "object") {
      const override = config.ingreso || {};
      if (typeof override.enabled === "boolean") {
        base.ingreso.enabled = override.enabled;
      }
      if (typeof override.title === "string" && override.title.trim()) {
        base.ingreso.title = override.title.trim();
      }
      if (typeof override.subtitle === "string" && override.subtitle.trim()) {
        base.ingreso.subtitle = override.subtitle.trim();
      }
      base.ingreso.series = normalizeSeriesMap(base.ingreso.series, override.series);
    }

    if (config.ingresoNacional && typeof config.ingresoNacional === "object") {
      const override = config.ingresoNacional || {};
      if (typeof override.enabled === "boolean") {
        base.ingresoNacional.enabled = override.enabled;
      }
      if (typeof override.title === "string" && override.title.trim()) {
        base.ingresoNacional.title = override.title.trim();
      }
      if (typeof override.subtitle === "string" && override.subtitle.trim()) {
        base.ingresoNacional.subtitle = override.subtitle.trim();
      }
      base.ingresoNacional.series = normalizeSeriesMap(
        base.ingresoNacional.series,
        override.series
      );
    }

    if (config.operativo && typeof config.operativo === "object") {
      const override = config.operativo || {};
      if (typeof override.enabled === "boolean") {
        base.operativo.enabled = override.enabled;
      }
      if (typeof override.title === "string" && override.title.trim()) {
        base.operativo.title = override.title.trim();
      }
      base.operativo.datasets = normalizeSeriesMap(
        base.operativo.datasets,
        override.datasets
      );
    }

    if (config.gastosGenerales && typeof config.gastosGenerales === "object") {
      const override = config.gastosGenerales || {};
      if (typeof override.enabled === "boolean") {
        base.gastosGenerales.enabled = override.enabled;
      }
      if (
        typeof override.subtitleTemplate === "string" &&
        override.subtitleTemplate.trim()
      ) {
        base.gastosGenerales.subtitleTemplate = override.subtitleTemplate.trim();
      }
      if (override.charts && typeof override.charts === "object") {
        Object.keys(base.gastosGenerales.charts || {}).forEach((key) => {
          const chartOverride = override.charts?.[key] || {};
          if (typeof chartOverride.enabled === "boolean") {
            base.gastosGenerales.charts[key].enabled = chartOverride.enabled;
          }
          if (
            typeof chartOverride.title === "string" &&
            chartOverride.title.trim()
          ) {
            base.gastosGenerales.charts[key].title = chartOverride.title.trim();
          }
          base.gastosGenerales.charts[key].series = normalizeSeriesMap(
            base.gastosGenerales.charts[key].series,
            chartOverride.series
          );
        });
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

  const applyCommonChartOptions = (options = {}, config, chartTypeOverride) => {
    const legend = options.plugins?.legend || {};
    legend.display = Boolean(config.legend?.show);
    legend.position = config.legend?.position || "bottom";
    options.plugins = { ...(options.plugins || {}), legend };

    options.scales = options.scales || {};
    options.scales.x = options.scales.x || {};
    options.scales.y = options.scales.y || {};

    const resolvedType = chartTypeOverride || config.chart?.type;
    const shouldStack = resolvedType === "bar" && Boolean(config.chart?.stacked);
    options.scales.x.stacked = shouldStack;
    options.scales.y.stacked = shouldStack;

    return options;
  };

  const clearCustomCharts = () => {
    Object.keys(customCharts).forEach((key) => {
      customCharts[key]?.destroy?.();
      delete customCharts[key];
    });
    if (customChartsRow) {
      customChartsRow.innerHTML = "";
    }
  };

  const sanitizeChartId = (value) =>
    String(value || "")
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, "");

  const getCustomModuleKey = (chart) =>
    (chart?.module || "RESUMEN").toString().trim().toUpperCase();

  const getRowDataLoose = (snapshotMap, labels) => {
    if (!snapshotMap) return { actual: 0, plan: 0, prev: 0, actualYTD: 0, planYTD: 0, prevYTD: 0 };
    const arr = Array.isArray(labels) ? labels : [labels];
    for (const lbl of arr) {
      const normalizado = normalizarLabel(lbl);
      const hit = snapshotMap.get(normalizado);
      if (hit) return hit;
      for (const [key, value] of snapshotMap.entries()) {
        if (key.includes(normalizado)) return value;
      }
    }
    return {
      actual: 0,
      plan: 0,
      prev: 0,
      actualYTD: 0,
      planYTD: 0,
      prevYTD: 0,
    };
  };

  const buildCustomChartData = (rows, snapshotMap, columnDefs, chartType) => {
    if (!Array.isArray(rows) || !rows.length) return null;
    const resolvedRows = rows
      .map((row) => {
        const variants =
          Array.isArray(row?.variants) && row.variants.length
            ? row.variants
            : row?.label
            ? [row.label]
            : row?.alias
            ? [row.alias]
            : [];
        if (!variants.length) return null;
        return {
          label: row?.alias || variants[0],
          data: getRowDataLoose(snapshotMap, variants),
        };
      })
      .filter(Boolean);

    if (!resolvedRows.length) return null;

    const labels = resolvedRows.map((row) => row.label || "-");
    const isPie = isPieType(chartType);
    const datasets = columnDefs.map((col) => {
      const rawValues = resolvedRows.map((row) => toNumber(row.data[col.key]));
      const data = isPie ? rawValues : rawValues.map((value) => ocultarCeros(value));
      const dataset = {
        label: col.label,
        data,
        borderWidth: chartType === "line" ? 2 : 1,
      };
      if (isPie) {
        dataset.backgroundColor = buildSlicePalette(data.length, col.color);
        dataset.borderColor = "#ffffff";
        dataset.borderWidth = 1;
        return dataset;
      }
      dataset.backgroundColor = col.color;
      dataset.borderColor = col.color;
      if (chartType === "line") {
        dataset.fill = false;
        dataset.tension = 0.32;
        dataset.pointRadius = POINT_RADIUS;
        dataset.pointHoverRadius = POINT_HOVER_RADIUS;
        dataset.pointBackgroundColor = col.color;
      } else {
        dataset.minBarLength = MIN_BAR_LENGTH;
      }
      return dataset;
    });

    return { labels, datasets };
  };

  const renderCustomCharts = (snapshotMap, config) => {
    clearCustomCharts();
    if (!customChartsRow || !snapshotMap) return;
    const customChartsList = Array.isArray(config.customCharts)
      ? config.customCharts
      : [];
    if (!customChartsList.length) return;

    const currentModule = (document.body?.dataset?.modulo || "RESUMEN")
      .toString()
      .toUpperCase();
    const columnDefs = getColumnDefs(config);
    if (!columnDefs.length) return;

    const baseChartType = config.chart?.type || "bar";

    customChartsList.forEach((chart, index) => {
      if (chart?.enabled === false) return;
      if (getCustomModuleKey(chart) !== currentModule) return;
      const rows = Array.isArray(chart?.rows) ? chart.rows : [];
      if (!rows.length) return;
      const chartType =
        chart?.chartType && chart.chartType !== "inherit"
          ? chart.chartType
          : baseChartType;
      const data = buildCustomChartData(rows, snapshotMap, columnDefs, chartType);
      if (!data) return;

      const safeId = sanitizeChartId(chart.id) || `customChart-${index + 1}`;
      const canvasId = `customChart-${safeId}`;
      const wrapper = document.createElement("div");
      wrapper.className = "col-12";
      wrapper.innerHTML = `
        <div class="card chart-card p-3" data-custom-chart="${canvasId}">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <h5 class="mb-0">${chart.title || "Grafica personalizada"}</h5>
            <small class="text-muted">${chart.subtitle || ""}</small>
          </div>
          <div class="chart-container">
            <canvas id="${canvasId}"></canvas>
          </div>
        </div>
      `;
      customChartsRow.appendChild(wrapper);
      const canvas = wrapper.querySelector("canvas");
      if (!canvas) return;
      customCharts[canvasId] = new Chart(canvas, {
        type: chartType,
        data: {
          labels: data.labels,
          datasets: data.datasets,
        },
        options: applyCommonChartOptions(
          {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              title: { display: false },
              tooltip: {
                callbacks: {
                  label: function (context) {
                    let label = context.dataset.label || "";
                    if (label) {
                      label += ": ";
                    }
                    label += formatNumber(getParsedValue(context));
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
          config,
          chartType
        ),
      });
    });
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
      ingreso: {
        titleId: "incomeByChapterTitle",
        subtitleId: "incomeByChapterSubtitle",
        cardId: "incomeByChapterCard",
      },
      ingresoNacional: {
        titleId: "incomeNationalTitle",
        subtitleId: "incomeNationalSubtitle",
        cardId: "incomeNationalCard",
      },
    };

    Object.entries(mapping).forEach(([key, value]) => {
      const chartCfg =
        key === "ingreso"
          ? config.ingreso || {}
          : key === "ingresoNacional"
          ? config.ingresoNacional || {}
          : config.charts?.[key] || {};
      const titleEl = document.getElementById(value.titleId);
      const subtitleEl = document.getElementById(value.subtitleId);
      const cardEl = document.getElementById(value.cardId);

      if (titleEl && chartCfg.title) {
        titleEl.textContent = chartCfg.title;
      }
      if (subtitleEl) {
        subtitleEl.textContent = chartCfg.subtitle || "";
      }

      if (cardEl) {
        if (key === "consolidated") {
          if (chartCfg.enabled === false) {
            cardEl.style.display = "none";
          }
        } else {
          cardEl.style.display = chartCfg.enabled === false ? "none" : "";
        }
      }
    });
  };

  /**
   * Construye los datasets para un conjunto de filas
   */
  const buildDatasets = (rows, snapshotMap, columnDefs, chartType) => {
    const isPie = isPieType(chartType);
    return columnDefs.map((col) => {
      const rawValues = rows.map((row) => {
        const data = getRowData(snapshotMap, row.variants);
        return toNumber(data[col.key]);
      });
      const dataset = {
        label: col.label,
        data: isPie ? rawValues : rawValues.map((value) => ocultarCeros(value)),
        borderWidth: 2,
      };

      if (isPie) {
        dataset.backgroundColor = buildSlicePalette(rawValues.length, col.color);
        dataset.borderColor = "#ffffff";
        dataset.borderWidth = 1;
        return dataset;
      }

      dataset.backgroundColor = col.color;
      dataset.borderColor = col.color;

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
    const baseChartType = graficasConfig.chart?.type || "bar";
    const operatingType = resolveChartType(
      graficasConfig.charts?.operating?.chartType,
      baseChartType
    );
    const netType = resolveChartType(
      graficasConfig.charts?.net?.chartType,
      baseChartType
    );
    const consolidatedType = resolveChartType(
      graficasConfig.charts?.consolidated?.chartType,
      baseChartType
    );
    updateChartHeaders(graficasConfig);

    const config = getRowsConfig(capitulo, graficasConfig);

    // === 1. Resultado Operativo por Capítulo ===
    // === 2. Resumen Neto por Capítulo ===
    // Estos se renderizan en renderChapterSummaryCharts
    renderChapterSummaryCharts(snapshotMap, config, graficasConfig);

    // === 3. Consolidados Operativos vs Netos (SOLO PARA CDMX) ===
    const showConsolidated =
      config.isCdmx && graficasConfig.charts?.consolidated?.enabled !== false;
    if (consolidatedCard) {
      consolidatedCard.style.display = showConsolidated ? "block" : "none";
    }

    if (showConsolidated) {
      const consolidatedSources =
        graficasConfig.sources?.consolidated ||
        DEFAULT_GRAFICAS_CONFIG.sources?.consolidated ||
        {};
      const consolidatedOp = getRowData(
        snapshotMap,
        getConsolidatedVariants(
          consolidatedSources,
          "operating",
          DEFAULT_GRAFICAS_CONFIG.sources?.consolidated || {}
        )
      );
      const consolidatedNet = getRowData(
        snapshotMap,
        getConsolidatedVariants(
          consolidatedSources,
          "net",
          DEFAULT_GRAFICAS_CONFIG.sources?.consolidated || {}
        )
      );

      const consolidatedColumns = columnDefs.length
        ? columnDefs
        : getColumnDefs(DEFAULT_GRAFICAS_CONFIG);
      const consolidatedLabels = consolidatedColumns.map((col) => col.label);

      console.log("📊 Graficas: Consolidados -", {
        operating: consolidatedOp,
        net: consolidatedNet,
      });

      renderChart("chartConsolidatedResults", {
        type: consolidatedType,
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
              backgroundColor: isPieType(consolidatedType)
                ? buildSlicePalette(
                    consolidatedColumns.length,
                    graficasConfig.consolidatedSeries?.operating?.color || "#0d47a1"
                  )
                : graficasConfig.consolidatedSeries?.operating?.color || "#0d47a1",
              borderColor: isPieType(consolidatedType)
                ? "#ffffff"
                : graficasConfig.consolidatedSeries?.operating?.color || "#0d47a1",
              borderWidth: isPieType(consolidatedType)
                ? 1
                : consolidatedType === "line"
                ? 2
                : 1,
              ...(consolidatedType === "line"
                ? {
                    fill: false,
                    tension: 0.32,
                    pointRadius: POINT_RADIUS,
                    pointHoverRadius: POINT_HOVER_RADIUS,
                    pointBackgroundColor:
                      graficasConfig.consolidatedSeries?.operating?.color ||
                      "#0d47a1",
                  }
                : consolidatedType === "bar"
                ? { minBarLength: MIN_BAR_LENGTH }
                : {}),
            },
            {
              label:
                graficasConfig.consolidatedSeries?.net?.label ||
                "CONSOLIDATED NET RESULTS",
              data: consolidatedColumns.map((col) =>
                toNumber(consolidatedNet[col.key])
              ),
              backgroundColor: isPieType(consolidatedType)
                ? buildSlicePalette(
                    consolidatedColumns.length,
                    graficasConfig.consolidatedSeries?.net?.color || "#94a3b8"
                  )
                : graficasConfig.consolidatedSeries?.net?.color || "#94a3b8",
              borderColor: isPieType(consolidatedType)
                ? "#ffffff"
                : graficasConfig.consolidatedSeries?.net?.color || "#94a3b8",
              borderWidth: isPieType(consolidatedType)
                ? 1
                : consolidatedType === "line"
                ? 2
                : 1,
              ...(consolidatedType === "line"
                ? {
                    fill: false,
                    tension: 0.32,
                    pointRadius: POINT_RADIUS,
                    pointHoverRadius: POINT_HOVER_RADIUS,
                    pointBackgroundColor:
                      graficasConfig.consolidatedSeries?.net?.color || "#94a3b8",
                  }
                : consolidatedType === "bar"
                ? { minBarLength: MIN_BAR_LENGTH }
                : {}),
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
                    label += formatNumber(getParsedValue(context));
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
          graficasConfig,
          consolidatedType
        ),
      });
    }

    renderCustomCharts(snapshotMap, graficasConfig);
  };

  /**
   * Renderiza gráficas de resumen comparando todos los capítulos/regiones
   * Para CDMX: Usa las filas de OPERATING RESULTS y NET RESULTS por región del snapshot actual
   * Para otros capítulos: Usa sus propios datos
   */
  const renderChapterSummaryCharts = async (
    snapshotMap,
    rowsConfig,
    graficasConfigOverride
  ) => {
    const graficasConfig = graficasConfigOverride || getGraficasConfig();
    const columnDefs = getColumnDefs(graficasConfig);
    const baseChartType = graficasConfig.chart?.type || "bar";
    const operatingType = resolveChartType(
      graficasConfig.charts?.operating?.chartType,
      baseChartType
    );
    const netType = resolveChartType(
      graficasConfig.charts?.net?.chartType,
      baseChartType
    );
    const showOperating = graficasConfig.charts?.operating?.enabled !== false;
    const showNet = graficasConfig.charts?.net?.enabled !== false;

    if (!snapshotMap || snapshotMap.size === 0) return;

    const operatingRows = Array.isArray(rowsConfig?.operating)
      ? rowsConfig.operating
      : [];
    const netRows = Array.isArray(rowsConfig?.net) ? rowsConfig.net : [];
    const isCdmx = Boolean(rowsConfig?.isCdmx);

    const empresa = window.Sesion?.obtenerEmpresaActiva?.();
    const configEmpresa = window.CapitulosModulos?.obtenerConfigEmpresa?.(
      empresa?.id
    );
    const etiqueta = configEmpresa?.etiqueta || empresa?.etiqueta || "Capitulo";
    const resolveLabel = (label) =>
      (label || etiqueta).toString().replace(/\{capitulo\}/gi, etiqueta);

    if (isCdmx && operatingRows.length && netRows.length) {
      const operatingSummaries = operatingRows.map((row) => ({
        label: resolveLabel(row.label || row.alias || ""),
        data: getRowData(snapshotMap, row.variants || []),
      }));
      const netSummaries = netRows.map((row) => ({
        label: resolveLabel(row.label || row.alias || ""),
        data: getRowData(snapshotMap, row.variants || []),
      }));

      console.log("?? Graficas: Resumen por capitulo (CDMX):", {
        operatingSummaries,
        netSummaries,
      });

      if (showOperating && operatingSummaries.length) {
        const labels = operatingSummaries.map((s) => s.label);
        const isPie = isPieType(operatingType);
        const operatingDatasets = columnDefs.map((col) => {
          const rawValues = operatingSummaries.map((s) =>
            toNumber(s.data[col.key])
          );
          const data = isPie ? rawValues : rawValues.map((value) => ocultarCeros(value));
          const dataset = {
            label: col.label,
            data,
            borderWidth: isPie ? 1 : operatingType === "line" ? 2 : 1,
          };
          if (isPie) {
            dataset.backgroundColor = buildSlicePalette(data.length, col.color);
            dataset.borderColor = "#ffffff";
            return dataset;
          }
          dataset.backgroundColor = col.color;
          dataset.borderColor = col.color;
          if (operatingType === "line") {
            dataset.fill = false;
            dataset.tension = 0.32;
            dataset.pointRadius = POINT_RADIUS;
            dataset.pointHoverRadius = POINT_HOVER_RADIUS;
            dataset.pointBackgroundColor = col.color;
          } else if (operatingType === "bar") {
            dataset.minBarLength = MIN_BAR_LENGTH;
          }
          return dataset;
        });

        renderChart("chartOperatingSummaryByChapter", {
          type: operatingType,
          data: {
            labels,
            datasets: operatingDatasets,
          },
          options: applyCommonChartOptions(
            {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                title: { display: false },
                tooltip: {
                  callbacks: {
                    label: function (context) {
                      let label = context.dataset.label || "";
                      if (label) {
                        label += ": ";
                      }
                      label += formatNumber(getParsedValue(context));
                      return label;
                    },
                  },
                },
              },
              scales: {
                y: {
                  beginAtZero: false,
                  ticks: {
                    callback: function (value) {
                      return formatNumber(value);
                    },
                  },
                },
                x: {
                  ticks: {
                    font: { size: 11 },
                  },
                },
              },
            },
            graficasConfig,
            operatingType
          ),
        });
      } else {
        clearChart("chartOperatingSummaryByChapter");
      }

      if (showNet && netSummaries.length) {
        const labels = netSummaries.map((s) => s.label);
        const isPie = isPieType(netType);
        const netDatasets = columnDefs.map((col) => {
          const rawValues = netSummaries.map((s) => toNumber(s.data[col.key]));
          const data = isPie ? rawValues : rawValues.map((value) => ocultarCeros(value));
          const dataset = {
            label: col.label,
            data,
            borderWidth: isPie ? 1 : netType === "line" ? 2 : 1,
          };
          if (isPie) {
            dataset.backgroundColor = buildSlicePalette(data.length, col.color);
            dataset.borderColor = "#ffffff";
            return dataset;
          }
          dataset.backgroundColor = col.color;
          dataset.borderColor = col.color;
          if (netType === "line") {
            dataset.fill = false;
            dataset.tension = 0.32;
            dataset.pointRadius = 3;
            dataset.pointBackgroundColor = col.color;
          }
          return dataset;
        });

        renderChart("chartNetSummaryByChapter", {
          type: netType,
          data: {
            labels,
            datasets: netDatasets,
          },
          options: applyCommonChartOptions(
            {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                title: { display: false },
                tooltip: {
                  callbacks: {
                    label: function (context) {
                      let label = context.dataset.label || "";
                      if (label) {
                        label += ": ";
                      }
                      label += formatNumber(getParsedValue(context));
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
                  ticks: {
                    font: { size: 11 },
                  },
                },
              },
            },
            graficasConfig,
            netType
          ),
        });
      } else {
        clearChart("chartNetSummaryByChapter");
      }

      return;
    }

    if (snapshotMap && snapshotMap.size > 0) {
      const operatingSummaries = operatingRows.map((row) => ({
        label: resolveLabel(row.label || row.alias || ""),
        data: getRowData(snapshotMap, row.variants || []),
      }));
      const netSummaries = netRows.map((row) => ({
        label: resolveLabel(row.label || row.alias || ""),
        data: getRowData(snapshotMap, row.variants || []),
      }));

      if (showOperating && operatingSummaries.length) {
        const labels = operatingSummaries.map((s) => s.label);
        const isPie = isPieType(operatingType);
        const operatingDatasets = columnDefs.map((col) => {
          const rawValues = operatingSummaries.map((s) =>
            toNumber(s.data[col.key])
          );
          const data = isPie ? rawValues : rawValues.map((value) => ocultarCeros(value));
          const dataset = {
            label: col.label,
            data,
            borderWidth: isPie ? 1 : operatingType === "line" ? 2 : 1,
          };
          if (isPie) {
            dataset.backgroundColor = buildSlicePalette(data.length, col.color);
            dataset.borderColor = "#ffffff";
            return dataset;
          }
          dataset.backgroundColor = col.color;
          dataset.borderColor = col.color;
          if (operatingType === "line") {
            dataset.fill = false;
            dataset.tension = 0.32;
            dataset.pointRadius = POINT_RADIUS;
            dataset.pointHoverRadius = POINT_HOVER_RADIUS;
            dataset.pointBackgroundColor = col.color;
          } else if (operatingType === "bar") {
            dataset.minBarLength = MIN_BAR_LENGTH;
          }
          return dataset;
        });

        renderChart("chartOperatingSummaryByChapter", {
          type: operatingType,
          data: {
            labels,
            datasets: operatingDatasets,
          },
          options: applyCommonChartOptions(
            {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                title: { display: false },
                tooltip: {
                  callbacks: {
                    label: function (context) {
                      let label = context.dataset.label || "";
                      if (label) {
                        label += ": ";
                      }
                      label += formatNumber(getParsedValue(context));
                      return label;
                    },
                  },
                },
              },
              scales: {
                y: {
                  beginAtZero: false,
                  ticks: {
                    callback: function (value) {
                      return formatNumber(value);
                    },
                  },
                },
                x: {
                  ticks: {
                    font: { size: 11 },
                  },
                },
              },
            },
            graficasConfig,
            operatingType
          ),
        });
      } else {
        clearChart("chartOperatingSummaryByChapter");
      }

      if (showNet && netSummaries.length) {
        const labels = netSummaries.map((s) => s.label);
        const isPie = isPieType(netType);
        const netDatasets = columnDefs.map((col) => {
          const rawValues = netSummaries.map((s) => toNumber(s.data[col.key]));
          const data = isPie ? rawValues : rawValues.map((value) => ocultarCeros(value));
          const dataset = {
            label: col.label,
            data,
            borderWidth: isPie ? 1 : netType === "line" ? 2 : 1,
          };
          if (isPie) {
            dataset.backgroundColor = buildSlicePalette(data.length, col.color);
            dataset.borderColor = "#ffffff";
            return dataset;
          }
          dataset.backgroundColor = col.color;
          dataset.borderColor = col.color;
          if (netType === "line") {
            dataset.fill = false;
            dataset.tension = 0.32;
            dataset.pointRadius = POINT_RADIUS;
            dataset.pointHoverRadius = POINT_HOVER_RADIUS;
            dataset.pointBackgroundColor = col.color;
          } else if (netType === "bar") {
            dataset.minBarLength = MIN_BAR_LENGTH;
          }
          return dataset;
        });

        renderChart("chartNetSummaryByChapter", {
          type: netType,
          data: {
            labels,
            datasets: netDatasets,
          },
          options: applyCommonChartOptions(
            {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                title: { display: false },
                tooltip: {
                  callbacks: {
                    label: function (context) {
                      let label = context.dataset.label || "";
                      if (label) {
                        label += ": ";
                      }
                      label += formatNumber(getParsedValue(context));
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
                  ticks: {
                    font: { size: 11 },
                  },
                },
              },
            },
            graficasConfig,
            netType
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
    clearChart("chartIngresoPorCapitulo");

    const graficasConfig = getGraficasConfig();
    const ingresoConfig =
      graficasConfig.ingreso || DEFAULT_GRAFICAS_CONFIG.ingreso;
    const baseChartType = graficasConfig.chart?.type || "bar";
    const chartType = resolveChartType(ingresoConfig.chartType, baseChartType);
    if (ingresoConfig.enabled === false) {
      return;
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
        type: chartType,
        data: {
          labels: series.labels,
          datasets: series.datasets,
        },
        options: applyCommonChartOptions(
          {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                labels: { padding: 15, font: { size: 12 } },
              },
              title: {
                display: false,
              },
              tooltip: {
                callbacks: {
                  label: function (context) {
                    let label = context.dataset.label || "";
                    if (label) {
                      label += ": ";
                    }
                    label += formatNumber(getParsedValue(context));
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
          graficasConfig,
          consolidatedType
        ),
      });
    } catch (err) {
      console.warn("?? Graficas: No se pudo renderizar ingreso por capitulo", err);
    }
  };

  const renderIngresoNacionalChart = async (empresaId, anio) => {
    if (!ingresoNacionalCanvas) return;
    if (ingresoNacionalCard) {
      ingresoNacionalCard.style.display = "none";
    }
    clearChart("chartIngresoNacional");

    const graficasConfig = getGraficasConfig();
    const ingresoConfig =
      graficasConfig.ingresoNacional || DEFAULT_GRAFICAS_CONFIG.ingresoNacional;
    const baseChartType = graficasConfig.chart?.type || "bar";
    const chartType = resolveChartType(ingresoConfig.chartType, baseChartType);
    if (ingresoConfig.enabled === false) {
      return;
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
        type: chartType,
        data: {
          labels: series.labels,
          datasets: series.datasets,
        },
        options: applyCommonChartOptions(
          {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                labels: { padding: 15, font: { size: 12 } },
              },
              title: {
                display: false,
              },
              tooltip: {
                callbacks: {
                  label: function (context) {
                    let label = context.dataset.label || "";
                    if (label) {
                      label += ": ";
                    }
                    label += formatNumber(getParsedValue(context));
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
          graficasConfig,
          consolidatedType
        ),
      });
    } catch (err) {
      console.warn("?? Graficas: No se pudo renderizar ingreso nacional", err);
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
      clearCustomCharts();

      // Renderizar las gráficas de ingresos aunque no haya snapshot
      await renderIngresoPorCapituloChart(empresa.id, anio);
      await renderIngresoNacionalChart(empresa.id, anio);
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
    
    const graficasConfig = getGraficasConfig();
    const config = getRowsConfig(capitulo, graficasConfig);
    
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
    const etiqueta = config?.isCdmx
      ? "CDMX"
      : window.CapitulosModulos?.obtenerConfigEmpresa?.(empresa?.id)?.etiqueta ||
        empresa?.etiqueta ||
        "Capitulo";
    const resolveLabel = (label) =>
      (label || etiqueta).toString().replace(/\{capitulo\}/gi, etiqueta);

    config.operating.forEach(row => {
      const data = getRowData(snapshot.map, row.variants);
      datos.operativos.push({
        concepto: resolveLabel(row.label || row.alias || ""),
        realAcumulado: data.actualYTD,
        pptoAcumulado: data.planYTD,
        realAcumAA: data.prevYTD
      });
    });
    
    // Datos netos
    config.net.forEach(row => {
      const data = getRowData(snapshot.map, row.variants);
      datos.netos.push({
        concepto: resolveLabel(row.label || row.alias || ""),
        realAcumulado: data.actualYTD,
        pptoAcumulado: data.planYTD,
        realAcumAA: data.prevYTD
      });
    });
    
    // Datos consolidados (solo CDMX)
    if (config.isCdmx) {
      const consolidatedSources =
        graficasConfig.sources?.consolidated ||
        DEFAULT_GRAFICAS_CONFIG.sources?.consolidated ||
        {};
      const consolidatedOp = getRowData(
        snapshot.map,
        getConsolidatedVariants(
          consolidatedSources,
          "operating",
          DEFAULT_GRAFICAS_CONFIG.sources?.consolidated || {}
        )
      );
      const consolidatedNet = getRowData(
        snapshot.map,
        getConsolidatedVariants(
          consolidatedSources,
          "net",
          DEFAULT_GRAFICAS_CONFIG.sources?.consolidated || {}
        )
      );
      
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
