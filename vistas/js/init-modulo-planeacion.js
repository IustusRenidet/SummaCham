/**
 * Script de inicialización genérico para módulos de planeación
 * Integra ModoEdicionPresupuesto + FlujoAutorizacion + CuentasModulo
 * 
 * Uso: Incluir después de modo-edicion-presupuesto.js, flujo-autorizacion.js
 *      y llamar initModuloPlaneacion({ moduloId: 'rh', moduloNombre: 'RH' })
 */

const crearStickyHeaderOverlay = (tabla, wrapper) => {
  if (!tabla || !wrapper) return null;
  if (wrapper.__stickyHeaderOverlay) return wrapper.__stickyHeaderOverlay;

  const overlay = document.createElement("div");
  overlay.className = "sticky-table-header";
  overlay.setAttribute("aria-hidden", "true");
  document.body.appendChild(overlay);

  let cloneTable = null;
  let rafId = null;

  const getTopOffset = () => 0;

  const syncWidths = () => {
    if (!cloneTable || !tabla?.tHead) return;
    cloneTable.className = tabla.className;
    cloneTable.classList.add("sticky-table-clone");
    const originalCells = Array.from(tabla.tHead.querySelectorAll("th"));
    const cloneCells = Array.from(cloneTable.querySelectorAll("th"));
    originalCells.forEach((cell, idx) => {
      const cloneCell = cloneCells[idx];
      if (!cloneCell) return;
      const width = Math.ceil(cell.getBoundingClientRect().width);
      cloneCell.style.width = `${width}px`;
      cloneCell.style.minWidth = `${width}px`;
    });
    const tableWidth = Math.ceil(tabla.getBoundingClientRect().width);
    if (tableWidth) {
      cloneTable.style.width = `${tableWidth}px`;
    }
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
    overlay.appendChild(newTable);
    cloneTable = newTable;
    syncWidths();
  };

  const updateOverlay = () => {
    if (!tabla?.tHead) return;
    const rect = wrapper.getBoundingClientRect();
    overlay.style.left = `${rect.left}px`;
    overlay.style.width = `${rect.width}px`;
    const topOffset = getTopOffset();
    overlay.style.top = `${topOffset}px`;
    const headRect = tabla.tHead.getBoundingClientRect();
    const tableRect = tabla.getBoundingClientRect();
    const headerHeight = Math.ceil(headRect.height || 0);
    overlay.style.height = `${headerHeight}px`;
    const shouldShow =
      headRect.top < topOffset - 1 &&
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
    syncWidths();
    scheduleUpdate();
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

  syncClone();
  scheduleUpdate();

  const api = {
    refresh: () => {
      syncClone();
      scheduleUpdate();
    },
    syncWidths,
    setOffsets: (anchoPrimeraCol) => {
      overlay.style.setProperty("--sticky-col-1-left", "0px");
      overlay.style.setProperty(
        "--sticky-col-2-left",
        `${anchoPrimeraCol}px`
      );
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

  wrapper.classList.add("sticky-table-scroll");
  const overlay = crearStickyHeaderOverlay(tabla, wrapper);

  const ajustar = () => {
    const primeraCol =
      tabla.querySelector("thead tr:first-child th:nth-child(1)") ||
      tabla.querySelector("thead th:nth-child(1)");
    const anchoPrimeraCol = primeraCol
      ? Math.ceil(primeraCol.getBoundingClientRect().width)
      : 0;
    wrapper.style.setProperty("--sticky-col-1-left", "0px");
    wrapper.style.setProperty("--sticky-col-2-left", `${anchoPrimeraCol}px`);
    if (overlay) {
      overlay.setOffsets(anchoPrimeraCol);
      overlay.syncWidths();
    }
  };

  ajustar();

  if (!wrapper.dataset.stickyReady) {
    wrapper.dataset.stickyReady = "true";
    window.addEventListener("resize", ajustar);
    if (document.fonts?.ready) {
      document.fonts.ready.then(ajustar).catch(() => {});
    }
    const observer = new MutationObserver(() => ajustar());
    observer.observe(tabla, { attributes: true, attributeFilter: ["class"] });
  }
};

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
