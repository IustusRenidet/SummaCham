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
  // Ya no filtramos módulos restringidos - los permisos ahora se controlan por usuario
  return permisos || {};
};

const limpiarPermisosLista = ({ lista = [], usuario }) => {
  // Ya no filtramos módulos restringidos - los permisos ahora se controlan por usuario
  return Array.isArray(lista) ? lista : [];
};

const asegurarPermisosGeneralesAdmin = (usuario, permisosGenerales = {}) => {
  if (!esAdministradorHistorico(usuario)) {
    return permisosGenerales || {};
  }
  return {
    puedeAgregar: true,
    puedeModificar: true,
    puedeEliminar: true
  };
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
