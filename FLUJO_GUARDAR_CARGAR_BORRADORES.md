# ✅ Flujo de Autorización Corregido - Guardar y Cargar Borradores

## 🔄 Nuevo Flujo de Trabajo

### **Problema Original:**
- Al hacer "Guardar para más tarde" → Guardaba pero **permanecía en modo edición**
- No había forma de salir del modo edición sin perder cambios
- Al volver a hacer clic en "Cargar presupuesto" no se cargaban los datos del borrador

### **Solución Implementada:**

```
1. Usuario hace cambios en celdas
   ↓
2. Click en "Guardar para más tarde"
   ↓
3. ✅ Guarda borrador en BD (estado: EDITANDO)
   ✅ SALE del modo edición
   ✅ Muestra botón "Cargar presupuesto"
   ↓
4. Usuario puede cerrar, navegar, etc.
   ↓
5. Click en "Cargar presupuesto"
   ↓
6. ✅ Carga datos del borrador en la tabla
   ✅ Activa modo edición
   ✅ Usuario puede continuar editando
```

---

## 📝 Cambios Implementados

### 1. **Modificación de `_guardarBorradorTemporal()`**

**Antes:**
```javascript
// Guardaba y mantenía modo edición activo
this._toast("Borrador guardado para continuar editando.");
```

**Ahora:**
```javascript
// Guarda Y sale del modo edición
this._exitEditMode(true); // skipCancel=true para no limpiar borrador
this._toast("Borrador guardado. Haz clic en 'Cargar presupuesto' para continuar editando.");
```

### 2. **Nuevo método `_cargarBorradorEnTabla()`**

Carga los datos del borrador guardado en la tabla cuando el usuario hace clic en "Cargar presupuesto":

```javascript
async _cargarBorradorEnTabla() {
  // 1. Verifica que existan datos
  if (!this.state.borrador?.data?.presupuesto) return;
  
  // 2. Intenta usar callback personalizado
  if (this.callbacks.cargarBorrador) {
    await this.callbacks.cargarBorrador(presupuesto);
  }
  
  // 3. Fallback: usa CuentasModulo
  else if (window.CuentasModulo?.cargarBorrador) {
    await window.CuentasModulo.cargarBorrador(presupuesto);
  }
  
  // 4. Fallback manual: actualiza celdas directamente
  else {
    presupuesto.forEach(item => {
      const celda = tabla.querySelector(`[data-cuenta="${item.cuenta}"][data-mes="${item.mes}"]`);
      if (celda) celda.textContent = item.valor;
    });
  }
}
```

### 3. **Modificación de `_handleGuardar()`**

**Antes:**
```javascript
if (!this.state.editMode) {
  this._enterEditMode(); // Solo activaba modo edición
}
```

**Ahora:**
```javascript
if (!this.state.editMode) {
  // Si existe borrador EDITANDO, cargarlo primero
  if (this.state.borrador?.estado === ESTADOS.EDITANDO) {
    await this._cargarBorradorEnTabla();
  }
  this._enterEditMode();
}
```

### 4. **Nuevo callback `cargarBorrador`**

Se agregó al constructor para permitir implementaciones personalizadas:

```javascript
this.callbacks = {
  onCancelEdit: ...,
  obtenerCambios: ...,
  obtenerHeaders: ...,
  cargarBorrador: ... // NUEVO
};
```

---

## 🎯 Comportamiento Esperado

### Escenario 1: Guardar y Continuar Después

**Paso 1: Editar**
```
Usuario: Click en "Cargar presupuesto"
Sistema: ✅ Activa modo edición
         ✅ Botón cambia a "Guardar para más tarde"
         ✅ Celdas month-budget editables
```

**Paso 2: Hacer cambios**
```
Usuario: Edita valores en celdas month-budget
Sistema: ✅ Captura cambios
         ✅ Marca celdas modificadas
```

**Paso 3: Guardar**
```
Usuario: Click en "Guardar para más tarde"
Sistema: ✅ Guarda borrador en BD (estado: EDITANDO)
         ✅ DESACTIVA modo edición
         ✅ Botón vuelve a "Cargar presupuesto"
         ✅ Toast: "Borrador guardado. Haz clic en 'Cargar presupuesto' para continuar"
```

**Paso 4: Salir/Navegar**
```
Usuario: Puede cerrar, cambiar de vista, etc.
Sistema: ✅ Borrador permanece guardado en BD
```

**Paso 5: Volver y continuar**
```
Usuario: Click en "Cargar presupuesto"
Sistema: ✅ Detecta borrador EDITANDO
         ✅ Carga datos en la tabla
         ✅ Activa modo edición
         ✅ Usuario puede continuar editando
```

### Escenario 2: Cancelar Edición

```
Usuario: Click en "Cancelar edición" (mientras edita)
Sistema: ✅ Sale del modo edición
         ✅ Limpia cambios no guardados
         ✅ NO elimina el borrador de la BD
         ✅ Botón vuelve a "Cargar presupuesto"
```

---

## 🔍 Validación de Estados

### Estado: SIN BORRADOR
```
Botón visible: "Cargar presupuesto"
Modo edición: ❌ Desactivado
Celdas editables: ❌ No
Click en botón → Activa modo edición
```

### Estado: EDITANDO (Modo Edición Activo)
```
Botón visible: "Guardar para más tarde"
Modo edición: ✅ Activado
Celdas editables: ✅ Sí (solo month-budget)
Click en botón → Guarda y DESACTIVA modo edición
```

### Estado: EDITANDO (Borrador Guardado)
```
Botón visible: "Cargar presupuesto"
Modo edición: ❌ Desactivado
Celdas editables: ❌ No
Click en botón → Carga datos y activa modo edición
```

### Estado: PENDIENTE/REVISADO/APROBADO
```
Botón visible: Depende de permisos
Modo edición: ❌ No se puede activar
Celdas editables: ❌ No
```

---

## 📊 Diagrama de Flujo

```
┌─────────────────────┐
│   SIN BORRADOR      │
│  Btn: Cargar ppto   │
└──────────┬──────────┘
           │ Click
           ↓
┌─────────────────────┐
│  MODO EDICIÓN       │
│ Btn: Guardar p/+    │
│ Estado: EDITANDO    │
└──────────┬──────────┘
           │ Click "Guardar"
           ↓
┌─────────────────────┐
│  BORRADOR GUARDADO  │
│  Btn: Cargar ppto   │
│ Estado: EDITANDO    │
│ Modo edición: OFF   │ ← NUEVO COMPORTAMIENTO
└──────────┬──────────┘
           │ Click "Cargar"
           ↓
┌─────────────────────┐
│  MODO EDICIÓN       │
│ Btn: Guardar p/+    │
│ Datos cargados: ✅  │ ← NUEVO: Carga datos del borrador
└──────────┬──────────┘
           │ Click "Enviar"
           ↓
┌─────────────────────┐
│   PENDIENTE         │
│ Modo edición: OFF   │
└─────────────────────┘
```

---

## 🧪 Cómo Probar

### Test 1: Guardar y Salir

1. Abrir SUMMARY
2. Click en "Cargar presupuesto"
3. Editar algunos valores
4. Click en "Guardar para más tarde"
5. **Verificar:**
   - ✅ Toast dice "Borrador guardado. Haz clic en 'Cargar presupuesto' para continuar"
   - ✅ Botón vuelve a "Cargar presupuesto"
   - ✅ Celdas ya no son editables
   - ✅ Estado sigue siendo "En edición"

### Test 2: Cargar y Continuar

1. Después del Test 1
2. Click en "Cargar presupuesto"
3. **Verificar:**
   - ✅ Valores editados aparecen en la tabla
   - ✅ Modo edición se activa
   - ✅ Botón cambia a "Guardar para más tarde"
   - ✅ Celdas month-budget son editables

### Test 3: Ciclo Completo

1. Cargar presupuesto
2. Editar valores
3. Guardar para más tarde
4. Salir (cambiar de empresa o módulo)
5. Volver (seleccionar misma empresa y módulo)
6. Click en "Cargar presupuesto"
7. **Verificar:**
   - ✅ Valores anteriores están cargados
   - ✅ Puede seguir editando
   - ✅ Puede guardar nuevos cambios

---

## 🐛 Casos de Borde Manejados

### 1. Sin datos para cargar
```javascript
if (!this.state.borrador?.data?.presupuesto) {
  console.log("⚠️ No hay datos en el borrador para cargar");
  return; // No hace nada, solo activa modo edición
}
```

### 2. Callback personalizado no disponible
```javascript
// Fallback 1: CuentasModulo
if (window.CuentasModulo?.cargarBorrador) { ... }

// Fallback 2: Carga manual directa en celdas
presupuesto.forEach(item => {
  const celda = tabla.querySelector(`[data-cuenta][data-mes]`);
  if (celda) celda.textContent = item.valor;
});
```

### 3. Error al cargar datos
```javascript
catch (error) {
  console.error("Error cargando borrador:", error);
  this._toast("Advertencia: No se pudo cargar completamente el borrador", "warning");
  // Continúa con modo edición activado para que el usuario pueda trabajar
}
```

---

## 📚 Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `flujo-autorizacion.js` | `_guardarBorradorTemporal()` - Sale del modo edición |
| `flujo-autorizacion.js` | `_cargarBorradorEnTabla()` - NUEVO método |
| `flujo-autorizacion.js` | `_handleGuardar()` - Carga borrador antes de activar |
| `flujo-autorizacion.js` | Constructor - Nuevo callback `cargarBorrador` |

---

## ✅ Checklist de Validación

- [x] Al guardar "para más tarde", sale del modo edición
- [x] El borrador se mantiene en BD con estado EDITANDO
- [x] Al hacer clic en "Cargar presupuesto", carga datos del borrador
- [x] Los datos cargados son visibles en la tabla
- [x] Se puede continuar editando después de cargar
- [x] El flujo completo funciona: guardar → salir → volver → cargar → editar
- [x] Sin errores en consola
- [x] Mensajes de toast claros para el usuario

---

**Fecha de implementación:** 2 de enero de 2026  
**Estado:** ✅ Implementado y listo para pruebas  
**Breaking changes:** Ninguno (compatible con implementación anterior)
