const origin = window.location.protocol === 'file:' ? 'http://localhost:3000' : window.location.origin;
const API_BASE = `${origin}/api`;

const ESTADOS = {
  EDITANDO: 'EDITANDO',
  PENDIENTE: 'PENDIENTE',
  REVISADO: 'REVISADO',
  RECHAZADO: 'RECHAZADO',
  APROBADO: 'APROBADO',
  GUARDADO: 'GUARDADO',
  SIN_BORRADOR: 'SIN_BORRADOR'
};

const DEFAULT_MODULOS = [
  { clave: 'direccion', titulo: 'Dirección', seccion: 'Dirección', ruta: './Dirección.html' },
  { clave: 'comites', titulo: 'Comités', seccion: 'Operación', ruta: './Comités.html' },
  { clave: 'comunicacion', titulo: 'Comunicación', seccion: 'Operación', ruta: './Comunicación.html' },
  { clave: 'eventos', titulo: 'Eventos', seccion: 'Operación', ruta: './Eventos.html' },
  { clave: 'finanzas', titulo: 'Finanzas', seccion: 'Corporativo', ruta: './Finanzas.html' },
  { clave: 'membresia', titulo: 'Membresía', seccion: 'Operación', ruta: './Membresía.html' },
  { clave: 'servicios', titulo: 'Servicios Membresía', seccion: 'Operación', ruta: './Serv_Membresía.html' },
  { clave: 'rh', titulo: 'Recursos Humanos', seccion: 'Corporativo', ruta: './RH.html' },
  { clave: 'tic', titulo: 'Tecnología', seccion: 'Corporativo', ruta: './T&IC.html' },
  { clave: 'vpe', titulo: 'VPE', seccion: 'Corporativo', ruta: './VPE.html' },
  { clave: 'gastos', titulo: 'Gastos Corporativos', seccion: 'Corporativo', ruta: './Gtos_Corporativos.html' }
];

const obtenerModulos = () => {
  const panel = document.getElementById('panelFlujos');
  if (!panel) return DEFAULT_MODULOS;
  try {
    const dataAttr = panel.dataset.modulos || '[]';
    const parsed = JSON.parse(dataAttr);
    if (Array.isArray(parsed) && parsed.length) {
      return parsed.map((item) => ({ ...item, clave: item.clave || item.modulo || item.nombre })).filter((m) => m.clave);
    }
  } catch (error) {
    console.warn('No se pudo leer la configuración de módulos, se usarán los predeterminados.', error);
  }
  return DEFAULT_MODULOS;
};

const obtenerHeaders = () => (window.Sesion?.headersAutenticacion?.() || {});

const estadoChip = (estado) => {
  const valor = estado || ESTADOS.SIN_BORRADOR;
  return `<span class="status-chip" data-estado="${valor}">${valor.replace('_', ' ')}</span>`;
};

const metaTexto = (borrador) => {
  if (!borrador) return 'Sin borrador en curso.';
  const fecha = borrador.fechaEnvio || borrador.fechaActualizacion;
  const fechaTexto = fecha ? new Date(fecha).toLocaleString('es-MX') : 'Sin fecha registrada';
  return `${borrador.estado || ESTADOS.EDITANDO} · Último movimiento: ${fechaTexto}`;
};

const construirCard = (registro) => {
  const { titulo, seccion, estado, borrador, ruta } = registro;
  return `
    <div class="col-12 col-md-6 col-lg-4">
      <div class="card card-flow">
        <div class="card-body d-flex flex-column gap-2">
          <div class="d-flex justify-content-between align-items-start gap-2">
            <div>
              <p class="text-uppercase fw-bold text-muted mb-1" style="letter-spacing: 0.08em;">${seccion || 'Sección'}</p>
              <h5 class="mb-0">${titulo}</h5>
            </div>
            <div class="section-pill">${seccion || 'General'}</div>
          </div>
          <div>${estadoChip(estado)}</div>
          <p class="mb-0 flow-meta">${metaTexto(borrador)}</p>
          <div class="d-flex flex-wrap gap-2 mt-auto">
            <button class="btn btn-outline-primary btn-sm" data-accion="ver" data-modulo="${registro.clave}" ${!borrador ? 'disabled' : ''}>
              <i class="bi bi-eye"></i> Ver borrador
            </button>
            ${ruta ? `<a class="btn btn-link btn-sm text-decoration-none" href="${ruta}"><i class="bi bi-box-arrow-up-right"></i> Abrir sección</a>` : ''}
          </div>
        </div>
      </div>
    </div>
  `;
};

const render = (registros = []) => {
  const panel = document.getElementById('panelFlujos');
  if (!panel) return;
  if (!registros.length) {
    panel.innerHTML = '<div class="alert alert-info">Configura empresa y ejercicio para ver los flujos.</div>';
    return;
  }
  panel.innerHTML = `<div class="row g-3">${registros.map(construirCard).join('')}</div>`;
};

const estadosPorModulo = async (modulos, filtros) => {
  const headers = { 'Content-Type': 'application/json', ...obtenerHeaders() };
  const resultados = await Promise.all(
    modulos.map(async (modulo) => {
      const params = new URLSearchParams({ modulo: modulo.clave, empresaId: filtros.empresaId || '', anio: filtros.anio || '' });
      try {
        const resp = await fetch(`${API_BASE}/borradores/estado?${params.toString()}`, { headers });
        const datos = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(datos.mensaje || 'Error consultando el estado');
        return { ...modulo, estado: datos?.borrador?.estado || ESTADOS.SIN_BORRADOR, borrador: datos?.borrador || null };
      } catch (error) {
        console.warn('Error cargando modulo', modulo.clave, error);
        return { ...modulo, estado: ESTADOS.SIN_BORRADOR, borrador: null, error: error.message };
      }
    })
  );
  return resultados;
};

const actualizarFiltroSeccion = (modulos) => {
  const select = document.getElementById('filtroSeccion');
  if (!select) return;
  const secciones = Array.from(new Set(modulos.map((m) => m.seccion).filter(Boolean)));
  select.innerHTML = '<option value="">Todas</option>' + secciones.map((s) => `<option value="${s}">${s}</option>`).join('');
};

const filtrar = (registros, seccion) => {
  if (!seccion) return registros;
  return registros.filter((r) => (r.seccion || '').toLowerCase() === seccion.toLowerCase());
};

const onVerBorrador = (registros, moduloClave) => {
  const seleccionado = registros.find((item) => item.clave === moduloClave);
  if (!seleccionado?.borrador) return;
  if (seleccionado.ruta) {
    const url = new URL(seleccionado.ruta, window.location.href);
    url.searchParams.set('mostrarBorrador', '1');
    window.open(url.toString(), '_blank');
    return;
  }
  const mensaje = `Borrador ${seleccionado.borrador.estado || 'EDITANDO'} listo para revisarse en su sección.`;
  alert(mensaje);
};

const main = () => {
  const modulos = obtenerModulos();
  actualizarFiltroSeccion(modulos);
  const inputs = {
    empresaId: document.getElementById('empresaId'),
    anio: document.getElementById('anio'),
    filtroSeccion: document.getElementById('filtroSeccion')
  };
  const botones = {
    aplicar: document.getElementById('btnAplicar'),
    recargar: document.getElementById('btnRecargar')
  };
  let cacheRegistros = [];

  const cargar = async () => {
    const filtros = { empresaId: inputs.empresaId?.value || '', anio: inputs.anio?.value || '' };
    const registros = await estadosPorModulo(modulos, filtros);
    cacheRegistros = registros;
    render(filtrar(registros, inputs.filtroSeccion?.value));
  };

  botones.aplicar?.addEventListener('click', () => cargar());
  botones.recargar?.addEventListener('click', () => cargar());

  document.addEventListener('click', (ev) => {
    const target = ev.target.closest('[data-accion="ver"]');
    if (!target) return;
    const modulo = target.dataset.modulo;
    onVerBorrador(cacheRegistros, modulo);
  });

  cargar();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main, { once: true });
} else {
  main();
}
