# 🔄 Guía Rápida: Sistema de Actualizaciones

## ¿Cómo funciona?

### Para el Usuario Final

1. **Automático**: La app verifica actualizaciones 5 segundos después de iniciar
2. **Manual**: Click derecho en el icono de la bandeja → "Buscar actualizaciones"
3. **No-intrusivo**: Siempre pregunta antes de descargar o instalar
4. **Flexible**: Puede instalar ahora o al cerrar la aplicación

### Flujo Visual

```
Usuario abre app
     ↓
5 segundos después → Verifica actualizaciones en GitHub
     ↓
¿Hay nueva versión?
     ├─ NO  → Continúa normalmente
     └─ SÍ  → ┌──────────────────────────────┐
              │ Nueva versión X.Y.Z          │
              │ ¿Descargar ahora?            │
              │ [Descargar] [Más tarde]      │
              └──────────────────────────────┘
                     ↓ Si acepta
              Descarga en segundo plano
              (muestra progreso en título)
                     ↓
              ┌──────────────────────────────┐
              │ Actualización descargada     │
              │ ¿Reiniciar ahora?            │
              │ [Reiniciar] [Más tarde]      │
              └──────────────────────────────┘
                     ↓ Si acepta
              Cierra → Instala → Reinicia
```

---

## Para Desarrolladores: Publicar Actualización

### Opción 1: Script Automatizado (RECOMENDADO)

```powershell
.\scripts\publish-update.ps1 -Version "1.0.1" -ReleaseNotes "Correcciones de bugs"
```

Esto hace:
1. ✅ Actualiza `package.json`
2. ✅ Compila la aplicación
3. ✅ Verifica archivos generados
4. ✅ Crea commit y tag de Git
5. ✅ Te da instrucciones para publicar en GitHub

### Opción 2: Manual

```powershell
# 1. Cambiar versión en package.json
"version": "1.0.1"

# 2. Compilar
npm run build

# 3. Publicar en GitHub
git add package.json
git commit -m "Bump version to 1.0.1"
git tag -a "v1.0.1" -m "Release v1.0.1"
git push origin main
git push origin v1.0.1

# 4. Crear release en GitHub con estos archivos de dist/:
#    - SummaCham Setup 1.0.1.exe
#    - SummaCham Setup 1.0.1-ia32.exe
#    - SummaCham 1.0.1.exe
#    - SummaCham 1.0.1-ia32.exe
#    - latest.yml (OBLIGATORIO)
```

---

## Configuración Técnica (main.js)

```javascript
// Configuración principal
autoUpdater.autoDownload = false;        // Pedir permiso antes de descargar
autoUpdater.autoInstallOnAppQuit = true; // Instalar al cerrar si hay update pendiente

// Eventos implementados
'checking-for-update'   → Log: "🔍 Verificando..."
'update-available'      → Diálogo: "¿Descargar v1.0.1?"
'update-not-available'  → Log: "✓ Ya está actualizado"
'download-progress'     → Título ventana: "Descargando: 45%"
'update-downloaded'     → Diálogo: "¿Reiniciar ahora?"
'error'                 → Mensaje: "Error: ..."
```

---

## ⚠️ Importante

- **Solo funciona en versión empaquetada** (`.exe`), NO en desarrollo (`npm start`)
- **Archivo `latest.yml` es OBLIGATORIO** en cada release de GitHub
- **Los releases deben ser públicos** o configurar token de acceso
- **Los datos del usuario se mantienen** (base de datos, configuración)

---

## 🧪 Probar Localmente

```powershell
# 1. Compilar versión 1.0.0
npm run build
.\dist\SummaCham Setup 1.0.0.exe  # Instalar

# 2. Cambiar a 1.0.1 y recompilar
npm run build

# 3. Crear release v1.0.1 en GitHub

# 4. Abrir app 1.0.0 → Buscar actualizaciones
#    Debe detectar la 1.0.1
```

---

## 📞 Solución Rápida de Problemas

| Problema | Solución |
|----------|----------|
| "No detecta actualización" | Verifica que `latest.yml` esté en el release |
| "Error al descargar" | Verifica que el release sea público |
| "No se instala" | Verifica permisos de escritura y antivirus |

---

## 📚 Documentación Completa

Ver [SISTEMA_ACTUALIZACIONES.md](./SISTEMA_ACTUALIZACIONES.md) para documentación detallada.
