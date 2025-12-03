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

  // Obtener PRESUPUESTO para año actual y comparativo
  const { obtenerPresupuestosPorCuentas } = require('./planeacionCuentasService');
  const [presupuestosActual, presupuestosComp] = await Promise.all([
    obtenerPresupuestosPorCuentas(empresaId, ejercicio, listaCodigos),
    obtenerPresupuestosPorCuentas(empresaId, comp, listaCodigos)
  ]);
  const mapaPresupuestosActual = new Map(presupuestosActual.map((r) => [r.cuenta, r]));
  const mapaPresupuestosComp = new Map(presupuestosComp.map((r) => [r.cuenta, r]));

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
  // Mapeo de meses 1-12 a claves 'ene', 'feb', etc.
  const MESES_CLAVES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const mesActualClave = periodoNum >= 1 && periodoNum <= 12 ? MESES_CLAVES[periodoNum - 1] : 'ene';

  const detalle = listaCodigos.map((codigo) => {
    const a = mapaActual.get(codigo) || { codigo, descripcion: '', mes: 0, ytd: 0 };
    const b = mapaComp.get(codigo) || { codigo, descripcion: '', mes: 0, ytd: 0 };
    const presupActual = mapaPresupuestosActual.get(codigo) || {};
    const presupComp = mapaPresupuestosComp.get(codigo) || {};

    const descripcion = normalizarTexto(a.descripcion || b.descripcion || '');
    const naturaleza = normalizarNaturaleza(a.naturaleza || b.naturaleza || '');
    
    const mesActual = Number(a.mes || 0);
    const mesAnterior = Number(b.mes || 0);
    const acumuladoActual = Number(a.ytd || 0);
    const acumuladoAnterior = Number(b.ytd || 0);

    // Obtener presupuesto mensual
    const mesPlan = Number(presupActual[mesActualClave] || 0);
    
    // Calcular YTD del presupuesto sumando todos los meses hasta el periodo actual
    let acumuladoPlan = 0;
    for (let i = 0; i < periodoNum && i < 12; i++) {
      acumuladoPlan += Number(presupActual[MESES_CLAVES[i]] || 0);
    }

    return {
      codigo,
      descripcion,
      naturaleza,
      mesActual,
      mesPlan,
      mesAnterior,
      acumuladoActual,
      acumuladoPlan,
      acumuladoAnterior,
      ytdActual: acumuladoActual,
      ytdPlan: acumuladoPlan,
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

