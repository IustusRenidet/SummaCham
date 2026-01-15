(() => {
  const STORAGE_KEY = "graficas_config_v1";
  const DEFAULT_CONFIG = {
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
  };

  const clone = (value) => JSON.parse(JSON.stringify(value));

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

    return {
      version: 1,
      series,
      charts,
      consolidatedSeries,
      legend: {
        show: legendShowToggle ? legendShowToggle.checked : true,
        position: legendPositionSelect ? legendPositionSelect.value : "bottom",
      },
      chart: {
        type: chartTypeSelect ? chartTypeSelect.value : "bar",
        stacked: chartStackedToggle ? chartStackedToggle.checked : false,
      },
    };
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
