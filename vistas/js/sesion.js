(() => {
  const STORAGE_KEY = 'sesionUsuario';
  const REDIRECCION_POR_DEFECTO = 'login.html';
  const ID_ENLACE_ADMIN = 'navAdministrarUsuarios';
  const EVENTO_EMPRESA = 'sesion:empresa-cambiada';
  const CONTEXTO_KEY = 'planeacionContexto';

  const clonar = (valor) => {
    try {
      return JSON.parse(JSON.stringify(valor));
    } catch (error) {
      console.warn('No fue posible clonar la sesión, se usará una referencia directa.', error);
      return valor;
    }
  };

  const normalizarEntero = (valor) => {
    const numero = Number(valor);
    return Number.isInteger(numero) ? numero : null;
  };

  const obtenerContextoPlaneacion = () => {
    try {
      const datos = localStorage.getItem(CONTEXTO_KEY);
      const ctx = datos ? JSON.parse(datos) : {};
      const anio = normalizarEntero(ctx?.anio);
      const mes = normalizarEntero(ctx?.mes);
      const modulo = ctx?.modulo ? ctx.modulo.toString().toUpperCase() : undefined;
      const limpio = {};
      if (anio != null) limpio.anio = anio;
      if (mes != null) limpio.mes = mes;
      if (modulo) limpio.modulo = modulo;
      return limpio;
    } catch (error) {
      console.warn('No fue posible leer el contexto de planeacion.', error);
      return {};
    }
  };

  const guardarContextoPlaneacion = (contexto = {}) => {
    try {
      const actual = obtenerContextoPlaneacion();
      const siguiente = { ...actual };
      const anio = normalizarEntero(contexto?.anio);
      const mes = normalizarEntero(contexto?.mes);
      if (anio != null) siguiente.anio = anio;
      if (mes != null) siguiente.mes = mes;
      if (contexto?.modulo) {
        siguiente.modulo = contexto.modulo.toString().toUpperCase();
      }
      localStorage.setItem(CONTEXTO_KEY, JSON.stringify(siguiente));
      return siguiente;
    } catch (error) {
      console.warn('No fue posible guardar el contexto de planeacion.', error);
      return obtenerContextoPlaneacion();
    }
  };

  const limpiarContextoPlaneacion = () => {
    try {
      localStorage.removeItem(CONTEXTO_KEY);
    } catch (error) {
      console.warn('No fue posible limpiar el contexto de planeacion.', error);
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
    sesion.tokenAcceso = valor.tokenAcceso || valor.accessToken || valor.token || null;
    sesion.tokenRefresco = valor.tokenRefresco || valor.refreshToken || null;
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
      const datos = localStorage.getItem(STORAGE_KEY);
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
    datos.tokenAcceso = valor.tokenAcceso || valor.accessToken || valor.token || sesionAnterior?.tokenAcceso || null;
    datos.tokenRefresco = valor.tokenRefresco || valor.refreshToken || sesionAnterior?.tokenRefresco || null;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(datos));
    const anteriorId = sesionAnterior?.empresaActiva?.id || null;
    const nuevaId = datos?.empresaActiva?.id || null;
    if (anteriorId !== nuevaId) {
      notificarCambioEmpresa(datos?.empresaActiva || null);
    }
    return datos;
  };

  const limpiar = () => {
    localStorage.removeItem(STORAGE_KEY);
    limpiarContextoPlaneacion();
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

  // Función auxiliar para redirigir, soportando contexto de iframe
  const redirigir = (destino, usarTop = false) => {
    if (usarTop && window.top !== window.self) {
      // Estamos en un iframe y se pidió redirigir la ventana principal
      window.top.location.replace(destino);
    } else {
      window.location.href = destino;
    }
  };

  const requerirSesion = ({ requireAdmin = false, redirectTo = REDIRECCION_POR_DEFECTO, usarTop = false } = {}) => {
    const sesion = obtener();
    if (!sesion || !sesion.tokenAcceso) {
      limpiar();
      redirigir(redirectTo, usarTop);
      return null;
    }

    if (requireAdmin && !puedeAdministrarUsuarios(sesion)) {
      redirigir(redirectTo, usarTop);
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

    const headers = {};

    if (sesion.tokenAcceso) {
      headers.Authorization = `Bearer ${sesion.tokenAcceso}`;
    }

    const empresaActiva = obtenerEmpresaActiva(sesion);
    if (empresaActiva?.id) {
      headers['X-Empresa-Activa'] = empresaActiva.id;
    }

    return headers;
  };

  const normalizarClaveModulo = (clave) => (clave || '').toString().trim().toUpperCase().replace(/\s+/g, ' ');

  const buscarPermisosModulo = (permisosEmpresa = {}, clave) => {
    if (!clave) return null;
    if (permisosEmpresa[clave]) {
      return permisosEmpresa[clave];
    }
    const claveNormalizada = normalizarClaveModulo(clave);
    const coincidencia = Object.entries(permisosEmpresa).find(
      ([nombre]) => normalizarClaveModulo(nombre) === claveNormalizada
    );
    return coincidencia ? coincidencia[1] : null;
  };

  const obtenerPermisosModulo = (modulo, empresaId, sesionActual) => {
    const sesionEvaluada = sesionActual || obtener();
    if (!sesionEvaluada || !sesionEvaluada.usuario || !modulo) {
      return null;
    }
    const empresa = empresaId || obtenerEmpresaActiva(sesionEvaluada)?.id;
    if (!empresa) {
      return null;
    }
    const permisosEmpresa = sesionEvaluada.usuario?.permisosPorEmpresa?.[empresa];
    return buscarPermisosModulo(permisosEmpresa, modulo);
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

  // Función para cerrar sesión y redirigir al login (soporta iframes)
  const cerrar = ({ redirectTo = REDIRECCION_POR_DEFECTO, usarTop = true } = {}) => {
    limpiar();
    redirigir(redirectTo, usarTop);
  };

  window.Sesion = {
    obtener,
    guardar,
    limpiar,
    cerrar,
    redirigir,
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
    obtenerContextoPlaneacion,
    guardarContextoPlaneacion,
    limpiarContextoPlaneacion,
    EVENTO_EMPRESA,
    obtenerTokenAcceso: () => obtener()?.tokenAcceso || null,
    obtenerTokenRefresco: () => obtener()?.tokenRefresco || null,
    obtenerPermisosModulo,
    tienePermisoModulo
  };
})();
