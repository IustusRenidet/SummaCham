# Análisis del Problema en Summary

## 🔴 Problema Identificado

El reporte Summary tiene **dos problemas críticos**:

1. **Faltan filas/cuentas** - No se están mostrando todas las cuentas definidas en los CSV
2. **Orden incorrecto** - Las filas no siguen la jerarquía correcta del Excel original

---

## 📊 Estructura Correcta Según CSV

### De `SUMMARY Ciudad de México.csv`:

**INCOME (Ingresos):**
```
Membership:
  - 401000000000000000001 | Cuotas Netas
  - 402000000000000000001 | Ingresos socios nuevos  
  - 412000000000000000001 | Economex
  → TOTAL Membership

Events:
  - 407000000000000000001 | Eventos
  - 408000000000000000001 | Patrocinios
  → TOTAL Events

Committees:
  - 417000000000000000001 | Committees
  - 403000000000000000001 | Patrocinios por Comites
  → TOTAL Committees

Services to Members:
  - 409000000000000000001 | Venta Publicaciones
  - 406000000000000000001 | Bolsa de Trabajo
  → TOTAL Services to Members

→ TOTAL CDMX Income (suma de todas las secciones anteriores)
→ TOTAL CONSOLIDATED INCOME (suma multi-empresa)
```

**EXPENSE (Gastos):**
```
Membership:
  - 705000000000000000001 | Gastos Promoción
  → TOTAL Membership

Events:
  - 701000000000000000001 | Costo Eventos
  → TOTAL Events

Committees:
  - 702000000000000000001 | Servicio a la membresia
  - 704000000000000000001 | Portafolio Económico
  → TOTAL Committees

Services to Members:
  - 601000000000000000001 | Costo directo de publicaciones
  → TOTAL Services to Members

Gastos administrativos:
  - 801001000000000000002 | Desarrollo de Negocios
  - 801002000000000000002 | Relaciones Externas
  - 801003000000000000002 | Servicios a las membresia
  - 801004000000000000002 | Vicepresidencia
  - 801005000000000000002 | Finanzas
  - 801006000000000000002 | Administración
  - 801007000000000000002 | Sistemas
  - 801008000000000000002 | Empleos
  - 801009000000000000002 | Servicios Generales (Almacén)
  - 801010000000000000002 | Eventos
  - 801011000000000000002 | Comites
  - 801012000000000000002 | Renta de Salas
  - 801013000000000000002 | Comunicación
  → TOTAL Gastos administrativos

Other:
  - 901000000000000000001 | Gastos Generales
  → TOTAL Other

Gastos de Nomina:
  - 513000000000000000001 | Nomina Vicepresidencia
  - 517000000000000000001 | Nomina Desarrollo de Negocios
  - 516000000000000000001 | Nomina Comites y Relaciones Externas
  - 519000000000000000001 | Nomina Comunicación
  - 515000000000000000001 | Nomina Servicios a la Membresia
  - 518000000000000000001 | Nomina Eventos y Mercadotecnia
  - 514000000000000000001 | Nomina Administración y Finanzas
  → TOTAL Gastos de Nomina

→ TOTAL CDMX Expense
→ TOTAL CONSOLIDATED EXPENSES
```

**RESULTADOS:**
```
→ OPERATING RESULTS MEXICO 
   = (CDMX Income) - (CDMX Expense)
   
→ CONSOLIDATED OPERATING RESULTS
   = (CONSOLIDATED INCOME) - (CONSOLIDATED EXPENSES)
```

**OTHER INCOME (Otros Ingresos):**
```
México Other Income:
  - 413000000000000000001 | Otros Ingresos
  - 414000000000000000001 | Intereses Bancos
  - 416000000000000000001 | Utilidad Cambiaria Inversiones
  - 418000000000000000001 | Plusvalia/Minusvalia Portafolio Inversiones
  → TOTAL México Other Income
```

**RESULTADO FINAL:**
```
→ NET RESULTS MEXICO
   = OPERATING RESULTS MEXICO + México Other Income
   
→ CONSOLIDATED NET RESULTS
   = CONSOLIDATED OPERATING RESULTS + (suma de todos los Other Income)
```

---

## 🔍 Análisis de `SUMAS CIUDAD DE MEXICO.csv`

Este CSV define la **lógica de acumulación en cascada**:

| Capítulo | Clase | Sección | Operación | Paso 1 | Op | Paso 2 | Op | Paso 3 | Op | Paso 4 |
|----------|-------|---------|-----------|--------|-------|--------|-------|--------|-------|--------|
| CDMX | income-Membership | Membership | sumar | CDMX Income | suma | CONSOLIDATED INCOME | suma | OPERATING RESULTS MEXICO | suma | CONSOLIDATED OPERATING RESULTS |
| CDMX | expense-Membership | Membership | sumar | CDMX Expense | suma | CONSOLIDATED EXPENSES | resta | OPERATING RESULTS MEXICO | suma | CONSOLIDATED OPERATING RESULTS |

**Interpretación:**

1. **Paso 1**: Suma todas las cuentas de Membership → CDMX Income
2. **Paso 2**: CDMX Income se suma a → CONSOLIDATED INCOME
3. **Paso 3**: CONSOLIDATED INCOME se suma/resta a → OPERATING RESULTS MEXICO
4. **Paso 4**: OPERATING RESULTS MEXICO se suma → CONSOLIDATED OPERATING RESULTS

**Para EXPENSES, la operación cambia a "resta"** en el paso del Operating Results.

---

## ⚙️ Mapeo de Columnas del CSV de Sumas

```
Columna 4 (operación.0) → sum-row           → Total de Sección
Columna 6 (operación.1) → sum-row-sumavarios → Total Consolidado (Income/Expense)
Columna 8 (operación.2) → sum-row-operativo  → Operating Results
Columna 10 (operación.3) → result-net-row    → Consolidated Operating Results
```

---

## 🐛 Problemas en el Código Actual

### 1. **No Todas las Cuentas se Están Cargando**

**Archivo**: `planeacionReportesEngine.js`

El código filtra cuentas basándose en `definicionCuentas`, pero puede estar:
- Saltando cuentas que no coinciden exactamente
- No normalizando correctamente las cuentas de 21 dígitos
- Perdiendo cuentas en el proceso de agrupación

### 2. **El Orden No Respeta el CSV**

El código usa `orden` basado en el índice del array:
```javascript
seccionOrden.set(seccionKey, Number.isFinite(idx) ? idx : seccionOrden.size + 1);
```

**Problema**: El índice del JSON no necesariamente refleja el orden del Excel original.

### 3. **Falta el Manejo de "Other Income" Separado**

El código agrupa todo en `layout` pero no diferencia claramente:
- Income/Expense (operativos)
- Other Income (no operativos)
- Operating Results
- Net Results

---

## ✅ Solución Propuesta

### Cambio 1: Agregar Campo `ORDEN` Explícito en el JSON

Modificar `CUENTAS SUMMARY y RESUMEN.json` para incluir:

```json
{
  "SUMMARY": [
    {
      "ORDEN": 1,
      "CAPITULO": "Ciudad de México",
      "CUENTA": "401000000000000000001",
      "NOMBRE": "Cuotas Netas",
      "SECCION": "Membership",
      "SECCIÓN Principal": "CDMX Income",
      "Clase": "income"
    },
    ...
  ]
}
```

### Cambio 2: Ordenar por el Campo `ORDEN` en el Motor

En `planeacionReportesEngine.js`:

```javascript
// En vez de usar idx, usar item.ORDEN
const ordenReal = Number.isFinite(item.ORDEN) ? item.ORDEN : idx;
seccionOrden.set(seccionKey, ordenReal);
```

### Cambio 3: Validar Todas las Cuentas

Agregar logging para detectar cuentas perdidas:

```javascript
console.log(`Total cuentas en JSON: ${definiciones.SUMMARY.length}`);
console.log(`Total cuentas cargadas: ${principalList.reduce((acc, p) => 
  acc + p.children.reduce((a2, s) => a2 + s.cuentas.length, 0), 0)}`);
```

### Cambio 4: Separar Claramente las Secciones en el Layout

```javascript
const layout = {
  income: [],      // INCOME sections
  expense: [],     // EXPENSE sections  
  operating: [],   // OPERATING RESULTS
  other: [],       // OTHER INCOME
  net: []          // NET RESULTS
};
```

---

## 📝 Pasos Siguientes

1. ✅ **Analizar el JSON actual** - Ver qué cuentas faltan
2. ⏳ **Agregar campo ORDEN** - Numerar secuencialmente según CSV
3. ⏳ **Modificar motor** - Ordenar por ORDEN en vez de índice
4. ⏳ **Validar salida** - Comparar con Excel original
5. ⏳ **Documentar diferencias** - Si hay discrepancias, documentarlas

---

## 🎯 Objetivo Final

**Summary debe mostrar exactamente**:

```
INCOME
  Membership
    Cuotas Netas
    Ingresos socios nuevos
    Economex
    → TOTAL Membership
  Events
    Eventos
    Patrocinios
    → TOTAL Events
  ...
  → TOTAL CDMX INCOME
  → TOTAL CONSOLIDATED INCOME

EXPENSE
  Membership
    Gastos Promoción
    → TOTAL Membership
  ...
  → TOTAL CDMX EXPENSE
  → TOTAL CONSOLIDATED EXPENSES

OPERATING RESULTS
  → OPERATING RESULTS MEXICO
  → CONSOLIDATED OPERATING RESULTS

OTHER INCOME
  México Other Income
    Otros Ingresos
    Intereses Bancos
    ...
    → TOTAL México Other Income

NET RESULTS
  → NET RESULTS MEXICO
  → CONSOLIDATED NET RESULTS
```

---

**Fecha**: Diciembre 9, 2025
**Estado**: Análisis completado, pendiente implementación
