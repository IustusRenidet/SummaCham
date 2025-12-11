(() => {
  const API_BASE = (() => {
    if (window.location.protocol === 'file:') return 'http://localhost:3005/api';
    return `${window.location.origin.replace(/\/$/, '')}/api`;
  })();
  const EVENTO_TABLA_ACTUALIZADA = 'modulo-planeacion:tabla-actualizada';
  const EVENTO_CONTEXTO = 'planeacion:contexto-actualizado';
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  const normalizarTexto = (valor) => {
    if (valor == null) return '';
    return valor
      .toString()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase();
  };

  const normalizarSheetId = (texto) => normalizarTexto(texto).replace(/[\s._]+/g, '');
  const normalizarModuloClave = (valor) => normalizarTexto(valor || '').replace(/[^A-Z0-9]/g, '').toLowerCase();

  const obtenerTabla = (selector) => {
    if (selector) {
      const desdeSelector = document.querySelector(selector);
      if (desdeSelector) return desdeSelector;
    }
    return document.querySelector('#tablaComparacion');
  };

  const contarColumnas = (tabla) => {
    if (!tabla || !tabla.tHead) return 2;
    const filas = Array.from(tabla.tHead.rows || []);
    if (!filas.length) {
      return tabla.tHead.querySelectorAll('th').length || 2;
    }
    const ultima = filas[filas.length - 1];
    return (ultima && ultima.cells.length) || filas[0].cells.length || 2;
  };

  /**
   * Crea una fila de estado para mostrar mensajes informativos en la tabla
   * 
   * Se usa cuando la tabla está vacía o hay algún error, por ejemplo:
   * - "El capitulo seleccionado no tiene esta vista asignada."
   * - "No hay informacion disponible para esta vista."
   * - "El capitulo no tiene cuentas configuradas en el libro."
   * 
   * La fila ocupa todo el ancho de la tabla con una sola celda.
   * 
   * @param {string} mensaje - Mensaje a mostrar al usuario
   * @param {number} colspan - Número de columnas que debe abarcar la celda
   * @returns {HTMLTableRowElement} Fila HTML con el mensaje
   */
  const crearFilaEstado = (mensaje, colspan) => {
    const fila = document.createElement('tr');
    fila.className = 'estado-tabla';
    const celda = document.createElement('td');
    celda.colSpan = colspan;
    celda.textContent = mensaje;
    fila.appendChild(celda);
    return fila;
  };

  const limpiarBody = (tbody) => {
    while (tbody.firstChild) {
      tbody.removeChild(tbody.firstChild);
    }
  };

  const obtenerConfigModulo = () => {
    const dataset = document.body?.dataset || {};
    const moduloId = dataset.moduloId || dataset.modulo || '';
    const moduloSheet = dataset.moduloSheet || '';
    return { moduloId, moduloSheet };
  };

  const MODULOS_SOPORTADOS = new Set([
    'comites',
    'comunicacion',
    'direccion',
    'eventos',
    'finanzas',
    'gtoscorporativos',
    'membresia',
    'rh',
    'servmembresia',
    'tic',
    'presupuestos',
    'vpe'
  ]);

  const MODULOS_LAYOUT_EDITABLE = new Set([
    'presupuestos',
    'presupuestoshtml',
    'vpe',
    'servmembresia',
    'serviciosalamembresia',
    'membresia',
    'comunicacion',
    'gtoscorporativos',
    'tic',
    'comites',
    'finanzas',
    'rh',
    'recursoshumanos',
    'eventos'
  ]);

  const esModuloEditable = (moduloClave) => MODULOS_LAYOUT_EDITABLE.has(normalizarModuloClave(moduloClave || ''));

  const obtenerClaveLayoutLocal = ({ moduloClave, empresaId, anio }) => {
    if (!moduloClave || !empresaId || !Number.isInteger(anio)) {
      return null;
    }
    return `planeacion-layout:${empresaId}:${anio}:${moduloClave}`;
  };

  const cargarLayoutLocal = ({ moduloClave, empresaId, anio }) => {
    const clave = obtenerClaveLayoutLocal({ moduloClave, empresaId, anio });
    if (!clave || !window.localStorage) {
      return null;
    }
    try {
      const crudo = window.localStorage.getItem(clave);
      return crudo ? JSON.parse(crudo) : null;
    } catch (error) {
      console.warn('No fue posible leer el layout local', error);
      return null;
    }
  };

  const guardarLayoutLocal = ({ layout, moduloClave, empresaId, anio }) => {
    const clave = obtenerClaveLayoutLocal({ moduloClave, empresaId, anio });
    if (!clave || !window.localStorage || !layout) {
      return false;
    }
    try {
      window.localStorage.setItem(clave, JSON.stringify(layout));
      return true;
    } catch (error) {
      console.warn('No fue posible guardar el layout local', error);
      return false;
    }
  };

  const estadoModulo = {
    moduloId: '',
    moduloClave: '',
    sheet: '',
    columnas: {},
    tabla: null,
    ultimaSolicitud: 0,
    anio: null,
    tooltips: [],
    editMode: false,
    editSnapshot: null,
    hayCambios: false,
    sumas: {
      secciones: [],
      sumavariosRows: new Map(),
      resultRows: new Map()
    },
    valoresPorCuenta: new Map(),
    nombresPorCuenta: new Map(),
    capitulo: '',
    placeholdersPorFila: 0,
    layoutActual: null,
    layoutSnapshot: null,
    layoutEsPersonalizado: false,
    cuentasDisponibles: [],
    cuentasDisponiblesPorAnio: new Map(),
    catalogoPromesas: new Map(),
    catalogoFallido: new Set(),
    sugerencias: {
      contenedor: null
    }
  };
  let moduloReadyDispatched = false;
  let panelPrincipales = null;

  const MODAL_SECCION_ID = 'sectionModal';
  const crearModalSeccion = () => {
    const modalWrapper = document.createElement('div');
    modalWrapper.id = MODAL_SECCION_ID;
    modalWrapper.className = 'section-modal';
    modalWrapper.hidden = true;
    modalWrapper.innerHTML = `
      <div class="section-modal__overlay"></div>
      <div class="section-modal__dialog">
        <h5>Agregar sección</h5>
        <form class="section-modal__form">
          <label class="section-modal__label" for="sectionTitleInput">Título de sección</label>
          <input id="sectionTitleInput" class="form-control section-modal__input" maxlength="80" required />

          <label class="section-modal__label" for="sectionSumLabelInput">Etiqueta para sum row</label>
          <input id="sectionSumLabelInput" class="form-control section-modal__input" maxlength="80" required />

          <label class="section-modal__label" for="sectionPrincipalSelect">Principal / sumatoria</label>
          <select id="sectionPrincipalSelect" class="form-select section-modal__input"></select>
          <input id="sectionPrincipalCustom" class="form-control section-modal__input" maxlength="120" placeholder="Nombre del principal" hidden />
          <label class="section-modal__label" for="sectionPrincipalFactor">Factor de operación</label>
          <input id="sectionPrincipalFactor" type="number" step="0.01" value="1" class="form-control section-modal__input" />
          <div class="form-text">Usa 1 para sumar, -1 para restar, 0.5 para dividir u otro factor personalizado.</div>
          <div id="sectionPrincipalInfo" class="section-modal__info"></div>

          <div id="sectionAccountsContainer" class="section-account-list"></div>
          <button type="button" id="sectionAddAccountBtn" class="btn btn-chip btn-chip-outline w-100 mb-3">
            <i class="bi bi-plus"></i>
            Agregar cuenta
          </button>

          <div class="form-check">
            <input class="form-check-input" type="checkbox" id="sectionGroupToggle">
            <label class="form-check-label" for="sectionGroupToggle">
              Crear sum row varios (secciones contiguas)
            </label>
          </div>
          <div id="sectionGroupFields" class="section-modal__group" hidden>
            <label class="section-modal__label" for="sectionGroupStart">Sección inicial</label>
            <select id="sectionGroupStart" class="form-select section-modal__input"></select>
            <label class="section-modal__label" for="sectionGroupEnd">Sección final</label>
            <select id="sectionGroupEnd" class="form-select section-modal__input"></select>
            <label class="section-modal__label" for="sectionGroupLabel">Etiqueta sum row varios</label>
            <input id="sectionGroupLabel" class="form-control section-modal__input" maxlength="80" />
          </div>

          <div class="section-modal__actions">
            <button type="submit" class="btn btn-primario">Crear sección</button>
            <button type="button" id="sectionModalCancel" class="btn btn-chip btn-chip-outline">Cancelar</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modalWrapper);
    return modalWrapper;
  };

  const asegurarEstilosModal = () => {
    if (document.getElementById('sectionModalStyles')) return;
    const style = document.createElement('style');
    style.id = 'sectionModalStyles';
    style.textContent = `
      .section-modal {
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1999;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.2s ease;
      }
      .section-modal:not([hidden]) {
        pointer-events: auto;
        opacity: 1;
      }
      .section-modal[hidden] {
        display: none !important;
        pointer-events: none !important;
      }
      .section-modal__overlay {
        position: absolute;
        inset: 0;
        background: rgba(0,0,0,0.35);
        pointer-events: auto;
      }
      .section-modal__dialog {
        position: relative;
        background: #fff;
        border-radius: 16px;
        padding: 24px;
        max-width: 420px;
        width: min(90vw, 420px);
        box-shadow: 0 18px 40px rgba(0,0,0,0.15);
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-height: 90vh;
        overflow-y: auto;
        z-index: 2000;
        pointer-events: auto;
      }
      .section-modal__form {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .section-modal__label {
        font-size: 0.85rem;
        font-weight: 600;
      }
      .section-account-row {
        display: grid;
        grid-template-columns: 1fr 1fr auto;
        gap: 8px;
      }
      .section-account-row .form-control {
        margin-bottom: 0;
      }
      .section-account-row button {
        align-self: center;
        background: transparent;
        border: none;
        color: #c74b3a;
        font-weight: 700;
        cursor: pointer;
      }
      .section-modal__group {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .section-modal__actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
        flex-wrap: wrap;
      }
      .section-modal__info {
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        padding: 12px;
        background: #f9fafb;
        max-height: 180px;
        overflow-y: auto;
        font-size: 0.8rem;
      }
      .section-modal__info h6 {
        font-size: 0.72rem;
        text-transform: uppercase;
        margin-bottom: 4px;
        letter-spacing: 0.05em;
      }
      .section-modal__info ul {
        padding-left: 16px;
        margin-bottom: 8px;
      }
      .section-modal__info li {
        margin-bottom: 2px;
      }
      .section-modal__dialog input,
      .section-modal__dialog button,
      .section-modal__dialog select,
      .section-modal__dialog textarea,
      .section-modal__dialog a {
        pointer-events: auto !important;
      }
    `;
    document.head.appendChild(style);
  };

  let sectionModalInstance = null;
  let pendingSectionReferencia = null;

  const crearCampoCuentaFormulario = () => {
    const fila = document.createElement('div');
    fila.className = 'section-account-row';
    fila.innerHTML = `
      <input type="text" class="form-control section-account-input" placeholder="Cuenta" maxlength="25" />
      <input type="text" class="form-control section-account-input" placeholder="Descripción" maxlength="120" />
      <button type="button" aria-label="Eliminar cuenta">&times;</button>
    `;
    fila.querySelector('button').addEventListener('click', () => fila.remove());
    return fila;
  };

  const poblarSelectSeccionesModal = () => {
    if (!sectionModalInstance) return;
    const startSelect = sectionModalInstance.querySelector('#sectionGroupStart');
    const endSelect = sectionModalInstance.querySelector('#sectionGroupEnd');
    if (!startSelect || !endSelect) return;
    startSelect.innerHTML = '';
    endSelect.innerHTML = '';
    const secciones = (estadoModulo.sumas.secciones || []).map((meta, idx) => ({
      idx,
      label: meta?.tituloVisible || meta?.seccion || `Sección ${idx + 1}`
    }));
    const groupToggle = sectionModalInstance.querySelector('#sectionGroupToggle');
    if (!secciones.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Sin secciones disponibles';
      option.disabled = true;
      startSelect.appendChild(option);
      endSelect.appendChild(option.cloneNode(true));
      if (groupToggle) {
        groupToggle.checked = false;
        groupToggle.disabled = true;
        sectionModalInstance.querySelector('#sectionGroupFields').hidden = true;
      }
      return;
    }
    if (groupToggle) {
      groupToggle.disabled = false;
    }
    secciones.forEach(({ idx, label }) => {
      const optionStart = document.createElement('option');
      optionStart.value = String(idx);
      optionStart.textContent = label;
      startSelect.appendChild(optionStart);
      const optionEnd = optionStart.cloneNode(true);
      endSelect.appendChild(optionEnd);
    });
  };

  const obtenerPrincipalesResumen = () => {
    const mapa = new Map();
    (estadoModulo.sumas.secciones || []).forEach((meta) => {
      const label = meta?.sumRowSumavariosLabel || '';
      if (!label) return;
      const clave = normalizarTexto(label);
      if (!mapa.has(clave)) {
        mapa.set(clave, { label, secciones: [] });
      }
      mapa.get(clave).secciones.push({
        nombre: meta.tituloVisible || meta.seccion || 'Sin título',
        factor: Number.isFinite(meta.operacionFactor) ? meta.operacionFactor : 1
      });
    });
    return Array.from(mapa.values());
  };

  const llenarSelectPrincipalesModal = () => {
    const elems = getSectionModalElements();
    if (!elems?.principalSelect) return;
    const select = elems.principalSelect;
    const resumen = obtenerPrincipalesResumen();
    select.innerHTML = '';
    const optionDefault = document.createElement('option');
    optionDefault.value = '';
    optionDefault.textContent = 'Selecciona principal';
    select.appendChild(optionDefault);
    resumen.forEach((item) => {
      const opt = document.createElement('option');
      opt.value = item.label;
      opt.textContent = `${item.label} (${item.secciones.length})`;
      select.appendChild(opt);
    });
    const optNuevo = document.createElement('option');
    optNuevo.value = '__custom__';
    optNuevo.textContent = 'Crear nuevo principal...';
    select.appendChild(optNuevo);
  };

  const renderizarResumenPrincipalesModal = () => {
    const elems = getSectionModalElements();
    if (!elems?.principalInfo) return;
    const resumen = obtenerPrincipalesResumen();
    if (!resumen.length) {
      elems.principalInfo.innerHTML = '<p class="text-muted small mb-0">Aún no hay principales configurados.</p>';
      return;
    }
    const contenido = resumen
      .map((item) => {
        const lista = item.secciones
          .map(
            (sec) =>
              `<li>${sec.nombre} <span class="badge bg-light text-dark ms-1">${sec.factor >= 0 ? '+' : ''}${sec.factor}</span></li>`
          )
          .join('');
        return `<div class="mb-2">
          <h6>${item.label}</h6>
          <ul class="mb-0">${lista}</ul>
        </div>`;
      })
      .join('');
    elems.principalInfo.innerHTML = contenido;
  };

  const abrirModalAgregarSeccion = (referencia) => {
    asegurarModal();
    sectionModalInstance = sectionModalInstance || crearModalSeccion();
    pendingSectionReferencia = referencia || null;
    if (!sectionModalInstance) return;
    const modal = sectionModalInstance;
    const form = modal.querySelector('form');
    const accountsContainer = modal.querySelector('#sectionAccountsContainer');
    const groupToggle = modal.querySelector('#sectionGroupToggle');
    const groupFields = modal.querySelector('#sectionGroupFields');
    const titleInput = modal.querySelector('#sectionTitleInput');
    const sumLabelInput = modal.querySelector('#sectionSumLabelInput');
    const groupLabelInput = modal.querySelector('#sectionGroupLabel');
    if (!form || !accountsContainer || !groupToggle || !groupFields) return;
    titleInput.value = '';
    sumLabelInput.value = '';
    groupToggle.checked = false;
    groupFields.hidden = true;
    groupLabelInput.value = '';
    accountsContainer.innerHTML = '';
    accountsContainer.appendChild(crearCampoCuentaFormulario());
    abrirModalAgregarSeccion.actualizarSecciones = () => poblarSelectSeccionesModal();
    poblarSelectSeccionesModal();
    modal.hidden = false;
    modal.removeAttribute('hidden');
    modal.style.display = 'flex';
    modal.style.pointerEvents = 'auto';
    const overlay = modal.querySelector('.section-modal__overlay');
    if (overlay) {
      overlay.style.pointerEvents = 'auto';
    }
    void modal.offsetHeight;
    const primerInput = modal.querySelector('input, select, textarea');
    if (primerInput) {
      setTimeout(() => primerInput.focus(), 100);
    }
  };

  const cerrarModalSeccion = () => {
    if (!sectionModalInstance) return;
    sectionModalInstance.hidden = true;
    sectionModalInstance.setAttribute('hidden', 'hidden');
    sectionModalInstance.style.display = 'none';
    sectionModalInstance.style.pointerEvents = 'none';
    const overlay = sectionModalInstance.querySelector('.section-modal__overlay');
    if (overlay) {
      overlay.style.pointerEvents = 'none';
    }
    const form = sectionModalInstance.querySelector('form');
    if (form) {
      form.reset();
    }
  };

  const getSectionModalElements = () => {
    if (!sectionModalInstance) return null;
    return {
      form: sectionModalInstance.querySelector('form'),
      titleInput: sectionModalInstance.querySelector('#sectionTitleInput'),
      sumLabelInput: sectionModalInstance.querySelector('#sectionSumLabelInput'),
      accountsContainer: sectionModalInstance.querySelector('#sectionAccountsContainer'),
      addAccountBtn: sectionModalInstance.querySelector('#sectionAddAccountBtn'),
      groupToggle: sectionModalInstance.querySelector('#sectionGroupToggle'),
      groupFields: sectionModalInstance.querySelector('#sectionGroupFields'),
      groupStart: sectionModalInstance.querySelector('#sectionGroupStart'),
      groupEnd: sectionModalInstance.querySelector('#sectionGroupEnd'),
      groupLabel: sectionModalInstance.querySelector('#sectionGroupLabel'),
      cancelBtn: sectionModalInstance.querySelector('#sectionModalCancel'),
      principalSelect: sectionModalInstance.querySelector('#sectionPrincipalSelect'),
      principalCustom: sectionModalInstance.querySelector('#sectionPrincipalCustom'),
      principalFactor: sectionModalInstance.querySelector('#sectionPrincipalFactor'),
      principalInfo: sectionModalInstance.querySelector('#sectionPrincipalInfo')
    };
  };

  const inicializarModalSeccion = () => {
    asegurarEstilosModal();
    sectionModalInstance = sectionModalInstance || crearModalSeccion();
    const elems = getSectionModalElements();
    if (!elems) return;
    elems.groupToggle.addEventListener('change', () => {
      elems.groupFields.hidden = !elems.groupToggle.checked;
    });
    elems.addAccountBtn.addEventListener('click', () => {
      elems.accountsContainer.appendChild(crearCampoCuentaFormulario());
    });
    elems.cancelBtn.addEventListener('click', () => {
      cerrarModalSeccion();
    });
    elems.form.addEventListener('submit', (event) => {
      event.preventDefault();
      const cuentas = Array.from(elems.accountsContainer.querySelectorAll('.section-account-row')).map((row) => {
        const inputs = row.querySelectorAll('input');
        return {
          cuenta: inputs[0]?.value.trim() || '',
          descripcion: inputs[1]?.value.trim() || ''
        };
      }).filter((item) => item.cuenta || item.descripcion);
      if (!cuentas.length) {
        window.alert('Debes agregar al menos una cuenta para la sección.');
        return;
      }
      const titulo = elems.titleInput.value.trim();
      const sumLabel = elems.sumLabelInput.value.trim();
      if (!titulo || !sumLabel) {
        window.alert('El título y la etiqueta del sum row son obligatorios.');
        return;
      }
      let range = null;
      let sumavariosLabel = '';
      if (elems.groupToggle.checked) {
        const start = Number(elems.groupStart.value);
        const end = Number(elems.groupEnd.value);
        sumavariosLabel = elems.groupLabel.value.trim();
        if (Number.isNaN(start) || Number.isNaN(end) || start > end) {
          window.alert('Selecciona un rango válido para las secciones contiguas.');
          return;
        }
        if (!sumavariosLabel) {
          window.alert('Proporciona una etiqueta para el sum row varios.');
          return;
        }
        range = { start, end };
      }
      crearSeccionDesdeFormulario({
        referenciaFila: pendingSectionReferencia,
        titulo,
        sumLabel,
        cuentas,
        sumavariosLabel,
        range
      });
      cerrarModalSeccion();
    });
  };

  const asegurarModal = () => {
    if (sectionModalInstance) return;
    inicializarModalSeccion();
  };

  const obtenerYearSelect = () => {
    return document.querySelector('[data-role="module-year-select"]') || document.querySelector('select[id$="YearSelect"]');
  };

  const obtenerAnioSeleccionado = () => {
    const select = obtenerYearSelect();
    if (select) {
      const crudo = (select.value || '').trim();
      if (crudo) {
        const valor = Number(crudo);
        if (Number.isInteger(valor)) {
          estadoModulo.anio = valor;
          return valor;
        }
      }
    }
    if (Number.isInteger(estadoModulo.anio)) {
      return estadoModulo.anio;
    }
    return null;
  };

  const construirMapaColumnas = (tabla) => {
    if (!tabla?.tHead) {
      return {};
    }
    const mapa = {};
    const cabeceras = Array.from(tabla.tHead.querySelectorAll('th'));
    cabeceras.forEach((th, indice) => {
      if (th.classList.contains('budget-annual-column')) {
        mapa['budget-annual'] = indice;
      } else if (th.classList.contains('budget-monthly-column')) {
        mapa['budget-monthly'] = indice;
      }
      if (th.classList.contains('month-budget')) {
        const clave = th.dataset.mes || '';
        mapa[`budget-${clave}`] = indice;
      } else if (th.classList.contains('month-real')) {
        const clave = th.dataset.mes || '';
        mapa[`real-${clave}`] = indice;
      } else if (th.classList.contains('year-column')) {
        mapa.year = indice;
      } else if (th.classList.contains('total-budget-column')) {
        mapa['total-budget'] = indice;
      } else if (th.classList.contains('total-real-column')) {
        mapa['total-real'] = indice;
      }
    });
    return mapa;
  };

  const invertirColumnas = () => {
    const reverse = {};
    Object.entries(estadoModulo.columnas || {}).forEach(([clave, idx]) => {
      reverse[idx] = clave;
    });
    return reverse;
  };

  const esClaveBudget = (clave) => clave && clave.startsWith('budget-');

  const parsearNumero = (texto) => {
    const limpio = (texto || '').toString().replace(/[^0-9+.,-]/g, '').replace(',', '.');
    const numero = Number(limpio);
    return Number.isFinite(numero) ? numero : 0;
  };

  const formatearNumero = (valor) => {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return '0.00';
    const fijo = numero.toFixed(2);
    const [entero, decimales] = fijo.split('.');
    const enteroConComas = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${enteroConComas}.${decimales}`;
  };

  const obtenerFilasCuenta = () => {
    if (!estadoModulo.tabla) {
      return [];
    }
    return Array.from(estadoModulo.tabla.querySelectorAll('tbody tr.fila-cuenta'));
  };

  const actualizarNombreFila = (fila, nombre) => {
    if (!fila || fila.cells.length < 2) return;
    if (!nombre) return;
    fila.cells[1].textContent = nombre;
  };

  /**
   * Recalcula los totales de una fila de presupuesto
   * 
   * Esta función suma horizontalmente los valores de presupuesto y real
   * de todos los meses para calcular los acumulados de una cuenta específica.
   * 
   * Cálculos que realiza:
   * - Total Presupuesto: Suma de budget-ene hasta budget-[mesActual]
   * - Total Real: Suma de real-ene hasta real-[mesActual]
   * - Presupuesto Anual: Valor del mes actual (budget-monthly)
   * - Mensual: Valor real del mes actual (budget-annual)
   * 
   * @param {HTMLTableRowElement} fila - Fila de la tabla a recalcular
   */
  const recalcularTotalesFilaPresupuesto = (fila) => {
    if (!fila) return;
    const cuenta = fila.dataset.cuenta21 || '';
    const almacen = estadoModulo.valoresPorCuenta.get(cuenta) || {};
    
    // Obtener el mes actual (0-11, donde 0=enero, 11=diciembre)
    const mesActualIndex = estadoModulo.mesActualIndex ?? new Date().getMonth();
    const mesActualClave = MESES[mesActualIndex] || 'dic';
    
    let totalPresupuestoAcumulado = 0;
    let totalRealAcumulado = 0;
    
    // Sumar todos los meses desde enero hasta el mes actual
    MESES.forEach((mes, index) => {
      // Acumular solo hasta el mes actual
      if (index <= mesActualIndex) {
        totalPresupuestoAcumulado += Number(almacen[`budget-${mes}`]) || 0;
        totalRealAcumulado += Number(almacen[`real-${mes}`]) || 0;
      }
    });
    
    // Obtener valores del mes actual específicamente
    const presupuestoMesActual = Number(almacen[`budget-${mesActualClave}`]) || 0;
    const realMesActual = Number(almacen[`real-${mesActualClave}`]) || 0;
    
    // Actualizar celda de total-budget: acumulado desde enero hasta mes actual
    if (estadoModulo.columnas['total-budget'] != null) {
      const celdaTotal = fila.cells[estadoModulo.columnas['total-budget']];
      if (celdaTotal) {
        celdaTotal.textContent = formatearNumero(totalPresupuestoAcumulado);
      }
    }
    
    // Actualizar celda budget-annual: presupuesto del mes actual
    if (estadoModulo.columnas['budget-annual'] != null) {
      const celdaAnnual = fila.cells[estadoModulo.columnas['budget-annual']];
      if (celdaAnnual) {
        celdaAnnual.textContent = formatearNumero(presupuestoMesActual);
      }
    }
    
    // Actualizar celda budget-monthly: real del mes actual
    if (estadoModulo.columnas['budget-monthly'] != null) {
      const celdaMensual = fila.cells[estadoModulo.columnas['budget-monthly']];
      if (celdaMensual) {
        celdaMensual.textContent = formatearNumero(realMesActual);
      }
    }
    
    // Actualizar celda total-real: acumulado desde enero hasta mes actual
    if (estadoModulo.columnas['total-real'] != null) {
      const celdaRealTotal = fila.cells[estadoModulo.columnas['total-real']];
      if (celdaRealTotal) {
        celdaRealTotal.textContent = formatearNumero(totalRealAcumulado);
      }
    }
    
    almacen['total-budget'] = totalPresupuestoAcumulado;
    almacen['budget-annual'] = presupuestoMesActual;
    almacen['budget-monthly'] = realMesActual;
    almacen['total-real'] = totalRealAcumulado;
    estadoModulo.valoresPorCuenta.set(cuenta, almacen);
  };

  const establecerValorCelda = (fila, clave, valor) => {
    const indice = estadoModulo.columnas[clave];
    if (indice == null) {
      return;
    }
    const celda = fila.cells[indice];
    if (!celda) {
      return;
    }
    celda.textContent = formatearNumero(valor);
  };

  const limpiarValores = () => {
    estadoModulo.valoresPorCuenta = new Map();
    obtenerFilasCuenta().forEach((fila) => {
      MESES.forEach((mes) => {
        establecerValorCelda(fila, `budget-${mes}`, 0);
        establecerValorCelda(fila, `real-${mes}`, 0);
      });
      establecerValorCelda(fila, 'total-budget', 0);
      establecerValorCelda(fila, 'total-real', 0);
      establecerValorCelda(fila, 'budget-annual', 0);
      establecerValorCelda(fila, 'budget-monthly', 0);
    });
    recalcularSumas();
    estadoModulo.hayCambios = false;
    estadoModulo.editSnapshot = null;
  };

  const contarSaldos = (registros = []) => {
    const mapa = new Map(registros.map((registro) => [registro.cuenta, registro]));
    estadoModulo.valoresPorCuenta = new Map();
    const numeroSeguro = (valor) => {
      const n = Number(valor);
      return Number.isFinite(n) ? n : 0;
    };
    // Obtener mes actual (0-11, donde 0=enero, 11=diciembre)
    const mesActualIndex = new Date().getMonth();
    const mesActualClave = MESES[mesActualIndex] || 'dic'; // ene, feb, mar, etc.
    
    obtenerFilasCuenta().forEach((fila) => {
      const cuenta = fila.dataset.cuenta21 || '';
      const registro = mapa.get(cuenta);
      let totalPresupuestoAcumulado = 0;
      let totalRealAcumulado = 0;
      const almacen = {};
      
      MESES.forEach((mes, index) => {
        const presupuesto = numeroSeguro(registro?.presupuesto?.[mes]);
        const real = numeroSeguro(registro?.real?.[mes]);
        
        // Acumular solo hasta el mes actual
        if (index <= mesActualIndex) {
          totalPresupuestoAcumulado += presupuesto;
          totalRealAcumulado += real;
        }
        
        establecerValorCelda(fila, `budget-${mes}`, presupuesto);
        establecerValorCelda(fila, `real-${mes}`, real);
        almacen[`budget-${mes}`] = presupuesto;
        almacen[`real-${mes}`] = real;
      });
      
      // Presupuesto del mes actual (para Gastos Corporativos: "Presupuesto YYYY")
      const presupuestoMesActual = numeroSeguro(registro?.presupuesto?.[mesActualClave]);
      // Real del mes actual (para Gastos Corporativos: "Mensual")
      const realMesActual = numeroSeguro(registro?.real?.[mesActualClave]);
      
      // total-budget y total-real: acumulados desde enero hasta mes actual
      establecerValorCelda(fila, 'total-budget', totalPresupuestoAcumulado);
      establecerValorCelda(fila, 'total-real', totalRealAcumulado);
      // budget-annual: presupuesto del mes actual (Gastos Corporativos)
      establecerValorCelda(fila, 'budget-annual', presupuestoMesActual);
      // budget-monthly: real del mes actual (Gastos Corporativos)
      establecerValorCelda(fila, 'budget-monthly', realMesActual);
      
      almacen['total-budget'] = totalPresupuestoAcumulado;
      almacen['budget-annual'] = presupuestoMesActual;
      almacen['budget-monthly'] = realMesActual;
      almacen['total-real'] = totalRealAcumulado;
      estadoModulo.valoresPorCuenta.set(cuenta, almacen);
    });
    estadoModulo.mesActual = mesActualClave;
    estadoModulo.mesActualIndex = mesActualIndex;
    recalcularSumas();
    estadoModulo.hayCambios = false;
    estadoModulo.editSnapshot = null;
  };

  const obtenerCuentasSolicitadas = () => {
    const filas = obtenerFilasCuenta();
    const conjunto = new Set();
    filas.forEach((fila) => {
      const cuenta = (fila.dataset.cuenta21 || '').trim();
      if (cuenta) {
        conjunto.add(cuenta);
      }
    });
    return Array.from(conjunto);
  };

  const clonarMapaValores = (mapa) =>
    new Map(Array.from(mapa.entries()).map(([clave, valores]) => [clave, { ...(valores || {}) }]));

  const tomarSnapshotEdicion = () => ({
    valores: clonarMapaValores(estadoModulo.valoresPorCuenta),
    nombres: new Map(estadoModulo.nombresPorCuenta)
  });

  const restablecerDesdeSnapshot = (snap) => {
    if (!snap) return;
    estadoModulo.valoresPorCuenta = clonarMapaValores(snap.valores || new Map());
    estadoModulo.nombresPorCuenta = new Map(snap.nombres || []);
    obtenerFilasCuenta().forEach((fila) => {
      const cuenta = fila.dataset.cuenta21 || '';
      const nombre = estadoModulo.nombresPorCuenta.get(cuenta) || '';
      if (nombre) {
        actualizarNombreFila(fila, nombre);
      }
      const valores = estadoModulo.valoresPorCuenta.get(cuenta) || {};
      MESES.forEach((mes) => {
        establecerValorCelda(fila, `budget-${mes}`, valores[`budget-${mes}`] ?? 0);
        establecerValorCelda(fila, `real-${mes}`, valores[`real-${mes}`] ?? 0);
      });
      establecerValorCelda(fila, 'total-budget', valores['total-budget'] ?? 0);
      establecerValorCelda(fila, 'total-real', valores['total-real'] ?? 0);
      establecerValorCelda(fila, 'budget-annual', valores['budget-annual'] ?? 0);
      establecerValorCelda(fila, 'budget-monthly', valores['budget-monthly'] ?? 0);
    });
    recalcularSumas();
  };

  const obtenerCambiosPendientes = () => {
    if (!estadoModulo.editSnapshot) {
      return { presupuesto: [], nombres: [] };
    }
    const cambiosPresupuesto = [];
    const baseValores = estadoModulo.editSnapshot.valores || new Map();

    estadoModulo.valoresPorCuenta.forEach((valores, cuenta) => {
      const prev = baseValores.get(cuenta) || {};
      const diff = {};
      MESES.forEach((mes) => {
        const clave = `budget-${mes}`;
        const actual = Number(valores?.[clave]) || 0;
        const anterior = Number(prev?.[clave]) || 0;
        if (actual !== anterior) {
          diff[clave] = actual;
        }
      });
      if (Object.keys(diff).length) {
        cambiosPresupuesto.push({ cuenta, valores: diff });
      }
    });

    // NO enviar cambios de nombres - son solo visuales
    return { presupuesto: cambiosPresupuesto, nombres: [] };
  };

  const notificarCambios = () => {
    const cambios = obtenerCambiosPendientes();
    let guardadoLocal = false;
    if (estadoModulo.editMode && estadoModulo.hayCambios) {
      guardadoLocal = persistirLayoutActual();
    }
    const detalle = {
      ...cambios,
      hayCambios: estadoModulo.hayCambios,
      borradorGuardado: Boolean(guardadoLocal)
    };
    window.dispatchEvent(new CustomEvent('modulo-planeacion:presupuesto-editado', { detail: detalle }));
  };

  const indicesMesReal = () =>
    Object.entries(estadoModulo.columnas || {})
      .filter(([clave]) => clave.startsWith('real-'))
      .map(([, idx]) => idx);

  const ocultarColumnasReal = (ocultar) => {
    if (!estadoModulo.tabla) return;
    const indices = indicesMesReal();
    if (!indices.length) return;
    const filas = Array.from(estadoModulo.tabla.querySelectorAll('tr'));
    filas.forEach((fila) => {
      indices.forEach((idx) => {
        const celda = fila.cells[idx];
        if (celda) {
          celda.style.display = ocultar ? 'none' : '';
        }
      });
    });
  };

  const aplicarNombresTabla = (mapaNombres = new Map()) => {
    if (!mapaNombres.size) return;
    obtenerFilasCuenta().forEach((fila) => {
      const cuenta = fila.dataset.cuenta21 || '';
      const nombre = mapaNombres.get(cuenta);
      if (nombre) {
        actualizarNombreFila(fila, nombre);
      }
    });
  };

  const cargarNombresCuentas = async ({ empresaId, anio, cuentas } = {}) => {
    const lista = Array.isArray(cuentas) ? Array.from(new Set(cuentas)) : [];
    if (!empresaId || !Number.isInteger(anio) || !lista.length) return new Map();
    try {
      const params = new URLSearchParams({ empresaId, anio, cuentas: lista.join(',') });
      const resp = await fetch(`${API_BASE}/saldos/cuentas?${params.toString()}`, {
        headers: Sesion.headersAutenticacion()
      });
      const datos = await resp.json();
      if (!resp.ok) throw new Error(datos.mensaje || 'No fue posible obtener nombres.');
      const mapa = new Map();
      (datos.cuentas || []).forEach((registro) => {
        const clave = convertirCuenta21(registro.cuenta || registro.numCta || registro.NUM_CTA || '');
        const nombre = (registro.nombre || registro.nombreCuenta || registro.NOMBRE || '').trim();
        if (clave && nombre) {
          mapa.set(clave, nombre);
          estadoModulo.nombresPorCuenta.set(clave, nombre);
        }
      });
      aplicarNombresTabla(mapa);
      return mapa;
    } catch (error) {
      console.warn('No fue posible cargar nombres de cuentas', error);
      return new Map();
    }
  };

  const cargarCuentasPresupuestos = async ({ anio } = {}) => {
    const params = new URLSearchParams({ anio: Number.isInteger(anio) ? anio : new Date().getFullYear() });
    const normalizarNumero = (valor) => {
      const numerico = Number(valor);
      return Number.isFinite(numerico) ? numerico : 0;
    };
    const esAcreedora = (naturaleza) => ['A', 'C'].includes((naturaleza || '').toString().trim().toUpperCase());

    try {
      const resp = await fetch(`${API_BASE}/presupuestos?${params.toString()}`, {
        headers: Sesion.headersAutenticacion()
      });
      const datos = await resp.json();
      if (!resp.ok) {
        throw new Error(datos.mensaje || 'No fue posible obtener las cuentas de presupuestos.');
      }
      const cuentas = Array.isArray(datos.cuentas) ? datos.cuentas : [];
      return cuentas
        .map((cuenta) => {
          const naturaleza = (cuenta.naturaleza || cuenta.NATURALEZA || '').toString().trim().toUpperCase();
          const cuentaVisible = cuenta.numCta || cuenta.num_cta || cuenta.CUENTA || cuenta.cuenta || '';
          const cuenta21 = convertirCuenta21(cuentaVisible);
          if (!cuenta21) return null;
          const presupuesto = {};
          const real = {};
          MESES.forEach((mes, idxMes) => {
            const sufijoMes = String(idxMes + 1).padStart(2, '0');
            const presupuestoCampo =
              cuenta[`PRESUP${sufijoMes}`] ??
              cuenta[`presup${sufijoMes}`] ??
              (cuenta.presupuesto && cuenta.presupuesto[mes] != null ? cuenta.presupuesto[mes] : undefined) ??
              cuenta[`presupuesto_${mes}`] ??
              cuenta[`presupuesto${mes}`] ??
              cuenta[mes];
            const realCampo =
              (cuenta.contabilizacion && cuenta.contabilizacion[mes] != null ? cuenta.contabilizacion[mes] : undefined) ??
              cuenta[`contabilizacion_${mes}`] ??
              cuenta[`contabilizacion${mes}`] ??
              (cuenta.real && cuenta.real[mes] != null ? cuenta.real[mes] : undefined) ??
              cuenta[`real_${mes}`] ??
              cuenta[`real${mes}`] ??
              cuenta[`REAL_${mes}`] ??
              cuenta[`REAL${mes}`];
            // Presupuesto: usar el valor tal cual viene de la tabla PRESUPxx (sin factor).
            const valorPresupuesto = normalizarNumero(presupuestoCampo);
            const tieneReal = realCampo != null && realCampo !== undefined;
            // Real: usar la contabilización tal cual regresa el backend (YTD desde SALDOS).
            const valorReal = normalizarNumero(tieneReal ? realCampo : 0);
            presupuesto[mes] = valorPresupuesto;
            real[mes] = valorReal;
          });
          return {
            cuenta21,
            cuentaVisible,
            nombre: cuenta.descripcion || cuenta.nombre || cuenta.DESCRIPCION || '',
            presupuesto,
            real
          };
        })
        .filter(Boolean);
    } catch (error) {
      console.warn('No fue posible obtener cuentas para presupuestos', error);
      return [];
    }
  };

  const esCuentaPresupuestoValida = (valorCuenta) => {
    const canonica = convertirCuenta21(valorCuenta || '');
    const prefijo = Number.parseInt((canonica || '').slice(0, 3), 10);
    return Number.isFinite(prefijo) && prefijo >= 400 && prefijo < 800;
  };

  const cuentaVisibleDesdeLarga = (cuentaLarga) => {
    const base = normalizarCuentaBase(cuentaLarga).padEnd(21, '0');
    const visible = base.slice(0, 11);
    return `${visible.slice(0, 3)}-${visible.slice(3, 6)}-${visible.slice(6, 9)}-${visible.slice(9, 11)}`;
  };

  const obtenerAnioSugerencias = (anio) => {
    if (Number.isInteger(anio)) return anio;
    const anioSelect = obtenerAnioSeleccionado();
    if (Number.isInteger(anioSelect)) return anioSelect;
    if (Number.isInteger(estadoModulo.anio)) return estadoModulo.anio;
    return null;
  };

  const sincronizarCuentasDisponibles = (anio, conjunto) => {
    if (!Number.isInteger(anio)) return;
    const lista = Array.from(conjunto);
    estadoModulo.cuentasDisponiblesPorAnio.set(anio, lista);
    if (anio === estadoModulo.anio) {
      estadoModulo.cuentasDisponibles = lista;
    }
  };

  const obtenerCuentasDisponiblesPorAnio = (anio) => {
    if (!Number.isInteger(anio)) {
      return estadoModulo.cuentasDisponibles || [];
    }
    const porAnio = estadoModulo.cuentasDisponiblesPorAnio.get(anio);
    if (porAnio?.length) return porAnio;
    return estadoModulo.cuentasDisponibles || [];
  };

  const unificarCuentasDisponibles = (lista = [], opciones = {}) => {
    const anioObjetivo = obtenerAnioSugerencias(opciones.anio);
    const usarReset = Boolean(opciones.reset);
    const baseSet = new Set();
    if (Number.isInteger(anioObjetivo)) {
      const prev = estadoModulo.cuentasDisponiblesPorAnio.get(anioObjetivo);
      prev?.forEach((c) => baseSet.add(c));
    } else {
      (estadoModulo.cuentasDisponibles || []).forEach((c) => baseSet.add(c));
    }
    const previo = usarReset ? new Set() : baseSet;
    lista.forEach((cuenta) => {
      const limpia = (cuenta || '').toString().trim();
      const canonica = convertirCuenta21(limpia);
      if (canonica) {
        if (normalizarModuloClave(estadoModulo.moduloClave) === 'presupuestos' && !esCuentaPresupuestoValida(canonica)) {
          return;
        }
        previo.add(canonica);
      }
    });
    if (Number.isInteger(anioObjetivo)) {
      sincronizarCuentasDisponibles(anioObjetivo, previo);
    }
    estadoModulo.cuentasDisponibles = Array.from(previo);
    return estadoModulo.cuentasDisponibles;
  };

  const poblarSugerenciasDesdeAnio = async (anio) => {
    if (!Number.isInteger(anio)) {
      return;
    }
    const registros = await cargarCuentasPresupuestos({ anio });
    const cuentas = registros
      .map((item) => convertirCuenta21(item.cuentaVisible || item.cuenta21 || item.cuenta || ''))
      .filter(Boolean);
    // Reiniciar con las de presupuestos del año
    unificarCuentasDisponibles(cuentas, { anio, reset: true });
    // Agregar catálogo completo (todos los niveles) del mismo año (con cache y sin spamear el backend)
    cargarCatalogoCompleto({ anio })
      .then((lista) => {
        if (Array.isArray(lista) && lista.length) {
          unificarCuentasDisponibles(lista, { anio });
        }
      })
      .catch(() => {
        // silencio: ya se marca fallido en cache
      });
  };

  const cargarCatalogoCompleto = ({ anio }) => {
    if (!Number.isInteger(anio)) return Promise.resolve([]);
    if (estadoModulo.catalogoPromesas.has(anio)) {
      return estadoModulo.catalogoPromesas.get(anio);
    }
    if (estadoModulo.catalogoFallido.has(anio)) {
      return Promise.resolve([]);
    }
    const rutas = [
      `${API_BASE}/cuentas/catalogo`,
      `${API_BASE}/planeacion/catalogo`,
      `${API_BASE}/saldos/catalogo`
    ];
    const params = new URLSearchParams({ anio });
    const empresaActiva = typeof Sesion?.obtenerEmpresaActiva === 'function' ? Sesion.obtenerEmpresaActiva() : null;
    if (empresaActiva?.id) {
      params.set('empresaId', empresaActiva.id);
    }
    const promesa = (async () => {
      const acumuladas = new Set();
      for (const ruta of rutas) {
        try {
          const resp = await fetch(`${ruta}?${params.toString()}`, { headers: Sesion.headersAutenticacion() });
          const datos = await resp.json();
          if (!resp.ok) {
            continue;
          }
          const cuentas = Array.isArray(datos.cuentas) ? datos.cuentas : Array.isArray(datos) ? datos : [];
          cuentas.forEach((item) => {
            const canonica = convertirCuenta21(
              item.numCta || item.NUM_CTA || item.cuenta || item.CUENTA || item.num_cta || ''
            );
            if (canonica) {
              acumuladas.add(canonica);
            }
          });
        } catch (error) {
          // probar siguiente ruta
        }
      }
      const lista = Array.from(acumuladas);
      if (!lista.length) {
        estadoModulo.catalogoFallido.add(anio);
      }
      return lista;
    })();
    estadoModulo.catalogoPromesas.set(anio, promesa);
    return promesa;
  };

  const compilarCatalogoGlobal = () => {
    const anioActual = obtenerAnioSeleccionado() || estadoModulo.anio;
    const dataset = window.CUENTAS_POR_MODULO || {};
    const todas = [];
    Object.values(dataset).forEach((registros) => {
      if (!Array.isArray(registros)) return;
      registros.forEach((registro) => {
        if (registro?.cuenta) {
          todas.push(convertirCuenta21(registro.cuenta));
        }
      });
    });
    unificarCuentasDisponibles(todas, { anio: anioActual });
  };

  const destruirTooltips = () => {
    estadoModulo.tooltips.forEach((tooltip) => {
      if (typeof tooltip?.dispose === 'function') {
        tooltip.dispose();
      }
    });
    estadoModulo.tooltips = [];
  };

  const activarTooltipsCuentas = () => {
    destruirTooltips();
    if (!estadoModulo.tabla || !window.bootstrap?.Tooltip) {
      return;
    }
    const celdas = estadoModulo.tabla.querySelectorAll('tbody tr.fila-cuenta td[data-bs-toggle="tooltip"]');
    celdas.forEach((celda) => {
      const tooltip = window.bootstrap.Tooltip.getOrCreateInstance(celda, {
        placement: 'top',
        trigger: 'hover',
        container: 'body'
      });
      estadoModulo.tooltips.push(tooltip);
    });
  };

  const solicitarDatos = async () => {
    const moduloClave = estadoModulo.moduloClave || normalizarModuloClave(estadoModulo.moduloId);
    if (!MODULOS_SOPORTADOS.has(moduloClave)) {
      return;
    }

    const empresa = Sesion.obtenerEmpresaActiva();
    const anio = obtenerAnioSeleccionado();
    if (!empresa?.id || !Number.isInteger(anio)) {
      limpiarValores();
      return;
    }
    estadoModulo.anio = anio;
    poblarSugerenciasDesdeAnio(anio);
    if (!estadoModulo.moduloId) {
      return;
    }
    const cuentas = obtenerCuentasSolicitadas();
    if (!cuentas.length) {
      limpiarValores();
      return;
    }

    const payload = {
      empresaId: empresa.id,
      anio,
      modulo: moduloClave || estadoModulo.moduloId,
      cuentas
    };
    // eslint-disable-next-line no-console
    console.debug('[planeacion] payload', payload);
    estadoModulo.ultimaSolicitud += 1;
    const folio = estadoModulo.ultimaSolicitud;
    try {
      const respuesta = await fetch(`${API_BASE}/planeacion/cuentas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...Sesion.headersAutenticacion()
        },
        body: JSON.stringify(payload)
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        const detalles = Array.isArray(datos.detalles) ? ` (${datos.detalles.join('; ')})` : '';
        throw new Error((datos.mensaje || 'No fue posible obtener la información contable.') + detalles);
      }
      if (folio !== estadoModulo.ultimaSolicitud) {
        return;
      }
      contarSaldos(datos.cuentas || []);
    } catch (error) {
      console.error('Error al cargar datos de planeación', error);
      if (folio === estadoModulo.ultimaSolicitud) {
        limpiarValores();
      }
    }
  };

  const obtenerSumasConfig = (sheetName, capitulo, seccion) => {
    const dataset = window.CUENTAS_SUMAS || {};
    const porHoja = dataset[normalizarSheetId(sheetName)] || null;
    if (!porHoja) {
      return null;
    }
    const porCapitulo = porHoja[normalizarTexto(capitulo)];
    if (!porCapitulo) {
      return null;
    }
    return porCapitulo[normalizarTexto(seccion)] || null;
  };

  const resolverPlaceholdersPorFila = (placeholdersPorFila, cuerpo) => {
    if (Number.isInteger(placeholdersPorFila) && placeholdersPorFila >= 0) {
      return placeholdersPorFila;
    }
    if (Number.isInteger(estadoModulo.placeholdersPorFila) && estadoModulo.placeholdersPorFila >= 0) {
      return estadoModulo.placeholdersPorFila;
    }
    const tabla = cuerpo?.closest ? cuerpo.closest('table') : estadoModulo.tabla;
    const columnas = contarColumnas(tabla);
    return Math.max(0, columnas - 2);
  };

  /**
   * Agrega una fila de resumen/suma al cuerpo de la tabla
   * 
   * Estas filas especiales muestran totales calculados y pueden ser de varios tipos:
   * - sum-row: Suma de todas las cuentas de una sección
   * - sum-row-sumavarios: Suma de varios sum-rows agrupados
   * - result-row: Resultado final del módulo
   * 
   * ESTRUCTURA DE FILA:
   * | (vacío) | Texto descriptivo | val1 | val2 | ... | val12 |
   * 
   * La primera columna (cuenta) está vacía porque las filas de suma
   * no representan una cuenta específica sino un total.
   * 
   * Los valores se inicializan en "-" y luego se actualizan con
   * recalcularSumas() que calcula los totales reales.
   * 
   * @param {Object} params - Parámetros
   * @param {string} params.texto - Texto descriptivo (ej: "Suma INGRESOS")
   * @param {string} params.clase - Clase CSS (sum-row, sum-row-sumavarios, result-row)
   * @param {HTMLElement} params.cuerpo - Elemento tbody donde insertar la fila
   * @param {number} params.placeholdersPorFila - Cantidad de columnas de valores (12 meses)
   * @returns {HTMLTableRowElement|null} Fila creada o null si faltan parámetros
   */
  const agregarFilaResumen = ({ texto, clase, cuerpo, placeholdersPorFila }) => {
    if (!texto || !cuerpo) {
      return null;
    }
    const placeholders = resolverPlaceholdersPorFila(placeholdersPorFila, cuerpo);
    const fila = document.createElement('tr');
    fila.className = clase;
    const celdaCuenta = document.createElement('td');
    celdaCuenta.textContent = '';
    fila.appendChild(celdaCuenta);
    const celdaDescripcion = document.createElement('td');
    celdaDescripcion.textContent = texto;
    fila.appendChild(celdaDescripcion);
    for (let i = 0; i < placeholders; i += 1) {
      const celda = document.createElement('td');
      celda.className = 'budget-value';
      celda.textContent = '-';
      fila.appendChild(celda);
    }
    cuerpo.appendChild(fila);
    return fila;
  };

  /**
   * Renderiza las secciones y filas de cuentas en el tbody de la tabla
   * 
   * Esta función toma la lista de cuentas filtradas por capitulo y las
   * organiza visualmente en secciones con sus respectivas filas.
   * 
   * PROCESO:
   * 1. Agrupa registros por sección (ej: "INGRESOS", "GASTOS", etc.)
   * 2. Para cada sección:
   *    a. Crea fila de encabezado (section-header-row) con nombre de sección
   *    b. Crea filas de cuenta (fila-cuenta) con columnas: cuenta | nombre | valores
   *    c. Agrega fila sum-row si la configuración de sumas lo indica
   * 3. Construye metadata de sumas (sumavarios, result-row)
   * 4. Retorna información para que renderizarTabla agregue las filas especiales
   * 
   * ESTRUCTURA DE FILA DE CUENTA:
   * | Cuenta (ej: 4101-010) | Nombre (ej: VENTAS) | ene | feb | ... | dic |
   * 
   * METADATA DE SUMAS:
   * - sumRowTexto: etiqueta normalizada del sum-row (ej: "suma ingresos")
   * - sumRowSumavariosTexto: etiqueta del sumavarios al que pertenece
   * - resultRowTexto: etiqueta del result-row final
   * 
   * @param {Object} params - Parámetros de renderizado
   * @param {Array} params.registros - Array de objetos {cuenta, nombre, seccion, capitulo}
   * @param {HTMLElement} params.cuerpo - Elemento tbody donde insertar filas
   * @param {number} params.placeholdersPorFila - Cantidad de columnas de valores (12 meses normalmente)
   * @param {string} params.sheetName - Nombre de la hoja de configuración
   * @param {string} params.capitulo - Nombre del capitulo/empresa
   * @param {Map} params.sumasPersonalizadas - Configuración personalizada de sumas (desde layout guardado)
   * @param {string} params.resultadoForzado - Texto forzado para result-row
   * @param {boolean} params.mostrarCuentaVisible - Si true, muestra cuenta en formato visible (4 dígitos)
   * @returns {Object} Objeto con resultadoFilas, sumasSecciones, sumavarios, faltantesNombre
   */
  const renderizarSecciones = ({
    registros,
    cuerpo,
    placeholdersPorFila,
    sheetName,
    capitulo,
    sumasPersonalizadas,
    resultadoForzado,
    mostrarCuentaVisible = false
  }) => {
    const placeholders = resolverPlaceholdersPorFila(placeholdersPorFila, cuerpo);
    const secciones = new Map();
    const faltantesNombre = new Set();
    registros.forEach((item) => {
      const clave = item.seccion || 'SIN SECCION';
      if (!secciones.has(clave)) {
        secciones.set(clave, []);
      }
      secciones.get(clave).push(item);
    });

    const resultRows = new Map();
    const sumasSecciones = [];
    const sumavariosData = new Map();
    const forcedResultTexto = (resultadoForzado || '').toString().trim();

    secciones.forEach((lista, seccion) => {
      const claveSeccion = normalizarTexto(seccion || 'SIN SECCION');
      const filasCuenta = [];
      let headerRow = null;
      if (seccion && seccion !== 'SIN SECCION') {
        const filaSeccion = document.createElement('tr');
        filaSeccion.className = 'section-header-row';
        const celda = document.createElement('td');
        celda.colSpan = placeholders + 2;
        celda.textContent = seccion;
        filaSeccion.appendChild(celda);
        cuerpo.appendChild(filaSeccion);
        headerRow = filaSeccion;
      }

      lista.forEach((item) => {
        const fila = document.createElement('tr');
        fila.className = 'fila-cuenta';
        const celdaCuenta = document.createElement('td');
        const cuenta21 = convertirCuenta21(item.cuenta || '');
        const cuentaTexto = mostrarCuentaVisible
          ? cuenta21
            ? cuentaVisibleDesdeLarga(cuenta21)
            : item.cuenta || '-'
          : item.cuenta || '-';
        celdaCuenta.textContent = cuentaTexto;
        if (cuenta21) {
          celdaCuenta.title = cuenta21;
          celdaCuenta.dataset.bsToggle = 'tooltip';
          celdaCuenta.dataset.bsPlacement = 'top';
        }
        fila.appendChild(celdaCuenta);
        const celdaNombre = document.createElement('td');
        const nombreMostrar = item.nombre || estadoModulo.nombresPorCuenta.get(cuenta21) || '';
        celdaNombre.textContent = nombreMostrar || '-';
        if (!nombreMostrar) {
          faltantesNombre.add(cuenta21);
        }
        fila.appendChild(celdaNombre);
        fila.dataset.cuenta = item.cuenta || '';
        fila.dataset.cuenta21 = cuenta21;
        fila.dataset.seccion = claveSeccion;
        for (let i = 0; i < placeholders; i += 1) {
          const celda = document.createElement('td');
          celda.className = 'budget-value';
          celda.textContent = '-';
          fila.appendChild(celda);
        }
        cuerpo.appendChild(fila);
        filasCuenta.push(fila);
      });

      const sumas =
        (sumasPersonalizadas instanceof Map ? sumasPersonalizadas.get(claveSeccion) : null) ||
        (sheetName && capitulo ? obtenerSumasConfig(sheetName, capitulo, seccion) : null);
      const etiquetaSumRow = (sumas?.sumRow || '').trim() || `Suma ${seccion}`;
      const resultRowTexts = [];
      if (forcedResultTexto) {
        resultRowTexts.push(forcedResultTexto);
      }
      if (Array.isArray(sumas?.resultRows)) {
        sumas.resultRows.forEach((texto) => {
          const limpio = (texto || '').toString().trim();
          if (limpio) resultRowTexts.push(limpio);
        });
      } else if (sumas?.resultRow) {
        const texto = sumas.resultRow.toString().trim();
        if (texto) resultRowTexts.push(texto);
      }
      const metaSeccion = {
        seccion: claveSeccion,
        tituloVisible: seccion,
        filasCuenta,
        sumRowTexto: etiquetaSumRow ? normalizarTexto(etiquetaSumRow) : '',
        sumRowSumavariosTexto: sumas?.sumRowSumavarios ? normalizarTexto(sumas.sumRowSumavarios) : '',
        sumRowSumavarios2Texto: sumas?.sumRowSumavarios2 ? normalizarTexto(sumas.sumRowSumavarios2) : '',
        sumRowSumavariosLabel: sumas?.sumRowSumavarios || '',
        sumRowSumavarios2Label: sumas?.sumRowSumavarios2 || '',
        resultRowTexto: resultRowTexts[0] ? normalizarTexto(resultRowTexts[0]) : '',
        resultRows: resultRowTexts,
        elementos: {
          header: headerRow
        }
      };
      if (etiquetaSumRow) {
        metaSeccion.elementos.sumRow = agregarFilaResumen({
          texto: etiquetaSumRow,
          clase: 'sum-row',
          cuerpo,
          placeholdersPorFila: placeholders
        });
        const registrarSumario = (texto) => {
          if (!texto) return;
          const clave = normalizarTexto(texto);
          if (!clave) return;
          const existente = sumavariosData.get(clave) || { texto, meta: null };
          existente.meta = metaSeccion;
          sumavariosData.set(clave, existente);
        };
        registrarSumario(metaSeccion.sumRowSumavariosLabel);
        registrarSumario(metaSeccion.sumRowSumavarios2Label);
        metaSeccion.resultRows.forEach((texto) => {
          if (!texto) return;
          const clave = `${texto}::result-row`;
          if (!resultRows.has(clave)) {
            resultRows.set(clave, texto);
          }
        });
      }
      sumasSecciones.push(metaSeccion);
    });

    if (forcedResultTexto) {
      resultRows.clear();
      resultRows.set(`${forcedResultTexto}::result-row`, forcedResultTexto);
    }

    let resultadoFilas = Array.from(resultRows.values()).map((texto) => ({
      texto,
      clase: 'result-row'
    }));
    if (resultadoFilas.length > 1) {
      resultadoFilas = resultadoFilas.slice(0, 1);
    }

    return {
      resultadoFilas,
      sumasSecciones,
      sumavarios: sumavariosData,
      faltantesNombre: Array.from(faltantesNombre)
    };
  };

  const limpiarCuentaTexto = (valor) => (valor || '').toString().replace(/[^0-9A-Za-z]/g, '').toUpperCase();

  const asegurarContenedorSugerencias = () => {
    if (estadoModulo.sugerencias.contenedor) return estadoModulo.sugerencias.contenedor;
    const div = document.createElement('div');
    div.className = 'sugerencias-cuentas';
    Object.assign(div.style, {
      position: 'absolute',
      background: '#fff',
      border: '1px solid #d0d7de',
      borderRadius: '6px',
      boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
      padding: '4px',
      minWidth: '200px',
      zIndex: 9999,
      display: 'none',
      maxHeight: '240px',
      overflowY: 'auto'
    });
    document.body.appendChild(div);
    estadoModulo.sugerencias.contenedor = div;
    return div;
  };

  const ocultarSugerencias = () => {
    const contenedor = estadoModulo.sugerencias.contenedor;
    if (contenedor) {
      contenedor.style.display = 'none';
      contenedor.innerHTML = '';
    }
  };

  const mostrarSugerenciasCuenta = (celda, texto) => {
    if (!celda || !estadoModulo.editMode) return;
    const contenedor = asegurarContenedorSugerencias();
    const anioActual = obtenerAnioSeleccionado() || estadoModulo.anio;
    const consulta = limpiarCuentaTexto(texto ?? celda.textContent);
    const disponibles = obtenerCuentasDisponiblesPorAnio(anioActual);
    const usadas = new Set(obtenerCuentasSolicitadas());
    const objetivo = normalizarTexto(consulta);
    let lista = disponibles
      .filter((cuenta) => !usadas.has(cuenta))
      .filter((cuenta) => {
        if (!objetivo) return true;
        const visible = cuentaVisibleDesdeLarga(cuenta);
        return normalizarTexto(cuenta).includes(objetivo) || normalizarTexto(visible).includes(objetivo);
      });
    if (!lista.length) {
      // Si no hay sugerencias, recargar catálogo del año y reintentar una vez.
      poblarSugerenciasDesdeAnio(anioActual);
      cargarCatalogoCompleto({ anio: anioActual })
        .then((listaCompleta) => {
          if (Array.isArray(listaCompleta) && listaCompleta.length) {
            unificarCuentasDisponibles(listaCompleta, { anio: anioActual });
            mostrarSugerenciasCuenta(celda, texto);
          } else {
            ocultarSugerencias();
          }
        })
        .catch(() => ocultarSugerencias());
      return;
    }
    contenedor.innerHTML = '';
    lista.forEach((cuenta) => {
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.textContent = cuentaVisibleDesdeLarga(cuenta);
      Object.assign(boton.style, {
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '6px 8px',
        border: 'none',
        background: 'transparent',
        cursor: 'pointer'
      });
      boton.addEventListener('mouseenter', () => {
        boton.style.backgroundColor = '#f6f8fa';
      });
      boton.addEventListener('mouseleave', () => {
        boton.style.backgroundColor = 'transparent';
      });
      boton.addEventListener('mousedown', (evt) => {
        evt.preventDefault();
        celda.textContent = cuentaVisibleDesdeLarga(cuenta);
        manejarCambioCuenta(celda.parentElement, celda);
        ocultarSugerencias();
      });
      contenedor.appendChild(boton);
    });
    const rect = celda.getBoundingClientRect();
    contenedor.style.left = `${rect.left + window.scrollX}px`;
    contenedor.style.top = `${rect.bottom + window.scrollY + 2}px`;
    contenedor.style.display = 'block';
  };

  const normalizarClave = (valor) => normalizarTexto(valor || '');

  const construirRegistrosDesdeLayout = (layout, capituloDestino) => {
    if (!layout || !Array.isArray(layout.secciones)) return [];
    const capitulo = layout.capitulo || capituloDestino || '';
    return layout.secciones.flatMap((seccion) => {
      const titulo = seccion.titulo || seccion.seccion || seccion.nombre || '';
      if (!titulo || !Array.isArray(seccion.cuentas)) return [];
      return seccion.cuentas.map((fila) => ({
        capitulo,
        seccion: titulo,
        cuenta: fila.cuenta || '',
        nombre: fila.nombre || ''
      }));
    });
  };

  const construirSumasDesdeLayout = (layout) => {
    const mapa = new Map();
    if (!layout || !Array.isArray(layout.secciones)) return mapa;
    const resultadoGlobal = layout.resultRow || '';
    layout.secciones.forEach((seccion) => {
      const clave = normalizarTexto(seccion.titulo || seccion.seccion || '');
      if (!clave) return;
      mapa.set(clave, {
        sumRow: seccion.sumRowLabel || seccion.sumRow || '',
        sumRowSumavarios: seccion.sumRowSumavarios || '',
        sumRowSumavarios2: seccion.sumRowSumavarios2 || '',
        resultRow: seccion.resultRow || resultadoGlobal || ''
      });
    });
    return mapa;
  };

  const validarSumavariosContiguos = (secciones = []) => {
    const bloques = new Map();
    for (let idx = 0; idx < secciones.length; idx += 1) {
      const seccion = secciones[idx] || {};
      const etiqueta = normalizarClave(
        seccion.sumRowSumavarios || seccion.sumRowSumavarios2 || seccion.sumRowSumavariosLabel || ''
      );
      if (!etiqueta) continue;
      const actual = bloques.get(etiqueta);
      if (!actual) {
        bloques.set(etiqueta, { inicio: idx, fin: idx });
      } else {
        if (idx !== actual.fin + 1) {
          return false;
        }
        actual.fin = idx;
      }
    }
    return true;
  };

  const validarLayout = (layout) => {
    if (!layout || !Array.isArray(layout.secciones) || !layout.secciones.length) return false;
    if (!layout.resultRow) return false;
    const resultadoSet = new Set();
    layout.secciones.forEach((seccion) => {
      const resultadoSeccion = normalizarClave(seccion.resultRow || layout.resultRow);
      if (resultadoSeccion) {
        resultadoSet.add(resultadoSeccion);
      }
    });
    if (resultadoSet.size > 1) {
      return false;
    }
    const seccionesValidas = layout.secciones.every((seccion) => {
      const titulo = (seccion.titulo || seccion.seccion || '').trim();
      const sumLabel = (seccion.sumRowLabel || seccion.sumRow || '').trim();
      return Boolean(titulo && sumLabel && Array.isArray(seccion.cuentas) && seccion.cuentas.length);
    });
    if (!seccionesValidas) {
      return false;
    }
    return validarSumavariosContiguos(layout.secciones);
  };

  const obtenerTextoCeldaDescripcion = (fila) => (fila?.cells?.[1]?.textContent || '').toString().trim();

  const construirLayoutDesdeMeta = ({ seccionesMeta, resultadoFilas, placeholdersPorFila, capitulo }) => {
    const resultadoTexto = resultadoFilas?.[0]?.texto || '';
    const secciones = (seccionesMeta || []).map((meta) => {
      const titulo = meta.tituloVisible || meta.seccion || '';
      const sumRowLabel = obtenerTextoCeldaDescripcion(meta.elementos.sumRow) || meta.sumRowSumavariosLabel || '';
      return {
        titulo,
        sumRowLabel: sumRowLabel || (titulo ? `Suma ${titulo}` : ''),
        sumRowSumavarios: meta.sumRowSumavariosTexto || '',
        sumRowSumavarios2: meta.sumRowSumavarios2Texto || '',
        sumRowSumavariosLabel: meta.sumRowSumavariosLabel || '',
        resultRow: resultadoTexto || meta.resultRowTexto || '',
        cuentas: (meta.filasCuenta || []).map((fila) => ({
          cuenta: fila.dataset.cuenta || '',
          nombre: obtenerTextoCeldaDescripcion(fila)
        }))
      };
    });
    return {
      capitulo: capitulo || '',
      placeholdersPorFila: Number.isInteger(placeholdersPorFila) ? placeholdersPorFila : 0,
      resultRow: resultadoTexto,
      secciones
    };
  };

  const capturarLayoutDesdeTabla = () => {
    if (!estadoModulo.sumas?.secciones?.length) return null;
    const resultadoFilas = Array.from(estadoModulo.sumas.resultRows?.values?.() || []).map((fila) => ({
      texto: obtenerTextoCeldaDescripcion(fila),
      clase: 'result-row'
    }));
    if (!resultadoFilas.length && estadoModulo.layoutActual?.resultRow) {
      resultadoFilas.push({ texto: estadoModulo.layoutActual.resultRow, clase: 'result-row' });
    }
    return construirLayoutDesdeMeta({
      seccionesMeta: estadoModulo.sumas.secciones,
      resultadoFilas,
      placeholdersPorFila: estadoModulo.placeholdersPorFila,
      capitulo: estadoModulo.capitulo
    });
  };

  const persistirLayoutActual = () => {
    const empresa = Sesion.obtenerEmpresaActiva();
    const anioSeleccion = obtenerAnioSeleccionado();
    const anio = Number.isInteger(anioSeleccion) ? anioSeleccion : estadoModulo.anio;
    if (!empresa?.id || !Number.isInteger(anio) || !estadoModulo.moduloClave || !esModuloEditable(estadoModulo.moduloClave)) {
      return false;
    }
    const layout = capturarLayoutDesdeTabla();
    if (!validarLayout(layout)) {
      console.warn('Layout no v\u00e1lido, no se guard\u00f3.');
      return false;
    }
    const guardado = guardarLayoutLocal({
      layout,
      moduloClave: estadoModulo.moduloClave,
      empresaId: empresa.id,
      anio
    });
    if (guardado) {
      estadoModulo.layoutActual = layout;
      estadoModulo.layoutEsPersonalizado = true;
    }
    return guardado;
  };

  let menuContextual = null;
  let filaContextual = null;

  const obtenerMetaSeccionPorFila = (fila) => {
    const clave = normalizarClave(fila?.dataset?.seccion || '');
    if (!clave) return null;
    return estadoModulo.sumas.secciones.find((seccion) => normalizarClave(seccion.seccion) === clave) || null;
  };

  const obtenerMetaPorSumavariosFila = (fila) => {
    const etiqueta = normalizarClave(obtenerTextoCeldaDescripcion(fila));
    if (!etiqueta) return null;
    return estadoModulo.sumas.secciones.find(
      (seccion) => normalizarClave(seccion.sumRowSumavariosLabel) === etiqueta
    );
  };

  const obtenerPrimerResultadoFila = () => {
    const iter = estadoModulo.sumas.resultRows?.values?.();
    if (!iter) return null;
    const primero = iter.next();
    return primero?.value || null;
  };

  const crearFilaCuentaVacia = (seccionClave) => {
    const fila = document.createElement('tr');
    fila.className = 'fila-cuenta';
    const celdaCuenta = document.createElement('td');
    celdaCuenta.textContent = '-';
    fila.appendChild(celdaCuenta);
    const celdaNombre = document.createElement('td');
    celdaNombre.textContent = '-';
    fila.appendChild(celdaNombre);
    for (let i = 0; i < estadoModulo.placeholdersPorFila; i += 1) {
      const celda = document.createElement('td');
      celda.className = 'budget-value';
      celda.textContent = '-';
      fila.appendChild(celda);
    }
    fila.dataset.seccion = seccionClave || '';
    fila.dataset.cuenta = '';
    fila.dataset.cuenta21 = '';
    return fila;
  };

  const crearFilaCuentaDesdeDatos = (datos, seccionClave) => {
    const fila = crearFilaCuentaVacia(seccionClave);
    const cuentaTexto = datos.cuenta || '-';
    const descripcionTexto = datos.descripcion || '-';
    const cuentaCelda = fila.children[0];
    const descripcionCelda = fila.children[1];
    if (cuentaCelda) {
      cuentaCelda.textContent = cuentaTexto;
    }
    if (descripcionCelda) {
      descripcionCelda.textContent = descripcionTexto;
    }
    fila.dataset.cuenta = datos.cuenta || '';
    fila.dataset.cuenta21 = datos.cuenta ? convertirCuenta21(datos.cuenta) : '';
    return fila;
  };

  const actualizarSumavariosParaRango = (label, indices, insertIdx) => {
    if (!label || !Array.isArray(indices) || indices.length < 2) {
      console.warn('⚠️ Sumavarios requiere al menos 2 secciones');
      return;
    }
    const clave = normalizarTexto(label);
    if (!clave) return;
    if (!estadoModulo || !estadoModulo.tabla) {
      console.error('❌ actualizarSumavariosParaRango: estadoModulo.tabla no disponible');
      return;
    }
    const cuerpo = estadoModulo.tabla.querySelector('tbody');
    if (!cuerpo) return;

    // Eliminar fila existente si hay
    const existente = estadoModulo.sumas.sumavariosRows?.get(clave);
    if (existente && existente.parentNode) {
      try {
        existente.parentNode.removeChild(existente);
        estadoModulo.sumas.sumavariosRows.delete(clave);
      } catch (e) {
        console.warn('⚠️ Error eliminando sumavarios existente:', e);
      }
    }

    const filaSumario = agregarFilaResumen({
      texto: label,
      clase: 'sum-row-sumavarios',
      cuerpo,
      placeholdersPorFila: estadoModulo.placeholdersPorFila
    });
    if (!filaSumario) return;
    if (!estadoModulo.sumas.sumavariosRows) estadoModulo.sumas.sumavariosRows = new Map();
    estadoModulo.sumas.sumavariosRows.set(clave, filaSumario);

    // Normalizar y validar índices
    const indicesOrdenados = [...new Set(indices)].sort((a, b) => a - b);
    const metasAfectadas = [];
    indicesOrdenados.forEach((idx) => {
      if (!Number.isInteger(idx)) return;
      const idxReal = idx >= insertIdx ? idx + 1 : idx;
      if (idxReal >= 0 && idxReal < (estadoModulo.sumas.secciones || []).length) {
        const meta = estadoModulo.sumas.secciones[idxReal];
        if (meta) metasAfectadas.push(meta);
      }
    });

    if (metasAfectadas.length < 2) {
      // No tiene sentido crear sumavarios para menos de 2 secciones
      console.warn('⚠️ Menos de 2 secciones en sumavarios, se omite la creación');
      estadoModulo.sumas.sumavariosRows.delete(clave);
      try { filaSumario.remove(); } catch (e) {}
      return;
    }

    metasAfectadas.forEach((meta) => {
      meta.sumRowSumavariosLabel = label;
      meta.sumRowSumavariosTexto = clave;
    });

    const ultimaMeta = metasAfectadas[metasAfectadas.length - 1];
    const referencia =
      ultimaMeta?.elementos?.sumRow || ultimaMeta?.filasCuenta?.[ultimaMeta.filasCuenta.length - 1] || null;
    if (referencia && referencia.parentNode) {
      try {
        referencia.parentNode.insertBefore(filaSumario, referencia.nextSibling);
      } catch (e) {
        console.warn('⚠️ Error insertando fila sumavarios en DOM:', e);
        cuerpo.appendChild(filaSumario);
      }
    } else {
      cuerpo.appendChild(filaSumario);
    }
  };

  const crearSeccionDesdeFormulario = ({
    referenciaFila,
    titulo,
    sumLabel,
    cuentas,
    sumavariosLabel,
    range
  }) => {
    // VALIDACIONES
    if (!estadoModulo || !estadoModulo.tabla) {
      console.error('❌ crearSeccionDesdeFormulario: tabla no disponible');
      return;
    }
    const cuerpo = estadoModulo.tabla.querySelector('tbody');
    if (!cuerpo) {
      console.error('❌ crearSeccionDesdeFormulario: tbody no encontrado');
      return;
    }
    if (!titulo || typeof titulo !== 'string' || !titulo.trim()) {
      console.error('❌ crearSeccionDesdeFormulario: titulo inválido');
      return;
    }
    const cuentasLista = Array.isArray(cuentas) ? cuentas.slice() : [];
    if (cuentasLista.length === 0) {
      console.error('❌ crearSeccionDesdeFormulario: Se requiere al menos una cuenta');
      return;
    }

    const seccionClave = normalizarTexto(titulo);
    const header = document.createElement('tr');
    header.className = 'section-header-row';
    const celdaHeader = document.createElement('td');
    celdaHeader.colSpan = estadoModulo.placeholdersPorFila + 2;
    celdaHeader.textContent = titulo;
    header.appendChild(celdaHeader);

    const cuentasFilas = cuentasLista.map((datos) => crearFilaCuentaDesdeDatos(datos, seccionClave));
    const textoSumRow = sumLabel && typeof sumLabel === 'string' && sumLabel.trim() ? sumLabel.trim() : `Suma ${titulo}`;
    const filaSumRow = agregarFilaResumen({
      texto: textoSumRow,
      clase: 'sum-row',
      cuerpo,
      placeholdersPorFila: estadoModulo.placeholdersPorFila
    });

    // Determinar índice de inserción con validaciones
    let idxInsercion = estadoModulo.sumas.secciones.length;
    try {
      const metaBase = referenciaFila?.classList.contains('sum-row-sumavarios') && obtenerMetaPorSumavariosFila(referenciaFila)
        ? obtenerMetaPorSumavariosFila(referenciaFila)
        : obtenerMetaSeccionPorFila(referenciaFila);
      if (metaBase) {
        const idxTent = obtenerIndiceInsercionSeccion(metaBase);
        if (Number.isInteger(idxTent) && idxTent >= 0 && idxTent <= estadoModulo.sumas.secciones.length) {
          idxInsercion = idxTent;
        } else {
          console.warn('⚠️ crearSeccionDesdeFormulario: índice de inserción inválido, se usará al final');
        }
      }
    } catch (e) {
      console.warn('⚠️ crearSeccionDesdeFormulario: error determinando índice inserción', e);
    }

    const referenciaMeta = estadoModulo.sumas.secciones[idxInsercion] || estadoModulo.sumas.secciones[idxInsercion - 1] || null;
    let anchor = referenciaMeta?.elementos?.sumRow || referenciaMeta?.filasCuenta?.[0] || obtenerPrimerResultadoFila();
    if (!anchor) anchor = cuerpo.lastElementChild?.nextSibling || null;

    try {
      if (anchor && anchor.parentNode === cuerpo) {
        cuerpo.insertBefore(header, anchor);
        cuentasFilas.forEach((fila) => cuerpo.insertBefore(fila, anchor));
        if (filaSumRow) cuerpo.insertBefore(filaSumRow, anchor);
      } else {
        cuerpo.appendChild(header);
        cuentasFilas.forEach((fila) => cuerpo.appendChild(fila));
        if (filaSumRow) cuerpo.appendChild(filaSumRow);
      }
    } catch (err) {
      console.error('❌ crearSeccionDesdeFormulario: error insertando en DOM', err);
      return;
    }

    const metaNueva = {
      seccion: seccionClave,
      tituloVisible: titulo,
      filasCuenta: cuentasFilas,
      sumRowTexto: normalizarTexto(textoSumRow),
      sumRowSumavariosTexto: '',
      sumRowSumavarios2Texto: '',
      sumRowSumavariosLabel: '',
      sumRowSumavarios2Label: '',
      resultRowTexto: '',
      resultRows: [],
      elementos: { header, sumRow: filaSumRow }
    };

    try {
      if (idxInsercion >= 0 && idxInsercion <= estadoModulo.sumas.secciones.length) {
        estadoModulo.sumas.secciones.splice(idxInsercion, 0, metaNueva);
      } else {
        estadoModulo.sumas.secciones.push(metaNueva);
      }
    } catch (err) {
      console.error('❌ crearSeccionDesdeFormulario: error insertando metaSeccion', err);
      return;
    }

    if (sumavariosLabel && range && typeof range === 'object') {
      const indices = [];
      const start = Number.isInteger(range.start) ? range.start : null;
      const end = Number.isInteger(range.end) ? range.end : null;
      if (start !== null && end !== null && start <= end) {
        for (let i = start; i <= end; i += 1) indices.push(i);
      }
      if (indices.length > 1) actualizarSumavariosParaRango(sumavariosLabel, indices, idxInsercion);
    }

    actualizarEstructuraDespuesCambio();
  };

  const actualizarEstructuraDespuesCambio = () => {
    aplicarModoEdicionEnTabla();
    recalcularSumas();
    persistirLayoutActual();
    estadoModulo.hayCambios = true;
    notificarCambios();
    
    // Actualizar componente de colapso de secciones si existe
    if (window.SeccionCollapse && typeof window.SeccionCollapse.actualizar === 'function') {
      window.SeccionCollapse.actualizar();
    }
  };

  const insertarFilaCuentaNueva = (referencia, posicion) => {
    if (!referencia || !estadoModulo.tabla) return;
    const meta = obtenerMetaSeccionPorFila(referencia);
    if (!meta) return;
    const idx = meta.filasCuenta.indexOf(referencia);
    if (idx < 0) return;
    const cuerpo = estadoModulo.tabla.querySelector('tbody');
    const nuevaFila = crearFilaCuentaVacia(meta.seccion);
    const insertarAntesDe = (nodo) => {
      if (nodo) {
        cuerpo.insertBefore(nuevaFila, nodo);
      } else {
        cuerpo.appendChild(nuevaFila);
      }
    };
    if (posicion === 'arriba') {
      insertarAntesDe(referencia);
      meta.filasCuenta.splice(idx, 0, nuevaFila);
    } else {
      const siguiente = meta.filasCuenta[idx + 1];
      if (siguiente) {
        insertarAntesDe(siguiente);
      } else if (meta.elementos.sumRow) {
        insertarAntesDe(meta.elementos.sumRow);
      } else {
        insertarAntesDe(obtenerPrimerResultadoFila());
      }
      meta.filasCuenta.splice(idx + 1, 0, nuevaFila);
    }
    actualizarEstructuraDespuesCambio();
  };

  const eliminarFilaSeleccionada = (fila) => {
    if (!fila) return;

    // Caso: fila de cuenta
    if (fila.classList.contains('fila-cuenta')) {
      const meta = obtenerMetaSeccionPorFila(fila);
      if (!meta) {
        console.warn('⚠️ eliminarFilaSeleccionada: meta no encontrada');
        return;
      }
      if ((meta.filasCuenta || []).length <= 1) {
        window.alert('La sección debe tener al menos una cuenta.');
        return;
      }
      const cuenta = fila.dataset.cuenta21 || fila.dataset.cuenta;
      if (cuenta) {
        estadoModulo.valoresPorCuenta?.delete(cuenta);
        estadoModulo.nombresPorCuenta?.delete(cuenta);
      }
      try { fila.remove(); } catch (e) { console.warn('⚠️ Error removiendo fila del DOM', e); }
      const idx = meta.filasCuenta.indexOf(fila);
      if (idx >= 0) meta.filasCuenta.splice(idx, 1);
      actualizarEstructuraDespuesCambio();
      console.log(`✅ Fila eliminada de sección ${meta.seccion}`);
      return;
    }

    // Caso: fila sum-row-sumavarios
    if (fila.classList.contains('sum-row-sumavarios')) {
      if (!estadoModulo || !estadoModulo.tabla) return;
      const cuerpo = estadoModulo.tabla.querySelector('tbody');
      if (!cuerpo) return;

      // Buscar clave asociada
      let claveAux = null;
      for (const [k, f] of (estadoModulo.sumas.sumavariosRows || new Map()).entries()) {
        if (f === fila) {
          claveAux = k; break;
        }
      }
      if (claveAux) {
        // Limpiar referencias en metas
        (estadoModulo.sumas.secciones || []).forEach((meta) => {
          if (normalizarTexto(meta.sumRowSumavariosLabel) === normalizarTexto(claveAux)) {
            meta.sumRowSumavariosLabel = '';
            meta.sumRowSumavariosTexto = '';
          }
        });
        estadoModulo.sumas.sumavariosRows.delete(claveAux);
      }
      try { fila.remove(); } catch (e) { console.warn('⚠️ Error al eliminar sumavarios del DOM', e); }
      actualizarEstructuraDespuesCambio();
      console.log(`✅ Sumavarios ${claveAux || ''} eliminado`);
      return;
    }
  };

  const obtenerIndiceInsercionSeccion = (metaBase) => {
    const lista = estadoModulo.sumas.secciones || [];
    const idxBase = lista.indexOf(metaBase);
    if (idxBase < 0) return lista.length;
    const etiqueta = normalizarClave(metaBase?.sumRowSumavariosLabel || '');
    if (!etiqueta) return idxBase + 1;
    let fin = idxBase;
    while (
      fin + 1 < lista.length &&
      normalizarClave(lista[fin + 1]?.sumRowSumavariosLabel || '') === etiqueta
    ) {
      fin += 1;
    }
    return fin + 1;
  };

  const agregarSeccionNueva = (referenciaFila) => {
    abrirModalAgregarSeccion(referenciaFila);
  };

  const ocultarMenuContextual = () => {
    if (menuContextual) {
      menuContextual.hidden = true;
    }
    filaContextual = null;
  };

  const mostrarMenuContextual = (x, y, opciones) => {
    const menu = menuContextual || document.createElement('div');
    menuContextual = menu;
    menu.className = 'planeacion-context-menu';
    menu.innerHTML = '';
    Object.assign(menu.style, {
      position: 'absolute',
      background: '#fff',
      border: '1px solid #d0d7de',
      borderRadius: '6px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      padding: '4px',
      minWidth: '200px',
      fontSize: '0.9rem',
      zIndex: 9999
    });
    opciones.forEach((opcion) => {
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.textContent = opcion.texto;
      Object.assign(boton.style, {
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '8px 10px',
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        borderRadius: '4px'
      });
      boton.addEventListener('mouseenter', () => {
        boton.style.backgroundColor = '#f6f8fa';
      });
      boton.addEventListener('mouseleave', () => {
        boton.style.backgroundColor = 'transparent';
      });
      boton.addEventListener('click', () => {
        switch (opcion.clave) {
          case 'add_wizard':
            // Usar InsertionWizard si está disponible
            if (typeof window.InsertionWizard !== 'undefined') {
              window.InsertionWizard.open(filaContextual);
            } else {
              console.warn('InsertionWizard no disponible');
            }
            break;
          case 'add_above':
            insertarFilaCuentaNueva(filaContextual, 'arriba');
            break;
          case 'add_below':
            insertarFilaCuentaNueva(filaContextual, 'abajo');
            break;
          case 'delete_row':
            eliminarFilaSeleccionada(filaContextual);
            break;
          case 'add_section':
            agregarSeccionNueva(filaContextual);
            break;
          default:
            break;
        }
        ocultarMenuContextual();
      });
      menu.appendChild(boton);
    });
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.hidden = false;
    if (!document.body.contains(menu)) {
      document.body.appendChild(menu);
    }
  };

  document.addEventListener('click', (evt) => {
    if (menuContextual && !menuContextual.contains(evt.target)) {
      ocultarMenuContextual();
    }
  });
  window.addEventListener('scroll', () => ocultarMenuContextual(), true);
  window.addEventListener('resize', () => ocultarMenuContextual());

  document.addEventListener('contextmenu', (evt) => {
    if (!estadoModulo.editMode || !esModuloEditable(estadoModulo.moduloClave)) {
      return;
    }
    const tabla = estadoModulo.tabla || obtenerTabla();
    if (!tabla || !tabla.contains(evt.target)) {
      return;
    }
    const fila = evt.target.closest('tr');
    if (!fila) {
      return;
    }
    const opciones = [];
    // Priorizar InsertionWizard si está disponible
    if (typeof window.InsertionWizard !== 'undefined') {
      opciones.push({ clave: 'add_wizard', texto: '✨ Agregar cuenta/sección...' });
    }
    if (fila.classList.contains('fila-cuenta')) {
      opciones.push({ clave: 'add_above', texto: 'Agregar cuenta arriba' });
      opciones.push({ clave: 'add_below', texto: 'Agregar cuenta abajo' });
      opciones.push({ clave: 'delete_row', texto: 'Eliminar fila' });
    } else if (fila.classList.contains('sum-row-sumavarios')) {
      opciones.push({ clave: 'delete_row', texto: 'Eliminar sum-row-sumavarios' });
    }
    // Agregar sección (legacy) solo si no hay wizard
    if (typeof window.InsertionWizard === 'undefined') {
      opciones.push({ clave: 'add_section', texto: 'Agregar sección' });
    }
    if (!opciones.length) return;
    evt.preventDefault();
    filaContextual = fila;
    mostrarMenuContextual(evt.pageX, evt.pageY, opciones);
  });

  /**
   * Extrae valores numéricos de las celdas de una fila
   * 
   * Lee el textContent de cada celda (empezando desde la columna 'inicio'),
   * limpia el texto eliminando símbolos de moneda y formato,
   * y convierte cada valor a número.
   * 
   * @param {HTMLTableRowElement} fila - Fila de la cual extraer valores
   * @param {number} inicio - Índice de celda inicial (default: 2, saltando nombre y cuenta)
   * @returns {Array<number>} Array con los valores numéricos extraídos
   */
  const extraerValoresNumericos = (fila, inicio = 2) => {
    const valores = [];
    for (let i = inicio; i < fila.cells.length; i += 1) {
      const texto = (fila.cells[i].textContent || '').replace(/[^0-9+.,-]/g, '');
      const numero = Number(texto.replace(',', '.'));
      valores.push(Number.isFinite(numero) ? numero : 0);
    }
    return valores;
  };

  /**
   * Asigna valores numéricos formateados a las celdas de una fila
   * 
   * Toma un array de números y los escribe en las celdas de la fila
   * aplicando el formato numérico (separadores de miles, decimales, etc.)
   * 
   * @param {HTMLTableRowElement} fila - Fila donde asignar los valores
   * @param {Array<number>} valores - Array con los valores a asignar
   * @param {number} inicio - Índice de celda inicial (default: 2, saltando nombre y cuenta)
   */
  const asignarValoresNumericos = (fila, valores, inicio = 2) => {
    if (!fila || !Array.isArray(valores)) return;
    for (let i = inicio; i < fila.cells.length && i - inicio < valores.length; i += 1) {
      fila.cells[i].textContent = formatearNumero(valores[i - inicio]);
    }
  };

  /**
   * Suma múltiples listas de valores numéricos columna por columna
   * 
   * Ejemplo: Si tienes 3 filas con valores [10, 20, 30] cada una,
   * esta función retorna [30, 60, 90] (suma vertical por columna)
   * 
   * @param {Array<Array<number>>} listas - Array de arrays con valores numéricos
   * @param {number} longitud - Cantidad de columnas esperadas
   * @returns {Array<number>} Array con la suma de cada columna
   */
  const sumarListas = (listas = [], longitud = 0) => {
    const resultado = Array.from({ length: longitud }, () => 0);
    listas.forEach((lista) => {
      lista.forEach((valor, indice) => {
        resultado[indice] += Number(valor) || 0;
      });
    });
    return resultado;
  };

  /**
   * Recalcula las sumas de todas las secciones del módulo
   * 
   * Esta función realiza DOS tipos de suma:
   * 
   * 1. SUMA DE SECCIÓN (sum-row):
   *    - Suma verticalmente todas las cuentas dentro de una sección
   *    - Ejemplo: Si una sección tiene cuentas con presupuestos [100, 200, 300]
   *      la fila sum-row mostrará 600
   * 
   * 2. SUMA DE VARIAS SECCIONES (sumavarios):
   *    - Agrupa secciones que tienen el mismo sumRowSumavariosTexto
   *    - Suma los sum-row de todas esas secciones
   *    - Ejemplo: Si 3 secciones tienen sum-row [100], [200], [300]
   *      y todas están agrupadas bajo "GASTOS TOTALES",
   *      la fila sumavarios mostrará 600
   * 
   * El proceso es:
   * - Para cada sección, extrae valores de todas sus filas (cuentas)
   * - Suma esos valores columna por columna usando sumarListas()
   * - Guarda el resultado en seccion.sumValues
   * - Actualiza la fila sum-row en el DOM
   * - Luego agrupa todas las secciones por sumRowSumavariosTexto
   * - Suma los sumValues de secciones agrupadas
   * - Actualiza las filas sumavarios en el DOM
   */
  const recalcularSumas = () => {
    const meta = estadoModulo.sumas;
    if (!meta || !Array.isArray(meta.secciones) || meta.secciones.length === 0) {
      if (!meta || !meta.secciones) console.warn('⚠️ recalcularSumas: sin meta.secciones');
      return;
    }
    
    // Obtener todas las columnas ordenadas por su posición (excepto 'year')
    const clavesOrdenadas = Object.entries(estadoModulo.columnas || {})
      .sort((a, b) => a[1] - b[1])
      .map(([clave]) => clave)
      .filter((clave) => clave !== 'year');
    const longitud = clavesOrdenadas.length;
    if (!longitud) {
      console.warn('⚠️ recalcularSumas: sin columnas válidas');
      return;
    }
    const secciones = meta.secciones;

    const errores = [];
    
    // PASO 1: Calcular sum-row para cada sección (suma vertical de todas las cuentas)
    secciones.forEach((seccion, idxSeccion) => {
      try {
        if (!seccion || !Array.isArray(seccion.filasCuenta)) {
          errores.push(`Sección inválida en índice ${idxSeccion}`);
          seccion.sumValues = Array.from({ length: longitud }, () => 0);
          return;
        }
        
        // Extraer valores de cada fila de cuenta en la sección
        const listas = seccion.filasCuenta.map((fila) => {
          if (!fila || !fila.dataset) return Array.from({ length: longitud }, () => 0);
          const cuenta = fila.dataset.cuenta21 || '';
          const almacenados = estadoModulo.valoresPorCuenta?.get(cuenta);
          if (almacenados) {
            // Obtener valores desde el Map (más confiable)
            return clavesOrdenadas.map((clave) => almacenados[clave] ?? 0);
          }
          // Si no está en el Map, extraer del DOM
          return extraerValoresNumericos(fila);
        });
        
        // Sumar todas las filas columna por columna
        const valores = sumarListas(listas, longitud);
        seccion.sumValues = valores;
        
        // Actualizar la fila sum-row en el DOM
        if (seccion.elementos?.sumRow && seccion.elementos.sumRow.parentNode) {
          asignarValoresNumericos(seccion.elementos.sumRow, valores);
        } else {
          console.warn(`⚠️ Sección ${seccion.seccion || idxSeccion}: sumRow no presente en DOM`);
        }
      } catch (err) {
        errores.push(`Error sumando sección ${idxSeccion}: ${err?.message || err}`);
      }
    });
    if (errores.length) console.warn('⚠️ Errores en recalcularSumas:', errores);

    // PASO 2: Calcular sumavarios (suma de sum-rows agrupados por etiqueta)
    try {
      const acumuladosSumavarios = new Map();
      
      // Agrupar secciones por su etiqueta sumavarios
      secciones.forEach((seccion) => {
        const clave = normalizarClave(seccion.sumRowSumavariosTexto || seccion.sumRowSumavarios2Texto);
        if (!clave) return;
        
        // Acumular sumValues de secciones con la misma etiqueta
        const prev = acumuladosSumavarios.get(clave) || Array.from({ length: longitud }, () => 0);
        (seccion.sumValues || Array.from({ length: longitud }, () => 0)).forEach((valor, idx) => {
          prev[idx] += Number(valor) || 0;
        });
        acumuladosSumavarios.set(clave, prev);
      });
      
      // Actualizar filas sumavarios en el DOM
      secciones.forEach((seccion) => {
        const clave = normalizarClave(seccion.sumRowSumavariosTexto || seccion.sumRowSumavarios2Texto);
        if (!clave) return;
        const valores = acumuladosSumavarios.get(clave) || Array.from({ length: longitud }, () => 0);
        seccion.sumavariosValues = valores;
      });
      meta.sumavariosRows?.forEach((fila, clave) => {
        try {
          const valores = acumuladosSumavarios.get(clave) || Array.from({ length: longitud }, () => 0);
          if (fila && fila.parentNode) asignarValoresNumericos(fila, valores);
        } catch (e) {
          console.warn('⚠️ Error asignando sumavarios a fila:', e);
        }
      });
    } catch (e) {
      console.warn('⚠️ Error en fase sumavarios:', e);
    }

    // result-row: suma solamente los sum-row de todas las secciones con la misma etiqueta de resultado
    try {
      const acumuladosResultado = new Map();
      secciones.forEach((seccion) => {
        const clave = normalizarClave(seccion.resultRowTexto);
        if (!clave) return;
        const origen = seccion.sumValues || Array.from({ length: longitud }, () => 0);
        const prev = acumuladosResultado.get(clave) || Array.from({ length: longitud }, () => 0);
        origen.forEach((valor, idx) => {
          prev[idx] += Number(valor) || 0;
        });
        acumuladosResultado.set(clave, prev);
      });
      meta.resultRows?.forEach((fila, clave) => {
        try {
          const valores = acumuladosResultado.get(clave) || Array.from({ length: longitud }, () => 0);
          if (fila && fila.parentNode) asignarValoresNumericos(fila, valores);
        } catch (e) {
          console.warn('⚠️ Error asignando result-row:', e);
        }
      });
    } catch (e) {
      console.warn('⚠️ Error en fase resultado:', e);
    }
  };

  const manejarCambioCuenta = (fila, celda) => {
    if (!fila || !celda) return;
    const texto = (celda.textContent || '').trim();
    const nuevaCuenta21 = convertirCuenta21(texto);
    const cuentaAnterior = fila.dataset.cuenta21 || '';
    const valoresPrevios = estadoModulo.valoresPorCuenta.get(cuentaAnterior) || {};
    const nombrePrevio = estadoModulo.nombresPorCuenta.get(cuentaAnterior);
    if (cuentaAnterior && cuentaAnterior !== nuevaCuenta21) {
      estadoModulo.valoresPorCuenta.delete(cuentaAnterior);
      estadoModulo.nombresPorCuenta.delete(cuentaAnterior);
    }
    fila.dataset.cuenta = texto;
    fila.dataset.cuenta21 = nuevaCuenta21;
    if (nuevaCuenta21) {
      fila.dataset.cuenta = texto || nuevaCuenta21;
      estadoModulo.valoresPorCuenta.set(nuevaCuenta21, valoresPrevios);
      if (nombrePrevio) {
        estadoModulo.nombresPorCuenta.set(nuevaCuenta21, nombrePrevio);
        actualizarNombreFila(fila, nombrePrevio);
      }
      celda.title = nuevaCuenta21;
      celda.dataset.bsToggle = 'tooltip';
      celda.dataset.bsPlacement = 'top';
    } else {
      celda.title = '';
      celda.removeAttribute('data-bs-toggle');
      celda.removeAttribute('data-bs-placement');
    }
    recalcularTotalesFilaPresupuesto(fila);
    recalcularSumas();
    persistirLayoutActual();
    estadoModulo.hayCambios = true;
    notificarCambios();
  };

  const manejarCambioNombre = (fila, celda) => {
    if (!fila || !celda) return;
    const nombre = (celda.textContent || '').trim();
    const cuenta = fila.dataset.cuenta21 || '';
    if (cuenta) {
      estadoModulo.nombresPorCuenta.set(cuenta, nombre);
    }
    persistirLayoutActual();
    estadoModulo.hayCambios = true;
    notificarCambios();
  };

  const actualizarPresupuestoCelda = (fila, clave, celda) => {
    if (!fila || !clave || !celda) return;
    const cuenta = fila.dataset.cuenta21 || '';
    const almacen = estadoModulo.valoresPorCuenta.get(cuenta) || {};
    const valor = parsearNumero(celda.textContent);
    almacen[clave] = valor;
    estadoModulo.valoresPorCuenta.set(cuenta, almacen);
    celda.textContent = formatearNumero(valor);
    recalcularTotalesFilaPresupuesto(fila);
    recalcularSumas();
    estadoModulo.hayCambios = true;
    notificarCambios();
  };

  const limpiarModoEdicionEnTabla = () => {
    if (!estadoModulo.tabla) return;
    ocultarColumnasReal(false);
    obtenerFilasCuenta().forEach((fila) => {
      Array.from(fila.cells).forEach((celda) => {
        if (!celda.dataset.editable) return;
        celda.contentEditable = 'false';
        delete celda.dataset.editable;
        delete celda.dataset.columnaClave;
      });
    });
    estadoModulo.tabla.classList.remove('modo-edicion');
  };

  const habilitarEdicionTextoBasica = () => {
    if (!estadoModulo.tabla) return;
    const filas = obtenerFilasCuenta();
    filas.forEach((fila) => {
      const celdaCuenta = fila.cells[0];
      const celdaNombre = fila.cells[1];
      if (celdaCuenta && !celdaCuenta.dataset.textEditable) {
        celdaCuenta.contentEditable = 'true';
        celdaCuenta.dataset.textEditable = 'cuenta';
        celdaCuenta.addEventListener('blur', () => {
          manejarCambioCuenta(fila, celdaCuenta);
          setTimeout(() => ocultarSugerencias(), 150);
        });
        celdaCuenta.addEventListener('input', () => mostrarSugerenciasCuenta(celdaCuenta, celdaCuenta.textContent));
        celdaCuenta.addEventListener('focus', () => mostrarSugerenciasCuenta(celdaCuenta, celdaCuenta.textContent));
      }
      if (celdaNombre && !celdaNombre.dataset.textEditable) {
        celdaNombre.contentEditable = 'true';
        celdaNombre.dataset.textEditable = 'nombre';
        celdaNombre.addEventListener('blur', () => manejarCambioNombre(fila, celdaNombre));
      }
    });
  };

  const aplicarModoEdicionEnTabla = () => {
    if (!estadoModulo.tabla) return;
    if (!estadoModulo.editMode) {
      limpiarModoEdicionEnTabla();
      habilitarEdicionTextoBasica();
      return;
    }
    estadoModulo.tabla.classList.add('modo-edicion');
    ocultarColumnasReal(true);
    const reverse = invertirColumnas();
    const filas = obtenerFilasCuenta();

    const obtenerCeldasEditablesFila = (fila) => Array.from(fila.cells).filter((celda) => celda.dataset.editable);
    const enfocarCelda = (celda) => {
      if (!celda) return;
      celda.focus();
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(celda);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    };
    const moverFocus = (celdaActual, direccion) => {
      if (!celdaActual) return;
      const fila = celdaActual.parentElement;
      const filasEdit = obtenerFilasCuenta();
      const filaIndex = filasEdit.indexOf(fila);
      const colIndex = Array.from(fila.cells).indexOf(celdaActual);
      if (filaIndex < 0 || colIndex < 0) return;
      if (direccion === 'arriba' && filaIndex > 0) {
        const target = filasEdit[filaIndex - 1].cells[colIndex];
        if (target?.dataset.editable) enfocarCelda(target);
      } else if (direccion === 'abajo' && filaIndex < filasEdit.length - 1) {
        const target = filasEdit[filaIndex + 1].cells[colIndex];
        if (target?.dataset.editable) enfocarCelda(target);
      } else if (direccion === 'izquierda') {
        const editables = obtenerCeldasEditablesFila(fila);
        const idx = editables.indexOf(celdaActual);
        if (idx > 0) enfocarCelda(editables[idx - 1]);
      } else if (direccion === 'derecha') {
        const editables = obtenerCeldasEditablesFila(fila);
        const idx = editables.indexOf(celdaActual);
        if (idx >= 0 && idx < editables.length - 1) enfocarCelda(editables[idx + 1]);
      }
    };

    filas.forEach((fila) => {
      const celdaCuenta = fila.cells[0];
      const celdaNombre = fila.cells[1];
      if (celdaCuenta && !celdaCuenta.dataset.editable) {
        celdaCuenta.contentEditable = 'true';
        celdaCuenta.dataset.editable = 'cuenta';
        celdaCuenta.addEventListener('blur', () => {
          manejarCambioCuenta(fila, celdaCuenta);
          setTimeout(() => ocultarSugerencias(), 150);
        });
        celdaCuenta.addEventListener('keydown', (evt) => {
          if (evt.key === 'Enter') {
            evt.preventDefault();
            celdaCuenta.blur();
          } else if (evt.key === 'ArrowRight') {
            evt.preventDefault();
            moverFocus(celdaCuenta, 'derecha');
          } else if (evt.key === 'ArrowDown') {
            evt.preventDefault();
            moverFocus(celdaCuenta, 'abajo');
          } else if (evt.key === 'ArrowUp') {
            evt.preventDefault();
            moverFocus(celdaCuenta, 'arriba');
          }
        });
        celdaCuenta.addEventListener('input', () => mostrarSugerenciasCuenta(celdaCuenta, celdaCuenta.textContent));
        celdaCuenta.addEventListener('focus', () => mostrarSugerenciasCuenta(celdaCuenta, celdaCuenta.textContent));
      }
      if (celdaNombre && !celdaNombre.dataset.editable) {
        celdaNombre.contentEditable = 'true';
        celdaNombre.dataset.editable = 'nombre';
        celdaNombre.addEventListener('blur', () => manejarCambioNombre(fila, celdaNombre));
        celdaNombre.addEventListener('keydown', (evt) => {
          if (evt.key === 'Enter') {
            evt.preventDefault();
            celdaNombre.blur();
          } else if (evt.key === 'ArrowLeft') {
            evt.preventDefault();
            moverFocus(celdaNombre, 'izquierda');
          } else if (evt.key === 'ArrowRight') {
            evt.preventDefault();
            moverFocus(celdaNombre, 'derecha');
          } else if (evt.key === 'ArrowDown') {
            evt.preventDefault();
            moverFocus(celdaNombre, 'abajo');
          } else if (evt.key === 'ArrowUp') {
            evt.preventDefault();
            moverFocus(celdaNombre, 'arriba');
          }
        });
      }
      Array.from(fila.cells).forEach((celda, idx) => {
        const clave = reverse[idx];
        if (!esClaveBudget(clave)) return;
        if (celda.dataset.editable) return;
        celda.contentEditable = 'true';
        celda.dataset.editable = 'budget';
        celda.dataset.columnaClave = clave;
        celda.addEventListener('blur', () => actualizarPresupuestoCelda(fila, clave, celda));
        celda.addEventListener('keydown', (evt) => {
          if (evt.key === 'Enter') {
            evt.preventDefault();
            celda.blur();
          } else if (evt.key === 'ArrowLeft') {
            evt.preventDefault();
            moverFocus(celda, 'izquierda');
          } else if (evt.key === 'ArrowRight') {
            evt.preventDefault();
            moverFocus(celda, 'derecha');
          } else if (evt.key === 'ArrowDown') {
            evt.preventDefault();
            moverFocus(celda, 'abajo');
          } else if (evt.key === 'ArrowUp') {
            evt.preventDefault();
            moverFocus(celda, 'arriba');
          }
        });
      });
    });

    // Enfocar la primera celda budget disponible
    const primerFila = filas[0];
    if (primerFila) {
      const indiceBudget = Object.entries(estadoModulo.columnas || {})
        .filter(([clave]) => esClaveBudget(clave))
        .map(([, idx]) => idx)
        .sort((a, b) => a - b)[0];
      if (indiceBudget != null) {
        const celdaFocus = primerFila.cells[indiceBudget];
        if (celdaFocus) {
          setTimeout(() => enfocarCelda(celdaFocus), 0);
        }
      }
    }
  };

  const iniciarEdicion = () => {
    if (estadoModulo.editMode) return;
    estadoModulo.editSnapshot = tomarSnapshotEdicion();
    estadoModulo.layoutSnapshot = capturarLayoutDesdeTabla();
    estadoModulo.hayCambios = false;
    estadoModulo.editMode = true;
    aplicarModoEdicionEnTabla();
    notificarCambios();
  };

  const cancelarEdicion = () => {
    if (!estadoModulo.editMode) return;
    restablecerDesdeSnapshot(estadoModulo.editSnapshot);
    estadoModulo.hayCambios = false;
    estadoModulo.editMode = false;
    aplicarModoEdicionEnTabla();
    notificarCambios();
    ocultarMenuContextual();
    const empresa = Sesion.obtenerEmpresaActiva();
    if (estadoModulo.layoutSnapshot && empresa?.id && Number.isInteger(estadoModulo.anio)) {
      guardarLayoutLocal({
        layout: estadoModulo.layoutSnapshot,
        moduloClave: estadoModulo.moduloClave,
        empresaId: empresa.id,
        anio: estadoModulo.anio
      });
      renderizarTabla({
        moduloId: estadoModulo.moduloId,
        tablaSelector: estadoModulo.tabla ? `#${estadoModulo.tabla.id}` : undefined,
        totalColumnas: estadoModulo.tabla ? contarColumnas(estadoModulo.tabla) : undefined
      });
    }
  };

  const finalizarEdicion = () => {
    if (!estadoModulo.editMode) return;
    estadoModulo.editMode = false;
    aplicarModoEdicionEnTabla();
    ocultarMenuContextual();
  };

  const obtenerHojaDatos = (nombre, dataset) => {
    if (!nombre) {
      return null;
    }
    const claves = new Set([nombre]);
    if (nombre.includes('&')) {
      claves.add(nombre.replace(/&/g, '&amp;'));
    }
    for (const clave of claves) {
      if (dataset[clave]) {
        return dataset[clave];
      }
    }
    return null;
  };

  /**
   * Función principal que renderiza/pinta la tabla completa de un módulo
   * 
   * Esta es la función maestra que coordina todo el proceso de renderizado:
   * 
   * FLUJO DE RENDERIZADO:
   * 1. Validación inicial: verifica que exista tabla y tbody
   * 2. Configuración de módulo: identifica qué módulo renderizar (Finanzas, Dirección, etc.)
   * 3. Carga de datos: obtiene cuentas desde CUENTAS_POR_MODULO o Firebird (Presupuestos)
   * 4. Filtrado: filtra cuentas por capitulo/empresa seleccionada
   * 5. Layout personalizado: busca layouts guardados con secciones personalizadas
   * 6. Renderizado de secciones: llama a renderizarSecciones() para crear filas
   * 7. Filas de suma: agrega sum-row, sumavarios, result-row según configuración
   * 8. Carga de valores: obtiene datos de Firebird para llenar las celdas
   * 9. Recálculo: ejecuta recalcularSumas() para actualizar totales
   * 
   * TIPOS DE FILA:
   * - fila-cuenta: Fila normal con datos de una cuenta contable
   * - sum-row: Suma de todas las cuentas de una sección
   * - sum-row-sumavarios: Suma de varios sum-rows agrupados
   * - result-row: Resultado final (ej: "Resultado Presupuestos")
   * 
   * @param {Object} opciones - Configuración de renderizado
   * @param {string} opciones.tablaSelector - Selector CSS de la tabla
   * @param {number} opciones.totalColumnas - Número total de columnas
   * @param {string} opciones.moduloId - ID del módulo a renderizar
   * @param {string} opciones.sheet - Hoja de datos a usar
   * @returns {Promise<boolean>} true si renderizó exitosamente, false si falló
   */
  const renderizarTabla = async (opciones = {}) => {
    const tabla = obtenerTabla(opciones.tablaSelector);
    const cuerpo = tabla?.querySelector('tbody');
    if (!tabla || !cuerpo) {
      return Promise.resolve(false);
    }
    estadoModulo.editMode = false;
    estadoModulo.hayCambios = false;
    estadoModulo.editSnapshot = null;
    estadoModulo.layoutSnapshot = null;
    destruirTooltips();

    const columnas = Number(opciones.totalColumnas) || contarColumnas(tabla);
    const placeholdersPorFila = Math.max(0, columnas - 2);
    estadoModulo.placeholdersPorFila = placeholdersPorFila;

    const { moduloId, moduloSheet } = obtenerConfigModulo();
    const moduloNormalizado = (opciones.moduloId || moduloId || '').toString().trim();
    const moduloClave = normalizarModuloClave(moduloNormalizado || moduloId);
    const sheetPorConfig = window.CapitulosModulos?.obtenerSheetPorModulo
      ? window.CapitulosModulos.obtenerSheetPorModulo(moduloNormalizado)
      : null;
    const sheetConfigurada = opciones.sheet || moduloSheet || sheetPorConfig || moduloNormalizado;
    const dataset = window.CUENTAS_POR_MODULO || {};
    let hoja = obtenerHojaDatos(sheetConfigurada, dataset);
    limpiarBody(cuerpo);
    compilarCatalogoGlobal();

    const anioSeleccionTemp = obtenerAnioSeleccionado();
    const anioSeleccionado = Number.isInteger(anioSeleccionTemp) ? anioSeleccionTemp : estadoModulo.anio;
    const empresa = Sesion.obtenerEmpresaActiva();
    const empresaId = empresa?.id;
    const capituloDestino = window.CapitulosModulos?.obtenerCapituloPorEmpresa(empresaId) || null;
    const moduloHabilitado = window.CapitulosModulos?.moduloDisponible
      ? window.CapitulosModulos.moduloDisponible(empresaId, moduloNormalizado)
      : true;

    if (!moduloHabilitado) {
      cuerpo.appendChild(crearFilaEstado('El capitulo seleccionado no tiene esta vista asignada.', columnas));
      return Promise.resolve(false);
    }

    if ((!hoja || !Array.isArray(hoja)) && moduloClave === 'presupuestos' && capituloDestino) {
      const anioPresupuesto = obtenerAnioSeleccionado() || new Date().getFullYear();
      const cuentasPresupuesto = await cargarCuentasPresupuestos({ anio: anioPresupuesto });
      const cuentasFiltradas = cuentasPresupuesto.filter((registro) =>
        esCuentaPresupuestoValida(registro.cuentaVisible || registro.cuenta21 || registro.cuenta)
      );
      if (cuentasFiltradas.length) {
        hoja = cuentasFiltradas
          .map((registro) => ({
            capitulo: capituloDestino,
            seccion: 'Presupuestos',
            cuenta: registro.cuentaVisible || '',
            nombre: registro.nombre || ''
          }))
          .filter((registro) => registro.cuenta);
      }
    }

    if (!hoja || !Array.isArray(hoja) || !capituloDestino) {
      cuerpo.appendChild(crearFilaEstado('No hay informacion disponible para esta vista.', columnas));
      return Promise.resolve(false);
    }

    const objetivo = normalizarTexto(capituloDestino);
    let registros = hoja.filter((registro) => normalizarTexto(registro.capitulo) === objetivo);
    if (moduloClave === 'presupuestos') {
      registros = registros.filter((registro) => {
        if (!registro?.cuenta) return true;
        return esCuentaPresupuestoValida(registro.cuenta);
      });
    }
    let sumasPersonalizadas = null;
    let resultadoForzado = '';
    let layoutPersonalizado = null;

    if (esModuloEditable(moduloClave) && Number.isInteger(anioSeleccionado)) {
      const layoutGuardado = cargarLayoutLocal({
        moduloClave,
        empresaId,
        anio: anioSeleccionado
      });
      if (validarLayout(layoutGuardado)) {
        layoutPersonalizado = layoutGuardado;
        const registrosDesdeLayout = construirRegistrosDesdeLayout(layoutGuardado, capituloDestino);
        if (registrosDesdeLayout.length) {
          registros = registrosDesdeLayout;
          sumasPersonalizadas = construirSumasDesdeLayout(layoutGuardado);
          resultadoForzado = layoutGuardado.resultRow || '';
        }
      }
    }

    if (!registros.length) {
      cuerpo.appendChild(crearFilaEstado('El capitulo no tiene cuentas configuradas en el libro.', columnas));
      return Promise.resolve(false);
    }

    const cuentasCapitulo = registros
      .map((registro) => convertirCuenta21(registro.cuenta || ''))
      .filter(Boolean);
    unificarCuentasDisponibles(registros.map((registro) => registro.cuenta).filter((cuenta) => (cuenta || '').trim()), {
      anio: anioSeleccionado
    });
    if (empresaId && cuentasCapitulo.length && moduloClave !== 'presupuestos') {
      const anioNombres = obtenerAnioSeleccionado() || new Date().getFullYear();
      await cargarNombresCuentas({ empresaId, anio: anioNombres, cuentas: cuentasCapitulo });
    }

    estadoModulo.sumas = { secciones: [], sumavariosRows: new Map(), resultRows: new Map() };
    const pendientes = renderizarSecciones({
      registros,
      cuerpo,
      placeholdersPorFila,
      sheetName: sheetConfigurada,
      capitulo: capituloDestino,
      sumasPersonalizadas,
      resultadoForzado,
      mostrarCuentaVisible: moduloClave === 'presupuestos'
    });
    if (moduloClave === 'presupuestos' && pendientes?.sumasSecciones && !layoutPersonalizado) {
      const claveResultado = normalizarTexto('Resultado Presupuestos');
      pendientes.sumasSecciones.forEach((seccion) => {
        seccion.resultRowTexto = claveResultado;
      });
      if (!pendientes.resultadoFilas.length) {
        pendientes.resultadoFilas.push({ texto: 'Resultado Presupuestos', clase: 'result-row' });
      }
    }

    estadoModulo.sumas.sumavariosRows = new Map();
    pendientes.sumavarios.forEach((info, clave) => {
      if (!info?.meta) return;
      const filaSumario = agregarFilaResumen({
        texto: info.texto,
        clase: 'sum-row-sumavarios',
        cuerpo,
        placeholdersPorFila
      });
      if (filaSumario) {
        estadoModulo.sumas.sumavariosRows.set(normalizarTexto(clave), filaSumario);
        const referencia =
          info.meta.elementos.sumRow ||
          info.meta.filasCuenta[info.meta.filasCuenta.length - 1] ||
          cuerpo.lastChild;
        if (referencia && referencia.parentNode) {
          referencia.parentNode.insertBefore(filaSumario, referencia.nextSibling);
        }
      }
    });

    pendientes.resultadoFilas.forEach((fila) => {
      const resultadoFila = agregarFilaResumen({
        texto: fila.texto,
        clase: fila.clase,
        cuerpo,
        placeholdersPorFila
      });
      if (resultadoFila) {
        estadoModulo.sumas.resultRows.set(normalizarTexto(fila.texto), resultadoFila);
      }
    });

    estadoModulo.sumas.secciones = pendientes.sumasSecciones;
    estadoModulo.capitulo = capituloDestino || '';
    estadoModulo.layoutEsPersonalizado = Boolean(layoutPersonalizado);
    estadoModulo.layoutActual = construirLayoutDesdeMeta({
      seccionesMeta: pendientes.sumasSecciones,
      resultadoFilas: pendientes.resultadoFilas,
      placeholdersPorFila,
      capitulo: capituloDestino
    });
    estadoModulo.tabla = tabla;
    estadoModulo.columnas = construirMapaColumnas(tabla);
    estadoModulo.moduloId = moduloNormalizado;
    estadoModulo.moduloClave = moduloClave;
    estadoModulo.sheet = sheetConfigurada;
    if (Number.isInteger(anioSeleccionado)) {
      estadoModulo.anio = anioSeleccionado;
    }
    poblarSugerenciasDesdeAnio(estadoModulo.anio);
    cargarCatalogoCompleto({ anio: estadoModulo.anio }).then((lista) =>
      unificarCuentasDisponibles(lista || [], { anio: estadoModulo.anio })
    );
    const anioNombres = obtenerAnioSeleccionado() || new Date().getFullYear();
    if (pendientes.faltantesNombre?.length && empresaId) {
      cargarNombresCuentas({ empresaId, anio: anioNombres, cuentas: pendientes.faltantesNombre });
    }
    solicitarDatos();
    activarTooltipsCuentas();
    aplicarModoEdicionEnTabla();
    habilitarEdicionTextoBasica();

    // Actualizar SeccionCollapse después de renderizar la tabla
    if (window.SeccionCollapse && typeof window.SeccionCollapse.actualizar === 'function') {
      setTimeout(() => {
        window.SeccionCollapse.actualizar();
      }, 100);
    }

    if (!moduloReadyDispatched) {
      moduloReadyDispatched = true;
      window.dispatchEvent(new CustomEvent('modulo:ready', {
        detail: {
          modulo: estadoModulo.moduloClave || estadoModulo.moduloId || '',
          anio: estadoModulo.anio
        }
      }));
    }

    return Promise.resolve(true);
  };

  const crearInstancia = (opciones) => {
    const config = { ...(opciones || {}) };
    let destruido = false;
    const ejecutar = () => {
      if (destruido) return Promise.resolve(false);
      return renderizarTabla(config).then((resultado) => {
        window.dispatchEvent(new CustomEvent(EVENTO_TABLA_ACTUALIZADA));
        return resultado;
      });
    };
    const ready = ejecutar();
    const listener = () => {
      ejecutar();
    };
    window.addEventListener(Sesion.EVENTO_EMPRESA, listener);
    const contextoListener = (evento) => {
      const moduloEvento = normalizarModuloClave(evento?.detail?.modulo || '');
      const moduloActual = estadoModulo.moduloClave;
      if (moduloEvento && moduloEvento !== moduloActual) {
        return;
      }
      const anioEvento = Number(evento?.detail?.anio);
      if (Number.isInteger(anioEvento)) {
        estadoModulo.anio = anioEvento;
        poblarSugerenciasDesdeAnio(anioEvento);
      }
      solicitarDatos();
    };
    window.addEventListener(EVENTO_CONTEXTO, contextoListener);
    return {
      ready,
      refresh: ejecutar,
      setEditMode(flag) {
        if (flag) {
          iniciarEdicion();
        } else {
          finalizarEdicion();
        }
      },
      cancelEdit() {
        cancelarEdicion();
      },
      destroy() {
        destruido = true;
        window.removeEventListener(Sesion.EVENTO_EMPRESA, listener);
        window.removeEventListener(EVENTO_CONTEXTO, contextoListener);
        destruirTooltips();
      }
    };
  };

  window.CuentasModulo = {
    init: crearInstancia,
    render: renderizarTabla,
    setEditMode(flag) {
      if (flag) {
        iniciarEdicion();
      } else {
        finalizarEdicion();
      }
    },
    cancelEdit() {
      cancelarEdicion();
    },
    guardarLayout() {
      return persistirLayoutActual();
    },
    guardarBorradorLocal() {
      return persistirLayoutActual();
    },
    cargarBorradorLocal() {
      const empresa = Sesion.obtenerEmpresaActiva();
      const anioSeleccionado = Number.isInteger(estadoModulo.anio) ? estadoModulo.anio : null;
      if (!empresa?.id || !anioSeleccionado || !estadoModulo.moduloClave) {
        return null;
      }
      return cargarLayoutLocal({
        moduloClave: estadoModulo.moduloClave,
        empresaId: empresa.id,
        anio: anioSeleccionado
      });
    },
    getCambios() {
      return obtenerCambiosPendientes();
    }
  };
})();
  const normalizarCuentaBase = (cuenta) => {
    if (!cuenta) return '';
    return cuenta.toString().replace(/[^0-9A-Za-z]/g, '').toUpperCase().trim();
  };

  const deducirNivel = (baseVisible) => {
    const visible = normalizarCuentaBase(baseVisible).slice(0, 11).padEnd(11, '0');
    const b = visible.slice(3, 6);
    const c = visible.slice(6, 9);
    const d = visible.slice(9, 11);
    if (b === '000' && c === '000' && d === '00') return '1';
    if (c === '000' && d === '00') return '2';
    if (d === '00') return '3';
    return '4';
  };

  const convertirCuenta21 = (cuentaLegible) => {
    const entrada = normalizarCuentaBase(cuentaLegible);
    if (!entrada) return '';

    // Si ya viene en formato COI de 21 caracteres, respétalo.
    if (entrada.length >= 21) {
      return entrada.slice(0, 21);
    }

    // Usa la conversión compartida si está disponible en la vista.
    if (typeof window.cuentaLarga === 'function') {
      const desdeVista = window.cuentaLarga(entrada);
      if (desdeVista) return desdeVista;
    }

    const visible = entrada.slice(0, 11).padEnd(11, '0');
    const nivel = deducirNivel(visible);
    return visible.padEnd(20, '0') + nivel;
  };
