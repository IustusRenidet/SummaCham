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

    // Buttons
    dom.btnCargar = document.getElementById("btnCargar");
    dom.btnGuardar = document.getElementById("btnGuardar");
    dom.btnAgregar = document.getElementById("btnAgregar");
    dom.btnCopiar = document.getElementById("btnCopiar");
    dom.btnExpandir = document.getElementById("btnExpandir");
    dom.btnColapsar = document.getElementById("btnColapsar");
    dom.btnPreview = document.getElementById("btnPreview");
    dom.btnBitacora = document.getElementById("btnBitacora");
    dom.btnGestionPermisos = document.getElementById("btnGestionPermisos");

    // Views
    dom.placeholderView = document.getElementById("placeholderView");
    dom.layoutView = document.getElementById("layoutView");
    dom.layoutPreview = document.getElementById("layoutPreview");
    dom.adminPermissionsSection = document.getElementById(
      "adminPermissionsSection"
    );

    // Stats
    dom.statPrincipales = document.getElementById("statPrincipales");
    dom.statSecundarias = document.getElementById("statSecundarias");
    dom.statCuentas = document.getElementById("statCuentas");
    dom.statOperaciones = document.getElementById("statOperaciones");

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
    dom.modalPermisos = document.getElementById("modalPermisos");
    dom.drawerBitacora = document.getElementById("drawerBitacora");

    dom.formElemento = document.getElementById("formElemento");
    dom.formEditar = document.getElementById("formEditar");
    dom.copiaOrigen = document.getElementById("copiaOrigen");
    dom.anioDestino = document.getElementById("anioDestino");
    dom.previewContainer = document.getElementById("previewContainer");
    dom.permisosUsuariosBody = document.getElementById("permisosUsuariosBody");
    dom.bitacoraList = document.getElementById("bitacoraList");

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
    dom.btnBitacora?.addEventListener("click", showBitacora);
    dom.btnGestionPermisos?.addEventListener("click", openPermisosModal);

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
      updateAuthUI(true, "Administrador Global - Modo edición activo");
      dom.adminPermissionsSection?.classList.remove("d-none");
      dom.btnPreview?.classList.remove("d-none");
      dom.btnBitacora?.classList.remove("d-none");
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
            : "Consulta - Sin permiso para editar este capítulo"
        );
      } else {
        state.editMode = false;
        updateAuthUI(false, "Selecciona un capítulo");
      }
      dom.adminPermissionsSection?.classList.add("d-none");

      // Los editores también pueden ver vista previa y bitácora
      const canSeeTools = state.editMode;
      dom.btnPreview?.classList.toggle("d-none", !canSeeTools);
      dom.btnBitacora?.classList.toggle("d-none", !canSeeTools);
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
      const chapter =
        window.CapitulosModulos?.empresaACapitulo?.(selector.value) ||
        selector.value;
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
            dom.capituloSelect.innerHTML = chapters
              .map((c) => `<option value="${c}">${c}</option>`)
              .join("");
            state.capitulo = chapters[0];
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
      showLayoutView();
      setStatus(`Layout ${state.modulo} ${state.anio} listo para editar`);
    } catch (error) {
      console.error("Error loading layout:", error);
      setStatus("Error al cargar layout");
      showToast(error.message, "error");
    }
  }

  // Vista para crear nuevo layout
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

  function sortOperations(list = []) {
    return [...(list || [])]
      .map((op, idx) => ({ op, idx }))
      .sort(
        (a, b) => getOperationOrder(a.op, a.idx) - getOperationOrder(b.op, b.idx)
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

  function hydrateOperationsFromParents() {
    state.operaciones = state.operaciones.map((op, idx) => {
      if (op?.formula_terms?.length) return op;

      const derived = normalizeFormulaTerms(
        buildFormulaTermsFromParent(op?.SECCION || op?.Clase)
      );

      if (!derived.length) return op;

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

    // Renderizar secciones primero, luego operaciones en su orden original
    const sections = groupBySections(state.cuentas);
    let html = "";

    // Renderizar todas las secciones
    sections.forEach((data, principal) => {
      html += renderSection(principal, data);
    });

    // Renderizar operaciones en su orden original (según índice en el array)
    // Ordenar por el campo 'orden' si existe, o por índice
    const operacionesOrdenadas = sortOperations(state.operaciones);

    operacionesOrdenadas.forEach((op) => {
      html += renderSingleOperation(op);
    });

    dom.layoutPreview.innerHTML = html;
    bindLayoutEvents();
  }

  // Renderiza una operación individual
  function renderSingleOperation(op) {
    const clase = op.Clase || "Operación";
    const tipo = detectOperationType(op);

    return `
      <div class="layout-section operation-section ${tipo}">
        <div class="operation-row ${tipo}" onclick="editOperation('${escapeAttr(
      clase
    )}')">
          <div class="operation-label">
            <i class="bi bi-calculator"></i>
            <span>${escapeHtml(clase)}</span>
            <span class="operation-type">${tipo}</span>
          </div>
          <div class="operation-formula small text-muted ms-3 d-none d-md-block" style="flex: 2; font-style: italic;">
            ${escapeHtml(formatFormula(op))}
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

  function formatFormula(op) {
    if (op.formula_terms && op.formula_terms.length) {
      return op.formula_terms
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
    } else if (op.signos && Object.keys(op.signos).length) {
      // Reconstruir descripción legible desde campos dinámicos
      const terms = [];
      Object.entries(op.signos).forEach(([key, signo]) => {
        const valor = op[key];
        if (valor) {
          const prefix =
            terms.length === 0
              ? signo < 0
                ? "-"
                : ""
              : signo < 0
              ? " - "
              : " + ";
          terms.push(prefix + valor);
        }
      });
      return terms.join("") || "Suma de secciones";
    } else if (op.SECCION) {
      return op.SECCION;
    }
    return "Consolidado";
  }

  function groupBySections(cuentas) {
    const sections = new Map();

    const cuentasOrdenadas = [...(cuentas || [])].sort(
      (a, b) => getAccountOrder(a) - getAccountOrder(b)
    );

    cuentasOrdenadas.forEach((cuenta) => {
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

      if (!sections.has(principal)) {
        sections.set(principal, new Map());
      }

      const subsections = sections.get(principal);
      if (!subsections.has(secundaria)) {
        subsections.set(secundaria, []);
      }

      subsections.get(secundaria).push(cuenta);
    });

    return sections;
  }

  function renderSection(principal, subsections) {
    const subsectionCount = subsections.size;
    let accountCount = 0;
    subsections.forEach((accounts) => (accountCount += accounts.length));

    let subsectionsHtml = "";
    subsections.forEach((accounts, secundaria) => {
      subsectionsHtml += renderSubsection(
        secundaria || principal,
        accounts,
        principal
      );
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

  function renderSubsection(name, accounts, principal) {
    const accountsHtml = accounts
      .sort((a, b) => getAccountOrder(a) - getAccountOrder(b))
      .map((acc) => renderAccount(acc, principal, name))
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
        </div>
      </div>
    `;
  }

  function renderAccount(account, principal, secundaria) {
    const codigo = account.CUENTA || "";
    const nombre = account.NOMBRE || account.nombre || "";

    return `
      <div class="account-row" data-cuenta="${escapeHtml(
        codigo
      )}" onclick="selectAccount(this, '${escapeAttr(codigo)}')">
        <span class="account-code">${escapeHtml(codigo)}</span>
        <span class="account-name">${escapeHtml(nombre)}</span>
        <div class="account-actions">
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

        return `
        <div class="operation-row ${tipo}" onclick="editOperation('${escapeAttr(
          clase
        )}')">
          <div class="operation-label">
            <i class="bi bi-calculator"></i>
            <span>${escapeHtml(clase)}</span>
            <span class="operation-type">${tipo}</span>
          </div>
          <div class="account-actions">
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
    await loadYears();
    await loadChapters();
    await tryLoadLayout();
  }

  async function handleAnioChange() {
    state.anio = dom.anioSelect.value;
    await loadChapters();
    await tryLoadLayout();
  }

  async function handleCapituloChange() {
    state.capitulo = dom.capituloSelect.value;
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
    const sections = groupBySections(state.cuentas);
    let subsectionCount = 0;
    sections.forEach((subs) => (subsectionCount += subs.size));

    dom.statPrincipales.textContent = sections.size;
    dom.statSecundarias.textContent = subsectionCount;
    dom.statCuentas.textContent = state.cuentas.length;
    dom.statOperaciones.textContent = state.operaciones.length;

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

    const newOp = {
      Clase: clase,
      SECCION: checkedSections[0] || "",
      tipo,
      signos: {},
      orden: nextOperationOrder(),
    };

    // Poblamos la fórmula a partir de su "papá" (sección) respetando orden
    const derivedTerms = buildFormulaTermsFromParent(newOp.SECCION);
    const fallbackTerms = (checkedSections.length ? checkedSections : [newOp.SECCION])
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
    showToast(`Operación "${clase}" creada`, "success");
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

  window.editOperation = function (clase) {
    const op = state.operaciones.find((o) => o.Clase === clase);
    if (!op) return;

    // Poblar formulaTerms desde el objeto op
    formulaTerms = [];
    if (op.tipo === "custom-formula" || op.formula_terms) {
      // Si ya tiene términos definidos explícitamente
      formulaTerms = (op.formula_terms || []).map((term, i) => ({
        id: Date.now() + i,
        ...term,
      }));
    } else if (op.signos) {
      // Reconstruir desde el formato antiguo de signos
      let i = 0;
      Object.entries(op.signos).forEach(([clave, signo]) => {
        const valorReal = op[clave];
        if (valorReal) {
          formulaTerms.push({
            id: Date.now() + i++,
            operator: signo < 0 ? "-" : "+",
            type: "section", // Asumimos sección por defecto para el formato antiguo
            value: valorReal,
          });
        }
      });
    }

    if (formulaTerms.length === 0) {
      const derivedFromParent = buildFormulaTermsFromParent(op.SECCION || op.Clase);
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

    dom.formEditar.innerHTML = `
      <div class="mb-3">
        <label class="form-label">Etiqueta de la Operación</label>
        <input type="text" class="form-control" id="editClaseOp" value="${escapeHtml(
          op.Clase
        )}" />
      </div>
      <div class="mb-3">
        <label class="form-label">Tipo de Operación</label>
        <select class="form-select" id="editTipoOp" onchange="toggleEditFormulaBuilder()">
          <option value="sum-sections" ${
            op.tipo === "sum-sections" || !op.tipo ? "selected" : ""
          }>Suma de secciones</option>
          <option value="custom-formula" ${
            op.tipo === "custom-formula" ? "selected" : ""
          }>Fórmula personalizada</option>
        </select>
      </div>
      
      <div id="editFormulaBuilder" class="mt-3">
        <label class="form-label">Mapa de Operación (Fórmula)</label>
        <div id="formulaTerms" class="formula-terms mb-2">
          <!-- Se poblará dinámicamente -->
        </div>
        <div class="d-flex gap-2">
          <button type="button" class="btn btn-outline-success btn-sm" onclick="addFormulaTerm()">
            <i class="bi bi-plus-circle me-1"></i>Agregar término
          </button>
          <button type="button" class="btn btn-outline-info btn-sm" onclick="suggestTermsForOperation()">
            <i class="bi bi-magic me-1"></i>Sugerir sub-secciones
          </button>
        </div>
      </div>

      <div class="formula-preview mt-3">
        <label class="form-label">Vista previa:</label>
        <div id="formulaPreviewText" class="formula-preview-text bg-light p-2 rounded border">
          ${op.Clase} = ...
        </div>
      </div>
    `;

    state.selectedElement = { type: "operation", op };
    renderFormulaTerms();
    new bootstrap.Modal(dom.modalEditar).show();
  };

  // Helper para el toggle en edición
  window.toggleEditFormulaBuilder = function () {
    // Realmente siempre mostramos el builder en edición para que vean el mapa
    updateFormulaPreview();
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
      const newTipo = document.getElementById("editTipoOp")?.value;

      if (newClase) op.Clase = newClase;
      op.tipo = newTipo;

      // Actualizar la estructura de la operación basado en los términos de la fórmula
      op.formula_terms = normalizeFormulaTerms(formulaTerms);

      // Mantener compatibilidad con el formato antiguo de signos
      op.signos = {};
      // Limpiar campos de sección antiguos
      for (let i = 1; i <= 20; i++) {
        delete op[`seccion_${i}`];
      }

      op.formula_terms.forEach((term, i) => {
        const key = `seccion_${i + 1}`;
        op[key] = term.value;
        op.signos[key] = term.operator === "-" ? -1 : 1;
      });

      // Si es una sola sección y modo simple, asegurar SECCION
      if (
        op.formula_terms.length === 1 &&
        op.formula_terms[0].type === "section"
      ) {
        op.SECCION = op.formula_terms[0].value;
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

    const sections = groupBySections(state.cuentas);
    const subsections = sections.get(parentName);
    if (!subsections) return [];

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

    return terms;
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
    updateFormulaPreview();
  };

  // Renderizar los términos
  function renderFormulaTerms() {
    const container = document.getElementById("formulaTerms");
    if (!container) return;

    const elements = getAvailableElements();

    container.innerHTML = formulaTerms
      .map(
        (term, idx) => `
      <div class="formula-term" data-id="${term.id}">
        ${
          idx > 0
            ? `
          <select class="form-select formula-operator" onchange="updateTermOperator(${
            term.id
          }, this.value)">
            <option value="+" ${
              term.operator === "+" ? "selected" : ""
            }>+</option>
            <option value="-" ${
              term.operator === "-" ? "selected" : ""
            }>−</option>
            <option value="/" ${
              term.operator === "/" ? "selected" : ""
            }>/</option>
          </select>
        `
            : '<span class="formula-operator-placeholder">=</span>'
        }
        
        <select class="form-select formula-type" style="width: 120px;" onchange="updateTermType(${
          term.id
        }, this.value)">
          <option value="section" ${
            term.type === "section" ? "selected" : ""
          }>Sección</option>
          <option value="operation" ${
            term.type === "operation" ? "selected" : ""
          }>Operación</option>
          <option value="account" ${
            term.type === "account" ? "selected" : ""
          }>Cuenta</option>
        </select>
        
        <select class="form-select formula-value" onchange="updateTermValue(${
          term.id
        }, this.value)">
          <option value="">-- Seleccionar --</option>
          ${
            term.type === "section"
              ? elements.sections
                  .map(
                    (s) =>
                      `<option value="${escapeAttr(s)}" ${
                        term.value === s ? "selected" : ""
                      }>${escapeHtml(s)}</option>`
                  )
                  .join("")
              : term.type === "operation"
              ? elements.operations
                  .map(
                    (o) =>
                      `<option value="${escapeAttr(o)}" ${
                        term.value === o ? "selected" : ""
                      }>${escapeHtml(o)}</option>`
                  )
                  .join("")
              : elements.accounts
                  .map(
                    (a) =>
                      `<option value="${escapeAttr(a.code)}" ${
                        term.value === a.code ? "selected" : ""
                      }>${escapeHtml(a.code)} - ${escapeHtml(a.name)}</option>`
                  )
                  .join("")
          }
        </select>
        
        <button type="button" class="btn btn-outline-danger btn-sm" onclick="removeFormulaTerm(${
          term.id
        })" title="Quitar">
          <i class="bi bi-x"></i>
        </button>
      </div>
    `
      )
      .join("");

    updateFormulaPreview();
  }

  // Actualizar operador de término
  window.updateTermOperator = function (termId, operator) {
    const term = formulaTerms.find((t) => t.id === termId);
    if (term) term.operator = operator;
    updateFormulaPreview();
  };

  // Actualizar tipo de término
  window.updateTermType = function (termId, type) {
    const term = formulaTerms.find((t) => t.id === termId);
    if (term) {
      term.type = type;
      term.value = "";
    }
    renderFormulaTerms();
  };

  // Actualizar valor de término
  window.updateTermValue = function (termId, value) {
    const term = formulaTerms.find((t) => t.id === termId);
    if (term) term.value = value;
    updateFormulaPreview();
  };

  // Obtener elementos disponibles
  function getAvailableElements() {
    const sections = [];
    const accounts = [];
    const operations = [];

    // Secciones y Cuentas
    groupBySections(state.cuentas).forEach((subs, principal) => {
      sections.push(principal);
      subs.forEach((cuentas, secundaria) => {
        if (secundaria && secundaria !== principal) {
          sections.push(secundaria);
        }
        cuentas.forEach((c) => {
          if (c.CUENTA) {
            accounts.push({ code: c.CUENTA, name: c.NOMBRE || c.CUENTA });
          }
        });
      });
    });

    // Otras Operaciones (excepto la que se está editando)
    const currentOpClase = state.selectedElement?.op?.Clase;
    sortOperations(state.operaciones).forEach((op) => {
      if (op.Clase && op.Clase !== currentOpClase) {
        operations.push(op.Clase);
      }
    });

    return {
      sections: [...new Set(sections)],
      accounts,
      operations: [...new Set(operations)],
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

  // Actualizar preview de la fórmula
  function updateFormulaPreview() {
    const preview = document.getElementById("formulaPreviewText");
    if (!preview) return;

    if (formulaTerms.length === 0) {
      preview.textContent = "(Sin términos)";
      return;
    }

    const formulaStr = formulaTerms
      .map((term, idx) => {
        const prefix = idx === 0 ? "" : ` ${term.operator} `;
        const label = term.value || "???";
        return prefix + label;
      })
      .join("");

    preview.textContent = formulaStr || "(Sin términos)";
  }

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
  async function showBitacora() {
    if (!state.modulo || !state.anio || !state.capitulo) return;

    const bitacoraDrawer = new bootstrap.Offcanvas(dom.drawerBitacora);
    bitacoraDrawer.show();

    try {
      const url = `${API_BASE}/${encodeURIComponent(state.modulo)}/${
        state.anio
      }/${encodeURIComponent(state.capitulo)}/bitacora?empresaId=EMPRESA01`;
      const response = await fetch(url, { headers: getAuthHeaders() });
      if (!response.ok) throw new Error("Error al cargar bitácora");

      const data = await response.json();
      renderBitacora(data.bitacora || []);
    } catch (error) {
      console.error("Bitacora error:", error);
      dom.bitacoraList.innerHTML = `<div class="p-4 text-center text-danger">Error: ${error.message}</div>`;
    }
  }

  function renderBitacora(items) {
    if (!items.length) {
      dom.bitacoraList.innerHTML =
        '<div class="p-4 text-center text-muted">No hay registros aún</div>';
      return;
    }

    dom.bitacoraList.innerHTML = items
      .map((item) => {
        const fecha = new Date(item.fecha).toLocaleString();
        const icono =
          item.accion === "GUARDAR"
            ? "save"
            : item.accion === "CREAR"
            ? "plus-circle"
            : "pencil";
        const color =
          item.accion === "GUARDAR"
            ? "primary"
            : item.accion === "CREAR"
            ? "success"
            : "info";

        return `
        <div class="list-group-item p-3 border-0 border-bottom">
          <div class="d-flex w-100 justify-content-between mb-1">
            <h6 class="mb-1 text-${color}"><i class="bi bi-${icono} me-2"></i>${
          item.accion
        }</h6>
            <small class="text-muted">${fecha}</small>
          </div>
          <p class="mb-1 small">${escapeHtml(item.detalles || "")}</p>
          <small class="text-muted"><i class="bi bi-person me-1"></i>${
            item.nombre_usuario || "Sistema"
          }</small>
        </div>
      `;
      })
      .join("");
  }

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
    const sections = groupBySections(state.cuentas);
    let html = `
      <div class="preview-table-container shadow-sm bg-white rounded overflow-hidden">
        <table class="table table-sm table-bordered mb-0">
          <thead class="table-dark">
            <tr>
              <th style="width: 120px">Cuenta</th>
              <th>Descripción</th>
              <th class="text-end" style="width: 150px">Enero</th>
              <th class="text-end" style="width: 100px">...</th>
              <th class="text-end" style="width: 150px">Diciembre</th>
            </tr>
          </thead>
          <tbody>
    `;

    sections.forEach((subsections, principal) => {
      html += `<tr class="table-primary"><td colspan="5"><strong>${escapeHtml(
        principal
      )}</strong></td></tr>`;

      subsections.forEach((accounts, secundaria) => {
        if (secundaria && secundaria !== principal) {
          html += `<tr class="table-light"><td colspan="5" class="ps-4"><em>${escapeHtml(
            secundaria
          )}</em></td></tr>`;
        }

        accounts.forEach((acc) => {
          html += `
            <tr>
              <td class="ps-4 small text-muted">${escapeHtml(
                acc.CUENTA || ""
              )}</td>
              <td class="ps-${secundaria ? "5" : "4"}">${escapeHtml(
            acc.NOMBRE || ""
          )}</td>
              <td class="text-end text-muted small">0.00</td>
              <td class="text-end text-muted small">...</td>
              <td class="text-end text-muted small">0.00</td>
            </tr>
          `;
        });
      });
    });

    // Operaciones
    state.operaciones.forEach((op) => {
      const tipo = detectOperationType(op);
      const claseColor =
        tipo === "net"
          ? "table-info"
          : tipo === "result"
          ? "table-success"
          : "table-warning";
      html += `
        <tr class="${claseColor} font-weight-bold">
          <td colspan="2"><strong>${escapeHtml(op.Clase || "")}</strong></td>
          <td class="text-end">0.00</td>
          <td class="text-end">...</td>
          <td class="text-end">0.00</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;

    dom.previewContainer.innerHTML = html;
  }

  // ==========================================
  // GESTIÓN DE PERMISOS
  // ==========================================
  async function openPermisosModal() {
    const modal = new bootstrap.Modal(dom.modalPermisos);
    modal.show();
    await cargarUsuariosPermisos();
  }

  async function cargarUsuariosPermisos() {
    const tbody = dom.permisosUsuariosBody;
    tbody.innerHTML =
      '<tr><td colspan="3" class="text-center p-4">Cargando...</td></tr>';

    try {
      const res = await fetch(`${API_BASE}/permisos/capitulos`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Error al cargar usuarios");

      const { usuarios, permisos } = await res.json();

      // Obtener lista de capítulos disponibles
      const capitulos = await fetchCapitulosUnicos();

      let html = "";
      usuarios.forEach((user) => {
        capitulos.forEach((cap) => {
          const p = permisos.find(
            (p) => p.usuario_id === user.id && p.capitulo === cap
          );
          const tienePermiso = p ? p.puede_editar === 1 : false;

          html += `
            <tr>
              <td><strong>${escapeHtml(
                user.usuario
              )}</strong><br><small class="text-muted">${escapeHtml(
            user.nombres || ""
          )}</small></td>
              <td><span class="badge bg-light text-dark border">${escapeHtml(
                cap
              )}</span></td>
              <td class="text-center">
                <div class="form-check form-switch d-inline-block">
                  <input class="form-check-input" type="checkbox" ${
                    tienePermiso ? "checked" : ""
                  } 
                    onchange="cambiarPermisoCapitulo(${user.id}, '${escapeAttr(
            cap
          )}', this.checked)">
                </div>
              </td>
            </tr>
          `;
        });
      });

      tbody.innerHTML =
        html ||
        '<tr><td colspan="3" class="text-center p-4">No hay usuarios para gestionar</td></tr>';
    } catch (err) {
      tbody.innerHTML = `<tr class="table-danger"><td colspan="3">${err.message}</td></tr>`;
    }
  }

  async function fetchCapitulosUnicos() {
    // Definimos los capítulos estándar de la empresa 1 (que son los que tienen plantillas)
    return [
      "Finanzas",
      "GastosGenerales",
      "Nomina",
      "Membresía",
      "SUMA",
      "Otros",
    ];
  }

  window.cambiarPermisoCapitulo = async function (
    usuarioId,
    capitulo,
    puedeEditar
  ) {
    try {
      const res = await fetch(`${API_BASE}/permisos/capitulos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ usuarioId, capitulo, puedeEditar }),
      });

      if (!res.ok) throw new Error("Error al actualizar permiso");
      showToast(`Permiso actualizado para ${capitulo}`, "success");

      // Limpiar caché local de permisos
      permisosCache.clear();
      checkAuthState();
    } catch (err) {
      showToast(err.message, "error");
    }
  };
})();
