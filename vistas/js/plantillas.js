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
      (key) => key.toLowerCase() === String(value).toLowerCase()
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
      ".company-selector select"
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
    state.empresaId ||
    resolverEmpresaIdContexto(state.capitulo) ||
    "EMPRESA01";

  const agregarEmpresaIdQuery = (url) => {
    const empresaId = obtenerEmpresaIdApi();
    if (!empresaId) return url;
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}empresaId=${encodeURIComponent(empresaId)}`;
  };

  // ==========================================
  // INITIALIZATION
  // ==========================================
  function init() {
    cacheDOMElements();
    bindEventListeners();
    filtrarModulosPorCapitulo(); // Filtrar módulos al inicio
    loadInitialData();
    checkAuthState();
    setInterval(checkAuthState, 3000);
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
      "operationEditorSubtitle"
    );
    dom.editorTabDatos = document.getElementById("editorTabDatos");
    dom.editorTabFormula = document.getElementById("editorTabFormula");
    dom.editorTabAparicion = document.getElementById("editorTabAparicion");
    dom.btnEditorSave = document.getElementById("btnEditorSave");
    dom.btnEditorDelete = document.getElementById("btnEditorDelete");

    // Toast
    dom.toastNotification = document.getElementById("toastNotification");
    dom.toastMessage = document.getElementById("toastMessage");
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
    dom.btnAgregar.addEventListener("click", openAddModal);
    dom.btnCopiar.addEventListener("click", openCopyModal);
    dom.btnExpandir?.addEventListener("click", expandAll);
    dom.btnColapsar?.addEventListener("click", collapseAll);
    dom.btnPreview?.addEventListener("click", showPreview);
    dom.btnPrintPreview?.addEventListener("click", () => window.print());
    dom.btnRefreshOrder?.addEventListener("click", updateLayoutOrderPanel);
    
    // Importación/Exportación masiva
    const btnDescargarPlantilla = document.getElementById("btnDescargarPlantilla");
    const btnImportarExcel = document.getElementById("btnImportarExcel");
    const fileImportInput = document.getElementById("fileImportInput");
    
    if (btnDescargarPlantilla) {
      btnDescargarPlantilla.addEventListener("click", descargarPlantillaImportacion);
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

    dom.btnEditorSave?.addEventListener("click", confirmEdit);
    dom.btnEditorDelete?.addEventListener("click", deleteElement);

    // Element type selector
    document.querySelectorAll('input[name="tipoElemento"]').forEach((radio) => {
      radio.addEventListener("change", updateAddForm);
    });

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
        ".operation-card, .operation-row, .inline-operation-row, .list-item.item-operation"
      );
      if (!container) return;
      if (!btn.querySelector(".bi-pencil")) return;
      const opId =
        container.dataset.operationId ||
        container.dataset.operationLabel ||
        "";
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
      console.warn(`[Plantillas] No se encontró empresaId para el capítulo: ${capituloActual}`);
      return;
    }

    console.log(`[Plantillas] Filtrando módulos para empresa: ${empresaId}, capítulo: ${capituloActual}`);

    // Mapeo de valores de opción a IDs de módulo (normalizados)
    const moduloMapping = {
      'RESUMEN': 'resumen',
      'SUMMARY': 'resumen',
      'Finanzas': 'finanzas',
      'Gastos Generales': 'gastosgenerales',
      'Nomina': 'nomina',
      'Nómina': 'nomina',
      'Membresía': 'membresia',
      'Serv Membresía': 'serv-membresia',
      'RH': 'rh',
      'Eventos': 'eventos',
      'Comités': 'comites',
      'Comunicación': 'comunicacion',
      'Dirección': 'direccion',
      'Gtos Corporativos': 'gtos-corporativos',
      'T&IC': 'tic',
      'VPE': 'vpe'
    };

    // Filtrar opciones del select
    const options = Array.from(dom.moduloSelect.options);
    const valorActual = dom.moduloSelect.value;
    let valorActualDisponible = false;

    options.forEach(option => {
      const valorOption = option.value;
      const moduloId = moduloMapping[valorOption];

      if (!moduloId) {
        // Si no está en el mapeo, dejar visible (ej: opciones especiales)
        option.style.display = '';
        option.disabled = false;
        return;
      }

      // Verificar si el módulo está disponible para esta empresa
      const disponible = window.CapitulosModulos.moduloDisponible(empresaId, moduloId);

      if (disponible) {
        option.style.display = '';
        option.disabled = false;
        if (valorOption === valorActual) {
          valorActualDisponible = true;
        }
      } else {
        option.style.display = 'none';
        option.disabled = true;
      }
    });

    // Si el valor actualmente seleccionado no está disponible, seleccionar el primero disponible
    if (!valorActualDisponible && options.length > 0) {
      for (const option of options) {
        if (!option.disabled && option.style.display !== 'none') {
          dom.moduloSelect.value = option.value;
          console.log(`[Plantillas] Módulo seleccionado cambiado a: ${option.value}`);
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
          capitulo
        );
        state.editMode = tienePermiso;
        state.esAdminGlobal = false;
        updateAuthUI(
          tienePermiso,
          tienePermiso
            ? `Editor de ${capitulo} - Edición activa`
            : "Consulta - solicita permiso de edición en administración de usuarios"
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
        (p) => p.usuario_id === usuarioId && p.capitulo === capitulo
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

    dom.authStatus.className = `status-badge ${
      isActive ? "active" : "inactive"
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
        empresaId
      )}`;
      const response = await fetch(url, { headers: getAuthHeaders() });

      if (!response.ok) throw new Error("Error al cargar años");

      const data = await response.json();
      const years = Array.isArray(data.anios) ? data.anios : [];
      const currentYear = new Date().getFullYear();

      // Ordenar años descendente
      const sortedYears = years.sort((a, b) => b - a);

      dom.anioSelect.innerHTML = sortedYears.length
        ? sortedYears
            .map(
              (y) =>
                `<option value="${y}" ${
                  y === currentYear ? "selected" : ""
                }>${y}</option>`
            )
            .join("")
        : '<option value="">Sin años disponibles</option>';

      // Seleccionar año actual si existe, sino el más reciente
      state.anio = sortedYears.includes(currentYear)
        ? currentYear
        : sortedYears[0] || null;
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
      ".company-selector select"
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
          `${API_BASE}/${encodeURIComponent(state.modulo)}/${state.anio}/capitulos`
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
        `${API_BASE}/${encodeURIComponent(state.modulo)}/${state.anio}/${encodeURIComponent(state.capitulo)}`
      );
      const url = `${urlBase}${urlBase.includes("?") ? "&" : "?"}includeSecciones=1`;
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
      console.log('[GESTOR DEBUG] Layout recibido:', state.layout);
      console.log('[GESTOR DEBUG] Layout keys:', Object.keys(state.layout));
      console.log('[GESTOR DEBUG] Layout.cuentas:', state.layout.cuentas);
      console.log('[GESTOR DEBUG] Layout.cuentas[0]:', state.layout.cuentas?.[0]);
      console.log('[GESTOR DEBUG] Layout.cuentas es array?:', Array.isArray(state.layout.cuentas));
      console.log('[GESTOR DEBUG] Layout[modulo]:', state.layout[state.modulo]);
      console.log('[GESTOR DEBUG] state.modulo actual:', state.modulo);
      
      // FORZAR extracción directa sin función
      if (Array.isArray(state.layout.cuentas) && state.layout.cuentas.length > 0) {
        state.cuentas = state.layout.cuentas;
        console.log('[GESTOR DEBUG] ✅ Usando layout.cuentas directamente');
      } else if (Array.isArray(state.layout[state.modulo]) && state.layout[state.modulo].length > 0) {
        state.cuentas = state.layout[state.modulo];
        console.log('[GESTOR DEBUG] ✅ Usando layout[modulo] directamente');
      } else {
        state.cuentas = [];
        console.log('[GESTOR DEBUG] ❌ No hay cuentas disponibles');
      }
      
      console.log('[GESTOR DEBUG] Cuentas extraídas:', state.cuentas?.length, state.cuentas);
      ensureAccountIds(state.cuentas);
      state.operaciones = sortOperations(state.layout.operaciones || []);
      console.log('[GESTOR DEBUG] Operaciones extraídas:', state.operaciones?.length);
      if (isModuloPiloto()) {
        const extracted = extractColumnConfigFromOperations(state.operaciones);
        state.operaciones = extracted.operaciones;
        state.columnasConfig =
          Array.isArray(extracted.columnasConfig) &&
          extracted.columnasConfig.length
            ? extracted.columnasConfig
            : buildDefaultColumnConfig();
        state.columnasConfigChanged = false;
      } else {
        state.columnasConfig = null;
        state.columnasConfigChanged = false;
      }
      // MODO 100% MANUAL: desactivar funciones automáticas
      // hydrateOperationsFromParents(); // No inferir ubicaciones
      // hydrateOperationPlacement(); // No inferir placement
      // dedupeOperations(); // No eliminar duplicados automáticamente
      ensureOperationIds(); // Solo asegurar IDs si faltan
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
    console.log('[extractCuentas] Input layout:', layout);
    console.log('[extractCuentas] layout.cuentas:', layout?.cuentas);
    console.log('[extractCuentas] layout[modulo]:', layout?.[state.modulo], 'modulo=', state.modulo);
    
    if (Array.isArray(layout.cuentas)) {
      console.log('[extractCuentas] Retornando layout.cuentas:', layout.cuentas.length, 'elementos');
      return layout.cuentas;
    }
    if (Array.isArray(layout[state.modulo])) {
      console.log('[extractCuentas] Retornando layout[modulo]:', layout[state.modulo].length, 'elementos');
      return layout[state.modulo];
    }
    console.log('[extractCuentas] No se encontraron cuentas, retornando array vacío');
    return [];
  }

  function getAccountOrder(cuenta, fallback = 0) {
    const raw = cuenta?.orden_presentacion;
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
    if (!Array.isArray(state.cuentas) || !state.cuentas.length) return 1;
    const max = Math.max(
      ...state.cuentas.map((cuenta, idx) => getAccountOrder(cuenta, idx))
    );
    return Number.isFinite(max) ? max + 1 : state.cuentas.length + 1;
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
    OP_APARICION_ITEMS.map((item) => [item.value, item.tooltip || ""])
  );

  const normalizeAparicionValue = (value) =>
    (value || "").toString().trim().toLowerCase();

  const getAparicionTooltip = (value) =>
    APARICION_TOOLTIP_MAP.get(value) || "";

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
      const isSelected =
        normalizeAparicionValue(item.value) === selectedNorm;
      return `<option value="${escapeAttr(item.value)}"${
        isSelected ? " selected" : ""
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
    const estiloSelect = container.querySelector('#editOperacionEstilo');
    if (estiloSelect) {
      const preview = container.querySelector('#estiloPreview > div');
      estiloSelect.addEventListener('change', () => {
        const selectedOption = estiloSelect.options[estiloSelect.selectedIndex];
        const className = selectedOption?.dataset?.class || 'sum-row fw-semibold';
        if (preview) {
          preview.className = 'text-center ' + className;
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
    panel
      .querySelectorAll('[data-bs-dismiss="offcanvas"]')
      .forEach((btn) => {
        btn.addEventListener(
          "click",
          () => closeOffcanvasFallback(panel),
          { once: true }
        );
      });
    return true;
  };

  const openEmergencyOperationModal = (op, operationId = "", error = null) => {
    if (!dom.modalEditar || !dom.formEditar) {
      if (error) {
        alert(
          `No se pudo abrir el editor.\nError: ${error.message || error}\nOperacion: ${operationId}`
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
            row.field
          )}" value="${escapeHtml(op?.[row.field] || "")}" placeholder="${
        row.placeholder
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
          opLabelInput
        )}" />
      </div>

      <div class="mb-3">
        <label class="form-label d-flex align-items-center gap-2">
          Tipo de fila
          <i class="bi bi-info-circle text-muted" data-aparicion-help="true" title="${escapeAttr(
            tipoTooltip
          )}"></i>
        </label>
        <select class="form-select" id="editOperacionTipo" data-aparicion-select="true" data-initial-tipo="${escapeAttr(
          tipoSeleccionado
        )}" title="${escapeAttr(
          tipoTooltip
        )}">
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
        <input class="form-check-input" type="checkbox" id="editOperacionVisible" ${
          op?.visible !== false ? "checked" : ""
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
        (op) => normalizeOperationMatch(getOperationId(op)) === target
      ) ||
      state.operaciones.find(
        (op) => normalizeOperationMatch(getOperationLabel(op)) === target
      )
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
        (op) => normalizeOperationMatch(op?.[field]) === target
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
    return ROW_LABEL_FIELDS.some(
      (field) => normalizeOperationMatch(op?.[field]) === target
    );
  }

  function getOperationParentCandidates(op) {
    if (!op) return [];
    const candidates = [
      op.parentSection,
      op["SECCIÓN Principal"],
      op["SECCION Principal"],
      op.seccion_principal,
    ];
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
    return candidates.filter(Boolean);
  }

  function getRowOperationMatch(label, preferredField = "", parentSection = "") {
    if (!label) return { field: "", operations: [] };
    const target = normalizeOperationMatch(label);
    if (!target) return { field: "", operations: [] };

    const parentKey = normalizeOperationMatch(parentSection);
    const filterByParent = (ops = []) => {
      if (!parentKey) return ops;
      const withParent = ops.filter((op) =>
        getOperationParentCandidates(op).some(
          (candidate) => normalizeOperationMatch(candidate) === parentKey
        )
      );
      return withParent.length ? withParent : ops;
    };

    const direct = findOperationByIdOrLabel(label);
    if (direct) {
      return { field: "", operations: filterByParent([direct]) };
    }

    const rowMatch = findOperationsByRowLabel(label, preferredField);
    if (rowMatch.operations.length) {
      return {
        field: rowMatch.field,
        operations: filterByParent(rowMatch.operations),
      };
    }

    const byParent = (state.operaciones || []).filter((op) =>
      getOperationPlacementCandidates(op).some(
        (candidate) => normalizeOperationMatch(candidate) === target
      )
    );
    if (byParent.length) {
      return { field: "", operations: filterByParent(byParent) };
    }

    return { field: "", operations: [] };
  }

  function openAddOperationForRow(label, parentSection = "") {
    if (!requireEditMode()) return;
    const radio = document.querySelector(
      'input[name="tipoElemento"][value="operacion"]'
    );
    if (radio) radio.checked = true;
    updateAddForm();

    const inputClase = document.getElementById("inputClase");
    if (inputClase) inputClase.value = label || "";

    const inputOperacionId = document.getElementById("inputOperacionId");
    if (inputOperacionId && !inputOperacionId.value && label) {
      inputOperacionId.value = normalizeOperationId(label);
    }

    const sumCheck = document.getElementById(rowLabelAddCheckId("sum-row"));
    const sumInput = document.getElementById(rowLabelAddInputId("sum-row"));
    if (sumCheck) sumCheck.checked = true;
    if (sumInput && !sumInput.value && label) {
      sumInput.value = `Suma de ${label}`;
    }

    const valueCandidates = [];
    if (parentSection) valueCandidates.push(`${parentSection}||${label}`);
    if (label) valueCandidates.push(label);

    const checkboxes = document.querySelectorAll(
      "#checkboxSecciones input[type='checkbox']"
    );
    checkboxes.forEach((cb) => {
      if (valueCandidates.includes(cb.value)) cb.checked = true;
    });

    new bootstrap.Modal(dom.modalAgregar).show();
  }

  function editRowOperation(label, preferredField = "", parentSection = "") {
    if (!label) return;
    const match = getRowOperationMatch(label, preferredField, parentSection);
    if (!match.operations.length) {
      openAddOperationForRow(label, parentSection);
      return;
    }
    if (match.operations.length > 1) {
      showToast(
        `Hay ${match.operations.length} operaciones para "${label}". Abriendo la primera.`,
        "info"
      );
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

    ops.forEach((op) => {
      const section =
        op.SECCION || op.parentSection || op.parentSubsection || op.Clase || "";
      if (!section) return;
      const key = normalizeOperationMatch(section);
      if (!key || seen.has(key)) return;
      seen.add(key);

      let sign = Number(op.signos?.[resolvedField]);
      if (!Number.isFinite(sign)) {
        sign = resolvedField === "sum-row" ? 1 : getOperativoSignForSection(section);
      }
      if (!Number.isFinite(sign) || sign === 0) sign = 1;

      terms.push({
        id: Date.now() + terms.length,
        operator: sign < 0 ? "-" : "+",
        type: "section",
        value: section,
      });
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
        .filter(Boolean)
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
      (op) => normalizeOperationMatch(getOperationId(op)) === target
    );
    if (byId) return getOperationId(byId);
    const matches = state.operaciones.filter(
      (op) => normalizeOperationMatch(getOperationLabel(op)) === target
    );
    if (matches.length === 1) return getOperationId(matches[0]);
    return value;
  }
  function sortOperations(list = []) {
    return [...(list || [])]
      .map((op, idx) => ({ op, idx }))
      .sort(
        (a, b) => {
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
        }
      )
      .map((item) => item.op);
  }

  function normalizePresentationOrders() {
    let changed = false;
    const cuentas = state.cuentas || [];
    if (cuentas.length) {
      const ordered = (cuentas || [])
        .map((cuenta, idx) => ({ cuenta, idx }))
        .sort((a, b) => {
          const orderA = Number.isFinite(Number(a.cuenta?.orden_presentacion))
            ? Number(a.cuenta.orden_presentacion)
            : Number.isFinite(Number(a.cuenta?.orden))
            ? Number(a.cuenta.orden)
            : a.idx;
          const orderB = Number.isFinite(Number(b.cuenta?.orden_presentacion))
            ? Number(b.cuenta.orden_presentacion)
            : Number.isFinite(Number(b.cuenta?.orden))
            ? Number(b.cuenta.orden)
            : b.idx;
          if (orderA !== orderB) return orderA - orderB;
          return a.idx - b.idx;
        });
      ordered.forEach((item, idx) => {
        const cuenta = item.cuenta;
        const current = Number(cuenta?.orden_presentacion);
        if (!Number.isFinite(current)) {
          cuenta.orden_presentacion = idx;
          changed = true;
        }
      });
    }

    const ops = state.operaciones || [];
    if (ops.length) {
      const orderedOps = (ops || [])
        .map((op, idx) => ({ op, idx }))
        .sort((a, b) => {
          const orderA = Number.isFinite(Number(a.op?.orden_presentacion))
            ? Number(a.op.orden_presentacion)
            : Number.isFinite(Number(a.op?.orden))
            ? Number(a.op.orden)
            : a.idx;
          const orderB = Number.isFinite(Number(b.op?.orden_presentacion))
            ? Number(b.op.orden_presentacion)
            : Number.isFinite(Number(b.op?.orden))
            ? Number(b.op.orden)
            : b.idx;
          if (orderA !== orderB) return orderA - orderB;
          return a.idx - b.idx;
        });
      orderedOps.forEach((item, idx) => {
        const op = item.op;
        const current = Number(op?.orden_presentacion);
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
        "info"
      );
    }
  }

  function nextOperationOrder() {
    if (!state.operaciones.length) return 0;
    const maxOrden = Math.max(
      ...state.operaciones.map((op, idx) => getOperationOrder(op, idx))
    );
    return Number.isFinite(maxOrden) ? maxOrden + 1 : 0;
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
    state.operaciones = state.operaciones.map((op, idx) => {
      // PRIORIDAD 1: Si ya tiene formula_terms definidos manualmente, respetarlos
      if (op?.formula_terms?.length) {
        // Asegurar que cada término tenga el tipo correcto
        op.formula_terms = op.formula_terms.map((term) => ({
          ...term,
          type: term.type || detectTermType(term.value),
        }));
        return op;
      }

      // PRIORIDAD 2: Si tiene formula_json guardado, parsearlo
      if (op?.formula_json) {
        try {
          const parsed = JSON.parse(op.formula_json);
          op.formula_terms = parsed.map((term) => ({
            ...term,
            type: term.type || detectTermType(term.value),
          }));
          return op;
        } catch (e) {
          console.warn("Error parsing formula_json:", e);
        }
      }

      // PRIORIDAD 3: Si tiene signos explícitos en seccion_1, seccion_2, etc.
      if (op?.signos && Object.keys(op.signos).length > 0) {
        const terms = [];
        const seccionKeys = Object.keys(op.signos)
          .filter((k) => k.startsWith("seccion_"))
          .sort((a, b) => {
            const numA = parseInt(a.split("_")[1]) || 0;
            const numB = parseInt(b.split("_")[1]) || 0;
            return numA - numB;
          });

        seccionKeys.forEach((key, i) => {
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
          return op;
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
    return `
      <div class="template-pilot">
        ${renderTemplateSummary(rows, [])}
        <div class="card mb-3">
          <div class="card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
            <span>Elementos de la plantilla</span>
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
      { label: "Columnas", value: columnCount },
    ];
    const visibleItems = items.filter(
      (item) => !item.optional || item.value > 0
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
            `
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
    const appendMissingOperations = (rows = []) => {
      const normalized = new Set();
      const registerKey = (value) => {
        const key = normalizeOperationMatch(value || "");
        if (key) normalized.add(key);
      };

      (rows || []).forEach((row) => {
        if (!row || row.type !== "operation") return;
        registerKey(row.opId || row.label || "");
      });

      const extras = [];
      (state.operaciones || []).forEach((op) => {
        if (!op || isColumnConfigOperation(op)) return;
        const label = getOperationDisplayName(op);
        const opId = getOperationId(op) || label;
        if (!label && !opId) return;
        const keyId = normalizeOperationMatch(opId || "");
        const keyLabel = normalizeOperationMatch(label || "");
        if ((keyId && normalized.has(keyId)) || (keyLabel && normalized.has(keyLabel))) {
          return;
        }
        if (keyId) normalized.add(keyId);
        if (keyLabel) normalized.add(keyLabel);
        extras.push({
          type: "operation",
          label: label || opId || "",
          opId: opId || label || "",
          kind: detectOperationType(op),
          parentSection: op.parentSection || "",
          parentSubsection: op.parentSubsection || "",
          visible: op.visible !== false,
        });
      });

      if (!extras.length) return rows;
      return [...rows, ...extras];
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

    // Fallback: construir filas manualmente con secciones y subsecciones
    const rows = [];
    const sections = groupBySections(state.cuentas || []);
    const operaciones = sortOperations(state.operaciones || []);
    const renderedOpIds = new Set();

    sections.forEach((section) => {
      rows.push({
        type: "principal",
        label: section.name,
        visible: true,
      });

      // Agregar subsecciones
      section.subsections.forEach((subsection) => {
        // Solo mostrar subsección si tiene nombre diferente a la sección principal.
        if (subsection.name && subsection.name !== section.name) {
          rows.push({
            type: "subsection",
            label: subsection.name,
            parentSection: section.name,
            visible: true,
          });
        }

        // Agregar cuentas de la subsección
        const realAccounts = (subsection.accounts || []).filter(
          (acc) => !isPlaceholderAccount(acc)
        );

        // Buscar operaciones de esta subsección
        const subsectionOps = operaciones.filter((op) => {
          const opId = getOperationId(op);
          if (renderedOpIds.has(opId)) return false;

          const parentSub = op.parentSubsection || op.SECCION || "";
          const parentSec = op.parentSection || "";

          // Verificar si pertenece a esta subsección
          if (parentSub.toLowerCase() === subsection.name.toLowerCase()) {
            if (parentSec && parentSec.toLowerCase() !== section.name.toLowerCase()) {
              return false;
            }
            return true;
          }
          if (operationMatchesRowLabel(op, subsection.name)) {
            if (
              parentSec &&
              parentSec.toLowerCase() !== section.name.toLowerCase()
            ) {
              return false;
            }
            return true;
          }
          return false;
        });
        const subsectionRows = [];
        realAccounts.forEach((cuenta, idx) => {
          subsectionRows.push({
            type: "account",
            cuenta: cuenta.CUENTA || cuenta.cuenta || "",
            nombre: cuenta.NOMBRE || cuenta.nombre || "",
            label: cuenta.CUENTA || cuenta.cuenta || "",
            parentSection: section.name,
            parentSubsection: subsection.name,
            accountId: getAccountRowId(cuenta),
            visible: cuenta.visible !== false,
            __sortOrder: getAccountOrder(cuenta, idx),
            __sortKind: 0,
          });
        });

        subsectionOps.forEach((op, idx) => {
          const opId = getOperationId(op);
          renderedOpIds.add(opId);
          subsectionRows.push({
            type: "operation",
            label: getOperationDisplayName(op),
            opId: opId,
            kind: detectOperationType(op),
            parentSection: section.name,
            parentSubsection: subsection.name,
            visible: op.visible !== false,
            __sortOrder: getOperationOrder(op, idx),
            __sortKind: 1,
          });
        });

        subsectionRows
          .sort((a, b) => {
            const orderA = Number.isFinite(Number(a.__sortOrder))
              ? Number(a.__sortOrder)
              : 0;
            const orderB = Number.isFinite(Number(b.__sortOrder))
              ? Number(b.__sortOrder)
              : 0;
            if (orderA !== orderB) return orderA - orderB;
            const kindA = Number.isFinite(Number(a.__sortKind))
              ? Number(a.__sortKind)
              : 0;
            const kindB = Number.isFinite(Number(b.__sortKind))
              ? Number(b.__sortKind)
              : 0;
            return kindA - kindB;
          })
          .forEach((item) => {
            delete item.__sortOrder;
            delete item.__sortKind;
            rows.push(item);
          });
      });

      // Buscar operaciones a nivel de sección (que no pertenecen a ninguna subsección específica)
      const sectionOps = operaciones.filter((op) => {
        const opId = getOperationId(op);
        if (renderedOpIds.has(opId)) return false;

        const clase = (getOperationLabel(op) || "").toLowerCase();
        const sectionLower = section.name.toLowerCase();
        const parentSec = (op.parentSection || "").toLowerCase();
        const parentSub = (op.parentSubsection || "").toLowerCase();

        if (parentSec && parentSec === sectionLower && !parentSub) {
          return true;
        }

        // Operaciones que referencian esta sección
        if (clase.includes(sectionLower) || (op.SECCION || "").toLowerCase() === sectionLower) {
          return true;
        }
        if (operationMatchesRowLabel(op, section.name)) {
          return true;
        }
        return false;
      });

      sectionOps.forEach((op) => {
        const opId = getOperationId(op);
        renderedOpIds.add(opId);
        rows.push({
          type: "operation",
          label: getOperationDisplayName(op),
          opId: opId,
          kind: detectOperationType(op),
          parentSection: section.name,
          parentSubsection: "",
          visible: op.visible !== false,
        });
      });
    });

    // Agregar operaciones no renderizadas (operaciones globales/consolidadas)
    operaciones.forEach((op) => {
      const opId = getOperationId(op);
      if (renderedOpIds.has(opId)) return;

      rows.push({
        type: "operation",
        label: getOperationDisplayName(op),
        opId: opId,
        kind: detectOperationType(op),
        parentSection: op.parentSection || "",
        parentSubsection: op.parentSubsection || "",
        visible: op.visible !== false,
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
          <tr data-col-index="${idx}" class="${
            col.editable ? "column-editable" : ""
          }">
            <td class="text-muted">${idx + 1}</td>
            ${
              showAdvanced
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
            ${
              showOperation
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
        `
      )
      .join("");

    const colSpan =
      3 + (showAdvanced ? 1 : 0) + (showOperation ? 1 : 0);
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
        "button, a, input, select, textarea, label, [role='button'], .list-item-actions, .inline-op-actions, .account-actions, .section-actions, .inline-order-controls, .inline-order-buttons"
      )
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
    const disabledAttr = canEdit ? '' : 'disabled';
    let html = '<div class="template-list-view">';

    rows.forEach((row, rowIndex) => {
      if (!row) return;
      const isVisible = row.visible !== false;
      const hiddenClass = isVisible ? '' : 'opacity-50';

      if (row.type === 'principal') {
        const sectionName = row.label || '';
        const sectionOpMatch = getRowOperationMatch(sectionName);
        const hasSectionOp = sectionOpMatch.operations.length > 0;
        const sectionOpBtnClass = hasSectionOp
          ? 'btn-outline-success'
          : 'btn-outline-secondary';
        const sectionOpBtnTitle = hasSectionOp
          ? 'Editar operación'
          : 'Crear operación';
        html += `
          <div class="list-item section-principal ${hiddenClass}" data-row-type="section" data-section="${escapeAttr(sectionName)}" data-row-index="${rowIndex}">
            ${showOrder ? renderInlineOrderButtons(rowIndex) : ''}
            <div class="list-item-content d-flex justify-content-between align-items-center flex-grow-1">
              <div class="d-flex align-items-center">
                <i class="bi bi-folder2 me-2 text-primary"></i>
                <strong>${escapeHtml(sectionName || 'Sección')}</strong>
              </div>
              <div class="list-item-actions">
                <button class="btn btn-sm ${sectionOpBtnClass}" onclick="event.stopPropagation(); editRowOperation('${escapeAttr(
                  sectionName
                )}', '${escapeAttr(sectionOpMatch.field || "")}', '')" title="${sectionOpBtnTitle}" ${disabledAttr}>
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

      if (row.type === 'subsection') {
        const subsectionName = row.label || '';
        const parentSection = row.parentSection || '';
        const subsectionOpMatch = getRowOperationMatch(
          subsectionName,
          "",
          parentSection
        );
        const hasSubsectionOp = subsectionOpMatch.operations.length > 0;
        const subsectionOpBtnClass = hasSubsectionOp
          ? 'btn-outline-success'
          : 'btn-outline-secondary';
        const subsectionOpBtnTitle = hasSubsectionOp
          ? 'Editar operación'
          : 'Crear operación';
        html += `
          <div class="list-item section-secondary ${hiddenClass}" data-row-type="subsection" data-section="${escapeAttr(parentSection)}" data-subsection="${escapeAttr(subsectionName)}" data-parent-section="${escapeAttr(parentSection)}" data-row-index="${rowIndex}">
            ${showOrder ? renderInlineOrderButtons(rowIndex) : ''}
            <div class="list-item-content ps-4 d-flex justify-content-between align-items-center flex-grow-1">
              <div class="d-flex align-items-center">
                <i class="bi bi-folder me-2 text-info"></i>
                <em>${escapeHtml(subsectionName || 'Subsección')}</em>
              </div>
              <div class="list-item-actions">
                <button class="btn btn-sm ${subsectionOpBtnClass}" onclick="event.stopPropagation(); editRowOperation('${escapeAttr(
                  subsectionName
                )}', '${escapeAttr(subsectionOpMatch.field || "")}', '${escapeAttr(
                  parentSection
                )}')" title="${subsectionOpBtnTitle}" ${disabledAttr}>
                  <i class="bi bi-calculator"></i>
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

      if (row.type === 'account') {
        const cuenta = row.cuenta || row.label || '';
        const nombre = row.nombre || '';
        const accountId = row.accountId || row.accountID || row.rowId || cuenta;
        const parentSection = row.parentSection || '';
        const parentSubsection = row.parentSubsection || '';
        html += `
          <div class="list-item item-account ${hiddenClass}" data-row-type="account" data-section="${escapeAttr(parentSection)}" data-subsection="${escapeAttr(parentSubsection)}" data-account-id="${escapeAttr(accountId)}" data-cuenta="${escapeAttr(cuenta)}" data-nombre="${escapeAttr(nombre)}" data-row-index="${rowIndex}">
            ${showOrder ? renderInlineOrderButtons(rowIndex) : ''}
            <div class="list-item-content ps-5 d-flex justify-content-between align-items-center flex-grow-1">
              <div class="d-flex align-items-center">
                <span class="badge bg-secondary me-2">${escapeHtml(cuenta)}</span>
                <span>${escapeHtml(nombre || cuenta)}</span>
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

      if (row.type === 'operation') {
        const op = findOperationByIdOrLabel(row.label || row.opId || '');
        const label = op ? getOperationDisplayName(op) : row.label || '';
        const opId = op ? getOperationId(op) : row.opId || '';
        const kind = row.kind || '';
        const kindMeta = getOperationKindMeta(kind);
        const formulaTerms = op ? extractFormulaTerms(op) : [];
        const formula = formulaTerms.length ? formatFormula(op) : '';

        html += `
          <div class="list-item item-operation ${hiddenClass}" data-row-type="operation" data-operation-id="${escapeAttr(opId || label)}" data-operation-label="${escapeAttr(label)}" data-operation-kind="${escapeAttr(kind)}" data-row-index="${rowIndex}" ${formula ? `title="${escapeAttr(formula)}"` : ''} onclick="window.handleOperationRowClick(event, '${escapeAttr(opId || label)}')">
            ${showOrder ? renderInlineOrderButtons(rowIndex) : ''}
            <div class="list-item-content ps-5 d-flex justify-content-between align-items-center flex-grow-1">
              <div>
                <div class="d-flex align-items-center">
                  <i class="bi bi-calculator me-2 text-success"></i>
                  <strong>${escapeHtml(label)}</strong>
                  ${kindMeta ? `<span class="badge ${kindMeta.className} ms-2">${escapeHtml(kindMeta.label)}</span>` : ''}
                </div>
                <div class="operation-formula small text-muted ms-4 mt-1">
                  ${formula ? `= ${escapeHtml(formula)}` : 'Sin formula'}
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

    html += '</div>';

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

  function renderInlineOrderButtons(rowIndex) {
    return `
      <div class="inline-order-buttons">
        <button type="button" class="btn btn-sm btn-outline-secondary inline-order-btn" data-action="up" data-row-index="${rowIndex}">
          <i class="bi bi-arrow-up"></i>
        </button>
        <button type="button" class="btn btn-sm btn-outline-secondary inline-order-btn" data-action="down" data-row-index="${rowIndex}">
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
    const headerHtml = `${
      showOrder
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
          col.key || ""
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
          <tr class="section-header-row ${hiddenClass}" data-row-type="section" data-section="${escapeAttr(
            currentSection
          )}" data-generated="${row.generated ? "true" : "false"}">
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
          <tr class="subsection-row ${hiddenClass}" data-row-type="subsection" data-section="${escapeAttr(
            currentSection
          )}" data-subsection="${escapeAttr(currentSubsection)}">
            ${orderCell}
            <td colspan="${showOrder ? colCount - 1 : colCount}">
              <em>${escapeHtml(currentSubsection || "Subseccion")}</em>
            </td>
          </tr>
        `;
        return;
      }

      if (row.type === "account") {
        const cuenta = row.cuenta || row.label || "";
        const nombre = row.nombre || "";
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
              `<td class="account-code ${cellClass}">${escapeHtml(cuenta)}</td>`
            );
          } else if (i === 1) {
            cells.push(
              `<td class="account-name ${cellClass}">${escapeHtml(
                nombre || cuenta
              )}</td>`
            );
          } else {
            cells.push(`<td class="${cellClass}"></td>`);
          }
        }
        bodyHtml += `
          <tr class="account-row ${hiddenClass}" data-row-type="account" data-cuenta="${escapeAttr(
            cuenta
          )}" data-nombre="${escapeAttr(nombre)}" data-section="${escapeAttr(
            currentSection
          )}" data-subsection="${escapeAttr(currentSubsection)}">
            ${cells.join("")}
          </tr>
        `;
        return;
      }

      if (row.type === "operation") {
        const op = findOperationByIdOrLabel(row.label || "");
        const label = op ? getOperationDisplayName(op) : row.label || "";
        const opId = op ? getOperationId(op) : "";
        const kind = row.kind || "";
        const kindMeta = getOperationKindMeta(kind);
        const formulaTerms = op ? extractFormulaTerms(op) : [];
        const formula = formulaTerms.length ? formatFormula(op) : "";
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
                ${
                  kindMeta
                    ? `<span class="op-kind-pill ${kindMeta.className}" title="${escapeAttr(
                        kind
                      )}">${escapeHtml(kindMeta.label)}</span>`
                    : ""
                }
                <div class="op-formula-preview small text-muted mt-1">
                  ${formula ? `= ${escapeHtml(formula)}` : "Sin formula"}
                </div>
              </td>`
            );
          } else {
            cells.push(`<td class="${cellClass}"></td>`);
          }
        }
        bodyHtml += `
          <tr class="operation-row ${kind} ${kindMeta?.className || ""} ${hiddenClass}" data-row-type="operation" data-operation-id="${escapeAttr(
            opId || label
          )}" data-operation-label="${escapeAttr(label)}" data-operation-kind="${escapeAttr(
            kind
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
        <table class="table table-sm table-bordered template-table ${
          showOrder ? "ordering-mode" : ""
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
      `[data-bs-target="#${tabId}"]`
    );
    if (!tabButton || !window.bootstrap?.Tab) return;
    window.bootstrap.Tab.getOrCreateInstance(tabButton).show();
  }

  function buildOperationEditorDataTab({ opId, opLabelInput, op }) {
    const tipoFila = detectOperationType(op || {});
    const formulaPreview = formatFormula(op || {});
    return `
      <div class="mb-3">
        <label class="form-label">Nombre visible <span class="text-danger">*</span></label>
        <input type="text" class="form-control" id="editClaseOp" data-required="true" value="${escapeHtml(
          opLabelInput || ""
        )}" />
        <div class="invalid-feedback">Este campo es obligatorio (o indica un ID interno).</div>
      </div>
      <div class="mb-3">
        <label class="form-label">Tipo de fila</label>
        <div>
          <span class="badge bg-secondary text-uppercase">${escapeHtml(
            tipoFila
          )}</span>
        </div>
      </div>
      <div class="mb-3">
        <label class="form-label">Fórmula</label>
        <div class="p-2 bg-light border rounded small" style="font-family: 'Courier New', monospace;">
          ${escapeHtml(formulaPreview || "Sin fórmula")}
        </div>
      </div>
      <details class="editor-advanced">
        <summary>Avanzado</summary>
        <div class="mt-2">
          <label class="form-label">Identificador interno</label>
          <input type="text" class="form-control" id="editOperacionId" value="${escapeHtml(
            opId || ""
          )}" />
          <div class="invalid-feedback">Indica un ID si no hay nombre visible.</div>
          <div class="form-text">
            Obligatorio si el nombre visible está vacío.
          </div>
        </div>
      </details>
    `;
  }

  function buildFormulaSelectionKey(type, value, parentSection = "") {
    const normalizedType = (type || "section").toString().toLowerCase();
    let sectionValue = value || "";
    let parent = parentSection || "";
    if (!parent && typeof sectionValue === "string" && sectionValue.includes("||")) {
      const parts = sectionValue.split("||");
      if (parts.length >= 2) {
        parent = parts[0]?.trim() || "";
        sectionValue = parts.slice(1).join("||").trim();
      }
    }
    const normalizedValue = normalizeOperationMatch(sectionValue || "");
    const normalizedParent = normalizeOperationMatch(parent || "");
    if ((normalizedType === "section" || normalizedType === "seccion") && normalizedParent) {
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
        term.parentSection
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
              ${
                row.type && row.type !== "account"
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
          <input class="btn-check" type="radio" name="operationFormulaMode" id="formulaModeManual" value="manual" ${
            initialMode === "manual" ? "checked" : ""
          } />
          <label class="btn btn-outline-primary" for="formulaModeManual">Manual</label>
          <input class="btn-check" type="radio" name="operationFormulaMode" id="formulaModeLayout" value="layout" ${
            initialMode === "layout" ? "checked" : ""
          } />
          <label class="btn btn-outline-primary" for="formulaModeLayout">Layout</label>
        </div>
      </div>
      <div class="formula-preview-box mb-3" id="operationFormulaPreview"></div>
      <div data-formula-panel="manual" class="${initialMode === "manual" ? "" : "d-none"}">
        <label class="form-label">Fórmula</label>
        <textarea class="form-control font-monospace" id="operationFormulaManual" rows="4" placeholder="Ej: 401-000-000-00 + Membership - Gastos">${escapeHtml(
          formulaText
        )}</textarea>
        <div class="form-text">Escribe cuentas, secciones u operaciones con + / -. Usa espacios alrededor del operador para evitar cortar cuentas con guiones.</div>
      </div>
      <div data-formula-panel="layout" class="${initialMode === "layout" ? "" : "d-none"}">
        <div class="alert alert-info small mb-3">
          Selecciona elementos del layout. Click una vez suma (+), otra resta (-), otra limpia.
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
      "[data-formula-type][data-formula-value]"
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
    if (layout) {
      layout.addEventListener("click", (event) => {
        const btn = event.target.closest(".formula-toggle");
        if (!btn) return;
        const state = btn.dataset.state || "none";
        const next =
          state === "none" ? "+" : state === "+" ? "-" : "none";
        btn.dataset.state = next;
        btn.textContent = next === "none" ? "" : next;
        btn.classList.remove("is-plus", "is-minus", "is-off");
        btn.classList.add(
          next === "+"
            ? "is-plus"
            : next === "-"
            ? "is-minus"
            : "is-off"
        );
        updateFormulaPreview(panel);
      });
    }

    const manualInput = panel.querySelector("#operationFormulaManual");
    if (manualInput) {
      manualInput.addEventListener("input", () => updateFormulaPreview(panel));
    }

    const modeInputs = panel.querySelectorAll(
      'input[name="operationFormulaMode"]'
    );
    modeInputs.forEach((input) => {
      input.addEventListener("change", () => {
        state.operationEditorFormulaMode = input.value;
        const manualPanel = panel.querySelector('[data-formula-panel="manual"]');
        const layoutPanel = panel.querySelector('[data-formula-panel="layout"]');
        if (manualPanel && layoutPanel) {
          if (input.value === "manual") {
            manualPanel.classList.remove("d-none");
            layoutPanel.classList.add("d-none");
          } else {
            layoutPanel.classList.remove("d-none");
            manualPanel.classList.add("d-none");
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
    
    // Estilos visuales de fila
    const estiloActual = op?.rowStyle || op?.estilo_fila || "sum-row";
    const estilosDisponibles = [
      { value: "sum-row", label: "Suma Simple", class: "sum-row fw-semibold", desc: "Fila de suma básica" },
      { value: "sum-row-principal", label: "Suma Principal", class: "sum-row-principal fw-bold", desc: "Sección principal (INCOME, EXPENSES)" },
      { value: "highlight-primary", label: "Consolidado Primario", class: "highlight-primary fw-bold text-uppercase", desc: "CONSOLIDATED INCOME/EXPENSES" },
      { value: "highlight-secondary", label: "Resultado Operativo", class: "highlight-secondary fw-bold", desc: "OPERATING RESULTS" },
      { value: "highlight-bright", label: "Resultado Neto", class: "highlight-bright text-white fw-bold", desc: "NET RESULTS (máxima jerarquía)" },
      { value: "subsection-row", label: "Subsección", class: "subsection-row bg-light fw-semibold", desc: "Encabezado de subsección" },
      { value: "operation-row", label: "Operación Libre", class: "operation-row free-operation-row fw-semibold", desc: "Operación personalizada" },
    ];
    
    const estiloOptionsHtml = estilosDisponibles.map(estilo => {
      const selected = estilo.value === estiloActual ? 'selected' : '';
      return `<option value="${escapeAttr(estilo.value)}" ${selected} data-class="${escapeAttr(estilo.class)}">${escapeHtml(estilo.label)} - ${escapeHtml(estilo.desc)}</option>`;
    }).join('');
    
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
          <div class="text-center ${escapeAttr(estilosDisponibles.find(e => e.value === estiloActual)?.class || 'sum-row fw-semibold')}">
            Vista previa del estilo
          </div>
        </div>
      </div>
      
      <div class="mb-3">
        <label class="form-label d-flex align-items-center gap-2">
          Tipo de fila
          <i class="bi bi-info-circle text-muted" data-aparicion-help="true" title="${escapeAttr(
            tipoTooltip
          )}"></i>
        </label>
        <select class="form-select" id="editOperacionTipo" data-aparicion-select="true" data-initial-tipo="${escapeAttr(
          tipoSeleccionado
        )}" title="${escapeAttr(
          tipoTooltip
        )}">
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
        const value =
          type === "section" ? item : item.id || item.label || "";
        const label =
          type === "section" ? item : item.label || item.id || "";
        const key = normalizeContributionKey(type, value);
        const altKey = normalizeContributionKey(type, label);
        const operator =
          selectionMap.get(key) || selectionMap.get(altKey) || "+";
        const checked = selectionMap.has(key) || selectionMap.has(altKey);
        const searchKey = normalizeOperationMatch(label || value);
        return `
          <label class="contrib-item" data-type="${escapeAttr(
            type
          )}" data-value="${escapeAttr(value)}" data-search="${escapeAttr(
          searchKey
        )}">
            <input class="form-check-input contrib-check" type="checkbox" ${
              checked ? "checked" : ""
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
      availableElements?.operations || []
    );
    renderContributionList(
      dom.operationEditorPanel.querySelector("#contribSections"),
      sections,
      "section",
      selectionMap
    );
    renderContributionList(
      dom.operationEditorPanel.querySelector("#contribOperations"),
      operations,
      "operation",
      selectionMap
    );
    
    // Actualizar contadores
    updateContributionCounters(dom.operationEditorPanel);
  }
  
  function updateContributionCounters(panel) {
    if (!panel) return;
    const sectionsChecked = panel.querySelectorAll('#contribSections .contrib-check:checked').length;
    const operationsChecked = panel.querySelectorAll('#contribOperations .contrib-check:checked').length;
    
    const sectionsCounter = panel.querySelector('#contribSectionsCount');
    const operationsCounter = panel.querySelector('#contribOperationsCount');
    
    if (sectionsCounter) sectionsCounter.textContent = sectionsChecked;
    if (operationsCounter) operationsCounter.textContent = operationsChecked;
  }

  function applyContributionTerms(mode = "replace") {
    if (!dom.operationEditorPanel) return;
    const contribPanel = dom.operationEditorPanel.querySelector(
      '[data-formula-panel="contrib"]'
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
            row.field
          )}" value="${escapeHtml(op[row.field] || "")}" placeholder="${
        row.placeholder
      }"${tooltipAttr} />
        </div>
      `;
    }).join("");

    if (dom.operationEditorTitle) {
      dom.operationEditorTitle.textContent = `Operacion: ${getOperationDisplayName(
        op
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
    }
    if (dom.editorTabFormula) {
      dom.editorTabFormula.innerHTML = buildOperationEditorFormulaTab(
        op,
        availableElements
      );
    }
    if (dom.editorTabAparicion) {
      dom.editorTabAparicion.innerHTML = buildOperationEditorAparicionTab(
        op,
        rowLabelsHtml
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
          dom.operationEditorPanel
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
      console.warn("⚠️ Bootstrap Offcanvas no disponible, usando fallback manual");
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
    if (isPiloto) {
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
          editConsolidatedLabel(label, match.field || kind || "sum-row");
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
            showToast("Activa el modo edición para modificar secciones", "warning");
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
            showToast("Activa el modo edición para modificar subsecciones", "warning");
            return;
          }
          window.editSubsection(section, subsection);
        }
      }
    });
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
      showToast('Cuenta no encontrada', 'warning');
      return;
    }
    const accountId = getAccountRowId(cuenta);
    const codigoCuenta = cuenta.CUENTA || cuenta.cuenta || cuentaId;
    state.selectedElement = { type: "account", cuenta, accountId, codigo: codigoCuenta };
    updateSelectionInfo();

    // Abrir editor usando el panel existente
    if (!dom.operationEditorPanel) {
      showToast('Panel de edición no disponible', 'error');
      return;
    }

    // Configurar título del editor
    if (dom.operationEditorTitle) {
      dom.operationEditorTitle.textContent = 'Editar Cuenta';
    }
    if (dom.operationEditorSubtitle) {
      dom.operationEditorSubtitle.textContent = `Cuenta: ${codigoCuenta}`;
    }

    // Renderizar formulario de cuenta en la pestaña de datos
    if (dom.editorTabDatos) {
      dom.editorTabDatos.innerHTML = `
        <div class="mb-3">
          <label class="form-label">Cuenta</label>
          <input type="text" class="form-control" id="editCuenta" value="${escapeHtml(codigoCuenta || '')}" readonly />
        </div>
        <div class="mb-3">
          <label class="form-label">Nombre</label>
          <input type="text" class="form-control" id="editNombre" value="${escapeHtml(cuenta.NOMBRE || cuenta.nombre || '')}" />
        </div>
        <div class="mb-3">
          <label class="form-label">Sección Principal</label>
          <input type="text" class="form-control" id="editSeccionPrincipal" value="${escapeHtml(getAccountPrincipalName(cuenta) || '')}" />
        </div>
        <div class="mb-3">
          <label class="form-label">Sección Secundaria</label>
          <input type="text" class="form-control" id="editSeccionSecundaria" value="${escapeHtml(getAccountSecondaryName(cuenta) || '')}" />
        </div>
        <div class="mb-3">
          <div class="form-check">
            <input class="form-check-input" type="checkbox" id="editVisible" ${cuenta.visible !== false ? 'checked' : ''} />
            <label class="form-check-label" for="editVisible">Visible</label>
          </div>
        </div>
      `;
    }

    // Limpiar otras pestañas
    if (dom.editorTabFormula) dom.editorTabFormula.innerHTML = '<p class="text-muted">No aplica para cuentas</p>';
    if (dom.editorTabAparicion) dom.editorTabAparicion.innerHTML = '<p class="text-muted">No aplica para cuentas</p>';

    // Configurar botón de guardar
    if (dom.btnEditorSave) {
      const saveHandler = () => {
        const nombre = document.getElementById('editNombre')?.value || '';
        const seccionPrincipal = document.getElementById('editSeccionPrincipal')?.value || '';
        const seccionSecundaria = document.getElementById('editSeccionSecundaria')?.value || '';
        const visible = document.getElementById('editVisible')?.checked;

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
        if (cuenta.seccion_secundaria !== undefined)
          cuenta.seccion_secundaria = seccionSecundaria;
        cuenta.visible = visible;

        // Guardar y cerrar
        state.unsavedChanges = true;
        updateButtonStates();
        renderLayout();
        scheduleAutoSave("edit");
        showToast('Cuenta actualizada', 'success');

        // Cerrar panel
        if (window.bootstrap?.Offcanvas) {
          const offcanvas = window.bootstrap.Offcanvas.getInstance(dom.operationEditorPanel);
          offcanvas?.hide();
        }

        // Remover listener
        dom.btnEditorSave.removeEventListener('click', saveHandler);
      };

      dom.btnEditorSave.removeEventListener('click', saveHandler);
      dom.btnEditorSave.addEventListener('click', saveHandler);
    }

    // Configurar botón de eliminar
    if (dom.btnEditorDelete) {
      const deleteHandler = () => {
        if (!confirm(`¿Eliminar la cuenta ${codigoCuenta}?`)) return;

        state.cuentas = state.cuentas.filter(
          (c) => getAccountRowId(c) !== accountId
        );
        state.unsavedChanges = true;
        updateButtonStates();
        renderLayout();
        scheduleAutoSave("delete");
        showToast('Cuenta eliminada', 'success');

        // Cerrar panel
        if (window.bootstrap?.Offcanvas) {
          const offcanvas = window.bootstrap.Offcanvas.getInstance(dom.operationEditorPanel);
          offcanvas?.hide();
        }

        dom.btnEditorDelete.removeEventListener('click', deleteHandler);
      };

      dom.btnEditorDelete.removeEventListener('click', deleteHandler);
      dom.btnEditorDelete.addEventListener('click', deleteHandler);
    }

    // Abrir panel
    if (window.bootstrap?.Offcanvas) {
      const offcanvas = window.bootstrap.Offcanvas.getOrCreateInstance(dom.operationEditorPanel);
      offcanvas.show();
    }
  }

  /**
   * Editar una sección principal (LEGACY - ya no se usa)
   */
  function _editSectionInternalOld(sectionName) {
    if (!sectionName) return;

    if (!dom.operationEditorPanel) {
      showToast('Panel de edición no disponible', 'error');
      return;
    }

    // Configurar título
    if (dom.operationEditorTitle) {
      dom.operationEditorTitle.textContent = 'Editar Sección Principal';
    }
    if (dom.operationEditorSubtitle) {
      dom.operationEditorSubtitle.textContent = sectionName;
    }

    // Renderizar formulario
    if (dom.editorTabDatos) {
      dom.editorTabDatos.innerHTML = `
        <div class="mb-3">
          <label class="form-label">Nombre de Sección</label>
          <input type="text" class="form-control" id="editSectionName" value="${escapeHtml(sectionName)}" />
        </div>
        <div class="alert alert-info">
          <i class="bi bi-info-circle me-2"></i>
          Cambiar el nombre de esta sección afectará todas las cuentas asociadas.
        </div>
      `;
    }

    if (dom.editorTabFormula) dom.editorTabFormula.innerHTML = '<p class="text-muted">No aplica para secciones</p>';
    if (dom.editorTabAparicion) dom.editorTabAparicion.innerHTML = '<p class="text-muted">No aplica para secciones</p>';

    // Configurar botón de guardar
    if (dom.btnEditorSave) {
      const saveHandler = () => {
        const newName = document.getElementById('editSectionName')?.value?.trim();
        if (!newName) {
          showToast('El nombre de la sección es requerido', 'warning');
          return;
        }

        // Actualizar todas las cuentas que tienen esta sección
        state.cuentas.forEach(cuenta => {
          const currentSection = getAccountPrincipalName(cuenta);
          if (currentSection === sectionName) {
            if (cuenta['SECCION PRINCIPAL']) cuenta['SECCION PRINCIPAL'] = newName;
            if (cuenta.seccion_principal) cuenta.seccion_principal = newName;
          }
        });

        state.unsavedChanges = true;
        renderLayout();
        showToast('Sección actualizada', 'success');

        if (window.bootstrap?.Offcanvas) {
          const offcanvas = window.bootstrap.Offcanvas.getInstance(dom.operationEditorPanel);
          offcanvas?.hide();
        }

        dom.btnEditorSave.removeEventListener('click', saveHandler);
      };

      dom.btnEditorSave.removeEventListener('click', saveHandler);
      dom.btnEditorSave.addEventListener('click', saveHandler);
    }

    // Configurar botón de eliminar
    if (dom.btnEditorDelete) {
      dom.btnEditorDelete.disabled = false;
      dom.btnEditorDelete.title = "Eliminar sección";
      const deleteHandler = () => {
        if (
          !confirm(
            `¿Eliminar la sección "${sectionName}" y TODAS sus cuentas? Esta acción no se puede deshacer.`
          )
        )
          return;

        state.cuentas = state.cuentas.filter((c) => {
          const principal = getAccountPrincipalName(c) || "";
          return principal !== sectionName;
        });
        logChange("delete", `Sección "${sectionName}" eliminada`, {
          sectionName,
          type: "section",
        });
        renderLayout();
        showToast("Sección eliminada", "success");

        if (window.bootstrap?.Offcanvas) {
          const offcanvas = window.bootstrap.Offcanvas.getInstance(
            dom.operationEditorPanel
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
      const offcanvas = window.bootstrap.Offcanvas.getOrCreateInstance(dom.operationEditorPanel);
      offcanvas.show();
    }
  }

  /**
   * Editar una subsección (LEGACY - ya no se usa)
   */
  function _editSubsectionInternalOld(sectionName, subsectionName) {
    if (!subsectionName) return;

    if (!dom.operationEditorPanel) {
      showToast('Panel de edición no disponible', 'error');
      return;
    }

    // Configurar título
    if (dom.operationEditorTitle) {
      dom.operationEditorTitle.textContent = 'Editar Subsección';
    }
    if (dom.operationEditorSubtitle) {
      dom.operationEditorSubtitle.textContent = `${sectionName} > ${subsectionName}`;
    }

    // Renderizar formulario
    if (dom.editorTabDatos) {
      dom.editorTabDatos.innerHTML = `
        <div class="mb-3">
          <label class="form-label">Sección Principal</label>
          <input type="text" class="form-control" value="${escapeHtml(sectionName)}" readonly />
        </div>
        <div class="mb-3">
          <label class="form-label">Nombre de Subsección</label>
          <input type="text" class="form-control" id="editSubsectionName" value="${escapeHtml(subsectionName)}" />
        </div>
        <div class="alert alert-info">
          <i class="bi bi-info-circle me-2"></i>
          Cambiar el nombre de esta subsección afectará todas las cuentas asociadas.
        </div>
      `;
    }

    if (dom.editorTabFormula) dom.editorTabFormula.innerHTML = '<p class="text-muted">No aplica para subsecciones</p>';
    if (dom.editorTabAparicion) dom.editorTabAparicion.innerHTML = '<p class="text-muted">No aplica para subsecciones</p>';

    // Configurar botón de guardar
    if (dom.btnEditorSave) {
      const saveHandler = () => {
        const newName = document.getElementById('editSubsectionName')?.value?.trim();
        if (!newName) {
          showToast('El nombre de la subsección es requerido', 'warning');
          return;
        }

        // Actualizar todas las cuentas que tienen esta subsección
        state.cuentas.forEach(cuenta => {
          const currentSubsection = getAccountSecondaryName(cuenta);
          if (currentSubsection === subsectionName) {
            if (cuenta['SECCION Secundaria']) cuenta['SECCION Secundaria'] = newName;
            if (cuenta['SECCION SECUNDARIA']) cuenta['SECCION SECUNDARIA'] = newName;
            if (cuenta.seccion_secundaria) cuenta.seccion_secundaria = newName;
          }
        });

        state.unsavedChanges = true;
        renderLayout();
        showToast('Subsección actualizada', 'success');

        if (window.bootstrap?.Offcanvas) {
          const offcanvas = window.bootstrap.Offcanvas.getInstance(dom.operationEditorPanel);
          offcanvas?.hide();
        }

        dom.btnEditorSave.removeEventListener('click', saveHandler);
      };

      dom.btnEditorSave.removeEventListener('click', saveHandler);
      dom.btnEditorSave.addEventListener('click', saveHandler);
    }

    // Configurar botón de eliminar
    if (dom.btnEditorDelete) {
      dom.btnEditorDelete.disabled = false;
      dom.btnEditorDelete.title = "Eliminar subsección";
      const deleteHandler = () => {
        if (
          !confirm(
            `¿Eliminar la subsección "${subsectionName}" y TODAS sus cuentas? Esta acción no se puede deshacer.`
          )
        )
          return;

        state.cuentas = state.cuentas.filter((c) => {
          const principal = getAccountPrincipalName(c) || "";
          const secundaria = getAccountSecondaryName(c) || "";
          return !(
            principal === sectionName && secundaria === subsectionName
          );
        });
        logChange("delete", `Subsección "${subsectionName}" eliminada`, {
          sectionName,
          subsectionName,
          type: "subsection",
        });
        renderLayout();
        showToast("Subsección eliminada", "success");

        if (window.bootstrap?.Offcanvas) {
          const offcanvas = window.bootstrap.Offcanvas.getInstance(
            dom.operationEditorPanel
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
      const offcanvas = window.bootstrap.Offcanvas.getOrCreateInstance(dom.operationEditorPanel);
      offcanvas.show();
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
    const operation = state.operaciones.find(op =>
      getOperationId(op) === operationId ||
      (op.Clase || op.clase) === operationId ||
      (op.OperacionId || op.OperacionID) === operationId
    );

    if (!operation) {
      showToast('Operación no encontrada', 'warning');
      return;
    }

    if (!dom.operationEditorPanel) {
      showToast('Panel de edición no disponible', 'error');
      return;
    }

    // Configurar título
    if (dom.operationEditorTitle) {
      dom.operationEditorTitle.textContent = 'Editar Operación';
    }
    if (dom.operationEditorSubtitle) {
      dom.operationEditorSubtitle.textContent = getOperationDisplayName(operation);
    }

    // Renderizar formulario básico
    if (dom.editorTabDatos) {
      const opId = getOperationId(operation) || '';
      const clase = operation.Clase || operation.clase || '';
      const seccion = operation.SECCION || operation.seccion || '';

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
            <input class="form-check-input" type="checkbox" id="editOpVisible" ${operation.visible !== false ? 'checked' : ''} />
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
      const formula = formatFormula(operation) || '';
      dom.editorTabFormula.innerHTML = `
        <div class="mb-3">
          <label class="form-label">Fórmula</label>
          <textarea class="form-control font-monospace" id="editFormula" rows="4" placeholder="Fórmula de la operación">${escapeHtml(formula)}</textarea>
          <div class="form-text">Edite la fórmula manualmente o use el constructor de fórmulas.</div>
        </div>
        ${window.FormulaBuilder ? '<button type="button" class="btn btn-outline-primary btn-sm" onclick="window.FormulaBuilder.showMap && window.FormulaBuilder.showMap()">Abrir Constructor de Fórmulas</button>' : ''}
      `;
    }

    if (dom.editorTabAparicion) dom.editorTabAparicion.innerHTML = '<p class="text-muted">Próximamente: configuración de aparición</p>';

    // Configurar botón de guardar
    if (dom.btnEditorSave) {
      const saveHandler = () => {
        const clase = document.getElementById('editClase')?.value || '';
        const seccion = document.getElementById('editSeccion')?.value || '';
        const visible = document.getElementById('editOpVisible')?.checked;
        const formula = document.getElementById('editFormula')?.value || '';

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
          showToast('Cambios guardados. La fórmula debe ser validada.', 'info');
        }

        state.unsavedChanges = true;
        renderLayout();
        showToast('Operación actualizada', 'success');

        if (window.bootstrap?.Offcanvas) {
          const offcanvas = window.bootstrap.Offcanvas.getInstance(dom.operationEditorPanel);
          offcanvas?.hide();
        }

        dom.btnEditorSave.removeEventListener('click', saveHandler);
      };

      dom.btnEditorSave.removeEventListener('click', saveHandler);
      dom.btnEditorSave.addEventListener('click', saveHandler);
    }

    // Configurar botón de eliminar
    if (dom.btnEditorDelete) {
      dom.btnEditorDelete.disabled = false;
      const deleteHandler = () => {
        if (!confirm(`¿Eliminar la operación ${getOperationDisplayName(operation)}?`)) return;

        state.operaciones = state.operaciones.filter(op =>
          getOperationId(op) !== operationId
        );
        state.unsavedChanges = true;
        renderLayout();
        showToast('Operación eliminada', 'success');

        if (window.bootstrap?.Offcanvas) {
          const offcanvas = window.bootstrap.Offcanvas.getInstance(dom.operationEditorPanel);
          offcanvas?.hide();
        }

        dom.btnEditorDelete.removeEventListener('click', deleteHandler);
      };

      dom.btnEditorDelete.removeEventListener('click', deleteHandler);
      dom.btnEditorDelete.addEventListener('click', deleteHandler);
    }

    // Abrir panel
    if (window.bootstrap?.Offcanvas) {
      const offcanvas = window.bootstrap.Offcanvas.getOrCreateInstance(dom.operationEditorPanel);
      offcanvas.show();
    }
  }

  /**
   * Editar una etiqueta consolidada (múltiples operaciones con mismo label)
   */
  function editConsolidatedLabel(label, field) {
    // Usar la versión global que tiene la implementación completa
    if (window.editConsolidatedLabel) {
      window.editConsolidatedLabel(label, field);
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

  function resequenceAccountsBySections(sections) {
    if (!Array.isArray(sections) || !sections.length) return;
    const accounts = state.cuentas || [];
    if (!accounts.length) return;
    const baseOrder = Math.min(
      ...accounts.map((cuenta, idx) => getAccountOrder(cuenta, idx))
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
      (subsection) => subsection.accounts || []
    );
    if (!accounts.length) return;
    const baseOrder = Math.min(
      ...accounts.map((cuenta, idx) => getAccountOrder(cuenta, idx))
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
    const rowType = row.dataset.rowType;
    if (rowType === "section") {
      if (row.dataset.generated === "true") return;
      moveSectionOrder(row.dataset.section, direction);
      return;
    }
    if (rowType === "subsection") {
      const sectionName = row.dataset.section || row.dataset.parentSection || "";
      moveSubsectionOrder(sectionName, row.dataset.subsection, direction);
      return;
    }
    if (rowType === "account") {
      moveAccountOrder(
        row.dataset.accountId || row.dataset.cuenta,
        row.dataset.section || row.dataset.parentSection || "",
        row.dataset.subsection || row.dataset.parentSubsection || "",
        direction
      );
      return;
    }
    if (rowType === "operation") {
      moveOperationOrder(
        row.dataset.operationLabel,
        row.dataset.operationId,
        row.dataset.operationKind,
        direction
      );
    }
  }

  function moveSectionOrder(sectionName, direction) {
    if (!sectionName) return;
    const sections = groupBySections(state.cuentas || []);
    const targetKey = normalizeOperationMatch(sectionName);
    const index = sections.findIndex(
      (section) => normalizeOperationMatch(section.name) === targetKey
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
      (item) => normalizeOperationMatch(item.name) === sectionKey
    );
    if (!section) {
      showToast("Subseccion no encontrada", "warning");
      return;
    }
    const subKey = normalizeOperationMatch(subsectionName);
    const index = (section.subsections || []).findIndex(
      (subsection) => normalizeOperationMatch(subsection.name) === subKey
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

  function moveAccountOrder(cuentaCode, sectionName, subsectionName, direction) {
    if (!cuentaCode) return;
    const account = resolveAccountByIdOrCode(cuentaCode);
    if (!account) return;
    const principal = sectionName || getAccountPrincipalName(account);
    const secondary =
      subsectionName || getAccountSecondaryName(account) || "";

    const group = (state.cuentas || []).filter((cuenta) => {
      const principalKey = normalizeOperationMatch(
        getAccountPrincipalName(cuenta)
      );
      const secondaryKey = normalizeOperationMatch(
        getAccountSecondaryName(cuenta) || ""
      );
      return (
        principalKey === normalizeOperationMatch(principal) &&
        secondaryKey === normalizeOperationMatch(secondary || "")
      );
    });
    const ordered = sortAccountsByOrder(group);
    const accountId = getAccountRowId(account);
    const index = ordered.findIndex(
      (cuenta) => getAccountRowId(cuenta) === accountId
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
    if (targets.length > 1) {
      showToast(
        "Esta fila agrupa varias operaciones. Usa Reordenar.",
        "warning"
      );
      return;
    }

    const ordered = sortOperations(state.operaciones || []);
    const op = targets[0];
    const index = ordered.findIndex((item) => item === op);
    if (index === -1) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= ordered.length) return;
    const neighbor = ordered[nextIndex];
    const currentOrder = getOperationOrder(op, index);
    const neighborOrder = getOperationOrder(neighbor, nextIndex);

    op.orden_presentacion = neighborOrder;
    neighbor.orden_presentacion = currentOrder;
    logChange("move", `Operacion "${getOperationDisplayName(op)}" reordenada`);
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

  function findOperationForOrderedRow(row = {}) {
    const candidates = [
      row.opId,
      row.operationId,
      row.operationLabel,
      row.label,
    ]
      .map((value) => (value || "").toString().trim())
      .filter(Boolean);

    for (const candidate of candidates) {
      const direct = findOperationByIdOrLabel(candidate);
      if (direct) return direct;
    }

    const byLabel = findOperationsByRowLabel(row.label || "", row.kind || "");
    if (byLabel.operations?.length === 1) {
      return byLabel.operations[0];
    }
    return null;
  }

  function getTemplateRowsForReorder() {
    const rows = Array.isArray(buildPreviewRowsForEditor())
      ? buildPreviewRowsForEditor()
      : [];
    return rows.filter((row) =>
      ["principal", "subsection", "account", "operation"].includes(row?.type)
    );
  }

  function applyTemplateRowsOrder(orderedRows = [], options = {}) {
    const silent = Boolean(options?.silent);
    if (!Array.isArray(orderedRows) || !orderedRows.length) {
      return { success: false, message: "Sin filas para aplicar." };
    }

    const rows = orderedRows.filter((row) =>
      ["principal", "subsection", "account", "operation"].includes(row?.type)
    );
    if (!rows.length) {
      return { success: false, message: "Sin filas válidas para aplicar." };
    }

    let currentSection = "";
    let currentSubsection = "";
    let cursor = 0;

    const touchedAccounts = new Set();
    const touchedOperations = new Set();

    rows.forEach((row) => {
      const type = row?.type || "";
      if (type === "principal") {
        currentSection = (row.label || row.section || "").toString().trim();
        currentSubsection = "";
        return;
      }

      if (type === "subsection") {
        const parentSection = (
          row.parentSection ||
          row.section ||
          currentSection ||
          ""
        )
          .toString()
          .trim();
        const subsection = (row.label || row.subsection || "").toString().trim();
        if (parentSection) currentSection = parentSection;
        currentSubsection = subsection;
        return;
      }

      if (type === "account") {
        const accountId =
          row.accountId || row.cuenta || row.label || row.codigo || "";
        const account = resolveAccountByIdOrCode(accountId);
        if (!account) return;

        const targetSection = (
          row.parentSection ||
          row.section ||
          currentSection ||
          getAccountPrincipalName(account) ||
          ""
        )
          .toString()
          .trim();
        const targetSubsection = (
          row.parentSubsection ||
          row.subsection ||
          currentSubsection ||
          getAccountSecondaryName(account) ||
          ""
        )
          .toString()
          .trim();

        setAccountPrincipalName(account, targetSection);
        setAccountSecondaryName(account, targetSubsection);
        account.orden_presentacion = cursor;
        account.orden = cursor;
        touchedAccounts.add(getAccountRowId(account));
        cursor += 1;
        return;
      }

      if (type === "operation") {
        const op = findOperationForOrderedRow(row);
        if (!op) return;

        const targetSection = (
          row.parentSection ||
          row.section ||
          currentSection ||
          ""
        )
          .toString()
          .trim();
        const targetSubsection = (
          row.parentSubsection ||
          row.subsection ||
          currentSubsection ||
          ""
        )
          .toString()
          .trim();

        op.orden_presentacion = cursor;
        op.orden = cursor;
        op.parentSection = targetSection;
        op.parentSubsection = targetSubsection;

        const opKey =
          getOperationId(op) ||
          getOperationLabel(op) ||
          (row.opId || row.label || "").toString().trim();
        if (opKey) {
          touchedOperations.add(normalizeOperationMatch(opKey));
        }
        cursor += 1;
      }
    });

    (state.cuentas || []).forEach((cuenta, idx) => {
      const accountId = getAccountRowId(cuenta);
      if (touchedAccounts.has(accountId)) return;
      const fallbackOrder = rows.length + idx;
      cuenta.orden_presentacion = fallbackOrder;
      cuenta.orden = fallbackOrder;
    });

    (state.operaciones || []).forEach((op, idx) => {
      const opKey = normalizeOperationMatch(
        getOperationId(op) || getOperationLabel(op) || ""
      );
      if (opKey && touchedOperations.has(opKey)) return;
      const fallbackOrder = rows.length + idx;
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
      "#toggleColumnAdvanced"
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
          `.template-table thead th[data-col-index="${index}"]`
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
    return lista.map((op) => ({
      ...op,
      CAPITULO: op?.CAPITULO || state.capitulo || "",
      HOJA: op?.HOJA || state.modulo || "",
    }));
  }

  function isColumnConfigOperation(op) {
    if (!op) return false;
    const opId = normalizeOperationMatch(getOperationId(op));
    if (opId === normalizeOperationMatch(COLUMN_CONFIG_ID)) return true;
    if (op[COLUMN_CONFIG_FIELD] || op["columnas-config"]) return true;
    return false;
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

  function findKeyByNormalized(obj, target, normalizer = normalizeOperationMatch) {
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
      operaciones.push({
        CAPITULO: state.capitulo || "",
        HOJA: state.modulo || "",
        Clase: label,
        OperacionId: opId,
        SECCION: "Resultado Operativo",
        "sum-row-operativo": label,
        formula_terms: formulaTerms,
        formula_json: JSON.stringify(normalizedTerms),
        signos: { "sum-row-operativo": 1 },
        visible: true,
        orden: grupo.orden,
        orden_presentacion: grupo.orden,
      });
    });
    return operaciones.sort((a, b) => getOperationOrder(a) - getOperationOrder(b));
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
      (token) => !OPERATIVO_STOP_WORDS.has(token.toLowerCase())
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
          renderedInlineOps.add(getOperationId(op) || op.Clase || op)
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
      if (op["result-net-row"] || op["net-row"] || combined.includes("net result")) {
        operationsByTable.netResults.push(op);
      } else if (op["result-row"] || combined.includes(" results") && !combined.includes("operating")) {
        operationsByTable.results.push(op);
      } else if (combined.includes("consolidated operating") || combined.includes("consolidated_operating")) {
        operationsByTable.consolidatedOperating.push(op);
      } else if (op["sum-row-operativo"] || combined.includes("operating result")) {
        // Distinguir entre operativo de capítulo y consolidado
        if (combined.includes("consolidated")) {
          operationsByTable.consolidatedOperating.push(op);
        } else if (combined.match(/(cdmx|mty|gdl|noreste|noroeste).*operating/)) {
          operationsByTable.chapterOperating.push(op);
        } else {
          operationsByTable.chapterOperating.push(op);
        }
      } else if (op["sum-row-sumavarios-consolidado"] || combined.includes("consolidated")) {
        operationsByTable.consolidated.push(op);
      } else if (op["sum-row-sumavarios"] || op["sum-row"]) {
        // Distinguir entre totales de capítulo y resultados de capítulo
        if (combined.match(/(cdmx|mty|gdl|noreste|noroeste).*(income|expense|ingreso|gasto)/)) {
          operationsByTable.chapterTotals.push(op);
        } else if (combined.match(/(cdmx|mty|gdl|noreste|noroeste).*results?/)) {
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
        } else if (combined.match(/(cdmx|mty|gdl|noreste|noroeste).*operating/)) {
          operationsByTable.chapterOperating.push(op);
        } else if (combined.match(/(cdmx|mty|gdl|noreste|noroeste).*results?/)) {
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
        description: "Sumas de cada capítulo (CDMX INCOME, MTY EXPENSE, NORESTE INCOME, etc.)",
      },
      {
        key: "chapterOperating",
        title: "Operativo por Capítulo",
        icon: "bi-calculator",
        color: "primary",
        description: "Resultado operativo de cada capítulo (CDMX OPERATING, MTY OPERATING, etc.)",
      },
      {
        key: "chapterResults",
        title: "Resultados por Capítulo",
        icon: "bi-clipboard-data",
        color: "secondary",
        description: "Resultados totales de cada capítulo (CDMX RESULTS, MTY RESULTS, etc.)",
      },
      {
        key: "consolidated",
        title: "Consolidados",
        icon: "bi-collection-fill",
        color: "success",
        description: "Consolidación de múltiples capítulos (CONSOLIDATED INCOME, CONSOLIDATED EXPENSE, etc.)",
      },
      {
        key: "consolidatedOperating",
        title: "Operativo Consolidado",
        icon: "bi-graph-up-arrow",
        color: "info",
        description: "Resultado operativo consolidado (CONSOLIDATED OPERATING RESULTS)",
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
        description: "Resultado neto final (NET RESULTS, CONSOLIDATED NET RESULTS)",
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
              } else if (op["sum-row-operativo"] || combined.includes("operating")) {
                color = "primary";
              } else if (op["sum-row-sumavarios-consolidado"] || combined.includes("consolidated")) {
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
            op[field]
          )}</span>`
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
                    ? term.constant ?? term.value ?? "0"
                    : term.value || "???"
                )}
              </span>
            `
              )
              .join("")}
          </div>
        </div>
      `;
    }

    // Mostrar cuentas si es sum-row
    let cuentasHtml = "";
    if (op.SECCION || (op.cuentas && op.cuentas.length > 0)) {
      const cuentasList = op.cuentas || op.SECCION?.split("+").map(c => c.trim()) || [];
      if (cuentasList.length > 0) {
        cuentasHtml = `
          <div class="cuentas-preview mt-2">
            <small class="text-muted d-block mb-1"><i class="bi bi-list-ul"></i> Cuentas:</small>
            <div class="d-flex flex-wrap gap-1">
              ${cuentasList.slice(0, 5).map(cuenta => `
                <code class="badge bg-light text-dark border">${escapeHtml(cuenta)}</code>
              `).join("")}
              ${cuentasList.length > 5 ? `<span class="badge bg-secondary">+${cuentasList.length - 5} más</span>` : ""}
            </div>
          </div>
        `;
      }
    }

    return `
      <div class="operation-card border-${colorTheme} mb-2 p-3 rounded border-start border-4 bg-white shadow-sm hover-shadow ${hiddenClass}" data-operation-id="${escapeAttr(
      opId || ""
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
      displayName
    )}</strong>
                ${
                  termsCount > 0
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
              ${
                rowLabels.length > 0
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
            ${
              window.LayoutControls
                ? window.LayoutControls.renderVisibilityControl(op, "operation")
                : ""
            }
            ${
              window.LayoutControls
                ? window.LayoutControls.renderOrderControl(op, "operation")
                : ""
            }
            <button class="btn btn-sm btn-outline-primary" onclick="window.editOperation('${escapeAttr(
              opId || clase
            ).replace(/'/g, "\\'")}')" ${disabledAttr}>
              <i class="bi bi-pencil"></i> Editar
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="window.deleteOperation('${escapeAttr(
              opId || clase
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
            op[field]
          )}</span>`
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
                    ? term.constant ?? term.value ?? "0"
                    : term.value || "???"
                )}
              </span>
            `
              )
              .join("")}
          </div>
        </div>
      `;
    }

    return `
      <div class="operation-card border-${colorTheme} mb-2 p-3 rounded border-start border-3 bg-white shadow-sm hover-shadow ${hiddenClass}" data-operation-id="${escapeAttr(
      opId || ""
    )}" data-operation-label="${escapeAttr(displayName)}">
        <div class="d-flex align-items-start justify-content-between">
          <div class="flex-grow-1">
            <div class="d-flex align-items-center gap-2 mb-2">
              <i class="bi bi-calculator text-${colorTheme}"></i>
              <strong class="text-${colorTheme}">${escapeHtml(
      displayName
    )}</strong>
              ${
                termsCount > 0
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
            ${
              rowLabels.length > 0
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
            ${
              window.LayoutControls
                ? window.LayoutControls.renderVisibilityControl(op, "operation")
                : ""
            }
            ${
              window.LayoutControls
                ? window.LayoutControls.renderOrderControl(op, "operation")
                : ""
            }
            <button class="btn btn-sm btn-outline-primary" onclick="window.editOperation('${escapeAttr(
              opId || clase
            ).replace(/'/g, "\\'")}')" ${disabledAttr}>
              <i class="bi bi-pencil"></i> Editar
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="window.deleteOperation('${escapeAttr(
              opId || clase
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
          consolidatedLabels.get(label).operations.push(getOperationLabel(op) || op.SECCION);
        }
      });
    });

    // Convert to array and sort by first appearance order
    const sortedLabels = Array.from(consolidatedLabels.entries()).sort(
      (a, b) => a[1].firstIndex - b[1].firstIndex
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
      sortedLabels.forEach(([label, info]) => {
        const formulaStr =
          info.operations.slice(0, 5).join(" + ") +
          (info.operations.length > 5 ? " + ..." : "");
        html += `
          <div class="consolidated-label-row consolidated-${
            info.type
          }" data-label="${escapeAttr(label)}" data-field="${info.field}">
            <div class="label-icon bg-${info.color}">
              <i class="bi ${info.icon}"></i>
            </div>
            <div class="label-content">
              <span class="label-name">${escapeHtml(label)}</span>
              <span class="label-type badge bg-${
                info.color
              } ms-2">${info.type.replace(/-/g, " ")}</span>
            </div>
            <div class="label-formula text-muted">
              <i class="bi bi-equation me-1"></i>
              <span class="formula-text">= ${escapeHtml(formulaStr)}</span>
              <span class="operation-count ms-2">(${
                info.operations.length
              } operaciones)</span>
            </div>
            <div class="label-actions">
              <button class="btn btn-sm btn-outline-primary" onclick="editConsolidatedLabel('${escapeAttr(
                label
              )}', '${info.field}')" title="Editar">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-sm btn-outline-danger" onclick="deleteConsolidatedLabel('${escapeAttr(
                label
              )}', '${info.field}')" title="Eliminar">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
        `;
      });

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
          (c.seccion_secundaria || c["SECCION Secundaria"]).toLowerCase()
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
    const formula = formatFormula(op);
    const isVisible = op.visible !== false;
    const hiddenClass = !isVisible ? "hidden-row" : "";
    const canEdit = state.editMode;
    const disabledAttr = !canEdit ? "disabled" : "";

    return `
      <div class="layout-section operation-section ${tipo}">
        <div class="operation-row ${tipo} ${hiddenClass}" data-operation-id="${escapeAttr(
          opId || ""
        )}" data-operation-label="${escapeAttr(
      displayName
    )}" onclick="window.handleOperationRowClick(event, '${escapeAttr(opId || clase)}')">
          <div class="operation-label">
            <i class="bi bi-calculator"></i>
            <span>${escapeHtml(displayName)}</span>
            <span class="operation-type badge bg-warning text-dark">SUM</span>
          </div>
          <div class="operation-formula small text-muted ms-3" style="flex: 2; font-style: italic;">
            ${escapeHtml(formula)}
          </div>
          <div class="account-actions">
            <button class="btn btn-sm btn-outline-primary" onclick="event.stopPropagation(); editOperation('${escapeAttr(
              opId || clase
            )}')" title="Editar" ${disabledAttr}>
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation(); deleteOperation('${escapeAttr(
              opId || clase
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
    // Build formula from actual account names
    const formula = (accounts || [])
      .filter((account) => !isPlaceholderAccount(account))
      .map((a) => a.NOMBRE || a.nombre || a.CUENTA)
      .join(" + ");

    return `
      <div class="inline-operation-row ${hiddenClass}" data-operation-id="${escapeAttr(
        opId || ""
      )}" data-operation-label="${escapeAttr(
      displayName
    )}" onclick="window.handleOperationRowClick(event, '${escapeAttr(opId || clase)}')">
        <div class="inline-op-icon">
          <i class="bi bi-calculator"></i>
        </div>
        <div class="inline-op-label">
          <span class="op-name">${escapeHtml(displayName)}</span>
          <span class="op-badge badge bg-warning text-dark ms-2">SUM</span>
        </div>
        <div class="inline-op-formula">
          = ${escapeHtml(formula)}
        </div>
        <div class="inline-op-actions">
          <button class="btn btn-sm btn-link p-0" onclick="event.stopPropagation(); editOperation('${escapeAttr(
            opId || clase
          )}')" title="Editar" ${disabledAttr}>
            <i class="bi bi-pencil"></i>
          </button>
          <button type="button" class="btn btn-sm btn-link p-0" onclick="window.handleInlineOperationOrderClick(event, '${escapeAttr(
            displayName
          )}', '${escapeAttr(opId || "")}', '', -1)" title="Subir" ${disabledAttr}>
            <i class="bi bi-arrow-up"></i>
          </button>
          <button type="button" class="btn btn-sm btn-link p-0" onclick="window.handleInlineOperationOrderClick(event, '${escapeAttr(
            displayName
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

  function extractFormulaTerms(op) {
    if (!op) return [];

    // Prefer already normalized terms
    if (Array.isArray(op.formula_terms) && op.formula_terms.length) {
      const terms = op.formula_terms.map((term) => ({
        operator: term.operator || "+",
        type: term.type || "section",
        value: term.value || "",
        constant: term.constant ?? term.constValue ?? null,
        parentSection: term.parentSection,
      }));
      return applyParentSectionHints(op, terms);
    }

    if (op.formula_json) {
      try {
        const parsed = JSON.parse(op.formula_json);
        if (Array.isArray(parsed) && parsed.length) {
          const terms = parsed.map((term) => ({
            operator: term.operator || "+",
            type: term.type || "section",
            value: term.value || "",
            constant: term.constant ?? term.constValue ?? null,
            parentSection: term.parentSection,
          }));
          return applyParentSectionHints(op, terms);
        }
      } catch (error) {
        console.warn("No se pudo leer formula_json", error);
      }
    }

    const terms = [];

    // Helper to sort by numeric suffix (seccion_1, operacion_2, etc.)
    function extractIndex(key) {
      const match = key.match(/_(\d+)/);
      return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
    }

    const candidateKeys = Object.keys(op || {}).filter((k) =>
      /^(seccion|operacion)_\d+$/i.test(k)
    );

    candidateKeys
      .sort((a, b) => extractIndex(a) - extractIndex(b))
      .forEach((key) => {
        const value = op[key];
        if (!value) return;

        const signo = op.signos?.[key];
        const operator = signo < 0 ? "-" : "+";
        const type = key.toLowerCase().startsWith("operacion_")
          ? "operation"
          : "section";

        terms.push({ operator, type, value });
      });

    if (!terms.length && op.SECCION) {
      terms.push({ operator: "+", type: "section", value: op.SECCION });
    }

    return applyParentSectionHints(op, terms);
  }

  function formatFormula(op) {
    const normalizedTerms = extractFormulaTerms(op);

    if (normalizedTerms.length) {
      return normalizedTerms
        .map((term, idx) => {
          const prefix =
            idx === 0
              ? term.operator === "-"
                ? "-"
                : ""
              : ` ${term.operator} `;
          const val =
            term.type === "operation"
              ? formatOperationReference(term.value)
              : term.type === "constant"
              ? term.constant ?? term.value ?? "0"
              : term.value || "???";
          return prefix + val;
        })
        .join("");
    }

    if (op.SECCION) {
      return op.SECCION;
    }
    return "Consolidado";
  }

  function groupBySections(cuentas) {
    const sections = [];
    const sectionMap = new Map();

    const cuentasOrdenadas = sortAccountsByOrder(cuentas || []);

    cuentasOrdenadas.forEach((cuenta, index) => {
      const secundaria = getAccountSecondaryName(cuenta) || "";
      const principal =
        getAccountPrincipalName(cuenta) || secundaria || "Sin sección";

      if (!sectionMap.has(principal)) {
        sectionMap.set(principal, {
          name: principal,
          order: getAccountOrder(cuenta, index),
          subsections: [],
          subsectionMap: new Map(),
        });
        sections.push(sectionMap.get(principal));
      }

      const section = sectionMap.get(principal);
      if (!section.subsectionMap.has(secundaria)) {
        const subsection = {
          name: secundaria || principal,
          order: getAccountOrder(cuenta, index),
          accounts: [],
        };
        section.subsectionMap.set(secundaria, subsection);
        section.subsections.push(subsection);
      }

      section.subsectionMap.get(secundaria).accounts.push(cuenta);
    });

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
    const sectionOpMatch = getRowOperationMatch(principal);
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
          (account) => !isPlaceholderAccount(account)
        ).length,
      0
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
            <span class="badge bg-secondary">${accountCount} cuentas</span>
          </div>
          <div class="section-actions">
            <button class="btn btn-sm btn-outline-secondary" onclick="event.stopPropagation(); moveSectionOrder('${escapeAttr(
              principal
            )}', -1)" title="Subir" ${disabledAttr}>
              <i class="bi bi-arrow-up"></i>
            </button>
            <button class="btn btn-sm btn-outline-secondary" onclick="event.stopPropagation(); moveSectionOrder('${escapeAttr(
              principal
            )}', 1)" title="Bajar" ${disabledAttr}>
              <i class="bi bi-arrow-down"></i>
            </button>
            <button class="btn btn-sm ${sectionOpBtnClass}" onclick="event.stopPropagation(); editRowOperation('${escapeAttr(
              principal
            )}', '${escapeAttr(sectionOpMatch.field || "")}', '')" title="${sectionOpBtnTitle}" ${disabledAttr}>
              <i class="bi bi-calculator"></i>
            </button>
            <button class="btn btn-sm btn-outline-primary" onclick="event.stopPropagation(); editSection('${escapeAttr(
              principal
            )}')" title="Editar">
              <i class="bi bi-pencil"></i>
            </button>
             <button class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation(); deleteSection('${escapeAttr(
               principal
             )}')" title="Eliminar">
              <i class="bi bi-trash"></i>
            </button>
            <button class="btn btn-sm btn-outline-success" onclick="event.stopPropagation(); addToSection('${escapeAttr(
              principal
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
      (account) => !isPlaceholderAccount(account)
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
              principal
            )}', '${escapeAttr(name)}', -1)" title="Subir" ${disabledAttr}>
              <i class="bi bi-arrow-up"></i>
            </button>
            <button class="btn btn-sm btn-outline-secondary" onclick="event.stopPropagation(); moveSubsectionOrder('${escapeAttr(
              principal
            )}', '${escapeAttr(name)}', 1)" title="Bajar" ${disabledAttr}>
              <i class="bi bi-arrow-down"></i>
            </button>
            <button class="btn btn-sm ${subsectionOpBtnClass}" onclick="event.stopPropagation(); editRowOperation('${escapeAttr(
              name
            )}', '${escapeAttr(subsectionOpMatch.field || "")}', '${escapeAttr(
              principal
            )}')" title="${subsectionOpBtnTitle}" ${disabledAttr}>
              <i class="bi bi-calculator"></i>
            </button>
            <button class="btn btn-sm btn-outline-primary" onclick="event.stopPropagation(); editSubsection('${escapeAttr(
              principal
            )}', '${escapeAttr(name)}')" title="Editar subsección">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation(); deleteSubsection('${escapeAttr(
              principal
            )}', '${escapeAttr(name)}')" title="Eliminar subsección">
              <i class="bi bi-trash"></i>
            </button>
            <button class="btn btn-sm btn-outline-secondary" onclick="event.stopPropagation(); addAccount('${escapeAttr(
              principal
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
      codigo
    )}" data-account-id="${escapeAttr(accountId)}" onclick="selectAccount(this, '${escapeAttr(accountId)}')">
        <span class="drag-handle" title="Arrastrar para reordenar">⋮⋮</span>
        <span class="account-code">${escapeHtml(codigo)}</span>
        <span class="account-name">${escapeHtml(nombre)}</span>
        <div class="account-actions d-flex gap-2 align-items-center">
          ${
            window.LayoutControls
              ? window.LayoutControls.renderVisibilityControl(
                  account,
                  "account"
                )
              : ""
          }
          ${
            window.LayoutControls
              ? window.LayoutControls.renderOrderControl(account, "account")
              : ""
          }
          <button class="btn btn-sm btn-outline-primary" onclick="event.stopPropagation(); editAccount('${escapeAttr(
            accountId
          )}')" title="Editar" ${disabledAttr}>
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation(); deleteAccount('${escapeAttr(
            accountId
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
          opId || ""
        )}" data-operation-label="${escapeAttr(displayName)}">
          <div class="operation-label" onclick="editOperation('${escapeAttr(
            opId || clase
          )}')">
            <i class="bi bi-calculator"></i>
            <span>${escapeHtml(displayName)}</span>
            <span class="operation-type">${tipo}</span>
            ${
              termsCount > 0
                ? `<span class="badge bg-secondary ms-2">${termsCount} términos</span>`
                : ""
            }
          </div>
          <div class="account-actions">
            <button class="btn btn-sm btn-outline-primary" onclick="event.stopPropagation(); editOperation('${escapeAttr(
              opId || clase
            )}')" title="Editar" ${disabledAttr}>
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation(); deleteOperation('${escapeAttr(
              opId || clase
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
    updateHeaderLabels();
    await loadYears();
    await loadChapters();
    await tryLoadLayout();
  }

  async function handleAnioChange() {
    state.anio = dom.anioSelect.value;
    updateHeaderLabels();
    await loadChapters();
    await tryLoadLayout();
  }

  async function handleCapituloChange() {
    state.capitulo = dom.capituloSelect.value;
    asegurarEmpresaIdContexto(state.capitulo, true);
    filtrarModulosPorCapitulo(); // Filtrar módulos cuando cambia el capítulo
    updateHeaderLabels();
    await tryLoadLayout();
  }

  function handleSearch(e) {
    const query = e?.target?.value?.toLowerCase().trim() || "";
    applySearchAndFilters(query);
  }
  
  function applySearchAndFilters(query = "") {
    const activeFilter = document.querySelector('input[name="quickFilter"]:checked')?.value || "all";
    
    const sections = document.querySelectorAll(".layout-section");
    const sectionRows = document.querySelectorAll(
      '.template-table tr[data-row-type="section"], .template-table tr[data-row-type="subsection"], .list-item.section-principal, .list-item.section-secondary'
    );
    const accountRows = document.querySelectorAll(
      ".account-row, .list-item.item-account"
    );
    const operationRows = document.querySelectorAll(
      ".operation-row, .inline-operation-row, .list-item.item-operation"
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
      const isOperationSection = section.classList.contains("operation-section");
      let shouldShow = false;
      
      if (activeFilter === "all" || activeFilter === "sections") {
        if (!isOperationSection) {
          const title = section.querySelector(".section-title span")?.textContent?.toLowerCase() || "";
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
          !query || code.includes(query) || name.includes(query) || text.includes(query);
        
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
        ["principal", "subsection", "account", "operation"].includes(row.type)
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
              ${
                detail
                  ? `<div class="small text-muted">${escapeHtml(detail)}</div>`
                  : ""
              }
            </div>
            <div class="order-type">${typeLabel[row.type] || row.type}</div>
            ${
              visible
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
      container.querySelectorAll(".layout-section")
    ).filter(
      (el) => !el.closest(".live-preview-table") // ignorar vista previa superior
    );

    sections.forEach((section) => {
      const header = section.querySelector(".section-header .section-title span");
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
          const name = row.querySelector(".account-name")?.textContent?.trim() || "";
          const hidden = row.classList.contains("hidden-row");
          items.push({
            type: "account",
            label: code,
            cuenta: code,
            nombre: name,
            visible: !hidden,
          });
        });
        sub.querySelectorAll(".inline-operation-row, .operation-row").forEach((row) => {
          const opLabel =
            row.getAttribute("data-operation-label") ||
            row.querySelector(".op-name")?.textContent?.trim() ||
            row.querySelector(".operation-label span")?.textContent?.trim() ||
            "";
          const hidden = row.classList.contains("hidden-row");
          items.push({
            type: "operation",
            label: opLabel,
            kind: row.classList.contains("inline-operation-row") ? "inline" : "",
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
        updateBulkRowFields(row)
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
          `<option value="${opt.value}"${
            opt.value === tipo ? " selected" : ""
          }>${opt.label}</option>`
      )
      .join("");

    const rowId = `bulk_${Date.now().toString(36)}_${++bulkRowCounter}`;
    const kindSeccion = getBulkFieldKind(tipo, "seccion");
    const kindSubseccion = getBulkFieldKind(tipo, "subseccion");
    const seccionOptions = buildBulkSelectOptions(
      getBulkSectionNames(),
      values.seccion || "",
      "Selecciona sección"
    );
    const subseccionOptions = buildBulkSelectOptions(
      getBulkSubsectionNames(values.seccion || ""),
      values.subseccion || "",
      values.seccion ? "Selecciona subsección" : "Selecciona sección"
    );
    const seccionFieldHtml = kindSeccion === "input"
      ? `<input type="text" class="form-control form-control-sm" data-field="seccion" placeholder="Nombre de sección" value="${escapeAttr(
          values.seccion || ""
        )}" />`
      : `<select class="form-select form-select-sm" data-field="seccion">
            ${seccionOptions}
          </select>`;
    const subseccionFieldHtml = kindSubseccion === "input"
      ? `<input type="text" class="form-control form-control-sm" data-field="subseccion" placeholder="Nombre de subsección" value="${escapeAttr(
          values.subseccion || ""
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
          values.cuenta || ""
        )}" /></td>
        <td><input type="text" class="form-control form-control-sm" data-field="nombre" placeholder="Nombre" value="${escapeAttr(
          values.nombre || ""
        )}" /></td>
        <td>
          <select class="form-select form-select-sm" data-field="aparicion">
            ${aparicionOptions}
          </select>
        </td>
        <td><input type="text" class="form-control form-control-sm text-center" data-field="signo" placeholder="1/-1" title="Signo: 1 suma, -1 resta. En cuentas aplica como factor. Vacio = automatico." data-bs-toggle="tooltip" data-bs-placement="top" value="${escapeAttr(
          values.signo || ""
        )}" /></td>
        <td>
          <div class="input-group input-group-sm">
            <input type="text" class="form-control font-monospace" data-field="formula" placeholder="A + B - C" value="${escapeAttr(
              values.formula || ""
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
      }
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
    ].forEach(
      (field) => {
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
      }
    );
    refreshBulkSubsectionOptions(row);
    refreshBulkAparicionOptions(row);
  }

  function ensureBulkFieldType(row, field, kind, config = {}) {
    const cell = row.querySelector(`[data-cell="${field}"]`);
    if (!cell) return;
    const current = cell.querySelector(`[data-field="${field}"]`);
    const currentValue =
      config.value ?? current?.value ?? "";
    if (kind === "input") {
      const placeholder = config.inputPlaceholder || "";
      if (!current || current.tagName !== "INPUT") {
        cell.innerHTML = `<input type="text" class="form-control form-control-sm" data-field="${field}" placeholder="${escapeAttr(
          placeholder
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
      config.placeholder || ""
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
    const sections = groupBySections(state.cuentas || []);
    return sections.map((section) => section.name).filter(Boolean);
  }

  function getBulkSubsectionNames(principal) {
    if (!principal) return [];
    const sections = groupBySections(state.cuentas || []);
    const target = normalizeBulkName(principal);
    const match = sections.find(
      (section) => normalizeBulkName(section.name) === target
    );
    if (!match || !Array.isArray(match.subsections)) return [];
    const names = match.subsections
      .map((sub) => sub.name)
      .filter(Boolean);
    return Array.from(new Set(names));
  }

  function buildBulkSelectOptions(items = [], selected = "", placeholder = "") {
    const normalizedItems = new Set(items.map((item) => normalizeBulkName(item)));
    const normalizedSelected = normalizeBulkName(selected);
    const finalItems =
      selected && normalizedSelected && !normalizedItems.has(normalizedSelected)
        ? [selected, ...items]
        : items;

    const options = [];
    if (placeholder) {
      options.push(
        `<option value="">${escapeHtml(placeholder)}</option>`
      );
    }
    finalItems.forEach((item) => {
      const isSelected =
        normalizedSelected && normalizeBulkName(item) === normalizedSelected;
      options.push(
        `<option value="${escapeAttr(item)}"${
          isSelected ? " selected" : ""
        }>${escapeHtml(item)}</option>`
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
      'select[data-field="subseccion"]'
    );
    if (!subseccionSelect) return;
    const current = subseccionSelect.value || "";
    const options = buildBulkSelectOptions(
      getBulkSubsectionNames(principal),
      current,
      principal ? "Selecciona subsección" : "Selecciona sección"
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
      formulaTerms = [{
        id: Date.now(),
        operator: "+",
        type: "section",
        value: ""
      }];
    }

    // Crear operación temporal para pasar al editor
    const tempOp = {
      OperacionId: "TEMP_BULK_" + Date.now(),
      Clase: nombreOperacion,
      formula_terms: formulaTerms,
      formula_json: JSON.stringify(formulaTerms)
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
      window._bulkFormulaEditorCallback = function(updatedTerms) {
        if (formulaInput) {
          const newFormulaText = buildFormulaPreviewText(updatedTerms);
          formulaInput.value = newFormulaText;
          formulaInput.dispatchEvent(new Event('change', { bubbles: true }));
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

  function parseFormulaText(formula = "") {
    const raw = (formula || "").trim();
    if (!raw) return [];
    const terms = [];
    let buffer = "";
    let operator = "+";

    const flush = () => {
      const token = buffer.trim();
      if (!token) return;
      if (token.includes("||")) {
        const parsed = parseSectionSelection(token);
        if (parsed.section) {
          terms.push({
            operator,
            type: "section",
            value: parsed.section,
            parentSection: parsed.parent,
          });
          return;
        }
      }
      const type = detectTermType(token);
      const term = { operator, type, value: token };
      if (type === "constant" && Number.isFinite(Number(token))) {
        term.constant = Number(token);
      }
      terms.push(term);
    };

    for (let i = 0; i < raw.length; i += 1) {
      const ch = raw[i];
      if (ch === "+" || ch === "-") {
        if (i === 0) {
          operator = ch;
          continue;
        }
        const prev = raw[i - 1];
        const next = raw[i + 1];
        const prevIsSpace = !prev || /\s/.test(prev);
        const nextIsSpace = !next || /\s/.test(next);
        if (prevIsSpace && nextIsSpace) {
          flush();
          buffer = "";
          operator = ch;
          continue;
        }
      }
      buffer += ch;
    }
    flush();

    return normalizeFormulaTerms(terms);
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
      'input[name="tipoElemento"]:checked'
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
            <div class="form-text">Si lo dejas vacio se genera automaticamente.</div>
          </div>
          <div class="mb-3">
            <label class="form-label">Etiqueta de la Operación <span class="text-danger">*</span></label>
            <input type="text" class="form-control" id="inputClase" placeholder="Ej: TOTAL INCOME, NET RESULTS" />
            <div class="invalid-feedback">Etiqueta o ID son obligatorios.</div>
          </div>
          <div class="mb-3">
            <label class="form-label">Tipo de Operación</label>
            <select class="form-select" id="selectTipoOp" onchange="toggleFormulaBuilder()">
              <option value="sum-sections">Suma de secciones</option>
              <option value="custom-formula">Fórmula personalizada</option>
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
                        row.field
                      )}">
                      <label class="form-check-label" for="${rowLabelAddCheckId(
                        row.field
                      )}">${row.label}</label>
                    </div>
                    <input type="text" class="form-control form-control-sm mt-1" id="${rowLabelAddInputId(
                      row.field
                    )}" placeholder="${row.placeholder}">
                  </div>
                `
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
    const sections = groupBySections(state.cuentas);
    if (!Array.isArray(sections) || sections.length === 0) {
      return '<option value="">Sin secciones</option>';
    }
    return sections
      .map((section) => section?.name)
      .filter(Boolean)
      .map(
        (name) =>
          `<option value="${escapeAttr(name)}">${escapeHtml(name)}</option>`
      )
      .join("");
  }

  function getSubsectionOptions() {
    const sections = groupBySections(state.cuentas);
    const options = [];

    (sections || []).forEach((section) => {
      (section.subsections || []).forEach((subsection) => {
        if (subsection?.name) {
          options.push(
            `<option value="${escapeAttr(subsection.name)}">${escapeHtml(
              subsection.name
            )}</option>`
          );
        }
      });
    });

    return options.join("") || '<option value="">Sin subsecciones</option>';
  }

  function getSectionCheckboxes() {
    const sections = groupBySections(state.cuentas);
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
            item.value
          )}" id="chk_${escapeAttr(item.value)}">
          <label class="form-check-label" for="chk_${escapeAttr(
            item.value
          )}">${escapeHtml(item.label)}</label>
        </div>
      `
      )
      .join("");
  }

  async function confirmAdd() {
    if (isBulkModeEnabled()) {
      await confirmBulkAdd();
      return;
    }
    const tipo = document.querySelector(
      'input[name="tipoElemento"]:checked'
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
          "error"
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

    if (!nombre) throw new Error("Ingresa un nombre para la subsección");
    addSecondarySectionByName(principal, nombre);
  }

  async function addAccount() {
    const principal = document.getElementById("selectPrincipal")?.value;
    const secundaria = document.getElementById("selectSecundaria")?.value;
    const cuenta = document.getElementById("inputCuenta")?.value?.trim();
    const nombre = document.getElementById("inputNombre")?.value?.trim();

    if (!cuenta || !nombre)
      throw new Error("Completa el código y nombre de la cuenta");
    addAccountEntry({ principal, secundaria, cuenta, nombre });
  }

  function addPrincipalSectionByName(nombre, { silent = false } = {}) {
    const order = getNextAccountOrder();
    const newAccount = {
      "SECCIÓN Principal": nombre,
      "SECCION Secundaria": "",
      SECCION: nombre,
      CUENTA: "",
      NOMBRE: `[Sección: ${nombre}]`,
      orden: order,
      orden_presentacion: order,
      visible: false,
      __layoutPlaceholder: true,
      __placeholderType: "principal",
    };

    assignAccountRowId(newAccount);
    state.cuentas.push(newAccount);
    logChange("add", `Sección Principal "${nombre}"`, {
      nombre,
      type: "section",
    });
    if (!silent) {
      showToast(`Sección "${nombre}" creada`, "success");
    }
  }

  function addSecondarySectionByName(principal, nombre, { silent = false } = {}) {
    const order = getNextAccountOrder();
    const newAccount = {
      "SECCIÓN Principal": principal,
      "SECCION Secundaria": nombre,
      SECCION: principal,
      CUENTA: "",
      NOMBRE: `[Subsección: ${nombre}]`,
      orden: order,
      orden_presentacion: order,
      visible: false,
      __layoutPlaceholder: true,
      __placeholderType: "secundaria",
    };

    assignAccountRowId(newAccount);
    state.cuentas.push(newAccount);
    logChange("add", `Subsección "${nombre}" en ${principal}`, {
      nombre,
      principal,
      type: "subsection",
    });
    if (!silent) {
      showToast(`Subsección "${nombre}" creada`, "success");
    }
  }

  function addAccountEntry(
    { principal, secundaria, cuenta, nombre, factor },
    { silent = false } = {}
  ) {
    const order = getNextAccountOrder();
    const newAccount = {
      "SECCIÓN Principal": principal,
      "SECCION Secundaria": secundaria,
      SECCION: principal,
      CUENTA: cuenta,
      NOMBRE: nombre,
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
    { nombre, seccion, subseccion, signo, formulaTerms, rowLabels = {} },
    { silent = false } = {}
  ) {
    const opIdBase = normalizeOperationId(nombre || "OPERACION");
    const operacionId = buildUniqueOperationId(opIdBase);
    const parentSection = seccion || "";
    const parentSubsection = subseccion || "";
    const rowSection = subseccion || seccion || "";

    const op = {
      CAPITULO: state.capitulo || "DEFAULT",
      HOJA: state.modulo || "",
      OperacionId: operacionId,
      Clase: nombre,
      operacion_etiqueta: nombre,
      SECCION: rowSection,
      tipo: Array.isArray(formulaTerms) && formulaTerms.length
        ? "custom-formula"
        : "sum-sections",
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

    if (Array.isArray(formulaTerms) && formulaTerms.length) {
      const normalized = normalizeFormulaTerms(formulaTerms);
      op.formula_terms = normalized;
      op.formula_json = JSON.stringify(normalized);
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
    if (!Object.keys(labels).length && defaultLabel) {
      labels["sum-row"] = defaultLabel;
    }
    return labels;
  }

  function inferSignFromSectionName(sectionName) {
    const key = normalizeOperationMatch(sectionName || "");
    if (!key) return 0;
    if (key.includes("gasto") || key.includes("costo") || key.includes("expense")) {
      return -1;
    }
    if (key.includes("ingreso") || key.includes("income")) {
      return 1;
    }
    return 0;
  }

  function findOperationBySectionName(sectionName, parentSection = "") {
    if (!sectionName) return null;
    const target = normalizeOperationMatch(sectionName);
    const parentKey = normalizeOperationMatch(parentSection);
    const matches = (state.operaciones || []).filter(
      (op) =>
        getOperationPlacementCandidates(op).some(
          (candidate) => normalizeOperationMatch(candidate) === target
        )
    );
    if (!matches.length) return null;
    if (parentKey) {
      const filtered = matches.filter(
        (op) =>
          getOperationParentCandidates(op).some(
            (candidate) => normalizeOperationMatch(candidate) === parentKey
          )
      );
      if (filtered.length) {
        const withLabels = filtered.find((op) =>
          ROW_LABEL_FIELDS.some((field) => op?.[field])
        );
        return withLabels || filtered[0] || null;
      }
    }
    const withLabels = matches.find((op) =>
      ROW_LABEL_FIELDS.some((field) => op?.[field])
    );
    return withLabels || matches[0] || null;
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
              { silent: true }
            );
            counters.cuentas += 1;
            break;
          }
          case "operacion": {
            const nombre = row.nombre || row.seccion || row.subseccion;
            if (!nombre) throw new Error("Falta nombre de operación");
            const sign = Number(row.signo);
            const formulaTerms = row.formula
              ? parseFormulaText(row.formula)
              : [];
            
            // VALIDACIÓN: Las operaciones deben tener fórmula
            if (formulaTerms.length === 0) {
              throw new Error(`La operación "${nombre}" debe tener una fórmula. Usa el botón de calculadora para definirla.`);
            }
            
            const aparicion = (row.aparicion || "libre").trim();
            const rowLabels =
              aparicion && aparicion !== "libre"
                ? { [aparicion]: nombre }
                : {};
            addOperationEntry({
              nombre,
              seccion: row.seccion,
              subseccion: row.subseccion,
              signo: Number.isFinite(sign) ? sign : null,
              formulaTerms,
              rowLabels,
            }, { silent: true });
            counters.operaciones += 1;
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
        counters.operaciones ===
        0 &&
      errores.length
    ) {
      throw new Error(errores[0]);
    }

    if (counters.operaciones > 0) {
      state.operaciones = sortOperations(state.operaciones);
      ensureOperationIds();
      // normalizeOperationReferences(); // DESACTIVADO: modo 100% manual
    }

    if (errores.length) {
      console.warn("[BulkAdd] Errores:", errores);
      showToast(
        `${errores[0]}${errores.length > 1 ? ` (+${errores.length - 1} más)` : ""}`,
        "warning"
      );
    }

    bootstrap.Modal.getInstance(dom.modalAgregar)?.hide();
    await saveLayout({ skipConfirmation: true, silent: true, source: "bulk-add" });
    await loadLayout();
    resetBulkInsertTable({ focus: true });

    showToast(
      `Agregadas: ${counters.secciones} secciones, ${counters.subsecciones} subsecciones, ${counters.cuentas} cuentas, ${counters.operaciones} operaciones.`,
      "success"
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
    const tipo = document.getElementById("selectTipoOp")?.value;
    const claseInput = document.getElementById("inputClase");
    const idInput = document.getElementById("inputOperacionId");
    const clase = claseInput?.value?.trim() || "";
    const operacionIdInput = idInput?.value?.trim() || "";

    claseInput?.classList.remove("is-invalid");
    idInput?.classList.remove("is-invalid");
    if (!clase && !operacionIdInput) {
      claseInput?.classList.add("is-invalid");
      idInput?.classList.add("is-invalid");
      showToast("Etiqueta o ID son obligatorios para crear la operación.", "error");
      return;
    }

    const resolvedClase = clase || operacionIdInput;
    const baseOperacionId = operacionIdInput || resolvedClase;
    const operacionId = buildUniqueOperationId(baseOperacionId || clase);

    const checkedSections = Array.from(
      document.querySelectorAll("#checkboxSecciones input:checked")
    ).map((cb) => cb.value);

    const rowLabels = collectAddOperationRowLabels(resolvedClase);
    const isPiloto = isModuloPiloto();

    // Permitir operaciones sin sección para agregarlas en orden libre.

    const parsedSelections = (checkedSections || [])
      .map((value) => parseSectionSelection(value))
      .filter((item) => item.section);
    const targetSelections =
      parsedSelections.length > 0 ? parsedSelections : [{ section: "", parent: "" }];

    const opsCreated = [];
    targetSelections.forEach((selection, idx) => {
      const sectionName = selection.section || "";
      const parentSection = selection.parent || null;
      const parentSubsection = selection.parent ? sectionName : null;
      let op = null;
      if (sectionName) {
        op = findOperationBySectionName(sectionName, parentSection);
      }

      const isNew = !op;
      if (isNew) {
        const opIdBase = normalizeOperationId(
          isPiloto
            ? baseOperacionId || resolvedClase || sectionName || operacionId
            : `${baseOperacionId || resolvedClase || operacionId}_${sectionName || idx + 1}`
        );
        op = {
          CAPITULO: state.capitulo || "DEFAULT",
          HOJA: state.modulo || "",
          OperacionId: buildUniqueOperationId(opIdBase),
          Clase: resolvedClase,
          SECCION: sectionName || "",
          tipo: tipo || "sum-sections",
          signos: {},
          orden: nextOperationOrder(),
          secciones: sectionName ? [sectionName] : [],
          parentSubsection,
          parentSection,
        };
      } else {
        if (sectionName && !op.SECCION) {
          op.SECCION = sectionName;
        }
        if (!op.HOJA) {
          op.HOJA = state.modulo || "";
        }
        if (!op.CAPITULO) {
          op.CAPITULO = state.capitulo || "DEFAULT";
        }
        if (parentSection) {
          op.parentSection = parentSection;
        }
        if (sectionName && !op.parentSubsection) {
          op.parentSubsection = sectionName;
        }
      }

      // Aplicar etiquetas de aparición
      Object.entries(rowLabels).forEach(([field, label]) => {
        if (!label) return;
        op[field] = label;
      });

      // Guardar fórmula para referencia en el gestor
      if (tipo === "custom-formula") {
        if (Array.isArray(formulaTerms) && formulaTerms.length) {
          const normalized = normalizeFormulaTerms(formulaTerms);
          op.formula_terms = normalized;
          op.formula_json = JSON.stringify(normalized);
        } else {
          // Permitir guardar con fórmula vacía para edición manual posterior.
          op.formula_terms = [];
          op.formula_json = JSON.stringify([]);
        }
      } else {
        const sectionValue = sectionName || checkedSections.join(" + ");
        const derivedTerms = buildFormulaTermsFromParent(sectionValue);
        const fallbackTerms = sectionValue
          ? [
              {
                id: Date.now() + idx,
                operator: "+",
                type: "section",
                value: sectionValue,
              },
            ]
          : [];
        const termsToPersist = normalizeFormulaTerms(
          derivedTerms.length ? derivedTerms : fallbackTerms
        );
        if (termsToPersist.length) {
          op.formula_terms = termsToPersist;
          op.formula_json = JSON.stringify(termsToPersist);
          termsToPersist.forEach((term, i) => {
            const key = `seccion_${i + 1}`;
            op[key] = term.value;
            if (!op.signos) op.signos = {};
            op.signos[key] = term.operator === "-" ? -1 : 1;
          });
        }
      }

      if (rowLabels["sum-row"] && !op.signos?.["sum-row"]) {
        const signo = inferSignFromSectionName(sectionName);
        if (signo) {
          if (!op.signos) op.signos = {};
          op.signos["sum-row"] = signo;
          if (op.signo == null) op.signo = signo;
        }
      }

      if (isNew) {
        state.operaciones.push(op);
        opsCreated.push(op);
      }
    });

    if (opsCreated.length) {
      logChange(
        "add",
        `Operación "${resolvedClase}" (${opsCreated.length} secciones)`
      );
    } else {
      logChange("edit", `Operación "${resolvedClase}" actualizada`);
    }

    state.operaciones = sortOperations(state.operaciones);
    ensureOperationIds();
    // normalizeOperationReferences(); // DESACTIVADO: modo 100% manual
    renderLayout();
    showToast(`Operación "${resolvedClase}" guardada`, "success");
  }

  // Helper to find parent section of a subsection
  function getParentSection(subsectionName) {
    if (!subsectionName) return null;
    const account = state.cuentas.find(
      (c) =>
        (c["SECCION Secundaria"] || c.seccion_secundaria) === subsectionName
    );
    return account
      ? account["SECCIÓN Principal"] || account.seccion_principal
      : null;
  }


  function buildSectionIndexes() {
    const primaryIndex = new Map();
    const subsectionIndex = new Map();
    const sections = groupBySections(state.cuentas);

    sections.forEach((section) => {
      const primary = section?.name || "";
      const primaryKey = normalizeKey(primary);
      if (primaryKey && !primaryIndex.has(primaryKey)) {
        primaryIndex.set(primaryKey, primary);
      }
      (section.subsections || []).forEach((subsection) => {
        const subName = subsection?.name || "";
        const subKey = normalizeKey(subName);
        if (!subKey) return;
        if (!subsectionIndex.has(subKey)) {
          subsectionIndex.set(subKey, new Set());
        }
        subsectionIndex.get(subKey).add(primary);
      });
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
        labelKey.includes(normalizeOperationKey(name))
      ) || ""
    );
  }

  function hydrateOperationPlacement() {
    const indexes = buildSectionIndexes();
    const primaryNames = Array.from(indexes.primaryIndex.values());
    const subsectionIndex = indexes.subsectionIndex || new Map();

    state.operaciones = (state.operaciones || []).map((op) => {
      if (!op) return op;
      if (!op.parentSubsection && op.SECCION) {
        op.parentSubsection = op.SECCION;
      }

      if (!op.parentSection) {
        const subKey = normalizeOperationKey(op.parentSubsection || "");
        const parents = subKey ? subsectionIndex.get(subKey) : null;
        if (parents && parents.size === 1) {
          op.parentSection = Array.from(parents)[0];
        }
      }

      if (!op.parentSection) {
        const inferred = inferParentSectionFromLabel(op, primaryNames);
        if (inferred) {
          op.parentSection = inferred;
        }
      }

      return op;
    });
  }

  function buildOperationDedupeKey(op) {
    if (!op) return "";
    const parentSection = normalizeOperationKey(op.parentSection || "");
    const parentSubsection = normalizeOperationKey(
      op.parentSubsection || op.SECCION || ""
    );
    const label = normalizeOperationKey(
      getOperationDisplayName(op) ||
        getOperationLabel(op) ||
        getOperationId(op)
    );
    if (!label) {
      const opId = normalizeOperationKey(getOperationId(op));
      return opId ? `${parentSection}||${parentSubsection}||${opId}` : "";
    }
    return `${parentSection}||${parentSubsection}||${label}`;
  }

  function mergeOperationInto(base, extra) {
    if (!base || !extra) return base;
    const rowFields = [
      ...ROW_LABEL_FIELDS,
      "net-row-adicional",
    ];
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
    if (!base.formula_terms && extra.formula_terms) {
      base.formula_terms = extra.formula_terms;
    }
    if (!base.formula_json && extra.formula_json) {
      base.formula_json = extra.formula_json;
    }
    if (extra.signos) {
      base.signos = base.signos || {};
      Object.keys(extra.signos).forEach((key) => {
        if (base.signos[key] === undefined) {
          base.signos[key] = extra.signos[key];
        }
      });
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
        getOperationId(op) || getOperationLabel(op)
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
          "warning"
        );
      }
    }

    return { removed };
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
        p.toLowerCase().includes("income")
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
        p.toLowerCase().includes("other income")
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
      const parentSection = inferParentSectionForTerm(
        op,
        term.value,
        indexes
      );
      if (!parentSection) return term;
      return { ...term, parentSection };
    });
  }

  // ==========================================
  // MODAL: COPY
  // ==========================================
  function openCopyModal() {
    if (!state.editMode) {
      showToast("Activa el modo edición primero", "warning");
      return;
    }

    dom.copiaOrigen.textContent = `${state.modulo} ${state.anio}`;
    dom.anioDestino.value = "";

    new bootstrap.Modal(dom.modalCopiar).show();
  }

  async function confirmCopy() {
    const anioDestino = dom.anioDestino.value?.trim();

    if (!anioDestino || isNaN(anioDestino)) {
      showToast("Ingresa un año válido", "warning");
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE}/${encodeURIComponent(state.modulo)}/copiar`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            empresaId: obtenerEmpresaIdApi(),
            anioOrigen: parseInt(state.anio),
            anioDestino: parseInt(anioDestino),
          }),
        }
      );

      if (!response.ok) throw new Error("No se pudo copiar el layout");

      bootstrap.Modal.getInstance(dom.modalCopiar)?.hide();
      showToast(`Layout copiado a ${anioDestino}`, "success");

      // Registrar en bitácora
      await addToBitacora(
        "COPIAR",
        `Se copió el layout de ${state.anio} a ${anioDestino} para el capítulo ${state.capitulo}`
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
      await saveLayout({ skipConfirmation: true, silent: true, source: reason });
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

              ${
                summary.added.length
                  ? `
                <div class="mb-3">
                  <label class="form-label">Identificador unico</label>
                  <input type="text" class="form-control" id="inputOperacionId" placeholder="Ej: CDMX_INCOME" />
                  <div class="form-text">Si lo dejas vacio se genera automaticamente.</div>
                </div>
                <div class="mb-3">
                  <h6 class="text-success"><i class="bi bi-plus-circle me-2"></i>Agregados (${
                    summary.added.length
                  })</h6>
                  <ul class="list-unstyled ms-3">
                    ${summary.added
                      .slice(0, 5)
                      .map(
                        (item) =>
                          `<li class="text-muted small">✓ ${escapeHtml(
                            item
                          )}</li>`
                      )
                      .join("")}
                    ${
                      summary.added.length > 5
                        ? `<li class="text-muted small fst-italic">...y ${
                            summary.added.length - 5
                          } más</li>`
                        : ""
                    }
                  </ul>
                </div>
              `
                  : ""
              }

              ${
                summary.edited.length
                  ? `
                <div class="mb-3">
                  <h6 class="text-primary"><i class="bi bi-pencil me-2"></i>Editados (${
                    summary.edited.length
                  })</h6>
                  <ul class="list-unstyled ms-3">
                    ${summary.edited
                      .slice(0, 5)
                      .map(
                        (item) =>
                          `<li class="text-muted small">✓ ${escapeHtml(
                            item
                          )}</li>`
                      )
                      .join("")}
                    ${
                      summary.edited.length > 5
                        ? `<li class="text-muted small fst-italic">...y ${
                            summary.edited.length - 5
                          } más</li>`
                        : ""
                    }
                  </ul>
                </div>
              `
                  : ""
              }

              ${
                summary.deleted.length
                  ? `
                <div class="mb-3">
                  <h6 class="text-danger"><i class="bi bi-trash me-2"></i>Eliminados (${
                    summary.deleted.length
                  })</h6>
                  <ul class="list-unstyled ms-3">
                    ${summary.deleted
                      .slice(0, 5)
                      .map(
                        (item) =>
                          `<li class="text-muted small">✓ ${escapeHtml(
                            item
                          )}</li>`
                      )
                      .join("")}
                    ${
                      summary.deleted.length > 5
                        ? `<li class="text-muted small fst-italic">...y ${
                            summary.deleted.length - 5
                          } más</li>`
                        : ""
                    }
                  </ul>
                </div>
              `
                  : ""
              }

              ${
                summary.renamed.length
                  ? `
                <div class="mb-3">
                  <h6 class="text-warning"><i class="bi bi-arrow-left-right me-2"></i>Renombrados (${
                    summary.renamed.length
                  })</h6>
                  <ul class="list-unstyled ms-3">
                    ${summary.renamed
                      .slice(0, 5)
                      .map(
                        (item) =>
                          `<li class="text-muted small">✓ ${escapeHtml(
                            item
                          )}</li>`
                      )
                      .join("")}
                    ${
                      summary.renamed.length > 5
                        ? `<li class="text-muted small fst-italic">...y ${
                            summary.renamed.length - 5
                          } más</li>`
                        : ""
                    }
                  </ul>
                </div>
              `
                  : ""
              }

              ${
                summary.moved.length
                  ? `
                <div class="mb-3">
                  <h6 class="text-info"><i class="bi bi-arrows-move me-2"></i>Movidos (${
                    summary.moved.length
                  })</h6>
                  <ul class="list-unstyled ms-3">
                    ${summary.moved
                      .slice(0, 5)
                      .map(
                        (item) =>
                          `<li class="text-muted small">✓ ${escapeHtml(
                            item
                          )}</li>`
                      )
                      .join("")}
                    ${
                      summary.moved.length > 5
                        ? `<li class="text-muted small fst-italic">...y ${
                            summary.moved.length - 5
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
          "error"
        );
      }
      console.error("Contexto incompleto:", {
        modulo: state.modulo,
        anio: state.anio,
        capitulo: state.capitulo,
      });
      return false;
    }

    // Antes de guardar, sincronizar orden real de la vista previa con orden_presentacion.
    // Evita que operaciones queden "hasta abajo" por órdenes heredados/antiguos.
    if (state.unsavedChanges === true) {
      try {
        const previewRows = getTemplateRowsForReorder();
        if (previewRows.length) {
          applyTemplateRowsOrder(previewRows, { silent: true });
        }
      } catch (orderSyncError) {
        console.warn("[saveLayout] No se pudo sincronizar orden visual", orderSyncError);
      }
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
      // Save accounts
      const accResponse = await fetch(
        `${API_BASE}/${encodeURIComponent(state.modulo)}/${
          state.anio
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
        }
      );

      if (!accResponse.ok) {
        const errorData = await accResponse.json().catch(() => ({}));
        throw new Error(
          errorData.mensaje || `Error ${accResponse.status} al guardar cuentas`
        );
      }

      // Save operations
      // MODO 100% MANUAL: desactivar funciones automáticas
      // hydrateOperationsFromParents(); // No inferir ubicaciones
      // hydrateOperationPlacement(); // No inferir placement
      // dedupeOperations({ silent: true }); // No eliminar duplicados automáticamente
      ensureOperationIds(); // Solo asegurar IDs si faltan
      // normalizeOperationReferences(); // DESACTIVADO: modo 100% manual
      const operacionesOrdenadas = sortOperations(state.operaciones);
      state.operaciones = operacionesOrdenadas;
      const operacionesParaGuardar = buildOperacionesParaGuardar(
        operacionesOrdenadas
      );
      const opResponse = await fetch(
        `${API_BASE}/${encodeURIComponent(state.modulo)}/${
          state.anio
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
        }
      );

      if (!opResponse.ok) {
        const errorData = await opResponse.json().catch(() => ({}));
        throw new Error(
          errorData.mensaje ||
            `Error ${opResponse.status} al guardar operaciones`
        );
      }

      state.unsavedChanges = false;
      state.changeLog = []; // Limpiar log de cambios
      state.columnasConfigChanged = false;
      updateButtonStates();
      setStatus(silent ? "Guardado automatico" : "Guardado correctamente");
      if (!silent) {
        showToast("✅ Layout guardado exitosamente", "success");
      }

      // Registrar en bitácora
      await addToBitacora(
        "GUARDAR",
        `Se guardaron ${changesSummary.total} cambios en ${state.modulo} ${state.anio}: ${changesSummary.summary}`
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
      const estructuraUrl = window.location.protocol === "file:"
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

      const saveResponse = await fetch(`${API_BASE}/${encodeURIComponent(state.modulo)}/${state.anio}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(layoutData),
      });

      if (!saveResponse.ok) {
        throw new Error("No se pudo guardar el layout");
      }

      showToast(`Layout RESUMEN 2025 creado con ${operaciones.length} operaciones`, "success");

      // Registrar en bitácora
      await addToBitacora(
        "CREAR",
        `Se generó layout RESUMEN 2025 con estructura completa de ${operaciones.length} operaciones`
      );

      // Recargar layout
      await loadLayout();

    } catch (error) {
      console.error("Error creando RESUMEN 2025:", error);
      showToast(`Error: ${error.message}`, "error");
      
      // Fallback: crear manualmente
      const usarManual = confirm(
        "No se pudo cargar la estructura automáticamente. ¿Deseas crear manualmente las operaciones básicas?"
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
          { value: "CONSOLIDATED_OPERATING_RESULTS", operator: "+", type: "operation" },
        ],
        orden: 6,
      },
    ];

    state.operaciones = operacionesBasicas;

    showToast("6 operaciones básicas creadas. Edita para agregar más.", "success");
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
    icon.className = `bi bi-${
      type === "success"
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
            "Usa el botón de editar para configurar la fórmula."
        );
        return;
      }
    }

    console.log("Mostrando mapa para:", getOperationLabel(op) || operationId, "términos:", op.formula_terms);

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
      row?.dataset?.accountId || row?.getAttribute?.("data-account-id") || codigo;
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
    direction
  ) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    moveOperationOrder(label, opId, kind, direction);
  };

window.editSection = function (name) {
    if (!requireEditMode()) return;
    
    // Buscar si existe una operación para esta sección
    const secOpId = `SECPRIN_${normalizeOperationId(name)}`;
    let operation = state.operaciones.find(op => 
      getOperationId(op) === secOpId ||
      (op.SECCION === name && op.tipo_operacion === 'seccion')
    );
    if (!operation) {
      operation = findOperationBySectionName(name);
    }
    
    // Si no existe, crear una operación automáticamente
    if (!operation) {
      // Obtener todas las subsecciones de esta sección
      const subsecciones = [...new Set(
        state.cuentas
          .filter(c => (getAccountPrincipalName(c) || '') === name)
          .map(c => getAccountSecondaryName(c))
          .filter(Boolean)
      )];
      
      const formulaTerms = subsecciones.map((subsec, idx) => ({
        id: Date.now() + idx,
        operator: '+',
        type: 'section',
        value: subsec,
        parentSection: name
      }));
      
      operation = {
        OperacionId: secOpId,
        Clase: name,
        SECCION: name,
        tipo_operacion: 'seccion',
        visible: true,
        formula_terms: formulaTerms,
        formula_json: JSON.stringify(formulaTerms),
        HOJA: state.modulo || 'RESUMEN',
        CAPITULO: state.capitulo,
        rowStyle: 'sum-row-principal'
      };
      
      state.operaciones.push(operation);
      state.unsavedChanges = true;
    }
    
    // Usar el editor de operaciones estándar
    if (typeof coreEditOperation === 'function') {
      coreEditOperation(getOperationId(operation));
    } else if (typeof window.editOperation === 'function') {
      window.editOperation(getOperationId(operation));
    }
  };
  
  window._editSectionOriginal = function (name) {
    dom.formEditar.innerHTML = `
      <div class="mb-3">
        <label class="form-label">Nombre de la Sección</label>
        <input type="text" class="form-control" id="editNombreSeccion" value="${escapeHtml(
          name
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
    if (
      !confirm(
        `¿Eliminar la sección "${name}" y TODAS sus cuentas? Esta acción no se puede deshacer.`
      )
    )
      return;

    state.cuentas = state.cuentas.filter((c) => {
      const principal =
        c["SECCIÓN Principal"] ||
        c["SECCIàN Principal"] ||
        c["SECCION Principal"] ||
        c.SECCION ||
        c.seccion_principal;
      return principal !== name;
    });

    state.unsavedChanges = true;
    updateButtonStates();
    renderLayout();
    updateStats();
    showToast(`Sección "${name}" eliminada`, "success");
  };

  window.editSubsection = function (principal, name) {
    if (!requireEditMode()) return;
    
    // Buscar si existe una operación para esta subsección
    const subsecOpId = `SUBSEC_${normalizeOperationId(name)}`;
    let operation = state.operaciones.find(op => 
      getOperationId(op) === subsecOpId ||
      (op.SECCION === name && op.tipo_operacion === 'subseccion')
    );
    if (!operation) {
      operation = findOperationBySectionName(name, principal);
    }
    
    // Si no existe, crear una operación automáticamente
    if (!operation) {
      // Obtener todas las cuentas de esta subsección
      const cuentasSubsec = state.cuentas.filter(c => {
        const sec = getAccountSecondaryName(c) || '';
        return sec === name;
      });
      
      const formulaTerms = cuentasSubsec.map((cuenta, idx) => ({
        id: Date.now() + idx,
        operator: '+',
        type: 'account',
        value: cuenta.CUENTA || cuenta.cuenta,
      }));
      
      operation = {
        OperacionId: subsecOpId,
        Clase: name,
        SECCION: name,
        tipo_operacion: 'subseccion',
        visible: true,
        formula_terms: formulaTerms,
        formula_json: JSON.stringify(formulaTerms),
        HOJA: state.modulo || 'RESUMEN',
        CAPITULO: state.capitulo,
        rowStyle: 'subsection-row'
      };
      
      state.operaciones.push(operation);
      state.unsavedChanges = true;
    }
    
    // Usar el editor de operaciones estándar
    if (typeof coreEditOperation === 'function') {
      coreEditOperation(getOperationId(operation));
    } else if (typeof window.editOperation === 'function') {
      window.editOperation(getOperationId(operation));
    }
  };
  
  window._editSubsectionOriginal = function (principal, name) {
    dom.formEditar.innerHTML = `
      <div class="mb-3">
        <label class="form-label">Sección Principal</label>
        <input type="text" class="form-control" value="${escapeHtml(
          principal
        )}" readonly disabled />
      </div>
      <div class="mb-3">
        <label class="form-label">Nombre de la Subsección</label>
        <input type="text" class="form-control" id="editNombreSubseccion" value="${escapeHtml(
          name
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
    if (
      !confirm(
        `¿Eliminar la subsección "${name}" y TODAS sus cuentas? Esta acción no se puede deshacer.`
      )
    )
      return;

    state.cuentas = state.cuentas.filter((c) => {
      const p =
        c["SECCIÓN Principal"] ||
        c["SECCIàN Principal"] ||
        c["SECCION Principal"] ||
        c.SECCION ||
        c.seccion_principal;
      const s =
        c["SECCION Secundaria"] ||
        c["SECCIÓN Secundaria"] ||
        c.seccion_secondary;
      return !(p === principal && s === name);
    });

    state.unsavedChanges = true;
    updateButtonStates();
    renderLayout();
    updateStats();
    showToast(`Subsección "${name}" eliminada`, "success");
  };

  window.addToSection = function (principal) {
    if (!requireEditMode()) return;
    document.querySelector(
      'input[name="tipoElemento"][value="cuenta"]'
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

    // Obtener todas las secciones disponibles para los selectores
    const sections = groupBySections(state.cuentas || []);
    const principalOptions = sections.map(s =>
      `<option value="${escapeAttr(s.name)}" ${s.name === seccionPrincipal ? 'selected' : ''}>${escapeHtml(s.name)}</option>`
    ).join('');

    const currentSection = sections.find(s => s.name === seccionPrincipal);
    const subsectionOptions = (currentSection?.subsections || []).map(sub =>
      `<option value="${escapeAttr(sub.name)}" ${sub.name === seccionSecundaria ? 'selected' : ''}>${escapeHtml(sub.name)}</option>`
    ).join('');

    dom.formEditar.innerHTML = `
      <div class="mb-3">
        <label class="form-label">Código</label>
        <input type="text" class="form-control" id="editCodigo" value="${escapeHtml(
          codigoCuenta
        )}" />
      </div>
      <div class="mb-3">
        <label class="form-label">Nombre</label>
        <input type="text" class="form-control" id="editNombre" value="${escapeHtml(
          cuenta.NOMBRE || ""
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
          factorValue === 1 ? "" : String(factorValue)
        )}" />
        <div class="form-text">Aplica a todas las columnas (real, presupuesto y comparativo).</div>
      </div>
      <div class="mb-3">
        <div class="form-check">
          <input class="form-check-input" type="checkbox" id="editVisible" ${cuenta.visible !== false ? 'checked' : ''} />
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
  window.updateEditSubsectionOptions = function() {
    const principalSelect = document.getElementById("editSeccionPrincipal");
    const secondarySelect = document.getElementById("editSeccionSecundaria");
    if (!principalSelect || !secondarySelect) return;

    const selectedPrincipal = principalSelect.value;
    const sections = groupBySections(state.cuentas || []);
    const currentSection = sections.find(s => s.name === selectedPrincipal);

    let options = '<option value="">Sin subsección</option>';
    if (currentSection && currentSection.subsections) {
      currentSection.subsections.forEach(sub => {
        options += `<option value="${escapeAttr(sub.name)}">${escapeHtml(sub.name)}</option>`;
      });
    }
    secondarySelect.innerHTML = options;
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
        (c) => getAccountRowId(c) !== accountId
      );
    } else {
      state.cuentas = state.cuentas.filter((c) => c.CUENTA !== codigo);
    }
    state.unsavedChanges = true;
    updateButtonStates();
    logChange("delete", `Cuenta ${codigoCuenta}${nombre ? " - " + nombre : ""}`, {
      codigo: codigoCuenta,
      nombre,
      accountId,
    });
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
      (account) => !isPlaceholderAccount(account)
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
        (account) => !isPlaceholderAccount(account)
      );
    }

    if (matchingAccounts.length === 0) {
      return `<span class="text-muted">No se encontraron cuentas en la sección "${escapeHtml(
        sectionName
      )}" (${state.cuentas.length} cuentas en total)</span>`;
    }

    return matchingAccounts
      .map(
        (c) => `
      <div class="d-flex align-items-center mb-1">
        <i class="bi bi-journal-text text-primary me-2"></i>
        <code class="me-2">${escapeHtml(c.CUENTA)}</code>
        <span class="text-muted small">${escapeHtml(
          c.NOMBRE || c.nombre || ""
        )}</span>
      </div>
    `
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
          Esta operación aparecerá en <strong>${
            tables.length
          }</strong> tabla(s):
        </div>
        ${tables
          .map(
            (table) => `
          <div class="table-preview-item bg-${
            table.color
          } bg-opacity-10 border-${
              table.color
            } border-start border-3 p-2 rounded mb-2">
            <div class="d-flex align-items-center gap-2">
              <i class="bi ${table.icon} text-${table.color} fs-5"></i>
              <div class="flex-grow-1">
                <div class="fw-semibold text-${table.color}">${
              table.label
            }</div>
                <div class="small text-muted">Como: <code class="text-dark">${escapeHtml(
                  table.value
                )}</code></div>
              </div>
              <span class="badge bg-${table.color}">Visible</span>
            </div>
          </div>
        `
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
        editConsolidatedLabel(operationId, match.field || "sum-row");
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
          if (item?.nombre) knownOperations.add(normalizeOperacionKey(item.nombre));
          if (item?.id) knownOperations.add(normalizeOperacionKey(item.id));
          if (item?.identificador) knownOperations.add(normalizeOperacionKey(item.identificador));
        });
        applyPredefinedToExisting(op, opPredefinida, op.orden, knownOperations, {
          force: true,
        });
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
      if (opItem.label) operationKeys.add(normalizeOperationMatch(opItem.label));
    });
    const sectionNames = availableElements.sections.map((s) =>
      normalizeOperationMatch(s)
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
        (s) => s.includes(lower) || lower.includes(s)
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

    if (formulaTerms.length === 0) {
      const derivedFromParent = buildFormulaTermsFromParent(
        op.SECCION || op.Clase
      );
      if (derivedFromParent.length) {
        formulaTerms = derivedFromParent;
      } else {
        formulaTerms.push({
          id: Date.now(),
          operator: "+",
          type: "section",
          value: op.SECCION || "",
        });
      }
    }

    // Also add references from operation types (sum-row, etc) that may reference sections
    const opTypes = [
      "sum-row",
      "sum-row-sumavarios",
      "sum-row-sumavarios2",
      "sum-row-sumavarios-consolidado",
      "sum-row-operativo",
      "result-row",
      "net-row",
      "result-net-row",
    ];

    // If we still have no terms, create from SECCION or operation types
    if (formulaTerms.length === 0) {
      // Use SECCION as primary
      if (op.SECCION) {
        formulaTerms.push({
          id: Date.now(),
          operator: "+",
          type: detectValueType(op.SECCION),
          value: op.SECCION,
        });
      } else {
        // Fallback: add a placeholder
        formulaTerms.push({
          id: Date.now(),
          operator: "+",
          type: "section",
          value: "",
        });
      }
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
            row.field
          )}" value="${escapeHtml(op[row.field] || "")}" placeholder="${
        row.placeholder
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
          opLabelInput
        )}" />
      </div>

      <div class="mb-3">
        <label class="form-label d-flex align-items-center gap-2">
          Tipo de fila
          <i class="bi bi-info-circle text-muted" data-aparicion-help="true" title="${escapeAttr(
            tipoTooltip
          )}"></i>
        </label>
        <select class="form-select" id="editOperacionTipo" data-aparicion-select="true" data-initial-tipo="${escapeAttr(
          tipoSeleccionado
        )}" title="${escapeAttr(
          tipoTooltip
        )}">
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

    // Asegurar que op tenga formula_terms poblados antes de pasarlo a FormulaBuilder
    console.log("📝 editOperation - formulaTerms construidos:", formulaTerms);
    let termsForBuilder = formulaTerms;
    if (
      termsForBuilder.length === 1 &&
      termsForBuilder[0].type === "section"
    ) {
      const expanded = expandSectionTerms(termsForBuilder);
      if (expanded.some((term) => term.type === "account")) {
        termsForBuilder = expanded;
      }
    }
    formulaTerms = termsForBuilder;
    op.formula_terms = termsForBuilder;
    op.formula_json = JSON.stringify(normalizeFormulaTerms(termsForBuilder));
    console.log("📝 editOperation - op completo:", op);

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
        key
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
        key
    );

    const identificadoresServidor = Array.from(
      new Map(
        duplicados
          .flatMap((item) => [getOperationId(item), getOperationLabel(item)])
          .map((value) => (value || "").toString().trim())
          .filter(Boolean)
          .map((value) => [normalizeOperationMatch(value), value])
      ).values()
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
      }
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
            identificador || opId || label || operationId
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

  // Edit a consolidated label (shows all contributing operations and accounts)
  window.editConsolidatedLabel = function (label, field) {
    if (!requireEditMode()) return;
    const modalTitle = dom.modalEditar?.querySelector(".modal-title");
    if (modalTitle) {
      modalTitle.textContent = `Editar etiqueta: ${label}`;
    }

    const match = findOperationsByRowLabel(label, field);
    const resolvedField = match.field || field;
    const affectedOps = match.operations.length
      ? match.operations
      : state.operaciones.filter((op) => op[resolvedField] === label);

    if (affectedOps.length === 0) {
      showToast("No se encontraron operaciones para esta etiqueta", "error");
      return;
    }

    const derivedTerms = buildFormulaTermsForRowLabel(label, resolvedField);
    if (derivedTerms.length) {
      formulaTerms = derivedTerms;
    } else {
      // Collect all formula terms from all affected operations
      formulaTerms = [];
      let idCounter = Date.now();

      affectedOps.forEach((op) => {
        // Extract formula terms from this operation
        const opTerms = extractFormulaTerms(op);

        // Add each term with unique ID and the operation operator
        opTerms.forEach((term) => {
          formulaTerms.push({
            id: idCounter++,
            operator: term.operator || "+",
            type: term.type || "section",
            value: term.value || "",
            sourceOperation: op.Clase || op.SECCION, // Track which operation this came from
          });
        });
      });
    }

    // Expand section terms to individual accounts
    expandSectionTermsToAccounts();

    // Build modal content
    dom.formEditar.innerHTML = `
      <div class="mb-3">
        <label class="form-label">Etiqueta Consolidada</label>
        <input type="text" class="form-control" id="editConsolidatedLabelName" value="${escapeHtml(
          label
        )}" />
        <small class="text-muted">Tipo: ${escapeHtml(resolvedField)}</small>
      </div>
      
      <div class="mb-3">
        <label class="form-label">Operaciones que contribuyen (${
          affectedOps.length
        })</label>
        <div class="bg-light p-2 rounded border" style="max-height: 100px; overflow-y: auto;">
          ${affectedOps
            .map(
              (op) => `
            <div class="d-flex align-items-center mb-1">
              <i class="bi bi-arrow-right-short text-muted me-1"></i>
              <span class="small">${escapeHtml(op.Clase || op.SECCION)}</span>
            </div>
          `
            )
            .join("")}
        </div>
      </div>

      <div class="mt-3">
        <label class="form-label">Mapa de Operación (por subsección)</label>
        <div id="formulaMap" class="formula-map mb-3">
          <!-- Se poblará dinámicamente -->
        </div>

        <div class="d-flex align-items-center justify-content-between mb-2">
          <label class="form-label mb-0">Cuentas incluidas (editable)</label>
          <button type="button" class="btn btn-outline-success btn-sm" onclick="addFormulaTerm()">
            <i class="bi bi-plus-lg me-1"></i>Agregar cuenta
          </button>
        </div>
        <div id="formulaTerms" class="formula-terms mb-2">
          <!-- Se poblará dinámicamente -->
        </div>
        <div class="alert alert-info small">
          <i class="bi bi-info-circle me-1"></i>
          Esta vista muestra todas las cuentas que contribuyen al total consolidado.
        </div>
      </div>
    `;

    state.selectedElement = {
      type: "consolidatedLabel",
      label,
      field: resolvedField,
      affectedOps,
    };
    updateSelectionInfo();

    renderFormulaTerms();
    new bootstrap.Modal(dom.modalEditar).show();
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
        `¿Eliminar la etiqueta "${label}" de ${affectedOps.length} operaciones?\n\nOperaciones afectadas: ${opsList}${more}`
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
      "success"
    );
  };

  window.updateSubsectionOptions = function () {
    const principal = document.getElementById("selectPrincipal")?.value;
    const selectS = document.getElementById("selectSecundaria");
    if (!selectS) return;

    const sections = groupBySections(state.cuentas);
    const section = sections.find((s) => s.name === principal);
    const subs = section?.subsections || [];

    if (subs.length > 0) {
      selectS.innerHTML =
        subs
          .filter((subsection) => subsection.name)
          .map(
            (subsection) =>
              `<option value="${escapeAttr(subsection.name)}">${escapeHtml(
                subsection.name
              )}</option>`
          )
          .join("") || '<option value="">Sin subsecciones</option>';
    } else {
      selectS.innerHTML = '<option value="">Sin subsecciones</option>';
    }
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
      const feedback =
        input.parentElement?.querySelector(".invalid-feedback");
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
          state.selectedElement.accountId || state.selectedElement.codigo
        );
      if (!cuenta) return;
      state.selectedElement.cuenta = cuenta;
      const oldCodigo = cuenta.CUENTA;
      const oldNombre = cuenta.NOMBRE;
      const newCodigo = document.getElementById("editCodigo")?.value?.trim();
      const newNombre = document.getElementById("editNombre")?.value?.trim();
      const newSeccionPrincipal = document.getElementById("editSeccionPrincipal")?.value?.trim();
      const newSeccionSecundaria = document.getElementById("editSeccionSecundaria")?.value?.trim();
      const newFactorRaw = document.getElementById("editFactor")?.value?.trim();
      const newVisible = document.getElementById("editVisible")?.checked;

      let changed = false;
      if (newCodigo && newCodigo !== oldCodigo) {
        cuenta.CUENTA = newCodigo;
        logChange("edit", `Cuenta ${oldCodigo} → ${newCodigo}`, {
          oldCodigo,
          newCodigo,
          type: "codigo",
        });
        changed = true;
      }
      if (newNombre && newNombre !== oldNombre) {
        cuenta.NOMBRE = newNombre;
        logChange(
          "edit",
          `Cuenta ${cuenta.CUENTA}: "${oldNombre}" → "${newNombre}"`,
          { codigo: cuenta.CUENTA, oldNombre, newNombre }
        );
        changed = true;
      }

      // Actualizar sección principal
      const oldPrincipal = getAccountPrincipalName(cuenta);
      if (newSeccionPrincipal !== oldPrincipal) {
        // Actualizar en todos los campos posibles
        if (cuenta["SECCIÓN Principal"] !== undefined) cuenta["SECCIÓN Principal"] = newSeccionPrincipal;
        else if (cuenta["SECCION Principal"] !== undefined) cuenta["SECCION Principal"] = newSeccionPrincipal;
        else if (cuenta.seccion_principal !== undefined) cuenta.seccion_principal = newSeccionPrincipal;
        else cuenta["SECCIÓN Principal"] = newSeccionPrincipal;
        logChange("edit", `Cuenta ${cuenta.CUENTA}: sección "${oldPrincipal}" → "${newSeccionPrincipal}"`, {
          codigo: cuenta.CUENTA,
          oldPrincipal,
          newPrincipal: newSeccionPrincipal,
        });
        changed = true;
      }

      // Actualizar sección secundaria
      const oldSecundaria = getAccountSecondaryName(cuenta);
      if (newSeccionSecundaria !== oldSecundaria) {
        if (cuenta["SECCION Secundaria"] !== undefined) cuenta["SECCION Secundaria"] = newSeccionSecundaria;
        else if (cuenta["SECCIÓN Secundaria"] !== undefined) cuenta["SECCIÓN Secundaria"] = newSeccionSecundaria;
        else if (cuenta.seccion_secundaria !== undefined) cuenta.seccion_secundaria = newSeccionSecundaria;
        else cuenta["SECCION Secundaria"] = newSeccionSecundaria;
        logChange("edit", `Cuenta ${cuenta.CUENTA}: subsección "${oldSecundaria}" → "${newSeccionSecundaria}"`, {
          codigo: cuenta.CUENTA,
          oldSecundaria,
          newSecundaria: newSeccionSecundaria,
        });
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
      const factorNuevo = newFactorRaw === "" || newFactorRaw == null
        ? 1
        : Number(newFactorRaw);
      const factorNuevoFinal = Number.isFinite(factorNuevo) ? factorNuevo : 1;
      if (factorNuevoFinal !== factorActual) {
        cuenta.operacion_factor = factorNuevoFinal;
        logChange(
          "edit",
          `Cuenta ${cuenta.CUENTA}: factor ${factorActual} → ${factorNuevoFinal}`,
          { codigo: cuenta.CUENTA, factorActual, factorNuevo: factorNuevoFinal }
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

        // También actualizar en operaciones si la sección es referenciada
        state.operaciones.forEach((op) => {
          if (op.SECCION === oldName) op.SECCION = newName;
          for (let i = 1; i <= 20; i++) {
            if (op[`seccion_${i}`] === oldName) op[`seccion_${i}`] = newName;
          }
        });

        logChange(
          "rename",
          `Sección "${oldName}" → "${newName}" (${affectedCount} cuentas afectadas)`,
          { oldName, newName, affectedCount }
        );
        renderLayout();
        showToast(
          `✅ Sección renombrada (${affectedCount} cuentas actualizadas)`,
          "success"
        );
      }
    } else if (state.selectedElement.type === "subsection") {
      const principal = state.selectedElement.principal;
      const oldName = state.selectedElement.name;
      const newName = document
        .getElementById("editNombreSubseccion")
        ?.value?.trim();

      if (newName && newName !== oldName) {
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
            c.seccion_secondary;

          if (p === principal && s === oldName) {
            if (c["SECCION Secundaria"] !== undefined)
              c["SECCION Secundaria"] = newName;
            if (c["SECCIÓN Secundaria"] !== undefined)
              c["SECCIÓN Secundaria"] = newName;
            if (c.seccion_secondary !== undefined)
              c.seccion_secondary = newName;
          }
        });
      }
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
          "Este campo es obligatorio (o indica un ID interno)."
        );
        markInvalid(idInput, "Indica un ID si no hay nombre visible.");
        showToast("Completa al menos el nombre visible o el ID interno.", "error");
        return;
      }

      const oldId = getOperationId(op);
      const oldLabel = getOperationLabel(op);
      const desiredId = normalizeOperationId(
        newIdInput || oldId || newClase || oldLabel
      );

      if (!desiredId) {
        showToast("Identificador invalido", "error");
        return;
      }

      const idConflict = state.operaciones.some(
        (o) =>
          o !== op &&
          normalizeOperationMatch(getOperationId(o)) ===
            normalizeOperationMatch(desiredId)
      );
      if (idConflict) {
        showToast("El identificador ya existe en otra operacion", "error");
        return;
      }

      if (newClase) op.Clase = newClase;
      op.OperacionId = desiredId;

      if (
        oldId &&
        normalizeOperationMatch(desiredId) !== normalizeOperationMatch(oldId)
      ) {
        state.operaciones.forEach((other) => {
          if (!Array.isArray(other.formula_terms)) return;
          let changed = false;
          other.formula_terms = other.formula_terms.map((term) => {
            if (term.type !== "operation") return term;
            const termKey = normalizeOperationMatch(term.value);
            if (
              termKey === normalizeOperationMatch(oldId) ||
              termKey === normalizeOperationMatch(oldLabel)
            ) {
              changed = true;
              return { ...term, value: desiredId };
            }
            return term;
          });
          if (changed) {
            other.formula_json = JSON.stringify(
              normalizeFormulaTerms(other.formula_terms)
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

      const formulaPanel = dom.operationEditorPanel;
      const formulaMode =
        formulaPanel?.querySelector('input[name="operationFormulaMode"]:checked')
          ?.value || "layout";
      const manualText =
        formulaPanel?.querySelector("#operationFormulaManual")?.value || "";
      const selectedTerms =
        formulaMode === "manual"
          ? parseFormulaText(manualText)
          : collectFormulaTermsFromLayout(formulaPanel);
      formulaTerms = selectedTerms;

      // VALIDACIÓN: Las operaciones deben tener fórmula
      if (!formulaTerms || formulaTerms.length === 0) {
        showToast("⚠️ La operación debe tener una fórmula. Usa la pestaña 'Fórmula' para definirla.", "error");
        
        // Cambiar a la pestaña de fórmula
        const formulaTab = document.querySelector('[data-bs-target="#editorTabFormula"]');
        if (formulaTab && window.bootstrap?.Tab) {
          const tab = new window.bootstrap.Tab(formulaTab);
          tab.show();
        }
        return;
      }

      // Limpiar campos legacy
      op.signos = {};
      for (let i = 1; i <= 20; i++) {
        delete op[`seccion_${i}`];
      }

      if (selectedTerms.length) {
        op.formula_terms = normalizeFormulaTerms(selectedTerms);
        op.formula_json = JSON.stringify(op.formula_terms);
        op.formula_terms.forEach((term, i) => {
          const key = `seccion_${i + 1}`;
          op[key] = term.value;
          op.signos[key] = term.operator === "-" ? -1 : 1;
        });

        if (
          op.formula_terms.length === 1 &&
          op.formula_terms[0].type === "section"
        ) {
          op.SECCION = op.formula_terms[0].value;
        }
      } else {
        op.formula_terms = [];
        op.formula_json = "";
      }

      // Flujo de inserción masiva: aplicar fórmula en la fila del modal Agregar
      // sin tocar el layout persistido hasta confirmar "Agregar".
      if (op?._bulkFormulaInput) {
        const bulkTerms = Array.isArray(op.formula_terms) ? op.formula_terms : [];
        const bulkText = buildFormulaPreviewText(bulkTerms);
        op._bulkFormulaInput.value = bulkText === "Sin fórmula" ? "" : bulkText;
        op._bulkFormulaInput.dispatchEvent(
          new Event("change", { bubbles: true })
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
          "success"
        );
      }

      const normalizedTerms = normalizeFormulaTerms(formulaTerms);
      const hasExistingFormula = affectedOps.some(
        (op) =>
          (Array.isArray(op.formula_terms) && op.formula_terms.length > 0) ||
          Boolean(op.formula_json)
      );

      if (normalizedTerms.length > 0 || hasExistingFormula) {
        const persistedTerms = normalizedTerms.map((term, idx) => ({
          id: formulaTerms[idx]?.id || Date.now() + idx,
          ...term,
        }));

        affectedOps.forEach((op) => {
          op.formula_terms = persistedTerms.map((term, idx) => ({
            id: term.id || Date.now() + idx,
            operator: term.operator,
            type: term.type,
            value: term.value,
            constant: term.constant,
            parentSection: term.parentSection,
          }));
          op.formula_json = JSON.stringify(normalizedTerms);

          const nextSignos = { ...(op.signos || {}) };
          for (let i = 1; i <= 20; i++) {
            const key = `seccion_${i}`;
            delete op[key];
            delete nextSignos[key];
          }

          op.formula_terms.forEach((term, i) => {
            const key = `seccion_${i + 1}`;
            op[key] = term.value;
            nextSignos[key] = term.operator === "-" ? -1 : 1;
          });

          op.signos = nextSignos;
        });

        showToast(
          `Fórmula actualizada en ${affectedOps.length} operaciones`,
          "success"
        );
      }
    }

    state.unsavedChanges = true;
    updateButtonStates();
    renderLayout();
    updateStats();
    scheduleAutoSave("edit");

    // Si hay un callback de bulk formula editor, llamarlo con los términos actualizados
    if (typeof window._bulkFormulaEditorCallback === 'function' && formulaTerms) {
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
          state.selectedElement.accountId || state.selectedElement.codigo
        );
      const codigo =
        cuenta?.CUENTA ||
        state.selectedElement.codigo ||
        state.selectedElement.accountId;
      if (codigo && confirm(`Eliminar la cuenta ${codigo}?`)) {
        const accountId = cuenta ? getAccountRowId(cuenta) : "";
        if (accountId) {
          state.cuentas = state.cuentas.filter(
            (c) => getAccountRowId(c) !== accountId
          );
        } else {
          state.cuentas = state.cuentas.filter((c) => c.CUENTA !== codigo);
        }
        finalizeDeletion();
      }
    } else if (type === "section") {
      const name = state.selectedElement.name;
      if (
        confirm(
          `Eliminar la seccion "${name}" y TODAS sus cuentas? Esta accion no se puede deshacer.`
        )
      ) {
        state.cuentas = state.cuentas.filter((c) => {
          const principal =
            c["SECCIàN Principal"] ||
            c["SECCI…N Principal"] ||
            c["SECCION Principal"] ||
            c.SECCION ||
            c.seccion_principal;
          return principal !== name;
        });
        finalizeDeletion();
      }
    } else if (type === "operation") {
      const op = state.selectedElement.op;
      const opId = getOperationId(op);
      const label = getOperationLabel(op);
      if (opId && confirm(`Eliminar la operacion "${label}"?`)) {
        state.operaciones = state.operaciones.filter(
          (o) => getOperationId(o) !== opId
        );
        finalizeDeletion();
      }
    }
  }

  function finalizeDeletion() {
    state.unsavedChanges = true;
    updateButtonStates();
    renderLayout();
    updateStats();
    scheduleAutoSave("delete");
    bootstrap.Modal.getInstance(dom.modalEditar)?.hide();
    bootstrap?.Offcanvas?.getInstance(dom.operationEditorPanel)?.hide();
    showToast("Elemento eliminado", "success");
  }

  // ==========================================
  // FORMULA BUILDER FUNCTIONS
  // ==========================================
  let formulaTerms = [];

  function buildFormulaTermsFromParent(parentName) {
    if (!parentName) return [];

    // Primero intentar con subsecciones del layout actual
    const sections = groupBySections(state.cuentas);
    const parentKey = normalizeOperationMatch(parentName);
    const section = sections.find(
      (s) => normalizeOperationMatch(s.name) === parentKey
    );
    const subsections = section?.subsections || [];

    if (subsections && subsections.length > 0) {
      const seen = new Set();
      const terms = [];
      let counter = 0;

      subsections.forEach((subsection) => {
        const secundaria = subsection.name;
        const label = secundaria || parentName;
        if (!label || seen.has(label)) return;
        seen.add(label);

        terms.push({
          id: Date.now() + counter++,
          operator: "+",
          type: "section",
          value: label,
          parentSection: parentName,
        });
      });

      if (terms.length > 0) return terms;
    }

    // Si parentName corresponde a una subsección, buscarla en todas las secciones
    if (parentKey) {
      const matches = [];
      sections.forEach((sec) => {
        (sec.subsections || []).forEach((subsection) => {
          const secundaria = subsection?.name || "";
          const secundariaKey = normalizeOperationMatch(secundaria);
          if (!secundariaKey) return;
          if (
            secundariaKey === parentKey ||
            secundariaKey.includes(parentKey) ||
            parentKey.includes(secundariaKey)
          ) {
            matches.push({
              parent: sec.name,
              name: secundaria,
            });
          }
        });
      });

      if (matches.length > 0) {
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
        if (terms.length > 0) return terms;
      }
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
        const matchingSections = new Set();

        sections.forEach((_, seccionPrincipal) => {
          const secLower = seccionPrincipal.toLowerCase();
          if (
            (isIncome && secLower.includes("income")) ||
            (isExpense && secLower.includes("expense"))
          ) {
            matchingSections.add(seccionPrincipal);
          }
        });

        if (matchingSections.size > 0) {
          return Array.from(matchingSections).map((sec, i) => ({
            id: Date.now() + i,
            operator: isExpense ? "-" : "+",
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
                operator: nameLower.includes("expense") ? "-" : "+",
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
      if (!Array.isArray(op.formula_terms) || op.formula_terms.length === 0) {
        return;
      }
      const normalizedTerms = normalizeFormulaTerms(op.formula_terms);
      const normalized = normalizedTerms.map((term, idx) => ({
        id: term.id || Date.now() + idx,
        ...term,
      }));
      op.formula_terms = normalized;
      op.formula_json = JSON.stringify(normalizedTerms);
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

    let accounts = state.cuentas.filter((c) => {
      if (isPlaceholderAccount(c)) return false;
      const secondaryKey = normalizeKey(getAccountSecondaryName(c));
      const primaryKey = normalizeKey(getAccountPrincipalName(c));
      if (!matchesParent(primaryKey)) return false;
      return secondaryKey === sectionKey || primaryKey === sectionKey;
    });

    // Try partial match if no exact match
    if (accounts.length === 0) {
      accounts = state.cuentas.filter((c) => {
        if (isPlaceholderAccount(c)) return false;
        const secondaryKey = normalizeKey(getAccountSecondaryName(c));
        const primaryKey = normalizeKey(getAccountPrincipalName(c));
        if (!matchesParent(primaryKey)) return false;
        return (
          secondaryKey.includes(sectionKey) ||
          primaryKey.includes(sectionKey)
        );
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

    const groupedSections = groupBySections(state.cuentas);
    groupedSections.forEach((section) => {
      (section.subsections || []).forEach((subsection) => {
        (subsection.accounts || []).forEach((cuenta) => {
          if (isPlaceholderAccount(cuenta)) return;
          const code = cuenta.CUENTA || cuenta.cuenta || cuenta.num_cta;
          const name = cuenta.NOMBRE || cuenta.nombre || "";
          const key = normalizeOperationMatch(code);
          if (!code || seen.has(key)) return;
          seen.add(key);
          accounts.push({
            code: String(code).trim(),
            name: String(name).trim(),
            display: `${code}${name ? " - " + name : ""}`,
          });
        });
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

    const sections = groupBySections(state.cuentas || []);
    sections.forEach((section, sectionIdx) => {
      const sectionKey = normalizeKey(section.name);
      const sectionOrder = Number.isFinite(Number(section.order))
        ? Number(section.order)
        : sectionIdx;
      if (sectionKey && !sectionIndex.has(sectionKey)) {
        sectionIndex.set(sectionKey, sectionOrder);
      }

      (section.subsections || []).forEach((subsection, subsectionIdx) => {
        const subName = subsection.name || "";
        const subKey = normalizeKey(subName) || "__NO_SUB__";
        const subOrder = Number.isFinite(Number(subsection.order))
          ? Number(subsection.order)
          : sectionOrder + subsectionIdx / 1000;
        subsectionIndex.set(`${sectionKey}||${subKey}`, subOrder);

        (subsection.accounts || []).forEach((cuenta, accountIdx) => {
          const code = cuenta.CUENTA || cuenta.cuenta || cuenta.num_cta;
          if (!code) return;
          const order = getAccountOrder(cuenta, accountIdx);
          accountIndex.set(normalizeKey(code), order);
        });
      });
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
      label
    )}</span>`;
  }

  function buildFormulaMapBySubsection(terms = []) {
    const { sectionIndex, subsectionIndex, accountIndex } =
      buildLayoutOrderIndex();
    const sectionsMap = new Map();
    const misc = [];

    terms.forEach((term, idx) => {
      if (!term) return;
      const operator = term.operator && term.operator !== "" ? term.operator : "+";
      const value = (term.value || "").toString().trim();
      if (!value) return;

      if (term.type && term.type !== "account") {
        misc.push({ term, operator, order: idx });
        return;
      }

      const account = getAccountByCode(value);
      if (account && isPlaceholderAccount(account)) return;

      const principal =
        (account && getAccountPrincipalName(account)) || "";
      const secondary =
        (account && getAccountSecondaryName(account)) || "";
      const principalName = (principal || secondary || "Sin sección")
        .toString()
        .trim();
      const secondaryName = secondary.toString().trim();

      const principalKey = normalizeKey(principalName);
      const secondaryKey = secondaryName ? normalizeKey(secondaryName) : "__NO_SUB__";
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
              })
            );
            accounts.sort(
              (a, b) =>
                a.order - b.order ||
                a.code.localeCompare(b.code, "es", { sensitivity: "base" })
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
              })
          );

        const accountCount = subsections.reduce(
          (total, sub) => total + (sub.accounts || []).length,
          0
        );

        return { ...section, subsections, accountCount };
      })
      .sort(
        (a, b) =>
          a.order - b.order ||
          a.name.localeCompare(b.name, "es", { sensitivity: "base" })
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
          (sub) => sub.accounts || []
        );

        const accountsHtml = (accountsForSection || [])
          .map(
            (account) => `
              <div class="d-flex align-items-center gap-2 ms-4 mt-1 small">
                ${renderOperatorBadge(account.sign, "me-1")}
                <code class="mb-0">${escapeHtml(account.code)}</code>
                ${
                  account.name
                    ? `<span class="text-muted">${escapeHtml(
                        account.name
                      )}</span>`
                    : ""
                }
              </div>
            `
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
                    ${
                      account.name
                        ? `<span class="text-muted">${escapeHtml(
                            account.name
                          )}</span>`
                        : ""
                    }
                  </div>
                `
              )
              .join("");

            return `
              <div class="mb-2">
                <div class="d-flex align-items-center gap-2 fw-semibold">
                  ${renderOperatorBadge(subsection.sign, "me-1")}
                  <i class="bi bi-folder text-warning"></i>
                  <span>${escapeHtml(subsection.displayName)}</span>
                  <span class="badge bg-light text-dark">${
                    subsection.accounts.length
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
      <div class="formula-term-row d-flex align-items-center gap-2 mb-2 p-2 bg-light rounded" data-id="${
        term.id
      }">
        <select class="form-select" style="width: 60px;" onchange="updateTermOperator(${
          term.id
        }, this.value)">
          <option value="+" ${
            term.operator === "+" ? "selected" : ""
          }>+</option>
          <option value="-" ${
            term.operator === "-" ? "selected" : ""
          }>−</option>
        </select>
        
        <select class="form-select flex-grow-1 account-select" onchange="updateTermValue(${
          term.id
        }, this.value)">
          <option value="">Seleccionar cuenta...</option>
          ${accountCatalog
            .map(
              (acc) => `
            <option value="${escapeAttr(acc.code)}" ${
                term.value === acc.code ? "selected" : ""
              }>
              ${escapeHtml(acc.display)}
            </option>
          `
            )
            .join("")}
        </select>
        
        <button type="button" class="btn btn-outline-danger btn-sm" onclick="removeFormulaTerm(${
          term.id
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
          term.type === "operation" ? formatOperationReference(term.value) : (term.value || "???")
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
      term.operator = operator && ["+", "-"].includes(operator) ? operator : "+";
      updateFormulaPreview();
    }
  };

  // Actualizar tipo de término - DEPRECATED (ahora solo cuentas)
  window.updateTermType = function (termId, newType) {
    // No-op: tipo siempre es "account" ahora
    console.warn(
      "updateTermType is deprecated - all terms are now account type"
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
          "success"
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

    // Secciones y Cuentas - SOLO desde cuentas cargadas
    const groupedSections = groupBySections(state.cuentas);
    groupedSections.forEach((section) => {
      // Agregar seccion principal
      if (section.name) {
        sections.add(section.name);
      }

      // Procesar subsecciones
      if (section.subsections && Array.isArray(section.subsections)) {
        section.subsections.forEach((subsection) => {
          // Agregar subseccion
          if (subsection.name && subsection.name !== section.name) {
            sections.add(subsection.name);
          }

          // Procesar cuentas de la subseccion
          if (subsection.accounts && Array.isArray(subsection.accounts)) {
            subsection.accounts.forEach((c) => {
              if (c.CUENTA) {
                accounts.push({ code: c.CUENTA, name: c.NOMBRE || c.CUENTA });
              }
            });
          }
        });
      }
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
        "¿Reemplazar los términos actuales por las sub-secciones detectadas?"
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
            `<option value="${c.CUENTA}" label="${c.NOMBRE || c.CUENTA}">${
              c.CUENTA
            } - ${c.NOMBRE || ""}</option>`
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
          { headers }
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
              `<option value="${c.CUENTA}" label="${c.NOMBRE || c.CUENTA}">${
                c.CUENTA
              } - ${c.NOMBRE || ""}</option>`
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

    document.getElementById(
      "previewContextInfo"
    ).textContent = `${state.modulo} · ${state.anio} · ${state.capitulo}`;
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
        window.LayoutControls.renderRealisticPreview(layoutData, currentOptions);
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
            showSampleData: toggleData?.checked ?? currentOptions.showSampleData,
          });
        });
      }

      if (toggleData) {
        toggleData.addEventListener("change", (e) => {
          renderWithOptions({
            ...currentOptions,
            showHiddenRows: toggleHidden?.checked ?? currentOptions.showHiddenRows,
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
    const rows = lines.slice(1).map((line) =>
      line.split(",").map((col) => col.trim())
    );
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
      OPERACIONES_PREDEFINIDAS = mergeOperacionesMap(jsonMap || {}, sumasMap || {});
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
    if (key === "GASTO" || key === "GASTOS" || key === "COSTO" || key === "COSTOS") {
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
      /^(income|expense|ingreso|gasto|costos?|cost)[-_\s]+(.+)$/i
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
        buildPredefMatchKeys(predef).some((key) => opKeys.has(key))
      ) || null
    );
  };

  const hasExplicitFormula = (op) => {
    if (!op) return false;
    if (Array.isArray(op.formula_terms) && op.formula_terms.length) return true;
    if (op.formula_json) return true;
    return Object.keys(op).some(
      (key) =>
        /^(seccion|operacion|cuenta)_\d+$/i.test(key) && Boolean(op[key])
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
    const parsed = parseFormulaTermsFromString(
      predef.formula,
      knownOperations
    );
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

    op.formula_terms = normalized.map((term, idx) => ({
      id: term.id || Date.now() + idx,
      ...term,
    }));
    op.formula_json = JSON.stringify(normalized);
    op.signos = {};
    for (let i = 1; i <= 20; i++) {
      delete op[`seccion_${i}`];
    }
    normalized.forEach((term, idx) => {
      const key = `seccion_${idx + 1}`;
      op[key] = term.value;
      op.signos[key] = term.operator === "-" ? -1 : 1;
    });

    if (normalized.length === 1 && normalized[0].type === "section") {
      op.SECCION = normalized[0].value;
    }

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
    knownOperations
  ) => {
    const opId = buildUniqueOperationId(
      predef.id || predef.identificador || predef.nombre
    );
    const orderValue = Number.isFinite(predef.orden)
      ? predef.orden
      : orderIndex;
    const resolvedSection =
      predef.section || (predef.source === "sumas" ? predef.formula : "") || "";
    const parentSubsection = resolvedSection || null;
    const parentSection = predef.parentSection || null;
    const existingSection = op.SECCION || op.seccion || "";
    const canUpdateSection = !existingSection;
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
    { force = false } = {}
  ) => {
    let changed = false;
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

    if (parentSubsection && canUpdateSection && (force || op.parentSubsection !== parentSubsection)) {
      op.parentSubsection = parentSubsection;
      changed = true;
    }

    if (parentSection && canUpdateSection && (force || op.parentSection !== parentSection)) {
      op.parentSection = parentSection;
      changed = true;
    }

    if (parentSubsection && canUpdateSection && (!Array.isArray(op.secciones) || force)) {
      op.secciones = [parentSubsection];
      changed = true;
    }

    const desiredTerms = buildPredefinedTerms(predef, knownOperations);
    const formulaIsSame = desiredTerms.length
      ? formulasMatch(op, desiredTerms)
      : true;

    if ((force || !formulaIsSame) && desiredTerms.length) {
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
            normalizeOperacionKey(getOperationDisplayName(op)) === nameKey
        );
        if (byName) return byName;

        const sectionKey = normalizeSectionName(predef?.section || predef?.seccion || "");
        if (sectionKey) {
          const bySection = list.find(
            (op) =>
              normalizeSectionName(op?.SECCION || op?.seccion || "") === sectionKey
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
      if (op?.identificador) knownOperations.add(normalizeOperacionKey(op.identificador));
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
          knownOperations
        );
        state.operaciones.push(newOp);
        registerExisting(newOp);
        added += 1;
        return;
      }

      if (
        applyPredefinedToExisting(existing, predef, orderIndex, knownOperations, {
          force,
        })
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
        "info"
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
              Se encontraron <strong>${
                operaciones.length
              } operaciones</strong> predefinidas para 
              <strong>${state.modulo}</strong> en <strong>${
      state.capitulo
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
                        op.formula
                      )}</code></small>
                    </div>
                    <button class="btn btn-sm btn-outline-primary" onclick="window.poblarOperacion(${idx})">
                      <i class="bi bi-plus-circle me-1"></i>Agregar
                    </button>
                  </div>
                </div>
              `
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
      if (item?.identificador) knownOperations.add(normalizeOperacionKey(item.identificador));
    });
    const orderIndex = Number.isFinite(op.orden) ? op.orden : index;
    const newOp = createOperationFromPredefined(op, orderIndex, knownOperations);

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
    tableSelector = "#layoutPreview"
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
      .querySelectorAll(".subsection-header .subsection-title > span:not(.badge)")
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
        ".operation-row, .inline-operation-row, .operation-card"
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
        availableElements.orderedLabels
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

  // Guardar contexto cuando cambie (solo si no está ya envuelto)
  if (!window.__plantillasContextWrapped) {
    window.__plantillasContextWrapped = true;
    
    const originalHandleModuloChange = handleModuloChange;
    const originalHandleCapituloChange = handleCapituloChange;
    const originalHandleAnioChange = handleAnioChange;

    window.handleModuloChange = async function() {
      await originalHandleModuloChange();
      saveContextToURL();
    }

    window.handleCapituloChange = async function() {
      await originalHandleCapituloChange();
      saveContextToURL();
    }

    window.handleAnioChange = async function() {
      await originalHandleAnioChange();
      saveContextToURL();
    }
  }

  // ==========================================
  // IMPORTACIÓN/EXPORTACIÓN MASIVA
  // ==========================================
  
  function descargarPlantillaImportacion() {
    const plantilla = {
      "_instrucciones": {
        "descripcion": "Plantilla para importación masiva de elementos al Gestor de Plantillas",
        "contexto": `${state.modulo} - ${state.anio} - ${state.capitulo}`,
        "formato": "Llena las secciones, subsecciones, cuentas y operaciones, luego importa este archivo",
        "campos_obligatorios": {
          "secciones": ["nombre"],
          "subsecciones": ["nombre", "seccion_principal"],
          "cuentas": ["cuenta", "nombre", "seccion_principal", "seccion_secundaria"],
          "operaciones": ["operacion_id", "clase", "formula"]
        }
      },
      "secciones": extractSecciones(),
      "subsecciones": extractSubsecciones(),
      "cuentas": extractCuentas(),
      "operaciones": extractOperaciones(),
      "_notas": {
        "formula_formato": "Ejemplos: '400-000-000-00 + 401-000-000-00' o 'OPERACION_1 - OPERACION_2'",
        "estilo_fila_opciones": ["sum-row", "sum-row-principal", "highlight-primary", "highlight-secondary", "highlight-bright", "subsection-row", "operation-row"],
        "tipo_operacion_opciones": ["libre", "seccion", "subseccion", "consolidacion"]
      }
    };
    
    const json = JSON.stringify(plantilla, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plantilla_${state.modulo}_${state.anio}_${state.capitulo}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('✅ Plantilla descargada. Ábrela en Excel o editor de texto, llena los datos e importa.', 'success');
  }
  
  function extractSecciones() {
    const secciones = new Set();
    state.cuentas.forEach(c => {
      const seccion = getAccountPrincipalName(c);
      if (seccion) secciones.add(seccion);
    });
    return Array.from(secciones).map(nombre => ({ nombre, descripcion: "" }));
  }
  
  function extractSubsecciones() {
    const subsecciones = [];
    const seen = new Set();
    state.cuentas.forEach(c => {
      const principal = getAccountPrincipalName(c);
      const secundaria = getAccountSecondaryName(c);
      if (principal && secundaria) {
        const key = `${principal}|${secundaria}`;
        if (!seen.has(key)) {
          seen.add(key);
          subsecciones.push({
            nombre: secundaria,
            seccion_principal: principal,
            descripcion: ""
          });
        }
      }
    });
    return subsecciones;
  }
  
  function extractCuentas() {
    return state.cuentas.map(c => ({
      cuenta: c.CUENTA || c.cuenta || "",
      nombre: c.NOMBRE || c.nombre || "",
      seccion_principal: getAccountPrincipalName(c) || "",
      seccion_secundaria: getAccountSecondaryName(c) || "",
      visible: c.visible !== false,
      capturable: c.capturable !== false,
      tipo_saldo: c.TIPO_SALDO || c.tipo_saldo || "Deudor"
    }));
  }
  
  function extractOperaciones() {
    return (state.operaciones || []).map(op => {
      const formulaTerms = extractFormulaTerms(op);
      const formulaStr = formulaTerms.map(t => {
        const prefix = t.operator === '-' ? '- ' : (t.operator === '+' ? '+ ' : '');
        return prefix + t.value;
      }).join(' ').trim();
      
      return {
        operacion_id: getOperationId(op) || "",
        clase: getOperationDisplayName(op) || "",
        seccion: op.SECCION || "",
        tipo_operacion: op.tipo_operacion || "libre",
        formula: formulaStr,
        estilo_fila: op.rowStyle || op.estilo_fila || "operation-row",
        visible: op.visible !== false,
        descripcion: ""
      };
    });
  }
  
  async function importarDesdeArchivo(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!data.secciones && !data.subsecciones && !data.cuentas && !data.operaciones) {
        showToast('⚠️ El archivo no tiene el formato correcto. Descarga la plantilla primero.', 'warning');
        return;
      }
      
      const confirmMsg = `¿Importar datos desde ${file.name}?\n\nSe agregarán:\n` +
        `- ${(data.secciones || []).length} secciones\n` +
        `- ${(data.subsecciones || []).length} subsecciones\n` +
        `- ${(data.cuentas || []).length} cuentas\n` +
        `- ${(data.operaciones || []).length} operaciones`;
      
      if (!confirm(confirmMsg)) {
        event.target.value = '';
        return;
      }
      
      let importados = 0;
      
      // Importar cuentas
      if (data.cuentas && Array.isArray(data.cuentas)) {
        data.cuentas.forEach(c => {
          if (!c.cuenta) return;
          
          // Verificar si ya existe
          const existe = state.cuentas.some(existing => 
            (existing.CUENTA || existing.cuenta) === c.cuenta
          );
          
          if (!existe) {
            state.cuentas.push({
              CUENTA: c.cuenta,
              cuenta: c.cuenta,
              NOMBRE: c.nombre,
              nombre: c.nombre,
              'SECCION PRINCIPAL': c.seccion_principal,
              'SECCION Secundaria': c.seccion_secundaria,
              visible: c.visible !== false,
              capturable: c.capturable !== false,
              TIPO_SALDO: c.tipo_saldo || 'Deudor',
              HOJA: state.modulo,
              CAPITULO: state.capitulo
            });
            importados++;
          }
        });
      }
      
      // Importar operaciones
      if (data.operaciones && Array.isArray(data.operaciones)) {
        data.operaciones.forEach(op => {
          if (!op.operacion_id || !op.formula) return;
          
          // Verificar si ya existe
          const existe = state.operaciones.some(existing => 
            getOperationId(existing) === op.operacion_id
          );
          
          if (!existe) {
            // Parsear fórmula
            const formulaTerms = parseFormulaText(op.formula);
            
            state.operaciones.push({
              OperacionId: op.operacion_id,
              Clase: op.clase || op.operacion_id,
              SECCION: op.seccion || "",
              tipo_operacion: op.tipo_operacion || "libre",
              formula_terms: formulaTerms,
              formula_json: JSON.stringify(formulaTerms),
              rowStyle: op.estilo_fila || "operation-row",
              estilo_fila: op.estilo_fila || "operation-row",
              visible: op.visible !== false,
              HOJA: state.modulo,
              CAPITULO: state.capitulo
            });
            importados++;
          }
        });
      }
      
      if (importados > 0) {
        state.unsavedChanges = true;
        renderLayout();
        updateButtonStates();
        showToast(`✅ Importados ${importados} elementos. Recuerda GUARDAR los cambios.`, 'success');
      } else {
        showToast('ℹ️ No se importó nada nuevo (todos los elementos ya existen)', 'info');
      }
      
    } catch (error) {
      console.error('Error al importar:', error);
      showToast(`❌ Error al importar: ${error.message}`, 'error');
    } finally {
      event.target.value = '';
    }
  }

  // Cargar contexto al iniciar
  loadContextFromURL();

  // Exponer API pública
  window.TemplateManager = {
    cargarOperacionesPredefinidas,
    updateAvailableElementsFromTable,
    saveContextToURL,
    loadContextFromURL,
  };
})();
