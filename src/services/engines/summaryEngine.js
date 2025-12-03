const { generarReporte } = require('../reportes/planeacionReportesEngine');

async function generarSummary(empresaId, anio, mes) {
  return generarReporte('SUMMARY', empresaId, Number(anio), mes);
}

module.exports = {
  generarSummary
};
