(() => {
  const STORAGE_KEY = "graficas_config_v1";
  const DEFAULT_CONFIG = {
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
      },
      net: {
        enabled: true,
        title: "Resumen Neto por Capitulo",
        subtitle: "Real Acum / Ppto. Acum / Real Acum AA",
      },
      consolidated: {
        enabled: true,
        title: "Consolidados Operativos vs Netos",
        subtitle: "Real Acum / Ppto. Acum / Real Acum AA",
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

  const normalizeConfig = (config = {}) => {
    const base = clone(DEFAULT_CONFIG);
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
          base.gastosGenerales.charts[key].series = normalizeSeriesMap(
            base.gastosGenerales.charts[key].series,
            chartOverride.series
          );
        });
      }
    }

    return base;
  };

  const loadConfig = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return clone(DEFAULT_CONFIG);
      return normalizeConfig(JSON.parse(raw));
    } catch (error) {
      return clone(DEFAULT_CONFIG);
    }
  };

  const saveConfig = (config) => {
    const normalized = normalizeConfig(config);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    } catch (error) {
      /* ignore */
    }
    return normalized;
  };

  const resetConfig = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      /* ignore */
    }
    return clone(DEFAULT_CONFIG);
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
      charts[key] = {
        title: titleInput?.value?.trim() || fallback.title || "",
        subtitle: subtitleInput?.value?.trim() || fallback.subtitle || "",
        enabled: Boolean(enabledInput?.checked),
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
    return draft;
  };

  const validateConfig = (config) => {
    const enabledSeries = (config.series || []).filter((serie) => serie.enabled);
    if (enabledSeries.length === 0) {
      return "Selecciona al menos una serie activa.";
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
