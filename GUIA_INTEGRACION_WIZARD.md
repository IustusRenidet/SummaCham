# 🔧 GUÍA DE INTEGRACIÓN - Sistema de Inserción Inteligente

## 📋 Instrucciones para Integrar en SUMMARY.html

### Paso 1: Agregar CSS en el `<head>`

Ubicar la línea 14 de `SUMMARY.html`:
```html
<link rel="stylesheet" href="css/estilos.css">
<link rel="icon" type="image/x-icon" href="icono/icono.ico">
```

**Agregar después de `estilos.css`:**
```html
<link rel="stylesheet" href="css/estilos.css">
<link rel="stylesheet" href="css/insertion-wizard.css">  <!-- ⬅️ NUEVO -->
<link rel="icon" type="image/x-icon" href="icono/icono.ico">
```

---

### Paso 2: Agregar Scripts JS antes de `summary-view.js`

Ubicar la línea 807 de `SUMMARY.html`:
```html
<script src="js/context-menu-manager.js?v=20251209-2"></script>
<script src="js/summary-view.js"></script>
```

**Agregar los nuevos scripts:**
```html
<script src="js/context-menu-manager.js?v=20251209-2"></script>
<script src="js/insertion-validator.js"></script>  <!-- ⬅️ NUEVO -->
<script src="js/insertion-wizard.js"></script>     <!-- ⬅️ NUEVO -->
<script src="js/summary-view.js"></script>
```

---

### Paso 3: Modificar Menú Contextual

Ubicar las líneas 996-1001 de `SUMMARY.html` (menú contextual):
```html
<div class="context-menu-item" data-action="add-row">
  <i class="bi bi-plus-circle me-2"></i>
  <span>Agregar cuenta</span>
</div>
<div class="context-menu-item" data-action="add-section">
  <i class="bi bi-folder-plus me-2"></i>
  <span>Agregar sección</span>
</div>
```

**Modificar para usar el wizard:**
```html
<div class="context-menu-item" onclick="abrirWizardInsercion(this, 'cuenta')">
  <i class="bi bi-plus-circle me-2"></i>
  <span>Agregar cuenta</span>
</div>
<div class="context-menu-item" onclick="abrirWizardInsercion(this, 'seccion')">
  <i class="bi bi-folder-plus me-2"></i>
  <span>Agregar sección</span>
</div>
```

---

### Paso 4: Agregar Función de Integración

Agregar este código **antes del cierre de `</body>`** (línea ~1050):

```html
<script>
  /**
   * Abre el wizard de inserción desde el menú contextual
   */
  function abrirWizardInsercion(menuItem, tipoSugerido = null) {
    // Cerrar menú contextual
    const contextMenu = document.getElementById('contextMenu');
    if (contextMenu) {
      contextMenu.style.display = 'none';
    }

    // Obtener la fila donde se hizo click (guardada previamente)
    const filaContexto = window.__contextMenuTargetRow || null;

    // Abrir wizard
    if (window.InsertionWizard) {
      InsertionWizard.open(filaContexto);
      
      // Si se sugirió un tipo, pre-seleccionarlo
      if (tipoSugerido && InsertionWizard.selectedType === null) {
        setTimeout(() => {
          const radioBtn = document.querySelector(`input[name="elementType"][value="${tipoSugerido}"]`);
          if (radioBtn) {
            radioBtn.checked = true;
            radioBtn.dispatchEvent(new Event('change'));
          }
        }, 100);
      }
    } else {
      console.error('❌ InsertionWizard no está disponible');
      alert('Error: Sistema de inserción no cargado');
    }
  }

  // Guardar referencia a la fila cuando se abre el menú contextual
  document.addEventListener('DOMContentLoaded', () => {
    const mainTable = document.getElementById('mainTable');
    if (!mainTable) return;

    mainTable.addEventListener('contextmenu', (e) => {
      const row = e.target.closest('tr');
      window.__contextMenuTargetRow = row;
    });
  });
</script>
```

---

## ✅ Resultado Final en SUMMARY.html

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <!-- ... head content ... -->
  <link rel="stylesheet" href="css/estilos.css">
  <link rel="stylesheet" href="css/insertion-wizard.css">  <!-- ✅ AGREGADO -->
  <!-- ... -->
</head>
<body>
  <!-- ... body content ... -->

  <!-- Scripts -->
  <script src="js/sesion.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
  <script src="js/flujo-autorizacion.js?v=20251208-1"></script>
  <script src="js/modo-edicion-presupuesto.js?v=20251208-1"></script>
  <script src="js/context-menu-manager.js?v=20251209-2"></script>
  <script src="js/insertion-validator.js"></script>  <!-- ✅ AGREGADO -->
  <script src="js/insertion-wizard.js"></script>     <!-- ✅ AGREGADO -->
  <script src="js/summary-view.js"></script>

  <!-- ... más scripts ... -->

  <!-- Función de integración -->
  <script>
    function abrirWizardInsercion(menuItem, tipoSugerido = null) {
      const contextMenu = document.getElementById('contextMenu');
      if (contextMenu) contextMenu.style.display = 'none';
      
      const filaContexto = window.__contextMenuTargetRow || null;
      
      if (window.InsertionWizard) {
        InsertionWizard.open(filaContexto);
        
        if (tipoSugerido && InsertionWizard.selectedType === null) {
          setTimeout(() => {
            const radioBtn = document.querySelector(`input[name="elementType"][value="${tipoSugerido}"]`);
            if (radioBtn) {
              radioBtn.checked = true;
              radioBtn.dispatchEvent(new Event('change'));
            }
          }, 100);
        }
      } else {
        alert('Error: Sistema de inserción no cargado');
      }
    }

    document.addEventListener('DOMContentLoaded', () => {
      const mainTable = document.getElementById('mainTable');
      if (!mainTable) return;

      mainTable.addEventListener('contextmenu', (e) => {
        const row = e.target.closest('tr');
        window.__contextMenuTargetRow = row;
      });
    });
  </script>

  <!-- Menú Contextual (MODIFICADO) -->
  <div id="contextMenu" class="context-menu" style="...">
    <div class="context-menu-item" onclick="abrirWizardInsercion(this, 'cuenta')">
      <i class="bi bi-plus-circle me-2"></i>
      <span>Agregar cuenta</span>
    </div>
    <div class="context-menu-item" onclick="abrirWizardInsercion(this, 'seccion')">
      <i class="bi bi-folder-plus me-2"></i>
      <span>Agregar sección</span>
    </div>
    <!-- ... resto del menú ... -->
  </div>

</body>
</html>
```

---

## 📋 Instrucciones para RESUMEN.html

**Exactamente igual que SUMMARY.html:**

1. Agregar `insertion-wizard.css` en `<head>`
2. Agregar `insertion-validator.js` e `insertion-wizard.js` antes de `resumen-view.js`
3. Modificar menú contextual con `onclick="abrirWizardInsercion(this, 'tipo')"`
4. Agregar función `abrirWizardInsercion()` antes de `</body>`

---

## 📋 Instrucciones para Módulos (Finanzas.html, Eventos.html, etc.)

**Mismos pasos:**

1. CSS: `<link rel="stylesheet" href="css/insertion-wizard.css">`
2. JS: Agregar los 2 scripts antes del script view del módulo
3. Menú contextual: Modificar con `onclick="abrirWizardInsercion(this, 'tipo')"`
4. Función: Agregar `abrirWizardInsercion()` antes de `</body>`

El wizard **detectará automáticamente** que es un MÓDULO y mostrará las opciones correctas (Cuenta, Operación, Sección).

---

## 🧪 Cómo Probar

### Opción 1: Test Page
```
1. Abrir test-insertion-wizard.html en navegador
2. Click en "Ejecutar Todos los Tests"
3. Verificar que 4 tests fallen (validaciones) y 1 pase (inserción válida)
4. Click en "Abrir Insertion Wizard"
5. Completar los 3 pasos del wizard
```

### Opción 2: En SUMMARY.html (después de integrar)
```
1. Abrir SUMMARY.html
2. Hacer click derecho en cualquier fila
3. Seleccionar "Agregar cuenta" o "Agregar sección"
4. Se abre el wizard con 3 pasos
5. Completar y verificar validación en tiempo real
```

---

## 🔍 Verificación de Integración

Abrir **Consola de Desarrollador** (F12) y verificar:

```javascript
// Verificar que los módulos estén cargados
console.log('Validator:', !!window.InsertionValidator);  // Debe ser true
console.log('Wizard:', !!window.InsertionWizard);        // Debe ser true

// Probar validación
const test = InsertionValidator.validarInsercion({
  tipo: 'cuenta',
  context: { capitulo: 'CDMX', principal: 'Ingresos', secundaria: 'Membresía' },
  formData: { numero: '401000000000000000999', nombre: 'Test' },
  moduleType: 'SUMMARY'
});
console.log('Test validación:', test);
// Debe retornar: { valid: true, errors: [], warnings: [...] }

// Abrir wizard
InsertionWizard.open();
// Debe abrir el modal con Paso 1
```

---

## 🚨 Troubleshooting

### Problema: "InsertionWizard is not defined"
**Solución:** Verificar que `insertion-wizard.js` esté cargado antes de llamar a `abrirWizardInsercion()`

### Problema: "Modal no se abre"
**Solución:** Verificar que Bootstrap JS esté cargado. El wizard usa `bootstrap.Modal`

### Problema: "No detecta duplicados"
**Solución:** Verificar que las filas tengan los `data-attributes` correctos:
- `data-cuenta="..."`
- `data-seccion-principal="..."`
- `data-seccion-secundaria="..."`
- `data-section-name="..."`

### Problema: "Formato de cuenta no valida"
**Solución:** 
- SUMMARY debe usar 21 dígitos: `401000000000000000001`
- RESUMEN/MÓDULOS deben usar: `401-001-000-00`

---

## 📞 Siguiente Paso: Backend

Una vez integrado en el frontend, conectar con backend:

```javascript
// En insertion-wizard.js, función insertarCuenta():

async insertarCuenta(data) {
  const response = await fetch('/api/summary/cuenta', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...Sesion.headersAutenticacion()
    },
    body: JSON.stringify({
      empresa: data.capitulo,
      anio: data.anio || new Date().getFullYear(),
      seccion_principal: data.principal,
      seccion_secundaria: data.secundaria,
      numero_cuenta: data.numero,
      nombre_cuenta: data.nombre,
      tipo_cuenta: data.tipo || 'otro'
    })
  });

  if (!response.ok) {
    throw new Error('Error al insertar cuenta');
  }

  return await response.json();
}
```

---

## ✅ Checklist de Integración

- [ ] Agregar `insertion-wizard.css` en `<head>` de SUMMARY.html
- [ ] Agregar scripts JS en SUMMARY.html
- [ ] Modificar menú contextual en SUMMARY.html
- [ ] Agregar función `abrirWizardInsercion()` en SUMMARY.html
- [ ] Probar wizard en SUMMARY.html
- [ ] Repetir para RESUMEN.html
- [ ] Repetir para módulos (Finanzas.html, Eventos.html, etc.)
- [ ] Verificar en consola que módulos estén cargados
- [ ] Ejecutar tests en test-insertion-wizard.html
- [ ] Conectar con backend (API endpoints)

---

¡Listo para integrar! 🚀
