/**
 * layout-controls.js
 * Controles avanzados para gestión de visibilidad, orden y vista previa
 * Complementa plantillas.js con funcionalidades de presentación
 */

(() => {
  "use strict";

  window.LayoutControls = {
    /**
     * Agregar controles de visibilidad a una fila de cuenta
     */
    renderVisibilityControl(item, type = "account") {
      const isVisible = item.visible !== undefined ? item.visible : true;
      const id = type === "account" ? item.CUENTA : item.Clase;

      return `
        <div class="visibility-control">
          <input 
            type="checkbox" 
            class="form-check-input" 
            id="vis_${this._sanitizeId(id)}"
            ${isVisible ? "checked" : ""}
            onchange="LayoutControls.toggleVisibility('${this._escapeAttr(
              id
            )}', '${type}', this.checked)"
            title="${isVisible ? "Visible" : "Oculto"}"
          />
          <label class="form-check-label" for="vis_${this._sanitizeId(id)}">
            <i class="bi bi-${isVisible ? "eye" : "eye-slash"}"></i>
          </label>
        </div>
      `;
    },

    /**
     * Agregar controles de orden
     */
    renderOrderControl(item, type = "account") {
      const orden = item.orden_presentacion || item.orden || 0;
      const id = type === "account" ? item.CUENTA : item.Clase;

      return `
        <div class="order-control">
          <button 
            type="button" 
            class="btn btn-sm btn-outline-secondary"
            onclick="LayoutControls.moveUp('${this._escapeAttr(id)}', '${type}')"
            title="Subir">
            <i class="bi bi-arrow-up"></i>
          </button>
          <input 
            type="number" 
            class="form-control form-control-sm" 
            value="${orden}"
            min="0"
            onchange="LayoutControls.setOrder('${this._escapeAttr(
              id
            )}', '${type}', parseInt(this.value))"
            title="Orden de presentación"
          />
          <button 
            type="button" 
            class="btn btn-sm btn-outline-secondary"
            onclick="LayoutControls.moveDown('${this._escapeAttr(
              id
            )}', '${type}')"
            title="Bajar">
            <i class="bi bi-arrow-down"></i>
          </button>
        </div>
      `;
    },

    /**
     * Toggle visibilidad de un elemento
     */
    toggleVisibility(id, type, isVisible) {
      if (!window.state) return;

      if (type === "account") {
        const cuenta = window.state.cuentas.find((c) => c.CUENTA === id);
        if (cuenta) {
          cuenta.visible = isVisible;
          window.state.unsavedChanges = true;
        }
      } else if (type === "operation") {
        const op = window.state.operaciones.find((o) => o.Clase === id);
        if (op) {
          op.visible = isVisible;
          window.state.unsavedChanges = true;
        }
      }

      // Actualizar UI
      if (window.renderLayout) {
        window.renderLayout();
      }
      if (window.updateButtonStates) {
        window.updateButtonStates();
      }
    },

    /**
     * Establecer orden específico
     */
    setOrder(id, type, orden) {
      if (!window.state) return;

      if (type === "account") {
        const cuenta = window.state.cuentas.find((c) => c.CUENTA === id);
        if (cuenta) {
          cuenta.orden_presentacion = orden;
          window.state.unsavedChanges = true;
        }
      } else if (type === "operation") {
        const op = window.state.operaciones.find((o) => o.Clase === id);
        if (op) {
          op.orden_presentacion = orden;
          window.state.unsavedChanges = true;
        }
      }

      // Re-renderizar para aplicar nuevo orden
      if (window.renderLayout) {
        window.renderLayout();
      }
      if (window.updateButtonStates) {
        window.updateButtonStates();
      }
    },

    /**
     * Mover elemento hacia arriba
     */
    moveUp(id, type) {
      if (!window.state) return;

      const collection = type === "account" ? window.state.cuentas : window.state.operaciones;
      const keyField = type === "account" ? "CUENTA" : "Clase";
      const item = collection.find((i) => i[keyField] === id);

      if (!item) return;

      const currentOrder = item.orden_presentacion || item.orden || 0;
      const newOrder = Math.max(0, currentOrder - 1);

      // Intercambiar con el elemento que tiene el orden anterior
      const other = collection.find(
        (i) =>
          i[keyField] !== id &&
          (i.orden_presentacion || i.orden || 0) === newOrder
      );

      if (other) {
        other.orden_presentacion = currentOrder;
      }

      item.orden_presentacion = newOrder;
      window.state.unsavedChanges = true;

      if (window.renderLayout) {
        window.renderLayout();
      }
      if (window.updateButtonStates) {
        window.updateButtonStates();
      }
    },

    /**
     * Mover elemento hacia abajo
     */
    moveDown(id, type) {
      if (!window.state) return;

      const collection = type === "account" ? window.state.cuentas : window.state.operaciones;
      const keyField = type === "account" ? "CUENTA" : "Clase";
      const item = collection.find((i) => i[keyField] === id);

      if (!item) return;

      const currentOrder = item.orden_presentacion || item.orden || 0;
      const newOrder = currentOrder + 1;

      // Intercambiar con el elemento que tiene el orden siguiente
      const other = collection.find(
        (i) =>
          i[keyField] !== id &&
          (i.orden_presentacion || i.orden || 0) === newOrder
      );

      if (other) {
        other.orden_presentacion = currentOrder;
      }

      item.orden_presentacion = newOrder;
      window.state.unsavedChanges = true;

      if (window.renderLayout) {
        window.renderLayout();
      }
      if (window.updateButtonStates) {
        window.updateButtonStates();
      }
    },

    /**
     * Renderizar vista previa realista con datos simulados
     */
    renderRealisticPreview(layoutData, options = {}) {
      const {
        showHiddenRows = false,
        showSampleData = true,
        monthsToShow = 3,
      } = options;

      const meses = [
        "Enero",
        "Febrero",
        "Marzo",
        "Abril",
        "Mayo",
        "Junio",
        "Julio",
        "Agosto",
        "Septiembre",
        "Octubre",
        "Noviembre",
        "Diciembre",
      ];

      const selectedMonths = meses.slice(0, monthsToShow);

      let html = `
        <div class="preview-controls mb-3">
          <div class="btn-group btn-group-sm" role="group">
            <input type="checkbox" class="btn-check" id="toggleHidden" ${
              showHiddenRows ? "checked" : ""
            }>
            <label class="btn btn-outline-secondary" for="toggleHidden">
              <i class="bi bi-eye-slash me-1"></i>Mostrar ocultos
            </label>
            
            <input type="checkbox" class="btn-check" id="toggleData" ${
              showSampleData ? "checked" : ""
            }>
            <label class="btn btn-outline-secondary" for="toggleData">
              <i class="bi bi-database me-1"></i>Datos de ejemplo
            </label>
          </div>
        </div>

        <div class="table-responsive">
          <table class="table table-sm table-bordered preview-table-realistic">
            <thead>
              <tr class="table-dark">
                <th style="width: 120px">Cuenta</th>
                <th style="min-width: 200px">Descripción</th>
                ${selectedMonths
                  .map(
                    (m) =>
                      `<th class="text-end" style="width: 120px">${m}</th>`
                  )
                  .join("")}
                <th class="text-end" style="width: 120px">Total</th>
              </tr>
            </thead>
            <tbody>
      `;

      // Organizar cuentas por sección
      const sections = this._groupBySections(layoutData.cuentas || []);

      sections.forEach(({ principal, subsections }) => {
        // Fila de sección principal
        html += `
          <tr class="section-row">
            <td colspan="${3 + selectedMonths.length}">
              <strong><i class="bi bi-folder2 me-2"></i>${this._escapeHtml(
                principal
              )}</strong>
            </td>
          </tr>
        `;

        subsections.forEach(({ secundaria, cuentas }) => {
          // Fila de subsección
          if (secundaria) {
            html += `
              <tr class="subsection-row">
                <td colspan="${3 + selectedMonths.length}" class="ps-4">
                  <em><i class="bi bi-folder me-2"></i>${this._escapeHtml(
                    secundaria
                  )}</em>
                </td>
              </tr>
            `;
          }

          // Cuentas
          cuentas.forEach((cuenta) => {
            const isVisible = cuenta.visible !== false;
            const hideClass =
              !isVisible && !showHiddenRows ? "hidden-preview-row" : "";
            const dimClass = !isVisible ? "text-muted" : "";

            const sampleValues = showSampleData
              ? this._generateSampleData(selectedMonths.length)
              : Array(selectedMonths.length).fill(0);

            const total = sampleValues.reduce((a, b) => a + b, 0);

            html += `
              <tr class="${hideClass} ${dimClass}">
                <td class="ps-5 small">${
                  isVisible ? "" : '🔒 '
                }${this._escapeHtml(cuenta.CUENTA || "")}</td>
                <td class="ps-5">${this._escapeHtml(
                  cuenta.NOMBRE || cuenta.nombre || ""
                )}</td>
                ${sampleValues
                  .map((v) => `<td class="text-end">${this._formatMoney(v)}</td>`)
                  .join("")}
                <td class="text-end fw-bold">${this._formatMoney(total)}</td>
              </tr>
            `;
          });
        });
      });

      // Operaciones
      (layoutData.operaciones || []).forEach((op) => {
        const isVisible = op.visible !== false;
        const hideClass =
          !isVisible && !showHiddenRows ? "hidden-preview-row" : "";

        const sampleValues = showSampleData
          ? this._generateSampleData(selectedMonths.length, true)
          : Array(selectedMonths.length).fill(0);

        const total = sampleValues.reduce((a, b) => a + b, 0);

        html += `
          <tr class="operation-row ${hideClass}">
            <td colspan="2" class="fw-bold">
              ${isVisible ? "" : "🔒 "}
              <i class="bi bi-calculator me-2"></i>${this._escapeHtml(
                op.Clase || ""
              )}
            </td>
            ${sampleValues
              .map((v) => `<td class="text-end">${this._formatMoney(v)}</td>`)
              .join("")}
            <td class="text-end fw-bold">${this._formatMoney(total)}</td>
          </tr>
        `;
      });

      html += `
            </tbody>
          </table>
        </div>
      `;

      return html;
    },

    /**
     * Agrupar cuentas por secciones
     */
    _groupBySections(cuentas) {
      const sections = new Map();

      // Ordenar por orden_presentacion o orden
      const sortedCuentas = [...cuentas].sort((a, b) => {
        const orderA = a.orden_presentacion ?? a.orden ?? 0;
        const orderB = b.orden_presentacion ?? b.orden ?? 0;
        return orderA - orderB;
      });

      sortedCuentas.forEach((cuenta) => {
        const principal =
          cuenta["SECCIÓN Principal"] ||
          cuenta["SECCION Principal"] ||
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

      // Convertir a array
      const result = [];
      sections.forEach((subsections, principal) => {
        const subsectionArray = [];
        subsections.forEach((cuentas, secundaria) => {
          subsectionArray.push({ secundaria, cuentas });
        });
        result.push({ principal, subsections: subsectionArray });
      });

      return result;
    },

    /**
     * Generar datos de ejemplo
     */
    _generateSampleData(count, isTotal = false) {
      const values = [];
      for (let i = 0; i < count; i++) {
        const base = isTotal ? 50000 : 1000;
        const variation = isTotal ? 20000 : 500;
        values.push(base + Math.random() * variation);
      }
      return values;
    },

    /**
     * Formatear dinero
     */
    _formatMoney(value) {
      return new Intl.NumberFormat("es-MX", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    },

    // Utilidades
    _sanitizeId(id) {
      return (id || "").toString().replace(/[^a-zA-Z0-9_-]/g, "_");
    },

    _escapeHtml(text) {
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    },

    _escapeAttr(text) {
      return (text || "")
        .toString()
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    },
  };
})();
