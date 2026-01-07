# Release v1.1.19 - Corrección Crítica: Módulos Nativos

## 🔧 Corrección Crítica

### Error de Compatibilidad de Módulos Nativos
**Problema resuelto:** Error al iniciar la aplicación con el mensaje:
```
The module 'better_sqlite3.node' was compiled against a different Node.js version
using NODE_MODULE_VERSION 127. This version requires NODE_MODULE_VERSION 140.
```

**Causa:** El módulo nativo `better-sqlite3` no estaba compilado correctamente para Electron 39.2.7.

**Solución:** 
- ✅ Módulo nativo recompilado para Electron 39.2.7 (NODE_MODULE_VERSION 140)
- ✅ Script de pre-publicación añadido para prevenir futuros errores
- ✅ Proceso de publicación mejorado con validaciones automáticas

## 🚀 Mejoras para Usuarios

### Corrección del Error de Administrador Global
**Problema resuelto:** Error HTTP 400 al intentar crear un usuario como administrador global sin seleccionar empresas.

**Mejora:** Ahora cuando se marca un usuario como "Administrador Global", automáticamente se asignan todos los permisos para todas las empresas y módulos, sin necesidad de seleccionarlos manualmente.

## 📦 Instalación

### Usuarios Nuevos
Descarga e instala normalmente desde GitHub Releases.

### Usuarios con v1.1.18 (con el error)
1. Desinstala la versión actual
2. Descarga e instala v1.1.19

**No se requiere ninguna configuración adicional.**

## 🔍 Verificación

Después de instalar, la aplicación debe:
- ✅ Iniciar sin errores
- ✅ Conectar a la base de datos SQLite correctamente
- ✅ Permitir gestión de usuarios sin problemas

## 📋 Cambios Técnicos

### Para Desarrolladores

**Nuevos Scripts:**
- `prepublish` - Valida y recompila módulos nativos antes de publicar
- `rebuild-native-electron` - Recompila específicamente para Electron

**Archivos Nuevos:**
- `scripts/prepublish.js` - Script de validación pre-publicación
- `SOLUCION_ERROR_NODE_MODULE_VERSION.md` - Documentación del problema y solución

**Archivos Modificados:**
- `package.json` - Scripts actualizados, versión incrementada
- `vistas/crear_usuario.html` - Corrección en asignación de permisos admin
- `REBUILD_NATIVE.md` - Documentación actualizada

## ⚠️ Nota Importante

Si después de actualizar sigues viendo el error:
1. Desinstala completamente la aplicación
2. Elimina la carpeta de instalación (si existe)
3. Reinstala desde la nueva versión

## 🐛 Reportar Problemas

Si encuentras algún problema con esta versión, por favor reporta en:
https://github.com/IustusRenidet/SummaCham/issues

---

**Versión:** 1.1.19  
**Fecha:** 7 de enero de 2026  
**Criticidad:** Alta (corrige error que impedía el uso de la aplicación)
