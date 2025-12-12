(() => {
  const origin =
    window.location.protocol === "file:"
      ? "http://localhost:3005"
      : window.location.origin;
  const API_BASE = `${origin}/api`;
  const EVENTO_CONTEXTO = "planeacion:contexto-actualizado";
  const EVENTO_EDICION = "modulo-planeacion:presupuesto-editado";
  const STYLE_ID = "flujo-autorizacion-style";
  const FORMATTER_NUMEROS = new Intl.NumberFormat("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  /**
   * Estados del flujo de autorización de presupuestos
   * 
   * Flujo normal:
   * SIN_CARGAR → EDITANDO → PENDIENTE → REVISADO → APROBADO → GUARDADO
   * 
   * Flujo con rechazo:
   * PENDIENTE/REVISADO/APROBADO → RECHAZADO → EDITANDO (corrección)
   * 
   * - EDITANDO: Usuario está creando/modificando el presupuesto
   * - PENDIENTE: Enviado a revisión, esperando que un revisor lo marque como revisado
   * - REVISADO: Marcado como revisado por un revisor, esperando autorización
   * - RECHAZADO: Rechazado por revisor/autorizador, regresa al autor para correcciones
   * - APROBADO: Autorizado por el aprobador, listo para guardar en COI
   * - GUARDADO: Guardado en la base de datos COI, finalizado (inmutable)
   * - SIN_CARGAR: Estado inicial cuando no existe borrador
   */
  const ESTADOS = {
    EDITANDO: "EDITANDO",
    PENDIENTE: "PENDIENTE",
    REVISADO: "REVISADO",
    RECHAZADO: "RECHAZADO",
    APROBADO: "APROBADO",
    GUARDADO: "GUARDADO",
    SIN_CARGAR: "SIN_CARGAR",
  };

  const ETIQUETAS_ESTADO = {
    EDITANDO: "En edición",
    PENDIENTE: "Pendiente de revisión",
    REVISADO: "Revisado",
    RECHAZADO: "Rechazado",
    APROBADO: "Aprobado",
    GUARDADO: "Guardado en COI",
    SIN_CARGAR: "Sin cargar",
  };

  const YEAR_SELECTOR_IDS = [
    "selectAnio",
    "summaryYearSelect",
    "resumenYearSelect",
    "presupuestosYearSelect",
    "finanzasYearSelect",
    "comitesYearSelect",
    "comunicacionYearSelect",
    "direccionYearSelect",
    "eventosYearSelect",
    "gtoscorporativosYearSelect",
    "membresiaYearSelect",
    "rhYearSelect",
    "servmembresiaYearSelect",
    "ticYearSelect",
    "vpeYearSelect",
  ];

  const HISTORIAL_ACCIONES = {
    "guardar-borrador": "Guardó el borrador",
    "enviar-revision": "Envió a revisión",
    rechazar: "Rechazó el borrador",
    "marcar-revision": "Marcó como revisado",
    "cancelar-revision": "Regresó a edición",
    autorizar: "Autorizó el borrador",
    "autorizar-automatica": "Autorización automática",
    "guardar-coi": "Guardó en COI",
  };

  const colocarEstilo = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .celda-borrador {
        position: relative;
        background-color: #fff3cd !important;
        color: #5f3703 !important;
      }
      .celda-borrador::after {
        content: '\\00b7';
        position: absolute;
        right: 0.25rem;
        top: 0.15rem;
        font-size: 0.75rem;
        color: #5f3c1c;
      }
      .modo-edicion td.editable {
        cursor: pointer;
        background-color: #f0f8ff !important;
      }
      .modo-edicion td.editable:hover {
        background-color: #e6f2ff !important;
      }
      .workflow-info-panel {
        background: rgba(47, 84, 150, 0.05);
        border-radius: 12px;
        padding: 1rem;
        margin-bottom: 1rem;
      }
      .workflow-drawer .workflow-guide-anchor { min-height: 12px; }
      .toast-global {
        position: fixed !important;
        inset: 1.25rem 1.25rem auto auto;
        z-index: 2000;
        width: min(360px, 90vw);
        pointer-events: none !important;
      }
      .toast-global > * {
        pointer-events: auto !important;
      }
    `;
    document.head.appendChild(style);
  };

  const formatDateTime = (valor) => {
    if (!valor) return "-";
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return valor;
    return fecha.toLocaleString("es-MX");
  };

  const normalizarCuentaClave = (valor = "") =>
    valor ? valor.toString().replace(/[^0-9]/g, "") : "";

  // ============================================================================
  // INICIALIZACIÓN GLOBAL DE BOTONES BOOTSTRAP
  // Agrega listeners explícitos a TODOS los botones con data-bs-dismiss
  // porque Bootstrap no procesa correctamente estos atributos en elementos dinámicos
  // ============================================================================
  const inicializarBotonesBootstrap = () => {
    // Función para agregar listener a un botón individual (DISMISS)
    const procesarBoton = (btn) => {
      if (btn.dataset.listenerAgregado) return; // Evitar duplicados
      btn.dataset.listenerAgregado = "true";

      const dismiss = btn.getAttribute("data-bs-dismiss");
      if (!dismiss) return;

      btn.addEventListener("click", (ev) => {
        // En dismiss, generalmente queremos prevenir default (ej. forms)
        // pero bootstrap suele encargarse. Aquí reforzamos.
        ev.preventDefault();

        if (dismiss === "modal") {
          const modalEl = btn.closest(".modal");
          if (modalEl && window.bootstrap?.Modal) {
            const instance = window.bootstrap.Modal.getInstance(modalEl);
            if (instance) {
              instance.hide();
            } else {
              try {
                const newInstance = new window.bootstrap.Modal(modalEl);
                newInstance.hide();
              } catch (e) {
                console.warn("Error cerrando modal:", e);
              }
            }
          }
        } else if (dismiss === "offcanvas") {
          const offcanvasEl = btn.closest(".offcanvas");
          if (offcanvasEl && window.bootstrap?.Offcanvas) {
            const instance =
              window.bootstrap.Offcanvas.getInstance(offcanvasEl);
            if (instance) {
              instance.hide();
            } else {
              try {
                const newInstance = new window.bootstrap.Offcanvas(offcanvasEl);
                newInstance.hide();
              } catch (e) {
                console.warn("Error cerrando offcanvas:", e);
              }
            }
          }
        } else if (dismiss === "toast") {
          const toastEl = btn.closest(".toast");
          if (toastEl && window.bootstrap?.Toast) {
            const instance = window.bootstrap.Toast.getInstance(toastEl);
            if (instance) instance.hide();
          }
        } else if (dismiss === "alert") {
          const alertEl = btn.closest(".alert");
          if (alertEl && window.bootstrap?.Alert) {
            const instance =
              window.bootstrap.Alert.getOrCreateInstance(alertEl);
            if (instance) instance.close();
          }
        }
      });
    };

    // Función para procesar Toggles (Collapse, Dropdown)
    const procesarToggle = (btn) => {
      if (btn.dataset.toggleListenerAgregado) return;
      btn.dataset.toggleListenerAgregado = "true";

      const toggle = btn.getAttribute("data-bs-toggle");
      if (!toggle) return;

      if (toggle === "collapse" || toggle === "dropdown") {
        btn.addEventListener("click", (ev) => {
          // No prevenimos default para permitir comportamiento nativo si funciona
          const targetId =
            btn.getAttribute("data-bs-target") || btn.getAttribute("href");

          if (toggle === "collapse" && targetId && window.bootstrap?.Collapse) {
            try {
              const target = document.querySelector(targetId);
              if (target) {
                // Intentamos obtener instancia existente
                const instance = window.bootstrap.Collapse.getInstance(target);
                // Si no existe, bootstrap nativo probablemente lo maneje.
                // Si existe y no respondió al click nativo (por stopPropagation ajeno), lo forzamos:
                if (instance && !target.classList.contains("collapsing")) {
                  instance.toggle();
                }
              }
            } catch (e) {
              console.warn("Error manual collapse", e);
            }
          }
          // Dropdowns suelen ser complejos de manejar manualmente sin romper popper.js
          // Solo intervenimos si bootstrap está cargado
          if (toggle === "dropdown" && window.bootstrap?.Dropdown) {
            try {
              const instance = window.bootstrap.Dropdown.getInstance(btn);
              // Si no hay instancia, será creada por bootstrap nativo.
              // Aquí solo actuamos si algo bloqueó el evento original
            } catch (e) {
              console.warn("Error manual dropdown", e);
            }
          }
        });
      }
    };

    // Procesar todos los botones existentes de dismiss y toggle
    const procesarTodos = () => {
      document.querySelectorAll("[data-bs-dismiss]").forEach(procesarBoton);
      document.querySelectorAll("[data-bs-toggle]").forEach(procesarToggle);
    };

    // Ejecutar inmediatamente
    procesarTodos();

    // Observar el DOM para nuevos elementos
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;

          if (node.hasAttribute && node.hasAttribute("data-bs-dismiss"))
            procesarBoton(node);
          if (node.hasAttribute && node.hasAttribute("data-bs-toggle"))
            procesarToggle(node);

          if (node.querySelectorAll) {
            node.querySelectorAll("[data-bs-dismiss]").forEach(procesarBoton);
            node.querySelectorAll("[data-bs-toggle]").forEach(procesarToggle);
          }
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    console.log(
      "[FlujoAutorizacion] Botones Bootstrap (Dismiss y Toggle) inicializados globalmente con resiliencia"
    );
  };

  // Inicializar cuando el DOM esté listo
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inicializarBotonesBootstrap);
  } else {
    // El DOM ya está cargado, esperar un poco para que Bootstrap se inicialice
    setTimeout(inicializarBotonesBootstrap, 100);
  }

  /**
   * ensureDraftsDrawer
   * Crea el Centro de Borradores con dos vistas:
   * 1. Borradores activos - Lista de borradores en curso para cargar
   * 2. Historial completo - Todos los cambios de estado y acciones (incluso descartados/rechazados)
   * 
   * El historial se guarda en BD para auditoría y consulta permanente
   * 
   * @returns {HTMLElement} El drawer creado o existente
   */
  const ensureDraftsDrawer = () => {
    const DRAFTS_DRAWER_ID = "workflowDraftsDrawer";
    const existing = document.getElementById(DRAFTS_DRAWER_ID);
    if (existing) return existing;
    
    const drawer = document.createElement("div");
    drawer.className = "offcanvas offcanvas-end drafts-drawer";
    drawer.tabIndex = -1;
    drawer.id = DRAFTS_DRAWER_ID;
    drawer.setAttribute("aria-labelledby", "draftsDrawerLabel");
    
    drawer.innerHTML = `
      <div class="offcanvas-header">
        <h5 class="offcanvas-title" id="draftsDrawerLabel">
          <i class="bi bi-file-earmark-text me-2"></i>Centro de Borradores
        </h5>
        <button type="button" class="btn-close text-reset" data-bs-dismiss="offcanvas" aria-label="Cerrar"></button>
      </div>
      <div class="offcanvas-body">
        <!-- Tabs: Borradores / Historial -->
        <ul class="nav nav-tabs mb-3" role="tablist">
          <li class="nav-item" role="presentation">
            <button class="nav-link active" id="drafts-tab" data-bs-toggle="tab" data-bs-target="#drafts-panel" type="button" role="tab">
              <i class="bi bi-file-earmark me-1"></i>Borradores Activos
            </button>
          </li>
          <li class="nav-item" role="presentation">
            <button class="nav-link" id="history-tab" data-bs-toggle="tab" data-bs-target="#history-panel" type="button" role="tab">
              <i class="bi bi-clock-history me-1"></i>Historial Completo
            </button>
          </li>
        </ul>

        <div class="tab-content">
          <!-- Panel: Borradores Activos -->
          <div class="tab-pane fade show active" id="drafts-panel" role="tabpanel">
            <div id="draftsCenterStatus" class="alert alert-info mb-3">
              <i class="bi bi-info-circle me-2"></i>Selecciona empresa y ejercicio para ver tus borradores.
            </div>
            <div class="table-responsive">
              <table class="table table-hover align-middle">
                <thead class="table-light">
                  <tr>
                    <th>Estado</th>
                    <th>Autor</th>
                    <th>Fecha</th>
                    <th class="text-end">Acción</th>
                  </tr>
                </thead>
                <tbody id="draftsCenterBody">
                  <tr>
                    <td colspan="4" class="text-center text-muted py-4">Sin borradores</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Panel: Historial Completo -->
          <div class="tab-pane fade" id="history-panel" role="tabpanel">
            <div id="draftsHistoryStatus" class="alert alert-info mb-3">
              <i class="bi bi-info-circle me-2"></i>Historial de todos los cambios y acciones del flujo.
            </div>
            
            <!-- Filtros de búsqueda -->
            <div class="card mb-3">
              <div class="card-body">
                <h6 class="card-title mb-3">Filtros</h6>
                <div class="row g-2">
                  <div class="col-12">
                    <input type="search" class="form-control form-control-sm" id="draftsHistorySearch" placeholder="Buscar en descripción o comentarios...">
                  </div>
                  <div class="col-6">
                    <select class="form-select form-select-sm" id="draftsHistoryState">
                      <option value="">Todos los estados</option>
                    </select>
                  </div>
                  <div class="col-6">
                    <select class="form-select form-select-sm" id="draftsHistoryAction">
                      <option value="">Todas las acciones</option>
                    </select>
                  </div>
                  <div class="col-6">
                    <input type="date" class="form-control form-control-sm" id="draftsHistoryFrom" placeholder="Desde">
                  </div>
                  <div class="col-6">
                    <input type="date" class="form-control form-control-sm" id="draftsHistoryTo" placeholder="Hasta">
                  </div>
                  <div class="col-12">
                    <button type="button" class="btn btn-sm btn-outline-secondary w-100" id="draftsHistoryClear">
                      <i class="bi bi-x-circle me-1"></i>Limpiar filtros
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Tabla de historial -->
            <div class="table-responsive">
              <table class="table table-sm table-hover">
                <thead class="table-light">
                  <tr>
                    <th>Acción</th>
                    <th>Estado</th>
                    <th>Usuario</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody id="draftsHistoryBody">
                  <tr>
                    <td colspan="4" class="text-center text-muted py-4">Sin registros</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(drawer);
    
    // Setup filtros de historial
    const setupHistoryFilters = () => {
      const searchInput = drawer.querySelector('#draftsHistorySearch');
      const stateSelect = drawer.querySelector('#draftsHistoryState');
      const actionSelect = drawer.querySelector('#draftsHistoryAction');
      const fromInput = drawer.querySelector('#draftsHistoryFrom');
      const toInput = drawer.querySelector('#draftsHistoryTo');
      const clearBtn = drawer.querySelector('#draftsHistoryClear');
      
      let debounceTimer = null;
      const triggerHistoryRefresh = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          const event = new CustomEvent('draftsHistoryFilterChange');
          drawer.dispatchEvent(event);
        }, 300);
      };
      
      if (searchInput) searchInput.addEventListener('input', triggerHistoryRefresh);
      if (stateSelect) stateSelect.addEventListener('change', triggerHistoryRefresh);
      if (actionSelect) actionSelect.addEventListener('change', triggerHistoryRefresh);
      if (fromInput) fromInput.addEventListener('change', triggerHistoryRefresh);
      if (toInput) toInput.addEventListener('change', triggerHistoryRefresh);
      
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          if (searchInput) searchInput.value = '';
          if (stateSelect) stateSelect.value = '';
          if (actionSelect) actionSelect.value = '';
          if (fromInput) fromInput.value = '';
          if (toInput) toInput.value = '';
          triggerHistoryRefresh();
        });
      }
    };
    
    setupHistoryFilters();
    return drawer;
  };

  const ensureWorkflowDrawer = () => {
    const existing = document.getElementById("workflowDrawer");
    if (existing) return existing;
    const drawer = document.createElement("div");
    drawer.className = "offcanvas offcanvas-end workflow-drawer";
    drawer.tabIndex = -1;
    drawer.id = "workflowDrawer";
    drawer.setAttribute("aria-labelledby", "workflowDrawerLabel");
    drawer.innerHTML = `
      <div class="offcanvas-header">
        <h5 class="offcanvas-title" id="workflowDrawerLabel">Flujo de autorización</h5>
        <button type="button" class="btn-close text-reset btn-cerrar-offcanvas" data-bs-dismiss="offcanvas" aria-label="Cerrar"></button>
      </div>
      <div class="offcanvas-body">
        <div class="btn-group w-100 mb-3" role="group" aria-label="Vistas del flujo">
          <button type="button" class="btn btn-outline-primary active" data-workflow-tab="guide">Información</button>
          <button type="button" class="btn btn-outline-primary" data-workflow-tab="history">Historial</button>
        </div>

        <!-- Vista: Guía / Información -->
        <div class="workflow-view" data-workflow-view="guide">
          <div class="workflow-guide-anchor"></div>
        </div>

        <!-- Vista: Historial (Oculta por defecto) -->
        <div class="workflow-view d-none" data-workflow-view="history">
          <div class="workflow-info-panel mb-3">
            <div class="d-flex justify-content-between align-items-start mb-3">
              <div>
                <p class="text-muted small mb-1">Estado actual</p>
                <div id="workflowCurrentState" class="h6 mb-1">Sin contexto</div>
                <div id="workflowCurrentMeta" class="text-muted small"></div>
              </div>
              <span class="badge bg-secondary" id="workflowCurrentBadge">-</span>
            </div>
            <div id="workflowHistoryStatus" class="alert alert-info">
              Selecciona empresa, módulo y ejercicio para consultar el historial.
            </div>
            <form class="row g-2 workflow-history-filters mb-3" id="workflowHistoryFilters">
              <div class="col-12">
                <label for="workflowHistorySearch" class="form-label">Buscar</label>
                <input type="search" id="workflowHistorySearch" class="form-control" placeholder="Acción, usuario o comentario">
              </div>
              <div class="col-sm-6">
                <label for="workflowHistoryState" class="form-label">Estado</label>
                <select id="workflowHistoryState" class="form-select">
                  <option value="">Todos</option>
                </select>
              </div>
              <div class="col-sm-6">
                <label for="workflowHistoryAction" class="form-label">Acción</label>
                <select id="workflowHistoryAction" class="form-select">
                  <option value="">Todas</option>
                </select>
              </div>
              <div class="col-sm-6">
                <label for="workflowHistoryUser" class="form-label">Usuario</label>
                <select id="workflowHistoryUser" class="form-select">
                  <option value="">Todos</option>
                </select>
              </div>
              <div class="col-sm-3">
                <label for="workflowHistoryFrom" class="form-label">Desde</label>
                <input type="date" id="workflowHistoryFrom" class="form-control">
              </div>
              <div class="col-sm-3">
                <label for="workflowHistoryTo" class="form-label">Hasta</label>
                <input type="date" id="workflowHistoryTo" class="form-control">
              </div>
            </form>
            <div class="table-responsive">
              <table class="table table-sm workflow-history-table">
                <thead>
                  <tr>
                    <th>Acción</th>
                    <th>Estado</th>
                    <th>Usuario</th>
                    <th>Fecha</th>
                    <th>Detalles</th>
                  </tr>
                </thead>
                <tbody id="workflowHistoryTableBody">
                  <tr>
                    <td colspan="5" class="text-center text-muted">Sin historial</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(drawer);

    // Agregar listener explícito al botón close del offcanvas
    const btnCloseWorkflow = drawer.querySelector(".btn-cerrar-offcanvas");
    if (btnCloseWorkflow) {
      btnCloseWorkflow.addEventListener("click", () => {
        if (window.bootstrap?.Offcanvas) {
          const instance = window.bootstrap.Offcanvas.getInstance(drawer);
          if (instance) instance.hide();
        } else {
          drawer.classList.remove("show");
          drawer.style.visibility = "";
        }
      });
    }

    // Lógica de Tabs
    const tabButtons = drawer.querySelectorAll("[data-workflow-tab]");
    const views = drawer.querySelectorAll("[data-workflow-view]");
    tabButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        tabButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const target = btn.dataset.workflowTab;
        views.forEach((v) =>
          v.classList.toggle("d-none", v.dataset.workflowView !== target)
        );
      });
    });

    return drawer;
  };

  const headersAutenticacion = () =>
    typeof Sesion?.headersAutenticacion === "function"
      ? Sesion.headersAutenticacion()
      : {};

  class FlujoAutorizacion {
    constructor(options = {}) {
      colocarEstilo();
      this.options = options;
      this.tablaId =
        options.tablaId || document.body.dataset.tabla || "tablaComparacion";
      this.moduloDefault = options.modulo || document.body.dataset.modulo || "";
      this.state = {
        contexto: { empresaId: null, anio: null, modulo: this.moduloDefault },
        borrador: null,
        permisos: {
          cargar: false,
          revisar: false,
          aprobar: false,
          leer: true,
          admin: false,
        },
        usuario: null,
        editMode: false,
        hayCambios: false,
      };
      this.tableElement = null;
      this.toastInstance = null;
      this.toastBody = null;
      this.buttons = {};
      this._contextRetry = 0;
      this.callbacks = {
        onCancelEdit:
          typeof options.onCancelEdit === "function"
            ? options.onCancelEdit
            : null,
        obtenerCambios:
          typeof options.obtenerCambios === "function"
            ? options.obtenerCambios
            : null,
        obtenerHeaders:
          typeof options.obtenerHeaders === "function"
            ? options.obtenerHeaders
            : null,
      };
      this.buttonIds = options.buttonIds || {
        guardar: "btnGuardarBorrador",
        enviar: "btnEnviarCambios",
        cancelar: "btnCancelarEdicion",
        verBorrador: "btnVerBorrador",
        descartar: "btnDescartarBorrador",
        autorizar: "btnAutorizar",
        rechazar: "btnRechazar",
        marcarRevisado: "btnMarcarRevisado",
        guardarCOI: "saveBudgetBtn",
      };
      this._bindGlobalEvents();
    }

    init() {
      this._hydrateContext();
      this._resolveTable();
      this._setupButtons();
      this._prepareToast();
      this._refreshEstado();
      return this;
    }

    _hydrateContext() {
      const sesion =
        typeof Sesion?.obtener === "function" ? Sesion.obtener() : null;
      this.state.usuario = sesion?.usuario || null;
      this.state.permisos = this._resolverPermisos(sesion);
      if (!this.state.contexto.empresaId && sesion?.empresaActiva?.id) {
        this.state.contexto.empresaId = sesion.empresaActiva.id;
      }
      if (!this.state.contexto.modulo) {
        this.state.contexto.modulo =
          document.body.dataset.modulo || this.moduloDefault;
      }
      if (
        !this.state.contexto.anio ||
        Number(this.state.contexto.anio) < 2000
      ) {
        this.state.contexto.anio = this._resolverAnio();
      }
    }

    /**
     * Sanitiza el nombre del módulo removiendo sufijos como :1, :2, etc
     * que pueden venir concatenados por selectores de capítulo
     * @param {string} modulo - Nombre del módulo posiblemente con sufijo
     * @returns {string} Nombre del módulo limpio
     */
    _sanitizarModulo(modulo) {
      return String(modulo || '').split(':')[0].trim();
    }

    /**
     * Resuelve los permisos del usuario actual para el flujo de autorización
     * 
     * Permisos disponibles:
     * - cargar: Permiso "Cargar y guardar" - permite crear, editar y enviar presupuestos
     * - revisar: Permiso "Revisar" - permite marcar como revisado o rechazar
     * - aprobar: Permiso "Aprobar" - permite autorizar presupuestos revisados y guardar en COI
     * - leer: Permiso de solo lectura (todos los usuarios)
     * - admin: Administrador global (ICONET) - tiene todos los permisos
     * 
     * @param {Object} sesion - Sesión actual del usuario
     * @returns {Object} Objeto con los permisos del usuario
     */
    _resolverPermisos(sesion) {
      const base = {
        cargar: false,
        revisar: false,
        aprobar: false,
        leer: true,
        admin: false,
      };
      if (!sesion?.usuario) return base;
      const esAdminGlobal =
        Boolean(sesion.usuario.esAdminGlobal) ||
        (sesion.usuario.usuario || "").toUpperCase() === "ICONET";
      if (esAdminGlobal) {
        return {
          cargar: true,
          revisar: true,
          aprobar: true,
          leer: true,
          admin: true,
        };
      }
      const empresa = sesion?.empresaActiva?.id || null;
      const modulo = this.state.contexto.modulo || this.moduloDefault;
      const permisosModulo =
        typeof Sesion?.obtenerPermisosModulo === "function"
          ? Sesion.obtenerPermisosModulo(modulo, empresa, sesion)
          : null;
      return {
        cargar: Boolean(permisosModulo?.["Cargar y guardar"]),
        revisar: Boolean(permisosModulo?.Revisar),
        aprobar: Boolean(permisosModulo?.Aprobar),
        leer: Boolean(permisosModulo?.Lectura ?? true),
        admin: false,
      };
    }

    _resolverAnio() {
      const candidatos = YEAR_SELECTOR_IDS.map((id) =>
        document.getElementById(id)
      )
        .filter(Boolean)
        .map((el) => Number(el.value))
        .filter((n) => Number.isFinite(n) && n >= 2000);
      if (candidatos.length) return candidatos[0];
      return new Date().getFullYear();
    }

    _resolveTable() {
      this.tableElement =
        document.getElementById(this.tablaId) ||
        document.getElementById("tablaPresupuestos") ||
        document.querySelector("#tablaComparacion") ||
        document.querySelector("#mainTable") ||
        document.querySelector("table");
    }

    _setupButtons() {
      this.buttons = {};
      Object.entries(this.buttonIds).forEach(([key, id]) => {
        if (!id) return;
        const el = document.getElementById(id);
        if (!el) {
          console.debug(`Bot¢n no encontrado: ${key} (${id})`);
          return;
        }
        el.classList.remove("disabled");
        el.removeAttribute("disabled");
        el.style.pointerEvents = "auto";
        this.buttons[key] = el;
      });
      this._ensureBotonDescartar();
      this._bindButtonHandlers();
    }

    _ensureBotonDescartar() {
      if (this.buttons.descartar) {
        this.buttons.descartar.classList.add("d-none");
        return;
      }
      const contenedor = this.buttons.verBorrador?.parentElement;
      if (!contenedor) return;
      const boton = document.createElement("button");
      boton.type = "button";
      boton.className = "btn btn-chip btn-outline-danger d-none";
      boton.id = "btnDescartarBorrador";
      boton.innerHTML = `<i class="bi bi-eraser"></i><span>Descartar borrador</span>`;
      contenedor.insertBefore(
        boton,
        this.buttons.verBorrador?.nextSibling || null
      );
      this.buttons.descartar = boton;
    }

    _bindButtonHandlers() {
      const agregarListener = (btn, handler) => {
        if (!btn) return;
        btn.addEventListener("click", handler, { once: false });
      };

      agregarListener(this.buttons.guardar, () => this._handleGuardar());

      if (this.buttons.enviar) {
        const span = this.buttons.enviar.querySelector("span");
        if (span) span.textContent = "Enviar presupuesto";
        agregarListener(this.buttons.enviar, () => this._handleEnviar());
      }

      agregarListener(this.buttons.cancelar, () => this._handleCancelar());
      agregarListener(this.buttons.verBorrador, () =>
        this._mostrarCentroBorradores()
      );

      if (this.buttons.descartar) {
        this.buttons.descartar.style.pointerEvents = "auto";
        agregarListener(this.buttons.descartar, (ev) => {
          ev.preventDefault();
          this._descartarBorrador();
        });
      }

      agregarListener(this.buttons.autorizar, () => this._handleAutorizar());
      agregarListener(this.buttons.rechazar, () => this._handleRechazar());
      agregarListener(this.buttons.marcarRevisado, () =>
        this._handleMarcarRevisado()
      );

      if (this.buttons.guardarCOI) {
        const span = this.buttons.guardarCOI.querySelector("span");
        if (span) span.textContent = "Guardar en COI";
        agregarListener(this.buttons.guardarCOI, () =>
          this._handleGuardarCOI()
        );
      }
    }

    _limpiarEventListeners() {
      if (!this.buttons) return;
      Object.entries(this.buttons).forEach(([key, btn]) => {
        if (!btn || !btn.parentNode) return;
        const clone = btn.cloneNode(true);
        clone.classList.remove("disabled");
        clone.removeAttribute("disabled");
        clone.style.pointerEvents = "auto";
        btn.parentNode.replaceChild(clone, btn);
        this.buttons[key] = clone;
      });
      this._bindButtonHandlers();
    }

    _prepareToast() {
      const toastElement = document.getElementById("actionToast");
      const toastBody = document.getElementById("actionToastBody");
      if (toastElement && toastBody && window.bootstrap?.Toast) {
        const wrapper = toastElement.closest(".position-fixed, .toast-global");
        if (wrapper) {
          wrapper.classList.add("toast-global");
          document.body.appendChild(wrapper);
        } else if (toastElement.parentElement !== document.body) {
          toastElement.classList.add("toast-global");
          document.body.appendChild(toastElement);
        }
        this.toastInstance = window.bootstrap.Toast.getOrCreateInstance(
          toastElement,
          { delay: 3200 }
        );
        this.toastBody = toastBody;
      }
    }

    _bindGlobalEvents() {
      window.addEventListener(EVENTO_EDICION, (ev) => {
        this.state.hayCambios = Boolean(ev?.detail?.hayCambios);
      });
      window.addEventListener(EVENTO_CONTEXTO, (ev) => {
        const d = ev?.detail || {};
        this.state.contexto.empresaId =
          d.empresaId || this.state.contexto.empresaId;
        this.state.contexto.anio = Number.isFinite(Number(d.anio))
          ? Number(d.anio)
          : this.state.contexto.anio;
        this.state.contexto.modulo = d.modulo || this.state.contexto.modulo;
        this.state.permisos = this._resolverPermisos(
          typeof Sesion?.obtener === "function" ? Sesion.obtener() : null
        );
        this._refreshEstado();
      });
      if (window.Sesion?.EVENTO_EMPRESA) {
        window.addEventListener(window.Sesion.EVENTO_EMPRESA, (ev) => {
          const empresa = ev?.detail?.empresa;
          if (empresa?.id) {
            this.state.contexto.empresaId = empresa.id;
            this.state.permisos = this._resolverPermisos(
              typeof Sesion?.obtener === "function" ? Sesion.obtener() : null
            );
            this._refreshEstado();
          }
        });
      }
      YEAR_SELECTOR_IDS.map((id) => document.getElementById(id))
        .filter(Boolean)
        .forEach((sel) => {
          if (sel.dataset.workflowBound === "1") return;
          sel.dataset.workflowBound = "1";
          sel.addEventListener("change", () => {
            const nuevo = Number(sel.value);
            if (Number.isFinite(nuevo) && nuevo >= 2000) {
              this.state.contexto.anio = nuevo;
              this._refreshEstado();
            }
          });
        });
    }

    _manejarSesionExpirada(resp) {
      if (resp?.status === 401) {
        try {
          if (typeof Sesion?.limpiar === "function") {
            Sesion.limpiar();
          }
        } catch (e) { /* ignore */ }
        window.location.href = "login.html";
        return true;
      }
      return false;
    }

    async _refreshEstado() {
      this._hydrateContext();
      if (!this._contextoCompleto()) {
        this.state.borrador = null;
        this._exitEditMode(true);
        FlujoAutorizacion.limpiarBorrador(this.tableElement);
        this._notificarEstadoBorrador(null);
        this._renderInfo();
        this._renderBotones();
        return;
      }
      try {
        // Sanitizar módulo: remover sufijos como :1, :2, etc que puedan venir de capítulo
        const moduloLimpio = this._sanitizarModulo(this.state.contexto.modulo);
        const capitulo = this._extraerCapitulo(this.state.contexto.modulo);
        console.log(`🧹 Módulo sanitizado: "${this.state.contexto.modulo}" → "${moduloLimpio}"${capitulo ? ` [Capítulo: ${capitulo}]` : ''}`);
        const params = new URLSearchParams({
          empresaId: this.state.contexto.empresaId,
          anio: String(this.state.contexto.anio),
          modulo: moduloLimpio,
        });
        if (capitulo) {
          params.set('capitulo', capitulo);
        }
        const resp = await fetch(
          `${API_BASE}/borradores/estado?${params.toString()}`,
          {
            headers: this._construirHeaders(),
          }
        );
        if (this._manejarSesionExpirada(resp)) return;
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok)
          throw new Error(
            data.mensaje || "No fue posible consultar el estado."
          );
        this.state.borrador = data.borrador || null;
        if (!this.state.borrador) {
          this._exitEditMode(true);
          FlujoAutorizacion.limpiarBorrador(this.tableElement);
        } else {
          this._sincronizarEdicion();
        }
        this._notificarEstadoBorrador(this.state.borrador);
        this._renderInfo();
        this._renderBotones();
      } catch (error) {
        console.error("Estado flujo", error);
        this.state.borrador = null;
        this._exitEditMode(true);
        FlujoAutorizacion.limpiarBorrador(this.tableElement);
        this._notificarEstadoBorrador(null);
        this._renderInfo();
        this._renderBotones();
        this._toast(
          error.message || "No fue posible obtener el estado.",
          "danger"
        );
      }
    }

    _sincronizarEdicion() {
      const estado = this.state.borrador?.estado;
      // Ya no activar automáticamente el modo edición al cargar
      // El usuario debe hacer clic en "Editar" o "Cargar Borrador" explícitamente
      // Solo salir del modo edición si el estado cambió y ya no es EDITANDO
      if (this.state.editMode && estado !== ESTADOS.EDITANDO) {
        this._exitEditMode();
      }
    }

    _contextoCompleto() {
      const ctx = this.state.contexto;
      return Boolean(
        ctx.empresaId && ctx.modulo && Number.isFinite(Number(ctx.anio))
      );
    }

    _construirHeaders() {
      const base =
        typeof this.callbacks.obtenerHeaders === "function"
          ? this.callbacks.obtenerHeaders() || {}
          : headersAutenticacion();
      return { "Content-Type": "application/json", ...base };
    }

    _obtenerCambios() {
      let fuente = null;
      if (typeof this.callbacks.obtenerCambios === "function") {
        fuente = this.callbacks.obtenerCambios();
      } else if (window.CuentasModulo?.getCambios) {
        fuente = window.CuentasModulo.getCambios();
      }
      const presupuesto = Array.isArray(fuente?.presupuesto)
        ? fuente.presupuesto
        : [];
      return { ...(fuente || {}), presupuesto };
    }

    _esAutor() {
      if (!this.state.usuario || !this.state.borrador) return false;
      return (
        String(this.state.usuario.id) === String(this.state.borrador.usuarioId)
      );
    }

    _enterEditMode(silent = false) {
      if (this.state.editMode) return;
      this.state.editMode = true;
      if (!silent) this.state.hayCambios = false;
      this.tableElement?.classList.add("modo-edicion");
      window.CuentasModulo?.setEditMode?.(true);
      // Activar ModoEdicionPresupuesto para habilitar edición de celdas numéricas (que SÍ se insertan a COI)
      if (window.ModoEdicionPresupuesto?.activar) {
        try { 
          window.ModoEdicionPresupuesto.activar();
          console.log('🟢 Flujo Autorización: modo edición ACTIVADO (celdas numéricas editables)');
        } catch (e) { 
          console.warn('Error activando ModoEdicionPresupuesto:', e);
        }
      }
      this._renderBotones();
    }

    _exitEditMode(skipCancel = false) {
      if (!this.state.editMode) return;
      this.state.editMode = false;
      this.state.hayCambios = false;
      this.tableElement?.classList.remove("modo-edicion");
      if (!skipCancel) {
        if (typeof this.callbacks.onCancelEdit === "function") {
          this.callbacks.onCancelEdit();
        } else {
          window.CuentasModulo?.cancelEdit?.();
        }
      }
      window.CuentasModulo?.setEditMode?.(false);
      // Desactivar ModoEdicionPresupuesto
      if (window.ModoEdicionPresupuesto?.desactivar) {
        try {
          window.ModoEdicionPresupuesto.desactivar();
          console.log('🔴 Flujo Autorización: modo edición DESACTIVADO');
        } catch (e) {
          console.warn('Error desactivando ModoEdicionPresupuesto:', e);
        }
      }
      this._renderBotones();
    }

    _estadoSeguro() {
      return this.state.borrador?.estado || "SIN_CARGAR";
    }

    _puede({ accion, estadoOverride }) {
      const estado = estadoOverride || this._estadoSeguro();
      const esAutor = this._esAutor();
      const p = this.state.permisos;
      const ctxOk = this._contextoCompleto();
      if (!ctxOk) return false;
      switch (accion) {
        case "cargar":
          return p.admin || p.cargar;
        case "editar":
          return (
            (p.admin || p.cargar) &&
            (!estado ||
              estado === ESTADOS.SIN_CARGAR ||
              estado === ESTADOS.GUARDADO ||
              (estado === ESTADOS.RECHAZADO && esAutor) ||
              (estado === ESTADOS.EDITANDO && esAutor))
          );
        case "guardarTemporal":
          return (p.admin || p.cargar) && this.state.editMode;
        case "enviar":
          return (p.admin || p.cargar) && this.state.editMode;
        case "revisar":
          return (
            (p.admin || p.revisar) &&
            (estado === ESTADOS.PENDIENTE || estado === ESTADOS.REVISADO)
          );
        case "autorizar":
          return (p.admin || p.aprobar) && estado === ESTADOS.REVISADO;
        case "rechazar":
          return (
            (p.admin || p.revisar || p.aprobar) &&
            [ESTADOS.PENDIENTE, ESTADOS.REVISADO, ESTADOS.APROBADO].includes(
              estado
            )
          );
        case "guardarCoi":
          return (p.admin || p.aprobar) && estado === ESTADOS.APROBADO;
        case "verBorradores":
          return true;
        case "descartar":
          return (p.admin || p.cargar) && Boolean(this.state.borrador);
        default:
          return false;
      }
    }

    _renderInfo() {
      const badge = document.getElementById("workflowBadge");
      const meta = document.getElementById("workflowMeta");
      if (!badge) return;
      const estado = this._estadoSeguro();
      badge.textContent = ETIQUETAS_ESTADO[estado] || estado;
      badge.dataset.estado = estado;
      if (meta) {
        const fecha = this.state.borrador?.fechaEnvio
          ? formatDateTime(this.state.borrador.fechaEnvio)
          : "";
        const autor = this.state.borrador?.autorNombre || "";
        meta.textContent = fecha
          ? `Actualizado: ${fecha}${autor ? ` · ${autor}` : ""}`
          : "";
      }
    }

    _renderBotones() {
      const estado = this._estadoSeguro();
      const tieneBorrador = Boolean(this.state.borrador);

      if (this.buttons.guardar) {
        const span = this.buttons.guardar.querySelector("span");
        if (this.state.editMode) {
          if (span) span.textContent = "Guardar para más tarde";
          this.buttons.guardar.classList.toggle(
            "d-none",
            !this._puede({ accion: "guardarTemporal" })
          );
        } else {
          if (span) span.textContent = "Cargar presupuesto";
          const visible =
            this._puede({ accion: "editar", estadoOverride: estado }) ||
            (!tieneBorrador && this._puede({ accion: "cargar" }));
          this.buttons.guardar.classList.toggle("d-none", !visible);
        }
      }

      if (this.buttons.enviar) {
        this.buttons.enviar.classList.toggle(
          "d-none",
          !this._puede({ accion: "enviar" })
        );
      }
      if (this.buttons.cancelar) {
        this.buttons.cancelar.classList.toggle(
          "d-none",
          !(this.state.editMode && this.state.permisos.cargar)
        );
      }
      if (this.buttons.marcarRevisado) {
        const visible = this._puede({ accion: "revisar" });
        this.buttons.marcarRevisado.classList.toggle("d-none", !visible);
        if (visible) {
          const texto =
            estado === ESTADOS.REVISADO
              ? "Cancelar revisión"
              : "Marcar como revisado";
          const span = this.buttons.marcarRevisado.querySelector("span");
          if (span) span.textContent = texto;
        }
      }
      if (this.buttons.autorizar) {
        this.buttons.autorizar.classList.toggle(
          "d-none",
          !this._puede({ accion: "autorizar" })
        );
      }
      if (this.buttons.rechazar) {
        this.buttons.rechazar.classList.toggle(
          "d-none",
          !this._puede({ accion: "rechazar" })
        );
      }
      if (this.buttons.guardarCOI) {
        this.buttons.guardarCOI.classList.toggle(
          "d-none",
          !this._puede({ accion: "guardarCoi" })
        );
      }
      if (this.buttons.verBorrador) {
        this.buttons.verBorrador.classList.remove("d-none");
        this.buttons.verBorrador.disabled = false;
      }
      if (this.buttons.descartar) {
        const visible =
          this._puede({ accion: "descartar" }) &&
          (tieneBorrador || this.state.editMode);
        this.buttons.descartar.classList.toggle("d-none", !visible);
        this.buttons.descartar.disabled = !visible;
      }
    }

    /**
     * Maneja el clic en el botón "Cargar presupuesto" o "Guardar para más tarde"
     * 
     * Comportamiento dual:
     * - Si NO está en modo edición: Activa el modo edición para cargar/crear presupuesto
     * - Si YA está en modo edición: Guarda los cambios actuales como borrador temporal
     * 
     * El botón cambia su texto según el estado:
     * - "Cargar presupuesto" cuando no hay borrador y no está editando
     * - "Guardar para más tarde" cuando está en modo edición
     */
    async _handleGuardar() {
      if (this.state.editMode) {
        await this._guardarBorradorTemporal();
        return;
      }
      if (!this._puede({ accion: "editar" })) {
        this._toast("No cuentas con permisos para editar.", "warning");
        return;
      }
      this._enterEditMode();
    }

    /**
     * Guarda los cambios actuales como borrador temporal (estado: EDITANDO)
     * 
     * Permite al usuario:
     * - Guardar su progreso sin finalizar
     * - Continuar editando después
     * - No pierde cambios si cierra la sesión
     * 
     * Los cambios se almacenan en la base de datos pero el estado permanece en EDITANDO.
     * El usuario puede seguir editando o enviar a revisión cuando termine.
     */
    async _guardarBorradorTemporal() {
      const cambios = this._obtenerCambios();
      const presupuesto = Array.isArray(cambios.presupuesto)
        ? cambios.presupuesto
        : [];
      if (!presupuesto.length) {
        this._toast("No hay cambios nuevos que guardar.", "info");
        return;
      }
      const moduloLimpio = this._sanitizarModulo(this.state.contexto.modulo);
      const capitulo = this._extraerCapitulo(this.state.contexto.modulo);
      const payload = {
        modulo: moduloLimpio,
        empresaId: this.state.contexto.empresaId,
        anio: this.state.contexto.anio,
        datos: { presupuesto },
      };
      if (capitulo) {
        payload.capitulo = capitulo;
      }
      try {
        const resp = await fetch(`${API_BASE}/borradores/guardar`, {
          method: "POST",
          headers: this._construirHeaders(),
          body: JSON.stringify(payload),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok)
          throw new Error(
            data.mensaje || "No fue posible guardar el borrador."
          );
        this.state.borrador = data.borrador || this.state.borrador;
        this.state.hayCambios = false;
        this._renderInfo();
        this._renderBotones();
        this._toast("Borrador guardado para continuar editando.");
      } catch (error) {
        console.error("Guardar borrador", error);
        this._toast(
          error.message || "No fue posible guardar el borrador.",
          "danger"
        );
      }
    }

    /**
     * Envía el presupuesto a revisión (transición: EDITANDO → PENDIENTE o APROBADO)
     * 
     * Proceso normal (usuario con permiso "Cargar y guardar"):
     * 1. Guarda los cambios actuales como borrador
     * 2. Cambia el estado a PENDIENTE
     * 3. Sale del modo edición
     * 4. Notifica a los revisores
     * 
     * Proceso para ADMINISTRADOR GLOBAL (ICONET):
     * 1. Guarda los cambios actuales como borrador
     * 2. Cambia el estado DIRECTAMENTE a APROBADO (omite PENDIENTE y REVISADO)
     * 3. Sale del modo edición
     * 4. El presupuesto queda listo para "Guardar en COI"
     * 
     * El administrador global NO depende de revisores configurados, siempre auto-aprueba.
     */
    async _handleEnviar() {
      if (!this._puede({ accion: "enviar" })) {
        this._toast("No cuentas con permisos para enviar.", "warning");
        return;
      }
      const cambios = this._obtenerCambios();
      let presupuesto = Array.isArray(cambios?.presupuesto)
        ? cambios.presupuesto
        : [];
      if (
        !presupuesto.length &&
        Array.isArray(this.state.borrador?.data?.presupuesto)
      ) {
        presupuesto = this.state.borrador.data.presupuesto;
      }
      const moduloLimpio = this._sanitizarModulo(this.state.contexto.modulo);
      const capitulo = this._extraerCapitulo(this.state.contexto.modulo);
      const payload = {
        modulo: moduloLimpio,
        empresaId: this.state.contexto.empresaId,
        anio: this.state.contexto.anio,
        datos: { presupuesto },
      };
      if (capitulo) {
        payload.capitulo = capitulo;
      }
      try {
        let resp = await fetch(`${API_BASE}/borradores/guardar`, {
          method: "POST",
          headers: this._construirHeaders(),
          body: JSON.stringify(payload),
        });
        let data = await resp.json().catch(() => ({}));
        if (!resp.ok)
          throw new Error(
            data.mensaje || "No fue posible guardar el borrador."
          );
        const borradorId = data.borrador.id;
        resp = await fetch(`${API_BASE}/borradores/enviar`, {
          method: "POST",
          headers: this._construirHeaders(),
          body: JSON.stringify({ borradorId }),
        });
        data = await resp.json().catch(() => ({}));
        if (!resp.ok)
          throw new Error(data.mensaje || "No fue posible enviar el borrador.");
        this.state.borrador = data.borrador || null;
        this._exitEditMode(true);
        this._renderInfo();
        this._renderBotones();
        const mensaje = data.autoAutorizado
          ? "Presupuesto autorizado automáticamente."
          : "Presupuesto enviado a revisión.";
        this._toast(mensaje);
      } catch (error) {
        console.error("Enviar", error);
        this._toast(
          error.message || "No fue posible enviar el presupuesto.",
          "danger"
        );
      }
    }

    async _handleCancelar() {
      const cambios = this._obtenerCambios();
      const hayCambios = Boolean(
        this.state.hayCambios || (cambios?.presupuesto?.length || 0) > 0
      );
      if (hayCambios) {
        const confirmar = confirm(
          "Estas seguro de cancelar la edicion? Se perderan todos los cambios no guardados."
        );
        if (!confirmar) {
          return;
        }
      }

      const intentarDescartar = async (payload) => {
        try {
          const resp = await fetch(`${API_BASE}/borradores/descartar`, {
            method: "POST",
            headers: this._construirHeaders(),
            body: JSON.stringify(payload),
          });
          const data = await resp.json().catch(() => ({}));
          if (!resp.ok) {
            console.warn(
              "No se pudo descartar el borrador en el servidor:",
              data?.mensaje || resp.statusText
            );
            return { ok: false, status: resp.status };
          }
          return { ok: true };
        } catch (error) {
          console.error("Error al descartar borrador:", error);
          return { ok: false, status: 0 };
        }
      };

      if (this.state.borrador?.id || this._contextoCompleto()) {
        const moduloLimpio = this._sanitizarModulo(this.state.contexto.modulo);
        const capitulo = this._extraerCapitulo(this.state.contexto.modulo);
        const contextoPayload = {
          empresaId: this.state.contexto.empresaId,
          modulo: moduloLimpio,
          anio: this.state.contexto.anio,
        };
        if (capitulo) {
          contextoPayload.capitulo = capitulo;
        }
        let resultado = null;
        if (this.state.borrador?.id) {
          resultado = await intentarDescartar({
            borradorId: this.state.borrador.id,
          });
          if (resultado?.status === 404) {
            resultado = await intentarDescartar(contextoPayload);
          }
        } else {
          resultado = await intentarDescartar(contextoPayload);
        }
        if (!resultado?.ok) {
          console.info(
            "Continuando con limpieza local aun sin descartar borrador remoto."
          );
        }
      }

      this._limpiarEventListeners();
      this._exitEditMode(true);
      this.state.borrador = null;
      this.state.hayCambios = false;
      FlujoAutorizacion.limpiarBorrador(this.tableElement);
      this._notificarEstadoBorrador(null);
      if (typeof this.callbacks.onCancelEdit === "function") {
        try {
          this.callbacks.onCancelEdit();
        } catch (error) {
          console.warn("Error al notificar cancelacion externa:", error);
        }
      } else {
        window.CuentasModulo?.cancelEdit?.();
      }
      window.CuentasModulo?.setEditMode?.(false);
      this._renderInfo();
      this._renderBotones();
      this._toast("Edicion cancelada. Presupuesto descartado.", "info");
      setTimeout(() => {
        try {
          window.location.reload();
        } catch (error) {
          console.warn(
            "No se pudo recargar la pagina despues de cancelar:",
            error
          );
        }
      }, 1000);
    }

    cancelarEdicion() {
      return this._handleCancelar();
    }

    /**
     * Marca el presupuesto como revisado o cancela la revisión
     * 
     * Acciones según el estado actual:
     * - Si está en PENDIENTE → pasa a REVISADO (marca como revisado)
     * - Si está en REVISADO → regresa a PENDIENTE (cancela revisión)
     * 
     * Solo usuarios con permiso "Revisar" pueden ejecutar esta acción.
     * Un presupuesto debe estar REVISADO para poder ser autorizado.
     */
    async _handleMarcarRevisado() {
      if (!this._puede({ accion: "revisar" })) {
        this._toast("No cuentas con permisos para revisar.", "warning");
        return;
      }
      if (!this.state.borrador?.id) {
        this._toast("No hay borrador para revisar.", "warning");
        return;
      }
      const cancelar = this.state.borrador.estado === ESTADOS.REVISADO;
      const mensaje = cancelar
        ? "¿Cancelar revisión y devolver a edición?"
        : "¿Marcar como revisado?";
      if (!confirm(mensaje)) return;
      try {
        const resp = await fetch(`${API_BASE}/borradores/revisar`, {
          method: "POST",
          headers: this._construirHeaders(),
          body: JSON.stringify({
            borradorId: this.state.borrador.id,
            cancelar,
          }),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok)
          throw new Error(
            data.mensaje || "No fue posible actualizar la revisión."
          );
        this.state.borrador = data.borrador || null;
        this._renderInfo();
        this._renderBotones();
        this._toast(data.mensaje || "Revisión actualizada.");
      } catch (error) {
        console.error("Revisar", error);
        this._toast(
          error.message || "No fue posible actualizar la revisión.",
          "danger"
        );
      }
    }

    /**
     * Autoriza el presupuesto (transición: REVISADO → APROBADO)
     * 
     * Requisitos:
     * - El presupuesto debe estar en estado REVISADO
     * - El usuario debe tener permiso "Aprobar"
     * 
     * Una vez aprobado, el presupuesto puede ser guardado en la base de datos COI.
     * Solo los usuarios con permiso "Aprobar" pueden guardar en COI.
     */
    async _handleAutorizar() {
      if (!this._puede({ accion: "autorizar" })) {
        this._toast("No cuentas con permisos para autorizar.", "warning");
        return;
      }
      if (!this.state.borrador?.id) {
        this._toast("No hay borrador para autorizar.", "warning");
        return;
      }
      // Mostrar modal de confirmación mejorado
      const confirmado = await this._mostrarConfirmacion({
        titulo: "⚠️ Autorizar Presupuesto",
        mensaje: `¿Estás seguro de que deseas <strong>autorizar</strong> este presupuesto?<br><small class="text-muted">Esta acción permitirá al usuario guardarlo en la base de datos COI.</small>`,
        etiquetaBoton: "Autorizar",
      });
      if (!confirmado) return;
      try {
        const resp = await fetch(`${API_BASE}/borradores/autorizar`, {
          method: "POST",
          headers: this._construirHeaders(),
          body: JSON.stringify({ borradorId: this.state.borrador.id }),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok)
          throw new Error(
            data.mensaje || "No fue posible autorizar el borrador."
          );
        this.state.borrador = data.borrador || null;
        this._renderInfo();
        this._renderBotones();
        this._toast(data.mensaje || "Presupuesto autorizado.", "success");
      } catch (error) {
        console.error("Autorizar", error);
        this._toast(error.message || "No fue posible autorizar.", "danger");
      }
    }

    /**
     * Rechaza el presupuesto y lo devuelve al autor para correcciones
     * 
     * Puede rechazarse desde los estados:
     * - PENDIENTE (por revisor)
     * - REVISADO (por revisor o autorizador)
     * - APROBADO (por autorizador)
     * 
     * Al rechazar:
     * 1. El estado cambia a RECHAZADO
     * 2. Se registra el motivo del rechazo
     * 3. El autor puede ver el motivo y corregir
     * 4. El autor puede volver a enviar (RECHAZADO → EDITANDO → PENDIENTE)
     */
    async _handleRechazar() {
      if (!this._puede({ accion: "rechazar" })) {
        this._toast("No cuentas con permisos para rechazar.", "warning");
        return;
      }
      if (!this.state.borrador?.id) {
        this._toast("No hay borrador para rechazar.", "warning");
        return;
      }
      // Mostrar modal con campo de texto para motivo
      const motivo = await this._mostrarEntradaConfirmacion({
        titulo: "❌ Rechazar Presupuesto",
        mensaje: `Indica el <strong>motivo</strong> para rechazar este presupuesto. El usuario podrá ver este comentario al revisarlo.`,
        placeholder: "Ej: Datos incompletos, revisión fallida, etc.",
        etiquetaBoton: "Rechazar",
      });
      // Permitir motivo vacío (opcional)
      if (motivo === null) return; // Solo si canceló (null)

      try {
        const resp = await fetch(`${API_BASE}/borradores/rechazar`, {
          method: "POST",
          headers: this._construirHeaders(),
          body: JSON.stringify({ borradorId: this.state.borrador.id, motivo }),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok)
          throw new Error(
            data.mensaje || "No fue posible rechazar el borrador."
          );
        this.state.borrador = data.borrador || null;
        this._renderInfo();
        this._renderBotones();
        this._toast(data.mensaje || "Presupuesto rechazado.", "info");
      } catch (error) {
        console.error("Rechazar", error);
        this._toast(error.message || "No fue posible rechazar.", "danger");
      }
    }

    /**
     * Guarda el presupuesto autorizado en la base de datos COI (transición: APROBADO → GUARDADO)
     * 
     * Esta es la acción FINAL del flujo de autorización.
     * 
     * Requisitos:
     * - El presupuesto debe estar en estado APROBADO
     * - El usuario debe tener permiso "Aprobar"
     * 
     * Efectos:
     * 1. Guarda el presupuesto en las tablas de Firebird (COI)
     * 2. Cambia el estado a GUARDADO
     * 3. El presupuesto se vuelve INMUTABLE (no se puede editar más)
     * 4. Se elimina el borrador de la base de datos
     */
    async _handleGuardarCOI() {
      if (!this._puede({ accion: "guardarCoi" })) {
        this._toast("No cuentas con permisos para guardar en COI.", "warning");
        return;
      }
      if (
        !this.state.borrador?.id ||
        this.state.borrador.estado !== ESTADOS.APROBADO
      ) {
        this._toast(
          "El presupuesto debe estar aprobado para guardar en COI.",
          "warning"
        );
        return;
      }
      // Mostrar modal de confirmación mejorado
      const confirmado = await this._mostrarConfirmacion({
        titulo: "💾 Guardar en Base de Datos COI",
        mensaje: `¿Estás seguro de que deseas guardar este presupuesto <strong>autorizado</strong> en la base de datos de COI?<br><small class="text-muted">Esta es una acción irreversible. El presupuesto no podrá editarse más.</small>`,
        etiquetaBoton: "Guardar en COI",
        tipoBoton: "primary",
      });
      if (!confirmado) return;
      try {
        const resp = await fetch(`${API_BASE}/borradores/finalizar`, {
          method: "POST",
          headers: this._construirHeaders(),
          body: JSON.stringify({ borradorId: this.state.borrador.id }),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok)
          throw new Error(data.mensaje || "No fue posible guardar en COI.");
        this.state.borrador = data.borrador || null;
        this._renderInfo();
        this._renderBotones();
        this._toast(data.mensaje || "Presupuesto guardado en COI.", "success");
      } catch (error) {
        console.error("Guardar COI", error);
        this._toast(
          error.message || "No fue posible guardar en COI.",
          "danger"
        );
      }
    }

    _toast(mensaje, tipo = "success") {
      if (!mensaje) return;
      if (this.toastInstance && this.toastBody) {
        const clase =
          tipo === "danger"
            ? "text-bg-danger"
            : tipo === "warning"
            ? "text-bg-warning"
            : "text-bg-success";
        const toastEl = this.toastInstance._element;
        if (toastEl)
          toastEl.className = `toast align-items-center border-0 ${clase}`;
        this.toastBody.textContent = mensaje;
        this.toastInstance.show();
        return;
      }
      console.info(`[Flujo AUT] ${mensaje}`);
    }

    async _mostrarConfirmacion({
      titulo,
      mensaje,
      etiquetaBoton = "Confirmar",
      tipoBoton = "warning",
    }) {
      return new Promise((resolve) => {
        try {
          // Crear modal con estructura correcta de Bootstrap
          const modalId = "modal-confirmacion-" + Date.now();
          const modal = document.createElement("div");
          modal.id = modalId;
          modal.className = "modal fade";
          modal.setAttribute("tabindex", "-1");
          modal.setAttribute("aria-hidden", "true");
          modal.setAttribute("role", "dialog");
          modal.setAttribute("aria-modal", "true");

          const contenidoHTML = `
            <div class="modal-dialog modal-dialog-centered">
              <div class="modal-content">
                <div class="modal-header border-bottom">
                  <h5 class="modal-title">${titulo || "Confirmacion"}</h5>
                  <button type="button" class="btn-close btn-cerrar-modal" data-bs-dismiss="modal" aria-label="Cerrar"></button>
                </div>
                <div class="modal-body">
                  ${mensaje || "Estas seguro?"}
                </div>
                <div class="modal-footer border-top">
                  <button type="button" class="btn btn-secondary btn-cancelar-modal" data-bs-dismiss="modal">Cancelar</button>
                  <button type="button" class="btn btn-${tipoBoton} btn-confirmar-modal">${etiquetaBoton}</button>
                </div>
              </div>
            </div>
          `;

          modal.innerHTML = contenidoHTML;
          document.body.appendChild(modal);

          // Obtener instancia de Bootstrap modal
          const bsModal = window.bootstrap?.Modal
            ? new window.bootstrap.Modal(modal, {
                backdrop: "static",
                keyboard: false,
              })
            : null;
          if (!bsModal) {
            console.error("Bootstrap Modal no esta disponible");
            document.body.removeChild(modal);
            resolve(false);
            return;
          }

          // Referencias a botones - usar clases CSS en lugar de data-bs-dismiss
          const btnConfirmar = modal.querySelector(".btn-confirmar-modal");
          const btnCerrar = modal.querySelector(".btn-cerrar-modal");
          const btnCancelar = modal.querySelector(".btn-cancelar-modal");
          const botonesCerrar = [btnCerrar, btnCancelar].filter(Boolean);
          let resuelto = false;
          let resultado = false;
          let limpio = false;

          const limpiar = () => {
            if (limpio) return;
            limpio = true;
            try {
              bsModal.dispose();
            } catch (e) {
              console.warn("Error limpiando instancia Modal:", e);
            }
            try {
              document.body.removeChild(modal);
            } catch (e) {
              console.warn("Error eliminando modal del DOM:", e);
            }
          };

          const finalizar = (valor) => {
            if (resuelto) return;
            resuelto = true;
            resultado = Boolean(valor);
            try {
              bsModal.hide();
            } catch (e) {
              console.warn("Error ocultando modal:", e);
              limpiar();
              resolve(resultado);
            }
          };

          const handleHidden = () => {
            limpiar();
            resolve(resultado);
          };

          const fallbackTimer = setTimeout(() => {
            if (resuelto && !limpio) {
              limpiar();
              resolve(resultado);
            }
          }, 600);

          modal.addEventListener(
            "hidden.bs.modal",
            () => {
              clearTimeout(fallbackTimer);
              handleHidden();
            },
            { once: true }
          );

          botonesCerrar.forEach((btn) => {
            btn.addEventListener(
              "click",
              () => {
                finalizar(false);
              },
              { once: true }
            );
          });

          if (btnConfirmar) {
            btnConfirmar.addEventListener(
              "click",
              () => {
                finalizar(true);
              },
              { once: true }
            );
          }

          // Mostrar modal
          bsModal.show();
        } catch (error) {
          console.error("Error en _mostrarConfirmacion:", error);
          resolve(false);
        }
      });
    }

    async _mostrarEntradaConfirmacion({
      titulo,
      mensaje,
      placeholder = "",
      etiquetaBoton = "Confirmar",
    }) {
      return new Promise((resolve) => {
        try {
          // Crear modal con estructura correcta de Bootstrap
          const modalId = "modal-entrada-" + Date.now();
          const modal = document.createElement("div");
          modal.id = modalId;
          modal.className = "modal fade";
          modal.setAttribute("tabindex", "-1");
          modal.setAttribute("aria-hidden", "true");
          modal.setAttribute("role", "dialog");
          modal.setAttribute("aria-modal", "true");

          const contenidoHTML = `
            <div class="modal-dialog modal-dialog-centered" style="pointer-events: auto;">
              <div class="modal-content">
                <div class="modal-header border-bottom">
                  <h5 class="modal-title">${titulo || "Entrada Requerida"}</h5>
                  <button type="button" class="btn-close btn-cerrar-modal" data-bs-dismiss="modal" aria-label="Cerrar"></button>
                </div>
                <div class="modal-body">
                  <p>${mensaje || "Por favor ingresa un valor:"}</p>
                  <textarea class="form-control textarea-entrada-modal" rows="4" placeholder="${placeholder}" style="resize: vertical;"></textarea>
                </div>
                <div class="modal-footer border-top">
                  <button type="button" class="btn btn-secondary btn-cancelar-modal" data-bs-dismiss="modal">Cancelar</button>
                  <button type="button" class="btn btn-primary btn-confirmar-entrada">${etiquetaBoton}</button>
                </div>
              </div>
            </div>
          `;

          modal.innerHTML = contenidoHTML;
          document.body.appendChild(modal);

          // Obtener instancia de Bootstrap modal
          const bsModal = window.bootstrap?.Modal
            ? new window.bootstrap.Modal(modal, {
                backdrop: "static",
                keyboard: false,
              })
            : null;
          if (!bsModal) {
            console.error("Bootstrap Modal no esta disponible");
            document.body.removeChild(modal);
            resolve(null);
            return;
          }

          // Referencias - usar clases CSS en lugar de data-bs-dismiss
          const textArea = modal.querySelector(".textarea-entrada-modal");
          const btnConfirmar = modal.querySelector(".btn-confirmar-entrada");
          const btnCerrar = modal.querySelector(".btn-cerrar-modal");
          const btnCancelar = modal.querySelector(".btn-cancelar-modal");
          const botonesCerrar = [btnCerrar, btnCancelar].filter(Boolean);
          let resuelto = false;
          let valorConfirmado = null;
          let limpio = false;

          const limpiar = () => {
            if (limpio) return;
            limpio = true;
            try {
              bsModal.dispose();
            } catch (e) {
              console.warn("Error limpiando instancia Modal:", e);
            }
            try {
              document.body.removeChild(modal);
            } catch (e) {
              console.warn("Error eliminando modal del DOM:", e);
            }
          };

          const finalizar = (valor) => {
            if (resuelto) return;
            resuelto = true;
            valorConfirmado = valor;
            try {
              bsModal.hide();
            } catch (e) {
              console.warn("Error ocultando modal:", e);
              limpiar();
              resolve(valorConfirmado);
            }
          };

          const handleHidden = () => {
            limpiar();
            resolve(valorConfirmado);
          };

          const fallbackTimer = setTimeout(() => {
            if (resuelto && !limpio) {
              limpiar();
              resolve(valorConfirmado);
            }
          }, 600);

          modal.addEventListener(
            "hidden.bs.modal",
            () => {
              clearTimeout(fallbackTimer);
              handleHidden();
            },
            { once: true }
          );

          botonesCerrar.forEach((btn) => {
            btn.addEventListener(
              "click",
              () => {
                finalizar(null);
              },
              { once: true }
            );
          });

          if (btnConfirmar) {
            btnConfirmar.addEventListener(
              "click",
              () => {
                if (resuelto) return;
                const valor = (textArea?.value || "").trim();
                finalizar(valor); // Devuelve string vacío si no escribió nada, pero NO null (confirmado)
              },
              { once: true }
            );
          }

          // Ctrl+Enter para confirmar
          if (textArea) {
            textArea.addEventListener(
              "keypress",
              (ev) => {
                if (ev.ctrlKey && ev.key === "Enter") {
                  ev.preventDefault();
                  finalizar((textArea.value || "").trim() || null);
                }
              },
              { once: false }
            );
          }

          // Mostrar modal
          bsModal.show();

          // Enfocar textarea
          setTimeout(() => textArea?.focus(), 300);
        } catch (error) {
          console.error("Error en _mostrarEntradaConfirmacion:", error);
          resolve(null);
        }
      });
    }

    _notificarEstadoBorrador(borrador) {
      try {
        window.dispatchEvent(
          new CustomEvent("flujo-autorizacion:estado-actualizado", {
            detail: { borrador: borrador || null },
          })
        );
      } catch (error) {
        console.warn("No fue posible notificar el estado del borrador.", error);
      }
    }

    async _mostrarCentroBorradores() {
      const drawer = ensureDraftsDrawer();
      if (!drawer) {
        this._toast("Error al mostrar el centro de borradores.", "danger");
        return;
      }
      if (!window.bootstrap?.Offcanvas) {
        this._toast("Bootstrap no está cargado correctamente.", "danger");
        return;
      }
      const offcanvas = window.bootstrap.Offcanvas.getOrCreateInstance(drawer);
      offcanvas.show();
      if (!this._contextoCompleto()) {
        const status = drawer.querySelector("#draftsCenterStatus");
        const body = drawer.querySelector("#draftsCenterBody");
        if (status) {
          status.className = "alert alert-warning";
          status.textContent =
            "Selecciona empresa y ejercicio para consultar los borradores.";
        }
        if (body) {
          body.innerHTML =
            '<tr><td colspan="5" class="text-center text-muted">Sin contexto seleccionado</td></tr>';
        }
        return;
      }
      await this._cargarCentroBorradores(drawer);
    }

    async _cargarCentroBorradores(drawer) {
      const status = drawer.querySelector("#draftsCenterStatus");
      const body = drawer.querySelector("#draftsCenterBody");
      if (!status || !body) return;
      status.className = "alert alert-info";
      status.textContent = "Cargando borradores...";
      body.innerHTML =
        '<tr><td colspan="5" class="text-center text-muted">Cargando...</td></tr>';
      try {
        const moduloLimpio = this._sanitizarModulo(this.state.contexto.modulo);
        const capitulo = this._extraerCapitulo(this.state.contexto.modulo);
        const params = new URLSearchParams({
          empresaId: this.state.contexto.empresaId,
          modulo: moduloLimpio,
          anio: this.state.contexto.anio,
        });
        if (capitulo) {
          params.set('capitulo', capitulo);
        }
        const resp = await fetch(
          `${API_BASE}/borradores/listar?${params.toString()}`,
          {
            headers: this._construirHeaders(),
          }
        );
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok)
          throw new Error(
            data.mensaje || "No fue posible obtener los borradores."
          );
        this._renderizarCentroBorradores(data.borradores || [], status, body);
      } catch (error) {
        status.className = "alert alert-danger";
        status.textContent =
          error.message || "Error al consultar los borradores.";
        body.innerHTML =
          '<tr><td colspan="5" class="text-center text-muted">Sin datos</td></tr>';
      }
    }

    /**
     * _renderizarCentroBorradores
     * Pinta la lista de borradores en la tabla simplificada
     * 
     * Tabla simplificada con 4 columnas:
     * 1. Estado - Badge con el estado actual del borrador
     * 2. Autor - Nombre del usuario que creó el borrador
     * 3. Fecha - Última actualización
     * 4. Acción - Botón para cargar el borrador en la tabla
     * 
     * @param {Array} lista - Array de borradores a mostrar
     * @param {HTMLElement} status - Elemento para mensajes de estado
     * @param {HTMLElement} body - tbody donde se pintarán las filas
     */
    _renderizarCentroBorradores(lista, status, body) {
      body.innerHTML = "";
      
      // Validar que hay borradores
      if (!Array.isArray(lista) || !lista.length) {
        status.className = "alert alert-warning";
        status.innerHTML = '<i class="bi bi-exclamation-triangle me-2"></i>No hay borradores disponibles para este contexto.';
        body.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">Sin borradores</td></tr>';
        return;
      }
      
      // Actualizar mensaje de estado
      status.className = "alert alert-success";
      status.innerHTML = `<i class="bi bi-check-circle me-2"></i>Se encontraron <strong>${lista.length}</strong> borrador(es). Haz clic en "Cargar" para visualizarlo.`;
      
      // Configurar evento delegado una sola vez
      if (!body.dataset.delegadoClick) {
        body.dataset.delegadoClick = "1";
        body.addEventListener("click", (ev) => {
          const boton = ev.target.closest("[data-borrador-id]");
          if (!boton) return;
          const id = Number(boton.dataset.borradorId);
          if (Number.isFinite(id)) this._verBorradorDesdeCentro(id);
        });
      }
      
      // Crear filas de la tabla (simplificadas)
      const frag = document.createDocumentFragment();
      lista.forEach((item) => {
        const row = document.createElement("tr");
        const etiquetaEstado = ETIQUETAS_ESTADO[item.estado] || item.estado;
        
        // Determinar color del badge según el estado
        let badgeClass = "bg-secondary";
        if (item.estado === "EDITANDO") badgeClass = "bg-info";
        else if (item.estado === "PENDIENTE") badgeClass = "bg-warning text-dark";
        else if (item.estado === "REVISADO") badgeClass = "bg-primary";
        else if (item.estado === "APROBADO") badgeClass = "bg-success";
        else if (item.estado === "RECHAZADO") badgeClass = "bg-danger";
        
        row.innerHTML = `
          <td>
            <span class="badge ${badgeClass}">${etiquetaEstado}</span>
          </td>
          <td>
            <div class="fw-semibold">${item.autorNombre || "Sin autor"}</div>
            <small class="text-muted">${item.autorUsuario || ""}</small>
          </td>
          <td>
            <small>${formatDateTime(item.fechaEnvio || item.fechaCreacion)}</small>
          </td>
          <td class="text-end">
            <button class="btn btn-sm btn-primary" data-borrador-id="${item.id}">
              <i class="bi bi-box-arrow-in-down me-1"></i>Cargar
            </button>
          </td>
        `;
        frag.appendChild(row);
      });
      
      body.appendChild(frag);
    }

    /**
     * _verBorradorDesdeCentro
     * Carga un borrador desde el Centro de Borradores y lo aplica a la tabla
     * 
     * Proceso:
     * 1. Solicita el detalle completo del borrador al servidor
     * 2. Cierra el drawer de borradores
     * 3. Pinta el borrador en la tabla (celdas en amarillo)
     * 4. Actualiza la información y botones del flujo
     * 
     * @param {number} borradorId - ID del borrador a cargar
     */
    async _verBorradorDesdeCentro(borradorId) {
      try {
        // Obtener detalle del borrador
        const resp = await fetch(
          `${API_BASE}/borradores/detalle/${borradorId}`,
          { headers: this._construirHeaders() }
        );
        const data = await resp.json().catch(() => ({}));
        
        if (!resp.ok)
          throw new Error(
            data.mensaje || "No fue posible cargar ese borrador."
          );
          
        this.state.borrador = data.borrador || null;
        if (!this.state.borrador)
          throw new Error("No se recibió información del borrador.");
        
        // Cerrar el drawer
        const drawer = document.getElementById("workflowDraftsDrawer");
        const offcanvas = drawer
          ? window.bootstrap?.Offcanvas?.getInstance(drawer)
          : null;
        offcanvas?.hide();
        
        // Pintar el borrador en la tabla
        const pintado = FlujoAutorizacion.pintarBorrador(
          this.tableElement,
          this.state.borrador
        );
        
        if (!pintado) {
          this._toast(
            "Borrador obtenido pero no se pudo aplicar sobre la tabla. Verifica data-columna-clave y cuentas coincidentes.",
            "warning"
          );
          return;
        }
        
        // Actualizar interfaz
        this._renderInfo();
        this._renderBotones();
        
        // Notificar éxito
        this._toast(
          `✓ Borrador cargado correctamente. Las celdas resaltadas muestran los cambios.`,
          "success"
        );
        
      } catch (error) {
        console.error("Ver borrador", error);
        this._toast(
          error.message || "No fue posible mostrar el borrador.",
          "danger"
        );
      }
    }

    async _descartarBorrador() {
      const contexto = { ...this.state.contexto };
      const borradorId = this.state.borrador?.id || null;
      // Mostrar modal de confirmación mejorado
      const confirmado = await this._mostrarConfirmacion({
        titulo: "🗑️ Descartar Borrador",
        mensaje: `¿Estás seguro de que deseas <strong>descartar</strong> este borrador?<br><small class="text-muted">Se perderán todos los cambios que no hayan sido guardados. Esta acción es irreversible.</small>`,
        etiquetaBoton: "Descartar",
        tipoBoton: "danger",
      });
      if (!confirmado) return;
      try {
        const body = JSON.stringify({
          borradorId,
          empresaId: contexto.empresaId,
          modulo: contexto.modulo,
          anio: contexto.anio,
        });
        const resp = await fetch(`${API_BASE}/borradores/descartar`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...this._construirHeaders(),
          },
          body,
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          throw new Error(
            data.mensaje || "No fue posible descartar el borrador."
          );
        }
        FlujoAutorizacion.limpiarBorrador(this.tableElement);
        this.state.borrador = null;
        this._exitEditMode(true);
        this._notificarEstadoBorrador(null);
        this._renderInfo();
        this._renderBotones();
        this._toast(data.mensaje || "Borrador descartado.", "info");
        this._refreshEstado();
      } catch (error) {
        console.error("Descartar borrador", error);
        this._toast(
          error.message || "No se pudo descartar el borrador.",
          "danger"
        );
      }
    }
  }

  FlujoAutorizacion.pintarBorrador = (tabla, datosBorrador) => {
    if (!tabla || !datosBorrador) return false;
    const filas = Array.from(tabla.querySelectorAll("tbody tr"));
    const cambios = Array.isArray(datosBorrador.data?.presupuesto)
      ? datosBorrador.data.presupuesto
      : [];
    if (!cambios.length) return false;
    const mapa = new Map();
    const normalizar = (valor) => {
      const canon = normalizarCuentaClave(valor);
      const limpio = (valor || "").toString().trim();
      return canon || limpio;
    };
    cambios.forEach((registro) => {
      const clave = normalizar(registro.cuenta);
      if (clave) mapa.set(clave, registro.valores || {});
    });
    if (!mapa.size) return false;
    FlujoAutorizacion.limpiarBorrador(tabla);
    filas.forEach((fila) => {
      const claveTabla = normalizar(
        fila.dataset.cuenta21 || fila.dataset.cuenta || ""
      );
      if (!claveTabla) return;
      const valores =
        mapa.get(claveTabla) ||
        mapa.get((fila.dataset.cuenta || "").toString().trim());
      if (!valores) return;
      Array.from(fila.cells).forEach((celda) => {
        const clave = celda.dataset.columnaClave;
        if (!clave || !Object.prototype.hasOwnProperty.call(valores, clave))
          return;
        if (celda.dataset.borradorValorOriginal == null) {
          celda.dataset.borradorValorOriginal = celda.textContent;
        }
        const raw = valores[clave];
        const numero = Number(raw);
        const texto = Number.isFinite(numero)
          ? FORMATTER_NUMEROS.format(numero)
          : String(raw || "");
        celda.textContent = texto;
        celda.classList.add("celda-borrador");
      });
    });
    return true;
  };

  FlujoAutorizacion.limpiarBorrador = (tabla) => {
    if (!tabla) return;
    const marcadas = Array.from(tabla.querySelectorAll(".celda-borrador"));
    marcadas.forEach((celda) => {
      if (celda.dataset.borradorValorOriginal != null) {
        celda.textContent = celda.dataset.borradorValorOriginal;
        delete celda.dataset.borradorValorOriginal;
      }
      celda.classList.remove("celda-borrador");
    });
  };

  const DraftHistoryCenter = (() => {
    const filtrosDraft = {
      estado: "",
      accion: "",
      usuario: "",
      buscar: "",
      desde: "",
      hasta: "",
    };
    const filtrosWorkflow = { ...filtrosDraft };
    const refs = { drafts: null, workflow: null };
    let vistaActual = "current";
    let contexto = {
      empresaId: null,
      modulo: document.body?.dataset?.modulo || "",
      anio: null,
    };
    let borradorEstado = null;
    let debounceDraft = null;
    let debounceWorkflow = null;

    const headers = () => headersAutenticacion();
    const textoEstado = (estado) =>
      ETIQUETAS_ESTADO[estado] || estado || "Sin estado";
    const textoAccion = (accion) =>
      HISTORIAL_ACCIONES[accion] || accion || "Movimiento";

    const asignarOpciones = (select, opciones, seleccionado) => {
      if (!select) return;
      const base = select.querySelector('option[value=""]');
      select.innerHTML = "";
      if (base) select.appendChild(base);
      else {
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = "Todos";
        select.appendChild(opt);
      }
      (opciones || []).forEach((item) => {
        const opt = document.createElement("option");
        opt.value = item.valor ?? item.id ?? "";
        opt.textContent = item.etiqueta || item.valor || item.id || "-";
        select.appendChild(opt);
      });
      select.value = seleccionado || "";
    };

    const renderTabla = (tbody, registros) => {
      if (!tbody) return;
      tbody.innerHTML = "";
      if (!Array.isArray(registros) || !registros.length) {
        tbody.innerHTML =
          '<tr><td colspan="5" class="text-center text-muted">Sin datos</td></tr>';
        return;
      }
      registros.forEach((registro) => {
        const fila = document.createElement("tr");
        fila.innerHTML = `
          <td>
            <div class="fw-semibold">${
              registro.accionEtiqueta || textoAccion(registro.accion)
            }</div>
            <div class="text-muted small">${registro.descripcion || ""}</div>
          </td>
          <td><span class="badge text-bg-light">${
            registro.estadoEtiqueta || textoEstado(registro.estado)
          }</span></td>
          <td>
            <div class="fw-semibold">${
              registro.usuario?.nombre || registro.usuario?.usuario || "-"
            }</div>
            <div class="text-muted small">${
              registro.usuario?.correo || ""
            }</div>
            <div class="text-muted small">${registro.modulo || ""}</div>
          </td>
          <td>${formatDateTime(registro.fecha)}</td>
          <td>${
            registro.comentarios
              ? `<div class="text-muted small">${registro.comentarios}</div>`
              : "-"
          }</td>
        `;
        tbody.appendChild(fila);
      });
    };

    const construirParams = (filtros) => {
      const params = new URLSearchParams({
        empresaId: contexto.empresaId,
        modulo: contexto.modulo,
        anio: contexto.anio,
        limite: "200",
      });
      if (filtros.estado) params.set("estado", filtros.estado);
      if (filtros.accion) params.set("accion", filtros.accion);
      if (filtros.usuario) params.set("usuarioId", filtros.usuario);
      if (filtros.buscar) params.set("buscar", filtros.buscar);
      if (filtros.desde) params.set("desde", filtros.desde);
      if (filtros.hasta) params.set("hasta", filtros.hasta);
      return params;
    };

    const hidratarContexto = () => {
      if (!contexto.empresaId && window.Sesion?.obtenerEmpresaActiva) {
        const empresa = window.Sesion.obtenerEmpresaActiva();
        if (empresa?.id) contexto.empresaId = empresa.id;
      }
      if (!contexto.modulo)
        contexto.modulo = document.body?.dataset?.modulo || "";
      if (!contexto.anio || Number(contexto.anio) < 2000) {
        const candidatos = [
          document.getElementById("selectAnio")?.value,
          document.getElementById("summaryYearSelect")?.value,
          document.getElementById("resumenYearSelect")?.value,
          document.getElementById("presupuestosYearSelect")?.value,
        ]
          .map((valor) => {
            const numero = Number(valor);
            return Number.isFinite(numero) && numero >= 2000 ? numero : null;
          })
          .filter((valor) => valor != null);
        contexto.anio = candidatos.length
          ? candidatos[0]
          : new Date().getFullYear();
      }
    };

    const cargarHistorial = async (target, filtros) => {
      hidratarContexto();
      if (!contexto.empresaId || !Number.isInteger(contexto.anio)) {
        if (target?.status) {
          target.status.className = "alert alert-info";
          target.status.textContent =
            "Selecciona empresa y ejercicio para consultar el historial.";
        }
        return null;
      }
      try {
        if (target?.status) {
          target.status.className = "alert alert-secondary";
          target.status.textContent = "Cargando información...";
        }
        const resp = await fetch(
          `${API_BASE}/borradores/historial?${construirParams(
            filtros
          ).toString()}`,
          { headers: headers() }
        );
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok)
          throw new Error(
            data.mensaje || "No fue posible consultar el historial."
          );
        if (target?.status) {
          target.status.className = "alert alert-success";
          target.status.textContent = `Historial disponible (${
            data.historial?.length || 0
          } registros).`;
        }
        renderTabla(target?.tbody, data.historial || []);
        asignarOpciones(
          target?.state,
          data.filtros?.estados || [],
          filtros.estado
        );
        asignarOpciones(
          target?.action,
          data.filtros?.acciones || [],
          filtros.accion
        );
        asignarOpciones(
          target?.user,
          data.filtros?.usuarios || [],
          filtros.usuario
        );
        return data;
      } catch (error) {
        console.error("Historial borradores", error);
        if (target?.status) {
          target.status.className = "alert alert-danger";
          target.status.textContent =
            error.message || "No fue posible consultar el historial.";
        }
        renderTabla(target?.tbody, []);
        return null;
      }
    };

    const vincularFiltros = (refsFiltros, filtros, onChange) => {
      if (!refsFiltros) return;
      const { search, state, action, user, from, to } = refsFiltros;
      if (search)
        search.addEventListener("input", () => {
          filtros.buscar = search.value.trim();
          onChange("search");
        });
      if (state)
        state.addEventListener("change", () => {
          filtros.estado = state.value;
          onChange();
        });
      if (action)
        action.addEventListener("change", () => {
          filtros.accion = action.value;
          onChange();
        });
      if (user)
        user.addEventListener("change", () => {
          filtros.usuario = user.value;
          onChange();
        });
      if (from)
        from.addEventListener("change", () => {
          filtros.desde = from.value;
          onChange();
        });
      if (to)
        to.addEventListener("change", () => {
          filtros.hasta = to.value;
          onChange();
        });
    };

    const renderResumenWorkflow = () => {
      if (!refs.workflow) return;
      if (refs.workflow.badge)
        refs.workflow.badge.textContent = textoEstado(
          borradorEstado?.estado || "SIN_CARGAR"
        );
      if (refs.workflow.state)
        refs.workflow.state.textContent = textoEstado(
          borradorEstado?.estado || "Sin datos"
        );
      if (refs.workflow.meta) {
        const partes = [];
        if (borradorEstado?.autorNombre)
          partes.push(borradorEstado.autorNombre);
        if (borradorEstado?.fechaEnvio)
          partes.push(formatDateTime(borradorEstado.fechaEnvio));
        refs.workflow.meta.textContent = partes.join(" · ");
      }
    };

    const init = () => {
      ensureDraftsDrawer();
      ensureWorkflowDrawer();
      if (document.getElementById("workflowDraftsDrawer")) {
        refs.drafts = {
          el: document.getElementById("workflowDraftsDrawer"),
          status: document.getElementById("draftsCenterStatus"),
          tabs: document.querySelectorAll("[data-drafts-tab]"),
          views: document.querySelectorAll("[data-drafts-view]"),
          history: {
            status: document.getElementById("draftHistoryStatus"),
            tbody: document.getElementById("draftHistoryTableBody"),
            search: document.getElementById("draftHistorySearch"),
            state: document.getElementById("draftHistoryState"),
            action: document.getElementById("draftHistoryAction"),
            user: document.getElementById("draftHistoryUser"),
            from: document.getElementById("draftHistoryFrom"),
            to: document.getElementById("draftHistoryTo"),
          },
        };
        refs.drafts.tabs.forEach((btn) => {
          btn.addEventListener("click", () => {
            const vista = btn.dataset.draftsTab;
            if (vista === vistaActual) return;
            vistaActual = vista;
            refs.drafts.tabs.forEach((tab) =>
              tab.classList.toggle("active", tab === btn)
            );
            refs.drafts.views.forEach((view) =>
              view.classList.toggle(
                "d-none",
                view.dataset.draftsView !== vistaActual
              )
            );
            if (vistaActual === "history")
              cargarHistorial(refs.drafts.history, filtrosDraft);
          });
        });
        vincularFiltros(refs.drafts.history, filtrosDraft, (tipo) => {
          clearTimeout(debounceDraft);
          if (tipo === "search")
            debounceDraft = setTimeout(
              () => cargarHistorial(refs.drafts.history, filtrosDraft),
              400
            );
          else cargarHistorial(refs.drafts.history, filtrosDraft);
        });
      }

      const workflowDrawer = document.getElementById("workflowDrawer");
      if (workflowDrawer) {
        refs.workflow = {
          el: workflowDrawer,
          badge: document.getElementById("workflowCurrentBadge"),
          state: document.getElementById("workflowCurrentState"),
          meta: document.getElementById("workflowCurrentMeta"),
          status: document.getElementById("workflowHistoryStatus"),
          tbody: document.getElementById("workflowHistoryTableBody"),
          filters: {
            search: document.getElementById("workflowHistorySearch"),
            state: document.getElementById("workflowHistoryState"),
            action: document.getElementById("workflowHistoryAction"),
            user: document.getElementById("workflowHistoryUser"),
            from: document.getElementById("workflowHistoryFrom"),
            to: document.getElementById("workflowHistoryTo"),
          },
        };
        workflowDrawer.addEventListener("show.bs.offcanvas", () => {
          cargarHistorial(refs.workflow, filtrosWorkflow);
          renderResumenWorkflow();
        });
        vincularFiltros(refs.workflow.filters, filtrosWorkflow, (tipo) => {
          clearTimeout(debounceWorkflow);
          if (tipo === "search")
            debounceWorkflow = setTimeout(
              () => cargarHistorial(refs.workflow, filtrosWorkflow),
              400
            );
          else cargarHistorial(refs.workflow, filtrosWorkflow);
        });
      }

      window.addEventListener(EVENTO_CONTEXTO, (event) => {
        const detalle = event?.detail || {};
        contexto = {
          empresaId: detalle.empresaId || contexto.empresaId,
          modulo: detalle.modulo || contexto.modulo,
          anio: Number.isInteger(Number(detalle.anio))
            ? Number(detalle.anio)
            : contexto.anio,
        };
      });
      window.addEventListener(
        "flujo-autorizacion:estado-actualizado",
        (event) => {
          borradorEstado = event?.detail?.borrador || null;
          renderResumenWorkflow();
        }
      );
    };

    return { init };
  })();

  const renderWorkflowGuide = (() => {
    let cache = null;
    let loading = null;
    const fetchGuide = async () => {
      if (cache) return cache;
      if (loading) return loading;
      const url = new URL(
        "componentes/flujo-autorizacion.html",
        window.location.href
      );
      loading = fetch(url.href)
        .then((resp) => {
          if (!resp.ok) throw new Error("No se pudo cargar la guía de flujo.");
          return resp.text();
        })
        .then((html) => {
          cache = html;
          return html;
        })
        .catch(() => "")
        .finally(() => {
          loading = null;
        });
      return loading;
    };
    return async () => {
      const contenedores = document.querySelectorAll(
        ".workflow-drawer .offcanvas-body"
      );
      if (!contenedores.length) return;
      const html = await fetchGuide();
      if (!html) return;
      contenedores.forEach((contenedor) => {
        const anchor =
          contenedor.querySelector(".workflow-guide-anchor") || contenedor;
        if (anchor.querySelector(".workflow-guide")) return;
        const wrapper = document.createElement("div");
        wrapper.className = "workflow-guide-wrapper mt-3";
        wrapper.innerHTML = html;
        anchor.appendChild(wrapper);
      });
    };
  })();

  const vincularAccesosRapidos = () => {
    const asegurarWorkflowDrawer = () => {
      const drawer = ensureWorkflowDrawer();
      const elemento = drawer || document.getElementById("workflowDrawer");
      if (elemento) {
        try {
          elemento.setAttribute("data-bs-scroll", "true");
          // Solo inicializamos si bootstrap está disponible, pero no detenemos flujo si no
          if (window.bootstrap?.Offcanvas) {
            window.bootstrap.Offcanvas.getOrCreateInstance(elemento);
          }
        } catch (e) {
          console.warn("Error init bootstrap offcanvas", e);
        }
      }
      return elemento;
    };

    // Asegurar que existan los elementos en el DOM inmediatamente
    asegurarWorkflowDrawer();
    ensureDraftsDrawer();

    document.querySelectorAll(".workflow-toggle").forEach((btn) => {
      if (btn.dataset.workflowBound === "1") return;
      btn.dataset.workflowBound = "1";
      btn.classList.remove("disabled");
      btn.removeAttribute("disabled");
      btn.setAttribute("aria-disabled", "false");

      // Resiliencia: Asegurar que tenga el target correcto
      if (!btn.hasAttribute("data-bs-toggle")) {
        btn.setAttribute("data-bs-toggle", "offcanvas");
      }
      if (!btn.getAttribute("data-bs-target") && !btn.getAttribute("href")) {
        btn.setAttribute("data-bs-target", "#workflowDrawer");
      }

      btn.addEventListener("click", () => {
        // Solo aseguramos que existe, dejamos que Bootstrap maneje el toggle
        asegurarWorkflowDrawer();
      });
    });

    const abrirCentroBorradores = () => {
      ensureDraftsDrawer();
      const instancia = window.__flujoAutorizacionInstance;
      // Intento robusto de abrir
      try {
        const drawer = document.getElementById("workflowDraftsDrawer");
        if (drawer && window.bootstrap?.Offcanvas) {
          const offcanvas =
            window.bootstrap.Offcanvas.getOrCreateInstance(drawer);
          offcanvas.show();
        }
        // Inicializar lógica si es posible
        if (instancia?.init) {
          instancia.init();
          instancia._mostrarCentroBorradores(); // Esto solo actualiza la vista interna
        }
      } catch (e) {
        console.error("Error abriendo centro borradores", e);
      }
    };

    document
      .querySelectorAll("#btnVerBorrador, [data-open-drafts-center]")
      .forEach((btn) => {
        if (btn.dataset.draftsBound === "1") return;
        btn.dataset.draftsBound = "1";
        btn.classList.remove("disabled");
        btn.removeAttribute("disabled");
        btn.setAttribute("aria-disabled", "false");

        // Asignar atributos nativos para resiliencia
        if (!btn.hasAttribute("data-bs-toggle")) {
          btn.setAttribute("data-bs-toggle", "offcanvas");
        }
        if (!btn.getAttribute("data-bs-target")) {
          btn.setAttribute("data-bs-target", "#workflowDraftsDrawer");
        }

        btn.addEventListener("click", (event) => {
          // Dejamos que bootstrap lo abra si tiene los atributos.
          // Pero 'abrirCentroBorradores' tiene logica extra de inicializacion.
          // Lo ejecutamos tambien.
          abrirCentroBorradores();
        });
      });
  };

  const autoInit = () => {
    if (!window.__flujoAutorizacionInstance) {
      window.__flujoAutorizacionInstance = new FlujoAutorizacion();
    }
    const instancia = window.__flujoAutorizacionInstance;
    instancia?.init();
    DraftHistoryCenter.init();
    renderWorkflowGuide();
    vincularAccesosRapidos();
  };

  const aplicarFixModalesPointerEvents = () => {
    const limpiarPointerEvents = (elemento) => {
      if (!elemento) return;
      elemento.style.pointerEvents = "none";
    };

    const habilitarPointerEvents = (elemento) => {
      if (!elemento) return;
      elemento.style.pointerEvents = "auto";
    };

    const limpiarBackdrops = () => {
      document
        .querySelectorAll(".modal-backdrop, .offcanvas-backdrop")
        .forEach((backdrop) => {
          const hayVisible = document.querySelector(
            ".modal.show, .offcanvas.show"
          );
          if (!hayVisible) {
            backdrop.remove();
          } else {
            backdrop.style.pointerEvents = "auto";
          }
        });
    };

    const procesarModal = (modal) => {
      if (!modal || modal.dataset.pointerFixBound === "1") return;
      modal.dataset.pointerFixBound = "1";
      modal.addEventListener("show.bs.modal", () =>
        habilitarPointerEvents(modal)
      );
      modal.addEventListener("shown.bs.modal", () =>
        habilitarPointerEvents(modal)
      );
      modal.addEventListener("hidden.bs.modal", () => {
        limpiarPointerEvents(modal);
        limpiarBackdrops();
      });
      if (!modal.classList.contains("show")) {
        limpiarPointerEvents(modal);
      }
    };

    const procesarOffcanvas = (offcanvas) => {
      if (!offcanvas || offcanvas.dataset.pointerFixBound === "1") return;
      offcanvas.dataset.pointerFixBound = "1";
      offcanvas.addEventListener("show.bs.offcanvas", () =>
        habilitarPointerEvents(offcanvas)
      );
      offcanvas.addEventListener("shown.bs.offcanvas", () =>
        habilitarPointerEvents(offcanvas)
      );
      offcanvas.addEventListener("hidden.bs.offcanvas", () => {
        limpiarPointerEvents(offcanvas);
        limpiarBackdrops();
      });
      if (!offcanvas.classList.contains("show")) {
        limpiarPointerEvents(offcanvas);
      }
    };

    const vincularEventos = () => {
      document.querySelectorAll(".modal").forEach(procesarModal);
      document.querySelectorAll(".offcanvas").forEach(procesarOffcanvas);
    };

    const observarNuevosContenedores = () => {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (!(node instanceof HTMLElement)) return;
            if (node.classList.contains("modal")) {
              procesarModal(node);
            } else if (node.classList.contains("offcanvas")) {
              procesarOffcanvas(node);
            } else {
              node.querySelectorAll?.(".modal").forEach(procesarModal);
              node.querySelectorAll?.(".offcanvas").forEach(procesarOffcanvas);
            }
          });
        });
      });
      observer.observe(document.body, { childList: true, subtree: true });
    };

    const intentarInicializar = () => {
      if (!window.bootstrap) {
        return false;
      }
      vincularEventos();
      observarNuevosContenedores();
      limpiarBackdrops();
      setInterval(limpiarBackdrops, 2000);
      return true;
    };

    if (!intentarInicializar()) {
      const esperaBootstrap = setInterval(() => {
        if (intentarInicializar()) {
          clearInterval(esperaBootstrap);
        }
      }, 100);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoInit, { once: true });
  } else {
    autoInit();
  }

  aplicarFixModalesPointerEvents();
  
  // Exportar la clase FlujoAutorizacion para uso externo
  window.FlujoAutorizacion = FlujoAutorizacion;
})();
