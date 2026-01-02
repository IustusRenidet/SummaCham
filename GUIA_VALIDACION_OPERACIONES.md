# Guía de Validación de Operaciones

## 🎯 Objetivo

Validar que las operaciones consolidadas (como "CONSOLIDATED INCOME") se pueblan correctamente con todas las secciones correspondientes de diferentes capítulos.

---

## 📋 Cómo Validar

### Método 1: Botón de Diagnóstico (Recomendado)

1. **Abrir el gestor de plantillas**
   - Ir a: `http://localhost:3000/plantillas.html`

2. **Cargar un layout que tenga operaciones consolidadas**
   - Módulo: `SUMMARY`
   - Año: `2022` (o cualquier año disponible)
   - Capítulo: `Resumen Ciudad de México` (o el resumen principal)
   - Click en **"Cargar Layout"**

3. **Usar el botón de Diagnóstico**
   - Click en el botón **"🐛 Diagnosticar"** en la barra de herramientas
   - Se abrirá un modal con todas las operaciones consolidadas detectadas

4. **Revisar el reporte**
   - Cada operación muestra:
     - ✅ Estado: Válida / ⚠️ Requiere Atención
     - Número de términos detectados
     - Fórmula construida
   - Click en **"Ver Detalle"** para inspección completa

### Método 2: Consola del Navegador

1. **Abrir DevTools**
   - Presionar `F12` o `Ctrl+Shift+I`
   - Ir a la pestaña **Console**

2. **Ejecutar comandos de diagnóstico**

```javascript
// Ver todas las operaciones consolidadas
showConsolidatedOperations()

// Ver una operación específica
debugOperation('CONSOLIDATED INCOME')

// Analizar programáticamente
const analysis = OperationDebugger.analyzeOperation('CONSOLIDATED INCOME')
console.log(analysis)
```

---

## 🔍 Qué Verificar en "CONSOLIDATED INCOME"

### Ejemplo Esperado: SUMMARY - Resumen Ciudad de México

```
CONSOLIDATED INCOME debe sumar:
  + Income (CDMX)
  + Income (Guadalajara)
  + Income (Monterrey)
  + Income (Northwest)
```

### Validación

El diagnóstico debe mostrar:

```
✅ Estado: Válida
📊 Términos: 4
🧮 Fórmula: + Income (CDMX) + Income (Guadalajara) + Income (Monterrey) + Income (Northwest)
```

### Términos Esperados

| # | Operador | Tipo | Valor | Estado |
|---|----------|------|-------|--------|
| 1 | + | section | Income (CDMX) | ✓ |
| 2 | + | section | Income (Guadalajara) | ✓ |
| 3 | + | section | Income (Monterrey) | ✓ |
| 4 | + | section | Income (Northwest) | ✓ |

---

## 🛠️ Reparación Automática

Si una operación muestra **⚠️ Requiere Atención**:

1. **Desde el modal de diagnóstico**
   - Click en **"🔧 Intentar Reparar"**
   - El sistema reconstruirá automáticamente los términos

2. **Guardar cambios**
   - Después de reparar, click en **"💾 Guardar"**
   - Esto persistirá las correcciones en la base de datos

---

## 📊 Interpretación de Resultados

### ✅ Operación Válida

```
Estado: Válida
Términos: 4
Construido desde: SECCION (auto-construido)
```

**Significado:** La operación tiene todos los términos correctos y referencias válidas.

### ⚠️ Operación con Problemas

```
Estado: Requiere Atención
Términos: 2
Problemas:
  - Término 3: Sección "Income (Querétaro)" no encontrada
  - Término 4: sin valor definido
```

**Acciones:**
- Verificar que las secciones referenciadas existen
- Usar **"Intentar Reparar"** para reconstruir automáticamente
- Revisar la configuración del layout

### ⚙️ Operación Sin Términos

```
Estado: Requiere Atención
Términos: 0
Problemas:
  - No se encontraron términos de fórmula
```

**Acciones:**
- La operación necesita ser configurada
- Usar **FormulaBuilder** para definir manualmente
- O usar **"Intentar Reparar"** para auto-construcción

---

## 🧪 Casos de Prueba

### Test 1: CONSOLIDATED INCOME (SUMMARY)

**Contexto:**
- Módulo: SUMMARY
- Capítulo: Resumen Ciudad de México

**Operación:** CONSOLIDATED INCOME

**Resultado Esperado:**
```
✅ 4 términos
+ Income (CDMX)
+ Income (Guadalajara)
+ Income (Monterrey)
+ Income (Northwest)
```

### Test 2: CONSOLIDATED EXPENSE (SUMMARY)

**Contexto:**
- Módulo: SUMMARY
- Capítulo: Resumen Ciudad de México

**Operación:** CONSOLIDATED EXPENSE

**Resultado Esperado:**
```
✅ 4 términos
+ Expense (CDMX)
+ Expense (Guadalajara)
+ Expense (Monterrey)
+ Expense (Northwest)
```

### Test 3: Total Income (Módulos individuales)

**Contexto:**
- Módulo: Finanzas
- Capítulo: Ciudad de México

**Operación:** Total Income

**Resultado Esperado:**
```
✅ N términos (subsecciones del módulo)
+ Membership Income
+ Event Income
+ Other Income
```

---

## 🔧 Solución de Problemas

### Problema: "No se detectan operaciones consolidadas"

**Causa:** El layout cargado no tiene operaciones con nombres como "CONSOLIDATED", "CONSOLIDADO", "TOTAL"

**Solución:**
1. Verificar que estás en el módulo correcto (típicamente SUMMARY o RESUMEN)
2. Verificar que el capítulo es un resumen (ej: "Resumen Ciudad de México")
3. Cargar un layout diferente

### Problema: "Sección no encontrada"

**Causa:** La operación referencia una sección que ya no existe en el layout

**Solución:**
1. Usar **"Intentar Reparar"** para reconstruir con secciones actuales
2. O editar manualmente con **FormulaBuilder**
3. Verificar nombres de secciones en el layout

### Problema: "Términos vacíos o incorrectos"

**Causa:** La operación no tiene `formula_json`, `signos`, ni `SECCION` definidos

**Solución:**
1. Usar **FormulaBuilder** para definir manualmente la fórmula
2. O agregar el campo `SECCION` en el backend
3. Guardar cambios

---

## 📈 Datos Técnicos

### Estructura de formula_terms

```json
[
  {
    "operator": "+",
    "type": "section",
    "value": "Income (CDMX)"
  },
  {
    "operator": "+",
    "type": "section",
    "value": "Income (Guadalajara)"
  }
]
```

### Tipos de Términos

- `section`: Sección principal o secundaria
- `account`: Fila de cuenta específica
- `operation`: Otra operación (operaciones anidadas)
- `constant`: Valor numérico fijo

### Fuentes de Construcción

1. **formula_json** (prioridad alta): JSON guardado en BD
2. **signos + seccion_N** (legacy): Formato antiguo
3. **SECCION** (auto): Construcción inteligente desde nombre de operación

---

## 💡 Mejores Prácticas

1. **Siempre diagnosticar antes de guardar**
   - Usar botón **"🐛 Diagnosticar"** antes de guardar cambios importantes

2. **Validar operaciones consolidadas regularmente**
   - Especialmente después de agregar/eliminar capítulos

3. **Usar reparación automática conservadoramente**
   - Revisar cambios antes de guardar
   - La reparación sobrescribe términos existentes

4. **Documentar operaciones complejas**
   - Usar el campo de descripción para operaciones anidadas
   - Comentar lógicas especiales

---

## 📝 Registro de Validación

### Template de Reporte

```
Fecha: _______________
Validado por: _______________

Módulo: SUMMARY
Capítulo: Resumen Ciudad de México
Año: 2022

Operaciones Validadas:
[ ] CONSOLIDATED INCOME - ✅ Válida / ⚠️ Problemas
[ ] CONSOLIDATED EXPENSE - ✅ Válida / ⚠️ Problemas
[ ] RESULT - ✅ Válida / ⚠️ Problemas

Observaciones:
_______________________________________
_______________________________________

Acciones Tomadas:
_______________________________________
_______________________________________
```

---

## 🎓 Referencias

- **Implementación:** `vistas/js/operation-debugger.js`
- **Lógica de hidratación:** `vistas/js/plantillas.js` (líneas 440-584)
- **Constructor de fórmulas:** `vistas/js/formula-builder.js`
- **Sincronización:** `vistas/js/operation-sync.js`

---

**Última actualización:** $(date)
**Versión:** 1.0.0
