/**
 * Módulo: Modo Edición de Presupuestos
 * 
 * Transforma una tabla estática en editable con:
 * - Celdas clickeables
 * - Captura de cambios
 * - Validación de números
 * - Autocompletado de cuentas
 */

(function() {
  const MESES = [
    { id: 'budget-ene', label: 'ENE', numero: 1 },
    { id: 'budget-feb', label: 'FEB', numero: 2 },
    { id: 'budget-mar', label: 'MAR', numero: 3 },
    { id: 'budget-abr', label: 'ABR', numero: 4 },
    { id: 'budget-may', label: 'MAY', numero: 5 },
    { id: 'budget-jun', label: 'JUN', numero: 6 },
    { id: 'budget-jul', label: 'JUL', numero: 7 },
    { id: 'budget-ago', label: 'AGO', numero: 8 },
    { id: 'budget-sep', label: 'SEP', numero: 9 },
    { id: 'budget-oct', label: 'OCT', numero: 10 },
    { id: 'budget-nov', label: 'NOV', numero: 11 },
    { id: 'budget-dic', label: 'DIC', numero: 12 }
  ];

  const SELECTOR_TABLA = '#tablaComparacion';
  const CLASE_EDITABLE = 'editable-cell';
  const CLASE_EDITANDO = 'cell-editing';
  const CLASE_MODIFICADO = 'cell-modified';

  // Estado global del módulo
  const estado = {
    modoEdicionActivo: false,
    cambiosCapturados: {},
    cuentasDisponibles: []
  };

  /**
   * Inicializar celdas de presupuesto como editables
   */
  function inicializarCeldasEditables(tabla) {
    if (!tabla) return;

    // Buscar todas las celdas de presupuesto
    const celdas = tabla.querySelectorAll('td[data-mes]');
    
    celdas.forEach((celda) => {
      celda.classList.add(CLASE_EDITABLE);
      celda.style.cursor = 'pointer';
      
      celda.addEventListener('click', (evento) => {
        evento.stopPropagation();
        if (estado.modoEdicionActivo) {
          activarEdicionEnCelda(celda);
        }
      });

      // Detectar cambios directamente (por si el código carga datos vía JS)
      celda.addEventListener('change', () => {
        marcarComoModificado(celda);
      });
    });
  }

  /**
   * Activar modo edición en una celda específica
   */
  function activarEdicionEnCelda(celda) {
    // Si ya está editando, ignorar
    if (celda.classList.contains(CLASE_EDITANDO)) return;

    const valor = celda.textContent.trim();
    const numero = parseFloat(valor.replace(/,/g, '')) || 0;
    
    // Crear input
    const input = document.createElement('input');
    input.type = 'number';
    input.value = numero;
    input.className = 'edit-input';
    input.step = '0.01';
    input.min = '0';
    
    // Reemplazar contenido
    celda.textContent = '';
    celda.appendChild(input);
    celda.classList.add(CLASE_EDITANDO);
    
    // Auto-focus y select
    input.focus();
    input.select();

    /**
     * Guardar cambio
     */
    const guardarCambio = () => {
      const nuevoValor = parseFloat(input.value) || 0;
      const formateado = formatearNumero(nuevoValor);
      celda.textContent = formateado;
      celda.classList.remove(CLASE_EDITANDO);
      
      // Si cambió el valor, marcar como modificado
      if (Math.abs(nuevoValor - numero) > 0.001) {
        marcarComoModificado(celda);
        capturarCambio(celda, nuevoValor);
      }
    };

    /**
     * Cancelar edición (ESC)
     */
    const cancelarEdicion = () => {
      celda.textContent = valor;
      celda.classList.remove(CLASE_EDITANDO);
    };

    // Event listeners
    input.addEventListener('blur', guardarCambio);
    input.addEventListener('keydown', (evento) => {
      if (evento.key === 'Enter') guardarCambio();
      if (evento.key === 'Escape') cancelarEdicion();
    });
  }

  /**
   * Formatear número con separadores de miles
   */
  function formatearNumero(numero) {
    if (!Number.isFinite(numero)) return '0.00';
    return numero.toLocaleString('es-MX', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  /**
   * Marcar celda como modificada
   */
  function marcarComoModificado(celda) {
    celda.classList.add(CLASE_MODIFICADO);
    
    // Cambiar color de fondo para visual feedback
    if (!celda.style.backgroundColor) {
      celda.style.backgroundColor = '#ffffcc'; // Amarillo claro
    }
  }

  /**
   * Capturar cambio de una celda
   */
  function capturarCambio(celda, nuevoValor) {
    const fila = celda.closest('tr');
    if (!fila) return;

    // Obtener cuenta de varias formas posibles
    let cuenta = fila.dataset.cuenta || 
                 fila.querySelector('[data-cuenta]')?.dataset.cuenta ||
                 fila.cells[0]?.textContent.trim();

    const mes = celda.dataset.mes;

    if (!cuenta || !mes) return;

    // Crear estructura de cambios si no existe
    if (!estado.cambiosCapturados[cuenta]) {
      estado.cambiosCapturados[cuenta] = {
        cuenta,
        valores: {}
      };
    }

    estado.cambiosCapturados[cuenta].valores[mes] = nuevoValor;
    
    console.log(`📝 Capturado: ${cuenta} ${mes} = ${nuevoValor}`);
  }

  /**
   * Obtener todos los cambios capturados
   */
  function obtenerTodosCambios() {
    const presupuesto = Object.values(estado.cambiosCapturados);
    
    if (presupuesto.length === 0) {
      console.warn('⚠️ No hay cambios capturados en modo edición');
    } else {
      console.log(`✅ Cambios capturados: ${presupuesto.length} cuentas modificadas`);
    }
    
    return { presupuesto };
  }

  /**
   * Limpiar cambios capturados
   */
  function limpiarCambios() {
    estado.cambiosCapturados = {};
    
    // Remover estilos de modificado
    const tabla = document.querySelector(SELECTOR_TABLA);
    if (tabla) {
      tabla.querySelectorAll(`.${CLASE_MODIFICADO}`).forEach((celda) => {
        celda.classList.remove(CLASE_MODIFICADO);
        celda.style.backgroundColor = '';
      });
    }
    
    console.log('🧹 Cambios limpiados');
  }

  /**
   * Activar modo edición global
   */
  function activarModoEdicion(tabla) {
    if (!tabla) return;
    
    estado.modoEdicionActivo = true;
    tabla.classList.add('modo-edicion-activo');
    
    // Mostrar hint visual
    const celdas = tabla.querySelectorAll(`.${CLASE_EDITABLE}`);
    celdas.forEach((celda) => {
      celda.style.cursor = 'pointer';
      celda.title = 'Click para editar';
    });
    
    console.log('✅ Modo edición ACTIVADO');
  }

  /**
   * Desactivar modo edición global
   */
  function desactivarModoEdicion(tabla) {
    if (!tabla) return;
    
    estado.modoEdicionActivo = false;
    tabla.classList.remove('modo-edicion-activo');
    
    // Limpiar cualquier edición en curso
    const editando = tabla.querySelector(`.${CLASE_EDITANDO}`);
    if (editando) {
      editando.textContent = editando.querySelector('input')?.value || '';
      editando.classList.remove(CLASE_EDITANDO);
    }
    
    console.log('🛑 Modo edición DESACTIVADO');
  }

  /**
   * API Pública
   */
  window.ModoEdicionPresupuesto = {
    /**
     * Inicializar el módulo
     */
    inicializar: function(selectorTabla) {
      const tabla = document.querySelector(selectorTabla);
      if (!tabla) {
        console.error(`❌ No se encontró tabla en selector: ${selectorTabla}`);
        return false;
      }

      inicializarCeldasEditables(tabla);
      console.log('✅ Modo edición inicializado');
      return true;
    },

    /**
     * Activar modo edición
     */
    activar: function(selectorTabla) {
      const tabla = document.querySelector(selectorTabla);
      if (!tabla) {
        console.error(`❌ No se encontró tabla: ${selectorTabla}`);
        return false;
      }
      
      activarModoEdicion(tabla);
      return true;
    },

    /**
     * Desactivar modo edición
     */
    desactivar: function(selectorTabla) {
      const tabla = document.querySelector(selectorTabla);
      if (!tabla) return false;
      
      desactivarModoEdicion(tabla);
      return true;
    },

    /**
     * Obtener cambios capturados
     */
    obtenerCambios: function() {
      return obtenerTodosCambios();
    },

    /**
     * Limpiar cambios
     */
    limpiar: function() {
      limpiarCambios();
    },

    /**
     * Obtener estado
     */
    estaActivo: function() {
      return estado.modoEdicionActivo;
    },

    /**
     * Obtener número de cambios
     */
    obtenerNumCambios: function() {
      return Object.keys(estado.cambiosCapturados).length;
    }
  };

  console.log('📦 Módulo ModoEdicionPresupuesto cargado');
})();
