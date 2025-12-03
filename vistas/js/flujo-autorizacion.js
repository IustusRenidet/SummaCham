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
      this.tablaId = options.tablaId || document.body.dataset.tabla || 'tablaComparacion';
      this.moduloDefault = options.modulo || document.body.dataset.modulo || '';
      this.contexto = {
        empresaId: null,
        anio: null,
        modulo: this.moduloDefault
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
      this.callbacks = {
        onCancelEdit: options.onCancelEdit || (() => window.CuentasModulo?.cancelEdit?.()),
        obtenerCambios: options.obtenerCambios || (() => window.CuentasModulo?.getCambios?.() || {}),
        obtenerHeaders: options.obtenerHeaders || (() => Sesion.headersAutenticacion())
      };
      this._conectarEventos();
    }

  init() {
    this.tableElement = document.getElementById(this.tablaId);
    this._definirBotones();
    this._prepararToast();
    this._actualizarBotones();
    return this;
  }

    _definirBotones() {
      const ids = [
        'btnGuardarBorrador',
        'btnEnviarCambios',
        'btnCancelarEdicion',
        'btnVerBorrador',
        'btnGuardarAutorizado',
        'btnAutorizar',
        'btnRechazar',
        'panelRevision'
      ];
      ids.forEach((id) => {
        this.buttons[id] = document.getElementById(id);
      });
      if (this.buttons.btnGuardarBorrador) {
        this.buttons.btnGuardarBorrador.addEventListener('click', () => this._handleGuardar());
      }
      if (this.buttons.btnEnviarCambios) {
        this.buttons.btnEnviarCambios.addEventListener('click', () => this._handleEnviar());
      }
      if (this.buttons.btnCancelarEdicion) {
        this.buttons.btnCancelarEdicion.addEventListener('click', () => this._handleCancelarEdicion());
      }
      if (this.buttons.btnVerBorrador) {
        this.buttons.btnVerBorrador.addEventListener('click', () => this._toggleVerBorrador());
      }
      if (this.buttons.btnAutorizar) {
        this.buttons.btnAutorizar.addEventListener('click', () => this._handleAutorizar());
      }
      if (this.buttons.btnRechazar) {
        this.buttons.btnRechazar.addEventListener('click', () => this._handleRechazar());
      }
      if (this.buttons.btnGuardarAutorizado) {
        this.buttons.btnGuardarAutorizado.addEventListener('click', () => this._handleGuardarFinal());
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
          this._actualizarBotones();
          return;
        }
        this.borradorActual = datos.borrador || null;
        this.borradorGuardado = Boolean(this.borradorActual);
        this.verBorradorVisible = [ESTADOS.PENDIENTE, ESTADOS.REVISADO, ESTADOS.APROBADO, ESTADOS.GUARDADO]
          .includes(this.borradorActual?.estado);
        if (this.verBorradorVisible) {
          FlujoAutorizacion.pintarBorrador(this.tableElement, this.borradorActual);
        } else {
          FlujoAutorizacion.limpiarBorrador(this.tableElement);
        }
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

    async _handleGuardar() {
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
        this.verBorradorVisible = true;
        FlujoAutorizacion.pintarBorrador(this.tableElement, this.borradorActual);
        this._actualizarBotones();
        this._mostrarToast(datos.mensaje || 'Borrador guardado.');
      } catch (error) {
        console.error('Error al guardar el borrador', error);
        this._mostrarToast(error.message || 'No fue posible guardar el borrador.', 'danger');
      }
    }

    async _handleEnviar() {
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
        this.verBorradorVisible = true;
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
        this.verBorradorVisible = true;
        FlujoAutorizacion.pintarBorrador(this.tableElement, this.borradorActual);
        this._actualizarBotones();
        this._mostrarToast(datos.mensaje || 'Borrador autorizado.');
      } catch (error) {
        console.error('Error al autorizar borrador', error);
        this._mostrarToast(error.message || 'No fue posible autorizar.', 'danger');
      }
    }

    async _handleRechazar() {
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
        this.verBorradorVisible = true;
        FlujoAutorizacion.pintarBorrador(this.tableElement, this.borradorActual);
        this._actualizarBotones();
        this._mostrarToast(datos.mensaje || 'Borrador rechazado.');
      } catch (error) {
        console.error('Error al rechazar borrador', error);
        this._mostrarToast(error.message || 'No fue posible rechazar.', 'danger');
      }
    }

    async _handleRevision(cancelar) {
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
        this.verBorradorVisible = true;
        FlujoAutorizacion.pintarBorrador(this.tableElement, this.borradorActual);
        this._actualizarBotones();
        this._mostrarToast(datos.mensaje || 'Revisión registrada.');
      } catch (error) {
        console.error('Error al marcar revisión', error);
        this._mostrarToast(error.message || 'No fue posible actualizar la revisión.', 'danger');
      }
    }

    async _handleGuardarFinal() {
      if (!this.borradorActual?.id) {
        this._mostrarToast('No hay borrador autorizado para guardar.', 'warning');
        return;
      }
      try {
        const respuesta = await fetch(`${API_BASE}/borradores/finalizar`, {
          method: 'POST',
          headers: this._construirHeaders(),
          body: JSON.stringify({ borradorId: this.borradorActual.id })
        });
        const datos = await respuesta.json().catch(() => ({}));
        if (!respuesta.ok) {
          throw new Error(datos.mensaje || 'No fue posible guardar en base de datos.');
        }
        this.borradorActual = datos.borrador || null;
        this.borradorGuardado = Boolean(this.borradorActual);
        this.hayCambios = false;
        this.verBorradorVisible = true;
        FlujoAutorizacion.pintarBorrador(this.tableElement, this.borradorActual);
        this._actualizarBotones();
        this._mostrarToast(datos.mensaje || 'Información guardada en la base de datos.');
      } catch (error) {
        console.error('Error al guardar autorizado', error);
        this._mostrarToast(error.message || 'No fue posible guardar en la base de datos.', 'danger');
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
      if (!this.borradorActual) {
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
        btnGuardarBorrador,
        btnEnviarCambios,
        btnCancelarEdicion,
        btnVerBorrador,
        panelRevision,
        btnAutorizar,
        btnRechazar,
        btnGuardarAutorizado
      } = this.buttons;

      if (btnGuardarBorrador) {
        btnGuardarBorrador.disabled = true;
        btnGuardarBorrador.classList.add('d-none');
      }

      if (btnEnviarCambios) {
        const puedeEnviar = [ESTADOS.EDITANDO, ESTADOS.RECHAZADO, null].includes(estado)
          && (this.hayCambios || Boolean(this.borradorActual));
        btnEnviarCambios.classList.toggle('d-none', !puedeEnviar);
      }

      if (btnCancelarEdicion) {
        btnCancelarEdicion.classList.toggle('d-none', !this.hayCambios);
      }

      if (btnVerBorrador) {
        const tieneDatos = Boolean(this.borradorActual?.data);
        btnVerBorrador.classList.toggle('d-none', !tieneDatos);
        btnVerBorrador.classList.toggle('active', this.verBorradorVisible);
      }

      if (panelRevision) {
        const visible = !this.esAdminGlobal && [ESTADOS.PENDIENTE, ESTADOS.REVISADO, ESTADOS.APROBADO].includes(estado);
        panelRevision.classList.toggle('d-none', !visible);
      }

      if (btnAutorizar) {
        const enRevision = estado === ESTADOS.PENDIENTE;
        btnAutorizar.textContent = enRevision ? 'Marcar revisado' : 'Autorizar';
        btnAutorizar.classList.toggle('d-none', this.esAdminGlobal || ![ESTADOS.PENDIENTE, ESTADOS.REVISADO].includes(estado));
      }

      if (btnRechazar) {
        btnRechazar.classList.toggle('d-none', this.esAdminGlobal || ![ESTADOS.PENDIENTE, ESTADOS.REVISADO, ESTADOS.APROBADO].includes(estado));
      }

      if (btnGuardarAutorizado) {
        btnGuardarAutorizado.classList.toggle('d-none', estado !== ESTADOS.APROBADO);
      }
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
