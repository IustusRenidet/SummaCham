const { ejecutarConsulta } = require('./firebirdService');

const pad2 = (n) => n.toString().padStart(2, '0');

const nombreTabla = (prefijo, anio) => `${prefijo}${anio.toString().slice(-2).padStart(2, '0')}`;

const sumaCols = (prefix, hasta) => {
  const limite = Math.max(0, Math.min(13, Number(hasta) || 0));
  if (limite <= 0) return '0';
  const partes = [];
  for (let i = 1; i <= limite; i++) {
    partes.push(`COALESCE(${prefix}${pad2(i)}, 0)`);
  }
  return partes.join(' + ');
};

// Construye una tabla derivada con los códigos solicitados para asegurar que
// todos los códigos aparezcan (aunque no existan en CUENTAS/SALDOS)
// Firebird SQL 3: SELECT ... FROM (SELECT ? AS NUM_CTA FROM RDB$DATABASE UNION ALL SELECT ? ...)
const tablaCodigosDerivada = (codigos = []) => {
  const limpios = (Array.isArray(codigos) ? codigos : [])
    .map((c) => (c == null ? '' : String(c).trim()))
    .filter((c) => c.length > 0);
  if (limpios.length === 0) {
    // Asegura al menos una fila vacía para no romper el SELECT; luego se normaliza a 0
    return { sql: "SELECT CAST('__VACIO__' AS VARCHAR(24)) AS NUM_CTA FROM RDB$DATABASE", params: [] };
  }
  const selects = limpios.map(() => 'SELECT CAST(? AS VARCHAR(24)) AS NUM_CTA FROM RDB$DATABASE');
  const sql = selects.join(' UNION ALL ');
  return { sql, params: limpios };
};

const construirSelectResumen = ({ anio, periodo, usarAjusteEnYTD, codigos }) => {
  const tablaSaldos = nombreTabla('SALDOS', anio);
  const tablaCuentas = nombreTabla('CUENTAS', anio);

  const p = Math.max(1, Math.min(13, Number(periodo) || 1));
  const pp = pad2(p);
  const incluirAjuste = Boolean(usarAjusteEnYTD) && p >= 13;
  const ytdHasta = incluirAjuste ? 13 : Math.min(p, 12);

  const exprMes = `COALESCE(s.CARGO${pp}, 0) - COALESCE(s.ABONO${pp}, 0)`;
  const exprYtd = `COALESCE(s.INICIAL, 0) + (${sumaCols('s.CARGO', ytdHasta)}) - (${sumaCols('s.ABONO', ytdHasta)})`;

  const { sql: sqlCodigos, params } = tablaCodigosDerivada(codigos);

  const sql = `
    SELECT
      t.NUM_CTA AS CODIGO,
      c.NOMBRE AS DESCRIPCION,
      ${exprMes} AS MES,
      ${exprYtd} AS YTD
    FROM (${sqlCodigos}) t
    LEFT JOIN ${tablaSaldos} s
      ON s.NUM_CTA = t.NUM_CTA AND s.EJERCICIO = ?
    LEFT JOIN ${tablaCuentas} c
      ON c.NUM_CTA = t.NUM_CTA
    ORDER BY t.NUM_CTA
  `;

  const parametros = [...params, Number(anio)];
  return { sql, parametros };
};

const mapearResultados = (filas = []) => {
  const mapa = new Map();
  filas.forEach((r) => {
    const codigo = String(r.CODIGO || '').trim();
    if (!codigo) return;
    mapa.set(codigo, {
      codigo,
      descripcion: (r.DESCRIPCION || '').toString(),
      mes: Number(r.MES ?? 0) || 0,
      ytd: Number(r.YTD ?? 0) || 0
    });
  });
  return mapa;
};

const normalizarCodigos = (codigos) => (Array.isArray(codigos) ? codigos : []).map((c) => String(c || '').trim());

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
  const detalle = listaCodigos.map((codigo) => {
    const a = mapaActual.get(codigo) || { codigo, descripcion: '', mes: 0, ytd: 0 };
    const b = mapaComp.get(codigo) || { codigo, descripcion: '', mes: 0, ytd: 0 };
    return {
      codigo,
      descripcion: a.descripcion || b.descripcion || '',
      mesActual: a.mes || 0,
      mesPlan: 0,
      mesAnterior: b.mes || 0,
      acumuladoActual: a.ytd || 0,
      acumuladoPlan: 0,
      acumuladoAnterior: b.ytd || 0
    };
  });

  const totalAcumulado = detalle.reduce((acc, it) => acc + (Number(it.acumuladoActual) || 0), 0);

  const ejercicios = [
    { anio: ejercicio, saldo: totalAcumulado, acumulado: totalAcumulado }
  ];

  return { detalle, ejercicios };
}

module.exports = {
  obtenerResumen
};
