# Análisis Exhaustivo del Programa SummaCham

## Resumen Ejecutivo

Este documento contiene el análisis completo del programa SummaCham, identificando todos los errores, problemas de integración, y las correcciones necesarias para lograr un funcionamiento 100% funcional.

---

## 1. Errores Críticos Identificados

### 1.1 Error de Electron en Consola

<pre><div node="[object Object]" class="relative whitespace-pre-wrap word-break-all p-3 my-2 rounded-sm bg-list-hover-subtle"><div><div class="code-block"><div class="code-line" data-line-number="1" data-line-start="1" data-line-end="1"><div class="line-content"><span class="mtk1">ERROR:CONSOLE:2 "Electron sandboxed_renderer.bundle.js script failed to run"</span></div></div><div class="code-line" data-line-number="2" data-line-start="2" data-line-end="2"><div class="line-content"><span class="mtk1">TypeError: object is not iterable (cannot read property Symbol(Symbol.iterator)on protocol_client.js)</span></div></div></div></div></div></pre>

**Causa** : Problema con la inicialización del sandbox de Electron o incompatibilidad de versiones.

**Corrección** :

<pre><div node="[object Object]" class="relative whitespace-pre-wrap word-break-all p-3 my-2 rounded-sm bg-list-hover-subtle"><div><div class="code-block"><div class="code-line" data-line-number="1" data-line-start="1" data-line-end="1"><div class="line-content"><span class="mtk5">// main.js - Agregar configuración de webPreferences</span></div></div><div class="code-line" data-line-number="2" data-line-start="2" data-line-end="2"><div class="line-content"><span class="mtk6">const</span><span class="mtk1"></span><span class="mtk19">mainWindow</span><span class="mtk1"></span><span class="mtk3">=</span><span class="mtk1"></span><span class="mtk6">new</span><span class="mtk1"></span><span class="mtk16">BrowserWindow</span><span class="mtk1">({</span></div></div><div class="code-line" data-line-number="3" data-line-start="3" data-line-end="3"><div class="line-content"><span class="mtk1"></span><span class="mtk5">// ... existing options</span></div></div><div class="code-line" data-line-number="4" data-line-start="4" data-line-end="4"><div class="line-content"><span class="mtk1"></span><span class="mtk10">webPreferences:</span><span class="mtk1"> {</span></div></div><div class="code-line" data-line-number="5" data-line-start="5" data-line-end="5"><div class="line-content"><span class="mtk1"></span><span class="mtk10">nodeIntegration:</span><span class="mtk1"></span><span class="mtk6">false</span><span class="mtk1">,</span></div></div><div class="code-line" data-line-number="6" data-line-start="6" data-line-end="6"><div class="line-content"><span class="mtk1"></span><span class="mtk10">contextIsolation:</span><span class="mtk1"></span><span class="mtk6">true</span><span class="mtk1">,</span></div></div><div class="code-line" data-line-number="7" data-line-start="7" data-line-end="7"><div class="line-content"><span class="mtk1"></span><span class="mtk10">sandbox:</span><span class="mtk1"></span><span class="mtk6">true</span></div></div><div class="code-line" data-line-number="8" data-line-start="8" data-line-end="8"><div class="line-content"><span class="mtk1">  }</span></div></div><div class="code-line" data-line-number="9" data-line-start="9" data-line-end="9"><div class="line-content"><span class="mtk1">});</span></div></div></div></div></div></pre>

---

### 1.2 Problema de usuario actual no definido

**Archivo** :

flujo-autorizacion.js - Línea 379

<pre><div node="[object Object]" class="relative whitespace-pre-wrap word-break-all p-3 my-2 rounded-sm bg-list-hover-subtle"><div><div class="code-block"><div class="code-line" data-line-number="1" data-line-start="1" data-line-end="1"><div class="line-content"><span class="mtk6">this</span><span class="mtk1">.</span><span class="mtk10">usuarioActual</span><span class="mtk1"></span><span class="mtk3">=</span><span class="mtk1"></span><span class="mtk10">window</span><span class="mtk1">.</span><span class="mtk10">Sesion</span><span class="mtk1">?.</span><span class="mtk16">obtenerDatosUsuario</span><span class="mtk1">?.() </span><span class="mtk3">||</span><span class="mtk1"> {};</span></div></div></div></div></div></pre>

**Problema** : `Sesion.obtenerDatosUsuario()` **NO EXISTE** en

sesion.js. El método correcto es obtener el usuario desde la sesión.

**Corrección** :

<pre><div node="[object Object]" class="relative whitespace-pre-wrap word-break-all p-3 my-2 rounded-sm bg-list-hover-subtle"><div><div class="code-block"><div class="code-line" data-line-number="1" data-line-start="1" data-line-end="1"><div class="line-content"><span class="mtk5">// En flujo-autorizacion.js, cambiar línea 379:</span></div></div><div class="code-line" data-line-number="2" data-line-start="2" data-line-end="2"><div class="line-content"><span class="mtk6">this</span><span class="mtk1">.</span><span class="mtk10">usuarioActual</span><span class="mtk1"></span><span class="mtk3">=</span><span class="mtk1"></span><span class="mtk10">window</span><span class="mtk1">.</span><span class="mtk10">Sesion</span><span class="mtk1">?.</span><span class="mtk16">obtener</span><span class="mtk1">?.()?.</span><span class="mtk10">usuario</span><span class="mtk1"></span><span class="mtk3">||</span><span class="mtk1"> {};</span></div></div></div></div></div></pre>

---

### 1.3 Error en la referencia de `addAccountBtn`

**Archivo** :

cuentas-modulo.js - Línea 456

<pre><div node="[object Object]" class="relative whitespace-pre-wrap word-break-all p-3 my-2 rounded-sm bg-list-hover-subtle"><div><div class="code-block"><div class="code-line" data-line-number="1" data-line-start="1" data-line-end="1"><div class="line-content"><span class="mtk10">addAccountBtn</span><span class="mtk1">.</span><span class="mtk16">addEventListener</span><span class="mtk1">(</span><span class="mtk12">'click'</span><span class="mtk1">, () </span><span class="mtk6">=></span><span class="mtk1"> {</span></div></div><div class="code-line" data-line-number="2" data-line-start="2" data-line-end="2"><div class="line-content"><span class="mtk1"></span><span class="mtk10">accountsContainer</span><span class="mtk1">.</span><span class="mtk16">appendChild</span><span class="mtk1">(</span><span class="mtk16">crearCampoCuentaFormulario</span><span class="mtk1">());</span></div></div><div class="code-line" data-line-number="3" data-line-start="3" data-line-end="3"><div class="line-content"><span class="mtk1">});</span></div></div></div></div></div></pre>

**Problema** : `addAccountBtn` no está definido en ese contexto - debería ser del modal.

**Corrección** :

<pre><div node="[object Object]" class="relative whitespace-pre-wrap word-break-all p-3 my-2 rounded-sm bg-list-hover-subtle"><div><div class="code-block"><div class="code-line" data-line-number="1" data-line-start="1" data-line-end="1"><div class="line-content"><span class="mtk5">// Ya está definido en línea 477 pero usado incorrectamente</span></div></div><div class="code-line" data-line-number="2" data-line-start="2" data-line-end="2"><div class="line-content"><span class="mtk6">const</span><span class="mtk1"></span><span class="mtk19">addAccountBtn</span><span class="mtk1"></span><span class="mtk3">=</span><span class="mtk1"></span><span class="mtk10">modal</span><span class="mtk1">.</span><span class="mtk16">querySelector</span><span class="mtk1">(</span><span class="mtk12">'#sectionAddAccountBtn'</span><span class="mtk1">);</span></div></div><div class="code-line" data-line-number="3" data-line-start="3" data-line-end="3"><div class="line-content"><span class="mtk18">if</span><span class="mtk1"> (</span><span class="mtk10">addAccountBtn</span><span class="mtk1">) {</span></div></div><div class="code-line" data-line-number="4" data-line-start="4" data-line-end="4"><div class="line-content"><span class="mtk1"></span><span class="mtk10">addAccountBtn</span><span class="mtk1">.</span><span class="mtk16">addEventListener</span><span class="mtk1">(</span><span class="mtk12">'click'</span><span class="mtk1">, () </span><span class="mtk6">=></span><span class="mtk1"> {</span></div></div><div class="code-line" data-line-number="5" data-line-start="5" data-line-end="5"><div class="line-content"><span class="mtk1"></span><span class="mtk10">accountsContainer</span><span class="mtk1">.</span><span class="mtk16">appendChild</span><span class="mtk1">(</span><span class="mtk16">crearCampoCuentaFormulario</span><span class="mtk1">());</span></div></div><div class="code-line" data-line-number="6" data-line-start="6" data-line-end="6"><div class="line-content"><span class="mtk1">  });</span></div></div><div class="code-line" data-line-number="7" data-line-start="7" data-line-end="7"><div class="line-content"><span class="mtk1">}</span></div></div></div></div></div></pre>

---

## 2. Problemas de Integración del Flujo de Autorización

### 2.1 Conflicto de sistemas de workflow duplicados

**Problema crítico** : Existen **DOS** sistemas de workflow que compiten:

| Sistema       | Archivo                        | Descripción                    |
| ------------- | ------------------------------ | ------------------------------ |
| **Sistema 1** | **planeacion-modulo-vista.js** | Usa `/api/presupuestos/estado` |
| **Sistema 2** | **flujo-autorizacion.js**      | Usa `/api/borradores/*`        |

**Archivos afectados** :

- Presupuestos.html carga AMBOS scripts (líneas 415-416)
- Los botones pueden recibir doble evento

  **Corrección requerida** :

1. Usar **solo**

   flujo-autorizacion.js como sistema de workflow

2. Eliminar la lógica duplicada de

   planeacion-modulo-vista.js

---

### 2.2 Botones con IDs no estandarizados

**Problema** :

planeacion-modulo-vista.js busca IDs diferentes a los definidos en los HTML:

| En**planeacion-modulo-vista.js** | En HTML (IDs correctos) |
| -------------------------------- | ----------------------- |
| `loadBudgetBtn`                  | `btnGuardarBorrador`    |
| `reviewBudgetBtn`                | `btnMarcarRevisado`     |
| `authorizeBudgetBtn`             | `btnAutorizar`          |
| `saveBudgetBtn`                  | `saveBudgetBtn` ✓       |

**Corrección** : Migrar completamente a los IDs de

flujo-autorizacion.js:

<pre><div node="[object Object]" class="relative whitespace-pre-wrap word-break-all p-3 my-2 rounded-sm bg-list-hover-subtle"><div><div class="code-block"><div class="code-line" data-line-number="1" data-line-start="1" data-line-end="1"><div class="line-content"><span class="mtk5">// IDs correctos en flujo-autorizacion.js (líneas 389-399):</span></div></div><div class="code-line" data-line-number="2" data-line-start="2" data-line-end="2"><div class="line-content"><span class="mtk20">guardar</span><span class="mtk1">: </span><span class="mtk12">'btnGuardarBorrador'</span><span class="mtk1">,</span></div></div><div class="code-line" data-line-number="3" data-line-start="3" data-line-end="3"><div class="line-content"><span class="mtk20">enviar</span><span class="mtk1">: </span><span class="mtk12">'btnEnviarCambios'</span><span class="mtk1">,</span></div></div><div class="code-line" data-line-number="4" data-line-start="4" data-line-end="4"><div class="line-content"><span class="mtk20">cancelar</span><span class="mtk1">: </span><span class="mtk12">'btnCancelarEdicion'</span><span class="mtk1">,</span></div></div><div class="code-line" data-line-number="5" data-line-start="5" data-line-end="5"><div class="line-content"><span class="mtk20">verBorrador</span><span class="mtk1">: </span><span class="mtk12">'btnVerBorrador'</span><span class="mtk1">,</span></div></div><div class="code-line" data-line-number="6" data-line-start="6" data-line-end="6"><div class="line-content"><span class="mtk20">descartar</span><span class="mtk1">: </span><span class="mtk12">'btnDescartarBorrador'</span><span class="mtk1">,</span></div></div><div class="code-line" data-line-number="7" data-line-start="7" data-line-end="7"><div class="line-content"><span class="mtk20">autorizar</span><span class="mtk1">: </span><span class="mtk12">'btnAutorizar'</span><span class="mtk1">,</span></div></div><div class="code-line" data-line-number="8" data-line-start="8" data-line-end="8"><div class="line-content"><span class="mtk20">rechazar</span><span class="mtk1">: </span><span class="mtk12">'btnRechazar'</span><span class="mtk1">,</span></div></div><div class="code-line" data-line-number="9" data-line-start="9" data-line-end="9"><div class="line-content"><span class="mtk20">marcarRevisado</span><span class="mtk1">: </span><span class="mtk12">'btnMarcarRevisado'</span><span class="mtk1">,</span></div></div><div class="code-line" data-line-number="10" data-line-start="10" data-line-end="10"><div class="line-content"><span class="mtk20">guardarCOI</span><span class="mtk1">: </span><span class="mtk12">'saveBudgetBtn'</span></div></div></div></div></div></pre>

---

### 2.3 Contexto incompleto al iniciar

**Archivo** :

flujo-autorizacion.js - método

\_hidratarContextoInicial()

**Problema** : El año puede no estar disponible al momento de la inicialización si los selectores aún no han cargado sus opciones.

**Síntoma** : Los borradores no se cargan correctamente al inicio.

**Corrección** :

<pre><div node="[object Object]" class="relative whitespace-pre-wrap word-break-all p-3 my-2 rounded-sm bg-list-hover-subtle"><div><div class="code-block"><div class="code-line" data-line-number="1" data-line-start="1" data-line-end="1"><div class="line-content"><span class="mtk16">_hidratarContextoInicial</span><span class="mtk1">() {</span></div></div><div class="code-line" data-line-number="2" data-line-start="2" data-line-end="2"><div class="line-content"><span class="mtk1"></span><span class="mtk5">// ... existing code ...</span></div></div><div class="code-line" data-line-number="3" data-line-start="3" data-line-end="3"><div class="line-content"><span class="mtk1"></span></div></div><div class="code-line" data-line-number="4" data-line-start="4" data-line-end="4"><div class="line-content"><span class="mtk1"></span><span class="mtk5">// Agregar retry con delay</span></div></div><div class="code-line" data-line-number="5" data-line-start="5" data-line-end="5"><div class="line-content"><span class="mtk1"></span><span class="mtk18">if</span><span class="mtk1"> (</span><span class="mtk3">!</span><span class="mtk6">this</span><span class="mtk1">.</span><span class="mtk10">contexto</span><span class="mtk1">.</span><span class="mtk10">anio</span><span class="mtk1">) {</span></div></div><div class="code-line" data-line-number="6" data-line-start="6" data-line-end="6"><div class="line-content"><span class="mtk1"></span><span class="mtk16">setTimeout</span><span class="mtk1">(() </span><span class="mtk6">=></span><span class="mtk1"> {</span></div></div><div class="code-line" data-line-number="7" data-line-start="7" data-line-end="7"><div class="line-content"><span class="mtk1"></span><span class="mtk6">this</span><span class="mtk1">.</span><span class="mtk16">_hidratarContextoInicial</span><span class="mtk1">();</span></div></div><div class="code-line" data-line-number="8" data-line-start="8" data-line-end="8"><div class="line-content"><span class="mtk1"></span><span class="mtk6">this</span><span class="mtk1">.</span><span class="mtk16">_actualizarEstadoServidor</span><span class="mtk1">();</span></div></div><div class="code-line" data-line-number="9" data-line-start="9" data-line-end="9"><div class="line-content"><span class="mtk1">    }, </span><span class="mtk7">500</span><span class="mtk1">);</span></div></div><div class="code-line" data-line-number="10" data-line-start="10" data-line-end="10"><div class="line-content"><span class="mtk1">  }</span></div></div><div class="code-line" data-line-number="11" data-line-start="11" data-line-end="11"><div class="line-content"><span class="mtk1">}</span></div></div></div></div></div></pre>

---

## 3. Problemas del Modo Edición

### 3.1 Interface `CuentasModulo` incompleta

**Problema** : La interface `window.CuentasModulo` debe implementar estos métodos:

| Método                | Descripción                   | ¿Implementado? |
| --------------------- | ----------------------------- | -------------- |
| **setEditMode(flag)** | Activa/desactiva modo edición | ✓              |
| **getCambios()**      | Obtiene cambios pendientes    | ✓              |
| **cancelEdit()**      | Cancela la edición            | ✓              |

**Archivos que implementan la interface** :

- cuentas-modulo.js - ✓ Completo
- resumen-view.js - ✓ Completo
- summary-view.js - ✓ Completo

---

### 3.2 Celdas editables sin atributos correctos

**Problema** : Para que `FlujoAutorizacion.pintarBorrador()` funcione, las celdas deben tener:

<pre><div node="[object Object]" class="relative whitespace-pre-wrap word-break-all p-3 my-2 rounded-sm bg-list-hover-subtle"><div><div class="code-block"><div class="code-line" data-line-number="1" data-line-start="1" data-line-end="1"><div class="line-content"><span class="mtk5"><!-- Filas --></span></div></div><div class="code-line" data-line-number="2" data-line-start="2" data-line-end="2"><div class="line-content"><span class="mtk14"><</span><span class="mtk6">tr</span><span class="mtk1"></span><span class="mtk10">data-cuenta21</span><span class="mtk1">=</span><span class="mtk12">"cuentaCompleta"</span><span class="mtk1"></span><span class="mtk10">data-cuenta</span><span class="mtk1">=</span><span class="mtk12">"cuentaCorta"</span><span class="mtk14">></span></div></div><div class="code-line" data-line-number="3" data-line-start="3" data-line-end="3"><div class="line-content"><span class="mtk1"></span><span class="mtk5"><!-- Celdas --></span></div></div><div class="code-line" data-line-number="4" data-line-start="4" data-line-end="4"><div class="line-content"><span class="mtk1"></span><span class="mtk14"><</span><span class="mtk6">td</span><span class="mtk1"></span><span class="mtk10">data-columna-clave</span><span class="mtk1">=</span><span class="mtk12">"ene"</span><span class="mtk14">></span><span class="mtk1">123.45</span><span class="mtk14"></</span><span class="mtk6">td</span><span class="mtk14">></span></div></div><div class="code-line" data-line-number="5" data-line-start="5" data-line-end="5"><div class="line-content"><span class="mtk1"></span><span class="mtk14"><</span><span class="mtk6">td</span><span class="mtk1"></span><span class="mtk10">data-columna-clave</span><span class="mtk1">=</span><span class="mtk12">"feb"</span><span class="mtk14">></span><span class="mtk1">678.90</span><span class="mtk14"></</span><span class="mtk6">td</span><span class="mtk14">></span></div></div><div class="code-line" data-line-number="6" data-line-start="6" data-line-end="6"><div class="line-content"><span class="mtk14"></</span><span class="mtk6">tr</span><span class="mtk14">></span></div></div></div></div></div></pre>

**Verificar en cada módulo** :

- [ ]

  Presupuestos.html - Generadas dinámicamente por

  cuentas-modulo.js

- [ ]

  RESUMEN.html - Generadas por

  resumen-view.js

- [ ]

  SUMMARY.html - Generadas por

  summary-view.js

- [ ] Módulos departamentales - Generadas por

  cuentas-modulo.js

---

## 4. Problemas de Carga de Scripts

### 4.1 Orden de carga incorrecto en algunos HTML

**Problema crítico** : Bootstrap debe cargarse **ANTES** de

flujo-autorizacion.js.

**Orden correcto** (verificado en

Presupuestos.html):

<pre><div node="[object Object]" class="relative whitespace-pre-wrap word-break-all p-3 my-2 rounded-sm bg-list-hover-subtle"><div><div class="code-block"><div class="code-line" data-line-number="1" data-line-start="1" data-line-end="1"><div class="line-content"><span class="mtk14"><</span><span class="mtk6">script</span><span class="mtk3"></span><span class="mtk10">src</span><span class="mtk3">=</span><span class="mtk12">"js/sesion.js"</span><span class="mtk14">></</span><span class="mtk6">script</span><span class="mtk14">></span></div></div><div class="code-line" data-line-number="2" data-line-start="2" data-line-end="2"><div class="line-content"><span class="mtk14"><</span><span class="mtk6">script</span><span class="mtk3"></span><span class="mtk10">src</span><span class="mtk3">=</span><span class="mtk12">"js/capitulos-modulos.js"</span><span class="mtk14">></</span><span class="mtk6">script</span><span class="mtk14">></span></div></div><div class="code-line" data-line-number="3" data-line-start="3" data-line-end="3"><div class="line-content"><span class="mtk14"><</span><span class="mtk6">script</span><span class="mtk3"></span><span class="mtk10">src</span><span class="mtk3">=</span><span class="mtk12">"js/cuentas-data.js"</span><span class="mtk14">></</span><span class="mtk6">script</span><span class="mtk14">></span></div></div><div class="code-line" data-line-number="4" data-line-start="4" data-line-end="4"><div class="line-content"><span class="mtk14"><</span><span class="mtk6">script</span><span class="mtk3"></span><span class="mtk10">src</span><span class="mtk3">=</span><span class="mtk12">"js/cuentas-modulo.js"</span><span class="mtk14">></</span><span class="mtk6">script</span><span class="mtk14">></span></div></div><div class="code-line" data-line-number="5" data-line-start="5" data-line-end="5"><div class="line-content"><span class="mtk14"><</span><span class="mtk6">script</span><span class="mtk3"></span><span class="mtk10">src</span><span class="mtk3">=</span><span class="mtk12">"https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"</span><span class="mtk14">></</span><span class="mtk6">script</span><span class="mtk14">></span></div></div><div class="code-line" data-line-number="6" data-line-start="6" data-line-end="6"><div class="line-content"><span class="mtk14"><</span><span class="mtk6">script</span><span class="mtk3"></span><span class="mtk10">src</span><span class="mtk3">=</span><span class="mtk12">"js/planeacion-modulo-vista.js"</span><span class="mtk14">></</span><span class="mtk6">script</span><span class="mtk14">></span></div></div><div class="code-line" data-line-number="7" data-line-start="7" data-line-end="7"><div class="line-content"><span class="mtk14"><</span><span class="mtk6">script</span><span class="mtk3"></span><span class="mtk10">src</span><span class="mtk3">=</span><span class="mtk12">"js/flujo-autorizacion.js"</span><span class="mtk14">></</span><span class="mtk6">script</span><span class="mtk14">></span></div></div></div></div></div></pre>

**Archivos a revisar** :

- [ ]

  RESUMEN.html

- [ ]

  SUMMARY.html

- [ ] Todos los módulos departamentales

---

### 4.2 Dependencia de Bootstrap para Offcanvas

**Archivo** :

flujo-autorizacion.js - Método

\_mostrarCentroBorradores()

**Problema** : Si Bootstrap no está disponible, el Centro de borradores falla silenciosamente.

**Ya corregido** en líneas 1060-1065:

<pre><div node="[object Object]" class="relative whitespace-pre-wrap word-break-all p-3 my-2 rounded-sm bg-list-hover-subtle"><div><div class="code-block"><div class="code-line" data-line-number="1" data-line-start="1" data-line-end="1"><div class="line-content"><span class="mtk18">if</span><span class="mtk1"> (</span><span class="mtk3">!</span><span class="mtk10">window</span><span class="mtk1">.</span><span class="mtk10">bootstrap</span><span class="mtk1">?.</span><span class="mtk10">Offcanvas</span><span class="mtk1">) {</span></div></div><div class="code-line" data-line-number="2" data-line-start="2" data-line-end="2"><div class="line-content"><span class="mtk1"></span><span class="mtk10">console</span><span class="mtk1">.</span><span class="mtk16">error</span><span class="mtk1">(</span><span class="mtk12">'[FlujoAutorizacion] Bootstrap.Offcanvas no está disponible'</span><span class="mtk1">);</span></div></div><div class="code-line" data-line-number="3" data-line-start="3" data-line-end="3"><div class="line-content"><span class="mtk1"></span><span class="mtk6">this</span><span class="mtk1">.</span><span class="mtk16">_mostrarToast</span><span class="mtk1">(</span><span class="mtk12">'Error: Bootstrap no está cargado correctamente.'</span><span class="mtk1">, </span><span class="mtk12">'danger'</span><span class="mtk1">);</span></div></div><div class="code-line" data-line-number="4" data-line-start="4" data-line-end="4"><div class="line-content"><span class="mtk1"></span><span class="mtk18">return</span><span class="mtk1">;</span></div></div><div class="code-line" data-line-number="5" data-line-start="5" data-line-end="5"><div class="line-content"><span class="mtk1">}</span></div></div></div></div></div></pre>

---

## 5. Problemas de Backend/API

### 5.1 Rutas duplicadas

**Archivo** :

server.js - Líneas 52-53

<pre><div node="[object Object]" class="relative whitespace-pre-wrap word-break-all p-3 my-2 rounded-sm bg-list-hover-subtle"><div><div class="code-block"><div class="code-line" data-line-number="1" data-line-start="1" data-line-end="1"><div class="line-content"><span class="mtk10">app</span><span class="mtk1">.</span><span class="mtk16">use</span><span class="mtk1">(</span><span class="mtk12">'/api/borradores'</span><span class="mtk1">, </span><span class="mtk10">rutasBorradores</span><span class="mtk1">);</span></div></div><div class="code-line" data-line-number="2" data-line-start="2" data-line-end="2"><div class="line-content"><span class="mtk10">app</span><span class="mtk1">.</span><span class="mtk16">use</span><span class="mtk1">(</span><span class="mtk12">'/api/workflow/borradores'</span><span class="mtk1">, </span><span class="mtk10">rutasBorradores</span><span class="mtk1">);</span></div></div></div></div></div></pre>

**Problema** : La misma ruta está duplicada bajo dos prefijos.

**Corrección** : Elegir uno solo y estandarizar:

<pre><div node="[object Object]" class="relative whitespace-pre-wrap word-break-all p-3 my-2 rounded-sm bg-list-hover-subtle"><div><div class="code-block"><div class="code-line" data-line-number="1" data-line-start="1" data-line-end="1"><div class="line-content"><span class="mtk10">app</span><span class="mtk1">.</span><span class="mtk16">use</span><span class="mtk1">(</span><span class="mtk12">'/api/borradores'</span><span class="mtk1">, </span><span class="mtk10">rutasBorradores</span><span class="mtk1">);</span></div></div><div class="code-line" data-line-number="2" data-line-start="2" data-line-end="2"><div class="line-content"><span class="mtk5">// Eliminar: app.use('/api/workflow/borradores', rutasBorradores);</span></div></div></div></div></div></pre>

---

### 5.2 Validación de permisos inconsistente

**Archivo** :

borradores.js (rutas)

**Problema** : Algunas rutas validan permisos de forma diferente:

| Ruta         | Permiso requerido  | ¿Consistente?                     |
| ------------ | ------------------ | --------------------------------- |
| `/guardar`   | `Cargar y guardar` | ✓                                 |
| `/enviar`    | `Revisar`          | ⚠️ Debería ser `Cargar y guardar` |
| `/revisar`   | `Revisar`          | ✓                                 |
| `/autorizar` | `Aprobar`          | ✓                                 |
| `/rechazar`  | `Aprobar`          | ✓                                 |

---

## 6. Problemas de Estilos y UI

### 6.1 Estilos de botones no visibles

**Archivo** :

estilos.css

**Problema** : Los botones dentro de `.toolbar-actions` pueden tener conflicto con Bootstrap.

**Corrección** ya aplicada (líneas 131-147):

<pre><div node="[object Object]" class="relative whitespace-pre-wrap word-break-all p-3 my-2 rounded-sm bg-list-hover-subtle"><div><div class="code-block"><div class="code-line" data-line-number="1" data-line-start="1" data-line-end="1"><div class="line-content"><span class="mtk9">.toolbar-actions</span><span class="mtk1"> {</span></div></div><div class="code-line" data-line-number="2" data-line-start="2" data-line-end="2"><div class="line-content"><span class="mtk1"></span><span class="mtk10">display</span><span class="mtk1">: </span><span class="mtk12">flex</span><span class="mtk1">;</span></div></div><div class="code-line" data-line-number="3" data-line-start="3" data-line-end="3"><div class="line-content"><span class="mtk1"></span><span class="mtk10">flex-wrap</span><span class="mtk1">: </span><span class="mtk12">wrap</span><span class="mtk1">;</span></div></div><div class="code-line" data-line-number="4" data-line-start="4" data-line-end="4"><div class="line-content"><span class="mtk1"></span><span class="mtk10">gap</span><span class="mtk1">: </span><span class="mtk7">0.45rem</span><span class="mtk1">;</span></div></div><div class="code-line" data-line-number="5" data-line-start="5" data-line-end="5"><div class="line-content"><span class="mtk1"></span><span class="mtk10">position</span><span class="mtk1">: </span><span class="mtk12">relative</span><span class="mtk1">;</span></div></div><div class="code-line" data-line-number="6" data-line-start="6" data-line-end="6"><div class="line-content"><span class="mtk1"></span><span class="mtk10">z-index</span><span class="mtk1">: </span><span class="mtk7">2</span><span class="mtk1">;</span></div></div><div class="code-line" data-line-number="7" data-line-start="7" data-line-end="7"><div class="line-content"><span class="mtk1">}</span></div></div><div class="code-line" data-line-number="8" data-line-start="8" data-line-end="8"><div class="line-content"><span class="mtk1"></span></div></div><div class="code-line" data-line-number="9" data-line-start="9" data-line-end="9"><div class="line-content"><span class="mtk9">.toolbar-actions</span><span class="mtk1"></span><span class="mtk9">.btn</span><span class="mtk1"> {</span></div></div><div class="code-line" data-line-number="10" data-line-start="10" data-line-end="10"><div class="line-content"><span class="mtk1"></span><span class="mtk10">border-radius</span><span class="mtk1">: </span><span class="mtk7">999px</span><span class="mtk1">;</span></div></div><div class="code-line" data-line-number="11" data-line-start="11" data-line-end="11"><div class="line-content"><span class="mtk1"></span><span class="mtk10">font-weight</span><span class="mtk1">: </span><span class="mtk7">600</span><span class="mtk1">;</span></div></div><div class="code-line" data-line-number="12" data-line-start="12" data-line-end="12"><div class="line-content"><span class="mtk1"></span><span class="mtk10">font-size</span><span class="mtk1">: </span><span class="mtk7">0.9rem</span><span class="mtk1">;</span></div></div><div class="code-line" data-line-number="13" data-line-start="13" data-line-end="13"><div class="line-content"><span class="mtk1"></span><span class="mtk10">padding</span><span class="mtk1">: </span><span class="mtk7">0.35rem</span><span class="mtk1"></span><span class="mtk7">0.9rem</span><span class="mtk1">;</span></div></div><div class="code-line" data-line-number="14" data-line-start="14" data-line-end="14"><div class="line-content"><span class="mtk1"></span><span class="mtk10">position</span><span class="mtk1">: </span><span class="mtk12">relative</span><span class="mtk1">;</span></div></div><div class="code-line" data-line-number="15" data-line-start="15" data-line-end="15"><div class="line-content"><span class="mtk1"></span><span class="mtk10">z-index</span><span class="mtk1">: </span><span class="mtk7">2</span><span class="mtk1">;</span></div></div><div class="code-line" data-line-number="16" data-line-start="16" data-line-end="16"><div class="line-content"><span class="mtk1"></span><span class="mtk10">pointer-events</span><span class="mtk1">: </span><span class="mtk12">auto</span><span class="mtk1">;</span></div></div><div class="code-line" data-line-number="17" data-line-start="17" data-line-end="17"><div class="line-content"><span class="mtk1">}</span></div></div></div></div></div></pre>

---

### 6.2 Celda de borrador sin estilo visible

**Archivo** :

flujo-autorizacion.js - Líneas 57-70

**Estilos aplicados dinámicamente** (verificar que están funcionando):

<pre><div node="[object Object]" class="relative whitespace-pre-wrap word-break-all p-3 my-2 rounded-sm bg-list-hover-subtle"><div><div class="code-block"><div class="code-line" data-line-number="1" data-line-start="1" data-line-end="1"><div class="line-content"><span class="mtk9">.celda-borrador</span><span class="mtk1"> {</span></div></div><div class="code-line" data-line-number="2" data-line-start="2" data-line-end="2"><div class="line-content"><span class="mtk1"></span><span class="mtk10">position</span><span class="mtk1">: </span><span class="mtk12">relative</span><span class="mtk1">;</span></div></div><div class="code-line" data-line-number="3" data-line-start="3" data-line-end="3"><div class="line-content"><span class="mtk1"></span><span class="mtk10">background-color</span><span class="mtk1">: </span><span class="mtk12">#fff3cd</span><span class="mtk1"></span><span class="mtk6">!important</span><span class="mtk1">;</span></div></div><div class="code-line" data-line-number="4" data-line-start="4" data-line-end="4"><div class="line-content"><span class="mtk1"></span><span class="mtk10">color</span><span class="mtk1">: </span><span class="mtk12">#5f3703</span><span class="mtk1"></span><span class="mtk6">!important</span><span class="mtk1">;</span></div></div><div class="code-line" data-line-number="5" data-line-start="5" data-line-end="5"><div class="line-content"><span class="mtk1">}</span></div></div><div class="code-line" data-line-number="6" data-line-start="6" data-line-end="6"><div class="line-content"><span class="mtk9">.celda-borrador::after</span><span class="mtk1"> {</span></div></div><div class="code-line" data-line-number="7" data-line-start="7" data-line-end="7"><div class="line-content"><span class="mtk1"></span><span class="mtk10">content</span><span class="mtk1">: </span><span class="mtk12">'</span><span class="mtk9">\00b7</span><span class="mtk12">'</span><span class="mtk1">;</span></div></div><div class="code-line" data-line-number="8" data-line-start="8" data-line-end="8"><div class="line-content"><span class="mtk1"></span><span class="mtk10">position</span><span class="mtk1">: </span><span class="mtk12">absolute</span><span class="mtk1">;</span></div></div><div class="code-line" data-line-number="9" data-line-start="9" data-line-end="9"><div class="line-content"><span class="mtk1"></span><span class="mtk10">right</span><span class="mtk1">: </span><span class="mtk7">0.25rem</span><span class="mtk1">;</span></div></div><div class="code-line" data-line-number="10" data-line-start="10" data-line-end="10"><div class="line-content"><span class="mtk1"></span><span class="mtk10">top</span><span class="mtk1">: </span><span class="mtk7">0.15rem</span><span class="mtk1">;</span></div></div><div class="code-line" data-line-number="11" data-line-start="11" data-line-end="11"><div class="line-content"><span class="mtk1"></span><span class="mtk10">font-size</span><span class="mtk1">: </span><span class="mtk7">0.75rem</span><span class="mtk1">;</span></div></div><div class="code-line" data-line-number="12" data-line-start="12" data-line-end="12"><div class="line-content"><span class="mtk1"></span><span class="mtk10">color</span><span class="mtk1">: </span><span class="mtk12">#5f3c1c</span><span class="mtk1">;</span></div></div><div class="code-line" data-line-number="13" data-line-start="13" data-line-end="13"><div class="line-content"><span class="mtk1">}</span></div></div></div></div></div></pre>

---

## 7. Plan de Correcciones Prioritarias

### Fase 1: Correcciones Críticas (Inmediatas)

1. **Corregir `obtenerDatosUsuario`** en
   **flujo-autorizacion.js**

   <pre><div node="[object Object]" class="relative whitespace-pre-wrap word-break-all p-3 my-2 rounded-sm bg-list-hover-subtle"><div><div class="code-block"><div class="code-line" data-line-number="1" data-line-start="1" data-line-end="1"><div class="line-content"><span class="mtk6">this</span><span class="mtk1">.</span><span class="mtk10">usuarioActual</span><span class="mtk1"></span><span class="mtk3">=</span><span class="mtk1"></span><span class="mtk10">window</span><span class="mtk1">.</span><span class="mtk10">Sesion</span><span class="mtk1">?.</span><span class="mtk16">obtener</span><span class="mtk1">?.()?.</span><span class="mtk10">usuario</span><span class="mtk1"></span><span class="mtk3">||</span><span class="mtk1"> {};</span></div></div></div></div></div></pre>

2. **Eliminar duplicación de sistema de workflow**

   - Desactivar lógica de workflow en

     planeacion-modulo-vista.js

   - Usar exclusivamente

     flujo-autorizacion.js

3. **Verificar orden de carga de scripts** en todos los HTML

### Fase 2: Integración de Módulos

4. **Estandarizar IDs de botones** en todos los HTML
5. **Agregar atributos `data-columna-clave`** a todas las celdas editables
6. **Verificar `data-cuenta21`** en todas las filas

### Fase 3: Refinamiento

7. **Eliminar rutas duplicadas** del backend
8. **Agregar validación de contexto** antes de operaciones
9. **Mejorar manejo de errores** en llamadas API

---

## 8. Matriz de Funcionalidad por Módulo

| Módulo           | Modo Edición | Guardar Borrador | Enviar | Revisar | Autorizar | Guardar COI |
| ---------------- | ------------ | ---------------- | ------ | ------- | --------- | ----------- |
| **Presupuestos** | ✓            | ✓                | ⚠️     | ⚠️      | ⚠️        | ✓           |
| **RESUMEN**      | Parcial      | ⚠️               | ⚠️     | ⚠️      | ⚠️        | ⚠️          |
| **SUMMARY**      | Parcial      | ⚠️               | ⚠️     | ⚠️      | ⚠️        | ⚠️          |
| **Finanzas**     | ✓            | ⚠️               | ⚠️     | ⚠️      | ⚠️        | ⚠️          |
| **Comités**      | ✓            | ⚠️               | ⚠️     | ⚠️      | ⚠️        | ⚠️          |
| **Otros Dptos**  | ✓            | ⚠️               | ⚠️     | ⚠️      | ⚠️        | ⚠️          |

**Leyenda** :

- ✓ = Funcionando
- ⚠️ = Requiere verificación/corrección
- ✗ = No implementado

---

## 9. Checklist de Verificación Post-Corrección

### Para cada módulo HTML:

- [ ] `data-modulo` en el `<body>`
- [ ] `data-modulo-alias` en el `<body>`
- [ ] Bootstrap cargado antes de

  flujo-autorizacion.js

- [ ] IDs de botones correctos
- [ ] `window.CuentasModulo` disponible
- [ ] Evento `planeacion:contexto-actualizado` emitido
- [ ] Toast funcionando
- [ ] Workflow drawer visible

### Para cada script JS:

- [ ] Sin errores de consola
- [ ] `Sesion.requerirSesion()` al inicio
- [ ] Headers de autenticación incluidos
- [ ] Manejo de errores en llamadas fetch

---

## 10. Archivos Principales a Modificar

| Archivo                        | Tipo de Cambio                        | Prioridad |
| ------------------------------ | ------------------------------------- | --------- |
| `flujo-autorizacion.js:379`    | Corregir `obtenerDatosUsuario`        | Alta      |
| **planeacion-modulo-vista.js** | Eliminar workflow duplicado           | Alta      |
| `cuentas-modulo.js:456`        | Corregir referencia a `addAccountBtn` | Media     |
| Todos los HTML                 | Verificar orden de scripts            | Alta      |
| `server.js:53`                 | Eliminar ruta duplicada               | Baja      |

---

## Apéndice: Código de Verificación

Script para verificar la integración en consola del navegador:

<pre><div node="[object Object]" class="relative whitespace-pre-wrap word-break-all p-3 my-2 rounded-sm bg-list-hover-subtle"><div><div class="code-block"><div class="code-line" data-line-number="1" data-line-start="1" data-line-end="1"><div class="line-content"><span class="mtk5">// Verificar estado del sistema</span></div></div><div class="code-line" data-line-number="2" data-line-start="2" data-line-end="2"><div class="line-content"><span class="mtk10">console</span><span class="mtk1">.</span><span class="mtk16">log</span><span class="mtk1">(</span><span class="mtk12">'=== Estado del Sistema SummaCham ==='</span><span class="mtk1">);</span></div></div><div class="code-line" data-line-number="3" data-line-start="3" data-line-end="3"><div class="line-content"><span class="mtk10">console</span><span class="mtk1">.</span><span class="mtk16">log</span><span class="mtk1">(</span><span class="mtk12">'Sesión:'</span><span class="mtk1">, </span><span class="mtk10">window</span><span class="mtk1">.</span><span class="mtk10">Sesion</span><span class="mtk1">?.</span><span class="mtk16">obtener</span><span class="mtk1">?.() </span><span class="mtk3">?</span><span class="mtk1"></span><span class="mtk12">'✓'</span><span class="mtk1"></span><span class="mtk3">:</span><span class="mtk1"></span><span class="mtk12">'✗'</span><span class="mtk1">);</span></div></div><div class="code-line" data-line-number="4" data-line-start="4" data-line-end="4"><div class="line-content"><span class="mtk10">console</span><span class="mtk1">.</span><span class="mtk16">log</span><span class="mtk1">(</span><span class="mtk12">'Bootstrap:'</span><span class="mtk1">, </span><span class="mtk10">window</span><span class="mtk1">.</span><span class="mtk10">bootstrap</span><span class="mtk1"></span><span class="mtk3">?</span><span class="mtk1"></span><span class="mtk12">'✓'</span><span class="mtk1"></span><span class="mtk3">:</span><span class="mtk1"></span><span class="mtk12">'✗'</span><span class="mtk1">);</span></div></div><div class="code-line" data-line-number="5" data-line-start="5" data-line-end="5"><div class="line-content"><span class="mtk10">console</span><span class="mtk1">.</span><span class="mtk16">log</span><span class="mtk1">(</span><span class="mtk12">'FlujoAutorizacion:'</span><span class="mtk1">, </span><span class="mtk10">window</span><span class="mtk1">.</span><span class="mtk10">FlujoAutorizacion</span><span class="mtk1"></span><span class="mtk3">?</span><span class="mtk1"></span><span class="mtk12">'✓'</span><span class="mtk1"></span><span class="mtk3">:</span><span class="mtk1"></span><span class="mtk12">'✗'</span><span class="mtk1">);</span></div></div><div class="code-line" data-line-number="6" data-line-start="6" data-line-end="6"><div class="line-content"><span class="mtk10">console</span><span class="mtk1">.</span><span class="mtk16">log</span><span class="mtk1">(</span><span class="mtk12">'CuentasModulo:'</span><span class="mtk1">, </span><span class="mtk10">window</span><span class="mtk1">.</span><span class="mtk10">CuentasModulo</span><span class="mtk1"></span><span class="mtk3">?</span><span class="mtk1"></span><span class="mtk12">'✓'</span><span class="mtk1"></span><span class="mtk3">:</span><span class="mtk1"></span><span class="mtk12">'✗'</span><span class="mtk1">);</span></div></div><div class="code-line" data-line-number="7" data-line-start="7" data-line-end="7"><div class="line-content"><span class="mtk10">console</span><span class="mtk1">.</span><span class="mtk16">log</span><span class="mtk1">(</span><span class="mtk12">'Instancia activa:'</span><span class="mtk1">, </span><span class="mtk10">window</span><span class="mtk1">.</span><span class="mtk10">__flujoAutorizacionInstance</span><span class="mtk1"></span><span class="mtk3">?</span><span class="mtk1"></span><span class="mtk12">'✓'</span><span class="mtk1"></span><span class="mtk3">:</span><span class="mtk1"></span><span class="mtk12">'✗'</span><span class="mtk1">);</span></div></div><div class="code-line" data-line-number="8" data-line-start="8" data-line-end="8"><div class="line-content"><span class="mtk1"></span></div></div><div class="code-line" data-line-number="9" data-line-start="9" data-line-end="9"><div class="line-content"><span class="mtk5">// Verificar contexto</span></div></div><div class="code-line" data-line-number="10" data-line-start="10" data-line-end="10"><div class="line-content"><span class="mtk6">const</span><span class="mtk1"></span><span class="mtk19">inst</span><span class="mtk1"></span><span class="mtk3">=</span><span class="mtk1"></span><span class="mtk10">window</span><span class="mtk1">.</span><span class="mtk10">__flujoAutorizacionInstance</span><span class="mtk1">;</span></div></div><div class="code-line" data-line-number="11" data-line-start="11" data-line-end="11"><div class="line-content"><span class="mtk18">if</span><span class="mtk1"> (</span><span class="mtk10">inst</span><span class="mtk1">) {</span></div></div><div class="code-line" data-line-number="12" data-line-start="12" data-line-end="12"><div class="line-content"><span class="mtk1"></span><span class="mtk10">console</span><span class="mtk1">.</span><span class="mtk16">log</span><span class="mtk1">(</span><span class="mtk12">'Contexto:'</span><span class="mtk1">, </span><span class="mtk10">inst</span><span class="mtk1">.</span><span class="mtk10">contexto</span><span class="mtk1">);</span></div></div><div class="code-line" data-line-number="13" data-line-start="13" data-line-end="13"><div class="line-content"><span class="mtk1"></span><span class="mtk10">console</span><span class="mtk1">.</span><span class="mtk16">log</span><span class="mtk1">(</span><span class="mtk12">'Borrador actual:'</span><span class="mtk1">, </span><span class="mtk10">inst</span><span class="mtk1">.</span><span class="mtk10">borradorActual</span><span class="mtk1">);</span></div></div><div class="code-line" data-line-number="14" data-line-start="14" data-line-end="14"><div class="line-content"><span class="mtk1"></span><span class="mtk10">console</span><span class="mtk1">.</span><span class="mtk16">log</span><span class="mtk1">(</span><span class="mtk12">'Modo edición:'</span><span class="mtk1">, </span><span class="mtk10">inst</span><span class="mtk1">.</span><span class="mtk10">modoEdicion</span><span class="mtk1">);</span></div></div><div class="code-line" data-line-number="15" data-line-start="15" data-line-end="15"><div class="line-content"><span class="mtk1">}</span></div></div></div></div></div></pre>
