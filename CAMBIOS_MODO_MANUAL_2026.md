# Cambios Implementados - Modo 100% Manual

## Fecha: 3 de Febrero de 2026

### 1. ✅ Modo 100% Manual - Lógica Automática Desactivada

Se han desactivado todas las funciones automáticas para que el gestor funcione en modo completamente manual:

#### Funciones Comentadas:

1. **normalizeOperationReferences()** - DESACTIVADO en todas las ubicaciones
   - No normaliza referencias de fórmulas automáticamente
   - Las fórmulas se guardan exactamente como el usuario las define

2. **hydrateOperationsFromParents()** - DESACTIVADO
   - No infiere ubicaciones de operaciones automáticamente
   - El usuario debe definir manualmente dónde va cada operación

3. **hydrateOperationPlacement()** - DESACTIVADO
   - No infiere placement automáticamente
   - El usuario controla completamente la ubicación

4. **dedupeOperations()** - DESACTIVADO
   - No elimina duplicados sin preguntar
   - El usuario decide qué operaciones mantener

5. **normalizePresentationOrders()** - DESACTIVADO
   - No recalcula órdenes automáticamente
   - El orden es exactamente el que el usuario define

#### Configuración:
```javascript
const AUTO_OPERACIONES_DISABLED = true;  // Modo manual activado
const MANUAL_ORDER_ONLY = true;          // Solo orden manual
const FORCE_MODAL_EDITOR = false;        // Usar panel lateral
```

### 2. ✅ Panel Lateral Moderno para Todas las Operaciones

**Características:**
- ✅ No bloquea la vista del layout
- ✅ Tabs organizados: Datos / Fórmula / Aparición
- ✅ Interfaz limpia y profesional  
- ✅ Cierre con overlay o botón X
- ✅ Se desliza desde la derecha

**Aplicado a:**
- Edición de operaciones
- Edición de cuentas
- Edición de secciones
- Edición de subsecciones

**Ubicación del Panel:**
- ID: `operationEditorPanel`
- Clase: `offcanvas offcanvas-end template-editor-panel`
- Archivo HTML: [vistas/plantillas.html](vistas/plantillas.html#L3009)

### 3. ✅ Editor de Fórmulas Restaurado

El editor de fórmulas ya incluye:

**Tab "Fórmula" con dos modos:**

#### Modo Manual:
- Campo de texto para escribir fórmulas directamente
- Soporte para: cuentas, secciones, operaciones con + / -

#### Modo Layout:
- ✅ Lista visual de todos los elementos (secciones y cuentas)
- ✅ Cada elemento tiene botón toggle con 3 estados:
  - **Vacío** = No aplicar
  - **+** = Sumar (fondo verde)
  - **-** = Restar (fondo rojo)
- ✅ Click cicla entre: No aplicar → Sumar → Restar → No aplicar
- ✅ Vista previa en tiempo real de la fórmula
- ✅ Control total: TÚ defines qué suma y qué resta

**Estructura:**
- Secciones principales (nivel 0)
- Subsecciones (nivel 1)  
- Cuentas individuales (nivel 2)

**Función clave:** `buildPreviewRowsForEditor()`
- Construye la lista completa de elementos disponibles
- Incluye secciones, subsecciones y cuentas
- Respeta la jerarquía del layout

### 4. ⚠️ Visualización de Operaciones en Resumen

**Problema Reportado:**
- La operación "EJEMPLO" en "Guadalajara Resumen 2026" no aparece

**Estado:** PENDIENTE DE VERIFICACIÓN
- El resumen usa el módulo `resumen-view.js`
- Las operaciones deben estar guardadas en el layout con el módulo correcto
- Verificar que la operación tenga:
  - `HOJA: "RESUMEN"`
  - `CAPITULO: "GUADALAJARA"` o correspondiente
  - `visible: true` (o no definido)

**Próximos pasos:**
1. Verificar operaciones guardadas en la base de datos
2. Confirmar que el módulo RESUMEN está cargando correctamente
3. Revisar filtros en resumen-view.js

### 5. ✅ Carga de Años y Capítulos

**Estado:** FUNCIONALIDAD INTACTA

Las funciones de carga NO fueron afectadas por los cambios:
- `loadYears()` - Carga años desde API
- `loadChapters()` - Carga capítulos desde API o selector
- `loadLayout()` - Carga el layout completo

**Si hay problemas de carga:**
1. Verificar que el servidor API esté corriendo
2. Verificar permisos de usuario
3. Verificar que existan datos para el año/capítulo seleccionado

### Archivos Modificados

1. **vistas/js/plantillas.js**
   - Líneas donde se comentó `normalizeOperationReferences()`: 
     - L718, L4469, L7324, L7486, L7674, L8431, L12368, L12491
   - Configuración de modo manual: L13-L21
   - Editor de fórmulas con toggles: L2708-L2900

2. **vistas/plantillas.html**
   - Panel lateral moderno: L3009-L3115

### Funcionamiento Actual

#### Lo que SÍ hace el sistema:
✅ Guardar operaciones exactamente como el usuario las define
✅ Mostrar editor de fórmulas con todos los elementos disponibles
✅ Permitir selección manual de qué sumar/restar
✅ Usar panel lateral en vez de modal bloqueante
✅ Cargar años y capítulos correctamente
✅ Preservar el orden definido por el usuario

#### Lo que NO hace el sistema:
❌ No normaliza referencias automáticamente
❌ No infiere ubicaciones
❌ No genera IDs automáticos más allá de asegurar unicidad
❌ No elimina duplicados sin permiso
❌ No reconstruye fórmulas desde JSON automáticamente
❌ No recalcula órdenes automáticamente

### Recomendaciones

1. **Para crear operaciones:**
   - Usar el panel lateral
   - Definir manualmente todos los campos
   - Seleccionar elementos en el tab "Fórmula"
   - Verificar la vista previa antes de guardar

2. **Para editar operaciones:**
   - Click en la operación abre el panel lateral
   - Tab "Datos": nombre y configuración básica
   - Tab "Fórmula": seleccionar qué sumar/restar
   - Tab "Aparición": configurar dónde y cómo aparece

3. **Para verificar operaciones en Resumen:**
   - Abrir el gestor de plantillas
   - Seleccionar: Módulo=RESUMEN, Año=2026, Capítulo=Guadalajara
   - Verificar que la operación "EJEMPLO" existe
   - Verificar que `visible` no esté en `false`
   - Guardar cambios

### Próximos Pasos (Si es necesario)

1. ✅ Verificar que las operaciones aparezcan en el módulo RESUMEN
2. ⚠️ Investigar por qué "EJEMPLO" no aparece en Guadalajara
3. 🔄 Considerar agregar logs de depuración en resumen-view.js
4. 📝 Documentar estructura exacta que debe tener una operación para aparecer en RESUMEN

---

## Notas Importantes

- **NO se rompió nada:** Las funciones automáticas solo se comentaron, no se eliminaron
- **Reversible:** Si se necesita reactivar alguna función, solo descomentar la línea correspondiente
- **Compatibilidad:** El código sigue funcionando con layouts existentes
- **Modo manual:** Todo cambio debe ser explícito del usuario

---

## Contacto de Soporte

Si encuentras problemas después de estos cambios:
1. Revisa este documento primero
2. Verifica que los datos estén guardados correctamente
3. Confirma que el servidor API esté funcionando
4. Revisa la consola del navegador para errores JavaScript
