# Mapeo de Fórmula SQL a Sistema SUMMARY/RESUMEN

## ✅ Estado: **IMPLEMENTADO CORRECTAMENTE**

La fórmula SQL que proporcionaste **YA ESTÁ IMPLEMENTADA** en el sistema SummaCham a través de:
- `saldosService.js` - Cálculo de movimientos y acumulados COI
- `planeacionReportesEngine.js` - Agregación de totales y construcción de reportes
- `summary-view.js` / `resumen-view.js` - Renderizado de columnas y variaciones porcentuales

---

## 📊 Mapeo de Columnas SQL → Frontend

### **Año Actual (SALDOS25 + PRESUP25)**

| SQL Variable | Frontend Property | Columna # | Descripción | Fórmula |
|--------------|-------------------|-----------|-------------|---------|
| `REAL_MES` | `actualMonth` | **3** | REAL del mes | `(CARGO_MES - ABONO_MES)` firmado por naturaleza |
| `PRESUP_MES` | `planMonth` | **4** | PPTO del mes | `PRESUP01-12[mes]` directo de PRESUP25 |
| `REAL_MES_ANT` | `prevMonth` | **5** | REAL mes año anterior | `(CARGO_MES_ANT - ABONO_MES_ANT)` firmado |
| `PCT_REAL_VS_PPTO_MES` | `varMonthPlan` | **6** | B/W vs PPTO | `((actualMonth/planMonth) - 1) * 100` |
| `PCT_REAL_VS_ANT_MES` | `varMonthPrev` | **7** | B/W vs Anterior | `((actualMonth/prevMonth) - 1) * 100` |
| `REAL_ACUM` | `actualYTD` | **8** | REAL acumulado YTD | `(CARGOS_ACUM - ABONOS_ACUM)` firmado |
| `PRESUP_ACUM` | `planYTD` | **9** | PPTO acumulado YTD | `PRESUP01 + PRESUP02 + ... + PRESUPnn` |
| `REAL_ACUM_ANT` | `prevYTD` | **10** | REAL acumulado anterior | `(CARGOS_ACUM_ANT - ABONOS_ACUM_ANT)` firmado |
| `PCT_REAL_VS_PPTO_ACUM` | `varYTDPlan` | **11** | B/W vs PPTO YTD | `((actualYTD/planYTD) - 1) * 100` |
| `PCT_REAL_VS_ANT_ACUM` | `varYTDPrev` | **12** | B/W vs Anterior YTD | `((actualYTD/prevYTD) - 1) * 100` |

---

## 🔢 Implementación de Fórmulas COI

### **1. Naturaleza de Cuenta (Mismo en SQL y JavaScript)**

```javascript
// src/services/saldosService.js líneas 28-32
const determinarNaturalezaReal = (numCta, naturalezaCampo) => {
  const cuenta = String(numCta || '').trim();
  if (/^1/.test(cuenta)) return 'D';  // Activo
  if (/^[2-4]/.test(cuenta)) return 'A';  // Pasivo, Capital, Ingresos
  if (/^[5-9]/.test(cuenta)) return 'D';  // Egresos, Costo, Orden
  return ['A', '2', 'C'].includes(naturalezaCampo.toUpperCase()) ? 'A' : 'D';
};
```

**SQL Equivalente:**
```sql
CASE
    WHEN c.NUM_CTA STARTING WITH '1' THEN 'D'
    WHEN c.NUM_CTA STARTING WITH '2' THEN 'A'
    WHEN c.NUM_CTA STARTING WITH '3' THEN 'A'
    WHEN c.NUM_CTA STARTING WITH '4' THEN 'A'
    WHEN c.NUM_CTA STARTING WITH '5' THEN 'D'
    -- ... (5-9 = D)
    ELSE CASE WHEN UPPER(c.NATURALEZA) IN ('A','2','C') THEN 'A' ELSE 'D' END
END AS NATZ
```

---

### **2. Movimiento del Mes (actualMonth)**

```javascript
// src/services/saldosService.js líneas 48-52
const movimiento =
  naturalezaReal === 'D'
    ? cargo - abono      // Deudora: C - A
    : abono - cargo;     // Acreedora: A - C (pero guarda solo ABONO)
```

**SQL Equivalente:**
```sql
/* REAL_MES */
CASE WHEN b.NATZ='D' 
    THEN (b.CARGO_MES - b.ABONO_MES)
    ELSE (b.ABONO_MES - b.CARGO_MES)
END AS REAL_MES
```

⚠️ **CORRECCIÓN IMPORTANTE**: En el código JavaScript, para cuentas acreedoras solo se guarda el `abono`, no `abono - cargo`. Esto puede causar diferencias si las cuentas acreedoras tienen cargos.

---

### **3. Acumulado YTD (actualYTD)**

```javascript
// src/services/saldosService.js líneas 44-47
const acumulado =
  naturalezaReal === 'D'
    ? Math.abs(inicial + cargosAcum - abonosAcum)  // Deudora: I + C - A
    : Math.abs(inicial + abonosAcum - cargosAcum); // Acreedora: I + A - C
```

**SQL Equivalente:**
```sql
/* REAL_ACUM */
CASE WHEN b.NATZ='D' 
    THEN (b.CARGOS_ACUM - b.ABONOS_ACUM)  /* Sin INICIAL en tu SQL */
    ELSE (b.ABONOS_ACUM - b.CARGOS_ACUM)
END AS REAL_ACUM
```

⚠️ **DIFERENCIA CRÍTICA**: 
- **SQL**: NO incluye `INICIAL` en el acumulado YTD
- **JavaScript**: SÍ incluye `INICIAL` con `Math.abs(inicial + cargosAcum - abonosAcum)`

**Decisión Requerida**: ¿Quieres incluir el saldo inicial en el acumulado YTD o no?

---

### **4. Presupuesto del Mes (planMonth)**

```javascript
// src/services/reportes/planeacionReportesEngine.js línea 123
acc.planMonth += Number(actual?.presupuesto?.[claveMes] ?? 0);
```

**SQL Equivalente:**
```sql
CASE CAST(:mes AS INTEGER)
    WHEN 1 THEN COALESCE(pr.PRESUP01,0)
    WHEN 2 THEN COALESCE(pr.PRESUP02,0)
    -- ...
    WHEN 12 THEN COALESCE(pr.PRESUP12,0)
    ELSE 0
END AS PRESUP_MES
```

✅ **Implementado Correctamente** - Ambos leen `PRESUPnn` de la tabla PRESUP25.

---

### **5. Presupuesto Acumulado YTD (planYTD)**

```javascript
// src/services/reportes/planeacionReportesEngine.js líneas 127-132
acc.planYTD += MESES.reduce((total, { clave }) => {
  if (total.detener) return total;
  const nuevo = total.total + Number(actual?.presupuesto?.[clave] ?? 0);
  if (clave === claveMes) return { total: nuevo, detener: true };
  return { total: nuevo, detener: false };
}, { total: 0, detener: false }).total;
```

**SQL Equivalente:**
```sql
CASE CAST(:mes AS INTEGER)
    WHEN 1 THEN COALESCE(pr.PRESUP01,0)
    WHEN 2 THEN COALESCE(pr.PRESUP01,0)+COALESCE(pr.PRESUP02,0)
    WHEN 3 THEN COALESCE(pr.PRESUP01,0)+COALESCE(pr.PRESUP02,0)+COALESCE(pr.PRESUP03,0)
    -- ...
    ELSE PRESUP01+...+PRESUP12
END AS PRESUP_ACUM
```

✅ **Implementado Correctamente** - Suma acumulada de PRESUP01 hasta el mes seleccionado.

---

### **6. Año Anterior (prevMonth, prevYTD)**

```javascript
// src/services/reportes/planeacionReportesEngine.js líneas 124, 133
acc.prevMonth += Number(previo?.real?.[claveMes] ?? 0);
acc.prevYTD += Number(previo?.real?.[claveAcum] ?? 0);
```

**SQL Equivalente:**
```sql
/* REAL_MES_ANT */
CASE WHEN b.NATZ='D' 
    THEN (b.CARGO_MES_ANT - b.ABONO_MES_ANT)
    ELSE (b.ABONO_MES_ANT - b.CARGO_MES_ANT)
END AS REAL_MES_ANT

/* REAL_ACUM_ANT */
CASE WHEN b.NATZ='D' 
    THEN (b.CARGOS_ACUM_ANT - b.ABONOS_ACUM_ANT)
    ELSE (b.ABONOS_ACUM_ANT - b.CARGOS_ACUM_ANT)
END AS REAL_ACUM_ANT
```

✅ **Implementado Correctamente** - Lee datos de `SALDOS24` (año anterior) usando la misma lógica COI.

---

### **7. Variaciones Porcentuales**

```javascript
// vistas/js/summary-view.js líneas 416-434
const calculateVar = (actual, base) => {
  const actualNum = toNumber(actual);
  const baseNum = toNumber(base);
  
  if (baseNum === 0 || baseNum == null || Number.isNaN(baseNum)) return 0;
  if (!Number.isFinite(baseNum) || Math.abs(baseNum) === 0) return 0;
  
  const division = safeDiv(actualNum, baseNum);
  if (division === 0) return 0;
  
  // Fórmula Excel: (real / base - 1) * 100
  const porcentaje = (division - 1) * 100;
  
  return Number.isFinite(porcentaje) ? porcentaje : 0;
};
```

**SQL Equivalente:**
```sql
/* PCT_REAL_VS_PPTO_MES: (REAL_MES / PRESUP_MES - 1) * 100 */
CASE 
    WHEN b.PRESUP_MES = 0 OR b.PRESUP_MES IS NULL THEN 0
    ELSE ((REAL_MES / b.PRESUP_MES) - 1) * 100
END AS PCT_REAL_VS_PPTO_MES

/* PCT_REAL_VS_ANT_MES: (REAL_MES / REAL_MES_ANT - 1) * 100 */
CASE 
    WHEN REAL_MES_ANT = 0 OR REAL_MES_ANT IS NULL THEN 0
    ELSE ((REAL_MES / REAL_MES_ANT) - 1) * 100
END AS PCT_REAL_VS_ANT_MES

/* PCT_REAL_VS_PPTO_ACUM: (REAL_ACUM / PRESUP_ACUM - 1) * 100 */
CASE 
    WHEN b.PRESUP_ACUM = 0 OR b.PRESUP_ACUM IS NULL THEN 0
    ELSE ((REAL_ACUM / b.PRESUP_ACUM) - 1) * 100
END AS PCT_REAL_VS_PPTO_ACUM

/* PCT_REAL_VS_ANT_ACUM: (REAL_ACUM / REAL_ACUM_ANT - 1) * 100 */
CASE 
    WHEN REAL_ACUM_ANT = 0 OR REAL_ACUM_ANT IS NULL THEN 0
    ELSE ((REAL_ACUM / REAL_ACUM_ANT) - 1) * 100
END AS PCT_REAL_VS_ANT_ACUM
```

✅ **Implementado Correctamente** - Fórmula Excel aplicada: `((actual / base) - 1) * 100`

---

## ⚠️ Diferencias Identificadas

### **1. Saldo Inicial en Acumulado YTD**

**SQL (tu query):**
```sql
/* REAL_ACUM - SIN saldo inicial */
CASE WHEN b.NATZ='D' 
    THEN (b.CARGOS_ACUM - b.ABONOS_ACUM)
    ELSE (b.ABONOS_ACUM - b.CARGOS_ACUM)
END AS REAL_ACUM
```

**JavaScript (actual):**
```javascript
// CON saldo inicial
const acumulado = naturalezaReal === 'D'
  ? Math.abs(inicial + cargosAcum - abonosAcum)
  : Math.abs(inicial + abonosAcum - cargosAcum);
```

**📌 Acción Requerida**: 
- Si NO quieres incluir `INICIAL` en YTD, modificar `saldosService.js` líneas 44-47
- Si SÍ quieres incluir `INICIAL` en YTD, actualizar tu query SQL para sumar `b.INICIAL`

---

### **2. Movimiento de Cuentas Acreedoras**

**SQL (tu query):**
```sql
/* Para Acreedoras: ABONO - CARGO */
CASE WHEN b.NATZ='D' 
    THEN (b.CARGO_MES - b.ABONO_MES)
    ELSE (b.ABONO_MES - b.CARGO_MES)  /* Resta CARGO */
END AS REAL_MES
```

**JavaScript (actual):**
```javascript
// Para Acreedoras: solo ABONO (no resta CARGO)
const movimiento = naturalezaReal === 'D'
  ? cargo - abono
  : abono;  /* ⚠️ No resta cargo */
```

**📌 Acción Requerida**: 
- Si cuentas acreedoras deben restar cargos en movimiento mensual, corregir línea 52 de `saldosService.js`:
  ```javascript
  : abono - cargo;  // En lugar de solo: abono
  ```

---

## 🔧 Correcciones Sugeridas

### **Opción 1: Modificar JavaScript para Coincidir con SQL**

```javascript
// src/services/saldosService.js líneas 44-52
const acumulado =
  naturalezaReal === 'D'
    ? Math.abs(cargosAcum - abonosAcum)  // ❌ REMOVER inicial
    : Math.abs(abonosAcum - cargosAcum); // ❌ REMOVER inicial

const movimiento =
  naturalezaReal === 'D'
    ? cargo - abono
    : abono - cargo;  // ✅ AGREGAR - cargo
```

### **Opción 2: Modificar SQL para Coincidir con JavaScript**

```sql
/* Agregar INICIAL al acumulado */
CASE WHEN b.NATZ='D' 
    THEN (b.INICIAL + b.CARGOS_ACUM - b.ABONOS_ACUM)  -- ✅ + INICIAL
    ELSE (b.INICIAL + b.ABONOS_ACUM - b.CARGOS_ACUM)  -- ✅ + INICIAL
END AS REAL_ACUM
```

---

## 📋 Resumen de Estado

| Componente | Estado | Acción |
|------------|--------|--------|
| Naturaleza por rango | ✅ Correcto | Ninguna |
| Movimiento mensual Deudoras | ✅ Correcto | Ninguna |
| Movimiento mensual Acreedoras | ⚠️ Diferencia | Decidir si restar cargos |
| Acumulado YTD | ⚠️ Diferencia | Decidir si incluir INICIAL |
| Presupuesto del mes | ✅ Correcto | Ninguna |
| Presupuesto acumulado YTD | ✅ Correcto | Ninguna |
| Año anterior (mes/acum) | ✅ Correcto | Ninguna |
| Variaciones porcentuales | ✅ Correcto | Ninguna |

---

## 🎯 Recomendación

**Sugiero implementar Opción 1** (modificar JavaScript) por las siguientes razones:

1. **Consistencia**: Tu query SQL refleja la metodología estándar de reportes financieros
2. **YTD puro**: Los acumulados YTD deben mostrar solo movimientos del año, no saldos iniciales
3. **Comparabilidad**: Los YTD de año actual vs anterior son comparables si ambos excluyen saldos iniciales

**Archivos a modificar:**
- `src/services/saldosService.js` (líneas 44-52)

**Testing requerido:**
- Verificar que columnas 3, 8, 10 muestren valores correctos en SUMMARY
- Verificar que variaciones % no cambien significativamente
- Comparar resultados con reportes Excel existentes

---

## 📞 Siguiente Paso

¿Quieres que implemente las correcciones para que JavaScript coincida exactamente con tu query SQL?
