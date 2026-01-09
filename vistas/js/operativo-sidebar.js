(() => {
  "use strict";

  const TABLE_SELECTOR = "#tablaComparacion";
  const PANEL_SELECTOR = ".operativo-panel, .operativo-sidebar";
  const CANVAS_BUDGET_ID = "operativoChartBudget";
  const CANVAS_REAL_ID = "operativoChartReal";
  const charts = { budget: null, real: null };
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
    const idxBudgetFallback = buscar("budget-annual-column");
    return {
      budget: idxTotalBudget >= 0 ? idxTotalBudget : idxBudgetFallback,
      real: idxTotalReal,
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
    if (indices.budget == null || indices.budget < 0 || indices.real < 0) {
      return [];
    }
    const filas = Array.from(
      tabla.querySelectorAll("tbody tr.sum-row-operativo")
    );
    return filas
      .map((fila) => {
        const etiqueta = limpiarEtiqueta(fila.cells?.[1]?.textContent || "");
        const presupuesto = parseNumero(fila.cells?.[indices.budget]?.textContent);
        const real = parseNumero(fila.cells?.[indices.real]?.textContent);
        return { etiqueta, presupuesto, real };
      })
      .filter((item) => item.etiqueta);
  };

  const ajustarAltura = (contenedor, total) => {
    if (!contenedor) return;
    const altura = Math.min(760, Math.max(260, total * 36 + 140));
    contenedor.style.height = `${altura}px`;
  };

  const construirChart = ({ ctx, labels, data, color, titulo }) => {
    const gridColor = "rgba(47, 84, 150, 0.08)";
    const axisColor = "rgba(47, 84, 150, 0.55)";
    return new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: titulo,
            data,
            backgroundColor: color,
            borderColor: "rgba(47, 84, 150, 0.2)",
            borderRadius: 10,
            borderWidth: 1,
            borderSkipped: false,
            maxBarThickness: 20,
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
          legend: { display: false },
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
              font: { size: 12, weight: "600" },
              padding: 8,
              callback: (valor, idx, ticks) => ticks?.[idx]?.label || "",
            },
          },
        },
      },
    });
  };

  const actualizarChart = (tipo, canvasId, emptyId, labels, data, color, titulo) => {
    const canvas = document.getElementById(canvasId);
    const empty = document.querySelector(
      `[data-operativo-empty="${emptyId}"]`
    );
    if (!canvas) return;
    if (!labels.length) {
      if (charts[tipo]) {
        charts[tipo].destroy();
        charts[tipo] = null;
      }
      if (empty) empty.style.display = "flex";
      canvas.style.display = "none";
      return;
    }

    if (empty) empty.style.display = "none";
    canvas.style.display = "block";
    const ctx = canvas.getContext("2d");
    if (!charts[tipo]) {
      charts[tipo] = construirChart({ ctx, labels, data, color, titulo });
    } else {
      charts[tipo].data.labels = labels;
      charts[tipo].data.datasets[0].data = data;
      charts[tipo].update();
    }
  };

  const actualizarSidebar = () => {
    const sidebar = document.querySelector(PANEL_SELECTOR);
    const tabla = document.querySelector(TABLE_SELECTOR);
    if (!sidebar || !tabla || typeof Chart === "undefined") return;

    const datos = obtenerDatos(tabla);
    const labels = datos.map((item) => item.etiqueta);
    const presupuestos = datos.map((item) => item.presupuesto);
    const reales = datos.map((item) => item.real);

    const contenedorBudget = sidebar.querySelector(
      '[data-operativo-chart="budget"]'
    );
    const contenedorReal = sidebar.querySelector(
      '[data-operativo-chart="real"]'
    );
    ajustarAltura(contenedorBudget, labels.length);
    ajustarAltura(contenedorReal, labels.length);

    const colorBudget = obtenerVariableCss("--color-budget", "#4472c4");
    const colorReal = obtenerVariableCss("--color-real", "#ffc000");

    actualizarChart(
      "budget",
      CANVAS_BUDGET_ID,
      "budget",
      labels,
      presupuestos,
      colorBudget,
      "Ppto. Acumulado"
    );
    actualizarChart(
      "real",
      CANVAS_REAL_ID,
      "real",
      labels,
      reales,
      colorReal,
      "Real Acumulado"
    );
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
