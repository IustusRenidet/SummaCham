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
