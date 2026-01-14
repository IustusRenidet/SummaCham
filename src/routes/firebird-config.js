const express = require('express');
const fs = require('fs');
const { requireAuth } = require('../middleware/auth');
const { EMPRESAS_CONFIGURABLES, obtenerEmpresaBasePorId } = require('../config/empresas');
const {
  leerConfig,
  guardarConfig,
  obtenerConfigBase,
  obtenerOverridesEmpresas,
  obtenerRutaConfig,
  normalizarRuta
} = require('../services/firebirdConfigService');
const { probarConexion } = require('../services/firebirdService');

const router = express.Router();

// Middleware: Solo administradores globales pueden acceder
const requireAdminGlobal = (req, res, next) => {
  if (!req.esAdmin) {
    return res.status(403).json({ 
      mensaje: 'Acceso denegado. Solo administradores globales pueden gestionar conexiones Firebird.' 
    });
  }
  next();
};

router.use(requireAuth);
router.use(requireAdminGlobal);

// GET /api/firebird-config - Obtener configuración actual
router.get('/', (req, res) => {
  try {
    const configBase = obtenerConfigBase();
    const overrides = obtenerOverridesEmpresas();
    const host = (configBase?.host || '').toString().trim().toLowerCase();
    const esLocal = host === '127.0.0.1' || host === 'localhost' || host === '::1';
    
    // Crear mapa completo de empresas con sus configuraciones
    const empresasConfig = EMPRESAS_CONFIGURABLES.map((meta) => {
      const base = obtenerEmpresaBasePorId(meta.id);
      const rutaBase = base?.rutaBaseDatos || null;
      const rutaOverride = normalizarRuta(overrides?.[meta.id]);
      const rutaActual = rutaOverride || rutaBase || null;

      const existe = esLocal && rutaActual ? fs.existsSync(rutaActual) : null;

      return {
        id: meta.id,
        nombre: meta.nombre || base?.nombre || meta.id,
        etiqueta: meta.etiqueta || base?.etiqueta || meta.nombre || meta.id,
        numero: meta.numero || base?.numero || null,
        rutaBase,
        rutaOverride,
        rutaActual,
        rutaBaseDatos: rutaActual,
        existe,
        tieneOverride: Boolean(rutaOverride),
      };
    });

    res.json({
      configBase: { ...configBase, esRemota: !esLocal },
      rutaConfig: obtenerRutaConfig(),
      empresas: empresasConfig
    });
  } catch (error) {
    console.error('Error al obtener configuración Firebird:', error);
    res.status(500).json({ mensaje: 'Error al obtener configuración', error: error.message });
  }
});

// PUT /api/firebird-config/base - Actualizar configuración base
router.put('/base', (req, res) => {
  try {
    const { host, port, user, password } = req.body;
    
    if (!host || !user) {
      return res.status(400).json({ mensaje: 'Host y usuario son requeridos' });
    }

    const portNum = parseInt(port) || 3050;
    
    const config = leerConfig() || {};
    config.host = host.trim();
    config.port = portNum;
    config.user = user.trim();
    config.password = password || '';

    guardarConfig(config);

    res.json({ 
      mensaje: 'Configuración base actualizada correctamente',
      config: {
        host: config.host,
        port: config.port,
        user: config.user
      }
    });
  } catch (error) {
    console.error('Error al actualizar configuración base:', error);
    res.status(500).json({ mensaje: 'Error al actualizar configuración', error: error.message });
  }
});

// PUT /api/firebird-config/empresa/:id - Actualizar ruta de base de datos para empresa
router.put('/empresa/:id', (req, res) => {
  try {
    const empresaId = req.params.id;
    const { rutaBaseDatos } = req.body;

    const empresaMeta = EMPRESAS_CONFIGURABLES.find((e) => e.id === empresaId);
    const empresaBase = obtenerEmpresaBasePorId(empresaId);
    if (!empresaMeta || !empresaBase) {
      return res.status(404).json({ mensaje: 'Empresa no encontrada' });
    }

    const config = leerConfig() || {};
    if (!config.empresas) {
      config.empresas = {};
    }

    if (!rutaBaseDatos || rutaBaseDatos.trim() === '') {
      // Eliminar override si la ruta está vacía
      delete config.empresas[empresaId];
    } else {
      config.empresas[empresaId] = normalizarRuta(rutaBaseDatos);
    }

    guardarConfig(config);

    const rutaActual = config.empresas[empresaId] || empresaBase.rutaBaseDatos || null;

    res.json({ 
      mensaje: `Ruta de base de datos actualizada para ${empresaMeta.nombre || empresaMeta.id}`,
      rutaBaseDatos: rutaActual,
      rutaActual,
      tieneOverride: Boolean(config.empresas[empresaId])
    });
  } catch (error) {
    console.error('Error al actualizar ruta de empresa:', error);
    res.status(500).json({ mensaje: 'Error al actualizar ruta', error: error.message });
  }
});

// POST /api/firebird-config/test/:id - Probar conexión de una empresa
router.post('/test/:id', async (req, res) => {
  try {
    const empresaId = req.params.id;
    const empresaMeta = EMPRESAS_CONFIGURABLES.find((e) => e.id === empresaId);
    const empresaBase = obtenerEmpresaBasePorId(empresaId);
    
    if (!empresaMeta || !empresaBase) {
      return res.status(404).json({ mensaje: 'Empresa no encontrada' });
    }

    const disponible = await probarConexion(empresaId);
    
    res.json({ 
      empresaId,
      empresaNombre: empresaMeta.nombre || empresaMeta.id,
      disponible,
      mensaje: disponible 
        ? 'Conexión exitosa' 
        : 'No se pudo conectar a la base de datos'
    });
  } catch (error) {
    console.error('Error al probar conexión:', error);
    res.status(500).json({ 
      mensaje: 'Error al probar conexión', 
      error: error.message,
      disponible: false
    });
  }
});

// DELETE /api/firebird-config/empresa/:id - Eliminar override de empresa (volver a default)
router.delete('/empresa/:id', (req, res) => {
  try {
    const empresaId = req.params.id;
    const empresaMeta = EMPRESAS_CONFIGURABLES.find((e) => e.id === empresaId);
    const empresaBase = obtenerEmpresaBasePorId(empresaId);
    
    if (!empresaMeta || !empresaBase) {
      return res.status(404).json({ mensaje: 'Empresa no encontrada' });
    }

    const config = leerConfig() || {};
    if (config.empresas && config.empresas[empresaId]) {
      delete config.empresas[empresaId];
      guardarConfig(config);
    }

    res.json({ 
      mensaje: `Configuración de ${empresaMeta.nombre || empresaMeta.id} restaurada a valores por defecto`,
      rutaBaseDatos: empresaBase.rutaBaseDatos || null,
      rutaActual: empresaBase.rutaBaseDatos || null,
      tieneOverride: false
    });
  } catch (error) {
    console.error('Error al eliminar override:', error);
    res.status(500).json({ mensaje: 'Error al eliminar configuración', error: error.message });
  }
});

module.exports = router;
