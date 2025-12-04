# 🔧 GUÍA DE INTEGRACIÓN AL REPOSITORIO

## 📦 ARCHIVOS PARA ACTUALIZAR EN TU REPO

### 1. **`vistas/js/summary-catalog.js`** ✅ CRÍTICO

**Acción:** REEMPLAZAR COMPLETAMENTE

**Archivo nuevo:** `summary-catalog.js` (en /outputs)

**Cambios implementados:**
- ✅ Estructura completa de CIUDAD DE MÉXICO (47 cuentas)
- ✅ Estructura completa de GUADALAJARA (22 cuentas)
- ✅ Estructura completa de NOROESTE (31 cuentas)
- ✅ Total: 100 cuentas catalogadas
- ✅ Comentarios detallados por sección
- ✅ Estadísticas al final del archivo

**Ubicación en tu repo:**
```
tu-repo/
└── vistas/
    └── js/
        └── summary-catalog.js  ← REEMPLAZAR ESTE ARCHIVO
```

---

### 2. **`vistas/js/summary-view.js`** ✓ Ya está correcto

**Acción:** NO REQUIERE CAMBIOS

El código que compartiste ya tiene implementado:
- ✅ `sortSections()` con priorización
- ✅ `sortPrincipals()` con orden Income/Expense/Operating/Other
- ✅ `renderSummary()` con 12 columnas
- ✅ `fetchSummary()` con parámetro de capítulo
- ✅ Manejo de eventos y actualización de labels

**Verificar únicamente:**
```javascript
// Que estas constantes estén presentes:
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

const PRINCIPAL_PRIORITY = [
  'INCOME',
  'EXPENSE',
  'OPERATING',
  'OTHER'
];
```

---

### 3. **`vistas/SUMMARY.html`** ✓ Ya está correcto

**Acción:** NO REQUIERE CAMBIOS

El HTML que compartiste ya tiene:
- ✅ Estructura de 12 columnas en el `<thead>`
- ✅ Selectores de Año/Mes/Capítulo
- ✅ Controles de Zoom
- ✅ Estilos CSS completos
- ✅ Referencias a los archivos JS correctos

**Verificar únicamente:**
```html
<!-- Que estén estos scripts en el orden correcto: -->
<script src="js/sesion.js"></script>
<script src="js/flujo-autorizacion.js"></script>
<script src="js/summary-catalog.js"></script>  ← IMPORTANTE
<script src="js/summary-view.js"></script>
```

---

### 4. **Backend API** ⚠️ REQUIERE ACTUALIZACIÓN

**Archivo:** El endpoint que maneja `/api/reportes/summary`

**Cambios necesarios:**

#### A. Agregar soporte para parámetro `capitulo`

```javascript
// ANTES (si solo tenías empresaId)
router.get('/summary', async (req, res) => {
  const { empresaId, anio, mes } = req.query;
  // ...
});

// DESPUÉS (agregar capitulo)
router.get('/summary', async (req, res) => {
  const { empresaId, anio, mes, capitulo } = req.query;
  
  // Mapear empresaId a capítulo si no viene explícito
  const capituloMap = {
    'empresa1': 'CIUDAD DE MÉXICO',
    'empresa2': 'GUADALAJARA', 
    'empresa3': 'NORESTE',
    'empresa4': 'NOROESTE'
  };
  
  const capituloFinal = capitulo || capituloMap[empresaId] || 'CIUDAD DE MÉXICO';
  
  // Tu lógica de negocio...
});
```

#### B. Retornar estructura jerárquica

El backend debe retornar en este formato:

```javascript
{
  "resumen": [
    {
      "label": "CIUDAD DE MÉXICO",  // o "GUADALAJARA" o "NOROESTE"
      "actualMonth": 541251.00,
      "planMonth": 2637429.00,
      "prevMonth": 2009329.00,
      // ... otros totales
      "children": [
        {
          "label": "CDMX Income",  // o "Guadalajara Income" etc.
          "type": "income",
          "actualMonth": 541251.00,
          // ... totales
          "children": [
            {
              "label": "Membership",
              "actualMonth": 90804.00,
              // ... totales
              "cuentas": [
                {
                  "cuenta": "401000000000000000001",
                  "descripcion": "Cuotas Netas",
                  "actualMonth": 0.00,
                  "planMonth": 2148125.00,
                  "prevMonth": 1709454.95,
                  "actualYTD": 0.00,
                  "planYTD": 2148125.00,
                  "prevYTD": 1709454.95
                },
                // ... más cuentas
              ]
            },
            // ... más secciones
          ]
        },
        {
          "label": "CDMX Expense",
          "type": "expense",
          // ... estructura similar
        },
        // ... Operating Results, Other Income, Net Results
      ]
    }
  ],
  "capituloSeleccionado": "CIUDAD DE MÉXICO",
  "capitulosDisponibles": [
    { "clave": "CIUDAD DE MÉXICO", "etiqueta": "CIUDAD DE MÉXICO" },
    { "clave": "GUADALAJARA", "etiqueta": "GUADALAJARA" },
    { "clave": "NOROESTE", "etiqueta": "NOROESTE" }
  ],
  "anio": 2022,
  "anioComparativo": 2021
}
```

#### C. Lógica de agregación por capítulo

```javascript
// Ejemplo simplificado de cómo construir la estructura

const construirEstructura = (capitulo, cuentasData) => {
  const catalog = SUMMARY_CATALOG.cities[capitulo];
  if (!catalog) return null;
  
  const resultado = {
    label: capitulo,
    children: []
  };
  
  // Iterar por majors (Income, Expense, Other Income)
  Object.entries(catalog.majors).forEach(([majorKey, major]) => {
    const majorNode = {
      label: majorKey,
      type: major.type,
      children: []
    };
    
    // Iterar por secciones (Membership, Events, etc.)
    Object.entries(major.sections).forEach(([seccionKey, codigos]) => {
      const seccionNode = {
        label: seccionKey,
        cuentas: []
      };
      
      // Buscar datos de cada cuenta
      codigos.forEach(codigo => {
        const data = cuentasData.find(c => c.cuenta === codigo);
        if (data) {
          seccionNode.cuentas.push(data);
        }
      });
      
      // Calcular totales de la sección
      seccionNode.actualMonth = seccionNode.cuentas.reduce((sum, c) => sum + c.actualMonth, 0);
      seccionNode.planMonth = seccionNode.cuentas.reduce((sum, c) => sum + c.planMonth, 0);
      // ... más totales
      
      majorNode.children.push(seccionNode);
    });
    
    // Calcular totales del major
    majorNode.actualMonth = majorNode.children.reduce((sum, s) => sum + s.actualMonth, 0);
    // ... más totales
    
    resultado.children.push(majorNode);
  });
  
  // Calcular totales del capítulo
  resultado.actualMonth = resultado.children.reduce((sum, m) => sum + m.actualMonth, 0);
  // ... más totales
  
  return resultado;
};
```

---

## 🚀 PASOS DE INTEGRACIÓN

### Paso 1: Backup
```bash
# Haz backup de tus archivos actuales
cp vistas/js/summary-catalog.js vistas/js/summary-catalog.js.backup
```

### Paso 2: Reemplazar archivo
```bash
# Copia el nuevo summary-catalog.js
cp summary-catalog.js tu-repo/vistas/js/summary-catalog.js
```

### Paso 3: Verificar archivos existentes
```bash
# Verifica que estos archivos existan y tengan el contenido correcto:
cat vistas/js/summary-view.js | grep "SECTION_PRIORITY"
cat vistas/SUMMARY.html | grep "summary-catalog.js"
```

### Paso 4: Actualizar backend
1. Agrega parámetro `capitulo` al endpoint
2. Implementa mapeo empresaId → capítulo
3. Implementa lógica de construcción jerárquica
4. Retorna formato JSON correcto

### Paso 5: Testing

#### Test 1: Verificar carga de catálogo
```javascript
// En consola del navegador (SUMMARY.html)
console.log(window.SUMMARY_CATALOG);
// Debe mostrar el objeto completo con 3 ciudades

console.log(window.SUMMARY_CATALOG.cities["CIUDAD DE MÉXICO"].majors);
// Debe mostrar CDMX Income, CDMX Expense, etc.
```

#### Test 2: Verificar conteo de cuentas
```javascript
// Contar cuentas de CDMX
const cdmxCodes = new Set();
Object.values(window.SUMMARY_CATALOG.cities["CIUDAD DE MÉXICO"].majors)
  .forEach(major => cdmxCodes.add(...major.codes));
console.log("CDMX cuentas:", cdmxCodes.size); // Debe ser 47

// Contar cuentas de Guadalajara
const gdlCodes = new Set();
Object.values(window.SUMMARY_CATALOG.cities["GUADALAJARA"].majors)
  .forEach(major => gdlCodes.add(...major.codes));
console.log("GDL cuentas:", gdlCodes.size); // Debe ser 22

// Contar cuentas de Noreste
const norteCodes = new Set();
Object.values(window.SUMMARY_CATALOG.cities["NOROESTE"].majors)
  .forEach(major => norteCodes.add(...major.codes));
console.log("Noreste cuentas:", norteCodes.size); // Debe ser 31
```

#### Test 3: Verificar orden de renderizado
```javascript
console.log(window.SUMMARY_CATALOG.order);
// Debe ser: ["CIUDAD DE MÉXICO", "GUADALAJARA", "NOROESTE"]
```

#### Test 4: Probar selección de capítulo
1. Abre SUMMARY.html
2. Selecciona "Guadalajara" en el selector de capítulos
3. Verifica que se muestren las secciones correctas:
   - Membership (2 cuentas)
   - Events and Committees (2 cuentas) ← FUSIONADAS
   - Services to Members (5 cuentas)
4. Verifica que NO aparezcan:
   - Events separado
   - Committees separado
   - 13 departamentos administrativos
   - 7 cuentas de nómina separadas

#### Test 5: Verificar agregaciones
```javascript
// En el HTML renderizado, verificar que:
// 1. Los subtotales de secciones sumen correctamente
// 2. Los totales de Income/Expense coincidan con la suma de secciones
// 3. Operating Results = Income - Expense
// 4. Net Results = Operating Results + Other Income
```

---

## 📝 CHECKLIST DE VALIDACIÓN

### Frontend
- [ ] `summary-catalog.js` reemplazado con nuevo archivo
- [ ] `summary-view.js` tiene `SECTION_PRIORITY` definido
- [ ] `SUMMARY.html` importa scripts en orden correcto
- [ ] Consola muestra `SUMMARY_CATALOG` completo
- [ ] Conteo de cuentas correcto (47 + 22 + 31 = 100)
- [ ] Selector de capítulos funcional

### Backend
- [ ] Endpoint acepta parámetro `capitulo`
- [ ] Mapeo empresaId → capítulo implementado
- [ ] Retorna estructura jerárquica correcta
- [ ] Cálculo de agregaciones por nivel
- [ ] Cálculo de variaciones porcentuales
- [ ] Lista de capítulos disponibles

### Funcionalidad
- [ ] CDMX muestra 4 categorías de Income
- [ ] CDMX muestra 7 categorías de Expense
- [ ] CDMX muestra 13 departamentos administrativos
- [ ] CDMX muestra 7 cuentas de nómina separadas
- [ ] Guadalajara muestra "Events and Committees" fusionadas
- [ ] Guadalajara muestra G&A consolidado (sin departamentos)
- [ ] Noreste muestra estructura similar a Guadalajara
- [ ] Orden de secciones respeta `SECTION_PRIORITY`
- [ ] Totales suman correctamente en todos los niveles
- [ ] Variaciones calculan correctamente

---

## ⚠️ PROBLEMAS COMUNES Y SOLUCIONES

### Problema 1: "SUMMARY_CATALOG is not defined"
**Causa:** `summary-catalog.js` no se está cargando
**Solución:** 
1. Verifica que el archivo esté en `vistas/js/summary-catalog.js`
2. Verifica que el `<script>` esté antes de `summary-view.js`
3. Revisa la consola para errores de sintaxis en el archivo

### Problema 2: Cuentas no aparecen en la UI
**Causa:** Backend no está retornando datos para esas cuentas
**Solución:**
1. Verifica que las cuentas existan en tu base de datos
2. Verifica el mapeo de códigos de cuenta (21 dígitos)
3. Revisa la respuesta del endpoint en Network tab

### Problema 3: Orden de secciones incorrecto
**Causa:** `SECTION_PRIORITY` no está definido o está mal
**Solución:**
1. Verifica que `summary-view.js` tenga el array completo
2. Verifica que `sortSections()` esté usando `sectionPriority()`
3. Revisa que `normalizeText()` esté funcionando correctamente

### Problema 4: Totales no suman
**Causa:** Backend no está agregando correctamente
**Solución:**
1. Verifica que estés sumando todas las cuentas de cada sección
2. Verifica que los tipos numéricos sean correctos (no strings)
3. Implementa las agregaciones por cada nivel:
   - Cuenta → Sección
   - Sección → Major (Income/Expense)
   - Major → Capítulo

### Problema 5: Capítulos no cambian al seleccionar
**Causa:** Evento de cambio no está conectado o backend no filtra
**Solución:**
1. Verifica que `selectCapitulo.addEventListener('change', ...)` exista
2. Verifica que `fetchSummary()` pase el parámetro `capitulo`
3. Verifica que el backend use ese parámetro para filtrar datos

---

## 📞 SOPORTE ADICIONAL

Si encuentras problemas durante la integración:

1. **Revisa la consola del navegador** para errores JavaScript
2. **Revisa Network tab** para ver la respuesta del backend
3. **Compara tu código** con los ejemplos en `GUIA_IMPLEMENTACION_CAPITULOS.md`
4. **Verifica las estadísticas** con los tests de validación
5. **Consulta los diagramas** en el Excel de comparación

---

## 📊 VERIFICACIÓN FINAL

Una vez integrado todo, deberías poder:

✅ Seleccionar "CIUDAD DE MÉXICO" y ver 47 cuentas  
✅ Seleccionar "GUADALAJARA" y ver 22 cuentas  
✅ Seleccionar "NOROESTE" y ver 31 cuentas  
✅ Ver estructura diferente por capítulo  
✅ Ver totales correctos en todos los niveles  
✅ Ver variaciones calculadas correctamente  
✅ Cambiar año/mes y ver datos actualizados  
✅ Exportar/imprimir el reporte  

---

**¡Integración lista para producción!** 🚀

**Archivos para copiar a tu repo:**
1. ✅ `summary-catalog.js` → `vistas/js/summary-catalog.js`

**Archivos que ya están correctos (no requieren cambios):**
2. ✓ `summary-view.js`
3. ✓ `SUMMARY.html`

**Por actualizar en backend:**
4. ⚠️ Endpoint `/api/reportes/summary`
