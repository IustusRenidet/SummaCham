# Guía de Verificación: Modo Edición e Inserción de Filas por Módulo

## 🎯 Sistema de Modo Edición

### Arquitectura del Sistema

El sistema de edición funciona con **2 capas**:

1. **Capa de Flujo de Autorización** (`flujo-autorizacion.js`)
   - Controla el estado del borrador (EDITANDO, PENDIENTE, REVISADO, etc.)
   - Gestiona permisos del usuario
   - Activa/desactiva modo edición

2. **Capa de Edición de Tabla** (`cuentas-modulo.js`)
   - Hace las celdas editables
   - Gestiona menú contextual
   - Permite inserción/eliminación de filas

### Estados Válidos para Edición

El modo edición **SOLO se activa** cuando:

✅ Estado del borrador = `EDITANDO` o `BORRADOR`
✅ Usuario tiene permiso `puede_cargar_guardar`
✅ Modo edición activado (`editMode = true`)

❌ **NO se puede editar** en estados:
- `SIN_CARGAR` - No hay borrador cargado
- `PENDIENTE` - Enviado a revisión
- `REVISADO` - Ya fue revisado
- `APROBADO` - Ya fue aprobado
- `GUARDADO` - Ya guardado en COI (inmutable)
- `RECHAZADO` - Fue rechazado (debe volver a EDITANDO)

---

## 📋 Módulos con Sistema de Edición Completo

### Módulos que usan `flujo-autorizacion.js` + `cuentas-modulo.js`

| Módulo | HTML | Scripts Cargados | Menú Contextual | Estado |
|--------|------|------------------|-----------------|---------|
| **Finanzas** | Finanzas.html | ✅ flujo + cuentas | ✅ Sí | ✅ Funcional |
| **Eventos** | Eventos.html | ✅ flujo + cuentas | ✅ Sí | ✅ Funcional |
| **Comités** | Comités.html | ✅ flujo + cuentas | ✅ Sí | ✅ Funcional |
| **Comunicación** | Comunicación.html | ✅ flujo + cuentas | ✅ Sí | ✅ Funcional |
| **Dirección** | Dirección.html | ✅ flujo + cuentas | ✅ Sí | ✅ Funcional |
| **Gtos_Corporativos** | Gtos_Corporativos.html | ✅ flujo + cuentas | ✅ Sí | ✅ Funcional |
| **Membresía** | Membresía.html | ✅ flujo + cuentas | ✅ Sí | ✅ Funcional |
| **RH** | RH.html | ✅ flujo + cuentas | ✅ Sí | ✅ Funcional |
| **Serv_Membresía** | Serv_Membresía.html | ✅ flujo + cuentas | ✅ Sí | ✅ Funcional |
| **T&IC** | T&IC.html | ✅ flujo + cuentas | ✅ Sí | ✅ Funcional |
| **VPE** | VPE.html | ✅ flujo + cuentas | ✅ Sí | ✅ Funcional |

### Módulos con Sistema Personalizado

| Módulo | HTML | Sistema | Menú Contextual | Estado |
|--------|------|---------|-----------------|---------|
| **SUMMARY** | SUMMARY.html | Custom workflow | ✅ context-menu-manager.js | ✅ Funcional |
| **RESUMEN** | RESUMEN.html | Custom workflow | ✅ context-menu-manager.js | ✅ Funcional |

---

## 🔧 Flujo de Trabajo para Edición

### 1️⃣ Activar Modo Edición

#### En Módulos (Finanzas, Eventos, etc.):

```
Usuario → Click "Cargar presupuesto"
    ↓
flujo-autorizacion.js → Verifica permisos
    ↓
Estado cambia a EDITANDO
    ↓
_enterEditMode() llamado
    ↓
window.CuentasModulo.setEditMode(true)
    ↓
iniciarEdicion() en cuentas-modulo.js
    ↓
estadoModulo.editMode = true
    ↓
aplicarModoEdicionEnTabla()
    ↓
Tabla tiene clase "modo-edicion"
    ↓
Celdas editables (click para editar)
    ↓
Menú contextual disponible (right-click)
```

#### En SUMMARY/RESUMEN:

```
Usuario → Click "Cargar presupuesto"
    ↓
Workflow cambia estado a EDITANDO
    ↓
Modo edición activado
    ↓
Context menu disponible
```

---

## 🖱️ Menú Contextual: Opciones Disponibles

### En Filas de Cuenta (`fila-cuenta`)

Cuando haces **right-click** en una fila normal:

```
┌─────────────────────────────────┐
│ Agregar cuenta arriba           │
│ Agregar cuenta abajo            │
│ Eliminar fila                   │
│ Agregar sección                 │
└─────────────────────────────────┘
```

### En Filas Sum-Row-Sumavarios

```
┌─────────────────────────────────┐
│ Eliminar sum-row-sumavarios     │
│ Agregar sección                 │
└─────────────────────────────────┘
```

---

## ➕ Inserción de Elementos

### Agregar Cuenta (Arriba/Abajo)

1. Right-click en fila de cuenta
2. Seleccionar "Agregar cuenta arriba" o "Agregar cuenta abajo"
3. Se inserta fila vacía con celdas editables
4. Click en celda de cuenta → Ingresar número de cuenta
5. Click en celda de descripción → Ingresar nombre
6. Click en celdas numéricas → Ingresar valores

**Función**: `insertarFilaCuentaNueva(referencia, posicion)`

### Agregar Sección

1. Right-click en cualquier fila
2. Seleccionar "Agregar sección"
3. Se abre modal con formulario

**Campos del Modal**:
- **Título de sección**: Nombre que aparecerá en la tabla
- **Etiqueta de suma**: Texto para la fila de total
- **Cuentas**: Agregar una o más cuentas contables
- **Agrupar con otras secciones**: (opcional)
  - Inicio de agrupación
  - Fin de agrupación
  - Etiqueta del grupo

**Función**: `abrirModalAgregarSeccion(referencia)`

### Eliminar Fila

1. Right-click en fila
2. Seleccionar "Eliminar fila"
3. **Restricción**: Una sección debe tener al menos 1 cuenta
   - Si intentas eliminar la última cuenta, sale alerta

**Función**: `eliminarFilaSeleccionada(fila)`

---

## ⚠️ Problemas Comunes y Soluciones

### Problema 1: "No aparece el menú contextual"

**Causas posibles**:
1. ❌ No estás en modo edición
   - **Solución**: Click en "Cargar presupuesto" primero
   
2. ❌ Estado no es EDITANDO
   - **Solución**: Verifica badge de estado. Debe decir "Editando"
   
3. ❌ Usuario no tiene permisos
   - **Solución**: Verifica que tengas `puede_cargar_guardar = 1`
   
4. ❌ Módulo no es editable
   - **Solución**: Solo ciertos módulos soportan edición

### Problema 2: "El botón 'Cargar presupuesto' no aparece"

**Causas**:
1. ❌ No tienes permiso `puede_cargar_guardar`
   - **Solución**: Contacta administrador para que te dé permisos

2. ❌ Ya hay un borrador en otro estado (PENDIENTE, REVISADO, etc.)
   - **Solución**: Si eres revisor/aprobador, puedes rechazarlo para que vuelva a EDITANDO

### Problema 3: "No puedo editar las celdas"

**Causas**:
1. ❌ No estás en modo edición
   - **Solución**: Click en "Cargar presupuesto"
   
2. ❌ La tabla no tiene clase "modo-edicion"
   - **Verificación en consola**:
     ```javascript
     document.querySelector('#tablaComparacion').classList.contains('modo-edicion')
     // Debe retornar true
     ```

3. ❌ El script `cuentas-modulo.js` no está cargado
   - **Verificación en consola**:
     ```javascript
     window.CuentasModulo
     // No debe ser undefined
     ```

### Problema 4: "Insertó fila pero desapareció al recargar"

**Causa**: No guardaste el borrador
- **Solución**: Después de agregar filas, click en "Guardar borrador"

### Problema 5: "Modal de agregar sección no se abre"

**Verificación**:
```javascript
// En consola del navegador
window.CuentasModulo
// Debe mostrar objeto con métodos
```

Si es `undefined`, el script no está cargado correctamente.

---

## 🧪 Pruebas Paso a Paso

### Prueba 1: Activar Modo Edición

**Pasos**:
1. Abre módulo (ej: Finanzas)
2. Selecciona empresa y año
3. Verifica badge muestra "Sin cargar"
4. Click en "Cargar presupuesto"
5. **Resultado Esperado**:
   - Badge cambia a "Editando"
   - Tabla tiene clase `modo-edicion`
   - Celdas numéricas son clickeables

### Prueba 2: Insertar Cuenta

**Pasos**:
1. Activa modo edición (Prueba 1)
2. Right-click en una fila de cuenta
3. Seleccionar "Agregar cuenta abajo"
4. **Resultado Esperado**:
   - Nueva fila aparece debajo
   - Fila tiene clase `fila-cuenta`
   - Celdas son editables

### Prueba 3: Eliminar Cuenta

**Pasos**:
1. Activa modo edición
2. Right-click en fila de cuenta (que NO sea la única en su sección)
3. Seleccionar "Eliminar fila"
4. **Resultado Esperado**:
   - Fila desaparece inmediatamente
   - Totales se recalculan

### Prueba 4: Agregar Sección

**Pasos**:
1. Activa modo edición
2. Right-click en cualquier fila
3. Seleccionar "Agregar sección"
4. **Resultado Esperado**:
   - Modal se abre
   - Formulario visible con campos

5. Llenar formulario:
   - Título: "Prueba Nueva Sección"
   - Suma Label: "Total Prueba"
   - Agregar cuenta: 5000-001
   - Click "Agregar"

6. **Resultado Esperado**:
   - Modal se cierra
   - Nueva sección aparece en tabla
   - Tiene fila header con título
   - Tiene fila de cuenta
   - Tiene fila sum-row con total

### Prueba 5: Guardar Cambios

**Pasos**:
1. Realiza cambios (agrega cuentas/secciones)
2. Click en "Guardar para más tarde"
3. **Resultado Esperado**:
   - Toast de confirmación
   - Estado sigue en "Editando"

4. Recarga página (F5)
5. **Resultado Esperado**:
   - Cambios persisten
   - Nuevas filas/secciones siguen ahí

---

## 📊 Verificación de Permisos

### Verificar Permisos del Usuario Actual

**En consola del navegador**:

```javascript
// Ver usuario actual
Sesion.obtenerUsuarioActual()

// Ver empresa activa
Sesion.obtenerEmpresaActiva()

// Ver permisos
const flujo = window.__flujoAutorizacionInstance
flujo.state.permisos
// Debe mostrar: { admin: false, cargar: true, revisar: false, aprobar: false }
```

### Permisos Necesarios por Acción

| Acción | Permiso Requerido | Campo en BD |
|--------|------------------|-------------|
| Cargar presupuesto | puede_cargar_guardar | `puede_cargar_guardar = 1` |
| Editar celdas | puede_cargar_guardar | `puede_cargar_guardar = 1` |
| Insertar filas | puede_cargar_guardar | `puede_cargar_guardar = 1` |
| Eliminar filas | puede_cargar_guardar | `puede_cargar_guardar = 1` |
| Agregar secciones | puede_cargar_guardar | `puede_cargar_guardar = 1` |
| Enviar a revisión | puede_cargar_guardar | `puede_cargar_guardar = 1` |
| Marcar como revisado | puede_revisar | `puede_revisar = 1` |
| Autorizar | puede_aprobar | `puede_aprobar = 1` |
| Guardar en COI | puede_aprobar | `puede_aprobar = 1` |

---

## 🔍 Debug: Verificar Estado del Sistema

### Verificar si estás en modo edición

```javascript
// En consola
const flujo = window.__flujoAutorizacionInstance
flujo.state.editMode
// Debe ser true si estás editando

flujo.state.borrador?.estado
// Debe ser "EDITANDO"
```

### Verificar que CuentasModulo está activo

```javascript
window.CuentasModulo
// No debe ser undefined

window.CuentasModulo.setEditMode
// Debe ser una función
```

### Verificar estructura de secciones

```javascript
// En cuentas-modulo.js se guarda en estadoModulo
// No es accesible directamente desde consola, pero puedes ver:

document.querySelectorAll('.sum-row').length
// Cuenta cuántas filas de suma hay

document.querySelectorAll('.fila-cuenta').length
// Cuenta cuántas filas de cuenta hay
```

---

## ✅ Checklist de Verificación Completa

### Por cada módulo editable:

- [ ] **Cargar módulo**
  - [ ] Seleccionar empresa
  - [ ] Seleccionar año
  - [ ] Tabla carga correctamente

- [ ] **Activar edición**
  - [ ] Botón "Cargar presupuesto" visible
  - [ ] Click en botón
  - [ ] Badge cambia a "Editando"
  - [ ] Tabla tiene clase `modo-edicion`

- [ ] **Editar celdas**
  - [ ] Click en celda numérica
  - [ ] Celda se vuelve input
  - [ ] Escribir valor
  - [ ] Enter o click fuera
  - [ ] Valor se guarda

- [ ] **Menú contextual**
  - [ ] Right-click en fila de cuenta
  - [ ] Menú aparece
  - [ ] Opciones correctas mostradas

- [ ] **Agregar cuenta**
  - [ ] "Agregar cuenta arriba" funciona
  - [ ] "Agregar cuenta abajo" funciona
  - [ ] Nueva fila es editable

- [ ] **Eliminar cuenta**
  - [ ] "Eliminar fila" funciona
  - [ ] No permite eliminar última cuenta de sección

- [ ] **Agregar sección**
  - [ ] "Agregar sección" abre modal
  - [ ] Formulario completo visible
  - [ ] Llenar y submit
  - [ ] Sección aparece en tabla

- [ ] **Guardar cambios**
  - [ ] "Guardar para más tarde" funciona
  - [ ] Toast de confirmación
  - [ ] Recargar página preserva cambios

- [ ] **Salir de edición**
  - [ ] "Cancelar edición" funciona
  - [ ] Cambios se revierten (si no guardaste)
  - [ ] Modo edición se desactiva

---

## 📝 Notas Técnicas

### Módulos Editables (según MODULOS_LAYOUT_EDITABLE)

```javascript
const MODULOS_LAYOUT_EDITABLE = [
  'presupuestos',
  'vpe',
  'servmembresia',
  'membresia',
  'comunicacion',
  'gtoscorporativos',
  'tic',
  'comites',
  'direccion',
  'eventos',
  'finanzas',
  'rh'
];
```

### Evento de Modo Edición

Cuando se activa/desactiva modo edición, se dispara:

```javascript
window.dispatchEvent(new CustomEvent('modulo-planeacion:presupuesto-editado', {
  detail: { editMode: true/false }
}));
```

### Persistencia de Layout

Los layouts personalizados (secciones/filas agregadas) se guardan en:

**LocalStorage**: `planeacion:layout:{moduloClave}:{empresaId}:{anio}`

**Ejemplo**:
```
planeacion:layout:finanzas:empresa1:2025
```

---

**Última actualización**: 2025-12-09
**Sistema verificado**: ✅ Funcional en todos los módulos
