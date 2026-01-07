/**
 * Módulo: Modo Edición de Presupuestos
 *
 * Transforma una tabla estática en editable con:
 * - Celdas clickeables
 * - Captura de cambios
 * - Validación de números
 * - Autocompletado de cuentas
 */

(function () {
  const MESES = [
    { id: "budget-ene", label: "ENE", numero: 1 },
    { id: "budget-feb", label: "FEB", numero: 2 },
    { id: "budget-mar", label: "MAR", numero: 3 },
    { id: "budget-abr", label: "ABR", numero: 4 },
    { id: "budget-may", label: "MAY", numero: 5 },
    { id: "budget-jun", label: "JUN", numero: 6 },
    { id: "budget-jul", label: "JUL", numero: 7 },
    { id: "budget-ago", label: "AGO", numero: 8 },
    { id: "budget-sep", label: "SEP", numero: 9 },
    { id: "budget-oct", label: "OCT", numero: 10 },
    { id: "budget-nov", label: "NOV", numero: 11 },
    { id: "budget-dic", label: "DIC", numero: 12 },
  ];

  const SELECTOR_TABLA = "#tablaComparacion";
  const CLASE_EDITABLE = "editable-cell";
  const CLASE_EDITANDO = "cell-editing";
  const CLASE_MODIFICADO = "cell-modified";
  const CLASE_ACTIVA = "cell-active";

  // Estado global del módulo
  const estado = {
    modoEdicionActivo: false,
    cambiosCapturados: {},
    cuentasDisponibles: [],
    selectorTabla: SELECTOR_TABLA,
    layoutModificado: false,
    celdaActiva: null,
    soloLayout: false, // Nueva opción: solo editar cuenta/descripción, no valores numéricos
    persistiendo: false, // Flag para evitar recursión infinita
  };

  const editorState = {
    input: null,
    celda: null,
    tipo: null,
    valorOriginal: "",
    valorNumericoOriginal: null,
    commitEnProgreso: false,
  };

  function obtenerNumeroDesdeCelda(celda) {
    if (!celda) return 0;
    const texto =
      celda.dataset.valorPlano ??
      (celda.textContent || "").toString().replace(/\s/g, "");
    const numero = parseFloat(
      texto.replace(/[^0-9,.-]/g, "").replace(/,/g, "")
    );
    return Number.isFinite(numero) ? numero : 0;
  }

  function obtenerNumeroDesdeTexto(texto) {
    const limpio = (texto || "")
      .toString()
      .replace(/[^0-9,.-]/g, "")
      .replace(/,/g, "");
    const numero = parseFloat(limpio);
    return Number.isFinite(numero) ? numero : 0;
  }

  const TEXT_COLUMNS = new Set(["cuenta", "descripcion", "nombre"]);

  function esCeldaTextoEditable(celda) {
    if (!celda || !celda.dataset) return false;
    const clave = (celda.dataset.columnaClave || "").toLowerCase();
    if (!TEXT_COLUMNS.has(clave)) return false;
    if (celda.dataset.editableReal === "false") return false;
    return true;
  }

  function esCeldaEditable(celda) {
    if (!celda) return false;
    if (estado.soloLayout) {
      return esCeldaTextoEditable(celda);
    }
    return Boolean(celda.dataset.mes);
  }

  function limpiarCeldaActiva() {
    if (!estado.celdaActiva) return;
    estado.celdaActiva.classList.remove(CLASE_ACTIVA);
    estado.celdaActiva = null;
  }

  function establecerCeldaActiva(celda) {
    if (!celda) return;
    ensureEditorInlineStyles();
    if (estado.celdaActiva && estado.celdaActiva !== celda) {
      estado.celdaActiva.classList.remove(CLASE_ACTIVA);
    }
    estado.celdaActiva = celda;
    celda.classList.add(CLASE_ACTIVA);
    if (!celda.hasAttribute("tabindex")) {
      celda.tabIndex = 0;
    }
    try {
      celda.focus({ preventScroll: true });
    } catch (err) {
      try {
        celda.focus();
      } catch (err2) {}
    }
  }

  function ensureEditorInlineStyles() {
    if (document.getElementById("excel-inline-style")) return;
    const style = document.createElement("style");
    style.id = "excel-inline-style";
    style.textContent = `
      .excel-inline-input {
        width: 100%;
        height: 100%;
        border: none;
        outline: none;
        font-size: inherit;
        font-family: inherit;
        padding: 0.1rem 0.2rem;
        background: #fffef5;
      }
      .excel-inline-input:focus {
        outline: 2px solid #2f5496 !important;
      }
      .cell-active {
        outline: 2px solid #2f5496;
        outline-offset: -2px;
      }
    `;
    document.head.appendChild(style);
  }

  function obtenerEditorInline() {
    if (editorState.input) return editorState.input;
    ensureEditorInlineStyles();
    const input = document.createElement("input");
    input.type = "text";
    input.className = "excel-inline-input";
    input.spellcheck = false;
    input.autocomplete = "off";
    input.addEventListener("keydown", manejarTeclasEditor);
    input.addEventListener("blur", () => {
      // CRÍTICO: Evitar recursión infinita - verificar múltiples flags
      if (editorState.commitEnProgreso) return;
      if (!editorState.celda) return;
      // Usar setTimeout para evitar conflictos con otros eventos
      setTimeout(() => {
        if (!editorState.commitEnProgreso && editorState.celda) {
          commitEditor();
        }
      }, 10);
    });
    editorState.input = input;
    return input;
  }

  function iniciarEdicionInline(celda, valor, opciones = {}) {
    const input = obtenerEditorInline();
    editorState.celda = celda;
    editorState.tipo = opciones.tipo || "texto";
    editorState.valorOriginal = opciones.valorRestauracion ?? valor;
    editorState.valorNumericoOriginal = opciones.valorNumerico ?? null;
    celda.classList.add("celda-editando");
    celda.classList.add(CLASE_EDITANDO);
    if (opciones.placeholder) {
      input.placeholder = opciones.placeholder;
    } else {
      input.removeAttribute("placeholder");
    }
    if (opciones.datalistId) {
      input.setAttribute("list", opciones.datalistId);
    } else {
      input.removeAttribute("list");
    }
    if (input.parentElement !== celda) {
      celda.textContent = "";
      celda.appendChild(input);
    }
    input.value = valor;
    requestAnimationFrame(() => {
      input.focus({ preventScroll: true });
      input.select();
    });
  }

  function ocultarEditor() {
    if (!editorState.input) return;
    if (editorState.input.parentElement) {
      editorState.input.parentElement.removeChild(editorState.input);
    }
    if (editorState.celda) {
      editorState.celda.classList.remove("celda-editando");
      editorState.celda.classList.remove(CLASE_EDITANDO);
    }
    editorState.celda = null;
    editorState.tipo = null;
    editorState.valorOriginal = "";
    editorState.valorNumericoOriginal = null;
  }

  const normalizeString = (s) =>
    (s || "")
      .toString()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toUpperCase()
      .trim();
  const API_BASE =
    window.location.protocol === "file:"
      ? "http://localhost:3005"
      : window.location.origin;

  /**
   * Helper para obtener el selector de año del módulo actual
   * Busca en todos los posibles IDs de selectores de año de los diferentes módulos
   */
  function obtenerSelectorAnio() {
    return (
      document.getElementById("selectAnio") ||
      document.getElementById("resumenYearSelect") ||
      document.getElementById("summaryYear Select") ||
      document.getElementById("eventosYearSelect") ||
      document.getElementById("comitesYearSelect") ||
      document.getElementById("comunicacionYearSelect") ||
      document.getElementById("gtoscorporativosYearSelect") ||
      document.getElementById("gastosgeneralesYearSelect") ||
      document.getElementById("finanzasYearSelect") ||
      document.getElementById("rhYearSelect") ||
      document.getElementById("membresiaYearSelect") ||
      document.getElementById("servmembresiaYearSelect") ||
      document.getElementById("ticYearSelect") ||
      document.getElementById("direccionYearSelect") ||
      document.getElementById("vpeYearSelect") ||
      document.getElementById("nominaYearSelect") ||
      document.querySelector('[data-role="module-year-select"]') ||
      document.querySelector('select[id$="YearSelect"]') ||
      document.querySelector('select[name="anio"]')
    );
  }

  /**
   * Cargar catálogo completo de cuentas desde CUENTASYY (Firebird)
   */
  async function cargarCatalogoCuentas(empresaId, anio) {
    try {
      if (!empresaId || !Number.isInteger(Number(anio))) {
        console.warn("⚠️ Parámetros inválidos para cargar catálogo de cuentas");
        return [];
      }

      const ruta = `${API_BASE}/api/saldos/catalogo?empresaId=${encodeURIComponent(
        empresaId
      )}&anio=${Number(anio)}`;
      const headers =
        typeof Sesion !== "undefined" &&
        typeof Sesion.headersAutenticacion === "function"
          ? Sesion.headersAutenticacion()
          : {};

      const resp = await fetch(ruta, { headers });
      if (!resp.ok) {
        console.warn(`⚠️ Error al cargar catálogo: ${resp.status}`);
        return [];
      }

      const data = await resp.json();
      const cuentas = data.cuentas || [];

      console.log(
        `✅ Catálogo cargado: ${cuentas.length} cuentas de CUENTASYY ${anio}`
      );
      estado.cuentasDisponibles = cuentas;
      return cuentas;
    } catch (err) {
      console.error("❌ Error cargando catálogo de cuentas:", err);
      return [];
    }
  }

  /**
   * Crear/actualizar datalist con las cuentas disponibles
   */
  function crearDatalistCuentas() {
    let datalist = document.getElementById("datalist-cuentas-autocomplete");
    if (!datalist) {
      datalist = document.createElement("datalist");
      datalist.id = "datalist-cuentas-autocomplete";
      document.body.appendChild(datalist);
    }

    datalist.innerHTML = "";

    estado.cuentasDisponibles.forEach((cta) => {
      const option = document.createElement("option");
      // Formato: "401-001-000-00 - Renovaciones"
      const cuenta = cta.cuenta || "";
      const nombre = cta.nombre || "";
      option.value = cuenta;
      option.textContent = nombre ? `${cuenta} - ${nombre}` : cuenta;
      datalist.appendChild(option);
    });

    return datalist.id;
  }

  // Helpers para persistir layout (cuenta/descripcion) por empresa/anio/modulo
  const obtenerClaveLayoutLocal = ({ moduloClave, empresaId, anio }) => {
    if (!moduloClave || !empresaId || !Number.isInteger(anio)) return null;
    return `planeacion-layout:${empresaId}:${anio}:${moduloClave}`;
  };

  const cargarLayoutLocal = ({ moduloClave, empresaId, anio }) => {
    const clave = obtenerClaveLayoutLocal({ moduloClave, empresaId, anio });
    if (!clave || !window.localStorage) return null;
    try {
      const crudo = window.localStorage.getItem(clave);
      return crudo ? JSON.parse(crudo) : null;
    } catch (err) {
      console.warn("No fue posible leer layout local", err);
      return null;
    }
  };

  const guardarLayoutLocal = ({ moduloClave, empresaId, anio, layout }) => {
    const clave = obtenerClaveLayoutLocal({ moduloClave, empresaId, anio });
    if (!clave || !window.localStorage || !layout) return false;
    try {
      window.localStorage.setItem(clave, JSON.stringify(layout));
      return true;
    } catch (err) {
      console.warn("No fue posible guardar layout local", err);
      return false;
    }
  };

  async function guardarLayoutServidor({
    moduloClave,
    empresaId,
    anio,
    layout,
  }) {
    try {
      const ruta = `${API_BASE}/api/layouts`;
      const headers =
        typeof Sesion !== "undefined" &&
        typeof Sesion.headersAutenticacion === "function"
          ? {
              "Content-Type": "application/json",
              ...Sesion.headersAutenticacion(),
            }
          : { "Content-Type": "application/json" };
      const resp = await fetch(ruta, {
        method: "POST",
        headers,
        body: JSON.stringify({
          empresaId,
          modulo: moduloClave,
          anio,
          datos: layout,
        }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        console.warn(
          "Guardar layout servidor fallo:",
          data.mensaje || resp.status
        );
        return false;
      }
      return true;
    } catch (err) {
      console.warn("Error al guardar layout en servidor", err);
      return false;
    }
  }

  async function cargarLayoutServidor({ moduloClave, empresaId, anio }) {
    try {
      const anioNum = Number(anio);
      // Validar que todos los parámetros sean válidos
      if (!empresaId || !moduloClave || !Number.isInteger(anioNum) || anioNum <= 0) {
        console.warn('cargarLayoutServidor: parámetros inválidos', { empresaId, moduloClave, anio });
        return null;
      }
      const ruta = `${API_BASE}/api/layouts?empresaId=${encodeURIComponent(
        empresaId
      )}&modulo=${encodeURIComponent(moduloClave)}&anio=${anioNum}`;
      const headers =
        typeof Sesion !== "undefined" &&
        typeof Sesion.headersAutenticacion === "function"
          ? Sesion.headersAutenticacion()
          : null;
      const resp = await fetch(ruta, { headers });
      if (!resp.ok) return null;
      const data = await resp.json().catch(() => ({}));
      return data.layout || null;
    } catch (err) {
      console.warn("Error cargar layout servidor", err);
      return null;
    }
  }

  /**
   * Capturar layout actual de la tabla (estructura de filas)
   * Para SUMMARY/RESUMEN: captura cuenta y descripción de cada fila
   */
  function capturarLayoutTabla(tabla) {
    if (!tabla) return null;

    const filas = [];
    const tbody = tabla.querySelector("tbody");
    if (!tbody) return null;

    Array.from(tbody.querySelectorAll("tr")).forEach((fila, idx) => {
      const celdas = fila.cells;
      if (!celdas || celdas.length < 2) return;

      const cuenta = (celdas[0]?.textContent || "").trim();
      const descripcion = (celdas[1]?.textContent || "").trim();

      // Solo capturar filas con cuenta
      if (cuenta) {
        filas.push({
          indice: idx,
          cuenta: cuenta,
          descripcion: descripcion,
          nivel: fila.dataset.nivel || detectarNivel(cuenta),
          tipo: fila.dataset.tipo || detectarTipo(fila),
        });
      }
    });

    return {
      filas: filas,
      total: filas.length,
      timestamp: new Date().toISOString(),
    };
  }

  function detectarNivel(cuenta) {
    // Detectar nivel basado en estructura de cuenta
    const partes = cuenta.split("-").filter((p) => p && p !== "00");
    return partes.length;
  }

  function detectarTipo(fila) {
    // Detectar tipo de fila (CAPÍTULO, SECUNDARIA, etc.)
    if (
      fila.classList.contains("capitulo") ||
      fila.classList.contains("nivel-1")
    )
      return "CAPÍTULO";
    if (
      fila.classList.contains("secundaria") ||
      fila.classList.contains("nivel-2")
    )
      return "SECUNDARIA";
    if (fila.classList.contains("cuenta") || fila.classList.contains("nivel-3"))
      return "CUENTA";
    return "CUENTA";
  }

  /**
   * Resolver la tabla a utilizar considerando:
   * - Selector recibido
   * - data-tabla del body (id sin #)
   * - Fallbacks comunes
   */
  function resolverTabla(selectorPreferido) {
    const candidatos = [];
    if (selectorPreferido) candidatos.push(selectorPreferido);

    const dataTabla = document.body?.dataset?.tabla;
    if (dataTabla) {
      candidatos.push(dataTabla.startsWith("#") ? dataTabla : `#${dataTabla}`);
    }

    candidatos.push(
      estado.selectorTabla || SELECTOR_TABLA,
      SELECTOR_TABLA,
      "#mainTable",
      "#tablaPresupuestos",
      "table.table-comparison",
      "table"
    );

    for (const sel of candidatos) {
      if (!sel) continue;
      const tabla = document.querySelector(sel);
      if (tabla) return { tabla, selectorUsado: sel };
    }

    return { tabla: null, selectorUsado: selectorPreferido || SELECTOR_TABLA };
  }

  /**
   * Inicializar celdas de presupuesto como editables
   */
  function inicializarCeldasEditables(tabla) {
    if (!tabla) return;

    // Solo permitir editar celdas numéricas de presupuesto (month-budget)
    // NUNCA editar CUENTAS o DESCRIPCIÓN
    if (!estado.soloLayout) {
      // Buscar solo celdas con data-mes (month-budget columns)
      const selectorCeldasBudget = "td[data-mes]";
      const celdas = tabla.querySelectorAll(selectorCeldasBudget);

      celdas.forEach((celda) => {
        // CRÍTICO: Verificar si ya se inicializó para evitar listeners duplicados
        if (celda.dataset.modoEdicionInit) return;
        celda.dataset.modoEdicionInit = "true";

        celda.classList.add(CLASE_EDITABLE);
        celda.classList.add("editable");
        celda.style.cursor = "pointer";
        prepararCeldaNavegable(celda);

        celda.addEventListener("click", (evento) => {
          if (!estado.modoEdicionActivo) return;
          evento.stopPropagation();
          activarEdicionEnCelda(celda);
        });

        // NOTA: No agregar listener 'change' aquí - los cambios se capturan
        // en commitEditor() donde se verifica si el valor realmente cambió
      });
    }
    if (estado.soloLayout) {
      const celdasTexto = tabla.querySelectorAll("td[data-columna-clave]");
      celdasTexto.forEach((celda) => {
        if (!esCeldaTextoEditable(celda)) return;
        if (celda.dataset.modoEdicionInit) return;
        celda.dataset.modoEdicionInit = "true";

        celda.classList.add(CLASE_EDITABLE);
        celda.classList.add("editable");
        celda.style.cursor = "pointer";
        prepararCeldaNavegable(celda);

        celda.addEventListener("click", (evento) => {
          if (!estado.modoEdicionActivo) return;
          evento.stopPropagation();
          activarEdicionTextoEnCelda(celda);
        });
      });
    }


    // IMPORTANTE: Las columnas CUENTAS y DESCRIPCIÓN NO deben ser editables NUNCA
    // Solo las columnas month-budget son editables cuando el modo edición está activo
  }
  /**
   * Activar modo edicion en una celda numerica.
   * Requiere haber habilitado el modo edicion global.
   */
  function activarEdicionEnCelda(celda) {
    if (!celda || !estado.modoEdicionActivo) return;
    if (editorState.celda === celda) return;
    establecerCeldaActiva(celda);
    const numero = obtenerNumeroDesdeCelda(celda);
    const display = celda.textContent?.trim() || formatearNumero(numero);
    iniciarEdicionInline(celda, `${numero}`, {
      tipo: "numero",
      valorNumerico: numero,
      valorRestauracion: display,
    });
  }
  /**
   * Activar edicion textual (cuenta/descripcion) en una celda.
   * Requiere modo edicion activo; aplica a ajustes de layout locales.
   */
  function activarEdicionTextoEnCelda(celda) {
    if (!celda || !estado.modoEdicionActivo) return;
    // Solo permitir editar texto (cuenta/descripción) en plantillas.html
    const esPlantillas = window.location.pathname.includes("plantillas.html");
    if (!esPlantillas && !estado.soloLayout) return;
    if (estado.soloLayout && !esCeldaTextoEditable(celda)) return;

    if (editorState.celda === celda) return;
    establecerCeldaActiva(celda);
    const valor = celda.textContent?.trim() || "";
    const opciones = { tipo: "texto" };
    const columna = celda.dataset.columnaClave || "";
    if (columna === "cuenta" && estado.cuentasDisponibles?.length > 0) {
      opciones.datalistId = crearDatalistCuentas();
      opciones.placeholder = "Buscar cuenta...";
    } else if (columna === "descripcion") {
      opciones.placeholder = "Descripción...";
    }
    iniciarEdicionInline(celda, valor, opciones);
  }

  function manejarTeclasEditor(evento) {
    if (!editorState.celda) return;
    const accel = evento.ctrlKey || evento.metaKey;
    if (accel && !evento.altKey) {
      const key = (evento.key || "").toLowerCase();
      if (key === "d") {
        evento.preventDefault();
        const celda = editorState.celda;
        commitEditor();
        rellenarDireccion(celda, "down", { hastaFinal: evento.shiftKey });
        return;
      }
      if (key === "r") {
        evento.preventDefault();
        const celda = editorState.celda;
        commitEditor();
        rellenarDireccion(celda, "right", { hastaFinal: evento.shiftKey });
        return;
      }
    }
    switch (evento.key) {
      case "Enter":
        evento.preventDefault();
        commitEditor({ mover: evento.shiftKey ? "up" : "down" });
        break;
      case "Tab":
        evento.preventDefault();
        commitEditor({ mover: evento.shiftKey ? "left" : "right" });
        break;
      case "ArrowRight":
        evento.preventDefault();
        commitEditor({ mover: "right" });
        break;
      case "ArrowLeft":
        evento.preventDefault();
        commitEditor({ mover: "left" });
        break;
      case "ArrowUp":
        evento.preventDefault();
        commitEditor({ mover: "up" });
        break;
      case "ArrowDown":
        evento.preventDefault();
        commitEditor({ mover: "down" });
        break;
      case "Escape":
        evento.preventDefault();
        cancelarEditor();
        break;
      default:
        break;
    }
  }

  function commitEditor({ mover } = {}) {
    if (!editorState.celda || !editorState.input) return;
    const celda = editorState.celda;
    const tipo = editorState.tipo;
    const valorAnterior = editorState.valorOriginal || "";
    const numeroAnterior = editorState.valorNumericoOriginal;
    const valorIngresado = editorState.input.value || "";

    editorState.commitEnProgreso = true;
    try {
      if (tipo === "numero") {
        const numero = obtenerNumeroDesdeTexto(valorIngresado);
        const previo = Number.isFinite(numeroAnterior)
          ? numeroAnterior
          : obtenerNumeroDesdeCelda(celda);
        celda.dataset.valorPlano = `${numero}`;
        celda.textContent = formatearNumero(numero);
        celda.classList.remove(CLASE_EDITANDO);
        if (Math.abs(numero - previo) > 0.0001) {
          marcarComoModificado(celda);
          capturarCambio(celda, numero);
        }
      } else {
        const nuevo = valorIngresado.trim();
        const previo = valorAnterior.trim();
        celda.classList.remove(CLASE_EDITANDO);
        celda.textContent = nuevo || previo;
        if (nuevo !== previo) {
          marcarComoModificado(celda);
          const fila = celda.closest("tr");
          if (fila && celda.dataset.columnaClave === "cuenta") {
            fila.dataset.cuenta = nuevo || "";
          }
          // NO persistir automáticamente - solo marcar como modificado
          // El usuario debe guardar explícitamente el borrador
          estado.layoutModificado = true;
        }
      }
    } finally {
      editorState.commitEnProgreso = false;
      establecerCeldaActiva(celda);
      ocultarEditor();
    }

    if (mover) {
      const siguiente = obtenerCeldaVecina(celda, mover);
      if (siguiente) {
        if (siguiente.dataset.mes) {
          activarEdicionEnCelda(siguiente);
        } else if (siguiente.dataset.columnaClave) {
          activarEdicionTextoEnCelda(siguiente);
        }
      }
    }
  }

  function cancelarEditor() {
    if (!editorState.celda) return;
    const celda = editorState.celda;
    celda.textContent = editorState.valorOriginal;
    celda.classList.remove(CLASE_EDITANDO);
    establecerCeldaActiva(celda);
    ocultarEditor();
  }

  function obtenerCeldaVecina(celda, direccion) {
    if (!celda) return null;
    const fila = celda.closest("tr");
    if (!fila) return null;
    const cuerpo = fila.parentElement;
    const filas = Array.from(cuerpo?.querySelectorAll("tr") || []);
    const filaIndex = filas.indexOf(fila);
    if (filaIndex === -1) return null;
    const esNumerica = Boolean(celda.dataset.mes);

    const buscarHorizontal = (paso) => {
      if (esNumerica) {
        const numericas = Array.from(fila.querySelectorAll("td[data-mes]"));
        const posicion = numericas.indexOf(celda);
        const destino = numericas[posicion + paso];
        if (destino && destino.offsetParent !== null) return destino;
        // Si no hay destino y vamos a la izquierda, regresar a descripción/cuenta
        if (paso < 0) {
          const preferidas = [
            fila.querySelector('td[data-columna-clave="descripcion"]'),
            fila.querySelector('td[data-columna-clave="cuenta"]'),
          ].filter(Boolean);
          const destinoTexto = preferidas.find(
            (cel) => cel && cel.offsetParent !== null
          );
          return destinoTexto || fila.cells[0] || null;
        }
        return null;
      }
      const indice = celda.cellIndex + paso;
      if (indice >= 0 && indice < fila.cells.length) {
        const candidata = fila.cells[indice];
        return candidata && candidata.offsetParent !== null ? candidata : null;
      }
      return null;
    };

    const buscarVertical = (paso) => {
      for (let i = filaIndex + paso; i >= 0 && i < filas.length; i += paso) {
        const row = filas[i];
        let candidate = null;
        if (esNumerica && celda.dataset.mes) {
          candidate = row.querySelector(`td[data-mes="${celda.dataset.mes}"]`);
        } else if (celda.dataset.columnaClave) {
          candidate = Array.from(row.cells).find(
            (td) => td.dataset.columnaClave === celda.dataset.columnaClave
          );
        } else {
          candidate = row.cells[celda.cellIndex] || null;
        }
        if (candidate && candidate.offsetParent !== null) return candidate;
      }
      return null;
    };

    if (direccion === "left") return buscarHorizontal(-1);
    if (direccion === "right") return buscarHorizontal(1);
    if (direccion === "up") return buscarVertical(-1);
    if (direccion === "down") return buscarVertical(1);
    return null;
  }

  function obtenerCeldaVecinaEditable(celda, direccion) {
    if (!celda) return null;
    const fila = celda.closest("tr");
    if (!fila) return null;
    const cuerpo = fila.parentElement;
    const filas = Array.from(cuerpo?.querySelectorAll("tr") || []);
    const filaIndex = filas.indexOf(fila);
    if (filaIndex < 0) return null;

    if (celda.dataset.mes) {
      if (direccion === "left" || direccion === "right") {
        const numericas = Array.from(fila.querySelectorAll("td[data-mes]"));
        const idx = numericas.indexOf(celda);
        if (idx < 0) return null;
        const paso = direccion === "left" ? -1 : 1;
        for (let i = idx + paso; i >= 0 && i < numericas.length; i += paso) {
          const candidato = numericas[i];
          if (candidato && candidato.offsetParent !== null) return candidato;
        }
        return null;
      }
      if (direccion === "up" || direccion === "down") {
        const paso = direccion === "up" ? -1 : 1;
        for (let i = filaIndex + paso; i >= 0 && i < filas.length; i += paso) {
          const row = filas[i];
          const candidato = row.querySelector(
            `td[data-mes="${celda.dataset.mes}"]`
          );
          if (candidato && candidato.offsetParent !== null) return candidato;
        }
        return null;
      }
    }

    if (esCeldaTextoEditable(celda)) {
      const cells = Array.from(fila.cells || []);
      const colIndex = cells.indexOf(celda);
      if (colIndex < 0) return null;

      if (direccion === "left" || direccion === "right") {
        const paso = direccion === "left" ? -1 : 1;
        for (let i = colIndex + paso; i >= 0 && i < cells.length; i += paso) {
          const candidato = cells[i];
          if (esCeldaTextoEditable(candidato) && candidato.offsetParent !== null)
            return candidato;
        }
        return null;
      }
      if (direccion === "up" || direccion === "down") {
        const paso = direccion === "up" ? -1 : 1;
        for (let i = filaIndex + paso; i >= 0 && i < filas.length; i += paso) {
          const row = filas[i];
          const candidato = row.cells[colIndex];
          if (esCeldaTextoEditable(candidato) && candidato.offsetParent !== null)
            return candidato;
        }
        return null;
      }
    }

    return null;
  }

  function extraerValorCelda(celda) {
    if (!celda) return null;
    if (celda.dataset.mes) {
      return { tipo: "numero", numero: obtenerNumeroDesdeCelda(celda) };
    }
    return { tipo: "texto", texto: (celda.textContent || "").trim() };
  }

  function aplicarValorEnCelda(celda, valor) {
    if (!celda || !valor) return false;
    if (valor.tipo === "numero") {
      if (!celda.dataset.mes) return false;
      const previo = obtenerNumeroDesdeCelda(celda);
      const numero = Number.isFinite(valor.numero) ? valor.numero : 0;
      celda.dataset.valorPlano = `${numero}`;
      celda.textContent = formatearNumero(numero);
      celda.classList.remove(CLASE_EDITANDO);
      if (Math.abs(numero - previo) > 0.0001) {
        marcarComoModificado(celda);
        capturarCambio(celda, numero);
      }
      return true;
    }
    if (!esCeldaTextoEditable(celda)) return false;
    const previo = (celda.textContent || "").trim();
    const nuevo = (valor.texto || "").toString().trim();
    const textoFinal = nuevo || previo;
    celda.classList.remove(CLASE_EDITANDO);
    celda.textContent = textoFinal;
    if (textoFinal !== previo) {
      marcarComoModificado(celda);
      const fila = celda.closest("tr");
      if (fila && celda.dataset.columnaClave === "cuenta") {
        fila.dataset.cuenta = textoFinal || "";
      }
      estado.layoutModificado = true;
    }
    return true;
  }

  function rellenarDireccion(celda, direccion, opciones = {}) {
    if (!celda) return null;
    const valor = opciones.valor || extraerValorCelda(celda);
    if (!valor) return null;
    let actual = celda;
    let destino = obtenerCeldaVecinaEditable(actual, direccion);
    let ultimo = null;

    while (destino) {
      if (!aplicarValorEnCelda(destino, valor)) break;
      ultimo = destino;
      if (!opciones.hastaFinal) break;
      actual = destino;
      destino = obtenerCeldaVecinaEditable(actual, direccion);
    }

    if (ultimo) {
      establecerCeldaActiva(ultimo);
    } else {
      establecerCeldaActiva(celda);
    }
    return ultimo;
  }

  function manejarTeclasCelda(evento) {
    if (!estado.modoEdicionActivo) return;
    const celda = evento.currentTarget;
    if (!esCeldaEditable(celda)) return;

    const accel = evento.ctrlKey || evento.metaKey;
    if (accel && !evento.altKey) {
      const key = (evento.key || "").toLowerCase();
      if (key === "d") {
        evento.preventDefault();
        rellenarDireccion(celda, "down", { hastaFinal: evento.shiftKey });
        return;
      }
      if (key === "r") {
        evento.preventDefault();
        rellenarDireccion(celda, "right", { hastaFinal: evento.shiftKey });
        return;
      }
    }

    switch (evento.key) {
      case "Enter":
      case "F2": {
        evento.preventDefault();
        if (celda.dataset.mes) {
          activarEdicionEnCelda(celda);
        } else if (esCeldaTextoEditable(celda)) {
          activarEdicionTextoEnCelda(celda);
        }
        break;
      }
      case "ArrowDown": {
        evento.preventDefault();
        const siguiente = obtenerCeldaVecinaEditable(celda, "down");
        if (siguiente) establecerCeldaActiva(siguiente);
        break;
      }
      case "ArrowUp": {
        evento.preventDefault();
        const siguiente = obtenerCeldaVecinaEditable(celda, "up");
        if (siguiente) establecerCeldaActiva(siguiente);
        break;
      }
      case "ArrowLeft": {
        evento.preventDefault();
        const siguiente = obtenerCeldaVecinaEditable(celda, "left");
        if (siguiente) establecerCeldaActiva(siguiente);
        break;
      }
      case "ArrowRight": {
        evento.preventDefault();
        const siguiente = obtenerCeldaVecinaEditable(celda, "right");
        if (siguiente) establecerCeldaActiva(siguiente);
        break;
      }
      case "Tab": {
        evento.preventDefault();
        const dir = evento.shiftKey ? "left" : "right";
        const siguiente = obtenerCeldaVecinaEditable(celda, dir);
        if (siguiente) establecerCeldaActiva(siguiente);
        break;
      }
      default:
        break;
    }
  }

  function prepararCeldaNavegable(celda) {
    if (!celda || celda.dataset.modoEdicionNavInit) return;
    celda.dataset.modoEdicionNavInit = "true";
    if (!celda.hasAttribute("tabindex")) {
      celda.tabIndex = 0;
    }
    celda.addEventListener("focus", () => {
      if (!estado.modoEdicionActivo) return;
      if (!esCeldaEditable(celda)) return;
      establecerCeldaActiva(celda);
    });
    celda.addEventListener("keydown", manejarTeclasCelda);
  }

  /**
   * Formatear número con separadores de miles
   */
  function formatearNumero(numero) {
    if (!Number.isFinite(numero)) return "0.00";
    return numero.toLocaleString("es-MX", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  /**
   * Marcar celda como modificada
   */
  function marcarComoModificado(celda) {
    celda.classList.add(CLASE_MODIFICADO);

    // Cambiar color de fondo para visual feedback
    if (!celda.style.backgroundColor) {
      celda.style.backgroundColor = "#ffffcc"; // Amarillo claro
    }
  }

  /**
   * Capturar cambio de una celda
   */
  function capturarCambio(celda, nuevoValor) {
    const fila = celda.closest("tr");
    if (!fila) return;

    // Obtener cuenta de varias formas posibles
    let cuenta =
      fila.dataset.cuenta ||
      fila.querySelector("[data-cuenta]")?.dataset.cuenta ||
      fila.cells[0]?.textContent.trim();

    const mes = celda.dataset.mes;

    if (!cuenta || !mes) return;

    // Crear estructura de cambios si no existe
    if (!estado.cambiosCapturados[cuenta]) {
      estado.cambiosCapturados[cuenta] = {
        cuenta,
        valores: {},
      };
    }

    estado.cambiosCapturados[cuenta].valores[mes] = nuevoValor;

    console.log(`📝 Capturado: ${cuenta} ${mes} = ${nuevoValor}`);
  }

  /**
   * Obtener todos los cambios capturados
   */
  function obtenerTodosCambios() {
    const presupuesto = Object.values(estado.cambiosCapturados);

    if (presupuesto.length === 0) {
      console.warn("⚠️ No hay cambios capturados en modo edición");
    } else {
      console.log(
        `✅ Cambios capturados: ${presupuesto.length} cuentas modificadas`
      );
    }

    return { presupuesto };
  }

  // Capturar layout (cuenta+descripcion y tipo fila) desde la tabla para persistencia
  function capturarLayoutDesdeTabla(tabla) {
    if (!tabla) {
      const res = resolverTabla(estado.selectorTabla);
      tabla = res.tabla;
    }
    if (!tabla) return null;
    const filas = Array.from(tabla.tBodies[0]?.rows || []);
    const layout = filas.map((fila, idx) => {
      const cuenta = (
        fila.dataset.cuenta ||
        fila.querySelector("[data-cuenta]")?.dataset.cuenta ||
        fila.cells[0]?.textContent ||
        ""
      )
        .toString()
        .trim();
      const descripcion = (
        fila.querySelector('[data-role="descripcion"]')?.textContent ||
        fila.cells[1]?.textContent ||
        ""
      )
        .toString()
        .trim();
      const role =
        fila.dataset.rowRole ||
        fila.dataset.rowRole?.trim() ||
        fila.dataset.role ||
        "";
      return {
        id: fila.id || `r${idx}`,
        cuenta,
        descripcion,
        role,
      };
    });
    return { filas: layout };
  }

  function persistirLayoutActual() {
    // Evitar recursión infinita
    if (estado.persistiendo) {
      console.log("⚠️ Ya hay una persistencia en curso, omitiendo...");
      return false;
    }
    estado.persistiendo = true;

    try {
      const { tabla } = resolverTabla(estado.selectorTabla);

      // NO hacer blur aquí para evitar recursión
      // El blur ya se manejó en la función guardar()

      if (!tabla) {
        return false;
      }
      const empresa = Sesion.obtenerEmpresaActiva();
      const selectAnioElem =
        obtenerSelectorAnio() || document.querySelector('[name="anio"]');
      const anioSeleccion = Number(
        selectAnioElem?.value || new Date().getFullYear()
      );
      const anio = Number.isInteger(anioSeleccion) ? anioSeleccion : null;
      const moduloClave = (
        document.body?.dataset?.modulo ||
        document.body?.dataset?.moduloId ||
        "resumen"
      )
        .toString()
        .trim();
      if (!empresa?.id || !Number.isInteger(anio) || !moduloClave) {
        console.warn(
          "No fue posible persistir layout: falta empresa/anio/modulo",
          { empresa: empresa?.id, anio, moduloClave }
        );
        return false;
      }
      const layout = capturarLayoutDesdeTabla(tabla);
      if (!layout) {
        return false;
      }
      const guardadoLocal = guardarLayoutLocal({
        moduloClave,
        empresaId: empresa.id,
        anio,
        layout,
      });

      // Try server-side persist; fallback silently if server fails
      guardarLayoutServidor({
        moduloClave,
        empresaId: empresa.id,
        anio,
        layout,
      })
        .then((srv) => {
          if (srv) {
            console.log("✅ Layout guardado en servidor", {
              moduloClave,
              empresaId: empresa.id,
              anio,
            });
          } else {
            console.error("❌ Error guardando layout en servidor");
          }
        })
        .catch((err) => {
          console.error("❌ Error guardando layout en servidor:", err);
        });

      if (guardadoLocal) {
        estado.layoutModificado = false;
        console.log("✅ Layout persistido (localStorage)", {
          moduloClave,
          empresaId: empresa.id,
          anio,
          filasCapturadas: layout?.filas?.length || 0,
        });
      }

      return guardadoLocal;
    } catch (err) {
      console.error("❌ Error en persistirLayoutActual:", err);
      return false;
    } finally {
      // Liberar flag de persistencia SIEMPRE
      estado.persistiendo = false;
    }
  }

  function aplicarLayoutLocal(layout, tabla) {
    if (!layout || !Array.isArray(layout.filas) || !tabla) return false;
    const filas = Array.from(tabla.tBodies[0]?.rows || []);
    layout.filas.forEach((filaLayout) => {
      const { cuenta: cuentaLayout, descripcion: descripcionLayout } =
        filaLayout || {};
      if (!cuentaLayout) return;
      // Buscar fila por dataset.cuenta o por primera celda coincidente
      const filaMatch = filas.find(
        (f) =>
          (f.dataset.cuenta &&
            normalizeString(f.dataset.cuenta) ===
              normalizeString(cuentaLayout)) ||
          (f.cells[0]?.textContent || "").trim() === (cuentaLayout || "").trim()
      );
      if (filaMatch) {
        const celdaDescripcion =
          filaMatch.querySelector('[data-role="descripcion"]') ||
          filaMatch.cells[1];
        if (celdaDescripcion && descripcionLayout != null) {
          celdaDescripcion.textContent = descripcionLayout;
        }
        // Si el layout contiene un valor de cuenta diferente, actualizar el dataset
        try {
          if (cuentaLayout) {
            const actual = (
              filaMatch.dataset.cuenta ||
              filaMatch.querySelector("[data-cuenta]")?.dataset.cuenta ||
              ""
            )
              .toString()
              .trim();
            if (actual !== (cuentaLayout || "").toString().trim()) {
              filaMatch.dataset.cuenta = cuentaLayout || "";
              filaMatch.dataset.cuentaVisible = cuentaLayout || "";
            }
          }
        } catch (err) {
          // ignore
        }
      }
    });
    return true;
  }

  /**
   * Limpiar cambios capturados
   */
  function limpiarCambios() {
    estado.cambiosCapturados = {};
    estado.layoutModificado = false;

    // Remover estilos de modificado
    const { tabla } = resolverTabla(estado.selectorTabla);
    if (tabla) {
      tabla.querySelectorAll(`.${CLASE_MODIFICADO}`).forEach((celda) => {
        celda.classList.remove(CLASE_MODIFICADO);
        celda.style.backgroundColor = "";
      });
    }

    console.log("🧹 Cambios limpiados");
  }
  /**
   * Activar modo edicion global.
   * Habilita clicks en celdas segun el modo actual.
   */
  function activarModoEdicion(tabla) {
    if (!tabla) return;

    estado.modoEdicionActivo = true;
    tabla.classList.add("modo-edicion-activo");

    const celdas = tabla.querySelectorAll(`.${CLASE_EDITABLE}`);
    celdas.forEach((celda) => {
      if (estado.soloLayout && celda.dataset.mes) return;
      celda.style.cursor = "pointer";
      celda.title = "Click para editar";
    });

    const mensaje = estado.soloLayout
      ? "ModoEdicionPresupuesto: ACTIVADO (modo solo layout)"
      : "ModoEdicionPresupuesto: ACTIVADO (solo month-budget editable)";
    console.log(mensaje);
  }

  /**
   * Desactivar modo edición global
   */
  function desactivarModoEdicion(tabla) {
    if (!tabla) return;

    estado.modoEdicionActivo = false;
    tabla.classList.remove("modo-edicion-activo");

    const editando = tabla.querySelector(`.${CLASE_EDITANDO}`);
    if (editando) {
      editando.textContent = editando.querySelector("input")?.value || "";
      editando.classList.remove(CLASE_EDITANDO);
    }
    ocultarEditor();
    limpiarCeldaActiva();

    console.log("ModoEdicionPresupuesto: modo edicion desactivado");
  }

  // CONTEXT MENU: Agregar/Eliminar filas y secciones
  let menuContextual = null;
  let filaContextual = null;

  function ocultarMenuContextual() {
    if (!menuContextual) return;
    // remove keyboard handler
    try {
      if (menuContextual._keyHandler)
        menuContextual.removeEventListener(
          "keydown",
          menuContextual._keyHandler
        );
    } catch (err) {}
    menuContextual.hidden = true;
    // return focus to the table or last active element
    try {
      document.activeElement?.blur();
    } catch (err) {}
  }

  function mostrarMenuContextual(x, y, opciones) {
    // Ensure we have base styles injected
    if (!document.getElementById("modoedicion-style")) {
      const style = document.createElement("style");
      style.id = "modoedicion-style";
      style.textContent = `
        .modoedicion-context-menu { position: absolute; z-index: 99999; background: #fff; border: 1px solid #dcdcdc; padding: 4px; box-shadow: 0 3px 8px rgba(0,0,0,0.12); min-width: 140px; }
        .modoedicion-context-menu button { display:block; width:100%; border: none; background: transparent; padding:6px 10px; text-align: left; cursor: pointer; }
        .modoedicion-context-menu button:focus { outline: 2px solid #2b7cff; background:#f0f8ff; }
      `;
      document.head.appendChild(style);
    }

    const menu =
      menuContextual ||
      Object.assign(document.createElement("div"), {
        className: "modoedicion-context-menu",
        role: "menu",
        "aria-label": "Acciones de edición",
      });
    menuContextual = menu;
    menu.innerHTML = "";
    opciones.forEach((opcion, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-sm btn-light w-100 text-start";
      btn.textContent = opcion.texto || opcion.label;
      btn.setAttribute("role", "menuitem");
      btn.setAttribute("tabindex", "-1");
      btn.addEventListener("click", () => {
        switch (opcion.clave) {
          case "add_row":
            // Usar InsertionWizard si está disponible
            if (typeof window.InsertionWizard !== "undefined") {
              window.InsertionWizard.open(filaContextual);
            } else {
              // Fallback al sistema simple
              insertarFilaNueva("abajo");
            }
            break;
          case "delete_row":
            eliminarFilaSeleccionada();
            break;
          default:
            break;
        }
        ocultarMenuContextual();
      });
      menu.appendChild(btn);
    });
    document.body.appendChild(menu);
    // prevent offscreen
    menu.hidden = true; // hide until positioned
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    requestAnimationFrame(() => {
      const rect = menu.getBoundingClientRect();
      let nx = x,
        ny = y;
      if (rect.right > window.innerWidth) nx = Math.max(6, x - rect.width);
      if (rect.bottom > window.innerHeight) ny = Math.max(6, y - rect.height);
      menu.style.left = `${nx}px`;
      menu.style.top = `${ny}px`;
      menu.hidden = false;
      // Setup keyboard navigation
      const botones = Array.from(menu.querySelectorAll("button"));
      if (botones.length) {
        botones.forEach((b, i) => b.setAttribute("data-idx", i));
        botones[0].setAttribute("tabindex", "0");
        botones[0].focus();
        const keyHandler = (e) => {
          if (!menu || menu.hidden) return;
          const current = document.activeElement;
          const idx = Number(current?.getAttribute("data-idx") || 0);
          if (e.key === "ArrowDown") {
            const next = botones[(idx + 1) % botones.length];
            next.focus();
            e.preventDefault();
          } else if (e.key === "ArrowUp") {
            const prev = botones[(idx - 1 + botones.length) % botones.length];
            prev.focus();
            e.preventDefault();
          } else if (e.key === "Escape") {
            ocultarMenuContextual();
            e.preventDefault();
          }
        };
        menu._keyHandler = keyHandler;
        menu.addEventListener("keydown", keyHandler);
      }
    });
    menuContextual = menu;
  }

  function insertarFilaNueva(pos = "abajo") {
    const { tabla } = resolverTabla(estado.selectorTabla);
    if (!tabla || !filaContextual) return;
    const nueva = filaContextual.cloneNode(true);
    // limpiar valores y IDs
    nueva.id = "";
    Array.from(nueva.cells).forEach((c) => (c.textContent = ""));
    if (pos === "abajo")
      filaContextual.parentNode.insertBefore(nueva, filaContextual.nextSibling);
    else filaContextual.parentNode.insertBefore(nueva, filaContextual);
    // rebind
    inicializarCeldasEditables(tabla);
  }

  function eliminarFilaSeleccionada() {
    if (!filaContextual) return;
    filaContextual.remove();
    filaContextual = null;
  }

  function agregarSeccionNueva() {
    const { tabla } = resolverTabla(estado.selectorTabla);
    if (!tabla || !filaContextual) return;
    const thead = tabla.tHead;
    const tbody = tabla.tBodies[0];
    const nueva = document.createElement("tr");
    nueva.className = "section-header-row";
    const c1 = document.createElement("td");
    c1.colSpan = tabla.tHead.rows[0]?.cells.length || 2;
    c1.textContent = "Nueva Seccion";
    nueva.appendChild(c1);
    filaContextual.parentNode.insertBefore(nueva, filaContextual);
    inicializarCeldasEditables(tabla);
  }

  document.addEventListener("contextmenu", (evt) => {
    if (!estado.modoEdicionActivo) return;
    if (window.ContextMenuWizard || window.InsertionWizard) return;
    const res = resolverTabla(estado.selectorTabla);
    if (!res || !res.tabla) return;
    const tabla = res.tabla;
    if (!tabla.contains(evt.target)) return;
    const fila = evt.target.closest("tr");
    if (!fila) return;
    filaContextual = fila;
    const opciones = [];
    // Si es fila de cuenta o sección
    if (
      fila.querySelector("[data-cuenta]") ||
      fila.dataset.cuenta ||
      fila.classList.contains("fila-cuenta") ||
      fila.classList.contains("section-header-row")
    ) {
      opciones.push({ clave: "add_row", texto: "Agregar cuenta/sección..." });
      opciones.push({ clave: "delete_row", texto: "Eliminar fila" });
    } else {
      opciones.push({ clave: "add_row", texto: "Agregar cuenta/sección..." });
    }
    if (!opciones.length) return;
    evt.preventDefault();
    mostrarMenuContextual(evt.pageX, evt.pageY, opciones);
  });

  /**
   * API Pública
   */
  window.ModoEdicionPresupuesto = {
    /**
     * Inicializar el módulo
     * @param {string} selectorTabla - Selector CSS de la tabla
     * @param {object} opciones - { soloLayout: boolean } - Si true, solo edita cuenta/descripción
     */
    // Referencia al timer de reintento para evitar acumulación
    _pendingRetryTimer: null,

    inicializar: function (selectorTabla, opciones = {}) {
      // CRÍTICO: Limpiar timer de reintento anterior si existe
      if (this._pendingRetryTimer) {
        clearInterval(this._pendingRetryTimer);
        this._pendingRetryTimer = null;
      }

      // Configurar modo soloLayout (para SUMMARY/RESUMEN)
      estado.soloLayout = opciones.soloLayout === true;

      if (estado.soloLayout) {
        console.log(
          "📝 Modo SOLO LAYOUT: cuenta/descripción editables, NO valores numéricos"
        );
      }

      const { tabla, selectorUsado } = resolverTabla(selectorTabla);
      if (!tabla) {
        console.error(`❌ No se encontró tabla en selector: ${selectorUsado}`);
        // Reintenta por si la tabla se inserta asincrónicamente
        let reintentos = 4;
        const self = this;
        this._pendingRetryTimer = setInterval(() => {
          const intento = resolverTabla(selectorUsado);
          if (intento.tabla) {
            clearInterval(self._pendingRetryTimer);
            self._pendingRetryTimer = null;
            estado.selectorTabla = intento.selectorUsado;
            inicializarCeldasEditables(intento.tabla);
            console.log(
              `✅ Modo edición inicializado (reintento) sobre ${intento.selectorUsado}`
            );
          } else if (--reintentos <= 0) {
            clearInterval(self._pendingRetryTimer);
            self._pendingRetryTimer = null;
            console.warn("⚠️ No se encontró tabla después de 4 reintentos");
          }
        }, 400);
        return false;
      }

      estado.selectorTabla = selectorUsado;
      inicializarCeldasEditables(tabla);

      // Cargar catálogo de cuentas desde CUENTASYY (Firebird)
      try {
        const empresa = Sesion?.obtenerEmpresaActiva?.();
        const selectAnio = obtenerSelectorAnio();
        const anioSeleccion = Number(selectAnio?.value);
        const anio =
          Number.isInteger(anioSeleccion) && anioSeleccion > 0
            ? anioSeleccion
            : null;

        if (empresa?.id && anio && anio > 0) {
          cargarCatalogoCuentas(empresa.id, anio);

          // Escuchar cambios de año para recargar catálogo
          if (selectAnio && !selectAnio.dataset.catalogoListener) {
            selectAnio.dataset.catalogoListener = "true";
            selectAnio.addEventListener("change", () => {
              const nuevoAnio = Number(selectAnio.value);
              if (Number.isInteger(nuevoAnio) && nuevoAnio > 0 && empresa?.id) {
                cargarCatalogoCuentas(empresa.id, nuevoAnio);
              }
            });
          }
        } else {
          console.warn(
            "⚠️ No se pudo determinar año o empresa para cargar catálogo",
            {
              empresaId: empresa?.id,
              anio,
              anioSeleccion,
              selectorEncontrado: !!selectAnio,
              selectorValue: selectAnio?.value,
            }
          );
        }
      } catch (err) {
        console.warn("⚠️ Error cargando catálogo de cuentas:", err);
      }

      // Intentar cargar layout guardado localmente y aplicarlo
      try {
        const empresa = Sesion.obtenerEmpresaActiva();
        const selectAnio = obtenerSelectorAnio();
        const anioSeleccion = Number(selectAnio?.value);
        const anio = Number.isInteger(anioSeleccion) ? anioSeleccion : null;
        const moduloClave = (
          document.body?.dataset?.modulo ||
          document.body?.dataset?.moduloId ||
          "resumen"
        )
          .toString()
          .trim();
        if (empresa?.id && Number.isInteger(anio) && moduloClave) {
          // Prefer server layout; fallback to local layout
          (async () => {
            const serverLayout = await cargarLayoutServidor({
              moduloClave,
              empresaId: empresa.id,
              anio,
            });
            if (serverLayout && aplicarLayoutLocal(serverLayout, tabla)) return;
            const localLayout = cargarLayoutLocal({
              moduloClave,
              empresaId: empresa.id,
              anio,
            });
            if (localLayout) aplicarLayoutLocal(localLayout, tabla);
          })();
        }
      } catch (err) {
        console.warn("Error aplicando layout local", err);
      }

      const mensajeInicial = estado.soloLayout
        ? `✅ ModoEdicionPresupuesto (soloLayout): cuenta/descripción editables en ${selectorUsado}`
        : `✅ ModoEdicionPresupuesto: listeners inicializados (NO activo) en ${selectorUsado}`;
      console.log(mensajeInicial);
      return true;
    },

    /**
     * Activar modo edicion (wrapper publico).
     */
    activar: function (selectorTabla) {
      const { tabla, selectorUsado } = resolverTabla(
        selectorTabla || estado.selectorTabla
      );
      if (!tabla) {
        console.error(`❌ No se encontró tabla: ${selectorUsado}`);
        return false;
      }

      estado.selectorTabla = selectorUsado;
      // Reaplicar listeners en caso de rerender
      inicializarCeldasEditables(tabla);
      activarModoEdicion(tabla);
      return true;
    },

    /**
     * Desactivar modo edición
     */
    desactivar: function (selectorTabla) {
      const { tabla, selectorUsado } = resolverTabla(
        selectorTabla || estado.selectorTabla
      );
      if (!tabla) return false;

      estado.selectorTabla = selectorUsado;
      desactivarModoEdicion(tabla);
      return true;
    },

    /**
     * Obtener cambios capturados
     */
    obtenerCambios: function () {
      return obtenerTodosCambios();
    },

    /**
     * Limpiar cambios
     */
    limpiar: function () {
      limpiarCambios();
    },

    /**
     * Obtener estado
     */
    estaActivo: function () {
      return estado.modoEdicionActivo;
    },

    /**
     * Obtener número de cambios
     */
    obtenerNumCambios: function () {
      return Object.keys(estado.cambiosCapturados).length;
    },
    // Persiste layout actual como plantilla local (por empresa/anio/modulo)
    guardarLayout: function () {
      return persistirLayoutActual();
    },
    cargarLayoutLocal: function () {
      const empresa = Sesion.obtenerEmpresaActiva();
      const anioSeleccion = Number(
        document.getElementById("selectAnio")?.value || new Date().getFullYear()
      );
      const anio = Number.isInteger(anioSeleccion) ? anioSeleccion : null;
      const moduloClave = (
        document.body?.dataset?.modulo ||
        document.body?.dataset?.moduloId ||
        "resumen"
      )
        .toString()
        .trim();
      if (!empresa?.id || !Number.isInteger(anio) || !moduloClave) return null;
      return cargarLayoutLocal({ moduloClave, empresaId: empresa.id, anio });
    },

    /**
     * Capturar layout actual de la tabla
     */
    capturarLayout: function (tabla) {
      const tablaResuelta = tabla || resolverTabla(estado.selectorTabla).tabla;
      return capturarLayoutTabla(tablaResuelta);
    },

    aplicarLayoutLocal: function (layout) {
      const { tabla } = resolverTabla(estado.selectorTabla);
      return aplicarLayoutLocal(layout, tabla);
    },

    /**
     * Propiedad para verificar si hay cambios en layout
     */
    get layoutModificado() {
      return Boolean(estado.layoutModificado);
    },
  };

  console.log("📦 Módulo ModoEdicionPresupuesto cargado");
})();
