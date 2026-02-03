(() => {
  const STORAGE_KEY = "graficas_config_v1";
  const API_BASE = (() => {
    if (window.location.protocol === "file:") {
      return "http://localhost:3005/api";
    }
    return `${window.location.origin.replace(/\/$/, "")}/api`;
  })();
  const API_ENDPOINT = `${API_BASE}/graficas-config`;
  const EVENT_CONFIG_UPDATED = "graficas-config-updated";
  const DEFAULT_CONFIG = {
    version: 4,
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
        label: "Real acumulado AA",
        color: "#94a3b8",
        enabled: true,
      },
    ],
    charts: {
      operating: {
        enabled: true,
        title: "Resultado Operativo por Capitulo",
        subtitle: "Real Acum / Ppto. Acum / Real Acum AA",
        chartType: "inherit",
      },
      net: {
        enabled: true,
        title: "Resumen Neto por Capitulo",
        subtitle: "Real Acum / Ppto. Acum / Real Acum AA",
        chartType: "inherit",
      },
      consolidated: {
        enabled: true,
        title: "Consolidados Operativos vs Netos",
        subtitle: "Real Acum / Ppto. Acum / Real Acum AA",
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
    customCharts: [],
  };

  const clone = (value) => JSON.parse(JSON.stringify(value));

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
    if (["snapshot", "mensual", "custom"].includes(clean)) return clean;
    return fallback;
  };

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
      const chartType =
        normalizeChartType(chart?.chartType, "inherit");
      const enabled = typeof chart?.enabled === "boolean" ? chart.enabled : true;
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
          return { alias, variants: cleaned };
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
              const key =
                serie?.key != null ? String(serie.key).trim() : "";
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
        sourceType,
        seriesKeys: mergedSeriesKeys,
        series,
        rows: normalizedRows,
      };
    });
  };

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

    // Flujo 100% manual: no se permite volver al modo automático.
    base.manualOnly = true;

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

    // Migración: al entrar a versión 4 se limpian gráficas anteriores.
    if (!resetToManualFlow && Array.isArray(config.customCharts)) {
      base.customCharts = normalizeCustomCharts(config.customCharts);
    } else {
      base.customCharts = [];
    }

    return base;
  };

  const obtenerHeadersAuth = () => {
    if (window.Sesion && typeof window.Sesion.headersAutenticacion === "function") {
      return window.Sesion.headersAutenticacion();
    }
    return {};
  };

  const dispatchConfigUpdate = (config, source) => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent(EVENT_CONFIG_UPDATED, {
        detail: {
          config: clone(config),
          source,
        },
      })
    );
  };

  let cachedConfig = null;
  let loadedFromServer = false;
  let loadingPromise = null;

  const loadLocalConfig = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return normalizeConfig(JSON.parse(raw));
    } catch (error) {
      return null;
    }
  };

  const persistLocalConfig = (config) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (error) {
      /* ignore */
    }
  };

  const fetchServerConfig = async () => {
    const response = await fetch(API_ENDPOINT, {
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

  const saveServerConfig = async (config) => {
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...obtenerHeadersAuth(),
      },
      credentials: "include",
      body: JSON.stringify({ config }),
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

  const resetServerConfig = async () => {
    const response = await fetch(API_ENDPOINT, {
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

  const hydrateConfigFromServer = () => {
    if (loadedFromServer) return;
    loadedFromServer = true;
    loadingPromise = fetchServerConfig()
      .then((serverConfig) => {
        if (!serverConfig) return;
        cachedConfig = clone(serverConfig);
        persistLocalConfig(cachedConfig);
        dispatchConfigUpdate(cachedConfig, "server");
      })
      .catch((error) => {
        console.warn("GraficasConfig: sin respuesta del servidor.", error);
      })
      .finally(() => {
        loadingPromise = null;
      });
  };

  const loadConfig = () => {
    if (!cachedConfig) {
      const localConfig = loadLocalConfig();
      cachedConfig = localConfig ? clone(localConfig) : clone(DEFAULT_CONFIG);
      hydrateConfigFromServer();
    }
    return clone(cachedConfig);
  };

  const saveConfig = (config) => {
    const normalized = normalizeConfig(config);
    cachedConfig = clone(normalized);
    persistLocalConfig(cachedConfig);
    dispatchConfigUpdate(cachedConfig, "local");
    saveServerConfig(normalized)
      .then((serverConfig) => {
        if (!serverConfig) return;
        cachedConfig = clone(serverConfig);
        persistLocalConfig(cachedConfig);
        dispatchConfigUpdate(cachedConfig, "server");
      })
      .catch((error) => {
        console.warn("GraficasConfig: no se pudo guardar en servidor.", error);
      });
    return clone(cachedConfig);
  };

  const resetConfig = () => {
    cachedConfig = clone(DEFAULT_CONFIG);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      /* ignore */
    }
    dispatchConfigUpdate(cachedConfig, "local");
    resetServerConfig()
      .then(() => {
        dispatchConfigUpdate(cachedConfig, "server");
      })
      .catch((error) => {
        console.warn("GraficasConfig: no se pudo restaurar en servidor.", error);
      });
    return clone(cachedConfig);
  };

  const hasSaved = () => {
    try {
      return Boolean(localStorage.getItem(STORAGE_KEY));
    } catch (error) {
      return false;
    }
  };

  window.GraficasConfig = {
    storageKey: STORAGE_KEY,
    defaults: clone(DEFAULT_CONFIG),
    load: loadConfig,
    save: saveConfig,
    reset: resetConfig,
    normalize: normalizeConfig,
    hasSaved,
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

  const MODULE_OPTIONS = [
    "RESUMEN",
    "SUMMARY",
    "Finanzas",
    "Gastos Generales",
    "Nomina",
    "Membresia",
    "Serv Membresia",
    "RH",
    "Eventos",
    "Comites",
    "Comunicacion",
    "Direccion",
    "Gtos Corporativos",
    "T&IC",
    "VPE",
    "Presupuestos",
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
    const hasValue =
      value &&
      Array.from(select.options).some((option) => option.value === value);
    if (value && !hasValue) {
      const customOption = document.createElement("option");
      customOption.value = value;
      customOption.textContent = value;
      select.appendChild(customOption);
    }
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
    if (!rows.length) return (defaults.series || []).slice();
    return rows
      .map((row) => {
        const key = row.getAttribute("data-series-key");
        if (!key) return null;
        const fallback =
          (defaults.series || []).find((item) => item.key === key) || {};
        const labelInput = row.querySelector("[data-series-label]");
        const colorInput = row.querySelector("[data-series-color]");
        const enabledInput = row.querySelector("[data-series-enabled]");
        return {
          key,
          label: labelInput?.value?.trim() || fallback.label || key,
          color: colorInput?.value || fallback.color || "#0d47a1",
          enabled:
            typeof enabledInput?.checked === "boolean"
              ? enabledInput.checked
              : fallback.enabled !== false,
        };
      })
      .filter(Boolean);
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
    const moduleKey = (moduleValue || "RESUMEN").toString().trim().toUpperCase();
    if (moduleKey === "RESUMEN" || moduleKey === "SUMMARY") {
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
    const forced = manualOnly !== false;
    form.setAttribute("data-manual-only", forced ? "true" : "false");
  };

  const updateManualChartsEmptyState = () => {
    if (!manualChartsEmpty || !manualChartsContainer) return;
    const hasCharts = manualChartsContainer.children.length > 0;
    manualChartsEmpty.classList.toggle("d-none", hasCharts);
  };

  const buildManualChartCard = (chart, index) => {
    const chartId = chart?.id || buildCustomChartId();
    const moduleValue = chart?.module || "RESUMEN";
    const title = chart?.title || `Grafica manual ${index + 1}`;
    const subtitle = chart?.subtitle || "";
    const chartType = chart?.chartType || "inherit";
    const sourceType = chart?.sourceType || "snapshot";
    const enabled = chart?.enabled !== false;
    const seriesKeys = Array.isArray(chart?.seriesKeys)
      ? chart.seriesKeys
      : Array.isArray(chart?.series)
      ? chart.series.map((serie) => serie?.key).filter(Boolean)
      : [];
    const rowsText = formatCustomRows(chart?.rows || []);

    const wrapper = document.createElement("div");
    wrapper.className = "manual-chart-card";
    wrapper.setAttribute("data-manual-chart-id", chartId);
    wrapper.innerHTML = `
      <div class="d-flex flex-column flex-lg-row align-items-start justify-content-between gap-2 mb-3">
        <div>
          <h3 class="h6 mb-1">Grafica manual</h3>
          <p class="text-muted small mb-0">Define modulo, filas y columnas.</p>
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
          <label class="form-label small fw-semibold">Fuente</label>
          <select class="form-select form-select-sm" data-manual-source>
            <option value="snapshot">Snapshot</option>
            <option value="mensual">Mensual</option>
          </select>
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
        <label class="form-label small fw-semibold">Filas (una por linea)</label>
        <textarea class="form-control form-control-sm" rows="4" data-manual-rows></textarea>
        <div class="form-text">
          Usa formato: Alias=VAR1 | VAR2. Si no hay alias, usa solo VAR1 | VAR2.
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
      manualOnlyToggle.checked = true;
      manualOnlyToggle.disabled = true;
    }
    updateManualOnlyState(true);
    renderManualCharts(config);
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
    draft.manualOnly = true;

    const customCharts = [];
    if (manualChartsContainer) {
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
        const moduleValue = moduleSelect?.value || "RESUMEN";
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
          seriesKeys,
          series,
          rows,
        });
      });
    }
    draft.customCharts = customCharts;
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

  if (resetBtn) {
    resetBtn.addEventListener("click", (event) => {
      event.preventDefault();
      handleReset();
    });
  }

  if (manualOnlyToggle) {
    manualOnlyToggle.checked = true;
    manualOnlyToggle.disabled = true;
    manualOnlyToggle.addEventListener("change", () => {
      manualOnlyToggle.checked = true;
      updateManualOnlyState(true);
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
