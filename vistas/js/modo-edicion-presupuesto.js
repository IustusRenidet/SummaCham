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
    selectorTabla: SELECTOR_TABLA,
    soloLayout: false // Nueva opción: solo editar cuenta/descripción, no valores numéricos
  };

  const normalizeString = (s) => (s || '').toString().normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase().trim();
  const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:3005' : window.location.origin;

  /**
   * Cargar catálogo completo de cuentas desde CUENTASYY (Firebird)
   */
  async function cargarCatalogoCuentas(empresaId, anio) {
    try {
      if (!empresaId || !Number.isInteger(Number(anio))) {
        console.warn('⚠️ Parámetros inválidos para cargar catálogo de cuentas');
        return [];
      }
      
      const ruta = `${API_BASE}/api/saldos/catalogo?empresaId=${encodeURIComponent(empresaId)}&anio=${Number(anio)}`;
      const headers = (typeof Sesion !== 'undefined' && typeof Sesion.headersAutenticacion === 'function') 
        ? Sesion.headersAutenticacion() 
        : {};
      
      const resp = await fetch(ruta, { headers });
      if (!resp.ok) {
        console.warn(`⚠️ Error al cargar catálogo: ${resp.status}`);
        return [];
      }
      
      const data = await resp.json();
      const cuentas = data.cuentas || [];
      
      console.log(`✅ Catálogo cargado: ${cuentas.length} cuentas de CUENTASYY ${anio}`);
      estado.cuentasDisponibles = cuentas;
      return cuentas;
    } catch (err) {
      console.error('❌ Error cargando catálogo de cuentas:', err);
      return [];
    }
  }

  /**
   * Crear/actualizar datalist con las cuentas disponibles
   */
  function crearDatalistCuentas() {
    let datalist = document.getElementById('datalist-cuentas-autocomplete');
    if (!datalist) {
      datalist = document.createElement('datalist');
      datalist.id = 'datalist-cuentas-autocomplete';
      document.body.appendChild(datalist);
    }
    
    datalist.innerHTML = '';
    
    estado.cuentasDisponibles.forEach(cta => {
      const option = document.createElement('option');
      // Formato: "401-001-000-00 - Renovaciones"
      const cuenta = cta.cuenta || '';
      const nombre = cta.nombre || '';
      option.value = cuenta;
      option.textContent = nombre ? `${cuenta} - ${nombre}` : cuenta;
      datalist.appendChild(option);
    });
    
    return datalist.id;
  }

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

  async function guardarLayoutServidor({ moduloClave, empresaId, anio, layout }) {
    try {
      const ruta = `${API_BASE}/api/layouts`;
      const headers = (typeof Sesion !== 'undefined' && typeof Sesion.headersAutenticacion === 'function') ? { 'Content-Type': 'application/json', ...Sesion.headersAutenticacion() } : { 'Content-Type': 'application/json' };
      const resp = await fetch(ruta, { method: 'POST', headers, body: JSON.stringify({ empresaId, modulo: moduloClave, anio, datos: layout }) });
      if (!resp.ok) {
        const data = await resp.json().catch(()=>({}));
        console.warn('Guardar layout servidor fallo:', data.mensaje || resp.status);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('Error al guardar layout en servidor', err);
      return false;
    }
  }

  async function cargarLayoutServidor({ moduloClave, empresaId, anio }) {
    try {
      if (!empresaId || !moduloClave || !Number.isInteger(Number(anio))) return null;
      const ruta = `${API_BASE}/api/layouts?empresaId=${encodeURIComponent(empresaId)}&modulo=${encodeURIComponent(moduloClave)}&anio=${Number(anio)}`;
      const headers = (typeof Sesion !== 'undefined' && typeof Sesion.headersAutenticacion === 'function') ? Sesion.headersAutenticacion() : null;
      const resp = await fetch(ruta, { headers });
      if (!resp.ok) return null;
      const data = await resp.json().catch(()=>({}));
      return data.layout || null;
    } catch (err) {
      console.warn('Error cargar layout servidor', err);
      return null;
    }
  }

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

    // Si NO es modo soloLayout, permitir editar celdas numéricas
    if (!estado.soloLayout) {
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
    }

    // Celdas de texto (codigo / descripcion / nombre) - click to edit
    // IMPORTANTE: Estas columnas NO requieren modo edición activo porque NO se insertan a COI
    // Detectar por posición: columna 0 = cuenta/código, columna 1 = descripción/nombre
    const filas = Array.from(tabla.querySelectorAll('tbody tr'));
    filas.forEach(fila => {
      const celdaCuenta = fila.cells[0]; // Primera columna = cuenta
      const celdaNombre = fila.cells[1]; // Segunda columna = descripción/nombre
      
      if (celdaCuenta && !celdaCuenta.dataset.mes) {
        celdaCuenta.style.cursor = 'text';
        celdaCuenta.dataset.columnaClave = 'cuenta';
        celdaCuenta.addEventListener('click', (ev) => {
          ev.stopPropagation();
          activarEdicionTextoEnCelda(celdaCuenta);
        });
      }
      
      if (celdaNombre && !celdaNombre.dataset.mes) {
        celdaNombre.style.cursor = 'text';
        celdaNombre.dataset.columnaClave = 'descripcion';
        celdaNombre.addEventListener('click', (ev) => {
          ev.stopPropagation();
          activarEdicionTextoEnCelda(celdaNombre);
        });
      }
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
   * NOTA: CUENTAS y DESCRIPCION se pueden editar SIEMPRE (no requieren modo edición activo)
   * porque NO se insertan a COI - solo son para visualización/organización local
   */
  function activarEdicionTextoEnCelda(celda) {
    if (!celda || celda.classList.contains(CLASE_EDITANDO)) return;
    const valor = celda.textContent?.trim() || '';

    const input = document.createElement('input');
    input.type = 'text';
    input.value = valor;
    input.className = 'edit-input-text';
    input.maxLength = 250;

    // AUTOCOMPLETE SOLO para columna CUENTA (no para descripcion/nombre)
    const columna = celda.dataset.columnaClave || '';
    if (columna === 'cuenta' && estado.cuentasDisponibles?.length > 0) {
      const datalistId = crearDatalistCuentas();
      input.setAttribute('list', datalistId);
      input.placeholder = 'Buscar cuenta...';
    } else if (columna === 'descripcion') {
      input.placeholder = 'Descripción...';
    }

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
      
      // Si se editó la cuenta, actualizar dataset de la fila
      const fila = celda.closest('tr');
      if (fila && celda.dataset.columnaClave === 'cuenta') {
        fila.dataset.cuenta = nuevo || '';
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
    const guardadoLocal = guardarLayoutLocal({ moduloClave, empresaId: empresa.id, anio, layout });
    // Try server-side persist; fallback silently if server fails
    try { guardarLayoutServidor({ moduloClave, empresaId: empresa.id, anio, layout }).then((srv)=>{ if (srv) console.log('Layout guardado en servidor'); }); } catch (err) {}
    if (guardadoLocal) {
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
    
    // Si es modo soloLayout, NO activar edición numérica (solo cuenta/descripción siempre editables)
    if (estado.soloLayout) {
      console.log('ℹ️ ModoEdicionPresupuesto: soloLayout activo, cuenta/descripción siempre editables');
      return;
    }
    
    estado.modoEdicionActivo = true;
    tabla.classList.add('modo-edicion-activo');
    
    // Mostrar hint visual
    const celdas = tabla.querySelectorAll(`.${CLASE_EDITABLE}`);
    celdas.forEach((celda) => {
      celda.style.cursor = 'pointer';
      celda.title = 'Click para editar';
    });
    
    console.log('🟢 ModoEdicionPresupuesto: ACTIVADO (celdas numéricas editables)');
  }

  /**
   * Desactivar modo edición global
   */
  function desactivarModoEdicion(tabla) {
    if (!tabla) return;
    
    // Si es modo soloLayout, NO desactivar (no hay nada que desactivar)
    if (estado.soloLayout) {
      console.log('ℹ️ ModoEdicionPresupuesto: soloLayout, cuenta/descripción siempre editables');
      return;
    }
    
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
    if (!menuContextual) return;
    // remove keyboard handler
    try {
      if (menuContextual._keyHandler) menuContextual.removeEventListener('keydown', menuContextual._keyHandler);
    } catch (err) {}
    menuContextual.hidden = true;
    // return focus to the table or last active element
    try { document.activeElement?.blur(); } catch (err) {}
  }

  function mostrarMenuContextual(x, y, opciones) {
    // Ensure we have base styles injected
    if (!document.getElementById('modoedicion-style')) {
      const style = document.createElement('style');
      style.id = 'modoedicion-style';
      style.textContent = `
        .modoedicion-context-menu { position: absolute; z-index: 99999; background: #fff; border: 1px solid #dcdcdc; padding: 4px; box-shadow: 0 3px 8px rgba(0,0,0,0.12); min-width: 140px; }
        .modoedicion-context-menu button { display:block; width:100%; border: none; background: transparent; padding:6px 10px; text-align: left; cursor: pointer; }
        .modoedicion-context-menu button:focus { outline: 2px solid #2b7cff; background:#f0f8ff; }
      `;
      document.head.appendChild(style);
    }

    const menu = menuContextual || Object.assign(document.createElement('div'), { className: 'modoedicion-context-menu', role: 'menu', 'aria-label': 'Acciones de edición' });
    menuContextual = menu;
    menu.innerHTML = '';
    opciones.forEach((opcion, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-sm btn-light w-100 text-start';
      btn.textContent = opcion.texto || opcion.label;
      btn.setAttribute('role', 'menuitem');
      btn.setAttribute('tabindex', '-1');
      btn.addEventListener('click', () => {
        switch (opcion.clave) {
          case 'add_row':
            // Usar InsertionWizard si está disponible
            if (typeof window.InsertionWizard !== 'undefined') {
              window.InsertionWizard.open(filaContextual);
            } else {
              // Fallback al sistema simple
              insertarFilaNueva('abajo');
            }
            break;
          case 'delete_row': eliminarFilaSeleccionada(); break;
          default: break;
        }
        ocultarMenuContextual();
      });
      menu.appendChild(btn);
    });
    document.body.appendChild(menu);
    // prevent offscreen
    menu.hidden = true; // hide until positioned
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    requestAnimationFrame(() => {
      const rect = menu.getBoundingClientRect();
      let nx = x, ny = y;
      if (rect.right > window.innerWidth) nx = Math.max(6, x - rect.width);
      if (rect.bottom > window.innerHeight) ny = Math.max(6, y - rect.height);
      menu.style.left = `${nx}px`;
      menu.style.top = `${ny}px`;
      menu.hidden = false;
      // Setup keyboard navigation
      const botones = Array.from(menu.querySelectorAll('button'));
      if (botones.length) {
        botones.forEach((b, i) => b.setAttribute('data-idx', i));
        botones[0].setAttribute('tabindex', '0');
        botones[0].focus();
        const keyHandler = (e) => {
          if (!menu || menu.hidden) return;
          const current = document.activeElement;
          const idx = Number(current?.getAttribute('data-idx') || 0);
          if (e.key === 'ArrowDown') {
            const next = botones[(idx + 1) % botones.length]; next.focus(); e.preventDefault();
          } else if (e.key === 'ArrowUp') {
            const prev = botones[(idx - 1 + botones.length) % botones.length]; prev.focus(); e.preventDefault();
          } else if (e.key === 'Escape') {
            ocultarMenuContextual(); e.preventDefault();
          }
        };
        menu._keyHandler = keyHandler;
        menu.addEventListener('keydown', keyHandler);
      }
    });
    menuContextual = menu;
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
    // Si es fila de cuenta o sección
    if (fila.querySelector('[data-cuenta]') || fila.dataset.cuenta || fila.classList.contains('fila-cuenta') || fila.classList.contains('section-header-row')) {
      opciones.push({ clave: 'add_row', texto: 'Agregar cuenta/sección...' });
      opciones.push({ clave: 'delete_row', texto: 'Eliminar fila' });
    } else {
      opciones.push({ clave: 'add_row', texto: 'Agregar cuenta/sección...' });
    }
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
     * @param {string} selectorTabla - Selector CSS de la tabla
     * @param {object} opciones - { soloLayout: boolean } - Si true, solo edita cuenta/descripción
     */
    inicializar: function(selectorTabla, opciones = {}) {
      // Configurar modo soloLayout (para SUMMARY/RESUMEN)
      estado.soloLayout = opciones.soloLayout === true;
      
      if (estado.soloLayout) {
        console.log('📝 Modo SOLO LAYOUT: cuenta/descripción editables, NO valores numéricos');
      }
      
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
      
      // Cargar catálogo de cuentas desde CUENTASYY (Firebird)
      try {
        const empresa = Sesion?.obtenerEmpresaActiva?.();
        const anioSeleccion = Number(document.getElementById('selectAnio')?.value || new Date().getFullYear());
        const anio = Number.isInteger(anioSeleccion) ? anioSeleccion : null;
        
        if (empresa?.id && Number.isInteger(anio)) {
          cargarCatalogoCuentas(empresa.id, anio);
          
          // Escuchar cambios de año para recargar catálogo
          const selectAnio = document.getElementById('selectAnio');
          if (selectAnio && !selectAnio.dataset.catalogoListener) {
            selectAnio.dataset.catalogoListener = 'true';
            selectAnio.addEventListener('change', () => {
              const nuevoAnio = Number(selectAnio.value);
              if (Number.isInteger(nuevoAnio) && empresa?.id) {
                cargarCatalogoCuentas(empresa.id, nuevoAnio);
              }
            });
          }
        }
      } catch (err) {
        console.warn('⚠️ Error cargando catálogo de cuentas:', err);
      }
      
      // Intentar cargar layout guardado localmente y aplicarlo
      try {
        const empresa = Sesion.obtenerEmpresaActiva();
        const anioSeleccion = Number(document.getElementById('selectAnio')?.value || new Date().getFullYear());
        const anio = Number.isInteger(anioSeleccion) ? anioSeleccion : null;
        const moduloClave = (document.body?.dataset?.modulo || document.body?.dataset?.moduloId || 'summary').toString().trim();
        if (empresa?.id && Number.isInteger(anio) && moduloClave) {
          // Prefer server layout; fallback to local layout
          (async () => {
            const serverLayout = await cargarLayoutServidor({ moduloClave, empresaId: empresa.id, anio });
            if (serverLayout && aplicarLayoutLocal(serverLayout, tabla)) return;
            const localLayout = cargarLayoutLocal({ moduloClave, empresaId: empresa.id, anio });
            if (localLayout) aplicarLayoutLocal(localLayout, tabla);
          })();
        }
      } catch (err) {
        console.warn('Error aplicando layout local', err);
      }
      
      const mensajeInicial = estado.soloLayout 
        ? `✅ ModoEdicionPresupuesto (soloLayout): cuenta/descripción editables en ${selectorUsado}`
        : `✅ ModoEdicionPresupuesto: listeners inicializados (NO activo) en ${selectorUsado}`;
      console.log(mensajeInicial);
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
