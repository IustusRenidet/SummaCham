# 🏢 GUÍA DE IMPLEMENTACIÓN - LAYOUTS POR CAPÍTULO

## 📋 RESUMEN EJECUTIVO

Este documento detalla la implementación de **3 estructuras financieras diferentes** para los capítulos de AmCham México:

1. **CIUDAD DE MÉXICO** - Vista consolidada con 111 filas
2. **GUADALAJARA** - Vista simplificada con estructura fusionada
3. **NORESTE (Monterrey)** - Vista regional con particularidades

---

## 🎯 ARQUITECTURA DEL SISTEMA

### Componentes Principales

```
summary-catalog.js
├─ cities: { "CIUDAD DE MÉXICO", "GUADALAJARA", "NOROESTE" }
│   ├─ majors: { Income, Expense, Other }
│   │   ├─ sections: { Membership, Events, Committees, etc. }
│   │   └─ codes: ["401...", "402...", ...]
│   └─ order: ["CIUDAD DE MÉXICO", "GUADALAJARA", "NOROESTE"]
│
summary-view.js
├─ fetchSummary(empresaId, anio, mes, capitulo)
├─ renderSummary(resumen, mesSeleccionado)
└─ sortSections / sortPrincipals (priorización visual)
```

---

## 📊 MAPEO COMPLETO POR CAPÍTULO

### **CIUDAD DE MÉXICO** 🔵

#### INCOME - 4 Categorías

| Categoría | Cuentas | Total Cuentas |
|-----------|---------|---------------|
| **Membership** | 401..., 402..., 412... | 3 |
| **Events** | 407..., 408... | 2 |
| **Committees** | 417..., 403... | 2 |
| **Services to Members** | 409..., 406..., + 3 en cero | 5 |
| **Regional** | 450001... (GDL), 450002... (MTY) | 2 |

**Total Income: 14 cuentas**

#### EXPENSE - 7 Categorías

| Categoría | Detalle | Total Cuentas |
|-----------|---------|---------------|
| **Membership** | Portafolio, Gastos Promoción (705...) | 2 |
| **Events** | Costo Eventos (701...) | 1 |
| **Committees** | Servicio membresía (702...), Portafolio (704...) | 2 |
| **Services to Members** | Costo publicaciones (601...) | 1 |
| **Gastos Administrativos** | 801-001 a 801-013 (13 departamentos) | 13 |
| **Other** | Gastos Generales (901...) | 1 |
| **Gastos de Nómina** | 513..., 517..., 516..., 519..., 515..., 518..., 514... | 7 |
| **Regional Expense** | 950001... (GDL), 950002... (MTY) | 2 |

**Total Expense: 29 cuentas**

#### OTHER INCOME

| Cuenta | Descripción |
|--------|-------------|
| 413... | Otros Ingresos |
| 414... | Intereses Bancos |
| 416... | Utilidad Cambiaria Inversiones |
| 418... | Plusvalía/Minusvalía Inversiones |

**Total Other Income: 4 cuentas**

**TOTAL CDMX: 47 cuentas**

---

### **GUADALAJARA** 🟢

#### INCOME - 3 Categorías

| Categoría | Cuentas | Total Cuentas |
|-----------|---------|---------------|
| **Membership** | 400... (genérico), 401... (Cuotas Netas) | 2 |
| **Events and Committees** | 404... (Comités), 405... (Eventos) | 2 |
| **Services to Members** | 403..., 406..., 407..., 408..., 409... | 5 |

**Total Income: 9 cuentas**

#### EXPENSE - 6 Categorías

| Categoría | Detalle | Total Cuentas |
|-----------|---------|---------------|
| **Events and Committees** | 502... (Costo comités), 701... (Costo Eventos) | 2 |
| **Services to Members** | 601..., 702..., 902... | 3 |
| **Other** | 904... (Gastos extraordinarios) | 1 |
| **G&A** | 501... (Nómina), 801... (Gasto local), 901... (Administración) | 3 |
| **Gastos Corporativos** | 903... | 1 |
| **CARGOS ADMINISTRATIVOS** | 903016... | 1 |

**Total Expense: 11 cuentas**

#### OTHER

| Cuenta | Descripción |
|--------|-------------|
| 402... | Otros ingresos |
| 410... | Utilidad cambiaria |

**Total Other: 2 cuentas**

**TOTAL GUADALAJARA: 22 cuentas**

---

### **NORESTE (Monterrey)** 🟠

#### INCOME - 3 Categorías

| Categoría | Cuentas | Total Cuentas |
|-----------|---------|---------------|
| **Membership** | 400... (genérico), 401... (Cuotas Netas) | 2 |
| **Events and Committees** | 407... (Comités), 408... (Eventos), 414... (Especiales) | 3 |
| **Services to Members** | 404..., 405..., 406..., 410..., 412... | 5 |

**Total Income: 10 cuentas**

#### EXPENSE - 7 Categorías

| Categoría | Detalle | Total Cuentas |
|-----------|---------|---------------|
| **Membership** | 707... (Cuotas) | 1 |
| **Events and Committees** | 701..., 702..., 703..., 705... | 4 |
| **Services to Members** | 706..., 600..., 800007..., 901002... | 4 |
| **Other expenses** | 808... | 1 |
| **G&A** | 501..., 800..., 704..., 801..., 802... | 5 |
| **Gastos Corporativos** | 900... | 1 |
| **CARGOS ADMINISTRATIVOS** | 900001..., 810... | 2 |

**Total Expense: 18 cuentas**

#### OTHER

| Cuenta | Descripción |
|--------|-------------|
| 403... | Otros ingresos |
| 409... | Utilidad cambiaria |
| 413... | Rendimientos bancarios |

**Total Other: 3 cuentas**

**TOTAL NORESTE: 31 cuentas**

---

## 🔍 DIFERENCIAS CLAVE ENTRE CAPÍTULOS

### 1. **Estructura de Ingresos**

| Aspecto | CDMX | Guadalajara | Noreste |
|---------|------|-------------|---------|
| **Categorías** | 4 separadas | 3 fusionadas | 3 fusionadas |
| **Membership** | 3 cuentas específicas | 2 cuentas | 2 cuentas |
| **Events/Committees** | Separadas | Fusionadas | Fusionadas |
| **Services** | 5 conceptos | 5 cuentas | 5 cuentas |

### 2. **Estructura de Gastos**

| Aspecto | CDMX | Guadalajara | Noreste |
|---------|------|-------------|---------|
| **G&A Detalle** | 13 departamentos | 3 cuentas consolidadas | 5 cuentas |
| **Nómina** | Categoría separada (7) | Dentro de G&A | Dentro de G&A |
| **Membership Expense** | Categoría propia | Sin categoría | Categoría propia |
| **Corporativos** | No aplica | 1 cuenta | 1 cuenta |

### 3. **Other Income**

| Aspecto | CDMX | Guadalajara | Noreste |
|---------|------|-------------|---------|
| **Productos Financieros** | 4 cuentas detalladas | 2 cuentas básicas | 3 cuentas |
| **Intereses** | ✅ Cuenta específica | ❌ No | ❌ No |
| **Plusvalía** | ✅ Cuenta específica | ❌ No | ❌ No |

---

## 💻 IMPLEMENTACIÓN EN CÓDIGO

### 1. **Catálogo Central** (`summary-catalog.js`)

```javascript
window.SUMMARY_CATALOG = {
  "cities": {
    "CIUDAD DE MÉXICO": {
      "majors": {
        "CDMX Income": {
          "type": "income",
          "sections": {
            "Membership": ["401...", "402...", "412..."],
            "Events": ["407...", "408..."],
            "Committees": ["417...", "403..."],
            "Services to Members": ["409...", "406..."]
          },
          "codes": [/* array plano de todos los códigos */]
        },
        "CDMX Expense": { /* ... */ },
        "Other Income": { /* ... */ }
      }
    },
    "GUADALAJARA": { /* estructura simplificada */ },
    "NOROESTE": { /* estructura regional */ }
  },
  "order": ["CIUDAD DE MÉXICO", "GUADALAJARA", "NOROESTE"]
};
```

### 2. **Priorización Visual** (`summary-view.js`)

```javascript
const SECTION_PRIORITY = [
  'MEMBERSHIP',
  'EVENTS',
  'COMMITTEES',
  'T&IC',
  'SERVICES TO MEMBERS',
  'GUADALAJARA',
  'MONTERREY',
  'NORTHWEST',
  'GASTOS ADMINISTRATIVOS',
  'GASTOS GENERALES',
  'NOMINA',
  'GASTOS CORPORATIVOS',
  'CARGOS ADMINISTRATIVOS',
  'MEMBER CENTRICITY',
  'OTHER',
  'OTHER INCOME'
];

const sortSections = (secciones = []) => {
  return secciones.slice().sort((a, b) => {
    const orden = sectionPriority(a.label) - sectionPriority(b.label);
    if (orden !== 0) return orden;
    return normalizeText(a.label).localeCompare(normalizeText(b.label));
  });
};
```

### 3. **Render Dinámico**

```javascript
const renderSummary = (resumen = [], mesSeleccionado) => {
  resumen.forEach((capitulo) => {
    // Fila de capítulo (CDMX, GDL, NORESTE)
    summaryBody.appendChild(createTotalsRow(capitulo, {
      label: capitulo.label,
      rowClass: 'section-header-row table-secondary fw-bold'
    }));

    // Principales (Income, Expense, Operating Results, etc.)
    const principales = sortPrincipals(capitulo.children);
    
    principales.forEach((principal) => {
      // Secciones (Membership, Events, etc.)
      const secciones = sortSections(principal.children);
      
      secciones.forEach((seccion) => {
        // Cuentas individuales
        (seccion.cuentas || []).forEach((cta) => {
          // Render cuenta con 12 columnas
        });
        
        // Subtotal de sección
        summaryBody.appendChild(createTotalsRow(seccion, {
          label: seccion.label,
          rowClass: 'subsection-row fw-semibold'
        }));
      });
      
      // Total principal
      summaryBody.appendChild(createTotalsRow(principal, {
        label: principal.label,
        rowClass: 'section-header-row table-light fw-bold'
      }));
    });
  });
};
```

---

## 📐 ESTRUCTURA DE COLUMNAS

Todas las vistas usan **12 columnas**:

| # | Columna | Tipo | Descripción |
|---|---------|------|-------------|
| 1 | Cuenta | Code | Código contable (21 dígitos) |
| 2 | Actual | Currency | Mes actual |
| 3 | Plan | Currency | Presupuesto mes |
| 4 | 2021/2020 | Currency | Año anterior |
| 5 | B/(W)% vs. Plan | Percent | Variación vs presupuesto |
| 6 | B/(W)% vs. 2021 | Percent | Variación vs año anterior |
| 7 | Descripción | Text | Nombre de cuenta/categoría |
| 8 | Actual YTD | Currency | Acumulado actual |
| 9 | Plan YTD | Currency | Presupuesto acumulado |
| 10 | 2021 YTD | Currency | Acumulado año anterior |
| 11 | B/(W)% vs. Plan | Percent | Variación YTD vs presupuesto |
| 12 | B/(W)% vs. 2021 | Percent | Variación YTD vs año anterior |

---

## 🔧 OPERACIONES POR FILA/COLUMNA

### Cálculo de Variaciones

```javascript
const calculateVar = (actual, base) => {
  const actualNum = toNumber(actual);
  const baseNum = toNumber(base);
  return safeDiv(actualNum - baseNum, Math.abs(baseNum)) * 100;
};

// Aplicado en:
// Columna 5: calculateVar(row.actualMonth, row.planMonth)
// Columna 6: calculateVar(row.actualMonth, row.prevMonth)
// Columna 11: calculateVar(row.actualYTD, row.planYTD)
// Columna 12: calculateVar(row.actualYTD, row.prevYTD)
```

### Agregaciones

```javascript
// SUMA por sección
const extractTotals = (nodo = {}) => ({
  actualMonth: toNumber(nodo.actualMonth ?? nodo.totalActualMonth),
  planMonth: toNumber(nodo.planMonth ?? nodo.totalPlanMonth),
  prevMonth: toNumber(nodo.prevMonth ?? nodo.totalPrevMonth),
  actualYTD: toNumber(nodo.actualYTD ?? nodo.totalActualYTD),
  planYTD: toNumber(nodo.planYTD ?? nodo.totalPlanYTD),
  prevYTD: toNumber(nodo.prevYTD ?? nodo.totalPrevYTD)
});

// RESTA para resultados operativos
Operating Results = Income - Expense

// SUMA para resultados netos
Net Results = Operating Results + Other Income
```

---

## 📋 REGLAS DE NEGOCIO

### 1. **Cuentas Exclusivas por Capítulo**

#### Solo en CDMX:
- ✅ Economex (412...)
- ✅ 13 departamentos administrativos
- ✅ 7 cuentas de nómina separadas
- ✅ Productos financieros detallados

#### Solo en Guadalajara:
- ✅ Gastos Corporativos (903...)
- ✅ CARGOS ADMINISTRATIVOS (903016...)

#### Solo en Noreste:
- ✅ Eventos Especiales (414...)
- ✅ Becarios (800007...)
- ✅ Sistema proveedores confiables (900001...)

### 2. **Fusión de Categorías**

En **Guadalajara** y **Noreste**:
- Events + Committees → **"Events and Committees"**
- G&A + Nómina → **"G&A"** (sin desglose)

En **CDMX**:
- Events **separado** de Committees
- G&A con **13 departamentos** explícitos
- Nómina como **categoría independiente**

### 3. **Ordenamiento Visual**

Prioridad de secciones (de arriba hacia abajo):

1. **MEMBERSHIP** (siempre primero)
2. **EVENTS** / **EVENTS AND COMMITTEES**
3. **COMMITTEES** (solo CDMX)
4. **SERVICES TO MEMBERS**
5. **Capítulos regionales** (GUADALAJARA, MONTERREY, NORTHWEST)
6. **GASTOS ADMINISTRATIVOS**
7. **NOMINA** (solo CDMX)
8. **GASTOS CORPORATIVOS** (GDL/Noreste)
9. **OTHER**
10. **OTHER INCOME** (siempre último)

---

## 🎨 ESTILOS VISUALES

### Filas por Tipo

```css
/* Cabecera de Capítulo */
.section-header-row.table-secondary {
  background-color: #8497b0 !important;
  font-weight: 900;
  color: #2f5496;
}

/* Principal (Income, Expense) */
.section-header-row.table-light {
  background-color: #d9d9d9 !important;
  font-weight: 700;
  color: #000;
}

/* Subsección (Membership, Events) */
.subsection-row {
  background-color: #f2f2f2;
  font-weight: 600;
}

/* Cuenta individual */
tr {
  background-color: #fff;
}
```

### Columnas Especiales

```css
/* Columna de códigos */
.account-column {
  font-family: 'Courier New', monospace;
  font-size: 0.65rem;
  background-color: #f2f2f2 !important;
}

/* Columnas numéricas */
.mono {
  font-variant-numeric: tabular-nums;
  text-align: right;
  font-family: 'Courier New', monospace;
}
```

---

## 🚀 FLUJO DE DATOS

```
1. Usuario selecciona: Empresa + Año + Mes
   ↓
2. fetchSummary(empresaId, anio, mes, capitulo)
   ↓
3. Backend retorna:
   {
     resumen: [
       {
         label: "CIUDAD DE MÉXICO",
         children: [
           {
             label: "CDMX Income",
             children: [
               {
                 label: "Membership",
                 cuentas: [...]
               }
             ]
           }
         ]
       }
     ],
     capituloSeleccionado: "CIUDAD DE MÉXICO",
     anio: 2022,
     anioComparativo: 2021
   }
   ↓
4. sortPrincipals() ordena Income/Expense/Operating/Other
   ↓
5. sortSections() ordena Membership/Events/Committees/etc
   ↓
6. renderSummary() genera HTML con 12 columnas por cuenta
   ↓
7. calculateVar() calcula variaciones porcentuales
   ↓
8. Render final en DOM
```

---

## ✅ VALIDACIONES RECOMENDADAS

### Por Capítulo

```javascript
// CDMX
✓ 47 cuentas totales
✓ 4 categorías de Income
✓ 7 categorías de Expense
✓ 13 departamentos G&A
✓ 7 cuentas nómina
✓ 4 cuentas Other Income

// Guadalajara
✓ 22 cuentas totales
✓ 3 categorías de Income
✓ 6 categorías de Expense
✓ 3 cuentas G&A consolidadas
✓ 2 cuentas Other

// Noreste
✓ 31 cuentas totales
✓ 3 categorías de Income
✓ 7 categorías de Expense
✓ 5 cuentas G&A
✓ 3 cuentas Other
```

### Integridad Numérica

```javascript
// Validar agregaciones
CDMX Income = Membership + Events + Committees + Services
CDMX Expense = Membership + Events + Committees + Services + G&A + Other + Payroll
Operating Results = Income - Expense
Net Results = Operating Results + Other Income

// Validar variaciones
Variación% = ((Actual - Base) / |Base|) * 100
```

---

## 📦 ARCHIVOS ENTREGADOS

1. **Comparacion_Capitulos_SUMMARY.xlsx** (21 KB)
   - Hoja 1: Comparación estructural completa
   - Hoja 2: Catálogo de 96 cuentas por capítulo

2. **Mapeo_COMPLETO_SUMMARY_RESUMEN_Detallado.xlsx** (21 KB)
   - 6 hojas con mapeo de CDMX (111 filas)
   - Catálogo de 43 cuentas

3. **GUIA_IMPLEMENTACION_CAPITULOS.md** (este archivo)
   - Documentación completa de implementación

---

## 🔄 SINCRONIZACIÓN ENTRE VISTAS

### SUMMARY → RESUMEN

```javascript
// SUMMARY usa códigos largos
"401000000000000000001" → Cuotas Netas

// RESUMEN usa códigos cortos
"401-000-000-00" → Cuotas Netas

// Mapeo necesario
const mapeoFormato = (codigoLargo) => {
  // Extraer segmentos: 401-000-000-00-000-00-0
  const segmentos = codigoLargo.match(/.{1,3}/g);
  return `${segmentos[0]}-${segmentos[1]}-${segmentos[2]}-${segmentos[3]}`;
};
```

---

## 🎓 BEST PRACTICES

### 1. **Agregar Nueva Cuenta**

```javascript
// 1. Actualizar summary-catalog.js
"CIUDAD DE MÉXICO": {
  "majors": {
    "CDMX Income": {
      "sections": {
        "Membership": [
          "401000000000000000001",
          "402000000000000000001",
          "412000000000000000001",
          "XXX000000000000000001" // ← NUEVA CUENTA
        ]
      }
    }
  }
}

// 2. Backend debe retornar datos para la nueva cuenta
// 3. No requiere cambios en render (automático)
```

### 2. **Agregar Nuevo Capítulo**

```javascript
// 1. Agregar a summary-catalog.js
"cities": {
  "CIUDAD DE MÉXICO": { /* ... */ },
  "GUADALAJARA": { /* ... */ },
  "NOROESTE": { /* ... */ },
  "NUEVO_CAPITULO": {
    "majors": {
      "Nuevo Income": { /* estructura */ },
      "Nuevo Expense": { /* estructura */ }
    }
  }
}

// 2. Actualizar orden
"order": [
  "CIUDAD DE MÉXICO",
  "GUADALAJARA",
  "NOROESTE",
  "NUEVO_CAPITULO"
]

// 3. Backend debe soportar filtro por capítulo
```

### 3. **Modificar Prioridad Visual**

```javascript
// Editar SECTION_PRIORITY en summary-view.js
const SECTION_PRIORITY = [
  'NUEVA_SECCION',  // ← Agregar al inicio para mayor prioridad
  'MEMBERSHIP',
  'EVENTS',
  // ...
];
```

---

## 📞 SOPORTE TÉCNICO

### Debugging

```javascript
// Ver estructura cargada
console.log(window.SUMMARY_CATALOG);

// Ver orden de renderizado
console.log(SUMMARY_CATALOG.order);

// Ver cuentas de un capítulo
console.log(SUMMARY_CATALOG.cities["CIUDAD DE MÉXICO"].majors);

// Ver datos renderizados
window.addEventListener('summary:data-ready', (event) => {
  console.log('Datos recibidos:', event.detail);
});
```

### Errores Comunes

| Error | Causa | Solución |
|-------|-------|----------|
| Cuentas no aparecen | No están en catalog.js | Agregar a sections + codes |
| Orden incorrecto | Falta en SECTION_PRIORITY | Agregar prioridad |
| Totales no suman | Falta cuenta en codes array | Verificar array completo |
| Capítulo no carga | Falta en cities | Agregar estructura completa |

---

## 📊 ESTADÍSTICAS FINALES

| Métrica | CDMX | Guadalajara | Noreste | Total |
|---------|------|-------------|---------|-------|
| **Cuentas Totales** | 47 | 22 | 31 | 100 |
| **Income** | 14 | 9 | 10 | 33 |
| **Expense** | 29 | 11 | 18 | 58 |
| **Other** | 4 | 2 | 3 | 9 |
| **Categorías Income** | 4 | 3 | 3 | - |
| **Categorías Expense** | 7 | 6 | 7 | - |
| **Nivel Detalle G&A** | 13 deptos | 3 cuentas | 5 cuentas | - |

---

**Documento Versión 3.0 - Implementación Completa de Capítulos**  
**Fecha:** Diciembre 2025  
**Cobertura:** 100% (3 capítulos documentados)  
**Archivos Entregados:** 3  
**Estado:** Completo y Listo para Producción ✅
