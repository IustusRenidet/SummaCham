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
