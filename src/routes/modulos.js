const express = require('express');
const { listarModulos, obtenerDatosModulo } = require('../services/modulosService');
const { obtenerResumen } = require('../services/summaryService');

const router = express.Router();

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

    const resultado = await obtenerResumen({
      empresaId,
      anio: ejercicio,
      periodo: periodoNum,
      codigos,
      anioComparativo,
      usarAjusteEnYTD: Boolean(usarAjusteEnYTD)
    });

    res.json(resultado);
  } catch (error) {
    console.error('Error en summary-resumen-e:', error);
    res.status(500).json({ mensaje: 'No fue posible obtener el resumen solicitado.' });
  }
});

module.exports = router;

