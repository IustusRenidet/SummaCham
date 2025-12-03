(() => {
  const API_BASE = 'http://localhost:3000/api';
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
      }
      .section-modal__overlay {
        position: absolute;
        inset: 0;
        background: rgba(0,0,0,0.35);
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
    addAccountBtn.addEventListener('click', () => {
      accountsContainer.appendChild(crearCampoCuentaFormulario());
    });
  };

  const cerrarModalSeccion = () => {
    if (!sectionModalInstance) return;
    sectionModalInstance.hidden = true;
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
      cancelBtn: sectionModalInstance.querySelector('#sectionModalCancel')
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

  const recalcularTotalesFilaPresupuesto = (fila) => {
    if (!fila) return;
    const cuenta = fila.dataset.cuenta21 || '';
    const almacen = estadoModulo.valoresPorCuenta.get(cuenta) || {};
    let totalPresupuesto = 0;
    MESES.forEach((mes) => {
      totalPresupuesto += Number(almacen[`budget-${mes}`]) || 0;
    });
    if (estadoModulo.columnas['total-budget'] != null) {
      const celdaTotal = fila.cells[estadoModulo.columnas['total-budget']];
      if (celdaTotal) {
        celdaTotal.textContent = formatearNumero(totalPresupuesto);
      }
    }
    if (estadoModulo.columnas['budget-annual'] != null) {
      const celdaAnnual = fila.cells[estadoModulo.columnas['budget-annual']];
      if (celdaAnnual) {
        celdaAnnual.textContent = formatearNumero(totalPresupuesto);
      }
    }
    if (estadoModulo.columnas['budget-monthly'] != null) {
      const celdaMensual = fila.cells[estadoModulo.columnas['budget-monthly']];
      if (celdaMensual) {
        const mensual = totalPresupuesto / 12;
        celdaMensual.textContent = formatearNumero(mensual);
      }
    }
    almacen['total-budget'] = totalPresupuesto;
    almacen['budget-annual'] = totalPresupuesto;
    almacen['budget-monthly'] = totalPresupuesto / 12;
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
    obtenerFilasCuenta().forEach((fila) => {
      const cuenta = fila.dataset.cuenta21 || '';
      const registro = mapa.get(cuenta);
      let totalPresupuesto = 0;
      const almacen = {};
      MESES.forEach((mes) => {
        const presupuesto = numeroSeguro(registro?.presupuesto?.[mes]);
        const real = numeroSeguro(registro?.real?.[mes]);
        totalPresupuesto += presupuesto;
        establecerValorCelda(fila, `budget-${mes}`, presupuesto);
        establecerValorCelda(fila, `real-${mes}`, real);
        almacen[`budget-${mes}`] = presupuesto;
        almacen[`real-${mes}`] = real;
      });
      // Real acumulado: usar el valor de diciembre (mes 12) tal cual viene en real.
      const totalRealConAjuste = numeroSeguro(
        registro?.real?.dic_acum ?? registro?.real?.dic ?? registro?.real?.['dic']
      );
      establecerValorCelda(fila, 'total-budget', totalPresupuesto);
      establecerValorCelda(fila, 'total-real', totalRealConAjuste);
      establecerValorCelda(fila, 'budget-annual', totalPresupuesto);
      establecerValorCelda(fila, 'budget-monthly', totalPresupuesto / 12);
      almacen['total-budget'] = totalPresupuesto;
      almacen['budget-annual'] = totalPresupuesto;
      almacen['budget-monthly'] = totalPresupuesto / 12;
      almacen['total-real'] = totalRealConAjuste;
      estadoModulo.valoresPorCuenta.set(cuenta, almacen);
    });
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
    const cambiosNombres = [];
    const baseValores = estadoModulo.editSnapshot.valores || new Map();
    const baseNombres = estadoModulo.editSnapshot.nombres || new Map();

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

    estadoModulo.nombresPorCuenta.forEach((nombre, cuenta) => {
      const anterior = baseNombres.get(cuenta) || '';
      if ((nombre || '') !== (anterior || '')) {
        cambiosNombres.push({ cuenta, nombre });
      }
    });

    return { presupuesto: cambiosPresupuesto, nombres: cambiosNombres };
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
        if (normalizarModuloClave(estadoModulo.moduloClave) === 'presupuestos') {
          const prefijo = Number.parseInt(canonica.slice(0, 3), 10);
          if (!Number.isFinite(prefijo) || prefijo < 400 || prefijo >= 800) {
            return;
          }
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

    // Módulo Presupuestos usa su propio origen de datos
    if (moduloClave === 'presupuestos') {
      const registrosPresupuesto = await cargarCuentasPresupuestos({ anio });
      if (!registrosPresupuesto.length) {
        limpiarValores();
        return;
      }
      const registros = registrosPresupuesto
        .filter((registro) => {
          const canonica = convertirCuenta21(registro.cuenta21 || registro.cuenta || registro.cuentaVisible || '');
          const prefijo = Number.parseInt((canonica || '').slice(0, 3), 10);
          return Number.isFinite(prefijo) && prefijo >= 400 && prefijo < 800;
        })
        .map((registro) => {
        const real = {};
        MESES.forEach((mes) => {
          real[mes] = Number(registro.real?.[mes]) || 0;
        });
        return {
          cuenta: registro.cuenta21 || registro.cuenta || '',
          presupuesto: registro.presupuesto || {},
          real
        };
      });
      contarSaldos(registros);
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

  const agregarFilaResumen = ({ texto, clase, cuerpo, placeholdersPorFila }) => {
    if (!texto) {
      return null;
    }
    const fila = document.createElement('tr');
    fila.className = clase;
    const celdaCuenta = document.createElement('td');
    celdaCuenta.textContent = '';
    fila.appendChild(celdaCuenta);
    const celdaDescripcion = document.createElement('td');
    celdaDescripcion.textContent = texto;
    fila.appendChild(celdaDescripcion);
    for (let i = 0; i < placeholdersPorFila; i += 1) {
      const celda = document.createElement('td');
      celda.className = 'budget-value';
      celda.textContent = '-';
      fila.appendChild(celda);
    }
    cuerpo.appendChild(fila);
    return fila;
  };

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
        celda.colSpan = placeholdersPorFila + 2;
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
        for (let i = 0; i < placeholdersPorFila; i += 1) {
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
          placeholdersPorFila
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
    if (!label || !Array.isArray(indices) || !indices.length || !estadoModulo.tabla) {
      return;
    }
    const clave = normalizarTexto(label);
    if (!clave) return;
    const cuerpo = estadoModulo.tabla.querySelector('tbody');
    if (!cuerpo) return;
    // Eliminar fila existente si hay
    const existente = estadoModulo.sumas.sumavariosRows.get(clave);
    if (existente && existente.parentNode) {
      existente.parentNode.removeChild(existente);
      estadoModulo.sumas.sumavariosRows.delete(clave);
    }
    const filaSumario = agregarFilaResumen({
      texto: label,
      clase: 'sum-row-sumavarios',
      cuerpo,
      placeholdersPorFila: estadoModulo.placeholdersPorFila
    });
    if (!filaSumario) return;
    estadoModulo.sumas.sumavariosRows.set(clave, filaSumario);
    const metas = indices
      .map((idx) => {
        const ajustado = idx >= insertIdx ? idx + 1 : idx;
        return estadoModulo.sumas.secciones[ajustado];
      })
      .filter(Boolean);
    metas.forEach((meta) => {
      meta.sumRowSumavariosLabel = clave;
      meta.sumRowSumavariosTexto = label;
    });
    const ultimaMeta = metas[metas.length - 1];
    const referencia =
      ultimaMeta?.elementos?.sumRow ||
      ultimaMeta?.filasCuenta?.[ultimaMeta.filasCuenta.length - 1] ||
      cuerpo.lastChild;
    if (referencia && referencia.parentNode) {
      referencia.parentNode.insertBefore(filaSumario, referencia.nextSibling);
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
    if (!estadoModulo.tabla) return;
    const cuerpo = estadoModulo.tabla.querySelector('tbody');
    if (!cuerpo) return;
    const seccionClave = normalizarTexto(titulo);
    const header = document.createElement('tr');
    header.className = 'section-header-row';
    const celdaHeader = document.createElement('td');
    celdaHeader.colSpan = estadoModulo.placeholdersPorFila + 2;
    celdaHeader.textContent = titulo;
    header.appendChild(celdaHeader);

    const cuentasFilas = cuentas.map((datos) => crearFilaCuentaDesdeDatos(datos, seccionClave));
    const textoSumRow = sumLabel || `Suma ${titulo}`;
    const filaSumRow = agregarFilaResumen({
      texto: textoSumRow,
      clase: 'sum-row',
      cuerpo,
      placeholdersPorFila: estadoModulo.placeholdersPorFila
    });

    const metaBase =
      referenciaFila?.classList.contains('sum-row-sumavarios') && obtenerMetaPorSumavariosFila(referenciaFila)
        ? obtenerMetaPorSumavariosFila(referenciaFila)
        : obtenerMetaSeccionPorFila(referenciaFila);
    const idxInsercion = metaBase ? obtenerIndiceInsercionSeccion(metaBase) : estadoModulo.sumas.secciones.length;
    const referenciaMeta = estadoModulo.sumas.secciones[idxInsercion] || estadoModulo.sumas.secciones[idxInsercion - 1] || null;

    let anchor =
      referenciaMeta?.elementos?.sumRow ||
      referenciaMeta?.filasCuenta?.[0] ||
      obtenerPrimerResultadoFila();
    if (!anchor) {
      anchor = cuerpo.lastElementChild?.nextSibling || null;
    }

    if (anchor) {
      cuerpo.insertBefore(header, anchor);
      cuentasFilas.forEach((fila) => cuerpo.insertBefore(fila, anchor));
      if (filaSumRow) {
        cuerpo.insertBefore(filaSumRow, anchor);
      }
    } else {
      cuerpo.appendChild(header);
      cuentasFilas.forEach((fila) => cuerpo.appendChild(fila));
      if (filaSumRow) {
        cuerpo.appendChild(filaSumRow);
      }
    }

    const metaNueva = {
      seccion: seccionClave,
      tituloVisible: titulo,
      filasCuenta: cuentasFilas,
      sumRowTexto: normalizarTexto(textoSumRow),
      sumRowSumavariosTexto: '',
      sumRowSumavarios2Texto: '',
      sumRowSumavariosLabel: '',
      elementos: {
        header,
        sumRow: filaSumRow
      }
    };

    estadoModulo.sumas.secciones.splice(idxInsercion, 0, metaNueva);

    if (sumavariosLabel && range) {
      const indices = [];
      for (let i = range.start; i <= range.end; i += 1) {
        indices.push(i);
      }
      actualizarSumavariosParaRango(sumavariosLabel, indices, idxInsercion);
    }

    actualizarEstructuraDespuesCambio();
  };

  const actualizarEstructuraDespuesCambio = () => {
    aplicarModoEdicionEnTabla();
    recalcularSumas();
    persistirLayoutActual();
    estadoModulo.hayCambios = true;
    notificarCambios();
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
    if (fila.classList.contains('fila-cuenta')) {
      const meta = obtenerMetaSeccionPorFila(fila);
      if (!meta) return;
      if ((meta.filasCuenta || []).length <= 1) {
        window.alert('La seccion debe tener al menos una cuenta.');
        return;
      }
      const cuenta = fila.dataset.cuenta21 || fila.dataset.cuenta;
      if (cuenta) {
        estadoModulo.valoresPorCuenta.delete(cuenta);
        estadoModulo.nombresPorCuenta.delete(cuenta);
      }
      fila.remove();
      const idx = meta.filasCuenta.indexOf(fila);
      if (idx >= 0) {
        meta.filasCuenta.splice(idx, 1);
      }
      actualizarEstructuraDespuesCambio();
      return;
    }
    if (fila.classList.contains('sum-row-sumavarios')) {
      let claveSumavarios = null;
      estadoModulo.sumas.sumavariosRows.forEach((valor, clave) => {
        if (valor === fila) {
          claveSumavarios = clave;
        }
      });
      if (claveSumavarios) {
        estadoModulo.sumas.sumavariosRows.delete(claveSumavarios);
        estadoModulo.sumas.secciones.forEach((seccion) => {
          if (normalizarClave(seccion.sumRowSumavariosLabel) === claveSumavarios) {
            seccion.sumRowSumavariosLabel = '';
            seccion.sumRowSumavariosTexto = '';
            seccion.sumRowSumavarios2Texto = '';
          }
        });
      }
      fila.remove();
      actualizarEstructuraDespuesCambio();
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
    if (fila.classList.contains('fila-cuenta')) {
      opciones.push({ clave: 'add_above', texto: 'Agregar cuenta arriba' });
      opciones.push({ clave: 'add_below', texto: 'Agregar cuenta abajo' });
      opciones.push({ clave: 'delete_row', texto: 'Eliminar fila' });
    } else if (fila.classList.contains('sum-row-sumavarios')) {
      opciones.push({ clave: 'delete_row', texto: 'Eliminar sum-row-sumavarios' });
    }
    opciones.push({ clave: 'add_section', texto: 'Agregar sección' });
    if (!opciones.length) return;
    evt.preventDefault();
    filaContextual = fila;
    mostrarMenuContextual(evt.pageX, evt.pageY, opciones);
  });

  const extraerValoresNumericos = (fila, inicio = 2) => {
    const valores = [];
    for (let i = inicio; i < fila.cells.length; i += 1) {
      const texto = (fila.cells[i].textContent || '').replace(/[^0-9+.,-]/g, '');
      const numero = Number(texto.replace(',', '.'));
      valores.push(Number.isFinite(numero) ? numero : 0);
    }
    return valores;
  };

  const asignarValoresNumericos = (fila, valores, inicio = 2) => {
    if (!fila || !Array.isArray(valores)) return;
    for (let i = inicio; i < fila.cells.length && i - inicio < valores.length; i += 1) {
      fila.cells[i].textContent = formatearNumero(valores[i - inicio]);
    }
  };

  const sumarListas = (listas = [], longitud = 0) => {
    const resultado = Array.from({ length: longitud }, () => 0);
    listas.forEach((lista) => {
      lista.forEach((valor, indice) => {
        resultado[indice] += Number(valor) || 0;
      });
    });
    return resultado;
  };

  const recalcularSumas = () => {
    const meta = estadoModulo.sumas;
    if (!meta || !meta.secciones.length) {
      return;
    }
    const clavesOrdenadas = Object.entries(estadoModulo.columnas || {})
      .sort((a, b) => a[1] - b[1])
      .map(([clave]) => clave)
      .filter((clave) => clave !== 'year');
    const longitud = clavesOrdenadas.length;
    if (!longitud) {
      return;
    }
    const secciones = meta.secciones;

    secciones.forEach((seccion) => {
      const valores = sumarListas(
        seccion.filasCuenta.map((fila) => {
          const cuenta = fila.dataset.cuenta21 || '';
          const almacenados = estadoModulo.valoresPorCuenta.get(cuenta);
          if (almacenados) {
            return clavesOrdenadas.map((clave) => almacenados[clave] ?? 0);
          }
          return extraerValoresNumericos(fila);
        }),
        longitud
      );
      seccion.sumValues = valores;
      if (seccion.elementos.sumRow) {
        asignarValoresNumericos(seccion.elementos.sumRow, valores);
      }
    });

    // sum-row-sumavarios: suma de los sum-row (sumValues) con la misma etiqueta
    const acumuladosSumavarios = new Map();
    secciones.forEach((seccion) => {
      const clave = normalizarClave(seccion.sumRowSumavariosTexto || seccion.sumRowSumavarios2Texto);
      if (!clave) return;
      const prev = acumuladosSumavarios.get(clave) || Array.from({ length: longitud }, () => 0);
      seccion.sumValues.forEach((valor, idx) => {
        prev[idx] += Number(valor) || 0;
      });
      acumuladosSumavarios.set(clave, prev);
    });
    secciones.forEach((seccion) => {
      const clave = normalizarClave(seccion.sumRowSumavariosTexto || seccion.sumRowSumavarios2Texto);
      if (!clave) return;
      const valores = acumuladosSumavarios.get(clave) || Array.from({ length: longitud }, () => 0);
      seccion.sumavariosValues = valores;
    });
    meta.sumavariosRows?.forEach((fila, clave) => {
      const valores = acumuladosSumavarios.get(clave) || Array.from({ length: longitud }, () => 0);
      asignarValoresNumericos(fila, valores);
    });

    // result-row: suma solamente los sum-row de todas las secciones con la misma etiqueta de resultado
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
    meta.resultRows.forEach((fila, clave) => {
      const valores = acumuladosResultado.get(clave) || Array.from({ length: longitud }, () => 0);
      asignarValoresNumericos(fila, valores);
    });
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

  const aplicarModoEdicionEnTabla = () => {
    if (!estadoModulo.tabla) return;
    if (!estadoModulo.editMode) {
      limpiarModoEdicionEnTabla();
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
      if (cuentasPresupuesto.length) {
        hoja = cuentasPresupuesto
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
