const { useState, useEffect, useMemo, useCallback } = React;

const API_BASE = 'http://localhost:3000/api';

const MODULE_GROUPS = [
  {
    id: 'panel-resumenes',
    label: 'Paneles',
    items: [
      { id: 'presupuestos', label: 'Presupuestos', path: 'Presupuestos.html', badge: 'Finanzas' },
      { id: 'summary', label: 'Summary', path: 'SUMMARY.html', badge: 'Ejecutivo' }
    ]
  },
  {
    id: 'resumen-areas',
    label: 'Resumen',
    items: [
      { id: 'resumen', label: 'Resumen', path: 'RESUMEN.html', badge: 'Finanzas' },
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
  const [empresas, setEmpresas] = useState([]);
  const [form, setForm] = useState({ usuario: '', contrasena: '', empresaId: '' });
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Sesion.limpiar();
    const cargarEmpresas = async () => {
      try {
        const respuesta = await fetch(`${API_BASE}/empresas`);
        const datos = await respuesta.json();
        const listado = datos.empresas || [];
        setEmpresas(listado);
        if (listado.length > 0) {
          setForm((prev) => ({ ...prev, empresaId: listado[0].id }));
        }
      } catch (err) {
        console.error('No fue posible cargar las empresas', err);
        setError('No fue posible obtener la lista de empresas. Verifica el servicio local.');
      }
    };
    cargarEmpresas();
  }, []);

  const actualizarCampo = (evento) => {
    const { name, value } = evento.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const manejarEnvio = async (evento) => {
    evento.preventDefault();
    setError('');

    if (!form.usuario || !form.contrasena || !form.empresaId) {
      setError('Completa usuario, contraseña y empresa.');
      return;
    }

    setCargando(true);
    try {
      const respuesta = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario: form.usuario,
          contrasena: form.contrasena,
          empresaId: form.empresaId
        })
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        throw new Error(datos.mensaje || 'No fue posible iniciar sesión.');
      }
      Sesion.guardar(datos);
      onLogin(datos);
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
          <p className="mb-0 text-muted">Accede con tu cuenta corporativa.</p>
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
            <input
              type="password"
              id="contrasena"
              name="contrasena"
              className="form-control form-control-lg"
              value={form.contrasena}
              onChange={actualizarCampo}
              disabled={cargando}
              autoComplete="current-password"
              required
            />
          </div>

          <div className="mb-4">
            <label htmlFor="empresaId" className="form-label fw-semibold">Empresa <span className="text-danger">*</span></label>
            <select
              id="empresaId"
              name="empresaId"
              className="form-select form-select-lg"
              value={form.empresaId}
              onChange={actualizarCampo}
              disabled={cargando || empresas.length === 0}
              required
            >
              {empresas.length === 0 && <option value="">Sin empresas disponibles</option>}
              {empresas.map((empresa) => (
                <option key={empresa.id} value={empresa.id}>
                  {empresa.etiqueta} — {empresa.nombre}
                </option>
              ))}
            </select>
          </div>

          <button type="submit" className="btn btn-verde w-100" disabled={cargando}>
            {cargando && <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>}
            {cargando ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </main>
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

const DashboardLayout = ({ sesion, selectedModuleId, onSelectModule, onLogout }) => {
  const puedeAdministrar = useMemo(() => Sesion.puedeAdministrarUsuarios(sesion), [sesion]);

  const gruposDisponibles = useMemo(() => {
    return MODULE_GROUPS.map((group) => {
      const items = group.items.filter((module) => {
        if (module.requiresAdmin && !puedeAdministrar) {
          return false;
        }
        return true;
      });
      return { ...group, items };
    }).filter((group) => group.items.length > 0);
  }, [puedeAdministrar]);

  const modulosDisponibles = useMemo(() => gruposDisponibles.flatMap((group) => group.items), [gruposDisponibles]);
  const moduloSeleccionado = useMemo(
    () => modulosDisponibles.find((module) => module.id === selectedModuleId) || null,
    [modulosDisponibles, selectedModuleId]
  );

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

  return (
    <div className="app-layout">
      <aside className="app-sidebar" aria-label="Navegación principal">
        <div className="sidebar-header">
          <h1>Panel AmCham</h1>
          <p className="text-muted mb-0">Selecciona un módulo para comenzar.</p>
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
          <div>
            <h2>{moduloSeleccionado ? moduloSeleccionado.label : 'Selecciona un módulo'}</h2>
            {moduloSeleccionado?.badge && (
              <span className="badge rounded-pill mt-2">{moduloSeleccionado.badge}</span>
            )}
          </div>
        </div>
        <div className="content-wrapper">
          <div className="content-card">
            {moduloSeleccionado ? (
              <iframe
                key={moduloSeleccionado.id}
                src={moduloSeleccionado.path}
                title={moduloSeleccionado.label}
                className="content-iframe"
                allow="clipboard-read; clipboard-write"
              ></iframe>
            ) : (
              <div className="empty-state">
                <h3>Selecciona un módulo para comenzar</h3>
                <p>Elige un elemento en la barra lateral para visualizar la información correspondiente.</p>
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
  const [moduloSeleccionado, setModuloSeleccionado] = useState(null);

  const manejarLogin = (datosSesion) => {
    setSesion(datosSesion);
    const puedeAdministrar = Sesion.puedeAdministrarUsuarios(datosSesion);
    const primerGrupo = MODULE_GROUPS.find((grupo) => grupo.items.some((modulo) => !modulo.requiresAdmin || puedeAdministrar));
    if (primerGrupo) {
      const primerModulo = primerGrupo.items.find((modulo) => !modulo.requiresAdmin || puedeAdministrar);
      if (primerModulo) {
        setModuloSeleccionado(primerModulo.id);
      }
    }
  };

  const manejarLogout = () => {
    Sesion.limpiar();
    setSesion(null);
    setModuloSeleccionado(null);
  };

  const seleccionarModulo = useCallback((moduloId) => {
    setModuloSeleccionado(moduloId);
  }, []);

  useEffect(() => {
    if (sesion) {
      manejarLogin(sesion);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!sesion) {
    return <LoginView onLogin={manejarLogin} />;
  }

  return (
    <DashboardLayout
      sesion={sesion}
      selectedModuleId={moduloSeleccionado}
      onSelectModule={seleccionarModulo}
      onLogout={manejarLogout}
    />
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
