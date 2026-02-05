const express = require('express');
const { listarModulos, obtenerDatosModulo } = require('../services/modulosService');
const { obtenerResumen, listarAniosSALDOS } = require('../services/summaryService');
const { obtenerPresupuestosMayor } = require('../services/presupuestosService');
const { requireAuth, tienePermisoEmpresa } = require('../middleware/auth');

const router = express.Router();

const CLAVES_PLAN = {
  1: 'ene',
  2: 'feb',
  3: 'mar',
  4: 'abr',
  5: 'may',
  6: 'jun',
  7: 'jul',
  8: 'ago',
  9: 'sep',
  10: 'oct',
  11: 'nov',
  12: 'dic',
  13: 'anual'
};

const normalizarTexto = (valor) => (valor == null ? '' : String(valor).trim());
const normalizarCodigo = (valor) => normalizarTexto(valor);
const normalizarNaturaleza = (valor) => normalizarTexto(valor).toUpperCase();
const numeroSeguro = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
};

const clavePlanPorPeriodo = (periodo) => {
  const p = Math.max(1, Math.min(13, Number(periodo) || 1));
  return CLAVES_PLAN[p] || 'anual';
};

const obtenerYtdPlan = (registro, periodo) => {
  const clave = clavePlanPorPeriodo(periodo);
  if (clave === 'anual') return numeroSeguro(registro.anual);
  return numeroSeguro(registro[clave]);
};

const obtenerMesPlan = (registro, periodo) => {
  const ytdActual = obtenerYtdPlan(registro, periodo);
  if (periodo <= 1) return ytdActual;
  const ytdPrevio = obtenerYtdPlan(registro, periodo - 1);
  return ytdActual - ytdPrevio;
};

router.use(requireAuth);

router.get('/', (req, res) => {
  res.json({ modulos: listarModulos() });
});

router.get('/:moduloId', (req, res) => {
  const moduloId = (req.params.moduloId || '').toLowerCase();
  const datos = obtenerDatosModulo(moduloId);
  if (!datos) {
    return res.status(404).json({ mensaje: 'Módulo no encontrado.' });
  }
  res.json(datos);
});

// POST /api/modulos/summary-resumen-e
router.post('/summary-resumen-e', async (req, res) => {
  try {
    const {
      anio,
      periodo,
      empresaId: empresaIdBody,
      codigos,
      anioComparativo,
      usarAjusteEnYTD
    } = req.body || {};

    // Permitir obtener empresa del header si no viene en el body
    const empresaIdHeader = req.get('X-Empresa-Activa');
    const empresaId = (empresaIdBody || empresaIdHeader || '').toString();

    const ejercicio = Number(anio);
    const periodoNum = Number(periodo);

    if (!empresaId) {
      return res.status(400).json({ mensaje: 'Falta empresaId.' });
    }
    if (!Number.isInteger(ejercicio) || ejercicio < 2000 || ejercicio > 2100) {
      return res.status(400).json({ mensaje: 'El ejercicio (anio) no es válido.' });
    }
    if (!Number.isInteger(periodoNum) || periodoNum < 1 || periodoNum > 13) {
      return res.status(400).json({ mensaje: 'El periodo debe estar entre 1 y 13.' });
    }
    if (!Array.isArray(codigos)) {
      return res.status(400).json({ mensaje: 'codigos debe ser un arreglo.' });
    }
    if (!req.esAdmin && !tienePermisoEmpresa(req.mapaPermisos, empresaId)) {
      return res.status(403).json({ mensaje: 'No cuentas con permisos para esta empresa.' });
    }
    // Permisos especiales de resumen controlados por la tabla permisos_modulo

    const resultado = await obtenerResumen({
      empresaId,
      anio: ejercicio,
      periodo: periodoNum,
      codigos,
      anioComparativo,
      usarAjusteEnYTD: Boolean(usarAjusteEnYTD)
    });
    const presupuestos = await obtenerPresupuestosMayor(empresaId, ejercicio);
    const mapaPlan = new Map(
      (presupuestos || []).map((registro) => [normalizarCodigo(registro.numCta), registro])
    );

    const detalle = (resultado.detalle || []).map((fila) => {
      const codigo = normalizarCodigo(fila.codigo);
      const plan = mapaPlan.get(codigo);
      const descripcionPlan = plan ? normalizarTexto(plan.descripcion) : '';
      const naturalezaPlan = plan ? normalizarNaturaleza(plan.naturaleza) : '';
      const descripcion = normalizarTexto(fila.descripcion) || descripcionPlan;
      const naturaleza = normalizarNaturaleza(fila.naturaleza || naturalezaPlan);
      let acumuladoPlan = numeroSeguro(fila.acumuladoPlan);
      let mesPlan = numeroSeguro(fila.mesPlan);
      if (plan) {
        acumuladoPlan = obtenerYtdPlan(plan, periodoNum);
        mesPlan = obtenerMesPlan(plan, periodoNum);
      }

      const acumuladoActual = numeroSeguro(fila.acumuladoActual);
      const acumuladoAnterior = numeroSeguro(fila.acumuladoAnterior);
      const mesActual = numeroSeguro(fila.mesActual);
      const mesAnterior = numeroSeguro(fila.mesAnterior);

      return {
        ...fila,
        codigo,
        descripcion,
        naturaleza,
        mesActual,
        mesPlan,
        mesAnterior,
        acumuladoActual,
        acumuladoPlan,
        acumuladoAnterior,
        ytdActual: numeroSeguro(fila.ytdActual != null ? fila.ytdActual : acumuladoActual),
        ytdPlan: acumuladoPlan,
        ytdAnterior: numeroSeguro(fila.ytdAnterior != null ? fila.ytdAnterior : acumuladoAnterior)
      };
    });

    res.json({
      ...resultado,
      detalle
    });
  } catch (error) {
    console.error('Error en summary-resumen-e:', error);
    res.status(500).json({ mensaje: 'No fue posible obtener el resumen solicitado.' });
  }
});

// GET /api/modulos/summary-anios
// Devuelve los años disponibles en base a las tablas SALDOSxx detectadas en Firebird
router.get('/summary-anios', async (req, res) => {
  try {
    const empresaIdHeader = req.get('X-Empresa-Activa');
    const empresaId = (req.query.empresaId || empresaIdHeader || '').toString();
    if (!empresaId) {
      return res.status(400).json({ mensaje: 'Falta empresaId.' });
    }
    if (!req.esAdmin && !tienePermisoEmpresa(req.mapaPermisos, empresaId)) {
      return res.status(403).json({ mensaje: 'No cuentas con permisos para esta empresa.' });
    }
    // Permisos especiales de resumen controlados por la tabla permisos_modulo

    const anios = await listarAniosSALDOS(empresaId);
    res.json({ anios });
  } catch (error) {
    console.error('Error en summary-anios:', error);
    res.status(500).json({ mensaje: 'No fue posible listar los años disponibles.' });
  }
});

module.exports = router;
