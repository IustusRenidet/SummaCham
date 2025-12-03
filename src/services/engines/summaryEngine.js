const { generarReporte } = require('../reportes/planeacionReportesEngine');

async function generarSummary(empresaId, anio) {
  return generarReporte('SUMMARY', empresaId, Number(anio));
}

module.exports = {
  generarSummary
};
