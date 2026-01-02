# 📊 Sistema de Desglose de Operaciones - Formula Builder

## 🎯 Objetivo

Mostrar **exactamente** qué filas, cuentas, secciones y operaciones utiliza cada término de una operación para calcular su resultado, basándose en la lógica real de ejecución de las tablas.

---

## 🔍 Cómo Funciona Actualmente en las Tablas

### Función `recalcularSumas()` en cuentas-modulo.js

Esta función ejecuta 3 PASOS para calcular las operaciones:

#### **PASO 1: sum-row (Suma Vertical de Cuentas)**
```javascript
// Para cada sección, suma todas las FILAS DE CUENTA
secciones.forEach((seccion) => {
  const listas = seccion.filasCuenta.map((fila) => {
    // Extraer valores de cada fila de cuenta
    const cuenta = fila.dataset.cuenta21;
    const valores = extraerValoresNumericos(fila);
    return valores.map((valor) => (Number(valor) || 0) * factorCuenta);
  });
  
  // Sumar todas las filas columna por columna
  seccion.sumValues = sumarListas(listas, longitud);
});
```

**Ejemplo:**
- Sección "Ingresos Comités"
  - Cuenta 407001: $10,000
  - Cuenta 407002: $5,000
  - Cuenta 408001: $3,000
  - **sum-row = $18,000** ✅

---

#### **PASO 2: sumavarios (Suma de sum-rows Agrupados)**
```javascript
// Agrupa secciones por etiqueta sumavarios
secciones.forEach((seccion) => {
  const claves = [
    normalizarClave(seccion.sumRowSumavariosTexto),
    normalizarClave(seccion.sumRowSumavarios2Texto)
  ].filter(Boolean);
  
  claves.forEach((clave) => {
    const factor = seccion.factor; // +1 para ingresos, -1 para gastos
    const origen = seccion.sumValues;
    acumuladosSumavarios[clave] += origen * factor;
  });
});
```

**Ejemplo:**
- "CONSOLIDATED INCOME" = 
  - Ingresos Comités ($18,000) +
  - Ingresos Eventos ($25,000) +
  - Ingresos Membresía ($12,000)
  - **sumavarios = $55,000** ✅

---

#### **PASO 3: result-row (Aplicar Factor por Sección)**
```javascript
// Suma sum-rows de secciones con la misma etiqueta de resultado
secciones.forEach((seccion) => {
  const clave = normalizarClave(seccion.resultRowTexto);
  const factor = seccion.factor; // +1 o -1
  const origen = seccion.sumValues;
  acumuladosResultado[clave] += origen * factor;
});
```

**Ejemplo:**
- "Resultado Operativo Comités" =
  - sum-row Ingresos Comités ($18,000 × +1) +
  - sum-row Gastos Comités ($8,000 × -1)
  - **result-row = $10,000** ✅

---

## 🛠️ Implementación en Formula Builder

### Función `_getTermBreakdown(term)` 

Esta función desglosa cada término mostrando:

### 1️⃣ **type: "section"** - SUMA VERTICAL DE CUENTAS

```javascript
case "section": {
  // Buscar todas las cuentas de esta sección
  const matchingAccounts = state.cuentas.filter((c) => {
    const secondary = c.seccion_secundaria?.toLowerCase();
    const primary = c.seccion_principal?.toLowerCase();
    return secondary === sectionLower || primary === sectionLower;
  });
  
  // Mostrar las primeras 5 cuentas
  return `
    📊 Suma ${matchingAccounts.length} filas de cuentas:
    - 407001 | Ingresos por eventos
    - 407002 | Cuotas membresía
    - 408001 | Otros ingresos
    ...y 2 cuentas más
  `;
}
```

**Lo que ve el usuario:**
```
📊 Suma 5 filas de cuentas:
  📄 407001  Ingresos por eventos
  📄 407002  Cuotas membresía
  📄 408001  Otros ingresos
  📄 407005  Patrocinios
  📄 408005  Donaciones
```

---

### 2️⃣ **type: "operation"** - TÉRMINOS DE LA FÓRMULA

```javascript
case "operation": {
  const op = state.operaciones.find((o) => o.Clase === term.value);
  const opTerms = op.formula_terms || [];
  
  return `
    🧮 Operación con ${opTerms.length} términos:
    + Ingresos Comités [section]
    − Gastos Comités [section]
    + Otros Ingresos [operation]
  `;
}
```

**Lo que ve el usuario:**
```
🧮 Operación con 3 términos:
  + 📁 Ingresos Comités [section]
  − 📁 Gastos Comités [section]
  + 🧮 Otros Ingresos [operation]
```

---

### 3️⃣ **type: "account"** - CUENTA INDIVIDUAL

```javascript
case "account": {
  const cuenta = state.cuentas.find((c) => c.CUENTA === term.value);
  
  return `
    📋 Cuenta individual:
    407001 | Ingresos por eventos
  `;
}
```

**Lo que ve el usuario:**
```
📋 Cuenta individual:
  407001  Ingresos por eventos
```

---

### 4️⃣ **type: "constant"** - VALOR FIJO

```javascript
case "constant": {
  return `
    🔢 Valor constante:
    1000
  `;
}
```

**Lo que ve el usuario:**
```
🔢 Valor constante:
  1000
```

---

## 🎨 Estilos Visuales

### CSS `.term-breakdown`

```css
.term-breakdown {
  background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
  border-left: 4px solid #0d6efd;
  border-radius: 8px;
  padding: 12px 16px;
  max-height: 300px;
  overflow-y: auto;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}
```

**Características:**
- ✅ Gradiente suave de fondo
- ✅ Borde izquierdo azul para identificación
- ✅ Scroll automático si hay muchas cuentas
- ✅ Sombra sutil para profundidad
- ✅ Hover con animación

---

## 📋 Ejemplo Completo

### Operación: "Resultado Operativo Comités"

**Fórmula:**
```
Ingresos Comités − Gastos Comités − Gastos Administrativos
```

**Desglose Automático:**

#### Término 1: `Ingresos Comités` [section]
```
📊 Suma 5 filas de cuentas:
  📄 407001  Ingresos por eventos
  📄 407002  Cuotas membresía  
  📄 408001  Otros ingresos
  📄 407005  Patrocinios
  📄 408005  Donaciones
```

#### Término 2: `Gastos Comités` [section]
```
📊 Suma 3 filas de cuentas:
  📄 801001  Salarios personal
  📄 801005  Servicios profesionales
  📄 901001  Material de oficina
```

#### Término 3: `Gastos Administrativos` [section]
```
📊 Suma 4 filas de cuentas:
  📄 802001  Renta oficina
  📄 802005  Servicios públicos
  📄 902001  Papelería
  📄 902005  Mantenimiento
```

**Resultado Final:**
```
= ($18,000 suma de ingresos)
− ($8,000 suma de gastos)
− ($3,500 suma de admin)
= $6,500 ✅
```

---

## 🔄 Flujo de Datos

```
┌─────────────────────────────────────────────┐
│  1. Usuario abre operación para editar      │
│     "Resultado Operativo Comités"           │
└────────────────┬────────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────────┐
│  2. Formula Builder carga formula_terms     │
│     [                                        │
│       {type: "section", value: "Ingresos"}, │
│       {type: "section", value: "Gastos"}    │
│     ]                                        │
└────────────────┬────────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────────┐
│  3. _getTermBreakdown() analiza cada term  │
│     - Busca en window.state.cuentas         │
│     - Filtra por seccion_secundaria         │
│     - Genera HTML con las 5 primeras       │
└────────────────┬────────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────────┐
│  4. Renderiza desglose debajo del término  │
│     Con iconos, colores y scroll            │
└─────────────────────────────────────────────┘
```

---

## ✅ Ventajas del Sistema

1. **Transparencia Total**: El usuario ve exactamente qué se está calculando
2. **Basado en Lógica Real**: Refleja cómo funciona `recalcularSumas()`
3. **Visual e Intuitivo**: Iconos y colores facilitan la comprensión
4. **Escalable**: Funciona con 5 o 500 cuentas (con scroll)
5. **Mantenible**: Usa los mismos datos que las tablas (window.state)

---

## 🔧 Archivos Modificados

- ✅ `vistas/js/formula-builder.js` - Función `_getTermBreakdown()`
- ✅ `vistas/css/formula-builder.css` - Estilos `.term-breakdown`

---

## 📚 Referencias

- `vistas/js/cuentas-modulo.js` líneas 3800-4050: `recalcularSumas()`
- `LOGICA_OPERACIONES_MODULOS.md`: Documentación completa del sistema
- `info IMPORTANTE/columnas de summary.md`: Definición de filas calculadas

---

**Fecha:** 2 de enero de 2026  
**Estado:** ✅ Implementado y funcionando
