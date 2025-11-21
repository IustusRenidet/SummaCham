(() => {
  const API_BASE = 'http://localhost:3000/api';

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
    'sin-cargar': { texto: 'Sin cargar', descripcion: 'Esperando información.' },
    borrador: { texto: 'Cargado', descripcion: 'Pendiente de revisión.' },
    revisado: { texto: 'Revisado', descripcion: 'Listo para autorizar.' },
    autorizado: { texto: 'Autorizado', descripcion: 'Listo para exportar la versión final.' },
    aprobado: { texto: 'Aprobado', descripcion: 'Presupuesto final aprobado.' }
  };

  const TRANSICIONES = {
    cargar: { destino: 'borrador', permiso: 'Cargar y guardar', habilita: (estado) => ['sin-cargar', 'borrador'].includes(estado) },
    revisar: { destino: 'revisado', permiso: 'Revisar', habilita: (estado) => estado === 'borrador' },
    autorizar: { destino: 'autorizado', permiso: 'Aprobar', habilita: (estado) => estado === 'revisado' },
    aprobar: { destino: 'aprobado', permiso: 'Aprobar', habilita: (estado) => estado === 'autorizado' }
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

  const convertirTablaACsv = (tabla) => {
    if (!tabla) {
      return '';
    }
    const filas = Array.from(tabla.querySelectorAll('tr'));
    return filas.map((fila) => {
      const celdas = Array.from(fila.querySelectorAll('th,td'));
      return celdas.map((celda) => {
        const texto = celda.innerText.replace(/\s+/g, ' ').trim();
        const seguro = texto.replace(/"/g, '""');
        return `"${seguro}"`;
      }).join(',');
    }).join('\r\n');
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
    )).sort((a, b) => a - b);
  };

  const asegurarAniosVigentes = (lista = []) => {
    const actual = new Date().getFullYear();
    const conjunto = new Set(normalizarListaEnteros(lista));
    conjunto.add(actual);
    conjunto.add(actual + 1);
    return Array.from(conjunto).sort((a, b) => a - b);
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
    return lista[lista.length - 1];
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
      loadBudgetBtn: document.getElementById('loadBudgetBtn'),
      reviewBudgetBtn: document.getElementById('reviewBudgetBtn'),
      authorizeBudgetBtn: document.getElementById('authorizeBudgetBtn'),
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

    const estado = {
      filtro: '',
      filas: [],
      mostrarCuentas: true,
      anio: anioInicial,
      aniosDisponibles: [],
      editMode: false,
      cambiosPendientes: false,
      workflow: {
        estado: 'sin-cargar',
        actualizadoEn: null,
        actualizadoPor: '',
        historial: []
      }
    };

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

    const actualizarEncabezadosMes = () => {
      if (!Number.isInteger(estado.anio)) {
        return;
      }
      const sufijo = String(estado.anio).slice(-2);
      document.querySelectorAll('[data-mes]').forEach((th) => {
        const clave = th.dataset.mes || '';
        const meta = MESES_TABLA.find((item) => item.clave === clave);
        const baseEtiqueta = meta ? meta.etiqueta : clave.toUpperCase();
        th.textContent = `${baseEtiqueta}-${sufijo}`;
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
      actualizarYearLabels();
      actualizarEncabezadosMes();
      notificarContexto();
      obtenerWorkflow();
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
      try {
        const params = new URLSearchParams({ empresaId: empresa.id });
        const respuesta = await fetch(`${API_BASE}/${opciones.endpointAnios}/anios?${params.toString()}`, {
          headers: Sesion.headersAutenticacion()
        });
        if (!respuesta.ok) {
          throw new Error('No fue posible obtener los ejercicios disponibles.');
        }
        const datos = await respuesta.json();
        estado.aniosDisponibles = asegurarAniosVigentes(datos.anios || []);
      } catch (error) {
        console.error(`Error al cargar ejercicios de ${opciones.titulo}`, error);
        showToast(error.message || 'Sin ejercicios disponibles.', 'text-bg-danger');
        estado.aniosDisponibles = asegurarAniosVigentes([]);
      }
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
      if (!elementos.workflowBadge) {
        return;
      }
      const info = WORKFLOW_ETIQUETAS[estado.workflow.estado] || WORKFLOW_ETIQUETAS['sin-cargar'];
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
      const { permisos } = obtenerPermisosActuales(sesion, opciones.modulo);
      const estadoActual = estado.workflow.estado;
      const puedeCargar = Boolean(permisos?.[TRANSICIONES.cargar.permiso]);
      const puedeRevisar = Boolean(permisos?.[TRANSICIONES.revisar.permiso]);
      const puedeAutorizar = Boolean(permisos?.[TRANSICIONES.autorizar.permiso]);
      const puedeAprobar = Boolean(permisos?.[TRANSICIONES.aprobar.permiso]);

      if (elementos.loadBudgetBtn) {
        elementos.loadBudgetBtn.classList.toggle('d-none', !puedeCargar);
        elementos.loadBudgetBtn.disabled = !puedeCargar || !TRANSICIONES.cargar.habilita(estadoActual);
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
        elementos.saveBudgetBtn.classList.toggle('d-none', !puedeAprobar);
        elementos.saveBudgetBtn.disabled = !puedeAprobar || !TRANSICIONES.aprobar.habilita(estadoActual);
      }
    };

    const obtenerWorkflow = async () => {
      const { empresa } = obtenerPermisosActuales(sesion, opciones.modulo);
      if (!empresa || !Number.isInteger(estado.anio)) {
        estado.workflow = { estado: 'sin-cargar', actualizadoEn: null, actualizadoPor: '', historial: [] };
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
          estado: datos.estado || 'sin-cargar',
          actualizadoEn: datos.actualizadoEn || null,
          actualizadoPor: datos.actualizadoPor || '',
          historial: datos.historial || []
        };
      } catch (error) {
        console.warn(`Error al obtener el workflow de ${opciones.titulo}`, error);
        showToast(error.message || 'No se pudo actualizar el estado del flujo.', 'text-bg-danger');
        estado.workflow = { estado: 'sin-cargar', actualizadoEn: null, actualizadoPor: '', historial: [] };
      }
      actualizarBadgeWorkflow();
      renderizarHistorial();
      actualizarDisponibilidadAcciones();
    };

    const ejecutarAccionWorkflow = async (accion) => {
      if (!TRANSICIONES[accion]) {
        return;
      }
      if (!Number.isInteger(estado.anio)) {
        showToast('Selecciona un ejercicio válido antes de continuar.', 'text-bg-warning');
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
          estado: datos.estado || 'sin-cargar',
          actualizadoEn: datos.actualizadoEn || null,
          actualizadoPor: datos.actualizadoPor || '',
          historial: datos.historial || []
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
      const texto = estado.editMode ? 'Cancelar edición' : 'Cargar';
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
      actualizarTextoBotonCargar();
      showToast('Modo edición de presupuesto activo.', 'text-bg-info');
    };

    const cancelarEdicionPresupuesto = () => {
      if (window.CuentasModulo?.cancelEdit) {
        window.CuentasModulo.cancelEdit();
      }
      estado.editMode = false;
      estado.cambiosPendientes = false;
      actualizarTextoBotonCargar();
      showToast('Cambios descartados. Modo edición desactivado.', 'text-bg-warning');
    };

    if (elementos.loadBudgetBtn) {
      actualizarTextoBotonCargar();
      elementos.loadBudgetBtn.addEventListener('click', () => {
        if (estado.editMode) {
          cancelarEdicionPresupuesto();
          return;
        }
        activarEdicionPresupuesto();
      });
    }

    if (elementos.reviewBudgetBtn) {
      elementos.reviewBudgetBtn.addEventListener('click', () => ejecutarAccionWorkflow('revisar'));
    }

    if (elementos.authorizeBudgetBtn) {
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
    });

    if (elementos.saveBudgetBtn) {
      elementos.saveBudgetBtn.addEventListener('click', () => {
        const csv = convertirTablaACsv(elementos.tabla);
        if (!csv) {
          showToast('No se encontraron datos para exportar.', 'text-bg-warning');
          return;
        }
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement('a');
        enlace.href = url;
        const anioReferencia = Number.isInteger(estado.anio) ? estado.anio : new Date().getFullYear();
        enlace.download = `${nombreArchivoModulo}_${anioReferencia}.csv`;
        document.body.appendChild(enlace);
        enlace.click();
        document.body.removeChild(enlace);
        URL.revokeObjectURL(url);
        showToast('Información exportada correctamente.');
        ejecutarAccionWorkflow('aprobar');
      });
    }

    const inicializar = async () => {
      actualizarEncabezadoEmpresa();
      estado.filas = prepararFilasBusqueda(elementos.tabla);
      filtrarFilas();
      aplicarVisibilidadCuentas();
      await cargarAniosDisponibles();
      await obtenerWorkflow();
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
      await obtenerWorkflow();
    });
  };

  window.initVistaModuloPlaneacion = initVistaModuloPlaneacion;
  window.initVistaComites = initVistaModuloPlaneacion;
  window.formatearCuentaAspel = formatearCuentaAspel;
  window.quitarGuiones = quitarGuiones;
  window.cuentaConGuiones = cuentaConGuiones;
  window.cuentaLarga = cuentaLarga;
})();
