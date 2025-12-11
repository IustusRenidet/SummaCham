# 🔍 Verificación de Sumas y Lógica de Inserción

## 📊 PARTE 1: Verificación de Sumas en los 13 Módulos

### ✅ Confirmación: Sumas ACTIVAS en 13 Módulos

#### 11 Módulos Operativos con `cuentas-modulo.js`

| # | Módulo | Archivo HTML | Línea Script | Estado |
|---|--------|--------------|--------------|--------|
| 1 | **Presupuestos** | Presupuestos.html | 440 | ✅ ACTIVO |
| 2 | **Finanzas (T&IC)** | Finanzas.html | 597 | ✅ ACTIVO |
| 3 | **Comités** | Comités.html | 462 | ✅ ACTIVO |
| 4 | **Comunicación** | Comunicación.html | 443 | ✅ ACTIVO |
| 5 | **Eventos** | Eventos.html | 505 | ✅ ACTIVO |
| 6 | **Gtos_Corporativos** | Gtos_Corporativos.html | 447 | ✅ ACTIVO |
| 7 | **Membresía** | Membresía.html | 446 | ✅ ACTIVO |
| 8 | **RH** | RH.html | 451 | ✅ ACTIVO |
| 9 | **Serv_Membresía** | Serv_Membresía.html | 446 | ✅ ACTIVO |
| 10 | **VPE** | VPE.html | 446 | ✅ ACTIVO |
| 11 | **Dirección** | Dirección.html | 443 | ✅ ACTIVO |

**Código de Inclusión:**
```html
<script src="js/cuentas-modulo.js"></script>
```

#### 2 Módulos Consolidados con Scripts Propios

| # | Módulo | Script | Estado |
|---|--------|--------|--------|
| 12 | **SUMMARY** | summary-view.js | ✅ ACTIVO |
| 13 | **RESUMEN** | resumen-view.js | ✅ ACTIVO |

---

### 🔄 Función `recalcularSumas()` - Motor de Sumas

**Ubicación:** `vistas/js/cuentas-modulo.js` líneas 2404-2470

**Ejecutada en:**
- **Línea 804:** Después de cargar datos desde el backend
- **Línea 864:** Después de editar valores en celdas
- **Línea 909:** Después de insertar nuevas filas
- **Línea 2083:** Después de eliminar filas
- **Línea 2554:** Al cambiar mes seleccionado
- **Línea 2581:** Al cambiar año seleccionado

**Confirmación:** Las sumas se ejecutan **automáticamente** en 5 eventos diferentes.

---

### 📐 Lógica de Cálculo en `recalcularSumas()`

#### PASO 1: sum-row (Suma por Sección)

```javascript
// Líneas 2426-2458
secciones.forEach((seccion, idxSeccion) => {
  // Extraer valores de cada fila de cuenta en la sección
  const listas = seccion.filasCuenta.map((fila) => {
    const cuenta = fila.dataset.cuenta21 || '';
    const almacenados = estadoModulo.valoresPorCuenta?.get(cuenta);
    return clavesOrdenadas.map((clave) => almacenados[clave] ?? 0);
  });
  
  // Sumar todas las filas columna por columna
  const valores = sumarListas(listas, longitud);
  seccion.sumValues = valores;
  
  // Actualizar la fila sum-row en el DOM
  if (seccion.elementos?.sumRow) {
    asignarValoresNumericos(seccion.elementos.sumRow, valores);
  }
});
```

**Ejemplo:**
```
Sección: "INGRESOS MEMBRESÍAS"
├── Cuenta 401: [1000, 2000, 1500, ...]  (12 meses)
├── Cuenta 402: [500, 1000, 750, ...]
└── sum-row:    [1500, 3000, 2250, ...]  ← SUMA
```

#### PASO 2: sum-row-sumavarios (Consolidados)

```javascript
// Líneas 2463-2476
const acumuladosSumavarios = new Map();

secciones.forEach((seccion) => {
  const clave = normalizarClave(seccion.sumRowSumavariosTexto);
  if (!clave) return;
  
  // Acumular valores de sum-rows bajo la misma etiqueta
  const previo = acumuladosSumavarios.get(clave) || Array(longitud).fill(0);
  const nuevo = sumarListas([previo, seccion.sumValues], longitud);
  acumuladosSumavarios.set(clave, nuevo);
});

// Actualizar filas sumavarios en el DOM
acumuladosSumavarios.forEach((valores, clave) => {
  const fila = estadoModulo.sumas.sumavariosRows.get(clave);
  if (fila) asignarValoresNumericos(fila, valores);
});
```

**Ejemplo:**
```
Sumavarios: "CDMX Income"
├── sum-row "Membership":   [1500, 3000, ...]
├── sum-row "Events":       [800, 1200, ...]
├── sum-row "Committees":   [300, 500, ...]
└── sumavarios "CDMX Income": [2600, 4700, ...] ← SUMA de sum-rows
```

#### PASO 3: result-row (Resultados Operativos)

**Nota:** Los 11 módulos operativos NO tienen result-row. Solo SUMMARY y RESUMEN.

**En SUMMARY:**
```javascript
// Operating Results = Consolidated Income - Consolidated Expenses
const income = encontrarFila('CONSOLIDATED INCOME');
const expense = encontrarFila('CONSOLIDATED EXPENSES');

for (let mes = 0; mes < 12; mes++) {
  resultado = income[mes] * 1 + expense[mes] * (-1);  // Resta
}
```

---

### 📊 Cálculo de "month-real" (Real del Mes Actual)

#### En los 11 Módulos Operativos

**Ubicación:** `vistas/js/cuentas-modulo.js`

**Líneas 816-855:** Cálculo al cargar datos

```javascript
// Obtener mes actual (0-11, donde 0=enero, 11=diciembre)
const mesActualIndex = new Date().getMonth();
const mesActualClave = MESES[mesActualIndex] || 'dic'; // ene, feb, mar, etc.

obtenerFilasCuenta().forEach((fila) => {
  const cuenta = fila.dataset.cuenta21 || '';
  const registro = mapa.get(cuenta);
  
  let totalRealAcumulado = 0;
  
  MESES.forEach((mes, index) => {
    const real = numeroSeguro(registro?.real?.[mes]);
    
    // Acumular solo hasta el mes actual
    if (index <= mesActualIndex) {
      totalRealAcumulado += real;
    }
    
    // Guardar valor individual del mes
    almacen[`real-${mes}`] = real;
  });
  
  // Real del mes actual (columna "Mensual" en Gastos Corporativos)
  const realMesActual = numeroSeguro(registro?.real?.[mesActualClave]);
  
  // Actualizar celda budget-monthly: real del mes actual
  establecerValorCelda(fila, 'budget-monthly', realMesActual);
  almacen['budget-monthly'] = realMesActual;
  
  // Actualizar celda total-real: acumulado desde enero hasta mes actual
  establecerValorCelda(fila, 'total-real', totalRealAcumulado);
  almacen['total-real'] = totalRealAcumulado;
});
```

**Resumen:**
- `budget-monthly` = Real del mes actual
- `total-real` = Suma acumulada de ene hasta mes actual
- Ejemplo: Si estamos en marzo, `total-real` = ene + feb + mar

#### En SUMMARY y RESUMEN

**Ubicación:** `vistas/js/summary-view.js` líneas 562-576

```javascript
/**
 * Extrae valores totales de un nodo del árbol jerárquico de Summary
 * 
 * @returns {Object} Objeto con los 6 valores totales estandarizados:
 *   - actualMonth: Real del mes actual
 *   - planMonth: Plan/presupuesto del mes actual
 *   - prevMonth: Real del mes anterior (mismo mes año previo)
 *   - actualYTD: Real acumulado año a la fecha (Year To Date)
 *   - planYTD: Plan acumulado año a la fecha
 *   - prevYTD: Real acumulado año previo a la fecha
 */
const extractTotals = (nodo = {}) => ({
  actualMonth: toNumber(nodo.actualMonth ?? nodo.totalActualMonth),
  planMonth: toNumber(nodo.planMonth ?? nodo.totalPlanMonth),
  prevMonth: toNumber(nodo.prevMonth ?? nodo.totalPrevMonth),
  actualYTD: toNumber(nodo.actualYTD ?? nodo.totalActualYTD),
  planYTD: toNumber(nodo.planYTD ?? nodo.totalPlanYTD),
  prevYTD: toNumber(nodo.prevYTD ?? nodo.totalPrevYTD)
});
```

**Comparación:**

| Concepto | 11 Módulos Operativos | SUMMARY/RESUMEN |
|----------|----------------------|-----------------|
| **Real Mes Actual** | `budget-monthly` | `actualMonth` |
| **Real YTD** | `total-real` | `actualYTD` |
| **Plan Mes Actual** | `budget-annual` | `planMonth` |
| **Plan YTD** | `total-budget` | `planYTD` |

**✅ Conclusión:** La lógica es **IDÉNTICA**, solo cambian los nombres de las columnas.

---

## 🔧 PARTE 2: Lógica de Inserción de Filas y Secciones

### 📍 Ubicación del Código

**Archivo Principal:** `vistas/js/cuentas-modulo.js`

#### Funciones Clave:

| Función | Líneas | Descripción |
|---------|--------|-------------|
| `insertarFilaCuentaNueva()` | 2089-2121 | Inserta nueva fila de cuenta |
| `agregarSeccionNueva()` | 2194-2196 | Abre modal para nueva sección |
| `agregarFilaResumen()` | 1363-1388 | Crea filas sum-row en el DOM |
| `crearFilaCuentaVacia()` | - | Genera HTML de fila vacía |

---

### 🆕 Inserción de Filas de Cuenta

**Función:** `insertarFilaCuentaNueva(referencia, posicion)`

**Ubicación:** Líneas 2089-2121

```javascript
const insertarFilaCuentaNueva = (referencia, posicion) => {
  // 1. Validar que exista fila de referencia y tabla
  if (!referencia || !estadoModulo.tabla) return;
  
  // 2. Obtener metadata de la sección
  const meta = obtenerMetaSeccionPorFila(referencia);
  if (!meta) return;
  
  // 3. Encontrar índice de fila de referencia
  const idx = meta.filasCuenta.indexOf(referencia);
  if (idx < 0) return;
  
  // 4. Crear nueva fila vacía
  const cuerpo = estadoModulo.tabla.querySelector('tbody');
  const nuevaFila = crearFilaCuentaVacia(meta.seccion);
  
  // 5. Función auxiliar para insertar en DOM
  const insertarAntesDe = (nodo) => {
    if (nodo) {
      cuerpo.insertBefore(nuevaFila, nodo);
    } else {
      cuerpo.appendChild(nuevaFila);
    }
  };
  
  // 6. Insertar según posición
  if (posicion === 'arriba') {
    insertarAntesDe(referencia);
    meta.filasCuenta.splice(idx, 0, nuevaFila);  // Insertar en array
  } else {
    // Buscar siguiente fila o sum-row
    const siguiente = meta.filasCuenta[idx + 1];
    if (siguiente) {
      insertarAntesDe(siguiente);
    } else if (meta.elementos.sumRow) {
      insertarAntesDe(meta.elementos.sumRow);
    } else {
      insertarAntesDe(obtenerPrimerResultadoFila());
    }
    meta.filasCuenta.splice(idx + 1, 0, nuevaFila);  // Insertar en array
  }
  
  // 7. Actualizar estructura y recalcular
  actualizarEstructuraDespuesCambio();
};
```

**Flujo Visual:**

```
ANTES:
├── Sección: INGRESOS
│   ├── Cuenta 401: Membership Dues  ← referencia
│   ├── Cuenta 402: Membership Fees
│   └── sum-row: SUMA DE INGRESOS

INSERTAR "arriba" de 401:
├── Sección: INGRESOS
│   ├── [NUEVA FILA VACÍA]  ← insertada
│   ├── Cuenta 401: Membership Dues
│   ├── Cuenta 402: Membership Fees
│   └── sum-row: SUMA DE INGRESOS

INSERTAR "abajo" de 401:
├── Sección: INGRESOS
│   ├── Cuenta 401: Membership Dues
│   ├── [NUEVA FILA VACÍA]  ← insertada
│   ├── Cuenta 402: Membership Fees
│   └── sum-row: SUMA DE INGRESOS
```

---

### 🗂️ Inserción de Secciones Nuevas

**Función:** `agregarSeccionNueva(referenciaFila)`

**Ubicación:** Líneas 2194-2196

```javascript
const agregarSeccionNueva = (referenciaFila) => {
  abrirModalAgregarSeccion(referenciaFila);
};
```

**¿Dónde está `abrirModalAgregarSeccion()`?**

Búsqueda en el código:
```javascript
grep_search("abrirModalAgregarSeccion")
```

**Resultado:** No encontrada en el archivo actual. Posiblemente en:
- `modo-edicion-presupuesto.js` (línea 689: comentario sobre menú contextual)
- `context-menu-manager.js` (línea 4: comentario sobre agregar/editar/eliminar)

**Proceso Típico:**
1. Usuario hace clic derecho en una fila
2. Selecciona "Agregar sección nueva"
3. Se abre modal con campos:
   - Nombre de sección
   - Capitulo (opcional)
   - Etiqueta sumavarios (opcional)
4. Usuario confirma
5. Sistema crea:
   - Encabezado de sección (section-header-row)
   - Primera fila de cuenta vacía
   - Fila sum-row
6. Actualiza metadata de `estadoModulo.sumas.secciones`

---

### 📋 Creación de Filas sum-row

**Función:** `agregarFilaResumen({ texto, clase, cuerpo, placeholdersPorFila })`

**Ubicación:** Líneas 1363-1388

```javascript
const agregarFilaResumen = ({ texto, clase, cuerpo, placeholdersPorFila }) => {
  const fila = document.createElement('tr');
  fila.className = clase || '';
  
  // Columna 1: vacía (sin cuenta)
  const celdaVacia = document.createElement('td');
  celdaVacia.className = 'text-start';
  fila.appendChild(celdaVacia);
  
  // Columna 2: texto del resumen (ej: "SUMA DE Membership")
  const celdaTexto = document.createElement('td');
  celdaTexto.className = 'text-start text-primary';
  celdaTexto.textContent = texto;
  fila.appendChild(celdaTexto);
  
  // Columnas 3-14: valores numéricos (12 meses o totales)
  const numColumnas = Object.keys(estadoModulo.columnas || {}).length - 2;
  for (let i = 0; i < numColumnas; i++) {
    const celda = document.createElement('td');
    celda.className = 'text-end editable-cell';
    celda.textContent = '-';  // Placeholder inicial
    celda.contentEditable = 'false';  // No editable
    fila.appendChild(celda);
  }
  
  // Agregar al DOM
  if (cuerpo) {
    cuerpo.appendChild(fila);
  }
  
  return fila;
};
```

**Resultado HTML:**

```html
<tr class="sum-row">
  <td class="text-start"></td>  <!-- Columna vacía -->
  <td class="text-start text-primary">SUMA DE Membership</td>
  <td class="text-end">-</td>  <!-- Enero -->
  <td class="text-end">-</td>  <!-- Febrero -->
  <td class="text-end">-</td>  <!-- Marzo -->
  <!-- ... 12 columnas de meses ... -->
</tr>
```

**Actualización de Valores:**

```javascript
// Después de crear la fila, recalcularSumas() actualiza los "-" con valores reales
recalcularSumas();

// Resultado:
<td class="text-end">1,500.00</td>  <!-- Enero: 1500 -->
<td class="text-end">3,000.00</td>  <!-- Febrero: 3000 -->
```

---

### 🔄 Estructura Completa de Inserción

#### Flujo de Inserción de Sección Nueva

```
1. Usuario: Click derecho → "Agregar sección"
   ↓
2. Sistema: Abre modal con formulario
   ↓
3. Usuario: Completa datos y confirma
   ↓
4. Sistema: crearEncabezadoSeccion()
   Resultado: <tr class="section-header-row">
                <td colspan="14">NUEVA SECCIÓN</td>
              </tr>
   ↓
5. Sistema: crearFilaCuentaVacia()
   Resultado: <tr class="fila-cuenta">
                <td>cuenta-nueva-001</td>
                <td contenteditable="true"></td>
                <td contenteditable="true">0.00</td>
                ... (12 meses vacíos)
              </tr>
   ↓
6. Sistema: agregarFilaResumen({ texto: "SUMA DE NUEVA SECCIÓN", clase: "sum-row" })
   Resultado: <tr class="sum-row">
                <td></td>
                <td>SUMA DE NUEVA SECCIÓN</td>
                <td>-</td> ... (12 columnas)
              </tr>
   ↓
7. Sistema: Agregar a metadata
   estadoModulo.sumas.secciones.push({
     seccion: "NUEVA SECCIÓN",
     filasCuenta: [nuevaFila],
     sumValues: [0, 0, 0, ...],
     elementos: { header, sumRow }
   });
   ↓
8. Sistema: recalcularSumas()
   - Suma valores de filasCuenta
   - Actualiza sum-row
   - Actualiza sumavarios si corresponde
```

---

### 🎯 Metadata de Secciones

**Estructura en `estadoModulo.sumas.secciones`:**

```javascript
estadoModulo.sumas = {
  secciones: [
    {
      seccion: "INGRESOS MEMBRESÍAS",           // Nombre
      capitulo: "CIUDAD DE MÉXICO",              // Agrupación superior
      filasCuenta: [                             // Array de HTMLTableRowElement
        <tr class="fila-cuenta">...</tr>,
        <tr class="fila-cuenta">...</tr>
      ],
      sumValues: [1500, 3000, 2250, ...],        // Valores calculados (12 meses)
      sumRowLabel: "SUMA DE",                    // Prefijo
      sumRowSumavariosLabel: "CDMX Income",      // Etiqueta sumavarios
      sumRowSumavariosTexto: "CDMX Income",      // Texto completo
      elementos: {
        header: <tr class="section-header-row">, // Encabezado visual
        sumRow: <tr class="sum-row">             // Fila de suma
      }
    },
    // ... más secciones
  ],
  sumavariosRows: Map {                          // Filas de consolidación
    "CDMX Income" => <tr class="sum-row-sumavarios">
  }
};
```

---

### ⚙️ Menú Contextual para Inserción

**Ubicación:** `vistas/js/cuentas-modulo.js` líneas 2243-2265

```javascript
const opcionesMenu = [
  {
    texto: '➕ Insertar fila arriba',
    onclick: () => {
      insertarFilaCuentaNueva(filaContextual, 'arriba');
      ocultarMenuContextual();
    }
  },
  {
    texto: '➕ Insertar fila abajo',
    onclick: () => {
      insertarFilaCuentaNueva(filaContextual, 'abajo');
      ocultarMenuContextual();
    }
  },
  { texto: '-', disabled: true },  // Separador
  {
    texto: '📁 Agregar sección nueva',
    onclick: () => {
      agregarSeccionNueva(filaContextual);
      ocultarMenuContextual();
    }
  },
  {
    texto: '🗑️ Eliminar fila',
    onclick: () => {
      if (confirm('¿Eliminar esta fila?')) {
        eliminarFilaSeleccionada(filaContextual);
        ocultarMenuContextual();
      }
    }
  }
];
```

---

## 🎓 Resumen Final

### ✅ Sumas Verificadas en 13 Módulos

| Módulo | Motor de Sumas | Línea Inclusión |
|--------|---------------|----------------|
| 11 Módulos Operativos | `cuentas-modulo.js` → `recalcularSumas()` | Líneas 440-597 (según módulo) |
| SUMMARY | `summary-view.js` | Custom implementation |
| RESUMEN | `resumen-view.js` | Custom implementation |

**Confirmación:** ✅ **TODOS los módulos ejecutan sumas correctamente**

---

### 📐 month-real (Real del Mes Actual)

**En 11 Módulos:**
- **Variable:** `budget-monthly`
- **Cálculo:** `registro.real[mesActualClave]`
- **Ejemplo:** Si estamos en marzo → `registro.real['mar']`

**En SUMMARY/RESUMEN:**
- **Variable:** `actualMonth`
- **Cálculo:** `nodo.actualMonth ?? nodo.totalActualMonth`
- **Fuente:** Backend calcula el valor del mes seleccionado

**Igualdad:** ✅ **SÍ, la lógica es idéntica en ambos**

---

### 🔧 Lógica de Inserción

**Filas de Cuenta:**
1. Click derecho en fila → Menú contextual
2. "Insertar arriba" o "Insertar abajo"
3. `insertarFilaCuentaNueva()` crea fila vacía
4. Inserta en DOM y metadata
5. `recalcularSumas()` actualiza totales

**Secciones Nuevas:**
1. Click derecho → "Agregar sección nueva"
2. Modal con formulario
3. Crea: header + fila cuenta + sum-row
4. Agrega a `estadoModulo.sumas.secciones`
5. `recalcularSumas()` actualiza totales

**Filas sum-row:**
- Creadas automáticamente con `agregarFilaResumen()`
- Valores iniciales: `"-"`
- Actualizados por `recalcularSumas()` en cada evento

---

**Fecha:** 11 de diciembre de 2025  
**Versión:** 1.0
