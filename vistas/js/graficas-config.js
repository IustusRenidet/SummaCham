(() => {
  const STORAGE_KEY_BASE = "graficas_config_v2";
  const LEGACY_STORAGE_KEY = "graficas_config_v1";
  const API_BASE = (() => {
    if (window.location.protocol === "file:") {
      return "http://localhost:3005/api";
    }
    return `${window.location.origin.replace(/\/$/, "")}/api`;
  })();
  const API_ENDPOINT = `${API_BASE}/graficas-config`;
  const EVENT_CONFIG_UPDATED = "graficas-config-updated";
  const DEFAULT_CONFIG = {
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
        label: "Ppto acumulado",
        color: "#60a5fa",
        enabled: true,
      },
      {
        key: "prevYTD",
        label: "Real acumulado del anio anterior",
        color: "#94a3b8",
        enabled: true,
      },
    ],
    charts: {
      operating: {
        enabled: true,
        title: "Resultado Operativo por Capitulo",
        subtitle: "Real acumulado / Ppto acumulado / Real acumulado del anio anterior",
        chartType: "inherit",
      },
      net: {
        enabled: true,
        title: "Resumen Neto por Capitulo",
        subtitle: "Real acumulado / Ppto acumulado / Real acumulado del anio anterior",
        chartType: "inherit",
      },
      consolidated: {
        enabled: true,
        title: "Consolidados Operativos vs Netos",
        subtitle: "Real acumulado / Ppto acumulado / Real acumulado del anio anterior",
        chartType: "inherit",
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
      chartType: "inherit",
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
      chartType: "inherit",
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
            {
              label: "Ciudad de Mexico",
              variants: ["OPERATING RESULTS MEXICO"],
            },
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
      chartType: "bar",
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
    },
    manualOnly: true,
    customCharts: [
      {
        id: "manual-operating",
        module: "RESUMEN",
        title: "Resultado Operativo por Capitulo",
        subtitle: "Real acumulado / Ppto acumulado / Real acumulado del anio anterior",
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
        subtitle: "Real acumulado / Ppto acumulado / Real acumulado del anio anterior",
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
        subtitle: "Real acumulado / Ppto acumulado / Real acumulado del anio anterior",
        chartType: "inherit",
        sourceType: "snapshot",
        seriesMode: "rows",
        enabled: true,
        cdmxOnly: true,
        seriesKeys: ["actualYTD", "planYTD", "prevYTD"],
        rows: [
          {
            alias: "CONSOLIDATED OPERATING RESULTS",
            color: "#0d47a1",
            variants: [
              "CONSOLIDATED OPERATING RESULTS",
              "CONSOLIDATED OPERATING RESULT",
            ],
          },
          {
            alias: "CONSOLIDATED NET RESULTS",
            color: "#94a3b8",
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
            color: "#0d47a1",
            variants: [
              "CDMX INCOME",
              "MEXICO INCOME",
              "CIUDAD DE MEXICO INCOME",
            ],
          },
          {
            alias: "Guadalajara",
            color: "#60a5fa",
            variants: ["GUADALAJARA INCOME", "GDL INCOME", "GUADALAJARA INCOMEA"],
          },
          {
            alias: "Monterrey",
            color: "#22c55e",
            variants: ["MONTERREY INCOME", "MTY INCOME"],
          },
          {
            alias: "Noroeste",
            color: "#f59e0b",
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
            color: "#0d47a1",
            variants: ["COMMITTEES", "COMITES", "COMMITTEES (INCOME)"],
          },
          {
            alias: "Membership",
            color: "#60a5fa",
            variants: ["MEMBERSHIP", "MEMBERSHIP (INCOME)"],
          },
          {
            alias: "Events",
            color: "#22c55e",
            variants: ["EVENTS", "EVENTS (INCOME)"],
          },
          {
            alias: "Services to Members",
            color: "#f59e0b",
            variants: [
              "SERVICES TO MEMBERS",
              "SERVICES MEMBERS",
              "SERVICES TO MEMBERS (INCOME)",
            ],
          },
          {
            alias: "T&IC",
            color: "#a855f7",
            variants: ["T&IC", "T&IC (INCOME)", "T&IC INCOME"],
          },
        ],
      },
    ],
    deletedChartIds: [],
  };

  const clone = (value) => JSON.parse(JSON.stringify(value));

  const mergeDefaultCustomCharts = (charts = [], deletedIds = []) => {
    const deletedSet = new Set(
      (Array.isArray(deletedIds) ? deletedIds : [])
        .map((value) => canonicalizeChartId(value))
        .filter(Boolean)
    );
    const merged = new Map();
    (Array.isArray(DEFAULT_CONFIG.customCharts) ? DEFAULT_CONFIG.customCharts : [])
      .forEach((chart) => {
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

  const MODULE_CATALOG = [
    { key: "RESUMEN", value: "RESUMEN", aliases: ["SUMMARY"] },
    { key: "FINANZAS", value: "Finanzas" },
    { key: "GASTOSGENERALES", value: "Gastos Generales" },
    { key: "NOMINA", value: "Nomina" },
    { key: "MEMBRESIA", value: "Membresia" },
    {
      key: "SERVMEMBRESIA",
      value: "Serv Membresia",
      aliases: ["SERVICIOSALAMEMBRESIA"],
    },
    { key: "RH", value: "RH" },
    { key: "EVENTOS", value: "Eventos" },
    { key: "COMITES", value: "Comites", aliases: ["COMITESINCOME"] },
    { key: "COMUNICACION", value: "Comunicacion" },
    { key: "DIRECCION", value: "Direccion" },
    { key: "GTOSCORPORATIVOS", value: "Gtos Corporativos" },
    { key: "TIC", value: "T&IC", aliases: ["TANDIC"] },
    { key: "VPE", value: "VPE" },
    { key: "PRESUPUESTOS", value: "Presupuestos" },
  ];

  const MODULE_VALUE_BY_KEY = new Map();
  MODULE_CATALOG.forEach((item) => {
    if (!item?.key || !item?.value) return;
    MODULE_VALUE_BY_KEY.set(item.key, item.value);
    (Array.isArray(item.aliases) ? item.aliases : []).forEach((alias) => {
      if (!alias) return;
      MODULE_VALUE_BY_KEY.set(alias, item.value);
    });
  });

  const SUMMARY_SERIES_KEYS = new Set([
    "actual",
    "plan",
    "prev",
    "varMonthPlan",
    "varMonthPrev",
    "actualYTD",
    "planYTD",
    "prevYTD",
    "varYTDPlan",
    "varYTDPrev",
  ]);

  const normalizeSeriesSelectionKey = (value) =>
    (value || "")
      .toString()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");

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
    const rawKey = normalizeModuleRawKey(value);
    const resolveAlias = (candidate) => {
      if (!candidate) return "";
      if (MODULE_VALUE_BY_KEY.has(candidate)) return candidate;
      if (candidate.endsWith("HTML")) {
        const withoutHtml = candidate.slice(0, -4);
        if (MODULE_VALUE_BY_KEY.has(withoutHtml)) return withoutHtml;
      }
      return "";
    };
    const resolved = resolveAlias(rawKey);
    if (resolved) return resolved;

    const fallbackRaw = normalizeModuleRawKey(fallback || "RESUMEN");
    const fallbackResolved = resolveAlias(fallbackRaw);
    if (fallbackResolved) return fallbackResolved;
    return "RESUMEN";
  };

  const normalizeModuleValue = (value = "", fallback = "RESUMEN") =>
    MODULE_VALUE_BY_KEY.get(normalizeModuleKey(value, fallback)) ||
    MODULE_VALUE_BY_KEY.get(normalizeModuleKey(fallback, "RESUMEN")) ||
    "RESUMEN";

  const normalizeSeriesKeyForModule = (key, moduleKey) => {
    const clean = key != null ? String(key).trim() : "";
    if (!clean) return "";
    const normalized = normalizeSeriesSelectionKey(clean);

    if (moduleKey === "RESUMEN") {
      if (normalized === "BUDGET" || normalized === "TOTALBUDGET") {
        return "planYTD";
      }
      if (normalized === "REAL" || normalized === "TOTALREAL") {
        return "actualYTD";
      }
      if (normalized === "ANNUAL" || normalized === "BUDGETANNUAL") {
        return "prevYTD";
      }
      if (normalized === "ACTUAL") return "actual";
      if (normalized === "PLAN") return "plan";
      if (normalized === "PREV") return "prev";
      if (normalized === "VARMONTHPLAN") return "varMonthPlan";
      if (normalized === "VARMONTHPREV") return "varMonthPrev";
      if (normalized === "ACTUALYTD") return "actualYTD";
      if (normalized === "PLANYTD") return "planYTD";
      if (normalized === "PREVYTD") return "prevYTD";
      if (normalized === "VARYTDPLAN") return "varYTDPlan";
      if (normalized === "VARYTDPREV") return "varYTDPrev";
      return clean;
    }

    if (
      normalized === "BUDGET" ||
      normalized === "TOTALBUDGET" ||
      normalized === "PLAN" ||
      normalized === "PLANYTD"
    ) {
      return "budget";
    }
    if (
      normalized === "REAL" ||
      normalized === "TOTALREAL" ||
      normalized === "ACTUAL" ||
      normalized === "ACTUALYTD"
    ) {
      return "real";
    }
    if (
      normalized === "ANNUAL" ||
      normalized === "BUDGETANNUAL" ||
      normalized === "PREV" ||
      normalized === "PREVYTD"
    ) {
      return "annual";
    }

    return clean;
  };

  const normalizeCustomChartRowDefinition = (row) => {
    if (typeof row === "string") {
      const line = row.trim();
      if (!line) return null;
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
      return { alias: alias || variants[0], variants };
    }

    const variants = Array.isArray(row?.variants)
      ? row.variants
      : Array.isArray(row?.labels)
      ? row.labels
      : typeof row?.label === "string"
      ? [row.label]
      : typeof row?.alias === "string"
      ? [row.alias]
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
      typeof row?.color === "string" && row.color.trim() ? row.color.trim() : null;
    const normalized = { alias, variants: cleaned };
    if (color) normalized.color = color;
    return normalized;
  };

  const normalizeCustomCharts = (charts = []) => {
    if (!Array.isArray(charts)) return [];
    return charts.map((chart, index) => {
      const id = chart?.id ? String(chart.id) : `custom-${index + 1}`;
      const module = normalizeModuleValue(chart?.module, "RESUMEN");
      const moduleKey = normalizeModuleKey(module, "RESUMEN");
      const title =
        typeof chart?.title === "string" && chart.title.trim()
          ? chart.title.trim()
          : `Grafica ${index + 1}`;
      const subtitle =
        typeof chart?.subtitle === "string" ? chart.subtitle.trim() : "";
      const chartType =
        normalizeChartType(chart?.chartType, "inherit");
      const enabled = typeof chart?.enabled === "boolean" ? chart.enabled : true;
      const seriesMode = normalizeSeriesMode(chart?.seriesMode, "columns");
      const cdmxOnly = chart?.cdmxOnly === true;
      const rows = Array.isArray(chart?.rows) ? chart.rows : [];
      const normalizedRows = rows
        .map((row) => normalizeCustomChartRowDefinition(row))
        .filter(Boolean);
      const seriesKeys = Array.isArray(chart?.seriesKeys)
        ? chart.seriesKeys
            .map((key) => normalizeSeriesKeyForModule(key, moduleKey))
            .filter(Boolean)
        : [];
      const series = Array.isArray(chart?.series)
        ? chart.series
            .map((serie) => {
              const key = normalizeSeriesKeyForModule(serie?.key, moduleKey);
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
      const mergedSeriesKeys = [];
      const pushSeriesKey = (key) => {
        const normalized = normalizeSeriesSelectionKey(key);
        if (!normalized) return;
        if (
          moduleKey === "RESUMEN" &&
          !SUMMARY_SERIES_KEYS.has(key) &&
          SUMMARY_SERIES_KEYS.has(
            normalizeSeriesKeyForModule(key, moduleKey)
          )
        ) {
          key = normalizeSeriesKeyForModule(key, moduleKey);
        }
        if (
          mergedSeriesKeys.some(
            (existing) =>
              normalizeSeriesSelectionKey(existing) ===
              normalizeSeriesSelectionKey(key)
          )
        ) {
          return;
        }
        mergedSeriesKeys.push(key);
      };
      seriesKeys.forEach((key) => pushSeriesKey(key));
      series.forEach((serie) => pushSeriesKey(serie.key));
      const sourceType = normalizeSourceType(chart?.sourceType, "snapshot");
      const mergedSeries = [];
      const seenSeries = new Set();
      series.forEach((serie) => {
        const seriesKey = normalizeSeriesSelectionKey(serie?.key);
        if (!seriesKey || seenSeries.has(seriesKey)) return;
        seenSeries.add(seriesKey);
        mergedSeries.push(serie);
      });
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
        series: mergedSeries,
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

  const normalizeVariantsList = (values, fallback = []) => {
    if (!Array.isArray(values)) return fallback.slice();
    return values
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  };

  const normalizeRowDefinition = (row = {}, fallback = {}) => {
    const variants = normalizeVariantsList(
      row?.variants ?? row?.labels,
      fallback?.variants || []
    );
    const label =
      typeof row?.label === "string" && row.label.trim()
        ? row.label.trim()
        : typeof row?.alias === "string" && row.alias.trim()
        ? row.alias.trim()
        : typeof fallback?.label === "string" && fallback.label.trim()
        ? fallback.label.trim()
        : variants[0] || "";
    return { label, variants };
  };

  const normalizeRowList = (rows, fallback = []) => {
    if (!Array.isArray(rows)) {
      return (fallback || []).map((item) => normalizeRowDefinition(item, item));
    }
    return rows
      .map((row, index) => normalizeRowDefinition(row, fallback[index] || {}))
      .filter((row) => row.variants.length);
  };

  const normalizeSourceMap = (map = {}, fallbackMap = {}) => {
    const result = {};
    const fallbackKeys = Object.keys(fallbackMap || {});
    fallbackKeys.forEach((key) => {
      result[key] = normalizeVariantsList(map?.[key], fallbackMap?.[key] || []);
    });
    if (map && typeof map === "object") {
      Object.keys(map).forEach((key) => {
        if (result[key]) return;
        result[key] = normalizeVariantsList(map[key], []);
      });
    }
    return result;
  };

  const normalizeSummarySources = (sources = {}, defaults = {}) => {
    const buildGroup = (key) => {
      const group = sources?.[key] || {};
      const fallback = defaults?.[key] || {};
      return {
        operating: normalizeRowList(group.operating, fallback.operating || []),
        net: normalizeRowList(group.net, fallback.net || []),
      };
    };
    return {
      cdmx: buildGroup("cdmx"),
      gdl: buildGroup("gdl"),
      ne: buildGroup("ne"),
      no: buildGroup("no"),
      generic: buildGroup("generic"),
    };
  };

  const normalizeSources = (sources = {}, defaults = {}) => {
    const fallbackSummary = defaults.summary || {};
    const fallbackConsolidated = defaults.consolidated || {};
    return {
      summary: normalizeSummarySources(sources.summary || {}, fallbackSummary),
      consolidated: {
        operating: normalizeRowDefinition(
          sources.consolidated?.operating,
          fallbackConsolidated.operating || {}
        ),
        net: normalizeRowDefinition(
          sources.consolidated?.net,
          fallbackConsolidated.net || {}
        ),
      },
      ingreso: normalizeSourceMap(
        sources.ingreso || {},
        defaults.ingreso || {}
      ),
      ingresoNacional: normalizeSourceMap(
        sources.ingresoNacional || {},
        defaults.ingresoNacional || {}
      ),
    };
  };

  const normalizeConfig = (config = {}) => {
    const base = clone(DEFAULT_CONFIG);
    if (!config || typeof config !== "object") {
      return base;
    }
    const incomingVersion = Number(config.version);
    const resetToManualFlow =
      !Number.isFinite(incomingVersion) ||
      incomingVersion < DEFAULT_CONFIG.version;

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
        base.charts[key].chartType = normalizeChartType(
          override.chartType,
          base.charts[key].chartType || "inherit"
        );
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
      base.ingreso.chartType = normalizeChartType(
        override.chartType,
        base.ingreso.chartType || "inherit"
      );
      base.ingreso.series = normalizeSeriesMap(
        base.ingreso.series,
        override.series
      );
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
      base.ingresoNacional.chartType = normalizeChartType(
        override.chartType,
        base.ingresoNacional.chartType || "inherit"
      );
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
      base.operativo.chartType = normalizeChartType(
        override.chartType,
        base.operativo.chartType || "bar"
      );
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
        base.gastosGenerales.subtitleTemplate =
          override.subtitleTemplate.trim();
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
          base.gastosGenerales.charts[key].chartType = normalizeChartType(
            chartOverride.chartType,
            base.gastosGenerales.charts[key].chartType || "line"
          );
          base.gastosGenerales.charts[key].series = normalizeSeriesMap(
            base.gastosGenerales.charts[key].series,
            chartOverride.series
          );
        });
      }
    }

    if (config.sources && typeof config.sources === "object") {
      base.sources = normalizeSources(config.sources, base.sources);
    }

    const normalizedCustomCharts = Array.isArray(config.customCharts)
      ? normalizeCustomCharts(config.customCharts)
      : [];
    const deletedSet = new Set(base.deletedChartIds || []);
    const filteredCustomCharts = normalizedCustomCharts.filter((chart) => {
      const key = canonicalizeChartId(chart?.id);
      if (!key) return false;
      return !deletedSet.has(key);
    });

    // Migración: al entrar a versión 5 se convierten las gráficas base a manuales.
    if (resetToManualFlow || filteredCustomCharts.length === 0) {
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

    return base;
  };

  const obtenerHeadersAuth = () => {
    if (window.Sesion && typeof window.Sesion.headersAutenticacion === "function") {
      return window.Sesion.headersAutenticacion();
    }
    return {};
  };

  const dispatchConfigUpdate = (config, source, meta = {}) => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent(EVENT_CONFIG_UPDATED, {
        detail: {
          config: clone(config),
          source,
          empresaId: meta?.empresaId || null,
          anio: meta?.anio ?? null,
        },
      })
    );
  };

  const resolveEmpresaId = (override) => {
    if (override) return String(override);
    try {
      const fromSesion = window.Sesion?.obtenerEmpresaActiva?.()?.id;
      if (fromSesion) return String(fromSesion);
    } catch (_) {
      // ignore
    }
    try {
      const params = new URLSearchParams(window.location.search || "");
      const fromUrl =
        params.get("empresa") || params.get("empresaId") || params.get("empresa_id");
      if (fromUrl) return String(fromUrl);
    } catch (_) {
      // ignore
    }
    return "EMPRESA01";
  };

  const resolveAnio = (override) => {
    const parsedOverride = Number(override);
    if (Number.isInteger(parsedOverride)) return parsedOverride;

    const select = document.getElementById("anioSelect");
    const parsedSelect = Number(select?.value);
    if (Number.isInteger(parsedSelect)) return parsedSelect;

    const label = document.getElementById("anioLabel")?.textContent || "";
    const parsedLabel = Number(label);
    if (Number.isInteger(parsedLabel)) return parsedLabel;

    try {
      const ctx = window.Sesion?.obtenerContextoPlaneacion?.() || {};
      const ctxYear = Number(ctx?.anio);
      if (Number.isInteger(ctxYear)) return ctxYear;
    } catch (_) {
      // ignore
    }

    try {
      const params = new URLSearchParams(window.location.search || "");
      const yearFromUrl = Number(params.get("year"));
      if (Number.isInteger(yearFromUrl)) return yearFromUrl;
    } catch (_) {
      // ignore
    }

    return new Date().getFullYear();
  };

  const resolveContext = (overrides = {}) => {
    const empresaId = resolveEmpresaId(overrides.empresaId || overrides.empresa);
    const anio = resolveAnio(overrides.anio ?? overrides.year);
    return { empresaId, anio };
  };

  const buildContextKey = (ctx) => `${ctx.empresaId}:${ctx.anio}`;
  const buildStorageKey = (ctx) =>
    `${STORAGE_KEY_BASE}:${ctx.empresaId}:${ctx.anio}`;

  const loadLocalConfig = (ctx) => {
    const storageKey = buildStorageKey(ctx);
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        return normalizeConfig(JSON.parse(raw));
      }
    } catch (_) {
      // ignore
    }

    // Migración: si existía el storage legacy sin año, úsalo como punto de partida.
    try {
      const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!legacyRaw) return null;
      const parsed = normalizeConfig(JSON.parse(legacyRaw));
      if (parsed) {
        persistLocalConfig(ctx, parsed);
        return parsed;
      }
    } catch (_) {
      // ignore
    }

    return null;
  };

  const persistLocalConfig = (ctx, config) => {
    const storageKey = buildStorageKey(ctx);
    try {
      localStorage.setItem(storageKey, JSON.stringify(config));
    } catch (_) {
      /* ignore */
    }
  };

  const buildEndpointUrl = (ctx) => {
    const params = new URLSearchParams();
    if (ctx?.anio != null) {
      params.set("anio", String(ctx.anio));
    }
    const qs = params.toString();
    return qs ? `${API_ENDPOINT}?${qs}` : API_ENDPOINT;
  };

  const fetchServerConfig = async (ctx) => {
    const response = await fetch(buildEndpointUrl(ctx), {
      method: "GET",
      headers: obtenerHeadersAuth(),
      credentials: "include",
    });
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error("No fue posible cargar la configuracion.");
    }
    const payload = await response.json();
    if (!payload?.config) return null;
    return normalizeConfig(payload.config);
  };

  const saveServerConfig = async (ctx, config) => {
    const response = await fetch(buildEndpointUrl(ctx), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...obtenerHeadersAuth(),
      },
      credentials: "include",
      body: JSON.stringify({ config, anio: ctx?.anio }),
    });
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error("No fue posible guardar la configuracion.");
    }
    const payload = await response.json();
    if (!payload?.config) return null;
    return normalizeConfig(payload.config);
  };

  const resetServerConfig = async (ctx) => {
    const response = await fetch(buildEndpointUrl(ctx), {
      method: "DELETE",
      headers: obtenerHeadersAuth(),
      credentials: "include",
    });
    if (response.status === 404) {
      return;
    }
    if (!response.ok) {
      throw new Error("No fue posible restaurar la configuracion.");
    }
  };

  const contextState = new Map(); // contextKey -> { cachedConfig, loadedFromServer, loadingPromise }

  const getContextEntry = (ctx) => {
    const key = buildContextKey(ctx);
    if (!contextState.has(key)) {
      contextState.set(key, {
        cachedConfig: null,
        loadedFromServer: false,
        loadingPromise: null,
      });
    }
    return contextState.get(key);
  };

  const hydrateConfigFromServer = (ctx) => {
    const entry = getContextEntry(ctx);
    if (entry.loadedFromServer) return;
    entry.loadedFromServer = true;
    entry.loadingPromise = fetchServerConfig(ctx)
      .then((serverConfig) => {
        if (!serverConfig) return;
        entry.cachedConfig = clone(serverConfig);
        persistLocalConfig(ctx, entry.cachedConfig);
        dispatchConfigUpdate(entry.cachedConfig, "server", ctx);
      })
      .catch((error) => {
        console.warn("GraficasConfig: sin respuesta del servidor.", error);
      })
      .finally(() => {
        entry.loadingPromise = null;
      });
  };

  const loadConfig = (overrides = {}) => {
    const ctx = resolveContext(overrides);
    const entry = getContextEntry(ctx);
    if (!entry.cachedConfig) {
      const localConfig = loadLocalConfig(ctx);
      entry.cachedConfig = localConfig ? clone(localConfig) : clone(DEFAULT_CONFIG);
      persistLocalConfig(ctx, entry.cachedConfig);
      hydrateConfigFromServer(ctx);
    } else {
      hydrateConfigFromServer(ctx);
    }
    return clone(entry.cachedConfig);
  };

  const saveConfig = (config, overrides = {}) => {
    const ctx = resolveContext(overrides);
    const entry = getContextEntry(ctx);
    const normalized = normalizeConfig(config);
    entry.cachedConfig = clone(normalized);
    persistLocalConfig(ctx, entry.cachedConfig);
    dispatchConfigUpdate(entry.cachedConfig, "local", ctx);

    saveServerConfig(ctx, normalized)
      .then((serverConfig) => {
        if (!serverConfig) return;
        entry.cachedConfig = clone(serverConfig);
        persistLocalConfig(ctx, entry.cachedConfig);
        dispatchConfigUpdate(entry.cachedConfig, "server", ctx);
      })
      .catch((error) => {
        console.warn("GraficasConfig: no se pudo guardar en servidor.", error);
      });

    return clone(entry.cachedConfig);
  };

  const resetConfig = (overrides = {}) => {
    const ctx = resolveContext(overrides);
    const entry = getContextEntry(ctx);
    entry.cachedConfig = clone(DEFAULT_CONFIG);
    try {
      localStorage.removeItem(buildStorageKey(ctx));
    } catch (_) {
      /* ignore */
    }
    dispatchConfigUpdate(entry.cachedConfig, "local", ctx);
    resetServerConfig(ctx)
      .then(() => {
        dispatchConfigUpdate(entry.cachedConfig, "server", ctx);
      })
      .catch((error) => {
        console.warn("GraficasConfig: no se pudo restaurar en servidor.", error);
      });
    return clone(entry.cachedConfig);
  };

  const hasSaved = (overrides = {}) => {
    const ctx = resolveContext(overrides);
    try {
      return Boolean(localStorage.getItem(buildStorageKey(ctx)));
    } catch (_) {
      return false;
    }
  };

  window.GraficasConfig = {
    storageKey: STORAGE_KEY_BASE,
    legacyStorageKey: LEGACY_STORAGE_KEY,
    defaults: clone(DEFAULT_CONFIG),
    load: loadConfig,
    save: saveConfig,
    reset: resetConfig,
    normalize: normalizeConfig,
    hasSaved,
    resolveContext,
    buildStorageKey: (overrides = {}) => buildStorageKey(resolveContext(overrides)),
  };

  const form = document.getElementById("graficasConfigForm");
  if (!form) return;

  const fieldset = document.getElementById("graficasConfigFieldset");
  const statusEl = document.getElementById("graficasConfigStatus");
  const warningEl = document.getElementById("graficasConfigWarning");
  const saveBtn = document.getElementById("graficasConfigSave");
  const resetBtn = document.getElementById("graficasConfigReset");
  const legendShowToggle = document.getElementById("legendShowToggle");
  const legendPositionSelect = document.getElementById("legendPositionSelect");
  const chartTypeSelect = document.getElementById("chartTypeSelect");
  const chartStackedToggle = document.getElementById("chartStackedToggle");
  const manualOnlyToggle = document.getElementById("manualOnlyToggle");
  const manualChartsContainer = document.getElementById("manualChartsContainer");
  const manualChartsEmpty = document.getElementById("manualChartsEmpty");
  const manualAddBtn = document.getElementById("manualAddChartBtn");
  const simpleChartsContainer = document.getElementById("simpleChartsContainer");
  const simpleChartsEmpty = document.getElementById("simpleChartsEmpty");

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

  const MODULE_OPTIONS = MODULE_CATALOG.map((item) => item.value);

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
      label: "Ppto acumulado",
      color: "#60a5fa",
      enabled: true,
    },
    {
      key: "prevYTD",
      label: "Real acumulado del anio anterior",
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

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const getModuleOptionsHtml = () =>
    MODULE_OPTIONS.map((mod) => `<option value="${escapeHtml(mod)}">${escapeHtml(mod)}</option>`).join(
      ""
    );

  const applyModuleOptions = (select, value) => {
    if (!select) return;
    select.innerHTML = getModuleOptionsHtml();
    const normalizedValue = normalizeModuleValue(value, "RESUMEN");
    const hasValue = Array.from(select.options).some(
      (option) => option.value === normalizedValue
    );
    if (normalizedValue && !hasValue) {
      const customOption = document.createElement("option");
      customOption.value = normalizedValue;
      customOption.textContent = normalizedValue;
      select.appendChild(customOption);
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
        const alias = (row?.alias || row?.label || "").trim();
        const raw = cleaned.join(" | ");
        if (alias && alias !== cleaned[0]) {
          return `${alias}=${raw}`;
        }
        return raw;
      })
      .filter(Boolean)
      .join("\n");
  };

  const getSummarySeriesFromForm = (defaults) => {
    const rows = Array.from(form.querySelectorAll("[data-series-row]"));
    const formOverrides = new Map(
      rows
        .map((row) => {
          const key = row.getAttribute("data-series-key");
          if (!key) return null;
          const labelInput = row.querySelector("[data-series-label]");
          const colorInput = row.querySelector("[data-series-color]");
          const enabledInput = row.querySelector("[data-series-enabled]");
          return [
            key,
            {
              label: labelInput?.value?.trim() || "",
              color: colorInput?.value || "",
              enabled:
                typeof enabledInput?.checked === "boolean"
                  ? enabledInput.checked
                  : true,
            },
          ];
        })
        .filter(Boolean)
    );
    const defaultsMap = new Map(
      (Array.isArray(defaults.series) ? defaults.series : [])
        .map((serie) => [String(serie?.key || "").trim(), serie])
        .filter(([key]) => Boolean(key))
    );
    return SUMMARY_TABLE_SERIES.map((base) => {
      const fromForm = formOverrides.get(base.key) || {};
      const fromDefaults = defaultsMap.get(base.key) || {};
      return {
        key: base.key,
        label:
          (typeof fromForm.label === "string" && fromForm.label.trim()
            ? fromForm.label.trim()
            : null) ||
          (typeof fromDefaults.label === "string" && fromDefaults.label.trim()
            ? fromDefaults.label.trim()
            : null) ||
          base.label,
        color:
          (typeof fromForm.color === "string" && fromForm.color.trim()
            ? fromForm.color.trim()
            : null) ||
          (typeof fromDefaults.color === "string" && fromDefaults.color.trim()
            ? fromDefaults.color.trim()
            : null) ||
          base.color,
        enabled:
          typeof fromForm.enabled === "boolean"
            ? fromForm.enabled
            : typeof fromDefaults.enabled === "boolean"
            ? fromDefaults.enabled
            : base.enabled !== false,
      };
    });
  };

  const getOperativoSeriesFromConfig = (config, defaults) => {
    const base = defaults.operativo?.datasets || {};
    const override = config.operativo?.datasets || {};
    return Object.keys(base).map((key) => {
      const baseItem = base[key] || {};
      const overrideItem = override[key] || {};
      return {
        key,
        label: overrideItem.label || baseItem.label || key,
        color: overrideItem.color || baseItem.color || "#0d47a1",
        enabled:
          typeof overrideItem.enabled === "boolean"
            ? overrideItem.enabled
            : baseItem.enabled !== false,
      };
    });
  };

  const getSeriesOptionsForModule = (moduleValue) => {
    const moduleKey = normalizeModuleKey(moduleValue, "RESUMEN");
    if (moduleKey === "RESUMEN") {
      return getSummarySeriesFromForm(DEFAULT_CONFIG);
    }
    const currentConfig = loadConfig();
    return getOperativoSeriesFromConfig(currentConfig, DEFAULT_CONFIG);
  };

  const renderSeriesOptions = (container, options = [], selectedKeys = []) => {
    if (!container) return;
    const selectedSet = new Set(
      (selectedKeys || []).map((key) => String(key).trim()).filter(Boolean)
    );
    const optionKeys = new Set(
      (options || [])
        .map((option) => (option?.key || "").toString().trim())
        .filter(Boolean)
    );
    const hasMatch = Array.from(selectedSet).some((key) => optionKeys.has(key));
    const useAll = selectedSet.size === 0 || !hasMatch;
    container.innerHTML = "";
    options.forEach((option) => {
      const safeKey = (option?.key || "").toString().trim();
      if (!safeKey) return;
      const randomId = Math.random().toString(36).slice(2, 8);
      const checkboxId = `manualSeries-${safeKey}-${randomId}`;
      const wrapper = document.createElement("div");
      wrapper.className = "form-check form-check-inline";
      const checked = useAll ? option.enabled !== false : selectedSet.has(safeKey);
      wrapper.innerHTML = `
        <input class="form-check-input" type="checkbox" id="${checkboxId}" data-series-key="${escapeHtml(
          safeKey
        )}" ${checked ? "checked" : ""} />
        <label class="form-check-label" for="${checkboxId}">
          <span class="series-dot" style="background:${escapeHtml(
            option.color || "#0d47a1"
          )}"></span>
          ${escapeHtml(option.label || safeKey)}
        </label>
      `;
      container.appendChild(wrapper);
    });
  };

  const updateManualOnlyState = (manualOnly) => {
    if (!form) return;
    const enabled = manualOnly === true;
    form.setAttribute("data-manual-only", enabled ? "true" : "false");
  };

  const updateManualChartsEmptyState = () => {
    if (!manualChartsEmpty || !manualChartsContainer) return;
    const hasCharts = manualChartsContainer.children.length > 0;
    manualChartsEmpty.classList.toggle("d-none", hasCharts);
  };

  const SIMPLE_ROW_COLORS = [
    "#0d47a1",
    "#60a5fa",
    "#22c55e",
    "#f59e0b",
    "#94a3b8",
    "#a855f7",
    "#ef4444",
    "#06b6d4",
  ];

  const getFallbackRowColor = (index) =>
    SIMPLE_ROW_COLORS[index % SIMPLE_ROW_COLORS.length];

  const updateSimpleChartsEmptyState = () => {
    if (!simpleChartsEmpty || !simpleChartsContainer) return;
    const hasCharts = simpleChartsContainer.children.length > 0;
    simpleChartsEmpty.classList.toggle("d-none", hasCharts);
  };

  const resolveSeriesOptionMap = (moduleValue, chart = {}) => {
    const baseOptions = getSeriesOptionsForModule(moduleValue);
    const map = new Map(
      (baseOptions || [])
        .map((option) => {
          const key = String(option?.key || "").trim();
          if (!key) return null;
          return [key, option];
        })
        .filter(Boolean)
    );

    const overrides = Array.isArray(chart?.series) ? chart.series : [];
    overrides.forEach((override) => {
      const key = String(override?.key || "").trim();
      if (!key) return;
      const existing = map.get(key) || { key, label: key, color: "#94a3b8" };
      map.set(key, {
        ...existing,
        label:
          typeof override.label === "string" && override.label.trim()
            ? override.label.trim()
            : existing.label,
        color:
          typeof override.color === "string" && override.color.trim()
            ? override.color.trim()
            : existing.color,
        enabled:
          typeof override.enabled === "boolean" ? override.enabled : existing.enabled,
      });
    });
    return map;
  };

  const renderSimpleSeriesChips = (container, seriesKeys = [], optionMap) => {
    if (!container) return;
    container.innerHTML = "";
    const keys = Array.isArray(seriesKeys) ? seriesKeys : [];
    if (!keys.length) {
      container.innerHTML =
        '<span class="text-muted small">Sin columnas.</span>';
      return;
    }
    keys.forEach((rawKey) => {
      const key = String(rawKey || "").trim();
      if (!key) return;
      const def = optionMap?.get ? optionMap.get(key) : null;
      const label = def?.label || key;
      const color = def?.color || "#94a3b8";
      const chip = document.createElement("span");
      chip.className = "simple-chip";
      chip.setAttribute("data-simple-series-chip", key);
      chip.innerHTML = `
        <span class="simple-dot" style="background:${escapeHtml(color)}"></span>
        <span data-simple-chip-label>${escapeHtml(label)}</span>
      `;
      container.appendChild(chip);
    });
  };

  const buildSimpleChartBadgesHtml = (chartMeta) => {
    const badges = [];
    const module = normalizeModuleValue(chartMeta?.module, "RESUMEN");
    if (module) badges.push(module);
    const sourceType = normalizeSourceType(chartMeta?.sourceType, "snapshot");
    badges.push(sourceType === "mensual" ? "Mensual" : "Actual");
    if (chartMeta?.cdmxOnly === true) badges.push("CDMX");
    return badges
      .map((badge) => `<span class="chart-badge">${escapeHtml(badge)}</span>`)
      .join(" ");
  };

  const buildSimpleChartCard = (chart, index) => {
    const chartId = chart?.id || buildCustomChartId();
    const moduleValue = normalizeModuleValue(chart?.module, "RESUMEN");
    const title =
      typeof chart?.title === "string" && chart.title.trim()
        ? chart.title.trim()
        : `Grafica ${index + 1}`;
    const subtitle = typeof chart?.subtitle === "string" ? chart.subtitle.trim() : "";
    const enabled = chart?.enabled !== false;
    const seriesMode = normalizeSeriesMode(chart?.seriesMode, "columns");
    const showRowColors = seriesMode === "rows";
    const seriesKeys = Array.isArray(chart?.seriesKeys)
      ? chart.seriesKeys.map((key) => String(key || "").trim()).filter(Boolean)
      : [];

    const optionMap = resolveSeriesOptionMap(moduleValue, chart);
    const effectiveSeriesKeys =
      seriesKeys.length > 0
        ? seriesKeys
        : Array.from(optionMap.values())
            .filter((opt) => opt?.enabled !== false)
            .map((opt) => opt.key);

    const rows = Array.isArray(chart?.rows) ? chart.rows : [];
    const rowsHtml = rows.length
      ? `
        <div class="table-responsive">
          <table class="table table-sm align-middle mb-0">
            <thead>
              <tr>
                <th>Fila</th>
                <th>Etiqueta</th>
                ${showRowColors ? "<th>Color</th>" : ""}
              </tr>
            </thead>
            <tbody>
              ${rows
                .map((row, rowIdx) => {
                  const variants = Array.isArray(row?.variants) ? row.variants : [];
                  const variantsText = variants
                    .map((value) => (typeof value === "string" ? value.trim() : ""))
                    .filter(Boolean)
                    .join(" | ");
                  const alias =
                    typeof row?.alias === "string" && row.alias.trim()
                      ? row.alias.trim()
                      : variants?.[0] || "";
                  const color =
                    typeof row?.color === "string" && row.color.trim()
                      ? row.color.trim()
                      : getFallbackRowColor(rowIdx);
                  return `
                    <tr data-simple-row="true" data-simple-row-index="${rowIdx}">
                      <td>
                        <div class="simple-variants"><code>${escapeHtml(
                          variantsText || "-"
                        )}</code></div>
                      </td>
                      <td>
                        <input type="text" class="form-control form-control-sm" data-simple-row-alias value="${escapeHtml(
                          alias
                        )}" />
                      </td>
                      ${
                        showRowColors
                          ? `<td>
                              <input type="color" class="form-control form-control-color color-input" data-simple-row-color value="${escapeHtml(
                                color
                              )}" />
                            </td>`
                          : ""
                      }
                    </tr>
                  `;
                })
                .join("")}
            </tbody>
          </table>
        </div>
      `
      : '<div class="manual-empty text-muted small">Sin filas.</div>';

    const wrapper = document.createElement("div");
    wrapper.className = "simple-chart-card mb-3";
    wrapper.setAttribute("data-simple-chart-id", chartId);
    wrapper.setAttribute("data-simple-module", moduleValue);
    wrapper.setAttribute("data-simple-series-mode", seriesMode);
    wrapper.setAttribute(
      "data-simple-series-keys",
      effectiveSeriesKeys.join("|")
    );

    wrapper.innerHTML = `
      <div class="simple-chart-meta">
        <div class="simple-chart-title">
          ${buildSimpleChartBadgesHtml(chart)}
          <span class="fw-bold" data-simple-title-preview>${escapeHtml(title)}</span>
        </div>
        <div class="form-check form-switch m-0">
          <input class="form-check-input" type="checkbox" data-simple-enabled ${
            enabled ? "checked" : ""
          } />
          <label class="form-check-label small">Activa</label>
        </div>
      </div>
      <div class="text-muted small mt-1" data-simple-subtitle-preview>${escapeHtml(
        subtitle
      )}</div>

      <div class="row g-2 mt-3">
        <div class="col-12 col-lg-6">
          <label class="form-label small fw-semibold mb-1">Titulo</label>
          <input class="form-control form-control-sm" type="text" data-simple-title value="${escapeHtml(
            title
          )}" />
        </div>
        <div class="col-12 col-lg-6">
          <label class="form-label small fw-semibold mb-1">Subtitulo</label>
          <input class="form-control form-control-sm" type="text" data-simple-subtitle value="${escapeHtml(
            subtitle
          )}" />
        </div>
      </div>

      <div class="mt-3">
        <div class="simple-block-title mb-2">Columnas</div>
        <div class="simple-chips" data-simple-columns></div>
      </div>

      <div class="mt-3">
        <div class="simple-block-title mb-2">Filas</div>
        ${rowsHtml}
      </div>
    `;

    const chipsContainer = wrapper.querySelector("[data-simple-columns]");
    renderSimpleSeriesChips(chipsContainer, effectiveSeriesKeys, optionMap);
    return wrapper;
  };

  const renderSimpleCharts = (config) => {
    if (!simpleChartsContainer) return;
    simpleChartsContainer.innerHTML = "";
    const list = Array.isArray(config?.customCharts) ? config.customCharts : [];
    list.forEach((chart, index) => {
      const card = buildSimpleChartCard(chart, index);
      simpleChartsContainer.appendChild(card);
    });
    updateSimpleChartsEmptyState();
  };

  const refreshSimpleChartsColumns = () => {
    if (!simpleChartsContainer) return;
    const cards = Array.from(
      simpleChartsContainer.querySelectorAll("[data-simple-chart-id]")
    );
    cards.forEach((card) => {
      const moduleValue = card.getAttribute("data-simple-module") || "RESUMEN";
      const seriesKeys = String(card.getAttribute("data-simple-series-keys") || "")
        .split("|")
        .map((value) => value.trim())
        .filter(Boolean);
      const optionMap = resolveSeriesOptionMap(moduleValue, {});
      const chipsContainer = card.querySelector("[data-simple-columns]");
      renderSimpleSeriesChips(chipsContainer, seriesKeys, optionMap);
    });
  };

  const buildManualSourceHint = (moduleValue, sourceType) => {
    const moduleLabel = normalizeModuleValue(moduleValue, "RESUMEN");
    const cleanSource = normalizeSourceType(sourceType, "snapshot");
    if (cleanSource === "mensual") {
      return `Datos: resumen mensual (Ene-Dic) del modulo ${moduleLabel}. Edita ese resumen para cambiar valores.`;
    }
    return `Datos: tabla actual del modulo ${moduleLabel}. Edita esa tabla para cambiar valores.`;
  };

  const updateManualSourceHint = (card) => {
    if (!card) return;
    const hint = card.querySelector("[data-manual-source-hint]");
    if (!hint) return;
    const moduleValue = card.querySelector("[data-manual-module]")?.value;
    const sourceValue = card.querySelector("[data-manual-source]")?.value;
    hint.textContent = buildManualSourceHint(moduleValue, sourceValue);
  };

  const buildManualChartCard = (chart, index) => {
    const chartId = chart?.id || buildCustomChartId();
    const moduleValue = normalizeModuleValue(chart?.module, "RESUMEN");
    const title = chart?.title || `Grafica manual ${index + 1}`;
    const subtitle = chart?.subtitle || "";
    const chartType = chart?.chartType || "inherit";
    const sourceType = chart?.sourceType || "snapshot";
    const enabled = chart?.enabled !== false;
    const seriesMode = normalizeSeriesMode(chart?.seriesMode, "columns");
    const cdmxOnly = chart?.cdmxOnly === true;
    const seriesKeys = Array.isArray(chart?.seriesKeys)
      ? chart.seriesKeys
      : Array.isArray(chart?.series)
      ? chart.series.map((serie) => serie?.key).filter(Boolean)
      : [];
    const rowsText = formatCustomRows(chart?.rows || []);

    const wrapper = document.createElement("div");
    wrapper.className = "manual-chart-card";
    wrapper.setAttribute("data-manual-chart-id", chartId);
    wrapper.setAttribute("data-manual-series-mode", seriesMode);
    wrapper.setAttribute("data-manual-cdmx-only", cdmxOnly ? "true" : "false");
    wrapper.innerHTML = `
      <div class="d-flex flex-column flex-lg-row align-items-start justify-content-between gap-2 mb-3">
        <div>
          <h3 class="h6 mb-1">Grafica manual</h3>
        </div>
        <button type="button" class="btn btn-outline-danger btn-sm" data-manual-remove>
          Eliminar
        </button>
      </div>
      <div class="row g-2">
        <div class="col-12 col-lg-4">
          <label class="form-label small fw-semibold">Modulo</label>
          <select class="form-select form-select-sm" data-manual-module></select>
        </div>
        <div class="col-12 col-lg-4">
          <label class="form-label small fw-semibold">Origen</label>
          <select class="form-select form-select-sm" data-manual-source>
            <option value="snapshot">Tabla actual</option>
            <option value="mensual">Historico mensual (Ene-Dic)</option>
          </select>
          <div class="form-text" data-manual-source-hint></div>
        </div>
        <div class="col-12 col-lg-4">
          <label class="form-label small fw-semibold">Tipo</label>
          <select class="form-select form-select-sm" data-manual-type>
            <option value="inherit">Heredar</option>
            <option value="bar">Barras</option>
            <option value="line">Lineas</option>
            <option value="pie">Pastel</option>
            <option value="doughnut">Dona</option>
          </select>
        </div>
      </div>
      <div class="row g-2 mt-2">
        <div class="col-12 col-lg-6">
          <label class="form-label small fw-semibold">Titulo</label>
          <input class="form-control form-control-sm" type="text" data-manual-title />
        </div>
        <div class="col-12 col-lg-6">
          <label class="form-label small fw-semibold">Subtitulo</label>
          <input class="form-control form-control-sm" type="text" data-manual-subtitle />
        </div>
      </div>
      <div class="mt-2">
        <label class="form-label small fw-semibold">Columnas</label>
        <div class="manual-series-list d-flex flex-wrap gap-2" data-manual-series></div>
      </div>
      <div class="mt-2">
        <label class="form-label small fw-semibold">Filas</label>
        <textarea class="form-control form-control-sm" rows="4" data-manual-rows></textarea>
        <div class="form-text">
          Formato: Alias=VAR1 | VAR2. VAR = nombre de fila en la tabla origen.
        </div>
      </div>
      <div class="form-check form-switch mt-2">
        <input class="form-check-input" type="checkbox" data-manual-enabled />
        <label class="form-check-label">Activa</label>
      </div>
    `;

    const moduleSelect = wrapper.querySelector("[data-manual-module]");
    applyModuleOptions(moduleSelect, moduleValue);
    const sourceSelect = wrapper.querySelector("[data-manual-source]");
    if (sourceSelect) sourceSelect.value = sourceType;
    const typeSelect = wrapper.querySelector("[data-manual-type]");
    if (typeSelect) typeSelect.value = chartType;
    const titleInput = wrapper.querySelector("[data-manual-title]");
    if (titleInput) titleInput.value = title;
    const subtitleInput = wrapper.querySelector("[data-manual-subtitle]");
    if (subtitleInput) subtitleInput.value = subtitle;
    const rowsInput = wrapper.querySelector("[data-manual-rows]");
    if (rowsInput) rowsInput.value = rowsText;
    const enabledToggle = wrapper.querySelector("[data-manual-enabled]");
    if (enabledToggle) enabledToggle.checked = enabled;

    const seriesContainer = wrapper.querySelector("[data-manual-series]");
    const seriesOptions = getSeriesOptionsForModule(moduleValue);
    renderSeriesOptions(seriesContainer, seriesOptions, seriesKeys);
    updateManualSourceHint(wrapper);

    return wrapper;
  };

  const renderManualCharts = (config) => {
    if (!manualChartsContainer) return;
    manualChartsContainer.innerHTML = "";
    const list = Array.isArray(config?.customCharts) ? config.customCharts : [];
    list.forEach((chart, index) => {
      const card = buildManualChartCard(chart, index);
      manualChartsContainer.appendChild(card);
    });
    updateManualChartsEmptyState();
  };

  const updatePreviewLabels = () => {
    if (!form) return;
    const seriesLabels = new Map();
    const seriesRows = Array.from(form.querySelectorAll("[data-series-row]"));
    seriesRows.forEach((row) => {
      const key = row.getAttribute("data-series-key");
      if (!key) return;
      const input = row.querySelector("[data-series-label]");
      const fallback =
        (DEFAULT_CONFIG.series || []).find((item) => item.key === key) || {};
      const value = input?.value?.trim() || fallback.label || key;
      seriesLabels.set(key, value);
    });

    const consolidatedLabels = new Map();
    const consolidatedRows = Array.from(
      form.querySelectorAll("[data-consolidated-key]")
    );
    consolidatedRows.forEach((row) => {
      const key = row.getAttribute("data-consolidated-key");
      if (!key) return;
      const input = row.querySelector("[data-consolidated-label]");
      const fallback = (DEFAULT_CONFIG.consolidatedSeries || {})[key] || {};
      const value = input?.value?.trim() || fallback.label || key;
      consolidatedLabels.set(key, value);
    });

    const previewSeries = Array.from(
      form.querySelectorAll("[data-preview-series]")
    );
    previewSeries.forEach((cell) => {
      const key = cell.getAttribute("data-preview-series");
      cell.textContent = key ? seriesLabels.get(key) || key : "";
    });

    const previewConsolidated = Array.from(
      form.querySelectorAll("[data-preview-consolidated]")
    );
    previewConsolidated.forEach((cell) => {
      const key = cell.getAttribute("data-preview-consolidated");
      cell.textContent = key ? consolidatedLabels.get(key) || key : "";
    });
  };

  const applyConfigToForm = (config) => {
    const defaults = clone(DEFAULT_CONFIG);

    const rows = Array.from(form.querySelectorAll("[data-series-row]"));
    rows.forEach((row) => {
      const key = row.getAttribute("data-series-key");
      const serie = (config.series || []).find((item) => item.key === key) ||
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
      if (titleInput) titleInput.value = chartCfg.title || "";
      if (subtitleInput) subtitleInput.value = chartCfg.subtitle || "";
      if (enabledInput) enabledInput.checked = Boolean(chartCfg.enabled);
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
    if (legendPositionSelect)
      legendPositionSelect.value = config.legend?.position || "bottom";
    if (chartTypeSelect) chartTypeSelect.value = config.chart?.type || "bar";
    if (chartStackedToggle)
      chartStackedToggle.checked = Boolean(config.chart?.stacked);
    if (manualOnlyToggle) {
      manualOnlyToggle.checked = config.manualOnly === true;
      manualOnlyToggle.disabled = false;
    }
    updateManualOnlyState(config.manualOnly === true);
    renderSimpleCharts(config);
  };

  const readConfigFromForm = () => {
    const baseConfig = loadConfig();
    const draft = clone(baseConfig);
    const defaults = clone(DEFAULT_CONFIG);
    const series = [];
    const seriesRows = Array.from(form.querySelectorAll("[data-series-row]"));
    seriesRows.forEach((row) => {
      const key = row.getAttribute("data-series-key");
      if (!key) return;
      const labelInput = row.querySelector("[data-series-label]");
      const colorInput = row.querySelector("[data-series-color]");
      const enabledInput = row.querySelector("[data-series-enabled]");
      const fallback = (defaults.series || []).find((item) => item.key === key) || {};
      const label = labelInput?.value?.trim() || fallback.label || "";
      const color = colorInput?.value || fallback.color || "#0d47a1";
      const enabled = Boolean(enabledInput?.checked);
      series.push({ key, label, color, enabled });
    });

    const charts = {};
    const chartRows = Array.from(form.querySelectorAll("[data-chart-key]"));
    chartRows.forEach((row) => {
      const key = row.getAttribute("data-chart-key");
      if (!key) return;
      const titleInput = row.querySelector("[data-chart-title]");
      const subtitleInput = row.querySelector("[data-chart-subtitle]");
      const enabledInput = row.querySelector("[data-chart-enabled]");
      const fallback = (defaults.charts || {})[key] || {};
      const existing = baseConfig.charts?.[key] || {};
      charts[key] = {
        title: titleInput?.value?.trim() || fallback.title || "",
        subtitle: subtitleInput?.value?.trim() || fallback.subtitle || "",
        enabled: Boolean(enabledInput?.checked),
        chartType: normalizeChartType(
          existing.chartType,
          fallback.chartType || "inherit"
        ),
      };
    });
    if (chartRows.length === 0) {
      Object.assign(charts, clone(baseConfig.charts || defaults.charts || {}));
    }

    const consolidatedSeries = {};
    const consolidatedRows = Array.from(
      form.querySelectorAll("[data-consolidated-key]")
    );
    consolidatedRows.forEach((row) => {
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
    if (consolidatedRows.length === 0) {
      Object.assign(
        consolidatedSeries,
        clone(baseConfig.consolidatedSeries || defaults.consolidatedSeries || {})
      );
    }

    draft.version = DEFAULT_CONFIG.version;
    draft.series = series;
    draft.charts = charts;
    draft.consolidatedSeries = consolidatedSeries;
    draft.legend = {
      show: legendShowToggle ? legendShowToggle.checked : true,
      position: legendPositionSelect ? legendPositionSelect.value : "bottom",
    };
    draft.chart = {
      type: chartTypeSelect ? chartTypeSelect.value : "bar",
      stacked: chartStackedToggle ? chartStackedToggle.checked : false,
    };
    draft.manualOnly = manualOnlyToggle
      ? manualOnlyToggle.checked
      : baseConfig.manualOnly === true;

    let customCharts = Array.isArray(baseConfig.customCharts)
      ? clone(baseConfig.customCharts)
      : [];

    const seriesOverridesMap = new Map(
      series
        .map((serie) => {
          const key = String(serie?.key || "").trim();
          if (!key) return null;
          return [key, serie];
        })
        .filter(Boolean)
    );

    const syncChartSeriesOverrides = (chartSeries = []) => {
      if (!Array.isArray(chartSeries) || chartSeries.length === 0) return chartSeries;
      return chartSeries
        .map((serie) => {
          const key = String(serie?.key || "").trim();
          if (!key) return null;
          const override = seriesOverridesMap.get(key);
          if (!override) return serie;
          return {
            ...serie,
            label: override.label || serie.label,
            color: override.color || serie.color,
            enabled:
              typeof override.enabled === "boolean" ? override.enabled : serie.enabled,
          };
        })
        .filter(Boolean);
    };

    if (simpleChartsContainer) {
      customCharts = [];
      const existingCustomMap = new Map(
        (Array.isArray(baseConfig.customCharts) ? baseConfig.customCharts : [])
          .filter((chart) => chart?.id)
          .map((chart) => [String(chart.id), chart])
      );
      const cards = Array.from(
        simpleChartsContainer.querySelectorAll("[data-simple-chart-id]")
      );
      cards.forEach((card, index) => {
        const id =
          card.getAttribute("data-simple-chart-id") || buildCustomChartId();
        const baseChart = existingCustomMap.get(String(id)) || {};
        const nextChart = clone(baseChart);

        const titleInput = card.querySelector("[data-simple-title]");
        const subtitleInput = card.querySelector("[data-simple-subtitle]");
        const enabledInput = card.querySelector("[data-simple-enabled]");

        nextChart.id = id;
        nextChart.title =
          titleInput?.value?.trim() ||
          baseChart.title ||
          `Grafica ${index + 1}`;
        nextChart.subtitle = subtitleInput?.value?.trim() || baseChart.subtitle || "";
        nextChart.enabled =
          typeof enabledInput?.checked === "boolean"
            ? enabledInput.checked
            : baseChart.enabled !== false;

        const seriesMode = normalizeSeriesMode(
          baseChart?.seriesMode || card.getAttribute("data-simple-series-mode"),
          "columns"
        );
        const showRowColors = seriesMode === "rows";
        const baseRows = Array.isArray(baseChart?.rows) ? baseChart.rows : [];

        const rowNodes = Array.from(card.querySelectorAll("[data-simple-row=\"true\"]"));
        const rowNodeMap = new Map(
          rowNodes
            .map((node) => {
              const idx = Number(node.getAttribute("data-simple-row-index"));
              if (!Number.isFinite(idx)) return null;
              return [idx, node];
            })
            .filter(Boolean)
        );

        nextChart.rows = baseRows.map((row, rowIdx) => {
          const node = rowNodeMap.get(rowIdx);
          const aliasInput = node?.querySelector("[data-simple-row-alias]");
          const aliasValue = aliasInput?.value?.trim();
          const nextRow = { ...row };
          if (typeof aliasValue === "string" && aliasValue) {
            nextRow.alias = aliasValue;
          }
          if (showRowColors) {
            const colorInput = node?.querySelector("[data-simple-row-color]");
            const colorValue = colorInput?.value;
            if (typeof colorValue === "string" && colorValue.trim()) {
              nextRow.color = colorValue.trim();
            }
          }
          return nextRow;
        });

        if (Array.isArray(nextChart.series) && nextChart.series.length) {
          nextChart.series = syncChartSeriesOverrides(nextChart.series);
        }

        customCharts.push(nextChart);
      });
    } else if (manualChartsContainer) {
      customCharts = [];
      const existingCustomMap = new Map(
        (Array.isArray(baseConfig.customCharts) ? baseConfig.customCharts : [])
          .filter((chart) => chart?.id)
          .map((chart) => [String(chart.id), chart])
      );
      const cards = Array.from(
        manualChartsContainer.querySelectorAll("[data-manual-chart-id]")
      );
      cards.forEach((card, index) => {
        const id =
          card.getAttribute("data-manual-chart-id") || buildCustomChartId();
        const seriesMode = normalizeSeriesMode(
          card.getAttribute("data-manual-series-mode"),
          "columns"
        );
        const cdmxOnly = card.getAttribute("data-manual-cdmx-only") === "true";
        const moduleSelect = card.querySelector("[data-manual-module]");
        const titleInput = card.querySelector("[data-manual-title]");
        const subtitleInput = card.querySelector("[data-manual-subtitle]");
        const typeSelect = card.querySelector("[data-manual-type]");
        const sourceSelect = card.querySelector("[data-manual-source]");
        const rowsInput = card.querySelector("[data-manual-rows]");
        const enabledInput = card.querySelector("[data-manual-enabled]");
        const seriesInputs = Array.from(
          card.querySelectorAll("[data-manual-series] input[type=\"checkbox\"]")
        );

        const seriesKeys = seriesInputs
          .filter((input) => input.checked)
          .map((input) => input.getAttribute("data-series-key"))
          .filter(Boolean);
        const moduleValue = normalizeModuleValue(
          moduleSelect?.value,
          "RESUMEN"
        );
        const optionMap = new Map(
          getSeriesOptionsForModule(moduleValue)
            .map((item) => [String(item?.key || "").trim(), item])
            .filter(([key]) => Boolean(key))
        );
        const existingSeriesMap = new Map(
          (Array.isArray(existingCustomMap.get(String(id))?.series)
            ? existingCustomMap.get(String(id)).series
            : []
          )
            .map((item) => [String(item?.key || "").trim(), item])
            .filter(([key]) => Boolean(key))
        );
        const series = seriesKeys.map((key) => {
          const existing = existingSeriesMap.get(key) || {};
          const fallback = optionMap.get(key) || {};
          return {
            key,
            label:
              (typeof existing.label === "string" && existing.label.trim()
                ? existing.label.trim()
                : null) ||
              (typeof fallback.label === "string" && fallback.label.trim()
                ? fallback.label.trim()
                : key),
            color:
              (typeof existing.color === "string" && existing.color.trim()
                ? existing.color.trim()
                : null) ||
              (typeof fallback.color === "string" && fallback.color.trim()
                ? fallback.color.trim()
                : "#0d47a1"),
            enabled:
              typeof existing.enabled === "boolean"
                ? existing.enabled
                : fallback.enabled !== false,
          };
        });

        const rows = parseCustomRows(rowsInput?.value || "");

        customCharts.push({
          id,
          module: moduleValue,
          title: titleInput?.value?.trim() || `Grafica manual ${index + 1}`,
          subtitle: subtitleInput?.value?.trim() || "",
          chartType: normalizeChartType(typeSelect?.value, "inherit"),
          sourceType: normalizeSourceType(sourceSelect?.value, "snapshot"),
          enabled: Boolean(enabledInput?.checked),
          seriesMode,
          cdmxOnly,
          seriesKeys,
          series,
          rows,
        });
      });
    }
    draft.customCharts = customCharts;

    const defaultIds = new Set(
      (Array.isArray(DEFAULT_CONFIG.customCharts)
        ? DEFAULT_CONFIG.customCharts
        : [])
        .map((chart) => canonicalizeChartId(chart?.id))
        .filter(Boolean)
    );
    const existingIds = new Set(
      (Array.isArray(baseConfig.customCharts) ? baseConfig.customCharts : [])
        .map((chart) => canonicalizeChartId(chart?.id))
        .filter(Boolean)
    );
    const newIds = new Set(
      customCharts.map((chart) => canonicalizeChartId(chart?.id)).filter(Boolean)
    );
    let deletedIds = Array.isArray(baseConfig.deletedChartIds)
      ? [...baseConfig.deletedChartIds]
      : [];
    deletedIds = deletedIds.filter(
      (id) => !newIds.has(canonicalizeChartId(id))
    );
    existingIds.forEach((id) => {
      if (defaultIds.has(id) && !newIds.has(id)) {
        deletedIds.push(id);
      }
    });
    draft.deletedChartIds = normalizeDeletedChartIds(deletedIds);
    return draft;
  };

  const validateConfig = (config) => {
    const enabledSeries = (config.series || []).filter((serie) => serie.enabled);
    if (enabledSeries.length === 0) {
      return "Selecciona al menos una serie activa.";
    }
    if (config.manualOnly === true) {
      const manualCharts = Array.isArray(config.customCharts)
        ? config.customCharts
        : [];
      const hasManual = manualCharts.some(
        (chart) =>
          chart?.enabled !== false &&
          Array.isArray(chart?.rows) &&
          chart.rows.length > 0
      );
      if (!hasManual) {
        return "Agrega al menos una grafica manual con filas.";
      }
    }
    return null;
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
    const saved = saveConfig(draft);
    applyConfigToForm(saved);
    setStatus("Configuracion guardada. Recarga la vista de graficas.", "success");
    if (saveBtn) saveBtn.disabled = false;
  };

  const handleReset = () => {
    const confirmado = window.confirm(
      "Restaurar la configuracion por defecto?"
    );
    if (!confirmado) return;
    const restored = resetConfig();
    applyConfigToForm(restored);
    setStatus("Configuracion restaurada a valores por defecto.", "success");
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    handleSave();
  });

  form.addEventListener("input", (event) => {
    const target = event.target;
    if (!target) return;
    if (
      target.matches("[data-series-label]") ||
      target.matches("[data-series-color]") ||
      target.matches("[data-series-enabled]")
    ) {
      refreshSimpleChartsColumns();
    }
  });

  if (simpleChartsContainer) {
    simpleChartsContainer.addEventListener("input", (event) => {
      const target = event.target;
      if (!target) return;
      const card = target.closest("[data-simple-chart-id]");
      if (!card) return;
      if (target.matches("[data-simple-title]")) {
        const preview = card.querySelector("[data-simple-title-preview]");
        if (preview) preview.textContent = target.value?.trim() || "Grafica";
      }
      if (target.matches("[data-simple-subtitle]")) {
        const preview = card.querySelector("[data-simple-subtitle-preview]");
        if (preview) preview.textContent = target.value?.trim() || "";
      }
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", (event) => {
      event.preventDefault();
      handleReset();
    });
  }

  if (manualOnlyToggle) {
    manualOnlyToggle.disabled = false;
    manualOnlyToggle.addEventListener("change", () => {
      updateManualOnlyState(manualOnlyToggle.checked);
    });
  }

  if (manualAddBtn && manualChartsContainer) {
    manualAddBtn.addEventListener("click", (event) => {
      event.preventDefault();
      const nextIndex = manualChartsContainer.children.length;
      const chart = {
        id: buildCustomChartId(),
        module: "RESUMEN",
        title: `Grafica manual ${nextIndex + 1}`,
        subtitle: "",
        chartType: "inherit",
        sourceType: "snapshot",
        enabled: true,
        seriesKeys: [],
        rows: [],
      };
      const card = buildManualChartCard(chart, nextIndex);
      manualChartsContainer.appendChild(card);
      updateManualChartsEmptyState();
    });
  }

  if (manualChartsContainer) {
    manualChartsContainer.addEventListener("click", (event) => {
      const target = event.target;
      if (!target) return;
      if (target.matches("[data-manual-remove]")) {
        event.preventDefault();
        const card = target.closest("[data-manual-chart-id]");
        if (card) {
          card.remove();
          updateManualChartsEmptyState();
        }
      }
    });

    manualChartsContainer.addEventListener("change", (event) => {
      const target = event.target;
      if (!target) return;
      if (target.matches("[data-manual-module]")) {
        const card = target.closest("[data-manual-chart-id]");
        if (!card) return;
        const seriesContainer = card.querySelector("[data-manual-series]");
        if (!seriesContainer) return;
        const selectedKeys = Array.from(
          seriesContainer.querySelectorAll("input[type=\"checkbox\"]:checked")
        )
          .map((input) => input.getAttribute("data-series-key"))
          .filter(Boolean);
        const options = getSeriesOptionsForModule(target.value);
        renderSeriesOptions(seriesContainer, options, selectedKeys);
        updateManualSourceHint(card);
        return;
      }
      if (target.matches("[data-manual-source]")) {
        const card = target.closest("[data-manual-chart-id]");
        if (!card) return;
        updateManualSourceHint(card);
      }
    });
  }

  if (!isAdmin()) {
    if (fieldset) fieldset.disabled = true;
    if (warningEl) warningEl.classList.remove("d-none");
    setStatus("Acceso restringido a administradores.", "danger");
    return;
  }

  const configInicial = loadConfig();
  applyConfigToForm(configInicial);
  setStatus("Listo para editar.", "muted");
})();
