# 🎯 Guía: Personalizar Fórmulas de Secciones Principales y Subsecciones

## 📋 Resumen

**¡BUENAS NOTICIAS!** Las fórmulas de secciones principales (EXPENSES, INCOME, etc.) y subsecciones ya son completamente personalizables en SummaCham. Esta funcionalidad está implementada a través del **Gestor de Plantillas** con el **Constructor de Fórmulas (FormulaBuilder)**.

---

## 🔍 Cómo Funciona Actualmente

### 1. **Sistema de Operaciones**

Cada sección principal (como EXPENSES, INCOME) y cada subsección está respaldada por una **operación** que define:
- **Qué elementos suma** (cuentas, subsecciones, otras secciones)
- **Cómo los suma** (con signo positivo o negativo)
- **Dónde aparece** en la tabla (tipo de fila, etiqueta)

### 2. **Tipos de Términos en Fórmulas**

Las fórmulas pueden combinar:
- ✅ **Cuentas** (`account`) - Cuentas contables individuales
- ✅ **Secciones/Subsecciones** (`section`) - Totales de otras secciones
- ✅ **Operaciones** (`operation`) - Resultados de otras operaciones
- ✅ **Constantes** (`constant`) - Números fijos

### 3. **Operadores Soportados**

- `+` Suma
- `-` Resta
- `×` Multiplicación
- `÷` División

---

## 🎨 Cómo Personalizar las Fórmulas

### **Paso 1: Abrir el Gestor de Plantillas**

1. Abre SummaCham
2. Ve al módulo **RESUMEN** o **SUMMARY**
3. Haz clic en **"Gestor de Plantillas"**

### **Paso 2: Seleccionar la Sección a Editar**

#### Opción A: Hacer Clic Derecho en la Tabla
1. En la vista de plantilla, busca la sección principal (ej: **EXPENSES**)
2. Haz **clic derecho** sobre la fila de la sección
3. Selecciona **"Editar Sección"**

#### Opción B: Desde el Panel Lateral
1. En el Gestor de Plantillas, busca la sección en la lista del lado izquierdo
2. Haz clic en el botón **"✏️ Editar"** junto a la sección

### **Paso 3: Editar la Fórmula**

Una vez abierto el editor de operaciones:

1. **Pestaña "Fórmula"** - Aquí verás el **Constructor de Fórmulas**
2. Verás los términos actuales de la fórmula (ej: todas las subsecciones que se suman)

#### Modificar Términos Existentes:
- **Cambiar operador**: Clic en el botón `+`, `-`, `×`, `÷`
- **Cambiar tipo**: Selecciona `Sección/Suma`, `Cuenta`, `Operación`, o `Número`
- **Cambiar valor**: Selecciona del dropdown lo que quieres sumar/restar

#### Agregar Nuevos Términos:
- Clic en **"+ Agregar Término"**
- Configura operador, tipo y valor

#### Eliminar Términos:
- Clic en el botón **"🗑️"** (eliminar) junto al término

### **Paso 4: Guardar los Cambios**

1. Revisa la **Vista Previa** de la fórmula
2. Haz clic en **"💾 Guardar"**
3. Los cambios se aplicarán inmediatamente

---

## 📝 Ejemplos Prácticos

### **Ejemplo 1: Personalizar EXPENSES**

**Escenario:** Quieres que EXPENSES reste una subsección específica en lugar de sumarla.

**Pasos:**
1. Edita la sección principal **"EXPENSES"**
2. En el Constructor de Fórmulas, encuentra el término de la subsección
3. Cambia el operador de `+` a `-`
4. Guarda

**Resultado:** La subsección ahora se resta del total de EXPENSES.

---

### **Ejemplo 2: EXPENSES con Fórmula Completamente Personalizada**

**Escenario:** Quieres que EXPENSES = (Subsección A + Subsección B) - (Cuenta X × 0.15)

**Pasos:**
1. Edita **"EXPENSES"**
2. Elimina todos los términos existentes
3. Agrega términos:
   - Término 1: `+` | `Sección/Suma` | `Subsección A`
   - Término 2: `+` | `Sección/Suma` | `Subsección B`
   - Término 3: `-` | `Cuenta` | `Cuenta X`
   - Término 4: `×` | `Número` | `0.15`
4. Guarda

**Vista Previa de Fórmula:**
```
+ Subsección A
+ Subsección B
- Cuenta X
× 0.15
```

---

### **Ejemplo 3: Sumar Otra Operación**

**Escenario:** Quieres que una sección incluya el resultado de otra operación calculada.

**Pasos:**
1. Edita la sección
2. Agrega término:
   - Operador: `+`
   - Tipo: `Operación`
   - Valor: Selecciona la operación de la lista (ej: "CONSOLIDATED INCOME")
3. Guarda

---

## 🔬 Estructura Técnica

### Almacenamiento de Fórmulas

Las fórmulas se guardan en dos formatos:

#### 1. **`formula_terms`** (Array de objetos)
```javascript
[
  {
    id: 1738640000000,
    operator: "+",
    type: "section",
    value: "Subsección A"
  },
  {
    id: 1738640000001,
    operator: "-",
    type: "account",
    value: "801-001-000-00"
  },
  {
    id: 1738640000002,
    operator: "*",
    type: "constant",
    value: "0.15",
    constant: 0.15
  }
]
```

#### 2. **`formula_json`** (String JSON)
```json
"[{\"operator\":\"+\",\"type\":\"section\",\"value\":\"Subsección A\"},{\"operator\":\"-\",\"type\":\"account\",\"value\":\"801-001-000-00\"}]"
```

### Archivos Clave

| Archivo | Función |
|---------|---------|
| **`vistas/js/formula-builder.js`** | Constructor visual de fórmulas |
| **`vistas/js/plantillas.js`** | Gestor de plantillas y operaciones |
| **`vistas/js/cuentas-modulo.js`** | Cálculo y ejecución de fórmulas |
| **`src/db/sqlite.js`** | Almacenamiento en base de datos |

---

## ⚡ Funcionalidades Avanzadas

### **1. Auto-Generación de Fórmulas**

Cuando creas una nueva sección, el sistema intenta **generar automáticamente** la fórmula basándose en:
- Subsecciones existentes
- Convenciones de nombres (INCOME suma, EXPENSE resta)
- Operaciones predefinidas

### **2. Mapa Visual de Operaciones**

Haz clic en **"🗺️ Mostrar Mapa"** para ver:
- Jerarquía de la operación
- Qué elementos contribuyen
- Valores actuales de cada término

### **3. Validación de Fórmulas**

El sistema valida:
- ✅ Términos válidos (existen en el catálogo)
- ✅ Operadores correctos
- ⚠️ Referencias circulares (en desarrollo)

### **4. Expansión de Secciones**

Una sección puede expandirse automáticamente a todas sus cuentas hijas para mayor detalle en el mapa visual.

---

## 🚀 Casos de Uso Comunes

### **1. Cambiar Signo de una Subsección**

**Antes:** 
```
EXPENSES = SubA + SubB + SubC
```

**Después:** 
```
EXPENSES = SubA + SubB - SubC  ← SubC ahora se resta
```

**Acción:** Edita EXPENSES, cambia operador de SubC a `-`

---

### **2. Agregar Ajuste Manual**

**Antes:** 
```
EXPENSES = SubA + SubB
```

**Después:** 
```
EXPENSES = SubA + SubB - 5000  ← Ajuste fijo de $5,000
```

**Acción:** Agrega término: `-` | `Número` | `5000`

---

### **3. Calcular Porcentaje**

**Antes:** 
```
COMISION = VENTAS
```

**Después:** 
```
COMISION = VENTAS × 0.15  ← 15% de ventas
```

**Acción:** 
- Término 1: `+` | `Sección/Suma` | `VENTAS`
- Término 2: `×` | `Número` | `0.15`

---

### **4. Consolidar Varias Regiones**

**Antes:** Cada región por separado

**Después:** 
```
CONSOLIDATED EXPENSES = 
  + CDMX EXPENSE
  + GUADALAJARA EXPENSE
  + MONTERREY EXPENSE
```

**Acción:** Crear operación "CONSOLIDATED EXPENSES" con términos de cada región

---

## 🛠️ Resolución de Problemas

### **Problema 1: "No aparece la sección en el dropdown"**

**Causa:** La sección puede no estar registrada en el catálogo.

**Solución:**
1. Verifica que la sección existe en el layout
2. Intenta escribir el nombre manualmente (en algunos casos se permite)
3. Recarga el Gestor de Plantillas

---

### **Problema 2: "Los cambios no se guardan"**

**Causa:** Modo edición no activado o error de validación.

**Solución:**
1. Asegúrate de estar en **"Modo Edición"** (botón en la esquina superior)
2. Verifica que todos los términos tienen valores válidos
3. Revisa la consola del navegador (F12) para errores

---

### **Problema 3: "La fórmula no calcula correctamente"**

**Causa:** Orden de operaciones o términos incompletos.

**Solución:**
1. Usa el **Mapa de Operaciones** para verificar la jerarquía
2. Asegúrate de que los operadores sean correctos (`+`, `-`, `×`, `÷`)
3. Verifica que las secciones referenciadas existen

---

## 📊 Flujo de Ejecución

```
┌─────────────────────────────────────────────────┐
│ 1. Usuario edita fórmula en FormulaBuilder     │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│ 2. FormulaBuilder guarda formula_terms         │
│    en la operación                              │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│ 3. plantillas.js guarda en SQLite              │
│    (tabla: layout_operaciones)                  │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│ 4. Al cargar tabla, cuentas-modulo.js          │
│    lee formula_terms                            │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│ 5. Ejecuta operaciones según términos          │
│    (suma, resta, multiplica, divide)            │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│ 6. Muestra resultado en fila de la tabla       │
└─────────────────────────────────────────────────┘
```

---

## 🎓 Conceptos Clave

### **Sección Principal**
Bloque grande como INCOME, EXPENSE, OPERATING, etc.
- Se renderiza como fila `principal-row`
- Puede contener subsecciones
- Tiene su propia operación con fórmula

### **Subsección**
Subcategoría dentro de una sección principal.
- Ejemplo: Dentro de EXPENSE → "Membership", "Events", "Committees"
- Se renderiza como fila `subsection-row`
- Suma sus cuentas hijas

### **Operación**
Definición de cálculo que puede:
- Sumar/restar secciones
- Incluir cuentas individuales
- Aplicar multiplicaciones/divisiones
- Referenciar otras operaciones

### **Término de Fórmula**
Un elemento individual en la fórmula:
```javascript
{
  operator: "+",      // +, -, *, /
  type: "section",    // section, account, operation, constant
  value: "EXPENSES"   // Referencia al elemento
}
```

---

## 💡 Tips y Mejores Prácticas

1. **Usa Nombres Descriptivos**: Nombra operaciones claramente (ej: "CONSOLIDATED INCOME" en lugar de "OP1")

2. **Agrupa Lógicamente**: Mantén operaciones relacionadas juntas en el orden de presentación

3. **Documenta Fórmulas Complejas**: En operaciones muy complejas, usa el campo de etiqueta para explicar

4. **Prueba Incrementalmente**: Guarda y verifica después de cada cambio importante

5. **Usa el Mapa Visual**: Para fórmulas con muchos términos, el mapa te ayuda a visualizar

6. **Respeta Jerarquías**: No referencias una operación que a su vez te referencia (circular)

---

## 🔐 Permisos

- ✅ **Modo Edición Requerido**: Debes activar "Modo Edición" en el Gestor de Plantillas
- ✅ **Solo Módulos Habilitados**: RESUMEN y SUMMARY permiten edición completa
- ⚠️ **Otros Módulos**: Algunos módulos tienen operaciones automáticas bloqueadas

---

## 📚 Referencias

- **Documentación Completa**: [DOCS_OPERACIONES_RESUMEN.md](./DOCS_OPERACIONES_RESUMEN.md)
- **Arquitectura del Sistema**: [DOCS_ARQUITECTURA_SISTEMAS.md](./DOCS_ARQUITECTURA_SISTEMAS.md)
- **Guía del Gestor**: [GUIA_GESTOR_PLANTILLAS.md](./GUIA_GESTOR_PLANTILLAS.md)

---

## ✨ Resumen Final

**SÍ, puedes personalizar completamente las fórmulas de EXPENSES y cualquier otra sección:**

1. ✅ Cambiar operadores (+, -, ×, ÷)
2. ✅ Agregar/eliminar términos
3. ✅ Incluir cuentas, secciones, operaciones, o números
4. ✅ Crear fórmulas totalmente personalizadas
5. ✅ Todo desde una interfaz visual intuitiva

**No necesitas tocar código**, todo se hace desde el **Gestor de Plantillas → Constructor de Fórmulas**.

---

**Fecha de creación:** 4 de febrero de 2026
**Versión:** 1.0
**Sistema:** SummaCham - Gestor de Plantillas
