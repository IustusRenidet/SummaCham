# Solución para Operaciones que No Aparecen en RESUMEN

## PROBLEMA
Las operaciones creadas en el Gestor de Plantillas no aparecen en las tablas del módulo RESUMEN.

## CAUSA RAÍZ
Las operaciones necesitan tener los campos `HOJA` y `CAPITULO` correctamente asignados para aparecer en el RESUMEN. Actualmente, estos campos se asignan automáticamente al guardar, PERO solo si la operación ya existe en la lista de operaciones del estado.

## SOLUCIÓN PASO A PASO

### Paso 1: Verificar Estado Actual

1. **En el Gestor de Plantillas**, carga:
   - Módulo: RESUMEN
   - Año: 2026
   - Capítulo: GUADALAJARA

2. **Abre la Consola (F12)** y ejecuta:
```javascript
// Ver operaciones cargadas
const ops = window.state.operaciones || [];
console.log('Total operaciones:', ops.length);
ops.forEach((op, i) => {
  const id = op.OperacionId || op.clase || op.Clase || '';
  const hoja = op.HOJA || 'SIN HOJA';
  const cap = op.CAPITULO || 'SIN CAPITULO';
  const visible = op.visible !== false;
  console.log(`${i+1}. ${id} - HOJA:${hoja} CAP:${cap} Visible:${visible}`);
});

// Buscar EJEMPLO específicamente
const ejemplo = ops.find(op => {
  const id = (op.OperacionId || op.clase || op.Clase || '').toUpperCase();
  return id.includes('EJEMPLO');
});
if (ejemplo) {
  console.log('=== EJEMPLO ENCONTRADO ===');
  console.log('HOJA:', ejemplo.HOJA);
  console.log('CAPITULO:', ejemplo.CAPITULO);
  console.log('visible:', ejemplo.visible);
  console.log('Objeto completo:', ejemplo);
} else {
  console.log('❌ EJEMPLO NO ENCONTRADO EN window.state.operaciones');
}
```

### Paso 2: Verificar en Base de Datos

```javascript
// Verificar qué se guardó en el servidor
const base = 'http://localhost:3005';
const url = `${base}/api/layouts-config/RESUMEN/2026/GUADALAJARA?empresaId=${window.state.empresaId || 'EMPRESA02'}`;

fetch(url, { 
  headers: window.Sesion?.headersAutenticacion ? window.Sesion.headersAutenticacion() : {} 
})
  .then(r => r.json())
  .then(data => {
    console.log('=== LAYOUT EN SERVIDOR ===');
    const ops = data.layout?.operaciones || [];
    console.log('Total operaciones en servidor:', ops.length);
    
    const ejemplo = ops.find(op => {
      const id = (op.OperacionId || op.clase || op.Clase || '').toUpperCase();
      return id.includes('EJEMPLO');
    });
    
    if (ejemplo) {
      console.log('✅ EJEMPLO encontrado en servidor:');
      console.log('  HOJA:', ejemplo.HOJA);
      console.log('  CAPITULO:', ejemplo.CAPITULO);
      console.log('  visible:', ejemplo.visible);
      console.log('  formula_json:', ejemplo.formula_json);
      console.log('Objeto completo:', ejemplo);
    } else {
      console.log('❌ EJEMPLO NO está en el servidor');
      console.log('Operaciones guardadas:', ops.map(o => o.OperacionId || o.Clase || o.clase));
    }
  })
  .catch(err => console.error('Error al consultar servidor:', err));
```

### Paso 3A: Si EJEMPLO Existe pero le Faltan Campos

Si el script anterior muestra que EJEMPLO existe pero `HOJA` o `CAPITULO` están vacíos o incorrectos:

1. **Edita la operación en el Gestor de Plantillas**
   - Click en "EJEMPLO"
   - Verifica que todos los campos estén completos

2. **Ejecuta en consola para forzar los campos:**
```javascript
// Forzar campos HOJA y CAPITULO
const ops = window.state.operaciones || [];
const ejemplo = ops.find(op => {
  const id = (op.OperacionId || op.clase || op.Clase || '').toUpperCase();
  return id.includes('EJEMPLO');
});

if (ejemplo) {
  ejemplo.HOJA = 'RESUMEN';
  ejemplo.CAPITULO = 'GUADALAJARA';
  ejemplo.visible = true;
  console.log('✅ Campos actualizados:', ejemplo);
  
  // Marcar como cambio sin guardar para que el botón Guardar se active
  window.state.unsavedChanges = true;
  if (window.updateButtonStates) window.updateButtonStates();
  
  console.log('Ahora haz click en "Guardar Layout"');
} else {
  console.log('❌ No se encontró EJEMPLO');
}
```

3. **Guarda el Layout**
   - Click en botón "Guardar Layout"
   - Espera confirmación

### Paso 3B: Si EJEMPLO NO Existe en Absoluto

Si EJEMPLO no aparece ni en `window.state.operaciones` ni en el servidor:

1. **Crea la operación nuevamente:**
   - En Gestor de Plantillas
   - Click en "+ Nueva Operación"
   - ID: `EJEMPLO`
   - Etiqueta: `EJEMPLO`
   - Fórmula: (la que corresponda, ej: `= Membership + Events`)

2. **Antes de guardar, ejecuta en consola:**
```javascript
// Agregar directamente a state.operaciones
const nuevaOp = {
  OperacionId: 'EJEMPLO',
  Clase: 'EJEMPLO',
  Etiqueta: 'EJEMPLO',
  HOJA: 'RESUMEN',
  CAPITULO: 'GUADALAJARA',
  visible: true,
  orden: 100,
  orden_presentacion: 100,
  formula_terms: [
    { type: 'account', ref: 'Membership', sign: 1 },
    { type: 'account', ref: 'Events', sign: 1 }
  ],
  formula_json: JSON.stringify([
    { type: 'account', ref: 'Membership', sign: 1 },
    { type: 'account', ref: 'Events', sign: 1 }
  ])
};

window.state.operaciones = window.state.operaciones || [];
window.state.operaciones.push(nuevaOp);
window.state.unsavedChanges = true;
if (window.updateButtonStates) window.updateButtonStates();
if (window.renderLayout) window.renderLayout();

console.log('✅ Operación agregada. Ahora guarda el layout.');
```

3. **Guarda el Layout**

### Paso 4: Verificar en el Módulo RESUMEN

1. **Ve al módulo RESUMEN**
   - Selecciona: GUADALAJARA / 2026 / Enero (o mes actual)

2. **Abre la Consola (F12)**

3. **Verifica que el layout cargado contenga la operación:**
```javascript
// Ver qué layout se cargó
console.log('Layout cargado:', window.ModoEdicionPresupuesto);

// Si hay un layoutData global
if (window.layoutData) {
  console.log('Operaciones en layoutData:', window.layoutData.operaciones);
}

// Buscar bloques de tipo operation en el DOM
const operationRows = document.querySelectorAll('.operation-row, .free-operation-row');
console.log('Filas de operaciones renderizadas:', operationRows.length);
operationRows.forEach((row, i) => {
  console.log(`${i+1}.`, row.textContent.trim().substring(0, 50));
});
```

4. **Si todavía no aparece:**
   - Recarga la página con Ctrl+F5
   - Vuelve a cargar el módulo RESUMEN
   - Repite el script anterior

### Paso 5: Debugging Avanzado (Si Aún No Funciona)

Si después de todo lo anterior la operación sigue sin aparecer:

```javascript
// En el módulo RESUMEN, ejecuta esto para ver el proceso de renderizado
console.log('=== DEBUG RENDERIZADO ===');

// Interceptar el fetch del layout
const originalFetch = window.fetch;
window.fetch = function(...args) {
  if (args[0]?.includes('/api/reportes/resumen')) {
    console.log('📡 Fetching layout:', args[0]);
    return originalFetch(...args).then(response => {
      return response.clone().json().then(data => {
        console.log('📥 Layout recibido:', data);
        if (data.layout?.operaciones) {
          console.log('Operaciones en layout:', data.layout.operaciones.length);
          data.layout.operaciones.forEach((op, i) => {
            console.log(`  ${i+1}. ${op.OperacionId || op.Clase} (HOJA:${op.HOJA}, CAP:${op.CAPITULO})`);
          });
        }
        return response;
      });
    });
  }
  return originalFetch(...args);
};

console.log('Interceptor instalado. Recarga el módulo RESUMEN.');
```

Luego recarga el módulo RESUMEN y observa la consola.

## VERIFICACIÓN FINAL

Después de aplicar la solución, verifica:

1. **En Gestor de Plantillas:**
   ```javascript
   const ejemplo = window.state.operaciones.find(op => 
     (op.OperacionId || '').toUpperCase().includes('EJEMPLO')
   );
   console.log('HOJA:', ejemplo?.HOJA);        // Debe ser: "RESUMEN"
   console.log('CAPITULO:', ejemplo?.CAPITULO); // Debe ser: "GUADALAJARA"
   console.log('visible:', ejemplo?.visible);   // Debe ser: true o undefined
   ```

2. **En Base de Datos (API):**
   - La operación existe con los campos correctos
   - Se puede ver en la respuesta del fetch

3. **En Módulo RESUMEN:**
   - La operación aparece en la tabla
   - Tiene valores calculados según su fórmula

## NOTAS TÉCNICAS

### ¿Por Qué buildOperacionesParaGuardar No Es Suficiente?

La función `buildOperacionesParaGuardar` SÍ agrega HOJA y CAPITULO:

```javascript
return lista.map((op) => ({
  ...op,
  CAPITULO: op?.CAPITULO || state.capitulo || "",
  HOJA: op?.HOJA || state.modulo || "",
}));
```

PERO esto solo funciona si:
1. La operación ya está en la lista `operacionesBase` que se pasa a la función
2. Los valores `state.capitulo` y `state.modulo` están correctamente asignados

Si la operación se crea pero NO se agrega a `window.state.operaciones`, entonces cuando se llama `buildOperacionesParaGuardar(state.operaciones)`, la operación no estará ahí.

### ¿Dónde Se Agregan las Operaciones a state.operaciones?

Buscar en `plantillas.js`:
- Función `guardarOperacion` o similar
- Función que maneja el submit del formulario del panel
- Event listener del botón "Guardar cambios" en el panel

Si esta función NO está agregando la operación a `state.operaciones`, entonces nunca se guardará.

## SOLUCIÓN PERMANENTE (Para Desarrollo)

Modificar la función que guarda operaciones para asegurarse de:

1. **Agregar la operación a state.operaciones:**
```javascript
if (!state.operaciones.find(op => getOperationId(op) === newOpId)) {
  state.operaciones.push(nuevaOperacion);
}
```

2. **Asegurar campos obligatorios:**
```javascript
nuevaOperacion.HOJA = nuevaOperacion.HOJA || state.modulo || 'RESUMEN';
nuevaOperacion.CAPITULO = nuevaOperacion.CAPITULO || state.capitulo;
nuevaOperacion.visible = nuevaOperacion.visible !== false;
```

3. **Renderizar la lista:**
```javascript
if (window.renderLayout) renderLayout();
```

---

**Fecha:** 2026-02-03
**Archivo:** FIX_OPERACIONES_NO_APARECEN_RESUMEN.md
