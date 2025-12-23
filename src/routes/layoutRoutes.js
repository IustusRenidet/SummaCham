/**
 * layoutRoutes.js
 * API REST para gestión de layouts por año y capítulo
 */

const express = require('express');
const router = express.Router();
const layoutService = require('../services/layoutService');
const { requireAuth } = require('../middleware/auth');
const { normalizarNombreModulo } = require('../config/modulos');

const tienePermisoGuardar = (req, empresaId, modulo) => {
  if (req.esAdmin) return true;
  const moduloNormalizado = normalizarNombreModulo(modulo) || modulo;
  return Boolean(req.mapaPermisos?.[empresaId]?.[moduloNormalizado]?.['Cargar y guardar']);
};

/**
 * GET /api/layouts/:modulo/anios
 * Obtener años disponibles para un módulo
 */
router.get('/:modulo/anios', requireAuth, (req, res) => {
  try {
    const { modulo } = req.params;
    const { empresaId = 'EMPRESA01' } = req.query;

    const anios = layoutService.obtenerAniosDisponibles({ empresaId, modulo });

    res.json({ 
      success: true, 
      modulo,
      anios 
    });
  } catch (error) {
    console.error('Error al obtener años:', error);
    res.status(500).json({ 
      success: false, 
      mensaje: 'Error al obtener años disponibles',
      error: error.message 
    });
  }
});

/**
 * GET /api/layouts/:modulo/:anio/capitulos
 * Obtener capítulos disponibles para un módulo y año
 */
router.get('/:modulo/:anio/capitulos', requireAuth, (req, res) => {
  try {
    const { modulo, anio } = req.params;
    const { empresaId = 'EMPRESA01' } = req.query;

    const capitulos = layoutService.obtenerCapitulos({ 
      empresaId, 
      modulo, 
      anio: parseInt(anio) 
    });

    res.json({ 
      success: true, 
      modulo,
      anio: parseInt(anio),
      capitulos 
    });
  } catch (error) {
    console.error('Error al obtener capítulos:', error);
    res.status(500).json({ 
      success: false, 
      mensaje: 'Error al obtener capítulos',
      error: error.message 
    });
  }
});

/**
 * GET /api/layouts/:modulo/:anio/:capitulo
 * Obtener layout completo para un módulo, año y capítulo
 */
router.get('/:modulo/:anio/:capitulo', requireAuth, (req, res) => {
  try {
    const { modulo, anio, capitulo } = req.params;
    const { empresaId = 'EMPRESA01' } = req.query;

    const layout = layoutService.obtenerLayout({ 
      empresaId, 
      modulo, 
      anio: parseInt(anio),
      capitulo 
    });

    res.json({ 
      success: true, 
      modulo,
      anio: parseInt(anio),
      capitulo,
      layout 
    });
  } catch (error) {
    console.error('Error al obtener layout:', error);
    res.status(500).json({ 
      success: false, 
      mensaje: 'Error al obtener layout',
      error: error.message 
    });
  }
});

/**
 * GET /api/layouts/:modulo/:anio/estadisticas
 * Obtener estadísticas de un layout
 */
router.get('/:modulo/:anio/estadisticas', requireAuth, (req, res) => {
  try {
    const { modulo, anio } = req.params;
    const { empresaId = 'EMPRESA01' } = req.query;

    const stats = layoutService.obtenerEstadisticasLayout({ 
      empresaId, 
      modulo, 
      anio: parseInt(anio) 
    });

    res.json({ 
      success: true, 
      modulo,
      anio: parseInt(anio),
      estadisticas: stats 
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ 
      success: false, 
      mensaje: 'Error al obtener estadísticas',
      error: error.message 
    });
  }
});

/**
 * GET /api/layouts/:modulo/:anio/completo
 * Obtener layout completo de un módulo (todos los capítulos) en formato legacy
 */
router.get('/:modulo/:anio/completo', requireAuth, (req, res) => {
  try {
    const { modulo, anio } = req.params;
    const { empresaId = 'EMPRESA01' } = req.query;

    const capitulos = layoutService.obtenerCapitulos({ 
      empresaId, 
      modulo, 
      anio: parseInt(anio) 
    });

    const layoutCompleto = {};
    const operacionesGlobales = [];

    // Cargar cada capítulo y agrupar
    capitulos.forEach(cap => {
      const layout = layoutService.obtenerLayout({ 
        empresaId, 
        modulo, 
        anio: parseInt(anio),
        capitulo: cap.capitulo 
      });

      // Convertir cuentas a formato legacy
      layoutCompleto[cap.capitulo] = layout.cuentas.map(cuenta => ({
        CAPITULO: cap.capitulo,
        CUENTA: cuenta.CUENTA,
        NOMBRE: cuenta.NOMBRE,
        'SECCIÓN Principal': cuenta['SECCIÓN Principal'],
        'SECCION Secundaria': cuenta['SECCION Secundaria'],
        SECCION: cuenta['SECCIÓN Principal'] // Para módulos operativos
      }));

      // Recolectar operaciones
      if (layout.operaciones && layout.operaciones.length > 0) {
        operacionesGlobales.push(...layout.operaciones);
      }
    });

    // Agregar operaciones globales si existen
    if (operacionesGlobales.length > 0) {
      layoutCompleto['SUMA DE VARIAS SECCIONES'] = operacionesGlobales;
    }

    res.json({ 
      success: true, 
      modulo,
      anio: parseInt(anio),
      layout: layoutCompleto
    });
  } catch (error) {
    console.error('Error al obtener layout completo:', error);
    res.status(500).json({ 
      success: false, 
      mensaje: 'Error al obtener layout completo',
      error: error.message 
    });
  }
});

/**
 * POST /api/layouts/:modulo/:anio/:capitulo/cuentas
 * Guardar cuentas de un layout
 */
router.post('/:modulo/:anio/:capitulo/cuentas', requireAuth, (req, res) => {
  try {
    const { modulo, anio, capitulo } = req.params;
    const { empresaId = 'EMPRESA01', cuentas } = req.body;

    if (!Array.isArray(cuentas)) {
      return res.status(400).json({ 
        success: false, 
        mensaje: 'cuentas debe ser un array' 
      });
    }

    const resultado = layoutService.guardarCuentas({ 
      empresaId, 
      modulo, 
      anio: parseInt(anio),
      capitulo,
      cuentas 
    });

    res.json({ 
      success: true, 
      mensaje: 'Cuentas guardadas exitosamente',
      ...resultado 
    });
  } catch (error) {
    console.error('Error al guardar cuentas:', error);
    res.status(500).json({ 
      success: false, 
      mensaje: 'Error al guardar cuentas',
      error: error.message 
    });
  }
});

/**
 * POST /api/layouts/:modulo/:anio/operaciones
 * Guardar operaciones de un layout
 */
router.post('/:modulo/:anio/operaciones', requireAuth, (req, res) => {
  try {
    const { modulo, anio } = req.params;
    const { empresaId = 'EMPRESA01', operaciones } = req.body;

    if (!Array.isArray(operaciones)) {
      return res.status(400).json({ 
        success: false, 
        mensaje: 'operaciones debe ser un array' 
      });
    }

    const resultado = layoutService.guardarOperaciones({ 
      empresaId, 
      modulo, 
      anio: parseInt(anio),
      operaciones 
    });

    res.json({ 
      success: true, 
      mensaje: 'Operaciones guardadas exitosamente',
      ...resultado 
    });
  } catch (error) {
    console.error('Error al guardar operaciones:', error);
    res.status(500).json({ 
      success: false, 
      mensaje: 'Error al guardar operaciones',
      error: error.message 
    });
  }
});

/**
 * POST /api/layouts/:modulo/copiar
 * Copiar layout de un año a otro
 */
router.post('/:modulo/copiar', requireAuth, (req, res) => {
  try {
    const { modulo } = req.params;
    const { empresaId = 'EMPRESA01', anioOrigen, anioDestino } = req.body;

    if (!tienePermisoGuardar(req, empresaId, modulo)) {
      return res.status(403).json({ 
        success: false, 
        mensaje: 'No cuentas con permisos para copiar layouts' 
      });
    }

    if (!anioOrigen || !anioDestino) {
      return res.status(400).json({ 
        success: false, 
        mensaje: 'anioOrigen y anioDestino son requeridos' 
      });
    }

    const resultado = layoutService.copiarLayout({ 
      empresaId, 
      modulo, 
      anioOrigen: parseInt(anioOrigen),
      anioDestino: parseInt(anioDestino)
    });

    res.json({ 
      success: true, 
      ...resultado 
    });
  } catch (error) {
    console.error('Error al copiar layout:', error);
    res.status(500).json({ 
      success: false, 
      mensaje: 'Error al copiar layout',
      error: error.message 
    });
  }
});

/**
 * POST /api/layouts/:modulo/:anio/demo
 * Crear plantilla demo para un módulo, año y capítulo
 */
router.post('/:modulo/:anio/demo', requireAuth, (req, res) => {
  try {
    const { modulo, anio } = req.params;
    const {
      empresaId = 'EMPRESA01',
      capitulo = 'DEFAULT',
      overwrite = false
    } = req.body || {};

    if (!tienePermisoGuardar(req, empresaId, modulo)) {
      return res.status(403).json({
        success: false,
        mensaje: 'No cuentas con permisos para crear plantillas'
      });
    }

    const resultado = layoutService.crearLayoutDemo({
      empresaId,
      modulo,
      anio: parseInt(anio, 10),
      capitulo,
      overwrite: Boolean(overwrite)
    });

    if (resultado.conflict) {
      return res.status(409).json({
        success: false,
        mensaje: resultado.mensaje,
        existe: true,
        capitulo
      });
    }

    if (!resultado.success) {
      return res.status(400).json({
        success: false,
        mensaje: resultado.mensaje || 'No fue posible crear la plantilla.'
      });
    }

    res.json({
      success: true,
      ...resultado
    });
  } catch (error) {
    console.error('Error al crear plantilla demo:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error al crear plantilla demo',
      error: error.message
    });
  }
});

/**
 * DELETE /api/layouts/:modulo/:anio
 * Eliminar layout completo de un año
 */
router.delete('/:modulo/:anio', requireAuth, (req, res) => {
  try {
    const { modulo, anio } = req.params;
    const { empresaId = 'EMPRESA01' } = req.query;

    // Verificar que no sea el único año disponible
    const aniosDisponibles = layoutService.obtenerAniosDisponibles({ empresaId, modulo });
    if (aniosDisponibles.length === 1 && aniosDisponibles[0] === parseInt(anio)) {
      return res.status(400).json({ 
        success: false, 
        mensaje: 'No se puede eliminar el único año disponible' 
      });
    }

    const resultado = layoutService.eliminarLayout({ 
      empresaId, 
      modulo, 
      anio: parseInt(anio)
    });

    res.json({ 
      success: true, 
      ...resultado 
    });
  } catch (error) {
    console.error('Error al eliminar layout:', error);
    res.status(500).json({ 
      success: false, 
      mensaje: 'Error al eliminar layout',
      error: error.message 
    });
  }
});

/**
 * GET /api/layouts/:modulo/:anio/existe
 * Verificar si existe un layout para un año
 */
router.get('/:modulo/:anio/existe', requireAuth, (req, res) => {
  try {
    const { modulo, anio } = req.params;
    const { empresaId = 'EMPRESA01' } = req.query;

    const existe = layoutService.existeLayout({ 
      empresaId, 
      modulo, 
      anio: parseInt(anio) 
    });

    res.json({ 
      success: true, 
      modulo,
      anio: parseInt(anio),
      existe 
    });
  } catch (error) {
    console.error('Error al verificar layout:', error);
    res.status(500).json({ 
      success: false, 
      mensaje: 'Error al verificar layout',
      error: error.message 
    });
  }
});

/**
 * POST /api/layouts/:modulo/:anio/reseed
 * Forzar recarga de operaciones desde JSON para un módulo y año
 */
router.post('/:modulo/:anio/reseed', requireAuth, (req, res) => {
  try {
    const { modulo, anio } = req.params;
    const { empresaId = 'EMPRESA01' } = req.body;
    const path = require('path');
    const fs = require('fs');

    // Buscar el archivo JSON correcto
    const baseDir = path.resolve(__dirname, '../../info IMPORTANTE');
    const archivoAnio = `CUENTAS SUMMARY y RESUMEN ${anio}.json`;
    const archivoGenerico = 'CUENTAS SUMMARY y RESUMEN.json';
    
    let archivoJson = path.join(baseDir, archivoAnio);
    if (!fs.existsSync(archivoJson)) {
      archivoJson = path.join(baseDir, archivoGenerico);
    }
    
    if (!fs.existsSync(archivoJson)) {
      return res.status(404).json({
        success: false,
        mensaje: `No se encontró archivo de configuración para ${modulo} ${anio}`
      });
    }

    const contenido = JSON.parse(fs.readFileSync(archivoJson, 'utf8'));
    const operacionesCompletas = contenido['SUMA DE VARIAS SECCIONES'] || [];
    
    // Filtrar por HOJA (módulo)
    const operaciones = operacionesCompletas.filter(op => 
      (op.HOJA || '').toUpperCase() === modulo.toUpperCase()
    );

    if (!operaciones.length) {
      return res.json({
        success: true,
        mensaje: `No hay operaciones de ${modulo} en el archivo`,
        operaciones: 0
      });
    }

    // Guardar operaciones
    const resultado = layoutService.guardarOperaciones({
      empresaId,
      modulo,
      anio: parseInt(anio),
      operaciones
    });

    res.json({
      success: true,
      mensaje: `Operaciones recargadas exitosamente desde ${path.basename(archivoJson)}`,
      operaciones: operaciones.length,
      resultado
    });
  } catch (error) {
    console.error('Error al recargar operaciones:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error al recargar operaciones',
      error: error.message
    });
  }
});

/**
 * PUT /api/layouts/:modulo/:anio/:capitulo/cuenta/:cuenta
 * Actualizar una cuenta específica
 */
router.put('/:modulo/:anio/:capitulo/cuenta/:cuenta', requireAuth, (req, res) => {
  try {
    const { modulo, anio, capitulo, cuenta } = req.params;
    const { empresaId = 'EMPRESA01', datos } = req.body;

    if (!tienePermisoGuardar(req, empresaId, modulo)) {
      return res.status(403).json({
        success: false,
        mensaje: 'No cuentas con permisos para editar'
      });
    }

    const resultado = layoutService.actualizarCuenta({
      empresaId,
      modulo,
      anio: parseInt(anio),
      capitulo,
      cuentaOriginal: cuenta,
      datos
    });

    res.json({
      success: true,
      mensaje: 'Cuenta actualizada',
      ...resultado
    });
  } catch (error) {
    console.error('Error al actualizar cuenta:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error al actualizar cuenta',
      error: error.message
    });
  }
});

/**
 * DELETE /api/layouts/:modulo/:anio/:capitulo/cuenta/:cuenta
 * Eliminar una cuenta específica
 */
router.delete('/:modulo/:anio/:capitulo/cuenta/:cuenta', requireAuth, (req, res) => {
  try {
    const { modulo, anio, capitulo, cuenta } = req.params;
    const { empresaId = 'EMPRESA01' } = req.query;

    if (!tienePermisoGuardar(req, empresaId, modulo)) {
      return res.status(403).json({
        success: false,
        mensaje: 'No cuentas con permisos para eliminar'
      });
    }

    const resultado = layoutService.eliminarCuenta({
      empresaId,
      modulo,
      anio: parseInt(anio),
      capitulo,
      cuenta
    });

    res.json({
      success: true,
      mensaje: 'Cuenta eliminada',
      ...resultado
    });
  } catch (error) {
    console.error('Error al eliminar cuenta:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error al eliminar cuenta',
      error: error.message
    });
  }
});

/**
 * POST /api/layouts/:modulo/:anio/:capitulo/reordenar
 * Reordenar cuentas de un layout
 */
router.post('/:modulo/:anio/:capitulo/reordenar', requireAuth, (req, res) => {
  try {
    const { modulo, anio, capitulo } = req.params;
    const { empresaId = 'EMPRESA01', orden } = req.body;

    if (!tienePermisoGuardar(req, empresaId, modulo)) {
      return res.status(403).json({
        success: false,
        mensaje: 'No cuentas con permisos para reordenar'
      });
    }

    if (!Array.isArray(orden)) {
      return res.status(400).json({
        success: false,
        mensaje: 'orden debe ser un array de objetos { cuenta, orden }'
      });
    }

    const resultado = layoutService.reordenarCuentas({
      empresaId,
      modulo,
      anio: parseInt(anio),
      capitulo,
      orden
    });

    res.json({
      success: true,
      mensaje: 'Orden actualizado',
      ...resultado
    });
  } catch (error) {
    console.error('Error al reordenar:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error al reordenar',
      error: error.message
    });
  }
});

/**
 * PUT /api/layouts/:modulo/:anio/operacion/:clase
 * Actualizar una operación específica
 */
router.put('/:modulo/:anio/operacion/:clase', requireAuth, (req, res) => {
  try {
    const { modulo, anio, clase } = req.params;
    const { empresaId = 'EMPRESA01', datos, capitulo } = req.body;

    if (!tienePermisoGuardar(req, empresaId, modulo)) {
      return res.status(403).json({
        success: false,
        mensaje: 'No cuentas con permisos para editar operaciones'
      });
    }

    const resultado = layoutService.actualizarOperacion({
      empresaId,
      modulo,
      anio: parseInt(anio),
      capitulo,
      claseOriginal: decodeURIComponent(clase),
      datos
    });

    res.json({
      success: true,
      mensaje: 'Operación actualizada',
      ...resultado
    });
  } catch (error) {
    console.error('Error al actualizar operación:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error al actualizar operación',
      error: error.message
    });
  }
});

/**
 * DELETE /api/layouts/:modulo/:anio/operacion/:clase
 * Eliminar una operación específica
 */
router.delete('/:modulo/:anio/operacion/:clase', requireAuth, (req, res) => {
  try {
    const { modulo, anio, clase } = req.params;
    const { empresaId = 'EMPRESA01', capitulo } = req.query;

    if (!tienePermisoGuardar(req, empresaId, modulo)) {
      return res.status(403).json({
        success: false,
        mensaje: 'No cuentas con permisos para eliminar operaciones'
      });
    }

    const resultado = layoutService.eliminarOperacion({
      empresaId,
      modulo,
      anio: parseInt(anio),
      capitulo,
      clase: decodeURIComponent(clase)
    });

    res.json({
      success: true,
      mensaje: 'Operación eliminada',
      ...resultado
    });
  } catch (error) {
    console.error('Error al eliminar operación:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error al eliminar operación',
      error: error.message
    });
  }
});

/**
 * POST /api/layouts/:modulo/:anio/:capitulo/seccion
 * Crear o actualizar una sección
 */
router.post('/:modulo/:anio/:capitulo/seccion', requireAuth, (req, res) => {
  try {
    const { modulo, anio, capitulo } = req.params;
    const { empresaId = 'EMPRESA01', tipo, nombre, principal, orden } = req.body;

    if (!tienePermisoGuardar(req, empresaId, modulo)) {
      return res.status(403).json({
        success: false,
        mensaje: 'No cuentas con permisos para crear secciones'
      });
    }

    if (!tipo || !nombre) {
      return res.status(400).json({
        success: false,
        mensaje: 'tipo y nombre son requeridos'
      });
    }

    const resultado = layoutService.crearSeccion({
      empresaId,
      modulo,
      anio: parseInt(anio),
      capitulo,
      tipo,
      nombre,
      principal: principal || null,
      orden: orden || 1
    });

    res.json({
      success: true,
      mensaje: 'Sección creada',
      ...resultado
    });
  } catch (error) {
    console.error('Error al crear sección:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error al crear sección',
      error: error.message
    });
  }
});

/**
 * PUT /api/layouts/:modulo/:anio/:capitulo/seccion/:nombre
 * Renombrar una sección (actualiza todas las cuentas asociadas)
 */
router.put('/:modulo/:anio/:capitulo/seccion/:nombre', requireAuth, (req, res) => {
  try {
    const { modulo, anio, capitulo, nombre } = req.params;
    const { empresaId = 'EMPRESA01', nuevoNombre, tipo } = req.body;

    if (!tienePermisoGuardar(req, empresaId, modulo)) {
      return res.status(403).json({
        success: false,
        mensaje: 'No cuentas con permisos para editar secciones'
      });
    }

    if (!nuevoNombre) {
      return res.status(400).json({
        success: false,
        mensaje: 'nuevoNombre es requerido'
      });
    }

    const resultado = layoutService.renombrarSeccion({
      empresaId,
      modulo,
      anio: parseInt(anio),
      capitulo,
      nombreOriginal: decodeURIComponent(nombre),
      nuevoNombre,
      tipo: tipo || 'principal'
    });

    res.json({
      success: true,
      mensaje: 'Sección renombrada',
      ...resultado
    });
  } catch (error) {
    console.error('Error al renombrar sección:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error al renombrar sección',
      error: error.message
    });
  }
});

module.exports = router;
