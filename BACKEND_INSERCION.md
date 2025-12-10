# 🔌 BACKEND - Sistema de Inserción Inteligente

## 📋 Resumen

Se ha implementado el backend completo para el sistema de inserción con validación jerárquica y auto-creación de SUM ROWs.

---

## 📦 Archivos Creados

### 1. `src/routes/insercion.js` (750 líneas)

**Endpoints implementados:**

#### POST `/api/insercion/validar`
Valida una inserción antes de ejecutarla (validación previa).

**Request:**
```json
{
  "tipo": "cuenta",
  "context": {
    "capitulo": "CIUDAD DE MÉXICO",
    "principal": "Ingresos",
    "secundaria": "Membresía"
  },
  "formData": {
    "numero": "401000000000000000999",
    "nombre": "Nueva Cuenta"
  },
  "moduleType": "SUMMARY"
}
```

**Response (éxito):**
```json
{
  "exito": true,
  "valid": true,
  "errors": [],
  "warnings": [
    "Se creará automáticamente un SUM ROW con la etiqueta especificada"
  ]
}
```

**Response (error):**
```json
{
  "exito": true,
  "valid": false,
  "errors": [
    "La cuenta 401000000000000000001 ya existe",
    "El número de cuenta es obligatorio"
  ],
  "warnings": []
}
```

---

#### POST `/api/insercion/cuenta`
Inserta una nueva cuenta con validación completa.

**Request:**
```json
{
  "moduleType": "SUMMARY",
  "context": {
    "capitulo": "CIUDAD DE MÉXICO",
    "principal": "Ingresos",
    "secundaria": "Membresía"
  },
  "formData": {
    "numero": "401000000000000000999",
    "nombre": "Renovaciones Anuales",
    "tipo": "ingreso"
  }
}
```

**Response:**
```json
{
  "exito": true,
  "mensaje": "Cuenta agregada exitosamente",
  "cuenta": {
    "CAPITULO": "CIUDAD DE MÉXICO",
    "SECCIÓN Principal": "Ingresos",
    "SECCION Secundaria": "Membresía",
    "CUENTA": "401000000000000000999",
    "NOMBRE": "Renovaciones Anuales"
  }
}
```

---

#### POST `/api/insercion/seccion`
Inserta una nueva sección (principal, secundaria, o sección de módulo) con SUM ROW automático.

**Request (Sección Secundaria en SUMMARY):**
```json
{
  "moduleType": "SUMMARY",
  "tipo": "secundaria",
  "context": {
    "capitulo": "CIUDAD DE MÉXICO",
    "principal": "Ingresos"
  },
  "formData": {
    "nombre": "Marketing Digital",
    "etiquetaSum": "Total Marketing Digital"
  }
}
```

**Response:**
```json
{
  "exito": true,
  "mensaje": "Sección agregada exitosamente",
  "seccion": {
    "CAPITULO": "CIUDAD DE MÉXICO",
    "SECCIÓN Principal": "Ingresos",
    "SECCION Secundaria": "Marketing Digital",
    "CUENTA": "",
    "NOMBRE": "Marketing Digital",
    "ES_SECCION": true
  },
  "sumRow": {
    "CAPITULO": "CIUDAD DE MÉXICO",
    "SECCIÓN Principal": "Ingresos",
    "SECCION Secundaria": "Marketing Digital",
    "CUENTA": "SUM",
    "NOMBRE": "Total Marketing Digital",
    "ES_SUM_ROW": true
  }
}
```

---

#### POST `/api/insercion/operacion`
Inserta una nueva operación (solo RESUMEN y MÓDULOS) con SUM ROW automático.

**Request (Operación en RESUMEN):**
```json
{
  "moduleType": "RESUMEN",
  "context": {
    "capitulo": "GUADALAJARA",
    "principal": "Gastos Administrativos",
    "secundaria": "Tecnología"
  },
  "formData": {
    "nombre": "Software",
    "etiquetaSum": "Total Software"
  }
}
```

**Response:**
```json
{
  "exito": true,
  "mensaje": "Operación agregada exitosamente",
  "operacion": {
    "CAPITULO": "GUADALAJARA",
    "SECCIÓN Principal": "Gastos Administrativos",
    "SECCION Secundaria": "Tecnología",
    "OPERACIÓN": "Software",
    "CUENTA": "",
    "NOMBRE": "Software",
    "ES_OPERACION": true
  },
  "sumRow": {
    "CAPITULO": "GUADALAJARA",
    "SECCIÓN Principal": "Gastos Administrativos",
    "SECCION Secundaria": "Tecnología",
    "OPERACIÓN": "Software",
    "CUENTA": "SUM",
    "NOMBRE": "Total Software",
    "ES_SUM_ROW": true
  }
}
```

---

#### GET `/api/insercion/opciones/:nivel`
Obtiene opciones disponibles para un nivel jerárquico (para poblar dropdowns).

**Ejemplos:**

**1. Obtener capítulos de SUMMARY:**
```
GET /api/insercion/opciones/capitulo?moduleType=SUMMARY
```

**Response:**
```json
{
  "exito": true,
  "opciones": [
    "CIUDAD DE MÉXICO",
    "GUADALAJARA",
    "NOROESTE"
  ]
}
```

**2. Obtener principales de un capítulo:**
```
GET /api/insercion/opciones/principal?moduleType=SUMMARY&capitulo=CIUDAD%20DE%20M%C3%89XICO
```

**Response:**
```json
{
  "exito": true,
  "opciones": [
    "Ingresos",
    "Gastos Administrativos",
    "Gastos Operativos"
  ]
}
```

**3. Obtener secundarias de una principal:**
```
GET /api/insercion/opciones/secundaria?moduleType=SUMMARY&capitulo=CIUDAD%20DE%20M%C3%89XICO&principal=Ingresos
```

**Response:**
```json
{
  "exito": true,
  "opciones": [
    "Membresía",
    "Eventos",
    "Sponsorships"
  ]
}
```

**4. Obtener operaciones (RESUMEN):**
```
GET /api/insercion/opciones/operacion?moduleType=RESUMEN&capitulo=GUADALAJARA&principal=Gastos%20Administrativos&secundaria=Tecnolog%C3%ADa
```

**Response:**
```json
{
  "exito": true,
  "opciones": [
    "Software",
    "Hardware",
    "Servicios Cloud"
  ]
}
```

---

## 🔒 Validaciones Implementadas

### 1. Validación de Jerarquía (`validarJerarquia`)

```javascript
// SUMMARY
tipo: 'cuenta' → Requiere: capitulo, principal, secundaria
tipo: 'secundaria' → Requiere: capitulo, principal
tipo: 'principal' → Requiere: capitulo

// RESUMEN
tipo: 'cuenta' → Requiere: capitulo, principal, secundaria, operacion
tipo: 'operacion' → Requiere: capitulo, principal, secundaria
tipo: 'secundaria' → Requiere: capitulo, principal
tipo: 'principal' → Requiere: capitulo

// MÓDULOS
tipo: 'cuenta' → Requiere: capitulo, seccion
tipo: 'operacion' → Requiere: capitulo, seccion
tipo: 'seccion' → Requiere: capitulo
```

### 2. Verificación de Duplicados (`verificarDuplicado`)

```javascript
// Cuentas: Busca por número de cuenta exacto
verificarDuplicado('cuenta', { numero: '401000000000000000001' }, ...)
→ Si existe: { duplicado: true, mensaje: "La cuenta 401... ya existe" }

// Secciones: Busca por nombre en mismo contexto
verificarDuplicado('secundaria', { nombre: 'Membresía', principal: 'Ingresos' }, ...)
→ Si existe: { duplicado: true, mensaje: "Ya existe una secundaria con ese nombre" }

// Operaciones: Busca por nombre en misma secundaria
verificarDuplicado('operacion', { nombre: 'Software', secundaria: 'Tecnología' }, ...)
→ Si existe: { duplicado: true, mensaje: "Ya existe una Operación con ese nombre..." }
```

### 3. Validación de Formato (`validarFormato`)

```javascript
// SUMMARY: 21 dígitos consecutivos
validarFormato('401000000000000000001', 'SUMMARY')
→ { valido: true }

validarFormato('401-001-000-00', 'SUMMARY')
→ { valido: false, mensaje: "Formato incorrecto. Debe ser 21 dígitos..." }

// RESUMEN/MÓDULOS: XXX-XXX-XXX-XX
validarFormato('401-001-000-00', 'RESUMEN')
→ { valido: true }

validarFormato('12345', 'RESUMEN')
→ { valido: false, mensaje: "Formato incorrecto. Debe ser XXX-XXX-XXX-XX" }
```

---

## 💾 Persistencia en JSON

### Archivos modificados:

1. **`info IMPORTANTE/CUENTAS SUMMARY y RESUMEN.json`**
   - Contiene arrays `SUMMARY` y `RESUMEN`
   - Se agrega nueva cuenta/sección/operación al array correspondiente
   - Se crea SUM ROW automáticamente

2. **`info IMPORTANTE/CUENTAS.json`**
   - Contiene arrays por módulo: `Finanzas`, `Eventos`, `Comités`, etc.
   - Se agrega nueva cuenta/sección al array del módulo

### Estructura de Datos:

**Cuenta en SUMMARY:**
```json
{
  "CAPITULO": "CIUDAD DE MÉXICO",
  "SECCIÓN Principal": "Ingresos",
  "SECCION Secundaria": "Membresía",
  "CUENTA": "401000000000000000001",
  "NOMBRE": "Cuotas Membership"
}
```

**Sección con SUM ROW en SUMMARY:**
```json
[
  {
    "CAPITULO": "CIUDAD DE MÉXICO",
    "SECCIÓN Principal": "Ingresos",
    "SECCION Secundaria": "Marketing Digital",
    "CUENTA": "",
    "NOMBRE": "Marketing Digital",
    "ES_SECCION": true
  },
  {
    "CAPITULO": "CIUDAD DE MÉXICO",
    "SECCIÓN Principal": "Ingresos",
    "SECCION Secundaria": "Marketing Digital",
    "CUENTA": "SUM",
    "NOMBRE": "Total Marketing Digital",
    "ES_SUM_ROW": true
  }
]
```

**Cuenta en RESUMEN:**
```json
{
  "CAPITULO": "GUADALAJARA",
  "SECCIÓN Principal": "Gastos Administrativos",
  "SECCION Secundaria": "Tecnología",
  "OPERACIÓN": "Software",
  "CUENTA": "401-001-000-00",
  "NOMBRE": "Licencias Office 365"
}
```

**Operación con SUM ROW en RESUMEN:**
```json
[
  {
    "CAPITULO": "GUADALAJARA",
    "SECCIÓN Principal": "Gastos Administrativos",
    "SECCION Secundaria": "Tecnología",
    "OPERACIÓN": "Software",
    "CUENTA": "",
    "NOMBRE": "Software",
    "ES_OPERACION": true
  },
  {
    "CAPITULO": "GUADALAJARA",
    "SECCIÓN Principal": "Gastos Administrativos",
    "SECCION Secundaria": "Tecnología",
    "OPERACIÓN": "Software",
    "CUENTA": "SUM",
    "NOMBRE": "Total Software",
    "ES_SUM_ROW": true
  }
]
```

**Cuenta en MÓDULO:**
```json
{
  "CAPITULO": "CIUDAD DE MÉXICO",
  "SECCION": "Ingresos Membresía",
  "CUENTA": "401-001-000-00",
  "NOMBRE": "Cuotas Regulares"
}
```

**Cuenta con Operación opcional en MÓDULO:**
```json
{
  "CAPITULO": "CIUDAD DE MÉXICO",
  "SECCION": "Gastos Administrativos",
  "OPERACIÓN": "Tecnología",
  "CUENTA": "501-001-000-00",
  "NOMBRE": "Software"
}
```

---

## 🔐 Seguridad

Todos los endpoints requieren autenticación:

```javascript
router.post('/validar', requireAuth, async (req, res) => {
  // ...
});
```

El middleware `requireAuth` verifica que el usuario tenga sesión activa.

---

## 🧪 Ejemplos de Uso con cURL

### 1. Validar inserción de cuenta:

```bash
curl -X POST http://localhost:3005/api/insercion/validar \
  -H "Content-Type: application/json" \
  -H "Cookie: panelamcham.sid=..." \
  -d '{
    "tipo": "cuenta",
    "context": {
      "capitulo": "CIUDAD DE MÉXICO",
      "principal": "Ingresos",
      "secundaria": "Membresía"
    },
    "formData": {
      "numero": "401000000000000000999",
      "nombre": "Test Cuenta"
    },
    "moduleType": "SUMMARY"
  }'
```

### 2. Insertar cuenta:

```bash
curl -X POST http://localhost:3005/api/insercion/cuenta \
  -H "Content-Type: application/json" \
  -H "Cookie: panelamcham.sid=..." \
  -d '{
    "moduleType": "SUMMARY",
    "context": {
      "capitulo": "CIUDAD DE MÉXICO",
      "principal": "Ingresos",
      "secundaria": "Membresía"
    },
    "formData": {
      "numero": "401000000000000000999",
      "nombre": "Test Cuenta"
    }
  }'
```

### 3. Insertar sección con SUM ROW:

```bash
curl -X POST http://localhost:3005/api/insercion/seccion \
  -H "Content-Type: application/json" \
  -H "Cookie: panelamcham.sid=..." \
  -d '{
    "moduleType": "SUMMARY",
    "tipo": "secundaria",
    "context": {
      "capitulo": "CIUDAD DE MÉXICO",
      "principal": "Ingresos"
    },
    "formData": {
      "nombre": "Marketing Digital",
      "etiquetaSum": "Total Marketing Digital"
    }
  }'
```

### 4. Obtener opciones para dropdown:

```bash
curl -X GET "http://localhost:3005/api/insercion/opciones/principal?moduleType=SUMMARY&capitulo=CIUDAD%20DE%20M%C3%89XICO" \
  -H "Cookie: panelamcham.sid=..."
```

---

## 📊 Flujo Completo

```
1. Usuario abre wizard
   ↓
2. Frontend: InsertionWizard.open()
   ↓
3. Paso 1: Selecciona tipo (cuenta/sección/operación)
   ↓
4. Paso 2: Frontend llama GET /api/insercion/opciones/{nivel}
   → Backend retorna opciones disponibles
   → Frontend puebla dropdowns
   ↓
5. Usuario selecciona jerarquía (CDMX > Ingresos > Membresía)
   ↓
6. Paso 3: Usuario ingresa datos
   → Validación en tiempo real (frontend)
   ↓
7. Usuario hace click en "Crear Elemento"
   ↓
8. Frontend: Validación local (InsertionValidator.validarInsercion)
   ↓
9. Frontend: POST /api/insercion/cuenta (o /seccion, /operacion)
   ↓
10. Backend: Validar jerarquía
    ↓
11. Backend: Verificar duplicados
    ↓
12. Backend: Validar formato
    ↓
13. Backend: Crear objeto en JSON
    ↓
14. Backend: Auto-crear SUM ROW (si aplica)
    ↓
15. Backend: Guardar JSON
    ↓
16. Backend: Retornar éxito
    ↓
17. Frontend: Cerrar modal
    ↓
18. Frontend: Recargar datos de tabla
```

---

## ✅ Estado de Implementación

### Completado ✅
- [x] Endpoint `/api/insercion/validar`
- [x] Endpoint `/api/insercion/cuenta`
- [x] Endpoint `/api/insercion/seccion`
- [x] Endpoint `/api/insercion/operacion`
- [x] Endpoint `/api/insercion/opciones/:nivel`
- [x] Validación de jerarquía
- [x] Verificación de duplicados
- [x] Validación de formato
- [x] Auto-creación de SUM ROWs
- [x] Persistencia en JSON
- [x] Seguridad con `requireAuth`
- [x] Integración en `server.js`
- [x] Frontend conectado con backend

### Pendiente ⏳
- [ ] Actualización cascada de totales (recalcular SUM ROWs)
- [ ] RESULT ROW auto-update
- [ ] Reordenamiento de filas
- [ ] Eliminar elementos
- [ ] Editar elementos existentes
- [ ] Logs de auditoría

---

## 🚀 Despliegue

El backend está listo. Para activarlo:

```bash
# Rebuild
npm run dist

# Iniciar servidor
npm run server
```

El servidor expondrá:
- `POST /api/insercion/validar`
- `POST /api/insercion/cuenta`
- `POST /api/insercion/seccion`
- `POST /api/insercion/operacion`
- `GET /api/insercion/opciones/:nivel`

---

**Backend completado y listo para producción! 🎉**
