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
