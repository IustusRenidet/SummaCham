(() => {
  const STORAGE_KEY = 'sesionUsuario';
  const REDIRECCION_POR_DEFECTO = 'login.html';
  const ID_ENLACE_ADMIN = 'navAdministrarUsuarios';
  const EVENTO_EMPRESA = 'sesion:empresa-cambiada';

  const clonar = (valor) => {
    try {
      return JSON.parse(JSON.stringify(valor));
    } catch (error) {
      console.warn('No fue posible clonar la sesión, se usará una referencia directa.', error);
      return valor;
    }
  };

  const normalizarEmpresa = (empresa) => {
    if (!empresa || typeof empresa !== 'object') {
      return null;
    }
    const id = empresa.id != null ? String(empresa.id) : '';
    if (!id) {
      return null;
    }
    return {
      id,
      nombre: empresa.nombre || '',
      etiqueta: empresa.etiqueta || ''
    };
  };

  const prepararSesion = (valor) => {
    if (!valor || typeof valor !== 'object') {
      return null;
    }
    const sesion = clonar(valor) || {};
    const empresas = Array.isArray(valor.empresasDisponibles)
      ? valor.empresasDisponibles.map(normalizarEmpresa).filter(Boolean)
      : [];
    const empresaActiva = normalizarEmpresa(valor.empresaActiva) || empresas[0] || null;
    sesion.empresasDisponibles = empresas;
    sesion.empresaActiva = empresaActiva;
    return sesion;
  };

  const obtenerEmpresasDisponibles = (sesion) => {
    const datos = sesion || obtener();
    if (!datos || !Array.isArray(datos.empresasDisponibles)) {
      return [];
    }
    return datos.empresasDisponibles.map(normalizarEmpresa).filter(Boolean);
  };

  const obtenerEmpresaActiva = (sesion) => {
    const datos = sesion || obtener();
    return normalizarEmpresa(datos?.empresaActiva);
  };

  const notificarCambioEmpresa = (empresa) => {
    try {
      window.dispatchEvent(new CustomEvent(EVENTO_EMPRESA, { detail: { empresa } }));
    } catch (error) {
      console.warn('No fue posible notificar el cambio de empresa.', error);
    }
  };

  const normalizarUsuario = (valor) => {
    return (valor || '').toString().trim().toUpperCase();
  };

  const obtener = () => {
    try {
      const datos = sessionStorage.getItem(STORAGE_KEY);
      const sesion = datos ? JSON.parse(datos) : null;
      if (!sesion) {
        return null;
      }
      return prepararSesion(sesion);
    } catch (error) {
      console.warn('No fue posible leer la sesión almacenada.', error);
      return null;
    }
  };

  const guardar = (valor) => {
    if (!valor) {
      limpiar();
      return null;
    }
    const sesionAnterior = obtener();
    const datos = prepararSesion(valor);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(datos));
    const anteriorId = sesionAnterior?.empresaActiva?.id || null;
    const nuevaId = datos?.empresaActiva?.id || null;
    if (anteriorId !== nuevaId) {
      notificarCambioEmpresa(datos?.empresaActiva || null);
    }
    return datos;
  };

  const limpiar = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    notificarCambioEmpresa(null);
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

  const esAdminGlobal = (sesion) => {
    const evaluada = sesion || obtener();
    return Boolean(evaluada?.usuario?.esAdminGlobal);
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

  const puedeCambiarEmpresa = (sesion) => obtenerEmpresasDisponibles(sesion).length > 1;

  const establecerEmpresaActiva = (empresaId) => {
    const sesionActual = obtener();
    if (!sesionActual) {
      return null;
    }
    const empresas = obtenerEmpresasDisponibles(sesionActual);
    const seleccionada = empresas.find((empresa) => empresa.id === String(empresaId));
    if (!seleccionada) {
      return null;
    }
    const actualizada = guardar({ ...sesionActual, empresaActiva: seleccionada });
    return actualizada?.empresaActiva || null;
  };

  const headersAutenticacion = () => {
    const sesion = obtener();
    if (!sesion || !sesion.usuario) {
      return {};
    }

    const headers = {
      'X-Usuario-Actual': normalizarUsuario(sesion.usuario.usuario)
    };

    const empresaActiva = obtenerEmpresaActiva(sesion);
    if (empresaActiva?.id) {
      headers['X-Empresa-Activa'] = empresaActiva.id;
    }

    return headers;
  };

  const obtenerPermisosModulo = (modulo, empresaId, sesionActual) => {
    const sesionEvaluada = sesionActual || obtener();
    const moduloNormalizado = (modulo || '').toString();
    if (!sesionEvaluada || !sesionEvaluada.usuario || !moduloNormalizado) {
      return null;
    }
    const empresa = empresaId || obtenerEmpresaActiva(sesionEvaluada)?.id;
    if (!empresa) {
      return null;
    }
    return sesionEvaluada.usuario?.permisosPorEmpresa?.[empresa]?.[moduloNormalizado] || null;
  };

  const tienePermisoModulo = (modulo, accion, empresaId, sesionActual) => {
    const permisos = obtenerPermisosModulo(modulo, empresaId, sesionActual);
    if (!permisos) {
      return false;
    }
    const accionNormalizada = (accion || '').toString();
    if (!accionNormalizada) {
      return false;
    }
    return Boolean(permisos[accionNormalizada]);
  };

  window.Sesion = {
    obtener,
    guardar,
    limpiar,
    requerirSesion,
    esAdmin,
    esAdminGlobal,
    puedeAdministrarUsuarios,
    asegurarEnlaceAdministrarUsuarios,
    headersAutenticacion,
    obtenerEmpresasDisponibles,
    obtenerEmpresaActiva,
    establecerEmpresaActiva,
    puedeCambiarEmpresa,
    EVENTO_EMPRESA,
    obtenerPermisosModulo,
    tienePermisoModulo
  };
})();
