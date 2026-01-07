# 🔧 FIX: Timeout en Conexiones Remotas para Año 2026

## 🐛 Problema Identificado

### Síntomas
- **En desarrollo local**: Todas las empresas (Guadalajara, CDMX, Noreste, Noroeste) funcionan correctamente
- **En producción remota**: Solo CDMX y Noreste muestran información completa
- **Año afectado**: 2026 (años anteriores como 2025 funcionan)
- **Comportamiento parcial**: En Noroeste algunas cuentas sí cargan pero no todas

### Causa Raíz

**node-firebird** usa configuración por defecto muy restrictiva:
- `retryLimit: 0` → Sin reintentos en caso de timeout
- `connectTimeout: 3000ms` → Timeout de conexión muy bajo para remoto
- `timeout: 10000ms` → Timeout de query insuficiente para consultas grandes

**Por qué falla en producción remota pero no en desarrollo:**

| Aspecto | Desarrollo (Local) | Producción (Remoto) |
|---------|-------------------|---------------------|
| **Latencia** | < 1ms | 50-200ms |
| **Consultas 2026** | Responde rápido | Puede exceder timeout |
| **Datos grandes** | Sin problema | Guadalajara/Noroeste fallan |
| **Reintentos** | No necesarios | Críticos para estabilidad |

**Por qué 2026 es más problemático:**
- Más registros acumulados
- Tablas `SALDOS26` y `CUENTAS26` más grandes
- Consultas con `LEFT JOIN` toman más tiempo
- La latencia remota + consultas pesadas = TIMEOUT

## ✅ Solución Implementada

### Cambios en `src/services/firebirdService.js`

#### 1. Detección Automática de Conexión Remota

```javascript
const esConexionRemota = () => {
  const host = process.env.FIREBIRD_HOST || '127.0.0.1';
  const port = Number(process.env.FIREBIRD_PORT) || 3050;
  return port !== 3050 || (host !== '127.0.0.1' && host !== 'localhost');
};
```

#### 2. Configuración Adaptativa

```javascript
const OPCIONES_BASE = {
  host: process.env.FIREBIRD_HOST || '127.0.0.1',
  port: Number(process.env.FIREBIRD_PORT) || 3050,
  user: process.env.FIREBIRD_USER || 'sysdba',
  password: process.env.FIREBIRD_PASSWORD || 'masterkey',
  lowercase_keys: false,
  pageSize: 4096,
  // ⭐ NUEVO: Configuración optimizada para conexiones remotas
  retryLimit: esConexionRemota() ? 3 : 0,        // 3 reintentos remoto
  connectTimeout: esConexionRemota() ? 60000 : 3000,  // 60s remoto, 3s local
  timeout: esConexionRemota() ? 60000 : 10000    // 60s query remoto, 10s local
};
```

#### 3. Logging Mejorado

```javascript
const tiempoInicio = Date.now();
const esRemoto = esConexionRemota();

// ... código de conexión ...

const tiempoTotal = Date.now() - tiempoInicio;
if (tiempoTotal > 2000) {
  console.warn(`⏱️ Query lenta ${esRemoto ? 'REMOTA' : 'LOCAL'}: ${tiempoTotal}ms`);
}
```

## 📊 Resultados Esperados

### Antes
```
Desarrollo:
  ✅ Guadalajara → OK
  ✅ CDMX → OK
  ✅ Noreste → OK
  ✅ Noroeste → OK

Producción (Remoto):
  ❌ Guadalajara → TIMEOUT
  ✅ CDMX → OK
  ✅ Noreste → OK
  ⚠️ Noroeste → Parcial
```

### Después
```
Desarrollo:
  ✅ Guadalajara → OK (sin cambios)
  ✅ CDMX → OK (sin cambios)
  ✅ Noreste → OK (sin cambios)
  ✅ Noroeste → OK (sin cambios)

Producción (Remoto):
  ✅ Guadalajara → OK (con reintentos)
  ✅ CDMX → OK (más rápido)
  ✅ Noreste → OK (más rápido)
  ✅ Noroeste → OK (todas las cuentas)
```

## 🔍 Diagnóstico

### Ver logs de conexión

Al iniciar la aplicación verás:
```
🔥 Firebird 🏠 LOCAL: 127.0.0.1:3050        # Desarrollo
🔥 Firebird 📡 REMOTA: 127.0.0.1:15350      # Producción
```

### Ver queries lentas

```
⏱️ Query lenta REMOTA: 4523ms (1234 filas)
```

### Ver errores de timeout

```
❌ Error query REMOTA (59842ms): Connection timeout
```

## 🧪 Pruebas

### 1. Verificar en Desarrollo (Local)
```bash
# Debe mostrar: 🔥 Firebird 🏠 LOCAL: 127.0.0.1:3050
npm start
```

### 2. Verificar en Producción (Remota)
```bash
# Debe mostrar: 🔥 Firebird 📡 REMOTA: 127.0.0.1:15350
# Abrir la aplicación empaquetada
```

### 3. Probar con 2026
1. Seleccionar empresa: **Guadalajara**
2. Seleccionar año: **2026**
3. Ir a cualquier módulo
4. **Resultado esperado**: Debe cargar todas las cuentas sin timeout

### 4. Probar con Noroeste
1. Seleccionar empresa: **Noroeste**
2. Seleccionar año: **2026**
3. Verificar que TODAS las cuentas carguen

## ⚙️ Configuración

### Variables de Entorno

#### Desarrollo (.env.development)
```env
FIREBIRD_HOST=127.0.0.1
FIREBIRD_PORT=3050        # Puerto local → Timeouts bajos
```

#### Producción (.env.production)
```env
FIREBIRD_HOST=127.0.0.1
FIREBIRD_PORT=15350       # Puerto túnel → Timeouts altos
```

### Ajustar Timeouts (Opcional)

Si aún experimentas timeouts en producción con bases muy grandes:

```javascript
// En src/services/firebirdService.js
connectTimeout: esConexionRemota() ? 90000 : 3000,  // Aumentar a 90s
timeout: esConexionRemota() ? 90000 : 10000         // Aumentar a 90s
```

## 📈 Optimizaciones Adicionales

### 1. Índices en Base de Datos
Asegurar que existan índices en:
- `CUENTAS26.NUM_CTA`
- `CUENTAS26.STATUS`
- `SALDOS26.NUM_CTA`
- `SALDOS26.EJERCICIO`

### 2. Consultas con LIMIT
Para vistas que muestran pocas cuentas, agregar `FIRST N`:

```sql
SELECT FIRST 100
  c.num_cta AS cuenta,
  c.nombre AS nombre
FROM CUENTAS26 c
WHERE c.status = 'A'
ORDER BY c.num_cta
```

### 3. Cache de Cuentas
Implementar cache en memoria para cuentas consultadas frecuentemente.

## 📝 Notas Técnicas

### Por qué 3 reintentos
- 1er intento: Puede fallar por latencia momentánea
- 2do intento: Suele funcionar si la red se estabiliza
- 3er intento: Último recurso antes de reportar error

### Por qué 60 segundos
- Consultas grandes en 2026 pueden tomar 10-30s
- Latencia de red remota: 5-10s adicionales
- Margen de seguridad: 20-40s
- **Total**: 60s es seguro sin ser excesivo

### Impacto en Desarrollo
**Ninguno**. La detección automática mantiene timeouts bajos para local.

## 🚀 Despliegue

1. **Compilar nueva versión**:
   ```bash
   npm run dist
   ```

2. **Probar localmente primero**:
   ```bash
   npm start
   # Verificar que sigue funcionando igual
   ```

3. **Instalar en producción**:
   - Cerrar aplicación actual
   - Instalar nuevo `.exe`
   - Abrir y verificar log: `🔥 Firebird 📡 REMOTA`

4. **Verificar corrección**:
   - Probar Guadalajara 2026
   - Probar Noroeste 2026 (todas las cuentas)
   - Verificar que CDMX y Noreste sigan funcionando

## ✅ Checklist de Verificación

- [ ] Desarrollo local sigue funcionando igual
- [ ] Log muestra `🏠 LOCAL` en desarrollo
- [ ] Log muestra `📡 REMOTA` en producción
- [ ] Guadalajara 2026 carga completo en producción
- [ ] Noroeste 2026 carga TODAS las cuentas en producción
- [ ] CDMX y Noreste siguen funcionando
- [ ] No aparecen timeouts en logs
- [ ] Queries lentas se reportan en consola (>2s)

---

**Fecha**: 7 de enero de 2026  
**Versión afectada**: < v1.1.21  
**Versión corregida**: >= v1.1.21  
**Archivos modificados**: `src/services/firebirdService.js`
