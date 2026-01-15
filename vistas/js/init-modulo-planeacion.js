/**
 * Script de inicialización genérico para módulos de planeación
 * Integra ModoEdicionPresupuesto + FlujoAutorizacion + CuentasModulo
 * 
 * Uso: Incluir después de modo-edicion-presupuesto.js, flujo-autorizacion.js
 *      y llamar initModuloPlaneacion({ moduloId: 'rh', moduloNombre: 'RH' })
 */

const obtenerEscalaActiva = (elemento) => {
  let actual = elemento;
  while (actual && actual !== document.body) {
    const transform = getComputedStyle(actual).transform;
    if (transform && transform !== "none") {
      let scaleX = 1;
      let scaleY = 1;
      if (typeof DOMMatrixReadOnly !== "undefined") {
        const matriz = new DOMMatrixReadOnly(transform);
        scaleX = matriz.a || 1;
        scaleY = matriz.d || 1;
      } else {
        const match = transform.match(/matrix(3d)?\(([^)]+)\)/);
        if (match) {
          const valores = match[2].split(",").map((valor) => parseFloat(valor));
          if (match[1] === "3d") {
            scaleX = valores[0] || 1;
            scaleY = valores[5] || 1;
          } else {
            scaleX = valores[0] || 1;
            scaleY = valores[3] || 1;
          }
        }
      }
      return { scaleX, scaleY, elemento: actual };
    }
    actual = actual.parentElement;
  }
  return { scaleX: 1, scaleY: 1, elemento: null };
};

const crearStickyHeaderOverlay = (tabla, wrapper) => {
  if (!tabla || !wrapper) return null;
  if (wrapper.__stickyHeaderOverlay) return wrapper.__stickyHeaderOverlay;

  const overlay = document.createElement("div");
  overlay.className = "sticky-table-header";
  overlay.setAttribute("aria-hidden", "true");
  document.body.appendChild(overlay);

  let cloneTable = null;
  let rafId = null;
  let syncRafId = null;

  const medirContenedor = () => {
    const rect = wrapper.getBoundingClientRect();
    const overflowY = getComputedStyle(wrapper).overflowY || "visible";
    const esScrollable =
      overflowY !== "visible" && wrapper.scrollHeight > wrapper.clientHeight + 1;
    const clientLeft = wrapper.clientLeft || 0;
    const clientTop = wrapper.clientTop || 0;
    const contentLeft = rect.left + clientLeft;
    const contentTop = rect.top + clientTop;
    const contentWidth = wrapper.clientWidth || rect.width;
    return {
      rect,
      contentLeft,
      contentTop,
      contentWidth,
      topOffset: esScrollable ? contentTop : 0,
      esScrollable,
    };
  };

  const syncWidths = () => {
    if (!cloneTable || !tabla?.tHead) return;
    const { scaleX } = obtenerEscalaActiva(tabla);
    const scaleXSeguro = scaleX || 1;
    cloneTable.className = tabla.className;
    cloneTable.classList.add("sticky-table-clone");
    const obtenerColorFondoSolido = (elemento) => {
      if (!elemento) return null;
      const fondo = getComputedStyle(elemento).backgroundColor;
      if (!fondo || fondo === "transparent" || fondo === "rgba(0, 0, 0, 0)") {
        return null;
      }
      return fondo;
    };
    const fondoEncabezado =
      obtenerColorFondoSolido(tabla.tHead) ||
      obtenerColorFondoSolido(tabla) ||
      obtenerColorFondoSolido(wrapper) ||
      "#ffffff";
    overlay.style.backgroundColor = fondoEncabezado;
    if (cloneTable.tHead) {
      cloneTable.tHead.style.backgroundColor = fondoEncabezado;
    }
    const sumarColSpan = (row) =>
      Array.from(row?.cells || []).reduce(
        (total, cell) => total + (cell.colSpan || 1),
        0
      );
    const obtenerSpecsColgroup = () => {
      const colgroup = tabla.querySelector("colgroup");
      if (!colgroup) return [];
      const specs = [];
      Array.from(colgroup.querySelectorAll("col")).forEach((col) => {
        const spanRaw = Number.parseInt(col.getAttribute("span") || "1", 10);
        const span = Number.isFinite(spanRaw) && spanRaw > 0 ? spanRaw : 1;
        for (let i = 0; i < span; i += 1) {
          specs.push({ className: col.className });
        }
      });
      return specs;
    };
    const colSpecs = obtenerSpecsColgroup();
    const obtenerConteoColumnas = () => {
      if (colSpecs.length) return colSpecs.length;
      const bodyRows = Array.from(tabla.tBodies?.[0]?.rows || []);
      const maxBody = bodyRows.reduce(
        (max, row) => Math.max(max, sumarColSpan(row)),
        0
      );
      if (maxBody) return maxBody;
      const headRows = Array.from(tabla.tHead?.rows || []);
      return headRows.reduce(
        (max, row) => Math.max(max, sumarColSpan(row)),
        0
      );
    };
    const filaEsVisible = (row) => {
      if (!row) return false;
      const style = getComputedStyle(row);
      if (style.display === "none" || style.visibility === "hidden") {
        return false;
      }
      const rect = row.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const filaTieneColumnasCompletas = (row, totalColumnas) => {
      const cells = Array.from(row?.cells || []);
      if (!cells.length) return false;
      const total = sumarColSpan(row);
      if (totalColumnas && total !== totalColumnas) return false;
      return cells.every((cell) => (cell.colSpan || 1) === 1);
    };
    const buscarFilaBase = (totalColumnas) => {
      const bodyRows = Array.from(tabla.tBodies?.[0]?.rows || []);
      for (const row of bodyRows) {
        if (!filaTieneColumnasCompletas(row, totalColumnas)) continue;
        if (!filaEsVisible(row)) continue;
        return row;
      }
      const headRows = Array.from(tabla.tHead?.rows || []);
      for (let i = headRows.length - 1; i >= 0; i -= 1) {
        const row = headRows[i];
        if (!filaTieneColumnasCompletas(row, totalColumnas)) continue;
        if (!filaEsVisible(row)) continue;
        return row;
      }
      return (
        bodyRows.find((row) => filaTieneColumnasCompletas(row, totalColumnas)) ||
        headRows.find((row) => filaTieneColumnasCompletas(row, totalColumnas)) ||
        null
      );
    };
    const obtenerAnchosColumnas = () => {
      const totalColumnas = obtenerConteoColumnas();
      const filaBase = buscarFilaBase(totalColumnas);
      if (!filaBase) return null;
      return Array.from(filaBase.cells).map(
        (cell) => cell.getBoundingClientRect().width / scaleXSeguro
      );
    };
    const aplicarAnchosColgroup = (widths = []) => {
      if (!widths.length) return false;
      if (colSpecs.length && colSpecs.length !== widths.length) return false;
      const nuevoColgroup = document.createElement("colgroup");
      widths.forEach((width, idx) => {
        const col = document.createElement("col");
        col.style.width = `${width}px`;
        col.style.minWidth = `${width}px`;
        if (colSpecs[idx]?.className) {
          col.className = colSpecs[idx].className;
        }
        nuevoColgroup.appendChild(col);
      });
      const colgroupActual = cloneTable.querySelector("colgroup");
      if (colgroupActual) {
        cloneTable.replaceChild(nuevoColgroup, colgroupActual);
      } else {
        cloneTable.insertBefore(nuevoColgroup, cloneTable.firstChild);
      }
      return true;
    };
    const columnWidths = obtenerAnchosColumnas();
    const puedeUsarColgroup = colSpecs.length > 0;
    const colgroupAplicado =
      puedeUsarColgroup && aplicarAnchosColgroup(columnWidths || []);
    cloneTable.style.tableLayout = colgroupAplicado ? "fixed" : "";
    const originalCells = Array.from(tabla.tHead.querySelectorAll("th"));
    const cloneCells = Array.from(cloneTable.querySelectorAll("th"));
    if (!colgroupAplicado) {
      originalCells.forEach((cell, idx) => {
        const cloneCell = cloneCells[idx];
        if (!cloneCell) return;
        const width = cell.getBoundingClientRect().width / scaleXSeguro;
        cloneCell.style.width = `${width}px`;
        cloneCell.style.minWidth = `${width}px`;
      });
    }
    originalCells.forEach((cell, idx) => {
      const cloneCell = cloneCells[idx];
      if (!cloneCell) return;
      const fondo =
        obtenerColorFondoSolido(cell) ||
        obtenerColorFondoSolido(cell.parentElement) ||
        fondoEncabezado;
      if (fondo) {
        cloneCell.style.backgroundColor = fondo;
      }
    });
    const totalColumnWidth = Array.isArray(columnWidths)
      ? columnWidths.reduce((acc, val) => acc + val, 0)
      : 0;
    const scrollWidth = tabla.scrollWidth || 0;
    const rectWidth = tabla.getBoundingClientRect().width || 0;
    const fallbackWidth = Math.max(scrollWidth, rectWidth / scaleXSeguro);
    const tableWidth =
      colgroupAplicado && totalColumnWidth ? totalColumnWidth : fallbackWidth;
    if (tableWidth) {
      cloneTable.style.width = `${tableWidth}px`;
      cloneTable.style.minWidth = `${tableWidth}px`;
    }
    overlay.scrollLeft = wrapper.scrollLeft;
  };

  const syncClone = () => {
    if (!tabla?.tHead) return;
    overlay.innerHTML = "";
    const newTable = document.createElement("table");
    newTable.className = tabla.className;
    newTable.classList.add("sticky-table-clone");
    newTable.setAttribute("aria-hidden", "true");
    const colgroup = tabla.querySelector("colgroup");
    if (colgroup) {
      newTable.appendChild(colgroup.cloneNode(true));
    }
    newTable.appendChild(tabla.tHead.cloneNode(true));
    const obtenerColorFondoSolido = (elemento) => {
      if (!elemento) return null;
      const fondo = getComputedStyle(elemento).backgroundColor;
      if (!fondo || fondo === "transparent" || fondo === "rgba(0, 0, 0, 0)") {
        return null;
      }
      return fondo;
    };
    const fondoEncabezado =
      obtenerColorFondoSolido(tabla.tHead) ||
      obtenerColorFondoSolido(tabla) ||
      obtenerColorFondoSolido(wrapper) ||
      "#ffffff";
    if (newTable.tHead) {
      newTable.tHead.style.backgroundColor = fondoEncabezado;
    }
    overlay.appendChild(newTable);
    cloneTable = newTable;
    syncWidths();
  };

  const updateOverlay = () => {
    if (!tabla?.tHead) return;
    const { scaleX, scaleY } = obtenerEscalaActiva(tabla);
    const scaleXSeguro = scaleX || 1;
    const scaleYSeguro = scaleY || 1;
    const { rect, topOffset, contentLeft, contentWidth } = medirContenedor();
    overlay.style.transform =
      scaleXSeguro !== 1 || scaleYSeguro !== 1
        ? `scale(${scaleXSeguro}, ${scaleYSeguro})`
        : "none";
    overlay.style.left = `${contentLeft / scaleXSeguro}px`;
    overlay.style.width = `${contentWidth / scaleXSeguro}px`;
    overlay.style.top = `${topOffset / scaleYSeguro}px`;
    const headRect = tabla.tHead.getBoundingClientRect();
    const tableRect = tabla.getBoundingClientRect();
    const headerHeight = headRect.height || 0;
    overlay.style.height = `${headerHeight / scaleYSeguro}px`;
    const wrapperVisible = rect.bottom > 0 && rect.top < window.innerHeight;
    const shouldShow =
      wrapperVisible &&
      headRect.bottom <= topOffset + 1 &&
      tableRect.bottom > topOffset + headerHeight;
    overlay.style.display = shouldShow ? "block" : "none";
    if (shouldShow) {
      overlay.scrollLeft = wrapper.scrollLeft;
    }
  };

  const scheduleUpdate = () => {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      updateOverlay();
    });
  };

  const scheduleSync = () => {
    if (syncRafId) return;
    syncRafId = requestAnimationFrame(() => {
      syncRafId = null;
      syncWidths();
      scheduleUpdate();
    });
  };

  wrapper.addEventListener(
    "scroll",
    () => {
      if (overlay.style.display !== "none") {
        overlay.scrollLeft = wrapper.scrollLeft;
      }
      scheduleUpdate();
    },
    { passive: true }
  );

  window.addEventListener("scroll", scheduleUpdate, { passive: true });
  window.addEventListener("resize", () => {
    scheduleSync();
  });

  if (tabla.tHead) {
    const observer = new MutationObserver(() => {
      syncClone();
      scheduleUpdate();
    });
    observer.observe(tabla.tHead, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });
  }

  const tbody = tabla.tBodies?.[0];
  if (tbody) {
    const bodyObserver = new MutationObserver(() => {
      scheduleSync();
    });
    bodyObserver.observe(tbody, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class", "style", "hidden"],
    });
  }

  if (window.ResizeObserver) {
    const resizeObserver = new ResizeObserver(() => {
      scheduleSync();
    });
    resizeObserver.observe(tabla);
    resizeObserver.observe(wrapper);
  }

  syncClone();
  scheduleUpdate();

  const setStickyColumns = (count = 2) => {
    const normalizado = Number.isFinite(Number(count)) ? Number(count) : 2;
    overlay.dataset.stickyColumns = String(normalizado);
    overlay.classList.toggle("no-sticky-cols", normalizado <= 0);
  };

  const api = {
    refresh: () => {
      syncClone();
      scheduleUpdate();
    },
    syncWidths,
    setStickyColumns,
    setOffsets: (left1, left2) => {
      overlay.style.setProperty("--sticky-col-1-left", `${left1}px`);
      overlay.style.setProperty("--sticky-col-2-left", `${left2}px`);
    },
  };

  wrapper.__stickyHeaderOverlay = api;
  return api;
};

const prepararStickyHeaders = (selectorTabla) => {
  const tabla = document.querySelector(selectorTabla);
  if (!tabla) return;

  const wrapper = tabla.closest(".table-responsive");
  if (!wrapper) return;

  const stickyColumnsRaw = Number.parseInt(
    tabla.dataset.stickyColumns || "2",
    10
  );
  const stickyColumns = Number.isFinite(stickyColumnsRaw)
    ? stickyColumnsRaw
    : 2;
  if (stickyColumns > 0) {
    wrapper.classList.add("sticky-table-scroll");
  } else {
    wrapper.classList.remove("sticky-table-scroll");
  }
  const overlay = crearStickyHeaderOverlay(tabla, wrapper);
  if (overlay?.setStickyColumns) {
    overlay.setStickyColumns(stickyColumns);
  }

  let ajustarRafId = null;
  const obtenerCeldaPrimeraColumna = () => {
    const tbody = tabla.tBodies?.[0];
    if (tbody) {
      const fila = Array.from(tbody.rows).find(
        (row) => row.cells.length >= 2 && row.cells[0].colSpan === 1
      );
      if (fila?.cells?.[0]) return fila.cells[0];
    }
    const filaHead = tabla.tHead?.rows?.[0];
    if (filaHead?.cells?.[0]) return filaHead.cells[0];
    return null;
  };

  const ajustar = () => {
    if (stickyColumns <= 0) {
      wrapper.style.removeProperty("--sticky-col-1-left");
      wrapper.style.removeProperty("--sticky-col-2-left");
      if (overlay) {
        overlay.setOffsets(0, 0);
      }
      return;
    }
    const { scaleX } = obtenerEscalaActiva(tabla);
    const scaleXSeguro = scaleX || 1;
    const primeraCelda = obtenerCeldaPrimeraColumna();
    const anchoPrimeraCol = primeraCelda
      ? primeraCelda.getBoundingClientRect().width / scaleXSeguro
      : 0;
    const left1 = 0;
    const left2 = anchoPrimeraCol;
    wrapper.style.setProperty("--sticky-col-1-left", `${left1}px`);
    wrapper.style.setProperty("--sticky-col-2-left", `${left2}px`);
    if (overlay) {
      overlay.setOffsets(left1, left2);
      overlay.syncWidths();
    }
  };

  const scheduleAjustar = () => {
    if (ajustarRafId) return;
    ajustarRafId = requestAnimationFrame(() => {
      ajustarRafId = null;
      ajustar();
    });
  };

  ajustar();

  if (!wrapper.dataset.stickyReady) {
    wrapper.dataset.stickyReady = "true";
    window.addEventListener("resize", scheduleAjustar);
    window.addEventListener("modulo-planeacion:tabla-actualizada", () => {
      if (overlay?.refresh) {
        overlay.refresh();
      }
      scheduleAjustar();
    });
    if (document.fonts?.ready) {
      document.fonts.ready.then(scheduleAjustar).catch(() => {});
    }
    const observer = new MutationObserver(scheduleAjustar);
    observer.observe(tabla, { attributes: true, attributeFilter: ["class"] });
    const tbody = tabla.tBodies?.[0];
    if (tbody) {
      const bodyObserver = new MutationObserver(scheduleAjustar);
      bodyObserver.observe(tbody, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["class", "style", "hidden"],
      });
    }
  }
  return overlay;
};

const setupRecontaOverlayListener = () => {
  if (window.__recontaOverlayListener) return;
  window.__recontaOverlayListener = true;

  const ensureStyles = () => {
    if (document.getElementById("recontaOverlayStyle")) return;
    const style = document.createElement("style");
    style.id = "recontaOverlayStyle";
    style.textContent = `
      .reconta-overlay {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.45);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 1080;
      }
      .reconta-overlay.show {
        display: flex;
      }
      .reconta-card {
        background: #fff;
        border-radius: 14px;
        padding: 1rem 1.25rem;
        min-width: 320px;
        max-width: 420px;
        box-shadow: 0 12px 32px rgba(15, 23, 42, 0.25);
      }
      .reconta-title {
        font-weight: 600;
        margin-bottom: 0.35rem;
      }
      .reconta-meta {
        font-size: 0.85rem;
        color: #6c757d;
      }
    `;
    document.head.appendChild(style);
  };

  const ensureOverlay = () => {
    ensureStyles();
    let overlay = document.getElementById("recontaOverlay");
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.id = "recontaOverlay";
    overlay.className = "reconta-overlay";
    overlay.innerHTML = `
      <div class="reconta-card">
        <div class="reconta-title">Recontabilizando cuentas</div>
        <div class="reconta-meta" id="recontaMeta">Iniciando...</div>
        <div class="progress my-2">
          <div class="progress-bar progress-bar-striped progress-bar-animated" id="recontaBar" role="progressbar" style="width: 0%"></div>
        </div>
        <div class="text-end text-muted small" id="recontaPct">0%</div>
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  };

  const actualizar = (detalle = {}) => {
    const overlay = ensureOverlay();
    const meta = overlay.querySelector("#recontaMeta");
    const bar = overlay.querySelector("#recontaBar");
    const pct = overlay.querySelector("#recontaPct");
    const total = Number(detalle.total) || 0;
    const actual = Number(detalle.actual) || 0;
    const porcentaje = Number.isFinite(detalle.porcentaje)
      ? detalle.porcentaje
      : total > 0
      ? Math.round((actual / total) * 100)
      : 0;

    if (detalle.estado === "oculto") {
      overlay.classList.remove("show");
      return;
    }

    overlay.classList.add("show");
    if (meta) {
      if (detalle.estado === "en-cola") {
        const posicion = Number(detalle.posicion) || 1;
        meta.textContent = `En cola de recontabilización (posición ${posicion})`;
      } else {
        meta.textContent = total
          ? `Recontabilizando ${actual}/${total} cuentas...`
          : "Recontabilizando cuentas...";
      }
    }
    if (bar) {
      bar.style.width = `${porcentaje}%`;
      bar.setAttribute("aria-valuenow", String(porcentaje));
    }
    if (pct) {
      pct.textContent = `${porcentaje}%`;
    }
  };

  window.addEventListener("reconta:progreso", (event) => {
    actualizar(event?.detail || {});
  });
};

setupRecontaOverlayListener();

window.prepararStickyHeaders = prepararStickyHeaders;

window.initModuloPlaneacion = async function({ moduloId, moduloNombre, selectorTabla = '#tablaComparacion', tablaBodyId = 'tablaCuentasBody' }) {
  try {
    // 1. Inicializar CuentasModulo
    const instancia = window.CuentasModulo?.init({ moduloId });
    if (instancia?.ready) {
      await instancia.ready;
    }
    
    // 2. Inicializar vista de planeación
    if (typeof window.initVistaModuloPlaneacion === 'function') {
      window.initVistaModuloPlaneacion();
    }
    
    // 3. Inicializar ModoEdicionPresupuesto
    if (typeof window.ModoEdicionPresupuesto !== 'undefined') {
      const inicioOK = window.ModoEdicionPresupuesto.inicializar(selectorTabla);
      if (!inicioOK) {
        console.warn(`⚠️ No se pudo inicializar ModoEdicionPresupuesto en ${moduloNombre}`);
      }
    } else {
      console.warn(`⚠️ ModoEdicionPresupuesto no disponible en ${moduloNombre}`);
    }
    
    prepararStickyHeaders(selectorTabla);

    // 4. Inicializar FlujoAutorizacion con callback completo
    if (typeof window.FlujoAutorizacion !== 'undefined') {
      const flujo = new window.FlujoAutorizacion({
        tablaId: tablaBodyId,
        modulo: moduloNombre.toUpperCase(),
        obtenerCambios: () => {
          // Capturar cambios de presupuesto (valores numéricos)
          const cambiosPresupuesto = window.CuentasModulo?.getCambios?.() || { presupuesto: [], nombres: [] };
          
          // Capturar layout (cuentas/descripciones/filas)
          const layoutActual = window.ModoEdicionPresupuesto?.cargarLayoutLocal?.() || null;
          
          const resultado = {
            presupuesto: cambiosPresupuesto.presupuesto || [],
            nombres: cambiosPresupuesto.nombres || [],
            layout: layoutActual,
            hayCambios: cambiosPresupuesto.presupuesto?.length > 0 || !!layoutActual
          };
          
          console.log(`📤 Obteniendo cambios ${moduloNombre}:`, resultado);
          return resultado;
        },
        obtenerHeaders: () => (window.Sesion?.headersAutenticacion?.() || {}),
        onEstadoChange: (estado) => {
          console.log(`🔄 Estado ${moduloNombre}:`, estado);
        },
        onGuardadoExitoso: () => {
          // Limpiar después de guardar exitosamente
          if (window.ModoEdicionPresupuesto?.limpiar) {
            window.ModoEdicionPresupuesto.desactivar(selectorTabla);
            window.ModoEdicionPresupuesto.limpiar();
          }
          if (window.CuentasModulo?.limpiarCambios) {
            window.CuentasModulo.limpiarCambios();
          }
        }
      }).init?.();
      
      // Guardar referencia global
      window.__flujoAutorizacionInstance = flujo;
      
      console.log(`✅ ${moduloNombre}: ModoEdicionPresupuesto + FlujoAutorizacion inicializados`);
    } else {
      console.warn(`⚠️ FlujoAutorizacion no disponible en ${moduloNombre}`);
    }
  } catch (error) {
    console.error(`❌ Error inicializando módulo ${moduloNombre}:`, error);
  }
};
