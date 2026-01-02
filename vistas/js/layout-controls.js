/**
 * layout-controls.js
 * Controles avanzados para gestión de visibilidad, orden y vista previa
 * Complementa plantillas.js con funcionalidades de presentación
 */

(() => {
  "use strict";

  const ROW_LABEL_FIELDS =
    window.ROW_LABEL_FIELDS || [
      "sum-row",
      "sum-row-sumavarios",
      "sum-row-sumavarios-consolidado",
      "sum-row-operativo",
      "sum-row-operativo-consolidado",
      "result-row",
      "net-row",
      "net-row-adicional",
      "result-net-row",
    ];

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

      // Organizar cuentas por sección y preparar operaciones ordenadas
      const sections = this._groupBySections(layoutData.cuentas || []);
      const orderedOps = this._sortOperations(layoutData.operaciones || []);
      const renderedOps = new Set();

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

          const matchingOps = this._findInlineOperations(
            orderedOps,
            principal,
            secundaria || principal
          );

          const combinedRows = [
            ...cuentas.map((cuenta, idx) => ({
              type: "account",
              order: cuenta.orden_presentacion ?? cuenta.orden ?? idx + 1,
              data: cuenta,
            })),
            ...matchingOps.map((op, idx) => ({
              type: "operation",
              order: this._getOperationOrder(op, idx),
              data: op,
            })),
          ].sort((a, b) => a.order - b.order);

          combinedRows.forEach((row) => {
            if (row.type === "account") {
              const cuenta = row.data;
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
            } else {
              const op = row.data;
              renderedOps.add(op.Clase || op.SECCION || op.id);
              html += this._renderOperationRow(
                op,
                selectedMonths.length,
                showSampleData,
                showHiddenRows,
                true
              );
            }
          });
        });
      });

      // Operaciones restantes (sección/global) en orden de aparición
      orderedOps
        .filter((op) => !renderedOps.has(op.Clase || op.SECCION || op.id))
        .forEach((op) => {
          html += this._renderOperationRow(
            op,
            selectedMonths.length,
            showSampleData,
            showHiddenRows,
            false
          );
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

    _findInlineOperations(operaciones, principal, subseccion) {
      const principalLower = (principal || "").toLowerCase();
      const subsectionLower = (subseccion || "").toLowerCase();
      const isIncomeSection = principalLower.includes("income");
      const isExpenseSection = principalLower.includes("expense");

      return (operaciones || []).filter((op) => {
        const clase = (op.Clase || "").toLowerCase();
        const isIncomeOp = clase.includes("income");
        const isExpenseOp = clase.includes("expense");

        if (isIncomeSection && isExpenseOp) return false;
        if (isExpenseSection && isIncomeOp) return false;

        if (
          op.parentSubsection &&
          op.parentSubsection.toLowerCase() === subsectionLower
        ) {
          if (op.parentSection) {
            return op.parentSection.toLowerCase() === principalLower;
          }
          return true;
        }

        const claseNorm = clase.replace(/[-_\s]/g, "");
        const subsectionNorm = subsectionLower.replace(/[-_\s]/g, "");

        if (claseNorm.includes(subsectionNorm) || subsectionNorm.includes(claseNorm)) {
          if (!op.secciones || op.secciones.length <= 1) {
            return true;
          }
        }

        if (Array.isArray(op.secciones)) {
          return op.secciones.some(
            (sec) => sec && sec.toLowerCase() === subseccion.toLowerCase()
          );
        }

        return false;
      });
    },

    _getOperationOrder(op, fallback = 0) {
      const raw = op?.orden_presentacion ?? op?.orden ?? op?.Orden ?? op?.index;
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : fallback;
    },

    _sortOperations(list = []) {
      return [...(list || [])]
        .map((op, idx) => ({ op, idx }))
        .sort(
          (a, b) =>
            this._getOperationOrder(a.op, a.idx) -
            this._getOperationOrder(b.op, b.idx)
        )
        .map((item) => item.op);
    },

    _renderOperationRow(op, monthCount, showSampleData, showHiddenRows, isInline) {
      const isVisible = op.visible !== false;
      const hideClass = !isVisible && !showHiddenRows ? "hidden-preview-row" : "";
      const sampleValues = showSampleData
        ? this._generateSampleData(monthCount, true)
        : Array(monthCount).fill(0);
      const total = sampleValues.reduce((a, b) => a + b, 0);

      const label = this._getOperationLabel(op);
      const badges = this._buildOperationBadges(op);
      const formula = this._buildFormulaSummary(op);

      return `
        <tr class="operation-row ${hideClass}">
          <td colspan="2" class="fw-bold ${isInline ? "ps-5" : ""}">
            ${isVisible ? "" : "🔒 "}
            <i class="bi bi-calculator me-2"></i>${label}
            ${badges}
            <div class="small text-muted fw-normal">${formula}</div>
          </td>
          ${sampleValues
            .map((v) => `<td class="text-end">${this._formatMoney(v)}</td>`)
            .join("")}
          <td class="text-end fw-bold">${this._formatMoney(total)}</td>
        </tr>
      `;
    },

    _getOperationLabel(op) {
      for (const field of ROW_LABEL_FIELDS) {
        if (op[field]) {
          return this._escapeHtml(op[field]);
        }
      }
      return this._escapeHtml(op.Clase || op.SECCION || "Operación");
    },

    _buildOperationBadges(op) {
      const badges = [];
      ROW_LABEL_FIELDS.forEach((field) => {
        if (op[field]) {
          const color = field.includes("net")
            ? "danger"
            : field.includes("operativo")
              ? "primary"
              : field.includes("consolidado")
                ? "info"
                : field.includes("sumavarios")
                  ? "success"
                  : "secondary";
          badges.push(
            `<span class="badge bg-${color} ms-1 text-uppercase">${field}</span>`
          );
        }
      });

      if (!badges.length && op.tipo) {
        badges.push(
          `<span class="badge bg-warning text-dark ms-1">${this._escapeHtml(
            op.tipo
          )}</span>`
        );
      }

      return badges.join("");
    },

    _buildFormulaSummary(op) {
      if (Array.isArray(op.formula_terms) && op.formula_terms.length) {
        return op.formula_terms
          .map((term, idx) => {
            const prefix =
              idx === 0
                ? term.operator === "-"
                  ? "-"
                  : ""
                : ` ${term.operator} `;
            return `${prefix}${term.value || term.constValue || ""}`;
          })
          .join("");
      }

      if (Array.isArray(op.secciones) && op.secciones.length) {
        return op.secciones.join(" + ");
      }

      return op.SECCION || op.Clase || "";
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
