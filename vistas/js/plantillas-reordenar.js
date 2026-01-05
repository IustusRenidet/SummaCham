/**
 * plantillas-reordenar.js
 * Sistema de reordenamiento visual para el gestor de plantillas
 */

(() => {
  "use strict";

  // ==========================================
  // STATE
  // ==========================================
  const ordenState = {
    elementos: [], // Copia de trabajo de todos los elementos
    filtroActual: "all",
    draggedElement: null,
    originalOrder: [], // Para resetear
  };

  // ==========================================
  // INITIALIZATION
  // ==========================================
  function initReordenar() {
    const btnReordenar = document.getElementById("btnReordenar");
    const btnConfirmarOrden = document.getElementById("btnConfirmarOrden");
    const btnResetOrden = document.getElementById("btnResetOrden");
    const modalReordenar = document.getElementById("modalReordenar");

    if (btnReordenar) {
      btnReordenar.addEventListener("click", abrirModalReordenar);
    }

    if (btnConfirmarOrden) {
      btnConfirmarOrden.addEventListener("click", aplicarOrden);
    }

    if (btnResetOrden) {
      btnResetOrden.addEventListener("click", resetearOrden);
    }

    // Filtros
    document.querySelectorAll(".filter-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        document
          .querySelectorAll(".filter-btn")
          .forEach((b) => b.classList.remove("active"));
        e.target.classList.add("active");
        ordenState.filtroActual = e.target.dataset.filter;
        aplicarFiltro();
      });
    });
  }

  // ==========================================
  // ABRIR MODAL DE REORDENAMIENTO
  // ==========================================
  function abrirModalReordenar() {
    if (!window.state || !window.state.layout) {
      showToast("Carga un layout primero", "warning");
      return;
    }

    // Preparar elementos
    prepararElementos();

    // Renderizar lista
    renderizarListaOrdenable();

    // Mostrar modal
    const modal = new bootstrap.Modal(
      document.getElementById("modalReordenar")
    );
    modal.show();
  }

  // ==========================================
  // PREPARAR ELEMENTOS
  // ==========================================
  function prepararElementos() {
    ordenState.elementos = [];
    ordenState.originalOrder = [];

    const { cuentas = [], operaciones = [] } = window.state;

    // Agrupar cuentas por secciones
    const secciones = new Map();

    cuentas.forEach((cuenta) => {
      const principal = cuenta.seccion_principal || "Sin Sección";
      const secundaria = cuenta.seccion_secundaria || null;

      if (!secciones.has(principal)) {
        secciones.set(principal, {
          tipo: "seccion",
          nombre: principal,
          subsecciones: new Map(),
          cuentas: [],
        });
      }

      const seccion = secciones.get(principal);

      if (secundaria) {
        if (!seccion.subsecciones.has(secundaria)) {
          seccion.subsecciones.set(secundaria, {
            tipo: "subseccion",
            nombre: secundaria,
            principal: principal,
            cuentas: [],
          });
        }
        seccion.subsecciones.get(secundaria).cuentas.push(cuenta);
      } else {
        seccion.cuentas.push(cuenta);
      }
    });

    // Convertir a array plano con jerarquía
    let orden = 0;
    secciones.forEach((seccion) => {
      // Agregar sección principal
      ordenState.elementos.push({
        id: `seccion-${seccion.nombre}`,
        tipo: "seccion",
        nombre: seccion.nombre,
        orden: orden++,
        nivel: 0,
        data: seccion,
      });

      // Agregar subsecciones y sus cuentas
      seccion.subsecciones.forEach((subseccion) => {
        ordenState.elementos.push({
          id: `subseccion-${subseccion.principal}-${subseccion.nombre}`,
          tipo: "subseccion",
          nombre: subseccion.nombre,
          principal: subseccion.principal,
          orden: orden++,
          nivel: 1,
          data: subseccion,
        });

        // Cuentas de la subsección
        subseccion.cuentas.forEach((cuenta) => {
          ordenState.elementos.push({
            id: `cuenta-${cuenta.Cuenta}`,
            tipo: "cuenta",
            nombre: cuenta.Nombre,
            codigo: cuenta.Cuenta,
            principal: subseccion.principal,
            subseccion: subseccion.nombre,
            orden: orden++,
            nivel: 2,
            data: cuenta,
          });
        });
      });

      // Cuentas directas de la sección
      seccion.cuentas.forEach((cuenta) => {
        ordenState.elementos.push({
          id: `cuenta-${cuenta.Cuenta}`,
          tipo: "cuenta",
          nombre: cuenta.Nombre,
          codigo: cuenta.Cuenta,
          principal: seccion.nombre,
          orden: orden++,
          nivel: 1,
          data: cuenta,
        });
      });
    });

    // Agregar operaciones
    operaciones.forEach((operacion) => {
      ordenState.elementos.push({
        id: `operacion-${operacion.Clase || operacion.id}`,
        tipo: "operacion",
        nombre: operacion.Clase || operacion.label || "Sin nombre",
        formula: getFormulaDisplay(operacion),
        orden: orden++,
        nivel: 0,
        data: operacion,
      });
    });

    // Guardar orden original
    ordenState.originalOrder = JSON.parse(
      JSON.stringify(ordenState.elementos)
    );
  }

  // ==========================================
  // RENDERIZAR LISTA ORDENABLE
  // ==========================================
  function renderizarListaOrdenable() {
    const container = document.getElementById("ordenContainer");
    if (!container) return;

    if (ordenState.elementos.length === 0) {
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

    // Inicializar drag and drop
    inicializarDragDrop();

    // Bind eventos de controles
    bindControlesOrden();
  }

  // ==========================================
  // RENDER ELEMENTO
  // ==========================================
  function renderElemento(elem, idx) {
    const iconos = {
      seccion: "bi-folder2",
      subseccion: "bi-folder",
      cuenta: "bi-file-earmark-text",
      operacion: "bi-calculator",
    };

    const indentClass = elem.nivel > 0 ? `indent-${elem.nivel}` : "";

    let detalles = "";
    if (elem.tipo === "cuenta") {
      detalles = `<span class="item-code">${elem.codigo}</span>`;
    } else if (elem.tipo === "operacion" && elem.formula) {
      detalles = elem.formula;
    } else if (elem.tipo === "subseccion") {
      detalles = `Bajo: ${elem.principal}`;
    }

    const isFirst = idx === 0;
    const isLast = idx === ordenState.elementos.length - 1;

    return `
      <li class="sortable-item ${indentClass}" 
          data-id="${elem.id}" 
          data-tipo="${elem.tipo}"
          data-index="${idx}"
          draggable="true">
        <div class="item-order">${idx + 1}</div>
        <div class="item-icon ${elem.tipo}">
          <i class="bi ${iconos[elem.tipo]}"></i>
        </div>
        <div class="item-content">
          <div class="item-label">
            ${elem.nombre}
            <span class="item-type-badge ${elem.tipo}">${elem.tipo}</span>
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

  // ==========================================
  // DRAG AND DROP
  // ==========================================
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

  function handleDragStart(e) {
    const item = e.target.closest(".sortable-item");
    if (!item) return;

    ordenState.draggedElement = item;
    item.classList.add("dragging");

    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/html", item.innerHTML);
  }

  function handleDragEnd(e) {
    const item = e.target.closest(".sortable-item");
    if (!item) return;

    item.classList.remove("dragging");
    document.querySelectorAll(".drag-over").forEach((el) => {
      el.classList.remove("drag-over");
    });

    ordenState.draggedElement = null;
  }

  function handleDragOver(e) {
    if (e.preventDefault) {
      e.preventDefault();
    }
    e.dataTransfer.dropEffect = "move";
    return false;
  }

  function handleDragEnter(e) {
    const item = e.target.closest(".sortable-item");
    if (item && item !== ordenState.draggedElement) {
      item.classList.add("drag-over");
    }
  }

  function handleDragLeave(e) {
    const item = e.target.closest(".sortable-item");
    if (item) {
      item.classList.remove("drag-over");
    }
  }

  function handleDrop(e) {
    if (e.stopPropagation) {
      e.stopPropagation();
    }

    const targetItem = e.target.closest(".sortable-item");
    if (!targetItem || !ordenState.draggedElement) return;

    if (ordenState.draggedElement !== targetItem) {
      const draggedIndex = parseInt(
        ordenState.draggedElement.dataset.index,
        10
      );
      const targetIndex = parseInt(targetItem.dataset.index, 10);

      // Intercambiar elementos
      intercambiarElementos(draggedIndex, targetIndex);

      // Re-renderizar
      renderizarListaOrdenable();
    }

    return false;
  }

  // ==========================================
  // CONTROLES DE ORDEN
  // ==========================================
  function bindControlesOrden() {
    document.querySelectorAll(".btn-orden[data-action]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const item = e.target.closest(".sortable-item");
        const action = e.target.closest(".btn-orden").dataset.action;
        const index = parseInt(item.dataset.index, 10);

        switch (action) {
          case "up":
            if (index > 0) {
              intercambiarElementos(index, index - 1);
              renderizarListaOrdenable();
            }
            break;

          case "down":
            if (index < ordenState.elementos.length - 1) {
              intercambiarElementos(index, index + 1);
              renderizarListaOrdenable();
            }
            break;

          case "edit":
            editarElemento(ordenState.elementos[index]);
            break;
        }
      });
    });
  }

  // ==========================================
  // INTERCAMBIAR ELEMENTOS
  // ==========================================
  function intercambiarElementos(fromIndex, toIndex) {
    const temp = ordenState.elementos[fromIndex];
    ordenState.elementos[fromIndex] = ordenState.elementos[toIndex];
    ordenState.elementos[toIndex] = temp;

    // Actualizar orden
    ordenState.elementos.forEach((elem, idx) => {
      elem.orden = idx;
    });
  }

  // ==========================================
  // EDITAR ELEMENTO
  // ==========================================
  function editarElemento(elem) {
    // Cerrar modal de reordenar
    const modalReordenar = bootstrap.Modal.getInstance(
      document.getElementById("modalReordenar")
    );
    if (modalReordenar) {
      modalReordenar.hide();
    }

    // Abrir modal de edición con los datos del elemento
    setTimeout(() => {
      if (typeof window.openEditModal === "function") {
        window.openEditModal(elem.data, elem.tipo);
      } else {
        showToast(
          "Función de edición no disponible. Usa el botón Editar en el layout.",
          "warning"
        );
      }
    }, 300);
  }

  // ==========================================
  // FILTROS
  // ==========================================
  function aplicarFiltro() {
    const items = document.querySelectorAll(".sortable-item");

    items.forEach((item) => {
      const tipo = item.dataset.tipo;

      if (ordenState.filtroActual === "all" || tipo === ordenState.filtroActual) {
        item.style.display = "";
      } else {
        item.style.display = "none";
      }
    });
  }

  // ==========================================
  // APLICAR ORDEN
  // ==========================================
  function aplicarOrden() {
    if (!window.state) return;

    // Actualizar orden en el state global
    const cuentasMap = new Map();
    const operacionesMap = new Map();

    // Crear mapas de elementos originales
    window.state.cuentas.forEach((c) => {
      cuentasMap.set(`cuenta-${c.Cuenta}`, c);
    });

    window.state.operaciones.forEach((op) => {
      const key = `operacion-${op.Clase || op.id}`;
      operacionesMap.set(key, op);
    });

    // Aplicar nuevo orden
    const nuevasCuentas = [];
    const nuevasOperaciones = [];

    ordenState.elementos.forEach((elem, idx) => {
      if (elem.tipo === "cuenta") {
        const cuenta = cuentasMap.get(elem.id);
        if (cuenta) {
          cuenta.orden = idx;
          nuevasCuentas.push(cuenta);
        }
      } else if (elem.tipo === "operacion") {
        const operacion = operacionesMap.get(elem.id);
        if (operacion) {
          operacion.orden = idx;
          nuevasOperaciones.push(operacion);
        }
      }
    });

    // Actualizar state
    window.state.cuentas = nuevasCuentas;
    window.state.operaciones = nuevasOperaciones;
    window.state.unsavedChanges = true;

    // Re-renderizar layout
    if (typeof window.renderLayout === "function") {
      window.renderLayout();
    }

    // Cerrar modal
    const modal = bootstrap.Modal.getInstance(
      document.getElementById("modalReordenar")
    );
    if (modal) {
      modal.hide();
    }

    showToast("Orden aplicado correctamente. No olvides guardar.", "success");
  }

  // ==========================================
  // RESETEAR ORDEN
  // ==========================================
  function resetearOrden() {
    if (
      confirm("¿Seguro que deseas resetear al orden original? Se perderán los cambios actuales.")
    ) {
      ordenState.elementos = JSON.parse(
        JSON.stringify(ordenState.originalOrder)
      );
      renderizarListaOrdenable();
      showToast("Orden reseteado", "info");
    }
  }

  // ==========================================
  // HELPERS
  // ==========================================
  function getFormulaDisplay(operacion) {
    if (operacion.formula_terms && operacion.formula_terms.length > 0) {
      return operacion.formula_terms
        .map((t) => `${t.operator || "+"} ${t.value}`)
        .join(" ");
    }

    const parts = [];
    for (let i = 1; i <= 10; i++) {
      const key = `seccion_${i}`;
      if (operacion[key]) {
        const signo = operacion.signos?.[key] === -1 ? "-" : "+";
        parts.push(`${signo} ${operacion[key]}`);
      }
    }
    return parts.join(" ") || "Sin fórmula";
  }

  function showToast(message, type = "info") {
    if (typeof window.showToast === "function") {
      window.showToast(message, type);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  // ==========================================
  // EXPORT
  // ==========================================
  window.initReordenar = initReordenar;
  window.abrirModalReordenar = abrirModalReordenar;

  // Auto-init when DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initReordenar);
  } else {
    initReordenar();
  }
})();
