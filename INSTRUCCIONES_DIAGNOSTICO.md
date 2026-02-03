# Instrucciones para Diagnosticar y Solucionar Problemas

## Problema 1: Panel Lateral No Aparece

### Pasos para verificar:

1. **Abre el Gestor de Plantillas**
   - Ve a: Gestor de Plantillas
   - Selecciona: RESUMEN / 2026 / GUADALAJARA
   - Carga el layout

2. **Abre la Consola del Navegador**
   - Presiona F12
   - Ve a la pestaña "Console"

3. **Ejecuta el Script de Diagnóstico**
   ```javascript
   // Copia y pega el contenido de diagnostico-operaciones.js
   ```

4. **Intenta Editar una Operación**
   - Click en la operación "EJEMPLO"
   - Observa la consola para ver los mensajes:
     - ✅ "Panel lateral abierto con Bootstrap Offcanvas"
     - ⚠️ "Bootstrap Offcanvas no disponible, usando fallback manual"
     - ❌ "No se pudo abrir el panel lateral"

### Soluciones:

**Si aparece el modal viejo:**
1. Verifica que el archivo `vistas/js/plantillas.js` tenga los cambios
2. Recarga la página con Ctrl+F5 (forzar recarga sin caché)
3. Verifica en la consola que no haya errores de JavaScript

**Si no abre nada:**
1. Verifica que Bootstrap esté cargado: `console.log(window.bootstrap)`
2. Verifica que el panel exista: `console.log(document.getElementById('operationEditorPanel'))`
3. Revisa errores en la consola

## Problema 2: Operación "EJEMPLO" No Aparece en RESUMEN

### Pasos para verificar:

1. **En el Gestor de Plantillas (RESUMEN / 2026 / GUADALAJARA)**
   - Verifica que la operación "EJEMPLO" existe
   - Verifica que tiene:
     - `HOJA: "RESUMEN"`
     - `CAPITULO: "GUADALAJARA"` (o el capítulo correcto)
     - `visible: true` (o no debe estar en false)
   - Si no tiene estos campos, edita la operación y agrégalos

2. **Guarda los Cambios**
   - Click en "Guardar Layout"
   - Espera confirmación de guardado exitoso

3. **Recarga el RESUMEN**
   - Ve al módulo RESUMEN
   - Selecciona: GUADALAJARA / 2026 / Enero (o el mes actual)
   - Verifica si la operación aparece ahora

### Campos Obligatorios para que una Operación Aparezca:

```javascript
{
  "OperacionId": "EJEMPLO",           // ID único
  "Clase": "EJEMPLO",                 // Nombre visible
  "HOJA": "RESUMEN",                  // Módulo (DEBE ser "RESUMEN")
  "CAPITULO": "GUADALAJARA",          // Capítulo correspondiente
  "visible": true,                    // Debe ser visible (o no definir)
  "formula_terms": [...],             // Términos de la fórmula
  "formula_json": "[...]",            // JSON de la fórmula
  "orden": 100,                       // Orden de aparición
  "orden_presentacion": 100           // Orden visual
}
```

### Verificación en Base de Datos:

Si la operación no aparece después de guardar:

1. **Verifica en la API**
   ```javascript
   // En consola del navegador
   const url = 'http://localhost:3005/api/layouts-config/RESUMEN/2026/GUADALAJARA?empresaId=EMPRESA02';
   fetch(url, { headers: window.Sesion.headersAutenticacion() })
     .then(r => r.json())
     .then(data => {
       console.log('Operaciones guardadas:', data.layout?.operaciones);
       const ejemplo = data.layout?.operaciones?.find(op => 
         (op.OperacionId || op.Clase || '').includes('EJEMPLO')
       );
       console.log('EJEMPLO encontrado:', ejemplo);
     });
   ```

2. **Si no está en la base de datos:**
   - La operación no se guardó correctamente
   - Verifica errores en consola al guardar
   - Intenta guardar nuevamente

3. **Si está en la base de datos pero no aparece:**
   - Verifica que el módulo RESUMEN esté cargando el layout correcto
   - Verifica en la consola del RESUMEN: `console.log(window.ModoEdicionPresupuesto)`
   - Recarga el RESUMEN con Ctrl+F5

## Cómo Forzar Recarga Completa

1. **Limpiar Caché del Navegador**
   - Ctrl+Shift+Delete
   - Selecciona "Caché"
   - Click en "Limpiar datos"

2. **Recargar Aplicación**
   - Cierra completamente el navegador
   - Abre nuevamente
   - O usa Ctrl+F5 en cada página

## Verificación Final

### Panel Lateral Debe:
- ✅ Deslizarse desde la derecha
- ✅ Tener 3 tabs: Datos / Fórmula / Aparición
- ✅ En tab Fórmula: mostrar lista de elementos con toggles +/-
- ✅ Permitir cambiar entre modo Manual y Layout
- ❌ NO debe ser un modal centrado bloqueando toda la pantalla

### Operaciones Deben:
- ✅ Aparecer en la tabla del RESUMEN en su módulo correspondiente
- ✅ Mostrarse con su nombre visible (Clase)
- ✅ Calcular valores según su fórmula
- ✅ Respetar el orden definido

## Contacto

Si después de estos pasos el problema persiste:
1. Toma capturas de pantalla de la consola
2. Anota exactamente qué mensajes aparecen
3. Verifica si hay errores en rojo en la consola
4. Comparte esta información para diagnóstico detallado
