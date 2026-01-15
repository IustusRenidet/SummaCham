(() => {
  "use strict";

  const TABLE_SELECTOR = "#tablaComparacion";
  const PANEL_SELECTOR = ".operativo-panel, .operativo-sidebar";
  const CANVAS_COMBINED_ID = "operativoChartCombined";
  const charts = { combined: null };
  const MIN_BAR_LENGTH = 18;
  const POINT_RADIUS = 6;
  const POINT_HOVER_RADIUS = 8;
  const ocultarCeros = (valor) => {
    const numero = Number(valor) || 0;
    return numero === 0 ? null : numero;
  };
  let updateTimer = null;

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

  const ajustarAltura = (contenedor, total) => {
    if (!contenedor) return;
    const altura = Math.min(760, Math.max(260, total * 36 + 140));
    contenedor.style.height = `${altura}px`;
  };

  const construirChart = ({
    ctx,
    labels,
    presupuestos,
    reales,
    anuales,
    colors,
    annualLabel,
  }) => {
    const gridColor = "rgba(47, 84, 150, 0.08)";
    const axisColor = "rgba(47, 84, 150, 0.55)";
    return new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            type: "bar",
            label: "Ppto. Acumulado",
            data: presupuestos,
            backgroundColor: colors.budget,
            borderColor: "rgba(47, 84, 150, 0.2)",
            borderRadius: 10,
            borderWidth: 1,
            borderSkipped: false,
            maxBarThickness: 26,
            minBarLength: MIN_BAR_LENGTH,
            order: 1,
          },
          {
            type: "bar",
            label: "Real Acumulado",
            data: reales,
            backgroundColor: colors.real,
            borderColor: "rgba(47, 84, 150, 0.2)",
            borderRadius: 10,
            borderWidth: 1,
            borderSkipped: false,
            maxBarThickness: 26,
            minBarLength: MIN_BAR_LENGTH,
            order: 2,
          },
          {
            type: "line",
            label: annualLabel || "Presupuesto",
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
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y",
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
    annualLabel,
  }) => {
    const canvas = document.getElementById(CANVAS_COMBINED_ID);
    const empty = document.querySelector('[data-operativo-empty="combined"]');
    if (!canvas) return;
    if (!labels.length) {
      if (charts.combined) {
        charts.combined.destroy();
        charts.combined = null;
      }
      if (empty) empty.style.display = "flex";
      canvas.style.display = "none";
      return;
    }

    if (empty) empty.style.display = "none";
    canvas.style.display = "block";
    const ctx = canvas.getContext("2d");
    if (!charts.combined) {
      charts.combined = construirChart({
        ctx,
        labels,
        presupuestos,
        reales,
        anuales,
        colors,
        annualLabel,
      });
    } else {
      charts.combined.data.labels = labels;
      charts.combined.data.datasets[0].data = presupuestos;
      charts.combined.data.datasets[1].data = reales;
      charts.combined.data.datasets[2].data = anuales;
      if (annualLabel) {
        charts.combined.data.datasets[2].label = annualLabel;
      }
      charts.combined.update();
    }
  };

  const actualizarSidebar = () => {
    const sidebar = document.querySelector(PANEL_SELECTOR);
    const tabla = document.querySelector(TABLE_SELECTOR);
    if (!sidebar || !tabla || typeof Chart === "undefined") return;

    const datos = obtenerDatos(tabla);
    const labels = datos.map((item) => item.etiqueta);
    const presupuestos = datos.map((item) => ocultarCeros(item.presupuesto));
    const reales = datos.map((item) => ocultarCeros(item.real));
    const anuales = datos.map((item) => ocultarCeros(item.anual));

    const contenedor = sidebar.querySelector(
      '[data-operativo-chart="combined"]'
    );
    ajustarAltura(contenedor, labels.length);

    const colorBudget = obtenerVariableCss("--color-budget", "#4472c4");
    const colorReal = obtenerVariableCss("--color-real", "#ffc000");
    const colorAnnual = obtenerVariableCss("--color-annual", "#22c55e");

    const annualLabel = (() => {
      const headerYear = tabla
        ?.querySelector("thead .budget-annual-column .anio")
        ?.textContent?.trim();
      return headerYear ? `Presupuesto ${headerYear}` : "Presupuesto";
    })();

    const tituloEl = contenedor
      ?.closest(".chart-block")
      ?.querySelector(".chart-title");
    if (tituloEl) {
      tituloEl.textContent = `Ppto. Acumulado vs Real + ${annualLabel}`;
    }

    actualizarChart({
      labels,
      presupuestos,
      reales,
      anuales,
      colors: { budget: colorBudget, real: colorReal, annual: colorAnnual },
      annualLabel,
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
    initObserver();
  };

  document.addEventListener("DOMContentLoaded", init);
})();
