/**
 * formula-builder.js
 * Constructor visual avanzado de fórmulas para operaciones
 * Soporta: suma (+), resta (-), multiplicación (*), división (/)
 * Permite combinar: cuentas, secciones, operaciones y constantes
 */

(() => {
  "use strict";

  // Estado del constructor
  window.FormulaBuilder = {
    terms: [],
    currentOperationId: null,
    
    /**
     * Inicializar constructor con operación existente
     */
    init(operation, availableElements) {
      this.currentOperationId = operation?.id || null;
      this.availableElements = availableElements || {
        sections: [],
        accounts: [],
        operations: [],
      };

      // Cargar términos existentes o crear uno vacío
      if (operation?.formula_json) {
        try {
          this.terms = JSON.parse(operation.formula_json);
        } catch (e) {
          this.terms = this._parseFromLegacy(operation);
        }
      } else if (operation) {
        this.terms = this._parseFromLegacy(operation);
      } else {
        this.terms = [];
      }

      // Si no hay términos, agregar uno inicial
      if (this.terms.length === 0) {
        this.addTerm();
      }

      this.render();
    },

    /**
     * Parsear operación legacy a términos
     */
    _parseFromLegacy(op) {
      const terms = [];
      
      if (op.formula_terms && Array.isArray(op.formula_terms)) {
        return op.formula_terms.map((t, idx) => ({
          id: Date.now() + idx,
          operator: t.operator || "+",
          type: t.type || "section",
          value: t.value || "",
          constant: t.constant || null,
        }));
      }

      // Extraer de campos seccion_1, seccion_2, etc.
      Object.keys(op || {})
        .filter((k) => /^(seccion|operacion|cuenta)_\d+$/i.test(k))
        .sort((a, b) => {
          const numA = parseInt(a.match(/_(\d+)$/)?.[1] || "0");
          const numB = parseInt(b.match(/_(\d+)$/)?.[1] || "0");
          return numA - numB;
        })
        .forEach((key, idx) => {
          const value = op[key];
          if (!value) return;

          const signo = op.signos?.[key];
          const operator = signo < 0 ? "-" : "+";
          const type = key.startsWith("operacion")
            ? "operation"
            : key.startsWith("cuenta")
            ? "account"
            : "section";

          terms.push({
            id: Date.now() + idx,
            operator,
            type,
            value,
            constant: null,
          });
        });

      return terms;
    },

    /**
     * Agregar nuevo término
     */
    addTerm(operator = "+", type = "section", value = "") {
      this.terms.push({
        id: Date.now() + Math.random(),
        operator,
        type,
        value,
        constant: null,
      });
      this.render();
    },

    /**
     * Eliminar término
     */
    removeTerm(termId) {
      this.terms = this.terms.filter((t) => t.id !== termId);
      if (this.terms.length === 0) {
        this.addTerm(); // Siempre mantener al menos 1
      }
      this.render();
    },

    /**
     * Actualizar operador de un término
     */
    updateOperator(termId, operator) {
      const term = this.terms.find((t) => t.id === termId);
      if (term) {
        term.operator = operator;
        this.updatePreview();
      }
    },

    /**
     * Actualizar tipo de término
     */
    updateType(termId, type) {
      const term = this.terms.find((t) => t.id === termId);
      if (term) {
        term.type = type;
        term.value = "";
        term.constant = null;
        this.render();
      }
    },

    /**
     * Actualizar valor de término
     */
    updateValue(termId, value) {
      const term = this.terms.find((t) => t.id === termId);
      if (term) {
        if (term.type === "constant") {
          term.constant = parseFloat(value) || 0;
          term.value = "";
        } else {
          term.value = value;
          term.constant = null;
        }
        this.updatePreview();
      }
    },

    /**
     * Validar que todos los términos sean válidos
     */
    validate() {
      const errors = [];

      this.terms.forEach((term, idx) => {
        if (term.type === "constant") {
          if (term.constant === null || isNaN(term.constant)) {
            errors.push(`Término ${idx + 1}: constante inválida`);
          }
        } else if (!term.value || term.value.trim() === "") {
          errors.push(`Término ${idx + 1}: selecciona un valor`);
        }
      });

      return {
        isValid: errors.length === 0,
        errors,
      };
    },

    /**
     * Obtener fórmula como JSON para guardar
     */
    getFormulaJSON() {
      return JSON.stringify(this.terms);
    },

    /**
     * Obtener fórmula como texto legible
     */
    getFormulaText() {
      return this.terms
        .map((term, idx) => {
          const op = idx === 0 && term.operator === "+" ? "" : term.operator;
          const val =
            term.type === "constant"
              ? term.constant
              : term.value || "(vacío)";
          return `${op} ${val}`.trim();
        })
        .join(" ");
    },

    /**
     * Renderizar constructor en el DOM
     */
    render() {
      const container = document.getElementById("formulaBuilderContainer");
      if (!container) return;

      const html = `
        <div class="formula-builder-wrapper">
          <div class="formula-terms-list">
            ${this.terms.map((term, idx) => this._renderTerm(term, idx)).join("")}
          </div>
          <div class="formula-actions mt-3">
            <button type="button" class="btn btn-sm btn-outline-success" onclick="FormulaBuilder.addTerm()">
              <i class="bi bi-plus-circle me-1"></i>Agregar término
            </button>
            <button type="button" class="btn btn-sm btn-outline-primary" onclick="FormulaBuilder.suggestFromName()">
              <i class="bi bi-magic me-1"></i>Sugerir desde nombre
            </button>
            <button type="button" class="btn btn-sm btn-outline-info" onclick="FormulaBuilder.showMap()">
              <i class="bi bi-diagram-3 me-1"></i>Ver mapa visual
            </button>
          </div>
          <div class="formula-preview mt-4">
            <label class="form-label fw-bold">Vista previa de fórmula:</label>
            <div class="formula-preview-box" id="formulaPreviewBox">
              ${this.getFormulaText() || "(vacío)"}
            </div>
          </div>
        </div>
      `;

      container.innerHTML = html;
    },

    /**
     * Renderizar un término individual
     */
    _renderTerm(term, index) {
      const isFirst = index === 0;
      const operators = [
        { value: "+", label: "+", title: "Sumar" },
        { value: "-", label: "−", title: "Restar" },
        { value: "*", label: "×", title: "Multiplicar" },
        { value: "/", label: "÷", title: "Dividir" },
      ];

      const types = [
        { value: "section", label: "Sección" },
        { value: "account", label: "Cuenta" },
        { value: "operation", label: "Operación" },
        { value: "constant", label: "Número fijo" },
      ];

      // Opciones según el tipo
      let valueInput = "";
      switch (term.type) {
        case "section":
          valueInput = `
            <select class="form-select" onchange="FormulaBuilder.updateValue(${term.id}, this.value)">
              <option value="">Seleccionar sección...</option>
              ${this.availableElements.sections
                .map(
                  (s) =>
                    `<option value="${this._escapeAttr(s)}" ${
                      term.value === s ? "selected" : ""
                    }>${this._escapeHtml(s)}</option>`
                )
                .join("")}
            </select>
          `;
          break;

        case "account":
          valueInput = `
            <select class="form-select" onchange="FormulaBuilder.updateValue(${term.id}, this.value)">
              <option value="">Seleccionar cuenta...</option>
              ${this.availableElements.accounts
                .map(
                  (acc) =>
                    `<option value="${this._escapeAttr(acc.code)}" ${
                      term.value === acc.code ? "selected" : ""
                    }>${this._escapeHtml(acc.code)} - ${this._escapeHtml(
                      acc.name
                    )}</option>`
                )
                .join("")}
            </select>
          `;
          break;

        case "operation":
          valueInput = `
            <select class="form-select" onchange="FormulaBuilder.updateValue(${term.id}, this.value)">
              <option value="">Seleccionar operación...</option>
              ${this.availableElements.operations
                .map(
                  (op) =>
                    `<option value="${this._escapeAttr(op)}" ${
                      term.value === op ? "selected" : ""
                    }>${this._escapeHtml(op)}</option>`
                )
                .join("")}
            </select>
          `;
          break;

        case "constant":
          valueInput = `
            <input type="number" class="form-control" step="0.01" 
                   value="${term.constant || ""}" 
                   placeholder="0.00"
                   onchange="FormulaBuilder.updateValue(${term.id}, this.value)" />
          `;
          break;
      }

      return `
        <div class="formula-term-row mb-3" data-term-id="${term.id}">
          <div class="row g-2">
            <div class="col-auto" style="width: 80px;">
              <select class="form-select" 
                      onchange="FormulaBuilder.updateOperator(${term.id}, this.value)"
                      ${isFirst ? 'disabled title="Primer término siempre positivo"' : ""}>
                ${operators
                  .map(
                    (o) =>
                      `<option value="${o.value}" ${
                        term.operator === o.value ? "selected" : ""
                      } title="${o.title}">${o.label}</option>`
                  )
                  .join("")}
              </select>
            </div>
            <div class="col-auto" style="width: 140px;">
              <select class="form-select" onchange="FormulaBuilder.updateType(${term.id}, this.value)">
                ${types
                  .map(
                    (t) =>
                      `<option value="${t.value}" ${
                        term.type === t.value ? "selected" : ""
                      }>${t.label}</option>`
                  )
                  .join("")}
              </select>
            </div>
            <div class="col">
              ${valueInput}
            </div>
            <div class="col-auto">
              <button type="button" class="btn btn-outline-danger" 
                      onclick="FormulaBuilder.removeTerm(${term.id})"
                      ${this.terms.length <= 1 ? "disabled" : ""}>
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    },

    /**
     * Actualizar solo la vista previa
     */
    updatePreview() {
      const preview = document.getElementById("formulaPreviewBox");
      if (preview) {
        preview.textContent = this.getFormulaText() || "(vacío)";
      }
    },

    /**
     * Sugerir términos desde el nombre de la operación
     */
    suggestFromName() {
      const nameInput = document.getElementById("editClaseOp");
      if (!nameInput?.value) {
        alert("Primero ingresa un nombre para la operación");
        return;
      }

      const suggested = window.buildFormulaTermsFromParent?.(nameInput.value);
      if (!suggested || suggested.length === 0) {
        alert("No se encontraron sugerencias para este nombre");
        return;
      }

      if (
        this.terms.length > 0 &&
        !confirm("¿Reemplazar la fórmula actual con las sugerencias?")
      ) {
        return;
      }

      this.terms = suggested.map((t) => ({
        id: Date.now() + Math.random(),
        operator: t.operator || "+",
        type: t.type || "section",
        value: t.value || "",
        constant: null,
      }));

      this.render();
    },

    /**
     * Mostrar mapa visual de la operación
     */
    showMap() {
      const validation = this.validate();
      if (!validation.isValid) {
        alert("Completa todos los términos primero:\n" + validation.errors.join("\n"));
        return;
      }

      // Crear modal SIMPLE con solo visualización
      const mapHtml = this._generateMapVisualization();
      const modal = document.createElement("div");
      modal.className = "modal fade";
      modal.innerHTML = `
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header bg-primary text-white">
              <h5 class="modal-title">
                <i class="bi bi-diagram-3 me-2"></i>Mapa de Operación
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body p-4">
              ${mapHtml}
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
      const bsModal = new bootstrap.Modal(modal);
      bsModal.show();

      modal.addEventListener("hidden.bs.modal", () => {
        document.body.removeChild(modal);
      });
    },

    /**
     * Generar visualización del mapa
     */
    _generateMapVisualization() {
      const rows = this.terms.map((term, idx) => {
        const operator = idx === 0 ? "" : term.operator;

        const valueLabel =
          term.type === "constant"
            ? term.constant
            : term.value || "(sin valor)";

        const iconClass = {
          section: "bi-folder2",
          account: "bi-file-text",
          operation: "bi-calculator",
          constant: "bi-hash",
        }[term.type] || "bi-question";

        const colorClass = {
          "+": "success",
          "-": "danger",
          "*": "warning",
          "/": "info",
        }[term.operator] || "secondary";

        return `
          <div class="d-flex align-items-center gap-3 p-2 mb-2 bg-light rounded">
            ${
              idx > 0
                ? `<span class="badge bg-${colorClass} fs-5 px-3 py-2">${operator}</span>`
                : '<span style="width: 42px;"></span>'
            }
            <i class="bi ${iconClass} text-primary fs-4"></i>
            <span class="fw-semibold">${this._escapeHtml(valueLabel)}</span>
          </div>
        `;
      });

      return `
        <div class="formula-map">
          ${rows.join("")}
          <div class="mt-3 p-3 bg-primary bg-opacity-10 border border-primary rounded">
            <div class="fw-bold mb-2">Resultado:</div>
            <code class="fs-6">${this.getFormulaText()}</code>
          </div>
        </div>
      `;
    },

    // Utilidades
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
