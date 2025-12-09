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
