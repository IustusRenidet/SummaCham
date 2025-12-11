/**
 * Script de inicialización genérico para módulos de planeación
 * Integra ModoEdicionPresupuesto + FlujoAutorizacion + CuentasModulo
 * 
 * Uso: Incluir después de modo-edicion-presupuesto.js, flujo-autorizacion.js
 *      y llamar initModuloPlaneacion({ moduloId: 'rh', moduloNombre: 'RH' })
 */

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
