# 🎯 Sistema Inteligente de Inserción de Filas/Secciones

## 📋 Resumen Ejecutivo

Se ha implementado un **sistema wizard inteligente** de 3 pasos con validación jerárquica completa para insertar cuentas, secciones y operaciones en SUMMARY, RESUMEN y MÓDULOS.

### ✅ Características Implementadas

1. **Wizard de 3 Pasos**
   - Paso 1: Selección de tipo de elemento
   - Paso 2: Selección de contexto jerárquico
   - Paso 3: Ingreso de datos con validación en tiempo real

2. **Validación Inteligente**
   - Verifica jerarquía completa (sin elementos sueltos)
   - Detecta duplicados (cuentas, secciones, operaciones)
   - Valida formatos (21 dígitos para SUMMARY, XXX-XXX-XXX-XX para RESUMEN/MÓDULOS)
   - Verifica consistencia de capítulo

3. **UX Mejorada**
   - Progress bar visual
   - Validación en tiempo real con checkmarks/X rojas
   - Preview de inserción antes de confirmar
   - Ayuda contextual por paso
   - Advertencias informativas
   - Diseño moderno con gradientes y animaciones

---

## 📁 Archivos Creados

### 1. `vistas/js/insertion-wizard.js` (701 líneas)
**Sistema wizard de 3 pasos**

```javascript
// Uso:
InsertionWizard.open(referenceRow);

// Detecta automáticamente el módulo (SUMMARY, RESUMEN, MODULOS)
// Extrae contexto de la fila clickeada
// Guía al usuario paso a paso
```

**Funciones principales:**
- `detectModuleType()` - Detecta SUMMARY/RESUMEN/MODULOS
- `getValidationRules()` - Reglas por módulo/tipo
- `extractContextFromRow()` - Extrae jerarquía de fila clickeada
- `renderStep1_SelectType()` - Renderiza selección de tipo
- `renderStep2_SelectContext()` - Renderiza selección jerárquica
- `renderStep3_EnterData()` - Renderiza formulario de datos
- `validateField()` - Validación en tiempo real
- `updatePreview()` - Muestra preview de inserción
- `submit()` - Validación final y ejecución

### 2. `vistas/js/insertion-validator.js` (522 líneas)
**Motor de validación inteligente**

```javascript
// Uso:
const result = InsertionValidator.validarInsercion({
  tipo: 'cuenta',
  context: { capitulo: 'CDMX', principal: 'Ingresos', secundaria: 'Membresía' },
  formData: { numero: '401000000000000000001', nombre: 'Cuotas' },
  moduleType: 'SUMMARY'
});

if (result.valid) {
  // Proceder con inserción
} else {
  // Mostrar errores
  console.error(result.errors);
}
```

**Validaciones implementadas:**
- ✅ `validarJerarquia()` - Verifica padres obligatorios
- ✅ `verificarDuplicados()` - Busca en DOM elementos duplicados
- ✅ `validarFormato()` - Verifica formato de cuenta según módulo
- ✅ `validarCapitulo()` - Verifica empresa/capítulo válido
- ✅ `verificarAdvertencias()` - Genera avisos informativos
- ✅ `validarAntesDeProcesar()` - Validación final pre-inserción

**Búsqueda en DOM:**
- `findAccountInDOM()` - Busca cuenta por número
- `findSectionInDOM()` - Busca sección por nombre
- `findOperationInDOM()` - Busca operación en secundaria

### 3. `vistas/css/insertion-wizard.css` (342 líneas)
**Estilos modernos para el wizard**

**Características visuales:**
- 🎨 Gradientes modernos (púrpura-azul)
- ✨ Animaciones suaves (fadeIn, slideIn)
- ✅ Estados de validación con iconos (checkmark verde, X roja)
- 📊 Progress bar animada
- 📱 Responsive design
- 🎯 Hover effects en opciones
- 💡 Ayuda contextual destacada
- 🔍 Preview de inserción con borde verde

---

## 🔧 Integración en HTMLs

### Para SUMMARY.html

```html
<!-- Agregar en el <head> -->
<link rel="stylesheet" href="css/insertion-wizard.css">

<!-- Agregar antes de </body> -->
<script src="js/insertion-validator.js"></script>
<script src="js/insertion-wizard.js"></script>

<!-- En el botón de agregar -->
<button onclick="InsertionWizard.open()" class="btn btn-primary">
  <i class="bi bi-plus-circle"></i> Agregar Elemento
</button>

<!-- O desde menú contextual -->
<script>
document.addEventListener('contextmenu', (e) => {
  if (e.target.closest('.account-row, .subsection-row, .section-header-row')) {
    e.preventDefault();
    // ... mostrar menú ...
    // Al hacer click en "Agregar":
    InsertionWizard.open(e.target.closest('.account-row, .subsection-row, .section-header-row'));
  }
});
</script>
```

### Para RESUMEN.html

```html
<!-- Agregar en el <head> -->
<link rel="stylesheet" href="css/insertion-wizard.css">

<!-- Agregar antes de </body> -->
<script src="js/insertion-validator.js"></script>
<script src="js/insertion-wizard.js"></script>

<!-- Mismo código de integración que SUMMARY -->
```

### Para Módulos (Finanzas.html, Eventos.html, etc.)

```html
<!-- Agregar en el <head> -->
<link rel="stylesheet" href="css/insertion-wizard.css">

<!-- Agregar antes de </body> -->
<script src="js/insertion-validator.js"></script>
<script src="js/insertion-wizard.js"></script>

<!-- El wizard detectará automáticamente que es un MODULO -->
```

---

## 📊 Reglas de Validación por Módulo

### SUMMARY

#### Cuenta
- **Jerarquía requerida:** CAPITULO → PRINCIPAL → SECUNDARIA
- **Formato:** 21 dígitos consecutivos (ej: `401000000000000000001`)
- **Duplicados:** Verifica que no exista el número de cuenta
- **Campos:** `numero`, `nombre`, `tipo` (opcional)

#### Sección Secundaria
- **Jerarquía requerida:** CAPITULO → PRINCIPAL
- **Campos:** `nombre`, `etiquetaSum`
- **Auto-creación:** SUM ROW
- **Duplicados:** Verifica nombre en misma PRINCIPAL

#### Sección Principal
- **Jerarquía requerida:** CAPITULO
- **Campos:** `nombre`, `etiquetaSum`
- **Auto-creación:** SUM ROW
- **Duplicados:** Verifica nombre en mismo CAPITULO

---

### RESUMEN

#### Cuenta
- **Jerarquía requerida:** CAPITULO → PRINCIPAL → SECUNDARIA → OPERACIÓN
- **Formato:** XXX-XXX-XXX-XX (ej: `401-001-000-00`)
- **Duplicados:** Verifica que no exista el número de cuenta
- **Campos:** `numero`, `nombre`, `tipo` (opcional)

#### Operación
- **Jerarquía requerida:** CAPITULO → PRINCIPAL → SECUNDARIA
- **Campos:** `nombre`, `etiquetaSum`
- **Auto-creación:** SUM ROW
- **Duplicados:** Verifica nombre en misma SECUNDARIA

#### Sección Secundaria
- **Jerarquía requerida:** CAPITULO → PRINCIPAL
- **Campos:** `nombre`, `etiquetaSum`
- **Auto-creación:** SUM ROW
- **Duplicados:** Verifica nombre en misma PRINCIPAL

#### Sección Principal
- **Jerarquía requerida:** CAPITULO
- **Campos:** `nombre`, `etiquetaSum`
- **Auto-creación:** SUM ROW
- **Duplicados:** Verifica nombre en mismo CAPITULO

---

### MÓDULOS (Finanzas, Eventos, etc.)

#### Cuenta
- **Jerarquía requerida:** CAPITULO → SECCIÓN
- **Jerarquía opcional:** OPERACIÓN (para sub-agrupar)
- **Formato:** XXX-XXX-XXX-XX (ej: `401-001-000-00`)
- **Duplicados:** Verifica que no exista el número de cuenta
- **Campos:** `numero`, `nombre`, `tipo` (opcional)

#### Operación (Opcional)
- **Jerarquía requerida:** CAPITULO → SECCIÓN
- **Campos:** `nombre`, `etiquetaSum`
- **Auto-creación:** SUM ROW
- **Duplicados:** Verifica nombre en misma SECCIÓN

#### Sección
- **Jerarquía requerida:** CAPITULO
- **Campos:** `nombre`, `etiquetaSum`
- **Auto-creación:** SUM ROW
- **Duplicados:** Verifica nombre en mismo CAPITULO

---

## 🎨 Flujo de Usuario

### Paso 1: Selección de Tipo
```
┌─────────────────────────────────────────┐
│  ¿Qué deseas agregar?                   │
├─────────────────────────────────────────┤
│  ○ 📊 Nueva Cuenta                      │
│     Agregar una cuenta contable...      │
│                                         │
│  ● 📁 Nueva Sección Secundaria          │
│     Crear una subsección dentro...      │
│                                         │
│  ○ 📂 Nueva Sección Principal           │
│     Crear una nueva sección...          │
└─────────────────────────────────────────┘
```

### Paso 2: Selección de Contexto
```
┌─────────────────────────────────────────┐
│  Selecciona la ubicación                │
├─────────────────────────────────────────┤
│  Sección Principal *                    │
│  ┌───────────────────────┐              │
│  │ Ingresos Membresía  ▼ │              │
│  └───────────────────────┘              │
│                                         │
│  📍 Ciudad de México > Ingresos         │
│     Membresía                           │
└─────────────────────────────────────────┘
```

### Paso 3: Ingreso de Datos
```
┌─────────────────────────────────────────┐
│  Datos de Sección Secundaria            │
├─────────────────────────────────────────┤
│  Nombre *                               │
│  ┌───────────────────────┐ ✅           │
│  │ Marketing Digital     │              │
│  └───────────────────────┘              │
│                                         │
│  Etiqueta de Total *                    │
│  ┌───────────────────────┐ ✅           │
│  │ Total Marketing       │              │
│  └───────────────────────┘              │
│  ℹ️ Se creará automáticamente SUM ROW   │
│                                         │
│  ➡️ Se insertará:                       │
│    Sección Secundaria: Marketing        │
│    📍 CDMX > Ingresos > Marketing       │
│    ✓ Se creará SUM ROW: "Total Mark..." │
└─────────────────────────────────────────┘
```

---

## 🧪 Pruebas de Validación

### Caso 1: Cuenta Duplicada
```javascript
// Input:
{
  tipo: 'cuenta',
  formData: { numero: '401000000000000000001' },
  context: { capitulo: 'CDMX', principal: 'Ingresos', secundaria: 'Membresía' }
}

// Output:
{
  valid: false,
  errors: [
    {
      field: 'numero',
      message: 'La cuenta 401000000000000000001 ya existe en Membresía',
      severity: 'error'
    }
  ]
}
```

### Caso 2: Jerarquía Incompleta
```javascript
// Input:
{
  tipo: 'cuenta',
  formData: { numero: '401000000000000000999', nombre: 'Nueva Cuenta' },
  context: { capitulo: 'CDMX', principal: 'Ingresos' } // Falta secundaria
}

// Output:
{
  valid: false,
  errors: [
    {
      field: 'secundaria',
      message: 'Se requiere seleccionar Sección Secundaria',
      severity: 'error'
    },
    {
      field: 'jerarquia',
      message: 'Una Cuenta debe estar dentro de una Secundaria (que está en una Principal)',
      severity: 'error'
    }
  ]
}
```

### Caso 3: Formato Incorrecto
```javascript
// Input (SUMMARY):
{
  tipo: 'cuenta',
  formData: { numero: '401-001-000-00', nombre: 'Cuenta' }, // Formato RESUMEN
  context: { capitulo: 'CDMX', principal: 'Ingresos', secundaria: 'Membresía' }
}

// Output:
{
  valid: false,
  errors: [
    {
      field: 'numero',
      message: 'Formato incorrecto. Debe ser 21 dígitos consecutivos (ej: 401000000000000000001)',
      severity: 'error'
    }
  ]
}
```

### Caso 4: Inserción Exitosa
```javascript
// Input:
{
  tipo: 'secundaria',
  formData: { nombre: 'Marketing Digital', etiquetaSum: 'Total Marketing Digital' },
  context: { capitulo: 'CDMX', principal: 'Ingresos' }
}

// Output:
{
  valid: true,
  errors: [],
  warnings: [
    {
      message: 'Recuerda agregar cuentas a esta sección después de crearla',
      severity: 'info'
    },
    {
      message: 'Se creará automáticamente un SUM ROW con la etiqueta especificada',
      severity: 'info'
    }
  ]
}
```

---

## 🚀 Próximos Pasos

### Pendiente de Implementar

1. **Integración con Backend**
   - [ ] Conectar `insertarCuenta()` con API
   - [ ] Conectar `insertarSeccion()` con API
   - [ ] Conectar `insertarOperacion()` con API

2. **Funciones de Obtención de Datos**
   - [ ] `getOptionsForLevel()` - Extraer opciones reales del DOM
   - [ ] Cargar secciones existentes dinámicamente
   - [ ] Cargar operaciones existentes dinámicamente

3. **Auto-creación de SUM ROWs**
   - [ ] Implementar lógica de creación automática
   - [ ] Calcular totales iniciales (0.00)
   - [ ] Insertar en posición correcta

4. **Actualización Cascada**
   - [ ] `actualizarJerarquia()` - Recalcular padres
   - [ ] Actualizar RESULT ROW
   - [ ] Propagar cambios a todos los meses

5. **Mejoras UX**
   - [ ] Añadir loading spinner durante inserción
   - [ ] Toast notifications en lugar de alerts
   - [ ] Confirmación visual de inserción exitosa
   - [ ] Highlight de fila recién creada

---

## 📝 Notas de Implementación

### Compatibilidad con Sistema Existente

El wizard está diseñado para **integrarse** con el sistema actual:

1. **Usa `window.CuentasModulo` si existe**
   ```javascript
   if (window.CuentasModulo && window.CuentasModulo.insertarFilaCuentaNueva) {
     return window.CuentasModulo.insertarFilaCuentaNueva(data);
   }
   ```

2. **Fallback a inserción directa en DOM**
   ```javascript
   console.warn('⚠️ CuentasModulo no disponible, insertando en DOM directamente');
   return this.insertarEnDOM('cuenta', data);
   ```

3. **Extrae contexto de fila clickeada**
   ```javascript
   extractContextFromRow(row) {
     const context = {
       capitulo: this.getCurrentCapitulo(),
       cuenta: row.dataset.cuenta,
       secundaria: row.dataset.seccionSecundaria,
       principal: row.dataset.seccionPrincipal,
       operacion: row.dataset.operacion
     };
     return context;
   }
   ```

### Convenciones de data-attributes

El sistema espera estas convenciones:

```html
<!-- Fila de cuenta -->
<tr class="account-row" 
    data-cuenta="401000000000000000001"
    data-seccion-principal="Ingresos"
    data-seccion-secundaria="Membresía"
    data-operacion="Cuotas Regulares">
  ...
</tr>

<!-- Fila de subsección -->
<tr class="subsection-row"
    data-section-name="Membresía"
    data-principal-name="Ingresos">
  ...
</tr>

<!-- Fila de sección principal -->
<tr class="section-header-row"
    data-section-name="Ingresos">
  ...
</tr>
```

---

## ✅ Checklist de Integración

- [x] Crear `insertion-wizard.js`
- [x] Crear `insertion-validator.js`
- [x] Crear `insertion-wizard.css`
- [x] Documentar sistema completo
- [ ] Integrar en SUMMARY.html
- [ ] Integrar en RESUMEN.html
- [ ] Integrar en módulos (Finanzas.html, etc.)
- [ ] Probar inserción de cuenta en SUMMARY
- [ ] Probar inserción de sección en RESUMEN
- [ ] Probar validación de duplicados
- [ ] Probar validación de jerarquía
- [ ] Conectar con backend
- [ ] Implementar auto-creación de SUM ROWs
- [ ] Testing end-to-end

---

## 📞 Soporte

El sistema está listo para ser integrado. Para activarlo:

1. Agregar los 3 archivos a los HTMLs
2. Llamar `InsertionWizard.open()` desde botones o menú contextual
3. El wizard detectará automáticamente el módulo y guiará al usuario

¡El sistema inteligente está listo para prevenir información suelta! 🎉
