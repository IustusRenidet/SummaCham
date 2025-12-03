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
    `;
    document.head.appendChild(style);
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
        revision: true
      };
      this.borradorActual = null;
      this.hayCambios = false;
      this.borradorGuardado = false;
      this.verBorradorVisible = false;
      this.esAdminGlobal = Boolean(window.Sesion?.esAdminGlobal?.());
      this.tableElement = null;
      this.toastInstance = null;
      this.toastBody = null;
      this.buttons = {};
      this.draftModule = null;
      this.callbacks = {
        onCancelEdit: options.onCancelEdit || (() => window.CuentasModulo?.cancelEdit?.()),
        obtenerCambios: options.obtenerCambios || (() => window.CuentasModulo?.getCambios?.() || {}),
        obtenerHeaders: options.obtenerHeaders || (() => Sesion.headersAutenticacion())
      };
      this.buttonIds = options.buttonIds || {
        guardar: 'btnGuardarBorrador',
        verBorrador: 'btnVerBorrador',
        autorizar: 'btnAutorizar',
        rechazar: 'btnRechazar',
        panelRevision: 'panelRevision'
      };
      this._conectarEventos();
    }

    init() {
      this.tableElement = document.getElementById(this.tablaId);
      this._resolverConfiguracionVista();
      this._definirBotones();
      this._asegurarModuloBorradores();
      this._prepararToast();
      this._actualizarBotones();
      return this;
    }

    _definirBotones() {
      Object.entries(this.buttonIds).forEach(([key, id]) => {
        if (!id) return;
        this.buttons[key] = document.getElementById(id);
      });
      ['enviar', 'cancelar'].forEach((key) => {
        const id = this.buttonIds[key];
        const btn = id ? document.getElementById(id) : null;
        if (btn) {
          btn.remove();
        }
        this.buttons[key] = null;
      });
      if (this.buttons.guardar) {
        if (!this._permitido('guardar')) {
          this.buttons.guardar.classList.add('d-none');
          this.buttons.guardar.disabled = true;
        }
        this.buttons.guardar.addEventListener('click', () => this._handleGuardar());
      }
      if (this.buttons.verBorrador) {
        if (!this._permitido('verBorrador')) {
          this.buttons.verBorrador.classList.add('d-none');
          this.buttons.verBorrador.disabled = true;
        }
        this.buttons.verBorrador.addEventListener('click', () => this._toggleVerBorrador());
      }
      if (this.buttons.autorizar) {
        if (!this._permitido('autorizar')) {
          this.buttons.autorizar.classList.add('d-none');
          this.buttons.autorizar.disabled = true;
        }
        this.buttons.autorizar.addEventListener('click', () => this._handleAutorizar());
      }
      if (this.buttons.rechazar) {
        if (!this._permitido('rechazar')) {
          this.buttons.rechazar.classList.add('d-none');
          this.buttons.rechazar.disabled = true;
        }
        this.buttons.rechazar.addEventListener('click', () => this._handleRechazar());
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

      window.addEventListener(EVENTO_EDICION, (evento) => {
        const detalle = evento?.detail || {};
        this.hayCambios = Boolean(detalle.hayCambios);
        if (detalle.borradorGuardado && this.borradorActual) {
          this.borradorGuardado = true;
        }
        this._actualizarBotones();
      });
    }

    _contextoCompleto() {
      return this.contexto.empresaId && this.contexto.anio && this.contexto.modulo;
    }

    _estadoEditable(estado) {
      return [ESTADOS.EDITANDO, ESTADOS.PENDIENTE, ESTADOS.RECHAZADO, null].includes(estado || null);
    }

    _tablaTieneDatos() {
      if (!this.tableElement) return false;
      const filas = Array.from(this.tableElement.querySelectorAll('tbody tr'));
      if (!filas.length) return false;
      return !filas.every((fila) => fila.classList.contains('estado-tabla'));
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
          this.borradorGuardado = false;
          this.verBorradorVisible = false;
          FlujoAutorizacion.limpiarBorrador(this.tableElement);
          this._actualizarModuloBorradores();
          this._actualizarBotones();
          return;
        }
        this.borradorActual = datos.borrador || null;
        this.borradorGuardado = Boolean(this.borradorActual);
        const estadoBorrador = this.borradorActual?.estado || null;
        this.verBorradorVisible = this._permitido('verBorrador')
          && this._estadoEditable(estadoBorrador)
          && Boolean(this.borradorActual?.data);
        if (this.verBorradorVisible) {
          FlujoAutorizacion.pintarBorrador(this.tableElement, this.borradorActual);
        } else {
          FlujoAutorizacion.limpiarBorrador(this.tableElement);
        }
        this._actualizarModuloBorradores();
        this._actualizarBotones();
      } catch (error) {
        console.error('Error consultando el estado del borrador', error);
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

      Object.entries(dataset).forEach(([clave, valor]) => {
        if (!clave.startsWith('permitir')) return;
        const normalizado = clave.replace('permitir', '').toLowerCase();
        if (!Object.prototype.hasOwnProperty.call(permisosActualizados, normalizado)) return;
        permisosActualizados[normalizado] = valor === 'true' || valor === '1' || valor === true;
      });

      if (this.options?.permisos && typeof this.options.permisos === 'object') {
        Object.entries(this.options.permisos).forEach(([clave, valor]) => {
          if (!Object.prototype.hasOwnProperty.call(permisosActualizados, clave)) return;
          permisosActualizados[clave] = Boolean(valor);
        });
      }

      this.permisos = permisosActualizados;

      if (!this._permitido('verBorrador')) {
        this.verBorradorVisible = false;
        FlujoAutorizacion.limpiarBorrador(this.tableElement);
        const contenedor = this.draftModule?.contenedor || document.querySelector('.draft-viewer');
        if (contenedor) {
          contenedor.classList.add('d-none');
        }
      }

      if (dataset.moduloVista || dataset.moduloClave) {
        this.contexto.modulo = dataset.moduloVista || dataset.moduloClave;
      }
    }

    _asegurarModuloBorradores() {
      if (!this._permitido('verBorrador')) {
        return null;
      }
      if (this.draftModule) {
        return this.draftModule;
      }
      const existente = this.buttonIds.verBorrador
        ? document.getElementById(this.buttonIds.verBorrador)
        : document.getElementById('btnVerBorrador');
      if (existente) {
        this.draftModule = {
          contenedor: existente.closest('.draft-viewer') || existente.parentElement,
          estado: document.getElementById('draftStatusText'),
          boton: existente
        };
        this.buttons.verBorrador = existente;
        if (this.buttons.verBorrador) {
          this.buttons.verBorrador.addEventListener('click', () => this._toggleVerBorrador());
        }
        return this.draftModule;
      }
      const contenedor = document.querySelector('.workflow-toolbar');
      if (!contenedor) {
        return null;
      }
      const modulo = document.createElement('div');
      modulo.className = 'draft-viewer card border-0 shadow-sm mt-3';
      modulo.innerHTML = `
        <div class="card-body d-flex flex-column flex-md-row align-items-md-center gap-3">
          <div class="flex-grow-1">
            <p class="text-muted fw-semibold mb-1">Borradores en curso</p>
            <p class="mb-0 small" id="draftStatusText">No hay borradores activos.</p>
          </div>
          <div class="d-flex gap-2">
            <button type="button" class="btn btn-chip btn-chip-info d-none" id="btnVerBorrador">
              <i class="bi bi-eye"></i>
              <span>Ver borrador</span>
            </button>
          </div>
        </div>
      `;
      contenedor.insertAdjacentElement('afterend', modulo);
      this.draftModule = {
        contenedor: modulo,
        estado: modulo.querySelector('#draftStatusText'),
        boton: modulo.querySelector('#btnVerBorrador')
      };
      this.buttons.verBorrador = this.draftModule.boton;
      if (this.buttons.verBorrador) {
        this.buttons.verBorrador.addEventListener('click', () => this._toggleVerBorrador());
      }
      return this.draftModule;
    }

    _actualizarModuloBorradores() {
      const modulo = this._asegurarModuloBorradores();
      if (!modulo || !this._permitido('verBorrador')) {
        return;
      }
      const estado = this.borradorActual?.estado || null;
      const permitido = this._estadoEditable(estado) && Boolean(this.borradorActual);
      const fechaEnvio = this.borradorActual?.fechaEnvio ? new Date(this.borradorActual.fechaEnvio) : null;
      const metaTexto = permitido
        ? `Borrador ${estado || 'EDITANDO'}${fechaEnvio ? ` · actualizado ${fechaEnvio.toLocaleString('es-MX')}` : ''}`
        : 'No hay borradores activos.';
      modulo.estado.textContent = metaTexto;
      if (modulo.boton) {
        modulo.boton.classList.toggle('d-none', !permitido || !this.borradorActual?.data);
        modulo.boton.disabled = !permitido || !this.borradorActual?.data;
      }
      modulo.contenedor.classList.toggle('d-none', !permitido && !this.borradorActual);
    }

    async _handleGuardar() {
      if (!this._permitido('guardar')) {
        this._mostrarToast('Esta vista no permite guardar borradores.', 'warning');
        return;
      }
      if (!this.hayCambios) {
        this._mostrarToast('No hay cambios pendientes para guardar.', 'warning');
        return;
      }
      if (!this._contextoCompleto()) {
        this._mostrarToast('Selecciona ejercicio y empresa antes de guardar.', 'warning');
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
        const respuesta = await fetch(`${API_BASE}/borradores/guardar`, {
          method: 'POST',
          headers: this._construirHeaders(),
          body: JSON.stringify(payload)
        });
        const datos = await respuesta.json().catch(() => ({}));
        if (!respuesta.ok) {
          throw new Error(datos.mensaje || 'No fue posible guardar el borrador.');
        }
        this.borradorActual = datos.borrador || null;
        this.borradorGuardado = Boolean(this.borradorActual);
        this.hayCambios = false;
        this.verBorradorVisible = this._permitido('verBorrador');
        FlujoAutorizacion.pintarBorrador(this.tableElement, this.borradorActual);
        this._actualizarBotones();
        this._mostrarToast(datos.mensaje || 'Borrador guardado.');
      } catch (error) {
        console.error('Error al guardar el borrador', error);
        this._mostrarToast(error.message || 'No fue posible guardar el borrador.', 'danger');
      }
    }

    async _handleEnviar() {
      if (!this._permitido('enviar')) {
        this._mostrarToast('Esta vista no permite enviar a revisión.', 'warning');
        return;
      }
      if (!this.borradorActual?.id || this.hayCambios) {
        await this._handleGuardar();
      }
      if (!this.borradorActual?.id) {
        this._mostrarToast('No hay borrador guardado para enviar.', 'warning');
        return;
      }
      try {
        const respuesta = await fetch(`${API_BASE}/borradores/enviar`, {
          method: 'POST',
          headers: this._construirHeaders(),
          body: JSON.stringify({ borradorId: this.borradorActual.id })
        });
        const datos = await respuesta.json().catch(() => ({}));
        if (!respuesta.ok) {
          throw new Error(datos.mensaje || 'No fue posible enviar el borrador.');
        }
        this.borradorActual = datos.borrador || null;
        this.borradorGuardado = Boolean(this.borradorActual);
        this.hayCambios = false;
        this.verBorradorVisible = this._permitido('verBorrador');
        FlujoAutorizacion.pintarBorrador(this.tableElement, this.borradorActual);
        this._actualizarBotones();
        const mensaje = datos.autoAutorizado
          ? 'Borrador autorizado automáticamente.'
          : 'Borrador enviado a revisión.';
        this._mostrarToast(mensaje);
      } catch (error) {
        console.error('Error al enviar a revisión', error);
        this._mostrarToast(error.message || 'No fue posible enviar a revisión.', 'danger');
      }
    }

    async _handleAutorizar() {
      if (!this._permitido('autorizar')) {
        this._mostrarToast('Esta vista no permite autorizar.', 'warning');
        return;
      }
      if (!this.borradorActual?.id) {
        this._mostrarToast('No hay borrador pendiente.', 'warning');
        return;
      }
      const estado = this.borradorActual?.estado;
      if (estado === ESTADOS.PENDIENTE) {
        return this._handleRevision(false);
      }
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
        this.borradorGuardado = Boolean(this.borradorActual);
        this.hayCambios = false;
        this.verBorradorVisible = this._permitido('verBorrador');
        FlujoAutorizacion.pintarBorrador(this.tableElement, this.borradorActual);
        this._actualizarBotones();
        this._mostrarToast(datos.mensaje || 'Borrador autorizado.');
      } catch (error) {
        console.error('Error al autorizar borrador', error);
        this._mostrarToast(error.message || 'No fue posible autorizar.', 'danger');
      }
    }

    async _handleRechazar() {
      if (!this._permitido('rechazar')) {
        this._mostrarToast('Esta vista no permite rechazar.', 'warning');
        return;
      }
      if (!this.borradorActual?.id) {
        this._mostrarToast('No hay borrador pendiente.', 'warning');
        return;
      }
      if (this.borradorActual?.estado === ESTADOS.REVISADO) {
        const cancelar = window.confirm('¿Cancelar revisión y regresar a edición?');
        if (cancelar) {
          return this._handleRevision(true);
        }
      }
      const motivo = window.prompt('Indica el motivo para rechazar este borrador:');
      if (!motivo) {
        return;
      }
      try {
        const respuesta = await fetch(`${API_BASE}/borradores/rechazar`, {
          method: 'POST',
          headers: this._construirHeaders(),
          body: JSON.stringify({ borradorId: this.borradorActual.id, motivo })
        });
        const datos = await respuesta.json().catch(() => ({}));
        if (!respuesta.ok) {
          throw new Error(datos.mensaje || 'No fue posible rechazar el borrador.');
        }
        this.borradorActual = datos.borrador || null;
        this.borradorGuardado = Boolean(this.borradorActual);
        this.hayCambios = false;
        this.verBorradorVisible = this._permitido('verBorrador');
        FlujoAutorizacion.pintarBorrador(this.tableElement, this.borradorActual);
        this._actualizarBotones();
        this._mostrarToast(datos.mensaje || 'Borrador rechazado.');
      } catch (error) {
        console.error('Error al rechazar borrador', error);
        this._mostrarToast(error.message || 'No fue posible rechazar.', 'danger');
      }
    }

    async _handleRevision(cancelar) {
      if (!this._permitido('revision')) {
        this._mostrarToast('Esta vista no permite actualizar la revisión.', 'warning');
        return;
      }
      if (!this.borradorActual?.id) {
        this._mostrarToast('No hay borrador para revisar.', 'warning');
        return;
      }
      try {
        const respuesta = await fetch(`${API_BASE}/borradores/revisar`, {
          method: 'POST',
          headers: this._construirHeaders(),
          body: JSON.stringify({ borradorId: this.borradorActual.id, cancelar: Boolean(cancelar) })
        });
        const datos = await respuesta.json().catch(() => ({}));
        if (!respuesta.ok) {
          throw new Error(datos.mensaje || 'No fue posible actualizar la revisión.');
        }
        this.borradorActual = datos.borrador || null;
        this.borradorGuardado = Boolean(this.borradorActual);
        this.hayCambios = false;
        this.verBorradorVisible = this._permitido('verBorrador');
        FlujoAutorizacion.pintarBorrador(this.tableElement, this.borradorActual);
        this._actualizarBotones();
        this._mostrarToast(datos.mensaje || 'Revisión registrada.');
      } catch (error) {
        console.error('Error al marcar revisión', error);
        this._mostrarToast(error.message || 'No fue posible actualizar la revisión.', 'danger');
      }
    }

    _handleCancelarEdicion() {
      this.hayCambios = false;
      this.verBorradorVisible = false;
      FlujoAutorizacion.limpiarBorrador(this.tableElement);
      this._actualizarBotones();
      try {
        this.callbacks.onCancelEdit();
      } catch (error) {
        console.warn('Error al cancelar edición', error);
      }
    }

    _toggleVerBorrador() {
      if (!this.borradorActual || !this._permitido('verBorrador')) {
        return;
      }
      this.verBorradorVisible = !this.verBorradorVisible;
      if (this.verBorradorVisible) {
        FlujoAutorizacion.pintarBorrador(this.tableElement, this.borradorActual);
      } else {
        FlujoAutorizacion.limpiarBorrador(this.tableElement);
      }
      this._actualizarBotones();
    }

    _mostrarToast(mensaje, tipo = 'success') {
      if (!mensaje) {
        return;
      }
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

    _actualizarBotones() {
      const estado = this.borradorActual?.estado || null;
      const {
        guardar,
        verBorrador,
        panelRevision,
        autorizar,
        rechazar
      } = this.buttons;

      const enEdicion = this._estadoEditable(estado);
      const permitirGuardar = this._permitido('guardar');
      const permitirBorrador = this._permitido('verBorrador');
      const permitirRevision = this._permitido('revision');
      const permitirAutorizar = this._permitido('autorizar');
      const permitirRechazar = this._permitido('rechazar');

      if (guardar) {
        const mostrarGuardar = permitirGuardar && enEdicion && this.hayCambios && this._tablaTieneDatos();
        guardar.classList.toggle('d-none', !mostrarGuardar);
        guardar.disabled = !mostrarGuardar;
      }

      if (verBorrador) {
        const tieneDatos = permitirBorrador && Boolean(this.borradorActual?.data) && enEdicion;
        verBorrador.classList.toggle('d-none', !tieneDatos);
        verBorrador.classList.toggle('active', this.verBorradorVisible);
      }

      if (panelRevision) {
        const visible = permitirRevision && !this.esAdminGlobal && [ESTADOS.PENDIENTE, ESTADOS.REVISADO].includes(estado);
        panelRevision.classList.toggle('d-none', !visible);
      }

      if (autorizar) {
        const enRevision = estado === ESTADOS.PENDIENTE;
        autorizar.textContent = enRevision ? 'Marcar revisado' : 'Autorizar';
        const visible = permitirAutorizar && !this.esAdminGlobal && [ESTADOS.PENDIENTE, ESTADOS.REVISADO].includes(estado);
        autorizar.classList.toggle('d-none', !visible);
      }

      if (rechazar) {
        const visible = permitirRechazar
          && !this.esAdminGlobal
          && [ESTADOS.PENDIENTE, ESTADOS.REVISADO, ESTADOS.APROBADO].includes(estado);
        rechazar.classList.toggle('d-none', !visible);
      }

      this._actualizarModuloBorradores();

    }

    static pintarBorrador(tabla, datosBorrador) {
      if (!tabla || !datosBorrador) {
        return false;
      }
      const filas = Array.from(tabla.querySelectorAll('tbody tr'));
      const cambios = Array.isArray(datosBorrador.data?.presupuesto) ? datosBorrador.data.presupuesto : [];
      if (!cambios.length) {
        return false;
      }
      const mapaCambios = new Map();
      cambios.forEach((registro) => {
        const clave = (registro.cuenta || '').toString().trim();
        if (clave) {
          mapaCambios.set(clave, registro.valores || {});
        }
      });
      if (!mapaCambios.size) {
        return false;
      }
      FlujoAutorizacion.limpiarBorrador(tabla);
      filas.forEach((fila) => {
        const cuenta = (fila.dataset.cuenta21 || fila.dataset.cuenta || '').trim();
        if (!cuenta) {
          return;
        }
        const valores = mapaCambios.get(cuenta);
        if (!valores) {
          return;
        }
        Array.from(fila.cells).forEach((celda) => {
          const clave = celda.dataset.columnaClave;
          if (!clave || !Object.prototype.hasOwnProperty.call(valores, clave)) {
            return;
          }
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
      if (!tabla) {
        return;
      }
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

  const autoInit = () => {
    const instancia = window.__flujoAutorizacionInstance;
    if (instancia) {
      instancia.init();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit, { once: true });
  } else {
    autoInit();
  }
})();
