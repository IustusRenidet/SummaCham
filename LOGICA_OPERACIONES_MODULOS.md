# 📊 Lógica de Operaciones y Sumas por Módulo

## 🔍 Resumen Ejecutivo

Este documento explica **exactamente** dónde se decide y ejecuta cada operación matemática (sumas, restas, promedios) para los 13 módulos del sistema SummaCham.

---

## 📁 Estructura General

### Archivos Clave de Configuración

| Archivo | Propósito | Módulos que Controla |
|---------|-----------|---------------------|
| `info IMPORTANTE/CUENTAS.json` | Define estructura de cuentas por módulo | 11 módulos operativos |
| `info IMPORTANTE/CUENTAS SUMMARY y RESUMEN.json` | Define operaciones de consolidación | SUMMARY + RESUMEN |
| `info IMPORTANTE/METADATA/PPTO/formulasppto.json` | Fórmulas Excel originales (69,662 líneas) | Todos |

### Archivos de Ejecución JavaScript

| Archivo | Propósito | Líneas Clave |
|---------|-----------|--------------|
| `vistas/js/cuentas-modulo.js` | **Motor principal** para 11 módulos operativos | 1340-3182 |
| `vistas/js/summary-view.js` | Lógica específica de SUMMARY | 250-1518 |
| `vistas/js/resumen-view.js` | Lógica específica de RESUMEN | 100-1386 |

---

## 🎯 11 Módulos Operativos

### Módulos Incluidos
1. Presupuestos
2. Finanzas (T&IC)
3. Comités
4. Comunicación
5. Eventos
6. Gtos_Corporativos
7. Membresía
8. RH
9. Serv_Membresía
10. VPE
11. Dirección

### 📍 Dónde se Decide la Lógica

**Archivo:** `vistas/js/cuentas-modulo.js`

#### Funciones Principales:

**1. `agregarFilaResumen()` (Líneas 1340-1390)**
- **Qué hace:** Crea filas visuales de suma en la tabla
- **Tipos de filas:**
  - `sum-row`: Suma de todas las cuentas de UNA sección
  - `sum-row-sumavarios`: Suma de VARIOS sum-rows agrupados
  - `result-row`: Resultado final del módulo
- **Estructura HTML:** `| (vacío) | Texto | val1 | val2 | ... | val12 |`

```javascript
// Líneas 1340-1390
const agregarFilaResumen = ({ texto, clase, cuerpo, placeholdersPorFila }) => {
  // Crea fila con 12 columnas (meses)
  // Inicializa con "-" 
  // Se actualiza con recalcularSumas()
}
```

**2. `recalcularSumas()` (Múltiples llamadas)**
- **Línea 804:** Después de cargar datos
- **Línea 864:** Después de editar celdas
- **Línea 909:** Después de insertar filas
- **Línea 2083:** Después de eliminar filas
- **Qué hace:** Recalcula TODOS los totales dinámicamente

```javascript
// Ejecuta sumas en tiempo real:
recalcularSumas(); // ← AQUÍ se efectúan las operaciones
```

**3. Estructura de Secciones (Líneas 1391-1550)**
```javascript
/**
 * PROCESO:
 * 1. Agrupa registros por sección (ej: "INGRESOS", "GASTOS")
 * 2. Para cada sección:
 *    a. Crea fila de encabezado (section-header-row)
 *    b. Crea filas de cuenta (fila-cuenta) con valores
 *    c. Agrega fila sum-row según configuración
 * 3. Construye metadata de sumas
 */
```

### 📊 Configuración de Datos

**Archivo:** `info IMPORTANTE/CUENTAS.json`

**Estructura:**
```json
{
  "VPE": [
    {
      "CAPITULO": "CIUDAD DE MÉXICO",
      "SECCION": "Ingresos CEN/Board",
      "CUENTA": "417-017-000-00",
      "NOMBRE": "Board Of Directors"
    }
  ],
  "Finanzas": [...],
  "Comites": [...],
  // ... 11 módulos
}
```

**Cómo se usa:**
1. JavaScript lee `CUENTAS.json`
2. Agrupa por `CAPITULO` → `SECCION` → `CUENTA`
3. Crea estructura jerárquica en tabla HTML
4. Aplica sumas por sección

---

## 📈 Módulo SUMMARY

### 📍 Dónde se Decide la Lógica

**Archivo:** `vistas/js/summary-view.js`

#### Configuración de Operaciones (Líneas 250-300)

**Tipos de Filas:**
```javascript
const ROW_TOOLTIPS = {
  account: 'Cuenta individual del catálogo',
  section: 'Total de sección ("sum-row"). Suma todas las cuentas hijas',
  principal: 'Bloque principal (Income, Expense, Operating)',
  group: 'Fila consolidada (CONSOLIDATED INCOME/EXPENSES)',
  result: 'Operating Results: ingresos - gastos',
  net: 'Net Results: Operating + otros ingresos',
  final: 'Consolidated Net Results: cierre final'
};
```

#### Factores de Suma (Líneas 290-310)

```javascript
const describirFactor = (factor) => {
  if (numero === 1) return 'Suma';      // Income se suma
  if (numero === -1) return 'Resta';    // Expense se resta
  if (numero === 0) return 'Ignora';
  if (numero === 0.5) return 'Divide entre 2';
  // ...
};
```

### 📊 Configuración de Sumas

**Archivo:** `info IMPORTANTE/CUENTAS SUMMARY y RESUMEN.json`

**Sección: "SUMA DE VARIAS SECCIONES"**

**Ejemplo para SUMMARY - Ciudad de México:**
```json
{
  "HOJA": "SUMMARY",
  "CAPITULO": "CIUDAD DE MÉXICO",
  "Clase": "income-Membership",
  "SECCION": "Membership",
  "sum-row": "SUMA DE Membership",
  "sum-row-sumavarios": "CDMX Income",
  "sum-row-sumavarios-consolidado": "CONSOLIDATED INCOME",
  "sum-row-operativo": "OPERATING RESULTS MEXICO",
  "result-row": "CONSOLIDATED OPERATING RESULTS"
}
```

### Jerarquía de Operaciones

```
1. CUENTAS INDIVIDUALES (401, 402, ...)
   ↓ (suma)
2. sum-row: "SUMA DE Membership"
   ↓ (agrupa)
3. sum-row-sumavarios: "CDMX Income"
   ↓ (consolida)
4. sum-row-sumavarios-consolidado: "CONSOLIDATED INCOME"
   ↓ (opera: Income - Expense)
5. sum-row-operativo: "OPERATING RESULTS MEXICO"
   ↓ (agrupa regiones)
6. result-row: "CONSOLIDATED OPERATING RESULTS"
```

### Cálculo de Variaciones

**Líneas 255-260:**
```javascript
varMonthPlan: '((Real / Presupuesto) - 1) * 100',
varMonthPrev: '((Real / Real previo) - 1) * 100',
varYTDPlan: '((Real YTD / Presupuesto YTD) - 1) * 100',
varYTDPrev: '((Real YTD / Real YTD previo) - 1) * 100'
```

---

## 📊 Módulo RESUMEN

### 📍 Dónde se Decide la Lógica

**Archivo:** `vistas/js/resumen-view.js`

#### Configuración de Operaciones (Líneas 100-120)

```javascript
const ROW_TOOLTIPS = {
  section: 'Total de sección ("sum-row"). Suma todas las cuentas hijas',
  principal: 'Bloque principal (INCOME, EXPENSE, etc.)',
  group: 'Fila consolidada',
  result: 'Operating/Net Results: combinan ingresos + gastos + otros'
};
```

### 📊 Configuración de Sumas

**Archivo:** `info IMPORTANTE/CUENTAS SUMMARY y RESUMEN.json`

**Ejemplo para RESUMEN - Ciudad de México:**
```json
{
  "HOJA": "RESUMEN",
  "CAPITULO": "CIUDAD DE MÉXICO",
  "Clase": "income-Membership",
  "SECCION": "Membership",
  "sum-row": "SUMA DE Membership",
  "sum-row-sumavarios": "INCOME",
  "sum-row-sumavarios-consolidado": "CONSOLIDATED INCOME",
  "sum-row-operativo": "OPERATING RESULTS MEXICO",
  "result-row": "CONSOLIDATED OPERATING RESULTS",
  "net-row": "NET RESULTS MEXICO",
  "result-net-row": "CONSOLIDATED NET RESULTS"
}
```

### Jerarquía de Operaciones RESUMEN

```
1. CUENTAS INDIVIDUALES
   ↓ (suma)
2. sum-row: "SUMA DE Membership"
   ↓ (agrupa)
3. sum-row-sumavarios: "INCOME"
   ↓ (consolida)
4. sum-row-sumavarios-consolidado: "CONSOLIDATED INCOME"
   ↓ (opera: Income - Expense)
5. sum-row-operativo: "OPERATING RESULTS MEXICO"
   ↓ (agrupa con result-row)
6. result-row: "CONSOLIDATED OPERATING RESULTS"
   ↓ (suma otros ingresos)
7. net-row: "NET RESULTS MEXICO"
   ↓ (consolida regiones)
8. result-net-row: "CONSOLIDATED NET RESULTS"
```

---

## 🔢 Fórmulas Excel Originales

### 📍 Archivo Completo de Fórmulas

**Archivo:** `info IMPORTANTE/METADATA/PPTO/formulasppto.json`

**Contenido:** 69,662 líneas con TODAS las fórmulas del Excel original

**Estructura:**
```json
{
  "sheet": "RESUMEN",
  "cell": "D5",
  "row": 5,
  "col": 4,
  "formula_a1": "=SUM(D6,D9,D11,D13)",
  "formula_r1c1": "=SUM(R[1]C,R[4]C,R[6]C,R[8]C)",
  "value_if_any": "=SUM(D6,D9,D11,D13)"
}
```

**Tipos de Fórmulas:**
- `SUM()`: Sumatoria simple
- `SUMIF()`: Suma condicional
- `IF(IFERROR())`: Validaciones y divisiones
- División para variaciones: `(Real/Ppto - 1)`

**Ejemplo de Variación:**
```json
{
  "cell": "G5",
  "formula_a1": "=IF((IFERROR(D5/F5,0))=0,0,(IFERROR(D5/F5,0)-1))"
}
```

**Traducción:**
```javascript
// Si (Real/Ppto) es 0, devuelve 0
// Sino: (Real/Ppto - 1) = variación porcentual
```

---

## 🎯 Flujo Completo de Ejecución

### 1. Usuario Selecciona Módulo

```
Usuario → Click en "Presupuestos"
         ↓
vistas/Presupuestos.html carga
         ↓
vistas/js/planeacion-modulo-vista.js se inicializa
         ↓
vistas/js/cuentas-modulo.js carga datos
```

### 2. Carga de Configuración

```javascript
// Paso 1: Leer CUENTAS.json
fetch('/api/cuentas?modulo=presupuestos')
  ↓
// Paso 2: Leer datos de Firebird
fetch('/api/saldos?empresa=EMPRESA01&anio=2025')
  ↓
// Paso 3: Leer datos de presupuesto
fetch('/api/presupuestos?empresa=EMPRESA01&anio=2025')
```

### 3. Construcción de Tabla

```javascript
// vistas/js/cuentas-modulo.js
renderizarTabla() {
  // Paso 1: Crear estructura HTML
  for (seccion in cuentas) {
    crearEncabezadoSeccion(seccion);
    
    for (cuenta in seccion) {
      crearFilaCuenta(cuenta); // ← Datos originales
    }
    
    agregarFilaResumen({
      texto: "SUMA DE " + seccion,
      clase: "sum-row"  // ← SUMA de cuentas de esta sección
    });
  }
  
  // Paso 2: Calcular sumas
  recalcularSumas(); // ← AQUÍ SE EJECUTAN LAS OPERACIONES
}
```

### 4. Ejecución de Operaciones

```javascript
recalcularSumas() {
  // Para cada fila sum-row:
  const filasSum = tabla.querySelectorAll('.sum-row');
  
  filasSum.forEach(fila => {
    // Encuentra cuentas hijas de esta sección
    const cuentasHijas = encontrarCuentasDeSeccion(fila);
    
    // Suma cada columna (12 meses)
    for (let mes = 0; mes < 12; mes++) {
      let total = 0;
      
      cuentasHijas.forEach(cuenta => {
        const valor = parseFloat(cuenta.columnas[mes].valor);
        total += valor; // ← SUMA
      });
      
      fila.columnas[mes].textContent = formatNumber(total);
    }
  });
  
  // Para cada fila sum-row-sumavarios:
  const filasSumavarios = tabla.querySelectorAll('.sum-row-sumavarios');
  
  filasSumavarios.forEach(fila => {
    // Suma varios sum-rows según configuración JSON
    const config = CUENTAS_SUMMARY_RESUMEN.find(c => 
      c['sum-row-sumavarios'] === fila.textContent
    );
    
    const sumRowsIncluidos = config.secciones; // ["Membership", "Events", ...]
    
    for (let mes = 0; mes < 12; mes++) {
      let total = 0;
      
      sumRowsIncluidos.forEach(seccionNombre => {
        const sumRow = encontrarSumRow(seccionNombre);
        total += parseFloat(sumRow.columnas[mes].valor); // ← SUMA
      });
      
      fila.columnas[mes].textContent = formatNumber(total);
    }
  });
  
  // Para cada fila result-row:
  const filasResult = tabla.querySelectorAll('.result-row');
  
  filasResult.forEach(fila => {
    const config = CUENTAS_SUMMARY_RESUMEN.find(c => 
      c['result-row'] === fila.textContent
    );
    
    // Operating Results = Income - Expense
    const income = encontrarFila(config['sum-row-sumavarios-income']);
    const expense = encontrarFila(config['sum-row-sumavarios-expense']);
    
    for (let mes = 0; mes < 12; mes++) {
      const valorIncome = parseFloat(income.columnas[mes].valor);
      const valorExpense = parseFloat(expense.columnas[mes].valor);
      
      const resultado = valorIncome - valorExpense; // ← RESTA
      
      fila.columnas[mes].textContent = formatNumber(resultado);
    }
  });
}
```

### 5. Cálculo de Variaciones

```javascript
// Para columnas de variación porcentual
calcularVariacion(real, presupuesto) {
  if (presupuesto === 0) return 0;
  
  const variacion = (real / presupuesto) - 1; // ← DIVISIÓN Y RESTA
  return variacion * 100; // Convertir a porcentaje
}
```

---

## 📋 Resumen por Módulo

| Módulo | Archivo Config | Archivo JS | Función Clave | Operaciones |
|--------|---------------|------------|---------------|-------------|
| **Presupuestos** | CUENTAS.json | cuentas-modulo.js | recalcularSumas() | SUM por sección |
| **Finanzas** | CUENTAS.json | cuentas-modulo.js | recalcularSumas() | SUM por sección |
| **Comités** | CUENTAS.json | cuentas-modulo.js | recalcularSumas() | SUM por sección |
| **Comunicación** | CUENTAS.json | cuentas-modulo.js | recalcularSumas() | SUM por sección |
| **Eventos** | CUENTAS.json | cuentas-modulo.js | recalcularSumas() | SUM por sección |
| **Gtos_Corporativos** | CUENTAS.json | cuentas-modulo.js | recalcularSumas() | SUM por sección |
| **Membresía** | CUENTAS.json | cuentas-modulo.js | recalcularSumas() | SUM por sección |
| **RH** | CUENTAS.json | cuentas-modulo.js | recalcularSumas() | SUM por sección |
| **Serv_Membresía** | CUENTAS.json | cuentas-modulo.js | recalcularSumas() | SUM por sección |
| **T&IC** | CUENTAS.json | cuentas-modulo.js | recalcularSumas() | SUM por sección |
| **VPE** | CUENTAS.json | cuentas-modulo.js | recalcularSumas() | SUM por sección |
| **Dirección** | CUENTAS.json | cuentas-modulo.js | recalcularSumas() | SUM por sección |
| **SUMMARY** | CUENTAS SUMMARY y RESUMEN.json | summary-view.js | Lógica propia | SUM jerárquico + factores |
| **RESUMEN** | CUENTAS SUMMARY y RESUMEN.json | resumen-view.js | Lógica propia | SUM jerárquico + net results |

---

## 🔍 Ejemplos Concretos

### Ejemplo 1: Suma Simple en Presupuestos

**Configuración:**
```json
// CUENTAS.json
{
  "Presupuestos": [
    {"SECCION": "INGRESOS MEMBRESÍAS", "CUENTA": "401"},
    {"SECCION": "INGRESOS MEMBRESÍAS", "CUENTA": "402"}
  ]
}
```

**Ejecución:**
```javascript
// cuentas-modulo.js línea ~1500
agregarFilaResumen({
  texto: "SUMA INGRESOS MEMBRESÍAS",
  clase: "sum-row"
});

// Luego en recalcularSumas():
suma = cuenta401.valor + cuenta402.valor; // ← OPERACIÓN
```

### Ejemplo 2: Consolidación en SUMMARY

**Configuración:**
```json
// CUENTAS SUMMARY y RESUMEN.json
{
  "sum-row": "SUMA DE Membership",
  "sum-row-sumavarios": "CDMX Income"
}
```

**Ejecución:**
```javascript
// summary-view.js
CDMX_Income = 
  SUMA_DE_Membership + 
  SUMA_DE_Events + 
  SUMA_DE_Committees + 
  SUMA_DE_Services; // ← OPERACIÓN
```

### Ejemplo 3: Operating Results

**Configuración:**
```json
{
  "sum-row-operativo": "OPERATING RESULTS MEXICO",
  "result-row": "CONSOLIDATED OPERATING RESULTS"
}
```

**Ejecución:**
```javascript
// summary-view.js
Operating_Results = 
  CONSOLIDATED_INCOME * 1 +      // factor 1 (suma)
  CONSOLIDATED_EXPENSES * (-1);  // factor -1 (resta)
                                 // ← OPERACIÓN
```

---

## ✅ Verificación de Operaciones

### Cómo Verificar que las Sumas son Correctas

1. **Abrir DevTools** (F12)
2. **Ir a Console**
3. **Ejecutar:**
```javascript
// Ver todas las filas sum-row
document.querySelectorAll('.sum-row').forEach(fila => {
  console.log(fila.children[1].textContent, fila.children[2].textContent);
});

// Ver metadata de configuración
console.log(window.CUENTAS_CONFIG);

// Forzar recálculo
recalcularSumas();
```

---

## 🎓 Conclusiones

### Dónde se Decide Cada Operación:

1. **Estructura:** `CUENTAS.json` y `CUENTAS SUMMARY y RESUMEN.json`
2. **Fórmulas:** `formulasppto.json` (69,662 líneas de fórmulas Excel)
3. **Ejecución:** 
   - 11 módulos → `cuentas-modulo.js` función `recalcularSumas()`
   - SUMMARY → `summary-view.js` con factores y jerarquías
   - RESUMEN → `resumen-view.js` con net-rows adicionales

### Cuándo se Ejecutan:

- Al cargar datos
- Al editar celdas
- Al insertar/eliminar filas
- Al cambiar de año/empresa
- Al activar/desactivar toggle de redondeo

### Qué Operaciones se Hacen:

- **SUM:** Suma de cuentas por sección
- **SUM de SUM:** Suma de secciones (sumavarios)
- **Resta:** Income - Expense = Operating Results
- **División:** (Real / Ppto - 1) * 100 = Variación %
- **Factores:** Multiplicación por 1, -1, 0.5, etc.

---

**Fecha de Creación:** 11 de diciembre de 2025  
**Autor:** Sistema SummaCham  
**Versión:** 1.0
