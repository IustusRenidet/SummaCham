# 📊 MAPA COMPLETO DE OPERACIONES - SummaCham

> **Documento de Referencia**: Este archivo documenta **ABSOLUTAMENTE TODAS** las operaciones matemáticas que se realizan por tabla en cada módulo y capítulo del sistema.

---

## 📋 Índice

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [11 Módulos Operativos](#11-módulos-operativos)
3. [Módulo SUMMARY](#módulo-summary)
4. [Módulo RESUMEN](#módulo-resumen)
5. [Tipos de Operaciones](#tipos-de-operaciones)
6. [Ubicación del Código](#ubicación-del-código)

---

## 🎯 Resumen Ejecutivo

### Total de Módulos: 13

| Módulo | Tipo | Operaciones | Motor JavaScript |
|--------|------|-------------|------------------|
| **Presupuestos** | Operativo | SUM, RESTA | cuentas-modulo.js |
| **Finanzas (T&IC)** | Operativo | SUM, RESTA, DIVISIÓN | cuentas-modulo.js |
| **Comités** | Operativo | SUM, RESTA | cuentas-modulo.js |
| **Comunicación** | Operativo | SUM, RESTA | cuentas-modulo.js |
| **Eventos** | Operativo | SUM, RESTA | cuentas-modulo.js |
| **Gtos_Corporativos** | Operativo | SUM, RESTA | cuentas-modulo.js |
| **Membresía** | Operativo | SUM, RESTA | cuentas-modulo.js |
| **RH** | Operativo | SUM, RESTA | cuentas-modulo.js |
| **Serv_Membresía** | Operativo | SUM, RESTA | cuentas-modulo.js |
| **VPE** | Operativo | SUM, RESTA | cuentas-modulo.js |
| **Dirección** | Operativo | SUM, RESTA | cuentas-modulo.js |
| **SUMMARY** | Consolidación | SUM, RESTA, FACTOR | summary.js |
| **RESUMEN** | Consolidación | SUM, RESTA, FACTOR | resumen-view.js |

---

## 📁 11 Módulos Operativos

### 🔧 Motor de Cálculo Principal

**Archivo:** `vistas/js/cuentas-modulo.js`  
**Líneas:** 3835-4035 (función `recalcularSumas()`)

### Tipos de Operaciones

#### 1. **SUM (Suma Vertical por Sección)**

**Función:** `recalcularSumas()` - Línea 3835

**Descripción:** Suma todos los valores de las cuentas dentro de una misma sección

**Proceso:**
```javascript
// PSEUDOCÓDIGO:
seccionMeta.filasCuenta.forEach((filaCuenta) => {
  const valores = extraerValoresNumericos(filaCuenta);
  const factor = Number(filaCuenta.dataset.operacionFactor || 1);
  valores.forEach((valor, indice) => {
    sumaSeccion[indice] += valor * factor;
  });
});
```

**Ejemplo Real:**
```
SECCIÓN: INGRESOS MEMBRESÍA
├── Cuenta 401-010 (Cuotas)        $100,000 (factor: +1)
├── Cuenta 401-020 (Inscripciones) $ 50,000 (factor: +1)
└── SUM-ROW: "Total Ingresos"     $150,000 ← SUMA
```

**Ubicación en Código:**
- **Línea 3835-3952:** Función completa `recalcularSumas()`
- **Línea 3875:** Iteración sobre `seccionMeta.filasCuenta`
- **Línea 3885:** Aplicación del factor: `valor * factor`

---

#### 2. **RESTA (Factor Negativo)**

**Función:** `recalcularSumas()` con `operacionFactor = -1`

**Descripción:** Los gastos se multiplican por -1 para restar del resultado

**Proceso:**
```javascript
const factor = Number(fila.dataset.operacionFactor || 1);
// Si factor = -1, entonces:
sumaSeccion[indice] += valor * (-1); // Resta efectiva
```

**Ejemplo Real:**
```
MÓDULO: Eventos (Capítulo: Ciudad de México)
├── INGRESOS BOLETAJE           $200,000 (factor: +1)
├── COSTOS Y GASTOS EVENTOS    -$150,000 (factor: -1) ← RESTA
└── RESULTADO OPERATIVO         $ 50,000
```

**Ubicación en Código:**
- **Línea 3885:** `suma += (valorCuenta * factor)`
- **Líneas 2830-2950:** Heurísticas que asignan `factor = -1` a gastos

---

#### 3. **SUM de SUM (Sumavarios)**

**Función:** `agregarFilaResumen()` con clase `sum-row-sumavarios`

**Descripción:** Agrupa múltiples `sum-row` bajo una etiqueta común

**Proceso:**
```javascript
// Líneas 3920-3985: Agrupación de sum-rows
sumavariosData.forEach((agrupacion) => {
  const sumaTotal = agrupacion.metasSecciones
    .map(meta => meta.sumValues)
    .reduce((acum, valores) => sumarListas([acum, valores]));
});
```

**Ejemplo Real:**
```
MÓDULO: Dirección (Capítulo: Guadalajara)
├── SUM-ROW: Ingresos CE        $100,000
├── SUM-ROW: Ingresos Board     $ 50,000
└── SUMAVARIOS: "Resultado Operativo" $150,000 ← SUM de SUM
```

**Ubicación en Código:**
- **Líneas 3920-3985:** Cálculo de sumavarios
- **Líneas 1340-1390:** Creación de filas `sum-row-sumavarios`

---

#### 4. **DIVISIÓN (Factor Decimal)**

**Función:** Aplicación de `operacionFactor` con valores < 1

**Descripción:** Permite promedios o distribuciones proporcionales

**Proceso:**
```javascript
const factor = 0.5; // Para dividir entre 2
suma += valorCuenta * factor; // División efectiva
```

**Ejemplo Real:**
```
MÓDULO: Gastos Generales
├── Gastos Administrativos      $200,000
├── DIVISIÓN PROPORCIONAL (×0.5) $100,000 ← Factor 0.5
```

**Ubicación en Código:**
- **Línea 3885:** Aplicación directa del factor
- **Modal de edición (Líneas 2200-2400):** UI para configurar factores personalizados

---

#### 5. **MULTIPLICACIÓN (Factores > 1)**

**Función:** Uso de `operacionFactor > 1`

**Descripción:** Permite amplificación de valores (IVA, márgenes, etc.)

**Proceso:**
```javascript
const factor = 1.16; // Para aplicar IVA del 16%
suma += valorCuenta * factor;
```

**Ejemplo Real:**
```
MÓDULO: Presupuestos
├── Ingreso Base                $100,000
├── MULTIPLICACIÓN (×1.16)      $116,000 ← Con IVA
```

---

### 📊 Operaciones por Módulo

#### **1. PRESUPUESTOS**

**Archivo de Datos:** `info IMPORTANTE/CUENTAS.json` → clave `"Presupuestos"`

**Operaciones:**
- **SUM:** Suma de cuentas 4xxx (ingresos) y 5xxx-7xxx (gastos)
- **RESTA:** Gastos con `factor = -1`
- **RESULT-ROW:** "RESULTADO MÓDULO"

**Configuración en Código:**
```javascript
// Líneas 390-420: Filtrado de cuentas válidas
const esCuentaPresupuestoValida = (cuenta) => {
  const prefijo = Number.parseInt(cuenta.slice(0, 3), 10);
  return prefijo >= 400 && prefijo < 800; // Rango 4xx-7xx
};
```

**Estructura de Tabla:**
```
│ CAPÍTULO: CIUDAD DE MÉXICO                          │
├─ INGRESOS                                           │
│  ├─ 401-010-000-00  Cuotas                 $XXX,XXX │
│  └─ SUM-ROW: Total Ingresos                $XXX,XXX │ ← SUM
├─ GASTOS                                             │
│  ├─ 501-010-000-00  Nómina                -$XXX,XXX │
│  └─ SUM-ROW: Total Gastos                 -$XXX,XXX │ ← SUM con factor -1
└─ RESULT-ROW: RESULTADO MÓDULO              $XXX,XXX │ ← RESTA (Ingresos - Gastos)
```

---

#### **2. FINANZAS (T&IC)**

**Archivo de Datos:** `info IMPORTANTE/CUENTAS.json` → clave `"Finanzas"`

**Operaciones:**
- **SUM:** Ingresos financieros
- **RESTA:** Gastos administrativos (`factor = -1`)
- **RESULT-ROW:** "Resultado Admon y Finanzas"

**Heurísticas Automáticas (Líneas 2830-2870):**
```javascript
case 'finanzas': {
  if (/GASTOS/i.test(seccion)) {
    metaSeccion.factor = -1; // Gastos se restan
  } else if (/INGRESOS/i.test(seccion)) {
    metaSeccion.factor = 1;  // Ingresos se suman
  }
  agregarResultRow(metaSeccion, "Resultado Admon y Finanzas");
  break;
}
```

**Estructura:**
```
├─ INGRESOS FINANCIEROS
│  └─ SUM-ROW                              $XXX,XXX (factor: +1)
├─ GASTOS ADMINISTRATIVOS
│  └─ SUM-ROW                             -$XXX,XXX (factor: -1)
└─ RESULT-ROW: Resultado Admon y Finanzas  $XXX,XXX
```

---

#### **3. COMITÉS**

**Archivo de Datos:** `info IMPORTANTE/CUENTAS.json` → clave `"Comites"`

**Operaciones Especiales:**

**Para CIUDAD DE MÉXICO:**
```
Resultado Operativo = Ingresos - Gastos
Resultado Comités = Resultado Operativo - Gastos Administrativos
```

**Para GDL/NE/NO:**
```
Resultado Operativo = Ingresos - Gastos  
Resultado Comités = Resultado Operativo - Comisiones
```

**Código (Líneas 2740-2810):**
```javascript
case 'comites': {
  const esComisiones = /COMISIONES/i.test(seccion);
  const esGastosAdmin = /GASTOS\s+ADMINISTRATIVOS/i.test(seccion);
  const esCapituloMexico = /CIUDAD DE MÉXICO/i.test(capitulo);
  
  if (esComisiones) {
    metaSeccion.factor = -1;
    habilitarResultado = !esCapituloMexico; // Solo aplica en GDL/NE/NO
    metaSeccion.sumRowSumavariosTexto = ""; // No entra en operativo
  } else if (esGastosAdmin) {
    metaSeccion.factor = -1;
    habilitarResultado = esCapituloMexico; // Solo aplica en CDMX
    metaSeccion.sumRowSumavariosTexto = "";
  }
  break;
}
```

---

#### **4. COMUNICACIÓN**

**Operaciones:**
- **SUM:** Todos los gastos de comunicación
- **RESTA:** Factor -1 para gastos
- **RESULT-ROW:** "Resultado Operativo Comunicación"

**Código (Líneas 2870-2900):**
```javascript
case 'comunicacion': {
  if (/GASTOS/i.test(seccion)) {
    metaSeccion.factor = -1;
  }
  agregarResultRow(metaSeccion, "Resultado Operativo Comunicacion");
  break;
}
```

---

#### **5. EVENTOS**

**Operaciones Especiales:**

**Resultado Operativo:**
```
= Ingresos Boletaje/Patrocinios - Costos y Gastos Eventos
```

**Resultado Final:**
```
= Resultado Operativo - Gastos Administrativos
```

**Código (Líneas 2710-2740):**
```javascript
case 'eventos': {
  const esGastoAdmin = /GASTOS\s+ADMINISTRATIVOS/i.test(seccion);
  const esCostosYGastos = /COSTOS\s+Y\s+GASTOS\s+EVENTOS/i.test(seccion);
  
  if (esGastoAdmin || esCostosYGastos) {
    metaSeccion.factor = -1;
    agregarResultRow(metaSeccion, "Resultado Eventos");
    
    if (esGastoAdmin) {
      // Gastos Admin NO se incluyen en Resultado Operativo
      metaSeccion.sumRowSumavariosTexto = "";
    }
  }
  break;
}
```

**Configuración Manual (Líneas 200-250):**
```javascript
const REGLAS_OPERACIONES_MODULO = {
  eventos: {
    default: [
      {
        match: /INGRESOS/i,
        sumavarios: "Resultado Operativo Eventos",
        sumavarios2: "Resultado Eventos"
      },
      {
        match: /COSTOS\s+Y\s+GASTOS\s+EVENTOS/i,
        sumavarios: "Resultado Operativo Eventos",
        sumavarios2: "Resultado Eventos"
      },
      {
        match: /GASTOS\s+ADMINISTRATIVOS/i,
        sumavarios2: "Resultado Eventos" // Solo en resultado final
      }
    ]
  }
};
```

---

#### **6. GASTOS CORPORATIVOS**

**Operaciones:**
- **SUM:** Gastos corporativos por sección
- **RESTA:** Todos con `factor = -1`
- **RESULT-ROW:** Variable por capítulo

**Código (Líneas 2910-2930):**
```javascript
case 'gtoscorporativos': {
  if (/GASTOS/i.test(seccion)) {
    metaSeccion.factor = -1;
  } else if (/INGRESOS/i.test(seccion)) {
    metaSeccion.factor = 1;
  }
  break;
}
```

---

#### **7. GASTOS GENERALES**

**Operaciones Especiales:**

**Configuración por Capítulo:**
- **CDMX:** "Total GA CdMx"
- **Otros:** "Total"

**Ajuste de Utilidad Cambiaria:**
```javascript
// Líneas 2570-2590:
const requiereAjusteUtilidad = 
  moduloEsGastosGenerales && 
  /GASTOS FINANCIEROS/i.test(seccion);

if (requiereAjusteUtilidad) {
  metaSeccion.restarUtilidadCambiaria = true;
  metaSeccion.factor = -1;
}
```

**Secciones que Aplican:**
- Depreciaciones (`factor = -1`)
- GA Capítulo (`factor = -1`)
- Member Centricity (`factor = -1`)
- Gastos Corporativos (`factor = -1`)
- Gastos Generales (`factor = -1`)
- Gastos Financieros (`factor = -1`, con ajuste especial)

**Código (Líneas 2650-2710):**
```javascript
case 'gastosgenerales': {
  const totalLabel = /CIUDAD DE MEXICO/i.test(capitulo) 
    ? "Total GA CdMx" 
    : "Total";
    
  if (esDepreciaciones || esGaCapitulo || esMemberCentricity || 
      esGastosCorporativos || esGastosGenerales) {
    metaSeccion.factor = -1;
    agregarResultRow(metaSeccion, totalLabel);
  } else if (esGastosFinancieros) {
    metaSeccion.factor = -1; // Para "Otros Ingresos vs Gastos"
  }
  break;
}
```

---

#### **8. MEMBRESÍA**

**Operaciones:**

**Resultado Operativo:**
```
= Ingresos Membresía - Gastos Operativos
```

**Resultado Final:**
```
= Resultado Operativo - Gastos Administrativos
```

**Código (Líneas 2950-2980):**
```javascript
case 'membresia': {
  if (/GASTOS\s+ADMIN/i.test(seccion)) {
    metaSeccion.factor = -1;
    agregarResultRow(metaSeccion, "Resultado Membresía");
    metaSeccion.sumRowSumavariosTexto = ""; // Excluir de operativo
  } else {
    if (/GASTOS/i.test(seccion)) {
      metaSeccion.factor = -1;
    } else if (/INGRESOS/i.test(seccion)) {
      metaSeccion.factor = 1;
    }
  }
  break;
}
```

---

#### **9. RH (Recursos Humanos)**

**Operaciones:**
- **SUM:** Ingresos (si existen)
- **RESTA:** Gastos de nómina, deducciones, impuestos
- **RESULT-ROW:** "Resultado RH" (si tiene Gastos Admin)

**Código (Líneas 2930-2950):**
```javascript
case 'rh':
case 'recursoshumanos': {
  if (/GASTOS|DEDUC|IMPUEST|NOMINA/i.test(seccion)) {
    metaSeccion.factor = -1;
  } else if (/INGRESOS/i.test(seccion)) {
    metaSeccion.factor = 1;
  }
  
  // Gastos Admin excluidos de operativo
  if (/GASTOS\s+ADMIN/i.test(seccion)) {
    agregarResultRow(metaSeccion, "Resultado RH");
    metaSeccion.sumRowSumavariosTexto = "";
  }
  break;
}
```

---

#### **10. SERVICIOS A LA MEMBRESÍA**

**Operaciones:**
- **SUM:** Ingresos por servicios
- **RESTA:** Gastos operativos
- **RESULT-ROW:** Variable por capítulo

**Código (Líneas 2980-3000):**
```javascript
case 'servmembresia':
case 'serviciosalamembresia': {
  if (/GASTOS/i.test(seccion)) {
    metaSeccion.factor = -1;
  } else if (/INGRESOS/i.test(seccion)) {
    metaSeccion.factor = 1;
  }
  break;
}
```

---

#### **11. VPE (Vinculación con el Poder Ejecutivo)**

**Operaciones:**
- **SUM:** Ingresos VPE
- **RESTA:** Gastos VPE
- **RESULT-ROW:** Variable

**Código (Líneas 3000-3020):**
```javascript
case 'tic':
case 'vpe': {
  if (/GASTOS/i.test(seccion)) {
    metaSeccion.factor = -1;
  } else if (/INGRESOS/i.test(seccion)) {
    metaSeccion.factor = 1;
  }
  break;
}
```

---

#### **12. DIRECCIÓN**

**Operaciones Especiales:**

**Resultado Operativo:**
```
= Ingresos CE + Ingresos Board + Ingresos Dirección - Gastos (sin Admin)
```

**Resultado Director:**
```
= Resultado Operativo - Gastos de Administración
```

**Código (Líneas 3020-3100):**
```javascript
case 'direccion': {
  const esGastosAdminDir = /GASTOS\s+DE\s+ADMINISTRACION|GASTOS\s+ADMINISTRATIVOS/i.test(seccion);
  
  if (/GASTOS/i.test(seccion)) {
    metaSeccion.factor = -1;
  } else if (/INGRESOS/i.test(seccion)) {
    metaSeccion.factor = 1;
  }

  const etiquetaOperativo = "Resultado Operativo";
  let etiquetaDir = "Resultado Director Capítulo";

  if (esGastosAdminDir) {
    metaSeccion.factor = -1;
    // Excluir de la suma operativa
    metaSeccion.sumRowSumavariosTexto = "";
    metaSeccion.resultRowTexto = normalizarTexto(etiquetaDir);
    metaSeccion.resultRows.push(etiquetaDir);
  } else {
    // Ingresos/Gastos aportan al operativo Y al resultado director
    if (!metaSeccion.sumRowSumavariosLabel) {
      metaSeccion.sumRowSumavariosLabel = etiquetaOperativo;
      metaSeccion.sumRowSumavariosTexto = normalizarTexto(etiquetaOperativo);
    }
    metaSeccion.resultRowTexto = normalizarTexto(etiquetaDir);
    metaSeccion.resultRows.push(etiquetaDir);
  }
  break;
}
```

---

## 📊 Módulo SUMMARY

### 🔧 Motor de Cálculo

**Archivo:** `vistas/js/summary.js`  
**Líneas:** 300-800 (sistema de fórmulas)

### Sistema de Fórmulas

El módulo SUMMARY utiliza **3 tipos de fórmulas** aplicadas en diferentes momentos:

#### **1. ROW_FORMULAS (Línea 343)**

**Descripción:** Se ejecuta una vez por fila renderizable

**Uso:**
```javascript
const ROW_FORMULAS = {
  income_total: ({ row }) => {
    row.mesActual = row.mesActual * 1.1; // Aplicar margen del 10%
  }
};
```

**Contexto Disponible:**
- `ctx.row` → Objeto fila (mutable)
- `ctx.rowIndex` → Índice en tabla (base 0)
- `ctx.rows` → Todas las filas
- `ctx.getRow(rowId)` → Buscar fila por ID
- `ctx.getValue(rowId, columnKey)` → Leer celda
- `ctx.setValue(rowId, columnKey, value)` → Escribir celda

---

#### **2. CELL_FORMULAS (Línea 352)**

**Descripción:** Se ejecuta por cada celda (fila + columna)

**Uso:**
```javascript
const CELL_FORMULAS = {
  membership_sub: {
    mesVariacionPlan: ({ value, row }) => {
      return pct(row.mesActual, row.mesPlan); // Calcular % variación
    }
  }
};
```

**Contexto Disponible:**
- Todo de ROW_FORMULAS
- `ctx.columnKey` → Clave de columna
- `ctx.columnMeta` → Metadata (tipo, índice)
- `ctx.value` → Valor actual de la celda

---

#### **3. COLUMN_FORMULAS (Línea 361)**

**Descripción:** Se ejecuta una vez por columna con acceso a todas las filas

**Uso:**
```javascript
const COLUMN_FORMULAS = {
  acumuladoActual: ({ values, setValue }) => {
    const total = values.reduce((sum, item) => {
      if (item.row.tipoFila === 'total') return sum;
      return sum + (item.value || 0);
    }, 0);
    setValue('income_total', total);
  }
};
```

**Contexto Disponible:**
- `ctx.values` → Array de `{ rowId, row, value }`
- `ctx.setValue(rowId, value)` → Asignar en fila

---

### Motor de Ejecución

**Función:** `applyFormulaEngine()` - Línea 461

**Proceso:**
```javascript
const applyFormulaEngine = (rows) => {
  // 1. Clonar filas
  const cloned = rows.map((row, index) => ({
    ...row,
    rowNumber: index + 1 // 1-based para UI
  }));
  
  // 2. Aplicar fórmulas en orden
  applyRowFormulas(cloned);    // ← Primero por fila
  applyCellFormulas(cloned);   // ← Luego por celda
  applyColumnFormulas(cloned); // ← Finalmente por columna
  
  return cloned;
};
```

---

### Definición de Columnas

**Línea 306-317:**
```javascript
const COLUMN_DEFS = [
  { key: 'mesActual', colIndex: 3, label: 'Mes actual', tipo: 'currency' },
  { key: 'mesPlan', colIndex: 4, label: 'Mes plan', tipo: 'currency' },
  { key: 'mesAnterior', colIndex: 5, label: 'Mes anterior', tipo: 'currency' },
  { key: 'mesVariacionPlan', colIndex: 6, label: 'Var. mes vs plan', tipo: 'percent' },
  { key: 'mesVariacionAnterior', colIndex: 7, label: 'Var. mes vs anterior', tipo: 'percent' },
  { key: 'acumuladoActual', colIndex: 8, label: 'YTD actual', tipo: 'currency' },
  { key: 'acumuladoPlan', colIndex: 9, label: 'YTD plan', tipo: 'currency' },
  { key: 'acumuladoAnterior', colIndex: 10, label: 'YTD anterior', tipo: 'currency' },
  { key: 'acumuladoVariacionPlan', colIndex: 11, label: 'Var. YTD vs plan', tipo: 'percent' },
  { key: 'acumuladoVariacionAnterior', colIndex: 12, label: 'Var. YTD vs anterior', tipo: 'percent' }
];
```

---

### Estrategia de Cálculo

**Línea 509-514:**
```javascript
const CALC_STRATEGY = {
  modo: 'server',            // 'server' | 'client'
  fuente: () => CTX.fuente   // 'SALDOSxx' | 'ACUMxx'
};
```

**Modos de Operación:**

#### **Modo Server (Default):**
El backend (`src/routes/modulos.js`) devuelve métricas ya calculadas:
```javascript
{
  detalle: [
    { codigo: '4010100...', mesActual: 150000, ... }
  ],
  ejercicios: [...]
}
```

#### **Modo Client:**
El backend devuelve datos crudos de `SALDOSxx` o `ACUMxx` y JavaScript calcula métricas en el navegador.

---

### Operaciones con SALDOSxx

**Función:** `detalleDesdeSALDOS()` - Línea 469

**Proceso:**
```javascript
// Movimiento del mes
const movMes = (+raw[`CARGO${periodo}`] || 0) - (+raw[`ABONO${periodo}`] || 0);

// YTD (Year-To-Date)
const cargos = [], abonos = [];
for (let i = 1; i <= periodo; i++) {
  const mes = String(i).padStart(2, '0');
  cargos.push(+raw[`CARGO${mes}`] || 0);
  abonos.push(+raw[`ABONO${mes}`] || 0);
}
const ytd = inicial + (sum(cargos) - sum(abonos));

// Incluir ajuste si periodo === 13
if (incluirAjusteEnYTD && periodo === 13) {
  ytd += (+raw.CARGO13 || 0) - (+raw.ABONO13 || 0);
}
```

**Resultado:**
```javascript
{
  mesActual,      // Cargo - Abono del periodo
  mesAnterior,    // Mismo cálculo para año anterior
  acumuladoActual, // YTD = INICIAL + SUM(CARGOS) - SUM(ABONOS)
  acumuladoAnterior // YTD del año comparativo
}
```

---

### Operaciones con ACUMxx

**Función:** `detalleDesdeACUM()` - Línea 494

**Proceso:**
```javascript
const colMes = ['ENERO','FEB','MARZO',...,'DICIEMBRE'];
const i = periodo - 1;
const col = i < 12 ? colMes[i] : 'AJUSTE';

// Mes actual
mesActual = +raw[col] || 0;

// YTD
const take = i < 12 ? colMes.slice(0, i+1) : colMes;
acumuladoActual = take.reduce((a, c) => a + (+raw[c] || 0), 0);

// Incluir ajuste si periodo === 13
if (incluirAjusteEnYTD && periodo === 13) {
  acumuladoActual += (+raw.AJUSTE || 0);
}
```

---

## 🏢 Módulo RESUMEN

### 🔧 Motor de Cálculo

**Archivo:** `vistas/js/resumen-view.js`  
**Líneas:** 1-1386

**Propósito:** Consolidación de todos los capítulos en un único reporte ejecutivo

**Similar al motor de SUMMARY pero enfocado en consolidación multi-capítulo**

---

## 🎯 RESULTADOS OPERATIVOS, NETOS Y CONSOLIDADOS

### 📊 Jerarquía de Resultados

El sistema maneja **5 niveles jerárquicos** de resultados financieros:

```
NIVEL 1: Cuentas individuales (401-010, 501-020, etc.)
    ↓
NIVEL 2: Secciones (sum-row)
    ↓  
NIVEL 3: Principales (INCOME, EXPENSE)
    ↓
NIVEL 4: Consolidados (CONSOLIDATED INCOME/EXPENSE)
    ↓
NIVEL 5: Operating Results
    ↓
NIVEL 6: Net Results / Consolidated Net Results
```

---

### 1️⃣ **OPERATING RESULTS (Resultados Operativos)**

#### Definición

Resultado de las operaciones principales del negocio:
```
Operating Results = Total Income - Total Expenses
```

#### Ubicación en Código

**SUMMARY:**
- **Archivo:** `vistas/js/summary-view.js`
- **Líneas:** 970-975 (identificación y jerarquía)
- **Líneas:** 320-323 (tooltips descriptivos)

**RESUMEN:**
- **Archivo:** `vistas/js/resumen-view.js`
- **Líneas:** 1017, 1163-1177 (cálculo por plaza)
- **Líneas:** 311-313 (documentación)

#### Cálculo Detallado

**Código en summary-view.js (Líneas 973-976):**
```javascript
// Nivel 4: OPERATING RESULTS
else if (label.includes('OPERATING RESULTS') || 
         label.includes('OPERATING INCOME')) {
  return 4;
}
```

**Proceso de Cálculo:**

**Paso 1:** Sumar todos los INCOME
```javascript
const totalIncome = secciones
  .filter(meta => /INCOME/i.test(meta.tituloVisible))
  .map(meta => meta.sumValues)
  .reduce((acum, valores) => sumarListas([acum, valores]));
```

**Paso 2:** Sumar todos los EXPENSE (con factor -1)
```javascript
const totalExpense = secciones
  .filter(meta => /EXPENSE/i.test(meta.tituloVisible))
  .map(meta => {
    const factor = meta.factor || -1; // Gastos son negativos
    return meta.sumValues.map(v => v * factor);
  })
  .reduce((acum, valores) => sumarListas([acum, valores]));
```

**Paso 3:** Calcular Operating Results
```javascript
const operatingResults = sumarListas([totalIncome, totalExpense]);
```

#### Variaciones por Módulo

**CIUDAD DE MÉXICO:**
```
Operating Results CDMX = 
  CDMX Income 
  - CDMX Expense (sin Gastos Administrativos)
```

**GUADALAJARA:**
```
Operating Results GDL = 
  Guadalajara Income 
  - Guadalajara Expense (sin Comisiones en algunos casos)
```

**MONTERREY/NORESTE/NOROESTE:**
```
Operating Results [Plaza] = 
  [Plaza] Income 
  - [Plaza] Expense
```

#### Identificación en RESUMEN

**Código en resumen-view.js (Líneas 1163-1177):**
```javascript
// Operating Results por plaza antes de los consolidados globales
const opResults = {
  mex: orden.filter(r => /MEXICO.*OPERATING/i.test(r.label)),
  gdl: orden.filter(r => /GDL.*OPERATING|GUADALAJARA.*OPERATING/i.test(r.label)),
  mty: orden.filter(r => /MTY.*OPERATING|MONTERREY.*OPERATING/i.test(r.label)),
  // ...
};

asignarPrimero(["OPERATING RESULTS MEXICO"], opResults.mex);
asignarPrimero(["OPERATING RESULTS GUADALAJARA", "GDL OPERATING RESULTS"], opResults.gdl);
asignarPrimero(["OPERATING RESULTS MONTERREY", "MTY OPERATING RESULTS"], opResults.mty);
```

#### Ejemplo Real

```
MÓDULO: SUMMARY (Capítulo CDMX)
├─ CDMX Income
│  ├─ Membership              $500,000
│  ├─ Events                  $300,000
│  ├─ Committees              $200,000
│  └─ Services to Members     $100,000
│  └─ TOTAL INCOME          $1,100,000
│
├─ CDMX Expense
│  ├─ Membership               -$200,000
│  ├─ Events                   -$150,000
│  ├─ Committees               -$100,000
│  └─ Services to Members       -$50,000
│  └─ TOTAL EXPENSE            -$500,000
│
└─ OPERATING RESULTS CDMX      $600,000  ← Income - Expense
```

---

### 2️⃣ **CONSOLIDATED RESULTS (Resultados Consolidados)**

#### Definición

Agrupación de múltiples secciones principales bajo una categoría común:

```
CONSOLIDATED INCOME = Sum(CDMX Income, GDL Income, MTY Income, ...)
CONSOLIDATED EXPENSE = Sum(CDMX Expense, GDL Expense, MTY Expense, ...)
```

#### Ubicación en Código

**SUMMARY:**
- **Archivo:** `vistas/js/summary-view.js`
- **Líneas:** 977-980 (identificación jerárquica)
- **Línea:** 320 (tooltip: "Fila consolidada")

**Agregación:**
- **Archivo:** `vistas/js/summary-aggregates.js`
- **Líneas:** 132-172 (cálculo de consolidados)

#### Cálculo Detallado

**Código en summary-view.js (Líneas 977-980):**
```javascript
// Nivel 3: CONSOLIDATED INCOME/EXPENSES
else if (label.includes('CONSOLIDATED') && 
        (label.includes('INCOME') || label.includes('EXPENSE'))) {
  return 3;
}
```

**Código en summary-aggregates.js (Líneas 132-170):**
```javascript
const consolidated = {
  income: { actual: 0, plan: 0, prev: 0 },
  expense: { actual: 0, plan: 0, prev: 0 },
  operating: { actual: 0, plan: 0, prev: 0 },
  other: { actual: 0, plan: 0, prev: 0 },
  net: { actual: 0, plan: 0, prev: 0 }
};

chapters.forEach((chapter) => {
  const metrics = calculateChapterMetrics(chapter);
  
  // Consolidar por categoría
  Object.keys(consolidated).forEach((key) => {
    consolidated[key].actual += metrics[key].actual || 0;
    consolidated[key].plan += metrics[key].plan || 0;
    consolidated[key].prev += metrics[key].prev || 0;
  });
});

// Renderizar fila consolidada
const consolidatedRow = document.createElement('tr');
consolidatedRow.className = 'table-info fw-semibold';
consolidatedRow.innerHTML = `
  <td>Consolidated</td>
  <td>${formatCurrency.format(consolidated.income.actual)}</td>
  <td>${formatCurrency.format(consolidated.expense.actual)}</td>
  <td>${formatCurrency.format(consolidated.operating.actual)}</td>
  <td>${formatCurrency.format(consolidated.other.actual)}</td>
  <td>${formatCurrency.format(consolidated.net.actual)}</td>
`;
```

#### Proceso de Consolidación

**Paso 1:** Identificar secciones principales por capítulo
```javascript
const chapters = [
  { name: 'CDMX', income: [...], expense: [...] },
  { name: 'GDL', income: [...], expense: [...] },
  { name: 'MTY', income: [...], expense: [...] },
  // ...
];
```

**Paso 2:** Sumar por categoría
```javascript
const consolidatedIncome = chapters
  .map(ch => ch.income)
  .reduce((total, income) => total + income, 0);

const consolidatedExpense = chapters
  .map(ch => ch.expense)
  .reduce((total, expense) => total + expense, 0);
```

**Paso 3:** Crear filas consolidadas
```javascript
createRow('CONSOLIDATED INCOME', consolidatedIncome);
createRow('CONSOLIDATED EXPENSE', consolidatedExpense);
```

#### Ejemplo Real

```
MÓDULO: SUMMARY (Consolidación Multi-Capítulo)

CDMX Income             $1,100,000
GDL Income                $800,000
MTY Income                $600,000
NE Income                 $400,000
NO Income                 $300,000
──────────────────────────────────
CONSOLIDATED INCOME     $3,200,000  ← Suma de todos los capítulos

CDMX Expense              -$500,000
GDL Expense               -$350,000
MTY Expense               -$280,000
NE Expense                -$200,000
NO Expense                -$150,000
──────────────────────────────────
CONSOLIDATED EXPENSE    -$1,480,000  ← Suma de todos los gastos
```

---

### 3️⃣ **NET RESULTS (Resultados Netos)**

#### Definición

Resultado final después de sumar otros ingresos/egresos al resultado operativo:

```
Net Results = Operating Results + Other Income - Other Expenses
```

#### Ubicación en Código

**SUMMARY:**
- **Archivo:** `vistas/js/summary-view.js`
- **Líneas:** 969-972 (máxima jerarquía - nivel 5)
- **Línea:** 322 (tooltip: "Net Results por región/segmento")

**RESUMEN:**
- **Archivo:** `vistas/js/resumen-view.js`
- **Líneas:** 215-217 (debug especial para CONSOLIDATED NET)
- **Líneas:** 240-246 (logging de filas consolidadas)
- **Línea:** 313 (documentación de cálculo)

#### Cálculo Detallado

**Código en summary-view.js (Líneas 969-972):**
```javascript
// Nivel 5: NET RESULTS (máxima jerarquía)
if (blockType === 'final' || 
    label.includes('NET RESULTS') || 
    label.includes('CONSOLIDATED NET')) {
  return 5;
}
```

**Proceso de Cálculo:**

**Paso 1:** Tomar Operating Results
```javascript
const operatingResults = getValue('operating_results_row');
```

**Paso 2:** Identificar "Other Income" (ingresos adicionales)
```javascript
const otherIncome = secciones
  .filter(meta => /OTHER INCOME/i.test(meta.tituloVisible))
  .map(meta => meta.sumValues)
  .reduce((acum, valores) => sumarListas([acum, valores]));
```

**Paso 3:** Calcular Net Results
```javascript
const netResults = sumarListas([operatingResults, otherIncome]);
```

#### Debug en RESUMEN

**Código en resumen-view.js (Líneas 215-247):**
```javascript
// Debug especial para CONSOLIDATED NET RESULTS
if (label.toUpperCase().includes("CONSOLIDATED NET")) {
  console.log("📸 DEBUG CONSOLIDATED NET:", {
    label,
    acumuladoActual: obj.acumuladoActual,
    mesActual: obj.mesActual,
    componentes: obj.componentes || "N/A"
  });
}

// Logging especial para CONSOLIDATED
const consolidated = datos.filter((d) =>
  d.label.toUpperCase().includes("CONSOLIDATED")
);

console.log(
  "📸 RESUMEN: CONSOLIDATED rows:",
  consolidated.map((d) => ({
    label: d.label,
    acumuladoActual: d.acumuladoActual,
    mesActual: d.mesActual
  }))
);
```

#### Componentes de Net Results

**1. Operating Results (base)**
- Income operativo
- Expense operativo

**2. Other Income (ajustes positivos)**
- Ingresos financieros
- Ventas extraordinarias
- Utilidad cambiaria

**3. Other Expenses (ajustes negativos)**
- Gastos financieros
- Depreciación
- Pérdida cambiaria

#### Ejemplo Real

```
MÓDULO: SUMMARY (Resultado Neto)

OPERATING RESULTS CDMX      $600,000

+ OTHER INCOME
  ├─ Ingresos Financieros    $50,000
  └─ Utilidad Cambiaria      $20,000
  └─ TOTAL OTHER INCOME      $70,000

- OTHER EXPENSES  
  ├─ Gastos Financieros     -$30,000
  └─ Depreciación           -$40,000
  └─ TOTAL OTHER EXPENSE    -$70,000
────────────────────────────────────
NET RESULTS CDMX            $600,000  ← Operating + Other Income - Other Expenses
```

---

### 4️⃣ **CONSOLIDATED NET RESULTS (Resultados Netos Consolidados)**

#### Definición

El resultado final más alto de la jerarquía: Net Results de TODOS los capítulos consolidados:

```
Consolidated Net Results = 
  Sum(Net Results CDMX, Net Results GDL, Net Results MTY, ...)
```

#### Ubicación en Código

**SUMMARY:**
- **Archivo:** `vistas/js/summary-view.js`
- **Líneas:** 969-972 (jerarquía nivel 5)
- **Línea:** 323 (tooltip: "Consolidated Net Results: cierre final")

**RESUMEN:**
- **Archivo:** `vistas/js/resumen-view.js`
- **Líneas:** 215-217 (debug especial)
- **Líneas:** 240-246 (logging de consolidación)

#### Cálculo Detallado

**Proceso Completo:**

**Paso 1:** Calcular Net Results por capítulo
```javascript
const netResultsCDMX = calcularNetResults('CDMX');
const netResultsGDL = calcularNetResults('GDL');
const netResultsMTY = calcularNetResults('MTY');
const netResultsNE = calcularNetResults('NE');
const netResultsNO = calcularNetResults('NO');
```

**Paso 2:** Consolidar todos los Net Results
```javascript
const consolidatedNetResults = sumarListas([
  netResultsCDMX,
  netResultsGDL,
  netResultsMTY,
  netResultsNE,
  netResultsNO
]);
```

**Paso 3:** Crear fila final
```javascript
createFinalRow('CONSOLIDATED NET RESULTS', consolidatedNetResults);
```

#### Tooltip Descriptivo

**Código en summary-view.js (Línea 323):**
```javascript
final: 'Consolidated Net Results: cierre final tras sumar otros ingresos ("OTHER INCOME") al Operating Result.'
```

#### Ejemplo Real - Flujo Completo

```
MÓDULO: SUMMARY (Consolidación Total)

CDMX:
  Operating Results         $600,000
  + Other Income             $70,000
  - Other Expenses          -$70,000
  = NET RESULTS CDMX        $600,000

GUADALAJARA:
  Operating Results         $450,000
  + Other Income             $30,000
  - Other Expenses          -$50,000
  = NET RESULTS GDL         $430,000

MONTERREY:
  Operating Results         $320,000
  + Other Income             $20,000
  - Other Expenses          -$40,000
  = NET RESULTS MTY         $300,000

NORESTE:
  Operating Results         $200,000
  + Other Income             $10,000
  - Other Expenses          -$20,000
  = NET RESULTS NE          $190,000

NOROESTE:
  Operating Results         $150,000
  + Other Income              $5,000
  - Other Expenses          -$15,000
  = NET RESULTS NO          $140,000

═══════════════════════════════════════════════════════
CONSOLIDATED NET RESULTS  $1,660,000  ← RESULTADO FINAL
═══════════════════════════════════════════════════════
```

---

### 📊 Tabla Resumen de Jerarquía

| Nivel | Tipo | Ejemplo | Operación | Factor |
|-------|------|---------|-----------|--------|
| 1 | Cuenta | 401-010 Cuotas | Individual | 1 |
| 2 | Sección | "Total Ingresos Membresía" | SUM cuentas | 1 |
| 3 | Principal | "CDMX Income" | SUM secciones | 1 |
| 4 | Consolidado | "CONSOLIDATED INCOME" | SUM principales | 1 |
| 5 | Operativo | "OPERATING RESULTS" | Income - Expense | +1/-1 |
| 6 | Neto | "NET RESULTS" | Operating + Other | +1/-1 |
| 7 | Neto Consolidado | "CONSOLIDATED NET RESULTS" | SUM Net Results | 1 |

---

### 🔍 Identificación Automática de Tipos

**Código en summary-view.js (Líneas 969-985):**
```javascript
const determinarNivelJerarquia = (label, blockType) => {
  // Nivel 5: NET RESULTS (máxima jerarquía)
  if (blockType === 'final' || 
      label.includes('NET RESULTS') || 
      label.includes('CONSOLIDATED NET')) {
    return 5;
  }
  
  // Nivel 4: OPERATING RESULTS
  else if (label.includes('OPERATING RESULTS') || 
           label.includes('OPERATING INCOME')) {
    return 4;
  }
  
  // Nivel 3: CONSOLIDATED INCOME/EXPENSES
  else if (label.includes('CONSOLIDATED') && 
          (label.includes('INCOME') || label.includes('EXPENSE'))) {
    return 3;
  }
  
  // Nivel 2: Principal (INCOME, EXPENSE sin CONSOLIDATED)
  else if ((label.includes('INCOME') || label.includes('EXPENSE')) && 
           !label.includes('CONSOLIDATED')) {
    return 2;
  }
  
  // Nivel 1: Sección o cuenta
  return 1;
};
```

---

### 📝 Configuración en JSON

**Archivo:** `info IMPORTANTE/CUENTAS SUMMARY y RESUMEN.json`

**Estructura de Secciones Principales:**
```json
{
  "CAPITULO": "CIUDAD DE MÉXICO",
  "SECCIÓN Principal": "CDMX Income",
  "SECCION Secundaria": "Membership",
  "CUENTA": "401000000000000000001",
  "NOMBRE": "Cuotas Netas"
}
```

**Principales Identificados:**
- `"CDMX Income"` → Factor +1
- `"CDMX Expense"` → Factor -1
- `"Guadalajara Income"` → Factor +1
- `"Guadalajara Expense"` → Factor -1
- `"Monterrey Income"` → Factor +1
- `"Monterrey Expense"` → Factor -1

---

## 🛠️ Tipos de Operaciones (Referencia Rápida)

### 1. **SUM (Suma Simple)**

**Operación:** `a + b + c`

**Factor:** `1`

**Uso:** Ingresos, totales de sección

**Ejemplo:**
```javascript
// Línea 3875-3885 en recalcularSumas()
suma += valor * 1; // Factor positivo
```

---

### 2. **RESTA (Diferencia)**

**Operación:** `a - b`

**Factor:** `-1`

**Uso:** Gastos, deducciones

**Ejemplo:**
```javascript
suma += valor * (-1); // Factor negativo
```

---

### 3. **DIVISIÓN (Promedio)**

**Operación:** `a / n`

**Factor:** `0.5` (para dividir entre 2)

**Uso:** Promedios, distribuciones

**Ejemplo:**
```javascript
suma += valor * 0.5; // Mitad del valor
```

---

### 4. **MULTIPLICACIÓN (Amplificación)**

**Operación:** `a * n`

**Factor:** `> 1` (ej: `1.16` para IVA)

**Uso:** Márgenes, IVA, ajustes

**Ejemplo:**
```javascript
suma += valor * 1.16; // Con 16% IVA
```

---

### 5. **SUM de SUM (Sumavarios)**

**Operación:** `sum(sum_row1, sum_row2, ...)`

**Mecanismo:** Agrupa múltiples `sum-row`

**Uso:** Resultados consolidados

**Ejemplo:**
```javascript
// Líneas 3920-3985
const sumaTotal = secciones
  .map(meta => meta.sumValues)
  .reduce((acum, valores) => sumarListas([acum, valores]));
```

---

## 📂 Ubicación del Código Fuente

### Archivos JavaScript

| Archivo | Propósito | Líneas Clave |
|---------|-----------|--------------|
| **`vistas/js/cuentas-modulo.js`** | Motor 11 módulos operativos | 200-4035 |
| **`vistas/js/summary.js`** | Motor SUMMARY | 1-1058 |
| **`vistas/js/resumen-view.js`** | Motor RESUMEN | 1-1386 |
| **`vistas/js/operation-sync.js`** | Sincronización operaciones | 1-500 |

### Funciones Críticas

#### **cuentas-modulo.js:**

| Función | Líneas | Descripción |
|---------|--------|-------------|
| `recalcularSumas()` | 3835-4035 | **Motor principal** de cálculo |
| `agregarFilaResumen()` | 1340-1390 | Crea filas sum-row |
| `renderizarSecciones()` | 1391-3100 | Construye estructura HTML |
| `recalcularTotalesFilaPresupuesto()` | 800-850 | Totales horizontales |
| `extraerValoresNumericos()` | 3100-3150 | Lee valores de celdas |
| `sumarListas()` | 3150-3180 | Suma columnas verticales |

#### **summary.js:**

| Función | Líneas | Descripción |
|---------|--------|-------------|
| `applyFormulaEngine()` | 461-475 | Orquestador de fórmulas |
| `applyRowFormulas()` | 380-410 | Fórmulas por fila |
| `applyCellFormulas()` | 420-450 | Fórmulas por celda |
| `applyColumnFormulas()` | 451-460 | Fórmulas por columna |
| `detalleDesdeSALDOS()` | 469-493 | Cálculo desde SALDOSxx |
| `detalleDesdeACUM()` | 494-508 | Cálculo desde ACUMxx |

---

## 🗂️ Archivos de Configuración

### Datos de Cuentas

| Archivo | Propósito | Módulos |
|---------|-----------|---------|
| **`info IMPORTANTE/CUENTAS.json`** | Estructura de cuentas por capítulo/sección | 11 módulos operativos |
| **`info IMPORTANTE/CUENTAS SUMMARY y RESUMEN.json`** | Operaciones de consolidación | SUMMARY + RESUMEN |
| **`info IMPORTANTE/METADATA/PPTO/formulasppto.json`** | Fórmulas Excel originales (69,662 líneas) | Todos (referencia) |

### Datos de Sumas

**Variable Global:** `window.CUENTAS_SUMAS`

**Ubicación en Código:** Cargada dinámicamente desde JSON en `cuentas-modulo.js`

**Estructura:**
```javascript
{
  "sheetName": {
    "capitulo_normalizado": {
      "seccion_normalizada": {
        sumRow: "Etiqueta sum-row",
        sumRowSumavarios: "Etiqueta sumavarios",
        sumRowSumavarios2: "Etiqueta sumavarios2",
        resultRow: "Etiqueta result-row",
        operacionFactor: 1 // o -1, 0.5, etc.
      }
    }
  }
}
```

**Función de Acceso:** `obtenerSumasConfig()` - Línea 3200

---

## 🔍 Búsqueda Rápida por Palabra Clave

### Si buscas...

#### **"Cómo se suman las cuentas"**
→ Ver función `recalcularSumas()` en **cuentas-modulo.js línea 3835**

#### **"Cómo se restan los gastos"**
→ Ver aplicación de `operacionFactor = -1` en **cuentas-modulo.js línea 3885**

#### **"Cómo se agrupan los sum-rows"**
→ Ver lógica de `sumavarios` en **cuentas-modulo.js líneas 3920-3985**

#### **"Cómo se calculan variaciones en SUMMARY"**
→ Ver `CELL_FORMULAS` en **summary.js línea 352**

#### **"Cómo funcionan los factores personalizados"**
→ Ver modal de edición en **cuentas-modulo.js líneas 2200-2400**

#### **"Dónde se configura qué se suma y qué se resta"**
→ Ver heurísticas automáticas en **cuentas-modulo.js líneas 2650-3100**

---

## 📌 Notas Importantes

### Precedencia de Factores

1. **Factor Manual** (definido en modal de edición)
2. **Heurísticas Automáticas** (basadas en nombre de sección)
3. **Factor por Defecto** (`1`)

### Cálculo de YTD (Year-To-Date)

**Para 11 módulos operativos:**
```
YTD = SUM(real_ene ... real_[periodo])
```

**Para SUMMARY/RESUMEN:**
```
YTD = INICIAL + SUM(CARGO01...CARGO[periodo]) - SUM(ABONO01...ABONO[periodo])
```

### Ajuste de Cierre (Periodo 13)

**Cuando `periodo === 13` y `incluirAjusteEnYTD === true`:**
```javascript
if (periodo === 13) {
  ytd += (+raw.CARGO13 || 0) - (+raw.ABONO13 || 0);
}
```

### Naturaleza de Cuentas

**No afecta el signo** en la visualización. El factor de operación se define por:
- Configuración manual (`operacionFactor`)
- Heurísticas automáticas (basadas en nombre de sección)

---

## ✅ Validación de Operaciones

Para verificar que una operación se está ejecutando correctamente:

### 1. **Abrir Consola del Navegador**
```
F12 → Console
```

### 2. **Ejecutar Comando de Depuración**
```javascript
// Ver sumas calculadas por sección
console.table(estadoModulo.sumas.secciones);

// Ver valores por cuenta
console.table(Array.from(estadoModulo.valoresPorCuenta.entries()));

// Ver estructura de sumavarios
console.table(Array.from(estadoModulo.sumas.sumavariosRows.entries()));
```

### 3. **Verificar Factor de Operación**
```javascript
// Seleccionar una fila en la tabla
const fila = document.querySelector('.fila-cuenta[data-cuenta21="tu_cuenta"]');
console.log("Factor:", fila.dataset.operacionFactor);
```

---

## 🎓 Glosario

### Términos Clave

| Término | Definición |
|---------|------------|
| **sum-row** | Fila que suma todas las cuentas de UNA sección |
| **sumavarios** | Fila que suma VARIOS sum-rows bajo una etiqueta común |
| **result-row** | Fila con el resultado final del módulo/capítulo |
| **operacionFactor** | Multiplicador que define si se suma (+1), resta (-1), divide (0.5), etc. |
| **seccionMeta** | Objeto con metadata de una sección (filas, etiquetas, factores) |
| **YTD** | Year-To-Date: acumulado desde enero hasta el periodo actual |
| **SALDOSxx** | Tablas de balanza contable con CARGO/ABONO por mes |
| **ACUMxx** | Tablas de acumulados mensuales (ENERO, FEB, ..., DICIEMBRE, AJUSTE) |

---

## 📞 Soporte

Para dudas sobre operaciones específicas, revisar:
1. Este documento (MAPA_COMPLETO_OPERACIONES.md)
2. Documentación técnica (LOGICA_OPERACIONES_MODULOS.md)
3. Código fuente con comentarios en archivos `.js`

---

**Última actualización:** ${new Date().toISOString().split('T')[0]}  
**Versión del Sistema:** 1.0.0  
**Módulos Documentados:** 13/13 ✅
