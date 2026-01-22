const normalizarUsuario = (valor = '') =>
  valor
    .toString()
    .trim()
    .toUpperCase();

const normalizarModulo = (valor = '') =>
  valor
    .toString()
    .trim()
    .toUpperCase();

const MODULOS_RESTRINGIDOS = new Set(['RESUMEN', 'SUMMARY']);
const USUARIOS_RESUMEN_PERMITIDOS = new Set(['ICONET', 'AA', 'AMB', 'PCA']);
const ADMINISTRADORES_HISTORICOS = new Set(['AA', 'AMB']);

const esModuloRestringido = (modulo) => MODULOS_RESTRINGIDOS.has(normalizarModulo(modulo));

const esUsuarioPermitidoResumen = (usuario) =>
  USUARIOS_RESUMEN_PERMITIDOS.has(normalizarUsuario(usuario));

const esAdministradorHistorico = (usuario) =>
  ADMINISTRADORES_HISTORICOS.has(normalizarUsuario(usuario));

const limpiarPermisosMapa = ({ permisos = {}, usuario }) => {
  if (!permisos || esUsuarioPermitidoResumen(usuario)) {
    return permisos || {};
  }
  const limpio = {};
  Object.entries(permisos || {}).forEach(([empresaId, modulos]) => {
    if (!modulos) return;
    const permitidos = {};
    Object.entries(modulos).forEach(([modulo, acciones]) => {
      if (esModuloRestringido(modulo)) {
        return;
      }
      permitidos[modulo] = acciones;
    });
    if (Object.keys(permitidos).length > 0) {
      limpio[empresaId] = permitidos;
    }
  });
  return limpio;
};

const limpiarPermisosLista = ({ lista = [], usuario }) => {
  const permisos = Array.isArray(lista) ? lista : [];
  if (esUsuarioPermitidoResumen(usuario)) {
    return permisos;
  }
  return permisos.filter((permiso) => !esModuloRestringido(permiso?.modulo));
};

const asegurarPermisosGeneralesAdmin = (usuario, permisosGenerales = {}) => {
  // Si el usuario es administrador global, debe tener todos los permisos
  if (permisosGenerales && permisosGenerales.esAdminGlobal) {
    return {
      puedeAgregar: true,
      puedeModificar: true,
      puedeEliminar: true
    };
  }
  // Mantener compatibilidad con históricos
  if (esAdministradorHistorico(usuario)) {
    return {
      puedeAgregar: true,
      puedeModificar: true,
      puedeEliminar: true
    };
  }
  return permisosGenerales || {};
};

module.exports = {
  normalizarUsuario,
  normalizarModulo,
  MODULOS_RESTRINGIDOS,
  USUARIOS_RESUMEN_PERMITIDOS,
  ADMINISTRADORES_HISTORICOS,
  esModuloRestringido,
  esUsuarioPermitidoResumen,
  esAdministradorHistorico,
  limpiarPermisosMapa,
  limpiarPermisosLista,
  asegurarPermisosGeneralesAdmin
};
