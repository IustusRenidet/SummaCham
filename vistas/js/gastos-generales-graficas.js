(() => {
  "use strict";

  const MODULO = "gastosgenerales";
  const MESES = [
    "ene",
    "feb",
    "mar",
    "abr",
    "may",
    "jun",
    "jul",
    "ago",
    "sep",
    "oct",
    "nov",
    "dic",
  ];
  const MESES_LABELS = [
    "ENE",
    "FEB",
    "MAR",
    "ABR",
    "MAY",
    "JUN",
    "JUL",
    "AGO",
    "SEP",
    "OCT",
    "NOV",
    "DIC",
  ];
  const TARGETS = [
    {
      id: "rendimientos",
      title: "Rendimientos de Inversion",
      canvasId: "ggChartRendimientos",
      match: (texto) => /RENDIMIENTOS/.test(texto) && /INVERSION/.test(texto),
    },
    {
      id: "plusvalia",
      title: "Plusvalia/Minusvalia",
      canvasId: "ggChartPlusvalia",
      match: (texto) => /PLUSVALIA|MINUSVALIA/.test(texto),
    },
  ];
  const API_BASE = (() => {
    if (window.location.protocol === "file:") {
      return "http://localhost:3005/api";
    }
    return `${window.location.origin.replace(/\/$/, "")}/api`;
  })();

  const charts = {};
  let updateTimer = null;
  let requestId = 0;

  const normalizarTexto = (valor) => {
    if (valor == null) return "";
    return valor
      .toString()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();
  };

  const obtenerVariableCss = (nombre, fallback) => {
    if (!window.getComputedStyle) return fallback;
    const valor = getComputedStyle(document.documentElement)
      .getPropertyValue(nombre)
      .trim();
    return valor || fallback;
  };

  const formatearNumero = (valor) => {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return "0.00";
    const fijo = numero.toFixed(2);
    const [entero, decimales] = fijo.split(".");
    const enteroConComas = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return `${enteroConComas}.${decimales}`;
  };

  const obtenerAnioSeleccionado = () => {
    const select =
      document.querySelector('[data-role="module-year-select"]') ||
      document.querySelector('select[id$="YearSelect"]');
    const valorSelect = Number(select?.value);
    if (Number.isInteger(valorSelect)) return valorSelect;
    const ctx =
      typeof window.Sesion?.obtenerContextoPlaneacion === "function"
        ? window.Sesion.obtenerContextoPlaneacion()
        : null;
    const ctxAnio = Number(ctx?.anio);
    if (Number.isInteger(ctxAnio)) return ctxAnio;
    const dataAnio = Number(document.body?.dataset?.anio);
    if (Number.isInteger(dataAnio)) return dataAnio;
    return null;
  };

  const obtenerEmpresaId = () =>
    window.Sesion?.obtenerEmpresaActiva?.()?.id || null;

  const obtenerCapitulo = (empresaId) => {
    if (!empresaId) return null;
    return window.CapitulosModulos?.obtenerCapituloPorEmpresa?.(empresaId) || null;
  };

  const normalizarCuentaBase = (cuenta) => {
    if (!cuenta) return "";
    return cuenta
      .toString()
      .replace(/[^0-9A-Za-z]/g, "")
      .toUpperCase()
      .trim();
  };

  const deducirNivel = (baseVisible) => {
    const visible = normalizarCuentaBase(baseVisible)
      .slice(0, 11)
      .padEnd(11, "0");
    const b = visible.slice(3, 6);
    const c = visible.slice(6, 9);
    const d = visible.slice(9, 11);
    if (b === "000" && c === "000" && d === "00") return "1";
    if (c === "000" && d === "00") return "2";
    if (d === "00") return "3";
    return "4";
  };

  const convertirCuenta21 = (cuentaLegible) => {
    if (typeof window.cuentaLarga === "function") {
      const desdeVista = window.cuentaLarga(cuentaLegible);
      if (desdeVista) return desdeVista;
    }
    const entrada = normalizarCuentaBase(cuentaLegible);
    if (!entrada) return "";
    if (entrada.length >= 21) {
      return entrada.slice(0, 21);
    }
    const visible = entrada.slice(0, 11).padEnd(11, "0");
    const nivel = deducirNivel(visible);
    return visible.padEnd(20, "0") + nivel;
  };

  const obtenerCuentaDesdeFila = (fila) => {
    const cuenta21 = (fila?.dataset?.cuenta21 || "").trim();
    if (cuenta21) return cuenta21;
    const cuentaTexto = fila?.cells?.[0]?.textContent || "";
    return cuentaTexto ? convertirCuenta21(cuentaTexto) : "";
  };

  const obtenerCuentasDesdeTabla = () => {
    const mapa = new Map();
    const filas = document.querySelectorAll(
      "#tablaComparacion tbody tr.fila-cuenta"
    );
    filas.forEach((fila) => {
      const nombre = normalizarTexto(fila?.cells?.[1]?.textContent || "");
      if (!nombre) return;
      const cuenta21 = obtenerCuentaDesdeFila(fila);
      if (!cuenta21) return;
      TARGETS.forEach((target) => {
        if (mapa.has(target.id)) return;
        if (target.match(nombre)) {
          mapa.set(target.id, [cuenta21]);
        }
      });
    });
    return mapa;
  };

  const obtenerCuentasDesdeCatalogo = (capitulo) => {
    const registros =
      window.CUENTAS_POR_MODULO?.["Gastos Generales"] || [];
    const capituloNorm = normalizarTexto(capitulo || "");
    const mapa = new Map();
    registros.forEach((registro) => {
      if (!registro) return;
      if (
        capituloNorm &&
        normalizarTexto(registro.capitulo || "") !== capituloNorm
      ) {
        return;
      }
      const nombre = normalizarTexto(registro.nombre || "");
      if (!nombre) return;
      TARGETS.forEach((target) => {
        if (!target.match(nombre)) return;
        const cuenta = convertirCuenta21(registro.cuenta || "");
        if (!cuenta) return;
        const lista = mapa.get(target.id) || [];
        if (!lista.includes(cuenta)) {
          lista.push(cuenta);
        }
        mapa.set(target.id, lista);
      });
    });
    return mapa;
  };

  const resolverCuentasObjetivo = (empresaId) => {
    const resultado = new Map();
    const desdeTabla = obtenerCuentasDesdeTabla();
    TARGETS.forEach((target) => {
      const cuentas = desdeTabla.get(target.id) || [];
      if (cuentas.length) {
        resultado.set(target.id, cuentas);
      }
    });
    if (resultado.size === TARGETS.length) {
      return resultado;
    }
    const capitulo = obtenerCapitulo(empresaId);
    const desdeCatalogo = obtenerCuentasDesdeCatalogo(capitulo);
    TARGETS.forEach((target) => {
      if (resultado.has(target.id)) return;
      const cuentas = desdeCatalogo.get(target.id) || [];
      if (cuentas.length) {
        resultado.set(target.id, cuentas);
      }
    });
    return resultado;
  };

  const obtenerMapaCuentas = (cuentasPorObjetivo) => {
    const todas = [];
    TARGETS.forEach((target) => {
      const cuentas = cuentasPorObjetivo.get(target.id) || [];
      cuentas.forEach((cuenta) => {
        if (cuenta && !todas.includes(cuenta)) {
          todas.push(cuenta);
        }
      });
    });
    return todas;
  };

  const fetchDatos = async ({ empresaId, anio, cuentas }) => {
    if (!empresaId || !Number.isInteger(anio) || !cuentas.length) {
      return new Map();
    }
    const payload = {
      empresaId,
      anio,
      modulo: MODULO,
      cuentas,
    };
    const respuesta = await fetch(`${API_BASE}/planeacion/cuentas`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(window.Sesion?.headersAutenticacion?.() || {}),
      },
      body: JSON.stringify(payload),
    });
    const datos = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) {
      throw new Error(
        datos?.mensaje || "No fue posible obtener la informacion contable."
      );
    }
    const mapa = new Map();
    (datos.cuentas || []).forEach((registro) => {
      if (registro?.cuenta) {
        mapa.set(registro.cuenta, registro);
      }
    });
    return mapa;
  };

  const sumarRealPorMes = (mapa, cuentas) =>
    MESES.map((mes) => {
      let total = 0;
      cuentas.forEach((cuenta) => {
        const registro = mapa.get(cuenta);
        const valor = Number(registro?.real?.[mes]);
        if (Number.isFinite(valor)) {
          total += valor;
        }
      });
      return total;
    });

  const toggleEmpty = (targetId, mostrar, mensaje) => {
    const empty = document.querySelector(`[data-gg-empty="${targetId}"]`);
    if (!empty) return;
    if (mensaje) {
      empty.textContent = mensaje;
    }
    empty.style.display = mostrar ? "flex" : "none";
  };

  const construirChart = ({
    ctx,
    labels,
    dataActual,
    dataPrev,
    labelActual,
    labelPrev,
    colorActual,
    colorPrev,
  }) => {
    const gridColor = "rgba(47, 84, 150, 0.08)";
    const axisColor = "rgba(47, 84, 150, 0.55)";
    return new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: labelActual,
            data: dataActual,
            borderColor: colorActual,
            pointBackgroundColor: colorActual,
            pointBorderColor: colorActual,
            borderWidth: 2,
            tension: 0.3,
            pointRadius: 3,
            pointHoverRadius: 4,
            fill: false,
          },
          {
            label: labelPrev,
            data: dataPrev,
            borderColor: colorPrev,
            pointBackgroundColor: colorPrev,
            pointBorderColor: colorPrev,
            borderWidth: 2,
            tension: 0.3,
            pointRadius: 3,
            pointHoverRadius: 4,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false,
        },
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              boxWidth: 12,
              boxHeight: 12,
              usePointStyle: true,
            },
          },
          tooltip: {
            backgroundColor: "#0f172a",
            borderColor: "rgba(255, 255, 255, 0.1)",
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: (ctx) => {
                const label = ctx.dataset?.label || "";
                return `${label}: ${formatearNumero(ctx.raw)}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: {
              display: false,
            },
            ticks: {
              color: axisColor,
              font: { size: 11, weight: "600" },
            },
          },
          y: {
            grid: {
              color: gridColor,
            },
            ticks: {
              color: axisColor,
              font: { size: 11, weight: "500" },
              callback: (valor) => formatearNumero(valor),
            },
          },
        },
      },
    });
  };

  const actualizarChart = ({ target, dataActual, dataPrev, anio }) => {
    const canvas = document.getElementById(target.canvasId);
    if (!canvas) return;
    const tieneDatos =
      dataActual.some((valor) => Number(valor) !== 0) ||
      dataPrev.some((valor) => Number(valor) !== 0);
    if (!tieneDatos) {
      if (charts[target.id]) {
        charts[target.id].destroy();
        charts[target.id] = null;
      }
      canvas.style.display = "none";
      toggleEmpty(target.id, true, "Sin datos para graficar.");
      return;
    }
    toggleEmpty(target.id, false);
    canvas.style.display = "block";
    const ctx = canvas.getContext("2d");
    const colorActual = obtenerVariableCss("--color-real", "#ffc000");
    const colorPrev = obtenerVariableCss("--color-primary", "#2f5496");
    const labelActual = `Real ${anio}`;
    const labelPrev = `Real ${anio - 1}`;
    if (!charts[target.id]) {
      charts[target.id] = construirChart({
        ctx,
        labels: MESES_LABELS,
        dataActual,
        dataPrev,
        labelActual,
        labelPrev,
        colorActual,
        colorPrev,
      });
    } else {
      const chart = charts[target.id];
      chart.data.labels = MESES_LABELS;
      chart.data.datasets[0].data = dataActual;
      chart.data.datasets[0].label = labelActual;
      chart.data.datasets[1].data = dataPrev;
      chart.data.datasets[1].label = labelPrev;
      chart.update();
    }
  };

  const actualizarSubtitulo = (anio) => {
    const subtitle = document.getElementById("gastosGeneralesChartsSubtitle");
    if (subtitle && Number.isInteger(anio)) {
      subtitle.textContent = `Real ${anio} vs ${anio - 1}`;
    }
  };

  const actualizarGraficas = async () => {
    if (typeof Chart === "undefined") {
      TARGETS.forEach((target) => {
        toggleEmpty(target.id, true, "Chart.js no disponible.");
      });
      return;
    }
    const empresaId = obtenerEmpresaId();
    const anio = obtenerAnioSeleccionado();
    if (!empresaId || !Number.isInteger(anio)) {
      TARGETS.forEach((target) => {
        toggleEmpty(target.id, true, "Selecciona empresa y ejercicio.");
      });
      return;
    }
    const cuentasPorObjetivo = resolverCuentasObjetivo(empresaId);
    TARGETS.forEach((target) => {
      const cuentas = cuentasPorObjetivo.get(target.id) || [];
      if (!cuentas.length) {
        toggleEmpty(
          target.id,
          true,
          "Cuenta no disponible para este capitulo."
        );
      }
    });
    const cuentasSolicitadas = obtenerMapaCuentas(cuentasPorObjetivo);
    if (!cuentasSolicitadas.length) return;

    requestId += 1;
    const currentRequest = requestId;

    const resultados = await Promise.allSettled([
      fetchDatos({ empresaId, anio, cuentas: cuentasSolicitadas }),
      fetchDatos({ empresaId, anio: anio - 1, cuentas: cuentasSolicitadas }),
    ]);
    if (currentRequest !== requestId) return;

    const datosActual =
      resultados[0].status === "fulfilled" ? resultados[0].value : new Map();
    const datosPrev =
      resultados[1].status === "fulfilled" ? resultados[1].value : new Map();

    actualizarSubtitulo(anio);
    TARGETS.forEach((target) => {
      const cuentas = cuentasPorObjetivo.get(target.id) || [];
      if (!cuentas.length) return;
      const dataActual = sumarRealPorMes(datosActual, cuentas);
      const dataPrev = sumarRealPorMes(datosPrev, cuentas);
      actualizarChart({ target, dataActual, dataPrev, anio });
    });
  };

  const scheduleUpdate = () => {
    if (updateTimer) clearTimeout(updateTimer);
    updateTimer = setTimeout(actualizarGraficas, 160);
  };

  const initObserver = () => {
    const cuerpo = document.querySelector("#tablaCuentasBody");
    if (!cuerpo || typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(() => scheduleUpdate());
    observer.observe(cuerpo, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  };

  const init = () => {
    const panel = document.getElementById("gastosGeneralesChartsPanel");
    if (!panel) return;
    scheduleUpdate();
    panel.addEventListener("shown.bs.collapse", () => {
      scheduleUpdate();
      Object.values(charts).forEach((chart) => chart?.resize());
    });
    window.addEventListener("modulo-planeacion:tabla-actualizada", scheduleUpdate);
    window.addEventListener("planeacion:contexto-actualizado", scheduleUpdate);
    window.addEventListener("modulo-planeacion:presupuesto-editado", scheduleUpdate);
    window.addEventListener("modulo:ready", scheduleUpdate);
    if (window.Sesion?.EVENTO_EMPRESA) {
      window.addEventListener(window.Sesion.EVENTO_EMPRESA, scheduleUpdate);
    }
    initObserver();
  };

  document.addEventListener("DOMContentLoaded", init);
})();
