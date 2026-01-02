# 🔄 Auto-Construcción de Operaciones Consolidadas

## Cambio Implementado

Las operaciones consolidadas ahora se **construyen automáticamente en tiempo real** cada vez que se carga un layout, garantizando que siempre reflejen las secciones actuales del presupuesto.

---

## 🎯 Operaciones Afectadas

### Detectadas Automáticamente

Cualquier operación cuyo nombre incluya:
- `CONSOLIDATED` (ej: CONSOLIDATED INCOME, CONSOLIDATED EXPENSE)
- `CONSOLIDADO` (ej: Ingreso Consolidado, Gasto Consolidado)
- `TOTAL` (ej: Total Income, Total General)

### Tipos Soportados

1. **Income Consolidadas** - Suma todos los Income sections
   - Keywords: `income`, `ingreso`
   - Operador: `+` (suma)

2. **Expense Consolidadas** - Suma todos los Expense sections
   - Keywords: `expense`, `gasto`
   - Operador: `+` (suma, ya que los gastos se restan en el cálculo final)

---

## 🔍 Ejemplo: CONSOLIDATED INCOME

### Antes (Datos Estáticos)

```javascript
{
  "Clase": "CONSOLIDATED INCOME",
  "seccion_1": "Income (CDMX)",
  "seccion_2": "Income (Guadalajara)",
  "seccion_3": "Income (Monterrey)",
  // Si se agrega un nuevo capítulo, HAY QUE EDITAR MANUALMENTE
}
```

**Problema:** Al agregar "Income (Querétaro)", la operación NO se actualiza automáticamente.

### Ahora (Auto-Construcción)

```javascript
// El sistema BUSCA todas las secciones Income disponibles
const allIncomeSections = findAllIncomeSections(); // Dinámico
// [
//   "Income (CDMX)",
//   "Income (Guadalajara)", 
//   "Income (Monterrey)",
//   "Income (Querétaro)"  ← Se detecta automáticamente
// ]

// Construye la operación
{
  "Clase": "CONSOLIDATED INCOME",
  "formula_terms": [
    { operator: "+", type: "section", value: "Income (CDMX)" },
    { operator: "+", type: "section", value: "Income (Guadalajara)" },
    { operator: "+", type: "section", value: "Income (Monterrey)" },
    { operator: "+", type: "section", value: "Income (Querétaro)" }
  ],
  "_autoBuilt": true  // Marca de auto-construcción
}
```

**Ventaja:** ✅ Siempre actualizado, sin edición manual.

---

## 🏗️ Orden de Prioridad

La función `hydrateOperationsFromParents()` ahora sigue este orden:

### 1️⃣ **PRIORIDAD MÁXIMA: Operaciones Consolidadas** 🔄
```
Si nombre incluye "consolidated|consolidado|total" + "income|expense"
  → SIEMPRE construir dinámicamente desde secciones actuales
```

### 2️⃣ Formula Terms Manuales
```
Si tiene formula_terms Y NO es auto-construida
  → Respetar términos existentes
```

### 3️⃣ Formula JSON Guardado
```
Si tiene formula_json guardado en BD
  → Parsear y usar
```

### 4️⃣ Formato Legacy (signos)
```
Si tiene seccion_1, seccion_2... con signos
  → Construir desde ahí
```

### 5️⃣ Construcción desde SECCION
```
Si tiene SECCION definida
  → Usar buildFormulaTermsFromParent()
```

---

## 🎨 Identificación Visual

### En el Debugger

Cuando uses el botón **"🐛 Diagnosticar"**, verás:

```
Estado: Válida ✓
Tipo: Consolidado Multi-Capítulo
Términos: 4
Construido desde: 🔄 AUTO-CONSTRUIDO (en tiempo real)

[BADGE] ⚡ Auto-construido dinámicamente
```

### En la Consola

```javascript
const op = state.operaciones.find(o => o.Clase === 'CONSOLIDATED INCOME');
console.log(op._autoBuilt); // true
```

---

## 💾 Persistencia

### ¿Se Guarda en la Base de Datos?

**SÍ**, cuando haces click en **"💾 Guardar"**:

```javascript
// Se guarda en layout_operaciones
{
  seccion_1: "Income (CDMX)",
  seccion_2: "Income (Guadalajara)",
  seccion_3: "Income (Monterrey)",
  seccion_4: "Income (Querétaro)",
  formula_json: "[{...términos...}]"
}
```

### ¿Se Usa lo Guardado?

**NO para consolidadas**. Cada vez que cargas el layout:

1. Se lee de la BD
2. Se detecta que es consolidada
3. **Se reconstruye** automáticamente
4. Se sobrescribe lo guardado

**Para operaciones normales:** SÍ se usa lo guardado.

---

## 🔧 Casos de Uso

### Caso 1: Agregar Nuevo Capítulo

**Antes:**
1. Agregar capítulo "Querétaro"
2. Ir a gestor de plantillas
3. Buscar CONSOLIDATED INCOME
4. Editar manualmente agregando "Income (Querétaro)"
5. Guardar

**Ahora:**
1. Agregar capítulo "Querétaro"
2. ✅ **Ya está** - La operación se actualiza automáticamente

### Caso 2: Eliminar Capítulo

**Antes:**
1. Eliminar capítulo "Northwest"
2. CONSOLIDATED INCOME sigue referenciando "Income (Northwest)"
3. ⚠️ Error en cálculos

**Ahora:**
1. Eliminar capítulo "Northwest"
2. ✅ **Auto-actualizado** - "Income (Northwest)" desaparece de la operación

### Caso 3: Renombrar Sección

**Antes:**
1. Renombrar "Income (CDMX)" → "Ingresos (CDMX)"
2. CONSOLIDATED INCOME sigue buscando "Income (CDMX)"
3. ⚠️ Sección no encontrada

**Ahora:**
1. Renombrar "Income (CDMX)" → "Ingresos (CDMX)"
2. ⚠️ **Verificar keyword** - Si "Ingresos" no contiene "income", no se detectará
3. **Solución:** Mantener keyword "income" en el nombre o editar manualmente

---

## ⚙️ Configuración Técnica

### Algoritmo de Detección

```javascript
// 1. Detectar tipo de operación
const isConsolidated = name.includes('consolidated|consolidado|total');
const isIncome = name.includes('income|ingreso');
const isExpense = name.includes('expense|gasto');

// 2. Si es consolidada, buscar secciones
if (isConsolidated && (isIncome || isExpense)) {
  const allSections = state.cuentas
    .map(c => c['SECCIÓN Principal'])
    .filter(sec => 
      (isIncome && sec.includes('income')) ||
      (isExpense && sec.includes('expense'))
    );
  
  // 3. Construir términos
  return allSections.map(sec => ({
    operator: isExpense ? '-' : '+',
    type: 'section',
    value: sec
  }));
}
```

### Keywords Reconocidos

| Tipo | Español | Inglés |
|------|---------|--------|
| Consolidado | `consolidado`, `total` | `consolidated`, `total` |
| Ingreso | `ingreso` | `income` |
| Gasto | `gasto`, `egreso` | `expense` |

---

## 🚨 Advertencias

### ⚠️ Requisito de Keywords

Para que la auto-construcción funcione, los nombres de secciones **DEBEN** contener:
- `income` o `ingreso` para ingresos
- `expense` o `gasto` para gastos

**Ejemplos válidos:**
- ✅ "Income (CDMX)"
- ✅ "Ingresos CDMX" (contiene "ingreso")
- ✅ "Expense Section"
- ✅ "Gastos Operativos"

**Ejemplos NO válidos:**
- ❌ "Entradas (CDMX)" (no contiene keyword)
- ❌ "Revenues" (no contiene keyword)
- ❌ "Egresos" (se esperaría "gastos" o "expense")

### ⚠️ Operaciones Personalizadas

Si tienes una operación consolidada con lógica especial (ej: excluir ciertas secciones), debes:

1. **Cambiar el nombre** para que NO contenga "consolidated/consolidado/total"
2. **O** editarla manualmente con FormulaBuilder
3. **Guardar** y marcarla como personalizada

---

## 🧪 Testing

### Test Manual

```javascript
// 1. Cargar layout SUMMARY
// 2. En consola:
const consolidated = state.operaciones.filter(op => op._autoBuilt);
console.table(consolidated.map(op => ({
  Nombre: op.Clase,
  Términos: op.formula_terms?.length || 0,
  AutoConstruido: op._autoBuilt
})));
```

### Resultado Esperado

```
┌─────────┬──────────────────────────┬──────────┬──────────────────┐
│ (index) │         Nombre           │ Términos │ AutoConstruido   │
├─────────┼──────────────────────────┼──────────┼──────────────────┤
│    0    │ 'CONSOLIDATED INCOME'    │    4     │      true        │
│    1    │ 'CONSOLIDATED EXPENSE'   │    4     │      true        │
│    2    │ 'RESULT'                 │    0     │      false       │
└─────────┴──────────────────────────┴──────────┴──────────────────┘
```

---

## 📚 Referencias

- **Implementación:** [plantillas.js](vistas/js/plantillas.js) líneas 453-569
- **Debugger:** [operation-debugger.js](vistas/js/operation-debugger.js)
- **Guía de validación:** [GUIA_VALIDACION_OPERACIONES.md](GUIA_VALIDACION_OPERACIONES.md)

---

## 🎓 Resumen Ejecutivo

| Aspecto | Descripción |
|---------|-------------|
| **Qué cambió** | Operaciones consolidadas se construyen dinámicamente |
| **Por qué** | Mantener sincronización automática con capítulos |
| **Cómo detectar** | Badge "⚡ Auto-construido dinámicamente" en debugger |
| **Ventaja** | No requiere edición manual al agregar/quitar capítulos |
| **Limitación** | Requiere keywords específicos en nombres de secciones |
| **Impacto** | Solo afecta operaciones con "consolidated/consolidado/total" |

---

**Fecha:** Enero 2, 2026  
**Versión:** 2.0.0  
**Estado:** ✅ Implementado y Probado
