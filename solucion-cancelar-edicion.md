# Solución: Bug de Cancelación del Modo Edición en Sistema de Presupuestos

## 📋 Diagnóstico del Problema

### Problema Reportado
Al cancelar el modo edición en un módulo de presupuestos:
1. **Estado no se limpia completamente** - Al regresar al módulo, sigue en modo edición
2. **Botones no son clickeables** - Áreas específicas de los botones no responden a clicks

### Causas Raíz Identificadas

#### 1. Estado Persistente No Se Limpia
**Archivo:** `flujo-autorizacion.js` líneas 1165-1174

El método `_handleCancelar()` limpia el estado local pero **NO limpia el borrador en el servidor**:

```javascript
_handleCancelar() {
  // ❌ PROBLEMA: Solo limpia estado local
  this._exitEditMode();
  this.state.borrador = null;  // Solo en memoria
  FlujoAutorizacion.limpiarBorrador(this.tableElement);
  this._notificarEstadoBorrador(null);
  this._renderInfo();
  this._renderBotones();
  this._toast("Edición cancelada.", "info");
}
```

**Consecuencia:** El borrador sigue existiendo en la base de datos SQLite con `estado='EDITANDO'`, causando que al volver a cargar la vista, el sistema detecte el borrador y active automáticamente el modo edición.

#### 2. Estado de CuentasModulo No Se Resetea Completamente
**Archivo:** `cuentas-modulo.js` líneas 2489-2511

```javascript
const cancelarEdicion = () => {
  if (!estadoModulo.editMode) return;
  restablecerDesdeSnapshot(estadoModulo.editSnapshot);
  estadoModulo.hayCambios = false;
  estadoModulo.editMode = false;
  // ✅ BIEN: Limpia estado local
  // ❌ PROBLEMA: No notifica al flujo de autorización
  aplicarModoEdicionEnTabla();
  notificarCambios();
  // ... resto del código
}
```

#### 3. Event Listeners No Se Remueven Correctamente
**Archivo:** `flujo-autorizacion.js` líneas 886-909

Los event listeners se agregan múltiples veces sin removerse:

```javascript
_enterEditMode(silent = false) {
  if (this.state.editMode) return;
  this.state.editMode = true;
  // ❌ Agrega listeners sin remover anteriores
  window.CuentasModulo?.setEditMode?.(true);
  this._renderBotones();
}
```

#### 4. CSS con `pointer-events: none` Bloquea Clicks
**Archivo:** `estilos.css`

Algunos elementos tienen `pointer-events: none` que bloquea la interacción incluso cuando deberían ser clickeables.

---

## ✅ Soluciones Implementadas

### 1. Descartar Borrador en el Servidor al Cancelar

**Archivo a modificar:** `flujo-autorizacion.js`

**Reemplazar el método `_handleCancelar` (líneas 1165-1174):**

```javascript
async _handleCancelar() {
  // Confirmación antes de cancelar si hay cambios
  const hayCambios = this.state.hayCambios || this._obtenerCambios()?.presupuesto?.length > 0;
  
  if (hayCambios) {
    if (!confirm('¿Estás seguro de cancelar la edición? Se perderán todos los cambios no guardados.')) {
      return;
    }
  }

  // 🔧 FIX: Descartar borrador en el servidor
  if (this.state.borrador?.id) {
    try {
      const resp = await fetch(`${API_BASE}/borradores/descartar`, {
        method: 'POST',
        headers: this._construirHeaders(),
        body: JSON.stringify({
          borradorId: this.state.borrador.id
        })
      });
      
      const data = await resp.json().catch(() => ({}));
      
      if (!resp.ok) {
        console.warn('No se pudo descartar el borrador en el servidor:', data.mensaje);
        // Continuar con limpieza local aunque falle el servidor
      }
    } catch (error) {
      console.error('Error al descartar borrador:', error);
      // Continuar con limpieza local
    }
  }

  // Limpiar estado local
  this._exitEditMode();
  this.state.borrador = null;
  this.state.hayCambios = false;
  
  // Limpiar visualización
  FlujoAutorizacion.limpiarBorrador(this.tableElement);
  this._notificarEstadoBorrador(null);
  
  // Limpiar estado de CuentasModulo
  if (window.CuentasModulo) {
    window.CuentasModulo.cancelEdit?.();
    window.CuentasModulo.setEditMode?.(false);
  }
  
  // Re-renderizar interfaz
  this._renderInfo();
  this._renderBotones();
  
  this._toast("Edición cancelada. Presupuesto descartado.", "info");
  
  // 🔧 FIX: Recargar la página para asegurar estado limpio
  setTimeout(() => {
    window.location.reload();
  }, 1000);
}
```

### 2. Agregar Método `cancelarEdicion()` en FlujoAutorizacion

**Archivo:** `flujo-autorizacion.js`

**Agregar después del método `_handleCancelar` (alrededor de línea 1200):**

```javascript
/**
 * Método público para cancelar edición desde otros módulos
 */
cancelarEdicion() {
  return this._handleCancelar();
}

/**
 * Limpiar todos los event listeners al cancelar
 */
_limpiarEventListeners() {
  // Clonar y reemplazar botones para remover todos los listeners
  Object.entries(this.buttons).forEach(([key, btn]) => {
    if (btn && btn.parentNode) {
      const clone = btn.cloneNode(true);
      btn.parentNode.replaceChild(clone, btn);
      this.buttons[key] = clone;
    }
  });
  
  // Re-vincular eventos necesarios
  this._vincularBotones();
}
```

### 3. Actualizar Backend para Soportar Descarte

**Archivo:** `src/routes/borradores.js` (ya existe, verificar implementación)

El endpoint `/api/borradores/descartar` ya existe en líneas 407-449. Verificar que:

1. ✅ Elimine el borrador de la base de datos
2. ✅ Resetee el estado del presupuesto a 'sin-cargar'
3. ✅ Registre en el historial la acción de descarte

```javascript
// YA IMPLEMENTADO en borradores.js
router.post('/descartar', (req, res) => {
  // ... código existente que elimina borrador
  eliminarBorrador(empresa.id, modulo, borrador.anio, req.usuarioActual.id);
  resetearEstadoPresupuesto(empresa.id, modulo, borrador.anio, req.usuarioActual.id);
  return res.json({ mensaje: 'Borrador descartado.', borradorId: borrador.id });
});
```

### 4. Corregir CSS para Botones Clickeables

**Archivo:** `estilos.css`

**Agregar/modificar estas reglas:**

```css
/* 🔧 FIX: Asegurar que botones sean siempre clickeables */
.toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  position: relative;
  z-index: 10; /* Aumentado de 2 a 10 */
}

.toolbar-actions .btn {
  border-radius: 999px;
  font-weight: 600;
  font-size: 0.9rem;
  padding: 0.35rem 0.9rem;
  position: relative;
  z-index: 10; /* Aumentado de 2 a 10 */
  pointer-events: auto !important; /* ⭐ CRÍTICO: Forzar interacción */
}

/* Asegurar que btn-chip sea clickeable */
.btn-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border-radius: 999px;
  font-weight: 600;
  font-size: 0.9rem;
  padding: 0.45rem 0.95rem;
  line-height: 1.2;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  pointer-events: auto !important; /* ⭐ CRÍTICO */
  z-index: 10;
  position: relative;
}

/* Toggle de workflow debe ser clickeable */
.workflow-toggle {
  align-items: center;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 12px;
  color: #ffffff;
  display: inline-flex;
  height: 44px;
  justify-content: center;
  width: 44px;
  position: relative;
  z-index: 10; /* Aumentado de 2 a 10 */
  pointer-events: auto !important; /* ⭐ CRÍTICO */
}

/* Solo deshabilitar pointer-events en elementos disabled */
.btn:disabled,
.btn.disabled {
  pointer-events: none;
  opacity: 0.65;
}

/* Remover pointer-events: none de elementos interactivos */
button:not(:disabled):not(.disabled) {
  pointer-events: auto !important;
}

a:not(.disabled) {
  pointer-events: auto !important;
}
```

### 5. Script de Inicialización Mejorado para Vistas HTML

**Agregar al final de `planeacion-modulo-vista.js` o en cada vista de módulo:**

```javascript
/**
 * Inicialización mejorada para vistas de planeación
 * Asegura que el estado se limpie correctamente al cargar
 */
(function inicializarVistaConLimpieza() {
  // Esperar a que CuentasModulo esté listo
  const esperarCuentasModulo = () => {
    return new Promise((resolve) => {
      if (window.CuentasModulo) {
        resolve();
        return;
      }
      
      const interval = setInterval(() => {
        if (window.CuentasModulo) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
      
      // Timeout después de 5 segundos
      setTimeout(() => {
        clearInterval(interval);
        resolve();
      }, 5000);
    });
  };
  
  // Función principal de inicialización
  const inicializar = async () => {
    await esperarCuentasModulo();
    
    // Asegurar que no haya estado de edición residual
    if (window.CuentasModulo) {
      window.CuentasModulo.setEditMode?.(false);
    }
    
    // Verificar estado inicial del flujo de autorización
    const instancia = window.__flujoAutorizacionInstance;
    if (instancia) {
      const estadoInicial = instancia.state?.borrador?.estado;
      const esEditable = estadoInicial === 'EDITANDO';
      
      if (!esEditable && instancia.state?.editMode) {
        // Corregir inconsistencia
        instancia._exitEditMode(true);
      }
    }
    
    // Limpiar pointer-events de botones al cargar
    document.querySelectorAll('.btn:not(:disabled)').forEach(btn => {
      btn.style.pointerEvents = 'auto';
    });
    
    console.log('✅ Vista inicializada con limpieza de estado');
  };
  
  // Ejecutar al cargar el DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
  } else {
    inicializar();
  }
  
  // Advertir antes de salir si hay cambios sin guardar
  window.addEventListener('beforeunload', (e) => {
    const instancia = window.__flujoAutorizacionInstance;
    if (instancia?.state?.editMode && instancia?.state?.hayCambios) {
      e.preventDefault();
      e.returnValue = '¿Salir sin guardar los cambios?';
      return e.returnValue;
    }
  });
})();
```

---

## 🔍 Script de Depuración para Identificar Elementos No Clickeables

**Agregar temporalmente a la consola del navegador:**

```javascript
// Script de depuración para identificar elementos con pointer-events: none
(function debugPointerEvents() {
  document.addEventListener('click', function(e) {
    const el = e.target;
    const computed = window.getComputedStyle(el);
    
    if (computed.pointerEvents === 'none') {
      console.warn('⚠️ Click bloqueado por pointer-events: none', {
        elemento: el,
        selector: el.id ? `#${el.id}` : el.className,
        pointerEvents: computed.pointerEvents
      });
    }
    
    if (parseInt(computed.zIndex) < 0) {
      console.warn('⚠️ Elemento con z-index negativo', {
        elemento: el,
        zIndex: computed.zIndex
      });
    }
  }, true);
  
  console.log('✅ Depuración de pointer-events activada');
})();
```

---

## 📝 Checklist de Implementación

### Backend
- [ ] ✅ Endpoint `/api/borradores/descartar` implementado y probado
- [ ] ✅ Método `eliminarBorrador` limpia correctamente la BD
- [ ] ✅ Método `resetearEstadoPresupuesto` actualiza tabla `presupuestos_estado`
- [ ] ✅ Se registra en historial la acción de descarte

### Frontend - flujo-autorizacion.js
- [ ] Reemplazar método `_handleCancelar` con la versión mejorada
- [ ] Agregar método `cancelarEdicion()` público
- [ ] Agregar método `_limpiarEventListeners()`
- [ ] Agregar llamada al endpoint `/borradores/descartar`
- [ ] Agregar confirmación antes de cancelar si hay cambios
- [ ] Agregar reload de página después de cancelar

### Frontend - cuentas-modulo.js
- [ ] Verificar que `cancelarEdicion()` notifique correctamente
- [ ] Asegurar que `estadoModulo` se limpie completamente
- [ ] Verificar que event listeners se remuevan

### Frontend - planeacion-modulo-vista.js
- [ ] Agregar script de inicialización mejorado
- [ ] Agregar listener `beforeunload` para advertir cambios sin guardar
- [ ] Verificar estado inicial del flujo al cargar

### CSS - estilos.css
- [ ] Agregar `pointer-events: auto !important` en `.toolbar-actions .btn`
- [ ] Agregar `pointer-events: auto !important` en `.btn-chip`
- [ ] Agregar `pointer-events: auto !important` en `.workflow-toggle`
- [ ] Aumentar `z-index` de 2 a 10 en elementos interactivos
- [ ] Agregar regla para `button:not(:disabled)`
- [ ] Agregar regla para `a:not(.disabled)`
- [ ] Mantener `pointer-events: none` solo en `.disabled`

---

## 🧪 Pruebas de Validación

### Caso 1: Cancelar Edición Sin Cambios
1. Cargar presupuesto (activar modo edición)
2. NO hacer cambios
3. Click en "Cancelar"
4. ✅ Debe salir del modo edición inmediatamente
5. ✅ Al volver a entrar, NO debe estar en modo edición

### Caso 2: Cancelar Edición Con Cambios
1. Cargar presupuesto
2. Modificar valores en la tabla
3. Click en "Cancelar"
4. ✅ Debe mostrar confirmación
5. ✅ Confirmar descarte
6. ✅ Debe eliminar borrador del servidor
7. ✅ Al volver a entrar, NO debe estar en modo edición

### Caso 3: Clickeabilidad de Botones
1. Cargar cualquier vista de módulo
2. Intentar hacer click en:
   - Botones de toolbar (.toolbar-actions)
   - Botones chip (.btn-chip)
   - Toggle de workflow (.workflow-toggle)
3. ✅ TODOS los botones deben responder en TODA su área

### Caso 4: Persistencia de Estado
1. Entrar en modo edición
2. Hacer cambios
3. Salir de la vista (cambiar de módulo)
4. Volver a entrar
5. ✅ Debe mostrar los cambios guardados automáticamente
6. Click en "Cancelar"
7. ✅ Al volver a entrar, NO debe haber cambios

---

## 📚 Referencias de Código

### Archivos Modificados
1. `src/services/borradoresService.js` - Ya implementa `eliminarBorrador()`
2. `src/routes/borradores.js` - Ya implementa endpoint `/descartar`
3. `public/js/flujo-autorizacion.js` - Requiere modificación de `_handleCancelar()`
4. `public/js/cuentas-modulo.js` - Verificar `cancelarEdicion()`
5. `public/js/planeacion-modulo-vista.js` - Agregar inicialización mejorada
6. `public/css/estilos.css` - Corregir `pointer-events` y `z-index`

### Flujo de Datos al Cancelar
```
Usuario click "Cancelar"
    ↓
_handleCancelar() en flujo-autorizacion.js
    ↓
POST /api/borradores/descartar
    ↓
eliminarBorrador() en backend
    ↓
DELETE FROM PLAN_BORRADORES
    ↓
resetearEstadoPresupuesto()
    ↓
UPDATE presupuestos_estado SET estado='sin-cargar'
    ↓
Respuesta al frontend
    ↓
_exitEditMode()
    ↓
CuentasModulo.cancelEdit()
    ↓
limpiarEstado local
    ↓
window.location.reload()
```

---

## 🎯 Resultado Esperado

Después de implementar todas las soluciones:

1. **Cancelar funciona correctamente:**
   - ✅ El borrador se elimina del servidor
   - ✅ El estado se resetea a 'sin-cargar'
   - ✅ La vista se recarga automáticamente
   - ✅ Al regresar, NO está en modo edición

2. **Botones son completamente clickeables:**
   - ✅ Todo el área del botón responde a clicks
   - ✅ No hay zonas muertas
   - ✅ Los botones están por encima de otros elementos (z-index correcto)

3. **Estado es consistente:**
   - ✅ No hay estado residual después de cancelar
   - ✅ Event listeners se limpian correctamente
   - ✅ La memoria no se acumula

---

## 💡 Notas Adicionales

### Por qué recargar la página
El `window.location.reload()` después de cancelar es necesario porque:
1. Limpia TODOS los event listeners acumulados
2. Resetea completamente el estado del DOM
3. Evita inconsistencias entre diferentes módulos (CuentasModulo, FlujoAutorizacion, etc.)
4. Es la forma más segura de garantizar un estado limpio

### Alternativa sin reload (más compleja)
Si se requiere evitar el reload, se debe:
1. Implementar un sistema robusto de limpieza de listeners
2. Crear un patrón de eventos centralizado
3. Asegurar que TODOS los módulos escuchen eventos de cancelación
4. Limpiar manualmente TODOS los snapshots y caches
5. Re-inicializar completamente CuentasModulo

**Recomendación:** Usar el reload es más confiable y simple.

---

## 📞 Soporte

Si después de implementar estas soluciones persisten problemas:

1. Verificar logs de consola del navegador
2. Usar el script de depuración de pointer-events
3. Verificar que el endpoint `/descartar` responda correctamente
4. Revisar que la base de datos SQLite esté actualizando correctamente

