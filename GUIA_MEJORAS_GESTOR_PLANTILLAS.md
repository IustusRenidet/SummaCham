# 🎯 Mejoras al Gestor de Plantillas - Guía de Uso

## 📋 Resumen de Mejoras Implementadas

Se han agregado funcionalidades avanzadas al gestor de plantillas para mayor control y flexibilidad en la gestión de layouts por módulo, capítulo y ejercicio.

---

## ✨ Nuevas Funcionalidades

### 1. **Constructor de Fórmulas Avanzado**

#### Operadores Matemáticos Completos
- ✅ **Suma (+)**: Agregar valores
- ✅ **Resta (−)**: Substraer valores
- ✅ **Multiplicación (×)**: Multiplicar valores
- ✅ **División (÷)**: Dividir valores

#### Tipos de Términos
- **Sección**: Referencias a secciones principales o secundarias
- **Cuenta**: Referencias específicas a cuentas contables
- **Operación**: Referencias a otras operaciones (cálculos anidados)
- **Número fijo**: Constantes numéricas para ajustes

#### Cómo Usar el Constructor
1. **Editar una operación** existente o crear una nueva
2. En el modal de edición, verás el **"Constructor de Fórmula"**
3. Para cada término:
   - Selecciona el **operador** (+, −, ×, ÷)
   - Elige el **tipo** (Sección, Cuenta, Operación, Número fijo)
   - Selecciona el **valor** del dropdown correspondiente
4. Usa los botones:
   - **"Agregar término"**: Añade un nuevo término a la fórmula
   - **"Sugerir desde nombre"**: Auto-detecta términos basados en el nombre de la operación
   - **"Ver mapa visual"**: Muestra un diagrama visual de la fórmula

#### Ejemplo de Fórmula
```
TOTAL CONSOLIDADO = 
  + INCOME CDMX 
  + INCOME GUADALAJARA 
  - EXPENSES OPERATIONS 
  × 1.16
```

---

### 2. **Controles de Visibilidad y Orden**

#### Control de Visibilidad 👁️
Cada cuenta y operación tiene un checkbox de visibilidad:
- **✓ Marcado** (Ojo abierto): La fila es visible en las tablas
- **☐ Desmarcado** (Ojo cerrado): La fila está oculta pero se mantiene en el layout

**Usos prácticos:**
- Ocultar cuentas temporalmente sin eliminarlas
- Mantener operaciones de respaldo sin mostrarlas
- Crear versiones alternativas del reporte

#### Control de Orden 🔢
Cada elemento tiene controles de reordenamiento:
- **Campo numérico**: Orden de presentación exacto
- **Botón ↑**: Mover hacia arriba
- **Botón ↓**: Mover hacia abajo

**Usos prácticos:**
- Ordenar cuentas por importancia sin cambiar códigos
- Agrupar operaciones relacionadas
- Personalizar la secuencia de presentación

---

### 3. **Vista Previa Realista**

#### Características
- 📊 **Tabla completa** con formato real
- 💰 **Datos de ejemplo** generados automáticamente
- 👁️ **Toggle para ver/ocultar** elementos ocultos
- 📈 **Múltiples meses** configurables

#### Controles de Vista Previa
- **☐ Mostrar ocultos**: Incluye filas marcadas como no visibles
- **☐ Datos de ejemplo**: Genera valores de prueba realistas

#### Cómo Acceder
1. Click en **botón "Vista Previa"** (ícono de ojo)
2. La vista muestra exactamente cómo se verá la tabla en producción
3. Elementos ocultos aparecen con icono 🔒 si el toggle está activado

---

### 4. **Sistema de Verificación Automática**

#### Verificación de Integridad
El botón **"Verificar" (⚙️)** analiza:
- ✅ Referencias a secciones que ya no existen
- ✅ Cuentas eliminadas pero aún referenciadas
- ✅ Operaciones que referencian otras operaciones eliminadas
- ✅ Fórmulas incompletas o con errores

#### Auto-Reparación
Cuando se detectan problemas:
1. El sistema **sugiere correcciones automáticas**
2. Botón **"Auto-reparar"** aplica las correcciones
3. Se muestra un resumen de cambios aplicados

#### Ejemplos de Reparaciones
- **Sección eliminada**: Se busca una sección similar o se elimina el término
- **Cuenta eliminada**: Se busca código similar o se elimina
- **Operación eliminada**: Se elimina la referencia

---

### 5. **Mapa Visual de Operaciones**

#### ¿Qué muestra?
- 🔵 **Diagrama visual** de cada término de la fórmula
- 🎨 **Colores por operador**: Verde (suma), Rojo (resta), Amarillo (multiplicación), Azul (división)
- 📋 **Lista secuencial** de todos los elementos
- 📝 **Fórmula resultante** en texto

#### Cómo Acceder
1. Editar una operación
2. Click en **"Ver mapa visual"** dentro del Constructor de Fórmula
3. Se abre un modal con el diagrama completo

---

## 🗄️ Estructura de Base de Datos

### Nuevos Campos Agregados

#### Tabla `layout_cuentas`
```sql
visible INTEGER DEFAULT 1              -- 1=visible, 0=oculta
orden_presentacion INTEGER             -- Orden de aparición en tabla
```

#### Tabla `layout_operaciones`
```sql
visible INTEGER DEFAULT 1              -- 1=visible, 0=oculta
orden_presentacion INTEGER             -- Orden de aparición en tabla
formula_json TEXT                      -- Fórmula completa en JSON
```

### Formato de `formula_json`
```json
[
  {
    "id": 1672531200000,
    "operator": "+",
    "type": "section",
    "value": "INCOME",
    "constant": null
  },
  {
    "id": 1672531200001,
    "operator": "-",
    "type": "account",
    "value": "601-001-000-00",
    "constant": null
  },
  {
    "id": 1672531200002,
    "operator": "*",
    "type": "constant",
    "value": "",
    "constant": 1.16
  }
]
```

---

## 📝 Flujo de Trabajo Recomendado

### Crear un Layout Nuevo
1. Seleccionar **Módulo, Año y Capítulo**
2. Click en **"Cargar"**
3. Si no existe, usar **"Crear Layout Demo"** o **"Copiar de Otro Año"**
4. Agregar secciones, cuentas y operaciones
5. Configurar visibilidad y orden
6. Usar **"Vista Previa"** para verificar
7. **"Guardar"** cambios

### Editar Operaciones Existentes
1. Click en operación a editar
2. Usar **Constructor de Fórmula** para modificar términos
3. Agregar/eliminar términos según necesidad
4. Click **"Ver mapa visual"** para confirmar
5. Ajustar visibilidad y orden
6. **"Confirmar"** y **"Guardar"**

### Mantenimiento Preventivo
1. Ejecutar **"Verificar"** regularmente
2. Revisar reporte de problemas
3. Usar **"Auto-reparar"** para correcciones rápidas
4. Revisar cambios sugeridos antes de guardar

---

## 🎨 Atajos y Tips

### Atajos de Teclado
- **Ctrl + S**: Guardar layout (si está habilitado)
- **Esc**: Cerrar modal activo
- **Tab**: Navegar entre campos del constructor

### Tips de Productividad
1. **Sugerir desde nombre**: Usa nombres descriptivos en operaciones para auto-sugerencias precisas
   - ✅ "INCOME CDMX TOTAL" → detecta subsecciones INCOME de CDMX
   - ❌ "OP1" → no detecta nada

2. **Visibilidad temporal**: En lugar de eliminar, oculta elementos que podrías necesitar después

3. **Orden flexible**: Usa números con espacios (10, 20, 30) para facilitar inserciones futuras

4. **Vista previa frecuente**: Verifica cambios antes de guardar para evitar sorpresas

5. **Verificación automática**: Ejecuta después de cambios grandes (eliminar secciones, reorganizar)

---

## ⚠️ Consideraciones Importantes

### Compatibilidad
- ✅ Los nuevos campos son **opcionales**
- ✅ Layouts antiguos **funcionan sin cambios**
- ✅ El formato legacy se **mantiene por compatibilidad**

### Permisos
- El sistema respeta permisos por capítulo
- Usuarios sin permisos ven modo **solo lectura**
- Administradores globales tienen **acceso completo**

### Rendimiento
- Layouts grandes pueden tardar en cargar
- Use filtros de búsqueda para navegación rápida
- La verificación automática analiza todo el layout

---

## 🐛 Solución de Problemas

### "No se puede guardar"
- Verifica que tengas **permisos de edición**
- Confirma que el **estado de autenticación** esté activo
- Revisa que **no haya errores** en fórmulas

### "Fórmula incompleta"
- Todos los términos deben tener **valor seleccionado**
- Verifica que **secciones/cuentas existan**
- Usa **"Ver mapa visual"** para identificar vacíos

### "Error al cargar layout"
- Verifica **conexión al servidor**
- Confirma que **año y capítulo** existan
- Revisa logs del servidor para más detalles

### "Vista previa no funciona"
- Asegúrate de que **layout-controls.js** esté cargado
- Verifica en consola del navegador (F12)
- Recarga la página si es necesario

---

## 📚 Recursos Adicionales

### Archivos Creados
- `vistas/js/formula-builder.js` - Constructor de fórmulas
- `vistas/js/layout-controls.js` - Controles de visibilidad/orden
- `vistas/js/operation-sync.js` - Sistema de verificación
- `vistas/css/formula-builder.css` - Estilos nuevos

### Migraciones de Base de Datos
Las migraciones se aplican **automáticamente** al iniciar la aplicación.
No requiere acción manual.

---

## 💡 Casos de Uso Ejemplo

### Caso 1: Operación Compleja Multi-Capítulo
```
CONSOLIDATED NET RESULT = 
  + CDMX INCOME          (sección)
  + GDL INCOME           (sección)
  - OPERATING EXPENSES   (operación)
  - 601-050-000-00       (cuenta específica)
  * 0.85                 (factor de ajuste)
```

### Caso 2: Layout con Versiones Alternativas
- Mantener cuenta "401-001-000-00" **visible**
- Mantener cuenta alternativa "401-002-000-00" **oculta**
- Al necesitar cambio, intercambiar visibilidad
- Sin perder configuración ni datos

### Caso 3: Reorganización por Importancia
1. Operaciones críticas: orden 10-20
2. Operaciones secundarias: orden 30-50
3. Operaciones de respaldo: orden 90+ y **ocultas**

---

¿Necesitas más información sobre alguna funcionalidad específica? Consulta el código fuente o contacta al equipo de desarrollo.
