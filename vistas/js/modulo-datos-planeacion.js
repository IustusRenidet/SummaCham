/**
 * Datos reales (filas + valores) de la tabla de un modulo, para el Gestor de
 * Plantillas (buscador de filas del editor de graficas y vistas previas).
 *
 * Reemplaza el mecanismo anterior basado en "snapshot" (capturar la tabla ya
 * renderizada y guardarla en localStorage, con una iframe oculta como
 * respaldo cuando no existia). En vez de eso, llama directamente a los
 * mismos endpoints que ya usa cuentas-modulo.js para pintar la tabla real:
 *   - GET /api/layouts/:modulo/:anio/:capitulo  -> cuentas + operaciones
 *     (secciones, orden de aparicion, formulas de suma/resultado)
 *   - POST /api/planeacion/cuentas -> presupuesto y real (Firebird) por
 *     cuenta y mes
 * Sin visitar ninguna pagina, sin guardar nada en localStorage.
 */
(() => {
  const API_BASE = (() => {
    if (window.location.protocol === "file:") {
      return "http://localhost:3005/api";
    }
    return `${window.location.origin}/api`;
  })();

  const MESES_CLAVE = [
    "ene", "feb", "mar", "abr", "may", "jun",
    "jul", "ago", "sep", "oct", "nov", "dic",
  ];

  // El backend (planeacionCuentasService.js) devuelve cada cuenta ya
  // normalizada a su formato Aspel COI de 21 digitos (base de 11 + nivel),
  // no el "417-023-000-00" que trae el layout -- hay que aplicar la MISMA
  // normalizacion aqui para poder cruzar layout.cuentas / formula_terms
  // contra la respuesta de /api/planeacion/cuentas por igual.
  const limpiarCuentaBase = (valor = "") => valor.toString().replace(/[^0-9]/g, "");

  const deducirNivelCuenta = (base) => {
    const limpio = base.padEnd(11, "0").slice(0, 11);
    const b = limpio.slice(3, 6);
    const c = limpio.slice(6, 9);
    const d = limpio.slice(9, 11);
    if (b === "000" && c === "000" && d === "00") return "1";
    if (c === "000" && d === "00") return "2";
    if (d === "00") return "3";
    return "4";
  };

  const formatearCuentaAspel = (valor) => {
    const limpio = limpiarCuentaBase(valor);
    if (!limpio) return "";
    if (limpio.length >= 21) return limpio.slice(0, 21);
    const base = limpio.slice(0, 11).padEnd(11, "0");
    const nivel = deducirNivelCuenta(base);
    return base.padEnd(20, "0") + nivel;
  };

  const cacheLayout = new Map();
  const cachePlaneacion = new Map();

  const resolverCapituloCompleto = (empresaId) => {
    try {
      return window.CapitulosModulos?.obtenerCapituloPorEmpresa?.(empresaId) || "";
    } catch (_) {
      return "";
    }
  };

  const fetchLayoutReal = async (moduleValue, anio, empresaId) => {
    const capitulo = resolverCapituloCompleto(empresaId);
    if (!moduleValue || !anio || !empresaId || !capitulo) return null;
    const cacheKey = `${empresaId}:${moduleValue}:${anio}:${capitulo}`;
    if (cacheLayout.has(cacheKey)) return cacheLayout.get(cacheKey);
    const promise = (async () => {
      try {
        const url = `${API_BASE}/layouts/${encodeURIComponent(moduleValue)}/${encodeURIComponent(
          anio
        )}/${encodeURIComponent(capitulo)}?empresaId=${encodeURIComponent(empresaId)}`;
        const resp = await fetch(url, {
          headers: window.Sesion?.headersAutenticacion?.() || {},
        });
        if (!resp.ok) return null;
        const data = await resp.json();
        const layout = data?.layout || null;
        if (!layout) return null;
        return {
          cuentas: Array.isArray(layout.cuentas) ? layout.cuentas : [],
          operaciones: Array.isArray(layout.operaciones) ? layout.operaciones : [],
        };
      } catch (_) {
        return null;
      }
    })();
    cacheLayout.set(cacheKey, promise);
    const resolved = await promise;
    cacheLayout.set(cacheKey, resolved);
    return resolved;
  };

  const fetchPlaneacionCuentas = async (empresaId, anio, moduleValue, cuentas) => {
    if (!empresaId || !anio || !cuentas.length) return [];
    const cacheKey = `${empresaId}:${moduleValue}:${anio}:${cuentas.slice().sort().join(",")}`;
    if (cachePlaneacion.has(cacheKey)) return cachePlaneacion.get(cacheKey);
    const promise = (async () => {
      try {
        const resp = await fetch(`${API_BASE}/planeacion/cuentas`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(window.Sesion?.headersAutenticacion?.() || {}),
          },
          body: JSON.stringify({ empresaId, anio, modulo: moduleValue, cuentas }),
        });
        if (!resp.ok) return [];
        const data = await resp.json();
        return Array.isArray(data?.cuentas) ? data.cuentas : [];
      } catch (_) {
        return [];
      }
    })();
    cachePlaneacion.set(cacheKey, promise);
    const resolved = await promise;
    cachePlaneacion.set(cacheKey, resolved);
    return resolved;
  };

  // Traduce {presupuesto:{ene..dic}, real:{ene..dic, ene_acum..dic_acum}} a
  // las mismas claves sinteticas que ya usan operativo-sidebar.js y el
  // editor (monthBudget_ene, monthReal_ene, budgetAnnual, totalBudget,
  // totalReal) para que todo el resto del sistema (checkboxes de columnas,
  // matching de series) siga funcionando sin cambios.
  const construirTotalesDeCuenta = (registro) => {
    const presupuesto = registro?.presupuesto || {};
    const real = registro?.real || {};
    const totals = {};
    let sumaPresupuesto = 0;
    MESES_CLAVE.forEach((mes) => {
      const p = Number(presupuesto[mes] || 0);
      const r = Number(real[mes] || 0);
      totals[`monthBudget_${mes}`] = p;
      totals[`monthReal_${mes}`] = r;
      sumaPresupuesto += p;
    });
    totals.budgetAnnual = sumaPresupuesto;
    totals.totalBudget = sumaPresupuesto;
    totals.totalReal = Number(real.dic_acum ?? real.dic ?? 0);
    return totals;
  };

  const sumarTotales = (a, b, signo) => {
    const out = { ...a };
    Object.keys(b || {}).forEach((key) => {
      out[key] = (out[key] || 0) + signo * (b[key] || 0);
    });
    return out;
  };

  const TOTALS_VACIOS = () => ({
    budgetAnnual: 0,
    totalBudget: 0,
    totalReal: 0,
    ...Object.fromEntries(
      MESES_CLAVE.flatMap((mes) => [
        [`monthBudget_${mes}`, 0],
        [`monthReal_${mes}`, 0],
      ])
    ),
  });

  // Resuelve el total de UNA operacion (fila de suma o resultado),
  // recursivamente segun formula_terms: cada termino es una cuenta
  // especifica, una seccion completa (suma de todas sus cuentas) u otra
  // operacion (por su OperacionId) -- exactamente el mismo arbol de formula
  // que ya usa el motor de la tabla real, solo que evaluado aqui en vez de
  // asumido/aproximado.
  const evaluarOperacion = (operacionId, ctx, pila = new Set()) => {
    if (ctx.cacheOperaciones.has(operacionId)) return ctx.cacheOperaciones.get(operacionId);
    if (pila.has(operacionId)) return TOTALS_VACIOS(); // formula circular, no debería pasar
    const operacion = ctx.operacionesPorId.get(operacionId);
    if (!operacion) return TOTALS_VACIOS();
    pila.add(operacionId);
    let total = TOTALS_VACIOS();
    (operacion.formula_terms || []).forEach((term) => {
      const signo = term?.operator === "-" ? -1 : 1;
      const tipo = (term?.type || "").toLowerCase();
      const valor = (term?.value || "").toString();
      if (tipo === "account") {
        const cuentaTotals = ctx.totalesPorCuenta.get(valor);
        if (cuentaTotals) total = sumarTotales(total, cuentaTotals, signo);
      } else if (tipo === "section") {
        const cuentasSeccion = ctx.cuentasPorSeccion.get(valor) || [];
        cuentasSeccion.forEach((cuentaNum) => {
          const cuentaTotals = ctx.totalesPorCuenta.get(cuentaNum);
          if (cuentaTotals) total = sumarTotales(total, cuentaTotals, signo);
        });
      } else if (tipo === "operation") {
        const subTotal = evaluarOperacion(valor, ctx, pila);
        total = sumarTotales(total, subTotal, signo);
      }
    });
    pila.delete(operacionId);
    ctx.cacheOperaciones.set(operacionId, total);
    return total;
  };

  const PSEUDO_OPERACIONES = new Set(["LAYOUT_CONFIG", "COLUMN_CONFIG"]);

  /**
   * Devuelve las filas reales de la tabla de un modulo (cuentas + filas de
   * suma/resultado), en el orden en que aparecen, cada una con label y
   * totals ya resueltos con las claves sinteticas monthBudget_<mes>/
   * monthReal_<mes>/budgetAnnual/totalBudget/totalReal.
   */
  const fetchFilasModulo = async (moduleValue, anio, empresaId) => {
    const layout = await fetchLayoutReal(moduleValue, anio, empresaId);
    if (!layout) return null;

    const cuentas = layout.cuentas.filter((c) => c?.visible !== false && c?.CUENTA);
    // Las formulas de las operaciones (sum-row/result-row) pueden referirse
    // a cuentas que NO aparecen como fila propia en la tabla -- hay que
    // pedir tambien esas al backend, o la formula se queda en cero para
    // esos terminos.
    const cuentasEnFormulas = layout.operaciones.flatMap((op) =>
      (op.formula_terms || [])
        .filter((term) => (term?.type || "").toLowerCase() === "account")
        .map((term) => (term?.value || "").toString())
    );
    const numerosCuenta = Array.from(
      new Set([...cuentas.map((c) => c.CUENTA), ...cuentasEnFormulas].filter(Boolean))
    );
    const planeacion = await fetchPlaneacionCuentas(
      empresaId,
      anio,
      moduleValue,
      numerosCuenta
    );
    // El backend devuelve cada "cuenta" ya normalizada a su formato Aspel
    // COI de 21 digitos (formatearCuentaAspel), no como vino del layout
    // ("417-023-000-00") -- normalizar ambos lados igual para poder
    // cruzarlos.
    const totalesPorCuentaAspel = new Map(
      planeacion.map((registro) => [
        formatearCuentaAspel(registro.cuenta),
        construirTotalesDeCuenta(registro),
      ])
    );
    const resolverTotalesCuenta = (numCuenta) =>
      totalesPorCuentaAspel.get(formatearCuentaAspel(numCuenta)) || null;

    const cuentasPorSeccion = new Map();
    cuentas.forEach((c) => {
      const seccion = c.SECCION || c["SECCION Principal"] || "";
      if (!seccion) return;
      if (!cuentasPorSeccion.has(seccion)) cuentasPorSeccion.set(seccion, []);
      cuentasPorSeccion.get(seccion).push(c.CUENTA);
    });

    const operacionesVisibles = layout.operaciones.filter(
      (op) => op?.visible !== false && !PSEUDO_OPERACIONES.has(op?.OperacionId || op?.Clase)
    );
    const operacionesPorId = new Map(
      layout.operaciones.map((op) => [op.OperacionId || op.Clase, op])
    );

    const ctx = {
      totalesPorCuenta: new Map(
        numerosCuenta
          .map((numCuenta) => [numCuenta, resolverTotalesCuenta(numCuenta)])
          .filter(([, totals]) => totals)
      ),
      cuentasPorSeccion,
      operacionesPorId,
      cacheOperaciones: new Map(),
    };

    const filasCuentas = cuentas.map((c) => ({
      label: (c.NOMBRE || c.CUENTA || "").toString().trim(),
      orden: Number(c.orden_presentacion ?? c.orden ?? 0),
      totals: ctx.totalesPorCuenta.get(c.CUENTA) || TOTALS_VACIOS(),
    }));

    const filasOperaciones = operacionesVisibles.map((op) => {
      const id = op.OperacionId || op.Clase;
      return {
        label: (op.Clase || id || "").toString().trim(),
        orden: Number(op.orden_presentacion ?? op.orden ?? 0),
        totals: evaluarOperacion(id, ctx),
      };
    });

    const filas = [...filasCuentas, ...filasOperaciones]
      .filter((f) => f.label)
      .sort((a, b) => a.orden - b.orden);

    return { filas };
  };

  window.ModuloDatosPlaneacion = {
    fetchFilasModulo,
    resolverCapituloCompleto,
  };
})();
