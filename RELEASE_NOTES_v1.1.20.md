# Release v1.1.20 - Gestión Automática de Secretos

## 🔐 Corrección Crítica: Secretos de Seguridad

### Error Resuelto
**Problema:** Error al iniciar la aplicación con el mensaje:
```
Secrets no configurados o inseguros: PANELAMCHAM_JWT_SECRET, SESSION_SECRET.
```

**Causa:** Los secretos JWT y de sesión no estaban incluidos en el paquete de distribución y la aplicación los requería explícitamente.

**Solución Implementada:**
- ✅ Generación automática de secretos criptográficamente seguros en el primer inicio
- ✅ Persistencia de secretos en el directorio de datos del usuario
- ✅ Validación mejorada que detecta si la app está en modo Electron
- ✅ Los secretos se mantienen entre actualizaciones

## 🚀 Mejoras de Seguridad

### Secretos Únicos por Instalación
Cada instalación genera sus propios secretos únicos:
- **PANELAMCHAM_JWT_SECRET** - 256 bits de entropía
- **SESSION_SECRET** - 256 bits de entropía  
- **PANELAMCHAM_REFRESH_SECRET** - 256 bits de entropía

### Almacenamiento Seguro
Los secretos se guardan en:
- **Windows:** `%APPDATA%\panel-amcham\.env.secrets`
- **macOS:** `~/Library/Application Support/panel-amcham/.env.secrets`
- **Linux:** `~/.config/panel-amcham/.env.secrets`

Con permisos restringidos (Unix: `0600`)

## ⚠️ Nota Importante para Usuarios Existentes

### Primera Actualización a v1.1.20

Al actualizar desde v1.1.19 o versiones anteriores:

**Impacto:**
- Se generarán nuevos secretos automáticamente
- **Las sesiones activas se invalidarán**
- **Deberás iniciar sesión nuevamente**

**Esto es normal y solo ocurre una vez.** Las actualizaciones futuras mantendrán tus sesiones.

## 📦 Instalación

### Usuarios Nuevos
1. Descarga e instala normalmente desde GitHub Releases
2. La aplicación generará secretos automáticamente al primer inicio
3. Inicia sesión normalmente

### Usuarios Actualizando desde v1.1.19
1. Cierra completamente la aplicación actual
2. Descarga e instala v1.1.20
3. Al iniciar, se generarán secretos automáticamente
4. **Inicia sesión nuevamente** (las credenciales son las mismas)

### Usuarios Actualizando desde v1.1.18 o Anterior
1. Desinstala la versión actual
2. Descarga e instala v1.1.20
3. Al iniciar, se generarán secretos automáticamente
4. Inicia sesión con tus credenciales

## 🔍 Verificación

Después de instalar, verifica en los logs de la aplicación:
```
✓ Secretos de seguridad inicializados
✓ Secretos de seguridad validados
✓ Servidor backend iniciado en puerto 3005
```

La aplicación debe:
- ✅ Iniciar sin errores
- ✅ Permitir inicio de sesión correctamente
- ✅ Mantener sesiones entre reinicios

## 📋 Cambios Técnicos

### Nuevos Componentes

**Archivo:** `src/utils/secretsManager.js`
- Generación de secretos con `crypto.randomBytes(32)`
- Gestión de persistencia en disco
- Carga automática en el arranque

**Modificaciones:**
- `main.js` - Inicialización de secretos antes de cargar el servidor
- `src/server.js` - Validación mejorada para modo Electron
- `package.json` - Versión actualizada a 1.1.20

### Documentación Nueva
- `GESTION_SECRETOS_AUTOMATICA.md` - Guía completa del sistema de secretos

## 🐛 Solución de Problemas

### Si la App No Inicia

1. Verifica que el directorio de datos tenga permisos correctos
2. Revisa los logs de la aplicación
3. Si persiste, elimina `.env.secrets` y reinicia (se regenerará)

### Si No Puedes Iniciar Sesión Después de Actualizar

1. Cierra completamente la aplicación (incluyendo ícono en bandeja)
2. Limpia cookies del navegador (si usas navegador externo)
3. Reinicia la aplicación
4. Intenta iniciar sesión nuevamente

### Para Más Ayuda

Consulta la documentación completa:
- [GESTION_SECRETOS_AUTOMATICA.md](GESTION_SECRETOS_AUTOMATICA.md)
- [Reportar problema en GitHub](https://github.com/IustusRenidet/SummaCham/issues)

## 📊 Historial de Versiones Recientes

- **v1.1.20** - Gestión automática de secretos (este release)
- **v1.1.19** - Corrección módulos nativos + administrador global
- **v1.1.18** - Versión anterior con errores

## 🎯 Próximas Mejoras

- Sistema de respaldo de secretos
- Rotación automática de secretos (opcional)
- Exportación/importación de configuración

---

**Versión:** 1.1.20  
**Fecha:** 7 de enero de 2026  
**Criticidad:** Alta (corrige error que impedía el uso de la aplicación)  
**Migración:** Requiere re-autenticación única
