/**
 * Script de inicialización genérico para módulos de planeación
 * Integra ModoEdicionPresupuesto + FlujoAutorizacion + CuentasModulo
 * 
 * Uso: Incluir después de modo-edicion-presupuesto.js, flujo-autorizacion.js
 *      y llamar initModuloPlaneacion({ moduloId: 'rh', moduloNombre: 'RH' })
 */

const prepararStickyHeaders = (selectorTabla) => {
  const tabla = document.querySelector(selectorTabla);
  if (!tabla) return;

  const wrapper = tabla.closest(".table-responsive");
  if (!wrapper) return;

  wrapper.classList.add("sticky-table-scroll");

  const ajustar = () => {
    const primeraCol = tabla.querySelector(
      "thead tr:first-child th:nth-child(1)"
    ) || tabla.querySelector("thead th:nth-child(1)");
    const anchoPrimeraCol = primeraCol
      ? Math.ceil(primeraCol.getBoundingClientRect().width)
      : 0;
    wrapper.style.setProperty("--sticky-col-1-left", "0px");
    wrapper.style.setProperty("--sticky-col-2-left", `${anchoPrimeraCol}px`);
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
