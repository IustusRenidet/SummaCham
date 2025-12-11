# SummaCham 📊

> Aplicación de escritorio para gestión financiera empresarial con Electron, Node.js y Firebird.

[![Electron](https://img.shields.io/badge/Electron-30.0.0-blue.svg)](https://www.electronjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## 🚀 Características

- ✅ Sistema multi-usuario con roles y permisos
- ✅ Gestión de presupuestos y reportes financieros
- ✅ Integración con bases de datos Firebird
- ✅ Flujo de autorización y revisión de documentos
- ✅ Actualizaciones automáticas via GitHub Releases
- ✅ Sistema de borradores y guardado automático
- ✅ Visualización de datos con tablas interactivas
- ✅ Toggle de redondeo de cifras en todas las tablas
- ✅ Exportación de reportes (próximamente)

---

## 📋 Requisitos Previos

- **Node.js** 18.x o superior ([Descargar](https://nodejs.org/))
- **npm** 9.x o superior (viene con Node.js)
- **Windows** 10/11 (para builds de Electron)
- **Firebird 2.5+** (opcional, solo si usas bases de datos Firebird)

---

## ⚡ Instalación Rápida

### 1. Clonar el Repositorio

```bash
git clone https://github.com/IustusRenidet/SummaCham.git
cd SummaCham
```

### 2. Instalar Dependencias

```bash
npm install
```

### 3. Configurar Ambiente

**Copia el archivo de ejemplo:**
```bash
cp .env.example .env
```

**Genera un secreto seguro para sesiones:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Edita `.env` y agrega tus valores:**
```env
PORT=3005
SESSION_SECRET=tu_secreto_generado_aqui
PANELAMCHAM_ADMIN_PASSWORD=tu_contraseña_admin_segura
NODE_ENV=development
```

### 4. Configurar Usuarios Iniciales

```bash
cp src/config/seed_users.example.json src/config/seed_users.json
```

Edita `seed_users.json` con tus usuarios reales.

### 5. Iniciar la Aplicación

```bash
npm start
```

🎉 ¡La aplicación debería abrirse automáticamente!

**Credenciales por defecto:**
- Usuario: `ICONET`
- Contraseña: La que configuraste en `PANELAMCHAM_ADMIN_PASSWORD`

---

## 📖 Documentación Completa

- **[Setup Inicial](SETUP_INICIAL.md)** - Guía detallada paso a paso
- **[Seguridad](SEGURIDAD.md)** - Cómo proteger información sensible
- **[Actualizaciones](docs/ACTUALIZACIONES_GUIA_RAPIDA.md)** - Sistema de auto-actualización
- **[API Reference](docs/API.md)** - Endpoints y autenticación *(próximamente)*

---

## 🛠️ Scripts Disponibles

| Script | Descripción |
|--------|-------------|
| `npm start` | Inicia la aplicación en Electron |
| `npm run server` | Solo inicia el servidor Node.js |
| `npm run dev` | Modo desarrollo con hot-reload |
| `npm run build` | Crea ejecutable de producción |
| `npm run build:win` | Build específico para Windows |
| `npm run audit-security` | Audita el repo antes de publicar |

---

## 📁 Estructura del Proyecto

- `npm start`: inicia la app en modo desarrollo.
- `npm run pack`: genera un paquete sin instalador (modo directorio).
- `npm run dist`: genera el ejecutable portable listo para distribución.
 - `npm run build:portable`: genera el artifact portable (`portable`) para Windows (x64 + ia32).
 - `npm run build:all`: genera installer + portable (NSIS + portable) para Windows (x64 + ia32).

## Hardening de la cuenta ICONET (admin global)

- La cuenta `ICONET` se crea al inicializar la base de datos. Define antes de arrancar la app la variable `PANELAMCHAM_ADMIN_PASSWORD` (o `ICONET_PASSWORD`) para establecer/rotar la contrasena y evitar la clave por defecto.
- Si la cuenta ya existe y defines la variable, al siguiente arranque se actualiza el hash de `ICONET` automaticamente; no se registran ni exponen contrasenas en logs.
- Tras la rotacion, distribuye la nueva credencial de forma segura y elimina la variable del entorno de ejecucion si no deseas que se siga aplicando en reinicios posteriores.

## Notas adicionales

- El archivo `.gitignore` incluye directorios generados y artefactos temporales comunes.
- Para personalizar el icono actualiza los recursos en `icono/icono.ico` y `icono/icono.png`.

## Reportes Summary y Resumen

Los reportes ahora usan la misma arquitectura de secciones que los módulos de planeación:

- `planeacionReportesEngine` (`src/services/reportes/planeacionReportesEngine.js`) carga `info IMPORTANTE/CUENTAS SUMMARY y RESUMEN.xlsx` para definir capítulos/secciones, normaliza las cuentas y aplica `info IMPORTANTE/SUMAS CIUDAD DE MEXICO.csv` para sumar ingresos y restar gastos hacia los resultados operativos y los totales consolidados. Crea nodos con `children` como en planeación para poder pintar el overlay de secciones.
- `summaryEngine` y `resumenEngine` (`src/services/engines/`) exponen funciones ligeras que ejecutan `generarReporte('SUMMARY', …)` y `generarReporte('RESUMEN', …)` respectivamente.

Los nuevos endpoints consumen esos nodos y devuelven JSON listos para la vista:

- `GET /api/reportes/summary?empresaId=<empresa>&anio=<ejercicio>` → `{ empresaId, reportKey: 'SUMMARY', anio, detalle, resumen }`
- `GET /api/reportes/resumen?empresaId=<empresa>&anio=<ejercicio>` → `{ empresaId, reportKey: 'RESUMEN', anio, detalle, resumen }`

Las vistas `SUMMARY.html` y `RESUMEN.html` usan `js/summary-view.js` y `js/resumen-view.js` para renderizar esas secciones jerárquicas; de esta forma el usuario solo necesita diseñar capítulos/secciones en los archivos Excel/CSV (`CUENTAS SUMMARY y RESUMEN.xlsx` y `SUMAS CIUDAD DE MEXICO.csv`) para que el sistema agregue automáticamente los operativos como ingresos menos gastos y muestre el árbol completo.

