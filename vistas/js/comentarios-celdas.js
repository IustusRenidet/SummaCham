(() => {
  const estilo = document.createElement('style');
  estilo.textContent = `
    .comentarios-floating-btn {
      position: fixed;
      bottom: 18px;
      right: 16px;
      z-index: 1400;
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

  const headersAuth = () => {
    const base = (window.Sesion?.headersAutenticacion?.() || {});
    const empresaId = window.Sesion?.obtenerEmpresaActiva?.()?.id;
    if (empresaId) {
      base['X-Empresa-Activa'] = empresaId;
    }
    base['Content-Type'] = 'application/json';
    return base;
  };

  const formatearFecha = (valor) => {
    try {
      const fecha = new Date(valor);
      return fecha.toLocaleString('es-MX', { hour12: false });
    } catch (_) {
      return valor;
    }
  };

  const obtenerAnioActivo = () => {
    const select = document.querySelector('select[id*="YearSelect"]');
    if (!select) return null;
    const val = Number(select.value);
    return Number.isInteger(val) ? val : null;
  };

  const construirCeldaId = (td) => {
    const fila = td.parentElement;
    const tabla = td.closest('table');
    if (!tabla || !fila) return null;
    const rowIndex = Array.from(fila.parentElement.children).indexOf(fila);
    const colIndex = td.cellIndex;
    const modulo = (document.body?.dataset?.modulo || 'MODULO').toString().toUpperCase();
    const empresaId = window.Sesion?.obtenerEmpresaActiva?.()?.id || 'EMPRESA';
    const anio = obtenerAnioActivo() || 'NA';
    const cuenta = fila.querySelector('td')?.innerText?.trim().replace(/\s+/g, ' ') || 'row';
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
      <button type="button" id="comentariosEnviar">Enviar</button>
    </div>
  `;
  document.body.appendChild(modalBackdrop);
  document.body.appendChild(modal);

  const state = {
    celdaId: null,
    celdaLabel: '',
    modulo: (document.body?.dataset?.modulo || 'MODULO').toString().toUpperCase(),
    anio: obtenerAnioActivo(),
    empresaId: window.Sesion?.obtenerEmpresaActiva?.()?.id || null,
    capitulo: null,
    parentReply: null
  };
  let selectedCell = null;
  let actionMenu = null;

  const refs = {
    lista: modal.querySelector('#comentariosLista'),
    input: modal.querySelector('#comentariosInput'),
    btnEnviar: modal.querySelector('#comentariosEnviar'),
    titulo: modal.querySelector('#comentariosTitulo'),
    subtitulo: modal.querySelector('#comentariosSubtitulo')
  };

  const cerrarModal = () => {
    modal.style.display = 'none';
    modalBackdrop.style.display = 'none';
    state.parentReply = null;
  };

  modal.querySelector('#comentariosCerrar').addEventListener('click', cerrarModal);
  modalBackdrop.addEventListener('click', cerrarModal);

  const abrirModal = ({ focusInput = false } = {}) => {
    modal.style.display = 'flex';
    modalBackdrop.style.display = 'block';
    cargarComentarios();
    if (focusInput) {
      setTimeout(() => refs.input?.focus(), 30);
    }
  };

  const setCeldaActual = (td) => {
    const celdaId = construirCeldaId(td);
    if (!celdaId) return;
    state.celdaId = celdaId;
    state.celdaLabel = td.innerText.trim().slice(0, 80);
    state.anio = obtenerAnioActivo();
    state.empresaId = window.Sesion?.obtenerEmpresaActiva?.()?.id || null;
    state.capitulo = window.CapitulosModulos?.obtenerCapituloPorEmpresa?.(state.empresaId) || null;
    refs.titulo.textContent = 'Comentarios de celda';
    refs.subtitulo.textContent = `${state.celdaLabel || 'Celda seleccionada'} ú ${state.celdaId}`;
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
    wrap.innerHTML = `
      <div class="meta">
        <strong>${comentario.autor?.usuario || 'Usuario'}</strong>
        <span>${formatearFecha(comentario.creadoEn)}</span>
        ${estadoBadge}
      </div>
      <div class="texto">${comentario.texto}</div>
      <div class="comentario-actions">
        <button type="button" data-action="responder" data-id="${comentario.id}">Responder</button>
        <button type="button" class="warning" data-action="descartar" data-id="${comentario.id}">Descartar</button>
        <button type="button" class="danger" data-action="rechazar" data-id="${comentario.id}">Rechazar</button>
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
        } else if (accion === 'descartar' || accion === 'rechazar') {
          actualizarEstado(comentario.id, accion === 'descartar' ? 'descartado' : 'rechazado');
        }
      });
    });
    return wrap;
  };

  const cargarComentarios = async () => {
    if (!state.celdaId) return;
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
    } catch (error) {
      refs.lista.innerHTML = '<p class="text-danger mb-0">No fue posible cargar los comentarios.</p>';
      console.error(error);
    }
  };

  const enviarComentario = async () => {
    if (!state.celdaId) return;
    const texto = refs.input.value.trim();
    if (!texto) return;
    const payload = {
      modulo: state.modulo,
      celdaId: state.celdaId,
      texto,
      anio: state.anio,
      empresaId: state.empresaId,
      capitulo: state.capitulo,
      parentId: state.parentReply || null
    };
    try {
      const res = await fetch(`${API_BASE}/comentarios`, {
        method: 'POST',
        headers: headersAuth(),
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Error al enviar comentario');
      refs.input.value = '';
      refs.input.placeholder = 'Escribe un comentario...';
      state.parentReply = null;
      await cargarComentarios();
    } catch (error) {
      console.error(error);
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

  // No duplicar botón
  if (!document.querySelector('.comentarios-floating-btn')) {
    const botonFlotante = document.createElement('button');
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
    document.body.appendChild(botonFlotante);
  }

  const hideActionMenu = () => {
    if (actionMenu) {
      actionMenu.remove();
      actionMenu = null;
    }
  };

  const showActionMenu = (td) => {
    hideActionMenu();
    const rect = td.getBoundingClientRect();
    actionMenu = document.createElement('div');
    actionMenu.style.position = 'absolute';
    actionMenu.style.zIndex = '1500';
    actionMenu.style.background = '#fff';
    actionMenu.style.border = '1px solid #d9d9d9';
    actionMenu.style.boxShadow = '0 8px 20px rgba(0,0,0,0.18)';
    actionMenu.style.borderRadius = '10px';
    actionMenu.style.padding = '8px';
    actionMenu.style.display = 'flex';
    actionMenu.style.gap = '6px';
    actionMenu.style.fontSize = '0.9rem';
    actionMenu.innerHTML = `
      <button type="button" class="btn btn-sm btn-light" data-action="ver">Ver comentarios</button>
      <button type="button" class="btn btn-sm btn-primary" data-action="agregar">Agregar</button>
    `;
    document.body.appendChild(actionMenu);
    actionMenu.style.top = `${rect.bottom + window.scrollY + 4}px`;
    actionMenu.style.left = `${rect.left + window.scrollX}px`;
    actionMenu.querySelector('[data-action="ver"]').addEventListener('click', (e) => {
      e.stopPropagation();
      abrirModal();
      hideActionMenu();
    });
    actionMenu.querySelector('[data-action="agregar"]').addEventListener('click', (e) => {
      e.stopPropagation();
      abrirModal({ focusInput: true });
      hideActionMenu();
    });
  };

  const selectCell = (td, { openMenu = true, scroll = true } = {}) => {
    if (!td) return;
    if (selectedCell) {
      selectedCell.classList.remove('selected');
    }
    selectedCell = td;
    selectedCell.classList.add('selected');
    selectedCell.setAttribute('tabindex', '-1');
    if (scroll) {
      selectedCell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    selectedCell.focus({ preventScroll: true });
    setCeldaActual(selectedCell);
    if (openMenu) showActionMenu(selectedCell);
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
      const primera = document.querySelector('.table-comparison tbody td');
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
    const celdas = document.querySelectorAll('.table-comparison tbody td');
    celdas.forEach((td) => {
      td.addEventListener('click', (e) => {
        e.stopPropagation();
        selectCell(td);
      });
    });
  };

  document.addEventListener('keydown', handleArrowNavigation);
  document.addEventListener('click', (e) => {
    if (actionMenu && !actionMenu.contains(e.target)) {
      hideActionMenu();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', registrarCeldas);
  } else {
    registrarCeldas();
  }
})();
