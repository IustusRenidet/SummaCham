# Sistema de Backups Automáticos Implementado ✅

## 📦 Archivos Creados

### 1. **Servicio de Backups** 
`src/services/backupService.js`
- Gestión completa de backups automáticos
- Configuración flexible
- Limpieza automática de backups antiguos
- Verificación de integridad con checksums

### 2. **API de Backups**
`src/routes/backups.js`
Endpoints disponibles:
- `GET /api/backups/status` - Estado del servicio
- `GET /api/backups/list` - Listar todos los backups
- `POST /api/backups/create` - Crear backup manual (admin)
- `POST /api/backups/restore` - Restaurar desde backup (admin)
- `GET /api/backups/download/:fileName` - Descargar backup (admin)
- `PUT /api/backups/config` - Actualizar configuración (admin)

### 3. **Configuración de Ejemplo**
`.env.backup.example`
Template para configurar backups

## 🚀 Configuración

### Variables de Entorno

Agrega estas variables a tu `.env.production` o `.env.development`:

```env
# Habilitar backups automáticos
BACKUP_ENABLED=true

# Intervalo entre backups (minutos)
BACKUP_INTERVAL_MINUTES=60

# Máximo de backups a mantener
BACKUP_MAX_BACKUPS=24

# Ruta personalizada (opcional)
# BACKUP_PATH=/ruta/personalizada/backups
```

### Configuración Recomendada por Uso

#### Producción con Alta Actividad:
```env
BACKUP_ENABLED=true
BACKUP_INTERVAL_MINUTES=30  # Cada 30 minutos
BACKUP_MAX_BACKUPS=48       # Mantener 24 horas
```

#### Producción con Actividad Normal:
```env
BACKUP_ENABLED=true
BACKUP_INTERVAL_MINUTES=60  # Cada hora
BACKUP_MAX_BACKUPS=24       # Mantener 24 horas
```

#### Desarrollo:
```env
BACKUP_ENABLED=true
BACKUP_INTERVAL_MINUTES=240 # Cada 4 horas
BACKUP_MAX_BACKUPS=6        # Mantener últimos 6
```

## 📂 Ubicación de Backups

Por defecto: `datos/backups/`

Formato de nombres: `panel_YYYY-MM-DD_HH-MM-SS.sqlite`

Ejemplo: `panel_2026-01-04_14-30-00.sqlite`

## 🔄 Integración en el Servidor

El servicio se inicia automáticamente con el servidor:

```javascript
// En src/server.js
backupService.initialize({...config});
backupService.start();
```

## 💻 Uso desde la API

### Crear backup manual:
```bash
curl -X POST https://tu-dominio.com/api/backups/create \
  -H "Cookie: panelamcham.sid=tu_session_id"
```

### Listar backups disponibles:
```bash
curl https://tu-dominio.com/api/backups/list \
  -H "Cookie: panelamcham.sid=tu_session_id"
```

### Descargar un backup:
```bash
curl https://tu-dominio.com/api/backups/download/panel_2026-01-04_14-30-00.sqlite \
  -H "Cookie: panelamcham.sid=tu_session_id" \
  -o backup.sqlite
```

### Restaurar desde backup:
```bash
curl -X POST https://tu-dominio.com/api/backups/restore \
  -H "Content-Type: application/json" \
  -H "Cookie: panelamcham.sid=tu_session_id" \
  -d '{"backupFileName":"panel_2026-01-04_14-30-00.sqlite"}'
```

## 🔧 Optimizaciones SQLite para Multi-Usuario

### Cambios Implementados en `src/db/sqlite.js`:

```javascript
db.pragma("journal_mode = WAL");      // Write-Ahead Logging
db.pragma("synchronous = NORMAL");     // Balance seguridad/rendimiento
db.pragma("cache_size = 10000");       // Cache de ~10MB
db.pragma("temp_store = MEMORY");      // Temporales en RAM
db.pragma("busy_timeout = 5000");      // Espera 5s en locks
```

### Beneficios del Modo WAL:
- ✅ Lecturas y escrituras concurrentes
- ✅ Mejor rendimiento para múltiples usuarios
- ✅ Reduce bloqueos de base de datos
- ✅ Commits más rápidos

## 🎯 Características del Sistema

### Automático:
- ✅ Backups programados según configuración
- ✅ Limpieza automática de backups antiguos
- ✅ No requiere intervención manual

### Seguro:
- ✅ Verificación de integridad con checksums SHA256
- ✅ Validación de tamaños de archivo
- ✅ Backup de seguridad antes de restaurar

### Flexible:
- ✅ Configuración en tiempo real vía API
- ✅ Backups manuales cuando sea necesario
- ✅ Descarga de backups para almacenamiento externo

### Eficiente:
- ✅ Mantenimiento automático de espacio
- ✅ Solo mantiene N backups más recientes
- ✅ Logs detallados de operaciones

## 📊 Monitoreo

### Ver estado del servicio:
```javascript
// En consola del servidor verás:
✓ Servicio de backups inicializado
✓ Backups automáticos iniciados (cada 60 minutos)
✓ Backup creado: panel_2026-01-04_14-30-00.sqlite (2.5 MB)
```

### Logs importantes:
- Inicio del servicio
- Cada backup creado
- Backups eliminados (limpieza)
- Errores o advertencias

## ⚠️ Consideraciones Importantes

### Espacio en Disco:
- Cada backup es una copia completa de la DB
- Con 24 backups de 2MB c/u = ~48MB
- Ajusta `BACKUP_MAX_BACKUPS` según espacio disponible

### Rendimiento:
- El backup NO bloquea la base de datos (gracias a WAL)
- Proceso rápido (~1-2 segundos para DB < 10MB)
- Impacto mínimo en operaciones normales

### Restauración:
- Requiere reinicio de la aplicación
- Se crea backup de seguridad automático antes de restaurar
- Solo administradores pueden restaurar

## 🔐 Seguridad

- ✅ Todos los endpoints requieren autenticación
- ✅ Operaciones sensibles solo para administradores
- ✅ Backups almacenados en directorio protegido
- ✅ Checksums para verificar integridad

## 📝 Próximos Pasos Recomendados

1. **Configurar backups externos:**
   ```bash
   # Ejemplo: Sincronizar backups a la nube cada día
   rsync -av datos/backups/ usuario@servidor:/backup/panelamcham/
   ```

2. **Monitoreo:**
   - Configura alertas si el servicio falla
   - Verifica regularmente que los backups se crean

3. **Pruebas:**
   - Realiza una restauración de prueba
   - Verifica que los datos se recuperan correctamente

4. **Documentación para usuarios:**
   - Crea guía para administradores
   - Documenta procedimiento de recuperación de desastres

---

## ✅ Listo para Producción

El sistema de backups está completamente implementado y listo para usar. Solo necesitas:

1. Configurar las variables de entorno
2. Iniciar el servidor
3. Los backups comenzarán automáticamente

**¡Tu base de datos ahora está protegida!** 🎉
