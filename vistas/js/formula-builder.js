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
      console.log("FormulaBuilder.init llamado con:", operation);

      this.currentOperationId = operation?.id || null;
      this.availableElements = availableElements || {
        sections: [],
        accounts: [],
        operations: [],
      };

      console.log("Elementos disponibles:", this.availableElements);

      // PRIORIDAD 1: Si la operación ya tiene formula_terms poblados, usarlos directamente
      if (
        operation?.formula_terms &&
        Array.isArray(operation.formula_terms) &&
        operation.formula_terms.length > 0
      ) {
        console.log(
          "✅ Usando formula_terms directamente:",
          operation.formula_terms
        );
        this.terms = operation.formula_terms.map((t, idx) => ({
          id: t.id || Date.now() + idx,
          operator: t.operator || "+",
          type: t.type || "section",
          value: t.value || "",
          constant: t.constant || null,
        }));
      }
      // PRIORIDAD 2: Intentar parsear formula_json
      else if (operation?.formula_json) {
        console.log("📋 Parseando formula_json:", operation.formula_json);
        try {
          this.terms = JSON.parse(operation.formula_json);
        } catch (e) {
          console.warn("Error parseando formula_json, usando _parseFromLegacy");
          this.terms = this._parseFromLegacy(operation);
        }
      }
      // PRIORIDAD 3: Parsear desde formato legacy
      else if (operation) {
        console.log("🔄 Parseando desde formato legacy");
        this.terms = this._parseFromLegacy(operation);
      } else {
        this.terms = [];
      }

      console.log("✨ Términos finales cargados:", this.terms);

      // Si no hay términos, agregar uno inicial
      if (this.terms.length === 0) {
        console.warn("⚠️ No hay términos, agregando uno por defecto");
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
        // Re-renderizar para actualizar el desglose
        this.render();
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
        // Re-renderizar para actualizar el desglose
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
        // Re-renderizar para actualizar el desglose
        this.render();
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
            term.type === "constant" ? term.constant : term.value || "(vacío)";
          return `${op} ${val}`.trim();
        })
        .join(" ");
    },

    /**
     * Renderizar constructor en el DOM
     */
    render() {
      console.log("🎨 render() - Renderizando términos:", this.terms);
      const container = document.getElementById("formulaBuilderContainer");
      if (!container) {
        console.error("❌ No se encontró #formulaBuilderContainer");
        return;
      }

      console.log(
        "✅ Container encontrado, renderizando",
        this.terms.length,
        "términos"
      );

      const html = `
        <div class="formula-builder-wrapper">
          <div class="alert alert-info mb-3">
            <i class="bi bi-info-circle me-2"></i>
            <strong>Constructor de Fórmula:</strong> Define qué suma esta operación. Ejemplo: "Resultado Operativo = (Suma de Ingresos) - (Suma de Gastos)"
          </div>
          <div class="formula-terms-list">
            ${this.terms
              .map((term, idx) => this._renderTerm(term, idx))
              .join("")}
          </div>
          <div class="formula-actions mt-3">
            <button type="button" class="btn btn-sm btn-outline-success" onclick="FormulaBuilder.addTerm()">
              <i class="bi bi-plus-circle me-1"></i>Agregar término
            </button>
          </div>
        </div>
      `;

      container.innerHTML = html;
    },

    _normalizeKey(value) {
      return (value || "")
        .toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    },

    _sortByTableOrder(items, valueGetter) {
      if (!Array.isArray(items)) return items || [];
      if (!Array.isArray(this.orderedElements) || !this.orderedElements.length) {
        return items;
      }

      const orderMap = new Map();
      this.orderedElements.forEach((value, idx) => {
        const key = this._normalizeKey(value);
        if (key && !orderMap.has(key)) {
          orderMap.set(key, idx);
        }
      });

      return items
        .map((item, idx) => ({
          item,
          idx,
          order: orderMap.get(this._normalizeKey(valueGetter(item))),
        }))
        .sort((a, b) => {
          const aOrder =
            Number.isFinite(a.order) ? a.order : Number.MAX_SAFE_INTEGER;
          const bOrder =
            Number.isFinite(b.order) ? b.order : Number.MAX_SAFE_INTEGER;
          if (aOrder === bOrder) return a.idx - b.idx;
          return aOrder - bOrder;
        })
        .map((entry) => entry.item);
    },

    /**
     * Renderizar un término individual
     */
    _renderTerm(term, index) {
      console.log(`🔨 _renderTerm[${index}]:`, term);
      const isFirst = index === 0;
      const operators = [
        { value: "+", label: "+", title: "Sumar" },
        { value: "-", label: "−", title: "Restar" },
        { value: "*", label: "×", title: "Multiplicar" },
        { value: "/", label: "÷", title: "Dividir" },
      ];

      const types = [
        { value: "section", label: "Sección/Suma" },
        { value: "account", label: "Cuenta" },
        { value: "operation", label: "Operación" },
        { value: "constant", label: "Número" },
      ];

      // Opciones según el tipo
      let valueInput = "";
      switch (term.type) {
        case "section":
          // Garantizar que la opción actual exista aunque no esté en el catálogo
          let sectionOptions = [...this.availableElements.sections];
          if (term.value && !sectionOptions.includes(term.value)) {
            sectionOptions.unshift(term.value);
          }
          sectionOptions = this._sortByTableOrder(
            sectionOptions,
            (value) => value
          );
          valueInput = `
            <select class="form-select" onchange="FormulaBuilder.updateValue(${
              term.id
            }, this.value)">
              <option value="">Seleccionar sección...</option>
              ${sectionOptions
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
          let accountOptions = [...this.availableElements.accounts];
          if (
            term.value &&
            !accountOptions.some((a) => a.code === term.value)
          ) {
            accountOptions.unshift({ code: term.value, name: term.value });
          }
          accountOptions = this._sortByTableOrder(
            accountOptions,
            (value) => value.code
          );
          valueInput = `
            <select class="form-select" onchange="FormulaBuilder.updateValue(${
              term.id
            }, this.value)">
              <option value="">Seleccionar cuenta...</option>
              ${accountOptions
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
          let operationOptions = [...this.availableElements.operations];
          if (term.value && !operationOptions.includes(term.value)) {
            operationOptions.unshift(term.value);
          }
          operationOptions = this._sortByTableOrder(
            operationOptions,
            (value) => value
          );
          valueInput = `
            <select class="form-select" onchange="FormulaBuilder.updateValue(${
              term.id
            }, this.value)">
              <option value="">Seleccionar operación...</option>
              ${operationOptions
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
                   onchange="FormulaBuilder.updateValue(${
                     term.id
                   }, this.value)" />
          `;
          break;
      }

      // Generar desglose si el término tiene valor
      let breakdownHtml = "";
      if (term.value || term.constant) {
        const breakdown = this._getTermBreakdown(term);
        if (breakdown) {
          breakdownHtml = breakdown;
        }
      }

      return `
        <div class="formula-term-row mb-4" data-term-id="${term.id}">
          <div class="row g-2 align-items-start">
            <div class="col-auto" style="width: 80px;">
              <select class="form-select" 
                      onchange="FormulaBuilder.updateOperator(${
                        term.id
                      }, this.value)"
                      ${
                        isFirst
                          ? 'disabled title="Primer término siempre positivo"'
                          : ""
                      }>
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
              <select class="form-select" onchange="FormulaBuilder.updateType(${
                term.id
              }, this.value)">
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
          ${breakdownHtml}
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
        alert(
          "Completa todos los términos primero:\n" +
            validation.errors.join("\n")
        );
        return;
      }

      // Crear modal LIMPIO con solo visualización
      const mapHtml = this._generateMapVisualization();
      const modal = document.createElement("div");
      modal.className = "modal fade";
      modal.innerHTML = `
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content border-0 shadow-lg">
            <div class="modal-header border-0 pb-0">
              <h5 class="modal-title fw-bold">
                <i class="bi bi-diagram-3 me-2 text-primary"></i>Mapa de Operación
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body px-4 py-3">
              ${mapHtml}
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

        const iconClass =
          {
            section: "bi-folder2",
            account: "bi-file-text",
            operation: "bi-calculator",
            constant: "bi-hash",
          }[term.type] || "bi-question";

        const colorClass =
          {
            "+": "success",
            "-": "danger",
            "*": "warning",
            "/": "info",
          }[term.operator] || "secondary";

        const operatorBg =
          {
            "+": "#28a745",
            "-": "#dc3545",
            "*": "#ffc107",
            "/": "#17a2b8",
          }[term.operator] || "#6c757d";

        return `
          <div class="d-flex align-items-center gap-3 mb-2">
            ${
              idx > 0
                ? `<div class="d-flex align-items-center justify-content-center rounded-circle text-white fw-bold" style="width: 40px; height: 40px; background: ${operatorBg}; font-size: 20px; flex-shrink: 0;">
                    ${operator}
                  </div>`
                : '<div style="width: 40px; flex-shrink: 0;"></div>'
            }
            <div class="flex-grow-1 p-2 px-3 bg-light rounded-2">
              <span class="fw-semibold" style="font-size: 14px;">${this._escapeHtml(
                valueLabel
              )}</span>
            </div>
          </div>
        `;
      });

      return `
        <div class="formula-map">
          ${rows.join("")}
          <div class="mt-3 p-3 rounded-2" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
            <code class="text-white d-block fw-semibold" style="font-size: 14px; background: transparent; border: 0;">${this.getFormulaText()}</code>
          </div>
        </div>
      `;
    },

    /**
     * Obtener descripción del término (como aparece en las tablas)
     * Muestra solo el texto descriptivo de lo que representa el término
     * Como en Membresía.html, Eventos.html, etc: la columna DESCRIPCIÓN
     */
    _getTermBreakdown(term) {
      if (!term.value && !term.constant) return null;

      switch (term.type) {
        case "section":
          return `
            <div class="term-breakdown">
              <div class="fw-semibold" style="font-size: 13px; color: #1e3a8a;">
                ${this._escapeHtml(term.value)}
              </div>
            </div>
          `;

        case "operation":
          return `
            <div class="term-breakdown">
              <div class="fw-semibold" style="font-size: 13px; color: #7c3aed;">
                ${this._escapeHtml(term.value)}
              </div>
            </div>
          `;

        case "account": {
          // Buscar el nombre de la cuenta en el estado
          const state = window.state || (window.parent && window.parent.state);
          let accountName = "";
          if (state && state.cuentas) {
            const cuenta = state.cuentas.find(
              (c) => c.CUENTA === term.value || c.cuenta === term.value
            );
            if (cuenta) {
              accountName =
                cuenta.NOMBRE || cuenta.nombre || cuenta.DESCRIPCION || "";
            }
          }
          return `
            <div class="term-breakdown">
              <div class="fw-semibold" style="font-size: 13px; color: #059669;">
                ${this._escapeHtml(accountName || term.value)}
              </div>
            </div>
          `;
        }

        case "constant":
          return `
            <div class="term-breakdown">
              <div class="fw-semibold" style="font-size: 13px; color: #6b7280;">
                Constante: ${this._escapeHtml(
                  String(term.constant || term.value)
                )}
              </div>
            </div>
          `;

        default:
          return null;
      }
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

/**
 * Actualizar términos disponibles en los dropdowns del constructor
 * Recibe un array de elementos en orden visual de la tabla
 */
window.FormulaBuilder.updateAvailableTerms = function (orderedElements) {
  if (!Array.isArray(orderedElements)) return;

  // Guardar para uso posterior en los dropdowns
  this.orderedElements = orderedElements;

  // Si hay términos actualmente renderizados, re-renderizar para actualizar dropdowns
  if (this.terms && this.terms.length > 0) {
    this.render();
  }

  console.log(
    "✅ FormulaBuilder: Términosextualizados en orden de tabla:",
    orderedElements.length,
    "elementos"
  );
};
