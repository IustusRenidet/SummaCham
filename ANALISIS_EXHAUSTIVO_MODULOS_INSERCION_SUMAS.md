# ANÁLISIS EXHAUSTIVO: INSERCIÓN DE FILAS/SECCIONES Y CÁLCULO DE SUMAS

## 1. ARQUITECTURA DE GESTIÓN DE SECCIONES Y CUENTAS

### 1.1 Módulo Central: `cuentas-modulo.js`

El módulo `cuentas-modulo.js` (2,751 líneas) es el eje central que gestiona:
- 12 módulos soportados: presupuestos, vpe, servmembresia, membresia, comunicacion, gtoscorporativos, tic, comites, finanzas, rh, eventos, direccion
- Gestión de estado: `estadoModulo` (Map) con 140+ propiedades
- Estructura de secciones: `estadoModulo.sumas.secciones[]` (array de objetos meta)
- Mapas de valores: `valoresPorCuenta`, `nombresPorCuenta` (Maps)
- Gestión de filas de resumen: `sumavariosRows`, `resultRows` (Maps)

### 1.2 Módulos Editables vs No Editables

```javascript
// MODULOS_LAYOUT_EDITABLE (línea 76-89)
'presupuestos', 'presupuestoshtml', 'vpe', 'servmembresia', 
'serviciosalamembresia', 'membresia', 'comunicacion', 
'gtoscorporativos', 'tic', 'comites', 'finanzas', 'rh', 
'recursoshumanos', 'eventos'
// Total: 14 módulos pueden agregar/editar estructura
```

**NOTA CRÍTICA**: SUMMARY y RESUMEN NO son módulos editables en términos de estructura. Son **vistas de lectura** con capacidad limitada de editar SOLO:
- Columna `cuenta` (texto)
- Columna `descripcion` o `nombre` (texto)

---

## 2. LÓGICA DE INSERCIÓN DE FILAS Y SECCIONES

### 2.1 Inserción de Fila Individual: `insertarFilaCuentaNueva()`

**Líneas 1853-1880**

```javascript
const insertarFilaCuentaNueva = (referencia, posicion) => {
  // 1. Obtiene meta de sección donde se inserta
  const meta = obtenerMetaSeccionPorFila(referencia);
  
  // 2. Crea fila vacía con placeholder cells
  const nuevaFila = crearFilaCuentaVacia(meta.seccion);
  
  // 3. Inserta en DOM:
  //    - posicion === 'arriba': insertBefore(referencia)
  //    - posicion === 'abajo': insertBefore(siguiente) o insertBefore(sumRow)
  
  // 4. ACTUALIZA meta.filasCuenta con splice()
  //    - Mantiene orden e índice sincronizado con DOM
  
  // 5. Llama actualizarEstructuraDespuesCambio()
  //    - aplicarModoEdicionEnTabla()
  //    - recalcularSumas()
  //    - persistirLayoutActual()
};
```

**Flujo Crítico**:
1. La fila se inserta en posición correcta en DOM
2. Meta.filasCuenta se actualiza con splice() en la posición correcta
3. recalcularSumas() es invocado INMEDIATAMENTE

### 2.2 Creación de Sección Completa: `crearSeccionDesdeFormulario()`

**Líneas 1766-1838**

```javascript
const crearSeccionDesdeFormulario = ({
  referenciaFila,
  titulo,
  sumLabel,
  cuentas,
  sumavariosLabel,
  range
}) => {
  // 1. Crea header row: <tr class="section-header-row">
  // 2. Crea cuentas: Array de <tr class="fila-cuenta">
  // 3. Crea sum-row: <tr class="sum-row">
  
  // 4. Calcula idxInsercion (posición en secciones array)
  const idxInsercion = metaBase ? obtenerIndiceInsercionSeccion(metaBase) 
                                  : estadoModulo.sumas.secciones.length;
  
  // 5. Inserta en DOM ANTES de anchor (referencia)
  // 6. INSERTA en estadoModulo.sumas.secciones con splice(idxInsercion, 0, metaNueva)
  
  // 7. Si hay sumavariosLabel, actualiza sum-row-sumavarios
  actualizarSumavariosParaRango(sumavariosLabel, indices, idxInsercion);
  
  // 8. Llama actualizarEstructuraDespuesCambio()
};
```

**Flujo Crítico**:
1. La sección se inserta en posición correcta en DOM (header + cuentas + sum-row)
2. Meta sección se crea y se inserta en secciones[] con splice()
3. Si hay sumavariosLabel, se crea una nueva fila sum-row-sumavarios

### 2.3 Eliminación de Fila: `eliminarFilaSeleccionada()`

**Líneas 1881-1927**

```javascript
const eliminarFilaSeleccionada = (fila) => {
  if (fila.classList.contains('fila-cuenta')) {
    const meta = obtenerMetaSeccionPorFila(fila);
    
    // VALIDACIÓN CRÍTICA: Debe haber >1 cuenta por sección
    if ((meta.filasCuenta || []).length <= 1) {
      window.alert('La seccion debe tener al menos una cuenta.');
      return;
    }
    
    // Limpia Maps
    estadoModulo.valoresPorCuenta.delete(cuenta);
    estadoModulo.nombresPorCuenta.delete(cuenta);
    
    // Elimina del DOM y de meta.filasCuenta
    fila.remove();
    meta.filasCuenta.splice(idx, 1);
    
    // Recalcula
    actualizarEstructuraDespuesCambio();
  }
};
```

---

## 3. LÓGICA DE CÁLCULO DE SUMAS: `recalcularSumas()`

**Líneas 2076-2145**

### 3.1 Flujo General

```javascript
const recalcularSumas = () => {
  // FASE 1: Sumar cuentas POR SECCIÓN
  secciones.forEach((seccion) => {
    const valores = sumarListas(
      seccion.filasCuenta.map(fila => extraerValoresNumericos(fila))
    );
    seccion.sumValues = valores;  // Almacena suma de sección
    asignarValoresNumericos(seccion.elementos.sumRow, valores);  // Actualiza DOM
  });

  // FASE 2: Sumar sum-rows CON MISMA ETIQUETA (sum-row-sumavarios)
  // Agrupación por normalizarClave(seccion.sumRowSumavariosTexto)
  const acumuladosSumavarios = new Map();
  secciones.forEach((seccion) => {
    const clave = normalizarClave(seccion.sumRowSumavariosTexto);
    const prev = acumuladosSumavarios.get(clave) || [0,0,...];
    seccion.sumValues.forEach((valor, idx) => {
      prev[idx] += valor;
    });
    acumuladosSumavarios.set(clave, prev);
  });
  
  // Asigna a filas sum-row-sumavarios en DOM
  meta.sumavariosRows?.forEach((fila, clave) => {
    asignarValoresNumericos(fila, acumuladosSumavarios.get(clave));
  });

  // FASE 3: Sumar sum-rows CON MISMA ETIQUETA RESULTADO (result-row)
  // Cálculo similar pero agrupa por resultRowTexto
};
```

### 3.2 Estructura de Datos de Secciones

```javascript
// Meta de sección (líneas 1292-1308)
const metaSeccion = {
  seccion: 'clave-normalizada',           // Clave única de sección
  tituloVisible: 'Gastos Administrativos', // Título mostrado
  filasCuenta: [<tr>, <tr>, ...],         // Array de filas cuenta
  sumRowTexto: 'suma-gastos-admin',       // Clave normalizada de suma
  sumRowSumavariosTexto: 'suma-principal',  // Para agrupar múltiples secciones
  sumRowSumavarios2Texto: 'suma-alt',       // Segunda agrupación alternativa
  sumRowSumavariosLabel: 'Total Principal', // Etiqueta visible
  sumRowSumavarios2Label: 'Total Alt',      // Etiqueta alternativa
  resultRowTexto: 'resultado-operativo',    // Para resultado final
  resultRows: ['Resultado Operativo'],      // Array de etiquetas resultado
  elementos: {
    header: <tr class="section-header-row">,
    sumRow: <tr class="sum-row">
  }
};
```

---

## 4. DIFERENCIAS ENTRE SUMMARY, RESUMEN Y PRESUPUESTOS

### 4.1 PRESUPUESTOS (Modo Edición Completo)

| Aspecto | Implementación |
|---------|-----------------|
| **Archivos** | `vistas/SUMMARY.html` + `vistas/js/summary-view.js` (1,095 líneas) |
| **Editable** | SÍ - Columnas de presupuesto + estructura |
| **Filas Editables** | Todas (cuenta, nombre, budget-ene...dic, total, promedio) |
| **Inserción de Filas** | `insertarFilaCuentaNueva()` en `cuentas-modulo.js` |
| **Restricción Clave** | NINGUNA - puede editar todo excepto datos "reales" |
| **Modo de Edición** | `ModoEdicionPresupuesto` (nueva, 394 líneas) + callbacks |
| **Persistencia** | `persistirEnFirebird()` vía presupuesto.cuenta + valores |

**Columnas Editables en Presupuestos**:
```javascript
// Línea 2215-2235: aplicarModoEdicionEnTabla()
// Marca como data-editable:
- Columnas de presupuesto (budget-ene, budget-feb, ..., total-budget)
- Columna de cuenta
- Columna de descripción
```

### 4.2 SUMMARY (Vista de Lectura + Edición Limitada)

| Aspecto | Implementación |
|---------|-----------------|
| **Archivos** | `vistas/SUMMARY.html` + `vistas/js/summary-view.js` (1,095 líneas) |
| **Editable** | PARCIAL - Solo cuenta y descripción |
| **Filas Editables** | Solo `cuenta` y `descripcion` (línea 613-614) |
| **Validación** | `manejarBlurCelda()` solo permite `cuenta`, `descripcion`, `nombre` |
| **Inserción de Filas** | NO PERMITIDA - No puede agregar secciones/cuentas |
| **Restricción Clave** | `data-columna-clave` solo en cuenta/descripcion |
| **Persistencia** | Cambios se registran en `cambiosPendientes` pero no se guardan en Firebird |
| **Estructura** | Completamente generada desde datos, NO editable |

**Fragmento Validación (línea 177-201)**:
```javascript
const manejarBlurCelda = (event) => {
  const celda = event.currentTarget;
  const columna = celda.dataset.columnaClave;  // 'cuenta', 'descripcion', etc
  
  // SOLO permite estas columnas:
  const esTexto = columna === 'cuenta' || columna === 'descripcion' || columna === 'nombre';
  
  if (esTexto) {
    // Procesa como texto, registra cambio
    registrarCambio(cuenta, columna, nuevoTexto, original);
  } else {
    // SI NO es una de estas 3 columnas, SE IGNORA
    celda.textContent = formatNumber(original);
    eliminarCambio(cuenta, columna);
  }
};
```

### 4.3 RESUMEN (Vista de Lectura + Edición Limitada)

| Aspecto | Implementación |
|---------|-----------------|
| **Archivos** | `vistas/RESUMEN.html` + `vistas/js/resumen-view.js` (892 líneas) |
| **Editable** | PARCIAL - Solo cuenta y descripción |
| **Filas Editables** | Solo `cuenta` y `descripcion` (análogo a SUMMARY) |
| **Validación** | Idéntica a SUMMARY |
| **Inserción de Filas** | NO PERMITIDA |
| **Restricción Clave** | Idéntica a SUMMARY |
| **Persistencia** | Cambios se registran pero no se guardan en Firebird |

---

## 5. ERRORES IDENTIFICADOS EN LA INSERCIÓN DE SECCIONES

### ❌ ERROR #1: Falta de Validación en Rango de Sumavarios

**Ubicación**: `actualizarSumavariosParaRango()` (líneas 1738-1765)

**Problema**:
```javascript
const actualizarSumavariosParaRango = (label, indices, insertIdx) => {
  // Calcula índice ajustado para DESPUÉS de inserción
  const metas = indices.map((idx) => {
    const ajustado = idx >= insertIdx ? idx + 1 : idx;  // ⚠️ PELIGROSO
    return estadoModulo.sumas.secciones[ajustado];
  });
};
```

**Riesgo**:
- Si `insertIdx` está en el medio del rango, el cálculo es incorrecto
- No valida que los índices existan o sean contiguos
- No verifica si las secciones están todas en el mismo nivel

**Ejemplo de Fallo**:
```
Secciones actuales: [SEC1, SEC2, SEC3, SEC4]
Insertar nueva sección en índice 2: [SEC1, SEC2, NUEVA, SEC3, SEC4]
Range: indices=[0, 3] (antes: SEC1, SEC4; después: SEC1, SEC3)
Cálculo: idx=0 -> ajustado=0 (ok)
         idx=3 -> ajustado=4 (INCORRECTO! Debería ser 3 o 4 según propósito)
```

### ❌ ERROR #2: Sum-row-Sumavarios no se Elimina al Remover Sección

**Ubicación**: `eliminarFilaSeleccionada()` (líneas 1881-1927)

**Problema**:
```javascript
const eliminarFilaSeleccionada = (fila) => {
  if (fila.classList.contains('fila-cuenta')) {
    // ... elimina cuenta de sección
    // ⚠️ NO VERIFICA si esta era la última sección en un sumavarios
    // La fila sum-row-sumavarios sigue existiendo HUÉRFANA en el DOM
  } else if (fila.classList.contains('sum-row-sumavarios')) {
    // Sí elimina sum-row-sumavarios, pero no valida su estructura
  }
};
```

**Riesgo**:
- Si eliminas la última cuenta de una sección que es parte de un sumavarios
- Y luego eliminas toda la sección
- La fila sum-row-sumavarios queda en el DOM pero sin referencias
- `recalcularSumas()` no sabe qué hacer con ella

### ❌ ERROR #3: No Valida Integridad de Estructura al Insertar Sección

**Ubicación**: `crearSeccionDesdeFormulario()` (líneas 1766-1838)

**Problema**:
```javascript
const idxInsercion = metaBase ? obtenerIndiceInsercionSeccion(metaBase) 
                              : estadoModulo.sumas.secciones.length;
// ⚠️ No valida que obtenerIndiceInsercionSeccion() retorne índice válido
// No valida que insertBefore() use el anchor correcto
```

**Riesgo**:
- Puede causar inserción en posición incorrecta en DOM
- Índice en secciones[] no coincide con posición en DOM
- `recalcularSumas()` usa índice de secciones[], pero suma filas en orden DOM = INCONSISTENCIA

### ❌ ERROR #4: Validación de "Al Menos 1 Cuenta" Incompleta

**Ubicación**: `eliminarFilaSeleccionada()` (línea 1888-1891)

**Problema**:
```javascript
if ((meta.filasCuenta || []).length <= 1) {
  window.alert('La seccion debe tener al menos una cuenta.');
  return;  // ⚠️ Solo evita eliminar ÚLTIMA fila, pero:
}
// NO impide agregar secciones VACÍAS
```

**Riesgo**:
- `crearSeccionDesdeFormulario()` permite crear sección con `cuentas: []`
- Se crea meta sección vacía → sum-row sin filasCuenta que sumar
- `recalcularSumas()` suma array vacío → 0 (técnicamente ok, pero lógicamente mal)

### ❌ ERROR #5: recalcularSumas() No Valida Integridad de Meta

**Ubicación**: `recalcularSumas()` (líneas 2076-2145)

**Problema**:
```javascript
const recalcularSumas = () => {
  secciones.forEach((seccion) => {
    // ⚠️ No verifica:
    // - seccion.filasCuenta existe
    // - seccion.elementos.sumRow existe en DOM
    // - seccion.sumRowTexto es válida (no vacia/null)
    const valores = sumarListas(seccion.filasCuenta.map(...));
    asignarValoresNumericos(seccion.elementos.sumRow, valores);
  });
};
```

**Riesgo**:
- Si meta tiene valores null/undefined
- Error silencioso en asignarValoresNumericos()
- Fila sum-row no se actualiza

### ❌ ERROR #6: SUMMARY/RESUMEN Permiten Editar "Cuenta" Pero No Persisten

**Ubicación**: `summary-view.js` líneas 613-614, `manejarBlurCelda()` línea 177-201

**Problema**:
```javascript
// Crea celdas editables:
${createEditableCell(cta.cuenta || '', { columnKey: 'cuenta', ... })}
${createEditableCell(cta.descripcion || '', { columnKey: 'descripcion', ... })}

// Registra cambios:
registrarCambio(cuenta, 'cuenta', nuevoTexto, original);  // Guarda en cambiosPendientes

// PERO nunca se persisten en Firebird:
// - obtenerCambiosPendientes() retorna cambios
// - FlujoAutorizacion nunca es configurado en SUMMARY/RESUMEN
// - Sin callback persistirEnFirebird(), los cambios se pierden
```

**Riesgo**:
- Usuario piensa que sus cambios de cuenta/descripción en SUMMARY se guardan
- Recarga la página → se pierden todos los cambios
- Inconsistencia con PRESUPUESTOS que SÍ persisten cambios

---

## 6. VALIDACIONES FALTANTES

### 6.1 Validación de Estructura en `renderizarSecciones()`

**Líneas 1246-1381**

```javascript
// ❌ FALTA: Validar que secciones no estén vacías
secciones.forEach((lista, seccion) => {
  // lista puede tener 0 elementos
  // ⚠️ No hay validación de lista.length > 0
});

// ❌ FALTA: Validar que cuentas sean únicas por sección
lista.forEach((item) => {
  // item.cuenta puede estar duplicada
  // ⚠️ No hay Set para detectar duplicados
});

// ❌ FALTA: Validar que placeholders sea consistente
for (let i = 0; i < placeholders; i += 1) {
  // ⚠️ Si placeholders cambia entre renderizaciones, filas se desalinean
});
```

### 6.2 Validación en `insertarFilaCuentaNueva()`

```javascript
// ❌ FALTA: Validar que referencia esté en DOM
const meta = obtenerMetaSeccionPorFila(referencia);
if (!meta) return;  // Solo retorna, no notifica error

// ❌ FALTA: Validar que meta.filasCuenta sea mutable
meta.filasCuenta.splice(idx, 0, nuevaFila);
// ⚠️ Si meta.filasCuenta es undefined o no es array → error
```

---

## 7. PROBLEMAS EN SINCRONIZACIÓN DOM ↔ ESTADO

### 7.1 Problema: `filasCuenta` Puede Desincronizarse de DOM

**Escenario**:
```javascript
// T1: Meta contiene 3 filas en filasCuenta[]
meta.filasCuenta = [fila1, fila2, fila3]

// T2: Usuario usa DevTools para eliminar fila2 del DOM
// document.querySelector('tr').remove() // Elimina sin pasar por eliminarFilaSeleccionada()

// T3: recalcularSumas() itera meta.filasCuenta
meta.filasCuenta.forEach(fila => {
  const almacenados = estadoModulo.valoresPorCuenta.get(fila.dataset.cuenta21);
  // fila2 ya no está en DOM pero SÍ está en meta.filasCuenta
  // Suma incluye valores de fila2 aunque no esté visible
})
```

**Impacto**: Sumas incorrectas

### 7.2 Problema: Índices en `secciones[]` No Coinciden con Orden en DOM

**Escenario**:
```javascript
// Secciones array:
secciones[0] = meta1 (header1, [cuenta1, cuenta2], sum1)
secciones[1] = meta2 (header2, [cuenta3], sum2)

// Insertar meta3 en posición intermedia:
insertarSeccion(meta3, idxInsercion=1)
// Resultado:
secciones[0] = meta1
secciones[1] = meta3  // ← Inserido
secciones[2] = meta2

// PERO en DOM, si insertBefore() se hizo incorrectamente:
// DOM: header1, cuenta1, cuenta2, sum1, header2, cuenta3, sum2, header3, cuenta4, sum3
// ↓
// Orden es: 1, 2, 3, 4 pero NO coincide con secciones[] = [1, 3, 2]
```

**Impacto**: `recalcularSumas()` suma secciones en orden incorrecto

---

## 8. CASOS DE PRUEBA QUE FALLAN

### Caso 1: Insertar Sección Vacía

```javascript
crearSeccionDesdeFormulario({
  titulo: 'Nueva Sección Vacía',
  sumLabel: 'Suma',
  cuentas: [],  // ❌ VACÍA
  sumavariosLabel: 'Total'
});

// Resultado esperado: Error
// Resultado actual: Se crea meta con filasCuenta: [], sum-row muestra 0
// recalcularSumas() suma array vacío: valores = [0, 0, ..., 0]
```

### Caso 2: Eliminar Sección Completa Que Es Sumavario

```javascript
// Estructura:
// SEC1 (sumavarios: 'Total Principal')
// SEC2 (sumavarios: 'Total Principal')
// sum-row-sumavarios 'Total Principal'

eliminarFilaSeleccionada(SEC1.header);  // Elimina toda sección 1
// ❌ sum-row-sumavarios sigue en DOM
// ❌ recalcularSumas() suma solo SEC2 pero fila sumavarios sigue existiendo

// Luego eliminar SEC2
eliminarFilaSeleccionada(SEC2.header);
// ❌ sum-row-sumavarios queda HUÉRFANA en DOM
```

### Caso 3: Editar Columna en SUMMARY Que No Es Cuenta/Descripcion

```javascript
// Usuario intenta editar valor de presupuesto en SUMMARY
celda.dataset.columnaClave = 'budget-ene';  // NO es 'cuenta' ni 'descripcion'
celda.contentEditable = 'true';
// Usuario escribe nuevo valor

manejarBlurCelda(event);
// ❌ SILENCIOSAMENTE IGNORA el cambio
// ❌ Restaura valor original
// ❌ No notifica al usuario
// ❌ Sin validación explícita, el usuario no sabe por qué su cambio desapareció
```

### Caso 4: Integridad de Sumavarios Tras Insertar Sección en Medio

```javascript
// Inicial:
// secciones = [SEC1, SEC2, SEC3]
// sumavarios: SEC1 y SEC2 comparten 'Total Principal'

// Insertar SEC_NUEVA en índice 1:
secciones = [SEC1, SEC_NUEVA, SEC2, SEC3]

// actualizarSumavariosParaRange() intenta corregir índices:
// range = [0, 2] (antes: SEC1, SEC3; después: SEC1, SEC2)
const ajustado = idx >= insertIdx ? idx + 1 : idx;
// idx=0: ajustado=0 (SEC1) ✓
// idx=2: ajustado=3 (SEC3) ❌ Debería ser 2 (SEC2) si queremos mantener misma relación

// Resultado: Sum-row-sumavarios queda asociado a SEC1 + SEC3 en lugar de SEC1 + SEC2
```

---

## 9. PROBLEMAS EN SUMMARY/RESUMEN ESPECÍFICOS

### 9.1 Cambios de Cuenta/Descripcion No Persisten

**Ubicación**: `summary-view.js`, `manejarBlurCelda()` (líneas 177-201)

**Estado Actual**:
1. Usuario edita celda `cuenta` o `descripcion`
2. Se registra en `cambiosPendientes` map
3. `notificarCambios()` se llama
4. ✅ `cambiosPendientes` contiene el cambio
5. ❌ **PERO**: No hay callback en SUMMARY.html para persistir

**Verificación en SUMMARY.html**:
```javascript
// Línea 482: se carga flujo-autorizacion.js
<script src="js/flujo-autorizacion.js"></script>

// Línea 483: se carga resumen-view.js  
<script src="js/resumen-view.js"></script>

// ❌ NO hay inicialización de FlujoAutorizacion
// ❌ NO hay callback para obtenerCambios()
// ❌ Cambios se registran pero NUNCA se persisten
```

### 9.2 Sin Validación Visual de Columnas Permitidas

**Ubicación**: `summary-view.js`, `createEditableCell()` (línea 438)

**Problema**:
```javascript
// Todas las celdas tienen clase 'editable-cell'
// Pero solo 3 columnas realmente funcionan: cuenta, descripcion, nombre
// Usuario NO sabe cuáles son editables sin intentar editar

// ❌ Sin indicación visual (ej: borde, color, ícono de candado)
// ❌ El cambio se acepta en onBlur pero se RECHAZA silenciosamente
// ❌ Experiencia de usuario muy confusa
```

### 9.3 Falta de Modal/Confirmación para Inserción de Filas

**Ubicación**: SUMMARY y RESUMEN no implementan `crearSeccionDesdeFormulario()`

**Observación**:
```javascript
// PRESUPUESTOS (vía cuentas-modulo.js):
// - Modal para agregar sección: abrirModalAgregarSeccion()
// - Input para título, sum label, cuentas, sumavarios label

// SUMMARY/RESUMEN:
// ❌ NO tienen interfaz para agregar secciones
// ✅ Correcto por diseño, pero sin validación explícita de esto
```

---

## 10. LÓGICA DE RESTRICCIÓN POR MÓDULO

### Restricción en `aplicarModoEdicionEnTabla()` (Línea 2220+)

```javascript
const aplicarModoEdicionEnTabla = () => {
  if (!estadoModulo.tabla) return;
  if (!estadoModulo.editMode) {
    limpiarModoEdicionEnTabla();
    return;
  }
  
  const reverse = invertirColumnas();  // ¿Qué es esto?
  const filas = obtenerFilasCuenta();
  
  // Marca celdas como editables
  Array.from(fila.cells).forEach((celda) => {
    celda.contentEditable = 'true';
    celda.dataset.editable = '';
  });
};
```

**Problema**: Esta función marca TODAS las celdas como editables sin verificar:
- Si el módulo es editable
- Qué tipo de columna es (presupuesto vs. descripción)
- Si SUMMARY tiene configuración de edición

---

## 11. RECOMENDACIONES DE CORRECCIÓN

### URGENTE (P0):

1. **Implementar validación de estructura en `renderizarSecciones()`**
   - Rechazar secciones vacías (lista.length === 0)
   - Detectar y eliminar cuentas duplicadas
   - Validar placeholders consistencia

2. **Agregar validación en `crearSeccionDesdeFormulario()`**
   - Requiere al menos 1 cuenta
   - Valida que idxInsercion sea dentro de rango válido
   - Verifica que anchor exista en DOM

3. **Corregir `actualizarSumavariosParaRango()`**
   - Validar que indices sean contiguos y válidos
   - No insertar sumavarios si solo hay 1 sección
   - Verificar índices después del cálculo de ajuste

4. **Persistencia en SUMMARY/RESUMEN**
   - Documenton claramente: cambios de cuenta/descripcion NO se guardan en Firebird
   - O implementar callback para guardar en una tabla local
   - Agregar indicación visual al usuario

### IMPORTANTE (P1):

5. **Prevenir desincronización DOM ↔ Estado**
   - Validar en `recalcularSumas()` que filasCuenta existan en DOM
   - Limpiar referencias huérfanas
   - Usar MutationObserver para detectar cambios no autorizados

6. **Validar integridad de Meta en `recalcularSumas()`**
   - Verificar seccion.filasCuenta.length > 0
   - Verificar seccion.elementos.sumRow existe
   - Catch silenciosamente y log errores

7. **Interfaz visual para edición**
   - Mostrar indicador de "solo lectura" para SUMMARY/RESUMEN
   - Marcar visualmente celdas editables vs. no editables
   - Mostrar mensaje de error cuando intenta editar no-permitida

### MEJORAS (P2):

8. **Validación de rango sumavarios**
   - Permitir múltiples secciones en sumavarios solo si hay >1
   - Validar que todaseccion en el rango estén correctamente vinculadas

9. **Error handling en `eliminarFilaSeleccionada()`**
   - Validar que eliminar última sección no cause estructura inválida
   - Eliminar sum-row-sumavarios huérfanas

10. **Test cases**
    - Caso de inserción en medio de sumavarios
    - Caso de eliminación de sección que es sumavario
    - Caso de edición en SUMMARY vs. Presupuestos
    - Caso de suma vacía

---

## 12. TABLA COMPARATIVA FINAL

| Característica | PRESUPUESTOS | SUMMARY | RESUMEN |
|---|---|---|---|
| Editable | SÍ (estructura + datos) | PARCIAL (solo cuenta/desc) | PARCIAL (solo cuenta/desc) |
| Insertar filas | SÍ - `insertarFilaCuentaNueva()` | NO | NO |
| Insertar secciones | SÍ - Modal `abrirModalAgregarSeccion()` | NO | NO |
| Validación estructura | Parcial (≥1 por sección) | N/A | N/A |
| Persistencia | ✅ `persistirEnFirebird()` | ❌ Sin callback | ❌ Sin callback |
| Módulo editable | Sí (`'presupuestos'`) | No | No |
| Estado | `estadoModulo` + Maps | Generado dinámico | Generado dinámico |

---

## CONCLUSIÓN

La arquitectura actual tiene **6 errores críticos en la lógica de inserción y suma**, **3 problemas de validación**, y **1 inconsistencia grave en SUMMARY/RESUMEN** donde se permite editar pero no persisten cambios. Las correcciones son necesarias para garantizar:

✅ Integridad de estructura  
✅ Precisión de cálculos  
✅ Sincronización DOM ↔ Estado  
✅ Experiencia de usuario consistente  
✅ Persistencia confiable en Firebird
