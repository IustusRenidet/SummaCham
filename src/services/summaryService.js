const { ejecutarConsulta } = require('./firebirdService');

const pad2 = (n) => n.toString().padStart(2, '0');

// Devuelve el nombre fisico de la tabla (p.ej. SALDOS26, CUENTAS26)
const nombreTabla = (prefijo, anio) => `${prefijo}${anio.toString().slice(-2).padStart(2, '0')}`;

// Construye una expresion de suma para columnas CARGOxx/ABONOxx hasta el periodo indicado.
//
// La UI solicita montos "mes" y "acumulado" (YTD) para el ejercicio en curso y para el
// ejercicio comparativo (generalmente el año anterior). Para calcular el acumulado se van
// sumando las columnas CARGOnn/ABONOnn desde enero (01) hasta el periodo seleccionado; si
// el periodo es 13 significa que el usuario está pidiendo el ajuste anual y se deben
// contemplar también esas columnas.
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
// Derivada de codigos: garantiza presencia de cada NUM_CTA en el resultado
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

// SELECT principal del resumen (mes y YTD) para ejercicio/periodo.
//
// La lógica del Summary es: por cada código contable solicitado se calculan los saldos del
// mes (`MES`) y el acumulado del año (`YTD`) utilizando SALDOSxx.<Periodo>. Esta misma
// consulta se ejecuta dos veces: una para el ejercicio actual y otra para el ejercicio
// comparativo (anioComparativo). De esa forma el front puede mostrar en la tabla una fila
// con las tres columnas claves: mes actual, mes anterior y acumulado anterior.
const construirSelectResumen = ({ anio, periodo, usarAjusteEnYTD, codigos }) => {
  const tablaSaldos = nombreTabla('SALDOS', anio);
  const tablaCuentas = nombreTabla('CUENTAS', anio);

  const p = Math.max(1, Math.min(13, Number(periodo) || 1));
  const pp = pad2(p);
  const incluirAjuste = Boolean(usarAjusteEnYTD) && p >= 13;
  const ytdHasta = incluirAjuste ? 13 : Math.min(p, 12);

  // `exprMes` obtiene el movimiento del periodo seleccionado (cargo - abono).
  // `exprYtd` suma el saldo inicial más todos los movimientos hasta el periodo solicitado.
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

  const ejerciciosDisponibles = await listarAniosSALDOS(empresaId);

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
  listarAniosSALDOS
};

// Lista años disponibles detectando tablas SALDOSxx en la base de datos
async function listarAniosSALDOS(empresaId) {
  // Consultar tablas de usuario que empiecen con SALDOS
  const sql = `
    SELECT TRIM(RDB$RELATION_NAME) AS NOMBRE
    FROM RDB$RELATIONS
    WHERE (RDB$SYSTEM_FLAG = 0 OR RDB$SYSTEM_FLAG IS NULL)
      AND RDB$VIEW_BLR IS NULL
      AND UPPER(RDB$RELATION_NAME) LIKE 'SALDOS%'
  `;
  const filas = await ejecutarConsulta(empresaId, sql, []);

  const aniosSet = new Set();
  (filas || []).forEach((r) => {
    const nombre = String(r.NOMBRE || '').trim().toUpperCase();
    const m = nombre.match(/^SALDOS(\d{2})$/);
    if (m) {
      const suf = parseInt(m[1], 10);
      const anio = 2000 + suf; // SALDOS01 -> 2001, SALDOS20 -> 2020
      if (anio >= 2000 && anio <= 2099) aniosSet.add(anio);
    }
  });

  const anios = Array.from(aniosSet).sort((a, b) => b - a);
  return anios;
}
