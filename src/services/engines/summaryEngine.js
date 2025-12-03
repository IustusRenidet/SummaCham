const { generarReporte } = require('../reportes/planeacionReportesEngine');

async function generarSummary(empresaId, anio, mes, capitulo) {
  return generarReporte('SUMMARY', empresaId, Number(anio), mes, capitulo);
}

module.exports = {
  generarSummary
};
