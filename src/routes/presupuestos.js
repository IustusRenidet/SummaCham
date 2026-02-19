const express = require('express');
const Joi = require('joi');
const { db, registrarPresupuestoGuardado } = require('../db/sqlite');
const { obtenerEmpresaPorId } = require('../config/empresas');
const { MODULOS } = require('../services/permisosService');
const { obtenerPresupuestosMayor, obtenerTotalesPresupuestoCapitulo, PERIODOS, listarAniosPresupuestos } = require('../services/presupuestosService');
const { notificarWorkflowPresupuesto } = require('../services/notificacionesService');
const { requireAuth, tienePermisoEmpresa, tienePermisoModulo } = require('../middleware/auth');

const router = express.Router();

const MAPA_ESTADO_CANONICO = {
  'sin-cargar': 'SIN_CARGAR',
  'SIN-CARGAR': 'SIN_CARGAR',
  'SIN_CARGAR': 'SIN_CARGAR',
  borrador: 'EDITANDO',
  BORRADOR: 'EDITANDO',
  revisado: 'REVISADO',
  REVISADO: 'REVISADO',
  autorizado: 'APROBADO',
  AUTORIZADO: 'APROBADO',
  guardado: 'GUARDADO',
  GUARDADO: 'GUARDADO',
  editando: 'EDITANDO',
  EDITANDO: 'EDITANDO',
  pendiente: 'PENDIENTE',
  PENDIENTE: 'PENDIENTE',
  rechazado: 'RECHAZADO',
  RECHAZADO: 'RECHAZADO',
  aprobado: 'APROBADO',
  APROBADO: 'APROBADO'
};

const normalizarEstadoCanonico = (estado) => {
  if (!estado) return 'SIN_CARGAR';
  const clave = estado.toString();
  return MAPA_ESTADO_CANONICO[clave] || MAPA_ESTADO_CANONICO[clave.toUpperCase()] || 'SIN_CARGAR';
};

const normalizarCuenta21 = (valor = '') => {
  const limpio = valor.toString().replace(/[^0-9]/g, '');
  if (!limpio) return '';
  if (limpio.length >= 21) return limpio.slice(0, 21);

  const visible = limpio.slice(0, 11).padEnd(11, '0');
  const b = visible.slice(3, 6);
  const c = visible.slice(6, 9);
  const d = visible.slice(9, 11);
  let nivel = '4';
  if (b === '000' && c === '000' && d === '00') nivel = '1';
  else if (c === '000' && d === '00') nivel = '2';
  else if (d === '00') nivel = '3';
  return visible.padEnd(20, '0') + nivel;
};

const esquemaConsulta = Joi.object({
  anio: Joi.number().integer().min(2000).max(2100).optional(),
  empresaId: Joi.string().trim().optional()
});

const esquemaEstado = Joi.object({
  modulo: Joi.string().trim().required(),
  anio: Joi.number().integer().min(2000).max(2100).required()
});

const esquemaTransicion = Joi.object({
  modulo: Joi.string().trim().required(),
  anio: Joi.number().integer().min(2000).max(2100).required(),
  accion: Joi.string().valid('cargar', 'revisar', 'autorizar', 'guardar').required()
});

const serializarEmpresa = (empresa) => {
  if (!empresa) {
    return null;
  }
  return {
    id: empresa.id,
    nombre: empresa.nombre,
    etiqueta: empresa.etiqueta
  };
};

const ESTADOS_VALIDOS = ['SIN_CARGAR', 'EDITANDO', 'REVISADO', 'APROBADO', 'GUARDADO', 'PENDIENTE', 'RECHAZADO'];

const TRANSICIONES = {
  cargar: {
    destino: 'EDITANDO',
    requiere: 'Cargar y guardar',
    habilita: (estado) => ['SIN_CARGAR', 'GUARDADO'].includes(normalizarEstadoCanonico(estado))
  },
  revisar: { destino: 'REVISADO', requiere: 'Revisar', habilita: (estado) => normalizarEstadoCanonico(estado) === 'EDITANDO' },
  autorizar: { destino: 'APROBADO', requiere: 'Aprobar', habilita: (estado) => normalizarEstadoCanonico(estado) === 'REVISADO' },
  guardar: { destino: 'GUARDADO', requiere: 'Aprobar', habilita: (estado) => normalizarEstadoCanonico(estado) === 'APROBADO' }
};

const construirNombreUsuario = (registro) => {
  const partes = [registro?.nombres, registro?.apellido_primero, registro?.apellido_segundo].filter(Boolean);
  const nombre = partes.join(' ').trim();
  return nombre || registro?.usuario || 'Usuario';
};

const esTablaPresupuestoInexistente = (error) => {
  const codigoSql = Number(error?.sqlcode || error?.SQLCODE);
  if (codigoSql === -204) {
    return true;
  }
  const mensaje = (error?.message || '').toString().toUpperCase();
  return (
    mensaje.includes('TABLE') &&
    mensaje.includes('UNKNOWN') &&
    (mensaje.includes('PRESUP') || mensaje.includes('CUENTAS') || mensaje.includes('SALDOS'))
  );
};

const esErrorConexionFirebird = (error) => {
  const codigo = (error?.code || '').toString().toUpperCase();
  if (['ECONNREFUSED', 'EHOSTUNREACH', 'ENETUNREACH', 'ETIMEDOUT'].includes(codigo)) {
    return true;
  }
  const mensaje = (error?.message || '').toString().toUpperCase();
  return (
    mensaje.includes('UNABLE TO COMPLETE NETWORK REQUEST') ||
    mensaje.includes('FAILED TO ESTABLISH A CONNECTION') ||
    mensaje.includes('NETWORK REQUEST') ||
    mensaje.includes('CONNECTION REJECTED')
  );
};

router.use(requireAuth);

const tienePermisoEnEmpresa = (mapaPermisos, empresaId) => {
  const permisos = mapaPermisos?.[empresaId];
  if (!permisos) {
    return false;
  }
  return Object.values(permisos).some(
    (acciones) => acciones.Ver || acciones.Lectura || acciones['Cargar y guardar'] || acciones.Revisar || acciones.Aprobar
  );
};

const tienePermisoEnModulo = (mapaPermisos, empresaId, modulo, accion) => {
  const permisos = mapaPermisos?.[empresaId]?.[modulo];
  if (!permisos) {
    return false;
  }
  if (!accion) {
    return Boolean(permisos.Ver || permisos.Lectura || permisos['Cargar y guardar'] || permisos.Revisar || permisos.Aprobar);
  }
  return Boolean(permisos[accion]);
};

const validarModulo = (modulo) => MODULOS.includes(modulo);

const obtenerEstadoPresupuesto = (empresaId, modulo, anio) => {
  const estadoActual = db.prepare(`
    SELECT e.estado,
           e.actualizado_en AS actualizadoEn,
           TRIM(COALESCE(u.nombres, '') || ' ' || COALESCE(u.apellidos, '')) AS actualizadoPor
    FROM presupuestos_estado e
    LEFT JOIN usuarios u ON u.id = e.actualizado_por
    WHERE e.empresa_id = ? AND e.modulo = ? AND e.anio = ?
  `).get(empresaId, modulo, anio);
  const historial = db.prepare(`
    SELECT h.estado, h.registrado_en AS fecha,
           TRIM(COALESCE(u.nombres, '') || ' ' || COALESCE(u.apellidos, '')) AS usuario
    FROM presupuestos_estado_historial h
    LEFT JOIN usuarios u ON u.id = h.usuario_id
    WHERE h.empresa_id = ? AND h.modulo = ? AND h.anio = ?
    ORDER BY h.registrado_en DESC
    LIMIT 10
  `).all(empresaId, modulo, anio);
  const estadoCanonico = normalizarEstadoCanonico(estadoActual?.estado);
  return {
    estado: estadoCanonico,
    estadoRaw: estadoActual?.estado || 'sin-cargar',
    actualizadoEn: estadoActual?.actualizadoEn || null,
    actualizadoPor: estadoActual?.actualizadoPor || '',
    historial: historial.map((registro) => ({
      estado: normalizarEstadoCanonico(registro.estado),
      estadoRaw: registro.estado,
      fecha: registro.fecha,
      usuario: registro.usuario
    }))
  };
};

const guardarEstadoPresupuesto = (empresaId, modulo, anio, estado, usuarioId) => {
  db.prepare(`
    INSERT INTO presupuestos_estado (
      empresa_id, modulo, anio, estado, actualizado_por, actualizado_en
    ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(empresa_id, modulo, anio) DO UPDATE SET
      estado = excluded.estado,
      actualizado_por = excluded.actualizado_por,
      actualizado_en = CURRENT_TIMESTAMP
  `).run(empresaId, modulo, anio, estado, usuarioId);
  db.prepare(`
    INSERT INTO presupuestos_estado_historial (
      empresa_id, modulo, anio, estado, usuario_id, registrado_en
    ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(empresaId, modulo, anio, estado, usuarioId);
  return obtenerEstadoPresupuesto(empresaId, modulo, anio);
};

router.get('/anios', async (req, res) => {
  const empresaId = req.query.empresaId || req.headers['x-empresa-activa'];
  if (!empresaId) {
    return res.status(400).json({ mensaje: 'Debes indicar una empresa.' });
  }
  const empresa = obtenerEmpresaPorId(empresaId);
  if (!empresa) {
    return res.status(404).json({ mensaje: 'La empresa indicada no existe.' });
  }
  if (!req.esAdmin && !tienePermisoEnEmpresa(req.mapaPermisos, empresa.id)) {
    return res.status(403).json({ mensaje: 'No cuentas con permisos para consultar esta empresa.' });
  }

  try {
    const anios = await listarAniosPresupuestos(empresa.id);
    res.json({ anios });
  } catch (error) {
    if (esErrorConexionFirebird(error)) {
      return res.status(503).json({
        mensaje: 'No fue posible conectar con la base de datos de Firebird para esta empresa.'
      });
    }
    console.error('Error al consultar anos de presupuestos:', error);
    res.status(500).json({ mensaje: 'No fue posible obtener los ejercicios disponibles.' });
  }
});

router.get('/', async (req, res) => {
  const { value, error } = esquemaConsulta.validate(req.query, { abortEarly: false });
  if (error) {
    return res.status(400).json({ mensaje: 'Los parámetros proporcionados no son válidos.', detalles: error.details.map((detalle) => detalle.message) });
  }
  const empresaId = value.empresaId || req.headers['x-empresa-activa'];
  if (!empresaId) {
    return res.status(400).json({ mensaje: 'Debes indicar una empresa.' });
  }
  const empresa = obtenerEmpresaPorId(empresaId);
  if (!empresa) {
    return res.status(404).json({ mensaje: 'La empresa indicada no existe.' });
  }
  if (!req.esAdmin && !tienePermisoEnEmpresa(req.mapaPermisos, empresa.id)) {
    return res.status(403).json({ mensaje: 'No cuentas con permisos para consultar esta empresa.' });
  }
  const anioActual = new Date().getFullYear();
  const ejercicio = value.anio || anioActual;
  let aniosDisponibles;
  try {
    try {
      aniosDisponibles = await listarAniosPresupuestos(empresa.id);
      if (
        Array.isArray(aniosDisponibles) &&
        aniosDisponibles.length > 0 &&
        !aniosDisponibles.includes(ejercicio)
      ) {
        return res.status(404).json({
          mensaje: 'El ejercicio solicitado no está disponible en la base de datos.',
          disponibles: aniosDisponibles
        });
      }
    } catch (errorListado) {
      if (esErrorConexionFirebird(errorListado)) {
        return res.status(503).json({
          mensaje: 'No fue posible conectar con la base de datos de Firebird para esta empresa.'
        });
      }
      console.warn('No fue posible listar ejercicios antes de consultar presupuestos.', errorListado);
    }
    const cuentas = await obtenerPresupuestosMayor(empresa.id, ejercicio);
    res.json({
      empresa: serializarEmpresa(empresa),
      anio: ejercicio,
      periodos: PERIODOS,
      cuentas
    });
  } catch (err) {
    if (esErrorConexionFirebird(err)) {
      return res.status(503).json({
        mensaje: 'No fue posible conectar con la base de datos de Firebird para esta empresa.'
      });
    }
    if (esTablaPresupuestoInexistente(err)) {
      let disponibles = Array.isArray(aniosDisponibles) ? aniosDisponibles : [];
      if (!Array.isArray(aniosDisponibles) || aniosDisponibles.length === 0) {
        try {
          disponibles = await listarAniosPresupuestos(empresa.id);
        } catch (listarError) {
          console.warn('No fue posible obtener los ejercicios disponibles para respuesta 404.', listarError);
        }
      }
      return res.status(404).json({
        mensaje: 'No existe información de presupuestos para el ejercicio indicado.',
        disponibles
      });
    }
    console.error('Error al consultar presupuestos:', {
      mensaje: err?.message,
      stack: err?.stack,
      code: err?.code,
      sqlcode: err?.sqlcode || err?.SQLCODE,
      error: err
    });
    res.status(500).json({ 
      mensaje: 'No fue posible obtener la información de presupuestos.',
      detalle: err?.message || 'Error desconocido'
    });
  }
});

router.get('/estado', (req, res) => {
  const { value, error } = esquemaEstado.validate(req.query, { abortEarly: false });
  if (error) {
    return res.status(400).json({ mensaje: 'Los parámetros proporcionados no son válidos.', detalles: error.details.map((detalle) => detalle.message) });
  }
  const empresaId = req.headers['x-empresa-activa'] || req.query.empresaId || req.body.empresaId;
  if (!empresaId) {
    return res.status(400).json({ mensaje: 'Debes indicar una empresa.' });
  }
  const modulo = value.modulo;
  if (!validarModulo(modulo)) {
    return res.status(400).json({ mensaje: 'El módulo indicado no es válido.' });
  }
  const empresa = obtenerEmpresaPorId(empresaId);
  if (!empresa) {
    return res.status(404).json({ mensaje: 'La empresa indicada no existe.' });
  }
  if (!req.esAdmin && !tienePermisoEnModulo(req.mapaPermisos, empresaId, modulo)) {
    return res.status(403).json({ mensaje: 'No cuentas con permisos para este módulo.' });
  }
  const estado = obtenerEstadoPresupuesto(empresaId, modulo, value.anio);
  res.json(estado);
});

router.post('/estado', (req, res) => {
  const { value, error } = esquemaTransicion.validate(req.body || {}, { abortEarly: false });
  if (error) {
    return res.status(400).json({ mensaje: 'Verifica la información proporcionada.', detalles: error.details.map((detalle) => detalle.message) });
  }
  const empresaId = req.headers['x-empresa-activa'];
  if (!empresaId) {
    return res.status(400).json({ mensaje: 'Debes indicar una empresa.' });
  }
  const modulo = value.modulo;
  if (!validarModulo(modulo)) {
    return res.status(400).json({ mensaje: 'El módulo indicado no existe.' });
  }
  const empresa = obtenerEmpresaPorId(empresaId);
  if (!empresa) {
    return res.status(404).json({ mensaje: 'La empresa indicada no existe.' });
  }
  const transicion = TRANSICIONES[value.accion];
  if (!transicion) {
    return res.status(400).json({ mensaje: 'Acción no reconocida.' });
  }
  if (!req.esAdmin && !tienePermisoEnModulo(req.mapaPermisos, empresaId, modulo, transicion.requiere)) {
    return res.status(403).json({ mensaje: 'No cuentas con permisos para realizar esta acción.' });
  }
  const estadoActual = obtenerEstadoPresupuesto(empresaId, modulo, value.anio);
  if (!transicion.habilita(estadoActual.estado)) {
    return res.status(409).json({ mensaje: `El estado actual no permite ejecutar la acción ${value.accion}.` });
  }
  const nuevoEstado = guardarEstadoPresupuesto(empresaId, modulo, value.anio, transicion.destino, req.usuarioActual.id);
  const mensaje = `El presupuesto se actualizó a ${transicion.destino}.`;
  res.json({ mensaje, ...nuevoEstado });
  notificarWorkflowPresupuesto({
    empresaId,
    modulo,
    anio: value.anio,
    accion: value.accion,
    estado: transicion.destino,
    ejecutor: {
      id: req.usuarioActual.id,
      usuario: req.usuarioActual.usuario,
      nombre: construirNombreUsuario(req.usuarioActual)
    }
  }).catch((notifError) => {
    console.warn('No fue posible enviar notificaciones del workflow.', notifError);
  });
});

 router.post('/guardar', (req, res) => {
  const { modulo, anio, empresaId, datos } = req.body || {};
  const ejercicio = Number(anio);
  if (!modulo || !empresaId || !Number.isInteger(ejercicio)) {
    return res.status(400).json({ mensaje: 'Faltan datos obligatorios para guardar.' });
  }
  const empresa = obtenerEmpresaPorId(empresaId);
  if (!empresa) {
    return res.status(404).json({ mensaje: 'La empresa indicada no existe.' });
  }
  if (!req.esAdmin && !tienePermisoEnModulo(req.mapaPermisos, empresaId, modulo, 'Cargar y guardar')) {
    return res.status(403).json({ mensaje: 'No cuentas con permisos para guardar este presupuesto.' });
  }
  try {
    registrarPresupuestoGuardado({
      empresaId,
      modulo,
      anio: ejercicio,
      datos,
      guardadoPor: req.usuarioActual.id
    });
    const estadoActualizado = guardarEstadoPresupuesto(empresaId, modulo, ejercicio, 'GUARDADO', req.usuarioActual.id);
    const ejecutor = {
      id: req.usuarioActual.id,
      usuario: req.usuarioActual.usuario,
      nombre: construirNombreUsuario(req.usuarioActual)
    };
    res.json({
      mensaje: `Presupuesto marcado como guardado por ${ejecutor.nombre} en el flujo de presupuestos (${modulo}).`,
      ejecutor,
      ...estadoActualizado
    });
    notificarWorkflowPresupuesto({
      empresaId,
      modulo,
      anio: ejercicio,
      accion: 'guardar',
      estado: 'guardado',
      ejecutor
    }).catch((notifError) => {
      console.warn('No fue posible enviar notificaciones del workflow.', notifError);
    });
  } catch (error) {
    console.error('Error al guardar presupuesto en la base de datos:', error);
    res.status(500).json({ mensaje: 'No fue posible registrar el guardado.' });
  }
});

// Endpoint para actualizar presupuestos mensuales de cuentas consolidadas
router.post('/actualizar-consolidados', requireAuth, async (req, res) => {
  try {
    const { anio, cuentas, empresaId: empresaIdBody } = req.body || {};
    const empresaId = (empresaIdBody || 'empresa1').toString().trim();
    const empresaIdCanon = empresaId.toLowerCase();
    const empresasPermitidas = new Set(['empresa1', 'empresa9']); // CDMX base / CDMX comparativa

    if (!empresasPermitidas.has(empresaIdCanon)) {
      return res.status(400).json({
        mensaje: 'empresaId inválida para consolidación (solo CDMX).',
      });
    }

    if (!req.esAdmin && !tienePermisoEnEmpresa(req.mapaPermisos, empresaIdCanon)) {
      return res.status(403).json({ mensaje: 'Sin permisos para esta operación.' });
    }

    if (!cuentas || !Array.isArray(cuentas)) {
      return res.status(400).json({ mensaje: 'Datos de cuentas inválidos.' });
    }

    const ejercicio = Number(anio || new Date().getFullYear());
    if (!Number.isInteger(ejercicio) || ejercicio < 2000 || ejercicio > 2100) {
      return res.status(400).json({ mensaje: 'Año inválido.' });
    }

    const { ejecutarConsulta } = require('../services/firebirdService');
    const sufijo = ejercicio.toString().slice(-2).padStart(2, '0');
    const tablaPresup = `PRESUP${sufijo}`;

    let cuentasActualizadas = 0;
    let errores = [];
    let cuentasPadreActualizadas = 0;
    const cuentasProcesadas = [];
    const presupuestosEditados = new Map();
    const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    const acumuladoPadreIngreso = Object.fromEntries(meses.map((m) => [m, 0]));
    const acumuladoPadreGasto = Object.fromEntries(meses.map((m) => [m, 0]));
    const detalleIngresos = new Set([
      normalizarCuenta21('450-001-000-00'),
      normalizarCuenta21('450-002-000-00'),
      normalizarCuenta21('450-003-000-00'),
    ]);
    const detalleGastos = new Set([
      normalizarCuenta21('950-001-000-00'),
      normalizarCuenta21('950-002-000-00'),
      normalizarCuenta21('950-003-000-00'),
    ]);

    for (const cuenta of cuentas) {
      try {
        const { numCta, valores } = cuenta;
        const numCtaNormalizada = normalizarCuenta21(numCta);
        if (!numCtaNormalizada) {
          errores.push({ cuenta: numCta, error: 'Cuenta destino inválida.' });
          continue;
        }
        
        // Actualizar o insertar fila de presupuesto si no existe
        const upsertQuery = `
          UPDATE OR INSERT INTO ${tablaPresup}
            (NUM_CTA, EJERCICIO, PRESUP01, PRESUP02, PRESUP03, PRESUP04,
             PRESUP05, PRESUP06, PRESUP07, PRESUP08, PRESUP09, PRESUP10,
             PRESUP11, PRESUP12)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          MATCHING (NUM_CTA, EJERCICIO)
        `;

        const params = [
          numCtaNormalizada,
          ejercicio,
          valores.ene || 0, valores.feb || 0, valores.mar || 0, valores.abr || 0,
          valores.may || 0, valores.jun || 0, valores.jul || 0, valores.ago || 0,
          valores.sep || 0, valores.oct || 0, valores.nov || 0, valores.dic || 0
        ];

        await ejecutarConsulta(empresaIdCanon, upsertQuery, params);
        cuentasActualizadas++;
        cuentasProcesadas.push({
          numCta: (numCta ?? '').toString(),
          numCtaNormalizada,
        });

        if (numCtaNormalizada) {
          presupuestosEditados.set(numCtaNormalizada, {
          PRESUP01: valores.ene || 0,
          PRESUP02: valores.feb || 0,
          PRESUP03: valores.mar || 0,
          PRESUP04: valores.abr || 0,
          PRESUP05: valores.may || 0,
          PRESUP06: valores.jun || 0,
          PRESUP07: valores.jul || 0,
          PRESUP08: valores.ago || 0,
          PRESUP09: valores.sep || 0,
          PRESUP10: valores.oct || 0,
          PRESUP11: valores.nov || 0,
          PRESUP12: valores.dic || 0,
          });
        }

        const clave = numCtaNormalizada;
        if (detalleIngresos.has(clave)) {
          meses.forEach((m) => {
            acumuladoPadreIngreso[m] += Number(valores[m] || 0);
          });
        }
        if (detalleGastos.has(clave)) {
          meses.forEach((m) => {
            acumuladoPadreGasto[m] += Number(valores[m] || 0);
          });
        }
      } catch (error) {
        errores.push({ cuenta: cuenta.numCta, error: error.message });
      }
    }

    // Reflejar consolidado en cuentas mayor de divisiones (visible en Presupuestos)
    const upsertPadre = async (numCta, acumulado) => {
      const numCtaNormalizada = normalizarCuenta21(numCta);
      if (!numCtaNormalizada) return;
      const upsertQueryPadre = `
        UPDATE OR INSERT INTO ${tablaPresup}
          (NUM_CTA, EJERCICIO, PRESUP01, PRESUP02, PRESUP03, PRESUP04,
           PRESUP05, PRESUP06, PRESUP07, PRESUP08, PRESUP09, PRESUP10,
           PRESUP11, PRESUP12)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        MATCHING (NUM_CTA, EJERCICIO)
      `;
      const paramsPadre = [
        numCtaNormalizada,
        ejercicio,
        acumulado.ene || 0, acumulado.feb || 0, acumulado.mar || 0, acumulado.abr || 0,
        acumulado.may || 0, acumulado.jun || 0, acumulado.jul || 0, acumulado.ago || 0,
        acumulado.sep || 0, acumulado.oct || 0, acumulado.nov || 0, acumulado.dic || 0,
      ];
       await ejecutarConsulta(empresaIdCanon, upsertQueryPadre, paramsPadre);
      cuentasPadreActualizadas++;
    };

    try {
      if (meses.some((m) => acumuladoPadreIngreso[m] !== 0)) {
        await upsertPadre("450-000-000-00", acumuladoPadreIngreso);
      }
      if (meses.some((m) => acumuladoPadreGasto[m] !== 0)) {
        await upsertPadre("950-000-000-00", acumuladoPadreGasto);
      }
    } catch (errorPadreManual) {
      console.error("Error al actualizar cuentas padre consolidadas:", errorPadreManual);
    }

    if (errores.length > 0 && cuentasActualizadas === 0) {
      return res.status(500).json({
        mensaje: 'No fue posible actualizar presupuestos consolidados.',
        cuentasActualizadas,
        cuentasPadreActualizadas,
        errores,
      });
    }

    let verificacion = [];
    try {
      const cuentasParaVerificar = Array.from(new Set(presupuestosEditados.keys()));
      if (cuentasParaVerificar.length > 0) {
        const marcadores = cuentasParaVerificar.map(() => '?').join(',');
        const verifQuery = `
          SELECT NUM_CTA, EJERCICIO,
                 PRESUP01, PRESUP02, PRESUP03, PRESUP04, PRESUP05, PRESUP06,
                 PRESUP07, PRESUP08, PRESUP09, PRESUP10, PRESUP11, PRESUP12
          FROM ${tablaPresup}
          WHERE EJERCICIO = ?
            AND NUM_CTA IN (${marcadores})
          ORDER BY NUM_CTA
        `;
        verificacion = await ejecutarConsulta(empresaIdCanon, verifQuery, [ejercicio, ...cuentasParaVerificar]);
      }
    } catch (errorVerif) {
      console.warn('No fue posible verificar presupuestos consolidados.', errorVerif?.message || errorVerif);
    }

    res.json({
      mensaje: 'Actualización completada',
      empresaId: empresaIdCanon,
      anio: ejercicio,
      cuentasActualizadas,
      cuentasPadreActualizadas,
      cuentasProcesadas: cuentasProcesadas.length > 0 ? cuentasProcesadas : undefined,
      verificacion: verificacion && verificacion.length > 0 ? verificacion : undefined,
      errores: errores.length > 0 ? errores : undefined
    });
  } catch (error) {
    console.error('Error al actualizar presupuestos consolidados:', error);
    res.status(500).json({ mensaje: 'Error al actualizar presupuestos consolidados.' });
  }
});

/**
 * Nuevo endpoint: Obtener totales de presupuesto de un capítulo sumando cuentas directamente de PRESUP
 * Este endpoint lee directamente de PRESUP26 y suma las cuentas 400-450 (income) y 451-950 (expense)
 * Sin pasar por planeacionReportesEngine
 */
router.get('/totales-capitulo', async (req, res) => {
  try {
    const { empresaId, anio } = req.query;
    
    if (!empresaId || !anio) {
      return res.status(400).json({ mensaje: 'Se requiere empresaId y anio' });
    }

    const empresa = obtenerEmpresaPorId(empresaId);
    if (!empresa) {
      return res.status(404).json({ mensaje: 'Empresa no encontrada' });
    }

    const totales = await obtenerTotalesPresupuestoCapitulo(empresaId, Number(anio));

    res.json({
      empresaId,
      empresa: empresa.nombre,
      anio: Number(anio),
      totales
    });
  } catch (error) {
    console.error('Error al obtener totales de capítulo:', error);
    
    if (esTablaPresupuestoInexistente(error)) {
      return res.status(404).json({ 
        mensaje: `No existe información de presupuesto para el año ${req.query.anio}` 
      });
    }
    
    if (esErrorConexionFirebird(error)) {
      return res.status(503).json({ 
        mensaje: 'No se pudo conectar a la base de datos. Verifica la conexión.' 
      });
    }
    
    res.status(500).json({ mensaje: 'Error al obtener totales de presupuesto.' });
  }
});

module.exports = router;
