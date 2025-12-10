# ✅ Configuración ASAR Completada - PanelAMCHAM

## 📦 Estructura del Empaquetado

### **ASAR (app.asar) - Archivos Empaquetados y Comprimidos**
✅ Compresión: `maximum` (20.5 MB comprimido)

**Contenido en ASAR:**
- `main.js` - Proceso principal Electron
- `src/**/*` - Backend (API REST, servicios, configuración)
- `vistas/**/*` - Frontend (HTML, CSS, JS, assets)
- `icono/**/*` - Iconos de la aplicación
- `image/**/*` - Imágenes de la UI
- `mds/**/*` - Documentación markdown
- `scripts/**/*` - Scripts auxiliares
- `node_modules/**/*` - Dependencias (EXCEPTO nativos)
- `package.json`, `README.md`

**Archivos EXCLUIDOS del ASAR:**
- ❌ `node_modules/.cache` - Cachés temporales
- ❌ `node_modules/.bin` - Binarios npm
- ❌ `**/test/**`, `**/tests/**` - Tests
- ❌ `**/*.md`, `**/LICENSE`, `**/CHANGELOG*` - Documentación
- ❌ `**/*.map` - Source maps
- ❌ `.DS_Store` - Archivos de sistema

---

### **ASAR Unpacked (app.asar.unpacked) - Módulos Nativos**
✅ Desempaquetados para acceso directo (binarios compilados)

**Módulos nativos desempaquetados:**
```
node_modules/
├── better-sqlite3/     ← Base de datos SQLite (binario .node)
└── node-firebird/      ← Cliente Firebird (binario .node)
```

**Por qué se desempaquetan:**
- Contienen binarios nativos compilados (`.node`, `.dll`)
- NO se pueden comprimir en ASAR
- Requieren acceso directo del SO

**Código de carga automática:**
- `src/db/sqlite.js` - Carga `better-sqlite3` desde `.asar.unpacked`
- `src/services/firebirdService.js` - Carga `node-firebird` desde `.asar.unpacked`

---

### **Extra Resources (resources/) - Datos Modificables**
✅ Fuera del ASAR para lectura/escritura directa

**Carpetas en `resources/`:**
```
resources/
├── datos/              ← Base de datos SQLite, configuración usuarios
├── excels/             ← Archivos Excel para importación
├── info_importante/    ← Documentación interna, metadata
└── IMPLEMENTACIONES/   ← Scripts de migración, backups
```

**Por qué están fuera del ASAR:**
- **Modificables**: La app escribe en `datos/` (panel.sqlite)
- **Pesados**: Archivos Excel grandes en `excels/`
- **Dinámicos**: Usuarios pueden agregar archivos
- **Accesibles**: Fácil acceso sin descomprimir ASAR

---

## 🔧 Configuración en `package.json`

### **1. ASAR y Compresión**
```json
"asar": true,
"asarUnpack": [
  "node_modules/better-sqlite3/**/*",
  "node_modules/node-firebird/**/*"
],
"compression": "maximum"
```

### **2. Archivos Empaquetados**
```json
"files": [
  "main.js",
  "src/**/*",
  "vistas/**/*",
  "icono/**/*",
  "image/**/*",
  "mds/**/*",
  "scripts/**/*",
  "node_modules/**/*",
  "package.json",
  "README.md",
  "!node_modules/.cache",
  "!node_modules/.bin",
  "!node_modules/**/test/**",
  "!node_modules/**/tests/**",
  "!node_modules/**/*.test.js",
  "!node_modules/**/__tests__/**",
  "!node_modules/**/*.md",
  "!node_modules/**/LICENSE",
  "!node_modules/**/CHANGELOG*",
  "!node_modules/**/.github",
  "!node_modules/**/docs/**",
  "!node_modules/**/examples/**",
  "!**/*.map",
  "!**/.DS_Store"
]
```

### **3. Extra Resources**
```json
"extraResources": [
  {
    "from": "datos",
    "to": "datos",
    "filter": ["**/*"]
  },
  {
    "from": "excels",
    "to": "excels",
    "filter": ["**/*"]
  },
  {
    "from": "info IMPORTANTE",
    "to": "info_importante",
    "filter": ["**/*"]
  },
  {
    "from": "IMPLEMENTACIONES",
    "to": "IMPLEMENTACIONES",
    "filter": ["**/*"]
  }
]
```

---

## 🧪 Verificación del Build

### **Comandos de Build**
```bash
# Build sin instalador (prueba rápida)
npm run pack

# Build completo (NSIS installer)
npm run dist

# Build portable (ZIP sin instalación)
npm run build:portable

# Build todos los formatos
npm run build:all
```

### **Verificación Post-Build**
```powershell
# 1. Verificar estructura
Get-ChildItem -Path "dist\win-unpacked\resources"
# Resultado esperado: app.asar, app.asar.unpacked, datos, excels, info_importante, IMPLEMENTACIONES

# 2. Verificar módulos nativos desempaquetados
Test-Path "dist\win-unpacked\resources\app.asar.unpacked\node_modules\better-sqlite3"
Test-Path "dist\win-unpacked\resources\app.asar.unpacked\node_modules\node-firebird"
# Resultado esperado: True, True

# 3. Verificar tamaño ASAR (debe ser ~20-25 MB)
Get-Item "dist\win-unpacked\resources\app.asar" | Select-Object Name, @{Name="Size (MB)";Expression={[math]::Round($_.Length / 1MB, 2)}}

# 4. Ejecutar app empaquetada
.\dist\win-unpacked\PanelAMCHAM.exe
```

---

## ⚠️ Resolución de Problemas

### **Error: Cannot find module 'better-sqlite3'**
**Causa:** El módulo nativo no está en `.asar.unpacked`

**Solución:**
1. Verificar `asarUnpack` en `package.json`
2. Limpiar build: `Remove-Item -Recurse -Force dist`
3. Rebuild: `npm run pack`

### **Error: Cannot find module 'node-firebird'**
**Causa:** El módulo nativo no está en `.asar.unpacked`

**Solución:**
1. Verificar `asarUnpack` en `package.json`
2. Verificar código de carga en `src/services/firebirdService.js`

### **Base de datos no se crea/actualiza**
**Causa:** `datos/` está dentro del ASAR (solo lectura)

**Solución:**
1. Verificar `extraResources` en `package.json`
2. `datos/` debe estar en `resources/datos` (fuera del ASAR)

### **Build muy pesado (>100 MB)**
**Causa:** Archivos innecesarios empaquetados

**Solución:**
1. Verificar exclusiones en `files` (tests, docs, maps)
2. Verificar compresión: `"compression": "maximum"`
3. Mover archivos pesados a `extraResources`

---

## 📊 Tamaños Esperados

| Componente | Tamaño Esperado |
|------------|----------------|
| `app.asar` (comprimido) | ~20-25 MB |
| `app.asar.unpacked` (nativos) | ~5-10 MB |
| `resources/datos` | ~1-5 MB |
| `resources/excels` | Variable (depende de archivos) |
| **Total instalador NSIS** | ~60-80 MB |
| **Total portable** | ~80-100 MB |

---

## ✅ Checklist Final

- [x] ASAR habilitado con compresión máxima
- [x] Módulos nativos desempaquetados (`better-sqlite3`, `node-firebird`)
- [x] Código de carga automática implementado
- [x] Datos modificables en `extraResources`
- [x] Archivos innecesarios excluidos (tests, docs, maps)
- [x] Build verificado y funcional
- [x] Tamaño optimizado (~20 MB ASAR)

---

## 🎯 Siguiente Paso

**Ejecutar build completo:**
```bash
npm run dist
```

El instalador NSIS se generará en:
```
dist/PanelAMCHAM-1.0.1-x64.exe
dist/PanelAMCHAM-1.0.1-ia32.exe
```

**Build portable:**
```bash
npm run build:portable
```

El portable se generará en:
```
dist/PanelAMCHAM-portable-1.0.1-x64.exe
dist/PanelAMCHAM-portable-1.0.1-ia32.exe
```
