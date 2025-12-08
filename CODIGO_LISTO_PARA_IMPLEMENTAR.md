# SOLUCIONES IMPLEMENTABLES - CÓDIGO LISTO PARA USAR

## 🔧 ARCHIVO 1: Agregar Endpoint `/api/borradores/estado`

### Ubicación: `src/routes/borradores.js`
### Agregar después de `router.use(requireAuth);` (línea 31)

```javascript
/**
 * GET /api/borradores/estado
 * Obtiene el estado actual del borrador para una empresa/módulo/año
 * 
 * Query params:
 * - empresaId: string (requerido)
 * - modulo: string (requerido)
 * - anio: number (requerido)
 * 
 * Response: { borrador: {}, estado: string } o { borrador: null, estado: 'sin-cargar' }
 */
router.get('/estado', (req, res) => {
  const { empresaId, modulo, anio } = req.query;
  
  // Validar parámetros
  if (!empresaId || !modulo || !anio) {
    return res.status(400).json({
      mensaje: 'Faltan parámetros: empresaId, modulo, anio'
    });
  }

  // Validar empresa
  const empresa = obtenerEmpresaPorId(empresaId);
  if (!empresa) {
    return res.status(404).json({ 
      mensaje: 'Empresa no encontrada.' 
    });
  }

  // Validar y normalizar módulo
  const moduloCanonico = obtenerModuloCanonico(modulo);
  if (!moduloCanonico) {
    return res.status(400).json({ 
      mensaje: 'El módulo indicado no es válido.' 
    });
  }

  // Obtener el borrador actual para ese contexto
  const borrador = obtenerBorrador({
    empresaId: empresa.id,
    modulo: moduloCanonico,
    anio: Number(anio)
  });

  // Si no hay borrador, devolver estado 'sin-cargar'
  if (!borrador) {
    return res.json({
      borrador: null,
      estado: 'sin-cargar'
    });
  }

  // Verificar si el usuario actual puede ver este borrador
  if (!puedeVerBorrador(req, borrador)) {
    return res.status(403).json({
      mensaje: 'No tienes permisos para ver este borrador.'
    });
  }

  // Devolver el borrador (sin datos completos para evitar transferencias grandes)
  return res.json({
    borrador: mapearResumen(borrador),
    estado: borrador.estado
  });
});
```

---

## 🎨 ARCHIVO 2: Script de Modo Edición

### Ubicación: `vistas/js/modo-edicion-presupuesto.js` (CREAR NUEVO)

```javascript
/**
 * Módulo: Modo Edición de Presupuestos
 * 
 * Transforma una tabla estática en editable con:
 * - Celdas clickeables
 * - Captura de cambios
 * - Validación de números
 * - Autocompletado de cuentas
 */

(function() {
  const MESES = [
    { id: 'budget-ene', label: 'ENE', numero: 1 },
    { id: 'budget-feb', label: 'FEB', numero: 2 },
    { id: 'budget-mar', label: 'MAR', numero: 3 },
    { id: 'budget-abr', label: 'ABR', numero: 4 },
    { id: 'budget-may', label: 'MAY', numero: 5 },
    { id: 'budget-jun', label: 'JUN', numero: 6 },
    { id: 'budget-jul', label: 'JUL', numero: 7 },
    { id: 'budget-ago', label: 'AGO', numero: 8 },
    { id: 'budget-sep', label: 'SEP', numero: 9 },
    { id: 'budget-oct', label: 'OCT', numero: 10 },
    { id: 'budget-nov', label: 'NOV', numero: 11 },
    { id: 'budget-dic', label: 'DIC', numero: 12 }
  ];

  const SELECTOR_TABLA = '#tablaComparacion';
  const CLASE_EDITABLE = 'editable-cell';
  const CLASE_EDITANDO = 'cell-editing';
  const CLASE_MODIFICADO = 'cell-modified';

  // Estado global del módulo
  const estado = {
    modoEdicionActivo: false,
    cambiosCapturados: {},
    cuentasDisponibles: []
  };

  /**
   * Inicializar celdas de presupuesto como editables
   */
  function inicializarCeldasEditables(tabla) {
    if (!tabla) return;

    // Buscar todas las celdas de presupuesto
    const celdas = tabla.querySelectorAll('td[data-mes]');
    
    celdas.forEach((celda) => {
      celda.classList.add(CLASE_EDITABLE);
      celda.style.cursor = 'pointer';
      
      celda.addEventListener('click', (evento) => {
        evento.stopPropagation();
        if (estado.modoEdicionActivo) {
          activarEdicionEnCelda(celda);
        }
      });

      // Detectar cambios directamente (por si el código carga datos vía JS)
      celda.addEventListener('change', () => {
        marcarComoModificado(celda);
      });
    });
  }

  /**
   * Activar modo edición en una celda específica
   */
  function activarEdicionEnCelda(celda) {
    // Si ya está editando, ignorar
    if (celda.classList.contains(CLASE_EDITANDO)) return;

    const valor = celda.textContent.trim();
    const numero = parseFloat(valor) || 0;
    
    // Crear input
    const input = document.createElement('input');
    input.type = 'number';
    input.value = numero;
    input.className = 'edit-input';
    input.step = '0.01';
    input.min = '0';
    
    // Reemplazar contenido
    celda.textContent = '';
    celda.appendChild(input);
    celda.classList.add(CLASE_EDITANDO);
    
    // Auto-focus y select
    input.focus();
    input.select();

    /**
     * Guardar cambio
     */
    const guardarCambio = () => {
      const nuevoValor = parseFloat(input.value) || 0;
      celda.textContent = nuevoValor.toFixed(2);
      celda.classList.remove(CLASE_EDITANDO);
      
      // Si cambió el valor, marcar como modificado
      if (nuevoValor !== numero) {
        marcarComoModificado(celda);
        capturarCambio(celda, nuevoValor);
      }
    };

    /**
     * Cancelar edición (ESC)
     */
    const cancelarEdicion = () => {
      celda.textContent = valor;
      celda.classList.remove(CLASE_EDITANDO);
    };

    // Event listeners
    input.addEventListener('blur', guardarCambio);
    input.addEventListener('keydown', (evento) => {
      if (evento.key === 'Enter') guardarCambio();
      if (evento.key === 'Escape') cancelarEdicion();
    });
  }

  /**
   * Marcar celda como modificada
   */
  function marcarComoModificado(celda) {
    celda.classList.add(CLASE_MODIFICADO);
    
    // Cambiar color de fondo para visual feedback
    if (!celda.style.backgroundColor) {
      celda.style.backgroundColor = '#ffffcc'; // Amarillo claro
    }
  }

  /**
   * Capturar cambio de una celda
   */
  function capturarCambio(celda, nuevoValor) {
    const fila = celda.closest('tr');
    if (!fila) return;

    const cuenta = fila.dataset.cuenta || fila.querySelector('[data-cuenta]')?.dataset.cuenta;
    const mes = celda.dataset.mes;

    if (!cuenta || !mes) return;

    // Crear estructura de cambios si no existe
    if (!estado.cambiosCapturados[cuenta]) {
      estado.cambiosCapturados[cuenta] = {
        cuenta,
        valores: {}
      };
    }

    estado.cambiosCapturados[cuenta].valores[mes] = nuevoValor;
  }

  /**
   * Obtener todos los cambios capturados
   */
  function obtenerTodosCambios() {
    const presupuesto = Object.values(estado.cambiosCapturados);
    return { presupuesto };
  }

  /**
   * Limpiar cambios capturados
   */
  function limpiarCambios() {
    estado.cambiosCapturados = {};
    
    // Remover estilos de modificado
    const tabla = document.querySelector(SELECTOR_TABLA);
    if (tabla) {
      tabla.querySelectorAll(`.${CLASE_MODIFICADO}`).forEach((celda) => {
        celda.classList.remove(CLASE_MODIFICADO);
        celda.style.backgroundColor = '';
      });
    }
  }

  /**
   * Activar modo edición global
   */
  function activarModoEdicion(tabla) {
    if (!tabla) return;
    
    estado.modoEdicionActivo = true;
    tabla.classList.add('modo-edicion-activo');
    
    // Mostrar hint visual
    const celdas = tabla.querySelectorAll(`.${CLASE_EDITABLE}`);
    celdas.forEach((celda) => {
      celda.style.cursor = 'pointer';
      celda.title = 'Click para editar';
    });
  }

  /**
   * Desactivar modo edición global
   */
  function desactivarModoEdicion(tabla) {
    if (!tabla) return;
    
    estado.modoEdicionActivo = false;
    tabla.classList.remove('modo-edicion-activo');
    
    // Limpiar cualquier edición en curso
    const editando = tabla.querySelector(`.${CLASE_EDITANDO}`);
    if (editando) {
      editando.textContent = editando.querySelector('input')?.value || '';
      editando.classList.remove(CLASE_EDITANDO);
    }
  }

  /**
   * API Pública
   */
  window.ModoEdicionPresupuesto = {
    /**
     * Inicializar el módulo
     */
    inicializar: function(selectorTabla) {
      const tabla = document.querySelector(selectorTabla);
      if (!tabla) {
        console.error(`No se encontró tabla en selector: ${selectorTabla}`);
        return false;
      }

      inicializarCeldasEditables(tabla);
      console.log('✅ Modo edición inicializado');
      return true;
    },

    /**
     * Activar modo edición
     */
    activar: function(selectorTabla) {
      const tabla = document.querySelector(selectorTabla);
      if (!tabla) return false;
      
      activarModoEdicion(tabla);
      console.log('✅ Modo edición ACTIVADO');
      return true;
    },

    /**
     * Desactivar modo edición
     */
    desactivar: function(selectorTabla) {
      const tabla = document.querySelector(selectorTabla);
      if (!tabla) return false;
      
      desactivarModoEdicion(tabla);
      console.log('✅ Modo edición DESACTIVADO');
      return true;
    },

    /**
     * Obtener cambios capturados
     */
    obtenerCambios: function() {
      return obtenerTodosCambios();
    },

    /**
     * Limpiar cambios
     */
    limpiar: function() {
      limpiarCambios();
      console.log('✅ Cambios limpiados');
    }
  };
})();
```

---

## 🔌 ARCHIVO 3: Integración en SUMMARY.html

### Ubicación: `vistas/SUMMARY.html`
### Agregar en la sección `<head>` (después de los otros scripts):

```html
<!-- Script de Modo Edición -->
<script src="js/modo-edicion-presupuesto.js"></script>
```

### Agregar en la sección al final del `<body>` (después de que carguen otros scripts):

```html
<script>
  // Inicializar después de que el DOM y otros scripts estén listos
  document.addEventListener('DOMContentLoaded', () => {
    // Esperar un poco para que el módulo SUMMARY cargue sus datos
    setTimeout(() => {
      // 1. Inicializar el módulo de edición
      const inicioOK = ModoEdicionPresupuesto.inicializar('#tablaComparacion');
      
      if (!inicioOK) {
        console.warn('⚠️ No se pudo inicializar modo edición (tabla no encontrada)');
        return;
      }

      // 2. Inicializar el flujo de autorización CON callbacks
      const flujo = new FlujoAutorizacion({
        tablaId: 'tablaComparacion',
        modulo: 'PRESUPUESTOS',
        
        // ✅ CALLBACK CRÍTICO: Extraer cambios de la tabla
        obtenerCambios: () => {
          return ModoEdicionPresupuesto.obtenerCambios();
        },
        
        // Headers de autenticación
        obtenerHeaders: () => {
          return Sesion.headersAutenticacion?.() || {};
        },
        
        // Callback cuando se cancela la edición
        onCancelEdit: () => {
          ModoEdicionPresupuesto.desactivar('#tablaComparacion');
          ModoEdicionPresupuesto.limpiar();
        }
      }).init();

      // 3. Guardar referencia global para debugging
      window.flujoAutorizacionActual = flujo;
      
      console.log('✅ Flujo de autorización inicializado con callbacks');
    }, 500);
  });
</script>
```

---

## 🛡️ ARCHIVO 4: Mejoras en Validación (Firebird)

### Ubicación: `src/services/borradoresService.js`
### Modificar función `persistirEnFirebird` (línea ~325)

```javascript
const persistirEnFirebird = async (borrador) => {
  // 1. Guardar registro en SQLite (para historial)
  registrarPresupuestoGuardado({
    empresaId: borrador.empresaId,
    modulo: borrador.modulo,
    anio: borrador.anio,
    datos: borrador.data,
    guardadoPor: Number(borrador.usuarioId) || null
  });

  // 2. Guardar en Firebird PRESUP table
  const { ejecutarConsulta } = require('./firebirdService');
  
  let datos;
  try {
    datos = typeof borrador.data === 'string' 
      ? JSON.parse(borrador.data) 
      : borrador.data;
  } catch (parseError) {
    console.error('Error parsing borrador data:', parseError);
    throw new Error('Los datos del borrador están corruptos.');
  }

  const presupuesto = Array.isArray(datos?.presupuesto) ? datos.presupuesto : [];
  
  // ✅ MEJORA: Validar que hay datos antes de proceder
  if (!presupuesto || presupuesto.length === 0) {
    console.warn(`⚠️ Borrador ${borrador.id} sin datos presupuestarios`);
    // No lanzar error - permitir guardar estado como GUARDADO
    // pero registrar en logs para auditoría
    return;
  }

  // ✅ MEJORA: Validar que hay valores numéricos
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
  const sufijo = anio.toString().slice(-2).padStart(2, '0');
  const tablaPresup = `PRESUP${sufijo}`;

  // Mapeo de claves a columnas PRESUP01-PRESUP12
  const MESES_COLUMNAS = {
    'budget-ene': 'PRESUP01', 'budget-feb': 'PRESUP02', 'budget-mar': 'PRESUP03',
    'budget-abr': 'PRESUP04', 'budget-may': 'PRESUP05', 'budget-jun': 'PRESUP06',
    'budget-jul': 'PRESUP07', 'budget-ago': 'PRESUP08', 'budget-sep': 'PRESUP09',
    'budget-oct': 'PRESUP10', 'budget-nov': 'PRESUP11', 'budget-dic': 'PRESUP12'
  };

  // ✅ MEJORA: Registrar intent de guardar
  console.log(
    `📝 Guardando ${presupuesto.length} cuentas en Firebird table ${tablaPresup} ` +
    `para empresa ${borrador.empresaId}, módulo ${borrador.modulo}`
  );

  // Procesar cada cuenta
  let contadorExitosas = 0;
  let contadorErrores = 0;

  for (const cambio of presupuesto) {
    const cuenta = (cambio.cuenta || '').toString().trim();
    const valores = cambio.valores || {};

    if (!cuenta) {
      console.warn(`⚠️ Cambio sin cuenta, ignorando`);
      contadorErrores++;
      continue;
    }

    const columnasVariables = [];
    const valoresVariables = [];

    Object.entries(valores).forEach(([clave, valor]) => {
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

    const columnas = ['NUM_CTA', 'EJERCICIO', ...columnasVariables];
    const parametros = [cuenta, anio, ...valoresVariables];
    const placeholders = columnas.map(() => '?').join(', ');

    const upsertQuery = `
      UPDATE OR INSERT INTO ${tablaPresup} (${columnas.join(', ')})
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
      // No lanzar - continuar con otras cuentas
    }
  }

  console.log(
    `✅ Persistencia completada: ${contadorExitosas} exitosas, ${contadorErrores} errores`
  );
};
```

---

## 📋 CHECKLIST DE IMPLEMENTACIÓN

```
PASO 1: Agregar Endpoint
☐ Copiar código del Endpoint GET /borradores/estado
☐ Pegarlo en src/routes/borradores.js después de router.use(requireAuth)
☐ Verificar que funciona: curl http://localhost:3000/api/borradores/estado?empresaId=E1&modulo=PRESUPUESTOS&anio=2025

PASO 2: Crear Script de Edición
☐ Crear archivo vistas/js/modo-edicion-presupuesto.js
☐ Copiar código del módulo ModoEdicionPresupuesto
☐ Verificar que NO hay errores en consola

PASO 3: Integrar en SUMMARY.html
☐ Agregar <script src="js/modo-edicion-presupuesto.js"></script> en <head>
☐ Agregar script de inicialización al final del <body>
☐ Recargar página y verificar que tabla es clickeable

PASO 4: Mejorar Validación Firebird
☐ Actualizar función persistirEnFirebird en borradoresService.js
☐ Agregar logs descriptivos
☐ Probar flujo completo

PASO 5: Testing Manual
☐ Usuario normal: Cargar → Editar → Enviar → Revisar → Autorizar → Guardar
☐ Verificar en Firebird que datos llegaron correctamente
☐ Admin: Cargar → Enviar (auto-aprueba) → Guardar
☐ Verificar que cambios no se pierden si se recarga página
```

---

## 🆘 Troubleshooting

### Problema: "ModoEdicionPresupuesto no está definido"
**Solución:** Verificar que `modo-edicion-presupuesto.js` esté cargado ANTES del script que lo usa. Revisar la sección de scripts en SUMMARY.html.

### Problema: Las celdas no son clickeables
**Solución:** 
1. Verificar que tabla tiene ID `tablaComparacion`
2. Verificar que celdas tienen atributo `data-mes`
3. Verificar que `ModoEdicionPresupuesto.inicializar()` fue llamado
4. Abrir DevTools → Console, ejecutar: `ModoEdicionPresupuesto.obtenerCambios()`

### Problema: Los cambios no se guardan
**Solución:**
1. En DevTools → Network, ver si POST a `/api/borradores/guardar` llega
2. Verificar el payload que se envía
3. Verificar que callback `obtenerCambios()` devuelve datos válidos
4. Ejecutar en console: `window.flujoAutorizacionActual.borradorActual`

### Problema: Datos no llegan a Firebird
**Solución:**
1. Verificar logs del servidor: ¿Se ejecuta `persistirEnFirebird`?
2. Verificar estructura de `borrador.data` es JSON válido
3. Verificar que tabla Firebird `PRESUP25` existe (o la correcta para el año)
4. Verificar credenciales de Firebird en `.env`

---

¿Necesitas ayuda implementando alguno de estos pasos?
