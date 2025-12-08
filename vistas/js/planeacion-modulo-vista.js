(() => {
  const origin = window.location.protocol === 'file:' ? 'http://localhost:3000' : window.location.origin;
  const API_BASE = `${origin}/api`;
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

  const crearSlug = (texto, fallback = 'modulo') => {
    if (!texto) {
      return fallback;
    }
    const base = typeof texto.normalize === 'function'
      ? texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      : texto;
    const slug = base.replace(/[^0-9a-zA-Z]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
    return slug || fallback;
  };

  const limpiarEndpoint = (segmento, fallback = 'comites') => {
    const limpio = String(segmento || '').trim().replace(/^\/+|\/+$/g, '');
    return limpio || fallback;
  };

  const obtenerSelectEjercicio = () => {
    return document.querySelector('[data-role="module-year-select"]') || document.querySelector('select[id$="YearSelect"]');
  };

  const formatearCuentaAspel = (numLargo) => {
    const s = (numLargo ?? '').toString().padStart(11, '0');
    const a = s.slice(0, 3);
    const b = s.slice(3, 6);
    const c = s.slice(6, 9);
    const d = s.slice(9, 11);
    return `${a}-${b}-${c}-${d}`;
  };

  const normalizarCuentaBase = (cuenta) => {
    if (!cuenta) {
      return '';
    }
    return cuenta.toString().replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  };

  const construirCuentaLarga = (valor) => {
    const base = normalizarCuentaBase(valor).padEnd(11, '0').slice(0, 11);
    if (!base.trim()) {
      return '';
    }
    const nivel = deducirNivel(base);
    return base.padEnd(20, '0') + nivel;
  };

  const quitarGuiones = (cuenta) => construirCuentaLarga(cuenta);

  const cuentaConGuiones = (numLargo) => {
    const s = String(numLargo || '').padStart(21, '0');
    const visible = s.slice(0, 11);
    return `${visible.slice(0, 3)}-${visible.slice(3, 6)}-${visible.slice(6, 9)}-${visible.slice(9, 11)}`;
  };

  const deducirNivel = (base) => {
    const limpio = normalizarCuentaBase(base).padEnd(11, '0').slice(0, 11);
    const b = limpio.slice(3, 6);
    const c = limpio.slice(6, 9);
    const d = limpio.slice(9, 11);
    if (b === '000' && c === '000' && d === '00') return '1';
    if (c === '000' && d === '00') return '2';
    if (d === '00') return '3';
    return '4';
  };

  const cuentaLarga = (cuentaLegible) => construirCuentaLarga(cuentaLegible);

  const WORKFLOW_ETIQUETAS = {
    SIN_CARGAR: { texto: 'Sin cargar', descripcion: 'Esperando informacion.' },
    EDITANDO: { texto: 'En edicion', descripcion: 'Borrador en curso.' },
    PENDIENTE: { texto: 'Pendiente', descripcion: 'Enviado a revision.' },
    REVISADO: { texto: 'Revisado', descripcion: 'Listo para autorizar o volver a editar.' },
    APROBADO: { texto: 'Aprobado', descripcion: 'Listo para guardar en base de datos.' },
    GUARDADO: { texto: 'Guardado', descripcion: 'Movimiento de guardado en el flujo de autorizacion.' },
    RECHAZADO: { texto: 'Rechazado', descripcion: 'Devuelto para ajustes.' }
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

  const formatoFecha = new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  const obtenerConfigDesdeDataset = () => {
    const dataset = document.body?.dataset || {};
    const modulo = dataset.modulo || 'Planeacion';
    const alias = dataset.moduloAlias || modulo;
    const endpointAnios = dataset.endpointAnios || '';
    return {
      modulo,
      titulo: alias,
      endpointAnios
    };
  };

  const actualizarTexto = (elemento, texto) => {
    if (elemento) {
      elemento.textContent = texto;
    }
  };

  const obtenerPermisosActuales = (sesion, modulo) => {
    const empresa = Sesion.obtenerEmpresaActiva(sesion);
    if (!empresa) {
      return { empresa: null, permisos: null };
    }
    const permisos = Sesion.obtenerPermisosModulo(modulo, empresa.id, sesion) || {};
    return { empresa, permisos };
  };

  const formatearFecha = (valor) => {
    if (!valor) {
      return '';
    }
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) {
      return '';
    }
    return formatoFecha.format(fecha);
  };

  const prepararFilasBusqueda = (tabla) => {
    if (!tabla) {
      return [];
    }
    const filas = Array.from(tabla.querySelectorAll('tbody tr'));
    filas.forEach((fila) => {
      if (fila.classList.contains('section-header-row') || fila.classList.contains('sum-row') || fila.classList.contains('result-row')) {
        fila.dataset.busqueda = '';
        return;
      }
      const cuenta = fila.children[0]?.textContent?.trim().toLowerCase() || '';
      const descripcion = fila.children[1]?.textContent?.trim().toLowerCase() || '';
      fila.dataset.busqueda = `${cuenta} ${descripcion}`.trim();
    });
    return filas;
  };

  const MESES_TABLA = [
    { clave: 'ene', etiqueta: 'ENE' },
    { clave: 'feb', etiqueta: 'FEB' },
    { clave: 'mar', etiqueta: 'MAR' },
    { clave: 'abr', etiqueta: 'ABR' },
    { clave: 'may', etiqueta: 'MAY' },
    { clave: 'jun', etiqueta: 'JUN' },
    { clave: 'jul', etiqueta: 'JUL' },
    { clave: 'ago', etiqueta: 'AGO' },
    { clave: 'sep', etiqueta: 'SEP' },
    { clave: 'oct', etiqueta: 'OCT' },
    { clave: 'nov', etiqueta: 'NOV' },
    { clave: 'dic', etiqueta: 'DIC' }
  ];

  const normalizarListaEnteros = (lista) => {
    return Array.from(new Set(
      (Array.isArray(lista) ? lista : [])
        .map((valor) => Number(valor))
        .filter((valor) => Number.isInteger(valor))
    )).sort((a, b) => b - a); // Descendente: más recientes primero
  };

  const asegurarAniosVigentes = (lista = []) => {
    return normalizarListaEnteros(lista);
  };

  const soporteAniosPorEndpoint = new Map();
  const obtenerAniosDesdeEndpoint = async (empresaId, endpointAnios = 'saldos') => {
    const endpoint = limpiarEndpoint(endpointAnios, 'saldos');
    if (!empresaId) return [];
    if (soporteAniosPorEndpoint.get(endpoint) === false) return [];
    try {
      const params = new URLSearchParams({ empresaId });
      const resp = await fetch(`${API_BASE}/${endpoint}/anios?${params.toString()}`, {
        headers: Sesion.headersAutenticacion()
      });
      const datos = await resp.json();
      if (!resp.ok) {
        if (resp.status === 404) {
          soporteAniosPorEndpoint.set(endpoint, false);
          return [];
        }
        throw new Error(datos.mensaje || 'No fue posible obtener los ejercicios disponibles.');
      }
      return normalizarListaEnteros(datos.anios || []);
    } catch (error) {
      console.warn(`No fue posible obtener ejercicios desde ${endpoint}`, error);
      return [];
    }
  };

  const seleccionarAnio = (lista = [], preferido) => {
    if (!lista.length) {
      return Number.isInteger(preferido) ? preferido : new Date().getFullYear();
    }
    if (Number.isInteger(preferido) && lista.includes(preferido)) {
      return preferido;
    }
    const actual = new Date().getFullYear();
    if (lista.includes(actual)) {
      return actual;
    }
    // Lista descendente: primer elemento es el más reciente
    return lista[0];
  };

  const initVistaModuloPlaneacion = (config = {}) => {
    const sesion = Sesion.requerirSesion();
    if (!sesion) {
      return;
    }

    const opciones = { endpointAnios: 'comites', ...obtenerConfigDesdeDataset(), ...config };
    opciones.endpointAnios = limpiarEndpoint(opciones.endpointAnios, 'comites');
    const nombreArchivoModulo = crearSlug(opciones.titulo || opciones.modulo || 'modulo');
    const datasetAnio = Number(document.body?.dataset?.anio);
    const anioInicial = Number.isInteger(datasetAnio) ? datasetAnio : new Date().getFullYear();

    const elementos = {
      tabla: document.getElementById('tablaComparacion'),
      accountSearchInput: document.getElementById('accountSearch'),
      // Preferimos los IDs estandarizados del flujo de autorización y caemos al alias legado si existe.
      loadBudgetBtn: document.getElementById('btnGuardarBorrador') || document.getElementById('loadBudgetBtn'),
      reviewBudgetBtn: document.getElementById('btnMarcarRevisado') || document.getElementById('reviewBudgetBtn'),
      authorizeBudgetBtn: document.getElementById('btnAutorizar') || document.getElementById('authorizeBudgetBtn'),
      saveBudgetBtn: document.getElementById('saveBudgetBtn'),
      budgetFileInput: document.getElementById('budgetFileInput'),
      toggleAccountsBtn: document.getElementById('toggleAccountsBtn'),
      workflowBadge: document.getElementById('workflowBadge'),
      workflowMeta: document.getElementById('workflowMeta'),
      workflowHistory: document.getElementById('workflowHistory'),
      toastElement: document.getElementById('actionToast'),
      toastBody: document.getElementById('actionToastBody'),
      yearLabel: document.getElementById('yearLabel'),
      yearColumn: document.getElementById('yearColumn'),
      empresaLabel: document.getElementById('empresaLabel'),
      yearSelect: obtenerSelectEjercicio()
    };

    const toastInstance = window.bootstrap?.Toast.getOrCreateInstance(elementos.toastElement, { delay: 3000 });

    const EVENTO_CONTEXTO = 'planeacion:contexto-actualizado';
    const workflowControlExterno = true; // workflow lo maneja flujo-autorizacion.js

  const estado = {
    filtro: '',
    filas: [],
    mostrarCuentas: true,
    anio: anioInicial,
      aniosDisponibles: [],
      editMode: false,
      cambiosPendientes: false,
    workflow: {
      estado: 'SIN_CARGAR',
      actualizadoEn: null,
      actualizadoPor: '',
      historial: []
    },
    borradorGuardado: false
  };
  let moduloReadyDispatched = false;

    const notificarContexto = () => {
      const empresa = Sesion.obtenerEmpresaActiva(sesion);
      const detalle = {
        empresaId: empresa?.id || null,
        anio: Number.isInteger(estado.anio) ? estado.anio : null,
        modulo: opciones.modulo
      };
      window.dispatchEvent(new CustomEvent(EVENTO_CONTEXTO, { detail: detalle }));
    };

    const actualizarYearLabels = () => {
      if (elementos.yearLabel) {
        actualizarTexto(elementos.yearLabel, estado.anio);
      }
      if (elementos.yearColumn) {
        actualizarTexto(elementos.yearColumn, estado.anio);
      }
      document.querySelectorAll('.anio').forEach((span) => {
        span.textContent = estado.anio;
      });
      if (elementos.yearSelect && Number(elementos.yearSelect.value) !== Number(estado.anio)) {
        elementos.yearSelect.value = String(estado.anio ?? '');
      }
    };

    const obtenerPrefijoMes = (th) => {
      if (!th) return '';
      if (th.classList.contains('month-budget')) return 'Ppto ';
      if (th.classList.contains('month-real')) return 'Real ';
      return '';
    };

    const actualizarEncabezadosMes = () => {
      if (!Number.isInteger(estado.anio)) {
        return;
      }
      const sufijo = String(estado.anio).slice(-2);
      document.querySelectorAll('[data-mes]').forEach((th) => {
        const clave = th.dataset.mes || '';
        const meta = MESES_TABLA.find((item) => item.clave === clave);
        const baseEtiqueta = meta ? meta.etiqueta : clave.toUpperCase();
        const prefijo = obtenerPrefijoMes(th);
        th.textContent = `${prefijo}${baseEtiqueta}-${sufijo}`;
      });
    };

    const actualizarSelectAnio = () => {
      if (!elementos.yearSelect) {
        return;
      }
      elementos.yearSelect.innerHTML = '';
      if (!estado.aniosDisponibles.length) {
        const opcion = document.createElement('option');
        opcion.value = '';
        opcion.textContent = 'Sin ejercicios disponibles';
        elementos.yearSelect.appendChild(opcion);
        elementos.yearSelect.disabled = true;
        return;
      }

      estado.aniosDisponibles.forEach((anio) => {
        const opcion = document.createElement('option');
        opcion.value = String(anio);
        opcion.textContent = String(anio);
        elementos.yearSelect.appendChild(opcion);
      });
      elementos.yearSelect.disabled = false;
      elementos.yearSelect.value = String(estado.anio ?? '');
    };

    const establecerAnioActivo = (nuevoAnio) => {
      if (!Number.isInteger(nuevoAnio)) {
        return;
      }
      if (estado.anio === nuevoAnio) {
        return;
      }
      estado.anio = nuevoAnio;
      estado.editMode = false;
      estado.borradorGuardado = false;
      estado.cambiosPendientes = false;
      actualizarTextoBotonCargar();
      actualizarYearLabels();
      actualizarEncabezadosMes();
      notificarContexto();
      if (!workflowControlExterno) {
        obtenerWorkflow();
      }
    };

    const cargarAniosDisponibles = async () => {
      const empresa = Sesion.obtenerEmpresaActiva(sesion);
      if (!empresa?.id) {
        estado.aniosDisponibles = asegurarAniosVigentes([]);
        estado.anio = seleccionarAnio(estado.aniosDisponibles, estado.anio);
        actualizarSelectAnio();
        actualizarYearLabels();
        actualizarEncabezadosMes();
        return;
      }
      const aniosDisponibles = await obtenerAniosDesdeEndpoint(empresa.id, opciones.endpointAnios);
      estado.aniosDisponibles = asegurarAniosVigentes(aniosDisponibles);
      estado.anio = seleccionarAnio(estado.aniosDisponibles, estado.anio);
      actualizarSelectAnio();
      actualizarYearLabels();
      actualizarEncabezadosMes();
      notificarContexto();
    };

    actualizarYearLabels();
    actualizarEncabezadosMes();

    const showToast = (mensaje, clase = 'text-bg-success') => {
      if (!elementos.toastElement || !toastInstance) {
        return;
      }
      elementos.toastElement.className = `toast align-items-center border-0 ${clase}`;
      if (elementos.toastBody) {
        elementos.toastBody.textContent = mensaje;
      }
      toastInstance.show();
    };

    const actualizarEncabezadoEmpresa = () => {
      const empresa = Sesion.obtenerEmpresaActiva(sesion);
      const etiqueta = empresa?.etiqueta || empresa?.nombre || '-';
      actualizarTexto(elementos.empresaLabel, etiqueta);
    };

    const filtrarFilas = () => {
      if (!estado.filas.length) {
        estado.filas = prepararFilasBusqueda(elementos.tabla);
      }
      const termino = estado.filtro;
      estado.filas.forEach((fila) => {
        const texto = fila.dataset.busqueda;
        if (!texto) {
          fila.classList.remove('d-none');
          return;
        }
        const visible = !termino || texto.includes(termino);
        fila.classList.toggle('d-none', !visible);
      });
    };

    const aplicarVisibilidadCuentas = () => {
      if (!elementos.tabla) {
        return;
      }
      elementos.tabla.classList.toggle('sin-cuentas', !estado.mostrarCuentas);
      if (elementos.toggleAccountsBtn) {
        elementos.toggleAccountsBtn.textContent = estado.mostrarCuentas ? 'Ocultar cuentas' : 'Mostrar cuentas';
        elementos.toggleAccountsBtn.setAttribute('aria-pressed', estado.mostrarCuentas ? 'true' : 'false');
      }
    };

    const actualizarBadgeWorkflow = () => {
      if (workflowControlExterno) {
        return;
      }
      if (!elementos.workflowBadge) {
        return;
      }
      const info = WORKFLOW_ETIQUETAS[estado.workflow.estado] || WORKFLOW_ETIQUETAS.SIN_CARGAR;
      elementos.workflowBadge.dataset.estado = estado.workflow.estado;
      elementos.workflowBadge.textContent = info.texto;
      if (elementos.workflowMeta) {
        const fecha = formatearFecha(estado.workflow.actualizadoEn);
        const usuario = estado.workflow.actualizadoPor ? ` por ${estado.workflow.actualizadoPor}` : '';
        const meta = fecha ? `${info.descripcion} Actualizado ${fecha}${usuario}.` : info.descripcion;
        elementos.workflowMeta.textContent = meta;
      }
    };

    const renderizarHistorial = () => {
      if (workflowControlExterno) {
        return;
      }
      if (!elementos.workflowHistory) {
        return;
      }
      elementos.workflowHistory.innerHTML = '';
      const historial = estado.workflow.historial || [];
      if (!historial.length) {
        const li = document.createElement('li');
        li.className = 'list-group-item small text-muted';
        li.textContent = 'Sin movimientos registrados.';
        elementos.workflowHistory.appendChild(li);
        return;
      }
      historial.forEach((registro) => {
        const item = document.createElement('li');
        item.className = 'list-group-item';
        const etiqueta = WORKFLOW_ETIQUETAS[registro.estado]?.texto || registro.estado;
        const fecha = formatearFecha(registro.fecha);
        const usuario = registro.usuario ? ` · ${registro.usuario}` : '';
        item.textContent = `${etiqueta} · ${fecha}${usuario}`;
        elementos.workflowHistory.appendChild(item);
      });
    };

    const actualizarDisponibilidadAcciones = () => {
      if (workflowControlExterno) {
        return;
      }
      const { permisos } = obtenerPermisosActuales(sesion, opciones.modulo);
      const estadoActual = estado.workflow.estado;
      const esAdminGlobal = Sesion.esAdminGlobal(sesion);
      const puedeCargar = esAdminGlobal || Boolean(permisos?.[TRANSICIONES.cargar.permiso]);
      const puedeRevisar = esAdminGlobal || Boolean(permisos?.[TRANSICIONES.revisar.permiso]);
      const puedeAutorizar = esAdminGlobal || Boolean(permisos?.[TRANSICIONES.autorizar.permiso]);
      const puedeGuardar = esAdminGlobal || Boolean(permisos?.[TRANSICIONES.guardar.permiso]);

      const limiteCarga = esAdminGlobal || estadoActual === 'SIN_CARGAR';
      if (elementos.loadBudgetBtn) {
        elementos.loadBudgetBtn.classList.toggle('d-none', !puedeCargar);
        elementos.loadBudgetBtn.disabled = !puedeCargar || !limiteCarga;
      }
      const requiereGuardado = estado.borradorGuardado && !estado.editMode;
      if (elementos.reviewBudgetBtn) {
        elementos.reviewBudgetBtn.classList.toggle('d-none', esAdminGlobal || !puedeRevisar);
        elementos.reviewBudgetBtn.disabled = esAdminGlobal || !puedeRevisar || !(esAdminGlobal || (requiereGuardado && TRANSICIONES.revisar.habilita(estadoActual)));
      }
      if (elementos.authorizeBudgetBtn) {
        elementos.authorizeBudgetBtn.classList.toggle('d-none', esAdminGlobal || !puedeAutorizar);
        elementos.authorizeBudgetBtn.disabled = esAdminGlobal || !puedeAutorizar || !(esAdminGlobal || (requiereGuardado && TRANSICIONES.autorizar.habilita(estadoActual)));
      }
      if (elementos.saveBudgetBtn) {
        const visibleGuardar = esAdminGlobal || (requiereGuardado && estadoActual === 'APROBADO');
        elementos.saveBudgetBtn.classList.toggle('d-none', !puedeGuardar || !visibleGuardar);
        elementos.saveBudgetBtn.disabled = !puedeGuardar || !visibleGuardar || !(esAdminGlobal || (requiereGuardado && TRANSICIONES.guardar.habilita(estadoActual)));
      }
    };

    const obtenerWorkflow = async () => {
      if (workflowControlExterno) {
        return;
      }
      const { empresa } = obtenerPermisosActuales(sesion, opciones.modulo);
      if (!empresa || !Number.isInteger(estado.anio)) {
        estado.workflow = { estado: 'SIN_CARGAR', actualizadoEn: null, actualizadoPor: '', historial: [] };
        actualizarBadgeWorkflow();
        renderizarHistorial();
        actualizarDisponibilidadAcciones();
        return;
      }
      try {
        const params = new URLSearchParams({ modulo: opciones.modulo, anio: estado.anio });
        const respuesta = await fetch(`${API_BASE}/presupuestos/estado?${params.toString()}`, {
          headers: {
            ...Sesion.headersAutenticacion()
          }
        });
        if (!respuesta.ok) {
          throw new Error('No fue posible obtener el estado actual.');
        }
        const datos = await respuesta.json();
        estado.workflow = {
          estado: normalizarEstadoWorkflow(datos.estado),
          estadoRaw: datos.estadoRaw || datos.estado,
          actualizadoEn: datos.actualizadoEn || null,
          actualizadoPor: datos.actualizadoPor || '',
          historial: (datos.historial || []).map((registro) => ({
            ...registro,
            estado: normalizarEstadoWorkflow(registro.estado),
            estadoRaw: registro.estadoRaw || registro.estado
          }))
        };
      } catch (error) {
        console.warn(`Error al obtener el workflow de ${opciones.titulo}`, error);
        showToast(error.message || 'No se pudo actualizar el estado del flujo.', 'text-bg-danger');
        estado.workflow = { estado: 'SIN_CARGAR', actualizadoEn: null, actualizadoPor: '', historial: [] };
      }
      actualizarBadgeWorkflow();
      renderizarHistorial();
      actualizarDisponibilidadAcciones();
    };

    const ejecutarAccionWorkflow = async (accion) => {
      if (workflowControlExterno) {
        return;
      }
      if (!TRANSICIONES[accion]) {
        return;
      }
      if (!Number.isInteger(estado.anio)) {
        showToast('Selecciona un ejercicio válido antes de continuar.', 'text-bg-warning');
        return;
      }
      const requiereGuardado = new Set(['revisar', 'autorizar', 'guardar']);
      if (!Sesion.esAdminGlobal(sesion) && requiereGuardado.has(accion)) {
        if (estado.editMode) {
          showToast('Finaliza la edición (Cancelar) antes de continuar.', 'text-bg-warning');
          return;
        }
        if (!estado.borradorGuardado) {
          showToast('Guarda el borrador antes de avanzar en el flujo.', 'text-bg-warning');
          return;
        }
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
            anio: estado.anio,
            accion
          })
        });
        if (!respuesta.ok) {
          const datos = await respuesta.json().catch(() => ({}));
          throw new Error(datos.mensaje || 'No fue posible actualizar el flujo.');
        }
        const datos = await respuesta.json();
        estado.workflow = {
          estado: normalizarEstadoWorkflow(datos.estado),
          estadoRaw: datos.estadoRaw || datos.estado,
          actualizadoEn: datos.actualizadoEn || null,
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
        showToast(datos.mensaje || 'Acción registrada correctamente.');
      } catch (error) {
        console.error(`Error al ejecutar la transición del workflow de ${opciones.titulo}`, error);
        showToast(error.message || 'No fue posible completar la acción solicitada.', 'text-bg-danger');
      }
    };

    const guardarPresupuestoEnBD = async () => {
      if (workflowControlExterno) {
        throw new Error('El guardado en base de datos es manejado por el nuevo flujo de autorizacion.');
      }
      const empresa = Sesion.obtenerEmpresaActiva(sesion);
      const anioSeleccionado = Number.isInteger(estado.anio) ? estado.anio : null;
      if (!empresa?.id || !anioSeleccionado) {
        throw new Error('Selecciona una empresa y ejercicio válidos antes de guardar.');
      }
      const cambios = window.CuentasModulo?.getCambios?.() || {};
      const payload = {
        modulo: opciones.modulo,
        empresaId: empresa.id,
        anio: anioSeleccionado,
        datos: cambios
      };
      const respuesta = await fetch(`${API_BASE}/presupuestos/guardar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...Sesion.headersAutenticacion()
        },
        body: JSON.stringify(payload)
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        throw new Error(datos.mensaje || 'No fue posible guardar los datos en la base de datos.');
      }
      return datos;
    };

    if (elementos.yearSelect) {
      elementos.yearSelect.addEventListener('change', (event) => {
        const seleccionado = Number(event.target.value);
        if (Number.isInteger(seleccionado)) {
          establecerAnioActivo(seleccionado);
        } else if (estado.anio != null) {
          event.target.value = String(estado.anio);
        }
      });
    }

    if (elementos.accountSearchInput) {
      elementos.accountSearchInput.addEventListener('input', (event) => {
        estado.filtro = event.target.value.trim().toLowerCase();
        filtrarFilas();
      });
    }

    const actualizarTextoBotonCargar = () => {
      if (!elementos.loadBudgetBtn) return;
      const span = elementos.loadBudgetBtn.querySelector('span');
      const texto = estado.editMode ? 'Terminar edición' : 'Cargar';
      if (span) {
        span.textContent = texto;
      } else {
        elementos.loadBudgetBtn.textContent = texto;
      }
    };

    const activarEdicionPresupuesto = () => {
      if (window.CuentasModulo?.setEditMode) {
        window.CuentasModulo.setEditMode(true);
      }
      estado.editMode = true;
      estado.borradorGuardado = false;
      actualizarTextoBotonCargar();
      showToast('Modo edición de presupuesto activo.', 'text-bg-info');
    };

    const cancelarEdicionPresupuesto = () => {
      if (!estado.editMode) return;
      estado.editMode = false;
      estado.cambiosPendientes = false;
      estado.borradorGuardado = true;
      actualizarTextoBotonCargar();
      showToast('Edición guardada y lista para continuar.', 'text-bg-success');
    };

    if (!workflowControlExterno && elementos.loadBudgetBtn) {
      actualizarTextoBotonCargar();
      elementos.loadBudgetBtn.addEventListener('click', () => {
        if (estado.editMode) {
          cancelarEdicionPresupuesto();
          return;
        }
        activarEdicionPresupuesto();
        ejecutarAccionWorkflow('cargar');
      });
    }

    if (!workflowControlExterno && elementos.reviewBudgetBtn) {
      elementos.reviewBudgetBtn.addEventListener('click', () => ejecutarAccionWorkflow('revisar'));
    }

    if (!workflowControlExterno && elementos.authorizeBudgetBtn) {
      elementos.authorizeBudgetBtn.addEventListener('click', () => ejecutarAccionWorkflow('autorizar'));
    }

    if (elementos.toggleAccountsBtn) {
      elementos.toggleAccountsBtn.addEventListener('click', () => {
        estado.mostrarCuentas = !estado.mostrarCuentas;
        aplicarVisibilidadCuentas();
      });
    }

    window.addEventListener('modulo-planeacion:presupuesto-editado', (event) => {
      estado.cambiosPendientes = Boolean(event?.detail?.hayCambios);
      if (event?.detail?.borradorGuardado) {
        estado.borradorGuardado = true;
      }
    });

    if (!workflowControlExterno && elementos.saveBudgetBtn) {
      elementos.saveBudgetBtn.addEventListener('click', async () => {
        try {
          const respuesta = await guardarPresupuestoEnBD();
          showToast(respuesta.mensaje || 'Datos guardados en la base de datos.');
          await ejecutarAccionWorkflow('guardar');
          estado.borradorGuardado = true;
        } catch (error) {
          console.error('Error al guardar presupuesto en BD', error);
          showToast(error.message || 'No fue posible guardar el presupuesto.', 'text-bg-danger');
        }
      });
    }

    const inicializar = async () => {
      actualizarEncabezadoEmpresa();
      estado.filas = prepararFilasBusqueda(elementos.tabla);
      filtrarFilas();
      aplicarVisibilidadCuentas();
      await cargarAniosDisponibles();
      if (!workflowControlExterno) {
        await obtenerWorkflow();
      }
      if (!moduloReadyDispatched) {
        moduloReadyDispatched = true;
        window.dispatchEvent(new CustomEvent('modulo:ready', {
          detail: {
            modulo: opciones.modulo,
            anio: estado.anio
          }
        }));
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => { inicializar(); }, { once: true });
    } else {
      inicializar();
    }

    window.addEventListener('modulo-planeacion:tabla-actualizada', () => {
      estado.filas = prepararFilasBusqueda(elementos.tabla);
      filtrarFilas();
    });

    window.addEventListener(Sesion.EVENTO_EMPRESA, async () => {
      actualizarEncabezadoEmpresa();
      await cargarAniosDisponibles();
      if (!workflowControlExterno) {
        await obtenerWorkflow();
      }
    });
  };

  window.initVistaModuloPlaneacion = initVistaModuloPlaneacion;
  window.initVistaComites = initVistaModuloPlaneacion;
  window.formatearCuentaAspel = formatearCuentaAspel;
  window.quitarGuiones = quitarGuiones;
  window.cuentaConGuiones = cuentaConGuiones;
  window.cuentaLarga = cuentaLarga;

  (() => {
    const esperarCuentasModulo = () =>
      new Promise((resolve) => {
        if (window.CuentasModulo) {
          resolve();
          return;
        }
        let timeoutId = null;
        const interval = setInterval(() => {
          if (window.CuentasModulo) {
            clearInterval(interval);
            if (timeoutId) clearTimeout(timeoutId);
            resolve();
          }
        }, 100);
        timeoutId = setTimeout(() => {
          clearInterval(interval);
          resolve();
        }, 5000);
      });

    const limpiarBotonesInteractivos = () => {
      document
        .querySelectorAll(
          '.btn:not(.disabled):not(:disabled),button:not(.disabled):not(:disabled),a:not(.disabled)'
        )
        .forEach((elemento) => {
          elemento.style.pointerEvents = 'auto';
          elemento.style.cursor = 'pointer';
        });
    };

    const limpiarPointerEventsGlobales = () => {
      limpiarBotonesInteractivos();

      // Remover backdrops residuales solo si no hay elementos visibles
      const hayContenedorVisible = Boolean(
        document.querySelector('.modal.show, .offcanvas.show')
      );
      if (!hayContenedorVisible) {
        document
          .querySelectorAll('.modal-backdrop, .offcanvas-backdrop, [class*="backdrop"]')
          .forEach((backdrop) => backdrop.remove());
      }

      // Asegurar que elementos ocultos no bloqueen clics
      document.querySelectorAll('[hidden]').forEach((el) => {
        el.style.pointerEvents = 'none';
        const zIndex = Number.parseInt(window.getComputedStyle(el).zIndex, 10);
        if (Number.isFinite(zIndex) && zIndex > 100) {
          el.style.zIndex = '-1';
        }
      });
    };

    const inicializarLimpieza = async () => {
      await esperarCuentasModulo();
      if (window.CuentasModulo) {
        try {
          window.CuentasModulo.cancelEdit?.();
          window.CuentasModulo.setEditMode?.(false);
        } catch (error) {
          console.warn(
            "No fue posible limpiar el modo edicion de CuentasModulo:",
            error
          );
        }
      }
      const instancia = window.__flujoAutorizacionInstance;
      if (instancia?.state?.editMode) {
        instancia._exitEditMode?.(true);
        instancia.state.hayCambios = false;
        if (typeof instancia.callbacks?.onCancelEdit === "function") {
          try {
            instancia.callbacks.onCancelEdit();
          } catch (error) {
            console.warn(
              "Error al ejecutar callback de cancelacion durante la limpieza:",
              error
            );
          }
        }
      }
      limpiarBotonesInteractivos();
      limpiarPointerEventsGlobales();
      console.info("Vista de planeacion inicializada con limpieza de estado.");
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", inicializarLimpieza, {
        once: true,
      });
    } else {
      inicializarLimpieza();
    }

    setInterval(limpiarPointerEventsGlobales, 5000);

    window.addEventListener("beforeunload", (event) => {
      const instancia = window.__flujoAutorizacionInstance;
      if (instancia?.state?.editMode && instancia?.state?.hayCambios) {
        const mensaje = "Salir sin guardar los cambios?";
        event.preventDefault();
        event.returnValue = mensaje;
        return mensaje;
      }
      return undefined;
    });
  })();
})();
