const { useState, useEffect, useMemo, useCallback } = React;

const API_BASE = 'http://localhost:3000/api';

const MODULE_GROUPS = [
  {
    id: 'panel-resumenes',
    label: 'Paneles',
    items: [
      { id: 'presupuestos', label: 'Presupuestos', path: 'Presupuestos.html', badge: 'ppto' },
      { id: 'summary', label: 'Summary', path: 'SUMMARY.html', badge: 'summary', permiso: 'SUMMARY' }
    ]
  },
  {
    id: 'resumen-areas',
    label: 'Resumen',
    items: [
      { id: 'resumen', label: 'Resumen', path: 'RESUMEN.html', badge: 'ppto', permiso: 'RESUMEN' },
      { id: 'membresia', label: 'Membresía', path: 'Membresía.html' },
      { id: 'eventos', label: 'Eventos', path: 'Eventos.html' },
      { id: 'comunicacion', label: 'Comunicación', path: 'Comunicación.html' },
      { id: 'serv-membresia', label: 'Servicios a la Membresía', path: 'Serv_Membresía.html' },
      { id: 'comites', label: 'Comités', path: 'Comités.html' },
      { id: 'tic', label: 'T&IC', path: 'T&IC.html' },
      { id: 'rh', label: 'Recursos Humanos', path: 'RH.html' },
      { id: 'vpe', label: 'VPE', path: 'VPE.html' },
      { id: 'finanzas', label: 'Finanzas', path: 'Finanzas.html' },
      { id: 'gtos-corporativos', label: 'Gastos Corporativos', path: 'Gtos_Corporativos.html' }
    ]
  },
  {
    id: 'panel-administracion',
    label: 'Administración',
    items: [
      { id: 'usuarios', label: 'Administrar usuarios', path: 'usuarios.html', badge: 'Permisos', requiresAdmin: true },
      { id: 'crear-usuario', label: 'Crear usuario', path: 'crear_usuario.html', requiresAdmin: true }
    ]
  }
];

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

const SidebarGroup = ({ group, modules, selectedModule, onSelect, open, onToggle }) => {
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
        <span className="module-count">{modules.length}</span>
      </button>
      {open && (
        <div className="submenu-content">
          {modules.map((module) => {
            const activo = selectedModule?.id === module.id;
            return (
              <button
                key={module.id}
                type="button"
                className={`sidebar-link ${activo ? 'active' : ''}`}
                onClick={() => onSelect(module)}
              >
                <span>{module.label}</span>
                {module.badge && <span className="badge rounded-pill">{module.badge}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const DashboardLayout = ({ sesion, selectedModuleId, onSelectModule, onLogout, empresaActiva, onChangeEmpresa }) => {
  const puedeAdministrar = useMemo(() => Sesion.puedeAdministrarUsuarios(sesion), [sesion]);

  const empresasDisponibles = useMemo(() => Sesion.obtenerEmpresasDisponibles(sesion), [sesion]);
  const puedeCambiarEmpresa = useMemo(() => Sesion.puedeCambiarEmpresa(sesion), [sesion]);
  const empresaActualId = empresaActiva?.id || '';

  const tieneAccesoVista = useCallback((module) => {
    if (!sesion || !sesion.usuario) return false;
    const u = (sesion.usuario.usuario || '').toString().trim().toUpperCase();
    if (u === 'ICONET' || sesion.usuario.esAdminGlobal) return true;
    const permisosEmpresa = sesion.usuario.permisosPorEmpresa?.[empresaActualId] || {};
    const clave = module.permiso || module.label;
    const acciones = permisosEmpresa[clave];
    if (!acciones) return false;
    return Boolean(acciones['Cargar y guardar'] || acciones.Revisar || acciones.Aprobar);
  }, [sesion, empresaActualId]);

  const gruposDisponibles = useMemo(() => {
    return MODULE_GROUPS.map((group) => {
      const items = group.items.filter((module) => {
        if (module.requiresAdmin && !puedeAdministrar) {
          return false;
        }
        // Ocultar vistas sin permisos para la empresa activa
        return tieneAccesoVista(module);
      });
      return { ...group, items };
    }).filter((group) => group.items.length > 0);
  }, [puedeAdministrar, tieneAccesoVista]);

  const modulosDisponibles = useMemo(() => gruposDisponibles.flatMap((group) => group.items), [gruposDisponibles]);
  const moduloSeleccionado = useMemo(
    () => modulosDisponibles.find((module) => module.id === selectedModuleId) || null,
    [modulosDisponibles, selectedModuleId]
  );

  // empresasDisponibles, puedeCambiarEmpresa y empresaActualId ya definidos arriba
  const [sidebarOculta, setSidebarOculta] = useState(false);

  const [gruposAbiertos, setGruposAbiertos] = useState(() => new Set(gruposDisponibles.map((group) => group.id)));

  useEffect(() => {
    setGruposAbiertos(new Set(gruposDisponibles.map((group) => group.id)));
  }, [gruposDisponibles]);

  useEffect(() => {
    if (!moduloSeleccionado && modulosDisponibles.length > 0) {
      onSelectModule(modulosDisponibles[0].id);
    }
  }, [moduloSeleccionado, modulosDisponibles, onSelectModule]);

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

  return (
    <div className={layoutClassName}>
      <aside className="app-sidebar" aria-label="Navegación principal">
        <div className="sidebar-header">
          <img src="../icono/ambcham.png" alt="AmCham" className="sidebar-logo" />
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
        <footer className="sidebar-footer">
          <div className="user-info mb-3">
            <span className="text-muted text-uppercase fw-semibold" style={{ letterSpacing: '0.08em', fontSize: '0.7rem' }}>Sesión activa</span>
            <strong>{obtenerNombreUsuario(sesion)}</strong>
            <span className="text-muted" style={{ fontSize: '0.9rem' }}>{sesion?.usuario?.usuario || '—'}</span>
          </div>
          <button type="button" className="btn btn-outline-secondary w-100" onClick={onLogout}>
            Cerrar sesión
          </button>
        </footer>
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
                  {empresa.etiqueta ? `${empresa.etiqueta} — ${empresa.nombre}` : empresa.nombre}
                </option>
              ))}
            </select>
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
  };

  const manejarCambioEmpresa = useCallback((empresaId) => {
    const nuevaEmpresa = Sesion.establecerEmpresaActiva(empresaId);
    setEmpresaActiva(nuevaEmpresa);
    setSesion(Sesion.obtener());
  }, []);

  useEffect(() => {
    if (!sesion) {
      return;
    }
    const puedeAdministrar = Sesion.puedeAdministrarUsuarios(sesion);
    const primerGrupo = MODULE_GROUPS.find((grupo) => grupo.items.some((modulo) => !modulo.requiresAdmin || puedeAdministrar));
    if (primerGrupo) {
      const primerModulo = primerGrupo.items.find((modulo) => !modulo.requiresAdmin || puedeAdministrar);
      if (primerModulo) {
        setModuloSeleccionado((actual) => actual || primerModulo.id);
      }
    }
  }, [sesion]);

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
    />
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

