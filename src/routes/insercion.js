/**
 * insercion.js
 * Rutas para el sistema inteligente de inserción de filas/secciones
 * Con validación jerárquica y prevención de duplicados
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const { requireAuth } = require('../middleware/auth');

// Rutas a archivos JSON
const SUMMARY_RESUMEN_JSON = path.join(__dirname, '../../info IMPORTANTE/CUENTAS SUMMARY y RESUMEN.json');
const MODULOS_JSON = path.join(__dirname, '../../info IMPORTANTE/CUENTAS.json');

/**
 * Helper: Cargar JSON
 */
async function cargarJSON(tipo) {
  try {
    const jsonPath = (tipo === 'SUMMARY' || tipo === 'RESUMEN') 
      ? SUMMARY_RESUMEN_JSON 
      : MODULOS_JSON;
    
    const data = await fs.readFile(jsonPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ Error al cargar JSON:', error);
    throw new Error('No se pudo cargar la configuración');
  }
}

/**
 * Helper: Guardar JSON
 */
async function guardarJSON(tipo, data) {
  try {
    const jsonPath = (tipo === 'SUMMARY' || tipo === 'RESUMEN') 
      ? SUMMARY_RESUMEN_JSON 
      : MODULOS_JSON;
    
    await fs.writeFile(jsonPath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`✅ JSON guardado exitosamente: ${tipo}`);
    return true;
  } catch (error) {
    console.error('❌ Error al guardar JSON:', error);
    throw new Error('No se pudo guardar la configuración');
  }
}

/**
 * Helper: Validar jerarquía según tipo de módulo
 */
function validarJerarquia(tipo, context, moduleType) {
  const errors = [];

  if (moduleType === 'SUMMARY') {
    if (tipo === 'cuenta' && (!context.principal || !context.secundaria)) {
      errors.push('Una cuenta en SUMMARY requiere Sección Principal y Secundaria');
    }
    if (tipo === 'secundaria' && !context.principal) {
      errors.push('Una Sección Secundaria requiere una Sección Principal');
    }
  }

  if (moduleType === 'RESUMEN') {
    if (tipo === 'cuenta' && (!context.principal || !context.secundaria || !context.operacion)) {
      errors.push('Una cuenta en RESUMEN requiere Principal, Secundaria y Operación');
    }
    if (tipo === 'operacion' && (!context.principal || !context.secundaria)) {
      errors.push('Una Operación requiere Sección Principal y Secundaria');
    }
    if (tipo === 'secundaria' && !context.principal) {
      errors.push('Una Sección Secundaria requiere una Sección Principal');
    }
  }

  if (moduleType === 'MODULOS') {
    if (tipo === 'cuenta' && !context.seccion) {
      errors.push('Una cuenta en MÓDULOS requiere una Sección');
    }
    if (tipo === 'operacion' && !context.seccion) {
      errors.push('Una Operación requiere una Sección');
    }
  }

  return errors;
}

/**
 * Helper: Verificar duplicados
 */
function verificarDuplicado(tipo, data, config, moduleType) {
  const targetArray = config[moduleType] || [];

  if (tipo === 'cuenta') {
    const existe = targetArray.some(item => item.CUENTA === data.numero);
    if (existe) {
      return { duplicado: true, mensaje: `La cuenta ${data.numero} ya existe` };
    }
  }

  if (tipo === 'secundaria' || tipo === 'principal' || tipo === 'seccion') {
    const existe = targetArray.some(item => {
      if (tipo === 'secundaria') {
        return item['SECCION Secundaria'] === data.nombre && 
               item['SECCIÓN Principal'] === data.principal;
      }
      if (tipo === 'principal') {
        return item['SECCIÓN Principal'] === data.nombre &&
               item.CAPITULO === data.capitulo;
      }
      if (tipo === 'seccion') {
        return item.SECCION === data.nombre && 
               item.CAPITULO === data.capitulo;
      }
      return false;
    });

    if (existe) {
      return { duplicado: true, mensaje: `Ya existe una ${tipo} con ese nombre` };
    }
  }

  if (tipo === 'operacion') {
    const existe = targetArray.some(item => 
      item.OPERACIÓN === data.nombre &&
      item['SECCION Secundaria'] === data.secundaria &&
      item['SECCIÓN Principal'] === data.principal
    );

    if (existe) {
      return { duplicado: true, mensaje: `Ya existe una Operación con ese nombre en esa sección` };
    }
  }

  return { duplicado: false };
}

/**
 * Helper: Validar formato de cuenta
 */
function validarFormato(numero, moduleType) {
  if (moduleType === 'SUMMARY') {
    // SUMMARY: 21 dígitos consecutivos
    if (!/^\d{21}$/.test(numero)) {
      return { valido: false, mensaje: 'Formato incorrecto. Debe ser 21 dígitos consecutivos (ej: 401000000000000000001)' };
    }
  } else {
    // RESUMEN y MÓDULOS: XXX-XXX-XXX-XX
    if (!/^\d{3}-\d{3}-\d{3}-\d{2}$/.test(numero)) {
      return { valido: false, mensaje: 'Formato incorrecto. Debe ser XXX-XXX-XXX-XX (ej: 401-001-000-00)' };
    }
  }

  return { valido: true };
}

/**
 * POST /api/insercion/validar
 * Valida una inserción antes de ejecutarla
 */
router.post('/validar', requireAuth, async (req, res) => {
  try {
    const { tipo, context, formData, moduleType } = req.body;

    if (!tipo || !context || !formData || !moduleType) {
      return res.status(400).json({
        exito: false,
        mensaje: 'Faltan datos requeridos'
      });
    }

    const errors = [];
    const warnings = [];

    // 1. Validar jerarquía
    const jerarquiaErrors = validarJerarquia(tipo, context, moduleType);
    errors.push(...jerarquiaErrors);

    // 2. Cargar configuración y validar duplicados
    const config = await cargarJSON(moduleType);
    const duplicado = verificarDuplicado(tipo, formData, config, moduleType);
    if (duplicado.duplicado) {
      errors.push(duplicado.mensaje);
    }

    // 3. Validar formato de cuenta
    if (tipo === 'cuenta' && formData.numero) {
      const formato = validarFormato(formData.numero, moduleType);
      if (!formato.valido) {
        errors.push(formato.mensaje);
      }
    }

    // 4. Validar campos requeridos
    if (tipo === 'cuenta') {
      if (!formData.numero) errors.push('El número de cuenta es obligatorio');
      if (!formData.nombre) errors.push('El nombre de cuenta es obligatorio');
    } else {
      if (!formData.nombre) errors.push('El nombre es obligatorio');
      if (!formData.etiquetaSum) errors.push('La etiqueta de SUM ROW es obligatoria');
    }

    // 5. Advertencias
    if (tipo !== 'cuenta') {
      warnings.push('Se creará automáticamente un SUM ROW con la etiqueta especificada');
    }

    res.json({
      exito: true,
      valid: errors.length === 0,
      errors,
      warnings
    });

  } catch (error) {
    console.error('Error en /insercion/validar:', error);
    res.status(500).json({
      exito: false,
      mensaje: error.message
    });
  }
});

/**
 * POST /api/insercion/cuenta
 * Inserta una nueva cuenta
 */
router.post('/cuenta', requireAuth, async (req, res) => {
  try {
    const { moduleType, context, formData } = req.body;

    if (!moduleType || !context || !formData) {
      return res.status(400).json({
        exito: false,
        mensaje: 'Faltan datos requeridos'
      });
    }

    // Validar antes de insertar
    const jerarquiaErrors = validarJerarquia('cuenta', context, moduleType);
    if (jerarquiaErrors.length > 0) {
      return res.status(400).json({
        exito: false,
        mensaje: jerarquiaErrors.join(', ')
      });
    }

    // Validar formato
    const formato = validarFormato(formData.numero, moduleType);
    if (!formato.valido) {
      return res.status(400).json({
        exito: false,
        mensaje: formato.mensaje
      });
    }

    // Cargar configuración
    const config = await cargarJSON(moduleType);

    // Verificar duplicado
    const duplicado = verificarDuplicado('cuenta', formData, config, moduleType);
    if (duplicado.duplicado) {
      return res.status(400).json({
        exito: false,
        mensaje: duplicado.mensaje
      });
    }

    // Crear nueva cuenta según el módulo
    let nuevaCuenta;

    if (moduleType === 'SUMMARY') {
      nuevaCuenta = {
        "CAPITULO": context.capitulo || '',
        "SECCIÓN Principal": context.principal || '',
        "SECCION Secundaria": context.secundaria || '',
        "CUENTA": formData.numero,
        "NOMBRE": formData.nombre
      };

      if (!config.SUMMARY) config.SUMMARY = [];
      config.SUMMARY.push(nuevaCuenta);

    } else if (moduleType === 'RESUMEN') {
      nuevaCuenta = {
        "CAPITULO": context.capitulo || '',
        "SECCIÓN Principal": context.principal || '',
        "SECCION Secundaria": context.secundaria || '',
        "OPERACIÓN": context.operacion || '',
        "CUENTA": formData.numero,
        "NOMBRE": formData.nombre
      };

      if (!config.RESUMEN) config.RESUMEN = [];
      config.RESUMEN.push(nuevaCuenta);

    } else {
      // MÓDULOS
      nuevaCuenta = {
        "CAPITULO": context.capitulo || '',
        "SECCION": context.seccion || '',
        "CUENTA": formData.numero,
        "NOMBRE": formData.nombre
      };

      // Si hay operación, agregarla
      if (context.operacion) {
        nuevaCuenta.OPERACIÓN = context.operacion;
      }

      const moduleName = moduleType.replace('MODULOS_', '');
      if (!config[moduleName]) config[moduleName] = [];
      config[moduleName].push(nuevaCuenta);
    }

    // Guardar
    await guardarJSON(moduleType, config);

    res.json({
      exito: true,
      mensaje: 'Cuenta agregada exitosamente',
      cuenta: nuevaCuenta
    });

  } catch (error) {
    console.error('Error en /insercion/cuenta:', error);
    res.status(500).json({
      exito: false,
      mensaje: error.message
    });
  }
});

/**
 * POST /api/insercion/seccion
 * Inserta una nueva sección (principal, secundaria, o sección de módulo)
 */
router.post('/seccion', requireAuth, async (req, res) => {
  try {
    const { moduleType, tipo, context, formData } = req.body;

    if (!moduleType || !tipo || !context || !formData) {
      return res.status(400).json({
        exito: false,
        mensaje: 'Faltan datos requeridos'
      });
    }

    // Validar jerarquía
    const jerarquiaErrors = validarJerarquia(tipo, context, moduleType);
    if (jerarquiaErrors.length > 0) {
      return res.status(400).json({
        exito: false,
        mensaje: jerarquiaErrors.join(', ')
      });
    }

    // Cargar configuración
    const config = await cargarJSON(moduleType);

    // Verificar duplicado
    const duplicado = verificarDuplicado(tipo, { ...formData, ...context }, config, moduleType);
    if (duplicado.duplicado) {
      return res.status(400).json({
        exito: false,
        mensaje: duplicado.mensaje
      });
    }

    // Crear nueva sección con SUM ROW
    let nuevaSeccion;
    let sumRow;

    if (moduleType === 'SUMMARY') {
      if (tipo === 'principal') {
        nuevaSeccion = {
          "CAPITULO": context.capitulo || '',
          "SECCIÓN Principal": formData.nombre,
          "SECCION Secundaria": '',
          "CUENTA": '',
          "NOMBRE": formData.nombre,
          "ES_SECCION": true
        };

        sumRow = {
          "CAPITULO": context.capitulo || '',
          "SECCIÓN Principal": formData.nombre,
          "SECCION Secundaria": '',
          "CUENTA": 'SUM',
          "NOMBRE": formData.etiquetaSum,
          "ES_SUM_ROW": true
        };

      } else if (tipo === 'secundaria') {
        nuevaSeccion = {
          "CAPITULO": context.capitulo || '',
          "SECCIÓN Principal": context.principal || '',
          "SECCION Secundaria": formData.nombre,
          "CUENTA": '',
          "NOMBRE": formData.nombre,
          "ES_SECCION": true
        };

        sumRow = {
          "CAPITULO": context.capitulo || '',
          "SECCIÓN Principal": context.principal || '',
          "SECCION Secundaria": formData.nombre,
          "CUENTA": 'SUM',
          "NOMBRE": formData.etiquetaSum,
          "ES_SUM_ROW": true
        };
      }

      if (!config.SUMMARY) config.SUMMARY = [];
      config.SUMMARY.push(nuevaSeccion);
      config.SUMMARY.push(sumRow);

    } else if (moduleType === 'RESUMEN') {
      if (tipo === 'principal') {
        nuevaSeccion = {
          "CAPITULO": context.capitulo || '',
          "SECCIÓN Principal": formData.nombre,
          "SECCION Secundaria": '',
          "OPERACIÓN": '',
          "CUENTA": '',
          "NOMBRE": formData.nombre,
          "ES_SECCION": true
        };

        sumRow = {
          "CAPITULO": context.capitulo || '',
          "SECCIÓN Principal": formData.nombre,
          "SECCION Secundaria": '',
          "OPERACIÓN": '',
          "CUENTA": 'SUM',
          "NOMBRE": formData.etiquetaSum,
          "ES_SUM_ROW": true
        };

      } else if (tipo === 'secundaria') {
        nuevaSeccion = {
          "CAPITULO": context.capitulo || '',
          "SECCIÓN Principal": context.principal || '',
          "SECCION Secundaria": formData.nombre,
          "OPERACIÓN": '',
          "CUENTA": '',
          "NOMBRE": formData.nombre,
          "ES_SECCION": true
        };

        sumRow = {
          "CAPITULO": context.capitulo || '',
          "SECCIÓN Principal": context.principal || '',
          "SECCION Secundaria": formData.nombre,
          "OPERACIÓN": '',
          "CUENTA": 'SUM',
          "NOMBRE": formData.etiquetaSum,
          "ES_SUM_ROW": true
        };
      }

      if (!config.RESUMEN) config.RESUMEN = [];
      config.RESUMEN.push(nuevaSeccion);
      config.RESUMEN.push(sumRow);

    } else {
      // MÓDULOS
      nuevaSeccion = {
        "CAPITULO": context.capitulo || '',
        "SECCION": formData.nombre,
        "CUENTA": '',
        "NOMBRE": formData.nombre,
        "ES_SECCION": true
      };

      sumRow = {
        "CAPITULO": context.capitulo || '',
        "SECCION": formData.nombre,
        "CUENTA": 'SUM',
        "NOMBRE": formData.etiquetaSum,
        "ES_SUM_ROW": true
      };

      const moduleName = moduleType.replace('MODULOS_', '');
      if (!config[moduleName]) config[moduleName] = [];
      config[moduleName].push(nuevaSeccion);
      config[moduleName].push(sumRow);
    }

    // Guardar
    await guardarJSON(moduleType, config);

    res.json({
      exito: true,
      mensaje: 'Sección agregada exitosamente',
      seccion: nuevaSeccion,
      sumRow: sumRow
    });

  } catch (error) {
    console.error('Error en /insercion/seccion:', error);
    res.status(500).json({
      exito: false,
      mensaje: error.message
    });
  }
});

/**
 * POST /api/insercion/operacion
 * Inserta una nueva operación (solo RESUMEN y MÓDULOS)
 */
router.post('/operacion', requireAuth, async (req, res) => {
  try {
    const { moduleType, context, formData } = req.body;

    if (!moduleType || !context || !formData) {
      return res.status(400).json({
        exito: false,
        mensaje: 'Faltan datos requeridos'
      });
    }

    if (moduleType === 'SUMMARY') {
      return res.status(400).json({
        exito: false,
        mensaje: 'SUMMARY no soporta operaciones'
      });
    }

    // Validar jerarquía
    const jerarquiaErrors = validarJerarquia('operacion', context, moduleType);
    if (jerarquiaErrors.length > 0) {
      return res.status(400).json({
        exito: false,
        mensaje: jerarquiaErrors.join(', ')
      });
    }

    // Cargar configuración
    const config = await cargarJSON(moduleType);

    // Verificar duplicado
    const duplicado = verificarDuplicado('operacion', { ...formData, ...context }, config, moduleType);
    if (duplicado.duplicado) {
      return res.status(400).json({
        exito: false,
        mensaje: duplicado.mensaje
      });
    }

    // Crear nueva operación con SUM ROW
    let nuevaOperacion;
    let sumRow;

    if (moduleType === 'RESUMEN') {
      nuevaOperacion = {
        "CAPITULO": context.capitulo || '',
        "SECCIÓN Principal": context.principal || '',
        "SECCION Secundaria": context.secundaria || '',
        "OPERACIÓN": formData.nombre,
        "CUENTA": '',
        "NOMBRE": formData.nombre,
        "ES_OPERACION": true
      };

      sumRow = {
        "CAPITULO": context.capitulo || '',
        "SECCIÓN Principal": context.principal || '',
        "SECCION Secundaria": context.secundaria || '',
        "OPERACIÓN": formData.nombre,
        "CUENTA": 'SUM',
        "NOMBRE": formData.etiquetaSum,
        "ES_SUM_ROW": true
      };

      if (!config.RESUMEN) config.RESUMEN = [];
      config.RESUMEN.push(nuevaOperacion);
      config.RESUMEN.push(sumRow);

    } else {
      // MÓDULOS
      nuevaOperacion = {
        "CAPITULO": context.capitulo || '',
        "SECCION": context.seccion || '',
        "OPERACIÓN": formData.nombre,
        "CUENTA": '',
        "NOMBRE": formData.nombre,
        "ES_OPERACION": true
      };

      sumRow = {
        "CAPITULO": context.capitulo || '',
        "SECCION": context.seccion || '',
        "OPERACIÓN": formData.nombre,
        "CUENTA": 'SUM',
        "NOMBRE": formData.etiquetaSum,
        "ES_SUM_ROW": true
      };

      const moduleName = moduleType.replace('MODULOS_', '');
      if (!config[moduleName]) config[moduleName] = [];
      config[moduleName].push(nuevaOperacion);
      config[moduleName].push(sumRow);
    }

    // Guardar
    await guardarJSON(moduleType, config);

    res.json({
      exito: true,
      mensaje: 'Operación agregada exitosamente',
      operacion: nuevaOperacion,
      sumRow: sumRow
    });

  } catch (error) {
    console.error('Error en /insercion/operacion:', error);
    res.status(500).json({
      exito: false,
      mensaje: error.message
    });
  }
});

/**
 * GET /api/insercion/opciones/:nivel
 * Obtiene las opciones disponibles para un nivel jerárquico
 * Ejemplo: /api/insercion/opciones/principal?moduleType=SUMMARY&capitulo=CDMX
 */
router.get('/opciones/:nivel', requireAuth, async (req, res) => {
  try {
    const { nivel } = req.params;
    const { moduleType, capitulo, principal, secundaria } = req.query;

    if (!moduleType) {
      return res.status(400).json({
        exito: false,
        mensaje: 'Falta el parámetro moduleType'
      });
    }

    // Cargar configuración
    const config = await cargarJSON(moduleType);
    const data = config[moduleType] || [];

    let opciones = [];

    switch (nivel) {
      case 'capitulo':
        // Extraer capítulos únicos
        opciones = [...new Set(data.map(item => item.CAPITULO))].filter(Boolean);
        break;

      case 'principal':
        // Extraer principales únicos del capítulo
        opciones = [...new Set(
          data
            .filter(item => !capitulo || item.CAPITULO === capitulo)
            .map(item => item['SECCIÓN Principal'])
        )].filter(Boolean);
        break;

      case 'secundaria':
        // Extraer secundarias de una principal
        opciones = [...new Set(
          data
            .filter(item => 
              (!capitulo || item.CAPITULO === capitulo) &&
              (!principal || item['SECCIÓN Principal'] === principal)
            )
            .map(item => item['SECCION Secundaria'])
        )].filter(Boolean);
        break;

      case 'operacion':
        // Extraer operaciones de una secundaria
        opciones = [...new Set(
          data
            .filter(item => 
              (!capitulo || item.CAPITULO === capitulo) &&
              (!principal || item['SECCIÓN Principal'] === principal) &&
              (!secundaria || item['SECCION Secundaria'] === secundaria)
            )
            .map(item => item['OPERACIÓN'] || item.OPERACIÓN)
        )].filter(Boolean);
        break;

      case 'seccion':
        // Para módulos
        opciones = [...new Set(
          data
            .filter(item => !capitulo || item.CAPITULO === capitulo)
            .map(item => item.SECCION)
        )].filter(Boolean);
        break;

      default:
        return res.status(400).json({
          exito: false,
          mensaje: `Nivel desconocido: ${nivel}`
        });
    }

    res.json({
      exito: true,
      opciones: opciones.sort()
    });

  } catch (error) {
    console.error('Error en /insercion/opciones:', error);
    res.status(500).json({
      exito: false,
      mensaje: error.message
    });
  }
});

module.exports = router;
