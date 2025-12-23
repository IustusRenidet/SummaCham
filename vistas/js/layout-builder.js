/**
 * layout-builder.js
 * Constructor visual de layouts con drag-and-drop
 * Permite personalizar completamente la estructura del reporte
 */

(() => {
  'use strict';

  // ==========================================
  // CONFIG & STATE
  // ==========================================
  const API_BASE = window.location.protocol === 'file:'
    ? 'http://localhost:3005/api'
    : `${window.location.origin.replace(/\/$/, '')}/api`;

  const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

  const state = {
    modulo: '',
    anio: null,
    capitulo: '',
    empresaId: '',
    layout: null,
    cuentas: [],
    operaciones: [],
    secciones: [],
    selectedElement: null,
    unsavedChanges: false,
    zoomLevel: 100,
    viewMode: 'table',
    expandedSections: new Set()
  };

  // DOM Elements
  const dom = {};

  // ==========================================
  // INITIALIZATION
  // ==========================================
  function init() {
    cacheDomElements();
    bindEventListeners();
    initSortable();
    loadInitialData();
    checkAuthState();
    setInterval(checkAuthState, 3000);
  }

  function cacheDomElements() {
    dom.moduloSelect = document.getElementById('moduloSelect');
    dom.anioSelect = document.getElementById('anioSelect');
    dom.capituloSelect = document.getElementById('capituloSelect');
    dom.btnCargarLayout = document.getElementById('btnCargarLayout');
    dom.btnGuardarTodo = document.getElementById('btnGuardarTodo');
    dom.canvasContent = document.getElementById('canvasContent');
    dom.propertiesPanel = document.getElementById('propertiesPanel');
    dom.propertiesContent = document.getElementById('propertiesContent');
    dom.contextMenu = document.getElementById('contextMenu');
    dom.authStatus = document.getElementById('authStatus');
    dom.statusText = document.getElementById('statusText');
    dom.statPrincipales = document.getElementById('statPrincipales');
    dom.statSecundarias = document.getElementById('statSecundarias');
    dom.statCuentas = document.getElementById('statCuentas');
    dom.statOperaciones = document.getElementById('statOperaciones');
    dom.btnExpandAll = document.getElementById('btnExpandAll');
    dom.btnCollapseAll = document.getElementById('btnCollapseAll');
    dom.btnZoomIn = document.getElementById('btnZoomIn');
    dom.btnZoomOut = document.getElementById('btnZoomOut');
    dom.btnCloseProperties = document.getElementById('btnCloseProperties');
  }

  function bindEventListeners() {
    // Config selectors
    dom.moduloSelect?.addEventListener('change', handleModuloChange);
    dom.anioSelect?.addEventListener('change', handleAnioChange);
    dom.capituloSelect?.addEventListener('change', handleCapituloChange);

    // Action buttons
    dom.btnCargarLayout?.addEventListener('click', cargarLayout);
    dom.btnGuardarTodo?.addEventListener('click', guardarTodo);
    dom.btnExpandAll?.addEventListener('click', expandirTodo);
    dom.btnCollapseAll?.addEventListener('click', colapsarTodo);
    dom.btnZoomIn?.addEventListener('click', () => ajustarZoom(10));
    dom.btnZoomOut?.addEventListener('click', () => ajustarZoom(-10));
    dom.btnCloseProperties?.addEventListener('click', () => {
      dom.propertiesPanel?.classList.add('collapsed');
    });

    // View mode
    document.querySelectorAll('input[name="viewMode"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        state.viewMode = e.target.value;
        renderPreview();
      });
    });

    // Context menu
    document.addEventListener('click', () => hideContextMenu());
    document.addEventListener('contextmenu', handleContextMenu);

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboard);

    // Toolbox drag events
    document.querySelectorAll('.toolbox-item').forEach(item => {
      item.addEventListener('dragstart', handleToolboxDragStart);
      item.addEventListener('dragend', handleToolboxDragEnd);
    });

    // Modal events
    document.getElementById('btnSaveElement')?.addEventListener('click', saveEditedElement);
    document.getElementById('btnDeleteElement')?.addEventListener('click', deleteElement);
    document.getElementById('btnAddElement')?.addEventListener('click', addNewElement);
    document.getElementById('btnSaveOperation')?.addEventListener('click', saveOperation);

    // Prevent losing unsaved changes
    window.addEventListener('beforeunload', (e) => {
      if (state.unsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  }

  function initSortable() {
    // Will be initialized when layout is loaded
  }

  // ==========================================
  // AUTH & PERMISSIONS
  // ==========================================
  function checkAuthState() {
    const allowed = isEditModeAllowed();
    if (dom.authStatus) {
      if (allowed) {
        dom.authStatus.className = 'badge bg-success';
        dom.authStatus.textContent = 'Modo edición activo';
      } else {
        dom.authStatus.className = 'badge bg-warning';
        dom.authStatus.textContent = 'Solo lectura';
      }
    }
    if (dom.btnGuardarTodo) {
      dom.btnGuardarTodo.disabled = !allowed || !state.unsavedChanges;
    }
  }

  function isEditModeAllowed() {
    const flujo = window.__flujoAutorizacionInstance || window.parent?.__flujoAutorizacionInstance;
    const modoEdicionApi = window.ModoEdicionPresupuesto || window.parent?.ModoEdicionPresupuesto;
    const estadosPermitidos = ['EDITANDO', 'BORRADOR', 'CARGANDO'];
    let modoEdicion = false;
    let estado = 'SIN_CARGAR';

    if (flujo) {
      estado = flujo.state?.borrador?.estado || 'SIN_CARGAR';
      modoEdicion = Boolean(flujo.state?.editMode);
    }

    if (!modoEdicion && modoEdicionApi?.estaActivo) {
      modoEdicion = modoEdicionApi.estaActivo();
      if (modoEdicion) estado = 'EDITANDO';
    }

    if (!flujo && !modoEdicionApi) {
      return false;
    }

    return modoEdicion && estadosPermitidos.includes(estado);
  }

  function getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (window.Sesion?.headersAutenticacion) {
      Object.assign(headers, window.Sesion.headersAutenticacion());
    } else if (window.parent?.Sesion?.headersAutenticacion) {
      Object.assign(headers, window.parent.Sesion.headersAutenticacion());
    }
    return headers;
  }

  // ==========================================
  // DATA LOADING
  // ==========================================
  async function loadInitialData() {
    state.modulo = dom.moduloSelect?.value || 'RESUMEN';
    state.empresaId = getEmpresaId();
    await cargarAnios();
  }

  function getEmpresaId() {
    const selector = window.parent?.document?.querySelector('.company-selector select')
      || document.querySelector('.company-selector select');
    return selector?.value || 'EMPRESA01';
  }

  function getCapituloFromSelector() {
    const selector = window.parent?.document?.querySelector('.company-selector select')
      || document.querySelector('.company-selector select');
    if (!selector) return '';
    const empresaId = selector.value;
    if (window.CapitulosModulos?.empresaACapitulo) {
      const capitulo = window.CapitulosModulos.empresaACapitulo(empresaId);
      if (capitulo) return capitulo;
    }
    const opt = selector.selectedOptions?.[0];
    return opt?.textContent?.toString().trim() || empresaId || '';
  }

  async function cargarAnios() {
    setStatus('Cargando años...');
    try {
      const url = `${API_BASE}/layouts-config/${encodeURIComponent(state.modulo)}/anios?empresaId=${encodeURIComponent(state.empresaId)}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Error al cargar años');
      const data = await res.json();
      const anios = (data.anios || []).sort((a, b) => b - a);

      if (dom.anioSelect) {
        dom.anioSelect.innerHTML = anios.length
          ? anios.map(a => `<option value="${a}">${a}</option>`).join('')
          : '<option value="">Sin años</option>';
        state.anio = anios[0] || null;
      }

      await cargarCapitulos();
      setStatus('Listo');
    } catch (error) {
      console.error('Error cargando años:', error);
      setStatus('Error al cargar años');
    }
  }

  async function cargarCapitulos() {
    if (!state.anio) return;
    try {
      const url = `${API_BASE}/layouts-config/${encodeURIComponent(state.modulo)}/${state.anio}/capitulos?empresaId=${encodeURIComponent(state.empresaId)}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Error al cargar capítulos');
      const data = await res.json();
      const capitulos = data.capitulos || [];

      // Get current chapter from selector
      const capituloActual = getCapituloFromSelector();

      if (dom.capituloSelect) {
        dom.capituloSelect.innerHTML = '<option value="">Seleccionar...</option>';
        capitulos.forEach(cap => {
          const opt = document.createElement('option');
          opt.value = cap;
          opt.textContent = cap;
          if (cap === capituloActual) opt.selected = true;
          dom.capituloSelect.appendChild(opt);
        });
        state.capitulo = dom.capituloSelect.value || capitulos[0] || '';
      }
    } catch (error) {
      console.error('Error cargando capítulos:', error);
    }
  }

  async function cargarLayout() {
    state.modulo = dom.moduloSelect?.value || state.modulo;
    state.anio = dom.anioSelect?.value || state.anio;
    state.capitulo = dom.capituloSelect?.value || getCapituloFromSelector();

    if (!state.modulo || !state.anio || !state.capitulo) {
      showToast('Selecciona módulo, año y capítulo', 'warning');
      return;
    }

    setStatus('Cargando layout...');
    try {
      const url = `${API_BASE}/layouts-config/${encodeURIComponent(state.modulo)}/${state.anio}/${encodeURIComponent(state.capitulo)}?empresaId=${encodeURIComponent(state.empresaId)}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Error al cargar layout');
      const data = await res.json();

      state.layout = data.layout || {};
      state.cuentas = state.layout.cuentas || [];
      state.operaciones = state.layout.operaciones || [];
      state.secciones = extraerSecciones(state.cuentas);

      renderPreview();
      updateStats();
      setStatus(`Layout cargado: ${state.cuentas.length} cuentas`);
      showToast('Layout cargado correctamente', 'success');
    } catch (error) {
      console.error('Error cargando layout:', error);
      setStatus('Error al cargar layout');
      showToast('Error al cargar el layout', 'danger');
    }
  }

  function extraerSecciones(cuentas) {
    const principalesMap = new Map();
    const secundariasMap = new Map();

    cuentas.forEach(cuenta => {
      const principal = cuenta['SECCIÓN Principal'] || cuenta['SECCIàN Principal'] || cuenta.seccion_principal || '';
      const secundaria = cuenta['SECCION Secundaria'] || cuenta['SECCIÓN Secundaria'] || cuenta.seccion_secundaria || '';

      if (principal && !principalesMap.has(principal)) {
        principalesMap.set(principal, { nombre: principal, tipo: 'principal', secundarias: [] });
      }

      if (secundaria && principal) {
        const key = `${principal}::${secundaria}`;
        if (!secundariasMap.has(key)) {
          secundariasMap.set(key, { nombre: secundaria, tipo: 'secundaria', principal });
          principalesMap.get(principal)?.secundarias.push(secundaria);
        }
      }
    });

    return {
      principales: Array.from(principalesMap.values()),
      secundarias: Array.from(secundariasMap.values())
    };
  }

  // ==========================================
  // RENDERING
  // ==========================================
  function renderPreview() {
    if (!state.cuentas.length) {
      dom.canvasContent.innerHTML = `
        <div class="preview-placeholder">
          <i class="bi bi-layout-text-window-reverse"></i>
          <h5>Sin datos para mostrar</h5>
          <p>Carga un layout para comenzar a editarlo.</p>
        </div>
      `;
      return;
    }

    if (state.viewMode === 'table') {
      renderTableView();
    } else {
      renderTreeView();
    }

    initRowSortable();
  }

  function renderTableView() {
    const yearShort = state.anio ? String(state.anio).slice(-2) : '--';
    const rows = buildLayoutRows();

    const html = `
      <div class="preview-table-container" style="transform: scale(${state.zoomLevel / 100})">
        <table class="preview-table">
          <thead>
            <tr>
              <th style="width: 40px"></th>
              <th style="width: 160px">Cuenta</th>
              <th>Descripción</th>
              <th style="width: 120px">PPTO ${state.anio || '--'}</th>
              ${MESES.map(m => `
                <th style="width: 90px">PPTO ${m}-${yearShort}</th>
                <th style="width: 90px">REAL ${m}-${yearShort}</th>
              `).join('')}
            </tr>
          </thead>
          <tbody id="layoutTableBody">
            ${rows.map((row, index) => renderTableRow(row, index)).join('')}
          </tbody>
        </table>
      </div>
    `;

    dom.canvasContent.innerHTML = html;
  }

  function buildLayoutRows() {
    const rows = [];
    const cuentasOrdenadas = [...state.cuentas].sort((a, b) => (a.orden || 0) - (b.orden || 0));

    let principalActual = '';
    let secundariaActual = '';
    const principalesVistas = new Set();
    const secundariasVistas = new Set();

    cuentasOrdenadas.forEach((cuenta, idx) => {
      const principal = cuenta['SECCIÓN Principal'] || cuenta['SECCIàN Principal'] || cuenta.seccion_principal || '';
      const secundaria = cuenta['SECCION Secundaria'] || cuenta['SECCIÓN Secundaria'] || cuenta.seccion_secundaria || '';
      const codigo = (cuenta.CUENTA || '').toString().trim();
      const nombre = cuenta.NOMBRE || cuenta.nombre || '';

      // Check if this is a section row or sum row
      const esFilaEspecial = !codigo || codigo === 'SUM' || codigo.toUpperCase() === 'SUM';

      // Insert principal section header
      if (principal && !principalesVistas.has(principal)) {
        principalesVistas.add(principal);
        principalActual = principal;

        // Sum row for previous section if needed
        if (secundariaActual && rows.length > 0) {
          rows.push({
            tipo: 'sum',
            seccion: secundariaActual,
            nombre: `Suma ${secundariaActual}`,
            indent: 2
          });
        }

        rows.push({
          tipo: 'principal',
          nombre: principal,
          indent: 0,
          data: { principal }
        });
      }

      // Insert secondary section header
      if (secundaria && !secundariasVistas.has(`${principal}::${secundaria}`)) {
        secundariasVistas.add(`${principal}::${secundaria}`);

        // Sum row for previous secondary section
        if (secundariaActual && secundariaActual !== secundaria) {
          rows.push({
            tipo: 'sum',
            seccion: secundariaActual,
            nombre: `Suma ${secundariaActual}`,
            indent: 2
          });
        }

        secundariaActual = secundaria;
        rows.push({
          tipo: 'secundaria',
          nombre: secundaria,
          principal: principal,
          indent: 1,
          data: { principal, secundaria }
        });
      }

      // Account row
      if (!esFilaEspecial) {
        rows.push({
          tipo: 'cuenta',
          cuenta: codigo,
          nombre: nombre,
          principal: principal,
          secundaria: secundaria,
          indent: 2,
          data: cuenta,
          originalIndex: idx
        });
      } else if (codigo === 'SUM' || nombre.toLowerCase().includes('suma')) {
        rows.push({
          tipo: 'sum',
          nombre: nombre || `Suma ${secundaria || principal}`,
          seccion: secundaria || principal,
          indent: nombre.toLowerCase().includes('total') ? 1 : 2,
          data: cuenta
        });
      }
    });

    // Add operations
    state.operaciones.forEach((op, idx) => {
      const tipo = detectarTipoOperacion(op);
      rows.push({
        tipo: tipo,
        nombre: op.Clase || op.SECCION || 'Operación',
        data: op,
        operacionIndex: idx,
        indent: 0
      });
    });

    return rows;
  }

  function detectarTipoOperacion(op) {
    const keys = Object.keys(op);
    if (keys.some(k => k.includes('net-row'))) return 'net';
    if (keys.some(k => k.includes('result-row'))) return 'result';
    if (keys.some(k => k.includes('sum-row'))) return 'sum';
    return 'operacion';
  }

  function renderTableRow(row, index) {
    const rowClass = getRowClass(row.tipo);
    const indentClass = `indent-${row.indent || 0}`;

    const celdaVacia = '<td class="col-numeric">-</td>';
    const celdasNumericas = new Array(1 + MESES.length * 2).fill(celdaVacia).join('');

    return `
      <tr class="preview-row ${rowClass}"
          data-index="${index}"
          data-tipo="${row.tipo}"
          data-original-index="${row.originalIndex ?? ''}"
          draggable="true">
        <td>
          <span class="drag-handle"><i class="bi bi-grip-vertical"></i></span>
        </td>
        <td class="${indentClass}">
          ${row.cuenta || ''}
          ${getTypeBadge(row.tipo)}
        </td>
        <td>
          ${row.tipo === 'principal' || row.tipo === 'secundaria' ? `<span class="collapse-toggle" data-section="${row.nombre}"></span>` : ''}
          ${escapeHtml(row.nombre || '')}
          <div class="row-actions">
            <button class="row-action-btn edit" onclick="LayoutBuilder.editRow(${index})" title="Editar">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="row-action-btn delete" onclick="LayoutBuilder.confirmDeleteRow(${index})" title="Eliminar">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>
        ${celdasNumericas}
      </tr>
    `;
  }

  function getRowClass(tipo) {
    const classes = {
      principal: 'row-principal',
      secundaria: 'row-secundaria',
      cuenta: 'row-cuenta',
      sum: 'row-sum',
      result: 'row-result',
      net: 'row-net',
      total: 'row-total',
      operacion: 'row-sum'
    };
    return classes[tipo] || 'row-cuenta';
  }

  function getTypeBadge(tipo) {
    const badges = {
      principal: '<span class="type-badge principal">PRINCIPAL</span>',
      secundaria: '<span class="type-badge secundaria">SECUNDARIA</span>',
      sum: '<span class="type-badge sum">SUMA</span>',
      result: '<span class="type-badge result">RESULTADO</span>',
      net: '<span class="type-badge net">NETO</span>'
    };
    return badges[tipo] || '';
  }

  function renderTreeView() {
    const tree = buildTreeStructure();
    dom.canvasContent.innerHTML = `
      <div class="tree-view">
        ${renderTreeNode(tree, 0)}
      </div>
    `;
  }

  function buildTreeStructure() {
    const tree = { children: [] };
    const principalMap = new Map();

    state.cuentas.forEach(cuenta => {
      const principal = cuenta['SECCIÓN Principal'] || cuenta['SECCIàN Principal'] || cuenta.seccion_principal || 'Sin Sección';
      const secundaria = cuenta['SECCION Secundaria'] || cuenta['SECCIÓN Secundaria'] || cuenta.seccion_secundaria || '';

      if (!principalMap.has(principal)) {
        principalMap.set(principal, { name: principal, children: new Map() });
        tree.children.push(principalMap.get(principal));
      }

      const principalNode = principalMap.get(principal);
      if (secundaria) {
        if (!principalNode.children.has(secundaria)) {
          principalNode.children.set(secundaria, { name: secundaria, cuentas: [] });
        }
        principalNode.children.get(secundaria).cuentas.push(cuenta);
      }
    });

    return tree;
  }

  function renderTreeNode(node, level) {
    if (!node.children || node.children.length === 0) return '';

    return node.children.map(child => {
      const isExpanded = state.expandedSections.has(child.name);
      return `
        <div class="tree-node" data-level="${level}">
          <div class="tree-node-header ${level === 0 ? 'principal' : 'secundaria'}"
               onclick="LayoutBuilder.toggleSection('${escapeHtml(child.name)}')">
            <i class="bi ${isExpanded ? 'bi-chevron-down' : 'bi-chevron-right'}"></i>
            <span>${escapeHtml(child.name)}</span>
            <span class="badge bg-secondary">${child.children?.size || child.cuentas?.length || 0}</span>
          </div>
          ${isExpanded ? `
            <div class="tree-node-children">
              ${child.children instanceof Map
                ? Array.from(child.children.values()).map(c => renderTreeNode({ children: [c] }, level + 1)).join('')
                : child.cuentas?.map(c => `
                    <div class="tree-leaf">
                      <code>${c.CUENTA || ''}</code> ${escapeHtml(c.NOMBRE || '')}
                    </div>
                  `).join('')
              }
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  function updateStats() {
    const principales = new Set();
    const secundarias = new Set();
    let cuentasCount = 0;

    state.cuentas.forEach(cuenta => {
      const principal = cuenta['SECCIÓN Principal'] || cuenta['SECCIàN Principal'] || cuenta.seccion_principal;
      const secundaria = cuenta['SECCION Secundaria'] || cuenta['SECCIÓN Secundaria'] || cuenta.seccion_secundaria;
      const codigo = cuenta.CUENTA;

      if (principal) principales.add(principal);
      if (secundaria) secundarias.add(`${principal}::${secundaria}`);
      if (codigo && codigo !== 'SUM') cuentasCount++;
    });

    if (dom.statPrincipales) dom.statPrincipales.textContent = principales.size;
    if (dom.statSecundarias) dom.statSecundarias.textContent = secundarias.size;
    if (dom.statCuentas) dom.statCuentas.textContent = cuentasCount;
    if (dom.statOperaciones) dom.statOperaciones.textContent = state.operaciones.length;
  }

  // ==========================================
  // DRAG & DROP
  // ==========================================
  function initRowSortable() {
    const tbody = document.getElementById('layoutTableBody');
    if (!tbody || typeof Sortable === 'undefined') return;

    new Sortable(tbody, {
      animation: 150,
      handle: '.drag-handle',
      ghostClass: 'dragging',
      chosenClass: 'selected',
      dragClass: 'drag-over',
      onEnd: (evt) => {
        handleRowReorder(evt.oldIndex, evt.newIndex);
      }
    });
  }

  function handleToolboxDragStart(e) {
    const type = e.target.dataset.type;
    e.dataTransfer.setData('text/plain', type);
    e.dataTransfer.effectAllowed = 'copy';
    dom.canvasContent?.classList.add('drop-zone', 'active');
  }

  function handleToolboxDragEnd() {
    dom.canvasContent?.classList.remove('drop-zone', 'active');
  }

  function handleRowReorder(oldIndex, newIndex) {
    if (oldIndex === newIndex) return;

    // Reorder in state
    const rows = buildLayoutRows();
    const movedRow = rows[oldIndex];

    if (movedRow.tipo === 'cuenta' && movedRow.originalIndex !== undefined) {
      // Update orden for all affected accounts
      const [removed] = state.cuentas.splice(movedRow.originalIndex, 1);
      state.cuentas.splice(newIndex, 0, removed);

      // Update orden values
      state.cuentas.forEach((cuenta, idx) => {
        cuenta.orden = idx + 1;
      });

      markUnsaved();
      renderPreview();
      showToast('Orden actualizado', 'info');
    }
  }

  // ==========================================
  // EDITING
  // ==========================================
  function editRow(index) {
    const rows = buildLayoutRows();
    const row = rows[index];
    if (!row) return;

    state.selectedElement = { index, row };
    showEditModal(row);
  }

  function showEditModal(row) {
    const modal = new bootstrap.Modal(document.getElementById('editElementModal'));
    const title = document.getElementById('editModalTitle');
    const body = document.getElementById('editModalBody');

    const typeLabels = {
      principal: 'Sección Principal',
      secundaria: 'Sección Secundaria',
      cuenta: 'Cuenta',
      sum: 'Fila de Suma',
      result: 'Resultado',
      net: 'Neto',
      operacion: 'Operación'
    };

    title.textContent = `Editar ${typeLabels[row.tipo] || 'Elemento'}`;

    if (row.tipo === 'cuenta') {
      body.innerHTML = `
        <div class="property-group">
          <label>Número de Cuenta</label>
          <input type="text" class="form-control" id="editCuenta" value="${escapeHtml(row.cuenta || '')}" />
        </div>
        <div class="property-group">
          <label>Descripción</label>
          <input type="text" class="form-control" id="editNombre" value="${escapeHtml(row.nombre || '')}" />
        </div>
        <div class="property-group">
          <label>Sección Principal</label>
          <select class="form-select" id="editPrincipal">
            ${state.secciones.principales.map(s =>
              `<option value="${escapeHtml(s.nombre)}" ${s.nombre === row.principal ? 'selected' : ''}>${escapeHtml(s.nombre)}</option>`
            ).join('')}
          </select>
        </div>
        <div class="property-group">
          <label>Sección Secundaria</label>
          <input type="text" class="form-control" id="editSecundaria" value="${escapeHtml(row.secundaria || '')}" />
        </div>
        <div class="property-group">
          <label>Orden</label>
          <input type="number" class="form-control" id="editOrden" value="${row.data?.orden || 1}" />
        </div>
      `;
    } else if (row.tipo === 'principal' || row.tipo === 'secundaria') {
      body.innerHTML = `
        <div class="property-group">
          <label>Nombre de la Sección</label>
          <input type="text" class="form-control" id="editNombre" value="${escapeHtml(row.nombre || '')}" />
        </div>
        ${row.tipo === 'secundaria' ? `
          <div class="property-group">
            <label>Sección Principal</label>
            <select class="form-select" id="editPrincipal">
              ${state.secciones.principales.map(s =>
                `<option value="${escapeHtml(s.nombre)}" ${s.nombre === row.principal ? 'selected' : ''}>${escapeHtml(s.nombre)}</option>`
              ).join('')}
            </select>
          </div>
        ` : ''}
        <div class="property-group">
          <label>Etiqueta de Suma</label>
          <input type="text" class="form-control" id="editSumLabel" value="Suma ${escapeHtml(row.nombre || '')}" />
        </div>
      `;
    } else if (row.tipo === 'sum' || row.tipo === 'result' || row.tipo === 'net') {
      const opData = row.data || {};
      body.innerHTML = `
        <div class="property-group">
          <label>Etiqueta</label>
          <input type="text" class="form-control" id="editNombre" value="${escapeHtml(row.nombre || '')}" />
        </div>
        <div class="property-group">
          <label>Tipo de Operación</label>
          <select class="form-select" id="editOpTipo">
            <option value="sum-row" ${row.tipo === 'sum' ? 'selected' : ''}>sum-row</option>
            <option value="sum-row-sumavarios">sum-row-sumavarios</option>
            <option value="result-row" ${row.tipo === 'result' ? 'selected' : ''}>result-row</option>
            <option value="net-row" ${row.tipo === 'net' ? 'selected' : ''}>net-row</option>
            <option value="result-net-row">result-net-row</option>
          </select>
        </div>
        <div class="property-group">
          <label>Sección Asociada</label>
          <input type="text" class="form-control" id="editSeccion" value="${escapeHtml(opData.SECCION || '')}" />
        </div>
        <div class="property-group">
          <label>Signo</label>
          <select class="form-select" id="editSigno">
            <option value="1" ${opData.signo !== -1 ? 'selected' : ''}>Positivo (+1)</option>
            <option value="-1" ${opData.signo === -1 ? 'selected' : ''}>Negativo (-1)</option>
          </select>
        </div>
      `;
    }

    modal.show();
  }

  function saveEditedElement() {
    if (!state.selectedElement) return;

    const { index, row } = state.selectedElement;

    if (row.tipo === 'cuenta' && row.originalIndex !== undefined) {
      const cuenta = state.cuentas[row.originalIndex];
      if (cuenta) {
        cuenta.CUENTA = document.getElementById('editCuenta')?.value || cuenta.CUENTA;
        cuenta.NOMBRE = document.getElementById('editNombre')?.value || cuenta.NOMBRE;
        cuenta['SECCIÓN Principal'] = document.getElementById('editPrincipal')?.value || cuenta['SECCIÓN Principal'];
        cuenta['SECCION Secundaria'] = document.getElementById('editSecundaria')?.value || cuenta['SECCION Secundaria'];
        cuenta.orden = parseInt(document.getElementById('editOrden')?.value) || cuenta.orden;
      }
    } else if (row.tipo === 'principal' || row.tipo === 'secundaria') {
      const nuevoNombre = document.getElementById('editNombre')?.value;
      const nombreAnterior = row.nombre;
      if (nuevoNombre && nuevoNombre !== nombreAnterior) {
        // Update all accounts with this section
        state.cuentas.forEach(cuenta => {
          if (row.tipo === 'principal') {
            if ((cuenta['SECCIÓN Principal'] || cuenta.seccion_principal) === nombreAnterior) {
              cuenta['SECCIÓN Principal'] = nuevoNombre;
              cuenta.seccion_principal = nuevoNombre;
            }
          } else {
            if ((cuenta['SECCION Secundaria'] || cuenta.seccion_secundaria) === nombreAnterior) {
              cuenta['SECCION Secundaria'] = nuevoNombre;
              cuenta.seccion_secundaria = nuevoNombre;
            }
          }
        });
      }
    }

    markUnsaved();
    state.secciones = extraerSecciones(state.cuentas);
    renderPreview();
    updateStats();

    const modal = bootstrap.Modal.getInstance(document.getElementById('editElementModal'));
    modal?.hide();

    showToast('Cambios aplicados', 'success');
  }

  function deleteElement() {
    if (!state.selectedElement) return;
    if (!confirm('¿Estás seguro de eliminar este elemento?')) return;

    const { row } = state.selectedElement;

    if (row.tipo === 'cuenta' && row.originalIndex !== undefined) {
      state.cuentas.splice(row.originalIndex, 1);
    } else if (row.operacionIndex !== undefined) {
      state.operaciones.splice(row.operacionIndex, 1);
    }

    markUnsaved();
    state.secciones = extraerSecciones(state.cuentas);
    renderPreview();
    updateStats();

    const modal = bootstrap.Modal.getInstance(document.getElementById('editElementModal'));
    modal?.hide();

    showToast('Elemento eliminado', 'warning');
  }

  function confirmDeleteRow(index) {
    const rows = buildLayoutRows();
    const row = rows[index];
    if (!row) return;

    state.selectedElement = { index, row };
    deleteElement();
  }

  // ==========================================
  // ADD NEW ELEMENTS
  // ==========================================
  function showAddModal(type, context = {}) {
    const modal = new bootstrap.Modal(document.getElementById('addElementModal'));
    const title = document.getElementById('addModalTitle');
    const body = document.getElementById('addModalBody');

    const typeLabels = {
      principal: 'Nueva Sección Principal',
      secundaria: 'Nueva Sección Secundaria',
      cuenta: 'Nueva Cuenta',
      'sum-row': 'Nueva Fila de Suma',
      operacion: 'Nueva Operación'
    };

    title.textContent = typeLabels[type] || 'Agregar Elemento';
    body.dataset.addType = type;

    if (type === 'cuenta') {
      const formatoPlaceholder = ['SUMMARY', 'RESUMEN'].includes(state.modulo)
        ? '21 dígitos (ej: 401000000000000000001)'
        : 'XXX-XXX-XXX-XX (ej: 401-001-000-00)';

      body.innerHTML = `
        <div class="property-group">
          <label>Número de Cuenta <span class="text-danger">*</span></label>
          <input type="text" class="form-control" id="addCuenta" placeholder="${formatoPlaceholder}" />
        </div>
        <div class="property-group">
          <label>Descripción <span class="text-danger">*</span></label>
          <input type="text" class="form-control" id="addNombre" placeholder="Ej: Cuotas de Membresía" />
        </div>
        <div class="property-group">
          <label>Sección Principal <span class="text-danger">*</span></label>
          <select class="form-select" id="addPrincipal">
            <option value="">Seleccionar...</option>
            ${state.secciones.principales.map(s =>
              `<option value="${escapeHtml(s.nombre)}">${escapeHtml(s.nombre)}</option>`
            ).join('')}
          </select>
        </div>
        <div class="property-group">
          <label>Sección Secundaria</label>
          <input type="text" class="form-control" id="addSecundaria" placeholder="Opcional" />
        </div>
      `;
    } else if (type === 'principal') {
      body.innerHTML = `
        <div class="property-group">
          <label>Nombre de la Sección <span class="text-danger">*</span></label>
          <input type="text" class="form-control" id="addNombre" placeholder="Ej: INGRESOS" />
        </div>
        <div class="property-group">
          <label>Etiqueta de Suma</label>
          <input type="text" class="form-control" id="addSumLabel" placeholder="Ej: Total Ingresos" />
        </div>
      `;
    } else if (type === 'secundaria') {
      body.innerHTML = `
        <div class="property-group">
          <label>Sección Principal <span class="text-danger">*</span></label>
          <select class="form-select" id="addPrincipal">
            <option value="">Seleccionar...</option>
            ${state.secciones.principales.map(s =>
              `<option value="${escapeHtml(s.nombre)}">${escapeHtml(s.nombre)}</option>`
            ).join('')}
          </select>
        </div>
        <div class="property-group">
          <label>Nombre de la Sección <span class="text-danger">*</span></label>
          <input type="text" class="form-control" id="addNombre" placeholder="Ej: Membresías" />
        </div>
      `;
    } else if (type === 'sum-row' || type === 'operacion') {
      openOperationBuilder();
      return;
    }

    modal.show();
  }

  function addNewElement() {
    const body = document.getElementById('addModalBody');
    const type = body?.dataset.addType;

    if (!type) return;

    if (type === 'cuenta') {
      const cuenta = document.getElementById('addCuenta')?.value?.trim();
      const nombre = document.getElementById('addNombre')?.value?.trim();
      const principal = document.getElementById('addPrincipal')?.value;
      const secundaria = document.getElementById('addSecundaria')?.value?.trim();

      if (!cuenta || !nombre || !principal) {
        showToast('Completa los campos requeridos', 'warning');
        return;
      }

      const nuevaCuenta = {
        CUENTA: cuenta,
        NOMBRE: nombre,
        'SECCIÓN Principal': principal,
        'SECCION Secundaria': secundaria || '',
        orden: state.cuentas.length + 1
      };

      state.cuentas.push(nuevaCuenta);
    } else if (type === 'principal') {
      const nombre = document.getElementById('addNombre')?.value?.trim();
      if (!nombre) {
        showToast('El nombre es requerido', 'warning');
        return;
      }

      // Add a placeholder account to create the section
      state.cuentas.push({
        CUENTA: '',
        NOMBRE: `Sección ${nombre}`,
        'SECCIÓN Principal': nombre,
        'SECCION Secundaria': '',
        orden: state.cuentas.length + 1
      });
    } else if (type === 'secundaria') {
      const principal = document.getElementById('addPrincipal')?.value;
      const nombre = document.getElementById('addNombre')?.value?.trim();

      if (!principal || !nombre) {
        showToast('Completa los campos requeridos', 'warning');
        return;
      }

      state.cuentas.push({
        CUENTA: '',
        NOMBRE: `Subsección ${nombre}`,
        'SECCIÓN Principal': principal,
        'SECCION Secundaria': nombre,
        orden: state.cuentas.length + 1
      });
    }

    markUnsaved();
    state.secciones = extraerSecciones(state.cuentas);
    renderPreview();
    updateStats();

    const modal = bootstrap.Modal.getInstance(document.getElementById('addElementModal'));
    modal?.hide();

    showToast('Elemento agregado', 'success');
  }

  // ==========================================
  // OPERATION BUILDER
  // ==========================================
  function openOperationBuilder() {
    const modal = new bootstrap.Modal(document.getElementById('operationBuilderModal'));
    const list = document.getElementById('availableSectionsList');
    const formulaBuilder = document.getElementById('operationFormulaBuilder');

    // Populate available sections
    const allSections = [];
    state.secciones.principales.forEach(p => {
      allSections.push({ type: 'principal', name: p.nombre });
      p.secundarias.forEach(s => {
        allSections.push({ type: 'secundaria', name: s, principal: p.nombre });
      });
    });

    list.innerHTML = allSections.map(s => `
      <div class="available-section-item" data-name="${escapeHtml(s.name)}" data-type="${s.type}">
        <span>${escapeHtml(s.name)}</span>
        <span class="badge bg-secondary">${s.type}</span>
      </div>
    `).join('');

    // Add click handlers
    list.querySelectorAll('.available-section-item').forEach(item => {
      item.addEventListener('click', () => {
        list.querySelectorAll('.available-section-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
      });
    });

    formulaBuilder.innerHTML = '<div class="formula-empty">Arrastra secciones aquí para construir la fórmula</div>';

    modal.show();
  }

  function saveOperation() {
    const tipo = document.getElementById('opBuilderTipo')?.value;
    const label = document.getElementById('opBuilderLabel')?.value?.trim();

    if (!label) {
      showToast('La etiqueta es requerida', 'warning');
      return;
    }

    const operacion = {
      HOJA: state.modulo,
      CAPITULO: state.capitulo,
      Clase: label,
      SECCION: label,
      [tipo]: label,
      signo: 1,
      orden: state.operaciones.length + 1
    };

    state.operaciones.push(operacion);
    markUnsaved();
    renderPreview();
    updateStats();

    const modal = bootstrap.Modal.getInstance(document.getElementById('operationBuilderModal'));
    modal?.hide();

    showToast('Operación agregada', 'success');
  }

  // ==========================================
  // SAVE
  // ==========================================
  async function guardarTodo() {
    if (!isEditModeAllowed()) {
      showToast('Activa el modo edición para guardar', 'warning');
      return;
    }

    setStatus('Guardando...');
    dom.btnGuardarTodo.disabled = true;
    dom.btnGuardarTodo.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Guardando...';

    try {
      // Save accounts
      const cuentasPayload = state.cuentas.map(cuenta => ({
        cuenta: cuenta.CUENTA,
        nombre: cuenta.NOMBRE,
        seccion_principal: cuenta['SECCIÓN Principal'] || cuenta.seccion_principal,
        seccion_secundaria: cuenta['SECCION Secundaria'] || cuenta.seccion_secundaria,
        orden: cuenta.orden
      }));

      const cuentasRes = await fetch(
        `${API_BASE}/layouts-config/${encodeURIComponent(state.modulo)}/${state.anio}/${encodeURIComponent(state.capitulo)}/cuentas`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            empresaId: state.empresaId,
            cuentas: cuentasPayload
          })
        }
      );

      if (!cuentasRes.ok) {
        throw new Error('Error al guardar cuentas');
      }

      // Save operations
      if (state.operaciones.length > 0) {
        const operacionesRes = await fetch(
          `${API_BASE}/layouts-config/${encodeURIComponent(state.modulo)}/${state.anio}/operaciones`,
          {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
              empresaId: state.empresaId,
              capitulo: state.capitulo,
              operaciones: state.operaciones
            })
          }
        );

        if (!operacionesRes.ok) {
          throw new Error('Error al guardar operaciones');
        }
      }

      state.unsavedChanges = false;
      setStatus('Guardado correctamente');
      showToast('Layout guardado exitosamente', 'success');
    } catch (error) {
      console.error('Error guardando:', error);
      setStatus('Error al guardar');
      showToast('Error al guardar el layout', 'danger');
    } finally {
      dom.btnGuardarTodo.disabled = false;
      dom.btnGuardarTodo.innerHTML = '<i class="bi bi-save me-1"></i>Guardar Todo';
      checkAuthState();
    }
  }

  // ==========================================
  // CONTEXT MENU
  // ==========================================
  function handleContextMenu(e) {
    const row = e.target.closest('.preview-row');
    if (!row) return;

    e.preventDefault();

    const index = parseInt(row.dataset.index);
    const rows = buildLayoutRows();
    state.selectedElement = { index, row: rows[index] };

    dom.contextMenu.style.top = `${e.clientY}px`;
    dom.contextMenu.style.left = `${e.clientX}px`;
    dom.contextMenu.classList.add('show');

    // Bind context menu actions
    dom.contextMenu.querySelectorAll('.context-menu-item').forEach(item => {
      item.onclick = () => handleContextAction(item.dataset.action, index);
    });
  }

  function hideContextMenu() {
    dom.contextMenu?.classList.remove('show');
  }

  function handleContextAction(action, index) {
    hideContextMenu();

    const rows = buildLayoutRows();
    const row = rows[index];

    switch (action) {
      case 'edit':
        editRow(index);
        break;
      case 'duplicate':
        duplicateRow(index);
        break;
      case 'add-child':
        addChildToRow(index);
        break;
      case 'move-up':
        moveRow(index, -1);
        break;
      case 'move-down':
        moveRow(index, 1);
        break;
      case 'delete':
        state.selectedElement = { index, row };
        deleteElement();
        break;
    }
  }

  function duplicateRow(index) {
    const rows = buildLayoutRows();
    const row = rows[index];

    if (row.tipo === 'cuenta' && row.originalIndex !== undefined) {
      const original = state.cuentas[row.originalIndex];
      const copia = { ...original, orden: state.cuentas.length + 1, CUENTA: original.CUENTA + '_copia' };
      state.cuentas.push(copia);
      markUnsaved();
      renderPreview();
      showToast('Cuenta duplicada', 'info');
    }
  }

  function addChildToRow(index) {
    const rows = buildLayoutRows();
    const row = rows[index];

    if (row.tipo === 'principal') {
      showAddModal('secundaria');
      setTimeout(() => {
        const select = document.getElementById('addPrincipal');
        if (select) select.value = row.nombre;
      }, 100);
    } else if (row.tipo === 'secundaria') {
      showAddModal('cuenta');
      setTimeout(() => {
        const selectPrincipal = document.getElementById('addPrincipal');
        const inputSecundaria = document.getElementById('addSecundaria');
        if (selectPrincipal) selectPrincipal.value = row.principal;
        if (inputSecundaria) inputSecundaria.value = row.nombre;
      }, 100);
    }
  }

  function moveRow(index, direction) {
    const rows = buildLayoutRows();
    const row = rows[index];

    if (row.tipo === 'cuenta' && row.originalIndex !== undefined) {
      const newIndex = row.originalIndex + direction;
      if (newIndex >= 0 && newIndex < state.cuentas.length) {
        const [moved] = state.cuentas.splice(row.originalIndex, 1);
        state.cuentas.splice(newIndex, 0, moved);

        // Update orden
        state.cuentas.forEach((c, i) => { c.orden = i + 1; });

        markUnsaved();
        renderPreview();
      }
    }
  }

  // ==========================================
  // EVENT HANDLERS
  // ==========================================
  function handleModuloChange() {
    state.modulo = dom.moduloSelect?.value || state.modulo;
    cargarAnios();
  }

  function handleAnioChange() {
    state.anio = dom.anioSelect?.value || state.anio;
    cargarCapitulos();
  }

  function handleCapituloChange() {
    state.capitulo = dom.capituloSelect?.value || state.capitulo;
  }

  function handleKeyboard(e) {
    // Ctrl+S to save
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      guardarTodo();
    }
    // Delete key
    if (e.key === 'Delete' && state.selectedElement) {
      deleteElement();
    }
    // Escape to close context menu
    if (e.key === 'Escape') {
      hideContextMenu();
    }
  }

  function expandirTodo() {
    state.secciones.principales.forEach(p => {
      state.expandedSections.add(p.nombre);
      p.secundarias.forEach(s => state.expandedSections.add(s));
    });
    renderPreview();
  }

  function colapsarTodo() {
    state.expandedSections.clear();
    renderPreview();
  }

  function toggleSection(name) {
    if (state.expandedSections.has(name)) {
      state.expandedSections.delete(name);
    } else {
      state.expandedSections.add(name);
    }
    renderPreview();
  }

  function ajustarZoom(delta) {
    state.zoomLevel = Math.max(50, Math.min(150, state.zoomLevel + delta));
    document.querySelector('.zoom-value').textContent = `${state.zoomLevel}%`;
    const container = document.querySelector('.preview-table-container');
    if (container) {
      container.style.transform = `scale(${state.zoomLevel / 100})`;
    }
  }

  // ==========================================
  // UTILITIES
  // ==========================================
  function setStatus(text) {
    if (dom.statusText) dom.statusText.textContent = text;
  }

  function markUnsaved() {
    state.unsavedChanges = true;
    checkAuthState();
  }

  function showToast(message, type = 'info') {
    const toast = document.getElementById('builderToast');
    const body = document.getElementById('toastBody');
    if (!toast || !body) return;

    body.textContent = message;
    toast.className = `toast bg-${type === 'success' ? 'success' : type === 'danger' ? 'danger' : type === 'warning' ? 'warning' : 'light'} ${type !== 'light' ? 'text-white' : ''}`;

    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ==========================================
  // PUBLIC API
  // ==========================================
  window.LayoutBuilder = {
    editRow,
    confirmDeleteRow,
    toggleSection,
    showAddModal,
    openOperationBuilder
  };

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
