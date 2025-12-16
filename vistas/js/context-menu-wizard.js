/**
 * context-menu-wizard.js
 * Conecta el menú contextual con el wizard de inserción
 * Compatible con los 13 módulos (SUMMARY, RESUMEN, MÓDULOS)
 */

(() => {
  'use strict';

  const ContextMenuWizard = {
    contextMenu: null,
    currentRow: null,

    canModifyStructure(showAlert = true) {
      const flujo = window.__flujoAutorizacionInstance;
      const estadosPermitidos = ["EDITANDO", "BORRADOR", "CARGANDO"];
      let modoEdicion = false;
      let estado = "SIN_CARGAR";

      if (flujo) {
        estado = flujo.state?.borrador?.estado || "SIN_CARGAR";
        modoEdicion = Boolean(flujo.state?.editMode);
      }

      if (!modoEdicion && window.ModoEdicionPresupuesto?.estaActivo) {
        modoEdicion = window.ModoEdicionPresupuesto.estaActivo();
        if (modoEdicion) estado = "EDITANDO";
      }

      if (!flujo && !window.ModoEdicionPresupuesto) {
        return true;
      }

      const permitido = modoEdicion && estadosPermitidos.includes(estado);
      if (!permitido && showAlert) {
        const estadoMostrar = estado === "SIN_CARGAR" ? "Sin cargar" : estado;
        const mensaje = modoEdicion
          ? `❌ No se pueden hacer cambios estructurales en estado: ${estadoMostrar}\n\nDebes estar en modo inserción/edición para modificar la estructura.`
          : '❌ No estás en modo inserción\n\nHaz clic en "Cargar presupuesto" para activar el modo edición antes de usar el wizard.';
        alert(mensaje);
      }
      return permitido;
    },

    /**
     * Inicializa el sistema de menú contextual
     */
    init() {
      this.contextMenu = document.getElementById('contextMenu');
      if (!this.contextMenu) {
        console.warn('⚠️ No se encontró el elemento #contextMenu');
        return;
      }

      this.attachEventListeners();
      console.log('✅ Context Menu Wizard inicializado');
    },

    /**
     * Adjunta event listeners
     */
    attachEventListeners() {
      // Capturar click derecho en toda la tabla
      const tables = document.querySelectorAll('table tbody, .table-responsive');
      tables.forEach(table => {
        table.addEventListener('contextmenu', (e) => this.handleContextMenu(e));
      });

      // Click en items del menú
      const menuItems = this.contextMenu.querySelectorAll('.context-menu-item');
      menuItems.forEach(item => {
        item.addEventListener('click', (e) => this.handleMenuAction(e));
      });

      // Cerrar menú al hacer click fuera
      document.addEventListener('click', () => this.closeMenu());
      
      // Cerrar menú con ESC
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this.closeMenu();
      });
    },

    /**
     * Maneja el click derecho
     */
    handleContextMenu(e) {
      // Encontrar la fila más cercana
      const row = e.target.closest('tr');
      if (!row) return;
      if (!this.canModifyStructure()) return;
      e.preventDefault();

      this.currentRow = row;

      // Filtrar opciones según tipo de fila
      this.updateMenuOptions(row);

      // Posicionar menú
      const x = e.pageX;
      const y = e.pageY;
      
      this.contextMenu.style.left = `${x}px`;
      this.contextMenu.style.top = `${y}px`;
      this.contextMenu.style.display = 'block';

      // Ajustar posición si se sale de la pantalla
      setTimeout(() => {
        const rect = this.contextMenu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
          this.contextMenu.style.left = `${x - rect.width}px`;
        }
        if (rect.bottom > window.innerHeight) {
          this.contextMenu.style.top = `${y - rect.height}px`;
        }
      }, 0);
    },

    /**
     * Actualiza opciones del menú según contexto
     */
    updateMenuOptions(row) {
      const addRowItem = this.contextMenu.querySelector('[data-action="add-row"]');
      const addSectionItem = this.contextMenu.querySelector('[data-action="add-section"]');
      const addOperationItem = this.contextMenu.querySelector('[data-action="add-operation"]');
      const editItem = this.contextMenu.querySelector('[data-action="edit-row"]');
      const deleteItem = this.contextMenu.querySelector('[data-action="delete-row"]');

      // Resetear visibilidad
      [addRowItem, addSectionItem, addOperationItem, editItem, deleteItem].forEach(item => {
        if (item) item.style.display = 'flex';
      });

      // Ocultar según tipo de fila
      if (row.classList.contains('sum-row') || row.classList.contains('section-header-row')) {
        if (addRowItem) addRowItem.style.display = 'none';
        if (editItem) editItem.style.display = 'none';
      }

      if (row.classList.contains('account-row')) {
        if (addSectionItem) addSectionItem.style.display = 'none';
      }
    },

    /**
     * Maneja la acción del menú
     */
    handleMenuAction(e) {
      const action = e.currentTarget.dataset.action;
      
      this.closeMenu();

      if (!this.currentRow) return;

      switch (action) {
        case 'add-row':
          this.openWizard('cuenta');
          break;
        
        case 'add-section':
          this.openWizardSection();
          break;
        
        case 'add-operation':
          this.openWizard('operacion');
          break;
        
        case 'edit-row':
          this.editRow();
          break;
        
        case 'delete-row':
          this.deleteRow();
          break;
      }
    },

    /**
     * Abre el wizard para agregar cuenta u operación
     */
    openWizard(type) {
      if (!this.canModifyStructure(false)) return;
      if (typeof InsertionWizard === 'undefined') {
        console.error('❌ InsertionWizard no está disponible');
        alert('Error: Sistema de inserción no disponible');
        return;
      }

      // Pre-seleccionar el tipo
      InsertionWizard.selectedType = type;
      
      // Abrir wizard con contexto de la fila actual
      InsertionWizard.open(this.currentRow);
    },

    /**
     * Abre wizard para sección (detecta si es secundaria o principal)
     */
    openWizardSection() {
      if (!this.canModifyStructure(false)) return;
      if (typeof InsertionWizard === 'undefined') {
        console.error('❌ InsertionWizard no está disponible');
        alert('Error: Sistema de inserción no disponible');
        return;
      }

      // Detectar tipo de sección según contexto
      let sectionType = 'secundaria';
      
      if (this.currentRow.classList.contains('section-header-row')) {
        // Click en una principal → crear otra principal
        sectionType = 'principal';
      } else if (this.currentRow.classList.contains('subsection-row')) {
        // Click en una secundaria → crear otra secundaria
        sectionType = 'secundaria';
      } else if (this.currentRow.classList.contains('account-row')) {
        // Click en cuenta → crear secundaria en su nivel
        sectionType = 'secundaria';
      }

      InsertionWizard.selectedType = sectionType;
      InsertionWizard.open(this.currentRow);
    },

    /**
     * Editar fila (función existente)
     */
    editRow() {
      if (!this.canModifyStructure(false)) return;
      // Buscar función de edición existente en el módulo
      if (typeof window.editarFila === 'function') {
        window.editarFila(this.currentRow);
      } else if (typeof window.habilitarEdicion === 'function') {
        window.habilitarEdicion(this.currentRow);
      } else {
        console.warn('⚠️ No se encontró función de edición');
        alert('Función de edición no disponible en este módulo');
      }
    },

    /**
     * Eliminar fila (función existente)
     */
    deleteRow() {
      if (!this.canModifyStructure(false)) return;
      // Buscar función de eliminación existente en el módulo
      if (typeof window.eliminarFila === 'function') {
        window.eliminarFila(this.currentRow);
      } else if (typeof window.deleteFila === 'function') {
        window.deleteFila(this.currentRow);
      } else {
        console.warn('⚠️ No se encontró función de eliminación');
        
        if (confirm('¿Estás seguro de eliminar este elemento?')) {
          this.currentRow.remove();
          alert('Elemento eliminado (solo visualmente, no persistido)');
        }
      }
    },

    /**
     * Cierra el menú contextual
     */
    closeMenu() {
      if (this.contextMenu) {
        this.contextMenu.style.display = 'none';
      }
      this.currentRow = null;
    }
  };

  // Exponer globalmente
  window.ContextMenuWizard = ContextMenuWizard;

  // Inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      // Esperar a que otros scripts estén listos
      setTimeout(() => ContextMenuWizard.init(), 500);
    });
  } else {
    setTimeout(() => ContextMenuWizard.init(), 500);
  }
})();
