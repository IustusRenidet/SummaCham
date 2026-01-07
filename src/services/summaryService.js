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

  console.log(`\n🔍 [SUMMARY DEBUG] ====================================`);
  console.log(`📊 Empresa: ${empresaId}`);
  console.log(`📅 Año actual: ${ejercicio}, Comparativo: ${comp}, Periodo: ${periodoNum}`);
  console.log(`🔢 Total códigos solicitados: ${listaCodigos.length}`);
  if (listaCodigos.length > 0 && listaCodigos.length <= 5) {
    console.log(`📋 Códigos ejemplo:`, listaCodigos);
  } else if (listaCodigos.length > 5) {
    console.log(`📋 Primeros 5 códigos:`, listaCodigos.slice(0, 5));
  }
  console.log(`================================================\n`);

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
  console.log(`📊 [SUMMARY] Consultando ejercicio ${ejercicio} para empresa ${empresaId}`);
  console.log(`📋 [SUMMARY] SQL: ${selActual.sql.substring(0, 200)}...`);
  console.log(`🔢 [SUMMARY] Parámetros: ${JSON.stringify(selActual.parametros)}`);
  
  const filasActual = await ejecutarConsulta(empresaId, selActual.sql, selActual.parametros);
  console.log(`✅ [SUMMARY] Filas obtenidas para ${ejercicio}: ${filasActual.length}`);
  
  if (filasActual.length > 0) {
    const primerFila = filasActual[0];
    const tieneDatos = primerFila.MES !== 0 || primerFila.YTD !== 0;
    console.log(`📝 [SUMMARY] Ejemplo primera fila:`, {
      codigo: primerFila.CODIGO,
      descripcion: primerFila.DESCRIPCION?.substring(0, 30),
      mes: primerFila.MES,
      ytd: primerFila.YTD,
      tieneDatos
    });
    
    // Contar cuántas filas tienen datos reales
    const filasConDatos = filasActual.filter(f => f.MES !== 0 || f.YTD !== 0).length;
    console.log(`📊 [SUMMARY] Filas con datos (MES o YTD != 0): ${filasConDatos}/${filasActual.length}`);
    
    if (filasConDatos === 0) {
      console.warn(`⚠️ [SUMMARY] TODAS LAS FILAS ESTÁN EN CEROS para año ${ejercicio}`);
      console.warn(`⚠️ [SUMMARY] Posibles causas:`);
      console.warn(`   1. Los códigos de cuenta no coinciden con la base (formato diferente)`);
      console.warn(`   2. La tabla SALDOS${anio.toString().slice(-2)} no tiene EJERCICIO = ${ejercicio}`);
      console.warn(`   3. Los códigos de cuenta no existen en la base de datos`);
    }
  } else {
    console.warn(`⚠️ [SUMMARY] NO SE ENCONTRARON DATOS para año ${ejercicio}`);
  }
  
  const mapaActual = mapearResultados(filasActual);

  // Consulta ejercicio comparativo
  const selComp = construirSelectResumen({ anio: comp, periodo: periodoNum, usarAjusteEnYTD: usarAjuste, codigos: listaCodigos });
  console.log(`📊 [SUMMARY] Consultando ejercicio comparativo ${comp} para empresa ${empresaId}`);
  const filasComp = await ejecutarConsulta(empresaId, selComp.sql, selComp.parametros);
  console.log(`✅ [SUMMARY] Filas obtenidas para ${comp}: ${filasComp.length}`);
  const mapaComp = mapearResultados(filasComp);

  // 🔍 DIAGNÓSTICO: Verificar qué cuentas SÍ existen en la base si no hay datos
  const todasEnCeros = filasActual.filter(f => f.MES !== 0 || f.YTD !== 0).length === 0;
  if (todasEnCeros && filasActual.length > 0) {
    console.log(`\n🔍 [DIAGNÓSTICO] Verificando cuentas existentes en CUENTAS${ejercicio.toString().slice(-2)}...`);
    try {
      const tablaCtas = `CUENTAS${ejercicio.toString().slice(-2)}`;
      const sqlVerificar = `
        SELECT FIRST 10
          NUM_CTA,
          NOMBRE,
          NATURALEZA,
          STATUS
        FROM ${tablaCtas}
        WHERE STATUS = 'A'
        ORDER BY NUM_CTA
      `;
      const cuentasReales = await ejecutarConsulta(empresaId, sqlVerificar, []);
      console.log(`📋 [DIAGNÓSTICO] Cuentas que SÍ existen en la base (primeras 10):`);
      cuentasReales.forEach((c, i) => {
        console.log(`   ${i+1}. ${c.NUM_CTA} - ${c.NOMBRE?.substring(0, 40)}`);
      });
      
      console.log(`\n🔍 [DIAGNÓSTICO] Comparando con códigos solicitados:`);
      const primerosCodigosSolicitados = listaCodigos.slice(0, 3);
      primerosCodigosSolicitados.forEach(codigo => {
        const existe = cuentasReales.some(c => c.NUM_CTA.trim() === codigo);
        console.log(`   ${codigo}: ${existe ? '✅ EXISTE' : '❌ NO ENCONTRADO'}`);
      });
    } catch (err) {
      console.error(`❌ [DIAGNÓSTICO] Error al verificar cuentas:`, err.message);
    }
  }

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

