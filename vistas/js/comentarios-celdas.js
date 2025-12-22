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
    }
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
      position: absolute;
      min-width: 240px;
      max-width: 360px;
      padding: 12px 14px;
      background: #2f80ed;
      color: #fff;
      border-radius: 12px;
      box-shadow: 0 14px 30px rgba(0,0,0,0.18);
      transform: translateY(-50%);
      pointer-events: auto;
      border-left: 4px solid #1b5dbf;
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
    .comentario-callout__badge {
      padding: 2px 8px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.35);
      background: rgba(255,255,255,0.16);
      font-size: 0.75rem;
    }
    .comentario-callout.is-selected {
      box-shadow: 0 16px 32px rgba(15, 118, 178, 0.45);
      border-left-color: #0ea5e9;
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
      position: fixed;
      bottom: 120px;
      right: 16px;
      z-index: 1400;
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
    @media (max-width: 640px) {
      .comentarios-floating-btn {
        right: 12px;
        left: 12px;
        width: auto;
        justify-content: center;
      }
      .comentarios-modal {
        width: 96vw;
        max-width: 96vw;
        max-height: 75vh;
      }
    }
  `;
  document.head.appendChild(estilo);

  const API_BASE = (() => {
    if (window.location.protocol === 'file:') {
      return 'http://localhost:3005/api';
    }
    return `${window.location.origin.replace(/\/$/, '')}/api`;
  })();
  const TIME_ZONE = 'America/Mexico_City';

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
      return new Intl.DateTimeFormat('es-MX', {
        timeZone: TIME_ZONE,
        dateStyle: 'short',
        timeStyle: 'short',
        hour12: false
      }).format(fecha);
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
      const id = construirCeldaId(td);
      if (id) {
        mapa.set(id, td);
      }
    });
    return mapa;
  };

  const limpiarCallouts = () => {
    calloutsLayer.innerHTML = '';
    calloutsLayer.style.display = 'none';
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
      const ancho = callout.offsetWidth || 260;
      const espacioIzquierda = rect.left;
      const usarIzquierda = espacioIzquierda > ancho + 24;
      callout.classList.toggle('side-left', usarIzquierda);
      callout.classList.toggle('side-right', !usarIzquierda);
      const left = usarIzquierda
        ? rect.left - ancho - 14
        : rect.right + 14;
      callout.style.left = `${Math.max(8, left)}px`;
      callout.style.top = `${rect.top + rect.height / 2}px`;
      callout.style.display = 'block';
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
      const comentarios = Array.isArray(item.comentarios) ? item.comentarios : [];
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
      const badgeTexto = item.totalComentarios === 1
        ? '1 comentario'
        : `${item.totalComentarios || 0} comentarios`;
      const callout = document.createElement('div');
      callout.className = 'comentario-callout side-left';
      callout.dataset.celdaId = item.celdaId;
      callout.innerHTML = `
        <div class="comentario-callout__header">
          <span>${escaparHtml(item.ultimo?.autor?.usuario || 'Usuario')}</span>
          <span class="comentario-callout__badge">${badgeTexto}</span>
        </div>
        <div class="comentario-callout__lista">
          ${listaHtml || '<div class="comentario-callout__item">Sin comentarios</div>'}
        </div>
        <div class="comentario-callout__meta">
          <a href="#" class="link-light fw-bold" data-action="responder">Responder</a>
          <a href="#" class="link-light" data-action="ocultar" style="margin-left:auto;">Ocultar</a>
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
    const lista = comentarios.map((c) => ({
      id: c.id,
      texto: c.texto,
      estado: c.estado,
      creadoEn: c.creadoEn,
      parentId: c.parentId,
      autor: c.autor || {}
    }));
    const resumenItem = {
      celdaId,
      empresaId: state.empresaId,
      modulo: state.modulo,
      anio: state.anio,
      capitulo: state.capitulo,
      totalComentarios: lista.length,
      totalActivos: lista.filter((c) => c.estado === 'activo').length,
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
    refrescarContexto();
    refs.titulo.textContent = 'Comentarios de celda';
    refs.subtitulo.textContent = `${state.celdaLabel || 'Celda seleccionada'} - ${state.celdaId}`;
    actualizarSeleccionCallouts();
    scheduleRelayout();
  };


  const renderComentario = (comentario) => {
    const wrap = document.createElement('div');
    wrap.className = 'comentario-item';
    if (comentario.parentId) {
      wrap.classList.add('comentario-reply');
    }
    const estadoBadge = comentario.estado && comentario.estado !== 'activo'
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
        <button type="button" data-action="responder" data-id="${comentario.id}">Responder</button>
      </div>
    `;
    wrap.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.parentReply = comentario.id;
        refs.input.focus();
        refs.input.placeholder = `Responder a ${comentario.autor?.usuario || 'usuario'}...`;
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
      if (!res.ok) throw new Error('Error al actualizar comentario');
      await cargarComentarios();
      await refrescarVisorComentarios();
    } catch (error) {
      console.error(error);
      alert('No se pudo actualizar el comentario.');
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
    document.querySelectorAll('.comentario-celda-seleccionada').forEach((c) => {
      c.classList.remove('selected', 'comentario-celda-seleccionada');
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
    cuerpos.forEach((tbody) => {
      const filas = Array.from(tbody.rows || []);
      filas.forEach((fila, rIndex) => {
        const celdas = Array.from(fila.cells || []);
        celdas.forEach((td, cIndex) => {
          td.dataset.celdaId = construirCeldaId(td, rIndex, cIndex);
          td.dataset.celdaLabel = (td.innerText || '').trim().slice(0, 80);
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
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  };

  document.addEventListener('keydown', handleArrowNavigation);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', registrarCeldas);
    document.addEventListener('DOMContentLoaded', registrarListenerEjercicio);
  } else {
    registrarCeldas();
    registrarListenerEjercicio();
  }
  observarCambiosTabla();
})();
