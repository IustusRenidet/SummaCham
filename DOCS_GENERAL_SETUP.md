# DOCS GENERAL SETUP

Este documento consolida información de múltiples archivos originales. Cada sección indica la fuente exacta.

## Índice de fuentes
- `ACTUALIZACIONES_GUIA_RAPIDA.md`
- `ARCHIVOS.md`
- `CHECKLIST_PUBLICACION.md`
- `CONFIGURACION_ASAR_COMPLETA.md`
- `CONFIGURACION_ENTORNO.md`
- `DEPLOY_FIREBIRD.md`
- `DOCUMENTACION_COMPLETA.md`
- `DOCUMENTACION_TECNICA.md`
- `EXPLICACION_PACKAGE_CONFIG.md`
- `GESTION_FIREBIRD_CONEXIONES.md`
- `GESTION_SECRETOS_AUTOMATICA.md`
- `GUIA_PUBLICAR_RELEASES.md`
- `INSTRUCCIONES_USO.md`
- `REBUILD_NATIVE.md`
- `RELEASE_NOTES_v1.1.19.md`
- `RELEASE_NOTES_v1.1.20.md`
- `SEGURIDAD.md`
- `SETUP_INICIAL.md`
- `SISTEMA_ACTUALIZACIONES.md`
- `SISTEMA_BACKUPS.md`
- `SOLUCION_ERROR_NODE_MODULE_VERSION.md`

---

## ACTUALIZACIONES_GUIA_RAPIDA.md

_Fuente: `ACTUALIZACIONES_GUIA_RAPIDA.md`_

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

---

## ARCHIVOS.md

_Fuente: `ARCHIVOS.md`_

# Archivos

- **[main.js](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Punto de entrada principal de la aplicación Electron. Maneja la creación de la ventana principal, bandeja del sistema, actualizaciones automáticas, auto-lanzamiento y gestión de instancias únicas.
- **[package.json](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Archivo de configuración de npm con dependencias, scripts de build, configuración de Electron Builder y metadatos del proyecto.
- **[README.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Documentación principal del proyecto con instrucciones de instalación, características y uso.
- **[panel.sqlite.bak](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Copia de respaldo de la base de datos SQLite utilizada para almacenar datos locales.
- **date=local** : Archivo que indica configuración de fecha local, posiblemente para manejo de zonas horarias.
- **[ACTUALIZACIONES_GUIA_RAPIDA.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Guía rápida para actualizaciones del sistema.
- **ANALISIS_EXHAUSTIVO_MODULOS_INSERCION.md** : Análisis detallado de módulos de inserción de datos.
- **[ANALISIS_PROBLEMA_SUMMARY.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Análisis de problemas relacionados con el resumen financiero.
- **[analisis-flujo-autorizacion.html](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Análisis del flujo de autorización en formato HTML.
- **[ARQUITECTURA_MULTIUSUARIO.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Documentación de la arquitectura multi-usuario.
- **[AUTO_CONSTRUCCION_CONSOLIDADAS.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Guía para construcción automática de consolidadas.
- **[BACKEND_INSERCION.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Documentación del backend para inserción de datos.
- **[button_audit.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Documentación sobre auditoría de botones.
- **[cambiar-modo.ps1](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Script de PowerShell para cambiar modos de la aplicación.
- **[check-2022.js](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Script para verificar datos de 2022.
- **[CHECKLIST_PUBLICACION.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Lista de verificación para publicación de releases.
- **[CODIGO_LISTO_PARA_IMPLEMENTAR.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Código preparado para implementación.
- **[CONFIGURACION_ASAR_COMPLETA.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Configuración completa para empaquetado ASAR.
- **[CONFIGURACION_ENTORNO.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Configuración del entorno de desarrollo.
- **[CORRECCION_ORDEN_SUMMARY.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Correcciones en el orden del resumen.
- **[CORRECCION_VERIFICACION_SESION.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Correcciones en verificación de sesión.
- **[CORRECCIONES_FILTRO_CAPITULO_PERMISOS.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Correcciones en filtros de capítulos y permisos.
- **[CORRECCIONES_IMPLEMENTACION_DETALLADA.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Implementación detallada de correcciones.
- **[CORRECTIONS_SUMMARY.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Resumen de correcciones realizadas.
- **[debug-net.js](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Script de depuración de red.
- **[debug-resumen-layouts.js](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Depuración de layouts de resumen.
- **[DEPLOY_FIREBIRD.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Guía de despliegue para Firebird.
- **[DESGLOSE_OPERACIONES_FORMULA_BUILDER.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Desglose de operaciones en el constructor de fórmulas.
- **[DETALLE_COMPLETO_INSERCION_13_MODULOS.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Detalle completo de inserción en 13 módulos.
- **[DIAGNOSTICO_FLUJO_AUTORIZACION.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Diagnóstico del flujo de autorización.
- **[DOCUMENTACION_TECNICA.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Documentación técnica general.
- **[ESTRUCTURA_JERARQUICA_MODULOS.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Estructura jerárquica de módulos.
- **[ESTRUCTURA_OPERACIONES_RESUMEN_2025.json](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Estructura de operaciones de resumen para 2025 en JSON.
- **[EXPLICACION_PACKAGE_CONFIG.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Explicación de configuración de paquetes.
- **[FIX_CANCEL_BUTTONS.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Correcciones en botones de cancelar.
- **[FIX_ICONO_WINDOWS.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Corrección del ícono en Windows.
- **[FIX_TIMEOUT_CONEXION_REMOTA_2026.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Corrección de timeout en conexiones remotas para 2026.
- **[FLUJO_AUTORIZACION_Y_EDICION_EXPLICADO.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Explicación del flujo de autorización y edición.
- **[FLUJO_GUARDAR_CARGAR_BORRADORES.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Flujo para guardar y cargar borradores.
- **[GESTION_FIREBIRD_CONEXIONES.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Gestión de conexiones Firebird.
- **[GESTION_SECRETOS_AUTOMATICA.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Gestión automática de secretos.
- **[GUIA_INTEGRACION_WIZARD.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Guía para integración del asistente.
- **[GUIA_MEJORAS_GESTOR_PLANTILLAS.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Mejoras en el gestor de plantillas.
- **[GUIA_PUBLICAR_RELEASES.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Guía para publicar releases.
- **[GUIA_REORDENAMIENTO_PLANTILLAS.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Guía para reordenamiento de plantillas.
- **[GUIA_VALIDACION_OPERACIONES.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Guía para validación de operaciones.
- **[IMPLEMENTACION_COMPLETADA_INSERCION.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Implementación completada de inserción.
- **[IMPLEMENTACION_COMPLETADA.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Implementación general completada.
- **[IMPLEMENTACION_FRONTEND_CAPITULOS.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Implementación frontend de capítulos.
- **[importar-layouts-2026.js](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Script para importar layouts de 2026.

- **[insertar-cuentas-ppto-cdmx.sql](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Script SQL para insertar cuentas de presupuesto CDMX.
- **[insertar-presup-cuentas-cdmx.sql](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Script SQL para insertar presupuestos de cuentas CDMX.
- **[INSTRUCCIONES_USO.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Instrucciones de uso de la aplicación.
- **[JERARQUIA_OPERACIONES_SUMAS.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Jerarquía de operaciones y sumas.
- **[limpiar-cache-icono.ps1](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Script para limpiar caché de íconos.
- **[LOGICA_OPERACIONES_MODULOS.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Lógica de operaciones en módulos.
- **[MAPA_COMPLETO_OPERACIONES.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Mapa completo de operaciones.
- **[MAPEO_FORMULA_SQL_A_FRONTEND.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Mapeo de fórmulas SQL a frontend.
- **[MEJORAS_CENTRO_BORRADORES.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Mejoras en el centro de borradores.
- **[MIGRACION_CAPITULOS_COMPLETADA.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Migración de capítulos completada.
- **[MIGRACION_SQLITE_LAYOUTS.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Migración de layouts a SQLite.
- **[MODO_EDICION_INSERCION_FILAS.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Modo de edición para inserción de filas.
- **[OPERACIONES_POR_CELDA_TODOS_MODULOS.json](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Operaciones por celda en todos los módulos en JSON.
- **[OPERACIONES_TABLA_HTML.json](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Operaciones de tabla en HTML en JSON.
- **[PRUEBA_CORRECCIONES_FLUJO.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Pruebas de correcciones en flujo.
- **[PRUEBA_Y_VERIFICACION.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Pruebas y verificación general.
- **[REBUILD_NATIVE.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Guía para reconstruir módulos nativos.
- **[RECONTABILIZACION_CORREGIDA.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Recalculación corregida.
- **RECONSTRUIR_LAYOUTS.md** : Guía para reconstruir layouts.
- **RECONSTRUIR_LAYOUTS_2025.md** : Reconstrucción de layouts para 2025.
- **RECONSTRUIR_LAYOUTS_2026.md** : Reconstrucción de layouts para 2026.
- **RECONSTRUIR_LAYOUTS_COMPLETO.md** : Reconstrucción completa de layouts.
- **RECONSTRUIR_LAYOUTS_RESUMEN.md** : Reconstrucción de layouts de resumen.
- **RECONSTRUIR_LAYOUTS_RESUMEN_2025.md** : Reconstrucción de layouts de resumen para 2025.
- **RECONSTRUIR_LAYOUTS_RESUMEN_2026.md** : Reconstrucción de layouts de resumen para 2026.
- **RECONSTRUIR_LAYOUTS_RESUMEN_COMPLETO.md** : Reconstrucción completa de layouts de resumen.
- **RECONSTRUIR_LAYOUTS_RESUMEN_COMPLETO_2025.md** : Reconstrucción completa de layouts de resumen para 2025.
- **RECONSTRUIR_LAYOUTS_RESUMEN_COMPLETO_2026.md** : Reconstrucción completa de layouts de resumen para 2026.
- **[insertar-cuentas-ppto-cdmx.sql](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Script SQL para insertar cuentas de presupuesto CDMX.
- **[insertar-presup-cuentas-cdmx.sql](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Script SQL para insertar presupuestos de cuentas CDMX.
- **[INSTRUCCIONES_USO.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Instrucciones de uso de la aplicación.
- **[JERARQUIA_OPERACIONES_SUMAS.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Jerarquía de operaciones y sumas.
- **[limpiar-cache-icono.ps1](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Script para limpiar caché de íconos.
- **[LOGICA_OPERACIONES_MODULOS.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Lógica de operaciones en módulos.
- **[MAPA_COMPLETO_OPERACIONES.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Mapa completo de operaciones.
- **[MAPEO_FORMULA_SQL_A_FRONTEND.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Mapeo de fórmulas SQL a frontend.
- **[MEJORAS_CENTRO_BORRADORES.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Mejoras en el centro de borradores.
- **[MIGRACION_CAPITULOS_COMPLETADA.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Migración de capítulos completada.
- **[MIGRACION_SQLITE_LAYOUTS.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Migración de layouts a SQLite.
- **[MODO_EDICION_INSERCION_FILAS.md](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Modo de edición para inserción de filas.
- **[OPERACIONES_POR_CELDA_TODOS_MODULOS.json](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Operaciones por celda en todos los módulos en JSON.
- **[OPERACIONES_TABLA_HTML.json](vscode-file://vscode-app/c:/Users/Frida%20Sophia/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)** : Operaciones de tabla en HTML en JSON.

---

## CHECKLIST_PUBLICACION.md

_Fuente: `CHECKLIST_PUBLICACION.md`_

# ✅ Checklist Pre-Publicación

Usa esta lista antes de hacer tu repositorio público.

## 🔒 Seguridad Crítica

- [ ] **Ejecutar auditoría de seguridad**
  ```bash
  .\scripts\audit-security.ps1
  ```
  
- [ ] **Verificar `.gitignore` actualizado**
  - `.env` está ignorado
  - `datos/` está ignorado
  - `seed_users.json` está ignorado
  - `*.sqlite` está ignorado

- [ ] **Archivos `.example` creados**
  - `.env.example` existe ✅
  - `seed_users.example.json` existe ✅

- [ ] **NO hay contraseñas hardcodeadas**
  ```bash
  git grep -i "password.*=" -- "*.js" | Select-String -NotMatch "example"
  ```

- [ ] **NO hay tokens hardcodeados**
  ```bash
  git grep -iE "(token|secret|api[_-]?key).*=" -- "*.js"
  ```

- [ ] **NO hay rutas absolutas personales**
  ```bash
  git grep -E "C:\\\\Users\\\\|D:\\\\" -- "*.js"
  ```

---

## 📄 Documentación

- [ ] **README.md actualizado**
  - Instrucciones claras de instalación
  - Scripts documentados
  - Links a documentación adicional

- [ ] **SETUP_INICIAL.md completo** ✅
  - Paso a paso para nuevos usuarios
  - Troubleshooting común

- [ ] **SEGURIDAD.md creado** ✅
  - Guía de protección de datos
  - Cómo manejar secretos

- [ ] **LICENSE agregada** (opcional pero recomendado)
  - MIT, Apache 2.0, GPL, etc.

---

## 🗂️ Limpieza del Repositorio

- [ ] **Eliminar archivos innecesarios**
  - Builds antiguos en `dist/`, `out/`, `release/`
  - Logs (`*.log`)
  - Bases de datos de prueba

- [ ] **Verificar historial de Git**
  ```bash
  git log --all --oneline | Select-String -Pattern "password|secret|token"
  ```

- [ ] **Si encuentras secretos en historial, limpiar:**
  ```bash
  # Opción 1: BFG Repo-Cleaner (recomendado)
  bfg --delete-files .env
  
  # Opción 2: Git filter-branch
  git filter-branch --force --index-filter \
    "git rm --cached --ignore-unmatch .env" \
    --prune-empty --tag-name-filter cat -- --all
  ```

---

## 🔧 Configuración de GitHub

- [ ] **Crear repositorio en GitHub**
  - Nombre: `SummaCham`
  - Público ✅
  - Sin archivos iniciales (ya tienes el repo local)

- [ ] **Agregar remote**
  ```bash
  git remote add origin https://github.com/IustusRenidet/SummaCham.git
  ```

- [ ] **Push inicial**
  ```bash
  git branch -M main
  git push -u origin main
  ```

- [ ] **Configurar GitHub Releases**
  - Habilitar Releases
  - Crear primer release manual (v1.0.0)

- [ ] **Habilitar protecciones** (Recomendado)
  - Settings > Code security and analysis
  - ✅ Dependency graph
  - ✅ Dependabot alerts
  - ✅ Secret scanning

- [ ] **GitHub Actions Secrets** (si usas CI/CD)
  - Settings > Secrets and variables > Actions
  - Agregar: `GITHUB_TOKEN`

---

## 🎯 Actualizaciones Automáticas

- [ ] **package.json configurado**
  - `repository.url` apunta a tu repo público
  - `publish.provider` es "github"

- [ ] **GitHub Personal Access Token**
  - Creado en: https://github.com/settings/tokens
  - Permisos: `repo` (full control)
  - **NO committear el token** - usar como variable de entorno

- [ ] **Script de publicación probado**
  ```bash
  $env:GITHUB_TOKEN="tu_token"
  .\scripts\publish-update.ps1 -Version "1.0.0" -ReleaseNotes "Primera versión pública"
  ```

---

## 📦 Build de Producción

- [ ] **Probar build local**
  ```bash
  npm run build
  ```

- [ ] **Verificar ejecutable generado**
  - Instalador en `release/`
  - Tamaño razonable
  - Instalación exitosa
  - Aplicación funciona correctamente

- [ ] **Probar actualización**
  - Instalar versión 1.0.0
  - Publicar versión 1.0.1
  - Verificar que la app detecta y descarga la actualización

---

## 🧪 Testing Final

- [ ] **Clonar repo en carpeta limpia**
  ```bash
  cd C:\temp
  git clone https://github.com/IustusRenidet/SummaCham.git test-clean
  cd test-clean
  ```

- [ ] **Seguir SETUP_INICIAL.md paso a paso**
  - npm install funciona
  - .env.example se copia correctamente
  - seed_users.example.json se copia correctamente
  - npm start funciona
  - Login con usuario ICONET funciona

- [ ] **Verificar que NO hay errores de archivos faltantes**

---

## 📢 Comunicación

- [ ] **Crear README atractivo**
  - Badges de versión, licencia, etc.
  - Screenshots (opcional)
  - GIF demo (opcional)

- [ ] **Agregar CONTRIBUTING.md** (opcional)
  - Cómo reportar bugs
  - Cómo hacer pull requests

- [ ] **Agregar CODE_OF_CONDUCT.md** (opcional)
  - Estándar de comunidad

- [ ] **Crear primer Issue de ejemplo**
  - Ayuda a otros a entender el formato

---

## ⚠️ ANTES DEL PUSH FINAL

### Verificación de 3 puntos críticos:

```powershell
# 1. Verificar .gitignore
cat .gitignore | Select-String "\.env$"
cat .gitignore | Select-String "datos/"
cat .gitignore | Select-String "seed_users\.json"

# 2. Verificar que archivos sensibles NO están tracked
git ls-files | Select-String "\.env$"
git ls-files | Select-String "seed_users\.json"

# 3. Ejecutar auditoría final
.\scripts\audit-security.ps1
```

Si TODO está verde (✓), estás listo para:

```bash
git add .
git commit -m "Initial public release"
git push origin main
```

---

## 🎉 Post-Publicación

- [ ] **Anunciar en equipo**
- [ ] **Crear Wiki en GitHub** (opcional)
- [ ] **Configurar GitHub Pages** (para docs) (opcional)
- [ ] **Monitorear issues y pull requests**
- [ ] **Configurar notificaciones de seguridad**

---

## 🆘 Si Algo Sale Mal

### Commiteaste un secreto por accidente:

1. **NO entres en pánico**
2. **Rota el secreto inmediatamente** (cambia contraseña, regenera token)
3. **Limpia el historial:**
   ```bash
   bfg --replace-text passwords.txt
   git reflog expire --expire=now --all
   git gc --prune=now --aggressive
   git push origin --force --all
   ```
4. **Reporta en GitHub** que hubo un leak (si es necesario)

### El repo es muy grande:

```bash
# Ver archivos más grandes
git rev-list --objects --all | 
  git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' |
  Select-String "blob" | 
  Sort-Object {[int]($_ -split " ")[2]} -Descending |
  Select-Object -First 10
```

---

**¿Listo?** Ejecuta el audit y ¡adelante! 🚀

---

## CONFIGURACION_ASAR_COMPLETA.md

_Fuente: `CONFIGURACION_ASAR_COMPLETA.md`_

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

---

## CONFIGURACION_ENTORNO.md

_Fuente: `CONFIGURACION_ENTORNO.md`_

# 🔧 Configuración de Variables de Entorno

Este proyecto usa variables de entorno para configurar diferentes modos de ejecución (desarrollo vs producción).

## 📂 Archivos de Configuración

| Archivo | Propósito | Uso |
|---------|-----------|-----|
| `.env.example` | Plantilla de ejemplo | Documentación de variables disponibles |
| `.env.development` | Desarrollo local | Puerto Firebird 3050 (directo) |
| `.env.production` | Producción | Puerto Firebird 15350 (túnel TCP) |
| `.env` | Activo actual | Copia de `.env.development` o `.env.production` |

## 🚀 Uso

### Desarrollo Local (Puerto 3050)

```bash
# Opción 1: Usar script con NODE_ENV
npm start

# Opción 2: Copiar archivo manualmente
cp .env.development .env
npm start
```

### Producción (Puerto 15350 - Túnel TCP)

```bash
# Opción 1: Usar script con NODE_ENV
npm run start:prod

# Opción 2: Copiar archivo manualmente
cp .env.production .env
npm start

# Opción 3: Empaquetar (usa .env.production automáticamente)
npm run dist
```

## ⚙️ Variables Disponibles

```bash
# Modo de ejecución
NODE_ENV=development          # 'development' | 'production'

# Conexión Firebird
FIREBIRD_HOST=127.0.0.1      # Host del servidor Firebird
FIREBIRD_PORT=3050           # Puerto (3050=local, 15350=túnel)
FIREBIRD_USER=sysdba         # Usuario de Firebird
FIREBIRD_PASSWORD=masterkey  # Contraseña de Firebird

# Servidor HTTP
SERVER_PORT=3005             # Puerto del servidor Node.js
```

## 🔄 Cambio Rápido de Modo

### A Desarrollo (3050):
```powershell
Copy-Item .env.development .env
```

### A Producción (15350):
```powershell
Copy-Item .env.production .env
```

## 🏗️ Build/Empaquetado

Al empaquetar la aplicación, el sistema automáticamente:

1. Detecta si está empaquetado (`app.isPackaged`)
2. Si está empaquetado → usa `.env.production`
3. Si está en desarrollo → usa `.env.development`
4. Aplica valores por defecto si no encuentra archivo

## 🔐 Seguridad

- ✅ Archivos `.env` y `.env.*` están en `.gitignore`
- ✅ Solo `.env.example` se sube al repositorio
- ✅ Nunca subas credenciales reales al repositorio

## 📝 Scripts NPM Actualizados

| Script | Modo | Descripción |
|--------|------|-------------|
| `npm start` | Development | Inicia app en modo desarrollo |
| `npm run start:prod` | Production | Inicia app en modo producción |
| `npm run server` | Development | Solo servidor backend (dev) |
| `npm run server:prod` | Production | Solo servidor backend (prod) |
| `npm run dist` | Production | Empaqueta para producción |

## 🐛 Troubleshooting

### Error: "Cannot find module './src/config/env-config'"
```bash
# Asegúrate de que el archivo existe
ls src/config/env-config.js
```

### Puerto Firebird incorrecto
```bash
# Verifica tu archivo .env actual
cat .env

# O usa el script correcto
npm start          # → 3050
npm run start:prod # → 15350
```

### Variables no se cargan
```bash
# Reinstala cross-env
npm install cross-env --save-dev

# Verifica que los archivos .env.* existan
ls .env.*
```

## 📦 Estructura de Archivos

```
SummaCham/
├── .env                    # Activo (ignorado en git)
├── .env.example            # Plantilla (en git)
├── .env.development        # Desarrollo (empaquetado)
├── .env.production         # Producción (empaquetado)
├── main.js                 # Carga env-config
├── src/
│   ├── config/
│   │   └── env-config.js   # Sistema de carga de .env
│   ├── services/
│   │   └── firebirdService.js  # Usa variables de entorno
│   └── server.js           # Usa variables de entorno
└── package.json            # Scripts con cross-env
```

## ✅ Beneficios

- ✅ Un solo comando para cambiar de modo
- ✅ No más hardcodeo de puertos
- ✅ Configuración centralizada
- ✅ Seguridad mejorada (credenciales en .env)
- ✅ Empaquetado automático según modo

---

## DEPLOY_FIREBIRD.md

_Fuente: `DEPLOY_FIREBIRD.md`_

# 🚀 Despliegue en Producción - PanelAMCHAM

## ⚠️ PROBLEMA: Firebird no accesible desde servidor remoto

**Síntoma**: Error `ECONNREFUSED 127.0.0.1:3050` en producción

**Causa**: El servidor Node.js está en `192.99.189.113` pero intenta conectarse a Firebird en `127.0.0.1:3050` (localhost), que NO existe en ese servidor.

---

## 📋 Soluciones Posibles

### **Opción 1: Firebird en la misma máquina** (Recomendado)

Si Aspel COI y Firebird están **instalados en el servidor `192.99.189.113`**:

1. Verificar que Firebird esté corriendo:
   ```bash
   netstat -an | grep 3050
   # O en PowerShell
   Get-NetTCPConnection -LocalPort 3050
   ```

2. Configurar variables de entorno:
   ```bash
   # En el servidor 192.99.189.113
   export FIREBIRD_HOST=127.0.0.1
   export FIREBIRD_PORT=3050
   ```

3. La aplicación empaquetada funcionará automáticamente

---

### **Opción 2: Firebird en otra máquina** (Requiere configuración de red)

Si Firebird está en **otra máquina** (ej: `192.168.1.100`):

#### A. Configurar Firebird para aceptar conexiones remotas

1. Editar `firebird.conf`:
   ```ini
   RemoteServicePort = 3050
   RemoteBindAddress = 0.0.0.0
   ```

2. Reiniciar servicio Firebird

3. Abrir firewall:
   ```bash
   # Windows Firewall
   netsh advfirewall firewall add rule name="Firebird" dir=in action=allow protocol=TCP localport=3050
   ```

#### B. Configurar variables de entorno en servidor Node.js

En el servidor `192.99.189.113`, crear archivo `.env`:

```bash
FIREBIRD_HOST=192.168.1.100  # IP donde está Firebird
FIREBIRD_PORT=3050
FIREBIRD_USER=sysdba
FIREBIRD_PASSWORD=masterkey
```

---

### **Opción 3: Túnel SSH reverso** (Para Firebird local)

Si Firebird está en tu **máquina local** y el servidor en la nube:

```bash
# En tu máquina local (donde está Firebird)
ssh -R 3050:localhost:3050 usuario@192.99.189.113

# Esto expone tu Firebird local al servidor remoto vía túnel
```

En el servidor, configurar:
```bash
export FIREBIRD_HOST=127.0.0.1
export FIREBIRD_PORT=3050
```

---

## 🔧 Verificación

### 1. Probar conexión Firebird

```bash
# Desde el servidor Node.js, probar conectividad
telnet FIREBIRD_HOST 3050
# O
nc -zv FIREBIRD_HOST 3050
```

### 2. Verificar variables de entorno

```javascript
// En main.js verás este log al iniciar:
console.log(`Firebird: ${process.env.FIREBIRD_HOST}:${process.env.FIREBIRD_PORT}`);
```

### 3. Probar endpoint

```bash
curl http://localhost:3005/api/empresas
```

---

## 📦 Empaquetar para Producción

### 1. Configurar host de Firebird

Editar `main.js` línea 181:

```javascript
if (!process.env.FIREBIRD_HOST) {
  process.env.FIREBIRD_HOST = '192.168.1.100'; // Cambiar a IP correcta
}
```

### 2. Build

```bash
npm run dist
```

### 3. Copiar al servidor

```bash
scp dist/PanelAMCHAM-1.0.1-x64.exe usuario@192.99.189.113:/opt/panelamcham/
```

### 4. Ejecutar en servidor

```bash
# Configurar variables de entorno
export FIREBIRD_HOST=127.0.0.1
export FIREBIRD_PORT=3050

# Ejecutar
./PanelAMCHAM-1.0.1-x64.exe
```

---

## 🐛 Troubleshooting

### Error: `ECONNREFUSED 127.0.0.1:3050`

**Solución**: Firebird no está corriendo o no es accesible

```bash
# Verificar si Firebird está corriendo
ps aux | grep firebird
# O en Windows
Get-Process | Where-Object {$_.ProcessName -like "*firebird*"}

# Verificar puerto
netstat -an | grep 3050
```

### Error: `connect ETIMEDOUT`

**Solución**: Firewall bloqueando conexión

```bash
# Verificar firewall
iptables -L -n | grep 3050

# Abrir puerto
ufw allow 3050/tcp
```

### Error: `Your user name and password are not defined`

**Solución**: Credenciales incorrectas

```bash
# Verificar credenciales en .env
FIREBIRD_USER=sysdba
FIREBIRD_PASSWORD=masterkey  # Cambiar si usas otra contraseña
```

---

## ✅ Checklist de Despliegue

- [ ] Firebird instalado y corriendo
- [ ] Puerto 3050 abierto en firewall
- [ ] Variables de entorno configuradas (`FIREBIRD_HOST`, `FIREBIRD_PORT`)
- [ ] Bases de datos Aspel COI accesibles
- [ ] Aplicación empaquetada con `npm run dist`
- [ ] Túnel HTTPS configurado (cloudflare/ngrok)
- [ ] Servidor Express corriendo en puerto 3005
- [ ] Probar conexión: `curl http://localhost:3005/api/salud`

---

## 📊 Arquitectura Actual

```
┌─────────────────────────────┐
│  Usuario                     │
│  https://panelamcham.        │
│  iconetcloud.com.mx          │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  Túnel HTTPS                 │
│  cloudflare/ngrok            │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  Servidor Node.js            │
│  192.99.189.113:3005         │
│  (Express + Electron)        │
└──────────┬──────────────────┘
           │
           ▼ AQUÍ FALLA si Firebird no es accesible
┌─────────────────────────────┐
│  Firebird                    │
│  ???:3050                    │ ← Configurar IP correcta
│  (Aspel COI)                 │
└─────────────────────────────┘
```

---

## 🎯 Solución Rápida

**Si estás empaquetando para el mismo servidor donde está Firebird**:

1. Asegúrate que Firebird esté corriendo:
   ```bash
   Get-Service | Where-Object {$_.Name -like "*firebird*"}
   ```

2. No cambies nada, usa valores por defecto (`127.0.0.1:3050`)

3. Empaqueta y ejecuta:
   ```bash
   npm run dist
   dist/PanelAMCHAM-1.0.1-x64.exe
   ```

**Si Firebird está en otra máquina**:

1. Edita `main.js` línea 181 con la IP correcta

2. O configura variable de entorno antes de ejecutar:
   ```bash
   $env:FIREBIRD_HOST = "192.168.1.100"
   .\PanelAMCHAM-1.0.1-x64.exe
   ```

---

## DOCUMENTACION_COMPLETA.md

_Fuente: `DOCUMENTACION_COMPLETA.md`_

# Documentación Completa de Archivos - SummaCham

## Introducción

SummaCham es una aplicación de escritorio para gestión financiera empresarial desarrollada con Electron, Node.js y bases de datos Firebird/SQLite. Esta documentación detalla cada archivo del proyecto, su propósito, funcionalidad y relaciones con otros componentes.

**Nota**: Esta documentación excluye archivos de `node_modules/` ya que son dependencias de terceros. Se enfoca en el código fuente y archivos de configuración del proyecto.

## Archivos de Raíz

### main.js
**Ubicación**: `main.js`  
**Tipo**: JavaScript (Electron Main Process)  
**Propósito**: Punto de entrada principal de la aplicación Electron. Maneja la creación de ventanas, actualizaciones automáticas, bandeja del sistema y gestión del ciclo de vida de la aplicación.  
**Funcionalidades principales**:
- Creación y configuración de BrowserWindow
- Sistema de actualizaciones con electron-updater
- Auto-lanzamiento al iniciar Windows
- Gestión de instancia única
- Comunicación IPC entre procesos
**Dependencias**: Electron APIs, electron-updater, auto-launch

### package.json
**Ubicación**: `package.json`  
**Tipo**: JSON (Configuración npm)  
**Propósito**: Define metadatos del proyecto, dependencias, scripts y configuración de empaquetado.  
**Estructura clave**:
- `scripts`: Comandos para desarrollo, construcción y distribución
- `dependencies`: Librerías runtime (electron, express, sqlite3, etc.)
- `devDependencies`: Herramientas de desarrollo
- `build`: Configuración de electron-builder para distribución
**Scripts importantes**:
- `start`: Desarrollo con hot-reload
- `dist`: Construir instalador
- `publish`: Publicar release en GitHub

### README.md
**Ubicación**: `README.md`  
**Tipo**: Markdown (Documentación)  
**Propósito**: Documentación principal del proyecto con instrucciones de instalación, uso y características.  
**Secciones**:
- Descripción del proyecto
- Requisitos del sistema
- Guía de instalación paso a paso
- Comandos disponibles
- Características principales
- Información de contribución

### .env.development / .env.production
**Ubicación**: `.env.*`  
**Tipo**: Variables de entorno  
**Propósito**: Configuración de ambiente específica para desarrollo y producción.  
**Variables comunes**:
- `NODE_ENV`: Ambiente de ejecución
- `PORT`: Puerto del servidor
- `DB_PATH`: Ruta a base de datos SQLite
- `FIREBIRD_*`: Configuración de conexión Firebird
- `JWT_SECRET`: Clave para tokens JWT

## Directorio src/ (Backend)

### server.js
**Ubicación**: `src/server.js`  
**Tipo**: JavaScript (Node.js/Express)  
**Propósito**: Servidor principal que maneja todas las rutas API, middlewares y configuración del backend.  
**Funcionalidades**:
- Configuración de Express con CORS
- Rutas para autenticación, usuarios, presupuestos, etc.
- Middleware de autenticación JWT
- Servir archivos estáticos del frontend
- Gestión de sesiones y permisos
**Rutas principales**:
- `/api/auth`: Autenticación
- `/api/usuarios`: Gestión de usuarios
- `/api/presupuestos`: Datos presupuestarios

### config/empresas.js
**Ubicación**: `src/config/empresas.js`  
**Tipo**: JavaScript (Configuración)  
**Propósito**: Define la configuración de empresas, módulos disponibles y permisos por rol.  
**Estructura**:
```javascript
{
  empresa1: {
    nombre: 'Empresa 1',
    modulos: ['RESUMEN', 'RH', 'NOMINA'],
    permisos: {
      admin: ['*'],
      user: ['read', 'write']
    }
  }
}
```

### config/modulos.js
**Ubicación**: `src/config/modulos.js`  
**Tipo**: JavaScript (Configuración)  
**Propósito**: Define la estructura jerárquica de módulos y sus propiedades.  
**Contenido**: Configuración de módulos como SUMMARY, RESUMEN, RH, Nómina, etc.

### config/seed_users.json
**Ubicación**: `src/config/seed_users.json`  
**Tipo**: JSON (Datos iniciales)  
**Propósito**: Usuarios por defecto para inicializar el sistema.  
**Estructura**:
```json
[
  {
    "username": "admin",
    "password": "hashed_password",
    "role": "admin",
    "empresa": "empresa1"
  }
]
```

### db/sqlite.js
**Ubicación**: `src/db/sqlite.js`  
**Tipo**: JavaScript (Base de datos)  
**Propósito**: Wrapper para operaciones con SQLite usando better-sqlite3.  
**Funcionalidades**:
- Conexión a BD
- Operaciones CRUD síncronas
- Gestión de transacciones
- Inicialización de tablas

### db/nedb.js
**Ubicación**: `src/db/nedb.js`  
**Tipo**: JavaScript (Base de datos alternativa)  
**Propósito**: Implementación alternativa usando NeDB (MongoDB embebido).  
**Uso**: Para entornos que requieren NoSQL embebido.

### middleware/auth.js
**Ubicación**: `src/middleware/auth.js`  
**Tipo**: JavaScript (Middleware)  
**Propósito**: Middleware de autenticación JWT para proteger rutas.  
**Funcionalidades**:
- Verificación de tokens
- Extracción de usuario de token
- Manejo de errores de autenticación

### routes/auth.js
**Ubicación**: `src/routes/auth.js`  
**Tipo**: JavaScript (Rutas API)  
**Propósito**: Endpoints para autenticación de usuarios.  
**Endpoints**:
- `POST /login`: Autenticación
- `POST /logout`: Cierre de sesión
- `POST /refresh`: Renovación de token

### routes/usuarios.js
**Ubicación**: `src/routes/usuarios.js`  
**Tipo**: JavaScript (Rutas API)  
**Propósito**: Gestión CRUD de usuarios.  
**Endpoints**:
- `GET /`: Listar usuarios
- `POST /`: Crear usuario
- `PUT /:id`: Actualizar usuario
- `DELETE /:id`: Eliminar usuario

### routes/presupuestos.js
**Ubicación**: `src/routes/presupuestos.js`  
**Tipo**: JavaScript (Rutas API)  
**Propósito**: Operaciones con datos presupuestarios.  
**Funcionalidades**:
- Obtener datos por módulo/empresa
- Guardar cambios
- Aplicar operaciones

### routes/layouts.js
**Ubicación**: `src/routes/layouts.js`  
**Tipo**: JavaScript (Rutas API)  
**Propósito**: Gestión de layouts y plantillas.  
**Endpoints**:
- `GET /:empresa/:modulo`: Obtener layout
- `PUT /:empresa/:modulo`: Guardar layout

### routes/borradores.js
**Ubicación**: `src/routes/borradores.js`  
**Tipo**: JavaScript (Rutas API)  
**Propósito**: Sistema de borradores para trabajo no guardado.  
**Funcionalidades**:
- Guardar borrador automáticamente
- Recuperar borrador
- Limpiar borradores antiguos

### routes/comentarios.js
**Ubicación**: `src/routes/comentarios.js`  
**Tipo**: JavaScript (Rutas API)  
**Propósito**: Sistema de comentarios en celdas y documentos.  
**Funcionalidades**:
- Agregar comentarios
- Obtener comentarios por documento
- Marcar como leídos

### routes/notificaciones.js
**Ubicación**: `src/routes/notificaciones.js`  
**Tipo**: JavaScript (Rutas API)  
**Propósito**: Sistema de notificaciones push.  
**Tipos de notificaciones**:
- Aprobaciones pendientes
- Comentarios nuevos
- Cambios en documentos

### routes/empresas.js
**Ubicación**: `src/routes/empresas.js`  
**Tipo**: JavaScript (Rutas API)  
**Propósito**: Gestión de configuración por empresa.

### routes/cuentas.js
**Ubicación**: `src/routes/cuentas.js`  
**Tipo**: JavaScript (Rutas API)  
**Propósito**: Operaciones con cuentas contables.

### routes/estructuraRoutes.js
**Ubicación**: `src/routes/estructuraRoutes.js`  
**Tipo**: JavaScript (Rutas API)  
**Propósito**: Gestión de estructura jerárquica de datos.

### routes/firebird-config.js
**Ubicación**: `src/routes/firebird-config.js`  
**Tipo**: JavaScript (Rutas API)  
**Propósito**: Configuración de conexiones Firebird.

### routes/graficas-config.js
**Ubicación**: `src/routes/graficas-config.js`  
**Tipo**: JavaScript (Rutas API)  
**Propósito**: Configuración de gráficas y visualizaciones.

### routes/insercion.js
**Ubicación**: `src/routes/insercion.js`  
**Tipo**: JavaScript (Rutas API)  
**Propósito**: Inserción de nuevos elementos con validación.

### routes/modulos.js
**Ubicación**: `src/routes/modulos.js`  
**Tipo**: JavaScript (Rutas API)  
**Propósito**: Gestión de módulos disponibles.

### routes/perfil.js
**Ubicación**: `src/routes/perfil.js`  
**Tipo**: JavaScript (Rutas API)  
**Propósito**: Gestión de perfiles de usuario.

### routes/planeacion.js
**Ubicación**: `src/routes/planeacion.js`  
**Tipo**: JavaScript (Rutas API)  
**Propósito**: Funciones de planificación presupuestaria.

### routes/reportes.js
**Ubicación**: `src/routes/reportes.js`  
**Tipo**: JavaScript (Rutas API)  
**Propósito**: Generación de reportes.

### routes/saldos.js
**Ubicación**: `src/routes/saldos.js`  
**Tipo**: JavaScript (Rutas API)  
**Propósito**: Gestión de saldos contables.

### services/backupService.js
**Ubicación**: `src/services/backupService.js`  
**Tipo**: JavaScript (Servicio)  
**Propósito**: Sistema de backups automáticos de base de datos.  
**Funcionalidades**:
- Backups programados
- Verificación de integridad
- Limpieza automática de backups antiguos
- Compresión opcional

### services/borradoresService.js
**Ubicación**: `src/services/borradoresService.js`  
**Tipo**: JavaScript (Servicio)  
**Propósito**: Gestión de borradores de trabajo.  
**Funcionalidades**:
- Auto-guardado
- Recuperación de borradores
- Sincronización entre sesiones

### services/comentariosService.js
**Ubicación**: `src/services/comentariosService.js`  
**Tipo**: JavaScript (Servicio)  
**Propósito**: Lógica de negocio para comentarios.

### services/comitesService.js
**Ubicación**: `src/services/comitesService.js`  
**Tipo**: JavaScript (Servicio)  
**Propósito**: Gestión de comités y aprobaciones.

### services/firebirdConfigService.js
**Ubicación**: `src/services/firebirdConfigService.js`  
**Tipo**: JavaScript (Servicio)  
**Propósito**: Configuración de conexiones Firebird.

### services/firebirdService.js
**Ubicación**: `src/services/firebirdService.js`  
**Tipo**: JavaScript (Servicio)  
**Propósito**: Conexión y operaciones con Firebird.  
**Funcionalidades**:
- Conexión a BD Firebird
- Ejecución de queries
- Mapeo de resultados

### services/layoutConfigStore.js
**Ubicación**: `src/services/layoutConfigStore.js`  
**Tipo**: JavaScript (Servicio)  
**Propósito**: Almacenamiento de configuraciones de layout.

### services/layoutSeeder.js
**Ubicación**: `src/services/layoutSeeder.js`  
**Tipo**: JavaScript (Servicio)  
**Propósito**: Inicialización de layouts por defecto.

### services/layoutService.js
**Ubicación**: `src/services/layoutService.js`  
**Tipo**: JavaScript (Servicio)  
**Propósito**: Operaciones CRUD con layouts.

### services/layoutsService.js
**Ubicación**: `src/services/layoutsService.js`  
**Tipo**: JavaScript (Servicio)  
**Propósito**: Servicio adicional para layouts.

### services/modulosService.js
**Ubicación**: `src/services/modulosService.js`  
**Tipo**: JavaScript (Servicio)  
**Propósito**: Gestión de módulos del sistema.

### services/notificacionesService.js
**Ubicación**: `src/services/notificacionesService.js`  
**Tipo**: JavaScript (Servicio)  
**Propósito**: Envío y gestión de notificaciones.

### services/permisosService.js
**Ubicación**: `src/services/permisosService.js`  
**Tipo**: JavaScript (Servicio)  
**Propósito**: Control de permisos por usuario/rol.

### services/planeacionCuentasService.js
**Ubicación**: `src/services/planeacionCuentasService.js`  
**Tipo**: JavaScript (Servicio)  
**Propósito**: Lógica de cuentas en planificación.

### services/presupuestosMetadataService.js
**Ubicación**: `src/services/presupuestosMetadataService.js`  
**Tipo**: JavaScript (Servicio)  
**Propósito**: Metadatos de presupuestos.

### services/presupuestosService.js
**Ubicación**: `src/services/presupuestosService.js`  
**Tipo**: JavaScript (Servicio)  
**Propósito**: Operaciones con datos presupuestarios.

### services/saldosMetadataService.js
**Ubicación**: `src/services/saldosMetadataService.js`  
**Tipo**: JavaScript (Servicio)  
**Propósito**: Metadatos de saldos.

### services/saldosResumenHelper.js
**Ubicación**: `src/services/saldosResumenHelper.js`  
**Tipo**: JavaScript (Servicio)  
**Propósito**: Helpers para resúmenes de saldos.

### services/saldosService.js
**Ubicación**: `src/services/saldosService.js`  
**Tipo**: JavaScript (Servicio)  
**Propósito**: Gestión de saldos contables.

### services/summaryService.js
**Ubicación**: `src/services/summaryService.js`  
**Tipo**: JavaScript (Servicio)  
**Propósito**: Servicio para operaciones de resumen.

### services/usuariosPolicy.js
**Ubicación**: `src/services/usuariosPolicy.js`  
**Tipo**: JavaScript (Servicio)  
**Propósito**: Políticas de acceso para usuarios.

### services/engines/resumenEngine.js
**Ubicación**: `src/services/engines/resumenEngine.js`  
**Tipo**: JavaScript (Motor de cálculo)  
**Propósito**: Motor para cálculos de resúmenes.  
**Funcionalidades**:
- Aplicación de operaciones matemáticas
- Cálculo de totales
- Validación de fórmulas

### services/engines/summaryEngine.js
**Ubicación**: `src/services/engines/summaryEngine.js`  
**Tipo**: JavaScript (Motor de cálculo)  
**Propósito**: Motor para cálculos de summary.

### services/reportes/operativoExcelService.js
**Ubicación**: `src/services/reportes/operativoExcelService.js`  
**Tipo**: JavaScript (Servicio de reportes)  
**Propósito**: Generación de reportes Excel operativos.

### services/reportes/planeacionReportesEngine.js
**Ubicación**: `src/services/reportes/planeacionReportesEngine.js`  
**Tipo**: JavaScript (Motor de reportes)  
**Propósito**: Motor para reportes de planificación.

### services/reportes/resumenExcelService.js
**Ubicación**: `src/services/reportes/resumenExcelService.js`  
**Tipo**: JavaScript (Servicio de reportes)  
**Propósito**: Generación de reportes Excel de resúmenes.

### utils/betterSqlite3Manager.js
**Ubicación**: `src/utils/betterSqlite3Manager.js`  
**Tipo**: JavaScript (Utilidad)  
**Propósito**: Wrapper avanzado para better-sqlite3.

### utils/csvLoader.js
**Ubicación**: `src/utils/csvLoader.js`  
**Tipo**: JavaScript (Utilidad)  
**Propósito**: Carga y procesamiento de archivos CSV.

### utils/secretsManager.js
**Ubicación**: `src/utils/secretsManager.js`  
**Tipo**: JavaScript (Utilidad)  
**Propósito**: Gestión segura de secrets y contraseñas.

## Directorio vistas/ (Frontend)

### app.html
**Ubicación**: `vistas/app.html`  
**Tipo**: HTML (Página principal)  
**Propósito**: Página principal de la aplicación con navegación y layout base.  
**Estructura**:
- Header con navegación
- Sidebar con módulos
- Área principal de contenido
- Footer

### login.html
**Ubicación**: `vistas/login.html`  
**Tipo**: HTML (Autenticación)  
**Propósito**: Formulario de login.  
**Funcionalidades**:
- Validación de credenciales
- Recordar sesión
- Recuperación de contraseña

### usuarios.html
**Ubicación**: `vistas/usuarios.html`  
**Tipo**: HTML (Administración)  
**Propósito**: Gestión de usuarios del sistema.

### perfil.html
**Ubicación**: `vistas/perfil.html`  
**Tipo**: HTML (Usuario)  
**Propósito**: Perfil y configuración del usuario actual.

### plantillas.html
**Ubicación**: `vistas/plantillas.html`  
**Tipo**: HTML (Configuración)  
**Propósito**: Gestión de plantillas y layouts.

### firebird-config.html
**Ubicación**: `vistas/firebird-config.html`  
**Tipo**: HTML (Configuración)  
**Propósito**: Configuración de conexiones Firebird.

### graficas-config.html
**Ubicación**: `vistas/graficas-config.html`  
**Tipo**: HTML (Configuración)  
**Propósito**: Configuración de gráficas.

### crear_usuario.html
**Ubicación**: `vistas/crear_usuario.html`  
**Tipo**: HTML (Administración)  
**Propósito**: Formulario para crear nuevos usuarios.

### reseed-operaciones.html
**Ubicación**: `vistas/reseed-operaciones.html`  
**Tipo**: HTML (Mantenimiento)  
**Propósito**: Re-inicialización de operaciones.

### Módulos específicos (RESUMEN.html, RH.html, etc.)
**Ubicación**: `vistas/[MODULO].html`  
**Tipo**: HTML (Módulos)  
**Propósito**: Interfaces específicas para cada módulo presupuestario.  
**Módulos disponibles**:
- RESUMEN.html
- RH.html
- Nomina.html
- Comités.html
- Comunicación.html
- Dirección.html
- Eventos.html
- Finanzas.html
- GastosGenerales.html
- Gtos_Corporativos.html
- Membresía.html
- Serv_Membresía.html
- T&IC.html
- VPE.html

### componentes/flujo-autorizacion.html
**Ubicación**: `vistas/componentes/flujo-autorizacion.html`  
**Tipo**: HTML (Componente)  
**Propósito**: Componente reutilizable para flujo de autorizaciones.

### css/estilos.css
**Ubicación**: `vistas/css/estilos.css`  
**Tipo**: CSS (Estilos globales)  
**Propósito**: Estilos principales de la aplicación.

### css/estilos específicos
**Ubicación**: `vistas/css/*.css`  
**Tipo**: CSS (Estilos específicos)  
**Propósito**: Estilos para componentes específicos como wizard, gráficas, etc.

### js/sesion.js
**Ubicación**: `vistas/js/sesion.js`  
**Tipo**: JavaScript (Gestión de sesión)  
**Propósito**: Manejo de autenticación y sesiones en el frontend.

### js/verificar-sesion.js
**Ubicación**: `vistas/js/verificar-sesion.js`  
**Tipo**: JavaScript (Utilidad)  
**Propósito**: Verificación automática de sesión activa.

### js/operativo-sidebar.js
**Ubicación**: `vistas/js/operativo-sidebar.js`  
**Tipo**: JavaScript (UI)  
**Propósito**: Gestión de la barra lateral operativa.

### js/plantillas.js
**Ubicación**: `vistas/js/plantillas.js`  
**Tipo**: JavaScript (Gestión de plantillas)  
**Propósito**: Lógica para gestión de plantillas.

### js/plantillas-reordenar.js
**Ubicación**: `vistas/js/plantillas-reordenar.js`  
**Tipo**: JavaScript (UI)  
**Propósito**: Funcionalidad de reordenamiento de plantillas.

### js/plantillas-graficas.js
**Ubicación**: `vistas/js/plantillas-graficas.js`  
**Tipo**: JavaScript (Visualización)  
**Propósito**: Gráficas relacionadas con plantillas.

### js/graficas-resumen.js
**Ubicación**: `vistas/js/graficas-resumen.js`  
**Tipo**: JavaScript (Visualización)  
**Propósito**: Gráficas para módulos de resumen.

### js/graficas-config.js
**Ubicación**: `vistas/js/graficas-config.js`  
**Tipo**: JavaScript (Configuración)  
**Propósito**: Configuración de gráficas.

### js/gastos-generales-graficas.js
**Ubicación**: `vistas/js/gastos-generales-graficas.js`  
**Tipo**: JavaScript (Visualización)  
**Propósito**: Gráficas específicas para gastos generales.

### js/firebird-config.js
**Ubicación**: `vistas/js/firebird-config.js`  
**Tipo**: JavaScript (Configuración)  
**Propósito**: Interfaz para configuración Firebird.

### js/insertion-wizard.js
**Ubicación**: `vistas/js/insertion-wizard.js`  
**Tipo**: JavaScript (Wizard)  
**Propósito**: Asistente inteligente para inserción de datos con validación jerárquica.

### js/formula-builder.js
**Ubicación**: `vistas/js/formula-builder.js`  
**Tipo**: JavaScript (Constructor)  
**Propósito**: Constructor visual de fórmulas matemáticas.

### js/context-menu-manager.js
**Ubicación**: `vistas/js/context-menu-manager.js`  
**Tipo**: JavaScript (UI)  
**Propósito**: Gestión de menús contextuales.

### js/context-menu-wizard.js
**Ubicación**: `vistas/js/context-menu-wizard.js`  
**Tipo**: JavaScript (UI)  
**Propósito**: Menús contextuales para wizard.

### js/cuentas-data.js
**Ubicación**: `vistas/js/cuentas-data.js`  
**Tipo**: JavaScript (Datos)  
**Propósito**: Gestión de datos de cuentas.

### js/cuentas-modulo.js
**Ubicación**: `vistas/js/cuentas-modulo.js`  
**Tipo**: JavaScript (Módulo)  
**Propósito**: Lógica específica del módulo de cuentas.

### js/export-utils.js
**Ubicación**: `vistas/js/export-utils.js`  
**Tipo**: JavaScript (Utilidad)  
**Propósito**: Utilidades para exportación de datos.

### js/flujo-autorizacion.js
**Ubicación**: `vistas/js/flujo-autorizacion.js`  
**Tipo**: JavaScript (Workflow)  
**Propósito**: Gestión del flujo de autorizaciones.

### js/init-modulo-planeacion.js
**Ubicación**: `vistas/js/init-modulo-planeacion.js`  
**Tipo**: JavaScript (Inicialización)  
**Propósito**: Inicialización del módulo de planificación.

### js/insertion-validator.js
**Ubicación**: `vistas/js/insertion-validator.js`  
**Tipo**: JavaScript (Validación)  
**Propósito**: Validación de inserciones de datos.

### js/layout-controls.js
**Ubicación**: `vistas/js/layout-controls.js`  
**Tipo**: JavaScript (UI)  
**Propósito**: Controles para gestión de layouts.

### js/logica-resumen.js
**Ubicación**: `vistas/js/logica-resumen.js`  
**Tipo**: JavaScript (Lógica)  
**Propósito**: Lógica específica de resúmenes.

### js/modo-edicion-presupuesto.js
**Ubicación**: `vistas/js/modo-edicion-presupuesto.js`  
**Tipo**: JavaScript (Edición)  
**Propósito**: Gestión del modo edición para presupuestos.

### js/modulo-generico.js
**Ubicación**: `vistas/js/modulo-generico.js`  
**Tipo**: JavaScript (Genérico)  
**Propósito**: Funcionalidades comunes para módulos.

### js/operation-debugger.js
**Ubicación**: `vistas/js/operation-debugger.js`  
**Tipo**: JavaScript (Debug)  
**Propósito**: Depuración de operaciones.

### js/operation-sync.js
**Ubicación**: `vistas/js/operation-sync.js`  
**Tipo**: JavaScript (Sincronización)  
**Propósito**: Sincronización de operaciones.

### js/planeacion-modulo-vista.js
**Ubicación**: `vistas/js/planeacion-modulo-vista.js`  
**Tipo**: JavaScript (Vista)  
**Propósito**: Vista del módulo de planificación.

### js/presupuesto-vista.js
**Ubicación**: `vistas/js/presupuesto-vista.js`  
**Tipo**: JavaScript (Vista)  
**Propósito**: Vista genérica de presupuestos.

### js/react-app.js
**Ubicación**: `vistas/js/react-app.js`  
**Tipo**: JavaScript (React)  
**Propósito**: Aplicación React integrada.

### js/react-app.jsx
**Ubicación**: `vistas/js/react-app.jsx`  
**Tipo**: JSX (React)  
**Propósito**: Componentes React en JSX.

### js/resumen-data.js
**Ubicación**: `vistas/js/resumen-data.js`  
**Tipo**: JavaScript (Datos)  
**Propósito**: Gestión de datos de resumen.

### js/resumen-view.js
**Ubicación**: `vistas/js/resumen-view.js`  
**Tipo**: JavaScript (Vista)  
**Propósito**: Vista del módulo resumen.

### js/seccion-collapse.js
**Ubicación**: `vistas/js/seccion-collapse.js`  
**Tipo**: JavaScript (UI)  
**Propósito**: Funcionalidad de colapso de secciones.

### js/summary-aggregates.js
**Ubicación**: `vistas/js/summary-aggregates.js`  
**Tipo**: JavaScript (Cálculos)  
**Propósito**: Agregaciones para summary.

### js/summary-catalog.js
**Ubicación**: `vistas/js/summary-catalog.js`  
**Tipo**: JavaScript (Catálogo)  
**Propósito**: Catálogo de elementos summary.

### js/summary-engine-core.js
**Ubicación**: `vistas/js/summary-engine-core.js`  
**Tipo**: JavaScript (Motor)  
**Propósito**: Motor central de cálculos summary.

### js/summary-layout.js
**Ubicación**: `vistas/js/summary-layout.js`  
**Tipo**: JavaScript (Layout)  
**Propósito**: Gestión de layout para summary.

### js/summary-view.js
**Ubicación**: `vistas/js/summary-view.js`  
**Tipo**: JavaScript (Vista)  
**Propósito**: Vista del módulo summary.

### js/summary.js
**Ubicación**: `vistas/js/summary.js`  
**Tipo**: JavaScript (Principal)  
**Propósito**: Lógica principal del módulo summary.

### js/toggle-redondeo.js
**Ubicación**: `vistas/js/toggle-redondeo.js`  
**Tipo**: JavaScript (UI)  
**Propósito**: Toggle para redondeo de cifras.

### vendor/
**Ubicación**: `vistas/vendor/`  
**Tipo**: Librerías de terceros  
**Propósito**: Dependencias frontend embebidas (Bootstrap, React, etc.).

## Directorio scripts/

### Scripts de utilidad y mantenimiento

#### prepublish.js
**Ubicación**: `scripts/prepublish.js`  
**Tipo**: JavaScript (Build)  
**Propósito**: Preparación antes de publicar releases.

#### manage-native.js
**Ubicación**: `scripts/manage-native.js`  
**Tipo**: JavaScript (Utilidad)  
**Propósito**: Gestión de módulos nativos para diferentes entornos.

#### Scripts de importación
**Ubicación**: `scripts/import_*.js` y `scripts/import_*.py`  
**Tipo**: JavaScript/Python (Importación)  
**Propósito**: Importación de datos desde diversos formatos.

#### Scripts de verificación
**Ubicación**: `scripts/verify_*.js`  
**Tipo**: JavaScript (Verificación)  
**Propósito**: Verificación de integridad de datos.

#### Scripts de exportación
**Ubicación**: `scripts/export_*.ps1`  
**Tipo**: PowerShell (Exportación)  
**Propósito**: Exportación de datos y configuraciones.

## Directorio PLANTILLAS 2026+/

### Estructura de plantillas por empresa

Cada subdirectorio representa una empresa y contiene archivos JSON con layouts para diferentes módulos.

**Ejemplo**: `PLANTILLAS 2026+/CIUDAD DE MEXICO 2026/RESUMEN_layout.json`

**Propósito**: Definir la estructura visual y lógica de cada módulo por empresa.

**Estructura típica de layout**:
```json
{
  "modulo": "RESUMEN",
  "columns": [
    {"name": "cuenta", "type": "text", "width": 200},
    {"name": "presupuesto", "type": "currency", "width": 150}
  ],
  "rows": [...],
  "operations": [...]
}
```

## Directorio tests/

### test-flujo-autorizacion.js
**Ubicación**: `tests/test-flujo-autorizacion.js`  
**Tipo**: JavaScript (Prueba)  
**Propósito**: Pruebas del flujo de autorizaciones.

### summary-engine-core.test.js
**Ubicación**: `tests/summary-engine-core.test.js`  
**Tipo**: JavaScript (Prueba)  
**Propósito**: Pruebas del motor de cálculos summary.

## Otros archivos

### Iconos y recursos
**Ubicación**: `icono/`  
**Tipo**: Imágenes (Recursos)  
**Propósito**: Iconos para la aplicación y instalador.

### Imágenes
**Ubicación**: `image/`  
**Tipo**: Imágenes (Recursos)  
**Propósito**: Imágenes utilizadas en la interfaz.

### MDS (¿Documentación?)
**Ubicación**: `mds/`  
**Tipo**: Desconocido  
**Propósito**: Archivos de documentación o metadatos.

### Scripts de PowerShell
**Ubicación**: Raíz  
**Tipo**: PowerShell  
**Propósito**: Utilidades de Windows (limpieza de cache, cambio de modo, etc.).

### Archivos de documentación
**Ubicación**: Raíz (varios .md)  
**Tipo**: Markdown  
**Propósito**: Documentación específica de funcionalidades.

---

## 📊 OPERACIONES_POR_CELDA_TODOS_MODULOS.json

**Ubicación:** `OPERACIONES_POR_CELDA_TODOS_MODULOS.json`  
**Propósito:** Mapa completo y exhaustivo de operaciones por cada celda de cada módulo HTML  
**Versión:** 2.0.0 (2026-01-04)

### 📋 Descripción General
Este archivo JSON es el **mapa maestro** que define todas las operaciones que se ejecutan en cada celda de las tablas HTML de todos los módulos del sistema. Es la referencia definitiva para entender cómo funciona la lógica de cálculo de sumas, totales y operaciones financieras.

### 🏗️ Estructura Jerárquica
```
OPERACIONES_POR_CELDA_TODOS_MODULOS.json
├── estructura_columnas_comun (columnas 0-29)
├── modulos
│   ├── Membresia.html
│   │   ├── capitulos: ["CIUDAD DE MÉXICO", "GUADALAJARA", "NORESTE", "NOROESTE"]
│   │   └── CIUDAD DE MÉXICO
│   │       └── seccion_INGRESOS_MEMBRESIA
│   │           ├── tipo_seccion: "INGRESOS"
│   │           ├── factor_seccion: 1
│   │           ├── cuentas: [array de objetos cuenta]
│   │           ├── filas_cuenta: {operaciones por celda}
│   │           ├── fila_sum_row: {suma vertical}
│   │           └── fila_sumavarios: {resultado operativo}
```

### 📊 Tipos de Operaciones por Celda

#### 1. **Celdas Editables (INPUT)**
```json
"columna_2_budget_ene": {
  "tipo": "input",
  "editable": true,
  "valor_inicial": "API /planeacion/cuentas → presupuesto.ene",
  "al_editar": [
    "1. Usuario hace doble click",
    "2. Celda se vuelve contentEditable",
    "3. Usuario escribe valor",
    "4. Al presionar Enter:",
    "   a. parsearNumero(celda.textContent)",
    "   b. actualizar estadoModulo.valoresPorCuenta",
    "   c. llamar recalcularTotalesFilaPresupuesto()",
    "   d. llamar recalcularSumas()"
  ],
  "validacion": "Número válido, acepta negativos"
}
```

#### 2. **Celdas Calculadas (SUM_HORIZONTAL)**
```json
"columna_26_total_budget": {
  "tipo": "calculado",
  "operacion": "SUM_HORIZONTAL",
  "formula": "SUM(budget-ene hasta budget-[periodo_cerrado])",
  "dependencias": ["columnas 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24"],
  "trigger": "recalcularTotalesFilaPresupuesto()",
  "pseudocodigo": [
    "let total = 0;",
    "for (let i = 0; i <= periodoCerrado; i++) {",
    "  total += valores[`budget-${MESES[i]}`] || 0;",
    "}",
    "celda.textContent = formatearNumero(total);"
  ]
}
```

#### 3. **Celdas de Suma Vertical (SUM_VERTICAL)**
```json
"columna_2_budget_ene": {
  "tipo": "calculado",
  "operacion": "SUM_VERTICAL",
  "formula": "SUM(cuenta1.budget-ene * factor1, cuenta2.budget-ene * factor2, ...)",
  "dependencias": ["Todas las filas-cuenta de la sección"],
  "trigger": "recalcularSumas() → PASO 1",
  "proceso_detallado": [
    "1. Extraer valores de cada fila-cuenta:",
    "   - fila1: 50000 * 1 = 50000",
    "   - fila2: 5000 * 1 = 5000",
    "   - fila3: 3000 * 1 = 3000",
    "   - fila4: 2000 * 1 = 2000",
    "   - fila5: 1000 * 1 = 1000",
    "2. Sumar: 50000 + 5000 + 3000 + 2000 + 1000 = 61000",
    "3. Asignar a celda: formatearNumero(61000) → '61,000.00'"
  ],
  "linea_codigo": "3890-3920 en cuentas-modulo.js"
}
```

#### 4. **Celdas de Resultado Operativo (SUM_DE_SUM)**
```json
"columna_2_budget_ene": {
  "tipo": "calculado",
  "operacion": "SUM_DE_SUM",
  "formula": "SUM(seccion1.sumRow * factor1, seccion2.sumRow * factor2)",
  "ejemplo_calculo": [
    "seccion INGRESOS MEMBRESIA: sumRow.budget-ene = 61000, factor = 1",
    "seccion GASTOS MEMBRESIA: sumRow.budget-ene = 15000, factor = -1",
    "Resultado: (61000 * 1) + (15000 * -1) = 46000"
  ],
  "trigger": "recalcularSumas() → PASO 2",
  "linea_codigo": "3925-3990"
}
```

### 🎯 Funcionalidad Crítica
- **Referencia maestra** para el motor de cálculos `cuentas-modulo.js`
- Define operaciones para **30 columnas** por fila (cuentas + 12 meses × 2 + 4 totales)
- Soporta **múltiples módulos** con estructuras similares pero lógicas específicas
- Incluye **pseudocódigo** para cada operación para facilitar debugging
- **Versionado** para tracking de cambios en lógica de negocio

---

## 🔧 Scripts de Utilidad

### cambiar-modo.ps1
**Ubicación:** `cambiar-modo.ps1`  
**Propósito:** Cambiar rápidamente entre modos de desarrollo y producción

```powershell
# Uso: .\cambiar-modo.ps1 dev  (o prod)
param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('dev', 'prod', 'development', 'production')]
    [string]$Modo
)

# Normaliza modo y copia archivo .env correspondiente
$ModoFinal = switch ($Modo) {
    'dev' { 'development' }
    'prod' { 'production' }
    default { $Modo }
}

Copy-Item ".env.$ModoFinal" ".env" -Force
```

**Funcionalidad:**
- ✅ Valida parámetros de entrada
- ✅ Copia archivo `.env` correspondiente
- ✅ Muestra configuración activa
- ✅ Instrucciones para ejecutar la aplicación

### limpiar-cache-icono.ps1
**Ubicación:** `limpiar-cache-icono.ps1`  
**Propósito:** Limpiar caché de iconos de Windows para resolver problemas de visualización

```powershell
# Ejecutar como administrador si es posible
Write-Host "🧹 Limpiando caché de iconos de Windows..." -ForegroundColor Cyan

# Elimina IconCache.db
Remove-Item "$env:LOCALAPPDATA\IconCache.db" -Force -ErrorAction SilentlyContinue

# Elimina archivos de thumbnail cache
Get-ChildItem "$env:LOCALAPPDATA\Microsoft\Windows\Explorer" -Filter "thumbcache_*.db" |
    Remove-Item -Force -ErrorAction SilentlyContinue
```

**Funcionalidad:**
- ✅ Elimina `IconCache.db`
- ✅ Limpia caché de thumbnails
- ✅ Opción para reiniciar Explorador de Windows
- ✅ Manejo de errores para archivos en uso

---

## 🗄️ Scripts SQL de Inicialización

### insertar-cuentas-ppto-cdmx.sql
**Ubicación:** `insertar-cuentas-ppto-cdmx.sql`  
**Propósito:** Insertar cuentas de presupuesto consolidadas para Ciudad de México

```sql
-- Inserta 6 cuentas consolidadas para presupuesto
-- GUADALAJARA INCOME
INSERT INTO CUENTAS26 (NUM_CTA, NOMBRE, NATURALEZA, STATUS, TIPO, NIVEL)
VALUES ('45000100000000000000001', 'PPTO GDL INCOME', 'A', 'A', 'A', '1');

-- GUADALAJARA EXPENSE
INSERT INTO CUENTAS26 (NUM_CTA, NOMBRE, NATURALEZA, STATUS, TIPO, NIVEL)
VALUES ('95000100000000000000001', 'PPTO GDL EXPENSE', 'A', 'A', 'A', '1');

-- NORESTE INCOME
INSERT INTO CUENTAS26 (NUM_CTA, NOMBRE, NATURALEZA, STATUS, TIPO, NIVEL)
VALUES ('45000200000000000000001', 'PPTO NE INCOME', 'A', 'A', 'A', '1');

-- NORESTE EXPENSE
INSERT INTO CUENTAS26 (NUM_CTA, NOMBRE, NATURALEZA, STATUS, TIPO, NIVEL)
VALUES ('95000200000000000000001', 'PPTO NE EXPENSE', 'A', 'A', 'A', '1');

-- NOROESTE INCOME
INSERT INTO CUENTAS26 (NUM_CTA, NOMBRE, NATURALEZA, STATUS, TIPO, NIVEL)
VALUES ('45000300000000000000001', 'PPTO NO INCOME', 'A', 'A', 'A', '1');

-- NOROESTE EXPENSE
INSERT INTO CUENTAS26 (NUM_CTA, NOMBRE, NATURALEZA, STATUS, TIPO, NIVEL)
VALUES ('95000300000000000000001', 'PPTO NO EXPENSE', 'A', 'A', 'A', '1');
```

### insertar-presup-cuentas-cdmx.sql
**Ubicación:** `insertar-presup-cuentas-cdmx.sql`  
**Propósito:** Inicializar presupuestos mensuales para las cuentas consolidadas

```sql
-- Inicializa presupuestos en cero para ejercicio 2026
INSERT INTO PRESUP26 (NUM_CTA, EJERCICIO, PRESUP01, PRESUP02, PRESUP03, PRESUP04, PRESUP05, PRESUP06, PRESUP07, PRESUP08, PRESUP09, PRESUP10, PRESUP11, PRESUP12)
VALUES ('45000100000000000000001', 2026, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);

-- Repite para las otras 5 cuentas consolidadas...
```

**Funcionalidad:**
- ✅ Crea estructura de cuentas consolidadas
- ✅ Inicializa presupuestos en cero
- ✅ Preparación para importación de datos reales

---

## 📚 Documentación Principal

### README.md
**Ubicación:** `README.md`  
**Propósito:** Documentación principal del proyecto con instrucciones de instalación y uso

**Contenido clave:**
- 🚀 Características principales del sistema
- 📋 Requisitos previos (Node.js, Firebird, etc.)
- ⚡ Instalación rápida paso a paso
- 🛠️ Scripts NPM disponibles
- 📁 Estructura del proyecto
- 🔐 Configuración de seguridad para cuenta admin

**Scripts destacados:**
```bash
npm start          # Inicia app en Electron
npm run server     # Solo servidor Node.js
npm run build      # Crea ejecutable de producción
npm run dist       # Genera installer + portable
```

### CONFIGURACION_ENTORNO.md
**Ubicación:** `CONFIGURACION_ENTORNO.md`  
**Propósito:** Guía completa para configuración de variables de entorno

**Archivos de configuración:**
- `.env.example` - Plantilla de ejemplo
- `.env.development` - Desarrollo (puerto 3050)
- `.env.production` - Producción (puerto 15350)
- `.env` - Archivo activo actual

**Variables principales:**
```bash
NODE_ENV=development          # Modo de ejecución
FIREBIRD_HOST=127.0.0.1      # Host Firebird
FIREBIRD_PORT=3050           # Puerto (3050=local, 15350=túnel)
FIREBIRD_USER=sysdba         # Usuario BD
FIREBIRD_PASSWORD=masterkey  # Contraseña BD
SERVER_PORT=3005             # Puerto servidor Node.js
```

**Funcionalidad:**
- ✅ Cambio rápido entre modos dev/prod
- ✅ Configuración automática en builds
- ✅ Seguridad mejorada (credenciales en .env)
- ✅ Troubleshooting incluido

### INSTRUCCIONES_USO.md
**Ubicación:** `INSTRUCCIONES_USO.md`  
**Propósito:** Guía de uso de la nueva arquitectura servidor independiente

**Modos de uso:**
1. **Solo servidor** (navegador): `npm run server` → `http://localhost:3005`
2. **Aplicación Electron**: Servidor + `npm start`

**Arquitectura desacoplada:**
- ✅ Servidor Node.js independiente
- ✅ Acceso desde navegador sin Electron
- ✅ Múltiples clientes conectados
- ✅ Facilita desarrollo y debugging

**Configuración:**
- Puerto configurable: `PORT=8080 npm run server`
- Base de datos SQLite en `./datos/panel.sqlite`
- Troubleshooting incluido

---

## 📋 OPERACIONES_TABLA_HTML.json

**Ubicación:** `OPERACIONES_TABLA_HTML.json`  
**Propósito:** Mapa completo de operaciones en tablas HTML  
**Versión:** 1.0.0 (2026-01-04)

### 🏗️ Estructura de Tabla HTML
Define la estructura completa de tablas HTML con 30 columnas:
- **Columna 0:** Número de cuenta
- **Columnas 1-25:** Meses (presupuesto + real × 12)
- **Columna 26-27:** Totales acumulados
- **Columna 28-29:** Totales anuales

### 🎯 Tipos de Filas
1. **section-header-row:** Encabezado de sección
2. **account-row (fila-cuenta):** Fila de cuenta individual
3. **sum-row:** Suma vertical de sección
4. **sum-row-sumavarios:** Resultado operativo
5. **result-row:** Fila de resultado final

### 🔧 Operaciones por Tipo de Fila
Cada tipo de fila tiene operaciones específicas definidas con:
- Pseudocódigo de ejecución
- Dependencias entre celdas
- Triggers de recálculo
- Referencias a código fuente

**Ejemplo - Fila de Cuenta:**
```json
"account-row": {
  "operaciones": {
    "celda_presupuesto_mes": {
      "tipo": "editable",
      "calculo_dependiente": "totales_fila",
      "trigger": "recalcularTotalesFila()",
      "codigo_linea": "1540-1580"
    }
  }
}
```

---

## 🎯 Conclusión de Documentación Expandida

Esta documentación ampliada cubre ahora **todos los archivos principales** del proyecto SummaCham, incluyendo:

✅ **Archivos de configuración y entorno**  
✅ **Scripts de utilidad (PowerShell)**  
✅ **Scripts SQL de inicialización**  
✅ **Documentación principal (README, etc.)**  
✅ **Mapas de operaciones JSON**  
✅ **Arquitectura completa del sistema**  
✅ **Código fuente detallado**  
✅ **Instrucciones de uso y troubleshooting**

El sistema SummaCham es una aplicación financiera empresarial completa con arquitectura modular, seguridad robusta, y funcionalidades avanzadas de gestión de presupuestos y reportes.</content>
<parameter name="filePath">C:\Users\Frida Sophia\Desktop\DESARROLLOS\SummaCham\DOCUMENTACION_COMPLETA.md

---

## DOCUMENTACION_TECNICA.md

_Fuente: `DOCUMENTACION_TECNICA.md`_

# Documentación Técnica: SummaCham

## Descripción General
SummaCham es una aplicación de escritorio para gestión financiera empresarial, desarrollada con Electron y Node.js, que integra bases de datos Firebird y SQLite. Permite la gestión de presupuestos, reportes, usuarios, roles, y flujos de autorización, con visualización de datos y exportación de reportes.

---

## Estructura de Archivos Principales

### 1. main.js
- **Función:** Arranque principal de la app Electron. Inicializa la ventana, el tray, el servidor Node.js, y el sistema de auto-actualización.
- **Librerías:** Electron, electron-updater, auto-launch, path, fs.
- **Flujo:**
  - Verifica instancia única.
  - Configura auto-inicio y actualizaciones.
  - Inicializa secretos y variables de entorno.
  - Arranca el servidor backend y la ventana principal.

### 2. src/server.js
- **Función:** Backend Express. Expone API REST, gestiona sesiones, usuarios, roles, y conecta con Firebird/SQLite.
- **Librerías:** express, express-session, better-sqlite3, node-firebird, helmet, cookie-parser, bcryptjs, jsonwebtoken.
- **Flujo:**
  - Inicializa rutas y middlewares de seguridad.
  - Conecta a bases de datos.
  - Expone endpoints para reportes, usuarios, autenticación, y operaciones financieras.

### 3. src/utils/
- **Archivos:**
  - `secretsManager.js`: Inicializa y gestiona secretos de sesión/JWT.
  - `betterSqlite3Manager.js`: Abstracción para operaciones con SQLite.
  - `csvLoader.js`: Carga y parsea archivos CSV para reportes y layouts.

### 4. vistas/
- **Archivos HTML:**
  - Interfaces de usuario para módulos: login, resumen, summary, finanzas, plantillas, usuarios, etc.
  - Cada vista se conecta vía JS a los endpoints del backend para mostrar datos dinámicos.

### 5. scripts/
- **Archivos JS/Python:**
  - Scripts de mantenimiento, importación de layouts, verificación de operaciones, y gestión de contraseñas.

### 6. info IMPORTANTE/
- **Archivos JSON/Excel/CSV:**
  - Definen la estructura de cuentas, capítulos, layouts y sumas para reportes y módulos.

---

## Principales Funciones y Métodos
- **main.js:**
  - `createWindow()`: Crea la ventana principal Electron.
  - `setupAutoUpdater()`: Configura y gestiona actualizaciones automáticas.
  - `configureAutoLaunch()`: Habilita auto-inicio en Windows/Linux.
- **server.js:**
  - `iniciarServidor(port)`: Arranca el backend Express.
  - Endpoints `/api/reportes/summary` y `/api/reportes/resumen`: Generan y devuelven reportes jerárquicos.
- **utils:**
  - `inicializarSecretos()`: Inicializa secretos seguros.
  - `cargarCSV()`: Carga y parsea archivos CSV.

---

## Librerías Utilizadas
- **Electron:** Interfaz de escritorio.
- **Node.js:** Motor principal.
- **Express:** API REST backend.
- **better-sqlite3:** Base de datos local.
- **node-firebird:** Conexión a Firebird.
- **bcryptjs:** Hash de contraseñas.
- **jsonwebtoken:** Tokens JWT para sesiones.
- **helmet:** Seguridad HTTP.
- **csv-parse/xlsx:** Procesamiento de archivos de datos.
- **auto-launch:** Auto-inicio de la app.
- **electron-updater:** Actualizaciones automáticas.

---

## Flujo General del Programa
1. **Inicio:**
   - main.js verifica instancia única y arranca el backend.
   - Inicializa secretos y variables de entorno.
   - Crea la ventana Electron y el tray.
2. **Backend:**
   - server.js expone API REST y gestiona sesiones, usuarios, y operaciones.
   - Conecta a Firebird y SQLite para datos financieros y layouts.
3. **Frontend:**
   - vistas/*.html renderizan interfaces y consumen endpoints del backend.
   - JS de cada vista gestiona la interacción y visualización dinámica.
4. **Reportes:**
   - Motores de reportes procesan archivos de cuentas/layouts y generan nodos jerárquicos.
   - Endpoints devuelven JSON para renderizado en las vistas.
5. **Actualizaciones y Seguridad:**
   - electron-updater gestiona actualizaciones.
   - helmet, bcryptjs, y jsonwebtoken aseguran sesiones y datos.

---

## Cómo Funciona Todo el Programa
- El usuario inicia la app, que arranca el backend y la interfaz Electron.
- El backend gestiona usuarios, roles, y operaciones financieras, conectando a Firebird/SQLite.
- Las vistas HTML permiten al usuario interactuar con los datos, crear reportes, y gestionar módulos.
- Los reportes se generan procesando archivos de cuentas y layouts, devolviendo datos jerárquicos para visualización.
- El sistema de actualizaciones y seguridad mantiene la app protegida y actualizada.

---

## Referencias y Archivos Clave
- `main.js`, `src/server.js`, `src/utils/*`, `vistas/*.html`, `scripts/*`, `info IMPORTANTE/*`, `package.json`, `README.md`

---

## Autoría y Licencia
- Autor: Iustus Renidet & J02V4N
- Licencia: MIT

---

## EXPLICACION_PACKAGE_CONFIG.md

_Fuente: `EXPLICACION_PACKAGE_CONFIG.md`_

# Explicación Detallada de package.json y Configuración

## package.json

Este archivo define la configuración, dependencias y scripts del proyecto SummaCham. Es esencial para la gestión de la app con Node.js y Electron.

### Secciones Principales

- **name, version, description, author:** Identifican el proyecto y sus autores.
- **main:** Archivo principal de arranque (`main.js`).
- **scripts:** Comandos para desarrollo, build, test, publicación y gestión de binarios nativos.
- **dependencies:** Librerías requeridas en producción (Electron, Express, Firebird, SQLite, seguridad, etc).
- **devDependencies:** Herramientas para desarrollo y empaquetado (electron-builder, cross-env, esbuild).
- **build:** Configuración de electron-builder para empaquetar la app.
  - **appId, productName:** Identificadores únicos para la app.
  - **publish:** Publicación automática en GitHub Releases.
  - **asar:** Empaquetado de archivos en formato ASAR para mayor seguridad y rendimiento.
  - **asarUnpack:** Excepciones para módulos nativos que requieren acceso directo.
  - **directories/files/extraResources:** Define qué archivos y carpetas se incluyen en el build y cómo se distribuyen.
  - **win/nsis/portable:** Configuración específica para Windows, instalador NSIS y versión portable.

---

## Configuración Electron

- **main.js:**

  - Inicializa la app Electron, crea la ventana principal y el tray.
  - Configura auto-actualizaciones con electron-updater.
  - Usa iconos personalizados y AppUserModelId para integración con Windows.
  - Carga la interfaz desde el servidor local Node.js (`http://localhost:3005`).
  - Minimiza la app en vez de cerrarla, manteniéndola en segundo plano.
- **electron-builder:**

  - Empaqueta la app en formato instalador y portable.
  - Incluye recursos, iconos y archivos de datos necesarios.
  - Permite configuración granular para Windows (elevación, directorio de instalación, accesos directos).

---

## Variables de Entorno (envs)

- **.env / .env.production / .env.development:**

  - `PORT`: Puerto del backend Node.js.
  - `SESSION_SECRET`: Clave secreta para sesiones y JWT.
  - `PANELAMCHAM_ADMIN_PASSWORD`: Contraseña inicial para el usuario admin.
  - `NODE_ENV`: Define el modo de ejecución (development/production).
- **Uso:**

  - main.js y server.js leen estas variables para configurar el entorno, seguridad y credenciales.
  - Las variables pueden rotarse y actualizarse sin exponer contraseñas en logs.

---

## Cookies y Seguridad

- **express-session:**

  - Gestiona sesiones de usuario mediante cookies seguras.
  - Usa `SESSION_SECRET` para firmar y proteger las cookies.
  - Configura opciones de expiración, seguridad y almacenamiento (SQLite).
- **cookie-parser:**

  - Permite leer y manipular cookies HTTP en las rutas del backend.
- **helmet:**

  - Refuerza la seguridad HTTP (cabeceras, protección XSS, etc).
- **bcryptjs:**

  - Hashea contraseñas antes de almacenarlas en la base de datos.
- **jsonwebtoken:**

  - Genera y valida tokens JWT para autenticación y autorización.

---

## Resumen del Flujo de Configuración

1. **Al iniciar:**
   - Electron lee variables de entorno y configura la app.
   - El backend Express usa las variables para sesiones, seguridad y conexión a bases de datos.
   - Las cookies gestionan la autenticación y persistencia de usuario.
   - electron-builder empaqueta todo según la configuración definida en package.json.

---

## Referencias Clave

- `package.json`, `.env*`, `main.js`, `src/server.js`, `src/utils/secretsManager.js`, `src/config/env-config.js`

---

## Recomendaciones

- Mantén las variables sensibles fuera del código fuente y distribúyelas de forma segura.
- Actualiza las dependencias regularmente para mantener la seguridad.
- Personaliza los iconos y recursos en la carpeta `icono/` para tu marca.

---

## GESTION_FIREBIRD_CONEXIONES.md

_Fuente: `GESTION_FIREBIRD_CONEXIONES.md`_

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

---

## GESTION_SECRETOS_AUTOMATICA.md

_Fuente: `GESTION_SECRETOS_AUTOMATICA.md`_

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

---

## GUIA_PUBLICAR_RELEASES.md

_Fuente: `GUIA_PUBLICAR_RELEASES.md`_

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

---

## INSTRUCCIONES_USO.md

_Fuente: `INSTRUCCIONES_USO.md`_

# Instrucciones de Uso - Panel AMCHAM

## Nueva Arquitectura (Servidor Independiente)

La aplicación ahora usa una arquitectura desacoplada donde el servidor Node.js corre independientemente del cliente Electron.

### Ventajas de esta arquitectura:
✅ Puedes acceder a la aplicación desde el navegador sin necesidad de Electron
✅ Puedes tener múltiples clientes conectados al mismo servidor
✅ Facilita el desarrollo y debugging
✅ El servidor puede correr como servicio independiente

---

## 📋 Modos de Uso

### **Opción 1: Solo Servidor Node.js (Navegador)**

Ejecuta el servidor en el puerto **3005**:

```bash
npm run server
```

Luego abre tu navegador en:
```
http://localhost:3005
```

### **Opción 2: Aplicación Electron (Escritorio)**

**IMPORTANTE:** Primero debes tener el servidor corriendo

1. En una terminal, inicia el servidor:
```bash
npm run server
```

2. En otra terminal (o después de ver que el servidor está corriendo), abre Electron:
```bash
npm start
```

La ventana de Electron se conectará automáticamente a `http://localhost:3005`

---

## 🔧 Configuración

### Puerto del Servidor
Por defecto usa el puerto **3005**. Para cambiarlo:

```bash
PORT=8080 npm run server
```

### Base de Datos
La base de datos SQLite se almacena en:
- **Desarrollo:** `./datos/panel.sqlite`
- **Electron empaquetado:** `%APPDATA%/panel-amcham/datos/panel.sqlite`

---

## 🚨 Solución de Problemas

### Error: "No se puede conectar al servidor"
- Asegúrate de que el servidor esté corriendo: `npm run server`
- Verifica que el puerto 3005 no esté ocupado

### Error: "Puerto 3005 en uso"
- Cierra otras instancias del servidor
- O usa otro puerto: `PORT=3006 npm run server`

### Electron no carga la página
- Verifica que el servidor esté corriendo ANTES de abrir Electron
- Revisa la consola de Electron (F12) para ver errores de conexión

---

## 📦 Empaquetado

Al empaquetar la aplicación con `npm run dist`, Electron seguirá apuntando a `localhost:3005`.

**Para producción, considera:**
- Incluir un script que inicie el servidor automáticamente
- O configurar el servidor como servicio del sistema

---

## 🔄 Flujo Recomendado de Desarrollo

1. Terminal 1 - Servidor:
```bash
npm run server
```

2. Terminal 2 - Electron (opcional):
```bash
npm start
```

3. Navegador (opcional):
```
http://localhost:3005
```

De esta forma tienes el servidor siempre corriendo y puedes acceder tanto desde navegador como desde Electron.

---

## REBUILD_NATIVE.md

_Fuente: `REBUILD_NATIVE.md`_

This short guide is for developers to rebuild native Node/Electron modules (like `better-sqlite3`) and to package the app.

Preconditions
- Windows development environment (PowerShell)
- Node.js compatible with the project's `package.json` devDependencies (v18+ recommended)
- Install `node-gyp` toolchain: Visual Studio Build Tools or Windows Build Tools

Steps
1. Clean node_modules and PKG lock (optional but recommended for deterministic builds):

```pwsh
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json -Force
```

2. Install production deps with `npm ci` (preferred for reproducibility):
```pwsh
npm ci
```

3. Install electron builder app dependencies (this downloads Electron headers and prepares build toolchains):
```pwsh
npm run postinstall
```

4. Generate the native binaries for **both** runtimes (Node CLI + Electron 39). This command:
   - Rebuilds `better-sqlite3` for your current Node version.
   - Runs `electron-rebuild` targeting Electron 39.2.7.
   - Stores each `.node` file inside `native_modules/<variant>` so both runtimes can swap automatically.
```pwsh
npm run rebuild-native
```

5. **IMPORTANT:** Before publishing/packaging, ensure Electron binaries are active:
```pwsh
npm run rebuild-native-electron
npm run native:status
```
You should see "almacen electron: OK".

6. Start the server for local development (Node runtime):
```pwsh
npm run server
```

7. If you need to package the app for Windows (NSIS):
```pwsh
npm run dist
```

8. To publish to GitHub releases (automatically recompiles):
```pwsh
npm run publish
```

Common errors and solutions
- **"The module was compiled against a different Node.js version"** - This happens when the wrong binary variant is active. Run `npm run rebuild-native-electron` before packaging/publishing.
- **NODE_MODULE_VERSION mismatch** - The binary was compiled for a different Electron/Node version. Always run `npm run rebuild-native-electron` before publishing. See `SOLUCION_ERROR_NODE_MODULE_VERSION.md` for details.
- If `electron-rebuild` fails due to `node-gyp` errors, make sure you installed Build Tools and the Visual Studio SDK.
- Permission denied when running `electron-rebuild` — run PowerShell as administrator.

Notes
- This project requires SQLite native modules to be built for your OS / Electron runtime. The server will not run in production mode without these native modules.
- If you use CI or packaging, ensure `electron-builder install-app-deps` and `npm run rebuild-native` run during your build pipeline before packaging. The produced binaries live under `native_modules/` and the runtime loader copies the one that matches (`process.versions.electron` vs Node CLI) automatically.

---

## RELEASE_NOTES_v1.1.19.md

_Fuente: `RELEASE_NOTES_v1.1.19.md`_

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

---

## RELEASE_NOTES_v1.1.20.md

_Fuente: `RELEASE_NOTES_v1.1.20.md`_

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

---

## SEGURIDAD.md

_Fuente: `SEGURIDAD.md`_

# 🔒 Guía de Seguridad - SummaCham

## Antes de Hacer el Repositorio Público

### ✅ Checklist de Seguridad

- [ ] **Nunca commitear archivos `.env`** - Están en `.gitignore`
- [ ] **Revisar historial de Git** - Asegurarse de que no haya contraseñas en commits anteriores
- [ ] **Base de datos local protegida** - `datos/` está en `.gitignore`
- [ ] **Seed de usuarios es ejemplo** - `seed_users.json` real está ignorado
- [ ] **Sin rutas absolutas hardcodeadas** - Todo usa rutas relativas
- [ ] **GitHub Token configurado** - Para releases (no commitearlo)

---

## Configuración Inicial para Usuarios

### 1. Variables de Entorno

Copia `.env.example` a `.env` y configura:

```bash
cp .env.example .env
```

Genera un secreto seguro para sesiones:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Usuarios Iniciales

Copia `src/config/seed_users.example.json` a `src/config/seed_users.json` y agrega tus usuarios:

```bash
cp src/config/seed_users.example.json src/config/seed_users.json
```

**IMPORTANTE:** `seed_users.json` real NUNCA debe commitearse.

### 3. Base de Datos

La base de datos SQLite se crea automáticamente en:
- **Desarrollo:** `datos/panel.sqlite`
- **Producción:** `%APPDATA%/SummaCham/datos/panel.sqlite`

### 4. Contraseña de Administrador

El usuario `ICONET` (admin global) se crea automáticamente:

- **Con variable de entorno:** Usa `PANELAMCHAM_ADMIN_PASSWORD` en `.env`
- **Sin variable:** Genera una contraseña aleatoria que se muestra en la consola

⚠️ **Guarda la contraseña generada** - Solo se muestra una vez.

---

## Información NO Sensible (Segura para GitHub Público)

### ✅ Puedes commitear:
- Código fuente (JS, HTML, CSS)
- Archivos `.example` y `.md`
- `package.json` y `package-lock.json`
- Estructura de carpetas vacías
- Documentación
- Assets públicos (iconos, imágenes)

### ❌ NUNCA commitees:
- Archivos `.env` (con valores reales)
- `datos/` y archivos `.sqlite`
- `seed_users.json` (con usuarios reales)
- `node_modules/`
- Builds y ejecutables (`dist/`, `out/`, `*.exe`)
- Logs con información sensible

---

## Limpieza del Historial de Git

Si ya commiteaste información sensible, límpiarla:

### Opción 1: BFG Repo-Cleaner (Recomendado)
```bash
# Instalar BFG
# https://rtyley.github.io/bfg-repo-cleaner/

# Eliminar archivo específico del historial
bfg --delete-files seed_users.json
bfg --delete-files .env

# Limpiar referencias
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

### Opción 2: Git Filter-Branch
```bash
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch src/config/seed_users.json" \
  --prune-empty --tag-name-filter cat -- --all

# Force push (¡CUIDADO! Reescribe historial)
git push origin --force --all
```

---

## Publicación de Releases

### Generar Token de GitHub

1. Ve a: https://github.com/settings/tokens
2. Click en "Generate new token (classic)"
3. Permisos necesarios:
   - `repo` (acceso completo)
   - `write:packages` (opcional)
4. Guarda el token en un lugar seguro

### Configurar el Token

**NO lo agregues al código.** Úsalo como variable de entorno:

```bash
# PowerShell
$env:GITHUB_TOKEN="tu_token_aqui"

# O agrégalo a tu .env (que está ignorado)
GITHUB_TOKEN=tu_token_aqui
```

### Publicar Release

```bash
.\scripts\publish-update.ps1 -Version "1.0.1" -ReleaseNotes "Correcciones de bugs"
```

---

## Auditoría de Seguridad

### Revisar que no haya secretos en el código

```bash
# Buscar contraseñas hardcodeadas
git grep -i "password.*=" -- "*.js" "*.json"

# Buscar tokens
git grep -i "token.*=" -- "*.js" "*.json"

# Buscar API keys
git grep -i "api.*key" -- "*.js" "*.json"
```

### Revisar dependencias vulnerables

```bash
npm audit
npm audit fix
```

---

## Recomendaciones Adicionales

### 1. **GitHub Repository Settings**
- Activa "Dependency scanning"
- Activa "Secret scanning"
- Revisa las alertas de Dependabot

### 2. **Dos Repositorios (Opcional)**
- **Público:** Código sin datos sensibles
- **Privado:** Fork con configuración real para tu empresa

### 3. **CI/CD Secrets**
Si usas GitHub Actions, agrega secretos en:
`Settings > Secrets and variables > Actions`

### 4. **Documentación Clara**
Incluye en el README:
- Cómo configurar el proyecto
- Qué archivos deben crearse
- Dónde obtener credenciales

---

## Contacto de Seguridad

Si encuentras una vulnerabilidad, reporta en:
- GitHub Issues (para bugs no sensibles)
- Email directo (para vulnerabilidades críticas)

**NO publiques vulnerabilidades en issues públicas.**

---

## SETUP_INICIAL.md

_Fuente: `SETUP_INICIAL.md`_

# 🚀 Setup Inicial - SummaCham

Este documento explica cómo configurar el proyecto después de clonarlo.

## Prerrequisitos

- Node.js 18.x o superior
- npm 9.x o superior
- Windows (para builds de Electron)

## Instalación Paso a Paso

### 1. Clonar el Repositorio

```bash
git clone https://github.com/TU_USUARIO/SummaCham.git
cd SummaCham
```

### 2. Instalar Dependencias

```bash
npm install
```

### 3. Configurar Variables de Entorno

Copia el archivo de ejemplo y edítalo:

```bash
cp .env.example .env
```

Genera un secreto para sesiones:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Edita `.env` y pega el secreto generado:
```env
PORT=3005
SESSION_SECRET=tu_secreto_generado_aqui
PANELAMCHAM_ADMIN_PASSWORD=tu_contraseña_admin_segura
NODE_ENV=development
```

### 4. Configurar Usuarios Iniciales

Copia el archivo de ejemplo:
```bash
cp src/config/seed_users.example.json src/config/seed_users.json
```

Edita `src/config/seed_users.json` con tus usuarios reales:

```json
[
  {
    "username": "nombre.apellido",
    "nombres": "Nombre",
    "apellidoPrimero": "Apellido",
    "correo": "nombre@empresa.com",
    "permissions": [
      {
        "empresaId": "EMPRESA01",
        "modulo": "presupuestos",
        "puede_leer": true,
        "puede_cargar_guardar": true,
        "puede_revisar": false,
        "puede_aprobar": false
      }
    ]
  }
]
```

### 5. Iniciar la Aplicación

**Modo Desarrollo:**
```bash
npm start
```

La aplicación iniciará en Electron y el servidor en `http://localhost:3005`.

**Modo Servidor Solamente:**
```bash
npm run server
```

### 6. Usuario Administrador

La aplicación crea automáticamente un usuario administrador llamado **ICONET**:

- **Usuario:** `ICONET`
- **Contraseña:** La que configuraste en `PANELAMCHAM_ADMIN_PASSWORD`

Si no configuraste contraseña, se generará una aleatoria que verás en la consola.

## Scripts Disponibles

| Script | Descripción |
|--------|-------------|
| `npm start` | Inicia la aplicación Electron |
| `npm run server` | Solo inicia el servidor Node.js |
| `npm run dev` | Modo desarrollo con recarga automática |
| `npm run build` | Crea ejecutable de producción |
| `npm run build:win` | Build para Windows |

## Estructura de Carpetas Importantes

```
SummaCham/
├── datos/              # Base de datos SQLite (generada automáticamente)
├── src/
│   ├── config/
│   │   └── seed_users.json  # Usuarios iniciales (debes crearlo)
│   ├── db/             # Módulos de base de datos
│   ├── routes/         # Rutas de la API
│   └── server.js       # Servidor Express
├── vistas/             # Frontend HTML/CSS/JS
├── main.js             # Punto de entrada de Electron
├── .env                # Variables de entorno (debes crearlo)
└── package.json
```

## Verificación de la Instalación

### 1. Verifica que el servidor inició correctamente

Deberías ver en la consola:
```
✅ Base de datos SQLite inicializada
Seeding completed: X users processed
Conectando a Firebird - Base de datos SALDOS25
Servidor Node.js corriendo en el puerto 3005
```

### 2. Verifica la ventana de Electron

- La aplicación debe abrir una ventana
- DevTools deben abrirse automáticamente (en desarrollo)
- Debes ver el login

### 3. Inicia sesión

- Usuario: `ICONET`
- Contraseña: La que configuraste en `.env`

## Solución de Problemas Comunes

### Error: "Cannot find module '.env'"
**Solución:** Asegúrate de crear el archivo `.env` copiando `.env.example`

### Error: "EADDRINUSE :::3005"
**Solución:** El puerto está ocupado. Cierra otras instancias o cambia el puerto en `.env`

### La ventana de Electron no abre
**Solución:** 
```bash
# Termina procesos previos
taskkill /F /IM electron.exe /T
npm start
```

### No puedo iniciar sesión
**Solución:** Verifica la contraseña en `.env` o revisa la consola para ver la contraseña generada

### Error de base de datos Firebird
**Solución:** Verifica que las rutas en `src/db/firebird.js` apunten a tus archivos `.FDB` reales

## Configuración de Base de Datos Firebird

Edita `src/db/firebird.js` con las rutas de tus bases de datos:

```javascript
const CONFIG_DATABASES = {
  SALDOS25: 'C:\\ruta\\a\\tu\\SALDOS25.FDB',
  PRESUP25: 'C:\\ruta\\a\\tu\\PRESUP25.FDB'
};
```

## Siguiente Paso: Build de Producción

Una vez que todo funciona en desarrollo, puedes crear el ejecutable:

```bash
npm run build
```

El instalador se generará en la carpeta `release/`.

## Soporte

Si encuentras problemas:
1. Revisa los logs en la consola
2. Verifica que todos los archivos de configuración existan
3. Abre un issue en GitHub con los detalles del error

---

## SISTEMA_ACTUALIZACIONES.md

_Fuente: `SISTEMA_ACTUALIZACIONES.md`_

# Sistema de Actualizaciones Automáticas - SummaCham

## 📋 Descripción General

El sistema utiliza **electron-updater** para proporcionar actualizaciones automáticas mediante GitHub Releases. El proceso es no-intrusivo y permite al usuario controlar cuándo descargar e instalar las actualizaciones.

---

## 🔄 Flujo de Actualización

### 1. **Verificación Automática al Iniciar**
- La aplicación verifica actualizaciones 5 segundos después de iniciarse (solo en versión empaquetada)
- Se ejecuta en segundo plano sin interrumpir al usuario

### 2. **Verificación Manual**
- El usuario puede buscar actualizaciones desde el menú del tray: **"Buscar actualizaciones"**
- Disponible en cualquier momento mientras la aplicación está ejecutándose

### 3. **Actualización Disponible**
```
┌─────────────────────────────────────┐
│  Actualización disponible           │
│                                     │
│  Nueva versión X.Y.Z disponible     │
│  Versión actual: A.B.C              │
│  Nueva versión: X.Y.Z               │
│                                     │
│  ¿Deseas descargar e instalar?      │
│                                     │
│  [Descargar ahora]  [Más tarde]    │
└─────────────────────────────────────┘
```

### 4. **Descarga en Progreso**
- Muestra notificación: "Descargando actualización..."
- El título de la ventana muestra el progreso: `Panel AMCHAM - Descargando: 45%`
- El proceso no bloquea el uso de la aplicación

### 5. **Actualización Descargada**
```
┌─────────────────────────────────────┐
│  Actualización lista                │
│                                     │
│  Versión X.Y.Z lista para instalar  │
│                                     │
│  ¿Deseas reiniciar ahora para       │
│  aplicar la actualización?          │
│                                     │
│  [Reiniciar ahora]  [Más tarde]    │
└─────────────────────────────────────┘
```

**Si elige "Reiniciar ahora":**
- La aplicación se cierra
- La actualización se instala automáticamente
- La aplicación se reinicia con la nueva versión

**Si elige "Más tarde":**
- Recibe notificación: "La actualización se instalará cuando cierres la aplicación"
- La actualización se instala automáticamente al cerrar la app (`autoInstallOnAppQuit = true`)

---

## ⚙️ Configuración Técnica

### Archivo: `main.js`
```javascript
const { autoUpdater } = require("electron-updater");

// Configuración
autoUpdater.autoDownload = false;        // No descargar automáticamente
autoUpdater.autoInstallOnAppQuit = true; // Instalar al cerrar si está pendiente
```

### Eventos Implementados
| Evento | Descripción | Acción |
|--------|-------------|--------|
| `checking-for-update` | Iniciando verificación | Log en consola |
| `update-available` | Nueva versión encontrada | Diálogo de confirmación |
| `update-not-available` | Ya está actualizado | Log en consola |
| `download-progress` | Progreso de descarga | Actualiza título de ventana |
| `update-downloaded` | Descarga completada | Diálogo para reiniciar |
| `error` | Error en el proceso | Mensaje de error al usuario |

---

## 📦 Publicación de Actualizaciones

### Paso 1: Incrementar Versión
```powershell
# Editar package.json
"version": "1.0.1"  # Nueva versión
```

### Paso 2: Construir la Aplicación
```powershell
npm run build
# O para portable:
npm run build:portable
```

Esto genera:
- `dist/SummaCham Setup 1.0.1.exe` (instalador NSIS)
- `dist/SummaCham 1.0.1.exe` (versión portable)
- `dist/latest.yml` (metadata para actualizaciones)

### Paso 3: Crear Release en GitHub
```powershell
# Opción 1: Publicar automáticamente
npm run publish

# Opción 2: Manual en GitHub
# 1. Ir a: https://github.com/IustusRenidet/SummaCham/releases/new
# 2. Tag version: v1.0.1
# 3. Release title: v1.0.1
# 4. Subir archivos:
#    - SummaCham Setup 1.0.1.exe
#    - SummaCham 1.0.1.exe
#    - latest.yml
# 5. Publicar release
```

### Archivos Requeridos en el Release
```
✓ SummaCham Setup X.Y.Z.exe   (Instalador NSIS - x64)
✓ SummaCham Setup X.Y.Z-ia32.exe   (Instalador NSIS - 32-bit)
✓ SummaCham X.Y.Z.exe         (Portable - x64)
✓ SummaCham X.Y.Z-ia32.exe    (Portable - 32-bit)
✓ latest.yml                  (Metadata - REQUERIDO)
```

---

## 🔍 Verificación del Sistema

### Comprobar Configuración
```javascript
// En main.js - verifica que existan:
const { autoUpdater } = require("electron-updater");
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;
```

### Comprobar package.json
```json
{
  "version": "1.0.0",
  "build": {
    "publish": [{
      "provider": "github",
      "owner": "IustusRenidet",
      "repo": "SummaCham"
    }]
  }
}
```

### Logs de Depuración
El sistema escribe logs en consola:
```
🔍 Verificando actualizaciones...
✨ Nueva actualización disponible: 1.0.1
✓ Aplicación actualizada (versión 1.0.0)
❌ Error en auto-updater: ...
```

---

## 📌 Notas Importantes

### ⚠️ Solo en Versión Empaquetada
- Las actualizaciones **NO funcionan en modo desarrollo** (`npm start`)
- Solo funcionan en la aplicación compilada (`.exe`)

### 🔐 Requisitos de GitHub
- El repositorio debe ser público O tener un token de acceso configurado
- Los releases deben estar publicados (no draft)
- El archivo `latest.yml` es **OBLIGATORIO** en cada release

### 🎯 Estrategia de Versiones
- Usar **Semantic Versioning**: `MAJOR.MINOR.PATCH`
  - `MAJOR`: Cambios incompatibles
  - `MINOR`: Nueva funcionalidad compatible
  - `PATCH`: Correcciones de bugs

### 💾 Persistencia de Datos
- Las actualizaciones **NO borran**:
  - Base de datos SQLite (`usuarios.db`)
  - Configuración de usuario
  - Archivos en carpeta de datos
- Solo se reemplaza el ejecutable y archivos de la aplicación

---

## 🧪 Pruebas

### Probar Actualización Localmente
```powershell
# 1. Compilar versión 1.0.0
npm run build

# 2. Instalar versión 1.0.0
# Ejecutar: dist/SummaCham Setup 1.0.0.exe

# 3. Cambiar version a 1.0.1 en package.json

# 4. Compilar nueva versión
npm run build

# 5. Crear release en GitHub con archivos de 1.0.1

# 6. Abrir app versión 1.0.0
# Ir a tray > "Buscar actualizaciones"
# Verificar que detecta la 1.0.1
```

---

## 🚀 Flujo Completo de Despliegue

```mermaid
graph TD
    A[Desarrollar nuevas funciones] --> B[Incrementar versión en package.json]
    B --> C[npm run build]
    C --> D[Generar .exe e instaladores]
    D --> E[Crear release en GitHub]
    E --> F[Subir archivos: .exe + latest.yml]
    F --> G[Publicar release]
    G --> H[Usuarios reciben notificación de actualización]
    H --> I[Usuario descarga e instala]
```

---

## 📞 Solución de Problemas

### "No se detectan actualizaciones"
1. Verificar que `app.isPackaged === true`
2. Comprobar que existe release en GitHub
3. Verificar que `latest.yml` está en el release
4. Revisar logs en consola del Electron

### "Error al descargar actualización"
1. Verificar conexión a internet
2. Comprobar que el release es público
3. Verificar que los archivos no están corruptos

### "La actualización no se instala"
1. Verificar permisos de escritura en carpeta de instalación
2. Comprobar que no hay antivirus bloqueando
3. Verificar que `autoInstallOnAppQuit = true`

---

## 📚 Referencias

- [electron-updater Documentation](https://www.electron.build/auto-update)
- [GitHub Releases API](https://docs.github.com/en/rest/releases)
- [Electron Builder](https://www.electron.build/)

---

## SISTEMA_BACKUPS.md

_Fuente: `SISTEMA_BACKUPS.md`_

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

---

## SOLUCION_ERROR_NODE_MODULE_VERSION.md

_Fuente: `SOLUCION_ERROR_NODE_MODULE_VERSION.md`_

# Solución: Error NODE_MODULE_VERSION en better-sqlite3

## Problema

Al instalar la aplicación empaquetada, aparece el error:
```
The module 'better_sqlite3.node' was compiled against a different Node.js version using
NODE_MODULE_VERSION 127. This version of Node.js requires NODE_MODULE_VERSION 140.
```

## Causa

El módulo nativo `better-sqlite3` no fue recompilado correctamente para la versión de Electron (39.2.7) antes de publicar. El módulo quedó compilado para una versión anterior.

## Solución Implementada

### 1. Script de Pre-publicación

Se creó `scripts/prepublish.js` que automáticamente:
- Limpia compilaciones anteriores
- Recompila better-sqlite3 para Electron 39.2.7
- Guarda y activa el binario correcto

### 2. Comando Actualizado

Ahora `npm run publish` ejecuta automáticamente el script de preparación antes de publicar.

## Cómo Publicar Correctamente

### Opción 1: Automática (Recomendada)
```bash
npm run publish
```

Esto automáticamente:
1. Ejecuta `prepublish` para recompilar
2. Publica la aplicación con el binario correcto

### Opción 2: Manual
Si necesitas más control:

```bash
# 1. Recompilar para Electron
npm run rebuild-native-electron

# 2. Verificar estado
npm run native:status

# 3. Publicar
npm run publish
```

## Verificación

Después de ejecutar la recompilación, verifica:

```bash
npm run native:status
```

Debes ver:
```
[native-modules] Estado actual:
  • almacen node: OK (native_modules/node)
  • almacen electron: OK (native_modules/electron)
  • activo: node_modules/better-sqlite3/build/Release/better_sqlite3.node
```

## Scripts Disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run rebuild-native-node` | Recompila para Node.js |
| `npm run rebuild-native-electron` | Recompila para Electron |
| `npm run rebuild-native` | Recompila para ambos |
| `npm run native:use-electron` | Activa binario Electron |
| `npm run native:use-node` | Activa binario Node |
| `npm run native:status` | Muestra estado actual |

## Solución para Usuario Final

Si un usuario ya instaló la versión con el error, debe:

1. **Desinstalar la versión actual**
2. **Descargar e instalar la nueva versión** desde GitHub releases

No es necesario ninguna acción manual del usuario, solo reinstalar.

## Prevención

Para evitar este error en futuras publicaciones:

1. ✅ **Siempre usar** `npm run publish` (no publicar manualmente)
2. ✅ Verificar que no hay cambios pendientes en `native_modules/`
3. ✅ Probar la aplicación empaquetada localmente antes de publicar:
   ```bash
   npm run dist
   # Instalar y probar el instalador generado en dist/
   ```

## Notas Técnicas

- **NODE_MODULE_VERSION 127** = Electron 28.x / Node.js 20.x
- **NODE_MODULE_VERSION 140** = Electron 33.x / Node.js 22.x
- **Electron 39.2.7** (nuestra versión) requiere NODE_MODULE_VERSION 140

## Checklist Pre-Publicación

Antes de cada publicación, verifica:

- [ ] Todos los cambios están commiteados
- [ ] `npm run rebuild-native-electron` ejecutado sin errores
- [ ] `npm run native:status` muestra "almacen electron: OK"
- [ ] La aplicación funciona con `npm start:prod`
- [ ] Los tests pasan (si aplica)
- [ ] Version actualizada en package.json

## Contacto

Si el problema persiste después de seguir estos pasos, contactar al equipo de desarrollo.
