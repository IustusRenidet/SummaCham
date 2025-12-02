const { ejecutarConsulta } = require('./firebirdService');
const { listarAniosSaldos } = require('./saldosMetadataService');
const { construirSelectResumen } = require('./saldosResumenHelper');

// Mapea filas crudas a objetos tipados por codigo
const mapearResultados = (filas = []) => {
  const mapa = new Map();
  filas.forEach((r) => {
    const codigo = String(r.CODIGO || '').trim();
    if (!codigo) return;
    const descripcion = (r.DESCRIPCION || '').toString();
    const naturaleza = (r.NATURALEZA || '').toString();
    mapa.set(codigo, {
      codigo,
      descripcion,
      naturaleza,
      mes: Number(r.MES ?? 0) || 0,
      ytd: Number(r.YTD ?? 0) || 0
    });
  });
  return mapa;
};

const normalizarCodigos = (codigos) => (Array.isArray(codigos) ? codigos : []).map((c) => String(c || '').trim());

// Punto de entrada desde el router: arma payload para el front (detalle + ejercicios)
async function obtenerResumen({ empresaId, anio, periodo, codigos = [], anioComparativo, usarAjusteEnYTD = false }) {
  const ejercicio = Number(anio);
  const periodoNum = Number(periodo);
  const comp = anioComparativo != null ? Number(anioComparativo) : ejercicio - 1;
  const usarAjuste = Boolean(usarAjusteEnYTD);
  const listaCodigos = normalizarCodigos(codigos);

  // Consulta ejercicio actual
  const selActual = construirSelectResumen({ anio: ejercicio, periodo: periodoNum, usarAjusteEnYTD: usarAjuste, codigos: listaCodigos });
  const filasActual = await ejecutarConsulta(empresaId, selActual.sql, selActual.parametros);
  const mapaActual = mapearResultados(filasActual);

  // Consulta ejercicio comparativo
  const selComp = construirSelectResumen({ anio: comp, periodo: periodoNum, usarAjusteEnYTD: usarAjuste, codigos: listaCodigos });
  const filasComp = await ejecutarConsulta(empresaId, selComp.sql, selComp.parametros);
  const mapaComp = mapearResultados(filasComp);

  // Armar detalle por código
  const normalizarTexto = (valor) => (valor == null ? '' : String(valor).trim());
  const normalizarNaturaleza = (valor) => {
    const txt = normalizarTexto(valor).toUpperCase();
    if (txt === 'A' || txt === 'D' || txt === 'C') return txt;
    return txt;
  };
  const detalle = listaCodigos.map((codigo) => {
    // Para cada código devolvemos los saldos del ejercicio actual y del comparativo.
    // Esto alimenta cada "celda" de la tabla en el front, que después puede aplicar
    // lógica adicional (sumas, porcentajes, etc.) sobre estos importes base.
    const a = mapaActual.get(codigo) || { codigo, descripcion: '', mes: 0, ytd: 0 };
    const b = mapaComp.get(codigo) || { codigo, descripcion: '', mes: 0, ytd: 0 };
    const descripcion = normalizarTexto(a.descripcion || b.descripcion || '');
    const naturaleza = normalizarNaturaleza(a.naturaleza || b.naturaleza || '');
    const mesActual = Number(a.mes || 0);
    const mesAnterior = Number(b.mes || 0);
    const acumuladoActual = Number(a.ytd || 0);
    const acumuladoAnterior = Number(b.ytd || 0);
    return {
      codigo,
      descripcion,
      naturaleza,
      mesActual,
      mesPlan: 0,
      mesAnterior,
      acumuladoActual,
      acumuladoPlan: 0,
      acumuladoAnterior,
      ytdActual: acumuladoActual,
      ytdPlan: 0,
      ytdAnterior: acumuladoAnterior
    };
  });

  // El widget de tarjetas muestra el acumulado del ejercicio actual; aquí lo calculamos
  // sumando el YTD de todos los códigos para el año base.
  const totalAcumulado = detalle.reduce((acc, it) => acc + (Number(it.acumuladoActual) || 0), 0);
  const totalAcumuladoAnterior = detalle.reduce((acc, it) => acc + (Number(it.acumuladoAnterior) || 0), 0);

  const ejercicios = [
    { anio: ejercicio, saldo: totalAcumulado, acumulado: totalAcumulado }
  ];
  if (Number.isFinite(totalAcumuladoAnterior)) {
    ejercicios.push({ anio: comp, saldo: totalAcumuladoAnterior, acumulado: totalAcumuladoAnterior });
  }

  const ejerciciosDisponibles = await listarAniosSaldos(empresaId);

  return {
    anio: ejercicio,
    periodo: periodoNum,
    anioComparativo: comp,
    detalle,
    ejercicios,
    ejerciciosDisponibles
  };
}

module.exports = {
  obtenerResumen,
  listarAniosSALDOS: listarAniosSaldos
};

