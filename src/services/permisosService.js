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
    // Normalizar nombre del módulo para que coincida con el frontend
    const moduloNormalizado = normalizarParaFrontend(registro.modulo);
    acumulado[registro.empresa_id][moduloNormalizado] = {
      Ver: Boolean(registro.puede_leer),
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
