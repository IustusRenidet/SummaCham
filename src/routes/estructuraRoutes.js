/**
 * estructuraRoutes.js
 * Rutas para modificar la estructura de SUMMARY y RESUMEN
 * Permite agregar/editar/eliminar cuentas, secciones y operaciones
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { loadLayoutConfig, saveLayoutConfig } = require('../services/layoutConfigStore');

/**
 * POST /api/cuentas/agregar
 * Agrega una nueva cuenta al JSON
 */
router.post('/cuentas/agregar', requireAuth, async (req, res) => {
  try {
    const { cuenta, nombre, seccion, capitulo, modulo, anio } = req.body;

    if (!cuenta || !nombre || !seccion || !capitulo) {
      return res.status(400).json({
        exito: false,
        mensaje: 'Faltan campos obligatorios'
      });
    }

    const moduloClave = (modulo || 'SUMMARY').toUpperCase();
    const config = await loadLayoutConfig(moduloClave, { anio });
    
    // Determinar el array correcto (SUMMARY o RESUMEN)
    const targetArray = moduloClave === 'RESUMEN' ? 'RESUMEN' : 'SUMMARY';
    
    if (!config[targetArray]) {
      config[targetArray] = [];
    }

    // Verificar que no exista la cuenta
    const existe = config[targetArray].some(c => c.CUENTA === cuenta);
    if (existe) {
      return res.status(400).json({
        exito: false,
        mensaje: `La cuenta ${cuenta} ya existe`
      });
    }

    // Crear nueva cuenta
    const nuevaCuenta = {
      "CAPITULO": capitulo,
      "SECCIÓN Principal": seccion,
      "SECCION Secundaria": seccion,
      "CUENTA": cuenta,
      "NOMBRE": nombre
    };

    config[targetArray].push(nuevaCuenta);

    await saveLayoutConfig(targetArray, config, { anio });

    res.json({
      exito: true,
      mensaje: 'Cuenta agregada exitosamente',
      cuenta: nuevaCuenta
    });

  } catch (error) {
    console.error('Error en /cuentas/agregar:', error);
    res.status(500).json({
      exito: false,
      mensaje: error.message
    });
  }
});

/**
 * PUT /api/cuentas/editar
 * Edita una cuenta existente
 */
router.put('/cuentas/editar', requireAuth, async (req, res) => {
  try {
    const { cuenta, nombre, modulo, anio } = req.body;

    if (!cuenta || !nombre) {
      return res.status(400).json({
        exito: false,
        mensaje: 'Faltan campos obligatorios'
      });
    }

    const moduloClave = (modulo || 'SUMMARY').toUpperCase();
    const config = await loadLayoutConfig(moduloClave, { anio });
    const targetArray = moduloClave === 'RESUMEN' ? 'RESUMEN' : 'SUMMARY';

    if (!config[targetArray]) {
      return res.status(404).json({
        exito: false,
        mensaje: 'Configuración no encontrada'
      });
    }

    // Buscar y actualizar
    const index = config[targetArray].findIndex(c => c.CUENTA === cuenta);
    if (index === -1) {
      return res.status(404).json({
        exito: false,
        mensaje: `Cuenta ${cuenta} no encontrada`
      });
    }

    config[targetArray][index].NOMBRE = nombre;

    await saveLayoutConfig(targetArray, config, { anio });

    res.json({
      exito: true,
      mensaje: 'Cuenta actualizada exitosamente',
      cuenta: config[targetArray][index]
    });

  } catch (error) {
    console.error('Error en /cuentas/editar:', error);
    res.status(500).json({
      exito: false,
      mensaje: error.message
    });
  }
});

/**
 * DELETE /api/cuentas/eliminar
 * Elimina una cuenta
 */
router.delete('/cuentas/eliminar', requireAuth, async (req, res) => {
  try {
    const { cuenta, modulo, anio } = req.body;

    if (!cuenta) {
      return res.status(400).json({
        exito: false,
        mensaje: 'Falta el número de cuenta'
      });
    }

    const moduloClave = (modulo || 'SUMMARY').toUpperCase();
    const config = await loadLayoutConfig(moduloClave, { anio });
    const targetArray = moduloClave === 'RESUMEN' ? 'RESUMEN' : 'SUMMARY';

    if (!config[targetArray]) {
      return res.status(404).json({
        exito: false,
        mensaje: 'Configuración no encontrada'
      });
    }

    const initialLength = config[targetArray].length;
    config[targetArray] = config[targetArray].filter(c => c.CUENTA !== cuenta);

    if (config[targetArray].length === initialLength) {
      return res.status(404).json({
        exito: false,
        mensaje: `Cuenta ${cuenta} no encontrada`
      });
    }

    await saveLayoutConfig(targetArray, config, { anio });

    res.json({
      exito: true,
      mensaje: 'Cuenta eliminada exitosamente'
    });

  } catch (error) {
    console.error('Error en /cuentas/eliminar:', error);
    res.status(500).json({
      exito: false,
      mensaje: error.message
    });
  }
});

/**
 * POST /api/secciones/agregar
 * Agrega una nueva sección
 */
router.post('/secciones/agregar', requireAuth, async (req, res) => {
  try {
    const { nombre, tipo, capitulo, parent, modulo, anio } = req.body;

    if (!nombre || !tipo || !capitulo) {
      return res.status(400).json({
        exito: false,
        mensaje: 'Faltan campos obligatorios'
      });
    }

    const moduloClave = (modulo || 'SUMMARY').toUpperCase();
    const config = await loadLayoutConfig(moduloClave, { anio });

    // Para secciones, podríamos crear una cuenta placeholder
    // O modificar la estructura del JSON para soportar secciones independientes
    
    res.json({
      exito: true,
      mensaje: 'Funcionalidad de agregar secciones pendiente de implementar',
      nota: 'Requiere refactorización del JSON para soportar jerarquía de secciones'
    });

  } catch (error) {
    console.error('Error en /secciones/agregar:', error);
    res.status(500).json({
      exito: false,
      mensaje: error.message
    });
  }
});

/**
 * POST /api/operaciones/agregar
 * Crea una nueva operación matemática
 */
router.post('/operaciones/agregar', requireAuth, async (req, res) => {
  try {
    const { nombre, tipo, formula, hoja, secciones, modulo, anio } = req.body;

    if (!nombre || !tipo || !secciones || secciones.length === 0) {
      return res.status(400).json({
        exito: false,
        mensaje: 'Faltan campos obligatorios'
      });
    }

    const moduloClave = (modulo || 'SUMMARY').toUpperCase();
    const config = await loadLayoutConfig(moduloClave, { anio });

    if (!config['SUMA DE VARIAS SECCIONES']) {
      config['SUMA DE VARIAS SECCIONES'] = [];
    }

    // Determinar operador
    let OPERACION = '+';
    if (tipo === 'resta') OPERACION = '-';
    if (tipo === 'division') OPERACION = '/';
    if (tipo === 'multiplicacion') OPERACION = '*';

    // Crear nueva operación
    const nuevaOperacion = {
      "HOJA": hoja || 'SUMMARY',
      "ETIQUETA": nombre,
      "SECCIONES": secciones,
      "OPERACION": OPERACION,
      "TIPO": "consolidacion"
    };

    config['SUMA DE VARIAS SECCIONES'].push(nuevaOperacion);

    await saveLayoutConfig(moduloClave, config, { anio });

    res.json({
      exito: true,
      mensaje: 'Operación creada exitosamente',
      operacion: nuevaOperacion
    });

  } catch (error) {
    console.error('Error en /operaciones/agregar:', error);
    res.status(500).json({
      exito: false,
      mensaje: error.message
    });
  }
});

/**
 * GET /api/estructura/secciones
 * Obtiene todas las secciones disponibles
 */
router.get('/estructura/secciones', requireAuth, async (req, res) => {
  try {
    const { modulo, anio } = req.query;
    const moduloClave = (modulo || 'SUMMARY').toUpperCase();
    const config = await loadLayoutConfig(moduloClave, { anio });

    const targetArray = moduloClave === 'RESUMEN' ? 'RESUMEN' : 'SUMMARY';

    if (!config[targetArray]) {
      return res.json({
        exito: true,
        secciones: []
      });
    }

    // Extraer secciones únicas
    const seccionesPrincipales = [...new Set(config[targetArray].map(c => c['SECCIÓN Principal']))];
    const seccionesSecundarias = [...new Set(config[targetArray].map(c => c['SECCION Secundaria']))];

    res.json({
      exito: true,
      seccionesPrincipales,
      seccionesSecundarias,
      todas: [...new Set([...seccionesPrincipales, ...seccionesSecundarias])]
    });

  } catch (error) {
    console.error('Error en /estructura/secciones:', error);
    res.status(500).json({
      exito: false,
      mensaje: error.message
    });
  }
});

module.exports = router;
