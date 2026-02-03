(() => {
  const estilo = document.createElement('style');
  estilo.textContent = `
    .comentarios-fab-container {
      position: fixed;
      right: 16px;
      bottom: 18px;
      z-index: 1400;
      display: inline-flex;
      align-items: flex-end;
      gap: 10px;
      flex-wrap: wrap;
      justify-content: flex-end;
      max-width: calc(100% - 32px);
      padding: 4px;
      pointer-events: none;
    }
    .comentarios-fab-container > * { pointer-events: auto; }
    .comentarios-floating-btn {
      position: static;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      background: #1e3a8a;
      color: #fff;
      border: none;
      border-radius: 999px;
      box-shadow: 0 10px 24px rgba(0,0,0,0.22);
      font-weight: 700;
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .comentarios-floating-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 14px 30px rgba(0,0,0,0.25);
    }
    .comentarios-floating-btn i { font-size: 1.05rem; }
    .comentarios-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.25);
      z-index: 1400;
      display: none;
    }
    .comentarios-modal {
      position: fixed;
      z-index: 1401;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: min(520px, 94vw);
      max-height: 80vh;
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.25);
      display: none;
      flex-direction: column;
    }
    .comentarios-modal__header {
      padding: 14px 16px;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .comentarios-modal__body {
      padding: 12px 16px;
      overflow-y: auto;
      max-height: 60vh;
    }
    .comentarios-modal__footer {
      padding: 12px 16px;
      border-top: 1px solid #e5e7eb;
      display: flex;
      gap: 10px;
      align-items: center;
    }
    .comentario-item {
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 10px 12px;
      margin-bottom: 10px;
      background: #f8fafc;
    }
    .comentario-item .meta {
      font-size: 0.82rem;
      color: #475569;
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .comentario-item .texto {
      margin-top: 6px;
      white-space: pre-wrap;
      color: #0f172a;
    }
    .comentario-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 8px;
    }
    .comentario-actions button {
      border: none;
      border-radius: 8px;
      padding: 6px 10px;
      font-weight: 600;
      cursor: pointer;
      background: #e2e8f0;
      color: #0f172a;
    }
    .comentario-actions button.danger {
      background: #fee2e2;
      color: #b91c1c;
    }
    .comentario-actions button.warning {
      background: #fef3c7;
      color: #92400e;
    }
    .comentarios-input {
      flex: 1;
      border-radius: 10px;
      border: 1px solid #e2e8f0;
      padding: 10px;
      min-height: 42px;
    }
    .comentarios-modal__footer button {
      border: none;
      border-radius: 10px;
      padding: 10px 12px;
      background: #1e3a8a;
      color: #fff;
      font-weight: 700;
      cursor: pointer;
    }
    .comentario-reply {
      margin-left: 16px;
    }
    .comentarios-callouts-layer {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 4000;
    }
    .comentario-callout {
      position: fixed;
      min-width: 240px;
      max-width: 360px;
      padding: 12px 14px;
      background: #2f80ed;
      color: #fff;
      border-radius: 12px;
      box-shadow: 0 14px 30px rgba(0,0,0,0.18);
      pointer-events: auto;
      border-left: 4px solid #1b5dbf;
      border: 1px solid rgba(255,255,255,0.28);
      transition: transform 0.14s ease, box-shadow 0.18s ease;
    }
    .comentario-callout::after {
      content: '';
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      border-style: solid;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.25));
    }
    .comentario-callout.side-right::after {
      left: -10px;
      border-width: 8px 10px 8px 0;
      border-color: transparent #2f80ed transparent transparent;
    }
    .comentario-callout.side-left::after {
      right: -10px;
      border-width: 8px 0 8px 10px;
      border-color: transparent transparent transparent #2f80ed;
    }
    .comentario-callout__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-weight: 700;
      font-size: 0.88rem;
    }
    .comentario-callout__target {
      margin-top: 4px;
      font-size: 0.75rem;
      font-weight: 600;
      opacity: 0.92;
    }
    .comentario-callout__ubicacion {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      margin-top: 2px;
      font-size: 0.73rem;
      opacity: 0.88;
    }
    .comentario-callout__texto {
      margin-top: 4px;
      font-size: 0.85rem;
      line-height: 1.28;
      word-break: break-word;
    }
    .comentario-callout__lista {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-top: 6px;
    }
    .comentario-callout__item {
      padding: 8px 10px;
      border-radius: 10px;
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.16);
    }
    .comentario-callout__item .autor {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 700;
      font-size: 0.82rem;
    }
    .comentario-callout__item .autor i {
      opacity: 0.9;
    }
    .comentario-callout__item .texto {
      margin-top: 2px;
      font-size: 0.82rem;
      line-height: 1.26;
      word-break: break-word;
    }
    .comentario-callout__meta {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 4px;
      font-size: 0.76rem;
      opacity: 0.95;
    }
    .comentario-callout__acciones {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 8px;
      font-size: 0.78rem;
    }
    .comentario-callout__acciones a {
      color: rgba(255,255,255,0.96);
      text-decoration: none;
      font-weight: 700;
    }
    .comentario-callout__acciones a:hover,
    .comentario-callout__acciones a:focus {
      text-decoration: underline;
    }
    .comentario-callout__badge {
      padding: 2px 8px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.35);
      background: rgba(255,255,255,0.16);
      font-size: 0.75rem;
    }
    .comentario-callout__mini {
      display: none;
      align-items: center;
      gap: 6px;
      font-weight: 700;
      font-size: 0.75rem;
      white-space: nowrap;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .comentario-callout__mini i {
      font-size: 0.88rem;
      opacity: 0.95;
      flex: 0 0 auto;
    }
    .comentario-callout__mini span:first-of-type {
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .comentario-callout__mini-badge {
      margin-left: auto;
      padding: 1px 7px;
      border-radius: 999px;
      background: rgba(255,255,255,0.2);
      border: 1px solid rgba(255,255,255,0.35);
      font-size: 0.72rem;
      line-height: 1.3;
      flex: 0 0 auto;
    }
    .comentario-callout.is-mini {
      min-width: 0;
      max-width: min(220px, 82vw);
      padding: 7px 10px;
      border-radius: 999px;
      border-left-width: 0;
      border-color: rgba(255,255,255,0.28);
      background: #1f63c7;
      box-shadow: 0 10px 22px rgba(0,0,0,0.22);
    }
    .comentario-callout.is-mini::after {
      display: none;
    }
    .comentario-callout.is-mini .comentario-callout__header,
    .comentario-callout.is-mini .comentario-callout__target,
    .comentario-callout.is-mini .comentario-callout__ubicacion,
    .comentario-callout.is-mini .comentario-callout__lista,
    .comentario-callout.is-mini .comentario-callout__acciones {
      display: none;
    }
    .comentario-callout.is-mini .comentario-callout__mini {
      display: inline-flex;
    }
    .comentario-callout.is-selected {
      box-shadow: 0 16px 32px rgba(15, 118, 178, 0.45);
      border-left-color: #0ea5e9;
    }
    .comentario-callout.is-mini.is-selected {
      border-color: rgba(14,165,233,0.95);
      box-shadow: 0 14px 28px rgba(14,165,233,0.35);
    }
    .comentarios-toggle-visor {
      position: static;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      background: #e2e8f0;
      color: #0f172a;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      box-shadow: 0 10px 24px rgba(0,0,0,0.18);
      font-weight: 700;
      cursor: pointer;
    }
    .comentarios-toggle-visor.activo {
      background: #0b5ed7;
      color: #fff;
      border-color: #0b5ed7;
      box-shadow: 0 12px 28px rgba(11,94,215,0.35);
    }
    .comentarios-restore-btn {
      position: static;
      display: none;
      align-items: center;
      gap: 6px;
      padding: 8px 10px;
      background: #475569;
      color: #fff;
      border: 1px solid #334155;
      border-radius: 12px;
      box-shadow: 0 10px 24px rgba(0,0,0,0.18);
      font-weight: 700;
      cursor: pointer;
    }
    .comentario-celda-seleccionada {
      outline: 2px solid #0b5ed7;
      outline-offset: -2px;
      position: relative;
    }
    .comentario-celda-seleccionada::after {
      content: '';
      position: absolute;
      inset: 0;
      border: 2px solid rgba(11,94,215,0.2);
      pointer-events: none;
    }
    .comentario-celda-objetivo {
      outline: 2px dashed rgba(245,158,11,0.95);
      outline-offset: -2px;
      position: relative;
      z-index: 2;
    }
    body.comentarios-safe-area {
      padding-bottom: 110px;
    }
    @media (max-width: 640px) {
      .comentarios-fab-container {
        right: 10px;
        left: 10px;
        bottom: 12px;
        gap: 8px;
        justify-content: center;
      }
      .comentarios-floating-btn {
        padding: 9px 10px;
        font-size: 0.95rem;
        width: auto;
        justify-content: center;
        box-shadow: 0 8px 18px rgba(0,0,0,0.16);
      }
      .comentarios-floating-btn i {
        font-size: 1rem;
      }
      .comentarios-toggle-visor,
      .comentarios-restore-btn {
        padding: 9px 10px;
        font-size: 0.95rem;
        box-shadow: 0 8px 18px rgba(0,0,0,0.16);
      }
      body.comentarios-safe-area {
        padding-bottom: 160px;
      }
      .comentarios-modal {
        width: 96vw;
        max-width: 96vw;
        max-height: 75vh;
      }
    }
  `;
  document.head.appendChild(estilo);
  if (document.body) {
    document.body.classList.add('comentarios-safe-area');
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      document.body.classList.add('comentarios-safe-area');
    }, { once: true });
  }

  const API_BASE = (() => {
    if (window.location.protocol === 'file:') {
      return 'http://localhost:3005/api';
    }
    return `${window.location.origin.replace(/\/$/, '')}/api`;
  })();
  const SYSTEM_TIME_ZONE = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    } catch (_) {
      return null;
    }
  })();
  const DESTINO_COMENTARIO_KEY = 'panelamcham.comentarios.destino';
  const DESTINO_MAX_AGE_MS = 15 * 60 * 1000;
  const DISTANCIA_MINI_CALLOUT = 170;
  const normalizarClave = (valor = '') => valor
    .toString()
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/g, '');

  const obtenerModuloId = () => {
    const id = document.body?.dataset?.moduloId || document.body?.dataset?.modulo || 'MODULO';
    return id.toString().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  };

  const headersAuth = () => {
    const base = (window.Sesion?.headersAutenticacion?.() || {});
    const empresaId = window.Sesion?.obtenerEmpresaActiva?.()?.id;
    if (empresaId) {
      base['X-Empresa-Activa'] = empresaId;
    }
    base['Content-Type'] = 'application/json';
    return base;
  };

  const parsearFechaUtc = (valor) => {
    if (!valor) return null;
    const str = valor.toString();
    if (/Z|[+-]\d{2}:?\d{2}$/.test(str)) {
      return new Date(str);
    }
    const isoLike = str.includes('T') ? str : str.replace(' ', 'T');
    return new Date(`${isoLike}Z`);
  };

  const formatearFecha = (valor) => {
    try {
      const fecha = parsearFechaUtc(valor);
      if (!fecha || Number.isNaN(fecha.getTime())) return valor;
      const options = {
        dateStyle: 'short',
        timeStyle: 'short',
        hour12: false
      };
      if (SYSTEM_TIME_ZONE) {
        options.timeZone = SYSTEM_TIME_ZONE;
      }
      return new Intl.DateTimeFormat('es-MX', options).format(fecha);
    } catch (_) {
      return valor;
    }
  };

  const escaparHtml = (texto = '') => texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const obtenerAnioActivo = () => {
    const select = document.querySelector('select[id*="YearSelect"]');
    if (!select) return null;
    const val = Number(select.value);
    return Number.isInteger(val) ? val : null;
  };

  const construirCeldaId = (td, rowIndexOverride = null, colIndexOverride = null) => {
    const fila = td.parentElement;
    const tabla = td.closest('table');
    if (!tabla || !fila) return null;
    const rowIndex = rowIndexOverride !== null ? rowIndexOverride : Array.from(fila.parentElement.children).indexOf(fila);
    const colIndex = colIndexOverride !== null ? colIndexOverride : td.cellIndex;
    const modulo = obtenerModuloId();
    const empresaId = window.Sesion?.obtenerEmpresaActiva?.()?.id || 'EMPRESA';
    const anio = obtenerAnioActivo() || 'NA';
    const cuenta = fila.querySelector('td')?.innerText?.trim().replace(/\s+/g, ' ') || `row${rowIndex}`;
    return `${modulo}|${empresaId}|${anio}|r${rowIndex}|c${colIndex}|${cuenta}`;
  };

  const describirCelda = (celdaId = '') => {
    const partes = (celdaId || '').split('|');
    const filaRaw = (partes[3] || '').replace(/^r/i, '');
    const colRaw = (partes[4] || '').replace(/^c/i, '');
    const filaNum = Number.parseInt(filaRaw, 10);
    const colNum = Number.parseInt(colRaw, 10);
    const fila = Number.isFinite(filaNum) ? filaNum + 1 : null;
    const columna = Number.isFinite(colNum) ? colNum + 1 : null;
    const etiqueta = (partes.slice(5).join('|') || '').trim();
    return {
      etiqueta: etiqueta || 'Celda',
      ubicacion: (fila && columna) ? `Fila ${fila} · Col ${columna}` : 'Ubicación no disponible'
    };
  };

  const obtenerDestinoPendiente = () => {
    try {
      const raw = localStorage.getItem(DESTINO_COMENTARIO_KEY);
      if (!raw) return null;
      const payload = JSON.parse(raw);
      if (!payload || payload.tipo !== 'comentario' || !payload.celdaId) {
        localStorage.removeItem(DESTINO_COMENTARIO_KEY);
        return null;
      }
      const marcaTiempo = Number(payload.ts || payload.timestamp || 0);
      if (marcaTiempo && Date.now() - marcaTiempo > DESTINO_MAX_AGE_MS) {
        localStorage.removeItem(DESTINO_COMENTARIO_KEY);
        return null;
      }
      return payload;
    } catch (_) {
      try { localStorage.removeItem(DESTINO_COMENTARIO_KEY); } catch (e) { /* ignore */ }
      return null;
    }
  };

  const modalBackdrop = document.createElement('div');
  modalBackdrop.className = 'comentarios-modal-backdrop';
  const modal = document.createElement('div');
  modal.className = 'comentarios-modal';
  modal.innerHTML = `
    <div class="comentarios-modal__header">
      <div>
        <strong id="comentariosTitulo">Comentarios</strong>
        <div id="comentariosSubtitulo" class="text-muted small"></div>
      </div>
      <button type="button" id="comentariosCerrar" aria-label="Cerrar" style="border:none;background:transparent;font-size:1.2rem;">✕</button>
    </div>
    <div class="comentarios-modal__body">
      <div id="comentariosLista"></div>
    </div>
    <div class="comentarios-modal__footer">
      <textarea id="comentariosInput" class="comentarios-input" placeholder="Escribe un comentario..."></textarea>
      <div style="display:flex;flex-direction:column;gap:6px;">
        <button type="button" id="comentariosEnviar">Enviar</button>
        <button type="button" id="comentariosCancelar" class="btn btn-light">Cancelar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modalBackdrop);
  document.body.appendChild(modal);

  const calloutsLayer = document.createElement('div');
  calloutsLayer.className = 'comentarios-callouts-layer';
  calloutsLayer.style.display = 'none';
  document.body.appendChild(calloutsLayer);

  const state = {
    celdaId: null,
    celdaLabel: '',
    modulo: obtenerModuloId(),
    anio: obtenerAnioActivo(),
    empresaId: window.Sesion?.obtenerEmpresaActiva?.()?.id || null,
    capitulo: null,
    parentReply: null,
    visorActivo: false,
    resumenComentarios: [],
    modalAbierto: false,
    calloutsOcultos: new Set()
  };
  let selectedCell = null;
  let visorToggleBtn = null;
  let restoreCalloutsBtn = null;
  let celdaMap = new Map();
  let relayoutHandle = null;
  let listenersVisorActivos = false;
  let destinoPendienteTimer = null;
  let destinoPendienteIntentos = 0;

  const refs = {
    lista: modal.querySelector('#comentariosLista'),
    input: modal.querySelector('#comentariosInput'),
    btnEnviar: modal.querySelector('#comentariosEnviar'),
    btnCancelar: modal.querySelector('#comentariosCancelar'),
    titulo: modal.querySelector('#comentariosTitulo'),
    subtitulo: modal.querySelector('#comentariosSubtitulo')
  };

  const refrescarContexto = () => {
    state.anio = obtenerAnioActivo();
    state.empresaId = window.Sesion?.obtenerEmpresaActiva?.()?.id || null;
    state.capitulo = window.CapitulosModulos?.obtenerCapituloPorEmpresa?.(state.empresaId) || null;
  };

  const cerrarModal = () => {
    modal.style.display = 'none';
    modalBackdrop.style.display = 'none';
    state.parentReply = null;
    state.modalAbierto = false;
    if (state.visorActivo) {
      calloutsLayer.style.display = 'block';
      renderCallouts();
      scheduleRelayout();
    }
  };

  modal.querySelector('#comentariosCerrar').addEventListener('click', cerrarModal);
  modalBackdrop.addEventListener('click', cerrarModal);

  const abrirModal = ({ focusInput = false } = {}) => {
    modal.style.display = 'flex';
    modalBackdrop.style.display = 'block';
    state.modalAbierto = true;
    calloutsLayer.style.display = 'none';
    refrescarContexto();
    cargarComentarios();
    if (focusInput) {
      setTimeout(() => refs.input?.focus(), 30);
    }
  };

  const actualizarSeleccionCallouts = () => {
    calloutsLayer.querySelectorAll('.comentario-callout').forEach((node) => {
      node.classList.toggle('is-selected', node.dataset.celdaId === state.celdaId);
    });
  };

  const buildCeldaMap = () => {
    const mapa = new Map();
    document.querySelectorAll('.table-comparison tbody td').forEach((td) => {
      const id = td.dataset?.celdaId || construirCeldaId(td);
      if (id) {
        td.dataset.celdaId = id;
        mapa.set(id, td);
      }
    });
    return mapa;
  };

  const limpiarCallouts = () => {
    calloutsLayer.innerHTML = '';
    calloutsLayer.style.display = 'none';
    document.querySelectorAll('.comentario-celda-objetivo').forEach((celda) => {
      celda.classList.remove('comentario-celda-objetivo');
    });
  };

  const posicionarCallouts = () => {
    if (!state.visorActivo || !calloutsLayer.childElementCount) return;
    celdaMap = buildCeldaMap();
    calloutsLayer.querySelectorAll('.comentario-callout').forEach((callout) => {
      const celdaId = callout.dataset.celdaId;
      const td = celdaMap.get(celdaId);
      if (!td) {
        callout.style.display = 'none';
        return;
      }
      const rect = td.getBoundingClientRect();
      callout.style.display = 'block';
      callout.classList.remove('is-mini');
      const ancho = callout.offsetWidth || 260;
      const alto = callout.offsetHeight || 120;
      const clamp = (valor, minimo, maximo) => Math.min(Math.max(valor, minimo), maximo);
      const calcularPosicion = (usarIzquierda, anchoNodo, altoNodo) => {
        const leftBase = usarIzquierda
          ? rect.left - anchoNodo - 14
          : rect.right + 14;
        const left = clamp(leftBase, 8, Math.max(8, window.innerWidth - anchoNodo - 8));
        const topBase = rect.top + (rect.height - altoNodo) / 2;
        const top = clamp(topBase, 8, Math.max(8, window.innerHeight - altoNodo - 8));
        return { left, top };
      };
      let usarIzquierda = rect.left > ancho + 24;
      let pos = calcularPosicion(usarIzquierda, ancho, alto);
      const anchorX = usarIzquierda ? rect.left - 14 : rect.right + 14;
      const anchorY = rect.top + (rect.height / 2);
      const centerX = pos.left + (ancho / 2);
      const centerY = pos.top + (alto / 2);
      const desfase = Math.hypot(centerX - anchorX, centerY - anchorY);
      const celdaFueraDeViewport =
        rect.bottom < 0 ||
        rect.top > window.innerHeight ||
        rect.right < 0 ||
        rect.left > window.innerWidth;
      const mostrarMini = celdaFueraDeViewport || desfase > DISTANCIA_MINI_CALLOUT;

      if (mostrarMini) {
        callout.classList.add('is-mini');
        const anchoMini = callout.offsetWidth || 180;
        const altoMini = callout.offsetHeight || 34;
        if (rect.left > window.innerWidth) {
          usarIzquierda = true;
        } else if (rect.right < 0) {
          usarIzquierda = false;
        } else {
          usarIzquierda = rect.left > anchoMini + 24;
        }
        pos = calcularPosicion(usarIzquierda, anchoMini, altoMini);
      }

      callout.classList.toggle('side-left', usarIzquierda);
      callout.classList.toggle('side-right', !usarIzquierda);
      callout.style.left = `${pos.left}px`;
      callout.style.top = `${pos.top}px`;
      callout.classList.toggle('is-selected', celdaId === state.celdaId);
    });
  };

  const scheduleRelayout = () => {
    if (!state.visorActivo) return;
    if (relayoutHandle) return;
    relayoutHandle = requestAnimationFrame(() => {
      relayoutHandle = null;
      posicionarCallouts();
    });
  };

  const renderCallouts = () => {
    if (state.modalAbierto) return;
    if (!state.visorActivo) return;
    calloutsLayer.innerHTML = '';
    if (!state.resumenComentarios?.length) {
      calloutsLayer.style.display = 'none';
      if (restoreCalloutsBtn) restoreCalloutsBtn.style.display = 'none';
      return;
    }
    calloutsLayer.style.display = 'block';
    celdaMap = buildCeldaMap();
    state.resumenComentarios.forEach((item) => {
      if (state.calloutsOcultos.has(item.celdaId)) return;
      const td = celdaMap.get(item.celdaId);
      if (!td) return;
      const comentarios = Array.isArray(item.comentarios)
        ? item.comentarios.filter((c) => !c.estado || c.estado === 'activo')
        : [];
      if (!comentarios.length) return;
      const infoCelda = describirCelda(item.celdaId);
      const listaHtml = comentarios.map((c) => {
        const textoC = escaparHtml((c.texto || '').trim()).replace(/\n/g, '<br>');
        return `
          <div class="comentario-callout__item">
            <div class="autor"><i class="bi bi-person-circle"></i> ${escaparHtml(c.autor?.usuario || 'Usuario')}</div>
            <div class="texto">${textoC || 'Comentario sin texto'}</div>
            <div class="comentario-callout__meta">${formatearFecha(c.creadoEn)}</div>
          </div>
        `;
      }).join('');
      const badgeTexto = comentarios.length === 1
        ? '1 comentario'
        : `${comentarios.length || 0} comentarios`;
      const badgeMini = comentarios.length === 1 ? '1' : `${comentarios.length || 0}`;
      const callout = document.createElement('div');
      callout.className = 'comentario-callout side-left';
      callout.dataset.celdaId = item.celdaId;
      callout.title = 'Haz clic para abrir el comentario';
      callout.innerHTML = `
        <div class="comentario-callout__header">
          <span>${escaparHtml(item.ultimo?.autor?.usuario || 'Usuario')}</span>
          <span class="comentario-callout__badge">${badgeTexto}</span>
        </div>
        <div class="comentario-callout__target">${escaparHtml(infoCelda.etiqueta)}</div>
        <div class="comentario-callout__ubicacion"><i class="bi bi-geo-alt-fill"></i>${escaparHtml(infoCelda.ubicacion)}</div>
        <div class="comentario-callout__lista">
          ${listaHtml || '<div class="comentario-callout__item">Sin comentarios</div>'}
        </div>
        <div class="comentario-callout__acciones">
          <a href="#" class="link-light fw-bold" data-action="responder">Responder</a>
          <a href="#" class="link-light" data-action="ocultar" style="margin-left:auto;">Ocultar</a>
        </div>
        <div class="comentario-callout__mini">
          <i class="bi bi-chat-left-dots-fill"></i>
          <span>${escaparHtml(infoCelda.ubicacion)}</span>
          <span class="comentario-callout__mini-badge">${escaparHtml(badgeMini)}</span>
        </div>
      `;
      callout.querySelector('[data-action="responder"]').addEventListener('click', (e) => {
        e.preventDefault();
        const celda = celdaMap.get(item.celdaId);
        if (celda) {
          selectCell(celda, { openMenu: false, scroll: true });
        }
        abrirModal({ focusInput: true });
      });
      callout.querySelector('[data-action="ocultar"]').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        state.calloutsOcultos.add(item.celdaId);
        renderCallouts();
        scheduleRelayout();
        actualizarBotonRestaurar();
      });
      callout.addEventListener('click', (e) => {
        e.stopPropagation();
        const celda = celdaMap.get(item.celdaId);
        if (celda) {
          selectCell(celda, { openMenu: false, scroll: true });
        }
        abrirModal();
      });
      callout.addEventListener('mouseenter', () => {
        const celda = celdaMap.get(item.celdaId);
        if (celda) {
          celda.classList.add('comentario-celda-objetivo');
        }
      });
      callout.addEventListener('mouseleave', () => {
        const celda = celdaMap.get(item.celdaId);
        if (celda) {
          celda.classList.remove('comentario-celda-objetivo');
        }
      });
      calloutsLayer.appendChild(callout);
    });
    posicionarCallouts();
    actualizarBotonRestaurar();
  };

  const adjuntarListenersVisor = () => {
    if (listenersVisorActivos) return;
    document.addEventListener('scroll', scheduleRelayout, true);
    window.addEventListener('resize', scheduleRelayout);
    listenersVisorActivos = true;
  };

  const removerListenersVisor = () => {
    if (!listenersVisorActivos) return;
    document.removeEventListener('scroll', scheduleRelayout, true);
    window.removeEventListener('resize', scheduleRelayout);
    listenersVisorActivos = false;
  };

  const cargarResumenComentarios = async () => {
    if (!state.visorActivo) return;
    refrescarContexto();
    try {
      const params = new URLSearchParams({ modulo: state.modulo });
      if (state.anio) params.append('anio', state.anio);
      if (state.capitulo) params.append('capitulo', state.capitulo);
      const res = await fetch(`${API_BASE}/comentarios/resumen?${params.toString()}`, {
        headers: headersAuth(),
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Error al obtener resumen de comentarios');
      const data = await res.json();
      state.resumenComentarios = data.resumen || [];
      renderCallouts();
      scheduleRelayout();
    } catch (error) {
      state.resumenComentarios = [];
      limpiarCallouts();
      console.error(error);
    }
  };

  const refrescarVisorComentarios = async () => {
    if (!state.visorActivo) return;
    await cargarResumenComentarios();
  };

  const sincronizarResumenLocal = (celdaId, comentarios) => {
    if (!celdaId || !Array.isArray(comentarios)) return;
    const lista = comentarios
      .filter((c) => !c.estado || c.estado === 'activo')
      .map((c) => ({
      id: c.id,
      texto: c.texto,
      estado: c.estado,
      creadoEn: c.creadoEn,
      parentId: c.parentId,
      autor: c.autor || {}
      }));
    if (!lista.length) {
      state.resumenComentarios = state.resumenComentarios.filter((c) => c.celdaId !== celdaId);
      if (state.visorActivo && !state.modalAbierto) {
        renderCallouts();
        scheduleRelayout();
      }
      return;
    }
    const resumenItem = {
      celdaId,
      empresaId: state.empresaId,
      modulo: state.modulo,
      anio: state.anio,
      capitulo: state.capitulo,
      totalComentarios: lista.length,
      totalActivos: lista.length,
      comentarios: lista,
      ultimo: lista[lista.length - 1] || null
    };
    state.resumenComentarios = [
      ...state.resumenComentarios.filter((c) => c.celdaId !== celdaId),
      resumenItem
    ];
    if (state.visorActivo && !state.modalAbierto) {
      renderCallouts();
      scheduleRelayout();
    }
  };

  const actualizarBotonVisor = () => {
    if (!visorToggleBtn) return;
    visorToggleBtn.classList.toggle('activo', state.visorActivo);
    visorToggleBtn.innerHTML = state.visorActivo
      ? '<i class="bi bi-chat-left-quote-fill"></i> Ocultar globos'
      : '<i class="bi bi-chat-left-quote"></i> Ver globos';
  };

  const setVisorActivo = async (activo) => {
    if (state.visorActivo === activo) {
      actualizarBotonVisor();
      if (activo) {
        await cargarResumenComentarios();
        if (!state.resumenComentarios.length && state.celdaId) {
          await cargarComentarios();
        }
        renderCallouts();
        scheduleRelayout();
      }
      return;
    }
    state.visorActivo = activo;
    actualizarBotonVisor();
    if (activo) {
      calloutsLayer.style.display = 'block';
      adjuntarListenersVisor();
      await cargarResumenComentarios();
      if (!state.resumenComentarios.length && state.celdaId) {
        await cargarComentarios();
      }
      renderCallouts();
      scheduleRelayout();
    } else {
      state.resumenComentarios = [];
      limpiarCallouts();
      removerListenersVisor();
      state.calloutsOcultos = new Set();
      actualizarBotonRestaurar();
    }
  };

  const toggleVisorComentarios = async () => {
    await setVisorActivo(!state.visorActivo);
  };

  const actualizarBotonRestaurar = () => {
    if (!restoreCalloutsBtn) return;
    if (state.visorActivo && state.calloutsOcultos && state.calloutsOcultos.size > 0) {
      restoreCalloutsBtn.style.display = 'inline-flex';
      restoreCalloutsBtn.textContent = `Restaurar ${state.calloutsOcultos.size} globo${state.calloutsOcultos.size > 1 ? 's' : ''}`;
    } else {
      restoreCalloutsBtn.style.display = 'none';
    }
  };

  const restaurarCallouts = () => {
    state.calloutsOcultos = new Set();
    renderCallouts();
    scheduleRelayout();
    actualizarBotonRestaurar();
  };

  const setCeldaActual = (td) => {
    const celdaId = td.dataset?.celdaId || construirCeldaId(td);
    if (!celdaId) return;
    state.celdaId = celdaId;
    state.celdaLabel = td.dataset?.celdaLabel || td.innerText.trim().slice(0, 80);
    const descripcion = describirCelda(celdaId);
    refrescarContexto();
    refs.titulo.textContent = 'Comentarios de celda';
    refs.subtitulo.textContent = `${descripcion.etiqueta || state.celdaLabel || 'Celda seleccionada'} · ${descripcion.ubicacion}`;
    actualizarSeleccionCallouts();
    scheduleRelayout();
  };


  const renderComentario = (comentario) => {
    const wrap = document.createElement('div');
    wrap.className = 'comentario-item';
    if (comentario.parentId) {
      wrap.classList.add('comentario-reply');
    }
    const estado = (comentario.estado || 'activo').toString().toLowerCase();
    const estaActivo = estado === 'activo';
    const estadoBadge = estado && estado !== 'activo'
      ? `<span class="badge bg-secondary text-uppercase">${comentario.estado}</span>`
      : '';
    const textoPlano = escaparHtml(comentario.texto || '').replace(/\n/g, '<br>');
    wrap.innerHTML = `
      <div class="meta">
        <strong>${comentario.autor?.usuario || 'Usuario'}</strong>
        <span>${formatearFecha(comentario.creadoEn)}</span>
        ${estadoBadge}
      </div>
      <div class="texto">${textoPlano}</div>
      <div class="comentario-actions">
        ${estaActivo ? `<button type="button" data-action="responder" data-id="${comentario.id}">Responder</button>` : ''}
        ${estaActivo ? `<button type="button" class="warning" data-action="cerrar" data-id="${comentario.id}">Cerrar</button>` : ''}
      </div>
    `;
    wrap.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const accion = btn.dataset.action;
        if (accion === 'responder') {
          state.parentReply = comentario.id;
          refs.input.focus();
          refs.input.placeholder = `Responder a ${comentario.autor?.usuario || 'usuario'}...`;
          return;
        }
        if (accion === 'cerrar') {
          const confirmar = window.confirm('¿Cerrar este comentario? Ya no será visible para los demás usuarios.');
          if (!confirmar) return;
          actualizarEstado(comentario.id, 'descartado');
        }
      });
    });
    return wrap;
  };

  const cargarComentarios = async () => {
    if (!state.celdaId) return;
    refrescarContexto();
    refs.lista.innerHTML = '<p class="text-muted">Cargando comentarios...</p>';
    try {
      const params = new URLSearchParams({
        modulo: state.modulo,
        celdaId: state.celdaId
      });
      if (state.anio) params.append('anio', state.anio);
      if (state.capitulo) params.append('capitulo', state.capitulo);
      const res = await fetch(`${API_BASE}/comentarios?${params.toString()}`, {
        headers: headersAuth(),
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Error al obtener comentarios');
      const data = await res.json();
      const comentarios = data.comentarios || [];
      refs.lista.innerHTML = '';
      if (comentarios.length === 0) {
        refs.lista.innerHTML = '<p class="text-muted mb-0">Sin comentarios en esta celda.</p>';
        return;
      }
      comentarios.forEach((c) => refs.lista.appendChild(renderComentario(c)));
      sincronizarResumenLocal(state.celdaId, comentarios);
    } catch (error) {
      refs.lista.innerHTML = '<p class="text-danger mb-0">No fue posible cargar los comentarios.</p>';
      console.error(error);
    }
  };

  const enviarComentario = async () => {
    if (!state.celdaId) {
      alert('Selecciona una celda para comentar.');
      return;
    }
    const texto = refs.input.value.trim();
    if (!texto) return;
    const payload = {
      modulo: obtenerModuloId(),
      celdaId: state.celdaId,
      texto,
      anio: state.anio,
      empresaId: state.empresaId,
      capitulo: state.capitulo,
      parentId: state.parentReply || null
    };
    let res;
    try {
      res = await fetch(`${API_BASE}/comentarios`, {
        method: 'POST',
        headers: headersAuth(),
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        let mensaje = 'No se pudo enviar el comentario.';
        try {
          const data = await res.json();
          if (data?.mensaje) mensaje = data.mensaje;
        } catch (_) { /* ignore */ }
        if (res.status === 403) {
          mensaje = 'Sin permisos para comentar en este módulo.';
        } else if (res.status === 401) {
          mensaje = 'Sesión expirada. Ingresa de nuevo.';
        }
        alert(mensaje);
        throw new Error(mensaje);
      }
      refs.input.value = '';
      refs.input.placeholder = 'Escribe un comentario...';
      state.parentReply = null;
      await cargarComentarios();
      await refrescarVisorComentarios();
    } catch (error) {
      console.error(error);
      if (res?.ok === false) return;
      alert('No se pudo enviar el comentario.');
    }
  };

  const actualizarEstado = async (comentarioId, estado) => {
    try {
      const res = await fetch(`${API_BASE}/comentarios/${comentarioId}`, {
        method: 'PATCH',
        headers: headersAuth(),
        credentials: 'include',
        body: JSON.stringify({ estado })
      });
      if (!res.ok) {
        let mensaje = 'No se pudo actualizar el comentario.';
        try {
          const data = await res.json();
          if (data?.mensaje) {
            mensaje = data.mensaje;
          }
        } catch (_) { /* ignore */ }
        if (res.status === 403) {
          mensaje = 'Sin permisos para actualizar este comentario.';
        } else if (res.status === 401) {
          mensaje = 'Sesion expirada. Ingresa de nuevo.';
        }
        throw new Error(mensaje);
      }
      if (state.parentReply === comentarioId) {
        state.parentReply = null;
        refs.input.placeholder = 'Escribe un comentario...';
      }
      await cargarComentarios();
      await refrescarVisorComentarios();
    } catch (error) {
      console.error(error);
      alert(error?.message || 'No se pudo actualizar el comentario.');
    }
  };

  refs.btnEnviar.addEventListener('click', enviarComentario);
  refs.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviarComentario();
    }
  });
  refs.btnCancelar?.addEventListener('click', () => {
    refs.input.value = '';
    refs.input.placeholder = 'Escribe un comentario...';
    state.parentReply = null;
    cerrarModal();
  });

  if (!document.querySelector('.comentarios-toggle-visor')) {
    visorToggleBtn = document.createElement('button');
    visorToggleBtn.type = 'button';
    visorToggleBtn.className = 'comentarios-toggle-visor';
    visorToggleBtn.innerHTML = '<i class="bi bi-chat-left-quote"></i> Ver globos';
    visorToggleBtn.addEventListener('click', toggleVisorComentarios);
  } else {
    visorToggleBtn = document.querySelector('.comentarios-toggle-visor');
    visorToggleBtn.onclick = toggleVisorComentarios;
  }

  if (!document.querySelector('.comentarios-restore-btn')) {
    restoreCalloutsBtn = document.createElement('button');
    restoreCalloutsBtn.type = 'button';
    restoreCalloutsBtn.className = 'comentarios-restore-btn';
    restoreCalloutsBtn.textContent = 'Restaurar globos';
    restoreCalloutsBtn.addEventListener('click', restaurarCallouts);
  } else {
    restoreCalloutsBtn = document.querySelector('.comentarios-restore-btn');
    restoreCalloutsBtn.onclick = restaurarCallouts;
  }
  actualizarBotonVisor();
  setVisorActivo(false);

  // No duplicar botón
  let botonFlotante = document.querySelector('.comentarios-floating-btn');
  if (!botonFlotante) {
    botonFlotante = document.createElement('button');
    botonFlotante.type = 'button';
    botonFlotante.className = 'comentarios-floating-btn';
    botonFlotante.innerHTML = `<i class="bi bi-chat-dots"></i> Comentarios`;
    botonFlotante.addEventListener('click', () => {
      // Si no hay celda seleccionada, seleccionar la primera visible
      if (!state.celdaId) {
        const primera = document.querySelector('.table-comparison tbody td');
        if (primera) {
          selectCell(primera, { openMenu: false, scroll: false });
        }
      }
      abrirModal();
    });
  }

  // Contenedor flotante para agrupar los botones en la esquina inferior derecha
  let fabContainer = document.querySelector('.comentarios-fab-container');
  if (!fabContainer) {
    fabContainer = document.createElement('div');
    fabContainer.className = 'comentarios-fab-container';
    document.body.appendChild(fabContainer);
  }

  if (visorToggleBtn && !fabContainer.contains(visorToggleBtn)) {
    fabContainer.appendChild(visorToggleBtn);
  }
  if (botonFlotante && !fabContainer.contains(botonFlotante)) {
    fabContainer.appendChild(botonFlotante);
  }
  if (restoreCalloutsBtn && !fabContainer.contains(restoreCalloutsBtn)) {
    fabContainer.appendChild(restoreCalloutsBtn);
  }

  const selectCell = (td, { openMenu = true, scroll = true } = {}) => {
    if (!td) return;
    document.querySelectorAll('.comentario-celda-seleccionada, .comentario-celda-objetivo').forEach((c) => {
      c.classList.remove('selected', 'comentario-celda-seleccionada', 'comentario-celda-objetivo');
    });
    selectedCell = td;
    selectedCell.classList.add('selected', 'comentario-celda-seleccionada');
    selectedCell.setAttribute('tabindex', '-1');
    if (scroll) {
      selectedCell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    selectedCell.focus({ preventScroll: true });
    setCeldaActual(selectedCell);
    if (openMenu) {
      // No hay menú contextual de comentarios
    }
  };

  const aplicarDestinoComentarioPendiente = () => {
    destinoPendienteTimer = null;
    const destino = obtenerDestinoPendiente();
    if (!destino) {
      destinoPendienteIntentos = 0;
      return;
    }
    const moduloDestino = normalizarClave(destino.modulo || '');
    const moduloActual = normalizarClave(state.modulo || obtenerModuloId());
    if (moduloDestino && moduloDestino !== moduloActual) {
      return;
    }
    const empresaActiva = window.Sesion?.obtenerEmpresaActiva?.()?.id || null;
    if (destino.empresaId && empresaActiva && String(destino.empresaId) !== String(empresaActiva)) {
      return;
    }
    const anioDestino = Number.parseInt(destino.anio, 10);
    const selectYear = document.querySelector('select[id*="YearSelect"]');
    if (Number.isInteger(anioDestino) && selectYear && Number(selectYear.value) !== anioDestino) {
      const existeAnio = Array.from(selectYear.options || []).some((opt) => Number(opt.value) === anioDestino);
      if (existeAnio) {
        selectYear.value = String(anioDestino);
        selectYear.dispatchEvent(new Event('change', { bubbles: true }));
        if (destinoPendienteIntentos > 0) {
          destinoPendienteIntentos -= 1;
          setTimeout(() => {
            if (!destinoPendienteTimer) {
              destinoPendienteTimer = setTimeout(aplicarDestinoComentarioPendiente, 220);
            }
          }, 120);
        }
        return;
      }
    }
    registrarCeldas();
    celdaMap = buildCeldaMap();
    const celda = celdaMap.get(destino.celdaId);
    if (!celda) {
      if (destinoPendienteIntentos > 0) {
        destinoPendienteIntentos -= 1;
        destinoPendienteTimer = setTimeout(aplicarDestinoComentarioPendiente, 240);
      }
      return;
    }
    selectCell(celda, { openMenu: false, scroll: true });
    abrirModal();
    destinoPendienteIntentos = 0;
    try { localStorage.removeItem(DESTINO_COMENTARIO_KEY); } catch (e) { /* ignore */ }
  };

  const programarAplicacionDestino = (intentos = 12) => {
    const destino = obtenerDestinoPendiente();
    if (!destino) return;
    destinoPendienteIntentos = Math.max(destinoPendienteIntentos, intentos);
    if (destinoPendienteTimer) return;
    destinoPendienteTimer = setTimeout(aplicarDestinoComentarioPendiente, 180);
  };

  const findNextCell = (td, dir) => {
    const row = td?.parentElement;
    const table = td?.closest('table');
    if (!row || !table) return null;
    const rows = Array.from(table.querySelectorAll('tbody tr')).filter(r => r.offsetParent !== null);
    const rowIndex = rows.indexOf(row);
    if (rowIndex === -1) return null;
    const visibleCells = (r) => Array.from(r.querySelectorAll('td')).filter(c => c.offsetParent !== null);
    const cellList = visibleCells(row);
    const colIndex = cellList.indexOf(td);
    if (colIndex === -1) return null;
    if (dir === 'left' || dir === 'right') {
      const next = cellList[colIndex + (dir === 'left' ? -1 : 1)];
      return next || null;
    }
    let nextRowIndex = dir === 'up' ? rowIndex - 1 : rowIndex + 1;
    while (nextRowIndex >= 0 && nextRowIndex < rows.length) {
      const candidateRow = rows[nextRowIndex];
      const cells = visibleCells(candidateRow);
      if (cells[colIndex]) return cells[colIndex];
      nextRowIndex += dir === 'up' ? -1 : 1;
    }
    return null;
  };

  const handleArrowNavigation = (event) => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    if (event.target.closest('.comentarios-modal')) return;
    const tag = (event.target.tagName || '').toLowerCase();
    if (['input', 'textarea', 'select', 'button'].includes(tag)) return;
    if (event.target.isContentEditable) return;
    event.preventDefault();
    if (!selectedCell) {
      const primera = document.querySelector('table tbody td');
      if (primera) selectCell(primera, { openMenu: false, scroll: false });
      return;
    }
    const dirMap = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    const next = findNextCell(selectedCell, dirMap[event.key]);
    if (next) {
      selectCell(next, { openMenu: false });
    }
  };

  const registrarCeldas = () => {
    const cuerpos = Array.from(document.querySelectorAll('table tbody'));
    const scopeActual = `${window.Sesion?.obtenerEmpresaActiva?.()?.id || 'EMPRESA'}|${obtenerAnioActivo() || 'NA'}`;
    cuerpos.forEach((tbody) => {
      const filas = Array.from(tbody.rows || []);
      filas.forEach((fila, rIndex) => {
        const celdas = Array.from(fila.cells || []);
        celdas.forEach((td, cIndex) => {
          const scopeCambio = td.dataset.celdaScope !== scopeActual;
          if (!td.dataset.celdaId || scopeCambio) {
            td.dataset.celdaId = construirCeldaId(td, rIndex, cIndex);
            td.dataset.celdaScope = scopeActual;
          }
          if (!td.dataset.celdaLabel || scopeCambio) {
            td.dataset.celdaLabel = (td.innerText || '').trim().slice(0, 80);
          }
          if (!td.dataset.comentariosListener) {
            td.addEventListener('click', (e) => {
              e.stopPropagation();
              selectCell(td);
            });
            td.dataset.comentariosListener = '1';
          }
        });
      });
    });
  };

  const manejarCambioEjercicio = () => {
    refrescarContexto();
    state.calloutsOcultos = new Set();
    if (state.visorActivo) {
      setVisorActivo(true);
    } else {
      limpiarCallouts();
    }
    programarAplicacionDestino(10);
  };

  const registrarListenerEjercicio = () => {
    const selectYear = document.querySelector('select[id*="YearSelect"]');
    if (selectYear && !selectYear.dataset.comentariosListener) {
      selectYear.addEventListener('change', manejarCambioEjercicio);
      selectYear.dataset.comentariosListener = '1';
    }
  };

  const observarCambiosTabla = () => {
    let pendiente = null;
    const observer = new MutationObserver(() => {
      if (pendiente) return;
      pendiente = requestAnimationFrame(() => {
        pendiente = null;
        registrarCeldas();
        registrarListenerEjercicio();
        if (state.visorActivo) {
          scheduleRelayout();
        }
        programarAplicacionDestino(8);
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  };

  window.addEventListener('storage', (event) => {
    if (event.key !== DESTINO_COMENTARIO_KEY || !event.newValue) return;
    programarAplicacionDestino(14);
  });

  document.addEventListener('keydown', handleArrowNavigation);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      registrarCeldas();
      registrarListenerEjercicio();
      programarAplicacionDestino(14);
    });
  } else {
    registrarCeldas();
    registrarListenerEjercicio();
    programarAplicacionDestino(14);
  }
  observarCambiosTabla();
})();
