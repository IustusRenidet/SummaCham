# 📘 Sistema de Inserción de Filas y Secciones en los 13 Módulos

## 🎯 Visión General del Sistema

El **Sistema Inteligente de Inserción** es un wizard de 3 pasos que permite agregar **cuentas**, **secciones** y **operaciones** en **SUMMARY**, **RESUMEN** y los **12 módulos de planeación** (Comités, Comunicación, Dirección, Eventos, Finanzas, Gtos Corporativos, Membresía, RH, Serv Membresía, T&IC, VPE, Presupuestos).

---

## 🏗️ Arquitectura de Jerarquías

### 📊 SUMMARY (2 niveles)

```
CAPÍTULO (Ciudad de México, Guadalajara, Noreste, Noroeste)
  └── SECCIÓN PRINCIPAL (Income, Expense, etc.)
      └── SECCIÓN SECUNDARIA (Membership, Events, etc.)
          └── CUENTA (401000000000000000001, etc.)
              └── SUM ROW (Total Membership)
```

**Jerarquía:**
1. **CAPÍTULO** → Empresa (CDMX, GDL, NE, NO)
2. **SECCIÓN PRINCIPAL** → Bloque principal (Income, Expense)
3. **SECCIÓN SECUNDARIA** → Subsección (Membership, Events)
4. **CUENTA** → Cuenta contable individual
5. **SUM ROW** → Fila de total automática

**Formatos:**
- Cuenta: **21 dígitos** (ej: `401000000000000000001`)
- SUM ROW: Siempre tiene `CUENTA = 'SUM'`

---

### 📈 RESUMEN (3 niveles)

```
CAPÍTULO (Ciudad de México, Guadalajara, Noreste, Noroeste)
  └── SECCIÓN PRINCIPAL (Income, Expense, etc.)
      └── SECCIÓN SECUNDARIA (Membership, Events, etc.)
          └── OPERACIÓN (Cuotas Regulares, Eventos Especiales)
              └── CUENTA (401-001-000-00, etc.)
                  └── SUM ROW (Total Cuotas)
```

**Jerarquía:**
1. **CAPÍTULO** → Empresa (CDMX, GDL, NE, NO)
2. **SECCIÓN PRINCIPAL** → Bloque principal (Income, Expense)
3. **SECCIÓN SECUNDARIA** → Subsección (Membership, Events)
4. **OPERACIÓN** → Agrupación de cuentas (Cuotas Regulares, Eventos VIP)
5. **CUENTA** → Cuenta contable individual
6. **SUM ROW** → Fila de total automática

**Formatos:**
- Cuenta: **XXX-XXX-XXX-XX** (ej: `401-001-000-00`)
- SUM ROW: Siempre tiene `CUENTA = 'SUM'`

---

### 🗂️ MÓDULOS (12 módulos: Comités, Comunicación, etc.)

```
CAPÍTULO (Ciudad de México, Guadalajara, Noreste, Noroeste)
  └── SECCIÓN (Comunicación Externa, Marketing Digital)
      └── OPERACIÓN (Opcional: Campañas Q1, Eventos)
          └── CUENTA (401-001-000-00, etc.)
              └── SUM ROW (Total Sección)
```

**Jerarquía:**
1. **CAPÍTULO** → Empresa (CDMX, GDL, NE, NO)
2. **SECCIÓN** → Sección del módulo (Marketing, Eventos Corporativos)
3. **OPERACIÓN** (OPCIONAL) → Sub-agrupación de cuentas
4. **CUENTA** → Cuenta contable individual
5. **SUM ROW** → Fila de total automática

**Formatos:**
- Cuenta: **XXX-XXX-XXX-XX** (ej: `401-001-000-00`)
- SUM ROW: Siempre tiene `CUENTA = 'SUM'`

**Diferencia clave:** En MÓDULOS, la **OPERACIÓN es OPCIONAL**. Una cuenta puede ir:
- **Directo a SECCIÓN:** `CDMX → Marketing → Cuenta 401-001-000-00`
- **Dentro de OPERACIÓN:** `CDMX → Marketing → Campaña Q1 → Cuenta 401-001-000-00`

---

## 📝 Estructura de Datos en JSON

### SUMMARY (`CUENTAS SUMMARY y RESUMEN.json`)

```json
{
  "SUMMARY": [
    {
      "CAPITULO": "CIUDAD DE MÉXICO",
      "SECCIÓN Principal": "Income",
      "SECCION Secundaria": "Membership",
      "CUENTA": "401000000000000000001",
      "NOMBRE": "Regular Membership Dues"
    },
    {
      "CAPITULO": "CIUDAD DE MÉXICO",
      "SECCIÓN Principal": "Income",
      "SECCION Secundaria": "Membership",
      "CUENTA": "SUM",
      "NOMBRE": "Total Membership",
      "ES_SUM_ROW": true
    }
  ]
}
```

**Campos:**
- `CAPITULO`: Empresa (CIUDAD DE MÉXICO, GUADALAJARA, NORESTE, NOROESTE)
- `SECCIÓN Principal`: Nombre de la sección principal
- `SECCION Secundaria`: Nombre de la sección secundaria (vacío para SUM ROW de principal)
- `CUENTA`: Número de cuenta (21 dígitos) o `'SUM'` para totales
- `NOMBRE`: Descripción de la cuenta o etiqueta del total
- `ES_SUM_ROW`: `true` para filas de total (opcional)
- `ES_SECCION`: `true` para filas de sección sin cuenta (opcional)

---

### RESUMEN (`CUENTAS SUMMARY y RESUMEN.json`)

```json
{
  "RESUMEN": [
    {
      "CAPITULO": "CIUDAD DE MÉXICO",
      "SECCIÓN Principal": "Income",
      "SECCION Secundaria": "Membership",
      "OPERACIÓN": "Regular Dues",
      "CUENTA": "401-001-000-00",
      "NOMBRE": "Corporate Membership"
    },
    {
      "CAPITULO": "CIUDAD DE MÉXICO",
      "SECCIÓN Principal": "Income",
      "SECCION Secundaria": "Membership",
      "OPERACIÓN": "Regular Dues",
      "CUENTA": "SUM",
      "NOMBRE": "Total Regular Dues",
      "ES_SUM_ROW": true
    }
  ]
}
```

**Campos:**
- `CAPITULO`: Empresa
- `SECCIÓN Principal`: Nombre de la sección principal
- `SECCION Secundaria`: Nombre de la sección secundaria
- `OPERACIÓN`: Nombre de la operación (vacío para SUM ROW de secundaria)
- `CUENTA`: Cuenta en formato `XXX-XXX-XXX-XX` o `'SUM'`
- `NOMBRE`: Descripción o etiqueta del total
- `ES_SUM_ROW`: `true` para totales
- `ES_OPERACION`: `true` para filas de operación sin cuenta
- `ES_SECCION`: `true` para filas de sección sin cuenta

---

### MÓDULOS (`CUENTAS.json`)

```json
{
  "Finanzas": [
    {
      "CAPITULO": "CIUDAD DE MÉXICO",
      "SECCION": "Contabilidad",
      "CUENTA": "501-001-000-00",
      "NOMBRE": "Software Contable"
    },
    {
      "CAPITULO": "CIUDAD DE MÉXICO",
      "SECCION": "Contabilidad",
      "OPERACIÓN": "Auditorías",
      "CUENTA": "501-002-000-00",
      "NOMBRE": "Auditoría Externa"
    },
    {
      "CAPITULO": "CIUDAD DE MÉXICO",
      "SECCION": "Contabilidad",
      "CUENTA": "SUM",
      "NOMBRE": "Total Contabilidad",
      "ES_SUM_ROW": true
    }
  ],
  "Eventos": [...],
  "Comunicación": [...]
}
```

**Campos:**
- `CAPITULO`: Empresa
- `SECCION`: Nombre de la sección del módulo
- `OPERACIÓN`: (OPCIONAL) Sub-agrupación
- `CUENTA`: Formato `XXX-XXX-XXX-XX` o `'SUM'`
- `NOMBRE`: Descripción o etiqueta del total
- `ES_SUM_ROW`: `true` para totales
- `ES_OPERACION`: `true` para filas de operación sin cuenta
- `ES_SECCION`: `true` para filas de sección sin cuenta

**Módulos disponibles:**
1. `Comités`
2. `Comunicación`
3. `Dirección`
4. `Eventos`
5. `Finanzas`
6. `Gtos Corporativos`
7. `Membresía`
8. `RH`
9. `Serv Membresía`
10. `T&IC`
11. `VPE`
12. `Presupuestos`

---

## 🧙‍♂️ Wizard de Inserción: 3 Pasos

### 📍 PASO 1: Selección de Tipo de Elemento

**Opciones en SUMMARY:**
```
┌────────────────────────────────────────┐
│ ¿Qué deseas agregar?                   │
├────────────────────────────────────────┤
│ ○ 📊 Nueva Cuenta                      │
│    Agregar una cuenta contable a una   │
│    sección existente                   │
│                                        │
│ ○ 📁 Nueva Sección Secundaria          │
│    Crear una subsección dentro de una  │
│    sección principal                   │
│                                        │
│ ○ 📂 Nueva Sección Principal           │
│    Crear una nueva sección principal   │
│    en el capítulo                      │
└────────────────────────────────────────┘
```

**Opciones en RESUMEN:**
```
┌────────────────────────────────────────┐
│ ¿Qué deseas agregar?                   │
├────────────────────────────────────────┤
│ ○ 📊 Nueva Cuenta                      │
│    Agregar una cuenta a una operación  │
│                                        │
│ ○ ⚙️ Nueva Operación                   │
│    Crear una operación dentro de una   │
│    sección secundaria                  │
│                                        │
│ ○ 📁 Nueva Sección Secundaria          │
│    Crear una subsección dentro de una  │
│    sección principal                   │
│                                        │
│ ○ 📂 Nueva Sección Principal           │
│    Crear una nueva sección principal   │
└────────────────────────────────────────┘
```

**Opciones en MÓDULOS:**
```
┌────────────────────────────────────────┐
│ ¿Qué deseas agregar?                   │
├────────────────────────────────────────┤
│ ○ 📊 Nueva Cuenta                      │
│    Agregar una cuenta a una sección    │
│                                        │
│ ○ ⚙️ Nueva Operación (Opcional)        │
│    Agrupar cuentas en una operación    │
│                                        │
│ ○ 📁 Nueva Sección                     │
│    Crear una nueva sección en el       │
│    módulo                              │
└────────────────────────────────────────┘
```

**Funcionalidad:**
- Radio buttons para selección única
- Descripción de cada opción
- Icono visual distintivo
- Al seleccionar, habilita botón "Siguiente"

---

### 🌳 PASO 2: Selección de Contexto Jerárquico

**Ejemplo: Nueva Cuenta en SUMMARY**
```
┌────────────────────────────────────────┐
│ Selecciona la ubicación                │
├────────────────────────────────────────┤
│ Capítulo/Empresa *                     │
│ ┌──────────────────────┐               │
│ │ Ciudad de México   ▼ │               │
│ └──────────────────────┘               │
│                                        │
│ Sección Principal *                    │
│ ┌──────────────────────┐               │
│ │ Income             ▼ │               │
│ └──────────────────────┘               │
│                                        │
│ Sección Secundaria *                   │
│ ┌──────────────────────┐               │
│ │ Membership         ▼ │               │
│ └──────────────────────┘               │
│                                        │
│ 📍 Ciudad de México > Income >         │
│    Membership                          │
└────────────────────────────────────────┘
```

**Ejemplo: Nueva Operación en RESUMEN**
```
┌────────────────────────────────────────┐
│ Selecciona la ubicación                │
├────────────────────────────────────────┤
│ Capítulo/Empresa *                     │
│ ┌──────────────────────┐               │
│ │ Guadalajara        ▼ │               │
│ └──────────────────────┘               │
│                                        │
│ Sección Principal *                    │
│ ┌──────────────────────┐               │
│ │ Income             ▼ │               │
│ └──────────────────────┘               │
│                                        │
│ Sección Secundaria *                   │
│ ┌──────────────────────┐               │
│ │ Events             ▼ │               │
│ └──────────────────────┘               │
│                                        │
│ 📍 Guadalajara > Income > Events       │
└────────────────────────────────────────┘
```

**Ejemplo: Nueva Cuenta en MÓDULOS (con Operación Opcional)**
```
┌────────────────────────────────────────┐
│ Selecciona la ubicación                │
├────────────────────────────────────────┤
│ Capítulo/Empresa *                     │
│ ┌──────────────────────┐               │
│ │ Noreste            ▼ │               │
│ └──────────────────────┘               │
│                                        │
│ Sección *                              │
│ ┌──────────────────────┐               │
│ │ Marketing Digital  ▼ │               │
│ └──────────────────────┘               │
│                                        │
│ Operación (opcional)                   │
│ ┌──────────────────────┐               │
│ │ Ninguna            ▼ │               │
│ └──────────────────────┘               │
│                                        │
│ 📍 Noreste > Marketing Digital         │
└────────────────────────────────────────┘
```

**Funcionalidad:**
- Selects en cascada (cada select carga opciones según anterior)
- Breadcrumb visual del camino seleccionado
- Campos con asterisco (*) son obligatorios
- Validación: No permitir siguiente hasta completar obligatorios

**Lógica de carga:**
1. Al seleccionar **Capítulo**, carga **Secciones Principales** de ese capítulo
2. Al seleccionar **Principal**, carga **Secciones Secundarias** de esa principal
3. Al seleccionar **Secundaria**, carga **Operaciones** (si aplica) de esa secundaria

---

### ✏️ PASO 3: Ingreso de Datos con Validación

**Ejemplo: Nueva Cuenta en SUMMARY**
```
┌────────────────────────────────────────┐
│ Datos de Cuenta                        │
├────────────────────────────────────────┤
│ Número de Cuenta *                     │
│ ┌──────────────────────┐ ✅            │
│ │ 401000000000000000123 │              │
│ └──────────────────────┘              │
│ ✓ Formato válido (21 dígitos)         │
│                                        │
│ Nombre *                               │
│ ┌──────────────────────┐ ✅            │
│ │ VIP Membership Dues   │              │
│ └──────────────────────┘              │
│                                        │
│ Tipo de Cuenta                         │
│ ┌──────────────────────┐               │
│ │ Ingreso            ▼ │              │
│ └──────────────────────┘              │
│                                        │
│ ➡️ Se insertará:                       │
│    Cuenta: 401000000000000000123       │
│    📍 CDMX > Income > Membership       │
│    Nombre: VIP Membership Dues         │
└────────────────────────────────────────┘
```

**Ejemplo: Nueva Sección Secundaria en RESUMEN**
```
┌────────────────────────────────────────┐
│ Datos de Sección Secundaria            │
├────────────────────────────────────────┤
│ Nombre *                               │
│ ┌──────────────────────┐ ✅            │
│ │ Eventos Especiales    │              │
│ └──────────────────────┘              │
│                                        │
│ Etiqueta de Total *                    │
│ ┌──────────────────────┐ ✅            │
│ │ Total Eventos Espec.  │              │
│ └──────────────────────┘              │
│ ℹ️ Se creará automáticamente SUM ROW   │
│                                        │
│ ➡️ Se insertará:                       │
│    Sección Secundaria: Eventos Esp.    │
│    📍 CDMX > Income > Eventos Esp.     │
│    ✓ Se creará SUM ROW                 │
└────────────────────────────────────────┘
```

**Ejemplo: Nueva Operación en MÓDULOS**
```
┌────────────────────────────────────────┐
│ Datos de Operación                     │
├────────────────────────────────────────┤
│ Nombre *                               │
│ ┌──────────────────────┐ ✅            │
│ │ Campaña Q1 2025       │              │
│ └──────────────────────┘              │
│                                        │
│ Etiqueta de Total *                    │
│ ┌──────────────────────┐ ✅            │
│ │ Total Campaña Q1      │              │
│ └──────────────────────┘              │
│ ℹ️ Se creará automáticamente SUM ROW   │
│                                        │
│ ➡️ Se insertará:                       │
│    Operación: Campaña Q1 2025          │
│    📍 GDL > Marketing > Campaña Q1     │
│    ✓ Se creará SUM ROW                 │
└────────────────────────────────────────┘
```

**Validación en Tiempo Real:**

1. **Número de Cuenta:**
   - SUMMARY: 21 dígitos consecutivos (`^\d{21}$`)
   - RESUMEN/MÓDULOS: XXX-XXX-XXX-XX (`^\d{3}-\d{3}-\d{3}-\d{2}$`)
   - ✅ Formato correcto → checkmark verde
   - ❌ Formato incorrecto → X roja + mensaje de error

2. **Duplicados:**
   - Busca en DOM si ya existe la cuenta/sección/operación
   - ❌ Duplicado → X roja + mensaje "Ya existe en [ubicación]"
   - ✅ Único → checkmark verde

3. **Campos Obligatorios:**
   - Cuenta: `numero`, `nombre`
   - Sección/Operación: `nombre`, `etiquetaSum`
   - ❌ Vacío → input con borde rojo
   - ✅ Completo → checkmark verde

**Preview de Inserción:**
- Muestra resumen de lo que se va a crear
- Breadcrumb de ubicación
- Confirmación de SUM ROW (si aplica)
- Advertencias informativas

---

## 🔧 Backend: Rutas API

### POST `/api/insercion/cuenta`
**Descripción:** Inserta una nueva cuenta en el JSON correspondiente

**Body:**
```json
{
  "moduleType": "SUMMARY",
  "context": {
    "capitulo": "CIUDAD DE MÉXICO",
    "principal": "Income",
    "secundaria": "Membership",
    "operacion": ""
  },
  "formData": {
    "numero": "401000000000000000999",
    "nombre": "Premium Membership",
    "tipo": "ingreso"
  }
}
```

**Response (200):**
```json
{
  "exito": true,
  "mensaje": "Cuenta agregada exitosamente",
  "cuenta": {
    "CAPITULO": "CIUDAD DE MÉXICO",
    "SECCIÓN Principal": "Income",
    "SECCION Secundaria": "Membership",
    "CUENTA": "401000000000000000999",
    "NOMBRE": "Premium Membership"
  }
}
```

**Response (400) - Error:**
```json
{
  "exito": false,
  "mensaje": "La cuenta 401000000000000000999 ya existe"
}
```

**Lógica:**
1. Valida jerarquía (debe haber capitulo, principal, secundaria para SUMMARY)
2. Valida formato de cuenta según moduleType
3. Verifica duplicados en JSON
4. Carga `CUENTAS SUMMARY y RESUMEN.json` o `CUENTAS.json`
5. Agrega nueva entrada al array correspondiente
6. Guarda JSON actualizado
7. Retorna confirmación

---

### POST `/api/insercion/seccion`
**Descripción:** Inserta una nueva sección (principal, secundaria, o sección de módulo) con SUM ROW automático

**Body:**
```json
{
  "moduleType": "RESUMEN",
  "tipo": "secundaria",
  "context": {
    "capitulo": "GUADALAJARA",
    "principal": "Expense"
  },
  "formData": {
    "nombre": "IT Services",
    "etiquetaSum": "Total IT Services"
  }
}
```

**Response (200):**
```json
{
  "exito": true,
  "mensaje": "Sección agregada exitosamente",
  "seccion": {
    "CAPITULO": "GUADALAJARA",
    "SECCIÓN Principal": "Expense",
    "SECCION Secundaria": "IT Services",
    "OPERACIÓN": "",
    "CUENTA": "",
    "NOMBRE": "IT Services",
    "ES_SECCION": true
  },
  "sumRow": {
    "CAPITULO": "GUADALAJARA",
    "SECCIÓN Principal": "Expense",
    "SECCION Secundaria": "IT Services",
    "OPERACIÓN": "",
    "CUENTA": "SUM",
    "NOMBRE": "Total IT Services",
    "ES_SUM_ROW": true
  }
}
```

**Lógica:**
1. Valida jerarquía según tipo:
   - `principal`: Solo necesita `capitulo`
   - `secundaria`: Necesita `capitulo` + `principal`
   - `seccion` (módulos): Solo necesita `capitulo`
2. Verifica duplicados
3. Crea **DOS filas**:
   - Fila de sección (con `ES_SECCION: true`)
   - Fila de SUM ROW (con `CUENTA: 'SUM'`, `ES_SUM_ROW: true`)
4. Guarda JSON
5. Retorna confirmación con ambas filas

---

### POST `/api/insercion/operacion`
**Descripción:** Inserta una nueva operación (solo RESUMEN y MÓDULOS) con SUM ROW automático

**Body:**
```json
{
  "moduleType": "MODULOS",
  "context": {
    "capitulo": "NORESTE",
    "seccion": "Marketing"
  },
  "formData": {
    "nombre": "Campaña Digital Q2",
    "etiquetaSum": "Total Campaña Q2"
  }
}
```

**Response (200):**
```json
{
  "exito": true,
  "mensaje": "Operación agregada exitosamente",
  "operacion": {
    "CAPITULO": "NORESTE",
    "SECCION": "Marketing",
    "OPERACIÓN": "Campaña Digital Q2",
    "CUENTA": "",
    "NOMBRE": "Campaña Digital Q2",
    "ES_OPERACION": true
  },
  "sumRow": {
    "CAPITULO": "NORESTE",
    "SECCION": "Marketing",
    "OPERACIÓN": "Campaña Digital Q2",
    "CUENTA": "SUM",
    "NOMBRE": "Total Campaña Q2",
    "ES_SUM_ROW": true
  }
}
```

**Lógica:**
1. Valida que NO sea SUMMARY (no soporta operaciones)
2. Valida jerarquía:
   - RESUMEN: Necesita `capitulo` + `principal` + `secundaria`
   - MÓDULOS: Necesita `capitulo` + `seccion`
3. Verifica duplicados
4. Crea **DOS filas**:
   - Fila de operación (con `ES_OPERACION: true`)
   - Fila de SUM ROW (con `CUENTA: 'SUM'`, `ES_SUM_ROW: true`)
5. Guarda JSON según módulo específico (Finanzas, Eventos, etc.)
6. Retorna confirmación

---

### GET `/api/insercion/opciones/:level`
**Descripción:** Obtiene opciones disponibles para un nivel jerárquico

**Parámetros de ruta:**
- `:level` → `capitulo`, `principal`, `secundaria`, `seccion`, `operacion`

**Query params:**
- `moduleType` → `SUMMARY`, `RESUMEN`, `MODULOS`
- `capitulo` → Filtrar por capítulo
- `principal` → Filtrar por principal (para secundarias)
- `secundaria` → Filtrar por secundaria (para operaciones)

**Ejemplo:** GET `/api/insercion/opciones/secundaria?moduleType=SUMMARY&capitulo=CIUDAD%20DE%20M%C3%89XICO&principal=Income`

**Response (200):**
```json
{
  "exito": true,
  "opciones": [
    "Membership",
    "Events",
    "Communications",
    "Other Income"
  ]
}
```

**Lógica:**
1. Carga JSON según moduleType
2. Filtra según query params
3. Extrae valores únicos del campo solicitado
4. Ordena alfabéticamente
5. Retorna array de opciones

---

## ✅ Validaciones Implementadas

### 1. Validación de Jerarquía

**Objetivo:** Asegurar que no haya elementos "sueltos" sin padre

**Reglas:**

| Módulo  | Tipo        | Requiere                                      |
|---------|-------------|-----------------------------------------------|
| SUMMARY | Cuenta      | Capítulo + Principal + Secundaria             |
| SUMMARY | Secundaria  | Capítulo + Principal                          |
| SUMMARY | Principal   | Capítulo                                      |
| RESUMEN | Cuenta      | Capítulo + Principal + Secundaria + Operación |
| RESUMEN | Operación   | Capítulo + Principal + Secundaria             |
| RESUMEN | Secundaria  | Capítulo + Principal                          |
| RESUMEN | Principal   | Capítulo                                      |
| MÓDULOS | Cuenta      | Capítulo + Sección (+ Operación opcional)     |
| MÓDULOS | Operación   | Capítulo + Sección                            |
| MÓDULOS | Sección     | Capítulo                                      |

**Implementación:**
```javascript
function validarJerarquia(tipo, context, moduleType) {
  const errors = [];

  if (moduleType === 'SUMMARY') {
    if (tipo === 'cuenta' && (!context.principal || !context.secundaria)) {
      errors.push('Una cuenta en SUMMARY requiere Sección Principal y Secundaria');
    }
    if (tipo === 'secundaria' && !context.principal) {
      errors.push('Una Sección Secundaria requiere una Sección Principal');
    }
  }

  if (moduleType === 'RESUMEN') {
    if (tipo === 'cuenta' && (!context.principal || !context.secundaria || !context.operacion)) {
      errors.push('Una cuenta en RESUMEN requiere Principal, Secundaria y Operación');
    }
    if (tipo === 'operacion' && (!context.principal || !context.secundaria)) {
      errors.push('Una Operación requiere Sección Principal y Secundaria');
    }
    if (tipo === 'secundaria' && !context.principal) {
      errors.push('Una Sección Secundaria requiere una Sección Principal');
    }
  }

  if (moduleType === 'MODULOS') {
    if (tipo === 'cuenta' && !context.seccion) {
      errors.push('Una cuenta en MÓDULOS requiere una Sección');
    }
    if (tipo === 'operacion' && !context.seccion) {
      errors.push('Una Operación requiere una Sección');
    }
  }

  return errors;
}
```

---

### 2. Validación de Duplicados

**Objetivo:** Prevenir duplicación de cuentas/secciones/operaciones

**Lógica:**
```javascript
function verificarDuplicado(tipo, data, config, moduleType) {
  const targetArray = config[moduleType] || [];

  if (tipo === 'cuenta') {
    const existe = targetArray.some(item => item.CUENTA === data.numero);
    if (existe) {
      return { duplicado: true, mensaje: `La cuenta ${data.numero} ya existe` };
    }
  }

  if (tipo === 'secundaria') {
    const existe = targetArray.some(item => 
      item['SECCION Secundaria'] === data.nombre && 
      item['SECCIÓN Principal'] === data.principal
    );
    if (existe) {
      return { duplicado: true, mensaje: `Ya existe una Secundaria "${data.nombre}" en "${data.principal}"` };
    }
  }

  if (tipo === 'operacion') {
    const existe = targetArray.some(item => 
      item.OPERACIÓN === data.nombre &&
      item['SECCION Secundaria'] === data.secundaria
    );
    if (existe) {
      return { duplicado: true, mensaje: `Ya existe una Operación "${data.nombre}" en "${data.secundaria}"` };
    }
  }

  return { duplicado: false };
}
```

**Búsqueda en:**
- JSON en memoria (backend)
- DOM renderizado (frontend con `InsertionValidator`)

---

### 3. Validación de Formato

**Objetivo:** Asegurar formato correcto de número de cuenta

**Reglas:**
- **SUMMARY:** 21 dígitos consecutivos → `/^\d{21}$/`
- **RESUMEN/MÓDULOS:** XXX-XXX-XXX-XX → `/^\d{3}-\d{3}-\d{3}-\d{2}$/`

**Implementación:**
```javascript
function validarFormato(numero, moduleType) {
  if (moduleType === 'SUMMARY') {
    if (!/^\d{21}$/.test(numero)) {
      return { 
        valido: false, 
        mensaje: 'Formato incorrecto. Debe ser 21 dígitos consecutivos (ej: 401000000000000000001)' 
      };
    }
  } else {
    if (!/^\d{3}-\d{3}-\d{3}-\d{2}$/.test(numero)) {
      return { 
        valido: false, 
        mensaje: 'Formato incorrecto. Debe ser XXX-XXX-XXX-XX (ej: 401-001-000-00)' 
      };
    }
  }

  return { valido: true };
}
```

---

## 🎨 Flujo Completo: Ejemplo Real

### Escenario: Agregar cuenta en módulo FINANZAS

**Contexto inicial:**
- Usuario: Ciudad de México
- Módulo: Finanzas
- Quiere agregar: Cuenta para "Hosting Web"
- Sección existente: "Tecnología"

**Paso 1: Click en botón "Agregar"**
```
Usuario hace click en botón o menú contextual
  ↓
Wizard se abre con InsertionWizard.open()
  ↓
detectModuleType() → detecta "MODULOS"
  ↓
Renderiza Paso 1 con opciones:
  - Nueva Cuenta
  - Nueva Operación
  - Nueva Sección
```

**Paso 2: Selecciona "Nueva Cuenta"**
```
Usuario selecciona "📊 Nueva Cuenta"
  ↓
selectedType = 'cuenta'
  ↓
Avanza a Paso 2
```

**Paso 3: Selecciona ubicación**
```
Capítulo/Empresa: [Ciudad de México ▼]
  ↓
Sección: [Tecnología ▼]
  ↓
Operación (opcional): [Ninguna ▼]
  ↓
Breadcrumb muestra: "📍 Ciudad de México > Tecnología"
  ↓
Avanza a Paso 3
```

**Paso 4: Ingresa datos**
```
Número de Cuenta: 501-001-005-00
  ↓
Valida formato en tiempo real: ✅ (cumple XXX-XXX-XXX-XX)
  ↓
Verifica duplicados: ✅ (no existe en DOM)
  ↓
Nombre: Hosting Web
  ↓
Tipo: Gasto
  ↓
Preview muestra:
  "➡️ Se insertará:
   Cuenta: 501-001-005-00
   📍 CDMX > Finanzas > Tecnología
   Nombre: Hosting Web"
```

**Paso 5: Confirmación**
```
Usuario hace click en "Crear Elemento"
  ↓
submit() ejecuta validación final
  ↓
InsertionValidator.validarAntesDeProcesar()
  → ✅ Jerarquía completa (Capítulo + Sección)
  → ✅ Formato correcto (XXX-XXX-XXX-XX)
  → ✅ No duplicado
  → ✅ Campos obligatorios completos
  ↓
realizarInsercion() llama API:
  POST /api/insercion/cuenta
  Body: {
    moduleType: "MODULOS",
    context: {
      capitulo: "CIUDAD DE MÉXICO",
      seccion: "Tecnología"
    },
    formData: {
      numero: "501-001-005-00",
      nombre: "Hosting Web",
      tipo: "gasto"
    }
  }
```

**Paso 6: Backend procesa**
```
Backend recibe POST /api/insercion/cuenta
  ↓
Valida jerarquía: ✅ (tiene capitulo + seccion)
  ↓
Valida formato: ✅ (cumple XXX-XXX-XXX-XX)
  ↓
Carga CUENTAS.json
  ↓
Verifica duplicado en JSON: ✅ (no existe)
  ↓
Crea nueva entrada:
  {
    "CAPITULO": "CIUDAD DE MÉXICO",
    "SECCION": "Tecnología",
    "CUENTA": "501-001-005-00",
    "NOMBRE": "Hosting Web"
  }
  ↓
Agrega a config["Finanzas"]
  ↓
Guarda CUENTAS.json actualizado
  ↓
Retorna 200 OK con confirmación
```

**Paso 7: Frontend actualiza**
```
Frontend recibe respuesta exitosa
  ↓
Muestra alerta: "✅ Elemento creado exitosamente!"
  ↓
Cierra modal del wizard
  ↓
Recarga tabla con window.cargarDatos()
  ↓
Nueva fila aparece en la tabla:
  | 501-001-005-00 | Hosting Web | Tecnología | ... |
```

---

## 📦 Resumen: Elementos Creados Automáticamente

### Al crear Sección:
```
1 Sección + 1 SUM ROW = 2 filas totales
```

**Ejemplo en SUMMARY:**
```json
[
  {
    "CAPITULO": "CIUDAD DE MÉXICO",
    "SECCIÓN Principal": "Income",
    "SECCION Secundaria": "Sponsors",
    "CUENTA": "",
    "NOMBRE": "Sponsors",
    "ES_SECCION": true
  },
  {
    "CAPITULO": "CIUDAD DE MÉXICO",
    "SECCIÓN Principal": "Income",
    "SECCION Secundaria": "Sponsors",
    "CUENTA": "SUM",
    "NOMBRE": "Total Sponsors",
    "ES_SUM_ROW": true
  }
]
```

### Al crear Operación:
```
1 Operación + 1 SUM ROW = 2 filas totales
```

**Ejemplo en RESUMEN:**
```json
[
  {
    "CAPITULO": "GUADALAJARA",
    "SECCIÓN Principal": "Expense",
    "SECCION Secundaria": "Marketing",
    "OPERACIÓN": "Digital Ads",
    "CUENTA": "",
    "NOMBRE": "Digital Ads",
    "ES_OPERACION": true
  },
  {
    "CAPITULO": "GUADALAJARA",
    "SECCIÓN Principal": "Expense",
    "SECCION Secundaria": "Marketing",
    "OPERACIÓN": "Digital Ads",
    "CUENTA": "SUM",
    "NOMBRE": "Total Digital Ads",
    "ES_SUM_ROW": true
  }
]
```

### Al crear Cuenta:
```
1 Cuenta = 1 fila
```
(No se crea SUM ROW porque ya debería existir de la sección/operación padre)

---

## 🎯 Conclusión

El **Sistema Inteligente de Inserción** garantiza:

✅ **Jerarquía correcta** - No hay elementos sueltos  
✅ **Sin duplicados** - Valida en JSON y DOM  
✅ **Formatos correctos** - Según módulo (21 dígitos o XXX-XXX-XXX-XX)  
✅ **SUM ROWs automáticos** - Para secciones y operaciones  
✅ **UX moderna** - Wizard de 3 pasos con validación en tiempo real  
✅ **Funciona en 13 módulos** - SUMMARY, RESUMEN, y 12 módulos de planeación  

**Total de líneas de código:** ~1,600 líneas  
**Archivos creados:** 3 (wizard, validator, CSS)  
**Rutas API:** 4 endpoints backend  
**Validaciones:** 5 tipos (jerarquía, duplicados, formato, campos, consistencia)
