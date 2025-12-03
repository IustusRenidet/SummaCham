const { MODULOS, ACCIONES } = require('../config/modulos');

const construirMapaPermisos = (registros) => {
  return registros.reduce((acumulado, registro) => {
    if (!acumulado[registro.empresa_id]) {
      acumulado[registro.empresa_id] = {};
    }
    acumulado[registro.empresa_id][registro.modulo] = {
      Lectura: Boolean(registro.puede_leer),
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
