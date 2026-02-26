/**
 * context-menu-wizard.js
 * Conecta el menú contextual con el wizard de inserción
 * Compatible con los 13 módulos (SUMMARY, RESUMEN, MÓDULOS)
 */

(() => {
  "use strict";

  const ContextMenuWizard = {
    contextMenu: null,
    currentRow: null,

    canModifyStructure(showAlert = true) {
      const flujo = window.__flujoAutorizacionInstance;
      let modoEdicion = false;

      if (flujo) {
        modoEdicion = Boolean(flujo.state?.editMode);
      }

      if (!modoEdicion && window.ModoEdicionPresupuesto?.estaActivo) {
        modoEdicion = window.ModoEdicionPresupuesto.estaActivo();
      }

      // Si no hay ningún sistema de edición disponible, permitir (para compatibilidad)
      if (!flujo && !window.ModoEdicionPresupuesto) {
        return true;
      }

      if (!modoEdicion && showAlert) {
        alert(
          '❌ No estás en modo edición\n\nHaz clic en "Cargar presupuesto" para activar el modo edición antes de usar el wizard.'
        );
      }

      return modoEdicion;
    },

    /**
     * Inicializa el sistema de menú contextual
     */
    init() {
      if (!window.location.pathname.includes("plantillas.html")) {
        console.log(
          "[ContextMenuWizard] Deshabilitado: Solo disponible en plantillas.html"
        );
        return;
      }

      this.contextMenu = document.getElementById("contextMenu");
      if (!this.contextMenu) {
        console.warn("⚠️ No se encontró el elemento #contextMenu");
        return;
      }

      this.attachEventListeners();
      console.log("✅ Context Menu Wizard inicializado");
    },

    /**
     * Adjunta event listeners
     */
    attachEventListeners() {
      // Capturar click derecho en toda la tabla
      const tables = document.querySelectorAll(
        "table tbody, .table-responsive"
      );
      tables.forEach((table) => {
        table.addEventListener("contextmenu", (e) => this.handleContextMenu(e));
      });

      // Click en items del menú
      const menuItems = this.contextMenu.querySelectorAll(".context-menu-item");
      menuItems.forEach((item) => {
        item.addEventListener("click", (e) => this.handleMenuAction(e));
      });

      // Cerrar menú al hacer click fuera
      document.addEventListener("click", () => this.closeMenu());

      // Cerrar menú con ESC
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") this.closeMenu();
      });
    },

    /**
     * Maneja el click derecho
     */
    handleContextMenu(e) {
      // Encontrar la fila más cercana
      const row = e.target.closest("tr");
      if (!row) return;
      if (!this.canModifyStructure(false)) return;
      e.preventDefault();

      this.currentRow = row;

      // Filtrar opciones según tipo de fila
      this.updateMenuOptions(row);

      // Posicionar menú
      const x = e.pageX;
      const y = e.pageY;

      this.contextMenu.style.left = `${x}px`;
      this.contextMenu.style.top = `${y}px`;
      this.contextMenu.style.display = "block";

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
      const addRowItem = this.contextMenu.querySelector(
        '[data-action="add-row"]'
      );
      const addSectionItem = this.contextMenu.querySelector(
        '[data-action="add-section"]'
      );
      const addOperationItem = this.contextMenu.querySelector(
        '[data-action="add-operation"]'
      );
      const editItem = this.contextMenu.querySelector(
        '[data-action="edit-row"]'
      );
      const deleteItem = this.contextMenu.querySelector(
        '[data-action="delete-row"]'
      );

      // Resetear visibilidad
      [
        addRowItem,
        addSectionItem,
        addOperationItem,
        editItem,
        deleteItem,
      ].forEach((item) => {
        if (item) item.style.display = "flex";
      });

      // Ocultar según tipo de fila
      if (
        row.classList.contains("sum-row") ||
        row.classList.contains("section-header-row")
      ) {
        if (addRowItem) addRowItem.style.display = "none";
        if (editItem) editItem.style.display = "none";
      }

      if (row.classList.contains("account-row")) {
        if (addSectionItem) addSectionItem.style.display = "none";
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
        case "add-row":
          this.openWizard("cuenta");
          break;

        case "add-section":
          this.openWizardSection();
          break;

        case "add-operation":
          this.openWizard("operacion");
          break;

        case "edit-row":
          this.editRow();
          break;

        case "delete-row":
          this.deleteRow();
          break;
      }
    },

    /**
     * Abre el wizard para agregar cuenta u operación
     */
    openWizard(type) {
      if (!this.canModifyStructure(false)) return;
      if (typeof InsertionWizard === "undefined") {
        console.error("❌ InsertionWizard no está disponible");
        alert("Error: Sistema de inserción no disponible");
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
      if (typeof InsertionWizard === "undefined") {
        console.error("❌ InsertionWizard no está disponible");
        alert("Error: Sistema de inserción no disponible");
        return;
      }

      // Detectar tipo de sección según contexto
      let sectionType = "secundaria";

      if (this.currentRow.classList.contains("section-header-row")) {
        // Click en una principal → crear otra principal
        sectionType = "principal";
      } else if (this.currentRow.classList.contains("subsection-row")) {
        // Click en una secundaria → crear otra secundaria
        sectionType = "secundaria";
      } else if (this.currentRow.classList.contains("account-row")) {
        // Click en cuenta → crear secundaria en su nivel
        sectionType = "secundaria";
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
      if (typeof window.editarFila === "function") {
        window.editarFila(this.currentRow);
      } else if (typeof window.habilitarEdicion === "function") {
        window.habilitarEdicion(this.currentRow);
      } else {
        console.warn("⚠️ No se encontró función de edición");
        alert("Función de edición no disponible en este módulo");
      }
    },

    /**
     * Eliminar fila (función existente)
     */
    deleteRow() {
      if (!this.canModifyStructure(false)) return;
      if (!this.currentRow) return;

      // Prioridad 1: Gestor de plantillas (actualiza estado + autosave)
      if (
        typeof window.deleteTemplateRowFromElement === "function" &&
        window.deleteTemplateRowFromElement(this.currentRow)
      ) {
        return;
      }

      // Prioridad 2: Módulos con CuentasModulo (sincroniza metadatos internos)
      if (
        window.CuentasModulo &&
        typeof window.CuentasModulo.eliminarFila === "function" &&
        window.CuentasModulo.eliminarFila(this.currentRow)
      ) {
        return;
      }

      // Fallback legacy
      if (typeof window.eliminarFila === "function") {
        window.eliminarFila(this.currentRow);
        return;
      }
      if (typeof window.deleteFila === "function") {
        window.deleteFila(this.currentRow);
        return;
      }

      console.warn("⚠️ No se encontró función de eliminación estructural");
      alert(
        "No se pudo eliminar este elemento de forma segura. Revisa el tipo de fila y usa el flujo de edición del módulo."
      );
    },

    /**
     * Cierra el menú contextual
     */
    closeMenu() {
      if (this.contextMenu) {
        this.contextMenu.style.display = "none";
      }
      this.currentRow = null;
    },
  };

  // Exponer globalmente
  window.ContextMenuWizard = ContextMenuWizard;

  // Inicializar cuando el DOM esté listo
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      // Esperar a que otros scripts estén listos
      setTimeout(() => ContextMenuWizard.init(), 500);
    });
  } else {
    setTimeout(() => ContextMenuWizard.init(), 500);
  }
})();
