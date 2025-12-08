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
    cuentasDisponibles: [],
    selectorTabla: SELECTOR_TABLA
  };

  const normalizeString = (s) => (s || '').toString().normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase().trim();

  // Helpers para persistir layout (cuenta/descripcion) por empresa/anio/modulo
  const obtenerClaveLayoutLocal = ({ moduloClave, empresaId, anio }) => {
    if (!moduloClave || !empresaId || !Number.isInteger(anio)) return null;
    return `planeacion-layout:${empresaId}:${anio}:${moduloClave}`;
  };

  const cargarLayoutLocal = ({ moduloClave, empresaId, anio }) => {
    const clave = obtenerClaveLayoutLocal({ moduloClave, empresaId, anio });
    if (!clave || !window.localStorage) return null;
    try {
      const crudo = window.localStorage.getItem(clave);
      return crudo ? JSON.parse(crudo) : null;
    } catch (err) {
      console.warn('No fue posible leer layout local', err);
      return null;
    }
  };

  const guardarLayoutLocal = ({ moduloClave, empresaId, anio, layout }) => {
    const clave = obtenerClaveLayoutLocal({ moduloClave, empresaId, anio });
    if (!clave || !window.localStorage || !layout) return false;
    try {
      window.localStorage.setItem(clave, JSON.stringify(layout));
      return true;
    } catch (err) {
      console.warn('No fue posible guardar layout local', err);
      return false;
    }
  };

  /**
   * Resolver la tabla a utilizar considerando:
   * - Selector recibido
   * - data-tabla del body (id sin #)
   * - Fallbacks comunes
   */
  function resolverTabla(selectorPreferido) {
    const candidatos = [];
    if (selectorPreferido) candidatos.push(selectorPreferido);

    const dataTabla = document.body?.dataset?.tabla;
    if (dataTabla) {
      candidatos.push(dataTabla.startsWith('#') ? dataTabla : `#${dataTabla}`);
    }

    candidatos.push(
      estado.selectorTabla || SELECTOR_TABLA,
      SELECTOR_TABLA,
      '#mainTable',
      '#tablaPresupuestos',
      'table.table-comparison',
      'table'
    );

    for (const sel of candidatos) {
      if (!sel) continue;
      const tabla = document.querySelector(sel);
      if (tabla) return { tabla, selectorUsado: sel };
    }

    return { tabla: null, selectorUsado: selectorPreferido || SELECTOR_TABLA };
  }

  /**
   * Inicializar celdas de presupuesto como editables
   */
  function inicializarCeldasEditables(tabla) {
    if (!tabla) return;

    // Buscar todas las celdas de presupuesto (numeros)
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

    // Celdas de texto (codigo / descripcion / nombre) - click to edit
    const textoCells = tabla.querySelectorAll('[data-role="descripcion"], th[data-role="code"], td[data-columna-clave="codigo"], td[data-columna-clave="label"]');
    textoCells.forEach((celda) => {
      celda.style.cursor = 'text';
      celda.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (!estado.modoEdicionActivo) return;
        activarEdicionTextoEnCelda(celda);
      });
      // Commit if content editable change arrives from other modules
      celda.addEventListener('blur', () => {
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
   * Activar edición textual (cuenta/descripcion) en una celda
   */
  function activarEdicionTextoEnCelda(celda) {
    if (!celda || celda.classList.contains(CLASE_EDITANDO)) return;
    const valor = celda.textContent?.trim() || '';

    const input = document.createElement('input');
    input.type = 'text';
    input.value = valor;
    input.className = 'edit-input-text';
    input.maxLength = 250;

    celda.textContent = '';
    celda.appendChild(input);
    celda.classList.add(CLASE_EDITANDO);
    input.focus();
    input.select();

    const guardar = () => {
      const nuevo = (input.value || '').toString().trim();
      celda.textContent = nuevo;
      celda.classList.remove(CLASE_EDITANDO);
      marcarComoModificado(celda);
      // Si se editó la cuenta/codigo, actualizar dataset de la fila
      try {
        const fila = celda.closest('tr');
        const columna = celda.dataset.columnaClave || celda.dataset.columnaKey || '';
        if (fila && (columna === 'codigo' || columna === 'cuenta')) {
          fila.dataset.cuenta = nuevo || '';
          fila.dataset.cuentaVisible = nuevo || '';
        }
      } catch (err) {
        // ignore
      }
      // Persistir layout inmediatamente (autoguardado de plantilla local)
      try { persistirLayoutActual(); } catch (err) { /* ignore */ }
    };
    const cancelar = () => {
      celda.textContent = valor;
      celda.classList.remove(CLASE_EDITANDO);
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') guardar();
      if (e.key === 'Escape') cancelar();
    });
    input.addEventListener('blur', guardar);
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

  // Capturar layout (cuenta+descripcion y tipo fila) desde la tabla para persistencia
  function capturarLayoutDesdeTabla(tabla) {
    if (!tabla) {
      const res = resolverTabla(estado.selectorTabla);
      tabla = res.tabla;
    }
    if (!tabla) return null;
    const filas = Array.from(tabla.tBodies[0]?.rows || []);
    const layout = filas.map((fila, idx) => {
      const cuenta = (fila.dataset.cuenta || fila.querySelector('[data-cuenta]')?.dataset.cuenta || fila.cells[0]?.textContent || '').toString().trim();
      const descripcion = (fila.querySelector('[data-role="descripcion"]')?.textContent || fila.cells[1]?.textContent || '').toString().trim();
      const role = fila.dataset.rowRole || fila.dataset.rowRole?.trim() || fila.dataset.role || '';
      return {
        id: fila.id || `r${idx}`,
        cuenta,
        descripcion,
        role
      };
    });
    return { filas: layout };
  }

  function persistirLayoutActual() {
    const { tabla } = resolverTabla(estado.selectorTabla);
    // forzar que cualquier edición activa se aplique antes de leer la tabla
    try {
      if (tabla) {
        tabla.querySelectorAll('[contenteditable="true"]').forEach((el) => el.blur());
        // blur active element if needed
        if (document.activeElement && document.activeElement.matches && document.activeElement.matches('[contenteditable="true"]')) {
          document.activeElement.blur();
        }
      }
    } catch (err) {
      // ignore
    }
    if (!tabla) return false;
    const empresa = Sesion.obtenerEmpresaActiva();
    const selectAnioElem = document.getElementById('selectAnio') || document.getElementById('resumenYearSelect') || document.getElementById('yearSelect') || document.querySelector('[name="anio"]');
    const anioSeleccion = Number(selectAnioElem?.value || new Date().getFullYear());
    const anio = Number.isInteger(anioSeleccion) ? anioSeleccion : null;
    const moduloClave = (document.body?.dataset?.modulo || document.body?.dataset?.moduloId || 'summary').toString().trim();
    if (!empresa?.id || !Number.isInteger(anio) || !moduloClave) {
      console.warn('No fue posible persistir layout: falta empresa/anio/modulo', { empresa: empresa?.id, anio, moduloClave });
      return false;
    }
    const layout = capturarLayoutDesdeTabla(tabla);
    if (!layout) return false;
    const guardado = guardarLayoutLocal({ moduloClave, empresaId: empresa.id, anio, layout });
    if (guardado) {
      console.log('Layout persistido (localStorage)', { moduloClave, empresaId: empresa.id, anio, filasCapturadas: layout?.filas?.length || 0 });
    }
    return guardado;
  }

  function aplicarLayoutLocal(layout, tabla) {
    if (!layout || !Array.isArray(layout.filas) || !tabla) return false;
    const filas = Array.from(tabla.tBodies[0]?.rows || []);
    layout.filas.forEach((filaLayout) => {
      const { cuenta: cuentaLayout, descripcion: descripcionLayout } = filaLayout || {};
      if (!cuentaLayout) return;
      // Buscar fila por dataset.cuenta o por primera celda coincidente
      const filaMatch = filas.find(f => (f.dataset.cuenta && normalizeString(f.dataset.cuenta) === normalizeString(cuentaLayout))
        || ((f.cells[0]?.textContent || '').trim() === (cuentaLayout || '').trim()));
      if (filaMatch) {
        const celdaDescripcion = filaMatch.querySelector('[data-role="descripcion"]') || filaMatch.cells[1];
        if (celdaDescripcion && descripcionLayout != null) {
          celdaDescripcion.textContent = descripcionLayout;
        }
        // Si el layout contiene un valor de cuenta diferente, actualizar el dataset
        try {
          if (cuentaLayout) {
            const actual = (filaMatch.dataset.cuenta || (filaMatch.querySelector('[data-cuenta]')?.dataset.cuenta || '')).toString().trim();
            if (actual !== (cuentaLayout || '').toString().trim()) {
              filaMatch.dataset.cuenta = cuentaLayout || '';
              filaMatch.dataset.cuentaVisible = cuentaLayout || '';
            }
          }
        } catch (err) {
          // ignore
        }
      }
    });
    return true;
  }

  /**
   * Limpiar cambios capturados
   */
  function limpiarCambios() {
    estado.cambiosCapturados = {};
    
    // Remover estilos de modificado
    const { tabla } = resolverTabla(estado.selectorTabla);
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

  // CONTEXT MENU: Agregar/Eliminar filas y secciones
  let menuContextual = null;
  let filaContextual = null;

  function ocultarMenuContextual() {
    if (menuContextual) menuContextual.hidden = true;
  }

  function mostrarMenuContextual(x, y, opciones) {
    const menu = menuContextual || Object.assign(document.createElement('div'), { className: 'modoedicion-context-menu', style: 'position:absolute; z-index:99999; background:#fff; border:1px solid #dcdcdc; padding:6px; box-shadow: 0 3px 8px rgba(0,0,0,0.12);' });
    menuContextual = menu;
    menu.innerHTML = '';
    opciones.forEach((opcion) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-sm btn-light w-100 text-start';
      btn.textContent = opcion.texto || opcion.label;
      btn.addEventListener('click', () => {
        switch (opcion.clave) {
          case 'add_above': insertarFilaNueva('arriba'); break;
          case 'add_below': insertarFilaNueva('abajo'); break;
          case 'delete_row': eliminarFilaSeleccionada(); break;
          case 'add_section': agregarSeccionNueva(); break;
          default: break;
        }
        ocultarMenuContextual();
      });
      menu.appendChild(btn);
    });
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.hidden = false;
    if (!document.body.contains(menu)) document.body.appendChild(menu);
  }

  function insertarFilaNueva(pos = 'abajo') {
    const { tabla } = resolverTabla(estado.selectorTabla);
    if (!tabla || !filaContextual) return;
    const nueva = filaContextual.cloneNode(true);
    // limpiar valores y IDs
    nueva.id = '';
    Array.from(nueva.cells).forEach((c) => c.textContent = '');
    if (pos === 'abajo') filaContextual.parentNode.insertBefore(nueva, filaContextual.nextSibling);
    else filaContextual.parentNode.insertBefore(nueva, filaContextual);
    // rebind
    inicializarCeldasEditables(tabla);
  }

  function eliminarFilaSeleccionada() {
    if (!filaContextual) return;
    filaContextual.remove();
    filaContextual = null;
  }

  function agregarSeccionNueva() {
    const { tabla } = resolverTabla(estado.selectorTabla);
    if (!tabla || !filaContextual) return;
    const thead = tabla.tHead;
    const tbody = tabla.tBodies[0];
    const nueva = document.createElement('tr');
    nueva.className = 'section-header-row';
    const c1 = document.createElement('td');
    c1.colSpan = tabla.tHead.rows[0]?.cells.length || 2;
    c1.textContent = 'Nueva Seccion';
    nueva.appendChild(c1);
    filaContextual.parentNode.insertBefore(nueva, filaContextual);
    inicializarCeldasEditables(tabla);
  }

  document.addEventListener('contextmenu', (evt) => {
    if (!estado.modoEdicionActivo) return;
    const res = resolverTabla(estado.selectorTabla);
    if (!res || !res.tabla) return;
    const tabla = res.tabla;
    if (!tabla.contains(evt.target)) return;
    const fila = evt.target.closest('tr');
    if (!fila) return;
    filaContextual = fila;
    const opciones = [];
    // si es fila de cuenta
    if (fila.querySelector('[data-cuenta]') || fila.dataset.cuenta || fila.classList.contains('fila-cuenta')) {
      opciones.push({ clave: 'add_above', texto: 'Agregar cuenta arriba' });
      opciones.push({ clave: 'add_below', texto: 'Agregar cuenta abajo' });
      opciones.push({ clave: 'delete_row', texto: 'Eliminar fila' });
    } else if (fila.classList.contains('section-header-row')) {
      opciones.push({ clave: 'delete_row', texto: 'Eliminar sección' });
    }
    opciones.push({ clave: 'add_section', texto: 'Agregar sección' });
    if (!opciones.length) return;
    evt.preventDefault();
    mostrarMenuContextual(evt.pageX, evt.pageY, opciones);
  });

  /**
   * API Pública
   */
  window.ModoEdicionPresupuesto = {
    /**
     * Inicializar el módulo
     */
    inicializar: function(selectorTabla) {
      const { tabla, selectorUsado } = resolverTabla(selectorTabla);
      if (!tabla) {
        console.error(`❌ No se encontró tabla en selector: ${selectorUsado}`);
        // Reintenta por si la tabla se inserta asincrónicamente
        let reintentos = 4;
        const timer = setInterval(() => {
          const intento = resolverTabla(selectorUsado);
          if (intento.tabla) {
            clearInterval(timer);
            estado.selectorTabla = intento.selectorUsado;
            inicializarCeldasEditables(intento.tabla);
            console.log(`✅ Modo edición inicializado (reintento) sobre ${intento.selectorUsado}`);
          } else if (--reintentos <= 0) {
            clearInterval(timer);
          }
        }, 400);
        return false;
      }

      estado.selectorTabla = selectorUsado;
      inicializarCeldasEditables(tabla);
      // Intentar cargar layout guardado localmente y aplicarlo
      try {
        const empresa = Sesion.obtenerEmpresaActiva();
        const anioSeleccion = Number(document.getElementById('selectAnio')?.value || new Date().getFullYear());
        const anio = Number.isInteger(anioSeleccion) ? anioSeleccion : null;
        const moduloClave = (document.body?.dataset?.modulo || document.body?.dataset?.moduloId || 'summary').toString().trim();
        if (empresa?.id && Number.isInteger(anio) && moduloClave) {
          const layoutGuardado = cargarLayoutLocal({ moduloClave, empresaId: empresa.id, anio });
          if (layoutGuardado) {
            aplicarLayoutLocal(layoutGuardado, tabla);
          }
        }
      } catch (err) {
        console.warn('Error aplicando layout local', err);
      }
      console.log(`✅ Modo edición inicializado sobre ${selectorUsado}`);
      return true;
    },

    /**
     * Activar modo edición
     */
    activar: function(selectorTabla) {
      const { tabla, selectorUsado } = resolverTabla(selectorTabla || estado.selectorTabla);
      if (!tabla) {
        console.error(`❌ No se encontró tabla: ${selectorUsado}`);
        return false;
      }
      
      estado.selectorTabla = selectorUsado;
      activarModoEdicion(tabla);
      return true;
    },

    /**
     * Desactivar modo edición
     */
    desactivar: function(selectorTabla) {
      const { tabla, selectorUsado } = resolverTabla(selectorTabla || estado.selectorTabla);
      if (!tabla) return false;
      
      estado.selectorTabla = selectorUsado;
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
    },
    // Persiste layout actual como plantilla local (por empresa/anio/modulo)
    guardarLayout: function() {
      return persistirLayoutActual();
    },
    cargarLayoutLocal: function() {
      const empresa = Sesion.obtenerEmpresaActiva();
      const anioSeleccion = Number(document.getElementById('selectAnio')?.value || new Date().getFullYear());
      const anio = Number.isInteger(anioSeleccion) ? anioSeleccion : null;
      const moduloClave = (document.body?.dataset?.modulo || document.body?.dataset?.moduloId || 'summary').toString().trim();
      if (!empresa?.id || !Number.isInteger(anio) || !moduloClave) return null;
      return cargarLayoutLocal({ moduloClave, empresaId: empresa.id, anio });
    }
    , aplicarLayoutLocal: function(layout) {
      const { tabla } = resolverTabla(estado.selectorTabla);
      return aplicarLayoutLocal(layout, tabla);
    }
  };

  console.log('📦 Módulo ModoEdicionPresupuesto cargado');
})();
