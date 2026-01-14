const { useState, useEffect, useMemo, useCallback } = React;

const API_BASE = 'http://localhost:3000/api';

const esPantallaReducida = () =>
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(max-width: 992px)').matches
    : false;

const MODULE_GROUPS = [
  {
    id: 'panel-resumenes',
    label: 'Summary',
    items: [
      { id: 'resumen', label: 'Resumen', path: 'RESUMEN.html', badge: 'summary', permiso: 'RESUMEN' },
      { id: 'graficas', label: 'Gráficas', path: 'Graficas.html', badge: 'summary', permiso: 'RESUMEN' }
    ]
  },
  {
    id: 'modulos-planeacion',
    label: 'Divisiones',
    items: [
      { id: 'presupuestos', label: 'Presupuestos', path: 'Presupuestos.html', badge: 'ppto', permiso: 'Presupuestos' },
      { id: 'comites', label: 'Comit�s', path: 'Comit�s.html', permiso: 'Comit�s' },
      { id: 'comunicacion', label: 'Comunicaci�n', path: 'Comunicaci�n.html', permiso: 'Comunicaci�n' },
      { id: 'direccion', label: 'Direcci�n', path: 'Direcci�n.html', permiso: 'Direcci�n' },
      { id: 'eventos', label: 'Eventos', path: 'Eventos.html', permiso: 'Eventos' },
      {
        id: 'finanzas-cluster',
        label: 'Finanzas',
        badge: 'finanzas',
        items: [
          { id: 'finanzas', label: 'Finanzas', path: 'Finanzas.html', badge: 'finanzas', permiso: 'Finanzas' },
          { id: 'gastosgenerales', label: 'Gastos Generales', badge: 'finanzas', path: 'GastosGenerales.html', permiso: 'Gastos Generales' },
          { id: 'nomina', label: 'N�mina', path: 'Nomina.html', badge: 'finanzas', permiso: 'N�mina' }
        ]
      },
      { id: 'gtos-corporativos', label: 'Gastos Corporativos', path: 'Gtos_Corporativos.html', permiso: 'Gtos Corporativos' },
      { id: 'membresia', label: 'Membres�a', path: 'Membres�a.html', permiso: 'Membres�a' },
      { id: 'rh', label: 'Recursos Humanos', path: 'RH.html', permiso: 'RH' },
      { id: 'serv-membresia', label: 'Servicios a la Membres�a', path: 'Serv_Membres�a.html', permiso: 'Serv Membres�a' },
      { id: 'tic', label: 'T&IC', path: 'T&IC.html', permiso: 'T&IC' },
      { id: 'vpe', label: 'VPE', path: 'VPE.html', permiso: 'VPE' }
    ]
  },
  {
    id: 'panel-administracion',
    label: 'Configuraci�n',
    items: [
      { id: 'perfil', label: 'Mi Perfil', path: 'perfil.html', badge: 'perfil', public: true },
      { id: 'usuarios', label: 'Administrar usuarios', path: 'usuarios.html', badge: 'Permisos', requiresAdmin: true },
      { id: 'crear-usuario', label: 'Crear usuario', path: 'crear_usuario.html', requiresAdmin: true },
      { id: 'plantillas', label: 'Gestor de Plantillas', path: 'plantillas.html', requiresAdmin: true, permiso: 'Layouts' }
    ]
  }
];


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



const moduloDisponiblePorEmpresa = (empresaId, moduloId) => {
  const config = window.CapitulosModulos;
  if (!config || typeof config.moduloDisponible !== 'function') {
    return true;
  }
  return config.moduloDisponible(empresaId, moduloId);
};

const usuarioPuedeUsarModulo = (sesion, empresaId, modulo, puedeAdministrar) => {
  if (!sesion || !sesion.usuario) {
    return false;
  }
  const puedeAdmin = typeof puedeAdministrar === 'boolean' ? puedeAdministrar : Sesion.puedeAdministrarUsuarios(sesion);
  if (modulo.requiresAdmin && !puedeAdmin) {
    return false;
  }
  if (modulo.public) {
    return true;
  }
  if (!moduloDisponiblePorEmpresa(empresaId, modulo.id)) {
    return false;
  }
  const usuario = (sesion.usuario.usuario || '').toString().trim().toUpperCase();
  if (usuario === 'ICONET' || sesion.usuario.esAdminGlobal) {
    return true;
  }
  const permisosEmpresa = sesion.usuario.permisosPorEmpresa?.[empresaId] || {};
  const clave = modulo.permiso || modulo.label;
  const acciones = permisosEmpresa[clave];
  if (!acciones) {
    return false;
  }
  // Incluir permiso "Ver" (puede_leer) para mostrar el módulo
  return Boolean(acciones.Ver || acciones['Cargar y guardar'] || acciones.Revisar || acciones.Aprobar);
};

const obtenerNombreUsuario = (sesion) => {
  if (!sesion || !sesion.usuario) {
    return 'Sin sesión activa';
  }
  const { nombres, apellidoPrimero, apellidoSegundo, usuario } = sesion.usuario;
  const nombre = [nombres, apellidoPrimero, apellidoSegundo].filter(Boolean).join(' ');
  return nombre || usuario || 'Usuario';
};

const LoginView = ({ onLogin }) => {
  const [form, setForm] = useState({ usuario: '', contrasena: '' });
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState('danger');
  const toastRef = React.useRef(null);
  const [mostrarContrasena, setMostrarContrasena] = useState(false);

  useEffect(() => {
    if (error) {
      // Muestra toast para errores visibles aunque haya scroll
      try {
        const ctor = window.bootstrap && window.bootstrap.Toast;
        if (ctor && toastRef.current) {
          setToastMsg(error);
          setToastType('danger');
          const t = new ctor(toastRef.current);
          t.show();
        }
      } catch (_) { /* noop */ }
    }
  }, [error]);

  useEffect(() => {
    Sesion.limpiar();
  }, []);

  const actualizarCampo = (evento) => {
    const { name, value } = evento.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const mostrarToast = (mensaje, tipo = 'danger') => {
    setToastMsg(mensaje);
    setToastType(tipo);
    try {
      const ctor = window.bootstrap && window.bootstrap.Toast;
      if (ctor && toastRef.current) {
        const t = new ctor(toastRef.current);
        t.show();
      }
    } catch (e) {
      // silencioso
    }
  };

  const manejarEnvio = async (evento) => {
    evento.preventDefault();
    setError('');

    if (!form.usuario || !form.contrasena) {
      setError('Completa usuario y contraseña.');
      return;
    }

    setCargando(true);
    try {
      const respuesta = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario: form.usuario,
          contrasena: form.contrasena
        })
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        throw new Error(datos.mensaje || 'No fue posible iniciar sesión.');
      }
      const sesionNormalizada = Sesion.guardar(datos) || datos;
      onLogin(sesionNormalizada);
    } catch (err) {
      console.error('Error de inicio de sesión', err);
      setError(err.message || 'Ocurrió un problema durante el inicio de sesión.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="d-flex align-items-center justify-content-center h-100">
      <main className="login-card" aria-labelledby="titulo-login">
        <header className="mb-4 text-center text-md-start">
          <h1 id="titulo-login" className="h3 mb-1">AmCham</h1>
        </header>

        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={manejarEnvio} autoComplete="off">
          <div className="mb-3">
            <label htmlFor="usuario" className="form-label fw-semibold">Usuario <span className="text-danger">*</span></label>
            <input
              type="text"
              id="usuario"
              name="usuario"
              className="form-control form-control-lg"
              value={form.usuario}
              onChange={actualizarCampo}
              disabled={cargando}
              autoComplete="username"
              required
            />
          </div>

          <div className="mb-3">
            <label htmlFor="contrasena" className="form-label fw-semibold">Contraseña <span className="text-danger">*</span></label>
            <div className="input-group">
              <input
                type={mostrarContrasena ? 'text' : 'password'}
                id="contrasena"
                name="contrasena"
                className="form-control form-control-lg"
                value={form.contrasena}
                onChange={actualizarCampo}
                disabled={cargando}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="btn btn-outline-secondary"
                disabled={cargando}
                aria-pressed={mostrarContrasena}
                aria-label={mostrarContrasena ? 'Ocultar contrase' : 'Mostrar contrase'}
                onClick={() => setMostrarContrasena((v) => !v)}
              >
                {mostrarContrasena ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-eye-slash" viewBox="0 0 16 16"><path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7 7 0 0 0-2.79.588l.77.771A6 6 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13 13 0 0 1 14.828 8q-.086.13-.195.288c-.335.48-.83 1.12-1.465 1.755q-.247.248-.517.486z"/><path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829zm-2.943 1.299.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829"/><path d="M3.35 5.47q-.27.24-.518.487A13 13 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.772.772A7 7 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884-12-12 .708-.708 12 12z"/></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-eye" viewBox="0 0 16 16"><path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8M1.173 8a13 13 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5s3.879 1.168 5.168 2.457A13 13 0 0 1 14.828 8q-.086.13-.195.288c-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12 8 12s-3.879-1.168-5.168-2.457A13 13 0 0 1 1.172 8z"/><path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5"/></svg>
                )}
              </button>
            </div>
          </div>

      <button type="submit" className="btn btn-verde w-100" disabled={cargando}>
        {cargando && <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>}
        {cargando ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </main>

      {/* Toast flotante para errores de login */}
      <div className="position-fixed bottom-0 end-0 p-3" style={{ zIndex: 1080 }}>
        <div
          ref={toastRef}
          className={`toast align-items-center text-white ${toastType === 'success' ? 'bg-success' : 'bg-danger'} border-0`}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="d-flex">
            <div className="toast-body">{toastMsg || 'Aviso'}</div>
            <button type="button" className="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Cerrar"></button>
          </div>
        </div>
      </div>
    </div>
  );
};

const SidebarGroup = ({ group, modules, selectedModule, onSelect, open, onToggle, gruposAbiertos, toggleGrupo }) => {

  if (modules.length === 0) {

    return null;

  }

  return (

    <div className="sidebar-group">

      <button

        type="button"

        className="submenu-toggle"

        aria-expanded={open}

        onClick={() => onToggle(group.id)}

      >

        <span>{group.label}</span>

        {group.badge && <span className="badge rounded-pill module-badge ms-2">{group.badge}</span>}

        <span className="module-count">{modules.length}</span>

      </button>

      {open && (

        <div className="submenu-content">

          {modules.map((module) => (

            <SidebarModuleItem

              key={module.id}

              module={module}

              selectedModule={selectedModule}

              onSelect={onSelect}

              gruposAbiertos={gruposAbiertos}

              toggleGrupo={toggleGrupo}

            />

          ))}

        </div>

      )}

    </div>

  );

};



const SidebarModuleItem = ({ module, selectedModule, onSelect, gruposAbiertos, toggleGrupo, level = 1 }) => {

  if (module.items && module.items.length > 0) {

    const abierto = gruposAbiertos.has(module.id);

    return (

      <div className="sidebar-subgroup" style={{ paddingLeft: level * 8 + 'px' }}>

        <button

          type="button"

          className="submenu-toggle submenu-toggle-nested"

          aria-expanded={abierto}

          onClick={() => toggleGrupo(module.id)}

        >

          <span>{module.label}</span>

          {module.badge && <span className="badge rounded-pill module-badge ms-2">{module.badge}</span>}

          <span className="module-count">{module.items.length}</span>

        </button>

        {abierto && (

          <div className="submenu-content">

            {module.items.map((child) => (

              <SidebarModuleItem

                key={child.id}

                module={child}

                selectedModule={selectedModule}

                onSelect={onSelect}

                gruposAbiertos={gruposAbiertos}

                toggleGrupo={toggleGrupo}

                level={level + 1}

              />

            ))}

          </div>

        )}

      </div>

    );

  }



  const activo = selectedModule?.id === module.id;

  return (

    <button

      type="button"

      className={'sidebar-link ' + (activo ? 'active' : '')}

      onClick={() => onSelect(module)}

    >

      <span>{module.label}</span>

      {module.badge && <span className="badge rounded-pill">{module.badge}</span>}

    </button>

  );

};



const NotificationBell = ({ notifications = [], onRefresh, onMarkAsRead }) => {
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
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const toggle = () => setOpen((prev) => !prev);
  const marcarLeida = (id) => {
    if (onMarkAsRead) {
      onMarkAsRead(id);
    }
  };

  const renderFecha = (valor) => {
    if (!valor) return '';
    try {
      return new Date(valor).toLocaleString('es-MX');
    } catch (e) {
      return valor;
    }
  };

  return (
    <div className={`notification-bell${open ? ' notification-bell--open' : ''}`} ref={bellRef}>
      <button
        type="button"
        className="notification-bell__button"
        onClick={toggle}
        aria-expanded={open}
        aria-label="Notificaciones"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          fill="currentColor"
          className="notification-bell__icon"
          viewBox="0 0 16 16"
          aria-hidden="true"
        >
          <path d="M8 16a2 2 0 0 0 1.985-1.75H6.015A2 2 0 0 0 8 16m6-6c0-3.071-1.639-5.64-4.5-6.32V3a1.5 1.5 0 0 0-3 0v.68C3.64 4.36 2 6.929 2 10v2l-1 1v1h14v-1l-1-1z" />
        </svg>
        {unread > 0 && <span className="notification-bell__badge">{unread}</span>}
      </button>
      {open && (
        <div className="notification-panel" role="dialog" aria-label="Notificaciones recientes">
          <div className="notification-panel__header">
            <strong>Notificaciones</strong>
            <button type="button" className="btn btn-link btn-sm p-0" onClick={onRefresh}>
              Actualizar
            </button>
          </div>
          <div className="notification-panel__body">
            {notifications.length === 0 ? (
              <p className="text-muted small mb-0">Sin notificaciones pendientes.</p>
            ) : (
              <ul className="notification-panel__list">
                {notifications.map((item) => (
                  <li
                    key={item.id}
                    className={`notification-panel__item${!item.leidaEn ? ' notification-panel__item--new' : ''}`}
                  >
                    <div>
                      <p className="notification-panel__title mb-1">{item.titulo}</p>
                      <p className="notification-panel__message mb-1">{item.mensaje}</p>
                      <small className="text-muted">{renderFecha(item.creadaEn)}</small>
                    </div>
                    {!item.leidaEn && (
                      <button
                        type="button"
                        className="btn btn-link btn-sm p-0"
                        onClick={() => marcarLeida(item.id)}
                      >
                        Marcar como leída
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
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
  onMarkNotification
}) => {
  const puedeAdministrar = useMemo(() => Sesion.puedeAdministrarUsuarios(sesion), [sesion]);

  const empresasDisponibles = useMemo(() => Sesion.obtenerEmpresasDisponibles(sesion), [sesion]);
  const puedeCambiarEmpresa = useMemo(() => Sesion.puedeCambiarEmpresa(sesion), [sesion]);
  const empresaActualId = empresaActiva?.id || '';

  const tieneAccesoVista = useCallback((module) => {
    return usuarioPuedeUsarModulo(sesion, empresaActualId, module, puedeAdministrar);
  }, [sesion, empresaActualId, puedeAdministrar]);

  const filtrarItemsPorPermiso = useCallback((items = []) => {

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

  }, [tieneAccesoVista]);



  const gruposDisponibles = useMemo(() => {

    return MODULE_GROUPS.map((group) => {

      const items = filtrarItemsPorPermiso(group.items);

      return { ...group, items };

    }).filter((group) => group.items.length > 0);

  }, [filtrarItemsPorPermiso]);



  const modulosDisponibles = useMemo(

    () => gruposDisponibles.flatMap((group) => flattenLeafModules(group.items)),

    [gruposDisponibles]

  );

  const moduloSeleccionado = useMemo(

    () => modulosDisponibles.find((module) => module.id === selectedModuleId) || null,

    [modulosDisponibles, selectedModuleId]

  );



  const [esMovil, setEsMovil] = useState(() => esPantallaReducida());
  const [sidebarOculta, setSidebarOculta] = useState(() => esPantallaReducida());

  const [gruposAbiertos, setGruposAbiertos] = useState(() => new Set(collectAllGroupIds(MODULE_GROUPS)));

  useEffect(() => {
    const media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(max-width: 992px)') : null;
    const manejarCambio = (evento) => {
      const esChico = evento.matches ?? false;
      setEsMovil(esChico);
      setSidebarOculta(esChico);
    };
    if (media) {
      manejarCambio(media);
      media.addEventListener('change', manejarCambio);
    }
    return () => {
      if (media) {
        media.removeEventListener('change', manejarCambio);
      }
    };
  }, []);

  useEffect(() => {
    if (esMovil) {
      document.body.classList.toggle('sidebar-locked', !sidebarOculta);
    } else {
      document.body.classList.remove('sidebar-locked');
    }
    return () => document.body.classList.remove('sidebar-locked');
  }, [sidebarOculta, esMovil]);

  useEffect(() => {

    setGruposAbiertos(new Set(collectAllGroupIds(gruposDisponibles)));

  }, [gruposDisponibles]);



  useEffect(() => {

    if (modulosDisponibles.length === 0) {

      if (selectedModuleId) {

        onSelectModule(null);

      }

      return;

    }

    if (!modulosDisponibles.some((modulo) => modulo.id === selectedModuleId)) {

      onSelectModule(modulosDisponibles[0].id);

    }

  }, [modulosDisponibles, selectedModuleId, onSelectModule, sesion, empresaActiva]);



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

  const layoutClassName = `app-layout${sidebarOculta ? ' sidebar-hidden' : ''}`;
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

  return (
    <div className={layoutClassName}>
      {mostrarBackdrop && (
        <button
          type="button"
          className="sidebar-backdrop"
          onClick={() => setSidebarOculta(true)}
          aria-label="Cerrar menú lateral"
        />
      )}
      <aside className="app-sidebar" aria-label="Navegación principal">
        <div className="sidebar-header">
          <img src="../icono/amcham.png" alt="AmCham" className="sidebar-logo" />
        </div>
          <div className="sidebar-menu">
            {gruposDisponibles.map((group) => (
              <SidebarGroup
                key={group.id}
                group={group}
                modules={group.items}
                selectedModule={moduloSeleccionado}
                onSelect={seleccionarModulo}
                open={gruposAbiertos.has(group.id)}
                onToggle={toggleGrupo}
              />
            ))}
          </div>
        </aside>
        <main className="app-content">
          <div className="top-bar">
          <div className="top-bar-left">
            <button
              type="button"
              className={`sidebar-toggle-btn${sidebarOculta ? ' collapsed' : ''}`}
              onClick={alternarSidebar}
              aria-label={sidebarOculta ? 'Mostrar menú lateral' : 'Ocultar menú lateral'}
              aria-expanded={!sidebarOculta}
            >
              <span aria-hidden="true">☰</span>
            </button>
            <div>
              <h2>{moduloSeleccionado ? moduloSeleccionado.label : 'Selecciona un módulo'}</h2>
              {moduloSeleccionado?.badge && (
                <span className="badge rounded-pill mt-2">{moduloSeleccionado.badge}</span>
              )}
            </div>
          </div>
            <div className="top-bar-right d-flex align-items-center gap-3">
              <NotificationBell
                notifications={notifications}
                onRefresh={manejarActualizarNotificaciones}
                onMarkAsRead={manejarMarcarNotificacion}
              />
              <div className="company-selector">
                <label htmlFor="companyFilter" className="fw-semibold mb-0">Empresa:</label>
                <select
                  id="companyFilter"
                  className="form-select form-select-sm"
                  value={empresaActualId}
                  onChange={manejarCambioEmpresa}
                  disabled={!puedeCambiarEmpresa || empresasDisponibles.length === 0}
                >
                  {empresasDisponibles.length === 0 && <option value="">Sin empresas disponibles</option>}
                  {empresasDisponibles.map((empresa) => (
                    <option key={empresa.id} value={empresa.id}>
                      {empresa.etiqueta || empresa.nombre || 'Selecciona una empresa'}
                    </option>
                  ))}
                </select>
              </div>
              <button type="button" className="btn btn-outline-secondary btn-sm top-bar-logout" onClick={onLogout}>
                {"Cerrar sesi\u00F3n"}
              </button>
            </div>
          </div>
        <div className="content-wrapper">
          <div className="content-card">
            {moduloSeleccionado ? (
              <iframe
                key={`${moduloSeleccionado.id}-${empresaActualId || 'sin-empresa'}`}
                src={moduloSeleccionado.path}
                title={moduloSeleccionado.label}
                className="content-iframe"
                allow="clipboard-read; clipboard-write"
              ></iframe>
            ) : (
              <div className="empty-state">
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

const App = () => {
  const [sesion, setSesion] = useState(() => Sesion.obtener());
  const [empresaActiva, setEmpresaActiva] = useState(() => Sesion.obtenerEmpresaActiva());
  const [moduloSeleccionado, setModuloSeleccionado] = useState(null);
  const [notificaciones, setNotificaciones] = useState([]);

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
    if (!sesionActual) {
      setNotificaciones([]);
      return;
    }
    try {
      const respuesta = await fetch(`${API_BASE}/notificaciones?limite=10`, {
        headers: Sesion.headersAutenticacion()
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        throw new Error(datos.mensaje || 'No fue posible obtener las notificaciones.');
      }
      setNotificaciones(datos.notificaciones || []);
    } catch (error) {
      console.warn('Error al cargar notificaciones', error);
    }
  }, []);

  const marcarNotificacion = useCallback(async (id) => {
    if (!id) return;
    try {
      const respuesta = await fetch(`${API_BASE}/notificaciones/${id}/leida`, {
        method: 'PATCH',
        headers: Sesion.headersAutenticacion()
      });
      if (!respuesta.ok) {
        const datos = await respuesta.json();
        throw new Error(datos.mensaje || 'No fue posible actualizar la notificación.');
      }
      cargarNotificaciones();
    } catch (error) {
      console.warn('Error al marcar notificación como leída', error);
    }
  }, [cargarNotificaciones]);

  useEffect(() => {
    if (!sesion) {
      setNotificaciones([]);
      return;
    }
    cargarNotificaciones();
    const intervalo = setInterval(cargarNotificaciones, 60000);
    return () => clearInterval(intervalo);
  }, [sesion, empresaActiva, cargarNotificaciones]);

  if (!sesion) {
    return <LoginView onLogin={manejarLogin} />;
  }

  return (
    <DashboardLayout
      sesion={sesion}
      selectedModuleId={moduloSeleccionado}
      onSelectModule={seleccionarModulo}
      onLogout={manejarLogout}
      empresaActiva={empresaActiva}
      onChangeEmpresa={manejarCambioEmpresa}
      notifications={notificaciones}
      onRefreshNotifications={cargarNotificaciones}
      onMarkNotification={marcarNotificacion}
    />
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
