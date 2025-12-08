# 🔧 FIX: Botones Cancelar en Modales - Explicación Técnica

## Problema Identificado

Los botones "Cancelar" y "Descartar" en los modales NO funcionaban en ningún módulo (Resumen, Presupuestos, etc.).

## Causa Raíz

**Bootstrap's `data-bs-dismiss="modal"` NO funciona en elementos creados dinámicamente** después de que la página se carga inicialmente.

En el código original, los modales se creaban dinámicamente con:
```javascript
const modal = document.createElement('div');
modal.innerHTML = `
  <div class="modal-footer">
    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
  </div>
`;
```

Bootstrap inicializa sus data attributes solo en elementos presentes en el DOM al cargar la página. Los elementos creados dinámicamente después NO son procesados por Bootstrap, así que `data-bs-dismiss` nunca funciona.

## Solución Implementada

Agregué **listeners explícitos** de click en los botones "Cancelar" en AMBAS funciones modales:

### En `_mostrarConfirmacion()`:
```javascript
// Agregar listener explícito al botón Cancelar (para modales creados dinámicamente)
if (btnCancelar) {
  btnCancelar.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    bsModal.hide();  // ← Cierra el modal
  }, { once: true });
}
```

### En `_mostrarEntradaConfirmacion()`:
```javascript
// Agregar listener explícito al botón Cancelar (para modales creados dinámicamente)
const btnCancelar = modal.querySelector('[data-bs-dismiss="modal"]');
if (btnCancelar) {
  btnCancelar.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    bsModal.hide();  // ← Cierra el modal
  }, { once: true });
}
```

## Cómo Funciona Ahora

1. **Usuario hace clic en "Cancelar"**
2. **El listener dispara `bsModal.hide()`**
3. **Bootstrap oculta el modal**
4. **Se dispara el evento `hidden.bs.modal`**
5. **El listener de `hidden.bs.modal` ejecuta `handleCierre()`**
6. **La Promise se resuelve con `false` (no confirmado)**

## Beneficios Adicionales

- **`{ once: true }`**: El listener se elimina automáticamente después del primer clic (previene duplicados)
- **`ev.preventDefault()` y `ev.stopPropagation()`**: Evita comportamientos inesperados de Bootstrap
- **`resuelto` flag**: Evita que la Promise se resuelva dos veces (una en `hidden.bs.modal` y otra manualmente)

## Archivos Modificados

- ✅ `vistas/js/flujo-autorizacion.js` - Ambas funciones modales

## Testing

Después de esta corrección:
- ✅ Botón "Cancelar" en modal de autorización → Cierra modal
- ✅ Botón "Cancelar" en modal de rechazo → Cierra modal  
- ✅ Botón "Descartar" → Cierra modal sin ejecutar acción
- ✅ Botón X → Cierra modal (ya funcionaba)
- ✅ Clic fuera del modal → NO cierra (backdrop: 'static')

## Commits
- ✅ `db7ca6e` - fix: Agregar listeners explícitos a botones Cancelar en modales dinámicos
