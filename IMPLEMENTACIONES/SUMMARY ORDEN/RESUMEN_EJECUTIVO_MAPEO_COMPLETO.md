# RESUMEN EJECUTIVO - MAPEO COMPLETO DE VISTAS FINANCIERAS

## 📊 ALCANCE DEL DOCUMENTO

Este mapeo documenta **TODA** la estructura financiera de las vistas SUMMARY y RESUMEN, incluyendo:

✅ **111 filas** mapeadas en vista SUMMARY  
✅ **43 cuentas contables** catalogadas  
✅ **5 secciones principales** documentadas:
   - INCOME (Ingresos)
   - EXPENSES (Gastos)
   - RESULTADOS OPERATIVOS
   - OTHER INCOME (Otros Ingresos)
   - RESULTADOS NETOS

---

## 📁 CONTENIDO DEL ARCHIVO EXCEL

### **Archivo: Mapeo_COMPLETO_SUMMARY_RESUMEN_Detallado.xlsx**

| Hoja | Nombre | Filas | Descripción |
|------|--------|-------|-------------|
| 0 | ÍNDICE GENERAL | - | Navegación y leyenda de niveles |
| 1 | INCOME - Detalle | 22 | Detalle completo de ingresos (filas 8-30) |
| 2 | EXPENSE - Detalle | 40 | Detalle completo de gastos (filas 31-70) |
| 3 | RESULTADOS OPERATIVOS | 5 | Cálculo de resultados operativos por región (filas 72-76) |
| 4 | OTHER INCOME | 11 | Otros ingresos y productos financieros (filas 78-88) |
| 5 | RESULTADOS NETOS | 20 | Resultados netos consolidados y ajustes (filas 90-108) |
| 8 | CATÁLOGO DE CUENTAS | 43 | Todas las cuentas con descripción completa |

---

## 🎯 ESTRUCTURA COMPLETA - 4 NIVELES

### **NIVEL 0: Consolidado Total** 🔴
- CONSOLIDATED INCOME (Fila 30)
- CONSOLIDATED EXPENSES (Fila 70)
- CONSOLIDATED OPERATING RESULTS (Fila 76)
- CONSOLIDATED NET RESULTS (Fila 94)

### **NIVEL 1: Consolidado Regional** 🔵
**INCOME:**
- CDMX Income (Fila 8)
- Guadalajara Income (Fila 25)
- Monterrey Income (Fila 27)

**EXPENSE:**
- CDMX Expense (Fila 31)
- Guadalajara Expense (Fila 66)
- Monterrey Expense (Fila 68)

**RESULTADOS:**
- Operating Results por región (Filas 72-74)
- Other Income por región (Filas 78, 85, 87)
- Net Results por región (Filas 90-92)

### **NIVEL 2: Categorías Principales** 🟢

**INCOME (5 categorías):**
1. Membership (Fila 9) → 3 cuentas
2. Events (Fila 13) → 2 cuentas
3. Committees (Fila 16) → 2 cuentas
4. Services to Members (Fila 19) → 5 conceptos
5. Regional Income → Guadalajara y Monterrey

**EXPENSE (7 categorías):**
1. Membership (Fila 32) → 2 cuentas
2. Events (Fila 35) → 1 cuenta
3. Committees (Fila 37) → 2 cuentas
4. Services to Members (Fila 40) → 1 cuenta
5. Gastos Administrativos (Fila 42) → 13 departamentos
6. Other (Fila 56) → 1 cuenta
7. Gastos de Nómina (Fila 58) → 7 cuentas

### **NIVEL 3: Cuentas Individuales** 🟡
43 cuentas contables específicas (ver Catálogo de Cuentas)

---

## 💼 FLUJO COMPLETO DEL ESTADO DE RESULTADOS

```
INCOME (Fila 30)
    │
    ├─ CDMX Income (8)
    │   ├─ Membership (9): 3 cuentas
    │   ├─ Events (13): 2 cuentas
    │   ├─ Committees (16): 2 cuentas
    │   └─ Services (19): 5 conceptos
    │
    ├─ Guadalajara Income (25): 1 cuenta
    └─ Monterrey Income (27): 1 cuenta

EXPENSES (Fila 70)
    │
    ├─ CDMX Expense (31)
    │   ├─ Membership (32): 2 cuentas
    │   ├─ Events (35): 1 cuenta
    │   ├─ Committees (37): 2 cuentas
    │   ├─ Services (40): 1 cuenta
    │   ├─ G&A (42): 13 departamentos
    │   ├─ Other (56): 1 cuenta
    │   └─ Payroll (58): 7 cuentas
    │
    ├─ Guadalajara Expense (66): 1 cuenta
    └─ Monterrey Expense (68): 1 cuenta

═══════════════════════════════════

OPERATING RESULTS (Fila 76)
= Income - Expenses
    │
    ├─ CDMX: Fila 72 = Fila 8 - Fila 31
    ├─ GDL: Fila 73 = Fila 25 - Fila 66
    └─ MTY: Fila 74 = Fila 27 - Fila 68

OTHER INCOME (Filas 78-88)
    │
    ├─ México (78): 4 cuentas
    │   ├─ Otros Ingresos (413...)
    │   ├─ Intereses Bancos (414...)
    │   ├─ Utilidad Cambiaria (416...)
    │   └─ Plusvalía Inversiones (418...)
    │
    ├─ Guadalajara (85): Sin cuentas
    └─ Monterrey (87): Sin cuentas

NET RESULTS (Fila 94)
= Operating Results + Other Income
    │
    ├─ CDMX: Fila 90 = Fila 72 + Fila 78
    ├─ GDL: Fila 91 = Fila 73 + Fila 85
    └─ MTY: Fila 92 = Fila 74 + Fila 87

═══════════════════════════════════

RESULTADO FINAL (Fila 108)
= Net Results - Exchange Rate Adjustment
= Fila 94 - Fila 107
```

---

## 🔧 TIPOS DE OPERACIONES

### **1. VLOOKUP + RESTA** (Cuentas individuales)
```excel
=ABS(VLOOKUP(A10,INDIRECT($M$1),$P$1,FALSE)-VLOOKUP(A10,INDIRECT($M$1),$Q$1,FALSE))
```
**Descripción:** Busca la cuenta en hoja SALDOS del mes actual (columna P), resta saldo acumulado anterior (columna Q), obtiene el movimiento del período.

**Usado en:** Todas las cuentas individuales de Income y Expense

### **2. SUMA Simple** (Agregación)
```excel
=SUM(B10:B12)
```
**Descripción:** Suma filas hijas del mismo nivel.

**Usado en:** Categorías nivel 2 (Membership, Events, etc.)

### **3. SUMA con Referencias** (Consolidación)
```excel
=SUM(B9,B13,B16,B19)
```
**Descripción:** Suma referencias específicas (no consecutivas).

**Usado en:** Nivel 1 regional (CDMX Income, CDMX Expense)

### **4. SUMA DIRECTA** (Consolidado total)
```excel
=+B8+B25+B27
```
**Descripción:** Suma directa de componentes regionales.

**Usado en:** Nivel 0 (CONSOLIDATED INCOME, EXPENSES)

### **5. RESTA** (Resultados)
```excel
=+B8-B31
```
**Descripción:** Resta para calcular resultados operativos.

**Usado en:** Operating Results (Income - Expense)

---

## 📝 CUENTAS CLAVE POR CATEGORÍA

### **INCOME (11 cuentas principales)**
| Cuenta | Nombre | Categoría |
|--------|--------|-----------|
| 401... | Cuotas Netas | Membership |
| 402... | Ingresos socios nuevos | Membership |
| 412... | Economex | Membership |
| 407... | Eventos | Events |
| 408... | Patrocinios | Events |
| 417... | Committees | Committees |
| 403... | Patrocinios por Comités | Committees |
| 409... | Venta Publicaciones | Services |
| 406... | Bolsa de Trabajo | Services |
| 450001... | Guadalajara Income | Regional |
| 450002... | Monterrey Income | Regional |

### **EXPENSE (32 cuentas principales)**

**Directos (7 cuentas):**
- 705... Gastos Promoción
- 701... Costo Eventos
- 702... Servicio membresía
- 704... Portafolio Económico
- 601... Costo publicaciones
- 901... Gastos Generales
- 950001... / 950002... Gastos Regionales

**Gastos Administrativos (13 cuentas):**
- 801-001... Desarrollo de Negocios
- 801-002... Relaciones Externas
- 801-003... Servicios membresía
- 801-004... Vicepresidencia
- 801-005... Finanzas
- 801-006... Administración
- 801-007... Sistemas
- 801-008... Empleos
- 801-009... Servicios Generales
- 801-010... Eventos
- 801-011... Comités
- 801-012... Renta Salas
- 801-013... Comunicación

**Nómina (7 cuentas):**
- 513... Nómina Vicepresidencia
- 517... Nómina Desarrollo Negocios
- 516... Nómina Comités y RREE
- 519... Nómina Comunicación
- 515... Nómina Servicios Membresía
- 518... Nómina Eventos y Marketing
- 514... Nómina Admin y Finanzas

### **OTHER INCOME (4 cuentas)**
| Cuenta | Nombre | Tipo |
|--------|--------|------|
| 413... | Otros Ingresos | Diversos |
| 414... | Intereses Bancos | Financiero |
| 416... | Utilidad Cambiaria | Financiero |
| 418... | Plusvalía/Minusvalía | Financiero |

---

## 🎨 CÓDIGO DE COLORES EN EXCEL

| Color | Nivel | Uso |
|-------|-------|-----|
| 🟥 Rojo Oscuro | Nivel 0 | Consolidado Total |
| 🔵 Azul Fuerte | Nivel 1 | Consolidado Regional |
| 🔷 Azul Claro | Nivel 2 | Categorías Principales |
| 🟨 Amarillo | Nivel 3 | Cuentas Individuales (fórmulas) |
| 🟩 Verde | - | Income (secciones) |
| 🟥 Rojo | - | Expense (secciones) |
| 🟧 Naranja | - | Operating Results |
| 🟪 Morado | - | Net Results |

---

## 📊 ESTADÍSTICAS DEL MAPEO

### Distribución de Filas
- **INCOME:** 22 filas (8-30)
- **EXPENSE:** 40 filas (31-70)
- **OPERATING RESULTS:** 5 filas (72-76)
- **OTHER INCOME:** 11 filas (78-88)
- **NET RESULTS:** 20 filas (90-108)
- **TOTAL:** 98 filas operativas

### Distribución de Cuentas
- **Income:** 11 cuentas
- **Expense Directo:** 7 cuentas
- **Gastos Admin:** 13 cuentas
- **Nómina:** 7 cuentas
- **Other Income:** 4 cuentas
- **Regional:** 2 cuentas
- **TOTAL:** 43 cuentas

---

## ⚡ PUNTOS CLAVE PARA IMPLEMENTACIÓN

### 1. **Fuente de Datos**
- Todas las cuentas individuales usan **VLOOKUP** en hojas **SALDOSXX**
- Columna P: Saldo del mes actual
- Columna Q: Saldo acumulado anterior
- Resultado: P - Q = Movimiento del período

### 2. **Referencias Dinámicas**
- `INDIRECT($M$1)` → Nombre de hoja dinámica (ej: SALDOS22)
- `INDIRECT($N$1)` → Nombre de hoja ACUM dinámica
- Permite cambiar de período solo modificando celdas M1 y N1

### 3. **Valor Absoluto**
- `ABS()` se usa para convertir valores negativos a positivos
- Importante para cuentas que naturalmente tienen saldo contrario

### 4. **Columnas Múltiples**
- Cada fila tiene múltiples columnas: B, C, D, E, F, H, I, J, K, L
- Columna B: Mes actual (Actual)
- Columna C: Plan/Presupuesto
- Columna D: Año anterior
- Columnas H-L: Year to Date (YTD)

### 5. **Validación Cruzada**
- Fila 94 (NET RESULTS regional) debe = Fila 104 (NET RESULTS por categoría)
- Esta doble forma de cálculo sirve como validación

---

## 🔍 DIFERENCIAS CLAVE: SUMMARY vs RESUMEN

| Aspecto | SUMMARY | RESUMEN |
|---------|---------|---------|
| **Fuente** | Hojas SALDOSXX con VLOOKUP | PPvsREal Summary con SUMIF |
| **Formato Cuentas** | Numérico largo (401000...) | Con guiones (401-000-000-00) |
| **Período** | Mensual vs anterior | Anual vs presupuesto |
| **Detalle G&A** | 13 departamentos explícitos | Consolidado |
| **Nómina** | Categoría separada (7 cuentas) | Dentro de G&A |
| **Regionales** | 2 capítulos (GDL, MTY) | 3 capítulos (+Northwest) |
| **Categorías Income** | 4 categorías | 6 categorías (+T&IC) |

---

## ✅ CHECKLIST DE VALIDACIÓN

### Validaciones Nivel 0
- [ ] CONSOLIDATED INCOME = CDMX + GDL + MTY Income
- [ ] CONSOLIDATED EXPENSES = CDMX + GDL + MTY Expense
- [ ] CONSOLIDATED OPERATING RESULTS = Total Income - Total Expense
- [ ] CONSOLIDATED NET RESULTS = Operating Results + Other Income

### Validaciones Nivel 1 (CDMX)
- [ ] CDMX Income = Membership + Events + Committees + Services
- [ ] CDMX Expense = Membership Exp + Events Exp + Committees Exp + Services Exp + G&A + Other + Payroll

### Validaciones por Categoría
- [ ] Membership Income = Suma de 3 cuentas (401, 402, 412)
- [ ] Events Income = Suma de 2 cuentas (407, 408)
- [ ] Committees Income = Suma de 2 cuentas (417, 403)
- [ ] G&A Expense = Suma de 13 departamentos

### Validación Cruzada Final
- [ ] Fila 94 = Fila 104 (dos formas de calcular NET RESULTS)

---

## 📞 SOPORTE Y MANTENIMIENTO

### Actualización Mensual
1. Modificar celda M1 con nombre de hoja del mes (ej: SALDOS23)
2. Modificar celda N1 con hoja ACUM del mes (ej: ACUM23)
3. Todas las fórmulas VLOOKUP se actualizan automáticamente
4. Ejecutar validaciones del checklist

### Agregar Nueva Cuenta
1. Insertar fila en la categoría correspondiente
2. Colocar número de cuenta en columna A
3. Agregar nombre en columna G
4. Copiar fórmula VLOOKUP de cuenta similar
5. Actualizar SUM de la categoría para incluir nueva fila
6. Agregar cuenta al Catálogo (Hoja 8)

### Modificar Estructura
1. **NO** modificar filas de Nivel 0 o 1 (rompe consolidación)
2. Nivel 2 y 3 pueden modificarse con cuidado
3. Siempre actualizar sumas de nivel superior
4. Documentar cambios en hoja de control de versiones

---

## 📈 MEJORES PRÁCTICAS

### ✅ DO (Hacer)
1. Usar este mapeo como documentación oficial
2. Validar fórmulas antes de cerrar período
3. Mantener formato de cuentas consistente
4. Documentar excepciones o ajustes manuales
5. Backup antes de cambios estructurales

### ❌ DON'T (No Hacer)
1. NO modificar fórmulas sin entender su lógica completa
2. NO agregar cuentas sin actualizar categorías superiores
3. NO cambiar formato de número de cuentas
4. NO eliminar niveles de agregación
5. NO mezclar períodos en misma hoja

---

## 🎓 GLOSARIO

**VLOOKUP:** Función para buscar valor en tabla y retornar correspondiente  
**INDIRECT:** Convierte texto en referencia de celda/rango  
**ABS:** Valor absoluto (convierte negativo a positivo)  
**YTD:** Year to Date (acumulado del año)  
**G&A:** General & Administrative (Gastos Administrativos)  
**Operating Results:** Resultado antes de otros ingresos/gastos  
**Net Results:** Resultado final después de todos los conceptos  
**ER:** Exchange Rate (Tipo de Cambio)  

---

## 📅 INFORMACIÓN DEL DOCUMENTO

**Fecha de Creación:** Diciembre 2025  
**Versión:** 2.0 Completa  
**Filas Documentadas:** 111  
**Cuentas Catalogadas:** 43  
**Hojas de Análisis:** 6  
**Nivel de Detalle:** Máximo (cada fila explicada)  

**Creado por:** Claude (Anthropic)  
**Propósito:** Documentación completa y exhaustiva de estructura financiera  
**Uso:** Referencia técnica, capacitación, auditoría, desarrollo

---

## 🚀 PRÓXIMOS PASOS RECOMENDADOS

1. **Semana 1:** Revisar mapeo completo con equipo de finanzas
2. **Semana 2:** Validar todas las fórmulas en período de prueba
3. **Semana 3:** Crear tabla de mapeo SUMMARY ↔ RESUMEN
4. **Semana 4:** Implementar validaciones automáticas
5. **Mes 2:** Capacitar a todo el equipo en estructura
6. **Mes 3:** Documentar proceso de cierre mensual
7. **Mes 6:** Evaluar optimizaciones y mejoras

---

**Este documento es la referencia técnica definitiva para las vistas SUMMARY y RESUMEN.**
