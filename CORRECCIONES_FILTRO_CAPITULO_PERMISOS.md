# Correcciones: Filtro Capítulo y Permisos Universales

## ✅ Implementado

### 1. Filtro por Capítulo en RESUMEN

**Ubicación:** `vistas/RESUMEN.html` y `vistas/js/resumen-view.js`

**Cambios:**

1. **HTML (línea ~670-695):** Agregado selector de capítulo
```html
<div class="col-12 col-sm-6 col-md-4 col-lg-3">
  <label for="resumenCapituloSelect" class="form-label fw-semibold text-muted small mb-2">Capítulo</label>
  <select id="resumenCapituloSelect" class="form-select">
    <option value="">Todos</option>
    <option value="CIUDAD DE MÉXICO">Ciudad de México</option>
    <option value="GUADALAJARA">Guadalajara</option>
    <option value="NORESTE">Noreste</option>
    <option value="NOROESTE">Noroeste</option>
  </select>
</div>
```

2. **JavaScript:** Sincronización con empresa activa
   - `capituloSelect` agregado a referencias DOM (línea 39)
   - `fetchResumen()` prioriza capítulo seleccionado manualmente sobre capítulo de empresa (líneas 810-820)
   - `aplicarEmpresaResumen()` sincroniza selector con empresa activa (líneas 850-858)
   - `handleCapituloChange()` recarga datos al cambiar capítulo (líneas 943-948)
   - Event listener en `capituloSelect` (líneas 964-966)

**Comportamiento:**
- Al cargar RESUMEN, el selector se sincroniza con la empresa activa
- Usuario puede cambiar manualmente el capítulo para ver datos de otra región
- Si no hay selección manual (`Todos`), usa el capítulo de la empresa activa
- Cambios de capítulo recargan datos instantáneamente

**Backend:**
- Endpoint `/api/reportes/resumen` ya acepta parámetro `capitulo` (src/routes/reportes.js línea 68)
- Validación Joi incluye `capitulo: Joi.string().trim().optional()` (línea 15)

---

### 2. Permisos Universales para SUMMARY, RESUMEN y Presupuestos

**Ubicación:** `src/middleware/auth.js`

**Cambios (líneas 153-169):**

```javascript
const tienePermisoModulo = (mapaPermisos, empresaId, modulo, accion) => {
  if (!empresaId || !modulo) return false;
  
  // Módulos con acceso universal (todos pueden ver)
  const modulosUniversales = ['SUMMARY', 'RESUMEN', 'PRESUPUESTOS'];
  const moduloNormalizado = (modulo || '').toString().toUpperCase().trim();
  
  if (modulosUniversales.includes(moduloNormalizado)) {
    // Para módulos universales, siempre permitir lectura
    if (!accion || accion === 'Lectura') {
      return true;
    }
    // Para otras acciones (Cargar y guardar, Revisar, Aprobar), verificar permisos normalmente
  }
  
  const permisos = mapaPermisos?.[empresaId]?.[modulo];
  if (!permisos) return false;
  if (!accion) {
    return Boolean(permisos.Lectura || permisos['Cargar y guardar'] || permisos.Revisar || permisos.Aprobar);
  }
  return Boolean(permisos[accion]);
};
```

**Comportamiento:**
- **SUMMARY, RESUMEN, Presupuestos:** Todos los usuarios tienen **permiso de lectura automático**
- **Otras acciones (Cargar y guardar, Revisar, Aprobar):** Requieren permisos específicos en tabla `permisos_modulo`
- **Admin global (ICONET):** Acceso completo a todo sin restricciones
- **Otros módulos:** Mantienen sistema de permisos original

---

### 3. Confirmación: API_BASE Dinámico en Módulos

**Archivos corregidos anteriormente:**
- ✅ `vistas/usuarios.html` (línea 185)
- ✅ `vistas/crear_usuario.html` (línea 207)
- ✅ `vistas/login.html` (línea 116)

**Módulos de planeación:**
- ✅ `vistas/js/planeacion-modulo-vista.js` (líneas 2-3) - **Ya tenía API_BASE dinámico**

```javascript
const origin = window.location.protocol === 'file:' ? 'http://localhost:3005' : window.location.origin;
const API_BASE = `${origin}/api`;
```

**12 módulos que usan `planeacion-modulo-vista.js`:**
1. Comités
2. Comunicación
3. Dirección
4. Eventos
5. Finanzas
6. Gtos Corporativos
7. Membresía
8. Presupuestos
9. RH
10. Serv Membresía
11. T&IC
12. VPE

**Reportes:**
- ✅ `vistas/js/summary-view.js` - Ya tenía detección dinámica
- ✅ `vistas/js/resumen-view.js` - Ya tenía detección dinámica

---

## 📦 Estado de Producción

### Funcionando en https://panelamcham.iconetcloud.com.mx

**Correcto:**
- ✅ SUMMARY (muestra datos)
- ✅ RESUMEN (muestra datos + **nuevo filtro capítulo**)
- ✅ 12 módulos de planeación (ahora funcionan)
- ✅ Gestión de usuarios (ahora funciona)
- ✅ Crear usuario (ahora funciona)
- ✅ Login (ahora funciona)

**Infraestructura:**
- Túnel HTTP: `localhost:3005` → `https://panelamcham.iconetcloud.com.mx`
- Túnel TCP: `localhost:15350` → Firebird `127.0.0.1:3050`
- SQLite: `C:\Users\Frida Sophia\AppData\Roaming\panel-amcham\datos\panel.sqlite`

---

## 🧪 Pruebas Sugeridas

### 1. Filtro Capítulo en RESUMEN
1. Abrir RESUMEN con usuario empresa Ciudad de México
2. Verificar que selector capítulo muestre "Ciudad de México" por defecto
3. Cambiar a "Guadalajara"
4. Confirmar que tabla se recarga con datos de Guadalajara
5. Cambiar a "Todos"
6. Confirmar que muestra datos consolidados

### 2. Permisos Universales
1. Crear usuario sin permisos en tabla `permisos_modulo`
2. Login con ese usuario
3. Verificar que puede acceder a:
   - SUMMARY ✅
   - RESUMEN ✅
   - Presupuestos ✅
4. Verificar que **NO** puede:
   - Cargar/guardar en SUMMARY (sin permiso específico)
   - Revisar/aprobar RESUMEN (sin permiso específico)
   - Editar otros módulos (Comités, Eventos, etc.)

### 3. Producción HTTPS
1. Abrir `https://panelamcham.iconetcloud.com.mx`
2. Login con usuario válido
3. Navegar por todos los módulos:
   - SUMMARY: Verificar carga de datos
   - RESUMEN: Verificar filtro capítulo funcional
   - Comités, Comunicación, etc.: Verificar carga de años y datos
   - Usuarios: Verificar listado de usuarios

---

## 🎯 Pendiente (Usuario Mencionó)

- ❌ Empaquetar con `npm run dist` para distribución final
- ❌ Probar app empaquetada en producción
- ❌ Verificar que túnel TCP Firebird (15350) esté corriendo
- ❌ Validar que todos los módulos persistan datos correctamente

---

## 📝 Notas Técnicas

### Orden de Prioridad de Capítulo (RESUMEN)
1. **Capítulo seleccionado manualmente** (`capituloSelect.value`)
2. **Capítulo de empresa activa** (`CapitulosModulos.obtenerCapituloPorEmpresa()`)
3. **Sin filtro** (si ambos están vacíos)

### Módulos Universales (Lectura)
```javascript
const modulosUniversales = ['SUMMARY', 'RESUMEN', 'PRESUPUESTOS'];
```
- Cualquier usuario autenticado puede **leer** estos módulos
- Acciones especiales (Cargar, Revisar, Aprobar) requieren permisos explícitos

### API_BASE Detección
```javascript
const origin = window.location.protocol === 'file:' 
  ? 'http://localhost:3005' 
  : window.location.origin;
```
- `file://` → Desarrollo local → `http://localhost:3005`
- `http://` o `https://` → Producción → Mismo origen que la página

---

## ✅ Resumen Ejecutivo

**Objetivo:** Agregar filtro de capítulo en RESUMEN + permisos universales para SUMMARY/RESUMEN/Presupuestos

**Resultado:**
1. ✅ Filtro capítulo implementado con sincronización automática con empresa activa
2. ✅ Permisos universales agregados (todos pueden ver SUMMARY/RESUMEN/Presupuestos)
3. ✅ Confirmado que todos los módulos de planeación tienen API_BASE dinámico
4. ✅ Sistema listo para empaquetar y desplegar en producción

**Impacto:**
- **RESUMEN:** Ahora usuarios pueden filtrar por región sin cambiar de empresa
- **Permisos:** Usuarios básicos pueden consultar reportes principales sin configuración compleja
- **Producción:** Todos los módulos ahora funcionan en HTTPS sin hardcodeo de localhost
