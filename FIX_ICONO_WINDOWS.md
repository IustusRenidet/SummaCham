# 🎨 Corrección: Icono de Aplicación en Windows

## 🔍 Problema Identificado

El instalador mostraba el icono correctamente, pero la aplicación NO mostraba el icono en:
- ❌ Ventana principal
- ❌ Taskbar (barra de tareas)
- ❌ Alt+Tab

## 🐛 Causa Raíz

**1. Icono empaquetado dentro del ASAR**
- Windows requiere acceso directo al archivo `.ico`
- El icono estaba dentro del archivo ASAR comprimido
- `app.getAppPath()` apuntaba al ASAR, no a los recursos extraídos

**2. Uso incorrecto de `setOverlayIcon()`**
- `setOverlayIcon()` es para badges/insignias sobre el icono del taskbar
- NO es para establecer el icono principal de la aplicación

**3. Falta de `AppUserModelId`**
- Windows 7+ necesita un ID único para agrupar correctamente en el taskbar

## ✅ Solución Implementada

### 1. **Función `resolveAssetPath` Mejorada** ([main.js](main.js#L20-L37))

```javascript
const resolveAssetPath = (...segments) => {
  // En desarrollo, usar la ruta del proyecto
  if (!app.isPackaged) {
    return path.join(__dirname, ...segments);
  }
  
  // En producción, buscar en process.resourcesPath (recursos extraídos)
  const resourcePath = path.join(process.resourcesPath, ...segments);
  const fs = require('fs');
  
  if (fs.existsSync(resourcePath)) {
    return resourcePath; // ✅ Icono extraído del ASAR
  }
  
  // Fallback a la ruta del ASAR
  return path.join(app.getAppPath(), ...segments);
};
```

**¿Qué hace?**
- 🔍 Busca el icono en `process.resourcesPath` (carpeta de recursos extraídos)
- ✅ Si existe ahí, usa esa ruta (acceso directo al `.ico`)
- 🔄 Si no, intenta dentro del ASAR (fallback)

---

### 2. **Configuración de BrowserWindow Corregida** ([main.js](main.js#L230-L258))

```javascript
mainWindow = new BrowserWindow({
  icon: iconPath, // ✅ Ruta directa al .ico (no nativeImage)
  // ... otras opciones
});

// Establecer explícitamente para Windows
if (process.platform === 'win32' && !appIcon.isEmpty()) {
  mainWindow.setIcon(appIcon);
  
  // AppUserModelId para agrupación correcta en taskbar
  if (app.isPackaged) {
    app.setAppUserModelId('com.amcham.panel');
  }
}
```

**Cambios:**
- ✅ Usar `iconPath` (string) en vez de `nativeImage` en BrowserWindow
- ✅ Llamar a `setIcon()` explícitamente después de crear la ventana
- ✅ Establecer `AppUserModelId` único para Windows
- ❌ Eliminado `setOverlayIcon()` incorrecto

---

### 3. **Iconos Extraídos del ASAR** ([package.json](package.json#L80-L87))

```json
"extraResources": [
  {
    "from": "icono",
    "to": "icono",
    "filter": ["**/*"]
  },
  // ... otros recursos
]
```

**¿Qué hace?**
- 📦 Extrae la carpeta `icono/` del ASAR al instalar
- 📍 Los archivos `.ico` quedan en `resources/icono/`
- ✅ Windows tiene acceso directo al archivo de icono

---

## 🔧 Estructura de Archivos en Producción

### Antes (❌ Problema):
```
C:\Program Files\Panel AMCHAM\
├── resources\
│   └── app.asar              ← Icono comprimido aquí (inaccesible)
└── Panel AMCHAM.exe
```

### Después (✅ Solución):
```
C:\Program Files\Panel AMCHAM\
├── resources\
│   ├── app.asar
│   └── icono\                ← Icono extraído (accesible)
│       ├── icono.ico         ✅
│       ├── icono.png
│       ├── amcham.png
│       └── amcham.jpg
└── Panel AMCHAM.exe
```

---

## 🧪 Cómo Probar

### Desarrollo:
```powershell
npm start
# Verifica logs en consola:
# 📍 Ruta del icono: C:\...\icono\icono.ico
# 🎨 Icono cargado: true
```

### Producción:
```powershell
npm run build
.\dist\SummaCham Setup X.Y.Z.exe

# Instalar y verificar:
# ✅ Icono en ventana principal
# ✅ Icono en taskbar
# ✅ Icono en Alt+Tab
# ✅ Icono en acceso directo del escritorio
```

---

## 📋 Checklist de Verificación

- [x] Icono en instalador NSIS
- [x] Icono en acceso directo del escritorio
- [x] Icono en ventana principal
- [x] Icono en taskbar
- [x] Icono en Alt+Tab
- [x] Icono en menú de inicio
- [x] Icono en tray (bandeja del sistema)

---

## 🎯 Archivos Modificados

1. **[main.js](main.js)**
   - Líneas 20-37: Función `resolveAssetPath` mejorada
   - Líneas 230-258: Configuración de icono corregida
   - Logs de depuración agregados

2. **[package.json](package.json)**
   - Líneas 80-87: Carpeta `icono/` agregada a `extraResources`

---

## 📚 Referencias

- [Electron Icon Documentation](https://www.electronjs.org/docs/latest/api/native-image)
- [electron-builder extraResources](https://www.electron.build/configuration/contents#extraresources)
- [Windows AppUserModelId](https://learn.microsoft.com/en-us/windows/win32/shell/appids)

---

## 💡 Nota Importante

**Siempre que cambies el icono:**
1. Recompila la aplicación: `npm run build`
2. Desinstala la versión anterior completamente
3. Reinstala la nueva versión
4. Si el icono no se actualiza, limpia caché de Windows:
   ```powershell
   ie4uinit.exe -ClearIconCache
   taskkill /IM explorer.exe /F
   start explorer.exe
   ```
