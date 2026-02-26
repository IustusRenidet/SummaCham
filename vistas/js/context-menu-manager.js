/**
 * context-menu-manager.js
 * Gestión de menú contextual para SUMMARY y RESUMEN
 * Permite agregar, editar y eliminar filas/secciones/operaciones
 */

(function () {
  'use strict';

  const ContextMenuManager = {
    currentRow: null,
    currentRowData: null,
    menuElement: null,

    /**
     * Verifica si el usuario puede hacer cambios estructurales
     * Solo permite en estado EDITANDO o BORRADOR
     */
    puedeModificarEstructura() {
      const flujo = window.__flujoAutorizacionInstance;
      if (!flujo) {
        console.warn('⚠️ Flujo de autorización no disponible, bloqueando cambios');
        alert('❌ El sistema de autorización no está disponible.\n\nPor favor, recargue la página.');
        return false;
      }

      const estado = flujo.state?.borrador?.estado || 'SIN_CARGAR';
      const modoEdicion = flujo.state?.editMode || false;
      const permiteEdicion = ['EDITANDO', 'BORRADOR', 'CARGANDO'].includes(estado) && modoEdicion;

      if (!permiteEdicion) {
        const estadoMostrar = estado === 'SIN_CARGAR' ? 'Sin cargar' : estado;
        const mensaje = !modoEdicion 
          ? `❌ No está en modo edición\n\nDebe hacer clic en "Cargar presupuesto" para activar el modo edición.`
          : `❌ No se pueden hacer cambios estructurales en estado: ${estadoMostrar}\n\nDebe estar en modo edición para modificar la estructura.`;
        alert(mensaje);
        return false;
      }

      return true;
    },

    init() {
      // Si está activo el nuevo menú del wizard, omitir este manager para evitar duplicados
      if (
        window.location.pathname.includes("plantillas.html") &&
        window.ContextMenuWizard
      ) {
        console.info('ℹ️ ContextMenuManager deshabilitado: usando ContextMenuWizard');
        return;
      }
      this.menuElement = document.getElementById('contextMenu');
      if (!this.menuElement) {
        console.warn('❌ Menú contextual no encontrado');
        return;
      }

      this.attachTableListeners();
      this.attachMenuListeners();
      this.attachClickOutside();
    },

    attachTableListeners() {
      const tables = document.querySelectorAll('#mainTable, #tablaComparacion');
      tables.forEach(table => {
        table.addEventListener('contextmenu', (e) => {
          const row = e.target.closest('tr');
          if (!row || !row.classList.contains('account-row') && 
              !row.classList.contains('subsection-row') &&
              !row.classList.contains('section-header-row')) {
            return;
          }

          e.preventDefault();
          this.currentRow = row;
          this.extractRowData(row);
          this.showMenu(e.pageX, e.pageY);
        });
      });
    },

    extractRowData(row) {
      const cells = row.querySelectorAll('td');
      if (cells.length === 0) return;

      this.currentRowData = {
        type: row.classList.contains('subsection-row') ? 'subsection' : 
              row.classList.contains('section-header-row') ? 'section' : 'account',
        cuenta: cells[0]?.textContent.trim() || '',
        descripcion: cells[1]?.textContent.trim() || '',
        sectionName: row.dataset.sectionName || '',
        rowElement: row
      };

      console.log('📋 Datos de fila extraídos:', this.currentRowData);
    },

    showMenu(x, y) {
      if (!this.menuElement) return;

      this.menuElement.style.display = 'block';
      this.menuElement.style.left = `${x}px`;
      this.menuElement.style.top = `${y}px`;

      // Ajustar si se sale de la pantalla
      const rect = this.menuElement.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        this.menuElement.style.left = `${window.innerWidth - rect.width - 10}px`;
      }
      if (rect.bottom > window.innerHeight) {
        this.menuElement.style.top = `${window.innerHeight - rect.height - 10}px`;
      }
    },

    hideMenu() {
      if (this.menuElement) {
        this.menuElement.style.display = 'none';
      }
      this.currentRow = null;
      this.currentRowData = null;
    },

    attachMenuListeners() {
      if (!this.menuElement) return;

      this.menuElement.addEventListener('click', (e) => {
        const item = e.target.closest('.context-menu-item');
        if (!item) return;

        const action = item.dataset.action;
        this.handleAction(action);
        this.hideMenu();
      });
    },

    attachClickOutside() {
      document.addEventListener('click', (e) => {
        if (!this.menuElement) return;
        if (!this.menuElement.contains(e.target) && this.menuElement.style.display === 'block') {
          this.hideMenu();
        }
      });
    },

    handleAction(action) {
      console.log(`🎬 Acción: ${action}`, this.currentRowData);

      // Verificar permisos antes de cualquier acción de modificación
      if (['add-row', 'add-section', 'add-operation', 'edit-row', 'delete-row'].includes(action)) {
        if (!this.puedeModificarEstructura()) {
          return;
        }
      }

      switch (action) {
        case 'add-row':
          this.showAddRowModal();
          break;
        case 'add-section':
          this.showAddSectionModal();
          break;
        case 'add-operation':
          this.showOperationModal();
          break;
        case 'edit-row':
          this.showEditRowModal();
          break;
        case 'delete-row':
          this.confirmDeleteRow();
          break;
        default:
          console.warn(`Acción desconocida: ${action}`);
      }
    },

    showAddRowModal() {
      const html = `
        <div class="modal fade" id="addRowModal" tabindex="-1">
          <div class="modal-dialog">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title"><i class="bi bi-plus-circle me-2"></i>Agregar Nueva Cuenta</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body">
                <form id="addRowForm">
                  <div class="mb-3">
                    <label for="newCuenta" class="form-label">Número de Cuenta</label>
                    <input type="text" class="form-control" id="newCuenta" required 
                           placeholder="Ej: 4010-001">
                  </div>
                  <div class="mb-3">
                    <label for="newDescripcion" class="form-label">Descripción/Nombre</label>
                    <input type="text" class="form-control" id="newDescripcion" required
                           placeholder="Ej: Cuotas Membership">
                  </div>
                  <div class="mb-3">
                    <label for="newSeccion" class="form-label">Sección</label>
                    <select class="form-select" id="newSeccion" required>
                      <option value="">Seleccione una sección...</option>
                    </select>
                  </div>
                  <div class="mb-3">
                    <label for="newCapitulo" class="form-label">Capítulo</label>
                    <select class="form-select" id="newCapitulo" required>
                      <option value="INCOME">INCOME</option>
                      <option value="EXPENSE">EXPENSE</option>
                    </select>
                  </div>
                </form>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                <button type="button" class="btn btn-primary" onclick="ContextMenuManager.submitAddRow()">
                  <i class="bi bi-check-circle me-1"></i>Agregar Cuenta
                </button>
              </div>
            </div>
          </div>
        </div>
      `;

      this.showModalFromHTML(html);
      this.populateSectionSelect();
    },

    showAddSectionModal() {
      const html = `
        <div class="modal fade" id="addSectionModal" tabindex="-1">
          <div class="modal-dialog">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title"><i class="bi bi-folder-plus me-2"></i>Agregar Nueva Sección</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body">
                <form id="addSectionForm">
                  <div class="mb-3">
                    <label for="newSectionName" class="form-label">Nombre de la Sección</label>
                    <input type="text" class="form-control" id="newSectionName" required
                           placeholder="Ej: Marketing">
                  </div>
                  <div class="mb-3">
                    <label for="newSectionType" class="form-label">Tipo</label>
                    <select class="form-select" id="newSectionType" required>
                      <option value="secundaria">Sección Secundaria (Subsección)</option>
                      <option value="principal">Sección Principal</option>
                    </select>
                  </div>
                  <div class="mb-3">
                    <label for="newSectionCapitulo" class="form-label">Capítulo</label>
                    <select class="form-select" id="newSectionCapitulo" required>
                      <option value="INCOME">INCOME</option>
                      <option value="EXPENSE">EXPENSE</option>
                    </select>
                  </div>
                  <div class="mb-3" id="parentSectionContainer">
                    <label for="newSectionParent" class="form-label">Sección Principal (Padre)</label>
                    <select class="form-select" id="newSectionParent">
                      <option value="">Seleccione...</option>
                    </select>
                  </div>
                </form>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                <button type="button" class="btn btn-primary" onclick="ContextMenuManager.submitAddSection()">
                  <i class="bi bi-check-circle me-1"></i>Agregar Sección
                </button>
              </div>
            </div>
          </div>
        </div>
      `;

      this.showModalFromHTML(html);
      
      // Toggle parent section based on type
      const typeSelect = document.getElementById('newSectionType');
      const parentContainer = document.getElementById('parentSectionContainer');
      if (typeSelect && parentContainer) {
        typeSelect.addEventListener('change', () => {
          parentContainer.style.display = typeSelect.value === 'secundaria' ? 'block' : 'none';
        });
      }
    },

    showOperationModal() {
      const html = `
        <div class="modal fade" id="operationModal" tabindex="-1">
          <div class="modal-dialog modal-lg">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title"><i class="bi bi-calculator me-2"></i>Crear Operación Matemática</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body">
                <form id="operationForm">
                  <div class="mb-3">
                    <label for="opName" class="form-label">Nombre de la Operación</label>
                    <input type="text" class="form-control" id="opName" required
                           placeholder="Ej: Total Gastos Operativos">
                  </div>
                  <div class="mb-3">
                    <label for="opType" class="form-label">Tipo de Operación</label>
                    <select class="form-select" id="opType" required>
                      <option value="suma">Suma (+)</option>
                      <option value="resta">Resta (-)</option>
                      <option value="division">División (/)</option>
                      <option value="multiplicacion">Multiplicación (×)</option>
                    </select>
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Secciones/Cuentas Involucradas</label>
                    <div id="operationSections" class="border rounded p-3" style="max-height: 300px; overflow-y: auto;">
                      <small class="text-muted">Cargando secciones disponibles...</small>
                    </div>
                  </div>
                  <div class="mb-3">
                    <label for="opFormula" class="form-label">Fórmula</label>
                    <input type="text" class="form-control" id="opFormula" readonly
                           placeholder="La fórmula se generará automáticamente">
                  </div>
                  <div class="mb-3">
                    <label for="opHoja" class="form-label">Aplicar a</label>
                    <select class="form-select" id="opHoja" required>
                      <option value="RESUMEN">Solo RESUMEN</option>
                    </select>
                  </div>
                </form>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                <button type="button" class="btn btn-primary" onclick="ContextMenuManager.submitOperation()">
                  <i class="bi bi-check-circle me-1"></i>Crear Operación
                </button>
              </div>
            </div>
          </div>
        </div>
      `;

      this.showModalFromHTML(html);
      this.loadAvailableSectionsForOperation();
    },

    showEditRowModal() {
      if (!this.currentRowData) return;

      const html = `
        <div class="modal fade" id="editRowModal" tabindex="-1">
          <div class="modal-dialog">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title"><i class="bi bi-pencil me-2"></i>Editar ${this.currentRowData.type === 'account' ? 'Cuenta' : 'Sección'}</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body">
                <form id="editRowForm">
                  <div class="mb-3">
                    <label for="editCuenta" class="form-label">Cuenta</label>
                    <input type="text" class="form-control" id="editCuenta" readonly
                           value="${this.currentRowData.cuenta}">
                  </div>
                  <div class="mb-3">
                    <label for="editDescripcion" class="form-label">Descripción/Nombre</label>
                    <input type="text" class="form-control" id="editDescripcion" required
                           value="${this.currentRowData.descripcion}">
                  </div>
                </form>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                <button type="button" class="btn btn-primary" onclick="ContextMenuManager.submitEdit()">
                  <i class="bi bi-check-circle me-1"></i>Guardar Cambios
                </button>
              </div>
            </div>
          </div>
        </div>
      `;

      this.showModalFromHTML(html);
    },

    confirmDeleteRow() {
      if (!this.currentRowData) return;

      if (confirm(`¿Está seguro de eliminar la ${this.currentRowData.type === 'account' ? 'cuenta' : 'sección'} "${this.currentRowData.descripcion}"?\n\nEsta acción no se puede deshacer.`)) {
        this.deleteRow();
      }
    },

    showModalFromHTML(html) {
      // Remove existing modal if any
      const existingModals = document.querySelectorAll('.modal');
      existingModals.forEach(m => m.remove());

      // Add new modal
      document.body.insertAdjacentHTML('beforeend', html);

      // Show modal using Bootstrap
      const modalElement = document.body.lastElementChild;
      const modal = new bootstrap.Modal(modalElement);
      modal.show();

      // Clean up on hide
      modalElement.addEventListener('hidden.bs.modal', () => {
        modalElement.remove();
      });
    },

    populateSectionSelect() {
      // TODO: Cargar secciones dinámicamente desde el JSON
      const select = document.getElementById('newSeccion');
      if (!select) return;

      const secciones = ['Membership', 'Events', 'Committees', 'Others'];
      select.innerHTML = '<option value="">Seleccione una sección...</option>';
      secciones.forEach(s => {
        select.innerHTML += `<option value="${s}">${s}</option>`;
      });
    },

    loadAvailableSectionsForOperation() {
      const container = document.getElementById('operationSections');
      if (!container) return;

      // TODO: Cargar desde JSON real
      const mockSections = [
        { name: 'Membership', checked: false },
        { name: 'Events', checked: false },
        { name: 'Committees', checked: false }
      ];

      let html = '';
      mockSections.forEach(section => {
        html += `
          <div class="form-check">
            <input class="form-check-input operation-section-check" type="checkbox" 
                   value="${section.name}" id="op_${section.name}">
            <label class="form-check-label" for="op_${section.name}">
              ${section.name}
            </label>
          </div>
        `;
      });

      container.innerHTML = html;

      // Update formula on checkbox change
      container.addEventListener('change', () => {
        this.updateOperationFormula();
      });
    },

    updateOperationFormula() {
      const checked = Array.from(document.querySelectorAll('.operation-section-check:checked'))
        .map(cb => cb.value);
      const opType = document.getElementById('opType')?.value || 'suma';
      const formulaInput = document.getElementById('opFormula');

      if (!formulaInput) return;

      let operator = '+';
      if (opType === 'resta') operator = '-';
      if (opType === 'division') operator = '/';
      if (opType === 'multiplicacion') operator = '×';

      formulaInput.value = checked.join(` ${operator} `);
    },

    async submitAddRow() {
      const cuenta = document.getElementById('newCuenta')?.value;
      const descripcion = document.getElementById('newDescripcion')?.value;
      const seccion = document.getElementById('newSeccion')?.value;
      const capitulo = document.getElementById('newCapitulo')?.value;

      if (!cuenta || !descripcion || !seccion || !capitulo) {
        alert('Por favor complete todos los campos');
        return;
      }

      console.log('📤 Guardando nueva cuenta:', { cuenta, descripcion, seccion, capitulo });

      try {
        const response = await fetch('/api/cuentas/agregar', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...Sesion.headersAutenticacion()
          },
          body: JSON.stringify({
            cuenta,
            nombre: descripcion,
            seccion,
            capitulo,
            modulo: document.body.dataset.modulo || 'SUMMARY'
          })
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.mensaje || 'Error al agregar cuenta');
        }

        alert('✅ Cuenta agregada exitosamente\n\n⚠️ Recuerde guardar el presupuesto a través del flujo de autorización cuando termine de hacer todos los cambios.');
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('addRowModal'));
        if (modal) modal.hide();

        // Reload data
        window.location.reload();

      } catch (error) {
        console.error('Error al agregar cuenta:', error);
        alert(`❌ Error: ${error.message}`);
      }
    },

    async submitAddSection() {
      const name = document.getElementById('newSectionName')?.value;
      const type = document.getElementById('newSectionType')?.value;
      const capitulo = document.getElementById('newSectionCapitulo')?.value;
      const parent = document.getElementById('newSectionParent')?.value;

      if (!name || !type || !capitulo) {
        alert('Por favor complete todos los campos obligatorios');
        return;
      }

      console.log('📤 Guardando nueva sección:', { name, type, capitulo, parent });

      try {
        const response = await fetch('/api/secciones/agregar', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...Sesion.headersAutenticacion()
          },
          body: JSON.stringify({
            nombre: name,
            tipo: type,
            capitulo,
            parent,
            modulo: document.body.dataset.modulo || 'SUMMARY'
          })
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.mensaje || 'Error al agregar sección');
        }

        alert('✅ Sección agregada exitosamente');
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('addSectionModal'));
        if (modal) modal.hide();

        window.location.reload();

      } catch (error) {
        console.error('Error al agregar sección:', error);
        alert(`❌ Error: ${error.message}`);
      }
    },

    async submitOperation() {
      const name = document.getElementById('opName')?.value;
      const type = document.getElementById('opType')?.value;
      const formula = document.getElementById('opFormula')?.value;
      const hoja = document.getElementById('opHoja')?.value;

      const sections = Array.from(document.querySelectorAll('.operation-section-check:checked'))
        .map(cb => cb.value);

      if (!name || !type || sections.length === 0) {
        alert('Por favor complete todos los campos y seleccione al menos una sección');
        return;
      }

      console.log('📤 Guardando operación:', { name, type, formula, hoja, sections });

      try {
        const response = await fetch('/api/operaciones/agregar', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...Sesion.headersAutenticacion()
          },
          body: JSON.stringify({
            nombre: name,
            tipo: type,
            formula,
            hoja,
            secciones: sections,
            modulo: document.body.dataset.modulo || 'SUMMARY'
          })
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.mensaje || 'Error al crear operación');
        }

        alert('✅ Operación creada exitosamente');
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('operationModal'));
        if (modal) modal.hide();

        window.location.reload();

      } catch (error) {
        console.error('Error al crear operación:', error);
        alert(`❌ Error: ${error.message}`);
      }
    },

    async submitEdit() {
      const descripcion = document.getElementById('editDescripcion')?.value;
      
      if (!descripcion || !this.currentRowData) {
        alert('Error: No se puede guardar sin descripción');
        return;
      }

      console.log('📤 Guardando cambios:', { 
        cuenta: this.currentRowData.cuenta, 
        descripcion 
      });

      try {
        const response = await fetch('/api/cuentas/editar', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...Sesion.headersAutenticacion()
          },
          body: JSON.stringify({
            cuenta: this.currentRowData.cuenta,
            nombre: descripcion,
            modulo: document.body.dataset.modulo || 'SUMMARY'
          })
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.mensaje || 'Error al editar');
        }

        alert('✅ Cambios guardados exitosamente');
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('editRowModal'));
        if (modal) modal.hide();

        // Update cell directly
        const cells = this.currentRowData.rowElement.querySelectorAll('td');
        if (cells[1]) cells[1].textContent = descripcion;

      } catch (error) {
        console.error('Error al editar:', error);
        alert(`❌ Error: ${error.message}`);
      }
    },

    async deleteRow() {
      if (!this.currentRowData) return;

      console.log('🗑️ Eliminando:', this.currentRowData);

      try {
        const response = await fetch('/api/cuentas/eliminar', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...Sesion.headersAutenticacion()
          },
          body: JSON.stringify({
            cuenta: this.currentRowData.cuenta,
            modulo: document.body.dataset.modulo || 'SUMMARY'
          })
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.mensaje || 'Error al eliminar');
        }

        alert('✅ Eliminado exitosamente');

        // Remove row from DOM
        if (this.currentRowData.rowElement) {
          this.currentRowData.rowElement.remove();
        }

      } catch (error) {
        console.error('Error al eliminar:', error);
        alert(`❌ Error: ${error.message}`);
      }
    }
  };

  // Expose globally
  window.ContextMenuManager = ContextMenuManager;

  // Auto-initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      ContextMenuManager.init();
    });
  } else {
    ContextMenuManager.init();
  }
})();
