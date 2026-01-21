(() => {
  const resolveApiBase = () => {
    const override = window.API_BASE || window.__API_BASE__;
    if (typeof override === "string" && override.trim()) {
      return override.replace(/\/api\/?$/, "");
    }
    if (window.location.protocol === "file:") {
      return "http://localhost:3005";
    }
    const origin = window.location.origin.replace(/\/$/, "");
    if (/localhost:3000$/.test(origin) || /127\.0\.0\.1:3000$/.test(origin)) {
      return origin.replace(/:3000$/, ":3005");
    }
    return origin;
  };

  const API_BASE = `${resolveApiBase()}/api`;
  const normalizarEstadoWorkflow = (valor) => {
    if (!valor) return 'SIN_CARGAR';
    const base = valor.toString().toUpperCase();
    switch (base) {
      case 'SIN-CARGAR':
      case 'SIN_CARGAR':
      case 'SIN CARGAR':
        return 'SIN_CARGAR';
      case 'BORRADOR':
      case 'EDITANDO':
        return 'EDITANDO';
      case 'PENDIENTE':
        return 'PENDIENTE';
      case 'REVISADO':
        return 'REVISADO';
      case 'AUTORIZADO':
      case 'APROBADO':
        return 'APROBADO';
      case 'RECHAZADO':
        return 'RECHAZADO';
      case 'GUARDADO':
        return 'GUARDADO';
      default:
        return base;
    }
  };
  const MESES = [
    { etiqueta: 'Ene', clave: 'ene' },
    { etiqueta: 'Feb', clave: 'feb' },
    { etiqueta: 'Mar', clave: 'mar' },
    { etiqueta: 'Abr', clave: 'abr' },
    { etiqueta: 'May', clave: 'may' },
    { etiqueta: 'Jun', clave: 'jun' },
    { etiqueta: 'Jul', clave: 'jul' },
    { etiqueta: 'Ago', clave: 'ago' },
    { etiqueta: 'Sep', clave: 'sep' },
    { etiqueta: 'Oct', clave: 'oct' },
    { etiqueta: 'Nov', clave: 'nov' },
    { etiqueta: 'Dic', clave: 'dic' }
  ];

  const WORKFLOW_ETIQUETAS = {
    SIN_CARGAR: {
      texto: 'Sin cargar',
      descripcion: 'En espera de informacion.'
    },
    EDITANDO: {
      texto: 'En edicion',
      descripcion: 'Pendiente de revision.'
    },
    PENDIENTE: {
      texto: 'Pendiente',
      descripcion: 'Enviado a revision.'
    },
    REVISADO: {
      texto: 'Revisado',
      descripcion: 'Listo para autorizar.'
    },
    APROBADO: {
      texto: 'Aprobado',
      descripcion: 'Presupuesto final aprobado.'
    },
    GUARDADO: {
      texto: 'Guardado',
      descripcion: 'Movimiento de guardado.'
    },
    RECHAZADO: {
      texto: 'Rechazado',
      descripcion: 'Devuelto para ajustes.'
    }
  };

  const TRANSICIONES = {
    cargar: {
      destino: 'EDITANDO',
      permiso: 'Cargar y guardar',
      habilita: (estado) => estado === 'SIN_CARGAR' || estado === 'GUARDADO'
    },
    revisar: {
      destino: 'REVISADO',
      permiso: 'Revisar',
      habilita: (estado) => estado === 'EDITANDO'
    },
    autorizar: {
      destino: 'APROBADO',
      permiso: 'Aprobar',
      habilita: (estado) => estado === 'REVISADO'
    },
    guardar: {
      destino: 'GUARDADO',
      permiso: 'Aprobar',
      habilita: (estado) => estado === 'APROBADO'
    }
  };
  TRANSICIONES.aprobar = TRANSICIONES.guardar;

  const formatoNumero = new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const obtenerConfigDesdeDataset = () => {
    const dataset = document.body?.dataset || {};
    const modulo = dataset.modulo || 'Presupuestos';
    const alias = dataset.moduloAlias || modulo || 'Presupuestos';
    const descripcion = dataset.moduloDescripcion || '';
    return {
      modulo,
      titulo: alias,
      descripcion: descripcion || `Planeación financiera del área de ${alias}.`
    };
  };

  const actualizarTexto = (elemento, texto) => {
    if (!elemento) return;
    elemento.textContent = texto;
  };

const setupRecontaOverlayListener = () => {
  if (window.__recontaOverlayListener) return;
  window.__recontaOverlayListener = true;

  const ensureStyles = () => {
    if (document.getElementById("recontaOverlayStyle")) return;
    const style = document.createElement("style");
    style.id = "recontaOverlayStyle";
    style.textContent = `
      .reconta-overlay {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.45);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 1080;
      }
      .reconta-overlay.show {
        display: flex;
      }
      .reconta-card {
        background: #fff;
        border-radius: 14px;
        padding: 1rem 1.25rem;
        min-width: 320px;
        max-width: 420px;
        box-shadow: 0 12px 32px rgba(15, 23, 42, 0.25);
      }
      .reconta-title {
        font-weight: 600;
        margin-bottom: 0.35rem;
      }
      .reconta-meta {
        font-size: 0.85rem;
        color: #6c757d;
      }
    `;
    document.head.appendChild(style);
  };

  const ensureOverlay = () => {
    ensureStyles();
    let overlay = document.getElementById("recontaOverlay");
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.id = "recontaOverlay";
    overlay.className = "reconta-overlay";
    overlay.innerHTML = `
      <div class="reconta-card">
        <div class="reconta-title">Recontabilizando cuentas</div>
        <div class="reconta-meta" id="recontaMeta">Iniciando...</div>
        <div class="progress my-2">
          <div class="progress-bar progress-bar-striped progress-bar-animated" id="recontaBar" role="progressbar" style="width: 0%"></div>
        </div>
        <div class="text-end text-muted small" id="recontaPct">0%</div>
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  };

  const actualizar = (detalle = {}) => {
    const overlay = ensureOverlay();
    const meta = overlay.querySelector("#recontaMeta");
    const bar = overlay.querySelector("#recontaBar");
    const pct = overlay.querySelector("#recontaPct");
    const total = Number(detalle.total) || 0;
    const actual = Number(detalle.actual) || 0;
    const porcentaje = Number.isFinite(detalle.porcentaje)
      ? detalle.porcentaje
      : total > 0
      ? Math.round((actual / total) * 100)
      : 0;

    if (detalle.estado === "oculto") {
      overlay.classList.remove("show");
      return;
    }

    overlay.classList.add("show");
    if (meta) {
      if (detalle.estado === "en-cola") {
        const posicion = Number(detalle.posicion) || 1;
        meta.textContent = `En cola de recontabilización (posición ${posicion})`;
      } else {
        meta.textContent = total
          ? `Recontabilizando ${actual}/${total} cuentas...`
          : "Recontabilizando cuentas...";
      }
    }
    if (bar) {
      bar.style.width = `${porcentaje}%`;
      bar.setAttribute("aria-valuenow", String(porcentaje));
    }
    if (pct) {
      pct.textContent = `${porcentaje}%`;
    }
  };

  window.addEventListener("reconta:progreso", (event) => {
    actualizar(event?.detail || {});
  });
};

setupRecontaOverlayListener();

  const obtenerPermisosActuales = (sesion, modulo) => {
    const empresa = Sesion.obtenerEmpresaActiva(sesion);
    if (!empresa) {
      return { empresa: null, permisos: null };
    }
    const permisos = Sesion.obtenerPermisosModulo(modulo, empresa.id, sesion) || {};
    return { empresa, permisos };
  };

  const initVistaPresupuesto = (config = {}) => {
    const sesion = Sesion.requerirSesion();
    if (!sesion) {
      return;
    }

    const opciones = { ...obtenerConfigDesdeDataset(), ...config };
    const anio = new Date().getFullYear();

    const elementos = {
      tablaBody: document.querySelector('#tablaPresupuestos tbody'),
      tabla: document.getElementById('tablaPresupuestos'),
      accountSearchInput: document.getElementById('accountSearch'),
      saveBudgetBtn: document.getElementById('saveBudgetBtn'),
      loadBudgetBtn: document.getElementById('loadBudgetBtn'),
      reviewBudgetBtn: document.getElementById('reviewBudgetBtn'),
      authorizeBudgetBtn: document.getElementById('authorizeBudgetBtn'),
      approveBudgetBtn: document.getElementById('approveBudgetBtn'),
      budgetFileInput: document.getElementById('budgetFileInput'),
      presupuestoStatus: document.getElementById('presupuestoStatus'),
      yearLabel: document.getElementById('yearLabel'),
      yearColumn: document.getElementById('yearColumn'),
      empresaLabel: document.getElementById('empresaLabel'),
      workflowBadge: document.getElementById('workflowBadge'),
      workflowMeta: document.getElementById('workflowMeta'),
      workflowHistory: document.getElementById('workflowHistory'),
      moduleTitle: document.getElementById('moduleTitle'),
      moduleDescription: document.getElementById('moduleDescription')
    };

    if (elementos.yearLabel) elementos.yearLabel.textContent = anio;
    if (elementos.yearColumn) elementos.yearColumn.textContent = anio;
    if (elementos.moduleTitle) elementos.moduleTitle.textContent = opciones.titulo;
    if (elementos.moduleDescription) elementos.moduleDescription.textContent = opciones.descripcion;

    const estado = {
      cuentas: [],
      filtro: '',
      workflow: {
        estado: 'SIN_CARGAR',
        actualizadoPor: '',
        actualizadoEn: '',
        historial: []
      }
    };
    let moduloReadyDispatched = false;

    const showToast = (mensaje, clase = 'text-bg-success') => {
      if (window.ToastManager?.show) {
        window.ToastManager.show(mensaje, clase);
        return;
      }
      console.warn('[PresupuestoVista] Toast no disponible', mensaje);
    };

    const mostrarEstado = (mensaje, tipo = 'info') => {
      if (!elementos.presupuestoStatus) return;
      elementos.presupuestoStatus.textContent = mensaje;
      elementos.presupuestoStatus.className = `alert alert-${tipo} mb-3`;
    };

    const limpiarEstado = () => {
      if (!elementos.presupuestoStatus) return;
      elementos.presupuestoStatus.textContent = '';
      elementos.presupuestoStatus.className = 'alert alert-info visually-hidden';
    };

    const actualizarEncabezadoEmpresa = (empresa = null) => {
      const etiqueta = empresa?.etiqueta || empresa?.nombre || '—';
      actualizarTexto(elementos.empresaLabel, etiqueta);
    };

    const actualizarBadgeWorkflow = () => {
      if (!elementos.workflowBadge) return;
      const info = WORKFLOW_ETIQUETAS[estado.workflow.estado] || WORKFLOW_ETIQUETAS.SIN_CARGAR;
      elementos.workflowBadge.dataset.estado = estado.workflow.estado;
      elementos.workflowBadge.textContent = info.texto;
      if (elementos.workflowMeta) {
        const descripcion = info.descripcion || '';
        const fecha = estado.workflow.actualizadoEn
          ? new Date(estado.workflow.actualizadoEn).toLocaleString('es-MX')
          : '';
        const detalle = [descripcion, fecha ? `Último cambio: ${fecha}` : '']
          .filter(Boolean)
          .join(' · ');
        elementos.workflowMeta.textContent = detalle;
      }
    };

    const renderizarHistorial = () => {
      if (!elementos.workflowHistory) return;
      const items = (estado.workflow.historial || []).map((registro) => {
        const fecha = registro.fecha ? new Date(registro.fecha).toLocaleString('es-MX') : '';
        const etiqueta = WORKFLOW_ETIQUETAS[registro.estado]?.texto || registro.estado;
        const usuario = registro.usuario || '-';
        return `
          <li class="list-group-item d-flex justify-content-between align-items-start">
            <div>
              <strong>${etiqueta}</strong>
              <div class="small text-muted">${usuario}<\/div>
            <\/div>
            <small class="text-muted">${fecha}<\/small>
          <\/li>`;
      });
      elementos.workflowHistory.innerHTML = items.join('') || '<li class="list-group-item text-muted">Aún no hay movimientos.</li>';
    };

    const renderizarTabla = () => {
      if (!elementos.tablaBody) {
        return;
      }
      elementos.tablaBody.innerHTML = '';
      const filtro = estado.filtro;
      const filtradas = !filtro
        ? estado.cuentas
        : estado.cuentas.filter((cuenta) => {
            const cadena = `${cuenta.numCta} ${cuenta.descripcion}`.toLowerCase();
            return cadena.includes(filtro);
          });

      filtradas.forEach((cuenta) => {
        const fila = document.createElement('tr');
        fila.dataset.cuenta = cuenta.numCta || '';
        fila.dataset.cuenta21 = (cuenta.numCta || '').replace(/[^0-9]/g, '');
        const celdaCuenta = document.createElement('td');
        celdaCuenta.textContent = cuenta.numCta || '-';
        celdaCuenta.className = 'account-column';
        fila.appendChild(celdaCuenta);

        const celdaNombre = document.createElement('td');
        celdaNombre.textContent = cuenta.descripcion || '-';
        fila.appendChild(celdaNombre);

        MESES.forEach(({ clave }) => {
          const celda = document.createElement('td');
          celda.className = 'budget-value text-end';
          celda.dataset.columnaClave = `budget-${clave}`;
          celda.textContent = formatoNumero.format(cuenta[clave] ?? 0);
          fila.appendChild(celda);
        });

        const celdaAnual = document.createElement('td');
        celdaAnual.className = 'budget-value text-end';
        celdaAnual.textContent = formatoNumero.format(cuenta.anual ?? 0);
        fila.appendChild(celdaAnual);
        elementos.tablaBody.appendChild(fila);
      });
    };

    const cargarPresupuestos = async () => {
      const { empresa } = obtenerPermisosActuales(sesion, opciones.modulo);
      if (!empresa) {
        actualizarEncabezadoEmpresa(null);
        estado.cuentas = [];
        renderizarTabla();
        mostrarEstado('Selecciona una empresa desde el panel principal para visualizar sus presupuestos.', 'warning');
        return;
      }
      actualizarEncabezadoEmpresa(empresa);
      mostrarEstado('Cargando presupuestos…', 'info');
      try {
        const respuesta = await fetch(`${API_BASE}/presupuestos?anio=${anio}`, {
          headers: Sesion.headersAutenticacion()
        });
        const datos = await respuesta.json();
        if (!respuesta.ok) {
          throw new Error(datos.mensaje || 'No fue posible obtener los presupuestos.');
        }
        if (datos.empresa) {
          actualizarEncabezadoEmpresa(datos.empresa);
        }
        const normalizarNumero = (valor) => {
          const numerico = Number(valor);
          return Number.isFinite(numerico) ? numerico : 0;
        };
        const obtenerNaturaleza = (valor) => (valor || '').toString().trim().toUpperCase();
        const esAcreedora = (naturaleza) => ['A', 'C'].includes(naturaleza);

        estado.cuentas = Array.isArray(datos.cuentas)
          ? datos.cuentas.map((cuenta) => {
              const naturaleza = obtenerNaturaleza(cuenta.naturaleza || cuenta.NATURALEZA);
              const factor = esAcreedora(naturaleza) ? -1 : 1;
              const normalizada = {
                numCta: cuenta.numCta || cuenta.num_cta || cuenta.CUENTA || '',
                descripcion: cuenta.descripcion || cuenta.nombre || cuenta.DESCRIPCION || '',
                naturaleza
              };
              MESES.forEach(({ clave }) => {
                normalizada[clave] = normalizarNumero(cuenta[clave]) * factor;
              });
              // Para presupuestos 2025, el "Ppto. Acumulado" debe ser la suma de todas las columnas month-budget
              // (recalcular desde las columnas mensuales en lugar de confiar en el campo `anual` devuelto por la API).
              if (Number(anio) === 2025) {
                normalizada.anual = MESES.reduce((ac, mes) => ac + (normalizada[mes.clave] ?? 0), 0);
              } else {
                normalizada.anual = normalizarNumero(cuenta.anual) * factor;
              }
              return normalizada;
            })
          : [];
        estado.filtro = '';
        if (elementos.accountSearchInput) {
          elementos.accountSearchInput.value = '';
        }
        limpiarEstado();
        renderizarTabla();
      } catch (error) {
        estado.cuentas = [];
        renderizarTabla();
        mostrarEstado(error.message || 'Ocurrió un problema al cargar la información.', 'danger');
      }
    };

    const convertirTablaACsv = () => {
      const encabezados = ['Cuenta', 'Descripción', ...MESES.map((mes) => mes.etiqueta), `Anual ${anio}`];
      const filas = estado.cuentas.map((cuenta) => {
        const periodos = MESES.map(({ clave }) => cuenta[clave] ?? 0);
        const anual = cuenta.anual ?? 0;
        return [
          cuenta.numCta || '',
          cuenta.descripcion || '',
          ...periodos.map((valor) => Number(valor).toFixed(2)),
          Number(anual).toFixed(2)
        ];
      });
      const csv = [encabezados.join(',')];
      filas.forEach((fila) => csv.push(fila.join(',')));
      return csv.join('\n');
    };

    const actualizarDesdeCsv = (texto) => {
      const lineas = texto.split(/\r?\n/).filter((linea) => linea.trim().length > 0);
      if (lineas.length <= 1) {
        return false;
      }
      const mapaCuentas = new Map(estado.cuentas.map((cuenta) => [cuenta.numCta, cuenta]));
      for (let i = 1; i < lineas.length; i += 1) {
        const columnas = lineas[i].split(',');
        if (columnas.length < MESES.length + 2) {
          continue;
        }
        const cuenta = mapaCuentas.get(columnas[0].trim());
        if (!cuenta) {
          continue;
        }
        MESES.forEach((mes, indice) => {
          const columna = columnas[indice + 2] || '0';
          const numerico = Number(columna.replace(/[^0-9+\-.,]/g, '').replace(',', '.'));
          cuenta[mes.clave] = Number.isFinite(numerico) ? numerico : 0;
        });
        cuenta.anual = MESES.reduce((acumulado, mes) => acumulado + (cuenta[mes.clave] ?? 0), 0);
      }
      renderizarTabla();
      return true;
    };

    const obtenerWorkflow = async () => {
      try {
        const params = new URLSearchParams({ anio: String(anio), modulo: opciones.modulo });
        const respuesta = await fetch(`${API_BASE}/presupuestos/estado?${params.toString()}`, {
          headers: Sesion.headersAutenticacion()
        });
        const datos = await respuesta.json();
        if (!respuesta.ok) {
          throw new Error(datos.mensaje || 'No fue posible obtener el flujo de autorización.');
        }
        estado.workflow = {
          estado: normalizarEstadoWorkflow(datos.estado),
          estadoRaw: datos.estadoRaw || datos.estado,
          actualizadoEn: datos.actualizadoEn || '',
          actualizadoPor: datos.actualizadoPor || '',
          historial: (datos.historial || []).map((registro) => ({
            ...registro,
            estado: normalizarEstadoWorkflow(registro.estado),
            estadoRaw: registro.estadoRaw || registro.estado
          }))
        };
        actualizarBadgeWorkflow();
        renderizarHistorial();
        actualizarDisponibilidadAcciones();
      } catch (error) {
        console.warn('No fue posible obtener el estado del presupuesto', error);
        showToast(error.message || 'No fue posible consultar el flujo de autorización.', 'text-bg-warning');
      }
    };

    const ejecutarAccionWorkflow = async (accion) => {
      const transicion = TRANSICIONES[accion];
      if (!transicion) {
        return;
      }
      try {
        const respuesta = await fetch(`${API_BASE}/presupuestos/estado`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...Sesion.headersAutenticacion()
          },
          body: JSON.stringify({
            modulo: opciones.modulo,
            anio,
            accion
          })
        });
        const datos = await respuesta.json();
        if (!respuesta.ok) {
          throw new Error(datos.mensaje || 'No fue posible actualizar el estado.');
        }
        estado.workflow = {
          estado: normalizarEstadoWorkflow(datos.estado),
          estadoRaw: datos.estadoRaw || datos.estado,
          actualizadoEn: datos.actualizadoEn,
          actualizadoPor: datos.actualizadoPor,
          historial: (datos.historial || []).map((registro) => ({
            ...registro,
            estado: normalizarEstadoWorkflow(registro.estado),
            estadoRaw: registro.estadoRaw || registro.estado
          }))
        };
        actualizarBadgeWorkflow();
        renderizarHistorial();
        actualizarDisponibilidadAcciones();
        showToast(datos.mensaje || 'Acción registrada correctamente.');
      } catch (error) {
        showToast(error.message || 'No fue posible aplicar la acción solicitada.', 'text-bg-danger');
      }
    };

    const actualizarDisponibilidadAcciones = () => {
      const { permisos } = obtenerPermisosActuales(sesion, opciones.modulo);
      const estadoActual = estado.workflow.estado;
      const puedeCargar = Boolean(permisos?.['Cargar y guardar']);
      const puedeRevisar = Boolean(permisos?.Revisar);
      const puedeAutorizar = Boolean(permisos?.Aprobar);
      const puedeGuardar = Boolean(permisos?.Aprobar);

      if (elementos.loadBudgetBtn) {
        elementos.loadBudgetBtn.classList.toggle('d-none', !puedeCargar);
        const habilitado = puedeCargar && TRANSICIONES.cargar.habilita(estadoActual);
        elementos.loadBudgetBtn.disabled = !habilitado;
        const etiqueta = habilitado ? 'Enviar presupuesto' : 'Cargar';
        const span = elementos.loadBudgetBtn.querySelector('span');
        if (span) {
          span.textContent = etiqueta;
        } else {
          elementos.loadBudgetBtn.textContent = etiqueta;
        }
      }
      if (elementos.reviewBudgetBtn) {
        elementos.reviewBudgetBtn.classList.toggle('d-none', !puedeRevisar);
        elementos.reviewBudgetBtn.disabled = !puedeRevisar || !TRANSICIONES.revisar.habilita(estadoActual);
      }
      if (elementos.authorizeBudgetBtn) {
        elementos.authorizeBudgetBtn.classList.toggle('d-none', !puedeAutorizar);
        elementos.authorizeBudgetBtn.disabled = !puedeAutorizar || !TRANSICIONES.autorizar.habilita(estadoActual);
      }
      if (elementos.saveBudgetBtn) {
        const habilitado = puedeGuardar && TRANSICIONES.guardar.habilita(estadoActual);
        elementos.saveBudgetBtn.classList.toggle('d-none', !habilitado);
        elementos.saveBudgetBtn.disabled = !habilitado;
      }
    };

    if (elementos.accountSearchInput) {
      elementos.accountSearchInput.addEventListener('input', (event) => {
        estado.filtro = event.target.value.trim().toLowerCase();
        renderizarTabla();
      });
    }

    const nombreArchivoModulo = opciones.modulo.replace(/[^a-zA-Z0-9_-]+/g, '-');

    const prepararPayloadPresupuesto = () => {
      return estado.cuentas.map((cuenta) => {
        const mensual = {};
        MESES.forEach(({ clave, periodo }) => {
          const valor = Number(cuenta[clave] ?? 0);
          mensual[`presup${periodo.toString().padStart(2, '0')}`] = Number.isFinite(valor) ? valor : 0;
        });
        return {
          numCta: cuenta.numCta,
          descripcion: cuenta.descripcion,
          anual: Number(cuenta.anual ?? 0) || 0,
          ...mensual
        };
      });
    };

    const guardarPresupuestoEnCoi = async () => {
      const empresa = Sesion.obtenerEmpresaActiva(sesion);
      if (!empresa?.id) {
        throw new Error('Selecciona una empresa válida antes de guardar.');
      }
      const registros = prepararPayloadPresupuesto();
      const payload = {
        empresaId: empresa.id,
        anio,
        cuentas: registros,
        modulo: opciones.modulo
      };
      const respuesta = await fetch(`${API_BASE}/presupuestos/guardar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...Sesion.headersAutenticacion()
        },
        body: JSON.stringify(payload)
      });
      const datos = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) {
        throw new Error(datos.mensaje || 'No fue posible guardar en COI (PRESUPYY).');
      }
      return datos;
    };

    if (elementos.saveBudgetBtn) {
      elementos.saveBudgetBtn.addEventListener('click', async () => {
        try {
          const csvContent = convertirTablaACsv();
          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          const downloadLink = document.createElement('a');
          const url = URL.createObjectURL(blob);
          downloadLink.href = url;
          downloadLink.download = `presupuesto_${nombreArchivoModulo}_${anio}.csv`;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
          URL.revokeObjectURL(url);
          await guardarPresupuestoEnCoi();
          showToast('Presupuesto exportado y guardado en COI correctamente.');
          await ejecutarAccionWorkflow('guardar');
        } catch (error) {
          console.error('Error al guardar presupuesto en COI', error);
          showToast(error.message || 'No fue posible guardar el presupuesto en COI.', 'text-bg-danger');
        }
      });
    }

    if (elementos.loadBudgetBtn && elementos.budgetFileInput) {
      elementos.loadBudgetBtn.addEventListener('click', () => {
        elementos.budgetFileInput.click();
      });

      elementos.budgetFileInput.addEventListener('change', (event) => {
        const file = event.target.files?.[0];
        if (!file) {
          return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
          const exito = actualizarDesdeCsv(e.target?.result || '');
          if (exito) {
            showToast('Presupuesto cargado correctamente.', 'text-bg-info');
            ejecutarAccionWorkflow('cargar');
          } else {
            showToast('El archivo seleccionado no contiene datos válidos.', 'text-bg-warning');
          }
        };
        reader.onerror = () => {
          showToast('No se pudo leer el archivo seleccionado.', 'text-bg-danger');
        };
        reader.readAsText(file);
        event.target.value = '';
      });
    }

    if (elementos.reviewBudgetBtn) {
      elementos.reviewBudgetBtn.addEventListener('click', () => ejecutarAccionWorkflow('revisar'));
    }

    if (elementos.authorizeBudgetBtn) {
      elementos.authorizeBudgetBtn.addEventListener('click', () => ejecutarAccionWorkflow('autorizar'));
    }

    if (elementos.approveBudgetBtn) {
      elementos.approveBudgetBtn.remove();
    }
    actualizarDisponibilidadAcciones();

    const inicializarDatos = async () => {
      actualizarEncabezadoEmpresa();
      await cargarPresupuestos();
      await obtenerWorkflow();
      if (!moduloReadyDispatched) {
        moduloReadyDispatched = true;
        window.dispatchEvent(new CustomEvent('modulo:ready', {
          detail: {
            modulo: opciones.modulo,
            anio
          }
        }));
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', inicializarDatos, { once: true });
    } else {
      inicializarDatos();
    }

    window.addEventListener(Sesion.EVENTO_EMPRESA, () => {
      cargarPresupuestos();
      obtenerWorkflow();
    });
  };

  window.initVistaPresupuesto = initVistaPresupuesto;
})();
