# Flujo de Autorización y Modo Edición - Explicación Detallada

## 📋 Resumen de Correcciones Implementadas

### ✅ Problemas Corregidos

1. **Modo edición se activaba automáticamente** ❌ → ✅ CORREGIDO
   - **Antes**: Se inicializaba Y activaba automáticamente al cargar la página
   - **Ahora**: Solo se INICIALIZA (prepara listeners), NO se activa hasta que el usuario hace clic en "Cargar presupuesto"

2. **Doble inicialización de ModoEdicionPresupuesto** ❌ → ✅ CORREGIDO
   - **Antes**: Mostraba "✅ Modo edición inicializado sobre #mainTable" 2 veces
   - **Ahora**: Se inicializa una sola vez y muestra mensaje claro diferenciando INICIALIZACIÓN vs ACTIVACIÓN

3. **Summary mostraba "editando" sin estar en modo edición** ❌ → ✅ CORREGIDO
   - **Antes**: Summary activaba `ModoEdicionPresupuesto.activar()` automáticamente
   - **Ahora**: Summary NO activa modo edición automáticamente, solo Resumen lo hace (y solo cuando el flujo de autorización lo solicita)

4. **Edición de CUENTAS/DESCRIPCION bloqueada sin modo edición** ❌ → ✅ CORREGIDO
   - **Antes**: Requería activar modo edición para editar CUENTAS y DESCRIPCION
   - **Ahora**: CUENTAS y DESCRIPCION se pueden editar SIEMPRE (sin modo edición activo) porque NO se insertan a COI

---

## 🏗️ Arquitectura del Sistema de Edición

### 1. **Inicialización vs Activación**

```javascript
// INICIALIZACIÓN (Setup)
// - Se ejecuta AL CARGAR la página
// - Prepara los listeners de click en celdas
// - NO permite editar todavía
ModoEdicionPresupuesto.inicializar('#tablaComparacion');
// Log: "🟢 ModoEdicionPresupuesto: listeners inicializados (NO activo)"

// ACTIVACIÓN (Enable)
// - Se ejecuta cuando el usuario hace clic en "Cargar presupuesto"
// - Habilita la edición de celdas numéricas
// - Marca estado.modoEdicionActivo = true
ModoEdicionPresupuesto.activar();
// Log: "🟢 ModoEdicionPresupuesto: ACTIVADO (celdas numéricas editables)"
```

---

## 📊 Lógica por Módulo

### **SUMMARY (Summary por Empresa)**

#### Columnas Editables:
1. **CUENTAS** (código de cuenta)
   - ✅ Editable SIEMPRE (sin modo edición)
   - ❌ NO se inserta a COI (solo local/layout)
   - 💾 Se guarda en localStorage + servidor como "layout"

2. **DESCRIPCION** (nombre de la cuenta)
   - ✅ Editable SIEMPRE (sin modo edición)
   - ❌ NO se inserta a COI (solo local/layout)
   - 💾 Se guarda en localStorage + servidor como "layout"

3. **Columnas Numéricas** (actualMonth, planMonth, prevMonth, etc.)
   - ⚠️ Editable SOLO con modo edición ACTIVO
   - ✅ SÍ se insertan a COI (presupuesto real)
   - 💾 Se guardan como "borrador" en la BD

#### Flujo de Trabajo:
```
1. Usuario carga SUMMARY → Inicializa listeners (NO activo)
2. Usuario edita CUENTA/DESCRIPCION → ✅ Permitido siempre
3. Usuario hace clic en "Cargar presupuesto" → Activa modo edición
4. Usuario edita valores numéricos → Captura cambios
5. Usuario hace clic en "Guardar para más tarde" → Guarda borrador (estado: EDITANDO)
6. Usuario hace clic en "Enviar a revisión" → Cambia estado a PENDIENTE
```

---

### **RESUMEN (Consolidado por Ciudad)**

#### Columnas Editables:
1. **CUENTAS** (código de cuenta)
   - ✅ Editable SIEMPRE (sin modo edición)
   - ❌ NO se inserta a COI
   - 💾 Se guarda como "layout"

2. **DESCRIPCION** (nombre de la cuenta)
   - ✅ Editable SIEMPRE (sin modo edición)
   - ❌ NO se inserta a COI
   - 💾 Se guarda como "layout"

3. **Columnas Numéricas**
   - ⚠️ Editable SOLO con modo edición ACTIVO
   - ✅ SÍ se insertan a COI
   - 💾 Se guardan como "borrador"

#### Diferencia con Summary:
- **Resumen SÍ activa automáticamente** `ModoEdicionPresupuesto.activar()` en `establecerModoEdicion()`
- Summary NO lo hace (se activa desde flujo de autorización)

---

### **Módulos de Planeación** (Presupuestos, Comités, Finanzas, etc.)

#### Columnas Editables:
1. **CUENTAS**
   - ✅ Editable SIEMPRE
   - ❌ NO se inserta a COI
   - 💾 Layout local

2. **DESCRIPCION**
   - ✅ Editable SIEMPRE
   - ❌ NO se inserta a COI
   - 💾 Layout local

3. **Meses (ENE, FEB, MAR, ..., DIC)**
   - ⚠️ Editable SOLO con modo edición ACTIVO
   - ✅ SÍ se insertan a COI
   - 💾 Borrador en BD

4. **TOTAL**
   - ❌ NO editable (calculado automáticamente)

---

## 🔐 Estados del Flujo de Autorización

### Estados Disponibles:

```javascript
const ESTADOS = {
  SIN_CARGAR: "SIN_CARGAR",     // No hay borrador
  EDITANDO: "EDITANDO",         // Usuario está creando/modificando
  PENDIENTE: "PENDIENTE",       // Enviado a revisión
  REVISADO: "REVISADO",         // Marcado como revisado
  RECHAZADO: "RECHAZADO",       // Rechazado (vuelve al autor)
  APROBADO: "APROBADO",         // Autorizado (listo para guardar)
  GUARDADO: "GUARDADO"          // Guardado en COI (inmutable)
};
```

### Flujo Normal:
```
SIN_CARGAR → EDITANDO → PENDIENTE → REVISADO → APROBADO → GUARDADO
```

### Flujo con Rechazo:
```
PENDIENTE/REVISADO/APROBADO → RECHAZADO → EDITANDO (corrección) → PENDIENTE
```

---

## 🎯 Permisos por Rol

### Usuario Normal (Cargar):
- ✅ Crear/editar presupuesto (EDITANDO)
- ✅ Guardar borrador temporal
- ✅ Enviar a revisión (EDITANDO → PENDIENTE)
- ✅ Corregir si fue rechazado
- ❌ Marcar como revisado
- ❌ Autorizar
- ❌ Guardar en COI

### Revisor:
- ✅ Marcar como revisado (PENDIENTE → REVISADO)
- ✅ Rechazar (PENDIENTE/REVISADO → RECHAZADO)
- ❌ Autorizar
- ❌ Guardar en COI

### Autorizador:
- ✅ Autorizar (REVISADO → APROBADO)
- ✅ Rechazar
- ✅ Guardar en COI (APROBADO → GUARDADO)

### Admin Global:
- ✅ Todas las acciones
- ✅ Puede saltarse el flujo

---

## 💾 Guardado de Datos - FLUJO CORRECTO

### **IMPORTANTE: TODO respeta el Flujo de Autorización**

**AMBOS** tipos de cambios (LAYOUT y PRESUPUESTO) deben pasar por el flujo completo:
1. EDITANDO → 2. PENDIENTE → 3. REVISADO → 4. APROBADO → 5. GUARDADO

---

### 1. **LAYOUT (CUENTAS/DESCRIPCION/ESTRUCTURA)**

#### ¿Qué incluye el Layout?
- Códigos de cuenta
- Descripciones personalizadas
- Orden de filas
- Secciones creadas
- Filas agregadas/eliminadas

#### Flujo de Guardado:

**PASO 1: Edición**
```javascript
// Usuario edita CUENTA o DESCRIPCION
// Se guarda automáticamente en localStorage (backup local)
window.ModoEdicionPresupuesto.guardarLayout();
```

**PASO 2: Guardar Borrador Temporal**
```javascript
// Usuario hace clic en "Guardar para más tarde"
// El layout se incluye en el borrador
{
  presupuesto: [...], // Valores numéricos
  layout: {           // Estructura de la tabla
    filas: [
      { cuenta: "4010-001", descripcion: "Cuotas", role: "account" }
    ]
  }
}
```

**PASO 3: Enviar a Revisión → Revisar → Autorizar**
```
EDITANDO → PENDIENTE → REVISADO → APROBADO
```

**PASO 4: Guardar en COI (Finalizar)**
```javascript
// Al hacer clic en "Guardar en COI":
// 1. Se guarda el LAYOUT en tabla `layout_templates`
// 2. Se guarda el PRESUPUESTO en Firebird
// 3. Estado cambia a GUARDADO

await borradoresService.guardarAutorizado(borradorId);
// → llama a persistirEnFirebird()
// → extrae layout del borrador
// → guarda en layout_templates (SQLite)
// → guarda presupuesto en PRESUP24 (Firebird)
```

#### Tabla de Destino: `layout_templates` (SQLite)
```sql
CREATE TABLE layout_templates (
  id INTEGER PRIMARY KEY,
  empresa_id TEXT NOT NULL,
  modulo TEXT NOT NULL,
  anio INTEGER NOT NULL,
  datos TEXT NOT NULL, -- JSON con el layout
  creado_por INTEGER,
  actualizado_por INTEGER,
  UNIQUE(empresa_id, modulo, anio)
);
```

#### Carga del Layout al Iniciar:
```javascript
// Al cargar SUMMARY/RESUMEN:
// 1. Intenta cargar desde servidor (layout_templates)
const layoutServidor = await fetch('/api/layouts?empresaId=...&modulo=...&anio=...');

// 2. Si no existe, carga desde localStorage (backup local)
const layoutLocal = ModoEdicionPresupuesto.cargarLayoutLocal();

// 3. Aplica el layout a la tabla
ModoEdicionPresupuesto.aplicarLayoutLocal(layout);
```

---

### 2. **PRESUPUESTO (Valores Numéricos)**

#### ¿Qué incluye el Presupuesto?
- Valores de meses (ENE-DIC)
- Columnas numéricas (actualMonth, planMonth, etc.)

#### Flujo de Guardado:

**PASO 1-3: Igual que Layout** (EDITANDO → PENDIENTE → REVISADO → APROBADO)

**PASO 4: Guardar en COI**
```javascript
// Se insertan en tabla PRESUP24 de Firebird
UPDATE OR INSERT INTO PRESUP24 (NUM_CTA, EJERCICIO, PRESUP01, PRESUP02, ...)
VALUES (?, ?, ?, ?, ...)
MATCHING (NUM_CTA, EJERCICIO);
```

#### Tabla de Destino: `PRESUP24` (Firebird)
```
NUM_CTA: "4010-001"
EJERCICIO: 2024
PRESUP01: 15000.00  (Enero)
PRESUP02: 16000.00  (Febrero)
...
PRESUP12: 18000.00  (Diciembre)
```

---

## 🔄 Diferencia Clave: Layout vs Presupuesto

| Aspecto | LAYOUT | PRESUPUESTO |
|---------|--------|-------------|
| **Qué es** | Estructura de la tabla | Valores numéricos |
| **Incluye** | Cuentas, descripciones, orden | Meses, presupuestos |
| **Dónde se guarda** | `layout_templates` (SQLite) | `PRESUP24` (Firebird) |
| **Cuándo se guarda** | Al aprobar y hacer "Guardar en COI" | Al aprobar y hacer "Guardar en COI" |
| **Se inserta a COI** | ❌ NO | ✅ SÍ |
| **Backup local** | ✅ localStorage | ❌ NO |
| **Requiere flujo** | ✅ SÍ | ✅ SÍ |

---

## 📝 Ejemplo Completo de Flujo

### Escenario: Usuario edita Summary y agrega una cuenta nueva

```
1. Usuario hace clic en "Cargar presupuesto" 
   → Estado: EDITANDO (modo edición ACTIVO)

2. Usuario agrega fila nueva con cuenta "5010-001 - Capacitación"
   → Se guarda en localStorage como backup
   → Estado: EDITANDO (hayCambios: true)

3. Usuario edita valores de ENE a DIC para cuenta "4010-001"
   → Se capturan cambios numéricos
   → Estado: EDITANDO (hayCambios: true)

4. Usuario hace clic en "Guardar para más tarde"
   → Se crea borrador en tabla PLAN_BORRADORES
   → Incluye: { presupuesto: [...], layout: { filas: [...] } }
   → Estado: EDITANDO

5. Usuario hace clic en "Enviar a revisión"
   → Estado: PENDIENTE
   → Notifica a revisores

6. Revisor hace clic en "Marcar como revisado"
   → Estado: REVISADO

7. Autorizador hace clic en "Autorizar"
   → Estado: APROBADO

8. Autorizador hace clic en "Guardar en COI"
   → Extrae layout del borrador
   → Guarda layout en layout_templates (SQLite):
     {
       empresa_id: "01",
       modulo: "SUMMARY",
       anio: 2024,
       datos: '{"filas":[{"cuenta":"5010-001","descripcion":"Capacitación"}]}'
     }
   → Guarda presupuesto en PRESUP24 (Firebird):
     INSERT INTO PRESUP24 (NUM_CTA, EJERCICIO, PRESUP01-12) VALUES (...)
   → Elimina borrador de PLAN_BORRADORES
   → Estado: GUARDADO

9. Usuario recarga la página
   → Carga layout desde layout_templates (servidor)
   → Aplica layout a la tabla
   → Muestra cuenta "5010-001 - Capacitación" con su descripción
   → Carga presupuesto desde Firebird
   → Muestra valores de ENE a DIC
```

---

## 🐛 Problemas Resueltos

### ❌ ANTES:
```
1. Se carga la página Summary
2. ModoEdicionPresupuesto.inicializar() → "✅ Modo edición inicializado"
3. ModoEdicionPresupuesto.inicializar() → "✅ Modo edición inicializado" (DUPLICADO)
4. summary-view.js ejecuta setEditMode(true)
5. Summary activa ModoEdicionPresupuesto.activar() automáticamente
6. Usuario ve modo edición ACTIVO sin haberlo solicitado
7. No puede editar CUENTAS/DESCRIPCION sin modo edición
```

### ✅ AHORA:
```
1. Se carga la página Summary
2. ModoEdicionPresupuesto.inicializar() → "🟢 listeners inicializados (NO activo)"
3. Usuario puede editar CUENTAS/DESCRIPCION libremente
4. Usuario hace clic en "Cargar presupuesto"
5. FlujoAutorizacion._enterEditMode() ejecuta
6. ModoEdicionPresupuesto.activar() → "🟢 ACTIVADO (celdas numéricas editables)"
7. Usuario puede editar valores numéricos
```

---

## 🔍 Logs Importantes

### Al Cargar la Página:
```
🟢 ModoEdicionPresupuesto: listeners inicializados (NO activo) en #tablaComparacion
✅ Summary: modo edición local activado (solo para CUENTAS/DESCRIPCION)
```

### Al Hacer Clic en "Cargar presupuesto":
```
🟢 Flujo Autorización: modo edición ACTIVADO (celdas numéricas editables)
🟢 ModoEdicionPresupuesto: ACTIVADO (celdas numéricas editables)
```

---

## 🎨 Indicadores Visuales

### Modo Edición NO Activo:
- CUENTAS/DESCRIPCION tienen cursor `text` ✏️
- Celdas numéricas tienen cursor `default` 🚫
- No hay hint de edición

### Modo Edición ACTIVO:
- CUENTAS/DESCRIPCION tienen cursor `text` ✏️
- Celdas numéricas tienen cursor `pointer` 👆
- Tooltip: "Click para editar"
- Clase `modo-edicion-activo` en la tabla

### Celdas Modificadas:
- Fondo amarillo claro `#ffffcc` 🟡
- Clase `cell-modified`

### Borrador Cargado:
- Fondo amarillo `#fff3cd` 🟨
- Clase `celda-borrador`
- Punto indicador en esquina superior derecha

---

## 📌 Sugerencias de Cuentas

### Filtro Aplicado:
- **Query SQL**: `WHERE c.STATUS = 'A'`
- **Ubicación**: 
  - `src/services/saldosService.js` (líneas 119, 155)
  - `src/services/presupuestosService.js` (línea 98)

### Cómo Funciona:
1. Al cargar cuentas, el backend filtra solo cuentas ACTIVAS
2. Frontend recibe la lista filtrada
3. Autocompletado muestra solo cuentas con STATUS='A'

---

## 🚀 Próximos Pasos Recomendados

1. **Verificar en navegador**:
   - Abrir consola del navegador
   - Buscar logs de inicialización
   - Confirmar que NO haya duplicados

2. **Probar flujo completo**:
   - Cargar Summary
   - Editar CUENTA/DESCRIPCION SIN activar modo edición
   - Activar modo edición ("Cargar presupuesto")
   - Editar valores numéricos
   - Guardar borrador
   - Enviar a revisión

3. **Validar borradores**:
   - Abrir Centro de Borradores
   - Verificar que se listen correctamente
   - Cargar un borrador
   - Confirmar que se pintan las celdas amarillas

---

## 📞 Soporte

Si encuentras algún problema:

1. **Revisar consola del navegador** para logs detallados
2. **Verificar estado del flujo** con `window.__flujoAutorizacionInstance.state`
3. **Limpiar cache y localStorage** si hay comportamiento extraño
4. **Reportar con logs completos** de consola

---

**Última actualización**: Diciembre 10, 2025
**Versión**: 2.0 (Post-corrección)
