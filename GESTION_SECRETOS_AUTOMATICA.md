# Gestión Automática de Secretos de Seguridad

## Problema Resuelto

**Error:** "Secrets no configurados o inseguros: PANELAMCHAM_JWT_SECRET, SESSION_SECRET"

Este error ocurría en instalaciones empaquetadas porque los archivos `.env` no se incluyen en la distribución por seguridad, y la aplicación requería secretos JWT y de sesión configurados manualmente.

## Solución Implementada

### Generación Automática de Secretos

La aplicación ahora genera automáticamente secretos seguros en el primer inicio si no existen. Los secretos se almacenan de forma persistente en el directorio de datos del usuario.

### Ubicación de los Secretos

Los secretos se guardan en:
```
Windows: C:\Users\<Usuario>\AppData\Roaming\panel-amcham\.env.secrets
macOS: ~/Library/Application Support/panel-amcham/.env.secrets
Linux: ~/.config/panel-amcham/.env.secrets
```

### Secretos Generados

1. **PANELAMCHAM_JWT_SECRET** - Para tokens de autenticación JWT
2. **SESSION_SECRET** - Para sesiones de Express
3. **PANELAMCHAM_REFRESH_SECRET** - Para tokens de renovación

Cada secreto es un string aleatorio de 64 caracteres hexadecimales (256 bits de entropía).

## Comportamiento

### Primera Instalación
1. Usuario instala la aplicación
2. Al iniciar por primera vez, la app detecta que no hay secretos
3. Genera automáticamente secretos criptográficamente seguros
4. Los guarda en `.env.secrets` en el directorio de datos del usuario
5. La aplicación inicia normalmente

### Instalaciones Subsiguientes
1. La aplicación busca el archivo `.env.secrets` existente
2. Carga los secretos previamente generados
3. Continúa usando los mismos secretos (sesiones persistentes)

### Actualización desde Versión Anterior
Si un usuario actualiza desde v1.1.19 o anterior:
1. La aplicación genera los secretos en el primer inicio post-actualización
2. **Las sesiones anteriores se invalidan** (usuarios deben volver a iniciar sesión)
3. Las actualizaciones futuras mantendrán las mismas sesiones

## Seguridad

### Ventajas
- ✅ Secretos únicos por instalación
- ✅ No se incluyen en el código fuente
- ✅ No se comparten entre instalaciones
- ✅ Criptográficamente seguros (crypto.randomBytes)
- ✅ Persistentes entre reinicios

### Permisos del Archivo
- **Windows:** El archivo se crea en el perfil del usuario (protegido por NTFS)
- **Unix/Linux:** Permisos `0600` (solo lectura/escritura para el propietario)

## Para Desarrolladores

### Desarrollo Local

En modo desarrollo, puedes:

1. **Usar variables de entorno** (recomendado):
   ```bash
   # .env.development
   PANELAMCHAM_JWT_SECRET=tu-secreto-desarrollo
   SESSION_SECRET=tu-session-secret-desarrollo
   ```

2. **Dejar que se generen automáticamente**:
   - La app generará secretos en `~/.config/panel-amcham/.env.secrets`
   - Útil para pruebas locales sin configuración

### Servidor en Producción (no Electron)

Si despliegas el servidor Node.js sin Electron:

```bash
# Variables de entorno requeridas
export PANELAMCHAM_JWT_SECRET="tu-secreto-seguro-aqui"
export SESSION_SECRET="tu-session-secret-aqui"
export PANELAMCHAM_REFRESH_SECRET="tu-refresh-secret-aqui"
```

El servidor seguirá requiriendo estas variables explícitamente.

### Generación Manual de Secretos

Si necesitas generar secretos manualmente:

```javascript
const crypto = require('crypto');

// Generar un secreto de 32 bytes (256 bits)
const secret = crypto.randomBytes(32).toString('hex');
console.log(secret);
```

O desde la terminal:

```bash
# Windows PowerShell
[System.Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))

# Linux/macOS
openssl rand -hex 32
```

## Migración y Compatibilidad

### Desde v1.1.19 o Anterior

**⚠️ Importante:** Al actualizar a v1.1.20+, todas las sesiones activas se invalidarán porque se generarán nuevos secretos.

**Impacto:**
- Los usuarios deben volver a iniciar sesión
- Los tokens JWT anteriores dejan de ser válidos
- Las sesiones no persisten entre la versión anterior y la nueva

**Solución:**
- Informar a los usuarios que deben iniciar sesión nuevamente después de actualizar
- Este es un cambio único por instalación

### Futuras Actualizaciones

Las actualizaciones desde v1.1.20 en adelante **mantendrán las sesiones** porque los secretos persisten en el directorio de datos del usuario.

## Solución de Problemas

### Error: "Secrets no configurados"

Si ves este error después de actualizar:

1. **Verifica los permisos del directorio de datos:**
   ```bash
   # Windows
   dir "%APPDATA%\panel-amcham"
   
   # macOS/Linux
   ls -la ~/Library/Application\ Support/panel-amcham
   ```

2. **Elimina el archivo de secretos y reinicia** (se regenerarán):
   ```bash
   # Windows
   del "%APPDATA%\panel-amcham\.env.secrets"
   
   # macOS/Linux
   rm ~/Library/Application\ Support/panel-amcham/.env.secrets
   ```

3. **Verifica los logs de la aplicación:**
   - Busca mensajes sobre generación de secretos
   - Verifica errores de permisos de escritura

### Los Usuarios No Pueden Iniciar Sesión

Después de actualizar a v1.1.20+:

1. **Limpia las cookies del navegador** (si usas navegador externo)
2. **Cierra completamente la aplicación** y reinicia
3. **Los usuarios deben usar sus credenciales correctas** (la actualización no afecta usuarios en base de datos)

### Secretos Corruptos

Si el archivo `.env.secrets` se corrompe:

1. Cierra la aplicación
2. Elimina el archivo `.env.secrets`
3. Reinicia la aplicación (se regenerarán)
4. Los usuarios deben iniciar sesión nuevamente

## Archivos Relacionados

- **Gestor de secretos:** `src/utils/secretsManager.js`
- **Inicialización:** `main.js` (línea ~355)
- **Validación:** `src/server.js` (función `asegurarSecretos`)

## Verificación

Para verificar que los secretos están funcionando:

1. Abre la aplicación
2. Verifica en los logs:
   ```
   ✓ Secretos de seguridad inicializados
   ✓ Secretos de seguridad validados
   ```

3. Verifica que el archivo existe:
   ```bash
   # Windows
   type "%APPDATA%\panel-amcham\.env.secrets"
   
   # macOS/Linux
   cat ~/Library/Application\ Support/panel-amcham/.env.secrets
   ```

Deberías ver algo como:
```
PANELAMCHAM_JWT_SECRET=8f7a3e2c1b9d4f6e8a5c3d7b9e1f4a6c8b5d3e7a9c1f4b6d8e2a5c3f7b9d1e4a
SESSION_SECRET=9e7b3f1c8d6a4e2b5f9c7a3d1e6b8f4c2a7d5e9b3f1c6a8e4b2d7f5a9c3e1b6
PANELAMCHAM_REFRESH_SECRET=7c4f2e9b5a3d1f8c6e4b2a7d5f9c3e1b8a6d4f2c9e7b5a3f1d8c6e4b2a7d5f9
```

---

**Versión:** 1.1.20  
**Fecha:** 7 de enero de 2026  
**Cambio:** Sistema de generación automática de secretos
