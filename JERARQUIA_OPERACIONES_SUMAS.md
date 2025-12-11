# 🏗️ Jerarquía de Operaciones de Sumas e Inserción Inteligente

## 📊 PARTE 1: Explicación de Cada Tipo de Operación

### 🔵 1. sum-row (Suma de Sección)

**Definición:**
Suma vertical de **todas las cuentas** que pertenecen a una sección específica.

**Fórmula:**
```
sum-row = Σ(todas las cuentas de la sección)
```

**Ejemplo Visual:**
```
Sección: "INGRESOS MEMBRESÍAS"
├── Cuenta 401: Membership Dues      [1000, 2000, 1500, ...]
├── Cuenta 402: Membership Fees      [500, 1000, 750, ...]
├── Cuenta 403: Membership Upgrade   [200, 300, 250, ...]
└── sum-row: "SUMA DE Membership"    [1700, 3300, 2500, ...] ← SUMA
```

**Configuración en JSON:**
```json
{
  "SECCION": "Membership",
  "sum-row": "SUMA DE Membership"
}
```

**Código de Ejecución:**
```javascript
// cuentas-modulo.js líneas 2426-2458
const listas = seccion.filasCuenta.map((fila) => {
  return extraerValoresNumericos(fila); // [ene, feb, mar, ...]
});
const valores = sumarListas(listas, 12); // Suma columna por columna
seccion.sumValues = valores;
```

**Cuándo se actualiza:**
- Al insertar/eliminar filas de cuenta
- Al editar valores en celdas
- Al cargar datos del backend
- Al cambiar mes/año

---

### 🟢 2. sum-row-sumavarios (Suma Consolidada de Secciones)

**Definición:**
Suma horizontal de **varios sum-rows** que comparten la misma etiqueta. Consolida múltiples secciones en un solo total.

**Fórmula:**
```
sum-row-sumavarios = Σ(sum-rows con misma etiqueta)
```

**Ejemplo Visual:**
```
sum-row-sumavarios: "CDMX Income"
├── sum-row "SUMA DE Membership":    [1700, 3300, 2500]
├── sum-row "SUMA DE Events":        [800, 1200, 900]
├── sum-row "SUMA DE Committees":    [300, 500, 400]
└── sumavarios "CDMX Income":        [2800, 5000, 3800] ← SUMA de sum-rows
```

**Configuración en JSON:**
```json
{
  "SECCION": "Membership",
  "sum-row": "SUMA DE Membership",
  "sum-row-sumavarios": "CDMX Income"  ← Etiqueta de agrupación
},
{
  "SECCION": "Events",
  "sum-row": "SUMA DE Events",
  "sum-row-sumavarios": "CDMX Income"  ← Misma etiqueta
},
{
  "SECCION": "Committees",
  "sum-row": "SUMA DE Committees",
  "sum-row-sumavarios": "CDMX Income"  ← Misma etiqueta
}
```

**Código de Ejecución:**
```javascript
// cuentas-modulo.js líneas 2463-2497
const acumuladosSumavarios = new Map();

secciones.forEach((seccion) => {
  const clave = normalizarClave(seccion.sumRowSumavariosTexto);
  if (!clave) return;
  
  // Acumular valores de sum-rows bajo la misma etiqueta
  const prev = acumuladosSumavarios.get(clave) || [0, 0, 0, ...];
  seccion.sumValues.forEach((valor, idx) => {
    prev[idx] += valor; // Sumar columna por columna
  });
  acumuladosSumavarios.set(clave, prev);
});
```

**Uso típico:**
- Consolidar ingresos de múltiples fuentes: "CDMX Income"
- Consolidar gastos de múltiples departamentos: "CDMX Expense"
- Agrupar regiones: "Guadalajara Income", "Monterrey Income"

---

### 🟡 3. sum-row-operativo (Resultado Operativo Regional)

**Definición:**
Resultado operativo de una **región específica** (CDMX, Guadalajara, Monterrey, etc.). Aplica factores de multiplicación a sumavarios (Income - Expense).

**Fórmula:**
```
sum-row-operativo = Income * (1) + Expense * (-1)
```

**Ejemplo Visual:**
```
sum-row-operativo: "OPERATING RESULTS MEXICO"
├── sumavarios "CDMX Income":           [2800, 5000, 3800] × 1
├── sumavarios "CDMX Expense":          [2000, 3500, 2800] × (-1)
└── operativo "OPERATING RESULTS MEXICO": [800, 1500, 1000] ← Income - Expense
```

**Configuración en JSON:**
```json
{
  "SECCION": "Membership",
  "sum-row": "SUMA DE Membership",
  "sum-row-sumavarios": "CDMX Income",
  "sum-row-sumavarios-consolidado": "CONSOLIDATED INCOME",
  "sum-row-operativo": "OPERATING RESULTS MEXICO"  ← Resultado regional
}
```

**Aplicación de Factores:**
```javascript
// summary-view.js (lógica conceptual)
const income = encontrarSumavarios("CDMX Income");
const expense = encontrarSumavarios("CDMX Expense");

for (let mes = 0; mes < 12; mes++) {
  operativo[mes] = income[mes] * 1 + expense[mes] * (-1);
}
```

**Uso:**
- Solo en módulos consolidados (SUMMARY, RESUMEN)
- Una fila por región/empresa
- Permite comparar rentabilidad entre regiones

---

### 🔴 4. result-row (Resultado Operativo Consolidado)

**Definición:**
Resultado operativo **global** que suma todos los `sum-row-operativo` de todas las regiones.

**Fórmula:**
```
result-row = Σ(todos los sum-row-operativo)
```

**Ejemplo Visual:**
```
result-row: "CONSOLIDATED OPERATING RESULTS"
├── operativo "OPERATING RESULTS MEXICO":      [800, 1500, 1000]
├── operativo "OPERATING RESULTS GUADALAJARA": [300, 600, 400]
├── operativo "OPERATING RESULTS MONTERREY":   [200, 400, 300]
└── result-row "CONSOLIDATED OPERATING":       [1300, 2500, 1700] ← SUMA
```

**Configuración en JSON:**
```json
{
  "SECCION": "Membership",
  "sum-row": "SUMA DE Membership",
  "sum-row-sumavarios": "CDMX Income",
  "sum-row-operativo": "OPERATING RESULTS MEXICO",
  "result-row": "CONSOLIDATED OPERATING RESULTS"  ← Consolidado final
}
```

**Código de Ejecución:**
```javascript
// cuentas-modulo.js líneas 2500-2520
const acumuladosResultado = new Map();

secciones.forEach((seccion) => {
  const clave = normalizarClave(seccion.resultRowTexto);
  if (!clave) return;
  
  // Sumar sum-row de todas las secciones con misma etiqueta result-row
  const origen = seccion.sumValues;
  const prev = acumuladosResultado.get(clave) || [0, 0, ...];
  origen.forEach((valor, idx) => {
    prev[idx] += valor;
  });
  acumuladosResultado.set(clave, prev);
});
```

**Uso:**
- Resultado operativo global de toda la organización
- Usado para KPIs y reportes ejecutivos
- Aparece al final de SUMMARY

---

### 🟣 5. net-row (Resultado Neto Regional)

**Definición:**
Resultado neto de una **región específica** que incluye "Other Income/Expense" (ingresos/gastos extraordinarios) además del resultado operativo.

**Fórmula:**
```
net-row = sum-row-operativo + Other Income + Other Expense
```

**Ejemplo Visual (RESUMEN):**
```
net-row: "NET RESULTS MEXICO"
├── operativo "OPERATING RESULTS MEXICO":   [800, 1500, 1000]
├── sum-row "Other Income":                 [100, 200, 150]
├── sum-row "Other Expense":                [-50, -80, -60]
└── net-row "NET RESULTS MEXICO":           [850, 1620, 1090] ← Operating + Other
```

**Configuración en JSON:**
```json
{
  "HOJA": "RESUMEN",
  "SECCION": "Other Income",
  "sum-row": "SUMA DE Other Income",
  "sum-row-sumavarios": "Other Income",
  "sum-row-operativo": "OPERATING RESULTS MEXICO",
  "result-row": "CONSOLIDATED OPERATING RESULTS",
  "net-row": "NET RESULTS MEXICO"  ← Resultado neto regional
}
```

**Uso:**
- Solo en módulo **RESUMEN**
- No existe en SUMMARY (SUMMARY termina en result-row)
- Incluye ingresos/gastos financieros, extraordinarios, etc.

---

### 🔵 6. result-net-row (Resultado Neto Consolidado)

**Definición:**
Resultado neto **global** que suma todos los `net-row` de todas las regiones. Es el cierre final de RESUMEN.

**Fórmula:**
```
result-net-row = Σ(todos los net-row)
```

**Ejemplo Visual:**
```
result-net-row: "CONSOLIDATED NET RESULTS"
├── net-row "NET RESULTS MEXICO":      [850, 1620, 1090]
├── net-row "NET RESULTS GUADALAJARA": [320, 640, 430]
├── net-row "NET RESULTS MONTERREY":   [210, 420, 315]
└── result-net-row "CONSOLIDATED NET": [1380, 2680, 1835] ← SUMA final
```

**Configuración en JSON:**
```json
{
  "SECCION": "Other Income",
  "sum-row": "SUMA DE Other Income",
  "net-row": "NET RESULTS MEXICO",
  "result-net-row": "CONSOLIDATED NET RESULTS"  ← Cierre global
}
```

**Uso:**
- **Solo en RESUMEN**
- Última fila del reporte
- Representa la utilidad/pérdida neta total de la organización

---

## 🧠 PARTE 2: Lógica de Inserción Inteligente

### 🎯 Sistema de Detección Automática

El sistema es "inteligente" porque detecta automáticamente las nuevas filas y las integra en las operaciones existentes mediante **etiquetas compartidas**.

#### Proceso de Inserción:

```
1. Usuario inserta nueva fila de cuenta
   ↓
2. Sistema detecta la sección a la que pertenece
   ↓
3. Agrega fila al array meta.filasCuenta[]
   ↓
4. Ejecuta actualizarEstructuraDespuesCambio()
   ↓
5. recalcularSumas() re-procesa TODA la jerarquía
   ↓
6. Nuevos valores se propagan automáticamente
```

---

### 🔧 Función Clave: `actualizarEstructuraDespuesCambio()`

**Ubicación:** `cuentas-modulo.js` líneas 2081-2087

```javascript
const actualizarEstructuraDespuesCambio = () => {
  aplicarModoEdicionEnTabla();    // Re-habilita editabilidad
  recalcularSumas();               // ← AQUÍ SE RE-CALCULA TODO
  persistirLayoutActual();         // Guarda estructura en localStorage
  estadoModulo.hayCambios = true;  // Marca cambios pendientes
  notificarCambios();              // Dispara evento de cambio
};
```

**Se ejecuta automáticamente después de:**
- Insertar fila nueva
- Eliminar fila existente
- Agregar sección nueva
- Cambiar cuenta de una fila

---

### 📋 Metadata de Secciones: El Cerebro del Sistema

**Estructura en `estadoModulo.sumas.secciones`:**

```javascript
estadoModulo.sumas = {
  secciones: [
    {
      seccion: "ingresos membresías",           // Clave normalizada
      tituloVisible: "INGRESOS MEMBRESÍAS",     // Texto original
      filasCuenta: [                            // Array de HTMLTableRowElement
        <tr class="fila-cuenta" data-cuenta21="4101-010-000-00">,
        <tr class="fila-cuenta" data-cuenta21="4102-020-000-00">
      ],
      sumValues: [1700, 3300, 2500, ...],       // Valores calculados (12 meses)
      sumavariosValues: [2800, 5000, ...],      // Valores de sumavarios
      
      // ETIQUETAS DE AGRUPACIÓN:
      sumRowTexto: "suma de membership",         // sum-row normalizado
      sumRowSumavariosTexto: "cdmx income",      // sumavarios normalizado
      sumRowSumavariosLabel: "CDMX Income",      // sumavarios original
      resultRowTexto: "consolidated operating",  // result-row normalizado
      
      elementos: {
        header: <tr class="section-header-row">, // Encabezado visual
        sumRow: <tr class="sum-row">              // Fila sum-row en DOM
      }
    },
    // ... más secciones
  ],
  
  sumavariosRows: Map {                         // Filas sumavarios en DOM
    "cdmx income" => <tr class="sum-row-sumavarios">
  },
  
  resultRows: Map {                             // Filas result-row en DOM
    "consolidated operating" => <tr class="result-row">
  }
};
```

---

### 🧩 Ejemplo Completo: Inserción de Nueva Fila

#### Situación Inicial:

```
Sección: "INGRESOS MEMBRESÍAS"
├── 401: Membership Dues       [1000, 2000]
├── 402: Membership Fees       [500, 1000]
├── sum-row "SUMA Membership": [1500, 3000]  ← Automático
└── metadata: {
      sumRowSumavariosTexto: "cdmx income"
    }

sumavarios "CDMX Income":
├── sum-row "SUMA Membership": [1500, 3000]
├── sum-row "SUMA Events":     [800, 1200]
└── sumavarios total:          [2300, 4200]  ← Automático
```

#### Usuario Inserta Nueva Fila:

```javascript
// Click derecho en fila 402 → "Insertar abajo"
insertarFilaCuentaNueva(fila402, 'abajo');
```

**Paso 1: Crear fila vacía**
```javascript
const nuevaFila = crearFilaCuentaVacia(meta.seccion);
// Resultado: <tr class="fila-cuenta">
//   <td>cuenta-nueva-001</td>
//   <td contenteditable="true"></td>
//   <td>0.00</td> ... (12 meses)
// </tr>
```

**Paso 2: Insertar en DOM y metadata**
```javascript
meta.filasCuenta.splice(idx + 1, 0, nuevaFila);
// Array ahora: [fila401, fila402, nuevaFila, ...]
```

**Paso 3: Ejecutar actualización**
```javascript
actualizarEstructuraDespuesCambio();
  ↓
recalcularSumas();
```

#### recalcularSumas() - PASO 1: Calcular sum-row

```javascript
// Encontrar la sección
const seccion = meta; // "INGRESOS MEMBRESÍAS"

// Extraer valores de TODAS las filas (incluida la nueva)
const listas = seccion.filasCuenta.map((fila) => {
  return extraerValoresNumericos(fila);
});

// Resultado:
listas = [
  [1000, 2000],  // fila 401
  [500, 1000],   // fila 402
  [0, 0]         // nueva fila (vacía)
];

// Sumar columna por columna
const valores = sumarListas(listas, 12);
// valores = [1500, 3000] (sin cambios porque nueva fila = 0)

// Actualizar sum-row en el DOM
seccion.elementos.sumRow.cells[2].textContent = "1,500.00";
seccion.elementos.sumRow.cells[3].textContent = "3,000.00";
```

#### recalcularSumas() - PASO 2: Calcular sumavarios

```javascript
// Buscar todas las secciones con etiqueta "cdmx income"
const acumuladosSumavarios = new Map();

secciones.forEach((seccion) => {
  const clave = normalizarClave(seccion.sumRowSumavariosTexto);
  // clave = "cdmx income"
  
  if (clave === "cdmx income") {
    const prev = acumuladosSumavarios.get(clave) || [0, 0];
    seccion.sumValues.forEach((valor, idx) => {
      prev[idx] += valor;
    });
    acumuladosSumavarios.set(clave, prev);
  }
});

// Resultado:
acumuladosSumavarios = {
  "cdmx income": [
    1500 + 800,  // Membership + Events
    3000 + 1200
  ] = [2300, 4200]
};

// Actualizar sumavarios en el DOM
const filaSumavarios = estadoModulo.sumas.sumavariosRows.get("cdmx income");
filaSumavarios.cells[2].textContent = "2,300.00";
filaSumavarios.cells[3].textContent = "4,200.00";
```

#### Usuario Edita la Nueva Fila:

```javascript
// Usuario escribe en nueva fila: cuenta "403", valores [200, 300]
manejarCambioCuenta(nuevaFila, celda);
actualizarPresupuestoCelda(nuevaFila, 'real-ene', 200);
actualizarPresupuestoCelda(nuevaFila, 'real-feb', 300);
```

**Cada edición ejecuta `recalcularSumas()` automáticamente:**

```javascript
// PASO 1: sum-row se actualiza
listas = [
  [1000, 2000],
  [500, 1000],
  [200, 300]  // ← Nuevos valores
];
valores = [1700, 3300]; // ← sum-row actualizado

// PASO 2: sumavarios se actualiza
acumuladosSumavarios["cdmx income"] = [
  1700 + 800,  // Membership + Events
  3300 + 1200
] = [2500, 4500]; // ← sumavarios actualizado automáticamente
```

**Sin código adicional, la nueva fila ya está integrada en TODA la jerarquía.**

---

### 🎨 Creación Inteligente de Nuevas Operaciones

#### Escenario: Agregar Nueva Sección con Nueva Etiqueta

**Usuario crea sección nueva:**
```
Sección: "SERVICIOS ESPECIALES"
Etiqueta sumavarios: "CDMX Services"  ← Nueva etiqueta
```

**Sistema automáticamente:**

1. **Crea fila sum-row:**
```javascript
metaSeccion.elementos.sumRow = agregarFilaResumen({
  texto: "SUMA DE Servicios Especiales",
  clase: "sum-row"
});
```

2. **Registra nueva etiqueta sumavarios:**
```javascript
const registrarSumario = (texto) => {
  const clave = normalizarTexto(texto);
  sumavariosData.set(clave, { texto, meta: metaSeccion });
};
registrarSumario("CDMX Services");
```

3. **Crea fila sumavarios automáticamente:**
```javascript
// En renderizarTabla() después de procesar todas las secciones
sumavariosData.forEach((dato, clave) => {
  const filaSumarios = agregarFilaResumen({
    texto: dato.texto,  // "CDMX Services"
    clase: 'sum-row-sumavarios'
  });
  estadoModulo.sumas.sumavariosRows.set(clave, filaSumarios);
});
```

4. **recalcularSumas() automáticamente suma la nueva etiqueta:**
```javascript
secciones.forEach((seccion) => {
  const clave = normalizarClave(seccion.sumRowSumavariosTexto);
  if (clave === "cdmx services") {
    // Acumular valores automáticamente
    const prev = acumuladosSumavarios.get(clave) || [0, 0, ...];
    seccion.sumValues.forEach((valor, idx) => {
      prev[idx] += valor;
    });
    acumuladosSumavarios.set(clave, prev);
  }
});
```

**Resultado:** Nueva operación `sum-row-sumavarios` creada y calculada sin código adicional.

---

### 🔄 Diagrama de Flujo de Inteligencia

```
┌─────────────────────────────────────────────┐
│  Usuario realiza acción                     │
│  (Insertar/Editar/Eliminar)                 │
└─────────────┬───────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│  actualizarEstructuraDespuesCambio()        │
└─────────────┬───────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│  recalcularSumas()                          │
│  ┌─────────────────────────────────────┐   │
│  │ PASO 1: sum-row                     │   │
│  │ • Lee meta.filasCuenta[]            │   │
│  │ • Suma todas las cuentas            │   │
│  │ • Actualiza seccion.sumValues       │   │
│  └─────────────────────────────────────┘   │
│  ┌─────────────────────────────────────┐   │
│  │ PASO 2: sum-row-sumavarios          │   │
│  │ • Agrupa por etiqueta               │   │
│  │ • Suma sum-rows del mismo grupo     │   │
│  │ • Actualiza sumavariosRows          │   │
│  └─────────────────────────────────────┘   │
│  ┌─────────────────────────────────────┐   │
│  │ PASO 3: result-row                  │   │
│  │ • Agrupa por etiqueta result        │   │
│  │ • Suma sum-rows con misma etiqueta  │   │
│  │ • Actualiza resultRows              │   │
│  └─────────────────────────────────────┘   │
└─────────────┬───────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│  persistirLayoutActual()                    │
│  Guarda estructura en localStorage          │
└─────────────┬───────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│  notificarCambios()                         │
│  Dispara evento para otros componentes      │
└─────────────────────────────────────────────┘
```

---

## 📊 PARTE 3: Jerarquía Completa en SUMMARY y RESUMEN

### SUMMARY (Income Statement)

```
Nivel 1: Cuentas Individuales
  ├── 401: Membership Dues
  ├── 402: Membership Fees
  └── 403: Membership Upgrade
        ↓ SUMA vertical
Nivel 2: sum-row (por sección)
  ├── "SUMA DE Membership"
  ├── "SUMA DE Events"
  └── "SUMA DE Committees"
        ↓ SUMA horizontal (por etiqueta)
Nivel 3: sum-row-sumavarios (consolidado regional)
  ├── "CDMX Income"
  ├── "Guadalajara Income"
  └── "Monterrey Income"
        ↓ SUMA de regiones
Nivel 4: sum-row-sumavarios-consolidado (consolidado global)
  └── "CONSOLIDATED INCOME"
        ↓ Aplicar factores (Income *1, Expense *-1)
Nivel 5: sum-row-operativo (resultado operativo regional)
  ├── "OPERATING RESULTS MEXICO"
  ├── "OPERATING RESULTS GUADALAJARA"
  └── "OPERATING RESULTS MONTERREY"
        ↓ SUMA de regiones
Nivel 6: result-row (resultado operativo global)
  └── "CONSOLIDATED OPERATING RESULTS"  ← CIERRE DE SUMMARY
```

### RESUMEN (Balance Sheet + P&L)

```
Nivel 1: Cuentas Individuales
  └── (igual que SUMMARY)
        ↓
Nivel 2: sum-row
  └── (igual que SUMMARY)
        ↓
Nivel 3: sum-row-sumavarios
  └── (igual que SUMMARY)
        ↓
Nivel 4: sum-row-sumavarios-consolidado
  └── (igual que SUMMARY)
        ↓
Nivel 5: sum-row-operativo
  └── (igual que SUMMARY)
        ↓
Nivel 6: result-row
  └── "CONSOLIDATED OPERATING RESULTS"
        ↓ CONTINÚA (exclusivo de RESUMEN)
        + Other Income (sum-row)
        + Other Expense (sum-row)
        ↓
Nivel 7: net-row (resultado neto regional)
  ├── "NET RESULTS MEXICO"
  ├── "NET RESULTS GUADALAJARA"
  └── "NET RESULTS MONTERREY"
        ↓ SUMA de regiones
Nivel 8: result-net-row (resultado neto global)
  └── "CONSOLIDATED NET RESULTS"  ← CIERRE DE RESUMEN
```

---

## 🎯 PARTE 4: Ventajas del Sistema Inteligente

### ✅ 1. Asimilación Automática

**Problema clásico:**
```
Usuario agrega nueva cuenta → ¿Se suma correctamente?
```

**Solución SummaCham:**
```javascript
// Sistema detecta metadata de la sección
const meta = obtenerMetaSeccionPorFila(nuevaFila);

// Agrega a array
meta.filasCuenta.push(nuevaFila);

// recalcularSumas() automáticamente:
// 1. Lee TODO el array (incluida nueva fila)
// 2. Suma columna por columna
// 3. Propaga a sumavarios/result-row automáticamente
```

**Sin código adicional, la fila ya está integrada.**

---

### ✅ 2. Propagación en Cascada

**Una edición dispara toda la cadena:**

```
Usuario edita cuenta 401:
  ↓
sum-row "SUMA Membership" se actualiza
  ↓
sumavarios "CDMX Income" se actualiza
  ↓
sumavarios-consolidado "CONSOLIDATED INCOME" se actualiza
  ↓
operativo "OPERATING RESULTS MEXICO" se actualiza
  ↓
result-row "CONSOLIDATED OPERATING" se actualiza

TODO automáticamente con UN SOLO recalcularSumas()
```

---

### ✅ 3. Tolerancia a Etiquetas

**Sistema normaliza etiquetas:**

```javascript
const normalizarClave = (texto) => {
  return texto.toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remover acentos
};
```

**Resultado:**
```
"CDMX Income" → "cdmx income"
"cdmx  income" → "cdmx income"  ← Espacios múltiples
"CDMX   INCOME" → "cdmx income" ← Mayúsculas
```

**Todas se agrupan correctamente.**

---

### ✅ 4. Metadata Persistente

**Estructura se guarda en localStorage:**

```javascript
const persistirLayoutActual = () => {
  const layout = {
    secciones: estadoModulo.sumas.secciones.map(meta => ({
      seccion: meta.seccion,
      sumRowTexto: meta.sumRowTexto,
      sumRowSumavariosTexto: meta.sumRowSumavariosTexto,
      resultRowTexto: meta.resultRowTexto,
      cuentas: meta.filasCuenta.map(f => f.dataset.cuenta21)
    }))
  };
  
  localStorage.setItem(`layout_${modulo}_${anio}`, JSON.stringify(layout));
};
```

**Al recargar página, estructura se restaura exactamente igual.**

---

## 🎓 Conclusión

### Resumen de Operaciones:

| Operación | Nivel | Qué Suma | Dónde Existe |
|-----------|-------|----------|--------------|
| **sum-row** | 2 | Cuentas de una sección | Todos los módulos |
| **sum-row-sumavarios** | 3 | Varios sum-rows por etiqueta | Todos |
| **sum-row-operativo** | 5 | Income - Expense (con factores) | SUMMARY, RESUMEN |
| **result-row** | 6 | Todos los sum-rows con etiqueta | Todos |
| **net-row** | 7 | Operating + Other Income/Expense | Solo RESUMEN |
| **result-net-row** | 8 | Todos los net-rows | Solo RESUMEN |

### El sistema es inteligente porque:

1. **Detecta automáticamente** la sección de nuevas filas
2. **Asimila** nuevas cuentas a sum-rows existentes
3. **Propaga** cambios en cascada por toda la jerarquía
4. **Crea** nuevas operaciones si detecta nuevas etiquetas
5. **Normaliza** etiquetas para agrupar correctamente
6. **Persiste** estructura para mantener coherencia

**Sin necesidad de código adicional, cada inserción/edición mantiene la integridad de TODAS las operaciones.**

---

**Fecha:** 11 de diciembre de 2025  
**Versión:** 1.0
