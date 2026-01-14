# Gestión de Conexiones Firebird

## Descripción

Página de administración para gestionar las conexiones a las bases de datos Firebird de todas las empresas. **Solo accesible para administradores globales**.

## Ubicación de Archivos

### Backend
- **Ruta API**: `src/routes/firebird-config.js`
- **Servicio**: `src/services/firebirdConfigService.js` (ya existente)

### Frontend
- **HTML**: `vistas/firebird-config.html`
- **JavaScript**: `vistas/js/firebird-config.js`
- **CSS**: `vistas/css/firebird-config.css`

## Características

### 1. Configuración Base del Servidor
- **Host/IP**: Dirección del servidor Firebird
- **Puerto**: Puerto de conexión (por defecto 3050)
- **Usuario**: Usuario de autenticación (por defecto sysdba)
- **Contraseña**: Contraseña del usuario

### 2. Gestión por Empresa
- Visualización de todas las empresas con sus rutas de base de datos
- Edición individual de rutas por empresa
- Restauración a valores por defecto
- Búsqueda de empresas

### 3. Prueba de Conexiones
- Botón para probar la conexión de cada empresa
- Indicadores visuales de estado:
  - 🔵 **No probado**: Sin verificar
  - 🟡 **Probando**: Conexión en proceso
  - 🟢 **Conectado**: Conexión exitosa
  - 🔴 **Error**: No se pudo conectar

## Acceso

### URL
```
http://localhost:3005/firebird-config.html
```

### Restricción
Solo usuarios con `esAdminGlobal = true` pueden acceder. Cualquier otro usuario será redirigido a la página principal.

## Endpoints API

### GET `/api/firebird-config`
Obtiene la configuración actual completa.

**Respuesta:**
```json
{
  "configBase": {
    "host": "127.0.0.1",
    "port": 3050,
    "user": "sysdba",
    "password": "masterkey"
  },
  "empresas": [
    {
      "id": "EMPRESA01",
      "nombre": "CDMX",
      "rutaBaseDatos": "C:\\datos\\empresa01.fdb",
      "tieneOverride": false
    }
  ]
}
```

### PUT `/api/firebird-config/base`
Actualiza la configuración base del servidor.

**Body:**
```json
{
  "host": "192.168.1.100",
  "port": 3050,
  "user": "sysdba",
  "password": "nuevapass"
}
```

### PUT `/api/firebird-config/empresa/:id`
Actualiza la ruta de base de datos para una empresa específica.

**Body:**
```json
{
  "rutaBaseDatos": "C:\\nueva\\ruta\\base.fdb"
}
```

### POST `/api/firebird-config/test/:id`
Prueba la conexión a la base de datos de una empresa.

**Respuesta:**
```json
{
  "empresaId": "EMPRESA01",
  "empresaNombre": "CDMX",
  "disponible": true,
  "mensaje": "Conexión exitosa"
}
```

### DELETE `/api/firebird-config/empresa/:id`
Elimina el override personalizado de una empresa (restaura a default).

## Almacenamiento

La configuración se guarda en:
```
datos/firebird-connections.json
```

### Estructura del archivo
```json
{
  "host": "127.0.0.1",
  "port": 3050,
  "user": "sysdba",
  "password": "masterkey",
  "empresas": {
    "EMPRESA01": "C:\\ruta\\personalizada\\empresa01.fdb",
    "EMPRESA02": "C:\\ruta\\personalizada\\empresa02.fdb"
  }
}
```

## Uso

1. **Acceder como administrador global**
2. **Editar configuración base** (si es necesario)
3. **Personalizar rutas por empresa** (opcional)
4. **Probar conexiones** para verificar

## Seguridad

- ✅ Solo administradores globales tienen acceso
- ✅ Middleware de autenticación en backend
- ✅ Verificación en frontend antes de cargar
- ✅ Contraseñas ocultas en la visualización
- ✅ Validación de datos en servidor

## Notas Técnicas

- Las rutas pueden ser absolutas o relativas al servidor Firebird
- Los cambios se aplican inmediatamente (no requiere reinicio)
- El sistema usa primero los overrides, luego la configuración base
- Si no existe override, usa la ruta definida en `src/config/empresas.js`

## Flujo de Prioridad de Configuración

1. **Override por empresa** (`firebird-connections.json`)
2. **Configuración base** (`firebird-connections.json`)
3. **Variables de entorno** (`process.env.FIREBIRD_*`)
4. **Valores por defecto** (en código)

## Ejemplo de Uso

### Cambiar todas las conexiones a un nuevo servidor

1. Ir a "Configuración Base del Servidor"
2. Click en "Editar"
3. Cambiar Host a la nueva IP: `192.168.1.50`
4. Guardar cambios
5. Probar conexiones de todas las empresas

### Mover solo una base de datos

1. Buscar la empresa en la tabla
2. Click en botón de editar (✏️)
3. Ingresar nueva ruta: `D:\\bases\\empresa.fdb`
4. Guardar
5. Probar conexión (🔌)

## Integración

La página está completamente integrada con:
- Sistema de autenticación existente
- Servicio de configuración Firebird
- Servicio de conexión a Firebird
- Sistema de sesiones

No requiere configuración adicional.
