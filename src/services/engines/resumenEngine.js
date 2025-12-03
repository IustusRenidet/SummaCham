const { generarReporte } = require('../reportes/planeacionReportesEngine');

async function generarResumenEjecutivo(empresaId, anio) {
  return generarReporte('RESUMEN', empresaId, Number(anio));
}

module.exports = {
  generarResumenEjecutivo
};
