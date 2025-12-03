(() => {
  const origin = window.location.protocol === 'file:' ? 'http://localhost:3000' : window.location.origin;
  const API_BASE = `${origin}/api`;
  const ESTADOS = ['EDITANDO', 'PENDIENTE', 'REVISADO', 'APROBADO', 'RECHAZADO', 'GUARDADO'];
  const META_ESTADOS = {
    EDITANDO: { texto: 'Editando', icono: 'bi-pencil-square', tono: 'warning' },
    PENDIENTE: { texto: 'Pendiente', icono: 'bi-send-check', tono: 'info' },
    REVISADO: { texto: 'Revisado', icono: 'bi-search-heart', tono: 'primary' },
    APROBADO: { texto: 'Aprobado', icono: 'bi-check2-circle', tono: 'success' },
    RECHAZADO: { texto: 'Rechazado', icono: 'bi-x-octagon', tono: 'danger' },
    GUARDADO: { texto: 'Guardado', icono: 'bi-database-check', tono: 'dark' }
  };

  const MAPA_VISTAS = {
    'Membresía': 'Membresía.html',
    'Serv Membresía': 'Serv_Membresía.html',
    'Comunicación': 'Comunicación.html',
    'Eventos': 'Eventos.html',
    'Dirección': 'Dirección.html',
    'Comités': 'Comités.html',
    'T&IC': 'T&IC.html',
    RH: 'RH.html',
    VPE: 'VPE.html',
    Finanzas: 'Finanzas.html',
    'Gtos Corporativos': 'Gtos_Corporativos.html',
    SUMMARY: 'SUMMARY.html',
    RESUMEN: 'RESUMEN.html',
    Presupuestos: 'Presupuestos.html'
  };

  const state = {
    borradores: [],
    seleccionado: null,
    filtros: {
      estados: new Set(['EDITANDO', 'PENDIENTE', 'REVISADO', 'APROBADO', 'RECHAZADO', 'GUARDADO']),
      empresaId: null,
      anio: null,
      busqueda: ''
    }
  };

  const ui = {
    filtroEmpresa: document.getElementById('filtroEmpresa'),
    filtroAnio: document.getElementById('filtroAnio'),
    filtroEstados: document.getElementById('filtroEstados'),
    filtroBusqueda: document.getElementById('filtroBusqueda'),
    listaBorradores: document.getElementById('listaBorradores'),
    totalBorradores: document.getElementById('totalBorradores'),
    totalRevisados: document.getElementById('totalRevisados'),
    totalAutorizados: document.getElementById('totalAutorizados'),
    detalleEstado: document.getElementById('detalleEstado'),
    detalleResumen: document.getElementById('detalleResumen'),
    detalleMeta: document.getElementById('detalleMeta'),
    historial: document.getElementById('historial'),
    accionRevisar: document.getElementById('accionRevisar'),
    accionAutorizar: document.getElementById('accionAutorizar'),
    accionRechazar: document.getElementById('accionRechazar'),
    accionGuardar: document.getElementById('accionGuardar'),
    accionVer: document.getElementById('accionVer'),
    btnRefrescar: document.getElementById('btnRefrescar'),
    toast: document.getElementById('gestionToast'),
    toastBody: document.getElementById('gestionToastBody')
  };

  const toastInstance = ui.toast ? bootstrap.Toast.getOrCreateInstance(ui.toast, { delay: 2600 }) : null;

  const notificar = (mensaje, tipo = 'info') => {
    if (!ui.toast || !ui.toastBody) return;
    ui.toast.className = `toast align-items-center text-bg-${tipo} border-0`;
    ui.toastBody.textContent = mensaje;
    toastInstance?.show();
  };

  const construirHeaders = () => ({
    'Content-Type': 'application/json',
    ...(window.Sesion?.headersAutenticacion?.() || {})
  });

  const fetchJson = async (url, opciones = {}) => {
    const respuesta = await fetch(url, {
      ...opciones,
      headers: { ...construirHeaders(), ...(opciones.headers || {}) }
    });
    const data = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) {
      const mensaje = data.mensaje || 'No fue posible completar la operación.';
      throw new Error(mensaje);
    }
    return data;
  };

  const formatearFecha = (valor) => {
    if (!valor) return 'Sin fecha';
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return valor;
    return fecha.toLocaleString('es-MX');
  };

  const crearChipEstado = (estado) => {
    const meta = META_ESTADOS[estado] || { texto: estado, icono: 'bi-flag', tono: 'secondary' };
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'btn btn-sm btn-chip btn-chip-outline';
    chip.dataset.estado = estado;
    chip.innerHTML = `<i class="bi ${meta.icono}"></i> ${meta.texto}`;
    chip.addEventListener('click', () => {
      if (state.filtros.estados.has(estado)) {
        state.filtros.estados.delete(estado);
        chip.classList.add('btn-chip-warning');
      } else {
        state.filtros.estados.add(estado);
        chip.classList.remove('btn-chip-warning');
      }
      cargarBorradores();
    });
    return chip;
  };

  const renderEstados = () => {
    ui.filtroEstados.innerHTML = '';
    ESTADOS.forEach((estado) => {
      const chip = crearChipEstado(estado);
      ui.filtroEstados.appendChild(chip);
    });
  };

  const renderResumen = (resumen = { total: 0, porEstado: {} }) => {
    ui.totalBorradores.textContent = resumen.total || 0;
    ui.totalRevisados.textContent = (resumen.porEstado.REVISADO || 0) + (resumen.porEstado.APROBADO || 0);
    ui.totalAutorizados.textContent = (resumen.porEstado.APROBADO || 0) + (resumen.porEstado.GUARDADO || 0);
  };

  const obtenerEmpresaActiva = () => {
    return window.Sesion?.obtenerEmpresaActiva?.() || null;
  };

  const poblarEmpresas = async () => {
    try {
      const respuesta = await fetchJson(`${API_BASE}/empresas`);
      const empresas = respuesta.empresas || [];
      ui.filtroEmpresa.innerHTML = empresas
        .map((empresa) => `<option value="${empresa.id}">${empresa.nombre}</option>`)
        .join('');
      const activa = obtenerEmpresaActiva();
      const valor = activa?.id || empresas[0]?.id || '';
      ui.filtroEmpresa.value = valor;
      state.filtros.empresaId = valor;
    } catch (error) {
      console.error(error);
      notificar(error.message, 'warning');
    }
  };

  const poblarAnios = () => {
    const actual = new Date().getFullYear();
    const opciones = [];
    for (let delta = -1; delta <= 2; delta += 1) {
      opciones.push(actual + delta);
    }
    ui.filtroAnio.innerHTML = opciones
      .map((anio) => `<option value="${anio}">${anio}</option>`)
      .join('');
    ui.filtroAnio.value = actual;
    state.filtros.anio = actual;
  };

  const badgeEstado = (estado) => {
    const meta = META_ESTADOS[estado] || { texto: estado, icono: 'bi-flag' };
    return `<span class="estado-badge" data-estado="${estado}"><i class="bi ${meta.icono}"></i> ${meta.texto}</span>`;
  };

  const renderBorradores = () => {
    if (!state.borradores.length) {
      ui.listaBorradores.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-5 text-muted">
            <i class="bi bi-inboxes me-2"></i> No se encontraron borradores con los filtros seleccionados.
          </td>
        </tr>
      `;
      return;
    }

    ui.listaBorradores.innerHTML = '';
    state.borradores.forEach((borrador) => {
      const tr = document.createElement('tr');
      tr.classList.toggle('table-active', state.seleccionado?.id === borrador.id);
      tr.innerHTML = `
        <td>
          <div class="fw-semibold">${borrador.modulo}</div>
          <div class="subtexto">${borrador.usuarioNombre || 'Sin usuario'}</div>
        </td>
        <td>${borrador.empresaId}</td>
        <td>${borrador.anio}</td>
        <td>${badgeEstado(borrador.estado)}</td>
        <td class="small text-muted">${formatearFecha(borrador.fechaEnvio || borrador.fechaCreacion)}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-chip btn-chip-outline" data-id="${borrador.id}">
            <i class="bi bi-journal-text"></i> Abrir
          </button>
        </td>
      `;
      tr.addEventListener('click', () => seleccionarBorrador(borrador.id));
      tr.querySelector('button')?.addEventListener('click', (ev) => {
        ev.stopPropagation();
        seleccionarBorrador(borrador.id);
      });
      ui.listaBorradores.appendChild(tr);
    });
  };

  const renderHistorial = (historial = []) => {
    if (!historial.length) {
      ui.historial.innerHTML = '<p class="text-muted small">Sin eventos registrados.</p>';
      return;
    }
    ui.historial.innerHTML = '';
    historial.forEach((evento) => {
      const meta = META_ESTADOS[evento.estado] || {};
      const div = document.createElement('div');
      div.className = 'timeline-item';
      div.innerHTML = `
        <div class="d-flex align-items-center gap-2 mb-1">
          ${badgeEstado(evento.estado)}
          <span class="fecha">${formatearFecha(evento.fecha)}</span>
        </div>
        <p class="mb-1 fw-semibold">${evento.comentario || meta.texto || 'Actualización'}</p>
        <p class="mb-0 text-muted small">${evento.nombre || evento.usuario || 'Sistema'}</p>
      `;
      ui.historial.appendChild(div);
    });
  };

  const actualizarDetalle = (detalle) => {
    const borrador = detalle?.borrador;
    state.seleccionado = borrador || null;
    if (!borrador) {
      ui.detalleEstado.textContent = 'Sin selección';
      ui.detalleEstado.dataset.estado = '';
      ui.detalleResumen.classList.remove('d-none');
      ui.historial.innerHTML = '';
      ui.accionRevisar.disabled = true;
      ui.accionAutorizar.disabled = true;
      ui.accionRechazar.disabled = true;
      ui.accionGuardar.disabled = true;
      ui.accionVer.disabled = true;
      return;
    }

    ui.detalleResumen.classList.add('d-none');
    ui.detalleEstado.innerHTML = badgeEstado(borrador.estado);
    ui.detalleEstado.dataset.estado = borrador.estado;
    ui.detalleMeta.textContent = `${borrador.modulo} · ${borrador.empresaId} · ${borrador.anio}`;

    const historial = detalle.historial || [];
    renderHistorial(historial);

    const estado = borrador.estado;
    ui.accionRevisar.disabled = estado !== 'PENDIENTE';
    ui.accionAutorizar.disabled = !['REVISADO', 'PENDIENTE'].includes(estado);
    ui.accionRechazar.disabled = !['PENDIENTE', 'REVISADO', 'APROBADO'].includes(estado);
    ui.accionGuardar.disabled = estado !== 'APROBADO';
    ui.accionVer.disabled = !MAPA_VISTAS[borrador.modulo];
  };

  const seleccionarBorrador = async (id) => {
    try {
      const detalle = await fetchJson(`${API_BASE}/borradores/${id}`);
      actualizarDetalle(detalle);
    } catch (error) {
      console.error(error);
      notificar(error.message, 'warning');
    }
  };

  const cargarBorradores = async () => {
    const params = new URLSearchParams();
    if (state.filtros.empresaId) params.set('empresaId', state.filtros.empresaId);
    if (state.filtros.anio) params.set('anio', state.filtros.anio);
    if (state.filtros.estados.size && state.filtros.estados.size !== ESTADOS.length) {
      params.set('estado', Array.from(state.filtros.estados).join(','));
    }
    if (state.filtros.busqueda) params.set('busca', state.filtros.busqueda);

    ui.listaBorradores.innerHTML = `
      <tr><td colspan="6" class="text-center py-4 text-muted"><div class="spinner-border spinner-border-sm me-2"></div>Actualizando...</td></tr>
    `;

    try {
      const respuesta = await fetchJson(`${API_BASE}/borradores?${params.toString()}`);
      state.borradores = respuesta.borradores || [];
      renderResumen(respuesta.resumen);
      renderBorradores();
      if (state.seleccionado) {
        const sigue = state.borradores.find((b) => b.id === state.seleccionado.id);
        if (!sigue) {
          actualizarDetalle({});
        }
      }
    } catch (error) {
      console.error(error);
      notificar(error.message, 'danger');
    }
  };

  const ejecutarAccion = async (ruta, payload, mensajeOk) => {
    if (!state.seleccionado) return;
    try {
      await fetchJson(`${API_BASE}/borradores/${ruta}`, {
        method: 'POST',
        body: JSON.stringify({ borradorId: state.seleccionado.id, ...payload })
      });
      notificar(mensajeOk || 'Acción realizada.', 'success');
      await cargarBorradores();
      await seleccionarBorrador(state.seleccionado.id);
    } catch (error) {
      console.error(error);
      notificar(error.message, 'danger');
    }
  };

  const manejarRechazo = async () => {
    if (!state.seleccionado) return;
    const motivo = window.prompt('Motivo del rechazo:');
    if (!motivo) return;
    await ejecutarAccion('rechazar', { motivo }, 'Borrador rechazado.');
  };

  const manejarVer = () => {
    if (!state.seleccionado) return;
    const vista = MAPA_VISTAS[state.seleccionado.modulo];
    if (!vista) return;
    window.open(vista, '_blank');
  };

  const inicializarEventos = () => {
    ui.filtroEmpresa?.addEventListener('change', (ev) => {
      state.filtros.empresaId = ev.target.value;
      cargarBorradores();
    });

    ui.filtroAnio?.addEventListener('change', (ev) => {
      state.filtros.anio = Number(ev.target.value);
      cargarBorradores();
    });

    ui.filtroBusqueda?.addEventListener('input', (ev) => {
      state.filtros.busqueda = ev.target.value.trim();
      cargarBorradores();
    });

    ui.btnRefrescar?.addEventListener('click', () => cargarBorradores());
    ui.accionRevisar?.addEventListener('click', () => ejecutarAccion('revisar', { cancelar: false }, 'Borrador marcado como revisado.'));
    ui.accionAutorizar?.addEventListener('click', () => ejecutarAccion('autorizar', {}, 'Borrador autorizado.'));
    ui.accionRechazar?.addEventListener('click', manejarRechazo);
    ui.accionGuardar?.addEventListener('click', () => ejecutarAccion('finalizar', {}, 'Borrador guardado en base de datos.'));
    ui.accionVer?.addEventListener('click', manejarVer);
  };

  const init = async () => {
    renderEstados();
    poblarAnios();
    await poblarEmpresas();
    inicializarEventos();
    cargarBorradores();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
