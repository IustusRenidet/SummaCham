/**
 * operation-sync.js
 * Sistema de sincronización automática de operaciones
 * Actualiza operaciones cuando cambian secciones, subsecciones o cuentas
 */

(() => {
  "use strict";

  window.OperationSync = {
    /**
     * Verificar si una operación necesita actualizarse
     */
    needsUpdate(operation, currentLayout) {
      if (!operation.formula_terms || operation.formula_terms.length === 0) {
        return false;
      }

      const issues = [];

      operation.formula_terms.forEach((term, idx) => {
        if (term.type === "section") {
          // Verificar si la sección existe
          const sectionExists = this._sectionExists(
            term.value,
            currentLayout.cuentas
          );
          if (!sectionExists) {
            issues.push({
              index: idx,
              type: "missing_section",
              value: term.value,
              message: `Sección "${term.value}" ya no existe`,
            });
          }
        } else if (term.type === "account") {
          // Verificar si la cuenta existe
          const accountExists = currentLayout.cuentas.some(
            (c) => c.CUENTA === term.value
          );
          if (!accountExists) {
            issues.push({
              index: idx,
              type: "missing_account",
              value: term.value,
              message: `Cuenta "${term.value}" ya no existe`,
            });
          }
        } else if (term.type === "operation") {
          // Verificar si la operación referenciada existe
          const opExists = currentLayout.operaciones.some(
            (o) => o.Clase === term.value && o.Clase !== operation.Clase
          );
          if (!opExists) {
            issues.push({
              index: idx,
              type: "missing_operation",
              value: term.value,
              message: `Operación "${term.value}" ya no existe`,
            });
          }
        }
      });

      return {
        needsUpdate: issues.length > 0,
        issues,
      };
    },

    /**
     * Sugerir actualizaciones para una operación
     */
    suggestUpdates(operation, currentLayout, issues) {
      const suggestions = [];

      issues.forEach((issue) => {
        if (issue.type === "missing_section") {
          // Buscar secciones similares
          const similar = this._findSimilarSection(
            issue.value,
            currentLayout.cuentas
          );
          if (similar) {
            suggestions.push({
              index: issue.index,
              action: "replace",
              oldValue: issue.value,
              newValue: similar,
              message: `Reemplazar "${issue.value}" por "${similar}"`,
            });
          } else {
            suggestions.push({
              index: issue.index,
              action: "remove",
              oldValue: issue.value,
              message: `Eliminar término "${issue.value}"`,
            });
          }
        } else if (issue.type === "missing_account") {
          // Buscar cuentas similares
          const similar = this._findSimilarAccount(
            issue.value,
            currentLayout.cuentas
          );
          if (similar) {
            suggestions.push({
              index: issue.index,
              action: "replace",
              oldValue: issue.value,
              newValue: similar.CUENTA,
              message: `Reemplazar "${issue.value}" por "${similar.CUENTA}"`,
            });
          } else {
            suggestions.push({
              index: issue.index,
              action: "remove",
              oldValue: issue.value,
              message: `Eliminar término "${issue.value}"`,
            });
          }
        } else if (issue.type === "missing_operation") {
          suggestions.push({
            index: issue.index,
            action: "remove",
            oldValue: issue.value,
            message: `Eliminar referencia a operación "${issue.value}"`,
          });
        }
      });

      return suggestions;
    },

    /**
     * Aplicar sugerencias automáticamente
     */
    applyUpdates(operation, suggestions) {
      if (!operation.formula_terms) return false;

      let updated = false;

      // Ordenar sugerencias por índice descendente para evitar problemas al eliminar
      const sortedSuggestions = [...suggestions].sort(
        (a, b) => b.index - a.index
      );

      sortedSuggestions.forEach((suggestion) => {
        if (suggestion.action === "replace") {
          if (operation.formula_terms[suggestion.index]) {
            operation.formula_terms[suggestion.index].value =
              suggestion.newValue;
            updated = true;
          }
        } else if (suggestion.action === "remove") {
          operation.formula_terms.splice(suggestion.index, 1);
          updated = true;
        }
      });

      // Actualizar formula_json si existe
      if (updated && operation.formula_terms.length > 0) {
        operation.formula_json = JSON.stringify(operation.formula_terms);
      }

      return updated;
    },

    /**
     * Analizar todo el layout y reportar problemas
     */
    analyzeLayout(layout) {
      const report = {
        totalOperations: layout.operaciones?.length || 0,
        operationsWithIssues: 0,
        issues: [],
      };

      (layout.operaciones || []).forEach((op) => {
        const check = this.needsUpdate(op, layout);
        if (check.needsUpdate) {
          report.operationsWithIssues++;
          report.issues.push({
            operation: op.Clase,
            problems: check.issues,
          });
        }
      });

      return report;
    },

    /**
     * Mostrar modal con reporte de problemas
     */
    showAnalysisReport(report) {
      if (report.operationsWithIssues === 0) {
        return `
          <div class="alert alert-success">
            <i class="bi bi-check-circle me-2"></i>
            <strong>Todo está correcto</strong><br>
            No se encontraron problemas en las ${report.totalOperations} operaciones.
          </div>
        `;
      }

      let html = `
        <div class="alert alert-warning">
          <i class="bi bi-exclamation-triangle me-2"></i>
          <strong>Se encontraron ${report.operationsWithIssues} operaciones con problemas</strong>
        </div>
        <div class="sync-issues-list">
      `;

      report.issues.forEach((issue) => {
        html += `
          <div class="issue-card card mb-3">
            <div class="card-header bg-warning bg-opacity-25">
              <strong><i class="bi bi-calculator me-2"></i>${this._escapeHtml(
                issue.operation
              )}</strong>
            </div>
            <div class="card-body">
              <ul class="list-unstyled mb-0">
                ${issue.problems
                  .map(
                    (p) => `
                  <li class="mb-1">
                    <i class="bi bi-x-circle text-danger me-2"></i>
                    ${this._escapeHtml(p.message)}
                  </li>
                `
                  )
                  .join("")}
              </ul>
            </div>
          </div>
        `;
      });

      html += `</div>`;
      return html;
    },

    /**
     * Auto-reparar operaciones
     */
    autoFix(layout) {
      let fixedCount = 0;
      const changes = [];

      (layout.operaciones || []).forEach((op) => {
        const check = this.needsUpdate(op, layout);
        if (check.needsUpdate) {
          const suggestions = this.suggestUpdates(op, layout, check.issues);
          if (suggestions.length > 0) {
            const applied = this.applyUpdates(op, suggestions);
            if (applied) {
              fixedCount++;
              changes.push({
                operation: op.Clase,
                changes: suggestions.map((s) => s.message),
              });
            }
          }
        }
      });

      return {
        fixedCount,
        changes,
      };
    },

    // Utilidades privadas
    _sectionExists(sectionName, cuentas) {
      return cuentas.some((c) => {
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

    _findSimilarSection(sectionName, cuentas) {
      const sections = new Set();
      cuentas.forEach((c) => {
        const principal =
          c["SECCIÓN Principal"] ||
          c["SECCION Principal"] ||
          c.seccion_principal;
        const secundaria =
          c["SECCION Secundaria"] ||
          c["SECCIÓN Secundaria"] ||
          c.seccion_secundaria;

        if (principal) sections.add(principal);
        if (secundaria) sections.add(secundaria);
      });

      // Buscar coincidencia parcial
      const lowerName = sectionName.toLowerCase();
      for (const section of sections) {
        const lowerSection = section.toLowerCase();
        if (
          lowerSection.includes(lowerName) ||
          lowerName.includes(lowerSection)
        ) {
          return section;
        }
      }

      return null;
    },

    _findSimilarAccount(accountCode, cuentas) {
      // Buscar cuenta con código similar
      const similar = cuentas.find((c) => {
        if (!c.CUENTA) return false;
        const similarity = this._calculateSimilarity(accountCode, c.CUENTA);
        return similarity > 0.7;
      });

      return similar || null;
    },

    _calculateSimilarity(str1, str2) {
      if (!str1 || !str2) return 0;

      const longer = str1.length > str2.length ? str1 : str2;
      const shorter = str1.length > str2.length ? str2 : str1;

      if (longer.length === 0) return 1.0;

      const editDistance = this._levenshteinDistance(longer, shorter);
      return (longer.length - editDistance) / longer.length;
    },

    _levenshteinDistance(str1, str2) {
      const matrix = [];

      for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
      }

      for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
      }

      for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
          if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
            matrix[i][j] = matrix[i - 1][j - 1];
          } else {
            matrix[i][j] = Math.min(
              matrix[i - 1][j - 1] + 1,
              matrix[i][j - 1] + 1,
              matrix[i - 1][j] + 1
            );
          }
        }
      }

      return matrix[str2.length][str1.length];
    },

    _escapeHtml(text) {
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    },
  };

  // Integración con plantillas.js
  window.checkOperationsSync = function () {
    if (!window.state) return;

    const layout = {
      cuentas: window.state.cuentas || [],
      operaciones: window.state.operaciones || [],
    };

    const report = window.OperationSync.analyzeLayout(layout);

    // Crear modal
    const modal = document.createElement("div");
    modal.className = "modal fade";
    modal.innerHTML = `
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              <i class="bi bi-gear me-2"></i>Análisis de Operaciones
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            ${window.OperationSync.showAnalysisReport(report)}
          </div>
          <div class="modal-footer">
            ${
              report.operationsWithIssues > 0
                ? `
              <button type="button" class="btn btn-warning" onclick="autoFixOperations()">
                <i class="bi bi-wrench me-2"></i>Auto-reparar
              </button>
            `
                : ""
            }
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
  };

  window.autoFixOperations = function () {
    if (!window.state) return;

    const layout = {
      cuentas: window.state.cuentas || [],
      operaciones: window.state.operaciones || [],
    };

    const result = window.OperationSync.autoFix(layout);

    if (result.fixedCount > 0) {
      window.state.unsavedChanges = true;
      if (window.renderLayout) {
        window.renderLayout();
      }
      if (window.showToast) {
        window.showToast(
          `✅ Se repararon ${result.fixedCount} operaciones`,
          "success"
        );
      }

      // Cerrar modal actual y mostrar resumen
      const currentModal = document.querySelector(".modal.show");
      if (currentModal) {
        bootstrap.Modal.getInstance(currentModal)?.hide();
      }

      setTimeout(() => {
        alert(
          `Se aplicaron las siguientes correcciones:\n\n` +
            result.changes
              .map(
                (c) => `${c.operation}:\n  - ${c.changes.join("\n  - ")}`
              )
              .join("\n\n")
        );
      }, 300);
    } else {
      alert("No se pudieron aplicar correcciones automáticas");
    }
  };
})();
