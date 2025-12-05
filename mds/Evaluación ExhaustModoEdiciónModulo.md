# Evaluación Exhaustiva: Modo Edición por Módulo

## Resumen Ejecutivo

Este documento evalúa exhaustivamente el modo de edición para cada módulo y panel (RESUMEN, SUMMARY, PRESUPUESTOS) así como los módulos departamentales, identificando lo que se puede editar, lo que no, y problemas potenciales que impidan ver borradores o editar.

---

## Estructura General de HTML y Botones

### Botones Estándar del Flujo de Autorización

Todos los módulos **DEBEN** tener estos botones con los IDs exactos para que

FlujoAutorizacion funcione:

| ID de Botón          | Acción                              | Visible cuando                              |
| -------------------- | ----------------------------------- | ------------------------------------------- |
| `btnGuardarBorrador` | Cargar/Guardar presupuesto          | Estado vacío, GUARDADO, o RECHAZADO (autor) |
| `btnEnviarCambios`   | Enviar a revisión                   | Modo edición activo                         |
| `btnCancelarEdicion` | Cancelar edición                    | Modo edición activo                         |
| `btnMarcarRevisado`  | Marcar revisado / Cancelar revisión | PENDIENTE o REVISADO                        |
| `btnAutorizar`       | Autorizar presupuesto               | REVISADO                                    |
| `btnRechazar`        | Rechazar presupuesto                | PENDIENTE, REVISADO, APROBADO               |
| `btnVerBorrador`     | Abrir centro de borradores          | Siempre (se debe mostrar)                   |
| `saveBudgetBtn`      | Guardar en COI                      | APROBADO                                    |

---

## 📊 Panel: RESUMEN.html

### Elementos que SÍ se pueden editar

- ✅ **Cuenta** - Celda editable con `data-columna-clave="cuenta"`
- ✅ **Descripción** - Celda editable con `data-columna-clave="descripcion"`

### Elementos que NO se pueden editar

- ❌ **Valores numéricos de celdas** - Son calculados (Real, Ppto, variaciones)
- ❌ **Filas de sección/totales** - Calculadas automáticamente
- ❌ **Encabezados** - Estáticos

### Configuración HTML

<pre><div node="[object Object]" class="relative whitespace-pre-wrap word-break-all p-3 my-2 rounded-sm bg-list-hover-subtle"><div><div class="code-block"><div class="code-line" data-line-number="1" data-line-start="1" data-line-end="1"><div class="line-content"><span class="mtk14"><</span><span class="mtk6">body</span></div></div><div class="code-line" data-line-number="2" data-line-start="2" data-line-end="2"><div class="line-content"><span class="mtk1"></span><span class="mtk10">data-modulo</span><span class="mtk1">=</span><span class="mtk12">"RESUMEN"</span></div></div><div class="code-line" data-line-number="3" data-line-start="3" data-line-end="3"><div class="line-content"><span class="mtk1"></span><span class="mtk10">data-modulo-alias</span><span class="mtk1">=</span><span class="mtk12">"Resumen"</span></div></div><div class="code-line" data-line-number="4" data-line-start="4" data-line-end="4"><div class="line-content"><span class="mtk1"></span><span class="mtk10">data-modulo-id</span><span class="mtk1">=</span><span class="mtk12">"RESUMEN"</span></div></div><div class="code-line" data-line-number="5" data-line-start="5" data-line-end="5"><div class="line-content"><span class="mtk14">></span></div></div></div></div></div></pre>

### Scripts cargados (Orden)

1. `js/sesion.js`
2. Bootstrap 5.3.3
3. js/flujo-autorizacion.js
4. js/resumen-view.js

### ✅ Estado de botones: **CORRECTO**

Todos los botones workflow están presentes con IDs estándar.

### ⚠️ Problema potencial detectado

- El archivo

  resumen-view.js implementa `window.CuentasModulo.setEditMode`, `getCambios`, y `cancelEdit` correctamente.

- Sin embargo, las **celdas editables solo aplican a cuenta y descripción** , no a valores de presupuesto.

---

## 📊 Panel: SUMMARY.html

### Elementos que SÍ se pueden editar

- ✅ **Cuenta** - Celda editable (

  createEditableCell)

- ✅ **Descripción** - Celda editable

### Elementos que NO se pueden editar

- ❌ **Real del mes** - Calculado desde saldos COI
- ❌ **Presupuesto del mes** - De tabla PRESUPYY
- ❌ **Variaciones (B/W%)** - Calculadas
- ❌ **Datos YTD** - Calculados

### Configuración HTML

<pre><div node="[object Object]" class="relative whitespace-pre-wrap word-break-all p-3 my-2 rounded-sm bg-list-hover-subtle"><div><div class="code-block"><div class="code-line" data-line-number="1" data-line-start="1" data-line-end="1"><div class="line-content"><span class="mtk14"><</span><span class="mtk6">body</span><span class="mtk1"></span><span class="mtk10">data-modulo</span><span class="mtk1">=</span><span class="mtk12">"SUMMARY"</span><span class="mtk1"></span><span class="mtk10">data-modulo-id</span><span class="mtk1">=</span><span class="mtk12">"SUMMARY"</span><span class="mtk1"></span><span class="mtk10">data-tabla</span><span class="mtk1">=</span><span class="mtk12">"mainTable"</span><span class="mtk14">></span></div></div></div></div></div></pre>

### Scripts cargados (Orden)

1. `js/sesion.js`
2. Bootstrap 5.3.3
3. js/flujo-autorizacion.js
4. js/summary-view.js
5. Script inline para zoom e inicialización

### ✅ Estado de botones: **CORRECTO**

Todos los botones workflow presentes con IDs estándar.

### ⚠️ Problema potencial

- El botón `workflow-toggle` para abrir el drawer está **DENTRO** del `toolbar-actions` div, lo cual es correcto.
- summary-view.js implementa correctamente la interface `CuentasModulo`.

---

## 📊 Panel: Presupuestos.html

### Elementos que SÍ se pueden editar

- ✅ **Cuenta** - Via `CuentasModulo`
- ✅ **Descripción** - Via `CuentasModulo`
- ✅ **Valores de presupuesto por mes** - Celdas con clase `editable` cuando modo edición activo

### Elementos que NO se pueden editar

- ❌ **Valores reales** - Provienen de COI
- ❌ **Totales acumulados** - Calculados
- ❌ **Encabezados de tabla**

### Configuración HTML

<pre><div node="[object Object]" class="relative whitespace-pre-wrap word-break-all p-3 my-2 rounded-sm bg-list-hover-subtle"><div><div class="code-block"><div class="code-line" data-line-number="1" data-line-start="1" data-line-end="1"><div class="line-content"><span class="mtk14"><</span><span class="mtk6">body</span><span class="mtk1"></span><span class="mtk10">data-modulo</span><span class="mtk1">=</span><span class="mtk12">"Presupuestos"</span><span class="mtk1"></span><span class="mtk10">data-modulo-alias</span><span class="mtk1">=</span><span class="mtk12">"Presupuestos"</span><span class="mtk1"></span><span class="mtk10">data-modulo-id</span><span class="mtk1">=</span><span class="mtk12">"presupuestos"</span><span class="mtk14">></span></div></div></div></div></div></pre>

### Scripts cargados (Orden)

1. `js/sesion.js`
2. `js/capitulos-modulos.js`
3. `js/cuentas-data.js`
4. `js/cuentas-modulo.js`
5. Bootstrap 5.3.3
6. js/planeacion-modulo-vista.js
7. js/flujo-autorizacion.js
8. Script inline:
   <pre><div node="[object Object]" class="relative whitespace-pre-wrap word-break-all p-3 my-2 rounded-sm bg-list-hover-subtle"><div><div class="code-block"><div class="code-line" data-line-number="1" data-line-start="1" data-line-end="1"><div class="line-content"><span class="mtk1">(</span><span class="mtk6">async</span><span class="mtk1"> () </span><span class="mtk6">=></span><span class="mtk1"> {</span></div></div><div class="code-line" data-line-number="2" data-line-start="2" data-line-end="2"><div class="line-content"><span class="mtk1"></span><span class="mtk6">const</span><span class="mtk1"></span><span class="mtk19">instancia</span><span class="mtk1"></span><span class="mtk3">=</span><span class="mtk1"></span><span class="mtk10">CuentasModulo</span><span class="mtk1">.</span><span class="mtk16">init</span><span class="mtk1">({ </span><span class="mtk10">moduloId:</span><span class="mtk1"></span><span class="mtk12">'presupuestos'</span><span class="mtk1"> });</span></div></div><div class="code-line" data-line-number="3" data-line-start="3" data-line-end="3"><div class="line-content"><span class="mtk1"></span><span class="mtk18">await</span><span class="mtk1"></span><span class="mtk10">instancia</span><span class="mtk1">.</span><span class="mtk10">ready</span><span class="mtk1">;</span></div></div><div class="code-line" data-line-number="4" data-line-start="4" data-line-end="4"><div class="line-content"><span class="mtk1"></span><span class="mtk16">initVistaModuloPlaneacion</span><span class="mtk1">();</span></div></div><div class="code-line" data-line-number="5" data-line-start="5" data-line-end="5"><div class="line-content"><span class="mtk1">})();</span></div></div></div></div></div></pre>

### ✅ Estado de botones: **CORRECTO**

### ⚠️ Diferencia importante

A diferencia de RESUMEN y SUMMARY, Presupuestos.html usa el sistema completo `CuentasModulo` que permite edición real de valores de presupuesto en las celdas.

---

## 📊 Módulos Departamentales (Finanzas, VPE, Comités, etc.)

### Estructura común

Todos los módulos departamentales siguen el mismo patrón que

Presupuestos.html:

<pre><div node="[object Object]" class="relative whitespace-pre-wrap word-break-all p-3 my-2 rounded-sm bg-list-hover-subtle"><div><div class="code-block"><div class="code-line" data-line-number="1" data-line-start="1" data-line-end="1"><div class="line-content"><span class="mtk14"><</span><span class="mtk6">body</span><span class="mtk1"></span><span class="mtk10">data-modulo</span><span class="mtk1">=</span><span class="mtk12">"[NombreModulo]"</span><span class="mtk1"></span><span class="mtk10">data-modulo-alias</span><span class="mtk1">=</span><span class="mtk12">"[Alias]"</span><span class="mtk1"></span><span class="mtk10">data-modulo-id</span><span class="mtk1">=</span><span class="mtk12">"[id_modulo]"</span><span class="mtk14">></span></div></div></div></div></div></pre>

### Scripts requeridos

1. `js/sesion.js`
2. `js/capitulos-modulos.js`
3. `js/cuentas-data.js`
4. `js/cuentas-modulo.js`
5. Bootstrap 5.3.3
6. js/planeacion-modulo-vista.js
7. js/flujo-autorizacion.js

### ✅ Estado de botones: **CORRECTO** (ejemplo verificado:

Finanzas.html)

---

## 🔧 Problemas Detectados que Impiden Ver Borradores o Editar

### 1. **Centro de Borradores no se abre**

**Causa potencial:** Bootstrap no está cargado cuando se hace clic.

**Verificación en **

**flujo-autorizacion.js:**

<pre><div node="[object Object]" class="relative whitespace-pre-wrap word-break-all p-3 my-2 rounded-sm bg-list-hover-subtle"><div><div class="code-block"><div class="code-line" data-line-number="1" data-line-start="1" data-line-end="1"><div class="line-content"><span class="mtk10">async</span><span class="mtk1"></span><span class="mtk16">_mostrarCentroBorradores</span><span class="mtk1">() {</span></div></div><div class="code-line" data-line-number="2" data-line-start="2" data-line-end="2"><div class="line-content"><span class="mtk1"></span><span class="mtk6">const</span><span class="mtk1"></span><span class="mtk19">drawer</span><span class="mtk1"></span><span class="mtk3">=</span><span class="mtk1"></span><span class="mtk16">ensureDraftsDrawer</span><span class="mtk1">();</span></div></div><div class="code-line" data-line-number="3" data-line-start="3" data-line-end="3"><div class="line-content"><span class="mtk1"></span><span class="mtk18">if</span><span class="mtk1"> (</span><span class="mtk3">!</span><span class="mtk10">window</span><span class="mtk1">.</span><span class="mtk10">bootstrap</span><span class="mtk1">?.</span><span class="mtk10">Offcanvas</span><span class="mtk1">) {</span></div></div><div class="code-line" data-line-number="4" data-line-start="4" data-line-end="4"><div class="line-content"><span class="mtk1"></span><span class="mtk10">console</span><span class="mtk1">.</span><span class="mtk16">error</span><span class="mtk1">(</span><span class="mtk12">'[FlujoAutorizacion] Bootstrap.Offcanvas no está disponible'</span><span class="mtk1">);</span></div></div><div class="code-line" data-line-number="5" data-line-start="5" data-line-end="5"><div class="line-content"><span class="mtk1"></span><span class="mtk18">return</span><span class="mtk1">;</span></div></div><div class="code-line" data-line-number="6" data-line-start="6" data-line-end="6"><div class="line-content"><span class="mtk1">  }</span></div></div><div class="code-line" data-line-number="7" data-line-start="7" data-line-end="7"><div class="line-content"><span class="mtk1"></span><span class="mtk5">// ...</span></div></div><div class="code-line" data-line-number="8" data-line-start="8" data-line-end="8"><div class="line-content"><span class="mtk1">}</span></div></div></div></div></div></pre>

**Solución:** Asegurar que Bootstrap se carga ANTES de

flujo-autorizacion.js.

### 2. **Botón "Centro de borradores" oculto**

**Ubicación del problema:** Líneas 1334-1337 en

flujo-autorizacion.js:

<pre><div node="[object Object]" class="relative whitespace-pre-wrap word-break-all p-3 my-2 rounded-sm bg-list-hover-subtle"><div><div class="code-block"><div class="code-line" data-line-number="1" data-line-start="1" data-line-end="1"><div class="line-content"><span class="mtk18">if</span><span class="mtk1"> (</span><span class="mtk6">this</span><span class="mtk1">.</span><span class="mtk10">buttons</span><span class="mtk1">.</span><span class="mtk10">verBorrador</span><span class="mtk1">) {</span></div></div><div class="code-line" data-line-number="2" data-line-start="2" data-line-end="2"><div class="line-content"><span class="mtk1"></span><span class="mtk6">this</span><span class="mtk1">.</span><span class="mtk10">buttons</span><span class="mtk1">.</span><span class="mtk10">verBorrador</span><span class="mtk1">.</span><span class="mtk10">classList</span><span class="mtk1">.</span><span class="mtk16">remove</span><span class="mtk1">(</span><span class="mtk12">'d-none'</span><span class="mtk1">);</span></div></div><div class="code-line" data-line-number="3" data-line-start="3" data-line-end="3"><div class="line-content"><span class="mtk1"></span><span class="mtk6">this</span><span class="mtk1">.</span><span class="mtk10">buttons</span><span class="mtk1">.</span><span class="mtk10">verBorrador</span><span class="mtk1">.</span><span class="mtk10">disabled</span><span class="mtk1"></span><span class="mtk3">=</span><span class="mtk1"></span><span class="mtk6">false</span><span class="mtk1">;</span></div></div><div class="code-line" data-line-number="4" data-line-start="4" data-line-end="4"><div class="line-content"><span class="mtk1">}</span></div></div></div></div></div></pre>

**Estado:** ✅ El botón siempre debe mostrarse. Si no se ve, verificar que el ID es exactamente `btnVerBorrador`.

### 3. **Celdas no se marcan como editables**

**Requisitos para edición:**

1. Fila debe tener `data-cuenta21` o `data-cuenta`
2. Celda debe tener `data-columna-clave`
3. `editMode` debe ser `true`
4. Celda debe tener clase `editable-cell`

**Verificación en **

\*\*resumen-view.js y

summary-view.js:\*\*

- Función

  sincronizarCeldasEditables() busca `.editable-cell`

- Activa `contentEditable = 'true'` cuando `editMode = true`

### 4. **Borradores no se pintan en la tabla**

**Método responsable:** `FlujoAutorizacion.pintarBorrador(tabla, datosBorrador)`

**Requisitos:**

1. Filas deben tener `data-cuenta21` o `data-cuenta`
2. Celdas deben tener `data-columna-clave`
3. Los valores del borrador deben coincidir con las cuentas de la tabla

**Código crítico:**

<pre><div node="[object Object]" class="relative whitespace-pre-wrap word-break-all p-3 my-2 rounded-sm bg-list-hover-subtle"><div><div class="code-block"><div class="code-line" data-line-number="1" data-line-start="1" data-line-end="1"><div class="line-content"><span class="mtk6">const</span><span class="mtk1"></span><span class="mtk19">claveTabla</span><span class="mtk1"></span><span class="mtk3">=</span><span class="mtk1"></span><span class="mtk16">normalizar</span><span class="mtk1">(</span><span class="mtk10">fila</span><span class="mtk1">.</span><span class="mtk10">dataset</span><span class="mtk1">.</span><span class="mtk10">cuenta21</span><span class="mtk1"></span><span class="mtk3">||</span><span class="mtk1"></span><span class="mtk10">fila</span><span class="mtk1">.</span><span class="mtk10">dataset</span><span class="mtk1">.</span><span class="mtk10">cuenta</span><span class="mtk1"></span><span class="mtk3">||</span><span class="mtk1"></span><span class="mtk12">''</span><span class="mtk1">);</span></div></div><div class="code-line" data-line-number="2" data-line-start="2" data-line-end="2"><div class="line-content"><span class="mtk6">const</span><span class="mtk1"></span><span class="mtk19">valores</span><span class="mtk1"></span><span class="mtk3">=</span><span class="mtk1"></span><span class="mtk10">mapaCambios</span><span class="mtk1">.</span><span class="mtk16">get</span><span class="mtk1">(</span><span class="mtk10">claveTabla</span><span class="mtk1">);</span></div></div><div class="code-line" data-line-number="3" data-line-start="3" data-line-end="3"><div class="line-content"><span class="mtk5">// Si no hay match, la celda no se pinta</span></div></div></div></div></div></pre>

### 5. **Contexto incompleto impide cargar borradores**

**Método de verificación:**

\_contextoCompleto()

<pre><div node="[object Object]" class="relative whitespace-pre-wrap word-break-all p-3 my-2 rounded-sm bg-list-hover-subtle"><div><div class="code-block"><div class="code-line" data-line-number="1" data-line-start="1" data-line-end="1"><div class="line-content"><span class="mtk16">_contextoCompleto</span><span class="mtk1">() {</span></div></div><div class="code-line" data-line-number="2" data-line-start="2" data-line-end="2"><div class="line-content"><span class="mtk1"></span><span class="mtk6">this</span><span class="mtk1">.</span><span class="mtk16">_hidratarContextoInicial</span><span class="mtk1">();</span></div></div><div class="code-line" data-line-number="3" data-line-start="3" data-line-end="3"><div class="line-content"><span class="mtk1"></span><span class="mtk18">return</span><span class="mtk1"></span><span class="mtk6">this</span><span class="mtk1">.</span><span class="mtk10">contexto</span><span class="mtk1">.</span><span class="mtk10">empresaId</span><span class="mtk1"></span><span class="mtk3">&&</span><span class="mtk1"></span><span class="mtk6">this</span><span class="mtk1">.</span><span class="mtk10">contexto</span><span class="mtk1">.</span><span class="mtk10">anio</span><span class="mtk1"></span><span class="mtk3">&&</span><span class="mtk1"></span><span class="mtk6">this</span><span class="mtk1">.</span><span class="mtk10">contexto</span><span class="mtk1">.</span><span class="mtk10">modulo</span><span class="mtk1">;</span></div></div><div class="code-line" data-line-number="4" data-line-start="4" data-line-end="4"><div class="line-content"><span class="mtk1">}</span></div></div></div></div></div></pre>

**Si falta alguno:**

- `empresaId` - Se obtiene de `Sesion.obtenerEmpresaActiva()`
- `anio` - Se obtiene de selectores (`selectAnio`, `resumenYearSelect`, etc.)
- `modulo` - Se obtiene de `document.body.dataset.modulo`

---

## ✅ Requisitos Mínimos por HTML para Modo Edición

### Para RESUMEN.html / SUMMARY.html

<pre><div node="[object Object]" class="relative whitespace-pre-wrap word-break-all p-3 my-2 rounded-sm bg-list-hover-subtle"><div><div class="code-block"><div class="code-line" data-line-number="1" data-line-start="1" data-line-end="1"><div class="line-content"><span class="mtk5"><!-- Body tag --></span></div></div><div class="code-line" data-line-number="2" data-line-start="2" data-line-end="2"><div class="line-content"><span class="mtk14"><</span><span class="mtk6">body</span><span class="mtk1"></span><span class="mtk10">data-modulo</span><span class="mtk1">=</span><span class="mtk12">"RESUMEN"</span><span class="mtk1"></span><span class="mtk10">data-modulo-id</span><span class="mtk1">=</span><span class="mtk12">"RESUMEN"</span><span class="mtk14">></span></div></div><div class="code-line" data-line-number="3" data-line-start="3" data-line-end="3"><div class="line-content"><span class="mtk1"></span></div></div><div class="code-line" data-line-number="4" data-line-start="4" data-line-end="4"><div class="line-content"><span class="mtk5"><!-- Botones obligatorios --></span></div></div><div class="code-line" data-line-number="5" data-line-start="5" data-line-end="5"><div class="line-content"><span class="mtk14"><</span><span class="mtk6">button</span><span class="mtk1"></span><span class="mtk10">id</span><span class="mtk1">=</span><span class="mtk12">"btnGuardarBorrador"</span><span class="mtk1"></span><span class="mtk10">class</span><span class="mtk1">=</span><span class="mtk12">"d-none"</span><span class="mtk14">></span><span class="mtk1">...</span><span class="mtk14"></</span><span class="mtk6">button</span><span class="mtk14">></span></div></div><div class="code-line" data-line-number="6" data-line-start="6" data-line-end="6"><div class="line-content"><span class="mtk14"><</span><span class="mtk6">button</span><span class="mtk1"></span><span class="mtk10">id</span><span class="mtk1">=</span><span class="mtk12">"btnEnviarCambios"</span><span class="mtk1"></span><span class="mtk10">class</span><span class="mtk1">=</span><span class="mtk12">"d-none"</span><span class="mtk14">></span><span class="mtk1">...</span><span class="mtk14"></</span><span class="mtk6">button</span><span class="mtk14">></span></div></div><div class="code-line" data-line-number="7" data-line-start="7" data-line-end="7"><div class="line-content"><span class="mtk14"><</span><span class="mtk6">button</span><span class="mtk1"></span><span class="mtk10">id</span><span class="mtk1">=</span><span class="mtk12">"btnCancelarEdicion"</span><span class="mtk1"></span><span class="mtk10">class</span><span class="mtk1">=</span><span class="mtk12">"d-none"</span><span class="mtk14">></span><span class="mtk1">...</span><span class="mtk14"></</span><span class="mtk6">button</span><span class="mtk14">></span></div></div><div class="code-line" data-line-number="8" data-line-start="8" data-line-end="8"><div class="line-content"><span class="mtk14"><</span><span class="mtk6">button</span><span class="mtk1"></span><span class="mtk10">id</span><span class="mtk1">=</span><span class="mtk12">"btnMarcarRevisado"</span><span class="mtk1"></span><span class="mtk10">class</span><span class="mtk1">=</span><span class="mtk12">"d-none"</span><span class="mtk14">></span><span class="mtk1">...</span><span class="mtk14"></</span><span class="mtk6">button</span><span class="mtk14">></span></div></div><div class="code-line" data-line-number="9" data-line-start="9" data-line-end="9"><div class="line-content"><span class="mtk14"><</span><span class="mtk6">button</span><span class="mtk1"></span><span class="mtk10">id</span><span class="mtk1">=</span><span class="mtk12">"btnAutorizar"</span><span class="mtk1"></span><span class="mtk10">class</span><span class="mtk1">=</span><span class="mtk12">"d-none"</span><span class="mtk14">></span><span class="mtk1">...</span><span class="mtk14"></</span><span class="mtk6">button</span><span class="mtk14">></span></div></div><div class="code-line" data-line-number="10" data-line-start="10" data-line-end="10"><div class="line-content"><span class="mtk14"><</span><span class="mtk6">button</span><span class="mtk1"></span><span class="mtk10">id</span><span class="mtk1">=</span><span class="mtk12">"btnRechazar"</span><span class="mtk1"></span><span class="mtk10">class</span><span class="mtk1">=</span><span class="mtk12">"d-none"</span><span class="mtk14">></span><span class="mtk1">...</span><span class="mtk14"></</span><span class="mtk6">button</span><span class="mtk14">></span></div></div><div class="code-line" data-line-number="11" data-line-start="11" data-line-end="11"><div class="line-content"><span class="mtk14"><</span><span class="mtk6">button</span><span class="mtk1"></span><span class="mtk10">id</span><span class="mtk1">=</span><span class="mtk12">"btnVerBorrador"</span><span class="mtk1"></span><span class="mtk10">class</span><span class="mtk1">=</span><span class="mtk12">"d-none"</span><span class="mtk14">></span><span class="mtk1">...</span><span class="mtk14"></</span><span class="mtk6">button</span><span class="mtk14">></span></div></div><div class="code-line" data-line-number="12" data-line-start="12" data-line-end="12"><div class="line-content"><span class="mtk14"><</span><span class="mtk6">button</span><span class="mtk1"></span><span class="mtk10">id</span><span class="mtk1">=</span><span class="mtk12">"saveBudgetBtn"</span><span class="mtk1"></span><span class="mtk10">class</span><span class="mtk1">=</span><span class="mtk12">"d-none"</span><span class="mtk14">></span><span class="mtk1">...</span><span class="mtk14"></</span><span class="mtk6">button</span><span class="mtk14">></span></div></div><div class="code-line" data-line-number="13" data-line-start="13" data-line-end="13"><div class="line-content"><span class="mtk1"></span></div></div><div class="code-line" data-line-number="14" data-line-start="14" data-line-end="14"><div class="line-content"><span class="mtk5"><!-- Drawer para historial --></span></div></div><div class="code-line" data-line-number="15" data-line-start="15" data-line-end="15"><div class="line-content"><span class="mtk14"><</span><span class="mtk6">div</span><span class="mtk1"></span><span class="mtk10">id</span><span class="mtk1">=</span><span class="mtk12">"workflowDrawer"</span><span class="mtk1"></span><span class="mtk10">class</span><span class="mtk1">=</span><span class="mtk12">"offcanvas offcanvas-end"</span><span class="mtk14">></span><span class="mtk1">...</span><span class="mtk14"></</span><span class="mtk6">div</span><span class="mtk14">></span></div></div><div class="code-line" data-line-number="16" data-line-start="16" data-line-end="16"><div class="line-content"><span class="mtk1"></span></div></div><div class="code-line" data-line-number="17" data-line-start="17" data-line-end="17"><div class="line-content"><span class="mtk5"><!-- Toast para notificaciones --></span></div></div><div class="code-line" data-line-number="18" data-line-start="18" data-line-end="18"><div class="line-content"><span class="mtk14"><</span><span class="mtk6">div</span><span class="mtk1"></span><span class="mtk10">id</span><span class="mtk1">=</span><span class="mtk12">"actionToast"</span><span class="mtk1"></span><span class="mtk10">class</span><span class="mtk1">=</span><span class="mtk12">"toast"</span><span class="mtk14">></span><span class="mtk1">...</span><span class="mtk14"></</span><span class="mtk6">div</span><span class="mtk14">></span></div></div><div class="code-line" data-line-number="19" data-line-start="19" data-line-end="19"><div class="line-content"><span class="mtk1"></span></div></div><div class="code-line" data-line-number="20" data-line-start="20" data-line-end="20"><div class="line-content"><span class="mtk5"><!-- Badge de estado --></span></div></div><div class="code-line" data-line-number="21" data-line-start="21" data-line-end="21"><div class="line-content"><span class="mtk14"><</span><span class="mtk6">div</span><span class="mtk1"></span><span class="mtk10">id</span><span class="mtk1">=</span><span class="mtk12">"workflowBadge"</span><span class="mtk14">></span><span class="mtk1">Sin cargar</span><span class="mtk14"></</span><span class="mtk6">div</span><span class="mtk14">></span></div></div><div class="code-line" data-line-number="22" data-line-start="22" data-line-end="22"><div class="line-content"><span class="mtk14"><</span><span class="mtk6">p</span><span class="mtk1"></span><span class="mtk10">id</span><span class="mtk1">=</span><span class="mtk12">"workflowMeta"</span><span class="mtk14">></</span><span class="mtk6">p</span><span class="mtk14">></span></div></div><div class="code-line" data-line-number="23" data-line-start="23" data-line-end="23"><div class="line-content"><span class="mtk1"></span></div></div><div class="code-line" data-line-number="24" data-line-start="24" data-line-end="24"><div class="line-content"><span class="mtk5"><!-- Scripts en orden --></span></div></div><div class="code-line" data-line-number="25" data-line-start="25" data-line-end="25"><div class="line-content"><span class="mtk14"><</span><span class="mtk6">script</span><span class="mtk3"></span><span class="mtk10">src</span><span class="mtk3">=</span><span class="mtk12">"js/sesion.js"</span><span class="mtk14">></</span><span class="mtk6">script</span><span class="mtk14">></span></div></div><div class="code-line" data-line-number="26" data-line-start="26" data-line-end="26"><div class="line-content"><span class="mtk14"><</span><span class="mtk6">script</span><span class="mtk3"></span><span class="mtk10">src</span><span class="mtk3">=</span><span class="mtk12">"bootstrap.bundle.min.js"</span><span class="mtk14">></</span><span class="mtk6">script</span><span class="mtk14">></span></div></div><div class="code-line" data-line-number="27" data-line-start="27" data-line-end="27"><div class="line-content"><span class="mtk14"><</span><span class="mtk6">script</span><span class="mtk3"></span><span class="mtk10">src</span><span class="mtk3">=</span><span class="mtk12">"js/flujo-autorizacion.js"</span><span class="mtk14">></</span><span class="mtk6">script</span><span class="mtk14">></span></div></div><div class="code-line" data-line-number="28" data-line-start="28" data-line-end="28"><div class="line-content"><span class="mtk14"><</span><span class="mtk6">script</span><span class="mtk3"></span><span class="mtk10">src</span><span class="mtk3">=</span><span class="mtk12">"js/resumen-view.js"</span><span class="mtk14">></</span><span class="mtk6">script</span><span class="mtk14">></span></div></div></div></div></div></pre>

### Para módulos departamentales (Presupuestos, Finanzas, etc.)

<pre><div node="[object Object]" class="relative whitespace-pre-wrap word-break-all p-3 my-2 rounded-sm bg-list-hover-subtle"><div><div class="code-block"><div class="code-line" data-line-number="1" data-line-start="1" data-line-end="1"><div class="line-content"><span class="mtk5"><!-- Body tag --></span></div></div><div class="code-line" data-line-number="2" data-line-start="2" data-line-end="2"><div class="line-content"><span class="mtk14"><</span><span class="mtk6">body</span><span class="mtk1"></span><span class="mtk10">data-modulo</span><span class="mtk1">=</span><span class="mtk12">"Finanzas"</span><span class="mtk1"></span><span class="mtk10">data-modulo-alias</span><span class="mtk1">=</span><span class="mtk12">"Finanzas"</span><span class="mtk1"></span><span class="mtk10">data-modulo-id</span><span class="mtk1">=</span><span class="mtk12">"finanzas"</span><span class="mtk14">></span></div></div><div class="code-line" data-line-number="3" data-line-start="3" data-line-end="3"><div class="line-content"><span class="mtk1"></span></div></div><div class="code-line" data-line-number="4" data-line-start="4" data-line-end="4"><div class="line-content"><span class="mtk5"><!-- Tabla con ID específico --></span></div></div><div class="code-line" data-line-number="5" data-line-start="5" data-line-end="5"><div class="line-content"><span class="mtk14"><</span><span class="mtk6">table</span><span class="mtk1"></span><span class="mtk10">id</span><span class="mtk1">=</span><span class="mtk12">"tablaComparacion"</span><span class="mtk14">></span></div></div><div class="code-line" data-line-number="6" data-line-start="6" data-line-end="6"><div class="line-content"><span class="mtk1"></span><span class="mtk14"><</span><span class="mtk6">tbody</span><span class="mtk1"></span><span class="mtk10">id</span><span class="mtk1">=</span><span class="mtk12">"tablaCuentasBody"</span><span class="mtk14">></span><span class="mtk1">...</span><span class="mtk14"></</span><span class="mtk6">tbody</span><span class="mtk14">></span></div></div><div class="code-line" data-line-number="7" data-line-start="7" data-line-end="7"><div class="line-content"><span class="mtk14"></</span><span class="mtk6">table</span><span class="mtk14">></span></div></div><div class="code-line" data-line-number="8" data-line-start="8" data-line-end="8"><div class="line-content"><span class="mtk1"></span></div></div><div class="code-line" data-line-number="9" data-line-start="9" data-line-end="9"><div class="line-content"><span class="mtk5"><!-- Scripts adicionales requeridos --></span></div></div><div class="code-line" data-line-number="10" data-line-start="10" data-line-end="10"><div class="line-content"><span class="mtk14"><</span><span class="mtk6">script</span><span class="mtk3"></span><span class="mtk10">src</span><span class="mtk3">=</span><span class="mtk12">"js/capitulos-modulos.js"</span><span class="mtk14">></</span><span class="mtk6">script</span><span class="mtk14">></span></div></div><div class="code-line" data-line-number="11" data-line-start="11" data-line-end="11"><div class="line-content"><span class="mtk14"><</span><span class="mtk6">script</span><span class="mtk3"></span><span class="mtk10">src</span><span class="mtk3">=</span><span class="mtk12">"js/cuentas-data.js"</span><span class="mtk14">></</span><span class="mtk6">script</span><span class="mtk14">></span></div></div><div class="code-line" data-line-number="12" data-line-start="12" data-line-end="12"><div class="line-content"><span class="mtk14"><</span><span class="mtk6">script</span><span class="mtk3"></span><span class="mtk10">src</span><span class="mtk3">=</span><span class="mtk12">"js/cuentas-modulo.js"</span><span class="mtk14">></</span><span class="mtk6">script</span><span class="mtk14">></span></div></div><div class="code-line" data-line-number="13" data-line-start="13" data-line-end="13"><div class="line-content"><span class="mtk14"><</span><span class="mtk6">script</span><span class="mtk3"></span><span class="mtk10">src</span><span class="mtk3">=</span><span class="mtk12">"js/planeacion-modulo-vista.js"</span><span class="mtk14">></</span><span class="mtk6">script</span><span class="mtk14">></span></div></div></div></div></div></pre>

---

## 📋 Matriz de Capacidades de Edición

| Módulo       | Cuenta | Descripción | Ppto. Mensual | Valores Real | Totales |
| ------------ | ------ | ----------- | ------------- | ------------ | ------- |
| RESUMEN      | ✅     | ✅          | ❌            | ❌           | ❌      |
| SUMMARY      | ✅     | ✅          | ❌            | ❌           | ❌      |
| Presupuestos | ✅     | ✅          | ✅            | ❌           | ❌      |
| Finanzas     | ✅     | ✅          | ✅            | ❌           | ❌      |
| Otros Dptos. | ✅     | ✅          | ✅            | ❌           | ❌      |

---

## 🔍 Checklist de Troubleshooting

### Si los borradores no se ven:

- [ ] Verificar que `btnVerBorrador` existe y tiene el ID exacto
- [ ] Verificar que Bootstrap está cargado antes de

  flujo-autorizacion.js

- [ ] Verificar que el contexto está completo (empresa, año, módulo)
- [ ] Revisar consola para errores de `[FlujoAutorizacion]`

### Si las celdas no se pueden editar:

- [ ] Verificar que la celda tiene clase `editable-cell`
- [ ] Verificar que la celda tiene `data-columna-clave`
- [ ] Verificar que la fila tiene `data-cuenta21` o `data-cuenta`
- [ ] Verificar que `editMode = true` (llamar `CuentasModulo.setEditMode(true)`)

### Si los cambios no se guardan:

- [ ] Verificar que `CuentasModulo.getCambios()` retorna datos
- [ ] Verificar headers de autenticación (`Sesion.headersAutenticacion()`)
- [ ] Verificar endpoint `/api/borradores/guardar`

---

## Conclusiones

1. **RESUMEN y SUMMARY** solo permiten editar cuenta y descripción, NO valores numéricos
2. **Presupuestos y módulos departamentales** permiten editar valores de presupuesto
3. **Todos los botones** tienen los IDs correctos en los archivos analizados
4. **Bootstrap debe cargarse ANTES** de

   flujo-autorizacion.js

5. **El Centro de Borradores** requiere contexto completo para funcionar
