/**
 * plantillas-reordenar.js
 * Modal de reordenamiento alineado con la misma distribución que usa la plantilla.
 */

(() => {
  "use strict";

  const ROW_TYPES = new Set(["principal", "subsection", "account", "operation"]);

  const ordenState = {
    elementos: [],
    filtroActual: "all",
    draggedElement: null,
    originalOrder: [],
  };

  let listenersReordenarAttached = false;

  function initReordenar() {
    if (listenersReordenarAttached) return;
    listenersReordenarAttached = true;

    const btnReordenar = document.getElementById("btnReordenar");
    const btnConfirmarOrden = document.getElementById("btnConfirmarOrden");
    const btnResetOrden = document.getElementById("btnResetOrden");

    btnReordenar?.addEventListener("click", abrirModalReordenar);
    btnConfirmarOrden?.addEventListener("click", aplicarOrden);
    btnResetOrden?.addEventListener("click", resetearOrden);

    document.querySelectorAll(".filter-btn").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        document
          .querySelectorAll(".filter-btn")
          .forEach((node) => node.classList.remove("active"));
        event.currentTarget.classList.add("active");
        ordenState.filtroActual = event.currentTarget.dataset.filter || "all";
        aplicarFiltro();
      });
    });
  }

  function abrirModalReordenar() {
    if (!window.state || !window.state.layout) {
      showToast("Carga un layout primero", "warning");
      return;
    }

    prepararElementos();
    renderizarListaOrdenable();

    const modalNode = document.getElementById("modalReordenar");
    if (!modalNode) return;
    const modal = new bootstrap.Modal(modalNode);
    modal.show();
  }

  function obtenerFilasTemplate() {
    if (typeof window.getTemplateRowsForReorder === "function") {
      const rows = window.getTemplateRowsForReorder();
      if (Array.isArray(rows) && rows.length) {
        return rows.filter((row) => ROW_TYPES.has(row?.type));
      }
    }

    // Fallback mínimo para no bloquear si aún no está disponible la API del layout.
    const fallback = [];
    const cuentas = Array.isArray(window.state?.cuentas) ? window.state.cuentas : [];
    const operaciones = Array.isArray(window.state?.operaciones)
      ? window.state.operaciones
      : [];

    const cuentasOrdenadas = [...cuentas].sort((a, b) => {
      const orderA = Number.isFinite(Number(a?.orden_presentacion))
        ? Number(a.orden_presentacion)
        : Number.isFinite(Number(a?.orden))
        ? Number(a.orden)
        : 0;
      const orderB = Number.isFinite(Number(b?.orden_presentacion))
        ? Number(b.orden_presentacion)
        : Number.isFinite(Number(b?.orden))
        ? Number(b.orden)
        : 0;
      return orderA - orderB;
    });

    cuentasOrdenadas.forEach((cuenta) => {
      fallback.push({
        type: "account",
        cuenta: cuenta?.CUENTA || cuenta?.Cuenta || cuenta?.cuenta || "",
        label: cuenta?.CUENTA || cuenta?.Cuenta || cuenta?.cuenta || "",
        nombre: cuenta?.NOMBRE || cuenta?.Nombre || cuenta?.nombre || "",
        parentSection:
          cuenta?.["SECCION Principal"] ||
          cuenta?.["SECCIàN Principal"] ||
          cuenta?.SECCION ||
          cuenta?.seccion_principal ||
          "",
        parentSubsection:
          cuenta?.["SECCION Secundaria"] || cuenta?.seccion_secundaria || "",
      });
    });

    const operacionesOrdenadas = [...operaciones].sort((a, b) => {
      const orderA = Number.isFinite(Number(a?.orden_presentacion))
        ? Number(a.orden_presentacion)
        : Number.isFinite(Number(a?.orden))
        ? Number(a.orden)
        : 0;
      const orderB = Number.isFinite(Number(b?.orden_presentacion))
        ? Number(b.orden_presentacion)
        : Number.isFinite(Number(b?.orden))
        ? Number(b.orden)
        : 0;
      return orderA - orderB;
    });

    operacionesOrdenadas.forEach((op) => {
      fallback.push({
        type: "operation",
        label:
          op?.Etiqueta ||
          op?.operacion_etiqueta ||
          op?.Clase ||
          op?.clase ||
          op?.OperacionId ||
          "",
        opId: op?.OperacionId || op?.operacion_id || op?.id || "",
        parentSection: op?.parentSection || "",
        parentSubsection: op?.parentSubsection || "",
      });
    });

    return fallback;
  }

  function mapTipoFiltro(type = "") {
    if (type === "principal" || type === "subsection") return "seccion";
    if (type === "account") return "cuenta";
    if (type === "operation") return "operacion";
    return "otro";
  }

  function mapTipoBadge(type = "") {
    if (type === "principal") return "seccion";
    if (type === "subsection") return "subseccion";
    if (type === "account") return "cuenta";
    if (type === "operation") return "operacion";
    return "fila";
  }

  function resolveLevel(row = {}) {
    if (row.type === "principal") return 0;
    if (row.type === "subsection") return 1;
    if (row.type === "account") return 2;
    if (row.type === "operation") {
      return row.parentSubsection ? 2 : row.parentSection ? 1 : 0;
    }
    return 0;
  }

  function buildElementId(row = {}, idx = 0) {
    if (row.type === "principal") {
      return `principal:${(row.label || "").toString().trim()}:${idx}`;
    }
    if (row.type === "subsection") {
      const parent = (row.parentSection || "").toString().trim();
      const label = (row.label || "").toString().trim();
      return `subsection:${parent}:${label}:${idx}`;
    }
    if (row.type === "account") {
      const accountId = row.accountId || row.cuenta || row.label || "";
      return `account:${accountId}:${idx}`;
    }
    if (row.type === "operation") {
      const opId = row.opId || row.operationId || row.label || "";
      return `operation:${opId}:${idx}`;
    }
    return `row:${idx}`;
  }

  function createElemento(row = {}, idx = 0) {
    return {
      id: buildElementId(row, idx),
      tipo: mapTipoFiltro(row.type),
      subtipo: mapTipoBadge(row.type),
      nombre:
        row.label ||
        row.nombre ||
        row.cuenta ||
        row.opId ||
        "Sin nombre",
      codigo: row.cuenta || "",
      opId: row.opId || row.operationId || "",
      principal: row.parentSection || row.section || "",
      subseccion: row.parentSubsection || row.subsection || "",
      nivel: resolveLevel(row),
      orden: idx,
      row,
    };
  }

  function prepararElementos() {
    const rows = obtenerFilasTemplate();
    ordenState.elementos = rows.map((row, idx) => createElemento(row, idx));
    ordenState.originalOrder = ordenState.elementos.map((item) => ({
      ...item,
      row: { ...(item.row || {}) },
    }));
  }

  function renderizarListaOrdenable() {
    const container = document.getElementById("ordenContainer");
    if (!container) return;

    if (!ordenState.elementos.length) {
      container.innerHTML = `
        <div class="empty-orden">
          <i class="bi bi-inbox"></i>
          <h5>No hay elementos para ordenar</h5>
          <p>Carga un layout con elementos primero</p>
        </div>
      `;
      return;
    }

    const html = `
      <ul class="sortable-list" id="sortableList">
        ${ordenState.elementos.map((elem, idx) => renderElemento(elem, idx)).join("")}
      </ul>
    `;

    container.innerHTML = html;
    inicializarDragDrop();
    bindControlesOrden();
    aplicarFiltro();
  }

  function renderElemento(elem, idx) {
    const iconos = {
      seccion: "bi-folder2",
      subseccion: "bi-folder",
      cuenta: "bi-file-earmark-text",
      operacion: "bi-calculator",
      fila: "bi-layout-text-window",
    };

    const indentClass = elem.nivel > 0 ? `indent-${elem.nivel}` : "";
    const badgeClass = elem.subtipo || elem.tipo || "fila";
    const iconKey =
      elem.subtipo === "subseccion" ? "subseccion" : elem.subtipo || elem.tipo;
    const icon = iconos[iconKey] || iconos.fila;

    let detalles = "";
    if (elem.subtipo === "cuenta") {
      const label = elem.codigo || elem.nombre || "";
      detalles = `<span class="item-code">${label}</span>`;
    } else if (elem.subtipo === "subseccion") {
      detalles = `Bajo: ${elem.principal || "Sin sección"}`;
    } else if (elem.subtipo === "operacion") {
      const destino =
        elem.subseccion || elem.principal || elem.opId || "Posición libre";
      detalles = `Destino: ${destino}`;
    }

    const isFirst = idx === 0;
    const isLast = idx === ordenState.elementos.length - 1;

    return `
      <li class="sortable-item ${indentClass}"
          data-id="${elem.id}"
          data-tipo="${elem.tipo}"
          data-filter-type="${elem.tipo}"
          data-index="${idx}"
          draggable="true">
        <div class="item-order">${idx + 1}</div>
        <div class="item-icon ${badgeClass}">
          <i class="bi ${icon}"></i>
        </div>
        <div class="item-content">
          <div class="item-label">
            ${elem.nombre}
            <span class="item-type-badge ${badgeClass}">${elem.subtipo}</span>
          </div>
          ${detalles ? `<p class="item-details">${detalles}</p>` : ""}
        </div>
        <div class="item-controls">
          <button class="btn-orden drag-handle" title="Arrastrar">
            <i class="bi bi-grip-vertical"></i>
          </button>
          <button class="btn-orden up" data-action="up" ${isFirst ? "disabled" : ""} title="Subir">
            <i class="bi bi-arrow-up"></i>
          </button>
          <button class="btn-orden down" data-action="down" ${isLast ? "disabled" : ""} title="Bajar">
            <i class="bi bi-arrow-down"></i>
          </button>
          <button class="btn-orden edit" data-action="edit" title="Editar">
            <i class="bi bi-pencil"></i>
          </button>
        </div>
      </li>
    `;
  }

  function inicializarDragDrop() {
    const items = document.querySelectorAll(".sortable-item");
    items.forEach((item) => {
      item.addEventListener("dragstart", handleDragStart);
      item.addEventListener("dragend", handleDragEnd);
      item.addEventListener("dragover", handleDragOver);
      item.addEventListener("drop", handleDrop);
      item.addEventListener("dragenter", handleDragEnter);
      item.addEventListener("dragleave", handleDragLeave);
    });
  }

  function handleDragStart(event) {
    const item = event.target.closest(".sortable-item");
    if (!item) return;
    ordenState.draggedElement = item;
    item.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", item.dataset.id || "");
  }

  function handleDragEnd(event) {
    const item = event.target.closest(".sortable-item");
    if (!item) return;
    item.classList.remove("dragging");
    document.querySelectorAll(".drag-over").forEach((node) => {
      node.classList.remove("drag-over");
    });
    ordenState.draggedElement = null;
  }

  function handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function handleDragEnter(event) {
    const item = event.target.closest(".sortable-item");
    if (item && item !== ordenState.draggedElement) {
      item.classList.add("drag-over");
    }
  }

  function handleDragLeave(event) {
    const item = event.target.closest(".sortable-item");
    if (item) item.classList.remove("drag-over");
  }

  function handleDrop(event) {
    event.stopPropagation();
    const targetItem = event.target.closest(".sortable-item");
    if (!targetItem || !ordenState.draggedElement) return false;

    if (ordenState.draggedElement !== targetItem) {
      const draggedIndex = parseInt(ordenState.draggedElement.dataset.index, 10);
      const targetIndex = parseInt(targetItem.dataset.index, 10);
      intercambiarElementos(draggedIndex, targetIndex);
      renderizarListaOrdenable();
    }

    return false;
  }

  function bindControlesOrden() {
    document.querySelectorAll(".btn-orden[data-action]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        const item = event.target.closest(".sortable-item");
        const action = event.target.closest(".btn-orden")?.dataset.action;
        const index = parseInt(item?.dataset.index || "-1", 10);
        if (!Number.isInteger(index) || index < 0) return;

        if (action === "up" && index > 0) {
          intercambiarElementos(index, index - 1);
          renderizarListaOrdenable();
          return;
        }
        if (action === "down" && index < ordenState.elementos.length - 1) {
          intercambiarElementos(index, index + 1);
          renderizarListaOrdenable();
          return;
        }
        if (action === "edit") {
          editarElemento(ordenState.elementos[index]);
        }
      });
    });
  }

  function intercambiarElementos(fromIndex, toIndex) {
    const temp = ordenState.elementos[fromIndex];
    ordenState.elementos[fromIndex] = ordenState.elementos[toIndex];
    ordenState.elementos[toIndex] = temp;
    ordenState.elementos.forEach((elem, idx) => {
      elem.orden = idx;
    });
  }

  function editarElemento(elem) {
    if (!elem?.row) return;
    cerrarModalReordenar();

    setTimeout(() => {
      const row = elem.row || {};
      if (row.type === "account") {
        const accountId = row.accountId || row.cuenta || row.label;
        if (accountId && typeof window.editAccount === "function") {
          window.editAccount(accountId);
          return;
        }
      }

      if (row.type === "operation") {
        const operationId = row.opId || row.operationId || row.label;
        if (operationId && typeof window.editOperation === "function") {
          window.editOperation(operationId);
          return;
        }
      }

      if (row.type === "principal" && typeof window.editSection === "function") {
        window.editSection(row.label || "");
        return;
      }

      if (row.type === "subsection" && typeof window.editSubsection === "function") {
        window.editSubsection(row.parentSection || "", row.label || "");
        return;
      }

      showToast(
        "No se pudo abrir el editor para esta fila. Edita desde la tabla principal.",
        "warning"
      );
    }, 250);
  }

  function aplicarFiltro() {
    const items = document.querySelectorAll(".sortable-item");
    items.forEach((item) => {
      const filterType = item.dataset.filterType || item.dataset.tipo || "";
      if (ordenState.filtroActual === "all" || filterType === ordenState.filtroActual) {
        item.style.display = "";
      } else {
        item.style.display = "none";
      }
    });
  }

  function aplicarOrdenFallback(rows = []) {
    if (!window.state) return { success: false };
    let cursor = 0;
    rows.forEach((row) => {
      if (row?.type === "account") {
        const cuenta = (window.state.cuentas || []).find((item) => {
          const code = item?.CUENTA || item?.Cuenta || item?.cuenta || "";
          return code && code === (row.cuenta || row.label || "");
        });
        if (!cuenta) return;
        cuenta.orden_presentacion = cursor;
        cuenta.orden = cursor;
        cursor += 1;
        return;
      }
      if (row?.type === "operation") {
        const target = row.opId || row.operationId || row.label || "";
        const op = (window.state.operaciones || []).find((item) => {
          const id = item?.OperacionId || item?.operacion_id || item?.id || "";
          const label = item?.Etiqueta || item?.operacion_etiqueta || item?.Clase || "";
          return id === target || label === target;
        });
        if (!op) return;
        op.orden_presentacion = cursor;
        op.orden = cursor;
        cursor += 1;
      }
    });
    window.state.unsavedChanges = true;
    if (typeof window.renderLayout === "function") window.renderLayout();
    return { success: true };
  }

  function aplicarOrden() {
    const orderedRows = ordenState.elementos.map((elem) => ({
      ...(elem.row || {}),
    }));

    let resultado = null;
    if (typeof window.applyTemplateRowsOrder === "function") {
      resultado = window.applyTemplateRowsOrder(orderedRows);
    } else {
      resultado = aplicarOrdenFallback(orderedRows);
    }

    if (!resultado?.success) {
      showToast(
        resultado?.message || "No se pudo aplicar el orden seleccionado.",
        "warning"
      );
      return;
    }

    cerrarModalReordenar();
    showToast("Orden aplicado. No olvides guardar.", "success");
  }

  function resetearOrden() {
    if (
      !confirm(
        "¿Seguro que deseas resetear al orden original? Se perderán los cambios actuales."
      )
    ) {
      return;
    }
    ordenState.elementos = ordenState.originalOrder.map((item) => ({
      ...item,
      row: { ...(item.row || {}) },
    }));
    renderizarListaOrdenable();
    showToast("Orden reseteado", "info");
  }

  function cerrarModalReordenar() {
    const modalNode = document.getElementById("modalReordenar");
    const modal = modalNode ? bootstrap.Modal.getInstance(modalNode) : null;
    modal?.hide();
  }

  function showToast(message, type = "info") {
    if (typeof window.showToast === "function") {
      window.showToast(message, type);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  window.initReordenar = initReordenar;
  window.abrirModalReordenar = abrirModalReordenar;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initReordenar);
  } else {
    initReordenar();
  }
})();
