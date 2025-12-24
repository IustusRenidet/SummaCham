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
 *   Operating: GDL OPERATING RESULTS
 *   Net: NET RESULTS
 *
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
  const API_ENDPOINT = `${base}/api/reportes/resumen`;
  const API_ANIOS = `${base}/api/saldos/anios`;

  const yearSelect = document.getElementById("grafYearSelect");
  const monthSelect = document.getElementById("grafMonthSelect");
  const empresaLabel = document.getElementById("empresaLabel");
  const consolidatedCard = document.getElementById("consolidatedCard");
  const charts = {};

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

  const formatNumber = (n) =>
    new Intl.NumberFormat("es-MX", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);

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
    } catch {}
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
          actualYTD: toNumber(fila?.totals?.actualYTD),
          planYTD: toNumber(fila?.totals?.planYTD),
          prevYTD: toNumber(fila?.totals?.prevYTD),
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
      actualYTD: 0,
      planYTD: 0,
      prevYTD: 0,
    };
  };

  // === CONFIGURACIÓN DE GRÁFICAS POR CAPÍTULO ===

  /**
   * Define las filas que se deben mostrar en las gráficas según el capítulo
   */
  const getRowsConfig = (capitulo) => {
    const cap = normalizarLabel(capitulo);

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

  // === DEFINICIÓN DE COLUMNAS PARA GRÁFICAS (Escalas de Azules y Grises) ===
  const COLUMN_DEFS = [
    { key: "actual", label: "Real", color: "#1e3a5f" }, // Azul oscuro
    { key: "plan", label: "Ppto.", color: "#3b82f6" }, // Azul medio
    { key: "prev", label: "Real mes año anterior", color: "#64748b" }, // Gris azulado
    { key: "actualYTD", label: "Real acumulado", color: "#0d47a1" }, // Azul corporativo
    { key: "planYTD", label: "Ppto. acumulado", color: "#60a5fa" }, // Azul claro
    { key: "prevYTD", label: "Real acumulado año anterior", color: "#94a3b8" }, // Gris
  ];

  // === RENDERIZADO DE GRÁFICAS ===
  const renderChart = (id, cfg) => {
    const ctx = document.getElementById(id);
    if (!ctx) return;
    if (charts[id]) charts[id].destroy();
    charts[id] = new Chart(ctx, cfg);
  };

  /**
   * Construye los datasets para un conjunto de filas
   */
  const buildDatasets = (rows, snapshotMap) => {
    return COLUMN_DEFS.map((col) => ({
      label: col.label,
      data: rows.map((row) => {
        const data = getRowData(snapshotMap, row.variants);
        return toNumber(data[col.key]);
      }),
      backgroundColor: col.color,
    }));
  };

  /**
   * Renderiza todas las gráficas usando datos del snapshot
   * Solo 3 gráficas:
   * 1. Resultado Operativo por Capítulo
   * 2. Resumen Neto por Capítulo
   * 3. Consolidados Operativos vs Netos
   */
  const renderAllCharts = (snapshotMap, capitulo, etiqueta) => {
    if (!snapshotMap || snapshotMap.size === 0) {
      console.warn("📊 Graficas: No hay datos en el snapshot");
      return;
    }

    const config = getRowsConfig(capitulo);

    // === 1. Resultado Operativo por Capítulo ===
    // === 2. Resumen Neto por Capítulo ===
    // Estos se renderizan en renderChapterSummaryCharts
    renderChapterSummaryCharts(snapshotMap, config.isCdmx);

    // === 3. Consolidados Operativos vs Netos (SOLO PARA CDMX) ===
    if (consolidatedCard) {
      consolidatedCard.style.display = config.isCdmx ? "block" : "none";
    }

    if (config.isCdmx) {
      const consolidatedOp = getRowData(snapshotMap, [
        "CONSOLIDATED OPERATING RESULTS",
      ]);
      const consolidatedNet = getRowData(snapshotMap, [
        "CONSOLIDATED NET RESULTS",
      ]);

      console.log("📊 Graficas: Consolidados -", {
        operating: consolidatedOp,
        net: consolidatedNet,
      });

      renderChart("chartConsolidatedResults", {
        type: "bar",
        data: {
          labels: [
            "Real",
            "Ppto.",
            "Real mes AA",
            "Real Acum",
            "Ppto. Acum",
            "Real Acum AA",
          ],
          datasets: [
            {
              label: "CONSOLIDATED OPERATING RESULTS",
              data: [
                consolidatedOp.actual,
                consolidatedOp.plan,
                consolidatedOp.prev,
                consolidatedOp.actualYTD,
                consolidatedOp.planYTD,
                consolidatedOp.prevYTD,
              ],
              backgroundColor: "#1e3a5f", // Azul oscuro
            },
            {
              label: "CONSOLIDATED NET RESULTS",
              data: [
                consolidatedNet.actual,
                consolidatedNet.plan,
                consolidatedNet.prev,
                consolidatedNet.actualYTD,
                consolidatedNet.planYTD,
                consolidatedNet.prevYTD,
              ],
              backgroundColor: "#64748b", // Gris azulado
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: "bottom" },
            title: {
              display: true,
              text: "CONSOLIDATED OPERATING RESULTS vs CONSOLIDATED NET RESULTS",
            },
          },
          scales: { y: { beginAtZero: false } },
        },
      });
    }
  };

  /**
   * Renderiza gráficas de resumen comparando todos los capítulos/regiones
   * Para CDMX: Usa las filas de OPERATING RESULTS y NET RESULTS por región del snapshot actual
   * Para otros capítulos: Usa sus propios datos
   */
  const renderChapterSummaryCharts = async (snapshotMap, isCdmx) => {
    // Si es CDMX, usar los datos del snapshot actual que ya contiene todos los capítulos
    if (isCdmx && snapshotMap && snapshotMap.size > 0) {
      // Definir las 4 regiones en orden para CDMX
      const regiones = [
        {
          label: "Ciudad de México",
          operKey: "OPERATING RESULTS MEXICO",
          netKey: "NET RESULTS MEXICO",
        },
        {
          label: "Guadalajara",
          operKey: "OPERATING RESULTS GUADALAJARA",
          netKey: "NET RESULTS GUADALAJARA",
        },
        {
          label: "Noreste",
          operKey: "OPERATING RESULTS MONTERREY",
          netKey: "NET RESULTS MONTERREY",
        },
        {
          label: "Noroeste",
          operKey: "OPERATING RESULTS NORTHWEST",
          netKey: "NET RESULTS NORTHWEST",
        },
      ];

      const summaries = regiones.map((region) => ({
        capitulo: region.label,
        operating: getRowData(snapshotMap, [region.operKey]),
        net: getRowData(snapshotMap, [region.netKey]),
      }));

      const labels = summaries.map((s) => s.capitulo);

      console.log("📊 Graficas: Resumen por capítulo (CDMX):", summaries);

      // Resumen Operativo por capítulo
      renderChart("chartOperatingSummaryByChapter", {
        type: "bar",
        data: {
          labels,
          datasets: COLUMN_DEFS.map((col) => ({
            label: col.label,
            data: summaries.map((s) => toNumber(s.operating[col.key])),
            backgroundColor: col.color,
          })),
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: "bottom" },
            title: { display: true, text: "Resumen Operativo por Región" },
          },
          scales: { y: { beginAtZero: false } },
        },
      });

      // Resumen Neto por capítulo
      renderChart("chartNetSummaryByChapter", {
        type: "bar",
        data: {
          labels,
          datasets: COLUMN_DEFS.map((col) => ({
            label: col.label,
            data: summaries.map((s) => toNumber(s.net[col.key])),
            backgroundColor: col.color,
          })),
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: "bottom" },
            title: { display: true, text: "Resumen Neto por Región" },
          },
          scales: { y: { beginAtZero: false } },
        },
      });

      return;
    }

    // Para otros capítulos: usar el snapshot actual con un solo resultado
    if (snapshotMap && snapshotMap.size > 0) {
      const empresa = window.Sesion?.obtenerEmpresaActiva?.();
      const config = window.CapitulosModulos?.obtenerConfigEmpresa?.(
        empresa?.id
      );
      const etiqueta = config?.etiqueta || empresa?.etiqueta || "Capítulo";

      const summaries = [
        {
          capitulo: etiqueta,
          operating: getRowData(snapshotMap, [
            "OPERATING RESULTS",
            "GDL OPERATING RESULTS",
            "NE OPERATING RESULTS",
            "NO OPERATING RESULTS",
          ]),
          net: getRowData(snapshotMap, ["NET RESULTS"]),
        },
      ];

      const labels = [etiqueta];

      // Resumen Operativo (solo un capítulo)
      renderChart("chartOperatingSummaryByChapter", {
        type: "bar",
        data: {
          labels,
          datasets: COLUMN_DEFS.map((col) => ({
            label: col.label,
            data: summaries.map((s) => toNumber(s.operating[col.key])),
            backgroundColor: col.color,
          })),
        },
        options: {
          responsive: true,
          plugins: { legend: { position: "bottom" } },
          scales: { y: { beginAtZero: false } },
        },
      });

      // Resumen Neto (solo un capítulo)
      renderChart("chartNetSummaryByChapter", {
        type: "bar",
        data: {
          labels,
          datasets: COLUMN_DEFS.map((col) => ({
            label: col.label,
            data: summaries.map((s) => toNumber(s.net[col.key])),
            backgroundColor: col.color,
          })),
        },
        options: {
          responsive: true,
          plugins: { legend: { position: "bottom" } },
          scales: { y: { beginAtZero: false } },
        },
      });
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

    if (!anio || !mes) {
      console.warn("📊 Graficas: Año o mes no válidos");
      return;
    }

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
      // No mostrar alert, el usuario puede navegar a RESUMEN si lo necesita
      return;
    }

    console.log(
      "📊 Graficas: Usando snapshot del",
      new Date(snapshot.createdAt).toLocaleString()
    );

    // Renderizar todas las gráficas usando exclusivamente el snapshot
    renderAllCharts(snapshot.map, capitulo, etiquetaFinal);
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

  // Iniciar
  sincronizarEmpresa();
  inicializar();
})();
