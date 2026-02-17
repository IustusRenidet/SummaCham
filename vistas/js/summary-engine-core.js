(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    global.SummaryEngineCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const ZERO_METRICS = {
    mesActual: 0,
    mesPlan: 0,
    mesAnterior: 0,
    mesVariacionPlan: 0,
    mesVariacionAnterior: 0,
    acumuladoActual: 0,
    acumuladoPlan: 0,
    acumuladoAnterior: 0,
    acumuladoVariacionPlan: 0,
    acumuladoVariacionAnterior: 0,
    ytdActual: 0,
    ytdPlan: 0,
    ytdAnterior: 0
  };

  const toNumber = (valor) => {
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : 0;
  };

  function zeroMetrics() {
    return { ...ZERO_METRICS };
  }

  function ensureAlias(metrics) {
    metrics.ytdActual = toNumber(metrics.ytdActual != null ? metrics.ytdActual : metrics.acumuladoActual);
    metrics.ytdPlan = toNumber(metrics.ytdPlan != null ? metrics.ytdPlan : metrics.acumuladoPlan);
    metrics.ytdAnterior = toNumber(metrics.ytdAnterior != null ? metrics.ytdAnterior : metrics.acumuladoAnterior);
    return metrics;
  }

  function sumMetrics(destino, fuente) {
    destino.mesActual += toNumber(fuente.mesActual);
    destino.mesPlan += toNumber(fuente.mesPlan);
    destino.mesAnterior += toNumber(fuente.mesAnterior);
    destino.acumuladoActual += toNumber(fuente.acumuladoActual);
    destino.acumuladoPlan += toNumber(fuente.acumuladoPlan);
    destino.acumuladoAnterior += toNumber(fuente.acumuladoAnterior);
    destino.ytdActual += toNumber(fuente.ytdActual != null ? fuente.ytdActual : fuente.acumuladoActual);
    destino.ytdPlan += toNumber(fuente.ytdPlan != null ? fuente.ytdPlan : fuente.acumuladoPlan);
    destino.ytdAnterior += toNumber(fuente.ytdAnterior != null ? fuente.ytdAnterior : fuente.acumuladoAnterior);
    return destino;
  }

  function safeDiv(numerador, denominador) {
    const num = Number(numerador || 0);
    const den = Number(denominador || 0);
    if (!Number.isFinite(den) || Math.abs(den) === 0) return 0;
    return num / den;
  }

  function variationPercent(actual, base) {
    const a = Number(actual || 0);
    const b = Number(base || 0);
    if (!Number.isFinite(b) || Math.abs(b) === 0) return 0;
    const ratio = safeDiv(a, b);
    return (ratio - 1) * 100;
  }

  function collectCodes(layout) {
    if (!Array.isArray(layout)) return [];
    const codigos = [];
    layout.forEach((item) => {
      if (item && String(item.tipo || '').toLowerCase() === 'cuenta' && item.codigo) {
        const codigo = String(item.codigo).trim();
        if (codigo) codigos.push(codigo);
      }
    });
    return codigos;
  }

  const TOKEN_REGEX = /[A-Za-z_][\w]*\.[A-Za-z_][\w]*|\d{3}-\d{3}-\d{3}-\d{2}|\d+\.\d+|\d+|[()+\-*/]/g;
  const PREC = { '+': 1, '-': 1, '*': 2, '/': 2 };

  function evaluateFormula(expresion, rowsOut, defaultColumn) {
    if (!expresion || typeof expresion !== 'string') return 0;

    // Normalizar tokens para soportar IDs de cuenta con guiones
    const TOKEN_REGEX = /[A-Za-z_][\w]*\.[A-Za-z_][\w]*|\d{3}-\d{3}-\d{3}-\d{2}|[A-Za-z_][\w]*|\d+\.\d+|\d+|[()+\-*/]/g;
    const tokens = expresion.match(TOKEN_REGEX) || [];
    const output = [];
    const operadores = [];

    const flushOperadores = (op) => {
      while (operadores.length > 0) {
        const top = operadores[operadores.length - 1];
        if (top === '(') break;
        if (PREC[top] >= PREC[op]) {
          output.push(operadores.pop());
        } else {
          break;
        }
      }
    };

    tokens.forEach((token) => {
      if (token === '(') {
        operadores.push(token);
      } else if (token === ')') {
        while (operadores.length > 0 && operadores[operadores.length - 1] !== '(') {
          output.push(operadores.pop());
        }
        operadores.pop();
      } else if (PREC[token]) {
        flushOperadores(token);
        operadores.push(token);
      } else {
        output.push(token);
      }
    });

    while (operadores.length > 0) {
      output.push(operadores.pop());
    }

    const pila = [];
    output.forEach((token) => {
      if (PREC[token]) {
        const b = pila.pop();
        const a = pila.pop();
        if (token === '+') pila.push(a + b);
        else if (token === '-') pila.push(a - b);
        else if (token === '*') pila.push(a * b);
        else if (token === '/') pila.push(safeDiv(a, b));
      } else if (/^[A-Za-z_][\w]*\.[A-Za-z_][\w]*$/.test(token)) {
        // Formato ID.Campo
        const [id, campo] = token.split('.');
        const fila = rowsOut && rowsOut[id] ? rowsOut[id] : {};
        pila.push(toNumber(fila[campo]));
      } else if (rowsOut && rowsOut[token] && defaultColumn) {
        // Formato ID solamente (usar columna por defecto)
        // Esto cubre secciones (ej: "membership") y cuentas (ej: "416-000-000-00")
        const fila = rowsOut[token];
        pila.push(toNumber(fila[defaultColumn]));
      } else {
        // Numero literal
        pila.push(toNumber(token));
      }
    });

    return toNumber(pila.pop());
  }

  function extraerIds(expresion, set) {
    if (!expresion || typeof expresion !== 'string') return;
    // Match ID.Field (e.g. op.acumuladoActual), Account Code (e.g. 400-000-000-00), or Simple ID (e.g. income)
    const coincidencias = expresion.match(/[A-Za-z_][\w]*\.[A-Za-z_][\w]*|\d{3}-\d{3}-\d{3}-\d{2}|[A-Za-z_][\w]*/g) || [];
    coincidencias.forEach((item) => {
      // Split by dot if present, take first part
      const parts = item.split('.');
      const id = parts[0];
      if (id && !['+', '-', '*', '/', '(', ')'].includes(id)) {
          set.add(id);
      }
    });
  }

  function buildSummaryRows(layout, detalle, opciones = {}) {
    const layoutArray = Array.isArray(layout) ? layout : [];
    const indicePorCodigo = new Map();
    (Array.isArray(detalle) ? detalle : []).forEach((registro) => {
      const codigo = registro && registro.codigo != null ? String(registro.codigo).trim() : '';
      if (codigo) indicePorCodigo.set(codigo, registro);
    });

    const nodosPorId = new Map();
    layoutArray.forEach((item) => {
      if (item && item.id) nodosPorId.set(item.id, { ...item });
    });

    const hijosPorPadre = new Map();
    layoutArray.forEach((item) => {
      if (!item || !item.id) return;
      const padre = item.padre || null;
      if (!hijosPorPadre.has(padre)) hijosPorPadre.set(padre, []);
      hijosPorPadre.get(padre).push(item.id);
    });

    const cache = new Map();

    const obtenerComponentes = (nodo, tipo) => {
      if (Object.prototype.hasOwnProperty.call(nodo, 'componentes')) {
        return Array.isArray(nodo.componentes) ? nodo.componentes : [];
      }
      const hijos = hijosPorPadre.get(nodo.id) || [];
      if (tipo === 'categoria') return hijos;
      return hijos.filter((idHijo) => {
        const info = nodosPorId.get(idHijo);
        if (!info) return false;
        const t = String(info.tipo || '').toLowerCase();
        return t !== 'kpi';
      });
    };

    const construirContextoFormulas = () => {
      const contexto = {};
      cache.forEach((valor, id) => {
        contexto[id] = ensureAlias({ ...valor.metrics });
      });
      return contexto;
    };

    const calcularNodo = (id) => {
      if (cache.has(id)) return cache.get(id);
      const nodo = nodosPorId.get(id);
      if (!nodo) {
        const vacio = { metrics: ensureAlias(zeroMetrics()), meta: { tipoFila: 'categoria', etiqueta: id } };
        cache.set(id, vacio);
        return vacio;
      }

      const tipo = String(nodo.tipo || '').toLowerCase();
      const metrics = ensureAlias(zeroMetrics());
      const meta = {
        tipoFila: tipo,
        etiqueta: nodo.titulo || nodo.etiqueta || ''
      };

      if (tipo === 'cuenta') {
        const codigo = nodo.codigo ? String(nodo.codigo).trim() : '';
        const registro = codigo ? indicePorCodigo.get(codigo) : null;
        metrics.mesActual = toNumber(registro?.mesActual);
        metrics.mesPlan = toNumber(registro?.mesPlan);
        metrics.mesAnterior = toNumber(registro?.mesAnterior);
        metrics.acumuladoActual = toNumber(registro?.acumuladoActual ?? registro?.ytdActual);
        metrics.acumuladoPlan = toNumber(registro?.acumuladoPlan ?? registro?.ytdPlan);
        metrics.acumuladoAnterior = toNumber(registro?.acumuladoAnterior ?? registro?.ytdAnterior);
        ensureAlias(metrics);
        meta.tipoFila = 'detalle';
        meta.codigo = codigo;
        const descripcion = registro?.descripcion || nodo.titulo || '';
        meta.descripcion = descripcion;
        if (!meta.etiqueta) meta.etiqueta = descripcion;
        meta.naturaleza = registro?.naturaleza || '';
      } else if (tipo === 'kpi' || (nodo.formula && tipo !== 'detalle' && tipo !== 'cuenta')) {
        // Enforce formula calculation for KPI or any section/operation with a formula
        const dependencias = new Set();
        if (nodo.formula) extraerIds(nodo.formula, dependencias);
        // Only check formulaMes if it exists (usually KPIs)
        if (nodo.formulaMes) extraerIds(nodo.formulaMes, dependencias);
        
        dependencias.forEach((dep) => {
             // Force calculation if dependency is a calculated node
            if (nodosPorId.has(dep) && !cache.has(dep)) calcularNodo(dep);
        });
        
        const contexto = construirContextoFormulas();
        const factor = nodo.factor != null ? Number(nodo.factor) : 1;

        if (tipo === 'kpi') {
             if (nodo.formula) {
               const columna = nodo.columnaYtd || nodo.columna || 'acumuladoActual';
               metrics[columna] = factor * evaluateFormula(nodo.formula, contexto, columna);
             }
             if (nodo.formulaMes) {
               const columnaMes = nodo.columnaMes || 'mesActual';
               metrics[columnaMes] = factor * evaluateFormula(nodo.formulaMes, contexto, columnaMes);
             }
        } else {
             // Standard row with formula: Apply to all columns
             // This corresponds to "Sections respecting their formula"
             const columnas = [
                'mesActual', 'mesPlan', 'mesAnterior',
                'acumuladoActual', 'acumuladoPlan', 'acumuladoAnterior',
                'ytdActual', 'ytdPlan', 'ytdAnterior'
             ];
             columnas.forEach(col => {
                metrics[col] = factor * evaluateFormula(nodo.formula, contexto, col);
             });
        }
        
        ensureAlias(metrics);
        if (tipo !== 'kpi') meta.tipoFila = tipo || 'operation';
        if (!meta.etiqueta) meta.etiqueta = nodo.titulo || nodo.id;

      } else {
        const componentes = obtenerComponentes(nodo, tipo);
        componentes.forEach((idHijo) => {
          if (idHijo === nodo.id) return;
          const infoHijo = calcularNodo(idHijo);
          sumMetrics(metrics, infoHijo.metrics);
        });
        ensureAlias(metrics);
        if (tipo !== 'categoria') meta.tipoFila = tipo;
        if (!meta.etiqueta) meta.etiqueta = nodo.titulo || nodo.id;
      }

      const resultado = { metrics, meta };
      cache.set(id, resultado);
      return resultado;
    };

    const salida = [];
    const estiloPorTipo = typeof opciones.estiloPorTipo === 'function' ? opciones.estiloPorTipo : () => undefined;

    const recorrer = (padre, depth) => {
      const hijos = hijosPorPadre.get(padre) || [];
      hijos.forEach((idHijo) => {
        const nodo = nodosPorId.get(idHijo);
        if (!nodo) return;
        const info = calcularNodo(idHijo);
        const metrics = ensureAlias({ ...zeroMetrics(), ...info.metrics });
        const tipoFila = info.meta.tipoFila || String(nodo.tipo || '').toLowerCase();
        const esKpi = tipoFila === 'kpi';
        const fila = {
          rowId: idHijo,
          tipoFila,
          tipo: tipoFila === 'detalle' ? 'detalle' : 'categoria',
          estilo: nodo.estilo || estiloPorTipo(tipoFila),
          codigo: info.meta.codigo || '',
          descripcion: info.meta.descripcion || '',
          etiqueta: info.meta.etiqueta || info.meta.descripcion || '',
          naturaleza: info.meta.naturaleza || '',
          depth,
          ...metrics
        };

        if (!esKpi) {
          fila.mesVariacionPlan = variationPercent(fila.mesActual, fila.mesPlan);
          fila.mesVariacionAnterior = variationPercent(fila.mesActual, fila.mesAnterior);
          fila.acumuladoVariacionPlan = variationPercent(fila.acumuladoActual, fila.acumuladoPlan);
          fila.acumuladoVariacionAnterior = variationPercent(fila.acumuladoActual, fila.acumuladoAnterior);
        } else {
          fila.mesVariacionPlan = toNumber(fila.mesVariacionPlan);
          fila.mesVariacionAnterior = toNumber(fila.mesVariacionAnterior);
          fila.acumuladoVariacionPlan = toNumber(fila.acumuladoVariacionPlan);
          fila.acumuladoVariacionAnterior = toNumber(fila.acumuladoVariacionAnterior);
        }

        salida.push(fila);

        const tipoNodo = String(nodo.tipo || '').toLowerCase();
        if (tipoNodo === 'categoria') {
          recorrer(idHijo, depth + 1);
        }
      });
    };

    recorrer(null, 0);
    return salida;
  }

  return {
    zeroMetrics,
    safeDiv,
    variationPercent,
    evaluateFormula,
    collectCodes,
    buildSummaryRows
  };
});
