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
