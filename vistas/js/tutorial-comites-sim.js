(() => {
  const EXPECTED_TOUR_ID = "comitesFlujo";
  const BADGE_ID = "panelamcham-tutorial-sim-badge";

  const EJEMPLO_USUARIOS = {
    inicio: { etiqueta: "Aldo Operativo (AO)", rol: "Selecciona ejercicio" },
    borrador: { etiqueta: "Brenda (BS)", rol: "Captura/edición" },
    historial: { etiqueta: "Gaby (GL)", rol: "Consulta historial" },
    enviar: { etiqueta: "Mario (MG)", rol: "Envía a revisión" },
    revisar: { etiqueta: "Andrea (AA)", rol: "Revisión" },
    autorizar: { etiqueta: "Alberto (AMB)", rol: "Aprobación" },
    coi: { etiqueta: "Paola (PV)", rol: "Guardar en COI" },
  };

  const isToursEnabled = () => {
    try {
      const cfg = window.top?.PANELAMCHAM_ROUTE_CONFIG?.tours;
      return cfg?.enabled !== false;
    } catch (_) {
      return true;
    }
  };

  const obtenerInstanciaFlujo = () => window.__flujoAutorizacionInstance || null;

  const formatDateTime = (valor) => {
    try {
      const fecha = new Date(valor);
      if (!fecha || Number.isNaN(fecha.getTime())) return String(valor || "");
      return new Intl.DateTimeFormat("es-MX", {
        dateStyle: "short",
        timeStyle: "medium",
        hour12: false,
      }).format(fecha);
    } catch (_) {
      return String(valor || "");
    }
  };

  const ensureBadge = () => {
    let el = document.getElementById(BADGE_ID);
    if (el) return el;
    el = document.createElement("div");
    el.id = BADGE_ID;
    el.style.position = "fixed";
    el.style.right = "14px";
    el.style.top = "14px";
    el.style.zIndex = "2147483000";
    el.style.display = "none";
    el.innerHTML = `
      <div class="d-flex flex-column align-items-end gap-1">
        <span class="badge text-bg-dark">Tutorial (simulado)</span>
        <span class="badge text-bg-primary" data-role="user"></span>
        <span class="badge text-bg-secondary" data-role="role"></span>
      </div>
    `;
    document.body.appendChild(el);
    return el;
  };

  const setBadge = ({ usuario = "", rol = "" } = {}) => {
    const badge = ensureBadge();
    const userEl = badge.querySelector('[data-role="user"]');
    const roleEl = badge.querySelector('[data-role="role"]');
    if (userEl) userEl.textContent = usuario || "";
    if (roleEl) roleEl.textContent = rol || "";
    badge.style.display = usuario || rol ? "block" : "none";
  };

  const hideBadge = () => {
    const el = document.getElementById(BADGE_ID);
    if (el) el.style.display = "none";
  };

  const construirKeysBudget = (tabla) => {
    const fila =
      tabla?.querySelector("tbody tr.fila-cuenta") ||
      tabla?.querySelector("tbody tr");
    const keys = fila
      ? Array.from(fila.cells || [])
          .map((celda) => celda?.dataset?.columnaClave || "")
          .filter((k) => typeof k === "string" && k.startsWith("budget-"))
      : [];
    if (keys.length) return keys.slice(0, 3);
    return ["budget-ene", "budget-feb", "budget-mar"];
  };

  const construirCambiosSimulados = (tabla) => {
    const filas = Array.from(
      tabla?.querySelectorAll("tbody tr.fila-cuenta") || []
    );
    const cuentas = filas
      .map((fila) => (fila.dataset.cuenta21 || fila.dataset.cuenta || "").trim())
      .filter(Boolean)
      .slice(0, 3);
    if (!cuentas.length) return [];
    const keys = construirKeysBudget(tabla);
    return cuentas.map((cuenta, idx) => {
      const base = 12500 + idx * 3500;
      const valores = {};
      keys.forEach((k, keyIdx) => {
        valores[k] = base + keyIdx * 1800;
      });
      return { cuenta, valores };
    });
  };

  const aplicarStageFlujo = (stage) => {
    const instancia = obtenerInstanciaFlujo();
    if (!instancia) return false;

    const ahora = new Date();
    const fechaEnvio = ahora.toISOString();
    const tabla = instancia.tableElement || document.getElementById("tablaComparacion");
    const cambios = construirCambiosSimulados(tabla);

    const usuario = EJEMPLO_USUARIOS[stage] || { etiqueta: "Usuario", rol: "" };
    setBadge({ usuario: usuario.etiqueta, rol: usuario.rol });

    const setState = (partial) => {
      instancia.state = instancia.state || {};
      instancia.state.permisos = {
        cargar: false,
        revisar: false,
        aprobar: false,
        leer: true,
        admin: false,
        ...(instancia.state.permisos || {}),
        ...(partial.permisos || {}),
      };
      instancia.state.editMode = Boolean(partial.editMode);
      instancia.state.hayCambios = Boolean(partial.hayCambios);
      instancia.state.borrador = partial.borrador || null;
    };

    const render = () => {
      try {
        instancia._renderInfo?.();
        instancia._renderBotones?.();
      } catch (_) {
        // ignore
      }
    };

    if (stage === "inicio") {
      setState({
        permisos: { cargar: true },
        editMode: false,
        hayCambios: false,
        borrador: null,
      });
      render();
      return true;
    }

    if (stage === "borrador") {
      setState({
        permisos: { cargar: true },
        editMode: true,
        hayCambios: true,
        borrador: {
          id: 999001,
          estado: "EDITANDO",
          autorNombre: `${usuario.etiqueta} · Captura`,
          autorUsuario: "bs.demo",
          fechaEnvio,
          usuarioId: instancia.state?.usuario?.id || null,
          data: { presupuesto: cambios },
        },
      });
      try {
        if (tabla && window.FlujoAutorizacion?.pintarBorrador) {
          window.FlujoAutorizacion.pintarBorrador(tabla, instancia.state.borrador);
        }
      } catch (_) {
        // ignore
      }
      render();
      return true;
    }

    if (stage === "historial") {
      setState({
        permisos: { cargar: true },
        editMode: false,
        hayCambios: false,
        borrador: {
          id: 999001,
          estado: "EDITANDO",
          autorNombre: `${EJEMPLO_USUARIOS.borrador.etiqueta} · Captura`,
          autorUsuario: "bs.demo",
          fechaEnvio,
          usuarioId: instancia.state?.usuario?.id || null,
          data: { presupuesto: cambios },
        },
      });
      poblarCentroBorradoresSimulado({ fechaEnvio });
      poblarHistorialWorkflowSimulado({ fechaEnvio });
      render();
      return true;
    }

    if (stage === "enviar") {
      setState({
        permisos: { cargar: true },
        editMode: true,
        hayCambios: true,
        borrador: {
          id: 999001,
          estado: "EDITANDO",
          autorNombre: `${usuario.etiqueta} · Captura`,
          autorUsuario: "mg.demo",
          fechaEnvio,
          usuarioId: instancia.state?.usuario?.id || null,
          data: { presupuesto: cambios },
        },
      });
      render();
      return true;
    }

    if (stage === "revisar") {
      setState({
        permisos: { revisar: true },
        editMode: false,
        hayCambios: false,
        borrador: {
          id: 999001,
          estado: "PENDIENTE",
          autorNombre: `${EJEMPLO_USUARIOS.enviar.etiqueta} · Enviado`,
          autorUsuario: "mg.demo",
          fechaEnvio,
          usuarioId: instancia.state?.usuario?.id || null,
          data: { presupuesto: cambios },
        },
      });
      render();
      return true;
    }

    if (stage === "autorizar") {
      setState({
        permisos: { aprobar: true },
        editMode: false,
        hayCambios: false,
        borrador: {
          id: 999001,
          estado: "REVISADO",
          autorNombre: `${EJEMPLO_USUARIOS.revisar.etiqueta} · Revisado`,
          autorUsuario: "aa.demo",
          fechaEnvio,
          usuarioId: instancia.state?.usuario?.id || null,
          data: { presupuesto: cambios },
        },
      });
      render();
      return true;
    }

    if (stage === "coi") {
      setState({
        permisos: { aprobar: true },
        editMode: false,
        hayCambios: false,
        borrador: {
          id: 999001,
          estado: "APROBADO",
          autorNombre: `${EJEMPLO_USUARIOS.autorizar.etiqueta} · Autorizado`,
          autorUsuario: "amb.demo",
          fechaEnvio,
          usuarioId: instancia.state?.usuario?.id || null,
          data: { presupuesto: cambios },
        },
      });
      render();
      return true;
    }

    return false;
  };

  const poblarCentroBorradoresSimulado = ({ fechaEnvio }) => {
    const drawer = document.getElementById("workflowDraftsDrawer");
    if (!drawer) return;

    const status = drawer.querySelector("#draftsCenterStatus");
    const body = drawer.querySelector("#draftsCenterBody");
    if (status) {
      status.className = "alert alert-warning mb-3";
      status.innerHTML =
        '<i class="bi bi-mortarboard me-2"></i>Vista simulada del tutorial. No modifica datos reales.';
    }
    if (body) {
      body.innerHTML = `
        <tr>
          <td><span class="badge bg-info">En edición</span></td>
          <td>
            <div class="fw-semibold">${EJEMPLO_USUARIOS.borrador.etiqueta}</div>
            <small class="text-muted">bs.demo</small>
          </td>
          <td><small title="${fechaEnvio}">${formatDateTime(
            fechaEnvio
          )}</small></td>
          <td class="text-end">
            <button class="btn btn-sm btn-secondary" disabled>
              <i class="bi bi-box-arrow-in-down me-1"></i>Cargar
            </button>
          </td>
        </tr>
      `;
    }
  };

  const poblarHistorialWorkflowSimulado = ({ fechaEnvio }) => {
    const fechaTexto = formatDateTime(fechaEnvio);
    const draftsDrawer = document.getElementById("workflowDraftsDrawer");
    if (draftsDrawer) {
      const status = draftsDrawer.querySelector("#draftsHistoryStatus");
      const tbody = draftsDrawer.querySelector("#draftsHistoryBody");
      if (status) {
        status.className = "alert alert-warning mb-3";
        status.innerHTML =
          '<i class="bi bi-mortarboard me-2"></i>Historial simulado para mostrar el flujo (quién hizo qué y cuándo).';
      }
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td>Guardó el borrador</td>
            <td><span class="badge text-bg-light">EDITANDO</span></td>
            <td>${EJEMPLO_USUARIOS.borrador.etiqueta}</td>
            <td title="${fechaEnvio}">${fechaTexto}</td>
            <td>Ajuste de valores (demo)</td>
          </tr>
          <tr>
            <td>Envió a revisión</td>
            <td><span class="badge text-bg-light">PENDIENTE</span></td>
            <td>${EJEMPLO_USUARIOS.enviar.etiqueta}</td>
            <td title="${fechaEnvio}">${fechaTexto}</td>
            <td>Listo para validar</td>
          </tr>
          <tr>
            <td>Marcó como revisado</td>
            <td><span class="badge text-bg-light">REVISADO</span></td>
            <td>${EJEMPLO_USUARIOS.revisar.etiqueta}</td>
            <td title="${fechaEnvio}">${fechaTexto}</td>
            <td>Revisión completada</td>
          </tr>
          <tr>
            <td>Autorizó el borrador</td>
            <td><span class="badge text-bg-light">APROBADO</span></td>
            <td>${EJEMPLO_USUARIOS.autorizar.etiqueta}</td>
            <td title="${fechaEnvio}">${fechaTexto}</td>
            <td>Listo para COI</td>
          </tr>
        `;
      }
    }

    const workflowDrawer = document.getElementById("workflowDrawer");
    if (workflowDrawer) {
      const stateEl = workflowDrawer.querySelector("#workflowCurrentState");
      const metaEl = workflowDrawer.querySelector("#workflowCurrentMeta");
      const badgeEl = workflowDrawer.querySelector("#workflowCurrentBadge");
      const statusEl = workflowDrawer.querySelector("#workflowProgressStatus");
      const listEl = workflowDrawer.querySelector("#workflowProgressList");
      if (stateEl) stateEl.textContent = "Tutorial (simulado)";
      if (metaEl) metaEl.textContent = "Este flujo es de ejemplo y no afecta tus datos.";
      if (badgeEl) badgeEl.textContent = "SIM";
      if (statusEl) {
        statusEl.className = "alert alert-warning";
        statusEl.textContent = "Seguimiento simulado del tutorial.";
      }
      if (listEl) {
        listEl.classList.remove("collapsed");
        listEl.innerHTML = `
          <div class="list-group">
            <div class="list-group-item d-flex justify-content-between align-items-start">
              <div>
                <div class="fw-semibold">Borrador guardado</div>
                <div class="text-muted small">${EJEMPLO_USUARIOS.borrador.etiqueta}</div>
              </div>
              <span class="text-muted small" title="${fechaEnvio}">${fechaTexto}</span>
            </div>
            <div class="list-group-item d-flex justify-content-between align-items-start">
              <div>
                <div class="fw-semibold">Enviado a revisión</div>
                <div class="text-muted small">${EJEMPLO_USUARIOS.enviar.etiqueta}</div>
              </div>
              <span class="text-muted small" title="${fechaEnvio}">${fechaTexto}</span>
            </div>
            <div class="list-group-item d-flex justify-content-between align-items-start">
              <div>
                <div class="fw-semibold">Revisado</div>
                <div class="text-muted small">${EJEMPLO_USUARIOS.revisar.etiqueta}</div>
              </div>
              <span class="text-muted small" title="${fechaEnvio}">${fechaTexto}</span>
            </div>
            <div class="list-group-item d-flex justify-content-between align-items-start">
              <div>
                <div class="fw-semibold">Autorizado</div>
                <div class="text-muted small">${EJEMPLO_USUARIOS.autorizar.etiqueta}</div>
              </div>
              <span class="text-muted small" title="${fechaEnvio}">${fechaTexto}</span>
            </div>
          </div>
        `;
      }
    }
  };

  const resetDrawerContents = () => {
    const draftsDrawer = document.getElementById("workflowDraftsDrawer");
    if (draftsDrawer) {
      const status = draftsDrawer.querySelector("#draftsCenterStatus");
      const body = draftsDrawer.querySelector("#draftsCenterBody");
      const historyStatus = draftsDrawer.querySelector("#draftsHistoryStatus");
      const historyBody = draftsDrawer.querySelector("#draftsHistoryBody");

      if (status) {
        status.className = "alert alert-info mb-3";
        status.innerHTML =
          '<i class="bi bi-info-circle me-2"></i>Selecciona empresa y ejercicio para ver tus borradores.';
      }
      if (body) {
        body.innerHTML =
          '<tr><td colspan="4" class="text-center text-muted py-4">Sin borradores</td></tr>';
      }
      if (historyStatus) {
        historyStatus.className = "alert alert-info mb-3";
        historyStatus.innerHTML =
          '<i class="bi bi-info-circle me-2"></i>Historial de todos los cambios y acciones del flujo.';
      }
      if (historyBody) {
        historyBody.innerHTML =
          '<tr><td colspan="5" class="text-center text-muted py-4">Sin registros</td></tr>';
      }
    }

    const workflowDrawer = document.getElementById("workflowDrawer");
    if (workflowDrawer) {
      const statusEl = workflowDrawer.querySelector("#workflowProgressStatus");
      const listEl = workflowDrawer.querySelector("#workflowProgressList");
      const stateEl = workflowDrawer.querySelector("#workflowCurrentState");
      const metaEl = workflowDrawer.querySelector("#workflowCurrentMeta");
      const badgeEl = workflowDrawer.querySelector("#workflowCurrentBadge");
      if (stateEl) stateEl.textContent = "Sin contexto";
      if (metaEl) metaEl.textContent = "";
      if (badgeEl) badgeEl.textContent = "-";
      if (statusEl) {
        statusEl.className = "alert alert-info";
        statusEl.textContent =
          "Selecciona empresa, modulo y ejercicio para consultar el historial.";
      }
      if (listEl) {
        listEl.classList.add("collapsed");
        listEl.innerHTML = "";
      }
    }
  };

  let tutorialActivo = false;

  const startTutorial = () => {
    tutorialActivo = true;
    ensureBadge();
  };

  const stopTutorial = async () => {
    tutorialActivo = false;
    hideBadge();
    resetDrawerContents();
    try {
      const instancia = obtenerInstanciaFlujo();
      if (instancia?.tableElement && window.FlujoAutorizacion?.limpiarBorrador) {
        window.FlujoAutorizacion.limpiarBorrador(instancia.tableElement);
      }
      await Promise.resolve(instancia?._refreshEstado?.());
    } catch (_) {
      // ignore
    }
  };

  const onMessage = (event) => {
    const data = event?.data || null;
    if (!data || data.__panelamchamTour !== true) return;
    if (!isToursEnabled()) return;

    const tourId = data.tourId || null;
    if (tourId && tourId !== EXPECTED_TOUR_ID) return;

    if (data.action === "start") {
      startTutorial();
      return;
    }

    if (data.action === "stop") {
      stopTutorial();
      return;
    }

    if (data.action === "stage") {
      if (!tutorialActivo) startTutorial();
      aplicarStageFlujo(String(data.stage || ""));
    }
  };

  window.addEventListener("message", onMessage);
})();
