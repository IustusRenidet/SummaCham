/**
 * drag-and-drop-reorder.js  
 * Sistema de reordenamiento visual con drag-and-drop para operaciones
 * Modo 100% Manual - Sin restricciones programáticas
 */

(() => {
  'use strict';

  let draggedRow = null;
  let draggedIndex = null;

  /**
   * Inicializa el drag-and-drop en la tabla de preview
   */
  function initDragAndDropReorder() {
    console.log('🎯 Inicializando Drag & Drop para operaciones');

    // Agregar event listener al container de la vista previa
    const previewContainer = document.getElementById('previewContainer');
    if (!previewContainer) {
      console.warn('⚠️ No se encontró previewContainer');
      return;
    }

    // Usar event delegation para manejar filas dinámicas
    previewContainer.addEventListener('dragstart', handleDragStart);
    previewContainer.addEventListener('dragover', handleDragOver);
    previewContainer.addEventListener('drop', handleDrop);
    previewContainer.addEventListener('dragend', handleDragEnd);
    previewContainer.addEventListener('dragenter', handleDragEnter);
    previewContainer.addEventListener('dragleave', handleDragLeave);

    console.log('✅ Drag & Drop inicializado');
  }

  /**
   * Hace las filas arrastrables
   */
  function makeRowsDraggable() {
    const rows = document.querySelectorAll('.template-table tr[data-row-type]');
    rows.forEach((row, index) => {
      const rowType = row.dataset.rowType;
      
      // Hacer arrastrables todas las filas del layout (sin restricciones por tipo)
      if (['section', 'subsection', 'operation', 'account'].includes(rowType)) {
        row.setAttribute('draggable', 'true');
        row.style.cursor = 'move';
        row.dataset.rowIndex = index;
        
        // Agregar icono visual de arrastre
        if (!row.querySelector('.drag-handle')) {
          const handleCell = row.querySelector('td:first-child');
          if (handleCell) {
            const handle = document.createElement('i');
            handle.className = 'bi bi-grip-vertical drag-handle text-muted me-2';
            handle.style.cursor = 'grab';
            handle.title = 'Arrastra para reordenar';
            handleCell.prepend(handle);
          }
        }
      }
    });
  }

  function handleDragStart(e) {
    const row = e.target.closest('tr[draggable="true"]');
    if (!row) return;

    draggedRow = row;
    draggedIndex = parseInt(row.dataset.rowIndex, 10);
    
    row.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', row.innerHTML);
    
    // Crear imagen de arrastre personalizada
    const dragImage = row.cloneNode(true);
    dragImage.style.opacity = '0.5';
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    setTimeout(() => dragImage.remove(), 0);
  }

  function handleDragOver(e) {
    if (e.preventDefault) {
      e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
  }

  function handleDragEnter(e) {
    const row = e.target.closest('tr[draggable="true"]');
    if (row && row !== draggedRow) {
      row.classList.add('drag-over');
    }
  }

  function handleDragLeave(e) {
    const row = e.target.closest('tr[draggable="true"]');
    if (row) {
      row.classList.remove('drag-over');
    }
  }

  function handleDrop(e) {
    if (e.stopPropagation) {
      e.stopPropagation();
    }
    e.preventDefault();

    const targetRow = e.target.closest('tr[draggable="true"]');
    if (!targetRow || !draggedRow || targetRow === draggedRow) {
      return false;
    }

    targetRow.classList.remove('drag-over');

    const targetIndex = parseInt(targetRow.dataset.rowIndex, 10);
    
    // Determinar si insertar antes o después
    const rect = targetRow.getBoundingClientRect();
    const midpoint = rect.top + (rect.height / 2);
    const insertBefore = e.clientY < midpoint;

    // Reordenar en el DOM
    if (insertBefore) {
      targetRow.parentNode.insertBefore(draggedRow, targetRow);
    } else {
      targetRow.parentNode.insertBefore(draggedRow, targetRow.nextSibling);
    }

    // Actualizar orden en el state
    updateStateOrderAfterDrop();

    // Mostrar mensaje de éxito
    if (window.showToast) {
      window.showToast('✅ Orden actualizado. Guarda los cambios.', 'success');
    }

    // Marcar cambios sin guardar
    if (window.state) {
      window.state.unsavedChanges = true;
    }
    if (window.updateButtonStates) {
      window.updateButtonStates();
    }
    if (window.scheduleAutoSave) {
      window.scheduleAutoSave('reorder');
    }

    return false;
  }

  function handleDragEnd(e) {
    if (draggedRow) {
      draggedRow.classList.remove('dragging');
    }
    
    // Limpiar clases de drag-over
    document.querySelectorAll('.drag-over').forEach(row => {
      row.classList.remove('drag-over');
    });

    draggedRow = null;
    draggedIndex = null;
  }

  /**
   * Actualiza el orden en el state después del drop
   */
  function updateStateOrderAfterDrop() {
    if (!window.state) return;

    const domRows = Array.from(
      document.querySelectorAll('.template-table tr[data-row-type]')
    );

    // Ruta preferida: delegar al reordenamiento global del Gestor (actualiza orden + jerarquía)
    if (typeof window.applyTemplateRowsOrder === 'function') {
      const getAttr = (node, name) => {
        if (!node || !node.getAttribute) return null;
        return node.getAttribute(name);
      };

      const orderedRows = domRows
        .map((row) => {
          const rowType = row.dataset.rowType;

          if (rowType === 'section') {
            const label =
              getAttr(row, 'data-section') ?? (row.textContent || '').trim();
            return {
              type: 'principal',
              label,
              placeholderAccountId: getAttr(row, 'data-placeholder-account-id') || ''
            };
          }

          if (rowType === 'subsection') {
            const label =
              getAttr(row, 'data-subsection') ?? (row.textContent || '').trim();
            return {
              type: 'subsection',
              label,
              parentSection: getAttr(row, 'data-section') || '',
              placeholderAccountId: getAttr(row, 'data-placeholder-account-id') || ''
            };
          }

          if (rowType === 'account') {
            const cuenta = getAttr(row, 'data-cuenta') || '';
            const accountId = getAttr(row, 'data-account-id') || cuenta;
            return {
              type: 'account',
              cuenta,
              accountId,
              parentSection: getAttr(row, 'data-section') || '',
              parentSubsection: getAttr(row, 'data-subsection') || ''
            };
          }

          if (rowType === 'operation') {
            const opId = getAttr(row, 'data-operation-id') || '';
            const label = getAttr(row, 'data-operation-label') || opId;
            return {
              type: 'operation',
              label,
              opId: opId || label,
              operationId: opId || label,
              kind: getAttr(row, 'data-operation-kind') || '',
              parentSection: getAttr(row, 'data-section') || '',
              parentSubsection: getAttr(row, 'data-subsection') || ''
            };
          }

          return null;
        })
        .filter(Boolean);

      const result = window.applyTemplateRowsOrder(orderedRows, { silent: false });
      if (!result?.success) {
        console.warn('⚠️ No se pudo aplicar el orden desde drag-drop:', result);
      }
      return;
    }

    // Fallback legacy: solo actualiza orden (cuentas + operaciones) sin mover jerarquía
    let orderCounter = 0;
    domRows.forEach((row, visualIndex) => {
      const rowType = row.dataset.rowType;

      if (rowType === 'operation') {
        const opId = row.dataset.operationId;
        const op = window.state.operaciones.find((o) =>
          (window.getOperationId?.(o) === opId) ||
          (window.getOperationLabel?.(o) === opId)
        );
        if (op) {
          op.orden_presentacion = orderCounter;
          op.orden = orderCounter;
          orderCounter += 1;
        }
      } else if (rowType === 'account') {
        const cuenta = row.dataset.cuenta;
        const account = window.state.cuentas.find((c) =>
          c.CUENTA === cuenta || c.cuenta === cuenta
        );
        if (account) {
          account.orden_presentacion = orderCounter;
          account.orden = orderCounter;
          orderCounter += 1;
        }
      }

      row.dataset.rowIndex = visualIndex;
    });

    console.log(`📊 Orden actualizado (legacy): ${orderCounter} elementos reordenados`);
  }

  /**
   * Agregar estilos CSS para el drag-and-drop
   */
  function injectDragStyles() {
    if (document.getElementById('drag-drop-styles')) return;

    const style = document.createElement('style');
    style.id = 'drag-drop-styles';
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
        opacity: 0.4;
        transition: opacity 0.2s ease;
      }

      .template-table tr[draggable="true"]:hover .drag-handle {
        opacity: 1;
      }

      .drag-handle:active {
        cursor: grabbing !important;
      }

      /* Animación suave al soltar */
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

  // Exponer funciones globales
  window.DragDropReorder = {
    init: initDragAndDropReorder,
    makeRowsDraggable,
    reinitAfterRender
  };

  // Auto-inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      injectDragStyles();
      initDragAndDropReorder();
    });
  } else {
    injectDragStyles();
    initDragAndDropReorder();
  }

  console.log('📦 Módulo Drag & Drop cargado');
})();
