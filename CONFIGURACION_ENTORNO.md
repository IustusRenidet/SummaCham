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
