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
      const canEdit = window.state?.editMode !== false;
      const disabledAttr = canEdit ? "" : "disabled";

      return `
        <div class="visibility-control">
          <input 
            type="checkbox" 
            class="form-check-input" 
            id="vis_${this._sanitizeId(id)}"
            ${isVisible ? "checked" : ""}
            ${disabledAttr}
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
      const orden = item.orden_presentacion ?? item.orden ?? 0;
      const id = type === "account" ? item.CUENTA : item.Clase;
      const canEdit = window.state?.editMode !== false;
      const disabledAttr = canEdit ? "" : "disabled";

      return `
        <div class="order-control">
          <button 
            type="button" 
            class="btn btn-sm btn-outline-secondary"
            ${disabledAttr}
            onclick="LayoutControls.moveUp('${this._escapeAttr(id)}', '${type}')"
            title="Subir">
            <i class="bi bi-arrow-up"></i>
          </button>
          <input 
            type="number" 
            class="form-control form-control-sm" 
            value="${orden}"
            min="0"
            ${disabledAttr}
            onchange="LayoutControls.setOrder('${this._escapeAttr(
              id
            )}', '${type}', parseInt(this.value))"
            title="Orden de presentación"
          />
          <button 
            type="button" 
            class="btn btn-sm btn-outline-secondary"
            ${disabledAttr}
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

      const currentOrder = item.orden_presentacion ?? item.orden ?? 0;
      const newOrder = Math.max(0, currentOrder - 1);

      // Intercambiar con el elemento que tiene el orden anterior
      const other = collection.find(
        (i) =>
          i[keyField] !== id &&
          (i.orden_presentacion ?? i.orden ?? 0) === newOrder
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

      const currentOrder = item.orden_presentacion ?? item.orden ?? 0;
      const newOrder = currentOrder + 1;

      // Intercambiar con el elemento que tiene el orden siguiente
      const other = collection.find(
        (i) =>
          i[keyField] !== id &&
          (i.orden_presentacion ?? i.orden ?? 0) === newOrder
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

      const moduloClave = (layoutData.modulo || "").toString().toUpperCase();
      const selectedMonths = meses.slice(0, monthsToShow);
      const rows = this._buildPreviewRows(layoutData);
      const isResumen = moduloClave === "RESUMEN" || moduloClave === "SUMMARY";
      const headerCols = isResumen
        ? [
            { label: "Cuenta", width: "120px", align: "start" },
            { label: "Real", width: "110px", align: "end" },
            { label: "Ppto.", width: "110px", align: "end" },
            { label: "Real DIC 2024", width: "130px", align: "end" },
            { label: "B/(W)% vs. Ppto.", width: "140px", align: "end" },
            { label: "B/(W)% vs. Real DIC 2024", width: "170px", align: "end" },
            { label: "Descripcion", width: "200px", align: "start" },
            { label: "Real Acumulado", width: "140px", align: "end" },
            { label: "Ppto. Acumulado", width: "150px", align: "end" },
            { label: "Real Acum 2024", width: "130px", align: "end" },
          ]
        : [
            { label: "Cuenta", width: "120px", align: "start" },
            { label: "Descripcion", width: "200px", align: "start" },
            ...selectedMonths.map((m) => ({
              label: m,
              width: "120px",
              align: "end",
            })),
            { label: "Total", width: "120px", align: "end" },
          ];

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
                ${headerCols
                  .map(
                    (col) =>
                      `<th class="text-${col.align}" style="width:${col.width}">${col.label}</th>`
                  )
                  .join("")}
              </tr>
            </thead>
            <tbody>
      `;

      const colCount = headerCols.length;

      rows.forEach((row) => {
        if (!row) return;
        const isVisible = this._isVisible(row.visible);
        if (!isVisible && !showHiddenRows) return;
        const dimClass = !isVisible ? "text-muted" : "";
        const hiddenPrefix = !isVisible ? "?? " : "";

        if (row.type === "principal") {
          html += `
            <tr class="section-row ${dimClass}">
              <td colspan="${colCount}">
                <strong><i class="bi bi-folder2 me-2"></i>${hiddenPrefix}${this._escapeHtml(
                  row.label || ""
                )}</strong>
              </td>
            </tr>
          `;
          return;
        }

        if (row.type === "subsection") {
          html += `
            <tr class="subsection-row ${dimClass}">
              <td colspan="${colCount}" class="ps-4">
                <em><i class="bi bi-folder me-2"></i>${hiddenPrefix}${this._escapeHtml(
                  row.label || ""
                )}</em>
              </td>
            </tr>
          `;
          return;
        }

        if (row.type === "account") {
          if (isResumen) {
            const sample = showSampleData
              ? this._generateSampleData(3)
              : [0, 0, 0];
            const real = sample[0];
            const ppto = sample[1];
            const realPrev = sample[2];
            const bwPpto = ppto ? ((real / ppto - 1) * 100) : 0;
            const bwPrev = realPrev ? ((real / realPrev - 1) * 100) : 0;
            const realAcum = real * 6;
            const pptoAcum = ppto * 6;
            const realPrevAcum = realPrev * 6;
            html += `
              <tr class="${dimClass}">
                <td class="ps-4 small">${hiddenPrefix}${this._escapeHtml(row.cuenta || "")}</td>
                <td class="text-end">${this._formatMoney(real)}</td>
                <td class="text-end fw-bold">${this._formatMoney(ppto)}</td>
                <td class="text-end">${this._formatMoney(realPrev)}</td>
                <td class="text-end">${bwPpto.toFixed(2)} %</td>
                <td class="text-end">${bwPrev.toFixed(2)} %</td>
                <td class="ps-4">${this._escapeHtml(row.nombre || row.cuenta || "")}</td>
                <td class="text-end fw-semibold">${this._formatMoney(realAcum)}</td>
                <td class="text-end">${this._formatMoney(pptoAcum)}</td>
                <td class="text-end">${this._formatMoney(realPrevAcum)}</td>
              </tr>
            `;
          } else {
            const sampleValues = showSampleData
              ? this._generateSampleData(selectedMonths.length)
              : Array(selectedMonths.length).fill(0);
            const total = sampleValues.reduce((a, b) => a + b, 0);
            html += `
              <tr class="${dimClass}">
                <td class="ps-5 small">${hiddenPrefix}${this._escapeHtml(
                  row.cuenta || ""
                )}</td>
                <td class="ps-5">${this._escapeHtml(
                  row.nombre || row.cuenta || ""
                )}</td>
                ${sampleValues
                  .map((v) => `<td class="text-end">${this._formatMoney(v)}</td>`)
                  .join("")}
                <td class="text-end fw-bold">${this._formatMoney(total)}</td>
              </tr>
            `;
          }
          return;
        }

        if (row.type === "operation") {
          if (isResumen) {
            const sample = showSampleData
              ? this._generateSampleData(3, true)
              : [0, 0, 0];
            const real = sample[0];
            const ppto = sample[1];
            const realPrev = sample[2];
            const bwPpto = ppto ? ((real / ppto - 1) * 100) : 0;
            const bwPrev = realPrev ? ((real / realPrev - 1) * 100) : 0;
            const realAcum = real * 6;
            const pptoAcum = ppto * 6;
            const realPrevAcum = realPrev * 6;
            html += `
              <tr class="operation-row ${row.kind || ""} ${dimClass}">
                <td class="ps-4 fw-bold" colspan="1">
                  ${hiddenPrefix}<i class="bi bi-calculator me-2"></i>${this._escapeHtml(row.label || "")}
                </td>
                <td class="text-end fw-semibold">${this._formatMoney(real)}</td>
                <td class="text-end fw-semibold">${this._formatMoney(ppto)}</td>
                <td class="text-end">${this._formatMoney(realPrev)}</td>
                <td class="text-end">${bwPpto.toFixed(2)} %</td>
                <td class="text-end">${bwPrev.toFixed(2)} %</td>
                <td class="ps-4 fw-bold">${this._escapeHtml(row.label || "")}</td>
                <td class="text-end fw-semibold">${this._formatMoney(realAcum)}</td>
                <td class="text-end">${this._formatMoney(pptoAcum)}</td>
                <td class="text-end">${this._formatMoney(realPrevAcum)}</td>
              </tr>
            `;
          } else {
            const sampleValues = showSampleData
              ? this._generateSampleData(selectedMonths.length, true)
              : Array(selectedMonths.length).fill(0);
            const total = sampleValues.reduce((a, b) => a + b, 0);
            html += `
              <tr class="operation-row ${row.kind || ""} ${dimClass}">
                <td colspan="2" class="fw-bold">
                  ${hiddenPrefix}
                  <i class="bi bi-calculator me-2"></i>${this._escapeHtml(
                    row.label || ""
                  )}
                </td>
                ${sampleValues
                  .map((v) => `<td class="text-end">${this._formatMoney(v)}</td>`)
                  .join("")}
                <td class="text-end fw-bold">${this._formatMoney(total)}</td>
              </tr>
            `;
          }
        }
      });

      html += `
            </tbody>
          </table>
        </div>
      `;

      return html;
    },

    _buildPreviewRows(layoutData = {}) {
      const modulo = (layoutData.modulo || "")
        .toString()
        .trim()
        .toUpperCase();
      if (modulo === "RESUMEN" || modulo === "SUMMARY") {
        return this._buildResumenPreviewRows(layoutData);
      }
      return this._buildModuloPreviewRows(layoutData);
    },

    _buildResumenPreviewRows(layoutData = {}) {
      const cuentas = Array.isArray(layoutData.cuentas)
        ? layoutData.cuentas
        : [];
      const operaciones = Array.isArray(layoutData.operaciones)
        ? layoutData.operaciones
        : [];

      const operacionesOrdenadas = Array.isArray(operaciones)
        ? operaciones
        : [];

      const configPorSeccion = new Map();
      const ordenPrincipal = new Map();

      const consolidatedOps = [];
      const operatingOps = [];
      const resultOps = [];
      const netOps = [];
      const finalOps = [];
      const opSeen = new Set();

      const recordOp = (label, kind, order, visible, bucket) => {
        const clean = this._cleanLabel(label);
        if (!clean) return;
        const key = `${kind}::${this._normalizeKey(clean)}`;
        if (opSeen.has(key)) return;
        opSeen.add(key);
        bucket.push({
          label: clean,
          kind,
          order,
          visible: this._isVisible(visible),
        });
      };

      operacionesOrdenadas.forEach((op, idx) => {
        const order = this._getOperationOrder(op, idx);
        const seccion = this._cleanLabel(op.SECCION || op.seccion);
        const seccionKey = seccion ? this._normalizeKey(seccion) : "";

        if (seccionKey) {
          const cfg = configPorSeccion.get(seccionKey) || { visible: false };
          if (op["sum-row"] && !cfg.sumRow) cfg.sumRow = op["sum-row"];
          if (op["sum-row-sumavarios"] && !cfg.principal) {
            cfg.principal = op["sum-row-sumavarios"];
          }
          if (this._isVisible(op.visible)) cfg.visible = true;
          configPorSeccion.set(seccionKey, cfg);
        }

        this._registerLabel(
          ordenPrincipal,
          op["sum-row-sumavarios"],
          order,
          op.visible
        );

        recordOp(
          op["sum-row-sumavarios-consolidado"],
          "sum-row-sumavarios-consolidado",
          order,
          op.visible,
          consolidatedOps
        );
        recordOp(
          op["sum-row-operativo"],
          "sum-row-operativo",
          order,
          op.visible,
          operatingOps
        );
        recordOp(
          op["sum-row-operativo-consolidado"],
          "sum-row-operativo-consolidado",
          order,
          op.visible,
          operatingOps
        );
        recordOp(op["result-row"], "result-row", order, op.visible, resultOps);
        recordOp(op["net-row"], "net-row", order, op.visible, netOps);
        recordOp(
          op["net-row-adicional"],
          "net-row-adicional",
          order,
          op.visible,
          netOps
        );
        recordOp(
          op["result-net-row"],
          "result-net-row",
          order,
          op.visible,
          finalOps
        );
      });

      const cuentasOrdenadas = [...cuentas].sort(
        (a, b) => this._getAccountOrder(a) - this._getAccountOrder(b)
      );

      const principalMap = new Map();
      const principalList = [];

      const ensurePrincipal = (label, order, visible) => {
        const clean = this._cleanLabel(label) || "Sin seccion";
        const key = this._normalizeKey(clean) || clean;
        if (!principalMap.has(key)) {
          const entry = {
            key,
            label: clean,
            order,
            visible: this._isVisible(visible),
            sections: new Map(),
            sectionList: [],
          };
          principalMap.set(key, entry);
          principalList.push(entry);
        }
        const principal = principalMap.get(key);
        if (order < principal.order) principal.order = order;
        if (this._isVisible(visible)) principal.visible = true;
        return principal;
      };

      const ensureSection = (principal, label, order, visible) => {
        const clean = this._cleanLabel(label) || principal.label;
        const key = this._normalizeKey(clean) || clean;
        if (!principal.sections.has(key)) {
          const entry = {
            key,
            label: clean,
            order,
            visible: this._isVisible(visible),
            accounts: [],
          };
          principal.sections.set(key, entry);
          principal.sectionList.push(entry);
        }
        const section = principal.sections.get(key);
        if (order < section.order) section.order = order;
        if (this._isVisible(visible)) section.visible = true;
        return section;
      };

      cuentasOrdenadas.forEach((cuenta, idx) => {
        const seccionSecundaria = this._cleanLabel(
          this._getFieldValue(cuenta, ["SECCION SECUNDARIA", "SECCION"])
        );
        const seccionKey = seccionSecundaria
          ? this._normalizeKey(seccionSecundaria)
          : "";
        const cfg = seccionKey ? configPorSeccion.get(seccionKey) : null;

        let principalLabel = this._cleanLabel(
          this._getFieldValue(cuenta, ["SECCION PRINCIPAL"])
        );
        if (!principalLabel && cfg?.principal) {
          principalLabel = this._cleanLabel(cfg.principal);
        }
        if (!principalLabel && seccionSecundaria) {
          principalLabel = seccionSecundaria;
        }
        if (!principalLabel) principalLabel = "Sin seccion";

        const principalOrder = this._resolveOrder(
          ordenPrincipal,
          principalLabel,
          this._getAccountOrder(cuenta, idx)
        );
        const principal = ensurePrincipal(
          principalLabel,
          principalOrder,
          cuenta.visible
        );

        const sectionLabel = seccionSecundaria || principalLabel;
        const sectionOrder = this._getAccountOrder(cuenta, idx);
        const section = ensureSection(
          principal,
          sectionLabel,
          sectionOrder,
          cuenta.visible
        );

        if (cfg?.visible) section.visible = true;
        section.accounts.push({
          cuenta: cuenta.CUENTA || cuenta.cuenta || "",
          nombre: cuenta.NOMBRE || cuenta.nombre || cuenta.CUENTA || "",
          visible: this._isVisible(cuenta.visible),
        });
      });

      this._sortedLabels(ordenPrincipal).forEach((item) => {
        ensurePrincipal(item.label, item.order, item.visible);
      });

      principalList.sort((a, b) => a.order - b.order);
      principalList.forEach((principal) => {
        principal.sectionList.sort((a, b) => a.order - b.order);
      });

      const rows = [];
      const usedOps = new Set();
      const opKey = (op) =>
        `${op.kind}::${this._normalizeKey(op.label || "")}`;
      const addOps = (ops = []) => {
        ops.forEach((op) => {
          rows.push({
            type: "operation",
            label: op.label,
            kind: op.kind,
            visible: op.visible,
          });
        });
      };

      const addPrincipalBlock = (principal) => {
        rows.push({
          type: "principal",
          label: principal.label,
          visible: principal.visible,
        });
        principal.sectionList.forEach((section) => {
          if (
            section.label &&
            this._normalizeKey(section.label) !==
              this._normalizeKey(principal.label)
          ) {
            rows.push({
              type: "subsection",
              label: section.label,
              visible: section.visible,
            });
          }
          section.accounts.forEach((account) => {
            rows.push({ type: "account", ...account });
          });
        });
      };

      const normalizeText = (value) => this._normalizeKey(value || "");
      const labelHas = (label, token) =>
        normalizeText(label).includes(normalizeText(token));
      const labelHasAll = (label, tokens) =>
        tokens.every((token) => labelHas(label, token));

      const isIncome = (label) =>
        labelHas(label, "INCOME") &&
        !labelHas(label, "OTHER") &&
        !labelHas(label, "CONSOLIDATED");
      const isExpense = (label) =>
        labelHas(label, "EXPENSE") && !labelHas(label, "CONSOLIDATED");
      const isMember = (label) =>
        labelHas(label, "MEMBER") || labelHas(label, "CENTRICITY");
      const isOther = (label) => labelHas(label, "OTHER");

      const incomePrincipals = principalList.filter((p) => isIncome(p.label));
      const expensePrincipals = principalList.filter((p) => isExpense(p.label));
      const memberPrincipals = principalList.filter((p) => isMember(p.label));
      const otherPrincipals = principalList.filter((p) => isOther(p.label));
      const restPrincipals = principalList.filter(
        (p) =>
          !isIncome(p.label) &&
          !isExpense(p.label) &&
          !isMember(p.label) &&
          !isOther(p.label)
      );

      const sortByOrder = (list) =>
        [...list].sort((a, b) => a.order - b.order);
      const consolidatedList = sortByOrder(consolidatedOps);
      const operatingList = sortByOrder(operatingOps);
      const resultList = sortByOrder(resultOps);
      const netList = sortByOrder(netOps);
      const finalList = sortByOrder(finalOps);

      const takeOps = (list, predicate) => {
        const out = [];
        list.forEach((op) => {
          const key = opKey(op);
          if (usedOps.has(key)) return;
          if (predicate && !predicate(op)) return;
          usedOps.add(key);
          out.push(op);
        });
        return out;
      };

      const regionOrder = [
        "MEXICO",
        "GUADALAJARA",
        "MONTERREY",
        "NORESTE",
        "NE",
        "NORTHWEST",
        "NOROESTE",
        "NO",
      ];

      const takeOpsByRegion = (list, predicate) => {
        const out = [];
        regionOrder.forEach((region) => {
          out.push(...takeOps(list, (op) => predicate(op, region)));
        });
        return out;
      };

      const capitulo = this._cleanLabel(layoutData.capitulo || "");
      const capKey = normalizeText(capitulo);
      const isConsolidatedChapter =
        capKey.includes("CIUDAD") ||
        capKey.includes("MEXICO") ||
        capKey.includes("CDMX");

      if (isConsolidatedChapter) {
        incomePrincipals.forEach(addPrincipalBlock);
        addOps(
          takeOps(consolidatedList, (op) =>
            labelHasAll(op.label, ["CONSOLIDATED", "INCOME"])
          )
        );

        expensePrincipals.forEach(addPrincipalBlock);
        addOps(
          takeOps(consolidatedList, (op) =>
            labelHasAll(op.label, ["CONSOLIDATED", "EXPENSE"])
          )
        );

        addOps(
          takeOpsByRegion(operatingList, (op, region) =>
            labelHasAll(op.label, ["OPERATING", "RESULT"]) &&
            labelHas(op.label, region) &&
            !labelHas(op.label, "CONSOLIDATED")
          )
        );

        addOps(
          takeOps(resultList, (op) =>
            labelHasAll(op.label, ["CONSOLIDATED", "OPERATING"])
          )
        );
        addOps(
          takeOps(operatingList, (op) =>
            labelHasAll(op.label, ["CONSOLIDATED", "OPERATING"])
          )
        );

        memberPrincipals.forEach(addPrincipalBlock);
        otherPrincipals.forEach(addPrincipalBlock);

        addOps(
          takeOps(consolidatedList, (op) =>
            labelHasAll(op.label, ["OTHER", "INCOME"])
          )
        );

        restPrincipals.forEach(addPrincipalBlock);

        addOps(
          takeOpsByRegion(netList, (op, region) =>
            labelHasAll(op.label, ["NET", "RESULT"]) &&
            labelHas(op.label, region)
          )
        );

        addOps(
          takeOps(finalList, (op) =>
            labelHasAll(op.label, ["CONSOLIDATED", "NET"])
          )
        );
        addOps(
          takeOps(netList, (op) =>
            labelHasAll(op.label, ["CONSOLIDATED", "NET"])
          )
        );
      } else {
        incomePrincipals.forEach(addPrincipalBlock);
        expensePrincipals.forEach(addPrincipalBlock);
        addOps(
          takeOps(operatingList, (op) =>
            labelHasAll(op.label, ["OPERATING", "RESULT"])
          )
        );
        addOps(
          takeOps(resultList, (op) =>
            labelHasAll(op.label, ["OPERATING", "RESULT"])
          )
        );
        memberPrincipals.forEach(addPrincipalBlock);
        otherPrincipals.forEach(addPrincipalBlock);
        restPrincipals.forEach(addPrincipalBlock);
        addOps(
          takeOps(netList, (op) => labelHasAll(op.label, ["NET", "RESULT"]))
        );
        addOps(
          takeOps(finalList, (op) => labelHasAll(op.label, ["NET", "RESULT"]))
        );
      }

      const remainingOps = [
        ...consolidatedList,
        ...operatingList,
        ...resultList,
        ...netList,
        ...finalList,
      ].sort((a, b) => a.order - b.order);
      addOps(takeOps(remainingOps));

      return rows;
    },

    _buildModuloPreviewRows(layoutData = {}) {
      const cuentas = Array.isArray(layoutData.cuentas)
        ? layoutData.cuentas
        : [];
      const operaciones = Array.isArray(layoutData.operaciones)
        ? layoutData.operaciones
        : [];

      const operacionesOrdenadas = Array.isArray(operaciones)
        ? operaciones
        : [];

      const configPorSeccion = new Map();
      const resultRows = [];
      const resultRowSeen = new Set();

      operacionesOrdenadas.forEach((op, idx) => {
        const seccion = this._cleanLabel(op.SECCION || op.seccion);
        const seccionKey = seccion ? this._normalizeKey(seccion) : "";
        if (seccionKey) {
          const cfg = configPorSeccion.get(seccionKey) || { visible: false };
          if (op["sum-row"] && !cfg.sumRow) cfg.sumRow = op["sum-row"];
          if (op["sum-row-sumavarios"] && !cfg.sumavarios) {
            cfg.sumavarios = op["sum-row-sumavarios"];
          }
          if (op["sum-row-sumavarios2"] && !cfg.sumavarios2) {
            cfg.sumavarios2 = op["sum-row-sumavarios2"];
          }
          if (op["result-row"] && !cfg.resultRow) {
            cfg.resultRow = op["result-row"];
          }
          if (this._isVisible(op.visible)) cfg.visible = true;
          configPorSeccion.set(seccionKey, cfg);
        }

        const resultLabel = this._cleanLabel(op["result-row"]);
        if (resultLabel) {
          const key = this._normalizeKey(resultLabel);
          if (!resultRowSeen.has(key)) {
            resultRowSeen.add(key);
            resultRows.push({
              label: resultLabel,
              order: this._getOperationOrder(op, idx),
              visible: this._isVisible(op.visible),
            });
          }
        }
      });

      const cuentasOrdenadas = [...cuentas].sort(
        (a, b) => this._getAccountOrder(a) - this._getAccountOrder(b)
      );

      const sectionMap = new Map();
      const sectionList = [];

      const ensureSection = (label, order, visible) => {
        const clean = this._cleanLabel(label) || "Sin seccion";
        const key = this._normalizeKey(clean) || clean;
        if (!sectionMap.has(key)) {
          const entry = {
            key,
            label: clean,
            order,
            visible: this._isVisible(visible),
            accounts: [],
          };
          sectionMap.set(key, entry);
          sectionList.push(entry);
        }
        const section = sectionMap.get(key);
        if (order < section.order) section.order = order;
        if (this._isVisible(visible)) section.visible = true;
        return section;
      };

      cuentasOrdenadas.forEach((cuenta, idx) => {
        let sectionLabel = this._cleanLabel(
          this._getFieldValue(cuenta, [
            "SECCION",
            "SECCION PRINCIPAL",
            "SECCION SECUNDARIA",
          ])
        );
        if (!sectionLabel) sectionLabel = "Sin seccion";
        const section = ensureSection(
          sectionLabel,
          this._getAccountOrder(cuenta, idx),
          cuenta.visible
        );
        section.accounts.push({
          cuenta: cuenta.CUENTA || cuenta.cuenta || "",
          nombre: cuenta.NOMBRE || cuenta.nombre || cuenta.CUENTA || "",
          visible: this._isVisible(cuenta.visible),
        });
      });

      sectionList.sort((a, b) => a.order - b.order);

      const sumavariosMap = new Map();
      let appearance = 0;

      sectionList.forEach((section, idx) => {
        const cfg = configPorSeccion.get(section.key) || {};
        const labels = [cfg.sumavarios, cfg.sumavarios2];
        labels.forEach((label) => {
          const clean = this._cleanLabel(label);
          if (!clean) return;
          const key = this._normalizeKey(clean) || clean;
          if (!sumavariosMap.has(key)) {
            sumavariosMap.set(key, {
              key,
              label: clean,
              firstIndex: appearance,
              lastSectionIndex: idx,
              visible: this._isVisible(cfg.visible),
            });
            appearance += 1;
            return;
          }
          const entry = sumavariosMap.get(key);
          entry.lastSectionIndex = idx;
          if (this._isVisible(cfg.visible)) entry.visible = true;
        });
      });

      const rows = [];
      const sectionLabelsForInsert = new Map();
      sumavariosMap.forEach((entry) => {
        if (!sectionLabelsForInsert.has(entry.lastSectionIndex)) {
          sectionLabelsForInsert.set(entry.lastSectionIndex, []);
        }
        sectionLabelsForInsert.get(entry.lastSectionIndex).push(entry);
      });

      sectionList.forEach((section, idx) => {
        rows.push({
          type: "principal",
          label: section.label,
          visible: section.visible,
        });

        section.accounts.forEach((account) => {
          rows.push({ type: "account", ...account });
        });

        const cfg = configPorSeccion.get(section.key) || {};
        const sumLabel =
          cfg.sumRow || (section.label ? `Suma ${section.label}` : "");
        if (sumLabel) {
          rows.push({
            type: "operation",
            label: this._cleanLabel(sumLabel),
            kind: "sum-row",
            visible: this._isVisible(cfg.visible ?? section.visible),
          });
        }

        const labelsHere = sectionLabelsForInsert.get(idx) || [];
        labelsHere
          .slice()
          .sort((a, b) => b.firstIndex - a.firstIndex)
          .forEach((entry) => {
            rows.push({
              type: "operation",
              label: entry.label,
              kind: "sum-row-sumavarios",
              visible: entry.visible,
            });
          });
      });

      let resultRow = null;
      if (resultRows.length) {
        resultRow = [...resultRows].sort((a, b) => a.order - b.order)[0];
      } else {
        sectionList.some((section) => {
          const cfg = configPorSeccion.get(section.key);
          if (cfg?.resultRow) {
            resultRow = {
              label: this._cleanLabel(cfg.resultRow),
              visible: this._isVisible(cfg.visible),
            };
            return true;
          }
          return false;
        });
      }

      if (resultRow?.label) {
        rows.push({
          type: "operation",
          label: resultRow.label,
          kind: "result-row",
          visible: this._isVisible(resultRow.visible),
        });
      }

      return rows;
    },
    _resolveOrder(orderMap, label, fallback = 0) {
      const clean = this._cleanLabel(label);
      if (!clean) return fallback;
      const key = this._normalizeKey(clean) || clean;
      const entry = orderMap.get(key);
      if (entry == null) return fallback;
      if (typeof entry === "number") return entry;
      if (typeof entry.order === "number") return entry.order;
      return fallback;
    },

    _registerLabel(map, label, idx, isVisible) {
      const clean = this._cleanLabel(label);
      if (!clean) return;
      const key = this._normalizeKey(clean) || clean;
      const current = map.get(key);
      if (!current) {
        map.set(key, {
          label: clean,
          order: idx,
          visible: this._isVisible(isVisible),
        });
        return;
      }
      if (typeof current === "number") {
        map.set(key, {
          label: clean,
          order: Math.min(current, idx),
          visible: this._isVisible(isVisible),
        });
        return;
      }
      if (idx < current.order) current.order = idx;
      if (this._isVisible(isVisible)) current.visible = true;
      if (!current.label) current.label = clean;
    },

    _sortedLabels(map) {
      const items = [];
      map.forEach((value, key) => {
        if (!value) return;
        if (typeof value === "object") {
          const label = this._cleanLabel(value.label || "");
          if (!label) return;
          items.push({
            key,
            label,
            order: Number.isFinite(Number(value.order)) ? Number(value.order) : 0,
            visible: this._isVisible(value.visible),
          });
        } else {
          const label = this._cleanLabel(key);
          if (!label) return;
          items.push({
            key,
            label,
            order: Number.isFinite(Number(value)) ? Number(value) : 0,
            visible: true,
          });
        }
      });
      return items.sort((a, b) => a.order - b.order);
    },

    _cleanLabel(value) {
      if (value == null) return "";
      return value.toString().replace(/\s+/g, " ").trim();
    },

    _isVisible(value) {
      return !(value === false || value === 0);
    },

    _normalizeKey(value) {
      return (value || "")
        .toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "")
        .toUpperCase();
    },

    _getFieldValue(obj, keys = []) {
      if (!obj || !keys.length) return "";
      for (const key of keys) {
        if (obj[key] != null) return obj[key];
      }
      const targets = keys.map((key) => this._normalizeKey(key));
      const entries = Object.keys(obj);
      for (const entry of entries) {
        if (targets.includes(this._normalizeKey(entry))) {
          return obj[entry];
        }
      }
      return "";
    },

    _getAccountOrder(cuenta, fallback = 0) {
      const raw = cuenta?.orden_presentacion ?? cuenta?.orden ?? cuenta?.Orden;
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : fallback;
    },

    _getOperationOrder(op, fallback = 0) {
      const raw = op?.orden_presentacion ?? op?.orden ?? op?.Orden ?? op?.index;
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : fallback;
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
