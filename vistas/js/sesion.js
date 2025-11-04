(() => {
  const STORAGE_KEY = 'sesionUsuario';
  const REDIRECCION_POR_DEFECTO = 'login.html';
  const ID_ENLACE_ADMIN = 'navAdministrarUsuarios';

  const normalizarUsuario = (valor) => {
    return (valor || '').toString().trim().toUpperCase();
  };

  const obtener = () => {
    try {
      const datos = sessionStorage.getItem(STORAGE_KEY);
      return datos ? JSON.parse(datos) : null;
    } catch (error) {
      console.warn('No fue posible leer la sesión almacenada.', error);
      return null;
    }
  };

  const guardar = (valor) => {
    if (!valor) {
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(valor));
  };

  const limpiar = () => {
    sessionStorage.removeItem(STORAGE_KEY);
  };

  const puedeAdministrarUsuarios = (sesion) => {
    const sesionEvaluada = sesion || obtener();
    if (!sesionEvaluada || !sesionEvaluada.usuario) return false;
    const usuario = normalizarUsuario(sesionEvaluada.usuario.usuario);
    if (usuario === 'ICONET') return true;
    if (sesionEvaluada.usuario.esAdminGlobal) return true;
    const generales = sesionEvaluada.usuario.permisosGenerales || {};
    return Boolean(generales.puedeAgregar && generales.puedeModificar && generales.puedeEliminar);
  };

  const esAdmin = (sesion) => puedeAdministrarUsuarios(sesion);

  const requerirSesion = ({ requireAdmin = false, redirectTo = REDIRECCION_POR_DEFECTO } = {}) => {
    const sesion = obtener();
    if (!sesion) {
      window.location.href = redirectTo;
      return null;
    }

    if (requireAdmin && !puedeAdministrarUsuarios(sesion)) {
      window.location.href = redirectTo;
      return null;
    }

    return sesion;
  };

  const asegurarEnlaceAdministrarUsuarios = (contenedor) => {
    if (!contenedor) return;
    const enlaceExistente = document.getElementById(ID_ENLACE_ADMIN);
    const visible = puedeAdministrarUsuarios();
    if (visible) {
      if (!enlaceExistente) {
        const elemento = document.createElement('li');
        elemento.id = ID_ENLACE_ADMIN;
        elemento.className = 'nav-item';
        elemento.innerHTML = '<a class="nav-link" href="usuarios.html">Administrar usuarios</a>';
        contenedor.appendChild(elemento);
      }
    } else if (enlaceExistente) {
      enlaceExistente.remove();
    }
  };

  const headersAutenticacion = () => {
    const sesion = obtener();
    if (!sesion || !sesion.usuario) {
      return {};
    }

    return {
      'X-Usuario-Actual': normalizarUsuario(sesion.usuario.usuario)
    };
  };

  window.Sesion = {
    obtener,
    guardar,
    limpiar,
    requerirSesion,
    esAdmin,
    puedeAdministrarUsuarios,
    asegurarEnlaceAdministrarUsuarios,
    headersAutenticacion
  };
})();
