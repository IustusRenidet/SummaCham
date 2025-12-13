const { MODULOS, ACCIONES, normalizarNombreModulo } = require('../config/modulos');

// Normaliza el nombre del módulo de DB a frontend (ej: Gtos_Corporativos -> Gtos Corporativos)
const normalizarParaFrontend = (modulo) => {
  // Reemplazar guiones bajos por espacios
  return modulo ? modulo.replace(/_/g, ' ') : modulo;
};

const construirMapaPermisos = (registros) => {
  return registros.reduce((acumulado, registro) => {
    if (!acumulado[registro.empresa_id]) {
      acumulado[registro.empresa_id] = {};
    }
    const moduloNormalizado =
      normalizarNombreModulo(registro.modulo) || normalizarParaFrontend(registro.modulo);
    const puedeLeer = Boolean(registro.puede_leer);
    acumulado[registro.empresa_id][moduloNormalizado] = {
      Ver: puedeLeer,
      Lectura: puedeLeer,
      'Cargar y guardar': Boolean(registro.puede_cargar_guardar),
      Revisar: Boolean(registro.puede_revisar),
      Aprobar: Boolean(registro.puede_aprobar)
    };
    return acumulado;
  }, {});
};

const construirEstructuraPermisosVacia = () => {
  const plantilla = {};
  MODULOS.forEach((modulo) => {
    plantilla[modulo] = {
      Ver: false,
      Lectura: false,
      'Cargar y guardar': false,
      Revisar: false,
      Aprobar: false
    };
  });
  return plantilla;
};

module.exports = {
  construirMapaPermisos,
  construirEstructuraPermisosVacia,
  ACCIONES,
  MODULOS
};
