# 📊 Flujo de Datos: RESUMEN.html

## 📋 Tabla de Contenidos

1. [Introducción](#introducción)
2. [Flujo sin Comparación](#flujo-sin-comparación)
3. [Flujo con Comparación](#flujo-con-comparación)
4. [Ejemplo Práctico: CDMX 2026](#ejemplo-práctico-cdmx-2026)
5. [Arquitectura Técnica](#arquitectura-técnica)
6. [Diferencias con SUMMARY](#diferencias-con-summary)

---

## Introducción

La vista **RESUMEN.html** proporciona un reporte financiero consolidado por capítulo (CIUDAD DE MÉXICO, GUADALAJARA, NORESTE, NOROESTE), mostrando:

- **Estructura jerárquica**: Secciones → Cuentas → Totales
- **Datos mensuales**: Real, Presupuesto, Comparativo
- **Datos acumulados (YTD)**: Real Acum., Ppto. Acum., Real Acum. AA
- **Variaciones porcentuales**: B/(W)% vs. presupuesto y vs. comparativo
- **Modo de comparación opcional**: Permite mostrar datos de otra empresa en las columnas comparativas

---

## Flujo sin Comparación

### 1. Solicitud Frontend (resumen-view.js)

**URL del Endpoint**:
```
GET /api/reportes/resumen?empresaId={id}&anio={año}&mes={mes}&capitulo={capitulo}
```

**Ejemplo para CDMX 2026, Enero**:
```
GET /api/reportes/resumen?empresaId=empresa1&anio=2026&mes=1&capitulo=CIUDAD%20DE%20MEXICO
```

**Código Frontend** ([vistas/js/resumen-view.js](vistas/js/resumen-view.js#L4533)):
```javascript
const consultarResumen = async ({ empresaId, anio, mes, capitulo }) => {
  const params = new URLSearchParams({
    empresaId: empresaId,
    anio: Number(anio),
  });
  params.set("mes", String(mes));
  if (capitulo) params.set("capitulo", capitulo);

  const respuesta = await fetch(`${API_ENDPOINT}?${params.toString()}`, {
    headers: Sesion.headersAutenticacion(),
  });
  
  return await respuesta.json();
};
```

---

### 2. Procesamiento Backend (reportes.js → planeacionReportesEngine.js)

#### 2.1. Entrada al Endpoint ([src/routes/reportes.js](src/routes/reportes.js#L95))

```javascript
router.get('/resumen', async (req, res) => {
  const { empresaId, anio, mes, capitulo } = req.query;
  
  // Llama al motor unificado de reportes
  const data = await generarReporte(
    'RESUMEN',           // Tipo de reporte
    empresaId,           // empresa1, empresa2, etc.
    normalizarAnio(anio), // 2026
    normalizarMes(mes),   // 1 (Enero)
    capitulo             // "CIUDAD DE MEXICO"
  );
  
  res.json(data);
});
```

#### 2.2. Motor de Reportes ([src/services/reportes/planeacionReportesEngine.js](src/services/reportes/planeacionReportesEngine.js#L1779))

```javascript
async function generarReporte(tipoReporte, empresaId, anio, mesSeleccionado, capituloSeleccionado) {
  // 1. Cargar definiciones desde SQLite (layouts y operaciones)
  const modulo = 'RESUMEN';
  const definiciones = cargarDefiniciones(modulo, empresaId, anio);
  
  // 2. Filtrar cuentas por capítulo
  const lista = definiciones['CIUDAD DE MEXICO'] || [];
  const cuentas = lista.map(item => item.CUENTA);
  
  // 3. Obtener datos de planeación (SALDOS + PRESUP)
  const planeacionData = await obtenerDatosPlaneacionResumen({
    empresaId,  // empresa1
    anio,       // 2026
    mes: 1,     // Enero
    cuentas     // ['401-000-000-00', '402-000-000-00', ...]
  });
  
  // 4. Construir estructura jerárquica con totales
  const { principals, layout } = construirReporteResumen(
    lista,
    configAgrupacion,
    'CIUDAD DE MEXICO',
    planeacionData
  );
  
  // 5. Retornar JSON estructurado
  return {
    empresaId: 'empresa1',
    reportKey: 'RESUMEN',
    anio: 2026,
    resumen: [{
      label: 'CIUDAD DE MEXICO',
      children: principals,  // Secciones principales con children
      layout                 // Layout lineal para renderizado
    }],
    capituloSeleccionado: 'CIUDAD DE MEXICO',
    capitulosDisponibles: ['CIUDAD DE MEXICO', 'GUADALAJARA', ...]
  };
}
```

---

### 3. Fuentes de Datos Backend

#### 3.1. **Layouts (SQLite)** - Estructura y Orden

**Tabla**: `layouts`  
**Función**: [layoutService.obtenerLayout()](src/services/layoutService.js)

```sql
SELECT * FROM layouts
WHERE empresa_id = 'empresa1'
  AND modulo = 'RESUMEN'
  AND anio = 2026
  AND capitulo = 'CIUDAD DE MEXICO'
```

**Contiene**:
- Lista de cuentas ordenadas: `CUENTA`, `NOMBRE`, `orden_presentacion`
- Secciones principales: `SECCIÓN Principal`, `SECCION Secundaria`
- Operaciones especiales: `SUMA DE VARIAS SECCIONES` (Operating Results, Net Results, etc.)

**Ejemplo JSON del layout**:
```json
{
  "CIUDAD DE MEXICO": [
    {
      "CUENTA": "401-000-000-00",
      "NOMBRE": "Cuotas Netas",
      "SECCIÓN Principal": "Membership (INCOME)",
      "SECCION Secundaria": "Membership",
      "orden": 1,
      "orden_presentacion": 1
    },
    {
      "CUENTA": "402-000-000-00",
      "NOMBRE": "Ingresos socios nuevos",
      "SECCIÓN Principal": "Membership (INCOME)",
      "SECCION Secundaria": "Membership",
      "orden": 2,
      "orden_presentacion": 2
    }
  ],
  "SUMA DE VARIAS SECCIONES": [
    {
      "HOJA": "RESUMEN",
      "nombre": "OPERATING RESULTS MEXICO",
      "tipo": "sum-row-operativo",
      "formula_terms": [
        {
          "principal": "CDMX INCOME",
          "factor": 1
        },
        {
          "principal": "CDMX EXPENSE",
          "factor": -1
        }
      ]
    }
  ]
}
```

#### 3.2. **Cuentas Maestras (Excel)** - Definición de Secciones

**Archivo**: `info IMPORTANTE/CUENTAS SUMMARY y RESUMEN.xlsx`  
**Hoja**: `RESUMEN` o `SUMMARY`

Contiene la definición de qué cuentas pertenecen a cada sección:
- **CUENTA**: Código de cuenta (401-000-000-00)
- **NOMBRE**: Descripción de la cuenta
- **CAPITULO**: CIUDAD DE MEXICO, GUADALAJARA, etc.
- **SECCIÓN Principal**: Membership (INCOME), Events (INCOME), etc.
- **SECCION Secundaria**: Membership, Events, etc.

Este archivo se lee al momento de **crear o actualizar layouts** en SQLite, pero **no se consulta en tiempo de ejecución** del reporte.

#### 3.3. **Saldos Reales (Firebird - SALDOSYY)**

**Tabla**: `SALDOS26` (para 2026), `SALDOS25` (para 2025), etc.  
**Función**: [obtenerDatosPlaneacionResumen()](src/services/planeacionCuentasService.js)

```sql
SELECT 
  CUENTA,
  SALDOS01 as ene,  -- Saldo enero
  SALDOS02 as feb,  -- Saldo febrero
  -- ... hasta diciembre
  SALDOS12 as dic
FROM SALDOS26
WHERE CUENTA IN ('401000000000000000001', '402000000000000000001', ...)
```

**Procesamiento**:
- Se normaliza cada cuenta a formato canónico de 21 dígitos
- Se acumula el saldo YTD (Year-To-Date) sumando de enero al mes consultado
- Ejemplo para Enero 2026:
  - `actualMonth` = SALDOS26.SALDOS01
  - `actualYTD` = SALDOS26.SALDOS01
- Ejemplo para Marzo 2026:
  - `actualMonth` = SALDOS26.SALDOS03
  - `actualYTD` = SALDOS26.SALDOS01 + SALDOS26.SALDOS02 + SALDOS26.SALDOS03

#### 3.4. **Presupuestos (Firebird - PRESUPYY)**

**Tabla**: `PRESUP26` (para 2026)

```sql
SELECT
  CUENTA,
  PRESUP01 as ene,  -- Presupuesto enero
  PRESUP02 as feb,  -- Presupuesto febrero
  -- ... hasta diciembre
  PRESUP12 as dic
FROM PRESUP26
WHERE CUENTA IN ('401000000000000000001', '402000000000000000001', ...)
```

**Procesamiento**:
- Similar a saldos, se acumula YTD
- Ejemplo para Enero 2026:
  - `planMonth` = PRESUP26.PRESUP01
  - `planYTD` = PRESUP26.PRESUP01
- Ejemplo para Marzo 2026:
  - `planMonth` = PRESUP26.PRESUP03
  - `planYTD` = PRESUP26.PRESUP01 + PRESUP26.PRESUP02 + PRESUP26.PRESUP03

#### 3.5. **Comparativo (Mes Anterior)**

**Sin modo comparación activo**, las columnas `prev` muestran:
- **prevMonth**: Mes anterior del MISMO año
  - Enero 2026 → No hay mes anterior (prevMonth = 0)
  - Febrero 2026 → prevMonth = SALDOS26.SALDOS01
  - Marzo 2026 → prevMonth = SALDOS26.SALDOS02
- **prevYTD**: Acumulado del mes anterior
  - Enero 2026 → prevYTD = 0
  - Febrero 2026 → prevYTD = SALDOS26.SALDOS01
  - Marzo 2026 → prevYTD = SALDOS26.SALDOS01 + SALDOS26.SALDOS02

---

### 4. Estructura de Respuesta JSON

```json
{
  "empresaId": "empresa1",
  "reportKey": "RESUMEN",
  "anio": 2026,
  "capituloSeleccionado": "CIUDAD DE MEXICO",
  "capitulosDisponibles": [
    { "clave": "CIUDAD_DE_MEXICO", "etiqueta": "CIUDAD DE MEXICO" },
    { "clave": "GUADALAJARA", "etiqueta": "GUADALAJARA" },
    { "clave": "NORESTE", "etiqueta": "NORESTE" },
    { "clave": "NOROESTE", "etiqueta": "NOROESTE" }
  ],
  "resumen": [
    {
      "label": "CIUDAD DE MEXICO",
      "children": [
        {
          "label": "Membership (INCOME)",
          "sign": 1,
          "actualMonth": 150000,
          "planMonth": 145000,
          "prevMonth": 0,
          "actualYTD": 150000,
          "planYTD": 145000,
          "prevYTD": 0,
          "children": [
            {
              "label": "Membership",
              "totalActualMonth": 150000,
              "totalPlanMonth": 145000,
              "totalPrevMonth": 0,
              "totalActualYTD": 150000,
              "totalPlanYTD": 145000,
              "totalPrevYTD": 0,
              "cuentas": [
                {
                  "cuenta": "401-000-000-00",
                  "cuentaCanonica": "401000000000000000001",
                  "descripcion": "Cuotas Netas",
                  "actualMonth": 100000,
                  "planMonth": 95000,
                  "prevMonth": 0,
                  "actualYTD": 100000,
                  "planYTD": 95000,
                  "prevYTD": 0
                },
                {
                  "cuenta": "402-000-000-00",
                  "cuentaCanonica": "402000000000000000001",
                  "descripcion": "Ingresos socios nuevos",
                  "actualMonth": 50000,
                  "planMonth": 50000,
                  "prevMonth": 0,
                  "actualYTD": 50000,
                  "planYTD": 50000,
                  "prevYTD": 0
                }
              ]
            }
          ]
        }
      ],
      "layout": [
        {
          "type": "principal",
          "label": "Membership (INCOME)",
          "totals": {
            "actualMonth": 150000,
            "planMonth": 145000,
            "prevMonth": 0,
            "actualYTD": 150000,
            "planYTD": 145000,
            "prevYTD": 0
          }
        },
        {
          "type": "secundaria",
          "label": "Membership",
          "totals": {
            "actualMonth": 150000,
            "planMonth": 145000,
            "prevMonth": 0,
            "actualYTD": 150000,
            "planYTD": 145000,
            "prevYTD": 0
          }
        },
        {
          "type": "cuenta",
          "cuenta": "401-000-000-00",
          "label": "Cuotas Netas",
          "totals": {
            "actualMonth": 100000,
            "planMonth": 95000,
            "prevMonth": 0,
            "actualYTD": 100000,
            "planYTD": 95000,
            "prevYTD": 0
          }
        },
        {
          "type": "cuenta",
          "cuenta": "402-000-000-00",
          "label": "Ingresos socios nuevos",
          "totals": {
            "actualMonth": 50000,
            "planMonth": 50000,
            "prevMonth": 0,
            "actualYTD": 50000,
            "planYTD": 50000,
            "prevYTD": 0
          }
        }
      ]
    }
  ]
}
```

---

### 5. Renderizado Frontend

**Función**: [renderResumen()](vistas/js/resumen-view.js)

El frontend recorre el array `layout` (que ya está pre-ordenado por el backend) y crea filas HTML:

1. **Fila Principal** (`type: 'principal'`):
   - Clase CSS: `section-header-row table-info fw-bold`
   - Muestra: Etiqueta + Totales calculados

2. **Fila Subsección** (`type: 'secundaria'`):
   - Clase CSS: `subsection-row bg-light fw-semibold collapsible-section`
   - Muestra: Etiqueta + Totales + Ícono de colapso

3. **Fila Cuenta** (`type: 'cuenta'`):
   - Clase CSS: `account-row section-child`
   - Muestra: Cuenta + Descripción + Valores individuales

4. **Filas Calculadas** (`type: 'group'`, `'result'`, `'net'`, `'final'`):
   - Operating Results, Net Results, Consolidated, etc.
   - Aplicación de jerarquías visuales mediante clases CSS

**Columnas renderizadas** (12 en total):

| Num | Columna | Origen | Ejemplo Valor |
|-----|---------|--------|---------------|
| 1 | Cuenta | layout.cuenta | 401-000-000-00 |
| 2 | Real | totals.actualMonth | $100,000.00 |
| 3 | Ppto. | totals.planMonth | $95,000.00 |
| 4 | Real mes AA | totals.prevMonth | $0.00 |
| 5 | B/(W)% vs Ppto | (Real / Ppto - 1) * 100 | 5.26% |
| 6 | B/(W)% vs Real AA | (Real / Real AA - 1) * 100 | 0.00% |
| 7 | Descripción | layout.label o NOMBRE | Cuotas Netas |
| 8 | Real Acum. | totals.actualYTD | $100,000.00 |
| 9 | Ppto. Acum. | totals.planYTD | $95,000.00 |
| 10 | Real Acum. AA | totals.prevYTD | $0.00 |
| 11 | B/(W)% vs Ppto Acum | (Real Acum / Ppto Acum - 1) * 100 | 5.26% |
| 12 | B/(W)% vs Real Acum AA | (Real Acum / Real AA - 1) * 100 | 0.00% |

---

## Flujo con Comparación

### 1. Activación del Modo Comparación

**UI**: Toggle "Comparar con otra empresa" ([vistas/RESUMEN.html](vistas/RESUMEN.html))

```html
<div class="form-check form-switch">
  <input 
    class="form-check-input" 
    type="checkbox" 
    id="resumenEmpresaComparativaToggle"
    checked
  >
  <label class="form-check-label" for="resumenEmpresaComparativaToggle">
    Comparar con <strong id="resumenEmpresaComparativaLabel">Empresa 9</strong>
  </label>
</div>
```

**Código** ([vistas/js/resumen-view.js](vistas/js/resumen-view.js)):

```javascript
const COMPARATIVA_POR_EMPRESA = {
  empresa1: "empresa9",   // CDMX → Empresa comparativa 9
  empresa2: "empresa10",  // GDL → Empresa comparativa 10
  empresa3: "empresa11",  // NE → Empresa comparativa 11
  empresa4: "empresa12",  // NO → Empresa comparativa 12
};

const COMPARATIVA_POR_CAPITULO = {
  "CIUDAD DE MEXICO": "empresa9",
  GUADALAJARA: "empresa10",
  NORESTE: "empresa11",
  NOROESTE: "empresa12",
};

const obtenerEmpresaComparativaId = (empresaId) => {
  const clave = (empresaId || "").toString().trim().toLowerCase();
  if (COMPARATIVA_POR_EMPRESA[clave]) {
    return COMPARATIVA_POR_EMPRESA[clave];
  }
  
  const capitulo = obtenerCapituloEmpresa(empresaId);
  const capituloKey = normalizarEtiquetaComparativa(capitulo);
  return COMPARATIVA_POR_CAPITULO[capituloKey] || null;
};
```

---

### 2. Consulta Doble al Backend

Cuando el modo comparación está activo, se hacen **dos consultas paralelas**:

```javascript
const fetchResumen = async (empresaId, anio, mes) => {
  // 1. Consulta principal (empresa base)
  const capitulo = obtenerCapituloEmpresa(empresaId);
  const dataBase = await consultarResumen({
    empresaId,  // empresa1
    anio,       // 2026
    mes,        // 1
    capitulo    // CIUDAD DE MEXICO
  });
  
  // 2. Si modo comparación activo, segunda consulta
  const comparativaActiva = comparativaToggle?.checked;
  const comparativaId = obtenerEmpresaComparativaId(empresaId);
  
  if (comparativaActiva && comparativaId) {
    try {
      const dataComp = await consultarResumen({
        empresaId: comparativaId,  // empresa9
        anio,
        mes,
        capitulo
      });
      
      // 3. Mezclar datos comparativos en las columnas "prev"
      aplicarComparativoResumen(
        dataBase.resumen,
        dataComp.resumen
      );
      
    } catch (err) {
      // Si falla comparativo, continuar con datos base
      registrarErrorComparativa(empresaId, err.message);
    }
  }
  
  // 4. Renderizar con datos mezclados (si aplica)
  renderResumen(dataBase.resumen, mes);
};
```

---

### 3. Mezcla de Datos Comparativos

**Función clave**: [aplicarComparativoResumen()](vistas/js/resumen-view.js)

```javascript
const aplicarComparativoResumen = (resumenBase = [], resumenComp = []) => {
  // Indexar resumen comparativo por capítulo
  const mapaComparativo = new Map();
  resumenComp.forEach((capitulo) => {
    const key = normalizarEtiquetaComparativa(capitulo.label);
    if (key) {
      mapaComparativo.set(key, capitulo);
    }
  });

  // Aplicar valores comparativos a cada capítulo
  resumenBase.forEach((capitulo) => {
    const key = normalizarEtiquetaComparativa(capitulo.label);
    const comparativo = mapaComparativo.get(key) || resumenComp[0];
    
    if (comparativo) {
      aplicarComparativoCapitulo(capitulo, comparativo);
    }
  });
};
```

**Función**: [aplicarComparativoCapitulo()](vistas/js/resumen-view.js)

```javascript
const aplicarComparativoCapitulo = (capituloBase = {}, capituloComp = {}) => {
  // Indexar cuentas comparativas
  const { cuentas, secciones, principales } = indexarComparativoCapitulo(capituloComp);

  // Iterar children (principales/secciones/cuentas) de capituloBase
  (capituloBase.children || []).forEach((principal) => {
    // Buscar principal comparativo por etiqueta
    const principalKey = normalizarEtiquetaComparativa(principal.label);
    const compPrincipal = principales.get(principalKey);
    
    if (compPrincipal) {
      // Llenar SOLO columnas prev con datos del comparativo
      principal.prevMonth = compPrincipal.actualMonth;
      principal.prevYTD = compPrincipal.actualYTD;
    }
    
    // Iterar secciones
    (principal.children || []).forEach((seccion) => {
      const seccionKey = normalizarEtiquetaComparativa(seccion.label);
      const compSeccion = secciones.get(seccionKey);
      
      if (compSeccion) {
        seccion.totalPrevMonth = compSeccion.totalActualMonth;
        seccion.totalPrevYTD = compSeccion.totalActualYTD;
      }
      
      // Iterar cuentas
      (seccion.cuentas || []).forEach((cta) => {
        const cuentaKey = cta.cuentaCanonica || cta.cuenta;
        const compCuenta = cuentas.get(cuentaKey);
        
        if (compCuenta) {
          // ⭐ CRÍTICO: Solo reemplazar prev, NO actual ni plan
          cta.prevMonth = compCuenta.actualMonth;
          cta.prevYTD = compCuenta.actualYTD;
        }
      });
    });
  });
  
  // Aplicar también al layout lineal
  if (capituloBase.layout && capituloComp.layout) {
    aplicarComparativoLayout(capituloBase.layout, capituloComp.layout);
  }
};
```

**Función**: [aplicarComparativoLayout()](vistas/js/resumen-view.js)

```javascript
const aplicarComparativoLayout = (layoutBase = [], layoutComp = []) => {
  // Indexar layout comparativo por tipo+etiqueta y cuenta
  const { cuentas, etiquetas } = indexarLayoutComparativo(layoutComp);

  layoutBase.forEach((block) => {
    if (!block || !block.totals) return;
    
    const tipo = (block.type || "").toLowerCase();
    let comparativo = null;

    // Buscar por cuenta (si es tipo "cuenta")
    if (tipo === "cuenta") {
      const claveCuenta = (block.cuenta || "").toString().trim();
      comparativo = claveCuenta ? cuentas.get(claveCuenta) : null;
    }

    // Si no se encontró, buscar por etiqueta
    if (!comparativo) {
      const etiqueta = normalizarEtiquetaComparativa(block.label);
      comparativo = etiqueta ? etiquetas.get(`${tipo}|${etiqueta}`) : null;
    }

    // Aplicar valores comparativos SOLO a prev
    if (comparativo?.totals) {
      // Priorizar prevMonth/prevYTD del comparativo, sino usar actualMonth/actualYTD
      block.totals.prevMonth = comparativo.totals.prevMonth ?? comparativo.totals.actualMonth;
      block.totals.prevYTD = comparativo.totals.prevYTD ?? comparativo.totals.actualYTD;
    }
  });
};
```

---

### 4. Recalcular Totales Post-Comparación

Después de aplicar datos comparativos a las cuentas, es necesario **recalcular** los totales de secciones y principales usando los nuevos valores prev:

```javascript
const recalcularPrevLayoutDesdeCuentas = (layoutArr = []) => {
  // Recalcular prev en subsecciones sumando cuentas consecutivas
  for (let i = 0; i < layoutArr.length; i += 1) {
    const block = layoutArr[i];
    if (block.type !== 'secundaria') continue;

    let prevMonth = 0;
    let prevYTD = 0;
    let j = i + 1;
    
    // Sumar todas las cuentas siguientes hasta encontrar otro bloque
    while (j < layoutArr.length) {
      const next = layoutArr[j];
      if (next.type === 'cuenta') {
        prevMonth += toNumber(next.totals.prevMonth);
        prevYTD += toNumber(next.totals.prevYTD);
        j += 1;
        continue;
      }
      break;
    }

    block.totals.prevMonth = prevMonth;
    block.totals.prevYTD = prevYTD;
  }

  // Recalcular prev en principales acumulando subsecciones
  let principalActual = null;
  let accPrevMonth = 0;
  let accPrevYTD = 0;

  layoutArr.forEach((block) => {
    if (block.type === 'principal') {
      // Cerrar principal anterior
      if (principalActual) {
        principalActual.totals.prevMonth = accPrevMonth;
        principalActual.totals.prevYTD = accPrevYTD;
      }
      
      // Abrir nuevo principal
      principalActual = block;
      accPrevMonth = 0;
      accPrevYTD = 0;
      return;
    }

    // Acumular subsecciones
    if (principalActual && block.type === 'secundaria') {
      accPrevMonth += toNumber(block.totals.prevMonth);
      accPrevYTD += toNumber(block.totals.prevYTD);
    }
  });

  // Cerrar último principal
  if (principalActual) {
    principalActual.totals.prevMonth = accPrevMonth;
    principalActual.totals.prevYTD = accPrevYTD;
  }
};
```

---

### 5. Resultado Visual en la Tabla

Con el modo comparación **activado**, las columnas cambian así:

#### Sin Comparación (por defecto):
- **Prev Month**: Mes anterior del mismo año (febrero muestra enero)
- **Prev YTD**: Acumulado del mes anterior

#### Con Comparación (toggle activo):
- **Prev Month**: Mes actual de la **empresa comparativa**
- **Prev YTD**: Acumulado del mes actual de la **empresa comparativa**

**Ejemplo visual**:

```
CUENTA         | REAL      | PPTO.     | REAL MES AA     | B/(W)% vs Ppto | ...
---------------|-----------|-----------|-----------------|----------------|
401-000-000-00 | $100,000  | $95,000   | $92,000 ⬅️      | 5.26%          |
               | (empresa1)| (empresa1)| (empresa9)      |                |
               |           |           | ¡Comparativo!   |                |
```

---

## Ejemplo Práctico: CDMX 2026

### Escenario: Enero 2026 - CDMX (empresa1)

#### 1. Consulta Base

```http
GET /api/reportes/resumen?empresaId=empresa1&anio=2026&mes=1&capitulo=CIUDAD%20DE%20MEXICO
```

**Backend ejecuta**:

1. **Layout SQLite**:
```sql
SELECT * FROM layouts
WHERE empresa_id = 'empresa1'
  AND modulo = 'RESUMEN'
  AND anio = 2026
  AND capitulo = 'CIUDAD DE MEXICO'
```

2. **Saldos Firebird** (SALDOS26):
```sql
SELECT 
  CUENTA,
  SALDOS01 as ene
FROM SALDOS26
WHERE CUENTA IN (
  '401000000000000000001',  -- Cuotas Netas
  '402000000000000000001',  -- Ingresos socios nuevos
  '403000000000000000001',  -- Venta de publicaciones
  ...
)
```

3. **Presupuestos Firebird** (PRESUP26):
```sql
SELECT
  CUENTA,
  PRESUP01 as ene
FROM PRESUP26
WHERE CUENTA IN (
  '401000000000000000001',
  '402000000000000000001',
  '403000000000000000001',
  ...
)
```

**Datos obtenidos (ejemplo)**:

| Cuenta | Descripción | actual (SALDOS01) | plan (PRESUP01) | prev |
|--------|-------------|-------------------|-----------------|------|
| 401-000-000-00 | Cuotas Netas | $100,000 | $95,000 | $0 |
| 402-000-000-00 | Ingresos nuevos | $50,000 | $50,000 | $0 |
| 403-000-000-00 | Venta publicaciones | $8,000 | $10,000 | $0 |
| **Total Membership** | | **$158,000** | **$155,000** | **$0** |

> **Nota**: `prev = 0` porque es Enero y no hay mes anterior en 2026.

---

#### 2. Consulta Comparativa (si toggle activo)

```http
GET /api/reportes/resumen?empresaId=empresa9&anio=2026&mes=1&capitulo=CIUDAD%20DE%20MEXICO
```

**Empresa9**: Empresa comparativa para CDMX (puede ser presupuesto alternativo, datos de 2025, o escenario hipotético)

**Datos obtenidos**:

| Cuenta | Descripción | actual (empresa9) |
|--------|-------------|-------------------|
| 401-000-000-00 | Cuotas Netas | $92,000 |
| 402-000-000-00 | Ingresos nuevos | $48,000 |
| 403-000-000-00 | Venta publicaciones | $7,500 |
| **Total Membership** | | **$147,500** |

---

#### 3. Mezcla de Datos

El frontend **reemplaza** los valores `prev` de empresa1 con los valores `actual` de empresa9:

```javascript
// Antes de la mezcla
cuenta401 = {
  cuenta: "401-000-000-00",
  actualMonth: 100000,
  planMonth: 95000,
  prevMonth: 0,        // ⬅️ vacío
  ...
};

// ✅ Después de aplicar comparativo
cuenta401 = {
  cuenta: "401-000-000-00",
  actualMonth: 100000,  // ✅ Sin cambios (empresa1)
  planMonth: 95000,     // ✅ Sin cambios (empresa1)
  prevMonth: 92000,     // ⭐ Reemplazado con empresa9.actualMonth
  ...
};
```

---

#### 4. Tabla Final Renderizada

```
┌─────────────────────┬───────────┬───────────┬─────────────┬────────────────┬────────────────────┬──────────────────┐
│ CUENTA              │ REAL      │ PPTO.     │ REAL MES AA │ B/(W)% vs Ppto │ B/(W)% vs Real AA  │ DESCRIPCIÓN      │
├─────────────────────┼───────────┼───────────┼─────────────┼────────────────┼────────────────────┼──────────────────┤
│ 401-000-000-00      │ $100,000  │ $95,000   │ $92,000     │ 5.26%          │ 8.70%              │ Cuotas Netas     │
│                     │ (empresa1)│ (empresa1)│ (empresa9)  │                │ ((100k/92k)-1)*100 │                  │
├─────────────────────┼───────────┼───────────┼─────────────┼────────────────┼────────────────────┼──────────────────┤
│ 402-000-000-00      │ $50,000   │ $50,000   │ $48,000     │ 0.00%          │ 4.17%              │ Ingresos nuevos  │
├─────────────────────┼───────────┼───────────┼─────────────┼────────────────┼────────────────────┼──────────────────┤
│ 403-000-000-00      │ $8,000    │ $10,000   │ $7,500      │ -20.00%        │ 6.67%              │ Venta publicac.  │
├─────────────────────┼───────────┼───────────┼─────────────┼────────────────┼────────────────────┼──────────────────┤
│ MEMBERSHIP ▶        │ $158,000  │ $155,000  │ $147,500    │ 1.94%          │ 7.12%              │                  │
└─────────────────────┴───────────┴───────────┴─────────────┴────────────────┴────────────────────┴──────────────────┘
```

**Interpretación**:
- **REAL**: Saldo real de empresa1 en Enero 2026
- **PPTO.**: Presupuesto de empresa1 en Enero 2026
- **REAL MES AA**: Saldo real de **empresa9** en Enero 2026 (comparativo)
- **B/(W)% vs Ppto**: Variación de empresa1 vs su propio presupuesto
- **B/(W)% vs Real AA**: Variación de empresa1 vs **empresa9**

---

### Caso Especial: Marzo 2026 con Comparación

```http
GET /api/reportes/resumen?empresaId=empresa1&anio=2026&mes=3&capitulo=CIUDAD%20DE%20MEXICO
```

#### Sin Comparación:
- `prevMonth` = SALDOS26.SALDOS02 (Febrero 2026)
- `prevYTD` = SALDOS26.SALDOS01 + SALDOS26.SALDOS02

#### Con Comparación (empresa9):
- `prevMonth` = Marzo 2026 de empresa9
- `prevYTD` = Acumulado Enero-Marzo 2026 de empresa9

```
CUENTA         | REAL (Mar) | PPTO. (Mar) | REAL MES AA        | Desc.
---------------|------------|-------------|--------------------|-------------------
401-000-000-00 | $105,000   | $95,000     | $94,000            | Cuotas Netas
               | (empresa1  | (empresa1   | (empresa9 MARZO)   |
               |  Marzo)    |  Marzo)     | ⬅️ Comparativo     |
```

---

## Arquitectura Técnica

### Diagrama de Flujo

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Frontend (resumen-view.js)                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ 1. fetchResumen()
                                    │    GET /api/reportes/resumen
                                    │    ?empresaId=empresa1&anio=2026&mes=1
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Backend (reportes.js)                              │
│                                                                             │
│  router.get('/resumen', async (req, res) => {                              │
│    const data = await generarReporte('RESUMEN', ...);                      │
│    res.json(data);                                                          │
│  });                                                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ 2. generarReporte()
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   planeacionReportesEngine.js                               │
│                                                                             │
│  3. cargarDefiniciones(modulo, empresaId, anio)                            │
│     └── layoutService.obtenerLayout()                                      │
│         └── SQLite: SELECT * FROM layouts                                  │
│             WHERE modulo='RESUMEN' AND anio=2026                            │
│                                                                             │
│  4. obtenerDatosPlaneacionResumen({ empresaId, anio, mes, cuentas })      │
│     └── planeacionCuentasService.js                                        │
│         ├── Firebird: SELECT * FROM SALDOS26 WHERE CUENTA IN (...)        │
│         └── Firebird: SELECT * FROM PRESUP26 WHERE CUENTA IN (...)        │
│                                                                             │
│  5. construirReporteResumen(lista, config, capitulo, planeacionData)      │
│     └── Construye jerarquía: children + layout                             │
│     └── Calcula totales y operaciones especiales                           │
│                                                                             │
│  6. return { empresaId, reportKey, anio, resumen, capitulos }             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ 7. JSON Response
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Frontend (resumen-view.js)                            │
│                                                                             │
│  8. Si comparación activa:                                                  │
│     └── consultarResumen({ empresaId: empresa9, ... })                     │
│         └── GET /api/reportes/resumen?empresaId=empresa9                   │
│                                                                             │
│  9. aplicarComparativoResumen(resumenBase, resumenComp)                    │
│     └── Reemplaza prev con actual de empresa9                              │
│     └── recalcularPrevLayoutDesdeCuentas()                                 │
│                                                                             │
│  10. renderResumen(resumen, mes)                                            │
│      └── Genera filas HTML (<tr>) con 12 columnas                          │
│      └── Calcula variaciones porcentuales                                  │
│      └── Asigna clases CSS según jerarquía                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Componentes Clave

#### Backend:

1. **[src/routes/reportes.js](src/routes/reportes.js)**
   - Endpoint REST: `GET /api/reportes/resumen`
   - Validación de parámetros (empresaId, anio, mes)
   - Llamada a `generarReporte()`

2. **[src/services/reportes/planeacionReportesEngine.js](src/services/reportes/planeacionReportesEngine.js)**
   - Motor unificado para SUMMARY y RESUMEN
   - Carga layouts desde SQLite
   - Orquesta obtención de datos
   - Construye jerarquía de respuesta

3. **[src/services/layoutService.js](src/services/layoutService.js)**
   - CRUD de layouts en SQLite
   - Obtiene cuentas ordenadas por capítulo
   - Proporciona operaciones especiales

4. **[src/services/planeacionCuentasService.js](src/services/planeacionCuentasService.js)**
   - Consulta SALDOSYY y PRESUPYY en Firebird
   - Normaliza cuentas a formato canónico
   - Calcula acumulados YTD

#### Frontend:

1. **[vistas/RESUMEN.html](vistas/RESUMEN.html)**
   - Estructura HTML de la vista
   - Selectores de año/mes
   - Toggle de comparación
   - Tabla con 12 columnas

2. **[vistas/js/resumen-view.js](vistas/js/resumen-view.js)** (6617 líneas)
   - Lógica principal de la vista
   - `fetchResumen()`: Consulta datos
   - `aplicarComparativoResumen()`: Mezcla comparativos
   - `renderResumen()`: Renderiza tabla HTML
   - Gestión de gráficas y exportación

---

## Diferencias con SUMMARY

| Aspecto | SUMMARY | RESUMEN |
|---------|---------|---------|
| **Agrupación** | Por tipo de cuenta (Income/Expense) | Por estructura organizacional (Divisiones/Comités) |
| **Layout Excel** | Hoja "SUMMARY" | Hoja "RESUMEN" |
| **Jerarquía** | Income → Secciones → Cuentas | Empresa → División → Comité → Sección → Cuenta |
| **Operaciones** | Operating/Net Results globales | Operating/Net Results por plaza + Consolidated |
| **Comparativo** | Mes anterior del mismo año | Mes anterior O empresa comparativa |
| **Toggle comparación** | ❌ No disponible | ✅ Sí (comparar con empresa 9/10/11/12) |
| **Endpoint** | `/api/reportes/summary` | `/api/reportes/resumen` |
| **Motor backend** | `summaryEngine.js` → `planeacionReportesEngine.js` | `resumenEngine.js` → `planeacionReportesEngine.js` |

**En común**:
- Ambos usan `planeacionReportesEngine.js`
- Mismas tablas Firebird (SALDOSYY, PRESUPYY)
- Mismo formato de layouts SQLite
- Mismas 12 columnas en la tabla
- Mismo mecanismo de operaciones especiales

---

## Resumen Ejecutivo

### Sin Comparación:

1. **Usuario selecciona**: Empresa (CDMX), Año (2026), Mes (Enero)
2. **Frontend solicita**: `GET /api/reportes/resumen?empresaId=empresa1&anio=2026&mes=1`
3. **Backend consulta**:
   - **SQLite**: Layout y orden de cuentas
   - **Firebird SALDOS26**: Saldos reales de Enero
   - **Firebird PRESUP26**: Presupuestos de Enero
4. **Backend calcula**:
   - `actualMonth` = SALDOS01
   - `planMonth` = PRESUP01
   - `prevMonth` = 0 (no hay mes anterior en Enero)
   - Totales por sección/principal
   - Operating Results, Net Results, Consolidated
5. **Backend retorna**: JSON con jerarquía `children` + layout lineal
6. **Frontend renderiza**: Tabla HTML con 12 columnas

### Con Comparación:

1. **Usuario activa toggle**: "Comparar con Empresa 9"
2. **Frontend hace consulta doble**:
   - Empresa base (empresa1)
   - Empresa comparativa (empresa9)
3. **Frontend mezcla datos**:
   - Reemplaza `prevMonth`/`prevYTD` de empresa1
   - Con `actualMonth`/`actualYTD` de empresa9
   - Recalcula totales de secciones/principales
4. **Frontend renderiza**: Tabla mostrando:
   - **REAL/PPTO**: Datos de empresa1
   - **REAL MES AA**: Datos de empresa9 (comparativo)
   - **Variaciones**: empresa1 vs empresa1.presupuesto Y empresa1 vs empresa9

---

## Notas Técnicas Importantes

### 1. Normalización de Cuentas

Todas las cuentas se normalizan a formato canónico de **21 dígitos**:

```
Entrada:    401-000-000-00
Canónica:   401000000000000000001
            └─┬─┘└─┬─┘└─┬─┘└┬┘└──┴─────┘
              A    B    C   D  Padding+Nivel
```

**Niveles**:
- Nivel 1: `401-000-000-00` (B=000, C=000, D=00)
- Nivel 2: `401-001-000-00` (C=000, D=00)
- Nivel 3: `401-001-001-00` (D=00)
- Nivel 4: `401-001-001-01`

### 2. Cache de Layouts

Los layouts se cachean en memoria en el backend para evitar consultas repetidas a SQLite durante la misma sesión.

### 3. Operaciones Dinámicas

Las operaciones especiales (Operating Results, Net Results, Consolidated) se calculan en **tiempo de ejecución** usando:
- `formula_terms`: Array de principales con sus factores
- Ejemplo: `Operating Results = Income (factor: 1) + Expense (factor: -1)`

### 4. Snapshot Local

El frontend guarda un "snapshot" de la tabla renderizada en:
- `window.RESUMEN_SNAPSHOT`: Variable global
- `localStorage`: Key `resumen_tabla_snapshot:{empresaId}:{anio}:{mes}`

Este snapshot se usa para:
- Exportación a Excel/PDF
- Generación de gráficas sin re-consultar el backend
- Sincronización con vista Graficas.html

---

## Diagrama de Fuentes de Datos

```
                          📊 RESUMEN.html
                                │
                    ┌───────────┴───────────┐
                    │                       │
              Sin Comparación         Con Comparación
                    │                       │
                    ▼                       ▼
          ┌─────────────────┐    ┌─────────────────────────┐
          │ empresa1        │    │ empresa1 + empresa9     │
          │ CDMX 2026       │    │ CDMX 2026               │
          └─────────────────┘    └─────────────────────────┘
                    │                       │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ Backend API           │
                    │ /api/reportes/resumen │
                    └───────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
                    ▼                       ▼
          ┌─────────────────┐    ┌─────────────────────┐
          │ SQLite          │    │ Firebird            │
          │ - layouts       │    │ - SALDOS26          │
          │ - operaciones   │    │ - PRESUP26          │
          └─────────────────┘    └─────────────────────┘
                    │                       │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ JSON Response         │
                    │ - children (jerarquía)│
                    │ - layout (lineal)     │
                    │ - totales calculados  │
                    └───────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ Frontend Rendering    │
                    │ - 12 columnas         │
                    │ - Estilos CSS         │
                    │ - Tooltips            │
                    └───────────────────────┘
```

---

**Documento generado**: Febrero 2026  
**Versión**: 1.0  
**Autor**: Sistema SummaCham  
**Última actualización**: Compatible con código hasta resumen-view.js 6617 líneas
