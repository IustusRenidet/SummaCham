// src/routes/comitesRoutes.js
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const comitesService = require('../services/comitesService');

/**
 * GET /api/comites/anios
 * Obtiene los años disponibles desde las tablas SALDOS
 */
router.get('/anios', requireAuth, async (req, res) => {
  try {
    const { empresaId } = req.query;
    
    if (!empresaId) {
      return res.status(400).json({
        exito: false,
        mensaje: 'El parámetro empresaId es obligatorio'
      });
    }

    const anios = await comitesService.obtenerAniosDisponibles(empresaId);
    
    res.json({
      exito: true,
      anios
    });
  } catch (error) {
    console.error('Error al obtener años:', error);
    res.status(500).json({
      exito: false,
      mensaje: error.message || 'Error al obtener años disponibles'
    });
  }
});

/**
 * GET /api/comites/lista
 * Obtiene la lista de comités únicos para un año
 */
router.get('/lista', requireAuth, async (req, res) => {
  try {
    const { empresaId, anio } = req.query;
    
    if (!empresaId || !anio) {
      return res.status(400).json({
        exito: false,
        mensaje: 'Los parámetros empresaId y anio son obligatorios'
      });
    }

    const comites = await comitesService.obtenerComites(empresaId, anio);
    
    res.json({
      exito: true,
      comites
    });
  } catch (error) {
    console.error('Error al obtener comités:', error);
    res.status(500).json({
      exito: false,
      mensaje: error.message || 'Error al obtener comités'
    });
  }
});

/**
 * GET /api/comites/cuentas
 * Obtiene cuentas disponibles para autocompletado
 */
router.get('/cuentas', requireAuth, async (req, res) => {
  try {
    const { empresaId, anio } = req.query;
    
    if (!empresaId || !anio) {
      return res.status(400).json({
        exito: false,
        mensaje: 'Los parámetros empresaId y anio son obligatorios'
      });
    }

    const cuentas = await comitesService.obtenerCuentasDisponibles(empresaId, anio);
    
    res.json({
      exito: true,
      cuentas
    });
  } catch (error) {
    console.error('Error al obtener cuentas:', error);
    res.status(500).json({
      exito: false,
      mensaje: error.message || 'Error al obtener cuentas disponibles'
    });
  }
});

/**
 * GET /api/comites/movimientos
 * Obtiene movimientos quincenales por cuentas
 */
router.get('/movimientos', requireAuth, async (req, res) => {
  try {
    const { empresaId, anio, cuentas } = req.query;
    
    if (!empresaId || !anio) {
      return res.status(400).json({
        exito: false,
        mensaje: 'Los parámetros empresaId y anio son obligatorios'
      });
    }

    // Convertir cuentas de string separado por comas a array
    const listaCuentas = cuentas 
      ? String(cuentas).split(',').map(c => c.trim()).filter(Boolean)
      : [];

    if (listaCuentas.length === 0) {
      return res.json({
        exito: true,
        cuentas: [],
        meses: []
      });
    }

    const movimientos = await comitesService.obtenerMovimientosQuincenales(
      empresaId, 
      anio, 
      listaCuentas
    );
    
    const meses = [
      { periodo: 1, alias: 'ENE', clave: 'ene' },
      { periodo: 2, alias: 'FEB', clave: 'feb' },
      { periodo: 3, alias: 'MAR', clave: 'mar' },
      { periodo: 4, alias: 'ABR', clave: 'abr' },
      { periodo: 5, alias: 'MAY', clave: 'may' },
      { periodo: 6, alias: 'JUN', clave: 'jun' },
      { periodo: 7, alias: 'JUL', clave: 'jul' },
      { periodo: 8, alias: 'AGO', clave: 'ago' },
      { periodo: 9, alias: 'SEP', clave: 'sep' },
      { periodo: 10, alias: 'OCT', clave: 'oct' },
      { periodo: 11, alias: 'NOV', clave: 'nov' },
      { periodo: 12, alias: 'DIC', clave: 'dic' }
    ];

    res.json({
      exito: true,
      cuentas: movimientos,
      meses
    });
  } catch (error) {
    console.error('Error al obtener movimientos:', error);
    res.status(500).json({
      exito: false,
      mensaje: error.message || 'Error al obtener movimientos'
    });
  }
});

module.exports = router;