(() => {
  const { useState, useEffect, useMemo, useCallback } = React;
  const API_BASE = (() => {
    if (window.location.protocol === "file:") {
      return "http://localhost:3005/api";
    }
    return `${window.location.origin.replace(/\/$/, "")}/api`;
  })();
  const esPantallaReducida = () => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return false;
    }
    return window.matchMedia("(max-width: 992px)").matches;
  };
  const MODULE_GROUPS = [
    {
      id: "panel-resumenes",
      label: "Resumen",
      items: [
        {
          id: "resumen",
          label: "Resumen",
          path: "RESUMEN.html",
          badge: "summary",
          permiso: "RESUMEN",
        },
      ],
    },
    {
      id: "modulos-planeacion",
      label: "Divisiones",
      items: [
        {
          id: "presupuestos",
          label: "Presupuestos",
          path: "Presupuestos.html",
          badge: "ppto",
          permiso: "Presupuestos",
        },
        {
          id: "comites",
          label: "Comités",
          path: "Comités.html",
          permiso: "Comités",
        },
        {
          id: "comunicacion",
          label: "Comunicación",
          path: "Comunicación.html",
          permiso: "Comunicación",
        },
        {
          id: "direccion",
          label: "Dirección",
          path: "Dirección.html",
          permiso: "Dirección",
        },
        {
          id: "eventos",
          label: "Eventos",
          path: "Eventos.html",
          permiso: "Eventos",
        },
        {
          id: "finanzas-cluster",
          label: "Finanzas",
          badge: "finanzas",
          items: [
            {
              id: "finanzas",
              label: "Finanzas",
              path: "Finanzas.html",
              badge: "finanzas",
              permiso: "Finanzas",
            },
            {
              id: "gastosgenerales",
              label: "Gastos Generales",
              path: "GastosGenerales.html",
              badge: "finanzas",
              permiso: "Gastos Generales",
            },
            {
              id: "nomina",
              label: "Nómina",
              path: "Nomina.html",
              badge: "finanzas",
              permiso: "Nómina",
            },
          ],
        },
        {
          id: "gtos-corporativos",
          label: "Gastos Corporativos",
          path: "Gtos_Corporativos.html",
          permiso: "Gtos Corporativos",
        },
        {
          id: "membresia",
          label: "Membresía",
          path: "Membresía.html",
          permiso: "Membresía",
        },
        { id: "rh", label: "Recursos Humanos", path: "RH.html", permiso: "RH" },
        {
          id: "serv-membresia",
          label: "Servicios a la Membresía",
          path: "Serv_Membresía.html",
          permiso: "Serv Membresía",
        },
        { id: "tic", label: "T&IC", path: "T&IC.html", permiso: "T&IC" },
        { id: "vpe", label: "VPE", path: "VPE.html", permiso: "VPE" },
      ],
    },
    {
      id: "panel-administracion",
      label: "Configuración",
      items: [
        {
          id: "perfil",
          label: "Mi Perfil",
          path: "perfil.html",
          badge: "perfil",
          public: true,
        },
        {
          id: "usuarios",
          label: "Administrar usuarios",
          path: "usuarios.html",
          badge: "Permisos",
          requiresAdmin: true,
        },
        {
          id: "crear-usuario",
          label: "Crear usuario",
          path: "crear_usuario.html",
          requiresAdmin: true,
        },
        {
          id: "plantillas",
          label: "Gestor de Plantillas",
          path: "plantillas.html",
          requiresAdmin: true,
          permiso: "Layouts",
        },
        {
          id: "firebird-conexiones",
          label: "Administrar conexiones",
          path: "firebird-config.html",
          requiresAdminGlobal: true,
        },
      ],
    },
  ];

  const MODULO_PERMISOS = {
    resumen: "RESUMEN",
    presupuestos: "Presupuestos",
    comites: "Comit\xE9s",
    comunicacion: "Comunicaci\xF3n",
    direccion: "Direcci\xF3n",
    eventos: "Eventos",
    finanzas: "Finanzas",
    gastosgenerales: "Gastos Generales",
    "gtos-corporativos": "Gtos Corporativos",
    membresia: "Membres\xEDa",
    rh: "RH",
    "serv-membresia": "Serv Membres\xEDa",
    tic: "T&IC",
    vpe: "VPE",
    nomina: "N\xF3mina",
    plantillas: "Layouts",
  };
  const mapPermisosEnItems = (items = []) => {
    return items.map((item) => {
      if (item.items && item.items.length > 0) {
        return { ...item, items: mapPermisosEnItems(item.items) };
      }
      if (item.permiso) return item;
      const permisoNormalizado = MODULO_PERMISOS[item.id] || item.label;
      return { ...item, permiso: permisoNormalizado };
    });
  };
  MODULE_GROUPS.forEach((group) => {
    group.items = mapPermisosEnItems(group.items);
  });
  const flattenLeafModules = (items = []) => {
    const resultado = [];
    items.forEach((item) => {
      if (item.items && item.items.length > 0) {
        resultado.push(...flattenLeafModules(item.items));
      } else {
        resultado.push(item);
      }
    });
    return resultado;
  };
  const DESTINO_COMENTARIO_KEY = "panelamcham.comentarios.destino";
  const normalizarClaveModulo = (valor = "") =>
    valor
      .toString()
      .trim()
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Z0-9]+/g, "");
  const MAPA_MODULO_COMENTARIO = (() => {
    const mapa = new Map();
    flattenLeafModules(MODULE_GROUPS).forEach((modulo) => {
      [modulo.id, modulo.label, modulo.permiso].forEach((clave) => {
        const normalizada = normalizarClaveModulo(clave || "");
        if (normalizada && !mapa.has(normalizada)) {
          mapa.set(normalizada, modulo.id);
        }
      });
    });
    return mapa;
  })();
  const resolverModuloComentario = (valor) => {
    const clave = normalizarClaveModulo(valor || "");
    return clave ? MAPA_MODULO_COMENTARIO.get(clave) || null : null;
  };
  const parsearDestinoComentario = (notificacion) => {
    const enlace = (notificacion?.enlace || "").toString().trim();
    if (!enlace) return null;
    try {
      const base =
        typeof window !== "undefined" && window.location
          ? window.location.href
          : "http://localhost/";
      const url = new URL(enlace, base);
      const destino = (url.searchParams.get("destino") || "")
        .toString()
        .trim()
        .toLowerCase();
      if (destino !== "comentario") return null;
      const celdaId = (url.searchParams.get("celdaId") || "").toString().trim();
      const modulo =
        (url.searchParams.get("modulo") || notificacion?.modulo || "")
          .toString()
          .trim();
      if (!celdaId || !modulo) return null;
      const anioRaw = Number.parseInt(url.searchParams.get("anio"), 10);
      return {
        tipo: "comentario",
        celdaId,
        modulo,
        anio: Number.isInteger(anioRaw) ? anioRaw : null,
        empresaId:
          (url.searchParams.get("empresaId") || notificacion?.empresaId || "")
            .toString()
            .trim() || null,
        capitulo:
          (url.searchParams.get("capitulo") || "").toString().trim() || null,
      };
    } catch (_) {
      return null;
    }
  };
  const collectNestedGroupIds = (items = [], target = []) => {
    items.forEach((item) => {
      if (item.items && item.items.length > 0) {
        target.push(item.id);
        collectNestedGroupIds(item.items, target);
      }
    });
    return target;
  };
  const collectAllGroupIds = (groups = []) => {
    const ids = [];
    groups.forEach((group) => {
      ids.push(group.id);
      collectNestedGroupIds(group.items || [], ids);
    });
    return ids;
  };
  const TOUR_ESTADO_KEY_BASE = "panelamcham.tour.dashboard.v1";
  const TOUR_CARD_MAX_WIDTH = 360;
  const TOUR_CARD_MIN_HEIGHT = 212;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const construirClaveTourUsuario = (sesion) => {
    const usuario = normalizarClaveModulo(sesion?.usuario?.usuario || "GENERAL");
    return `${TOUR_ESTADO_KEY_BASE}.${usuario || "GENERAL"}`;
  };
  const leerEstadoTour = (storageKey) => {
    if (!storageKey) return false;
    try {
      return Boolean(localStorage.getItem(storageKey));
    } catch (_) {
      return false;
    }
  };
  const guardarEstadoTour = (storageKey, estado = "completado") => {
    if (!storageKey) return;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          estado,
          fecha: new Date().toISOString(),
        })
      );
    } catch (error) {
      console.warn("No se pudo guardar el estado del tour.", error);
    }
  };
  const normalizarRectTour = (rect) => {
    if (!rect) return null;
    const padding = 8;
    return {
      top: Math.max(8, rect.top - padding),
      left: Math.max(8, rect.left - padding),
      width: Math.max(40, rect.width + padding * 2),
      height: Math.max(40, rect.height + padding * 2),
    };
  };
  const calcularPosicionTarjetaTour = (rect) => {
    if (typeof window === "undefined") {
      return { top: 24, left: 24, width: TOUR_CARD_MAX_WIDTH };
    }
    const viewportWidth = window.innerWidth || 1200;
    const viewportHeight = window.innerHeight || 800;
    const margen = 12;
    const width = Math.min(TOUR_CARD_MAX_WIDTH, viewportWidth - margen * 2);
    if (!rect) {
      return {
        top: clamp(
          viewportHeight / 2 - TOUR_CARD_MIN_HEIGHT / 2,
          margen,
          viewportHeight - TOUR_CARD_MIN_HEIGHT - margen
        ),
        left: clamp(
          viewportWidth / 2 - width / 2,
          margen,
          viewportWidth - width - margen
        ),
        width,
      };
    }
    const topPreferido = rect.top + rect.height + 14;
    const topAlternativo = rect.top - TOUR_CARD_MIN_HEIGHT - 14;
    const top =
      topPreferido + TOUR_CARD_MIN_HEIGHT <= viewportHeight - margen
        ? topPreferido
        : topAlternativo;
    return {
      top: clamp(top, margen, viewportHeight - TOUR_CARD_MIN_HEIGHT - margen),
      left: clamp(rect.left, margen, viewportWidth - width - margen),
      width,
    };
  };
  const moduloDisponiblePorEmpresa = (empresaId, moduloId) => {
    const config = window.CapitulosModulos;
    if (!config || typeof config.moduloDisponible !== "function") {
      return true;
    }
    return config.moduloDisponible(empresaId, moduloId);
  };
  const usuarioPuedeUsarModulo = (
    sesion,
    empresaId,
    modulo,
    puedeAdministrar
  ) => {
    if (!sesion || !sesion.usuario) {
      return false;
    }
    const puedeAdmin =
      typeof puedeAdministrar === "boolean"
        ? puedeAdministrar
        : Sesion.puedeAdministrarUsuarios(sesion);
    const esAdminGlobal =
      typeof Sesion.esAdminGlobal === "function"
        ? Sesion.esAdminGlobal(sesion)
        : Boolean(sesion?.usuario?.esAdminGlobal);
    if (modulo.requiresAdminGlobal && !esAdminGlobal) {
      return false;
    }
    if (modulo.requiresAdmin && !puedeAdmin) {
      return false;
    }
    if (modulo.public) {
      return true;
    }
    if (!moduloDisponiblePorEmpresa(empresaId, modulo.id)) {
      return false;
    }
    const usuario = (sesion.usuario.usuario || "")
      .toString()
      .trim()
      .toUpperCase();
    if (usuario === "ICONET" || sesion.usuario.esAdminGlobal) {
      return true;
    }
    const clave = modulo.permiso || modulo.label;
    const acciones = Sesion.obtenerPermisosModulo(clave, empresaId, sesion);
    if (!acciones) {
      return false;
    }
    return Boolean(
      acciones["Cargar y guardar"] ||
        acciones.Revisar ||
        acciones.Aprobar ||
        acciones.Lectura ||
        acciones.Ver
    );
  };
  const obtenerNombreUsuario = (sesion) => {
    if (!sesion || !sesion.usuario) {
      return "Sin sesi\xF3n activa";
    }
    const { nombres, apellidoPrimero, apellidoSegundo, usuario } =
      sesion.usuario;
    const nombre = [nombres, apellidoPrimero, apellidoSegundo]
      .filter(Boolean)
      .join(" ");
    return nombre || usuario || "Usuario";
  };
  const LoginView = ({ onLogin }) => {
    const [form, setForm] = useState({ usuario: "", contrasena: "" });
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState("");
    const [toastMsg, setToastMsg] = useState("");
    const [toastType, setToastType] = useState("danger");
    const toastRef = React.useRef(null);
    const [mostrarContrasena, setMostrarContrasena] = useState(false);
    useEffect(() => {
      if (error) {
        try {
          const ctor = window.bootstrap && window.bootstrap.Toast;
          if (ctor && toastRef.current) {
            setToastMsg(error);
            setToastType("danger");
            const t = new ctor(toastRef.current);
            t.show();
          }
        } catch (_) {}
      }
    }, [error]);
    useEffect(() => {
      Sesion.limpiar();
    }, []);
    const actualizarCampo = (evento) => {
      const { name, value } = evento.target;
      setForm((prev) => ({ ...prev, [name]: value }));
    };
    const mostrarToast = (mensaje, tipo = "danger") => {
      setToastMsg(mensaje);
      setToastType(tipo);
      try {
        const ctor = window.bootstrap && window.bootstrap.Toast;
        if (ctor && toastRef.current) {
          const t = new ctor(toastRef.current);
          t.show();
        }
      } catch (e) {}
    };
    const manejarEnvio = async (evento) => {
      evento.preventDefault();
      setError("");
      if (!form.usuario || !form.contrasena) {
        setError("Completa usuario y contrase\xF1a.");
        return;
      }
      setCargando(true);
      try {
        const respuesta = await fetch(`${API_BASE}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            usuario: form.usuario,
            contrasena: form.contrasena,
          }),
        });
        const datos = await respuesta.json().catch(() => ({}));
        if (!respuesta.ok) {
          throw new Error(datos.mensaje || "No fue posible iniciar sesi\xF3n.");
        }
        const sesionNormalizada = Sesion.guardar(datos) || datos;
        onLogin(sesionNormalizada);
      } catch (err) {
        console.error("Error de inicio de sesi\xF3n", err);
        const msg =
          err?.message ||
          "Ocurri\xF3 un problema durante el inicio de sesi\xF3n.";
        const sugerencia = msg.includes("Failed to fetch")
          ? "Verifica que el servidor est\xE9 corriendo en http://localhost:3005 y que no haya bloqueos de red."
          : msg;
        setError(sugerencia);
      } finally {
        setCargando(false);
      }
    };
    return /* @__PURE__ */ React.createElement(
      "div",
      { className: "d-flex align-items-center justify-content-center h-100" },
      /* @__PURE__ */ React.createElement(
        "main",
        { className: "login-card", "aria-labelledby": "titulo-login" },
        /* @__PURE__ */ React.createElement(
          "header",
          { className: "mb-4 text-center text-md-start" },
          /* @__PURE__ */ React.createElement(
            "h1",
            { id: "titulo-login", className: "h3 mb-1" },
            "AmCham"
          )
        ),
        error &&
          /* @__PURE__ */ React.createElement(
            "div",
            { className: "alert alert-danger", role: "alert" },
            error
          ),
        /* @__PURE__ */ React.createElement(
          "form",
          { onSubmit: manejarEnvio, autoComplete: "off" },
          /* @__PURE__ */ React.createElement(
            "div",
            { className: "mb-3" },
            /* @__PURE__ */ React.createElement(
              "label",
              { htmlFor: "usuario", className: "form-label fw-semibold" },
              "Usuario ",
              /* @__PURE__ */ React.createElement(
                "span",
                { className: "text-danger" },
                "*"
              )
            ),
            /* @__PURE__ */ React.createElement("input", {
              type: "text",
              id: "usuario",
              name: "usuario",
              className: "form-control form-control-lg",
              value: form.usuario,
              onChange: actualizarCampo,
              disabled: cargando,
              autoComplete: "username",
              required: true,
            })
          ),
          /* @__PURE__ */ React.createElement(
            "div",
            { className: "mb-3" },
            /* @__PURE__ */ React.createElement(
              "label",
              { htmlFor: "contrasena", className: "form-label fw-semibold" },
              "Contrase\xF1a ",
              /* @__PURE__ */ React.createElement(
                "span",
                { className: "text-danger" },
                "*"
              )
            ),
            /* @__PURE__ */ React.createElement(
              "div",
              { className: "input-group" },
              /* @__PURE__ */ React.createElement("input", {
                type: mostrarContrasena ? "text" : "password",
                id: "contrasena",
                name: "contrasena",
                className: "form-control form-control-lg",
                value: form.contrasena,
                onChange: actualizarCampo,
                disabled: cargando,
                autoComplete: "current-password",
                required: true,
              }),
              /* @__PURE__ */ React.createElement(
                "button",
                {
                  type: "button",
                  className: "btn btn-outline-secondary",
                  disabled: cargando,
                  "aria-pressed": mostrarContrasena,
                  "aria-label": mostrarContrasena
                    ? "Ocultar contrase"
                    : "Mostrar contrase",
                  onClick: () => setMostrarContrasena((v) => !v),
                },
                mostrarContrasena
                  ? /* @__PURE__ */ React.createElement(
                      "svg",
                      {
                        xmlns: "http://www.w3.org/2000/svg",
                        width: "16",
                        height: "16",
                        fill: "currentColor",
                        className: "bi bi-eye-slash",
                        viewBox: "0 0 16 16",
                      },
                      /* @__PURE__ */ React.createElement("path", {
                        d: "M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7 7 0 0 0-2.79.588l.77.771A6 6 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13 13 0 0 1 14.828 8q-.086.13-.195.288c-.335.48-.83 1.12-1.465 1.755q-.247.248-.517.486z",
                      }),
                      /* @__PURE__ */ React.createElement("path", {
                        d: "M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829zm-2.943 1.299.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829",
                      }),
                      /* @__PURE__ */ React.createElement("path", {
                        d: "M3.35 5.47q-.27.24-.518.487A13 13 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.772.772A7 7 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884-12-12 .708-.708 12 12z",
                      })
                    )
                  : /* @__PURE__ */ React.createElement(
                      "svg",
                      {
                        xmlns: "http://www.w3.org/2000/svg",
                        width: "16",
                        height: "16",
                        fill: "currentColor",
                        className: "bi bi-eye",
                        viewBox: "0 0 16 16",
                      },
                      /* @__PURE__ */ React.createElement("path", {
                        d: "M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8M1.173 8a13 13 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5s3.879 1.168 5.168 2.457A13 13 0 0 1 14.828 8q-.086.13-.195.288c-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12 8 12s-3.879-1.168-5.168-2.457A13 13 0 0 1 1.172 8z",
                      }),
                      /* @__PURE__ */ React.createElement("path", {
                        d: "M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5",
                      })
                    )
              )
            )
          ),
          /* @__PURE__ */ React.createElement(
            "button",
            {
              type: "submit",
              className: "btn btn-verde w-100",
              disabled: cargando,
            },
            cargando &&
              /* @__PURE__ */ React.createElement("span", {
                className: "spinner-border spinner-border-sm me-2",
                role: "status",
                "aria-hidden": "true",
              }),
            cargando ? "Ingresando\u2026" : "Ingresar"
          )
        )
      ),
      /* @__PURE__ */ React.createElement(
        "div",
        {
          className: "position-fixed bottom-0 end-0 p-3",
          style: { zIndex: 1080 },
        },
        /* @__PURE__ */ React.createElement(
          "div",
          {
            ref: toastRef,
            className: `toast align-items-center text-white ${
              toastType === "success" ? "bg-success" : "bg-danger"
            } border-0`,
            role: "status",
            "aria-live": "polite",
            "aria-atomic": "true",
          },
          /* @__PURE__ */ React.createElement(
            "div",
            { className: "d-flex" },
            /* @__PURE__ */ React.createElement(
              "div",
              { className: "toast-body" },
              toastMsg || "Aviso"
            ),
            /* @__PURE__ */ React.createElement("button", {
              type: "button",
              className: "btn-close btn-close-white me-2 m-auto",
              "data-bs-dismiss": "toast",
              "aria-label": "Cerrar",
            })
          )
        )
      )
    );
  };
  const SidebarGroup = ({
    group,
    modules,
    selectedModule,
    onSelect,
    open,
    onToggle,
    gruposAbiertos,
    toggleGrupo,
  }) => {
    if (modules.length === 0) {
      return null;
    }
    return /* @__PURE__ */ React.createElement(
      "div",
      { className: "sidebar-group" },
      /* @__PURE__ */ React.createElement(
        "button",
        {
          type: "button",
          className: "submenu-toggle",
          "aria-expanded": open,
          onClick: () => onToggle(group.id),
        },
        /* @__PURE__ */ React.createElement("span", null, group.label),
        /* @__PURE__ */ React.createElement(
          "span",
          { className: "module-count" },
          modules.length
        )
      ),
      open &&
        /* @__PURE__ */ React.createElement(
          "div",
          { className: "submenu-content" },
          modules.map((module) =>
            /* @__PURE__ */ React.createElement(SidebarModuleItem, {
              key: module.id,
              module,
              selectedModule,
              onSelect,
              gruposAbiertos,
              toggleGrupo,
            })
          )
        )
    );
  };
  const SidebarModuleItem = ({
    module,
    selectedModule,
    onSelect,
    gruposAbiertos,
    toggleGrupo,
    level = 1,
  }) => {
    if (module.items && module.items.length > 0) {
      const abierto = gruposAbiertos.has(module.id);
      return /* @__PURE__ */ React.createElement(
        "div",
        {
          className: "sidebar-subgroup",
          style: { paddingLeft: level * 8 + "px" },
        },
        /* @__PURE__ */ React.createElement(
          "button",
          {
            type: "button",
            className: "submenu-toggle submenu-toggle-nested",
            "aria-expanded": abierto,
            onClick: () => toggleGrupo(module.id),
          },
          /* @__PURE__ */ React.createElement("span", null, module.label),
          /* @__PURE__ */ React.createElement(
            "span",
            { className: "module-count" },
            module.items.length
          )
        ),
        abierto &&
          /* @__PURE__ */ React.createElement(
            "div",
            { className: "submenu-content" },
            module.items.map((child) =>
              /* @__PURE__ */ React.createElement(SidebarModuleItem, {
                key: child.id,
                module: child,
                selectedModule,
                onSelect,
                gruposAbiertos,
                toggleGrupo,
                level: level + 1,
              })
            )
          )
      );
    }
    const activo = selectedModule?.id === module.id;
    return /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "sidebar-link " + (activo ? "active" : ""),
        onClick: () => onSelect(module),
      },
      /* @__PURE__ */ React.createElement("span", null, module.label),
      module.badge &&
        /* @__PURE__ */ React.createElement(
          "span",
          { className: "badge rounded-pill" },
          module.badge
        )
    );
  };
  const NotificationBell = ({
    notifications = [],
    onRefresh,
    onMarkAsRead,
    onMarkAllAsRead,
    onOpenNotification,
  }) => {
    const [open, setOpen] = useState(false);
    const bellRef = React.useRef(null);
    const unread = notifications.filter((item) => !item.leidaEn).length;
    useEffect(() => {
      const handleClick = (event) => {
        if (!open) return;
        if (bellRef.current && !bellRef.current.contains(event.target)) {
          setOpen(false);
        }
      };
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }, [open]);
    const toggle = () => setOpen((prev) => !prev);
    const marcarLeida = (id) => {
      if (onMarkAsRead) {
        onMarkAsRead(id);
      }
    };
    const abrirNotificacion = (item) => {
      if (onOpenNotification) {
        onOpenNotification(item);
      } else if (item?.id) {
        marcarLeida(item.id);
      }
      setOpen(false);
    };
    const renderFecha = (valor) => {
      if (!valor) return "";
      try {
        return new Date(valor).toLocaleString("es-MX");
      } catch (e) {
        return valor;
      }
    };
    return /* @__PURE__ */ React.createElement(
      "div",
      {
        className: `notification-bell${open ? " notification-bell--open" : ""}`,
        ref: bellRef,
      },
      /* @__PURE__ */ React.createElement(
        "button",
        {
          type: "button",
          className: "notification-bell__button",
          onClick: toggle,
          "aria-expanded": open,
          "aria-label": "Notificaciones",
          "data-tour": "notification-bell",
        },
        /* @__PURE__ */ React.createElement(
          "svg",
          {
            xmlns: "http://www.w3.org/2000/svg",
            width: "20",
            height: "20",
            fill: "currentColor",
            className: "notification-bell__icon",
            viewBox: "0 0 16 16",
            "aria-hidden": "true",
          },
          /* @__PURE__ */ React.createElement("path", {
            d: "M8 16a2 2 0 0 0 1.985-1.75H6.015A2 2 0 0 0 8 16m6-6c0-3.071-1.639-5.64-4.5-6.32V3a1.5 1.5 0 0 0-3 0v.68C3.64 4.36 2 6.929 2 10v2l-1 1v1h14v-1l-1-1z",
          })
        ),
        unread > 0 &&
          /* @__PURE__ */ React.createElement(
            "span",
            { className: "notification-bell__badge" },
            unread
          )
      ),
      open &&
        /* @__PURE__ */ React.createElement(
          "div",
          {
            className: "notification-panel",
            role: "dialog",
            "aria-label": "Notificaciones recientes",
          },
          /* @__PURE__ */ React.createElement(
            "div",
            { className: "notification-panel__header" },
            /* @__PURE__ */ React.createElement(
              "strong",
              null,
              "Notificaciones"
            ),
            /* @__PURE__ */ React.createElement(
              "button",
              {
                type: "button",
                className: "btn btn-link btn-sm p-0",
                onClick: onRefresh,
              },
              "Actualizar"
            ),
            unread > 0 &&
              /* @__PURE__ */ React.createElement(
                "button",
                {
                  type: "button",
                  className: "btn btn-link btn-sm p-0 ms-2 text-success",
                  onClick: onMarkAllAsRead,
                },
                "Limpiar"
              )
          ),
          /* @__PURE__ */ React.createElement(
            "div",
            { className: "notification-panel__body" },
            notifications.length === 0
              ? /* @__PURE__ */ React.createElement(
                  "p",
                  { className: "text-muted small mb-0" },
                  "Sin notificaciones pendientes."
                )
              : /* @__PURE__ */ React.createElement(
                  "ul",
                  { className: "notification-panel__list" },
                  notifications.map((item) =>
                    /* @__PURE__ */ React.createElement(
                      "li",
                      {
                        key: item.id,
                        className: `notification-panel__item${
                          !item.leidaEn ? " notification-panel__item--new" : ""
                        }`,
                      },
                      /* @__PURE__ */ React.createElement(
                        "div",
                        null,
                        /* @__PURE__ */ React.createElement(
                          "p",
                          { className: "notification-panel__title mb-1" },
                          item.titulo
                        ),
                        /* @__PURE__ */ React.createElement(
                          "p",
                          { className: "notification-panel__message mb-1" },
                          item.mensaje
                        ),
                        /* @__PURE__ */ React.createElement(
                          "small",
                          { className: "text-muted" },
                          renderFecha(item.creadaEn)
                        )
                      ),
                      /* @__PURE__ */ React.createElement(
                        "div",
                        {
                          className:
                            "d-flex flex-column align-items-end gap-1 text-nowrap",
                        },
                        item.enlace &&
                          /* @__PURE__ */ React.createElement(
                            "button",
                            {
                              type: "button",
                              className: "btn btn-link btn-sm p-0",
                              onClick: () => abrirNotificacion(item),
                            },
                            "Ir al comentario"
                          ),
                        !item.leidaEn &&
                          /* @__PURE__ */ React.createElement(
                            "button",
                            {
                              type: "button",
                              className: "btn btn-link btn-sm p-0",
                              onClick: () => marcarLeida(item.id),
                            },
                            "Marcar como le\xEDda"
                          )
                      )
                    )
                  )
                )
          )
        )
    );
  };
  const GuidedTourOverlay = ({
    active,
    step,
    stepIndex,
    totalSteps,
    highlightRect,
    onPrevious,
    onNext,
    onClose,
    onFinish,
  }) => {
    if (!active || !step) {
      return null;
    }
    const esUltimoPaso = stepIndex >= totalSteps - 1;
    const posicionTarjeta = calcularPosicionTarjetaTour(highlightRect);
    return /* @__PURE__ */ React.createElement(
      "div",
      {
        className: "guided-tour-overlay",
        role: "dialog",
        "aria-modal": "true",
        "aria-label": "Tutorial guiado del panel",
      },
      highlightRect &&
        /* @__PURE__ */ React.createElement("div", {
          className: "guided-tour-spotlight",
          style: {
            top: `${highlightRect.top}px`,
            left: `${highlightRect.left}px`,
            width: `${highlightRect.width}px`,
            height: `${highlightRect.height}px`,
          },
        }),
      /* @__PURE__ */ React.createElement(
        "section",
        {
          className: "guided-tour-card",
          style: {
            top: `${posicionTarjeta.top}px`,
            left: `${posicionTarjeta.left}px`,
            width: `${posicionTarjeta.width}px`,
          },
        },
        /* @__PURE__ */ React.createElement(
          "p",
          { className: "guided-tour-card__step mb-2" },
          `Paso ${stepIndex + 1} de ${totalSteps}`
        ),
        /* @__PURE__ */ React.createElement(
          "h3",
          { className: "guided-tour-card__title mb-2" },
          step.title
        ),
        /* @__PURE__ */ React.createElement(
          "p",
          { className: "guided-tour-card__description mb-0" },
          step.description
        ),
        step.tip &&
          /* @__PURE__ */ React.createElement(
            "p",
            { className: "guided-tour-card__tip mt-2 mb-0" },
            step.tip
          ),
        /* @__PURE__ */ React.createElement(
          "div",
          { className: "guided-tour-card__actions mt-3" },
          /* @__PURE__ */ React.createElement(
            "button",
            {
              type: "button",
              className: "btn btn-link btn-sm px-0",
              onClick: onClose,
            },
            "Salir"
          ),
          /* @__PURE__ */ React.createElement(
            "div",
            { className: "d-flex gap-2" },
            /* @__PURE__ */ React.createElement(
              "button",
              {
                type: "button",
                className: "btn btn-outline-secondary btn-sm",
                onClick: onPrevious,
                disabled: stepIndex === 0,
              },
              "Atrás"
            ),
            /* @__PURE__ */ React.createElement(
              "button",
              {
                type: "button",
                className: "btn btn-primary btn-sm",
                onClick: esUltimoPaso ? onFinish : onNext,
              },
              esUltimoPaso ? "Finalizar" : "Siguiente"
            )
          )
        )
      )
    );
  };
  const DashboardLayout = ({
    sesion,
    selectedModuleId,
    onSelectModule,
    onLogout,
    empresaActiva,
    onChangeEmpresa,
    notifications = [],
    onRefreshNotifications,
    onMarkNotification,
    onMarkAllNotifications,
    onOpenNotification,
  }) => {
    const puedeAdministrar = useMemo(
      () => Sesion.puedeAdministrarUsuarios(sesion),
      [sesion]
    );
    const empresasDisponibles = useMemo(
      () => Sesion.obtenerEmpresasDisponibles(sesion),
      [sesion]
    );
    const puedeCambiarEmpresa = useMemo(
      () => Sesion.puedeCambiarEmpresa(sesion),
      [sesion]
    );
    const empresaActualId = empresaActiva?.id || "";
    const tieneAccesoVista = useCallback(
      (module) => {
        return usuarioPuedeUsarModulo(
          sesion,
          empresaActualId,
          module,
          puedeAdministrar
        );
      },
      [sesion, empresaActualId, puedeAdministrar]
    );
    const filtrarItemsPorPermiso = useCallback(
      (items = []) => {
        return items.reduce((acumulado, item) => {
          if (item.items && item.items.length > 0) {
            const hijos = filtrarItemsPorPermiso(item.items);
            if (hijos.length > 0) {
              acumulado.push({ ...item, items: hijos });
            }
            return acumulado;
          }
          if (tieneAccesoVista(item)) {
            acumulado.push(item);
          }
          return acumulado;
        }, []);
      },
      [tieneAccesoVista]
    );
    const gruposDisponibles = useMemo(() => {
      return MODULE_GROUPS.map((group) => {
        const items = filtrarItemsPorPermiso(group.items);
        return { ...group, items };
      }).filter((group) => group.items.length > 0);
    }, [filtrarItemsPorPermiso]);
    const modulosDisponibles = useMemo(
      () =>
        gruposDisponibles.flatMap((group) => flattenLeafModules(group.items)),
      [gruposDisponibles]
    );
    const moduloSeleccionado = useMemo(
      () =>
        modulosDisponibles.find((module) => module.id === selectedModuleId) ||
        null,
      [modulosDisponibles, selectedModuleId]
    );
    const [esMovil, setEsMovil] = useState(() => esPantallaReducida());
    const [sidebarOculta, setSidebarOculta] = useState(() =>
      esPantallaReducida()
    );
    const [gruposAbiertos, setGruposAbiertos] = useState(
      () => new Set(collectAllGroupIds(MODULE_GROUPS))
    );
    const tourStorageKey = useMemo(
      () => construirClaveTourUsuario(sesion),
      [sesion]
    );
    const tourSteps = useMemo(
      () => [
        {
          id: "sidebar-toggle",
          selector: '[data-tour="sidebar-toggle"]',
          title: "Control del menu lateral",
          description:
            "Desde aqui abres o cierras el menu principal para ganar espacio de trabajo.",
        },
        {
          id: "sidebar-menu",
          selector: '[data-tour="sidebar-menu"]',
          title: "Modulos del panel",
          description:
            "En esta lista eliges el modulo que quieres revisar o editar.",
          tip: "Puedes cambiar de modulo en cualquier momento.",
          requiresSidebar: true,
        },
        {
          id: "module-title",
          selector: '[data-tour="module-title"]',
          title: "Modulo activo",
          description:
            "Este encabezado te confirma en que modulo estas trabajando.",
        },
        {
          id: "company-selector",
          selector: '[data-tour="company-selector"]',
          title: "Empresa activa",
          description:
            "Cambia la empresa para cargar su informacion, permisos y saldos correspondientes.",
        },
        {
          id: "notification-bell",
          selector: '[data-tour="notification-bell"]',
          title: "Centro de notificaciones",
          description:
            "Aqui recibes avisos y comentarios pendientes de seguimiento.",
        },
        {
          id: "module-content",
          selector: '[data-tour="module-content"]',
          title: "Area de trabajo",
          description:
            "Aqui se carga el modulo seleccionado para capturar o consultar datos.",
        },
        {
          id: "logout-button",
          selector: '[data-tour="logout-button"]',
          title: "Cerrar sesion",
          description:
            "Usa este boton al terminar para proteger la informacion del sistema.",
        },
      ],
      []
    );
    const [tourActiva, setTourActiva] = useState(false);
    const [tourPasoIndex, setTourPasoIndex] = useState(0);
    const [tourRect, setTourRect] = useState(null);
    const tourPasoActual = tourSteps[tourPasoIndex] || null;
    useEffect(() => {
      setGruposAbiertos(new Set(collectAllGroupIds(gruposDisponibles)));
    }, [gruposDisponibles]);
    useEffect(() => {
      const media =
        typeof window !== "undefined" && window.matchMedia
          ? window.matchMedia("(max-width: 992px)")
          : null;
      const manejarCambio = (evento) => {
        const esChico = evento.matches ?? false;
        setEsMovil(esChico);
        setSidebarOculta(esChico);
      };
      if (media) {
        manejarCambio(media);
        media.addEventListener("change", manejarCambio);
      }
      return () => {
        if (media) {
          media.removeEventListener("change", manejarCambio);
        }
      };
    }, []);
    useEffect(() => {
      if (esMovil) {
        document.body.classList.toggle("sidebar-locked", !sidebarOculta);
      } else {
        document.body.classList.remove("sidebar-locked");
      }
      return () => document.body.classList.remove("sidebar-locked");
    }, [sidebarOculta, esMovil]);
    useEffect(() => {
      if (modulosDisponibles.length === 0) {
        if (selectedModuleId) {
          onSelectModule(null);
        }
        return;
      }
      if (
        !modulosDisponibles.some((modulo) => modulo.id === selectedModuleId)
      ) {
        onSelectModule(modulosDisponibles[0].id);
      }
    }, [
      modulosDisponibles,
      selectedModuleId,
      onSelectModule,
      sesion,
      empresaActiva,
    ]);
    useEffect(() => {
      if (!tourStorageKey || modulosDisponibles.length === 0) {
        return;
      }
      if (leerEstadoTour(tourStorageKey)) {
        return;
      }
      const timer = window.setTimeout(() => {
        setTourPasoIndex(0);
        setTourActiva(true);
      }, 900);
      return () => window.clearTimeout(timer);
    }, [tourStorageKey, modulosDisponibles.length]);

    const iniciarTour = useCallback(() => {
      setTourPasoIndex(0);
      setTourActiva(true);
    }, []);
    const cerrarTour = useCallback(
      (estado = "omitido") => {
        setTourActiva(false);
        setTourPasoIndex(0);
        setTourRect(null);
        guardarEstadoTour(tourStorageKey, estado);
      },
      [tourStorageKey]
    );
    const anteriorPasoTour = useCallback(() => {
      setTourPasoIndex((prev) => Math.max(prev - 1, 0));
    }, []);
    const siguientePasoTour = useCallback(() => {
      setTourPasoIndex((prev) => Math.min(prev + 1, tourSteps.length - 1));
    }, [tourSteps.length]);
    const finalizarTour = useCallback(() => {
      cerrarTour("completado");
    }, [cerrarTour]);
    useEffect(() => {
      if (!tourActiva || !tourPasoActual) {
        return;
      }
      if (tourPasoActual.requiresSidebar && sidebarOculta) {
        setSidebarOculta(false);
      }
      let rafId = 0;
      let timerId = 0;
      const actualizarRect = () => {
        const objetivo = tourPasoActual.selector
          ? document.querySelector(tourPasoActual.selector)
          : null;
        if (!objetivo) {
          setTourRect(null);
          return;
        }
        const rect = objetivo.getBoundingClientRect();
        if (!rect || (rect.width === 0 && rect.height === 0)) {
          setTourRect(null);
          return;
        }
        setTourRect(normalizarRectTour(rect));
      };
      const schedule = () => {
        window.cancelAnimationFrame(rafId);
        rafId = window.requestAnimationFrame(actualizarRect);
      };
      schedule();
      timerId = window.setTimeout(schedule, 320);
      window.addEventListener("resize", schedule);
      window.addEventListener("scroll", schedule, true);
      return () => {
        window.cancelAnimationFrame(rafId);
        window.clearTimeout(timerId);
        window.removeEventListener("resize", schedule);
        window.removeEventListener("scroll", schedule, true);
      };
    }, [tourActiva, tourPasoActual, sidebarOculta]);
    useEffect(() => {
      if (!tourActiva) {
        return;
      }
      const manejarAtajos = (evento) => {
        if (evento.key === "Escape") {
          evento.preventDefault();
          cerrarTour("omitido");
          return;
        }
        if (evento.key === "ArrowLeft") {
          evento.preventDefault();
          anteriorPasoTour();
          return;
        }
        if (evento.key === "ArrowRight") {
          evento.preventDefault();
          if (tourPasoIndex >= tourSteps.length - 1) {
            finalizarTour();
          } else {
            siguientePasoTour();
          }
        }
      };
      document.addEventListener("keydown", manejarAtajos);
      return () => document.removeEventListener("keydown", manejarAtajos);
    }, [
      tourActiva,
      tourPasoIndex,
      tourSteps.length,
      cerrarTour,
      anteriorPasoTour,
      siguientePasoTour,
      finalizarTour,
    ]);

    const toggleGrupo = (groupId) => {
      setGruposAbiertos((prev) => {
        const nueva = new Set(prev);
        if (nueva.has(groupId)) {
          nueva.delete(groupId);
        } else {
          nueva.add(groupId);
        }
        return nueva;
      });
    };
    const seleccionarModulo = (module) => {
      if (module && module.id !== selectedModuleId) {
        onSelectModule(module.id);
        if (esMovil) {
          setSidebarOculta(true);
        }
      }
    };
    const alternarSidebar = () => {
      setSidebarOculta((prev) => !prev);
    };
    const manejarCambioEmpresa = (evento) => {
      const nuevoId = evento.target.value;
      if (onChangeEmpresa) {
        onChangeEmpresa(nuevoId);
      }
    };
    const layoutClassName = `app-layout${
      sidebarOculta ? " sidebar-hidden" : ""
    }`;
    const mostrarBackdrop = esMovil && !sidebarOculta;
    const manejarActualizarNotificaciones = () => {
      if (onRefreshNotifications) {
        onRefreshNotifications();
      }
    };
    const manejarMarcarNotificacion = (id) => {
      if (onMarkNotification) {
        onMarkNotification(id);
      }
    };
    const manejarAbrirNotificacion = (item) => {
      if (onOpenNotification) {
        onOpenNotification(item);
        return;
      }
      if (item?.id) {
        manejarMarcarNotificacion(item.id);
      }
    };
    return /* @__PURE__ */ React.createElement(
      "div",
      { className: layoutClassName },
      mostrarBackdrop &&
        /* @__PURE__ */ React.createElement("button", {
          type: "button",
          className: "sidebar-backdrop",
          onClick: () => setSidebarOculta(true),
          "aria-label": "Cerrar men\xFA lateral",
        }),
      /* @__PURE__ */ React.createElement(
        "aside",
        { className: "app-sidebar", "aria-label": "Navegaci\xF3n principal" },
        /* @__PURE__ */ React.createElement(
          "div",
          { className: "sidebar-header" },
          /* @__PURE__ */ React.createElement("img", {
            src: "icono/amcham.png",
            alt: "AmCham",
            className: "sidebar-logo",
          })
        ),
        /* @__PURE__ */ React.createElement(
          "div",
          { className: "sidebar-menu", "data-tour": "sidebar-menu" },
          gruposDisponibles.map((group) =>
            /* @__PURE__ */ React.createElement(SidebarGroup, {
              key: group.id,
              group,
              modules: group.items,
              selectedModule: moduloSeleccionado,
              onSelect: seleccionarModulo,
              open: gruposAbiertos.has(group.id),
              onToggle: toggleGrupo,
              gruposAbiertos,
              toggleGrupo: toggleGrupo,
            })
          )
        )
      ),
      /* @__PURE__ */ React.createElement(
        "main",
        { className: "app-content" },
        /* @__PURE__ */ React.createElement(
          "div",
          { className: "top-bar" },
          /* @__PURE__ */ React.createElement(
            "div",
            { className: "top-bar-left" },
            /* @__PURE__ */ React.createElement(
              "button",
              {
                type: "button",
                className: `sidebar-toggle-btn${
                  sidebarOculta ? " collapsed" : ""
                }`,
                onClick: alternarSidebar,
                "aria-label": sidebarOculta
                  ? "Mostrar men\xFA lateral"
                  : "Ocultar men\xFA lateral",
                "aria-expanded": !sidebarOculta,
                "data-tour": "sidebar-toggle",
              },
              /* @__PURE__ */ React.createElement(
                "span",
                { "aria-hidden": "true" },
                "\u2630"
              )
            ),
            /* @__PURE__ */ React.createElement(
              "div",
              null,
              /* @__PURE__ */ React.createElement(
                "h2",
                { "data-tour": "module-title" },
                moduloSeleccionado
                  ? moduloSeleccionado.label
                  : "Selecciona un m\xF3dulo"
              ),
              moduloSeleccionado?.badge &&
                /* @__PURE__ */ React.createElement(
                  "span",
                  { className: "badge rounded-pill mt-2" },
                  moduloSeleccionado.badge
                )
            )
          ),
          /* @__PURE__ */ React.createElement(
            "div",
            { className: "top-bar-right d-flex align-items-center gap-3" },
            /* @__PURE__ */ React.createElement(
              "button",
              {
                type: "button",
                className: "btn btn-outline-primary btn-sm tour-trigger-btn",
                onClick: iniciarTour,
              },
              "Tour guiado"
            ),
            /* @__PURE__ */ React.createElement(NotificationBell, {
              notifications,
              onRefresh: manejarActualizarNotificaciones,
              onMarkAsRead: manejarMarcarNotificacion,
              onMarkAllAsRead: onMarkAllNotifications,
              onOpenNotification: manejarAbrirNotificacion,
            }),
            /* @__PURE__ */ React.createElement(
              "div",
              { className: "company-selector", "data-tour": "company-selector" },
              /* @__PURE__ */ React.createElement(
                "label",
                { htmlFor: "companyFilter", className: "fw-semibold mb-0" },
                "Empresa:"
              ),
              /* @__PURE__ */ React.createElement(
                "select",
                {
                  id: "companyFilter",
                  className: "form-select form-select-sm",
                  value: empresaActualId,
                  onChange: manejarCambioEmpresa,
                  disabled:
                    !puedeCambiarEmpresa || empresasDisponibles.length === 0,
                },
                empresasDisponibles.length === 0 &&
                  /* @__PURE__ */ React.createElement(
                    "option",
                    { value: "" },
                    "Sin empresas disponibles"
                  ),
                  empresasDisponibles.map((empresa) =>
                    /* @__PURE__ */ React.createElement(
                      "option",
                      { key: empresa.id, value: empresa.id },
                      empresa.etiqueta ||
                        empresa.nombre ||
                        "Selecciona una empresa"
                    )
                  )
                )
              ),
              /* @__PURE__ */ React.createElement(
                "button",
                {
                  type: "button",
                  className: "btn btn-outline-secondary btn-sm top-bar-logout",
                  onClick: onLogout,
                  "data-tour": "logout-button",
                },
                "Cerrar sesi\xF3n"
              )
            )
          ),
        /* @__PURE__ */ React.createElement(
          "div",
          { className: "content-wrapper" },
          /* @__PURE__ */ React.createElement(
            "div",
            { className: "content-card", "data-tour": "module-content" },
            moduloSeleccionado
              ? /* @__PURE__ */ React.createElement("iframe", {
                  key: `${moduloSeleccionado.id}-${
                    empresaActualId || "sin-empresa"
                  }`,
                  src: moduloSeleccionado.path,
                  title: moduloSeleccionado.label,
                  className: "content-iframe",
                  allow: "clipboard-read; clipboard-write",
                })
              : /* @__PURE__ */ React.createElement("div", {
                  className: "empty-state",
            })
          )
        ),
      /* @__PURE__ */ React.createElement(GuidedTourOverlay, {
        active: tourActiva,
        step: tourPasoActual,
        stepIndex: tourPasoIndex,
        totalSteps: tourSteps.length,
        highlightRect: tourRect,
        onPrevious: anteriorPasoTour,
        onNext: siguientePasoTour,
        onClose: () => cerrarTour("omitido"),
        onFinish: finalizarTour,
      })
      )
    );
  };
  const App = () => {
    // Verificación crítica de sesión al montar
    const [sesion, setSesion] = useState(() => {
      const s = Sesion.obtener();
      if (!s || !s.tokenAcceso || !s.usuario) {
        console.error("❌ No hay sesión válida al montar App");
        window.location.replace("login.html");
        return null;
      }
      return s;
    });

    const [empresaActiva, setEmpresaActiva] = useState(() =>
      Sesion.obtenerEmpresaActiva()
    );
    const [moduloSeleccionado, setModuloSeleccionado] = useState(null);
    const [notificaciones, setNotificaciones] = useState([]);

    // Verificar sesión periódicamente
    useEffect(() => {
      const verificarSesion = () => {
        const s = Sesion.obtener();
        if (!s || !s.tokenAcceso || !s.usuario) {
          console.warn("⚠️ Sesión perdida, redirigiendo a login");
          window.location.replace("login.html");
        }
      };

      // Verificar cada 30 segundos
      const interval = setInterval(verificarSesion, 30000);
      return () => clearInterval(interval);
    }, []);

    const seleccionarModulo = useCallback((moduloId) => {
      setModuloSeleccionado(moduloId);
    }, []);
    const manejarLogin = (datosSesion) => {
      const sesionNormalizada = datosSesion || Sesion.obtener();
      setSesion(sesionNormalizada);
      setEmpresaActiva(Sesion.obtenerEmpresaActiva(sesionNormalizada));
    };
    const manejarLogout = () => {
      Sesion.limpiar();
      setSesion(null);
      setEmpresaActiva(null);
      setModuloSeleccionado(null);
      setNotificaciones([]);
    };
    const manejarCambioEmpresa = useCallback((empresaId) => {
      const nuevaEmpresa = Sesion.establecerEmpresaActiva(empresaId);
      setEmpresaActiva(nuevaEmpresa);
      setSesion(Sesion.obtener());
    }, []);
    const cargarNotificaciones = useCallback(async () => {
      const sesionActual = Sesion.obtener();
      if (!sesionActual || !sesionActual.tokenAcceso) {
        console.warn("⚠️ No hay sesión para cargar notificaciones");
        setNotificaciones([]);
        return;
      }
      try {
        const respuesta = await fetch(`${API_BASE}/notificaciones?limite=10`, {
          headers: Sesion.headersAutenticacion(),
        });

        // Si es 401, sesión expirada
        if (respuesta.status === 401) {
          console.error("❌ Sesión expirada (401)");
          Sesion.cerrar(); // Limpia sesión y redirige al login
          return;
        }

        const datos = await respuesta.json();
        if (!respuesta.ok) {
          throw new Error(
            datos.mensaje || "No fue posible obtener las notificaciones."
          );
        }
        setNotificaciones(datos.notificaciones || []);
      } catch (error) {
        console.warn("Error al cargar notificaciones", error);
      }
    }, []);
    const marcarNotificacion = useCallback(
      async (id) => {
        if (!id) return;
        try {
          const respuesta = await fetch(
            `${API_BASE}/notificaciones/${id}/leida`,
            {
              method: "PATCH",
              headers: Sesion.headersAutenticacion(),
            }
          );
          if (!respuesta.ok) {
            const datos = await respuesta.json();
            throw new Error(
              datos.mensaje || "No fue posible actualizar la notificaci\xF3n."
            );
          }
          cargarNotificaciones();
        } catch (error) {
          console.warn("Error al marcar notificaci\xF3n como le\xEDda", error);
        }
      },
      [cargarNotificaciones]
    );
    const abrirNotificacion = useCallback(
      async (item) => {
        if (!item) return;
        const destino = parsearDestinoComentario(item);
        if (destino) {
          const empresaActualId = String(
            Sesion.obtenerEmpresaActiva()?.id || ""
          );
          const empresaDestinoId = destino.empresaId
            ? String(destino.empresaId)
            : null;
          if (empresaDestinoId && empresaDestinoId !== empresaActualId) {
            const nuevaEmpresa = Sesion.establecerEmpresaActiva(empresaDestinoId);
            setEmpresaActiva(nuevaEmpresa);
            setSesion(Sesion.obtener());
          }
          const moduloId = resolverModuloComentario(
            destino.modulo || item.modulo || ""
          );
          if (moduloId) {
            setModuloSeleccionado(moduloId);
          }
          const payload = {
            tipo: "comentario",
            celdaId: destino.celdaId,
            modulo: destino.modulo || item.modulo || "",
            empresaId:
              empresaDestinoId ||
              String(Sesion.obtenerEmpresaActiva()?.id || "") ||
              null,
            anio: destino.anio,
            capitulo: destino.capitulo || null,
            ts: Date.now(),
          };
          try {
            localStorage.setItem(DESTINO_COMENTARIO_KEY, JSON.stringify(payload));
          } catch (storageError) {
            console.warn(
              "No fue posible guardar el destino del comentario.",
              storageError
            );
          }
        }
        if (item.id) {
          await marcarNotificacion(item.id);
        }
      },
      [marcarNotificacion]
    );
    const limpiarTodasNotificaciones = useCallback(async () => {
      try {
        const respuesta = await fetch(`${API_BASE}/notificaciones/limpiar`, {
          method: "PATCH",
          headers: Sesion.headersAutenticacion(),
        });
        if (!respuesta.ok) {
          const datos = await respuesta.json();
          throw new Error(
            datos.mensaje || "No fue posible limpiar las notificaciones."
          );
        }
        cargarNotificaciones();
      } catch (error) {
        console.warn("Error al limpiar notificaciones", error);
      }
    }, [cargarNotificaciones]);
    useEffect(() => {
      if (!sesion) {
        setNotificaciones([]);
        return;
      }
      cargarNotificaciones();
      const intervalo = setInterval(cargarNotificaciones, 6e4);
      return () => clearInterval(intervalo);
    }, [sesion, empresaActiva, cargarNotificaciones]);
    if (!sesion) {
      return /* @__PURE__ */ React.createElement(LoginView, {
        onLogin: manejarLogin,
      });
    }
    return /* @__PURE__ */ React.createElement(DashboardLayout, {
      sesion,
      selectedModuleId: moduloSeleccionado,
      onSelectModule: seleccionarModulo,
      onLogout: manejarLogout,
      empresaActiva,
      onChangeEmpresa: manejarCambioEmpresa,
      notifications: notificaciones,
      onRefreshNotifications: cargarNotificaciones,
      onMarkNotification: marcarNotificacion,
      onMarkAllNotifications: limpiarTodasNotificaciones,
      onOpenNotification: abrirNotificacion,
    });
  };
  ReactDOM.createRoot(document.getElementById("root")).render(
    /* @__PURE__ */ React.createElement(App, null)
  );
})();
