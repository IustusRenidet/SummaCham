/**
 * operation-debugger.js
 * Herramienta de diagnóstico para verificar cómo se pueblan las operaciones
 */

(() => {
  "use strict";

  window.OperationDebugger = {
    /**
     * Analizar una operación específica y mostrar cómo se construye
     */
    analyzeOperation(operationName) {
      if (!window.state) return null;

      const op = window.state.operaciones.find(
        (o) => o.Clase === operationName
      );
      if (!op) {
        return {
          error: `Operación "${operationName}" no encontrada`,
        };
      }

      const analysis = {
        name: op.Clase,
        type: this._detectOperationType(op),
        rawData: {
          SECCION: op.SECCION,
          CAPITULO: op.CAPITULO,
          tipo: op.tipo,
          signos: op.signos,
          _autoBuilt: op._autoBuilt,
        },
        formulaTerms: op.formula_terms || [],
        constructedFrom: [],
        isAutoBuilt: !!op._autoBuilt,
        validation: {
          isValid: true,
          issues: [],
        },
      };

      // Verificar de dónde vienen los términos
      if (op._autoBuilt) {
        analysis.constructedFrom.push("🔄 AUTO-CONSTRUIDO (en tiempo real)");
      } else if (op.formula_json) {
        analysis.constructedFrom.push("formula_json (guardado)");
      } else if (op.formula_terms && op.formula_terms.length > 0) {
        analysis.constructedFrom.push("formula_terms (en memoria)");
      } else if (op.signos && Object.keys(op.signos).length > 0) {
        analysis.constructedFrom.push("signos + seccion_N (formato legacy)");
      } else if (op.SECCION) {
        analysis.constructedFrom.push("SECCION (auto-construido)");
      }

      // Validar cada término
      if (analysis.formulaTerms.length > 0) {
        analysis.formulaTerms.forEach((term, idx) => {
          const termValidation = this._validateTerm(term, idx);
          if (!termValidation.isValid) {
            analysis.validation.isValid = false;
            analysis.validation.issues.push(...termValidation.issues);
          }
        });
      } else {
        analysis.validation.isValid = false;
        analysis.validation.issues.push(
          "No se encontraron términos de fórmula"
        );
      }

      // Simular cálculo
      analysis.calculation = this._simulateCalculation(analysis.formulaTerms);

      return analysis;
    },

    /**
     * Analizar todas las operaciones consolidadas
     */
    analyzeConsolidatedOperations() {
      if (!window.state) return [];

      const consolidated = window.state.operaciones.filter((op) => {
        const name = (op.Clase || "").toLowerCase();
        return (
          name.includes("consolidated") ||
          name.includes("consolidado") ||
          name.includes("total")
        );
      });

      return consolidated.map((op) => this.analyzeOperation(op.Clase));
    },

    /**
     * Mostrar reporte visual de operación
     */
    showOperationReport(operationName) {
      const analysis = this.analyzeOperation(operationName);
      if (!analysis) return;

      if (analysis.error) {
        alert(analysis.error);
        return;
      }

      const modal = document.createElement("div");
      modal.className = "modal fade";
      modal.innerHTML = `
        <div class="modal-dialog modal-xl">
          <div class="modal-content">
            <div class="modal-header bg-primary text-white">
              <h5 class="modal-title">
                <i class="bi bi-bug me-2"></i>Diagnóstico: ${this._escapeHtml(
                  analysis.name
                )}
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              ${this._renderAnalysisReport(analysis)}
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
              ${
                !analysis.validation.isValid
                  ? `
                <button type="button" class="btn btn-warning" onclick="OperationDebugger.repairOperation('${this._escapeAttr(
                  analysis.name
                )}')">
                  <i class="bi bi-wrench me-2"></i>Intentar Reparar
                </button>
              `
                  : ""
              }
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
     * Mostrar reporte de todas las operaciones consolidadas
     */
    showConsolidatedReport() {
      const analyses = this.analyzeConsolidatedOperations();

      if (analyses.length === 0) {
        alert("No se encontraron operaciones consolidadas en este layout");
        return;
      }

      const modal = document.createElement("div");
      modal.className = "modal fade";
      modal.innerHTML = `
        <div class="modal-dialog modal-xl">
          <div class="modal-content">
            <div class="modal-header bg-info text-white">
              <h5 class="modal-title">
                <i class="bi bi-collection me-2"></i>Operaciones Consolidadas (${
                  analyses.length
                })
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              ${analyses.map((a) => this._renderMiniReport(a)).join("")}
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
     * Intentar reparar una operación
     */
    repairOperation(operationName) {
      if (!window.state) return;

      const op = window.state.operaciones.find(
        (o) => o.Clase === operationName
      );
      if (!op) return;

      // Forzar reconstrucción
      delete op.formula_terms;
      delete op.formula_json;

      // Hidratar de nuevo
      if (window.hydrateOperationsFromParents) {
        window.state.operaciones = [op];
        window.hydrateOperationsFromParents();
        op = window.state.operaciones[0];
      }

      // Recargar layout completo
      if (window.renderLayout) {
        window.renderLayout();
      }

      alert(
        `Operación "${operationName}" reparada.\n\nNuevos términos: ${
          op.formula_terms?.length || 0
        }\n\nRecuerda GUARDAR los cambios.`
      );

      // Cerrar modal actual
      const currentModal = document.querySelector(".modal.show");
      if (currentModal) {
        bootstrap.Modal.getInstance(currentModal)?.hide();
      }
    },

    // Métodos privados
    _detectOperationType(op) {
      const name = (op.Clase || "").toLowerCase();
      if (name.includes("consolidated")) return "Consolidado Multi-Capítulo";
      if (name.includes("total")) return "Total";
      if (name.includes("result")) return "Resultado";
      if (name.includes("income")) return "Ingreso";
      if (name.includes("expense")) return "Gasto";
      return "Operación Estándar";
    },

    _validateTerm(term, index) {
      const issues = [];
      let isValid = true;

      if (!term.value && term.type !== "constant") {
        issues.push(`Término ${index + 1}: sin valor definido`);
        isValid = false;
      }

      if (term.type === "section") {
        // Verificar que la sección existe
        const exists = this._sectionExists(term.value);
        if (!exists) {
          issues.push(
            `Término ${index + 1}: Sección "${term.value}" no encontrada`
          );
          isValid = false;
        }
      } else if (term.type === "account") {
        // Verificar que la cuenta existe
        const exists = window.state.cuentas.some(
          (c) => c.CUENTA === term.value
        );
        if (!exists) {
          issues.push(
            `Término ${index + 1}: Cuenta "${term.value}" no encontrada`
          );
          isValid = false;
        }
      } else if (term.type === "operation") {
        // Verificar que la operación existe
        const exists = window.state.operaciones.some(
          (o) => o.Clase === term.value
        );
        if (!exists) {
          issues.push(
            `Término ${index + 1}: Operación "${term.value}" no encontrada`
          );
          isValid = false;
        }
      }

      return { isValid, issues };
    },

    _sectionExists(sectionName) {
      if (!window.state) return false;
      return window.state.cuentas.some((c) => {
        const principal =
          c["SECCIÓN Principal"] ||
          c["SECCION Principal"] ||
          c.seccion_principal ||
          "";
        const secundaria =
          c["SECCION Secundaria"] ||
          c["SECCIÓN Secundaria"] ||
          c.seccion_secundaria ||
          "";
        return (
          principal.toLowerCase() === sectionName.toLowerCase() ||
          secundaria.toLowerCase() === sectionName.toLowerCase()
        );
      });
    },

    _simulateCalculation(terms) {
      if (!terms || terms.length === 0) {
        return {
          formula: "(vacío)",
          steps: [],
        };
      }

      const steps = terms.map((term, idx) => {
        const op = idx === 0 ? "" : term.operator;
        const value = term.value || term.constant || "?";
        return `${op} ${value}`.trim();
      });

      return {
        formula: steps.join(" "),
        steps: steps,
        termsCount: terms.length,
      };
    },

    _renderAnalysisReport(analysis) {
      const statusClass = analysis.validation.isValid ? "success" : "warning";
      const statusIcon = analysis.validation.isValid ? "check-circle-fill" : "exclamation-triangle-fill";

      // Renderizar solo el mapa visual
      const mapRows = analysis.formulaTerms.map((term, idx) => {
        const validation = this._validateTerm(term, idx);
        const statusBadge = validation.isValid
          ? '<span class="badge bg-success">✓</span>'
          : '<span class="badge bg-danger">✗</span>';
        
        const colorClass = {
          "+": "success",
          "-": "danger",
          "*": "warning",
          "/": "info",
        }[term.operator] || "secondary";

        const iconClass = {
          section: "bi-folder2",
          account: "bi-file-text",
          operation: "bi-calculator",
          constant: "bi-hash",
        }[term.type] || "bi-question";

        return `
          <div class="d-flex align-items-center gap-3 p-2 mb-2 bg-light rounded">
            ${
              idx > 0
                ? `<span class="badge bg-${colorClass} fs-5 px-3 py-2">${term.operator}</span>`
                : '<span style="width: 42px;"></span>'
            }
            <i class="bi ${iconClass} text-primary fs-4"></i>
            <span class="fw-semibold flex-grow-1">${this._escapeHtml(term.value || term.constant || "(vacío)")}</span>
            ${statusBadge}
          </div>
        `;
      }).join("");

      return `
        <div class="analysis-report">
          <!-- Estado General -->
          <div class="alert alert-${statusClass} mb-3">
            <div class="d-flex align-items-center gap-2">
              <i class="bi bi-${statusIcon} fs-4"></i>
              <div>
                <strong>${analysis.validation.isValid ? "Válida ✓" : "Requiere Atención ⚠"}</strong>
                <div class="small">
                  ${analysis.formulaTerms.length} términos · ${analysis.type}
                  ${analysis.isAutoBuilt ? ' · <span class="badge bg-info"><i class="bi bi-lightning-fill"></i> Auto-construido</span>' : ''}
                </div>
              </div>
            </div>
          </div>

          <!-- Mapa Visual -->
          <div class="mb-3">
            ${mapRows || '<p class="text-muted">No hay términos definidos</p>'}
          </div>

          <!-- Fórmula Resultante -->
          <div class="p-3 bg-primary bg-opacity-10 border border-primary rounded">
            <div class="fw-bold mb-2">Resultado:</div>
            <code class="fs-6">${this._escapeHtml(analysis.calculation.formula)}</code>
          </div>

          <!-- Problemas (si hay) -->
          ${
            analysis.validation.issues.length > 0
              ? `
            <div class="alert alert-warning mt-3">
              <strong>⚠️ Problemas:</strong>
              <ul class="mb-0 mt-2">
                ${analysis.validation.issues.map((issue) => `<li>${this._escapeHtml(issue)}</li>`).join("")}
              </ul>
            </div>
          `
              : ""
          }
        </div>
      `;
    },

    _renderMiniReport(analysis) {
      const statusClass = analysis.validation.isValid
        ? "success"
        : "warning";
      const statusIcon = analysis.validation.isValid
        ? "check-circle-fill"
        : "exclamation-triangle-fill";

      return `
        <div class="card mb-3">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start">
              <div class="flex-grow-1">
                <h6 class="card-title mb-1">
                  <i class="bi bi-${statusIcon} text-${statusClass} me-2"></i>
                  ${this._escapeHtml(analysis.name)}
                </h6>
                <p class="card-text text-muted mb-2">
                  ${analysis.formulaTerms.length} términos · ${analysis.type}
                </p>
                <code class="small">${this._escapeHtml(
                  analysis.calculation.formula
                )}</code>
              </div>
              <button 
                class="btn btn-sm btn-outline-primary" 
                onclick="OperationDebugger.showOperationReport('${this._escapeAttr(
                  analysis.name
                )}')">
                <i class="bi bi-zoom-in"></i> Ver Detalle
              </button>
            </div>
          </div>
        </div>
      `;
    },

    _escapeHtml(text) {
      const div = document.createElement("div");
      div.textContent = text || "";
      return div.innerHTML;
    },

    _escapeAttr(text) {
      return (text || "")
        .toString()
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    },
  };

  // Función global de acceso rápido
  window.debugOperation = function (operationName) {
    window.OperationDebugger.showOperationReport(operationName);
  };

  window.showConsolidatedOperations = function () {
    window.OperationDebugger.showConsolidatedReport();
  };
})();
