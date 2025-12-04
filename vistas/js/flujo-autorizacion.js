(() => {
  const origin = window.location.protocol === 'file:' ? 'http://localhost:3000' : window.location.origin;
  const API_BASE = `${origin}/api`;
  const FORMATTER_NUMEROS = new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const EVENTO_CONTEXTO = 'planeacion:contexto-actualizado';
  const EVENTO_EDICION = 'modulo-planeacion:presupuesto-editado';
  const STYLE_ID = 'flujo-autorizacion-style';
  
  const ESTADOS = {
    EDITANDO: 'EDITANDO',
    PENDIENTE: 'PENDIENTE',
    REVISADO: 'REVISADO',
    RECHAZADO: 'RECHAZADO',
    APROBADO: 'APROBADO',
    GUARDADO: 'GUARDADO'
  };

  const ESTADOS_ETIQUETAS = {
    EDITANDO: 'En edición',
    PENDIENTE: 'Pendiente de revisión',
    REVISADO: 'Revisado',
    RECHAZADO: 'Rechazado',
    APROBADO: 'Aprobado',
    GUARDADO: 'Guardado en COI'
  };
  const DRAFTS_DRAWER_ID = 'workflowDraftsDrawer';
  let draftsDrawerEl = null;
  let draftsDrawerBody = null;
  let draftsDrawerStatus = null;
  const formatDateTime = (valor) => {
    if (!valor) return '—';
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) {
      return valor;
    }
    return fecha.toLocaleString('es-MX');
  };

  const colocarEstilo = () => {
    if (document.getElementById(STYLE_ID)) {
      return;
    }
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .celda-borrador {
        position: relative;
        background-color: #fff3cd !important;
        color: #5f3703 !important;
      }
      .celda-borrador::after {
        content: '\\00b7';
        position: absolute;
        right: 0.25rem;
        top: 0.15rem;
        font-size: 0.75rem;
        color: #5f3c1c;
      }
      .modo-edicion td.editable {
        cursor: pointer;
        background-color: #f0f8ff !important;
      }
      .modo-edicion td.editable:hover {
        background-color: #e6f2ff !important;
      }
      .workflow-info-panel {
        background: rgba(47, 84, 150, 0.05);
        border-radius: 12px;
        padding: 1rem;
        margin-bottom: 1rem;
      }
      .comentarios-panel {
        margin-top: 1rem;
      }
      .cuenta-suggestion {
        cursor: pointer;
        padding: 0.5rem;
        border-bottom: 1px solid #eee;
      }
      .cuenta-suggestion:hover {
        background-color: #f8f9fa;
      }
      .drafts-drawer {
        width: min(480px, 90vw);
      }
      .drafts-drawer .drafts-table th {
        font-size: 0.75rem;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        background: #f4f6fa;
      }
      .drafts-drawer .drafts-table td {
        font-size: 0.85rem;
        vertical-align: middle;
      }
    `;
    document.head.appendChild(style);
  };

  const ensureDraftsDrawer = () => {
    if (draftsDrawerEl) {
      return draftsDrawerEl;
    }
    const drawer = document.createElement('div');
    drawer.className = 'offcanvas offcanvas-end drafts-drawer';
    drawer.tabIndex = -1;
    drawer.id = DRAFTS_DRAWER_ID;
    drawer.setAttribute('aria-labelledby', 'draftsDrawerLabel');
    drawer.innerHTML = `
      <div class="offcanvas-header">
        <h5 class="offcanvas-title" id="draftsDrawerLabel">Centro de borradores</h5>
        <button type="button" class="btn-close text-reset" data-bs-dismiss="offcanvas" aria-label="Cerrar"></button>
      </div>
      <div class="offcanvas-body">
        <div id="draftsCenterStatus" class="alert alert-info">
          Selecciona empresa y ejercicio para cargar los borradores.
        </div>
        <div class="table-responsive">
          <table class="table table-sm drafts-table align-middle">
            <thead>
              <tr>
                <th>Contexto</th>
                <th>Estado</th>
                <th>Autor</th>
                <th>Actualizado</th>
                <th class="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody id="draftsCenterBody">
              <tr>
                <td colspan="5" class="text-center text-muted">Sin registros</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
    document.body.appendChild(drawer);
    draftsDrawerEl = drawer;
    draftsDrawerBody = drawer.querySelector('#draftsCenterBody');
    draftsDrawerStatus = drawer.querySelector('#draftsCenterStatus');
    return draftsDrawerEl;
  };

  class FlujoAutorizacion {
    constructor(options = {}) {
      colocarEstilo();
      this.options = options;
      this.tablaId = options.tablaId || document.body.dataset.tabla || 'tablaComparacion';
      this.moduloDefault = options.modulo || document.body.dataset.modulo || '';
      this.contexto = {
        empresaId: null,
        anio: null,
        modulo: this.moduloDefault
      };
      this.permisos = {
        guardar: true,
        enviar: true,
        verBorrador: true,
        autorizar: true,
        rechazar: true,
        revision: true,
        aprobar: true
      };
      this.borradorActual = null;
      this.hayCambios = false;
      this.modoEdicion = false;
      this.cambiosEdicion = {};
      this.esAdminGlobal = Boolean(window.Sesion?.esAdminGlobal?.());
      this.usuarioActual = window.Sesion?.obtenerDatosUsuario?.() || {};
      this.tableElement = null;
      this.toastInstance = null;
      this.toastBody = null;
      this.buttons = {};
      this.callbacks = {
        onCancelEdit: options.onCancelEdit || (() => {}),
        obtenerCambios: options.obtenerCambios || (() => ({})),
        obtenerHeaders: options.obtenerHeaders || (() => Sesion.headersAutenticacion())
      };
      this.buttonIds = options.buttonIds || {
        guardar: 'btnGuardarBorrador',
        enviar: 'btnEnviarCambios',
        cancelar: 'btnCancelarEdicion',
        verBorrador: 'btnVerBorrador',
        autorizar: 'btnAutorizar',
        rechazar: 'btnRechazar',
        marcarRevisado: 'btnMarcarRevisado',
        guardarCOI: 'saveBudgetBtn'
      };
      this._conectarEventos();
      window.addEventListener(EVENTO_EDICION, (evento) => {
        this.hayCambios = Boolean(evento?.detail?.hayCambios);
      });
    }

    init() {
      this.tableElement = document.getElementById(this.tablaId);
      this._resolverConfiguracionVista();
      this._definirBotones();
      this._prepararToast();
      this._actualizarEstadoServidor();
      return this;
    }

    _definirBotones() {
      Object.entries(this.buttonIds).forEach(([key, id]) => {
        if (!id) return;
        this.buttons[key] = document.getElementById(id);
      });

      if (this.buttons.guardar) {
        this.buttons.guardar.addEventListener('click', () => this._handleGuardar());
      }
      if (this.buttons.enviar) {
        const spanEnviar = this.buttons.enviar.querySelector('span');
        if (spanEnviar) {
          spanEnviar.textContent = 'Enviar presupuesto';
        }
        this.buttons.enviar.addEventListener('click', () => this._handleEnviar());
      }
      if (this.buttons.cancelar) {
        this.buttons.cancelar.addEventListener('click', () => this._handleCancelar());
      }
      if (this.buttons.verBorrador) {
        this.buttons.verBorrador.addEventListener('click', () => this._mostrarCentroBorradores());
      }
      if (this.buttons.autorizar) {
        this.buttons.autorizar.addEventListener('click', () => this._handleAutorizar());
      }
      if (this.buttons.rechazar) {
        this.buttons.rechazar.addEventListener('click', () => this._handleRechazar());
      }
      if (this.buttons.marcarRevisado) {
        this.buttons.marcarRevisado.addEventListener('click', () => this._handleMarcarRevisado());
      }
      if (this.buttons.guardarCOI) {
        // Cambiar texto del botón
        const span = this.buttons.guardarCOI.querySelector('span');
        if (span) {
          span.textContent = 'Guardar en COI';
        }
        this.buttons.guardarCOI.addEventListener('click', () => this._handleGuardarCOI());
      }
    }

    _prepararToast() {
      const toastElement = document.getElementById('actionToast');
      const toastBody = document.getElementById('actionToastBody');
      if (toastElement && toastBody && window.bootstrap?.Toast) {
        this.toastInstance = window.bootstrap.Toast.getOrCreateInstance(toastElement, { delay: 3000 });
        this.toastBody = toastBody;
      }
    }

    _conectarEventos() {
      window.addEventListener(EVENTO_CONTEXTO, (evento) => {
        const detalle = evento?.detail || {};
        this.contexto.empresaId = detalle.empresaId || this.contexto.empresaId;
        this.contexto.anio = Number.isInteger(Number(detalle.anio)) ? Number(detalle.anio) : this.contexto.anio;
        this.contexto.modulo = detalle.modulo ? detalle.modulo : this.contexto.modulo;
        this._actualizarEstadoServidor();
      });
    }

    _contextoCompleto() {
      return this.contexto.empresaId && this.contexto.anio && this.contexto.modulo;
    }

    _puedeEditar(estado) {
      const esCreador = this.borradorActual?.usuarioId === this.usuarioActual.id;
      return estado === ESTADOS.EDITANDO || (estado === ESTADOS.RECHAZADO && esCreador);
    }

    async _actualizarEstadoServidor() {
      if (!this._contextoCompleto()) {
        return;
      }
      try {
        const params = new URLSearchParams({
          empresaId: this.contexto.empresaId,
          anio: String(this.contexto.anio),
          modulo: this.contexto.modulo
        });
        const respuesta = await fetch(`${API_BASE}/borradores/estado?${params.toString()}`, {
          headers: this._construirHeaders()
        });
        const datos = await respuesta.json().catch(() => ({}));
        
        if (!respuesta.ok) {
          this.borradorActual = null;
          this._actualizarBotones();
          return;
        }
        
        this.borradorActual = datos.borrador || null;
        this._sincronizarModoEdicion();
        this._actualizarInfoPanel();
        this._actualizarBotones();
      } catch (error) {
        console.error('Error consultando el estado del borrador', error);
      }
    }

    _sincronizarModoEdicion() {
      const estado = this.borradorActual?.estado;
      const esAutor = this.borradorActual?.usuarioId === this.usuarioActual.id;
      if (estado === ESTADOS.EDITANDO && esAutor) {
        this._activarModoEdicion(true);
        return;
      }
      if (this.modoEdicion && estado !== ESTADOS.EDITANDO) {
        this._desactivarModoEdicion();
      }
    }

    _construirHeaders() {
      const base = this.callbacks.obtenerHeaders();
      return {
        'Content-Type': 'application/json',
        ...base
      };
    }

    _permitido(accion) {
      return Boolean(this.permisos?.[accion]);
    }

    _resolverConfiguracionVista() {
      const dataset = this.tableElement?.dataset || document.body.dataset || {};
      const accionesTexto = dataset.flujoAcciones || dataset.operacionesAutorizacion || '';
      const permisosActualizados = { ...this.permisos };

      if (accionesTexto) {
        const lista = accionesTexto
          .split(',')
          .map((accion) => accion.trim().toLowerCase())
          .filter(Boolean);

        Object.keys(permisosActualizados).forEach((clave) => {
          permisosActualizados[clave] = lista.includes(clave.toLowerCase());
        });
      }

      this.permisos = permisosActualizados;
    }

    _activarModoEdicion(silent = false) {
      if (this.modoEdicion) return;
      this.modoEdicion = true;
      if (!silent) {
        this.cambiosEdicion = {};
      }
      if (this.tableElement) {
        this.tableElement.classList.add('modo-edicion');
      }
      if (window.CuentasModulo?.setEditMode) {
        window.CuentasModulo.setEditMode(true);
      }
      this._actualizarBotones();
    }

    _desactivarModoEdicion() {
      if (!this.modoEdicion) return;
      this.modoEdicion = false;
      this.cambiosEdicion = {};
      if (this.tableElement) {
        this.tableElement.classList.remove('modo-edicion');
      }
      if (window.CuentasModulo?.setEditMode) {
        window.CuentasModulo.setEditMode(false);
      }
      this._actualizarBotones();
    }

    async _handleGuardar() {
      if (!this._permitido('guardar')) {
        this._mostrarToast('No cuentas con permisos para cargar presupuestos.', 'warning');
        return;
      }

      if (!this._contextoCompleto()) {
        this._mostrarToast('Selecciona ejercicio y empresa antes de guardar.', 'warning');
        return;
      }

      if (this.modoEdicion) {
        await this._guardarBorradorTemporal();
        return;
      }

      this._activarModoEdicion();
    }

    async _guardarBorradorTemporal() {
      const cambios = this.callbacks.obtenerCambios();
      const presupuesto = Array.isArray(cambios?.presupuesto) ? cambios.presupuesto : [];
      if (!presupuesto.length && this.borradorActual) {
        this._mostrarToast('No hay cambios nuevos que guardar.', 'info');
        return;
      }

      const payload = {
        modulo: this.contexto.modulo,
        empresaId: this.contexto.empresaId,
        anio: this.contexto.anio,
        datos: { presupuesto }
      };

      try {
        const respuesta = await fetch(`${API_BASE}/borradores/guardar`, {
          method: 'POST',
          headers: this._construirHeaders(),
          body: JSON.stringify(payload)
        });
        const datos = await respuesta.json().catch(() => ({}));
        if (!respuesta.ok) {
          throw new Error(datos.mensaje || 'No fue posible guardar el borrador.');
        }
        this.borradorActual = datos.borrador || this.borradorActual;
        this.hayCambios = false;
        this._mostrarToast('Borrador guardado para continuar editando.', 'success');
        this._actualizarInfoPanel();
        this._actualizarBotones();
      } catch (error) {
        console.error('Error guardando borrador temporal', error);
        this._mostrarToast(error.message || 'No fue posible guardar el borrador.', 'danger');
      }
    }

    async _handleEnviar() {
      if (!this._permitido('enviar') && !this._permitido('guardar')) {
        this._mostrarToast('No cuentas con permisos para enviar presupuestos.', 'warning');
        return;
      }

      const cambios = this.callbacks.obtenerCambios();
      const payload = {
        modulo: this.contexto.modulo,
        empresaId: this.contexto.empresaId,
        anio: this.contexto.anio,
        datos: {
          presupuesto: Array.isArray(cambios?.presupuesto) ? cambios.presupuesto : []
        }
      };

      try {
        // Primero guardar el borrador
        let respuesta = await fetch(`${API_BASE}/borradores/guardar`, {
          method: 'POST',
          headers: this._construirHeaders(),
          body: JSON.stringify(payload)
        });
        let datos = await respuesta.json().catch(() => ({}));
        
        if (!respuesta.ok) {
          throw new Error(datos.mensaje || 'No fue posible guardar el borrador.');
        }

        const borradorId = datos.borrador.id;

        // Luego enviarlo a revisión
        respuesta = await fetch(`${API_BASE}/borradores/enviar`, {
          method: 'POST',
          headers: this._construirHeaders(),
          body: JSON.stringify({ borradorId })
        });
        datos = await respuesta.json().catch(() => ({}));
        
        if (!respuesta.ok) {
          throw new Error(datos.mensaje || 'No fue posible enviar el borrador.');
        }

        this.borradorActual = datos.borrador || null;
        this._desactivarModoEdicion();
        this._actualizarInfoPanel();
        this._actualizarBotones();
        
        const mensaje = datos.autoAutorizado 
          ? 'Presupuesto aprobado automáticamente (Admin Global).'
          : 'Presupuesto enviado para revisión.';
        this._mostrarToast(mensaje);
      } catch (error) {
        console.error('Error al enviar el borrador', error);
        this._mostrarToast(error.message || 'No fue posible enviar el presupuesto.', 'danger');
      }
    }

    _handleCancelar() {
      this._desactivarModoEdicion();
      this._mostrarToast('Edición cancelada.', 'info');
    }

    async _handleMarcarRevisado() {
      if (!this._permitido('revision')) {
        this._mostrarToast('No cuentas con permisos para revisar.', 'warning');
        return;
      }

      if (!this.borradorActual?.id) {
        this._mostrarToast('No hay borrador para revisar.', 'warning');
        return;
      }

      const cancelar = this.borradorActual.estado === ESTADOS.REVISADO;
      const mensaje = cancelar 
        ? '¿Cancelar revisión y devolver a edición?' 
        : '¿Marcar este presupuesto como revisado?';
      
      if (!confirm(mensaje)) return;

      try {
        const respuesta = await fetch(`${API_BASE}/borradores/revisar`, {
          method: 'POST',
          headers: this._construirHeaders(),
          body: JSON.stringify({ 
            borradorId: this.borradorActual.id, 
            cancelar 
          })
        });
        const datos = await respuesta.json().catch(() => ({}));
        
        if (!respuesta.ok) {
          throw new Error(datos.mensaje || 'No fue posible actualizar la revisión.');
        }

        this.borradorActual = datos.borrador || null;
        this._actualizarInfoPanel();
        this._actualizarBotones();
        this._mostrarToast(datos.mensaje || 'Revisión actualizada.');
      } catch (error) {
        console.error('Error al marcar revisión', error);
        this._mostrarToast(error.message || 'No fue posible actualizar la revisión.', 'danger');
      }
    }

    async _handleAutorizar() {
      if (!this._permitido('autorizar')) {
        this._mostrarToast('No cuentas con permisos para autorizar.', 'warning');
        return;
      }

      if (!this.borradorActual?.id) {
        this._mostrarToast('No hay borrador para autorizar.', 'warning');
        return;
      }

      if (!confirm('¿Autorizar este presupuesto?')) return;

      try {
        const respuesta = await fetch(`${API_BASE}/borradores/autorizar`, {
          method: 'POST',
          headers: this._construirHeaders(),
          body: JSON.stringify({ borradorId: this.borradorActual.id })
        });
        const datos = await respuesta.json().catch(() => ({}));
        
        if (!respuesta.ok) {
          throw new Error(datos.mensaje || 'No fue posible autorizar el borrador.');
        }

        this.borradorActual = datos.borrador || null;
        this._actualizarInfoPanel();
        this._actualizarBotones();
        this._mostrarToast(datos.mensaje || 'Presupuesto autorizado.');
      } catch (error) {
        console.error('Error al autorizar borrador', error);
        this._mostrarToast(error.message || 'No fue posible autorizar.', 'danger');
      }
    }

    async _handleRechazar() {
      if (!this._permitido('rechazar') && !this._permitido('autorizar')) {
        this._mostrarToast('No cuentas con permisos para rechazar.', 'warning');
        return;
      }

      if (!this.borradorActual?.id) {
        this._mostrarToast('No hay borrador para rechazar.', 'warning');
        return;
      }

      const motivo = prompt('Indica el motivo para rechazar este presupuesto:');
      if (!motivo) return;

      try {
        const respuesta = await fetch(`${API_BASE}/borradores/rechazar`, {
          method: 'POST',
          headers: this._construirHeaders(),
          body: JSON.stringify({ 
            borradorId: this.borradorActual.id, 
            motivo 
          })
        });
        const datos = await respuesta.json().catch(() => ({}));
        
        if (!respuesta.ok) {
          throw new Error(datos.mensaje || 'No fue posible rechazar el borrador.');
        }

        this.borradorActual = datos.borrador || null;
        this._actualizarInfoPanel();
        this._actualizarBotones();
        this._mostrarToast(datos.mensaje || 'Presupuesto rechazado.');
      } catch (error) {
        console.error('Error al rechazar borrador', error);
        this._mostrarToast(error.message || 'No fue posible rechazar.', 'danger');
      }
    }

    async _handleGuardarCOI() {
      if (!this._permitido('aprobar')) {
        this._mostrarToast('No cuentas con permisos para guardar en COI.', 'warning');
        return;
      }

      if (!this.borradorActual?.id) {
        this._mostrarToast('No hay borrador aprobado para guardar.', 'warning');
        return;
      }

      if (this.borradorActual.estado !== ESTADOS.APROBADO) {
        this._mostrarToast('El presupuesto debe estar aprobado para guardar en COI.', 'warning');
        return;
      }

      if (!confirm('¿Guardar este presupuesto en la base de datos de COI?')) return;

      try {
        const respuesta = await fetch(`${API_BASE}/borradores/finalizar`, {
          method: 'POST',
          headers: this._construirHeaders(),
          body: JSON.stringify({ borradorId: this.borradorActual.id })
        });
        const datos = await respuesta.json().catch(() => ({}));
        
        if (!respuesta.ok) {
          throw new Error(datos.mensaje || 'No fue posible guardar en COI.');
        }

        this.borradorActual = datos.borrador || null;
        this._actualizarInfoPanel();
        this._actualizarBotones();
        this._mostrarToast(datos.mensaje || 'Presupuesto guardado en COI.');
      } catch (error) {
        console.error('Error al guardar en COI', error);
        this._mostrarToast(error.message || 'No fue posible guardar en COI.', 'danger');
      }
    }

    async _mostrarCentroBorradores() {
      if (!this._contextoCompleto()) {
        this._mostrarToast('Selecciona empresa y ejercicio para consultar los borradores.', 'warning');
        return;
      }
      const drawer = ensureDraftsDrawer();
      const instancia = window.bootstrap?.Offcanvas?.getOrCreateInstance(drawer);
      if (instancia) {
        instancia.show();
      }
      await this._cargarCentroBorradores();
    }

    async _cargarCentroBorradores() {
      ensureDraftsDrawer();
      if (!draftsDrawerBody || !draftsDrawerStatus) return;
      draftsDrawerStatus.className = 'alert alert-info';
      draftsDrawerStatus.textContent = 'Cargando borradores...';
      draftsDrawerBody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center text-muted">Cargando...</td>
        </tr>
      `;
      try {
        const params = new URLSearchParams({
          empresaId: this.contexto.empresaId,
          modulo: this.contexto.modulo
        });
        if (Number.isInteger(this.contexto.anio)) {
          params.set('anio', String(this.contexto.anio));
        }
        const respuesta = await fetch(`${API_BASE}/borradores/listar?${params.toString()}`, {
          headers: this._construirHeaders()
        });
        const datos = await respuesta.json().catch(() => ({}));
        if (!respuesta.ok) {
          throw new Error(datos.mensaje || 'No fue posible obtener los borradores.');
        }
        this._renderizarCentroBorradores(datos.borradores || []);
      } catch (error) {
        draftsDrawerStatus.className = 'alert alert-danger';
        draftsDrawerStatus.textContent = error.message || 'Ocurrió un error al consultar los borradores.';
        draftsDrawerBody.innerHTML = `
          <tr>
            <td colspan="5" class="text-center text-muted">Sin datos</td>
          </tr>
        `;
      }
    }

    _renderizarCentroBorradores(lista) {
      if (!draftsDrawerBody || !draftsDrawerStatus) return;
      draftsDrawerBody.innerHTML = '';
      if (!Array.isArray(lista) || !lista.length) {
        draftsDrawerStatus.className = 'alert alert-warning';
        draftsDrawerStatus.textContent = 'No hay borradores disponibles para este contexto.';
        draftsDrawerBody.innerHTML = `
          <tr>
            <td colspan="5" class="text-center text-muted">Sin registros</td>
          </tr>
        `;
        return;
      }

      draftsDrawerStatus.className = 'alert alert-success';
      draftsDrawerStatus.textContent = 'Selecciona un borrador para visualizarlo en la tabla.';

      lista.forEach((item) => {
        const row = document.createElement('tr');
        const etiquetaEstado = ESTADOS_ETIQUETAS[item.estado] || item.estado;
        row.innerHTML = `
          <td>
            <div class="fw-semibold">${item.modulo}</div>
            <div class="text-muted small">Año ${item.anio}</div>
          </td>
          <td><span class="badge text-bg-light">${etiquetaEstado}</span></td>
          <td>
            <div class="fw-semibold">${item.autorNombre || 'Sin autor'}</div>
            <div class="text-muted small">${item.autorUsuario || ''}</div>
          </td>
          <td>
            <div>${formatDateTime(item.fechaEnvio || item.fechaCreacion)}</div>
            ${item.comentarios ? `<div class="text-muted small">${item.comentarios}</div>` : ''}
          </td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-primary" data-borrador-id="${item.id}">
              Ver en la tabla
            </button>
          </td>
        `;
        draftsDrawerBody.appendChild(row);
      });

      draftsDrawerBody.querySelectorAll('[data-borrador-id]').forEach((boton) => {
        boton.addEventListener('click', () => {
          const id = Number(boton.dataset.borradorId);
          if (Number.isFinite(id)) {
            this._verBorradorDesdeCentro(id);
          }
        });
      });
    }

    async _verBorradorDesdeCentro(borradorId) {
      try {
        const respuesta = await fetch(`${API_BASE}/borradores/detalle/${borradorId}`, {
          headers: this._construirHeaders()
        });
        const datos = await respuesta.json().catch(() => ({}));
        if (!respuesta.ok) {
          throw new Error(datos.mensaje || 'No fue posible cargar ese borrador.');
        }
        this.borradorActual = datos.borrador || null;
        if (!this.borradorActual) {
          throw new Error('No se recibió información del borrador.');
        }
        const offcanvas = draftsDrawerEl ? window.bootstrap?.Offcanvas?.getInstance(draftsDrawerEl) : null;
        if (offcanvas) {
          offcanvas.hide();
        }
        const pintado = FlujoAutorizacion.pintarBorrador(this.tableElement, this.borradorActual);
        if (!pintado) {
          this._mostrarToast('Borrador obtenido pero no se pudo aplicar sobre la tabla.', 'warning');
          return;
        }
        this._mostrarToast('Borrador aplicado. Las celdas en amarillo muestran la vista seleccionada.', 'info');
        this._actualizarInfoPanel();
        this._actualizarBotones();
      } catch (error) {
        console.error('Error al visualizar borrador', error);
        this._mostrarToast(error.message || 'No fue posible mostrar el borrador.', 'danger');
      }
    }

    _toggleVerBorrador() {
      this._mostrarCentroBorradores();
    }

    _mostrarToast(mensaje, tipo = 'success') {
      if (!mensaje) return;
      if (this.toastInstance && this.toastBody) {
        const clase = tipo === 'danger' ? 'text-bg-danger' : tipo === 'warning' ? 'text-bg-warning' : 'text-bg-success';
        const toastEl = this.toastInstance._element;
        if (toastEl) {
          toastEl.className = `toast align-items-center border-0 ${clase}`;
        }
        this.toastBody.textContent = mensaje;
        this.toastInstance.show();
        return;
      }
      console.info(`[Flujo AUT] ${mensaje}`);
    }

    _actualizarInfoPanel() {
      const badge = document.getElementById('workflowBadge');
      const meta = document.getElementById('workflowMeta');
      
      if (!badge) return;
      
      const estado = this.borradorActual?.estado || 'sin-cargar';
      const etiqueta = ESTADOS_ETIQUETAS[estado] || 'Sin cargar';
      
      badge.textContent = etiqueta;
      badge.dataset.estado = estado;
      
      if (meta && this.borradorActual) {
        const fecha = this.borradorActual.fechaEnvio 
          ? new Date(this.borradorActual.fechaEnvio).toLocaleString('es-MX')
          : '';
        meta.textContent = fecha ? `Actualizado: ${fecha}` : '';
      }
    }

    _actualizarBotones() {
      const estado = this.borradorActual?.estado;
      const esCreador = this.borradorActual?.usuarioId === this.usuarioActual.id;
      
      // Botón Cargar / Guardar
      if (this.buttons.guardar) {
        const span = this.buttons.guardar.querySelector('span');
        const puedeCargar = this._permitido('guardar') &&
          (!estado || estado === ESTADOS.GUARDADO || (estado === ESTADOS.RECHAZADO && esCreador));
        if (this.modoEdicion) {
          if (span) span.textContent = 'Guardar para más tarde';
          const puedeGuardarTemporal = this._permitido('guardar') && (esCreador || !this.borradorActual || this.esAdminGlobal);
          this.buttons.guardar.classList.toggle('d-none', !puedeGuardarTemporal);
        } else {
          if (span) span.textContent = 'Cargar presupuesto';
          this.buttons.guardar.classList.toggle('d-none', !puedeCargar);
        }
      }
      
      // Botones de edición (Enviar y Cancelar)
      if (this.buttons.enviar) {
        const puedeEnviar = this.modoEdicion && this._permitido('enviar');
        this.buttons.enviar.classList.toggle('d-none', !puedeEnviar);
      }
      if (this.buttons.cancelar) {
        const puedeCancelar = this.modoEdicion && this._permitido('guardar');
        this.buttons.cancelar.classList.toggle('d-none', !puedeCancelar);
      }
      
      // Botón Marcar Revisado / Cancelar Revisión
      if (this.buttons.marcarRevisado) {
        const puedeRevisar = this._permitido('revision') && 
          (estado === ESTADOS.PENDIENTE || estado === ESTADOS.REVISADO);
        this.buttons.marcarRevisado.classList.toggle('d-none', !puedeRevisar);
        
        if (puedeRevisar) {
          const texto = estado === ESTADOS.REVISADO ? 'Cancelar revisión' : 'Marcar como revisado';
          const span = this.buttons.marcarRevisado.querySelector('span');
          if (span) span.textContent = texto;
        }
      }
      
      // Botón Autorizar
      if (this.buttons.autorizar) {
        const puedeAutorizar = this._permitido('autorizar') && estado === ESTADOS.REVISADO;
        this.buttons.autorizar.classList.toggle('d-none', !puedeAutorizar);
      }
      
      // Botón Rechazar
      if (this.buttons.rechazar) {
        const puedeRechazar = (this._permitido('revision') && (estado === ESTADOS.PENDIENTE || estado === ESTADOS.REVISADO)) ||
          (this._permitido('autorizar') && (estado === ESTADOS.REVISADO || estado === ESTADOS.APROBADO));
        this.buttons.rechazar.classList.toggle('d-none', !puedeRechazar);
      }
      
      // Botón Guardar en COI
      if (this.buttons.guardarCOI) {
        const puedeGuardarCOI = this._permitido('aprobar') && estado === ESTADOS.APROBADO;
        this.buttons.guardarCOI.classList.toggle('d-none', !puedeGuardarCOI);
      }

      if (this.buttons.verBorrador) {
        const puedeVerCentro = this.esAdminGlobal
          || this._permitido('guardar')
          || this._permitido('revision')
          || this._permitido('autorizar')
          || this._permitido('rechazar');
        this.buttons.verBorrador.classList.toggle('d-none', !puedeVerCentro);
      }
    }

    static pintarBorrador(tabla, datosBorrador) {
      if (!tabla || !datosBorrador) return false;
      const filas = Array.from(tabla.querySelectorAll('tbody tr'));
      const cambios = Array.isArray(datosBorrador.data?.presupuesto) ? datosBorrador.data.presupuesto : [];
      if (!cambios.length) return false;
      
      const mapaCambios = new Map();
      cambios.forEach((registro) => {
        const clave = (registro.cuenta || '').toString().trim();
        if (clave) {
          mapaCambios.set(clave, registro.valores || {});
        }
      });
      
      if (!mapaCambios.size) return false;
      FlujoAutorizacion.limpiarBorrador(tabla);
      
      filas.forEach((fila) => {
        const cuenta = (fila.dataset.cuenta21 || fila.dataset.cuenta || '').trim();
        if (!cuenta) return;
        
        const valores = mapaCambios.get(cuenta);
        if (!valores) return;
        
        Array.from(fila.cells).forEach((celda) => {
          const clave = celda.dataset.columnaClave;
          if (!clave || !Object.prototype.hasOwnProperty.call(valores, clave)) return;
          
          if (celda.dataset.borradorValorOriginal == null) {
            celda.dataset.borradorValorOriginal = celda.textContent;
          }
          const raw = valores[clave];
          const numero = Number(raw);
          const texto = Number.isFinite(numero) ? FORMATTER_NUMEROS.format(numero) : String(raw || '');
          celda.textContent = texto;
          celda.classList.add('celda-borrador');
        });
      });
      return true;
    }

    static limpiarBorrador(tabla) {
      if (!tabla) return;
      const marcadas = Array.from(tabla.querySelectorAll('.celda-borrador'));
      marcadas.forEach((celda) => {
        if (celda.dataset.borradorValorOriginal != null) {
          celda.textContent = celda.dataset.borradorValorOriginal;
          delete celda.dataset.borradorValorOriginal;
        }
        celda.classList.remove('celda-borrador');
      });
    }
  }

  window.FlujoAutorizacion = FlujoAutorizacion;

  const tieneControles = Boolean(document.getElementById('btnGuardarBorrador'));
  if (tieneControles) {
    window.__flujoAutorizacionInstance = new FlujoAutorizacion();
  }

  const renderWorkflowGuide = (() => {
    let cache = null;
    let loading = null;

    const fetchGuide = async () => {
      if (cache) {
        return cache;
      }
      if (loading) {
        return loading;
      }
      const url = new URL('componentes/flujo-autorizacion.html', window.location.href);
      loading = fetch(url.href)
        .then((resp) => {
          if (!resp.ok) {
            throw new Error('No se pudo cargar la guía de flujo.');
          }
          return resp.text();
        })
        .then((html) => {
          cache = html;
          return html;
        })
        .catch((error) => {
          console.warn(error);
          return '';
        })
        .finally(() => {
          loading = null;
        });
      return loading;
    };

    return async () => {
      const contenedores = document.querySelectorAll('.workflow-drawer .offcanvas-body');
      if (!contenedores.length) {
        return;
      }
      const html = await fetchGuide();
      if (!html) {
        return;
      }
      contenedores.forEach((contenedor) => {
        if (contenedor.querySelector('.workflow-guide')) {
          return;
        }
        const wrapper = document.createElement('div');
        wrapper.className = 'workflow-guide-wrapper mt-3';
        wrapper.innerHTML = html;
        contenedor.appendChild(wrapper);
      });
    };
  })();

  const autoInit = () => {
    const instancia = window.__flujoAutorizacionInstance;
    if (instancia) {
      instancia.init();
    }
    renderWorkflowGuide();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit, { once: true });
  } else {
    autoInit();
  }
})();
