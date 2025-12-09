# Arquitectura Multi-Usuario - Panel AMCHAM

## 🏗️ Arquitectura Actual

```
┌─────────────────────────────────────────────────────────────┐
│                    SERVIDOR (Puerto 3005)                    │
│  • Iniciado automáticamente por Electron                    │
│  • Escucha en 0.0.0.0 (todas las interfaces)               │
│  • Accesible local y externamente                           │
└─────────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                │                       │
        ┌───────▼──────┐        ┌──────▼──────┐
        │   TÚNEL HTTPS │        │   LOCALHOST  │
        │   (Público)   │        │   (Local)    │
        └───────┬───────┘        └──────┬───────┘
                │                       │
    ┌───────────┴───────────┐          │
    │                       │          │
┌───▼────┐  ┌───▼────┐  ┌──▼───┐  ┌──▼────┐
│Usuario1│  │Usuario2│  │Usuario│  │Electron│
│Chrome  │  │Firefox │  │  N... │  │ Window │
└────────┘  └────────┘  └──────┘  └────────┘
```

---

## ✅ Características Implementadas

### 1. **Servicio Auto-Contenido**
- ✅ Electron inicia servidor automáticamente al arrancar
- ✅ Auto-inicio con Windows
- ✅ Ícono en system tray
- ✅ Ejecución en segundo plano

### 2. **Acceso Multi-Canal**
```
Local:     http://localhost:3005
Público:   https://panelamcham.iconetcloud.com.mx
Electron:  localhost:3005 (ventana integrada)
```

### 3. **Sesiones Independientes por Usuario**

#### Configuración de Sesiones:
```javascript
{
  secret: 'clave-secreta-sesion',
  name: 'panelamcham.sid',
  maxAge: 7 días,
  secure: 'auto', // HTTP en local, HTTPS en túnel
  sameSite: 'none' // Permite cookies cross-site en HTTPS
}
```

#### ¿Cómo Funcionan?

**Usuario A (desde Chrome):**
```
1. Entra a https://panelamcham.iconetcloud.com.mx
2. Inicia sesión → Cookie: panelamcham.sid=abc123
3. Navega por módulos → Cookie persistente
4. Cierra navegador → Cookie guardada (7 días)
5. Vuelve a entrar → Sesión automáticamente restaurada
```

**Usuario B (desde Firefox - mismo momento):**
```
1. Entra a https://panelamcham.iconetcloud.com.mx
2. Inicia sesión → Cookie: panelamcham.sid=xyz789
3. Sesión INDEPENDIENTE de Usuario A
4. Cada uno ve sus propios datos/empresa/módulo
```

**Usuario C (desde Electron local):**
```
1. Abre app Electron
2. Inicia sesión → Sesión local independiente
3. No interfiere con usuarios A y B
```

---

## 🔐 Sistema de Sesiones

### Almacenamiento Actual (Memoria)
```javascript
// En memoria del proceso Node.js
sessions = {
  'abc123': { userId: 1, empresa: 'EMPRESA01', ... },
  'xyz789': { userId: 2, empresa: 'EMPRESA02', ... },
  'lmn456': { userId: 3, empresa: 'EMPRESA01', ... }
}
```

**Ventajas:**
- ✅ Rápido
- ✅ Múltiples usuarios simultáneos
- ✅ Sesiones independientes

**Desventajas:**
- ⚠️ Si se reinicia servidor, sesiones se pierden
- ⚠️ No compartido entre múltiples procesos

### Mejora Recomendada (Producción)

Para producción considera usar **connect-sqlite3** o **Redis**:

```javascript
const SQLiteStore = require('connect-sqlite3')(session);

app.use(session({
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: './datos'
  }),
  // ... resto de configuración
}));
```

**Beneficios:**
- ✅ Sesiones persisten aunque se reinicie servidor
- ✅ Compartido entre múltiples procesos/servidores
- ✅ Historial de sesiones

---

## 🌐 Configuración del Túnel

### Requisitos para el Túnel HTTPS:

1. **Servidor debe escuchar en 0.0.0.0** ✅ (implementado)
   ```javascript
   app.listen(3005, '0.0.0.0')
   ```

2. **Trust Proxy habilitado** ✅ (implementado)
   ```javascript
   app.set('trust proxy', 1)
   ```

3. **Cookies configuradas para HTTPS** ✅ (implementado)
   ```javascript
   secure: 'auto',
   sameSite: 'none'
   ```

### Ejemplo de Configuración Cloudflare/Ngrok:

```bash
# Ngrok
ngrok http 3005 --domain=panelamcham.iconetcloud.com.mx

# Cloudflare Tunnel
cloudflared tunnel --url localhost:3005
```

---

## 👥 Escenarios de Uso

### Escenario 1: Oficina con Múltiples Usuarios
```
PC1 (Servidor) → Ejecuta Electron → Servidor en 3005
PC2 (Usuario A) → Chrome → https://panelamcham.iconetcloud.com.mx
PC3 (Usuario B) → Firefox → https://panelamcham.iconetcloud.com.mx
PC4 (Usuario C) → Edge → https://panelamcham.iconetcloud.com.mx
```
✅ Cada usuario tiene su propia sesión
✅ Pueden trabajar simultáneamente
✅ Sesiones persisten 7 días

### Escenario 2: Trabajo Remoto
```
Oficina (Servidor) → Electron con túnel HTTPS
Casa (Usuario) → Chrome → https://panelamcham.iconetcloud.com.mx
```
✅ Acceso seguro desde casa
✅ Misma experiencia que en oficina

### Escenario 3: Administrador Local
```
PC Servidor → Abre Electron → Ventana integrada
Otros usuarios → Navegador → Túnel HTTPS
```
✅ Admin usa ventana Electron
✅ Usuarios remotos usan navegador

---

## 🔍 Verificación de Sesiones

### Logs del Servidor:
```bash
npm run server

# Verás:
✓✓✓ SERVIDOR NODE.JS INICIADO EXITOSAMENTE ✓✓✓
  → Servidor corriendo en http://localhost:3005
  → Acceso local: http://localhost:3005
  → Acceso público: https://panelamcham.iconetcloud.com.mx
  → Soporta múltiples usuarios simultáneos con sesiones independientes
  → Sesiones persisten por 7 días
```

### Verificar Usuario Activo:
```javascript
// En cualquier ruta protegida
console.log('Usuario:', req.session.usuario);
console.log('Empresa:', req.session.empresaActiva);
console.log('Session ID:', req.sessionID);
```

---

## 🚨 Solución de Problemas

### "Sesión no persiste al cerrar navegador"
- Verifica que el navegador acepte cookies
- En HTTPS, asegúrate que `sameSite: 'none'` está configurado
- Revisa que `maxAge` esté configurado (7 días)

### "Usuario B ve datos de Usuario A"
- **NO debería pasar** - cada cookie es única
- Verifica que cada navegador/dispositivo tenga su propia cookie
- Revisa que no estén compartiendo navegador/sesión

### "Al reiniciar servidor, todos pierden sesión"
- Normal con store en memoria
- Solución: Implementar SQLite store o Redis

---

## 📊 Monitoreo de Usuarios Activos

Puedes implementar un endpoint para ver usuarios conectados:

```javascript
app.get('/api/admin/sesiones-activas', (req, res) => {
  // Requiere implementar session store
  res.json({
    total: sessionStore.length,
    sesiones: [...] // Lista de sesiones activas
  });
});
```

---

## 🔐 Seguridad Multi-Usuario

### Implementado:
- ✅ Cookies HTTP-only (no accesibles desde JavaScript)
- ✅ CSRF protection (sameSite)
- ✅ Sesiones con timeout (7 días)
- ✅ CORS restringido a dominios permitidos

### Recomendado Agregar:
- 🔲 Rate limiting (limitar requests por usuario)
- 🔲 Session store persistente (SQLite/Redis)
- 🔲 Logs de actividad por usuario
- 🔲 Expiración de sesión por inactividad

---

## 📝 Variables de Entorno

```bash
# .env (opcional)
PORT=3005
NODE_ENV=production
SESSION_SECRET=tu-clave-secreta-super-segura
COOKIE_DOMAIN=.iconetcloud.com.mx
PANELAMCHAM_ALLOW_ORIGINS=https://panelamcham.iconetcloud.com.mx,http://localhost:3005
```
