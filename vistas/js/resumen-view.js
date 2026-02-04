(() => {
  const base =
    window.location.protocol === "file:"
      ? "http://localhost:3005"
      : window.location.origin;
  const API_ENDPOINT = `${base}/api/reportes/resumen`;
  const API_ANIOS = `${base}/api/saldos/anios`;

  const formatNumber = (valor) => {
    const monto = Number(valor ?? 0);
    if (!Number.isFinite(monto)) return "0.00";
    return new Intl.NumberFormat("es-MX", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(monto);
  };

  const formatPercentValue = (valor) => {
    if (!Number.isFinite(valor)) return "0.00 %";
    return `${valor.toFixed(2)} %`;
  };

  const toNumber = (valor) => {
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : 0;
  };
  
  // Helper para normalizar IDs de operaciones
  const normalizeOperationId = (value) => {
    return (value || "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toUpperCase();
  };

  const normalizeModuleKey = (value) => {
    const clean = (value || "")
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

  const DEFAULT_GRAFICAS_CONFIG = (() => {
    if (window.GraficasConfig && window.GraficasConfig.defaults) {
      return window.GraficasConfig.defaults;
    }
    return {
      series: [
        { key: "actualYTD", label: "Real acumulado", color: "#0d47a1", enabled: true },
        { key: "planYTD", label: "Ppto. acumulado", color: "#60a5fa", enabled: true },
        { key: "prevYTD", label: "Real acumulado AA", color: "#94a3b8", enabled: true },
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
        operating: { label: "CONSOLIDATED OPERATING RESULTS", color: "#0d47a1" },
        net: { label: "CONSOLIDATED NET RESULTS", color: "#94a3b8" },
      },
      legend: { show: true, position: "bottom" },
      chart: { type: "bar", stacked: false },
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
                variants: [
                  "NET RESULTS NORTHWEST",
                  "NET RESULTS NO",
                  "NO NET RESULTS",
                ],
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
      manualOnly: false,
      customCharts: [],
    };
  })();

  const getGraficasConfig = () => {
    if (window.GraficasConfig && typeof window.GraficasConfig.load === "function") {
      return window.GraficasConfig.load();
    }
    return DEFAULT_GRAFICAS_CONFIG;
  };

  const hasEnabledManualCharts = (graficasConfig) =>
    Array.isArray(graficasConfig?.customCharts) &&
    graficasConfig.customCharts.some(
      (chart) =>
        chart?.enabled !== false &&
        Array.isArray(chart?.rows) &&
        chart.rows.length > 0
    );

  const isManualOnly = (graficasConfig) =>
    graficasConfig?.manualOnly === true && hasEnabledManualCharts(graficasConfig);

  const hasEnabledCustomChartsForResumen = (graficasConfig) =>
    Array.isArray(graficasConfig?.customCharts) &&
    graficasConfig.customCharts.some((chart) => {
      if (chart?.enabled === false) return false;
      if (!Array.isArray(chart?.rows) || chart.rows.length === 0) return false;
      return normalizeModuleKey(chart?.module || "RESUMEN") === "RESUMEN";
    });

  const hasEnabledBuiltInResumenCharts = (graficasConfig) =>
    graficasConfig?.charts?.operating?.enabled !== false ||
    graficasConfig?.charts?.net?.enabled !== false ||
    graficasConfig?.charts?.consolidated?.enabled !== false ||
    graficasConfig?.ingreso?.enabled !== false ||
    graficasConfig?.ingresoNacional?.enabled !== false;

  const resolveRenderableGraficasConfig = (graficasConfig) => {
    if (!graficasConfig || typeof graficasConfig !== "object") {
      return DEFAULT_GRAFICAS_CONFIG;
    }
    const customEnabled = hasEnabledCustomChartsForResumen(graficasConfig);
    const builtInEnabled = hasEnabledBuiltInResumenCharts(graficasConfig);
    if (isManualOnly(graficasConfig) || customEnabled || builtInEnabled) {
      return graficasConfig;
    }
    try {
      const defaults =
        window.GraficasConfig?.defaults || DEFAULT_GRAFICAS_CONFIG;
      return JSON.parse(JSON.stringify(defaults));
    } catch {
      return DEFAULT_GRAFICAS_CONFIG;
    }
  };

  const aplicarStickyEncabezados = () => {
    const tabla = document.getElementById("tablaComparacion");
    if (!tabla?.tHead) return;
    tabla.classList.add("sticky-header");
    requestAnimationFrame(() => {
      const filas = Array.from(tabla.tHead.rows || []);
      let offset = 0;
      filas.forEach((fila) => {
        const altura = fila.offsetHeight || fila.getBoundingClientRect().height;
        Array.from(fila.cells).forEach((celda) => {
          celda.style.top = `${offset}px`;
        });
        offset += altura;
      });
    });
  };

  let stickyResizeBound = false;
  const bindStickyResize = () => {
    if (stickyResizeBound) return;
    stickyResizeBound = true;
    window.addEventListener("resize", () => {
      aplicarStickyEncabezados();
    });
  };

  /**
   * Calcula porcentaje de variación según fórmula Excel
   * Fórmula: (real / base - 1) * 100
   *
   * Ejemplos:
   * - Real: 100, Base: 100 → (100/100 - 1) * 100 = 0%
   * - Real: 110, Base: 100 → (110/100 - 1) * 100 = 10%
   * - Real: 90, Base: 100 → (90/100 - 1) * 100 = -10%
   * - Real: 100, Base: 0 → 0% (división por cero)
   */
  const calculateVar = (actual, base) => {
    const actualNum = toNumber(actual);
    const baseNum = toNumber(base);

    // División por cero o base inválida → 0%
    if (baseNum === 0 || baseNum == null || Number.isNaN(baseNum)) return 0;
    if (!Number.isFinite(baseNum) || Math.abs(baseNum) === 0) return 0;

    const division = actualNum / baseNum;

    // Si división da resultado inválido, retornar 0%
    if (!Number.isFinite(division) || division === 0) return 0;

    // Fórmula Excel: (real / base - 1) * 100
    const porcentaje = (division - 1) * 100;

    return Number.isFinite(porcentaje) ? porcentaje : 0;
  };

  const parseNumber = (texto) => {
    const limpio = String(texto || "")
      .replace(/[^0-9,.-]/g, "")
      .replace(/,/g, "");
    const numero = Number(limpio);
    return Number.isFinite(numero) ? numero : 0;
  };

  const tablaBody = document.getElementById("tablaCuentasBody");
  const yearSelect = document.getElementById("resumenYearSelect");
  const monthSelect = document.getElementById("resumenMonthSelect");
  const yearLabel = document.getElementById("yearLabel");
  const periodLabel = document.getElementById("periodLabel");
  const empresaLabel = document.getElementById("empresaLabel");
  const searchInput = document.getElementById("accountSearch");
  const exportXlsxBtn = document.getElementById("exportResumenBtn");
  const printPdfBtn = document.getElementById("printResumenBtn");
  const comparativaToggle = document.getElementById(
    "resumenEmpresaComparativaToggle"
  );
  const comparativaLabel = document.getElementById(
    "resumenEmpresaComparativaLabel"
  );
  const comparativaStatus = document.getElementById(
    "resumenComparativaStatus"
  );
  const chartsToggleBtn = document.getElementById("resumenChartsToggleBtn");
  const chartsPanel = document.getElementById("resumenChartsPanel");
  const chartsCloseBtn = document.getElementById("resumenChartsCloseBtn");
  const chartsRefreshBtn = document.getElementById("resumenChartsRefreshBtn");
  const chartsEmpty = document.getElementById("resumenChartsEmpty");
  const chartsGrid = document.getElementById("resumenChartsGrid");
  const chartsEmpresaLabel = document.getElementById(
    "resumenChartsEmpresaLabel"
  );
  const chartsPeriodoLabel = document.getElementById(
    "resumenChartsPeriodoLabel"
  );
  const chartCanvasOperating = document.getElementById(
    "resumenChartOperating"
  );
  const chartCanvasNet = document.getElementById("resumenChartNet");
  const chartCanvasConsolidated = document.getElementById(
    "resumenChartConsolidated"
  );
  const chartCanvasIngresoCapitulo = document.getElementById(
    "resumenChartIngresoCapitulo"
  );
  const chartCanvasIngresoNacional = document.getElementById(
    "resumenChartIngresoNacional"
  );
  const chartCardOperating = document.getElementById(
    "resumenChartCardOperating"
  );
  const chartCardNet = document.getElementById("resumenChartCardNet");
  const chartCardConsolidated = document.getElementById(
    "resumenChartCardConsolidated"
  );
  const chartCardIngresoCapitulo = document.getElementById(
    "resumenChartCardIngresoCapitulo"
  );
  const chartCardIngresoNacional = document.getElementById(
    "resumenChartCardIngresoNacional"
  );

  const manejarSesionExpirada = (resp) => {
    if (resp?.status === 401) {
      // Usar Sesion.cerrar() que maneja correctamente la redirección desde iframes
      try {
        Sesion.cerrar();
      } catch (_) {
        /* ignore */
      }
      return true;
    }
    return false;
  };
  const toggleBtn = document.getElementById("toggleAccountsBtn");

  const obtenerCapituloEmpresa = (empresaId) =>
    window.CapitulosModulos?.obtenerCapituloPorEmpresa?.(empresaId) || null;
  const obtenerEtiquetaEmpresa = (empresaId) =>
    window.CapitulosModulos?.EMPRESA_CONFIG?.[empresaId]?.etiqueta || "";

  const leerAnioSeleccionado = () =>
    Number(yearSelect?.value) || new Date().getFullYear();
  const leerMesSeleccionado = () =>
    Number(monthSelect?.value) || new Date().getMonth() + 1;

  const MESES = [
    { etiqueta: "Enero", clave: "ene", periodo: 1 },
    { etiqueta: "Febrero", clave: "feb", periodo: 2 },
    { etiqueta: "Marzo", clave: "mar", periodo: 3 },
    { etiqueta: "Abril", clave: "abr", periodo: 4 },
    { etiqueta: "Mayo", clave: "may", periodo: 5 },
    { etiqueta: "Junio", clave: "jun", periodo: 6 },
    { etiqueta: "Julio", clave: "jul", periodo: 7 },
    { etiqueta: "Agosto", clave: "ago", periodo: 8 },
    { etiqueta: "Septiembre", clave: "sep", periodo: 9 },
    { etiqueta: "Octubre", clave: "oct", periodo: 10 },
    { etiqueta: "Noviembre", clave: "nov", periodo: 11 },
    { etiqueta: "Diciembre", clave: "dic", periodo: 12 },
  ];

  const MODULO_CLAVE = (document.body?.dataset?.modulo || "RESUMEN")
    .toString()
    .toUpperCase();

  const leerContextoPersistido = () => {
    const ctx =
      typeof Sesion?.obtenerContextoPlaneacion === "function"
        ? Sesion.obtenerContextoPlaneacion()
        : {};
    const anio = Number(ctx?.anio);
    const mes = Number(ctx?.mes);
    return {
      anio: Number.isInteger(anio) ? anio : null,
      mes: Number.isInteger(mes) ? mes : null,
    };
  };

  const persistirContextoSeleccion = (anio, mes) => {
    if (typeof Sesion?.guardarContextoPlaneacion === "function") {
      Sesion.guardarContextoPlaneacion({ anio, mes, modulo: MODULO_CLAVE });
    }
  };

  const elegirAnioDisponible = (lista = [], preferido) => {
    if (!Array.isArray(lista) || !lista.length) {
      return Number.isInteger(preferido) ? preferido : new Date().getFullYear();
    }
    const prefer = Number(preferido);
    if (Number.isInteger(prefer) && lista.includes(prefer)) {
      return prefer;
    }
    const actualSelect = Number(yearSelect?.value);
    if (Number.isInteger(actualSelect) && lista.includes(actualSelect)) {
      return actualSelect;
    }
    const anioActual = new Date().getFullYear();
    if (lista.includes(anioActual)) {
      return anioActual;
    }
    return lista[0];
  };

  const elegirMesValido = (preferido, anioSeleccionado) => {
    const numero = Number(preferido);
    const anio = Number(anioSeleccionado);
    const anioActual = new Date().getFullYear();
    
    // Si hay un mes preferido válido, usarlo
    if (Number.isInteger(numero) && numero >= 1 && numero <= MESES.length) {
      return numero;
    }
    
    const actualSelect = Number(monthSelect?.value);
    if (
      Number.isInteger(actualSelect) &&
      actualSelect >= 1 &&
      actualSelect <= MESES.length
    ) {
      return actualSelect;
    }
    
    // Determinar mes por defecto según el año
    // Si es año actual: mes actual del sistema
    // Si es año pasado: último mes disponible (diciembre)
    if (!Number.isInteger(anio) || anio >= anioActual) {
      return new Date().getMonth() + 1; // Mes actual (enero = 1)
    } else {
      return 12; // Diciembre para años pasados
    }
  };

  const obtenerMesPreferidoInicial = (anioSeleccionado, mesContexto) => {
    const anioNum = Number(anioSeleccionado);
    const mesNum = Number(mesContexto);
    const hoy = new Date();
    const mesSistema = hoy.getMonth() + 1;
    const anioSistema = hoy.getFullYear();

    if (
      Number.isInteger(mesNum) &&
      mesNum >= 1 &&
      mesNum <= MESES.length
    ) {
      if (Number.isInteger(anioNum) && anioNum === anioSistema) {
        return Math.min(mesNum, mesSistema);
      }
      return mesNum;
    }

    if (Number.isInteger(anioNum) && anioNum < anioSistema) {
      return 12;
    }

    return mesSistema;
  };

  const parseText = (texto) => (texto || "").toString().trim();

  const COMPARATIVA_STORAGE_KEY = "resumen_empresa_comparativa";
  const COMPARATIVA_POR_EMPRESA = {
    empresa1: "empresa9",
    empresa2: "empresa10",
    empresa3: "empresa11",
    empresa4: "empresa12",
  };
  const COMPARATIVA_POR_CAPITULO = {
    "CIUDAD DE MEXICO": "empresa9",
    GUADALAJARA: "empresa10",
    NORESTE: "empresa11",
    NOROESTE: "empresa12",
  };
  const COMPARATIVA_NO_DISPONIBLE = new Set();
  const COMPARATIVA_ERROR_MSG = new Map();

  const setComparativaStatus = (mensaje) => {
    if (!comparativaStatus) return;
    const texto = (mensaje || "").toString().trim();
    comparativaStatus.textContent = texto;
    comparativaStatus.classList.toggle("d-none", !texto);
  };

  const registrarErrorComparativa = (empresaId, mensaje) => {
    if (!empresaId) return;
    COMPARATIVA_ERROR_MSG.set(empresaId, mensaje || "");
    setComparativaStatus(mensaje || "");
  };

  const limpiarErrorComparativa = (empresaId) => {
    if (!empresaId) return;
    COMPARATIVA_ERROR_MSG.delete(empresaId);
    setComparativaStatus("");
  };

  const marcarComparativaNoDisponible = (empresaId) => {
    if (empresaId) COMPARATIVA_NO_DISPONIBLE.add(empresaId);
  };

  const comparativaDisponible = (empresaId) =>
    !COMPARATIVA_NO_DISPONIBLE.has(empresaId);

  const normalizarEtiquetaComparativa = (texto = "") =>
    texto
      .toString()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/\s+/g, " ");

  const extraerNumeroEmpresa = (empresaId) => {
    const match = (empresaId || "").toString().match(/\d+/);
    return match ? match[0] : "";
  };

  const obtenerEmpresaComparativaId = (empresaId) => {
    const clave = (empresaId || "").toString().trim().toLowerCase();
    if (COMPARATIVA_POR_EMPRESA[clave]) {
      return COMPARATIVA_POR_EMPRESA[clave];
    }
    const capitulo =
      obtenerCapituloEmpresa(empresaId) || obtenerEtiquetaEmpresa(empresaId);
    const capituloKey = normalizarEtiquetaComparativa(capitulo);
    return COMPARATIVA_POR_CAPITULO[capituloKey] || null;
  };

  const actualizarComparativaUI = (empresaId) => {
    if (!comparativaToggle && !comparativaLabel) return;
    const comparativaId = obtenerEmpresaComparativaId(empresaId);
    const disponible = comparativaDisponible(empresaId);
    if (comparativaToggle) {
      comparativaToggle.disabled = !comparativaId || !disponible;
      if (!comparativaId || !disponible) {
        comparativaToggle.checked = false;
        localStorage.setItem(COMPARATIVA_STORAGE_KEY, "0");
      }
    }
    if (comparativaLabel) {
      if (!comparativaId) {
        comparativaLabel.textContent = "";
        setComparativaStatus("");
        return;
      }
      if (!disponible) {
        comparativaLabel.textContent = "No disponible";
        const mensaje = COMPARATIVA_ERROR_MSG.get(empresaId) || "";
        setComparativaStatus(mensaje);
        return;
      }
      const numero = extraerNumeroEmpresa(comparativaId);
      comparativaLabel.textContent = numero
        ? `Empresa ${numero}`
        : comparativaId;
    }
    const mensaje = COMPARATIVA_ERROR_MSG.get(empresaId) || "";
    setComparativaStatus(mensaje);
  };

  const inicializarComparativaToggle = () => {
    if (!comparativaToggle) return;
    comparativaToggle.checked = true;
    localStorage.setItem(COMPARATIVA_STORAGE_KEY, "1");
    comparativaToggle.addEventListener("change", () => {
      const activo = comparativaToggle.checked;
      if (activo && empresaActual?.id && !comparativaDisponible(empresaActual.id)) {
        comparativaToggle.checked = false;
        localStorage.setItem(COMPARATIVA_STORAGE_KEY, "0");
        return;
      }
      localStorage.setItem(COMPARATIVA_STORAGE_KEY, activo ? "1" : "0");
      recargarSeleccionActual();
    });
  };

  const chartsPanelState = {
    open: false,
    charts: {},
  };

  const actualizarPanelGraficasMeta = () => {
    if (chartsEmpresaLabel) {
      const texto = (empresaLabel?.textContent || "").trim();
      chartsEmpresaLabel.textContent = texto || "-";
    }
    if (chartsPeriodoLabel) {
      const texto = (periodLabel?.textContent || "").trim();
      chartsPeriodoLabel.textContent = texto || "-";
    }
  };

  const actualizarPanelGraficasHeaders = (config) => {
    const base = DEFAULT_GRAFICAS_CONFIG || {};
    const resolved = config || base;
    const chartsCfg = resolved.charts || {};
    const baseCharts = base.charts || {};
    const getChartCfg = (key) => chartsCfg[key] || baseCharts[key] || {};
    const setHeader = (titleId, subtitleId, title, subtitle) => {
      const titleEl = document.getElementById(titleId);
      const subtitleEl = document.getElementById(subtitleId);
      if (titleEl && title) titleEl.textContent = title;
      if (subtitleEl) subtitleEl.textContent = subtitle || "";
    };

    const operatingCfg = getChartCfg("operating");
    const netCfg = getChartCfg("net");
    const consolidatedCfg = getChartCfg("consolidated");
    setHeader(
      "resumenChartTitleOperating",
      "resumenChartSubtitleOperating",
      operatingCfg.title,
      operatingCfg.subtitle
    );
    setHeader(
      "resumenChartTitleNet",
      "resumenChartSubtitleNet",
      netCfg.title,
      netCfg.subtitle
    );
    setHeader(
      "resumenChartTitleConsolidated",
      "resumenChartSubtitleConsolidated",
      consolidatedCfg.title,
      consolidatedCfg.subtitle
    );

    const ingresoCfg = resolved.ingreso || base.ingreso || {};
    const ingresoNacionalCfg =
      resolved.ingresoNacional || base.ingresoNacional || {};
    setHeader(
      "resumenChartTitleIngresoCapitulo",
      "resumenChartSubtitleIngresoCapitulo",
      ingresoCfg.title,
      ingresoCfg.subtitle
    );
    setHeader(
      "resumenChartTitleIngresoNacional",
      "resumenChartSubtitleIngresoNacional",
      ingresoNacionalCfg.title,
      ingresoNacionalCfg.subtitle
    );
  };

  const destruirGraficaPanel = (key) => {
    if (!chartsPanelState.charts[key]) return;
    chartsPanelState.charts[key].destroy();
    chartsPanelState.charts[key] = null;
  };

  const renderGraficaPanel = (key, canvas, data, config) => {
    if (!canvas || !data || typeof Chart === "undefined") return;
    destruirGraficaPanel(key);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const graficasConfig = config || getGraficasConfig();
    const chartType = resolveChartType(
      data.type,
      graficasConfig.chart?.type || "bar"
    );
    const isPie = isPieType(chartType);
    const shouldStack =
      !isPie && chartType === "bar" && Boolean(graficasConfig.chart?.stacked);
    chartsPanelState.charts[key] = new Chart(ctx, {
      type: chartType,
      data: {
        labels: data.labels || [],
        datasets: data.datasets || [],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: graficasConfig.legend?.show !== false,
            position: graficasConfig.legend?.position || "bottom",
            labels: {
              padding: 12,
              usePointStyle: true,
            },
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.dataset?.label
                  ? `${context.dataset.label}: `
                  : "";
                return `${label}${formatNumber(getParsedValue(context))}`;
              },
            },
          },
        },
        scales: isPie
          ? {}
          : {
              y: {
                beginAtZero: false,
                stacked: shouldStack,
                ticks: {
                  callback: (value) => formatNumber(value),
                },
              },
              x: {
                stacked: shouldStack,
                ticks: {
                  font: { size: 11 },
                },
              },
            },
      },
    });
  };

  const normalizarLabelResumen = (texto = "") =>
    texto
      .toString()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/\s+/g, " ");

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

  const getSummaryCustomSeriesConfig = (graficasConfig = {}) => {
    const overrideMap = new Map(
      (Array.isArray(graficasConfig.series) ? graficasConfig.series : [])
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

  const getEnabledSeriesConfig = (graficasConfig) => {
    const baseConfig = DEFAULT_GRAFICAS_CONFIG || {};
    const allowedKeys = new Set(["actualYTD", "planYTD", "prevYTD"]);
    const seriesConfig =
      Array.isArray(graficasConfig.series) && graficasConfig.series.length
        ? graficasConfig.series
        : baseConfig.series || [];
    return seriesConfig
      .filter((serie) => allowedKeys.has(serie.key))
      .filter((serie) => serie.enabled !== false);
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

  const getSummaryRowsConfig = (capitulo, graficasConfig = {}) => {
    const cap = normalizarLabelResumen(capitulo);
    const sources =
      graficasConfig.sources?.summary ||
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

      if (cap.includes("NORESTE") || cap.includes("NE ") || cap.includes("MONTERREY")) {
        const resolved = resolveGroup("ne");
        if (resolved) return resolved;
      }

      if (cap.includes("NOROESTE") || cap.includes("NO ") || cap.includes("NORTHWEST")) {
        const resolved = resolveGroup("no");
        if (resolved) return resolved;
      }

      const fallback = resolveGroup("generic");
      if (fallback) return fallback;
    }

    if (
      cap.includes("CIUDAD DE MEXICO") ||
      cap.includes("CDMX") ||
      cap.includes("MEXICO")
    ) {
      return {
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
        isCdmx: true,
      };
    }

    if (cap.includes("GUADALAJARA") || cap.includes("GDL")) {
      return {
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
        isCdmx: false,
      };
    }

    if (cap.includes("NORESTE") || cap.includes("NE ") || cap.includes("MONTERREY")) {
      return {
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
        isCdmx: false,
      };
    }

    if (cap.includes("NOROESTE") || cap.includes("NO ") || cap.includes("NORTHWEST")) {
      return {
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
        isCdmx: false,
      };
    }

    return {
      operating: [
        {
          label: "{capitulo}",
          variants: ["OPERATING RESULTS", "RESULTADO OPERATIVO"],
        },
      ],
      net: [
        { label: "{capitulo}", variants: ["NET RESULTS", "RESULTADO NETO"] },
      ],
      isCdmx: false,
    };
  };

  const resolveIsCdmx = (empresaId, graficasConfig) => {
    const capitulo = obtenerCapituloEmpresa(empresaId) || "";
    const rowsConfig = getSummaryRowsConfig(capitulo, graficasConfig);
    const isCdmx = Boolean(rowsConfig?.isCdmx);
    if (rowsConfig && typeof rowsConfig.isCdmx === "boolean") {
      return rowsConfig.isCdmx;
    }
    const cap = normalizarLabelResumen(capitulo);
    return (
      cap.includes("CIUDAD DE MEXICO") ||
      cap.includes("CDMX") ||
      cap.includes("MEXICO")
    );
  };

  const buildCustomChartData = (snapshot, chart, seriesConfig, chartType) => {
    if (!snapshot?.filas || !Array.isArray(seriesConfig) || !seriesConfig.length) {
      return null;
    }
    const rows = Array.isArray(chart?.rows) ? chart.rows : [];
    if (!rows.length) return null;
    const resolvedRows = rows
      .map((row) => {
        const variants =
          Array.isArray(row?.variants) && row.variants.length
            ? row.variants
            : row?.alias
            ? [row.alias]
            : [];
        if (!variants.length) return null;
        const normalizedVariants = variants
          .map((v) => normalizarLabelResumen(v))
          .filter(Boolean);
        if (!normalizedVariants.length) return null;
        const match = snapshot.filas.find((fila) => {
          const label = normalizarLabelResumen(fila?.label || "");
          return normalizedVariants.some((v) => label.includes(v));
        });
        return {
          label: row?.alias || variants[0],
          data: match?.totals || null,
        };
      })
      .filter(Boolean);

    if (!resolvedRows.length) return null;

    const datasets = seriesConfig.map((serie) => {
      const data = resolvedRows.map((row) =>
        resolveSummarySeriesValue(row.data || {}, serie.key)
      );
      const dataset = {
        label: serie.label,
        data,
        borderWidth: chartType === "line" ? 2 : 2,
      };
      if (isPieType(chartType)) {
        dataset.backgroundColor = buildSlicePalette(data.length, serie.color);
        dataset.borderColor = "#ffffff";
        dataset.borderWidth = 1;
        return dataset;
      }
      dataset.backgroundColor = serie.color;
      dataset.borderColor = serie.color;
      if (chartType === "line") {
        dataset.fill = false;
        dataset.tension = 0.32;
        dataset.pointRadius = 3;
        dataset.pointBackgroundColor = serie.color;
      }
      return dataset;
    });

    return {
      labels: resolvedRows.map((row) => row.label || "-"),
      datasets,
      type: chartType,
    };
  };

  const resumenMensualCache = new Map();

  const obtenerResumenMensual = async (empresaId, anio) => {
    if (!empresaId || !anio) return [];
    const cacheKey = `${empresaId || "sin"}:${anio || "sin"}`;
    if (resumenMensualCache.has(cacheKey)) {
      return resumenMensualCache.get(cacheKey);
    }
    const meses = MESES.map((m) => m.periodo);
    const responses = await Promise.all(
      meses.map(async (mes) => {
        try {
          const params = new URLSearchParams({
            empresaId: empresaId || "",
            anio: String(anio || ""),
            mes: String(mes || ""),
          });
          const resp = await fetch(`${API_ENDPOINT}?${params.toString()}`, {
            headers: Sesion.headersAutenticacion(),
          });
          if (!resp.ok) throw new Error("Sin respuesta");
          return resp.json();
        } catch (error) {
          console.warn("📊 RESUMEN: Error cargando resumen mensual", mes, error);
          return null;
        }
      })
    );
    resumenMensualCache.set(cacheKey, responses);
    return responses;
  };

  const buildCustomMensualChartData = (
    responses = [],
    chart,
    seriesConfig,
    chartType
  ) => {
    if (!Array.isArray(responses) || !responses.length) return null;
    if (!Array.isArray(seriesConfig) || !seriesConfig.length) return null;
    const rows = Array.isArray(chart?.rows) ? chart.rows : [];
    if (!rows.length) return null;

    const valuesBySerie = seriesConfig.reduce((acc, serie) => {
      acc[serie.key] = Array.from({ length: MESES.length }, () => 0);
      return acc;
    }, {});

    responses.forEach((data, monthIndex) => {
      const layout = data?.resumen?.[0]?.layout || [];
      if (!Array.isArray(layout) || !layout.length) return;
      rows.forEach((row) => {
        const variants =
          Array.isArray(row?.variants) && row.variants.length
            ? row.variants
            : row?.alias
            ? [row.alias]
            : [];
        if (!variants.length) return;
        const match = buscarFilaIngreso(layout, variants);
        if (!match?.totals) return;
        seriesConfig.forEach((serie) => {
          valuesBySerie[serie.key][monthIndex] += resolveSummarySeriesValue(
            match.totals,
            serie.key
          );
        });
      });
    });

    const hasData = seriesConfig.some((serie) =>
      (valuesBySerie[serie.key] || []).some((value) => Number(value) !== 0)
    );
    if (!hasData) return null;

    const datasets = seriesConfig.map((serie) => {
      const data = valuesBySerie[serie.key] || [];
      const dataset = {
        label: serie.label,
        data,
        borderWidth: chartType === "line" ? 2 : 2,
      };
      if (isPieType(chartType)) {
        dataset.backgroundColor = buildSlicePalette(data.length, serie.color);
        dataset.borderColor = "#ffffff";
        dataset.borderWidth = 1;
        return dataset;
      }
      dataset.backgroundColor = serie.color;
      dataset.borderColor = serie.color;
      if (chartType === "line") {
        dataset.fill = false;
        dataset.tension = 0.32;
        dataset.pointRadius = 3;
        dataset.pointBackgroundColor = serie.color;
      }
      return dataset;
    });

    return {
      labels: MESES.map((m) => m.etiqueta),
      datasets,
      type: chartType,
    };
  };

  const clearCustomChartsPanel = () => {
    if (!chartsGrid) return;
    chartsGrid.querySelectorAll("[data-custom-chart]").forEach((card) => {
      card.remove();
    });
    Object.keys(chartsPanelState.charts).forEach((key) => {
      if (key.startsWith("custom:")) {
        destruirGraficaPanel(key);
        delete chartsPanelState.charts[key];
      }
    });
  };

  const buildSnapshotFromMensualResponses = (responses = []) => {
    if (!Array.isArray(responses) || !responses.length) return null;
    const preferredMonth = Number(leerMesSeleccionado());
    const preferredIdx =
      Number.isInteger(preferredMonth) && preferredMonth >= 1 && preferredMonth <= 12
        ? preferredMonth - 1
        : -1;
    if (
      preferredIdx >= 0 &&
      Array.isArray(responses[preferredIdx]?.resumen?.[0]?.layout) &&
      responses[preferredIdx].resumen[0].layout.length
    ) {
      return { filas: responses[preferredIdx].resumen[0].layout };
    }
    for (let i = responses.length - 1; i >= 0; i -= 1) {
      const layout = responses[i]?.resumen?.[0]?.layout;
      if (Array.isArray(layout) && layout.length) {
        return { filas: layout };
      }
    }
    return null;
  };

  const renderCustomChartsPanel = async (graficasConfig) => {
    clearCustomChartsPanel();
    if (!chartsGrid) return 0;
    const snapshot = window.RESUMEN_SNAPSHOT;

    const customCharts = Array.isArray(graficasConfig.customCharts)
      ? graficasConfig.customCharts
      : [];
    if (!customCharts.length) return 0;

    const moduleKey = normalizeModuleKey(
      document.body?.dataset?.modulo || "RESUMEN"
    );
    const empresa = empresaActual || Sesion.obtenerEmpresaActiva?.();
    const empresaId = empresa?.id || null;
    const anio = leerAnioSeleccionado();
    const canLoadMensual = Boolean(empresaId) && Number.isInteger(Number(anio));
    let mensualResponses = null;
    let fallbackSnapshot = snapshot?.filas ? snapshot : null;

    const baseChartType = graficasConfig.chart?.type || "bar";
    const baseSeriesConfig = getSummaryCustomSeriesConfig(graficasConfig);
    if (!baseSeriesConfig.length) return 0;

    const sanitizeId = (value) =>
      String(value || "")
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, "");

    let rendered = 0;
    for (let index = 0; index < customCharts.length; index += 1) {
      const chart = customCharts[index];
      if (chart?.enabled === false) continue;
      const chartModule = normalizeModuleKey(chart?.module || "RESUMEN");
      if (chartModule !== moduleKey) continue;
      const chartType = resolveChartType(chart?.chartType, baseChartType);
      const seriesConfig = applyCustomSeriesOverrides(
        filterSeriesByKeys(baseSeriesConfig, chart?.seriesKeys || []),
        chart
      );
      if (!seriesConfig.length) continue;
      const sourceType = (chart?.sourceType || "snapshot").toString().toLowerCase();
      let data = null;
      if (sourceType === "mensual") {
        if (!canLoadMensual) continue;
        if (!mensualResponses) {
          mensualResponses = await obtenerResumenMensual(empresaId, Number(anio));
        }
        data = buildCustomMensualChartData(
          mensualResponses,
          chart,
          seriesConfig,
          chartType
        );
      } else {
        let chartSnapshot = fallbackSnapshot;
        if (!chartSnapshot?.filas && canLoadMensual) {
          if (!mensualResponses) {
            mensualResponses = await obtenerResumenMensual(empresaId, Number(anio));
          }
          chartSnapshot = buildSnapshotFromMensualResponses(mensualResponses);
          if (chartSnapshot?.filas) {
            fallbackSnapshot = chartSnapshot;
          }
        }
        if (chartSnapshot?.filas) {
          data = buildCustomChartData(
            chartSnapshot,
            chart,
            seriesConfig,
            chartType
          );
        }
      }
      if (!data) continue;

      const safeId = sanitizeId(chart.id) || `custom-${index + 1}`;
      const canvasId = `resumenCustomChart-${safeId}`;
      const col = document.createElement("div");
      col.className = "col-12";
      col.dataset.customChart = safeId;
      col.innerHTML = `
        <div class="charts-card">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <h6 class="mb-0">${chart.title || "Grafica personalizada"}</h6>
            <small class="text-muted">${chart.subtitle || ""}</small>
          </div>
          <div class="charts-canvas">
            <canvas id="${canvasId}"></canvas>
          </div>
        </div>
      `;
      chartsGrid.appendChild(col);
      const canvas = col.querySelector("canvas");
      if (canvas) {
        renderGraficaPanel(`custom:${safeId}`, canvas, data, graficasConfig);
        rendered += 1;
      }
    }
    return rendered;
  };

  const normalizarLabelIngreso = (texto = "") =>
    texto
      .toString()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/\s+/g, " ");

  const INCOME_LABELS_CHART = {
    mex: ["CDMX INCOME", "MEXICO INCOME", "CIUDAD DE MEXICO INCOME"],
    gdl: ["GUADALAJARA INCOME", "GDL INCOME", "GUADALAJARA INCOMEA"],
    mty: ["MONTERREY INCOME", "MTY INCOME"],
    nw: ["NORTHWEST INCOME", "NW INCOME", "NOROESTE INCOME", "NO INCOME"],
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

  const ingresoCache = new Map();
  const buildIngresoCacheKey = (empresaId, anio, signature = "") =>
    `${empresaId || "sin"}:${anio || "sin"}:${signature || "base"}`;

  const buscarFilaIngreso = (layout = [], variants = []) => {
    if (!Array.isArray(layout) || !layout.length) return null;
    const candidatos = Array.isArray(variants) ? variants : [variants];
    const normalizados = candidatos.map((v) => normalizarLabelIngreso(v));
    return layout.find((row) => {
      const label = normalizarLabelIngreso(row?.label || "");
      return normalizados.some((v) => label.includes(v));
    });
  };

  const obtenerIngresoPorCapituloSeries = async (empresaId, anio) => {
    if (!empresaId || !anio) return null;

    const graficasConfig = getGraficasConfig();
    const ingresoConfig =
      graficasConfig.ingreso || DEFAULT_GRAFICAS_CONFIG.ingreso;
    const ingresoSources =
      graficasConfig.sources?.ingreso ||
      DEFAULT_GRAFICAS_CONFIG.sources?.ingreso ||
      {};
    if (ingresoConfig.enabled === false) return null;

    const baseChartType = graficasConfig.chart?.type || "bar";
    const chartType = resolveChartType(ingresoConfig.chartType, baseChartType);
    const configSignature = JSON.stringify({
      ingreso: ingresoConfig,
      sources: ingresoSources,
      chartType,
    });
    const cacheKey = buildIngresoCacheKey(empresaId, anio, configSignature);
    if (ingresoCache.has(cacheKey)) return ingresoCache.get(cacheKey);

    const meses = MESES.map((m) => m.periodo);
    const respuestas = await Promise.all(
      meses.map(async (mes) => {
        try {
          const params = new URLSearchParams({
            empresaId: empresaId || "",
            anio: String(anio || ""),
            mes: String(mes || ""),
          });
          const resp = await fetch(`${API_ENDPOINT}?${params.toString()}`, {
            headers: Sesion.headersAutenticacion(),
          });
          if (!resp.ok) throw new Error("Sin respuesta");
          return resp.json();
        } catch (err) {
          console.warn("📊 RESUMEN: Error cargando ingresos", mes, err);
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
        variants: getSourceVariants(ingresoSources, key, INCOME_LABELS_CHART),
      }))
      .filter((serie) => serie.enabled && serie.variants.length);
    if (!datasetsConfig.length) return null;

    const series = datasetsConfig.reduce((acc, item) => {
      acc[item.key] = [];
      return acc;
    }, {});

    respuestas.forEach((data, idx) => {
      const layout = data?.resumen?.[0]?.layout || [];
      datasetsConfig.forEach((dataset) => {
        const row = buscarFilaIngreso(layout, dataset.variants);
        series[dataset.key][idx] = toNumber(row?.totals?.actualYTD);
      });
    });

    const hasData = datasetsConfig.some((dataset) =>
      (series[dataset.key] || []).some((val) => Number(val) !== 0)
    );
    if (!hasData) return null;

    const isPie = isPieType(chartType);
    const payload = {
      labels: MESES.map((m) => m.etiqueta),
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
        entry.borderColor = dataset.color;
        entry.backgroundColor = dataset.color;
        if (chartType === "line") {
          entry.tension = 0.2;
          entry.fill = false;
          entry.pointRadius = 3;
        } else if (chartType === "bar") {
          entry.borderRadius = 6;
          entry.maxBarThickness = 18;
        }
        return entry;
      }),
      type: chartType,
    };

    ingresoCache.set(cacheKey, payload);
    return payload;
  };

  const ingresoNacionalCache = new Map();
  const buildIngresoNacionalCacheKey = (empresaId, anio, signature = "") =>
    `${empresaId || "sin"}:${anio || "sin"}:${signature || "base"}`;

  const obtenerIngresoNacionalSeries = async (empresaId, anio) => {
    if (!empresaId || !anio) return null;

    const graficasConfig = getGraficasConfig();
    const ingresoConfig =
      graficasConfig.ingresoNacional || DEFAULT_GRAFICAS_CONFIG.ingresoNacional;
    const ingresoSources =
      graficasConfig.sources?.ingresoNacional ||
      DEFAULT_GRAFICAS_CONFIG.sources?.ingresoNacional ||
      {};
    if (ingresoConfig.enabled === false) return null;

    const baseChartType = graficasConfig.chart?.type || "bar";
    const chartType = resolveChartType(ingresoConfig.chartType, baseChartType);
    const configSignature = JSON.stringify({
      ingresoNacional: ingresoConfig,
      sources: ingresoSources,
      chartType,
    });
    const cacheKey = buildIngresoNacionalCacheKey(
      empresaId,
      anio,
      configSignature
    );
    if (ingresoNacionalCache.has(cacheKey)) {
      return ingresoNacionalCache.get(cacheKey);
    }

    const meses = MESES.map((m) => m.periodo);
    const respuestas = await Promise.all(
      meses.map(async (mes) => {
        try {
          const params = new URLSearchParams({
            empresaId: empresaId || "",
            anio: String(anio || ""),
            mes: String(mes || ""),
          });
          const resp = await fetch(`${API_ENDPOINT}?${params.toString()}`, {
            headers: Sesion.headersAutenticacion(),
          });
          if (!resp.ok) throw new Error("Sin respuesta");
          return resp.json();
        } catch (err) {
          console.warn("📊 RESUMEN: Error cargando ingreso nacional", mes, err);
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
        variants: getSourceVariants(
          ingresoSources,
          key,
          INGRESO_NACIONAL_LABELS
        ),
      }))
      .filter((serie) => serie.enabled && serie.variants.length);
    if (!datasetsConfig.length) return null;

    const series = datasetsConfig.reduce((acc, item) => {
      acc[item.key] = [];
      return acc;
    }, {});

    respuestas.forEach((data, idx) => {
      const layout = data?.resumen?.[0]?.layout || [];
      datasetsConfig.forEach((dataset) => {
        const row = buscarFilaIngreso(layout, dataset.variants);
        series[dataset.key][idx] = toNumber(row?.totals?.actualYTD);
      });
    });

    const hasData = datasetsConfig.some((dataset) =>
      (series[dataset.key] || []).some((val) => Number(val) !== 0)
    );
    if (!hasData) return null;

    const isPie = isPieType(chartType);
    const payload = {
      labels: MESES.map((m) => m.etiqueta),
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
        entry.borderColor = dataset.color;
        entry.backgroundColor = dataset.color;
        if (chartType === "line") {
          entry.tension = 0.2;
          entry.fill = false;
          entry.pointRadius = 3;
        } else if (chartType === "bar") {
          entry.borderRadius = 6;
          entry.maxBarThickness = 18;
        }
        return entry;
      }),
      type: chartType,
    };

    ingresoNacionalCache.set(cacheKey, payload);
    return payload;
  };

  const obtenerGraficasExportacion = async (options = {}) => {
    const { empresaId, anio } = options;
    const graficasConfig = getGraficasConfig();
    const manualOnly = isManualOnly(graficasConfig);
    console.log("📊 obtenerGraficasExportacion: manualOnly =", manualOnly);
    console.log("📊 obtenerGraficasExportacion: RESUMEN_SNAPSHOT existe =", !!window.RESUMEN_SNAPSHOT);
    console.log("📊 obtenerGraficasExportacion: RESUMEN_SNAPSHOT.filas =", window.RESUMEN_SNAPSHOT?.filas?.length || 0);
    const datos = manualOnly
      ? []
      : (generarDatosGraficas(graficasConfig) || []).filter(Boolean);
    console.log("📊 obtenerGraficasExportacion: datos generados =", datos.length);

    const resolvedEmpresaId =
      empresaId || empresaActual?.id || Sesion.obtenerEmpresaActiva?.()?.id;
    const resolvedAnio = Number.isFinite(Number(anio))
      ? Number(anio)
      : leerAnioSeleccionado();

    if (!manualOnly && resolvedEmpresaId && resolvedAnio) {
      const isCdmx = resolveIsCdmx(resolvedEmpresaId, graficasConfig);
      const ingresoConfig =
        graficasConfig.ingreso || DEFAULT_GRAFICAS_CONFIG.ingreso || {};
      const ingresoNacionalConfig =
        graficasConfig.ingresoNacional ||
        DEFAULT_GRAFICAS_CONFIG.ingresoNacional ||
        {};

      const [ingresoCapitulo, ingresoNacional] = await Promise.all([
        obtenerIngresoPorCapituloSeries(resolvedEmpresaId, resolvedAnio),
        obtenerIngresoNacionalSeries(resolvedEmpresaId, resolvedAnio),
      ]);

      if (isCdmx && ingresoNacional) {
        const tituloRaw = (ingresoNacionalConfig.title || "").toString().trim();
        datos.push({
          ...ingresoNacional,
          titulo: tituloRaw || "Ingreso nacional",
        });
      }

      if (ingresoCapitulo) {
        const tituloRaw = (ingresoConfig.title || "").toString().trim();
        datos.push({
          ...ingresoCapitulo,
          titulo: tituloRaw || "Ingreso por capitulo",
        });
      }
    }

    const snapshot = window.RESUMEN_SNAPSHOT;
    const customCharts = Array.isArray(graficasConfig.customCharts)
      ? graficasConfig.customCharts
      : [];
    const moduleKey = normalizeModuleKey(
      document.body?.dataset?.modulo || "RESUMEN"
    );
    const baseChartType = graficasConfig.chart?.type || "bar";
    const baseSeriesConfig = getSummaryCustomSeriesConfig(graficasConfig);

    if (customCharts.length && baseSeriesConfig.length) {
      let mensualResponses = null;
      for (let index = 0; index < customCharts.length; index += 1) {
        const chart = customCharts[index];
        if (chart?.enabled === false) continue;
        const chartModule = normalizeModuleKey(chart?.module || "RESUMEN");
        if (chartModule !== moduleKey) continue;
        const chartType = resolveChartType(chart?.chartType, baseChartType);
        const seriesConfig = applyCustomSeriesOverrides(
          filterSeriesByKeys(baseSeriesConfig, chart?.seriesKeys || []),
          chart
        );
        if (!seriesConfig.length) continue;
        const sourceType = (chart?.sourceType || "snapshot")
          .toString()
          .toLowerCase();
        let data = null;
        if (sourceType === "mensual") {
          if (!resolvedEmpresaId || !resolvedAnio) continue;
          if (!mensualResponses) {
            mensualResponses = await obtenerResumenMensual(
              resolvedEmpresaId,
              resolvedAnio
            );
          }
          data = buildCustomMensualChartData(
            mensualResponses,
            chart,
            seriesConfig,
            chartType
          );
        } else if (snapshot?.filas) {
          data = buildCustomChartData(snapshot, chart, seriesConfig, chartType);
        }
        if (!data) continue;
        const tituloRaw = (chart?.title || "").toString().trim();
        datos.push({
          ...data,
          titulo: tituloRaw || `Grafica personalizada ${index + 1}`,
        });
      }
    }

    return datos;
  };

  const cargarGraficaIngresoNacional = async () => {
    if (!chartCanvasIngresoNacional || !chartCardIngresoNacional) return;
    chartCardIngresoNacional.classList.add("d-none");
    destruirGraficaPanel("ingresoNacional");

    const graficasConfig = getGraficasConfig();
    if (isManualOnly(graficasConfig)) return false;
    const ingresoConfig =
      graficasConfig.ingresoNacional || DEFAULT_GRAFICAS_CONFIG.ingresoNacional;
    if (ingresoConfig.enabled === false) return false;

    const anio = leerAnioSeleccionado();
    const empresa = empresaActual || Sesion.obtenerEmpresaActiva();
    const isCdmx = resolveIsCdmx(empresa?.id, graficasConfig);
    if (!isCdmx) return false;
    if (!empresa?.id || !anio) return false;

    const data = await obtenerIngresoNacionalSeries(empresa.id, anio);
    if (!data || !Array.isArray(data.labels) || !data.labels.length) return false;

    chartCardIngresoNacional.classList.remove("d-none");
    renderGraficaPanel(
      "ingresoNacional",
      chartCanvasIngresoNacional,
      data,
      graficasConfig
    );
    return true;
  };

  const cargarGraficaIngresoCapitulo = async () => {
    if (!chartCanvasIngresoCapitulo || !chartCardIngresoCapitulo) return;
    chartCardIngresoCapitulo.classList.add("d-none");
    destruirGraficaPanel("ingreso");

    const graficasConfig = getGraficasConfig();
    if (isManualOnly(graficasConfig)) return false;
    const ingresoConfig = graficasConfig.ingreso || DEFAULT_GRAFICAS_CONFIG.ingreso;
    if (ingresoConfig.enabled === false) return false;

    const anio = leerAnioSeleccionado();
    const empresa = empresaActual || Sesion.obtenerEmpresaActiva();
    if (!empresa?.id || !anio) return false;

    const data = await obtenerIngresoPorCapituloSeries(empresa.id, anio);
    if (!data || !Array.isArray(data.labels) || !data.labels.length) return false;

    chartCardIngresoCapitulo.classList.remove("d-none");
    renderGraficaPanel("ingreso", chartCanvasIngresoCapitulo, data, graficasConfig);
    return true;
  };

  const mostrarGraficasVacias = (mensaje) => {
    if (chartsGrid) chartsGrid.classList.add("d-none");
    if (chartsEmpty) {
      chartsEmpty.textContent = mensaje;
      chartsEmpty.classList.remove("d-none");
    }
  };

  const actualizarPanelGraficas = async () => {
    if (!chartsPanelState.open) return;
    actualizarPanelGraficasMeta();
    const loadedGraficasConfig = getGraficasConfig();
    const graficasConfig = resolveRenderableGraficasConfig(loadedGraficasConfig);
    actualizarPanelGraficasHeaders(graficasConfig);
    if (typeof Chart === "undefined") {
      mostrarGraficasVacias("Chart.js no esta disponible.");
      return;
    }

    if (isManualOnly(graficasConfig)) {
      const customCount = await renderCustomChartsPanel(graficasConfig);
      destruirGraficaPanel("operating");
      destruirGraficaPanel("net");
      destruirGraficaPanel("consolidated");
      destruirGraficaPanel("ingreso");
      destruirGraficaPanel("ingresoNacional");
      if (chartCardOperating) chartCardOperating.classList.add("d-none");
      if (chartCardNet) chartCardNet.classList.add("d-none");
      if (chartCardConsolidated) chartCardConsolidated.classList.add("d-none");
      if (chartCardIngresoCapitulo)
        chartCardIngresoCapitulo.classList.add("d-none");
      if (chartCardIngresoNacional)
        chartCardIngresoNacional.classList.add("d-none");
      if (customCount === 0) {
        mostrarGraficasVacias("No hay graficas manuales configuradas.");
      } else {
        if (chartsEmpty) chartsEmpty.classList.add("d-none");
        if (chartsGrid) chartsGrid.classList.remove("d-none");
      }
      return;
    }

    const datos = generarDatosGraficas(graficasConfig);
    const customCount = await renderCustomChartsPanel(graficasConfig);
    const hasSummaryData = Array.isArray(datos) && datos.some(Boolean);
    if (!hasSummaryData && customCount === 0) {
      destruirGraficaPanel("operating");
      destruirGraficaPanel("net");
      destruirGraficaPanel("consolidated");
      destruirGraficaPanel("ingreso");
      destruirGraficaPanel("ingresoNacional");
      if (chartCardOperating) chartCardOperating.classList.add("d-none");
      if (chartCardNet) chartCardNet.classList.add("d-none");
      if (chartCardConsolidated) chartCardConsolidated.classList.add("d-none");
      if (chartCardIngresoCapitulo)
        chartCardIngresoCapitulo.classList.add("d-none");
      if (chartCardIngresoNacional)
        chartCardIngresoNacional.classList.add("d-none");
      Promise.all([
        cargarGraficaIngresoCapitulo(),
        cargarGraficaIngresoNacional(),
      ])
        .then(([ingresoCapitulo, ingresoNacional]) => {
          if (ingresoCapitulo || ingresoNacional) {
            if (chartsEmpty) chartsEmpty.classList.add("d-none");
            if (chartsGrid) chartsGrid.classList.remove("d-none");
          } else {
            mostrarGraficasVacias(
              "No hay datos de graficas disponibles. Carga el resumen primero."
            );
          }
        })
        .catch(() => {
          mostrarGraficasVacias(
            "No hay datos de graficas disponibles. Carga el resumen primero."
          );
        });
      return;
    }

    if (chartsEmpty) chartsEmpty.classList.add("d-none");
    if (chartsGrid) chartsGrid.classList.remove("d-none");

    const [operating, net, consolidated] = datos;
    const showOperating = graficasConfig.charts?.operating?.enabled !== false;
    const showNet = graficasConfig.charts?.net?.enabled !== false;
    const showConsolidated =
      graficasConfig.charts?.consolidated?.enabled !== false &&
      resolveIsCdmx(empresaActual?.id, graficasConfig);

    if (showOperating && operating && chartCanvasOperating) {
      if (chartCardOperating) chartCardOperating.classList.remove("d-none");
      renderGraficaPanel(
        "operating",
        chartCanvasOperating,
        operating,
        graficasConfig
      );
    } else if (chartCardOperating) {
      chartCardOperating.classList.add("d-none");
      destruirGraficaPanel("operating");
    }

    if (showNet && net && chartCanvasNet) {
      if (chartCardNet) chartCardNet.classList.remove("d-none");
      renderGraficaPanel("net", chartCanvasNet, net, graficasConfig);
    } else if (chartCardNet) {
      chartCardNet.classList.add("d-none");
      destruirGraficaPanel("net");
    }

    if (showConsolidated && consolidated && chartCanvasConsolidated) {
      if (chartCardConsolidated)
        chartCardConsolidated.classList.remove("d-none");
      renderGraficaPanel(
        "consolidated",
        chartCanvasConsolidated,
        consolidated,
        graficasConfig
      );
    } else if (chartCardConsolidated) {
      chartCardConsolidated.classList.add("d-none");
      destruirGraficaPanel("consolidated");
    }

    cargarGraficaIngresoCapitulo().catch((err) => {
      console.warn("?? RESUMEN: Error mostrando ingreso por capitulo", err);
    });

    cargarGraficaIngresoNacional().catch((err) => {
      console.warn("?? RESUMEN: Error mostrando ingreso nacional", err);
    });
  };

  const setPanelGraficasOpen = (open) => {
    if (!chartsPanel || !chartsToggleBtn) return;
    chartsPanelState.open = open;
    chartsPanel.classList.toggle("open", open);
    chartsPanel.setAttribute("aria-hidden", open ? "false" : "true");
    chartsToggleBtn.setAttribute("aria-expanded", open ? "true" : "false");
    chartsToggleBtn.classList.toggle("active", open);
    if (open) {
      actualizarPanelGraficas();
    }
  };

  const inicializarPanelGraficas = () => {
    if (!chartsPanel || !chartsToggleBtn) return;
    chartsToggleBtn.addEventListener("click", () => {
      setPanelGraficasOpen(!chartsPanelState.open);
    });
    if (chartsCloseBtn) {
      chartsCloseBtn.addEventListener("click", () => {
        setPanelGraficasOpen(false);
      });
    }
    if (chartsRefreshBtn) {
      chartsRefreshBtn.addEventListener("click", () => {
        actualizarPanelGraficas();
      });
    }
  };

  const obtenerClaveCuentaComparativa = (registro) =>
    (registro?.cuentaCanonica || registro?.cuenta || "").toString().trim();

  const asignarSiNumero = (destino, clave, valor) => {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return false;
    destino[clave] = numero;
    return true;
  };

  const resolverComparativoNumero = (obj, claveActual, clavePrev) => {
    if (!obj) return null;
    const actual = Number(obj[claveActual]);
    if (Number.isFinite(actual)) return actual;
    const previo = Number(obj[clavePrev]);
    return Number.isFinite(previo) ? previo : null;
  };

  // Para comparativo de columnas "Prev", priorizar el valor previo sobre el actual.
  const resolverComparativoPrevio = (obj, clavePrev, claveActual) => {
    if (!obj) return null;
    const previo = Number(obj[clavePrev]);
    if (Number.isFinite(previo)) return previo;
    const actual = Number(obj[claveActual]);
    return Number.isFinite(actual) ? actual : null;
  };

  const indexarLayoutComparativo = (layout = []) => {
    const cuentas = new Map();
    const etiquetas = new Map();
    layout.forEach((block) => {
      if (!block) return;
      const tipo = (block.type || "").toLowerCase();
      const etiqueta = normalizarEtiquetaComparativa(block.label || "");
      if (etiqueta) {
        etiquetas.set(`${tipo}|${etiqueta}`, block);
      }
      if (tipo === "cuenta") {
        const claveCuenta = (block.cuenta || "").toString().trim();
        if (claveCuenta) cuentas.set(claveCuenta, block);
      }
    });
    return { cuentas, etiquetas };
  };

  const aplicarComparativoLayout = (layoutBase = [], layoutComp = []) => {
    if (!Array.isArray(layoutBase) || !Array.isArray(layoutComp)) return;
    const { cuentas, etiquetas } = indexarLayoutComparativo(layoutComp);
    layoutBase.forEach((block) => {
      if (!block || !block.totals) return;
      const tipo = (block.type || "").toLowerCase();
      let comparativo = null;
      if (tipo === "cuenta") {
        const claveCuenta = (block.cuenta || "").toString().trim();
        comparativo = claveCuenta ? cuentas.get(claveCuenta) : null;
      }
      if (!comparativo) {
        const etiqueta = normalizarEtiquetaComparativa(block.label || "");
        comparativo = etiqueta ? etiquetas.get(`${tipo}|${etiqueta}`) : null;
      }
      if (!comparativo?.totals) return;
      // Comparativo solo llena columnas "Prev" (AA), no reemplaza Actual
      const comparativoMonth = resolverComparativoPrevio(
        comparativo.totals,
        "prevMonth",
        "actualMonth"
      );
      const comparativoYTD = resolverComparativoPrevio(
        comparativo.totals,
        "prevYTD",
        "actualYTD"
      );
      asignarSiNumero(block.totals, "prevMonth", comparativoMonth);
      asignarSiNumero(block.totals, "prevYTD", comparativoYTD);
    });
  };

  const recalcularPrevLayoutDesdeCuentas = (layoutArr = []) => {
    if (!Array.isArray(layoutArr) || !layoutArr.length) return;

    // Recalcular prev en subsecciones usando las cuentas consecutivas
    for (let i = 0; i < layoutArr.length; i += 1) {
      const block = layoutArr[i];
      const tipo = (block?.type || "").toLowerCase();
      if (tipo !== "secundaria") continue;

      let prevMonth = 0;
      let prevYTD = 0;
      let j = i + 1;
      while (j < layoutArr.length) {
        const next = layoutArr[j];
        const nextTipo = (next?.type || "").toLowerCase();
        if (nextTipo === "cuenta") {
          const t = next.totals || {};
          prevMonth += toNumber(t.prevMonth);
          prevYTD += toNumber(t.prevYTD);
          j += 1;
          continue;
        }
        break;
      }

      if (!block.totals) block.totals = {};
      block.totals.prevMonth = prevMonth;
      block.totals.prevYTD = prevYTD;
    }

    // Recalcular prev en principales acumulando sus subsecciones
    let principalActual = null;
    let accPrevMonth = 0;
    let accPrevYTD = 0;
    const cerrarPrincipal = () => {
      if (!principalActual) return;
      if (!principalActual.totals) principalActual.totals = {};
      principalActual.totals.prevMonth = accPrevMonth;
      principalActual.totals.prevYTD = accPrevYTD;
    };

    layoutArr.forEach((block) => {
      const tipo = (block?.type || "").toLowerCase();
      if (tipo === "principal") {
        cerrarPrincipal();
        principalActual = block;
        accPrevMonth = 0;
        accPrevYTD = 0;
        return;
      }
      if (!principalActual) return;
      if (tipo === "secundaria") {
        const t = block.totals || {};
        accPrevMonth += toNumber(t.prevMonth);
        accPrevYTD += toNumber(t.prevYTD);
      }
    });
    cerrarPrincipal();
  };

  const indexarComparativoCapitulo = (capitulo = {}) => {
    const cuentas = new Map();
    const secciones = new Map();
    const principales = new Map();

    (capitulo.children || []).forEach((principal) => {
      const principalKey = normalizarEtiquetaComparativa(principal.label || "");
      if (principalKey) {
        principales.set(principalKey, principal);
      }
      (principal.children || []).forEach((seccion) => {
        const seccionKey = normalizarEtiquetaComparativa(seccion.label || "");
        if (seccionKey && !secciones.has(seccionKey)) {
          secciones.set(seccionKey, seccion);
        }
        (seccion.cuentas || []).forEach((cta) => {
          const cuentaKey = obtenerClaveCuentaComparativa(cta);
          if (cuentaKey && !cuentas.has(cuentaKey)) {
            cuentas.set(cuentaKey, cta);
          }
        });
      });
    });

    return { cuentas, secciones, principales };
  };

  const aplicarComparativoCapitulo = (capituloBase = {}, capituloComp = {}) => {
    if (!capituloBase || !capituloComp) return;
    const { cuentas, secciones, principales } =
      indexarComparativoCapitulo(capituloComp);

    (capituloBase.children || []).forEach((principal) => {
      const principalKey = normalizarEtiquetaComparativa(principal.label || "");
      const compPrincipal = principalKey
        ? principales.get(principalKey)
        : null;
      if (compPrincipal) {
        // Comparativo solo llena columnas "Prev" (AA)
        const comparativoMonth = resolverComparativoPrevio(
          compPrincipal,
          "prevMonth",
          "actualMonth"
        );
        const comparativoYTD = resolverComparativoPrevio(
          compPrincipal,
          "prevYTD",
          "actualYTD"
        );
        asignarSiNumero(principal, "prevMonth", comparativoMonth);
        asignarSiNumero(principal, "prevYTD", comparativoYTD);
      }
      (principal.children || []).forEach((seccion) => {
      const seccionKey = normalizarEtiquetaComparativa(seccion.label || "");
      const compSeccion = seccionKey ? secciones.get(seccionKey) : null;
      if (compSeccion) {
        // Comparativo solo llena columnas "Prev" (AA) en totales de sección
        const comparativoMonth = resolverComparativoPrevio(
          compSeccion,
          "totalPrevMonth",
          "totalActualMonth"
        );
        const comparativoYTD = resolverComparativoPrevio(
          compSeccion,
          "totalPrevYTD",
          "totalActualYTD"
        );
        asignarSiNumero(seccion, "totalPrevMonth", comparativoMonth);
        asignarSiNumero(seccion, "totalPrevYTD", comparativoYTD);
      }
      (seccion.cuentas || []).forEach((cta) => {
        const cuentaKey = obtenerClaveCuentaComparativa(cta);
        const compCuenta = cuentaKey ? cuentas.get(cuentaKey) : null;
        if (compCuenta) {
          // Comparativo solo llena columnas "Prev" (AA) a nivel cuenta
          const comparativoMonth = resolverComparativoPrevio(
            compCuenta,
            "prevMonth",
            "actualMonth"
          );
          const comparativoYTD = resolverComparativoPrevio(
            compCuenta,
            "prevYTD",
            "actualYTD"
          );
          asignarSiNumero(cta, "prevMonth", comparativoMonth);
          asignarSiNumero(cta, "prevYTD", comparativoYTD);
        }
      });
      });
    });

    if (Array.isArray(capituloBase.layout) && Array.isArray(capituloComp.layout)) {
      aplicarComparativoLayout(capituloBase.layout, capituloComp.layout);
      recalcularPrevLayoutDesdeCuentas(capituloBase.layout);
    }
  };

  const aplicarComparativoResumen = (resumenBase = [], resumenComp = []) => {
    if (!Array.isArray(resumenBase) || !Array.isArray(resumenComp)) {
      return resumenBase;
    }
    if (!resumenBase.length || !resumenComp.length) {
      return resumenBase;
    }
    const mapaComparativo = new Map();
    resumenComp.forEach((capitulo) => {
      const key = normalizarEtiquetaComparativa(
        capitulo.label || capitulo.capitulo || ""
      );
      if (key) {
        mapaComparativo.set(key, capitulo);
      }
    });

    resumenBase.forEach((capitulo) => {
      const key = normalizarEtiquetaComparativa(
        capitulo.label || capitulo.capitulo || ""
      );
      const comparativo = mapaComparativo.get(key) || resumenComp[0];
      if (comparativo) {
        // Comparativo solo llena columnas "Prev" (AA), no reemplaza Actual
        aplicarComparativoCapitulo(capitulo, comparativo);
      }
    });
    return resumenBase;
  };

  // Snapshot local de la tabla RESUMEN para que otras vistas (Graficas) usen exactamente lo que ve el usuario
  const SNAPSHOT_PREFIX = "resumen_tabla_snapshot";
  const buildSnapshotKey = (empresaId, anio, mes) =>
    `${SNAPSHOT_PREFIX}:${empresaId || "sin"}:${anio || "sin"}:${mes || "sin"}`;
  const capturarTablaResumen = (empresaId, anio, mes, capituloLabel) => {
    try {
      const tabla = document.querySelector("#tablaComparacion tbody");
      if (!tabla) return null;
      const filas = Array.from(tabla.querySelectorAll("tr"));
      const datos = [];
      filas.forEach((fila, idx) => {
        const celdas = Array.from(fila.querySelectorAll("td"));
        if (celdas.length < 9) return; // requerimos columnas de valores
        const label = parseText(celdas[6]?.textContent || "");
        if (!label) return;
        const safeNumber = (celda) => parseNumber(celda?.textContent || "");
        const registro = {
          label,
          totals: {
            actual: safeNumber(celdas[1]),
            plan: safeNumber(celdas[2]),
            prev: safeNumber(celdas[3]),
            varMonthPlan: safeNumber(celdas[4]),
            varMonthPrev: safeNumber(celdas[5]),
            actualYTD: safeNumber(celdas[7]),
            planYTD: safeNumber(celdas[8]),
            prevYTD: safeNumber(celdas[9]),
            varYTDPlan: safeNumber(celdas[10]),
            varYTDPrev: safeNumber(celdas[11]),
          },
        };

        // Debug especial para CONSOLIDATED NET RESULTS
        if (label.toUpperCase().includes("CONSOLIDATED NET")) {
          console.log("📸 DEBUG CONSOLIDATED NET:", {
            row: idx,
            label,
            totalCeldas: celdas.length,
            celda1_raw: celdas[1]?.textContent,
            celda1_parsed: safeNumber(celdas[1]),
            celda2_raw: celdas[2]?.textContent,
            celda6_raw: celdas[6]?.textContent,
            celda7_raw: celdas[7]?.textContent,
            registro: registro.totals,
          });
        }

        datos.push(registro);
      });
      console.log("📸 RESUMEN: Capturando snapshot", {
        empresaId,
        anio,
        mes,
        capitulo: capituloLabel,
        totalFilas: datos.length,
      });

      // Logging especial para CONSOLIDATED
      const consolidated = datos.filter((d) =>
        d.label.toUpperCase().includes("CONSOLIDATED")
      );
      console.log(
        "📸 RESUMEN: CONSOLIDATED rows:",
        consolidated.map((d) => ({
          label: d.label,
          actual: d.totals.actual,
          plan: d.totals.plan,
          prev: d.totals.prev,
          actualYTD: d.totals.actualYTD,
          planYTD: d.totals.planYTD,
          prevYTD: d.totals.prevYTD,
        }))
      );
      return {
        empresaId,
        anio,
        mes,
        capitulo: capituloLabel || "",
        createdAt: Date.now(),
        filas: datos,
      };
    } catch (err) {
      console.warn("No se pudo capturar snapshot de tabla RESUMEN", err);
      return null;
    }
  };
  const guardarSnapshotTabla = (snapshot) => {
    if (
      !snapshot?.empresaId ||
      !snapshot?.anio ||
      !snapshot?.mes ||
      !Array.isArray(snapshot?.filas)
    )
      return;
    const key = buildSnapshotKey(
      snapshot.empresaId,
      snapshot.anio,
      snapshot.mes
    );
    window.RESUMEN_SNAPSHOT = snapshot;
    try {
      localStorage.setItem(key, JSON.stringify(snapshot));
    } catch (err) {
      console.warn("No se pudo guardar snapshot RESUMEN", err);
    }
  };

  const COLUMN_TOOLTIPS = {
    actualMonth:
      'Real del mes consultado segun el layout RESUMEN. Se alimenta de los saldos reales del servicio de planeacion para las cuentas mapeadas en "CUENTAS SUMMARY Y RESUMEN.xlsx".',
    planMonth:
      "Presupuesto del mes (PRESUP01..12 de la tabla PRESUPYY) para las cuentas del bloque seleccionado.",
    prevMonth:
      "Real del mes anterior del mismo ejercicio; compara contra el periodo inmediato anterior.",
    varMonthPlan:
      "Variacion mensual vs plan: ((Real / Plan) - 1) * 100 con los valores de la fila. Ejemplo: Real=110, Plan=100 → 10%",
    varMonthPrev:
      "Variacion mensual vs mes anterior: ((Real / Real mes anterior) - 1) * 100. Ejemplo: Real=110, Previo=100 → 10%",
  };

  const ROW_TOOLTIPS = {
    account:
      "Cuenta individual del catalogo RESUMEN. Real y presupuesto provienen de los mismos origenes que SUMMARY; la descripcion libre no se guarda en Firebird.",
    section:
      'Total de seccion ("sum-row" del Excel). Suma todas las cuentas hijas antes de presentar el bloque principal.',
    principal:
      "Subtotal del bloque principal (Income, Expense, Operating, etc.) definido en el libro maestro.",
    group:
      "Fila consolidada (CONSOLIDATED INCOME/EXPENSES u Operating Results) que agrupa varios principales.",
    result:
      'Operating/Net Results definidos en "SUMA DE VARIAS SECCIONES"; combinan ingresos, gastos y otros ajustes segun el mapeo.',
    operation:
      "Operacion libre definida en el Gestor de Plantillas (formula manual)."
  };

  const collapsedSections = new Set();
  let allCollapsed = false;
  const collapseButtons = Array.from(
    document.querySelectorAll("#collapseAllBtn, #collapseAllBtnSecondary")
  );
  const expandButtons = Array.from(
    document.querySelectorAll("#expandAllBtn, #expandAllBtnSecondary")
  );

  const obtenerNombreSeccion = (row) =>
    (row?.dataset?.sectionName || "").trim();

  function setSectionCollapseState(row, collapsed) {
    if (!row) return;
    let sectionName = obtenerNombreSeccion(row);
    if (!sectionName) {
      // Fallback: usar el texto de la columna de descripci¢n si no hay dataset
      const descCell = row.cells && row.cells[6];
      const texto = (descCell?.textContent || "").trim();
      if (texto) {
        sectionName = texto;
        row.dataset.sectionName = texto;
      }
    }
    if (!sectionName) return;

    const icono = row.querySelector(".collapse-icon");
    if (collapsed) {
      collapsedSections.add(sectionName);
      if (icono) {
        icono.className = "bi bi-chevron-right collapse-icon me-2";
      }
    } else {
      collapsedSections.delete(sectionName);
      if (icono) {
        icono.className = "bi bi-chevron-down collapse-icon me-2";
      }
    }

    let siguiente = row.nextElementSibling;
    const esOperacion = (r) => {
      if (!r) return false;
      const rol = (r.dataset?.rowRole || "").toLowerCase();
      return (
        rol === "operation" ||
        r.classList.contains("operation-row") ||
        r.classList.contains("free-operation-row")
      );
    };
    const esCorte = (r) => {
      if (!r) return true;
      if (r.classList.contains("collapsible-section")) return true;
      const rol = (r.dataset?.rowRole || "").toLowerCase();
      return ["principal", "group", "result", "net", "final"].includes(rol);
    };
    while (siguiente && !esCorte(siguiente)) {
      if (!esOperacion(siguiente)) {
        siguiente.style.display = collapsed ? "none" : "";
      } else {
        siguiente.style.display = "";
      }
      siguiente = siguiente.nextElementSibling;
    }

    // Si la fila misma est  marcada para ocultarse al colapsar, aplicar display
    if (row.dataset?.hideWhenCollapsed === "1") {
      row.style.display = collapsed ? "none" : "";
    }
  }

  function syncCollapseAllState() {
    const allSections = document.querySelectorAll(".collapsible-section");
    if (!allSections.length) {
      allCollapsed = false;
      return;
    }
    const totalCollapsed = Array.from(allSections).filter((row) =>
      collapsedSections.has(obtenerNombreSeccion(row))
    ).length;
    allCollapsed = totalCollapsed === allSections.length;
  }

  function autoCollapseExcludedSections() {
    return;
    const filas = document.querySelectorAll(
      ".collapsible-section.excluded-expense"
    );
    if (!filas.length) {
      syncCollapseAllState();
      return;
    }
    filas.forEach((row) => {
      // Mantener visible pero diferenciada; se ocultará solo en colapso global
      row.classList.add("text-muted", "excluded-expense-row");
      row.style.fontStyle = "italic";
      // Ocultar cuando está colapsado (solo aplica a estas secciones)
      row.dataset.hideWhenCollapsed = "1";
      // Asegurar nombre de sección para colapsar/expandir individualmente
      if (!row.dataset.sectionName && row.cells && row.cells[6]) {
        row.dataset.sectionName = (row.cells[6].textContent || "").trim();
      }
    });
    syncCollapseAllState();
  }

  function habilitarColapsoGastosAdministrativos() {
    return;
    const filas = tablaBody?.querySelectorAll("tr") || [];
    filas.forEach((row) => {
      const descripcionCell = row.cells && row.cells[6];
      const texto = (
        row.dataset?.sectionName ||
        descripcionCell?.textContent ||
        ""
      ).trim();
      if (!texto || !/GASTOS\s+ADMINISTRATIVOS/i.test(texto)) return;

      row.dataset.sectionName = texto;
      if (!row.classList.contains("collapsible-section")) {
        row.classList.add("collapsible-section");
      }
      if (descripcionCell && !row.querySelector(".collapse-icon")) {
        descripcionCell.innerHTML = "";
        const icon = document.createElement("i");
        icon.className = "bi bi-chevron-down collapse-icon me-2";
        icon.style.cursor = "pointer";
        descripcionCell.style.cursor = "pointer";
        descripcionCell.classList.add("collapse-trigger");
        descripcionCell.appendChild(icon);
        descripcionCell.appendChild(document.createTextNode(texto));
      }
      if (collapsedSections.has(texto)) {
        setSectionCollapseState(row, true);
      }
    });
    syncCollapseAllState();
  }

  const escapeAttr = (texto = "") => texto.toString().replace(/"/g, "&quot;");

  const formatList = (lista = [], limite = 5) => {
    const valores = (Array.isArray(lista) ? lista : [])
      .map((item) => (item || "").toString().trim())
      .filter(Boolean);
    if (!valores.length) return "";
    if (valores.length <= limite) {
      return valores.join(", ");
    }
    return `${valores.slice(0, limite).join(", ")} y ${
      valores.length - limite
    } mas`;
  };

  const describirFactor = (factor) => {
    const numero = Number.isFinite(Number(factor)) ? Number(factor) : 1;
    if (numero === 1) return "Suma";
    if (numero === -1) return "Resta";
    if (numero === 0.5) return "Divide entre 2";
    if (numero === 2) return "Duplica";
    if (numero === 0) return "Ignora";
    return numero > 0 ? `Escala x${numero}` : `Escala x${numero}`;
  };

  const describirOperaciones = (operaciones = []) => {
    const fragmentos = (Array.isArray(operaciones) ? operaciones : [])
      .filter((op) => op && op.principal)
      .map((op) => {
        const accion = describirFactor(op.factor);
        const secciones = formatList(op.sections || [], 4);
        return `${accion} ${op.principal}${
          secciones ? ` (secciones: ${secciones})` : ""
        }`;
      });
    return fragmentos.join("; ");
  };

  const buildRowContextTooltip = (role, context = {}) => {
    switch (role) {
      case "section": {
        const cuentas = Array.isArray(context.cuentas) ? context.cuentas : [];
        const nombres = cuentas
          .map(
            (cta) => cta.descripcion || cta.cuenta || cta.cuentaCanonica || ""
          )
          .filter(Boolean);
        const listado = formatList(nombres, 4);
        const principal = context.principal
          ? ` del principal "${context.principal}"`
          : "";
        return `Seccion "${
          context.label || ""
        }"${principal} acumula reales (servicio de planeacion) y presupuestos (PRESUPYY) de ${
          cuentas.length
        } cuentas${listado ? ` (${listado})` : ""}.`;
      }
      case "principal": {
        const secciones = formatList(context.sections || [], 5);
        const signo =
          Number(context.sign) < 0 ? "resta (gastos)" : "suma (ingresos)";
        return `Principal "${
          context.label || ""
        }" ${signo} los totales de las secciones ${
          secciones || "definidas en el capitulo"
        } antes de consolidarse.`;
      }
      case "group": {
        const detalle = describirOperaciones(context.operaciones || []);
        if (detalle) {
          return `Grupo "${
            context.label || ""
          }" consolida los principales indicados: ${detalle}.`;
        }
        const lista = formatList(context.principals || [], 6);
        return `Grupo "${context.label || ""}" consolida los principales ${
          lista || ""
        } mediante sumatoria directa.`;
      }
      case "result":
        return (
          describirOperaciones(context.operaciones || []) || ROW_TOOLTIPS.result
        );
      default:
        return ROW_TOOLTIPS[role] || "";
    }
  };

  const resumenTooltipAttr = (key) =>
    key && COLUMN_TOOLTIPS[key]
      ? ` title="${escapeAttr(COLUMN_TOOLTIPS[key])}" data-bs-toggle="tooltip"`
      : "";
  const resumenRowTooltipAttr = (role) =>
    role ? ` data-row-role="${role}"` : "";

  const disposeTooltips = () => {
    if (!window.bootstrap?.Tooltip) return;
    document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((el) => {
      const instance = window.bootstrap.Tooltip.getInstance(el);
      if (instance) instance.dispose();
    });
  };

  const activateTooltips = () => {
    if (!window.bootstrap?.Tooltip) return;
    document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((el) => {
      window.bootstrap.Tooltip.getOrCreateInstance(el);
    });
  };

  const cambiosPendientes = new Map();
  let editMode = false;
  let empresaActual = null;
  let mesClaveActual = "dic";
  const resumenLayoutCache = new Map();
  const LAYOUT_CACHE_ENABLED = false;

  const clonarLayout = (layout) => JSON.parse(JSON.stringify(layout || []));

  const obtenerClaveLayoutCache = (empresaId, anio) => {
    const empresa = empresaId || "sin-empresa";
    const ejercicio = Number.isFinite(Number(anio)) ? Number(anio) : "sin-anio";
    return `${empresa}:${ejercicio}`;
  };

  const aplicarLayoutPersistente = (empresaId, anio, resumen = []) => {
    if (!LAYOUT_CACHE_ENABLED) {
      if (resumenLayoutCache.size) {
        resumenLayoutCache.clear();
      }
      return;
    }
    if (
      !empresaId ||
      !Number.isFinite(Number(anio)) ||
      !Array.isArray(resumen)
    ) {
      return;
    }
    const cacheKey = obtenerClaveLayoutCache(empresaId, anio);
    let cache = resumenLayoutCache.get(cacheKey);
    if (!cache) {
      cache = new Map();
      resumenLayoutCache.set(cacheKey, cache);
    }
    resumen.forEach((capitulo) => {
      const capituloName = (capitulo.label || capitulo.capitulo || "")
        .toString()
        .trim()
        .toUpperCase();
      if (!capitulo || typeof capitulo !== "object") return;
      const nombreCapitulo =
        capitulo.capitulo || capitulo.nombre || capitulo.label;
      if (!nombreCapitulo) return;
      if (Array.isArray(capitulo.layout) && capitulo.layout.length) {
        cache.set(nombreCapitulo, clonarLayout(capitulo.layout));
      }
    });
  };

  const limpiarCambios = () => {
    cambiosPendientes.clear();
  };

  const claveCambio = (cuenta, columna) => `${cuenta}|${columna}`;

  const registrarCambio = (cuenta, columna, valor, original) => {
    if (!cuenta || !columna) return;
    cambiosPendientes.set(claveCambio(cuenta, columna), {
      cuenta,
      columna,
      valor,
      original,
    });
  };

  const eliminarCambio = (cuenta, columna) => {
    cambiosPendientes.delete(claveCambio(cuenta, columna));
  };

  const obtenerCambiosPendientes = () => {
    const porCuenta = new Map();
    cambiosPendientes.forEach((registro) => {
      const valores = porCuenta.get(registro.cuenta) || {};
      valores[registro.columna] = registro.valor;
      porCuenta.set(registro.cuenta, valores);
    });

    const presupuesto = Array.from(porCuenta.entries()).map(
      ([cuenta, valores]) => ({ cuenta, valores })
    );
    return { presupuesto, hayCambios: presupuesto.length > 0 };
  };

  const notificarCambios = () => {
    const detalle = { ...obtenerCambiosPendientes(), borradorGuardado: false };
    window.dispatchEvent(
      new CustomEvent("modulo-planeacion:presupuesto-editado", {
        detail: detalle,
      })
    );
  };

  const sincronizarCeldasEditables = () => {
    if (!tablaBody) return;

    // ⚠️ NOTA: Como usamos ModoEdicionPresupuesto con soloLayout: true,
    // NO necesitamos contentEditable aquí - ModoEdicionPresupuesto maneja TODA la edición
    // (cuentas/descripciones con inputs manuales)

    // ELIMINADO: contentEditable que causaba conflictos con ModoEdicionPresupuesto
    // Ya no seteamos contentEditable porque ModoEdicionPresupuesto maneja los clicks

    console.log(
      "✅ Resumen: ModoEdicionPresupuesto maneja edición (soloLayout)"
    );
  };

  const restaurarValoresOriginales = () => {
    if (!tablaBody) return;
    Array.from(tablaBody.querySelectorAll(".editable-cell")).forEach(
      (celda) => {
        const columna = celda.dataset.columnaClave;
        const esTexto =
          columna === "cuenta" ||
          columna === "descripcion" ||
          columna === "nombre";
        const originalRaw = celda.dataset.valorOriginal ?? "";
        if (esTexto) {
          celda.textContent = parseText(originalRaw);
        } else {
          const original = Number(originalRaw ?? 0);
          celda.textContent = formatNumber(original);
        }
      }
    );
  };

  const cancelarEdicion = () => {
    restaurarValoresOriginales();
    limpiarCambios();
    editMode = false;
    sincronizarCeldasEditables();
    notificarCambios();
  };

  const establecerModoEdicion = (flag) => {
    const habilitar = Boolean(flag);
    if (habilitar) {
      if (editMode) return;
      editMode = true;
      sincronizarCeldasEditables();
      if (window.ModoEdicionPresupuesto?.activar) {
        try {
          window.ModoEdicionPresupuesto.activar();
        } catch (e) {
          /* ignore */
        }
      }
    } else if (editMode) {
      cancelarEdicion();
      if (window.ModoEdicionPresupuesto?.desactivar) {
        try {
          window.ModoEdicionPresupuesto.desactivar();
        } catch (e) {
          /* ignore */
        }
      }
    }
  };

  const manejarBlurCelda = (event) => {
    const celda = event.currentTarget;
    const fila = celda.closest("tr");
    const cuenta = fila?.dataset.cuenta21 || fila?.dataset.cuenta;
    const columna = celda.dataset.columnaClave;
    if (!cuenta || !columna) return;

    const esTexto =
      columna === "cuenta" || columna === "descripcion" || columna === "nombre";
    const originalRaw = celda.dataset.valorOriginal ?? "";

    if (esTexto) {
      const originalTexto = parseText(originalRaw);
      const nuevoTexto = parseText(celda.textContent);
      if (nuevoTexto !== originalTexto) {
        celda.textContent = nuevoTexto;
        registrarCambio(cuenta, columna, nuevoTexto, originalTexto);
        // Si se editó la cuenta, actualizar dataset en la fila para persistencia
        if (columna === "cuenta" && fila) {
          fila.dataset.cuenta = nuevoTexto || "";
          fila.dataset.cuentaVisible = nuevoTexto || "";
        }
        // Si es columna de layout persistir layout local
        if (
          (columna === "cuenta" || columna === "descripcion") &&
          window.ModoEdicionPresupuesto?.guardarLayout
        ) {
          try {
            window.ModoEdicionPresupuesto.guardarLayout();
          } catch (err) {
            /* ignore */
          }
        }
      } else {
        celda.textContent = originalTexto;
        eliminarCambio(cuenta, columna);
      }
    } else {
      const original = Number(originalRaw ?? 0);
      const nuevoValor = parseNumber(celda.textContent);
      if (nuevoValor !== original) {
        celda.textContent = formatNumber(nuevoValor);
        registrarCambio(cuenta, columna, nuevoValor, original);
      } else {
        celda.textContent = formatNumber(original);
        eliminarCambio(cuenta, columna);
      }
    }

    notificarCambios();
  };

  window.CuentasModulo = window.CuentasModulo || {};
  window.CuentasModulo.cancelEdit = cancelarEdicion;
  window.CuentasModulo.getCambios = obtenerCambiosPendientes;
  window.CuentasModulo.setEditMode = establecerModoEdicion;
  window.CuentasModulo.guardarLayout = () =>
    window.ModoEdicionPresupuesto?.guardarLayout?.() || false;
  window.CuentasModulo.cargarLayoutLocal = () =>
    window.ModoEdicionPresupuesto?.cargarLayoutLocal?.() || null;
  window.CuentasModulo.aplicarLayoutLocal = (l) =>
    window.ModoEdicionPresupuesto?.aplicarLayoutLocal?.(l) || false;

  /**
   * Crea una celda HTML <td> con valor numérico formateado para Resumen
   *
   * Similar a la función de Summary pero adaptada a Resumen.
   * Genera celdas numéricas con formato de miles y decimales.
   *
   * @param {number} val - Valor numérico a mostrar
   * @param {Object} options - Opciones
   * @param {string} options.rowRole - Rol de la fila (account, section, etc.)
   * @param {string} options.classes - Clases CSS adicionales
   * @param {string} options.tooltipKey - Clave del tooltip
   * @returns {string} HTML de la celda <td>
   */
  const createCell = (
    val,
    { rowRole = "", classes = "", tooltipKey = "" } = {}
  ) => {
    const classList = ["text-end"];
    if (classes) classList.push(classes);
    return `<td class="${classList.join(" ")}"${resumenTooltipAttr(
      tooltipKey
    )}${resumenRowTooltipAttr(rowRole)}>${formatNumber(val)}</td>`;
  };

  /**
   * Crea una celda HTML <td> con valor porcentual formateado para Resumen
   *
   * Genera celdas para las columnas de variaciones porcentuales.
   * Formato: "+5.2%" o "-3.8%" con color según signo.
   *
   * @param {number} val - Valor decimal (ej: 0.052 para 5.2%)
   * @param {Object} options - Opciones
   * @param {string} options.rowRole - Rol de la fila
   * @param {string} options.tooltipKey - Clave del tooltip
   * @returns {string} HTML de la celda <td>
   */
  const createPercentCell = (val, { rowRole = "", tooltipKey = "" } = {}) =>
    `<td class="text-end percent-cell"${resumenTooltipAttr(
      tooltipKey
    )}${resumenRowTooltipAttr(rowRole)}>${formatPercentValue(val)}</td>`;

  /**
   * Crea una celda HTML <td> editable o de solo lectura para Resumen
   *
   * Igual que en Summary: SOLO cuenta y descripcion son editables.
   * Estos campos son visuales y no se guardan en Firebird.
   *
   * @param {string|number} val - Valor a mostrar
   * @param {Object} options - Opciones
   * @param {string} options.columnKey - Clave de columna
   * @param {string} options.rowRole - Rol de la fila
   * @param {string} options.tooltipKey - Clave del tooltip
   * @param {boolean} options.text - Si true es texto, si false es número
   * @param {string} options.classes - Clases CSS adicionales
   * @returns {string} HTML de la celda <td>
   */
  const createEditableCell = (
    val,
    {
      columnKey = "",
      rowRole = "",
      tooltipKey = "",
      text = false,
      classes = "",
    } = {}
  ) => {
    const esEditableReal =
      columnKey === "cuenta" ||
      columnKey === "descripcion" ||
      columnKey === "nombre";
    const classList = ["editable-cell"];
    classList.push(text ? "text-start" : "text-end");
    if (esEditableReal) classList.push("editable-real");
    else classList.push("read-only-cell");
    if (classes) classList.push(classes);
    const attrs = [
      `class="${classList.join(" ")}"`,
      `data-valor-original="${
        text ? escapeAttr(val ?? "") : Number(val ?? 0)
      }"`,
      `data-editable-real="${esEditableReal}"`,
    ];
    if (columnKey) {
      attrs.push(`data-columna-clave="${columnKey}"`);
      attrs.push(`data-role="${columnKey}"`);
    }
    if (!esEditableReal && tooltipKey) {
      attrs.push(`title="Columna de solo lectura (${columnKey})"`);
      attrs.push(`data-bs-toggle="tooltip"`);
    }
    const contenido = text ? escapeAttr(val ?? "") : formatNumber(val);
    return `<td ${attrs.join(" ")}${resumenTooltipAttr(
      tooltipKey
    )}${resumenRowTooltipAttr(rowRole)}>${contenido}</td>`;
  };

  /**
   * Crea una fila de totales para el módulo Resumen
   *
   * Similar a createTotalsRow de Summary, pero adaptada a la estructura
   * jerárquica de Resumen (Empresa → División → Comité → Cuenta).
   *
   * Genera filas que muestran totales acumulados por nivel jerárquico,
   * por ejemplo: total de una división, total de un comité, etc.
   *
   * Las 12 columnas son idénticas a Summary:
   * - Actual Month, Plan Month, Prev Month
   * - Var% Month Plan, Var% Month Prev
   * - Actual YTD, Plan YTD, Prev YTD
   * - Var% YTD Plan, Var% YTD Prev
   *
   * @param {Object} nodo - Nodo jerárquico con valores totales calculados
   * @param {Object} options - Opciones (label, rowRole, rowClass, etc.)
   * @returns {HTMLTableRowElement} Fila HTML con los totales formateados
   */
  const createResumenTotalsRow = (nodo, options = {}) => {
    const {
      label = "",
      rowRole = "section",
      rowClass = "",
      rowContext = null,
      labelClasses = "text-center fw-semibold",
    } = options;
    const totals = {
      actualMonth: toNumber(nodo.actualMonth ?? nodo.totalActualMonth),
      planMonth: toNumber(nodo.planMonth ?? nodo.totalPlanMonth),
      prevMonth: toNumber(nodo.prevMonth ?? nodo.totalPrevMonth),
      actualYTD: toNumber(nodo.actualYTD ?? nodo.totalActualYTD),
      planYTD: toNumber(nodo.planYTD ?? nodo.totalPlanYTD),
      prevYTD: toNumber(nodo.prevYTD ?? nodo.totalPrevYTD),
    };
    const varPlan = calculateVar(totals.actualMonth, totals.planMonth);
    const varPrev = calculateVar(totals.actualMonth, totals.prevMonth);
    const varPlanYTD = calculateVar(totals.actualYTD, totals.planYTD);
    const varPrevYTD = calculateVar(totals.actualYTD, totals.prevYTD);
    const row = document.createElement("tr");
    row.className = rowClass;
    row.dataset.rowRole = rowRole;
    let tooltip =
      buildRowContextTooltip(rowRole, rowContext || {}) ||
      ROW_TOOLTIPS[rowRole];
    if (tooltip) {
      row.setAttribute("title", tooltip);
      row.setAttribute("data-bs-toggle", "tooltip");
    }
    row.innerHTML = `
      <td class="account-column"></td>
      ${createCell(totals.actualMonth, { rowRole, tooltipKey: "actualMonth" })}
      ${createCell(totals.planMonth, { rowRole, tooltipKey: "planMonth" })}
      ${createCell(totals.prevMonth, { rowRole, tooltipKey: "prevMonth" })}
      ${createPercentCell(varPlan, { rowRole, tooltipKey: "varMonthPlan" })}
      ${createPercentCell(varPrev, { rowRole, tooltipKey: "varMonthPrev" })}
      <td class="${labelClasses} text-start"${resumenRowTooltipAttr(
      rowRole
    )}>${label}</td>
      ${createCell(totals.actualYTD, { rowRole, tooltipKey: "actualYTD" })}
      ${createCell(totals.planYTD, { rowRole, tooltipKey: "planYTD" })}
      ${createCell(totals.prevYTD, { rowRole, tooltipKey: "prevYTD" })}
      ${createPercentCell(varPlanYTD, { rowRole, tooltipKey: "varYtdPlan" })}
      ${createPercentCell(varPrevYTD, { rowRole, tooltipKey: "varYtdPrev" })}
    `;
    return row;
  };

  const actualizarMesContexto = (mesSeleccionado) => {
    const info = MESES.find((item) => item.periodo === Number(mesSeleccionado));
    if (info) {
      mesClaveActual = info.clave;
    }
  };

  const disposeStatus = () => {
    if (!tablaBody) return;
    const estado = tablaBody.querySelector(".estado-tabla");
    if (estado) estado.remove();
  };

  const setStatusRow = (mensaje) => {
    if (!tablaBody) return;
    disposeTooltips();
    tablaBody.innerHTML = `<tr class="estado-tabla"><td colspan="12">${mensaje}</td></tr>`;
  };

  const ordenarPorOrden = (items = [], extractor) => {
    return (Array.isArray(items) ? items : [])
      .map((item, idx) => ({
        item,
        idx,
        orden: extractor(item, idx),
      }))
      .sort((a, b) => (a.orden - b.orden) || (a.idx - b.idx))
      .map(({ item }) => item);
  };

  /**
   * Renderiza/pinta la tabla de Resumen con jerarquía multi-nivel
   *
   * Resumen muestra el mismo tipo de datos que Summary pero organizado
   * por división jerárquica interna de la empresa:
   * Empresa → División → Comité → Sección → Cuenta
   *
   * JERARQUÍA DE RESUMEN:
   * - Empresa: EMPRESA01, EMPRESA02, etc.
   * - División: CONSTRUCCIÓN, PROMOCIÓN, etc.
   * - Comité: Subgrupo dentro de división
   * - Sección: Categoría de cuentas (INGRESOS, GASTOS, etc.)
   * - Cuenta: Cuenta contable individual
   *
   * DIFERENCIA CON SUMMARY:
   * - Summary: Vista consolidada por tipo de cuenta (Revenue, Expenses)
   * - Resumen: Vista por estructura organizacional (Divisiones/Comités)
   *
   * LAYOUT PERSONALIZADO:
   * Similar a Summary, soporta agrupaciones y resultados especiales:
   * - type: 'group' → Agrupa principals (divisiones)
   * - type: 'net'/'final' → Resultados calculados
   *
   * COLUMNAS: Las mismas 12 columnas que Summary
   * (Actual Month, Plan, Prev, variaciones, YTD, etc.)
   *
   * @param {Array} resumen - Array de empresas con estructura jerárquica
   * @param {number} mesSeleccionado - Mes seleccionado (1-12)
   */
  const renderResumen = (resumen = [], mesSeleccionado) => {
    if (!tablaBody) return;
    limpiarCambios();
    editMode = false;
    disposeTooltips();
    tablaBody.innerHTML = "";

    if (!resumen.length) {
      setStatusRow("Sin datos disponibles para este periodo.");
      aplicarStickyEncabezados();
      bindStickyResize();
      return;
    }

    const mesInfo = MESES.find(
      (item) => item.periodo === Number(mesSeleccionado)
    );
    const claveMes = mesInfo?.clave || mesClaveActual;
    const planColumnKey = `budget-${claveMes}`;
    const normalizarEtiqueta = (texto = "") =>
      texto.toString().trim().toUpperCase().replace(/\s+/g, " ");
    const debeOmitirEtiqueta = () => false;
    const normalizarLabel = (texto = "") =>
      texto
        .toString()
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .replace(/\s+/g, " ");

    const totalesCero = () => ({
      actualMonth: 0,
      planMonth: 0,
      prevMonth: 0,
      actualYTD: 0,
      planYTD: 0,
      prevYTD: 0,
    });

    const recalcularPrincipales = (layoutArr = []) => {
      return;
      if (!Array.isArray(layoutArr) || !layoutArr.length) return;
      let principalActual = null;
      let acumulado = totalesCero();
      const applySign = (valor, signo = 1) =>
        Number.isFinite(signo) ? signo : 1;
      const asignarAcumulado = () => {
        if (principalActual) {
          principalActual.totals = { ...acumulado };
        }
      };
      layoutArr.forEach((block) => {
        const tipo = (block.type || "").toLowerCase();
        if (tipo === "principal") {
          // Cierra el anterior y abre uno nuevo
          asignarAcumulado();
          principalActual = block;
          acumulado = totalesCero();
          return;
        }
        if (!principalActual) return;
        if (tipo === "secundaria") {
          const sign = applySign(block.sign, 1);
          const t = block.totals || {};
          acumulado.actualMonth += toNumber(t.actualMonth) * sign;
          acumulado.planMonth += toNumber(t.planMonth) * sign;
          acumulado.prevMonth += toNumber(t.prevMonth) * sign;
          acumulado.actualYTD += toNumber(t.actualYTD) * sign;
          acumulado.planYTD += toNumber(t.planYTD) * sign;
          acumulado.prevYTD += toNumber(t.prevYTD) * sign;
        }
        // Si aparece otra consolidación de nivel superior, no cerramos aquí; se recalcula después.
      });
      asignarAcumulado();
    };

    const recalcularConsolidados = (layoutArr = [], capituloName = "") => {
      return;
      if (!Array.isArray(layoutArr) || !layoutArr.length) return;
      const capituloNormalizado = normalizarLabel(capituloName);
      const esCapituloMexico = capituloNormalizado === "CIUDAD DE MEXICO";
      const esCapituloGuadalajara = capituloNormalizado === "GUADALAJARA";
      const esCapituloNoreste =
        capituloNormalizado === "NORESTE" || capituloNormalizado === "NE";
      const esCapituloNoroeste = ["NOROESTE", "NO", "NORTHWEST"].includes(
        capituloNormalizado
      );
      const labelMap = new Map(
        layoutArr.map((b) => [normalizarLabel(b.label || ""), b])
      );
      const obtenerPorLabels = (candidatos = []) => {
        for (const lbl of candidatos) {
          const block = labelMap.get(normalizarLabel(lbl));
          if (block) return block.totals || totalesCero();
        }
        return totalesCero();
      };
      const asignarPrimero = (labels = [], totals) => {
        for (const lbl of labels) {
          const block = labelMap.get(normalizarLabel(lbl));
          if (block && totals) {
            block.totals = totals;
            return block;
          }
        }
        return null;
      };

      const INCOME_LABELS = {
        mex: ["CDMX INCOME", "MEXICO INCOME", "INCOME"],
        gdl: ["GUADALAJARA INCOME", "GDL INCOME"],
        mty: ["MONTERREY INCOME", "MTY INCOME"],
        nw: ["NORTHWEST INCOME", "NW INCOME", "NOROESTE INCOME", "NO INCOME"],
        ne: ["NE INCOME", "NORESTE INCOME"],
      };
      const EXPENSE_LABELS = {
        mex: ["CDMX EXPENSE", "MEXICO EXPENSE", "EXPENSE"],
        gdl: ["GUADALAJARA EXPENSE", "GDL EXPENSE"],
        mty: ["MONTERREY EXPENSE", "MTY EXPENSE"],
        nw: [
          "NORTHWEST EXPENSE",
          "NW EXPENSE",
          "NOROESTE EXPENSE",
          "NO EXPENSE",
        ],
        ne: ["NE EXPENSE", "NORESTE EXPENSE"],
      };
      const sumaTotales = (dest, src, signo = 1) => {
        if (!src) return;
        dest.actualMonth += toNumber(src.actualMonth) * signo;
        dest.planMonth += toNumber(src.planMonth) * signo;
        dest.prevMonth += toNumber(src.prevMonth) * signo;
        dest.actualYTD += toNumber(src.actualYTD) * signo;
        dest.planYTD += toNumber(src.planYTD) * signo;
        dest.prevYTD += toNumber(src.prevYTD) * signo;
      };
      const totalesCero = () => ({
        actualMonth: 0,
        planMonth: 0,
        prevMonth: 0,
        actualYTD: 0,
        planYTD: 0,
        prevYTD: 0,
      });
      const combinar = (sumarLabels = [], restarLabels = []) => {
        const res = totalesCero();
        sumarLabels.forEach((lbl) =>
          sumaTotales(res, labelMap.get(normalizarLabel(lbl))?.totals, 1)
        );
        restarLabels.forEach((lbl) =>
          sumaTotales(res, labelMap.get(normalizarLabel(lbl))?.totals, -1)
        );
        return res;
      };
      const asignar = (label, totals) => {
        const block = labelMap.get(normalizarLabel(label));
        if (block && totals) {
          block.totals = totals;
        }
      };

      // Operating Results por plaza antes de los consolidados globales
      const opResults = {
        mex: combinar(INCOME_LABELS.mex, EXPENSE_LABELS.mex),
        gdl: combinar(INCOME_LABELS.gdl, EXPENSE_LABELS.gdl),
        mty: combinar(INCOME_LABELS.mty, EXPENSE_LABELS.mty),
        nw: combinar(INCOME_LABELS.nw, EXPENSE_LABELS.nw),
        ne: combinar(INCOME_LABELS.ne, EXPENSE_LABELS.ne),
      };
      asignarPrimero(["OPERATING RESULTS MEXICO"], opResults.mex);
      asignarPrimero(
        ["OPERATING RESULTS GUADALAJARA", "GDL OPERATING RESULTS"],
        opResults.gdl
      );
      asignarPrimero(
        ["OPERATING RESULTS MONTERREY", "MTY OPERATING RESULTS"],
        opResults.mty
      );
      asignarPrimero(
        [
          "OPERATING RESULTS NORTHWEST",
          "OPERATING RESULTS NO",
          "OPERATING RESULTS NOROESTE",
          "NO OPERATING RESULTS",
        ],
        opResults.nw
      );
      asignarPrimero(
        [
          "OPERATING RESULTS NE",
          "NE OPERATING RESULTS",
          "OPERATING RESULTS NORESTE",
        ],
        opResults.ne
      );

      // NET RESULTS por plaza según la lógica indicada
      const memberCentricityMx = obtenerPorLabels([
        "MEMBER CENTRICITY",
        "Member Centricity",
        "Member Centricity CDMX",
        "Member Centricity Mexico",
      ]);
      const memberCentricityGdl = obtenerPorLabels([
        "Member Centricity GDL",
        "Member Centricity Guadalajara",
        "GDL Member Centricity",
        "Guadalajara Member Centricity",
        "Member Centricity",
      ]);
      const memberCentricityNe = obtenerPorLabels([
        "Member Centricity NE",
        "Member Centricity Noreste",
        "NE Member Centricity",
        "NORESTE Member Centricity",
        "Member Centricity",
      ]);
      const memberCentricityNw = obtenerPorLabels([
        "Member Centricity NW",
        "Member Centricity NorthWest",
        "Member Centricity NO",
        "Member Centricity NOROESTE",
        "NORTHWEST Member Centricity",
        "NOROESTE Member Centricity",
        // NO incluir fallback genérico "Member Centricity" aquí
        // porque capturaría el Member Centricity de México en vistas consolidadas
      ]);
      const otherMx = obtenerPorLabels([
        "Other (MEXICO)",
        "Other Income Mexico",
      ]);
      const otherGdl = obtenerPorLabels([
        "Guadalajara Other Income",
        "GDL Other Income",
        "Other Guadalajara",
        "Other GDL",
        "Other",
        "Otros ingresos",
        "OTROS INGRESOS",
      ]);
      const otherGdlMexico = obtenerPorLabels([
        "Guadalajara Other Income",
        "GDL Other Income",
        "Other Guadalajara",
        "Other GDL",
      ]);
      const otherMty = obtenerPorLabels([
        "Monterrey Other Income",
        "MTY Other Income",
      ]);
      const otherNw = obtenerPorLabels([
        "Northwest Other Income",
        "NW Other Income",
        "NO Other Income",
        "NOROESTE Other Income",
        // NO incluir fallbacks genéricos aquí para evitar capturar valores incorrectos
      ]);
      const otherNe = obtenerPorLabels([
        "NE Other Income",
        "Noreste Other Income",
        "NE Other",
        "NORESTE Other Income",
        "Other",
        "Otros ingresos",
        "OTROS INGRESOS",
      ]);

      const netResultsDefs = [];

      if (esCapituloMexico) {
        netResultsDefs.push(
          {
            op: ["OPERATING RESULTS MEXICO"],
            mc: memberCentricityMx,
            other: otherMx,
            labels: ["NET RESULTS MEXICO"],
          },
          {
            op: ["OPERATING RESULTS GUADALAJARA", "GDL OPERATING RESULTS"],
            mc: totalesCero(),
            other: otherGdlMexico,
            labels: ["NET RESULTS GUADALAJARA", "GDL NET RESULTS"],
          },
          {
            op: ["OPERATING RESULTS MONTERREY", "MTY OPERATING RESULTS"],
            mc: totalesCero(),
            other: otherMty,
            labels: ["NET RESULTS MONTERREY", "MTY NET RESULTS"],
          },
          {
            op: [
              "OPERATING RESULTS NORTHWEST",
              "OPERATING RESULTS NO",
              "OPERATING RESULTS NOROESTE",
              "NO OPERATING RESULTS",
            ],
            mc: totalesCero(),
            other: otherNw,
            labels: [
              "NET RESULTS NORTHWEST",
              "NET RESULTS NO",
              "NET RESULTS NOROESTE",
            ],
          }
        );
      } else if (esCapituloGuadalajara) {
        netResultsDefs.push({
          op: ["OPERATING RESULTS GUADALAJARA", "GDL OPERATING RESULTS"],
          mc: memberCentricityGdl,
          other: otherGdl,
          labels: ["NET RESULTS", "NET RESULTS GUADALAJARA", "GDL NET RESULTS"],
        });
      } else if (esCapituloNoreste) {
        netResultsDefs.push({
          op: [
            "OPERATING RESULTS NE",
            "NE OPERATING RESULTS",
            "OPERATING RESULTS NORESTE",
          ],
          mc: memberCentricityNe,
          other: otherNe,
          labels: ["NET RESULTS", "NET RESULTS NE", "NET RESULTS NORESTE"],
        });
      } else if (esCapituloNoroeste) {
        netResultsDefs.push({
          op: [
            "OPERATING RESULTS NORTHWEST",
            "OPERATING RESULTS NO",
            "OPERATING RESULTS NOROESTE",
            "NO OPERATING RESULTS",
          ],
          mc: memberCentricityNw,
          other: otherNw,
          labels: [
            "NET RESULTS",
            "NET RESULTS NORTHWEST",
            "NET RESULTS NO",
            "NET RESULTS NOROESTE",
          ],
        });
      } else {
        netResultsDefs.push(
          {
            op: ["OPERATING RESULTS MEXICO"],
            mc: memberCentricityMx,
            other: otherMx,
            labels: ["NET RESULTS MEXICO"],
          },
          {
            op: ["OPERATING RESULTS GUADALAJARA", "GDL OPERATING RESULTS"],
            mc: memberCentricityGdl,
            other: otherGdl,
            labels: ["NET RESULTS GUADALAJARA", "GDL NET RESULTS"],
          },
          {
            op: ["OPERATING RESULTS MONTERREY", "MTY OPERATING RESULTS"],
            mc: totalesCero(),
            other: otherMty,
            labels: ["NET RESULTS MONTERREY", "MTY NET RESULTS"],
          },
          {
            op: [
              "OPERATING RESULTS NORTHWEST",
              "OPERATING RESULTS NO",
              "OPERATING RESULTS NOROESTE",
              "NO OPERATING RESULTS",
            ],
            mc: memberCentricityNw,
            other: otherNw,
            labels: [
              "NET RESULTS NORTHWEST",
              "NET RESULTS NO",
              "NET RESULTS NOROESTE",
            ],
          },
          {
            op: [
              "OPERATING RESULTS NE",
              "NE OPERATING RESULTS",
              "OPERATING RESULTS NORESTE",
            ],
            mc: memberCentricityNe,
            other: otherNe,
            labels: ["NET RESULTS NE", "NET RESULTS NORESTE"],
          }
        );
      }

      netResultsDefs.forEach(({ op, mc, other, labels }) => {
        const totals = combinar(op, []);
        const bloque = asignarPrimero(labels, totals);
        if (bloque) {
          bloque.totals = bloque.totals || totalesCero();
          sumaTotales(bloque.totals, mc, -1);
          sumaTotales(bloque.totals, other, 1);
        }
      });

      if (esCapituloMexico) {
        asignar(
          "CONSOLIDATED INCOME",
          combinar([
            ...INCOME_LABELS.mex,
            ...INCOME_LABELS.gdl,
            ...INCOME_LABELS.mty,
            ...INCOME_LABELS.nw,
          ])
        );
        asignar(
          "CONSOLIDATED EXPENSES",
          combinar([
            ...EXPENSE_LABELS.mex,
            ...EXPENSE_LABELS.gdl,
            ...EXPENSE_LABELS.mty,
            ...EXPENSE_LABELS.nw,
          ])
        );
        asignar(
          "CONSOLIDATED OPERATING RESULTS",
          combinar([
            "OPERATING RESULTS MEXICO",
            "OPERATING RESULTS GUADALAJARA",
            "OPERATING RESULTS MONTERREY",
            "OPERATING RESULTS NORTHWEST",
            "OPERATING RESULTS NO",
            "OPERATING RESULTS NOROESTE",
            "NO OPERATING RESULTS",
          ])
        );
        asignar(
          "CONSOLIDATED NET RESULTS",
          combinar([
            "NET RESULTS MEXICO",
            "NET RESULTS GUADALAJARA",
            "NET RESULTS MONTERREY",
            "NET RESULTS NORTHWEST",
            "NET RESULTS NO",
            "NET RESULTS NOROESTE",
          ])
        );
      }
    };

    let renderizoLayout = false;
    resumen.forEach((capitulo) => {
      const capituloName = (capitulo.label || capitulo.capitulo || "")
        .toString()
        .trim()
        .toUpperCase();
      const layout = Array.isArray(capitulo.layout)
        ? capitulo.layout.slice()
        : null;
      const principales = Array.isArray(capitulo.children)
        ? capitulo.children.slice()
        : [];
      const principalLookup = new Map(
        principales.map((principal) => [principal.label, principal])
      );

      const renderPrincipal = (principal) => {
        if (!principal) return;
        const seccionesOrdenadas = ordenarPorOrden(
          principal.children || [],
          (sec, idx) => {
            const orden = Number.isFinite(Number(sec?.orden_presentacion))
              ? Number(sec.orden_presentacion)
              : Number.isFinite(Number(sec?.ordenPresentacion))
              ? Number(sec.ordenPresentacion)
              : Number.isFinite(Number(sec?.orden))
              ? Number(sec.orden)
              : Number.isFinite(Number(sec?.order))
              ? Number(sec.order)
              : null;
            return orden != null ? orden : idx;
          }
        );


        seccionesOrdenadas.forEach((seccion) => {
          const cuentasOrdenadas = ordenarPorOrden(
            seccion.cuentas || [],
            (cta, idx) => {
              const orden = Number.isFinite(Number(cta?.orden_presentacion))
                ? Number(cta.orden_presentacion)
                : Number.isFinite(Number(cta?.ordenPresentacion))
                ? Number(cta.ordenPresentacion)
                : Number.isFinite(Number(cta?.orden))
                ? Number(cta.orden)
                : Number.isFinite(Number(cta?.order))
                ? Number(cta.order)
                : null;
              return orden != null ? orden : idx;
            }
          );

          cuentasOrdenadas.forEach((cta) => {
            const varPlan = calculateVar(cta.actualMonth, cta.planMonth);
            const varPrev = calculateVar(cta.actualMonth, cta.prevMonth);
            const varPlanYTD = calculateVar(cta.actualYTD, cta.planYTD);
            const varPrevYTD = calculateVar(cta.actualYTD, cta.prevYTD);
            const row = document.createElement("tr");
            row.className = "data-row";
            row.dataset.cuenta = cta.cuentaCanonica || cta.cuenta || "";
            row.dataset.cuenta21 = cta.cuentaCanonica || "";
            row.dataset.rowRole = "account";
            const detalleCuenta = [
              `Cuenta ${cta.cuenta || "sin codigo"} - Sección ${
                seccion.label || "sin sección"
              }${principal.label ? ` - Principal ${principal.label}` : ""}`,
              "Real: saldos COI via planeación",
              `Presupuesto: ${planColumnKey.toUpperCase()} / PRESUP01-12 (tabla PRESUPYY)`,
            ].join(" - ");
            row.setAttribute("title", detalleCuenta);
            row.setAttribute("data-bs-toggle", "tooltip");
            row.innerHTML = `
              ${createEditableCell(cta.cuenta || "", {
                columnKey: "cuenta",
                rowRole: "account",
                tooltipKey: "account",
                text: true,
                classes: "account-column font-monospace small text-start",
              })}
              ${createCell(cta.actualMonth, {
                rowRole: "account",
                tooltipKey: "actualMonth",
              })}
              ${createCell(cta.planMonth, {
                rowRole: "account",
                tooltipKey: "planMonth",
              })}
              ${createCell(cta.prevMonth, {
                rowRole: "account",
                tooltipKey: "prevMonth",
              })}
              ${createPercentCell(varPlan, {
                rowRole: "account",
                tooltipKey: "varMonthPlan",
              })}
              ${createPercentCell(varPrev, {
                rowRole: "account",
                tooltipKey: "varMonthPrev",
              })}
              ${createEditableCell(cta.descripcion || "", {
                columnKey: "descripcion",
                rowRole: "account",
                tooltipKey: "account",
                text: true,
                classes: "text-center",
              })}
              ${createCell(cta.actualYTD, {
                rowRole: "account",
                tooltipKey: "actualYTD",
              })}
              ${createCell(cta.planYTD, {
                rowRole: "account",
                tooltipKey: "planYTD",
              })}
              ${createCell(cta.prevYTD, {
                rowRole: "account",
                tooltipKey: "prevYTD",
              })}
              ${createPercentCell(varPlanYTD, {
                rowRole: "account",
                tooltipKey: "varYtdPlan",
              })}
              ${createPercentCell(varPrevYTD, {
                rowRole: "account",
                tooltipKey: "varYtdPrev",
              })}
            `;
            tablaBody.appendChild(row);
          });

          tablaBody.appendChild(
            createResumenTotalsRow(seccion, {
              label: seccion.label || seccion.nombre || "",
              rowRole: "section",
              rowClass: "sum-row fw-semibold",
              rowContext: {
                label: seccion.label || seccion.nombre || "",
                principal: principal.label || "",
                cuentas: seccion.cuentas || [],
              },
            })
          );
        });

        tablaBody.appendChild(
          createResumenTotalsRow(principal, {
            label: principal.label || "",
            rowRole: "principal",
            rowClass: "section-header-row table-light fw-bold",
            rowContext: {
              label: principal.label || "",
              sections: seccionesOrdenadas.map((sec) => sec.label || ""),
              sign: principal.sign,
            },
          })
        );
      };

      // Renderizar usando SOLO el layout (que ya tiene todo en orden correcto)
      if (layout && layout.length) {
        renderizoLayout = true;
        recalcularPrincipales(layout);
        recalcularConsolidados(layout, capituloName);
        layout.forEach((block) => {
          const blockType = block.type || "";

          // PRINCIPAL: Header de sección principal
          if (blockType === "principal") {
            const principalRow = createResumenTotalsRow(block.totals || {}, {
              label: block.label || "",
              rowRole: "principal",
              rowClass: "section-header-row table-info fw-bold text-center",
              rowContext: {
                label: block.label || "",
                sections: (block.children || []).map((ch) => ch.label || ""),
                sign: 1,
              },
            });
            tablaBody.appendChild(principalRow);
          }
          // SECUNDARIA: Header de subsección
          else if (blockType === "secundaria") {
            const secRowClass =
              "subsection-row bg-light fw-semibold text-center collapsible-section";
            const secRow = createResumenTotalsRow(block.totals || {}, {
              label: block.label || "",
              rowRole: "section",
              rowClass: secRowClass,
              rowContext: {
                label: block.label || "",
                principal: "",
                cuentas: block.cuentas || [],
              },
            });
            // Agregar icono de colapso en la primera celda con texto
            const cells = secRow.querySelectorAll("td");
            if (cells[6]) {
              cells[6].innerHTML = `<i class="bi bi-chevron-down collapse-icon me-2" style="cursor:pointer;"></i>${
                block.label || ""
              }`;
              cells[6].style.cursor = "pointer";
              cells[6].classList.add("collapse-trigger");
              secRow.dataset.sectionName = block.label || "";
            }
            tablaBody.appendChild(secRow);
          }
          // CUENTA: Fila de datos
          else if (blockType === "cuenta") {
            const cta = block.totals || {};
            const varPlan = calculateVar(cta.actualMonth, cta.planMonth);
            const varPrev = calculateVar(cta.actualMonth, cta.prevMonth);
            const varPlanYTD = calculateVar(cta.actualYTD, cta.planYTD);
            const varPrevYTD = calculateVar(cta.actualYTD, cta.prevYTD);

            const row = document.createElement("tr");
            row.className = "account-row section-child";
            row.dataset.cuenta = block.cuenta || "";
            row.dataset.cuenta21 = block.cuenta || "";
            row.dataset.rowRole = "account";

            // Usar block.nombre (del JSON NOMBRE) en vez de block.label
            const nombreCuenta =
              block.descripcion || block.nombre || block.label || "";

            row.innerHTML = `
              ${createEditableCell(block.cuenta || "", {
                columnKey: "cuenta",
                rowRole: "account",
                tooltipKey: "account",
                text: true,
                classes: "account-column font-monospace small text-start ps-4",
              })}
              ${createCell(cta.actualMonth, {
                rowRole: "account",
                tooltipKey: "actualMonth",
              })}
              ${createCell(cta.planMonth, {
                rowRole: "account",
                tooltipKey: "planMonth",
              })}
              ${createCell(cta.prevMonth, {
                rowRole: "account",
                tooltipKey: "prevMonth",
              })}
              ${createPercentCell(varPlan, {
                rowRole: "account",
                tooltipKey: "varMonthPlan",
              })}
              ${createPercentCell(varPrev, {
                rowRole: "account",
                tooltipKey: "varMonthPrev",
              })}
              ${createEditableCell(nombreCuenta, {
                columnKey: "descripcion",
                rowRole: "account",
                tooltipKey: "account",
                text: true,
                classes: "text-center",
              })}
              ${createCell(cta.actualYTD, {
                rowRole: "account",
                tooltipKey: "actualYTD",
              })}
              ${createCell(cta.planYTD, {
                rowRole: "account",
                tooltipKey: "planYTD",
              })}
              ${createCell(cta.prevYTD, {
                rowRole: "account",
                tooltipKey: "prevYTD",
              })}
              ${createPercentCell(varPlanYTD, {
                rowRole: "account",
                tooltipKey: "varYtdPlan",
              })}
              ${createPercentCell(varPrevYTD, {
                rowRole: "account",
                tooltipKey: "varYtdPrev",
              })}
            `;
            tablaBody.appendChild(row);
          }
          // OPERACION LIBRE: fila calculada desde fórmula manual
          else if (blockType === "operation") {
            // Usar el estilo visual personalizado si existe
            const rowStyle = block.rowStyle || block.estilo_fila || "operation-row";
            const rowClass = `${rowStyle} free-operation-row fw-semibold`;
            
            const opRow = createResumenTotalsRow(block.totals || {}, {
              label: block.label || "",
              rowRole: "operation",
              rowClass: rowClass,
              rowContext: {
                label: block.label || "",
                type: blockType,
              },
            });
            tablaBody.appendChild(opRow);
          }
          // CONSOLIDACIONES: Filas de suma con jerarquía visual
          else if (["group", "result", "net", "final"].includes(blockType)) {
            // Determinar clase CSS según tipo y label
            let rowClass = "";
            const label = (block.label || "").toUpperCase();

            // Nivel 5: NET RESULTS (máxima jerarquía)
            if (
              blockType === "final" ||
              label.includes("NET RESULTS") ||
              label.includes("CONSOLIDATED NET")
            ) {
              rowClass = "highlight-bright text-white fw-bold";
            }
            // Nivel 4: OPERATING RESULTS
            else if (
              label.includes("OPERATING RESULTS") ||
              label.includes("OPERATING INCOME")
            ) {
              rowClass = "highlight-secondary fw-bold";
            }
            // Nivel 3: CONSOLIDATED INCOME/EXPENSES
            else if (
              label.includes("CONSOLIDATED") &&
              (label.includes("INCOME") || label.includes("EXPENSE"))
            ) {
              rowClass = "highlight-primary fw-bold text-uppercase";
            }
            // Nivel 2: Principal (INCOME, EXPENSE sin CONSOLIDATED)
            else if (
              (label.includes("INCOME") || label.includes("EXPENSE")) &&
              !label.includes("CONSOLIDATED")
            ) {
              rowClass = "sum-row-principal fw-bold";
            }
            // Nivel 1: Sumas de sección
            else {
              rowClass = "sum-row fw-semibold";
            }

            const consolidationRow = createResumenTotalsRow(
              block.totals || {},
              {
                label: block.label || "",
                rowRole: blockType,
                rowClass,
                rowContext: {
                  label: block.label || "",
                  type: blockType,
                  principals: block.principals || [],
                  operaciones: block.operaciones || [],
                },
              }
            );
            tablaBody.appendChild(consolidationRow);
          }
        });
      }
    });

    if (!renderizoLayout) {
      setStatusRow(
        "No hay layout definido para este capítulo/año. Usa el Gestor de Plantillas."
      );
      return;
    }

    sincronizarCeldasEditables();
    activateTooltips();
    autoCollapseExcludedSections();
    habilitarColapsoGastosAdministrativos();
    wireCollapseControls();
    aplicarStickyEncabezados();
    bindStickyResize();
  };

  const actualizarEtiquetasAnio = (anio) => {
    const yearAct = document.querySelectorAll(".year-act");
    const yearPrev = document.querySelectorAll(".year-prev");
    const anioNum = Number(anio);
    const anioAnterior = Number.isFinite(anioNum) ? anioNum - 1 : anio;

    yearAct.forEach((el) => (el.textContent = anio));
    yearPrev.forEach((el) => (el.textContent = anioAnterior));
    if (yearLabel) {
      yearLabel.textContent = anio;
    }
  };

  const actualizarEtiquetaMes = (mesSeleccionado) => {
    const mesInfo = MESES.find((m) => m.periodo === mesSeleccionado);
    const clave = mesInfo?.clave || "DIC";

    // Actualizar etiquetas del mes actual en mayúsculas
    document.querySelectorAll(".mes-actual").forEach((span) => {
      span.textContent = clave.toUpperCase();
    });

    if (periodLabel) {
      const nombreMes = (mesInfo?.etiqueta || clave).toUpperCase();
      const anioActual = leerAnioSeleccionado();
      periodLabel.textContent = anioActual
        ? `${nombreMes} ${anioActual}`
        : nombreMes;
    }
    actualizarPanelGraficasMeta();
  };

  const actualizarEncabezado = (empresaId, anio) => {
    if (yearLabel && Number.isInteger(anio)) {
      yearLabel.textContent = anio;
    }
    const etiqueta =
      obtenerCapituloEmpresa(empresaId) || obtenerEtiquetaEmpresa(empresaId);
    if (empresaLabel) {
      empresaLabel.textContent = etiqueta || "";
    }
    actualizarPanelGraficasMeta();
  };

  const obtenerSelectorEmpresaGlobal = () =>
    window.parent?.document?.getElementById("companyFilter") || null;
  const sincronizarSelectorEmpresaGlobal = () => {
    const selector = obtenerSelectorEmpresaGlobal();
    if (!selector) return;
    selector.addEventListener("change", async () => {
      const nuevoId = selector.value;
      if (!nuevoId) return;
      const empresaLocal = Sesion.obtenerEmpresaActiva();
      if (empresaLocal?.id === nuevoId) return;
      Sesion.establecerEmpresaActiva(nuevoId);
      empresaActual = Sesion.obtenerEmpresaActiva();
      await aplicarEmpresaResumen(empresaActual?.id);
    });
  };

  const cargarAniosDisponibles = async (empresaId, preferido) => {
    if (!yearSelect) return [];

    try {
      const response = await fetch(
        `${API_ANIOS}?empresaId=${encodeURIComponent(empresaId)}`,
        {
          headers: Sesion.headersAutenticacion(),
        }
      );

      if (manejarSesionExpirada(response)) return [];

      if (!response.ok) {
        throw new Error("No fue posible obtener años disponibles");
      }

      const data = await response.json();
      const anios = (data.anios || [])
        .filter((a) => Number.isInteger(a))
        .sort((a, b) => b - a);

      yearSelect.innerHTML = "";
      if (!anios.length) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "Sin años disponibles";
        yearSelect.appendChild(option);
        return [];
      }

      anios.forEach((ano) => {
        const option = document.createElement("option");
        option.value = ano;
        option.textContent = ano;
        yearSelect.appendChild(option);
      });

      const seleccionado = elegirAnioDisponible(anios, preferido);
      yearSelect.value = String(seleccionado);
      yearSelect.disabled = false;

      return anios;
    } catch (error) {
      console.error("Error cargando años:", error);
      yearSelect.innerHTML = '<option value="">Error cargando años</option>';
      yearSelect.disabled = true;
      return [];
    }
  };

  const consultarResumen = async ({ empresaId, anio, mes, capitulo }) => {
    const params = new URLSearchParams({
      empresaId: empresaId,
      anio: Number(anio),
    });
    params.set("mes", String(mes));
    if (capitulo) params.set("capitulo", capitulo);

    const respuesta = await fetch(`${API_ENDPOINT}?${params.toString()}`, {
      headers: Sesion.headersAutenticacion(),
    });
    if (manejarSesionExpirada(respuesta)) return null;

    let payload = null;
    try {
      const texto = await respuesta.text();
      payload = texto ? JSON.parse(texto) : null;
    } catch (_) {
      payload = null;
    }

    if (!respuesta.ok) {
      const detalle =
        payload?.detalle ||
        payload?.mensaje ||
        payload?.error ||
        respuesta.statusText ||
        "Error desconocido";
      const err = new Error(detalle);
      err.status = respuesta.status;
      err.payload = payload;
      throw err;
    }
    return payload;
  };

  const fetchResumen = async (empresaId, anio, mes) => {
    if (!empresaId || !anio) return;
    const mesEntero = Number(mes);
    
    // Validar que el mes sea un número válido entre 1 y 12
    if (!Number.isInteger(mesEntero) || mesEntero < 1 || mesEntero > 12) {
      console.error('fetchResumen: mes inválido', mes, mesEntero);
      return;
    }
    
    setStatusRow("Cargando resumen financiero...");
    actualizarMesContexto(mesEntero);
    try {
      // Usar capítulo derivado de la empresa activa
      const capitulo = obtenerCapituloEmpresa(empresaId);
      const comparativaOk = comparativaDisponible(empresaId);
      const usarComparativa = comparativaToggle?.checked === true && comparativaOk;
      const empresaComparativaId = usarComparativa
        ? obtenerEmpresaComparativaId(empresaId)
        : null;

      if (
        (comparativaToggle?.checked && !comparativaOk) ||
        (usarComparativa && !empresaComparativaId && comparativaToggle)
      ) {
        comparativaToggle.checked = false;
        localStorage.setItem(COMPARATIVA_STORAGE_KEY, "0");
      }

      const datos = await consultarResumen({
        empresaId,
        anio,
        mes: mesEntero,
        capitulo,
      });
      if (!datos) return;
      const anioNumero = Number(anio);
      aplicarLayoutPersistente(empresaId, anioNumero, datos?.resumen || []);
      let resumenFinal = datos.resumen || [];

      if (empresaComparativaId) {
        try {
          const datosComparativo = await consultarResumen({
            empresaId: empresaComparativaId,
            anio,
            mes: mesEntero,
            capitulo,
          });
          if (datosComparativo?.resumen?.length) {
            resumenFinal = aplicarComparativoResumen(
              resumenFinal,
              datosComparativo.resumen
            );
          }
          limpiarErrorComparativa(empresaId);
        } catch (errorComparativo) {
          console.warn(
            "No se pudo cargar el comparativo del año anterior.",
            errorComparativo
          );
          const status = errorComparativo?.status;
          const detalle =
            errorComparativo?.payload?.detalle ||
            errorComparativo?.payload?.mensaje ||
            errorComparativo?.message ||
            "Error desconocido";
          const empresaLabel =
            extraerNumeroEmpresa(empresaComparativaId) ||
            empresaComparativaId;
          const mensaje = `Comparativo no disponible (empresa ${empresaLabel}). ${detalle}${
            status ? ` [HTTP ${status}]` : ""
          }`;
          registrarErrorComparativa(empresaId, mensaje);
          marcarComparativaNoDisponible(empresaId);
          actualizarComparativaUI(empresaId);
          if (typeof showToast === "function") {
            showToast(mensaje, "text-bg-warning");
          }
        }
      }

      renderResumen(resumenFinal, mesEntero);

      // Esperar a que el DOM se actualice completamente antes de capturar el snapshot
      requestAnimationFrame(() => {
        const capituloLabel = obtenerCapituloEmpresa(empresaId) || "";
        const snapshot = capturarTablaResumen(
          empresaId,
          anioNumero,
          Number.isInteger(mesEntero) ? mesEntero : mes,
          capituloLabel
        );
        if (snapshot) {
          guardarSnapshotTabla(snapshot);
          console.log(
            "📸 RESUMEN: Snapshot guardado con éxito",
            snapshot.filas.length,
            "filas"
          );
        } else {
          console.warn("📸 RESUMEN: No se pudo capturar snapshot");
        }
        actualizarPanelGraficas();
      });

      actualizarEtiquetasAnio(anioNumero);
      disposeStatus();
    } catch (error) {
      console.error("Error resumen:", error);
      setStatusRow(error.message || "No fue posible cargar el resumen.");
    }
  };

  const recargarSeleccionActual = async () => {
    if (!empresaActual?.id) return;
    const anio = leerAnioSeleccionado();
    const mes = leerMesSeleccionado();
    if (!Number.isInteger(Number(anio)) || !Number.isInteger(Number(mes)))
      return;
    await fetchResumen(empresaActual.id, anio, mes);
  };

  const aplicarEmpresaResumen = async (empresaId) => {
    if (!empresaId) return;
    actualizarComparativaUI(empresaId);
    const { anio: ctxAnio, mes: ctxMes } = leerContextoPersistido();
    const anios = await cargarAniosDisponibles(
      empresaId,
      ctxAnio ?? leerAnioSeleccionado()
    );
    const valorInicial = elegirAnioDisponible(
      anios,
      ctxAnio ?? leerAnioSeleccionado()
    );
    const mesPreferido = obtenerMesPreferidoInicial(
      valorInicial,
      ctxMes ?? leerMesSeleccionado()
    );
    const mesInicial = elegirMesValido(mesPreferido, valorInicial);
    if (yearSelect) yearSelect.value = String(valorInicial);
    if (monthSelect) monthSelect.value = String(mesInicial);

    actualizarEncabezado(empresaId, valorInicial);
    actualizarMesContexto(mesInicial);
    actualizarEtiquetaMes(mesInicial);
    persistirContextoSeleccion(valorInicial, mesInicial);
    window.dispatchEvent(
      new CustomEvent("planeacion:contexto-actualizado", {
        detail: {
          empresaId,
          anio: valorInicial,
          periodo: mesInicial,
          modulo: (document.body.dataset.modulo || "RESUMEN").toUpperCase(),
        },
      })
    );
    await fetchResumen(empresaId, valorInicial, mesInicial);
  };

  const filterRows = (termino) => {
    if (!tablaBody) return;
    const texto = (termino || "").toLowerCase();
    const filas = Array.from(tablaBody.querySelectorAll("tr"));
    filas.forEach((fila) => {
      const contenido = (fila.textContent || "").toLowerCase();
      fila.classList.toggle("d-none", texto && !contenido.includes(texto));
    });
  };

  const obtenerMesInfo = (mesNumero) =>
    MESES.find((m) => m.periodo === Number(mesNumero));

  const sanitizeFileName = (texto, fallback = "resumen") =>
    (texto || fallback || "resumen")
      .toString()
      .trim()
      .replace(/[\\/:*?"<>|]/g, "_")
      .replace(/\s+/g, "_")
      .replace(/_+/g, "_");

  const construirMetadataExportacion = () => {
    const anio = leerAnioSeleccionado();
    const mes = leerMesSeleccionado();
    const mesInfo = obtenerMesInfo(mes);
    const empresaTexto =
      (empresaLabel?.textContent || "").trim() ||
      obtenerCapituloEmpresa(empresaActual?.id) ||
      obtenerEtiquetaEmpresa(empresaActual?.id) ||
      "Empresa";
    const mesNombre = mesInfo?.etiqueta || `Mes-${mes || ""}`;
    const titulo = `${empresaTexto} - ${mesNombre} ${anio || ""}`
      .replace(/\s+/g, " ")
      .trim();
    const baseName = sanitizeFileName(
      `Resumen_${empresaTexto || "Empresa"}_${mesNombre}_${anio || ""}`,
      "Resumen"
    );
    return { anio, mes, mesNombre, empresaTexto, baseName, titulo };
  };

  const imprimirTablaPdf = async () => {
    const tabla = document.getElementById("tablaComparacion");
    if (!tabla) {
      if (typeof showToast === "function") {
        showToast("No hay tabla para imprimir.", "text-bg-warning");
      }
      return;
    }

    // Verificar si html2canvas y jsPDF están disponibles para incluir gráficas
    if (typeof html2canvas !== 'undefined' && typeof jspdf !== 'undefined') {
      await imprimirPdfConGraficas();
      return;
    }

    // Fallback a impresión simple sin gráficas
    const { titulo, mesNombre, anio, empresaTexto } =
      construirMetadataExportacion();
    const tablaClon = tabla.cloneNode(true);
    const ventana = window.open("", "_blank", "width=1200,height=900");
    if (!ventana) {
      alert("Activa las ventanas emergentes para imprimir el resumen.");
      return;
    }

    const estilosImpresion = `
      * { box-sizing: border-box; }
      body { font-family: 'Manrope','Segoe UI',sans-serif; padding: 20px; color: #0f172a; }
      h1 { margin: 0 0 6px 0; font-size: 20px; color: #1e3a8a; }
      .meta { margin: 0 0 14px 0; color: #334155; font-size: 12px; }
      table { width: 100%; border-collapse: collapse; font-size: 10px; }
      th, td { border: 1px solid #cbd5e1; padding: 5px 6px; text-align: right; }
      th { background: #cbd5e1; color: #0f172a; font-weight: 700; }
      td.text-start, th.account-column-header, td.account-column { text-align: left; }
      
      /* Sección principal - Azul oscuro con texto blanco */
      .section-header-row td { background: #1e3a8a !important; color: white !important; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
      
      /* Subsección - Azul claro con texto azul oscuro */
      .subsection-row td { background: #dbeafe !important; color: #1e3a8a !important; font-weight: 600; font-style: italic; border-left: 3px solid #3b82f6; }
      
      /* Filas de cuenta normales */
      .account-row td { background: #ffffff; }
      .account-row td:first-child { color: #6b7280; font-family: 'Courier New', monospace; font-size: 9px; }
      
      /* Categoría */
      .category-cell { background: #e5e7eb !important; font-weight: 700; }
      
      /* Suma nivel 1 - Amarillo */
      .sum-row td { background: #fef3c7 !important; font-weight: 700; color: #78350f !important; border-left: 3px solid #f59e0b; }
      
      /* Suma principal - Violeta */
      .sum-row-principal td { background: #ddd6fe !important; font-weight: 700; color: #5b21b6 !important; text-transform: uppercase; }
      
      /* Consolidado - Verde */
      .highlight-primary td { background: #a7f3d0 !important; font-weight: 700; color: #065f46 !important; text-transform: uppercase; }
      
      /* Operating Results - Cyan */
      .highlight-secondary td { background: #a5f3fc !important; font-weight: 700; color: #0e7490 !important; text-transform: uppercase; }
      
      /* Net Results - Rojo con borde */
      .highlight-bright td { background: #fecaca !important; font-weight: 800; color: #991b1b !important; text-transform: uppercase; border-top: 2px solid #dc2626; border-bottom: 2px solid #dc2626; }
      
      /* Ocultar columnas de cuenta si está activo */
      .sin-cuentas .col-cuenta, .sin-cuentas .account-column, .sin-cuentas .account-column-header { display: none; }
      
      @media print {
        body { padding: 10px; }
        table { font-size: 9px; }
        th, td { padding: 4px 5px; }
      }
    `;

    ventana.document.write(`<!DOCTYPE html>
    <html>
      <head>
        <title>${titulo || "Resumen"}</title>
        <style>${estilosImpresion}</style>
      </head>
      <body>
        <h1>Resumen financiero</h1>
        <p class="meta">
          Empresa: ${empresaTexto || "-"}<br>
          Periodo: ${mesNombre} ${anio || ""}
        </p>
        ${tablaClon.outerHTML}
        <script>
          window.onload = function() {
            window.focus();
            window.print();
            setTimeout(function() { window.close(); }, 300);
          };
        <\/script>
      </body>
    </html>`);
    ventana.document.close();
  };

  const imprimirPdfConGraficas = async () => {
    try {
      const { jsPDF } = jspdf;
      const doc = new jsPDF('l', 'mm', 'a4'); // Landscape
      
      const { titulo, mesNombre, anio, empresaTexto } = construirMetadataExportacion();
      
      // === PÁGINA 1: Tabla de Resumen ===
      const tabla = document.getElementById('tablaComparacion');
      
      // Título
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('RESUMEN FINANCIERO', 15, 15);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Empresa: ${empresaTexto}`, 15, 22);
      doc.text(`Periodo: ${mesNombre} ${anio}`, 15, 27);
      
      // Usar autoTable para la tabla con encabezados HTML completos
      if (typeof doc.autoTable === 'function' && tabla) {
        const thead = tabla.querySelector('thead');
        const tbody = tabla.querySelector('tbody');
        
        // Procesar encabezados respetando colspan, rowspan, y saltos de línea
        const headers = [];
        if (thead) {
          const headerRows = Array.from(thead.querySelectorAll('tr'));
          headerRows.forEach(row => {
            const headerRow = [];
            const cells = Array.from(row.querySelectorAll('th'));
            
            cells.forEach(cell => {
              // Extraer texto con saltos de línea preservados
              let texto = cell.textContent.trim();
              // Reemplazar múltiples espacios/saltos por salto simple
              texto = texto.replace(/\s+/g, ' ').trim();
              
              const colspan = parseInt(cell.getAttribute('colspan')) || 1;
              const rowspan = parseInt(cell.getAttribute('rowspan')) || 1;
              
              // Configurar celda con formato
              const cellConfig = {
                content: texto,
                colSpan: colspan,
                rowSpan: rowspan,
                styles: { 
                  halign: 'center', 
                  valign: 'middle',
                  fontStyle: 'bold',
                  fontSize: 7,
                  cellPadding: 2,
                  lineColor: [200, 200, 200],
                  lineWidth: 0.1
                }
              };
              
              headerRow.push(cellConfig);
            });
            
            headers.push(headerRow);
          });
        }

        // Procesar cuerpo de la tabla
        const body = [];
        if (tbody) {
          const bodyRows = Array.from(tbody.querySelectorAll('tr')).slice(0, 100); // Más filas
          bodyRows.forEach(row => {
            const rowData = [];
            const cells = Array.from(row.querySelectorAll('td'));
            
            cells.forEach((cell, idx) => {
              let texto = cell.textContent.trim();
              
              // Configurar estilo según clase de fila
              let styles = { fontSize: 6, cellPadding: 1.5 };
              
              // Detectar tipo de fila por clases
              if (row.classList.contains('section-header-row')) {
                styles.fillColor = [30, 58, 138]; // Azul oscuro
                styles.textColor = 255;
                styles.fontStyle = 'bold';
                styles.fontSize = 7;
              } else if (row.classList.contains('subsection-row')) {
                styles.fillColor = [219, 234, 254]; // Azul claro
                styles.textColor = [30, 58, 138];
                styles.fontStyle = 'bolditalic';
              } else if (row.classList.contains('sum-row')) {
                styles.fillColor = [254, 243, 199]; // Amarillo
                styles.textColor = [120, 53, 15];
                styles.fontStyle = 'bold';
              } else if (row.classList.contains('highlight-bright')) {
                styles.fillColor = [254, 202, 202]; // Rojo
                styles.textColor = [153, 27, 27];
                styles.fontStyle = 'bold';
                styles.fontSize = 7;
              } else if (row.classList.contains('highlight-primary')) {
                styles.fillColor = [167, 243, 208]; // Verde
                styles.textColor = [6, 95, 70];
                styles.fontStyle = 'bold';
              } else if (row.classList.contains('highlight-secondary')) {
                styles.fillColor = [165, 243, 252]; // Cyan
                styles.textColor = [14, 116, 144];
                styles.fontStyle = 'bold';
              }
              
              // Alineación: primera y segunda columna a la izquierda, resto a la derecha
              if (idx <= 1 || idx === 6) {
                styles.halign = 'left';
              } else {
                styles.halign = 'right';
              }
              
              rowData.push({ content: texto, styles: styles });
            });
            
            body.push(rowData);
          });
        }

        doc.autoTable({
          head: headers,
          body: body,
          startY: 30,
          styles: { 
            fontSize: 7,
            cellPadding: 2,
            lineColor: [200, 200, 200],
            lineWidth: 0.1,
            overflow: 'linebreak',
            halign: 'center',
            minCellHeight: 8,
            valign: 'middle'
          },
          headStyles: { 
            fillColor: [13, 71, 161],
            textColor: 255,
            fontStyle: 'bold',
            halign: 'center',
            valign: 'middle',
            fontSize: 8,
            cellPadding: 2.5,
            minCellHeight: 10,
            overflow: 'linebreak'
          },
          columnStyles: {
            0: { halign: 'left' },     // Cuenta
            1: { halign: 'left' },     // Descripción
            7: { halign: 'left' }      // Descripción YTD
          },
          margin: { left: 30, right: 30, top: 25, bottom: 25 },
          tableWidth: 'auto',
          theme: 'grid'
        });
      }

      // === ÚLTIMAS PÁGINAS: Gráficas (una por página) ===
      const graficaData = await obtenerGraficasExportacion({
        empresaId: empresaActual?.id,
        anio,
      });
      console.log("📊 PDF: graficaData obtenidos:", graficaData.length);

      // Si no hay datos, intentar capturar imágenes del panel
      let pdfImages = [];
      if (graficaData.length === 0) {
        console.log("📊 PDF: No hay datos, intentando capturar del panel...");
        pdfImages = await capturarGraficasResumenDesdePanel();
        // Si no hay imágenes, forzar apertura del panel
        if (!pdfImages.length) {
          const panel = document.getElementById("resumenChartsPanel");
          const wasHidden = panel && !panel.classList.contains("open");
          if (wasHidden && panel) {
            panel.classList.add("open");
            panel.style.position = "absolute";
            panel.style.left = "-10000px";
            panel.style.visibility = "hidden";
          }
          await new Promise((r) => setTimeout(r, 500));
          pdfImages = await capturarGraficasResumenDesdePanel();
          if (wasHidden && panel) {
            panel.classList.remove("open");
            panel.style.position = "";
            panel.style.left = "";
            panel.style.visibility = "";
          }
        }
        console.log("📊 PDF: imágenes capturadas del panel:", pdfImages.length);
      }

      // Renderizar gráficas desde datos
      if (graficaData.length > 0) {
        const canvas = document.createElement('canvas');
        canvas.width = 2400;  // Alta resolución igual que Excel
        canvas.height = 1200;
        canvas.style.display = 'none';
        document.body.appendChild(canvas);

        for (const data of graficaData) {
          doc.addPage();
          
          doc.setFontSize(16);
          doc.setFont('helvetica', 'bold');
          doc.text('GRÁFICAS DE ANÁLISIS', 15, 15);
          
          doc.setFontSize(14);
          doc.text(data.titulo, 15, 25);
          
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          const chart = new Chart(ctx, {
            type: data.type || 'bar',
            data: {
              labels: data.labels,
              datasets: data.datasets
            },
            options: {
              responsive: false,
              maintainAspectRatio: false,
              plugins: {
                legend: { 
                  display: true,
                  position: 'bottom',
                  labels: { 
                    font: { size: 24, weight: 'bold' },
                    padding: 30,
                    usePointStyle: true,
                    boxWidth: 20
                  }
                },
                title: {
                  display: false
                }
              },
              scales: {
                y: { 
                  beginAtZero: true,
                  ticks: { 
                    font: { size: 20 },
                    callback: function(value) {
                      return value.toLocaleString('es-MX', { maximumFractionDigits: 0 });
                    }
                  },
                  grid: { 
                    color: 'rgba(0,0,0,0.08)',
                    lineWidth: 2
                  }
                },
                x: {
                  ticks: { font: { size: 18 } },
                  grid: { display: false }
                }
              },
              layout: {
                padding: {
                  left: 30,
                  right: 30,
                  top: 100,
                  bottom: 30
                }
              },
              barPercentage: 0.7
            },
            plugins: [{
              id: 'customDataLabels',
              afterDatasetsDraw: function(chart) {
                const ctx = chart.ctx;
                chart.data.datasets.forEach(function(dataset, i) {
                  const meta = chart.getDatasetMeta(i);
                  if (!meta.hidden) {
                    meta.data.forEach(function(element, index) {
                      const value = dataset.data[index];
                      if (value === 0) return;
                      
                      ctx.fillStyle = '#000';
                      ctx.font = 'bold 22px Arial';
                      ctx.textAlign = 'center';
                      ctx.textBaseline = 'bottom';
                      
                      const dataString = value.toLocaleString('es-MX', { maximumFractionDigits: 0 });
                      
                      // Colocar el texto arriba de la barra (fuera)
                      const yOffset = value >= 0 ? -15 : 30;
                      ctx.fillText(dataString, element.x, element.y + yOffset);
                    });
                  }
                });
              }
            }]
          });

          await new Promise(resolve => setTimeout(resolve, 200));

          const imgData = canvas.toDataURL('image/png');
          doc.addImage(imgData, 'PNG', 15, 35, 270, 160);

          chart.destroy();
        }

        document.body.removeChild(canvas);
      } else if (pdfImages.length > 0) {
        // Insertar imágenes capturadas del panel si no hubo datos programáticos
        console.log("📊 PDF: Insertando", pdfImages.length, "imágenes capturadas");
        for (const img of pdfImages) {
          if (!esDataUrlImagenValida(img?.dataUrl)) continue;
          doc.addPage();
          doc.setFontSize(16);
          doc.setFont('helvetica', 'bold');
          doc.text('GRÁFICAS DE ANÁLISIS', 15, 15);
          doc.setFontSize(14);
          doc.text(img.title || 'Gráfica', 15, 25);
          doc.addImage(img.dataUrl, 'PNG', 15, 35, 270, 160);
        }
      }

      // Guardar PDF
      doc.save(`RESUMEN_${empresaTexto}_${anio}_${mesNombre}.pdf`);
      
      if (typeof showToast === "function") {
        showToast("✅ PDF con gráficas generado correctamente.");
      }
    } catch (error) {
      console.error('Error al generar PDF con gráficas:', error);
      if (typeof showToast === "function") {
        showToast("Error al generar PDF. Verifica la consola.", "text-bg-danger");
      }
    }
  };

  const esDataUrlImagenValida = (valor) =>
    typeof valor === "string" &&
    /^data:image\/(png|jpe?g|webp);base64,/i.test(valor.trim()) &&
    valor.trim().length > 128;

  const descargarBufferExcel = (buffer, nombreArchivo) => {
    if (!buffer) return;
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombreArchivo || "Resumen.xlsx";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const renderizarImagenesGraficasResumen = async (graficas = []) => {
    if (!Array.isArray(graficas) || !graficas.length) {
      console.log("📊 renderizarImagenesGraficasResumen: No hay gráficas para renderizar");
      return [];
    }
    if (typeof Chart === "undefined") {
      console.warn("📊 renderizarImagenesGraficasResumen: Chart.js no está disponible");
      return [];
    }
    console.log("📊 renderizarImagenesGraficasResumen: Renderizando", graficas.length, "gráficas");
    const images = [];
    const canvas = document.createElement("canvas");
    canvas.width = 2400;
    canvas.height = 1200;
    canvas.style.display = "none";
    document.body.appendChild(canvas);

    try {
      for (const grafica of graficas) {
        if (!grafica || !Array.isArray(grafica.labels) || !Array.isArray(grafica.datasets)) {
          continue;
        }
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const type = (grafica.type || "bar").toString().toLowerCase();
        const esPie = type === "pie" || type === "doughnut" || type === "polararea";

        const chart = new Chart(ctx, {
          type,
          data: {
            labels: grafica.labels,
            datasets: grafica.datasets,
          },
          options: {
            responsive: false,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: true,
                position: "bottom",
                labels: {
                  font: { size: 20, weight: "bold" },
                  padding: 24,
                },
              },
              title: { display: false },
            },
            layout: {
              padding: {
                left: 20,
                right: 20,
                top: 24,
                bottom: 20,
              },
            },
            scales: esPie
              ? {}
              : {
                  y: {
                    beginAtZero: true,
                    ticks: {
                      font: { size: 18 },
                      callback: (value) =>
                        Number(value || 0).toLocaleString("es-MX", {
                          maximumFractionDigits: 0,
                        }),
                    },
                    grid: {
                      color: "rgba(0,0,0,0.08)",
                    },
                  },
                  x: {
                    ticks: { font: { size: 16 } },
                    grid: { display: false },
                  },
                },
          },
        });
        await new Promise((resolve) => setTimeout(resolve, 140));
        const dataUrl = canvas.toDataURL("image/png");
        if (esDataUrlImagenValida(dataUrl)) {
          images.push({
            title: grafica.titulo || "Grafica",
            dataUrl,
            width: canvas.width,
            height: canvas.height,
          });
        }
        chart.destroy();
      }
    } catch (error) {
      console.warn("No se pudieron renderizar gráficas para exportación:", error);
    } finally {
      if (canvas.parentElement) {
        canvas.parentElement.removeChild(canvas);
      }
    }

    return images;
  };

  const capturarGraficasResumenDesdePanel = async () => {
    try {
      if (
        !window.ExportUtils ||
        typeof window.ExportUtils._resolverGraficas !== "function" ||
        typeof window.ExportUtils._capturarGraficas !== "function"
      ) {
        console.warn("📊 capturarGraficasResumenDesdePanel: ExportUtils no disponible");
        return [];
      }
      const targets = window.ExportUtils._resolverGraficas();
      console.log("📊 capturarGraficasResumenDesdePanel: targets encontrados =", targets?.length || 0);
      if (!Array.isArray(targets) || !targets.length) {
        // Intentar buscar canvas directamente en el panel
        const panelCanvas = document.querySelectorAll("#resumenChartsPanel canvas, .charts-panel canvas");
        console.log("📊 capturarGraficasResumenDesdePanel: canvas en panel =", panelCanvas.length);
        if (panelCanvas.length) {
          const manualTargets = Array.from(panelCanvas).map((canvas) => ({
            canvas,
            title: canvas.closest(".charts-card")?.querySelector("h6")?.textContent?.trim() || "Grafica",
          }));
          const images = await window.ExportUtils._capturarGraficas(manualTargets);
          return (images || []).filter((img) => esDataUrlImagenValida(img?.dataUrl));
        }
        return [];
      }
      const images = await window.ExportUtils._capturarGraficas(targets);
      console.log("📊 capturarGraficasResumenDesdePanel: imágenes capturadas =", images?.length || 0);
      return (images || []).filter((img) => esDataUrlImagenValida(img?.dataUrl));
    } catch (error) {
      console.warn("No fue posible capturar gráficas desde el panel:", error);
      return [];
    }
  };

  // Extrae la parte base64 de un Data URL
  const extraerBase64DeDataUrl = (dataUrl) => {
    if (!dataUrl || typeof dataUrl !== "string") return dataUrl;
    const match = dataUrl.match(/^data:image\/[a-z]+;base64,(.+)$/i);
    return match ? match[1] : dataUrl;
  };

  const insertarImagenesGraficasEnWorkbook = (workbook, images = [], hoja = "Gráficas") => {
    if (!workbook || !Array.isArray(images) || !images.length) return false;
    const existentes = workbook.getWorksheet(hoja);
    if (existentes) {
      workbook.removeWorksheet(existentes.id);
    }
    const wsCharts = workbook.addWorksheet(hoja);
    wsCharts.getCell("A1").value = "Gráficas exportadas";
    wsCharts.getCell("A1").font = { bold: true, size: 14, color: { argb: "FF0D47A1" } };
    wsCharts.columns = [{ width: 4 }, { width: 120 }];

    let rowCursor = 3;
    let inserted = 0;
    images.forEach((img, idx) => {
      if (!esDataUrlImagenValida(img?.dataUrl)) return;
      const widthBase = Number(img.width) || 1200;
      const heightBase = Number(img.height) || 600;
      const ratio = heightBase > 0 ? heightBase / widthBase : 0.5;
      const width = 1120;
      const height = Math.max(320, Math.min(620, Math.round(width * ratio)));
      wsCharts.getCell(rowCursor, 1).value = `${idx + 1}.`;
      wsCharts.getCell(rowCursor, 2).value = img.title || `Grafica ${idx + 1}`;
      wsCharts.getCell(rowCursor, 2).font = { bold: true, color: { argb: "FF1E3A8A" } };

      // ExcelJS espera solo la cadena base64, no el Data URL completo
      const imageId = workbook.addImage({
        base64: extraerBase64DeDataUrl(img.dataUrl),
        extension: "png",
      });
      wsCharts.addImage(imageId, {
        tl: { col: 0, row: rowCursor + 1 },
        ext: { width, height },
      });
      rowCursor += Math.ceil(height / 20) + 4;
      inserted += 1;
    });
    return inserted > 0;
  };

  const exportarTablaXlsx = async (event) => {
    if (event) event.preventDefault();
    const selector = "#tablaComparacion";
    const anio = leerAnioSeleccionado();
    const mes = leerMesSeleccionado();
    const nombreEmpresa = obtenerEtiquetaEmpresa(empresaActual?.id);

    if (typeof ExcelJS !== "undefined") {
      await exportarResumenConGraficas(nombreEmpresa, anio, mes);
    } else {
      ExportUtils.exportarExcel({
        tabla: selector,
        nombreArchivo: `RESUMEN_${nombreEmpresa}`,
        nombreHoja: "Resumen",
        onSuccess: () => {
          if (typeof showToast === "function") {
            showToast("Resumen exportado correctamente.");
          }
        },
      });
    }
  };

  const exportarResumenConGraficas = async (nombreEmpresa, anio, mes) => {
    let fallbackBuffer = null;
    let fallbackName = "";
    let workbook = null;
    let graficaImages = [];
    try {
      workbook = new ExcelJS.Workbook();
      workbook.creator = "SummaCham";
      workbook.created = new Date();
      const { baseName, empresaTexto, mesNombre } = construirMetadataExportacion();
      fallbackName = baseName;
      const ajustarAnchosWorksheet = (worksheet, options = {}) => {
        if (!worksheet) return;
        const { min = 8, max = 60, padding = 2 } = options;
        const columnCount = worksheet.columnCount || 0;
        for (let colNumber = 1; colNumber <= columnCount; colNumber += 1) {
          const column = worksheet.getColumn(colNumber);
          let maxLen = min;
          column.eachCell({ includeEmpty: true }, (cell) => {
            let value = cell.value;
            if (value == null) return;
            if (typeof value === "object") {
              if (value.text) value = value.text;
              else if (Array.isArray(value.richText)) {
                value = value.richText.map((part) => part.text).join("");
              } else if (value.result != null) value = value.result;
            }
            const text = String(value);
            if (text.length > maxLen) maxLen = text.length;
          });
          column.width = Math.min(max, Math.max(min, maxLen + padding));
        }
      };

      const wsResumen = workbook.addWorksheet("Resumen");
      const tabla = document.getElementById("tablaComparacion");

      if (tabla) {
        const thead = tabla.querySelector("thead");
        const tbody = tabla.querySelector("tbody");

        if (thead) {
          const headerRows = Array.from(thead.querySelectorAll("tr"));
          let excelRowIndex = 1;
          const occupiedCells = new Map();

          headerRows.forEach((row) => {
            const cells = Array.from(row.querySelectorAll("th"));
            const excelRow = wsResumen.getRow(excelRowIndex);
            let colIndex = 1;

            cells.forEach((cell) => {
              while (occupiedCells.has(`${excelRowIndex},${colIndex}`)) {
                colIndex++;
              }

              const texto = cell.textContent.trim();
              const colspan = parseInt(cell.getAttribute("colspan")) || 1;
              const rowspan = parseInt(cell.getAttribute("rowspan")) || 1;

              const cellAddr = wsResumen.getCell(excelRowIndex, colIndex);
              cellAddr.value = texto;
              cellAddr.font = {
                bold: true,
                color: { argb: "FFFFFFFF" },
                size: 10,
              };
              cellAddr.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FF0D47A1" },
              };
              cellAddr.alignment = {
                horizontal: "center",
                vertical: "middle",
                wrapText: true,
              };
              cellAddr.border = {
                top: { style: "thin", color: { argb: "FFFFFFFF" } },
                bottom: { style: "thin", color: { argb: "FFFFFFFF" } },
                left: { style: "thin", color: { argb: "FFFFFFFF" } },
                right: { style: "thin", color: { argb: "FFFFFFFF" } },
              };

              if (colspan > 1 || rowspan > 1) {
                const endRow = excelRowIndex + rowspan - 1;
                const endCol = colIndex + colspan - 1;
                wsResumen.mergeCells(excelRowIndex, colIndex, endRow, endCol);

                for (let r = excelRowIndex; r <= endRow; r++) {
                  for (let c = colIndex; c <= endCol; c++) {
                    occupiedCells.set(`${r},${c}`, true);
                  }
                }
              } else {
                occupiedCells.set(`${excelRowIndex},${colIndex}`, true);
              }

              colIndex += colspan;
            });

            excelRow.height = 25;
            excelRowIndex++;
          });
        }

        if (tbody) {
          const bodyRows = Array.from(tbody.querySelectorAll("tr"));
          bodyRows.forEach((row) => {
            const cells = Array.from(row.querySelectorAll("td"));
            const rowData = cells.map((cell, idx) => {
              const text = cell.textContent.trim();
              if (idx !== 0 && idx !== 1 && idx !== 6) {
                const num = parseFloat(text.replace(/[,$]/g, ""));
                return isNaN(num) ? text : num;
              }
              return text;
            });
            const excelRow = wsResumen.addRow(rowData);

            if (row.classList.contains("section-header-row")) {
              excelRow.eachCell((cell) => {
                cell.fill = {
                  type: "pattern",
                  pattern: "solid",
                  fgColor: { argb: "FF1E3A8A" },
                };
                cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
                cell.alignment = { horizontal: "left", vertical: "middle" };
              });
            } else if (row.classList.contains("subsection-row")) {
              excelRow.eachCell((cell) => {
                cell.fill = {
                  type: "pattern",
                  pattern: "solid",
                  fgColor: { argb: "FFDBEAFE" },
                };
                cell.font = {
                  bold: true,
                  color: { argb: "FF1E3A8A" },
                  italic: true,
                };
                cell.alignment = { horizontal: "left", vertical: "middle" };
              });
            } else if (row.classList.contains("highlight-bright")) {
              excelRow.eachCell((cell) => {
                cell.fill = {
                  type: "pattern",
                  pattern: "solid",
                  fgColor: { argb: "FFFECACA" },
                };
                cell.font = { bold: true, color: { argb: "FF991B1B" }, size: 11 };
              });
            } else if (row.classList.contains("highlight-primary")) {
              excelRow.eachCell((cell) => {
                cell.fill = {
                  type: "pattern",
                  pattern: "solid",
                  fgColor: { argb: "FFA7F3D0" },
                };
                cell.font = { bold: true, color: { argb: "FF065F46" } };
              });
            } else if (row.classList.contains("highlight-secondary")) {
              excelRow.eachCell((cell) => {
                cell.fill = {
                  type: "pattern",
                  pattern: "solid",
                  fgColor: { argb: "FFA5F3FC" },
                };
                cell.font = { bold: true, color: { argb: "FF0E7490" } };
              });
            } else if (row.classList.contains("sum-row")) {
              excelRow.eachCell((cell) => {
                cell.fill = {
                  type: "pattern",
                  pattern: "solid",
                  fgColor: { argb: "FFFEF3C7" },
                };
                cell.font = { bold: true, color: { argb: "FF78350F" } };
              });
            }

            excelRow.eachCell((cell, colNum) => {
              if (colNum === 1 || colNum === 2 || colNum === 7) {
                cell.alignment = { horizontal: "left", vertical: "middle" };
              } else {
                cell.alignment = { horizontal: "right", vertical: "middle" };
                if (typeof cell.value === "number") {
                  cell.numFmt = "#,##0.00";
                }
              }
            });
          });
        }

        ajustarAnchosWorksheet(wsResumen);
      }

      // Obtener datos de gráficas para renderizado programático
      const graficaData = await obtenerGraficasExportacion({
        empresaId: empresaActual?.id,
        anio,
      });
      console.log("📊 EXPORT: graficaData obtenidos:", graficaData.length);

      // Intentar renderizar gráficas programáticamente
      graficaImages = await renderizarImagenesGraficasResumen(graficaData);
      console.log("📊 EXPORT: imágenes renderizadas:", graficaImages.length);

      // Si no hay imágenes, intentar capturar del panel de gráficas
      if (!graficaImages.length) {
        console.log("📊 EXPORT: Intentando capturar desde panel...");
        graficaImages = await capturarGraficasResumenDesdePanel();
        console.log("📊 EXPORT: imágenes capturadas del panel:", graficaImages.length);
      }

      // Si aún no hay imágenes, abrir el panel, renderizar y capturar
      if (!graficaImages.length) {
        console.log("📊 EXPORT: Intentando forzar renderizado de panel...");
        const panel = document.getElementById("resumenChartsPanel");
        const wasHidden = panel && !panel.classList.contains("open");
        if (wasHidden && panel) {
          panel.classList.add("open");
          panel.style.position = "absolute";
          panel.style.left = "-10000px";
          panel.style.visibility = "hidden";
        }
        // Esperar a que las gráficas se rendericen
        await new Promise((r) => setTimeout(r, 500));
        graficaImages = await capturarGraficasResumenDesdePanel();
        console.log("📊 EXPORT: imágenes después de forzar panel:", graficaImages.length);
        if (wasHidden && panel) {
          panel.classList.remove("open");
          panel.style.position = "";
          panel.style.left = "";
          panel.style.visibility = "";
        }
      }

      // Si no hay datos de gráficas para el servidor, exportar solo tabla/data (sin imágenes)
      if (graficaData.length === 0) {
        if (typeof showToast === "function") {
          showToast("No hay datos de gráficas nativas. Exportando solo tabla.", "text-bg-warning");
        }
        const buffer = await workbook.xlsx.writeBuffer();
        fallbackBuffer = buffer;
        descargarBufferExcel(buffer, `${baseName}.xlsx`);
        return;
      }

      workbook.addWorksheet("Gráficas");
      const wsData = workbook.addWorksheet("GraficasData");
      let rowCursor = 1;
      graficaData.forEach((grafica, idx) => {
        wsData.getCell(rowCursor, 1).value = "CHART";
        wsData.getCell(rowCursor, 2).value = grafica.titulo || `Grafica ${idx + 1}`;
        rowCursor += 1;
        wsData.getCell(rowCursor, 1).value = "Categoria";
        (grafica.datasets || []).forEach((dataset, dIdx) => {
          wsData.getCell(rowCursor, dIdx + 2).value =
            dataset.label || `Serie ${dIdx + 1}`;
        });
        rowCursor += 1;
        (grafica.labels || []).forEach((label, lIdx) => {
          wsData.getCell(rowCursor, 1).value = label;
          (grafica.datasets || []).forEach((dataset, dIdx) => {
            const rawValue = Array.isArray(dataset.data) ? dataset.data[lIdx] : 0;
            const value =
              typeof rawValue === "number" && Number.isFinite(rawValue)
                ? rawValue
                : Number(rawValue) || 0;
            wsData.getCell(rowCursor, dIdx + 2).value = value;
          });
          rowCursor += 1;
        });
        rowCursor += 1;
      });

      const buffer = await workbook.xlsx.writeBuffer();
      fallbackBuffer = buffer;
      const params = new URLSearchParams({
        nombreArchivo: baseName,
        empresa: empresaTexto || nombreEmpresa || "",
        mes: mesNombre || "",
        anio: anio || "",
        dataSheetName: "GraficasData",
        chartsSheetName: "Gráficas",
        tableSheetName: "Resumen",
      });

      if (typeof showToast === "function") {
        showToast("Generando Excel con gráficas...");
      }
      const response = await fetch(
        `${base}/api/reportes/resumen-excel-native?${params.toString()}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          credentials: "include",
          body: buffer,
        }
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "No fue posible generar el Excel con gráficas.");
      }

      const obtenerNombreDescarga = (resp) => {
        const header = resp.headers.get("content-disposition") || "";
        const match = header.match(/filename=\"?([^\";]+)\"?/i);
        return match ? match[1] : "";
      };

      const blob = await response.blob();
      const filename =
        obtenerNombreDescarga(response) || `${baseName}_Graficas.xlsx`;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);

      if (typeof showToast === "function") {
        showToast("✅ Resumen con gráficas exportado correctamente.");
      }
    } catch (error) {
      console.error("Error al exportar con gráficas:", error);
      if (fallbackBuffer) {
        descargarBufferExcel(fallbackBuffer, `${fallbackName || "Resumen"}.xlsx`);
      }
      if (typeof showToast === "function") {
        showToast("Error al exportar. Verifica la consola.", "text-bg-danger");
      }
    }
  };

  const generarDatosGraficas = (config) => {
    const empresaIdCtx =
      empresaActual?.id || Sesion.obtenerEmpresaActiva?.()?.id || null;
    const anioCtx = leerAnioSeleccionado();
    const mesCtx = leerMesSeleccionado();
    const capituloCtx =
      obtenerCapituloEmpresa(empresaIdCtx) ||
      obtenerEtiquetaEmpresa(empresaIdCtx) ||
      "";

    // Re-captura inmediata desde tabla para evitar depender de sincronía de snapshot.
    let snapshot = capturarTablaResumen(empresaIdCtx, anioCtx, mesCtx, capituloCtx);
    if (snapshot?.filas?.length) {
      guardarSnapshotTabla(snapshot);
    } else {
      snapshot = window.RESUMEN_SNAPSHOT;
    }

    if (!snapshot || !snapshot.filas) {
      console.warn("📊 generarDatosGraficas: Sin snapshot (tabla y cache vacios)");
      return [];
    }

    const graficasConfig = config || getGraficasConfig();
    if (isManualOnly(graficasConfig)) {
      console.warn("📊 generarDatosGraficas: Modo manualOnly activo");
      return [];
    }
    const baseConfig = DEFAULT_GRAFICAS_CONFIG || {};
    const baseChartType = graficasConfig.chart?.type || "bar";
    const chartsCfg = graficasConfig.charts || {};
    const resolveType = (override) => resolveChartType(override, baseChartType);

    const enabledSeries = getEnabledSeriesConfig(graficasConfig);
    console.log("📊 generarDatosGraficas: enabledSeries =", enabledSeries.length);
    const effectiveSeries = enabledSeries.length
      ? enabledSeries
      : getEnabledSeriesConfig(DEFAULT_GRAFICAS_CONFIG);
    if (!effectiveSeries.length) {
      console.warn("📊 generarDatosGraficas: No hay series habilitadas");
      return [null, null, null];
    }

    const buildDataset = (serie, data, chartType) => {
      const dataset = {
        label: serie.label,
        data,
        borderWidth: chartType === "line" ? 2 : 2,
      };
      if (isPieType(chartType)) {
        dataset.backgroundColor = buildSlicePalette(data.length, serie.color);
        dataset.borderColor = "#ffffff";
        dataset.borderWidth = 1;
        return dataset;
      }
      dataset.backgroundColor = serie.color;
      dataset.borderColor = serie.color;
      if (chartType === "line") {
        dataset.fill = false;
        dataset.tension = 0.32;
        dataset.pointRadius = 3;
        dataset.pointBackgroundColor = serie.color;
      }
      return dataset;
    };

    const encontrarFila = (variants) => {
      const list = Array.isArray(variants) ? variants : [];
      if (!list.length) return null;
      const normalized = list
        .map((v) => normalizarLabelResumen(v))
        .filter(Boolean);
      if (!normalized.length) return null;
      return snapshot.filas.find((fila) => {
        const label = normalizarLabelResumen(fila?.label || "");
        return normalized.some((v) => label.includes(v));
      });
    };

    const empresa = Sesion.obtenerEmpresaActiva?.() || {};
    const isCdmx = resolveIsCdmx(empresa?.id, graficasConfig);
    const capitulo = obtenerCapituloEmpresa(empresa?.id) || "";
    const rowsConfig = getSummaryRowsConfig(capitulo, graficasConfig);
    const etiqueta =
      window.CapitulosModulos?.obtenerConfigEmpresa?.(empresa?.id)?.etiqueta ||
      empresa?.etiqueta ||
      capitulo ||
      "Capitulo";
    const resolveLabel = (label) =>
      (label || etiqueta).toString().replace(/\{capitulo\}/gi, etiqueta);

    const buildSeriesData = (rows) => {
      const labels = [];
      const seriesData = effectiveSeries.reduce((acc, serie) => {
        acc[serie.key] = [];
        return acc;
      }, {});

      (rows || []).forEach((row) => {
        const fila = encontrarFila(row?.variants || []);
        if (!fila) return;
        labels.push(resolveLabel(row.label || row.alias || ""));
        effectiveSeries.forEach((serie) => {
          seriesData[serie.key].push(toNumber(fila.totals?.[serie.key]));
        });
      });

      return { labels, seriesData };
    };

    const buildSeriesDataFallback = (keywords) => {
      const keys = (Array.isArray(keywords) ? keywords : [keywords])
        .map((keyword) => normalizarLabelResumen(keyword || ""))
        .filter(Boolean);
      if (!keys.length) return { labels: [], seriesData: {} };
      const rows = (snapshot.filas || []).filter((fila) => {
        const label = normalizarLabelResumen(fila?.label || "");
        return (
          keys.some((key) => label.includes(key)) &&
          !label.includes("CONSOLIDATED") &&
          !label.includes("CONSOLIDADO")
        );
      });
      const limitedRows = rows.slice(0, 8);
      const labels = limitedRows.map((fila) => (fila?.label || "").toString().trim());
      const seriesData = effectiveSeries.reduce((acc, serie) => {
        acc[serie.key] = limitedRows.map((fila) =>
          toNumber(fila?.totals?.[serie.key])
        );
        return acc;
      }, {});
      return { labels, seriesData };
    };

    const datos = [null, null, null];

    if (chartsCfg.operating?.enabled !== false) {
      let operating = buildSeriesData(rowsConfig.operating);
      if (!operating.labels.length) {
        operating = buildSeriesDataFallback([
          "OPERATING RESULTS",
          "RESULTADO OPERATIVO",
        ]);
      }
      if (operating.labels.length) {
        const operatingType = resolveType(chartsCfg.operating?.chartType);
        const chartTitle =
          chartsCfg.operating?.title ||
          baseConfig.charts?.operating?.title ||
          "Resultado Operativo por Capitulo";
        datos[0] = {
          titulo: chartTitle,
          labels: operating.labels,
          datasets: effectiveSeries.map((serie) =>
            buildDataset(serie, operating.seriesData[serie.key], operatingType)
          ),
          type: operatingType,
        };
      }
    }

    if (chartsCfg.net?.enabled !== false) {
      let net = buildSeriesData(rowsConfig.net);
      if (!net.labels.length) {
        net = buildSeriesDataFallback(["NET RESULTS", "RESULTADO NETO"]);
      }
      if (net.labels.length) {
        const netType = resolveType(chartsCfg.net?.chartType);
        const chartTitle =
          chartsCfg.net?.title ||
          baseConfig.charts?.net?.title ||
          "Resumen Neto por Capitulo";
        datos[1] = {
          titulo: chartTitle,
          labels: net.labels,
          datasets: effectiveSeries.map((serie) =>
            buildDataset(serie, net.seriesData[serie.key], netType)
          ),
          type: netType,
        };
      }
    }

    if (isCdmx && chartsCfg.consolidated?.enabled !== false) {
      const consolidatedSources =
        graficasConfig.sources?.consolidated ||
        baseConfig.sources?.consolidated ||
        {};
      let consolidatedOp = encontrarFila(
        getConsolidatedVariants(
          consolidatedSources,
          "operating",
          baseConfig.sources?.consolidated || {}
        )
      );
      let consolidatedNet = encontrarFila(
        getConsolidatedVariants(
          consolidatedSources,
          "net",
          baseConfig.sources?.consolidated || {}
        )
      );

      if (!consolidatedOp) {
        consolidatedOp = encontrarFila([
          "CONSOLIDATED OPERATING RESULTS",
          "CONSOLIDATED OPERATING RESULT",
        ]);
      }
      if (!consolidatedNet) {
        consolidatedNet = encontrarFila([
          "CONSOLIDATED NET RESULTS",
          "CONSOLIDATED NET RESULT",
        ]);
      }

      if (consolidatedOp && consolidatedNet) {
        const consolidatedType = resolveType(chartsCfg.consolidated?.chartType);
        const consolidatedCfg = graficasConfig.consolidatedSeries || {};
        const baseConsolidated = baseConfig.consolidatedSeries || {};
        const operatingCfg =
          consolidatedCfg.operating || baseConsolidated.operating || {};
        const netCfg = consolidatedCfg.net || baseConsolidated.net || {};
        const chartTitle =
          chartsCfg.consolidated?.title ||
          baseConfig.charts?.consolidated?.title ||
          "Consolidados Operativos vs Netos";

        const labels = effectiveSeries.map((serie) => serie.label);
        const opData = effectiveSeries.map((serie) =>
          toNumber(consolidatedOp.totals?.[serie.key])
        );
        const netData = effectiveSeries.map((serie) =>
          toNumber(consolidatedNet.totals?.[serie.key])
        );

        const buildConsolidatedDataset = (cfg, data) => {
          const dataset = {
            label: cfg.label,
            data,
            borderWidth: consolidatedType === "line" ? 2 : 2,
          };
          if (isPieType(consolidatedType)) {
            dataset.backgroundColor = buildSlicePalette(data.length, cfg.color);
            dataset.borderColor = "#ffffff";
            dataset.borderWidth = 1;
            return dataset;
          }
          dataset.backgroundColor = cfg.color;
          dataset.borderColor = cfg.color;
          if (consolidatedType === "line") {
            dataset.fill = false;
            dataset.tension = 0.32;
            dataset.pointRadius = 3;
            dataset.pointBackgroundColor = cfg.color;
          }
          return dataset;
        };

        datos[2] = {
          titulo: chartTitle,
          labels,
          datasets: [
            buildConsolidatedDataset(
              operatingCfg.label
                ? operatingCfg
                : {
                    label: "CONSOLIDATED OPERATING RESULTS",
                    color: "#0d47a1",
                  },
              opData
            ),
            buildConsolidatedDataset(
              netCfg.label
                ? netCfg
                : {
                    label: "CONSOLIDATED NET RESULTS",
                    color: "#94a3b8",
                  },
              netData
            ),
          ],
          type: consolidatedType,
        };
      }
    }

    return datos;
  };

  const initToggleColumns = () => {
    if (!toggleBtn) return;
    const tabla = document.getElementById("tablaComparacion");
    toggleBtn.addEventListener("click", () => {
      if (!tabla) return;
      tabla.classList.toggle("sin-cuentas");
      const oculto = tabla.classList.contains("sin-cuentas");
      toggleBtn.setAttribute("aria-pressed", oculto ? "true" : "false");
      const etiqueta = toggleBtn.querySelector(".toggle-account-label");
      if (etiqueta) {
        etiqueta.textContent = oculto ? "Mostrar cuentas" : "Ocultar cuentas";
      } else {
        toggleBtn.textContent = oculto ? "Mostrar cuentas" : "Ocultar cuentas";
      }
    });
  };

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      window.ModoEdicionPresupuesto?.inicializar?.(undefined, {
        soloLayout: true,
        mostrarDiagnosticoCuentas: false,
      });
    } catch (e) {
      /* ignore */
    }
    const sesion = Sesion.requerirSesion();
    if (!sesion) return;
    const empresa = Sesion.obtenerEmpresaActiva(sesion);
    if (!empresa?.id) {
      setStatusRow("Selecciona una empresa para continuar.");
      return;
    }

    inicializarComparativaToggle();
    inicializarPanelGraficas();
    empresaActual = empresa;
    await aplicarEmpresaResumen(empresaActual.id);

    // 🔄 Cargar layout desde SQLite
    const anio = leerAnioSeleccionado();
    const moduloClave = "RESUMEN";
    const capitulo =
      (obtenerCapituloEmpresa(empresa.id) || "DEFAULT").toString().trim() ||
      "DEFAULT";

    // Solo intentar cargar layout si el año es válido
    if (anio && Number(anio) > 0) {
      try {
        const layoutServidor = await fetch(
          `${base}/api/layouts/${encodeURIComponent(moduloClave)}/${anio}/${encodeURIComponent(
            capitulo
          )}?empresaId=${encodeURIComponent(empresa.id)}`,
          { headers: Sesion.headersAutenticacion?.() || {} }
        )
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);

        

        if (layoutServidor?.layout) {
          console.log(
            "? Layout cargado desde servidor (RESUMEN):",
            layoutServidor
          );
          if (window.ModoEdicionPresupuesto?.aplicarLayoutLocal) {
            window.ModoEdicionPresupuesto.aplicarLayoutLocal(
              layoutServidor.layout
            );
          }
        }

      } catch (err) {
        console.warn("⚠️ Error cargando layout en RESUMEN:", err);
      }
    }

    sincronizarSelectorEmpresaGlobal();

    const handleYearChange = () => {
      const anio = leerAnioSeleccionado();
      const mes = leerMesSeleccionado();
      actualizarEtiquetaMes(mes);
      if (!empresaActual?.id) return;
      actualizarEncabezado(empresaActual.id, anio);
      persistirContextoSeleccion(anio, mes);
      window.dispatchEvent(
        new CustomEvent("planeacion:contexto-actualizado", {
          detail: {
            empresaId: empresaActual.id,
            anio,
            periodo: mes,
            modulo: (document.body.dataset.modulo || "RESUMEN").toUpperCase(),
          },
        })
      );
      fetchResumen(empresaActual.id, anio, mes);
    };

    const handleMonthChange = () => {
      const anio = leerAnioSeleccionado();
      const mes = leerMesSeleccionado();
      actualizarMesContexto(mes);
      actualizarEtiquetaMes(mes);
      if (!empresaActual?.id) return;
      actualizarEncabezado(empresaActual.id, anio);
      persistirContextoSeleccion(anio, mes);
      window.dispatchEvent(
        new CustomEvent("planeacion:contexto-actualizado", {
          detail: {
            empresaId: empresaActual.id,
            anio,
            periodo: mes,
            modulo: (document.body.dataset.modulo || "RESUMEN").toUpperCase(),
          },
        })
      );
      fetchResumen(empresaActual.id, anio, mes);
    };

    if (yearSelect) {
      yearSelect.addEventListener("change", handleYearChange);
    }
    if (monthSelect) {
      monthSelect.addEventListener("change", handleMonthChange);
    }
    // Ya no hay selector local de capítulo - se usa companyFilter global
    if (searchInput) {
      searchInput.addEventListener("input", (event) => {
        filterRows(event.target.value);
      });
    }
    initToggleColumns();
    if (exportXlsxBtn) {
      exportXlsxBtn.addEventListener("click", exportarTablaXlsx);
    }
    if (printPdfBtn) {
      printPdfBtn.addEventListener("click", imprimirTablaPdf);
    }
    // Forzar recarga con los valores actuales (evita desalineos en la primera carga)
    await recargarSeleccionActual();

    window.addEventListener(Sesion.EVENTO_EMPRESA, async (event) => {
      const nuevaEmpresa = event?.detail?.empresa;
      if (!nuevaEmpresa?.id) return;
      empresaActual = nuevaEmpresa;
      await aplicarEmpresaResumen(empresaActual.id);
    });
  });

  // --- Workflow / COI bridge (ligero) ---
  const workflowBadge = document.getElementById("workflowBadge");
  const workflowMeta = document.getElementById("workflowMeta");
  const workflowHistory = document.getElementById("workflowHistory");
  const btnBorrador = document.getElementById("btnGuardarBorrador");
  const btnRevisar = document.getElementById("btnMarcarRevisado");
  const btnAutorizar = document.getElementById("btnAutorizar");
  const btnGuardarCoi = document.getElementById("saveBudgetBtn");
  // Normalizar estado del backend (MAYÚSCULAS) a formato frontend (minúsculas-guiones)
  const normalizarEstado = (estado) => {
    if (!estado) return "sin-cargar";
    const mapa = {
      SIN_CARGAR: "sin-cargar",
      EDITANDO: "editando",
      REVISADO: "revisado",
      APROBADO: "autorizado",
      GUARDADO: "guardado",
      PENDIENTE: "pendiente",
      RECHAZADO: "rechazado",
    };
    return mapa[estado] || estado.toLowerCase().replace(/_/g, "-");
  };

  const WORKFLOW_LABEL = {
    "sin-cargar": "Sin cargar",
    borrador: "Borrador",
    editando: "Editando",
    revisado: "Revisado",
    autorizado: "Autorizado",
    aprobado: "Aprobado",
    guardado: "Guardado en COI",
    pendiente: "Pendiente",
    rechazado: "Rechazado",
  };

  const showToast = (msg, variant = "text-bg-success") => {
    if (window.ToastManager?.show) {
      window.ToastManager.show(msg, variant);
      return;
    }
    console.warn("[ResumenView] Toast no disponible", msg);
  };

  const workflowEstado = {
    estado: "sin-cargar",
    actualizadoEn: null,
    actualizadoPor: "",
    historial: [],
  };

  const renderWorkflow = () => {
    if (workflowBadge) {
      workflowBadge.textContent =
        WORKFLOW_LABEL[workflowEstado.estado] || workflowEstado.estado;
    }
    if (workflowMeta) {
      const fecha = workflowEstado.actualizadoEn
        ? new Date(workflowEstado.actualizadoEn).toLocaleString("es-MX")
        : "";
      const usuario = workflowEstado.actualizadoPor
        ? ` por ${workflowEstado.actualizadoPor}`
        : "";
      workflowMeta.textContent = fecha ? `${fecha}${usuario}` : "";
    }
    if (workflowHistory) {
      workflowHistory.innerHTML = "";
      const lista = workflowEstado.historial || [];
      if (!lista.length) {
        const li = document.createElement("li");
        li.className = "list-group-item small text-muted";
        li.textContent = "Sin movimientos registrados.";
        workflowHistory.appendChild(li);
      } else {
        lista.forEach((item) => {
          const li = document.createElement("li");
          li.className = "list-group-item small";
          const fecha = item.fecha
            ? new Date(item.fecha).toLocaleString("es-MX")
            : "";
          li.textContent = `${WORKFLOW_LABEL[item.estado] || item.estado}${
            fecha ? ` · ${fecha}` : ""
          }${item.usuario ? ` · ${item.usuario}` : ""}`;
          workflowHistory.appendChild(li);
        });
      }
    }
  };

  const obtenerContexto = () => {
    const empresa = Sesion.obtenerEmpresaActiva();
    return {
      empresaId: empresa?.id || "",
      anio: leerAnioSeleccionado(),
    };
  };

  const API_WORKFLOW_ESTADO = `${base}/api/presupuestos/estado`;
  const API_WORKFLOW_GUARDAR = `${base}/api/presupuestos/guardar`;

  const cargarWorkflow = async (modulo) => {
    const ctx = obtenerContexto();
    if (!ctx.empresaId || !ctx.anio) return;
    try {
      const params = new URLSearchParams({ modulo, anio: ctx.anio });
      const resp = await fetch(`${API_WORKFLOW_ESTADO}?${params.toString()}`, {
        headers: Sesion.headersAutenticacion(),
      });
      if (manejarSesionExpirada(resp)) return;
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok)
        throw new Error(data.mensaje || "No fue posible obtener el estado.");
      workflowEstado.estado = normalizarEstado(data.estado);
      workflowEstado.actualizadoEn = data.actualizadoEn || null;
      workflowEstado.actualizadoPor = data.actualizadoPor || "";
      workflowEstado.historial = (data.historial || []).map((h) => ({
        ...h,
        estado: normalizarEstado(h.estado),
      }));
      renderWorkflow();
    } catch (err) {
      console.warn("Workflow Resumen", err);
      showToast(
        err.message || "No fue posible actualizar el flujo.",
        "text-bg-danger"
      );
    }
  };

  const postAccionWorkflow = async (accion, modulo) => {
    const ctx = obtenerContexto();
    if (!ctx.empresaId || !ctx.anio) {
      showToast("Selecciona empresa y año.", "text-bg-warning");
      return;
    }
    try {
      const resp = await fetch(API_WORKFLOW_ESTADO, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...Sesion.headersAutenticacion(),
        },
        body: JSON.stringify({ accion, modulo, anio: ctx.anio }),
      });
      if (manejarSesionExpirada(resp)) return;
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok)
        throw new Error(data.mensaje || "No fue posible registrar la acción.");
      workflowEstado.estado =
        normalizarEstado(data.estado) || workflowEstado.estado;
      workflowEstado.actualizadoEn = data.actualizadoEn || null;
      workflowEstado.actualizadoPor = data.actualizadoPor || "";
      workflowEstado.historial = (
        data.historial || workflowEstado.historial
      ).map((h) => ({
        ...h,
        estado: normalizarEstado(h.estado),
      }));
      renderWorkflow();
      showToast(data.mensaje || "Acción registrada.");
    } catch (err) {
      console.error("postAccionWorkflow", err);
      showToast(
        err.message || "No fue posible completar la acción.",
        "text-bg-danger"
      );
    }
  };

  const guardarEnCoi = async (modulo) => {
    const ctx = obtenerContexto();
    if (!ctx.empresaId || !ctx.anio) {
      showToast("Selecciona empresa y año.", "text-bg-warning");
      return;
    }
    try {
      if (window.ModoEdicionPresupuesto?.guardarLayout) {
        window.ModoEdicionPresupuesto.guardarLayout();
      } else if (window.CuentasModulo?.guardarLayout) {
        window.CuentasModulo.guardarLayout();
      }
    } catch (err) {
      console.warn("guardarLayout (no crítico) falló", err);
    }

    const cambios = window.CuentasModulo?.getCambios?.() || {
      presupuesto: [],
      hayCambios: false,
    };
    try {
      const resp = await fetch(API_WORKFLOW_GUARDAR, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...Sesion.headersAutenticacion(),
        },
        body: JSON.stringify({
          modulo,
          empresaId: ctx.empresaId,
          anio: ctx.anio,
          datos: cambios,
        }),
      });
      if (manejarSesionExpirada(resp)) return;
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok)
        throw new Error(data.mensaje || "No fue posible guardar en COI.");
      showToast(data.mensaje || "Guardado en COI.");
      await postAccionWorkflow("guardar", modulo);
    } catch (err) {
      console.error("guardarEnCoi", err);
      showToast(
        err.message || "No fue posible guardar en COI.",
        "text-bg-danger"
      );
    }
  };

  const initWorkflowBridge = (modulo) => {
    cargarWorkflow(modulo);
    if (btnBorrador) {
      btnBorrador.addEventListener("click", () =>
        postAccionWorkflow("cargar", modulo)
      );
    }
    if (btnRevisar) {
      btnRevisar.addEventListener("click", () =>
        postAccionWorkflow("revisar", modulo)
      );
    }
    if (btnAutorizar) {
      btnAutorizar.addEventListener("click", () =>
        postAccionWorkflow("autorizar", modulo)
      );
    }
    if (btnGuardarCoi) {
      btnGuardarCoi.addEventListener("click", () => guardarEnCoi(modulo));
    }
    window.addEventListener("planeacion:contexto-actualizado", (evt) => {
      const det = evt?.detail || {};
      if (det?.modulo && det.modulo !== modulo) return;
      cargarWorkflow(modulo);
    });
    window.addEventListener(Sesion.EVENTO_EMPRESA, () =>
      cargarWorkflow(modulo)
    );
  };

  const wireCollapseControls = () => {
    if (collapseButtons.length) {
      collapseButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
          const allSections = document.querySelectorAll(".collapsible-section");
          if (!allSections.length) return;
          allSections.forEach((row) => setSectionCollapseState(row, true));
          syncCollapseAllState();
        });
      });
    }

    if (expandButtons.length) {
      expandButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
          const allSections = document.querySelectorAll(".collapsible-section");
          if (!allSections.length) return;
          allSections.forEach((row) => setSectionCollapseState(row, false));
          syncCollapseAllState();
        });
      });
    }
  };

  document.addEventListener("click", (e) => {
    const trigger = e.target.closest(".collapse-icon, .collapse-trigger");
    if (!trigger) return;

    const row = trigger.closest(".collapsible-section");
    if (!row) return;

    const sectionName = obtenerNombreSeccion(row);
    if (!sectionName) return;

    e.stopPropagation();

    const debeColapsar = !collapsedSections.has(sectionName);
    setSectionCollapseState(row, debeColapsar);
    syncCollapseAllState();
  });

  // Controles de zoom y visibilidad de columnas
  const table = document.getElementById("tablaComparacion");
  const stickyOverlay =
    typeof window.prepararStickyHeaders === "function"
      ? window.prepararStickyHeaders("#tablaComparacion")
      : null;
  const tableWrapper = document.getElementById("tableWrapper");
  const zoomInBtn = document.getElementById("zoomIn");
  const zoomOutBtn = document.getElementById("zoomOut");
  const zoomResetBtn = document.getElementById("zoomReset");
  const zoomDisplay = document.getElementById("zoomDisplay");
  const toggleAccountColumnBtn = document.getElementById(
    "toggleAccountColumnBtn"
  );
  const ACCOUNT_COLUMN_STORAGE_KEY = "resumen_ocultar_cuentas";

  let selectedCell = null;
  let zoomLevel = 1;

  const clampZoom = (value) => Math.min(1.5, Math.max(0.6, value));
  const renderZoom = () => {
    if (tableWrapper) {
      tableWrapper.style.transform = `scale(${zoomLevel})`;
    }
    if (zoomDisplay) {
      zoomDisplay.textContent = `${Math.round(zoomLevel * 100)}%`;
    }
    aplicarStickyEncabezados();
    if (stickyOverlay?.refresh) {
      stickyOverlay.refresh();
    }
  };

  if (zoomInBtn) {
    zoomInBtn.addEventListener("click", () => {
      zoomLevel = clampZoom(zoomLevel + 0.1);
      renderZoom();
    });
  }

  if (zoomOutBtn) {
    zoomOutBtn.addEventListener("click", () => {
      zoomLevel = clampZoom(zoomLevel - 0.1);
      renderZoom();
    });
  }

  if (zoomResetBtn) {
    zoomResetBtn.addEventListener("click", () => {
      zoomLevel = 1;
      renderZoom();
    });
  }

  const actualizarBotonColumnas = (ocultar) => {
    if (!toggleAccountColumnBtn) return;
    const etiqueta = toggleAccountColumnBtn.querySelector(
      ".toggle-account-label"
    );
    if (etiqueta) {
      etiqueta.textContent = ocultar ? "Mostrar cuentas" : "Ocultar cuentas";
    }
    toggleAccountColumnBtn.setAttribute(
      "aria-pressed",
      ocultar ? "true" : "false"
    );
  };

  const aplicarVisibilidadCuentas = (ocultar) => {
    document.body.classList.toggle("ocultar-cuentas", Boolean(ocultar));
    actualizarBotonColumnas(Boolean(ocultar));
    if (stickyOverlay?.refresh) {
      stickyOverlay.refresh();
    }
  };

  const inicializarToggleColumnas = () => {
    if (!toggleAccountColumnBtn) {
      aplicarVisibilidadCuentas(false);
      return;
    }

    const preferencia =
      localStorage.getItem(ACCOUNT_COLUMN_STORAGE_KEY) === "1";
    aplicarVisibilidadCuentas(preferencia);

    toggleAccountColumnBtn.addEventListener("click", () => {
      const ocultar = !document.body.classList.contains("ocultar-cuentas");
      aplicarVisibilidadCuentas(ocultar);
      localStorage.setItem(ACCOUNT_COLUMN_STORAGE_KEY, ocultar ? "1" : "0");
    });
  };

  if (table) {
    table.addEventListener("click", (event) => {
      const cell = event.target.closest("td, th");
      if (!cell) return;
      if (selectedCell) {
        selectedCell.classList.remove("selected");
      }
      selectedCell = cell;
      selectedCell.classList.add("selected");
    });
  }

  document.addEventListener("click", (event) => {
    if (!table || !selectedCell) return;
    if (!table.contains(event.target)) {
      selectedCell.classList.remove("selected");
      selectedCell = null;
    }
  });

  inicializarToggleColumnas();
  renderZoom();

  // NOTA: initWorkflowBridge comentado porque ahora usamos FlujoAutorizacion
  // que maneja todo el workflow automáticamente desde RESUMEN.html
  // initWorkflowBridge('RESUMEN');
})();
