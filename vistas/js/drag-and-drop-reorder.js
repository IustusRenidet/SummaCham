/**
 * drag-and-drop-reorder.js
 * Reordenamiento visual jerárquico para filas de plantilla.
 */

(() => {
  "use strict";

  let draggedRow = null;
  let draggedIndex = null;
  const DRAGGABLE_TYPES = new Set([
    "section",
    "subsection",
    "operation",
    "account",
  ]);

  function isOrderingEnabled() {
    return Boolean(window.state?.inlineOrderMode) && window.state?.editMode !== false;
  }

  function isRowDraggable(row) {
    if (!row) return false;
    const rowType = (row.dataset.rowType || "").trim();
    if (!DRAGGABLE_TYPES.has(rowType)) return false;
    if (rowType === "section" && row.dataset.generated === "true") return false;
    return isOrderingEnabled();
  }

  /**
   * Inicializa el drag-and-drop en la tabla de preview
   */
  function initDragAndDropReorder() {
    console.log("🎯 Inicializando Drag & Drop jerárquico");

    const previewContainer = document.getElementById("previewContainer");
    if (!previewContainer) {
      console.warn("⚠️ No se encontró previewContainer");
      return;
    }

    // Event delegation para filas dinámicas.
    previewContainer.addEventListener("dragstart", handleDragStart);
    previewContainer.addEventListener("dragover", handleDragOver);
    previewContainer.addEventListener("drop", handleDrop);
    previewContainer.addEventListener("dragend", handleDragEnd);
    previewContainer.addEventListener("dragenter", handleDragEnter);
    previewContainer.addEventListener("dragleave", handleDragLeave);

    makeRowsDraggable();
    console.log("✅ Drag & Drop inicializado");
  }

  /**
   * Hace las filas arrastrables solo cuando el modo de orden está activo.
   */
  function makeRowsDraggable() {
    const rows = document.querySelectorAll(".template-table tr[data-row-type]");
    rows.forEach((row) => {
      const canDrag = isRowDraggable(row);
      if (canDrag) {
        row.setAttribute("draggable", "true");
        row.style.cursor = "move";
      } else {
        row.removeAttribute("draggable");
        row.style.cursor = "";
        row.classList.remove("dragging");
        row.classList.remove("drag-over");
      }

      if (!row.querySelector(".drag-handle")) {
        const handleCell = row.querySelector("td:first-child");
        if (handleCell) {
          const handle = document.createElement("i");
          handle.className = "bi bi-grip-vertical drag-handle text-muted me-2";
          handle.style.cursor = "grab";
          handle.title = "Arrastra para reordenar";
          handleCell.prepend(handle);
        }
      }
    });
  }

  function handleDragStart(event) {
    const row = event.target.closest("tr[data-row-type]");
    if (!isRowDraggable(row)) return;

    // Evita arrastres accidentales al hacer click fuera del handle.
    if (!event.target.closest(".drag-handle")) {
      event.preventDefault();
      return;
    }

    const rowIndex = Number(row.dataset.rowIndex);
    if (!Number.isInteger(rowIndex)) {
      event.preventDefault();
      return;
    }

    draggedRow = row;
    draggedIndex = rowIndex;

    row.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(rowIndex));

    // Imagen de arrastre suave.
    const dragImage = row.cloneNode(true);
    dragImage.style.opacity = "0.5";
    dragImage.style.position = "absolute";
    dragImage.style.top = "-1000px";
    document.body.appendChild(dragImage);
    event.dataTransfer.setDragImage(dragImage, 0, 0);
    setTimeout(() => dragImage.remove(), 0);
  }

  function handleDragOver(event) {
    if (!draggedRow) return;
    if (event.preventDefault) {
      event.preventDefault();
    }
    event.dataTransfer.dropEffect = "move";
  }

  function handleDragEnter(event) {
    const row = event.target.closest("tr[data-row-type]");
    if (!isRowDraggable(row)) return;
    if (row && row !== draggedRow) {
      row.classList.add("drag-over");
    }
  }

  function handleDragLeave(event) {
    const row = event.target.closest("tr[data-row-type]");
    if (row) {
      row.classList.remove("drag-over");
    }
  }

  function applyDropMove(targetRow, clientY) {
    if (!targetRow || !draggedRow || !Number.isInteger(draggedIndex)) return false;

    const targetIndex = Number(targetRow.dataset.rowIndex);
    if (!Number.isInteger(targetIndex)) return false;

    const rect = targetRow.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const insertBefore = clientY < midpoint;
    const desiredIndex = targetIndex + (insertBefore ? 0 : 1);

    if (typeof window.moveTemplateRowOrderToIndex !== "function") {
      console.warn("⚠️ moveTemplateRowOrderToIndex no disponible para drag-drop.");
      return false;
    }

    return Boolean(window.moveTemplateRowOrderToIndex(draggedIndex, desiredIndex));
  }

  function handleDrop(event) {
    if (event.stopPropagation) {
      event.stopPropagation();
    }
    event.preventDefault();

    const targetRow = event.target.closest("tr[data-row-type]");
    if (!targetRow || !draggedRow || targetRow === draggedRow) {
      return false;
    }
    if (!isRowDraggable(targetRow)) return false;

    targetRow.classList.remove("drag-over");
    const moved = applyDropMove(targetRow, event.clientY);

    if (moved && typeof window.showToast === "function") {
      window.showToast("✅ Orden actualizado. Guarda los cambios.", "success");
    }

    return false;
  }

  function handleDragEnd() {
    if (draggedRow) {
      draggedRow.classList.remove("dragging");
    }

    document.querySelectorAll(".drag-over").forEach((row) => {
      row.classList.remove("drag-over");
    });

    draggedRow = null;
    draggedIndex = null;
  }

  /**
   * Agregar estilos CSS para el drag-and-drop
   */
  function injectDragStyles() {
    if (document.getElementById("drag-drop-styles")) return;

    const style = document.createElement("style");
    style.id = "drag-drop-styles";
    style.textContent = `
      .template-table tr[draggable="true"] {
        transition: background-color 0.2s ease;
      }

      .template-table tr.dragging {
        opacity: 0.4;
        background-color: #f8f9fa;
      }

      .template-table tr.drag-over {
        background-color: #e3f2fd !important;
        border-top: 3px solid #2196F3;
      }

      .drag-handle {
        opacity: 0.35;
        transition: opacity 0.2s ease;
      }

      .template-table tr[draggable="true"]:hover .drag-handle {
        opacity: 1;
      }

      .template-table tr:not([draggable="true"]) .drag-handle {
        opacity: 0.1;
      }

      .drag-handle:active {
        cursor: grabbing !important;
      }

      .template-table tr {
        transition: transform 0.2s ease;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Reinicializar después de renderizar
   */
  function reinitAfterRender() {
    makeRowsDraggable();
  }

  window.DragDropReorder = {
    init: initDragAndDropReorder,
    makeRowsDraggable,
    reinitAfterRender,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      injectDragStyles();
      initDragAndDropReorder();
    });
  } else {
    injectDragStyles();
    initDragAndDropReorder();
  }

  console.log("📦 Módulo Drag & Drop cargado");
})();
