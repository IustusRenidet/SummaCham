/**
 * plantillas.js
 * Gestor de plantillas simplificado para SummaCham
 * Combina funcionalidades de LayoutLoader y LayoutBuilder
 */

(() => {
  "use strict";

  // ==========================================
  // CONFIGURATION
  // ==========================================
  const API_ROOT =
    window.location.protocol === "file:"
      ? "http://localhost:3005/api"
      : `${window.location.origin}/api`;
  const API_BASE = `${API_ROOT}/layouts-config`;
  const AUTO_OPERACIONES_DISABLED = true;
  const MANUAL_ORDER_ONLY = true;
  const FORCE_EDIT_MODE = true;
  const FORCE_MODAL_EDITOR = false; // SIEMPRE FALSE: usar panel lateral moderno
  const INLINE_ORDER_UI_ENABLED = true; // Mostrar botón/modo "Ordenar" en Elementos de la plantilla
  let bulkRowCounter = 0;

  // ==========================================
  // STATE
  // ==========================================
  const state = {
    modulo: "RESUMEN",
    anio: null,
    capitulo: null,
    empresaId: null,
    layout: null,
    cuentas: [],
    operaciones: [],
    columnasConfig: null,
    columnasConfigChanged: false,
    layoutConfig: null,
    layoutConfigChanged: false,
    unsavedChanges: false,
    editMode: false,
    inlineOrderMode: false,
    columnConfigAdvanced: false,
    selectedElement: null,
    lastEditInvocation: 0,
    changeLog: [], // Registro de cambios
    autoSave: true,
  };
  window.state = state;

  // ==========================================
  // DOM ELEMENTS
  // ==========================================
  const dom = {};

  // ==========================================
  // HELPERS: EMPRESA / CAPITULO
  // ==========================================
  const normalizarTextoCapitulo = (value) =>
    (value || "")
      .toString()
      .replace(/\u0000/g, "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toUpperCase();

  const resolverEmpresaConfigKey = (value) => {
    const config = window.CapitulosModulos?.EMPRESA_CONFIG || null;
    if (!config || !value) return null;
    if (config[value]) return value;
    const match = Object.keys(config).find(
      (key) => key.toLowerCase() === String(value).toLowerCase(),
    );
    return match || null;
  };

  const esEmpresaBase = (empresaId) => {
    const match = String(empresaId || "").match(/empresa0*(\d+)/i);
    if (!match) return false;
    const numero = parseInt(match[1], 10);
    return numero >= 1 && numero <= 4;
  };

  const obtenerEmpresaIdPorCapitulo = (capitulo) => {
    const config = window.CapitulosModulos?.EMPRESA_CONFIG || null;
    if (!config || !capitulo) return null;
    const capituloNorm = normalizarTextoCapitulo(capitulo);
    let match = null;
    let matchBase = null;
    for (const [id, meta] of Object.entries(config)) {
      const cap = meta?.capitulo;
      if (!cap) continue;
      if (normalizarTextoCapitulo(cap) === capituloNorm) {
        if (!match) match = id;
        if (esEmpresaBase(id)) {
          matchBase = id;
          break;
        }
      }
    }
    return matchBase || match;
  };

  const obtenerEmpresaIdDesdeSelector = () => {
    const parentSelector = window.parent?.document?.querySelector(
      ".company-selector select",
    );
    const localSelector = document.querySelector(".company-selector select");
    const selector = parentSelector || localSelector;
    const valor = selector?.value?.trim();
    if (!valor) return null;
    return resolverEmpresaConfigKey(valor) || valor;
  };

  const resolverEmpresaIdContexto = (capitulo, preferCapitulo = false) => {
    const fromCapitulo = obtenerEmpresaIdPorCapitulo(capitulo);
    if (preferCapitulo && fromCapitulo) return fromCapitulo;

    const fromSelector = obtenerEmpresaIdDesdeSelector();
    if (fromSelector) return fromSelector;

    if (fromCapitulo) return fromCapitulo;

    const fromSesion = window.Sesion?.obtenerEmpresaActiva?.()?.id;
    return resolverEmpresaConfigKey(fromSesion) || fromSesion || "EMPRESA01";
  };

  const asegurarEmpresaIdContexto = (capitulo, preferCapitulo = false) => {
    const resolved = resolverEmpresaIdContexto(capitulo, preferCapitulo);
    if (resolved) {
      state.empresaId = resolved;
    }
    return state.empresaId;
  };

  const obtenerEmpresaIdApi = () =>
    state.empresaId || resolverEmpresaIdContexto(state.capitulo) || "EMPRESA01";

  const agregarEmpresaIdQuery = (url) => {
    const empresaId = obtenerEmpresaIdApi();
    if (!empresaId) return url;
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}empresaId=${encodeURIComponent(empresaId)}`;
  };

  // ==========================================
  // INITIALIZATION
  // ==========================================
  function readContextFromURLParams() {
    try {
      const params = new URLSearchParams(window.location.search || "");
      return {
        module: params.get("module"),
        chapter: params.get("chapter"),
        year: params.get("year"),
        empresa: params.get("empresa") || params.get("empresaId"),
      };
    } catch (_) {
      return {};
    }
  }

  function restoreContextFromSessionAndURL() {
    const urlCtx = readContextFromURLParams();
    const sesionCtx =
      typeof window.Sesion?.obtenerContextoPlaneacion === "function"
        ? window.Sesion.obtenerContextoPlaneacion()
        : {};

    const moduloPreferido = urlCtx.module || sesionCtx?.modulo;
    if (moduloPreferido && dom.moduloSelect) {
      const desiredKey = normalizeOperationMatch(moduloPreferido);
      const options = Array.from(dom.moduloSelect.options || []);
      const match = options.find(
        (opt) => normalizeOperationMatch(opt?.value || "") === desiredKey,
      );
      dom.moduloSelect.value = match ? match.value : moduloPreferido;
      state.modulo = dom.moduloSelect.value;
    } else if (dom.moduloSelect?.value) {
      state.modulo = dom.moduloSelect.value;
    }

    const yearPreferido = urlCtx.year ?? sesionCtx?.anio;
    const parsedYear = Number(yearPreferido);
    if (Number.isInteger(parsedYear)) {
      state.anio = parsedYear;
    }

    if (urlCtx.chapter) {
      state.capitulo = urlCtx.chapter;
      if (dom.capituloSelect) {
        dom.capituloSelect.value = urlCtx.chapter;
      }
    }

    if (urlCtx.empresa) {
      state.empresaId =
        resolverEmpresaConfigKey(urlCtx.empresa) || urlCtx.empresa;
    }

    updateHeaderLabels();
  }

  function updateStickyOffsets() {
    try {
      const contextBar = document.getElementById("plantillasContextBar");
      const actionBar = document.getElementById("plantillasActionBar");

      const measure = (element) => {
        if (!element) return 0;
        const rect = element.getBoundingClientRect();
        const styles = window.getComputedStyle(element);
        const marginBottom = parseFloat(styles.marginBottom || "0") || 0;
        return Math.max(0, Math.round(rect.height + marginBottom));
      };

      const contextOffset = measure(contextBar);
      const actionsOffset = measure(actionBar);

      document.documentElement.style.setProperty(
        "--plantillas-context-offset",
        `${contextOffset}px`,
      );
      document.documentElement.style.setProperty(
        "--plantillas-actions-offset",
        `${actionsOffset}px`,
      );
    } catch (error) {
      console.warn("No fue posible calcular offsets sticky", error);
    }
  }

  function init() {
    cacheDOMElements();
    restoreContextFromSessionAndURL();
    bindEventListeners();
    filtrarModulosPorCapitulo(); // Filtrar módulos al inicio
    loadInitialData();
    checkAuthState();
    setInterval(checkAuthState, 3000);
    updateStickyOffsets();
    window.addEventListener("resize", updateStickyOffsets);
    // Recalcular cuando el layout cambia (fonts/scrollbars pueden afectar altura)
    setTimeout(updateStickyOffsets, 0);
    setTimeout(updateStickyOffsets, 500);
  }

  function cacheDOMElements() {
    // Selectors
    dom.moduloSelect = document.getElementById("moduloSelect");
    dom.anioSelect = document.getElementById("anioSelect");
    dom.capituloSelect = document.getElementById("capituloSelect");

    // Labels
    dom.moduloLabel = document.getElementById("moduloLabel");
    dom.anioLabel = document.getElementById("anioLabel");
    dom.capituloLabel = document.getElementById("capituloLabel");

    // Buttons
    dom.btnCargar = document.getElementById("btnCargar");
    dom.btnGuardar = document.getElementById("btnGuardar");
    dom.btnHistorialVersiones = document.getElementById(
      "btnHistorialVersiones",
    );
    dom.btnAgregar = document.getElementById("btnAgregar");
    dom.btnCopiar = document.getElementById("btnCopiar");
    dom.btnExpandir = document.getElementById("btnExpandir");
    dom.btnColapsar = document.getElementById("btnColapsar");
    dom.btnReordenar = document.getElementById("btnReordenar");
    dom.btnPreview = document.getElementById("btnPreview");
    dom.btnVerificar = null;
    dom.btnDiagnosticar = null;
    dom.btnPredefinidas = null;
    dom.btnDemo = null;
    dom.btnPrintPreview = document.getElementById("btnPrintPreview");
    dom.btnRefreshOrder = document.getElementById("btnRefreshOrder");

    // Views
    dom.placeholderView = document.getElementById("placeholderView");
    dom.layoutView = document.getElementById("layoutView");
    dom.layoutPreview = document.getElementById("layoutPreview");
    dom.layoutOrderList = document.getElementById("layoutOrderList");
    dom.layoutOrderCount = document.getElementById("layoutOrderCount");
    dom.layoutSelectionInfo = document.getElementById("layoutSelectionInfo");

    // Stats
    // Status
    dom.authStatus = document.getElementById("authStatus");
    dom.statusMessage = document.getElementById("statusMessage");
    dom.layoutInfo = document.getElementById("layoutInfo");
    dom.searchInput = document.getElementById("searchInput");

    // Modals
    dom.modalAgregar = document.getElementById("modalAgregar");
    dom.modalCopiar = document.getElementById("modalCopiar");
    dom.modalEditar = document.getElementById("modalEditar");
    dom.modalPreview = document.getElementById("modalPreview");

    dom.formElemento = document.getElementById("formElemento");
    dom.formEditar = document.getElementById("formEditar");
    dom.copiaOrigen = document.getElementById("copiaOrigen");
    dom.anioDestino = document.getElementById("anioDestino");
    dom.copiaAlcance = document.getElementById("copiaAlcance");
    dom.previewContainer = document.getElementById("previewContainer");
    dom.bulkModeToggle = document.getElementById("bulkModeToggle");
    dom.bulkInsertPanel = document.getElementById("bulkInsertPanel");
    dom.bulkInsertTbody = document.getElementById("bulkInsertTbody");
    dom.bulkAddRowBtn = document.getElementById("bulkAddRowBtn");
    dom.singleAddPanel = document.getElementById("singleAddPanel");

    // Editor panel
    dom.operationEditorPanel = document.getElementById("operationEditorPanel");
    dom.operationEditorTitle = document.getElementById("operationEditorTitle");
    dom.operationEditorSubtitle = document.getElementById(
      "operationEditorSubtitle",
    );
    dom.editorTabDatos = document.getElementById("editorTabDatos");
    dom.editorTabFormula = document.getElementById("editorTabFormula");
    dom.editorTabAparicion = document.getElementById("editorTabAparicion");
    dom.btnEditorSave = document.getElementById("btnEditorSave");
    dom.btnEditorDelete = document.getElementById("btnEditorDelete");

    // Toast
    dom.toastNotification = document.getElementById("toastNotification");
    dom.toastMessage = document.getElementById("toastMessage");

    // Consolidación CDMX -> Presupuestos
    dom.cdmxPresupuestoConsolidacionRow = document.getElementById(
      "cdmxPresupuestoConsolidacionRow",
    );
    dom.cdmxPresupuestoConsolidacionTbody = document.getElementById(
      "cdmxPresupuestoConsolidacionTbody",
    );
    dom.cdmxPresupuestoConsolidacionStatus = document.getElementById(
      "cdmxPresupuestoConsolidacionStatus",
    );
    dom.cdmxPresupuestoConsolidacionEnabled = document.getElementById(
      "cdmxPresupuestoConsolidacionEnabled",
    );
    dom.cdmxPresupuestoConsolidacionReset = document.getElementById(
      "cdmxPresupuestoConsolidacionReset",
    );
    dom.cdmxPresupuestoConsolidacionApply = document.getElementById(
      "cdmxPresupuestoConsolidacionApply",
    );
    dom.cdmxPresupuestoConsolidacionAutoEnabled = document.getElementById(
      "cdmxPresupuestoConsolidacionAutoEnabled",
    );
    dom.cdmxPresupuestoConsolidacionAutoMinutes = document.getElementById(
      "cdmxPresupuestoConsolidacionAutoMinutes",
    );
  }

  // Prevenir event listeners duplicados
  let listenersAttached = false;

  function bindEventListeners() {
    // Si ya se añadieron los listeners, no hacerlo de nuevo
    if (listenersAttached) return;
    listenersAttached = true;

    // Selectors
    dom.moduloSelect.addEventListener("change", handleModuloChange);
    dom.anioSelect.addEventListener("change", handleAnioChange);
    dom.capituloSelect.addEventListener("change", handleCapituloChange);

    // Buttons
    dom.btnCargar.addEventListener("click", loadLayout);
    dom.btnGuardar.addEventListener("click", saveLayout);
    dom.btnHistorialVersiones?.addEventListener(
      "click",
      openVersionHistoryModal,
    );
    dom.btnAgregar.addEventListener("click", openAddModal);
    dom.btnCopiar.addEventListener("click", openCopyModal);
    dom.btnExpandir?.addEventListener("click", expandAll);
    dom.btnColapsar?.addEventListener("click", collapseAll);
    dom.btnPreview?.addEventListener("click", showPreview);
    dom.btnPrintPreview?.addEventListener("click", () => window.print());
    dom.btnRefreshOrder?.addEventListener("click", updateLayoutOrderPanel);

    // Consolidación CDMX -> Presupuestos
    dom.cdmxPresupuestoConsolidacionReset?.addEventListener(
      "click",
      handleCdmxPresupuestoConsolidacionReset,
    );
    dom.cdmxPresupuestoConsolidacionApply?.addEventListener(
      "click",
      handleCdmxPresupuestoConsolidacionApply,
    );
    dom.cdmxPresupuestoConsolidacionEnabled?.addEventListener(
      "change",
      handleCdmxPresupuestoConsolidacionEnabledChange,
    );
    dom.cdmxPresupuestoConsolidacionAutoEnabled?.addEventListener(
      "change",
      handleCdmxPresupuestoConsolidacionAutoEnabledChange,
    );
    dom.cdmxPresupuestoConsolidacionAutoMinutes?.addEventListener(
      "change",
      handleCdmxPresupuestoConsolidacionAutoMinutesChange,
    );
    dom.cdmxPresupuestoConsolidacionTbody?.addEventListener(
      "change",
      handleCdmxPresupuestoConsolidacionRowChange,
    );

    // Importación/Exportación masiva
    const btnDescargarPlantilla = document.getElementById(
      "btnDescargarPlantilla",
    );
    const btnImportarExcel = document.getElementById("btnImportarExcel");
    const fileImportInput = document.getElementById("fileImportInput");

    if (btnDescargarPlantilla) {
      btnDescargarPlantilla.addEventListener(
        "click",
        descargarPlantillaImportacion,
      );
    }
    if (btnImportarExcel && fileImportInput) {
      btnImportarExcel.addEventListener("click", () => fileImportInput.click());
      fileImportInput.addEventListener("change", importarDesdeArchivo);
    }

    // Search
    dom.searchInput?.addEventListener("input", handleSearch);

    // Quick filters
    document.querySelectorAll('input[name="quickFilter"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        const currentQuery = dom.searchInput?.value || "";
        applySearchAndFilters(currentQuery.toLowerCase().trim());
      });
    });

    // Modal buttons
    document
      .getElementById("btnConfirmarAgregar")
      ?.addEventListener("click", confirmAdd);
    document
      .getElementById("btnConfirmarCopia")
      ?.addEventListener("click", confirmCopy);
    document
      .getElementById("btnConfirmarEditar")
      ?.addEventListener("click", confirmEdit);
    document
      .getElementById("btnEliminar")
      ?.addEventListener("click", deleteElement);

    dom.btnEditorSave?.addEventListener("click", () => {
      if (state.selectedElement?.type === "operation") {
        saveOperationFromPanel();
      } else {
        confirmEdit();
      }
    });
    dom.btnEditorDelete?.addEventListener("click", () => {
      if (state.selectedElement?.type === "operation") {
        const op = state.selectedElement.op;
        if (op) {
          const opId = getOperationId(op) || getOperationLabel(op);
          if (opId) window.deleteOperation(opId);
        }
      } else {
        deleteElement();
      }
    });

    // Element type selector
    document.querySelectorAll('input[name="tipoElemento"]').forEach((radio) => {
      radio.addEventListener("change", updateAddForm);
    });

    dom.copiaAlcance?.addEventListener("change", updateCopyModalLabels);

    dom.bulkModeToggle?.addEventListener("change", () => {
      setBulkMode(Boolean(dom.bulkModeToggle?.checked));
    });
    dom.bulkAddRowBtn?.addEventListener("click", () => {
      appendBulkRow();
    });
    dom.bulkInsertTbody?.addEventListener("click", handleBulkTableClick);
    dom.bulkInsertTbody?.addEventListener("keydown", handleBulkTableKeydown);
    dom.bulkInsertTbody?.addEventListener("change", handleBulkTableChange);

    // Fallback: si el onclick inline no dispara, forzar edición desde el DOM
    document.addEventListener("click", (event) => {
      const btn = event.target?.closest?.("button");
      if (!btn) return;
      const container = btn.closest(
        ".operation-card, .operation-row, .inline-operation-row, .list-item.item-operation",
      );
      if (!container) return;
      if (!btn.querySelector(".bi-pencil")) return;
      const opId =
        container.dataset.operationId || container.dataset.operationLabel || "";
      if (!opId) return;
      const last = state.lastEditInvocation || 0;
      setTimeout(() => {
        if (state.lastEditInvocation === last) {
          window.editOperation?.(opId);
        }
      }, 0);
    });
  }

  // ==========================================
  // FILTRAR MÓDULOS POR CAPÍTULO
  // ==========================================
  /**
   * Filtra las opciones del selector de módulos basándose en el capítulo seleccionado.
   * Oculta los módulos que no están disponibles para el capítulo actual.
   */
  function filtrarModulosPorCapitulo() {
    if (!dom.moduloSelect) return;

    // Obtener capítulo actual del selector
    const capituloActual = dom.capituloSelect?.value;
    if (!capituloActual) return;

    const empresaId = asegurarEmpresaIdContexto(capituloActual, true);

    if (!empresaId) {
      console.warn(
        `[Plantillas] No se encontró empresaId para el capítulo: ${capituloActual}`,
      );
      return;
    }

    console.log(
      `[Plantillas] Filtrando módulos para empresa: ${empresaId}, capítulo: ${capituloActual}`,
    );

    // Mapeo de valores de opción a IDs de módulo (normalizados)
    const moduloMapping = {
      RESUMEN: "resumen",
      SUMMARY: "resumen",
      Finanzas: "finanzas",
      "Gastos Generales": "gastosgenerales",
      Nomina: "nomina",
      Nómina: "nomina",
      Membresía: "membresia",
      "Serv Membresía": "serv-membresia",
      RH: "rh",
      Eventos: "eventos",
      Comités: "comites",
      Comunicación: "comunicacion",
      Dirección: "direccion",
      "Gtos Corporativos": "gtos-corporativos",
      "T&IC": "tic",
      VPE: "vpe",
    };

    // Filtrar opciones del select
    const options = Array.from(dom.moduloSelect.options);
    const valorActual = dom.moduloSelect.value;
    let valorActualDisponible = false;

    options.forEach((option) => {
      const valorOption = option.value;
      const moduloId = moduloMapping[valorOption];

      if (!moduloId) {
        // Si no está en el mapeo, dejar visible (ej: opciones especiales)
        option.style.display = "";
        option.disabled = false;
        return;
      }

      // Verificar si el módulo está disponible para esta empresa
      const disponible = window.CapitulosModulos.moduloDisponible(
        empresaId,
        moduloId,
      );

      if (disponible) {
        option.style.display = "";
        option.disabled = false;
        if (valorOption === valorActual) {
          valorActualDisponible = true;
        }
      } else {
        option.style.display = "none";
        option.disabled = true;
      }
    });

    // Si el valor actualmente seleccionado no está disponible, seleccionar el primero disponible
    if (!valorActualDisponible && options.length > 0) {
      for (const option of options) {
        if (!option.disabled && option.style.display !== "none") {
          dom.moduloSelect.value = option.value;
          console.log(
            `[Plantillas] Módulo seleccionado cambiado a: ${option.value}`,
          );
          break;
        }
      }
    }
  }

  // ==========================================
  // AUTH STATE
  // ==========================================
  function getAuthHeaders() {
    if (window.Sesion?.headersAutenticacion) {
      return window.Sesion.headersAutenticacion();
    }
    return {};
  }

  async function checkAuthState() {
    if (FORCE_EDIT_MODE) {
      state.editMode = true;
      state.esAdminGlobal = true;
      updateAuthUI(true, "Edición forzada (local)");
      updateButtonStates();
      return;
    }
    const sesion = window.Sesion?.obtener?.() || null;
    const esAdminGlobal = window.Sesion?.esAdminGlobal?.() || false;
    const usuarioId = window.Sesion?.obtenerUsuarioId?.();
    const token = sesion?.tokenAcceso || window.Sesion?.token;

    const allowLocalOverride =
      window.location.protocol === "file:" ||
      ["localhost", "127.0.0.1"].includes(window.location.hostname);

    if (!token || !sesion) {
      if (allowLocalOverride) {
        state.editMode = true;
        state.esAdminGlobal = true;
        updateAuthUI(true, "Edición local habilitada");
      } else {
        updateAuthUI(false, "Sesión no válida");
        return;
      }
      updateButtonStates();
      return;
    }

    if (esAdminGlobal) {
      state.editMode = true;
      state.esAdminGlobal = true;
      updateAuthUI(true, "Administrador Global - Edición disponible");
    } else {
      // Si no es admin global, verificar si tiene algún permiso de capítulo
      const { capitulo } = state;
      if (capitulo) {
        // Optimización: Solo verificar si cambió el capítulo o el usuario
        const tienePermiso = await verificarPermisoCapitulo(
          usuarioId,
          capitulo,
        );
        state.editMode = tienePermiso;
        state.esAdminGlobal = false;
        updateAuthUI(
          tienePermiso,
          tienePermiso
            ? `Editor de ${capitulo} - Edición activa`
            : "Consulta - solicita permiso de edición en administración de usuarios",
        );
      } else {
        state.editMode = false;
        updateAuthUI(false, "Selecciona un capítulo");
      }
    }

    if (!state.editMode && allowLocalOverride) {
      state.editMode = true;
      state.esAdminGlobal = true;
      updateAuthUI(true, "Edición local habilitada");
    }

    updateButtonStates();
  }

  // Caché simple para no saturar la API
  const permisosCache = new Map();
  async function verificarPermisoCapitulo(usuarioId, capitulo) {
    if (!usuarioId || !capitulo) return false;
    const cacheKey = `${usuarioId}:${capitulo}`;

    // Si ya lo pedimos hace menos de 30 segundos, usar cache
    const cached = permisosCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < 30000) {
      return cached.permiso;
    }

    try {
      // Reutilizamos el endpoint de años o capítulos para no crear uno nuevo si es posible,
      // o simplemente intentamos cargar el layout. Si el servidor devuelve 403 al guardar,
      // ahí es donde realmente importa. Pero para UI:
      const response = await fetch(`${API_BASE}/permisos/capitulos`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return false;
      const data = await response.json();
      const miPermiso = data.permisos?.find(
        (p) => p.usuario_id === usuarioId && p.capitulo === capitulo,
      );
      const tiene = miPermiso ? miPermiso.puede_editar === 1 : false;

      permisosCache.set(cacheKey, { permiso: tiene, ts: Date.now() });
      return tiene;
    } catch (err) {
      return false;
    }
  }

  function updateAuthUI(isActive, statusText) {
    if (!dom.authStatus) return;

    dom.authStatus.className = `status-badge ${isActive ? "active" : "inactive"
      }`;
    dom.authStatus.innerHTML = `
      <i class="bi bi-${isActive ? "pencil-square" : "lock"}"></i>
      ${statusText}
    `;
  }

  function updateButtonStates() {
    const hasLayout = state.layout !== null;
    const canEdit = state.editMode && hasLayout;

    dom.btnGuardar.disabled = !canEdit || !state.unsavedChanges;
    if (dom.btnHistorialVersiones) {
      dom.btnHistorialVersiones.disabled = !canEdit;
    }
    dom.btnAgregar.disabled = !canEdit;
    dom.btnCopiar.disabled = !state.editMode || !hasLayout;

    // Expandir/Colapsar disponibles cuando hay layout cargado
    if (dom.btnExpandir) dom.btnExpandir.disabled = !hasLayout;
    if (dom.btnColapsar) dom.btnColapsar.disabled = !hasLayout;
    if (dom.btnReordenar) dom.btnReordenar.disabled = !canEdit;
    if (dom.btnPreview) dom.btnPreview.disabled = !hasLayout;
  }

  function requireEditMode() {
    if (FORCE_EDIT_MODE) return true;
    if (state.editMode) return true;
    showToast("Modo solo lectura. Solicita permisos de edicion.", "warning");
    return false;
  }

  // ==========================================
  // CDMX -> PRESUPUESTOS (CONSOLIDACIÓN)
  // ==========================================
  const CDMX_PRESUPUESTO_CONSOLIDACION_KEY = "cdmxPresupuestoConsolidacion";
  const CDMX_PRESUPUESTO_CONSOLIDACION_CUENTAS_ORDEN = [
    "450-001-000-00",
    "950-001-000-00",
    "450-002-000-00",
    "950-002-000-00",
    "450-003-000-00",
    "950-003-000-00",
  ];
  const CDMX_PRESUPUESTO_CONSOLIDACION_DEFAULT = Object.freeze({
    enabled: true,
    autoApply: {
      enabled: false,
      intervalMinutes: 10,
    },
    cuentas: {
      "450-001-000-00": { capitulo: "GUADALAJARA", fila: "INCOME" },
      "950-001-000-00": { capitulo: "GUADALAJARA", fila: "EXPENSE" },
      "450-002-000-00": { capitulo: "NORESTE", fila: "INCOME" },
      "950-002-000-00": { capitulo: "NORESTE", fila: "EXPENSE" },
      "450-003-000-00": { capitulo: "NOROESTE", fila: "INCOME" },
      "950-003-000-00": { capitulo: "NOROESTE", fila: "EXPENSE" },
    },
  });
  const CDMX_PRESUPUESTO_CONSOLIDACION_CAPITULOS = [
    "GUADALAJARA",
    "NORESTE",
    "NOROESTE",
  ];
  const CDMX_PRESUPUESTO_CONSOLIDACION_TIPO_A_FILA = Object.freeze({
    income: "INCOME",
    expense: "EXPENSE",
  });
  const MESES_CORTOS = [
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
  let cdmxConsolidacionAplicando = false;
  let cdmxConsolidacionAutoApplyTimer = null;
  let cdmxConsolidacionAutoApplySignature = "";
  let cdmxConsolidacionAutoLastErrorToastAt = 0;
  const CDMX_CONSOLIDACION_AUTO_MINUTES_MIN = 1;
  const CDMX_CONSOLIDACION_AUTO_MINUTES_MAX = 720;
  const CDMX_CONSOLIDACION_AUTO_ERROR_TOAST_COOLDOWN_MS = 15 * 60 * 1000;

  function esContextoCdmxResumen() {
    const modulo = normalizarTextoCapitulo(state.modulo);
    const capitulo = normalizarTextoCapitulo(state.capitulo);
    return modulo === "RESUMEN" && capitulo === "CIUDAD DE MEXICO";
  }

  function puedeEditarCdmxPresupuestoConsolidacion() {
    const hasLayout = state.layout !== null;
    return (FORCE_EDIT_MODE || state.editMode) && hasLayout;
  }

  function normalizarCdmxAutoApplyMinutes(value) {
    const fallback = Number(
      CDMX_PRESUPUESTO_CONSOLIDACION_DEFAULT?.autoApply?.intervalMinutes || 10,
    );
    const parsed = Number(value);
    const minutes = Number.isFinite(parsed) ? Math.round(parsed) : fallback;
    return Math.min(
      CDMX_CONSOLIDACION_AUTO_MINUTES_MAX,
      Math.max(CDMX_CONSOLIDACION_AUTO_MINUTES_MIN, minutes),
    );
  }

  function resolverFilaCdmxConsolidacion(regla, cuenta = "") {
    const raw = (regla?.fila || regla?.filaResumen || regla?.row || "")
      .toString()
      .trim();
    if (raw) return raw;
    const tipoLegacy = (regla?.tipo || "").toString().trim().toLowerCase();
    if (tipoLegacy === "expense") {
      return CDMX_PRESUPUESTO_CONSOLIDACION_TIPO_A_FILA.expense;
    }
    if (tipoLegacy === "income") {
      return CDMX_PRESUPUESTO_CONSOLIDACION_TIPO_A_FILA.income;
    }
    return cuenta.toString().trim().startsWith("950") ? "EXPENSE" : "INCOME";
  }

  function buildDefaultCdmxPresupuestoConsolidacion() {
    return {
      enabled: true,
      autoApply: { ...CDMX_PRESUPUESTO_CONSOLIDACION_DEFAULT.autoApply },
      cuentas: CDMX_PRESUPUESTO_CONSOLIDACION_CUENTAS_ORDEN.reduce(
        (acc, cuenta) => {
          const cfg = CDMX_PRESUPUESTO_CONSOLIDACION_DEFAULT.cuentas[cuenta];
          if (cfg) acc[cuenta] = { ...cfg };
          return acc;
        },
        {},
      ),
    };
  }

  function obtenerCdmxPresupuestoConsolidacionConfig() {
    const raw =
      state.layoutConfig && typeof state.layoutConfig === "object"
        ? state.layoutConfig[CDMX_PRESUPUESTO_CONSOLIDACION_KEY]
        : null;
    if (raw && typeof raw === "object") {
      const enabled = raw.enabled !== false;
      const cuentas = raw.cuentas && typeof raw.cuentas === "object" ? raw.cuentas : {};
      const autoApplyRaw =
        raw.autoApply && typeof raw.autoApply === "object" ? raw.autoApply : null;
      const autoApply = {
        enabled: autoApplyRaw?.enabled === true,
        intervalMinutes: normalizarCdmxAutoApplyMinutes(
          autoApplyRaw?.intervalMinutes,
        ),
      };
      return {
        config: {
          enabled,
          autoApply,
          cuentas,
        },
        fromDefault: false,
      };
    }
    return { config: buildDefaultCdmxPresupuestoConsolidacion(), fromDefault: true };
  }

  function asegurarCdmxPresupuestoConsolidacionConfigEditable() {
    if (!state.layoutConfig || typeof state.layoutConfig !== "object") {
      state.layoutConfig = { subseccionesOcultas: [] };
    }
    const current =
      state.layoutConfig[CDMX_PRESUPUESTO_CONSOLIDACION_KEY] &&
        typeof state.layoutConfig[CDMX_PRESUPUESTO_CONSOLIDACION_KEY] === "object"
        ? state.layoutConfig[CDMX_PRESUPUESTO_CONSOLIDACION_KEY]
        : null;
    if (current) return current;
    const created = buildDefaultCdmxPresupuestoConsolidacion();
    state.layoutConfig[CDMX_PRESUPUESTO_CONSOLIDACION_KEY] = created;
    return created;
  }

  function setCdmxPresupuestoConsolidacionStatus(message) {
    if (!dom.cdmxPresupuestoConsolidacionStatus) return;
    dom.cdmxPresupuestoConsolidacionStatus.textContent = message || "";
  }

  function stopCdmxPresupuestoConsolidacionAutoApplyTimer() {
    if (cdmxConsolidacionAutoApplyTimer) {
      clearInterval(cdmxConsolidacionAutoApplyTimer);
    }
    cdmxConsolidacionAutoApplyTimer = null;
    cdmxConsolidacionAutoApplySignature = "";
  }

  function tickCdmxPresupuestoConsolidacionAutoApply() {
    if (!esContextoCdmxResumen()) return;
    const anio = Number(state.anio);
    if (!Number.isInteger(anio)) return;

    const { config } = obtenerCdmxPresupuestoConsolidacionConfig();
    if (config.enabled === false) return;
    if (config.autoApply?.enabled !== true) return;

    handleCdmxPresupuestoConsolidacionApply({ source: "auto" }).catch(() => {
      // Los errores UI se manejan dentro del handler; evitar warnings por promesas
    });
  }

  function syncCdmxPresupuestoConsolidacionAutoApplyTimer() {
    const { config } = obtenerCdmxPresupuestoConsolidacionConfig();
    const anio = Number(state.anio);
    const intervaloMinutos = normalizarCdmxAutoApplyMinutes(
      config.autoApply?.intervalMinutes,
    );
    const shouldRun = Boolean(
      esContextoCdmxResumen() &&
        Number.isInteger(anio) &&
        config.enabled !== false &&
        config.autoApply?.enabled === true,
    );

    const signature = `${shouldRun ? "1" : "0"}:${intervaloMinutos}:${String(state.anio || "")}`;
    if (signature === cdmxConsolidacionAutoApplySignature) return;
    cdmxConsolidacionAutoApplySignature = signature;

    if (cdmxConsolidacionAutoApplyTimer) {
      clearInterval(cdmxConsolidacionAutoApplyTimer);
      cdmxConsolidacionAutoApplyTimer = null;
    }
    if (!shouldRun) return;

    const intervaloMs = intervaloMinutos * 60 * 1000;
    cdmxConsolidacionAutoApplyTimer = setInterval(() => {
      tickCdmxPresupuestoConsolidacionAutoApply();
    }, intervaloMs);

    // Primera ejecución ligera (si aplica), para no esperar al primer intervalo completo
    setTimeout(() => {
      tickCdmxPresupuestoConsolidacionAutoApply();
    }, 1500);
  }

  function renderCdmxPresupuestoConsolidacionPanel() {
    const container = dom.cdmxPresupuestoConsolidacionRow;
    if (!container) return;

    const shouldShow = esContextoCdmxResumen() && state.anio;
    if (!shouldShow) {
      container.classList.add("d-none");
      syncCdmxPresupuestoConsolidacionAutoApplyTimer();
      return;
    }
    container.classList.remove("d-none");

    const { config, fromDefault } = obtenerCdmxPresupuestoConsolidacionConfig();
    const canEdit = puedeEditarCdmxPresupuestoConsolidacion();
    const isEnabled = config.enabled !== false;
    const autoApplyEnabled = config.autoApply?.enabled === true;
    const autoApplyMinutes = normalizarCdmxAutoApplyMinutes(
      config.autoApply?.intervalMinutes,
    );

    if (dom.cdmxPresupuestoConsolidacionEnabled) {
      dom.cdmxPresupuestoConsolidacionEnabled.checked = config.enabled !== false;
      dom.cdmxPresupuestoConsolidacionEnabled.disabled = !canEdit;
    }
    if (dom.cdmxPresupuestoConsolidacionAutoEnabled) {
      dom.cdmxPresupuestoConsolidacionAutoEnabled.checked = autoApplyEnabled;
      dom.cdmxPresupuestoConsolidacionAutoEnabled.disabled = !canEdit;
    }
    if (dom.cdmxPresupuestoConsolidacionAutoMinutes) {
      if (document.activeElement !== dom.cdmxPresupuestoConsolidacionAutoMinutes) {
        dom.cdmxPresupuestoConsolidacionAutoMinutes.value = String(autoApplyMinutes);
      }
      dom.cdmxPresupuestoConsolidacionAutoMinutes.disabled = !canEdit;
    }
    if (dom.cdmxPresupuestoConsolidacionReset) {
      dom.cdmxPresupuestoConsolidacionReset.disabled = !canEdit;
    }
    if (dom.cdmxPresupuestoConsolidacionApply) {
      dom.cdmxPresupuestoConsolidacionApply.disabled =
        cdmxConsolidacionAplicando || !state.anio || !isEnabled;
    }

    const capitulos = [
      ...new Set([
        ...CDMX_PRESUPUESTO_CONSOLIDACION_CAPITULOS,
        ...Object.values(config.cuentas || {})
          .map((c) => normalizarTextoCapitulo(c?.capitulo))
          .filter(Boolean),
      ]),
    ].sort();

    // Precargar filas disponibles del RESUMEN por capítulo (para poblar dropdown)
    try {
      if (state.anio) {
        capitulos.forEach((cap) => {
          ensureCdmxConsolidacionFilasResumenLoaded({
            capitulo: cap,
            anio: Number(state.anio),
          }).catch(() => {
            // El error se refleja en el cache/selector; evitar toasts en render
          });
        });
      }
    } catch (_) {
      // ignore
    }

    const tbody = dom.cdmxPresupuestoConsolidacionTbody;
    if (tbody) {
      tbody.innerHTML = CDMX_PRESUPUESTO_CONSOLIDACION_CUENTAS_ORDEN.map(
        (cuenta) => {
          const cfg = (config.cuentas || {})[cuenta] || {};
          const capitulo = normalizarTextoCapitulo(cfg.capitulo) || "";
          const fila = resolverFilaCdmxConsolidacion(cfg, cuenta);
          const disabledAttr = canEdit ? "" : "disabled";
          const filaDisabledAttr = canEdit && capitulo ? "" : "disabled";
          const filaEstado = capitulo
            ? getCdmxConsolidacionFilasResumenState({
              capitulo,
              anio: Number(state.anio),
            })
            : null;
          const filasDisponibles = Array.isArray(filaEstado?.rows)
            ? filaEstado.rows
            : [];
          const filaLoading = Boolean(filaEstado?.loading);
          const filaError = filaEstado?.error || null;
          const filaNorm = normalizarEtiquetaResumen(fila);
          const filaExiste = filasDisponibles.some(
            (opt) => normalizarEtiquetaResumen(opt) === filaNorm,
          );

          const capituloOptions = [
            `<option value="" ${capitulo ? "" : "selected"}>-</option>`,
            ...capitulos.map((opt) => {
              const selected =
                normalizarTextoCapitulo(opt) === normalizarTextoCapitulo(capitulo)
                  ? "selected"
                  : "";
              return `<option value="${escapeAttr(opt)}" ${selected}>${escapeHtml(
                opt,
              )}</option>`;
            }),
          ].join("");

          const filaOptions = (() => {
            const selectedValue = (fila || "").toString().trim();
            const parts = [];
            parts.push(
              `<option value="" ${selectedValue ? "" : "selected"}>-</option>`,
            );
            if (!capitulo) {
              return parts.join("");
            }
            if (filaLoading) {
              parts.push(
                `<option value="" disabled selected>Cargando filas...</option>`,
              );
              return parts.join("");
            }
            if (filaError) {
              parts.push(
                `<option value="" disabled selected>Error cargando filas</option>`,
              );
              return parts.join("");
            }
            if (selectedValue && !filaExiste) {
              parts.push(
                `<option value="${escapeAttr(selectedValue)}" selected>${escapeHtml(
                  selectedValue,
                )} (no encontrada)</option>`,
              );
            }
            filasDisponibles.forEach((opt) => {
              const value = (opt || "").toString();
              const selected =
                normalizarEtiquetaResumen(value) === filaNorm ? "selected" : "";
              parts.push(
                `<option value="${escapeAttr(value)}" ${selected}>${escapeHtml(
                  value,
                )}</option>`,
              );
            });
            return parts.join("");
          })();

          const detalleFila = fila
            ? `${fila} · Ppto (mes)`
            : "Sin fila (RESUMEN)";

          return `
            <tr data-cuenta="${escapeAttr(cuenta)}">
              <td><code>${escapeHtml(cuenta)}</code></td>
              <td>
                <select class="form-select form-select-sm" data-field="capitulo" ${disabledAttr}>
                  ${capituloOptions}
                </select>
              </td>
              <td>
                <select class="form-select form-select-sm" data-field="fila" ${filaDisabledAttr}>
                  ${filaOptions}
                </select>
              </td>
              <td class="small text-muted">${escapeHtml(capitulo || "-")} · ${escapeHtml(detalleFila)}</td>
            </tr>
          `;
        },
      ).join("");
    }

    if (!canEdit) {
      setCdmxPresupuestoConsolidacionStatus(
        "Modo solo lectura: activa permisos de edición para cambiar la consolidación.",
      );
      syncCdmxPresupuestoConsolidacionAutoApplyTimer();
      return;
    }

    if (!isEnabled) {
      setCdmxPresupuestoConsolidacionStatus(
        "Consolidación deshabilitada. Activa el switch para poder aplicar.",
      );
      syncCdmxPresupuestoConsolidacionAutoApplyTimer();
      return;
    }

    if (cdmxConsolidacionAplicando) {
      setCdmxPresupuestoConsolidacionStatus("Aplicando consolidación...");
      syncCdmxPresupuestoConsolidacionAutoApplyTimer();
      return;
    }

    if (fromDefault) {
      setCdmxPresupuestoConsolidacionStatus(
        "Usando defaults. Guarda la plantilla para persistir cambios.",
      );
      syncCdmxPresupuestoConsolidacionAutoApplyTimer();
      return;
    }

    if (state.unsavedChanges) {
      setCdmxPresupuestoConsolidacionStatus(
        "Cambios pendientes: presiona Guardar para persistir la configuración.",
      );
      syncCdmxPresupuestoConsolidacionAutoApplyTimer();
      return;
    }

    setCdmxPresupuestoConsolidacionStatus("Listo.");
    syncCdmxPresupuestoConsolidacionAutoApplyTimer();
  }

  function handleCdmxPresupuestoConsolidacionEnabledChange(event) {
    if (!esContextoCdmxResumen()) return;
    const checkbox = event?.target;
    if (!checkbox) return;

    if (!puedeEditarCdmxPresupuestoConsolidacion() || !requireEditMode()) {
      renderCdmxPresupuestoConsolidacionPanel();
      return;
    }

    const cfg = asegurarCdmxPresupuestoConsolidacionConfigEditable();
    cfg.enabled = Boolean(checkbox.checked);
    state.layoutConfigChanged = true;
    state.unsavedChanges = true;
    updateButtonStates();
    renderCdmxPresupuestoConsolidacionPanel();
  }

  function handleCdmxPresupuestoConsolidacionAutoEnabledChange(event) {
    if (!esContextoCdmxResumen()) return;
    const checkbox = event?.target;
    if (!checkbox) return;

    if (!puedeEditarCdmxPresupuestoConsolidacion() || !requireEditMode()) {
      renderCdmxPresupuestoConsolidacionPanel();
      return;
    }

    const cfg = asegurarCdmxPresupuestoConsolidacionConfigEditable();
    if (!cfg.autoApply || typeof cfg.autoApply !== "object") {
      cfg.autoApply = { ...CDMX_PRESUPUESTO_CONSOLIDACION_DEFAULT.autoApply };
    }
    cfg.autoApply.enabled = Boolean(checkbox.checked);
    cfg.autoApply.intervalMinutes = normalizarCdmxAutoApplyMinutes(
      cfg.autoApply.intervalMinutes,
    );

    state.layoutConfigChanged = true;
    state.unsavedChanges = true;
    updateButtonStates();
    renderCdmxPresupuestoConsolidacionPanel();
  }

  function handleCdmxPresupuestoConsolidacionAutoMinutesChange(event) {
    if (!esContextoCdmxResumen()) return;
    const input = event?.target;
    if (!input) return;

    if (!puedeEditarCdmxPresupuestoConsolidacion() || !requireEditMode()) {
      renderCdmxPresupuestoConsolidacionPanel();
      return;
    }

    const minutes = normalizarCdmxAutoApplyMinutes(input.value);
    const cfg = asegurarCdmxPresupuestoConsolidacionConfigEditable();
    if (!cfg.autoApply || typeof cfg.autoApply !== "object") {
      cfg.autoApply = { ...CDMX_PRESUPUESTO_CONSOLIDACION_DEFAULT.autoApply };
    }
    cfg.autoApply.intervalMinutes = minutes;

    state.layoutConfigChanged = true;
    state.unsavedChanges = true;
    updateButtonStates();
    renderCdmxPresupuestoConsolidacionPanel();
  }

  function handleCdmxPresupuestoConsolidacionRowChange(event) {
    if (!esContextoCdmxResumen()) return;
    const element = event?.target;
    if (!element || (element.tagName !== "SELECT" && element.tagName !== "INPUT")) {
      return;
    }

    const row = element.closest("tr");
    const cuenta = row?.dataset?.cuenta || "";
    const field = element.dataset.field || "";
    if (!cuenta || (field !== "capitulo" && field !== "fila")) return;

    if (!puedeEditarCdmxPresupuestoConsolidacion() || !requireEditMode()) {
      renderCdmxPresupuestoConsolidacionPanel();
      return;
    }

    const cfg = asegurarCdmxPresupuestoConsolidacionConfigEditable();
    if (!cfg.cuentas || typeof cfg.cuentas !== "object") cfg.cuentas = {};
    if (!cfg.cuentas[cuenta] || typeof cfg.cuentas[cuenta] !== "object") {
      cfg.cuentas[cuenta] = {
        capitulo: "",
        fila: resolverFilaCdmxConsolidacion({}, cuenta),
      };
    }

    if (field === "capitulo") {
      cfg.cuentas[cuenta].capitulo = element.value;
    } else if (field === "fila") {
      cfg.cuentas[cuenta].fila = element.value;
    }

    state.layoutConfigChanged = true;
    state.unsavedChanges = true;
    updateButtonStates();
    renderCdmxPresupuestoConsolidacionPanel();
  }

  function handleCdmxPresupuestoConsolidacionReset() {
    if (!esContextoCdmxResumen()) return;
    if (!puedeEditarCdmxPresupuestoConsolidacion() || !requireEditMode()) return;

    const cfg = asegurarCdmxPresupuestoConsolidacionConfigEditable();
    const defaults = buildDefaultCdmxPresupuestoConsolidacion();
    cfg.enabled = defaults.enabled;
    cfg.autoApply = defaults.autoApply;
    cfg.cuentas = defaults.cuentas;

    state.layoutConfigChanged = true;
    state.unsavedChanges = true;
    updateButtonStates();
    renderCdmxPresupuestoConsolidacionPanel();
    showToast("Defaults restaurados (pendiente de guardar)", "info");
  }

  const CDMX_CONSOLIDACION_RESUMEN_CONCURRENCY = 4;
  const CDMX_CONSOLIDACION_INGRESO_LABELS = ["INCOME", "INGRESO", "INGRESOS"];
  const CDMX_CONSOLIDACION_GASTO_LABELS = [
    "EXPENSE",
    "EXPENSES",
    "GASTO",
    "GASTOS",
    "EGRESO",
    "EGRESOS",
  ];
  const CDMX_CONSOLIDACION_LAYOUT_TIPO_PRIORITY = Object.freeze({
    final: 0,
    net: 1,
    result: 2,
    group: 3,
    principal: 4,
    secundaria: 5,
    operation: 6,
    cuenta: 7,
  });
  const CDMX_CONSOLIDACION_LAYOUT_TIPO_PRIORITY_DEFAULT = 99;
  const cdmxResumenMensualCache = new Map();
  const cdmxFilasResumenCache = new Map();
  const cdmxTotalesCapituloCache = new Map();
  let cdmxFilasResumenRenderScheduled = false;

  const numeroSeguroCdmxConsolidacion = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const normalizarEtiquetaResumen = (value) =>
    normalizarTextoCapitulo(value).replace(/\s+/g, " ");

  const obtenerEmpresaNumero = (empresaId) => {
    const match = String(empresaId || "").match(/empresa0*(\d+)/i);
    if (!match) return null;
    const numero = parseInt(match[1], 10);
    return Number.isFinite(numero) ? numero : null;
  };

  const esEmpresaComparativa = (empresaId) => {
    const numero = obtenerEmpresaNumero(empresaId);
    return Number.isInteger(numero) && numero >= 9 && numero <= 12;
  };

  const canonicalizarEmpresaId = (empresaId) => {
    if (!empresaId) return empresaId;
    const numero = obtenerEmpresaNumero(empresaId);
    if (!Number.isInteger(numero)) return empresaId;
    const candidato = `empresa${numero}`;
    return resolverEmpresaConfigKey(candidato) || resolverEmpresaConfigKey(empresaId) || candidato;
  };

  const obtenerEmpresaIdDestinoConsolidacion = () =>
    canonicalizarEmpresaId(obtenerEmpresaIdApi());

  const obtenerEmpresaIdPorCapituloEnGrupo = (capitulo, empresaReferencia) => {
    const config = window.CapitulosModulos?.EMPRESA_CONFIG || null;
    if (!config || !capitulo) return obtenerEmpresaIdPorCapitulo(capitulo);
    const capituloNorm = normalizarTextoCapitulo(capitulo);
    const matches = [];
    for (const [id, meta] of Object.entries(config)) {
      const cap = meta?.capitulo;
      if (!cap) continue;
      if (normalizarTextoCapitulo(cap) === capituloNorm) {
        matches.push(id);
      }
    }
    if (!matches.length) return null;

    const refCanon = canonicalizarEmpresaId(empresaReferencia);
    const preferBase = esEmpresaBase(refCanon);
    const preferComparativa = esEmpresaComparativa(refCanon);

    if (preferBase) {
      const baseMatch = matches.find((id) => esEmpresaBase(id));
      if (baseMatch) return baseMatch;
    }
    if (preferComparativa) {
      const compMatch = matches.find((id) => esEmpresaComparativa(id));
      if (compMatch) return compMatch;
    }

    const baseFallback = matches.find((id) => esEmpresaBase(id));
    return baseFallback || matches[0];
  };

  const obtenerEmpresaIdOrigenConsolidacion = (capitulo) =>
    obtenerEmpresaIdPorCapituloEnGrupo(
      capitulo,
      obtenerEmpresaIdDestinoConsolidacion(),
    );

  const mapWithConcurrency = async (items, limit, mapper) => {
    const list = Array.isArray(items) ? items : [];
    const max = Math.max(1, Number(limit) || 1);
    const workers = Math.min(max, list.length);
    const results = new Array(list.length);
    let cursor = 0;
    const runWorker = async () => {
      while (true) {
        const current = cursor;
        cursor += 1;
        if (current >= list.length) return;
        results[current] = await mapper(list[current], current);
      }
    };
    await Promise.all(Array.from({ length: workers }, () => runWorker()));
    return results;
  };

  async function fetchReporteResumenMes({ empresaId, anio, mes, capitulo }) {
    const params = new URLSearchParams({
      empresaId: (empresaId || "").toString(),
      anio: (anio || "").toString(),
      mes: (mes || "").toString(),
    });
    if (capitulo) {
      params.set("capitulo", capitulo.toString());
    }
    const resp = await fetch(`${API_ROOT}/reportes/resumen?${params.toString()}`, {
      headers: getAuthHeaders(),
    });
    if (!resp.ok) {
      const payload = await resp.json().catch(() => ({}));
      const msg = payload?.mensaje || `Error ${resp.status} consultando resumen`;
      throw new Error(msg);
    }
    return resp.json();
  }

  async function fetchTotalesPresupuestoCapitulo({ empresaId, anio }) {
    const params = new URLSearchParams({
      empresaId: (empresaId || "").toString(),
      anio: (anio || "").toString(),
    });
    const resp = await fetch(
      `${API_ROOT}/presupuestos/totales-capitulo?${params.toString()}`,
      {
        headers: getAuthHeaders(),
      },
    );
    if (!resp.ok) {
      const payload = await resp.json().catch(() => ({}));
      const msg =
        payload?.mensaje || `Error ${resp.status} consultando totales`;
      throw new Error(msg);
    }
    const payload = await resp.json().catch(() => ({}));
    return payload?.totales || null;
  }

  const extraerLayoutReporteResumen = (payload) => {
    if (!payload || typeof payload !== "object") return [];
    if (Array.isArray(payload.layout)) return payload.layout;
    if (Array.isArray(payload.resumen) && Array.isArray(payload.resumen?.[0]?.layout)) {
      return payload.resumen[0].layout;
    }
    if (Array.isArray(payload.resumen) && Array.isArray(payload.resumen?.[0]?.layoutFinal)) {
      return payload.resumen[0].layoutFinal;
    }
    return [];
  };

  const construirFilasDisponiblesDesdeLayout = (layout = []) => {
    const blocks = Array.isArray(layout) ? layout : [];
    const byLabel = new Map(); // normLabel -> blocks[]

    blocks.forEach((block) => {
      const label = (block?.label || "").toString().trim();
      if (!label) return;
      if (!block?.totals || typeof block.totals !== "object") return;
      const key = normalizarEtiquetaResumen(label);
      if (!key) return;
      if (!byLabel.has(key)) byLabel.set(key, []);
      byLabel.get(key).push(block);
    });

    const winners = [];
    byLabel.forEach((list) => {
      const best = elegirMejorBloqueResumen(list);
      if (best && best.label) winners.push(best);
    });

    winners.sort((a, b) => {
      const ordA = obtenerOrdenBloqueResumen(a, 0);
      const ordB = obtenerOrdenBloqueResumen(b, 0);
      if (ordA !== ordB) return ordA - ordB;
      const idxA = obtenerOrdenIndexBloqueResumen(a, 0);
      const idxB = obtenerOrdenIndexBloqueResumen(b, 0);
      if (idxA !== idxB) return idxA - idxB;
      const prA = obtenerPrioridadTipoBloqueResumen(a);
      const prB = obtenerPrioridadTipoBloqueResumen(b);
      if (prA !== prB) return prA - prB;
      const la = normalizarEtiquetaResumen(a?.label || "");
      const lb = normalizarEtiquetaResumen(b?.label || "");
      return la.localeCompare(lb, "es");
    });

    return winners
      .map((b) => (b?.label || "").toString().trim())
      .filter(Boolean);
  };

  const buildCdmxFilasResumenCacheKey = ({ empresaId, anio, capitulo }) => {
    const empresa = canonicalizarEmpresaId(empresaId);
    const ejercicio = Number(anio);
    const capNorm = normalizarEtiquetaResumen(capitulo);
    if (!empresa || !Number.isInteger(ejercicio) || !capNorm) return null;
    return `${empresa}::${ejercicio}::${capNorm}`;
  };

  const scheduleCdmxFilasResumenRender = () => {
    if (cdmxFilasResumenRenderScheduled) return;
    cdmxFilasResumenRenderScheduled = true;
    setTimeout(() => {
      cdmxFilasResumenRenderScheduled = false;
      try {
        renderCdmxPresupuestoConsolidacionPanel();
      } catch (_) {
        // ignore
      }
    }, 0);
  };

  const getCdmxConsolidacionFilasResumenState = ({ capitulo, anio }) => {
    const empresaId = obtenerEmpresaIdOrigenConsolidacion(capitulo);
    const cacheKey = buildCdmxFilasResumenCacheKey({ empresaId, anio, capitulo });
    if (!cacheKey) return { rows: [], loading: false, error: null };
    const cached = cdmxFilasResumenCache.get(cacheKey);
    if (cached?.rows) return { rows: cached.rows, loading: false, error: null };
    if (cached?.error) return { rows: [], loading: false, error: cached.error };
    if (cached?.promise) return { rows: [], loading: true, error: null };
    return { rows: [], loading: false, error: null };
  };

  const ensureCdmxConsolidacionFilasResumenLoaded = async ({ capitulo, anio }) => {
    const empresaId = obtenerEmpresaIdOrigenConsolidacion(capitulo);
    const cacheKey = buildCdmxFilasResumenCacheKey({ empresaId, anio, capitulo });
    if (!cacheKey) return [];

    const cached = cdmxFilasResumenCache.get(cacheKey);
    if (cached?.rows) return cached.rows;
    if (cached?.promise) return cached.promise;

    const promise = (async () => {
      const payload = await fetchReporteResumenMes({
        empresaId,
        anio,
        mes: 12,
        capitulo,
      });
      const layout = extraerLayoutReporteResumen(payload);
      const rows = construirFilasDisponiblesDesdeLayout(layout);
      cdmxFilasResumenCache.set(cacheKey, { rows, at: Date.now() });
      return rows;
    })()
      .then((rows) => {
        scheduleCdmxFilasResumenRender();
        return rows;
      })
      .catch((error) => {
        cdmxFilasResumenCache.set(cacheKey, { error, at: Date.now() });
        scheduleCdmxFilasResumenRender();
        throw error;
      });

    cdmxFilasResumenCache.set(cacheKey, { promise });
    return promise;
  };

  const obtenerOrdenBloqueResumen = (block, fallback = 0) => {
    const raw = block?.order ?? block?.orden ?? block?.Orden ?? fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const obtenerOrdenIndexBloqueResumen = (block, fallback = 0) => {
    const raw =
      block?.orderIndex ?? block?.ordenIndex ?? block?.OrdenIndex ?? fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const obtenerPrioridadTipoBloqueResumen = (block) => {
    const tipo = (block?.type || "").toString().trim().toLowerCase();
    if (!tipo) return CDMX_CONSOLIDACION_LAYOUT_TIPO_PRIORITY_DEFAULT;
    return (
      CDMX_CONSOLIDACION_LAYOUT_TIPO_PRIORITY[tipo] ??
      CDMX_CONSOLIDACION_LAYOUT_TIPO_PRIORITY_DEFAULT
    );
  };

  const elegirMejorBloqueResumen = (candidatos = []) => {
    const list = (Array.isArray(candidatos) ? candidatos : []).slice();
    list.sort((a, b) => {
      const prA = obtenerPrioridadTipoBloqueResumen(a);
      const prB = obtenerPrioridadTipoBloqueResumen(b);
      if (prA !== prB) return prA - prB;
      const ordA = obtenerOrdenBloqueResumen(a, 0);
      const ordB = obtenerOrdenBloqueResumen(b, 0);
      if (ordA !== ordB) return ordA - ordB;
      const idxA = obtenerOrdenIndexBloqueResumen(a, 0);
      const idxB = obtenerOrdenIndexBloqueResumen(b, 0);
      return idxA - idxB;
    });
    return list[0] || null;
  };

  const buscarBloqueResumenPorEtiqueta = (layout = [], etiqueta = "") => {
    const queryNorm = normalizarEtiquetaResumen(etiqueta);
    if (!queryNorm) return null;
    const list = Array.isArray(layout) ? layout : [];
    const exact = list.filter(
      (b) => normalizarEtiquetaResumen(b?.label || "") === queryNorm,
    );
    if (exact.length) {
      return elegirMejorBloqueResumen(exact);
    }
    const contains = list.filter((b) =>
      normalizarEtiquetaResumen(b?.label || "").includes(queryNorm),
    );
    if (contains.length) {
      return elegirMejorBloqueResumen(contains);
    }
    return null;
  };

  const extraerPlanMonthBloqueResumen = (block) => {
    const raw =
      block?.totals?.planMonth ??
      block?.planMonth ??
      block?.totalPlanMonth ??
      block?.totals?.totalPlanMonth ??
      block?.plan ??
      block?.presupuesto ??
      0;
    return Math.abs(numeroSeguroCdmxConsolidacion(raw));
  };

  const inferirTipoTotalesDesdeFilaResumen = (fila = "") => {
    const raw = (fila || "").toString().trim();
    const norm = normalizarEtiquetaResumen(raw);
    if (!norm) return null;

    const ingreso = CDMX_CONSOLIDACION_INGRESO_LABELS.some(
      (l) => norm === normalizarEtiquetaResumen(l),
    );
    if (ingreso) return "income";

    const gasto = CDMX_CONSOLIDACION_GASTO_LABELS.some(
      (l) => norm === normalizarEtiquetaResumen(l),
    );
    if (gasto) return "expense";

    return null;
  };

  const canonicalizarFilaBusquedaResumen = (fila = "") => {
    const raw = (fila || "").toString().trim();
    const norm = normalizarEtiquetaResumen(raw);
    if (!norm) return "";
    if (
      CDMX_CONSOLIDACION_INGRESO_LABELS.some(
        (l) => norm === normalizarEtiquetaResumen(l),
      )
    ) {
      return "INCOME";
    }
    if (
      CDMX_CONSOLIDACION_GASTO_LABELS.some(
        (l) => norm === normalizarEtiquetaResumen(l),
      )
    ) {
      return "EXPENSE";
    }
    return raw;
  };

  const extraerPlanMonthDeFilaResumen = (payload, fila) => {
    const etiqueta = canonicalizarFilaBusquedaResumen(fila);
    const layout = extraerLayoutReporteResumen(payload);
    const block = buscarBloqueResumenPorEtiqueta(layout, etiqueta);
    if (!block) {
      throw new Error(
        `No se encontró la fila "${(fila || "").toString().trim()}" en RESUMEN`,
      );
    }
    return extraerPlanMonthBloqueResumen(block);
  };

  async function cargarResumenMensualCapitulo({ capitulo, anio }) {
    const empresaId = obtenerEmpresaIdOrigenConsolidacion(capitulo);
    if (!empresaId) {
      throw new Error(`No se pudo resolver empresaId para capítulo: ${capitulo}`);
    }
    const cacheKey = `${empresaId}::${anio}::${normalizarEtiquetaResumen(capitulo)}`;
    const cached = cdmxResumenMensualCache.get(cacheKey);
    if (cached?.data) return cached.data;
    if (cached?.promise) return cached.promise;

    const meses = Array.from({ length: 12 }, (_, idx) => idx + 1);
    const promise = mapWithConcurrency(
      meses,
      CDMX_CONSOLIDACION_RESUMEN_CONCURRENCY,
      async (mes) =>
        fetchReporteResumenMes({
          empresaId,
          anio,
          mes,
          capitulo,
        }),
    )
      .then((data) => {
        cdmxResumenMensualCache.set(cacheKey, { data, at: Date.now() });
        return data;
      })
      .catch((error) => {
        cdmxResumenMensualCache.delete(cacheKey);
        throw error;
      });

    cdmxResumenMensualCache.set(cacheKey, { promise });
    return promise;
  }

  async function cargarTotalesPresupuestoCapitulo({ capitulo, anio }) {
    const empresaId = obtenerEmpresaIdOrigenConsolidacion(capitulo);
    if (!empresaId) {
      throw new Error(`No se pudo resolver empresaId para capítulo: ${capitulo}`);
    }
    const cacheKey = `${canonicalizarEmpresaId(empresaId)}::${anio}`;
    const cached = cdmxTotalesCapituloCache.get(cacheKey);
    if (cached?.data) return cached.data;
    if (cached?.promise) return cached.promise;

    const promise = fetchTotalesPresupuestoCapitulo({ empresaId, anio })
      .then((data) => {
        cdmxTotalesCapituloCache.set(cacheKey, { data, at: Date.now() });
        return data;
      })
      .catch((error) => {
        cdmxTotalesCapituloCache.delete(cacheKey);
        throw error;
      });

    cdmxTotalesCapituloCache.set(cacheKey, { promise });
    return promise;
  }

  async function handleCdmxPresupuestoConsolidacionApply(eventOrOptions) {
    const options =
      eventOrOptions &&
      typeof eventOrOptions === "object" &&
      !("target" in eventOrOptions)
        ? eventOrOptions
        : {};
    const isAuto = options.source === "auto";
    const shouldToastDefault = !isAuto;

    if (!esContextoCdmxResumen()) return;
    const anio = Number(state.anio);
    if (!Number.isInteger(anio)) {
      if (shouldToastDefault) {
        showToast("Selecciona un año válido", "warning");
      } else {
        setCdmxPresupuestoConsolidacionStatus("Auto: selecciona un año válido.");
      }
      return;
    }
    if (cdmxConsolidacionAplicando) return;

    const { config } = obtenerCdmxPresupuestoConsolidacionConfig();
    if (config.enabled === false) {
      if (shouldToastDefault) {
        showToast("Consolidación deshabilitada", "warning");
      } else {
        setCdmxPresupuestoConsolidacionStatus("Auto: consolidación deshabilitada.");
      }
      return;
    }
    const reglas = config.cuentas || {};

    const capitulosNecesitanTotales = new Set();
    const capitulosNecesitanResumen = new Set();
    CDMX_PRESUPUESTO_CONSOLIDACION_CUENTAS_ORDEN.forEach((cuenta) => {
      const regla = reglas[cuenta];
      const capitulo = normalizarTextoCapitulo(regla?.capitulo);
      const fila = resolverFilaCdmxConsolidacion(regla, cuenta);
      if (!capitulo || !fila) return;
      const tipoTotales = inferirTipoTotalesDesdeFilaResumen(fila);
      if (tipoTotales) {
        capitulosNecesitanTotales.add(capitulo);
      } else {
        capitulosNecesitanResumen.add(capitulo);
      }
    });

    const capitulos = Array.from(
      new Set([
        ...Array.from(capitulosNecesitanTotales),
        ...Array.from(capitulosNecesitanResumen),
      ]),
    );
    if (!capitulos.length) {
      if (shouldToastDefault) {
        showToast("No hay capítulos configurados para consolidar", "warning");
      } else {
        setCdmxPresupuestoConsolidacionStatus(
          "Auto: no hay capítulos configurados para consolidar.",
        );
      }
      return;
    }

    cdmxConsolidacionAplicando = true;
    renderCdmxPresupuestoConsolidacionPanel();
    setCdmxPresupuestoConsolidacionStatus("Preparando consolidación...");

    try {
      const resumenMensualPorCapitulo = {};
      const totalesPorCapitulo = {};

      const capitulosTotales = Array.from(capitulosNecesitanTotales);
      for (let idx = 0; idx < capitulosTotales.length; idx += 1) {
        const capitulo = capitulosTotales[idx];
        setCdmxPresupuestoConsolidacionStatus(
          `Cargando totales de presupuesto: ${capitulo} (${idx + 1}/${capitulosTotales.length})...`,
        );
        totalesPorCapitulo[capitulo] = await cargarTotalesPresupuestoCapitulo({
          capitulo,
          anio,
        });
      }

      const capitulosResumen = Array.from(capitulosNecesitanResumen);
      for (let idx = 0; idx < capitulosResumen.length; idx += 1) {
        const capitulo = capitulosResumen[idx];
        setCdmxPresupuestoConsolidacionStatus(
          `Cargando RESUMEN (12 meses): ${capitulo} (${idx + 1}/${capitulosResumen.length})...`,
        );
        resumenMensualPorCapitulo[capitulo] = await cargarResumenMensualCapitulo({
          capitulo,
          anio,
        });
      }

      const cuentas = [];
      CDMX_PRESUPUESTO_CONSOLIDACION_CUENTAS_ORDEN.forEach((cuenta) => {
        const regla = reglas[cuenta];
        const capitulo = normalizarTextoCapitulo(regla?.capitulo);
        const fila = resolverFilaCdmxConsolidacion(regla, cuenta);
        if (!capitulo || !fila) return;

        const tipoTotales = inferirTipoTotalesDesdeFilaResumen(fila);
        if (tipoTotales) {
          const totales = totalesPorCapitulo[capitulo];
          const mensual = totales?.[tipoTotales] || null;
          if (!mensual) return;

          const valores = {};
          MESES_CORTOS.forEach((mes) => {
            valores[mes] = Math.abs(numeroSeguroCdmxConsolidacion(mensual?.[mes] ?? 0));
          });
          cuentas.push({ numCta: cuenta, valores });
          return;
        }

        const mensual = resumenMensualPorCapitulo[capitulo] || null;
        if (!mensual) return;

        const valores = {};
        MESES_CORTOS.forEach((mes, mesIdx) => {
          const payload = mensual?.[mesIdx];
          try {
            valores[mes] = extraerPlanMonthDeFilaResumen(payload, fila);
          } catch (errorFila) {
            const detalle = (errorFila?.message || "").toString();
            throw new Error(
              `${capitulo} · ${cuenta} · ${mes.toUpperCase()}: ${detalle}`.trim(),
            );
          }
        });
        cuentas.push({ numCta: cuenta, valores });
      });

      if (!cuentas.length) {
        if (shouldToastDefault) {
          showToast("No se generaron cuentas para actualizar", "warning");
        } else {
          setCdmxPresupuestoConsolidacionStatus(
            "Auto: no se generaron cuentas para actualizar.",
          );
        }
        return;
      }

      const todasEnCero = cuentas.every((cuenta) =>
        MESES_CORTOS.every((mes) => Number(cuenta?.valores?.[mes] || 0) === 0),
      );
      if (todasEnCero) {
        if (shouldToastDefault) {
          showToast(
            "⚠️ Todos los valores calculados son 0. Revisa la fila RESUMEN seleccionada (columna Ppto).",
            "warning",
          );
        } else {
          setCdmxPresupuestoConsolidacionStatus(
            "Auto: todos los valores calculados son 0.",
          );
        }
      }

      const empresaIdDestino = obtenerEmpresaIdDestinoConsolidacion();
      setCdmxPresupuestoConsolidacionStatus(
        `Actualizando ${cuentas.length} cuentas en Presupuesto (CDMX: ${empresaIdDestino})...`,
      );
      const resp = await fetch(`${API_ROOT}/presupuestos/actualizar-consolidados`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ empresaId: empresaIdDestino, anio, cuentas }),
      });
      if (!resp.ok) {
        const payload = await resp.json().catch(() => ({}));
        throw new Error(payload?.mensaje || `Error ${resp.status} al actualizar`);
      }
      const payload = await resp.json().catch(() => ({}));

      const errores = Array.isArray(payload?.errores) ? payload.errores : [];
      if (errores.length > 0) {
        console.warn("[CDMX Consolidación] Errores backend:", errores);
        if (shouldToastDefault) {
          showToast(
            `⚠️ Consolidación aplicada con errores (${errores.length}). Revisa consola/estatus.`,
            "warning",
          );
        }
        setCdmxPresupuestoConsolidacionStatus(
          `Consolidación aplicada con errores (${errores.length}).`,
        );
      } else {
        if (shouldToastDefault) {
          showToast(
            `✅ ${payload?.mensaje || "Consolidación aplicada"} · cuentas: ${payload?.cuentasActualizadas ?? cuentas.length
            }`,
            "success",
          );
        }
        if (isAuto) {
          const hora = new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });
          setCdmxPresupuestoConsolidacionStatus(
            `Consolidación aplicada (auto ${hora}).`,
          );
        } else {
          setCdmxPresupuestoConsolidacionStatus("Consolidación aplicada.");
        }
      }

      if (Array.isArray(payload?.verificacion) && payload.verificacion.length > 0) {
        try {
          const verMap = new Map(
            payload.verificacion.map((row) => [String(row?.NUM_CTA || "").trim(), row]),
          );
          const procesadas = Array.isArray(payload?.cuentasProcesadas)
            ? payload.cuentasProcesadas
            : [];
          const resumenVerif = procesadas
            .map((c) => {
              const canon = String(c?.numCtaNormalizada || "").trim();
              const row = verMap.get(canon) || null;
              if (!canon || !row) return null;
              return `${c.numCta || canon}: ENE=${numeroSeguroCdmxConsolidacion(row.PRESUP01)}`;
            })
            .filter(Boolean)
            .slice(0, 3)
            .join(" · ");
          if (resumenVerif) {
            setCdmxPresupuestoConsolidacionStatus(
              `${(dom.cdmxPresupuestoConsolidacionStatus?.textContent || "").trim()} Verificación: ${resumenVerif}`.trim(),
            );
          }
        } catch (_) {
          // ignore verificación UI
        }
      }
    } catch (error) {
      console.error("[CDMX Consolidación] Error:", error);
      const now = Date.now();
      const canToast =
        shouldToastDefault ||
        now - cdmxConsolidacionAutoLastErrorToastAt >
          CDMX_CONSOLIDACION_AUTO_ERROR_TOAST_COOLDOWN_MS;
      if (canToast) {
        showToast(error.message || "Error al aplicar consolidación", "error");
        if (!shouldToastDefault) {
          cdmxConsolidacionAutoLastErrorToastAt = now;
        }
      }
      setCdmxPresupuestoConsolidacionStatus(
        `Error: ${(error?.message || "").toString()}`.trim(),
      );
    } finally {
      cdmxConsolidacionAplicando = false;
      renderCdmxPresupuestoConsolidacionPanel();
    }
  }

  // ==========================================
  // DATA LOADING
  // ==========================================
  async function loadInitialData() {
    state.modulo = dom.moduloSelect.value;
    await loadYears();
    await loadChapters();
    // Cargar layout automáticamente al iniciar si hay contexto
    await tryLoadLayout();
  }

  // Intenta cargar el layout si hay contexto completo
  async function tryLoadLayout() {
    if (state.modulo && state.anio && state.capitulo) {
      await loadLayout();
    }
  }

  async function loadYears() {
    try {
      const empresaId = obtenerEmpresaIdApi();
      const url = `${API_ROOT}/saldos/anios?empresaId=${encodeURIComponent(
        empresaId,
      )}`;
      const response = await fetch(url, { headers: getAuthHeaders() });

      if (!response.ok) throw new Error("Error al cargar años");

      const data = await response.json();
      const years = Array.isArray(data.anios) ? data.anios : [];
      const currentYear = new Date().getFullYear();

      // Ordenar años descendente
      const sortedYears = years.sort((a, b) => b - a);

      const preferredYear = (() => {
        const parsed = Number(state.anio);
        return Number.isInteger(parsed) ? parsed : null;
      })();
      const selectedYear = sortedYears.includes(preferredYear)
        ? preferredYear
        : sortedYears.includes(currentYear)
          ? currentYear
          : sortedYears[0] || null;

      dom.anioSelect.innerHTML = sortedYears.length
        ? sortedYears
          .map(
            (y) =>
              `<option value="${y}" ${y === selectedYear ? "selected" : ""
              }>${y}</option>`,
          )
          .join("")
        : '<option value="">Sin años disponibles</option>';

      state.anio = selectedYear;
      try {
        window.Sesion?.guardarContextoPlaneacion?.({ anio: state.anio });
      } catch (_) {
        // ignore
      }
    } catch (error) {
      console.error("Error loading years:", error);
      dom.anioSelect.innerHTML = '<option value="">Error al cargar</option>';
      showToast("Error al cargar años disponibles", "error");
    }
  }

  async function loadChapters() {
    // Try to get chapter from parent selector
    const selector = document.querySelector(".company-selector select");
    const parentSelector = window.parent?.document?.querySelector(
      ".company-selector select",
    );
    const activeSelector = parentSelector || selector;

    if (activeSelector?.value) {
      const selectorValue = activeSelector.value;
      let chapter = window.CapitulosModulos?.empresaACapitulo?.(selectorValue);

      // empresaACapitulo might return an object {capitulo: "...", etiqueta: "..."} or a string
      if (chapter && typeof chapter === "object") {
        chapter = chapter.capitulo || chapter.etiqueta || String(chapter);
      }
      chapter = chapter || selectorValue;

      state.capitulo = chapter;
      asegurarEmpresaIdContexto(state.capitulo);
      dom.capituloSelect.innerHTML = `<option value="${chapter}">${chapter}</option>`;
    } else {
      // Load chapters from API
      try {
        const url = agregarEmpresaIdQuery(
          `${API_BASE}/${encodeURIComponent(state.modulo)}/${state.anio}/capitulos`,
        );
        const response = await fetch(url, { headers: getAuthHeaders() });

        if (response.ok) {
          const data = await response.json();
          const chapters = data.capitulos || [];

          if (chapters.length) {
            // API returns chapters as objects {capitulo: "..."} - extract string value
            dom.capituloSelect.innerHTML = chapters
              .map((c) => {
                const name =
                  typeof c === "object"
                    ? c.capitulo || c.etiqueta || String(c)
                    : c;
                return `<option value="${name}">${name}</option>`;
              })
              .join("");
            // Also extract string from first chapter
            const first = chapters[0];
            state.capitulo =
              typeof first === "object"
                ? first.capitulo || first.etiqueta || String(first)
                : first;
            asegurarEmpresaIdContexto(state.capitulo, true);
          }
        }
      } catch (error) {
        console.error("Error loading chapters:", error);
      }
    }
  }

  async function loadLayout() {
    if (!state.anio || !state.capitulo) {
      return; // Sin contexto completo, no hacer nada
    }

    setStatus("Cargando layout...");

    try {
      const urlBase = agregarEmpresaIdQuery(
        `${API_BASE}/${encodeURIComponent(state.modulo)}/${state.anio}/${encodeURIComponent(state.capitulo)}`,
      );
      // MODO MANUAL: necesitamos placeholders de secciones/subsecciones VACÍAS (layout_secciones)
      // para permitir crear/reordenar secciones antes de tener cuentas.
      const url = isModuloPiloto()
        ? `${urlBase}${urlBase.includes("?") ? "&" : "?"}includeSecciones=1`
        : urlBase;
      const response = await fetch(url, { headers: getAuthHeaders() });

      if (response.status === 404) {
        // No existe layout - mostrar opción para crear
        state.layout = null;
        state.cuentas = [];
        state.operaciones = [];
        showNewLayoutView();
        setStatus(`No hay layout para ${state.modulo} ${state.anio}`);
        return;
      }

      if (!response.ok) throw new Error("No se pudo cargar el layout");

      const data = await response.json();
      state.layout = data.layout || {};
      // Si backend canoniza el capítulo (p.ej. quita tildes), sincronizar estado
      // para que guardados/versions usen siempre una sola clave.
      if (
        state.layout &&
        typeof state.layout.capitulo === "string" &&
        state.layout.capitulo.trim()
      ) {
        state.capitulo = state.layout.capitulo.trim();
      }

      // Extraer cuentas desde el formato nuevo (layout.cuentas) o legacy (layout[modulo]).
      if (
        Array.isArray(state.layout.cuentas) &&
        state.layout.cuentas.length > 0
      ) {
        state.cuentas = state.layout.cuentas;
      } else if (
        Array.isArray(state.layout[state.modulo]) &&
        state.layout[state.modulo].length > 0
      ) {
        state.cuentas = state.layout[state.modulo];
      } else {
        state.cuentas = [];
      }

      ensureAccountIds(state.cuentas);
      state.operaciones = sortOperations(state.layout.operaciones || []);
      if (isModuloPiloto()) {
        const extracted = extractColumnConfigFromOperations(state.operaciones);
        state.operaciones = extracted.operaciones;
        state.columnasConfig =
          Array.isArray(extracted.columnasConfig) &&
            extracted.columnasConfig.length
            ? extracted.columnasConfig
            : buildDefaultColumnConfig();
        state.columnasConfigChanged = false;
        // Extraer configuración de layout (mostrarSubsecciones, etc.)
        const layoutExtracted = extractLayoutConfigFromOperations(state.operaciones);
        state.operaciones = layoutExtracted.operaciones;
        state.layoutConfig = layoutExtracted.layoutConfig || { subseccionesOcultas: [] };
        state.layoutConfigChanged = false;
      } else {
        state.columnasConfig = null;
        state.columnasConfigChanged = false;
        state.layoutConfig = null;
        state.layoutConfigChanged = false;
      }

      // Modo estricto manual: no inferir parentSection/parentSubsection.
      // Solo se respeta lo que exista explícitamente en el layout guardado.
      ensureOperationIds(); // Solo asegurar IDs si faltan
      dedupeTemplateStructure({ silent: true });
      // normalizeOperationReferences(); // DESACTIVADO: modo 100% manual
      // normalizePresentationOrders(); // No recalcular órdenes
      state.selectedElement = null;

      renderLayout();
      updateStats();
      updateHeaderLabels();
      showLayoutView();
      setStatus(`Layout ${state.modulo} ${state.anio} listo para editar`);
    } catch (error) {
      console.error("Error loading layout:", error);
      setStatus("Error al cargar layout");
      showToast(error.message, "error");
    }
  }

  // Vista para crear nuevo layout
  function updateHeaderLabels() {
    if (dom.moduloLabel) dom.moduloLabel.textContent = state.modulo || "-";
    if (dom.anioLabel) dom.anioLabel.textContent = state.anio || "-";
    if (dom.capituloLabel)
      dom.capituloLabel.textContent = state.capitulo || "-";
    renderCdmxPresupuestoConsolidacionPanel();
  }

  function showNewLayoutView() {
    dom.placeholderView.style.display = "none";
    dom.layoutView.style.display = "flex";

    dom.layoutPreview.innerHTML = `
      <div class="create-layout-prompt">
        <div class="prompt-icon">
          <i class="bi bi-file-earmark-plus"></i>
        </div>
        <h2>No existe layout para ${state.anio}</h2>
        <p>Puedes crear un layout manualmente o copiar uno existente de otro año.</p>
        <div class="prompt-actions">
          <button class="btn btn-outline-primary btn-lg" onclick="document.getElementById('btnCopiar').click()">
            <i class="bi bi-copy me-2"></i>Copiar de Otro Año
          </button>
          <button class="btn btn-success btn-lg" onclick="document.getElementById('btnAgregar').click()">
            <i class="bi bi-plus-circle me-2"></i>Agregar manualmente
          </button>
        </div>
        <div class="prompt-hint">
          <i class="bi bi-lightbulb"></i>
          <span>Agrega secciones, cuentas u operaciones en el orden que necesitas.</span>
        </div>
      </div>
    `;

    updateButtonStates();
  }

  function extractCuentas(layout) {
    console.log("[extractCuentas] Input layout:", layout);
    console.log("[extractCuentas] layout.cuentas:", layout?.cuentas);
    console.log(
      "[extractCuentas] layout[modulo]:",
      layout?.[state.modulo],
      "modulo=",
      state.modulo,
    );

    if (Array.isArray(layout.cuentas)) {
      console.log(
        "[extractCuentas] Retornando layout.cuentas:",
        layout.cuentas.length,
        "elementos",
      );
      return layout.cuentas;
    }
    if (Array.isArray(layout[state.modulo])) {
      console.log(
        "[extractCuentas] Retornando layout[modulo]:",
        layout[state.modulo].length,
        "elementos",
      );
      return layout[state.modulo];
    }
    console.log(
      "[extractCuentas] No se encontraron cuentas, retornando array vacío",
    );
    return [];
  }

  function getAccountOrder(cuenta, fallback = 0) {
    const raw = cuenta?.orden_presentacion;
    // Importante: Number(null) y Number('') dan 0, pero aquí queremos tratar
    // null/'' como "sin orden" para usar el fallback (orden o índice).
    if (raw === null || raw === undefined) return fallback;
    if (typeof raw === "string" && raw.trim() === "") return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function sortAccountsByOrder(accounts = []) {
    return (accounts || [])
      .map((cuenta, idx) => ({ cuenta, idx }))
      .sort((a, b) => {
        const orderA = getAccountOrder(a.cuenta, a.idx);
        const orderB = getAccountOrder(b.cuenta, b.idx);
        if (orderA !== orderB) return orderA - orderB;
        const fallbackA = Number.isFinite(Number(a.cuenta?.orden))
          ? Number(a.cuenta.orden)
          : a.idx;
        const fallbackB = Number.isFinite(Number(b.cuenta?.orden))
          ? Number(b.cuenta.orden)
          : b.idx;
        if (fallbackA !== fallbackB) return fallbackA - fallbackB;
        return a.idx - b.idx;
      })
      .map(({ cuenta }) => cuenta);
  }

  function isPlaceholderAccount(cuenta) {
    if (!cuenta) return false;
    const codigo = (cuenta.CUENTA || cuenta.cuenta || "").toString().trim();
    if (codigo) return false;
    if (cuenta.__layoutPlaceholder || cuenta.__placeholderType) return true;
    const nombre = (cuenta.NOMBRE || cuenta.nombre || "").toString();
    return /\[secci[oó]n/i.test(nombre) || /\[subsecci[oó]n/i.test(nombre);
  }

  function getNextAccountOrder() {
    return getNextGlobalOrder();
  }

  function getNextGlobalOrder() {
    const orders = [];
    (state.cuentas || []).forEach((cuenta, idx) => {
      const o = getAccountOrder(cuenta, idx);
      if (Number.isFinite(Number(o))) orders.push(Number(o));
    });
    (state.operaciones || []).forEach((op, idx) => {
      if (!op || isColumnConfigOperation(op)) return;
      const o = getOperationOrder(op, idx);
      if (Number.isFinite(Number(o))) orders.push(Number(o));
    });
    const max = orders.length ? Math.max(...orders) : -1;
    return Number.isFinite(max) ? max + 1 : (state.cuentas || []).length + 1;
  }

  let accountIdSeed = 0;
  function buildAccountRowId() {
    accountIdSeed += 1;
    return `acc_${Date.now().toString(36)}_${accountIdSeed}`;
  }

  function assignAccountRowId(cuenta) {
    if (!cuenta) return "";
    const existing =
      cuenta.__rowId ||
      cuenta.__layoutRowId ||
      cuenta.__id ||
      cuenta._rowId ||
      "";
    const id = existing || buildAccountRowId();
    if (!cuenta.__rowId) {
      try {
        Object.defineProperty(cuenta, "__rowId", {
          value: id,
          writable: false,
          enumerable: false,
        });
      } catch {
        cuenta.__rowId = id;
      }
    }
    return cuenta.__rowId || id;
  }

  function ensureAccountIds(accounts = state.cuentas) {
    if (!Array.isArray(accounts)) return;
    accounts.forEach((cuenta) => assignAccountRowId(cuenta));
  }

  function getAccountRowId(cuenta) {
    return assignAccountRowId(cuenta);
  }

  function resolveAccountByIdOrCode(idOrCode) {
    if (!idOrCode) return null;
    const direct = (state.cuentas || []).find((c) => {
      const rowId =
        c?.__rowId || c?.__layoutRowId || c?.__id || c?._rowId || "";
      return rowId && rowId === idOrCode;
    });
    if (direct) return direct;
    const target = normalizeOperationMatch(idOrCode);
    return (state.cuentas || []).find((c) => {
      const code = (c.CUENTA || c.Cuenta || c.cuenta || "").toString();
      return normalizeOperationMatch(code) === target;
    });
  }

  function getOperationOrder(op, fallback = 0) {
    const raw = op?.orden_presentacion;
    if (raw === null || raw === undefined) return fallback;
    if (typeof raw === "string" && raw.trim() === "") return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function getOperationDisplayName(op) {
    return (
      op?.["sum-row"] ||
      op?.["sum-row-sumavarios"] ||
      op?.["sum-row-sumavarios2"] ||
      op?.["sum-row-sumavarios-consolidado"] ||
      op?.["sum-row-operativo"] ||
      op?.["result-row"] ||
      op?.["net-row"] ||
      op?.["result-net-row"] ||
      getOperationLabel(op) ||
      "Operacion"
    );
  }

  const OP_ROW_FIELDS = [
    {
      field: "sum-row",
      label: "Fila de Suma",
      placeholder: "SUMA DE ...",
      tooltip: "Se verá como fila de suma (total por sección).",
    },
    {
      field: "sum-row-sumavarios",
      label: "Suma Varios",
      placeholder: "TOTAL ...",
      tooltip: "Se verá como total de varios bloques (sumavarios).",
    },
    {
      field: "sum-row-sumavarios2",
      label: "Suma Varios 2",
      placeholder: "RESULTADO ...",
      tooltip: "Se verá como resultado intermedio (segunda suma).",
    },
    {
      field: "sum-row-sumavarios-consolidado",
      label: "Consolidado",
      placeholder: "CONSOLIDATED ...",
      tooltip: "Se verá como total consolidado.",
    },
    {
      field: "sum-row-operativo",
      label: "Operativo",
      placeholder: "OPERATING RESULTS ...",
      tooltip: "Se verá como resultado operativo.",
    },
    {
      field: "result-row",
      label: "Resultado",
      placeholder: "RESULTADO ...",
      tooltip: "Se verá como resultado final.",
    },
    {
      field: "net-row",
      label: "Neto",
      placeholder: "NET RESULTS ...",
      tooltip: "Se verá como neto.",
    },
    {
      field: "result-net-row",
      label: "Resultado Neto",
      placeholder: "CONSOLIDATED NET RESULTS ...",
      tooltip: "Se verá como resultado neto final.",
    },
  ];

  const ROW_LABEL_FIELDS = OP_ROW_FIELDS.map((row) => row.field);

  const OP_APARICION_ITEMS = [
    {
      value: "libre",
      label: "Libre (sin fila)",
      tooltip: "Operación libre: no crea fila de suma, solo cambia apariencia.",
    },
    ...OP_ROW_FIELDS.map((row) => ({
      value: row.field,
      label: row.label,
      tooltip: row.tooltip || "",
    })),
  ];

  const APARICION_TOOLTIP_MAP = new Map(
    OP_APARICION_ITEMS.map((item) => [item.value, item.tooltip || ""]),
  );

  const normalizeAparicionValue = (value) =>
    (value || "").toString().trim().toLowerCase();

  const getAparicionTooltip = (value) => APARICION_TOOLTIP_MAP.get(value) || "";

  const resolveOperationAparicionType = (op) => {
    if (!op) return "libre";
    for (const row of OP_ROW_FIELDS) {
      const value = (op?.[row.field] || "").toString().trim();
      if (value) return row.field;
    }
    return "libre";
  };

  const buildAparicionOptions = (selected = "") => {
    const selectedNorm = normalizeAparicionValue(selected);
    return OP_APARICION_ITEMS.map((item) => {
      const isSelected = normalizeAparicionValue(item.value) === selectedNorm;
      return `<option value="${escapeAttr(item.value)}"${isSelected ? " selected" : ""
        }>${escapeHtml(item.label)}</option>`;
    }).join("");
  };

  const applyAparicionTooltip = (select, helpEl = null) => {
    if (!select) return;
    const tooltip = getAparicionTooltip(select.value || "");
    const targets = [select, helpEl].filter(Boolean);
    targets.forEach((el) => {
      if (tooltip) {
        el.setAttribute("title", tooltip);
      } else {
        el.removeAttribute("title");
      }
    });
  };

  const initAparicionSelect = (container) => {
    if (!container) return;
    const select = container.querySelector('[data-aparicion-select="true"]');
    if (!select) return;
    const helpEl = container.querySelector('[data-aparicion-help="true"]');
    const onChange = () => applyAparicionTooltip(select, helpEl);
    select.addEventListener("change", onChange);
    applyAparicionTooltip(select, helpEl);

    // Inicializar selector de estilo visual
    const estiloSelect = container.querySelector("#editOperacionEstilo");
    if (estiloSelect) {
      const preview = container.querySelector("#estiloPreview > div");
      estiloSelect.addEventListener("change", () => {
        const selectedOption = estiloSelect.options[estiloSelect.selectedIndex];
        const className =
          selectedOption?.dataset?.class || "sum-row fw-semibold";
        if (preview) {
          preview.className = "text-center " + className;
        }
      });
    }
  };

  const closeOffcanvasFallback = (panel) => {
    if (!panel) return;
    panel.classList.remove("show");
    panel.style.visibility = "";
    panel.style.transform = "";
    panel.removeAttribute("aria-modal");
    panel.setAttribute("aria-hidden", "true");
    const backdrop = document.querySelector('[data-offcanvas-backdrop="true"]');
    backdrop?.remove();
  };

  const openOffcanvasFallback = (panel) => {
    if (!panel) return false;
    panel.classList.add("show");
    panel.style.visibility = "visible";
    panel.style.transform = "none";
    panel.setAttribute("aria-modal", "true");
    panel.removeAttribute("aria-hidden");
    if (!document.querySelector('[data-offcanvas-backdrop="true"]')) {
      const backdrop = document.createElement("div");
      backdrop.className = "offcanvas-backdrop show";
      backdrop.dataset.offcanvasBackdrop = "true";
      backdrop.addEventListener("click", () => closeOffcanvasFallback(panel));
      document.body.appendChild(backdrop);
    }
    panel.querySelectorAll('[data-bs-dismiss="offcanvas"]').forEach((btn) => {
      btn.addEventListener("click", () => closeOffcanvasFallback(panel), {
        once: true,
      });
    });
    return true;
  };

  const openEmergencyOperationModal = (op, operationId = "", error = null) => {
    if (!dom.modalEditar || !dom.formEditar) {
      if (error) {
        alert(
          `No se pudo abrir el editor.\nError: ${error.message || error}\nOperacion: ${operationId}`,
        );
      }
      return false;
    }

    const opId = getOperationId(op) || operationId || "";
    const opLabelInput =
      getOperationLabel(op) || getOperationDisplayName(op) || "";
    const tipoSeleccionado = resolveOperationAparicionType(op);
    const tipoTooltip = getAparicionTooltip(tipoSeleccionado);
    const tipoOptions = buildAparicionOptions(tipoSeleccionado);
    const rowLabelsHtml = OP_ROW_FIELDS.map((row) => {
      const tooltipAttr = row.tooltip
        ? ` title="${escapeAttr(row.tooltip)}"`
        : "";
      return `
        <div class="col-md-6">
          <label class="form-label small text-muted"${tooltipAttr}>${row.label}</label>
          <input type="text" class="form-control" id="${rowLabelInputId(
        row.field,
      )}" value="${escapeHtml(op?.[row.field] || "")}" placeholder="${row.placeholder
        }"${tooltipAttr} />
        </div>
      `;
    }).join("");

    dom.formEditar.innerHTML = `
      <div class="mb-3">
        <label class="form-label">Identificador unico</label>
        <input type="text" class="form-control" id="editOperacionId" value="${escapeHtml(opId)}" />
        <div class="form-text">Usa un ID unico para referenciar en formulas.</div>
      </div>

      <div class="mb-3">
        <label class="form-label">Etiqueta de la Operación</label>
        <input type="text" class="form-control" id="editClaseOp" value="${escapeHtml(
      opLabelInput,
    )}" />
      </div>

      <div class="mb-3">
        <label class="form-label d-flex align-items-center gap-2">
          Tipo de fila
          <i class="bi bi-info-circle text-muted" data-aparicion-help="true" title="${escapeAttr(
      tipoTooltip,
    )}"></i>
        </label>
        <select class="form-select" id="editOperacionTipo" data-aparicion-select="true" data-initial-tipo="${escapeAttr(
      tipoSeleccionado,
    )}" title="${escapeAttr(tipoTooltip)}">
          ${tipoOptions}
        </select>
        <div class="form-text">
          Solo cambia la apariencia de la fila en la plantilla.
        </div>
      </div>

      <div class="mb-3">
        <label class="form-label">Etiquetas en tabla</label>
        <div class="row g-2">
          ${rowLabelsHtml}
        </div>
        <div class="form-text">
          Estas etiquetas son las que aparecen en las tablas. Deja en blanco si no aplica.
        </div>
      </div>

      <div class="form-check form-switch">
        <input class="form-check-input" type="checkbox" id="editOperacionVisible" ${op?.visible !== false ? "checked" : ""
      } />
        <label class="form-check-label" for="editOperacionVisible">
          Visible en la plantilla
        </label>
      </div>
    `;

    initAparicionSelect(dom.formEditar);
    state.selectedElement = { type: "operation", op };

    // Preservar fórmula existente
    try {
      const terms = extractFormulaTerms(op);
      formulaTerms = Array.isArray(terms) ? terms : [];
    } catch {
      formulaTerms = [];
    }

    if (window.bootstrap?.Modal) {
      new bootstrap.Modal(dom.modalEditar).show();
    } else {
      dom.modalEditar.classList.add("show");
      dom.modalEditar.style.display = "block";
    }
    return true;
  };

  const rowLabelInputId = (field) =>
    `editRowLabel_${field.replace(/[^a-z0-9]/gi, "_")}`;
  const rowLabelAddInputId = (field) =>
    `addRowLabel_${field.replace(/[^a-z0-9]/gi, "_")}`;
  const rowLabelAddCheckId = (field) =>
    `addRowCheck_${field.replace(/[^a-z0-9]/gi, "_")}`;

  function normalizeOperationId(value) {
    return (value || "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toUpperCase();
  }

  function normalizeOperationMatch(value) {
    return (value || "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "")
      .toLowerCase();
  }

  function getOperationId(op) {
    return (
      op?.OperacionId ||
      op?.operacion_id ||
      op?.id ||
      op?.clase ||
      op?.Clase ||
      ""
    );
  }

  function getOperationLabel(op) {
    return (
      op?.Etiqueta ||
      op?.operacion_etiqueta ||
      op?.Clase ||
      op?.clase ||
      op?.OperacionId ||
      ""
    );
  }

  function normalizeOperationKey(value) {
    return normalizeOperationMatch(value || "");
  }

  function findOperationByIdOrLabel(value) {
    if (!value) return null;
    const target = normalizeOperationMatch(value);
    return (
      state.operaciones.find(
        (op) => normalizeOperationMatch(getOperationId(op)) === target,
      ) ||
      state.operaciones.find(
        (op) => normalizeOperationMatch(getOperationLabel(op)) === target,
      )
    );
  }

  function findOperationByIdStrict(value) {
    if (!value) return null;
    const target = normalizeOperationMatch(value);
    if (!target) return null;
    return (
      (state.operaciones || []).find(
        (op) => normalizeOperationMatch(getOperationId(op)) === target,
      ) || null
    );
  }

  function findOperationsByRowLabel(label, preferredField = "") {
    if (!label) return { field: "", operations: [] };
    const target = normalizeOperationMatch(label);
    if (!target) return { field: "", operations: [] };

    const fields = [];
    if (preferredField && ROW_LABEL_FIELDS.includes(preferredField)) {
      fields.push(preferredField);
    }
    ROW_LABEL_FIELDS.forEach((field) => {
      if (!fields.includes(field)) fields.push(field);
    });

    for (const field of fields) {
      const operations = (state.operaciones || []).filter(
        (op) => normalizeOperationMatch(op?.[field]) === target,
      );
      if (operations.length) {
        return { field, operations };
      }
    }

    return { field: "", operations: [] };
  }

  function operationMatchesRowLabel(op, label) {
    if (!op || !label) return false;
    const target = normalizeOperationMatch(label);
    if (!target) return false;
    if (
      ROW_LABEL_FIELDS.some((field) => normalizeOperationMatch(op?.[field]) === target)
    ) {
      return true;
    }
    const hasRowAnchor = ROW_LABEL_FIELDS.some((field) =>
      Boolean((op?.[field] || "").toString().trim()),
    );
    if (!hasRowAnchor) return false;
    const seccionKey = normalizeOperationMatch(op?.SECCION || op?.seccion || "");
    return Boolean(seccionKey && seccionKey === target);
  }

  function getOperationParentCandidates(op) {
    if (!op) return [];
    const candidates = [
      op.parentSection,
      op["SECCIÓN Principal"],
      op["SECCION Principal"],
      op.seccion_principal,
    ];
    if (Array.isArray(op.formula_terms)) {
      op.formula_terms.forEach((term) => {
        if (!term || term.type !== "section") return;
        if (term.parentSection) candidates.push(term.parentSection);
      });
    }
    return candidates.filter(Boolean);
  }

  function getOperationPlacementCandidates(op) {
    if (!op) return [];
    const candidates = [
      op.parentSubsection,
      op.SECCION,
      op.seccion,
      op.parentSection,
    ];
    if (Array.isArray(op.secciones)) {
      candidates.push(...op.secciones);
    }
    if (Array.isArray(op.formula_terms)) {
      op.formula_terms.forEach((term) => {
        if (!term || term.type !== "section") return;
        if (term.value) candidates.push(term.value);
      });
    }
    return candidates.filter(Boolean);
  }

  function operationMatchesParentSectionHint(op, parentSection = "") {
    const parentRaw = (parentSection || "").toString().trim();
    const parentKey = normalizeOperationMatch(parentRaw);
    if (!parentKey) return true;

    const parentByCandidates = getOperationParentCandidates(op).some(
      (candidate) => normalizeOperationMatch(candidate || "") === parentKey,
    );
    if (parentByCandidates) return true;

    const displayKey = normalizeOperationMatch(
      getOperationDisplayName(op) || getOperationLabel(op) || getOperationId(op),
    );
    if (displayKey) {
      if (displayKey.includes(parentKey)) return true;
      const parentTokens = parentRaw
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .split(/[^a-z0-9]+/g)
        .map((token) => normalizeOperationMatch(token))
        .filter((token) => token && token.length >= 3);
      if (parentTokens.some((token) => displayKey.includes(token))) {
        return true;
      }
    }

    const legacyAnchors = [
      op?.["sum-row-sumavarios"],
      op?.["sum-row-sumavarios2"],
      op?.["sum-row-operativo"],
      op?.["result-row"],
      op?.["net-row"],
      op?.["result-net-row"],
      op?.SECCION,
      op?.seccion,
    ];
    return legacyAnchors.some(
      (anchor) => normalizeOperationMatch(anchor || "") === parentKey,
    );
  }

  function getOperationParentMatchScore(op, parentSection = "") {
    const parentKey = normalizeOperationMatch(parentSection || "");
    if (!parentKey || !op) return 0;
    const parentExact = normalizeOperationMatch(op?.parentSection || "");
    if (parentExact && parentExact === parentKey) return 3;
    const parentFromCandidates = getOperationParentCandidates(op).some(
      (candidate) => normalizeOperationMatch(candidate || "") === parentKey,
    );
    if (parentFromCandidates) return 2;
    return operationMatchesParentSectionHint(op, parentSection) ? 1 : 0;
  }

  function isHeaderLinkedOperation(op) {
    if (!op) return false;
    const parentSection = (op.parentSection || "").toString().trim();
    const parentSubsection = (op.parentSubsection || "").toString().trim();
    const hasRowAnchor = ROW_LABEL_FIELDS.some((field) =>
      Boolean((op?.[field] || "").toString().trim()),
    );
    return Boolean(parentSection || parentSubsection || hasRowAnchor);
  }

  function getRowOperationMatch(
    label,
    preferredField = "",
    parentSection = "",
  ) {
    if (!label) return { field: "", operations: [] };
    const target = normalizeOperationMatch(label);
    if (!target) return { field: "", operations: [] };

    const parentKey = normalizeOperationMatch(parentSection);
    const filterByParent = (ops = []) => {
      if (!parentKey) return ops;
      const explicit = ops.filter(
        (op) => getOperationParentMatchScore(op, parentSection) >= 2,
      );
      if (explicit.length) return explicit;
      return ops.filter(
        (op) => getOperationParentMatchScore(op, parentSection) >= 1,
      );
    };

    const rowMatch = findOperationsByRowLabel(label, preferredField);
    const rowMatchOps = filterByParent(rowMatch.operations || []);
    if (rowMatchOps.length) {
      return {
        field: rowMatch.field,
        operations: rowMatchOps,
      };
    }

    // Fallback: buscar por SECCION (ancla de la operación) cuando el label de la fila
    // NO coincide con el label persistido (p.ej. sum-row = "Suma {Sección}").
    const bySeccion = filterByParent(
      (state.operaciones || []).filter((op) => {
        const seccion = (op?.SECCION || op?.seccion || "").toString().trim();
        if (!seccion) return false;
        if (normalizeOperationMatch(seccion) !== target) return false;
        const hasRowAnchor = ROW_LABEL_FIELDS.some((field) =>
          Boolean((op?.[field] || "").toString().trim()),
        );
        if (!hasRowAnchor) return false;
        if (preferredField && ROW_LABEL_FIELDS.includes(preferredField)) {
          return Boolean((op?.[preferredField] || "").toString().trim());
        }
        return true;
      }),
    );
    if (bySeccion.length) {
      if (preferredField && ROW_LABEL_FIELDS.includes(preferredField)) {
        return { field: preferredField, operations: bySeccion };
      }
      const first = bySeccion[0];
      const campoDetectado =
        ROW_LABEL_FIELDS.find((field) =>
          Boolean((first?.[field] || "").toString().trim()),
        ) || "";
      return { field: campoDetectado, operations: bySeccion };
    }

    // Fallback estricto: solo por ID/label de operaciones ligadas a header.
    // Evita capturar operaciones hijas por placement (p.ej. parentSection = INCOME)
    // cuando se edita la fórmula de la sección principal.
    const byIdentity = (state.operaciones || []).filter((op) => {
      // RELAXED CHECK: If user wants full manual control, allow matching by Label even if not strictly "header linked"
      // because sometimes metadata is lost.
      // if (!isHeaderLinkedOperation(op)) return false; 

      const sameId =
        normalizeOperationMatch(getOperationId(op)) === target;
      const sameLabel =
        normalizeOperationMatch(getOperationLabel(op)) === target;

      if (!sameId && !sameLabel) return false;

      // Still respect parent context if provided to avoid cross-section matches for generic names "Total"
      if (parentKey && getOperationParentMatchScore(op, parentSection) < 1) return false;

      return true;
    });
    if (byIdentity.length) {
      return { field: "", operations: byIdentity };
    }

    return { field: "", operations: [] };
  }

  function openAddOperationForRow(
    label,
    parentSection = "",
    preferredField = "sum-row",
  ) {
    if (!requireEditMode()) return;
    const radio = document.querySelector(
      'input[name="tipoElemento"][value="operacion"]',
    );
    if (radio) radio.checked = true;
    updateAddForm();

    const inputClase = document.getElementById("inputClase");
    if (inputClase) inputClase.value = label || "";

    const inputOperacionId = document.getElementById("inputOperacionId");
    if (inputOperacionId && !inputOperacionId.value && label) {
      inputOperacionId.value = normalizeOperationId(label);
    }

    const targetField = preferredField || "sum-row";
    const sumCheck = document.getElementById(rowLabelAddCheckId(targetField));
    const sumInput = document.getElementById(rowLabelAddInputId(targetField));
    if (sumCheck) sumCheck.checked = true;
    if (sumInput && !sumInput.value && label) {
      sumInput.value = label;
    }

    const valueCandidates = [];
    if (parentSection) valueCandidates.push(`${parentSection}||${label}`);
    if (label) valueCandidates.push(label);

    const checkboxes = document.querySelectorAll(
      "#checkboxSecciones input[type='checkbox']",
    );
    checkboxes.forEach((cb) => {
      if (valueCandidates.includes(cb.value)) cb.checked = true;
    });

    new bootstrap.Modal(dom.modalAgregar).show();
  }

  function editRowOperation(label, preferredField = "", parentSection = "") {
    if (!label) return;
    const match = getRowOperationMatch(label, preferredField, parentSection);

    // FIX: If match found multiple operations (likely children via placement match),
    // try to narrow down to the one that exactly matches the label/field.
    if (match.operations.length > 1) {
      const field = match.field || preferredField || "sum-row";
      const exactMatches = match.operations.filter((op) => {
        const val = op[field] || getOperationLabel(op);
        return normalizeOperationMatch(val) === normalizeOperationMatch(label);
      });
      if (exactMatches.length > 0) {
        // We found exactly what we wanted among the candidates
        match.operations = exactMatches;
      }
      // If exactMatches is empty, it means we found children but NO actual section operation.
      // So let match.operations stay > 1? No, then it goes to editConsolidatedLabel and fails.
      // We should force it to empty so it prompts to create.
      else if (exactMatches.length === 0) {
        match.operations = [];
      }
    }

    if (!match.operations.length) {
      const confirmed = window.confirm(
        `No se encontró una operación ligada a "${label}".\n\n¿Deseas crear una nueva operación para esta fila?`,
      );
      if (!confirmed) return;
      openAddOperationForRow(label, parentSection, preferredField);
      return;
    }

    if (match.operations.length > 1) {
      // Modo estricto: no editar "consolidado" (cada fila es única).
      // Abrir la primera coincidencia y advertir para que el usuario elimine duplicados si aplica.
      const sorted = sortOperations(match.operations || []);
      const first = sorted[0] || match.operations[0];
      showToast(
        `Hay ${match.operations.length} operaciones ligadas a "${label}". Edita cada una por separado.`,
        "warning",
      );
      const firstId =
        getOperationId(first) || getOperationDisplayName(first) || label;
      if (window.editOperation) {
        window.editOperation(firstId);
      } else {
        editOperation(firstId);
      }
      return;
    }

    const op = match.operations[0];
    const opId = getOperationId(op) || getOperationDisplayName(op) || label;
    if (window.editOperation) {
      window.editOperation(opId);
    } else {
      editOperation(opId);
    }
  }

  function buildFormulaTermsForRowLabel(label, field) {
    const match = findOperationsByRowLabel(label, field);
    const ops = match.operations || [];
    const resolvedField = match.field || field;
    if (!ops.length) return [];

    const terms = [];
    const seen = new Set();
    let idCounter = Date.now();

    ops.forEach((op) => {
      const section =
        op.SECCION || op.parentSection || op.parentSubsection || op.Clase || "";
      if (!section) return;

      let sign = Number(op.signos?.[resolvedField]);
      if (!Number.isFinite(sign)) {
        sign =
          resolvedField === "sum-row" ? 1 : getOperativoSignForSection(section);
      }
      if (!Number.isFinite(sign) || sign === 0) sign = 1;

      const opParent = (op?.parentSection || "").toString().trim();
      const opSub = (op?.parentSubsection || "").toString().trim();
      const sectionKey = normalizeOperationMatch(section);
      const parentKey = normalizeOperationMatch(opParent);
      const subKey = normalizeOperationMatch(opSub);

      let term = {
        id: idCounter++,
        operator: sign < 0 ? "-" : "+",
        type: "section",
        value: section,
      };

      // Si la operación está ligada a una subsección, conservar el parentSection
      // para que el término se resuelva como subsección (y no como sección principal).
      if (
        opParent &&
        sectionKey &&
        ((opSub && subKey === sectionKey) ||
          (parentKey && parentKey !== sectionKey))
      ) {
        term.parentSection = opParent;
      }

      // En caso de layouts legacy, intentar inferir el parentSection cuando el
      // término representa una subsección ambigua.
      term = (applyParentSectionHints(op, [term]) || [term])[0] || term;

      const dedupeKey = buildFormulaSelectionKey(
        term.type,
        term.value,
        term.parentSection,
      );
      if (!dedupeKey || seen.has(dedupeKey)) return;
      seen.add(dedupeKey);

      terms.push(term);
    });

    return terms;
  }

  function formatOperationReference(value) {
    const op = findOperationByIdOrLabel(value);
    if (!op) return value;
    const label = getOperationLabel(op);
    const id = getOperationId(op);
    if (
      label &&
      id &&
      normalizeOperationMatch(label) !== normalizeOperationMatch(id)
    ) {
      return `${label} (${id})`;
    }
    return label || id || value;
  }

  function buildUniqueOperationId(baseId, currentOp = null) {
    const cleanBase = normalizeOperationId(baseId);
    const used = new Set(
      state.operaciones
        .filter((op) => op !== currentOp)
        .map((op) => normalizeOperationId(getOperationId(op)))
        .filter(Boolean),
    );
    let candidate = cleanBase || "OPERACION";
    let counter = 2;
    while (used.has(candidate)) {
      candidate = `${cleanBase || "OPERACION"}_${counter++}`;
    }
    return candidate;
  }

  function ensureOperationIds() {
    const used = new Set();
    state.operaciones.forEach((op, idx) => {
      const label = getOperationLabel(op);
      let id = getOperationId(op) || normalizeOperationId(label);
      id = normalizeOperationId(id) || `OPERACION_${idx + 1}`;
      let candidate = id;
      let counter = 2;
      while (used.has(candidate)) {
        candidate = `${id}_${counter++}`;
      }
      used.add(candidate);
      op.OperacionId = candidate;
      if (!op.Clase && label) {
        op.Clase = label;
      }
    });
  }

  function resolveOperationId(value) {
    if (!value) return value;
    const target = normalizeOperationMatch(value);
    const byId = state.operaciones.find(
      (op) => normalizeOperationMatch(getOperationId(op)) === target,
    );
    if (byId) return getOperationId(byId);
    const matches = state.operaciones.filter(
      (op) => normalizeOperationMatch(getOperationLabel(op)) === target,
    );
    if (matches.length === 1) return getOperationId(matches[0]);
    return value;
  }
  function sortOperations(list = []) {
    return [...(list || [])]
      .map((op, idx) => ({ op, idx }))
      .sort((a, b) => {
        const orderA = getOperationOrder(a.op, a.idx);
        const orderB = getOperationOrder(b.op, b.idx);
        if (orderA !== orderB) return orderA - orderB;
        const fallbackA = Number.isFinite(Number(a.op?.orden))
          ? Number(a.op.orden)
          : a.idx;
        const fallbackB = Number.isFinite(Number(b.op?.orden))
          ? Number(b.op.orden)
          : b.idx;
        if (fallbackA !== fallbackB) return fallbackA - fallbackB;
        return a.idx - b.idx;
      })
      .map((item) => item.op);
  }

  function normalizePresentationOrders() {
    let changed = false;
    const cuentas = state.cuentas || [];
    if (cuentas.length) {
      const readOrder = (cuenta, fallback) => {
        const raw = cuenta?.orden_presentacion;
        if (raw === null || raw === undefined) {
          const fallbackRaw = cuenta?.orden;
          const parsedFallback = Number(fallbackRaw);
          return Number.isFinite(parsedFallback) ? parsedFallback : fallback;
        }
        if (typeof raw === "string" && raw.trim() === "") {
          const fallbackRaw = cuenta?.orden;
          const parsedFallback = Number(fallbackRaw);
          return Number.isFinite(parsedFallback) ? parsedFallback : fallback;
        }
        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : fallback;
      };

      const ordered = (cuentas || [])
        .map((cuenta, idx) => ({ cuenta, idx }))
        .sort((a, b) => {
          const orderA = readOrder(a.cuenta, a.idx);
          const orderB = readOrder(b.cuenta, b.idx);
          if (orderA !== orderB) return orderA - orderB;
          return a.idx - b.idx;
        });
      ordered.forEach((item, idx) => {
        const cuenta = item.cuenta;
        const raw = cuenta?.orden_presentacion;
        const current =
          raw === null ||
            raw === undefined ||
            (typeof raw === "string" && raw.trim() === "")
            ? null
            : Number(raw);
        if (!Number.isFinite(current)) {
          cuenta.orden_presentacion = idx;
          changed = true;
        }
      });
    }

    const ops = state.operaciones || [];
    if (ops.length) {
      const readOrder = (op, fallback) => {
        const raw = op?.orden_presentacion;
        if (raw === null || raw === undefined) {
          const fallbackRaw = op?.orden;
          const parsedFallback = Number(fallbackRaw);
          return Number.isFinite(parsedFallback) ? parsedFallback : fallback;
        }
        if (typeof raw === "string" && raw.trim() === "") {
          const fallbackRaw = op?.orden;
          const parsedFallback = Number(fallbackRaw);
          return Number.isFinite(parsedFallback) ? parsedFallback : fallback;
        }
        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : fallback;
      };

      const orderedOps = (ops || [])
        .map((op, idx) => ({ op, idx }))
        .sort((a, b) => {
          const orderA = readOrder(a.op, a.idx);
          const orderB = readOrder(b.op, b.idx);
          if (orderA !== orderB) return orderA - orderB;
          return a.idx - b.idx;
        });
      orderedOps.forEach((item, idx) => {
        const op = item.op;
        const raw = op?.orden_presentacion;
        const current =
          raw === null ||
            raw === undefined ||
            (typeof raw === "string" && raw.trim() === "")
            ? null
            : Number(raw);
        if (!Number.isFinite(current)) {
          op.orden_presentacion = idx;
          changed = true;
        }
      });
    }

    if (changed) {
      state.unsavedChanges = true;
      updateButtonStates();
      showToast(
        "Ordenes sin orden_presentacion fueron normalizados. Guarda para aplicar.",
        "info",
      );
    }
  }

  function nextOperationOrder() {
    return getNextGlobalOrder();
  }

  // Detectar tipo de término basado en el valor
  function detectTermType(value) {
    if (!value) return "section";

    // Si es un número, es constante
    if (!isNaN(parseFloat(value)) && isFinite(value)) {
      return "constant";
    }

    // Si parece código de cuenta (tiene guiones o números)
    if (/^\d{3}[-\d]/.test(value)) {
      return "account";
    }

    // Si existe en la lista de operaciones, es operación
    const target = normalizeOperationMatch(value);
    const isOperation = state.operaciones.some((op) => {
      const opId = normalizeOperationMatch(getOperationId(op));
      const opLabel = normalizeOperationMatch(getOperationLabel(op));
      return opId === target || opLabel === target;
    });
    if (isOperation) return "operation";

    // Por defecto, es sección
    return "section";
  }

  function hydrateOperationsFromParents() {
    state.operaciones = state.operaciones.map((op) => {
      if (!op) return op;

      const tokens = extractFormulaTokens(op);
      if (Array.isArray(tokens) && tokens.length > 0) {
        const normalizedTerms = normalizeFormulaTerms(
          convertV2TokensToLegacyTerms(tokens),
        ).map((term) => ({
          ...term,
          type: term.type || detectTermType(term.value),
        }));
        applyStrictFormulaTermsToOperation(op, normalizedTerms, tokens);
        return op;
      }

      // Legacy de emergencia: signos explícitos en seccion_1, seccion_2, etc.
      if (op?.signos && Object.keys(op.signos).length > 0) {
        const terms = [];
        const seccionKeys = Object.keys(op.signos)
          .filter((k) => k.startsWith("seccion_"))
          .sort((a, b) => {
            const numA = parseInt(a.split("_")[1], 10) || 0;
            const numB = parseInt(b.split("_")[1], 10) || 0;
            return numA - numB;
          });

        seccionKeys.forEach((key, i) => {
          const value = op[key];
          if (!value) return;
          terms.push({
            id: Date.now() + i,
            operator: op.signos[key] < 0 ? "-" : "+",
            type: detectTermType(value),
            value,
          });
        });

        if (terms.length > 0) {
          applyStrictFormulaTermsToOperation(op, terms);
        }
      }

      return op;
    });
  }

  // ==========================================
  // RENDERING
  // ==========================================
  function showLayoutView() {
    dom.placeholderView.style.display = "none";
    dom.layoutView.style.display = "flex";
    updateButtonStates();
  }

  function renderLayout() {
    if (!INLINE_ORDER_UI_ENABLED && state.inlineOrderMode) {
      state.inlineOrderMode = false;
    }
    ensureAccountIds(state.cuentas);
    dom.layoutPreview.innerHTML = renderEditableLayout();
    bindLayoutEvents();
    window.updateAvailableElementsFromTable?.("#layoutPreview");
    updateSelectionInfo();
    updateLayoutOrderPanel();
  }

  const PILOT_MODULES = new Set([
    "comites",
    "membresia",
    "eventos",
    "comunicacion",
    "direccion",
    "servmembresia",
    "tic",
    "rh",
    "vpe",
    "finanzas",
    "gastosgenerales",
    "nomina",
    "gtoscorporativos",
    "summary",
    "resumen",
    "presupuestos",
  ]);

  function isModuloPiloto() {
    const key = normalizeOperationMatch(state.modulo);
    return PILOT_MODULES.has(key);
  }

  const COLUMN_CONFIG_ID = "COLUMN_CONFIG";
  const COLUMN_CONFIG_FIELD = "column-config";
  const LAYOUT_CONFIG_ID = "LAYOUT_CONFIG";
  const LAYOUT_CONFIG_FIELD = "layout-config";
  const OPERATIVO_STOP_WORDS = new Set([
    "de",
    "del",
    "la",
    "las",
    "los",
    "y",
    "en",
    "el",
    "al",
    "para",
    "por",
    "con",
    "sin",
  ]);

  function renderEditableLayoutPiloto() {
    const rows = buildPreviewRowsForEditor();
    const inlineOrderHeader = INLINE_ORDER_UI_ENABLED
      ? `
            <div class="template-table-actions">
              <div class="form-check form-switch m-0">
                <input
                  class="form-check-input"
                  type="checkbox"
                  id="toggleInlineOrder"
                  ${state.inlineOrderMode ? "checked" : ""}
                  ${state.editMode === false ? "disabled" : ""}
                />
                <label class="form-check-label small" for="toggleInlineOrder">
                  <i class="bi bi-arrows-move me-1"></i>Ordenar
                </label>
              </div>
            </div>
        `
      : "";
    return `
      <div class="template-pilot">
        ${renderTemplateSummary(rows, [])}
        <div class="card mb-3">
          <div class="card-header d-flex justify-content-between align-items-center flex-wrap gap-2 template-items-sticky">
            <span>Elementos de la plantilla</span>
            <div class="d-flex align-items-center flex-wrap gap-2">
              ${inlineOrderHeader}
            </div>
          </div>
          <div class="card-body">
            ${renderTemplateListView(rows)}
          </div>
        </div>
      </div>
    `;
  }

  function summarizeTemplateRows(rows = []) {
    const summary = {
      sections: 0,
      subsections: 0,
      accounts: 0,
      operations: 0,
    };
    (rows || []).forEach((row) => {
      if (!row) return;
      if (row.type === "principal") summary.sections += 1;
      else if (row.type === "subsection") summary.subsections += 1;
      else if (row.type === "account") summary.accounts += 1;
      else if (row.type === "operation") summary.operations += 1;
    });
    return summary;
  }

  function renderTemplateSummary(rows = [], columns = []) {
    const summary = summarizeTemplateRows(rows);
    const columnCount = Array.isArray(columns) ? columns.length : 0;
    const items = [
      { label: "Secciones", value: summary.sections },
      { label: "Subsecciones", value: summary.subsections, optional: true },
      { label: "Cuentas", value: summary.accounts },
      { label: "Operaciones", value: summary.operations },
    ];
    const visibleItems = items.filter(
      (item) => !item.optional || item.value > 0,
    );

    const orderEnabled = state.inlineOrderMode && state.editMode !== false;
    const note = orderEnabled
      ? "Modo ordenar activo: usa las flechas para mover."
      : "Orden real de aparicion. Click en una fila para editar.";

    return `
      <div class="card template-summary mb-3">
        <div class="card-body">
          <div class="summary-grid">
            ${visibleItems
        .map(
          (item) => `
              <div class="summary-item">
                <span class="summary-label">${escapeHtml(item.label)}</span>
                <span class="summary-value">${item.value}</span>
              </div>
            `,
        )
        .join("")}
          </div>
          <div class="summary-note text-muted small">
            ${note}
          </div>
        </div>
      </div>
    `;
  }

  function buildPreviewRowsForEditor() {
    const appendMissingOperations = (currentRows = []) => {
      // Reverted: user requested full manual control.
      return currentRows;
    };

    // Intentar usar LayoutControls si está disponible (a menos que forzamos orden manual)
    if (
      !MANUAL_ORDER_ONLY &&
      window.LayoutControls &&
      typeof window.LayoutControls._buildPreviewRows === "function"
    ) {
      const layoutData = {
        modulo: state.modulo,
        capitulo: state.capitulo,
        cuentas: state.cuentas || [],
        operaciones: sortOperations(state.operaciones || []),
      };
      try {
        const rows = window.LayoutControls._buildPreviewRows(layoutData) || [];
        if (rows.length > 0) return appendMissingOperations(rows);
      } catch (err) {
        console.warn("No se pudo construir filas desde LayoutControls", err);
      }
    }

    // Orden 100% manual (jerárquico y coherente):
    // - Las secciones (principales) se muestran como bloques contiguos.
    // - Las cuentas/operaciones ligadas solo viven dentro de su sección/subsección.
    // - Los elementos SIN sección quedan a nivel raíz y pueden moverse libremente.
    //
    // Esto evita encabezados repetidos ("sección por cada cuenta") al mezclar elementos.

    const normalizeLabelKey = (value) =>
      (value || "")
        .toString()
        .replace(/\u0000/g, "")
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

    const cuentasRaw = Array.isArray(state.cuentas) ? state.cuentas : [];
    const operacionesRaw = sortOperations(state.operaciones || []).filter(
      (op) => op && !isColumnConfigOperation(op),
    );
    const resumenSectionOpsEmbedded =
      normalizeOperationMatch(state.modulo || "") === "resumen";
    // DEBUG TEMPORAL
    console.error("[DEBUG] buildPreviewRowsForEditor → modulo:", state.modulo, "resumenSectionOpsEmbedded:", resumenSectionOpsEmbedded, "operacionesRaw.length:", operacionesRaw.length, "state.operaciones.length:", (state.operaciones || []).length);

    const placeholderDefs = [];
    const cuentas = [];
    cuentasRaw.forEach((cuenta, idx) => {
      if (!cuenta) return;
      if (isPlaceholderAccount(cuenta)) {
        const principal = (getAccountPrincipalName(cuenta) || "")
          .toString()
          .trim();
        const secundaria = (getAccountSecondaryName(cuenta) || "")
          .toString()
          .trim();
        const hint = Number.isFinite(Number(cuenta.__placeholderOrder))
          ? Number(cuenta.__placeholderOrder)
          : getAccountOrder(cuenta, idx);
        placeholderDefs.push({
          principal,
          secundaria,
          accountId: getAccountRowId(cuenta),
          hint,
          placeholderType: (cuenta.__placeholderType || "")
            .toString()
            .toLowerCase(),
        });
        return;
      }
      cuentas.push({ cuenta, idx });
    });

    const rootItems = [];
    const sectionsMap = new Map();

    const ensureSection = (name) => {
      const clean = (name || "").toString().trim();
      if (!clean) return null;
      const key = normalizeLabelKey(clean);
      if (!key) return null;
      if (!sectionsMap.has(key)) {
        sectionsMap.set(key, {
          key,
          name: clean,
          items: [],
          subsectionMap: new Map(),
          subsectionDefs: new Map(),
          placeholderAccountId: "",
          placeholderHint: null,
        });
      }
      return sectionsMap.get(key);
    };

    const ensureSubsection = (sectionNode, subName) => {
      if (!sectionNode) return null;
      const clean = (subName || "").toString().trim();
      if (!clean) return null;
      const key = normalizeLabelKey(clean);
      if (!key) return null;
      if (!sectionNode.subsectionMap.has(key)) {
        sectionNode.subsectionMap.set(key, {
          key,
          name: clean,
          items: [],
          placeholderAccountId: "",
          placeholderHint: null,
        });
      }
      return sectionNode.subsectionMap.get(key);
    };

    // 1) Registrar definiciones placeholder (secciones/subsecciones vacías).
    placeholderDefs.forEach((def) => {
      const principal = (def.principal || "").toString().trim();
      const secundaria = (def.secundaria || "").toString().trim();
      // En modo 100% manual NO promovemos secundaria->principal.
      // Una subsección sin principal se considera huérfana y se ignora aquí.
      if (!principal) return;
      const sectionNode = ensureSection(principal);
      if (!sectionNode) return;

      // Guardar hint para ordenación de secciones vacías (si no hay items reales).
      if (
        def.placeholderType === "principal" ||
        (!secundaria && !sectionNode.placeholderAccountId)
      ) {
        sectionNode.placeholderAccountId =
          def.accountId || sectionNode.placeholderAccountId;
        if (Number.isFinite(def.hint)) {
          sectionNode.placeholderHint =
            sectionNode.placeholderHint == null
              ? def.hint
              : Math.min(sectionNode.placeholderHint, def.hint);
        }
      }

      if (secundaria) {
        const subNode = ensureSubsection(sectionNode, secundaria);
        if (subNode) {
          subNode.placeholderAccountId =
            def.accountId || subNode.placeholderAccountId;
          if (Number.isFinite(def.hint)) {
            subNode.placeholderHint =
              subNode.placeholderHint == null
                ? def.hint
                : Math.min(subNode.placeholderHint, def.hint);
          }
        }
      }
    });

    // 2) Cuentas reales.
    cuentas.forEach(({ cuenta, idx }) => {
      const principalRaw = (getAccountPrincipalName(cuenta) || "")
        .toString()
        .trim();
      const secundariaRaw = (getAccountSecondaryName(cuenta) || "")
        .toString()
        .trim();
      let principal = principalRaw;
      let secundaria = secundariaRaw;
      if (!principal) {
        // En manual: no permitimos subsección sin principal (se trata como libre).
        secundaria = "";
      }

      const accountRow = {
        type: "account",
        cuenta: cuenta.CUENTA || cuenta.cuenta || "",
        nombre: cuenta.NOMBRE || cuenta.nombre || "",
        label: cuenta.CUENTA || cuenta.cuenta || "",
        parentSection: principal || "",
        parentSubsection: secundaria || "",
        accountId: getAccountRowId(cuenta),
        visible: cuenta.visible !== false,
        __orden: getAccountOrder(cuenta, idx),
      };

      if (!principal) {
        rootItems.push(accountRow);
        return;
      }

      const sectionNode = ensureSection(principal);
      if (!sectionNode) {
        rootItems.push(accountRow);
        return;
      }

      if (secundaria) {
        const subNode = ensureSubsection(sectionNode, secundaria);
        if (subNode) {
          subNode.items.push(accountRow);
        } else {
          sectionNode.items.push(accountRow);
        }
      } else {
        sectionNode.items.push(accountRow);
      }
    });

    const knownPrincipalKeys = new Set(Array.from(sectionsMap.keys()));
    const knownSubsectionKeys = new Set();
    sectionsMap.forEach((sectionNode) => {
      (sectionNode?.subsectionMap || new Map()).forEach((_, subKey) => {
        if (subKey) knownSubsectionKeys.add(subKey);
      });
    });

    // 3.5) Ensure all defined Sections/Subsections from Operations exist in the editor view (Manual mode forced)
    // REVERTED 3.5: User explicitly requested no auto-generated sections. If an operation points to a non-existent section,
    // that operation should either be unlinked or the user must create the section manually.
    /*
    operacionesRaw.forEach((op) => {
       const p = (op.parentSection || op["SECCIÓN Principal"] || op.seccion_principal || op.SECCION || op["sum-row-sumavarios"] || op["sum-row-operativo"] || "").toString().trim();
       const s = (op.parentSubsection || op.subseccion || op.subseccion_principal || "").toString().trim();
       
       if (p) {
           const sectionNode = ensureSection(p);
           if (sectionNode && s) {
               ensureSubsection(sectionNode, s);
           }
       }
    });
    */
    // 3) Operaciones.
    operacionesRaw.forEach((op, idx) => {
      const placementValue = (op.SECCION || op.seccion || "").toString().trim();
      const placementKey = normalizeLabelKey(placementValue);
      const placementLooksLikeHeader =
        Boolean(placementKey) &&
        (knownPrincipalKeys.has(placementKey) ||
          knownSubsectionKeys.has(placementKey));
      // Operaciones de resultados/netos deben mostrarse SIEMPRE en el gestor,
      // sin importar si tienen campos de sección, para que el usuario pueda verlas y eliminarlas.
      // Solo se omiten en RESUMEN las operaciones ligadas a totales de sección (sum-row / sum-row-sumavarios),
      // NO las filas de resultado operativo, neto o consolidado.
      //
      // Identificación: las filas resultado/neto tienen rowStyle/estilo_fila seteados
      // (son filas highlighted), o bien no tienen NINGÚN campo de tipo suma (solo parentSection).
      const hasSumTypeField = ROW_LABEL_FIELDS.some((f) => Boolean(op?.[f]));
      const hasStyleField = Boolean(op?.["rowStyle"] || op?.["estilo_fila"]);
      const isResultNetOperation = hasStyleField || !hasSumTypeField;
      // DEBUG TEMPORAL
      if (resumenSectionOpsEmbedded) {
        console.error("[DEBUG-FILTER] op:", JSON.stringify({
          Clase: op?.Clase,
          OperacionId: op?.OperacionId,
          hasSumTypeField,
          hasStyleField,
          isResultNetOperation,
          isHeaderLinked: isHeaderLinkedOperation(op),
          placementLooksLikeHeader,
        }));
      }
      if (
        resumenSectionOpsEmbedded &&
        !isResultNetOperation &&
        (isHeaderLinkedOperation(op) || placementLooksLikeHeader)
      ) {
        // En RESUMEN, sección/subsección son la operación visible.
        // Estas operaciones se editan desde la fila de sección, no como fila aparte.
        return;
      }
      let principal = (op.parentSection || "").toString().trim();
      let secundaria = (op.parentSubsection || "").toString().trim();
      if (!principal) {
        // En manual: subsección sin principal no aplica; tratar como operación libre.
        secundaria = "";
      }
      const label = getOperationDisplayName(op) || "";
      const opId = getOperationId(op) || label || "";
      if (!label && !opId) return;

      const opRow = {
        type: "operation",
        label,
        opId,
        kind: detectOperationType(op),
        parentSection: principal || "",
        parentSubsection: secundaria || "",
        visible: op.visible !== false,
        __orden: getOperationOrder(op, idx),
      };

      if (!principal) {
        rootItems.push(opRow);
        return;
      }

      const sectionNode = ensureSection(principal);
      if (!sectionNode) {
        rootItems.push(opRow);
        return;
      }

      if (secundaria) {
        const subNode = ensureSubsection(sectionNode, secundaria);
        if (subNode) {
          subNode.items.push(opRow);
        } else {
          sectionNode.items.push(opRow);
        }
      } else {
        sectionNode.items.push(opRow);
      }
    });

    const safeOrder = (value, fallback) => {
      const n = Number(value);
      return Number.isFinite(n) ? n : fallback;
    };

    const sortByOrder = (a, b) => {
      const orderA = safeOrder(a.__orden, 1e9);
      const orderB = safeOrder(b.__orden, 1e9);
      if (orderA !== orderB) return orderA - orderB;
      const labelA = normalizeLabelKey(a.label || a.cuenta || a.opId || "");
      const labelB = normalizeLabelKey(b.label || b.cuenta || b.opId || "");
      if (labelA !== labelB) return labelA.localeCompare(labelB);
      return 0;
    };

    const sectionNodes = Array.from(sectionsMap.values());

    // Orden de secciones: por primera aparición (min orden de items), con fallback a hints placeholder.
    const getSectionOrder = (sectionNode, idx) => {
      const orders = [];
      sectionNode.items.forEach((item) =>
        orders.push(safeOrder(item.__orden, null)),
      );
      sectionNode.subsectionMap.forEach((sub) => {
        sub.items.forEach((item) => orders.push(safeOrder(item.__orden, null)));
      });
      const valid = orders.filter((n) => Number.isFinite(n));
      if (valid.length) return Math.min(...valid);
      if (Number.isFinite(Number(sectionNode.placeholderHint)))
        return Number(sectionNode.placeholderHint);
      return 1e9 + idx;
    };

    // Orden de items sin sección y secciones como bloques raíz por orden.
    const rootBlocks = [];
    rootItems.forEach((item, idx) => {
      rootBlocks.push({
        type: "item",
        order: safeOrder(item.__orden, 1e9 + idx),
        idx,
        item,
      });
    });
    sectionNodes.forEach((sectionNode, idx) => {
      rootBlocks.push({
        type: "section",
        order: getSectionOrder(sectionNode, idx),
        idx,
        sectionNode,
      });
    });
    rootBlocks.sort((a, b) => a.order - b.order || a.idx - b.idx);

    const rows = [];

    rootBlocks.forEach((block) => {
      if (block.type === "item") {
        const item = block.item;
        delete item.__orden;
        rows.push(item);
        return;
      }

      const sectionNode = block.sectionNode;
      rows.push({
        type: "principal",
        label: sectionNode.name,
        visible: true,
        placeholderAccountId: sectionNode.placeholderAccountId || "",
      });

      // Preparar children dentro de la sección: items a nivel sección + bloques de subsección.
      const children = [];
      (sectionNode.items || []).forEach((item, idx) => {
        children.push({
          type: "item",
          order: safeOrder(item.__orden, 1e9 + idx),
          idx,
          item,
        });
      });

      const subsections = Array.from(sectionNode.subsectionMap.values());
      const getSubOrder = (subNode, idx) => {
        const valid = (subNode.items || [])
          .map((it) => safeOrder(it.__orden, null))
          .filter((n) => Number.isFinite(n));
        if (valid.length) return Math.min(...valid);
        if (Number.isFinite(Number(subNode.placeholderHint)))
          return Number(subNode.placeholderHint);
        return 1e9 + idx;
      };
      subsections.forEach((subNode, idx) => {
        children.push({
          type: "subsection",
          order: getSubOrder(subNode, idx),
          idx,
          subNode,
        });
      });

      children.sort((a, b) => a.order - b.order || a.idx - b.idx);

      children.forEach((child) => {
        if (child.type === "item") {
          delete child.item.__orden;
          rows.push(child.item);
          return;
        }

        const subNode = child.subNode;
        rows.push({
          type: "subsection",
          label: subNode.name,
          parentSection: sectionNode.name,
          visible: true,
          placeholderAccountId: subNode.placeholderAccountId || "",
        });

        const subItems = (subNode.items || []).slice().sort(sortByOrder);
        subItems.forEach((item) => {
          delete item.__orden;
          rows.push(item);
        });
      });
    });

    return appendMissingOperations(rows);
  }

  function getColumnConfigForRender() {
    if (Array.isArray(state.columnasConfig) && state.columnasConfig.length) {
      return state.columnasConfig;
    }
    const defaults = buildDefaultColumnConfig();
    state.columnasConfig = defaults;
    state.columnasConfigChanged = false;
    return defaults;
  }

  function renderColumnConfigSection(columns = []) {
    const canEdit = state.editMode !== false;
    const disabledAttr = canEdit ? "" : "disabled";
    const showAdvanced = state.columnConfigAdvanced === true;
    const showOperation =
      showAdvanced && (columns || []).some((col) => col?.operacion);
    const rowsHtml = (columns || [])
      .map(
        (col, idx) => `
          <tr data-col-index="${idx}" class="${col.editable ? "column-editable" : ""
          }">
            <td class="text-muted">${idx + 1}</td>
            ${showAdvanced
            ? `<td><code>${escapeHtml(col.key || "")}</code></td>`
            : ""
          }
            <td>
              <input
                type="text"
                class="form-control form-control-sm"
                value="${escapeHtml(col.label || col.key || "")}"
                data-field="label"
                ${disabledAttr}
              />
            </td>
            ${showOperation
            ? `<td>
              <input
                type="text"
                class="form-control form-control-sm"
                value="${escapeHtml(col.operacion || "")}"
                data-field="operacion"
                ${disabledAttr}
              />
            </td>`
            : ""
          }
            <td class="text-center">
              <input
                type="checkbox"
                class="form-check-input"
                data-field="editable"
                ${col.editable ? "checked" : ""}
                ${disabledAttr}
              />
            </td>
          </tr>
        `,
      )
      .join("");

    const colSpan = 3 + (showAdvanced ? 1 : 0) + (showOperation ? 1 : 0);
    const finalRowsHtml =
      rowsHtml ||
      `<tr><td colspan="${colSpan}" class="text-muted text-center">Sin columnas</td></tr>`;

    return `
      <details class="template-details advanced-config">
        <summary class="template-details-summary">
          <span class="template-details-title">
            <i class="bi bi-gear me-1"></i>
            <strong>Avanzado:</strong> Configuración de columnas
          </span>
          <span class="badge bg-secondary">${columns.length} columnas</span>
        </summary>
        <div class="template-details-body">
          <div class="column-config-actions mb-2">
            <div class="alert alert-sm alert-info mb-0">
              <i class="bi bi-info-circle me-1"></i>
              <strong>Capturable:</strong> Permite escribir valores en esa columna al crear presupuestos.
            </div>
            <div class="form-check form-switch m-0">
              <input
                class="form-check-input"
                type="checkbox"
                id="toggleColumnAdvanced"
                ${showAdvanced ? "checked" : ""}
              />
              <label class="form-check-label small" for="toggleColumnAdvanced">
                Ver avanzado
              </label>
            </div>
          </div>
          <div class="table-responsive">
            <table class="table table-sm table-bordered column-config-table">
              <thead class="table-light">
                <tr>
                  <th>#</th>
                  ${showAdvanced ? "<th>Clave</th>" : ""}
                  <th>Etiqueta</th>
                  ${showOperation ? "<th>Operacion</th>" : ""}
                  <th><i class="bi bi-pencil-square me-1"></i>Capturable</th>
                </tr>
              </thead>
              <tbody>
                ${finalRowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      </details>
    `;
  }

  const OP_KIND_META = {
    "sum-row": { label: "Suma", className: "op-kind-sum" },
    "sum-row-sumavarios": { label: "Total", className: "op-kind-total" },
    "sum-row-sumavarios2": { label: "Resultado", className: "op-kind-result" },
    "sum-row-sumavarios-consolidado": {
      label: "Consolidado",
      className: "op-kind-consolidated",
    },
    "sum-row-operativo": { label: "Operativo", className: "op-kind-operativo" },
    "result-row": { label: "Resultado", className: "op-kind-result" },
    "net-row": { label: "Neto", className: "op-kind-net" },
    "result-net-row": { label: "Neto final", className: "op-kind-net-final" },
  };

  function getOperationKindMeta(kind = "") {
    return OP_KIND_META[kind] || null;
  }

  function isInteractiveRowActionTarget(target) {
    if (!target?.closest) return false;
    return Boolean(
      target.closest(
        "button, a, input, select, textarea, label, [role='button'], .list-item-actions, .inline-op-actions, .account-actions, .section-actions, .inline-order-controls, .inline-order-buttons",
      ),
    );
  }

  function renderInlineOrderCell(row, rowIndex) {
    if (!state.inlineOrderMode || state.editMode === false) return "";
    if (row?.type === "principal" && row?.generated) {
      return `
        <td class="order-cell text-center">
          <span class="text-muted small">Auto</span>
        </td>
      `;
    }

    return `
      <td class="order-cell text-center">
        <div class="inline-order-controls">
          <span class="inline-order-handle" title="Arrastrar para reordenar">⋮⋮</span>
          <button
            type="button"
            class="btn btn-outline-secondary btn-sm inline-order-btn"
            data-action="up"
            title="Subir"
          >
            <i class="bi bi-arrow-up"></i>
          </button>
          <span class="order-index">${rowIndex + 1}</span>
          <button
            type="button"
            class="btn btn-outline-secondary btn-sm inline-order-btn"
            data-action="down"
            title="Bajar"
          >
            <i class="bi bi-arrow-down"></i>
          </button>
        </div>
      </td>
    `;
  }

  /**
   * Renderizar plantilla como lista vertical (una sola columna)
   */
  function renderTemplateListView(rows = []) {
    if (!rows || rows.length === 0) {
      return '<div class="text-muted text-center py-4">Sin elementos para mostrar</div>';
    }

    const showOrder = state.inlineOrderMode && state.editMode !== false;
    const canEdit = state.editMode !== false;
    const disabledAttr = canEdit ? "" : "disabled";
    let html = '<div class="template-list-view">';

    rows.forEach((row, rowIndex) => {
      if (!row) return;
      const isVisible = row.visible !== false;
      const hiddenClass = isVisible ? "" : "opacity-50";

      if (row.type === "principal") {
        const sectionName = row.label || "";
        const sumRowMatch = getRowOperationMatch(sectionName, "sum-row");
        const hasSumRow = sumRowMatch.operations.length > 0;
        const sumRowBtnClass = hasSumRow
          ? "btn-outline-success"
          : "btn-outline-secondary";
        const sumRowBtnTitle = hasSumRow
          ? "Editar fila de suma"
          : "Crear fila de suma";
        const sumRowLabel = hasSumRow
          ? (sumRowMatch.operations[0]?.["sum-row"] || "").toString().trim()
          : "";
        const showSumRowLabel =
          sumRowLabel &&
          normalizeOperationMatch(sumRowLabel) !==
            normalizeOperationMatch(sectionName);
        const sectionOpMatch = getRowOperationMatch(
          sectionName,
          "sum-row-sumavarios",
        );
        const hasSectionOp = sectionOpMatch.operations.length > 0;
        const sectionOpBtnClass = hasSectionOp
          ? "btn-outline-success"
          : "btn-outline-secondary";
        const sectionOpBtnTitle = hasSectionOp
          ? "Editar operación"
          : "Crear operación";
        html += `
          <div class="list-item section-principal ${hiddenClass}" data-row-type="section" data-section="${escapeAttr(sectionName)}" data-row-index="${rowIndex}">
            ${showOrder ? renderInlineOrderButtons(rowIndex, rows.length) : ""}
            <div class="list-item-content d-flex justify-content-between align-items-center flex-grow-1">
              <div class="d-flex align-items-center">
                <i class="bi bi-folder2 me-2 text-primary"></i>
                <strong>${escapeHtml(sectionName || "Sección")}</strong>
                ${showSumRowLabel ? `<span class="ms-2 text-muted small">${escapeHtml(sumRowLabel)}</span>` : ""}
              </div>
              <div class="list-item-actions">
                <button class="btn btn-sm ${sumRowBtnClass}" onclick="event.stopPropagation(); editRowOperation('${escapeAttr(
          sectionName,
        )}', 'sum-row', '')" title="${sumRowBtnTitle}" ${disabledAttr}>
                  Σ
                </button>
                <button class="btn btn-sm ${sectionOpBtnClass}" onclick="event.stopPropagation(); editRowOperation('${escapeAttr(
          sectionName,
        )}', '${escapeAttr(sectionOpMatch.field || "sum-row-sumavarios")}', '')" title="${sectionOpBtnTitle}" ${disabledAttr}>
                  <i class="bi bi-calculator"></i>
                </button>
                <button class="btn btn-sm btn-outline-primary" onclick="event.stopPropagation(); editSection('${escapeAttr(sectionName)}')" title="Editar" ${disabledAttr}>
                  <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation(); deleteSection('${escapeAttr(sectionName)}')" title="Eliminar" ${disabledAttr}>
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </div>
          </div>
        `;
        return;
      }

      if (row.type === "subsection") {
        const subsectionName = row.label || "";
        const parentSection = row.parentSection || "";
        const subsectionOpMatch = getRowOperationMatch(
          subsectionName,
          "",
          parentSection,
        );
        const hasSubsectionOp = subsectionOpMatch.operations.length > 0;
        const subsectionOpBtnClass = hasSubsectionOp
          ? "btn-outline-success"
          : "btn-outline-secondary";
        const subsectionOpBtnTitle = hasSubsectionOp
          ? "Editar operación"
          : "Crear operación";
        const ocultasArr = Array.isArray(state.layoutConfig?.subseccionesOcultas)
          ? state.layoutConfig.subseccionesOcultas
          : [];
        const subVisKey = (parentSection || "").trim().toLowerCase() + "|" + (subsectionName || "").trim().toLowerCase();
        const isSubseccionOculta = ocultasArr.some(
          (k) => (k || "").trim().toLowerCase() === subVisKey,
        );
        const eyeIcon = isSubseccionOculta ? "bi-eye-slash text-secondary" : "bi-eye text-success";
        const eyeTitle = isSubseccionOculta ? "Oculta en Resumen (click para mostrar)" : "Visible en Resumen (click para ocultar)";
        html += `
          <div class="list-item section-secondary ${hiddenClass}" data-row-type="subsection" data-section="${escapeAttr(parentSection)}" data-subsection="${escapeAttr(subsectionName)}" data-parent-section="${escapeAttr(parentSection)}" data-row-index="${rowIndex}">
            ${showOrder ? renderInlineOrderButtons(rowIndex, rows.length) : ""}
            <div class="list-item-content ps-4 d-flex justify-content-between align-items-center flex-grow-1">
              <div class="d-flex align-items-center">
                <i class="bi bi-folder me-2 text-info"></i>
                <em>${escapeHtml(subsectionName || "Subsección")}</em>
              </div>
              <div class="list-item-actions">
                <button class="btn btn-sm ${subsectionOpBtnClass}" onclick="event.stopPropagation(); editRowOperation('${escapeAttr(
          subsectionName,
        )}', '${escapeAttr(subsectionOpMatch.field || "sum-row")}', '${escapeAttr(
          parentSection,
        )}')" title="${subsectionOpBtnTitle}" ${disabledAttr}>
                  <i class="bi bi-calculator"></i>
                </button>
                <button class="btn btn-sm btn-outline-secondary" onclick="event.stopPropagation(); toggleSubseccionVisibility('${escapeAttr(parentSection)}', '${escapeAttr(subsectionName)}')" title="${eyeTitle}" ${disabledAttr}>
                  <i class="bi ${eyeIcon}"></i>
                </button>
                <button class="btn btn-sm btn-outline-primary" onclick="event.stopPropagation(); editSubsection('${escapeAttr(parentSection)}', '${escapeAttr(subsectionName)}')" title="Editar subsección" ${disabledAttr}>
                  <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation(); deleteSubsection('${escapeAttr(parentSection)}', '${escapeAttr(subsectionName)}')" title="Eliminar subsección" ${disabledAttr}>
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </div>
          </div>
        `;
        return;
      }

      if (row.type === "account") {
        const cuenta = row.cuenta || row.label || "";
        const nombre = row.nombre || "";
        const accountId = row.accountId || row.accountID || row.rowId || cuenta;
        const parentSection = row.parentSection || "";
        const parentSubsection = row.parentSubsection || "";
        const depth = parentSection ? (parentSubsection ? 2 : 1) : 0;
        const depthClass = depth ? `depth-${depth}` : "";
        const paddingClass = depth === 2 ? "ps-3" : depth === 1 ? "ps-4" : "";
        // Mostrar indicador cuando la cuenta está directamente bajo una sección sin subsección.
        const noSubBadge = (depth === 1 && canEdit)
          ? `<span class="badge bg-warning text-dark ms-2 opacity-75" style="font-size:0.7em;cursor:pointer" onclick="event.stopPropagation(); editAccount('${escapeAttr(accountId)}')" title="Sin subsección — haz clic en Editar (✎) para asignar una Sección Secundaria">sin subsección</span>`
          : "";
        html += `
          <div class="list-item item-account ${hiddenClass} ${depthClass}" data-row-type="account" data-section="${escapeAttr(parentSection)}" data-subsection="${escapeAttr(parentSubsection)}" data-account-id="${escapeAttr(accountId)}" data-cuenta="${escapeAttr(cuenta)}" data-nombre="${escapeAttr(nombre)}" data-row-index="${rowIndex}">
            ${showOrder ? renderInlineOrderButtons(rowIndex, rows.length) : ""}
            <div class="list-item-content ${paddingClass} d-flex justify-content-between align-items-center flex-grow-1">
              <div class="d-flex align-items-center">
                <span class="badge bg-secondary me-2">${escapeHtml(cuenta)}</span>
                <span>${escapeHtml(nombre || cuenta)}</span>
                ${noSubBadge}
              </div>
              <div class="list-item-actions">
                <button class="btn btn-sm btn-outline-primary" onclick="event.stopPropagation(); editAccount('${escapeAttr(accountId)}')" title="Editar" ${disabledAttr}>
                  <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation(); deleteAccount('${escapeAttr(accountId)}')" title="Eliminar" ${disabledAttr}>
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </div>
          </div>
        `;
        return;
      }

      if (row.type === "operation") {
        // En modo manual, `row.label` puede ser el texto visible (p.ej. "CONSOLIDATED INCOME")
        // que NO coincide con OperacionId/Clase. Usar `row.opId` primero para mantener el vínculo.
        const op = findOperationByIdOrLabel(row.opId || row.label || "");
        const label = op ? getOperationDisplayName(op) : row.label || "";
        const opId = op ? getOperationId(op) : row.opId || "";
        const kind = row.kind || "";
        const kindMeta = getOperationKindMeta(kind);
        // Modo estricto: respetar la fórmula manual tal cual esté guardada.
        // No depender de `formula_terms` porque algunas operaciones legacy guardan
        // la fórmula como texto (`op.formula`) o en `formula_json` no-tokenizado.
        const formula = op ? formatFormula(op) || "" : "";
        const parentSection = (row.parentSection || op?.parentSection || "")
          .toString()
          .trim();
        const parentSubsection = (
          row.parentSubsection ||
          op?.parentSubsection ||
          ""
        )
          .toString()
          .trim();
        const depth = parentSection ? (parentSubsection ? 2 : 1) : 0;
        const depthClass = depth ? `depth-${depth}` : "";
        const paddingClass = depth === 2 ? "ps-3" : depth === 1 ? "ps-4" : "";

        html += `
          <div class="list-item item-operation ${hiddenClass} ${depthClass}" data-row-type="operation" data-operation-id="${escapeAttr(opId || label)}" data-operation-label="${escapeAttr(label)}" data-operation-kind="${escapeAttr(kind)}" data-row-index="${rowIndex}" ${formula ? `title="${escapeAttr(formula)}"` : ""} onclick="window.handleOperationRowClick(event, '${escapeAttr(opId || label)}')">
            ${showOrder ? renderInlineOrderButtons(rowIndex, rows.length) : ""}
            <div class="list-item-content ${paddingClass} d-flex justify-content-between align-items-center flex-grow-1">
              <div>
                <div class="d-flex align-items-center">
                  <i class="bi bi-calculator me-2 text-success"></i>
                  <strong>${escapeHtml(label)}</strong>
                  ${kindMeta ? `<span class="badge ${kindMeta.className} ms-2">${escapeHtml(kindMeta.label)}</span>` : ""}
                </div>
                <div class="operation-formula small text-muted ms-4 mt-1">
                  ${formula ? `= ${escapeHtml(formula)}` : "Sin formula"}
                </div>
              </div>
              <div class="list-item-actions">
                <button class="btn btn-sm btn-outline-primary" onclick="event.stopPropagation(); window.editOperation('${escapeAttr(opId || label)}')" title="Editar" ${disabledAttr}>
                  <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation(); window.deleteOperation('${escapeAttr(opId || label)}')" title="Eliminar" ${disabledAttr}>
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </div>
          </div>
        `;
      }
    });

    html += "</div>";

    // Agregar estilos
    html += `
      <style>
        .template-list-view {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .list-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          background: #fff;
          cursor: pointer;
          transition: all 0.2s;
        }
        .list-item:hover {
          background: #f8f9fa;
          border-color: #cbd5e1;
          transform: translateX(4px);
        }
        .list-item-content {
          flex: 1;
        }
        .section-principal {
          background: #eff6ff;
          border-left: 4px solid #3b82f6;
          font-size: 1.05em;
        }
        .section-secondary {
          background: #f0f9ff;
          border-left: 4px solid #0ea5e9;
          margin-left: 16px;
        }
        .list-item.depth-1 {
          margin-left: 16px;
        }
        .list-item.depth-2 {
          margin-left: 32px;
        }
        .item-account {
          background: #fafafa;
        }
        .item-operation {
          background: #f0fdf4;
          border-left: 3px solid #22c55e;
        }
        .list-item.collapsed-by-section {
          display: none;
        }
        .section-principal.is-collapsed {
          opacity: 0.85;
        }
        .inline-order-buttons {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .inline-order-btn {
          padding: 2px 6px;
          font-size: 0.75rem;
          line-height: 1;
        }
        .inline-order-input {
          width: 56px;
          padding: 2px 4px;
          font-size: 0.75rem;
          line-height: 1;
          text-align: center;
        }
        .list-item-actions {
          display: flex;
          gap: 4px;
          opacity: 0;
          transition: opacity 0.2s;
        }
        .list-item:hover .list-item-actions {
          opacity: 1;
        }
        .list-item-actions .btn {
          padding: 2px 6px;
          font-size: 0.75rem;
        }
      </style>
    `;

    return html;
  }

  function renderInlineOrderButtons(rowIndex, maxRows = null) {
    const maxAttr = Number.isFinite(Number(maxRows))
      ? `max="${Number(maxRows)}"`
      : "";
    return `
      <div class="inline-order-buttons">
        <button type="button" class="btn btn-sm btn-outline-secondary inline-order-btn" data-action="up" data-row-index="${rowIndex}" title="Subir">
          <i class="bi bi-arrow-up"></i>
        </button>
        <input
          type="number"
          inputmode="numeric"
          class="form-control form-control-sm inline-order-input"
          value="${rowIndex + 1}"
          min="1"
          ${maxAttr}
          data-row-index="${rowIndex}"
          title="Mover a posición"
        />
        <button type="button" class="btn btn-sm btn-outline-secondary inline-order-btn" data-action="down" data-row-index="${rowIndex}" title="Bajar">
          <i class="bi bi-arrow-down"></i>
        </button>
      </div>
    `;
  }

  function renderTemplateTable(rows = [], columns = []) {
    const resolvedColumns =
      Array.isArray(columns) && columns.length
        ? columns
        : [
          { key: "cuenta", label: "Cuenta" },
          { key: "descripcion", label: "Descripcion" },
        ];
    const showOrder = state.inlineOrderMode && state.editMode !== false;
    const dataColCount = resolvedColumns.length;
    const colCount = dataColCount + (showOrder ? 1 : 0);
    const headerHtml = `${showOrder
      ? `<th class="order-col"><i class="bi bi-arrows-move"></i></th>`
      : ""
      }${resolvedColumns
        .map((col, idx) => {
          const isEditable = Boolean(col?.editable);
          const label = escapeHtml(col.label || col.key || "");
          const indicator = isEditable
            ? `<span class="editable-indicator" title="Capturable"><i class="bi bi-pencil-fill"></i></span>`
            : "";
          const className = isEditable ? "col-editable" : "";
          return `
          <th data-col-index="${idx}" class="${className}" title="${escapeAttr(
            col.key || "",
          )}" data-col-editable="${isEditable ? "true" : "false"}">
            <span class="col-label">${label}</span>${indicator}
          </th>
        `;
        })
        .join("")}`;

    let bodyHtml = "";
    let currentSection = "";
    let currentSubsection = "";

    rows.forEach((row, rowIndex) => {
      if (!row) return;
      const isVisible = row.visible !== false;
      const hiddenClass = isVisible ? "" : "text-muted";
      if (row.type === "principal") {
        currentSection = row.label || "";
        currentSubsection = "";
        const orderCell = showOrder ? renderInlineOrderCell(row, rowIndex) : "";
        bodyHtml += `
          <tr class="section-header-row ${hiddenClass}" data-row-type="section" data-row-index="${rowIndex}" data-section="${escapeAttr(
          currentSection,
        )}" data-generated="${row.generated ? "true" : "false"}" data-placeholder-account-id="${escapeAttr(
          row.placeholderAccountId || "",
        )}">
            ${orderCell}
            <td colspan="${showOrder ? colCount - 1 : colCount}">
              <strong>${escapeHtml(currentSection || "Seccion")}</strong>
            </td>
          </tr>
        `;
        return;
      }

      if (row.type === "subsection") {
        currentSubsection = row.label || "";
        const orderCell = showOrder ? renderInlineOrderCell(row, rowIndex) : "";
        bodyHtml += `
          <tr class="subsection-row ${hiddenClass}" data-row-type="subsection" data-row-index="${rowIndex}" data-section="${escapeAttr(
          currentSection,
        )}" data-subsection="${escapeAttr(currentSubsection)}" data-placeholder-account-id="${escapeAttr(
          row.placeholderAccountId || "",
        )}">
            ${orderCell}
            <td colspan="${showOrder ? colCount - 1 : colCount}">
              <em>${escapeHtml(currentSubsection || "Subseccion")}</em>
            </td>
          </tr>
        `;
        return;
      }

      if (row.type === "account") {
        // Importante: no depender del "currentSubsection" (puede quedar pegado
        // cuando hay items a nivel seccion DESPUES de una subseccion).
        const parentSection = (row.parentSection || row.section || "")
          .toString()
          .trim();
        const parentSubsection = (row.parentSubsection || row.subsection || "")
          .toString()
          .trim();
        currentSection = parentSection;
        currentSubsection = parentSubsection;
        const cuenta = row.cuenta || row.label || "";
        const nombre = row.nombre || "";
        const accountId = row.accountId || row.accountID || row.rowId || cuenta;
        const cells = [];
        if (showOrder) {
          cells.push(renderInlineOrderCell(row, rowIndex));
        }
        for (let i = 0; i < dataColCount; i += 1) {
          const column = resolvedColumns[i] || {};
          const isEditable = Boolean(column.editable);
          const cellClass = isEditable ? "cell-editable" : "";
          if (i === 0) {
            cells.push(
              `<td class="account-code ${cellClass}">${escapeHtml(cuenta)}</td>`,
            );
          } else if (i === 1) {
            cells.push(
              `<td class="account-name ${cellClass}">${escapeHtml(
                nombre || cuenta,
              )}</td>`,
            );
          } else {
            cells.push(`<td class="${cellClass}"></td>`);
          }
        }
        bodyHtml += `
          <tr class="account-row ${hiddenClass}" data-row-type="account" data-row-index="${rowIndex}" data-account-id="${escapeAttr(
          accountId,
        )}" data-cuenta="${escapeAttr(
          cuenta,
        )}" data-nombre="${escapeAttr(nombre)}" data-section="${escapeAttr(
          parentSection,
        )}" data-subsection="${escapeAttr(parentSubsection)}">
            ${cells.join("")}
          </tr>
        `;
        return;
      }

      if (row.type === "operation") {
        // Igual que en cuentas: fijar el contexto desde la propia fila, no por
        // el último header visto.
        const parentSection = (row.parentSection || row.section || "")
          .toString()
          .trim();
        const parentSubsection = (row.parentSubsection || row.subsection || "")
          .toString()
          .trim();
        currentSection = parentSection;
        currentSubsection = parentSubsection;
        // Ver comentario en la vista de lista: resolver por `opId` primero.
        const op = findOperationByIdOrLabel(row.opId || row.label || "");
        const label = op ? getOperationDisplayName(op) : row.label || "";
        const opId = op ? getOperationId(op) : row.opId || "";
        const kind = row.kind || "";
        const kindMeta = getOperationKindMeta(kind);
        // Modo estricto: respetar la fórmula manual tal cual esté guardada.
        // No depender de `formula_terms` porque algunas operaciones legacy guardan
        // la fórmula como texto (`op.formula`) o en `formula_json` no-tokenizado.
        const formula = op ? formatFormula(op) || "" : "";
        const cells = [];
        if (showOrder) {
          cells.push(renderInlineOrderCell(row, rowIndex));
        }
        for (let i = 0; i < dataColCount; i += 1) {
          const column = resolvedColumns[i] || {};
          const isEditable = Boolean(column.editable);
          const cellClass = isEditable ? "cell-editable" : "";
          if (i === 0) {
            cells.push(`<td class="${cellClass}"></td>`);
          } else if (i === 1) {
            cells.push(
              `<td class="fw-semibold ${cellClass}">
                ${escapeHtml(label)}
                ${kindMeta
                ? `<span class="op-kind-pill ${kindMeta.className}" title="${escapeAttr(
                  kind,
                )}">${escapeHtml(kindMeta.label)}</span>`
                : ""
              }
                <div class="op-formula-preview small text-muted mt-1">
                  ${formula ? `= ${escapeHtml(formula)}` : "Sin formula"}
                </div>
              </td>`,
            );
          } else {
            cells.push(`<td class="${cellClass}"></td>`);
          }
        }
        bodyHtml += `
          <tr class="operation-row ${kind} ${kindMeta?.className || ""} ${hiddenClass}" data-row-type="operation" data-row-index="${rowIndex}" data-operation-id="${escapeAttr(
          opId || label,
        )}" data-operation-label="${escapeAttr(label)}" data-operation-kind="${escapeAttr(
          kind,
        )}" data-section="${escapeAttr(parentSection)}" data-subsection="${escapeAttr(
          parentSubsection,
        )}" ${formula ? `title="${escapeAttr(formula)}"` : ""}>
            ${cells.join("")}
          </tr>
        `;
      }
    });

    if (!bodyHtml) {
      bodyHtml = `
        <tr>
          <td colspan="${colCount}" class="text-muted text-center">
            Sin filas para mostrar
          </td>
        </tr>
      `;
    }

    return `
      <div class="table-responsive">
        <table class="table table-sm table-bordered template-table ${showOrder ? "ordering-mode" : ""
      }">
          <thead class="table-light">
            <tr>${headerHtml}</tr>
          </thead>
          <tbody>
            ${bodyHtml}
          </tbody>
        </table>
      </div>
    `;
  }

  function setOperationEditorTab(tabId) {
    if (!dom.operationEditorPanel || !tabId) return;
    const tabButton = dom.operationEditorPanel.querySelector(
      `[data-bs-target="#${tabId}"]`,
    );
    if (!tabButton || !window.bootstrap?.Tab) return;
    window.bootstrap.Tab.getOrCreateInstance(tabButton).show();
  }

  function buildOperationEditorDataTab({ opId, opLabelInput, op }) {
    const tipoFila = detectOperationType(op || {});
    const formulaPreview = formatFormula(op || {});
    const parentSection = (op?.parentSection || "").toString().trim();
    const parentSubsection = (op?.parentSubsection || "").toString().trim();
    const signoNum = Number(op?.signo);
    const signoInputValue =
      Number.isFinite(signoNum) && signoNum !== 1 ? String(signoNum) : "";

    const normalizeKey = (value) =>
      (value || "")
        .toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();

    const principalNames = Array.from(
      new Set(
        (state.cuentas || [])
          .map((c) => (getAccountPrincipalName(c) || "").toString().trim())
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));

    if (
      parentSection &&
      !principalNames.some(
        (n) => normalizeKey(n) === normalizeKey(parentSection),
      )
    ) {
      principalNames.unshift(parentSection);
    }

    const principalOptions = principalNames
      .map((name) => {
        const selected =
          normalizeKey(name) === normalizeKey(parentSection) ? "selected" : "";
        return `<option value="${escapeAttr(name)}" ${selected}>${escapeHtml(name)}</option>`;
      })
      .join("");

    const subsectionsForParent = Array.from(
      new Set(
        (state.cuentas || [])
          .filter(
            (c) =>
              normalizeKey(getAccountPrincipalName(c) || "") ===
              normalizeKey(parentSection),
          )
          .map((c) => (getAccountSecondaryName(c) || "").toString().trim())
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));

    if (
      parentSubsection &&
      !subsectionsForParent.some(
        (n) => normalizeKey(n) === normalizeKey(parentSubsection),
      )
    ) {
      subsectionsForParent.unshift(parentSubsection);
    }

    const subsectionOptions = subsectionsForParent
      .map((name) => {
        const selected =
          normalizeKey(name) === normalizeKey(parentSubsection)
            ? "selected"
            : "";
        return `<option value="${escapeAttr(name)}" ${selected}>${escapeHtml(name)}</option>`;
      })
      .join("");

    return `
      <div class="alert alert-info alert-sm mb-3">
        <i class="bi bi-info-circle me-2"></i>
        <strong>Modo 100% Manual:</strong> Define nombre e ID manualmente.
      </div>
      <div class="mb-3">
        <label class="form-label">Nombre visible</label>
        <input type="text" class="form-control" id="editClaseOp" 
               value="${escapeHtml(opLabelInput || "")}" 
               placeholder="Ej: Suma Gastos Financieros" />
        <div class="form-text">
          Puedes usar cualquier nombre. Si lo dejas vacío, se conserva el actual.
        </div>
      </div>
      <div class="mb-3">
        <label class="form-label">Ubicación en la plantilla</label>
        <div class="row g-2">
          <div class="col-md-6">
            <label class="form-label small text-muted mb-1">Sección principal</label>
            <select class="form-select" id="editOpParentSection" onchange="window.updateOperationPlacementSubsections && window.updateOperationPlacementSubsections()">
              <option value="">Sin sección (libre)</option>
              ${principalOptions}
            </select>
          </div>
          <div class="col-md-6">
            <label class="form-label small text-muted mb-1">Subsección</label>
            <select class="form-select" id="editOpParentSubsection">
              <option value="">Sin subsección</option>
              ${subsectionOptions}
            </select>
          </div>
        </div>
        <div class="form-text">
          Esto controla dónde aparece la operación. La fórmula se edita en la pestaña <strong>Fórmula</strong>.
        </div>
      </div>
      <div class="mb-3">
        <label class="form-label">Tipo de fila</label>
        <div>
          <span class="badge bg-secondary text-uppercase">${escapeHtml(
      tipoFila,
    )}</span>
        </div>
      </div>
      <div class="mb-3">
        <label class="form-label">Fórmula actual</label>
        <div class="p-2 bg-light border rounded small" style="font-family: 'Courier New', monospace;">
          ${escapeHtml(formulaPreview || "Sin fórmula - Usa la pestaña Fórmula")}
        </div>
      </div>
      <details class="editor-advanced">
        <summary><i class="bi bi-gear me-1"></i> Configuración avanzada</summary>
        <div class="mt-3">
          <label class="form-label">Identificador interno (ID)</label>
          <input type="text" class="form-control" id="editOperacionId" 
                 value="${escapeHtml(opId || "")}" 
                 placeholder="Ej: CDMX_INCOME" />
          <div class="form-text">
            Define un ID único manualmente.
          </div>
        </div>
        <div class="mt-3">
          <label class="form-label">Signo (multiplicador)</label>
          <input type="number" class="form-control" id="editOperacionSigno" step="0.01"
                 value="${escapeAttr(signoInputValue)}"
                 placeholder="-1 o 1" />
          <div class="form-text">
            Multiplica el resultado final de la operación. Ej: <code>-1</code> invierte el signo. Vacío = <code>1</code>.
          </div>
        </div>
      </details>
    `;
  }

  function buildFormulaSelectionKey(type, value, parentSection = "") {
    const normalizedType = (type || "section").toString().toLowerCase();
    let sectionValue = value || "";
    let parent = parentSection || "";
    if (
      !parent &&
      typeof sectionValue === "string" &&
      sectionValue.includes("||")
    ) {
      const parts = sectionValue.split("||");
      if (parts.length >= 2) {
        parent = parts[0]?.trim() || "";
        sectionValue = parts.slice(1).join("||").trim();
      }
    }
    const normalizedValue = normalizeOperationMatch(sectionValue || "");
    const normalizedParent = normalizeOperationMatch(parent || "");
    if (
      (normalizedType === "section" || normalizedType === "seccion") &&
      normalizedParent
    ) {
      return `${normalizedType}::${normalizedParent}||${normalizedValue}`;
    }
    return `${normalizedType}::${normalizedValue}`;
  }

  function buildFormulaSelectionMap(terms = []) {
    const map = new Map();
    (terms || []).forEach((term) => {
      if (!term || !term.value) return;
      const key = buildFormulaSelectionKey(
        term.type,
        term.value,
        term.parentSection,
      );
      if (!key) return;
      map.set(key, term.operator === "-" ? "-" : "+");
    });
    return map;
  }

  function getFormulaRowLabel(row) {
    if (!row) return "";
    if (row.type === "account") {
      const code = row.cuenta || row.label || "";
      const name = row.nombre || "";
      return name ? `${code} ${name}` : code;
    }
    return row.label || row.nombre || "";
  }

  function getFormulaRowType(row) {
    if (!row) return "section";
    if (row.type === "account") return "account";
    if (row.type === "operation") return "operation";
    return "section";
  }

  function getFormulaRowValue(row) {
    if (!row) return "";
    if (row.type === "account") return row.cuenta || row.label || "";
    if (row.type === "operation") return row.opId || row.label || "";
    return row.label || "";
  }

  function getFormulaRowLevel(row) {
    if (!row) return 0;
    if (row.type === "subsection") return 1;
    if (row.type === "account" || row.type === "operation") return 2;
    return 0;
  }

  function buildOperationEditorFormulaTab(op, availableElements) {
    const rows = buildPreviewRowsForEditor();
    const terms = extractFormulaTerms(op);
    const selectionMap = buildFormulaSelectionMap(terms);
    const formulaText = formatFormula(op || {}) || "";
    const initialMode = state.operationEditorFormulaMode || "manual";
    const rowsHtml = rows
      .map((row) => {
        const label = getFormulaRowLabel(row);
        if (!label) return "";
        const type = getFormulaRowType(row);
        const value = getFormulaRowValue(row);
        if (!value) return "";
        const key = buildFormulaSelectionKey(type, value, row.parentSection);
        const operator = selectionMap.get(key) || "none";
        const level = getFormulaRowLevel(row);
        const stateClass =
          operator === "+"
            ? "is-plus"
            : operator === "-"
              ? "is-minus"
              : "is-off";
        const buttonText = operator === "none" ? "" : operator;
        return `
          <div
            class="formula-layout-row level-${level}"
            data-formula-type="${escapeAttr(type)}"
            data-formula-value="${escapeAttr(value)}"
            data-formula-parent-section="${escapeAttr(row.parentSection || "")}"
            data-formula-parent-subsection="${escapeAttr(row.parentSubsection || "")}"
          >
            <button type="button" class="formula-toggle ${stateClass}" data-state="${operator}">
              ${escapeHtml(buttonText)}
            </button>
            <div class="formula-layout-label">
              <span>${escapeHtml(label)}</span>
              ${row.type && row.type !== "account"
            ? `<span class="meta">(${escapeHtml(row.type)})</span>`
            : ""
          }
            </div>
          </div>
        `;
      })
      .join("");

    return `
      <div class="d-flex align-items-center justify-content-between mb-2">
        <label class="form-label fw-bold mb-0">Edición de fórmula</label>
        <div class="btn-group btn-group-sm" role="group" aria-label="Modo de edición">
          <input class="btn-check" type="radio" name="operationFormulaMode" id="formulaModeManual" value="manual" ${initialMode === "manual" ? "checked" : ""
      } />
          <label class="btn btn-outline-primary" for="formulaModeManual">Manual</label>
          <input class="btn-check" type="radio" name="operationFormulaMode" id="formulaModeLayout" value="layout" ${initialMode === "layout" ? "checked" : ""
      } />
          <label class="btn btn-outline-primary" for="formulaModeLayout">Layout</label>
        </div>
      </div>
      <div class="formula-preview-box mb-3" id="operationFormulaPreview"></div>
      <div data-formula-panel="manual" class="${initialMode === "manual" ? "" : "d-none"}">
        <label class="form-label">Fórmula</label>
        <textarea class="form-control font-monospace" id="operationFormulaManual" rows="4" placeholder="Ej: 401-000-000-00 + Membership - Gastos">${escapeHtml(
        formulaText,
      )}</textarea>
        <div class="form-text">Escribe cuentas, secciones u operaciones con +, -, * o /. Usa espacios alrededor del operador para evitar cortar cuentas con guiones.</div>
      </div>
      <div data-formula-panel="layout" class="${initialMode === "layout" ? "" : "d-none"}">
        <div class="alert alert-info small mb-3">
          Selecciona elementos del layout. Click una vez suma (+), otra resta (-), otra limpia.
        </div>
        <div class="formula-layout-toolbar mb-2">
          <button type="button" class="btn btn-outline-secondary btn-sm" data-formula-action="clear">
            <i class="bi bi-eraser me-1"></i>Limpiar selección
          </button>
          <button type="button" class="btn btn-outline-secondary btn-sm" data-formula-action="collapse">
            <i class="bi bi-arrows-collapse me-1"></i>Colapsar todo
          </button>
          <button type="button" class="btn btn-outline-secondary btn-sm" data-formula-action="expand">
            <i class="bi bi-arrows-expand me-1"></i>Expandir todo
          </button>
        </div>
        <div id="operationFormulaLayout" class="formula-layout-list">
          ${rowsHtml || '<div class="text-muted small p-2">Sin elementos.</div>'}
        </div>
      </div>
    `;
  }

  function buildFormulaPreviewText(terms = []) {
    if (!terms.length) return "Sin fórmula";
    return terms
      .map((term, idx) => {
        const operator = term.operator || "+";
        const value = term.value || "";
        if (!value) return "";
        if (idx === 0) return `${operator} ${value}`.trim();
        return `${operator} ${value}`.trim();
      })
      .filter(Boolean)
      .join(" ");
  }

  function collectFormulaTermsFromLayout(panel) {
    if (!panel) return [];
    const rows = panel.querySelectorAll(
      "[data-formula-type][data-formula-value]",
    );
    const terms = [];
    rows.forEach((row, idx) => {
      const btn = row.querySelector(".formula-toggle");
      const state = btn?.dataset.state || "none";
      if (state !== "+" && state !== "-") return;
      const value = row.dataset.formulaValue || "";
      if (!value) return;
      terms.push({
        id: Date.now() + idx,
        operator: state,
        type: row.dataset.formulaType || "section",
        value,
        parentSection: row.dataset.formulaParentSection || "",
        parentSubsection: row.dataset.formulaParentSubsection || "",
      });
    });
    return normalizeFormulaTerms(terms);
  }

  function updateFormulaPreview(panel) {
    if (!panel) return;
    const preview = panel.querySelector("#operationFormulaPreview");
    if (!preview) return;
    const mode =
      panel.querySelector('input[name="operationFormulaMode"]:checked')
        ?.value || "layout";
    let terms = [];
    if (mode === "manual") {
      const raw = panel.querySelector("#operationFormulaManual")?.value || "";
      terms = parseFormulaText(raw);
    } else {
      terms = collectFormulaTermsFromLayout(panel);
    }
    preview.textContent = buildFormulaPreviewText(terms);
  }

  function bindFormulaLayoutInteractions(panel) {
    if (!panel) return;
    const layout = panel.querySelector("#operationFormulaLayout");
    const setToggleState = (btn, next) => {
      if (!btn) return;
      btn.dataset.state = next;
      btn.textContent = next === "none" ? "" : next;
      btn.classList.remove("is-plus", "is-minus", "is-off");
      btn.classList.add(
        next === "+" ? "is-plus" : next === "-" ? "is-minus" : "is-off",
      );
    };
    const applyLayoutCollapsedState = () => {
      if (!layout) return;
      const collapsed = Boolean(state.operationFormulaLayoutCollapsed);
      layout.classList.toggle("is-collapsed", collapsed);
      const collapseBtn = panel.querySelector(
        '[data-formula-action="collapse"]',
      );
      const expandBtn = panel.querySelector('[data-formula-action="expand"]');
      if (collapseBtn) collapseBtn.disabled = collapsed;
      if (expandBtn) expandBtn.disabled = !collapsed;
    };
    if (layout) {
      layout.addEventListener("click", (event) => {
        const btn = event.target.closest(".formula-toggle");
        if (!btn) return;
        const state = btn.dataset.state || "none";
        const next = state === "none" ? "+" : state === "+" ? "-" : "none";
        setToggleState(btn, next);
        updateFormulaPreview(panel);
      });

      const clearBtn = panel.querySelector('[data-formula-action="clear"]');
      if (clearBtn) {
        clearBtn.addEventListener("click", () => {
          layout.querySelectorAll(".formula-toggle").forEach((btn) => {
            setToggleState(btn, "none");
          });
          updateFormulaPreview(panel);
        });
      }

      const collapseBtn = panel.querySelector(
        '[data-formula-action="collapse"]',
      );
      if (collapseBtn) {
        collapseBtn.addEventListener("click", () => {
          state.operationFormulaLayoutCollapsed = true;
          applyLayoutCollapsedState();
        });
      }

      const expandBtn = panel.querySelector('[data-formula-action="expand"]');
      if (expandBtn) {
        expandBtn.addEventListener("click", () => {
          state.operationFormulaLayoutCollapsed = false;
          applyLayoutCollapsedState();
        });
      }

      applyLayoutCollapsedState();
    }

    const manualInput = panel.querySelector("#operationFormulaManual");
    if (manualInput) {
      manualInput.addEventListener("input", () => updateFormulaPreview(panel));
    }

    const modeInputs = panel.querySelectorAll(
      'input[name="operationFormulaMode"]',
    );
    modeInputs.forEach((input) => {
      input.addEventListener("change", () => {
        state.operationEditorFormulaMode = input.value;
        const manualPanel = panel.querySelector(
          '[data-formula-panel="manual"]',
        );
        const layoutPanel = panel.querySelector(
          '[data-formula-panel="layout"]',
        );
        if (manualPanel && layoutPanel) {
          if (input.value === "manual") {
            manualPanel.classList.remove("d-none");
            layoutPanel.classList.add("d-none");
          } else {
            layoutPanel.classList.remove("d-none");
            manualPanel.classList.add("d-none");
            applyLayoutCollapsedState();
          }
        }
        updateFormulaPreview(panel);
      });
    });

    updateFormulaPreview(panel);
  }

  function buildOperationEditorAparicionTab(op, rowLabelsHtml) {
    const visibleChecked = op?.visible !== false ? "checked" : "";
    const tipoSeleccionado = resolveOperationAparicionType(op);
    const tipoTooltip = getAparicionTooltip(tipoSeleccionado);
    const tipoOptions = buildAparicionOptions(tipoSeleccionado);

    // Estilos visuales de fila - EXPANDIDOS CON MÁS OPCIONES
    const estiloActual = op?.rowStyle || op?.estilo_fila || "sum-row";
    const estilosDisponibles = [
      // Estilos básicos
      {
        value: "sum-row",
        label: "Suma Simple",
        class: "sum-row fw-semibold",
        desc: "Fila de suma básica",
      },
      {
        value: "operation-row",
        label: "Operación Libre",
        class: "operation-row free-operation-row fw-semibold",
        desc: "Operación personalizada",
      },
      {
        value: "subsection-row",
        label: "Subsección",
        class: "subsection-row bg-light fw-semibold",
        desc: "Encabezado de subsección",
      },

      // Estilos principales (para totales importantes)
      {
        value: "sum-row-principal",
        label: "Suma Principal",
        class: "sum-row-principal fw-bold",
        desc: "Sección principal (INCOME, EXPENSES)",
      },
      {
        value: "highlight-primary",
        label: "Consolidado Primario",
        class: "highlight-primary fw-bold text-uppercase",
        desc: "CONSOLIDATED INCOME/EXPENSES",
      },
      {
        value: "highlight-secondary",
        label: "Resultado Operativo",
        class: "highlight-secondary fw-bold",
        desc: "OPERATING RESULTS",
      },
      {
        value: "highlight-bright",
        label: "Resultado Neto",
        class: "highlight-bright text-white fw-bold",
        desc: "NET RESULTS (máxima jerarquía)",
      },

      // Nuevos estilos - CON MÁS DISEÑOS
      {
        value: "sum-row-success",
        label: "Suma Verde (Positivo)",
        class: "sum-row table-success fw-semibold",
        desc: "Para resultados positivos/ingresos",
      },
      {
        value: "sum-row-danger",
        label: "Suma Roja (Negativo)",
        class: "sum-row table-danger fw-semibold",
        desc: "Para gastos/egresos importantes",
      },
      {
        value: "sum-row-warning",
        label: "Suma Amarilla (Alerta)",
        class: "sum-row table-warning fw-semibold",
        desc: "Para indicadores de atención",
      },
      {
        value: "sum-row-info",
        label: "Suma Azul (Info)",
        class: "sum-row table-info fw-semibold",
        desc: "Para información adicional",
      },

      // Estilos con bordes
      {
        value: "border-top-bold",
        label: "Borde Superior",
        class: "sum-row fw-semibold border-top border-dark border-3",
        desc: "Con línea superior gruesa",
      },
      {
        value: "border-bottom-bold",
        label: "Borde Inferior",
        class: "sum-row fw-semibold border-bottom border-dark border-3",
        desc: "Con línea inferior gruesa",
      },
    ];

    const estiloOptionsHtml = estilosDisponibles
      .map((estilo, idx) => {
        const selected = estilo.value === estiloActual ? "selected" : "";
        return `<option value="${escapeAttr(estilo.value)}" ${selected} data-class="${escapeAttr(estilo.class)}" data-style="${escapeAttr(estilo.style || "")}">${escapeHtml(estilo.label)} - ${escapeHtml(estilo.desc)}</option>`;
      })
      .join("");

    const previewStyle = estilosDisponibles.find(
      (e) => e.value === estiloActual,
    );
    const previewClass = previewStyle?.class || "sum-row fw-semibold";
    const previewInlineStyle = previewStyle?.style || "";

    return `
      <div class="mb-3">
        <label class="form-label d-flex align-items-center gap-2">
          <i class="bi bi-palette me-1"></i>
          Diseño Visual de la Fila
        </label>
        <select class="form-select" id="editOperacionEstilo">
          ${estiloOptionsHtml}
        </select>
        <div class="form-text">
          Define cómo se verá esta operación en el RESUMEN.
        </div>
        <div id="estiloPreview" class="mt-2 p-2 border rounded" style="min-height: 40px;">
          <div class="text-center ${escapeAttr(estilosDisponibles.find((e) => e.value === estiloActual)?.class || "sum-row fw-semibold")}">
            Vista previa del estilo
          </div>
        </div>
      </div>
      
      <div class="mb-3">
        <label class="form-label d-flex align-items-center gap-2">
          Tipo de fila
          <i class="bi bi-info-circle text-muted" data-aparicion-help="true" title="${escapeAttr(
      tipoTooltip,
    )}"></i>
        </label>
        <select class="form-select" id="editOperacionTipo" data-aparicion-select="true" data-initial-tipo="${escapeAttr(
      tipoSeleccionado,
    )}" title="${escapeAttr(tipoTooltip)}">
          ${tipoOptions}
        </select>
        <div class="form-text">
          Define dónde aparece en la plantilla (posición lógica).
        </div>
      </div>
      <div class="mb-3">
        <label class="form-label">Etiquetas en la tabla</label>
        <div class="row g-2">
          ${rowLabelsHtml}
        </div>
        <div class="form-text">
          Define en qué columnas específicas aparece.
        </div>
      </div>
      <div class="form-check form-switch">
        <input class="form-check-input" type="checkbox" id="editOperacionVisible" ${visibleChecked} />
        <label class="form-check-label" for="editOperacionVisible">
          Visible en la plantilla
        </label>
      </div>
    `;
  }

  function normalizeContributionKey(type, value) {
    return `${type}::${normalizeOperationMatch(value || "")}`;
  }

  function buildContributionSelectionMap(terms = []) {
    const map = new Map();
    (terms || []).forEach((term) => {
      if (!term || !term.value) return;
      if (term.type !== "section" && term.type !== "operation") return;
      const key = normalizeContributionKey(term.type, term.value);
      if (!map.has(key)) {
        map.set(key, term.operator || "+");
      }
    });
    return map;
  }

  function getRealOperationOptions(operations = []) {
    const realKeys = new Set();
    (state.operaciones || []).forEach((op) => {
      const opId = normalizeOperationMatch(getOperationId(op));
      const opLabel = normalizeOperationMatch(getOperationLabel(op));
      if (opId) realKeys.add(opId);
      if (opLabel) realKeys.add(opLabel);
    });

    return (operations || []).filter((op) => {
      const opId = normalizeOperationMatch(op?.id || "");
      const opLabel = normalizeOperationMatch(op?.label || "");
      return (opId && realKeys.has(opId)) || (opLabel && realKeys.has(opLabel));
    });
  }

  function renderContributionList(container, items, type, selectionMap) {
    if (!container) return;
    if (!items.length) {
      container.innerHTML =
        '<div class="text-muted small p-2">Sin elementos</div>';
      return;
    }

    const html = items
      .map((item) => {
        const value = type === "section" ? item : item.id || item.label || "";
        const label = type === "section" ? item : item.label || item.id || "";
        const key = normalizeContributionKey(type, value);
        const altKey = normalizeContributionKey(type, label);
        const operator =
          selectionMap.get(key) || selectionMap.get(altKey) || "+";
        const checked = selectionMap.has(key) || selectionMap.has(altKey);
        const searchKey = normalizeOperationMatch(label || value);
        return `
          <label class="contrib-item" data-type="${escapeAttr(
          type,
        )}" data-value="${escapeAttr(value)}" data-search="${escapeAttr(
          searchKey,
        )}">
            <input class="form-check-input contrib-check" type="checkbox" ${checked ? "checked" : ""
          } />
            <select class="form-select form-select-sm contrib-operator">
              <option value="+" ${operator === "+" ? "selected" : ""}>+</option>
              <option value="-" ${operator === "-" ? "selected" : ""}>-</option>
            </select>
            <span class="contrib-label">${escapeHtml(label || value)}</span>
          </label>
        `;
      })
      .join("");

    container.innerHTML = html;
  }

  function applyContributionFilter(panel, query) {
    if (!panel) return;
    const normalized = normalizeOperationMatch(query || "");
    panel.querySelectorAll(".contrib-item").forEach((item) => {
      const haystack = item.dataset.search || "";
      const visible = !normalized || haystack.includes(normalized);
      item.classList.toggle("d-none", !visible);
    });
  }

  function collectContributionTerms(panel) {
    const terms = [];
    if (!panel) return terms;
    panel.querySelectorAll(".contrib-item").forEach((item) => {
      const checkbox = item.querySelector(".contrib-check");
      if (!checkbox || !checkbox.checked) return;
      const type = item.dataset.type || "section";
      const value = item.dataset.value || "";
      const operator =
        item.querySelector(".contrib-operator")?.value?.trim() || "+";
      if (!value) return;
      terms.push({
        id: Date.now() + terms.length,
        operator,
        type,
        value,
      });
    });
    return terms;
  }

  function mergeContributionTerms(existing = [], additions = []) {
    const merged = (existing || []).map((term) => ({ ...term }));
    const indexMap = new Map();
    merged.forEach((term, idx) => {
      const key = normalizeContributionKey(term.type, term.value);
      if (term?.type && term?.value) {
        indexMap.set(key, idx);
      }
    });

    (additions || []).forEach((term) => {
      const key = normalizeContributionKey(term.type, term.value);
      if (indexMap.has(key)) {
        merged[indexMap.get(key)].operator = term.operator;
        return;
      }
      merged.push({ ...term });
      indexMap.set(key, merged.length - 1);
    });

    return merged;
  }

  function setFormulaMode(panel, mode) {
    if (!panel) return;
    const contribPanel = panel.querySelector('[data-formula-panel="contrib"]');
    const manualPanel = panel.querySelector('[data-formula-panel="manual"]');
    if (!contribPanel || !manualPanel) return;
    if (mode === "manual") {
      contribPanel.classList.add("d-none");
      manualPanel.classList.remove("d-none");
    } else {
      contribPanel.classList.remove("d-none");
      manualPanel.classList.add("d-none");
    }
  }

  function updateContributionPanel(availableElements, terms) {
    if (!dom.operationEditorPanel) return;
    const selectionMap = buildContributionSelectionMap(terms);
    const sections = Array.isArray(availableElements?.sections)
      ? availableElements.sections
      : [];
    const operations = getRealOperationOptions(
      availableElements?.operations || [],
    );
    renderContributionList(
      dom.operationEditorPanel.querySelector("#contribSections"),
      sections,
      "section",
      selectionMap,
    );
    renderContributionList(
      dom.operationEditorPanel.querySelector("#contribOperations"),
      operations,
      "operation",
      selectionMap,
    );

    // Actualizar contadores
    updateContributionCounters(dom.operationEditorPanel);
  }

  function updateContributionCounters(panel) {
    if (!panel) return;
    const sectionsChecked = panel.querySelectorAll(
      "#contribSections .contrib-check:checked",
    ).length;
    const operationsChecked = panel.querySelectorAll(
      "#contribOperations .contrib-check:checked",
    ).length;

    const sectionsCounter = panel.querySelector("#contribSectionsCount");
    const operationsCounter = panel.querySelector("#contribOperationsCount");

    if (sectionsCounter) sectionsCounter.textContent = sectionsChecked;
    if (operationsCounter) operationsCounter.textContent = operationsChecked;
  }

  function applyContributionTerms(mode = "replace") {
    if (!dom.operationEditorPanel) return;
    const contribPanel = dom.operationEditorPanel.querySelector(
      '[data-formula-panel="contrib"]',
    );
    const terms = collectContributionTerms(contribPanel);
    if (!terms.length) {
      showToast("Selecciona al menos una contribucion", "warning");
      return;
    }

    let finalTerms = terms;
    if (mode === "merge" && window.FormulaBuilder?.terms?.length) {
      finalTerms = mergeContributionTerms(window.FormulaBuilder.terms, terms);
    }

    if (window.FormulaBuilder) {
      window.FormulaBuilder.terms = finalTerms;
      window.FormulaBuilder.render();
    } else {
      formulaTerms = finalTerms;
      renderFormulaTerms();
    }
    showToast("Formula actualizada", "success");
  }

  function openOperationEditorPanel(op, availableElements) {
    if (!dom.operationEditorPanel) return false;
    const opId = getOperationId(op);
    const opLabelInput =
      getOperationLabel(op) || getOperationDisplayName(op) || "";
    const tipoSeleccionado = resolveOperationAparicionType(op);
    const tipoTooltip = getAparicionTooltip(tipoSeleccionado);
    const tipoOptions = buildAparicionOptions(tipoSeleccionado);
    if (!state.operationEditorFormulaMode) {
      state.operationEditorFormulaMode = "manual";
    }
    formulaTerms = extractFormulaTerms(op) || [];
    const rowLabelsHtml = OP_ROW_FIELDS.map((row) => {
      const tooltipAttr = row.tooltip
        ? ` title="${escapeAttr(row.tooltip)}"`
        : "";
      return `
        <div class="col-md-6">
          <label class="form-label small text-muted"${tooltipAttr}>${row.label}</label>
          <input type="text" class="form-control" id="${rowLabelInputId(
        row.field,
      )}" value="${escapeHtml(op[row.field] || "")}" placeholder="${row.placeholder
        }"${tooltipAttr} />
        </div>
      `;
    }).join("");

    if (dom.operationEditorTitle) {
      dom.operationEditorTitle.textContent = `Operacion: ${getOperationDisplayName(
        op,
      )}`;
    }
    if (dom.operationEditorSubtitle) {
      dom.operationEditorSubtitle.textContent = op.SECCION
        ? `Seccion: ${op.SECCION}`
        : "";
    }

    if (dom.editorTabDatos) {
      dom.editorTabDatos.innerHTML = buildOperationEditorDataTab({
        opId,
        opLabelInput,
        op,
      });
      // Asegurar estado inicial de los selects de ubicación (subsección deshabilitada si no hay sección).
      try {
        window.updateOperationPlacementSubsections?.();
      } catch (_) {
        /* ignore */
      }
    }
    if (dom.editorTabFormula) {
      dom.editorTabFormula.innerHTML = buildOperationEditorFormulaTab(
        op,
        availableElements,
      );
    }
    if (dom.editorTabAparicion) {
      dom.editorTabAparicion.innerHTML = buildOperationEditorAparicionTab(
        op,
        rowLabelsHtml,
      );
      initAparicionSelect(dom.editorTabAparicion);
    }

    bindFormulaLayoutInteractions(dom.operationEditorPanel);
    setOperationEditorTab("editorTabFormula");

    // Abrir panel lateral usando Bootstrap Offcanvas
    let panelShown = false;
    if (window.bootstrap?.Offcanvas) {
      try {
        const offcanvas = window.bootstrap.Offcanvas.getOrCreateInstance(
          dom.operationEditorPanel,
        );
        offcanvas.show();
        panelShown = true;
        console.log("✅ Panel lateral abierto con Bootstrap Offcanvas");
      } catch (error) {
        console.error("❌ Error al abrir panel con Bootstrap:", error);
        panelShown = false;
      }
    }

    // Fallback manual si Bootstrap no está disponible
    if (!panelShown) {
      console.warn(
        "⚠️ Bootstrap Offcanvas no disponible, usando fallback manual",
      );
      panelShown = openOffcanvasFallback(dom.operationEditorPanel);
      if (panelShown) {
        console.log("✅ Panel lateral abierto con fallback manual");
      } else {
        console.error("❌ No se pudo abrir el panel lateral");
      }
    }

    return panelShown;
  }

  function bindTemplateTableEvents() {
    const isPiloto = isModuloPiloto();
    const inlineToggle = dom.layoutPreview?.querySelector("#toggleInlineOrder");
    if (isPiloto && INLINE_ORDER_UI_ENABLED) {
      inlineToggle?.addEventListener("change", (event) => {
        state.inlineOrderMode = Boolean(event.target.checked);
        renderLayout();
      });
    }

    // Manejar clicks en la vista de lista
    const listView = dom.layoutPreview?.querySelector(".template-list-view");
    const table = dom.layoutPreview?.querySelector(".template-table");
    const container = listView || table;

    if (!container) return;

    container.addEventListener("click", (event) => {
      const orderButton = event.target.closest(".inline-order-btn");
      if (orderButton) {
        event.preventDefault();
        event.stopPropagation();
        if (!state.inlineOrderMode || state.editMode === false) return;
        const item = orderButton.closest("[data-row-type]");
        if (!item) return;
        const direction = orderButton.dataset.action === "up" ? -1 : 1;
        handleInlineOrderMove(item, direction);
        return;
      }

      if (isInteractiveRowActionTarget(event.target)) {
        return;
      }

      const item = event.target.closest("[data-row-type]");
      if (!item) return;
      const rowType = item.dataset.rowType;

      if (rowType === "account") {
        const accountId = item.dataset.accountId || item.dataset.cuenta;
        if (accountId) {
          editAccount(accountId);
        }
        return;
      }

      if (rowType === "operation") {
        const rawLabel = item.dataset.operationLabel || "";
        const rawId = item.dataset.operationId || "";
        const label = rawLabel || rawId;
        if (!label) return;

        const direct = findOperationByIdOrLabel(label);
        if (direct) {
          editOperation(getOperationId(direct) || label);
          return;
        }

        const kind = item.dataset.operationKind || "";
        const match = findOperationsByRowLabel(label, kind);
        if (match.operations.length === 1) {
          editOperation(getOperationId(match.operations[0]) || label);
          return;
        }
        if (match.operations.length > 1) {
          // Modo estricto: no consolidar. Abrir la primera coincidencia.
          const sorted = sortOperations(match.operations || []);
          const first = sorted[0] || match.operations[0];
          showToast(
            `Hay ${match.operations.length} operaciones para "${label}". Edita cada una por separado.`,
            "warning",
          );
          editOperation(getOperationId(first) || label);
          return;
        }

        showToast("Operacion no encontrada", "warning");
        return;
      }

      if (rowType === "section") {
        if (item.dataset.generated === "true") return;
        const section = item.dataset.section;
        if (section) {
          if (state.editMode === false) {
            showToast(
              "Activa el modo edición para modificar secciones",
              "warning",
            );
            return;
          }
          window.editSection(section);
        }
        return;
      }

      if (rowType === "subsection") {
        const section = item.dataset.section || item.dataset.parentSection;
        const subsection = item.dataset.subsection;
        if (section && subsection) {
          if (state.editMode === false) {
            showToast(
              "Activa el modo edición para modificar subsecciones",
              "warning",
            );
            return;
          }
          window.editSubsection(section, subsection);
        }
      }
    });

    const applyInlineOrderJump = (input) => {
      if (!input) return;
      if (!state.inlineOrderMode || state.editMode === false) return;

      const currentIndex = Number(input.dataset.rowIndex);
      if (!Number.isInteger(currentIndex)) return;

      const allRows = getTemplateRowsForReorder();
      if (!allRows.length) return;

      const desiredRaw = Number(input.value);
      if (!Number.isFinite(desiredRaw)) return;
      const desired = Math.min(
        Math.max(Math.floor(desiredRaw), 1),
        allRows.length,
      );
      if (desired !== desiredRaw) {
        input.value = String(desired);
      }
      const targetIndex = desired - 1;
      if (targetIndex === currentIndex) return;

      moveTemplateRowOrderToIndex(currentIndex, targetIndex);
    };

    container.addEventListener("keydown", (event) => {
      const input = event.target?.closest?.(".inline-order-input");
      if (!input) return;
      if (event.key !== "Enter") return;
      event.preventDefault();
      event.stopPropagation();
      input.dataset.skipBlur = "1";
      applyInlineOrderJump(input);
    });

    container.addEventListener(
      "blur",
      (event) => {
        const input = event.target?.closest?.(".inline-order-input");
        if (!input) return;
        if (input.dataset.skipBlur === "1") {
          delete input.dataset.skipBlur;
          return;
        }
        applyInlineOrderJump(input);
      },
      true,
    );
  }

  // ==========================================
  // FUNCIONES DE EDICIÓN DE FILAS
  // ==========================================

  /**
   * Editar una cuenta
   */
  function editAccount(cuentaId) {
    if (!cuentaId) return;

    // Buscar la cuenta en el estado (permitir duplicados usando rowId)
    const cuenta = resolveAccountByIdOrCode(cuentaId);

    if (!cuenta) {
      showToast("Cuenta no encontrada", "warning");
      return;
    }
    const accountId = getAccountRowId(cuenta);
    const codigoCuenta = cuenta.CUENTA || cuenta.cuenta || cuentaId;
    state.selectedElement = {
      type: "account",
      cuenta,
      accountId,
      codigo: codigoCuenta,
    };
    updateSelectionInfo();

    // Abrir editor usando el panel existente
    if (!dom.operationEditorPanel) {
      showToast("Panel de edición no disponible", "error");
      return;
    }

    // Configurar título del editor
    if (dom.operationEditorTitle) {
      dom.operationEditorTitle.textContent = "Editar Cuenta";
    }
    if (dom.operationEditorSubtitle) {
      dom.operationEditorSubtitle.textContent = `Cuenta: ${codigoCuenta}`;
    }

    // Renderizar formulario de cuenta en la pestaña de datos
    if (dom.editorTabDatos) {
      dom.editorTabDatos.innerHTML = `
        <div class="mb-3">
          <label class="form-label">Cuenta</label>
          <input type="text" class="form-control" id="editCuenta" value="${escapeHtml(codigoCuenta || "")}" readonly />
        </div>
        <div class="mb-3">
          <label class="form-label">Nombre</label>
          <input type="text" class="form-control" id="editNombre" value="${escapeHtml(cuenta.NOMBRE || cuenta.nombre || "")}" />
        </div>
        <div class="mb-3">
          <label class="form-label">Sección Principal</label>
          <input type="text" class="form-control" id="editSeccionPrincipal" value="${escapeHtml(getAccountPrincipalName(cuenta) || "")}" />
        </div>
        <div class="mb-3">
          <label class="form-label">Sección Secundaria</label>
          ${(() => {
          const currentPrincipal = getAccountPrincipalName(cuenta) || "";
          const currentSecundaria = getAccountSecondaryName(cuenta) || "";
          const availableSubs = getManualSubsectionNames(currentPrincipal);
          if (availableSubs.length) {
            const options = [`<option value="">— Sin subsección —</option>`];
            availableSubs.forEach((sub) => {
              options.push(`<option value="${escapeAttr(sub)}"${sub === currentSecundaria ? " selected" : ""}>${escapeHtml(sub)}</option>`);
            });
            return `<select class="form-select" id="editSeccionSecundaria">${options.join("")}</select>
                      <div class="form-text">Selecciona la subsección de esta cuenta o deja vacío.</div>`;
          }
          return `<input type="text" class="form-control" id="editSeccionSecundaria" value="${escapeAttr(currentSecundaria)}" placeholder="Nombre de subsección" />`;
        })()}
        </div>
        <div class="mb-3">
          <label class="form-label">Signo/Factor</label>
          <input type="number" step="any" class="form-control" id="editFactor" value="${escapeHtml(
          Number.isFinite(Number(cuenta.operacion_factor))
            ? String(Number(cuenta.operacion_factor))
            : "1",
        )}" />
        </div>
        <div class="mb-3">
          <label class="form-label">Valor plantilla</label>
          <input type="number" step="any" class="form-control" id="editValorPlantilla" value="${escapeHtml(
          Number.isFinite(Number(cuenta.valor_plantilla))
            ? String(Number(cuenta.valor_plantilla))
            : "0",
        )}" />
          <div class="form-text">Solo gestor/preview.</div>
        </div>
        <div class="mb-3">
          <div class="form-check">
            <input class="form-check-input" type="checkbox" id="editVisible" ${cuenta.visible !== false ? "checked" : ""} />
            <label class="form-check-label" for="editVisible">Visible</label>
          </div>
        </div>
      `;
    }

    // Limpiar otras pestañas
    if (dom.editorTabFormula)
      dom.editorTabFormula.innerHTML =
        '<p class="text-muted">No aplica para cuentas</p>';
    if (dom.editorTabAparicion)
      dom.editorTabAparicion.innerHTML =
        '<p class="text-muted">No aplica para cuentas</p>';

    // Configurar botón de guardar
    if (dom.btnEditorSave) {
      const saveHandler = () => {
        const nombre = document.getElementById("editNombre")?.value || "";
        const seccionPrincipal =
          document.getElementById("editSeccionPrincipal")?.value || "";
        const seccionSecundaria =
          document.getElementById("editSeccionSecundaria")?.value || "";
        const factorRaw = document.getElementById("editFactor")?.value || "";
        const valorPlantillaRaw =
          document.getElementById("editValorPlantilla")?.value || "";
        const visible = document.getElementById("editVisible")?.checked;

        // Capturar valores previos para detectar subsecciones huérfanas
        const oldSeccionPrincipal = getAccountPrincipalName(cuenta) || "";
        const oldSeccionSecundaria = getAccountSecondaryName(cuenta) || "";

        // Actualizar cuenta
        if (cuenta.NOMBRE !== undefined) cuenta.NOMBRE = nombre;
        if (cuenta.nombre !== undefined) cuenta.nombre = nombre;
        if (cuenta["SECCION PRINCIPAL"] !== undefined)
          cuenta["SECCION PRINCIPAL"] = seccionPrincipal;
        if (cuenta["SECCION Principal"] !== undefined)
          cuenta["SECCION Principal"] = seccionPrincipal;
        if (cuenta["SECCIÓN Principal"] !== undefined)
          cuenta["SECCIÓN Principal"] = seccionPrincipal;
        if (cuenta["SECCIàN Principal"] !== undefined)
          cuenta["SECCIàN Principal"] = seccionPrincipal;
        if (cuenta.SECCION !== undefined) cuenta.SECCION = seccionPrincipal;
        if (cuenta.seccion_principal !== undefined)
          cuenta.seccion_principal = seccionPrincipal;

        if (cuenta["SECCION Secundaria"] !== undefined)
          cuenta["SECCION Secundaria"] = seccionSecundaria;
        if (cuenta["SECCIÓN Secundaria"] !== undefined)
          cuenta["SECCIÓN Secundaria"] = seccionSecundaria;
        if (cuenta["SECCIàN Secundaria"] !== undefined)
          cuenta["SECCIàN Secundaria"] = seccionSecundaria;
        // Siempre asignar seccion_secundaria (incluso si el campo no existía antes).
        cuenta.seccion_secundaria = seccionSecundaria;
        const factor = Number(factorRaw);
        cuenta.operacion_factor = Number.isFinite(factor) ? factor : 1;
        const valorPlantilla = Number(valorPlantillaRaw);
        cuenta.valor_plantilla = Number.isFinite(valorPlantilla)
          ? valorPlantilla
          : 0;
        cuenta.visible = visible;

        // Si la subsección anterior queda huérfana, crear placeholder para preservarla
        if (oldSeccionSecundaria && oldSeccionSecundaria !== seccionSecundaria) {
          ensureSubsectionPlaceholder(oldSeccionPrincipal, oldSeccionSecundaria);
        }

        // Guardar y cerrar
        state.unsavedChanges = true;
        updateButtonStates();
        renderLayout();
        scheduleAutoSave("edit");
        showToast("Cuenta actualizada", "success");

        // Cerrar panel
        if (window.bootstrap?.Offcanvas) {
          const offcanvas = window.bootstrap.Offcanvas.getInstance(
            dom.operationEditorPanel,
          );
          offcanvas?.hide();
        }

        // Remover listener
        dom.btnEditorSave.removeEventListener("click", saveHandler);
      };

      dom.btnEditorSave.removeEventListener("click", saveHandler);
      dom.btnEditorSave.addEventListener("click", saveHandler);
    }

    // Configurar botón de eliminar
    if (dom.btnEditorDelete) {
      const deleteHandler = () => {
        if (!confirm(`¿Eliminar la cuenta ${codigoCuenta}?`)) return;

        // Capturar subsección antes de eliminar para crear placeholder si queda huérfana
        const deletedPrincipal = getAccountPrincipalName(cuenta) || "";
        const deletedSecondary = getAccountSecondaryName(cuenta) || "";

        state.cuentas = state.cuentas.filter(
          (c) => getAccountRowId(c) !== accountId,
        );

        // Si la subsección de la cuenta eliminada queda huérfana, crear placeholder
        if (deletedSecondary) {
          ensureSubsectionPlaceholder(deletedPrincipal, deletedSecondary);
        }
        state.unsavedChanges = true;
        updateButtonStates();
        renderLayout();
        scheduleAutoSave("delete");
        showToast("Cuenta eliminada", "success");

        // Cerrar panel
        if (window.bootstrap?.Offcanvas) {
          const offcanvas = window.bootstrap.Offcanvas.getInstance(
            dom.operationEditorPanel,
          );
          offcanvas?.hide();
        }

        dom.btnEditorDelete.removeEventListener("click", deleteHandler);
      };

      dom.btnEditorDelete.removeEventListener("click", deleteHandler);
      dom.btnEditorDelete.addEventListener("click", deleteHandler);
    }

    // Abrir panel
    if (window.bootstrap?.Offcanvas) {
      const offcanvas = window.bootstrap.Offcanvas.getOrCreateInstance(
        dom.operationEditorPanel,
      );
      offcanvas.show();
    }
  }

  function getHeaderLinkedOperation(
    kind,
    sectionName = "",
    subsectionName = "",
  ) {
    const safeSection = (sectionName || "").toString().trim();
    const safeSubsection = (subsectionName || "").toString().trim();
    if (kind === "section") {
      const match = findOperationBySectionName(safeSection, safeSection, {
        scope: "section",
      });
      if (match) {
        return match;
      }
      const targetKey = normalizeOperationMatch(safeSection);
      return (
        (state.operaciones || []).find((op) => {
          if (!isHeaderLinkedOperation(op)) return false;
          const parentKey = normalizeOperationMatch(op?.parentSection || "");
          const subKey = normalizeOperationMatch(op?.parentSubsection || "");
          const sumRowKey = normalizeOperationMatch(op?.["sum-row"] || "");
          const placementKey = normalizeOperationMatch(op?.SECCION || "");
          const sumRowVariosKey = normalizeOperationMatch(
            op?.["sum-row-sumavarios"] || "",
          );
          const sumRowVarios2Key = normalizeOperationMatch(
            op?.["sum-row-sumavarios2"] || "",
          );
          const sumRowOperativoKey = normalizeOperationMatch(
            op?.["sum-row-operativo"] || "",
          );
          const resultRowKey = normalizeOperationMatch(op?.["result-row"] || "");
          const netRowKey = normalizeOperationMatch(op?.["net-row"] || "");
          const resultNetRowKey = normalizeOperationMatch(
            op?.["result-net-row"] || "",
          );
          const hasSectionRowAnchor =
            sumRowVariosKey === targetKey ||
            sumRowVarios2Key === targetKey ||
            sumRowOperativoKey === targetKey ||
            resultRowKey === targetKey ||
            netRowKey === targetKey ||
            resultNetRowKey === targetKey;
          const hasPlacementSectionAnchor =
            placementKey === targetKey && !subKey && !sumRowKey;
          const hasLegacySectionAnchor =
            hasSectionRowAnchor || hasPlacementSectionAnchor;
          const matchesByParent =
            parentKey === targetKey && !subKey && !sumRowKey;
          const matchesLegacy = !parentKey && hasLegacySectionAnchor;
          return matchesByParent || matchesLegacy;
        }) || null
      );
    }
    const match = findOperationBySectionName(safeSubsection, safeSection, {
      scope: "subsection",
    });
    if (match) {
      return match;
    }
    const sectionKey = normalizeOperationMatch(safeSection);
    const subsectionKey = normalizeOperationMatch(safeSubsection);
    const candidates = (state.operaciones || []).filter((op) => {
      if (!isHeaderLinkedOperation(op)) return false;
      const parentKey = normalizeOperationMatch(op?.parentSection || "");
      const subKey = normalizeOperationMatch(op?.parentSubsection || "");
      const sumRowKey = normalizeOperationMatch(op?.["sum-row"] || "");
      const placementKey = normalizeOperationMatch(op?.SECCION || op?.seccion || "");
      const isHomonymScope = Boolean(
        sectionKey && subsectionKey && sectionKey === subsectionKey,
      );
      const matchesSubAnchor =
        subKey === subsectionKey ||
        sumRowKey === subsectionKey ||
        placementKey === subsectionKey;
      if (!matchesSubAnchor) return false;
      if (isHomonymScope && !subKey && !sumRowKey) return false;
      if (parentKey) return parentKey === sectionKey;
      if (!sectionKey) return true;
      return operationMatchesParentSectionHint(op, safeSection);
    });
    if (!candidates.length) return null;
    const scored = candidates
      .map((op) => ({ op, score: getOperationParentMatchScore(op, safeSection) }))
      .sort((a, b) => b.score - a.score);
    const topScore = scored[0]?.score ?? 0;
    const topMatches = scored
      .filter((entry) => entry.score === topScore)
      .map((entry) => entry.op);
    if (sectionKey && topScore === 0) return null;
    if (sectionKey && topScore <= 1 && topMatches.length > 1) return null;
    return (
      topMatches.find(
        (op) => normalizeOperationMatch(op?.parentSubsection || "") === subsectionKey,
      ) ||
      topMatches.find(
        (op) => normalizeOperationMatch(op?.["sum-row"] || "") === subsectionKey,
      ) ||
      topMatches.find(
        (op) =>
          normalizeOperationMatch(op?.SECCION || op?.seccion || "") === subsectionKey,
      ) ||
      topMatches[0] ||
      null
    );
  }

  function buildHeaderOperationDraft(
    kind,
    sectionName = "",
    subsectionName = "",
  ) {
    const safeSection = (sectionName || "").toString().trim();
    const safeSubsection = (subsectionName || "").toString().trim();
    const existing = getHeaderLinkedOperation(
      kind,
      safeSection,
      safeSubsection,
    );
    if (existing) return existing;

    if (kind === "section") {
      return {
        CAPITULO: state.capitulo || "DEFAULT",
        HOJA: state.modulo || "",
        Clase: safeSection,
        OperacionId: normalizeOperationId(safeSection || "OPERACION"),
        SECCION: safeSection,
        seccion: safeSection,
        secciones: safeSection ? [safeSection] : [],
        parentSection: safeSection || null,
        parentSubsection: null,
        "sum-row-sumavarios": safeSection,
        formula_terms: [],
        formula_json: serializeFormulaV2([]),
      };
    }

    return {
      CAPITULO: state.capitulo || "DEFAULT",
      HOJA: state.modulo || "",
      Clase: safeSubsection,
      OperacionId: normalizeOperationId(safeSubsection || "OPERACION"),
      SECCION: safeSubsection,
      seccion: safeSubsection,
      secciones: safeSubsection ? [safeSubsection] : [],
      parentSection: safeSection || null,
      parentSubsection: safeSubsection || null,
      "sum-row": safeSubsection,
      formula_terms: [],
      formula_json: serializeFormulaV2([]),
    };
  }

  function readEditorFormulaPayload(opContext = null) {
    const formulaPanel = dom.operationEditorPanel;
    if (!formulaPanel) {
      return { valid: true, terms: [], tokens: [], error: "" };
    }
    const formulaMode =
      formulaPanel?.querySelector('input[name="operationFormulaMode"]:checked')
        ?.value || "layout";
    const manualText =
      formulaPanel?.querySelector("#operationFormulaManual")?.value || "";

    if (formulaMode === "manual") {
      const parsed = parseFormulaExpressionV2(manualText, {
        parentSection: opContext?.parentSection || "",
        defaultParentSection:
          opContext?.defaultParentSection || opContext?.parentSection || "",
      });
      if (!parsed.valid) {
        return {
          valid: false,
          terms: [],
          tokens: [],
          error: parsed.error || "Fórmula inválida",
        };
      }
      return {
        valid: true,
        terms: normalizeFormulaTerms(parsed.terms || []),
        tokens: Array.isArray(parsed.tokens) ? parsed.tokens : [],
        error: "",
      };
    }

    const terms = normalizeFormulaTerms(
      collectFormulaTermsFromLayout(formulaPanel),
    );
    return {
      valid: true,
      terms,
      // En modo "Layout" la selección ya trae contexto (parentSection) en los
      // rows de subsección; NO debemos inferir parentSection desde el contexto
      // del editor porque eso puede convertir secciones principales en
      // subsecciones (p.ej. al editar INCOME y seleccionar "Membership").
      tokens: convertLegacyTermsToV2Tokens(terms, null),
      error: "",
    };
  }

  function readEditorFormulaTerms(opContext = null) {
    const payload = readEditorFormulaPayload(opContext);
    return payload.valid ? payload.terms : [];
  }

  function applyStrictFormulaTermsToOperation(op, terms = [], tokens = null) {
    if (!op) return;
    const normalizedTerms = normalizeFormulaTerms(
      Array.isArray(terms) ? terms : [],
    );
    const normalizedTokens = Array.isArray(tokens)
      ? tokens
      : convertLegacyTermsToV2Tokens(normalizedTerms, op);

    if (!op.signos || typeof op.signos !== "object") {
      op.signos = {};
    }

    for (let i = 1; i <= 20; i += 1) {
      const key = `seccion_${i}`;
      delete op[key];
      delete op.signos[key];
    }

    if (normalizedTerms.length) {
      const now = Date.now();
      op.formula_terms = normalizedTerms.map((term, idx) => ({
        id: now + idx,
        ...term,
      }));
      op.formula_v2 = {
        version: FORMULA_V2_VERSION,
        tokens: normalizedTokens,
      };
      op.formula_json = serializeFormulaV2(normalizedTokens);
      op.formula_terms.forEach((term, idx) => {
        const key = `seccion_${idx + 1}`;
        op[key] = term.value;
        op.signos[key] = term.operator === "-" ? -1 : 1;
      });
      return;
    }

    op.formula_terms = [];
    op.formula_v2 = { version: FORMULA_V2_VERSION, tokens: [] };
    op.formula_json = serializeFormulaV2([]);
  }

  function ensureHeaderLinkedOperation(
    kind,
    sectionName = "",
    subsectionName = "",
  ) {
    const safeSection = (sectionName || "").toString().trim();
    const safeSubsection = (subsectionName || "").toString().trim();
    if (kind === "subsection" && (!safeSection || !safeSubsection)) {
      return null;
    }
    if (kind === "section" && !safeSection) {
      return null;
    }

    let op = getHeaderLinkedOperation(kind, safeSection, safeSubsection);
    if (!op) {
      const isSection = kind === "section";
      const rowLabels = isSection
        ? { "sum-row-sumavarios": safeSection }
        : { "sum-row": safeSubsection };
      const result = addOperationEntry(
        {
          nombre: isSection ? safeSection : safeSubsection,
          seccion: safeSection,
          subseccion: isSection ? "" : safeSubsection,
          formulaTerms: [],
          rowLabels,
        },
        { silent: true },
      );
      op = result?.operation || null;
    }

    if (!op) return null;

    if (kind === "section") {
      op.parentSection = safeSection || null;
      op.parentSubsection = null;
      op.SECCION = safeSection;
      op.seccion = safeSection;
      op.secciones = safeSection ? [safeSection] : [];
      op["sum-row-sumavarios"] = safeSection;
      delete op["sum-row"];
    } else {
      op.parentSection = safeSection || null;
      op.parentSubsection = safeSubsection || null;
      op.SECCION = safeSubsection;
      op.seccion = safeSubsection;
      op.secciones = safeSubsection ? [safeSubsection] : [];
      op["sum-row"] = safeSubsection;
      delete op["sum-row-sumavarios"];
    }

    if (!op.Clase) {
      op.Clase = kind === "section" ? safeSection : safeSubsection;
    }
    if (!op.operacion_etiqueta && op.Clase) {
      op.operacion_etiqueta = op.Clase;
    }
    if (!getOperationId(op)) {
      const base = normalizeOperationId(op.Clase || "OPERACION");
      op.OperacionId = buildUniqueOperationId(base, op);
    }

    return op;
  }

  /**
   * Editar una sección principal en panel lateral.
   */
  function _editSectionInternalOld(sectionName) {
    if (!sectionName) return;

    if (!dom.operationEditorPanel) {
      showToast("Panel de edición no disponible", "error");
      return;
    }

    // Remove stale closure-based handlers from previous edits (account, subsection, etc.)
    if (dom.btnEditorSave) {
      const fresh = dom.btnEditorSave.cloneNode(true);
      dom.btnEditorSave.replaceWith(fresh);
      dom.btnEditorSave = fresh;
      // Re-attach global save dispatcher
      dom.btnEditorSave.addEventListener("click", () => {
        if (state.selectedElement?.type === "operation") {
          saveOperationFromPanel();
        } else {
          confirmEdit();
        }
      });
    }
    if (dom.btnEditorDelete) {
      const fresh = dom.btnEditorDelete.cloneNode(true);
      dom.btnEditorDelete.replaceWith(fresh);
      dom.btnEditorDelete = fresh;
    }

    const safeName = (sectionName || "").toString().trim();
    state.selectedElement = {
      type: "section",
      name: safeName,
      linkedOperation: getHeaderLinkedOperation("section", safeName, ""),
    };
    updateSelectionInfo();

    if (dom.operationEditorTitle) {
      dom.operationEditorTitle.textContent = "Editar Sección Principal";
    }
    if (dom.operationEditorSubtitle) {
      dom.operationEditorSubtitle.textContent = safeName;
    }

    if (dom.editorTabDatos) {
      dom.editorTabDatos.innerHTML = `
        <div class="mb-3">
          <label class="form-label">Nombre de Sección</label>
          <input type="text" class="form-control" id="editNombreSeccion" value="${escapeHtml(safeName)}" />
        </div>
        <div class="alert alert-info mb-0">
          <i class="bi bi-info-circle me-2"></i>
          El cambio se aplicará también a operaciones/fórmulas que referencien esta sección.
        </div>
      `;
    }

    if (dom.editorTabFormula) {
      const formulaOp = buildHeaderOperationDraft("section", safeName, "");
      dom.editorTabFormula.innerHTML = buildOperationEditorFormulaTab(
        formulaOp,
        buildAvailableElementsForFormula(),
      );
      bindFormulaLayoutInteractions(dom.operationEditorPanel);
    }
    if (dom.editorTabAparicion) {
      dom.editorTabAparicion.innerHTML =
        '<p class="text-muted mb-0">La aparición de la sección se controla por su fila de sección.</p>';
    }

    if (dom.btnEditorDelete) {
      dom.btnEditorDelete.disabled = false;
      dom.btnEditorDelete.title = "Eliminar sección";
    }
    if (dom.btnEditorSave) {
      dom.btnEditorSave.disabled = false;
      dom.btnEditorSave.title = "Guardar cambios";
    }

    setOperationEditorTab("editorTabDatos");

    if (window.bootstrap?.Offcanvas) {
      const offcanvas = window.bootstrap.Offcanvas.getOrCreateInstance(
        dom.operationEditorPanel,
      );
      offcanvas.show();
    } else {
      openOffcanvasFallback(dom.operationEditorPanel);
    }
  }

  /**
   * Editar una subsección en panel lateral.
   */
  function _editSubsectionInternalOld(sectionName, subsectionName) {
    if (!subsectionName) return;

    if (!dom.operationEditorPanel) {
      showToast("Panel de edición no disponible", "error");
      return;
    }

    // Remove stale closure-based handlers from previous edits
    if (dom.btnEditorSave) {
      const fresh = dom.btnEditorSave.cloneNode(true);
      dom.btnEditorSave.replaceWith(fresh);
      dom.btnEditorSave = fresh;
      dom.btnEditorSave.addEventListener("click", () => {
        if (state.selectedElement?.type === "operation") {
          saveOperationFromPanel();
        } else {
          confirmEdit();
        }
      });
    }
    if (dom.btnEditorDelete) {
      const fresh = dom.btnEditorDelete.cloneNode(true);
      dom.btnEditorDelete.replaceWith(fresh);
      dom.btnEditorDelete = fresh;
    }

    const safeSection = (sectionName || "").toString().trim();
    const safeSubsection = (subsectionName || "").toString().trim();
    state.selectedElement = {
      type: "subsection",
      principal: safeSection,
      name: safeSubsection,
      linkedOperation: getHeaderLinkedOperation(
        "subsection",
        safeSection,
        safeSubsection,
      ),
    };
    updateSelectionInfo();

    if (dom.operationEditorTitle) {
      dom.operationEditorTitle.textContent = "Editar Subsección";
    }
    if (dom.operationEditorSubtitle) {
      dom.operationEditorSubtitle.textContent = `${safeSection} > ${safeSubsection}`;
    }

    if (dom.editorTabDatos) {
      dom.editorTabDatos.innerHTML = `
        <div class="mb-3">
          <label class="form-label">Sección Principal</label>
          <input type="text" class="form-control" value="${escapeHtml(safeSection)}" readonly />
        </div>
        <div class="mb-3">
          <label class="form-label">Nombre de Subsección</label>
          <input type="text" class="form-control" id="editNombreSubseccion" value="${escapeHtml(safeSubsection)}" />
        </div>
        <div class="alert alert-info mb-0">
          <i class="bi bi-info-circle me-2"></i>
          El cambio se aplicará también a operaciones/fórmulas ligadas a esta subsección.
        </div>
      `;
    }

    if (dom.editorTabFormula) {
      const formulaOp = buildHeaderOperationDraft(
        "subsection",
        safeSection,
        safeSubsection,
      );
      dom.editorTabFormula.innerHTML = buildOperationEditorFormulaTab(
        formulaOp,
        buildAvailableElementsForFormula(),
      );
      bindFormulaLayoutInteractions(dom.operationEditorPanel);
    }
    if (dom.editorTabAparicion) {
      dom.editorTabAparicion.innerHTML =
        '<p class="text-muted mb-0">La aparición de la subsección se controla por su fila de subsección.</p>';
    }

    if (dom.btnEditorDelete) {
      dom.btnEditorDelete.disabled = false;
      dom.btnEditorDelete.title = "Eliminar subsección";
    }
    if (dom.btnEditorSave) {
      dom.btnEditorSave.disabled = false;
      dom.btnEditorSave.title = "Guardar cambios";
    }

    setOperationEditorTab("editorTabDatos");

    if (window.bootstrap?.Offcanvas) {
      const offcanvas = window.bootstrap.Offcanvas.getOrCreateInstance(
        dom.operationEditorPanel,
      );
      offcanvas.show();
    } else {
      openOffcanvasFallback(dom.operationEditorPanel);
    }
  }

  /**
   * Editar una operación
   */
  function editOperation(operationId) {
    if (!operationId) return;
    if (typeof coreEditOperation === "function") {
      coreEditOperation(operationId);
      return;
    }
    if (window.editOperation && window.editOperation !== editOperation) {
      window.editOperation(operationId);
      return;
    }

    // Buscar la operación
    const operation = state.operaciones.find(
      (op) =>
        getOperationId(op) === operationId ||
        (op.Clase || op.clase) === operationId ||
        (op.OperacionId || op.OperacionID) === operationId,
    );

    if (!operation) {
      showToast("Operación no encontrada", "warning");
      return;
    }

    if (!dom.operationEditorPanel) {
      showToast("Panel de edición no disponible", "error");
      return;
    }

    // Configurar título
    if (dom.operationEditorTitle) {
      dom.operationEditorTitle.textContent = "Editar Operación";
    }
    if (dom.operationEditorSubtitle) {
      dom.operationEditorSubtitle.textContent =
        getOperationDisplayName(operation);
    }

    // Renderizar formulario básico
    if (dom.editorTabDatos) {
      const opId = getOperationId(operation) || "";
      const clase = operation.Clase || operation.clase || "";
      const seccion = operation.SECCION || operation.seccion || "";

      dom.editorTabDatos.innerHTML = `
        <div class="mb-3">
          <label class="form-label">ID de Operación</label>
          <input type="text" class="form-control" value="${escapeHtml(opId)}" readonly />
        </div>
        <div class="mb-3">
          <label class="form-label">Clase</label>
          <input type="text" class="form-control" id="editClase" value="${escapeHtml(clase)}" />
        </div>
        <div class="mb-3">
          <label class="form-label">Sección</label>
          <input type="text" class="form-control" id="editSeccion" value="${escapeHtml(seccion)}" />
        </div>
        <div class="mb-3">
          <div class="form-check">
            <input class="form-check-input" type="checkbox" id="editOpVisible" ${operation.visible !== false ? "checked" : ""} />
            <label class="form-check-label" for="editOpVisible">Visible</label>
          </div>
        </div>
        <div class="alert alert-info">
          <i class="bi bi-info-circle me-2"></i>
          Para editar la fórmula, use la pestaña "Fórmula" o el constructor de fórmulas.
        </div>
      `;
    }

    // Pestaña de fórmula
    if (dom.editorTabFormula) {
      const formula = formatFormula(operation) || "";
      dom.editorTabFormula.innerHTML = `
        <div class="mb-3">
          <label class="form-label">Fórmula</label>
          <textarea class="form-control font-monospace" id="editFormula" rows="4" placeholder="Fórmula de la operación">${escapeHtml(formula)}</textarea>
          <div class="form-text">Edite la fórmula manualmente o use el constructor de fórmulas.</div>
        </div>
        ${window.FormulaBuilder ? '<button type="button" class="btn btn-outline-primary btn-sm" onclick="window.FormulaBuilder.showMap && window.FormulaBuilder.showMap()">Abrir Constructor de Fórmulas</button>' : ""}
      `;
    }

    if (dom.editorTabAparicion)
      dom.editorTabAparicion.innerHTML =
        '<p class="text-muted">Próximamente: configuración de aparición</p>';

    // Configurar botón de guardar
    if (dom.btnEditorSave) {
      const saveHandler = () => {
        const clase = document.getElementById("editClase")?.value || "";
        const seccion = document.getElementById("editSeccion")?.value || "";
        const visible = document.getElementById("editOpVisible")?.checked;
        const formula = document.getElementById("editFormula")?.value || "";

        // Actualizar operación
        if (operation.Clase !== undefined) operation.Clase = clase;
        if (operation.clase !== undefined) operation.clase = clase;
        if (operation.SECCION !== undefined) operation.SECCION = seccion;
        if (operation.seccion !== undefined) operation.seccion = seccion;
        operation.visible = visible;

        // Actualizar fórmula si cambió
        if (formula && formula !== formatFormula(operation)) {
          // Aquí se podría parsear la fórmula y actualizar los campos correspondientes
          // Por ahora solo mostramos un mensaje
          showToast("Cambios guardados. La fórmula debe ser validada.", "info");
        }

        state.unsavedChanges = true;
        renderLayout();
        showToast("Operación actualizada", "success");

        if (window.bootstrap?.Offcanvas) {
          const offcanvas = window.bootstrap.Offcanvas.getInstance(
            dom.operationEditorPanel,
          );
          offcanvas?.hide();
        }

        dom.btnEditorSave.removeEventListener("click", saveHandler);
      };

      dom.btnEditorSave.removeEventListener("click", saveHandler);
      dom.btnEditorSave.addEventListener("click", saveHandler);
    }

    // Configurar botón de eliminar
    if (dom.btnEditorDelete) {
      dom.btnEditorDelete.disabled = false;
      const deleteHandler = () => {
        if (
          !confirm(
            `¿Eliminar la operación ${getOperationDisplayName(operation)}?`,
          )
        )
          return;

        state.operaciones = state.operaciones.filter(
          (op) => getOperationId(op) !== operationId,
        );
        state.unsavedChanges = true;
        renderLayout();
        showToast("Operación eliminada", "success");

        if (window.bootstrap?.Offcanvas) {
          const offcanvas = window.bootstrap.Offcanvas.getInstance(
            dom.operationEditorPanel,
          );
          offcanvas?.hide();
        }

        dom.btnEditorDelete.removeEventListener("click", deleteHandler);
      };

      dom.btnEditorDelete.removeEventListener("click", deleteHandler);
      dom.btnEditorDelete.addEventListener("click", deleteHandler);
    }

    // Abrir panel
    if (window.bootstrap?.Offcanvas) {
      const offcanvas = window.bootstrap.Offcanvas.getOrCreateInstance(
        dom.operationEditorPanel,
      );
      offcanvas.show();
    }
  }

  /**
   * Editar una etiqueta consolidada (múltiples operaciones con mismo label)
   */
  function editConsolidatedLabel(
    label,
    field,
    parentSection = "",
    sourceOperations = [],
  ) {
    // Usar la versión global que tiene la implementación completa
    if (window.editConsolidatedLabel) {
      window.editConsolidatedLabel(
        label,
        field,
        parentSection,
        sourceOperations,
      );
    }
  }

  function getAccountFieldValue(cuenta, keys = []) {
    if (!cuenta || !keys.length) return "";
    for (const key of keys) {
      if (cuenta[key] != null && String(cuenta[key]).trim() !== "") {
        const value = cuenta[key];
        return typeof value === "string" ? value.trim() : value;
      }
    }
    const normalizedKeys = keys.map((key) => normalizeOperationMatch(key));
    const entries = Object.keys(cuenta);
    for (const entry of entries) {
      const normalized = normalizeOperationMatch(entry);
      if (normalizedKeys.includes(normalized)) {
        const value = cuenta[entry];
        if (value != null && String(value).trim() !== "") {
          return typeof value === "string" ? value.trim() : value;
        }
      }
    }
    return "";
  }

  function getAccountPrincipalName(cuenta) {
    return getAccountFieldValue(cuenta, [
      "SECCION PRINCIPAL",
      "SECCION Principal",
      "SECCIÓN PRINCIPAL",
      "SECCIÓN Principal",
      "SECCION",
      "SECCIÓN",
      "seccion_principal",
    ]);
  }

  function getAccountSecondaryName(cuenta) {
    return getAccountFieldValue(cuenta, [
      "SECCION SECUNDARIA",
      "SECCION Secundaria",
      "SECCIÓN SECUNDARIA",
      "SECCIÓN Secundaria",
      "seccion_secundaria",
      "SUBSECCION",
      "SUBSECCIÓN",
    ]);
  }

  /**
   * Si el par (principal, secondary) queda huérfano (ninguna cuenta real lo referencia
   * y no existe ya un placeholder para él), crea un placeholder en state.cuentas para
   * que la subsección siga visible en el Gestor y persista en layout_secciones al guardar.
   */
  function ensureSubsectionPlaceholder(principal, secondary) {
    if (!principal || !secondary) return;
    const principalKey = normalizeOperationMatch(principal);
    const secondaryKey = normalizeOperationMatch(secondary);
    if (!principalKey || !secondaryKey) return;

    // ¿Alguna cuenta REAL aún cubre este par?
    const coveredByAccount = (state.cuentas || []).some((c) => {
      if (isPlaceholderAccount(c)) return false;
      const p = normalizeOperationMatch(getAccountPrincipalName(c) || "");
      const s = normalizeOperationMatch(getAccountSecondaryName(c) || "");
      return p === principalKey && s === secondaryKey;
    });
    if (coveredByAccount) return;

    // ¿Ya existe un placeholder para este par?
    const alreadyHasPlaceholder = (state.cuentas || []).some((c) => {
      if (!isPlaceholderAccount(c)) return false;
      const p = normalizeOperationMatch(getAccountPrincipalName(c) || "");
      const s = normalizeOperationMatch(getAccountSecondaryName(c) || "");
      return p === principalKey && s === secondaryKey;
    });
    if (alreadyHasPlaceholder) return;

    // Crear placeholder para preservar la subsección en el Gestor
    const order = getNextGlobalOrder();
    const placeholder = {
      CUENTA: "",
      NOMBRE: `[Subseccion: ${secondary}]`,
      "SECCION Principal": principal,
      "SECCION Secundaria": secondary,
      SECCION: principal,
      seccion_principal: principal,
      seccion_secundaria: secondary,
      orden: order,
      orden_presentacion: order,
      visible: false,
      __layoutPlaceholder: true,
      __placeholderType: "secundaria",
      __placeholderOrder: order,
    };
    assignAccountRowId(placeholder);
    state.cuentas.push(placeholder);
  }

  function resequenceAccountsBySections(sections) {
    if (!Array.isArray(sections) || !sections.length) return;
    const accounts = state.cuentas || [];
    if (!accounts.length) return;
    const baseOrder = Math.min(
      ...accounts.map((cuenta, idx) => getAccountOrder(cuenta, idx)),
    );
    let order = Number.isFinite(baseOrder) ? baseOrder : 0;

    sections.forEach((section) => {
      (section.subsections || []).forEach((subsection) => {
        const sortedAccounts = sortAccountsByOrder(subsection.accounts || []);
        sortedAccounts.forEach((cuenta) => {
          cuenta.orden_presentacion = order++;
        });
      });
    });
  }

  function resequenceAccountsForSection(section) {
    const accounts = (section?.subsections || []).flatMap(
      (subsection) => subsection.accounts || [],
    );
    if (!accounts.length) return;
    const baseOrder = Math.min(
      ...accounts.map((cuenta, idx) => getAccountOrder(cuenta, idx)),
    );
    let order = Number.isFinite(baseOrder) ? baseOrder : 0;

    (section.subsections || []).forEach((subsection) => {
      const sortedAccounts = sortAccountsByOrder(subsection.accounts || []);
      sortedAccounts.forEach((cuenta) => {
        cuenta.orden_presentacion = order++;
      });
    });
  }

  function handleInlineOrderMove(row, direction) {
    const rowIndex = Number(row.dataset.rowIndex);
    if (Number.isInteger(rowIndex)) {
      moveTemplateRowOrder(rowIndex, direction);
      return;
    }

    // Fallback legacy (si alguna vista no expone rowIndex)
    const rowType = row.dataset.rowType;
    if (rowType === "section") {
      if (row.dataset.generated === "true") return;
      moveSectionOrder(row.dataset.section, direction);
      return;
    }
    if (rowType === "subsection") {
      const sectionName =
        row.dataset.section || row.dataset.parentSection || "";
      moveSubsectionOrder(sectionName, row.dataset.subsection, direction);
      return;
    }
    if (rowType === "account") {
      moveAccountOrder(
        row.dataset.accountId || row.dataset.cuenta,
        row.dataset.section || row.dataset.parentSection || "",
        row.dataset.subsection || row.dataset.parentSubsection || "",
        direction,
      );
      return;
    }
    if (rowType === "operation") {
      moveOperationOrder(
        row.dataset.operationLabel,
        row.dataset.operationId,
        row.dataset.operationKind,
        direction,
      );
    }
  }

  function moveTemplateRowOrder(rowIndex, direction) {
    const rows = getTemplateRowsForReorder();
    if (!rows.length) return;
    const currentIndex = Number(rowIndex);
    if (!Number.isInteger(currentIndex)) return;
    if (currentIndex < 0 || currentIndex >= rows.length) return;

    const directionValue = Number(direction || 0);
    if (!Number.isFinite(directionValue) || directionValue === 0) return;

    const resolveRowLevel = (row = {}) => {
      const type = row?.type || "";
      if (type === "principal") return 0;
      if (type === "subsection") return 1;
      if (type === "account") {
        const parentSub =
          row.parentSubsection || row.subsection || row.parentSub || "";
        const parentSec = row.parentSection || row.section || row.parent || "";
        if (parentSub) return 2;
        if (parentSec) return 1;
        return 0;
      }
      if (type === "operation") {
        const parentSub =
          row.parentSubsection || row.subsection || row.parentSub || "";
        const parentSec = row.parentSection || row.section || row.parent || "";
        if (parentSub) return 2;
        if (parentSec) return 1;
        return 0;
      }
      return 0;
    };

    const resolveBlockRange = (startIdx) => {
      const row = rows[startIdx] || {};
      const type = row?.type || "";
      if (type === "principal") {
        let end = startIdx;
        for (let i = startIdx + 1; i < rows.length; i += 1) {
          if (resolveRowLevel(rows[i]) <= 0) break;
          end = i;
        }
        return { start: startIdx, end };
      }
      if (type === "subsection") {
        let end = startIdx;
        for (let i = startIdx + 1; i < rows.length; i += 1) {
          if (resolveRowLevel(rows[i]) <= 1) break;
          end = i;
        }
        return { start: startIdx, end };
      }
      return { start: startIdx, end: startIdx };
    };

    const currentBlock = resolveBlockRange(currentIndex);
    const level = resolveRowLevel(rows[currentBlock.start]);

    const swapBlocks = (a, b) => {
      const before = rows.slice(0, a.start);
      const blockA = rows.slice(a.start, a.end + 1);
      const between = rows.slice(a.end + 1, b.start);
      const blockB = rows.slice(b.start, b.end + 1);
      const after = rows.slice(b.end + 1);
      const reordered = [...before, ...blockB, ...between, ...blockA, ...after];
      applyTemplateRowsOrder(reordered, { silent: false });
    };

    if (directionValue > 0) {
      let cursor = currentBlock.end + 1;
      while (cursor < rows.length && resolveRowLevel(rows[cursor]) > level) {
        cursor += 1;
      }
      if (cursor >= rows.length) return;
      const candidateLevel = resolveRowLevel(rows[cursor]);
      // Permitir que cuentas/operaciones salgan de una subsección (nivel 2) para cambiar
      // de subsección dentro de la MISMA sección. Solo bloquear cuando se intenta salir
      // de la sección (nivel 0).
      const allowExitSubsection = level === 2 && candidateLevel === 1;
      if (candidateLevel < level && !allowExitSubsection) {
        if (level === 2 || level === 1) {
          showToast(
            "No puedes mover este elemento fuera de su sección. Cambia su sección para moverlo.",
            "warning",
          );
        }
        return;
      }
      const nextBlock = resolveBlockRange(cursor);
      swapBlocks(currentBlock, nextBlock);
      return;
    }

    if (directionValue < 0) {
      let cursor = currentBlock.start - 1;
      while (cursor >= 0 && resolveRowLevel(rows[cursor]) > level) {
        cursor -= 1;
      }
      if (cursor < 0) return;
      const candidateLevel = resolveRowLevel(rows[cursor]);
      const allowExitSubsection = level === 2 && candidateLevel === 1;
      if (candidateLevel < level && !allowExitSubsection) {
        if (level === 2 || level === 1) {
          showToast(
            "No puedes mover este elemento fuera de su sección. Cambia su sección para moverlo.",
            "warning",
          );
        }
        return;
      }
      const prevBlock = resolveBlockRange(cursor);
      // Para mover hacia arriba, "a" debe ser el bloque anterior.
      swapBlocks(prevBlock, currentBlock);
    }
  }

  function moveTemplateRowOrderToIndex(rowIndex, targetIndex) {
    const rows = getTemplateRowsForReorder();
    if (!rows.length) return;
    const currentIndex = Number(rowIndex);
    if (!Number.isInteger(currentIndex)) return;
    if (currentIndex < 0 || currentIndex >= rows.length) return;

    const rawTarget = Number(targetIndex);
    if (!Number.isFinite(rawTarget)) return;
    let desired = Math.floor(rawTarget);
    if (desired < 0) desired = 0;
    if (desired >= rows.length) desired = rows.length - 1;
    if (desired === currentIndex) return;

    const resolveRowLevel = (row = {}) => {
      const type = row?.type || "";
      if (type === "principal") return 0;
      if (type === "subsection") return 1;
      if (type === "account") {
        const parentSub =
          row.parentSubsection || row.subsection || row.parentSub || "";
        const parentSec = row.parentSection || row.section || row.parent || "";
        if (parentSub) return 2;
        if (parentSec) return 1;
        return 0;
      }
      if (type === "operation") {
        const parentSub =
          row.parentSubsection || row.subsection || row.parentSub || "";
        const parentSec = row.parentSection || row.section || row.parent || "";
        if (parentSub) return 2;
        if (parentSec) return 1;
        return 0;
      }
      return 0;
    };

    const resolveBlockRange = (startIdx) => {
      const row = rows[startIdx] || {};
      const type = row?.type || "";
      if (type === "principal") {
        let end = startIdx;
        for (let i = startIdx + 1; i < rows.length; i += 1) {
          if (resolveRowLevel(rows[i]) <= 0) break;
          end = i;
        }
        return { start: startIdx, end };
      }
      if (type === "subsection") {
        let end = startIdx;
        for (let i = startIdx + 1; i < rows.length; i += 1) {
          if (resolveRowLevel(rows[i]) <= 1) break;
          end = i;
        }
        return { start: startIdx, end };
      }
      return { start: startIdx, end: startIdx };
    };

    const currentBlock = resolveBlockRange(currentIndex);
    const level = resolveRowLevel(rows[currentBlock.start]);
    const block = rows.slice(currentBlock.start, currentBlock.end + 1);
    const blockLen = block.length;
    const remaining = rows.filter(
      (_, idx) => idx < currentBlock.start || idx > currentBlock.end,
    );

    // Ajustar índice objetivo por la extracción del bloque si se mueve hacia abajo.
    let insertHint = desired;
    if (insertHint > currentBlock.start) insertHint -= blockLen;

    // Rango permitido para mantener estructura:
    // - Nivel 0: libre
    // - Nivel 1: dentro del mismo principal
    // - Nivel 2: dentro de la misma subsección (si existe), si no dentro del mismo principal
    let groupStart = 0;
    let groupEnd = remaining.length;

    const findPrevInOriginal = (fromIdx, predicate) => {
      for (let i = fromIdx; i >= 0; i -= 1) {
        if (predicate(rows[i], i)) return i;
      }
      return -1;
    };

    if (level === 1 || level === 2) {
      const principalIdx = findPrevInOriginal(
        currentBlock.start,
        (row) => resolveRowLevel(row) === 0,
      );
      if (principalIdx >= 0) {
        groupStart = principalIdx;
        groupEnd = remaining.length;
        for (let i = groupStart + 1; i < remaining.length; i += 1) {
          if (resolveRowLevel(remaining[i]) === 0) {
            groupEnd = i;
            break;
          }
        }
      }
    }

    const allowedMin =
      level === 0 ? 0 : Math.min(groupStart + 1, remaining.length);
    const allowedMax = Math.min(groupEnd, remaining.length);
    const originalInsertHint = insertHint;
    if (insertHint < allowedMin) insertHint = allowedMin;
    if (insertHint > allowedMax) insertHint = allowedMax;
    if (originalInsertHint !== insertHint && level > 0) {
      if (level === 1 || level === 2) {
        showToast(
          "Esa posición está fuera de la sección. Se ajustó dentro del rango permitido.",
          "warning",
        );
      }
    }

    let insertAt = insertHint;
    if (level !== 2) {
      const candidates = [];
      for (let i = allowedMin; i < allowedMax; i += 1) {
        if (resolveRowLevel(remaining[i]) === level) {
          candidates.push(i);
        }
      }
      candidates.push(allowedMax);
      const positions = Array.from(new Set(candidates)).sort((a, b) => a - b);
      insertAt = positions.find((pos) => pos >= insertHint);
      if (insertAt == null) insertAt = allowedMax;
    }

    const reordered = remaining.slice();
    reordered.splice(insertAt, 0, ...block);
    applyTemplateRowsOrder(reordered, { silent: false });
  }

  function moveSectionOrder(sectionName, direction) {
    if (!sectionName) return;
    const sections = groupBySections(state.cuentas || []);
    const targetKey = normalizeOperationMatch(sectionName);
    const index = sections.findIndex(
      (section) => normalizeOperationMatch(section.name) === targetKey,
    );
    if (index === -1) {
      showToast("Seccion no encontrada", "warning");
      return;
    }
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= sections.length) return;
    const [moved] = sections.splice(index, 1);
    sections.splice(nextIndex, 0, moved);

    resequenceAccountsBySections(sections);
    logChange("move", `Seccion "${sectionName}" reordenada`);
    renderLayout();
  }

  function moveSubsectionOrder(sectionName, subsectionName, direction) {
    if (!sectionName || !subsectionName) return;
    const sections = groupBySections(state.cuentas || []);
    const sectionKey = normalizeOperationMatch(sectionName);
    const section = sections.find(
      (item) => normalizeOperationMatch(item.name) === sectionKey,
    );
    if (!section) {
      showToast("Subseccion no encontrada", "warning");
      return;
    }
    const subKey = normalizeOperationMatch(subsectionName);
    const index = (section.subsections || []).findIndex(
      (subsection) => normalizeOperationMatch(subsection.name) === subKey,
    );
    if (index === -1) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= section.subsections.length) return;
    const [moved] = section.subsections.splice(index, 1);
    section.subsections.splice(nextIndex, 0, moved);

    resequenceAccountsForSection(section);
    logChange("move", `Subseccion "${subsectionName}" reordenada`);
    renderLayout();
  }

  function moveAccountOrder(
    cuentaCode,
    sectionName,
    subsectionName,
    direction,
  ) {
    if (!cuentaCode) return;
    const account = resolveAccountByIdOrCode(cuentaCode);
    if (!account) return;
    const principal = sectionName || getAccountPrincipalName(account);
    const secondary = subsectionName || getAccountSecondaryName(account) || "";

    const group = (state.cuentas || []).filter((cuenta) => {
      const principalKey = normalizeOperationMatch(
        getAccountPrincipalName(cuenta),
      );
      const secondaryKey = normalizeOperationMatch(
        getAccountSecondaryName(cuenta) || "",
      );
      return (
        principalKey === normalizeOperationMatch(principal) &&
        secondaryKey === normalizeOperationMatch(secondary || "")
      );
    });
    const ordered = sortAccountsByOrder(group);
    const accountId = getAccountRowId(account);
    const index = ordered.findIndex(
      (cuenta) => getAccountRowId(cuenta) === accountId,
    );
    if (index === -1) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= ordered.length) return;
    const neighbor = ordered[nextIndex];
    const currentOrder = getAccountOrder(account, index);
    const neighborOrder = getAccountOrder(neighbor, nextIndex);

    account.orden_presentacion = neighborOrder;
    neighbor.orden_presentacion = currentOrder;
    logChange("move", `Cuenta ${accountId} reordenada`);
    renderLayout();
  }

  function moveOperationOrder(label, opId, kind, direction) {
    const targetLabel = label || opId || "";
    if (!targetLabel) return;

    let targets = [];
    const direct = findOperationByIdOrLabel(opId || label);
    if (direct) {
      targets = [direct];
    } else {
      const match = findOperationsByRowLabel(targetLabel, kind || "");
      targets = match.operations || [];
    }

    if (!targets.length) {
      showToast("Operacion no encontrada para ordenar", "warning");
      return;
    }

    const directionValue = Number(direction || 0);
    if (!Number.isFinite(directionValue) || directionValue === 0) return;

    // Preferir reordenamiento global (filas de plantilla) para permitir mover sin restricciones por tipo.
    try {
      const templateRows = getTemplateRowsForReorder();
      if (templateRows.length) {
        const targetSet = new Set(targets);
        const indices = [];
        templateRows.forEach((rowItem, idx) => {
          if (!rowItem || rowItem.type !== "operation") return;
          const ops = findOperationsForOrderedRow(rowItem);
          if (ops.some((op) => targetSet.has(op))) {
            indices.push(idx);
          }
        });

        if (indices.length === 1) {
          moveTemplateRowOrder(indices[0], directionValue);
          return;
        }

        if (indices.length > 1) {
          const sorted = indices.slice().sort((a, b) => a - b);
          const firstIndex = sorted[0];
          const lastIndex = sorted[sorted.length - 1];
          const indexSet = new Set(sorted);
          const block = templateRows.filter((_, idx) => indexSet.has(idx));
          const remaining = templateRows.filter((_, idx) => !indexSet.has(idx));

          if (directionValue < 0) {
            let ref = firstIndex - 1;
            while (ref >= 0 && indexSet.has(ref)) ref -= 1;
            if (ref < 0) return;
            const before = templateRows[ref];
            let insertAt = remaining.indexOf(before);
            if (insertAt < 0) insertAt = 0;
            const reordered = remaining.slice();
            reordered.splice(insertAt, 0, ...block);
            applyTemplateRowsOrder(reordered, { silent: false });
            return;
          }

          if (directionValue > 0) {
            let ref = lastIndex + 1;
            while (ref < templateRows.length && indexSet.has(ref)) ref += 1;
            if (ref >= templateRows.length) return;
            const after = templateRows[ref];
            let insertAt = remaining.indexOf(after);
            if (insertAt < 0) insertAt = remaining.length;
            insertAt += 1;
            const reordered = remaining.slice();
            reordered.splice(insertAt, 0, ...block);
            applyTemplateRowsOrder(reordered, { silent: false });
            return;
          }
        }
      }
    } catch (error) {
      console.warn("No se pudo reordenar via filas de plantilla", error);
    }

    const ordered = sortOperations(state.operaciones || []);
    const targetSet = new Set(targets);
    const indices = ordered
      .map((item, idx) => (targetSet.has(item) ? idx : -1))
      .filter((idx) => idx >= 0);
    if (!indices.length) return;

    if (indices.length === 1) {
      const index = indices[0];
      const nextIndex = index + directionValue;
      if (nextIndex < 0 || nextIndex >= ordered.length) return;
      const op = ordered[index];
      const neighbor = ordered[nextIndex];
      const currentOrder = getOperationOrder(op, index);
      const neighborOrder = getOperationOrder(neighbor, nextIndex);

      op.orden_presentacion = neighborOrder;
      op.orden = neighborOrder;
      neighbor.orden_presentacion = currentOrder;
      neighbor.orden = currentOrder;
      logChange(
        "move",
        `Operacion "${getOperationDisplayName(op)}" reordenada`,
      );
      renderLayout();
      return;
    }

    const firstIndex = Math.min(...indices);
    const lastIndex = Math.max(...indices);
    if (directionValue < 0) {
      if (firstIndex === 0) return;
    } else if (directionValue > 0) {
      if (lastIndex >= ordered.length - 1) return;
    } else {
      return;
    }

    const block = ordered.filter((op) => targetSet.has(op));
    const remaining = ordered.filter((op) => !targetSet.has(op));
    let insertAt = 0;
    if (directionValue < 0) {
      const before = ordered[firstIndex - 1];
      insertAt = remaining.indexOf(before);
      if (insertAt < 0) insertAt = 0;
    } else {
      const after = ordered[lastIndex + 1];
      insertAt = remaining.indexOf(after);
      if (insertAt < 0) insertAt = remaining.length - 1;
      insertAt += 1;
    }

    const reordered = remaining.slice();
    reordered.splice(insertAt, 0, ...block);
    reordered.forEach((op, idx) => {
      if (!op) return;
      op.orden_presentacion = idx;
      op.orden = idx;
    });
    logChange("move", `Operacion "${targetLabel}" reordenada`);
    renderLayout();
  }

  function setAccountPrincipalName(cuenta, value) {
    if (!cuenta) return;
    const clean = (value || "").toString().trim();
    const targetKeys = [
      "SECCION Principal",
      "SECCIàN Principal",
      "SECCIÓN Principal",
      "SECCION PRINCIPAL",
      "SECCION",
      "SECCIÓN",
      "seccion_principal",
      "seccion",
    ];
    targetKeys.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(cuenta, key)) {
        cuenta[key] = clean;
      }
    });
    cuenta["SECCION Principal"] = clean;
    cuenta.SECCION = clean;
    cuenta.seccion_principal = clean;
  }

  function setAccountSecondaryName(cuenta, value) {
    if (!cuenta) return;
    const clean = (value || "").toString().trim();
    const targetKeys = [
      "SECCION Secundaria",
      "SECCION SECUNDARIA",
      "SECCIÓN Secundaria",
      "SECCIÓN SECUNDARIA",
      "seccion_secundaria",
      "SUBSECCION",
      "SUBSECCIÓN",
    ];
    targetKeys.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(cuenta, key)) {
        cuenta[key] = clean;
      }
    });
    cuenta["SECCION Secundaria"] = clean;
    cuenta.seccion_secundaria = clean;
  }

  function findOperationsForOrderedRow(row = {}) {
    const idCandidates = [row.opId, row.operationId]
      .map((value) => (value || "").toString().trim())
      .filter(Boolean);

    for (const candidate of idCandidates) {
      const byId = findOperationByIdStrict(candidate);
      if (byId) return [byId];
    }

    const labelCandidates = [row.operationLabel, row.label]
      .map((value) => (value || "").toString().trim())
      .filter(Boolean);
    for (const candidate of labelCandidates) {
      const key = normalizeOperationMatch(candidate);
      if (!key) continue;
      const byId = (state.operaciones || []).filter(
        (op) => normalizeOperationMatch(getOperationId(op)) === key,
      );
      if (byId.length === 1) return [byId[0]];
      const byLabel = (state.operaciones || []).filter(
        (op) => normalizeOperationMatch(getOperationLabel(op)) === key,
      );
      if (byLabel.length === 1) return [byLabel[0]];
    }

    const byLabel = findOperationsByRowLabel(row.label || "", row.kind || "");
    if (byLabel.operations?.length === 1) {
      return [byLabel.operations[0]];
    }

    if (byLabel.operations?.length > 1) {
      const parentSection = (row.parentSection || row.section || "")
        .toString()
        .trim();
      const parentSubsection = (row.parentSubsection || row.subsection || "")
        .toString()
        .trim();

      let narrowed = byLabel.operations.slice();
      const sectionKey = normalizeOperationMatch(parentSection);
      const subsectionKey = normalizeOperationMatch(parentSubsection);

      if (sectionKey) {
        const byParent = narrowed.filter((op) =>
          getOperationParentCandidates(op).some(
            (candidate) => normalizeOperationMatch(candidate) === sectionKey,
          ),
        );
        if (byParent.length) narrowed = byParent;
      }

      if (subsectionKey) {
        const byPlacement = narrowed.filter((op) =>
          getOperationPlacementCandidates(op).some(
            (candidate) => normalizeOperationMatch(candidate) === subsectionKey,
          ),
        );
        if (byPlacement.length) narrowed = byPlacement;
      }

      const unique = [];
      const seen = new Set();
      narrowed.forEach((op) => {
        const key = normalizeOperationMatch(
          getOperationId(op) || getOperationLabel(op) || "",
        );
        if (!key || seen.has(key)) return;
        seen.add(key);
        unique.push(op);
      });

      if (unique.length === 1) return unique;
      return [];
    }
    return [];
  }

  function getTemplateRowsForReorder() {
    const rows = Array.isArray(buildPreviewRowsForEditor())
      ? buildPreviewRowsForEditor()
      : [];
    return rows.filter((row) =>
      ["principal", "subsection", "account", "operation"].includes(row?.type),
    );
  }

  // ==============================
  // MANUAL STRUCTURE (Pilot)
  // ==============================
  // Estructura de secciones/subsecciones basada en el ORDEN REAL del template (buildPreviewRowsForEditor).
  // Esto evita "inventar" secciones a partir de campos legacy (secundaria->principal) y
  // mantiene consistencia entre: UI, reordenar, fórmulas, y placement.
  function buildManualSectionTree(rowsOverride = null) {
    const rows = Array.isArray(rowsOverride)
      ? rowsOverride
      : getTemplateRowsForReorder();
    const sections = [];
    const sectionMap = new Map(); // key -> { name, subsections: [] }

    const ensureSection = (name) => {
      const clean = (name || "").toString().trim();
      if (!clean) return null;
      const key = normalizeOperationMatch(clean);
      if (!key) return null;
      if (!sectionMap.has(key)) {
        const node = {
          name: clean,
          key,
          subsections: [],
          subsectionMap: new Map(),
        };
        sectionMap.set(key, node);
        sections.push(node);
      }
      return sectionMap.get(key);
    };

    const ensureSubsection = (sectionNode, name) => {
      if (!sectionNode) return null;
      const clean = (name || "").toString().trim();
      if (!clean) return null;
      const key = normalizeOperationMatch(clean);
      if (!key) return null;
      if (!sectionNode.subsectionMap.has(key)) {
        const node = { name: clean, key };
        sectionNode.subsectionMap.set(key, node);
        sectionNode.subsections.push(node);
      }
      return sectionNode.subsectionMap.get(key);
    };

    // 1) Preferimos cabeceras explícitas del preview (principal/subsection).
    rows.forEach((row) => {
      if (!row) return;
      if (row.type === "principal") {
        ensureSection(row.label || "");
        return;
      }
      if (row.type === "subsection") {
        const parent = (row.parentSection || "").toString().trim();
        if (!parent) return;
        const sectionNode = ensureSection(parent);
        ensureSubsection(sectionNode, row.label || "");
      }
    });

    // 2) Fallback: si por alguna razón no vinieron cabeceras, inferir por placement.
    rows.forEach((row) => {
      if (!row) return;
      if (row.type !== "account" && row.type !== "operation") return;
      const parentSection = (row.parentSection || row.section || "")
        .toString()
        .trim();
      const parentSubsection = (row.parentSubsection || row.subsection || "")
        .toString()
        .trim();
      if (!parentSection) return;
      const sectionNode = ensureSection(parentSection);
      if (parentSubsection) ensureSubsection(sectionNode, parentSubsection);
    });

    // Limpiar maps internas para no exponerlas fuera.
    return sections.map((sec) => ({
      name: sec.name,
      key: sec.key,
      subsections: (sec.subsections || []).map((sub) => ({
        name: sub.name,
        key: sub.key,
      })),
    }));
  }

  function getManualSectionNames() {
    return buildManualSectionTree()
      .map((s) => s.name)
      .filter(Boolean);
  }

  function getManualSubsectionNames(principal) {
    const targetKey = normalizeOperationMatch(principal || "");
    if (!targetKey) return [];
    const tree = buildManualSectionTree();
    const section = tree.find(
      (s) => normalizeOperationMatch(s.name) === targetKey,
    );
    if (!section) return [];
    return (section.subsections || []).map((s) => s.name).filter(Boolean);
  }

  function applyTemplateRowsOrder(orderedRows = [], options = {}) {
    const silent = Boolean(options?.silent);
    if (!Array.isArray(orderedRows) || !orderedRows.length) {
      return { success: false, message: "Sin filas para aplicar." };
    }

    const rows = orderedRows.filter((row) =>
      ["principal", "subsection", "account", "operation"].includes(row?.type),
    );
    if (!rows.length) {
      return { success: false, message: "Sin filas válidas para aplicar." };
    }

    let cursor = 0;

    const touchedAccounts = new Set();
    const touchedOperations = new Set();

    let currentPrincipal = "";
    let currentSubsection = "";

    const applyPlaceholderOrder = (row) => {
      const placeholderId = (row?.placeholderAccountId || "").toString().trim();
      if (!placeholderId) return;
      const placeholder = resolveAccountByIdOrCode(placeholderId);
      if (!placeholder) return;
      placeholder.orden_presentacion = cursor;
      placeholder.orden = cursor;
      // Mantener un hint local para que el editor refleje el orden manual
      // incluso antes de recargar desde layout_secciones.
      if (isPlaceholderAccount(placeholder)) {
        placeholder.__placeholderOrder = cursor;
      }
      touchedAccounts.add(getAccountRowId(placeholder));
    };

    rows.forEach((row) => {
      const type = row?.type || "";

      if (type === "principal") {
        currentPrincipal = (row.label || row.nombre || "").toString().trim();
        currentSubsection = "";
        applyPlaceholderOrder(row);
        cursor += 1;
        return;
      }

      if (type === "subsection") {
        currentSubsection = (row.label || row.nombre || "").toString().trim();
        applyPlaceholderOrder(row);
        cursor += 1;
        return;
      }

      if (type === "account") {
        const accountId =
          row.accountId || row.cuenta || row.label || row.codigo || "";
        const account = resolveAccountByIdOrCode(accountId);
        if (!account) return;

        const rowHasSection = Boolean(
          (row.parentSection || row.section || "").toString().trim(),
        );

        let targetSection = "";
        let targetSubsection = "";

        if (!rowHasSection) {
          // Item raíz: corta contexto de sección/subsección.
          currentPrincipal = "";
          currentSubsection = "";
        } else {
          targetSection = (
            currentPrincipal ||
            row.parentSection ||
            row.section ||
            row.parent ||
            ""
          )
            .toString()
            .trim();

          const isSubRow = Boolean(
            (row.parentSubsection ?? row.subsection ?? row.parentSub ?? "")
              .toString()
              .trim(),
          );
          if (isSubRow) {
            // Items nivel 2 siguen la subsección activa.
            targetSubsection = (currentSubsection || "").toString().trim();
          } else {
            // Items nivel 1: salen de cualquier subsección.
            targetSubsection = "";
            currentSubsection = "";
          }

          if (!targetSection) {
            targetSubsection = "";
          }
        }

        setAccountPrincipalName(account, targetSection);
        setAccountSecondaryName(account, targetSubsection);
        row.parentSection = targetSection;
        row.parentSubsection = targetSubsection;

        account.orden_presentacion = cursor;
        account.orden = cursor;
        touchedAccounts.add(getAccountRowId(account));
        cursor += 1;
        return;
      }

      if (type === "operation") {
        const rowHasSection = Boolean(
          (row.parentSection || row.section || "").toString().trim(),
        );

        let targetSection = "";
        let targetSubsection = "";

        if (!rowHasSection) {
          currentPrincipal = "";
          currentSubsection = "";
        } else {
          targetSection = (
            currentPrincipal ||
            row.parentSection ||
            row.section ||
            row.parent ||
            ""
          )
            .toString()
            .trim();

          const isSubRow = Boolean(
            (row.parentSubsection ?? row.subsection ?? row.parentSub ?? "")
              .toString()
              .trim(),
          );
          if (isSubRow) {
            targetSubsection = (currentSubsection || "").toString().trim();
          } else {
            targetSubsection = "";
            currentSubsection = "";
          }

          if (!targetSection) {
            targetSubsection = "";
          }
        }

        const ops = findOperationsForOrderedRow(row);
        if (!ops.length) {
          // Aun si no encontramos la operación, consumir un índice para que el orden no se descuadre.
          cursor += 1;
          return;
        }

        row.parentSection = targetSection;
        row.parentSubsection = targetSubsection;

        const aggregateKinds = new Set([
          "sum-row",
          "sum-row-sumavarios",
          "sum-row-sumavarios2",
          "sum-row-sumavarios-consolidado",
          "sum-row-operativo",
          "sum-row-operativo-consolidado",
          "result-row",
          "net-row",
          "net-row-adicional",
          "result-net-row",
        ]);
        const preservePlacement =
          aggregateKinds.has((row.kind || "").toString().trim()) ||
          ops.length !== 1;

        ops.forEach((op) => {
          if (!op) return;
          op.orden_presentacion = cursor;
          op.orden = cursor;
          if (!preservePlacement) {
            op.parentSection = targetSection || null;
            op.parentSubsection = targetSubsection || null;

            const placement = (targetSubsection || targetSection || "")
              .toString()
              .trim();
            op.SECCION = placement;
            op.seccion = placement;
            op.secciones = placement ? [placement] : [];
          }

          touchedOperations.add(op);
        });

        cursor += 1;
      }
    });

    (state.cuentas || []).forEach((cuenta, idx) => {
      const accountId = getAccountRowId(cuenta);
      if (touchedAccounts.has(accountId)) return;
      const fallbackOrder = cursor + idx;
      cuenta.orden_presentacion = fallbackOrder;
      cuenta.orden = fallbackOrder;
    });

    (state.operaciones || []).forEach((op, idx) => {
      if (touchedOperations.has(op)) return;
      const fallbackOrder = cursor + idx;
      op.orden_presentacion = fallbackOrder;
      op.orden = fallbackOrder;
    });

    state.cuentas = sortAccountsByOrder(state.cuentas || []);
    state.operaciones = sortOperations(state.operaciones || []);
    state.unsavedChanges = true;
    if (!silent) {
      updateButtonStates();
      logChange("move", "Orden manual aplicado desde Reordenar");
      renderLayout();
      updateLayoutOrderPanel();
    }

    return {
      success: true,
      accounts: touchedAccounts.size,
      operations: touchedOperations.size,
    };
  }

  function bindColumnConfigEvents() {
    if (!isModuloPiloto()) return;
    const table = dom.layoutPreview?.querySelector(".column-config-table");
    if (!table) return;
    const advancedToggle = dom.layoutPreview?.querySelector(
      "#toggleColumnAdvanced",
    );
    advancedToggle?.addEventListener("change", (event) => {
      state.columnConfigAdvanced = Boolean(event.target.checked);
      renderLayout();
    });
    const handler = (event) => {
      const target = event.target;
      const row = target.closest("tr[data-col-index]");
      if (!row) return;
      const index = Number(row.dataset.colIndex);
      if (!Number.isInteger(index)) return;
      const field = target.dataset.field;
      if (!field) return;
      if (!Array.isArray(state.columnasConfig)) return;
      const column = state.columnasConfig[index];
      if (!column) return;
      if (field === "editable") {
        column.editable = Boolean(target.checked);
      } else {
        column[field] = target.value;
      }
      if (!state.columnasConfigChanged) {
        logChange("edit", "Columnas de plantilla");
        state.columnasConfigChanged = true;
      } else {
        state.unsavedChanges = true;
        updateButtonStates();
      }
      if (field === "label") {
        const header = dom.layoutPreview?.querySelector(
          `.template-table thead th[data-col-index="${index}"]`,
        );
        if (header) {
          header.textContent = column.label || column.key || "";
        }
      }
    };
    table.addEventListener("input", handler);
    table.addEventListener("change", handler);
  }

  function buildOperacionesParaGuardar(operacionesBase = []) {
    const lista = [...(operacionesBase || [])];
    if (
      isModuloPiloto() &&
      Array.isArray(state.columnasConfig) &&
      state.columnasConfig.length
    ) {
      const opColumn = buildColumnConfigOperation(state.columnasConfig);
      if (opColumn) {
        lista.push(opColumn);
      }
    }
    if (isModuloPiloto() && state.layoutConfig) {
      const opLayout = buildLayoutConfigOperation(state.layoutConfig);
      if (opLayout) {
        lista.push(opLayout);
      }
    }
    const capituloFinal = (state.capitulo || "").toString();
    const hojaFinal = (state.modulo || "").toString();
    return lista.map((op) => {
      // No persistir solo metadatos efímeros de UI.
      // parentSection/parentSubsection sí se conservan para resolver homónimos.
      const { parent, section, subsection, __orden, __meta, ...rest } =
        op || {};

      // Los campos seccion_N y signos son necesarios para la compatibilidad
      // y se regeneran en applyStrictFormulaTermsToOperation.
      // Solo eliminamos operacion_N que puede causar conflictos.
      const sanitized = { ...rest };

      // Asegurar que signos existe para extractFormulaTokens
      if (!sanitized.signos) {
        sanitized.signos = {};
      }

      Object.keys(sanitized).forEach((key) => {
        if (/^operacion_\d+$/i.test(key)) {
          delete sanitized[key];
        }
      });

      if (!isColumnConfigOperation(sanitized) && !isLayoutConfigOperation(sanitized)) {
        const normalizedTokens = extractFormulaTokens(sanitized);
        const normalizedTerms = normalizeFormulaTerms(
          convertV2TokensToLegacyTerms(normalizedTokens),
        );
        applyStrictFormulaTermsToOperation(
          sanitized,
          normalizedTerms,
          normalizedTokens,
        );
      }

      return {
        ...sanitized,
        // Forzar capítulo/hoja al contexto actual para evitar variantes ("MÉXICO" vs "MEXICO")
        // y que el guardado parezca "no aplicar".
        CAPITULO: capituloFinal,
        HOJA: hojaFinal,
      };
    });
  }

  function isColumnConfigOperation(op) {
    if (!op) return false;
    const opId = normalizeOperationMatch(getOperationId(op));
    if (opId === normalizeOperationMatch(COLUMN_CONFIG_ID)) return true;
    if (op[COLUMN_CONFIG_FIELD] || op["columnas-config"]) return true;
    return false;
  }

  function isLayoutConfigOperation(op) {
    if (!op) return false;
    const opId = normalizeOperationMatch(getOperationId(op));
    if (opId === normalizeOperationMatch(LAYOUT_CONFIG_ID)) return true;
    if (op[LAYOUT_CONFIG_FIELD] || op["layoutconfig"]) return true;
    return false;
  }

  function extractLayoutConfigFromOperations(ops = []) {
    let layoutConfig = null;
    const operaciones = [];
    (ops || []).forEach((op) => {
      if (!isLayoutConfigOperation(op)) {
        operaciones.push(op);
        return;
      }
      if (!op.formula_json || layoutConfig) return;
      try {
        const parsed = JSON.parse(op.formula_json);
        if (parsed && typeof parsed === "object") {
          layoutConfig = parsed;
        }
      } catch (error) {
        console.warn("No se pudo leer layout config", error);
      }
    });
    return { layoutConfig, operaciones };
  }

  function buildLayoutConfigOperation(config = {}) {
    return {
      CAPITULO: state.capitulo || "",
      HOJA: state.modulo || "",
      Clase: LAYOUT_CONFIG_ID,
      OperacionId: LAYOUT_CONFIG_ID,
      SECCION: "",
      [LAYOUT_CONFIG_FIELD]: LAYOUT_CONFIG_ID,
      formula_json: JSON.stringify(config),
      visible: false,
      orden: -2,
      orden_presentacion: -2,
    };
  }

  function extractColumnConfigFromOperations(ops = []) {
    let columnasConfig = null;
    const operaciones = [];
    (ops || []).forEach((op) => {
      if (!isColumnConfigOperation(op)) {
        operaciones.push(op);
        return;
      }
      if (!op.formula_json || columnasConfig) return;
      try {
        const parsed = JSON.parse(op.formula_json);
        if (Array.isArray(parsed)) {
          columnasConfig = parsed;
        } else if (Array.isArray(parsed?.columns)) {
          columnasConfig = parsed.columns;
        } else if (Array.isArray(parsed?.columnas)) {
          columnasConfig = parsed.columnas;
        }
      } catch (error) {
        console.warn("No se pudo leer columnas config", error);
      }
    });
    return { columnasConfig, operaciones };
  }

  function buildColumnConfigOperation(columns = []) {
    if (!Array.isArray(columns) || !columns.length) return null;
    return {
      CAPITULO: state.capitulo || "",
      HOJA: state.modulo || "",
      Clase: COLUMN_CONFIG_ID,
      OperacionId: COLUMN_CONFIG_ID,
      SECCION: "",
      [COLUMN_CONFIG_FIELD]: COLUMN_CONFIG_ID,
      formula_json: JSON.stringify(columns),
      visible: false,
      orden: -1,
      orden_presentacion: -1,
    };
  }

  function resolveColumnYear() {
    const raw = (state.anio || "").toString().trim();
    const year = raw || String(new Date().getFullYear());
    const yearShort = year.length >= 2 ? year.slice(-2) : year;
    return { year, yearShort };
  }

  function buildComitesColumnConfig() {
    const { year, yearShort } = resolveColumnYear();
    const moduloLabel = state.modulo || "Comites";
    const months = [
      { key: "ene", label: "ENE" },
      { key: "feb", label: "FEB" },
      { key: "mar", label: "MAR" },
      { key: "abr", label: "ABR" },
      { key: "may", label: "MAY" },
      { key: "jun", label: "JUN" },
      { key: "jul", label: "JUL" },
      { key: "ago", label: "AGO" },
      { key: "sep", label: "SEP" },
      { key: "oct", label: "OCT" },
      { key: "nov", label: "NOV" },
      { key: "dic", label: "DIC" },
    ];
    const columns = [
      { key: "cuenta", label: "Cuenta", operacion: "none", editable: false },
      {
        key: "descripcion",
        label: moduloLabel,
        operacion: "none",
        editable: false,
      },
      {
        key: "budget-annual",
        label: `Presupuesto ${year}`,
        operacion: "sum-horizontal",
        editable: false,
      },
    ];
    months.forEach((mes) => {
      columns.push({
        key: `budget-${mes.key}`,
        label: `${mes.label}-${yearShort}`,
        operacion: "input",
        editable: true,
      });
      columns.push({
        key: `real-${mes.key}`,
        label: `${mes.label}-${yearShort}`,
        operacion: "readonly",
        editable: false,
      });
    });
    columns.push({
      key: "total-budget",
      label: `Ppto. Acumulado ${year}`,
      operacion: "sum-horizontal",
      editable: false,
    });
    columns.push({
      key: "total-real",
      label: `Real Acumulado ${year}`,
      operacion: "sum-horizontal",
      editable: false,
    });
    return columns;
  }

  function buildDefaultColumnConfig() {
    const moduloKey = normalizeOperationMatch(state.modulo);
    const useComitesConfig =
      isModuloPiloto() &&
      moduloKey !== "summary" &&
      moduloKey !== "resumen" &&
      moduloKey !== "presupuestos";
    if (useComitesConfig) {
      return buildComitesColumnConfig();
    }
    const meses = [
      "Ene",
      "Feb",
      "Mar",
      "Abr",
      "May",
      "Jun",
      "Jul",
      "Ago",
      "Sep",
      "Oct",
      "Nov",
      "Dic",
    ];
    const columns = [
      { key: "cuenta", label: "Cuenta", operacion: "none", editable: false },
      {
        key: "descripcion",
        label: "Descripcion",
        operacion: "none",
        editable: false,
      },
    ];
    meses.forEach((mes) => {
      const key = mes.toLowerCase();
      columns.push({
        key: `budget-${key}`,
        label: `Ppto ${mes}`,
        operacion: "input",
        editable: true,
      });
      columns.push({
        key: `real-${key}`,
        label: `Real ${mes}`,
        operacion: "readonly",
        editable: false,
      });
    });
    columns.push({
      key: "total-budget",
      label: "Total Ppto",
      operacion: "sum-horizontal",
      editable: false,
    });
    columns.push({
      key: "total-real",
      label: "Total Real",
      operacion: "sum-horizontal",
      editable: false,
    });
    columns.push({
      key: "budget-annual",
      label: "Ppto Anual",
      operacion: "sum-horizontal",
      editable: false,
    });
    columns.push({
      key: "budget-monthly",
      label: "Real Mes Actual",
      operacion: "lookup",
      editable: false,
    });
    return columns;
  }

  function normalizeSumasCapitulo(value) {
    const key = normalizeOperationMatch(value);
    if (key === "cdmx") return "ciudaddemexico";
    if (key === "ne") return "noreste";
    if (key === "no") return "noroeste";
    return key;
  }

  function findKeyByNormalized(
    obj,
    target,
    normalizer = normalizeOperationMatch,
  ) {
    if (!obj) return null;
    const targetKey = normalizer(target);
    if (!targetKey) return null;
    return (
      Object.keys(obj).find((key) => normalizer(key) === targetKey) || null
    );
  }

  function getSumasConfigForContext() {
    return null;
  }

  function getSumasConfigForSection(sumasConfig, sectionName) {
    return null;
  }

  function applySumasField(op, field, value, fallback = "") {
    const label = (value || fallback || "").toString().trim();
    if (!label) return false;
    if (!op[field]) {
      op[field] = label;
      return true;
    }
    return false;
  }

  function buildSumasOperacion(sectionName, config, order) {
    const sumRowLabel = (config?.sumRow || "").toString().trim();
    const fallbackLabel = sectionName ? `Suma ${sectionName}` : "Suma";
    const orderValue = Number.isFinite(Number(order))
      ? Number(order)
      : nextOperationOrder();
    const opId = buildUniqueOperationId(sumRowLabel || fallbackLabel);
    const op = {
      CAPITULO: state.capitulo || "",
      HOJA: state.modulo || "",
      Clase: sumRowLabel || fallbackLabel,
      OperacionId: opId,
      SECCION: sectionName || "",
      visible: true,
      signos: {},
      orden: orderValue,
      orden_presentacion: orderValue,
    };
    applySumasField(op, "sum-row", config?.sumRow, fallbackLabel);
    applySumasField(op, "sum-row-sumavarios", config?.sumRowSumavarios);
    applySumasField(op, "sum-row-sumavarios2", config?.sumRowSumavarios2);
    applySumasField(op, "result-row", config?.resultRow);
    return op;
  }

  function syncOperacionesSumasDesdeConfig() {
    const sections = groupBySections(state.cuentas || []);
    if (!sections.length) return { added: 0, updated: 0 };

    const existingBySection = new Map();

    (state.operaciones || []).forEach((op) => {
      const sectionKey = normalizeOperationMatch(op?.SECCION || op?.seccion);
      if (sectionKey && !existingBySection.has(sectionKey)) {
        existingBySection.set(sectionKey, op);
      }
    });

    let added = 0;

    sections.forEach((section) => {
      const sectionName = section?.name || "";
      if (!sectionName) return;
      const sectionKey = normalizeOperationMatch(sectionName);
      if (!sectionKey || existingBySection.has(sectionKey)) return;

      const op = buildSumasOperacion(sectionName, null, section.order);
      state.operaciones.push(op);
      existingBySection.set(sectionKey, op);
      added += 1;
    });

    if (added) {
      state.operaciones = sortOperations(state.operaciones);
      ensureOperationIds();
      // normalizeOperationReferences(); // DESACTIVADO: modo 100% manual
      state.unsavedChanges = true;
      updateButtonStates();
      logChange("add", `Operaciones sumas (${added})`);
    }

    return { added, updated: 0 };
  }

  function syncOperativoPorNombreOps() {
    if (!isModuloPiloto()) return { added: 0 };
    const ops = buildOperativoPorNombreOps(state.cuentas);
    if (!ops.length) return { added: 0 };
    const existing = new Set();
    state.operaciones.forEach((op) => {
      const label =
        op?.["sum-row-operativo"] ||
        getOperationDisplayName(op) ||
        op?.Clase ||
        "";
      if (label) {
        existing.add(normalizeOperationMatch(label));
      }
    });
    let added = 0;
    ops.forEach((op) => {
      const label = op?.["sum-row-operativo"];
      const key = normalizeOperationMatch(label);
      if (!key || existing.has(key)) return;
      state.operaciones.push(op);
      existing.add(key);
      added += 1;
    });
    if (added) {
      state.operaciones = sortOperations(state.operaciones);
      logChange("add", `Operaciones Resultado Operativo (${added})`);
    }
    return { added };
  }

  function buildOperativoPorNombreOps(cuentas = []) {
    if (!Array.isArray(cuentas) || !cuentas.length) return [];
    const cuentasOrdenadas = sortAccountsByOrder(cuentas);
    const grupos = new Map();
    cuentasOrdenadas.forEach((cuenta, idx) => {
      const nombre = (cuenta?.NOMBRE || cuenta?.nombre || "").toString().trim();
      if (!nombre) return;
      const seccion =
        cuenta["SECCI…N Principal"] ||
        cuenta["SECCIàN Principal"] ||
        cuenta["SECCION Principal"] ||
        cuenta["SECCI.N Principal"] ||
        cuenta["SECCION PRINCIPAL"] ||
        cuenta.SECCION ||
        cuenta.seccion_principal ||
        cuenta["SECCI…N Secundaria"] ||
        cuenta["SECCIàN Secundaria"] ||
        cuenta["SECCION Secundaria"] ||
        cuenta.seccion_secundaria ||
        "";
      const signo = getOperativoSignForSection(seccion);
      if (!signo) return;
      const clave = normalizeOperativoNombre(nombre);
      if (!clave) return;
      const cuentaId = cuenta.CUENTA || cuenta.cuenta || "";
      if (!cuentaId) return;
      const existente = grupos.get(clave) || {
        clave,
        nombre,
        ingresos: new Set(),
        gastos: new Set(),
        orden: idx,
      };
      if (nombre.length > existente.nombre.length) {
        existente.nombre = nombre;
      }
      if (signo > 0) {
        existente.ingresos.add(cuentaId);
      } else {
        existente.gastos.add(cuentaId);
      }
      if (idx < existente.orden) existente.orden = idx;
      grupos.set(clave, existente);
    });
    const operaciones = [];
    grupos.forEach((grupo) => {
      if (!grupo.ingresos.size || !grupo.gastos.size) return;
      const label = `Resultado Operativo ${grupo.nombre}`;
      const baseId = normalizeOperationId(`OPERATIVO_${grupo.clave}`);
      const opId = buildUniqueOperationId(baseId);
      const terms = [];
      grupo.ingresos.forEach((cuenta) => {
        terms.push({ operator: "+", type: "account", value: cuenta });
      });
      grupo.gastos.forEach((cuenta) => {
        terms.push({ operator: "-", type: "account", value: cuenta });
      });
      const normalizedTerms = normalizeFormulaTerms(terms);
      const formulaTerms = normalizedTerms.map((term, idx) => ({
        id: Date.now() + idx,
        ...term,
      }));
      const formulaTokens = convertLegacyTermsToV2Tokens(formulaTerms);
      operaciones.push({
        CAPITULO: state.capitulo || "",
        HOJA: state.modulo || "",
        Clase: label,
        OperacionId: opId,
        SECCION: "Resultado Operativo",
        "sum-row-operativo": label,
        formula_terms: formulaTerms,
        formula_json: serializeFormulaV2(formulaTokens),
        signos: { "sum-row-operativo": 1 },
        visible: true,
        orden: grupo.orden,
        orden_presentacion: grupo.orden,
      });
    });
    return operaciones.sort(
      (a, b) => getOperationOrder(a) - getOperationOrder(b),
    );
  }

  function normalizeOperativoNombre(value) {
    const cleaned = (value || "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();
    const tokens = cleaned
      .replace(/[^A-Z0-9\s]+/g, " ")
      .split(/\s+/)
      .filter(Boolean);
    const filtered = tokens.filter(
      (token) => !OPERATIVO_STOP_WORDS.has(token.toLowerCase()),
    );
    if (!filtered.length) return "";
    if (isModuloPiloto()) {
      filtered.sort();
    }
    return filtered.join(" ");
  }

  function getOperativoSignForSection(sectionName) {
    const key = normalizeOperationMatch(sectionName);
    if (!key) return 0;
    const moduloKey = normalizeOperationMatch(state.modulo);
    if (moduloKey === "eventos") {
      if (key.includes("costo") || key.includes("gasto")) return -1;
      return 1;
    }
    if (key.includes("ingreso")) return 1;
    if (key.includes("gasto") || key.includes("costo")) return -1;
    if (moduloKey === "comites" && key.includes("comision")) return -1;
    return 0;
  }

  function renderEditableLayout() {
    if (!state.cuentas.length && !state.operaciones.length) {
      return `
        <div class="empty-state">
          <i class="bi bi-inbox"></i>
          <p>No hay elementos en este layout</p>
          <button class="btn btn-success btn-sm" onclick="document.getElementById('btnAgregar').click()">
            <i class="bi bi-plus-circle me-1"></i>Agregar primer elemento
          </button>
        </div>
      `;
    }

    if (isModuloPiloto()) {
      return renderEditableLayoutPiloto();
    }

    const sections = groupBySections(state.cuentas);
    let html = "";
    const renderedInlineOps = new Set();

    sections.forEach((section) => {
      const principal = section.name;
      const principalLower = principal.toLowerCase();
      const isIncomeSection = principalLower.includes("income");
      const isExpenseSection = principalLower.includes("expense");

      section.subsections.forEach(({ accounts, name: subsectionName }) => {
        const matchingOps = state.operaciones.filter((op) => {
          const clase = (getOperationLabel(op) || "").toLowerCase();

          const isIncomeOp = clase.includes("income");
          const isExpenseOp = clase.includes("expense");
          if (isIncomeSection && isExpenseOp) return false;
          if (isExpenseSection && isIncomeOp) return false;

          if (
            op.parentSubsection &&
            op.parentSubsection.toLowerCase() === subsectionName.toLowerCase()
          ) {
            if (op.parentSection) {
              return op.parentSection.toLowerCase() === principalLower;
            }
            return true;
          }

          if (operationMatchesRowLabel(op, subsectionName)) {
            if (op.parentSection) {
              return op.parentSection.toLowerCase() === principalLower;
            }
            return true;
          }

          const claseNorm = clase.replace(/[-_\s]/g, "");
          const subsectionNorm = subsectionName
            .toLowerCase()
            .replace(/[-_\s]/g, "");
          if (
            claseNorm.includes(subsectionNorm) ||
            subsectionNorm.includes(claseNorm)
          ) {
            if (!op.secciones || op.secciones.length <= 1) {
              return true;
            }
          }
          return false;
        });
        matchingOps.forEach((op) =>
          renderedInlineOps.add(getOperationId(op) || op.Clase || op),
        );
      });
      html += renderSection(section);
    });

    html += renderAllOperationsByTable(renderedInlineOps);
    return html;
  }

  // Renderizar TODAS las operaciones organizadas por su tabla de aparición
  function renderAllOperationsByTable(renderedInlineOps) {
    let html = "";

    // Obtener operaciones ordenadas
    const ordenadas = sortOperations(state.operaciones);

    // Verificar si hay operaciones
    if (ordenadas.length === 0) {
      return "";
    }

    // Agrupar operaciones por tabla donde aparecen (para estadísticas)
    const operationsByTable = {
      chapterTotals: [], // Totales por capítulo (CDMX INCOME, MTY EXPENSE, etc.)
      chapterOperating: [], // Operativo por capítulo (CDMX OPERATING, MTY OPERATING, etc.)
      chapterResults: [], // Resultados por capítulo (CDMX RESULTS, MTY RESULTS, etc.)
      consolidated: [], // Consolidados (CONSOLIDATED INCOME, EXPENSE, etc.)
      consolidatedOperating: [], // CONSOLIDATED OPERATING RESULTS
      results: [], // Resultados consolidados (RESULTS)
      netResults: [], // Resultados netos (NET RESULTS, CONSOLIDATED NET RESULTS)
    };

    // Clasificar TODAS las operaciones para estadísticas
    ordenadas.forEach((op) => {
      const clase = (getOperationLabel(op) || "").toLowerCase();
      const opId = (getOperationId(op) || "").toLowerCase();
      const combined = `${clase} ${opId}`;

      // Clasificar por tipo de fila donde aparece (prioridad: más específico primero)
      if (
        op["result-net-row"] ||
        op["net-row"] ||
        combined.includes("net result")
      ) {
        operationsByTable.netResults.push(op);
      } else if (
        op["result-row"] ||
        (combined.includes(" results") && !combined.includes("operating"))
      ) {
        operationsByTable.results.push(op);
      } else if (
        combined.includes("consolidated operating") ||
        combined.includes("consolidated_operating")
      ) {
        operationsByTable.consolidatedOperating.push(op);
      } else if (
        op["sum-row-operativo"] ||
        combined.includes("operating result")
      ) {
        // Distinguir entre operativo de capítulo y consolidado
        if (combined.includes("consolidated")) {
          operationsByTable.consolidatedOperating.push(op);
        } else if (
          combined.match(/(cdmx|mty|gdl|noreste|noroeste).*operating/)
        ) {
          operationsByTable.chapterOperating.push(op);
        } else {
          operationsByTable.chapterOperating.push(op);
        }
      } else if (
        op["sum-row-sumavarios-consolidado"] ||
        combined.includes("consolidated")
      ) {
        operationsByTable.consolidated.push(op);
      } else if (op["sum-row-sumavarios"] || op["sum-row"]) {
        // Distinguir entre totales de capítulo y resultados de capítulo
        if (
          combined.match(
            /(cdmx|mty|gdl|noreste|noroeste).*(income|expense|ingreso|gasto)/,
          )
        ) {
          operationsByTable.chapterTotals.push(op);
        } else if (
          combined.match(/(cdmx|mty|gdl|noreste|noroeste).*results?/)
        ) {
          operationsByTable.chapterResults.push(op);
        } else {
          operationsByTable.chapterTotals.push(op);
        }
      } else {
        // Clasificación por nombre cuando no hay etiquetas
        if (combined.includes("net") || combined.includes("neto")) {
          operationsByTable.netResults.push(op);
        } else if (combined.includes("consolidated operating")) {
          operationsByTable.consolidatedOperating.push(op);
        } else if (
          combined.match(/(cdmx|mty|gdl|noreste|noroeste).*operating/)
        ) {
          operationsByTable.chapterOperating.push(op);
        } else if (
          combined.match(/(cdmx|mty|gdl|noreste|noroeste).*results?/)
        ) {
          operationsByTable.chapterResults.push(op);
        } else if (combined.includes("consolidated")) {
          operationsByTable.consolidated.push(op);
        } else if (combined.includes("result")) {
          operationsByTable.results.push(op);
        } else if (combined.match(/(cdmx|mty|gdl|noreste|noroeste)/)) {
          operationsByTable.chapterTotals.push(op);
        } else {
          operationsByTable.chapterTotals.push(op);
        }
      }
    });

    // Renderizar cada tabla en orden
    const tableSections = [
      {
        key: "chapterTotals",
        title: "Totales por Capítulo",
        icon: "bi-geo-alt-fill",
        color: "info",
        description:
          "Sumas de cada capítulo (CDMX INCOME, MTY EXPENSE, NORESTE INCOME, etc.)",
      },
      {
        key: "chapterOperating",
        title: "Operativo por Capítulo",
        icon: "bi-calculator",
        color: "primary",
        description:
          "Resultado operativo de cada capítulo (CDMX OPERATING, MTY OPERATING, etc.)",
      },
      {
        key: "chapterResults",
        title: "Resultados por Capítulo",
        icon: "bi-clipboard-data",
        color: "secondary",
        description:
          "Resultados totales de cada capítulo (CDMX RESULTS, MTY RESULTS, etc.)",
      },
      {
        key: "consolidated",
        title: "Consolidados",
        icon: "bi-collection-fill",
        color: "success",
        description:
          "Consolidación de múltiples capítulos (CONSOLIDATED INCOME, CONSOLIDATED EXPENSE, etc.)",
      },
      {
        key: "consolidatedOperating",
        title: "Operativo Consolidado",
        icon: "bi-graph-up-arrow",
        color: "info",
        description:
          "Resultado operativo consolidado (CONSOLIDATED OPERATING RESULTS)",
      },
      {
        key: "results",
        title: "Resultados",
        icon: "bi-calculator-fill",
        color: "warning",
        description: "Resultados antes de neto (RESULTS)",
      },
      {
        key: "netResults",
        title: "Resultados Netos",
        icon: "bi-cash-stack",
        color: "danger",
        description:
          "Resultado neto final (NET RESULTS, CONSOLIDATED NET RESULTS)",
      },
    ];

    // Contar total de operaciones
    const totalOps = ordenadas.length;

    // Agregar encabezado general
    if (totalOps > 0) {
      html += `
        <div class="all-operations-header mt-4 mb-3">
          <div class="card border-0 shadow-sm">
            <div class="card-body bg-gradient" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
              <div class="d-flex align-items-center justify-content-between text-white">
                <div>
                  <h4 class="mb-1 fw-bold"><i class="bi bi-calculator-fill me-2"></i>Todas las Operaciones</h4>
                  <p class="mb-0 opacity-75">Orden secuencial de aparición en el layout</p>
                </div>
                <div class="text-end">
                  <div class="display-4 fw-bold">${totalOps}</div>
                  <small>Operaciones totales</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    // Renderizar operaciones en ORDEN SECUENCIAL (no agrupadas)
    html += `
      <div class="operations-sequential-list mt-3">
        <div class="table-section-content">
          ${ordenadas
        .map((op, idx) => {
          // Determinar color según tipo
          let color = "secondary";
          const clase = (getOperationLabel(op) || "").toLowerCase();
          const opId = (getOperationId(op) || "").toLowerCase();
          const combined = `${clase} ${opId}`;

          if (op["result-net-row"] || combined.includes("net result")) {
            color = "danger";
          } else if (
            op["sum-row-operativo"] ||
            combined.includes("operating")
          ) {
            color = "primary";
          } else if (
            op["sum-row-sumavarios-consolidado"] ||
            combined.includes("consolidated")
          ) {
            color = "success";
          } else if (op["sum-row-sumavarios"]) {
            color = "info";
          } else if (op["sum-row"]) {
            color = "warning";
          }

          return renderOperationCardWithOrder(op, color, idx + 1);
        })
        .join("")}
        </div>
      </div>
    `;

    return html;
  }

  // Renderizar tarjeta de operación con número de orden
  function renderOperationCardWithOrder(op, colorTheme, displayOrder) {
    const opId = getOperationId(op);
    const clase = getOperationLabel(op) || "Operacion";
    const displayName = getOperationDisplayName(op);
    const orden = getOperationOrder(op, displayOrder);
    const termsCount = op.formula_terms?.length || 0;
    const isVisible = op.visible !== false;
    const hiddenClass = !isVisible ? "hidden-row" : "";
    const canEdit = state.editMode;
    const disabledAttr = !canEdit ? "disabled" : "";

    // Obtener el nombre de la fila donde aparece
    const rowLabels = [];
    const rowFields = [
      { field: "sum-row", label: "Fila de Suma" },
      { field: "sum-row-sumavarios", label: "Suma Varios" },
      { field: "sum-row-sumavarios2", label: "Suma Varios 2" },
      { field: "sum-row-sumavarios-consolidado", label: "Consolidado" },
      { field: "sum-row-operativo", label: "Operativo" },
      { field: "result-row", label: "Resultado" },
      { field: "net-row", label: "Neto" },
      { field: "result-net-row", label: "Resultado Neto" },
    ];

    rowFields.forEach(({ field, label }) => {
      if (op[field]) {
        rowLabels.push(
          `<span class="badge bg-${colorTheme} bg-opacity-75">${label}: ${escapeHtml(
            op[field],
          )}</span>`,
        );
      }
    });

    // Mostrar términos de la fórmula
    let termsHtml = "";
    if (op.formula_terms && op.formula_terms.length > 0) {
      termsHtml = `
        <div class="formula-terms-preview mt-2">
          <small class="text-muted d-block mb-1"><i class="bi bi-equation"></i> Fórmula:</small>
          <div class="d-flex flex-wrap gap-1">
            ${op.formula_terms
          .map(
            (term, idx) => `
              <span class="badge bg-light text-dark border">
                ${idx > 0 ? term.operator + " " : ""}${escapeHtml(
              term.type === "operation"
                ? formatOperationReference(term.value)
                : term.type === "constant"
                  ? (term.constant ?? term.value ?? "0")
                  : term.value || "???",
            )}
              </span>
            `,
          )
          .join("")}
          </div>
        </div>
      `;
    }

    // Mostrar cuentas si es sum-row
    let cuentasHtml = "";
    if (op.SECCION || (op.cuentas && op.cuentas.length > 0)) {
      const cuentasList =
        op.cuentas || op.SECCION?.split("+").map((c) => c.trim()) || [];
      if (cuentasList.length > 0) {
        cuentasHtml = `
          <div class="cuentas-preview mt-2">
            <small class="text-muted d-block mb-1"><i class="bi bi-list-ul"></i> Cuentas:</small>
            <div class="d-flex flex-wrap gap-1">
              ${cuentasList
            .slice(0, 5)
            .map(
              (cuenta) => `
                <code class="badge bg-light text-dark border">${escapeHtml(cuenta)}</code>
              `,
            )
            .join("")}
              ${cuentasList.length > 5 ? `<span class="badge bg-secondary">+${cuentasList.length - 5} más</span>` : ""}
            </div>
          </div>
        `;
      }
    }

    return `
      <div class="operation-card border-${colorTheme} mb-2 p-3 rounded border-start border-4 bg-white shadow-sm hover-shadow ${hiddenClass}" data-operation-id="${escapeAttr(
      opId || "",
    )}" data-operation-label="${escapeAttr(displayName)}">
        <div class="d-flex align-items-start justify-content-between">
          <div class="d-flex gap-3 flex-grow-1">
            <div class="orden-badge">
              <div class="badge bg-${colorTheme} rounded-circle" style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: bold;">
                ${orden}
              </div>
            </div>
            <div class="flex-grow-1">
              <div class="d-flex align-items-center gap-2 mb-2">
                <i class="bi bi-calculator text-${colorTheme}"></i>
                <strong class="text-${colorTheme}">${escapeHtml(
      displayName,
    )}</strong>
                ${termsCount > 0
        ? `<span class="badge bg-secondary">${termsCount} términos</span>`
        : ""
      }
              </div>
              <div class="mb-2">
                <small class="text-muted">Etiqueta: </small>
                <code class="text-dark">${escapeHtml(clase)}</code>
                <small class="text-muted ms-2">ID: </small>
                <code class="text-dark">${escapeHtml(opId || "")}</code>
              </div>
              ${rowLabels.length > 0
        ? `
                <div class="d-flex flex-wrap gap-1 mb-2">
                  ${rowLabels.join("")}
                </div>
              `
        : ""
      }
              ${termsHtml}
              ${cuentasHtml}
            </div>
          </div>
          <div class="d-flex flex-column gap-1">
            ${window.LayoutControls
        ? window.LayoutControls.renderVisibilityControl(op, "operation")
        : ""
      }
            ${window.LayoutControls
        ? window.LayoutControls.renderOrderControl(op, "operation")
        : ""
      }
            <button class="btn btn-sm btn-outline-primary" onclick="window.editOperation('${escapeAttr(
        opId || clase,
      ).replace(/'/g, "\\'")}')" ${disabledAttr}>
              <i class="bi bi-pencil"></i> Editar
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="window.deleteOperation('${escapeAttr(
        opId || clase,
      ).replace(/'/g, "\\'")}')" ${disabledAttr}>
              <i class="bi bi-trash"></i> Eliminar
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // Renderizar tarjeta de operación con detalles completos (función legacy para compatibilidad)
  function renderOperationCard(op, colorTheme) {
    const opId = getOperationId(op);
    const clase = getOperationLabel(op) || "Operacion";
    const displayName = getOperationDisplayName(op);
    const formula = formatFormula(op);
    const termsCount = op.formula_terms?.length || 0;
    const isVisible = op.visible !== false;
    const hiddenClass = !isVisible ? "hidden-row" : "";
    const canEdit = state.editMode;
    const disabledAttr = !canEdit ? "disabled" : "";

    // Obtener el nombre de la fila donde aparece
    const rowLabels = [];
    const rowFields = [
      { field: "sum-row", label: "Fila de Suma" },
      { field: "sum-row-sumavarios", label: "Suma Varios" },
      { field: "sum-row-sumavarios2", label: "Suma Varios 2" },
      { field: "sum-row-sumavarios-consolidado", label: "Consolidado" },
      { field: "sum-row-operativo", label: "Operativo" },
      { field: "result-row", label: "Resultado" },
      { field: "net-row", label: "Neto" },
      { field: "result-net-row", label: "Resultado Neto" },
    ];

    rowFields.forEach(({ field, label }) => {
      if (op[field]) {
        rowLabels.push(
          `<span class="badge bg-${colorTheme} bg-opacity-75">${label}: ${escapeHtml(
            op[field],
          )}</span>`,
        );
      }
    });

    // Mostrar términos de la fórmula
    let termsHtml = "";
    if (op.formula_terms && op.formula_terms.length > 0) {
      termsHtml = `
        <div class="formula-terms-preview mt-2">
          <small class="text-muted d-block mb-1"><i class="bi bi-equation"></i> Fórmula:</small>
          <div class="d-flex flex-wrap gap-1">
            ${op.formula_terms
          .map(
            (term, idx) => `
              <span class="badge bg-light text-dark border">
                ${idx > 0 ? term.operator + " " : ""}${escapeHtml(
              term.type === "operation"
                ? formatOperationReference(term.value)
                : term.type === "constant"
                  ? (term.constant ?? term.value ?? "0")
                  : term.value || "???",
            )}
              </span>
            `,
          )
          .join("")}
          </div>
        </div>
      `;
    }

    return `
      <div class="operation-card border-${colorTheme} mb-2 p-3 rounded border-start border-3 bg-white shadow-sm hover-shadow ${hiddenClass}" data-operation-id="${escapeAttr(
      opId || "",
    )}" data-operation-label="${escapeAttr(displayName)}">
        <div class="d-flex align-items-start justify-content-between">
          <div class="flex-grow-1">
            <div class="d-flex align-items-center gap-2 mb-2">
              <i class="bi bi-calculator text-${colorTheme}"></i>
              <strong class="text-${colorTheme}">${escapeHtml(
      displayName,
    )}</strong>
              ${termsCount > 0
        ? `<span class="badge bg-secondary">${termsCount} términos</span>`
        : ""
      }
            </div>
            <div class="mb-2">
              <small class="text-muted">Etiqueta: </small>
              <code class="text-dark">${escapeHtml(clase)}</code>
              <small class="text-muted ms-2">ID: </small>
              <code class="text-dark">${escapeHtml(opId || "")}</code>
            </div>
            ${rowLabels.length > 0
        ? `
              <div class="d-flex flex-wrap gap-1 mb-2">
                ${rowLabels.join("")}
              </div>
            `
        : ""
      }
            ${termsHtml}
          </div>
          <div class="d-flex flex-column gap-1">
            ${window.LayoutControls
        ? window.LayoutControls.renderVisibilityControl(op, "operation")
        : ""
      }
            ${window.LayoutControls
        ? window.LayoutControls.renderOrderControl(op, "operation")
        : ""
      }
            <button class="btn btn-sm btn-outline-primary" onclick="window.editOperation('${escapeAttr(
        opId || clase,
      ).replace(/'/g, "\\'")}')" ${disabledAttr}>
              <i class="bi bi-pencil"></i> Editar
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="window.deleteOperation('${escapeAttr(
        opId || clase,
      ).replace(/'/g, "\\'")}')" ${disabledAttr}>
              <i class="bi bi-trash"></i> Eliminar
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // Render section-level operations (only those NOT already rendered inline) - LEGACY
  function renderSectionLevelOperationsLegacy(renderedInlineOps) {
    let html = "";
    const sectionLevelOps = state.operaciones.filter((op) => {
      // Skip if already rendered inline
      if (renderedInlineOps.has(getOperationId(op) || op.Clase)) {
        return false;
      }
      // Include operations that are multi-section totals (Consolidated Income, etc.)
      return true;
    });

    // ALSO extract unique consolidated labels from all operations
    // These are the GENERATED rows like CDMX INCOME, CONSOLIDATED INCOME, NET RESULTS, etc.
    const consolidatedLabels = new Map(); // label -> { type, operations that contribute }
    const labelTypes = [
      {
        field: "sum-row-sumavarios",
        type: "section-total",
        icon: "bi-bar-chart-fill",
        color: "primary",
      },
      {
        field: "sum-row-sumavarios2",
        type: "section-total-2",
        icon: "bi-bar-chart-fill",
        color: "primary",
      },
      {
        field: "sum-row-sumavarios-consolidado",
        type: "consolidated-total",
        icon: "bi-collection-fill",
        color: "success",
      },
      {
        field: "sum-row-operativo",
        type: "operating-result",
        icon: "bi-graph-up-arrow",
        color: "info",
      },
      {
        field: "result-row",
        type: "result",
        icon: "bi-calculator-fill",
        color: "warning",
      },
      {
        field: "net-row",
        type: "net-result",
        icon: "bi-cash-stack",
        color: "danger",
      },
      {
        field: "result-net-row",
        type: "net-consolidated",
        icon: "bi-bank",
        color: "danger",
      },
    ];

    state.operaciones.forEach((op, opIndex) => {
      labelTypes.forEach(({ field, type, icon, color }) => {
        const label = op[field];
        if (label && label.trim()) {
          if (!consolidatedLabels.has(label)) {
            consolidatedLabels.set(label, {
              type,
              field,
              icon,
              color,
              operations: [],
              firstIndex: opIndex, // Track order of first appearance
            });
          }
          consolidatedLabels
            .get(label)
            .operations.push(getOperationLabel(op) || op.SECCION);
        }
      });
    });

    // MODO MANUAL: No renderizar filas inferidas automáticamente. 
    // Si el usuario quiere ver "CONSOLIDATED INCOME", debe crearla explícitamente.
    // MODIFICACION: Permitir verlas si existen para que el usuario pueda eliminarlas/editarlas.
    const sortedLabels = Array.from(consolidatedLabels.entries()).sort(
      (a, b) => a[1].firstIndex - b[1].firstIndex,
    );

    // Render both: non-inline operations AND extracted consolidated labels
    const hasConsolidatedContent =
      sectionLevelOps.length > 0 || sortedLabels.length > 0;

    if (hasConsolidatedContent) {
      html += `<div class="section-level-operations">
        <div class="section-level-header">
          <i class="bi bi-calculator-fill text-primary me-2"></i>
          <span>Operaciones Generadas (Consolidación)</span>
          <span class="badge bg-primary ms-2">${sortedLabels.length}</span>
        </div>`;

      // Render non-inline operations first
      sortOperations(sectionLevelOps).forEach((op) => {
        html += renderSectionOperation(op);
      });

      // Render extracted consolidated labels as special rows (in order of appearance)
      // DISABLED AUTO-RENDER to avoid "ghost rows". User must create them explicitly.
      /*
      sortedLabels.forEach(([label, info]) => {
        const formulaStr =
          info.operations.slice(0, 5).join(" + ") +
          (info.operations.length > 5 ? " + ..." : "");
        html += `
          <div class="consolidated-label-row consolidated-${info.type
          }" data-label="${escapeAttr(label)}" data-field="${info.field}">
            <div class="label-icon bg-${info.color}">
              <i class="bi ${info.icon}"></i>
            </div>
            <div class="label-content">
              <span class="label-name">${escapeHtml(label)}</span>
              <span class="label-type badge bg-${info.color
          } ms-2">${info.type.replace(/-/g, " ")}</span>
            </div>
            <div class="label-formula text-muted">
              <i class="bi bi-equation me-1"></i>
              <span class="formula-text">= ${escapeHtml(formulaStr)}</span>
              <span class="operation-count ms-2">(${info.operations.length
          } operaciones)</span>
            </div>
            <div class="label-actions">
              <button class="btn btn-sm btn-outline-primary" onclick="editConsolidatedLabel('${escapeAttr(
            label,
          )}', '${info.field}')" title="Editar">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-sm btn-outline-danger" onclick="deleteConsolidatedLabel('${escapeAttr(
            label,
          )}', '${info.field}')" title="Eliminar">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
        `;
      });
      */

      html += `</div>`;
    }

    return html;
  }

  // Find if an operation matches a specific subsection
  function findMatchingSubsection(op) {
    const clase = (getOperationLabel(op) || "").toLowerCase();
    // Check if class name contains a subsection name
    const allSubsections = new Set();
    state.cuentas.forEach((c) => {
      if (c.seccion_secundaria || c["SECCION Secundaria"]) {
        allSubsections.add(
          (c.seccion_secundaria || c["SECCION Secundaria"]).toLowerCase(),
        );
      }
    });
    for (const sub of allSubsections) {
      if (clase.includes(sub.toLowerCase().replace(/\s+/g, ""))) {
        return sub;
      }
    }
    return null;
  }

  // Renderiza una operación de nivel de sección (sum de múltiples secciones)
  function renderSectionOperation(op) {
    const opId = getOperationId(op);
    const clase = getOperationLabel(op) || "Operacion";
    const displayName = getOperationDisplayName(op);
    const tipo = detectOperationType(op);
    const formula = formatFormula(op) || "";
    const formulaHtml = formula
      ? escapeHtml(formula)
      : '<span class="text-muted">Sin fórmula</span>';
    const isVisible = op.visible !== false;
    const hiddenClass = !isVisible ? "hidden-row" : "";
    const canEdit = state.editMode;
    const disabledAttr = !canEdit ? "disabled" : "";

    return `
      <div class="layout-section operation-section ${tipo}">
        <div class="operation-row ${tipo} ${hiddenClass}" data-operation-id="${escapeAttr(
      opId || "",
    )}" data-operation-label="${escapeAttr(
      displayName,
    )}" onclick="window.handleOperationRowClick(event, '${escapeAttr(opId || clase)}')">
          <div class="operation-label">
            <i class="bi bi-calculator"></i>
            <span>${escapeHtml(displayName)}</span>
            <span class="operation-type badge bg-warning text-dark">SUM</span>
          </div>
          <div class="operation-formula small text-muted ms-3" style="flex: 2; font-style: italic;">
            ${formulaHtml}
          </div>
          <div class="account-actions">
            <button class="btn btn-sm btn-outline-primary" onclick="event.stopPropagation(); editOperation('${escapeAttr(
      opId || clase,
    )}')" title="Editar" ${disabledAttr}>
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation(); deleteOperation('${escapeAttr(
      opId || clase,
    )}')" title="Eliminar" ${disabledAttr}>
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // Renderiza una operación inline dentro de una subsección
  function renderInlineOperation(op, accounts) {
    const opId = getOperationId(op);
    const clase = getOperationLabel(op) || "Operacion";
    const displayName = getOperationDisplayName(op);
    const isVisible = op.visible !== false;
    const hiddenClass = !isVisible ? "hidden-row" : "";
    const canEdit = state.editMode;
    const disabledAttr = !canEdit ? "disabled" : "";
    // Modo estricto: mostrar SOLO la fórmula manual guardada en la operación.
    // Nunca inferir fórmulas por sección/cuentas.
    const formula = formatFormula(op) || "";
    const formulaHtml = formula
      ? `= ${escapeHtml(formula)}`
      : `<span class="text-muted">Sin fórmula</span>`;

    return `
      <div class="inline-operation-row ${hiddenClass}" data-operation-id="${escapeAttr(
      opId || "",
    )}" data-operation-label="${escapeAttr(
      displayName,
    )}" onclick="window.handleOperationRowClick(event, '${escapeAttr(opId || clase)}')">
        <div class="inline-op-icon">
          <i class="bi bi-calculator"></i>
        </div>
        <div class="inline-op-label">
          <span class="op-name">${escapeHtml(displayName)}</span>
          <span class="op-badge badge bg-warning text-dark ms-2">SUM</span>
        </div>
        <div class="inline-op-formula">
          ${formulaHtml}
        </div>
        <div class="inline-op-actions">
          <button class="btn btn-sm btn-link p-0" onclick="event.stopPropagation(); editOperation('${escapeAttr(
      opId || clase,
    )}')" title="Editar" ${disabledAttr}>
            <i class="bi bi-pencil"></i>
          </button>
          <button type="button" class="btn btn-sm btn-link p-0" onclick="window.handleInlineOperationOrderClick(event, '${escapeAttr(
      displayName,
    )}', '${escapeAttr(opId || "")}', '', -1)" title="Subir" ${disabledAttr}>
            <i class="bi bi-arrow-up"></i>
          </button>
          <button type="button" class="btn btn-sm btn-link p-0" onclick="window.handleInlineOperationOrderClick(event, '${escapeAttr(
      displayName,
    )}', '${escapeAttr(opId || "")}', '', 1)" title="Bajar" ${disabledAttr}>
            <i class="bi bi-arrow-down"></i>
          </button>
        </div>
      </div>
    `;
  }

  // Legacy function for backwards compatibility
  function renderSingleOperation(op) {
    return renderSectionOperation(op);
  }

  const FORMULA_V2_VERSION = 2;
  const FORMULA_KIND_REF = "ref";
  const FORMULA_KIND_CONST = "const";
  const FORMULA_KIND_OP = "op";
  const FORMULA_OPERATORS = new Set(["+", "-", "*", "/", "(", ")"]);

  function normalizeFormulaIdSegment(value) {
    return (value || "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/_+/g, "_")
      .toUpperCase();
  }

  function normalizeFormulaAccountSegment(value) {
    return (value || "")
      .toString()
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "")
      .replace(/[^0-9A-Z]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function buildSectionRefId(name) {
    const key = normalizeFormulaIdSegment(name);
    return key ? `SEC::${key}` : "";
  }

  function buildSubsectionRefId(parent, name) {
    const p = normalizeFormulaIdSegment(parent);
    const s = normalizeFormulaIdSegment(name);
    return p && s ? `SUB::${p}::${s}` : "";
  }

  function buildAccountRefId(code) {
    const key = normalizeFormulaAccountSegment(code);
    return key ? `ACC::${key}` : "";
  }

  function buildOperationRefId(operationIdOrLabel) {
    const resolved = resolveOperationId(operationIdOrLabel || "");
    const key = normalizeFormulaIdSegment(resolved || operationIdOrLabel || "");
    return key ? `OP::${key}` : "";
  }

  function isFormulaV2Object(value) {
    return Boolean(
      value &&
      typeof value === "object" &&
      Number(value.version) === FORMULA_V2_VERSION &&
      Array.isArray(value.tokens),
    );
  }

  function parseFormulaJsonSafe(raw) {
    if (raw == null || raw === "") return null;
    if (typeof raw === "object") return raw;
    try {
      return JSON.parse(String(raw));
    } catch (_) {
      return null;
    }
  }

  function createRefTokenFromTerm(term = {}, opContext = null) {
    const type = (term.type || "").toString().toLowerCase();
    const valueRaw = (term.value ?? term.cuenta ?? term.id ?? "")
      .toString()
      .trim();
    const parentFromTerm = (term.parentSection || "").toString().trim();
    if (!valueRaw && type !== "constant") return null;

    if (type === "constant") {
      const number =
        term.constant != null ? Number(term.constant) : Number(valueRaw);
      return {
        kind: FORMULA_KIND_CONST,
        value: Number.isFinite(number) ? number : 0,
      };
    }

    if (type === "operation") {
      const refId = buildOperationRefId(valueRaw);
      return {
        kind: FORMULA_KIND_REF,
        refType: "operation",
        refId,
        label: valueRaw,
        unresolved: !refId,
      };
    }

    if (type === "account") {
      const refId = buildAccountRefId(valueRaw);
      return {
        kind: FORMULA_KIND_REF,
        refType: "account",
        refId,
        label: valueRaw,
        unresolved: !refId,
      };
    }

    const parsedSelection = parseSectionSelection(valueRaw);
    const sectionValue = parsedSelection.section || valueRaw;

    const explicitParent =
      (parsedSelection.parent || "").toString().trim() || parentFromTerm;
    const contextParent = (opContext?.parentSection || "").toString().trim();

    // Si el usuario especifica parent||sub (o el término ya trae parentSection),
    // es una subsección explícita.
    if (explicitParent) {
      const refId = buildSubsectionRefId(explicitParent, sectionValue);
      return {
        kind: FORMULA_KIND_REF,
        refType: "subsection",
        refId,
        label: sectionValue,
        parentSection: explicitParent,
        unresolved: !refId,
      };
    }

    // Caso homónimo: subsección con mismo nombre que su sección padre.
    // Ej: sección "Guadalajara Expense" tiene subsección "Guadalajara Expense".
    // En ese caso, si el contexto indica que estamos editando la fórmula de la
    // sección padre, debemos resolver como subsección (no circular).
    const sameNameAsParent =
      contextParent &&
      normalizeOperationMatch(contextParent) ===
      normalizeOperationMatch(sectionValue) &&
      subsectionExistsInParent(contextParent, sectionValue);
    if (sameNameAsParent) {
      const refId = buildSubsectionRefId(contextParent, sectionValue);
      return {
        kind: FORMULA_KIND_REF,
        refType: "subsection",
        refId,
        label: sectionValue,
        parentSection: contextParent,
        unresolved: !refId,
      };
    }

    // Si coincide con una sección principal conocida, NO inferir subsección por contexto.
    if (isKnownPrincipalSection(sectionValue)) {
      const refId = buildSectionRefId(sectionValue);
      return {
        kind: FORMULA_KIND_REF,
        refType: "section",
        refId,
        label: sectionValue,
        unresolved: !refId,
      };
    }

    // Fallback: usar contexto del editor para desambiguar subsecciones.
    if (contextParent) {
      const refId = buildSubsectionRefId(contextParent, sectionValue);
      return {
        kind: FORMULA_KIND_REF,
        refType: "subsection",
        refId,
        label: sectionValue,
        parentSection: contextParent,
        unresolved: !refId,
      };
    }

    const refId = buildSectionRefId(sectionValue);
    return {
      kind: FORMULA_KIND_REF,
      refType: "section",
      refId,
      label: sectionValue,
      unresolved: !refId,
    };
  }

  function convertLegacyTermsToV2Tokens(terms = [], opContext = null) {
    const tokens = [];
    const repairedTerms = repairSplitAccountLegacyTerms(terms);
    repairedTerms.forEach((term, idx) => {
      if (!term || typeof term !== "object") return;
      const opRaw = (term.operator || "+").toString().trim();
      const operator =
        opRaw === "×"
          ? "*"
          : opRaw === "÷"
            ? "/"
            : FORMULA_OPERATORS.has(opRaw)
              ? opRaw
              : "+";
      const tokenValue = createRefTokenFromTerm(term, opContext);
      if (!tokenValue) return;

      if (idx === 0) {
        if (operator === "-") {
          tokens.push({ kind: FORMULA_KIND_CONST, value: 0 });
          tokens.push({ kind: FORMULA_KIND_OP, value: "-" });
        }
      } else {
        tokens.push({ kind: FORMULA_KIND_OP, value: operator });
      }
      tokens.push(tokenValue);
    });
    return tokens;
  }

  function extractFormulaTokens(op = {}) {
    if (!op) return [];

    if (Array.isArray(op.formula_v2?.tokens)) {
      return op.formula_v2.tokens;
    }

    const parsed = parseFormulaJsonSafe(op.formula_json);
    if (isFormulaV2Object(parsed)) {
      return parsed.tokens || [];
    }
    if (Array.isArray(parsed) && parsed.length) {
      return convertLegacyTermsToV2Tokens(parsed, op);
    }
    if (!parsed) {
      const formulaRaw = (op.formula_json || "").toString().trim();
      if (formulaRaw) {
        const parsedText = parseFormulaExpressionV2(formulaRaw, {
          parentSection: (op.parentSection || "").toString().trim(),
          defaultParentSection: (op.parentSection || "").toString().trim(),
        });
        if (parsedText.valid && Array.isArray(parsedText.tokens)) {
          return parsedText.tokens;
        }
      }
    }

    if (Array.isArray(op.formula_terms) && op.formula_terms.length) {
      return convertLegacyTermsToV2Tokens(op.formula_terms, op);
    }

    const legacyTerms = [];
    const legacyKeys = Object.keys(op || {})
      .filter((k) => /^(seccion|operacion)_\d+$/i.test(k))
      .sort((a, b) => {
        const nA = Number((a.match(/_(\d+)/) || [])[1] || 0);
        const nB = Number((b.match(/_(\d+)/) || [])[1] || 0);
        return nA - nB;
      });
    legacyKeys.forEach((key) => {
      const value = op[key];
      if (!value) return;
      const signo = Number(op?.signos?.[key]);
      legacyTerms.push({
        operator: signo < 0 ? "-" : "+",
        type: key.toLowerCase().startsWith("operacion_")
          ? "operation"
          : "section",
        value,
      });
    });
    if (legacyTerms.length) {
      return convertLegacyTermsToV2Tokens(legacyTerms, op);
    }

    return [];
  }

  function convertV2TokensToLegacyTerms(tokens = []) {
    const terms = [];
    let currentOperator = "+";
    (Array.isArray(tokens) ? tokens : []).forEach((token) => {
      if (!token || typeof token !== "object") return;
      if (token.kind === FORMULA_KIND_OP) {
        const op = (token.value || "").toString().trim();
        if (op === "+" || op === "-" || op === "*" || op === "/") {
          currentOperator = op;
        }
        return;
      }

      if (token.kind === FORMULA_KIND_CONST) {
        const num = Number(token.value);
        terms.push({
          operator: currentOperator,
          type: "constant",
          value: String(Number.isFinite(num) ? num : 0),
          constant: Number.isFinite(num) ? num : 0,
        });
        currentOperator = "+";
        return;
      }

      if (token.kind === FORMULA_KIND_REF) {
        const refType = (token.refType || "").toString().toLowerCase();
        const type =
          refType === "operation"
            ? "operation"
            : refType === "account"
              ? "account"
              : "section";
        terms.push({
          operator: currentOperator,
          type,
          value: token.label || token.refId || "",
          parentSection: token.parentSection || "",
          parentSubsection: token.parentSubsection || "",
        });
        currentOperator = "+";
      }
    });
    return terms;
  }

  function serializeFormulaV2(tokens = []) {
    return JSON.stringify({
      version: FORMULA_V2_VERSION,
      tokens: Array.isArray(tokens) ? tokens : [],
    });
  }

  function extractFormulaTerms(op) {
    if (!op) return [];
    const tokens = extractFormulaTokens(op);
    const terms = convertV2TokensToLegacyTerms(tokens);
    return applyParentSectionHints(op, terms);
  }

  function formatFormula(op) {
    const tokens = extractFormulaTokens(op);

    if (tokens.length) {
      return tokens
        .map((token) => {
          if (!token || typeof token !== "object") return "";
          if (token.kind === FORMULA_KIND_OP) {
            const opValue = (token.value || "").toString().trim();
            if (opValue === "(" || opValue === ")") return opValue;
            return ` ${opValue} `;
          }
          if (token.kind === FORMULA_KIND_CONST) {
            const number = Number(token.value);
            return String(Number.isFinite(number) ? number : 0);
          }
          if (token.kind === FORMULA_KIND_REF) {
            const label = token.label || token.refId || "???";
            if (
              (token.refType || "").toString().toLowerCase() === "operation"
            ) {
              return formatOperationReference(label);
            }
            return label;
          }
          return "";
        })
        .join("")
        .replace(/\s+/g, " ")
        .replace(/\(\s+/g, "(")
        .replace(/\s+\)/g, ")")
        .trim();
    }

    if (typeof op?.formula === "string" && op.formula.trim()) {
      return op.formula.trim();
    }
    return "";
  }

  function groupBySections(cuentas) {
    const sections = [];
    const sectionMap = new Map();

    const getSafeOrder = (item, idx) => {
      const o = getOperationOrder(item, idx);
      return Number.isFinite(o) ? o : idx;
    };

    // Helper to ensure section exists
    const ensureSection = (name, initialOrder) => {
      const principal = (name || "Sin sección").toString().trim();
      if (!sectionMap.has(principal)) {
        const newSec = {
          name: principal,
          order: initialOrder,
          subsections: [],
          subsectionMap: new Map(),
          source: 'mixed'
        };
        sectionMap.set(principal, newSec);
        sections.push(newSec);
      }
      return sectionMap.get(principal);
    };

    // Helper to ensure subsection exists
    const ensureSubsection = (section, subName, initialOrder) => {
      const secundaria = (subName || section.name).toString().trim();
      if (!section.subsectionMap.has(secundaria)) {
        const newSub = {
          name: secundaria,
          order: initialOrder,
          accounts: [],
          source: 'mixed'
        };
        section.subsectionMap.set(secundaria, newSub);
        section.subsections.push(newSub);
      }
      return section.subsectionMap.get(secundaria);
    };

    // 1. Process Accounts
    const cuentasOrdenadas = sortAccountsByOrder(cuentas || []);
    cuentasOrdenadas.forEach((cuenta, idx) => {
      const pName = getAccountPrincipalName(cuenta);
      const sName = getAccountSecondaryName(cuenta);
      const order = getAccountOrder(cuenta, idx);

      const section = ensureSection(pName || sName, order);
      const subsection = ensureSubsection(section, sName, order);
      subsection.accounts.push(cuenta);
    });

    // 2. Process Operations logic - Force inclusion of defined sections/subsections
    // REVERTED: User explicitly requested "NO auto-generated rows".
    // If a section/subsection is deleted from the layout, it must NOT be recreated just because an operation references it.
    // Operations with invalid parents will likely end up as root items or hidden, which is the desired "manual" behavior.
    if (state.operaciones && Array.isArray(state.operaciones)) {
      /*
      state.operaciones.forEach((op, index) => {
        const p = op.parentSection || op["SECCIÓN Principal"] || op.seccion_principal || op.SECCION || op["sum-row-sumavarios"] || op["sum-row-operativo"];
        // const s = op.parentSubsection || op.subseccion || op.subseccion_principal;

        if (p) {
          const principalRaw = p.toString().trim();
          // const opOrder = getOperationOrder(op, index);
          // const section = ensureSection(principalRaw, opOrder);

          // if (s) {
          //   const secundariaRaw = s.toString().trim();
          //   ensureSubsection(section, secundariaRaw, opOrder);
          // }
        }
      });
      */
    }

    sections.sort((a, b) => a.order - b.order);
    sections.forEach((section) =>
      section.subsections.sort((a, b) => a.order - b.order)
    );

    return sections;
  }

  function renderSection(section) {
    const { name: principal, subsections } = section;
    const canEdit = state.editMode !== false;
    const disabledAttr = canEdit ? "" : "disabled";
    const sumRowMatch = getRowOperationMatch(principal, "sum-row");
    const hasSumRow = sumRowMatch.operations.length > 0;
    const sumRowBtnClass = hasSumRow
      ? "btn-outline-success"
      : "btn-outline-secondary";
    const sumRowBtnTitle = hasSumRow ? "Editar fila de suma" : "Crear fila de suma";
    const sumRowLabel = hasSumRow
      ? (sumRowMatch.operations[0]?.["sum-row"] || "").toString().trim()
      : "";
    const showSumRowLabel =
      sumRowLabel &&
      normalizeOperationMatch(sumRowLabel) !== normalizeOperationMatch(principal);
    const sectionOpMatch = getRowOperationMatch(
      principal,
      "sum-row-sumavarios",
    );
    const hasSectionOp = sectionOpMatch.operations.length > 0;
    const sectionOpBtnClass = hasSectionOp
      ? "btn-outline-success"
      : "btn-outline-secondary";
    const sectionOpBtnTitle = hasSectionOp
      ? "Editar operación"
      : "Crear operación";
    const subsectionCount = subsections.length;
    const accountCount = subsections.reduce(
      (acc, subsection) =>
        acc +
        (subsection.accounts || []).filter(
          (account) => !isPlaceholderAccount(account),
        ).length,
      0,
    );

    let subsectionsHtml = "";
    subsections.forEach((subsection) => {
      subsectionsHtml += renderSubsection(subsection, principal);
    });

    return `
      <div class="layout-section" data-section="${escapeHtml(principal)}">
        <div class="section-header" onclick="toggleSection(this)">
          <div class="section-title">
            <i class="bi bi-chevron-down section-toggle"></i>
            <i class="bi bi-folder2 text-primary"></i>
            <span>${escapeHtml(principal)}</span>
            ${showSumRowLabel ? `<span class="text-muted small ms-2">${escapeHtml(sumRowLabel)}</span>` : ""}
            <span class="badge bg-secondary">${accountCount} cuentas</span>
          </div>
          <div class="section-actions">
            <button class="btn btn-sm btn-outline-secondary" onclick="event.stopPropagation(); moveSectionOrder('${escapeAttr(
      principal,
    )}', -1)" title="Subir" ${disabledAttr}>
              <i class="bi bi-arrow-up"></i>
            </button>
            <button class="btn btn-sm btn-outline-secondary" onclick="event.stopPropagation(); moveSectionOrder('${escapeAttr(
      principal,
    )}', 1)" title="Bajar" ${disabledAttr}>
              <i class="bi bi-arrow-down"></i>
            </button>
            <button class="btn btn-sm ${sumRowBtnClass}" onclick="event.stopPropagation(); editRowOperation('${escapeAttr(
      principal,
    )}', 'sum-row', '')" title="${sumRowBtnTitle}" ${disabledAttr}>
              Σ
            </button>
            <button class="btn btn-sm ${sectionOpBtnClass}" onclick="event.stopPropagation(); editRowOperation('${escapeAttr(
      principal,
    )}', '${escapeAttr(sectionOpMatch.field || "sum-row-sumavarios")}', '')" title="${sectionOpBtnTitle}" ${disabledAttr}>
              <i class="bi bi-calculator"></i>
            </button>
            <button class="btn btn-sm btn-outline-primary" onclick="event.stopPropagation(); editSection('${escapeAttr(
      principal,
    )}')" title="Editar">
              <i class="bi bi-pencil"></i>
            </button>
             <button class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation(); deleteSection('${escapeAttr(
      principal,
    )}')" title="Eliminar">
              <i class="bi bi-trash"></i>
            </button>
            <button class="btn btn-sm btn-outline-success" onclick="event.stopPropagation(); addToSection('${escapeAttr(
      principal,
    )}')" title="Agregar">
              <i class="bi bi-plus"></i>
            </button>
          </div>
        </div>
        <div class="section-content">
          ${subsectionsHtml}
        </div>
      </div>
    `;
  }

  function renderSubsection(subsection, principal) {
    const { name, accounts } = subsection;
    const canEdit = state.editMode !== false;
    const disabledAttr = canEdit ? "" : "disabled";
    const subsectionOpMatch = getRowOperationMatch(name, "", principal);
    const hasSubsectionOp = subsectionOpMatch.operations.length > 0;
    const subsectionOpBtnClass = hasSubsectionOp
      ? "btn-outline-success"
      : "btn-outline-secondary";
    const subsectionOpBtnTitle = hasSubsectionOp
      ? "Editar operación"
      : "Crear operación";
    const realAccounts = (accounts || []).filter(
      (account) => !isPlaceholderAccount(account),
    );
    const accountsHtml = sortAccountsByOrder(realAccounts)
      .map((acc) => renderAccount(acc, principal, name))
      .join("");

    // Find operations that match this subsection AND parent section (INCOME/EXPENSE)
    const principalLower = principal.toLowerCase();
    const isIncomeSection = principalLower.includes("income");
    const isExpenseSection = principalLower.includes("expense");

    const matchingOps = state.operaciones.filter((op) => {
      const clase = (getOperationLabel(op) || "").toLowerCase();

      // Check if operation type matches section type
      const isIncomeOp = clase.includes("income");
      const isExpenseOp = clase.includes("expense");

      // Only match if section type matches operation type
      if (isIncomeSection && isExpenseOp) return false;
      if (isExpenseSection && isIncomeOp) return false;

      // Match by parentSubsection field
      if (
        op.parentSubsection &&
        op.parentSubsection.toLowerCase() === name.toLowerCase()
      ) {
        // Also check parentSection if available
        if (op.parentSection) {
          return op.parentSection.toLowerCase() === principalLower;
        }
        return true;
      }

      // Match by row labels (sum-row, result-row, etc.) equal to subsection name
      if (operationMatchesRowLabel(op, name)) {
        if (op.parentSection) {
          return op.parentSection.toLowerCase() === principalLower;
        }
        return true;
      }

      // Match by Clase containing subsection name (e.g., "income-Membership" matches "Membership")
      const claseNorm = clase.replace(/[-_\s]/g, "");
      const subsectionNorm = name.toLowerCase().replace(/[-_\s]/g, "");

      if (
        claseNorm.includes(subsectionNorm) ||
        subsectionNorm.includes(claseNorm)
      ) {
        // Make sure it's not a section-level operation (multi-section)
        if (!op.secciones || op.secciones.length <= 1) {
          return true;
        }
      }
      return false;
    });

    // Render inline operations respetando el orden definido
    const inlineOpsHtml = matchingOps
      .sort((a, b) => getOperationOrder(a) - getOperationOrder(b))
      .map((op) => renderInlineOperation(op, realAccounts))
      .join("");

    return `
      <div class="subsection" data-subsection="${escapeHtml(name)}">
        <div class="subsection-header" onclick="toggleSubsection(this)">
          <div class="subsection-title">
            <i class="bi bi-chevron-down section-toggle"></i>
            <i class="bi bi-folder text-info"></i>
            <span>${escapeHtml(name)}</span>
            <span class="badge bg-light text-dark">${realAccounts.length}</span>
          </div>
          <div class="section-actions">
            <button class="btn btn-sm btn-outline-secondary" onclick="event.stopPropagation(); moveSubsectionOrder('${escapeAttr(
      principal,
    )}', '${escapeAttr(name)}', -1)" title="Subir" ${disabledAttr}>
              <i class="bi bi-arrow-up"></i>
            </button>
            <button class="btn btn-sm btn-outline-secondary" onclick="event.stopPropagation(); moveSubsectionOrder('${escapeAttr(
      principal,
    )}', '${escapeAttr(name)}', 1)" title="Bajar" ${disabledAttr}>
              <i class="bi bi-arrow-down"></i>
            </button>
            <button class="btn btn-sm ${subsectionOpBtnClass}" onclick="event.stopPropagation(); editRowOperation('${escapeAttr(
      name,
    )}', '${escapeAttr(subsectionOpMatch.field || "sum-row")}', '${escapeAttr(
      principal,
    )}')" title="${subsectionOpBtnTitle}" ${disabledAttr}>
              <i class="bi bi-calculator"></i>
            </button>
            <button class="btn btn-sm btn-outline-primary" onclick="event.stopPropagation(); editSubsection('${escapeAttr(
      principal,
    )}', '${escapeAttr(name)}')" title="Editar subsección">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation(); deleteSubsection('${escapeAttr(
      principal,
    )}', '${escapeAttr(name)}')" title="Eliminar subsección">
              <i class="bi bi-trash"></i>
            </button>
            <button class="btn btn-sm btn-outline-secondary" onclick="event.stopPropagation(); addAccount('${escapeAttr(
      principal,
    )}', '${escapeAttr(name)}')" title="Agregar cuenta">
              <i class="bi bi-plus"></i>
            </button>
          </div>
        </div>
        <div class="account-list">
          ${accountsHtml}
          ${inlineOpsHtml}
        </div>
      </div>
    `;
  }

  function renderAccount(account, principal, secundaria) {
    if (isPlaceholderAccount(account)) return "";
    const codigo = account.CUENTA || "";
    const nombre = account.NOMBRE || account.nombre || "";
    const accountId = getAccountRowId(account);
    const isVisible = account.visible !== false;
    const hiddenClass = !isVisible ? "hidden-row" : "";
    const canEdit = state.editMode;
    const disabledAttr = !canEdit ? "disabled" : "";

    return `
      <div class="account-row ${hiddenClass}" data-cuenta="${escapeHtml(
      codigo,
    )}" data-account-id="${escapeAttr(accountId)}" onclick="selectAccount(this, '${escapeAttr(accountId)}')">
        <span class="drag-handle" title="Arrastrar para reordenar">⋮⋮</span>
        <span class="account-code">${escapeHtml(codigo)}</span>
        <span class="account-name">${escapeHtml(nombre)}</span>
        <div class="account-actions d-flex gap-2 align-items-center">
          ${window.LayoutControls
        ? window.LayoutControls.renderVisibilityControl(
          account,
          "account",
        )
        : ""
      }
          ${window.LayoutControls
        ? window.LayoutControls.renderOrderControl(account, "account")
        : ""
      }
          <button class="btn btn-sm btn-outline-primary" onclick="event.stopPropagation(); editAccount('${escapeAttr(
        accountId,
      )}')" title="Editar" ${disabledAttr}>
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation(); deleteAccount('${escapeAttr(
        accountId,
      )}')" title="Eliminar" ${disabledAttr}>
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
    `;
  }

  function renderOperationsSection() {
    const opsHtml = state.operaciones
      .map((op) => {
        const opId = getOperationId(op);
        const clase = getOperationLabel(op) || "Operacion";
        const displayName = getOperationDisplayName(op);
        const tipo = detectOperationType(op);
        const termsCount = op.formula_terms?.length || 0;
        const isVisible = op.visible !== false;
        const hiddenClass = !isVisible ? "hidden-row" : "";
        const canEdit = state.editMode;
        const disabledAttr = !canEdit ? "disabled" : "";

        return `
        <div class="operation-row ${tipo} ${hiddenClass}" data-operation-id="${escapeAttr(
          opId || "",
        )}" data-operation-label="${escapeAttr(displayName)}">
          <div class="operation-label" onclick="editOperation('${escapeAttr(
          opId || clase,
        )}')">
            <i class="bi bi-calculator"></i>
            <span>${escapeHtml(displayName)}</span>
            <span class="operation-type">${tipo}</span>
            ${termsCount > 0
            ? `<span class="badge bg-secondary ms-2">${termsCount} términos</span>`
            : ""
          }
          </div>
          <div class="account-actions">
            <button class="btn btn-sm btn-outline-primary" onclick="event.stopPropagation(); editOperation('${escapeAttr(
            opId || clase,
          )}')" title="Editar" ${disabledAttr}>
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation(); deleteOperation('${escapeAttr(
            opId || clase,
          )}')" title="Eliminar" ${disabledAttr}>
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
      `;
      })
      .join("");

    return `
      <div class="layout-section">
        <div class="section-header" onclick="toggleSection(this)">
          <div class="section-title">
            <i class="bi bi-chevron-down section-toggle"></i>
            <i class="bi bi-calculator text-warning"></i>
            <span>Operaciones entre Filas</span>
            <span class="badge bg-warning text-dark">${state.operaciones.length}</span>
          </div>
        </div>
        <div class="section-content">
          ${opsHtml}
        </div>
      </div>
    `;
  }

  function detectOperationType(op) {
    const clase = (getOperationLabel(op) || "").toLowerCase();
    if (clase.includes("net")) return "net";
    if (clase.includes("result")) return "result";
    return "sum";
  }

  function bindLayoutEvents() {
    bindColumnConfigEvents();
    bindTemplateTableEvents();
  }

  // ==========================================
  // HANDLERS
  // ==========================================
  async function handleModuloChange() {
    state.modulo = dom.moduloSelect.value;
    try {
      window.Sesion?.guardarContextoPlaneacion?.({ modulo: state.modulo });
    } catch (_) {
      // ignore
    }
    saveContextToURL();
    updateHeaderLabels();
    await loadYears();
    await loadChapters();
    await tryLoadLayout();
  }

  async function handleAnioChange() {
    const parsed = Number(dom.anioSelect.value);
    state.anio = Number.isInteger(parsed) ? parsed : dom.anioSelect.value;
    try {
      window.Sesion?.guardarContextoPlaneacion?.({ anio: state.anio });
    } catch (_) {
      // ignore
    }
    saveContextToURL();
    updateHeaderLabels();
    await loadChapters();
    await tryLoadLayout();
  }

  async function handleCapituloChange() {
    state.capitulo = dom.capituloSelect.value;
    asegurarEmpresaIdContexto(state.capitulo, true);
    filtrarModulosPorCapitulo(); // Filtrar módulos cuando cambia el capítulo
    saveContextToURL();
    updateHeaderLabels();
    await tryLoadLayout();
  }

  function handleSearch(e) {
    const query = e?.target?.value?.toLowerCase().trim() || "";
    applySearchAndFilters(query);
  }

  function applySearchAndFilters(query = "") {
    const activeFilter =
      document.querySelector('input[name="quickFilter"]:checked')?.value ||
      "all";

    const sections = document.querySelectorAll(".layout-section");
    const sectionRows = document.querySelectorAll(
      '.template-table tr[data-row-type="section"], .template-table tr[data-row-type="subsection"], .list-item.section-principal, .list-item.section-secondary',
    );
    const accountRows = document.querySelectorAll(
      ".account-row, .list-item.item-account",
    );
    const operationRows = document.querySelectorAll(
      ".operation-row, .inline-operation-row, .list-item.item-operation",
    );

    // Quitar resaltado anterior
    document.querySelectorAll(".search-highlight").forEach((el) => {
      el.classList.remove("search-highlight");
    });

    let firstMatch = null;

    // Aplicar filtros según el tipo seleccionado
    if (activeFilter === "all" && !query) {
      // Mostrar todo
      sections.forEach((s) => (s.style.display = ""));
      sectionRows.forEach((r) => (r.style.display = ""));
      accountRows.forEach((r) => (r.style.display = ""));
      operationRows.forEach((r) => (r.style.display = ""));
      return;
    }

    // Filtrar secciones (vista por bloques)
    sections.forEach((section) => {
      const isOperationSection =
        section.classList.contains("operation-section");
      let shouldShow = false;

      if (activeFilter === "all" || activeFilter === "sections") {
        if (!isOperationSection) {
          const title =
            section
              .querySelector(".section-title span")
              ?.textContent?.toLowerCase() || "";
          shouldShow = !query || title.includes(query);
          if (shouldShow && !firstMatch && query) {
            firstMatch = section;
          }
        } else {
          shouldShow = activeFilter === "all";
        }
      }

      section.style.display = shouldShow ? "" : "none";
    });

    // Filtrar secciones (tabla)
    sectionRows.forEach((row) => {
      let shouldShow = false;
      if (activeFilter === "all" || activeFilter === "sections") {
        const text = row.textContent?.toLowerCase() || "";
        shouldShow = !query || text.includes(query);
        if (shouldShow && !firstMatch && query) {
          firstMatch = row;
        }
      }
      row.style.display = shouldShow ? "" : "none";
    });

    // Filtrar cuentas
    accountRows.forEach((row) => {
      let shouldShow = false;

      if (activeFilter === "all" || activeFilter === "accounts") {
        const code =
          row.querySelector(".account-code")?.textContent?.toLowerCase() ||
          row.getAttribute("data-cuenta")?.toLowerCase() ||
          "";
        const name =
          row.querySelector(".account-name")?.textContent?.toLowerCase() ||
          row.getAttribute("data-nombre")?.toLowerCase() ||
          "";
        const text = row.textContent?.toLowerCase() || "";
        shouldShow =
          !query ||
          code.includes(query) ||
          name.includes(query) ||
          text.includes(query);

        if (shouldShow && !firstMatch && query) {
          firstMatch = row;
        }
      }

      row.style.display = shouldShow ? "" : "none";
    });

    // Filtrar operaciones
    operationRows.forEach((row) => {
      let shouldShow = false;

      if (activeFilter === "all" || activeFilter === "operations") {
        const label =
          row
            .querySelector(".operation-label, .inline-op-label")
            ?.textContent?.toLowerCase() ||
          row.getAttribute("data-operation-label")?.toLowerCase() ||
          row.getAttribute("data-operation-id")?.toLowerCase() ||
          row.textContent?.toLowerCase() ||
          "";
        shouldShow = !query || label.includes(query);

        if (shouldShow && !firstMatch && query) {
          firstMatch = row;
        }
      }

      row.style.display = shouldShow ? "" : "none";
    });

    // Scroll al primer resultado y resaltarlo
    if (firstMatch && query) {
      // Expandir sección padre si está colapsada
      const section = firstMatch.closest(".layout-section");
      if (section) {
        const body = section.querySelector(".section-body");
        const toggle = section.querySelector(".section-toggle");
        if (body && body.style.display === "none") {
          body.style.display = "";
          if (toggle) toggle.classList.remove("collapsed");
        }
      }

      // Scroll suave al elemento
      firstMatch.scrollIntoView({ behavior: "smooth", block: "center" });

      // Resaltar visualmente
      firstMatch.classList.add("search-highlight");

      // Quitar resaltado después de 3 segundos
      setTimeout(() => {
        firstMatch.classList.remove("search-highlight");
      }, 3000);
    }
  }

  // ==========================================
  // STATS
  // ==========================================
  function updateStats() {
    dom.layoutInfo.textContent = `${state.modulo} · ${state.anio} · ${state.capitulo}`;
  }

  // ==========================================
  // STATS HELPERS
  // ==========================================
  function updateSelectionInfo(selection = state.selectedElement) {
    if (!dom.layoutSelectionInfo) return;
    let text = "Seleccion actual: -";
    if (selection) {
      const type = selection.type;
      if (type === "account") {
        const account =
          selection.cuenta ||
          resolveAccountByIdOrCode(selection.accountId || selection.codigo);
        const codigo =
          account?.CUENTA ||
          account?.cuenta ||
          selection.codigo ||
          selection.accountId ||
          "";
        const nombre = account?.NOMBRE || account?.nombre || "";
        text = `Cuenta: ${codigo || "-"}${nombre ? ` - ${nombre}` : ""}`;
      } else if (type === "section") {
        text = `Seccion: ${selection.name || "-"}`;
      } else if (type === "subsection") {
        text = `Subseccion: ${selection.name || "-"} (Seccion ${selection.principal || "-"})`;
      } else if (type === "operation") {
        const label = getOperationDisplayName(selection.op || {});
        const opId = getOperationId(selection.op || {});
        text = `Operacion: ${label || "-"}${opId ? ` (${opId})` : ""}`;
      } else if (type === "consolidatedLabel") {
        text = `Etiqueta consolidada: ${selection.label || "-"}`;
      }
    }
    dom.layoutSelectionInfo.textContent = text;
  }

  function updateLayoutOrderPanel() {
    if (!dom.layoutOrderList) return;
    let rows = [];
    try {
      rows = buildPreviewRowsForEditor();
    } catch (err) {
      console.warn("No se pudo construir el orden de vista previa", err);
    }

    if (!rows || !rows.length) {
      rows = buildOrderFromRenderedLayout();
    }

    const items = rows.filter(
      (row) =>
        row &&
        ["principal", "subsection", "account", "operation"].includes(row.type),
    );

    if (dom.layoutOrderCount) {
      dom.layoutOrderCount.textContent = items.length;
    }

    if (!items.length) {
      dom.layoutOrderList.innerHTML =
        '<div class="text-muted small p-2">Sin filas</div>';
      return;
    }

    const iconByType = {
      principal: "folder2",
      subsection: "folder",
      account: "journal-text",
      operation: "calculator",
    };

    const typeLabel = {
      principal: "Seccion",
      subsection: "Subseccion",
      account: "Cuenta",
      operation: "Operacion",
    };

    const html = items
      .map((row, idx) => {
        const visible = window.LayoutControls._isVisible
          ? window.LayoutControls._isVisible(row.visible)
          : row?.visible !== false;
        const hiddenClass = visible ? "" : "order-hidden";
        const icon = iconByType[row.type] || "dot";
        const mainLabel =
          row.type === "account"
            ? row.cuenta || row.label || "Cuenta"
            : row.label || row.nombre || "Fila";
        const detail =
          row.type === "account"
            ? row.nombre || row.label || ""
            : row.type === "operation"
              ? row.kind || ""
              : "";

        return `
          <div class="order-item ${hiddenClass}">
            <span class="order-index">${idx + 1}</span>
            <i class="bi bi-${icon} order-icon"></i>
            <div class="order-label">
              ${escapeHtml(mainLabel)}
              ${detail
            ? `<div class="small text-muted">${escapeHtml(detail)}</div>`
            : ""
          }
            </div>
            <div class="order-type">${typeLabel[row.type] || row.type}</div>
            ${visible
            ? ""
            : '<span class="badge bg-light text-muted border">Oculta</span>'
          }
          </div>
        `;
      })
      .join("");

    dom.layoutOrderList.innerHTML = html;
  }

  function buildOrderFromRenderedLayout() {
    const container = document.getElementById("layoutPreview");
    if (!container) return [];
    const items = [];
    const sections = Array.from(
      container.querySelectorAll(".layout-section"),
    ).filter(
      (el) => !el.closest(".live-preview-table"), // ignorar vista previa superior
    );

    sections.forEach((section) => {
      const header = section.querySelector(
        ".section-header .section-title span",
      );
      const label = header?.textContent?.trim() || "";
      items.push({ type: "principal", label, visible: true });

      const subsections = section.querySelectorAll(".subsection");
      subsections.forEach((sub) => {
        const subLabel = sub
          .querySelector(".subsection-title span")
          ?.textContent?.trim();
        if (subLabel) {
          items.push({ type: "subsection", label: subLabel, visible: true });
        }
        sub.querySelectorAll(".account-row").forEach((row) => {
          const code = row.getAttribute("data-cuenta") || "";
          const name =
            row.querySelector(".account-name")?.textContent?.trim() || "";
          const hidden = row.classList.contains("hidden-row");
          items.push({
            type: "account",
            label: code,
            cuenta: code,
            nombre: name,
            visible: !hidden,
          });
        });
        sub
          .querySelectorAll(".inline-operation-row, .operation-row")
          .forEach((row) => {
            const opLabel =
              row.getAttribute("data-operation-label") ||
              row.querySelector(".op-name")?.textContent?.trim() ||
              row.querySelector(".operation-label span")?.textContent?.trim() ||
              "";
            const hidden = row.classList.contains("hidden-row");
            items.push({
              type: "operation",
              label: opLabel,
              kind: row.classList.contains("inline-operation-row")
                ? "inline"
                : "",
              visible: !hidden,
            });
          });
      });
    });
    return items;
  }

  // ==========================================
  // MODAL: ADD
  // ==========================================
  function isBulkModeEnabled() {
    return true;
  }

  function setBulkMode(enabled) {
    if (dom.bulkInsertPanel) {
      dom.bulkInsertPanel.style.display = "block";
    }
    if (dom.singleAddPanel) {
      dom.singleAddPanel.style.display = "none";
    }
    ensureBulkRows();
    if (dom.bulkInsertTbody) {
      Array.from(dom.bulkInsertTbody.querySelectorAll("tr")).forEach((row) =>
        updateBulkRowFields(row),
      );
    }
  }

  function ensureBulkRows() {
    if (!dom.bulkInsertTbody) return;
    if (!dom.bulkInsertTbody.children.length) {
      appendBulkRow();
    }
  }

  function buildBulkRow(values = {}) {
    const typeOptions = [
      { value: "seccion-principal", label: "Sección Principal" },
      { value: "seccion-secundaria", label: "Sección Secundaria" },
      { value: "cuenta", label: "Cuenta" },
      { value: "operacion", label: "Operación" },
    ];
    const tipo = values.tipo || "cuenta";
    const optionHtml = typeOptions
      .map(
        (opt) =>
          `<option value="${opt.value}"${opt.value === tipo ? " selected" : ""
          }>${opt.label}</option>`,
      )
      .join("");

    const rowId = `bulk_${Date.now().toString(36)}_${++bulkRowCounter}`;
    const kindSeccion = getBulkFieldKind(tipo, "seccion");
    const kindSubseccion = getBulkFieldKind(tipo, "subseccion");
    const seccionOptions = buildBulkSelectOptions(
      getBulkSectionNames(),
      values.seccion || "",
      "Selecciona sección",
    );
    const subseccionOptions = buildBulkSelectOptions(
      getBulkSubsectionNames(values.seccion || ""),
      values.subseccion || "",
      values.seccion ? "Selecciona subsección" : "Selecciona sección",
    );
    const seccionFieldHtml =
      kindSeccion === "input"
        ? `<input type="text" class="form-control form-control-sm" data-field="seccion" placeholder="Nombre de sección" value="${escapeAttr(
          values.seccion || "",
        )}" />`
        : `<select class="form-select form-select-sm" data-field="seccion">
            ${seccionOptions}
          </select>`;
    const subseccionFieldHtml =
      kindSubseccion === "input"
        ? `<input type="text" class="form-control form-control-sm" data-field="subseccion" placeholder="Nombre de subsección" value="${escapeAttr(
          values.subseccion || "",
        )}" />`
        : `<select class="form-select form-select-sm" data-field="subseccion">
            ${subseccionOptions}
          </select>`;
    const aparicionOptions = buildBulkAparicionOptions(values.aparicion || "");
    return `
      <tr data-row-id="${rowId}">
        <td>
          <select class="form-select form-select-sm" data-field="tipo">
            ${optionHtml}
          </select>
        </td>
        <td data-cell="seccion">
          ${seccionFieldHtml}
        </td>
        <td data-cell="subseccion">
          ${subseccionFieldHtml}
        </td>
        <td><input type="text" class="form-control form-control-sm" data-field="cuenta" placeholder="401-001-000-00" value="${escapeAttr(
      values.cuenta || "",
    )}" /></td>
        <td><input type="text" class="form-control form-control-sm" data-field="nombre" placeholder="Nombre" value="${escapeAttr(
      values.nombre || "",
    )}" /></td>
        <td>
          <select class="form-select form-select-sm" data-field="aparicion">
            ${aparicionOptions}
          </select>
        </td>
        <td><input type="text" class="form-control form-control-sm text-center" data-field="signo" placeholder="1/-1" title="Signo: 1 suma, -1 resta. En cuentas aplica como factor. Vacio = automatico." data-bs-toggle="tooltip" data-bs-placement="top" value="${escapeAttr(
      values.signo || "",
    )}" /></td>
        <td>
          <div class="input-group input-group-sm">
            <input type="text" class="form-control font-monospace" data-field="formula" placeholder="A + B - C" value="${escapeAttr(
      values.formula || "",
    )}" />
            <button type="button" class="btn btn-outline-primary" data-action="edit-formula-bulk" title="Editor visual de fórmula">
              <i class="bi bi-calculator"></i>
            </button>
          </div>
        </td>
        <td class="text-center">
          <button type="button" class="btn btn-outline-danger btn-sm" data-action="remove-row" title="Eliminar fila">×</button>
        </td>
      </tr>
    `;
  }

  function appendBulkRow(values = {}) {
    if (!dom.bulkInsertTbody) return;
    dom.bulkInsertTbody.insertAdjacentHTML("beforeend", buildBulkRow(values));
    const newRow = dom.bulkInsertTbody.lastElementChild;
    if (newRow) {
      updateBulkRowFields(newRow);
    }
  }

  function resetBulkInsertTable({ focus = true } = {}) {
    if (!dom.bulkInsertTbody) return;
    dom.bulkInsertTbody.innerHTML = "";
    appendBulkRow();
    if (focus) {
      const firstInput = dom.bulkInsertTbody?.querySelector("select, input");
      firstInput?.focus();
    }
  }

  function handleBulkTableClick(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    if (action === "remove-row") {
      const row = button.closest("tr");
      row?.remove();
      ensureBulkRows();
    }
    if (action === "edit-formula-bulk") {
      const row = button.closest("tr");
      if (!row) return;
      openBulkFormulaEditor(row);
    }
  }

  function handleBulkTableKeydown(event) {
    const key = event.key;
    if (key === "Enter") {
      const target = event.target;
      const row = target.closest("tr");
      if (!row) return;
      event.preventDefault();
      appendBulkRow();
      const newRow = dom.bulkInsertTbody?.lastElementChild;
      const firstInput = newRow?.querySelector("select, input");
      firstInput?.focus();
      return;
    }

    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(key)) {
      const target = event.target;
      if (!target || !target.closest) return;
      if (!shouldNavigateBulkCell(target, key)) return;
      const row = target.closest("tr");
      if (!row) return;
      const field = target.dataset?.field;
      if (!field) return;
      event.preventDefault();
      moveBulkFocus(row, field, key);
    }
  }

  const BULK_FIELD_ORDER = [
    "tipo",
    "seccion",
    "subseccion",
    "cuenta",
    "nombre",
    "aparicion",
    "signo",
    "formula",
  ];

  function getBulkRowList() {
    if (!dom.bulkInsertTbody) return [];
    return Array.from(dom.bulkInsertTbody.querySelectorAll("tr"));
  }

  function getBulkFieldIndex(field) {
    return BULK_FIELD_ORDER.indexOf(field);
  }

  function getBulkFieldElement(row, field) {
    return row?.querySelector?.(`[data-field="${field}"]`) || null;
  }

  function isBulkFieldFocusable(element) {
    if (!element) return false;
    if (element.disabled) return false;
    return true;
  }

  function shouldNavigateBulkCell(target, key) {
    if (!target) return false;
    const tag = target.tagName;
    if (tag === "SELECT") {
      return false;
    }
    if (tag !== "INPUT" && tag !== "TEXTAREA") {
      return true;
    }

    if (key === "ArrowUp" || key === "ArrowDown") {
      return true;
    }

    const value = target.value || "";
    const start = target.selectionStart;
    const end = target.selectionEnd;
    if (start == null || end == null) {
      return true;
    }
    if (key === "ArrowLeft") {
      return start === 0 && end === 0;
    }
    if (key === "ArrowRight") {
      return end >= value.length;
    }
    return false;
  }

  function findFocusableInRow(row, startIndex, step) {
    if (!row) return null;
    if (step === 0) {
      const field = BULK_FIELD_ORDER[startIndex];
      const element = getBulkFieldElement(row, field);
      return isBulkFieldFocusable(element) ? element : null;
    }
    let idx = startIndex;
    while (idx >= 0 && idx < BULK_FIELD_ORDER.length) {
      const field = BULK_FIELD_ORDER[idx];
      const element = getBulkFieldElement(row, field);
      if (isBulkFieldFocusable(element)) {
        return element;
      }
      idx += step;
    }
    return null;
  }

  function findClosestFocusableInRow(row, startIndex) {
    if (!row) return null;
    const direct = findFocusableInRow(row, startIndex, 0);
    if (direct) return direct;
    for (let offset = 1; offset < BULK_FIELD_ORDER.length; offset += 1) {
      const left = startIndex - offset;
      const right = startIndex + offset;
      if (left >= 0) {
        const elLeft = findFocusableInRow(row, left, -1);
        if (elLeft) return elLeft;
      }
      if (right < BULK_FIELD_ORDER.length) {
        const elRight = findFocusableInRow(row, right, 1);
        if (elRight) return elRight;
      }
    }
    return null;
  }

  function moveBulkFocus(row, field, key) {
    const rows = getBulkRowList();
    const rowIndex = rows.indexOf(row);
    if (rowIndex < 0) return;
    const fieldIndex = getBulkFieldIndex(field);
    if (fieldIndex < 0) return;

    if (key === "ArrowLeft") {
      let target = findFocusableInRow(row, fieldIndex - 1, -1);
      if (!target) {
        for (let i = rowIndex - 1; i >= 0; i -= 1) {
          target = findFocusableInRow(rows[i], BULK_FIELD_ORDER.length - 1, -1);
          if (target) break;
        }
      }
      target?.focus();
      return;
    }

    if (key === "ArrowRight") {
      let target = findFocusableInRow(row, fieldIndex + 1, 1);
      if (!target) {
        for (let i = rowIndex + 1; i < rows.length; i += 1) {
          target = findFocusableInRow(rows[i], 0, 1);
          if (target) break;
        }
      }
      target?.focus();
      return;
    }

    if (key === "ArrowUp" || key === "ArrowDown") {
      const delta = key === "ArrowDown" ? 1 : -1;
      const nextIndex = rowIndex + delta;
      if (nextIndex < 0 || nextIndex >= rows.length) return;
      const targetRow = rows[nextIndex];
      const target = findClosestFocusableInRow(targetRow, fieldIndex);
      target?.focus();
    }
  }

  function handleBulkTableChange(event) {
    const select = event.target?.closest?.("select[data-field]");
    if (!select) return;
    const row = select.closest("tr");
    if (!row) return;
    const field = select.dataset.field;
    if (field === "tipo") {
      updateBulkRowFields(row);
      return;
    }
    if (field === "seccion") {
      refreshBulkSubsectionOptions(row);
      return;
    }
    if (field === "aparicion") {
      applyAparicionTooltip(select);
    }
  }

  function updateBulkRowFields(row) {
    if (!row) return;
    const tipo =
      row.querySelector('select[data-field="tipo"]')?.value || "cuenta";
    const seccionActual =
      row.querySelector('[data-field="seccion"]')?.value || "";
    const subseccionActual =
      row.querySelector('[data-field="subseccion"]')?.value || "";
    const seccionItems = getBulkSectionNames();
    ensureBulkFieldType(row, "seccion", getBulkFieldKind(tipo, "seccion"), {
      value: seccionActual,
      items: seccionItems,
      placeholder: "Selecciona sección",
      inputPlaceholder: "Nombre de sección",
    });
    const seccionValor =
      row.querySelector('[data-field="seccion"]')?.value || "";
    ensureBulkFieldType(
      row,
      "subseccion",
      getBulkFieldKind(tipo, "subseccion"),
      {
        value: subseccionActual,
        items: getBulkSubsectionNames(seccionValor),
        placeholder: seccionValor
          ? "Selecciona subsección"
          : "Selecciona sección",
        inputPlaceholder: "Nombre de subsección",
      },
    );
    const enabledByTipo = {
      "seccion-principal": new Set(["seccion", "nombre"]),
      "seccion-secundaria": new Set(["seccion", "subseccion", "nombre"]),
      cuenta: new Set(["seccion", "subseccion", "cuenta", "nombre", "signo"]),
      operacion: new Set([
        "seccion",
        "subseccion",
        "nombre",
        "aparicion",
        "signo",
        "formula",
      ]),
    };
    const enabled = enabledByTipo[tipo] || enabledByTipo.cuenta;
    [
      "seccion",
      "subseccion",
      "cuenta",
      "nombre",
      "aparicion",
      "signo",
      "formula",
    ].forEach((field) => {
      const input = row.querySelector(`[data-field="${field}"]`);
      if (!input) return;
      const shouldEnable = enabled.has(field);
      input.disabled = !shouldEnable;
      input.classList.toggle("text-muted", !shouldEnable);

      if (!input.dataset.placeholder && input.getAttribute("placeholder")) {
        input.dataset.placeholder = input.getAttribute("placeholder");
      }
      if (shouldEnable) {
        if (input.dataset.placeholder) {
          input.setAttribute("placeholder", input.dataset.placeholder);
        }
      } else {
        input.removeAttribute("placeholder");
      }
    });
    refreshBulkSubsectionOptions(row);
    refreshBulkAparicionOptions(row);
  }

  function ensureBulkFieldType(row, field, kind, config = {}) {
    const cell = row.querySelector(`[data-cell="${field}"]`);
    if (!cell) return;
    const current = cell.querySelector(`[data-field="${field}"]`);
    const currentValue = config.value ?? current?.value ?? "";
    if (kind === "input") {
      const placeholder = config.inputPlaceholder || "";
      if (!current || current.tagName !== "INPUT") {
        cell.innerHTML = `<input type="text" class="form-control form-control-sm" data-field="${field}" placeholder="${escapeAttr(
          placeholder,
        )}" value="${escapeAttr(currentValue)}" />`;
      } else {
        current.value = currentValue;
        if (placeholder) {
          current.setAttribute("placeholder", placeholder);
        }
      }
      return;
    }

    const optionsHtml = buildBulkSelectOptions(
      config.items || [],
      currentValue,
      config.placeholder || "",
    );
    if (!current || current.tagName !== "SELECT") {
      cell.innerHTML = `<select class="form-select form-select-sm" data-field="${field}">
        ${optionsHtml}
      </select>`;
    } else {
      current.innerHTML = optionsHtml;
      current.value = currentValue;
    }
  }

  function getBulkFieldKind(tipo, field) {
    if (field === "seccion") {
      return tipo === "seccion-principal" ? "input" : "select";
    }
    if (field === "subseccion") {
      if (tipo === "seccion-principal") return "input";
      if (tipo === "seccion-secundaria") return "input";
      return "select";
    }
    return "select";
  }

  function normalizeBulkName(value) {
    return normalizeOperationMatch(value || "");
  }

  function getBulkSectionNames() {
    return getManualSectionNames();
  }

  function getBulkSubsectionNames(principal) {
    if (!principal) return [];
    return getManualSubsectionNames(principal);
  }

  function buildBulkSelectOptions(items = [], selected = "", placeholder = "") {
    const normalizedItems = new Set(
      items.map((item) => normalizeBulkName(item)),
    );
    const normalizedSelected = normalizeBulkName(selected);
    const finalItems =
      selected && normalizedSelected && !normalizedItems.has(normalizedSelected)
        ? [selected, ...items]
        : items;

    const options = [];
    if (placeholder) {
      options.push(`<option value="">${escapeHtml(placeholder)}</option>`);
    }
    finalItems.forEach((item) => {
      const isSelected =
        normalizedSelected && normalizeBulkName(item) === normalizedSelected;
      options.push(
        `<option value="${escapeAttr(item)}"${isSelected ? " selected" : ""
        }>${escapeHtml(item)}</option>`,
      );
    });
    return options.join("");
  }

  function buildBulkAparicionOptions(selected = "") {
    return buildAparicionOptions(selected);
  }

  function refreshBulkAparicionOptions(row) {
    if (!row) return;
    const select = row.querySelector('select[data-field="aparicion"]');
    if (!select) return;
    const current = select.value || "libre";
    select.innerHTML = buildBulkAparicionOptions(current);
    select.value = current;
    applyAparicionTooltip(select);
  }

  function refreshBulkSubsectionOptions(row) {
    if (!row) return;
    const principal =
      row.querySelector('select[data-field="seccion"]')?.value || "";
    const subseccionSelect = row.querySelector(
      'select[data-field="subseccion"]',
    );
    if (!subseccionSelect) return;
    const current = subseccionSelect.value || "";
    const options = buildBulkSelectOptions(
      getBulkSubsectionNames(principal),
      current,
      principal ? "Selecciona subsección" : "Selecciona sección",
    );
    subseccionSelect.innerHTML = options;
  }

  function buildAvailableElementsForFormula() {
    if (typeof getAvailableElements === "function") {
      return getAvailableElements();
    }
    return { sections: [], accounts: [], operations: [] };
  }

  // Editor de fórmula visual para inserción masiva
  function openBulkFormulaEditor(row) {
    if (!row) return;

    const tipoSelect = row.querySelector('select[data-field="tipo"]');
    const tipo = tipoSelect?.value || "cuenta";

    if (tipo !== "operacion") {
      showToast("El editor de fórmula solo aplica a operaciones", "warning");
      return;
    }

    const nombreInput = row.querySelector('input[data-field="nombre"]');
    const formulaInput = row.querySelector('input[data-field="formula"]');
    const nombreOperacion = nombreInput?.value || "Nueva Operación";
    const formulaActual = formulaInput?.value || "";

    // Parsear fórmula actual para obtener términos
    let formulaTerms = [];
    if (formulaActual.trim()) {
      try {
        formulaTerms = parseFormulaText(formulaActual);
      } catch (e) {
        console.warn("No se pudo parsear fórmula:", formulaActual, e);
      }
    }

    // Si no hay términos, crear uno vacío
    if (formulaTerms.length === 0) {
      formulaTerms = [
        {
          id: Date.now(),
          operator: "+",
          type: "section",
          value: "",
        },
      ];
    }

    // Crear operación temporal para pasar al editor
    const tempOp = {
      OperacionId: "TEMP_BULK_" + Date.now(),
      Clase: nombreOperacion,
      formula_terms: formulaTerms,
      formula_json: serializeFormulaV2(
        convertLegacyTermsToV2Tokens(formulaTerms),
      ),
    };

    // Guardar referencia a la fila para actualizar después
    tempOp._bulkRow = row;
    tempOp._bulkFormulaInput = formulaInput;

    // Importante: el botón Guardar del panel usa state.selectedElement.
    // Para inserción masiva debe apuntar a esta operación temporal.
    state.selectedElement = { type: "operation", op: tempOp };
    updateSelectionInfo();

    // Obtener elementos disponibles
    const availableElements = buildAvailableElementsForFormula();

    // Abrir panel de edición
    const panelOpened = openOperationEditorPanel(tempOp, availableElements);
    if (panelOpened) {
      // Configurar callback para cuando se guarde
      window._bulkFormulaEditorCallback = function (updatedTerms) {
        if (formulaInput) {
          const newFormulaText = buildFormulaPreviewText(updatedTerms);
          formulaInput.value = newFormulaText;
          formulaInput.dispatchEvent(new Event("change", { bubbles: true }));
        }
        window._bulkFormulaEditorCallback = null;
      };
    }
  }

  function collectBulkRows() {
    if (!dom.bulkInsertTbody) return [];
    const rows = Array.from(dom.bulkInsertTbody.querySelectorAll("tr"));
    return rows
      .map((row) => {
        const getValue = (field) =>
          row.querySelector(`[data-field="${field}"]`)?.value?.trim() || "";
        return {
          tipo: getValue("tipo"),
          seccion: getValue("seccion"),
          subseccion: getValue("subseccion"),
          cuenta: getValue("cuenta"),
          nombre: getValue("nombre"),
          aparicion: getValue("aparicion"),
          signo: getValue("signo"),
          formula: getValue("formula"),
        };
      })
      .filter((row) => {
        return (
          row.tipo ||
          row.seccion ||
          row.subseccion ||
          row.cuenta ||
          row.nombre ||
          row.signo ||
          row.formula
        );
      });
  }

  function tokenizeFormulaExpression(formula = "") {
    const source = (formula || "").toString();
    const tokens = [];
    let buffer = "";

    const flush = () => {
      const value = buffer.trim();
      if (value) {
        tokens.push({ kind: "value", value });
      }
      buffer = "";
    };

    const getPrevNonSpace = (idx) => {
      for (let i = idx - 1; i >= 0; i -= 1) {
        const ch = source[i];
        if (!/\s/.test(ch)) return ch;
      }
      return "";
    };

    const getNextNonSpace = (idx) => {
      for (let i = idx + 1; i < source.length; i += 1) {
        const ch = source[i];
        if (!/\s/.test(ch)) return ch;
      }
      return "";
    };

    for (let i = 0; i < source.length; i += 1) {
      const ch = source[i];
      const opChar = ch === "×" ? "*" : ch === "÷" ? "/" : ch;
      if (
        opChar === "+" ||
        opChar === "*" ||
        opChar === "/" ||
        opChar === "(" ||
        opChar === ")"
      ) {
        flush();
        tokens.push({ kind: "op", value: opChar });
        continue;
      }
      if (opChar === "-") {
        const prev = getPrevNonSpace(i);
        const next = getNextNonSpace(i);
        const dashBetweenWords =
          /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(prev || "") &&
          /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(next || "");
        const dashAsOperator =
          !prev ||
          !next ||
          /\s/.test(source[i - 1] || "") ||
          /\s/.test(source[i + 1] || "") ||
          ["+", "-", "*", "/", "("].includes(prev) ||
          next === "(" ||
          dashBetweenWords;
        if (dashAsOperator) {
          flush();
          tokens.push({ kind: "op", value: "-" });
          continue;
        }
      }
      buffer += ch;
    }
    flush();

    return tokens;
  }

  function normalizeInlineAccountCodeSegments(formula = "") {
    const source = (formula || "").toString();
    // Permite capturar cuentas con guiones aunque estén escritas con espacios:
    // "413 - 000 - 000 - 00" => "413-000-000-00"
    return source.replace(
      /(^|[^0-9])(\d{1,3})\s*-\s*(\d{1,3})\s*-\s*(\d{1,3})\s*-\s*(\d{1,3})(?=$|[^0-9])/g,
      (_, prefix, a, b, c, d) =>
        `${prefix}${String(a).padStart(3, "0")}-${String(b).padStart(3, "0")}-${String(
          c,
        ).padStart(3, "0")}-${String(d).padStart(2, "0")}`,
    );
  }

  function repairSplitAccountLegacyTerms(terms = []) {
    const list = Array.isArray(terms) ? terms : [];
    const out = [];
    const readType = (term) => (term?.type || "").toString().toLowerCase();
    const isAccount = (term) => {
      const type = readType(term);
      return type === "account" || type === "cuenta";
    };
    const readValue = (term) =>
      (term?.value ?? term?.cuenta ?? term?.id ?? "").toString().trim();
    const isChunk = (value) => /^\d{1,3}$/.test(value);
    const isZeroChunk = (value) => /^0{1,3}$/.test(value);
    const buildCode = (a, b, c, d) =>
      `${String(a).padStart(3, "0")}-${String(b).padStart(3, "0")}-${String(
        c,
      ).padStart(3, "0")}-${String(d).padStart(2, "0")}`;

    for (let i = 0; i < list.length; i += 1) {
      const t0 = list[i];
      if (!t0 || typeof t0 !== "object") continue;

      const t1 = list[i + 1];
      const t2 = list[i + 2];
      const t3 = list[i + 3];
      const t4 = list[i + 4];
      const v0 = readValue(t0);
      const v1 = readValue(t1);
      const v2 = readValue(t2);
      const v3 = readValue(t3);
      const v4 = readValue(t4);
      const op1 = (t1?.operator || "").toString().trim();
      const op2 = (t2?.operator || "").toString().trim();
      const op3 = (t3?.operator || "").toString().trim();
      const op4 = (t4?.operator || "").toString().trim();

      // Caso 1: "000 - 416 - 000 - 000 - 00" => "000 - (416-000-000-00)"
      const mergeable5WithZero =
        isAccount(t0) &&
        isAccount(t1) &&
        isAccount(t2) &&
        isAccount(t3) &&
        isAccount(t4) &&
        isZeroChunk(v0) &&
        isChunk(v1) &&
        isChunk(v2) &&
        isChunk(v3) &&
        isChunk(v4) &&
        op1 === "-" &&
        op2 === "-" &&
        op3 === "-" &&
        op4 === "-";

      if (mergeable5WithZero) {
        out.push(t0);
        out.push({
          ...t1,
          type: "account",
          value: buildCode(v1, v2, v3, v4),
        });
        i += 4;
        continue;
      }

      const mergeable4 =
        isAccount(t0) &&
        isAccount(t1) &&
        isAccount(t2) &&
        isAccount(t3) &&
        isChunk(v0) &&
        isChunk(v1) &&
        isChunk(v2) &&
        isChunk(v3) &&
        op1 === "-" &&
        op2 === "-" &&
        op3 === "-";

      if (mergeable4) {
        out.push({
          ...t0,
          type: "account",
          value: buildCode(v0, v1, v2, v3),
        });
        i += 3;
        continue;
      }

      out.push(t0);
    }

    return out;
  }

  function isKnownPrincipalSection(name = "") {
    const target = normalizeOperationMatch(name || "");
    if (!target) return false;
    return getManualSectionNames().some(
      (item) => normalizeOperationMatch(item || "") === target,
    );
  }

  function findUniqueParentForSubsection(subsection = "") {
    const target = normalizeOperationMatch(subsection || "");
    if (!target) return "";
    const matches = [];
    getManualSectionNames().forEach((principal) => {
      const found = getManualSubsectionNames(principal).some(
        (sub) => normalizeOperationMatch(sub || "") === target,
      );
      if (found) matches.push(principal);
    });
    return matches.length === 1 ? matches[0] : "";
  }

  function subsectionExistsInParent(parentSection = "", subsectionName = "") {
    const parentKey = normalizeOperationMatch(parentSection || "");
    const subsectionKey = normalizeOperationMatch(subsectionName || "");
    if (!parentKey || !subsectionKey) return false;
    return getManualSubsectionNames(parentSection).some(
      (sub) => normalizeOperationMatch(sub || "") === subsectionKey,
    );
  }

  function buildRefTokenFromValue(valueRaw = "", options = {}) {
    const value = (valueRaw || "").toString().trim();
    if (!value) return null;

    const numericValue = Number(value);
    if (Number.isFinite(numericValue) && /^[-+]?\d+(\.\d+)?$/.test(value)) {
      return {
        kind: FORMULA_KIND_CONST,
        value: numericValue,
      };
    }

    const detectedType = detectTermType(value);
    if (detectedType === "operation") {
      const resolvedId = resolveOperationId(value);
      const refId = buildOperationRefId(resolvedId);
      return {
        kind: FORMULA_KIND_REF,
        refType: "operation",
        refId,
        label: value,
        unresolved: !refId,
      };
    }

    if (detectedType === "account") {
      const refId = buildAccountRefId(value);
      return {
        kind: FORMULA_KIND_REF,
        refType: "account",
        refId,
        label: value,
        unresolved: !refId,
      };
    }

    const parsedSection = parseSectionSelection(value);
    const sectionLabel = parsedSection.section || value;
    const explicitParent = (parsedSection.parent || "").toString().trim();
    const parentHintRaw =
      options.parentSection || options.defaultParentSection || "";
    const parentHint = (parentHintRaw || "").toString().trim();

    // Si el usuario escribe "PARENT||SUB", es una subsección explícita.
    if (explicitParent) {
      const refId = buildSubsectionRefId(explicitParent, sectionLabel);
      return {
        kind: FORMULA_KIND_REF,
        refType: "subsection",
        refId,
        label: sectionLabel,
        parentSection: explicitParent,
        unresolved: !refId,
      };
    }

    // Caso homónimo: si en el contexto actual existe subsección con el mismo nombre
    // que su sección principal (ej: "Monterrey Income"), priorizar subsección.
    const sameNameInContext =
      parentHint &&
      normalizeOperationMatch(parentHint) ===
      normalizeOperationMatch(sectionLabel) &&
      subsectionExistsInParent(parentHint, sectionLabel);
    if (sameNameInContext) {
      const refId = buildSubsectionRefId(parentHint, sectionLabel);
      return {
        kind: FORMULA_KIND_REF,
        refType: "subsection",
        refId,
        label: sectionLabel,
        parentSection: parentHint,
        unresolved: !refId,
      };
    }

    // Si coincide con una sección principal conocida, NO inferir subsección por contexto.
    if (isKnownPrincipalSection(sectionLabel)) {
      const refId = buildSectionRefId(sectionLabel);
      return {
        kind: FORMULA_KIND_REF,
        refType: "section",
        refId,
        label: sectionLabel,
        unresolved: !refId,
      };
    }

    // Si estamos dentro de una sección (contexto), asumir subsección cuando NO es una sección principal.
    if (parentHint) {
      const refId = buildSubsectionRefId(parentHint, sectionLabel);
      return {
        kind: FORMULA_KIND_REF,
        refType: "subsection",
        refId,
        label: sectionLabel,
        parentSection: parentHint,
        unresolved: !refId,
      };
    }

    const inferredParent = findUniqueParentForSubsection(sectionLabel);
    if (inferredParent) {
      const refId = buildSubsectionRefId(inferredParent, sectionLabel);
      return {
        kind: FORMULA_KIND_REF,
        refType: "subsection",
        refId,
        label: sectionLabel,
        parentSection: inferredParent,
        unresolved: !refId,
      };
    }

    const fallbackRefId = buildSectionRefId(sectionLabel);
    return {
      kind: FORMULA_KIND_REF,
      refType: "section",
      refId: fallbackRefId,
      label: sectionLabel,
      unresolved: !fallbackRefId,
    };
  }

  function parseFormulaExpressionV2(formula = "", options = {}) {
    const raw = normalizeInlineAccountCodeSegments(
      (formula || "").toString(),
    ).trim();
    if (!raw) {
      return { valid: true, tokens: [], terms: [], error: "" };
    }

    const lexical = tokenizeFormulaExpression(raw);
    const tokens = [];
    let balance = 0;
    let expectingValue = true;

    for (let idx = 0; idx < lexical.length; idx += 1) {
      const item = lexical[idx];
      if (!item) continue;

      if (item.kind === "op") {
        const opValue = (item.value || "").toString().trim();
        if (!FORMULA_OPERATORS.has(opValue)) {
          return {
            valid: false,
            tokens: [],
            terms: [],
            error: `Operador no permitido: ${opValue}`,
          };
        }

        if (opValue === "(") {
          if (!expectingValue) {
            return {
              valid: false,
              tokens: [],
              terms: [],
              error: "Falta un operador antes de '('",
            };
          }
          balance += 1;
          tokens.push({ kind: FORMULA_KIND_OP, value: "(" });
          expectingValue = true;
          continue;
        }

        if (opValue === ")") {
          if (expectingValue || balance <= 0) {
            return {
              valid: false,
              tokens: [],
              terms: [],
              error: "Paréntesis de cierre inválido",
            };
          }
          balance -= 1;
          tokens.push({ kind: FORMULA_KIND_OP, value: ")" });
          expectingValue = false;
          continue;
        }

        if (expectingValue) {
          if (opValue === "+" || opValue === "-") {
            tokens.push({ kind: FORMULA_KIND_OP, value: opValue });
            expectingValue = true;
            continue;
          }
          return {
            valid: false,
            tokens: [],
            terms: [],
            error: `Operador '${opValue}' en posición inválida`,
          };
        }

        tokens.push({ kind: FORMULA_KIND_OP, value: opValue });
        expectingValue = true;
        continue;
      }

      if (!expectingValue) {
        return {
          valid: false,
          tokens: [],
          terms: [],
          error: `Falta operador antes de '${item.value}'`,
        };
      }

      const refToken = buildRefTokenFromValue(item.value, options);
      if (!refToken) {
        return {
          valid: false,
          tokens: [],
          terms: [],
          error: `Token inválido: ${item.value}`,
        };
      }
      tokens.push(refToken);
      expectingValue = false;
    }

    if (balance !== 0) {
      return {
        valid: false,
        tokens: [],
        terms: [],
        error: "Paréntesis desbalanceados",
      };
    }

    if (expectingValue) {
      return {
        valid: false,
        tokens: [],
        terms: [],
        error: "La fórmula termina con un operador",
      };
    }

    const terms = normalizeFormulaTerms(convertV2TokensToLegacyTerms(tokens));
    return { valid: true, tokens, terms, error: "" };
  }

  function parseFormulaText(formula = "") {
    const parsed = parseFormulaExpressionV2(formula);
    if (!parsed.valid) return [];
    return parsed.terms || [];
  }

  function openAddModal() {
    if (!state.editMode) {
      showToast("Activa el modo edición primero", "warning");
      return;
    }
    setBulkMode(isBulkModeEnabled());
    updateAddForm();
    new bootstrap.Modal(dom.modalAgregar).show();
  }

  function updateAddForm() {
    if (isBulkModeEnabled()) {
      return;
    }
    const tipo = document.querySelector(
      'input[name="tipoElemento"]:checked',
    )?.value;

    let formHtml = "";

    switch (tipo) {
      case "seccion-principal":
        formHtml = `
          <div class="mb-3">
            <label class="form-label">Nombre de la Sección Principal</label>
            <input type="text" class="form-control" id="inputNombreSeccion" placeholder="Ej: INCOME" />
          </div>
        `;
        break;

      case "seccion-secundaria":
        formHtml = `
          <div class="mb-3">
            <label class="form-label">Sección Principal</label>
            <select class="form-select" id="selectPrincipal">
              ${getSectionOptions()}
            </select>
          </div>
          <div class="mb-3">
            <label class="form-label">Nombre de la Sección Secundaria</label>
            <input type="text" class="form-control" id="inputNombreSubseccion" placeholder="Ej: Membership Dues" />
          </div>
        `;
        break;

      case "cuenta":
        formHtml = `
          <div class="row">
            <div class="col-md-6 mb-3">
              <label class="form-label">Sección Principal</label>
              <select class="form-select" id="selectPrincipal" onchange="updateSubsectionOptions()">
                ${getSectionOptions()}
              </select>
            </div>
            <div class="col-md-6 mb-3">
              <label class="form-label">Sección Secundaria</label>
              <select class="form-select" id="selectSecundaria">
                ${getSubsectionOptions()}
              </select>
            </div>
          </div>
          <div class="row">
            <div class="col-md-4 mb-3">
              <label class="form-label">Número de Cuenta</label>
              <input type="text" class="form-control" id="inputCuenta" placeholder="401-001-000-00" list="datalistCuentas" oninput="buscarCuentasDinamicas(this.value)" />
              <datalist id="datalistCuentas"></datalist>
            </div>
            <div class="col-md-8 mb-3">
              <label class="form-label">Nombre</label>
              <input type="text" class="form-control" id="inputNombre" placeholder="Cuotas de membresía" />
            </div>
          </div>
        `;
        break;

      case "operacion":
        formHtml = `
          <div class="mb-3">
            <label class="form-label">Identificador unico</label>
            <input type="text" class="form-control" id="inputOperacionId" placeholder="Ej: CDMX_INCOME" />
            <div class="invalid-feedback">Indica un ID si no hay etiqueta.</div>
            <div class="form-text">Define un ID único manualmente.</div>
          </div>
          <div class="mb-3">
            <label class="form-label">Etiqueta de la Operación <span class="text-danger">*</span></label>
            <input type="text" class="form-control" id="inputClase" placeholder="Ej: TOTAL INCOME, NET RESULTS" />
            <div class="invalid-feedback">Etiqueta o ID son obligatorios.</div>
          </div>
          <div class="mb-3">
            <label class="form-label">Tipo de Operación</label>
            <select class="form-select" id="selectTipoOp" onchange="toggleFormulaBuilder()">
              <option value="custom-formula" selected>Fórmula personalizada</option>
              <option value="sum-sections">Suma de secciones</option>
            </select>
          </div>
          
          <!-- Modo simple: checkboxes de secciones -->
          <div id="simpleFormulaMode" class="mb-3">
            <label class="form-label">Secciones a sumar</label>
            <div id="checkboxSecciones" class="sections-checklist">
              ${getSectionCheckboxes()}
            </div>
          </div>
          
          <!-- Modo avanzado: constructor de fórmulas -->
          <div id="advancedFormulaMode" style="display:none;">
            <label class="form-label">Construir Fórmula</label>
            <div class="formula-builder">
              <div id="formulaTerms" class="formula-terms">
                <!-- Los términos se agregan aquí dinámicamente -->
              </div>
              <button type="button" class="btn btn-outline-success btn-sm mt-2" onclick="addFormulaTerm()">
                <i class="bi bi-plus-circle me-1"></i>Agregar término
              </button>
            </div>
            <div class="formula-preview mt-3">
              <label class="form-label">Fórmula resultante:</label>
              <div id="formulaPreview" class="formula-preview-text">
                (Sin términos)
              </div>
            </div>
          </div>
          <div class="mt-4">
            <label class="form-label">Aparición en la tabla</label>
            <div class="row g-2">
              ${OP_ROW_FIELDS.map(
          (row) => `
                  <div class="col-md-6">
                    <div class="form-check">
                      <input class="form-check-input" type="checkbox" id="${rowLabelAddCheckId(
            row.field,
          )}">
                      <label class="form-check-label" for="${rowLabelAddCheckId(
            row.field,
          )}">${row.label}</label>
                    </div>
                    <input type="text" class="form-control form-control-sm mt-1" id="${rowLabelAddInputId(
            row.field,
          )}" placeholder="${row.placeholder}">
                  </div>
                `,
        ).join("")}
            </div>
            <div class="form-text">
              Selecciona dónde aparece la operación. Si no eliges nada, se usa "Fila de Suma".
            </div>
          </div>
        `;
        break;
    }

    dom.formElemento.innerHTML = formHtml;
    if (tipo === "cuenta") {
      // Asegurar que el combo de subsecciones arranque filtrado por la sección seleccionada.
      try {
        window.updateSubsectionOptions?.();
      } catch (_) {
        // ignore
      }
    }
    const claseInput = document.getElementById("inputClase");
    const idInput = document.getElementById("inputOperacionId");
    const clearInvalid = (input) => {
      if (!input) return;
      input.classList.remove("is-invalid");
    };
    claseInput?.addEventListener("input", () => clearInvalid(claseInput));
    idInput?.addEventListener("input", () => clearInvalid(idInput));
  }

  function getSectionOptions() {
    const sectionNames = getManualSectionNames();
    const options = [
      '<option value="">Sin sección (Libre)</option>',
      ...(sectionNames || []).map(
        (name) =>
          `<option value="${escapeAttr(name)}">${escapeHtml(name)}</option>`,
      ),
    ];
    return options.join("");
  }

  function getSubsectionOptions() {
    return '<option value="">Sin subsección</option>';
  }

  function getSectionCheckboxes() {
    const sections = buildManualSectionTree();
    if (!Array.isArray(sections) || sections.length === 0) {
      return '<div class="text-muted small">Sin secciones disponibles</div>';
    }
    const items = [];
    sections.forEach((section) => {
      const principal = section?.name;
      if (principal) {
        items.push({
          value: principal,
          label: principal,
          indent: false,
        });
      }
      (section.subsections || []).forEach((subsection) => {
        const subName = subsection?.name || "";
        if (!subName) return;
        if (
          normalizeOperationMatch(subName) ===
          normalizeOperationMatch(principal || "")
        ) {
          return;
        }
        items.push({
          value: `${principal}||${subName}`,
          label: `${subName} (${principal})`,
          indent: true,
        });
      });
    });

    if (!items.length) {
      return '<div class="text-muted small">Sin secciones disponibles</div>';
    }

    return items
      .map(
        (item) => `
        <div class="form-check${item.indent ? " ms-3" : ""}">
          <input class="form-check-input" type="checkbox" value="${escapeAttr(
          item.value,
        )}" id="chk_${escapeAttr(item.value)}">
          <label class="form-check-label" for="chk_${escapeAttr(
          item.value,
        )}">${escapeHtml(item.label)}</label>
        </div>
      `,
      )
      .join("");
  }

  async function confirmAdd() {
    if (isBulkModeEnabled()) {
      await confirmBulkAdd();
      return;
    }
    const tipo = document.querySelector(
      'input[name="tipoElemento"]:checked',
    )?.value;

    try {
      switch (tipo) {
        case "seccion-principal":
          await addPrincipalSection();
          break;
        case "seccion-secundaria":
          await addSecondarySection();
          break;
        case "cuenta":
          await addAccount();
          break;
        case "operacion":
          await addOperation();
          break;
      }

      bootstrap.Modal.getInstance(dom.modalAgregar)?.hide();
      const saved = await saveLayout({
        skipConfirmation: true,
        silent: true,
        source: "add",
      });
      if (saved) {
        await loadLayout();
      } else {
        showToast(
          "No se pudo guardar el cambio. Revisa permisos o conexión y vuelve a intentar.",
          "error",
        );
      }
    } catch (error) {
      console.error("Error adding element:", error);
      showToast(error.message, "error");
    }
  }

  async function addPrincipalSection() {
    const nombre = document.getElementById("inputNombreSeccion")?.value?.trim();
    if (!nombre) throw new Error("Ingresa un nombre para la sección");
    addPrincipalSectionByName(nombre);
  }

  async function addSecondarySection() {
    const principal = document.getElementById("selectPrincipal")?.value;
    const nombre = document
      .getElementById("inputNombreSubseccion")
      ?.value?.trim();

    if (!principal || !principal.toString().trim()) {
      throw new Error("Selecciona una sección principal para la subsección");
    }
    if (!nombre) throw new Error("Ingresa un nombre para la subsección");
    addSecondarySectionByName(principal, nombre);
  }

  async function addAccount() {
    const principal = document.getElementById("selectPrincipal")?.value || "";
    let secundaria = document.getElementById("selectSecundaria")?.value || "";
    const cuenta = document.getElementById("inputCuenta")?.value?.trim();
    const nombre = document.getElementById("inputNombre")?.value?.trim();

    if (!cuenta || !nombre)
      throw new Error("Completa el código y nombre de la cuenta");
    if (!principal.toString().trim()) {
      // Cuenta libre: no permitir que quede "subsección huérfana"
      secundaria = "";
    }
    addAccountEntry({ principal, secundaria, cuenta, nombre });
  }

  function addPrincipalSectionByName(nombre, { silent = false } = {}) {
    const cleanName = (nombre || "").toString().trim();
    if (!cleanName) return false;
    const sectionKey = normalizeOperationMatch(cleanName);
    const alreadyExists = (state.cuentas || []).some(
      (cuenta) =>
        normalizeOperationMatch(getAccountPrincipalName(cuenta) || "") ===
        sectionKey,
    );
    if (alreadyExists) {
      if (!silent) {
        showToast(`La sección "${cleanName}" ya existe`, "info");
      }
      return false;
    }
    const order = getNextAccountOrder();
    const newAccount = {
      "SECCIÓN Principal": cleanName,
      "SECCION Secundaria": "",
      SECCION: cleanName,
      CUENTA: "",
      NOMBRE: `[Sección: ${cleanName}]`,
      orden: order,
      orden_presentacion: order,
      visible: false,
      __layoutPlaceholder: true,
      __placeholderType: "principal",
    };

    assignAccountRowId(newAccount);
    state.cuentas.push(newAccount);
    logChange("add", `Sección Principal "${cleanName}"`, {
      nombre: cleanName,
      type: "section",
    });
    if (!silent) {
      showToast(`Sección "${cleanName}" creada`, "success");
    }
    return true;
  }

  function addSecondarySectionByName(
    principal,
    nombre,
    { silent = false } = {},
  ) {
    const principalClean = (principal || "").toString().trim();
    const nombreClean = (nombre || "").toString().trim();
    if (!principalClean || !nombreClean) return false;
    const principalKey = normalizeOperationMatch(principalClean);
    const secundariaKey = normalizeOperationMatch(nombreClean);
    const exists = (state.cuentas || []).some((cuenta) => {
      const p = normalizeOperationMatch(getAccountPrincipalName(cuenta) || "");
      const s = normalizeOperationMatch(getAccountSecondaryName(cuenta) || "");
      return p === principalKey && s === secundariaKey;
    });
    if (exists) {
      if (!silent) {
        showToast(
          `La subsección "${nombreClean}" ya existe en "${principalClean}"`,
          "info",
        );
      }
      return false;
    }
    const order = getNextAccountOrder();
    const newAccount = {
      "SECCIÓN Principal": principalClean,
      "SECCION Secundaria": nombreClean,
      SECCION: principalClean,
      CUENTA: "",
      NOMBRE: `[Subsección: ${nombreClean}]`,
      orden: order,
      orden_presentacion: order,
      visible: false,
      __layoutPlaceholder: true,
      __placeholderType: "secundaria",
    };

    assignAccountRowId(newAccount);
    state.cuentas.push(newAccount);
    logChange("add", `Subsección "${nombreClean}" en ${principalClean}`, {
      nombre: nombreClean,
      principal: principalClean,
      type: "subsection",
    });
    if (!silent) {
      showToast(`Subsección "${nombreClean}" creada`, "success");
    }
    return true;
  }

  function addAccountEntry(
    { principal, secundaria, cuenta, nombre, factor },
    { silent = false } = {},
  ) {
    const principalClean = (principal || "").toString().trim();
    const secundariaClean = principalClean
      ? (secundaria || "").toString().trim()
      : "";
    const order = getNextAccountOrder();
    const newAccount = {
      "SECCIÓN Principal": principalClean,
      "SECCION Secundaria": secundariaClean,
      SECCION: principalClean,
      CUENTA: cuenta,
      NOMBRE: nombre,
      valor_plantilla: 0,
      orden: order,
      orden_presentacion: order,
    };
    if (Number.isFinite(Number(factor))) {
      newAccount.operacion_factor = Number(factor);
    }

    assignAccountRowId(newAccount);
    state.cuentas.push(newAccount);
    logChange("add", `Cuenta ${cuenta} - ${nombre}`, {
      cuenta,
      nombre,
      principal,
      secundaria,
    });
    if (!silent) {
      showToast(`Cuenta ${cuenta} agregada`, "success");
    }
  }

  function addOperationEntry(
    {
      nombre,
      seccion,
      subseccion,
      signo,
      formulaTerms,
      formulaTokens,
      rowLabels = {},
    },
    { silent = false } = {},
  ) {
    const parentSection = seccion || "";
    const parentSubsection = subseccion || "";
    const rowSection = subseccion || seccion || "";
    const normalizedLabel = normalizeOperationMatch(nombre || "");
    const sectionKey = normalizeOperationMatch(rowSection);
    const parentKey = normalizeOperationMatch(parentSection);

    let existing = null;
    if (rowSection) {
      const lookupScope = parentSubsection
        ? "subsection"
        : parentSection
          ? "section"
          : "auto";
      existing = findOperationBySectionName(rowSection, parentSection || "", {
        scope: lookupScope,
      });
    }
    if (!existing && normalizedLabel) {
      existing = (state.operaciones || []).find((item) => {
        if (!item) return false;
        const itemLabel = normalizeOperationMatch(
          getOperationDisplayName(item) ||
          getOperationLabel(item) ||
          getOperationId(item),
        );
        if (!itemLabel || itemLabel !== normalizedLabel) return false;
        if (!sectionKey) return true;
        const matchesPlacement = getOperationPlacementCandidates(item).some(
          (candidate) => normalizeOperationMatch(candidate) === sectionKey,
        );
        if (!matchesPlacement) return false;
        if (!parentKey) return true;
        return getOperationParentCandidates(item).some(
          (candidate) => normalizeOperationMatch(candidate) === parentKey,
        );
      });
    }

    if (existing) {
      if (nombre) {
        existing.Clase = nombre;
        existing.operacion_etiqueta = nombre;
      }
      existing.SECCION = rowSection;
      existing.seccion = rowSection;
      existing.tipo =
        Array.isArray(formulaTerms) && formulaTerms.length
          ? "custom-formula"
          : existing.tipo || "custom-formula";
      existing.secciones = rowSection ? [rowSection] : [];
      existing.parentSection = parentSection || null;
      existing.parentSubsection = parentSubsection || null;
      if (Number.isFinite(Number(signo))) {
        existing.signo = Number(signo);
        existing.signos = existing.signos || {};
        existing.signos["sum-row"] = Number(signo);
      }
      if (Array.isArray(formulaTerms)) {
        const normalized = normalizeFormulaTerms(formulaTerms);
        const tokens =
          Array.isArray(formulaTokens) && formulaTokens.length
            ? formulaTokens
            : convertLegacyTermsToV2Tokens(normalized, existing);
        applyStrictFormulaTermsToOperation(existing, normalized, tokens);
      }
      if (rowLabels && typeof rowLabels === "object") {
        Object.entries(rowLabels).forEach(([field, label]) => {
          if (!label) return;
          existing[field] = label;
        });
      }

      logChange("edit", `Operación "${nombre}" actualizada`, {
        nombre,
        type: "operation",
      });

      if (!silent) {
        state.operaciones = sortOperations(state.operaciones);
        ensureOperationIds();
        renderLayout();
        showToast(`Operación "${nombre}" actualizada`, "success");
      }
      return { created: false, updated: true, operation: existing };
    }

    const opIdBase = normalizeOperationId(nombre || "OPERACION");
    const operacionId = buildUniqueOperationId(opIdBase);

    const op = {
      CAPITULO: state.capitulo || "DEFAULT",
      HOJA: state.modulo || "",
      OperacionId: operacionId,
      Clase: nombre,
      operacion_etiqueta: nombre,
      SECCION: rowSection,
      tipo: "custom-formula",
      signos: {},
      orden: nextOperationOrder(),
      secciones: rowSection ? [rowSection] : [],
      parentSection: parentSection || null,
      parentSubsection: parentSubsection || null,
    };

    if (Number.isFinite(Number(signo))) {
      op.signo = Number(signo);
      op.signos = op.signos || {};
      op.signos["sum-row"] = Number(signo);
    }

    if (Array.isArray(formulaTerms)) {
      const normalized = normalizeFormulaTerms(formulaTerms);
      const tokens =
        Array.isArray(formulaTokens) && formulaTokens.length
          ? formulaTokens
          : convertLegacyTermsToV2Tokens(normalized, op);
      applyStrictFormulaTermsToOperation(op, normalized, tokens);
    } else {
      applyStrictFormulaTermsToOperation(op, [], []);
    }

    if (rowLabels && typeof rowLabels === "object") {
      Object.entries(rowLabels).forEach(([field, label]) => {
        if (!label) return;
        op[field] = label;
      });
    }

    state.operaciones.push(op);
    logChange("add", `Operación "${nombre}"`, {
      nombre,
      type: "operation",
    });

    if (!silent) {
      state.operaciones = sortOperations(state.operaciones);
      ensureOperationIds();
      // normalizeOperationReferences(); // DESACTIVADO: modo 100% manual
      renderLayout();
      showToast(`Operación "${nombre}" creada`, "success");
    }
    return { created: true, updated: false, operation: op };
  }

  function collectAddOperationRowLabels(defaultLabel) {
    const labels = {};
    OP_ROW_FIELDS.forEach(({ field }) => {
      const check = document.getElementById(rowLabelAddCheckId(field));
      const input = document.getElementById(rowLabelAddInputId(field));
      const value = input?.value?.trim();
      const enabled = check ? check.checked : Boolean(value);
      if (!enabled) return;
      labels[field] = value || defaultLabel || "";
    });
    return labels;
  }

  function findOperationBySectionName(
    sectionName,
    parentSection = "",
    options = {},
  ) {
    if (!sectionName) return null;
    const target = normalizeOperationMatch(sectionName);
    const parentKey = normalizeOperationMatch(parentSection);
    const scopeHintRaw =
      typeof options === "string" ? options : options?.scope || "";
    const scopeHint = (scopeHintRaw || "").toString().trim().toLowerCase();
    const forceSubsectionScope = scopeHint === "subsection";
    const forceSectionScope = scopeHint === "section";
    const isSubsectionScope = Boolean(
      forceSubsectionScope ||
      (!forceSectionScope && parentKey && target && parentKey !== target),
    );
    const isSectionScope = Boolean(
      forceSectionScope ||
      (!forceSubsectionScope && parentKey && target && parentKey === target),
    );
    const matches = (state.operaciones || []).filter((op) => {
      if (!op || !isHeaderLinkedOperation(op)) return false;
      const opParentKey = normalizeOperationMatch(op.parentSection || "");
      const opSubKey = normalizeOperationMatch(op.parentSubsection || "");
      const sumRowKey = normalizeOperationMatch(op?.["sum-row"] || "");
      const placementKey = normalizeOperationMatch(
        op.SECCION || op.seccion || "",
      );
      const sumRowVariosKey = normalizeOperationMatch(
        op?.["sum-row-sumavarios"] || "",
      );
      const sumRowVarios2Key = normalizeOperationMatch(
        op?.["sum-row-sumavarios2"] || "",
      );
      const hasRowLabel = ROW_LABEL_FIELDS.some(
        (field) => normalizeOperationMatch(op?.[field]) === target,
      );

      if (isSubsectionScope) {
        const matchesSubAnchor =
          opSubKey === target || sumRowKey === target || placementKey === target;
        if (!matchesSubAnchor) return false;
        if (opParentKey) return opParentKey === parentKey;
        if (!parentKey) return true;
        return operationMatchesParentSectionHint(op, parentSection);
      }

      if (isSectionScope) {
        const hasLegacySectionAnchor =
          placementKey === target ||
          sumRowVariosKey === target ||
          sumRowVarios2Key === target ||
          hasRowLabel;
        const parentMatches = opParentKey === parentKey;
        const legacyMatches = !opParentKey && hasLegacySectionAnchor;
        if (!parentMatches && !legacyMatches) return false;
        if (opSubKey && opSubKey !== target) return false;
        if (sumRowKey && sumRowKey !== target) return false;
        return hasLegacySectionAnchor;
      }

      return hasRowLabel;
    });
    if (!matches.length) return null;
    if (isSubsectionScope) {
      const explicitSubMatches = matches.filter((op) => {
        const opSubKey = normalizeOperationMatch(op?.parentSubsection || "");
        const sumRowKey = normalizeOperationMatch(op?.["sum-row"] || "");
        return opSubKey === target || sumRowKey === target;
      });
      const candidatePool =
        explicitSubMatches.length > 0 ? explicitSubMatches : matches;
      const scored = candidatePool
        .map((op) => ({
          op,
          score: getOperationParentMatchScore(op, parentSection),
        }))
        .sort((a, b) => b.score - a.score);
      const topScore = scored[0]?.score ?? 0;
      const topMatches = scored
        .filter((entry) => entry.score === topScore)
        .map((entry) => entry.op);
      if (parentKey && topScore === 0) return null;
      if (parentKey && topScore <= 1 && topMatches.length > 1) return null;

      const exactSub = topMatches.find(
        (op) => normalizeOperationMatch(op?.parentSubsection || "") === target,
      );
      if (exactSub) return exactSub;
      const bySumRow = topMatches.find(
        (op) => normalizeOperationMatch(op?.["sum-row"] || "") === target,
      );
      if (bySumRow) return bySumRow;
      const byPlacement = topMatches.find(
        (op) =>
          normalizeOperationMatch(op?.SECCION || op?.seccion || "") === target,
      );
      if (byPlacement) {
        const placementSubKey = normalizeOperationMatch(
          byPlacement?.parentSubsection || "",
        );
        const placementSumRowKey = normalizeOperationMatch(
          byPlacement?.["sum-row"] || "",
        );
        const isHomonymScope = Boolean(parentKey && parentKey === target);
        if (isHomonymScope && !placementSubKey && !placementSumRowKey) {
          return null;
        }
        return byPlacement;
      }
      return topMatches[0] || null;
    }
    if (isSectionScope) {
      const isSectionCandidate = (op) => {
        const subKey = normalizeOperationMatch(op?.parentSubsection || "");
        const sumRowKey = normalizeOperationMatch(op?.["sum-row"] || "");
        const hasSubAnchor = Boolean(subKey || sumRowKey);
        const sectionAnchorKeys = [
          normalizeOperationMatch(op?.["sum-row-sumavarios"] || ""),
          normalizeOperationMatch(op?.["sum-row-sumavarios2"] || ""),
          normalizeOperationMatch(op?.["sum-row-operativo"] || ""),
          normalizeOperationMatch(op?.["result-row"] || ""),
          normalizeOperationMatch(op?.["net-row"] || ""),
          normalizeOperationMatch(op?.["result-net-row"] || ""),
        ];
        const hasSectionAnchor = sectionAnchorKeys.some((key) => key === target);
        if (hasSectionAnchor) return true;
        return !hasSubAnchor;
      };

      const sectionMatches = matches.filter((op) => isSectionCandidate(op));
      if (!sectionMatches.length) {
        // Evitar enlazar una operación de subsección cuando principal/subsección
        // comparten nombre (ej. "Monterrey Income").
        return null;
      }

      const bySumVarios = sectionMatches.find(
        (op) =>
          normalizeOperationMatch(op?.["sum-row-sumavarios"] || "") ===
          target ||
          normalizeOperationMatch(op?.["sum-row-sumavarios2"] || "") ===
          target,
      );
      if (bySumVarios) return bySumVarios;
      return sectionMatches[0] || null;
    }
    return matches[0] || null;
  }

  async function confirmBulkAdd() {
    const rows = collectBulkRows();
    if (!rows.length) {
      showToast("No hay filas con datos para agregar", "warning");
      return;
    }

    const counters = {
      secciones: 0,
      subsecciones: 0,
      cuentas: 0,
      operaciones: 0,
      operacionesActualizadas: 0,
    };
    const errores = [];

    rows.forEach((row, idx) => {
      try {
        const tipo = (row.tipo || "").trim();
        if (!tipo) return;
        switch (tipo) {
          case "seccion-principal": {
            const nombre = row.seccion || row.nombre;
            if (!nombre) throw new Error("Falta nombre de sección");
            addPrincipalSectionByName(nombre, { silent: true });
            counters.secciones += 1;
            break;
          }
          case "seccion-secundaria": {
            const principal = row.seccion;
            const nombre = row.subseccion || row.nombre;
            if (!principal) throw new Error("Falta sección principal");
            if (!nombre) throw new Error("Falta nombre de subsección");
            addSecondarySectionByName(principal, nombre, { silent: true });
            counters.subsecciones += 1;
            break;
          }
          case "cuenta": {
            const principal = row.seccion;
            const secundaria = row.subseccion;
            const cuenta = row.cuenta;
            const nombre = row.nombre;
            if (!cuenta || !nombre) {
              throw new Error("Cuenta y nombre son requeridos");
            }
            const factor = Number(row.signo);
            addAccountEntry(
              {
                principal,
                secundaria,
                cuenta,
                nombre,
                factor: Number.isFinite(factor) ? factor : null,
              },
              { silent: true },
            );
            counters.cuentas += 1;
            break;
          }
          case "operacion": {
            const nombre = row.nombre || row.seccion || row.subseccion;
            if (!nombre) throw new Error("Falta nombre de operación");
            const sign = Number(row.signo);
            let formulaTerms = [];
            let formulaTokens = [];
            if (row.formula) {
              const parsedFormula = parseFormulaExpressionV2(row.formula, {
                parentSection: row.seccion || "",
                defaultParentSection: row.seccion || "",
              });
              if (!parsedFormula.valid) {
                throw new Error(
                  `Fórmula inválida: ${parsedFormula.error || "sintaxis incorrecta"}`,
                );
              }
              formulaTerms = normalizeFormulaTerms(parsedFormula.terms || []);
              formulaTokens = Array.isArray(parsedFormula.tokens)
                ? parsedFormula.tokens
                : [];
            }

            const aparicion = (row.aparicion || "libre").trim();
            const rowLabels =
              aparicion && aparicion !== "libre" ? { [aparicion]: nombre } : {};
            const opResult = addOperationEntry(
              {
                nombre,
                seccion: row.seccion,
                subseccion: row.subseccion,
                signo: Number.isFinite(sign) ? sign : null,
                formulaTerms,
                formulaTokens,
                rowLabels,
              },
              { silent: true },
            );
            if (opResult?.created) {
              counters.operaciones += 1;
            } else if (opResult?.updated) {
              counters.operacionesActualizadas += 1;
            }
            break;
          }
          default:
            throw new Error(`Tipo no reconocido: ${tipo}`);
        }
      } catch (error) {
        errores.push(`Fila ${idx + 1}: ${error.message}`);
      }
    });

    if (
      counters.secciones +
      counters.subsecciones +
      counters.cuentas +
      counters.operacionesActualizadas +
      counters.operaciones ===
      0 &&
      errores.length
    ) {
      throw new Error(errores[0]);
    }

    if (counters.operaciones > 0 || counters.operacionesActualizadas > 0) {
      state.operaciones = sortOperations(state.operaciones);
      ensureOperationIds();
      // normalizeOperationReferences(); // DESACTIVADO: modo 100% manual
    }

    if (errores.length) {
      console.warn("[BulkAdd] Errores:", errores);
      showToast(
        `${errores[0]}${errores.length > 1 ? ` (+${errores.length - 1} más)` : ""}`,
        "warning",
      );
    }

    bootstrap.Modal.getInstance(dom.modalAgregar)?.hide();
    const saved = await saveLayout({
      skipConfirmation: true,
      silent: true,
      source: "bulk-add",
    });

    if (!saved) {
      showToast(
        "No se pudieron guardar los cambios de la inserción masiva. Revisa la conexión o vuelve a intentar.",
        "error",
      );
      return;
    }

    await loadLayout();
    resetBulkInsertTable({ focus: true });

    showToast(
      `Agregadas: ${counters.secciones} secciones, ${counters.subsecciones} subsecciones, ${counters.cuentas} cuentas, ${counters.operaciones} operaciones.${counters.operacionesActualizadas ? ` Actualizadas: ${counters.operacionesActualizadas} operaciones.` : ""}`,
      "success",
    );
  }

  function parseSectionSelection(value = "") {
    const raw = (value || "").toString();
    if (!raw) return { section: "", parent: "" };
    const parts = raw.split("||");
    if (parts.length >= 2) {
      const parent = parts[0]?.trim() || "";
      const section = parts.slice(1).join("||").trim();
      return { section, parent };
    }
    return { section: raw.trim(), parent: "" };
  }

  async function addOperation() {
    const tipo =
      document.getElementById("selectTipoOp")?.value || "custom-formula";
    const claseInput = document.getElementById("inputClase");
    const idInput = document.getElementById("inputOperacionId");
    const clase = claseInput?.value?.trim() || "";
    const operacionIdInput = idInput?.value?.trim() || "";

    claseInput?.classList.remove("is-invalid");
    idInput?.classList.remove("is-invalid");
    if (!clase && !operacionIdInput) {
      claseInput?.classList.add("is-invalid");
      idInput?.classList.add("is-invalid");
      showToast(
        "Etiqueta o ID son obligatorios para crear la operación.",
        "error",
      );
      return;
    }

    const resolvedClase = clase || operacionIdInput;
    const operacionId = normalizeOperationId(operacionIdInput || resolvedClase);
    if (!operacionId) {
      idInput?.classList.add("is-invalid");
      showToast("Define un ID válido para la operación.", "error");
      return;
    }

    const checkedSections = Array.from(
      document.querySelectorAll("#checkboxSecciones input:checked"),
    ).map((cb) => cb.value);

    const rowLabels = collectAddOperationRowLabels(resolvedClase);

    // Permitir operaciones sin sección para agregarlas en orden libre.

    const parsedSelections = (checkedSections || [])
      .map((value) => parseSectionSelection(value))
      .filter((item) => item.section);
    const targetSelections =
      parsedSelections.length > 0
        ? parsedSelections
        : [{ section: "", parent: "" }];
    if (targetSelections.length > 1) {
      showToast(
        "Modo estricto: crea una operación por sección/subsección para definir IDs únicos.",
        "warning",
      );
      return;
    }

    const opsCreated = [];
    for (const selection of targetSelections) {
      const sectionName = (selection.section || "").toString().trim();
      const parentFromSelection = (selection.parent || "").toString().trim();
      const isSubsectionSelection = Boolean(parentFromSelection);

      // Manual: si el usuario selecciona una sección PRINCIPAL, la operación queda ligada
      // a esa sección (parentSection = sectionName). Solo si selecciona una subsección
      // usamos parentSection + parentSubsection.
      const parentSection =
        (isSubsectionSelection ? parentFromSelection : sectionName) || null;
      const parentSubsection = isSubsectionSelection
        ? sectionName || null
        : null;
      const placement = parentSection
        ? (parentSubsection || parentSection).toString().trim()
        : "";
      let op = null;
      if (sectionName) {
        op = findOperationBySectionName(sectionName, parentSection || "", {
          scope: isSubsectionSelection ? "subsection" : "section",
        });
      }

      if (
        !op &&
        (state.operaciones || []).some(
          (other) =>
            normalizeOperationMatch(getOperationId(other)) ===
            normalizeOperationMatch(operacionId),
        )
      ) {
        idInput?.classList.add("is-invalid");
        showToast("Ese ID ya existe. Define uno único manualmente.", "error");
        return;
      }

      const isNew = !op;
      if (isNew) {
        op = {
          CAPITULO: state.capitulo || "DEFAULT",
          HOJA: state.modulo || "",
          OperacionId: operacionId,
          Clase: resolvedClase,
          SECCION: placement,
          seccion: placement,
          tipo: tipo || "custom-formula",
          signos: {},
          orden: nextOperationOrder(),
          secciones: placement ? [placement] : [],
          parentSubsection,
          parentSection,
        };
      } else {
        op.SECCION = placement;
        op.seccion = placement;
        op.secciones = placement ? [placement] : [];
        if (!op.HOJA) {
          op.HOJA = state.modulo || "";
        }
        if (!op.CAPITULO) {
          op.CAPITULO = state.capitulo || "DEFAULT";
        }
        op.parentSection = parentSection;
        op.parentSubsection = parentSubsection;
      }

      // Aplicar etiquetas de aparición
      Object.entries(rowLabels).forEach(([field, label]) => {
        if (!label) return;
        op[field] = label;
      });

      // Modo estricto: nunca autogenerar fórmula.
      const explicitTerms = Array.isArray(formulaTerms)
        ? normalizeFormulaTerms(formulaTerms)
        : [];
      const explicitTokens = convertLegacyTermsToV2Tokens(explicitTerms, op);
      applyStrictFormulaTermsToOperation(op, explicitTerms, explicitTokens);

      if (isNew) {
        state.operaciones.push(op);
        opsCreated.push(op);
      }
    }

    if (opsCreated.length) {
      logChange(
        "add",
        `Operación "${resolvedClase}" (${opsCreated.length} secciones)`,
      );
    } else {
      logChange("edit", `Operación "${resolvedClase}" actualizada`);
    }

    state.operaciones = sortOperations(state.operaciones);
    ensureOperationIds();
    dedupeTemplateStructure({ silent: true });
    // normalizeOperationReferences(); // DESACTIVADO: modo 100% manual
    renderLayout();
    showToast(`Operación "${resolvedClase}" guardada`, "success");
  }

  // Helper to find parent section of a subsection
  function getParentSection(subsectionName) {
    if (!subsectionName) return null;
    const account = state.cuentas.find(
      (c) =>
        (c["SECCION Secundaria"] || c.seccion_secundaria) === subsectionName,
    );
    return account
      ? account["SECCIÓN Principal"] || account.seccion_principal
      : null;
  }

  function buildSectionIndexes() {
    const primaryIndex = new Map();
    const subsectionIndex = new Map();

    // En modo manual NO usamos groupBySections() aquí porque promueve
    // secundaria -> principal ("sección por cada cuenta") en layouts viejos.
    // Solo indexamos subsecciones válidas (con principal).
    (state.cuentas || []).forEach((cuenta) => {
      if (!cuenta) return;
      const primary = (getAccountPrincipalName(cuenta) || "").toString().trim();
      if (!primary) return;
      const primaryKey = normalizeKey(primary);
      if (primaryKey && !primaryIndex.has(primaryKey)) {
        primaryIndex.set(primaryKey, primary);
      }

      const subName = (getAccountSecondaryName(cuenta) || "").toString().trim();
      if (!subName) return;
      const subKey = normalizeKey(subName);
      if (!subKey) return;
      if (!subsectionIndex.has(subKey)) {
        subsectionIndex.set(subKey, new Set());
      }
      subsectionIndex.get(subKey).add(primary);
    });

    return { primaryIndex, subsectionIndex };
  }

  function resolvePrincipalNameByKeywords(primaryNames = [], keywords = []) {
    if (!primaryNames.length || !keywords.length) return "";
    const normalizedKeywords = keywords.map((k) => normalizeOperationKey(k));
    return (
      primaryNames.find((name) => {
        const normalized = normalizeOperationKey(name);
        return normalizedKeywords.some((key) => normalized.includes(key));
      }) || ""
    );
  }

  function inferParentSectionFromLabel(op, primaryNames = []) {
    const label = (getOperationLabel(op) || "").toLowerCase();
    if (!label) return "";
    if (
      label.includes("income") ||
      label.includes("ingreso") ||
      label.includes("ingres")
    ) {
      return resolvePrincipalNameByKeywords(primaryNames, [
        "income",
        "ingreso",
        "ingresos",
      ]);
    }
    if (
      label.includes("expense") ||
      label.includes("gasto") ||
      label.includes("gastos") ||
      label.includes("costo") ||
      label.includes("costos")
    ) {
      return resolvePrincipalNameByKeywords(primaryNames, [
        "expense",
        "gasto",
        "gastos",
        "costo",
        "costos",
      ]);
    }
    const labelKey = normalizeOperationKey(label);
    return (
      primaryNames.find((name) =>
        labelKey.includes(normalizeOperationKey(name)),
      ) || ""
    );
  }

  function hydrateOperationPlacement() {
    const indexes = buildSectionIndexes();
    const subsectionIndex = indexes.subsectionIndex || new Map();

    state.operaciones = (state.operaciones || []).map((op) => {
      if (!op) return op;
      const seccionValue = (op.SECCION || op.seccion || "").toString().trim();
      let parentSection = (op.parentSection || "").toString().trim();
      let parentSubsection = (op.parentSubsection || "").toString().trim();

      const inferParentFromSubsection = (subName) => {
        const subKey = normalizeKey(subName || "");
        const parents = subKey ? subsectionIndex.get(subKey) : null;
        if (parents && parents.size === 1) {
          return Array.from(parents)[0];
        }
        return "";
      };

      // 1) Si hay subsección pero no sección, inferir SOLO si es inequívoco.
      if (!parentSection && parentSubsection) {
        const inferred = inferParentFromSubsection(parentSubsection);
        if (inferred) {
          parentSection = inferred;
        } else {
          // Ambigua: tratar la operación como "libre" hasta que el usuario la asigne.
          parentSubsection = "";
        }
      }

      // 2) Si no hay parent*, usar SECCION como fallback de ubicación:
      // - Si coincide con una principal existente -> operación a nivel sección.
      // - Si coincide con una subsección con padre único -> operación en esa subsección.
      if (!parentSection && !parentSubsection && seccionValue) {
        const seccionKey = normalizeKey(seccionValue);
        if (seccionKey && indexes.primaryIndex?.has?.(seccionKey)) {
          parentSection = indexes.primaryIndex.get(seccionKey);
        } else {
          const inferred = inferParentFromSubsection(seccionValue);
          if (inferred) {
            parentSection = inferred;
            parentSubsection = seccionValue;
          }
        }
      }

      op.parentSection = parentSection || null;
      op.parentSubsection = parentSubsection || null;

      return op;
    });
  }

  function buildOperationDedupeKey(op) {
    if (!op) return "";
    // Modo estricto: cada operación es única por su ID.
    // No deduplicar por "display name" porque puede coincidir entre filas distintas
    // (p.ej. varias filas con la misma etiqueta de tabla pero fórmulas diferentes).
    const explicitId = normalizeOperationKey(
      op?.OperacionId || op?.operacion_id || op?.id || "",
    );
    if (explicitId) return explicitId;
    const fallbackId = normalizeOperationKey(getOperationId(op));
    return fallbackId || "";
  }

  function isExplicitEmptyFormulaRaw(rawValue) {
    const raw = (rawValue == null ? "" : String(rawValue)).trim();
    if (!raw) return true;
    if (raw === "[]") return true;
    const parsed = parseFormulaJsonSafe(raw);
    if (Array.isArray(parsed)) return parsed.length === 0;
    if (isFormulaV2Object(parsed)) {
      return !Array.isArray(parsed.tokens) || parsed.tokens.length === 0;
    }
    return false;
  }

  function getFormulaMergeScore(op) {
    if (!op) {
      return { score: 0, tokenCount: 0, emptyRaw: true };
    }
    const tokens = extractFormulaTokens(op);
    const tokenCount = Array.isArray(tokens)
      ? tokens.filter(
        (token) =>
          token &&
          typeof token === "object" &&
          (token.kind === FORMULA_KIND_REF ||
            token.kind === FORMULA_KIND_CONST),
      ).length
      : 0;
    const raw = (op.formula_json == null ? "" : String(op.formula_json)).trim();
    const emptyRaw = isExplicitEmptyFormulaRaw(raw);
    if (tokenCount > 0) {
      return { score: 3, tokenCount, emptyRaw: false };
    }
    if (raw && !emptyRaw) {
      return { score: 2, tokenCount: 0, emptyRaw: false };
    }
    if (raw) {
      return { score: 1, tokenCount: 0, emptyRaw: true };
    }
    return { score: 0, tokenCount: 0, emptyRaw: true };
  }

  function mergeOperationInto(base, extra) {
    if (!base || !extra) return base;
    const rowFields = [...ROW_LABEL_FIELDS, "net-row-adicional"];
    rowFields.forEach((field) => {
      if (!base[field] && extra[field]) {
        base[field] = extra[field];
      }
    });
    if (!base.SECCION && extra.SECCION) base.SECCION = extra.SECCION;
    if (!base.parentSection && extra.parentSection) {
      base.parentSection = extra.parentSection;
    }
    if (!base.parentSubsection && extra.parentSubsection) {
      base.parentSubsection = extra.parentSubsection;
    }
    const baseFormula = getFormulaMergeScore(base);
    const extraFormula = getFormulaMergeScore(extra);

    // FIXED: Prioritize existing formula (base) unless it's empty/invalid.
    // However, if the extra (incoming op) has a formula, we should consider merging it if base is default/complex?
    // Actually, simply relying on score causes user formulas (score 2) to be ignored if base has score 3.
    // We should allow extra to overwrite base if extra has ANY formula content that isn't empty, 
    // OR if base is empty.
    // But we don't want to overwrite a valid base with an empty extra.
    const extraHasContent = extraFormula.score > 0 || (extraFormula.tokenCount > 0);
    const baseHasContent = baseFormula.score > 0 || (baseFormula.tokenCount > 0);

    // If extra has meaningful content, we assume it's the latest version (e.g. user edit or subsequent definition)
    // and let it overwrite base. This fixes the issue where a complex default formula (score 3) 
    // prevents a simpler user formula (score 2) from being applied during deduplication.
    const extraHasBetterFormula = extraHasContent;

    if (extraHasBetterFormula) {
      base.formula_terms = Array.isArray(extra.formula_terms)
        ? extra.formula_terms.map((term) =>
          term && typeof term === "object" ? { ...term } : term,
        )
        : [];
      base.formula_json =
        extra.formula_json == null ? "" : String(extra.formula_json);
      if (extra.formula_v2 && typeof extra.formula_v2 === "object") {
        base.formula_v2 = {
          ...extra.formula_v2,
          tokens: Array.isArray(extra.formula_v2.tokens)
            ? extra.formula_v2.tokens.map((token) =>
              token && typeof token === "object" ? { ...token } : token,
            )
            : [],
        };
      } else {
        delete base.formula_v2;
      }
      if (extra.signos && typeof extra.signos === "object") {
        base.signos = {
          ...(base.signos || {}),
          ...extra.signos,
        };
      }
    } else {
      if (
        (!Array.isArray(base.formula_terms) ||
          base.formula_terms.length === 0) &&
        Array.isArray(extra.formula_terms) &&
        extra.formula_terms.length
      ) {
        base.formula_terms = extra.formula_terms.map((term) =>
          term && typeof term === "object" ? { ...term } : term,
        );
      }
      if (
        (base.formula_json == null || baseFormula.emptyRaw) &&
        extra.formula_json != null &&
        !extraFormula.emptyRaw
      ) {
        base.formula_json = String(extra.formula_json);
      }
      if (extra.signos && typeof extra.signos === "object") {
        base.signos = base.signos || {};
        Object.keys(extra.signos).forEach((key) => {
          if (base.signos[key] === undefined) {
            base.signos[key] = extra.signos[key];
          }
        });
      }
    }
    const baseOrder = Number(base.orden_presentacion);
    const extraOrder = Number(extra.orden_presentacion);
    if (!Number.isFinite(baseOrder) && Number.isFinite(extraOrder)) {
      base.orden_presentacion = extraOrder;
    } else if (Number.isFinite(baseOrder) && Number.isFinite(extraOrder)) {
      base.orden_presentacion = Math.min(baseOrder, extraOrder);
    }
    if (base.visible === false && extra.visible !== false) {
      base.visible = true;
    }
    return base;
  }

  function dedupeOperations({ silent = false } = {}) {
    const unique = new Map();
    let removed = 0;

    (state.operaciones || []).forEach((op) => {
      const key = buildOperationDedupeKey(op);
      const fallbackKey = normalizeOperationKey(
        getOperationId(op) || getOperationLabel(op),
      );
      const finalKey = key || fallbackKey;
      if (!finalKey) {
        unique.set(Symbol("op"), op);
        return;
      }
      const existing = unique.get(finalKey);
      if (!existing) {
        unique.set(finalKey, op);
        return;
      }
      mergeOperationInto(existing, op);
      removed += 1;
    });

    if (removed > 0) {
      state.operaciones = Array.from(unique.values());
      if (!silent) {
        state.unsavedChanges = true;
        updateButtonStates();
        showToast(
          `Se detectaron ${removed} duplicados de operaciones. Guarda para aplicar.`,
          "warning",
        );
      }
    }

    return { removed };
  }

  function dedupeTemplateStructure({ silent = false } = {}) {
    const cuentasOrdenadas = sortAccountsByOrder(state.cuentas || []);
    const seenAccountCodes = new Set();
    const seenPrincipalPlaceholders = new Set();
    const seenSecondaryPlaceholders = new Set();
    const cuentasUnicas = [];
    let removedAccounts = 0;
    let removedPlaceholders = 0;

    cuentasOrdenadas.forEach((cuenta) => {
      if (!cuenta) return;
      const principal = (getAccountPrincipalName(cuenta) || "")
        .toString()
        .trim();
      const secundaria = (getAccountSecondaryName(cuenta) || "")
        .toString()
        .trim();

      if (isPlaceholderAccount(cuenta)) {
        if (secundaria) {
          const key = `${normalizeOperationMatch(principal)}||${normalizeOperationMatch(secundaria)}`;
          if (!key || seenSecondaryPlaceholders.has(key)) {
            removedPlaceholders += 1;
            return;
          }
          seenSecondaryPlaceholders.add(key);
        } else {
          const key = normalizeOperationMatch(principal);
          if (!key || seenPrincipalPlaceholders.has(key)) {
            removedPlaceholders += 1;
            return;
          }
          seenPrincipalPlaceholders.add(key);
        }
        cuentasUnicas.push(cuenta);
        return;
      }

      const cuentaCodigo = (cuenta.CUENTA || cuenta.cuenta || "")
        .toString()
        .trim();
      const accountKey = normalizeOperationMatch(cuentaCodigo);
      if (accountKey) {
        if (seenAccountCodes.has(accountKey)) {
          removedAccounts += 1;
          return;
        }
        seenAccountCodes.add(accountKey);
      }

      if (principal) {
        seenPrincipalPlaceholders.add(normalizeOperationMatch(principal));
      }
      if (principal && secundaria) {
        seenSecondaryPlaceholders.add(
          `${normalizeOperationMatch(principal)}||${normalizeOperationMatch(secundaria)}`,
        );
      }
      cuentasUnicas.push(cuenta);
    });

    state.cuentas = cuentasUnicas;
    const dedupeOps = dedupeOperations({ silent: true });
    const removedOps = Number(dedupeOps?.removed || 0);
    const totalRemoved = removedAccounts + removedPlaceholders + removedOps;

    if (totalRemoved > 0) {
      state.unsavedChanges = true;
      if (!silent) {
        updateButtonStates();
        showToast(
          `Se limpiaron duplicados: ${removedAccounts} cuentas, ${removedPlaceholders} secciones/subsecciones, ${removedOps} operaciones.`,
          "warning",
        );
      }
    }

    return {
      removedAccounts,
      removedPlaceholders,
      removedOps,
      totalRemoved,
    };
  }

  function resolveOperationParentSection(op, primaryIndex) {
    if (!op) return "";
    const candidates = [
      op.parentSection,
      op["sum-row"],
      op["sum-row-sumavarios"],
      op["sum-row-operativo"],
      op["result-row"],
      op["net-row"],
      op["result-net-row"],
    ].filter(Boolean);

    for (const candidate of candidates) {
      const key = normalizeKey(candidate);
      const match = primaryIndex.get(key);
      if (match) return match;
    }
    return "";
  }

  function inferParentSectionForTerm(op, termValue, indexes) {
    if (!termValue) return "";
    const termKey = normalizeKey(termValue);
    if (!termKey) return "";
    const primaryIndex = indexes?.primaryIndex || new Map();
    const subsectionIndex = indexes?.subsectionIndex || new Map();

    if (primaryIndex.has(termKey)) return "";

    const opParent = resolveOperationParentSection(op, primaryIndex);
    if (opParent) return opParent;

    const parents = subsectionIndex.get(termKey);
    if (!parents || parents.size === 0) return "";
    if (parents.size === 1) return Array.from(parents)[0];

    const claseLower = (getOperationLabel(op) || "").toLowerCase();
    if (claseLower.includes("income")) {
      const match = Array.from(parents).find((p) =>
        p.toLowerCase().includes("income"),
      );
      if (match) return match;
    }
    if (claseLower.includes("expense") || claseLower.includes("gasto")) {
      const match = Array.from(parents).find((p) => {
        const lower = p.toLowerCase();
        return lower.includes("expense") || lower.includes("gasto");
      });
      if (match) return match;
    }
    if (claseLower.includes("other") && claseLower.includes("income")) {
      const match = Array.from(parents).find((p) =>
        p.toLowerCase().includes("other income"),
      );
      if (match) return match;
    }

    return "";
  }

  function applyParentSectionHints(op, terms) {
    if (!op || !Array.isArray(terms) || terms.length === 0) {
      return terms || [];
    }
    const indexes = buildSectionIndexes();
    if (!indexes.primaryIndex.size && !indexes.subsectionIndex.size) {
      return terms;
    }
    return terms.map((term) => {
      if (!term || term.type !== "section" || term.parentSection) {
        return term;
      }
      const parentSection = inferParentSectionForTerm(op, term.value, indexes);
      if (!parentSection) return term;
      return { ...term, parentSection };
    });
  }

  // ==========================================
  // MODAL: COPY
  // ==========================================
  function resolveCopyScope() {
    return dom.copiaAlcance?.value === "all" ? "all" : "current";
  }

  function updateCopyModalLabels() {
    if (!dom.copiaOrigen) return;
    const scope = resolveCopyScope();
    dom.copiaOrigen.textContent =
      scope === "all"
        ? `Todos los módulos · ${state.anio}`
        : `${state.modulo} ${state.anio}`;
  }

  function openCopyModal() {
    if (!state.editMode) {
      showToast("Activa el modo edición primero", "warning");
      return;
    }

    if (dom.copiaAlcance) dom.copiaAlcance.value = "current";
    updateCopyModalLabels();
    dom.anioDestino.value = "";

    new bootstrap.Modal(dom.modalCopiar).show();
  }

  async function confirmCopy() {
    const anioDestino = dom.anioDestino.value?.trim();
    const anioOrigen = parseInt(state.anio, 10);

    if (!anioDestino || isNaN(anioDestino)) {
      showToast("Ingresa un año válido", "warning");
      return;
    }

    if (!Number.isInteger(anioOrigen)) {
      showToast("Año origen inválido", "warning");
      return;
    }

    const destinoNumero = parseInt(anioDestino, 10);
    if (anioOrigen === destinoNumero) {
      showToast("El año destino debe ser diferente al origen", "warning");
      return;
    }

    try {
      const scope = resolveCopyScope();
      const requestUrl =
        scope === "all"
          ? `${API_BASE}/copiar`
          : `${API_BASE}/${encodeURIComponent(state.modulo)}/copiar`;

      const response = await fetch(requestUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          empresaId: obtenerEmpresaIdApi(),
          anioOrigen,
          anioDestino: destinoNumero,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.mensaje || "No se pudo copiar el layout");
      }
      const data = await response.json().catch(() => ({}));

      bootstrap.Modal.getInstance(dom.modalCopiar)?.hide();
      if (scope === "all") {
        const copiados = Array.isArray(data.copiados) ? data.copiados.length : 0;
        const omitidosSinOrigen = Array.isArray(data.omitidosSinOrigen)
          ? data.omitidosSinOrigen.length
          : 0;
        const omitidosSinPermiso = Array.isArray(data.omitidosSinPermiso)
          ? data.omitidosSinPermiso.length
          : 0;
        const errores = Array.isArray(data.errores) ? data.errores.length : 0;

        let msg = `Layouts copiados a ${destinoNumero} (${copiados} módulos)`;
        const extras = [];
        if (omitidosSinOrigen) extras.push(`${omitidosSinOrigen} sin layout en origen`);
        if (omitidosSinPermiso) extras.push(`${omitidosSinPermiso} sin permiso`);
        if (errores) extras.push(`${errores} con error`);
        if (extras.length) msg += ` · ${extras.join(" · ")}`;

        showToast(msg, errores ? "warning" : "success");
      } else {
        showToast(`Layout copiado a ${destinoNumero}`, "success");
      }

      // Registrar en bitácora
      await addToBitacora(
        "COPIAR",
        scope === "all"
          ? `Se copiaron layouts de ${anioOrigen} a ${destinoNumero} para todos los módulos`
          : `Se copió el layout de ${anioOrigen} a ${destinoNumero} (${state.modulo})`,
      );

      await loadYears();
    } catch (error) {
      console.error("Error copying layout:", error);
      showToast(error.message, "error");
    }
  }

  // ==========================================
  // SAVE
  // ==========================================

  /**
   * Registrar un cambio en el log
   */
  function logChange(type, description, data = {}) {
    state.changeLog.push({
      type, // 'add', 'edit', 'delete', 'move', 'rename'
      description,
      timestamp: new Date().toISOString(),
      data,
    });
    state.unsavedChanges = true;
    updateButtonStates();
    scheduleAutoSave("logChange");
  }

  const AUTO_SAVE_DELAY = 1200;
  let autoSaveTimer = null;
  let autoSaveInProgress = false;
  let autoSaveQueued = false;
  let lastAutoSaveErrorAt = 0;

  function scheduleAutoSave(reason = "") {
    if (!state.autoSave || !state.editMode) return;
    if (!state.unsavedChanges) return;
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    setStatus("Cambios pendientes. Guardado automatico...");
    autoSaveTimer = setTimeout(() => {
      autoSaveTimer = null;
      runAutoSave(reason);
    }, AUTO_SAVE_DELAY);
  }

  async function runAutoSave(reason = "") {
    if (autoSaveInProgress) {
      autoSaveQueued = true;
      return;
    }
    autoSaveInProgress = true;
    try {
      const ok = await saveLayout({
        skipConfirmation: true,
        silent: true,
        source: reason,
      });
      if (!ok) {
        const now = Date.now();
        // Evitar spam si falla repetidamente.
        if (now - lastAutoSaveErrorAt > 15000) {
          lastAutoSaveErrorAt = now;
          showToast(
            "No se pudo guardar automáticamente. Revisa tu conexión e intenta Guardar.",
            "error",
          );
        }
        setStatus("Error en guardado automático");
      }
    } finally {
      autoSaveInProgress = false;
      if (autoSaveQueued) {
        autoSaveQueued = false;
        scheduleAutoSave("queued");
      }
    }
  }

  window.scheduleAutoSave = scheduleAutoSave;

  /**
   * Generar resumen de cambios
   */
  function generateChangesSummary() {
    const summary = {
      added: [],
      edited: [],
      deleted: [],
      moved: [],
      renamed: [],
      total: 0,
    };

    state.changeLog.forEach((change) => {
      switch (change.type) {
        case "add":
          summary.added.push(change.description);
          break;
        case "edit":
          summary.edited.push(change.description);
          break;
        case "delete":
          summary.deleted.push(change.description);
          break;
        case "move":
          summary.moved.push(change.description);
          break;
        case "rename":
          summary.renamed.push(change.description);
          break;
      }
      summary.total++;
    });

    // Generar resumen textual
    const parts = [];
    if (summary.added.length) parts.push(`${summary.added.length} agregados`);
    if (summary.edited.length) parts.push(`${summary.edited.length} editados`);
    if (summary.deleted.length)
      parts.push(`${summary.deleted.length} eliminados`);
    if (summary.moved.length) parts.push(`${summary.moved.length} movidos`);
    if (summary.renamed.length)
      parts.push(`${summary.renamed.length} renombrados`);

    summary.summary = parts.join(", ");
    return summary;
  }

  /**
   * Mostrar modal de confirmación con resumen de cambios
   */
  async function showSaveConfirmation(summary) {
    return new Promise((resolve) => {
      const modal = document.createElement("div");
      modal.className = "modal fade";
      modal.innerHTML = `
        <div class="modal-dialog modal-dialog-centered modal-lg">
          <div class="modal-content">
            <div class="modal-header bg-primary text-white">
              <h5 class="modal-title">
                <i class="bi bi-save me-2"></i>Confirmar Guardado
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="alert alert-info mb-3">
                <i class="bi bi-info-circle me-2"></i>
                <strong>Total de cambios:</strong> ${summary.total}
              </div>

              ${summary.added.length
          ? `
                <div class="mb-3">
                  <label class="form-label">Identificador unico</label>
                  <input type="text" class="form-control" id="inputOperacionId" placeholder="Ej: CDMX_INCOME" />
                  <div class="form-text">Define un ID único manualmente.</div>
                </div>
                <div class="mb-3">
                  <h6 class="text-success"><i class="bi bi-plus-circle me-2"></i>Agregados (${summary.added.length
          })</h6>
                  <ul class="list-unstyled ms-3">
                    ${summary.added
            .slice(0, 5)
            .map(
              (item) =>
                `<li class="text-muted small">✓ ${escapeHtml(
                  item,
                )}</li>`,
            )
            .join("")}
                    ${summary.added.length > 5
            ? `<li class="text-muted small fst-italic">...y ${summary.added.length - 5
            } más</li>`
            : ""
          }
                  </ul>
                </div>
              `
          : ""
        }

              ${summary.edited.length
          ? `
                <div class="mb-3">
                  <h6 class="text-primary"><i class="bi bi-pencil me-2"></i>Editados (${summary.edited.length
          })</h6>
                  <ul class="list-unstyled ms-3">
                    ${summary.edited
            .slice(0, 5)
            .map(
              (item) =>
                `<li class="text-muted small">✓ ${escapeHtml(
                  item,
                )}</li>`,
            )
            .join("")}
                    ${summary.edited.length > 5
            ? `<li class="text-muted small fst-italic">...y ${summary.edited.length - 5
            } más</li>`
            : ""
          }
                  </ul>
                </div>
              `
          : ""
        }

              ${summary.deleted.length
          ? `
                <div class="mb-3">
                  <h6 class="text-danger"><i class="bi bi-trash me-2"></i>Eliminados (${summary.deleted.length
          })</h6>
                  <ul class="list-unstyled ms-3">
                    ${summary.deleted
            .slice(0, 5)
            .map(
              (item) =>
                `<li class="text-muted small">✓ ${escapeHtml(
                  item,
                )}</li>`,
            )
            .join("")}
                    ${summary.deleted.length > 5
            ? `<li class="text-muted small fst-italic">...y ${summary.deleted.length - 5
            } más</li>`
            : ""
          }
                  </ul>
                </div>
              `
          : ""
        }

              ${summary.renamed.length
          ? `
                <div class="mb-3">
                  <h6 class="text-warning"><i class="bi bi-arrow-left-right me-2"></i>Renombrados (${summary.renamed.length
          })</h6>
                  <ul class="list-unstyled ms-3">
                    ${summary.renamed
            .slice(0, 5)
            .map(
              (item) =>
                `<li class="text-muted small">✓ ${escapeHtml(
                  item,
                )}</li>`,
            )
            .join("")}
                    ${summary.renamed.length > 5
            ? `<li class="text-muted small fst-italic">...y ${summary.renamed.length - 5
            } más</li>`
            : ""
          }
                  </ul>
                </div>
              `
          : ""
        }

              ${summary.moved.length
          ? `
                <div class="mb-3">
                  <h6 class="text-info"><i class="bi bi-arrows-move me-2"></i>Movidos (${summary.moved.length
          })</h6>
                  <ul class="list-unstyled ms-3">
                    ${summary.moved
            .slice(0, 5)
            .map(
              (item) =>
                `<li class="text-muted small">✓ ${escapeHtml(
                  item,
                )}</li>`,
            )
            .join("")}
                    ${summary.moved.length > 5
            ? `<li class="text-muted small fst-italic">...y ${summary.moved.length - 5
            } más</li>`
            : ""
          }
                  </ul>
                </div>
              `
          : ""
        }
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                <i class="bi bi-x-circle me-1"></i>Cancelar
              </button>
              <button type="button" class="btn btn-primary" id="btnConfirmSave">
                <i class="bi bi-check-circle me-1"></i>Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
      const bsModal = new bootstrap.Modal(modal);
      bsModal.show();

      // Manejar confirmación
      document
        .getElementById("btnConfirmSave")
        .addEventListener("click", () => {
          bsModal.hide();
          resolve(true);
        });

      // Manejar cancelación
      modal.addEventListener("hidden.bs.modal", () => {
        document.body.removeChild(modal);
        resolve(false);
      });
    });
  }
  async function saveLayout(options = {}) {
    const {
      skipConfirmation = false,
      silent = false,
      source = "manual",
    } = options;
    if (!state.editMode) {
      showToast("Activa el modo edición primero", "warning");
      return false;
    }

    // Validar contexto
    if (!state.modulo || !state.anio || !state.capitulo) {
      if (!silent) {
        showToast(
          "⚠️ Falta información: módulo, año o capítulo no definido",
          "error",
        );
      }
      console.error("Contexto incompleto:", {
        modulo: state.modulo,
        anio: state.anio,
        capitulo: state.capitulo,
      });
      return false;
    }

    // Antes de guardar, sincronizar SIEMPRE el orden real de la vista previa con orden_presentacion.
    // Evita casos donde el usuario reordena visualmente pero el orden persistido no se actualiza.
    try {
      const previewRows = getTemplateRowsForReorder();
      if (previewRows.length) {
        applyTemplateRowsOrder(previewRows, { silent: true });
      }
    } catch (orderSyncError) {
      console.warn(
        "[saveLayout] No se pudo sincronizar orden visual",
        orderSyncError,
      );
    }

    // Generar resumen de cambios
    const changesSummary = generateChangesSummary();
    const hasDirtyChanges = state.unsavedChanges === true;

    if (changesSummary.total === 0 && !hasDirtyChanges) {
      if (!silent) {
        showToast("ℹ️ No hay cambios para guardar", "info");
      }
      return true;
    }

    if (changesSummary.total === 0 && hasDirtyChanges) {
      changesSummary.total = 1;
      changesSummary.summary = "Cambios pendientes";
    }

    // Mostrar modal de confirmación con resumen
    if (!skipConfirmation) {
      const confirmed = await showSaveConfirmation(changesSummary);
      if (!confirmed) {
        return false;
      }
    }

    setStatus(silent ? "Guardando automatico..." : "Guardando...");

    try {
      // Sanear estructura antes de persistir: evita secciones/operaciones duplicadas.
      dedupeTemplateStructure({ silent: true });

      // Save accounts
      const accResponse = await fetch(
        `${API_BASE}/${encodeURIComponent(state.modulo)}/${state.anio
        }/${encodeURIComponent(state.capitulo)}/cuentas`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            empresaId: obtenerEmpresaIdApi(),
            cuentas: state.cuentas,
          }),
        },
      );

      if (!accResponse.ok) {
        const errorData = await accResponse.json().catch(() => ({}));
        throw new Error(
          errorData.mensaje || `Error ${accResponse.status} al guardar cuentas`,
        );
      }

      // Save operations
      // MODO 100% MANUAL: desactivar funciones automáticas
      // hydrateOperationsFromParents(); // No inferir ubicaciones
      // hydrateOperationPlacement(); // No inferir placement
      ensureOperationIds(); // Solo asegurar IDs si faltan
      // normalizeOperationReferences(); // DESACTIVADO: modo 100% manual
      const operacionesOrdenadas = sortOperations(state.operaciones);
      state.operaciones = operacionesOrdenadas;
      const operacionesParaGuardar =
        buildOperacionesParaGuardar(operacionesOrdenadas);
      const opResponse = await fetch(
        `${API_BASE}/${encodeURIComponent(state.modulo)}/${state.anio
        }/operaciones`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            empresaId: obtenerEmpresaIdApi(),
            capitulo: state.capitulo,
            operaciones: operacionesParaGuardar,
          }),
        },
      );

      if (!opResponse.ok) {
        const errorData = await opResponse.json().catch(() => ({}));
        throw new Error(
          errorData.mensaje ||
          `Error ${opResponse.status} al guardar operaciones`,
        );
      }

      state.unsavedChanges = false;
      state.changeLog = []; // Limpiar log de cambios
      state.columnasConfigChanged = false;
      state.layoutConfigChanged = false;
      updateButtonStates();
      setStatus(silent ? "Guardado automatico" : "Guardado correctamente");
      if (!silent) {
        showToast("✅ Layout guardado exitosamente", "success");
      }

      // Registrar en bitácora
      await addToBitacora(
        "GUARDAR",
        `Se guardaron ${changesSummary.total} cambios en ${state.modulo} ${state.anio}: ${changesSummary.summary}`,
      );
      return true;
    } catch (error) {
      console.error("Error saving layout:", error);
      setStatus("Error al guardar");
      if (!silent) {
        showToast(error.message, "error");
      }
      return false;
    }
  }

  // ==========================================
  // VERSION HISTORY (UNDO/RESTORE)
  // ==========================================
  function formatVersionTimestamp(value) {
    if (!value) return "";
    const raw = value.toString();
    const date = new Date(raw);
    if (Number.isFinite(date.getTime())) {
      return date.toLocaleString();
    }
    return raw;
  }

  async function fetchLayoutVersions({ limit = 30 } = {}) {
    const base = `${API_BASE}/${encodeURIComponent(state.modulo)}/${state.anio}/${encodeURIComponent(
      state.capitulo,
    )}/versions`;
    const url = agregarEmpresaIdQuery(
      `${base}?limit=${encodeURIComponent(limit)}`,
    );
    const response = await fetch(url, { headers: getAuthHeaders() });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.mensaje || "No se pudo cargar el historial");
    }
    const data = await response.json();
    return Array.isArray(data.versions) ? data.versions : [];
  }

  async function restoreLayoutVersion(versionId, { motivo = "" } = {}) {
    if (!versionId) return false;
    const url = `${API_BASE}/${encodeURIComponent(state.modulo)}/${state.anio}/${encodeURIComponent(
      state.capitulo,
    )}/versions/${encodeURIComponent(versionId)}/restore`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        empresaId: obtenerEmpresaIdApi(),
        motivo: motivo || `Restaurar versión ${versionId}`,
      }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.mensaje || "No se pudo restaurar la versión");
    }
    return true;
  }

  async function openVersionHistoryModal() {
    if (!state.editMode) {
      showToast("Activa el modo edición para restaurar versiones", "warning");
      return;
    }
    if (!state.modulo || !state.anio || !state.capitulo) {
      showToast("Falta contexto (módulo/año/capítulo)", "warning");
      return;
    }

    setStatus("Cargando historial...");
    let versions = [];
    try {
      versions = await fetchLayoutVersions({ limit: 50 });
    } catch (err) {
      setStatus("Listo");
      showToast(err.message, "error");
      return;
    }
    setStatus("Listo");

    const rowsHtml = versions.length
      ? versions
        .map((v) => {
          const created = formatVersionTimestamp(v.created_at);
          const user = (
            v.nombre_usuario ||
            v.usuario ||
            v.usuario_id ||
            ""
          ).toString();
          const source = (v.source || "").toString();
          const motivo = (v.motivo || "").toString();
          return `
              <tr>
                <td class="text-muted">${escapeHtml(String(v.id))}</td>
                <td>${escapeHtml(created)}</td>
                <td>${escapeHtml(user)}</td>
                <td>${escapeHtml(source)}</td>
                <td>${escapeHtml(motivo)}</td>
                <td class="text-end">
                  <button type="button" class="btn btn-sm btn-outline-primary" data-action="restore" data-version-id="${escapeAttr(
            String(v.id),
          )}">
                    Restaurar
                  </button>
                </td>
              </tr>
            `;
        })
        .join("")
      : `<tr><td colspan="6" class="text-muted text-center">Sin versiones</td></tr>`;

    const modal = document.createElement("div");
    modal.className = "modal fade";
    modal.id = "modalHistorialVersiones";
    modal.tabIndex = -1;
    modal.innerHTML = `
      <div class="modal-dialog modal-xl modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              Historial de versiones · ${escapeHtml(state.modulo)} ${escapeHtml(
      String(state.anio),
    )} · ${escapeHtml(state.capitulo)}
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="alert alert-info py-2">
              <strong>Tip:</strong> Cada guardado crea un snapshot. Al restaurar se hace un backup automático.
            </div>
            <div class="table-responsive">
              <table class="table table-sm table-hover align-middle">
                <thead class="table-light">
                  <tr>
                    <th>ID</th>
                    <th>Fecha</th>
                    <th>Usuario</th>
                    <th>Source</th>
                    <th>Motivo</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                </tbody>
              </table>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();

    const handleClick = async (event) => {
      const btn = event.target.closest("button[data-action]");
      if (!btn) return;
      const action = btn.dataset.action;
      if (action !== "restore") return;
      const versionId = btn.dataset.versionId;
      if (!versionId) return;

      const ok = confirm(
        `¿Restaurar la versión ${versionId}?\\n\\nEsto reemplaza cuentas + operaciones del capítulo "${state.capitulo}".`,
      );
      if (!ok) return;

      btn.disabled = true;
      btn.textContent = "Restaurando...";
      try {
        await restoreLayoutVersion(versionId, {
          motivo: `Restaurar versión ${versionId}`,
        });
        showToast("✅ Versión restaurada. Recargando...", "success");
        bsModal.hide();
        await loadLayout();
      } catch (err) {
        console.error(err);
        showToast(err.message, "error");
        btn.disabled = false;
        btn.textContent = "Restaurar";
      }
    };

    modal.addEventListener("click", handleClick);
    modal.addEventListener("hidden.bs.modal", () => {
      modal.removeEventListener("click", handleClick);
      document.body.removeChild(modal);
    });
  }

  // ==========================================
  // DEMO
  // ==========================================
  async function createDemo() {
    if (!state.editMode) {
      showToast("Activa el modo edición primero", "warning");
      return;
    }

    showToast("Demo deshabilitado en esta vista", "warning");
  }

  // Crear layout RESUMEN 2025 con estructura completa
  async function createResumen2025Layout() {
    if (AUTO_OPERACIONES_DISABLED) {
      showToast("Creación automática deshabilitada", "warning");
      return;
    }
    try {
      // Cargar estructura desde JSON
      const estructuraUrl =
        window.location.protocol === "file:"
          ? "http://localhost:3005/ESTRUCTURA_OPERACIONES_RESUMEN_2025.json"
          : `${window.location.origin}/ESTRUCTURA_OPERACIONES_RESUMEN_2025.json`;

      showToast("Cargando estructura predefinida...", "info");

      const response = await fetch(estructuraUrl);
      if (!response.ok) {
        throw new Error("No se pudo cargar la estructura predefinida");
      }

      const estructura = await response.json();
      const operaciones = estructura.operaciones_orden_aparicion;

      // Convertir operaciones al formato del sistema
      state.operaciones = operaciones.map((op, index) => {
        const newOp = {
          OperacionId: op.id,
          Clase: op.nombre,
          orden: op.orden || index + 1,
          orden_presentacion: op.orden || index + 1,
          CAPITULO: state.capitulo || "CIUDAD DE MÉXICO",
          visible: op.visible !== false,
        };

        // Asignar tipo de fila
        switch (op.tipo) {
          case "sum-row":
            newOp["sum-row"] = op.nombre;
            break;
          case "sum-row-sumavarios":
            newOp["sum-row-sumavarios"] = op.nombre;
            break;
          case "sum-row-sumavarios-consolidado":
            newOp["sum-row-sumavarios-consolidado"] = op.nombre;
            break;
          case "sum-row-operativo":
            newOp["sum-row-operativo"] = op.nombre;
            break;
          case "result-row":
            newOp["result-row"] = op.nombre;
            break;
          case "net-row":
            newOp["net-row"] = op.nombre;
            break;
          case "result-net-row":
            newOp["result-net-row"] = op.nombre;
            break;
          default:
            newOp[op.tipo] = op.nombre;
        }

        // Asignar formula_terms
        const buildSigns = (terms = []) => {
          newOp.signos = {};
          terms.forEach((term, idx) => {
            const key = `seccion_${idx + 1}`;
            newOp[key] = term.value;
            newOp.signos[key] = term.operator === "-" ? -1 : 1;
          });
        };

        if (op.formula_terms && op.formula_terms.length > 0) {
          newOp.formula_terms = op.formula_terms.map((term, idx) => ({
            id: Date.now() + idx,
            operator: term.operator || "+",
            type: term.type || "section",
            value: term.value,
          }));
          buildSigns(newOp.formula_terms);
        } else if (op.cuentas && op.cuentas.length > 0) {
          newOp.formula_terms = op.cuentas.map((cuenta, idx) => ({
            id: Date.now() + idx,
            operator: "+",
            type: "account",
            value: cuenta,
          }));
          buildSigns(newOp.formula_terms);
          newOp.SECCION = op.cuentas.join(" + ");
        } else if (op.formula) {
          const parsed = [];
          const cleaned = op.formula.replace(/[()]/g, " ");
          let currentOp = "+";
          cleaned
            .split(/(?=[+-])/)
            .map((s) => s.trim())
            .filter(Boolean)
            .forEach((chunk, idx2) => {
              let operator = currentOp;
              if (chunk.startsWith("+") || chunk.startsWith("-")) {
                operator = chunk[0];
                chunk = chunk.slice(1).trim();
              }
              if (!chunk) return;
              parsed.push({
                id: Date.now() + idx2,
                operator: operator || "+",
                type: "operation",
                value: chunk,
              });
              currentOp = operator;
            });
          if (parsed.length) {
            newOp.formula_terms = parsed;
            buildSigns(parsed);
          }
        }

        return newOp;
      });

      // Guardar el layout
      const layoutData = {
        modulo: state.modulo,
        anio: state.anio,
        capitulo: state.capitulo,
        operaciones: state.operaciones,
        cuentas: state.cuentas || [],
      };

      const saveResponse = await fetch(
        `${API_BASE}/${encodeURIComponent(state.modulo)}/${state.anio}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify(layoutData),
        },
      );

      if (!saveResponse.ok) {
        throw new Error("No se pudo guardar el layout");
      }

      showToast(
        `Layout RESUMEN 2025 creado con ${operaciones.length} operaciones`,
        "success",
      );

      // Registrar en bitácora
      await addToBitacora(
        "CREAR",
        `Se generó layout RESUMEN 2025 con estructura completa de ${operaciones.length} operaciones`,
      );

      // Recargar layout
      await loadLayout();
    } catch (error) {
      console.error("Error creando RESUMEN 2025:", error);
      showToast(`Error: ${error.message}`, "error");

      // Fallback: crear manualmente
      const usarManual = confirm(
        "No se pudo cargar la estructura automáticamente. ¿Deseas crear manualmente las operaciones básicas?",
      );
      if (usarManual) {
        await createResumen2025Manual();
      }
    }
  }

  // Crear operaciones básicas manualmente si falla la carga automática
  async function createResumen2025Manual() {
    if (AUTO_OPERACIONES_DISABLED) {
      showToast("Creación automática deshabilitada", "warning");
      return;
    }
    showToast("Creando operaciones básicas...", "info");

    // Operaciones mínimas esenciales
    const operacionesBasicas = [
      {
        OperacionId: "CDMX_INCOME",
        Clase: "CDMX INCOME",
        "sum-row-sumavarios": "CDMX INCOME",
        orden: 1,
      },
      {
        OperacionId: "CONSOLIDATED_INCOME",
        Clase: "CONSOLIDATED INCOME",
        "sum-row-sumavarios-consolidado": "CONSOLIDATED INCOME",
        formula_terms: [
          { value: "CDMX_INCOME", operator: "+", type: "operation" },
        ],
        orden: 2,
      },
      {
        OperacionId: "CDMX_EXPENSE",
        Clase: "CDMX EXPENSE",
        "sum-row-sumavarios": "CDMX EXPENSE",
        orden: 3,
      },
      {
        OperacionId: "CONSOLIDATED_EXPENSE",
        Clase: "CONSOLIDATED EXPENSE",
        "sum-row-sumavarios-consolidado": "CONSOLIDATED EXPENSE",
        formula_terms: [
          { value: "CDMX_EXPENSE", operator: "+", type: "operation" },
        ],
        orden: 4,
      },
      {
        OperacionId: "CONSOLIDATED_OPERATING_RESULTS",
        Clase: "CONSOLIDATED OPERATING RESULTS",
        "sum-row-operativo": "CONSOLIDATED OPERATING RESULTS",
        formula_terms: [
          { value: "CONSOLIDATED_INCOME", operator: "+", type: "operation" },
          { value: "CONSOLIDATED_EXPENSE", operator: "-", type: "operation" },
        ],
        orden: 5,
      },
      {
        OperacionId: "CONSOLIDATED_NET_RESULTS",
        Clase: "CONSOLIDATED NET RESULTS",
        "result-net-row": "CONSOLIDATED NET RESULTS",
        formula_terms: [
          {
            value: "CONSOLIDATED_OPERATING_RESULTS",
            operator: "+",
            type: "operation",
          },
        ],
        orden: 6,
      },
    ];

    state.operaciones = operacionesBasicas;

    showToast(
      "6 operaciones básicas creadas. Edita para agregar más.",
      "success",
    );
    renderLayout();
  }

  // ==========================================
  // UTILITIES
  // ==========================================
  function setStatus(message) {
    if (dom.statusMessage) {
      dom.statusMessage.textContent = message;
    }
  }

  function showToast(message, type = "info") {
    dom.toastMessage.textContent = message;

    const icon = dom.toastNotification.querySelector(".toast-header i");
    icon.className = `bi bi-${type === "success"
      ? "check-circle text-success"
      : type === "error"
        ? "x-circle text-danger"
        : type === "warning"
          ? "exclamation-triangle text-warning"
          : "info-circle text-primary"
      } me-2`;

    const toast = new bootstrap.Toast(dom.toastNotification);
    toast.show();
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(str) {
    if (!str) return "";
    return String(str).replace(/'/g, "\\'").replace(/"/g, "&quot;");
  }

  // ==========================================
  // GLOBAL FUNCTIONS (for inline handlers)
  // ==========================================
  window.toggleSection = function (header) {
    header.classList.toggle("collapsed");
    const content = header.nextElementSibling;
    content.style.display = header.classList.contains("collapsed")
      ? "none"
      : "";
  };

  window.showOperationMap = function (operationId) {
    const op = findOperationByIdOrLabel(operationId);
    if (!op) {
      alert("Operación no encontrada");
      return;
    }

    // Asegurarse de que la operación tenga formula_terms poblados
    if (!op.formula_terms || op.formula_terms.length === 0) {
      // Intentar construir los términos ahora
      console.log("Operación sin términos, intentando construir:", op);

      // Intentar desde signos
      if (op.signos && Object.keys(op.signos).length > 0) {
        const terms = [];
        Object.keys(op.signos)
          .filter((k) => k.startsWith("seccion_"))
          .sort((a, b) => {
            const numA = parseInt(a.split("_")[1]) || 0;
            const numB = parseInt(b.split("_")[1]) || 0;
            return numA - numB;
          })
          .forEach((key, i) => {
            const value = op[key];
            if (value) {
              terms.push({
                id: Date.now() + i,
                operator: op.signos[key] < 0 ? "-" : "+",
                type: detectTermType(value),
                value: value,
              });
            }
          });

        if (terms.length > 0) {
          op.formula_terms = terms;
        }
      }

      // Si aún no hay términos, mostrar error
      if (!op.formula_terms || op.formula_terms.length === 0) {
        alert(
          "Esta operación no tiene términos definidos.\n\nDatos disponibles:\n" +
          "- signos: " +
          JSON.stringify(op.signos || {}) +
          "\n" +
          "- SECCION: " +
          (op.SECCION || "ninguno") +
          "\n\n" +
          "Usa el botón de editar para configurar la fórmula.",
        );
        return;
      }
    }

    console.log(
      "Mostrando mapa para:",
      getOperationLabel(op) || operationId,
      "términos:",
      op.formula_terms,
    );

    // Usar FormulaBuilder para mostrar el mapa
    if (
      window.FormulaBuilder &&
      typeof window.FormulaBuilder.showMap === "function"
    ) {
      // Temporalmente setear los términos en FormulaBuilder
      window.FormulaBuilder.terms = op.formula_terms || [];
      window.FormulaBuilder.currentOperationId = getOperationId(op);
      window.FormulaBuilder.showMap();
    } else {
      alert("Error: FormulaBuilder no está disponible");
    }
  };

  window.toggleSubsection = function (header) {
    header.classList.toggle("collapsed");
    const content = header.nextElementSibling;
    content.style.display = header.classList.contains("collapsed")
      ? "none"
      : "";
  };

  window.selectAccount = function (row, codigo) {
    document
      .querySelectorAll(".account-row.selected")
      .forEach((r) => r.classList.remove("selected"));
    row.classList.add("selected");
    const accountId =
      row?.dataset?.accountId ||
      row?.getAttribute?.("data-account-id") ||
      codigo;
    const account =
      resolveAccountByIdOrCode(accountId) || resolveAccountByIdOrCode(codigo);
    const codigoCuenta =
      account?.CUENTA || row?.dataset?.cuenta || codigo || accountId;
    state.selectedElement = {
      type: "account",
      accountId,
      codigo: codigoCuenta,
      cuenta: account || null,
    };
    updateSelectionInfo();
  };

  // Exponer funciones de movimiento para los botones onclick
  window.moveSectionOrder = moveSectionOrder;
  window.moveSubsectionOrder = moveSubsectionOrder;
  window.moveAccountOrder = moveAccountOrder;
  window.moveOperationOrder = moveOperationOrder;
  window.getTemplateRowsForReorder = getTemplateRowsForReorder;
  window.applyTemplateRowsOrder = applyTemplateRowsOrder;
  window.editRowOperation = editRowOperation;
  window.handleOperationRowClick = function (event, operationId) {
    if (event && isInteractiveRowActionTarget(event.target)) {
      return;
    }
    editOperation(operationId);
  };
  window.handleInlineOperationOrderClick = function (
    event,
    label,
    opId,
    kind,
    direction,
  ) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    moveOperationOrder(label, opId, kind, direction);
  };

  window.editSection = function (name) {
    if (!requireEditMode()) return;
    // Priorizar panel lateral derecho (offcanvas) para edición.
    if (typeof _editSectionInternalOld === "function") {
      _editSectionInternalOld(name);
      return;
    }
    if (typeof window._editSectionOriginal === "function") {
      window._editSectionOriginal(name);
      return;
    }
    showToast("Editor de secciones no disponible", "warning");
  };

  window._editSectionOriginal = function (name) {
    dom.formEditar.innerHTML = `
      <div class="mb-3">
        <label class="form-label">Nombre de la Sección</label>
        <input type="text" class="form-control" id="editNombreSeccion" value="${escapeHtml(
      name,
    )}" />
      </div>
      <div class="alert alert-warning small">
        <i class="bi bi-exclamation-triangle me-1"></i>
        Cambiar el nombre de la sección afectará a todas las cuentas dentro de ella.
      </div>
    `;

    state.selectedElement = { type: "section", name };
    updateSelectionInfo();
    new bootstrap.Modal(dom.modalEditar).show();
  };

  window.deleteSection = function (name) {
    if (!requireEditMode()) return;
    state.selectedElement = { type: "section", name };
    deleteElement();
  };

  window.editSubsection = function (principal, name) {
    if (!requireEditMode()) return;
    // Priorizar panel lateral derecho (offcanvas) para edición.
    if (typeof _editSubsectionInternalOld === "function") {
      _editSubsectionInternalOld(principal, name);
      return;
    }
    if (typeof window._editSubsectionOriginal === "function") {
      window._editSubsectionOriginal(principal, name);
      return;
    }
    showToast("Editor de subsecciones no disponible", "warning");
  };

  window._editSubsectionOriginal = function (principal, name) {
    dom.formEditar.innerHTML = `
      <div class="mb-3">
        <label class="form-label">Sección Principal</label>
        <input type="text" class="form-control" value="${escapeHtml(
      principal,
    )}" readonly disabled />
      </div>
      <div class="mb-3">
        <label class="form-label">Nombre de la Subsección</label>
        <input type="text" class="form-control" id="editNombreSubseccion" value="${escapeHtml(
      name,
    )}" />
      </div>
      <div class="alert alert-warning small">
        <i class="bi bi-exclamation-triangle me-1"></i>
        Cambiar el nombre de la subsección afectará a todas las cuentas dentro de ella.
      </div>
    `;

    state.selectedElement = { type: "subsection", principal, name };
    updateSelectionInfo();
    new bootstrap.Modal(dom.modalEditar).show();
  };

  window.deleteSubsection = function (principal, name) {
    if (!requireEditMode()) return;
    state.selectedElement = { type: "subsection", principal, name };
    deleteElement();
  };

  window.toggleSubseccionVisibility = function (principal, name) {
    if (!requireEditMode()) return;
    if (!state.layoutConfig) state.layoutConfig = {};
    if (!Array.isArray(state.layoutConfig.subseccionesOcultas)) {
      state.layoutConfig.subseccionesOcultas = [];
    }
    const subKey = (principal || "").trim().toLowerCase() + "|" + (name || "").trim().toLowerCase();
    const idx = state.layoutConfig.subseccionesOcultas.findIndex(
      (k) => (k || "").trim().toLowerCase() === subKey,
    );
    if (idx >= 0) {
      // Actualmente oculta → mostrar en Resumen
      state.layoutConfig.subseccionesOcultas.splice(idx, 1);
    } else {
      // Actualmente visible → ocultar en Resumen
      state.layoutConfig.subseccionesOcultas.push(principal + "|" + name);
    }
    state.layoutConfigChanged = true;
    state.unsavedChanges = true;
    updateButtonStates();
    renderLayout();
  };

  window.addToSection = function (principal) {
    if (!requireEditMode()) return;
    document.querySelector(
      'input[name="tipoElemento"][value="cuenta"]',
    ).checked = true;
    updateAddForm();
    setTimeout(() => {
      const select = document.getElementById("selectPrincipal");
      if (select) select.value = principal;
    }, 100);
    new bootstrap.Modal(dom.modalAgregar).show();
  };

  window.addAccount = function (principal, secundaria) {
    if (!requireEditMode()) return;
    setBulkMode(true);
    if (dom.bulkInsertTbody) {
      ensureBulkRows();
      const row = dom.bulkInsertTbody.lastElementChild;
      if (row) {
        const tipoSelect = row.querySelector('select[data-field="tipo"]');
        if (tipoSelect) {
          tipoSelect.value = "cuenta";
        }
        updateBulkRowFields(row);
        const seccionField = row.querySelector('[data-field="seccion"]');
        const subseccionField = row.querySelector('[data-field="subseccion"]');
        if (seccionField) seccionField.value = principal || "";
        if (subseccionField) subseccionField.value = secundaria || "";
        refreshBulkSubsectionOptions(row);
      }
    }
    new bootstrap.Modal(dom.modalAgregar).show();
  };

  window.editAccount = function (codigo) {
    if (!requireEditMode()) return;
    const cuenta = resolveAccountByIdOrCode(codigo);
    if (!cuenta) return;
    const accountId = getAccountRowId(cuenta);
    const codigoCuenta = cuenta.CUENTA || cuenta.cuenta || codigo;

    const seccionPrincipal = getAccountPrincipalName(cuenta) || "";
    const seccionSecundaria = getAccountSecondaryName(cuenta) || "";
    const factorRaw =
      cuenta.operacion_factor ?? cuenta.operacionFactor ?? cuenta.factor;
    const factorValue = Number.isFinite(Number(factorRaw))
      ? Number(factorRaw)
      : 1;

    // Obtener secciones/subsecciones desde el ORDEN REAL del template (modo manual)
    const normalizeKey = (value) => normalizeOperationMatch(value || "");
    const principalNames = getManualSectionNames();
    if (
      seccionPrincipal &&
      !principalNames.some(
        (name) => normalizeKey(name) === normalizeKey(seccionPrincipal),
      )
    ) {
      principalNames.unshift(seccionPrincipal);
    }
    const principalOptions = principalNames
      .filter(Boolean)
      .map((name) => {
        const selected =
          normalizeKey(name) === normalizeKey(seccionPrincipal)
            ? "selected"
            : "";
        return `<option value="${escapeAttr(name)}" ${selected}>${escapeHtml(name)}</option>`;
      })
      .join("");

    const subsectionNames = getManualSubsectionNames(seccionPrincipal);
    if (
      seccionSecundaria &&
      !subsectionNames.some(
        (name) => normalizeKey(name) === normalizeKey(seccionSecundaria),
      )
    ) {
      subsectionNames.unshift(seccionSecundaria);
    }
    const subsectionOptions = subsectionNames
      .filter(Boolean)
      .map((name) => {
        const selected =
          normalizeKey(name) === normalizeKey(seccionSecundaria)
            ? "selected"
            : "";
        return `<option value="${escapeAttr(name)}" ${selected}>${escapeHtml(name)}</option>`;
      })
      .join("");

    dom.formEditar.innerHTML = `
      <div class="mb-3">
        <label class="form-label">Código</label>
        <input type="text" class="form-control" id="editCodigo" value="${escapeHtml(
      codigoCuenta,
    )}" />
      </div>
      <div class="mb-3">
        <label class="form-label">Nombre</label>
        <input type="text" class="form-control" id="editNombre" value="${escapeHtml(
      cuenta.NOMBRE || "",
    )}" />
      </div>
      <div class="mb-3">
        <label class="form-label">Sección Principal</label>
        <select class="form-select" id="editSeccionPrincipal" onchange="window.updateEditSubsectionOptions()">
          <option value="">Sin sección</option>
          ${principalOptions}
        </select>
      </div>
      <div class="mb-3">
        <label class="form-label">Sección Secundaria (Subsección)</label>
        <select class="form-select" id="editSeccionSecundaria">
          <option value="">Sin subsección</option>
          ${subsectionOptions}
        </select>
      </div>
      <div class="mb-3">
        <label class="form-label">Signo/Factor</label>
        <input type="text" class="form-control" id="editFactor" placeholder="1 suma, -1 resta" value="${escapeHtml(
      factorValue === 1 ? "" : String(factorValue),
    )}" />
        <div class="form-text">Aplica a todas las columnas (real, presupuesto y comparativo).</div>
      </div>
      <div class="mb-3">
        <label class="form-label">Valor plantilla</label>
        <input type="number" step="any" class="form-control" id="editValorPlantilla" value="${escapeHtml(
      Number.isFinite(Number(cuenta.valor_plantilla))
        ? String(Number(cuenta.valor_plantilla))
        : "0",
    )}" />
        <div class="form-text">Solo aplica al gestor/preview del layout.</div>
      </div>
      <div class="mb-3">
        <div class="form-check">
          <input class="form-check-input" type="checkbox" id="editVisible" ${cuenta.visible !== false ? "checked" : ""} />
          <label class="form-check-label" for="editVisible">Visible</label>
        </div>
      </div>
    `;

    state.selectedElement = {
      type: "account",
      cuenta,
      accountId,
      codigo: codigoCuenta,
    };
    updateSelectionInfo();
    new bootstrap.Modal(dom.modalEditar).show();
  };

  // Función auxiliar para actualizar opciones de subsección al cambiar la sección principal
  window.updateEditSubsectionOptions = function () {
    const principalSelect = document.getElementById("editSeccionPrincipal");
    const secondarySelect = document.getElementById("editSeccionSecundaria");
    if (!principalSelect || !secondarySelect) return;

    const selectedPrincipal = principalSelect.value;
    const subs = getManualSubsectionNames(selectedPrincipal);
    let options = '<option value="">Sin subsección</option>';
    subs.forEach((name) => {
      options += `<option value="${escapeAttr(name)}">${escapeHtml(name)}</option>`;
    });
    secondarySelect.innerHTML = options;
  };

  // Operaciones: actualizar opciones de subsección al cambiar la sección principal (panel lateral)
  window.updateOperationPlacementSubsections = function () {
    const principalSelect =
      dom.operationEditorPanel?.querySelector?.("#editOpParentSection") ||
      document.getElementById("editOpParentSection");
    const secondarySelect =
      dom.operationEditorPanel?.querySelector?.("#editOpParentSubsection") ||
      document.getElementById("editOpParentSubsection");
    if (!principalSelect || !secondarySelect) return;

    const selectedPrincipal = (principalSelect.value || "").toString().trim();
    const currentSub = (secondarySelect.value || "").toString().trim();

    const normalizeKey = (value) =>
      (value || "")
        .toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();

    if (!selectedPrincipal) {
      secondarySelect.innerHTML = '<option value="">Sin subsección</option>';
      secondarySelect.disabled = true;
      return;
    }

    const subsections = Array.from(
      new Set(
        (state.cuentas || [])
          .filter(
            (c) =>
              normalizeKey(getAccountPrincipalName(c) || "") ===
              normalizeKey(selectedPrincipal),
          )
          .map((c) => (getAccountSecondaryName(c) || "").toString().trim())
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));

    let options = '<option value="">Sin subsección</option>';
    subsections.forEach((name) => {
      options += `<option value="${escapeAttr(name)}">${escapeHtml(name)}</option>`;
    });
    secondarySelect.disabled = false;
    secondarySelect.innerHTML = options;

    if (
      currentSub &&
      subsections.some(
        (name) => normalizeKey(name) === normalizeKey(currentSub),
      )
    ) {
      secondarySelect.value = currentSub;
    }
  };

  window.deleteAccount = function (codigo) {
    if (!requireEditMode()) return;
    const cuenta = resolveAccountByIdOrCode(codigo);
    const codigoCuenta = cuenta?.CUENTA || cuenta?.cuenta || codigo;
    if (!confirm(`¿Eliminar la cuenta ${codigoCuenta}?`)) return;

    const nombre = cuenta?.NOMBRE || cuenta?.nombre || "";
    const accountId = cuenta ? getAccountRowId(cuenta) : "";

    if (accountId) {
      state.cuentas = state.cuentas.filter(
        (c) => getAccountRowId(c) !== accountId,
      );
    } else {
      state.cuentas = state.cuentas.filter((c) => c.CUENTA !== codigo);
    }
    state.unsavedChanges = true;
    updateButtonStates();
    logChange(
      "delete",
      `Cuenta ${codigoCuenta}${nombre ? " - " + nombre : ""}`,
      {
        codigo: codigoCuenta,
        nombre,
        accountId,
      },
    );
    renderLayout();
    updateStats();
    scheduleAutoSave("delete");
    showToast(`Cuenta ${codigoCuenta} eliminada`, "success");
  };

  // Helper function to get HTML list of accounts in a section
  function getSectionAccountsHTML(sectionName) {
    if (!sectionName)
      return '<span class="text-muted">Sin sección definida</span>';

    if (!state.cuentas || state.cuentas.length === 0) {
      return '<span class="text-muted">No hay cuentas cargadas en este layout</span>';
    }

    const sectionLower = sectionName.toLowerCase().trim();

    // Find accounts that belong to this section (check secondary section first, then primary)
    let matchingAccounts = state.cuentas.filter((c) => {
      const secondary = (
        c.seccion_secundaria ||
        c["SECCION Secundaria"] ||
        c["SECCIàN Secundaria"] ||
        ""
      )
        .toLowerCase()
        .trim();
      const primary = (
        c["SECCIÓN Principal"] ||
        c["SECCIàN Principal"] ||
        c["SECCION Principal"] ||
        c.SECCION ||
        c.seccion_principal ||
        ""
      )
        .toLowerCase()
        .trim();

      return secondary === sectionLower || primary === sectionLower;
    });
    matchingAccounts = matchingAccounts.filter(
      (account) => !isPlaceholderAccount(account),
    );

    // If no exact match, try partial match
    if (matchingAccounts.length === 0) {
      matchingAccounts = state.cuentas.filter((c) => {
        const secondary = (
          c.seccion_secundaria ||
          c["SECCION Secundaria"] ||
          c["SECCIàN Secundaria"] ||
          ""
        )
          .toLowerCase()
          .trim();
        const primary = (
          c["SECCIÓN Principal"] ||
          c["SECCIàN Principal"] ||
          c["SECCION Principal"] ||
          c.SECCION ||
          c.seccion_principal ||
          ""
        )
          .toLowerCase()
          .trim();

        return (
          secondary.includes(sectionLower) ||
          primary.includes(sectionLower) ||
          sectionLower.includes(secondary) ||
          sectionLower.includes(primary)
        );
      });
      matchingAccounts = matchingAccounts.filter(
        (account) => !isPlaceholderAccount(account),
      );
    }

    if (matchingAccounts.length === 0) {
      return `<span class="text-muted">No se encontraron cuentas en la sección "${escapeHtml(
        sectionName,
      )}" (${state.cuentas.length} cuentas en total)</span>`;
    }

    return matchingAccounts
      .map(
        (c) => `
      <div class="d-flex align-items-center mb-1">
        <i class="bi bi-journal-text text-primary me-2"></i>
        <code class="me-2">${escapeHtml(c.CUENTA)}</code>
        <span class="text-muted small">${escapeHtml(
          c.NOMBRE || c.nombre || "",
        )}</span>
      </div>
    `,
      )
      .join("");
  }

  // Renderizar vista previa de en qué tablas aparecerá la operación
  function renderOperationTablePreview(op) {
    const tables = [];

    // Detectar todas las tablas donde aparecerá esta operación
    const rowFields = [
      {
        field: "sum-row",
        label: "Fila de Suma",
        color: "primary",
        icon: "bi-bar-chart",
      },
      {
        field: "sum-row-sumavarios",
        label: "Totales de Sección",
        color: "primary",
        icon: "bi-bar-chart-fill",
      },
      {
        field: "sum-row-sumavarios2",
        label: "Totales de Seccion 2",
        color: "primary",
        icon: "bi-bar-chart-fill",
      },
      {
        field: "sum-row-sumavarios-consolidado",
        label: "Consolidados",
        color: "success",
        icon: "bi-collection-fill",
      },
      {
        field: "sum-row-operativo",
        label: "Resultados Operativos",
        color: "info",
        icon: "bi-graph-up-arrow",
      },
      {
        field: "result-row",
        label: "Resultados",
        color: "warning",
        icon: "bi-calculator-fill",
      },
      {
        field: "net-row",
        label: "Resultados Netos",
        color: "danger",
        icon: "bi-cash-stack",
      },
      {
        field: "result-net-row",
        label: "Resultado Neto Consolidado",
        color: "danger",
        icon: "bi-bank",
      },
    ];

    rowFields.forEach(({ field, label, color, icon }) => {
      if (op[field]) {
        tables.push({
          field,
          label,
          color,
          icon,
          value: op[field],
        });
      }
    });

    if (tables.length === 0) {
      return `<div class="alert alert-warning mb-0">
        <i class="bi bi-exclamation-triangle me-2"></i>
        Esta operación no tiene filas de resultado definidas. Agrega al menos una etiqueta de fila.
      </div>`;
    }

    return `
      <div class="operation-preview-tables">
        <div class="alert alert-info mb-2">
          <i class="bi bi-info-circle me-2"></i>
          Esta operación aparecerá en <strong>${tables.length
      }</strong> tabla(s):
        </div>
        ${tables
        .map(
          (table) => `
          <div class="table-preview-item bg-${table.color
            } bg-opacity-10 border-${table.color
            } border-start border-3 p-2 rounded mb-2">
            <div class="d-flex align-items-center gap-2">
              <i class="bi ${table.icon} text-${table.color} fs-5"></i>
              <div class="flex-grow-1">
                <div class="fw-semibold text-${table.color}">${table.label
            }</div>
                <div class="small text-muted">Como: <code class="text-dark">${escapeHtml(
              table.value,
            )}</code></div>
              </div>
              <span class="badge bg-${table.color}">Visible</span>
            </div>
          </div>
        `,
        )
        .join("")}
      </div>
    `;
  }

  const coreEditOperation = async function (operationId) {
    state.lastEditInvocation = Date.now();
    if (!requireEditMode()) return;
    let op = findOperationByIdOrLabel(operationId);
    if (!op) {
      const match = findOperationsByRowLabel(operationId);
      if (match.operations.length === 1) {
        op = match.operations[0];
      } else if (match.operations.length > 1) {
        editConsolidatedLabel(
          operationId,
          match.field || "sum-row",
          "",
          match.operations,
        );
        return;
      } else {
        showToast("Operacion no encontrada", "warning");
        return;
      }
    }

    let opId = getOperationId(op);
    let opLabel = getOperationLabel(op);

    // AUTO-LOAD (opcional): Buscar operación predefinida y pre-cargar si existe.
    // En modo manual (AUTO_OPERACIONES_DISABLED), no se aplica automáticamente.
    if (!AUTO_OPERACIONES_DISABLED) {
      await ensureOperacionesPredefinidas();
      const operacionesContexto = getOperacionesPredefinidasContexto();
      const opPredefinida = findPredefForOperation(op, operacionesContexto);

      if (opPredefinida) {
        const knownOperations = new Set();
        operacionesContexto.forEach((item) => {
          if (item?.nombre)
            knownOperations.add(normalizeOperacionKey(item.nombre));
          if (item?.id) knownOperations.add(normalizeOperacionKey(item.id));
          if (item?.identificador)
            knownOperations.add(normalizeOperacionKey(item.identificador));
        });
        applyPredefinedToExisting(
          op,
          opPredefinida,
          op.orden,
          knownOperations,
          {
            force: true,
          },
        );
      }
    }

    opId = getOperationId(op);
    opLabel = getOperationLabel(op);

    const modalTitle = dom.modalEditar?.querySelector(".modal-title");
    if (modalTitle) {
      modalTitle.textContent = `Editar: ${getOperationDisplayName(op)} (${opId})`;
    }

    // Get available elements to determine correct types
    const availableElements = getAvailableElements();
    const operationKeys = new Set();
    availableElements.operations.forEach((opItem) => {
      if (!opItem) return;
      if (typeof opItem === "string") {
        operationKeys.add(normalizeOperationMatch(opItem));
        return;
      }
      if (opItem.id) operationKeys.add(normalizeOperationMatch(opItem.id));
      if (opItem.label)
        operationKeys.add(normalizeOperationMatch(opItem.label));
    });
    const sectionNames = availableElements.sections.map((s) =>
      normalizeOperationMatch(s),
    );
    const extractedFromFields = extractFormulaTerms(op);

    // Helper to detect if a value is an operation or section
    // Priority: exact match in sections > exact match in operations > fuzzy section > default to section
    function detectValueType(value) {
      if (!value) return "section";
      const lower = normalizeOperationMatch(value);

      // First check EXACT match in sections (most common case)
      if (sectionNames.includes(lower)) {
        return "section";
      }

      // Then check EXACT match in operations (Clase names)
      if (operationKeys.has(lower)) {
        return "operation";
      }

      // Check case-insensitive partial match in sections
      const sectionMatch = sectionNames.find(
        (s) => s.includes(lower) || lower.includes(s),
      );
      if (sectionMatch) {
        return "section";
      }

      // Default to section since that's the most common formula term type
      return "section";
    }

    // Poblar formulaTerms desde el objeto op
    formulaTerms = [];

    // Check for explicitly defined formula_terms first
    if (op.formula_terms && op.formula_terms.length > 0) {
      formulaTerms = op.formula_terms.map((term, i) => ({
        id: Date.now() + i,
        ...term,
        // Ensure type is correctly set based on value
        type: term.type || detectValueType(term.value),
      }));
    }
    // Then check for signos/seccion_n format (only regular formula sections, not row labels)
    else if (op.signos && Object.keys(op.signos).length > 0) {
      let i = 0;
      // Only process seccion_n fields, not row-type fields like sum-row, sum-row-sumavarios, etc.
      const rowTypeFields = [
        "sum-row",
        "sum-row-sumavarios",
        "sum-row-sumavarios2",
        "sum-row-sumavarios-consolidado",
        "sum-row-operativo",
        "result-row",
        "net-row",
        "result-net-row",
      ];
      Object.entries(op.signos).forEach(([clave, signo]) => {
        // Skip if this is a row-type field, not a formula section reference
        if (rowTypeFields.includes(clave) || !clave.startsWith("seccion_")) {
          return;
        }
        const valorReal = op[clave];
        if (valorReal) {
          formulaTerms.push({
            id: Date.now() + i++,
            operator: signo < 0 ? "-" : "+",
            type: detectValueType(valorReal),
            value: valorReal,
          });
        }
      });
    }

    if (formulaTerms.length === 0 && extractedFromFields.length > 0) {
      formulaTerms = extractedFromFields.map((term, i) => ({
        id: Date.now() + i,
        operator: term.operator || "+",
        type: term.type || detectValueType(term.value),
        value: term.value || "",
      }));
    }

    formulaTerms = formulaTerms.map((term) => ({
      ...term,
      value:
        term.type === "operation" ? resolveOperationId(term.value) : term.value,
    }));
    formulaTerms = applyParentSectionHints(op, formulaTerms);

    const opLabelInput =
      getOperationLabel(op) || getOperationDisplayName(op) || "";
    const tipoSeleccionado = resolveOperationAparicionType(op);
    const tipoTooltip = getAparicionTooltip(tipoSeleccionado);
    const tipoOptions = buildAparicionOptions(tipoSeleccionado);
    const rowLabelsHtml = OP_ROW_FIELDS.map((row) => {
      const tooltipAttr = row.tooltip
        ? ` title="${escapeAttr(row.tooltip)}"`
        : "";
      return `
        <div class="col-md-6">
          <label class="form-label small text-muted"${tooltipAttr}>${row.label}</label>
          <input type="text" class="form-control" id="${rowLabelInputId(
        row.field,
      )}" value="${escapeHtml(op[row.field] || "")}" placeholder="${row.placeholder
        }"${tooltipAttr} />
        </div>
      `;
    }).join("");

    dom.formEditar.innerHTML = `
      <div class="mb-3">
        <label class="form-label">Identificador unico</label>
        <input type="text" class="form-control" id="editOperacionId" value="${escapeHtml(opId)}" />
        <div class="form-text">Usa un ID unico para referenciar en formulas.</div>
      </div>

      <div class="mb-3">
        <label class="form-label">Etiqueta de la Operación</label>
        <input type="text" class="form-control" id="editClaseOp" value="${escapeHtml(
      opLabelInput,
    )}" />
      </div>

      <div class="mb-3">
        <label class="form-label d-flex align-items-center gap-2">
          Tipo de fila
          <i class="bi bi-info-circle text-muted" data-aparicion-help="true" title="${escapeAttr(
      tipoTooltip,
    )}"></i>
        </label>
        <select class="form-select" id="editOperacionTipo" data-aparicion-select="true" data-initial-tipo="${escapeAttr(
      tipoSeleccionado,
    )}" title="${escapeAttr(tipoTooltip)}">
          ${tipoOptions}
        </select>
        <div class="form-text">
          Solo cambia la apariencia de la fila en la plantilla.
        </div>
      </div>

      <div class="mb-3">
        <label class="form-label">Etiquetas en tabla</label>
        <div class="row g-2">
          ${rowLabelsHtml}
        </div>
        <div class="form-text">
          Estas etiquetas son las que aparecen en las tablas. Deja en blanco si no aplica.
        </div>
      </div>

      <div class="mb-3">
        <label class="form-label fw-bold">Fórmula</label>
        <div class="formula-preview-box">
          ${escapeHtml(buildFormulaPreviewText(formulaTerms))}
        </div>
        <div class="form-text">Edita la fórmula en el panel lateral.</div>
      </div>
    `;
    initAparicionSelect(dom.formEditar);

    state.selectedElement = { type: "operation", op };
    updateSelectionInfo();

    // Modo estricto: NO modificar la fórmula al abrir el editor.
    // La fórmula solo se actualiza cuando el usuario guarda desde el panel.

    // SIEMPRE usar panel lateral - nunca modal
    const panelOpened = openOperationEditorPanel(op, availableElements);
    if (!panelOpened) {
      console.error("❌ No se pudo abrir el panel de edición");
      showToast("Error al abrir el editor de operación", "error");
    }
    return panelOpened;
  };

  window.editOperation = async function (operationId) {
    try {
      const result = await coreEditOperation(operationId);
      return result;
    } catch (error) {
      console.error("❌ Error en editOperation:", error);
      showToast("Error al editar la operación: " + error.message, "error");
      return null;
    }
  };

  // Helper para el toggle en edición
  window.toggleEditFormulaBuilder = function () {
    // Builder always shown in edit mode
    // Removed updateFormulaPreview() - not needed
  };

  window.deleteOperation = async function (operationId) {
    if (!requireEditMode()) return;
    const op = findOperationByIdOrLabel(operationId);
    if (!op) return;
    const label = getOperationLabel(op);
    const opId = getOperationId(op);
    const key =
      buildOperationDedupeKey(op) ||
      normalizeOperationKey(getOperationId(op) || label);
    const duplicados = (state.operaciones || []).filter(
      (o) =>
        (buildOperationDedupeKey(o) ||
          normalizeOperationKey(getOperationId(o) || getOperationLabel(o))) ===
        key,
    );
    const mensaje =
      duplicados.length > 1
        ? `Eliminar la operacion "${label}"? Se eliminaran ${duplicados.length} duplicados.`
        : `Eliminar la operacion "${label}"?`;
    if (!confirm(mensaje)) return;

    state.operaciones = state.operaciones.filter(
      (o) =>
        (buildOperationDedupeKey(o) ||
          normalizeOperationKey(getOperationId(o) || getOperationLabel(o))) !==
        key,
    );

    const identificadoresServidor = Array.from(
      new Map(
        duplicados
          .flatMap((item) => [getOperationId(item), getOperationLabel(item)])
          .map((value) => (value || "").toString().trim())
          .filter(Boolean)
          .map((value) => [normalizeOperationMatch(value), value]),
      ).values(),
    );
    if (!identificadoresServidor.length) {
      identificadoresServidor.push(opId || label || operationId);
    }

    logChange(
      "delete",
      `Operación "${label}" (${opId})${duplicados.length > 1 ? " x" + duplicados.length : ""}`,
      {
        clase: label,
        operacionId: opId,
        duplicados: duplicados.length,
      },
    );
    renderLayout();
    updateStats();
    showToast(`Operación "${label}" eliminada`, "success");

    try {
      if (state.modulo && state.anio) {
        const params = new URLSearchParams({
          empresaId: obtenerEmpresaIdApi(),
        });
        if (state.capitulo) params.set("capitulo", state.capitulo);
        let eliminacionRemotaOk = false;
        for (const identificador of identificadoresServidor) {
          const claseToDelete = encodeURIComponent(
            identificador || opId || label || operationId,
          );
          const url = `${API_BASE}/${encodeURIComponent(state.modulo)}/${state.anio}/operacion/${claseToDelete}?${params.toString()}`;
          const resp = await fetch(url, {
            method: "DELETE",
            headers: {
              ...getAuthHeaders(),
            },
          });
          if (!resp.ok) {
            const errorData = await resp.json().catch(() => ({}));
            console.warn("No se pudo eliminar en servidor:", {
              identificador,
              ...errorData,
            });
            continue;
          }
          eliminacionRemotaOk = true;
        }
        if (eliminacionRemotaOk) {
          await loadLayout();
        }
      }
    } catch (err) {
      console.warn("Error eliminando operación en servidor:", err);
    }
  };

  // Etiqueta "consolidada" (múltiples operaciones con el mismo label).
  // Modo estricto: cada fila es única, así que aquí NO se edita en bloque ni se
  // infiere fórmula. Se abre una operación individual.
  window.editConsolidatedLabel = function (
    label,
    field,
    parentSection = "",
    sourceOperations = [],
  ) {
    if (!requireEditMode()) return;
    const candidates =
      Array.isArray(sourceOperations) && sourceOperations.length
        ? sourceOperations.slice()
        : (findOperationsByRowLabel(label, field)?.operations || []);
    if (!candidates.length) {
      showToast("No se encontraron operaciones para esta etiqueta", "warning");
      return;
    }
    showToast(
      `"${label}" aparece en ${candidates.length} operaciones. Edita cada una por separado.`,
      "warning",
    );
    const first = sortOperations(candidates)[0] || candidates[0];
    const firstId = getOperationId(first) || label;
    window.editOperation?.(firstId);
  };

  // Delete a consolidated label (removes it from all operations)
  window.deleteConsolidatedLabel = function (label, field) {
    if (!requireEditMode()) return;
    const affectedOps = state.operaciones.filter((op) => op[field] === label);

    if (affectedOps.length === 0) {
      showToast("No se encontraron operaciones para esta etiqueta", "error");
      return;
    }

    const opsList = affectedOps
      .map((op) => op.Clase || op.SECCION)
      .slice(0, 5)
      .join(", ");
    const more =
      affectedOps.length > 5 ? ` y ${affectedOps.length - 5} más...` : "";

    if (
      !confirm(
        `¿Eliminar la etiqueta "${label}" de ${affectedOps.length} operaciones?\n\nOperaciones afectadas: ${opsList}${more}`,
      )
    )
      return;

    // Remove the field from all affected operations
    affectedOps.forEach((op) => {
      delete op[field];
    });

    state.unsavedChanges = true;
    updateButtonStates();
    renderLayout();
    updateStats();
    showToast(
      `Etiqueta "${label}" eliminada de ${affectedOps.length} operaciones`,
      "success",
    );
  };

  window.updateSubsectionOptions = function () {
    const principal = document.getElementById("selectPrincipal")?.value;
    const selectS = document.getElementById("selectSecundaria");
    if (!selectS) return;

    const subs = getManualSubsectionNames(principal);

    if (!subs.length) {
      selectS.innerHTML = '<option value="">Sin subsección</option>';
      return;
    }

    selectS.innerHTML =
      `<option value="">Sin subsección</option>` +
      subs
        .filter(Boolean)
        .map(
          (name) =>
            `<option value="${escapeAttr(name)}">${escapeHtml(name)}</option>`,
        )
        .join("");
  };

  function expandAll() {
    // Si estamos en vista de lista (piloto), manejar colapso manual
    const listView = dom.layoutPreview?.querySelector(".template-list-view");
    if (listView) {
      const items = Array.from(listView.querySelectorAll(".list-item"));
      let activeSection = null;
      items.forEach((item) => {
        if (item.classList.contains("section-principal")) {
          activeSection = item;
          item.classList.remove("is-collapsed");
          return;
        }
        if (activeSection) {
          item.classList.remove("collapsed-by-section");
        }
      });
      showToast("✅ Todas las secciones expandidas", "success");
      return;
    }

    const collapsibles = document.querySelectorAll(".collapse");
    collapsibles.forEach((element) => {
      const bsCollapse =
        bootstrap.Collapse.getInstance(element) ||
        new bootstrap.Collapse(element, { toggle: false });
      bsCollapse.show();
    });
    showToast("✅ Todas las secciones expandidas", "success");
  }

  function collapseAll() {
    // Si estamos en vista de lista (piloto), manejar colapso manual
    const listView = dom.layoutPreview?.querySelector(".template-list-view");
    if (listView) {
      const items = Array.from(listView.querySelectorAll(".list-item"));
      let activeSection = null;
      items.forEach((item) => {
        if (item.classList.contains("section-principal")) {
          activeSection = item;
          item.classList.add("is-collapsed");
          return;
        }
        if (activeSection) {
          item.classList.add("collapsed-by-section");
        }
      });
      showToast("✅ Todas las secciones colapsadas", "success");
      return;
    }

    const collapsibles = document.querySelectorAll(".collapse");
    collapsibles.forEach((element) => {
      const bsCollapse =
        bootstrap.Collapse.getInstance(element) ||
        new bootstrap.Collapse(element, { toggle: false });
      bsCollapse.hide();
    });
    showToast("✅ Todas las secciones colapsadas", "success");
  }

  function confirmEdit() {
    if (!state.selectedElement) return;
    const markInvalid = (input, message) => {
      if (!input) return;
      input.classList.add("is-invalid");
      const feedback = input.parentElement?.querySelector(".invalid-feedback");
      if (feedback && message) feedback.textContent = message;
    };
    const clearInvalid = (input) => {
      if (!input) return;
      input.classList.remove("is-invalid");
    };

    if (state.selectedElement.type === "account") {
      const cuenta =
        state.selectedElement.cuenta ||
        resolveAccountByIdOrCode(
          state.selectedElement.accountId || state.selectedElement.codigo,
        );
      if (!cuenta) return;
      state.selectedElement.cuenta = cuenta;
      const oldCodigo = cuenta.CUENTA;
      const oldNombre = cuenta.NOMBRE;
      const newCodigo = document.getElementById("editCodigo")?.value?.trim();
      const newNombre = document.getElementById("editNombre")?.value?.trim();
      const newSeccionPrincipal = document
        .getElementById("editSeccionPrincipal")
        ?.value?.trim();
      const newSeccionSecundaria = document
        .getElementById("editSeccionSecundaria")
        ?.value?.trim();
      const newFactorRaw = document.getElementById("editFactor")?.value?.trim();
      const newValorPlantillaRaw = document
        .getElementById("editValorPlantilla")
        ?.value?.trim();
      const newVisible = document.getElementById("editVisible")?.checked;

      let changed = false;
      if (newCodigo && newCodigo !== oldCodigo) {
        cuenta.CUENTA = newCodigo;
        cuenta.cuenta = newCodigo;
        logChange("edit", `Cuenta ${oldCodigo} → ${newCodigo}`, {
          oldCodigo,
          newCodigo,
          type: "codigo",
        });
        changed = true;
      }
      if (newNombre && newNombre !== oldNombre) {
        cuenta.NOMBRE = newNombre;
        cuenta.nombre = newNombre;
        logChange(
          "edit",
          `Cuenta ${cuenta.CUENTA}: "${oldNombre}" → "${newNombre}"`,
          { codigo: cuenta.CUENTA, oldNombre, newNombre },
        );
        changed = true;
      }

      // Actualizar sección principal
      const oldPrincipal = getAccountPrincipalName(cuenta);
      if (newSeccionPrincipal !== oldPrincipal) {
        setAccountPrincipalName(cuenta, newSeccionPrincipal);
        logChange(
          "edit",
          `Cuenta ${cuenta.CUENTA}: sección "${oldPrincipal}" → "${newSeccionPrincipal}"`,
          {
            codigo: cuenta.CUENTA,
            oldPrincipal,
            newPrincipal: newSeccionPrincipal,
          },
        );
        changed = true;
      }

      // Actualizar sección secundaria
      const oldSecundaria = getAccountSecondaryName(cuenta);
      if (newSeccionSecundaria !== oldSecundaria) {
        setAccountSecondaryName(cuenta, newSeccionSecundaria);
        logChange(
          "edit",
          `Cuenta ${cuenta.CUENTA}: subsección "${oldSecundaria}" → "${newSeccionSecundaria}"`,
          {
            codigo: cuenta.CUENTA,
            oldSecundaria,
            newSecundaria: newSeccionSecundaria,
          },
        );
        changed = true;
      }

      // Actualizar visibilidad
      if (newVisible !== undefined && cuenta.visible !== newVisible) {
        cuenta.visible = newVisible;
        changed = true;
      }

      const factorActualRaw =
        cuenta.operacion_factor ?? cuenta.operacionFactor ?? cuenta.factor;
      const factorActual = Number.isFinite(Number(factorActualRaw))
        ? Number(factorActualRaw)
        : 1;
      const factorNuevo =
        newFactorRaw === "" || newFactorRaw == null ? 1 : Number(newFactorRaw);
      const factorNuevoFinal = Number.isFinite(factorNuevo) ? factorNuevo : 1;
      if (factorNuevoFinal !== factorActual) {
        cuenta.operacion_factor = factorNuevoFinal;
        logChange(
          "edit",
          `Cuenta ${cuenta.CUENTA}: factor ${factorActual} → ${factorNuevoFinal}`,
          {
            codigo: cuenta.CUENTA,
            factorActual,
            factorNuevo: factorNuevoFinal,
          },
        );
        changed = true;
      }

      const valorPlantillaActual = Number.isFinite(
        Number(cuenta.valor_plantilla),
      )
        ? Number(cuenta.valor_plantilla)
        : 0;
      const valorPlantillaNuevo =
        newValorPlantillaRaw === "" || newValorPlantillaRaw == null
          ? 0
          : Number(newValorPlantillaRaw);
      const valorPlantillaFinal = Number.isFinite(valorPlantillaNuevo)
        ? valorPlantillaNuevo
        : valorPlantillaActual;
      if (valorPlantillaFinal !== valorPlantillaActual) {
        cuenta.valor_plantilla = valorPlantillaFinal;
        logChange(
          "edit",
          `Cuenta ${cuenta.CUENTA}: valor plantilla ${valorPlantillaActual} → ${valorPlantillaFinal}`,
          {
            codigo: cuenta.CUENTA,
            valorPlantillaActual,
            valorPlantillaNuevo: valorPlantillaFinal,
          },
        );
        changed = true;
      }

      if (changed) {
        renderLayout();
        showToast("✅ Cuenta actualizada", "success");
      }
    } else if (state.selectedElement.type === "section") {
      const oldName = state.selectedElement.name;
      const newName = document
        .getElementById("editNombreSeccion")
        ?.value?.trim();
      const finalSectionName = newName || oldName;

      if (newName && newName !== oldName) {
        let affectedCount = 0;
        state.cuentas.forEach((c) => {
          const principal =
            c["SECCIÓN Principal"] ||
            c["SECCIàN Principal"] ||
            c["SECCION Principal"] ||
            c.SECCION ||
            c.seccion_principal;

          if (principal === oldName) {
            // Actualizar todos los posibles nombres de campo
            if (c["SECCIÓN Principal"] !== undefined)
              c["SECCIÓN Principal"] = newName;
            if (c["SECCIàN Principal"] !== undefined)
              c["SECCIàN Principal"] = newName;
            if (c["SECCION Principal"] !== undefined)
              c["SECCION Principal"] = newName;
            if (c.SECCION !== undefined) c.SECCION = newName;
            if (c.seccion_principal !== undefined)
              c.seccion_principal = newName;
            affectedCount++;
          }
        });

        // También actualizar en operaciones si la sección es referenciada (placement + fórmulas)
        const oldKey = normalizeOperationMatch(oldName || "");
        state.operaciones.forEach((op) => {
          if (!op) return;

          if (normalizeOperationMatch(op.parentSection || "") === oldKey) {
            op.parentSection = newName;
          }

          if (normalizeOperationMatch(op.SECCION || "") === oldKey) {
            op.SECCION = newName;
            if (op.seccion !== undefined) op.seccion = newName;
          }

          if (
            normalizeOperationMatch(op["sum-row-sumavarios"] || "") === oldKey
          ) {
            op["sum-row-sumavarios"] = newName;
          }
          if (
            normalizeOperationMatch(op["sum-row-sumavarios2"] || "") === oldKey
          ) {
            op["sum-row-sumavarios2"] = newName;
          }
          if (
            normalizeOperationMatch(
              op["sum-row-sumavarios-consolidado"] || "",
            ) === oldKey
          ) {
            op["sum-row-sumavarios-consolidado"] = newName;
          }
          if (
            normalizeOperationMatch(op["sum-row-operativo"] || "") === oldKey
          ) {
            op["sum-row-operativo"] = newName;
          }
          if (
            normalizeOperationMatch(
              op["sum-row-operativo-consolidado"] || "",
            ) === oldKey
          ) {
            op["sum-row-operativo-consolidado"] = newName;
          }

          if (Array.isArray(op.secciones) && op.secciones.length) {
            op.secciones = op.secciones.map((value) =>
              normalizeOperationMatch(value || "") === oldKey ? newName : value,
            );
          }

          // Legacy: seccion_n
          for (let i = 1; i <= 20; i++) {
            const key = `seccion_${i}`;
            if (normalizeOperationMatch(op[key] || "") === oldKey) {
              op[key] = newName;
            }
          }

          // Nueva fórmula: formula_terms
          if (Array.isArray(op.formula_terms) && op.formula_terms.length) {
            let changed = false;
            op.formula_terms = op.formula_terms.map((term) => {
              if (!term) return term;
              let termChanged = false;
              let value = term.value;
              let parentSection = term.parentSection;

              if (
                term.type === "section" &&
                normalizeOperationMatch(value || "") === oldKey
              ) {
                value = newName;
                termChanged = true;
              }
              if (
                parentSection &&
                normalizeOperationMatch(parentSection || "") === oldKey
              ) {
                parentSection = newName;
                termChanged = true;
              }

              if (!termChanged) return term;
              changed = true;
              return { ...term, value, parentSection };
            });
            if (changed) {
              applyStrictFormulaTermsToOperation(op, op.formula_terms);
            }
          }
        });

        logChange(
          "rename",
          `Sección "${oldName}" → "${newName}" (${affectedCount} cuentas afectadas)`,
          { oldName, newName, affectedCount },
        );
        renderLayout();
        showToast(
          `✅ Sección renombrada (${affectedCount} cuentas actualizadas)`,
          "success",
        );
      }

      const sectionFormulaPayload = readEditorFormulaPayload({
        parentSection: finalSectionName,
        defaultParentSection: finalSectionName,
      });
      if (!sectionFormulaPayload.valid) {
        showToast(
          `Fórmula inválida en sección: ${sectionFormulaPayload.error}`,
          "error",
        );
        return;
      }
      const sectionFormulaTerms = sectionFormulaPayload.terms || [];
      const sectionFormulaTokens = sectionFormulaPayload.tokens || [];
      const sectionOpExistente = getHeaderLinkedOperation(
        "section",
        finalSectionName,
        "",
      );
      if (sectionOpExistente || sectionFormulaTerms.length) {
        const linkedSectionOp = ensureHeaderLinkedOperation(
          "section",
          finalSectionName,
          "",
        );
        if (linkedSectionOp) {
          applyStrictFormulaTermsToOperation(
            linkedSectionOp,
            sectionFormulaTerms,
            sectionFormulaTokens,
          );
          state.selectedElement.linkedOperation = linkedSectionOp;
        }
      }
      state.selectedElement.name = finalSectionName;
    } else if (state.selectedElement.type === "subsection") {
      const principal = state.selectedElement.principal;
      const oldName = state.selectedElement.name;
      const newName = document
        .getElementById("editNombreSubseccion")
        ?.value?.trim();
      const finalSubsectionName = newName || oldName;

      if (newName && newName !== oldName) {
        let affectedCount = 0;
        state.cuentas.forEach((c) => {
          const p =
            c["SECCIÓN Principal"] ||
            c["SECCIàN Principal"] ||
            c["SECCION Principal"] ||
            c.SECCION ||
            c.seccion_principal;

          const s =
            c["SECCION Secundaria"] ||
            c["SECCIÓN Secundaria"] ||
            c.seccion_secundaria ||
            c.seccion_secondary;

          if (p === principal && s === oldName) {
            setAccountSecondaryName(c, newName);
            affectedCount++;
          }
        });

        // Actualizar en operaciones (placement y fórmulas) cuando referencian la subsección.
        let affectedOps = 0;
        let affectedFormula = 0;
        const principalKey = normalizeOperationMatch(principal || "");
        const oldKey = normalizeOperationMatch(oldName || "");
        state.operaciones.forEach((op) => {
          if (!op) return;
          const opPrincipalKey = normalizeOperationMatch(
            op.parentSection || "",
          );
          const opSubKey = normalizeOperationMatch(op.parentSubsection || "");
          if (opPrincipalKey === principalKey && opSubKey === oldKey) {
            op.parentSubsection = newName;
            // Mantener campos de placement consistentes (SECCION/secciones) si la operación vive en esta subsección.
            if (normalizeOperationMatch(op.SECCION || "") === oldKey) {
              op.SECCION = newName;
              if (op.seccion !== undefined) op.seccion = newName;
              if (Array.isArray(op.secciones) && op.secciones.length) {
                op.secciones = op.secciones.map((value) =>
                  normalizeOperationMatch(value || "") === oldKey
                    ? newName
                    : value,
                );
              }
            }
            affectedOps++;
          }

          if (
            opPrincipalKey === principalKey &&
            normalizeOperationMatch(op["sum-row"] || "") === oldKey
          ) {
            op["sum-row"] = newName;
            affectedOps++;
          }

          // Legacy: seccion_n (cuando almacena subsección como término)
          for (let i = 1; i <= 20; i++) {
            const key = `seccion_${i}`;
            if (normalizeOperationMatch(op[key]) === oldKey) {
              op[key] = newName;
              affectedFormula++;
            }
          }

          if (Array.isArray(op.formula_terms) && op.formula_terms.length) {
            let changed = false;
            op.formula_terms = op.formula_terms.map((term) => {
              if (!term) return term;
              if (term.type !== "section" || !term.value) return term;
              const termKey = normalizeOperationMatch(term.value);
              const termParentKey = normalizeOperationMatch(
                term.parentSection || "",
              );
              if (termKey !== oldKey) return term;
              // Si hay parentSection, respetarlo para no renombrar homónimos en otras secciones.
              if (term.parentSection && termParentKey !== principalKey)
                return term;
              changed = true;
              return {
                ...term,
                value: newName,
                parentSection: principal || term.parentSection,
              };
            });
            if (changed) {
              applyStrictFormulaTermsToOperation(op, op.formula_terms);
              affectedFormula++;
            }
          }
        });

        logChange(
          "rename",
          `Subsección "${principal} / ${oldName}" → "${newName}" (${affectedCount} cuentas)`,
          {
            principal,
            oldName,
            newName,
            affectedCount,
            affectedOps,
            affectedFormula,
          },
        );
        renderLayout();
        showToast(
          `✅ Subsección renombrada (${affectedCount} cuentas actualizadas)`,
          "success",
        );
      }

      const subsectionFormulaPayload = readEditorFormulaPayload({
        parentSection: principal,
        defaultParentSection: principal,
      });
      if (!subsectionFormulaPayload.valid) {
        showToast(
          `Fórmula inválida en subsección: ${subsectionFormulaPayload.error}`,
          "error",
        );
        return;
      }
      const subsectionFormulaTerms = subsectionFormulaPayload.terms || [];
      const subsectionFormulaTokens = subsectionFormulaPayload.tokens || [];
      const subsectionOpExistente = getHeaderLinkedOperation(
        "subsection",
        principal,
        finalSubsectionName,
      );
      if (subsectionOpExistente || subsectionFormulaTerms.length) {
        const linkedSubsectionOp = ensureHeaderLinkedOperation(
          "subsection",
          principal,
          finalSubsectionName,
        );
        if (linkedSubsectionOp) {
          applyStrictFormulaTermsToOperation(
            linkedSubsectionOp,
            subsectionFormulaTerms,
            subsectionFormulaTokens,
          );
          state.selectedElement.linkedOperation = linkedSubsectionOp;
        }
      }
      state.selectedElement.name = finalSubsectionName;
    } else if (state.selectedElement.type === "operation") {
      const op = state.selectedElement.op;
      const claseInput = document.getElementById("editClaseOp");
      const idInput = document.getElementById("editOperacionId");
      const newClase = claseInput?.value?.trim() || "";
      const newIdInput = idInput?.value?.trim() || "";
      clearInvalid(claseInput);
      clearInvalid(idInput);
      if (!newClase && !newIdInput) {
        markInvalid(
          claseInput,
          "Este campo es obligatorio (o indica un ID interno).",
        );
        markInvalid(idInput, "Indica un ID si no hay nombre visible.");
        showToast(
          "Completa al menos el nombre visible o el ID interno.",
          "error",
        );
        return;
      }

      const oldId = getOperationId(op);
      const oldLabel = getOperationLabel(op);
      const desiredId = normalizeOperationId(
        newIdInput || oldId || newClase || oldLabel,
      );

      if (!desiredId) {
        showToast("Identificador invalido", "error");
        return;
      }

      const idConflict = state.operaciones.some(
        (o) =>
          o !== op &&
          normalizeOperationMatch(getOperationId(o)) ===
          normalizeOperationMatch(desiredId),
      );
      if (idConflict) {
        showToast("El identificador ya existe en otra operacion", "error");
        return;
      }

      if (newClase) {
        op.Clase = newClase;
        op.operacion_etiqueta = newClase;
        op.Etiqueta = newClase;
        op.etiqueta = newClase;
      }
      op.OperacionId = desiredId;

      if (
        oldId &&
        normalizeOperationMatch(desiredId) !== normalizeOperationMatch(oldId)
      ) {
        const oldIdKey = normalizeOperationMatch(oldId || "");
        const oldLabelKey = normalizeOperationMatch(oldLabel || "");
        const oldRefId = buildOperationRefId(oldId);
        const newRefId = buildOperationRefId(desiredId);
        state.operaciones.forEach((other) => {
          const otherTokens = extractFormulaTokens(other);
          if (!Array.isArray(otherTokens) || !otherTokens.length) return;
          let changed = false;
          const updatedTokens = otherTokens.map((token) => {
            if (!token || typeof token !== "object") return token;
            if (token.kind !== FORMULA_KIND_REF) return token;
            const refType = (token.refType || "").toString().toLowerCase();
            if (refType !== "operation") return token;
            const tokenRefId = (token.refId || "").toString().trim();
            const tokenLabelKey = normalizeOperationMatch(token.label || "");
            const matchesOld =
              (oldRefId && tokenRefId === oldRefId) ||
              (oldIdKey && tokenLabelKey === oldIdKey) ||
              (oldLabelKey && tokenLabelKey === oldLabelKey);
            if (!matchesOld) return token;
            changed = true;
            const nextLabel =
              tokenLabelKey === oldIdKey || tokenLabelKey === oldLabelKey
                ? desiredId
                : token.label || desiredId;
            return {
              ...token,
              refId: newRefId,
              label: nextLabel,
              unresolved: false,
            };
          });
          if (changed) {
            applyStrictFormulaTermsToOperation(
              other,
              normalizeFormulaTerms(
                convertV2TokensToLegacyTerms(updatedTokens),
              ),
              updatedTokens,
            );
          }
        });
      }

      // Actualizar etiquetas de filas segun lo capturado en el editor
      const tipoSelect = document.getElementById("editOperacionTipo");
      const tipoSeleccionado = (tipoSelect?.value || "").trim();
      const tipoInicial = (tipoSelect?.dataset.initialTipo || "").trim();
      const tipoNorm = normalizeAparicionValue(tipoSeleccionado);
      const tipoInicialNorm = normalizeAparicionValue(tipoInicial);
      const tipoChanged =
        Boolean(tipoSelect) && tipoNorm && tipoNorm !== tipoInicialNorm;
      const selectedField =
        tipoNorm && tipoNorm !== "libre" ? tipoSeleccionado : "";
      const etiquetaFallback =
        newClase ||
        getOperationDisplayName(op) ||
        getOperationLabel(op) ||
        op.OperacionId ||
        "Operacion";

      if (tipoSelect && (tipoChanged || tipoNorm === "libre")) {
        OP_ROW_FIELDS.forEach(({ field }) => {
          const input = document.getElementById(rowLabelInputId(field));
          const value = input?.value?.trim() || "";
          if (selectedField && field === selectedField) {
            op[field] = value || etiquetaFallback;
          } else if (op[field]) {
            delete op[field];
          }
        });
      } else {
        OP_ROW_FIELDS.forEach(({ field }) => {
          const input = document.getElementById(rowLabelInputId(field));
          if (!input) return;
          const value = input.value?.trim();
          if (value) {
            op[field] = value;
          } else if (op[field]) {
            delete op[field];
          }
        });
      }

      const visibleInput = document.getElementById("editOperacionVisible");
      if (visibleInput) {
        op.visible = Boolean(visibleInput.checked);
      }

      // Guardar estilo visual de la fila
      const estiloFilaInput = document.getElementById("editOperacionEstilo");
      if (estiloFilaInput?.value) {
        op.rowStyle = estiloFilaInput.value;
        op.estilo_fila = estiloFilaInput.value;
      }

      const formulaPayload = readEditorFormulaPayload({
        parentSection: op.parentSection || "",
        defaultParentSection: op.parentSection || "",
      });
      if (!formulaPayload.valid) {
        showToast(`Fórmula inválida: ${formulaPayload.error}`, "error");
        return;
      }
      formulaTerms = Array.isArray(formulaPayload.terms)
        ? formulaPayload.terms
        : [];
      applyStrictFormulaTermsToOperation(
        op,
        formulaTerms,
        formulaPayload.tokens || [],
      );

      // Flujo de inserción masiva: aplicar fórmula en la fila del modal Agregar
      // sin tocar el layout persistido hasta confirmar "Agregar".
      if (op?._bulkFormulaInput) {
        const bulkTerms = Array.isArray(op.formula_terms)
          ? op.formula_terms
          : [];
        const bulkText = buildFormulaPreviewText(bulkTerms);
        op._bulkFormulaInput.value = bulkText === "Sin fórmula" ? "" : bulkText;
        op._bulkFormulaInput.dispatchEvent(
          new Event("change", { bubbles: true }),
        );
        if (typeof window._bulkFormulaEditorCallback === "function") {
          window._bulkFormulaEditorCallback(bulkTerms);
          window._bulkFormulaEditorCallback = null;
        }
        bootstrap?.Offcanvas?.getInstance(dom.operationEditorPanel)?.hide();
        showToast("Fórmula aplicada en la fila de inserción", "success");
        return;
      }
    } else if (state.selectedElement.type === "consolidatedLabel") {
      // Handle consolidated label edit
      const oldLabel = state.selectedElement.label;
      const field = state.selectedElement.field;
      const affectedOps = state.selectedElement.affectedOps;
      const newLabel = document
        .getElementById("editConsolidatedLabelName")
        ?.value?.trim();

      if (newLabel && newLabel !== oldLabel) {
        affectedOps.forEach((op) => {
          if (op[field] === oldLabel) {
            op[field] = newLabel;
          }
        });
        showToast(
          `Etiqueta actualizada en ${affectedOps.length} operaciones`,
          "success",
        );
      }

      // Leer fórmula del editor (igual que para operaciones normales)
      const formulaPayload = readEditorFormulaPayload({
        parentSection: affectedOps[0]?.parentSection || "",
        defaultParentSection: affectedOps[0]?.parentSection || "",
      });

      if (!formulaPayload.valid) {
        showToast(`Fórmula inválida: ${formulaPayload.error}`, "error");
        return;
      }

      formulaTerms = Array.isArray(formulaPayload.terms)
        ? formulaPayload.terms
        : [];

      const normalizedTerms = normalizeFormulaTerms(formulaTerms);
      const hasExistingFormula = affectedOps.some(
        (op) =>
          (Array.isArray(op.formula_terms) && op.formula_terms.length > 0) ||
          Boolean(op.formula_json),
      );

      if (normalizedTerms.length > 0 || hasExistingFormula) {
        affectedOps.forEach((op) => {
          const tokens = convertLegacyTermsToV2Tokens(normalizedTerms, op);
          applyStrictFormulaTermsToOperation(op, normalizedTerms, tokens);
        });

        showToast(
          `Fórmula actualizada en ${affectedOps.length} operaciones`,
          "success",
        );
      }
    }

    state.unsavedChanges = true;
    updateButtonStates();
    renderLayout();
    updateStats();
    scheduleAutoSave("edit");

    // Si hay un callback de bulk formula editor, llamarlo con los términos actualizados
    if (
      typeof window._bulkFormulaEditorCallback === "function" &&
      formulaTerms
    ) {
      window._bulkFormulaEditorCallback(formulaTerms);
    }

    bootstrap.Modal.getInstance(dom.modalEditar)?.hide();
    bootstrap?.Offcanvas?.getInstance(dom.operationEditorPanel)?.hide();
    showToast("Cambios aplicados", "success");
  }

  function deleteElement() {
    if (!state.selectedElement) return;

    const type = state.selectedElement.type;

    if (type === "account") {
      const cuenta =
        state.selectedElement.cuenta ||
        resolveAccountByIdOrCode(
          state.selectedElement.accountId || state.selectedElement.codigo,
        );
      const codigo =
        cuenta?.CUENTA ||
        state.selectedElement.codigo ||
        state.selectedElement.accountId;
      if (codigo && confirm(`Eliminar la cuenta ${codigo}?`)) {
        const accountId = cuenta ? getAccountRowId(cuenta) : "";
        if (accountId) {
          state.cuentas = state.cuentas.filter(
            (c) => getAccountRowId(c) !== accountId,
          );
        } else {
          state.cuentas = state.cuentas.filter((c) => c.CUENTA !== codigo);
        }
        finalizeDeletion();
      }
    } else if (type === "section") {
      const name = (state.selectedElement.name || "").toString().trim();
      if (
        confirm(
          `Eliminar la seccion "${name}" y TODAS sus cuentas? Esta accion no se puede deshacer.`,
        )
      ) {
        const sectionKey = normalizeOperationMatch(name);
        state.cuentas = state.cuentas.filter((c) => {
          const principal = getAccountPrincipalName(c) || "";
          return normalizeOperationMatch(principal) !== sectionKey;
        });

        let removedOps = 0;
        state.operaciones = (state.operaciones || []).filter((op) => {
          if (!op) return false;
          const parentKey = normalizeOperationMatch(op.parentSection || "");
          const placementKey = normalizeOperationMatch(
            op.SECCION || op.seccion || "",
          );
          const sectionList = Array.isArray(op.secciones) ? op.secciones : [];
          const inSection =
            parentKey === sectionKey ||
            placementKey === sectionKey ||
            sectionList.some(
              (value) => normalizeOperationMatch(value || "") === sectionKey,
            );
          if (inSection) removedOps += 1;
          return !inSection;
        });

        logChange("delete", `Sección "${name}" eliminada`, {
          sectionName: name,
          removedOps,
          type: "section",
        });
        finalizeDeletion(
          `Sección "${name}" eliminada (${removedOps} operaciones ligadas)`,
        );
      }
    } else if (type === "subsection") {
      const principal = (state.selectedElement.principal || "")
        .toString()
        .trim();
      const name = (state.selectedElement.name || "").toString().trim();
      if (
        confirm(
          `Eliminar la subseccion "${name}" de "${principal}" y TODAS sus cuentas? Esta accion no se puede deshacer.`,
        )
      ) {
        const principalKey = normalizeOperationMatch(principal);
        const subsectionKey = normalizeOperationMatch(name);
        state.cuentas = state.cuentas.filter((c) => {
          const currentPrincipal = normalizeOperationMatch(
            getAccountPrincipalName(c) || "",
          );
          const currentSubsection = normalizeOperationMatch(
            getAccountSecondaryName(c) || "",
          );
          return !(
            currentPrincipal === principalKey &&
            currentSubsection === subsectionKey
          );
        });

        let removedOps = 0;
        state.operaciones = (state.operaciones || []).filter((op) => {
          if (!op) return false;
          const opParentKey = normalizeOperationMatch(op.parentSection || "");
          const opSubKey = normalizeOperationMatch(op.parentSubsection || "");
          const placementKey = normalizeOperationMatch(
            op.SECCION || op.seccion || "",
          );
          const sectionList = Array.isArray(op.secciones) ? op.secciones : [];
          const hasSubPlacement =
            placementKey === subsectionKey ||
            sectionList.some(
              (value) => normalizeOperationMatch(value || "") === subsectionKey,
            );
          const inSubsection =
            opParentKey === principalKey &&
            (opSubKey === subsectionKey || hasSubPlacement);
          if (inSubsection) removedOps += 1;
          return !inSubsection;
        });

        logChange("delete", `Subsección "${principal} / ${name}" eliminada`, {
          principal,
          subsectionName: name,
          removedOps,
          type: "subsection",
        });
        finalizeDeletion(
          `Subsección "${name}" eliminada (${removedOps} operaciones ligadas)`,
        );
      }
    } else if (type === "operation") {
      const op = state.selectedElement.op;
      const opId = getOperationId(op);
      const label = getOperationLabel(op);
      if (opId && confirm(`Eliminar la operacion "${label}"?`)) {
        state.operaciones = state.operaciones.filter(
          (o) => getOperationId(o) !== opId,
        );
        finalizeDeletion();
      }
    }
  }

  function finalizeDeletion(message = "Elemento eliminado") {
    state.unsavedChanges = true;
    updateButtonStates();
    renderLayout();
    updateStats();
    scheduleAutoSave("delete");
    bootstrap.Modal.getInstance(dom.modalEditar)?.hide();
    if (bootstrap?.Offcanvas) {
      bootstrap.Offcanvas.getInstance(dom.operationEditorPanel)?.hide();
    } else {
      closeOffcanvasFallback(dom.operationEditorPanel);
    }
    showToast(message, "success");
  }

  /**
   * Guarda los cambios de una operación desde el panel lateral
   */
  function saveOperationFromPanel() {
    if (!state.selectedElement || state.selectedElement.type !== "operation")
      return;

    const op = state.selectedElement.op;
    if (!op) return;
    const isBulkOp = Boolean(op?._bulkFormulaInput || op?._bulkRow);

    // Leer fórmula del panel (se usa tanto en modo normal como en inserción masiva)
    const formulaPayload = readEditorFormulaPayload({
      parentSection: op.parentSection || "",
      defaultParentSection: op.parentSection || "",
    });
    if (!formulaPayload.valid) {
      showToast(`Fórmula inválida: ${formulaPayload.error}`, "error");
      return;
    }
    const selectedTerms = Array.isArray(formulaPayload.terms)
      ? formulaPayload.terms
      : [];
    const selectedTokens = Array.isArray(formulaPayload.tokens)
      ? formulaPayload.tokens
      : [];

    // Fórmula manual: puede quedar vacía si así lo define la plantilla.
    if (!selectedTerms || selectedTerms.length === 0) {
      console.warn("⚠️ Operación sin fórmula definida");
    }

    // Si es inserción masiva, solo aplicar fórmula a la fila y salir.
    if (isBulkOp) {
      const normalized = normalizeFormulaTerms(selectedTerms || []);
      applyStrictFormulaTermsToOperation(op, normalized, selectedTokens);

      if (op._bulkFormulaInput) {
        const bulkText = buildFormulaPreviewText(normalized);
        op._bulkFormulaInput.value = bulkText === "Sin fórmula" ? "" : bulkText;
        op._bulkFormulaInput.dispatchEvent(
          new Event("change", { bubbles: true }),
        );
      }
      if (typeof window._bulkFormulaEditorCallback === "function") {
        window._bulkFormulaEditorCallback(normalized);
        window._bulkFormulaEditorCallback = null;
      }
      bootstrap?.Offcanvas?.getInstance(dom.operationEditorPanel)?.hide();
      showToast("Fórmula aplicada en la fila de inserción", "success");
      return;
    }

    // Leer valores del panel (modo estricto manual)
    const claseInput = document.getElementById("editClaseOp");
    const idInput = document.getElementById("editOperacionId");
    const newClase = claseInput?.value?.trim() || "";
    const newIdInput = idInput?.value?.trim() || "";
    const markInvalid = (input) => {
      if (!input) return;
      input.classList.add("is-invalid");
    };
    const clearInvalid = (input) => {
      if (!input) return;
      input.classList.remove("is-invalid");
    };
    clearInvalid(claseInput);
    clearInvalid(idInput);

    const oldId = getOperationId(op);
    const oldLabel = getOperationLabel(op);
    const oldDisplay = getOperationDisplayName(op);
    const effectiveClase =
      newClase || op.Clase || op.operacion_etiqueta || op.Etiqueta || "";
    if (!effectiveClase) {
      markInvalid(claseInput);
      showToast("El nombre de la operación es requerido", "error");
      return;
    }

    const desiredId = normalizeOperationId(newIdInput || op.OperacionId || "");
    if (!desiredId) {
      markInvalid(idInput);
      showToast("Define un ID válido para la operación.", "error");
      return;
    }
    const duplicateId = (state.operaciones || []).some(
      (o) =>
        o !== op &&
        normalizeOperationMatch(getOperationId(o)) ===
        normalizeOperationMatch(desiredId),
    );
    if (duplicateId) {
      markInvalid(idInput);
      showToast("Ese ID ya existe en otra operación", "error");
      return;
    }

    // Actualizar datos básicos
    op.Clase = effectiveClase;
    op.OperacionId = desiredId;
    op.operacion_etiqueta = effectiveClase;
    op.Etiqueta = effectiveClase;

    if (
      oldId &&
      normalizeOperationMatch(desiredId) !== normalizeOperationMatch(oldId)
    ) {
      const oldIdKey = normalizeOperationMatch(oldId || "");
      const oldLabelKey = normalizeOperationMatch(oldLabel || "");
      const oldRefId = buildOperationRefId(oldId);
      const newRefId = buildOperationRefId(desiredId);
      (state.operaciones || []).forEach((other) => {
        const otherTokens = extractFormulaTokens(other);
        if (!Array.isArray(otherTokens) || !otherTokens.length) return;
        let changed = false;
        const updatedTokens = otherTokens.map((token) => {
          if (!token || typeof token !== "object") return token;
          if (token.kind !== FORMULA_KIND_REF) return token;
          const refType = (token.refType || "").toString().toLowerCase();
          if (refType !== "operation") return token;
          const tokenRefId = (token.refId || "").toString().trim();
          const tokenLabelKey = normalizeOperationMatch(token.label || "");
          const matchesOld =
            (oldRefId && tokenRefId === oldRefId) ||
            (oldIdKey && tokenLabelKey === oldIdKey) ||
            (oldLabelKey && tokenLabelKey === oldLabelKey);
          if (!matchesOld) return token;
          changed = true;
          const nextLabel =
            tokenLabelKey === oldIdKey || tokenLabelKey === oldLabelKey
              ? desiredId
              : token.label || desiredId;
          return {
            ...token,
            refId: newRefId,
            label: nextLabel,
            unresolved: false,
          };
        });
        if (changed) {
          applyStrictFormulaTermsToOperation(
            other,
            normalizeFormulaTerms(convertV2TokensToLegacyTerms(updatedTokens)),
            updatedTokens,
          );
        }
      });
    }

    // Ubicación (manual): sección/subsección donde aparece la operación.
    // Nota: La fórmula se guarda en `formula_json`; `SECCION` se usa como compat/placement.
    const placementSectionEl = document.getElementById("editOpParentSection");
    const placementSubsectionEl = document.getElementById(
      "editOpParentSubsection",
    );
    if (placementSectionEl) {
      const placementSection = (placementSectionEl.value || "")
        .toString()
        .trim();
      const placementSubsection = placementSubsectionEl
        ? (placementSubsectionEl.value || "").toString().trim()
        : "";

      if (placementSection) {
        op.parentSection = placementSection;
        op.parentSubsection = placementSubsection || null;
      } else {
        op.parentSection = null;
        op.parentSubsection = null;
      }

      const placement = placementSection
        ? (placementSubsection || placementSection).toString().trim()
        : "";
      op.SECCION = placement;
      op.seccion = placement;
      op.secciones = placement ? [placement] : [];
    }

    // Actualizar etiquetas de filas según lo capturado en Aparición
    const tipoSelect = document.getElementById("editOperacionTipo");
    const tipoSeleccionado = (tipoSelect?.value || "").trim();
    const tipoInicial = (tipoSelect?.dataset.initialTipo || "").trim();
    const tipoNorm = normalizeAparicionValue(tipoSeleccionado);
    const tipoInicialNorm = normalizeAparicionValue(tipoInicial);
    const tipoChanged =
      Boolean(tipoSelect) && tipoNorm && tipoNorm !== tipoInicialNorm;
    const selectedField =
      tipoNorm && tipoNorm !== "libre" ? tipoSeleccionado : "";
    const etiquetaFallback =
      newClase ||
      getOperationDisplayName(op) ||
      getOperationLabel(op) ||
      op.OperacionId ||
      "Operacion";
    const nameChanged =
      newClase &&
      normalizeOperationMatch(newClase) !==
      normalizeOperationMatch(oldDisplay || oldLabel || "");
    const oldDisplayKey = normalizeOperationMatch(oldDisplay || "");
    const oldLabelKey = normalizeOperationMatch(oldLabel || "");
    const normalizeRowLabelInput = (value) => {
      const trimmed = (value || "").trim();
      if (!trimmed) return "";
      if (nameChanged) {
        const normalized = normalizeOperationMatch(trimmed);
        if (
          normalized &&
          (normalized === oldDisplayKey || normalized === oldLabelKey)
        ) {
          return "";
        }
      }
      return trimmed;
    };

    if (tipoSelect && (tipoChanged || tipoNorm === "libre")) {
      OP_ROW_FIELDS.forEach(({ field }) => {
        const input = document.getElementById(rowLabelInputId(field));
        const value = normalizeRowLabelInput(input?.value);
        if (selectedField && field === selectedField) {
          op[field] = value || etiquetaFallback;
        } else if (op[field]) {
          delete op[field];
        }
        // Si el campo no es seleccionado, se elimina (modo tipo cambiado/libre).
        // No aplicar auto-rename aquí para no reintroducir campos que el usuario acaba de des-seleccionar.
      });
    } else {
      OP_ROW_FIELDS.forEach(({ field }) => {
        const input = document.getElementById(rowLabelInputId(field));
        if (!input) return;
        const rawTrimmed = (input.value || "").trim();
        const rawKey = normalizeOperationMatch(rawTrimmed);
        const wasAutoRename =
          nameChanged && rawKey && (rawKey === oldDisplayKey || rawKey === oldLabelKey);
        const value = normalizeRowLabelInput(rawTrimmed);

        if (selectedField && field === selectedField) {
          // Mantener el campo seleccionado consistente (si queda vacío, usar fallback)
          op[field] = value || etiquetaFallback;
          return;
        }

        if (value) {
          op[field] = value;
          return;
        }

        // Si el usuario renombró la operación y el input aún era el nombre anterior, auto-actualizar.
        if (wasAutoRename && op[field]) {
          op[field] = etiquetaFallback;
          return;
        }

        if (op[field]) {
          delete op[field];
        }
      });
    }

    // Guardar fórmula manual (se permite operación sin fórmula).
    applyStrictFormulaTermsToOperation(op, selectedTerms, selectedTokens);

    // Visibilidad y estilo
    const visibleInput = document.getElementById("editOperacionVisible");
    if (visibleInput) {
      op.visible = Boolean(visibleInput.checked);
    }

    const estiloFilaInput = document.getElementById("editOperacionEstilo");
    if (estiloFilaInput?.value) {
      op.rowStyle = estiloFilaInput.value;
      op.estilo_fila = estiloFilaInput.value;
    }

    // Signo (multiplicador global de la operación)
    const signoInput = document.getElementById("editOperacionSigno");
    if (signoInput) {
      signoInput.classList.remove("is-invalid");
      const raw = (signoInput.value || "").toString().trim();
      const parseNumber = (value) =>
        Number((value || "").toString().trim().replace(",", "."));

      if (!raw) {
        if (op.signo !== undefined) delete op.signo;
        if (op.signos && op.signos["sum-row"] !== undefined) {
          delete op.signos["sum-row"];
          if (!Object.keys(op.signos).length) delete op.signos;
        }
      } else {
        const signo = parseNumber(raw);
        if (!Number.isFinite(signo)) {
          signoInput.classList.add("is-invalid");
          showToast("Signo inválido. Usa un número como 1 o -1.", "error");
          return;
        }
        if (signo === 1) {
          if (op.signo !== undefined) delete op.signo;
          if (op.signos && op.signos["sum-row"] === 1) {
            delete op.signos["sum-row"];
            if (!Object.keys(op.signos).length) delete op.signos;
          }
        } else {
          op.signo = signo;
          op.signos = op.signos || {};
          op.signos["sum-row"] = signo;
        }
      }
    }

    // Marcar cambios y actualizar
    state.unsavedChanges = true;
    updateButtonStates();
    renderLayout();
    updateStats();
    scheduleAutoSave("edit");

    bootstrap?.Offcanvas?.getInstance(dom.operationEditorPanel)?.hide();
    showToast("✅ Operación guardada", "success");

    logChange("edit", `Operación "${effectiveClase}" actualizada`, {
      oldId,
      newId: desiredId,
      oldLabel,
      newLabel: effectiveClase,
    });
  }

  // ==========================================
  // FORMULA BUILDER FUNCTIONS
  // ==========================================
  let formulaTerms = [];

  function buildFormulaTermsFromParent(parentName) {
    if (!parentName) return [];

    const sections = buildManualSectionTree();
    const parentKey = normalizeOperationMatch(parentName);
    if (!parentKey) return [];

    // 1) parentName coincide con una sección principal: sugerir sus subsecciones
    const principalMatch = sections.find(
      (s) => normalizeOperationMatch(s?.name || "") === parentKey,
    );
    if (
      principalMatch &&
      Array.isArray(principalMatch.subsections) &&
      principalMatch.subsections.length
    ) {
      const seen = new Set();
      const terms = [];
      let counter = 0;
      principalMatch.subsections.forEach((sub) => {
        const label = (sub?.name || "").toString().trim();
        if (!label) return;
        const key = normalizeOperationMatch(label);
        if (!key || seen.has(key)) return;
        seen.add(key);
        terms.push({
          id: Date.now() + counter++,
          operator: "+",
          type: "section",
          value: label,
          parentSection: principalMatch.name,
        });
      });
      if (terms.length) return terms;
    }

    // 2) parentName coincide con una subsección: sugerir esa subsección en sus principales encontrados
    const matches = [];
    sections.forEach((sec) => {
      const parent = (sec?.name || "").toString().trim();
      if (!parent) return;
      (sec.subsections || []).forEach((sub) => {
        const subName = (sub?.name || "").toString().trim();
        const subKey = normalizeOperationMatch(subName);
        if (!subKey) return;
        if (
          subKey === parentKey ||
          subKey.includes(parentKey) ||
          parentKey.includes(subKey)
        ) {
          matches.push({ parent, name: subName });
        }
      });
    });

    if (matches.length) {
      const seen = new Set();
      const terms = [];
      let counter = 0;
      matches.forEach((match) => {
        const key = `${normalizeOperationMatch(match.parent)}|${normalizeOperationMatch(match.name)}`;
        if (!match.name || seen.has(key)) return;
        seen.add(key);
        terms.push({
          id: Date.now() + counter++,
          operator: "+",
          type: "section",
          value: match.name,
          parentSection: match.parent,
        });
      });
      if (terms.length) return terms;
    }

    // Si no encontró subsecciones, buscar patrón de consolidación
    const nameLower = parentName.toLowerCase();

    // Detectar si es operación consolidada
    if (
      nameLower.includes("consolidated") ||
      nameLower.includes("consolidado") ||
      nameLower.includes("total")
    ) {
      const isIncome =
        nameLower.includes("income") || nameLower.includes("ingreso");
      const isExpense =
        nameLower.includes("expense") || nameLower.includes("gasto");
      const isResult =
        nameLower.includes("result") || nameLower.includes("resultado");
      const isOperating =
        nameLower.includes("operating") || nameLower.includes("operativo");

      if (isIncome || isExpense) {
        // Buscar todas las secciones del tipo correspondiente
        const matchingSections = [];
        sections.forEach((section) => {
          const principal = (section?.name || "").toString().trim();
          if (!principal) return;
          const secLower = principal.toLowerCase();
          if (
            (isIncome && secLower.includes("income")) ||
            (isExpense && secLower.includes("expense"))
          ) {
            matchingSections.push(principal);
          }
        });

        if (matchingSections.length > 0) {
          return matchingSections.map((sec, i) => ({
            id: Date.now() + i,
            operator: "+",
            type: "section",
            value: sec,
          }));
        }
      }

      if (isResult || isOperating) {
        // Para resultados, buscar operaciones consolidadas de income y expense
        const terms = [];
        let counter = 0;

        // Buscar operación consolidada de income
        const incomeOp = state.operaciones.find((op) => {
          const claseL = (op.Clase || "").toLowerCase();
          return (
            (claseL.includes("consolidated") || claseL.includes("total")) &&
            claseL.includes("income")
          );
        });

        if (incomeOp) {
          terms.push({
            id: Date.now() + counter++,
            operator: "+",
            type: "operation",
            value: getOperationId(incomeOp) || incomeOp.Clase,
          });
        }

        // Buscar operación consolidada de expense
        const expenseOp = state.operaciones.find((op) => {
          const claseL = (op.Clase || "").toLowerCase();
          return (
            (claseL.includes("consolidated") || claseL.includes("total")) &&
            claseL.includes("expense")
          );
        });

        if (expenseOp) {
          terms.push({
            id: Date.now() + counter++,
            operator: "-",
            type: "operation",
            value: getOperationId(expenseOp) || expenseOp.Clase,
          });
        }

        if (terms.length > 0) return terms;
      }
    }

    // Si tiene "of" o "de", intentar buscar secciones específicas
    // Ejemplo: "Income of CDMX" o "CDMX Income"
    const keywords = [
      "cdmx",
      "guadalajara",
      "monterrey",
      "northwest",
      "queretaro",
      "merida",
    ];
    const foundKeywords = keywords.filter((kw) => nameLower.includes(kw));

    if (foundKeywords.length > 0) {
      const terms = [];
      let counter = 0;

      foundKeywords.forEach((keyword) => {
        // Buscar secciones que contengan este keyword
        sections.forEach((section) => {
          const principal = section.name;
          const subsecs = section.subsections || [];
          const principalLower = principal.toLowerCase();
          if (principalLower.includes(keyword)) {
            // Si es income/expense, agregar la sección principal
            if (
              (nameLower.includes("income") &&
                principalLower.includes("income")) ||
              (nameLower.includes("expense") &&
                principalLower.includes("expense"))
            ) {
              terms.push({
                id: Date.now() + counter++,
                operator: "+",
                type: "section",
                value: principal,
              });
            } else {
              // Agregar subsecciones
              subsecs.forEach((subsection) => {
                const secundaria = subsection.name;
                if (secundaria) {
                  terms.push({
                    id: Date.now() + counter++,
                    operator: "+",
                    type: "section",
                    value: secundaria,
                    parentSection: principal,
                  });
                }
              });
            }
          }
        });
      });

      if (terms.length > 0) return terms;
    }

    return [];
  }

  function normalizeFormulaTerms(terms = []) {
    return (terms || []).map((t) => {
      const type = t.type || "section";
      const constantValue =
        type === "constant"
          ? Number.isFinite(Number(t.constant))
            ? Number(t.constant)
            : Number.isFinite(Number(t.value))
              ? Number(t.value)
              : null
          : null;
      const value =
        type === "operation"
          ? resolveOperationId(t.value || "")
          : type === "constant"
            ? t.value || (constantValue !== null ? String(constantValue) : "")
            : t.value || "";
      const normalized = {
        operator: t.operator || "+",
        type,
        value,
      };
      if (constantValue !== null) {
        normalized.constant = constantValue;
      }
      if (t.parentSection) {
        normalized.parentSection = t.parentSection;
      }
      return normalized;
    });
  }

  function normalizeOperationReferences() {
    state.operaciones.forEach((op) => {
      const tokens = extractFormulaTokens(op);
      if (!Array.isArray(tokens) || tokens.length === 0) return;
      const normalizedTerms = normalizeFormulaTerms(
        convertV2TokensToLegacyTerms(tokens),
      );
      applyStrictFormulaTermsToOperation(op, normalizedTerms, tokens);
    });
  }

  // Toggle entre modo simple y avanzado
  window.toggleFormulaBuilder = function () {
    const tipo = document.getElementById("selectTipoOp")?.value;
    const simpleMode = document.getElementById("simpleFormulaMode");
    const advancedMode = document.getElementById("advancedFormulaMode");

    if (tipo === "custom-formula") {
      simpleMode.style.display = "none";
      advancedMode.style.display = "block";
      if (formulaTerms.length === 0) {
        addFormulaTerm(); // Agregar primer término
      }
    } else {
      simpleMode.style.display = "block";
      advancedMode.style.display = "none";
    }
  };

  // Expand section terms to individual account terms for display
  function expandSectionTermsToAccounts() {
    const expandedTerms = [];

    formulaTerms.forEach((term) => {
      if (term.type === "section" && term.value) {
        // Get all accounts in this section
        const accounts = getAccountsForSection(term.value, term.parentSection);

        if (accounts.length === 0) {
          // Keep the section term if no accounts found
          expandedTerms.push(term);
        } else {
          // Create individual account terms
          accounts.forEach((account, idx) => {
            expandedTerms.push({
              id: Date.now() + expandedTerms.length + idx,
              operator: term.operator, // Keep the original operator
              type: "account",
              value: account.CUENTA,
              displayName: `${account.CUENTA} ${account.NOMBRE || ""}`.trim(),
              originalSection: term.value, // Keep reference to parent section
            });
          });
        }
      } else if (term.type === "account" && term.value) {
        // Account term - keep as is
        expandedTerms.push(term);
      } else {
        // Other types (operation, etc) - keep as is
        expandedTerms.push(term);
      }
    });

    formulaTerms = expandedTerms;
  }

  // Agregar un término a la fórmula
  window.addFormulaTerm = function () {
    const termId = Date.now();
    formulaTerms.push({
      id: termId,
      operator: "+",
      type: "account", // CHANGED: ahora por defecto es cuenta
      value: "",
    });
    renderFormulaTerms();
  };

  // Eliminar un término
  window.removeFormulaTerm = function (termId) {
    formulaTerms = formulaTerms.filter((t) => t.id !== termId);
    renderFormulaTerms();
    // Removed updateFormulaPreview() - not needed
  };

  // Helper to get accounts for a section name
  function getAccountsForSection(sectionName, parentSectionName = "") {
    if (!sectionName || !state.cuentas || state.cuentas.length === 0) return [];

    const sectionKey = normalizeKey(sectionName);
    if (!sectionKey) return [];
    const parentKey = normalizeKey(parentSectionName);

    const matchesParent = (primaryKey) => {
      if (!parentKey) return true;
      if (!primaryKey) return false;
      return (
        primaryKey === parentKey ||
        primaryKey.includes(parentKey) ||
        parentKey.includes(primaryKey)
      );
    };

    // Modo manual:
    // - Si viene parentSectionName: sectionName es una SUBSECCIÓN (match por secundaria bajo ese principal)
    // - Si NO viene parentSectionName: sectionName es SECCIÓN PRINCIPAL (match solo por principal)
    let accounts = state.cuentas.filter((c) => {
      if (!c || isPlaceholderAccount(c)) return false;
      const primaryKey = normalizeKey(getAccountPrincipalName(c));
      if (!primaryKey) return false;
      if (!matchesParent(primaryKey)) return false;

      if (parentKey) {
        const secondaryKey = normalizeKey(getAccountSecondaryName(c));
        return secondaryKey === sectionKey;
      }

      return primaryKey === sectionKey;
    });

    // Try partial match if no exact match
    if (accounts.length === 0) {
      accounts = state.cuentas.filter((c) => {
        if (!c || isPlaceholderAccount(c)) return false;
        const primaryKey = normalizeKey(getAccountPrincipalName(c));
        if (!primaryKey) return false;
        if (!matchesParent(primaryKey)) return false;

        if (parentKey) {
          const secondaryKey = normalizeKey(getAccountSecondaryName(c));
          return secondaryKey && secondaryKey.includes(sectionKey);
        }

        return primaryKey.includes(sectionKey);
      });
    }

    return accounts;
  }

  /**
   * Obtener catálogo completo de cuentas disponibles
   */
  function getAccountCatalog() {
    const accounts = [];
    const seen = new Set();

    (state.cuentas || []).forEach((cuenta) => {
      if (!cuenta || isPlaceholderAccount(cuenta)) return;
      const code = cuenta.CUENTA || cuenta.cuenta || cuenta.num_cta;
      const name = cuenta.NOMBRE || cuenta.nombre || "";
      const key = normalizeOperationMatch(code);
      if (!code || !key || seen.has(key)) return;
      seen.add(key);
      accounts.push({
        code: String(code).trim(),
        name: String(name).trim(),
        display: `${code}${name ? " - " + name : ""}`,
      });
    });

    return accounts;
  }

  function getAccountByCode(code) {
    if (!code) return null;
    const target = normalizeKey(code);
    if (!target) return null;
    const accounts = state.cuentas || [];
    for (const cuenta of accounts) {
      const cuentaCode = cuenta.CUENTA || cuenta.cuenta || cuenta.num_cta;
      if (!cuentaCode) continue;
      if (normalizeKey(cuentaCode) === target) return cuenta;
    }
    return null;
  }

  function buildLayoutOrderIndex() {
    const sectionIndex = new Map();
    const subsectionIndex = new Map();
    const accountIndex = new Map();

    // Usar el ORDEN REAL del template (preview rows) para indexar secciones/subsecciones.
    const rows = getTemplateRowsForReorder();
    rows.forEach((row, idx) => {
      if (!row) return;
      if (row.type === "principal") {
        const name = (row.label || "").toString().trim();
        const key = normalizeKey(name);
        if (key && !sectionIndex.has(key)) {
          sectionIndex.set(key, idx);
        }
        return;
      }
      if (row.type === "subsection") {
        const parent = (row.parentSection || "").toString().trim();
        const subName = (row.label || "").toString().trim();
        const parentKey = normalizeKey(parent);
        const subKey = normalizeKey(subName) || "__NO_SUB__";
        if (parentKey) {
          subsectionIndex.set(`${parentKey}||${subKey}`, idx);
        }
        return;
      }
      if (row.type === "account") {
        const code = (row.cuenta || row.label || "").toString().trim();
        const key = normalizeKey(code);
        if (key && !accountIndex.has(key)) {
          accountIndex.set(key, idx);
        }
      }
    });

    return { sectionIndex, subsectionIndex, accountIndex };
  }

  function summarizeOperatorSet(operators) {
    const values = Array.from(operators || []).filter(Boolean);
    if (!values.length) return "";
    const unique = new Set(values);
    if (unique.size === 1) return values[0];
    if (unique.has("+") && unique.has("-")) return "±";
    return "±";
  }

  function renderOperatorBadge(operator, extraClass = "") {
    if (!operator) return "";
    const label = operator === "±" ? "±" : operator;
    const className =
      operator === "+"
        ? "bg-success"
        : operator === "-"
          ? "bg-danger"
          : operator === "±"
            ? "bg-secondary"
            : operator === "*"
              ? "bg-warning text-dark"
              : operator === "/"
                ? "bg-info"
                : "bg-secondary";
    return `<span class="badge ${className} ${extraClass}">${escapeHtml(
      label,
    )}</span>`;
  }

  function buildFormulaMapBySubsection(terms = []) {
    const { sectionIndex, subsectionIndex, accountIndex } =
      buildLayoutOrderIndex();
    const sectionsMap = new Map();
    const misc = [];

    terms.forEach((term, idx) => {
      if (!term) return;
      const operator =
        term.operator && term.operator !== "" ? term.operator : "+";
      const value = (term.value || "").toString().trim();
      if (!value) return;

      if (term.type && term.type !== "account") {
        misc.push({ term, operator, order: idx });
        return;
      }

      const account = getAccountByCode(value);
      if (account && isPlaceholderAccount(account)) return;

      const principal = (account && getAccountPrincipalName(account)) || "";
      const secondary = (account && getAccountSecondaryName(account)) || "";
      const principalName = (principal || "Sin sección").toString().trim();
      const secondaryName = principal ? secondary.toString().trim() : "";

      const principalKey = normalizeKey(principalName);
      const secondaryKey = secondaryName
        ? normalizeKey(secondaryName)
        : "__NO_SUB__";
      const sectionOrder = sectionIndex.get(principalKey);

      if (!sectionsMap.has(principalKey)) {
        sectionsMap.set(principalKey, {
          name: principalName,
          order: Number.isFinite(sectionOrder) ? sectionOrder : idx + 10000,
          subsections: new Map(),
        });
      }

      const section = sectionsMap.get(principalKey);
      const subOrder =
        subsectionIndex.get(`${principalKey}||${secondaryKey}`) ??
        (Number.isFinite(sectionOrder) ? sectionOrder : idx + 10000);

      if (!section.subsections.has(secondaryKey)) {
        section.subsections.set(secondaryKey, {
          name: secondaryName,
          displayName: secondaryName || "Sin subsección",
          order: Number.isFinite(subOrder) ? subOrder : idx + 10000,
          accounts: new Map(),
          operators: new Set(),
        });
      }

      const subsection = section.subsections.get(secondaryKey);
      subsection.operators.add(operator);

      const accountKey = normalizeKey(value);
      if (!subsection.accounts.has(accountKey)) {
        const accountOrder = accountIndex.get(accountKey);
        const fallbackName =
          term.displayName && String(term.displayName).trim()
            ? String(term.displayName).trim()
            : "";
        const accountName =
          (account &&
            (account.NOMBRE ||
              account.nombre ||
              account.DESCRIPCION ||
              account.descripcion)) ||
          fallbackName ||
          "";
        subsection.accounts.set(accountKey, {
          code: value,
          name: accountName,
          order: Number.isFinite(accountOrder) ? accountOrder : idx + 10000,
          operators: new Set(),
        });
      }

      const accountEntry = subsection.accounts.get(accountKey);
      accountEntry.operators.add(operator);
    });

    const sections = Array.from(sectionsMap.values())
      .map((section) => {
        const subsections = Array.from(section.subsections.values())
          .map((subsection) => {
            const accounts = Array.from(subsection.accounts.values()).map(
              (account) => ({
                ...account,
                sign: summarizeOperatorSet(account.operators),
              }),
            );
            accounts.sort(
              (a, b) =>
                a.order - b.order ||
                a.code.localeCompare(b.code, "es", { sensitivity: "base" }),
            );
            return {
              ...subsection,
              accounts,
              sign: summarizeOperatorSet(subsection.operators),
            };
          })
          .sort(
            (a, b) =>
              a.order - b.order ||
              a.displayName.localeCompare(b.displayName, "es", {
                sensitivity: "base",
              }),
          );

        const accountCount = subsections.reduce(
          (total, sub) => total + (sub.accounts || []).length,
          0,
        );

        return { ...section, subsections, accountCount };
      })
      .sort(
        (a, b) =>
          a.order - b.order ||
          a.name.localeCompare(b.name, "es", { sensitivity: "base" }),
      );

    return { sections, misc };
  }

  function renderFormulaMapBySubsection() {
    const container = document.getElementById("formulaMap");
    if (!container) return;

    const data = buildFormulaMapBySubsection(formulaTerms);

    if (!data.sections.length && !data.misc.length) {
      container.innerHTML =
        '<div class="text-muted small fst-italic">No hay cuentas para mostrar.</div>';
      return;
    }

    const sectionsHtml = data.sections
      .map((section) => {
        const hasNamedSubsections = section.subsections.some((sub) => {
          if (!sub.name) return false;
          return normalizeKey(sub.name) !== normalizeKey(section.name);
        });
        const showSubsections =
          section.subsections.length > 1 || hasNamedSubsections;

        const accountsForSection = section.subsections.flatMap(
          (sub) => sub.accounts || [],
        );

        const accountsHtml = (accountsForSection || [])
          .map(
            (account) => `
              <div class="d-flex align-items-center gap-2 ms-4 mt-1 small">
                ${renderOperatorBadge(account.sign, "me-1")}
                <code class="mb-0">${escapeHtml(account.code)}</code>
                ${account.name
                ? `<span class="text-muted">${escapeHtml(
                  account.name,
                )}</span>`
                : ""
              }
              </div>
            `,
          )
          .join("");

        const subsectionsHtml = section.subsections
          .map((subsection) => {
            const subAccountsHtml = (subsection.accounts || [])
              .map(
                (account) => `
                  <div class="d-flex align-items-center gap-2 ms-4 mt-1 small">
                    ${renderOperatorBadge(account.sign, "me-1")}
                    <code class="mb-0">${escapeHtml(account.code)}</code>
                    ${account.name
                    ? `<span class="text-muted">${escapeHtml(
                      account.name,
                    )}</span>`
                    : ""
                  }
                  </div>
                `,
              )
              .join("");

            return `
              <div class="mb-2">
                <div class="d-flex align-items-center gap-2 fw-semibold">
                  ${renderOperatorBadge(subsection.sign, "me-1")}
                  <i class="bi bi-folder text-warning"></i>
                  <span>${escapeHtml(subsection.displayName)}</span>
                  <span class="badge bg-light text-dark">${subsection.accounts.length
              }</span>
                </div>
                ${subAccountsHtml || ""}
              </div>
            `;
          })
          .join("");

        return `
          <div class="mb-3">
            <div class="d-flex align-items-center gap-2 fw-semibold text-primary mb-1">
              <i class="bi bi-folder2"></i>
              <span>${escapeHtml(section.name)}</span>
              <span class="badge bg-light text-dark">${section.accountCount}</span>
            </div>
            <div class="ms-3">
              ${showSubsections ? subsectionsHtml : accountsHtml}
            </div>
          </div>
        `;
      })
      .join("");

    const miscHtml = data.misc.length
      ? `
        <div class="mt-3">
          <div class="fw-semibold text-muted mb-1">Otros términos</div>
          ${data.misc
        .map((item) => {
          const term = item.term || {};
          const label =
            term.type === "operation"
              ? formatOperationReference(term.value)
              : term.type === "constant"
                ? String(term.constant ?? term.value ?? "")
                : term.value || "";
          return `
                <div class="d-flex align-items-center gap-2 ms-2 small">
                  ${renderOperatorBadge(item.operator, "me-1")}
                  <span>${escapeHtml(label)}</span>
                </div>
              `;
        })
        .join("")}
        </div>
      `
      : "";

    container.innerHTML = `${sectionsHtml}${miscHtml}`;
  }

  // Renderizar los términos
  function renderFormulaTerms() {
    const container = document.getElementById("formulaTerms");
    if (!container) return;

    const accountCatalog = getAccountCatalog();

    // Ensure all terms are type "account" (migration) and have operator
    formulaTerms.forEach((term) => {
      term.type = "account";
      if (!term.operator || !["+", "-"].includes(term.operator)) {
        term.operator = "+";
      }
    });

    // Generate formula rows - ONLY account selector (no type selector)
    container.innerHTML = formulaTerms
      .map((term, idx) => {
        const isFirst = idx === 0;

        return `
      <div class="formula-term-row d-flex align-items-center gap-2 mb-2 p-2 bg-light rounded" data-id="${term.id
          }">
        <select class="form-select" style="width: 60px;" onchange="updateTermOperator(${term.id
          }, this.value)">
          <option value="+" ${term.operator === "+" ? "selected" : ""
          }>+</option>
          <option value="-" ${term.operator === "-" ? "selected" : ""
          }>−</option>
        </select>
        
        <select class="form-select flex-grow-1 account-select" onchange="updateTermValue(${term.id
          }, this.value)">
          <option value="">Seleccionar cuenta...</option>
          ${accountCatalog
            .map(
              (acc) => `
            <option value="${escapeAttr(acc.code)}" ${term.value === acc.code ? "selected" : ""
                }>
              ${escapeHtml(acc.display)}
            </option>
          `,
            )
            .join("")}
        </select>
        
        <button type="button" class="btn btn-outline-danger btn-sm" onclick="removeFormulaTerm(${term.id
          })" title="Quitar">
          <i class="bi bi-x"></i>
        </button>
      </div>
    `;
      })
      .join("");

    // Show formula preview
    updateFormulaPreview();
  }

  // Update formula preview
  function updateFormulaPreview() {
    const previewContainer =
      document.getElementById("formulaPreview") ||
      document.getElementById("formulaPreviewText");
    if (!previewContainer) {
      renderFormulaMapBySubsection();
      return;
    }

    if (formulaTerms.length === 0) {
      previewContainer.innerHTML =
        '<div class="text-muted small fst-italic">Agrega cuentas para construir la fórmula...</div>';
      return;
    }

    const preview = formulaTerms
      .map((term, i) => {
        const opSymbol = term.operator || "+";
        const operator =
          i === 0 ? (opSymbol === "-" ? "-" : "") : ` ${opSymbol} `;
        return `${operator}<code class="text-primary fw-bold">${escapeHtml(
          term.type === "operation"
            ? formatOperationReference(term.value)
            : term.value || "???",
        )}</code>`;
      })
      .join("");

    previewContainer.innerHTML = `
      <div class="alert alert-info mb-0 small">
        <strong><i class="bi bi-calculator me-1"></i>Fórmula:</strong>
        <div class="mt-1">${preview}</div>
      </div>
    `;

    renderFormulaMapBySubsection();
  }

  // Actualizar operador de término
  window.updateTermOperator = function (termId, operator) {
    const term = formulaTerms.find((t) => t.id === termId);
    if (term) {
      term.operator =
        operator && ["+", "-"].includes(operator) ? operator : "+";
      updateFormulaPreview();
    }
  };

  // Actualizar tipo de término - DEPRECATED (ahora solo cuentas)
  window.updateTermType = function (termId, newType) {
    // No-op: tipo siempre es "account" ahora
    console.warn(
      "updateTermType is deprecated - all terms are now account type",
    );
  };

  // Actualizar valor de término
  window.updateTermValue = function (termId, value) {
    const term = formulaTerms.find((t) => t.id === termId);
    if (!term) return;

    // Si es una sección, expandirla automáticamente a cuentas individuales
    if (term.type === "section" && value) {
      const sectionAccounts = getAccountsForSection(value, term.parentSection);

      if (sectionAccounts.length > 0) {
        // Encontrar el índice del término actual
        const termIndex = formulaTerms.findIndex((t) => t.id === termId);

        // Remover el término de sección
        formulaTerms.splice(termIndex, 1);

        // Agregar un término por cada cuenta de la sección
        const newTerms = sectionAccounts.map((account, idx) => ({
          id: Date.now() + idx,
          operator: term.operator, // Mantener el mismo operador
          type: "account",
          value: account.CUENTA,
          displayName: `${account.CUENTA} ${account.NOMBRE || account.CUENTA}`,
        }));

        // Insertar los nuevos términos en el mismo lugar
        formulaTerms.splice(termIndex, 0, ...newTerms);

        renderFormulaTerms();
        showToast(
          `Sección "${value}" expandida a ${sectionAccounts.length} cuentas`,
          "success",
        );
        return;
      }
    }

    // Para cuentas y operaciones, simplemente actualizar el valor
    term.value = value;
    renderFormulaMapBySubsection();
  };

  // Obtener elementos disponibles
  function getAvailableElements() {
    const sections = new Set();
    const accounts = [];
    const operationsMap = new Map();

    // Secciones/Subsecciones: desde el preview real (modo manual) para evitar
    // "secciones fantasma" por compatibilidad legacy.
    const tree = buildManualSectionTree();
    tree.forEach((section) => {
      if (section?.name) sections.add(section.name);
      (section.subsections || []).forEach((sub) => {
        if (sub?.name && sub.name !== section.name) {
          sections.add(sub.name);
        }
      });
    });

    // Cuentas (catálogo): desde cuentas reales (sin placeholders)
    const seenAccounts = new Set();
    (state.cuentas || []).forEach((c) => {
      if (!c || isPlaceholderAccount(c)) return;
      const code = (c.CUENTA || c.cuenta || c.num_cta || "").toString().trim();
      if (!code) return;
      const key = normalizeOperationMatch(code);
      if (!key || seenAccounts.has(key)) return;
      seenAccounts.add(key);
      accounts.push({
        code,
        name: (c.NOMBRE || c.nombre || code).toString().trim(),
      });
    });

    // Operaciones - identificadores unicos (excepto la que se esta editando)
    const currentOpId = getOperationId(state.selectedElement?.op);
    sortOperations(state.operaciones).forEach((op) => {
      const opId = getOperationId(op);
      if (!opId || opId === currentOpId) return;
      if (!operationsMap.has(opId)) {
        const opDisplay = getOperationDisplayName(op);
        const opLabel = getOperationLabel(op);
        operationsMap.set(opId, opDisplay || opLabel || opId);
      }
    });

    // Etiquetas generadas por filas especiales (sum-row, net-row, etc.)
    const rowLabelFields = OP_ROW_FIELDS.map((row) => row.field);

    state.operaciones.forEach((op) => {
      // Poblar operaciones con etiquetas de filas generadas
      rowLabelFields.forEach((field) => {
        const label = op[field];
        if (label && label.trim()) {
          const key = label.trim();
          if (!operationsMap.has(key)) {
            operationsMap.set(key, key);
          }
        }
      });
    });

    return {
      sections: [...sections],
      accounts,
      operations: Array.from(operationsMap, ([id, label]) => ({ id, label })),
    };
  }

  // Sugerir términos basados en el nombre de la operación
  window.suggestTermsForOperation = function () {
    const claseInput = document.getElementById("editClaseOp") || { value: "" };
    const label = claseInput.value.trim();
    if (!label) {
      showToast("Ingresa un nombre de operación primero", "warning");
      return;
    }

    const suggested = buildFormulaTermsFromParent(label);

    if (!suggested.length) {
      showToast("No se encontraron sub-secciones para este nombre", "info");
      return;
    }

    if (
      formulaTerms.length > 0 &&
      !confirm(
        "¿Reemplazar los términos actuales por las sub-secciones detectadas?",
      )
    ) {
      return;
    }

    formulaTerms = suggested;
    renderFormulaTerms();
    showToast(`Se agregaron ${formulaTerms.length} términos`, "success");
  };

  // Formula preview removed - not needed in modal

  // Construir fórmula para guardar
  function buildFormulaFromTerms() {
    return formulaTerms.map((term) => ({
      operator: term.operator,
      type: term.type,
      value: term.value,
    }));
  }

  // ==========================================
  // INIT ON LOAD
  // ==========================================
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Cache de cuentas para autocompletar
  let cuentasCache = new Map();
  let cuentasFetchTimer = null;
  let cuentasFetchToken = 0;

  // Función global para buscar cuentas dinámicamente
  window.buscarCuentasDinamicas = function (query) {
    const datalist = document.getElementById("datalistCuentas");
    if (!datalist) return;

    const raw = (query || "").toString().trim();
    if (raw.length < 1) {
      datalist.innerHTML = "";
      return;
    }

    const anioActual = new Date().getFullYear();
    const empresaId = obtenerEmpresaIdApi?.() || state.empresaId || "EMPRESA01";
    const cacheKey = `${anioActual}::${empresaId}::${raw.toLowerCase()}`;

    if (cuentasCache.has(cacheKey)) {
      const cached = cuentasCache.get(cacheKey) || [];
      datalist.innerHTML = cached
        .map(
          (c) =>
            `<option value="${c.CUENTA}" label="${c.NOMBRE || c.CUENTA}">${c.CUENTA
            } - ${c.NOMBRE || ""}</option>`,
        )
        .join("");
      return;
    }

    if (cuentasFetchTimer) {
      clearTimeout(cuentasFetchTimer);
    }

    const token = ++cuentasFetchToken;
    cuentasFetchTimer = setTimeout(async () => {
      try {
        const headers = getAuthHeaders();
        const params = new URLSearchParams({
          anio: anioActual,
          empresaId,
          q: raw,
        });
        const response = await fetch(
          `/api/cuentas-activas?${params.toString()}`,
          { headers },
        );
        if (!response.ok) {
          return;
        }
        const cuentas = await response.json();
        if (token !== cuentasFetchToken) return;
        cuentasCache.set(cacheKey, cuentas || []);
        datalist.innerHTML = (cuentas || [])
          .map(
            (c) =>
              `<option value="${c.CUENTA}" label="${c.NOMBRE || c.CUENTA}">${c.CUENTA
              } - ${c.NOMBRE || ""}</option>`,
          )
          .join("");
      } catch (err) {
        console.warn("Error al cargar cuentas:", err);
      }
    }, 200);
  };

  // ==========================================
  // BITÁCORA
  // ==========================================
  async function addToBitacora(accion, detalles) {
    try {
      await fetch(`${API_BASE}/bitacora`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          empresaId: obtenerEmpresaIdApi(),
          modulo: state.modulo,
          anio: state.anio,
          capitulo: state.capitulo,
          accion,
          detalles,
        }),
      });
    } catch (err) {
      console.warn("No se pudo registrar en bitácora:", err);
    }
  }

  // ==========================================
  // VISTA PREVIA
  // ==========================================
  function showPreview() {
    if (!state.cuentas.length) return;

    document.getElementById("previewContextInfo").textContent =
      `${state.modulo} · ${state.anio} · ${state.capitulo}`;
    const modal = new bootstrap.Modal(dom.modalPreview);
    modal.show();

    renderPreviewTable();
  }

  function renderPreviewTable() {
    if (!window.LayoutControls) {
      // Fallback si LayoutControls no está cargado
      dom.previewContainer.innerHTML = `
        <div class="alert alert-warning">
          El módulo de vista previa no está disponible. 
          Asegúrate de que layout-controls.js esté cargado.
        </div>
      `;
      return;
    }

    const layoutData = {
      modulo: state.modulo,
      anio: state.anio,
      capitulo: state.capitulo,
      cuentas: state.cuentas || [],
      operaciones: sortOperations(state.operaciones || []),
      columnasConfig: getColumnConfigForRender(),
    };

    let currentOptions = {
      showHiddenRows: false,
      showSampleData: true,
      monthsToShow: 12,
    };

    const renderWithOptions = (options) => {
      currentOptions = { ...options };
      dom.previewContainer.innerHTML =
        window.LayoutControls.renderRealisticPreview(
          layoutData,
          currentOptions,
        );
      bindPreviewControls();
      bindPreviewTableEvents();
    };

    const bindPreviewControls = () => {
      const toggleHidden = document.getElementById("toggleHidden");
      const toggleData = document.getElementById("toggleData");

      if (toggleHidden) {
        toggleHidden.addEventListener("change", (e) => {
          renderWithOptions({
            ...currentOptions,
            showHiddenRows: e.target.checked,
            showSampleData:
              toggleData?.checked ?? currentOptions.showSampleData,
          });
        });
      }

      if (toggleData) {
        toggleData.addEventListener("change", (e) => {
          renderWithOptions({
            ...currentOptions,
            showHiddenRows:
              toggleHidden?.checked ?? currentOptions.showHiddenRows,
            showSampleData: e.target.checked,
          });
        });
      }
    };

    renderWithOptions(currentOptions);
  }

  function bindPreviewTableEvents() {
    if (!dom.previewContainer) return;
    if (dom.previewContainer.dataset.previewEventsBound === "true") return;
    dom.previewContainer.dataset.previewEventsBound = "true";

    dom.previewContainer.addEventListener("click", (event) => {
      const row = event.target.closest("tr[data-row-type]");
      if (!row || !dom.previewContainer.contains(row)) return;
      const rowType = row.dataset.rowType;
      if (rowType === "operation") {
        if (!requireEditMode()) return;
        const opId = row.dataset.operationId || "";
        const label = row.dataset.operationLabel || opId;
        if (event.altKey && window.showOperationMap) {
          window.showOperationMap(opId || label);
          return;
        }
        window.editOperation?.(opId || label);
        return;
      }
      if (rowType === "account") {
        if (!requireEditMode()) return;
        const accountId = row.dataset.accountId || row.dataset.cuenta;
        if (accountId) {
          window.editAccount?.(accountId);
        }
      }
    });
  }

  // ==========================================
  // ENHANCED FEATURES - Auto-Population & Context
  // ==========================================

  /**
   * Mapa de operaciones predefinidas por capítulo y módulo
   * Cargadas dinámicamente desde el archivo JSON
   */
  let OPERACIONES_PREDEFINIDAS = {};
  const normalizeKey = (value) =>
    (value || "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "")
      .toUpperCase();

  const normalizeModuloKey = (value) => normalizeKey(value);

  const normalizeCapituloKey = (value) => {
    const base = normalizeKey(value);
    if (base === "CDMX") return "CIUDADDEMEXICO";
    if (base === "NORESTE") return "NE";
    if (base === "NOROESTE") return "NO";
    return base;
  };

  const parseCsvLines = (text) => {
    const lines = (text || "").split(/\r?\n/).filter((line) => line.trim());
    if (!lines.length) return { headerIndex: {}, rows: [] };
    const headers = lines[0].split(",").map((h) => h.trim());
    const headerIndex = {};
    headers.forEach((header, idx) => {
      const key = normalizeKey(header);
      if (key && headerIndex[key] === undefined) {
        headerIndex[key] = idx;
      }
    });
    const rows = lines
      .slice(1)
      .map((line) => line.split(",").map((col) => col.trim()));
    return { headerIndex, rows };
  };

  const getCsvValue = (cols, headerIndex, key) => {
    const idx = headerIndex[normalizeKey(key)];
    if (idx === undefined) return "";
    return (cols[idx] || "").trim();
  };

  const parseSumasSign = (value) => {
    if (!value) return 1;
    const normalized = String(value).toLowerCase();
    if (normalized.includes("resta") || normalized.includes("-")) {
      return -1;
    }
    return 1;
  };

  const resolveSumasParent = (clase, sumRowLabel) => {
    const key = normalizeKey(clase);
    if (key.startsWith("OTHERINCOME")) return "Other Income";
    if (key.startsWith("OTHER")) return "Other";
    if (key.startsWith("INCOME") || key.startsWith("EXPENSE")) {
      return sumRowLabel || "";
    }
    return sumRowLabel || "";
  };

  const mergeOperacionesMap = (base = {}, extra = {}) => {
    const merged = { ...(base || {}) };
    Object.keys(extra || {}).forEach((capitulo) => {
      merged[capitulo] = merged[capitulo] || {};
      Object.keys(extra[capitulo] || {}).forEach((modulo) => {
        const baseList = merged[capitulo][modulo] || [];
        const extraList = extra[capitulo][modulo] || [];
        merged[capitulo][modulo] = baseList.concat(extraList);
      });
    });
    return merged;
  };

  /**
   * Cargar operaciones desde el archivo JSON
   * @returns {Promise<Object>} Operaciones organizadas por capítulo y módulo
   */
  const cargarOperacionesDesdeJSON = async () => {
    try {
      const url = `${API_BASE}/operaciones-predefinidas`;
      const response = await fetch(url, { headers: getAuthHeaders() });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      if (data?.success && data?.data) {
        return data.data;
      }
    } catch (error) {
      console.warn("No se pudieron cargar operaciones predefinidas:", error);
    }
    return {};
  };

  const cargarOperacionesDesdeSumasCSV = async () => ({});

  /**
   * Inicializar operaciones predefinidas al cargar la página
   */
  let operacionesPredefinidasPromise = null;
  const ensureOperacionesPredefinidas = async () => {
    if (operacionesPredefinidasPromise) return operacionesPredefinidasPromise;
    operacionesPredefinidasPromise = Promise.all([
      cargarOperacionesDesdeJSON(),
      cargarOperacionesDesdeSumasCSV(),
    ]).then(([jsonMap, sumasMap]) => {
      OPERACIONES_PREDEFINIDAS = mergeOperacionesMap(
        jsonMap || {},
        sumasMap || {},
      );
      return OPERACIONES_PREDEFINIDAS;
    });
    return operacionesPredefinidasPromise;
  };
  if (!AUTO_OPERACIONES_DISABLED) {
    ensureOperacionesPredefinidas();
  }

  const getOperacionesPredefinidasContexto = () => {
    const capituloKey = normalizeCapituloKey(state.capitulo);
    const moduloKey = normalizeModuloKey(state.modulo);
    if (!capituloKey || !moduloKey) return [];
    return OPERACIONES_PREDEFINIDAS[capituloKey]?.[moduloKey] || [];
  };

  const normalizeOperacionKey = (value) => normalizeKey(value);

  const normalizeSectionName = (value) => {
    const key = normalizeOperacionKey(value);
    if (!key) return "";
    if (key === "INGRESO" || key === "INGRESOS") return "INCOME";
    if (
      key === "GASTO" ||
      key === "GASTOS" ||
      key === "COSTO" ||
      key === "COSTOS"
    ) {
      return "EXPENSE";
    }
    return key;
  };

  const buildKeyWithSection = (section, name) => {
    const sectionKey = normalizeSectionName(section);
    const nameRaw = (name || "").toString().trim();
    if (!sectionKey || !nameRaw) return "";
    return normalizeOperacionKey(`${sectionKey} ${nameRaw}`);
  };

  const buildOperationMatchKeys = (op) => {
    const keys = new Set();
    const push = (value) => {
      const key = normalizeOperacionKey(value);
      if (key) keys.add(key);
    };

    const clase = op?.Clase || op?.clase || "";
    const etiqueta = getOperationLabel(op);
    const display = getOperationDisplayName(op);
    const opId = getOperationId(op);
    const seccion = op?.SECCION || op?.seccion || "";

    push(clase);
    push(etiqueta);
    push(display);
    push(opId);

    if (seccion) {
      const sectionKey = buildKeyWithSection(seccion, display || etiqueta);
      if (sectionKey) keys.add(sectionKey);
    }

    const prefixMatch = String(clase || "").match(
      /^(income|expense|ingreso|gasto|costos?|cost)[-_\s]+(.+)$/i,
    );
    if (prefixMatch) {
      const prefixKey = normalizeSectionName(prefixMatch[1]);
      const rest = (prefixMatch[2] || "").trim();
      const prefixedKey = buildKeyWithSection(prefixKey, rest);
      if (prefixedKey) keys.add(prefixedKey);
    }

    return keys;
  };

  const buildPredefMatchKeys = (predef) => {
    const keys = [];
    const push = (value) => {
      const key = normalizeOperacionKey(value);
      if (key && !keys.includes(key)) keys.push(key);
    };
    if (!predef) return keys;

    const nombre = predef.nombre || predef.Nombre || "";
    const section = predef.section || predef.seccion || predef.SECCION || "";
    const sectionKey = buildKeyWithSection(section, nombre);
    if (sectionKey && !keys.includes(sectionKey)) keys.push(sectionKey);

    push(predef.id);
    push(predef.identificador);
    push(nombre);

    return keys;
  };

  const findPredefForOperation = (op, operaciones = []) => {
    if (!op || !Array.isArray(operaciones) || operaciones.length === 0) {
      return null;
    }
    const opKeys = buildOperationMatchKeys(op);
    return (
      operaciones.find((predef) =>
        buildPredefMatchKeys(predef).some((key) => opKeys.has(key)),
      ) || null
    );
  };

  const hasExplicitFormula = (op) => {
    if (!op) return false;
    const tokens = extractFormulaTokens(op);
    if (
      Array.isArray(tokens) &&
      tokens.some(
        (token) =>
          token &&
          typeof token === "object" &&
          (token.kind === FORMULA_KIND_REF ||
            token.kind === FORMULA_KIND_CONST),
      )
    ) {
      return true;
    }
    return Object.keys(op).some(
      (key) =>
        /^(seccion|operacion|cuenta)_\d+$/i.test(key) && Boolean(op[key]),
    );
  };

  const inferPredefinedTermType = (value, knownOperations) => {
    const key = normalizeOperacionKey(value);
    if (knownOperations && knownOperations.has(key)) return "operation";
    return detectTermType(value);
  };

  const parseFormulaTermsFromString = (formula, knownOperations) => {
    if (!formula || typeof formula !== "string") return [];
    const text = formula.replace(/\s+/g, " ").trim();
    const terms = [];
    let buffer = "";
    let operator = "+";
    let depth = 0;

    const pushTerm = () => {
      const value = buffer.trim();
      if (!value) return;
      terms.push({
        operator,
        type: inferPredefinedTermType(value, knownOperations),
        value,
      });
    };

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === "(") {
        depth += 1;
        continue;
      }
      if (char === ")") {
        if (depth > 0) depth -= 1;
        continue;
      }
      if (depth === 0 && "+-*/".includes(char)) {
        pushTerm();
        operator = char;
        buffer = "";
        continue;
      }
      buffer += char;
    }
    pushTerm();
    return terms;
  };

  const PLACEMENT_FIELDS = [
    "sum-row",
    "sum-row-sumavarios",
    "sum-row-sumavarios2",
    "sum-row-operativo",
    "result-row",
    "net-row",
    "result-net-row",
    "sum-row-sumavarios-consolidado",
  ];

  const normalizeTermsForCompare = (terms) =>
    (terms || []).map((term) => ({
      operator: term.operator || "+",
      type: term.type || "section",
      value: normalizeKey(term.value),
    }));

  const buildPredefinedTerms = (predef, knownOperations) => {
    if (predef?.source === "sumas") {
      const sectionName = predef.section || predef.formula || "";
      const parentSection = predef.parentSection || "";
      if (sectionName) {
        const accounts = getAccountsForSection(sectionName, parentSection);
        if (accounts.length) {
          return accounts.map((account, idx) => ({
            operator: "+",
            type: "account",
            value: account.CUENTA,
            id: Date.now() + idx,
          }));
        }
        return [
          {
            operator: "+",
            type: "section",
            value: sectionName,
            parentSection,
          },
        ];
      }
    }
    const parsed = parseFormulaTermsFromString(predef.formula, knownOperations);
    if (parsed.length) return parsed;
    if (predef.formula) {
      return [{ operator: "+", type: "section", value: predef.formula }];
    }
    return [];
  };

  const formulasMatch = (op, desiredTerms) => {
    const current = normalizeTermsForCompare(extractFormulaTerms(op));
    const desired = normalizeTermsForCompare(desiredTerms);
    if (current.length !== desired.length) return false;
    for (let i = 0; i < current.length; i += 1) {
      if (
        current[i].operator !== desired[i].operator ||
        current[i].type !== desired[i].type ||
        current[i].value !== desired[i].value
      ) {
        return false;
      }
    }
    return true;
  };

  const expandSectionTerms = (terms) => {
    const expanded = [];
    (terms || []).forEach((term) => {
      if (term.type === "section" && term.value) {
        const accounts = getAccountsForSection(term.value, term.parentSection);
        if (accounts.length > 0) {
          accounts.forEach((account, index) => {
            expanded.push({
              operator: term.operator,
              type: "account",
              value: account.CUENTA,
              id: Date.now() + expanded.length + index,
            });
          });
        } else {
          expanded.push(term);
        }
        return;
      }
      expanded.push(term);
    });
    return expanded;
  };

  const applyFormulaTermsToOperation = (op, terms) => {
    if (!op) return false;
    const normalized = normalizeFormulaTerms(terms);
    if (!normalized.length) return false;
    const tokens = convertLegacyTermsToV2Tokens(normalized, op);
    applyStrictFormulaTermsToOperation(op, normalized, tokens);
    return true;
  };

  const applyPredefinedPlacement = (op, predef, { force = false } = {}) => {
    if (!op || !predef) return false;
    const placementLabels = predef.placementLabels || null;
    const placementSigns = predef.placementSigns || predef.signos || {};
    const placements =
      placementLabels && Object.keys(placementLabels).length
        ? Object.keys(placementLabels)
        : Array.isArray(predef.aparece) && predef.aparece.length
          ? predef.aparece
          : ["sum-row"];
    let changed = false;

    if (force) {
      PLACEMENT_FIELDS.forEach((fieldName) => {
        if (op[fieldName]) {
          delete op[fieldName];
          changed = true;
        }
      });
    }

    placements.forEach((fieldName) => {
      const label = placementLabels?.[fieldName] || predef.nombre;
      if (!op[fieldName] || force) {
        op[fieldName] = label;
        changed = true;
      }
      const signo = placementSigns?.[fieldName];
      if (Number.isFinite(Number(signo))) {
        if (!op.signos) op.signos = {};
        op.signos[fieldName] = Number(signo);
      }
    });

    return changed;
  };

  const createOperationFromPredefined = (
    predef,
    orderIndex,
    knownOperations,
  ) => {
    const opId = buildUniqueOperationId(
      predef.id || predef.identificador || predef.nombre,
    );
    const orderValue = Number.isFinite(predef.orden)
      ? predef.orden
      : orderIndex;
    const resolvedSection =
      predef.section || (predef.source === "sumas" ? predef.formula : "") || "";
    const parentSubsection = resolvedSection || null;
    const parentSection = predef.parentSection || null;
    const op = {
      CAPITULO: state.capitulo || "DEFAULT",
      OperacionId: opId,
      Clase: predef.nombre,
      SECCION: resolvedSection,
      tipo: "predefined",
      signos: {},
      orden: Number.isFinite(orderValue) ? orderValue : nextOperationOrder(),
      secciones: parentSubsection ? [parentSubsection] : [],
      parentSubsection,
      parentSection,
    };

    applyPredefinedPlacement(op, predef);

    const termsToApply = buildPredefinedTerms(predef, knownOperations);
    applyFormulaTermsToOperation(op, termsToApply);

    return op;
  };

  const applyPredefinedToExisting = (
    op,
    predef,
    orderIndex,
    knownOperations,
    { force = false } = {},
  ) => {
    let changed = false;
    const existingPlacement = (
      op?.SECCION ||
      op?.seccion ||
      op?.parentSubsection ||
      op?.parentSection ||
      ""
    )
      .toString()
      .trim();
    const canUpdateSection = Boolean(force) || !existingPlacement;
    const orderValue = Number.isFinite(predef.orden)
      ? predef.orden
      : orderIndex;
    const resolvedSection =
      predef.section || (predef.source === "sumas" ? predef.formula : "") || "";
    const parentSubsection = resolvedSection || null;
    const parentSection = predef.parentSection || null;

    if (!op.CAPITULO && state.capitulo) {
      op.CAPITULO = state.capitulo;
      changed = true;
    }

    if (Number.isFinite(orderValue) && op.orden !== orderValue) {
      op.orden = orderValue;
      changed = true;
    }

    if (
      parentSubsection &&
      canUpdateSection &&
      (force || op.parentSubsection !== parentSubsection)
    ) {
      op.parentSubsection = parentSubsection;
      changed = true;
    }

    if (
      parentSection &&
      canUpdateSection &&
      (force || op.parentSection !== parentSection)
    ) {
      op.parentSection = parentSection;
      changed = true;
    }

    if (
      parentSubsection &&
      canUpdateSection &&
      (!Array.isArray(op.secciones) || force)
    ) {
      op.secciones = [parentSubsection];
      changed = true;
    }

    // FIXED: Prevent overwriting existing formulas with predefined ones, unless forced.
    // This allows user customizations (like "INCOME = MEMBERSHIP") to persist.
    const hasExistingFormula = hasExplicitFormula(op);
    const desiredTerms = buildPredefinedTerms(predef, knownOperations);
    const formulaIsSame = desiredTerms.length
      ? formulasMatch(op, desiredTerms)
      : true;

    if ((force || (!hasExistingFormula && !formulaIsSame)) && desiredTerms.length) {
      if (applyFormulaTermsToOperation(op, desiredTerms)) {
        changed = true;
      }
    }

    if (resolvedSection && canUpdateSection) {
      op.SECCION = resolvedSection;
      changed = true;
    }

    if (applyPredefinedPlacement(op, predef, { force })) {
      changed = true;
    }

    return changed;
  };

  async function syncOperacionesPredefinidas({
    autoCreate = true,
    force = false,
  } = {}) {
    await ensureOperacionesPredefinidas();
    const operaciones = getOperacionesPredefinidasContexto();
    if (!operaciones.length) return { added: 0, updated: 0 };

    const existingByKey = new Map();
    const registerExisting = (op) => {
      if (!op) return;
      buildOperationMatchKeys(op).forEach((key) => {
        if (!key) return;
        const list = existingByKey.get(key) || [];
        if (!list.includes(op)) {
          list.push(op);
          existingByKey.set(key, list);
        }
      });
    };
    (state.operaciones || []).forEach(registerExisting);

    const findExistingForPredef = (predef) => {
      const keys = buildPredefMatchKeys(predef);
      for (const key of keys) {
        const list = existingByKey.get(key);
        if (!list || list.length === 0) continue;
        if (list.length === 1) return list[0];

        const nameKey = normalizeOperacionKey(predef?.nombre || "");
        const byName = list.find(
          (op) =>
            normalizeOperacionKey(getOperationLabel(op)) === nameKey ||
            normalizeOperacionKey(getOperationDisplayName(op)) === nameKey,
        );
        if (byName) return byName;

        const sectionKey = normalizeSectionName(
          predef?.section || predef?.seccion || "",
        );
        if (sectionKey) {
          const bySection = list.find(
            (op) =>
              normalizeSectionName(op?.SECCION || op?.seccion || "") ===
              sectionKey,
          );
          if (bySection) return bySection;
        }

        return list[0];
      }
      return null;
    };

    const knownOperations = new Set();
    operaciones.forEach((op) => {
      if (op?.nombre) knownOperations.add(normalizeOperacionKey(op.nombre));
      if (op?.id) knownOperations.add(normalizeOperacionKey(op.id));
      if (op?.identificador)
        knownOperations.add(normalizeOperacionKey(op.identificador));
    });

    let added = 0;
    let updated = 0;

    operaciones.forEach((predef, idx) => {
      const orderIndex = Number.isFinite(predef.orden) ? predef.orden : idx;
      const existing = findExistingForPredef(predef);
      if (!existing) {
        if (!autoCreate) return;
        const newOp = createOperationFromPredefined(
          predef,
          orderIndex,
          knownOperations,
        );
        state.operaciones.push(newOp);
        registerExisting(newOp);
        added += 1;
        return;
      }

      if (
        applyPredefinedToExisting(
          existing,
          predef,
          orderIndex,
          knownOperations,
          {
            force,
          },
        )
      ) {
        updated += 1;
      }
    });

    if (added || updated) {
      state.operaciones = sortOperations(state.operaciones);
      ensureOperationIds();
      // normalizeOperationReferences(); // DESACTIVADO: modo 100% manual
      state.unsavedChanges = true;
      updateButtonStates();
    }

    return { added, updated };
  }

  /**
   * Cargar operaciones predefinidas para el contexto actual
   * Muestra una lista de operaciones sugeridas y permite poblarlas automáticamente
   */
  window.cargarOperacionesPredefinidas = async function () {
    if (AUTO_OPERACIONES_DISABLED) {
      showToast("Operaciones predefinidas deshabilitadas", "warning");
      return;
    }
    if (!requireEditMode()) return;
    if (!state.capitulo || !state.modulo) {
      showToast("Selecciona un capítulo y módulo primero", "warning");
      return;
    }

    await ensureOperacionesPredefinidas();
    const operaciones = getOperacionesPredefinidasContexto();

    if (operaciones.length === 0) {
      showToast(
        `No hay operaciones predefinidas para ${state.modulo} en ${state.capitulo}`,
        "info",
      );
      return;
    }

    // Mostrar modal con las operaciones disponibles
    const modal = document.createElement("div");
    modal.className = "modal fade";
    modal.innerHTML = `
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header bg-primary text-white">
            <h5 class="modal-title">
              <i class="bi bi-magic me-2"></i>Operaciones Predefinidas
            </h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="alert alert-info">
              <i class="bi bi-info-circle me-2"></i>
              Se encontraron <strong>${operaciones.length
      } operaciones</strong> predefinidas para 
              <strong>${state.modulo}</strong> en <strong>${state.capitulo
      }</strong>
            </div>
            <div class="list-group">
              ${operaciones
        .map(
          (op, idx) => `
                <div class="list-group-item">
                  <div class="d-flex align-items-center justify-content-between">
                    <div>
                      <h6 class="mb-1">${escapeHtml(op.nombre)}</h6>
                      <small class="text-muted"><code>${escapeHtml(
            op.formula,
          )}</code></small>
                    </div>
                    <button class="btn btn-sm btn-outline-primary" onclick="window.poblarOperacion(${idx})">
                      <i class="bi bi-plus-circle me-1"></i>Agregar
                    </button>
                  </div>
                </div>
              `,
        )
        .join("")}
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class= "btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
            <button type="button" class="btn btn-primary" onclick="window.poblarTodasOperaciones()">
              <i class="bi bi-magic me-1"></i>Poblar Todas
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();

    modal.addEventListener("hidden.bs.modal", () => {
      document.body.removeChild(modal);
    });
  };

  /**
   * Poblar una operación específica
   */
  window.poblarOperacion = async function (index) {
    if (AUTO_OPERACIONES_DISABLED) {
      showToast("Operaciones predefinidas deshabilitadas", "warning");
      return;
    }
    if (!requireEditMode()) return;
    await ensureOperacionesPredefinidas();
    const operaciones = getOperacionesPredefinidasContexto();
    const op = operaciones[index];
    if (!op) return;

    const knownOperations = new Set();
    operaciones.forEach((item) => {
      if (item?.nombre) knownOperations.add(normalizeOperacionKey(item.nombre));
      if (item?.id) knownOperations.add(normalizeOperacionKey(item.id));
      if (item?.identificador)
        knownOperations.add(normalizeOperacionKey(item.identificador));
    });
    const orderIndex = Number.isFinite(op.orden) ? op.orden : index;
    const newOp = createOperationFromPredefined(
      op,
      orderIndex,
      knownOperations,
    );

    state.operaciones.push(newOp);
    state.operaciones = sortOperations(state.operaciones);
    ensureOperationIds();
    // normalizeOperationReferences(); // DESACTIVADO: modo 100% manual
    state.unsavedChanges = true;
    updateButtonStates();
    renderLayout();
    showToast(`Operación "${op.nombre}" agregada`, "success");
  };

  /**
   * Poblar todas las operaciones predefinidas
   */
  window.poblarTodasOperaciones = async function () {
    if (AUTO_OPERACIONES_DISABLED) {
      showToast("Operaciones predefinidas deshabilitadas", "warning");
      return;
    }
    if (!requireEditMode()) return;
    const result = await syncOperacionesPredefinidas({
      autoCreate: true,
      force: true,
    });

    renderLayout();
    bootstrap.Modal.getInstance(document.querySelector(".modal.show"))?.hide();
    showToast(`${result.added} operaciones agregadas`, "success");
  };

  /**
   * Actualizar elementos disponibles desde el orden de la tabla
   * Recorre la preview table y extrae elementos en orden DOM
   */
  window.updateAvailableElementsFromTable = function (
    tableSelector = "#layoutPreview",
  ) {
    const container =
      document.querySelector(tableSelector) || dom.layoutPreview;
    if (!container) return [];

    const availableElements = {
      sections: [],
      accounts: [],
      operations: [],
      orderedLabels: [], // Orden exacto como aparece visualmente
    };

    const orderedLabelKeys = new Set();
    const sectionKeys = new Set();
    const accountKeys = new Set();
    const operationKeys = new Set();

    const pushOrderedLabel = (label) => {
      const key = normalizeOperationMatch(label);
      if (!key || orderedLabelKeys.has(key)) return;
      orderedLabelKeys.add(key);
      availableElements.orderedLabels.push(label);
    };

    const registerSection = (label) => {
      const key = normalizeOperationMatch(label);
      if (!key || sectionKeys.has(key)) return;
      sectionKeys.add(key);
      availableElements.sections.push(label);
      pushOrderedLabel(label);
    };

    const registerAccount = (code, name) => {
      const key = normalizeOperationMatch(code);
      if (!key || accountKeys.has(key)) return;
      accountKeys.add(key);
      availableElements.accounts.push({ code, name: name || code });
      pushOrderedLabel(code);
    };

    const registerOperation = (id, label) => {
      const value = id || label;
      const key = normalizeOperationMatch(value);
      if (!key || operationKeys.has(key)) return;
      operationKeys.add(key);
      availableElements.operations.push({
        id: id || label,
        label: label || id,
      });
    };

    // Extraer de secciones renderizadas
    container
      .querySelectorAll(".section-header .section-title > span:not(.badge)")
      .forEach((el) => {
        const text = el.textContent.trim();
        if (text) registerSection(text);
      });

    // Extraer de subsecciones renderizadas
    container
      .querySelectorAll(
        ".subsection-header .subsection-title > span:not(.badge)",
      )
      .forEach((el) => {
        const text = el.textContent.trim();
        if (text) registerSection(text);
      });

    // Extraer de cuentas renderizadas
    container.querySelectorAll(".account-row").forEach((row) => {
      const code = row.querySelector(".account-code")?.textContent?.trim();
      const name = row.querySelector(".account-name")?.textContent?.trim();
      if (code) registerAccount(code, name);
    });

    // Extraer de operaciones renderizadas
    container
      .querySelectorAll(
        ".operation-row, .inline-operation-row, .operation-card",
      )
      .forEach((row) => {
        const opId = row.getAttribute("data-operation-id")?.trim();
        const opLabel =
          row.getAttribute("data-operation-label")?.trim() ||
          row.querySelector(".operation-label span")?.textContent?.trim() ||
          row.querySelector(".op-name")?.textContent?.trim() ||
          "";
        const label = opLabel || opId;
        if (label) pushOrderedLabel(label);
        registerOperation(opId || label, label);
      });

    // Extraer desde tabla de plantilla (piloto)
    container
      .querySelectorAll(".template-table tr[data-row-type]")
      .forEach((row) => {
        const rowType = row.dataset.rowType;
        if (rowType === "section") {
          const label = row.dataset.section || row.textContent.trim();
          if (label) registerSection(label);
          return;
        }
        if (rowType === "subsection") {
          const label = row.dataset.subsection || row.textContent.trim();
          if (label) registerSection(label);
          return;
        }
        if (rowType === "account") {
          const code =
            row.dataset.cuenta ||
            row.querySelector(".account-code")?.textContent?.trim() ||
            "";
          const name =
            row.dataset.nombre ||
            row.querySelector(".account-name")?.textContent?.trim() ||
            "";
          if (code) registerAccount(code, name);
          return;
        }
        if (rowType === "operation") {
          const opId = row.dataset.operationId || "";
          const label = row.dataset.operationLabel || opId;
          if (label) pushOrderedLabel(label);
          if (opId || label) registerOperation(opId || label, label);
        }
      });

    // Asegurar orden completo segun la lista de operaciones
    sortOperations(state.operaciones || []).forEach((op) => {
      const opId = getOperationId(op);
      const opLabel =
        getOperationDisplayName(op) || getOperationLabel(op) || opId;
      if (opLabel) pushOrderedLabel(opLabel);
      if (opId || opLabel) registerOperation(opId || opLabel, opLabel || opId);
    });

    // Actualizar FormulaBuilder si existe
    if (
      window.FormulaBuilder &&
      typeof window.FormulaBuilder.updateAvailableTerms === "function"
    ) {
      window.FormulaBuilder.updateAvailableTerms(
        availableElements.orderedLabels,
      );
    }

    return availableElements;
  };

  /**
   * Guardar contexto actual en URL params
   */
  function saveContextToURL() {
    if (!window.history?.pushState) return;

    const params = new URLSearchParams();
    if (state.modulo) params.set("module", state.modulo);
    if (state.capitulo) params.set("chapter", state.capitulo);
    if (state.anio) params.set("year", state.anio);
    if (state.empresaId) params.set("empresa", state.empresaId);

    const newURL = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({ path: newURL }, "", newURL);
  }

  /**
   * Cargar contexto desde URL params
   */
  function loadContextFromURL() {
    const params = new URLSearchParams(window.location.search);

    const module = params.get("module");
    const chapter = params.get("chapter");
    const year = params.get("year");
    const empresa = params.get("empresa");

    if (module && dom.moduloSelect) {
      dom.moduloSelect.value = module;
      state.modulo = module;
    }

    if (chapter && dom.capituloSelect) {
      dom.capituloSelect.value = chapter;
      state.capitulo = chapter;
    }

    if (empresa) {
      state.empresaId = resolverEmpresaConfigKey(empresa) || empresa;
    }

    if (year && dom.anioSelect) {
      dom.anioSelect.value = year;
      state.anio = parseInt(year);
    }

    if (module || chapter || year) {
      if (state.capitulo) {
        asegurarEmpresaIdContexto(state.capitulo, true);
      }
      updateHeaderLabels();
      tryLoadLayout();
    }
  }

  // ==========================================
  // IMPORTACIÓN/EXPORTACIÓN MASIVA
  // ==========================================

  function descargarPlantillaImportacion() {
    const plantilla = {
      _instrucciones: {
        descripcion:
          "Plantilla para importación masiva de elementos al Gestor de Plantillas",
        contexto: `${state.modulo} - ${state.anio} - ${state.capitulo}`,
        formato:
          "Llena las secciones, subsecciones, cuentas y operaciones, luego importa este archivo",
        campos_obligatorios: {
          secciones: ["nombre"],
          subsecciones: ["nombre", "seccion_principal"],
          cuentas: [
            "cuenta",
            "nombre",
            "seccion_principal",
            "seccion_secundaria",
            "valor_plantilla",
          ],
          operaciones: ["operacion_id", "clase", "formula_json"],
        },
      },
      secciones: extractSecciones(),
      subsecciones: extractSubsecciones(),
      cuentas: extractCuentas(),
      operaciones: extractOperaciones(),
      _notas: {
        formula_formato:
          "Soporta fórmula de texto (+,-,*,/,paréntesis) y formula_json v2 con tokens por refId interno.",
        estilo_fila_opciones: [
          "sum-row",
          "sum-row-principal",
          "highlight-primary",
          "highlight-secondary",
          "highlight-bright",
          "subsection-row",
          "operation-row",
        ],
        tipo_operacion_opciones: [
          "libre",
          "seccion",
          "subseccion",
          "consolidacion",
        ],
      },
    };

    const json = JSON.stringify(plantilla, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `plantilla_${state.modulo}_${state.anio}_${state.capitulo}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(
      "✅ Plantilla descargada. Ábrela en Excel o editor de texto, llena los datos e importa.",
      "success",
    );
  }

  function extractSecciones() {
    const secciones = new Set();
    state.cuentas.forEach((c) => {
      const seccion = getAccountPrincipalName(c);
      if (seccion) secciones.add(seccion);
    });
    return Array.from(secciones).map((nombre) => ({ nombre, descripcion: "" }));
  }

  function extractSubsecciones() {
    const subsecciones = [];
    const seen = new Set();
    state.cuentas.forEach((c) => {
      const principal = getAccountPrincipalName(c);
      const secundaria = getAccountSecondaryName(c);
      if (principal && secundaria) {
        const key = `${principal}|${secundaria}`;
        if (!seen.has(key)) {
          seen.add(key);
          subsecciones.push({
            nombre: secundaria,
            seccion_principal: principal,
            descripcion: "",
          });
        }
      }
    });
    return subsecciones;
  }

  function extractCuentas() {
    return state.cuentas.map((c) => ({
      cuenta: c.CUENTA || c.cuenta || "",
      nombre: c.NOMBRE || c.nombre || "",
      seccion_principal: getAccountPrincipalName(c) || "",
      seccion_secundaria: getAccountSecondaryName(c) || "",
      visible: c.visible !== false,
      capturable: c.capturable !== false,
      tipo_saldo: c.TIPO_SALDO || c.tipo_saldo || "Deudor",
      factor: Number.isFinite(Number(c.operacion_factor ?? c.factor))
        ? Number(c.operacion_factor ?? c.factor)
        : 1,
      valor_plantilla: Number.isFinite(Number(c.valor_plantilla))
        ? Number(c.valor_plantilla)
        : 0,
    }));
  }

  function extractOperaciones() {
    return (state.operaciones || [])
      .filter((op) => !isColumnConfigOperation(op))
      .map((op) => {
        const formulaTokens = extractFormulaTokens(op);
        const formulaStr = formatFormula(op || {});

        return {
          operacion_id: getOperationId(op) || "",
          clase: getOperationDisplayName(op) || "",
          seccion: op.SECCION || "",
          subseccion: op.parentSubsection || "",
          tipo_operacion: op.tipo_operacion || "libre",
          formula: formulaStr,
          formula_json: serializeFormulaV2(formulaTokens),
          estilo_fila: op.rowStyle || op.estilo_fila || "operation-row",
          visible: op.visible !== false,
          descripcion: "",
        };
      });
  }

  const normalizeImportHeader = (value) =>
    (value || "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/gi, "")
      .toLowerCase();

  const toImportBoolean = (value, fallback = true) => {
    if (value === undefined || value === null || value === "") return fallback;
    if (typeof value === "boolean") return value;
    const text = String(value).trim().toLowerCase();
    if (!text) return fallback;
    if (["1", "true", "si", "sí", "yes", "y", "ok", "on"].includes(text)) {
      return true;
    }
    if (["0", "false", "no", "n", "off"].includes(text)) {
      return false;
    }
    return fallback;
  };

  const toImportNumber = (value, fallback = NaN) => {
    if (value === undefined || value === null || value === "") return fallback;
    const normalized =
      typeof value === "string" ? value.replace(/,/g, "").trim() : value;
    if (normalized === "") return fallback;
    const num = Number(normalized);
    return Number.isFinite(num) ? num : fallback;
  };

  const normalizeImportRow = (row = {}) => {
    const normalized = {};
    Object.entries(row || {}).forEach(([rawKey, value]) => {
      const key = normalizeImportHeader(rawKey);
      if (!key) return;
      normalized[key] = value;
    });
    return normalized;
  };

  const pickImportValue = (normalizedRow = {}, candidates = []) => {
    for (const rawKey of candidates) {
      const key = normalizeImportHeader(rawKey);
      if (!key) continue;
      if (!Object.prototype.hasOwnProperty.call(normalizedRow, key)) continue;
      const value = normalizedRow[key];
      if (value === undefined || value === null) continue;
      const text = typeof value === "string" ? value.trim() : value;
      if (text === "") continue;
      return text;
    }
    return "";
  };

  const normalizeImportSecciones = (rows = []) =>
    (Array.isArray(rows) ? rows : [])
      .map((row) => normalizeImportRow(row))
      .map((row) => ({
        nombre: String(
          pickImportValue(row, [
            "nombre",
            "seccion",
            "section",
            "seccionprincipal",
          ]),
        ).trim(),
        descripcion: String(
          pickImportValue(row, ["descripcion", "description"]),
        ).trim(),
      }))
      .filter((row) => row.nombre);

  const normalizeImportSubsecciones = (rows = []) =>
    (Array.isArray(rows) ? rows : [])
      .map((row) => normalizeImportRow(row))
      .map((row) => ({
        nombre: String(
          pickImportValue(row, ["nombre", "subseccion", "subsection"]),
        ).trim(),
        seccion_principal: String(
          pickImportValue(row, [
            "seccion_principal",
            "seccionprincipal",
            "principal",
            "seccion",
            "section",
          ]),
        ).trim(),
        descripcion: String(
          pickImportValue(row, ["descripcion", "description"]),
        ).trim(),
      }))
      .filter((row) => row.nombre && row.seccion_principal);

  const normalizeImportCuentas = (rows = []) =>
    (Array.isArray(rows) ? rows : [])
      .map((row) => normalizeImportRow(row))
      .map((row) => ({
        cuenta: String(
          pickImportValue(row, ["cuenta", "codigo", "account", "accountcode"]),
        ).trim(),
        nombre: String(
          pickImportValue(row, ["nombre", "descripcion", "name", "label"]),
        ).trim(),
        seccion_principal: String(
          pickImportValue(row, [
            "seccion_principal",
            "seccionprincipal",
            "principal",
            "seccion",
            "section",
          ]),
        ).trim(),
        seccion_secundaria: String(
          pickImportValue(row, [
            "seccion_secundaria",
            "seccionsecundaria",
            "subseccion",
            "subsection",
            "secundaria",
          ]),
        ).trim(),
        visible: toImportBoolean(
          pickImportValue(row, ["visible", "show", "enabled"]),
          true,
        ),
        capturable: toImportBoolean(
          pickImportValue(row, ["capturable", "capture", "editable"]),
          true,
        ),
        tipo_saldo:
          String(
            pickImportValue(row, [
              "tipo_saldo",
              "tiposaldo",
              "saldo",
              "typesaldo",
            ]),
          ).trim() || "Deudor",
        factor: toImportNumber(
          pickImportValue(row, ["factor", "operacion_factor", "signo", "sign"]),
        ),
        valor_plantilla: toImportNumber(
          pickImportValue(row, [
            "valor_plantilla",
            "valorplantilla",
            "valor_template",
            "valor",
          ]),
        ),
      }))
      .filter((row) => row.cuenta);

  const normalizeImportOperaciones = (rows = []) =>
    (Array.isArray(rows) ? rows : [])
      .map((row) => normalizeImportRow(row))
      .map((row) => ({
        operacion_id: String(
          pickImportValue(row, [
            "operacion_id",
            "operacionid",
            "id",
            "operationid",
          ]),
        ).trim(),
        clase: String(
          pickImportValue(row, ["clase", "nombre", "label", "name"]),
        ).trim(),
        seccion: String(
          pickImportValue(row, ["seccion", "section", "seccion_principal"]),
        ).trim(),
        subseccion: String(
          pickImportValue(row, [
            "subseccion",
            "subsection",
            "seccion_secundaria",
          ]),
        ).trim(),
        tipo_operacion:
          String(
            pickImportValue(row, ["tipo_operacion", "tipo", "operationtype"]),
          ).trim() || "libre",
        formula: String(
          pickImportValue(row, ["formula", "expresion", "expression"]),
        ).trim(),
        formula_terms: pickImportValue(row, ["formula_terms", "formulaterms"]),
        formula_json: pickImportValue(row, ["formula_json", "formulajson"]),
        estilo_fila:
          String(
            pickImportValue(row, ["estilo_fila", "estilofila", "rowstyle"]),
          ).trim() || "operation-row",
        visible: toImportBoolean(
          pickImportValue(row, ["visible", "show", "enabled"]),
          true,
        ),
      }))
      .filter(
        (row) => row.operacion_id || row.clase || row.seccion || row.subseccion,
      );

  const parseSheetRows = (workbook, sheetName) => {
    if (!workbook || !sheetName) return [];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet || !window.XLSX?.utils?.sheet_to_json) return [];
    return window.XLSX.utils.sheet_to_json(sheet, { defval: "" });
  };

  const findSheetByAliases = (sheetNames = [], aliases = []) => {
    const aliasSet = new Set(
      aliases.map((alias) => normalizeImportHeader(alias)),
    );
    return (
      (sheetNames || []).find((name) =>
        aliasSet.has(normalizeImportHeader(name)),
      ) || null
    );
  };

  const parseExcelImportPayload = async (file) => {
    if (!window.XLSX) {
      throw new Error(
        "No se encontró la librería XLSX en esta vista. Recarga la página e intenta de nuevo.",
      );
    }

    const buffer = await file.arrayBuffer();
    const workbook = window.XLSX.read(buffer, { type: "array" });
    const sheetNames = Array.isArray(workbook?.SheetNames)
      ? workbook.SheetNames
      : [];
    if (!sheetNames.length) {
      throw new Error("El archivo Excel no contiene hojas.");
    }

    const seccionesSheet = findSheetByAliases(sheetNames, [
      "secciones",
      "seccion",
      "sections",
    ]);
    const subseccionesSheet = findSheetByAliases(sheetNames, [
      "subsecciones",
      "subseccion",
      "subsections",
    ]);
    const cuentasSheet = findSheetByAliases(sheetNames, [
      "cuentas",
      "cuenta",
      "accounts",
    ]);
    const operacionesSheet = findSheetByAliases(sheetNames, [
      "operaciones",
      "operacion",
      "operations",
    ]);

    if (
      seccionesSheet ||
      subseccionesSheet ||
      cuentasSheet ||
      operacionesSheet
    ) {
      return {
        secciones: normalizeImportSecciones(
          parseSheetRows(workbook, seccionesSheet),
        ),
        subsecciones: normalizeImportSubsecciones(
          parseSheetRows(workbook, subseccionesSheet),
        ),
        cuentas: normalizeImportCuentas(parseSheetRows(workbook, cuentasSheet)),
        operaciones: normalizeImportOperaciones(
          parseSheetRows(workbook, operacionesSheet),
        ),
      };
    }

    // Fallback: una sola hoja con columna "tipo".
    const rows = parseSheetRows(workbook, sheetNames[0]).map((row) =>
      normalizeImportRow(row),
    );
    const grouped = {
      secciones: [],
      subsecciones: [],
      cuentas: [],
      operaciones: [],
    };

    rows.forEach((row) => {
      const tipo = normalizeImportHeader(
        pickImportValue(row, ["tipo", "type", "elemento"]),
      );
      if (!tipo) return;
      if (
        tipo.includes("seccionprincipal") ||
        tipo === "seccion" ||
        tipo === "section"
      ) {
        grouped.secciones.push(row);
        return;
      }
      if (tipo.includes("subseccion") || tipo.includes("subsection")) {
        grouped.subsecciones.push(row);
        return;
      }
      if (tipo.includes("cuenta") || tipo.includes("account")) {
        grouped.cuentas.push(row);
        return;
      }
      if (tipo.includes("operacion") || tipo.includes("operation")) {
        grouped.operaciones.push(row);
      }
    });

    return {
      secciones: normalizeImportSecciones(grouped.secciones),
      subsecciones: normalizeImportSubsecciones(grouped.subsecciones),
      cuentas: normalizeImportCuentas(grouped.cuentas),
      operaciones: normalizeImportOperaciones(grouped.operaciones),
    };
  };

  const parseImportPayloadFromFile = async (file) => {
    const fileName = (file?.name || "").toLowerCase();
    if (fileName.endsWith(".json")) {
      const text = await file.text();
      const raw = JSON.parse(text);
      return {
        secciones: normalizeImportSecciones(raw?.secciones),
        subsecciones: normalizeImportSubsecciones(raw?.subsecciones),
        cuentas: normalizeImportCuentas(raw?.cuentas),
        operaciones: normalizeImportOperaciones(raw?.operaciones),
      };
    }
    if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      return parseExcelImportPayload(file);
    }
    throw new Error("Formato no soportado. Usa JSON o Excel (.xlsx/.xls).");
  };

  const parseImportedFormulaPayload = (op = {}) => {
    const termsFromInput = Array.isArray(op.formula_terms)
      ? op.formula_terms
      : (() => {
        if (
          typeof op.formula_terms !== "string" ||
          !op.formula_terms.trim()
        ) {
          return [];
        }
        try {
          const parsedTerms = JSON.parse(op.formula_terms);
          return Array.isArray(parsedTerms) ? parsedTerms : [];
        } catch (_) {
          return [];
        }
      })();
    if (termsFromInput.length) {
      const terms = normalizeFormulaTerms(termsFromInput);
      return {
        terms,
        tokens: convertLegacyTermsToV2Tokens(terms, op),
      };
    }
    if (op.formula_json) {
      try {
        const parsed = JSON.parse(String(op.formula_json));
        if (isFormulaV2Object(parsed)) {
          const tokens = Array.isArray(parsed.tokens) ? parsed.tokens : [];
          const terms = normalizeFormulaTerms(
            convertV2TokensToLegacyTerms(tokens),
          );
          return { terms, tokens };
        }
        if (Array.isArray(parsed) && parsed.length) {
          const terms = normalizeFormulaTerms(parsed);
          return {
            terms,
            tokens: convertLegacyTermsToV2Tokens(terms, op),
          };
        }
      } catch (_) {
        // fallback a fórmula texto
      }
    }
    if (op.formula) {
      const parsed = parseFormulaExpressionV2(op.formula, {
        parentSection: op.seccion || "",
        defaultParentSection: op.seccion || "",
      });
      if (parsed.valid) {
        return {
          terms: normalizeFormulaTerms(parsed.terms || []),
          tokens: Array.isArray(parsed.tokens) ? parsed.tokens : [],
        };
      }
      return { terms: [], tokens: [] };
    }
    return { terms: [], tokens: [] };
  };

  const ensureSectionPath = (principal = "", secundaria = "") => {
    const principalClean = (principal || "").toString().trim();
    const secundariaClean = (secundaria || "").toString().trim();
    if (!principalClean) return;
    addPrincipalSectionByName(principalClean, { silent: true });
    if (secundariaClean) {
      addSecondarySectionByName(principalClean, secundariaClean, {
        silent: true,
      });
    }
  };

  async function importarDesdeArchivo(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const data = await parseImportPayloadFromFile(file);

      if (
        !data.secciones &&
        !data.subsecciones &&
        !data.cuentas &&
        !data.operaciones
      ) {
        showToast(
          "⚠️ El archivo no tiene el formato correcto. Descarga la plantilla primero.",
          "warning",
        );
        return;
      }

      const confirmMsg =
        `¿Importar datos desde ${file.name}?\n\nSe agregarán:\n` +
        `- ${(data.secciones || []).length} secciones\n` +
        `- ${(data.subsecciones || []).length} subsecciones\n` +
        `- ${(data.cuentas || []).length} cuentas\n` +
        `- ${(data.operaciones || []).length} operaciones`;

      if (!confirm(confirmMsg)) {
        event.target.value = "";
        return;
      }

      let importados = 0;
      let actualizados = 0;

      // Importar secciones
      if (Array.isArray(data.secciones)) {
        data.secciones.forEach((s) => {
          const nombre = (s?.nombre || "").toString().trim();
          if (!nombre) return;
          if (addPrincipalSectionByName(nombre, { silent: true })) {
            importados += 1;
          }
        });
      }

      // Importar subsecciones
      if (Array.isArray(data.subsecciones)) {
        data.subsecciones.forEach((s) => {
          const principal = (s?.seccion_principal || "").toString().trim();
          const nombre = (s?.nombre || "").toString().trim();
          if (!principal || !nombre) return;
          if (addPrincipalSectionByName(principal, { silent: true })) {
            importados += 1;
          }
          if (addSecondarySectionByName(principal, nombre, { silent: true })) {
            importados += 1;
          }
        });
      }

      // Importar cuentas
      if (data.cuentas && Array.isArray(data.cuentas)) {
        data.cuentas.forEach((c) => {
          const cuentaCodigo = (c.cuenta || "").toString().trim();
          if (!cuentaCodigo) return;
          const principal = (c.seccion_principal || "").toString().trim();
          const secundaria = (c.seccion_secundaria || "").toString().trim();
          ensureSectionPath(principal, secundaria);

          // Verificar si ya existe
          const existe = state.cuentas.some(
            (existing) =>
              normalizeOperationMatch(existing.CUENTA || existing.cuenta) ===
              normalizeOperationMatch(cuentaCodigo),
          );

          if (!existe) {
            state.cuentas.push({
              CUENTA: cuentaCodigo,
              cuenta: cuentaCodigo,
              NOMBRE: c.nombre,
              nombre: c.nombre,
              "SECCION PRINCIPAL": principal,
              "SECCION Secundaria": secundaria,
              visible: c.visible !== false,
              capturable: c.capturable !== false,
              TIPO_SALDO: c.tipo_saldo || "Deudor",
              operacion_factor: Number.isFinite(Number(c.factor))
                ? Number(c.factor)
                : 1,
              valor_plantilla: Number.isFinite(Number(c.valor_plantilla))
                ? Number(c.valor_plantilla)
                : 0,
              HOJA: state.modulo,
              CAPITULO: state.capitulo,
            });
            importados++;
          } else {
            const existing = state.cuentas.find(
              (acc) =>
                normalizeOperationMatch(acc.CUENTA || acc.cuenta) ===
                normalizeOperationMatch(cuentaCodigo),
            );
            if (existing) {
              existing.CUENTA = cuentaCodigo;
              existing.cuenta = cuentaCodigo;
              existing.NOMBRE =
                c.nombre || existing.NOMBRE || existing.nombre || "";
              existing.nombre = existing.NOMBRE;
              setAccountPrincipalName(existing, principal);
              setAccountSecondaryName(existing, secundaria);
              existing.visible = c.visible !== false;
              existing.capturable = c.capturable !== false;
              existing.TIPO_SALDO =
                c.tipo_saldo || existing.TIPO_SALDO || "Deudor";
              if (Number.isFinite(Number(c.factor))) {
                existing.operacion_factor = Number(c.factor);
              }
              if (Number.isFinite(Number(c.valor_plantilla))) {
                existing.valor_plantilla = Number(c.valor_plantilla);
              }
              actualizados++;
            }
          }
        });
      }

      // Importar operaciones
      if (data.operaciones && Array.isArray(data.operaciones)) {
        data.operaciones.forEach((op) => {
          const rawId = (op.operacion_id || "").toString().trim();
          const rawClase = (op.clase || rawId || "").toString().trim();
          const sectionPrincipal = (op.seccion || "").toString().trim();
          const sectionSub = (op.subseccion || "").toString().trim();
          if (!rawId && !rawClase) return;

          ensureSectionPath(sectionPrincipal, sectionSub);
          const placement = (sectionSub || sectionPrincipal || "")
            .toString()
            .trim();
          const parentSection = sectionSub
            ? sectionPrincipal
            : sectionPrincipal || null;
          const parentSubsection = sectionSub || null;
          const formulaPayload = parseImportedFormulaPayload(op);
          const formulaTerms = Array.isArray(formulaPayload.terms)
            ? formulaPayload.terms
            : [];
          const formulaTokens = Array.isArray(formulaPayload.tokens)
            ? formulaPayload.tokens
            : [];

          let existing = null;
          if (rawId) {
            existing = findOperationByIdStrict(rawId);
          }
          if (!existing && placement) {
            existing = findOperationBySectionName(
              placement,
              parentSection || "",
              { scope: sectionSub ? "subsection" : "section" },
            );
          }
          if (!existing && rawClase) {
            existing = findOperationByIdOrLabel(rawClase);
          }

          if (existing) {
            if (rawClase) {
              existing.Clase = rawClase;
              existing.operacion_etiqueta = rawClase;
            }
            if (rawId) {
              const idConflict = state.operaciones.some(
                (item) =>
                  item !== existing &&
                  normalizeOperationMatch(getOperationId(item)) ===
                  normalizeOperationMatch(rawId),
              );
              existing.OperacionId = idConflict
                ? buildUniqueOperationId(rawId, existing)
                : rawId;
            }
            existing.SECCION = placement;
            existing.seccion = placement;
            existing.parentSection = parentSection;
            existing.parentSubsection = parentSubsection;
            existing.secciones = placement ? [placement] : [];
            existing.tipo_operacion =
              op.tipo_operacion || existing.tipo_operacion || "libre";
            existing.rowStyle =
              op.estilo_fila || existing.rowStyle || "operation-row";
            existing.estilo_fila = existing.rowStyle;
            existing.visible = op.visible !== false;
            if (formulaTerms.length || String(op.formula || "").trim()) {
              applyStrictFormulaTermsToOperation(
                existing,
                formulaTerms,
                formulaTokens,
              );
            }
            actualizados++;
            return;
          }

          const newOpId = buildUniqueOperationId(rawId || rawClase);
          const newOp = {
            OperacionId: newOpId,
            Clase: rawClase || newOpId,
            SECCION: placement,
            seccion: placement,
            tipo_operacion: op.tipo_operacion || "libre",
            formula_terms: [],
            formula_json: serializeFormulaV2([]),
            rowStyle: op.estilo_fila || "operation-row",
            estilo_fila: op.estilo_fila || "operation-row",
            visible: op.visible !== false,
            parentSection,
            parentSubsection,
            secciones: placement ? [placement] : [],
            HOJA: state.modulo,
            CAPITULO: state.capitulo,
            orden: nextOperationOrder(),
            orden_presentacion: nextOperationOrder(),
          };
          if (parentSubsection) {
            newOp["sum-row"] = parentSubsection;
          } else if (parentSection) {
            newOp["sum-row-sumavarios"] = parentSection;
          }
          applyStrictFormulaTermsToOperation(
            newOp,
            formulaTerms,
            formulaTokens,
          );
          state.operaciones.push(newOp);
          importados++;
        });
      }

      dedupeTemplateStructure({ silent: true });
      state.operaciones = sortOperations(state.operaciones);
      ensureOperationIds();

      if (importados > 0 || actualizados > 0) {
        state.unsavedChanges = true;
        renderLayout();
        updateButtonStates();
        showToast(
          `✅ Importación completada. Nuevos: ${importados}, actualizados: ${actualizados}. Recuerda GUARDAR los cambios.`,
          "success",
        );
      } else {
        showToast(
          "ℹ️ No se importó nada nuevo (todos los elementos ya existen)",
          "info",
        );
      }
    } catch (error) {
      console.error("Error al importar:", error);
      showToast(`❌ Error al importar: ${error.message}`, "error");
    } finally {
      event.target.value = "";
    }
  }

  // Exponer API pública
  window.TemplateManager = {
    cargarOperacionesPredefinidas,
    updateAvailableElementsFromTable,
    saveContextToURL,
    loadContextFromURL,
  };
}
)();
