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
    anio: null
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

  const formatearNumero = (valor) => {
    const numero = Number(valor) || 0;
    if (numero === 0) {
      return '-';
    }
    try {
      const formato = new Intl.NumberFormat('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
      return formato.format(numero);
    } catch (error) {
      return numero.toString();
    }
  };

  const obtenerFilasCuenta = () => {
    if (!estadoModulo.tabla) {
      return [];
    }
    return Array.from(estadoModulo.tabla.querySelectorAll('tbody tr.fila-cuenta'));
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
    obtenerFilasCuenta().forEach((fila) => {
      MESES.forEach((mes) => {
        establecerValorCelda(fila, `budget-${mes}`, 0);
        establecerValorCelda(fila, `real-${mes}`, 0);
      });
      establecerValorCelda(fila, 'total-budget', 0);
      establecerValorCelda(fila, 'total-real', 0);
    });
  };

  const aplicarImportes = (registros = []) => {
    const mapa = new Map(registros.map((registro) => [registro.cuenta, registro]));
    obtenerFilasCuenta().forEach((fila) => {
      const cuenta = fila.dataset.cuenta21 || '';
      const registro = mapa.get(cuenta);
      let totalPresupuesto = 0;
      let totalReal = 0;
      MESES.forEach((mes) => {
        const presupuesto = registro?.presupuesto?.[mes] ?? 0;
        const real = registro?.real?.[mes] ?? 0;
        totalPresupuesto += Number(presupuesto) || 0;
        totalReal += Number(real) || 0;
        establecerValorCelda(fila, `budget-${mes}`, presupuesto);
        establecerValorCelda(fila, `real-${mes}`, real);
      });
      establecerValorCelda(fila, 'total-budget', totalPresupuesto);
      establecerValorCelda(fila, 'total-real', totalReal);
    });
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
      return;
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
  };

  const renderizarSecciones = ({ registros, cuerpo, placeholdersPorFila, sheetName, capitulo }) => {
    const secciones = new Map();
    registros.forEach((item) => {
      const clave = item.seccion || 'SIN SECCION';
      if (!secciones.has(clave)) {
        secciones.set(clave, []);
      }
      secciones.get(clave).push(item);
    });

    const resultRows = new Map();

    secciones.forEach((lista, seccion) => {
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
        celdaCuenta.textContent = item.cuenta || '-';
        fila.appendChild(celdaCuenta);
        const celdaNombre = document.createElement('td');
        celdaNombre.textContent = item.nombre || '';
        fila.appendChild(celdaNombre);
        fila.dataset.cuenta = item.cuenta || '';
        fila.dataset.cuenta21 = convertirCuenta21(item.cuenta || '');
        for (let i = 0; i < placeholdersPorFila; i += 1) {
          const celda = document.createElement('td');
          celda.className = 'budget-value';
          celda.textContent = '-';
          fila.appendChild(celda);
        }
        cuerpo.appendChild(fila);
      });

      const sumas = sheetName && capitulo ? obtenerSumasConfig(sheetName, capitulo, seccion) : null;
      if (sumas) {
        agregarFilaResumen({ texto: sumas.sumRow, clase: 'sum-row', cuerpo, placeholdersPorFila });
        agregarFilaResumen({ texto: sumas.sumRowSumavarios, clase: 'sum-row-sumavarios', cuerpo, placeholdersPorFila });
        agregarFilaResumen({ texto: sumas.sumRowSumavarios2, clase: 'sum-row-sumavarios2', cuerpo, placeholdersPorFila });
        if (sumas.resultRow) {
          const clave = `${sumas.resultRow}::result-row`;
          if (!resultRows.has(clave)) {
            resultRows.set(clave, sumas.resultRow);
          }
        }
      }
    });

    return Array.from(resultRows.values()).map((texto) => ({
      texto,
      clase: 'result-row'
    }));
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

  const renderizarTabla = (opciones = {}) => {
    const tabla = obtenerTabla(opciones.tablaSelector);
    const cuerpo = tabla?.querySelector('tbody');
    if (!tabla || !cuerpo) {
      return Promise.resolve(false);
    }

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

    const pendientes = renderizarSecciones({
      registros,
      cuerpo,
      placeholdersPorFila,
      sheetName: sheetConfigurada,
      capitulo: capituloDestino
    });

    pendientes.forEach((fila) => {
      agregarFilaResumen({
        texto: fila.texto,
        clase: fila.clase,
        cuerpo,
        placeholdersPorFila
      });
    });

    estadoModulo.tabla = tabla;
    estadoModulo.columnas = construirMapaColumnas(tabla);
    estadoModulo.moduloId = moduloNormalizado;
    estadoModulo.moduloClave = moduloClave;
    estadoModulo.sheet = sheetConfigurada;
    solicitarDatos();

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
      destroy() {
        destruido = true;
        window.removeEventListener(Sesion.EVENTO_EMPRESA, listener);
        window.removeEventListener(EVENTO_CONTEXTO, contextoListener);
      }
    };
  };

  window.CuentasModulo = {
    init: crearInstancia,
    render: renderizarTabla
  };
})();
  const normalizarCuentaBase = (cuenta) => {
    if (!cuenta) return '';
    return cuenta.toString().replace(/[^0-9A-Za-z]/g, '').toUpperCase();
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

  const convertirCuenta21 = (cuentaLegible) => {
    if (typeof window.cuentaLarga === 'function') {
      const resultado = window.cuentaLarga(cuentaLegible);
      if (resultado) return resultado;
    }
    const base = normalizarCuentaBase(cuentaLegible).padEnd(11, '0').slice(0, 11);
    if (!base.trim()) {
      return '';
    }
    const nivel = deducirNivel(base);
    return base.padEnd(20, '0') + nivel;
  };
