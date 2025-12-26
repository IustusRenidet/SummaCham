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
    dom.btnDemo = document.getElementById("btnDemo");
    dom.btnExpandir = document.getElementById("btnExpandir");
    dom.btnColapsar = document.getElementById("btnColapsar");

    // Views
    dom.placeholderView = document.getElementById("placeholderView");
    dom.layoutView = document.getElementById("layoutView");
    dom.layoutPreview = document.getElementById("layoutPreview");

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
    dom.formElemento = document.getElementById("formElemento");
    dom.formEditar = document.getElementById("formEditar");
    dom.copiaOrigen = document.getElementById("copiaOrigen");
    dom.anioDestino = document.getElementById("anioDestino");

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
    dom.btnDemo.addEventListener("click", createDemo);
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

  function checkAuthState() {
    // El gestor de plantillas siempre tiene modo edición activo
    // ya que es una herramienta administrativa
    state.editMode = true;
    updateAuthUI(true, "Modo edición activo");
    updateButtonStates();
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
    dom.btnDemo.disabled = !state.editMode;
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
      state.operaciones = state.layout.operaciones || [];

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

    // Renderizar en orden: cada sección seguida de sus operaciones relacionadas
    const sections = groupBySections(state.cuentas);
    const usedOperations = new Set();
    let html = "";

    // Para cada sección, renderizarla y luego las operaciones que la suman
    sections.forEach((data, principal) => {
      html += renderSection(principal, data);

      // Buscar operaciones que suman esta sección y renderizarlas después
      state.operaciones.forEach((op, idx) => {
        if (usedOperations.has(idx)) return;

        // Verificar si esta operación suma esta sección
        const sumaSecciones =
          op.SumaSeccionPrincipal || op.suma_secciones || [];
        const sumSeccionesArr = Array.isArray(sumaSecciones)
          ? sumaSecciones
          : [sumaSecciones];

        // Si la operación referencia esta sección, mostrarla después
        if (
          sumSeccionesArr.includes(principal) ||
          (op.Clase &&
            op.Clase.toLowerCase().includes(
              principal.toLowerCase().split(" ")[0]
            ))
        ) {
          html += renderSingleOperation(op);
          usedOperations.add(idx);
        }
      });
    });

    // Renderizar operaciones que no fueron asignadas a ninguna sección
    state.operaciones.forEach((op, idx) => {
      if (!usedOperations.has(idx)) {
        html += renderSingleOperation(op);
      }
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
          <div class="account-actions">
            <button class="btn btn-sm btn-outline-primary" onclick="event.stopPropagation(); editOperation('${escapeAttr(
              clase
            )}')" title="Editar">
              <i class="bi bi-pencil"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function groupBySections(cuentas) {
    const sections = new Map();

    cuentas.forEach((cuenta) => {
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
      .sort((a, b) => (a.orden || 0) - (b.orden || 0))
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
    const query = e.target.value.toLowerCase();
    const rows = document.querySelectorAll(".account-row");

    rows.forEach((row) => {
      const code =
        row.querySelector(".account-code")?.textContent?.toLowerCase() || "";
      const name =
        row.querySelector(".account-name")?.textContent?.toLowerCase() || "";
      const match = code.includes(query) || name.includes(query);
      row.style.display = match ? "" : "none";
    });
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
              <label class="form-label">Código de Cuenta</label>
              <input type="text" class="form-control" id="inputCuenta" placeholder="4100" />
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
    };

    checkedSections.forEach((sec, i) => {
      newOp[`seccion_${i + 1}`] = sec;
      newOp.signos[`seccion_${i + 1}`] = 1;
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
              operaciones: state.operaciones,
            }),
          }
        );

        if (!opResponse.ok) throw new Error("Error al guardar operaciones");
      }

      state.unsavedChanges = false;
      updateButtonStates();
      setStatus("Guardado correctamente");
      showToast("Layout guardado", "success");
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
    showToast("Función de edición de sección en desarrollo", "info");
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
    showToast("Función de edición de operación en desarrollo", "info");
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

      state.unsavedChanges = true;
      updateButtonStates();
      renderLayout();
      updateStats();
    }

    bootstrap.Modal.getInstance(dom.modalEditar)?.hide();
    showToast("Cambios aplicados", "success");
  }

  function deleteElement() {
    if (!state.selectedElement) return;

    if (state.selectedElement.type === "account") {
      const codigo = state.selectedElement.cuenta?.CUENTA;
      if (codigo && confirm(`¿Eliminar la cuenta ${codigo}?`)) {
        state.cuentas = state.cuentas.filter((c) => c.CUENTA !== codigo);
        state.unsavedChanges = true;
        updateButtonStates();
        renderLayout();
        updateStats();
        bootstrap.Modal.getInstance(dom.modalEditar)?.hide();
        showToast("Elemento eliminado", "success");
      }
    }
  }

  // ==========================================
  // FORMULA BUILDER FUNCTIONS
  // ==========================================
  let formulaTerms = [];

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
        
        <select class="form-select formula-type" onchange="updateTermType(${
          term.id
        }, this.value)">
          <option value="section" ${
            term.type === "section" ? "selected" : ""
          }>Sección</option>
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

    return { sections: [...new Set(sections)], accounts };
  }

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
})();
