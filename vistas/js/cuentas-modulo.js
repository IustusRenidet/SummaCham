(() => {
  const API_BASE = 'http://localhost:3000/api';
  const EVENTO_TABLA_ACTUALIZADA = 'modulo-planeacion:tabla-actualizada';
  const EVENTO_CONTEXTO = 'planeacion:contexto-actualizado';
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  const normalizarTexto = (valor) => {
    if (valor == null) return '';
    return valor
      .toString()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase();
  };

  const normalizarSheetId = (texto) => normalizarTexto(texto).replace(/[\s._]+/g, '');
  const normalizarModuloClave = (valor) => normalizarTexto(valor || '').replace(/[^A-Z0-9]/g, '').toLowerCase();

  const obtenerTabla = (selector) => {
    if (selector) {
      const desdeSelector = document.querySelector(selector);
      if (desdeSelector) return desdeSelector;
    }
    return document.querySelector('#tablaComparacion');
  };

  const contarColumnas = (tabla) => {
    if (!tabla || !tabla.tHead) return 2;
    const filas = Array.from(tabla.tHead.rows || []);
    if (!filas.length) {
      return tabla.tHead.querySelectorAll('th').length || 2;
    }
    const ultima = filas[filas.length - 1];
    return (ultima && ultima.cells.length) || filas[0].cells.length || 2;
  };

  const crearFilaEstado = (mensaje, colspan) => {
    const fila = document.createElement('tr');
    fila.className = 'estado-tabla';
    const celda = document.createElement('td');
    celda.colSpan = colspan;
    celda.textContent = mensaje;
    fila.appendChild(celda);
    return fila;
  };

  const limpiarBody = (tbody) => {
    while (tbody.firstChild) {
      tbody.removeChild(tbody.firstChild);
    }
  };

  const obtenerConfigModulo = () => {
    const dataset = document.body?.dataset || {};
    const moduloId = dataset.moduloId || dataset.modulo || '';
    const moduloSheet = dataset.moduloSheet || '';
    return { moduloId, moduloSheet };
  };

  const MODULOS_SOPORTADOS = new Set([
    'comites',
    'comunicacion',
    'direccion',
    'eventos',
    'finanzas',
    'gtoscorporativos',
    'membresia',
    'rh',
    'servmembresia',
    'tic',
    'vpe'
  ]);

  const estadoModulo = {
    moduloId: '',
    moduloClave: '',
    sheet: '',
    columnas: {},
    tabla: null,
    ultimaSolicitud: 0,
    anio: null,
    tooltips: [],
    editMode: false,
    editSnapshot: null,
    hayCambios: false,
    sumas: {
      secciones: [],
      sumavariosRows: new Map(),
      resultRows: new Map()
    },
    valoresPorCuenta: new Map(),
    nombresPorCuenta: new Map()
  };

  const obtenerYearSelect = () => {
    return document.querySelector('[data-role="module-year-select"]') || document.querySelector('select[id$="YearSelect"]');
  };

  const obtenerAnioSeleccionado = () => {
    const select = obtenerYearSelect();
    if (select) {
      const crudo = (select.value || '').trim();
      if (crudo) {
        const valor = Number(crudo);
        if (Number.isInteger(valor)) {
          estadoModulo.anio = valor;
          return valor;
        }
      }
    }
    if (Number.isInteger(estadoModulo.anio)) {
      return estadoModulo.anio;
    }
    return null;
  };

  const construirMapaColumnas = (tabla) => {
    if (!tabla?.tHead) {
      return {};
    }
    const mapa = {};
    const cabeceras = Array.from(tabla.tHead.querySelectorAll('th'));
    cabeceras.forEach((th, indice) => {
      if (th.classList.contains('month-budget')) {
        const clave = th.dataset.mes || '';
        mapa[`budget-${clave}`] = indice;
      } else if (th.classList.contains('month-real')) {
        const clave = th.dataset.mes || '';
        mapa[`real-${clave}`] = indice;
      } else if (th.classList.contains('year-column')) {
        mapa.year = indice;
      } else if (th.classList.contains('total-budget-column')) {
        mapa['total-budget'] = indice;
      } else if (th.classList.contains('total-real-column')) {
        mapa['total-real'] = indice;
      }
    });
    return mapa;
  };

  const invertirColumnas = () => {
    const reverse = {};
    Object.entries(estadoModulo.columnas || {}).forEach(([clave, idx]) => {
      reverse[idx] = clave;
    });
    return reverse;
  };

  const esClaveBudget = (clave) => clave && clave.startsWith('budget-');

  const parsearNumero = (texto) => {
    const limpio = (texto || '').toString().replace(/[^0-9+.,-]/g, '').replace(',', '.');
    const numero = Number(limpio);
    return Number.isFinite(numero) ? numero : 0;
  };

  const formatearNumero = (valor) => {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return '0.00';
    const fijo = numero.toFixed(2);
    const [entero, decimales] = fijo.split('.');
    const enteroConComas = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${enteroConComas}.${decimales}`;
  };

  const obtenerFilasCuenta = () => {
    if (!estadoModulo.tabla) {
      return [];
    }
    return Array.from(estadoModulo.tabla.querySelectorAll('tbody tr.fila-cuenta'));
  };

  const actualizarNombreFila = (fila, nombre) => {
    if (!fila || fila.cells.length < 2) return;
    if (!nombre) return;
    fila.cells[1].textContent = nombre;
  };

  const recalcularTotalesFilaPresupuesto = (fila) => {
    if (!fila) return;
    const cuenta = fila.dataset.cuenta21 || '';
    const almacen = estadoModulo.valoresPorCuenta.get(cuenta) || {};
    let totalPresupuesto = 0;
    MESES.forEach((mes) => {
      totalPresupuesto += Number(almacen[`budget-${mes}`]) || 0;
    });
    if (estadoModulo.columnas['total-budget'] != null) {
      const celdaTotal = fila.cells[estadoModulo.columnas['total-budget']];
      if (celdaTotal) {
        celdaTotal.textContent = formatearNumero(totalPresupuesto);
      }
    }
    almacen['total-budget'] = totalPresupuesto;
    estadoModulo.valoresPorCuenta.set(cuenta, almacen);
  };

  const establecerValorCelda = (fila, clave, valor) => {
    const indice = estadoModulo.columnas[clave];
    if (indice == null) {
      return;
    }
    const celda = fila.cells[indice];
    if (!celda) {
      return;
    }
    celda.textContent = formatearNumero(valor);
  };

  const limpiarValores = () => {
    estadoModulo.valoresPorCuenta = new Map();
    obtenerFilasCuenta().forEach((fila) => {
      MESES.forEach((mes) => {
        establecerValorCelda(fila, `budget-${mes}`, 0);
        establecerValorCelda(fila, `real-${mes}`, 0);
      });
      establecerValorCelda(fila, 'total-budget', 0);
      establecerValorCelda(fila, 'total-real', 0);
    });
    recalcularSumas();
    estadoModulo.hayCambios = false;
    estadoModulo.editSnapshot = null;
  };

  const aplicarImportes = (registros = []) => {
    const mapa = new Map(registros.map((registro) => [registro.cuenta, registro]));
    estadoModulo.valoresPorCuenta = new Map();
    obtenerFilasCuenta().forEach((fila) => {
      const cuenta = fila.dataset.cuenta21 || '';
      const registro = mapa.get(cuenta);
      let totalPresupuesto = 0;
      let totalReal = 0;
      const almacen = {};
      MESES.forEach((mes) => {
        const presupuesto = registro?.presupuesto?.[mes] ?? 0;
        const real = registro?.real?.[mes] ?? 0;
        totalPresupuesto += Number(presupuesto) || 0;
        totalReal += Number(real) || 0;
        establecerValorCelda(fila, `budget-${mes}`, presupuesto);
        establecerValorCelda(fila, `real-${mes}`, real);
        almacen[`budget-${mes}`] = Number(presupuesto) || 0;
        almacen[`real-${mes}`] = Number(real) || 0;
      });
      establecerValorCelda(fila, 'total-budget', totalPresupuesto);
      establecerValorCelda(fila, 'total-real', totalReal);
      almacen['total-budget'] = totalPresupuesto;
      almacen['total-real'] = totalReal;
      estadoModulo.valoresPorCuenta.set(cuenta, almacen);
    });
    recalcularSumas();
    estadoModulo.hayCambios = false;
    estadoModulo.editSnapshot = null;
  };

  const obtenerCuentasSolicitadas = () => {
    const filas = obtenerFilasCuenta();
    const conjunto = new Set();
    filas.forEach((fila) => {
      const cuenta = (fila.dataset.cuenta21 || '').trim();
      if (cuenta) {
        conjunto.add(cuenta);
      }
    });
    return Array.from(conjunto);
  };

  const clonarMapaValores = (mapa) =>
    new Map(Array.from(mapa.entries()).map(([clave, valores]) => [clave, { ...(valores || {}) }]));

  const tomarSnapshotEdicion = () => ({
    valores: clonarMapaValores(estadoModulo.valoresPorCuenta),
    nombres: new Map(estadoModulo.nombresPorCuenta)
  });

  const restablecerDesdeSnapshot = (snap) => {
    if (!snap) return;
    estadoModulo.valoresPorCuenta = clonarMapaValores(snap.valores || new Map());
    estadoModulo.nombresPorCuenta = new Map(snap.nombres || []);
    obtenerFilasCuenta().forEach((fila) => {
      const cuenta = fila.dataset.cuenta21 || '';
      const nombre = estadoModulo.nombresPorCuenta.get(cuenta) || '';
      if (nombre) {
        actualizarNombreFila(fila, nombre);
      }
      const valores = estadoModulo.valoresPorCuenta.get(cuenta) || {};
      MESES.forEach((mes) => {
        establecerValorCelda(fila, `budget-${mes}`, valores[`budget-${mes}`] ?? 0);
        establecerValorCelda(fila, `real-${mes}`, valores[`real-${mes}`] ?? 0);
      });
      establecerValorCelda(fila, 'total-budget', valores['total-budget'] ?? 0);
      establecerValorCelda(fila, 'total-real', valores['total-real'] ?? 0);
    });
    recalcularSumas();
  };

  const obtenerCambiosPendientes = () => {
    if (!estadoModulo.editSnapshot) {
      return { presupuesto: [], nombres: [] };
    }
    const cambiosPresupuesto = [];
    const cambiosNombres = [];
    const baseValores = estadoModulo.editSnapshot.valores || new Map();
    const baseNombres = estadoModulo.editSnapshot.nombres || new Map();

    estadoModulo.valoresPorCuenta.forEach((valores, cuenta) => {
      const prev = baseValores.get(cuenta) || {};
      const diff = {};
      MESES.forEach((mes) => {
        const clave = `budget-${mes}`;
        const actual = Number(valores?.[clave]) || 0;
        const anterior = Number(prev?.[clave]) || 0;
        if (actual !== anterior) {
          diff[clave] = actual;
        }
      });
      if (Object.keys(diff).length) {
        cambiosPresupuesto.push({ cuenta, valores: diff });
      }
    });

    estadoModulo.nombresPorCuenta.forEach((nombre, cuenta) => {
      const anterior = baseNombres.get(cuenta) || '';
      if ((nombre || '') !== (anterior || '')) {
        cambiosNombres.push({ cuenta, nombre });
      }
    });

    return { presupuesto: cambiosPresupuesto, nombres: cambiosNombres };
  };

  const notificarCambios = () => {
    const cambios = obtenerCambiosPendientes();
    const detalle = { ...cambios, hayCambios: estadoModulo.hayCambios };
    window.dispatchEvent(new CustomEvent('modulo-planeacion:presupuesto-editado', { detail: detalle }));
  };

  const indicesMesReal = () =>
    Object.entries(estadoModulo.columnas || {})
      .filter(([clave]) => clave.startsWith('real-'))
      .map(([, idx]) => idx);

  const ocultarColumnasReal = (ocultar) => {
    if (!estadoModulo.tabla) return;
    const indices = indicesMesReal();
    if (!indices.length) return;
    const filas = Array.from(estadoModulo.tabla.querySelectorAll('tr'));
    filas.forEach((fila) => {
      indices.forEach((idx) => {
        const celda = fila.cells[idx];
        if (celda) {
          celda.style.display = ocultar ? 'none' : '';
        }
      });
    });
  };

  const aplicarNombresTabla = (mapaNombres = new Map()) => {
    if (!mapaNombres.size) return;
    obtenerFilasCuenta().forEach((fila) => {
      const cuenta = fila.dataset.cuenta21 || '';
      const nombre = mapaNombres.get(cuenta);
      if (nombre) {
        actualizarNombreFila(fila, nombre);
      }
    });
  };

  const cargarNombresCuentas = async ({ empresaId, anio, cuentas } = {}) => {
    const lista = Array.isArray(cuentas) ? Array.from(new Set(cuentas)) : [];
    if (!empresaId || !Number.isInteger(anio) || !lista.length) return new Map();
    try {
      const params = new URLSearchParams({ empresaId, anio, cuentas: lista.join(',') });
      const resp = await fetch(`${API_BASE}/saldos/cuentas?${params.toString()}`, {
        headers: Sesion.headersAutenticacion()
      });
      const datos = await resp.json();
      if (!resp.ok) throw new Error(datos.mensaje || 'No fue posible obtener nombres.');
      const mapa = new Map();
      (datos.cuentas || []).forEach((registro) => {
        const clave = convertirCuenta21(registro.cuenta || registro.numCta || registro.NUM_CTA || '');
        const nombre = (registro.nombre || registro.nombreCuenta || registro.NOMBRE || '').trim();
        if (clave && nombre) {
          mapa.set(clave, nombre);
          estadoModulo.nombresPorCuenta.set(clave, nombre);
        }
      });
      aplicarNombresTabla(mapa);
      return mapa;
    } catch (error) {
      console.warn('No fue posible cargar nombres de cuentas', error);
      return new Map();
    }
  };

  const destruirTooltips = () => {
    estadoModulo.tooltips.forEach((tooltip) => {
      if (typeof tooltip?.dispose === 'function') {
        tooltip.dispose();
      }
    });
    estadoModulo.tooltips = [];
  };

  const activarTooltipsCuentas = () => {
    destruirTooltips();
    if (!estadoModulo.tabla || !window.bootstrap?.Tooltip) {
      return;
    }
    const celdas = estadoModulo.tabla.querySelectorAll('tbody tr.fila-cuenta td[data-bs-toggle="tooltip"]');
    celdas.forEach((celda) => {
      const tooltip = window.bootstrap.Tooltip.getOrCreateInstance(celda, {
        placement: 'top',
        trigger: 'hover',
        container: 'body'
      });
      estadoModulo.tooltips.push(tooltip);
    });
  };

  const solicitarDatos = async () => {
    const moduloClave = estadoModulo.moduloClave || normalizarModuloClave(estadoModulo.moduloId);
    if (!MODULOS_SOPORTADOS.has(moduloClave)) {
      return;
    }

    const empresa = Sesion.obtenerEmpresaActiva();
    const anio = obtenerAnioSeleccionado();
    if (!empresa?.id || !Number.isInteger(anio)) {
      limpiarValores();
      return;
    }
    estadoModulo.anio = anio;
    if (!estadoModulo.moduloId) {
      return;
    }
    const cuentas = obtenerCuentasSolicitadas();
    if (!cuentas.length) {
      limpiarValores();
      return;
    }
    const payload = {
      empresaId: empresa.id,
      anio,
      modulo: moduloClave || estadoModulo.moduloId,
      cuentas
    };
    // eslint-disable-next-line no-console
    console.debug('[planeacion] payload', payload);
    estadoModulo.ultimaSolicitud += 1;
    const folio = estadoModulo.ultimaSolicitud;
    try {
      const respuesta = await fetch(`${API_BASE}/planeacion/cuentas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...Sesion.headersAutenticacion()
        },
        body: JSON.stringify(payload)
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        const detalles = Array.isArray(datos.detalles) ? ` (${datos.detalles.join('; ')})` : '';
        throw new Error((datos.mensaje || 'No fue posible obtener la información contable.') + detalles);
      }
      if (folio !== estadoModulo.ultimaSolicitud) {
        return;
      }
      aplicarImportes(datos.cuentas || []);
    } catch (error) {
      console.error('Error al cargar datos de planeación', error);
      if (folio === estadoModulo.ultimaSolicitud) {
        limpiarValores();
      }
    }
  };

  const obtenerSumasConfig = (sheetName, capitulo, seccion) => {
    const dataset = window.CUENTAS_SUMAS || {};
    const porHoja = dataset[normalizarSheetId(sheetName)] || null;
    if (!porHoja) {
      return null;
    }
    const porCapitulo = porHoja[normalizarTexto(capitulo)];
    if (!porCapitulo) {
      return null;
    }
    return porCapitulo[normalizarTexto(seccion)] || null;
  };

  const agregarFilaResumen = ({ texto, clase, cuerpo, placeholdersPorFila }) => {
    if (!texto) {
      return null;
    }
    const fila = document.createElement('tr');
    fila.className = clase;
    const celdaCuenta = document.createElement('td');
    celdaCuenta.textContent = '';
    fila.appendChild(celdaCuenta);
    const celdaDescripcion = document.createElement('td');
    celdaDescripcion.textContent = texto;
    fila.appendChild(celdaDescripcion);
    for (let i = 0; i < placeholdersPorFila; i += 1) {
      const celda = document.createElement('td');
      celda.className = 'budget-value';
      celda.textContent = '-';
      fila.appendChild(celda);
    }
    cuerpo.appendChild(fila);
    return fila;
  };

  const renderizarSecciones = ({ registros, cuerpo, placeholdersPorFila, sheetName, capitulo }) => {
    const secciones = new Map();
    const faltantesNombre = new Set();
    registros.forEach((item) => {
      const clave = item.seccion || 'SIN SECCION';
      if (!secciones.has(clave)) {
        secciones.set(clave, []);
      }
      secciones.get(clave).push(item);
    });

    const resultRows = new Map();
    const sumasSecciones = [];
    const sumavariosData = new Map();

    secciones.forEach((lista, seccion) => {
      const claveSeccion = normalizarTexto(seccion || 'SIN SECCION');
      const filasCuenta = [];
      if (seccion && seccion !== 'SIN SECCION') {
        const filaSeccion = document.createElement('tr');
        filaSeccion.className = 'section-header-row';
        const celda = document.createElement('td');
        celda.colSpan = placeholdersPorFila + 2;
        celda.textContent = seccion;
        filaSeccion.appendChild(celda);
        cuerpo.appendChild(filaSeccion);
      }

      lista.forEach((item) => {
        const fila = document.createElement('tr');
        fila.className = 'fila-cuenta';
        const celdaCuenta = document.createElement('td');
        const cuenta21 = convertirCuenta21(item.cuenta || '');
        celdaCuenta.textContent = item.cuenta || '-';
        if (cuenta21) {
          celdaCuenta.title = cuenta21;
          celdaCuenta.dataset.bsToggle = 'tooltip';
          celdaCuenta.dataset.bsPlacement = 'top';
        }
        fila.appendChild(celdaCuenta);
        const celdaNombre = document.createElement('td');
        const nombreMostrar = item.nombre || estadoModulo.nombresPorCuenta.get(cuenta21) || '';
        celdaNombre.textContent = nombreMostrar || '-';
        if (!nombreMostrar) {
          faltantesNombre.add(cuenta21);
        }
        fila.appendChild(celdaNombre);
        fila.dataset.cuenta = item.cuenta || '';
        fila.dataset.cuenta21 = cuenta21;
        fila.dataset.seccion = claveSeccion;
        for (let i = 0; i < placeholdersPorFila; i += 1) {
          const celda = document.createElement('td');
          celda.className = 'budget-value';
          celda.textContent = '-';
          fila.appendChild(celda);
        }
        cuerpo.appendChild(fila);
        filasCuenta.push(fila);
      });

      const sumas = sheetName && capitulo ? obtenerSumasConfig(sheetName, capitulo, seccion) : null;
      const metaSeccion = {
        seccion: claveSeccion,
        filasCuenta,
        sumRowTexto: sumas?.sumRow ? normalizarTexto(sumas.sumRow) : '',
        sumRowSumavariosTexto: sumas?.sumRowSumavarios ? normalizarTexto(sumas.sumRowSumavarios) : '',
        sumRowSumavarios2Texto: sumas?.sumRowSumavarios2 ? normalizarTexto(sumas.sumRowSumavarios2) : '',
        sumRowSumavariosLabel: sumas?.sumRowSumavarios || sumas?.sumRowSumavarios2 || '',
        resultRowTexto: sumas?.resultRow ? normalizarTexto(sumas.resultRow) : '',
        elementos: {}
      };
      if (sumas) {
        metaSeccion.elementos.sumRow = agregarFilaResumen({
          texto: sumas.sumRow,
          clase: 'sum-row',
          cuerpo,
          placeholdersPorFila
        });
        // Registrar la última sección asociada a este sumario (sum-row-sumavarios / sumavarios2)
        const claveSumario = normalizarTexto(metaSeccion.sumRowSumavariosLabel);
        if (claveSumario) {
          const existente = sumavariosData.get(claveSumario) || { texto: metaSeccion.sumRowSumavariosLabel, meta: null };
          existente.meta = metaSeccion; // mantener la última sección encontrada para posicionar el sumario debajo
          sumavariosData.set(claveSumario, existente);
        }
        if (sumas.resultRow) {
          const clave = `${sumas.resultRow}::result-row`;
          if (!resultRows.has(clave)) {
            resultRows.set(clave, sumas.resultRow);
          }
        }
      }
      sumasSecciones.push(metaSeccion);
    });

    return {
      resultadoFilas: Array.from(resultRows.values()).map((texto) => ({
        texto,
        clase: 'result-row'
      })),
      sumasSecciones,
      sumavarios: sumavariosData,
      faltantesNombre: Array.from(faltantesNombre)
    };
  };

  const normalizarClave = (valor) => normalizarTexto(valor || '');

  const extraerValoresNumericos = (fila, inicio = 2) => {
    const valores = [];
    for (let i = inicio; i < fila.cells.length; i += 1) {
      const texto = (fila.cells[i].textContent || '').replace(/[^0-9+.,-]/g, '');
      const numero = Number(texto.replace(',', '.'));
      valores.push(Number.isFinite(numero) ? numero : 0);
    }
    return valores;
  };

  const asignarValoresNumericos = (fila, valores, inicio = 2) => {
    if (!fila || !Array.isArray(valores)) return;
    for (let i = inicio; i < fila.cells.length && i - inicio < valores.length; i += 1) {
      fila.cells[i].textContent = formatearNumero(valores[i - inicio]);
    }
  };

  const sumarListas = (listas = [], longitud = 0) => {
    const resultado = Array.from({ length: longitud }, () => 0);
    listas.forEach((lista) => {
      lista.forEach((valor, indice) => {
        resultado[indice] += Number(valor) || 0;
      });
    });
    return resultado;
  };

  const recalcularSumas = () => {
    const meta = estadoModulo.sumas;
    if (!meta || !meta.secciones.length) {
      return;
    }
    const clavesOrdenadas = Object.entries(estadoModulo.columnas || {})
      .sort((a, b) => a[1] - b[1])
      .map(([clave]) => clave)
      .filter((clave) => clave !== 'year');
    const longitud = clavesOrdenadas.length;
    if (!longitud) {
      return;
    }
    const secciones = meta.secciones;

    secciones.forEach((seccion) => {
      const valores = sumarListas(
        seccion.filasCuenta.map((fila) => {
          const cuenta = fila.dataset.cuenta21 || '';
          const almacenados = estadoModulo.valoresPorCuenta.get(cuenta);
          if (almacenados) {
            return clavesOrdenadas.map((clave) => almacenados[clave] ?? 0);
          }
          return extraerValoresNumericos(fila);
        }),
        longitud
      );
      seccion.sumValues = valores;
      if (seccion.elementos.sumRow) {
        asignarValoresNumericos(seccion.elementos.sumRow, valores);
      }
    });

    // sum-row-sumavarios: suma de los sum-row (sumValues) con la misma etiqueta
    const acumuladosSumavarios = new Map();
    secciones.forEach((seccion) => {
      const clave = normalizarClave(seccion.sumRowSumavariosTexto || seccion.sumRowSumavarios2Texto);
      if (!clave) return;
      const prev = acumuladosSumavarios.get(clave) || Array.from({ length: longitud }, () => 0);
      seccion.sumValues.forEach((valor, idx) => {
        prev[idx] += Number(valor) || 0;
      });
      acumuladosSumavarios.set(clave, prev);
    });
    secciones.forEach((seccion) => {
      const clave = normalizarClave(seccion.sumRowSumavariosTexto || seccion.sumRowSumavarios2Texto);
      if (!clave) return;
      const valores = acumuladosSumavarios.get(clave) || Array.from({ length: longitud }, () => 0);
      seccion.sumavariosValues = valores;
    });
    meta.sumavariosRows?.forEach((fila, clave) => {
      const valores = acumuladosSumavarios.get(clave) || Array.from({ length: longitud }, () => 0);
      asignarValoresNumericos(fila, valores);
    });

    // result-row: suma solamente los sum-row de todas las secciones con la misma etiqueta de resultado
    const acumuladosResultado = new Map();
    secciones.forEach((seccion) => {
      const clave = normalizarClave(seccion.resultRowTexto);
      if (!clave) return;
      const origen = seccion.sumValues || Array.from({ length: longitud }, () => 0);
      const prev = acumuladosResultado.get(clave) || Array.from({ length: longitud }, () => 0);
      origen.forEach((valor, idx) => {
        prev[idx] += Number(valor) || 0;
      });
      acumuladosResultado.set(clave, prev);
    });
    meta.resultRows.forEach((fila, clave) => {
      const valores = acumuladosResultado.get(clave) || Array.from({ length: longitud }, () => 0);
      asignarValoresNumericos(fila, valores);
    });
  };

  const manejarCambioCuenta = (fila, celda) => {
    if (!fila || !celda) return;
    const texto = (celda.textContent || '').trim();
    const nuevaCuenta21 = convertirCuenta21(texto);
    const cuentaAnterior = fila.dataset.cuenta21 || '';
    const valoresPrevios = estadoModulo.valoresPorCuenta.get(cuentaAnterior) || {};
    const nombrePrevio = estadoModulo.nombresPorCuenta.get(cuentaAnterior);
    if (cuentaAnterior && cuentaAnterior !== nuevaCuenta21) {
      estadoModulo.valoresPorCuenta.delete(cuentaAnterior);
      estadoModulo.nombresPorCuenta.delete(cuentaAnterior);
    }
    fila.dataset.cuenta = texto;
    fila.dataset.cuenta21 = nuevaCuenta21;
    if (nuevaCuenta21) {
      fila.dataset.cuenta = texto || nuevaCuenta21;
      estadoModulo.valoresPorCuenta.set(nuevaCuenta21, valoresPrevios);
      if (nombrePrevio) {
        estadoModulo.nombresPorCuenta.set(nuevaCuenta21, nombrePrevio);
        actualizarNombreFila(fila, nombrePrevio);
      }
      celda.title = nuevaCuenta21;
      celda.dataset.bsToggle = 'tooltip';
      celda.dataset.bsPlacement = 'top';
    } else {
      celda.title = '';
      celda.removeAttribute('data-bs-toggle');
      celda.removeAttribute('data-bs-placement');
    }
    recalcularTotalesFilaPresupuesto(fila);
    recalcularSumas();
    estadoModulo.hayCambios = true;
    notificarCambios();
  };

  const manejarCambioNombre = (fila, celda) => {
    if (!fila || !celda) return;
    const nombre = (celda.textContent || '').trim();
    const cuenta = fila.dataset.cuenta21 || '';
    if (cuenta) {
      estadoModulo.nombresPorCuenta.set(cuenta, nombre);
    }
    estadoModulo.hayCambios = true;
    notificarCambios();
  };

  const actualizarPresupuestoCelda = (fila, clave, celda) => {
    if (!fila || !clave || !celda) return;
    const cuenta = fila.dataset.cuenta21 || '';
    const almacen = estadoModulo.valoresPorCuenta.get(cuenta) || {};
    const valor = parsearNumero(celda.textContent);
    almacen[clave] = valor;
    estadoModulo.valoresPorCuenta.set(cuenta, almacen);
    celda.textContent = formatearNumero(valor);
    recalcularTotalesFilaPresupuesto(fila);
    recalcularSumas();
    estadoModulo.hayCambios = true;
    notificarCambios();
  };

  const limpiarModoEdicionEnTabla = () => {
    if (!estadoModulo.tabla) return;
    ocultarColumnasReal(false);
    obtenerFilasCuenta().forEach((fila) => {
      Array.from(fila.cells).forEach((celda) => {
        if (!celda.dataset.editable) return;
        celda.contentEditable = 'false';
        delete celda.dataset.editable;
        delete celda.dataset.columnaClave;
      });
    });
    estadoModulo.tabla.classList.remove('modo-edicion');
  };

  const aplicarModoEdicionEnTabla = () => {
    if (!estadoModulo.tabla) return;
    if (!estadoModulo.editMode) {
      limpiarModoEdicionEnTabla();
      return;
    }
    estadoModulo.tabla.classList.add('modo-edicion');
    ocultarColumnasReal(true);
    const reverse = invertirColumnas();
    const filas = obtenerFilasCuenta();

    const obtenerCeldasEditablesFila = (fila) => Array.from(fila.cells).filter((celda) => celda.dataset.editable);
    const enfocarCelda = (celda) => {
      if (!celda) return;
      celda.focus();
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(celda);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    };
    const moverFocus = (celdaActual, direccion) => {
      if (!celdaActual) return;
      const fila = celdaActual.parentElement;
      const filasEdit = obtenerFilasCuenta();
      const filaIndex = filasEdit.indexOf(fila);
      const colIndex = Array.from(fila.cells).indexOf(celdaActual);
      if (filaIndex < 0 || colIndex < 0) return;
      if (direccion === 'arriba' && filaIndex > 0) {
        const target = filasEdit[filaIndex - 1].cells[colIndex];
        if (target?.dataset.editable) enfocarCelda(target);
      } else if (direccion === 'abajo' && filaIndex < filasEdit.length - 1) {
        const target = filasEdit[filaIndex + 1].cells[colIndex];
        if (target?.dataset.editable) enfocarCelda(target);
      } else if (direccion === 'izquierda') {
        const editables = obtenerCeldasEditablesFila(fila);
        const idx = editables.indexOf(celdaActual);
        if (idx > 0) enfocarCelda(editables[idx - 1]);
      } else if (direccion === 'derecha') {
        const editables = obtenerCeldasEditablesFila(fila);
        const idx = editables.indexOf(celdaActual);
        if (idx >= 0 && idx < editables.length - 1) enfocarCelda(editables[idx + 1]);
      }
    };

    filas.forEach((fila) => {
      const celdaCuenta = fila.cells[0];
      const celdaNombre = fila.cells[1];
      if (celdaCuenta && !celdaCuenta.dataset.editable) {
        celdaCuenta.contentEditable = 'true';
        celdaCuenta.dataset.editable = 'cuenta';
        celdaCuenta.addEventListener('blur', () => manejarCambioCuenta(fila, celdaCuenta));
        celdaCuenta.addEventListener('keydown', (evt) => {
          if (evt.key === 'Enter') {
            evt.preventDefault();
            celdaCuenta.blur();
          } else if (evt.key === 'ArrowRight') {
            evt.preventDefault();
            moverFocus(celdaCuenta, 'derecha');
          } else if (evt.key === 'ArrowDown') {
            evt.preventDefault();
            moverFocus(celdaCuenta, 'abajo');
          } else if (evt.key === 'ArrowUp') {
            evt.preventDefault();
            moverFocus(celdaCuenta, 'arriba');
          }
        });
      }
      if (celdaNombre && !celdaNombre.dataset.editable) {
        celdaNombre.contentEditable = 'true';
        celdaNombre.dataset.editable = 'nombre';
        celdaNombre.addEventListener('blur', () => manejarCambioNombre(fila, celdaNombre));
        celdaNombre.addEventListener('keydown', (evt) => {
          if (evt.key === 'Enter') {
            evt.preventDefault();
            celdaNombre.blur();
          } else if (evt.key === 'ArrowLeft') {
            evt.preventDefault();
            moverFocus(celdaNombre, 'izquierda');
          } else if (evt.key === 'ArrowRight') {
            evt.preventDefault();
            moverFocus(celdaNombre, 'derecha');
          } else if (evt.key === 'ArrowDown') {
            evt.preventDefault();
            moverFocus(celdaNombre, 'abajo');
          } else if (evt.key === 'ArrowUp') {
            evt.preventDefault();
            moverFocus(celdaNombre, 'arriba');
          }
        });
      }
      Array.from(fila.cells).forEach((celda, idx) => {
        const clave = reverse[idx];
        if (!esClaveBudget(clave)) return;
        if (celda.dataset.editable) return;
        celda.contentEditable = 'true';
        celda.dataset.editable = 'budget';
        celda.dataset.columnaClave = clave;
        celda.addEventListener('blur', () => actualizarPresupuestoCelda(fila, clave, celda));
        celda.addEventListener('keydown', (evt) => {
          if (evt.key === 'Enter') {
            evt.preventDefault();
            celda.blur();
          } else if (evt.key === 'ArrowLeft') {
            evt.preventDefault();
            moverFocus(celda, 'izquierda');
          } else if (evt.key === 'ArrowRight') {
            evt.preventDefault();
            moverFocus(celda, 'derecha');
          } else if (evt.key === 'ArrowDown') {
            evt.preventDefault();
            moverFocus(celda, 'abajo');
          } else if (evt.key === 'ArrowUp') {
            evt.preventDefault();
            moverFocus(celda, 'arriba');
          }
        });
      });
    });

    // Enfocar la primera celda budget disponible
    const primerFila = filas[0];
    if (primerFila) {
      const indiceBudget = Object.entries(estadoModulo.columnas || {})
        .filter(([clave]) => esClaveBudget(clave))
        .map(([, idx]) => idx)
        .sort((a, b) => a - b)[0];
      if (indiceBudget != null) {
        const celdaFocus = primerFila.cells[indiceBudget];
        if (celdaFocus) {
          setTimeout(() => enfocarCelda(celdaFocus), 0);
        }
      }
    }
  };

  const iniciarEdicion = () => {
    if (estadoModulo.editMode) return;
    estadoModulo.editSnapshot = tomarSnapshotEdicion();
    estadoModulo.hayCambios = false;
    estadoModulo.editMode = true;
    aplicarModoEdicionEnTabla();
    notificarCambios();
  };

  const cancelarEdicion = () => {
    if (!estadoModulo.editMode) return;
    restablecerDesdeSnapshot(estadoModulo.editSnapshot);
    estadoModulo.hayCambios = false;
    estadoModulo.editMode = false;
    aplicarModoEdicionEnTabla();
    notificarCambios();
  };

  const finalizarEdicion = () => {
    if (!estadoModulo.editMode) return;
    estadoModulo.editMode = false;
    aplicarModoEdicionEnTabla();
  };

  const obtenerHojaDatos = (nombre, dataset) => {
    if (!nombre) {
      return null;
    }
    const claves = new Set([nombre]);
    if (nombre.includes('&')) {
      claves.add(nombre.replace(/&/g, '&amp;'));
    }
    for (const clave of claves) {
      if (dataset[clave]) {
        return dataset[clave];
      }
    }
    return null;
  };

  const renderizarTabla = async (opciones = {}) => {
    const tabla = obtenerTabla(opciones.tablaSelector);
    const cuerpo = tabla?.querySelector('tbody');
    if (!tabla || !cuerpo) {
      return Promise.resolve(false);
    }
    estadoModulo.editMode = false;
    estadoModulo.hayCambios = false;
    estadoModulo.editSnapshot = null;
    destruirTooltips();

    const columnas = Number(opciones.totalColumnas) || contarColumnas(tabla);
    const placeholdersPorFila = Math.max(0, columnas - 2);

    const { moduloId, moduloSheet } = obtenerConfigModulo();
    const moduloNormalizado = (opciones.moduloId || moduloId || '').toString().trim();
    const moduloClave = normalizarModuloClave(moduloNormalizado || moduloId);
    const sheetPorConfig = window.CapitulosModulos?.obtenerSheetPorModulo
      ? window.CapitulosModulos.obtenerSheetPorModulo(moduloNormalizado)
      : null;
    const sheetConfigurada = opciones.sheet || moduloSheet || sheetPorConfig || moduloNormalizado;
    const dataset = window.CUENTAS_POR_MODULO || {};
    const hoja = obtenerHojaDatos(sheetConfigurada, dataset);
    limpiarBody(cuerpo);

    const empresa = Sesion.obtenerEmpresaActiva();
    const empresaId = empresa?.id;
    const capituloDestino = window.CapitulosModulos?.obtenerCapituloPorEmpresa(empresaId) || null;
    const moduloHabilitado = window.CapitulosModulos?.moduloDisponible
      ? window.CapitulosModulos.moduloDisponible(empresaId, moduloNormalizado)
      : true;

    if (!moduloHabilitado) {
      cuerpo.appendChild(crearFilaEstado('El capitulo seleccionado no tiene esta vista asignada.', columnas));
      return Promise.resolve(false);
    }

    if (!hoja || !Array.isArray(hoja) || !capituloDestino) {
      cuerpo.appendChild(crearFilaEstado('No hay informacion disponible para esta vista.', columnas));
      return Promise.resolve(false);
    }

    const objetivo = normalizarTexto(capituloDestino);
    const registros = hoja.filter((registro) => normalizarTexto(registro.capitulo) === objetivo);

    if (!registros.length) {
      cuerpo.appendChild(crearFilaEstado('El capitulo no tiene cuentas configuradas en el libro.', columnas));
      return Promise.resolve(false);
    }

    const cuentasCapitulo = registros
      .map((registro) => convertirCuenta21(registro.cuenta || ''))
      .filter(Boolean);
    if (empresaId && cuentasCapitulo.length) {
      const anioNombres = obtenerAnioSeleccionado() || new Date().getFullYear();
      await cargarNombresCuentas({ empresaId, anio: anioNombres, cuentas: cuentasCapitulo });
    }

    estadoModulo.sumas = { secciones: [], sumavariosRows: new Map(), resultRows: new Map() };
    const pendientes = renderizarSecciones({
      registros,
      cuerpo,
      placeholdersPorFila,
      sheetName: sheetConfigurada,
      capitulo: capituloDestino
    });

    estadoModulo.sumas.sumavariosRows = new Map();
    pendientes.sumavarios.forEach((info, clave) => {
      if (!info?.meta) return;
      const filaSumario = agregarFilaResumen({
        texto: info.texto,
        clase: 'sum-row-sumavarios',
        cuerpo,
        placeholdersPorFila
      });
      if (filaSumario) {
        estadoModulo.sumas.sumavariosRows.set(normalizarTexto(clave), filaSumario);
        const referencia =
          info.meta.elementos.sumRow ||
          info.meta.filasCuenta[info.meta.filasCuenta.length - 1] ||
          cuerpo.lastChild;
        if (referencia && referencia.parentNode) {
          referencia.parentNode.insertBefore(filaSumario, referencia.nextSibling);
        }
      }
    });

    pendientes.resultadoFilas.forEach((fila) => {
      const resultadoFila = agregarFilaResumen({
        texto: fila.texto,
        clase: fila.clase,
        cuerpo,
        placeholdersPorFila
      });
      if (resultadoFila) {
        estadoModulo.sumas.resultRows.set(normalizarTexto(fila.texto), resultadoFila);
      }
    });

    estadoModulo.sumas.secciones = pendientes.sumasSecciones;
    estadoModulo.tabla = tabla;
    estadoModulo.columnas = construirMapaColumnas(tabla);
    estadoModulo.moduloId = moduloNormalizado;
    estadoModulo.moduloClave = moduloClave;
    estadoModulo.sheet = sheetConfigurada;
    const anioNombres = obtenerAnioSeleccionado() || new Date().getFullYear();
    if (pendientes.faltantesNombre?.length && empresaId) {
      cargarNombresCuentas({ empresaId, anio: anioNombres, cuentas: pendientes.faltantesNombre });
    }
    solicitarDatos();
    activarTooltipsCuentas();
    aplicarModoEdicionEnTabla();

    return Promise.resolve(true);
  };

  const crearInstancia = (opciones) => {
    const config = { ...(opciones || {}) };
    let destruido = false;
    const ejecutar = () => {
      if (destruido) return Promise.resolve(false);
      return renderizarTabla(config).then((resultado) => {
        window.dispatchEvent(new CustomEvent(EVENTO_TABLA_ACTUALIZADA));
        return resultado;
      });
    };
    const ready = ejecutar();
    const listener = () => {
      ejecutar();
    };
    window.addEventListener(Sesion.EVENTO_EMPRESA, listener);
    const contextoListener = (evento) => {
      const moduloEvento = normalizarModuloClave(evento?.detail?.modulo || '');
      const moduloActual = estadoModulo.moduloClave;
      if (moduloEvento && moduloEvento !== moduloActual) {
        return;
      }
      const anioEvento = Number(evento?.detail?.anio);
      if (Number.isInteger(anioEvento)) {
        estadoModulo.anio = anioEvento;
      }
      solicitarDatos();
    };
    window.addEventListener(EVENTO_CONTEXTO, contextoListener);
    return {
      ready,
      refresh: ejecutar,
      setEditMode(flag) {
        if (flag) {
          iniciarEdicion();
        } else {
          finalizarEdicion();
        }
      },
      cancelEdit() {
        cancelarEdicion();
      },
      destroy() {
        destruido = true;
        window.removeEventListener(Sesion.EVENTO_EMPRESA, listener);
        window.removeEventListener(EVENTO_CONTEXTO, contextoListener);
        destruirTooltips();
      }
    };
  };

  window.CuentasModulo = {
    init: crearInstancia,
    render: renderizarTabla,
    setEditMode(flag) {
      if (flag) {
        iniciarEdicion();
      } else {
        finalizarEdicion();
      }
    },
    cancelEdit() {
      cancelarEdicion();
    },
    getCambios() {
      return obtenerCambiosPendientes();
    }
  };
})();
  const normalizarCuentaBase = (cuenta) => {
    if (!cuenta) return '';
    return cuenta.toString().replace(/[^0-9A-Za-z]/g, '').toUpperCase().trim();
  };

  const deducirNivel = (baseVisible) => {
    const visible = normalizarCuentaBase(baseVisible).slice(0, 11).padEnd(11, '0');
    const b = visible.slice(3, 6);
    const c = visible.slice(6, 9);
    const d = visible.slice(9, 11);
    if (b === '000' && c === '000' && d === '00') return '1';
    if (c === '000' && d === '00') return '2';
    if (d === '00') return '3';
    return '4';
  };

  const convertirCuenta21 = (cuentaLegible) => {
    const entrada = normalizarCuentaBase(cuentaLegible);
    if (!entrada) return '';

    // Si ya viene en formato COI de 21 caracteres, respétalo.
    if (entrada.length >= 21) {
      return entrada.slice(0, 21);
    }

    // Usa la conversión compartida si está disponible en la vista.
    if (typeof window.cuentaLarga === 'function') {
      const desdeVista = window.cuentaLarga(entrada);
      if (desdeVista) return desdeVista;
    }

    const visible = entrada.slice(0, 11).padEnd(11, '0');
    const nivel = deducirNivel(visible);
    return visible.padEnd(20, '0') + nivel;
  };
