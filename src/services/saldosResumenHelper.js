const pad2 = (numero) => String(numero).padStart(2, '0');

const nombreTabla = (prefijo, anio) => `${prefijo}${anio.toString().slice(-2).padStart(2, '0')}`;

const sumaCols = (prefix, hasta) => {
  const limite = Math.max(0, Math.min(13, Number(hasta) || 0));
  if (limite <= 0) return '0';
  const partes = [];
  for (let i = 1; i <= limite; i += 1) {
    partes.push(`COALESCE(${prefix}${pad2(i)}, 0)`);
  }
  return partes.join(' + ');
};

const tablaCodigosDerivada = (codigos = []) => {
  const limpios = (Array.isArray(codigos) ? codigos : [])
    .map((c) => (c == null ? '' : String(c).trim()))
    .filter((c) => c.length > 0);
  if (limpios.length === 0) {
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
      c.NATURALEZA,
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

module.exports = {
  construirSelectResumen,
  nombreTabla
};
