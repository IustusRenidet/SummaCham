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
    unsavedChanges: false,
    editMode: false,
    selectedElement: null,
  };

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

    // Views
    dom.placeholderView = document.getElementById("placeholderView");
    dom.layoutView = document.getElementById("layoutView");
    dom.layoutPreview = document.getElementById("layoutPreview");

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
      hydrateOperationsFromParents();

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
        <p>Puedes crear un layout nuevo o copiar uno existente de otro año.</p>
        <div class="prompt-actions">
          <button class="btn btn-success btn-lg" onclick="document.getElementById('btnDemo').click()">
            <i class="bi bi-magic me-2"></i>Crear Layout Demo
          </button>
          <button class="btn btn-outline-primary btn-lg" onclick="document.getElementById('btnCopiar').click()">
            <i class="bi bi-copy me-2"></i>Copiar de Otro Año
          </button>
        </div>
        <div class="prompt-hint">
          <i class="bi bi-lightbulb"></i>
          <span>El layout demo incluye secciones estándar de ingresos, gastos y resultados</span>
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
    const raw = cuenta?.orden ?? cuenta?.Orden;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function getOperationOrder(op, fallback = 0) {
    const raw = op?.orden ?? op?.Orden ?? op?.index;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function getOperationDisplayName(op) {
    return (
      op?.["sum-row"] ||
      op?.["sum-row-sumavarios"] ||
      op?.["sum-row-sumavarios-consolidado"] ||
      op?.["sum-row-operativo"] ||
      op?.["result-row"] ||
      op?.["net-row"] ||
      op?.["result-net-row"] ||
      op?.Clase ||
      "Operación"
    );
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
    const isOperation = state.operaciones.some(
      (op) => op.Clase && op.Clase.toLowerCase() === value.toLowerCase()
    );
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
    if (!state.cuentas.length && !state.operaciones.length) {
      dom.layoutPreview.innerHTML = `
        <div class="empty-state">
          <i class="bi bi-inbox"></i>
          <p>No hay elementos en este layout</p>
          <button class="btn btn-success btn-sm" onclick="document.getElementById('btnAgregar').click()">
            <i class="bi bi-plus-circle me-1"></i>Agregar primer elemento
          </button>
        </div>
      `;
      return;
    }

    // Group sections with their inline operations
    const sections = groupBySections(state.cuentas);
    let html = "";

    // Track operations that have been rendered inline
    const renderedInlineOps = new Set();

    // Render sections with inline operations (and track which ops are rendered)
    sections.forEach((section) => {
      const principal = section.name;
      const principalLower = principal.toLowerCase();
      const isIncomeSection = principalLower.includes("income");
      const isExpenseSection = principalLower.includes("expense");

      // Find all operations that belong to subsections in this section
      section.subsections.forEach(({ accounts, name: subsectionName }) => {
        const matchingOps = state.operaciones.filter((op) => {
          const clase = (op.Clase || "").toLowerCase();

          // Check if operation type matches section type
          const isIncomeOp = clase.includes("income");
          const isExpenseOp = clase.includes("expense");

          // Only match if section type matches operation type
          if (isIncomeSection && isExpenseOp) return false;
          if (isExpenseSection && isIncomeOp) return false;

          // Match by parentSubsection field
          if (
            op.parentSubsection &&
            op.parentSubsection.toLowerCase() === subsectionName.toLowerCase()
          ) {
            if (op.parentSection) {
              return op.parentSection.toLowerCase() === principalLower;
            }
            return true;
          }

          // Match by Clase containing subsection name
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
        matchingOps.forEach((op) => renderedInlineOps.add(op.Clase || op));
      });
      html += renderSection(section);
    });

    // Render section-level operations (only those NOT already rendered inline)
    const sectionLevelOps = state.operaciones.filter((op) => {
      // Skip if already rendered inline
      if (renderedInlineOps.has(op.Clase)) {
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
          consolidatedLabels.get(label).operations.push(op.Clase || op.SECCION);
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

    dom.layoutPreview.innerHTML = html;
    bindLayoutEvents();
  }

  // Find if an operation matches a specific subsection
  function findMatchingSubsection(op) {
    const clase = (op.Clase || "").toLowerCase();
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
    const clase = op.Clase || "Operación";
    const displayName = getOperationDisplayName(op);
    const tipo = detectOperationType(op);
    const formula = formatFormula(op);

    return `
      <div class="layout-section operation-section ${tipo}">
        <div class="operation-row ${tipo}" onclick="editOperation('${escapeAttr(
      clase
    )}')">
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
              clase
            )}')" title="Editar">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation(); deleteOperation('${escapeAttr(
              clase
            )}')" title="Eliminar">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // Renderiza una operación inline dentro de una subsección
  function renderInlineOperation(op, accounts) {
    const clase = op.Clase || "Operación";
    const displayName = getOperationDisplayName(op);
    // Build formula from actual account names
    const formula = accounts
      .map((a) => a.NOMBRE || a.nombre || a.CUENTA)
      .join(" + ");

    return `
      <div class="inline-operation-row" onclick="editOperation('${escapeAttr(
        clase
      )}')">
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
            clase
          )}')" title="Editar">
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
      return op.formula_terms.map((term) => ({
        operator: term.operator || "+",
        type: term.type || "section",
        value: term.value || "",
      }));
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

    return terms;
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
            term.value || (term.type === "const" ? term.constValue : "???");
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
      const clase = (op.Clase || "").toLowerCase();

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
          )}')" title="Editar">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation(); deleteAccount('${escapeAttr(
            codigo
          )}')" title="Eliminar">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
    `;
  }

  function renderOperationsSection() {
    const opsHtml = state.operaciones
      .map((op) => {
        const clase = op.Clase || "Operación";
        const tipo = detectOperationType(op);
        const termsCount = op.formula_terms?.length || 0;

        return `
        <div class="operation-row ${tipo}">
          <div class="operation-label" onclick="editOperation('${escapeAttr(
            clase
          )}')">
            <i class="bi bi-calculator"></i>
            <span>${escapeHtml(clase)}</span>
            <span class="operation-type">${tipo}</span>
            ${
              termsCount > 0
                ? `<span class="badge bg-secondary ms-2">${termsCount} términos</span>`
                : ""
            }
          </div>
          <div class="account-actions">
            <button class="btn btn-sm btn-outline-info" onclick="event.stopPropagation(); showOperationMap('${escapeAttr(
              clase
            )}')" title="Ver Mapa">
              <i class="bi bi-diagram-3"></i>
            </button>
            <button class="btn btn-sm btn-outline-primary" onclick="event.stopPropagation(); editOperation('${escapeAttr(
              clase
            )}')" title="Editar">
              <i class="bi bi-pencil"></i>
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
    const clase = (op.Clase || "").toLowerCase();
    if (clase.includes("net")) return "net";
    if (clase.includes("result")) return "result";
    return "sum";
  }

  function bindLayoutEvents() {
    // Additional event bindings for dynamic content
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
    state.unsavedChanges = true;
    updateButtonStates();
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
    state.unsavedChanges = true;
    updateButtonStates();
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
    state.unsavedChanges = true;
    updateButtonStates();
    showToast(`Cuenta ${cuenta} agregada`, "success");
  }

  async function addOperation() {
    const tipo = document.getElementById("selectTipoOp")?.value;
    const clase = document.getElementById("inputClase")?.value?.trim();

    if (!clase) throw new Error("Ingresa una etiqueta para la operación");

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
    state.unsavedChanges = true;
    updateButtonStates();
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
  async function saveLayout() {
    if (!state.editMode) {
      showToast("Activa el modo edición primero", "warning");
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

      if (!accResponse.ok) throw new Error("Error al guardar cuentas");

      // Save operations
      if (state.operaciones.length) {
        hydrateOperationsFromParents();
        const operacionesOrdenadas = sortOperations(state.operaciones);
        state.operaciones = operacionesOrdenadas;
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
              operaciones: operacionesOrdenadas,
            }),
          }
        );

        if (!opResponse.ok) throw new Error("Error al guardar operaciones");
      }

      state.unsavedChanges = false;
      updateButtonStates();
      setStatus("Guardado correctamente");
      showToast("Layout guardado", "success");

      // Registrar en bitácora
      await addToBitacora(
        "GUARDAR",
        `Se guardaron cambios en el layout de ${state.modulo} ${state.anio}`
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

    const anio = prompt(
      "¿Para qué año deseas crear la plantilla demo?",
      new Date().getFullYear().toString()
    );
    if (!anio) return;

    try {
      const response = await fetch(
        `${API_BASE}/${encodeURIComponent(state.modulo)}/${anio}/demo`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            empresaId: "EMPRESA01",
            capitulo: state.capitulo || "DEFAULT",
          }),
        }
      );

      if (!response.ok) throw new Error("No se pudo crear la demo");

      showToast(`Demo creada para ${anio}`, "success");

      // Registrar en bitácora
      await addToBitacora(
        "CREAR",
        `Se generó un layout demo para el año ${anio} en el módulo ${state.modulo}`
      );

      await loadYears();
      dom.anioSelect.value = anio;
      state.anio = anio;
      await loadLayout();
    } catch (error) {
      console.error("Error creating demo:", error);
      showToast(error.message, "error");
    }
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

  window.showOperationMap = function (clase) {
    const op = state.operaciones.find((o) => o.Clase === clase);
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

    console.log("Mostrando mapa para:", clase, "términos:", op.formula_terms);

    // Usar FormulaBuilder para mostrar el mapa
    if (
      window.FormulaBuilder &&
      typeof window.FormulaBuilder.showMap === "function"
    ) {
      // Temporalmente setear los términos en FormulaBuilder
      window.FormulaBuilder.terms = op.formula_terms || [];
      window.FormulaBuilder.currentOperationId = op.id;
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
  };

  window.editSection = function (name) {
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
    new bootstrap.Modal(dom.modalEditar).show();
  };

  window.deleteSection = function (name) {
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
    new bootstrap.Modal(dom.modalEditar).show();
  };

  window.deleteSubsection = function (principal, name) {
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
    new bootstrap.Modal(dom.modalEditar).show();
  };

  window.deleteAccount = function (codigo) {
    if (!confirm(`¿Eliminar la cuenta ${codigo}?`)) return;

    state.cuentas = state.cuentas.filter((c) => c.CUENTA !== codigo);
    state.unsavedChanges = true;
    updateButtonStates();
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

  window.editOperation = function (clase) {
    const op = state.operaciones.find((o) => o.Clase === clase);
    if (!op) return;

    const modalTitle = dom.modalEditar?.querySelector(".modal-title");
    if (modalTitle) {
      modalTitle.textContent = `Editar: ${getOperationDisplayName(op)}`;
    }

    // Get available elements to determine correct types
    const elements = getAvailableElements();
    const operationNames = elements.operations.map((o) => o.toLowerCase());
    const sectionNames = elements.sections.map((s) => s.toLowerCase());
    const extractedFromFields = extractFormulaTerms(op);

    // Helper to detect if a value is an operation or section
    // Priority: exact match in sections > exact match in operations > fuzzy section > default to section
    function detectValueType(value) {
      if (!value) return "section";
      const lower = value.toLowerCase().trim();

      // First check EXACT match in sections (most common case)
      if (sectionNames.includes(lower)) {
        return "section";
      }

      // Then check EXACT match in operations (Clase names)
      if (operationNames.includes(lower)) {
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

    dom.formEditar.innerHTML = `
      <div class="mb-3">
        <label class="form-label">Etiqueta de la Operación</label>
        <input type="text" class="form-control" id="editClaseOp" value="${escapeHtml(
          op["sum-row"] || op.Clase
        )}" />
      </div>

      <div class="mb-3">
        <label class="form-label fw-bold">Constructor de Fórmula</label>
        <div id="formulaBuilderContainer">
          <!-- El FormulaBuilder se renderizará aquí -->
        </div>
      </div>
    `;

    state.selectedElement = { type: "operation", op };

    // Asegurar que op tenga formula_terms poblados antes de pasarlo a FormulaBuilder
    console.log("📝 editOperation - formulaTerms construidos:", formulaTerms);
    op.formula_terms = formulaTerms;
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

  window.deleteOperation = function (clase) {
    if (!confirm(`¿Eliminar la operación "${clase}"?`)) return;

    state.operaciones = state.operaciones.filter((o) => o.Clase !== clase);
    state.unsavedChanges = true;
    updateButtonStates();
    renderLayout();
    updateStats();
    showToast(`Operación "${clase}" eliminada`, "success");
  };

  // Edit a consolidated label (shows all contributing operations and accounts)
  window.editConsolidatedLabel = function (label, field) {
    const modalTitle = dom.modalEditar?.querySelector(".modal-title");
    if (modalTitle) {
      modalTitle.textContent = `Editar etiqueta: ${label}`;
    }

    // Find all operations that have this label for this field
    const affectedOps = state.operaciones.filter((op) => op[field] === label);

    if (affectedOps.length === 0) {
      showToast("No se encontraron operaciones para esta etiqueta", "error");
      return;
    }

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

    // Expand section terms to individual accounts
    expandSectionTermsToAccounts();

    // Build modal content
    dom.formEditar.innerHTML = `
      <div class="mb-3">
        <label class="form-label">Etiqueta Consolidada</label>
        <input type="text" class="form-control" id="editConsolidatedLabelName" value="${escapeHtml(
          label
        )}" />
        <small class="text-muted">Tipo: ${escapeHtml(field)}</small>
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
      field,
      affectedOps,
    };

    renderFormulaTerms();
    new bootstrap.Modal(dom.modalEditar).show();
  };

  // Delete a consolidated label (removes it from all operations)
  window.deleteConsolidatedLabel = function (label, field) {
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
    const subs = sections.get(principal);

    if (subs) {
      selectS.innerHTML =
        Array.from(subs.keys())
          .filter((s) => s)
          .map(
            (s) => `<option value="${escapeAttr(s)}">${escapeHtml(s)}</option>`
          )
          .join("") || '<option value="">Sin subsecciones</option>';
    }
  };

  function expandAll() {
    document
      .querySelectorAll(
        ".section-header.collapsed, .subsection-header.collapsed"
      )
      .forEach((h) => {
        h.classList.remove("collapsed");
        h.nextElementSibling.style.display = "";
      });
  }

  function collapseAll() {
    document
      .querySelectorAll(
        ".section-header:not(.collapsed), .subsection-header:not(.collapsed)"
      )
      .forEach((h) => {
        h.classList.add("collapsed");
        h.nextElementSibling.style.display = "none";
      });
  }

  function confirmEdit() {
    if (!state.selectedElement) return;

    if (state.selectedElement.type === "account") {
      const cuenta = state.selectedElement.cuenta;
      const newCodigo = document.getElementById("editCodigo")?.value?.trim();
      const newNombre = document.getElementById("editNombre")?.value?.trim();

      if (newCodigo) cuenta.CUENTA = newCodigo;
      if (newNombre) cuenta.NOMBRE = newNombre;
    } else if (state.selectedElement.type === "section") {
      const oldName = state.selectedElement.name;
      const newName = document
        .getElementById("editNombreSeccion")
        ?.value?.trim();

      if (newName && newName !== oldName) {
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
          }
        });

        // También actualizar en operaciones si la sección es referenciada
        state.operaciones.forEach((op) => {
          if (op.SECCION === oldName) op.SECCION = newName;
          for (let i = 1; i <= 20; i++) {
            if (op[`seccion_${i}`] === oldName) op[`seccion_${i}`] = newName;
          }
        });
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

      if (newClase) op.Clase = newClase;

      // Usar FormulaBuilder si está disponible
      if (window.FormulaBuilder) {
        const validation = window.FormulaBuilder.validate();
        if (!validation.isValid) {
          showToast(
            "Fórmula incompleta:\n" + validation.errors.join("\n"),
            "error"
          );
          return;
        }

        // Guardar fórmula en formato JSON
        op.formula_json = window.FormulaBuilder.getFormulaJSON();
        op.formula_terms = JSON.parse(op.formula_json);

        // Mantener compatibilidad con formato legacy
        op.signos = {};
        for (let i = 1; i <= 20; i++) {
          delete op[`seccion_${i}`];
        }

        op.formula_terms.forEach((term, i) => {
          const key = `seccion_${i + 1}`;
          op[key] = term.value;
          op.signos[key] = term.operator === "-" ? -1 : 1;
        });

        // Si es una sola sección, asegurar SECCION
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
      if (codigo && confirm(`¿Eliminar la cuenta ${codigo}?`)) {
        state.cuentas = state.cuentas.filter((c) => c.CUENTA !== codigo);
        finalizeDeletion();
      }
    } else if (type === "section") {
      const name = state.selectedElement.name;
      if (
        confirm(
          `¿Eliminar la sección "${name}" y TODAS sus cuentas? Esta acción no se puede deshacer.`
        )
      ) {
        state.cuentas = state.cuentas.filter((c) => {
          const principal =
            c["SECCIÓN Principal"] ||
            c["SECCIàN Principal"] ||
            c["SECCION Principal"] ||
            c.SECCION ||
            c.seccion_principal;
          return principal !== name;
        });
        finalizeDeletion();
      }
    } else if (type === "operation") {
      const clase = state.selectedElement.op?.Clase;
      if (clase && confirm(`¿Eliminar la operación "${clase}"?`)) {
        state.operaciones = state.operaciones.filter((o) => o.Clase !== clase);
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
    const subsections = sections.get(parentName);

    if (subsections && subsections.size > 0) {
      const seen = new Set();
      const terms = [];
      let counter = 0;

      subsections.forEach((_, secundaria) => {
        const label = secundaria || parentName;
        if (!label || seen.has(label)) return;
        seen.add(label);

        terms.push({
          id: Date.now() + counter++,
          operator: "+",
          type: "section",
          value: label,
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
            value: incomeOp.Clase,
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
            value: expenseOp.Clase,
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
        sections.forEach((subsecs, principal) => {
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
              subsecs.forEach((_, secundaria) => {
                if (secundaria) {
                  terms.push({
                    id: Date.now() + counter++,
                    operator: "+",
                    type: "section",
                    value: secundaria,
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
    return (terms || []).map((t) => ({
      operator: t.operator || "+",
      type: t.type || "section",
      value: t.value || "",
    }));
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
        const accounts = getAccountsForSection(term.value);

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
      type: "section",
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
  function getAccountsForSection(sectionName) {
    if (!sectionName || !state.cuentas || state.cuentas.length === 0) return [];

    const sectionLower = sectionName.toLowerCase().trim();

    let accounts = state.cuentas.filter((c) => {
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

    // Try partial match if no exact match
    if (accounts.length === 0) {
      accounts = state.cuentas.filter((c) => {
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
          secondary.includes(sectionLower) || primary.includes(sectionLower)
        );
      });
    }

    return accounts;
  }

  // Renderizar los términos
  function renderFormulaTerms() {
    const container = document.getElementById("formulaTerms");
    if (!container) return;

    const elements = getAvailableElements();

    // Helper for case-insensitive value matching
    function findMatchingValue(termValue, options) {
      if (!termValue) return null;
      const lower = termValue.toLowerCase().trim();
      let match = options.find((o) => o === termValue);
      if (match) return match;
      match = options.find((o) => o.toLowerCase().trim() === lower);
      if (match) return match;
      match = options.find(
        (o) =>
          o.toLowerCase().includes(lower) || lower.includes(o.toLowerCase())
      );
      return match || null;
    }

    // Pre-process terms to find matching values
    formulaTerms.forEach((term) => {
      let options = [];
      if (term.type === "section") options = elements.sections;
      else if (term.type === "operation") options = elements.operations;
      else options = elements.accounts.map((a) => a.code);

      const matchedValue = findMatchingValue(term.value, options);
      if (matchedValue) {
        term.value = matchedValue;
      }
    });

    // Generate formula rows with dropdowns for type and value selection
    container.innerHTML = formulaTerms
      .map((term, idx) => {
        // Build options for value dropdown based on type
        let valueOptions = "";
        if (term.type === "section") {
          valueOptions = elements.sections
            .map(
              (sec) =>
                `<option value="${escapeAttr(sec)}" ${
                  term.value === sec ? "selected" : ""
                }>${escapeHtml(sec)}</option>`
            )
            .join("");
        } else if (term.type === "account") {
          valueOptions = elements.accounts
            .map((acc) => {
              const display = `${acc.code} ${acc.name}`;
              return `<option value="${escapeAttr(acc.code)}" ${
                term.value === acc.code ? "selected" : ""
              }>${escapeHtml(display)}</option>`;
            })
            .join("");
        } else if (term.type === "operation") {
          valueOptions = elements.operations
            .map(
              (op) =>
                `<option value="${escapeAttr(op)}" ${
                  term.value === op ? "selected" : ""
                }>${escapeHtml(op)}</option>`
            )
            .join("");
        }

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
        
        <select class="form-select" style="width: 120px;" onchange="updateTermType(${
          term.id
        }, this.value)">
          <option value="section" ${
            term.type === "section" ? "selected" : ""
          }>Sección</option>
          <option value="account" ${
            term.type === "account" ? "selected" : ""
          }>Cuenta</option>
          <option value="operation" ${
            term.type === "operation" ? "selected" : ""
          }>Operación</option>
        </select>
        
        <select class="form-select flex-grow-1" onchange="updateTermValue(${
          term.id
        }, this.value)">
          <option value="">Seleccionar...</option>
          ${valueOptions}
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

    // Removed updateFormulaPreview() - not needed
  }

  // Actualizar operador de término
  window.updateTermOperator = function (termId, operator) {
    const term = formulaTerms.find((t) => t.id === termId);
    if (term) term.operator = operator;
    // Removed updateFormulaPreview() - not needed
  };

  // Actualizar tipo de término
  window.updateTermType = function (termId, newType) {
    const term = formulaTerms.find((t) => t.id === termId);
    if (term) {
      term.type = newType;
      term.value = "";
    }
    renderFormulaTerms();
  };

  // Actualizar valor de término
  window.updateTermValue = function (termId, value) {
    const term = formulaTerms.find((t) => t.id === termId);
    if (!term) return;

    // Si es una sección, expandirla automáticamente a cuentas individuales
    if (term.type === "section" && value) {
      const sectionAccounts = getAccountsForSection(value);

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
    const operations = new Set();

    // Secciones y Cuentas - SOLO desde cuentas cargadas
    groupBySections(state.cuentas).forEach((subs, principal) => {
      sections.add(principal);
      subs.forEach((cuentas, secundaria) => {
        if (secundaria && secundaria !== principal) {
          sections.add(secundaria);
        }
        cuentas.forEach((c) => {
          if (c.CUENTA) {
            accounts.push({ code: c.CUENTA, name: c.NOMBRE || c.CUENTA });
          }
        });
      });
    });

    // Operaciones - Clase de operaciones (excepto la que se está editando)
    const currentOpClase = state.selectedElement?.op?.Clase;
    sortOperations(state.operaciones).forEach((op) => {
      if (op.Clase && op.Clase !== currentOpClase) {
        operations.add(op.Clase);
      }
    });

    // Etiquetas generadas por filas especiales (sum-row, net-row, etc.)
    const rowLabelFields = [
      "sum-row",
      "sum-row-sumavarios",
      "sum-row-sumavarios-consolidado",
      "sum-row-operativo",
      "result-row",
      "net-row",
      "result-net-row",
    ];

    state.operaciones.forEach((op) => {
      // Poblar operaciones con etiquetas de filas generadas
      rowLabelFields.forEach((field) => {
        const label = op[field];
        if (label && label.trim()) {
          operations.add(label.trim());
        }
      });
    });

    return {
      sections: [...sections],
      accounts,
      operations: [...operations],
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
      cuentas: state.cuentas || [],
      operaciones: state.operaciones || [],
    };

    const previewHtml = window.LayoutControls.renderRealisticPreview(
      layoutData,
      {
        showHiddenRows: false,
        showSampleData: true,
        monthsToShow: 3,
      }
    );

    dom.previewContainer.innerHTML = previewHtml;

    // Agregar listeners para los controles interactivos
    const toggleHidden = document.getElementById("toggleHidden");
    const toggleData = document.getElementById("toggleData");

    if (toggleHidden) {
      toggleHidden.addEventListener("change", (e) => {
        const html = window.LayoutControls.renderRealisticPreview(layoutData, {
          showHiddenRows: e.target.checked,
          showSampleData: toggleData?.checked || true,
          monthsToShow: 3,
        });
        dom.previewContainer.innerHTML = html;
        // Re-bind listeners
        renderPreviewTable();
      });
    }

    if (toggleData) {
      toggleData.addEventListener("change", (e) => {
        const html = window.LayoutControls.renderRealisticPreview(layoutData, {
          showHiddenRows: toggleHidden?.checked || false,
          showSampleData: e.target.checked,
          monthsToShow: 3,
        });
        dom.previewContainer.innerHTML = html;
        // Re-bind listeners
        renderPreviewTable();
      });
    }
  }
})();
