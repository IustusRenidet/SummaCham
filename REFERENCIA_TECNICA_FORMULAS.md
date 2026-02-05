# 🔧 Referencia Técnica: Fórmulas Personalizadas en SummaCham

## 📊 Estructura de Datos

### Formato de `formula_terms`

Las fórmulas se almacenan como un array de objetos término:

```javascript
formula_terms: [
  {
    id: 1738640000000,      // Timestamp único
    operator: "+",          // Operador: +, -, *, /
    type: "section",        // Tipo: section, account, operation, constant
    value: "Membership"     // Referencia al elemento
  },
  {
    id: 1738640000001,
    operator: "-",
    type: "account",
    value: "801-001-000-00"
  },
  {
    id: 1738640000002,
    operator: "*",
    type: "constant",
    value: "0.15",
    constant: 0.15          // Valor numérico parseado
  }
]
```

### Campos de una Operación

```javascript
{
  // Identificación
  OperacionId: "SECPRIN_EXPENSES",           // ID único de la operación
  Clase: "EXPENSES",                         // Nombre/clase de la operación
  SECCION: "EXPENSES",                       // Sección asociada
  
  // Tipo y visibilidad
  tipo_operacion: "seccion",                 // Tipo: seccion, subseccion, custom-formula, etc.
  visible: true,                             // Si aparece en la tabla
  
  // Fórmula
  formula_terms: [...],                      // Array de términos (ver arriba)
  formula_json: "[...]",                     // JSON string de formula_terms
  
  // Presentación
  rowStyle: "sum-row-principal",             // Estilo de fila CSS
  "sum-row": "Total EXPENSES",               // Etiqueta para fila sum-row
  "sum-row-sumavarios": "CONSOLIDATED",      // Etiqueta para consolidación
  
  // Metadata
  HOJA: "RESUMEN",                           // Módulo al que pertenece
  CAPITULO: "CIUDAD DE MEXICO",              // Capítulo/empresa
  orden_presentacion: 10                     // Orden en la tabla
}
```

---

## 🎯 Ejemplos de Fórmulas Comunes

### 1. Suma Simple de Subsecciones

**Descripción:** EXPENSES suma todas sus subsecciones.

```javascript
{
  OperacionId: "SECPRIN_EXPENSES",
  Clase: "EXPENSES",
  formula_terms: [
    { operator: "+", type: "section", value: "Membership" },
    { operator: "+", type: "section", value: "Events" },
    { operator: "+", type: "section", value: "Committees" },
    { operator: "+", type: "section", value: "Operating Expenses" }
  ]
}
```

**Resultado Visual:**
```
EXPENSES = Membership + Events + Committees + Operating Expenses
```

---

### 2. Resta de una Subsección

**Descripción:** EXPENSES resta "Committees" en lugar de sumarlo.

```javascript
{
  OperacionId: "SECPRIN_EXPENSES",
  Clase: "EXPENSES",
  formula_terms: [
    { operator: "+", type: "section", value: "Membership" },
    { operator: "+", type: "section", value: "Events" },
    { operator: "-", type: "section", value: "Committees" },  // ← RESTA
    { operator: "+", type: "section", value: "Operating Expenses" }
  ]
}
```

**Resultado Visual:**
```
EXPENSES = Membership + Events - Committees + Operating Expenses
```

---

### 3. Ajuste con Constante

**Descripción:** EXPENSES con un ajuste fijo de $5,000.

```javascript
{
  OperacionId: "SECPRIN_EXPENSES",
  Clase: "EXPENSES",
  formula_terms: [
    { operator: "+", type: "section", value: "Membership" },
    { operator: "+", type: "section", value: "Events" },
    { operator: "+", type: "section", value: "Committees" },
    { operator: "-", type: "constant", value: "5000", constant: 5000 }
  ]
}
```

**Resultado Visual:**
```
EXPENSES = Membership + Events + Committees - 5000
```

---

### 4. Cálculo de Porcentaje

**Descripción:** Comisión del 15% sobre ventas.

```javascript
{
  OperacionId: "CUSTOM_COMISION",
  Clase: "COMISION",
  formula_terms: [
    { operator: "+", type: "section", value: "Ventas" },
    { operator: "*", type: "constant", value: "0.15", constant: 0.15 }
  ]
}
```

**Resultado Visual:**
```
COMISION = Ventas × 0.15
```

---

### 5. Resta de Cuenta Específica

**Descripción:** EXPENSES resta una cuenta contable específica.

```javascript
{
  OperacionId: "SECPRIN_EXPENSES",
  Clase: "EXPENSES",
  formula_terms: [
    { operator: "+", type: "section", value: "Membership" },
    { operator: "+", type: "section", value: "Events" },
    { operator: "-", type: "account", value: "801-001-000-00" }
  ]
}
```

**Resultado Visual:**
```
EXPENSES = Membership + Events - 801-001-000-00
```

---

### 6. Operación Compleja con División

**Descripción:** Promedio de gastos.

```javascript
{
  OperacionId: "CUSTOM_PROMEDIO_GASTOS",
  Clase: "PROMEDIO GASTOS",
  formula_terms: [
    { operator: "+", type: "section", value: "CDMX EXPENSE" },
    { operator: "+", type: "section", value: "GDL EXPENSE" },
    { operator: "+", type: "section", value: "MTY EXPENSE" },
    { operator: "/", type: "constant", value: "3", constant: 3 }
  ]
}
```

**Resultado Visual:**
```
PROMEDIO GASTOS = (CDMX EXPENSE + GDL EXPENSE + MTY EXPENSE) / 3
```

---

### 7. Referencia a Otra Operación

**Descripción:** Operating Results resta EXPENSES de INCOME.

```javascript
{
  OperacionId: "RESULT_OPERATING",
  Clase: "OPERATING RESULTS",
  formula_terms: [
    { operator: "+", type: "operation", value: "SECPRIN_INCOME" },
    { operator: "-", type: "operation", value: "SECPRIN_EXPENSES" }
  ]
}
```

**Resultado Visual:**
```
OPERATING RESULTS = INCOME - EXPENSES
```

---

### 8. Consolidación Multi-Regional

**Descripción:** Consolida EXPENSES de todas las regiones.

```javascript
{
  OperacionId: "GROUP_CONSOLIDATED_EXPENSES",
  Clase: "CONSOLIDATED EXPENSES",
  formula_terms: [
    { operator: "+", type: "section", value: "CDMX EXPENSE" },
    { operator: "+", type: "section", value: "GUADALAJARA EXPENSE" },
    { operator: "+", type: "section", value: "MONTERREY EXPENSE" },
    { operator: "+", type: "section", value: "QUERETARO EXPENSE" }
  ]
}
```

**Resultado Visual:**
```
CONSOLIDATED EXPENSES = CDMX EXPENSE + GUADALAJARA EXPENSE + MONTERREY EXPENSE + QUERETARO EXPENSE
```

---

### 9. Fórmula con Múltiples Operaciones

**Descripción:** Cálculo complejo con varios pasos.

```javascript
{
  OperacionId: "CUSTOM_NETO_AJUSTADO",
  Clase: "NETO AJUSTADO",
  formula_terms: [
    { operator: "+", type: "section", value: "Ventas" },
    { operator: "-", type: "section", value: "Costos" },
    { operator: "*", type: "constant", value: "1.16", constant: 1.16 },  // IVA 16%
    { operator: "-", type: "constant", value: "10000", constant: 10000 }
  ]
}
```

**Resultado Visual:**
```
NETO AJUSTADO = ((Ventas - Costos) × 1.16) - 10000
```

---

### 10. Subsección con Cuentas Específicas

**Descripción:** Una subsección suma solo ciertas cuentas.

```javascript
{
  OperacionId: "SUBSEC_MEMBERSHIP",
  Clase: "Membership",
  SECCION: "Membership",
  tipo_operacion: "subseccion",
  formula_terms: [
    { operator: "+", type: "account", value: "705-000-000-00" },
    { operator: "+", type: "account", value: "702-000-000-00" },
    { operator: "+", type: "account", value: "503-000-000-00" }
  ]
}
```

**Resultado Visual:**
```
Membership = 705-000-000-00 + 702-000-000-00 + 503-000-000-00
```

---

## 🔄 Flujo de Procesamiento

### 1. Guardado de Fórmula

```javascript
// En plantillas.js - Cuando usuario guarda
function saveOperation(operation) {
  // 1. Validar términos
  const validation = FormulaBuilder.validate();
  if (!validation.isValid) {
    showError(validation.errors);
    return;
  }
  
  // 2. Obtener términos del FormulaBuilder
  const terms = FormulaBuilder.getTerms();
  
  // 3. Asignar a operación
  operation.formula_terms = terms;
  operation.formula_json = JSON.stringify(terms);
  
  // 4. Guardar en base de datos
  await fetch('/api/operaciones/actualizar', {
    method: 'POST',
    body: JSON.stringify(operation)
  });
}
```

---

### 2. Carga de Fórmula

```javascript
// En plantillas.js - Cuando se edita una operación
function loadOperation(operationId) {
  const operation = findOperationById(operationId);
  
  // PRIORIDAD 1: formula_terms (si existe)
  if (operation.formula_terms && operation.formula_terms.length > 0) {
    FormulaBuilder.init(operation);
    return;
  }
  
  // PRIORIDAD 2: formula_json (parse)
  if (operation.formula_json) {
    try {
      operation.formula_terms = JSON.parse(operation.formula_json);
      FormulaBuilder.init(operation);
      return;
    } catch (e) {
      console.error("Error parseando formula_json", e);
    }
  }
  
  // PRIORIDAD 3: Formato legacy (seccion_1, seccion_2, etc.)
  operation.formula_terms = parseLegacyFormat(operation);
  FormulaBuilder.init(operation);
}
```

---

### 3. Ejecución de Fórmula

```javascript
// En cuentas-modulo.js - Cuando se calculan sumas
function ejecutarOperacion(operacion, valoresPorSeccion) {
  const terms = extraerFormulaTermsOperacion(operacion);
  
  let resultado = [];
  
  terms.forEach((term, index) => {
    let valores = [];
    
    // Obtener valores según el tipo
    switch (term.type) {
      case 'section':
        valores = valoresPorSeccion.get(term.value) || [];
        break;
        
      case 'account':
        valores = extraerValoresCuenta(term.value) || [];
        break;
        
      case 'operation':
        valores = ejecutarOperacion(findOperation(term.value), valoresPorSeccion);
        break;
        
      case 'constant':
        // Crear array con el mismo valor para todas las columnas
        valores = new Array(12).fill(term.constant);
        break;
    }
    
    // Aplicar operador
    if (index === 0) {
      resultado = valores;
    } else {
      switch (term.operator) {
        case '+':
          resultado = sumarListas([resultado, valores]);
          break;
        case '-':
          resultado = restarListas(resultado, valores);
          break;
        case '*':
          resultado = multiplicarListas(resultado, valores);
          break;
        case '/':
          resultado = dividirListas(resultado, valores);
          break;
      }
    }
  });
  
  return resultado;
}
```

---

### 4. Validación de Fórmula

```javascript
// En formula-builder.js - Validación antes de guardar
validate() {
  const errors = [];
  const warnings = [];
  
  // Validar que hay al menos un término
  if (this.terms.length === 0) {
    errors.push("La fórmula debe tener al menos un término");
  }
  
  // Validar cada término
  this.terms.forEach((term, index) => {
    // Validar que tiene valor
    if (!term.value && term.type !== 'constant') {
      errors.push(`Término ${index + 1}: Debe especificar un valor`);
    }
    
    // Validar constantes numéricas
    if (term.type === 'constant') {
      if (term.constant === null || isNaN(term.constant)) {
        errors.push(`Término ${index + 1}: Constante debe ser un número válido`);
      }
    }
    
    // Validar referencias (existen en catálogo)
    if (term.type === 'section') {
      if (!this.availableElements.sections.includes(term.value)) {
        warnings.push(`Término ${index + 1}: Sección "${term.value}" no encontrada en catálogo`);
      }
    }
    
    if (term.type === 'account') {
      const exists = this.availableElements.accounts.some(a => a.code === term.value);
      if (!exists) {
        warnings.push(`Término ${index + 1}: Cuenta "${term.value}" no encontrada`);
      }
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}
```

---

## 📂 Base de Datos

### Tabla: `layout_operaciones`

```sql
CREATE TABLE layout_operaciones (
  OperacionId TEXT PRIMARY KEY,
  Clase TEXT,
  SECCION TEXT,
  tipo_operacion TEXT,
  visible INTEGER DEFAULT 1,
  
  -- Fórmula (nuevos campos)
  formula_terms TEXT,      -- JSON array de términos
  formula_json TEXT,       -- JSON string (respaldo)
  
  -- Campos de presentación
  "sum-row" TEXT,
  "sum-row-sumavarios" TEXT,
  "sum-row-sumavarios2" TEXT,
  "result-row" TEXT,
  "net-row" TEXT,
  
  -- Metadata
  HOJA TEXT,
  CAPITULO TEXT,
  orden_presentacion INTEGER,
  rowStyle TEXT
);
```

### Ejemplo de Insert

```sql
INSERT INTO layout_operaciones (
  OperacionId,
  Clase,
  SECCION,
  tipo_operacion,
  formula_terms,
  formula_json,
  "sum-row",
  HOJA,
  CAPITULO,
  orden_presentacion
) VALUES (
  'SECPRIN_EXPENSES',
  'EXPENSES',
  'EXPENSES',
  'seccion',
  '[{"operator":"+","type":"section","value":"Membership"},{"operator":"+","type":"section","value":"Events"}]',
  '[{"operator":"+","type":"section","value":"Membership"},{"operator":"+","type":"section","value":"Events"}]',
  'Total EXPENSES',
  'RESUMEN',
  'CIUDAD DE MEXICO',
  10
);
```

---

## 🎨 API del FormulaBuilder

### Métodos Principales

```javascript
// Inicializar con operación existente
FormulaBuilder.init(operation, availableElements);

// Obtener términos actuales
const terms = FormulaBuilder.getTerms();

// Agregar término
FormulaBuilder.addTerm(operator, type, value);

// Eliminar término
FormulaBuilder.removeTerm(termId);

// Actualizar término
FormulaBuilder.updateOperator(termId, newOperator);
FormulaBuilder.updateType(termId, newType);
FormulaBuilder.updateValue(termId, newValue);

// Validar fórmula
const validation = FormulaBuilder.validate();

// Renderizar interfaz
FormulaBuilder.render();

// Mostrar mapa visual
FormulaBuilder.showMap();

// Obtener vista previa textual
const preview = FormulaBuilder.getPreviewText();
```

### Eventos

```javascript
// Escuchar cambios en la fórmula
document.addEventListener('formulaChanged', (event) => {
  console.log('Fórmula actualizada:', event.detail.terms);
});

// Escuchar validación
document.addEventListener('formulaValidated', (event) => {
  const { isValid, errors, warnings } = event.detail;
  if (!isValid) {
    console.error('Errores de validación:', errors);
  }
});
```

---

## 🔍 Debugging

### Ver Términos en Consola

```javascript
// En la consola del navegador (F12)
const op = state.operaciones.find(o => o.Clase === 'EXPENSES');
console.table(op.formula_terms);
```

### Forzar Recálculo

```javascript
// Recalcular todas las sumas
if (typeof recalcularSumas === 'function') {
  recalcularSumas();
}
```

### Ver Mapa de Operación

```javascript
// Mostrar mapa visual de una operación
FormulaBuilder.currentOperationId = 'SECPRIN_EXPENSES';
FormulaBuilder.showMap();
```

---

## 🚨 Problemas Comunes y Soluciones

### Problema 1: Fórmula no se guarda

**Síntomas:** Cambios se pierden al recargar.

**Diagnóstico:**
```javascript
// Verificar si formula_json se está guardando
const op = state.operaciones.find(o => o.Clase === 'EXPENSES');
console.log('formula_json:', op.formula_json);
console.log('formula_terms:', op.formula_terms);
```

**Solución:** Asegurarse de que ambos campos se actualizan:
```javascript
operation.formula_terms = terms;
operation.formula_json = JSON.stringify(terms);
```

---

### Problema 2: Operadores no se aplican

**Síntomas:** La resta aparece como suma.

**Diagnóstico:**
```javascript
// Verificar operadores en términos
terms.forEach((t, i) => {
  console.log(`Término ${i}: operator="${t.operator}"`);
});
```

**Solución:** Asegurarse de usar strings correctos:
```javascript
// ✅ CORRECTO
{ operator: "+", ... }
{ operator: "-", ... }
{ operator: "*", ... }
{ operator: "/", ... }

// ❌ INCORRECTO
{ operator: "suma", ... }
{ operator: "−", ... }  // Carácter unicode
```

---

### Problema 3: Referencias circulares

**Síntomas:** Cálculo infinito o error de stack overflow.

**Diagnóstico:**
```javascript
// Detectar ciclos en operaciones
function detectarCiclo(operacionId, visitados = new Set()) {
  if (visitados.has(operacionId)) {
    return true;  // Ciclo detectado
  }
  visitados.add(operacionId);
  
  const op = findOperation(operacionId);
  const terms = extraerFormulaTermsOperacion(op);
  
  for (const term of terms) {
    if (term.type === 'operation') {
      if (detectarCiclo(term.value, new Set(visitados))) {
        return true;
      }
    }
  }
  
  return false;
}
```

**Solución:** Remover referencias circulares manualmente.

---

## 📝 Notas Finales

- **Compatibilidad:** Las fórmulas son compatibles hacia atrás con el formato legacy.
- **Performance:** El cálculo de fórmulas complejas se hace una sola vez por actualización.
- **Límites:** No hay límite en el número de términos, pero se recomienda mantener fórmulas simples.
- **Orden:** Los términos se evalúan secuencialmente de izquierda a derecha.

---

**Documento actualizado:** 4 de febrero de 2026
**Sistema:** SummaCham v2026
**Módulos:** RESUMEN, SUMMARY
