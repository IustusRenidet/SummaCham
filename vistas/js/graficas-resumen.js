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

  // Extrae la parte base64 de un Data URL (ExcelJS requiere solo base64)
  const extraerBase64DeDataUrl = (dataUrl) => {
    if (!dataUrl || typeof dataUrl !== "string") return dataUrl;
    const match = dataUrl.match(/^data:image\/[a-z]+;base64,(.+)$/i);
    return match ? match[1] : dataUrl;
  };
  const API_ENDPOINT = `${base}/api/reportes/resumen`;
  const API_ANIOS = `${base}/api/saldos/anios`;
  const DEFAULT_NATIVE_EXCEL_TIMEOUT_MS = 300000;
  const NATIVE_EXCEL_TIMEOUT_MS = (() => {
    try {
      const raw = localStorage.getItem("graficas_resumen_native_timeout_ms");
      const value = Number(raw);
      if (Number.isFinite(value) && value > 0) {
        return Math.max(5000, Math.min(300000, Math.round(value)));
      }
    } catch (_) {
      // ignore storage errors
    }
    return DEFAULT_NATIVE_EXCEL_TIMEOUT_MS;
  })();

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
  const operatingCard = document.getElementById("operatingCard");
  const netCard = document.getElementById("netCard");
  const customChartsRow = document.getElementById("customChartsRow");
  const charts = {};
  const customCharts = {};

  const fetchWithTimeout = async (
    url,
    options = {},
    timeoutMs = NATIVE_EXCEL_TIMEOUT_MS
  ) => {
    const timeout = Number(timeoutMs);
    if (!Number.isFinite(timeout) || timeout <= 0) {
      return fetch(url, options);
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeout);
    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal,
      });
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error(
          `Tiempo de espera agotado (${Math.round(timeout / 1000)}s).`
        );
      }
      throw error;
    } finally {
      window.clearTimeout(timer);
    }
  };

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

  const normalizeModuleKey = (value = "") => {
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

  const formatNumber = (n) =>
    new Intl.NumberFormat("es-MX", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);

  // 0 = proporción real (sin "inflar" barras pequeñas).
  const MIN_BAR_LENGTH = 0;
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

  const normalizeSourceType = (value, fallback = "snapshot") => {
    if (typeof value !== "string") return fallback;
    const clean = value.trim().toLowerCase();
    if (!clean) return fallback;
    if (clean === "snapshot" || clean === "mensual") return clean;
    if (clean === "custom") return "snapshot";
    return fallback;
  };

  const normalizeSeriesMode = (value, fallback = "columns") => {
    if (typeof value !== "string") return fallback;
    const clean = value.trim().toLowerCase();
    if (clean === "rows" || clean === "columns") return clean;
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
    } catch { }
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
          varMonthPlan: toNumber(fila?.totals?.varMonthPlan),
          varMonthPrev: toNumber(fila?.totals?.varMonthPrev),
          actualYTD: toNumber(fila?.totals?.actualYTD),
          planYTD: toNumber(fila?.totals?.planYTD),
          prevYTD: toNumber(fila?.totals?.prevYTD),
          varYTDPlan: toNumber(fila?.totals?.varYTDPlan),
          varYTDPrev: toNumber(fila?.totals?.varYTDPrev),
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
      varMonthPlan: 0,
      varMonthPrev: 0,
      actualYTD: 0,
      planYTD: 0,
      prevYTD: 0,
      varYTDPlan: 0,
      varYTDPrev: 0,
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

  const resumenMensualCache = new Map();

  const loadResumenMensual = async (empresaId, anio) => {
    if (!empresaId || !anio) return [];
    const key = `${empresaId || "sin"}:${anio || "sin"}`;
    const cached = resumenMensualCache.get(key);
    if (cached?.data) return cached.data;
    if (cached?.promise) return cached.promise;
    const meses = MONTH_LABELS.map((_, idx) => idx + 1);
    const promise = Promise.all(
      meses.map(async (mes) => {
        try {
          return await fetchResumenMes(empresaId, anio, mes);
        } catch (err) {
          console.warn("?? Graficas: Error cargando resumen mes", mes, err);
          return null;
        }
      })
    ).then((data) => {
      resumenMensualCache.set(key, { data, at: Date.now() });
      return data;
    });
    resumenMensualCache.set(key, { promise });
    return promise;
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
    version: 5,
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
    manualOnly: true,
    deletedChartIds: [],
    customCharts: [
      {
        id: "manual-operating",
        module: "RESUMEN",
        title: "Resultado Operativo por Capitulo",
        subtitle: "Real Acum / Ppto. Acum / Real Acum AA",
        chartType: "inherit",
        sourceType: "snapshot",
        seriesMode: "columns",
        enabled: true,
        seriesKeys: ["actualYTD", "planYTD", "prevYTD"],
        rows: [
          {
            alias: "Ciudad de Mexico",
            variants: ["OPERATING RESULTS MEXICO"],
          },
          {
            alias: "Guadalajara",
            variants: ["OPERATING RESULTS GUADALAJARA", "GDL OPERATING RESULTS"],
          },
          {
            alias: "Monterrey",
            variants: ["OPERATING RESULTS MONTERREY", "MTY OPERATING RESULTS"],
          },
          {
            alias: "Noroeste",
            variants: [
              "OPERATING RESULTS NORTHWEST",
              "OPERATING RESULTS NO",
              "NO OPERATING RESULTS",
            ],
          },
          {
            alias: "{capitulo}",
            variants: ["OPERATING RESULTS", "RESULTADO OPERATIVO"],
          },
        ],
      },
      {
        id: "manual-net",
        module: "RESUMEN",
        title: "Resumen Neto por Capitulo",
        subtitle: "Real Acum / Ppto. Acum / Real Acum AA",
        chartType: "inherit",
        sourceType: "snapshot",
        seriesMode: "columns",
        enabled: true,
        seriesKeys: ["actualYTD", "planYTD", "prevYTD"],
        rows: [
          {
            alias: "Ciudad de Mexico",
            variants: ["NET RESULTS MEXICO"],
          },
          {
            alias: "Guadalajara",
            variants: ["NET RESULTS GUADALAJARA", "GDL NET RESULTS"],
          },
          {
            alias: "Monterrey",
            variants: ["NET RESULTS MONTERREY", "MTY NET RESULTS"],
          },
          {
            alias: "Noroeste",
            variants: [
              "NET RESULTS NORTHWEST",
              "NET RESULTS NO",
              "NO NET RESULTS",
            ],
          },
          {
            alias: "{capitulo}",
            variants: ["NET RESULTS", "RESULTADO NETO"],
          },
        ],
      },
      {
        id: "manual-consolidated",
        module: "RESUMEN",
        title: "Consolidados Operativos vs Netos",
        subtitle: "Real Acum / Ppto. Acum / Real Acum AA",
        chartType: "inherit",
        sourceType: "snapshot",
        seriesMode: "rows",
        enabled: true,
        cdmxOnly: true,
        seriesKeys: ["actualYTD", "planYTD", "prevYTD"],
        rows: [
          {
            alias: "CONSOLIDATED OPERATING RESULTS",
            variants: [
              "CONSOLIDATED OPERATING RESULTS",
              "CONSOLIDATED OPERATING RESULT",
            ],
          },
          {
            alias: "CONSOLIDATED NET RESULTS",
            variants: ["CONSOLIDATED NET RESULTS", "CONSOLIDATED NET RESULT"],
          },
        ],
      },
      {
        id: "manual-ingreso-capitulo",
        module: "RESUMEN",
        title: "Ingreso por capitulo",
        subtitle: "Real acumulado por mes",
        chartType: "inherit",
        sourceType: "mensual",
        seriesMode: "rows",
        enabled: true,
        seriesKeys: ["actualYTD"],
        rows: [
          {
            alias: "CDMX",
            variants: [
              "CDMX INCOME",
              "MEXICO INCOME",
              "CIUDAD DE MEXICO INCOME",
            ],
          },
          {
            alias: "Guadalajara",
            variants: ["GUADALAJARA INCOME", "GDL INCOME", "GUADALAJARA INCOMEA"],
          },
          {
            alias: "Monterrey",
            variants: ["MONTERREY INCOME", "MTY INCOME"],
          },
          {
            alias: "Noroeste",
            variants: [
              "NORTHWEST INCOME",
              "NW INCOME",
              "NOROESTE INCOME",
              "NO INCOME",
            ],
          },
        ],
      },
      {
        id: "manual-ingreso-nacional",
        module: "RESUMEN",
        title: "Ingreso nacional",
        subtitle: "Real acumulado por mes",
        chartType: "inherit",
        sourceType: "mensual",
        seriesMode: "rows",
        enabled: true,
        cdmxOnly: true,
        seriesKeys: ["actualYTD"],
        rows: [
          {
            alias: "Committees",
            variants: ["COMMITTEES", "COMITES", "COMMITTEES (INCOME)"],
          },
          {
            alias: "Membership",
            variants: ["MEMBERSHIP", "MEMBERSHIP (INCOME)"],
          },
          {
            alias: "Events",
            variants: ["EVENTS", "EVENTS (INCOME)"],
          },
          {
            alias: "Services to Members",
            variants: [
              "SERVICES TO MEMBERS",
              "SERVICES MEMBERS",
              "SERVICES TO MEMBERS (INCOME)",
            ],
          },
          {
            alias: "T&IC",
            variants: ["T&IC", "T&IC (INCOME)", "T&IC INCOME"],
          },
        ],
      },
    ],
  };

  const clone = (value) => JSON.parse(JSON.stringify(value));
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

  const mergeDefaultCustomCharts = (charts = [], deletedIds = []) => {
    const deletedSet = new Set(normalizeDeletedChartIds(deletedIds));
    const merged = new Map();
    (Array.isArray(DEFAULT_GRAFICAS_CONFIG.customCharts)
      ? DEFAULT_GRAFICAS_CONFIG.customCharts
      : []
    ).forEach((chart) => {
      if (!chart?.id) return;
      const key = canonicalizeChartId(chart.id);
      if (!key || deletedSet.has(key)) return;
      merged.set(key, clone(chart));
    });
    (Array.isArray(charts) ? charts : []).forEach((chart) => {
      if (!chart?.id) return;
      const key = canonicalizeChartId(chart.id);
      if (!key || deletedSet.has(key)) return;
      merged.set(key, chart);
    });
    return Array.from(merged.values());
  };
  const ALLOWED_SERIES_KEYS = new Set(["actualYTD", "planYTD", "prevYTD"]);
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

  const normalizeCustomCharts = (charts = []) => {
    if (!Array.isArray(charts)) return [];
    return charts.map((chart, index) => {
      const id = chart?.id ? String(chart.id) : `custom-${index + 1}`;
      const module =
        typeof chart?.module === "string" && chart.module.trim()
          ? chart.module.trim()
          : "RESUMEN";
      const title =
        typeof chart?.title === "string" && chart.title.trim()
          ? chart.title.trim()
          : `Grafica ${index + 1}`;
      const subtitle =
        typeof chart?.subtitle === "string" ? chart.subtitle.trim() : "";
      const chartType = normalizeChartType(chart?.chartType, "inherit");
      const enabled = typeof chart?.enabled === "boolean" ? chart.enabled : true;
      const seriesMode = normalizeSeriesMode(chart?.seriesMode, "columns");
      const cdmxOnly = chart?.cdmxOnly === true;
      const rows = Array.isArray(chart?.rows) ? chart.rows : [];
      const normalizedRows = rows
        .map((row) => {
          const variants = Array.isArray(row?.variants)
            ? row.variants
            : Array.isArray(row?.labels)
              ? row.labels
              : [];
          const cleaned = variants
            .map((v) => (typeof v === "string" ? v.trim() : ""))
            .filter(Boolean);
          if (!cleaned.length) return null;
          const alias =
            typeof row?.alias === "string" && row.alias.trim()
              ? row.alias.trim()
              : cleaned[0];
          const color =
            typeof row?.color === "string" && row.color.trim()
              ? row.color.trim()
              : null;
          const normalized = { alias, variants: cleaned };
          if (color) normalized.color = color;
          return normalized;
        })
        .filter(Boolean);
      const seriesKeys = Array.isArray(chart?.seriesKeys)
        ? chart.seriesKeys
          .map((key) => (key != null ? String(key).trim() : ""))
          .filter(Boolean)
        : [];
      const series = Array.isArray(chart?.series)
        ? chart.series
          .map((serie) => {
            const key = serie?.key != null ? String(serie.key).trim() : "";
            if (!key) return null;
            const label =
              typeof serie?.label === "string" && serie.label.trim()
                ? serie.label.trim()
                : key;
            const color =
              typeof serie?.color === "string" && serie.color.trim()
                ? serie.color.trim()
                : "#0d47a1";
            const enabled =
              typeof serie?.enabled === "boolean" ? serie.enabled : true;
            return { key, label, color, enabled };
          })
          .filter(Boolean)
        : [];
      const mergedSeriesKeys = Array.from(
        new Set([
          ...seriesKeys,
          ...series.map((serie) => serie.key).filter(Boolean),
        ])
      );
      const sourceType = normalizeSourceType(chart?.sourceType, "snapshot");
      return {
        id,
        module,
        title,
        subtitle,
        chartType,
        enabled,
        seriesMode,
        cdmxOnly,
        sourceType,
        seriesKeys: mergedSeriesKeys,
        series,
        rows: normalizedRows,
      };
    });
  };

  const hasEnabledManualCharts = (charts = []) =>
    Array.isArray(charts) &&
    charts.some(
      (chart) =>
        chart?.enabled !== false &&
        Array.isArray(chart?.rows) &&
        chart.rows.length > 0
    );

  const isManualOnlyEnabled = (config) => config?.manualOnly === true;

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

    base.manualOnly = true;
    base.deletedChartIds = normalizeDeletedChartIds(config.deletedChartIds);

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
        ["bar", "line", "pie", "doughnut"].includes(config.chart.type)
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

    const incomingVersion = Number(config.version);
    const resetToManualFlow =
      !Number.isFinite(incomingVersion) ||
      incomingVersion < DEFAULT_GRAFICAS_CONFIG.version;

    const normalizedCustomCharts = Array.isArray(config.customCharts)
      ? normalizeCustomCharts(config.customCharts)
      : [];

    const deletedSet = new Set(base.deletedChartIds || []);
    const filteredCustomCharts = normalizedCustomCharts.filter((chart) => {
      const key = canonicalizeChartId(chart?.id);
      if (!key) return true;
      return !deletedSet.has(key);
    });

    if (resetToManualFlow || normalizedCustomCharts.length === 0) {
      base.customCharts = mergeDefaultCustomCharts(
        filteredCustomCharts,
        base.deletedChartIds
      );
    } else {
      base.customCharts = filteredCustomCharts;
    }

    if (!hasEnabledManualCharts(base.customCharts)) {
      base.customCharts = mergeDefaultCustomCharts([], base.deletedChartIds);
    }

    if (deletedSet.has("summary-operating")) {
      base.charts.operating.enabled = false;
    }
    if (deletedSet.has("summary-net")) {
      base.charts.net.enabled = false;
    }
    if (deletedSet.has("summary-consolidated")) {
      base.charts.consolidated.enabled = false;
    }
    if (deletedSet.has("ingreso-capitulo")) {
      base.ingreso.enabled = false;
    }
    if (deletedSet.has("ingreso-nacional")) {
      base.ingresoNacional.enabled = false;
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

  const getCustomColumnDefs = (config) => {
    const overrideMap = new Map(
      (Array.isArray(config?.series) ? config.series : [])
        .map((serie) => {
          const key = String(serie?.key || "").trim();
          if (!key) return null;
          return [key, serie];
        })
        .filter(Boolean)
    );
    return SUMMARY_TABLE_SERIES.map((base) => {
      const override = overrideMap.get(base.key) || {};
      return {
        key: base.key,
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

  const filterSeriesByKeys = (seriesList = [], keys = []) => {
    if (!Array.isArray(keys) || keys.length === 0) return seriesList;
    const keySet = new Set(
      keys.map((key) => (key != null ? String(key).trim() : "")).filter(Boolean)
    );
    if (!keySet.size) return seriesList;
    const filtered = (seriesList || []).filter((serie) => keySet.has(serie?.key));
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
          return [key, item];
        })
        .filter(Boolean)
    );
    return (seriesList || []).map((serie) => {
      const override = overrideMap.get(serie?.key);
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

  const hideAutoCharts = () => {
    if (operatingCard) operatingCard.style.display = "none";
    if (netCard) netCard.style.display = "none";
    if (consolidatedCard) consolidatedCard.style.display = "none";
    if (ingresoPorCapituloCard) ingresoPorCapituloCard.style.display = "none";
    if (ingresoNacionalCard) ingresoNacionalCard.style.display = "none";
    [
      "chartOperatingSummaryByChapter",
      "chartNetSummaryByChapter",
      "chartConsolidatedResults",
      "chartIngresoPorCapitulo",
      "chartIngresoNacional",
    ].forEach((id) => clearChart(id));
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
    normalizeModuleKey(chart?.module || "RESUMEN");

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
      varMonthPlan: 0,
      varMonthPrev: 0,
      actualYTD: 0,
      planYTD: 0,
      prevYTD: 0,
      varYTDPlan: 0,
      varYTDPrev: 0,
    };
  };

  const resolveChartLabel = (value, context = {}) => {
    const base =
      context?.etiqueta ||
      context?.capitulo ||
      "Capitulo";
    return String(value || "").replace(/\{capitulo\}/gi, base);
  };

  const findSnapshotMatch = (snapshotMap, variants = []) => {
    if (!snapshotMap) return null;
    const list = Array.isArray(variants) ? variants : [variants];
    for (const variant of list) {
      const normalized = normalizarLabel(variant);
      if (!normalized) continue;
      const exact = snapshotMap.get(normalized);
      if (exact) return { data: exact, matchKey: normalized };
      for (const [key, value] of snapshotMap.entries()) {
        if (key.includes(normalized)) return { data: value, matchKey: key };
      }
    }
    return null;
  };

  const buildCustomChartData = (
    rows,
    snapshotMap,
    columnDefs,
    chartType,
    seriesMode = "columns",
    context = {}
  ) => {
    if (!Array.isArray(rows) || !rows.length) return null;
    const usedMatches = new Set();
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
        const match = findSnapshotMatch(snapshotMap, variants);
        if (!match?.data) return null;
        if (match.matchKey && usedMatches.has(match.matchKey)) return null;
        if (match.matchKey) usedMatches.add(match.matchKey);
        return {
          label: resolveChartLabel(row?.alias || variants[0], context),
          data: match.data,
          color: row?.color,
        };
      })
      .filter(Boolean);

    if (!resolvedRows.length) return null;

    const isPie = isPieType(chartType);
    const useRowsAsSeries = seriesMode === "rows";

    if (useRowsAsSeries) {
      const labels = columnDefs.map((col) => col.label || col.key);
      const datasets = resolvedRows.map((row, idx) => {
        const rawValues = columnDefs.map((col) =>
          resolveSummarySeriesValue(row.data || {}, col.key)
        );
        const data = isPie ? rawValues : rawValues.map((value) => ocultarCeros(value));
        const color =
          row?.color || CHART_PALETTE[idx % CHART_PALETTE.length];
        const dataset = {
          label: row.label || `Serie ${idx + 1}`,
          data,
          borderWidth: chartType === "line" ? 2 : 1,
        };
        if (isPie) {
          dataset.backgroundColor = buildSlicePalette(data.length, color);
          dataset.borderColor = "#ffffff";
          dataset.borderWidth = 1;
          return dataset;
        }
        dataset.backgroundColor = color;
        dataset.borderColor = color;
        if (chartType === "line") {
          dataset.fill = false;
          dataset.tension = 0.32;
          dataset.pointRadius = POINT_RADIUS;
          dataset.pointHoverRadius = POINT_HOVER_RADIUS;
          dataset.pointBackgroundColor = color;
        } else {
          dataset.minBarLength = MIN_BAR_LENGTH;
        }
        return dataset;
      });

      return { labels, datasets };
    }

    const labels = resolvedRows.map((row) => row.label || "-");
    const datasets = columnDefs.map((col) => {
      const rawValues = resolvedRows.map((row) =>
        resolveSummarySeriesValue(row.data || {}, col.key)
      );
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

  const buildCustomMensualChartData = (
    rows,
    responses,
    columnDefs,
    chartType,
    seriesMode = "columns",
    context = {}
  ) => {
    if (!Array.isArray(rows) || !rows.length) return null;
    if (!Array.isArray(responses) || !responses.length) return null;
    if (!Array.isArray(columnDefs) || !columnDefs.length) return null;

    const useRowsAsSeries = seriesMode === "rows";
    if (useRowsAsSeries) {
      const valueKey = columnDefs[0]?.key || "actualYTD";
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
            label: resolveChartLabel(row?.alias || variants[0], context),
            variants,
            color: row?.color,
          };
        })
        .filter(Boolean);
      if (!resolvedRows.length) return null;

      const valuesByRow = resolvedRows.map(() =>
        Array.from({ length: MONTH_LABELS.length }, () => 0)
      );

      responses.forEach((data, idx) => {
        const layout = data?.resumen?.[0]?.layout || [];
        if (!Array.isArray(layout) || !layout.length) return;
        resolvedRows.forEach((row, rowIdx) => {
          const match = obtenerFilaIngreso(layout, row.variants);
          if (!match?.totals) return;
          valuesByRow[rowIdx][idx] += resolveSummarySeriesValue(
            match.totals || {},
            valueKey
          );
        });
      });

      const hasData = valuesByRow.some((serie) =>
        (serie || []).some((value) => Number(value) !== 0 && value !== null)
      );
      if (!hasData) return null;

      const datasets = resolvedRows.map((row, idx) => {
        const data = valuesByRow[idx] || [];
        const color =
          row?.color || CHART_PALETTE[idx % CHART_PALETTE.length];
        const dataset = {
          label: row.label || `Serie ${idx + 1}`,
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
          dataset.tension = 0.32;
          dataset.pointRadius = POINT_RADIUS;
          dataset.pointHoverRadius = POINT_HOVER_RADIUS;
          dataset.pointBackgroundColor = color;
        } else {
          dataset.minBarLength = MIN_BAR_LENGTH;
        }
        return dataset;
      });

      return { labels: MONTH_LABELS, datasets };
    }

    const seriesData = columnDefs.reduce((acc, col) => {
      acc[col.key] = Array.from({ length: MONTH_LABELS.length }, () => 0);
      return acc;
    }, {});

    responses.forEach((data, idx) => {
      const layout = data?.resumen?.[0]?.layout || [];
      if (!Array.isArray(layout) || !layout.length) return;
      rows.forEach((row) => {
        const variants =
          Array.isArray(row?.variants) && row.variants.length
            ? row.variants
            : row?.label
              ? [row.label]
              : row?.alias
                ? [row.alias]
                : [];
        if (!variants.length) return;
        const match = obtenerFilaIngreso(layout, variants);
        if (!match?.totals) return;
        columnDefs.forEach((col) => {
          seriesData[col.key][idx] += resolveSummarySeriesValue(
            match.totals || {},
            col.key
          );
        });
      });
    });

    const isPie = isPieType(chartType);
    const datasets = columnDefs.map((col) => {
      const rawValues = seriesData[col.key] || [];
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

    const hasData = datasets.some((dataset) =>
      (dataset.data || []).some((value) => Number(value) !== 0 && value !== null)
    );
    if (!hasData) return null;

    return { labels: MONTH_LABELS, datasets };
  };

  let _renderCustomChartsGen = 0;

  const renderCustomCharts = (snapshotMap, config, context = {}) => {
    clearCustomCharts();
    if (!customChartsRow) return;
    const myGen = ++_renderCustomChartsGen;
    const isStale = () => _renderCustomChartsGen !== myGen;
    const customChartsList = Array.isArray(config.customCharts)
      ? config.customCharts
      : [];
    if (!customChartsList.length) return;

    const currentModule = normalizeModuleKey(
      document.body?.dataset?.modulo || "RESUMEN"
    );
    const baseColumnDefs = getCustomColumnDefs(config);
    if (!baseColumnDefs.length) return;

    const baseChartType = config.chart?.type || "bar";
    const empresaId =
      context.empresaId || window.Sesion?.obtenerEmpresaActiva?.()?.id;
    const resolvedCapitulo =
      context.capitulo ||
      window.CapitulosModulos?.obtenerCapituloPorEmpresa?.(empresaId) ||
      "";
    const etiqueta =
      context.etiqueta ||
      window.CapitulosModulos?.obtenerConfigEmpresa?.(empresaId)?.etiqueta ||
      resolvedCapitulo ||
      "Capitulo";
    const rowsConfig = resolvedCapitulo
      ? getRowsConfig(resolvedCapitulo, config)
      : null;
    const isCdmx =
      typeof context.isCdmx === "boolean"
        ? context.isCdmx
        : Boolean(rowsConfig?.isCdmx);
    const labelContext = {
      ...context,
      capitulo: resolvedCapitulo,
      etiqueta,
      isCdmx,
    };
    const anio =
      context.anio ||
      (Number.isFinite(Number(yearSelect?.value)) ? Number(yearSelect?.value) : null);

    const needsMensual = customChartsList.some(
      (chart) =>
        chart?.enabled !== false &&
        getCustomModuleKey(chart) === currentModule &&
        (chart?.sourceType || "").toString().toLowerCase() === "mensual"
    );
    const mensualPromise =
      needsMensual && empresaId && anio
        ? loadResumenMensual(empresaId, anio)
        : null;

    const renderEmpty = (emptyEl, canvasEl, message) => {
      if (emptyEl) {
        emptyEl.textContent = message || "Sin datos.";
        emptyEl.style.display = "flex";
      }
      if (canvasEl) {
        canvasEl.style.display = "none";
      }
    };

    const renderChart = (canvasEl, emptyEl, data, chartType) => {
      if (!canvasEl || !data) return;
      if (emptyEl) emptyEl.style.display = "none";
      canvasEl.style.display = "block";
      const isBarChart = chartType === "bar";
      const dataLabelsPlugin = isBarChart && window.ChartDataLabels ? window.ChartDataLabels : null;
      const chartCfg = {
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
              ...(dataLabelsPlugin ? {
                datalabels: {
                  display: function (ctx) {
                    const val = ctx.dataset.data[ctx.dataIndex];
                    return val !== null && val !== undefined && val !== 0;
                  },
                  anchor: "end",
                  align: "end",
                  formatter: function (value) { return formatNumber(value); },
                  font: { size: 9 },
                  color: "#444",
                },
              } : {}),
            },
            scales: {
              y: {
                beginAtZero: chartType === "bar",
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
      };
      if (dataLabelsPlugin) {
        chartCfg.plugins = [dataLabelsPlugin];
      }
      customCharts[canvasEl.id] = new Chart(canvasEl, chartCfg);
    };

    customChartsList.forEach((chart, index) => {
      if (chart?.enabled === false) return;
      if (getCustomModuleKey(chart) !== currentModule) return;
      if (chart?.cdmxOnly === true && !labelContext.isCdmx) return;
      const rows = Array.isArray(chart?.rows) ? chart.rows : [];
      if (!rows.length) return;

      const chartType =
        chart?.chartType && chart.chartType !== "inherit"
          ? chart.chartType
          : baseChartType;
      const sourceType = (chart?.sourceType || "snapshot")
        .toString()
        .toLowerCase();
      const seriesMode = normalizeSeriesMode(
        chart?.seriesMode,
        sourceType === "mensual" ? "rows" : "columns"
      );
      const columnDefs = applyCustomSeriesOverrides(
        filterSeriesByKeys(baseColumnDefs, chart?.seriesKeys || []),
        chart
      );
      if (!columnDefs.length) return;

      const safeId = sanitizeChartId(chart.id) || `customChart-${index + 1}`;
      const canvasId = `customChart-${safeId}`;
      const chartTitle = chart.title || "Grafica personalizada";
      const chartSubtitle = chart.subtitle || "";

      // Only add chart to DOM after data is confirmed — prevents blank loading cards
      const appendAndRender = (data) => {
        if (isStale() || !data) return;
        const wrapper = document.createElement("div");
        wrapper.className = "col-12";
        wrapper.innerHTML = `
          <div class="card chart-card p-3" data-custom-chart="${canvasId}">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <h5 class="mb-0">${chartTitle}</h5>
              <small class="text-muted">${chartSubtitle}</small>
            </div>
            <div class="chart-container">
              <canvas id="${canvasId}"></canvas>
            </div>
          </div>
        `;
        customChartsRow.appendChild(wrapper);
        const canvas = wrapper.querySelector("canvas");
        if (!canvas) return;
        renderChart(canvas, null, data, chartType);
      };

      if (sourceType === "mensual") {
        if (!empresaId || !anio || !mensualPromise) return;
        mensualPromise
          .then((responses) => {
            if (isStale()) return;
            const data = buildCustomMensualChartData(
              rows,
              responses,
              columnDefs,
              chartType,
              seriesMode,
              labelContext
            );
            appendAndRender(data);
          })
          .catch((error) => {
            console.warn("?? Graficas: Error cargando grafica mensual", error);
          });
        return;
      }

      if (!snapshotMap) return;
      const data = buildCustomChartData(
        rows,
        snapshotMap,
        columnDefs,
        chartType,
        seriesMode,
        labelContext
      );
      appendAndRender(data);
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
  const renderAllCharts = (snapshotMap, capitulo, etiqueta, context = {}) => {
    if (!snapshotMap || snapshotMap.size === 0) {
      console.warn("📊 Graficas: No hay datos en el snapshot");
      return;
    }

    const graficasConfig = getGraficasConfig();
    const rowsConfig = getRowsConfig(capitulo, graficasConfig);
    const enrichedContext = {
      ...context,
      capitulo,
      etiqueta,
      isCdmx: Boolean(rowsConfig?.isCdmx),
    };
    if (isManualOnlyEnabled(graficasConfig)) {
      hideAutoCharts();
      renderCustomCharts(snapshotMap, graficasConfig, enrichedContext);
      return;
    }
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

    const config = rowsConfig;

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
                  label: function (context) {
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
                beginAtZero: consolidatedType === "bar",
                ticks: {
                  callback: function (value) {
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

    renderCustomCharts(snapshotMap, graficasConfig, enrichedContext);
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
                  beginAtZero: operatingType === "bar",
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
                  beginAtZero: netType === "bar",
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
                  beginAtZero: operatingType === "bar",
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
                  beginAtZero: netType === "bar",
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
    if (isManualOnlyEnabled(graficasConfig)) {
      return;
    }
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
                beginAtZero: chartType === "bar",
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
          chartType
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
    if (isManualOnlyEnabled(graficasConfig)) {
      return;
    }
    const ingresoConfig =
      graficasConfig.ingresoNacional || DEFAULT_GRAFICAS_CONFIG.ingresoNacional;
    const baseChartType = graficasConfig.chart?.type || "bar";
    const chartType = resolveChartType(ingresoConfig.chartType, baseChartType);
    if (ingresoConfig.enabled === false) {
      return;
    }
    const capitulo = window.CapitulosModulos?.obtenerCapituloPorEmpresa?.(
      empresaId
    );
    const rowsConfig = getRowsConfig(capitulo, graficasConfig);
    if (!rowsConfig?.isCdmx) {
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
                beginAtZero: chartType === "bar",
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
          chartType
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
      const graficasConfig = getGraficasConfig();
      if (isManualOnlyEnabled(graficasConfig)) {
        hideAutoCharts();
      }
      const rowsConfig = getRowsConfig(capitulo, graficasConfig);
      renderCustomCharts(null, graficasConfig, {
        empresaId: empresa.id,
        anio,
        capitulo,
        etiqueta: etiquetaFinal,
        isCdmx: Boolean(rowsConfig?.isCdmx),
      });

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
    renderAllCharts(snapshot.map, capitulo, etiquetaFinal, {
      empresaId: empresa.id,
      anio,
    });
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

  const resolveExportFlags = (graficasConfig, rowsConfig = {}) => {
    if (isManualOnlyEnabled(graficasConfig)) {
      return {
        operating: false,
        net: false,
        consolidated: false,
        ingreso: false,
        ingresoNacional: false,
      };
    }
    return {
      operating: graficasConfig?.charts?.operating?.enabled !== false,
      net: graficasConfig?.charts?.net?.enabled !== false,
      consolidated:
        rowsConfig?.isCdmx &&
        graficasConfig?.charts?.consolidated?.enabled !== false,
      ingreso: graficasConfig?.ingreso?.enabled !== false,
      ingresoNacional:
        rowsConfig?.isCdmx && graficasConfig?.ingresoNacional?.enabled !== false,
    };
  };

  const resolveCanvasTitle = (canvas, fallback = '') => {
    if (!canvas) return fallback || 'Grafica';
    const titleEl =
      canvas.closest('.chart-card')?.querySelector('h5') ||
      canvas.closest('.chart-card')?.querySelector('h6') ||
      canvas.closest('.chart-block')?.querySelector('.chart-title');
    const title = titleEl?.textContent?.trim();
    return title || fallback || 'Grafica';
  };

  const waitForCapture = (ms = 120) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  const isDataUrlImagenValida = (value) =>
    typeof value === 'string' &&
    /^data:image\/(png|jpe?g|webp);base64,/i.test(value.trim()) &&
    value.trim().length > 128;

  const toExportNumber = (value) => {
    if (value == null) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return null;
      const parsed = Number(trimmed.replace(/,/g, ''));
      return Number.isFinite(parsed) ? parsed : null;
    }
    if (typeof value === 'object') {
      const candidate = value?.y ?? value?.value ?? value?.v ?? value?.x ?? null;
      if (candidate == null) return null;
      const parsed = Number(candidate);
      return Number.isFinite(parsed) ? parsed : null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const hasExportableSeriesData = (data) => {
    if (!data || !Array.isArray(data.labels) || !data.labels.length) return false;
    const datasets = Array.isArray(data.datasets) ? data.datasets : [];
    if (!datasets.length) return false;
    let hasNumeric = false;
    let hasUseful = false;
    datasets.forEach((dataset) => {
      const values = Array.isArray(dataset?.data) ? dataset.data : [];
      values.forEach((raw) => {
        const value = toExportNumber(raw);
        if (!Number.isFinite(value)) return;
        hasNumeric = true;
        if (Math.abs(value) > 0.000001) {
          hasUseful = true;
        }
      });
    });
    return hasNumeric && hasUseful;
  };

  const chartHasExportableData = (chart) => {
    if (!chart?.data) return false;
    return hasExportableSeriesData(chart.data);
  };

  const buildFallbackSeriesFromRows = (rows = []) => {
    if (!Array.isArray(rows) || !rows.length) return null;
    const normalized = rows
      .map((row) => ({
        label: String(row?.concepto || '').trim(),
        real: toNumber(row?.realAcumulado),
        plan: toNumber(row?.pptoAcumulado),
        prev: toNumber(row?.realAcumAA),
      }))
      .filter((row) => row.label);
    if (!normalized.length) return null;
    const payload = {
      labels: normalized.map((row) => row.label),
      datasets: [
        {
          label: 'Ppto. Acumulado',
          data: normalized.map((row) => row.plan),
          backgroundColor: '#4472c4',
          borderColor: '#4472c4',
          borderWidth: 1,
        },
        {
          label: 'Real Acumulado',
          data: normalized.map((row) => row.real),
          backgroundColor: '#ffc000',
          borderColor: '#ffc000',
          borderWidth: 1,
        },
        {
          label: 'Real Acum. Año Anterior',
          data: normalized.map((row) => row.prev),
          backgroundColor: '#94a3b8',
          borderColor: '#94a3b8',
          borderWidth: 1,
        },
      ],
    };
    return hasExportableSeriesData(payload) ? payload : null;
  };

  const renderFallbackChartDataUrl = async (data, chartType = 'bar') => {
    if (!hasExportableSeriesData(data)) return null;
    if (typeof Chart === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 1600;
    canvas.height = 900;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    let chart = null;
    try {
      const isPie = chartType === 'pie' || chartType === 'doughnut';
      chart = new Chart(ctx, {
        type: isPie ? chartType : 'bar',
        data,
        options: {
          responsive: false,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: true, position: 'bottom' },
            title: { display: false },
          },
          scales: isPie
            ? {}
            : {
              y: {
                beginAtZero: true,
                ticks: {
                  callback: (value) => formatNumber(value),
                },
              },
              x: {
                ticks: {
                  autoSkip: false,
                  maxRotation: 50,
                  minRotation: 0,
                },
              },
            },
        },
      });
      await waitForCapture(180);
      const dataUrl = canvas.toDataURL('image/png');
      return isDataUrlImagenValida(dataUrl) ? dataUrl : null;
    } catch (error) {
      console.warn('No fue posible renderizar grafica fallback para exportacion:', error);
      return null;
    } finally {
      if (chart) chart.destroy();
    }
  };

  const getChartByCanvas = (canvas) => {
    if (!canvas || typeof window.Chart === 'undefined') return null;
    if (typeof window.Chart.getChart === 'function') {
      return window.Chart.getChart(canvas) || null;
    }
    return null;
  };

  const capturarCanvasComoImagen = async (canvas) => {
    if (!canvas || typeof canvas.toDataURL !== 'function') return null;
    const chart = getChartByCanvas(canvas);
    let dataUrl = '';

    try {
      if (chart?.resize) chart.resize();
      if (chart?.update) chart.update('none');
      await waitForCapture(120);
      dataUrl =
        typeof chart?.toBase64Image === 'function'
          ? chart.toBase64Image()
          : canvas.toDataURL('image/png');
      if (isDataUrlImagenValida(dataUrl)) {
        return dataUrl;
      }
    } catch (error) {
      console.warn('No fue posible capturar grafica desde canvas:', error);
    }

    if (typeof html2canvas === 'function') {
      try {
        const rendered = await html2canvas(canvas, {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true,
          logging: false,
        });
        dataUrl = rendered?.toDataURL?.('image/png') || '';
        if (isDataUrlImagenValida(dataUrl)) {
          return dataUrl;
        }
      } catch (error) {
        console.warn('No fue posible capturar grafica con html2canvas:', error);
      }
    }

    return null;
  };

  const agregarCanvasComoImagenExcel = async ({
    workbook,
    worksheet,
    canvas,
    row,
    col = 0,
    width = 800,
    height = 400,
    titulo = 'Grafica',
    resolveFallbackDataUrl = null,
  }) => {
    if (!workbook || !worksheet) return false;
    const chart = getChartByCanvas(canvas);
    let dataUrl = null;
    if (chartHasExportableData(chart)) {
      dataUrl = await capturarCanvasComoImagen(canvas);
    }
    if (!isDataUrlImagenValida(dataUrl) && typeof resolveFallbackDataUrl === 'function') {
      try {
        dataUrl = await resolveFallbackDataUrl();
      } catch (error) {
        console.warn(`No se pudo construir fallback de grafica para Excel: ${titulo}`, error);
      }
    }
    if (!isDataUrlImagenValida(dataUrl)) {
      console.warn(`No se pudo capturar la grafica para Excel: ${titulo}`);
      return false;
    }
    const match = dataUrl.match(/^data:image\/(png|jpe?g|webp);base64,/i);
    const rawExt = (match?.[1] || 'png').toLowerCase();
    const extension = rawExt === 'jpg' ? 'jpeg' : rawExt;

    let imageId = null;
    try {
      imageId = workbook.addImage({
        base64: dataUrl,
        extension,
      });
    } catch (firstError) {
      try {
        imageId = workbook.addImage({
          base64: extraerBase64DeDataUrl(dataUrl),
          extension,
        });
      } catch (secondError) {
        console.warn(
          `No se pudo registrar imagen para Excel: ${titulo}`,
          secondError || firstError
        );
        return false;
      }
    }
    worksheet.addImage(imageId, {
      tl: { col, row },
      ext: { width, height },
    });
    return true;
  };

  const getCustomChartsForExport = () => {
    if (!customChartsRow) return [];
    return Array.from(customChartsRow.querySelectorAll('canvas'))
      .map((canvas) => {
        const chart = customCharts?.[canvas.id] || getChartByCanvas(canvas);
        if (!chartHasExportableData(chart)) return null;
        return {
          canvas,
          chart,
          title: resolveCanvasTitle(canvas, 'Grafica personalizada'),
        };
      })
      .filter(Boolean);
  };

  const buildChartTable = (chart) => {
    const labels = Array.isArray(chart?.data?.labels) ? chart.data.labels : [];
    const datasets = Array.isArray(chart?.data?.datasets)
      ? chart.data.datasets
      : [];
    if (!labels.length || !datasets.length) return null;
    const header = [
      'Categoria',
      ...datasets.map((dataset, idx) => dataset?.label || `Serie ${idx + 1}`),
    ];
    const rows = labels.map((label, idx) => [
      label,
      ...datasets.map((dataset) => dataset?.data?.[idx] ?? null),
    ]);
    return { header, rows };
  };

  const buildCustomChartsForExport = async ({
    graficasConfig,
    empresaId,
    anio,
    snapshotMap,
  }) => {
    const customChartsList = Array.isArray(graficasConfig?.customCharts)
      ? graficasConfig.customCharts
      : [];
    if (!customChartsList.length) return [];

    const currentModule = normalizeModuleKey(
      document.body?.dataset?.modulo || 'RESUMEN'
    );
    const baseColumnDefs = getCustomColumnDefs(graficasConfig);
    if (!baseColumnDefs.length) return [];

    const capitulo =
      window.CapitulosModulos?.obtenerCapituloPorEmpresa?.(empresaId) || "";
    const etiqueta =
      window.CapitulosModulos?.obtenerConfigEmpresa?.(empresaId)?.etiqueta ||
      capitulo ||
      "Capitulo";
    const rowsConfig = capitulo ? getRowsConfig(capitulo, graficasConfig) : null;
    const labelContext = {
      capitulo,
      etiqueta,
      isCdmx: Boolean(rowsConfig?.isCdmx),
    };

    const baseChartType = graficasConfig?.chart?.type || 'bar';
    let mensualResponses = null;
    const out = [];

    for (let index = 0; index < customChartsList.length; index += 1) {
      const chartCfg = customChartsList[index];
      if (chartCfg?.enabled === false) continue;
      if (getCustomModuleKey(chartCfg) !== currentModule) continue;
      if (chartCfg?.cdmxOnly === true && !labelContext.isCdmx) continue;

      const rows = Array.isArray(chartCfg?.rows) ? chartCfg.rows : [];
      if (!rows.length) continue;

      const columnDefs = applyCustomSeriesOverrides(
        filterSeriesByKeys(baseColumnDefs, chartCfg?.seriesKeys || []),
        chartCfg
      );
      if (!columnDefs.length) continue;

      const chartType =
        chartCfg?.chartType && chartCfg.chartType !== 'inherit'
          ? chartCfg.chartType
          : baseChartType;
      const seriesMode = normalizeSeriesMode(chartCfg?.seriesMode, "columns");
      const sourceType = (chartCfg?.sourceType || 'snapshot').toString().toLowerCase();

      let data = null;
      if (sourceType === 'mensual') {
        if (!empresaId || !anio) continue;
        if (!mensualResponses) {
          mensualResponses = await loadResumenMensual(empresaId, anio);
        }
        data = buildCustomMensualChartData(
          rows,
          mensualResponses,
          columnDefs,
          chartType,
          seriesMode,
          labelContext
        );
      } else {
        data = buildCustomChartData(
          rows,
          snapshotMap,
          columnDefs,
          chartType,
          seriesMode,
          labelContext
        );
      }

      if (!hasExportableSeriesData(data)) continue;

      const safeId = sanitizeChartId(chartCfg?.id) || `customChart-${index + 1}`;
      const canvasId = `customChart-${safeId}`;
      const canvas = document.getElementById(canvasId);
      out.push({
        id: safeId,
        title: chartCfg?.title || `Grafica personalizada ${index + 1}`,
        chartType,
        data,
        canvas,
      });
    }

    return out;
  };

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
    const flags = resolveExportFlags(graficasConfig, config);

    // Preparar datos para exportación
    const datos = {
      empresa: empresa?.nombre || empresa?.id,
      empresaId: empresa?.id || null,
      capitulo: capitulo,
      anio: anio,
      mes: mes,
      fecha: new Date().toLocaleString('es-MX'),
      snapshotMap: snapshot.map,
      operativos: [],
      netos: [],
      consolidados: flags.consolidated ? [] : null,
      flags,
      graficasConfig
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
    if (flags.consolidated) {
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
   * Exporta los datos a Excel (gráficas manuales)
   */
  window.exportarGraficasExcel = async () => {
    const datos = obtenerDatosParaExportar();
    if (!datos) return;

    const flags = datos.flags || {};
    const customChartItems = getCustomChartsForExport();

    // Solo exportación nativa (sin imágenes)
    if (typeof ExcelJS === 'undefined') {
      alert('ExcelJS no está disponible. La exportación nativa requiere esta librería.');
      return;
    }

    try {
      const tryExportNative = async (charts = []) => {
        if (!Array.isArray(charts) || !charts.length) return false;

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'SummaCham';
        workbook.created = new Date();

        const chartsSheetName = 'Gráficas';
        const dataSheetName = 'GraficasData';

        workbook.addWorksheet(chartsSheetName);
        const wsData = workbook.addWorksheet(dataSheetName);

        let rowCursor = 1;
        charts.forEach((chartDef, idx) => {
          const data = chartDef?.data || chartDef || {};
          const labels = Array.isArray(data.labels) ? data.labels : [];
          const datasets = Array.isArray(data.datasets) ? data.datasets : [];
          if (!labels.length || !datasets.length) return;

          wsData.getCell(rowCursor, 1).value = 'CHART';
          wsData.getCell(rowCursor, 2).value =
            chartDef?.title || chartDef?.titulo || `Grafica ${idx + 1}`;
          rowCursor += 1;

          wsData.getCell(rowCursor, 1).value = 'Categoria';
          datasets.forEach((dataset, dIdx) => {
            wsData.getCell(rowCursor, dIdx + 2).value =
              dataset?.label || `Serie ${dIdx + 1}`;
          });
          rowCursor += 1;

          labels.forEach((label, lIdx) => {
            wsData.getCell(rowCursor, 1).value = label;
            datasets.forEach((dataset, dIdx) => {
              const rawValue = Array.isArray(dataset?.data)
                ? dataset.data[lIdx]
                : null;
              const numeric = toExportNumber(rawValue);
              wsData.getCell(rowCursor, dIdx + 2).value =
                typeof numeric === 'number' && Number.isFinite(numeric)
                  ? numeric
                  : 0;
            });
            rowCursor += 1;
          });

          rowCursor += 1;
        });

        if (rowCursor === 1) {
          return false;
        }

        const buffer = await workbook.xlsx.writeBuffer();
        const binaryBody =
          buffer instanceof ArrayBuffer
            ? buffer
            : buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

        const params = new URLSearchParams({
          nombreArchivo: 'GRAFICAS_RESUMEN',
          empresa: datos.empresa || '',
          mes: String(datos.mes || ''),
          anio: String(datos.anio || ''),
          dataSheetName,
          chartsSheetName,
          tableSheetName: '',
        });
        if (
          !window.ExportUtils ||
          typeof window.ExportUtils._crearTrabajoExportNativo !== "function"
        ) {
          throw new Error(
            "ExportUtils no está disponible para exportación en segundo plano."
          );
        }
        const job = await window.ExportUtils._crearTrabajoExportNativo({
          tipo: "resumen",
          params,
          binaryBody,
        });
        window.ExportUtils._registrarTrabajoPendiente({
          id: job?.id,
          tipo: "resumen",
          nombre: `Graficas_Resumen_${datos.anio}_${datos.mes}.xlsx`,
        });
        window.ExportUtils._iniciarVigilanciaTrabajosPendientes?.();
        return true;
      };

      const safeResolve = async (factory, label) => {
        try {
          return await factory();
        } catch (error) {
          console.warn(`No se pudo preparar ${label} para exportacion:`, error);
          return null;
        }
      };

      const toNativeChartData = (source) => {
        if (!source || typeof source !== 'object') return null;
        const labelsRaw = Array.isArray(source.labels) ? source.labels : [];
        const datasetsRaw = Array.isArray(source.datasets) ? source.datasets : [];
        if (!labelsRaw.length || !datasetsRaw.length) return null;

        const labels = labelsRaw.map((label) => String(label ?? '').trim());
        const datasets = datasetsRaw.map((dataset, datasetIdx) => {
          const values = Array.isArray(dataset?.data) ? dataset.data : [];
          return {
            label: dataset?.label || `Serie ${datasetIdx + 1}`,
            data: labels.map((_, labelIdx) => {
              const numeric = toExportNumber(values[labelIdx]);
              return Number.isFinite(numeric) ? numeric : 0;
            }),
          };
        });

        const normalized = { labels, datasets };
        return hasExportableSeriesData(normalized) ? normalized : null;
      };

      const chartsForNative = [];
      const addNativeChart = ({ title, canvas, fallbackData }) => {
        const chart = getChartByCanvas(canvas);
        let sourceData = null;
        if (chartHasExportableData(chart)) {
          sourceData = chart.data;
        } else if (hasExportableSeriesData(fallbackData)) {
          sourceData = fallbackData;
        }
        const normalizedData = toNativeChartData(sourceData);
        if (!normalizedData) return;
        chartsForNative.push({
          title: title || resolveCanvasTitle(canvas, 'Grafica'),
          data: normalizedData,
        });
      };

      const customChartDefs = await safeResolve(
        () =>
          buildCustomChartsForExport({
            graficasConfig: datos.graficasConfig,
            empresaId: datos.empresaId,
            anio: datos.anio,
            snapshotMap: datos.snapshotMap,
          }),
        'graficas personalizadas'
      );
      const ingresoFallbackSeries =
        flags.ingreso !== false
          ? await safeResolve(
            () => buildIngresoPorCapituloSeries(datos.empresaId, datos.anio),
            'ingreso por capitulo'
          )
          : null;
      const ingresoNacionalFallbackSeries =
        flags.ingresoNacional !== false
          ? await safeResolve(
            () => buildIngresoNacionalSeries(datos.empresaId, datos.anio),
            'ingreso nacional'
          )
          : null;

      if (flags.operating !== false) {
        addNativeChart({
          title: 'Resultado Operativo por Capitulo',
          canvas: document.getElementById('chartOperatingSummaryByChapter'),
          fallbackData: buildFallbackSeriesFromRows(datos.operativos),
        });
      }
      if (flags.net !== false) {
        addNativeChart({
          title: 'Resumen Neto por Capitulo',
          canvas: document.getElementById('chartNetSummaryByChapter'),
          fallbackData: buildFallbackSeriesFromRows(datos.netos),
        });
      }
      if (flags.consolidated && datos.consolidados) {
        addNativeChart({
          title: 'Consolidados Operativos vs Netos',
          canvas: document.getElementById('chartConsolidatedResults'),
          fallbackData: buildFallbackSeriesFromRows(datos.consolidados),
        });
      }
      if (flags.ingreso !== false) {
        addNativeChart({
          title: 'Ingreso por Capitulo',
          canvas: document.getElementById('chartIngresoPorCapitulo'),
          fallbackData: ingresoFallbackSeries,
        });
      }
      if (flags.ingresoNacional !== false) {
        addNativeChart({
          title: 'Ingreso nacional',
          canvas: document.getElementById('chartIngresoNacional'),
          fallbackData: ingresoNacionalFallbackSeries,
        });
      }

      const customCanvasIds = new Set();
      (customChartDefs || []).forEach((def, index) => {
        const canvasId = def?.canvas?.id || '';
        if (canvasId) customCanvasIds.add(canvasId);
        addNativeChart({
          title: def?.title || `Grafica personalizada ${index + 1}`,
          canvas: def?.canvas || null,
          fallbackData: def?.data || null,
        });
      });
      customChartItems.forEach((item, index) => {
        const canvasId = item?.canvas?.id || '';
        if (canvasId && customCanvasIds.has(canvasId)) return;
        addNativeChart({
          title: item?.title || `Grafica personalizada ${index + 1}`,
          canvas: item?.canvas || null,
          fallbackData: null,
        });
      });

      if (!chartsForNative.length) {
        alert('No hay gráficas con datos exportables.');
        return;
      }

      const exported = await tryExportNative(chartsForNative);
      if (!exported) {
        throw new Error('No se pudo preparar la estructura nativa de gráficas.');
      }

      console.log('✅ Excel nativo con gráficas exportado correctamente');
    } catch (error) {
      console.error('Error en exportación nativa de Excel:', error);
      alert(
        `Error al generar Excel con gráficas nativas: ${error?.message || 'desconocido'}.`
      );
    }
  };

  /**
   * Exportación legacy usando SheetJS (sin gráficas)
   */
  async function exportarGraficasExcelLegacy(datos) {
    const flags = datos.flags || {};
    const customChartItems = getCustomChartsForExport();
    const workbook = XLSX.utils.book_new();
    let sheetCount = 0;

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
    if (flags.operating !== false) {
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
      sheetCount += 1;
    }

    // Hoja 2: Resultados Netos
    if (flags.net !== false) {
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
      sheetCount += 1;
    }

    // Hoja 3: Consolidados
    if (flags.consolidated && datos.consolidados) {
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
      sheetCount += 1;
    }

    if (flags.ingreso !== false) {
      const ingresoCanvas = document.getElementById('chartIngresoPorCapitulo');
      const ingresoTable = buildChartTable(window.Chart?.getChart?.(ingresoCanvas));
      const wsIngreso = XLSX.utils.aoa_to_sheet([
        ...info,
        ['INGRESO POR CAPÍTULO'],
        ingresoTable?.header || []
      ]);
      if (ingresoTable?.rows?.length) {
        XLSX.utils.sheet_add_aoa(wsIngreso, ingresoTable.rows, { origin: -1 });
      }
      XLSX.utils.book_append_sheet(workbook, wsIngreso, 'Ingreso Capitulo');
      sheetCount += 1;
    }

    if (flags.ingresoNacional !== false) {
      const ingresoNacionalCanvas = document.getElementById('chartIngresoNacional');
      const ingresoNacionalTable = buildChartTable(
        window.Chart?.getChart?.(ingresoNacionalCanvas)
      );
      const wsIngresoNacional = XLSX.utils.aoa_to_sheet([
        ...info,
        ['INGRESO NACIONAL'],
        ingresoNacionalTable?.header || []
      ]);
      if (ingresoNacionalTable?.rows?.length) {
        XLSX.utils.sheet_add_aoa(wsIngresoNacional, ingresoNacionalTable.rows, {
          origin: -1,
        });
      }
      XLSX.utils.book_append_sheet(workbook, wsIngresoNacional, 'Ingreso Nacional');
      sheetCount += 1;
    }

    if (customChartItems.length) {
      customChartItems.forEach((item, index) => {
        const table = buildChartTable(item.chart);
        const sheetName = `Custom ${index + 1}`;
        const wsCustom = XLSX.utils.aoa_to_sheet([
          ...info,
          [item.title || `Grafica personalizada ${index + 1}`],
          table?.header || []
        ]);
        if (table?.rows?.length) {
          XLSX.utils.sheet_add_aoa(wsCustom, table.rows, { origin: -1 });
        }
        XLSX.utils.book_append_sheet(workbook, wsCustom, sheetName);
        sheetCount += 1;
      });
    }

    if (!sheetCount) {
      const wsEmpty = XLSX.utils.aoa_to_sheet([
        ...info,
        ['Sin gráficas disponibles para exportar.']
      ]);
      XLSX.utils.book_append_sheet(workbook, wsEmpty, 'Graficas');
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
    const flags = datos.flags || {};
    const customChartItems = getCustomChartsForExport();

    // Verificar que las librerías estén disponibles
    if (typeof jspdf === 'undefined') {
      alert('La librería jsPDF no está disponible.');
      return;
    }

    try {
      const safeResolve = async (factory, label) => {
        try {
          return await factory();
        } catch (error) {
          console.warn(`No se pudo preparar ${label} para PDF:`, error);
          return null;
        }
      };
      const customChartDefs = await safeResolve(
        () =>
          buildCustomChartsForExport({
            graficasConfig: datos.graficasConfig,
            empresaId: datos.empresaId,
            anio: datos.anio,
            snapshotMap: datos.snapshotMap,
          }),
        'graficas personalizadas'
      );
      const ingresoFallbackSeries =
        flags.ingreso !== false
          ? await safeResolve(
            () => buildIngresoPorCapituloSeries(datos.empresaId, datos.anio),
            'ingreso por capitulo'
          )
          : null;
      const ingresoNacionalFallbackSeries =
        flags.ingresoNacional !== false
          ? await safeResolve(
            () => buildIngresoNacionalSeries(datos.empresaId, datos.anio),
            'ingreso nacional'
          )
          : null;

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

      const tablas = [];
      if (flags.operating !== false) {
        tablas.push({
          titulo: 'RESULTADOS OPERATIVOS POR CAPÍTULO',
          datos: datos.operativos,
        });
      }
      if (flags.net !== false) {
        tablas.push({
          titulo: 'RESULTADOS NETOS POR CAPÍTULO',
          datos: datos.netos,
        });
      }
      if (flags.consolidated && datos.consolidados) {
        tablas.push({
          titulo: 'RESULTADOS CONSOLIDADOS',
          datos: datos.consolidados,
        });
      }

      if (tablas.length === 0) {
        pdf.setFontSize(11);
        pdf.setFont(undefined, 'normal');
        pdf.text('Sin tablas disponibles para exportar.', margin, yPosition);
        yPosition += 10;
      }

      // Agregar tablas
      if (tablas.length > 0) {
        yPosition = agregarTabla(tablas[0].titulo, tablas[0].datos, yPosition);
      }

      // Nueva página si es necesario
      if (yPosition > pageHeight - 60) {
        pdf.addPage();
        yPosition = margin;
      }

      if (tablas.length > 1) {
        yPosition = agregarTabla(tablas[1].titulo, tablas[1].datos, yPosition);
      }

      if (tablas.length > 2) {
        if (yPosition > pageHeight - 60) {
          pdf.addPage();
          yPosition = margin;
        }
        yPosition = agregarTabla(tablas[2].titulo, tablas[2].datos, yPosition);
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
        const graficas = [];
        if (flags.operating !== false) {
          const canvas = document.getElementById('chartOperatingSummaryByChapter');
          graficas.push({
            canvas,
            titulo: resolveCanvasTitle(canvas, 'Resultado Operativo por Capítulo'),
            fallbackRows: datos.operativos,
          });
        }
        if (flags.net !== false) {
          const canvas = document.getElementById('chartNetSummaryByChapter');
          graficas.push({
            canvas,
            titulo: resolveCanvasTitle(canvas, 'Resumen Neto por Capítulo'),
            fallbackRows: datos.netos,
          });
        }
        if (flags.ingreso !== false) {
          const canvas = document.getElementById('chartIngresoPorCapitulo');
          graficas.push({
            canvas,
            titulo: resolveCanvasTitle(canvas, 'Ingreso por Capítulo'),
            fallbackData: ingresoFallbackSeries,
            fallbackType: datos.graficasConfig?.ingreso?.chartType || 'bar',
          });
        }
        if (flags.ingresoNacional !== false) {
          const canvas = document.getElementById('chartIngresoNacional');
          graficas.push({
            canvas,
            titulo: resolveCanvasTitle(canvas, 'Ingreso nacional'),
            fallbackData: ingresoNacionalFallbackSeries,
            fallbackType: datos.graficasConfig?.ingresoNacional?.chartType || 'bar',
          });
        }
        if (flags.consolidated && datos.consolidados) {
          const canvas = document.getElementById('chartConsolidatedResults');
          graficas.push({
            canvas,
            titulo: resolveCanvasTitle(canvas, 'Consolidados Operativos vs Netos'),
            fallbackRows: datos.consolidados,
          });
        }
        const seenCanvasIds = new Set();
        (customChartDefs || []).forEach((def, index) => {
          if (def?.canvas?.id) {
            seenCanvasIds.add(def.canvas.id);
          }
          graficas.push({
            canvas: def?.canvas || null,
            titulo: def?.title || `Grafica personalizada ${index + 1}`,
            fallbackData: def?.data || null,
            fallbackType: def?.chartType || 'bar',
          });
        });
        customChartItems.forEach((item) => {
          if (!item?.canvas) return;
          if (item.canvas.id && seenCanvasIds.has(item.canvas.id)) return;
          graficas.push({
            canvas: item.canvas,
            titulo: item.title || 'Grafica personalizada',
          });
        });

        const graficasFiltradas = graficas.filter((grafica) => {
          const chart = getChartByCanvas(grafica?.canvas);
          if (chartHasExportableData(chart)) return true;
          if (hasExportableSeriesData(grafica?.fallbackData)) return true;
          if (Array.isArray(grafica?.fallbackRows)) {
            const fallbackData = buildFallbackSeriesFromRows(grafica.fallbackRows);
            if (hasExportableSeriesData(fallbackData)) return true;
          }
          return false;
        });

        if (!graficasFiltradas.length) {
          pdf.setFontSize(11);
          pdf.setFont(undefined, 'normal');
          pdf.text('Sin gráficas disponibles para exportar.', margin, yPosition);
          yPosition += 10;
          return;
        }

        for (const grafica of graficasFiltradas) {
          const canvas = grafica.canvas;
          try {
            let imgDataUrl = await capturarCanvasComoImagen(canvas);
            if (!isDataUrlImagenValida(imgDataUrl) && grafica?.fallbackData) {
              imgDataUrl = await renderFallbackChartDataUrl(
                grafica.fallbackData,
                grafica.fallbackType || 'bar'
              );
            }
            if (!isDataUrlImagenValida(imgDataUrl) && Array.isArray(grafica.fallbackRows)) {
              const fallbackData = buildFallbackSeriesFromRows(grafica.fallbackRows);
              imgDataUrl = await renderFallbackChartDataUrl(fallbackData);
            }
            if (!isDataUrlImagenValida(imgDataUrl)) continue;

            // Calcular dimensiones proporcionales
            const baseWidth =
              Number(canvas?.width) || Number(canvas?.clientWidth) || 1200;
            const baseHeight =
              Number(canvas?.height) || Number(canvas?.clientHeight) || 600;
            const canvasAspectRatio = baseHeight / Math.max(baseWidth, 1);
            const imgWidth = pageWidth - 2 * margin;
            const imgHeight = imgWidth * (canvasAspectRatio > 0 ? canvasAspectRatio : 0.55);

            if (yPosition + imgHeight > pageHeight - margin) {
              pdf.addPage();
              yPosition = margin;
            }

            pdf.setFontSize(10);
            pdf.setFont(undefined, 'bold');
            pdf.text(grafica.titulo, margin, yPosition);
            yPosition += 5;

            pdf.addImage(imgDataUrl, 'PNG', margin, yPosition, imgWidth, imgHeight);
            yPosition += imgHeight + 10;
          } catch (err) {
            console.error('Error al exportar grafica a PDF:', grafica.titulo, err);
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
