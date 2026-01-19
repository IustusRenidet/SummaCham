(() => {
  const form = document.getElementById("plantillasGraficasForm");
  if (!form) return;

  const fieldset = document.getElementById("plantillasGraficasFieldset");
  const statusEl = document.getElementById("plantillasGraficasStatus");
  const warningEl = document.getElementById("plantillasGraficasWarning");
  const saveBtn = document.getElementById("plantillasGraficasSave");
  const resetBtn = document.getElementById("plantillasGraficasReset");
  const legendShowToggle = document.getElementById("plantillasLegendShowToggle");
  const legendPositionSelect = document.getElementById(
    "plantillasLegendPosition"
  );
  const chartTypeSelect = document.getElementById("plantillasChartType");
  const chartStackedToggle = document.getElementById("plantillasChartStacked");
  const customList = document.getElementById("plantillasGraficasCustomList");
  const customTemplate = document.getElementById(
    "plantillasGraficasCustomTemplate"
  );
  const customAddBtn = document.getElementById("plantillasGraficasAddCustom");
  const moduloSelect = document.getElementById("moduloSelect");

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

  const clone = (value) => JSON.parse(JSON.stringify(value || {}));

  const getModuloOptions = () => {
    if (moduloSelect) return moduloSelect.innerHTML;
    return [
      '<option value="RESUMEN">RESUMEN</option>',
      '<option value="SUMMARY">SUMMARY</option>',
      '<option value="Finanzas">Finanzas</option>',
      '<option value="Gastos Generales">Gastos Generales</option>',
      '<option value="Nomina">Nomina</option>',
      '<option value="Membresia">Membresia</option>',
      '<option value="Serv Membresia">Serv Membresia</option>',
      '<option value="RH">RH</option>',
      '<option value="Eventos">Eventos</option>',
      '<option value="Comites">Comites</option>',
      '<option value="Comunicacion">Comunicacion</option>',
      '<option value="Direccion">Direccion</option>',
      '<option value="Gtos Corporativos">Gtos Corporativos</option>',
      '<option value="T&IC">T&IC</option>',
      '<option value="VPE">VPE</option>',
    ].join("");
  };

  const applyModuloOptions = (select, value) => {
    if (!select) return;
    select.innerHTML = getModuloOptions();
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
        const alias = (row?.alias || "").trim();
        const raw = cleaned.join("|");
        if (alias && alias !== cleaned[0]) {
          return `${alias}=${raw}`;
        }
        return raw;
      })
      .filter(Boolean)
      .join("\n");
  };

  const parseVariantsList = (text) => {
    if (!text) return [];
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .flatMap((line) => {
        let raw = line;
        if (line.includes("=")) {
          const parts = line.split(/=(.+)/);
          raw = (parts[1] || "").trim();
        }
        return raw.split("|");
      })
      .map((item) => item.trim())
      .filter(Boolean);
  };

  const formatVariantsList = (variants) => {
    if (!Array.isArray(variants)) return "";
    return variants
      .map((item) => (item || "").trim())
      .filter(Boolean)
      .join(" | ");
  };

  const parseSummaryRows = (text) =>
    parseCustomRows(text).map((row) => ({
      label: row.alias,
      variants: row.variants,
    }));

  const formatSummaryRows = (rows) => {
    if (!Array.isArray(rows)) return "";
    return formatCustomRows(
      rows.map((row) => ({
        alias: row.label || row.alias || "",
        variants: Array.isArray(row.variants) ? row.variants : [],
      }))
    );
  };

  const renderCustomChartItem = (chart = {}) => {
    if (!customTemplate || !customList) return null;
    const node = customTemplate.content.firstElementChild.cloneNode(true);
    const id = chart.id || buildCustomChartId();
    node.dataset.customId = id;
    const titleInput = node.querySelector("[data-custom-title]");
    const subtitleInput = node.querySelector("[data-custom-subtitle]");
    const moduleSelect = node.querySelector("[data-custom-module]");
    const typeSelect = node.querySelector("[data-custom-type]");
    const rowsInput = node.querySelector("[data-custom-rows]");
    const enabledInput = node.querySelector("[data-custom-enabled]");
    const removeBtn = node.querySelector("[data-custom-remove]");

    if (titleInput) titleInput.value = chart.title || "";
    if (subtitleInput) subtitleInput.value = chart.subtitle || "";
    if (moduleSelect) {
      applyModuloOptions(moduleSelect, chart.module || "RESUMEN");
    }
    if (typeSelect) typeSelect.value = chart.chartType || "inherit";
    if (rowsInput) rowsInput.value = formatCustomRows(chart.rows);
    if (enabledInput) enabledInput.checked = chart.enabled !== false;

    if (removeBtn) {
      removeBtn.addEventListener("click", () => {
        node.remove();
      });
    }

    customList.appendChild(node);
    return node;
  };

  const getGraficasConfigApi = () => {
    if (!window.GraficasConfig || typeof window.GraficasConfig.load !== "function") {
      return null;
    }
    return window.GraficasConfig;
  };

  const applyConfigToForm = (config) => {
    if (!config) return;
    const defaults = clone(getGraficasConfigApi()?.defaults || {});
    const sources = config.sources || {};
    const defaultSources = defaults.sources || {};
    const summarySources = sources.summary || defaultSources.summary || {};
    const consolidatedSources =
      sources.consolidated || defaultSources.consolidated || {};
    const ingresoSources = sources.ingreso || defaultSources.ingreso || {};
    const ingresoNacionalSources =
      sources.ingresoNacional || defaultSources.ingresoNacional || {};

    const rows = Array.from(form.querySelectorAll("[data-series-row]"));
    rows.forEach((row) => {
      const key = row.getAttribute("data-series-key");
      const serie =
        (config.series || []).find((item) => item.key === key) ||
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
    if (legendPositionSelect) {
      legendPositionSelect.value = config.legend?.position || "bottom";
    }
    if (chartTypeSelect) chartTypeSelect.value = config.chart?.type || "bar";
    if (chartStackedToggle) {
      chartStackedToggle.checked = Boolean(config.chart?.stacked);
    }

    const ingresoEnabled = form.querySelector("[data-ingreso-enabled]");
    const ingresoTitle = form.querySelector("[data-ingreso-title]");
    const ingresoSubtitle = form.querySelector("[data-ingreso-subtitle]");
    if (ingresoEnabled) {
      ingresoEnabled.checked = config.ingreso?.enabled !== false;
    }
    if (ingresoTitle) ingresoTitle.value = config.ingreso?.title || "";
    if (ingresoSubtitle) ingresoSubtitle.value = config.ingreso?.subtitle || "";
    form
      .querySelectorAll("[data-ingreso-series-row]")
      .forEach((row) => {
        const key = row.getAttribute("data-ingreso-series-key");
        const serie =
          (config.ingreso?.series || {})[key] ||
          (defaults.ingreso?.series || {})[key];
        if (!serie) return;
        const labelInput = row.querySelector("[data-ingreso-series-label]");
        const colorInput = row.querySelector("[data-ingreso-series-color]");
        const enabledInput = row.querySelector("[data-ingreso-series-enabled]");
        const sourcesInput = row.querySelector("[data-ingreso-series-sources]");
        if (labelInput) labelInput.value = serie.label || "";
        if (colorInput) colorInput.value = serie.color || "#0d47a1";
        if (enabledInput) enabledInput.checked = Boolean(serie.enabled);
        if (sourcesInput) {
          const variants =
            ingresoSources[key] || defaultSources.ingreso?.[key] || [];
          sourcesInput.value = formatVariantsList(variants);
        }
      });

    const ingresoNacionalEnabled = form.querySelector(
      "[data-ingreso-nacional-enabled]"
    );
    const ingresoNacionalTitle = form.querySelector(
      "[data-ingreso-nacional-title]"
    );
    const ingresoNacionalSubtitle = form.querySelector(
      "[data-ingreso-nacional-subtitle]"
    );
    if (ingresoNacionalEnabled) {
      ingresoNacionalEnabled.checked =
        config.ingresoNacional?.enabled !== false;
    }
    if (ingresoNacionalTitle) {
      ingresoNacionalTitle.value = config.ingresoNacional?.title || "";
    }
    if (ingresoNacionalSubtitle) {
      ingresoNacionalSubtitle.value = config.ingresoNacional?.subtitle || "";
    }
    form
      .querySelectorAll("[data-ingreso-nacional-series-row]")
      .forEach((row) => {
        const key = row.getAttribute("data-ingreso-nacional-series-key");
        const serie =
          (config.ingresoNacional?.series || {})[key] ||
          (defaults.ingresoNacional?.series || {})[key];
        if (!serie) return;
        const labelInput = row.querySelector(
          "[data-ingreso-nacional-series-label]"
        );
        const colorInput = row.querySelector(
          "[data-ingreso-nacional-series-color]"
        );
        const enabledInput = row.querySelector(
          "[data-ingreso-nacional-series-enabled]"
        );
        const sourcesInput = row.querySelector(
          "[data-ingreso-nacional-series-sources]"
        );
        if (labelInput) labelInput.value = serie.label || "";
        if (colorInput) colorInput.value = serie.color || "#0d47a1";
        if (enabledInput) enabledInput.checked = Boolean(serie.enabled);
        if (sourcesInput) {
          const variants =
            ingresoNacionalSources[key] ||
            defaultSources.ingresoNacional?.[key] ||
            [];
          sourcesInput.value = formatVariantsList(variants);
        }
      });

    form.querySelectorAll("[data-summary-rows]").forEach((input) => {
      const key = input.getAttribute("data-summary-key");
      const type = input.getAttribute("data-summary-type");
      if (!key || !type) return;
      const rows =
        summarySources?.[key]?.[type] ||
        defaultSources.summary?.[key]?.[type] ||
        [];
      input.value = formatSummaryRows(rows);
    });

    form.querySelectorAll("[data-consolidated-source]").forEach((input) => {
      const key = input.getAttribute("data-consolidated-source-key");
      if (!key) return;
      const row =
        consolidatedSources?.[key] ||
        defaultSources.consolidated?.[key] ||
        {};
      const variants = Array.isArray(row?.variants) ? row.variants : [];
      input.value = formatVariantsList(variants);
    });

    const operativoEnabled = form.querySelector("[data-operativo-enabled]");
    const operativoTitle = form.querySelector("[data-operativo-title]");
    if (operativoEnabled) {
      operativoEnabled.checked = config.operativo?.enabled !== false;
    }
    if (operativoTitle) operativoTitle.value = config.operativo?.title || "";
    form
      .querySelectorAll("[data-operativo-series-row]")
      .forEach((row) => {
        const key = row.getAttribute("data-operativo-series-key");
        const serie =
          (config.operativo?.datasets || {})[key] ||
          (defaults.operativo?.datasets || {})[key];
        if (!serie) return;
        const labelInput = row.querySelector("[data-operativo-series-label]");
        const colorInput = row.querySelector("[data-operativo-series-color]");
        const enabledInput = row.querySelector("[data-operativo-series-enabled]");
        if (labelInput) labelInput.value = serie.label || "";
        if (colorInput) colorInput.value = serie.color || "#0d47a1";
        if (enabledInput) enabledInput.checked = Boolean(serie.enabled);
      });

    const ggEnabled = form.querySelector("[data-gg-enabled]");
    const ggSubtitle = form.querySelector("[data-gg-subtitle]");
    if (ggEnabled) ggEnabled.checked = config.gastosGenerales?.enabled !== false;
    if (ggSubtitle) {
      ggSubtitle.value = config.gastosGenerales?.subtitleTemplate || "";
    }

    const ggCharts = Array.from(form.querySelectorAll("[data-gg-chart-key]"));
    ggCharts.forEach((chart) => {
      const key = chart.getAttribute("data-gg-chart-key");
      const chartCfg =
        (config.gastosGenerales?.charts || {})[key] ||
        (defaults.gastosGenerales?.charts || {})[key];
      if (!chartCfg) return;
      const titleInput = chart.querySelector("[data-gg-chart-title]");
      const enabledInput = chart.querySelector("[data-gg-chart-enabled]");
      if (titleInput) titleInput.value = chartCfg.title || "";
      if (enabledInput) enabledInput.checked = Boolean(chartCfg.enabled);
      chart.querySelectorAll("[data-gg-series-row]").forEach((row) => {
        const serieKey = row.getAttribute("data-gg-series-key");
        const serie =
          (chartCfg.series || {})[serieKey] ||
          (defaults.gastosGenerales?.charts?.[key]?.series || {})[serieKey];
        if (!serie) return;
        const labelInput = row.querySelector("[data-gg-series-label]");
        const colorInput = row.querySelector("[data-gg-series-color]");
        const enabledInput = row.querySelector("[data-gg-series-enabled]");
        if (labelInput) labelInput.value = serie.label || "";
        if (colorInput) colorInput.value = serie.color || "#0d47a1";
        if (enabledInput) enabledInput.checked = Boolean(serie.enabled);
      });
    });

    if (customList) {
      customList.innerHTML = "";
      const customCharts = Array.isArray(config.customCharts)
        ? config.customCharts
        : Array.isArray(defaults.customCharts)
        ? defaults.customCharts
        : [];
      customCharts.forEach((chart) => renderCustomChartItem(chart));
    }
  };

  const readConfigFromForm = () => {
    const api = getGraficasConfigApi();
    const baseConfig = clone(api?.load?.() || {});
    const defaults = clone(api?.defaults || {});
    const sources = clone(baseConfig.sources || defaults.sources || {});

    const series = [];
    form.querySelectorAll("[data-series-row]").forEach((row) => {
      const key = row.getAttribute("data-series-key");
      if (!key) return;
      const labelInput = row.querySelector("[data-series-label]");
      const colorInput = row.querySelector("[data-series-color]");
      const enabledInput = row.querySelector("[data-series-enabled]");
      const fallback =
        (defaults.series || []).find((item) => item.key === key) || {};
      series.push({
        key,
        label: labelInput?.value?.trim() || fallback.label || "",
        color: colorInput?.value || fallback.color || "#0d47a1",
        enabled: Boolean(enabledInput?.checked),
      });
    });

    const charts = {};
    form.querySelectorAll("[data-chart-key]").forEach((row) => {
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
    form.querySelectorAll("[data-consolidated-key]").forEach((row) => {
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

    const ingresoSeries = {};
    const ingresoSources = {};
    form.querySelectorAll("[data-ingreso-series-row]").forEach((row) => {
      const key = row.getAttribute("data-ingreso-series-key");
      if (!key) return;
      const labelInput = row.querySelector("[data-ingreso-series-label]");
      const colorInput = row.querySelector("[data-ingreso-series-color]");
      const enabledInput = row.querySelector("[data-ingreso-series-enabled]");
      const sourcesInput = row.querySelector("[data-ingreso-series-sources]");
      const fallback = (defaults.ingreso?.series || {})[key] || {};
      ingresoSeries[key] = {
        label: labelInput?.value?.trim() || fallback.label || "",
        color: colorInput?.value || fallback.color || "#0d47a1",
        enabled: Boolean(enabledInput?.checked),
      };
      ingresoSources[key] = parseVariantsList(sourcesInput?.value || "");
    });

    const ingresoNacionalSeries = {};
    const ingresoNacionalSources = {};
    form.querySelectorAll("[data-ingreso-nacional-series-row]").forEach((row) => {
      const key = row.getAttribute("data-ingreso-nacional-series-key");
      if (!key) return;
      const labelInput = row.querySelector("[data-ingreso-nacional-series-label]");
      const colorInput = row.querySelector("[data-ingreso-nacional-series-color]");
      const enabledInput = row.querySelector(
        "[data-ingreso-nacional-series-enabled]"
      );
      const sourcesInput = row.querySelector(
        "[data-ingreso-nacional-series-sources]"
      );
      const fallback = (defaults.ingresoNacional?.series || {})[key] || {};
      ingresoNacionalSeries[key] = {
        label: labelInput?.value?.trim() || fallback.label || "",
        color: colorInput?.value || fallback.color || "#0d47a1",
        enabled: Boolean(enabledInput?.checked),
      };
      ingresoNacionalSources[key] = parseVariantsList(
        sourcesInput?.value || ""
      );
    });

    const summarySources = sources.summary || {};
    form.querySelectorAll("[data-summary-rows]").forEach((input) => {
      const key = input.getAttribute("data-summary-key");
      const type = input.getAttribute("data-summary-type");
      if (!key || !type) return;
      if (!summarySources[key]) summarySources[key] = {};
      summarySources[key][type] = parseSummaryRows(input.value || "");
    });
    sources.summary = summarySources;

    const consolidatedSources = sources.consolidated || {};
    form.querySelectorAll("[data-consolidated-source]").forEach((input) => {
      const key = input.getAttribute("data-consolidated-source-key");
      if (!key) return;
      const fallback =
        consolidatedSources[key] || defaults.sources?.consolidated?.[key] || {};
      consolidatedSources[key] = {
        label: fallback.label || "",
        variants: parseVariantsList(input.value || ""),
      };
    });
    sources.consolidated = consolidatedSources;
    sources.ingreso = ingresoSources;
    sources.ingresoNacional = ingresoNacionalSources;

    const operativoDatasets = {};
    form.querySelectorAll("[data-operativo-series-row]").forEach((row) => {
      const key = row.getAttribute("data-operativo-series-key");
      if (!key) return;
      const labelInput = row.querySelector("[data-operativo-series-label]");
      const colorInput = row.querySelector("[data-operativo-series-color]");
      const enabledInput = row.querySelector("[data-operativo-series-enabled]");
      const fallback = (defaults.operativo?.datasets || {})[key] || {};
      operativoDatasets[key] = {
        label: labelInput?.value?.trim() || fallback.label || "",
        color: colorInput?.value || fallback.color || "#0d47a1",
        enabled: Boolean(enabledInput?.checked),
      };
    });

    const ggCharts = {};
    form.querySelectorAll("[data-gg-chart-key]").forEach((chart) => {
      const key = chart.getAttribute("data-gg-chart-key");
      if (!key) return;
      const titleInput = chart.querySelector("[data-gg-chart-title]");
      const enabledInput = chart.querySelector("[data-gg-chart-enabled]");
      const fallback = (defaults.gastosGenerales?.charts || {})[key] || {};
      const series = {};
      chart.querySelectorAll("[data-gg-series-row]").forEach((row) => {
        const serieKey = row.getAttribute("data-gg-series-key");
        if (!serieKey) return;
        const labelInput = row.querySelector("[data-gg-series-label]");
        const colorInput = row.querySelector("[data-gg-series-color]");
        const enabledInput = row.querySelector("[data-gg-series-enabled]");
        const fallbackSerie = (fallback.series || {})[serieKey] || {};
        series[serieKey] = {
          label: labelInput?.value?.trim() || fallbackSerie.label || "",
          color: colorInput?.value || fallbackSerie.color || "#0d47a1",
          enabled: Boolean(enabledInput?.checked),
        };
      });
      ggCharts[key] = {
        title: titleInput?.value?.trim() || fallback.title || "",
        enabled: Boolean(enabledInput?.checked),
        series,
      };
    });

    const customCharts = [];
    if (customList) {
      customList.querySelectorAll("[data-custom-chart]").forEach((item) => {
        const id = item.dataset.customId || buildCustomChartId();
        const title = item.querySelector("[data-custom-title]")?.value?.trim() || "";
        const subtitle =
          item.querySelector("[data-custom-subtitle]")?.value?.trim() || "";
        const module =
          item.querySelector("[data-custom-module]")?.value || "RESUMEN";
        const chartType =
          item.querySelector("[data-custom-type]")?.value || "inherit";
        const enabled =
          item.querySelector("[data-custom-enabled]")?.checked !== false;
        const rowsText = item.querySelector("[data-custom-rows]")?.value || "";
        const rows = parseCustomRows(rowsText);
        customCharts.push({
          id,
          title,
          subtitle,
          module,
          chartType,
          enabled,
          rows,
        });
      });
    }

    return {
      ...baseConfig,
      version: defaults.version || 2,
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
      ingreso: {
        enabled:
          form.querySelector("[data-ingreso-enabled]")?.checked !== false,
        title: form.querySelector("[data-ingreso-title]")?.value?.trim() || "",
        subtitle:
          form.querySelector("[data-ingreso-subtitle]")?.value?.trim() || "",
        series: ingresoSeries,
      },
      ingresoNacional: {
        enabled:
          form.querySelector("[data-ingreso-nacional-enabled]")?.checked !==
          false,
        title:
          form.querySelector("[data-ingreso-nacional-title]")?.value?.trim() ||
          "",
        subtitle:
          form.querySelector("[data-ingreso-nacional-subtitle]")?.value?.trim() ||
          "",
        series: ingresoNacionalSeries,
      },
      operativo: {
        enabled:
          form.querySelector("[data-operativo-enabled]")?.checked !== false,
        title:
          form.querySelector("[data-operativo-title]")?.value?.trim() || "",
        datasets: operativoDatasets,
      },
      gastosGenerales: {
        enabled: form.querySelector("[data-gg-enabled]")?.checked !== false,
        subtitleTemplate:
          form.querySelector("[data-gg-subtitle]")?.value?.trim() || "",
        charts: ggCharts,
      },
      sources,
      customCharts,
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
    const api = getGraficasConfigApi();
    const saved = api?.save ? api.save(draft) : draft;
    applyConfigToForm(saved);
    setStatus("Configuracion guardada. Recarga las vistas con graficas.", "success");
    if (saveBtn) saveBtn.disabled = false;
  };

  const handleReset = () => {
    const confirmado = window.confirm(
      "Restaurar la configuracion por defecto?"
    );
    if (!confirmado) return;
    const api = getGraficasConfigApi();
    const restored = api?.reset ? api.reset() : null;
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

  const api = getGraficasConfigApi();
  if (!api) {
    setStatus("No se encontro GraficasConfig en esta vista.", "danger");
    return;
  }
  const configInicial = api.load();
  applyConfigToForm(configInicial);
  setStatus("Listo para editar.", "muted");

  if (customAddBtn) {
    customAddBtn.addEventListener("click", () => {
      const chart = {
        id: buildCustomChartId(),
        module: moduloSelect?.value || "RESUMEN",
        chartType: "inherit",
        enabled: true,
        rows: [],
      };
      const item = renderCustomChartItem(chart);
      item?.querySelector("[data-custom-title]")?.focus();
    });
  }
})();
