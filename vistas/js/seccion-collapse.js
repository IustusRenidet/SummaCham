/**
 * Componente para Colapsar/Expandir Secciones
 * 
 * Permite ocultar/mostrar filas de cuentas dentro de cada sección
 * para facilitar la navegación en tablas grandes.
 * 
 * Funcionalidades:
 * - Click en encabezado de sección para colapsar/expandir
 * - Botón "Colapsar todas" para ocultar todas las secciones
 * - Botón "Expandir todas" para mostrar todas las secciones
 * - Persistencia en localStorage de estados colapsados
 * 
 * Uso:
 * SeccionCollapse.inicializar({
 *   tableSelector: '#tablaCuentasBody',
 *   storageKey: 'modulo_secciones_colapsadas'
 * });
 */

const SeccionCollapse = (() => {
  let config = {
    tableSelector: '#tablaCuentasBody',
    storageKey: 'secciones_colapsadas',
    containerSelector: '.controls-container'
  };

  let estadoColapsado = new Set(); // Set de secciones colapsadas
  let botones = {
    colapsarTodas: null,
    expandirTodas: null
  };

  /**
   * Normaliza el texto de una sección para usar como clave
   */
  const normalizarTexto = (texto) => {
    return texto.toString()
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  };

  /**
   * Carga el estado de secciones colapsadas desde localStorage
   */
  const cargarEstado = () => {
    try {
      const guardado = localStorage.getItem(config.storageKey);
      if (guardado) {
        estadoColapsado = new Set(JSON.parse(guardado));
      }
    } catch (e) {
      console.warn('⚠️ Error cargando estado de secciones:', e);
      estadoColapsado = new Set();
    }
  };

  /**
   * Guarda el estado actual en localStorage
   */
  const guardarEstado = () => {
    try {
      localStorage.setItem(
        config.storageKey,
        JSON.stringify(Array.from(estadoColapsado))
      );
    } catch (e) {
      console.warn('⚠️ Error guardando estado de secciones:', e);
    }
  };

  /**
   * Obtiene todas las filas de encabezado de sección
   */
  const obtenerEncabezados = () => {
    const tabla = document.querySelector(config.tableSelector);
    if (!tabla) return [];
    return Array.from(tabla.querySelectorAll('tr.section-header-row'));
  };

  /**
   * Obtiene todas las filas asociadas a una sección
   * (solo filas de cuenta, excluyendo filas de operaciones)
   */
  const obtenerFilasSeccion = (headerRow) => {
    const filas = [];
    let siguiente = headerRow.nextElementSibling;
    
    while (siguiente && 
           !siguiente.classList.contains('section-header-row') &&
           !siguiente.classList.contains('result-row') &&
           !siguiente.classList.contains('sum-row-sumavarios')) {
      
      // Solo incluir filas de cuenta (excluir sum-row, result-row, net-row, etc.)
      // Las filas de operaciones deben permanecer visibles aunque la sección esté colapsada
      if (siguiente.classList.contains('fila-cuenta') && 
          !siguiente.classList.contains('sum-row') &&
          !siguiente.classList.contains('result-row') &&
          !siguiente.classList.contains('net-row') &&
          !siguiente.classList.contains('sum-row-operativo') &&
          !siguiente.classList.contains('result-net-row')) {
        filas.push(siguiente);
      }
      siguiente = siguiente.nextElementSibling;
    }
    
    return filas;
  };

  /**
   * Colapsa una sección específica
   */
  const colapsarSeccion = (headerRow, guardar = true) => {
    const textoSeccion = headerRow.textContent.trim();
    const clave = normalizarTexto(textoSeccion);
    
    const filas = obtenerFilasSeccion(headerRow);
    filas.forEach(fila => {
      fila.style.display = 'none';
    });
    
    // Actualizar icono
    const icono = headerRow.querySelector('.bi');
    if (icono) {
      icono.classList.remove('bi-chevron-down');
      icono.classList.add('bi-chevron-right');
    }
    
    headerRow.classList.add('section-collapsed');
    estadoColapsado.add(clave);
    
    if (guardar) guardarEstado();
  };

  /**
   * Expande una sección específica
   */
  const expandirSeccion = (headerRow, guardar = true) => {
    const textoSeccion = headerRow.textContent.trim();
    const clave = normalizarTexto(textoSeccion);
    
    const filas = obtenerFilasSeccion(headerRow);
    filas.forEach(fila => {
      fila.style.display = '';
    });
    
    // Actualizar icono
    const icono = headerRow.querySelector('.bi');
    if (icono) {
      icono.classList.remove('bi-chevron-right');
      icono.classList.add('bi-chevron-down');
    }
    
    headerRow.classList.remove('section-collapsed');
    estadoColapsado.delete(clave);
    
    if (guardar) guardarEstado();
  };

  /**
   * Toggle (cambiar) estado de colapso de una sección
   */
  const toggleSeccion = (headerRow) => {
    if (headerRow.classList.contains('section-collapsed')) {
      expandirSeccion(headerRow);
    } else {
      colapsarSeccion(headerRow);
    }
  };

  /**
   * Colapsa todas las secciones
   */
  const colapsarTodas = () => {
    const encabezados = obtenerEncabezados();
    encabezados.forEach(header => colapsarSeccion(header, false));
    guardarEstado();
    console.log('✅ Todas las secciones colapsadas');
  };

  /**
   * Expande todas las secciones
   */
  const expandirTodas = () => {
    const encabezados = obtenerEncabezados();
    encabezados.forEach(header => expandirSeccion(header, false));
    guardarEstado();
    console.log('✅ Todas las secciones expandidas');
  };

  /**
   * Agrega icono de colapso a un encabezado de sección
   */
  const agregarIcono = (headerRow) => {
    // Evitar agregar icono duplicado
    if (headerRow.querySelector('.bi')) return;
    
    const celda = headerRow.querySelector('td');
    if (!celda) return;
    
    // Crear icono
    const icono = document.createElement('i');
    icono.className = 'bi bi-chevron-down me-2';
    icono.style.fontSize = '0.9em';
    icono.style.cursor = 'pointer';
    
    // Insertar al inicio del texto
    celda.insertBefore(icono, celda.firstChild);
    
    // Hacer el encabezado clickeable
    celda.style.cursor = 'pointer';
    celda.style.userSelect = 'none';
  };

  /**
   * Aplica listeners de click a encabezados de sección
   */
  const aplicarListeners = () => {
    const encabezados = obtenerEncabezados();
    
    encabezados.forEach(header => {
      // Agregar icono si no existe
      agregarIcono(header);
      
      // Remover listeners anteriores clonando
      const celda = header.querySelector('td');
      if (!celda) return;
      
      const celdaClonada = celda.cloneNode(true);
      celda.parentNode.replaceChild(celdaClonada, celda);
      
      // Agregar nuevo listener
      celdaClonada.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSeccion(header);
      });
    });
  };

  /**
   * Restaura el estado guardado de secciones colapsadas
   */
  const restaurarEstado = () => {
    cargarEstado();
    
    const encabezados = obtenerEncabezados();
    encabezados.forEach(header => {
      const textoSeccion = header.textContent.trim();
      const clave = normalizarTexto(textoSeccion);
      
      if (estadoColapsado.has(clave)) {
        colapsarSeccion(header, false);
      }
    });
  };

  /**
   * Crea botones de control (Colapsar/Expandir todas)
   */
  const crearBotones = () => {
    const contenedor = document.querySelector(config.containerSelector);
    if (!contenedor) {
      console.warn('⚠️ No se encontró contenedor para botones de colapso');
      return;
    }

    // Verificar si ya existen
    if (contenedor.querySelector('.btn-collapse-all')) return;

    // Crear grupo de botones
    const grupoColapso = document.createElement('div');
    grupoColapso.className = 'btn-group btn-group-sm ms-2';
    grupoColapso.setAttribute('role', 'group');
    grupoColapso.style.display = 'inline-flex';

    // Botón colapsar todas
    const btnCollapsar = document.createElement('button');
    btnCollapsar.type = 'button';
    btnCollapsar.className = 'btn btn-outline-secondary btn-collapse-all';
    btnCollapsar.innerHTML = '<i class="bi bi-chevron-bar-contract"></i> Colapsar';
    btnCollapsar.title = 'Colapsar todas las secciones';
    btnCollapsar.addEventListener('click', colapsarTodas);

    // Botón expandir todas
    const btnExpandir = document.createElement('button');
    btnExpandir.type = 'button';
    btnExpandir.className = 'btn btn-outline-secondary btn-expand-all';
    btnExpandir.innerHTML = '<i class="bi bi-chevron-bar-expand"></i> Expandir';
    btnExpandir.title = 'Expandir todas las secciones';
    btnExpandir.addEventListener('click', expandirTodas);

    grupoColapso.appendChild(btnCollapsar);
    grupoColapso.appendChild(btnExpandir);
    
    // Insertar después del último elemento del contenedor
    contenedor.appendChild(grupoColapso);

    botones.colapsarTodas = btnCollapsar;
    botones.expandirTodas = btnExpandir;

    console.log('✅ Botones de colapso agregados');
  };

  /**
   * Inicializa el componente
   * @param {Object} options - Opciones de configuración
   * @param {string} options.tableSelector - Selector de la tabla
   * @param {string} options.storageKey - Clave para localStorage
   * @param {string} options.containerSelector - Selector del contenedor de botones
   */
  const inicializar = (options = {}) => {
    // Combinar configuración
    config = { ...config, ...options };

    console.log('🔄 Inicializando SeccionCollapse...', config);

    // Crear botones de control
    crearBotones();

    // Aplicar listeners a encabezados
    aplicarListeners();

    // Restaurar estado guardado
    restaurarEstado();

    console.log('✅ SeccionCollapse inicializado');
  };

  /**
   * Re-inicializa después de cambios en la tabla
   * (usar después de insertar/eliminar secciones)
   */
  const actualizar = () => {
    aplicarListeners();
    restaurarEstado();
  };

  /**
   * Limpia listeners y estado
   */
  const limpiar = () => {
    estadoColapsado.clear();
    
    if (botones.colapsarTodas) botones.colapsarTodas.remove();
    if (botones.expandirTodas) botones.expandirTodas.remove();
    
    botones = {
      colapsarTodas: null,
      expandirTodas: null
    };

    console.log('✅ SeccionCollapse limpiado');
  };

  // API pública
  return {
    inicializar,
    actualizar,
    limpiar,
    colapsarSeccion,
    expandirSeccion,
    toggleSeccion,
    colapsarTodas,
    expandirTodas
  };
})();

// Exponer globalmente
window.SeccionCollapse = SeccionCollapse;
