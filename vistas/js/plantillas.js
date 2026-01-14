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
  const API_BASE =
    window.location.protocol === "file:"
      ? "http://localhost:3005/api/layouts-config"
      : `${window.location.origin}/api/layouts-config`;

  // ==========================================
  // STATE
  // ==========================================
  const state = {
    modulo: "RESUMEN",
    anio: null,
    capitulo: null,
    layout: null,
    cuentas: [],
    operaciones: [],
    columnasConfig: null,
    columnasConfigChanged: false,
    unsavedChanges: false,
    editMode: false,
    selectedElement: null,
    changeLog: [], // Registro de cambios
  };
  window.state = state;

  // ==========================================
  // DOM ELEMENTS
  // ==========================================
  const dom = {};

  // ==========================================
  // INITIALIZATION
  // ==========================================
  function init() {
    cacheDOMElements();
    bindEventListeners();
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

    // Toast
    dom.toastNotification = document.getElementById("toastNotification");
    dom.toastMessage = document.getElementById("toastMessage");
  }

  function bindEventListeners() {
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

    // Search
    dom.searchInput?.addEventListener("input", handleSearch);

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

    // Element type selector
    document.querySelectorAll('input[name="tipoElemento"]').forEach((radio) => {
      radio.addEventListener("change", updateAddForm);
    });
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
    const sesion = window.Sesion?.obtener?.() || null;
    const esAdminGlobal = window.Sesion?.esAdminGlobal?.() || false;
    const usuarioId = window.Sesion?.obtenerUsuarioId?.();
    const token = sesion?.tokenAcceso || window.Sesion?.token;

    if (!token || !sesion) {
      updateAuthUI(false, "Sesión no válida");
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
    if (dom.btnPreview) dom.btnPreview.disabled = !hasLayout;
  }

  function requireEditMode() {
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
      const url = `${API_BASE}/${encodeURIComponent(state.modulo)}/anios`;
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
    const parentSelector = window.parent?.document?.querySelector(
      ".company-selector select"
    );
    const localSelector = document.querySelector(".company-selector select");
    const selector = parentSelector || localSelector;

    if (selector?.value) {
      let chapter = window.CapitulosModulos?.empresaACapitulo?.(selector.value);

      // empresaACapitulo might return an object {capitulo: "...", etiqueta: "..."} or a string
      if (chapter && typeof chapter === "object") {
        chapter = chapter.capitulo || chapter.etiqueta || String(chapter);
      }
      chapter = chapter || selector.value;

      state.capitulo = chapter;
      dom.capituloSelect.innerHTML = `<option value="${chapter}">${chapter}</option>`;
    } else {
      // Load chapters from API
      try {
        const url = `${API_BASE}/${encodeURIComponent(state.modulo)}/${
          state.anio
        }/capitulos`;
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
      const url = `${API_BASE}/${encodeURIComponent(state.modulo)}/${
        state.anio
      }/${encodeURIComponent(state.capitulo)}`;
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
      state.cuentas = extractCuentas(state.layout);
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
      } else {
        state.columnasConfig = null;
        state.columnasConfigChanged = false;
      }
      await syncOperacionesPredefinidas({ autoCreate: true, force: true });
      syncOperacionesSumasDesdeConfig();
      hydrateOperationsFromParents();
      syncOperativoPorNombreOps();
      ensureOperationIds();
      normalizeOperationReferences();
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
    if (Array.isArray(layout.cuentas)) return layout.cuentas;
    if (Array.isArray(layout[state.modulo])) return layout[state.modulo];
    return [];
  }

  function getAccountOrder(cuenta, fallback = 0) {
    const raw = cuenta?.orden_presentacion ?? cuenta?.orden ?? cuenta?.Orden;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function getOperationOrder(op, fallback = 0) {
    const raw =
      op?.orden_presentacion ?? op?.orden ?? op?.Orden ?? op?.index;
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
    },
    {
      field: "sum-row-sumavarios",
      label: "Suma Varios",
      placeholder: "TOTAL ...",
    },
    {
      field: "sum-row-sumavarios2",
      label: "Suma Varios 2",
      placeholder: "RESULTADO ...",
    },
    {
      field: "sum-row-sumavarios-consolidado",
      label: "Consolidado",
      placeholder: "CONSOLIDATED ...",
    },
    {
      field: "sum-row-operativo",
      label: "Operativo",
      placeholder: "OPERATING RESULTS ...",
    },
    {
      field: "result-row",
      label: "Resultado",
      placeholder: "RESULTADO ...",
    },
    {
      field: "net-row",
      label: "Neto",
      placeholder: "NET RESULTS ...",
    },
    {
      field: "result-net-row",
      label: "Resultado Neto",
      placeholder: "CONSOLIDATED NET RESULTS ...",
    },
  ];

  const ROW_LABEL_FIELDS = OP_ROW_FIELDS.map((row) => row.field);

  const rowLabelInputId = (field) =>
    `editRowLabel_${field.replace(/[^a-z0-9]/gi, "_")}`;


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
        (a, b) =>
          getOperationOrder(a.op, a.idx) - getOperationOrder(b.op, b.idx)
      )
      .map((item) => item.op);
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
      const parentName = op?.SECCION || op?.Clase;

      // PRIORIDAD 1: Detectar y SIEMPRE reconstruir operaciones consolidadas
      if (
        parentName &&
        (parentName.toLowerCase().includes("consolidated") ||
          parentName.toLowerCase().includes("consolidado") ||
          parentName.toLowerCase().includes("total"))
      ) {
        // Buscar todas las secciones que coincidan con el tipo
        const isIncome =
          parentName.toLowerCase().includes("income") ||
          parentName.toLowerCase().includes("ingreso");
        const isExpense =
          parentName.toLowerCase().includes("expense") ||
          parentName.toLowerCase().includes("gasto");

        if (isIncome || isExpense) {
          const allSections = new Set();
          state.cuentas.forEach((cuenta) => {
            const secPrincipal =
              cuenta["SECCIÓN Principal"] ||
              cuenta["SECCION Principal"] ||
              cuenta.seccion_principal ||
              "";
            if (secPrincipal) {
              const secLower = secPrincipal.toLowerCase();
              if (
                (isIncome && secLower.includes("income")) ||
                (isExpense && secLower.includes("expense"))
              ) {
                allSections.add(secPrincipal);
              }
            }
          });

          if (allSections.size > 0) {
            const consolidatedTerms = Array.from(allSections)
              .sort() // Ordenar alfabéticamente para consistencia
              .map((sec, i) => ({
                id: Date.now() + i,
                operator: isExpense ? "-" : "+",
                type: "section",
                value: sec,
              }));

            op.formula_terms = consolidatedTerms;
            op.signos = {};
            consolidatedTerms.forEach((term, i) => {
              const key = `seccion_${i + 1}`;
              op[key] = term.value;
              op.signos[key] = term.operator === "-" ? -1 : 1;
            });
            if (op.orden === undefined) op.orden = idx;

            // Marcar como auto-construido para debugging
            op._autoBuilt = true;

            return op;
          }
        }
      }

      // PRIORIDAD 2: Si ya tiene formula_terms definidos manualmente, respetarlos
      if (op?.formula_terms?.length && !op._autoBuilt) {
        // Asegurar que cada término tenga el tipo correcto
        op.formula_terms = op.formula_terms.map((term) => ({
          ...term,
          type: term.type || detectTermType(term.value),
        }));
        return op;
      }

      // PRIORIDAD 3: Si tiene formula_json guardado, parsearlo
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

      // PRIORIDAD 4: Si tiene signos explícitos en seccion_1, seccion_2, etc.
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

      // PRIORIDAD 5: Construir desde SECCION o Clase usando buildFormulaTermsFromParent
      const derived = normalizeFormulaTerms(
        buildFormulaTermsFromParent(parentName)
      );

      if (!derived.length) {
        return op;
      }

      const hydrated = { ...op, formula_terms: derived, signos: {} };

      derived.forEach((term, termIdx) => {
        const key = `seccion_${termIdx + 1}`;
        hydrated[key] = term.value;
        hydrated.signos[key] = term.operator === "-" ? -1 : 1;
      });

      // Mantener orden original si no existía
      if (hydrated.orden === undefined) hydrated.orden = idx;

      return hydrated;
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
    dom.layoutPreview.innerHTML = renderEditableLayout();
    bindLayoutEvents();
    window.updateAvailableElementsFromTable?.("#layoutPreview");
    updateSelectionInfo();
  }

  function isModuloPiloto() {
    return normalizeOperationMatch(state.modulo) === "comites";
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
    const columns = getColumnConfigForRender();
    const rowsCount = rows.length;
    return `
      <div class="template-pilot">
        ${renderColumnConfigSection(columns)}
        <div class="card mb-3">
          <div class="card-header d-flex justify-content-between align-items-center">
            <span>Tabla de plantilla (orden de aparicion)</span>
            <span class="badge bg-secondary">${rowsCount}</span>
          </div>
          <div class="card-body">
            ${renderTemplateTable(rows, columns)}
            <div class="small text-muted mt-2">Click en cualquier fila para editar.</div>
          </div>
        </div>
      </div>
    `;
  }

  function buildPreviewRowsForEditor() {
    if (
      !window.LayoutControls ||
      typeof window.LayoutControls._buildPreviewRows !== "function"
    ) {
      return [];
    }
    const layoutData = {
      modulo: state.modulo,
      capitulo: state.capitulo,
      cuentas: state.cuentas || [],
      operaciones: sortOperations(state.operaciones || []),
    };
    try {
      return window.LayoutControls._buildPreviewRows(layoutData) || [];
    } catch (err) {
      console.warn("No se pudo construir filas para el piloto", err);
      return [];
    }
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
    const rowsHtml = (columns || [])
      .map(
        (col, idx) => `
          <tr data-col-index="${idx}">
            <td class="text-muted">${idx + 1}</td>
            <td><code>${escapeHtml(col.key || "")}</code></td>
            <td>
              <input
                type="text"
                class="form-control form-control-sm"
                value="${escapeHtml(col.label || "")}"
                data-field="label"
                ${disabledAttr}
              />
            </td>
            <td>
              <input
                type="text"
                class="form-control form-control-sm"
                value="${escapeHtml(col.operacion || "")}"
                data-field="operacion"
                ${disabledAttr}
              />
            </td>
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

    return `
      <div class="card mb-3">
        <div class="card-header d-flex justify-content-between align-items-center">
          <span>Columnas de la plantilla</span>
          <span class="badge bg-secondary">${columns.length}</span>
        </div>
        <div class="table-responsive">
          <table class="table table-sm table-bordered column-config-table">
            <thead class="table-light">
              <tr>
                <th>#</th>
                <th>Clave</th>
                <th>Etiqueta</th>
                <th>Operacion</th>
                <th>Editable</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || ""}
            </tbody>
          </table>
        </div>
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
    const colCount = resolvedColumns.length;
    const headerHtml = resolvedColumns
      .map(
        (col, idx) => `
          <th data-col-index="${idx}" title="${escapeAttr(col.key || "")}">
            ${escapeHtml(col.label || col.key || "")}
          </th>
        `
      )
      .join("");

    let bodyHtml = "";
    let currentSection = "";
    let currentSubsection = "";

    rows.forEach((row) => {
      if (!row) return;
      const isVisible = row.visible !== false;
      const hiddenClass = isVisible ? "" : "text-muted";
      if (row.type === "principal") {
        currentSection = row.label || "";
        currentSubsection = "";
        bodyHtml += `
          <tr class="section-header-row ${hiddenClass}" data-row-type="section" data-section="${escapeAttr(
            currentSection
          )}" data-generated="${row.generated ? "true" : "false"}">
            <td colspan="${colCount}">
              <strong>${escapeHtml(currentSection || "Seccion")}</strong>
            </td>
          </tr>
        `;
        return;
      }

      if (row.type === "subsection") {
        currentSubsection = row.label || "";
        bodyHtml += `
          <tr class="subsection-row ${hiddenClass}" data-row-type="subsection" data-section="${escapeAttr(
            currentSection
          )}" data-subsection="${escapeAttr(currentSubsection)}">
            <td colspan="${colCount}">
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
        for (let i = 0; i < colCount; i += 1) {
          if (i === 0) {
            cells.push(
              `<td class="account-code">${escapeHtml(cuenta)}</td>`
            );
          } else if (i === 1) {
            cells.push(
              `<td class="account-name">${escapeHtml(
                nombre || cuenta
              )}</td>`
            );
          } else {
            cells.push("<td></td>");
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
        const formula = op ? formatFormula(op) : "";
        const cells = [];
        for (let i = 0; i < colCount; i += 1) {
          if (i === 0) {
            cells.push("<td></td>");
          } else if (i === 1) {
            const kindBadge = kind
              ? `<span class="small text-muted ms-2">${escapeHtml(
                  kind
                )}</span>`
              : "";
            cells.push(
              `<td class="fw-semibold">${escapeHtml(label)}${kindBadge}</td>`
            );
          } else {
            cells.push("<td></td>");
          }
        }
        bodyHtml += `
          <tr class="operation-row ${kind} ${hiddenClass}" data-row-type="operation" data-operation-id="${escapeAttr(
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
        <table class="table table-sm table-bordered template-table">
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

  function bindTemplateTableEvents() {
    if (!isModuloPiloto()) return;
    const table = dom.layoutPreview?.querySelector(".template-table");
    if (!table) return;
    table.addEventListener("click", (event) => {
      const row = event.target.closest("tr[data-row-type]");
      if (!row) return;
      const rowType = row.dataset.rowType;
      if (rowType === "account") {
        const cuenta = row.dataset.cuenta;
        if (cuenta) {
          editAccount(cuenta);
        }
        return;
      }
      if (rowType === "operation") {
        const rawLabel = row.dataset.operationLabel || "";
        const rawId = row.dataset.operationId || "";
        const label = rawLabel || rawId;
        if (!label) return;

        const direct = findOperationByIdOrLabel(label);
        if (direct) {
          editOperation(getOperationId(direct) || label);
          return;
        }

        const kind = row.dataset.operationKind || "";
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
        if (row.dataset.generated === "true") return;
        const section = row.dataset.section;
        if (section) {
          editSection(section);
        }
        return;
      }
      if (rowType === "subsection") {
        const section = row.dataset.section;
        const subsection = row.dataset.subsection;
        if (section && subsection) {
          editSubsection(section, subsection);
        }
      }
    });
  }

  function bindColumnConfigEvents() {
    if (!isModuloPiloto()) return;
    const table = dom.layoutPreview?.querySelector(".column-config-table");
    if (!table) return;
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
    return lista;
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
    if (isModuloPiloto()) {
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
    const dataset = window.CUENTAS_SUMAS;
    if (!dataset) return null;
    const moduloKey = findKeyByNormalized(
      dataset,
      state.modulo,
      normalizeOperationMatch
    );
    if (!moduloKey) return null;
    const porCapitulo = dataset[moduloKey] || {};
    const capituloKey = findKeyByNormalized(
      porCapitulo,
      state.capitulo,
      normalizeSumasCapitulo
    );
    if (!capituloKey) return null;
    return porCapitulo[capituloKey] || null;
  }

  function getSumasConfigForSection(sumasConfig, sectionName) {
    const sectionKey = findKeyByNormalized(
      sumasConfig,
      sectionName,
      normalizeOperationMatch
    );
    if (!sectionKey) return null;
    return sumasConfig[sectionKey] || null;
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
    if (!isModuloPiloto()) return { added: 0, updated: 0 };
    const sumasConfig = getSumasConfigForContext();
    if (!sumasConfig) return { added: 0, updated: 0 };
    const sections = groupBySections(state.cuentas || []);
    if (!sections.length) return { added: 0, updated: 0 };

    const existingBySection = new Map();
    const existingSumRowLabels = new Set();

    (state.operaciones || []).forEach((op) => {
      const sectionKey = normalizeOperationMatch(op?.SECCION || op?.seccion);
      if (sectionKey && !existingBySection.has(sectionKey)) {
        existingBySection.set(sectionKey, op);
      }
      const sumRowLabel = op?.["sum-row"];
      if (sumRowLabel) {
        existingSumRowLabels.add(normalizeOperationMatch(sumRowLabel));
      }
    });

    let added = 0;
    let updated = 0;

    sections.forEach((section) => {
      const sectionName = section?.name || "";
      if (!sectionName) return;
      const config = getSumasConfigForSection(sumasConfig, sectionName);
      if (!config) return;

      const sectionKey = normalizeOperationMatch(sectionName);
      const existing = existingBySection.get(sectionKey);
      if (existing) {
        let changed = false;
        changed =
          applySumasField(
            existing,
            "sum-row",
            config?.sumRow,
            sectionName ? `Suma ${sectionName}` : ""
          ) || changed;
        changed =
          applySumasField(
            existing,
            "sum-row-sumavarios",
            config?.sumRowSumavarios
          ) || changed;
        changed =
          applySumasField(
            existing,
            "sum-row-sumavarios2",
            config?.sumRowSumavarios2
          ) || changed;
        changed =
          applySumasField(existing, "result-row", config?.resultRow) ||
          changed;
        if (changed) updated += 1;
        return;
      }

      const labelCandidate = (config?.sumRow || "").toString().trim();
      const fallbackLabel = sectionName ? `Suma ${sectionName}` : "";
      const finalLabel = labelCandidate || fallbackLabel;
      if (!finalLabel) return;
      if (existingSumRowLabels.has(normalizeOperationMatch(finalLabel))) {
        return;
      }

      const op = buildSumasOperacion(sectionName, config, section.order);
      state.operaciones.push(op);
      existingBySection.set(sectionKey, op);
      existingSumRowLabels.add(normalizeOperationMatch(finalLabel));
      added += 1;
    });

    if (added || updated) {
      state.operaciones = sortOperations(state.operaciones);
      ensureOperationIds();
      normalizeOperationReferences();
      state.unsavedChanges = true;
      updateButtonStates();
      logChange("add", `Operaciones sumas (${added + updated})`);
    }

    return { added, updated };
  }

  function syncOperativoPorNombreOps() {
    if (!isModuloPiloto()) return { added: 0 };
    const ops = buildOperativoPorNombreOps(state.cuentas);
    if (!ops.length) return { added: 0 };
    const existing = new Set();
    state.operaciones.forEach((op) => {
      const label = op?.["sum-row-operativo"];
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
    const cuentasOrdenadas = [...cuentas].sort(
      (a, b) => getAccountOrder(a) - getAccountOrder(b)
    );
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
    )}" onclick="editOperation('${escapeAttr(opId || clase)}')">
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
    const formula = accounts
      .map((a) => a.NOMBRE || a.nombre || a.CUENTA)
      .join(" + ");

    return `
      <div class="inline-operation-row ${hiddenClass}" data-operation-id="${escapeAttr(
        opId || ""
      )}" data-operation-label="${escapeAttr(
      displayName
    )}" onclick="editOperation('${escapeAttr(opId || clase)}')">
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

    const cuentasOrdenadas = [...(cuentas || [])].sort(
      (a, b) => getAccountOrder(a) - getAccountOrder(b)
    );

    cuentasOrdenadas.forEach((cuenta, index) => {
      const principal =
        cuenta["SECCIÓN Principal"] ||
        cuenta["SECCIàN Principal"] ||
        cuenta["SECCION Principal"] ||
        cuenta.SECCION ||
        cuenta.seccion_principal ||
        "Sin sección";

      const secundaria =
        cuenta["SECCION Secundaria"] ||
        cuenta["SECCIÓN Secundaria"] ||
        cuenta.seccion_secundaria ||
        "";

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
    const subsectionCount = subsections.length;
    const accountCount = subsections.reduce(
      (acc, subsection) => acc + subsection.accounts.length,
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
    const accountsHtml = accounts
      .sort((a, b) => getAccountOrder(a) - getAccountOrder(b))
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
      .map((op) => renderInlineOperation(op, accounts))
      .join("");

    return `
      <div class="subsection" data-subsection="${escapeHtml(name)}">
        <div class="subsection-header" onclick="toggleSubsection(this)">
          <div class="subsection-title">
            <i class="bi bi-chevron-down section-toggle"></i>
            <i class="bi bi-folder text-info"></i>
            <span>${escapeHtml(name)}</span>
            <span class="badge bg-light text-dark">${accounts.length}</span>
          </div>
          <div class="section-actions">
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
    const codigo = account.CUENTA || "";
    const nombre = account.NOMBRE || account.nombre || "";
    const isVisible = account.visible !== false;
    const hiddenClass = !isVisible ? "hidden-row" : "";
    const canEdit = state.editMode;
    const disabledAttr = !canEdit ? "disabled" : "";

    return `
      <div class="account-row ${hiddenClass}" data-cuenta="${escapeHtml(
      codigo
    )}" onclick="selectAccount(this, '${escapeAttr(codigo)}')">
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
            codigo
          )}')" title="Editar" ${disabledAttr}>
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation(); deleteAccount('${escapeAttr(
            codigo
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
    updateHeaderLabels();
    await tryLoadLayout();
  }

  function handleSearch(e) {
    const query = e.target.value.toLowerCase().trim();
    const rows = document.querySelectorAll(".account-row");

    // Quitar resaltado anterior
    document.querySelectorAll(".search-highlight").forEach((el) => {
      el.classList.remove("search-highlight");
    });

    if (!query) {
      // Mostrar todas las filas si no hay búsqueda
      rows.forEach((row) => (row.style.display = ""));
      return;
    }

    let firstMatch = null;

    rows.forEach((row) => {
      const code =
        row.querySelector(".account-code")?.textContent?.toLowerCase() || "";
      const name =
        row.querySelector(".account-name")?.textContent?.toLowerCase() || "";
      const match = code.includes(query) || name.includes(query);
      row.style.display = match ? "" : "none";

      // Guardar primera coincidencia
      if (match && !firstMatch) {
        firstMatch = row;
      }
    });

    // Scroll al primer resultado y resaltarlo
    if (firstMatch) {
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
        const codigo = selection.cuenta?.CUENTA || selection.codigo;
        const cuenta = state.cuentas.find((c) => c.CUENTA === codigo);
        const nombre = cuenta?.NOMBRE || cuenta?.nombre || "";
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
    if (!window.LayoutControls || typeof window.LayoutControls._buildPreviewRows !== "function") {
      dom.layoutOrderList.innerHTML =
        '<div class="text-muted small p-2">Vista previa de orden no disponible</div>';
      return;
    }

    const layoutData = {
      modulo: state.modulo,
      capitulo: state.capitulo,
      cuentas: state.cuentas || [],
      operaciones: sortOperations(state.operaciones || []),
    };

    let rows = [];
    try {
      rows = window.LayoutControls._buildPreviewRows(layoutData) || [];
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
  function openAddModal() {
    if (!state.editMode) {
      showToast("Activa el modo edición primero", "warning");
      return;
    }
    updateAddForm();
    new bootstrap.Modal(dom.modalAgregar).show();
  }

  function updateAddForm() {
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
            <div class="form-text">Si lo dejas vacio se genera automaticamente.</div>
          </div>
          <div class="mb-3">
            <label class="form-label">Etiqueta de la Operación</label>
            <input type="text" class="form-control" id="inputClase" placeholder="Ej: TOTAL INCOME, NET RESULTS" />
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
              <div id="formulaPreviewText" class="formula-preview-text">
                (Sin términos)
              </div>
            </div>
          </div>
        `;
        break;
    }

    dom.formElemento.innerHTML = formHtml;
  }

  function getSectionOptions() {
    const sections = groupBySections(state.cuentas);
    return Array.from(sections.keys())
      .map((s) => `<option value="${escapeAttr(s)}">${escapeHtml(s)}</option>`)
      .join("");
  }

  function getSubsectionOptions() {
    const sections = groupBySections(state.cuentas);
    const options = [];

    sections.forEach((subs, principal) => {
      subs.forEach((_, secundaria) => {
        if (secundaria) {
          options.push(
            `<option value="${escapeAttr(secundaria)}">${escapeHtml(
              secundaria
            )}</option>`
          );
        }
      });
    });

    return options.join("") || '<option value="">Sin subsecciones</option>';
  }

  function getSectionCheckboxes() {
    const sections = groupBySections(state.cuentas);
    return Array.from(sections.keys())
      .map(
        (s) => `
        <div class="form-check">
          <input class="form-check-input" type="checkbox" value="${escapeAttr(
            s
          )}" id="chk_${escapeAttr(s)}">
          <label class="form-check-label" for="chk_${escapeAttr(
            s
          )}">${escapeHtml(s)}</label>
        </div>
      `
      )
      .join("");
  }

  async function confirmAdd() {
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
      await loadLayout();
    } catch (error) {
      console.error("Error adding element:", error);
      showToast(error.message, "error");
    }
  }

  async function addPrincipalSection() {
    const nombre = document.getElementById("inputNombreSeccion")?.value?.trim();
    if (!nombre) throw new Error("Ingresa un nombre para la sección");

    // Add a placeholder account to create the section
    const newAccount = {
      "SECCIÓN Principal": nombre,
      "SECCION Secundaria": "",
      CUENTA: "",
      NOMBRE: `[Sección: ${nombre}]`,
      orden: 0,
    };

    state.cuentas.push(newAccount);
    logChange("add", `Sección Principal "${nombre}"`, {
      nombre,
      type: "section",
    });
    showToast(`Sección "${nombre}" creada`, "success");
  }

  async function addSecondarySection() {
    const principal = document.getElementById("selectPrincipal")?.value;
    const nombre = document
      .getElementById("inputNombreSubseccion")
      ?.value?.trim();

    if (!nombre) throw new Error("Ingresa un nombre para la subsección");

    const newAccount = {
      "SECCIÓN Principal": principal,
      "SECCION Secundaria": nombre,
      CUENTA: "",
      NOMBRE: `[Subsección: ${nombre}]`,
      orden: 0,
    };

    state.cuentas.push(newAccount);
    logChange("add", `Subsección "${nombre}" en ${principal}`, {
      nombre,
      principal,
      type: "subsection",
    });
    showToast(`Subsección "${nombre}" creada`, "success");
  }

  async function addAccount() {
    const principal = document.getElementById("selectPrincipal")?.value;
    const secundaria = document.getElementById("selectSecundaria")?.value;
    const cuenta = document.getElementById("inputCuenta")?.value?.trim();
    const nombre = document.getElementById("inputNombre")?.value?.trim();

    if (!cuenta || !nombre)
      throw new Error("Completa el código y nombre de la cuenta");

    const newAccount = {
      "SECCIÓN Principal": principal,
      "SECCION Secundaria": secundaria,
      CUENTA: cuenta,
      NOMBRE: nombre,
      orden: state.cuentas.length + 1,
    };

    state.cuentas.push(newAccount);
    logChange("add", `Cuenta ${cuenta} - ${nombre}`, {
      cuenta,
      nombre,
      principal,
      secundaria,
    });
    showToast(`Cuenta ${cuenta} agregada`, "success");
  }

  async function addOperation() {
    const tipo = document.getElementById("selectTipoOp")?.value;
    const clase = document.getElementById("inputClase")?.value?.trim();
    const operacionIdInput = document
      .getElementById("inputOperacionId")
      ?.value?.trim();

    if (!clase) throw new Error("Ingresa una etiqueta para la operación");
    const operacionId = buildUniqueOperationId(operacionIdInput || clase);

    const checkedSections = Array.from(
      document.querySelectorAll("#checkboxSecciones input:checked")
    ).map((cb) => cb.value);

    // Determine if this is a subsection-level or section-level operation
    // Subsection-level: operates on 1 subsection (sums accounts in that subsection)
    // Section-level: operates on multiple subsections (sums across sections)
    const isSubsectionOp = checkedSections.length === 1;

    // Create operation with all required fields including CAPITULO
    const newOp = {
      CAPITULO: state.capitulo || "DEFAULT",
      OperacionId: operacionId,
      Clase: clase,
      SECCION: checkedSections.join(" + "),
      tipo: tipo || "sum-sections",
      signos: {},
      orden: nextOperationOrder(),
      // Store sections for formula display
      secciones: checkedSections,
      // Link to parent subsection for inline display
      parentSubsection: isSubsectionOp ? checkedSections[0] : null,
      parentSection: getParentSection(checkedSections[0]),
    };

    // Poblamos la fórmula a partir de su "papá" (sección) respetando orden
    const derivedTerms = buildFormulaTermsFromParent(newOp.SECCION);
    const fallbackTerms = (
      checkedSections.length ? checkedSections : [newOp.SECCION]
    )
      .filter(Boolean)
      .map((sec, i) => ({
        id: Date.now() + i,
        operator: "+",
        type: "section",
        value: sec,
      }));

    const termsToPersist = normalizeFormulaTerms(
      derivedTerms.length ? derivedTerms : fallbackTerms
    );

    newOp.formula_terms = termsToPersist;

    termsToPersist.forEach((term, i) => {
      const key = `seccion_${i + 1}`;
      newOp[key] = term.value;
      newOp.signos[key] = term.operator === "-" ? -1 : 1;
    });

    state.operaciones.push(newOp);
    logChange("add", `Operación "${clase}" (${operacionId})`, {
      clase,
      operacionId,
      tipo,
      sections: checkedSections.length,
    });
    renderLayout(); // Re-render to show inline
    showToast(`Operación "${clase}" creada`, "success");
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
            empresaId: "EMPRESA01",
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
  }

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
  async function saveLayout() {
    if (!state.editMode) {
      showToast("Activa el modo edición primero", "warning");
      return;
    }

    // Validar contexto
    if (!state.modulo || !state.anio || !state.capitulo) {
      showToast(
        "⚠️ Falta información: módulo, año o capítulo no definido",
        "error"
      );
      console.error("Contexto incompleto:", {
        modulo: state.modulo,
        anio: state.anio,
        capitulo: state.capitulo,
      });
      return;
    }

    // Generar resumen de cambios
    const changesSummary = generateChangesSummary();

    if (changesSummary.total === 0) {
      showToast("ℹ️ No hay cambios para guardar", "info");
      return;
    }

    // Mostrar modal de confirmación con resumen
    const confirmed = await showSaveConfirmation(changesSummary);
    if (!confirmed) {
      return;
    }

    setStatus("Guardando...");

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
            empresaId: "EMPRESA01",
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
      hydrateOperationsFromParents();
      ensureOperationIds();
      normalizeOperationReferences();
      const operacionesOrdenadas = sortOperations(state.operaciones);
      state.operaciones = operacionesOrdenadas;
      const operacionesParaGuardar = buildOperacionesParaGuardar(
        operacionesOrdenadas
      );
      if (operacionesParaGuardar.length) {
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
              empresaId: "EMPRESA01",
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
      }

      state.unsavedChanges = false;
      state.changeLog = []; // Limpiar log de cambios
      state.columnasConfigChanged = false;
      updateButtonStates();
      setStatus("Guardado correctamente");
      showToast("✅ Layout guardado exitosamente", "success");

      // Registrar en bitácora
      await addToBitacora(
        "GUARDAR",
        `Se guardaron ${changesSummary.total} cambios en ${state.modulo} ${state.anio}: ${changesSummary.summary}`
      );
    } catch (error) {
      console.error("Error saving layout:", error);
      setStatus("Error al guardar");
      showToast(error.message, "error");
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
    state.selectedElement = { type: "account", codigo };
    updateSelectionInfo();
  };

window.editSection = function (name) {
    if (!requireEditMode()) return;
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
    document.querySelector(
      'input[name="tipoElemento"][value="cuenta"]'
    ).checked = true;
    updateAddForm();
    setTimeout(() => {
      const selectP = document.getElementById("selectPrincipal");
      const selectS = document.getElementById("selectSecundaria");
      if (selectP) selectP.value = principal;
      if (selectS) selectS.value = secundaria;
    }, 100);
    new bootstrap.Modal(dom.modalAgregar).show();
  };

  window.editAccount = function (codigo) {
    if (!requireEditMode()) return;
    const cuenta = state.cuentas.find((c) => c.CUENTA === codigo);
    if (!cuenta) return;

    dom.formEditar.innerHTML = `
      <div class="mb-3">
        <label class="form-label">Código</label>
        <input type="text" class="form-control" id="editCodigo" value="${escapeHtml(
          cuenta.CUENTA
        )}" />
      </div>
      <div class="mb-3">
        <label class="form-label">Nombre</label>
        <input type="text" class="form-control" id="editNombre" value="${escapeHtml(
          cuenta.NOMBRE || ""
        )}" />
      </div>
    `;

    state.selectedElement = { type: "account", cuenta };
    updateSelectionInfo();
    new bootstrap.Modal(dom.modalEditar).show();
  };

  window.deleteAccount = function (codigo) {
    if (!requireEditMode()) return;
    if (!confirm(`¿Eliminar la cuenta ${codigo}?`)) return;

    const cuenta = state.cuentas.find((c) => c.CUENTA === codigo);
    const nombre = cuenta?.NOMBRE || "";

    state.cuentas = state.cuentas.filter((c) => c.CUENTA !== codigo);
    logChange("delete", `Cuenta ${codigo}${nombre ? " - " + nombre : ""}`, {
      codigo,
      nombre,
    });
    renderLayout();
    updateStats();
    showToast(`Cuenta ${codigo} eliminada`, "success");
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

  window.editOperation = async function (operationId) {
    if (!requireEditMode()) return;
    const op = findOperationByIdOrLabel(operationId);
    if (!op) return;

    const opId = getOperationId(op);
    const opLabel = getOperationLabel(op);

    // AUTO-LOAD: Buscar operación predefinida y pre-cargar si existe
    await ensureOperacionesPredefinidas();
    const operacionesContexto = getOperacionesPredefinidasContexto();
    const opPredefinida = operacionesContexto.find(
      (pred) =>
        normalizeOperacionKey(pred.nombre) === normalizeOperacionKey(opLabel) ||
        normalizeOperacionKey(pred.nombre) ===
          normalizeOperacionKey(op.Clase || "")
    );

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

    const modalTitle = dom.modalEditar?.querySelector(".modal-title");
    if (modalTitle) {
      modalTitle.textContent = `Editar: ${getOperationDisplayName(op)} (${opId})`;
    }

    // Get available elements to determine correct types
    const elements = getAvailableElements();
    const operationKeys = new Set();
    elements.operations.forEach((opItem) => {
      if (!opItem) return;
      if (typeof opItem === "string") {
        operationKeys.add(normalizeOperationMatch(opItem));
        return;
      }
      if (opItem.id) operationKeys.add(normalizeOperationMatch(opItem.id));
      if (opItem.label) operationKeys.add(normalizeOperationMatch(opItem.label));
    });
    const sectionNames = elements.sections.map((s) =>
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
    const rowLabelsHtml = OP_ROW_FIELDS.map(
      (row) => `
        <div class="col-md-6">
          <label class="form-label small text-muted">${row.label}</label>
          <input type="text" class="form-control" id="${rowLabelInputId(
            row.field
          )}" value="${escapeHtml(op[row.field] || "")}" placeholder="${
        row.placeholder
      }" />
        </div>
      `
    ).join("");

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
        <label class="form-label">Etiquetas en tabla</label>
        <div class="row g-2">
          ${rowLabelsHtml}
        </div>
        <div class="form-text">
          Estas etiquetas son las que aparecen en las tablas. Deja en blanco si no aplica.
        </div>
      </div>

      <div class="mb-3">
        <label class="form-label fw-bold">Constructor de Fórmula</label>
        <div id="formulaBuilderContainer">
          <!-- El FormulaBuilder se renderizará aquí -->
        </div>
        <div class="d-flex flex-wrap gap-2 mt-2">
          <button
            type="button"
            class="btn btn-outline-secondary btn-sm"
            onclick="window.FormulaBuilder && window.FormulaBuilder.suggestFromName && window.FormulaBuilder.suggestFromName()"
          >
            <i class="bi bi-lightbulb me-1"></i>Sugerir desde nombre
          </button>
          <button
            type="button"
            class="btn btn-outline-info btn-sm"
            onclick="window.FormulaBuilder && window.FormulaBuilder.showMap && window.FormulaBuilder.showMap()"
          >
            <i class="bi bi-diagram-3 me-1"></i>Ver mapa visual
          </button>
        </div>
      </div>
    `;

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

    // Expand section terms to individual accounts for display
    // Inicializar FormulaBuilder si está disponible
    if (window.FormulaBuilder) {
      const availableElements = getAvailableElements();
      console.log("🎯 Llamando FormulaBuilder.init con op:", op);
      window.FormulaBuilder.init(op, availableElements);
    } else {
      // Fallback: renderizar términos manualmente
      expandSectionTermsToAccounts();
      renderFormulaTerms();
    }

    new bootstrap.Modal(dom.modalEditar).show();
  };

  // Helper para el toggle en edición
  window.toggleEditFormulaBuilder = function () {
    // Builder always shown in edit mode
    // Removed updateFormulaPreview() - not needed
  };

  window.deleteOperation = function (operationId) {
    if (!requireEditMode()) return;
    const op = findOperationByIdOrLabel(operationId);
    if (!op) return;
    const label = getOperationLabel(op);
    const opId = getOperationId(op);
    if (!confirm(`Eliminar la operacion "${label}"?`)) return;

    state.operaciones = state.operaciones.filter((o) => getOperationId(o) !== opId);
    logChange("delete", `Operación "${label}" (${opId})`, {
      clase: label,
      operacionId: opId,
    });
    renderLayout();
    updateStats();
    showToast(`Operación "${label}" eliminada`, "success");
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
        <label class="form-label">Mapa de Operación (Fórmula Expandida)</label>
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

    if (state.selectedElement.type === "account") {
      const cuenta = state.selectedElement.cuenta;
      const oldCodigo = cuenta.CUENTA;
      const oldNombre = cuenta.NOMBRE;
      const newCodigo = document.getElementById("editCodigo")?.value?.trim();
      const newNombre = document.getElementById("editNombre")?.value?.trim();

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
      const newClase = document.getElementById("editClaseOp")?.value?.trim();
      const newIdInput = document
        .getElementById("editOperacionId")
        ?.value?.trim();

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

      // Usar FormulaBuilder si esta disponible
      if (window.FormulaBuilder) {
        const validation = window.FormulaBuilder.validate();
        if (!validation.isValid) {
          showToast(
            "Formula incompleta:\n" + validation.errors.join("\n"),
            "error"
          );
          return;
        }

        // Guardar formula en formato JSON
        op.formula_json = window.FormulaBuilder.getFormulaJSON();
        op.formula_terms = JSON.parse(op.formula_json);

        // Mantener compatibilidad con formato legacy
        op.signos = {};
        for (let i = 1; i <= 20; i++) {
          delete op[`seccion_${i}`];
        }

        op.formula_terms = normalizeFormulaTerms(op.formula_terms);
        op.formula_terms.forEach((term, i) => {
          const key = `seccion_${i + 1}`;
          op[key] = term.value;
          op.signos[key] = term.operator === "-" ? -1 : 1;
        });

        // Si es una sola seccion, asegurar SECCION
        if (
          op.formula_terms.length === 1 &&
          op.formula_terms[0].type === "section"
        ) {
          op.SECCION = op.formula_terms[0].value;
        }
      } else {
        // Fallback: usar formulaTerms global
        op.formula_terms = normalizeFormulaTerms(formulaTerms);
        op.signos = {};
        for (let i = 1; i <= 20; i++) {
          delete op[`seccion_${i}`];
        }

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
    }

    state.unsavedChanges = true;
    updateButtonStates();
    renderLayout();
    updateStats();

    bootstrap.Modal.getInstance(dom.modalEditar)?.hide();
    showToast("Cambios aplicados", "success");
  }

  function deleteElement() {
    if (!state.selectedElement) return;

    const type = state.selectedElement.type;

    if (type === "account") {
      const codigo = state.selectedElement.cuenta?.CUENTA;
      if (codigo && confirm(`Eliminar la cuenta ${codigo}?`)) {
        state.cuentas = state.cuentas.filter((c) => c.CUENTA !== codigo);
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
    bootstrap.Modal.getInstance(dom.modalEditar)?.hide();
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
    const section = sections.find((s) => s.name === parentName);
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
      const secondaryKey = normalizeKey(
        c.seccion_secundaria ||
          c["SECCION Secundaria"] ||
          c["SECCIÓN Secundaria"] ||
          c["SECCIàN Secundaria"] ||
          c["SECCI.N Secundaria"] ||
          ""
      );
      const primaryKey = normalizeKey(
        c["SECCI…N Principal"] ||
          c["SECCIÓN Principal"] ||
          c["SECCIàN Principal"] ||
          c["SECCI.N Principal"] ||
          c["SECCION Principal"] ||
          c.SECCION ||
          c.seccion_principal ||
          ""
      );
      if (!matchesParent(primaryKey)) return false;
      return secondaryKey === sectionKey || primaryKey === sectionKey;
    });

    // Try partial match if no exact match
    if (accounts.length === 0) {
      accounts = state.cuentas.filter((c) => {
        const secondaryKey = normalizeKey(
          c.seccion_secundaria ||
            c["SECCION Secundaria"] ||
            c["SECCIÓN Secundaria"] ||
            c["SECCIàN Secundaria"] ||
            c["SECCI.N Secundaria"] ||
            ""
        );
        const primaryKey = normalizeKey(
          c["SECCI…N Principal"] ||
            c["SECCIÓN Principal"] ||
            c["SECCIàN Principal"] ||
            c["SECCI.N Principal"] ||
            c["SECCION Principal"] ||
            c.SECCION ||
            c.seccion_principal ||
            ""
        );
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

  // Renderizar los términos
  function renderFormulaTerms() {
    const container = document.getElementById("formulaTerms");
    if (!container) return;

    const accountCatalog = getAccountCatalog();

    // Ensure all terms are type "account" (migration)
    formulaTerms.forEach((term) => {
      term.type = "account";
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
        }, this.value)" ${isFirst ? "disabled" : ""}>
          <option value="" ${
            term.operator === "" ? "selected" : ""
          }>Inicio</option>
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
    const previewContainer = document.getElementById("formulaPreview");
    if (!previewContainer) return;

    if (formulaTerms.length === 0) {
      previewContainer.innerHTML =
        '<div class="text-muted small fst-italic">Agrega cuentas para construir la fórmula...</div>';
      return;
    }

    const preview = formulaTerms
      .map((term, i) => {
        const operator = i === 0 ? "" : ` ${term.operator || "+"} `;
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
  }

  // Actualizar operador de término
  window.updateTermOperator = function (termId, operator) {
    const term = formulaTerms.find((t) => t.id === termId);
    if (term) {
      term.operator = operator;
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
    // Removed updateFormulaPreview() - not needed
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
  let cuentasCache = null;
  let cuentasCacheAnio = null;

  // Función global para buscar cuentas dinámicamente
  window.buscarCuentasDinamicas = async function (query) {
    if (!query || query.length < 2) return;

    const datalist = document.getElementById("datalistCuentas");
    if (!datalist) return;

    const anioActual = state.anio || new Date().getFullYear();

    // Cargar cache si no existe o cambió el año
    if (!cuentasCache || cuentasCacheAnio !== anioActual) {
      try {
        const headers = getAuthHeaders();
        const response = await fetch(
          `/api/cuentas-activas?anio=${anioActual}`,
          { headers }
        );
        if (response.ok) {
          cuentasCache = await response.json();
          cuentasCacheAnio = anioActual;
        } else {
          cuentasCache = [];
        }
      } catch (err) {
        console.warn("Error al cargar cuentas:", err);
        cuentasCache = [];
      }
    }

    // Filtrar cuentas que coincidan
    const queryLower = query.toLowerCase();
    const matches = (cuentasCache || [])
      .filter(
        (c) =>
          (c.CUENTA || "").toLowerCase().includes(queryLower) ||
          (c.NOMBRE || "").toLowerCase().includes(queryLower)
      )
      .slice(0, 20); // Limitar a 20 resultados

    // Actualizar datalist
    // Actualizar datalist
    datalist.innerHTML = matches
      .map(
        (c) =>
          `<option value="${c.CUENTA}" label="${c.NOMBRE || c.CUENTA}">${
            c.CUENTA
          } - ${c.NOMBRE || ""}</option>`
      )
      .join("");
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
          empresaId: "EMPRESA01",
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
      capitulo: state.capitulo,
      cuentas: state.cuentas || [],
      operaciones: sortOperations(state.operaciones || []),
    };

    let currentOptions = {
      showHiddenRows: false,
      showSampleData: true,
      monthsToShow: 3,
    };

    const renderWithOptions = (options) => {
      currentOptions = { ...options };
      dom.previewContainer.innerHTML =
        window.LayoutControls.renderRealisticPreview(layoutData, currentOptions);
      bindPreviewControls();
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
      const response = await fetch('../info IMPORTANTE/logica operaciones.json');
      if (!response.ok) {
        console.warn('No se pudo cargar logica operaciones.json');
        return {};
      }
      
      const operacionesArray = await response.json();
      const operacionesMap = {};
      
      // Procesar cada operación del JSON
      operacionesArray.forEach((item) => {
        const capituloKey = normalizeCapituloKey(item.Capítulo);
        const moduloCompleto = item.Módulo || "";
        const moduloKey = normalizeModuloKey(
          String(moduloCompleto).replace(".html", "")
        );
        const operacion = item.Operaciones;
        if (!operacion) return;
        
        // Parsear la operación: "Nombre= Fórmula"
        const match = operacion.match(/^(.+?)=\s*(.+)$/);
        if (!match) return;
        
        const nombre = match[1].trim();
        const formula = match[2].trim();
        
        // Determinar tipo de operación por nombre
        let aparece = ['sum-row'];
        if (nombre.toLowerCase().includes('resultado operativo')) {
          aparece = ['sum-row-operativo'];
        } else if (nombre.toLowerCase().includes('resultado') && !nombre.toLowerCase().includes('operativo')) {
          aparece = ['result-row'];
        }
        
        // Inicializar estructura si no existe
        if (!capituloKey || !moduloKey) return;

        if (!operacionesMap[capituloKey]) {
          operacionesMap[capituloKey] = {};
        }
        if (!operacionesMap[capituloKey][moduloKey]) {
          operacionesMap[capituloKey][moduloKey] = [];
        }
        
        // Agregar operación
        operacionesMap[capituloKey][moduloKey].push({
          nombre: nombre,
          formula: formula,
          aparece: aparece
        });
      });
      
      console.log('✅ Operaciones cargadas desde JSON:', operacionesMap);
      return operacionesMap;
    } catch (error) {
      console.error('Error cargando operaciones desde JSON:', error);
      return {};
    }
  };

  const cargarOperacionesDesdeSumasCSV = async () => {
    const archivos = [
      "SUMAS CIUDAD DE MEXICO.csv",
      "SUMAS GUADALAJARA.csv",
      "SUMAS NOROESTE.csv",
    ];
    const operacionesMap = {};
    const moduloKeys = ["SUMMARY", "RESUMEN"].map((m) => normalizeModuloKey(m));

    for (const archivo of archivos) {
      try {
        const response = await fetch(
          encodeURI(`../info IMPORTANTE/${archivo}`)
        );
        if (!response.ok) {
          console.warn(`No se pudo cargar ${archivo}`);
          continue;
        }
        const text = await response.text();
        const { headerIndex, rows } = parseCsvLines(text);
        if (!rows.length) continue;

        rows.forEach((cols, idx) => {
          const capituloRaw = getCsvValue(cols, headerIndex, "CAPITULO") || "";
          const clase = getCsvValue(cols, headerIndex, "CLASE");
          const seccion = getCsvValue(cols, headerIndex, "SECCION");

          if (!clase || !seccion) return;

          const sumRowLabel = getCsvValue(cols, headerIndex, "UNNAMED4");
          const sumRowSumavariosLabel = getCsvValue(
            cols,
            headerIndex,
            "UNNAMED6"
          );
          const sumRowOperativoLabel = getCsvValue(
            cols,
            headerIndex,
            "UNNAMED8"
          );
          const resultNetLabel = getCsvValue(cols, headerIndex, "UNNAMED10");

          const op0 = getCsvValue(cols, headerIndex, "OPERACION");
          const op1 = getCsvValue(cols, headerIndex, "OPERACION1");
          const op2 = getCsvValue(cols, headerIndex, "OPERACION2");
          const op3 = getCsvValue(cols, headerIndex, "OPERACION3");

          const capituloKey = normalizeCapituloKey(capituloRaw);
          if (!capituloKey) return;

          const placementLabels = {};
          const placementSigns = {};

          if (sumRowLabel) {
            placementLabels["sum-row"] = sumRowLabel;
            placementSigns["sum-row"] = parseSumasSign(op0);
          }
          if (sumRowSumavariosLabel) {
            placementLabels["sum-row-sumavarios"] = sumRowSumavariosLabel;
            placementSigns["sum-row-sumavarios"] = parseSumasSign(op1);
          }
          if (sumRowOperativoLabel) {
            placementLabels["sum-row-operativo"] = sumRowOperativoLabel;
            placementSigns["sum-row-operativo"] = parseSumasSign(op2);
          }
          if (resultNetLabel) {
            placementLabels["result-net-row"] = resultNetLabel;
            placementSigns["result-net-row"] = parseSumasSign(op3);
          }

          const predef = {
            id: clase,
            nombre: clase,
            formula: seccion,
            section: seccion,
            orden: idx,
            source: "sumas",
            placementLabels,
            placementSigns,
            parentSection: resolveSumasParent(clase, sumRowLabel),
          };

          moduloKeys.forEach((moduloKey) => {
            if (!moduloKey) return;
            if (!operacionesMap[capituloKey]) {
              operacionesMap[capituloKey] = {};
            }
            if (!operacionesMap[capituloKey][moduloKey]) {
              operacionesMap[capituloKey][moduloKey] = [];
            }
            operacionesMap[capituloKey][moduloKey].push(predef);
          });
        });
      } catch (error) {
        console.error(`Error cargando ${archivo}:`, error);
      }
    }

    console.log("? Operaciones cargadas desde SUMAS CSV:", operacionesMap);
    return operacionesMap;
  };

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
  ensureOperacionesPredefinidas();

  const getOperacionesPredefinidasContexto = () => {
    const capituloKey = normalizeCapituloKey(state.capitulo);
    const moduloKey = normalizeModuloKey(state.modulo);
    if (!capituloKey || !moduloKey) return [];
    return OPERACIONES_PREDEFINIDAS[capituloKey]?.[moduloKey] || [];
  };

  const normalizeOperacionKey = (value) => normalizeKey(value);

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
    const parentSubsection = predef.section || predef.formula || null;
    const parentSection = predef.parentSection || null;
    const op = {
      CAPITULO: state.capitulo || "DEFAULT",
      OperacionId: opId,
      Clase: predef.nombre,
      SECCION: predef.formula,
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
    const parentSubsection = predef.section || predef.formula || null;
    const parentSection = predef.parentSection || null;

    if (!op.CAPITULO && state.capitulo) {
      op.CAPITULO = state.capitulo;
      changed = true;
    }

    if (Number.isFinite(orderValue) && op.orden !== orderValue) {
      op.orden = orderValue;
      changed = true;
    }

    if (parentSubsection && (force || op.parentSubsection !== parentSubsection)) {
      op.parentSubsection = parentSubsection;
      changed = true;
    }

    if (parentSection && (force || op.parentSection !== parentSection)) {
      op.parentSection = parentSection;
      changed = true;
    }

    if (parentSubsection && (!Array.isArray(op.secciones) || force)) {
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

    if (predef.formula && (force || !op.SECCION || !formulaIsSame)) {
      op.SECCION = predef.formula;
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
    (state.operaciones || []).forEach((op) => {
      const key = normalizeOperacionKey(
        op.Clase || getOperationDisplayName(op)
      );
      if (key) {
        existingByKey.set(key, op);
      }
    });

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
      const key = normalizeOperacionKey(predef.nombre);
      const existing = existingByKey.get(key);
      if (!existing) {
        if (!autoCreate) return;
        const newOp = createOperationFromPredefined(
          predef,
          orderIndex,
          knownOperations
        );
        state.operaciones.push(newOp);
        existingByKey.set(key, newOp);
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
      normalizeOperationReferences();
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
    normalizeOperationReferences();
    state.unsavedChanges = true;
    updateButtonStates();
    renderLayout();
    showToast(`Operación "${op.nombre}" agregada`, "success");
  };

  /**
   * Poblar todas las operaciones predefinidas
   */
  window.poblarTodasOperaciones = async function () {
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

    if (module && dom.moduloSelect) {
      dom.moduloSelect.value = module;
      state.modulo = module;
    }

    if (chapter && dom.capituloSelect) {
      dom.capituloSelect.value = chapter;
      state.capitulo = chapter;
    }

    if (year && dom.anioSelect) {
      dom.anioSelect.value = year;
      state.anio = parseInt(year);
    }

    if (module || chapter || year) {
      updateHeaderLabels();
      tryLoadLayout();
    }
  }

  // Guardar contexto cuando cambie
  const originalHandleModuloChange = window.handleModuloChange || handleModuloChange;
  const originalHandleCapituloChange = window.handleCapituloChange || handleCapituloChange;
  const originalHandleAnioChange = window.handleAnioChange || handleAnioChange;

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

