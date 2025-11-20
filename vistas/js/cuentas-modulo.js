(() => {
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
    const sheetPorConfig = window.CapitulosModulos?.obtenerSheetPorModulo
      ? window.CapitulosModulos.obtenerSheetPorModulo(moduloNormalizado)
      : null;
    const sheetConfigurada = opciones.sheet || moduloSheet || sheetPorConfig || moduloNormalizado;
    const dataset = window.CUENTAS_POR_MODULO || {};
    const hoja = sheetConfigurada ? dataset[sheetConfigurada] : null;
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

    return Promise.resolve(true);
  };

  const crearInstancia = (opciones) => {
    const config = { ...(opciones || {}) };
    let destruido = false;
    const ejecutar = () => {
      if (destruido) return Promise.resolve(false);
      return renderizarTabla(config).then((resultado) => {
        window.dispatchEvent(new CustomEvent('modulo-planeacion:tabla-actualizada'));
        return resultado;
      });
    };
    const ready = ejecutar();
    const listener = () => {
      ejecutar();
    };
    window.addEventListener(Sesion.EVENTO_EMPRESA, listener);
    return {
      ready,
      refresh: ejecutar,
      destroy() {
        destruido = true;
        window.removeEventListener(Sesion.EVENTO_EMPRESA, listener);
      }
    };
  };

  window.CuentasModulo = {
    init: crearInstancia,
    render: renderizarTabla
  };
})();
