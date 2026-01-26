(() => {
  const API_BASE = (() => {
    if (window.location.protocol === "file:")
      return "http://localhost:3005/api";
    return `${window.location.origin.replace(/\/$/, "")}/api`;
  })();
  // Comprobación temprana de disponibilidad del API.
  // Si no responde, insertamos un aviso visible en las tarjetas de tabla.
  (async function checkApiAndWarn() {
    const candidates = [`${API_BASE}/salud`, `${API_BASE}`];
    try {
      let ok = false;
      for (const url of candidates) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000);
          const resp = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (resp && resp.ok) {
            ok = true;
            break;
          }
        } catch (e) {
          // intentar siguiente candidato
        }
      }
      if (ok) return; // API disponible
      throw new Error("no disponible");
    } catch (err) {
      // Esperar DOM y mostrar mensaje en cada .table-card
      document.addEventListener('DOMContentLoaded', () => {
        const cards = document.querySelectorAll('.table-card');
        const mensaje = `No se pudo conectar al servidor API en ${API_BASE}.\nAsegúrate de levantar el backend (ej. run: npm run server) o configurar la URL correcta.`;
        cards.forEach((card) => {
          if (card.querySelector('.api-warning')) return;
          const aviso = document.createElement('div');
          aviso.className = 'api-warning p-3';
          aviso.style.background = '#fff7f7';
          aviso.style.border = '1px solid #f5c2c7';
          aviso.style.color = '#7a1f1f';
          aviso.style.borderRadius = '8px';
          aviso.style.marginBottom = '0.75rem';
          aviso.textContent = mensaje;
          // Insertar al inicio de la card para que sea visible
          const body = card.querySelector('.card-body') || card;
          body.insertBefore(aviso, body.firstChild);
        });
      });
    }
  })();
  const EVENTO_TABLA_ACTUALIZADA = "modulo-planeacion:tabla-actualizada";
  const EVENTO_CONTEXTO = "planeacion:contexto-actualizado";
  const MESES = [
    "ene",
    "feb",
    "mar",
    "abr",
    "may",
    "jun",
    "jul",
    "ago",
    "sep",
    "oct",
    "nov",
    "dic",
  ];
  const CLAVE_MES_A_PERIODO = new Map(
    MESES.map((clave, idx) => [clave, idx + 1])
  );

  const normalizarTexto = (valor) => {
    if (valor == null) return "";
    return valor
      .toString()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();
  };

  const normalizarSheetId = (texto) =>
    normalizarTexto(texto).replace(/[\s._]+/g, "");
  const normalizarModuloClave = (valor) =>
    normalizarTexto(valor || "")
      .replace(/[^A-Z0-9]/g, "")
      .toLowerCase();

  const obtenerTabla = (selector) => {
    if (selector) {
      const desdeSelector = document.querySelector(selector);
      if (desdeSelector) return desdeSelector;
    }
    return document.querySelector("#tablaComparacion");
  };

  const contarColumnas = (tabla) => {
    if (!tabla || !tabla.tHead) return 2;
    const filas = Array.from(tabla.tHead.rows || []);
    if (!filas.length) {
      return tabla.tHead.querySelectorAll("th").length || 2;
    }
    const ultima = filas[filas.length - 1];
    return (ultima && ultima.cells.length) || filas[0].cells.length || 2;
  };

  /**
   * Crea una fila de estado para mostrar mensajes informativos en la tabla
   *
   * Se usa cuando la tabla est├í vac├¡a o hay alg├║n error, por ejemplo:
   * - "El capitulo seleccionado no tiene esta vista asignada."
   * - "No hay informacion disponible para esta vista."
   * - "El capitulo no tiene cuentas configuradas en el libro."
   *
   * La fila ocupa todo el ancho de la tabla con una sola celda.
   *
   * @param {string} mensaje - Mensaje a mostrar al usuario
   * @param {number} colspan - N├║mero de columnas que debe abarcar la celda
   * @returns {HTMLTableRowElement} Fila HTML con el mensaje
   */
  const crearFilaEstado = (mensaje, colspan) => {
    const fila = document.createElement("tr");
    fila.className = "estado-tabla";
    const celda = document.createElement("td");
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
    const moduloId = dataset.moduloId || dataset.modulo || "";
    const moduloSheet = dataset.moduloSheet || "";
    const moduloLabel = dataset.modulo || dataset.moduloAlias || "";
    return { moduloId, moduloSheet, moduloLabel };
  };

  const MODULOS_SOPORTADOS = new Set([
    "comites",
    "comunicacion",
    "direccion",
    "eventos",
    "finanzas",
    "gastosgenerales",
    "gtoscorporativos",
    "nomina",
    "membresia",
    "rh",
    "servmembresia",
    "tic",
    "presupuestos",
    "vpe",
  ]);

  const MODULOS_LAYOUT_EDITABLE = new Set([
    "presupuestos",
    "presupuestoshtml",
    "vpe",
    "servmembresia",
    "serviciosalamembresia",
    "membresia",
    "comunicacion",
    "gtoscorporativos",
    "tic",
    "comites",
    "finanzas",
    "gastosgenerales",
    "rh",
    "recursoshumanos",
    "eventos",
    "nomina",
  ]);

  // M├│dulos sin operaciones autom├íticas (se usa la configuraci├│n tal como viene del layout/DB)
  const MODULOS_SIN_OPERACIONES_AUTOMATICAS = new Set([
    "membresia",
    "eventos",
    "comites",
    "comunicacion",
    "direccion",
    "finanzas",
    "rh",
    "servmembresia",
    "serviciosalamembresia",
    "tic",
    "vpe",
    "gastosgenerales",
    "gtoscorporativos",
    "nomina",
    "presupuestos",
  ]);

  const MODULOS_FILTRA_MESES_REALES = new Set([
    "membresia",
    "eventos",
    "comunicacion",
    "direccion",
    "servmembresia",
    "comites",
    "tic",
    "rh",
    "vpe",
    "finanzas",
    "gastosgenerales",
    "nomina",
    "gtoscorporativos",
    "presupuestos",
  ]);

  const normalizarEtiquetaExclusion = (texto) =>
    normalizarTexto(texto || "").replace(/\s+/g, " ");

    const ETIQUETAS_EXCLUIDAS_POR_MODULO = {
      servmembresia: new Set(
        [
          "TOTAL INGRESOS Serv Membres├¡a",
          "TOTAL GASTOS Serv Membres├¡a",
          "RESULTADO OPERATIVO Serv Membres├¡a",
          "RESULTADO Serv Membres├¡a",
          "Resultado Serv Membres├¡a",
        ].map(normalizarEtiquetaExclusion)
      ),
      tic: new Set(
        [
          "TOTAL INGRESOS T&IC",
          "TOTAL GASTOS T&IC",
          "RESULTADO T&IC",
          "Resultado T&IC",
        ].map(normalizarEtiquetaExclusion)
      ),
      vpe: new Set(
        [
          "TOTAL INGRESOS VPE",
          "TOTAL GASTOS VPE",
        ].map(normalizarEtiquetaExclusion)
      ),
      presupuestos: new Set(
        ["RESULTADO OPERATIVO CDMX"].map(normalizarEtiquetaExclusion)
      ),
    };

  const limpiarSumasPorModulo = (configuracionActual, moduloClave) => {
    const moduloNormalizado = normalizarModuloClave(moduloClave || "");
    const excluidas = ETIQUETAS_EXCLUIDAS_POR_MODULO[moduloNormalizado];
    if (!excluidas || !configuracionActual) return configuracionActual;

    const limpiarEtiqueta = (texto) => {
      if (!texto) return texto;
      return excluidas.has(normalizarEtiquetaExclusion(texto)) ? "" : texto;
    };

    const limpio = { ...configuracionActual };

    limpio.sumRowSumavarios = limpiarEtiqueta(limpio.sumRowSumavarios);
    limpio.sumRowSumavarios2 = limpiarEtiqueta(limpio.sumRowSumavarios2);

    if (
      limpio.resultRow &&
      excluidas.has(normalizarEtiquetaExclusion(limpio.resultRow))
    ) {
      delete limpio.resultRow;
    }

    if (Array.isArray(limpio.resultRows)) {
      limpio.resultRows = limpio.resultRows.filter(
        (texto) => !excluidas.has(normalizarEtiquetaExclusion(texto))
      );
    }

    return limpio;
  };

  // Reglas manuales: solo aplicamos para Eventos, el resto respeta el layout/DB.
  const REGLAS_OPERACIONES_MODULO = {
    eventos: {
      default: [
        // Ingresos Boletaje/Patrocinios -> resultado operativo y final
        {
          match: /INGRESOS/i,
          sumavarios: "Resultado Operativo Eventos",
          sumavarios2: "Resultado Eventos",
        },
        // Costos y Gastos Eventos -> resultado operativo y final (signo de gasto lo maneja el nombre)
        {
          match: /COSTOS\s+Y\s+GASTOS\s+EVENTOS/i,
          sumavarios: "Resultado Operativo Eventos",
          sumavarios2: "Resultado Eventos",
        },
        // Gastos Administrativos -> afecta solo el resultado final
        {
          match: /GASTOS\s+ADMINISTRATIVOS/i,
          sumavarios2: "Resultado Eventos",
        },
      ],
    },
  };

  const obtenerReglaModulo = (moduloClave) => {
    const clave = normalizarModuloClave(moduloClave || "");
    return REGLAS_OPERACIONES_MODULO[clave] || null;
  };

  const construirEtiquetasOperacion = (etiquetaVisible = "M├│dulo") => ({
    totalIngresos: `TOTAL INGRESOS ${etiquetaVisible}`,
    totalGastos: `TOTAL GASTOS ${etiquetaVisible}`,
    resultado: `RESULTADO ${etiquetaVisible}`,
  });

  // Aplica reglas manuales (solo Eventos); el resto se respeta tal como viene del layout/DB.
  const aplicarOperacionesPorModulo = (
    moduloClave,
    seccionNombre,
    configuracionActual = null
  ) => {
    if (!configuracionActual) return configuracionActual;
    const reglasModulo = obtenerReglaModulo(moduloClave);
    if (!reglasModulo || !Array.isArray(reglasModulo.default))
      return configuracionActual;

    const seccionNorm = normalizarTexto(seccionNombre);
    const regla = reglasModulo.default.find(
      (r) => r.match && r.match.test(seccionNorm)
    );
    if (!regla) return configuracionActual;

    const limpio = { ...configuracionActual };
    if (regla.sumavarios && !limpio.sumRowSumavarios) {
      limpio.sumRowSumavarios = regla.sumavarios;
    }
    if (regla.sumavarios2 && !limpio.sumRowSumavarios2) {
      limpio.sumRowSumavarios2 = regla.sumavarios2;
    }
    return limpio;
  };

  const MODULOS_OPERATIVO_POR_NOMBRE = new Set([
    "comites",
    "eventos",
    "servmembresia",
    "serviciosalamembresia",
    "tic",
  ]);
  const PALABRAS_IGNORADAS_OPERATIVO = new Set([
    "DE",
    "DEL",
    "LA",
    "EL",
    "LOS",
    "LAS",
  ]);

  const normalizarNombreOperativo = (texto, opciones = {}) => {
    const base = normalizarTexto(texto || "");
    if (!base) return "";
    const tokens = base
      .replace(/[^A-Z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token && !PALABRAS_IGNORADAS_OPERATIVO.has(token));
    if (!tokens.length) return "";
    if (opciones.ordenarTokens) {
      tokens.sort();
    }
    return tokens.join(" ");
  };

  const obtenerSignoOperacionPorSeccion = (moduloClave, seccion) => {
    const seccionNorm = normalizarTexto(seccion || "");
    if (!seccionNorm) return 0;
    if (moduloClave === "eventos") {
      return /COSTOS|GASTOS/.test(seccionNorm) ? -1 : 1;
    }
    if (/INGRESOS/.test(seccionNorm)) return 1;
    if (/GASTOS|COSTOS/.test(seccionNorm)) return -1;
    if (moduloClave === "comites" && /COMISIONES/.test(seccionNorm)) return -1;
    return 0;
  };

  const construirOperacionesResultadoOperativo = ({
    registros,
    moduloClave,
  }) => {
    if (!MODULOS_OPERATIVO_POR_NOMBRE.has(moduloClave)) return [];
    const grupos = new Map();
    const ordenarTokens = moduloClave === "comites";
    (Array.isArray(registros) ? registros : []).forEach((registro, idx) => {
      const signo = obtenerSignoOperacionPorSeccion(
        moduloClave,
        registro?.seccion
      );
      if (!signo) return;
      const nombre = (registro?.nombre || "").toString().trim();
      if (!nombre) return;
      const clave = normalizarNombreOperativo(nombre, { ordenarTokens });
      if (!clave) return;
      const cuenta21 = convertirCuenta21(registro?.cuenta || "");
      if (!cuenta21) return;
      const existente = grupos.get(clave) || {
        clave,
        nombre,
        ingresos: new Set(),
        gastos: new Set(),
        orden: idx,
      };
      if (nombre.length > existente.nombre.length) {
        existente.nombre = nombre;
      }
      if (signo > 0) {
        existente.ingresos.add(cuenta21);
      } else {
        existente.gastos.add(cuenta21);
      }
      if (idx < existente.orden) existente.orden = idx;
      grupos.set(clave, existente);
    });
    const operaciones = [];
    grupos.forEach((grupo) => {
      if (!grupo.ingresos.size || !grupo.gastos.size) return;
      const terminos = [];
      grupo.ingresos.forEach((cuenta) => {
        terminos.push({ cuenta21: cuenta, signo: 1 });
      });
      grupo.gastos.forEach((cuenta) => {
        terminos.push({ cuenta21: cuenta, signo: -1 });
      });
      operaciones.push({
        clave: grupo.clave,
        nombre: grupo.nombre,
        terminos,
        orden: grupo.orden,
      });
    });
    return operaciones.sort((a, b) => a.orden - b.orden);
  };

  const insertarOperacionesResultadoOperativo = ({
    cuerpo,
    placeholdersPorFila,
    operaciones,
    insertBefore,
  }) => {
    const filasOperativo = new Map();
    if (!cuerpo || !Array.isArray(operaciones) || !operaciones.length) {
      return filasOperativo;
    }
    const referenciaValida =
      insertBefore && insertBefore.parentNode === cuerpo ? insertBefore : null;
    const destino = referenciaValida ? document.createDocumentFragment() : cuerpo;

    const filaSeccion = document.createElement("tr");
    filaSeccion.className = "section-header-row";
    filaSeccion.dataset.seccion = normalizarTexto("Resultado Operativo");
    filaSeccion.dataset.sectionName = "Resultado Operativo";
    const celda = document.createElement("td");
    celda.colSpan = Math.max(0, placeholdersPorFila) + 2;
    celda.textContent = "Resultado Operativo";
    filaSeccion.appendChild(celda);
    destino.appendChild(filaSeccion);

    operaciones.forEach((operacion) => {
      const texto = `Resultado Operativo ${operacion.nombre}`;
      const fila = agregarFilaResumen({
        texto,
        clase: "sum-row-operativo",
        cuerpo: destino,
        placeholdersPorFila,
      });
      if (fila) {
        fila.dataset.operacionClave = operacion.clave;
        filasOperativo.set(operacion.clave, {
          fila,
          terminos: operacion.terminos,
        });
      }
    });

    if (referenciaValida) {
      cuerpo.insertBefore(destino, referenciaValida);
    }

    return filasOperativo;
  };

  const esModuloEditable = (moduloClave) =>
    MODULOS_LAYOUT_EDITABLE.has(normalizarModuloClave(moduloClave || ""));

  const obtenerAuthHeaders = () =>
    typeof Sesion?.headersAutenticacion === "function"
      ? Sesion.headersAutenticacion()
      : {};

  const obtenerCapituloAlternativo = async ({
    modulo,
    anio,
    capitulo,
    empresaId,
  }) => {
    if (!modulo || !Number.isInteger(anio) || !capitulo || !empresaId) {
      return null;
    }
    try {
      const params = new URLSearchParams({ empresaId });
      const url = `${API_BASE}/layouts/${encodeURIComponent(
        modulo
      )}/${anio}/capitulos?${params.toString()}`;
      const respuesta = await fetch(url, { headers: obtenerAuthHeaders() });
      if (!respuesta.ok) {
        return null;
      }
      const data = await respuesta.json();
      const capitulos = Array.isArray(data?.capitulos) ? data.capitulos : [];
      const objetivo = normalizarTexto(capitulo);
      for (const item of capitulos) {
        const nombre =
          typeof item === "object"
            ? item.capitulo || item.etiqueta || String(item)
            : item;
        if (normalizarTexto(nombre) === objetivo) {
          return nombre;
        }
      }
      return null;
    } catch (error) {
      return null;
    }
  };

  const cargarLayoutSqlite = async ({
    modulo,
    anio,
    capitulo,
    empresaId,
  }) => {
    if (!modulo || !Number.isInteger(anio) || !capitulo || !empresaId) {
      return null;
    }
    try {
      const params = new URLSearchParams({ empresaId });
      const construirUrl = (capituloFinal) =>
        `${API_BASE}/layouts/${encodeURIComponent(
          modulo
        )}/${anio}/${encodeURIComponent(capituloFinal)}?${params.toString()}`;
      let respuesta = await fetch(construirUrl(capitulo), {
        headers: obtenerAuthHeaders(),
      });
      if (respuesta.status === 404) {
        const alternativo = await obtenerCapituloAlternativo({
          modulo,
          anio,
          capitulo,
          empresaId,
        });
        if (alternativo && alternativo !== capitulo) {
          respuesta = await fetch(construirUrl(alternativo), {
            headers: obtenerAuthHeaders(),
          });
        }
      }
      if (!respuesta.ok) {
        if (respuesta.status !== 404) {
          console.warn("No fue posible cargar el layout SQL", respuesta.status);
        }
        return null;
      }
      const data = await respuesta.json();
      return data?.layout || null;
    } catch (error) {
      console.warn("No fue posible cargar el layout SQL", error);
      return null;
    }
  };

  const guardarLayoutServidor = async ({
    modulo,
    anio,
    capitulo,
    empresaId,
    cuentas,
    operaciones,
  }) => {
    if (
      !modulo ||
      !Number.isInteger(anio) ||
      !capitulo ||
      !empresaId ||
      !Array.isArray(cuentas) ||
      !Array.isArray(operaciones)
    ) {
      return false;
    }
    try {
      const url = `${API_BASE}/layouts/${encodeURIComponent(
        modulo
      )}/${anio}/${encodeURIComponent(capitulo)}`;
      const respuesta = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...obtenerAuthHeaders(),
        },
        body: JSON.stringify({
          empresaId,
          cuentas,
          operaciones,
        }),
      });
      if (!respuesta.ok) {
        const payload = await respuesta.json().catch(() => ({}));
        console.warn(
          "No fue posible guardar el layout en servidor",
          payload?.mensaje || respuesta.status
        );
        return false;
      }
      return true;
    } catch (error) {
      console.warn("No fue posible guardar el layout en servidor", error);
      return false;
    }
  };

  const estadoModulo = {
    moduloId: "",
    moduloClave: "",
    sheet: "",
    columnas: {},
    tabla: null,
    ultimaSolicitud: 0,
    anio: null,
    periodoCerrado: null,
    tooltips: [],
    editMode: false,
    editSnapshot: null,
    hayCambios: false,
    layoutModificado: false, // Flag para indicar que el layout fue modificado pero NO guardado
    sumas: {
      secciones: [],
      sumavariosRows: new Map(),
      resultRows: new Map(),
    },
    operacionesResultadoOperativo: new Map(),
    valoresPorCuenta: new Map(),
    nombresPorCuenta: new Map(),
    capitulo: "",
    placeholdersPorFila: 0,
    layoutActual: null,
    layoutOperaciones: [],
    layoutSnapshot: null,
    layoutEsPersonalizado: false,
    cuentasDisponibles: [],
    cuentasDisponiblesPorAnio: new Map(),
    catalogoPromesas: new Map(),
    catalogoFallido: new Set(),
    sugerencias: {
      contenedor: null,
    },
  };
  let moduloReadyDispatched = false;
  let panelPrincipales = null;

  const normalizarPeriodo = (valor) => {
    const numero = Number(valor);
    if (Number.isInteger(numero) && numero >= 1 && numero <= MESES.length) {
      return numero;
    }
    return null;
  };

  const obtenerPeriodoCerrado = () =>
    normalizarPeriodo(estadoModulo.periodoCerrado);

  const obtenerIndiceMesSistema = () => new Date().getMonth();

  /*
   * Determina el ├║ltimo mes cerrado visible.
   * Acepta anioEspecifico para sincronizar con la l├│gica de quien lo llama.
   */
    const obtenerIndicePeriodoActual = (anioEspecifico = null) => {
      const periodo = obtenerPeriodoCerrado();
      const indiceDesdeContexto = Number.isInteger(periodo) ? periodo - 1 : null;
      const indiceMesActual = obtenerIndiceMesSistema();

    // Si nos pasan un a├▒o, lo usamos. Si no, inferimos.
    const anioActual = new Date().getFullYear();
    let anioSeleccionado = anioEspecifico;

    if (anioSeleccionado === null) {
      // Fallback a l├│gica anterior
      const anioBase = obtenerAnioBaseSeleccionado();
      anioSeleccionado = Number.isInteger(anioBase) ? anioBase : anioActual;
    }

    // Para ejercicios PASADOS (< actual): mostrar a├▒o completo (11) SIEMPRE.
    if (anioSeleccionado < anioActual) {
      return MESES.length - 1;
    }

    // Para ejercicios FUTUROS (> actual): nada cerrado, devolver -1
    if (anioSeleccionado > anioActual) {
      return -1;
    }

    // Para el A├æO ACTUAL:
    const limitePorFecha = indiceMesActual - 1;
    let limite = limitePorFecha;
    if (indiceDesdeContexto != null) {
      limite = Math.min(indiceDesdeContexto, limitePorFecha);
    }

      const limiteMaximo = MESES.length - 1;
      return Math.max(-1, Math.min(limite, limiteMaximo));
    };

    const obtenerIndiceMesAcumulado = (anioEspecifico = null) => {
      const periodo = obtenerPeriodoCerrado();
      const indiceDesdeContexto = Number.isInteger(periodo) ? periodo - 1 : null;
      const indiceMesActual = obtenerIndiceMesSistema();

      const anioActual = new Date().getFullYear();
      let anioSeleccionado = anioEspecifico;

      if (anioSeleccionado === null) {
        const anioBase = obtenerAnioBaseSeleccionado();
        anioSeleccionado = Number.isInteger(anioBase) ? anioBase : anioActual;
      }

      if (anioSeleccionado < anioActual) {
        return MESES.length - 1;
      }

      if (anioSeleccionado > anioActual) {
        return -1;
      }

      const limiteMaximo = MESES.length - 1;
      const limite = indiceDesdeContexto != null ? indiceDesdeContexto : indiceMesActual;
      return Math.max(-1, Math.min(limite, limiteMaximo));
    };

    const obtenerPeriodoVisible = (anioEspecifico = null) => {
      const indice = obtenerIndicePeriodoActual(anioEspecifico);
      if (indice < 0) return 0;
      return indice + 1;
    };

  const MODAL_SECCION_ID = "sectionModal";
  const crearModalSeccion = () => {
    const modalWrapper = document.createElement("div");
    modalWrapper.id = MODAL_SECCION_ID;
    modalWrapper.className = "section-modal";
    modalWrapper.hidden = true;
    modalWrapper.innerHTML = `
      <div class="section-modal__overlay"></div>
      <div class="section-modal__dialog">
        <h5>Agregar secci├│n</h5>
        <form class="section-modal__form">
          <label class="section-modal__label" for="sectionTitleInput">T├¡tulo de secci├│n</label>
          <input id="sectionTitleInput" class="form-control section-modal__input" maxlength="80" required />

          <label class="section-modal__label" for="sectionSumLabelInput">Etiqueta para sum row</label>
          <input id="sectionSumLabelInput" class="form-control section-modal__input" maxlength="80" required />

          <label class="section-modal__label" for="sectionPrincipalSelect">Principal / sumatoria</label>
          <select id="sectionPrincipalSelect" class="form-select section-modal__input"></select>
          <input id="sectionPrincipalCustom" class="form-control section-modal__input" maxlength="120" placeholder="Nombre del principal" hidden />
          <label class="section-modal__label" for="sectionPrincipalFactor">Factor de operaci├│n</label>
          <input id="sectionPrincipalFactor" type="number" step="0.01" placeholder="Ej: 1 para sumar, -1 para restar" class="form-control section-modal__input" />
          <div class="form-text">Usa 1 para sumar, -1 para restar, 0.5 para dividir u otro factor personalizado.</div>
          <div id="sectionPrincipalInfo" class="section-modal__info"></div>

          <div id="sectionAccountsContainer" class="section-account-list"></div>
          <button type="button" id="sectionAddAccountBtn" class="btn btn-chip btn-chip-outline w-100 mb-3">
            <i class="bi bi-plus"></i>
            Agregar cuenta
          </button>

          <div class="form-check">
            <input class="form-check-input" type="checkbox" id="sectionGroupToggle">
            <label class="form-check-label" for="sectionGroupToggle">
              Crear sum row varios (secciones contiguas)
            </label>
          </div>
          <div id="sectionGroupFields" class="section-modal__group" hidden>
            <label class="section-modal__label" for="sectionGroupStart">Secci├│n inicial</label>
            <select id="sectionGroupStart" class="form-select section-modal__input"></select>
            <label class="section-modal__label" for="sectionGroupEnd">Secci├│n final</label>
            <select id="sectionGroupEnd" class="form-select section-modal__input"></select>
            <label class="section-modal__label" for="sectionGroupLabel">Etiqueta sum row varios</label>
            <input id="sectionGroupLabel" class="form-control section-modal__input" maxlength="80" />
          </div>

          <div class="section-modal__actions">
            <button type="submit" class="btn btn-primario">Crear secci├│n</button>
            <button type="button" id="sectionModalCancel" class="btn btn-chip btn-chip-outline">Cancelar</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modalWrapper);
    return modalWrapper;
  };

  const asegurarEstilosModal = () => {
    if (document.getElementById("sectionModalStyles")) return;
    const style = document.createElement("style");
    style.id = "sectionModalStyles";
    style.textContent = `
      .section-modal {
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1999;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.2s ease;
      }
      .section-modal:not([hidden]) {
        pointer-events: auto;
        opacity: 1;
      }
      .section-modal[hidden] {
        display: none !important;
        pointer-events: none !important;
      }
      .section-modal__overlay {
        position: absolute;
        inset: 0;
        background: rgba(0,0,0,0.35);
        pointer-events: auto;
      }
      .section-modal__dialog {
        position: relative;
        background: #fff;
        border-radius: 16px;
        padding: 24px;
        max-width: 420px;
        width: min(90vw, 420px);
        box-shadow: 0 18px 40px rgba(0,0,0,0.15);
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-height: 90vh;
        overflow-y: auto;
        z-index: 2000;
        pointer-events: auto;
      }
      .section-modal__form {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .section-modal__label {
        font-size: 0.85rem;
        font-weight: 600;
      }
      .section-account-row {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr auto;
        gap: 8px;
      }
      .section-account-row .form-control {
        margin-bottom: 0;
      }
      .section-account-factor-wrapper {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .section-account-factor-wrapper .form-select,
      .section-account-factor-wrapper .form-control {
        width: 100%;
      }
      .section-account-row button {
        align-self: center;
        background: transparent;
        border: none;
        color: #c74b3a;
        font-weight: 700;
        cursor: pointer;
      }
      .section-modal__group {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .section-modal__actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
        flex-wrap: wrap;
      }
      .section-modal__info {
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        padding: 12px;
        background: #f9fafb;
        max-height: 180px;
        overflow-y: auto;
        font-size: 0.8rem;
      }
      .section-modal__info h6 {
        font-size: 0.72rem;
        text-transform: uppercase;
        margin-bottom: 4px;
        letter-spacing: 0.05em;
      }
      .section-modal__info ul {
        padding-left: 16px;
        margin-bottom: 8px;
      }
      .section-modal__info li {
        margin-bottom: 2px;
      }
      .section-modal__dialog input,
      .section-modal__dialog button,
      .section-modal__dialog select,
      .section-modal__dialog textarea,
      .section-modal__dialog a {
        pointer-events: auto !important;
      }
    `;
    document.head.appendChild(style);
  };

  let sectionModalInstance = null;
  let pendingSectionReferencia = null;

  const crearCampoCuentaFormulario = () => {
    const fila = document.createElement("div");
    fila.className = "section-account-row";
    fila.innerHTML = `
      <input type="text" class="form-control section-account-input" placeholder="Cuenta" maxlength="25" />
      <input type="text" class="form-control section-account-input" placeholder="Descripcion" maxlength="120" />
      <div class="section-account-factor-wrapper">
        <select class="form-select section-account-factor" required>
          <option value="" selected disabled>Operacion</option>
          <option value="1">Sumar (+1)</option>
          <option value="-1">Restar (-1)</option>
          <option value="custom">Personalizado</option>
        </select>
        <input type="number" step="0.01" class="form-control section-account-factor-custom d-none" placeholder="Ej: 0.5 o -0.5" />
      </div>
      <button type="button" aria-label="Eliminar cuenta">&times;</button>
    `;
    const factorSelect = fila.querySelector(".section-account-factor");
    const factorCustom = fila.querySelector(".section-account-factor-custom");
    factorSelect.addEventListener("change", () => {
      const usarCustom = factorSelect.value === "custom";
      factorCustom.classList.toggle("d-none", !usarCustom);
      if (!usarCustom) {
        factorCustom.value = "";
      }
    });
    fila.querySelector("button").addEventListener("click", () => fila.remove());
    return fila;
  };

  const poblarSelectSeccionesModal = () => {
    if (!sectionModalInstance) return;
    const startSelect =
      sectionModalInstance.querySelector("#sectionGroupStart");
    const endSelect = sectionModalInstance.querySelector("#sectionGroupEnd");
    if (!startSelect || !endSelect) return;
    startSelect.innerHTML = "";
    endSelect.innerHTML = "";
    const secciones = (estadoModulo.sumas.secciones || []).map((meta, idx) => ({
      idx,
      label: meta?.tituloVisible || meta?.seccion || `Secci├│n ${idx + 1}`,
    }));
    const groupToggle = sectionModalInstance.querySelector(
      "#sectionGroupToggle"
    );
    if (!secciones.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "Sin secciones disponibles";
      option.disabled = true;
      startSelect.appendChild(option);
      endSelect.appendChild(option.cloneNode(true));
      if (groupToggle) {
        groupToggle.checked = false;
        groupToggle.disabled = true;
        sectionModalInstance.querySelector("#sectionGroupFields").hidden = true;
      }
      return;
    }
    if (groupToggle) {
      groupToggle.disabled = false;
    }
    secciones.forEach(({ idx, label }) => {
      const optionStart = document.createElement("option");
      optionStart.value = String(idx);
      optionStart.textContent = label;
      startSelect.appendChild(optionStart);
      const optionEnd = optionStart.cloneNode(true);
      endSelect.appendChild(optionEnd);
    });
  };

  const obtenerPrincipalesResumen = () => {
    const mapa = new Map();
    (estadoModulo.sumas.secciones || []).forEach((meta) => {
      const label = meta?.sumRowSumavariosLabel || "";
      if (!label) return;
      const clave = normalizarTexto(label);
      if (!mapa.has(clave)) {
        mapa.set(clave, { label, secciones: [] });
      }
      mapa.get(clave).secciones.push({
        nombre: meta.tituloVisible || meta.seccion || "Sin t├¡tulo",
        factor: Number.isFinite(meta.factor)
          ? meta.factor
          : Number.isFinite(meta.operacionFactor)
          ? meta.operacionFactor
          : 1,
      });
    });
    return Array.from(mapa.values());
  };

  const llenarSelectPrincipalesModal = () => {
    const elems = getSectionModalElements();
    if (!elems?.principalSelect) return;
    const select = elems.principalSelect;
    const resumen = obtenerPrincipalesResumen();
    select.innerHTML = "";
    const optionDefault = document.createElement("option");
    optionDefault.value = "";
    optionDefault.textContent = "Selecciona principal";
    select.appendChild(optionDefault);
    resumen.forEach((item) => {
      const opt = document.createElement("option");
      opt.value = item.label;
      opt.textContent = `${item.label} (${item.secciones.length})`;
      select.appendChild(opt);
    });
    const optNuevo = document.createElement("option");
    optNuevo.value = "__custom__";
    optNuevo.textContent = "Crear nuevo principal...";
    select.appendChild(optNuevo);
  };

  const renderizarResumenPrincipalesModal = () => {
    const elems = getSectionModalElements();
    if (!elems?.principalInfo) return;
    const resumen = obtenerPrincipalesResumen();
    if (!resumen.length) {
      elems.principalInfo.innerHTML =
        '<p class="text-muted small mb-0">A├║n no hay principales configurados.</p>';
      return;
    }
    const contenido = resumen
      .map((item) => {
        const lista = item.secciones
          .map(
            (sec) =>
              `<li>${sec.nombre} <span class="badge bg-light text-dark ms-1">${
                sec.factor >= 0 ? "+" : ""
              }${sec.factor}</span></li>`
          )
          .join("");
        return `<div class="mb-2">
          <h6>${item.label}</h6>
          <ul class="mb-0">${lista}</ul>
        </div>`;
      })
      .join("");
    elems.principalInfo.innerHTML = contenido;
  };

  const abrirModalAgregarSeccion = (referencia) => {
    asegurarModal();
    sectionModalInstance = sectionModalInstance || crearModalSeccion();
    pendingSectionReferencia = referencia || null;
    if (!sectionModalInstance) return;
    const modal = sectionModalInstance;
    const form = modal.querySelector("form");
    const accountsContainer = modal.querySelector("#sectionAccountsContainer");
    const groupToggle = modal.querySelector("#sectionGroupToggle");
    const groupFields = modal.querySelector("#sectionGroupFields");
    const titleInput = modal.querySelector("#sectionTitleInput");
    const sumLabelInput = modal.querySelector("#sectionSumLabelInput");
    const groupLabelInput = modal.querySelector("#sectionGroupLabel");
    const factorInput = modal.querySelector("#sectionPrincipalFactor");
    if (!form || !accountsContainer || !groupToggle || !groupFields) return;
    titleInput.value = "";
    sumLabelInput.value = "";
    groupToggle.checked = false;
    groupFields.hidden = true;
    groupLabelInput.value = "";
    if (factorInput) {
      factorInput.value = "";
    }
    accountsContainer.innerHTML = "";
    accountsContainer.appendChild(crearCampoCuentaFormulario());
    abrirModalAgregarSeccion.actualizarSecciones = () =>
      poblarSelectSeccionesModal();
    poblarSelectSeccionesModal();
    modal.hidden = false;
    modal.removeAttribute("hidden");
    modal.style.display = "flex";
    modal.style.pointerEvents = "auto";
    const overlay = modal.querySelector(".section-modal__overlay");
    if (overlay) {
      overlay.style.pointerEvents = "auto";
    }
    void modal.offsetHeight;
    const primerInput = modal.querySelector("input, select, textarea");
    if (primerInput) {
      setTimeout(() => primerInput.focus(), 100);
    }
  };

  const cerrarModalSeccion = () => {
    if (!sectionModalInstance) return;
    sectionModalInstance.hidden = true;
    sectionModalInstance.setAttribute("hidden", "hidden");
    sectionModalInstance.style.display = "none";
    sectionModalInstance.style.pointerEvents = "none";
    const overlay = sectionModalInstance.querySelector(
      ".section-modal__overlay"
    );
    if (overlay) {
      overlay.style.pointerEvents = "none";
    }
    const form = sectionModalInstance.querySelector("form");
    if (form) {
      form.reset();
    }
  };

  const getSectionModalElements = () => {
    if (!sectionModalInstance) return null;
    return {
      form: sectionModalInstance.querySelector("form"),
      titleInput: sectionModalInstance.querySelector("#sectionTitleInput"),
      sumLabelInput: sectionModalInstance.querySelector(
        "#sectionSumLabelInput"
      ),
      accountsContainer: sectionModalInstance.querySelector(
        "#sectionAccountsContainer"
      ),
      addAccountBtn: sectionModalInstance.querySelector(
        "#sectionAddAccountBtn"
      ),
      groupToggle: sectionModalInstance.querySelector("#sectionGroupToggle"),
      groupFields: sectionModalInstance.querySelector("#sectionGroupFields"),
      groupStart: sectionModalInstance.querySelector("#sectionGroupStart"),
      groupEnd: sectionModalInstance.querySelector("#sectionGroupEnd"),
      groupLabel: sectionModalInstance.querySelector("#sectionGroupLabel"),
      cancelBtn: sectionModalInstance.querySelector("#sectionModalCancel"),
      principalSelect: sectionModalInstance.querySelector(
        "#sectionPrincipalSelect"
      ),
      principalCustom: sectionModalInstance.querySelector(
        "#sectionPrincipalCustom"
      ),
      principalFactor: sectionModalInstance.querySelector(
        "#sectionPrincipalFactor"
      ),
      principalInfo: sectionModalInstance.querySelector(
        "#sectionPrincipalInfo"
      ),
    };
  };

  const inicializarModalSeccion = () => {
    asegurarEstilosModal();
    sectionModalInstance = sectionModalInstance || crearModalSeccion();
    const elems = getSectionModalElements();
    if (!elems) return;
    elems.groupToggle.addEventListener("change", () => {
      elems.groupFields.hidden = !elems.groupToggle.checked;
    });
    elems.addAccountBtn.addEventListener("click", () => {
      elems.accountsContainer.appendChild(crearCampoCuentaFormulario());
    });
    elems.cancelBtn.addEventListener("click", () => {
      cerrarModalSeccion();
    });
    elems.form.addEventListener("submit", (event) => {
      event.preventDefault();
      const cuentas = [];
      let factorInvalido = false;
      Array.from(
        elems.accountsContainer.querySelectorAll(".section-account-row")
      ).forEach((row) => {
        const inputs = row.querySelectorAll("input");
        const factorSelect = row.querySelector(".section-account-factor");
        const factorCustomInput = row.querySelector(
          ".section-account-factor-custom"
        );
        const cuentaValor = inputs[0]?.value.trim() || "";
        const descripcionValor = inputs[1]?.value.trim() || "";
        if (!cuentaValor && !descripcionValor) return;
        const seleccion = factorSelect?.value;
        if (!seleccion) {
          factorInvalido = true;
          return;
        }
        let factorValor = null;
        if (seleccion === "custom") {
          const customRaw = factorCustomInput?.value;
          if (
            customRaw === undefined ||
            customRaw === null ||
            customRaw === ""
          ) {
            factorInvalido = true;
            return;
          }
          factorValor = Number(customRaw);
        } else {
          factorValor = Number(seleccion);
        }
        if (!Number.isFinite(factorValor)) {
          factorInvalido = true;
          return;
        }
        cuentas.push({
          cuenta: cuentaValor,
          descripcion: descripcionValor,
          factor: factorValor,
        });
      });
      if (!cuentas.length) {
        window.alert("Debes agregar al menos una cuenta para la secci├│n.");
        return;
      }
      if (factorInvalido) {
        window.alert(
          "Define la operaci├│n (sumar, restar o factor personalizado) para cada cuenta."
        );
        return;
      }
      const titulo = elems.titleInput.value.trim();
      const sumLabel = elems.sumLabelInput.value.trim();
      if (!titulo || !sumLabel) {
        window.alert("El t├¡tulo y la etiqueta del sum row son obligatorios.");
        return;
      }
      const factorSeccionRaw = elems.principalFactor?.value;
      const factorSeccionValor =
        factorSeccionRaw === undefined ? NaN : Number(factorSeccionRaw);
      if (factorSeccionRaw === "" || !Number.isFinite(factorSeccionValor)) {
        window.alert("Indica c├│mo opera la secci├│n (factor de suma/resta).");
        return;
      }
      let range = null;
      let sumavariosLabel = "";
      if (elems.groupToggle.checked) {
        const start = Number(elems.groupStart.value);
        const end = Number(elems.groupEnd.value);
        sumavariosLabel = elems.groupLabel.value.trim();
        if (Number.isNaN(start) || Number.isNaN(end) || start > end) {
          window.alert(
            "Selecciona un rango v├ílido para las secciones contiguas."
          );
          return;
        }
        if (!sumavariosLabel) {
          window.alert("Proporciona una etiqueta para el sum row varios.");
          return;
        }
        range = { start, end };
      }
      crearSeccionDesdeFormulario({
        referenciaFila: pendingSectionReferencia,
        titulo,
        sumLabel,
        cuentas,
        sumavariosLabel,
        range,
        factorSeccion: factorSeccionValor,
      });
      cerrarModalSeccion();
    });
  };

  const asegurarModal = () => {
    if (sectionModalInstance) return;
    inicializarModalSeccion();
  };

  const obtenerYearSelect = () => {
    return (
      document.querySelector('[data-role="module-year-select"]') ||
      document.querySelector('select[id$="YearSelect"]')
    );
  };

  const obtenerAnioSeleccionado = () => {
    const select = obtenerYearSelect();
    if (select) {
      const crudo = (select.value || "").trim();
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

  const obtenerAnioBaseSeleccionado = () => {
    const anioSelect = obtenerAnioSeleccionado();
    if (Number.isInteger(anioSelect)) return anioSelect;
    if (Number.isInteger(estadoModulo.anio)) return estadoModulo.anio;
    return null;
  };

  const esAnioEnCurso = () => {
    const anioBase = obtenerAnioBaseSeleccionado();
    const anioActual = new Date().getFullYear();
    return Number.isInteger(anioBase) && anioBase === anioActual;
  };

  const construirMapaColumnas = (tabla) => {
    if (!tabla?.tHead) {
      return {};
    }
    const mapa = {};
    const cabeceras = Array.from(tabla.tHead.querySelectorAll("th"));
    cabeceras.forEach((th, indice) => {
      if (th.classList.contains("budget-annual-column")) {
        mapa["budget-annual"] = indice;
      } else if (th.classList.contains("budget-monthly-column")) {
        mapa["budget-monthly"] = indice;
      }
      if (th.classList.contains("month-budget")) {
        const clave = th.dataset.mes || "";
        mapa[`budget-${clave}`] = indice;
      } else if (th.classList.contains("month-real")) {
        const clave = th.dataset.mes || "";
        mapa[`real-${clave}`] = indice;
      } else if (th.classList.contains("year-column")) {
        mapa.year = indice;
      } else if (th.classList.contains("total-budget-column")) {
        mapa["total-budget"] = indice;
      } else if (th.classList.contains("total-real-column")) {
        mapa["total-real"] = indice;
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

  const actualizarStickyHeaderOffsets = (tabla) => {
    if (!tabla?.tHead) return;
    const filas = Array.from(tabla.tHead.rows || []);
    let offset = 0;
    filas.forEach((fila) => {
      const altura = Math.ceil(fila.getBoundingClientRect().height);
      Array.from(fila.cells).forEach((celda) => {
        celda.style.top = `${offset}px`;
      });
      offset += altura;
    });
  };

  const actualizarStickyTotalsOffset = (tabla) => {
    if (!tabla?.tHead) return;
    const thReal = tabla.tHead.querySelector("th.total-real-column");
    if (!thReal) return;
    const ancho = Math.ceil(thReal.getBoundingClientRect().width);
    if (ancho > 0) {
      tabla.style.setProperty("--sticky-total-real-width", `${ancho}px`);
    }
  };

  const actualizarStickyOffsets = () => {
    const tabla = estadoModulo.tabla;
    if (!tabla) return;
    actualizarStickyHeaderOffsets(tabla);
    actualizarStickyTotalsOffset(tabla);
  };

  let stickyResizeBound = false;
  const bindStickyResize = () => {
    if (stickyResizeBound) return;
    stickyResizeBound = true;
    window.addEventListener("resize", () => {
      actualizarStickyOffsets();
    });
  };

  const aplicarStickyEncabezados = () => {
    const tabla = estadoModulo.tabla;
    if (!tabla) return;
    tabla.classList.add("sticky-header");
    requestAnimationFrame(() => {
      actualizarStickyHeaderOffsets(tabla);
    });
    bindStickyResize();
  };

  const aplicarStickyTotales = () => {
    const tabla = estadoModulo.tabla;
    if (!tabla) return;
    const idxBudget = estadoModulo.columnas["total-budget"];
    const idxReal = estadoModulo.columnas["total-real"];
    if (idxBudget == null || idxReal == null) return;
    tabla.classList.add("sticky-totals");
    const thBudget = tabla.tHead?.querySelector("th.total-budget-column");
    const thReal = tabla.tHead?.querySelector("th.total-real-column");
    if (thBudget) thBudget.classList.add("sticky-total-budget");
    if (thReal) thReal.classList.add("sticky-total-real");
    const filas = Array.from(tabla.tBodies[0]?.rows || []);
    filas.forEach((fila) => {
      const celdaBudget = fila.cells[idxBudget];
      if (celdaBudget) celdaBudget.classList.add("sticky-total-budget");
      const celdaReal = fila.cells[idxReal];
      if (celdaReal) celdaReal.classList.add("sticky-total-real");
    });
    requestAnimationFrame(() => {
      actualizarStickyTotalsOffset(tabla);
    });
    bindStickyResize();
  };

  const esClaveBudget = (clave) => clave && clave.startsWith("budget-");

  const parsearNumero = (texto) => {
    const limpio = (texto || "")
      .toString()
      .replace(/[^0-9+.,-]/g, "")
      .replace(/,/g, "");
    const numero = parseFloat(limpio);
    return Number.isFinite(numero) ? numero : 0;
  };

  const formatearNumero = (valor) => {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return "0.00";
    const fijo = numero.toFixed(2);
    const [entero, decimales] = fijo.split(".");
    const enteroConComas = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return `${enteroConComas}.${decimales}`;
  };

  const obtenerFilasCuenta = () => {
    if (!estadoModulo.tabla) {
      return [];
    }
    return Array.from(
      estadoModulo.tabla.querySelectorAll("tbody tr.fila-cuenta")
    );
  };

  const actualizarNombreFila = (fila, nombre) => {
    if (!fila || fila.cells.length < 2) return;
    if (!nombre) return;
    fila.cells[1].textContent = nombre;
  };

  /**

   * Recalcula los totales de una fila de presupuesto

   *

   * Esta funcion suma horizontalmente los valores de presupuesto y real

   * de todos los meses para calcular los acumulados de una cuenta especifica.

   *

   * Calculos que realiza:

   * - Total Presupuesto: Suma de budget-ene hasta budget-[mes en curso] (incluye el mes actual)
   * - Total Real: Suma de real-ene hasta real-[mes en curso] (incluye el mes actual)
   * - Presupuesto Anual: Suma completa de todas las columnas budget-[mes]
   * - Mensual: Valor real del ultimo mes cerrado (budget-monthly)
   *

   * @param {HTMLTableRowElement} fila - Fila de la tabla a recalcular

   */

  const recalcularTotalesFilaPresupuesto = (fila) => {
    if (!fila) return;

    const cuenta = fila.dataset.cuenta21 || "";

    const almacen = estadoModulo.valoresPorCuenta.get(cuenta) || {};

    // Obtener el mes actual (0-11, donde 0=enero, 11=diciembre)

    const limiteMes =
      estadoModulo.mesActualIndex ?? obtenerIndicePeriodoActual();
    const mesActualIndex = Number.isInteger(limiteMes) ? limiteMes : -1;
    const mesActualClave = mesActualIndex >= 0 ? MESES[mesActualIndex] : null;
    const mesAcumuladoIndex = obtenerIndiceMesAcumulado();

    let totalPresupuestoAcumulado = 0;

    let totalPresupuestoAnual = 0;

    let totalRealAcumulado = 0;

    // Sumar meses hasta el mes en curso para las columnas acumuladas

    MESES.forEach((mes, index) => {
      const presupuestoMes = Number(almacen[`budget-${mes}`]) || 0;

      const realMes = Number(almacen[`real-${mes}`]) || 0;

      totalPresupuestoAnual += presupuestoMes;

      if (index <= mesAcumuladoIndex) {
        totalPresupuestoAcumulado += presupuestoMes;
        totalRealAcumulado += realMes;
      }
    });

    // Obtener valor del mes actual especificamente

    const realMesActual = mesActualClave
      ? Number(almacen[`real-${mesActualClave}`]) || 0
      : 0;

    // Actualizar celda de total-budget: acumulado desde enero hasta mes actual

    if (estadoModulo.columnas["total-budget"] != null) {
      const celdaTotal = fila.cells[estadoModulo.columnas["total-budget"]];

      if (celdaTotal) {
        celdaTotal.textContent = formatearNumero(totalPresupuestoAcumulado);
      }
    }

    // Actualizar celda budget-annual: suma total del presupuesto anual

    if (estadoModulo.columnas["budget-annual"] != null) {
      const celdaAnnual = fila.cells[estadoModulo.columnas["budget-annual"]];

      if (celdaAnnual) {
        celdaAnnual.textContent = formatearNumero(totalPresupuestoAnual);
      }
    }

    // Actualizar celda budget-monthly: real del mes actual

    if (estadoModulo.columnas["budget-monthly"] != null) {
      const celdaMensual = fila.cells[estadoModulo.columnas["budget-monthly"]];

      if (celdaMensual) {
        celdaMensual.textContent = formatearNumero(realMesActual);
      }
    }

    // Actualizar celda total-real: acumulado desde enero hasta mes actual

    if (estadoModulo.columnas["total-real"] != null) {
      const celdaRealTotal = fila.cells[estadoModulo.columnas["total-real"]];

      if (celdaRealTotal) {
        celdaRealTotal.textContent = formatearNumero(totalRealAcumulado);
      }
    }

    almacen["total-budget"] = totalPresupuestoAcumulado;

    almacen["budget-annual"] = totalPresupuestoAnual;

    almacen["budget-monthly"] = realMesActual;

    almacen["total-real"] = totalRealAcumulado;

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
      establecerValorCelda(fila, "total-budget", 0);
      establecerValorCelda(fila, "total-real", 0);
      establecerValorCelda(fila, "budget-annual", 0);
      establecerValorCelda(fila, "budget-monthly", 0);
    });
    recalcularSumas();
    estadoModulo.hayCambios = false;
    estadoModulo.editSnapshot = null;
  };

  const CUENTAS_AUTO_CDMX = {
    '450-001-000-00': { capitulo: 'GUADALAJARA', tipo: 'income' },
    '950-001-000-00': { capitulo: 'GUADALAJARA', tipo: 'expense' },
    '450-002-000-00': { capitulo: 'NORESTE', tipo: 'income' },
    '950-002-000-00': { capitulo: 'NORESTE', tipo: 'expense' },
    '450-003-000-00': { capitulo: 'NOROESTE', tipo: 'income' },
    '950-003-000-00': { capitulo: 'NOROESTE', tipo: 'expense' },
  };

  // Mapeo de cap├¡tulo a empresaId (usar claves normalizadas)
  const CAPITULO_A_EMPRESA = {
    [normalizarTexto("GUADALAJARA")]: "empresa2",
    [normalizarTexto("NORESTE")]: "empresa3",
    [normalizarTexto("MONTERREY")]: "empresa3",
    [normalizarTexto("NOROESTE")]: "empresa4",
    [normalizarTexto("NORTHWEST")]: "empresa4",
    [normalizarTexto("CIUDAD DE MEXICO")]: "empresa1",
  };

  // Flag para evitar reinicializaci├│n recursiva
  let estaInicializandoCuentas = false;

  // Funci├│n helper para cargar datos de presupuestos de un cap├¡tulo/empresa espec├¡fico
  const cargarDatosPresupuestosCapitulo = async (empresaId, anio) => {
    try {
      const params = new URLSearchParams({
        empresaId: empresaId.toString(),
        anio: anio.toString(),
        mes: '12', // Diciembre para tener el acumulado anual
      });

      const respuesta = await fetch(`${API_BASE}/reportes/resumen?${params.toString()}`, {
        headers: Sesion.headersAutenticacion(),
      });

      if (!respuesta.ok) {
        console.error(`Error al cargar resumen: ${respuesta.status}`);
        return null;
      }

      const datos = await respuesta.json();
      return datos;
    } catch (error) {
      console.error('Error cargando resumen:', error);
      return null;
    }
  };

  /**
   * Carga valores mensuales de INCOME y EXPENSE del RESUMEN (columna "Ppto.")
   * Para cada mes del a├▒o, obtiene el valor planMonth de los principales
   */
  const cargarDatosSummaryCapitulo = async (capitulo, anio) => {
    try {
      // Obtener el empresaId del cap├¡tulo usando el mapeo normalizado
      const claveCapitulo = normalizarTexto(capitulo);
      let empresaId = CAPITULO_A_EMPRESA[claveCapitulo];
      if (!empresaId && window.CapitulosModulos?.EMPRESA_CONFIG) {
        const config = Object.values(window.CapitulosModulos.EMPRESA_CONFIG).find(
          (item) => normalizarTexto(item.capitulo) === claveCapitulo
        );
        empresaId = config?.id || null;
      }

      if (!empresaId) {
        console.warn(`ÔØî No se encontr├│ empresaId para cap├¡tulo: ${capitulo}`);
        return null;
      }

      console.log(`­ƒôè Cargando valores mensuales de RESUMEN de ${capitulo} (empresa: ${empresaId})`);

      // Cargar los 12 meses del resumen
      const valoresPorMes = { income: {}, expense: {} };
      
      for (let mes = 1; mes <= 12; mes++) {
        const params = new URLSearchParams({
          empresaId: empresaId.toString(),
          anio: anio.toString(),
          mes: mes.toString(),
          capitulo: capitulo
        });

        const respuesta = await fetch(`${API_BASE}/reportes/resumen?${params.toString()}`, {
          headers: Sesion.headersAutenticacion()
        });

        if (!respuesta.ok) {
          console.error(`ÔØî Error al cargar resumen ${capitulo} mes ${mes}`);
          continue;
        }

        const datos = await respuesta.json();

        // Buscar los principales INCOME y EXPENSE
        const principales =
          datos.principals ||
          datos.principales ||
          datos.resumen?.[0]?.children ||
          [];
        const income = principales.find((p) => {
          const label = normalizarTexto(p.label || "");
          return label === "INCOME" || label === "INGRESOS";
        });
        const expense = principales.find((p) => {
          const label = normalizarTexto(p.label || "");
          return label === "EXPENSE" || label === "GASTOS" || label === "EXPENSES";
        });

        // Guardar el valor de planMonth (columna "Ppto." del RESUMEN)
        const nombreMes = MESES[mes - 1];
        const incomePlan = income?.planMonth ?? income?.totals?.planMonth ?? 0;
        const expensePlan = expense?.planMonth ?? expense?.totals?.planMonth ?? 0;
        valoresPorMes.income[nombreMes] = incomePlan || 0;
        valoresPorMes.expense[nombreMes] = expensePlan || 0;
      }

      console.log(`Ô£à Valores mensuales cargados para ${capitulo}:`, {
        enero: { income: valoresPorMes.income.ene, expense: valoresPorMes.expense.ene }
      });

      return valoresPorMes;
    } catch (error) {
      console.error(`ÔØî Error al cargar totales de ${capitulo}:`, error);
      return null;
    }
  };

  const aplicarDatosAutomaticos = async (anio) => {
    const moduloClave = estadoModulo.moduloClave || normalizarModuloClave(estadoModulo.moduloId);
    const empresa = Sesion.obtenerEmpresaActiva();
    const capitulo = empresa ? window.CapitulosModulos?.obtenerCapituloPorEmpresa(empresa.id) : null;

    // Solo aplicar para m├│dulo presupuestos en Ciudad de M├®xico
    if (
      moduloClave !== 'presupuestos' ||
      normalizarTexto(capitulo) !== normalizarTexto('CIUDAD DE MEXICO')
    ) {
      return;
    }

    console.log('­ƒöä Consolidando presupuestos de cap├¡tulos en CDMX (desde columna "Ppto." del RESUMEN)');

    // Cargar datos de los tres cap├¡tulos
    const [gdlData, neData, noData] = await Promise.all([
      cargarDatosSummaryCapitulo('GUADALAJARA', anio),
      cargarDatosSummaryCapitulo('NORESTE', anio),
      cargarDatosSummaryCapitulo('NOROESTE', anio),
    ]);

    console.log('­ƒôª Datos cargados:', { gdlData, neData, noData });

    const datosCapitulos = {
      GUADALAJARA: gdlData,
      NORESTE: neData,
      NOROESTE: noData,
    };

    // Preparar datos para actualizar en la base de datos
    const cuentasParaActualizar = [];

    Object.entries(CUENTAS_AUTO_CDMX).forEach(([cuentaVisible, config]) => {
      const cuenta21 = convertirCuenta21(cuentaVisible);
      if (!cuenta21) return;

      const datos = datosCapitulos[config.capitulo];
      if (!datos) return;

      const valoresTipo = datos[config.tipo]; // income o expense
      if (!valoresTipo) return;

      // Preparar objeto de valores mensuales
      const valores = {};
      MESES.forEach((mes) => {
        valores[mes] = valoresTipo[mes] || 0;
      });

      cuentasParaActualizar.push({
        numCta: cuenta21,
        cuentaVisible: cuentaVisible,
        valores: valores,
        config: config
      });
    });

    // Verificar si es necesario actualizar comparando con los valores actuales
    let necesitaActualizacion = false;
    for (const cuentaData of cuentasParaActualizar) {
      const cuenta21 = cuentaData.numCta;
      const valoresActuales = estadoModulo.valoresPorCuenta.get(cuenta21);
      
      if (!valoresActuales) {
        necesitaActualizacion = true;
        break;
      }

      // Verificar si hay diferencias en los valores mensuales
      for (const mes of MESES) {
        const valorNuevo = cuentaData.valores[mes] || 0;
        const valorActual = valoresActuales[`budget-${mes}`] || 0;
        
        // Si hay diferencia significativa (m├ís de 1 peso), necesita actualizaci├│n
        if (Math.abs(valorNuevo - valorActual) > 1) {
          necesitaActualizacion = true;
          console.log(`­ƒöä Diferencia detectada en ${cuentaData.cuentaVisible} mes ${mes}: ${valorActual} ÔåÆ ${valorNuevo}`);
          break;
        }
      }
      
      if (necesitaActualizacion) break;
    }

    if (!necesitaActualizacion) {
      console.log('Ô£à Las cuentas ya tienen los valores correctos, no es necesario actualizar');
      estaInicializandoCuentas = false;
      return;
    }

    console.log(`­ƒôï Valores a actualizar:`, {
      'GDL Income (450-001) Enero': cuentasParaActualizar.find(c => c.cuentaVisible === '450-001-000-00')?.valores.ene,
      'GDL Expense (950-001) Enero': cuentasParaActualizar.find(c => c.cuentaVisible === '950-001-000-00')?.valores.ene
    });

    // Actualizar en la base de datos
    if (cuentasParaActualizar.length > 0 && !estaInicializandoCuentas) {
      estaInicializandoCuentas = true;
      try {
        console.log(`­ƒÆ¥ Actualizando ${cuentasParaActualizar.length} cuentas en base de datos...`);
        
        const respuestaUpdate = await fetch(`${API_BASE}/presupuestos/actualizar-consolidados`, {
          method: 'POST',
          headers: {
            ...Sesion.headersAutenticacion(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            anio,
            cuentas: cuentasParaActualizar 
          }),
        });

        if (respuestaUpdate.ok) {
          const resultado = await respuestaUpdate.json();
          console.log('Ô£à Actualizaci├│n en BD exitosa:', resultado);
          
          // Actualizar valores en DOM y memoria
          cuentasParaActualizar.forEach((cuentaData) => {
            // Buscar la fila en el DOM
            const fila = Array.from(obtenerFilasCuenta()).find((f) => {
              if (f.dataset.cuenta21 === cuentaData.numCta) return true;
              const cuentaVisibleFila = f.dataset.cuenta || f.dataset.cuentaVisible || "";
              return convertirCuenta21(cuentaVisibleFila) === cuentaData.numCta;
            });

            if (fila) {
              // Actualizar valores mensuales en el DOM
              MESES.forEach((mes) => {
                const valor = cuentaData.valores[mes] || 0;
                establecerValorCelda(fila, `budget-${mes}`, valor);
              });

              // Actualizar el almac├®n de valores en memoria
              const almacen = estadoModulo.valoresPorCuenta.get(cuentaData.numCta) || {};
              MESES.forEach((mes) => {
                almacen[`budget-${mes}`] = cuentaData.valores[mes] || 0;
              });

              // Recalcular totales para esta cuenta
              let totalAnual = 0;
              MESES.forEach((mes) => {
                totalAnual += almacen[`budget-${mes}`] || 0;
              });
              almacen['budget-annual'] = totalAnual;

              const mesAcumuladoIndex = obtenerIndiceMesAcumulado();
              let totalAcumulado = 0;
              MESES.forEach((mes, idx) => {
                if (idx <= mesAcumuladoIndex) {
                  totalAcumulado += almacen[`budget-${mes}`] || 0;
                }
              });
              almacen['total-budget'] = totalAcumulado;

              establecerValorCelda(fila, 'budget-annual', totalAnual);
              establecerValorCelda(fila, 'total-budget', totalAcumulado);

              estadoModulo.valoresPorCuenta.set(cuentaData.numCta, almacen);

              console.log(
                `Ô£à Cuenta ${cuentaData.cuentaVisible} actualizada: ${cuentaData.config.capitulo} ${cuentaData.config.tipo.toUpperCase()} - Enero: ${cuentaData.valores.ene}`
              );
            } else {
              console.log(`Ôä╣´©Å Cuenta ${cuentaData.cuentaVisible} no est├í visible en Presupuestos (solo nivel mayor).`);
            }
          });

          // Recalcular todas las sumas de la tabla
          console.log('­ƒöä Recalculando sumas de toda la tabla...');
          recalcularSumas();
          console.log('Ô£à Consolidaci├│n completada exitosamente');
          
        } else {
          console.error('ÔØî Error al actualizar:', await respuestaUpdate.text());
        }
      } catch (errorUpdate) {
        console.error('ÔØî Error al actualizar cuentas:', errorUpdate);
      } finally {
        estaInicializandoCuentas = false;
      }
    } else {
      console.log('ÔÜá´©Å No hay cuentas para actualizar o ya est├í en proceso');
      estaInicializandoCuentas = false;
    }
  };

  const contarSaldos = (registros = []) => {
    const mapa = new Map(
      registros.map((registro) => [registro.cuenta, registro])
    );
    estadoModulo.valoresPorCuenta = new Map();
    const numeroSeguro = (valor) => {
      const n = Number(valor);
      return Number.isFinite(n) ? n : 0;
    };
    // Obtener mes actual (0-11, donde 0=enero, 11=diciembre)
    const mesActualIndex = obtenerIndicePeriodoActual();
    const mesActualClave = mesActualIndex >= 0 ? MESES[mesActualIndex] : null; // ene, feb, mar, etc.
    const mesAcumuladoIndex = obtenerIndiceMesAcumulado();

    obtenerFilasCuenta().forEach((fila) => {
      const cuenta = fila.dataset.cuenta21 || "";
      const registro = mapa.get(cuenta);
      let totalPresupuestoAcumulado = 0;
      let totalPresupuestoAnual = 0;
      let totalRealAcumulado = 0;
      const almacen = {};

      MESES.forEach((mes, index) => {
        const presupuesto = numeroSeguro(registro?.presupuesto?.[mes]);
        const real = numeroSeguro(registro?.real?.[mes]);

        totalPresupuestoAnual += presupuesto;
        if (index <= mesAcumuladoIndex) {
          totalPresupuestoAcumulado += presupuesto;
          totalRealAcumulado += real;
        }

        establecerValorCelda(fila, `budget-${mes}`, presupuesto);
        establecerValorCelda(fila, `real-${mes}`, real);
        almacen[`budget-${mes}`] = presupuesto;
        almacen[`real-${mes}`] = real;
      });

      // Real del mes actual (para Gastos Corporativos: "Mensual")
      const realMesActual = mesActualClave
        ? numeroSeguro(registro?.real?.[mesActualClave])
        : 0;

      // total-budget y total-real: acumulados desde enero hasta mes actual
      establecerValorCelda(fila, "total-budget", totalPresupuestoAcumulado);
      establecerValorCelda(fila, "total-real", totalRealAcumulado);
      // budget-annual: suma del presupuesto anual (todas las columnas budget-[mes])
      establecerValorCelda(fila, "budget-annual", totalPresupuestoAnual);
      // budget-monthly: real del mes actual (Gastos Corporativos)
      establecerValorCelda(fila, "budget-monthly", realMesActual);

      almacen["total-budget"] = totalPresupuestoAcumulado;
      almacen["budget-annual"] = totalPresupuestoAnual;
      almacen["budget-monthly"] = realMesActual;
      almacen["total-real"] = totalRealAcumulado;
      estadoModulo.valoresPorCuenta.set(cuenta, almacen);
    });
    estadoModulo.mesActual = mesActualClave || "";
    estadoModulo.mesActualIndex = mesActualIndex;
    recalcularSumas();
    estadoModulo.hayCambios = false;
    estadoModulo.editSnapshot = null;

    // Aplicar datos autom├íticos de SUMMARY si corresponde
    const anio = obtenerAnioSeleccionado();
    if (Number.isInteger(anio)) {
      aplicarDatosAutomaticos(anio).catch((err) => {
        console.warn('Error aplicando datos autom├íticos:', err);
      });
    }
  };

  const obtenerCuentasSolicitadas = () => {
    const filas = obtenerFilasCuenta();
    const conjunto = new Set();
    filas.forEach((fila) => {
      const cuenta = (fila.dataset.cuenta21 || "").trim();
      if (cuenta) {
        conjunto.add(cuenta);
      }
    });
    return Array.from(conjunto);
  };

  const clonarMapaValores = (mapa) =>
    new Map(
      Array.from(mapa.entries()).map(([clave, valores]) => [
        clave,
        { ...(valores || {}) },
      ])
    );

  const tomarSnapshotEdicion = () => ({
    valores: clonarMapaValores(estadoModulo.valoresPorCuenta),
    nombres: new Map(estadoModulo.nombresPorCuenta),
  });

  const restablecerDesdeSnapshot = (snap) => {
    if (!snap) return;
    estadoModulo.valoresPorCuenta = clonarMapaValores(
      snap.valores || new Map()
    );
    estadoModulo.nombresPorCuenta = new Map(snap.nombres || []);
    obtenerFilasCuenta().forEach((fila) => {
      const cuenta = fila.dataset.cuenta21 || "";
      const nombre = estadoModulo.nombresPorCuenta.get(cuenta) || "";
      if (nombre) {
        actualizarNombreFila(fila, nombre);
      }
      const valores = estadoModulo.valoresPorCuenta.get(cuenta) || {};
      MESES.forEach((mes) => {
        establecerValorCelda(
          fila,
          `budget-${mes}`,
          valores[`budget-${mes}`] ?? 0
        );
        establecerValorCelda(fila, `real-${mes}`, valores[`real-${mes}`] ?? 0);
      });
      establecerValorCelda(fila, "total-budget", valores["total-budget"] ?? 0);
      establecerValorCelda(fila, "total-real", valores["total-real"] ?? 0);
      establecerValorCelda(
        fila,
        "budget-annual",
        valores["budget-annual"] ?? 0
      );
      establecerValorCelda(
        fila,
        "budget-monthly",
        valores["budget-monthly"] ?? 0
      );
    });
    recalcularSumas();
  };

  const obtenerCambiosPendientes = () => {
    if (!estadoModulo.editSnapshot) {
      return { presupuesto: [], nombres: [] };
    }
    const cambiosPresupuesto = [];
    const baseValores = estadoModulo.editSnapshot.valores || new Map();

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

    // NO enviar cambios de nombres - son solo visuales
    return { presupuesto: cambiosPresupuesto, nombres: [] };
  };

  // CR├ìTICO: Flag para evitar recursi├│n infinita en notificaciones
  let notificandoCambios = false;

  const notificarCambios = () => {
    // Evitar recursi├│n infinita
    if (notificandoCambios) {
      console.warn("ÔÜá´©Å notificarCambios: evitando recursi├│n");
      return;
    }
    notificandoCambios = true;

    try {
      const cambios = obtenerCambiosPendientes();
      // NO persistir autom├íticamente - solo notificar que hay cambios pendientes
      // El usuario debe guardar expl├¡citamente usando el bot├│n de guardar borrador
      const detalle = {
        ...cambios,
        hayCambios: estadoModulo.hayCambios,
        layoutModificado: estadoModulo.layoutModificado || false,
        borradorGuardado: false, // Ya no se guarda autom├íticamente
      };
      window.dispatchEvent(
        new CustomEvent("modulo-planeacion:presupuesto-editado", {
          detail: detalle,
        })
      );
    } finally {
      // Liberar flag con un peque├▒o delay para evitar llamadas inmediatas
      setTimeout(() => {
        notificandoCambios = false;
      }, 50);
    }
  };

  const indicesMesReal = () =>
    Object.entries(estadoModulo.columnas || {})
      .filter(([clave]) => clave.startsWith("real-"))
      .map(([, idx]) => idx);

  const ocultarColumnasReal = (ocultar) => {
    if (!estadoModulo.tabla) return;
    const indices = indicesMesReal();
    if (!indices.length) return;
    const filas = Array.from(estadoModulo.tabla.querySelectorAll("tr"));
    filas.forEach((fila) => {
      indices.forEach((idx) => {
        const celda = fila.cells[idx];
        if (celda) {
          celda.style.display = ocultar ? "none" : "";
        }
      });
    });
  };

  const aplicarFiltroColumnasPorPeriodo = () => {
    if (!estadoModulo.tabla) return;

    const moduloActual = (
      estadoModulo.moduloClave ||
      estadoModulo.moduloId ||
      ""
    ).toLowerCase();
    if (!MODULOS_FILTRA_MESES_REALES.has(moduloActual)) {
      return;
    }

    // USAR estadoModulo.anio DIRECTAMENTE para evitar lecturas err├│neas del DOM
    const anioState = Number(estadoModulo.anio);
    const anioActual = new Date().getFullYear();

    // Si no tenemos a├▒o en estado, intentamos el select, si falla, null.
    // IMPORTANTE: NO default a anioActual aqu├¡ para la l├│gica de "mostrar todo".
    let anioEvaluado = Number.isInteger(anioState) ? anioState : null;
    if (anioEvaluado === null) {
      const selectVal = obtenerAnioBaseSeleccionado(); // Fallback
      if (Number.isInteger(selectVal)) anioEvaluado = selectVal;
    }

    // Si aun as├¡ es null, asumimos a├▒o actual para seguridad (ocultar futuro)
    if (anioEvaluado === null) anioEvaluado = anioActual;

    console.debug("[planeacion] filtro columnas", {
      moduloActual,
      anioEvaluado,
      anioActual,
    });

    const esAnioPasado = anioEvaluado < anioActual;
    const esAnioFuturo = anioEvaluado > anioActual;
    const periodoVisible = !esAnioPasado && !esAnioFuturo
      ? obtenerPeriodoVisible(anioEvaluado)
      : null;

    const filas = Array.from(estadoModulo.tabla.querySelectorAll("tr"));
    const headersReales = Array.from(
      estadoModulo.tabla.tHead?.querySelectorAll("th.month-real") || []
    );

    headersReales.forEach((th) => {
      const mesClave = th.dataset.mes || "";
      const mesNumero = CLAVE_MES_A_PERIODO.get(mesClave) || null;
      const idx = th.cellIndex;

      let debeOcultar = false;
      if (esAnioPasado) {
        // Años anteriores: mostrar todos los month-real.
        debeOcultar = false;
      } else if (esAnioFuturo) {
        // Años futuros: ocultar todos los month-real.
        debeOcultar = true;
      } else {
        // Año actual: mostrar SOLO el mes anterior al actual.
        if (!mesNumero || !periodoVisible || periodoVisible < 1) {
          debeOcultar = true;
        } else {
          debeOcultar = mesNumero !== periodoVisible;
        }
      }

      th.style.display = debeOcultar ? "none" : "";
      filas.forEach((fila) => {
        const celda = fila.cells[idx];
        if (celda) {
          celda.style.display = debeOcultar ? "none" : "";
        }
      });
    });
  };

  const aplicarNombresTabla = (mapaNombres = new Map()) => {
    if (!mapaNombres.size) return;
    obtenerFilasCuenta().forEach((fila) => {
      const cuenta = fila.dataset.cuenta21 || "";
      const nombre = mapaNombres.get(cuenta);
      if (nombre) {
        actualizarNombreFila(fila, nombre);
      }
    });
  };

  const cargarNombresCuentas = async ({ empresaId, anio, cuentas } = {}) => {
    const lista = Array.isArray(cuentas) ? Array.from(new Set(cuentas)) : [];
    if (!empresaId || !Number.isInteger(anio) || !lista.length)
      return new Map();
    try {
      const params = new URLSearchParams({
        empresaId,
        anio,
        cuentas: lista.join(","),
      });
      const resp = await fetch(
        `${API_BASE}/saldos/cuentas?${params.toString()}`,
        {
          headers: Sesion.headersAutenticacion(),
        }
      );
      const datos = await resp.json();
      if (!resp.ok)
        throw new Error(datos.mensaje || "No fue posible obtener nombres.");
      const mapa = new Map();
      (datos.cuentas || []).forEach((registro) => {
        const clave = convertirCuenta21(
          registro.cuenta || registro.numCta || registro.NUM_CTA || ""
        );
        const nombre = (
          registro.nombre ||
          registro.nombreCuenta ||
          registro.NOMBRE ||
          ""
        ).trim();
        if (clave && nombre) {
          mapa.set(clave, nombre);
          estadoModulo.nombresPorCuenta.set(clave, nombre);
        }
      });
      aplicarNombresTabla(mapa);
      return mapa;
    } catch (error) {
      console.warn("No fue posible cargar nombres de cuentas", error);
      return new Map();
    }
  };

  const cargarCuentasPresupuestos = async ({ anio } = {}) => {
    let anioConsulta = Number.isInteger(anio) ? anio : new Date().getFullYear();

    const params = new URLSearchParams({
      anio: anioConsulta,
    });
    const normalizarNumero = (valor) => {
      const numerico = Number(valor);
      return Number.isFinite(numerico) ? numerico : 0;
    };
    const esAcreedora = (naturaleza) =>
      ["A", "C"].includes((naturaleza || "").toString().trim().toUpperCase());

    try {
      const resp = await fetch(
        `${API_BASE}/presupuestos?${params.toString()}`,
        {
          headers: Sesion.headersAutenticacion(),
        }
      );
      const datos = await resp.json();

      // Si el a├▒o solicitado no tiene datos (404), intentar con el a├▒o anterior
      if (!resp.ok) {
        if (resp.status === 404 && anioConsulta === new Date().getFullYear()) {
          console.log(
            `ÔÜá´©Å No hay datos de presupuestos para ${anioConsulta}, intentando con ${
              anioConsulta - 1
            }`
          );
          const paramsAnterior = new URLSearchParams({
            anio: anioConsulta - 1,
          });
          const respAnterior = await fetch(
            `${API_BASE}/presupuestos?${paramsAnterior.toString()}`,
            {
              headers: Sesion.headersAutenticacion(),
            }
          );
          const datosAnterior = await respAnterior.json();
          if (!respAnterior.ok) {
            throw new Error(
              datosAnterior.mensaje ||
                "No fue posible obtener las cuentas de presupuestos."
            );
          }
          const cuentasAnterior = Array.isArray(datosAnterior.cuentas)
            ? datosAnterior.cuentas
            : [];
          return procesarCuentasPresupuesto(cuentasAnterior);
        }
        throw new Error(
          datos.mensaje || "No fue posible obtener las cuentas de presupuestos."
        );
      }
      const cuentas = Array.isArray(datos.cuentas) ? datos.cuentas : [];
      return procesarCuentasPresupuesto(cuentas);
    } catch (error) {
      console.warn("Error al cargar cuentas de presupuestos:", error);
      return [];
    }
  };

  const procesarCuentasPresupuesto = (cuentas) => {
    const normalizarNumero = (valor) => {
      const numerico = Number(valor);
      return Number.isFinite(numerico) ? numerico : 0;
    };
    const esAcreedora = (naturaleza) =>
      ["A", "C"].includes((naturaleza || "").toString().trim().toUpperCase());

    return cuentas
      .map((cuenta) => {
        const naturaleza = (cuenta.naturaleza || cuenta.NATURALEZA || "")
          .toString()
          .trim()
          .toUpperCase();
        const cuentaVisible =
          cuenta.numCta ||
          cuenta.num_cta ||
          cuenta.CUENTA ||
          cuenta.cuenta ||
          "";
        const cuenta21 = convertirCuenta21(cuentaVisible);
        if (!cuenta21) return null;
        const presupuesto = {};
        const real = {};
        MESES.forEach((mes, idxMes) => {
          const sufijoMes = String(idxMes + 1).padStart(2, "0");
          const presupuestoCampo =
            cuenta[`PRESUP${sufijoMes}`] ??
            cuenta[`presup${sufijoMes}`] ??
            (cuenta.presupuesto && cuenta.presupuesto[mes] != null
              ? cuenta.presupuesto[mes]
              : undefined) ??
            cuenta[`presupuesto_${mes}`] ??
            cuenta[`presupuesto${mes}`] ??
            cuenta[mes];
          const realCampo =
            (cuenta.contabilizacion && cuenta.contabilizacion[mes] != null
              ? cuenta.contabilizacion[mes]
              : undefined) ??
            (cuenta.real && cuenta.real[mes] != null
              ? cuenta.real[mes]
              : undefined) ??
            cuenta[`real_${mes}`] ??
            cuenta[`real${mes}`] ??
            cuenta[`REAL_${mes}`] ??
            cuenta[`REAL${mes}`];
          // Presupuesto: usar el valor tal cual viene de la tabla PRESUPxx (sin factor).
          const valorPresupuesto = normalizarNumero(presupuestoCampo);
          const tieneReal = realCampo != null && realCampo !== undefined;
          // Real: usar la contabilizaci├│n tal cual regresa el backend (YTD desde SALDOS).
          const valorReal = normalizarNumero(tieneReal ? realCampo : 0);
          presupuesto[mes] = valorPresupuesto;
          real[mes] = valorReal;
        });
        const nombre =
          cuenta.descripcion || cuenta.nombre || cuenta.DESCRIPCION || "";
        if (esNombreCuentaPresupuestoOculto(nombre)) return null;
        return {
          cuenta21,
          cuentaVisible,
          nombre,
          presupuesto,
          real,
        };
      })
      .filter(Boolean);
  };

  const esNombreCuentaPresupuestoOculto = (nombre) =>
    normalizarTexto(nombre) === "DISPONIBLE";

  const esCuentaPresupuestoValida = (valorCuenta) => {
    const canonica = convertirCuenta21(valorCuenta || "");
    const prefijo = Number.parseInt((canonica || "").slice(0, 3), 10);
    const nivel = (canonica || "").slice(-1);
    const esNivel1 = nivel === "1";
    return (
      Number.isFinite(prefijo) &&
      prefijo >= 400 &&
      prefijo <= 950 &&
      esNivel1
    );
  };

  const obtenerSeccionPresupuesto = (valorCuenta) => {
    const canonica = convertirCuenta21(valorCuenta || "");
    const prefijo = Number.parseInt((canonica || "").slice(0, 3), 10);
    if (!Number.isFinite(prefijo)) return "GASTOS";
    return prefijo <= 450 ? "INGRESOS" : "GASTOS";
  };

  const cuentaVisibleDesdeLarga = (cuentaLarga) => {
    const base = normalizarCuentaBase(cuentaLarga).padEnd(21, "0");
    const visible = base.slice(0, 11);
    return `${visible.slice(0, 3)}-${visible.slice(3, 6)}-${visible.slice(
      6,
      9
    )}-${visible.slice(9, 11)}`;
  };

  const obtenerAnioSugerencias = (anio) => {
    if (Number.isInteger(anio)) return anio;
    const anioSelect = obtenerAnioSeleccionado();
    if (Number.isInteger(anioSelect)) return anioSelect;
    if (Number.isInteger(estadoModulo.anio)) return estadoModulo.anio;
    return null;
  };

  const sincronizarCuentasDisponibles = (anio, conjunto) => {
    if (!Number.isInteger(anio)) return;
    const lista = Array.from(conjunto);
    estadoModulo.cuentasDisponiblesPorAnio.set(anio, lista);
    if (anio === estadoModulo.anio) {
      estadoModulo.cuentasDisponibles = lista;
    }
  };

  const obtenerCuentasDisponiblesPorAnio = (anio) => {
    if (!Number.isInteger(anio)) {
      return estadoModulo.cuentasDisponibles || [];
    }
    const porAnio = estadoModulo.cuentasDisponiblesPorAnio.get(anio);
    if (porAnio?.length) return porAnio;
    return estadoModulo.cuentasDisponibles || [];
  };

  const unificarCuentasDisponibles = (lista = [], opciones = {}) => {
    const anioObjetivo = obtenerAnioSugerencias(opciones.anio);
    const usarReset = Boolean(opciones.reset);
    const baseSet = new Set();
    if (Number.isInteger(anioObjetivo)) {
      const prev = estadoModulo.cuentasDisponiblesPorAnio.get(anioObjetivo);
      prev?.forEach((c) => baseSet.add(c));
    } else {
      (estadoModulo.cuentasDisponibles || []).forEach((c) => baseSet.add(c));
    }
    const previo = usarReset ? new Set() : baseSet;
    lista.forEach((cuenta) => {
      const limpia = (cuenta || "").toString().trim();
      const canonica = convertirCuenta21(limpia);
      if (canonica) {
        if (
          normalizarModuloClave(estadoModulo.moduloClave) === "presupuestos" &&
          !esCuentaPresupuestoValida(canonica)
        ) {
          return;
        }
        previo.add(canonica);
      }
    });
    if (Number.isInteger(anioObjetivo)) {
      sincronizarCuentasDisponibles(anioObjetivo, previo);
    }
    estadoModulo.cuentasDisponibles = Array.from(previo);
    return estadoModulo.cuentasDisponibles;
  };

  const poblarSugerenciasDesdeAnio = async (anio) => {
    if (!Number.isInteger(anio)) {
      return;
    }
    const registros = await cargarCuentasPresupuestos({ anio });
    const cuentas = registros
      .map((item) =>
        convertirCuenta21(
          item.cuentaVisible || item.cuenta21 || item.cuenta || ""
        )
      )
      .filter(Boolean);
    // Reiniciar con las de presupuestos del a├▒o
    unificarCuentasDisponibles(cuentas, { anio, reset: true });
    // Agregar cat├ílogo completo (todos los niveles) del mismo a├▒o (con cache y sin spamear el backend)
    cargarCatalogoCompleto({ anio })
      .then((lista) => {
        if (Array.isArray(lista) && lista.length) {
          unificarCuentasDisponibles(lista, { anio });
        }
      })
      .catch(() => {
        // silencio: ya se marca fallido en cache
      });
  };

  const cargarCatalogoCompleto = ({ anio }) => {
    if (!Number.isInteger(anio)) return Promise.resolve([]);
    if (estadoModulo.catalogoPromesas.has(anio)) {
      return estadoModulo.catalogoPromesas.get(anio);
    }
    if (estadoModulo.catalogoFallido.has(anio)) {
      return Promise.resolve([]);
    }
    const rutas = [
      `${API_BASE}/cuentas/catalogo`,
      `${API_BASE}/planeacion/catalogo`,
      `${API_BASE}/saldos/catalogo`,
    ];
    const params = new URLSearchParams({ anio });
    const empresaActiva =
      typeof Sesion?.obtenerEmpresaActiva === "function"
        ? Sesion.obtenerEmpresaActiva()
        : null;
    if (empresaActiva?.id) {
      params.set("empresaId", empresaActiva.id);
    }
    const promesa = (async () => {
      const acumuladas = new Set();
      for (const ruta of rutas) {
        try {
          const resp = await fetch(`${ruta}?${params.toString()}`, {
            headers: Sesion.headersAutenticacion(),
          });
          const datos = await resp.json();
          if (!resp.ok) {
            continue;
          }
          const cuentas = Array.isArray(datos.cuentas)
            ? datos.cuentas
            : Array.isArray(datos)
            ? datos
            : [];
          cuentas.forEach((item) => {
            const canonica = convertirCuenta21(
              item.numCta ||
                item.NUM_CTA ||
                item.cuenta ||
                item.CUENTA ||
                item.num_cta ||
                ""
            );
            if (canonica) {
              acumuladas.add(canonica);
            }
          });
        } catch (error) {
          // probar siguiente ruta
        }
      }
      const lista = Array.from(acumuladas);
      if (!lista.length) {
        estadoModulo.catalogoFallido.add(anio);
      }
      return lista;
    })();
    estadoModulo.catalogoPromesas.set(anio, promesa);
    return promesa;
  };

  const compilarCatalogoGlobal = (registros = []) => {
    const anioActual = obtenerAnioSeleccionado() || estadoModulo.anio;
    const todas = (Array.isArray(registros) ? registros : [])
      .map((registro) => {
        if (!registro?.cuenta) return null;
        const cuentaCorregida = corregirCuentaLegible(
          registro.cuenta,
          registro
        );
        return convertirCuenta21(cuentaCorregida);
      })
      .filter(Boolean);
    if (todas.length) {
      unificarCuentasDisponibles(todas, { anio: anioActual });
    }
  };

  const destruirTooltips = () => {
    estadoModulo.tooltips.forEach((tooltip) => {
      if (typeof tooltip?.dispose === "function") {
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
    const celdas = estadoModulo.tabla.querySelectorAll(
      'tbody tr.fila-cuenta td[data-bs-toggle="tooltip"]'
    );
    celdas.forEach((celda) => {
      const tooltip = window.bootstrap.Tooltip.getOrCreateInstance(celda, {
        placement: "top",
        trigger: "hover",
        container: "body",
      });
      estadoModulo.tooltips.push(tooltip);
    });
  };

  const solicitarDatos = async () => {
    const moduloClave =
      estadoModulo.moduloClave || normalizarModuloClave(estadoModulo.moduloId);
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
    poblarSugerenciasDesdeAnio(anio);
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
      cuentas,
    };
    // eslint-disable-next-line no-console
    console.debug("[planeacion] payload", payload);
    estadoModulo.ultimaSolicitud += 1;
    const folio = estadoModulo.ultimaSolicitud;
    try {
      const respuesta = await fetch(`${API_BASE}/planeacion/cuentas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...Sesion.headersAutenticacion(),
        },
        body: JSON.stringify(payload),
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        const detalles = Array.isArray(datos.detalles)
          ? ` (${datos.detalles.join("; ")})`
          : "";
        throw new Error(
          (datos.mensaje || "No fue posible obtener la informaci├│n contable.") +
            detalles
        );
      }
      if (folio !== estadoModulo.ultimaSolicitud) {
        return;
      }
      contarSaldos(datos.cuentas || []);
    } catch (error) {
      console.error("Error al cargar datos de planeaci├│n", error);
      if (folio === estadoModulo.ultimaSolicitud) {
        limpiarValores();
      }
    }
  };

  const obtenerSumasConfig = () => null;

  const limpiarSeparadoresNomina = (texto = "") =>
    texto
      .replace(/,\s*,+/g, ", ")
      .replace(/\s+,/g, ", ")
      .replace(/,\s+/g, ", ")
      .replace(/\s{2,}/g, " ")
      .replace(/^\s+|\s+$/g, "")
      .replace(/^,\s*/, "")
      .replace(/,\s*$/, "");

  const limpiarEtiquetaNomina = (texto = "") => {
    const base = (texto || "").toString();
    const partes = base
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    const prohibidas = [/BONO\s+ANUAL\s+VPE/i, /CORPORATIVO/i];
    const filtradas = partes.filter(
      (p) => !prohibidas.some((rx) => rx.test(p))
    );
    const reconstruido =
      filtradas.length > 0
        ? filtradas.join(", ")
        : base.replace(/BONO\s+ANUAL\s+VPE/gi, "").replace(/CORPORATIVO/gi, "");
    const normalizado = limpiarSeparadoresNomina(reconstruido);
    return normalizado || "Nomina";
  };

  const normalizarRegistrosNomina = (registros = []) =>
    registros.map((item) => {
      const seccionOriginal = item.seccion || "SIN SECCION";
      const seccionLimpia = limpiarEtiquetaNomina(seccionOriginal);
      return {
        ...item,
        seccionOriginal,
        seccion: seccionLimpia,
        nombre: seccionLimpia,
      };
    });

  const limpiarSumasNomina = (sumas, seccionLimpia) => {
    if (!sumas) return sumas;
    const limpiarCampo = (valor, fallback = "") => {
      if (valor == null) return valor;
      const limpio = limpiarEtiquetaNomina(valor);
      return limpiarSeparadoresNomina(limpio || fallback);
    };
    const copia = { ...sumas };
    if ("sumRow" in copia) {
      copia.sumRow = limpiarCampo(
        copia.sumRow,
        seccionLimpia ? `Suma ${seccionLimpia}` : ""
      );
    }
    if ("sumRowSumavarios" in copia) {
      copia.sumRowSumavarios = limpiarCampo(copia.sumRowSumavarios);
    }
    if ("sumRowSumavarios2" in copia) {
      copia.sumRowSumavarios2 = limpiarCampo(copia.sumRowSumavarios2);
    }
    if (Array.isArray(copia.resultRows)) {
      copia.resultRows = copia.resultRows
        .map((texto) => limpiarCampo(texto))
        .filter(Boolean);
    } else if (copia.resultRow) {
      copia.resultRows = [limpiarCampo(copia.resultRow)].filter(Boolean);
      delete copia.resultRow;
    }
    return copia;
  };

  const resolverPlaceholdersPorFila = (placeholdersPorFila, cuerpo) => {
    if (Number.isInteger(placeholdersPorFila) && placeholdersPorFila >= 0) {
      return placeholdersPorFila;
    }
    if (
      Number.isInteger(estadoModulo.placeholdersPorFila) &&
      estadoModulo.placeholdersPorFila >= 0
    ) {
      return estadoModulo.placeholdersPorFila;
    }
    const tabla = cuerpo?.closest
      ? cuerpo.closest("table")
      : estadoModulo.tabla;
    const columnas = contarColumnas(tabla);
    return Math.max(0, columnas - 2);
  };

  /**
   * Agrega una fila de resumen/suma al cuerpo de la tabla
   *
   * Estas filas especiales muestran totales calculados y pueden ser de varios tipos:
   * - sum-row: Suma de todas las cuentas de una secci├│n
   * - sum-row-sumavarios: Suma de varios sum-rows agrupados
   * - result-row: Resultado final del m├│dulo
   *
   * ESTRUCTURA DE FILA:
   * | (vac├¡o) | Texto descriptivo | val1 | val2 | ... | val12 |
   *
   * La primera columna (cuenta) est├í vac├¡a porque las filas de suma
   * no representan una cuenta espec├¡fica sino un total.
   *
   * Los valores se inicializan en "-" y luego se actualizan con
   * recalcularSumas() que calcula los totales reales.
   *
   * @param {Object} params - Par├ímetros
   * @param {string} params.texto - Texto descriptivo (ej: "Suma INGRESOS")
   * @param {string} params.clase - Clase CSS (sum-row, sum-row-sumavarios, result-row)
   * @param {HTMLElement} params.cuerpo - Elemento tbody donde insertar la fila
   * @param {number} params.placeholdersPorFila - Cantidad de columnas de valores (12 meses)
   * @returns {HTMLTableRowElement|null} Fila creada o null si faltan par├ímetros
   */
  const agregarFilaResumen = ({
    texto,
    clase,
    cuerpo,
    placeholdersPorFila,
  }) => {
    if (!texto || !cuerpo) {
      return null;
    }
    const placeholders = resolverPlaceholdersPorFila(
      placeholdersPorFila,
      cuerpo
    );
    const fila = document.createElement("tr");
    fila.className = clase;
    const celdaCuenta = document.createElement("td");
    celdaCuenta.textContent = "";
    fila.appendChild(celdaCuenta);
    const celdaDescripcion = document.createElement("td");
    celdaDescripcion.textContent = texto;
    fila.appendChild(celdaDescripcion);
    for (let i = 0; i < placeholders; i += 1) {
      const celda = document.createElement("td");
      celda.className = "budget-value";
      celda.textContent = "-";
      fila.appendChild(celda);
    }
    cuerpo.appendChild(fila);
    return fila;
  };

  /**
   * Renderiza las secciones y filas de cuentas en el tbody de la tabla
   *
   * Esta funci├│n toma la lista de cuentas filtradas por capitulo y las
   * organiza visualmente en secciones con sus respectivas filas.
   *
   * PROCESO:
   * 1. Agrupa registros por secci├│n (ej: "INGRESOS", "GASTOS", etc.)
   * 2. Para cada secci├│n:
   *    a. Crea fila de encabezado (section-header-row) con nombre de secci├│n
   *    b. Crea filas de cuenta (fila-cuenta) con columnas: cuenta | nombre | valores
   *    c. Agrega fila sum-row si la configuraci├│n de sumas lo indica
   * 3. Construye metadata de sumas (sumavarios, result-row)
   * 4. Retorna informaci├│n para que renderizarTabla agregue las filas especiales
   *
   * ESTRUCTURA DE FILA DE CUENTA:
   * | Cuenta (ej: 4101-010) | Nombre (ej: VENTAS) | ene | feb | ... | dic |
   *
   * METADATA DE SUMAS:
   * - sumRowTexto: etiqueta normalizada del sum-row (ej: "suma ingresos")
   * - sumRowSumavariosTexto: etiqueta del sumavarios al que pertenece
   * - resultRowTexto: etiqueta del result-row final
   *
   * @param {Object} params - Par├ímetros de renderizado
   * @param {Array} params.registros - Array de objetos {cuenta, nombre, seccion, capitulo}
   * @param {HTMLElement} params.cuerpo - Elemento tbody donde insertar filas
   * @param {number} params.placeholdersPorFila - Cantidad de columnas de valores (12 meses normalmente)
   * @param {string} params.sheetName - Nombre de la hoja de configuraci├│n
   * @param {string} params.capitulo - Nombre del capitulo/empresa
   * @param {Map} params.sumasPersonalizadas - Configuraci├│n personalizada de sumas (desde layout guardado)
   * @param {string} params.resultadoForzado - Texto forzado para result-row
   * @param {boolean} params.mostrarCuentaVisible - Si true, muestra cuenta en formato visible (4 d├¡gitos)
   * @returns {Object} Objeto con resultadoFilas, sumasSecciones, sumavarios, faltantesNombre
   */
  const renderizarSecciones = ({
    registros,
    cuerpo,
    placeholdersPorFila,
    sheetName,
    capitulo,
    sumasPersonalizadas,
    resultadoForzado,
    mostrarCuentaVisible = false,
    moduloClave,
  }) => {
    const moduloNormalizado = normalizarModuloClave(moduloClave);
    const registrosBase = Array.isArray(registros) ? registros : [];
    const placeholders = resolverPlaceholdersPorFila(
      placeholdersPorFila,
      cuerpo
    );
    const registrosProcesados =
      moduloNormalizado === "nomina"
        ? normalizarRegistrosNomina(registrosBase)
        : registrosBase;
    const secciones = new Map();
    const seccionOriginalPorClave = new Map();
    const faltantesNombre = new Set();
    const moduloEsGastosGenerales = moduloNormalizado === "gastosgenerales";
    const esModuloNomina = moduloNormalizado === "nomina";
    const esModuloResumen = moduloNormalizado === "resumen";
    registrosProcesados.forEach((item) => {
      const clave = item.seccion || "SIN SECCION";
      if (esModuloResumen && /OPERATING RESULTS/i.test(clave)) {
        return;
      }
      if (!secciones.has(clave)) {
        secciones.set(clave, []);
      }
      secciones.get(clave).push(item);
      if (!seccionOriginalPorClave.has(clave)) {
        seccionOriginalPorClave.set(
          clave,
          item.seccionOriginal || item.seccion || "SIN SECCION"
        );
      }
    });

    const resultRows = new Map();
    const sumasSecciones = [];
    const sumavariosData = new Map();
    const forcedResultTexto = (resultadoForzado || "").toString().trim();

    secciones.forEach((lista, seccion) => {
      const seccionOriginal = esModuloNomina
        ? seccionOriginalPorClave.get(seccion) || seccion
        : seccion;
      const claveSeccion = normalizarTexto(seccion || "SIN SECCION");
      const claveSeccionOriginal = normalizarTexto(
        seccionOriginal || "SIN SECCION"
      );
      const filasCuenta = [];
      let headerRow = null;
      if (seccion && seccion !== "SIN SECCION") {
        const filaSeccion = document.createElement("tr");
        filaSeccion.className = "section-header-row";
        filaSeccion.dataset.seccion = claveSeccion;
        filaSeccion.dataset.sectionName = seccion;
        const celda = document.createElement("td");
        celda.colSpan = placeholders + 2;
        celda.textContent = seccion;
        filaSeccion.appendChild(celda);
        cuerpo.appendChild(filaSeccion);
        headerRow = filaSeccion;
      }

      lista.forEach((item) => {
        const fila = document.createElement("tr");
        fila.className = "fila-cuenta account-row";
        const celdaCuenta = document.createElement("td");
        const cuenta21 = convertirCuenta21(item.cuenta || "");
        const cuentaTexto = mostrarCuentaVisible
          ? cuenta21
            ? cuentaVisibleDesdeLarga(cuenta21)
            : item.cuenta || "-"
          : item.cuenta || "-";
        celdaCuenta.textContent = cuentaTexto;
        if (cuenta21) {
          celdaCuenta.title = cuenta21;
          celdaCuenta.dataset.bsToggle = "tooltip";
          celdaCuenta.dataset.bsPlacement = "top";
        }
        fila.appendChild(celdaCuenta);
        const celdaNombre = document.createElement("td");
        const nombreMostrar =
          item.nombre || estadoModulo.nombresPorCuenta.get(cuenta21) || "";
        celdaNombre.textContent = nombreMostrar || "-";
        if (!nombreMostrar) {
          faltantesNombre.add(cuenta21);
        }
        fila.appendChild(celdaNombre);
        const factorCuenta = Number.isFinite(Number(item.factor))
          ? Number(item.factor)
          : 1;
        fila.dataset.operacionFactor = String(factorCuenta);
        fila.dataset.cuenta = item.cuenta || "";
        fila.dataset.cuenta21 = cuenta21;
        fila.dataset.seccion = claveSeccion;
        for (let i = 0; i < placeholders; i += 1) {
          const celda = document.createElement("td");
          celda.className = "budget-value";
          celda.textContent = "-";
          fila.appendChild(celda);
        }
        cuerpo.appendChild(fila);
        filasCuenta.push(fila);
      });

      const sumasBase =
        sumasPersonalizadas instanceof Map
          ? sumasPersonalizadas.get(claveSeccion) ||
            sumasPersonalizadas.get(claveSeccionOriginal)
          : null;
      let sumas =
        aplicarOperacionesPorModulo(moduloClave, seccion, sumasBase) ||
        sumasBase;
      sumas = limpiarSumasPorModulo(sumas, moduloClave) || sumasBase;
      if (esModuloResumen) {
        const limpiarOper = (texto) => (texto || "").trim();
        const isOperating =
          /OPERATING RESULTS/i.test(limpiarOper(sumas?.sumRow)) ||
          /OPERATING RESULTS/i.test(limpiarOper(sumas?.sumRowSumavarios)) ||
          /OPERATING RESULTS/i.test(limpiarOper(sumas?.sumRowSumavarios2)) ||
          (Array.isArray(sumas?.resultRows) &&
            sumas.resultRows.some((t) =>
              /OPERATING RESULTS/i.test(limpiarOper(t))
            ));
        if (isOperating) {
          return;
        }
      }
      if (esModuloNomina) {
        sumas = limpiarSumasNomina(sumas, seccion);
      }
      const sumRowCustom = (sumas?.sumRow || "").trim();
      let etiquetaSumRow = sumRowCustom || `Suma ${seccion}`;
      if (moduloNormalizado === "presupuestos" && !sumRowCustom) {
        if (/INGRESOS/i.test(seccion)) {
          etiquetaSumRow = "SUMA INGRESOS";
        } else if (/GASTOS/i.test(seccion)) {
          etiquetaSumRow = "SUMA GASTOS";
        }
      }
      const seccionNormalizada = normalizarTexto(seccion);
      const sumRowNormalizada = normalizarTexto(etiquetaSumRow);
      const requiereAjusteUtilidad =
        moduloEsGastosGenerales &&
        (seccionNormalizada.includes("GASTOS FINANCIEROS") ||
          sumRowNormalizada.includes("GASTOS FINANCIEROS"));
      const resultRowTexts = [];
      if (forcedResultTexto) {
        resultRowTexts.push(forcedResultTexto);
      }
      if (Array.isArray(sumas?.resultRows)) {
        sumas.resultRows.forEach((texto) => {
          const limpio = (texto || "").toString().trim();
          if (limpio) resultRowTexts.push(limpio);
        });
      } else if (sumas?.resultRow) {
        const texto = sumas.resultRow.toString().trim();
        if (texto) resultRowTexts.push(texto);
      }
      const factorManual = Number.isFinite(Number(sumas?.operacionFactor))
        ? Number(sumas.operacionFactor)
        : null;
      const heuristicasPermitidas =
        (window.PlaneacionConfig &&
          window.PlaneacionConfig.habilitarOperacionesAutomaticas === true) ||
        moduloNormalizado === "gastosgenerales" ||
        moduloNormalizado === "comites" ||
        moduloNormalizado === "comunicacion" ||
        moduloNormalizado === "eventos" ||
        moduloNormalizado === "direccion" ||
        moduloNormalizado === "finanzas" ||
        moduloNormalizado === "nomina" ||
        moduloNormalizado === "gtoscorporativos" ||
        moduloNormalizado === "membresia" ||
        moduloNormalizado === "rh" ||
        moduloNormalizado === "recursoshumanos" ||
        moduloNormalizado === "servmembresia" ||
        moduloNormalizado === "serviciosalamembresia" ||
        moduloNormalizado === "tic" ||
        moduloNormalizado === "vpe" ||
        moduloNormalizado === "presupuestos";
      const metaSeccion = {
        seccion: claveSeccion,
        tituloVisible: seccion,
        filasCuenta,
        sumRowTexto: etiquetaSumRow ? normalizarTexto(etiquetaSumRow) : "",
        sumRowSumavariosTexto: sumas?.sumRowSumavarios
          ? normalizarTexto(sumas.sumRowSumavarios)
          : "",
        sumRowSumavarios2Texto: sumas?.sumRowSumavarios2
          ? normalizarTexto(sumas.sumRowSumavarios2)
          : "",
        sumRowSumavariosLabel: sumas?.sumRowSumavarios || "",
        sumRowSumavarios2Label: sumas?.sumRowSumavarios2 || "",
        resultRowTexto: resultRowTexts[0]
          ? normalizarTexto(resultRowTexts[0])
          : "",
        resultRows: resultRowTexts,
        seccionOriginal,
        elementos: {
          header: headerRow,
        },
        // Factor definido manualmente en el layout (default: 1)
        factor: factorManual != null ? factorManual : 1,
        operacionFactor: factorManual != null ? factorManual : 1,
        restarUtilidadCambiaria: requiereAjusteUtilidad,
      };
      // Ajustes de operaciones conforme a info IMPORTANTE/logica operaciones.json
      const agregarResultRow = (meta, texto) => {
        if (!texto) return;
        const clave = normalizarTexto(texto);
        if (!clave) return;
        if (!meta.resultRows.some((t) => normalizarTexto(t) === clave)) {
          meta.resultRows.push(texto);
        }
        meta.resultRowTexto = meta.resultRowTexto || clave;
      };
      const capituloNormalizado = normalizarTexto(capitulo);
      const aplicarHeuristicas =
        heuristicasPermitidas &&
        (factorManual == null || moduloNormalizado === "direccion");
      const esCapituloMexico =
        capituloNormalizado === normalizarTexto("CIUDAD DE M├ëXICO") ||
        capituloNormalizado === normalizarTexto("CIUDAD DE MEXICO");
      if (aplicarHeuristicas) {
        switch (moduloNormalizado) {
          case "comites": {
            const seccionNormTexto = normalizarTexto(seccion || "");
            const esComisiones = /COMISIONES/i.test(seccionNormTexto);
            const esGastosAdmin = /GASTOS\s+ADMINISTRATIVOS/i.test(
              seccionNormTexto
            );
            const esGastoGenerico = /GASTOS/i.test(seccionNormTexto);
            const esIngreso = /INGRESOS/i.test(seccionNormTexto);
            const etiquetaResultado = "Resultado Comites";
            const etiquetaResultadoNorm = normalizarTexto(etiquetaResultado);
            let habilitarResultado = true;

            // Resultado Operativo Comites = Ingresos - Gastos (sumavarios ya lo agrupa)
            // Resultado Comites:
            // - CDMX: Resultado Operativo - Gastos Administrativos
            // - GDL/NE/NO: Resultado Operativo - Comisiones
            if (esComisiones) {
              metaSeccion.factor = -1;
              habilitarResultado = !esCapituloMexico;
              // No debe entrar en el sumavarios de Resultado Operativo
              metaSeccion.sumRowSumavariosTexto = "";
              metaSeccion.sumRowSumavarios2Texto = "";
              metaSeccion.sumRowSumavariosLabel = "";
              metaSeccion.sumRowSumavarios2Label = "";
            } else if (esGastosAdmin) {
              metaSeccion.factor = -1;
              habilitarResultado = esCapituloMexico;
              metaSeccion.sumRowSumavariosTexto = "";
              metaSeccion.sumRowSumavarios2Texto = "";
              metaSeccion.sumRowSumavariosLabel = "";
              metaSeccion.sumRowSumavarios2Label = "";
            } else if (esGastoGenerico) {
              metaSeccion.factor = -1; // gastos comites
            } else if (esIngreso) {
              metaSeccion.factor = 1;
            }

            if (habilitarResultado) {
              if (
                !metaSeccion.resultRows.some(
                  (t) => normalizarTexto(t) === etiquetaResultadoNorm
                )
              ) {
                metaSeccion.resultRows.push(etiquetaResultado);
              }
              metaSeccion.resultRowTexto = etiquetaResultadoNorm;
            } else {
              metaSeccion.resultRows = [];
              metaSeccion.resultRowTexto = "";
            }
            break;
          }
          case "gastosgenerales": {
            const totalLabel =
              capituloNormalizado === normalizarTexto("CIUDAD DE MEXICO")
                ? "Total GA CdMx"
                : "Total";
            const seccionNormTexto = normalizarTexto(seccion || "");
            const esOtrosIngresos = /OTROS\s+INGRESOS/i.test(seccionNormTexto);
            const esDepreciaciones = /DEPRECIACIONES/i.test(seccionNormTexto);
            const esGaCapitulo = /GA\s+CAPITULO/i.test(seccionNormTexto);
            const esGastosGenerales = /GASTOS\s+GENERALES/i.test(
              seccionNormTexto
            );
            const esGastosFinancieros = /GASTOS\s+FINANCIEROS/i.test(
              seccionNormTexto
            );
            if (esOtrosIngresos) {
              metaSeccion.factor = 1;
              if (!metaSeccion.sumRowSumavariosLabel) {
                metaSeccion.sumRowSumavariosLabel = "Otros Ingresos vs Gastos";
                metaSeccion.sumRowSumavariosTexto = normalizarTexto(
                  "Otros Ingresos vs Gastos"
                );
              }
            } else if (esGastosFinancieros) {
              // Total = Gastos Financieros - Gastos Generales - Depreciaciones - GA Cap├¡tulo
              metaSeccion.factor = 1;
              agregarResultRow(metaSeccion, totalLabel);
            } else if (esGastosGenerales || esDepreciaciones || esGaCapitulo) {
              metaSeccion.factor = -1;
              agregarResultRow(metaSeccion, totalLabel);
            }
            break;
          }
          case "eventos": {
            const seccionNorm = normalizarTexto(seccion || "");
            const esGastoAdmin = /GASTOS\s+ADMINISTRATIVOS/i.test(
              seccion || ""
            );
            const esCostosYGastos =
              /COSTOS\s+Y\s+GASTOS\s+EVENTOS/i.test(seccionNorm) ||
              /GASTOS\s+EVENTOS/i.test(seccionNorm);
            if (esGastoAdmin || esCostosYGastos) {
              metaSeccion.factor = -1;
              agregarResultRow(metaSeccion, "Resultado  Eventos");
              if (esGastoAdmin) {
                // Excluir de la suma operativa (solo debe restarse al resultado final)
                metaSeccion.sumRowSumavariosTexto = "";
                metaSeccion.sumRowSumavarios2Texto = "";
                metaSeccion.sumRowSumavariosLabel = "";
                metaSeccion.sumRowSumavarios2Label = "";
              }
            }
            break;
          }
          case "comunicacion": {
            const seccionNormTexto = normalizarTexto(seccion || "");
            const esGasto = /GASTOS/i.test(seccionNormTexto);
            if (esGasto) {
              metaSeccion.factor = -1;
            }
            const etiquetaResultado = "Resultado Operativo Comunicacion";
            const etiquetaResultadoNorm = normalizarTexto(etiquetaResultado);
            if (
              !metaSeccion.resultRows.some(
                (t) => normalizarTexto(t) === etiquetaResultadoNorm
              )
            ) {
              metaSeccion.resultRows.push(etiquetaResultado);
            }
            metaSeccion.resultRowTexto = etiquetaResultadoNorm;
            break;
          }
          case "finanzas": {
            const seccionNormTexto = normalizarTexto(seccion || "");
            if (/GASTOS/i.test(seccionNormTexto)) {
              metaSeccion.factor = -1;
            } else if (/INGRESOS/i.test(seccionNormTexto)) {
              metaSeccion.factor = 1;
            }
            const etiquetaResultado = "Resultado Admon y Finanzas";
            const etiquetaResultadoNorm = normalizarTexto(etiquetaResultado);
            if (
              !metaSeccion.resultRows.some(
                (t) => normalizarTexto(t) === etiquetaResultadoNorm
              )
            ) {
              metaSeccion.resultRows.push(etiquetaResultado);
            }
            metaSeccion.resultRowTexto = etiquetaResultadoNorm;
            break;
          }
          case "presupuestos": {
            const seccionNormTexto = normalizarTexto(seccion || "");
            if (/GASTOS/i.test(seccionNormTexto)) {
              metaSeccion.factor = -1;
            } else if (/INGRESOS/i.test(seccionNormTexto)) {
              metaSeccion.factor = 1;
            }
            const etiquetaResultado = "RESULTADOS PRESUPUESTOS";
            const etiquetaResultadoNorm = normalizarTexto(etiquetaResultado);
            if (
              !metaSeccion.resultRows.some(
                (t) => normalizarTexto(t) === etiquetaResultadoNorm
              )
            ) {
              metaSeccion.resultRows.push(etiquetaResultado);
            }
            metaSeccion.resultRowTexto = etiquetaResultadoNorm;
            break;
          }
          case "nomina": {
            const seccionNormTexto = normalizarTexto(seccion || "");
            if (/GASTOS|DEDUC|IMPUEST/i.test(seccionNormTexto)) {
              metaSeccion.factor = -1;
            } else if (/INGRESOS/i.test(seccionNormTexto)) {
              metaSeccion.factor = 1;
            }
            const etiquetaNomina = "SUMA NOMINA";
            const etiquetaNominaNorm = normalizarTexto(etiquetaNomina);
            if (!metaSeccion.sumRowSumavarios2Label) {
              metaSeccion.sumRowSumavarios2Label = etiquetaNomina;
              metaSeccion.sumRowSumavarios2Texto = etiquetaNominaNorm;
            }
            break;
          }
          case "gtoscorporativos": {
            const seccionNormTexto = normalizarTexto(seccion || "");
            if (/GASTOS/i.test(seccionNormTexto)) {
              metaSeccion.factor = -1;
            } else if (/INGRESOS/i.test(seccionNormTexto)) {
              metaSeccion.factor = 1;
            }
            break;
          }
          case "rh":
          case "recursoshumanos": {
            const seccionNormTexto = normalizarTexto(seccion || "");
            if (/GASTOS|DEDUC|IMPUEST|NOMINA/i.test(seccionNormTexto)) {
              metaSeccion.factor = -1;
            } else if (/INGRESOS/i.test(seccionNormTexto)) {
              metaSeccion.factor = 1;
            }
            break;
          }
          case "membresia": {
            if (/GASTOS\s+ADMIN/i.test(seccion || "")) {
              metaSeccion.factor = -1;
              agregarResultRow(metaSeccion, "Resultado  Membres├¡a");
              // Excluir de la suma operativa (solo debe restarse al resultado final)
              metaSeccion.sumRowSumavariosTexto = "";
              metaSeccion.sumRowSumavarios2Texto = "";
              metaSeccion.sumRowSumavariosLabel = "";
              metaSeccion.sumRowSumavarios2Label = "";
            } else {
              const seccionNormTexto = normalizarTexto(seccion || "");
              if (/GASTOS/i.test(seccionNormTexto)) {
                metaSeccion.factor = -1;
              } else if (/INGRESOS/i.test(seccionNormTexto)) {
                metaSeccion.factor = 1;
              }
            }
            break;
          }
          case "servmembresia":
          case "serviciosalamembresia": {
            const seccionNormTexto = normalizarTexto(seccion || "");
            if (/GASTOS/i.test(seccionNormTexto)) {
              metaSeccion.factor = -1;
            } else if (/INGRESOS/i.test(seccionNormTexto)) {
              metaSeccion.factor = 1;
            }
            break;
          }
          case "tic":
          case "vpe": {
            const seccionNormTexto = normalizarTexto(seccion || "");
            if (/GASTOS/i.test(seccionNormTexto)) {
              metaSeccion.factor = -1;
            } else if (/INGRESOS/i.test(seccionNormTexto)) {
              metaSeccion.factor = 1;
            }
            break;
          }
          case "rh": {
            if (/GASTOS\s+ADMIN/i.test(seccion || "")) {
              metaSeccion.factor = -1;
              agregarResultRow(metaSeccion, "Resultado  RH");
              // Excluir de la suma operativa (solo debe restarse al resultado final)
              metaSeccion.sumRowSumavariosTexto = "";
              metaSeccion.sumRowSumavarios2Texto = "";
              metaSeccion.sumRowSumavariosLabel = "";
              metaSeccion.sumRowSumavarios2Label = "";
            }
            break;
          }
          case "direccion": {
            const seccionNormTexto = normalizarTexto(seccion || "");
            const esGastosAdminDir =
              /GASTOS\s+DE\s+ADMINISTRACION|GASTOS\s+ADMINISTRATIVOS/i.test(
                seccion || ""
              );
            const esGasto = /GASTOS/i.test(seccionNormTexto);
            if (esGasto) {
              metaSeccion.factor = -1;
            } else if (/INGRESOS/i.test(seccionNormTexto)) {
              metaSeccion.factor = 1;
            }
            let etiquetaDir = "Resultado Director Cap├¡tulo";
            if (/GUADALAJARA/i.test(capituloNormalizado))
              etiquetaDir = "Resultado Director Cap├¡tulo";
            else if (/NORESTE|NE/i.test(capituloNormalizado))
              etiquetaDir = "Resultado Director Cap├¡tulo";
            else if (/NOROESTE|NO/i.test(capituloNormalizado))
              etiquetaDir = "Resultado Director Cap├¡tulo";
            const etiquetaDirNorm = normalizarTexto(etiquetaDir);

            if (esGastosAdminDir) {
              metaSeccion.factor = -1;
              // Excluir de la suma operativa; se resta solo en el resultado del director
              metaSeccion.sumRowSumavariosTexto = "";
              metaSeccion.sumRowSumavarios2Texto = "";
              metaSeccion.sumRowSumavariosLabel = "";
              metaSeccion.sumRowSumavarios2Label = "";
              metaSeccion.resultRowTexto = etiquetaDirNorm;
              if (
                !metaSeccion.resultRows.some(
                  (t) => normalizarTexto(t) === etiquetaDirNorm
                )
              ) {
                metaSeccion.resultRows.push(etiquetaDir);
              }
            } else {
              // Ingresos/Gastos CE/Board/Direcci├│n aportan al resultado director
              metaSeccion.resultRowTexto = etiquetaDirNorm;
              if (
                !metaSeccion.resultRows.some(
                  (t) => normalizarTexto(t) === etiquetaDirNorm
                )
              ) {
                metaSeccion.resultRows.push(etiquetaDir);
              }
            }
            break;
          }
          default:
            break;
        }
      }
      if (etiquetaSumRow) {
        metaSeccion.elementos.sumRow = agregarFilaResumen({
          texto: etiquetaSumRow,
          clase: "sum-row",
          cuerpo,
          placeholdersPorFila: placeholders,
        });
        if (metaSeccion.elementos.sumRow) {
          metaSeccion.elementos.sumRow.dataset.seccion = claveSeccion;
          metaSeccion.elementos.sumRow.dataset.sectionName = seccion;
        }
        const registrarSumario = (texto) => {
          if (!texto) return;
          const clave = normalizarTexto(texto);
          if (!clave) return;
          const existente = sumavariosData.get(clave) || { texto, meta: null };
          existente.meta = metaSeccion;
          sumavariosData.set(clave, existente);
        };
        registrarSumario(metaSeccion.sumRowSumavariosLabel);
        registrarSumario(metaSeccion.sumRowSumavarios2Label);
        metaSeccion.resultRows.forEach((texto) => {
          if (!texto) return;
          const clave = `${texto}::result-row`;
          if (!resultRows.has(clave)) {
            resultRows.set(clave, texto);
          }
        });
      }
      sumasSecciones.push(metaSeccion);
    });

    if (forcedResultTexto) {
      resultRows.clear();
      resultRows.set(`${forcedResultTexto}::result-row`, forcedResultTexto);
    }

    let resultadoFilas = Array.from(resultRows.values()).map((texto) => ({
      texto,
      clase: "result-row",
    }));
    if (resultadoFilas.length > 1) {
      resultadoFilas = resultadoFilas.slice(0, 1);
    }

    return {
      resultadoFilas,
      sumasSecciones,
      sumavarios: sumavariosData,
      faltantesNombre: Array.from(faltantesNombre),
    };
  };

  const limpiarCuentaTexto = (valor) =>
    (valor || "")
      .toString()
      .replace(/[^0-9A-Za-z]/g, "")
      .toUpperCase();

  const asegurarContenedorSugerencias = () => {
    if (estadoModulo.sugerencias.contenedor)
      return estadoModulo.sugerencias.contenedor;
    const div = document.createElement("div");
    div.className = "sugerencias-cuentas";
    Object.assign(div.style, {
      position: "absolute",
      background: "#fff",
      border: "1px solid #d0d7de",
      borderRadius: "6px",
      boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
      padding: "4px",
      minWidth: "200px",
      zIndex: 9999,
      display: "none",
      maxHeight: "240px",
      overflowY: "auto",
    });
    document.body.appendChild(div);
    estadoModulo.sugerencias.contenedor = div;
    return div;
  };

  const ocultarSugerencias = () => {
    const contenedor = estadoModulo.sugerencias.contenedor;
    if (contenedor) {
      contenedor.style.display = "none";
      contenedor.innerHTML = "";
    }
  };

  const mostrarSugerenciasCuenta = (celda, texto) => {
    if (!celda || !estadoModulo.editMode) return;
    const contenedor = asegurarContenedorSugerencias();
    const anioActual = obtenerAnioSeleccionado() || estadoModulo.anio;
    const consulta = limpiarCuentaTexto(texto ?? celda.textContent);
    const disponibles = obtenerCuentasDisponiblesPorAnio(anioActual);
    const usadas = new Set(obtenerCuentasSolicitadas());
    const objetivo = normalizarTexto(consulta);
    let lista = disponibles
      .filter((cuenta) => !usadas.has(cuenta))
      .filter((cuenta) => {
        if (!objetivo) return true;
        const visible = cuentaVisibleDesdeLarga(cuenta);
        return (
          normalizarTexto(cuenta).includes(objetivo) ||
          normalizarTexto(visible).includes(objetivo)
        );
      });
    if (!lista.length) {
      // Si no hay sugerencias, recargar cat├ílogo del a├▒o y reintentar una vez.
      poblarSugerenciasDesdeAnio(anioActual);
      cargarCatalogoCompleto({ anio: anioActual })
        .then((listaCompleta) => {
          if (Array.isArray(listaCompleta) && listaCompleta.length) {
            unificarCuentasDisponibles(listaCompleta, { anio: anioActual });
            mostrarSugerenciasCuenta(celda, texto);
          } else {
            ocultarSugerencias();
          }
        })
        .catch(() => ocultarSugerencias());
      return;
    }
    contenedor.innerHTML = "";
    lista.forEach((cuenta) => {
      const boton = document.createElement("button");
      boton.type = "button";
      boton.textContent = cuentaVisibleDesdeLarga(cuenta);
      Object.assign(boton.style, {
        display: "block",
        width: "100%",
        textAlign: "left",
        padding: "6px 8px",
        border: "none",
        background: "transparent",
        cursor: "pointer",
      });
      boton.addEventListener("mouseenter", () => {
        boton.style.backgroundColor = "#f6f8fa";
      });
      boton.addEventListener("mouseleave", () => {
        boton.style.backgroundColor = "transparent";
      });
      boton.addEventListener("mousedown", (evt) => {
        evt.preventDefault();
        celda.textContent = cuentaVisibleDesdeLarga(cuenta);
        manejarCambioCuenta(celda.parentElement, celda);
        ocultarSugerencias();
      });
      contenedor.appendChild(boton);
    });
    const rect = celda.getBoundingClientRect();
    contenedor.style.left = `${rect.left + window.scrollX}px`;
    contenedor.style.top = `${rect.bottom + window.scrollY + 2}px`;
    contenedor.style.display = "block";
  };

  const normalizarClave = (valor) => normalizarTexto(valor || "");

  const obtenerSeccionPrincipal = (registro = {}) =>
    registro["SECCI…N Principal"] ||
    registro["SECCIàN Principal"] ||
    registro["SECCION Principal"] ||
    registro["SECCION Principal "] ||
    registro.SECCION ||
    registro.seccion_principal ||
    registro.seccion ||
    "";

  const construirRegistrosDesdeLayout = (layout, capituloDestino) => {
    if (!layout) return [];
    const capitulo = layout.capitulo || capituloDestino || "";
    if (Array.isArray(layout.cuentas)) {
      return layout.cuentas
        .filter((cuenta) => cuenta && cuenta.visible !== false)
        .map((cuenta) => ({
          capitulo,
          seccion: obtenerSeccionPrincipal(cuenta) || "SIN SECCION",
          cuenta: cuenta.CUENTA || cuenta.cuenta || "",
          nombre: cuenta.NOMBRE || cuenta.nombre || "",
          factor: Number.isFinite(
            Number(
              cuenta.factor ?? cuenta.operacion_factor ?? cuenta.operacionFactor
            )
          )
            ? Number(
                cuenta.factor ??
                  cuenta.operacion_factor ??
                  cuenta.operacionFactor
              )
            : 1,
        }));
    }
    if (!Array.isArray(layout.secciones)) return [];
    return layout.secciones.flatMap((seccion) => {
      const titulo = seccion.titulo || seccion.seccion || seccion.nombre || "";
      if (!titulo || !Array.isArray(seccion.cuentas)) return [];
      return seccion.cuentas.map((fila) => ({
        capitulo,
        seccion: titulo,
        cuenta: fila.cuenta || "",
        nombre: fila.nombre || "",
        factor: Number.isFinite(Number(fila.factor ?? fila.operacionFactor))
          ? Number(fila.factor ?? fila.operacionFactor)
          : 1,
      }));
    });
  };

  const construirSumasDesdeLayout = (layout) => {
    const mapa = new Map();
    if (!layout) return mapa;
    if (Array.isArray(layout.operaciones)) {
      layout.operaciones.forEach((op) => {
        if (op?.visible === false) return;
        const seccion = op.SECCION || op.seccion || "";
        const clave = normalizarTexto(seccion);
        if (!clave) return;
        const previo = mapa.get(clave) || {};
        const resultRow =
          op["result-row"] || op["result-net-row"] || previo.resultRow || "";
        const signo =
          Number(op?.signos?.["sum-row"]) ||
          Number(op?.signo) ||
          Number(previo.operacionFactor) ||
          null;
        mapa.set(clave, {
          sumRow: op["sum-row"] || previo.sumRow || "",
          sumRowSumavarios:
            op["sum-row-sumavarios"] || previo.sumRowSumavarios || "",
          sumRowSumavarios2:
            op["sum-row-sumavarios2"] || previo.sumRowSumavarios2 || "",
          resultRow,
          operacionFactor:
            Number.isFinite(Number(signo)) && Number(signo) !== 0
              ? Number(signo)
              : previo.operacionFactor ?? 1,
        });
      });
      return mapa;
    }
    if (!Array.isArray(layout.secciones)) return mapa;
    const resultadoGlobal = layout.resultRow || "";
    layout.secciones.forEach((seccion) => {
      const clave = normalizarTexto(seccion.titulo || seccion.seccion || "");
      if (!clave) return;
      mapa.set(clave, {
        sumRow: seccion.sumRowLabel || seccion.sumRow || "",
        sumRowSumavarios:
          seccion.sumRowSumavariosLabel || seccion.sumRowSumavarios || "",
        sumRowSumavarios2:
          seccion.sumRowSumavarios2Label || seccion.sumRowSumavarios2 || "",
        resultRow: seccion.resultRow || resultadoGlobal || "",
        operacionFactor: Number.isFinite(
          Number(seccion.factor ?? seccion.operacionFactor)
        )
          ? Number(seccion.factor ?? seccion.operacionFactor)
          : 1,
      });
    });
    return mapa;
  };

  const validarSumavariosContiguos = (secciones = []) => {
    const bloques = new Map();
    for (let idx = 0; idx < secciones.length; idx += 1) {
      const seccion = secciones[idx] || {};
      const etiqueta = normalizarClave(
        seccion.sumRowSumavarios ||
          seccion.sumRowSumavarios2 ||
          seccion.sumRowSumavariosLabel ||
          ""
      );
      if (!etiqueta) continue;
      const actual = bloques.get(etiqueta);
      if (!actual) {
        bloques.set(etiqueta, { inicio: idx, fin: idx });
      } else {
        if (idx !== actual.fin + 1) {
          return false;
        }
        actual.fin = idx;
      }
    }
    return true;
  };

  const validarLayout = (layout) => {
    if (!layout || !Array.isArray(layout.secciones) || !layout.secciones.length)
      return false;
    if (!layout.resultRow) return false;
    const resultadoSet = new Set();
    layout.secciones.forEach((seccion) => {
      const resultadoSeccion = normalizarClave(
        seccion.resultRow || layout.resultRow
      );
      if (resultadoSeccion) {
        resultadoSet.add(resultadoSeccion);
      }
    });
    if (resultadoSet.size > 1) {
      return false;
    }
    const seccionesValidas = layout.secciones.every((seccion) => {
      const titulo = (seccion.titulo || seccion.seccion || "").trim();
      const sumLabel = (seccion.sumRowLabel || seccion.sumRow || "").trim();
      return Boolean(
        titulo &&
          sumLabel &&
          Array.isArray(seccion.cuentas) &&
          seccion.cuentas.length
      );
    });
    if (!seccionesValidas) {
      return false;
    }
    return validarSumavariosContiguos(layout.secciones);
  };

  const obtenerTextoCeldaDescripcion = (fila) =>
    (fila?.cells?.[1]?.textContent || "").toString().trim();

  const construirLayoutDesdeMeta = ({
    seccionesMeta,
    resultadoFilas,
    placeholdersPorFila,
    capitulo,
  }) => {
    const resultadoTexto = resultadoFilas?.[0]?.texto || "";
    const secciones = (seccionesMeta || []).map((meta) => {
      const titulo = meta.tituloVisible || meta.seccion || "";
      const sumRowLabel =
        obtenerTextoCeldaDescripcion(meta.elementos.sumRow) ||
        meta.sumRowSumavariosLabel ||
        "";
      return {
        titulo,
        sumRowLabel: sumRowLabel || (titulo ? `Suma ${titulo}` : ""),
        sumRowSumavarios: meta.sumRowSumavariosTexto || "",
        sumRowSumavarios2: meta.sumRowSumavarios2Texto || "",
        sumRowSumavariosLabel: meta.sumRowSumavariosLabel || "",
        resultRow: resultadoTexto || meta.resultRowTexto || "",
        factor: Number.isFinite(Number(meta.factor)) ? Number(meta.factor) : 1,
        cuentas: (meta.filasCuenta || []).map((fila) => ({
          cuenta: fila.dataset.cuenta || "",
          nombre: obtenerTextoCeldaDescripcion(fila),
          factor: Number.isFinite(Number(fila.dataset.operacionFactor))
            ? Number(fila.dataset.operacionFactor)
            : 1,
        })),
      };
    });
    return {
      capitulo: capitulo || "",
      placeholdersPorFila: Number.isInteger(placeholdersPorFila)
        ? placeholdersPorFila
        : 0,
      resultRow: resultadoTexto,
      secciones,
    };
  };

  const capturarLayoutDesdeTabla = () => {
    if (!estadoModulo.sumas?.secciones?.length) return null;
    const resultadoFilas = Array.from(
      estadoModulo.sumas.resultRows?.values?.() || []
    ).map((fila) => ({
      texto: obtenerTextoCeldaDescripcion(fila),
      clase: "result-row",
    }));
    if (!resultadoFilas.length && estadoModulo.layoutActual?.resultRow) {
      resultadoFilas.push({
        texto: estadoModulo.layoutActual.resultRow,
        clase: "result-row",
      });
    }
    return construirLayoutDesdeMeta({
      seccionesMeta: estadoModulo.sumas.secciones,
      resultadoFilas,
      placeholdersPorFila: estadoModulo.placeholdersPorFila,
      capitulo: estadoModulo.capitulo,
    });
  };

  const obtenerNombreModulo = () => {
    const dataset = document.body?.dataset || {};
    const moduloBase =
      estadoModulo.sheet ||
      dataset.modulo ||
      dataset.moduloAlias ||
      dataset.moduloNombre ||
      "";
    if (moduloBase) return moduloBase;
    const moduloId =
      estadoModulo.moduloId || dataset.moduloId || dataset.modulo || "";
    if (
      moduloId &&
      window.CapitulosModulos?.obtenerSheetPorModulo
    ) {
      const sheet = window.CapitulosModulos.obtenerSheetPorModulo(moduloId);
      if (sheet) return sheet;
    }
    return moduloId;
  };

  const construirCuentasDesdeLayout = ({ layout, capitulo }) => {
    if (!layout || !Array.isArray(layout.secciones)) return [];
    const cuentas = [];
    let orden = 0;
    layout.secciones.forEach((seccion) => {
      const titulo = (seccion.titulo || seccion.seccion || "").toString().trim();
      const filas = Array.isArray(seccion.cuentas) ? seccion.cuentas : [];
      filas.forEach((fila) => {
        const cuenta = (fila.cuenta || "").toString().trim();
        if (!cuenta) return;
        const factorCuenta = Number.isFinite(
          Number(fila.factor ?? fila.operacionFactor)
        )
          ? Number(fila.factor ?? fila.operacionFactor)
          : 1;
        cuentas.push({
          CAPITULO: capitulo,
          CUENTA: cuenta,
          NOMBRE: fila.nombre || "",
          SECCION: titulo || "SIN SECCION",
          orden,
          orden_presentacion: orden,
          factor: factorCuenta,
        });
        orden += 1;
      });
    });
    return cuentas;
  };

  const construirOperacionesDesdeLayout = ({
    layout,
    capitulo,
    moduloNombre,
    operacionesPrevias,
  }) => {
    if (!layout || !Array.isArray(layout.secciones)) return [];
    const existentes = Array.isArray(operacionesPrevias)
      ? operacionesPrevias.map((op) => ({ ...op }))
      : [];
    const usados = new Set();
    const porSeccion = new Map();

    const normalizarOperacionId = (texto) =>
      normalizarTexto(texto || "")
        .replace(/\s+/g, "_")
        .replace(/[^A-Z0-9_]/g, "");

    const idsOcupados = new Set();
    existentes.forEach((op) => {
      const id =
        op?.OperacionId ||
        op?.operacion_id ||
        op?.id ||
        op?.clase ||
        op?.Clase ||
        op?.operacion_etiqueta;
      const normalizado = normalizarOperacionId(id);
      if (normalizado) idsOcupados.add(normalizado);
      const seccion = normalizarTexto(op?.SECCION || op?.seccion || "");
      if (!seccion) return;
      if (!porSeccion.has(seccion)) porSeccion.set(seccion, []);
      porSeccion.get(seccion).push(op);
    });

    const asegurarIdUnico = (base) => {
      let candidato = normalizarOperacionId(base) || "OP";
      if (!idsOcupados.has(candidato)) {
        idsOcupados.add(candidato);
        return candidato;
      }
      let contador = 1;
      let actual = `${candidato}_${contador}`;
      while (idsOcupados.has(actual)) {
        contador += 1;
        actual = `${candidato}_${contador}`;
      }
      idsOcupados.add(actual);
      return actual;
    };

    const operaciones = [];
    layout.secciones.forEach((seccion, idx) => {
      const nombreSeccion = (seccion.titulo || seccion.seccion || "")
        .toString()
        .trim();
      if (!nombreSeccion) return;
      const claveSeccion = normalizarTexto(nombreSeccion);
      const candidatos = porSeccion.get(claveSeccion) || [];
      let op = null;
      if (candidatos.length) {
        op = { ...candidatos[0] };
        usados.add(candidatos[0]);
      } else {
        op = {
          CAPITULO: capitulo,
          HOJA: moduloNombre,
          SECCION: nombreSeccion,
          Clase: "",
          OperacionId: "",
          signos: {},
        };
      }

      const sumRowLabel =
        (seccion.sumRowLabel || seccion.sumRow || "").toString().trim() ||
        (nombreSeccion ? `Suma ${nombreSeccion}` : "");
      const sumRowSumavariosLabel =
        (seccion.sumRowSumavariosLabel || seccion.sumRowSumavarios || "")
          .toString()
          .trim();
      const sumRowSumavarios2Label =
        (seccion.sumRowSumavarios2Label || seccion.sumRowSumavarios2 || "")
          .toString()
          .trim();
      const resultRowLabel =
        (seccion.resultRow || layout.resultRow || "").toString().trim();

      op.CAPITULO = capitulo;
      op.HOJA = moduloNombre;
      op.SECCION = nombreSeccion;
      op.Clase = op.Clase || op.operacion_etiqueta || sumRowLabel || nombreSeccion;
      op.OperacionId =
        op.OperacionId || asegurarIdUnico(op.Clase || nombreSeccion);
      op.orden = Number.isFinite(Number(seccion.orden))
        ? Number(seccion.orden)
        : idx;
      op.orden_presentacion = op.orden;

      if (sumRowLabel) op["sum-row"] = sumRowLabel;
      if (sumRowSumavariosLabel) {
        op["sum-row-sumavarios"] = sumRowSumavariosLabel;
      }
      if (sumRowSumavarios2Label) {
        op["sum-row-sumavarios2"] = sumRowSumavarios2Label;
      }
      if (resultRowLabel) op["result-row"] = resultRowLabel;

      const factor = Number.isFinite(
        Number(seccion.factor ?? seccion.operacionFactor)
      )
        ? Number(seccion.factor ?? seccion.operacionFactor)
        : null;
      if (factor != null) {
        if (!op.signos || typeof op.signos !== "object") {
          op.signos = {};
        }
        op.signos["sum-row"] = factor;
        op.signo = factor;
      }

      operaciones.push(op);
    });

    existentes.forEach((op) => {
      if (usados.has(op)) return;
      operaciones.push({
        ...op,
        CAPITULO: capitulo,
        HOJA: moduloNombre,
      });
    });

    return operaciones;
  };

  const persistirLayoutActual = async () => {
    const empresa = Sesion.obtenerEmpresaActiva();
    const anioSeleccion = obtenerAnioSeleccionado();
    const anio = Number.isInteger(anioSeleccion)
      ? anioSeleccion
      : estadoModulo.anio;
    if (
      !empresa?.id ||
      !Number.isInteger(anio) ||
      !estadoModulo.moduloClave ||
      !esModuloEditable(estadoModulo.moduloClave)
    ) {
      return false;
    }
    const layout = capturarLayoutDesdeTabla();
    if (!validarLayout(layout)) {
      console.warn("Layout no v\u00e1lido, no se guard\u00f3.");
      return false;
    }
    const moduloNombre = obtenerNombreModulo();
    if (!moduloNombre) {
      console.warn("Layout sin modulo valido, no se guard\u00f3.");
      return false;
    }
    const capitulo = estadoModulo.capitulo || layout.capitulo || "DEFAULT";
    const cuentas = construirCuentasDesdeLayout({ layout, capitulo });
    const operaciones = construirOperacionesDesdeLayout({
      layout,
      capitulo,
      moduloNombre,
      operacionesPrevias: estadoModulo.layoutOperaciones,
    });
    const guardado = await guardarLayoutServidor({
      modulo: moduloNombre,
      anio,
      capitulo,
      empresaId: empresa.id,
      cuentas,
      operaciones,
    });
    if (guardado) {
      estadoModulo.layoutActual = layout;
      estadoModulo.layoutOperaciones = operaciones;
      estadoModulo.layoutEsPersonalizado = true;
      // Resetear flag de modificación ya que se guardó exitosamente
      estadoModulo.layoutModificado = false;
      console.log("✅ Layout guardado en SQLite");
    }
    return guardado;
  };

  let menuContextual = null;
  let filaContextual = null;

  const obtenerMetaSeccionPorFila = (fila) => {
    const clave = normalizarClave(fila?.dataset?.seccion || "");
    if (!clave) return null;
    return (
      estadoModulo.sumas.secciones.find(
        (seccion) => normalizarClave(seccion.seccion) === clave
      ) || null
    );
  };

  const obtenerMetaPorSumavariosFila = (fila) => {
    const etiqueta = normalizarClave(obtenerTextoCeldaDescripcion(fila));
    if (!etiqueta) return null;
    return estadoModulo.sumas.secciones.find(
      (seccion) => normalizarClave(seccion.sumRowSumavariosLabel) === etiqueta
    );
  };

  const abrirModalEdicionFila = (fila) => {
    if (!fila) return;
    const esCuenta =
      fila.classList.contains("fila-cuenta") ||
      fila.classList.contains("account-row");
    const meta = obtenerMetaSeccionPorFila(fila);
    if (!esCuenta && !meta) return;
    const factorActual = esCuenta
      ? Number(fila.dataset.operacionFactor ?? 1)
      : Number(meta?.factor ?? meta?.operacionFactor ?? 1);
    const factorChoice =
      factorActual === -1 ? "-1" : factorActual === 1 ? "1" : "custom";
    const factorCustom = factorChoice === "custom" ? factorActual : "";
    const descripcionActual = esCuenta
      ? obtenerTextoCeldaDescripcion(fila)
      : meta?.tituloVisible || "";
    const etiqueta = esCuenta
      ? fila.dataset.cuenta || fila.cells?.[0]?.textContent || ""
      : meta?.seccion || "";

    // Fallback sencillo si no hay Bootstrap
    if (!window.bootstrap?.Modal) {
      const entrada = Number(
        window.prompt("Define el factor (+ suma / - resta):", factorActual || 1)
      );
      if (!Number.isFinite(entrada)) return;
      if (esCuenta) {
        fila.dataset.operacionFactor = String(entrada);
      } else if (meta) {
        meta.factor = entrada;
        meta.operacionFactor = entrada;
      }
      if (esCuenta && descripcionActual) {
        actualizarNombreFila(fila, descripcionActual);
      }
      estadoModulo.layoutModificado = true;
      recalcularSumas();
      return;
    }

    const modalId = "editFactorModal";
    const existente = document.getElementById(modalId);
    if (existente) existente.remove();

    const html = `
      <div class="modal fade" id="${modalId}" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog">
          <div class="modal-content">
            <form id="editFactorForm">
              <div class="modal-header">
                <h5 class="modal-title">Editar ${
                  esCuenta ? "cuenta" : "secci┬ón"
                }</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
              </div>
              <div class="modal-body">
                <div class="mb-3">
                  <label class="form-label">${
                    esCuenta ? "Cuenta" : "Secci┬ón"
                  }</label>
                  <input type="text" class="form-control" value="${
                    etiqueta || ""
                  }" readonly>
                </div>
                ${
                  esCuenta
                    ? `
                <div class="mb-3">
                  <label class="form-label">Descripci┬ón</label>
                  <input type="text" class="form-control" id="editDescripcion" value="${
                    descripcionActual || ""
                  }">
                </div>`
                    : ""
                }
                <div class="mb-3">
                  <label class="form-label">Operacion / factor</label>
                  <select class="form-select" id="editFactorSelect">
                    <option value="1" ${
                      factorChoice === "1" ? "selected" : ""
                    }>Sumar (+1)</option>
                    <option value="-1" ${
                      factorChoice === "-1" ? "selected" : ""
                    }>Restar (-1)</option>
                    <option value="custom" ${
                      factorChoice === "custom" ? "selected" : ""
                    }>Personalizado</option>
                  </select>
                </div>
                <div class="mb-3 ${
                  factorChoice === "custom" ? "" : "d-none"
                }" id="editFactorCustomGroup">
                  <label class="form-label">Factor personalizado</label>
                  <input type="number" step="0.01" class="form-control" id="editFactorCustom" value="${factorCustom}">
                </div>
                <div class="form-text">Usa 1 para sumar, -1 para restar o un factor decimal personalizado.</div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                <button type="submit" class="btn btn-primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", html);
    const modalEl = document.getElementById(modalId);
    const modal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
    const factorSelect = modalEl.querySelector("#editFactorSelect");
    const customGroup = modalEl.querySelector("#editFactorCustomGroup");
    const customInput = modalEl.querySelector("#editFactorCustom");
    const descInput = modalEl.querySelector("#editDescripcion");

    const toggleCustom = (valor) => {
      if (!customGroup) return;
      const mostrar = valor === "custom";
      customGroup.classList.toggle("d-none", !mostrar);
      if (mostrar && !customInput.value) {
        customInput.value = factorCustom || "";
      }
    };
    factorSelect.addEventListener("change", (ev) =>
      toggleCustom(ev.target.value)
    );

    modalEl
      .querySelector("#editFactorForm")
      ?.addEventListener("submit", (ev) => {
        ev.preventDefault();
        const seleccion = factorSelect.value;
        const factor =
          seleccion === "custom"
            ? Number(customInput.value)
            : Number(seleccion);
        if (!Number.isFinite(factor)) {
          window.alert(
            "Define un factor v┬álido (usa 1 para sumar, -1 para restar)."
          );
          return;
        }
        if (esCuenta && descInput) {
          const nuevoNombre = descInput.value.trim();
          if (nuevoNombre) {
            actualizarNombreFila(fila, nuevoNombre);
          }
        }
        if (esCuenta) {
          fila.dataset.operacionFactor = String(factor);
        } else if (meta) {
          meta.factor = factor;
          meta.operacionFactor = factor;
        }
        estadoModulo.layoutModificado = true;
        recalcularSumas();
        modal.hide();
      });

    modalEl.addEventListener("hidden.bs.modal", () => modalEl.remove());
    toggleCustom(factorChoice);
    modal.show();
  };

  window.editarFila = abrirModalEdicionFila;

  const obtenerPrimerResultadoFila = () => {
    const iter = estadoModulo.sumas.resultRows?.values?.();
    if (!iter) return null;
    const primero = iter.next();
    return primero?.value || null;
  };

  const crearFilaCuentaVacia = (seccionClave) => {
    const fila = document.createElement("tr");
    fila.className = "fila-cuenta account-row";
    const celdaCuenta = document.createElement("td");
    celdaCuenta.textContent = "-";
    fila.appendChild(celdaCuenta);
    const celdaNombre = document.createElement("td");
    celdaNombre.textContent = "-";
    fila.appendChild(celdaNombre);
    for (let i = 0; i < estadoModulo.placeholdersPorFila; i += 1) {
      const celda = document.createElement("td");
      celda.className = "budget-value";
      celda.textContent = "-";
      fila.appendChild(celda);
    }
    fila.dataset.seccion = seccionClave || "";
    fila.dataset.cuenta = "";
    fila.dataset.cuenta21 = "";
    fila.dataset.operacionFactor = "1";
    return fila;
  };

  const crearFilaCuentaDesdeDatos = (datos, seccionClave) => {
    const fila = crearFilaCuentaVacia(seccionClave);
    const cuentaTexto = datos.cuenta || "-";
    const descripcionTexto = datos.descripcion || "-";
    const cuentaCelda = fila.children[0];
    const descripcionCelda = fila.children[1];
    if (cuentaCelda) {
      cuentaCelda.textContent = cuentaTexto;
    }
    if (descripcionCelda) {
      descripcionCelda.textContent = descripcionTexto;
    }
    fila.dataset.cuenta = datos.cuenta || "";
    fila.dataset.cuenta21 = datos.cuenta ? convertirCuenta21(datos.cuenta) : "";
    const factorCuenta = Number.isFinite(Number(datos.factor))
      ? Number(datos.factor)
      : 1;
    fila.dataset.operacionFactor = String(factorCuenta);
    return fila;
  };

  const actualizarSumavariosParaRango = (label, indices, insertIdx) => {
    if (!label || !Array.isArray(indices) || indices.length < 2) {
      console.warn("ÔÜá´©Å Sumavarios requiere al menos 2 secciones");
      return;
    }
    const clave = normalizarTexto(label);
    if (!clave) return;
    if (!estadoModulo || !estadoModulo.tabla) {
      console.error(
        "ÔØî actualizarSumavariosParaRango: estadoModulo.tabla no disponible"
      );
      return;
    }
    const cuerpo = estadoModulo.tabla.querySelector("tbody");
    if (!cuerpo) return;

    // Eliminar fila existente si hay
    const existente = estadoModulo.sumas.sumavariosRows?.get(clave);
    if (existente && existente.parentNode) {
      try {
        existente.parentNode.removeChild(existente);
        estadoModulo.sumas.sumavariosRows.delete(clave);
      } catch (e) {
        console.warn("ÔÜá´©Å Error eliminando sumavarios existente:", e);
      }
    }

    const filaSumario = agregarFilaResumen({
      texto: label,
      clase: "sum-row-sumavarios",
      cuerpo,
      placeholdersPorFila: estadoModulo.placeholdersPorFila,
    });
    if (!filaSumario) return;
    if (!estadoModulo.sumas.sumavariosRows)
      estadoModulo.sumas.sumavariosRows = new Map();
    estadoModulo.sumas.sumavariosRows.set(clave, filaSumario);

    // Normalizar y validar ├¡ndices
    const indicesOrdenados = [...new Set(indices)].sort((a, b) => a - b);
    const metasAfectadas = [];
    indicesOrdenados.forEach((idx) => {
      if (!Number.isInteger(idx)) return;
      const idxReal = idx >= insertIdx ? idx + 1 : idx;
      if (
        idxReal >= 0 &&
        idxReal < (estadoModulo.sumas.secciones || []).length
      ) {
        const meta = estadoModulo.sumas.secciones[idxReal];
        if (meta) metasAfectadas.push(meta);
      }
    });

    if (metasAfectadas.length < 2) {
      // No tiene sentido crear sumavarios para menos de 2 secciones
      console.warn(
        "ÔÜá´©Å Menos de 2 secciones en sumavarios, se omite la creaci├│n"
      );
      estadoModulo.sumas.sumavariosRows.delete(clave);
      try {
        filaSumario.remove();
      } catch (e) {}
      return;
    }

    metasAfectadas.forEach((meta) => {
      meta.sumRowSumavariosLabel = label;
      meta.sumRowSumavariosTexto = clave;
    });

    const ultimaMeta = metasAfectadas[metasAfectadas.length - 1];
    const referencia =
      ultimaMeta?.elementos?.sumRow ||
      ultimaMeta?.filasCuenta?.[ultimaMeta.filasCuenta.length - 1] ||
      null;
    if (referencia && referencia.parentNode) {
      try {
        referencia.parentNode.insertBefore(filaSumario, referencia.nextSibling);
      } catch (e) {
        console.warn("ÔÜá´©Å Error insertando fila sumavarios en DOM:", e);
        cuerpo.appendChild(filaSumario);
      }
    } else {
      cuerpo.appendChild(filaSumario);
    }
  };

  const crearSeccionDesdeFormulario = ({
    referenciaFila,
    titulo,
    sumLabel,
    cuentas,
    sumavariosLabel,
    range,
    factorSeccion = 1,
  }) => {
    // VALIDACIONES
    if (!estadoModulo || !estadoModulo.tabla) {
      console.error("ÔØî crearSeccionDesdeFormulario: tabla no disponible");
      return;
    }
    const cuerpo = estadoModulo.tabla.querySelector("tbody");
    if (!cuerpo) {
      console.error("ÔØî crearSeccionDesdeFormulario: tbody no encontrado");
      return;
    }
    if (!titulo || typeof titulo !== "string" || !titulo.trim()) {
      console.error("ÔØî crearSeccionDesdeFormulario: titulo inv├ílido");
      return;
    }
    const cuentasLista = Array.isArray(cuentas) ? cuentas.slice() : [];
    if (cuentasLista.length === 0) {
      console.error(
        "ÔØî crearSeccionDesdeFormulario: Se requiere al menos una cuenta"
      );
      return;
    }

    const seccionClave = normalizarTexto(titulo);
    const header = document.createElement("tr");
    header.className = "section-header-row";
    header.dataset.seccion = seccionClave;
    header.dataset.sectionName = titulo;
    const celdaHeader = document.createElement("td");
    celdaHeader.colSpan = estadoModulo.placeholdersPorFila + 2;
    celdaHeader.textContent = titulo;
    header.appendChild(celdaHeader);

    const cuentasFilas = cuentasLista.map((datos) =>
      crearFilaCuentaDesdeDatos(datos, seccionClave)
    );
    const textoSumRow =
      sumLabel && typeof sumLabel === "string" && sumLabel.trim()
        ? sumLabel.trim()
        : `Suma ${titulo}`;
    const filaSumRow = agregarFilaResumen({
      texto: textoSumRow,
      clase: "sum-row",
      cuerpo,
      placeholdersPorFila: estadoModulo.placeholdersPorFila,
    });
    if (filaSumRow) {
      filaSumRow.dataset.seccion = seccionClave;
      filaSumRow.dataset.sectionName = titulo;
    }

    // Determinar ├¡ndice de inserci├│n con validaciones
    let idxInsercion = estadoModulo.sumas.secciones.length;
    try {
      const metaBase =
        referenciaFila?.classList.contains("sum-row-sumavarios") &&
        obtenerMetaPorSumavariosFila(referenciaFila)
          ? obtenerMetaPorSumavariosFila(referenciaFila)
          : obtenerMetaSeccionPorFila(referenciaFila);
      if (metaBase) {
        const idxTent = obtenerIndiceInsercionSeccion(metaBase);
        if (
          Number.isInteger(idxTent) &&
          idxTent >= 0 &&
          idxTent <= estadoModulo.sumas.secciones.length
        ) {
          idxInsercion = idxTent;
        } else {
          console.warn(
            "ÔÜá´©Å crearSeccionDesdeFormulario: ├¡ndice de inserci├│n inv├ílido, se usar├í al final"
          );
        }
      }
    } catch (e) {
      console.warn(
        "ÔÜá´©Å crearSeccionDesdeFormulario: error determinando ├¡ndice inserci├│n",
        e
      );
    }

    const referenciaMeta =
      estadoModulo.sumas.secciones[idxInsercion] ||
      estadoModulo.sumas.secciones[idxInsercion - 1] ||
      null;
    let anchor =
      referenciaMeta?.elementos?.sumRow ||
      referenciaMeta?.filasCuenta?.[0] ||
      obtenerPrimerResultadoFila();
    if (!anchor) anchor = cuerpo.lastElementChild?.nextSibling || null;

    try {
      if (anchor && anchor.parentNode === cuerpo) {
        cuerpo.insertBefore(header, anchor);
        cuentasFilas.forEach((fila) => cuerpo.insertBefore(fila, anchor));
        if (filaSumRow) cuerpo.insertBefore(filaSumRow, anchor);
      } else {
        cuerpo.appendChild(header);
        cuentasFilas.forEach((fila) => cuerpo.appendChild(fila));
        if (filaSumRow) cuerpo.appendChild(filaSumRow);
      }
    } catch (err) {
      console.error(
        "ÔØî crearSeccionDesdeFormulario: error insertando en DOM",
        err
      );
      return;
    }

    const metaNueva = {
      seccion: seccionClave,
      tituloVisible: titulo,
      filasCuenta: cuentasFilas,
      sumRowTexto: normalizarTexto(textoSumRow),
      sumRowSumavariosTexto: "",
      sumRowSumavarios2Texto: "",
      sumRowSumavariosLabel: "",
      sumRowSumavarios2Label: "",
      resultRowTexto: "",
      resultRows: [],
      factor: Number.isFinite(Number(factorSeccion))
        ? Number(factorSeccion)
        : 1,
      operacionFactor: Number.isFinite(Number(factorSeccion))
        ? Number(factorSeccion)
        : 1,
      elementos: { header, sumRow: filaSumRow },
    };

    try {
      if (
        idxInsercion >= 0 &&
        idxInsercion <= estadoModulo.sumas.secciones.length
      ) {
        estadoModulo.sumas.secciones.splice(idxInsercion, 0, metaNueva);
      } else {
        estadoModulo.sumas.secciones.push(metaNueva);
      }
    } catch (err) {
      console.error(
        "ÔØî crearSeccionDesdeFormulario: error insertando metaSeccion",
        err
      );
      return;
    }

    if (sumavariosLabel && range && typeof range === "object") {
      const indices = [];
      const start = Number.isInteger(range.start) ? range.start : null;
      const end = Number.isInteger(range.end) ? range.end : null;
      if (start !== null && end !== null && start <= end) {
        for (let i = start; i <= end; i += 1) indices.push(i);
      }
      if (indices.length > 1)
        actualizarSumavariosParaRango(sumavariosLabel, indices, idxInsercion);
    }

    actualizarEstructuraDespuesCambio();
  };

  const actualizarEstructuraDespuesCambio = () => {
    aplicarModoEdicionEnTabla();
    aplicarFiltroColumnasPorPeriodo();
    recalcularSumas();
    // NO persistir autom├íticamente - marcar como modificado para guardado expl├¡cito
    estadoModulo.layoutModificado = true;
    estadoModulo.hayCambios = true;
    notificarCambios();

    // Actualizar componente de colapso de secciones si existe
    if (
      window.SeccionCollapse &&
      typeof window.SeccionCollapse.actualizar === "function"
    ) {
      window.SeccionCollapse.actualizar();
    }
  };

  const insertarFilaCuentaNueva = (referencia, posicion) => {
    if (!referencia || !estadoModulo.tabla) return;
    const meta = obtenerMetaSeccionPorFila(referencia);
    if (!meta) return;
    const idx = meta.filasCuenta.indexOf(referencia);
    if (idx < 0) return;
    const cuerpo = estadoModulo.tabla.querySelector("tbody");
    const nuevaFila = crearFilaCuentaVacia(meta.seccion);
    const insertarAntesDe = (nodo) => {
      if (nodo) {
        cuerpo.insertBefore(nuevaFila, nodo);
      } else {
        cuerpo.appendChild(nuevaFila);
      }
    };
    if (posicion === "arriba") {
      insertarAntesDe(referencia);
      meta.filasCuenta.splice(idx, 0, nuevaFila);
    } else {
      const siguiente = meta.filasCuenta[idx + 1];
      if (siguiente) {
        insertarAntesDe(siguiente);
      } else if (meta.elementos.sumRow) {
        insertarAntesDe(meta.elementos.sumRow);
      } else {
        insertarAntesDe(obtenerPrimerResultadoFila());
      }
      meta.filasCuenta.splice(idx + 1, 0, nuevaFila);
    }
    actualizarEstructuraDespuesCambio();
    abrirModalEdicionFila(nuevaFila);
  };

  const eliminarFilaSeleccionada = (fila) => {
    if (!fila) return;

    // Caso: fila de cuenta
    if (fila.classList.contains("fila-cuenta")) {
      const meta = obtenerMetaSeccionPorFila(fila);
      if (!meta) {
        console.warn("ÔÜá´©Å eliminarFilaSeleccionada: meta no encontrada");
        return;
      }
      if ((meta.filasCuenta || []).length <= 1) {
        window.alert("La secci├│n debe tener al menos una cuenta.");
        return;
      }
      const cuenta = fila.dataset.cuenta21 || fila.dataset.cuenta;
      if (cuenta) {
        estadoModulo.valoresPorCuenta?.delete(cuenta);
        estadoModulo.nombresPorCuenta?.delete(cuenta);
      }
      try {
        fila.remove();
      } catch (e) {
        console.warn("ÔÜá´©Å Error removiendo fila del DOM", e);
      }
      const idx = meta.filasCuenta.indexOf(fila);
      if (idx >= 0) meta.filasCuenta.splice(idx, 1);
      actualizarEstructuraDespuesCambio();
      console.log(`Ô£à Fila eliminada de secci├│n ${meta.seccion}`);
      return;
    }

    // Caso: fila sum-row-sumavarios
    if (fila.classList.contains("sum-row-sumavarios")) {
      if (!estadoModulo || !estadoModulo.tabla) return;
      const cuerpo = estadoModulo.tabla.querySelector("tbody");
      if (!cuerpo) return;

      // Buscar clave asociada
      let claveAux = null;
      for (const [k, f] of (
        estadoModulo.sumas.sumavariosRows || new Map()
      ).entries()) {
        if (f === fila) {
          claveAux = k;
          break;
        }
      }
      if (claveAux) {
        // Limpiar referencias en metas
        (estadoModulo.sumas.secciones || []).forEach((meta) => {
          if (
            normalizarTexto(meta.sumRowSumavariosLabel) ===
            normalizarTexto(claveAux)
          ) {
            meta.sumRowSumavariosLabel = "";
            meta.sumRowSumavariosTexto = "";
          }
        });
        estadoModulo.sumas.sumavariosRows.delete(claveAux);
      }
      try {
        fila.remove();
      } catch (e) {
        console.warn("ÔÜá´©Å Error al eliminar sumavarios del DOM", e);
      }
      actualizarEstructuraDespuesCambio();
      console.log(`Ô£à Sumavarios ${claveAux || ""} eliminado`);
      return;
    }
  };

  const obtenerIndiceInsercionSeccion = (metaBase) => {
    const lista = estadoModulo.sumas.secciones || [];
    const idxBase = lista.indexOf(metaBase);
    if (idxBase < 0) return lista.length;
    const etiqueta = normalizarClave(metaBase?.sumRowSumavariosLabel || "");
    if (!etiqueta) return idxBase + 1;
    let fin = idxBase;
    while (
      fin + 1 < lista.length &&
      normalizarClave(lista[fin + 1]?.sumRowSumavariosLabel || "") === etiqueta
    ) {
      fin += 1;
    }
    return fin + 1;
  };

  const agregarSeccionNueva = (referenciaFila) => {
    abrirModalAgregarSeccion(referenciaFila);
  };

  const ocultarMenuContextual = () => {
    if (menuContextual) {
      menuContextual.hidden = true;
    }
    filaContextual = null;
  };

  const mostrarMenuContextual = (x, y, opciones) => {
    const menu = menuContextual || document.createElement("div");
    menuContextual = menu;
    menu.className = "planeacion-context-menu";
    menu.innerHTML = "";
    Object.assign(menu.style, {
      position: "absolute",
      background: "#fff",
      border: "1px solid #d0d7de",
      borderRadius: "6px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      padding: "4px",
      minWidth: "200px",
      fontSize: "0.9rem",
      zIndex: 9999,
    });
    opciones.forEach((opcion) => {
      const boton = document.createElement("button");
      boton.type = "button";
      boton.textContent = opcion.texto;
      Object.assign(boton.style, {
        display: "block",
        width: "100%",
        textAlign: "left",
        padding: "8px 10px",
        border: "none",
        background: "transparent",
        cursor: "pointer",
        borderRadius: "4px",
      });
      boton.addEventListener("mouseenter", () => {
        boton.style.backgroundColor = "#f6f8fa";
      });
      boton.addEventListener("mouseleave", () => {
        boton.style.backgroundColor = "transparent";
      });
      boton.addEventListener("click", () => {
        switch (opcion.clave) {
          case "add_wizard":
            // Usar InsertionWizard si est├í disponible
            if (typeof window.InsertionWizard !== "undefined") {
              window.InsertionWizard.open(filaContextual);
            } else {
              console.warn("InsertionWizard no disponible");
            }
            break;
          case "edit_row":
          case "edit_section":
            abrirModalEdicionFila(filaContextual);
            break;
          case "add_above":
            insertarFilaCuentaNueva(filaContextual, "arriba");
            break;
          case "add_below":
            insertarFilaCuentaNueva(filaContextual, "abajo");
            break;
          case "delete_row":
            eliminarFilaSeleccionada(filaContextual);
            break;
          case "add_section":
            agregarSeccionNueva(filaContextual);
            break;
          default:
            break;
        }
        ocultarMenuContextual();
      });
      menu.appendChild(boton);
    });
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.hidden = false;
    if (!document.body.contains(menu)) {
      document.body.appendChild(menu);
    }
  };

  document.addEventListener("click", (evt) => {
    if (menuContextual && !menuContextual.contains(evt.target)) {
      ocultarMenuContextual();
    }
  });
  window.addEventListener("scroll", () => ocultarMenuContextual(), true);
  window.addEventListener("resize", () => ocultarMenuContextual());

  document.addEventListener("contextmenu", (evt) => {
    if (!estadoModulo.editMode || !esModuloEditable(estadoModulo.moduloClave)) {
      return;
    }
    if (window.ContextMenuWizard || window.InsertionWizard) {
      // Si est├í activo el wizard de inserci├│n, dejamos que solo ├®l maneje el men├║ contextual
      return;
    }
    const tabla = estadoModulo.tabla || obtenerTabla();
    if (!tabla || !tabla.contains(evt.target)) {
      return;
    }
    const fila = evt.target.closest("tr");
    if (!fila) {
      return;
    }
    const esCuenta =
      fila.classList.contains("fila-cuenta") ||
      fila.classList.contains("account-row");
    const esSeccion =
      fila.classList.contains("section-header-row") ||
      fila.classList.contains("sum-row");
    const opciones = [];
    // Priorizar InsertionWizard si est├í disponible
    if (typeof window.InsertionWizard !== "undefined") {
      opciones.push({
        clave: "add_wizard",
        texto: "Ô£¿ Agregar cuenta/secci├│n...",
      });
    }
    if (esCuenta) {
      opciones.push({ clave: "edit_row", texto: "Editar operaci├│n / factor" });
      opciones.push({ clave: "add_above", texto: "Agregar cuenta arriba" });
      opciones.push({ clave: "add_below", texto: "Agregar cuenta abajo" });
      opciones.push({ clave: "delete_row", texto: "Eliminar fila" });
    } else if (esSeccion) {
      opciones.push({
        clave: "edit_section",
        texto: "Editar operaci├│n de secci├│n",
      });
    } else if (fila.classList.contains("sum-row-sumavarios")) {
      opciones.push({
        clave: "delete_row",
        texto: "Eliminar sum-row-sumavarios",
      });
    }
    // Agregar secci├│n (legacy) solo si no hay wizard
    if (typeof window.InsertionWizard === "undefined") {
      opciones.push({ clave: "add_section", texto: "Agregar secci├│n" });
    }
    if (!opciones.length) return;
    evt.preventDefault();
    filaContextual = fila;
    mostrarMenuContextual(evt.pageX, evt.pageY, opciones);
  });

  /**
   * Extrae valores num├®ricos de las celdas de una fila
   *
   * Lee el textContent de cada celda (empezando desde la columna 'inicio'),
   * limpia el texto eliminando s├¡mbolos de moneda y formato,
   * y convierte cada valor a n├║mero.
   *
   * @param {HTMLTableRowElement} fila - Fila de la cual extraer valores
   * @param {number} inicio - ├ìndice de celda inicial (default: 2, saltando nombre y cuenta)
   * @returns {Array<number>} Array con los valores num├®ricos extra├¡dos
   */
  const extraerValoresNumericos = (fila, inicio = 2) => {
    const valores = [];
    for (let i = inicio; i < fila.cells.length; i += 1) {
      let texto = (fila.cells[i].textContent || "").replace(/[^0-9+.,-]/g, "");
      // Determine locale/format heuristics:
      const hasComma = texto.indexOf(",") >= 0;
      const hasDot = texto.indexOf(".") >= 0;
      if (hasComma && hasDot) {
        // Use position of last separator to determine decimal separator
        const lastDot = texto.lastIndexOf(".");
        const lastComma = texto.lastIndexOf(",");
        if (lastDot > lastComma) {
          // dot is decimal, remove commas
          texto = texto.replace(/,/g, "");
        } else {
          // comma is decimal, remove dots (thousands) and convert comma to dot
          texto = texto.replace(/\./g, "");
          texto = texto.replace(/,/g, ".");
        }
      } else if (hasComma && !hasDot) {
        // Only comma exists: heuristic
        const partes = texto.split(",");
        // If part after comma is length 3, likely thousands -> remove commas, else comma likely decimal
        if (partes.length > 1 && partes[1].length === 3) {
          texto = texto.replace(/,/g, "");
        } else {
          texto = texto.replace(/,/g, ".");
        }
      }
      // If multiple dots remain, keep last as decimal and remove others
      if ((texto.match(/\./g) || []).length > 1) {
        const partes = texto.split(".");
        const decimal = partes.pop();
        texto = partes.join("") + "." + decimal;
      }
      const numero = Number(texto);
      valores.push(Number.isFinite(numero) ? numero : 0);
    }
    return valores;
  };

  /**
   * Asigna valores num├®ricos formateados a las celdas de una fila
   *
   * Toma un array de n├║meros y los escribe en las celdas de la fila
   * aplicando el formato num├®rico (separadores de miles, decimales, etc.)
   *
   * @param {HTMLTableRowElement} fila - Fila donde asignar los valores
   * @param {Array<number>} valores - Array con los valores a asignar
   * @param {number} inicio - ├ìndice de celda inicial (default: 2, saltando nombre y cuenta)
   */
  const asignarValoresNumericos = (fila, valores, inicio = 2) => {
    if (!fila || !Array.isArray(valores)) return;
    for (
      let i = inicio;
      i < fila.cells.length && i - inicio < valores.length;
      i += 1
    ) {
      fila.cells[i].textContent = formatearNumero(valores[i - inicio]);
    }
  };

  /**
   * Suma m├║ltiples listas de valores num├®ricos columna por columna
   *
   * Ejemplo: Si tienes 3 filas con valores [10, 20, 30] cada una,
   * esta funci├│n retorna [30, 60, 90] (suma vertical por columna)
   *
   * @param {Array<Array<number>>} listas - Array de arrays con valores num├®ricos
   * @param {number} longitud - Cantidad de columnas esperadas
   * @returns {Array<number>} Array con la suma de cada columna
   */
  const sumarListas = (listas = [], longitud = 0) => {
    const resultado = Array.from({ length: longitud }, () => 0);
    listas.forEach((lista) => {
      lista.forEach((valor, indice) => {
        resultado[indice] += Number(valor) || 0;
      });
    });
    return resultado;
  };

  /**
   * Recalcula las sumas de todas las secciones del m├│dulo
   *
   * Esta funci├│n realiza DOS tipos de suma:
   *
   * 1. SUMA DE SECCI├ôN (sum-row):
   *    - Suma verticalmente todas las cuentas dentro de una secci├│n
   *    - Ejemplo: Si una secci├│n tiene cuentas con presupuestos [100, 200, 300]
   *      la fila sum-row mostrar├í 600
   *
   * 2. SUMA DE VARIAS SECCIONES (sumavarios):
   *    - Agrupa secciones que tienen el mismo sumRowSumavariosTexto
   *    - Suma los sum-row de todas esas secciones
   *    - Ejemplo: Si 3 secciones tienen sum-row [100], [200], [300]
   *      y todas est├ín agrupadas bajo "GASTOS TOTALES",
   *      la fila sumavarios mostrar├í 600
   *
   * El proceso es:
   * - Para cada secci├│n, extrae valores de todas sus filas (cuentas)
   * - Suma esos valores columna por columna usando sumarListas()
   * - Guarda el resultado en seccion.sumValues
   * - Actualiza la fila sum-row en el DOM
   * - Luego agrupa todas las secciones por sumRowSumavariosTexto
   * - Suma los sumValues de secciones agrupadas
   * - Actualiza las filas sumavarios en el DOM
   */
  const descripcionUtilidadCambiaria = (fila) =>
    normalizarTexto(obtenerTextoCeldaDescripcion(fila)) ===
    "UTILIDAD CAMBIARIA";

  const recalcularSumas = () => {
    const meta = estadoModulo.sumas;
    if (
      !meta ||
      !Array.isArray(meta.secciones) ||
      meta.secciones.length === 0
    ) {
      if (!meta || !meta.secciones)
        console.warn("ÔÜá´©Å recalcularSumas: sin meta.secciones");
      return;
    }

    // Obtener todas las columnas ordenadas por su posici├│n (excepto 'year')
    const clavesOrdenadas = Object.entries(estadoModulo.columnas || {})
      .sort((a, b) => a[1] - b[1])
      .map(([clave]) => clave)
      .filter((clave) => clave !== "year");
    const longitud = clavesOrdenadas.length;
    if (!longitud) {
      console.warn("ÔÜá´©Å recalcularSumas: sin columnas v├ílidas");
      return;
    }
    const secciones = meta.secciones;

    const errores = [];
    const moduloActual = (
      estadoModulo.moduloClave ||
      estadoModulo.moduloId ||
      ""
    ).toLowerCase();
    const aplicaFiltro = MODULOS_FILTRA_MESES_REALES.has(moduloActual);

    const periodoVisible = obtenerPeriodoVisible();
    const limitePeriodo =
      aplicaFiltro && esAnioEnCurso() && Number.isInteger(periodoVisible)
        ? periodoVisible
        : null;
    const ajustarPorPeriodo = (valores) => {
      if (limitePeriodo == null) return valores;
      const ajustados = valores.slice();
      const indicesReales = [];
      clavesOrdenadas.forEach((clave, idx) => {
        if (!clave.startsWith("real-")) return;
        const mesClave = clave.replace("real-", "");
        const mesNum = CLAVE_MES_A_PERIODO.get(mesClave) || null;
        if (mesNum && mesNum > limitePeriodo) {
          ajustados[idx] = 0;
        }
        if (mesNum) {
          indicesReales.push({ idx, mesNum });
        }
      });
      const totalRealIdx = clavesOrdenadas.indexOf("total-real");
      if (totalRealIdx >= 0 && indicesReales.length) {
        const suma = indicesReales
          .filter(({ mesNum }) => mesNum <= limitePeriodo)
          .reduce((acc, { idx }) => acc + (Number(ajustados[idx]) || 0), 0);
        ajustados[totalRealIdx] = suma;
      }
      return ajustados;
    };

    // PASO 1: Calcular sum-row para cada secci├│n (suma vertical de todas las cuentas)
    secciones.forEach((seccion, idxSeccion) => {
      try {
        if (!seccion || !Array.isArray(seccion.filasCuenta)) {
          errores.push(`Secci├│n inv├ílida en ├¡ndice ${idxSeccion}`);
          seccion.sumValues = Array.from({ length: longitud }, () => 0);
          return;
        }

        // Extraer valores de cada fila de cuenta en la secci├│n
        const listas = seccion.filasCuenta.map((fila) => {
          if (!fila || !fila.dataset)
            return Array.from({ length: longitud }, () => 0);
          const cuenta = fila.dataset.cuenta21 || "";
          const factorCuenta = Number.isFinite(
            Number(fila.dataset.operacionFactor)
          )
            ? Number(fila.dataset.operacionFactor)
            : 1;
          const almacenados = estadoModulo.valoresPorCuenta?.get(cuenta);
          let valoresBase = almacenados
            ? clavesOrdenadas.map((clave) => almacenados[clave] ?? 0)
            : extraerValoresNumericos(fila);
          valoresBase = ajustarPorPeriodo(valoresBase);
          const valoresAjustados =
            seccion.restarUtilidadCambiaria &&
            descripcionUtilidadCambiaria(fila)
              ? valoresBase.map((valor) => (Number(valor) || 0) * -1)
              : valoresBase;
          return valoresAjustados.map(
            (valor) => (Number(valor) || 0) * factorCuenta
          );
        });

        // Sumar todas las filas columna por columna
        const valores = sumarListas(listas, longitud);
        // Recalcular total-real con la suma de todos los month-real visibles de la secci┬ón
        const idxTotalReal = clavesOrdenadas.indexOf("total-real");
        if (idxTotalReal >= 0) {
          const sumaReal = clavesOrdenadas.reduce((acc, clave, idx) => {
            if (!clave.startsWith("real-")) return acc;
            return acc + (Number(valores[idx]) || 0);
          }, 0);
          valores[idxTotalReal] = sumaReal;
        }
        seccion.sumValues = valores;

        // Actualizar la fila sum-row en el DOM
        if (seccion.elementos?.sumRow && seccion.elementos.sumRow.parentNode) {
          asignarValoresNumericos(seccion.elementos.sumRow, valores);
        } else {
          console.warn(
            `ÔÜá´©Å Secci├│n ${
              seccion.seccion || idxSeccion
            }: sumRow no presente en DOM`
          );
        }
      } catch (err) {
        errores.push(
          `Error sumando secci├│n ${idxSeccion}: ${err?.message || err}`
        );
      }
    });
    if (errores.length) console.warn("ÔÜá´©Å Errores en recalcularSumas:", errores);

    // PASO 2: Calcular sumavarios (suma de sum-rows agrupados por etiqueta)
    try {
      const acumuladosSumavarios = new Map();
      const obtenerCeros = () => Array.from({ length: longitud }, () => 0);

      const acumularEnClave = (clave, seccion) => {
        if (!clave) return;
        const prev = acumuladosSumavarios.get(clave) || obtenerCeros();
        const factor = Number.isFinite(seccion.factor) ? seccion.factor : 1;
        const origen = seccion.sumValues || obtenerCeros();
        origen.forEach((valor, idx) => {
          prev[idx] += (Number(valor) || 0) * factor;
        });
        acumuladosSumavarios.set(clave, prev);
      };

      // Agrupar secciones por sus etiquetas sumavarios (incluye sumRowSumavarios y sumRowSumavarios2)
      secciones.forEach((seccion) => {
        const esAdmin = /ADMIN/i.test(
          normalizarTexto(seccion.tituloVisible || seccion.seccion || "")
        );
        if (esAdmin) return; // no contar admin en el resultado operativo
        const claves = [
          normalizarClave(seccion.sumRowSumavariosTexto),
          normalizarClave(seccion.sumRowSumavarios2Texto),
        ].filter(Boolean);
        if (!claves.length) return;
        Array.from(new Set(claves)).forEach((clave) =>
          acumularEnClave(clave, seccion)
        );
      });

      // Actualizar filas sumavarios en el DOM
      secciones.forEach((seccion) => {
        const clavePreferida =
          normalizarClave(seccion.sumRowSumavariosTexto) ||
          normalizarClave(seccion.sumRowSumavarios2Texto);
        if (!clavePreferida) return;
        const valores =
          acumuladosSumavarios.get(clavePreferida) || obtenerCeros();
        seccion.sumavariosValues = valores;
      });
      meta.sumavariosRows?.forEach((fila, clave) => {
        try {
          const valores = acumuladosSumavarios.get(clave) || obtenerCeros();
          if (fila && fila.parentNode) asignarValoresNumericos(fila, valores);
        } catch (e) {
          console.warn("?? Error asignando sumavarios a fila:", e);
        }
      });
    } catch (e) {
      console.warn("?? Error en fase sumavarios:", e);
    }

    // PASO 2.4: Gastos Generales - Otros Ingresos vs Gastos
    try {
      if (moduloActual === "gastosgenerales") {
        const claveOtrosVs = normalizarTexto("OTROS INGRESOS VS GASTOS");
        const esOtrosIngresos = (seccion) => {
          const texto = normalizarTexto(
            seccion?.tituloVisible || seccion?.seccion || ""
          );
          const sumRowTexto = normalizarTexto(seccion?.sumRowTexto || "");
          return (
            /OTROS\s+INGRESOS/i.test(texto) ||
            /OTROS\s+INGRESOS/i.test(sumRowTexto)
          );
        };
        const esGastosFinancieros = (seccion) => {
          const texto = normalizarTexto(
            seccion?.tituloVisible || seccion?.seccion || ""
          );
          const sumRowTexto = normalizarTexto(seccion?.sumRowTexto || "");
          return (
            /GASTOS\s+FINANCIEROS/i.test(texto) ||
            /GASTOS\s+FINANCIEROS/i.test(sumRowTexto)
          );
        };

        const seccionIngresos = secciones.find(esOtrosIngresos);
        const seccionGastosFin = secciones.find(esGastosFinancieros);
        const filaOtrosVs = meta.sumavariosRows?.get(claveOtrosVs) || null;
        if (
          seccionIngresos?.sumValues &&
          seccionGastosFin?.sumValues &&
          filaOtrosVs &&
          filaOtrosVs.parentNode
        ) {
          const valoresIngresos = seccionIngresos.sumValues;
          const valoresGastos = seccionGastosFin.sumValues;
          const valoresNetos = valoresIngresos.map(
            (valor, idx) => (Number(valor) || 0) - (Number(valoresGastos[idx]) || 0)
          );
          asignarValoresNumericos(filaOtrosVs, valoresNetos);
        }
      }
    } catch (e) {
      console.warn("?? Error ajustando Gastos Financieros:", e);
    }

    // PASO 2.4.1: Presupuestos CDMX - sumas por rango de cuentas
    try {
      if (
        moduloActual === "presupuestos" &&
        normalizarTexto(estadoModulo.capitulo) === "CIUDAD DE MEXICO"
      ) {
        const claveIng = normalizarTexto("SUMA DE INGRESOS CDMX");
        const claveGas = normalizarTexto("SUMA DE GASTOS CDMX");
        const claveRes = normalizarTexto("RESULTADO OPERATIVO CDMX");
        const filaIng = meta.sumavariosRows?.get(claveIng) || null;
        const filaGas = meta.sumavariosRows?.get(claveGas) || null;
        const filaRes = meta.resultRows?.get(claveRes) || null;

        const obtenerPrefijo = (fila) => {
          const raw =
            fila?.dataset?.cuenta ||
            fila?.dataset?.cuenta21 ||
            fila?.dataset?.cuentaVisible ||
            "";
          const base = raw.toString().replace(/[^0-9]/g, "");
          return base.slice(0, 3);
        };

        const obtenerValoresCuenta = (fila) => {
          const cuenta21 = fila?.dataset?.cuenta21 || "";
          const almacenados = estadoModulo.valoresPorCuenta?.get(cuenta21);
          const valoresBase = almacenados
            ? clavesOrdenadas.map((clave) => almacenados[clave] ?? 0)
            : extraerValoresNumericos(fila);
          return ajustarPorPeriodo(valoresBase).map((v) => Number(v) || 0);
        };

        const acumuladorIngresos = Array.from({ length: longitud }, () => 0);
        const acumuladorGastos = Array.from({ length: longitud }, () => 0);

        secciones.forEach((seccion) => {
          (seccion.filasCuenta || []).forEach((fila) => {
            const prefijo = Number(obtenerPrefijo(fila));
            if (!prefijo) return;
            const valores = obtenerValoresCuenta(fila);
            if (prefijo >= 400 && prefijo < 450) {
              valores.forEach((valor, idx) => {
                acumuladorIngresos[idx] += valor;
              });
            } else if (prefijo >= 500 && prefijo < 950) {
              valores.forEach((valor, idx) => {
                acumuladorGastos[idx] += valor;
              });
            }
          });
        });

        if (filaIng && filaIng.parentNode) {
          asignarValoresNumericos(filaIng, acumuladorIngresos);
        }
        if (filaGas && filaGas.parentNode) {
          asignarValoresNumericos(filaGas, acumuladorGastos);
        }
        if (filaRes && filaRes.parentNode) {
          const resultado = acumuladorIngresos.map(
            (valor, idx) => valor - (acumuladorGastos[idx] || 0)
          );
          asignarValoresNumericos(filaRes, resultado);
        }
      }
    } catch (e) {
      console.warn("?? Error calculando sumas CDMX Presupuestos:", e);
    }

    // PASO 2.5: Resultado Operativo por nombre (ingresos - gastos)
    try {
      const operaciones = estadoModulo.operacionesResultadoOperativo;
      if (operaciones && operaciones.size) {
        const cacheValores = new Map();
        const obtenerValoresCuenta = (cuenta21) => {
          if (!cuenta21) return Array.from({ length: longitud }, () => 0);
          if (cacheValores.has(cuenta21)) return cacheValores.get(cuenta21);
          const almacenados =
            estadoModulo.valoresPorCuenta?.get(cuenta21) || {};
          const valoresBase = clavesOrdenadas.map(
            (clave) => almacenados[clave] ?? 0
          );
          const ajustados = ajustarPorPeriodo(valoresBase);
          cacheValores.set(cuenta21, ajustados);
          return ajustados;
        };

        operaciones.forEach((info) => {
          const fila = info?.fila;
          const terminos = Array.isArray(info?.terminos) ? info.terminos : [];
          if (!fila || !fila.parentNode || !terminos.length) return;
          const acumulado = Array.from({ length: longitud }, () => 0);
          terminos.forEach((termino) => {
            const cuenta21 = termino?.cuenta21 || "";
            const signo = Number(termino?.signo) || 0;
            if (!cuenta21 || !signo) return;
            const valoresCuenta = obtenerValoresCuenta(cuenta21);
            valoresCuenta.forEach((valor, idx) => {
              acumulado[idx] += (Number(valor) || 0) * signo;
            });
          });
          asignarValoresNumericos(fila, acumulado);
        });
      }
    } catch (e) {
      console.warn("?? Error en fase resultado operativo por nombre:", e);
    }

    // result-row: suma solamente los sum-row de todas las secciones con la misma etiqueta de resultado
    // Aplicar factor por secci├│n (ingresos = +1, gastos = -1 o user-defined operacionFactor)
    try {
      const acumuladosResultado = new Map();
      secciones.forEach((seccion) => {
        const clave = normalizarClave(seccion.resultRowTexto);
        if (!clave) return;
        const origen =
          seccion.sumValues || Array.from({ length: longitud }, () => 0);
        const factor = Number.isFinite(seccion.factor) ? seccion.factor : 1;
        const prev =
          acumuladosResultado.get(clave) ||
          Array.from({ length: longitud }, () => 0);
        origen.forEach((valor, idx) => {
          prev[idx] += (Number(valor) || 0) * factor;
        });
        acumuladosResultado.set(clave, prev);
      });

      if (moduloActual === "gastosgenerales") {
        const capitulo = normalizarTexto(estadoModulo.capitulo || "");
        const obtenerSeccion = (regex) =>
          secciones.find((seccion) => {
            const texto = normalizarTexto(
              seccion?.tituloVisible || seccion?.seccion || ""
            );
            return regex.test(texto);
          }) || null;
        const valoresSeccion = (seccion) =>
          seccion?.sumValues || Array.from({ length: longitud }, () => 0);

        const seccionOtros = obtenerSeccion(/OTROS\s+INGRESOS/i);
        const seccionGastosFin = obtenerSeccion(/GASTOS\s+FINANCIEROS/i);
        const seccionGastosGen = obtenerSeccion(/GASTOS\s+GENERALES/i);
        const seccionDep = obtenerSeccion(/DEPRECIACIONES/i);
        const seccionGaCap = obtenerSeccion(/GA\s+CAPITULO/i);
        const seccionCorpCdMx = obtenerSeccion(/GASTOS\s+CORPORATIVOS\s+CDMX/i);
        const seccionMember = obtenerSeccion(/MEMBER\s+CENTRICITY/i);

        const valoresOtros = valoresSeccion(seccionOtros);
        const valoresGastosFin = valoresSeccion(seccionGastosFin);
        const otrosVs = valoresOtros.map(
          (valor, idx) => (Number(valor) || 0) - (Number(valoresGastosFin[idx]) || 0)
        );

        const valoresGastosGen = valoresSeccion(seccionGastosGen);
        const valoresDep = valoresSeccion(seccionDep);

        if (capitulo === "CIUDAD DE MEXICO") {
          const valoresCorp = valoresSeccion(seccionCorpCdMx);
          const valoresMember = valoresSeccion(seccionMember);
          const totalCdmx = otrosVs.map((valor, idx) =>
            (Number(valor) || 0) -
            (Number(valoresGastosGen[idx]) || 0) -
            (Number(valoresDep[idx]) || 0) -
            (Number(valoresCorp[idx]) || 0) -
            (Number(valoresMember[idx]) || 0)
          );
          acumuladosResultado.set(normalizarTexto("Total GA CdMx"), totalCdmx);
        } else if (
          capitulo === "GUADALAJARA" ||
          capitulo === "NORESTE" ||
          capitulo === "NOROESTE"
        ) {
          const valoresGaCap = valoresSeccion(seccionGaCap);
          const total = otrosVs.map((valor, idx) =>
            (Number(valor) || 0) -
            (Number(valoresGastosGen[idx]) || 0) -
            (Number(valoresDep[idx]) || 0) -
            (Number(valoresGaCap[idx]) || 0)
          );
          acumuladosResultado.set(normalizarTexto("Total"), total);
        }
      }

      meta.resultRows?.forEach((fila, clave) => {
        try {
          const valores =
            acumuladosResultado.get(clave) ||
            Array.from({ length: longitud }, () => 0);
          if (fila && fila.parentNode) asignarValoresNumericos(fila, valores);
        } catch (e) {
          console.warn("?? Error asignando result-row:", e);
        }
      });
    } catch (e) {
      console.warn("?? Error en fase resultado:", e);
    }
  };

  const manejarCambioCuenta = (fila, celda) => {
    if (!fila || !celda) return;
    const texto = (celda.textContent || "").trim();
    const nuevaCuenta21 = convertirCuenta21(texto);
    const cuentaAnterior = fila.dataset.cuenta21 || "";
    const valoresPrevios =
      estadoModulo.valoresPorCuenta.get(cuentaAnterior) || {};
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
      celda.dataset.bsToggle = "tooltip";
      celda.dataset.bsPlacement = "top";
    } else {
      celda.title = "";
      celda.removeAttribute("data-bs-toggle");
      celda.removeAttribute("data-bs-placement");
    }
    recalcularTotalesFilaPresupuesto(fila);
    recalcularSumas();
    // NO persistir autom├íticamente - el usuario debe guardar expl├¡citamente
    estadoModulo.layoutModificado = true;
    estadoModulo.hayCambios = true;
    notificarCambios();
  };

  const manejarCambioNombre = (fila, celda) => {
    if (!fila || !celda) return;
    const nombre = (celda.textContent || "").trim();
    const cuenta = fila.dataset.cuenta21 || "";
    if (cuenta) {
      estadoModulo.nombresPorCuenta.set(cuenta, nombre);
    }
    // NO persistir autom├íticamente - el usuario debe guardar expl├¡citamente
    estadoModulo.layoutModificado = true;
    estadoModulo.hayCambios = true;
    notificarCambios();
  };

  const resaltarCeldaPresupuesto = (celda) => {
    if (!celda) return;
    if (celda.dataset.originalBgColor === undefined) {
      celda.dataset.originalBgColor = celda.style.backgroundColor || "";
    }
    celda.classList.add("cell-modified");
    celda.dataset.valorModificado = "true";
    celda.style.backgroundColor = "#fff4cc";
  };

  const limpiarResaltadoCeldaPresupuesto = (celda) => {
    if (!celda) return;
    celda.classList.remove("cell-modified");
    delete celda.dataset.valorModificado;
    if (celda.dataset.originalBgColor !== undefined) {
      celda.style.backgroundColor = celda.dataset.originalBgColor;
    } else {
      celda.style.backgroundColor = "";
    }
  };

  const actualizarPresupuestoCelda = (fila, clave, celda) => {
    if (!fila || !clave || !celda) return;
    const cuenta = fila.dataset.cuenta21 || "";
    const almacen = estadoModulo.valoresPorCuenta.get(cuenta) || {};
    const previo = Object.prototype.hasOwnProperty.call(almacen, clave)
      ? Number(almacen[clave])
      : null;
    const valor = parsearNumero(celda.textContent);
    almacen[clave] = valor;
    estadoModulo.valoresPorCuenta.set(cuenta, almacen);
    celda.textContent = formatearNumero(valor);
    if (previo == null || Math.abs(previo - valor) > 0.0001) {
      resaltarCeldaPresupuesto(celda);
    } else {
      limpiarResaltadoCeldaPresupuesto(celda);
    }
    recalcularTotalesFilaPresupuesto(fila);
    recalcularSumas();
    estadoModulo.hayCambios = true;
    notificarCambios();
  };

  const sincronizarColumnasClaves = () => {
    if (!estadoModulo.tabla) return;
    const reverse = invertirColumnas();
    obtenerFilasCuenta().forEach((fila) => {
      Array.from(fila.cells).forEach((celda, idx) => {
        const clave = reverse[idx];
        if (esClaveBudget(clave)) {
          celda.dataset.columnaClave = clave;
        } else if (idx === 0 && !celda.dataset.columnaClave) {
          celda.dataset.columnaClave = "cuenta";
        } else if (idx === 1 && !celda.dataset.columnaClave) {
          celda.dataset.columnaClave = "descripcion";
        }
      });
    });
  };

  const limpiarModoEdicionEnTabla = () => {
    if (!estadoModulo.tabla) return;
    ocultarColumnasReal(false);
    aplicarFiltroColumnasPorPeriodo();
    obtenerFilasCuenta().forEach((fila) => {
      Array.from(fila.cells).forEach((celda) => {
        celda.contentEditable = "false";
        if (celda.dataset.editable) {
          delete celda.dataset.editable;
        }
        delete celda.dataset.listenersBound;
      });
    });
    estadoModulo.tabla.classList.remove("modo-edicion");
  };

  const aplicarModoEdicionEnTabla = () => {
    if (!estadoModulo.tabla) return;
    sincronizarColumnasClaves();
    if (!estadoModulo.editMode) {
      limpiarModoEdicionEnTabla();
      return;
    }
    estadoModulo.tabla.classList.add("modo-edicion");
    ocultarColumnasReal(true);
    const reverse = invertirColumnas();
    const filas = obtenerFilasCuenta();
    const esPlantillas = window.location.pathname.includes("plantillas.html");

    const obtenerCeldasEditablesFila = (fila) =>
      Array.from(fila.cells).filter((celda) => celda.dataset.editable);
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
      if (direccion === "arriba" && filaIndex > 0) {
        const target = filasEdit[filaIndex - 1].cells[colIndex];
        if (target?.dataset.editable) enfocarCelda(target);
      } else if (direccion === "abajo" && filaIndex < filasEdit.length - 1) {
        const target = filasEdit[filaIndex + 1].cells[colIndex];
        if (target?.dataset.editable) enfocarCelda(target);
      } else if (direccion === "izquierda") {
        const editables = obtenerCeldasEditablesFila(fila);
        const idx = editables.indexOf(celdaActual);
        if (idx > 0) enfocarCelda(editables[idx - 1]);
      } else if (direccion === "derecha") {
        const editables = obtenerCeldasEditablesFila(fila);
        const idx = editables.indexOf(celdaActual);
        if (idx >= 0 && idx < editables.length - 1)
          enfocarCelda(editables[idx + 1]);
      }
    };

    const obtenerCeldaVecinaEditable = (celdaActual, direccion) => {
      if (!celdaActual) return null;
      const fila = celdaActual.parentElement;
      const filasEdit = obtenerFilasCuenta();
      const filaIndex = filasEdit.indexOf(fila);
      const colIndex = Array.from(fila.cells).indexOf(celdaActual);
      if (filaIndex < 0 || colIndex < 0) return null;

      if (direccion === "arriba" && filaIndex > 0) {
        const target = filasEdit[filaIndex - 1].cells[colIndex];
        return target?.dataset.editable ? target : null;
      }
      if (direccion === "abajo" && filaIndex < filasEdit.length - 1) {
        const target = filasEdit[filaIndex + 1].cells[colIndex];
        return target?.dataset.editable ? target : null;
      }
      if (direccion === "izquierda" || direccion === "derecha") {
        const editables = obtenerCeldasEditablesFila(fila);
        const idx = editables.indexOf(celdaActual);
        if (idx < 0) return null;
        const paso = direccion === "izquierda" ? -1 : 1;
        const target = editables[idx + paso];
        return target || null;
      }
      return null;
    };

    const copiarEnDireccion = (celdaActual, direccion, hastaFinal) => {
      if (!celdaActual || !celdaActual.dataset.editable) return;
      const tipo = celdaActual.dataset.editable;
      const valor = celdaActual.textContent || "";
      let actual = celdaActual;
      let destino = obtenerCeldaVecinaEditable(actual, direccion);
      let ultimo = null;

      while (destino) {
        if (destino.dataset.editable !== tipo) break;
        destino.textContent = valor;
        if (tipo === "budget") {
          actualizarPresupuestoCelda(
            destino.parentElement,
            destino.dataset.columnaClave,
            destino
          );
        } else if (tipo === "cuenta") {
          manejarCambioCuenta(destino.parentElement, destino);
        } else if (tipo === "nombre") {
          manejarCambioNombre(destino.parentElement, destino);
        }
        ultimo = destino;
        if (!hastaFinal) break;
        actual = destino;
        destino = obtenerCeldaVecinaEditable(actual, direccion);
      }

      if (ultimo) {
        enfocarCelda(ultimo);
      }
    };

    filas.forEach((fila) => {
      const celdaCuenta = fila.cells[0];
      const celdaNombre = fila.cells[1];
      // CR├ìTICO: Usar flag listenersBound para evitar agregar listeners m├║ltiples veces
      if (
        celdaCuenta &&
        !celdaCuenta.dataset.editable &&
        !celdaCuenta.dataset.listenersBound &&
        esPlantillas
      ) {
        celdaCuenta.contentEditable = "true";
        celdaCuenta.dataset.editable = "cuenta";
        celdaCuenta.dataset.listenersBound = "true";
        celdaCuenta.addEventListener("blur", () => {
          manejarCambioCuenta(fila, celdaCuenta);
          setTimeout(() => ocultarSugerencias(), 150);
        });
        celdaCuenta.addEventListener("keydown", (evt) => {
          const accel = evt.ctrlKey || evt.metaKey;
          if (accel && !evt.altKey) {
            const key = (evt.key || "").toLowerCase();
            if (key === "d") {
              evt.preventDefault();
              copiarEnDireccion(celdaCuenta, "abajo", evt.shiftKey);
              return;
            }
            if (key === "r") {
              evt.preventDefault();
              copiarEnDireccion(celdaCuenta, "derecha", evt.shiftKey);
              return;
            }
          }
          if (evt.key === "Enter") {
            evt.preventDefault();
            celdaCuenta.blur();
          } else if (evt.key === "Tab") {
            evt.preventDefault();
            moverFocus(celdaCuenta, evt.shiftKey ? "izquierda" : "derecha");
          } else if (evt.key === "ArrowRight") {
            evt.preventDefault();
            moverFocus(celdaCuenta, "derecha");
          } else if (evt.key === "ArrowDown") {
            evt.preventDefault();
            moverFocus(celdaCuenta, "abajo");
          } else if (evt.key === "ArrowUp") {
            evt.preventDefault();
            moverFocus(celdaCuenta, "arriba");
          }
        });
        celdaCuenta.addEventListener("input", () =>
          mostrarSugerenciasCuenta(celdaCuenta, celdaCuenta.textContent)
        );
        celdaCuenta.addEventListener("focus", () =>
          mostrarSugerenciasCuenta(celdaCuenta, celdaCuenta.textContent)
        );
      }
      if (
        celdaNombre &&
        !celdaNombre.dataset.editable &&
        !celdaNombre.dataset.listenersBound &&
        esPlantillas
      ) {
        celdaNombre.contentEditable = "true";
        celdaNombre.dataset.editable = "nombre";
        celdaNombre.dataset.listenersBound = "true";
        celdaNombre.addEventListener("blur", () =>
          manejarCambioNombre(fila, celdaNombre)
        );
        celdaNombre.addEventListener("keydown", (evt) => {
          const accel = evt.ctrlKey || evt.metaKey;
          if (accel && !evt.altKey) {
            const key = (evt.key || "").toLowerCase();
            if (key === "d") {
              evt.preventDefault();
              copiarEnDireccion(celdaNombre, "abajo", evt.shiftKey);
              return;
            }
            if (key === "r") {
              evt.preventDefault();
              copiarEnDireccion(celdaNombre, "derecha", evt.shiftKey);
              return;
            }
          }
          if (evt.key === "Enter") {
            evt.preventDefault();
            celdaNombre.blur();
          } else if (evt.key === "Tab") {
            evt.preventDefault();
            moverFocus(celdaNombre, evt.shiftKey ? "izquierda" : "derecha");
          } else if (evt.key === "ArrowLeft") {
            evt.preventDefault();
            moverFocus(celdaNombre, "izquierda");
          } else if (evt.key === "ArrowRight") {
            evt.preventDefault();
            moverFocus(celdaNombre, "derecha");
          } else if (evt.key === "ArrowDown") {
            evt.preventDefault();
            moverFocus(celdaNombre, "abajo");
          } else if (evt.key === "ArrowUp") {
            evt.preventDefault();
            moverFocus(celdaNombre, "arriba");
          }
        });
      }
      Array.from(fila.cells).forEach((celda, idx) => {
        const clave = reverse[idx];
        if (!esClaveBudget(clave)) return;
        // CR├ìTICO: Verificar ambos flags para evitar duplicados
        if (celda.dataset.editable || celda.dataset.listenersBound) return;
        celda.contentEditable = "true";
        celda.dataset.editable = "budget";
        celda.dataset.columnaClave = clave;
        celda.dataset.listenersBound = "true";
        celda.addEventListener("blur", () =>
          actualizarPresupuestoCelda(fila, clave, celda)
        );
        celda.addEventListener("keydown", (evt) => {
          const accel = evt.ctrlKey || evt.metaKey;
          if (accel && !evt.altKey) {
            const key = (evt.key || "").toLowerCase();
            if (key === "d") {
              evt.preventDefault();
              copiarEnDireccion(celda, "abajo", evt.shiftKey);
              return;
            }
            if (key === "r") {
              evt.preventDefault();
              copiarEnDireccion(celda, "derecha", evt.shiftKey);
              return;
            }
          }
          if (evt.key === "Enter") {
            evt.preventDefault();
            celda.blur();
          } else if (evt.key === "Tab") {
            evt.preventDefault();
            moverFocus(celda, evt.shiftKey ? "izquierda" : "derecha");
          } else if (evt.key === "ArrowLeft") {
            evt.preventDefault();
            moverFocus(celda, "izquierda");
          } else if (evt.key === "ArrowRight") {
            evt.preventDefault();
            moverFocus(celda, "derecha");
          } else if (evt.key === "ArrowDown") {
            evt.preventDefault();
            moverFocus(celda, "abajo");
          } else if (evt.key === "ArrowUp") {
            evt.preventDefault();
            moverFocus(celda, "arriba");
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
    estadoModulo.layoutSnapshot = capturarLayoutDesdeTabla();
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
    aplicarFiltroColumnasPorPeriodo();
    notificarCambios();
    ocultarMenuContextual();
    const empresa = Sesion.obtenerEmpresaActiva();
    if (
      estadoModulo.layoutSnapshot &&
      empresa?.id &&
      Number.isInteger(estadoModulo.anio)
    ) {
      renderizarTabla({
        moduloId: estadoModulo.moduloId,
        tablaSelector: estadoModulo.tabla
          ? `#${estadoModulo.tabla.id}`
          : undefined,
        totalColumnas: estadoModulo.tabla
          ? contarColumnas(estadoModulo.tabla)
          : undefined,
      });
    }
  };

  const finalizarEdicion = () => {
    if (!estadoModulo.editMode) return;
    estadoModulo.editMode = false;
    aplicarModoEdicionEnTabla();
    ocultarMenuContextual();
  };

  const obtenerHojaDatos = (nombre, dataset) => {
    if (!nombre || !dataset) {
      return null;
    }
    const buscarClave = (clave) =>
      clave && Object.hasOwn(dataset, clave) ? dataset[clave] : null;
    const nombreSeguro = nombre.includes("&")
      ? nombre.replace(/&/g, "&amp;")
      : nombre;
    const identificador = normalizarSheetId(nombreSeguro);
    if (identificador) {
      const coincidencias = Object.keys(dataset).filter(
        (clave) => normalizarSheetId(clave) === identificador
      );
      if (coincidencias.length) {
        const combinadas = [];
        coincidencias.forEach((clave) => {
          const registros = dataset[clave];
          if (Array.isArray(registros)) {
            combinadas.push(...registros);
          }
        });
        if (combinadas.length) {
          return combinadas;
        }
      }
    }
    const directoSeguro = buscarClave(nombreSeguro);
    if (directoSeguro) {
      return directoSeguro;
    }
    const directo = buscarClave(nombre);
    if (directo) {
      return directo;
    }
    return null;
  };

  /**
   * Funci├│n principal que renderiza/pinta la tabla completa de un m├│dulo
   *
   * Esta es la funci├│n maestra que coordina todo el proceso de renderizado:
   *
   * FLUJO DE RENDERIZADO:
   * 1. Validaci├│n inicial: verifica que exista tabla y tbody
   * 2. Configuraci├│n de m├│dulo: identifica qu├® m├│dulo renderizar (Finanzas, Direcci├│n, etc.)
   * 3. Carga de datos: obtiene cuentas desde SQLite (layouts) o Firebird (Presupuestos)
   * 4. Filtrado: filtra cuentas por capitulo/empresa seleccionada
   * 5. Layout personalizado: usa layout guardado en SQLite (secciones/operaciones)
   * 6. Renderizado de secciones: llama a renderizarSecciones() para crear filas
   * 7. Filas de suma: agrega sum-row, sumavarios, result-row seg├║n configuraci├│n
   * 8. Carga de valores: obtiene datos de Firebird para llenar las celdas
   * 9. Rec├ílculo: ejecuta recalcularSumas() para actualizar totales
   *
   * TIPOS DE FILA:
   * - fila-cuenta: Fila normal con datos de una cuenta contable
   * - sum-row: Suma de todas las cuentas de una secci├│n
   * - sum-row-sumavarios: Suma de varios sum-rows agrupados
   * - result-row: Resultado final (ej: "Resultado Presupuestos")
   *
   * @param {Object} opciones - Configuraci├│n de renderizado
   * @param {string} opciones.tablaSelector - Selector CSS de la tabla
   * @param {number} opciones.totalColumnas - N├║mero total de columnas
   * @param {string} opciones.moduloId - ID del m├│dulo a renderizar
   * @param {string} opciones.sheet - Hoja de datos a usar
   * @returns {Promise<boolean>} true si renderiz├│ exitosamente, false si fall├│
   */
  const renderizarTabla = async (opciones = {}) => {
    const tabla = obtenerTabla(opciones.tablaSelector);
    const cuerpo = tabla?.querySelector("tbody");
    if (!tabla || !cuerpo) {
      return Promise.resolve(false);
    }
    estadoModulo.editMode = false;
    estadoModulo.hayCambios = false;
    estadoModulo.editSnapshot = null;
    estadoModulo.layoutSnapshot = null;
    destruirTooltips();

    const columnas = Number(opciones.totalColumnas) || contarColumnas(tabla);
    const placeholdersPorFila = Math.max(0, columnas - 2);
    estadoModulo.placeholdersPorFila = placeholdersPorFila;

    const { moduloId, moduloSheet, moduloLabel } = obtenerConfigModulo();
    const moduloNormalizado = (opciones.moduloId || moduloId || "")
      .toString()
      .trim();
    const moduloClave = normalizarModuloClave(moduloNormalizado || moduloId);
    const sheetPorConfig = window.CapitulosModulos?.obtenerSheetPorModulo
      ? window.CapitulosModulos.obtenerSheetPorModulo(moduloNormalizado)
      : null;
    const sheetConfigurada =
      opciones.sheet ||
      moduloSheet ||
      sheetPorConfig ||
      moduloLabel ||
      moduloNormalizado;
    const moduloNombre = sheetConfigurada || moduloNormalizado;
    // Asegurar que el módulo quede seteado incluso si se retorna temprano
    estadoModulo.moduloId = moduloNormalizado;
    estadoModulo.moduloClave = moduloClave;
    estadoModulo.sheet = sheetConfigurada || moduloNormalizado;
    limpiarBody(cuerpo);

    const anioSeleccionTemp = obtenerAnioSeleccionado();
    const anioSeleccionado = Number.isInteger(anioSeleccionTemp)
      ? anioSeleccionTemp
      : estadoModulo.anio;
    const empresa = Sesion.obtenerEmpresaActiva();
    const empresaId = empresa?.id;
    const capituloDestino =
      window.CapitulosModulos?.obtenerCapituloPorEmpresa(empresaId) || null;
    const moduloHabilitado = window.CapitulosModulos?.moduloDisponible
      ? window.CapitulosModulos.moduloDisponible(empresaId, moduloNormalizado)
      : true;

    if (!moduloHabilitado) {
      cuerpo.appendChild(
        crearFilaEstado(
          "El capitulo seleccionado no tiene esta vista asignada.",
          columnas
        )
      );
      return Promise.resolve(false);
    }

    let registros = [];
    let sumasPersonalizadas = null;
    let resultadoForzado = "";
    let layoutSqlite = null;

    if (empresaId && Number.isInteger(anioSeleccionado) && capituloDestino) {
      layoutSqlite = await cargarLayoutSqlite({
        modulo: moduloNombre,
        anio: anioSeleccionado,
        capitulo: capituloDestino,
        empresaId,
      });
      if (layoutSqlite) {
        registros = construirRegistrosDesdeLayout(
          layoutSqlite,
          capituloDestino
        ).map((registro) => {
          if (!registro?.cuenta) return registro;
          return {
            ...registro,
            cuenta: corregirCuentaLegible(registro.cuenta, registro),
          };
        });
        estadoModulo.layoutOperaciones = Array.isArray(
          layoutSqlite.operaciones
        )
          ? layoutSqlite.operaciones
          : [];
        sumasPersonalizadas = construirSumasDesdeLayout(layoutSqlite);
        resultadoForzado = layoutSqlite.resultRow || "";
      } else {
        estadoModulo.layoutOperaciones = [];
      }
    } else {
      estadoModulo.layoutOperaciones = [];
    }

    if (
      !registros.length &&
      moduloClave === "presupuestos" &&
      capituloDestino
    ) {
      const anioPresupuesto =
        obtenerAnioSeleccionado() || new Date().getFullYear();
      const cuentasPresupuesto = await cargarCuentasPresupuestos({
        anio: anioPresupuesto,
      });
      const cuentasFiltradas = cuentasPresupuesto.filter((registro) =>
        esCuentaPresupuestoValida(
          registro.cuentaVisible || registro.cuenta21 || registro.cuenta
        )
      );
      if (cuentasFiltradas.length) {
        registros = cuentasFiltradas
          .map((registro) => ({
            capitulo: capituloDestino,
            seccion: obtenerSeccionPresupuesto(
              registro.cuentaVisible || registro.cuenta21 || registro.cuenta
            ),
            cuenta: registro.cuentaVisible || "",
            nombre: registro.nombre || "",
          }))
          .filter((registro) => registro.cuenta);
      }
    }

    if (!registros.length || !capituloDestino) {
      cuerpo.appendChild(
        crearFilaEstado(
          "No hay informacion disponible para esta vista.",
          columnas
        )
      );
      return Promise.resolve(false);
    }
    if (moduloClave === "presupuestos") {
      registros = registros.filter((registro) => {
        if (!registro?.cuenta) return true;
        const nombreRegistro =
          registro.nombre || registro.descripcion || registro.DESCRIPCION || "";
        if (esNombreCuentaPresupuestoOculto(nombreRegistro)) {
          return false;
        }
        return esCuentaPresupuestoValida(registro.cuenta);
      });
      registros = registros.map((registro) => {
        if (!registro?.cuenta) return registro;
        return {
          ...registro,
          seccion: obtenerSeccionPresupuesto(registro.cuenta),
          seccionOriginal: registro.seccion || registro.seccionOriginal,
        };
      });
    }
    compilarCatalogoGlobal(registros);

    if (!registros.length) {
      cuerpo.appendChild(
        crearFilaEstado(
          "El capitulo no tiene cuentas configuradas en el libro.",
          columnas
        )
      );
      return Promise.resolve(false);
    }

    const cuentasCapitulo = registros
      .map((registro) => convertirCuenta21(registro.cuenta || ""))
      .filter(Boolean);
    unificarCuentasDisponibles(
      registros
        .map((registro) => registro.cuenta)
        .filter((cuenta) => (cuenta || "").trim()),
      {
        anio: anioSeleccionado,
      }
    );
    if (empresaId && cuentasCapitulo.length && moduloClave !== "presupuestos") {
      const anioNombres = obtenerAnioSeleccionado() || new Date().getFullYear();
      await cargarNombresCuentas({
        empresaId,
        anio: anioNombres,
        cuentas: cuentasCapitulo,
      });
    }

    estadoModulo.sumas = {
      secciones: [],
      sumavariosRows: new Map(),
      resultRows: new Map(),
    };
    const pendientes = renderizarSecciones({
      registros,
      cuerpo,
      placeholdersPorFila,
      sheetName: sheetConfigurada,
      capitulo: capituloDestino,
      sumasPersonalizadas,
      resultadoForzado,
      mostrarCuentaVisible: moduloClave === "presupuestos",
      moduloClave,
    });
    const tieneSumasPersonalizadas =
      sumasPersonalizadas instanceof Map && sumasPersonalizadas.size > 0;
    if (
      moduloClave === "presupuestos" &&
      pendientes?.sumasSecciones &&
      !tieneSumasPersonalizadas
    ) {
      const claveResultado = normalizarTexto("RESULTADOS PRESUPUESTOS");
      pendientes.sumasSecciones.forEach((seccion) => {
        seccion.resultRowTexto = claveResultado;
      });
      if (!pendientes.resultadoFilas.length) {
        pendientes.resultadoFilas.push({
          texto: "RESULTADOS PRESUPUESTOS",
          clase: "result-row",
        });
      }
    }

    estadoModulo.sumas.sumavariosRows = new Map();
    pendientes.sumavarios.forEach((info, clave) => {
      if (!info?.meta) return;
      // Insertar justo debajo de la secci├│n sobre la que opera
      const filaSumario = agregarFilaResumen({
        texto: info.texto,
        clase: "sum-row-sumavarios",
        cuerpo,
        placeholdersPorFila,
      });
      if (filaSumario) {
        estadoModulo.sumas.sumavariosRows.set(
          normalizarTexto(clave),
          filaSumario
        );
        const referencia =
          info.meta.elementos.sumRow ||
          info.meta.filasCuenta[info.meta.filasCuenta.length - 1] ||
          cuerpo.lastChild;
        if (referencia && referencia.parentNode) {
          referencia.parentNode.insertBefore(
            filaSumario,
            referencia.nextSibling
          );
        }
      }
    });

    if (moduloClave === "gastosgenerales") {
      const claveOtrosVs = normalizarTexto("Otros Ingresos vs Gastos");
      const filaOtrosVs = estadoModulo.sumas.sumavariosRows.get(claveOtrosVs);
      const metaGastosFin = pendientes.sumasSecciones.find((seccion) => {
        const texto = normalizarTexto(
          seccion?.tituloVisible || seccion?.seccion || ""
        );
        return /GASTOS\s+FINANCIEROS/i.test(texto);
      });
      const referencia = metaGastosFin?.elementos?.sumRow || null;
      if (
        filaOtrosVs &&
        referencia &&
        referencia.parentNode === filaOtrosVs.parentNode
      ) {
        referencia.parentNode.insertBefore(filaOtrosVs, referencia.nextSibling);
      }
    }

    if (
      moduloClave === "presupuestos" &&
      normalizarTexto(capituloDestino) === "CIUDAD DE MEXICO"
    ) {
      const sumasCdmx = [
        "SUMA DE INGRESOS CDMX",
        "SUMA DE GASTOS CDMX",
      ];
        sumasCdmx.forEach((label) => {
          const clave = normalizarTexto(label);
          if (estadoModulo.sumas.sumavariosRows.has(clave)) return;
          const fila = agregarFilaResumen({
            texto: label,
            clase: "sum-row-sumavarios",
            cuerpo,
            placeholdersPorFila,
          });
          if (fila) {
            estadoModulo.sumas.sumavariosRows.set(clave, fila);
          }
        });
      }

    const operacionesResultado = construirOperacionesResultadoOperativo({
      registros,
      moduloClave,
    });
    const insertarOperativoAntesDe =
      moduloClave === "comites" || moduloClave === "eventos"
        ? cuerpo.querySelector(
            `tr.section-header-row[data-seccion="${normalizarTexto(
              "Gastos Administrativos"
            )}"]`
          )
        : null;
    estadoModulo.operacionesResultadoOperativo =
      insertarOperacionesResultadoOperativo({
        cuerpo,
        placeholdersPorFila,
        operaciones: operacionesResultado,
        insertBefore: insertarOperativoAntesDe,
      });

    pendientes.resultadoFilas.forEach((fila) => {
      const resultadoFila = agregarFilaResumen({
        texto: fila.texto,
        clase: fila.clase,
        cuerpo,
        placeholdersPorFila,
      });
      if (resultadoFila) {
        estadoModulo.sumas.resultRows.set(
          normalizarTexto(fila.texto),
          resultadoFila
        );
      }
    });

    estadoModulo.sumas.secciones = pendientes.sumasSecciones;
    estadoModulo.capitulo = capituloDestino || "";
    estadoModulo.layoutEsPersonalizado = Boolean(layoutSqlite);
    estadoModulo.layoutActual = construirLayoutDesdeMeta({
      seccionesMeta: pendientes.sumasSecciones,
      resultadoFilas: pendientes.resultadoFilas,
      placeholdersPorFila,
      capitulo: capituloDestino,
    });
    estadoModulo.tabla = tabla;
    estadoModulo.columnas = construirMapaColumnas(tabla);
    aplicarStickyEncabezados();
    // aplicarStickyTotales(); // Deshabilitado: las columnas acumuladas no deben estar congeladas
    estadoModulo.moduloId = moduloNormalizado;
    estadoModulo.moduloClave = moduloClave;
    estadoModulo.sheet = sheetConfigurada;
    if (Number.isInteger(anioSeleccionado)) {
      estadoModulo.anio = anioSeleccionado;
    }
    estadoModulo.mesActualIndex = obtenerIndicePeriodoActual();
    poblarSugerenciasDesdeAnio(estadoModulo.anio);
    cargarCatalogoCompleto({ anio: estadoModulo.anio }).then((lista) =>
      unificarCuentasDisponibles(lista || [], { anio: estadoModulo.anio })
    );
    const anioNombres = obtenerAnioSeleccionado() || new Date().getFullYear();
    if (pendientes.faltantesNombre?.length && empresaId) {
      cargarNombresCuentas({
        empresaId,
        anio: anioNombres,
        cuentas: pendientes.faltantesNombre,
      });
    }
    solicitarDatos();
    activarTooltipsCuentas();
    aplicarModoEdicionEnTabla();
    aplicarFiltroColumnasPorPeriodo();

    // Actualizar SeccionCollapse despu├®s de renderizar la tabla
    if (
      window.SeccionCollapse &&
      typeof window.SeccionCollapse.actualizar === "function"
    ) {
      setTimeout(() => {
        window.SeccionCollapse.actualizar();
      }, 100);
    }

    if (!moduloReadyDispatched) {
      moduloReadyDispatched = true;
      window.dispatchEvent(
        new CustomEvent("modulo:ready", {
          detail: {
            modulo: estadoModulo.moduloClave || estadoModulo.moduloId || "",
            anio: estadoModulo.anio,
          },
        })
      );
    }

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
      const moduloEvento = normalizarModuloClave(evento?.detail?.modulo || "");
      const moduloActual = estadoModulo.moduloClave;
      if (moduloEvento && moduloActual && moduloEvento !== moduloActual) {
        return;
      }
      const anioPrevio = estadoModulo.anio;
      const anioEvento = Number(evento?.detail?.anio);
      let requiereReRender = false;
      if (Number.isInteger(anioEvento)) {
        if (anioPrevio !== anioEvento) {
          requiereReRender = true;
        }
        estadoModulo.anio = anioEvento;
        poblarSugerenciasDesdeAnio(anioEvento);
        // Force update of filters because year change affects visibility (Past vs Present)
        aplicarFiltroColumnasPorPeriodo();
      }
      const periodoEvento = normalizarPeriodo(evento?.detail?.periodo);
      if (periodoEvento != null) {
        estadoModulo.periodoCerrado = periodoEvento;
        estadoModulo.mesActualIndex = obtenerIndicePeriodoActual();
        aplicarFiltroColumnasPorPeriodo();
      }
      if (
        requiereReRender ||
        (!obtenerFilasCuenta().length && Number.isInteger(anioEvento))
      ) {
        ejecutar();
        return;
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
      },
    };
  };

  
  const normalizarCuentaClave = (valor) => {
    if (typeof normalizarCuentaBase === "function") {
      return normalizarCuentaBase(valor);
    }
    return (valor || "")
      .toString()
      .replace(/[^0-9A-Za-z]/g, "")
      .toUpperCase()
      .trim();
  };

  const cargarBorrador = (presupuesto = []) => {
    if (!Array.isArray(presupuesto) || !estadoModulo.tabla) return false;
    if (!estadoModulo.columnas || !Object.keys(estadoModulo.columnas).length) {
      estadoModulo.columnas = construirMapaColumnas(estadoModulo.tabla);
    }
    sincronizarColumnasClaves();

    const filas = obtenerFilasCuenta();
    if (!filas.length) return false;

    const mapaFilas = new Map();
    filas.forEach((fila) => {
      const cuentaFila =
        fila.dataset.cuenta21 ||
        fila.dataset.cuenta ||
        fila.querySelector("[data-cuenta]")?.dataset.cuenta ||
        fila.cells[0]?.textContent ||
        "";
      const claveFila = normalizarCuentaClave(cuentaFila);
      if (claveFila) mapaFilas.set(claveFila, fila);
    });

    let aplicado = false;

    presupuesto.forEach((registro) => {
      if (!registro) return;
      const cuentaRegistro =
        registro.cuenta || registro.numCta || registro.cuenta21 || "";
      const claveRegistro = normalizarCuentaClave(cuentaRegistro);
      if (!claveRegistro) return;

      const fila = mapaFilas.get(claveRegistro);
      if (!fila) return;

      const valores =
        registro.valores && typeof registro.valores === "object"
          ? registro.valores
          : null;
      const cambios = valores ? Object.entries(valores) : [];
      if (!cambios.length && registro.mes) {
        cambios.push([`budget-${registro.mes}`, registro.valor]);
      }
      if (!cambios.length) return;

      const cuentaKey = fila.dataset.cuenta21 || fila.dataset.cuenta || "";
      const almacen = estadoModulo.valoresPorCuenta.get(cuentaKey) || {};

      cambios.forEach(([clave, valor]) => {
        if (!Object.prototype.hasOwnProperty.call(estadoModulo.columnas, clave))
          return;
        const idx = estadoModulo.columnas[clave];
        const celda = fila.cells[idx];
        if (!celda) return;
        const numero = Number(valor);
        const finalValor = Number.isFinite(numero) ? numero : 0;
        celda.textContent = formatearNumero(finalValor);
        almacen[clave] = finalValor;
        resaltarCeldaPresupuesto(celda);
        aplicado = true;
      });

      estadoModulo.valoresPorCuenta.set(cuentaKey, almacen);
      recalcularTotalesFilaPresupuesto(fila);
    });

    if (aplicado) {
      recalcularSumas();
      estadoModulo.hayCambios = true;
      notificarCambios();
    }

    return aplicado;
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
    guardarLayout() {
      return persistirLayoutActual();
    },
    guardarBorradorLocal() {
      return persistirLayoutActual();
    },
    async cargarBorradorLocal() {
      const empresa = Sesion.obtenerEmpresaActiva();
      const anioSeleccionado = Number.isInteger(estadoModulo.anio)
        ? estadoModulo.anio
        : null;
      const capitulo =
        estadoModulo.capitulo ||
        window.CapitulosModulos?.obtenerCapituloPorEmpresa?.(empresa?.id);
      const moduloNombre = obtenerNombreModulo();
      if (
        !empresa?.id ||
        !anioSeleccionado ||
        !estadoModulo.moduloClave ||
        !capitulo ||
        !moduloNombre
      ) {
        return null;
      }
      return cargarLayoutSqlite({
        modulo: moduloNombre,
        anio: anioSeleccionado,
        capitulo,
        empresaId: empresa.id,
      });
    },
    cargarBorrador(presupuesto) {
      return cargarBorrador(presupuesto);
    },
    getCambios() {
      return obtenerCambiosPendientes();
    },
  };
})();
const normalizarCuentaBase = (cuenta) => {
  if (!cuenta) return "";
  return cuenta
    .toString()
    .replace(/[^0-9A-Za-z]/g, "")
    .toUpperCase()
    .trim();
};

const corregirCuentaLegible = (cuenta, meta = {}) => {
  if (!cuenta) return cuenta;
  const base = cuenta.toString().trim();
  const capitulo = (meta?.capitulo || "").toString().trim().toUpperCase();
  const seccion = (meta?.seccion || "").toString().trim().toUpperCase();
  if (
    base === "406-0010-00-00" &&
    capitulo === "NORESTE" &&
    seccion === "BOLETAJE"
  ) {
    return "406-010-000-00";
  }
  return cuenta;
};

const deducirNivel = (baseVisible) => {
  const visible = normalizarCuentaBase(baseVisible)
    .slice(0, 11)
    .padEnd(11, "0");
  const b = visible.slice(3, 6);
  const c = visible.slice(6, 9);
  const d = visible.slice(9, 11);
  if (b === "000" && c === "000" && d === "00") return "1";
  if (c === "000" && d === "00") return "2";
  if (d === "00") return "3";
  return "4";
};

const convertirCuenta21 = (cuentaLegible) => {
  const entrada = normalizarCuentaBase(cuentaLegible);
  if (!entrada) return "";

  // Si ya viene en formato COI de 21 caracteres, resp├®talo.
  if (entrada.length >= 21) {
    return entrada.slice(0, 21);
  }

  // Usa la conversi├│n compartida si est├í disponible en la vista.
  if (typeof window.cuentaLarga === "function") {
    const desdeVista = window.cuentaLarga(entrada);
    if (desdeVista) return desdeVista;
  }

  const visible = entrada.slice(0, 11).padEnd(11, "0");
  const nivel = deducirNivel(visible);
  return visible.padEnd(20, "0") + nivel;
};


