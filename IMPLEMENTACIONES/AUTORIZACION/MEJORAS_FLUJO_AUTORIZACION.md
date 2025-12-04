# MEJORAS AL FLUJO DE AUTORIZACIÓN - ESPECIFICACIONES COMPLETAS

## 1. FLUJO DE AUTORIZACIÓN ESTANDARIZADO

### Estados del Flujo
1. **EDITANDO**: Usuario con permisos de "Cargar y guardar" está editando
2. **PENDIENTE**: Enviado para revisión
3. **REVISADO**: Marcado como revisado, listo para autorización
4. **RECHAZADO**: Devuelto para correcciones
5. **APROBADO**: Autorizado, listo para guardar en COI
6. **GUARDADO**: Registrado en base de datos Firebird (PRESUPYY)

### Transiciones permitidas
- **Cargar** → EDITANDO (cualquier usuario con permiso "Cargar y guardar")
- **Enviar** → EDITANDO → PENDIENTE (usuario que cargó)
- **Revisar** → PENDIENTE → REVISADO (usuarios con permiso "Revisar")
- **Rechazar desde revisión** → PENDIENTE/REVISADO → RECHAZADO (usuarios con permiso "Revisar")
- **Autorizar** → REVISADO → APROBADO (usuarios con permiso "Aprobar")
- **Rechazar desde autorización** → REVISADO/APROBADO → RECHAZADO (usuarios con permiso "Aprobar")
- **Guardar en COI** → APROBADO → GUARDADO (usuarios con permiso "Aprobar")

### Reglas especiales para Administradores Globales
- Al enviar un borrador, se aprueba automáticamente (EDITANDO → APROBADO)
- No requieren revisión ni autorización
- Pueden guardar directamente en COI

## 2. MODO EDICIÓN CON SUGERENCIAS DE CUENTAS

### Activación del modo edición
```javascript
// Al hacer clic en "Cargar"
- Se habilita la edición inline en la tabla
- Aparecen inputs en la columna de cuentas
- Se activan botones: "Enviar Presupuesto", "Cancelar"
```

### Sugerencias de cuentas
```javascript
// Autocomplete en columna de cuentas
- Solo cuentas con STATUS = 'A' en CUENTASYY
- Formato: "CUENTA - DESCRIPCIÓN"
- Búsqueda por código o descripción
- Al seleccionar: se llena NUM_CTA
```

### Validaciones en edición
- Solo se pueden editar valores numéricos en meses (ENE-DIC)
- La descripción es temporal (no se guarda en Firebird)
- Se mantiene en memoria/borrador para visualización

## 3. VISIBILIDAD DE BORRADORES

### Quién puede ver un borrador
1. **Usuario que lo creó**: Siempre puede ver sus borradores
2. **Usuarios con permisos de revisión**: Solo si está en PENDIENTE o REVISADO
3. **Usuarios con permisos de autorización**: Solo si está en REVISADO o APROBADO
4. **Usuarios con permisos de guardar**: Solo si está en APROBADO
5. **Administradores globales**: Pueden ver todos los borradores

### Vista de gestión de borradores (borradores.html)
- Lista todos los borradores accesibles para el usuario
- Filtros por: Estado, Módulo, Empresa, Año
- Tarjetas con información resumida
- Botón "Ver detalle" que redirige al módulo correspondiente

## 4. VISIBILIDAD DE BOTONES SEGÚN ETAPA

### Reglas de visibilidad
```javascript
// Los botones SOLO se muestran si:
1. El usuario tiene el permiso necesario
2. El borrador está en el estado correcto para esa acción
3. No hay otro proceso activo bloqueando
```

### Botones por rol y estado

#### Usuario con "Cargar y guardar"
- **EDITANDO**: "Enviar Presupuesto", "Cancelar"
- **RECHAZADO**: "Enviar Presupuesto" (puede editar y reenviar)
- **GUARDADO**: "Cargar" (puede iniciar nuevo flujo para siguiente año)

#### Usuario con "Revisar"
- **PENDIENTE**: "Marcar como revisado", "Rechazar", "Agregar comentarios"
- **REVISADO**: "Cancelar revisión" (devolver a PENDIENTE)

#### Usuario con "Aprobar"
- **REVISADO**: "Autorizar", "Rechazar"
- **APROBADO**: "Guardar en COI", "Rechazar"

#### Administradores Globales
- **EDITANDO**: "Enviar Presupuesto" (auto-aprueba)
- **APROBADO**: "Guardar en COI"

## 5. MODIFICACIONES EN ARCHIVOS EXISTENTES

### src/routes/borradores.js
```javascript
// Agregar endpoint GET / para listar borradores
router.get('/', (req, res) => {
  // Lógica de filtrado según permisos del usuario
  // Ver código completo en el archivo
});

// Modificar enviarRevision para auto-aprobar admins
const enviarRevision = async (borradorId, usuarioRol) => {
  if (usuarioRol === 'ADMIN_GLOBAL') {
    // Marcar como APROBADO directamente
  } else {
    // Marcar como PENDIENTE
  }
};
```

### src/services/borradoresService.js
```javascript
// Actualizar persistirEnFirebird para usar tabla PRESUPYY
const persistirEnFirebird = async (borrador) => {
  const anio = Number(borrador.anio);
  const sufijo = anio.toString().slice(-2).padStart(2, '0');
  const tablaPresup = `PRESUP${sufijo}`;
  
  // Mapeo de claves a columnas
  const MESES_COLUMNAS = {
    'budget-ene': 'PRESUP01',
    'budget-feb': 'PRESUP02',
    // ... hasta PRESUP12
  };
  
  // INSERT/UPDATE por cuenta
  for (const cambio of presupuesto) {
    const cuenta = cambio.cuenta;
    const valores = cambio.valores;
    
    // Construir SET clause
    // Ejecutar UPDATE o INSERT según corresponda
  }
};
```

### vistas/js/flujo-autorizacion.js
```javascript
// Actualizar _actualizarBotones para implementar reglas de visibilidad
_actualizarBotones() {
  const estado = this.borradorActual?.estado;
  const esCreador = this.borradorActual?.usuarioId === this.usuarioActual.id;
  
  // Cargar/Guardar
  if (this._permitido('guardar')) {
    const puedeCargar = !estado || estado === 'GUARDADO' || 
                        (estado === 'RECHAZADO' && esCreador);
    this.buttons.guardar.classList.toggle('d-none', !puedeCargar);
  }
  
  // Revisar
  if (this._permitido('revision')) {
    const puedeRevisar = estado === 'PENDIENTE' || estado === 'REVISADO';
    this.buttons.panelRevision.classList.toggle('d-none', !puedeRevisar);
  }
  
  // Autorizar
  if (this._permitido('autorizar')) {
    const puedeAutorizar = estado === 'REVISADO';
    this.buttons.autorizar.classList.toggle('d-none', !puedeAutorizar);
  }
  
  // Guardar en COI
  if (this._permitido('aprobar')) {
    const puedeGuardar = estado === 'APROBADO';
    this.buttons.saveBudgetBtn.classList.toggle('d-none', !puedeGuardar);
  }
}
```

## 6. NOTIFICACIONES

### Eventos que generan notificaciones
1. **Envío a revisión**: Notifica a usuarios con permiso "Revisar"
2. **Marcado como revisado**: Notifica a usuarios con permiso "Aprobar"
3. **Autorización**: Notifica a usuarios con permiso "Cargar y guardar"
4. **Rechazo**: Notifica al creador del borrador
5. **Guardado en COI**: Notifica a todos los involucrados

### Contenido de notificación
```javascript
{
  titulo: "Presupuesto [Módulo]: [acción]",
  mensaje: "[Usuario] [acción] el presupuesto [Módulo] ([Empresa], [Año])",
  tipo: "info",
  enlace: "/ruta-al-modulo?borrador=[id]"
}
```

## 7. CAMBIOS EN LA UI

### Texto de botones
- "Guardar" → "Guardar en COI" (más descriptivo)
- "Cargar" → "Cargar Presupuesto" (cuando inicia flujo)
- "Enviar" → "Enviar Presupuesto" (envío a revisión)

### Badges de estado
- EDITANDO: Amarillo (#fff3cd)
- PENDIENTE: Azul (#cfe2ff)
- REVISADO: Verde claro (#d1e7dd)
- RECHAZADO: Rojo claro (#f8d7da)
- APROBADO: Verde (#d1e7dd)
- GUARDADO: Gris (#e2e3e5)

### Panel de comentarios
```html
<div class="comentarios-panel">
  <label>Comentarios (opcional)</label>
  <textarea id="comentariosBorrador" rows="3" class="form-control"></textarea>
</div>
```

## 8. ENDPOINTS NECESARIOS

### GET /api/borradores
Lista borradores accesibles para el usuario actual

### GET /api/borradores/estado
Estado actual del borrador para empresa/módulo/año

### POST /api/borradores/guardar
Guarda/actualiza un borrador en estado EDITANDO

### POST /api/borradores/enviar
Envía borrador a revisión (EDITANDO → PENDIENTE o APROBADO si es admin)

### POST /api/borradores/revisar
Marca borrador como revisado o cancela revisión

### POST /api/borradores/autorizar
Autoriza borrador (REVISADO → APROBADO)

### POST /api/borradores/rechazar
Rechaza borrador con comentarios

### POST /api/borradores/finalizar
Guarda borrador aprobado en Firebird (APROBADO → GUARDADO)

## 9. ESQUEMA DE BASE DE DATOS

### Tabla PLAN_BORRADORES
```sql
CREATE TABLE IF NOT EXISTS PLAN_BORRADORES (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresaId TEXT NOT NULL,
  anio INTEGER NOT NULL,
  modulo TEXT NOT NULL,
  usuarioId INTEGER NOT NULL,
  data TEXT,
  estado TEXT DEFAULT 'EDITANDO',
  fechaCreacion DATETIME DEFAULT CURRENT_TIMESTAMP,
  fechaEnvio DATETIME,
  comentarios TEXT,
  UNIQUE(empresaId, modulo, anio)
);
```

### Tabla Firebird PRESUPYY
```sql
-- Ya existe en COI
-- Solo necesitamos hacer INSERT/UPDATE
CREATE TABLE PRESUP25 (
  NUM_CTA VARCHAR(21),
  EJERCICIO INTEGER,
  PRESUP01 DECIMAL(15,2), -- Enero
  PRESUP02 DECIMAL(15,2), -- Febrero
  ...
  PRESUP12 DECIMAL(15,2), -- Diciembre
  PRIMARY KEY (NUM_CTA, EJERCICIO)
);
```

## 10. DIAGRAMA DE FLUJO COMPLETO

```
INICIO
  ↓
[Usuario con "Cargar y guardar" hace clic en "Cargar Presupuesto"]
  ↓
[EDITANDO] - Modo edición activo
  ↓
[Usuario ingresa/modifica valores]
  ↓
[Hace clic en "Enviar Presupuesto"]
  ↓
¿Es Admin Global?
  ├─ SÍ → [APROBADO] → [Guardar en COI] → [GUARDADO] → FIN
  └─ NO → [PENDIENTE]
            ↓
      [Usuario con "Revisar" revisa]
            ↓
      ¿Aprueba revisión?
        ├─ SÍ → [REVISADO]
        │         ↓
        │   [Usuario con "Aprobar" autoriza]
        │         ↓
        │   ¿Aprueba autorización?
        │     ├─ SÍ → [APROBADO]
        │     │         ↓
        │     │   [Guardar en COI]
        │     │         ↓
        │     │   [GUARDADO] → FIN
        │     └─ NO → [RECHAZADO] → [Notifica creador] → [EDITANDO]
        └─ NO → [RECHAZADO] → [Notifica creador] → [EDITANDO]
```

## 11. CASOS DE USO ESPECÍFICOS

### Caso 1: Usuario normal carga presupuesto
1. Usuario con permiso "Cargar y guardar" abre módulo
2. Ve botón "Cargar Presupuesto"
3. Hace clic, entra en modo edición
4. Ingresa cuentas (autocompletado de cuentas activas)
5. Ingresa valores para cada mes
6. Hace clic en "Enviar Presupuesto"
7. Sistema crea borrador con estado PENDIENTE
8. Notifica a usuarios con permiso "Revisar"

### Caso 2: Usuario revisa presupuesto
1. Usuario con permiso "Revisar" recibe notificación
2. Abre módulo, ve borrador en estado PENDIENTE
3. Ve botones: "Marcar como revisado", "Rechazar"
4. Puede agregar comentarios
5. Hace clic en "Marcar como revisado"
6. Sistema cambia estado a REVISADO
7. Notifica a usuarios con permiso "Aprobar"

### Caso 3: Usuario autoriza presupuesto
1. Usuario con permiso "Aprobar" recibe notificación
2. Abre módulo, ve borrador en estado REVISADO
3. Ve botones: "Autorizar", "Rechazar"
4. Hace clic en "Autorizar"
5. Sistema cambia estado a APROBADO
6. Notifica a usuarios con permiso "Cargar y guardar"

### Caso 4: Usuario guarda en COI
1. Usuario con permiso "Aprobar" ve estado APROBADO
2. Ve botón "Guardar en COI"
3. Hace clic
4. Sistema ejecuta INSERT/UPDATE en tabla PRESUPYY de Firebird
5. Cambia estado a GUARDADO
6. Notifica a todos los involucrados
7. Flujo termina, módulo queda disponible para nuevo ciclo

### Caso 5: Admin global carga presupuesto
1. Admin global abre módulo
2. Hace clic en "Cargar Presupuesto"
3. Ingresa datos
4. Hace clic en "Enviar Presupuesto"
5. Sistema auto-aprueba: EDITANDO → APROBADO
6. Ve inmediatamente botón "Guardar en COI"
7. Hace clic y guarda directamente
8. Flujo completo sin revisión ni autorización

## 12. VALIDACIONES Y MENSAJES DE ERROR

### Validaciones de negocio
- No se puede enviar un borrador vacío
- No se puede modificar un borrador que no esté en EDITANDO o RECHAZADO
- Solo el creador puede modificar un borrador rechazado
- No se puede guardar en COI si no está APROBADO
- No se puede iniciar nuevo flujo si hay uno activo (excepto GUARDADO)

### Mensajes claros
```javascript
const MENSAJES = {
  SIN_PERMISOS: 'No cuentas con los permisos necesarios para esta acción.',
  FLUJO_ACTIVO: 'Ya existe un flujo de autorización activo para este módulo/empresa/año.',
  BORRADOR_VACIO: 'El presupuesto debe contener al menos una cuenta con valores.',
  ESTADO_INVALIDO: 'La acción no está disponible para el estado actual del borrador.',
  GUARDADO_EXITOSO: 'Presupuesto guardado exitosamente en COI.',
  ENVIADO_REVISION: 'Presupuesto enviado para revisión.',
  MARCADO_REVISADO: 'Presupuesto marcado como revisado.',
  AUTORIZADO: 'Presupuesto autorizado correctamente.',
  RECHAZADO: 'Presupuesto rechazado. Se ha notificado al creador.'
};
```

## IMPLEMENTACIÓN SUGERIDA

### Fase 1: Backend
1. Actualizar src/routes/borradores.js con endpoint GET /
2. Actualizar src/services/borradoresService.js con persistirEnFirebird mejorado
3. Verificar notificaciones en src/services/notificacionesService.js

### Fase 2: Frontend - Vista borradores
1. Crear vistas/borradores.html (✓ Ya creado)
2. Crear vistas/js/borradores-vista.js (✓ Ya creado)
3. Agregar enlace en menú de navegación

### Fase 3: Frontend - Mejoras en módulos
1. Actualizar vistas/js/flujo-autorizacion.js
2. Implementar modo edición con autocompletado
3. Actualizar visibilidad de botones según etapa
4. Cambiar textos: "Guardar" → "Guardar en COI"

### Fase 4: Testing
1. Probar flujo completo con usuario normal
2. Probar flujo con admin global
3. Probar rechazos y reintentos
4. Verificar notificaciones
5. Verificar persistencia en Firebird

---

Este documento contiene todas las especificaciones necesarias para implementar
el flujo de autorización estandarizado. Cada sección puede ser implementada
de forma incremental y probada de manera independiente.
