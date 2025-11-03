(() => {
  const STORAGE_KEY = 'sesionUsuario';
  const REDIRECCION_POR_DEFECTO = 'login.html';

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

  const esAdmin = (sesion) => {
    if (!sesion || !sesion.usuario) return false;
    const usuario = normalizarUsuario(sesion.usuario.usuario);
    return Boolean(sesion.usuario.esAdminGlobal) || usuario === 'ICONET';
  };

  const requerirSesion = ({ requireAdmin = false, redirectTo = REDIRECCION_POR_DEFECTO } = {}) => {
    const sesion = obtener();
    if (!sesion) {
      window.location.href = redirectTo;
      return null;
    }

    if (requireAdmin && !esAdmin(sesion)) {
      window.location.href = redirectTo;
      return null;
    }

    return sesion;
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
    headersAutenticacion
  };
})();
