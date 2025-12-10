# Estructura Jerárquica de Módulos - Sistema de Inserción Inteligente

## 📊 Arquitectura de Datos por Tipo de Módulo

### **SUMMARY** (Consolidado Empresas)

```
CAPÍTULO (empresa)
  └── SECCIÓN PRINCIPAL (ej: "CDMX Income")
       └── SECCIÓN SECUNDARIA (ej: "Membership", "Events")
            └── CUENTA (401-001-000-00)
                 └── SUM ROW (Total por Secundaria)
       └── SUM ROW PRINCIPAL (Total de todas las Secundarias)
  └── RESULT ROW (Total General del Capítulo)
```

**Ejemplo Real**:
```
CIUDAD DE MÉXICO
  ├── CDMX Income (PRINCIPAL)
  │    ├── Membership (SECUNDARIA)
  │    │    ├── 401000000000000000001 - Cuotas Netas
  │    │    ├── 402000000000000000001 - Ingresos socios nuevos
  │    │    ├── 412000000000000000001 - Economex
  │    │    └── [SUM] Total Membership
  │    ├── Events (SECUNDARIA)
  │    │    ├── 407000000000000000001 - Eventos
  │    │    ├── 408000000000000000001 - Patrocinios
  │    │    └── [SUM] Total Events
  │    └── [SUM PRINCIPAL] Total CDMX Income
  ├── CDMX Expense (PRINCIPAL)
  │    └── ...
  └── [RESULT] TOTAL CIUDAD DE MÉXICO
```

**Reglas de Inserción SUMMARY**:
1. ✅ **Agregar Cuenta**: Debe especificar SECUNDARIA existente
2. ✅ **Agregar Secundaria**: Debe especificar PRINCIPAL existente
3. ✅ **Agregar Principal**: Debe especificar CAPÍTULO existente
4. ❌ **No permitir**: Cuentas sin SECUNDARIA
5. ❌ **No permitir**: SECUNDARIA sin PRINCIPAL
6. ✅ **Auto-crear**: SUM ROW al agregar primera cuenta en SECUNDARIA
7. ✅ **Auto-actualizar**: RESULT ROW siempre suma todos los PRINCIPALES

---

### **RESUMEN** (Consolidado Cuentas por Empresa)

```
CAPÍTULO (empresa)
  └── SECCIÓN PRINCIPAL (ej: "Ingresos", "Gastos")
       └── SECCIÓN SECUNDARIA (ej: "Ingresos Operativos")
            └── OPERACIÓN (ej: "Membresía", "Eventos")
                 └── CUENTA (401-001-000-00)
                      └── SUM ROW (Total por Operación)
            └── SUM ROW SECUNDARIA (Total de todas las Operaciones)
       └── SUM ROW PRINCIPAL (Total de todas las Secundarias)
  └── RESULT ROW (Total General del Capítulo)
```

**Ejemplo Real**:
```
GUADALAJARA
  ├── Ingresos (PRINCIPAL)
  │    ├── Ingresos Operativos (SECUNDARIA)
  │    │    ├── Membresía (OPERACIÓN)
  │    │    │    ├── 401-001-000-00 - Cuotas Membership
  │    │    │    ├── 401-004-000-00 - Renovaciones
  │    │    │    └── [SUM] Total Membresía
  │    │    ├── Eventos (OPERACIÓN)
  │    │    │    ├── 407-001-000-00 - Ingresos Eventos
  │    │    │    └── [SUM] Total Eventos
  │    │    └── [SUM SECUNDARIA] Total Ingresos Operativos
  │    └── [SUM PRINCIPAL] Total Ingresos
  └── [RESULT] TOTAL GUADALAJARA
```

**Reglas de Inserción RESUMEN**:
1. ✅ **Agregar Cuenta**: Debe especificar OPERACIÓN existente
2. ✅ **Agregar Operación**: Debe especificar SECUNDARIA existente
3. ✅ **Agregar Secundaria**: Debe especificar PRINCIPAL existente
4. ✅ **Agregar Principal**: Debe especificar CAPÍTULO existente
5. ❌ **No permitir**: Cuentas sin OPERACIÓN
6. ❌ **No permitir**: OPERACIÓN sin SECUNDARIA
7. ❌ **No permitir**: SECUNDARIA sin PRINCIPAL
8. ✅ **Auto-crear**: SUM ROW al agregar primera cuenta en OPERACIÓN
9. ✅ **Auto-crear**: SUM ROW SECUNDARIA al agregar primera OPERACIÓN
10. ✅ **Auto-actualizar**: RESULT ROW siempre suma todos los PRINCIPALES

---

### **MÓDULOS** (Finanzas, Eventos, Membresía, etc.)

```
CAPÍTULO (empresa)
  └── SECCIÓN (ej: "Ingresos Membresía", "Gastos Eventos")
       └── OPERACIÓN (opcional, para agrupar subcuentas)
            └── CUENTA (401-001-000-00)
                 └── SUM ROW (Total por Operación, si existe)
       └── SUM ROW SECCIÓN (Total de la Sección)
  └── RESULT ROW (Total General del Módulo/Capítulo)
```

**Ejemplo Real - Módulo Membresía**:
```
CIUDAD DE MÉXICO
  ├── Ingresos Membresía (SECCIÓN)
  │    ├── 401-004-000-00 - Renovaciones
  │    ├── 401-003-000-00 - Descuentos por pronto pago
  │    ├── 401-001-004-00 - Socios Nuevos
  │    ├── 402-002-000-00 - Cuotas Suscripción
  │    └── [SUM] Total Ingresos Membresía
  ├── Gastos Membresía (SECCIÓN)
  │    ├── 705-002-000-00 - Intercambios membresía-especie
  │    ├── 705-003-000-00 - Intercambios membresía
  │    ├── 520-000-000-00 - Comisiones KAM's
  │    └── [SUM] Total Gastos Membresía
  ├── Gastos Administrativos (SECCIÓN)
  │    ├── 801-001-001-00 - Teléfono Móvil
  │    └── [SUM] Total Gastos Administrativos
  └── [RESULT] TOTAL MEMBRESÍA CDMX
```

**Ejemplo con OPERACIONES - Módulo Finanzas**:
```
CIUDAD DE MÉXICO
  ├── Ingresos Financieros (SECCIÓN)
  │    ├── Inversiones (OPERACIÓN)
  │    │    ├── 450-001-000-00 - Rendimientos Bancarios
  │    │    ├── 450-002-000-00 - Intereses CETES
  │    │    └── [SUM] Total Inversiones
  │    ├── Otros Ingresos (OPERACIÓN)
  │    │    ├── 451-001-000-00 - Diversos
  │    │    └── [SUM] Total Otros Ingresos
  │    └── [SUM SECCIÓN] Total Ingresos Financieros
  └── [RESULT] TOTAL FINANZAS CDMX
```

**Reglas de Inserción MÓDULOS**:
1. ✅ **Agregar Cuenta Simple**: Debe especificar SECCIÓN existente
2. ✅ **Agregar Cuenta con Operación**: Debe especificar OPERACIÓN existente
3. ✅ **Agregar Operación**: Debe especificar SECCIÓN existente (opcional en módulos)
4. ✅ **Agregar Sección**: Debe especificar CAPÍTULO existente
5. ❌ **No permitir**: Cuentas sin SECCIÓN
6. ✅ **Auto-crear**: SUM ROW al agregar primera cuenta en SECCIÓN
7. ✅ **Auto-crear**: SUM ROW OPERACIÓN si se usa agrupación
8. ✅ **Auto-actualizar**: RESULT ROW siempre suma todas las SECCIONES

---

## 🎯 Sistema de Validación Inteligente

### Matriz de Dependencias

| Tipo de Inserción | SUMMARY | RESUMEN | MÓDULOS |
|-------------------|---------|---------|---------|
| **Cuenta** | Requiere: SECUNDARIA | Requiere: OPERACIÓN | Requiere: SECCIÓN (o OPERACIÓN) |
| **Operación** | N/A | Requiere: SECUNDARIA | Opcional (agrupa cuentas) |
| **Secundaria** | Requiere: PRINCIPAL | Requiere: PRINCIPAL | N/A |
| **Sección** | N/A | N/A | Requiere: CAPÍTULO |
| **Principal** | Requiere: CAPÍTULO | Requiere: CAPÍTULO | N/A |

---

## 🔧 Mejoras al Sistema de Inserción

### Modal Mejorado: Wizard Paso a Paso

#### **Paso 1: Seleccionar Tipo de Elemento**

```
┌────────────────────────────────────────┐
│  ¿Qué deseas agregar?                  │
├────────────────────────────────────────┤
│  ( ) Nueva Cuenta                      │
│  ( ) Nueva Operación (si aplica)       │
│  ( ) Nueva Sección Secundaria          │
│  ( ) Nueva Sección Principal           │
└────────────────────────────────────────┘
       [Cancelar]      [Siguiente →]
```

#### **Paso 2: Seleccionar Contexto (según tipo)**

**Si seleccionó "Nueva Cuenta"**:
```
┌────────────────────────────────────────┐
│  Nueva Cuenta - Selecciona Ubicación   │
├────────────────────────────────────────┤
│  Sección Principal (SUMMARY/RESUMEN):  │
│  [▼ CDMX Income                    ]   │
│                                         │
│  Sección Secundaria:                   │
│  [▼ Membership                     ]   │
│                                         │
│  Operación (RESUMEN):                  │
│  [▼ Membresía Core                 ]   │
└────────────────────────────────────────┘
       [← Atrás]      [Siguiente →]
```

#### **Paso 3: Ingresar Datos**

**Para Cuenta**:
```
┌────────────────────────────────────────┐
│  Nueva Cuenta - Datos                  │
├────────────────────────────────────────┤
│  Número de Cuenta:                     │
│  [401-005-000-00___________________]   │
│                                         │
│  Nombre/Descripción:                   │
│  [Cuotas Especiales________________]   │
│                                         │
│  Tipo de Cuenta:                       │
│  ( ) Ingreso  (●) Gasto  ( ) Otro     │
│                                         │
│  ℹ️ Se agregará en:                    │
│  CDMX Income > Membership              │
│  Se creará SUM ROW automáticamente     │
└────────────────────────────────────────┘
       [← Atrás]      [Agregar ✓]
```

**Para Sección**:
```
┌────────────────────────────────────────┐
│  Nueva Sección - Datos                 │
├────────────────────────────────────────┤
│  Nombre de Sección:                    │
│  [Communications___________________]   │
│                                         │
│  Etiqueta de Total:                    │
│  [Total Communications_____________]   │
│                                         │
│  Pertenece a (Principal):              │
│  [▼ CDMX Income                    ]   │
│                                         │
│  Orden (posición):                     │
│  [▼ Después de "Events"            ]   │
│                                         │
│  ℹ️ Agregar cuentas iniciales:         │
│  [+ Agregar cuenta]                    │
│                                         │
│  ☑ Crear SUM ROW automáticamente       │
└────────────────────────────────────────┘
       [← Atrás]      [Crear Sección ✓]
```

---

## 🛡️ Validaciones Automáticas

### Validación en Tiempo Real

```javascript
function validarInsercion(tipo, contexto, datos) {
  const validaciones = {
    cuenta: {
      required: ['numero', 'nombre', 'seccion'],
      SUMMARY: ['secundaria', 'principal'],
      RESUMEN: ['operacion', 'secundaria', 'principal'],
      MODULOS: ['seccion']
    },
    operacion: {
      required: ['nombre'],
      RESUMEN: ['secundaria', 'principal']
    },
    secundaria: {
      required: ['nombre', 'principal'],
      SUMMARY: ['principal'],
      RESUMEN: ['principal']
    },
    principal: {
      required: ['nombre', 'capitulo']
    }
  };
  
  // Validar campos requeridos
  const camposRequeridos = validaciones[tipo].required || [];
  const faltantes = camposRequeridos.filter(campo => !datos[campo]);
  
  if (faltantes.length > 0) {
    return {
      valido: false,
      error: `Faltan campos: ${faltantes.join(', ')}`
    };
  }
  
  // Validar jerarquía según módulo
  const tipoModulo = detectarTipoModulo(); // SUMMARY, RESUMEN, MODULOS
  const jerarquia = validaciones[tipo][tipoModulo] || [];
  const jerarquiaFaltante = jerarquia.filter(campo => !contexto[campo]);
  
  if (jerarquiaFaltante.length > 0) {
    return {
      valido: false,
      error: `Contexto incompleto: necesita ${jerarquiaFaltante.join(', ')}`
    };
  }
  
  return { valido: true };
}
```

### Prevención de Duplicados

```javascript
function verificarDuplicados(tipo, datos) {
  const existentes = obtenerElementosExistentes(tipo);
  
  switch(tipo) {
    case 'cuenta':
      return existentes.some(c => 
        normalizarCuenta(c.numero) === normalizarCuenta(datos.numero)
      );
    
    case 'seccion':
    case 'operacion':
    case 'principal':
      return existentes.some(s => 
        normalizarTexto(s.nombre) === normalizarTexto(datos.nombre)
      );
  }
  
  return false;
}
```

---

## 🔄 Auto-creación de Elementos Dependientes

### SUM ROW Automático

```javascript
function agregarCuenta(cuenta, contexto) {
  const seccionPadre = obtenerSeccion(contexto.seccion);
  
  // Insertar cuenta
  const filaCuenta = crearFilaCuenta(cuenta);
  insertarEnPosicion(filaCuenta, contexto);
  
  // Auto-crear SUM ROW si es la primera cuenta
  if (!seccionPadre.sumRow) {
    const sumRow = crearSumRow({
      label: `Total ${seccionPadre.nombre}`,
      tipo: 'seccion',
      cuentas: [cuenta]
    });
    seccionPadre.sumRow = sumRow;
    insertarDespuesDe(sumRow, filaCuenta);
  } else {
    // Actualizar SUM ROW existente
    actualizarSumRow(seccionPadre.sumRow, cuenta);
  }
  
  // Actualizar RESULT ROW si existe
  actualizarResultRow();
}
```

### Cascada de Actualizaciones

```javascript
function actualizarJerarquia(elementoModificado) {
  // 1. Actualizar SUM ROW de sección inmediata
  const seccion = obtenerSeccionPadre(elementoModificado);
  if (seccion?.sumRow) {
    recalcularSumRow(seccion.sumRow);
  }
  
  // 2. Si es RESUMEN, actualizar SUM ROW de SECUNDARIA
  if (esResumen() && seccion?.secundaria?.sumRow) {
    recalcularSumRow(seccion.secundaria.sumRow);
  }
  
  // 3. Actualizar SUM ROW de PRINCIPAL
  const principal = obtenerPrincipalPadre(elementoModificado);
  if (principal?.sumRow) {
    recalcularSumRow(principal.sumRow);
  }
  
  // 4. Actualizar RESULT ROW global
  const resultRow = obtenerResultRow();
  if (resultRow) {
    recalcularResultRow(resultRow);
  }
}
```

---

## 📝 Nomenclatura y Convenciones

### Formato de Cuentas

```javascript
const FORMATOS_CUENTA = {
  SUMMARY: {
    pattern: /^\d{21}$/,
    ejemplo: '401000000000000000001',
    descripcion: '21 dígitos numéricos'
  },
  RESUMEN: {
    pattern: /^\d{3}-\d{3}-\d{3}-\d{2}$/,
    ejemplo: '401-001-000-00',
    descripcion: 'XXX-XXX-XXX-XX con guiones'
  },
  MODULOS: {
    pattern: /^\d{3}-\d{3}-\d{3}-\d{2}$/,
    ejemplo: '401-001-000-00',
    descripcion: 'XXX-XXX-XXX-XX con guiones'
  }
};
```

### Convenciones de Nombres

```javascript
const CONVENCIONES = {
  sumRow: {
    prefix: 'Total ',
    ejemplo: 'Total Membership'
  },
  sumRowSecundaria: {
    prefix: 'Total ',
    ejemplo: 'Total Ingresos Operativos'
  },
  sumRowPrincipal: {
    prefix: 'Total ',
    ejemplo: 'Total CDMX Income'
  },
  resultRow: {
    prefix: 'TOTAL ',
    uppercase: true,
    ejemplo: 'TOTAL CIUDAD DE MÉXICO'
  }
};
```

---

## 🎨 UX del Modal Mejorado

### Estados Visuales

```css
/* Paso activo */
.wizard-step.active {
  display: block;
  animation: fadeIn 0.3s;
}

/* Paso completado */
.wizard-step.completed::before {
  content: '✓';
  color: #28a745;
}

/* Campo con error */
.form-control.invalid {
  border-color: #dc3545;
  background-image: url("data:image/svg+xml,..."); /* X roja */
}

/* Campo válido */
.form-control.valid {
  border-color: #28a745;
  background-image: url("data:image/svg+xml,..."); /* ✓ verde */
}

/* Preview de dónde se insertará */
.insertion-preview {
  background: #e7f3ff;
  border-left: 3px solid #0066cc;
  padding: 10px;
  margin: 10px 0;
  font-size: 0.9em;
}
```

### Mensajes de Ayuda Contextual

```html
<!-- Ayuda según el tipo seleccionado -->
<div class="contextual-help">
  <i class="bi bi-info-circle text-primary"></i>
  <span id="helpText">
    <!-- SUMMARY -->
    "Una cuenta debe pertenecer a una Sección Secundaria, que a su vez pertenece a una Sección Principal"
    
    <!-- RESUMEN -->
    "Una cuenta debe estar en una Operación, que está en una Sección Secundaria, que está en una Sección Principal"
    
    <!-- MÓDULOS -->
    "Una cuenta debe pertenecer a una Sección. Opcionalmente puede agruparse en una Operación"
  </span>
</div>
```

---

**Última actualización**: 2025-12-09
**Versión del sistema**: 2.0 - Inserción Inteligente con Validación Jerárquica
