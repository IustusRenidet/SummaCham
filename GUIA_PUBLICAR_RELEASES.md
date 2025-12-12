# 📦 Guía para Publicar Releases en GitHub

Esta guía explica cómo publicar versiones de **PanelAMCHAM** en GitHub para que el sistema de actualizaciones automáticas funcione correctamente.

---

## ✅ Configuración Actual de AutoUpdate

El sistema de actualizaciones automáticas está **correctamente configurado**:

### package.json
```json
{
  "name": "panel-amcham",
  "version": "1.0.1",
  "build": {
    "appId": "com.summa.cham.panelamcham",
    "publish": [
      {
        "provider": "github",
        "owner": "IustusRenidet",
        "repo": "SummaCham"
      }
    ]
  },
  "dependencies": {
    "electron-updater": "^6.6.2"
  }
}
```

### main.js
```javascript
const { autoUpdater } = require("electron-updater");

// Configuración no-intrusiva
autoUpdater.autoDownload = false;        // Pedir permiso antes de descargar
autoUpdater.autoInstallOnAppQuit = true; // Instalar al cerrar la app

// Sistema completo de eventos:
// ✓ checking-for-update
// ✓ update-available
// ✓ update-not-available
// ✓ download-progress
// ✓ update-downloaded
// ✓ error
```

**Estado**: ✅ Configuración completa y funcional

---

## 🔑 Paso 1: Configurar Token de GitHub

### Crear Personal Access Token

1. **Ve a GitHub Settings**:
   - Abre: https://github.com/settings/tokens
   - O navega: `Settings` → `Developer settings` → `Personal access tokens` → `Tokens (classic)`

2. **Generar nuevo token**:
   - Click en `Generate new token (classic)`
   - **Nota/Nombre**: `SummaCham Release Publisher`
   - **Expiración**: Recomendado `No expiration` o `1 year`
   
3. **Permisos necesarios** (selecciona estos scopes):
   ```
   ✓ repo (Full control of private repositories)
     ✓ repo:status
     ✓ repo_deployment
     ✓ public_repo
     ✓ repo:invite
     ✓ security_events
   ```

4. **Generar y copiar**:
   - Click en `Generate token`
   - **⚠️ IMPORTANTE**: Copia el token inmediatamente (solo se muestra una vez)
   - Formato: `ghp_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`

### Guardar Token como Variable de Entorno

**Windows (PowerShell permanente)**:
```powershell
# Abrir PowerShell como Administrador

# Agregar variable de entorno de usuario
[System.Environment]::SetEnvironmentVariable('GH_TOKEN', 'ghp_TU_TOKEN_AQUI', 'User')

# Verificar que se guardó
$env:GH_TOKEN
```

**Windows (.env local - NO subir a Git)**:
```bash
# Crear archivo .env en la raíz del proyecto
GH_TOKEN=ghp_TU_TOKEN_AQUI
```

**Verificar**:
```powershell
# Reiniciar PowerShell y verificar
echo $env:GH_TOKEN
```

---

## 📝 Paso 2: Actualizar Versión

Antes de publicar, actualiza la versión en `package.json`:

```json
{
  "version": "1.0.2"  // Incrementa: MAJOR.MINOR.PATCH
}
```

**Esquema de versionado**:
- `MAJOR` (1.x.x): Cambios incompatibles o restructuración mayor
- `MINOR` (x.1.x): Nuevas funcionalidades compatibles
- `PATCH` (x.x.1): Correcciones de bugs y mejoras menores

---

## 🔨 Paso 3: Compilar la Aplicación

### Opción 1: Build Completo (Recomendado)

Compila NSIS installer y versión portable para 32 y 64 bits:

```powershell
npm run build:all
```

**Genera**:
```
dist/
├── PanelAMCHAM-1.0.2-x64.exe          # Instalador 64-bit
├── PanelAMCHAM-1.0.2-ia32.exe         # Instalador 32-bit
├── PanelAMCHAM-portable-1.0.2-x64.exe # Portable 64-bit
├── PanelAMCHAM-portable-1.0.2-ia32.exe # Portable 32-bit
└── latest.yml                          # ⚠️ NECESARIO para auto-update
```

### Opción 2: Solo Instalador NSIS

```powershell
npm run dist
```

**Genera**:
```
dist/
├── PanelAMCHAM-1.0.2-x64.exe
├── PanelAMCHAM-1.0.2-ia32.exe
└── latest.yml  # ⚠️ NECESARIO
```

### Opción 3: Solo Versión Portable

```powershell
npm run build:portable
```

---

## 🚀 Paso 4: Publicar en GitHub

### Opción A: Publicación Automática (Recomendado)

Usa el script `publish` que automáticamente crea el release en GitHub:

```powershell
# Asegúrate de tener GH_TOKEN configurado
npm run publish
```

**Qué hace**:
1. ✓ Compila la aplicación para Windows
2. ✓ Crea un nuevo release en GitHub con tag `v{version}`
3. ✓ Sube automáticamente todos los archivos a GitHub Releases
4. ✓ Publica el release (público inmediatamente)

### Opción B: Publicación Manual

Si prefieres más control:

#### 1. Compilar localmente
```powershell
npm run build:all
```

#### 2. Crear Release en GitHub

Ve a: https://github.com/IustusRenidet/SummaCham/releases/new

**Configurar**:
- **Tag**: `v1.0.2` (DEBE empezar con "v" y coincidir con package.json)
- **Release title**: `PanelAMCHAM v1.0.2`
- **Description**: 
  ```markdown
  ## 🚀 Novedades
  
  - Mejora en el sistema de borradores por capítulo
  - Encabezados dinámicos en tablas SUMMARY/RESUMEN
  - Correcciones de estabilidad
  
  ## 📥 Descargas
  
  - **Windows 64-bit**: PanelAMCHAM-1.0.2-x64.exe (Instalador)
  - **Windows 32-bit**: PanelAMCHAM-1.0.2-ia32.exe (Instalador)
  - **Portable 64-bit**: PanelAMCHAM-portable-1.0.2-x64.exe
  - **Portable 32-bit**: PanelAMCHAM-portable-1.0.2-ia32.exe
  
  ## 🔄 Actualización Automática
  
  Los usuarios existentes recibirán una notificación automática.
  ```

#### 3. Subir Archivos

**⚠️ CRÍTICO**: Debes subir estos archivos:

```
OBLIGATORIOS para auto-update:
✓ latest.yml                          # Metadatos de la versión
✓ PanelAMCHAM-1.0.2-x64.exe          # Instalador principal
✓ PanelAMCHAM-1.0.2-x64.exe.blockmap # Para delta updates

OPCIONALES pero recomendados:
✓ PanelAMCHAM-1.0.2-ia32.exe
✓ PanelAMCHAM-1.0.2-ia32.exe.blockmap
✓ PanelAMCHAM-portable-1.0.2-x64.exe
✓ PanelAMCHAM-portable-1.0.2-ia32.exe
```

**Método**:
- Arrastra los archivos desde `dist/` a la sección de assets del release
- O usa el botón "Attach binaries by dropping them here"

#### 4. Publicar

- Click en `Publish release`
- El release será público inmediatamente
- Las aplicaciones instaladas comenzarán a detectar la actualización

---

## 🔄 Paso 5: Verificar Auto-Update

### En Aplicación Instalada

1. **Abrir aplicación existente** (versión anterior)
2. **Esperar 5 segundos** (chequeo automático al inicio)
3. **Debe aparecer diálogo**:
   ```
   ✨ Nueva versión 1.0.2 disponible
   
   Versión actual: 1.0.1
   Nueva versión: 1.0.2
   
   ¿Deseas descargar e instalar la actualización?
   
   [Descargar ahora] [Más tarde]
   ```

### Logs de Electron

Revisa la consola de Electron para ver el proceso:

```
🔄 Verificando actualizaciones automáticamente...
🔍 Verificando actualizaciones...
✨ Nueva actualización disponible: 1.0.2
Descargando: 10%
Descargando: 50%
Descargando: 100%
✓ Actualización descargada: 1.0.2
```

### Verificación Manual

Agregar botón de "Buscar actualizaciones" en el menú:

```javascript
// En main.js - createTray()
{
  label: "🔄 Buscar actualizaciones",
  click: () => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error("Error buscando actualizaciones:", err);
    });
  },
}
```

---

## 📋 Checklist Pre-Publicación

Antes de ejecutar `npm run publish`:

- [ ] ✓ Versión actualizada en `package.json`
- [ ] ✓ Token `GH_TOKEN` configurado en variables de entorno
- [ ] ✓ Cambios commiteados y pusheados a Git
- [ ] ✓ Build local exitoso (`npm run build:all`)
- [ ] ✓ Aplicación probada localmente
- [ ] ✓ Descripción del release preparada
- [ ] ✓ Archivos `.blockmap` presentes en `dist/`
- [ ] ✓ Archivo `latest.yml` presente en `dist/`

---

## 🛠️ Scripts Disponibles

```json
{
  "scripts": {
    // Desarrollo
    "start": "cross-env NODE_ENV=development electron .",
    "start:prod": "cross-env NODE_ENV=production electron .",
    
    // Build local (no publica)
    "pack": "electron-builder --dir",                    // Test sin empaquetar
    "dist": "electron-builder --win nsis",               // Solo instalador
    "build:portable": "electron-builder --win portable", // Solo portable
    "build:all": "electron-builder --win nsis,portable", // Ambos
    
    // Publicación automática (requiere GH_TOKEN)
    "publish": "cross-env NODE_ENV=production electron-builder --win --publish always"
  }
}
```

---

## 🐛 Solución de Problemas

### Error: "GitHub Personal Access Token is not set"

**Problema**: No se encuentra el token de GitHub

**Solución**:
```powershell
# Verificar variable
echo $env:GH_TOKEN

# Si está vacía, configurarla
[System.Environment]::SetEnvironmentVariable('GH_TOKEN', 'ghp_TU_TOKEN', 'User')

# Reiniciar PowerShell
```

### Error: "Cannot find module 'electron-updater'"

**Problema**: Dependencia no instalada

**Solución**:
```powershell
npm install electron-updater --save
```

### Error: "Error en auto-updater: net::ERR_INTERNET_DISCONNECTED"

**Problema**: Sin conexión a internet o GitHub no accesible

**Solución**:
- Verificar conexión a internet
- Verificar acceso a: https://api.github.com
- Verificar que el repositorio sea público o el token tenga permisos

### Release No Detectado por la Aplicación

**Verificar**:

1. **Tag correcto**: Debe ser `v1.0.2` (con "v" al inicio)
2. **Archivo latest.yml presente** en el release
3. **Versión en package.json coincide** con el tag (sin "v")
4. **Release publicado** (no draft)
5. **Repositorio correcto** en package.json:
   ```json
   "publish": [{
     "provider": "github",
     "owner": "IustusRenidet",
     "repo": "SummaCham"
   }]
   ```

### Delta Updates No Funcionan

**Problema**: Descarga completa en lugar de delta

**Verificar**:
- Archivos `.blockmap` presentes en el release
- Versión anterior también tenía `.blockmap`
- Ambas versiones usan el mismo `appId` en package.json

---

## 📊 Flujo Completo de Release

```mermaid
graph TD
    A[1. Actualizar package.json version] --> B[2. Commit y Push cambios]
    B --> C[3. npm run publish]
    C --> D[Electron Builder compila]
    D --> E[Crea tag vX.X.X en GitHub]
    E --> F[Sube archivos al release]
    F --> G[Publica release públicamente]
    G --> H[Usuarios reciben notificación]
    H --> I[Usuario acepta actualización]
    I --> J[Descarga e instala automáticamente]
```

---

## 🔐 Seguridad del Token

**⚠️ NUNCA**:
- ❌ Subir el token a Git
- ❌ Compartir el token públicamente
- ❌ Incluirlo en capturas de pantalla
- ❌ Agregarlo a archivos commiteados

**✓ SÍ**:
- ✓ Usar variables de entorno
- ✓ Agregar `.env` a `.gitignore`
- ✓ Rotar el token periódicamente
- ✓ Usar scopes mínimos necesarios

**En `.gitignore`**:
```
# Tokens y secrets
.env
.env.local
.env.*.local
GH_TOKEN
```

---

## 📚 Referencias

- [electron-updater Documentation](https://www.electron.build/auto-update)
- [electron-builder Publishing](https://www.electron.build/configuration/publish)
- [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github)
- [GitHub Personal Access Tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)

---

## ✅ Estado Actual

**Repositorio**: https://github.com/IustusRenidet/SummaCham  
**Versión Actual**: 1.0.1  
**AutoUpdate**: ✅ Configurado  
**Token Necesario**: ⚠️ Pendiente configurar  

---

## 🎯 Próximos Pasos

1. **Crear token de GitHub** (Paso 1)
2. **Configurar variable `GH_TOKEN`** (Paso 1)
3. **Actualizar versión a 1.0.2** (Paso 2)
4. **Ejecutar `npm run publish`** (Paso 4)
5. **Verificar release en GitHub** (Paso 5)

---

**Última actualización**: Diciembre 2025  
**Autor**: IustusRenidet & J02V4N
