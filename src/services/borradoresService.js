const { db, registrarPresupuestoGuardado } = require("../db/sqlite");

const ESTADOS = {
  EDITANDO: "EDITANDO",
  PENDIENTE: "PENDIENTE",
  REVISADO: "REVISADO",
  RECHAZADO: "RECHAZADO",
  APROBADO: "APROBADO",
  GUARDADO: "GUARDADO",
};

const HISTORIAL_ACCIONES = {
  GUARDAR_BORRADOR: {
    clave: "guardar-borrador",
    etiqueta: "Guardó el borrador",
  },
  ENVIAR_REVISION: { clave: "enviar-revision", etiqueta: "Envió a revisión" },
  RECHAZAR: { clave: "rechazar", etiqueta: "Rechazó el borrador" },
  MARCAR_REVISADO: {
    clave: "marcar-revision",
    etiqueta: "Marcó como revisado",
  },
  CANCELAR_REVISION: {
    clave: "cancelar-revision",
    etiqueta: "Regresó a edición",
  },
  AUTORIZAR: { clave: "autorizar", etiqueta: "Autorizó el borrador" },
  AUTO_AUTORIZAR: {
    clave: "autorizar-automatica",
    etiqueta: "Autorización automática",
  },
  GUARDAR_COI: { clave: "guardar-coi", etiqueta: "Guardó en COI" },
  DESCARTAR: { clave: "descartar", etiqueta: "Descartó el borrador" },
};

const ETIQUETAS_ESTADO = {
  EDITANDO: "En edición",
  PENDIENTE: "Pendiente de revisión",
  REVISADO: "Revisado",
  RECHAZADO: "Rechazado",
  APROBADO: "Autorizado",
  GUARDADO: "Guardado en COI",
};

const progresoRecontabilizacion = new Map();
const colaRecontabilizacion = new Map();

const obtenerClaveCola = (empresaId, anio) =>
  `${empresaId || ""}-${Number(anio) || ""}`;

const encolarRecontabilizacion = ({ empresaId, anio, borradorId }, tarea) => {
  const clave = obtenerClaveCola(empresaId, anio);
  const info = colaRecontabilizacion.get(clave) || {
    cola: Promise.resolve(),
    tamanio: 0,
  };

  info.tamanio += 1;
  const posicion = info.tamanio;

  const ejecucion = info.cola
    .catch(() => undefined)
    .then(() => tarea())
    .finally(() => {
      info.tamanio = Math.max(0, info.tamanio - 1);
      if (info.tamanio === 0) {
        colaRecontabilizacion.delete(clave);
      } else {
        colaRecontabilizacion.set(clave, info);
      }
    });

  info.cola = ejecucion;
  colaRecontabilizacion.set(clave, info);

  if (borradorId) {
    actualizarProgresoRecontabilizacion(borradorId, {
      estado: "en-cola",
      posicion,
    });
  }

  return { posicion, ejecucion };
};

const iniciarProgresoRecontabilizacion = (borradorId) => {
  if (!borradorId) return;
  progresoRecontabilizacion.set(String(borradorId), {
    estado: "iniciando",
    total: 0,
    actual: 0,
    porcentaje: 0,
    actualizadoEn: new Date().toISOString(),
  });
};

const actualizarProgresoRecontabilizacion = (borradorId, data = {}) => {
  if (!borradorId) return;
  const clave = String(borradorId);
  const previo = progresoRecontabilizacion.get(clave) || {
    estado: "iniciando",
    total: 0,
    actual: 0,
    porcentaje: 0,
  };
  const total = Number.isFinite(data.total) ? data.total : previo.total;
  const actual = Number.isFinite(data.actual) ? data.actual : previo.actual;
  const porcentaje = total > 0 ? Math.min(100, Math.round((actual / total) * 100)) : 0;
  progresoRecontabilizacion.set(clave, {
    ...previo,
    ...data,
    total,
    actual,
    porcentaje,
    actualizadoEn: new Date().toISOString(),
  });
};

const finalizarProgresoRecontabilizacion = (borradorId, estado = "completado") => {
  if (!borradorId) return;
  actualizarProgresoRecontabilizacion(borradorId, { estado, porcentaje: 100 });
};

const obtenerProgresoRecontabilizacion = (borradorId) => {
  if (!borradorId) return null;
  return progresoRecontabilizacion.get(String(borradorId)) || null;
};

const obtenerEtiquetaAccion = (clave) => {
  if (!clave) return "";
  const entrada = Object.values(HISTORIAL_ACCIONES).find(
    (accion) => accion.clave === clave
  );
  return entrada?.etiqueta || clave;
};

const obtenerEtiquetaEstado = (estado) => ETIQUETAS_ESTADO[estado] || estado;

const registrarEventoHistorial = ({
  borradorId,
  empresaId,
  modulo,
  anio,
  capitulo = 'DEFAULT',
  estado,
  accion,
  descripcion = "",
  comentarios = "",
  usuarioId = null,
}) => {
  if (
    !empresaId ||
    !modulo ||
    !Number.isInteger(Number(anio)) ||
    !estado ||
    !accion
  ) {
    return;
  }
  db.prepare(
    `
    INSERT INTO PLAN_BORRADORES_HISTORIAL (
      borradorId, empresaId, modulo, anio, capitulo, estado, accion, descripcion, comentarios, usuarioId, registradoEn
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `
  ).run(
    borradorId || null,
    empresaId,
    modulo,
    Number(anio),
    capitulo || 'DEFAULT',
    estado,
    accion,
    descripcion,
    comentarios || null,
    usuarioId ? String(usuarioId) : null
  );
};

const mapData = (texto) => {
  if (!texto) return null;
  try {
    return JSON.parse(texto);
  } catch (error) {
    return texto;
  }
};

const normalizarContexto = (contexto) => {
  if (!contexto) {
    throw new Error("Contexto del borrador no proporcionado.");
  }
  const empresaId = (contexto.empresaId || "").toString().trim();
  const modulo = (contexto.modulo || "").toString().trim();
  const anio = Number(contexto.anio);
  const capitulo = (contexto.capitulo || 'DEFAULT').toString().trim();
  const usuarioId = (contexto.usuarioId || "").toString().trim();
  if (!empresaId || !modulo || !Number.isInteger(anio) || !usuarioId) {
    throw new Error("Contexto incompleto para el borrador.");
  }
  return {
    empresaId,
    modulo,
    anio,
    capitulo,
    usuarioId,
    comentarios: contexto.comentarios
      ? contexto.comentarios.toString().trim()
      : null,
  };
};

const mapearFila = (fila) => {
  if (!fila) {
    return null;
  }
  return {
    id: fila.id,
    empresaId: fila.empresaId,
    modulo: fila.modulo,
    anio: fila.anio,
    capitulo: fila.capitulo || 'DEFAULT',
    usuarioId: fila.usuarioId,
    data: mapData(fila.data),
    estado: fila.estado,
    fechaCreacion: fila.fechaCreacion,
    fechaEnvio: fila.fechaEnvio,
    comentarios: fila.comentarios,
  };
};

const mapearResumen = (fila) => {
  if (!fila) return null;
  const autorNombre = fila.autorNombre || "";
  return {
    id: fila.id,
    empresaId: fila.empresaId,
    modulo: fila.modulo,
    anio: fila.anio,
    capitulo: fila.capitulo || 'DEFAULT',
    usuarioId: fila.usuarioId,
    estado: fila.estado,
    fechaCreacion: fila.fechaCreacion,
    fechaEnvio: fila.fechaEnvio,
    comentarios: fila.comentarios,
    autorUsuario: fila.autorUsuario || "",
    autorNombre: autorNombre.trim() || fila.autorUsuario || "",
    data: null,
  };
};

const obtenerBorradorPorId = (id) => {
  if (!id) {
    return null;
  }
  const fila = db
    .prepare(
      `
    SELECT *
    FROM PLAN_BORRADORES
    WHERE id = ?
  `
    )
    .get(id);
  return mapearFila(fila);
};

const listarBorradores = ({ empresaId, modulo, anio, capitulo, estado } = {}) => {
  const condiciones = [];
  const parametros = [];
  if (empresaId) {
    condiciones.push("b.empresaId = ?");
    parametros.push(empresaId);
  }
  if (modulo) {
    condiciones.push("b.modulo = ?");
    parametros.push(modulo);
  }
  if (Number.isInteger(anio)) {
    condiciones.push("b.anio = ?");
    parametros.push(anio);
  }
  if (capitulo) {
    condiciones.push("b.capitulo = ?");
    parametros.push(capitulo);
  }
  if (estado) {
    condiciones.push("b.estado = ?");
    parametros.push(estado);
  }

  const whereClause = condiciones.length
    ? `WHERE ${condiciones.join(" AND ")}`
    : "";

  const filas = db
    .prepare(
      `
    SELECT
      b.*,
      u.usuario AS autorUsuario,
      TRIM(COALESCE(u.nombres, '') || ' ' || COALESCE(u.apellidos, '')) AS autorNombre
    FROM PLAN_BORRADORES b
    LEFT JOIN usuarios u ON u.id = CAST(b.usuarioId AS INTEGER)
    ${whereClause}
    ORDER BY b.fechaEnvio DESC NULLS LAST, b.fechaCreacion DESC
  `
    )
    .all(...parametros);

  return filas.map(mapearResumen).filter(Boolean);
};

const buildBaseWhere = ({ empresaId, modulo, anio }) => {
  const condiciones = [];
  const parametros = [];
  if (empresaId) {
    condiciones.push("empresaId = ?");
    parametros.push(empresaId);
  }
  if (modulo) {
    condiciones.push("modulo = ?");
    parametros.push(modulo);
  }
  if (Number.isInteger(Number(anio))) {
    condiciones.push("anio = ?");
    parametros.push(Number(anio));
  }
  return { condiciones, parametros };
};

const listarHistorialBorradores = ({
  empresaId,
  modulo,
  anio,
  estado,
  accion,
  usuarioId,
  buscar,
  desde,
  hasta,
  limite = 100,
} = {}) => {
  const condiciones = [];
  const parametros = [];
  const base = buildBaseWhere({ empresaId, modulo, anio });
  if (base.condiciones.length) {
    condiciones.push(...base.condiciones);
    parametros.push(...base.parametros);
  }
  if (estado) {
    condiciones.push("estado = ?");
    parametros.push(estado);
  }
  if (accion) {
    condiciones.push("accion = ?");
    parametros.push(accion);
  }
  if (usuarioId) {
    condiciones.push("usuarioId = ?");
    parametros.push(String(usuarioId));
  }
  if (buscar) {
    condiciones.push("(descripcion LIKE ? OR comentarios LIKE ?)");
    const termino = `%${buscar.trim()}%`;
    parametros.push(termino, termino);
  }
  if (desde) {
    condiciones.push("DATE(registradoEn) >= DATE(?)");
    parametros.push(desde);
  }
  if (hasta) {
    condiciones.push("DATE(registradoEn) <= DATE(?)");
    parametros.push(hasta);
  }
  const whereClause = condiciones.length
    ? `WHERE ${condiciones.join(" AND ")}`
    : "";
  const limiteSeguro = Math.min(Math.max(Number(limite) || 50, 1), 500);

  const filas = db
    .prepare(
      `
    SELECT h.*, u.usuario AS autorUsuario, u.correo AS autorCorreo,
           TRIM(COALESCE(u.nombres, '') || ' ' || COALESCE(u.apellidos, '')) AS autorNombre
    FROM PLAN_BORRADORES_HISTORIAL h
    LEFT JOIN usuarios u ON u.id = CAST(h.usuarioId AS INTEGER)
    ${whereClause}
    ORDER BY h.registradoEn DESC
    LIMIT ?
  `
    )
    .all(...parametros, limiteSeguro);

  return filas.map((fila) => ({
    id: fila.id,
    borradorId: fila.borradorId,
    empresaId: fila.empresaId,
    modulo: fila.modulo,
    anio: fila.anio,
    estado: fila.estado,
    estadoEtiqueta: obtenerEtiquetaEstado(fila.estado),
    accion: fila.accion,
    accionEtiqueta: obtenerEtiquetaAccion(fila.accion),
    descripcion: fila.descripcion || "",
    comentarios: fila.comentarios || "",
    fecha: fila.registradoEn,
    usuario: {
      id: fila.usuarioId ? Number(fila.usuarioId) : null,
      usuario: fila.autorUsuario || "",
      nombre: (fila.autorNombre || "").trim() || fila.autorUsuario || "",
      correo: fila.autorCorreo || "",
    },
  }));
};

const obtenerFiltrosHistorial = ({ empresaId, modulo, anio } = {}) => {
  const base = buildBaseWhere({ empresaId, modulo, anio });
  const filtros = { estados: [], acciones: [], usuarios: [] };
  const whereClause = base.condiciones.length
    ? `WHERE ${base.condiciones.join(" AND ")}`
    : "";
  const params = base.parametros;

  const estados = db
    .prepare(
      `
    SELECT DISTINCT estado FROM PLAN_BORRADORES_HISTORIAL ${whereClause} ORDER BY estado
  `
    )
    .all(...params);
  filtros.estados = estados
    .map((row) => row.estado)
    .filter(Boolean)
    .map((valor) => ({ valor, etiqueta: obtenerEtiquetaEstado(valor) }));

  const acciones = db
    .prepare(
      `
    SELECT DISTINCT accion FROM PLAN_BORRADORES_HISTORIAL ${whereClause} ORDER BY accion
  `
    )
    .all(...params);
  filtros.acciones = acciones
    .map((row) => row.accion)
    .filter(Boolean)
    .map((valor) => ({ valor, etiqueta: obtenerEtiquetaAccion(valor) }));

  const usuarios = db
    .prepare(
      `
    SELECT DISTINCT h.usuarioId AS id,
      u.usuario AS cuenta,
      TRIM(COALESCE(u.nombres, '') || ' ' || COALESCE(u.apellidos, '')) AS nombre
    FROM PLAN_BORRADORES_HISTORIAL h
    LEFT JOIN usuarios u ON u.id = CAST(h.usuarioId AS INTEGER)
    ${whereClause}
    ORDER BY nombre
  `
    )
    .all(...params);
  filtros.usuarios = usuarios
    .filter((row) => row.id)
    .map((row) => ({
      id: Number(row.id),
      etiqueta: (row.nombre || "").trim() || row.cuenta || `Usuario ${row.id}`,
    }));

  return filtros;
};

const  persistirEnFirebird = async (borrador) => {
  // 1. Guardar registro en SQLite (para historial)
  registrarPresupuestoGuardado({
    empresaId: borrador.empresaId,
    modulo: borrador.modulo,
    anio: borrador.anio,
    datos: borrador.data,
    guardadoPor: Number(borrador.usuarioId) || null,
  });

  // 2. Guardar LAYOUT (estructura de tabla: cuentas/descripciones/filas) en layout_cuentas (SQLite)
  const { guardarLayout } = require('./layoutsService');
  
  // 3. Guardar en Firebird PRESUP table (solo valores numéricos)
  const { ejecutarConsulta } = require("./firebirdService");

  let datos;
  try {
    datos =
      typeof borrador.data === "string"
        ? JSON.parse(borrador.data)
        : borrador.data;
  } catch (parseError) {
    console.error("❌ Error al parsear datos del borrador:", parseError);
    throw new Error("Los datos del borrador están corruptos.");
  }

  const presupuesto = Array.isArray(datos?.presupuesto)
    ? datos.presupuesto
    : [];

  // ✅ PASO 1: Guardar LAYOUT (estructura) en layout_cuentas
  // El layout incluye: cuentas, descripciones, orden de filas, secciones creadas
  if (datos?.layout || datos?.filas) {
    const layoutData = datos.layout || { filas: datos.filas || [] };
    try {
      guardarLayout({
        empresaId: borrador.empresaId,
        modulo: borrador.modulo,
        anio: borrador.anio,
        layout: layoutData,
        usuarioId: Number(borrador.usuarioId) || null
      });
      console.log(`✅ Layout actualizado en layout_cuentas (${borrador.empresaId}/${borrador.modulo}/${borrador.anio})`);
    } catch (layoutError) {
      console.error(`❌ Error guardando layout:`, layoutError);
      // No bloquear - continuar con presupuesto
    }
  }

  // ✅ PASO 2: Validar que hay datos de presupuesto antes de proceder
  if (!presupuesto || presupuesto.length === 0) {
    console.warn(
      `⚠️ Borrador ${borrador.id} (${borrador.empresaId}/${borrador.modulo}/${borrador.anio}) sin datos presupuestarios`
    );
    // No lanzar error - puede ser un borrador solo con cambios de layout
    return;
  }

  // ✅ MEJORA: Validar que hay valores numéricos válidos
  const tieneValoresValidos = presupuesto.some((cambio) => {
    if (!cambio || !cambio.valores) return false;
    return Object.values(cambio.valores).some((v) => {
      const num = Number(v);
      return Number.isFinite(num) && num !== 0;
    });
  });

  if (!tieneValoresValidos) {
    console.warn(
      `⚠️ Borrador ${borrador.id} (${borrador.empresaId}/${borrador.modulo}/${borrador.anio}) ` +
        `con solo ceros o valores inválidos`
    );
    // Registrar pero permitir - puede ser presupuesto legítimo de ceros
  }

  const anio = Number(borrador.anio);
  const sufijo = anio.toString().slice(-2).padStart(2, "0");
  const tablaPresup = `PRESUP${sufijo}`;

  // ✅ MEJORA: Registrar intent de guardar
  console.log(
    `📝 Persistencia en Firebird: ${presupuesto.length} cuentas → ${tablaPresup} ` +
      `(empresa: ${borrador.empresaId}, módulo: ${borrador.modulo})`
  );

  // Mapeo de claves a columnas PRESUP01-PRESUP12
  const MESES_COLUMNAS = {
    "budget-ene": "PRESUP01",
    "budget-feb": "PRESUP02",
    "budget-mar": "PRESUP03",
    "budget-abr": "PRESUP04",
    "budget-may": "PRESUP05",
    "budget-jun": "PRESUP06",
    "budget-jul": "PRESUP07",
    "budget-ago": "PRESUP08",
    "budget-sep": "PRESUP09",
    "budget-oct": "PRESUP10",
    "budget-nov": "PRESUP11",
    "budget-dic": "PRESUP12",
  };

  let contadorExitosas = 0;
  let contadorErrores = 0;
  const presupuestosEditados = new Map();
  let manualBaseMap = null;

  try {
    manualBaseMap = await calcularManualPadres(
      borrador.empresaId,
      anio,
      tablaPresup
    );
  } catch (manualError) {
    console.warn(
      `⚠️ No fue posible calcular manual base de cuentas padre: ${manualError.message}`
    );
  }

  for (const cambio of presupuesto) {
    const cuenta = (cambio.cuenta || "").toString().trim();
    const valores = cambio.valores || {};

    if (!cuenta) {
      console.warn(`⚠️ Cambio sin número de cuenta, ignorando`);
      contadorErrores++;
      continue;
    }

    const columnasVariables = [];
    const valoresVariables = [];

    // SOLO procesar cambios numéricos (meses), ignorar campos de texto
    Object.entries(valores).forEach(([clave, valor]) => {
      // Ignorar cambios de texto (cuenta, descripcion, nombre)
      // Estos ya fueron guardados en layout_cuentas arriba
      if (clave === 'cuenta' || clave === 'descripcion' || clave === 'nombre') {
        return;
      }
      
      const columna = MESES_COLUMNAS[clave];
      if (!columna) return;
      columnasVariables.push(columna);
      const numero = Number(valor);
      valoresVariables.push(Number.isFinite(numero) ? numero : 0);
    });

    if (!columnasVariables.length) {
      console.warn(`⚠️ Cuenta ${cuenta} sin valores numéricos`);
      contadorErrores++;
      continue;
    }

    const registroEditado = presupuestosEditados.get(cuenta) || {};
    columnasVariables.forEach((columna, index) => {
      registroEditado[columna] = valoresVariables[index];
    });
    presupuestosEditados.set(cuenta, registroEditado);

    const columnas = ["NUM_CTA", "EJERCICIO", ...columnasVariables];
    const parametros = [cuenta, anio, ...valoresVariables];
    const placeholders = columnas.map(() => "?").join(", ");

    // Firebird permite UPSERT con MATCHING; no perdemos registros nuevos.
    const upsertQuery = `
      UPDATE OR INSERT INTO ${tablaPresup} (${columnas.join(", ")})
      VALUES (${placeholders})
      MATCHING (NUM_CTA, EJERCICIO)
    `;

    try {
      await ejecutarConsulta(borrador.empresaId, upsertQuery, parametros);
      contadorExitosas++;
    } catch (error) {
      console.error(
        `❌ Error al guardar cuenta ${cuenta} en ${tablaPresup}:`,
        error.message
      );
      contadorErrores++;
      // No lanzar - continuar con otras cuentas para no perder todo
    }
  }

  console.log(
    `✅ Persistencia completada: ${contadorExitosas} cuentas exitosas, ${contadorErrores} errores`
  );

  // ✅ PASO 3: Actualizar cuentas padre (acumulativas) con la suma de sus cuentas hijas
  try {
    await actualizarCuentasPadre(
      borrador.empresaId,
      anio,
      tablaPresup,
      presupuestosEditados,
      manualBaseMap,
      borrador.id
    );
  } catch (errorPadre) {
    console.error(`❌ Error al actualizar cuentas padre:`, errorPadre);
    // No bloquear - las cuentas de detalle ya se guardaron correctamente
  }
};

/**
 * Actualiza las cuentas padre (TIPO='A') con la suma de sus cuentas hijas (TIPO='D')
 * Para cada cuenta acumulativa, suma los presupuestos de todas sus cuentas de detalle
 */
const calcularManualPadres = async (empresaId, anio, tablaPresup) => {
  const { ejecutarConsulta } = require("./firebirdService");
  const tablaCuentas = `CUENTAS${anio.toString().slice(-2).padStart(2, '0')}`;

  const queryCuentasPadre = `
    SELECT DISTINCT p.NUM_CTA
    FROM ${tablaCuentas} h
    JOIN ${tablaCuentas} p
      ON TRIM(p.NUM_CTA) = TRIM(h.CTA_PAPA)
    WHERE h.STATUS = 'A'
      AND p.STATUS = 'A'
      AND TRIM(h.CTA_PAPA) <> ''
  `;

  const cuentasPadre = await ejecutarConsulta(empresaId, queryCuentasPadre, []);
  if (!cuentasPadre || cuentasPadre.length === 0) {
    return new Map();
  }

  const manualMap = new Map();

  for (const cuentaPadre of cuentasPadre) {
    const numCta = (cuentaPadre.NUM_CTA || '').trim();
    if (!numCta) continue;

    const queryHijas = `
      SELECT 
        h.NUM_CTA,
        p.PRESUP01, p.PRESUP02, p.PRESUP03, p.PRESUP04, p.PRESUP05, p.PRESUP06,
        p.PRESUP07, p.PRESUP08, p.PRESUP09, p.PRESUP10, p.PRESUP11, p.PRESUP12
      FROM ${tablaCuentas} h
      LEFT JOIN ${tablaPresup} p ON p.NUM_CTA = h.NUM_CTA AND p.EJERCICIO = ?
      WHERE h.STATUS = 'A'
        AND TRIM(h.CTA_PAPA) = ?
    `;

    const cuentasHijas = await ejecutarConsulta(empresaId, queryHijas, [anio, numCta]);
    const sumasMensuales = {
      PRESUP01: 0, PRESUP02: 0, PRESUP03: 0, PRESUP04: 0,
      PRESUP05: 0, PRESUP06: 0, PRESUP07: 0, PRESUP08: 0,
      PRESUP09: 0, PRESUP10: 0, PRESUP11: 0, PRESUP12: 0
    };

    (cuentasHijas || []).forEach((hija) => {
      for (let mes = 1; mes <= 12; mes++) {
        const col = `PRESUP${mes.toString().padStart(2, '0')}`;
        const valor = Number(hija[col]) || 0;
        sumasMensuales[col] += valor;
      }
    });

    const queryPadrePresup = `
      SELECT 
        PRESUP01, PRESUP02, PRESUP03, PRESUP04, PRESUP05, PRESUP06,
        PRESUP07, PRESUP08, PRESUP09, PRESUP10, PRESUP11, PRESUP12
      FROM ${tablaPresup}
      WHERE NUM_CTA = ? AND EJERCICIO = ?
    `;
    const padrePresupRows = await ejecutarConsulta(empresaId, queryPadrePresup, [numCta, anio]);
    const padrePresup = padrePresupRows && padrePresupRows[0] ? padrePresupRows[0] : null;

    const manualCalculado = {};
    Object.keys(sumasMensuales).forEach((col) => {
      if (!padrePresup) {
        manualCalculado[col] = 0;
        return;
      }
      const actual = Number(padrePresup[col]) || 0;
      manualCalculado[col] = actual - sumasMensuales[col];
    });

    manualMap.set(numCta, manualCalculado);
  }

  return manualMap;
};

const actualizarCuentasPadre = async (
  empresaId,
  anio,
  tablaPresup,
  presupuestosEditados = new Map(),
  manualBaseMap = null,
  borradorId = null,
  preservarManual = true
) => {
  const { ejecutarConsulta } = require("./firebirdService");
  console.log(`\n📊 ============================================`);
  console.log(`📊 Actualizando cuentas padre en ${tablaPresup}...`);
  console.log(`📊 Empresa: ${empresaId}, Año: ${anio}`);
  console.log(`📊 ============================================\n`);
  
  const tablaCuentas = `CUENTAS${anio.toString().slice(-2).padStart(2, '0')}`;
  
  // Obtener todas las cuentas acumulativas (TIPO='A')
  const queryCuentasPadre = `
    SELECT DISTINCT p.NUM_CTA, p.CTA_PAPA, p.NIVEL, p.NOMBRE, p.TIPO
    FROM ${tablaCuentas} h
    JOIN ${tablaCuentas} p
      ON TRIM(p.NUM_CTA) = TRIM(h.CTA_PAPA)
    WHERE h.STATUS = 'A'
      AND p.STATUS = 'A'
      AND TRIM(h.CTA_PAPA) <> ''
    ORDER BY p.NIVEL DESC, p.NUM_CTA
  `;
  
  console.log(`🔍 Buscando cuentas TIPO='A' en ${tablaCuentas}...`);
  const cuentasPadre = await ejecutarConsulta(empresaId, queryCuentasPadre, []);
  
  if (!cuentasPadre || cuentasPadre.length === 0) {
    console.log(`⚠️ No se encontraron cuentas padre (TIPO='A') en ${tablaCuentas}`);
    console.log(`⚠️ Verificar que existan cuentas con TIPO='A' y STATUS='A'`);
    finalizarProgresoRecontabilizacion(borradorId, "sin-datos");
    return;
  }
  
  console.log(`✅ Se encontraron ${cuentasPadre.length} cuentas padre (TIPO='A')`);
  console.log(`📋 Procesando de nivel más profundo a más superficial...\n`);
  
  let contadorActualizadas = 0;
  let contadorSinHijas = 0;
  let contadorSinValores = 0;
  let contadorProcesadas = 0;
  actualizarProgresoRecontabilizacion(borradorId, {
    estado: "recontabilizando",
    total: cuentasPadre.length,
    actual: 0,
  });
  
  // Procesar de nivel más profundo a más superficial para calcular correctamente la jerarquía
  for (const cuentaPadre of cuentasPadre) {
    const numCta = cuentaPadre.NUM_CTA.trim();
    const nivel = cuentaPadre.NIVEL;
    const nombre = (cuentaPadre.NOMBRE || '').trim();
    
    console.log(`\n  🔹 Procesando cuenta padre: ${numCta}`);
    console.log(`     Nombre: ${nombre}`);
    console.log(`     Nivel: ${nivel}`);
    
    // Obtener todas las cuentas hijas directas (donde CTA_PAPA = numCta)
    const queryHijas = `
      SELECT 
        h.NUM_CTA,
        h.NOMBRE,
        h.TIPO,
        h.NIVEL,
        h.CTA_PAPA,
        p.PRESUP01, p.PRESUP02, p.PRESUP03, p.PRESUP04, p.PRESUP05, p.PRESUP06,
        p.PRESUP07, p.PRESUP08, p.PRESUP09, p.PRESUP10, p.PRESUP11, p.PRESUP12
      FROM ${tablaCuentas} h
      LEFT JOIN ${tablaPresup} p ON p.NUM_CTA = h.NUM_CTA AND p.EJERCICIO = ?
      WHERE h.STATUS = 'A' 
        AND TRIM(h.CTA_PAPA) = ?
    `;
    
    const cuentasHijas = await ejecutarConsulta(empresaId, queryHijas, [anio, numCta]);
    
    console.log(`     → Cuentas hijas encontradas: ${cuentasHijas ? cuentasHijas.length : 0}`);
    
    console.log(`     → Cuentas hijas encontradas: ${cuentasHijas ? cuentasHijas.length : 0}`);
    
    if (!cuentasHijas || cuentasHijas.length === 0) {
      console.log(`     ⚠️ Esta cuenta padre no tiene hijas (o CTA_PAPA no coincide)`);
      contadorSinHijas++;
      contadorProcesadas++;
      actualizarProgresoRecontabilizacion(borradorId, {
        actual: contadorProcesadas,
      });
      continue;
    }
    
    // Mostrar las hijas encontradas
    cuentasHijas.forEach(hija => {
      const hijaNombre = (hija.NOMBRE || '').trim().substring(0, 40);
      console.log(`        • ${hija.NUM_CTA} - ${hijaNombre} (Nivel ${hija.NIVEL}, TIPO=${hija.TIPO})`);
    });
    
    // Calcular suma de presupuestos por mes (hijas)
    const sumasMensuales = {
      PRESUP01: 0, PRESUP02: 0, PRESUP03: 0, PRESUP04: 0, 
      PRESUP05: 0, PRESUP06: 0, PRESUP07: 0, PRESUP08: 0,
      PRESUP09: 0, PRESUP10: 0, PRESUP11: 0, PRESUP12: 0
    };
    
    cuentasHijas.forEach(hija => {
      for (let mes = 1; mes <= 12; mes++) {
        const col = `PRESUP${mes.toString().padStart(2, '0')}`;
        const valor = Number(hija[col]) || 0;
        sumasMensuales[col] += valor;
      }
    });

    const manualEditado = presupuestosEditados instanceof Map
      ? presupuestosEditados.get(numCta)
      : (presupuestosEditados || {})[numCta];

    const manualPrecalculado = manualBaseMap instanceof Map
      ? manualBaseMap.get(numCta)
      : manualBaseMap
      ? manualBaseMap[numCta]
      : null;

    let manualCalculado = manualPrecalculado;
    const crearManualCero = () => {
      const manual = {};
      Object.keys(sumasMensuales).forEach((col) => {
        manual[col] = 0;
      });
      return manual;
    };

    if (!manualCalculado) {
      if (!preservarManual) {
        manualCalculado = crearManualCero();
      } else {
        // Obtener presupuesto actual del padre para conservar la parte manual
        const queryPadrePresup = `
          SELECT 
            PRESUP01, PRESUP02, PRESUP03, PRESUP04, PRESUP05, PRESUP06,
            PRESUP07, PRESUP08, PRESUP09, PRESUP10, PRESUP11, PRESUP12
          FROM ${tablaPresup}
          WHERE NUM_CTA = ? AND EJERCICIO = ?
        `;
        const padrePresupRows = await ejecutarConsulta(empresaId, queryPadrePresup, [numCta, anio]);
        const padrePresup = padrePresupRows && padrePresupRows[0] ? padrePresupRows[0] : null;

        manualCalculado = {};
        Object.keys(sumasMensuales).forEach((col) => {
          if (!padrePresup) {
            manualCalculado[col] = 0;
            return;
          }
          const actual = Number(padrePresup[col]) || 0;
          manualCalculado[col] = actual - sumasMensuales[col];
        });
      }
    }

    Object.keys(sumasMensuales).forEach((col) => {
      const valorManual = manualEditado && Object.prototype.hasOwnProperty.call(manualEditado, col)
        ? Number(manualEditado[col]) || 0
        : Number(manualCalculado[col]) || 0;
      sumasMensuales[col] += valorManual;
    });
    console.log(`     ➕ Presupuesto manual agregado a ${numCta}`);
    
    // Verificar si hay valores para actualizar
    const tieneValores = Object.values(sumasMensuales).some((val) => val !== 0);
    
    if (!tieneValores) {
      console.log(`     ⚠️ Las cuentas hijas no tienen presupuestos (todos en cero)`);
      contadorSinValores++;
    }
    
    // Mostrar totales calculados
    const totalAnual = Object.values(sumasMensuales).reduce((sum, val) => sum + val, 0);
    console.log(`     💰 Total anual calculado: ${totalAnual.toFixed(2)}`);
    console.log(`     💰 Enero (PRESUP01): ${sumasMensuales.PRESUP01.toFixed(2)}`);
    
    // Actualizar o insertar la cuenta padre con las sumas
    const columnas = ["NUM_CTA", "EJERCICIO", 
      "PRESUP01", "PRESUP02", "PRESUP03", "PRESUP04", "PRESUP05", "PRESUP06",
      "PRESUP07", "PRESUP08", "PRESUP09", "PRESUP10", "PRESUP11", "PRESUP12"
    ];
    
    const valores = [
      numCta, anio,
      sumasMensuales.PRESUP01, sumasMensuales.PRESUP02, sumasMensuales.PRESUP03,
      sumasMensuales.PRESUP04, sumasMensuales.PRESUP05, sumasMensuales.PRESUP06,
      sumasMensuales.PRESUP07, sumasMensuales.PRESUP08, sumasMensuales.PRESUP09,
      sumasMensuales.PRESUP10, sumasMensuales.PRESUP11, sumasMensuales.PRESUP12
    ];
    
    const placeholders = columnas.map(() => "?").join(", ");
    
    const updateQuery = `
      UPDATE OR INSERT INTO ${tablaPresup} (${columnas.join(", ")})
      VALUES (${placeholders})
      MATCHING (NUM_CTA, EJERCICIO)
    `;
    
    try {
      await ejecutarConsulta(empresaId, updateQuery, valores);
      contadorActualizadas++;
      console.log(`     ✅ Cuenta padre actualizada exitosamente`);
    } catch (error) {
      console.error(`     ❌ Error actualizando cuenta padre ${numCta}:`, error.message);
    }
    contadorProcesadas++;
    actualizarProgresoRecontabilizacion(borradorId, {
      actual: contadorProcesadas,
    });
  }
  
  console.log(`\n📊 ============================================`);
  console.log(`📊 RESUMEN DE ACTUALIZACIÓN:`);
  console.log(`   ✅ Actualizadas: ${contadorActualizadas}`);
  console.log(`   ⚠️ Sin hijas: ${contadorSinHijas}`);
  console.log(`   ⚠️ Sin valores: ${contadorSinValores}`);
  console.log(`   📊 Total procesadas: ${cuentasPadre.length}`);
  console.log(`📊 ============================================\n`);
  finalizarProgresoRecontabilizacion(borradorId, "completado");
};

const FINALIZADORES = {
  PRESUPUESTOS: persistirEnFirebird,
};

const obtenerFinalizador = (modulo) => {
  const clave = (modulo || "").toString().trim().toUpperCase();
  return FINALIZADORES[clave] || persistirEnFirebird;
};

const eliminarBorrador = (empresaId, modulo, anio, capitulo, usuarioId) => {
  if (!empresaId || !modulo || !Number.isInteger(Number(anio))) {
    throw new Error("Contexto incompleto para descartar.");
  }
  const existente = obtenerBorrador({ empresaId, modulo, anio, capitulo: capitulo || 'DEFAULT' });
  if (!existente) {
    return null;
  }
  db.prepare(
    "DELETE FROM PLAN_BORRADORES WHERE empresaId = ? AND modulo = ? AND anio = ? AND capitulo = ?"
  ).run(empresaId, modulo, anio, capitulo || 'DEFAULT');
  registrarEventoHistorial({
    borradorId: existente.id,
    empresaId,
    modulo,
    anio,
    capitulo: capitulo || 'DEFAULT',
    estado: existente.estado,
    accion: HISTORIAL_ACCIONES.DESCARTAR.clave,
    descripcion: "Descartó el borrador en edición",
    usuarioId,
  });
  return existente;
};

const obtenerBorrador = ({ empresaId, modulo, anio, capitulo = 'DEFAULT' }) => {
  try {
    console.log("[obtenerBorrador] called with:", { empresaId, modulo, anio, capitulo });
    const estadosValidos = [
      ESTADOS.EDITANDO,
      ESTADOS.PENDIENTE,
      ESTADOS.RECHAZADO,
      ESTADOS.REVISADO,
      ESTADOS.APROBADO,
    ];
    const placeholders = estadosValidos.map(() => "?").join(",");
    const query = `
      SELECT *
      FROM PLAN_BORRADORES
      WHERE empresaId = ? AND modulo = ? AND anio = ? AND capitulo = ?
        AND estado IN (${placeholders})
      ORDER BY fechaEnvio DESC NULLS LAST, id DESC
      LIMIT 1
    `;
    const fila = db
      .prepare(query)
      .get(empresaId, modulo, anio, capitulo || 'DEFAULT', ...estadosValidos);
    console.log(
      "[obtenerBorrador] result:",
      fila ? `found id=${fila.id}, estado=${fila.estado}, capitulo=${fila.capitulo}` : "null"
    );
    return mapearFila(fila);
  } catch (err) {
    console.error("[obtenerBorrador] error:", err.message, err.stack);
    throw err;
  }
};

const guardarBorrador = (contexto, datos) => {
  const cfg = normalizarContexto(contexto);
  const contenido =
    typeof datos === "string" ? datos : JSON.stringify(datos || {});
  const existente = db
    .prepare(
      `
    SELECT id
    FROM PLAN_BORRADORES
    WHERE empresaId = ? AND modulo = ? AND anio = ? AND capitulo = ?
  `
    )
    .get(cfg.empresaId, cfg.modulo, cfg.anio, cfg.capitulo);

  if (existente) {
    db.prepare(
      `
      UPDATE PLAN_BORRADORES
      SET data = ?, estado = ?, fechaEnvio = NULL, comentarios = NULL, usuarioId = ?
      WHERE id = ?
    `
    ).run(contenido, ESTADOS.EDITANDO, cfg.usuarioId, existente.id);
    const actualizado = obtenerBorradorPorId(existente.id);
    registrarEventoHistorial({
      borradorId: actualizado.id,
      empresaId: actualizado.empresaId,
      modulo: actualizado.modulo,
      anio: actualizado.anio,
      capitulo: actualizado.capitulo,
      estado: actualizado.estado,
      accion: HISTORIAL_ACCIONES.GUARDAR_BORRADOR.clave,
      descripcion: "Guardó cambios para continuar editando",
      usuarioId: cfg.usuarioId,
    });
    return actualizado;
  }

  const resultado = db
    .prepare(
      `
    INSERT INTO PLAN_BORRADORES (empresaId, anio, modulo, capitulo, usuarioId, data, estado, comentarios)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `
    )
    .run(
      cfg.empresaId,
      cfg.anio,
      cfg.modulo,
      cfg.capitulo,
      cfg.usuarioId,
      contenido,
      ESTADOS.EDITANDO,
      cfg.comentarios
    );

  const nuevo = obtenerBorradorPorId(resultado.lastInsertRowid);
  registrarEventoHistorial({
    borradorId: nuevo.id,
    empresaId: nuevo.empresaId,
    modulo: nuevo.modulo,
    anio: nuevo.anio,
    capitulo: nuevo.capitulo,
    estado: nuevo.estado,
    accion: HISTORIAL_ACCIONES.GUARDAR_BORRADOR.clave,
    descripcion: "Creó un nuevo borrador",
    usuarioId: cfg.usuarioId,
  });
  return nuevo;
};

const enviarRevision = async (borradorId, usuarioRol, usuarioId) => {
  const borrador = obtenerBorradorPorId(borradorId);
  if (!borrador) {
    throw new Error("Borrador no encontrado.");
  }

  if (usuarioRol === "ADMIN_GLOBAL") {
    db.prepare(
      `
      UPDATE PLAN_BORRADORES
      SET estado = ?, fechaEnvio = CURRENT_TIMESTAMP
      WHERE id = ?
    `
    ).run(ESTADOS.APROBADO, borradorId);
    const actualizado = obtenerBorradorPorId(borradorId);
    registrarEventoHistorial({
      borradorId,
      empresaId: actualizado.empresaId,
      modulo: actualizado.modulo,
      anio: actualizado.anio,
      capitulo: actualizado.capitulo,
      estado: actualizado.estado,
      accion: HISTORIAL_ACCIONES.AUTO_AUTORIZAR.clave,
      descripcion: "Autorización automática por administrador global",
      usuarioId,
    });
    return { autoAutorizado: true, borrador: actualizado };
  }

  db.prepare(
    `
    UPDATE PLAN_BORRADORES
    SET estado = ?, fechaEnvio = CURRENT_TIMESTAMP
    WHERE id = ?
  `
  ).run(ESTADOS.PENDIENTE, borradorId);

  const actualizado = obtenerBorradorPorId(borradorId);
  registrarEventoHistorial({
    borradorId,
    empresaId: actualizado.empresaId,
    modulo: actualizado.modulo,
    anio: actualizado.anio,
    capitulo: actualizado.capitulo,
    estado: actualizado.estado,
    accion: HISTORIAL_ACCIONES.ENVIAR_REVISION.clave,
    descripcion: "Envió el borrador a revisión",
    usuarioId,
  });
  return { autoAutorizado: false, borrador: actualizado };
};

const marcarRevisado = (borradorId, cancelar = false, usuarioId) => {
  const borrador = obtenerBorradorPorId(borradorId);
  if (!borrador) {
    throw new Error("Borrador no encontrado.");
  }
  const destino = cancelar ? ESTADOS.EDITANDO : ESTADOS.REVISADO;
  db.prepare(
    `
    UPDATE PLAN_BORRADORES
    SET estado = ?, comentarios = NULL
    WHERE id = ?
  `
  ).run(destino, borradorId);
  const actualizado = obtenerBorradorPorId(borradorId);
  registrarEventoHistorial({
    borradorId,
    empresaId: actualizado.empresaId,
    modulo: actualizado.modulo,
    anio: actualizado.anio,
    capitulo: actualizado.capitulo,
    estado: actualizado.estado,
    accion: cancelar
      ? HISTORIAL_ACCIONES.CANCELAR_REVISION.clave
      : HISTORIAL_ACCIONES.MARCAR_REVISADO.clave,
    descripcion: cancelar
      ? "Canceló la revisión y devolvió a edición"
      : "Marcó el borrador como revisado",
    usuarioId,
  });
  return actualizado;
};

const autorizarBorrador = async (borradorId, usuarioId) => {
  const borrador = obtenerBorradorPorId(borradorId);
  if (!borrador) {
    throw new Error("Borrador no encontrado.");
  }

  if (![ESTADOS.REVISADO, ESTADOS.APROBADO].includes(borrador.estado)) {
    throw new Error("El borrador debe estar revisado antes de autorizar.");
  }

  db.prepare(
    `
    UPDATE PLAN_BORRADORES
    SET estado = ?, fechaEnvio = CURRENT_TIMESTAMP
    WHERE id = ?
  `
  ).run(ESTADOS.APROBADO, borradorId);

  const actualizado = obtenerBorradorPorId(borradorId);
  registrarEventoHistorial({
    borradorId,
    empresaId: actualizado.empresaId,
    modulo: actualizado.modulo,
    anio: actualizado.anio,
    capitulo: actualizado.capitulo,
    estado: actualizado.estado,
    accion: HISTORIAL_ACCIONES.AUTORIZAR.clave,
    descripcion: "Autorizó el borrador",
    usuarioId,
  });
  return actualizado;
};

const rechazarBorrador = (borradorId, motivo, usuarioId) => {
  const borrador = obtenerBorradorPorId(borradorId);
  if (!borrador) {
    throw new Error("Borrador no encontrado.");
  }

  db.prepare(
    `
    UPDATE PLAN_BORRADORES
    SET estado = ?, comentarios = ?, fechaEnvio = CURRENT_TIMESTAMP
    WHERE id = ?
  `
  ).run(ESTADOS.RECHAZADO, motivo || null, borradorId);

  const actualizado = obtenerBorradorPorId(borradorId);
  registrarEventoHistorial({
    borradorId,
    empresaId: actualizado.empresaId,
    modulo: actualizado.modulo,
    anio: actualizado.anio,
    capitulo: actualizado.capitulo,
    estado: actualizado.estado,
    accion: HISTORIAL_ACCIONES.RECHAZAR.clave,
    descripcion: "Rechazó el borrador",
    comentarios: motivo || "",
    usuarioId,
  });
  return actualizado;
};

const guardarAutorizado = async (borradorId, usuarioId) => {
  const borrador = obtenerBorradorPorId(borradorId);
  if (!borrador) {
    throw new Error("Borrador no encontrado.");
  }
  if (borrador.estado !== ESTADOS.APROBADO) {
    throw new Error("El borrador debe estar autorizado antes de guardar.");
  }
  iniciarProgresoRecontabilizacion(borradorId);
  const finalizador = obtenerFinalizador(borrador.modulo);
  const tarea = async () => {
    actualizarProgresoRecontabilizacion(borradorId, { estado: "recontabilizando" });
    try {
      if (finalizador) {
        await finalizador(borrador);
      }
      finalizarProgresoRecontabilizacion(borradorId, "completado");
    } catch (error) {
      finalizarProgresoRecontabilizacion(borradorId, "error");
      throw error;
    }
  };
  const { ejecucion } = encolarRecontabilizacion(
    { empresaId: borrador.empresaId, anio: borrador.anio, borradorId },
    tarea
  );
  await ejecucion;
  db.prepare(
    `
    UPDATE PLAN_BORRADORES
    SET estado = ?, fechaEnvio = CURRENT_TIMESTAMP
    WHERE id = ?
  `
  ).run(ESTADOS.GUARDADO, borradorId);
  const actualizado = obtenerBorradorPorId(borradorId);
  registrarEventoHistorial({
    borradorId,
    empresaId: actualizado.empresaId,
    modulo: actualizado.modulo,
    anio: actualizado.anio,
    capitulo: actualizado.capitulo,
    estado: actualizado.estado,
    accion: HISTORIAL_ACCIONES.GUARDAR_COI.clave,
    descripcion: "Guardó la versión autorizada en COI",
    usuarioId,
  });
  // Remove the draft from the table as it was persisted in COI
  try {
    db.prepare(`DELETE FROM PLAN_BORRADORES WHERE id = ?`).run(borradorId);
  } catch (err) {
    console.warn('No fue posible eliminar borrador tras guardado en COI:', err);
  }
  // Return a snapshot-like response to the client (the object with estado = GUARDADO)
  const snapshot = { ...actualizado, eliminado: true };
  return snapshot;
};

module.exports = {
  guardarBorrador,
  obtenerBorrador,
  enviarRevision,
  autorizarBorrador,
  rechazarBorrador,
  obtenerBorradorPorId,
  marcarRevisado,
  guardarAutorizado,
  eliminarBorrador,
  listarBorradores,
  listarHistorialBorradores,
  obtenerFiltrosHistorial,
  obtenerProgresoRecontabilizacion,
  actualizarCuentasPadre,
  ESTADOS,
  HISTORIAL_ACCIONES,
};
