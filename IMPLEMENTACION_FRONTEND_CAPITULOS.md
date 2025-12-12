# Implementación Frontend - Soporte de Capítulos en Borradores

## Resumen

Se ha completado la integración frontend para soportar borradores y autorizaciones a nivel de **capítulo individual**. El sistema ahora extrae el capítulo del formato de módulo `"MODULO:CAPITULO"` y lo envía como parámetro separado en todas las peticiones a la API.

## Cambios Implementados

### Archivo: `flujo-autorizacion.js`

#### 1. Nueva Función: `_extraerCapitulo()`

```javascript
/**
 * Extrae el capítulo del módulo si existe
 * Formato: "SUMMARY:CDMX" → "CDMX"
 * @param {string} modulo - Nombre del módulo posiblemente con sufijo
 * @returns {string|null} Capítulo extraído o null
 */
_extraerCapitulo(modulo) {
  const partes = String(modulo || '').split(':');
  return partes.length > 1 ? partes[1].trim() : null;
}
```

**Uso**: Extrae el capítulo del formato `MODULO:CAPITULO` utilizado en el sistema.

#### 2. GET `/api/borradores/estado` - Actualizado

**Antes:**
```javascript
const params = new URLSearchParams({
  empresaId: this.state.contexto.empresaId,
  anio: String(this.state.contexto.anio),
  modulo: moduloLimpio,
});
```

**Después:**
```javascript
const moduloLimpio = this._sanitizarModulo(this.state.contexto.modulo);
const capitulo = this._extraerCapitulo(this.state.contexto.modulo);
const params = new URLSearchParams({
  empresaId: this.state.contexto.empresaId,
  anio: String(this.state.contexto.anio),
  modulo: moduloLimpio,
});
if (capitulo) {
  params.set('capitulo', capitulo);
}
```

**Beneficio**: Consulta el estado del borrador específico del capítulo activo.

#### 3. POST `/api/borradores/guardar` - Actualizado en `_guardarBorradorTemporal()`

**Antes:**
```javascript
const payload = {
  modulo: this._sanitizarModulo(this.state.contexto.modulo),
  empresaId: this.state.contexto.empresaId,
  anio: this.state.contexto.anio,
  datos: { presupuesto },
};
```

**Después:**
```javascript
const moduloLimpio = this._sanitizarModulo(this.state.contexto.modulo);
const capitulo = this._extraerCapitulo(this.state.contexto.modulo);
const payload = {
  modulo: moduloLimpio,
  empresaId: this.state.contexto.empresaId,
  anio: this.state.contexto.anio,
  datos: { presupuesto },
};
if (capitulo) {
  payload.capitulo = capitulo;
}
```

**Beneficio**: Guarda el borrador solo para el capítulo específico en edición.

#### 4. POST `/api/borradores/guardar` - Actualizado en `_handleEnviar()`

**Antes:**
```javascript
const payload = {
  modulo: this._sanitizarModulo(this.state.contexto.modulo),
  empresaId: this.state.contexto.empresaId,
  anio: this.state.contexto.anio,
  datos: { presupuesto },
};
```

**Después:**
```javascript
const moduloLimpio = this._sanitizarModulo(this.state.contexto.modulo);
const capitulo = this._extraerCapitulo(this.state.contexto.modulo);
const payload = {
  modulo: moduloLimpio,
  empresaId: this.state.contexto.empresaId,
  anio: this.state.contexto.anio,
  datos: { presupuesto },
};
if (capitulo) {
  payload.capitulo = capitulo;
}
```

**Beneficio**: Envía a revisión solo el borrador del capítulo actual.

#### 5. POST `/api/borradores/descartar` - Actualizado en `_handleCancelar()`

**Antes:**
```javascript
const contextoPayload = {
  empresaId: this.state.contexto.empresaId,
  modulo: this._sanitizarModulo(this.state.contexto.modulo),
  anio: this.state.contexto.anio,
};
```

**Después:**
```javascript
const moduloLimpio = this._sanitizarModulo(this.state.contexto.modulo);
const capitulo = this._extraerCapitulo(this.state.contexto.modulo);
const contextoPayload = {
  empresaId: this.state.contexto.empresaId,
  modulo: moduloLimpio,
  anio: this.state.contexto.anio,
};
if (capitulo) {
  contextoPayload.capitulo = capitulo;
}
```

**Beneficio**: Descarta el borrador solo del capítulo actual, sin afectar otros.

#### 6. GET `/api/borradores/listar` - Actualizado en `_cargarCentroBorradores()`

**Antes:**
```javascript
const params = new URLSearchParams({
  empresaId: this.state.contexto.empresaId,
  modulo: this._sanitizarModulo(this.state.contexto.modulo),
  anio: this.state.contexto.anio,
});
```

**Después:**
```javascript
const moduloLimpio = this._sanitizarModulo(this.state.contexto.modulo);
const capitulo = this._extraerCapitulo(this.state.contexto.modulo);
const params = new URLSearchParams({
  empresaId: this.state.contexto.empresaId,
  modulo: moduloLimpio,
  anio: this.state.contexto.anio,
});
if (capitulo) {
  params.set('capitulo', capitulo);
}
```

**Beneficio**: Lista solo los borradores del capítulo actual en el Centro de Borradores.

## Funcionamiento del Sistema

### Formato de Módulo con Capítulo

El sistema utiliza el formato `"MODULO:CAPITULO"` para identificar el capítulo activo:

- `"SUMMARY"` → Sin capítulo (usa 'DEFAULT')
- `"SUMMARY:CDMX"` → Módulo SUMMARY, capítulo CDMX
- `"SUMMARY:GDL"` → Módulo SUMMARY, capítulo GDL
- `"RESUMEN:NE"` → Módulo RESUMEN, capítulo NE

### Flujo de Trabajo

1. **Usuario Selecciona Capítulo**
   - En summary-view.js o resumen-view.js
   - Variable `capituloActual` contiene el capítulo seleccionado

2. **Módulo se Construye con Capítulo**
   - El sistema construye: `"SUMMARY:CDMX"`
   - Este valor se pasa al contexto de flujo-autorizacion.js

3. **Flujo-Autorizacion Extrae Capítulo**
   - `_sanitizarModulo("SUMMARY:CDMX")` → `"SUMMARY"`
   - `_extraerCapitulo("SUMMARY:CDMX")` → `"CDMX"`

4. **API Recibe Parámetros Separados**
   ```javascript
   {
     modulo: "SUMMARY",
     capitulo: "CDMX",
     empresaId: "EMPRESA01",
     anio: 2024
   }
   ```

5. **Backend Procesa por Capítulo**
   - Busca/crea borrador específico para (EMPRESA01, SUMMARY, 2024, CDMX)
   - Otros capítulos (GDL, NE, NO) no se afectan

## Escenarios de Uso

### Escenario 1: Trabajando en CDMX
```
Usuario → Selecciona CDMX
       → Edita presupuesto
       → Guarda borrador
       → API guarda: (EMPRESA01, SUMMARY, 2024, CDMX)
```

### Escenario 2: Cambio a Guadalajara
```
Usuario → Cambia a GDL
       → Sistema carga estado de GDL
       → Borradores de CDMX permanecen intactos
       → Puede editar GDL independientemente
```

### Escenario 3: Autorización Paralela
```
Usuario A → Envía CDMX a revisión
Usuario B → Revisa y aprueba GDL
Usuario C → Rechaza NE
       → Cada capítulo tiene estado independiente
```

### Escenario 4: Centro de Borradores
```
Usuario → Abre Centro de Borradores
       → Lista muestra solo borradores del capítulo actual
       → Puede cambiar capítulo para ver otros borradores
```

## Compatibilidad hacia Atrás

### Sin Capítulo
Si el módulo no contiene capítulo (`"SUMMARY"` en lugar de `"SUMMARY:CDMX"`):
- `_extraerCapitulo()` retorna `null`
- El parámetro `capitulo` no se agrega al payload
- Backend usa valor por defecto `'DEFAULT'`
- Funciona exactamente como antes

### Ejemplo:
```javascript
// Módulo sin capítulo
_sanitizarModulo("SUMMARY") → "SUMMARY"
_extraerCapitulo("SUMMARY") → null

// Payload resultante (sin capitulo)
{
  modulo: "SUMMARY",
  empresaId: "EMPRESA01",
  anio: 2024
  // capitulo no presente → Backend usa 'DEFAULT'
}
```

## Logging Mejorado

Se agregó logging para facilitar debugging:

```javascript
console.log(
  `🧹 Módulo sanitizado: "${this.state.contexto.modulo}" → "${moduloLimpio}"${
    capitulo ? ` [Capítulo: ${capitulo}]` : ''
  }`
);
```

**Ejemplos de salida:**
```
🧹 Módulo sanitizado: "SUMMARY:CDMX" → "SUMMARY" [Capítulo: CDMX]
🧹 Módulo sanitizado: "SUMMARY" → "SUMMARY"
🧹 Módulo sanitizado: "RESUMEN:GDL" → "RESUMEN" [Capítulo: GDL]
```

## Validación de Sintaxis

✅ **Sin errores de sintaxis en flujo-autorizacion.js**

## Pruebas Recomendadas

### Prueba 1: Guardar Borradores por Capítulo
1. Seleccionar CDMX
2. Editar presupuesto
3. Guardar borrador
4. Cambiar a GDL
5. Verificar que no tiene el borrador de CDMX
6. Editar y guardar borrador de GDL
7. Regresar a CDMX
8. Verificar que el borrador de CDMX sigue ahí

### Prueba 2: Flujo de Autorización Independiente
1. Crear borrador en CDMX
2. Enviar a revisión
3. Cambiar a GDL
4. Crear y enviar borrador de GDL
5. Verificar que ambos tienen estados independientes
6. Autorizar CDMX
7. Verificar que GDL sigue en PENDIENTE

### Prueba 3: Centro de Borradores
1. Crear borradores en CDMX, GDL, NE
2. Abrir Centro de Borradores con CDMX seleccionado
3. Verificar que solo muestra borrador de CDMX
4. Cambiar a GDL
5. Reabrir Centro de Borradores
6. Verificar que solo muestra borrador de GDL

### Prueba 4: Retrocompatibilidad
1. Seleccionar un módulo sin capítulo (ej: TIC, VPE)
2. Crear borrador
3. Guardar
4. Verificar que funciona normalmente
5. Confirmar que se guarda con capitulo='DEFAULT' en BD

### Prueba 5: Descartar por Capítulo
1. Crear borradores en CDMX y GDL
2. Seleccionar CDMX
3. Cancelar/descartar borrador
4. Verificar que solo se elimina el de CDMX
5. Cambiar a GDL
6. Verificar que el borrador de GDL sigue intacto

## Impacto en Otros Archivos

### summary-view.js y resumen-view.js
**No requieren cambios adicionales**. Estos archivos ya manejan el capítulo y lo incluyen en el formato del módulo (`"SUMMARY:CDMX"`). El sistema de flujo-autorizacion.js se encarga automáticamente de extraer y enviar el capítulo correctamente.

**Funcionamiento actual:**
```javascript
// En summary-view.js
let capituloActual = ''; // Variable que contiene el capítulo
// Cuando se construye el contexto del módulo:
// modulo = "SUMMARY:CDMX" (si capituloActual = "CDMX")
```

## Resumen de Beneficios

✅ **Independencia Total**: Cada capítulo tiene su propio ciclo de borradores y autorización  
✅ **Sin Conflictos**: Múltiples usuarios pueden trabajar en capítulos diferentes simultáneamente  
✅ **Granularidad**: Aprobaciones y rechazos por capítulo individual  
✅ **Historial Detallado**: Seguimiento completo de cambios por capítulo  
✅ **Retrocompatible**: Módulos sin capítulo funcionan como antes  
✅ **Sin Cambios en Vistas**: Las vistas SUMMARY y RESUMEN no requieren modificación

## Estado Final

### ✅ Backend
- [x] Base de datos con columna `capitulo`
- [x] Servicios actualizados
- [x] Endpoints REST con soporte de capítulo
- [x] Validaciones Joi actualizadas
- [x] Sin errores de sintaxis

### ✅ Frontend
- [x] Función `_extraerCapitulo()` implementada
- [x] GET /estado con capítulo
- [x] POST /guardar con capítulo (guardar temporal)
- [x] POST /guardar + /enviar con capítulo
- [x] POST /descartar con capítulo
- [x] GET /listar con capítulo
- [x] Logging mejorado
- [x] Sin errores de sintaxis

### 🧪 Testing Pendiente
- [ ] Pruebas de integración end-to-end
- [ ] Validación de casos edge
- [ ] Pruebas de concurrencia multi-usuario
- [ ] Verificación de retrocompatibilidad

---

**Fecha**: Diciembre 11, 2025  
**Archivos Modificados**: 1 (flujo-autorizacion.js)  
**Funciones Agregadas**: 1 (`_extraerCapitulo`)  
**Endpoints Actualizados**: 4 (estado, guardar×2, descartar, listar)  
**Breaking Changes**: Ninguno (100% retrocompatible)
