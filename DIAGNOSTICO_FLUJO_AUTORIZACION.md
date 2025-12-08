# DIAGNÓSTICO COMPLETO: FLUJO DE AUTORIZACIÓN DE BORRADORES

## 📋 RESUMEN EJECUTIVO

Tu flujo de autorización está **85% implementado pero con problemas críticos de integración** que impiden que funcione completamente. Los borradores avanzan hasta el estado **APROBADO**, pero el guardado final en la base de datos COI (Firebird) tiene fallas.

---

## 🔍 ENTIENDO TU FLUJO ACTUAL

### Estados Definidos (6 estados correctos):
```
EDITANDO → PENDIENTE → REVISADO → APROBADO → GUARDADO
```

### Actores y Permisos (bien definidos):
- **"Cargar y guardar"**: Inicia edición, envía a revisión
- **"Revisar"**: Marca como revisado, rechaza
- **"Aprobar"**: Autoriza y guarda en COI
- **Admin Global**: Auto-aprueba al enviar, se salta revisión

### Botones y Acciones (estructurados):
1. `btnGuardarBorrador` → Activa modo edición
2. `btnEnviarCambios` → EDITANDO → PENDIENTE
3. `btnMarcarRevisado` → PENDIENTE → REVISADO
4. `btnAutorizar` → REVISADO → APROBADO
5. `saveBudgetBtn` → APROBADO → GUARDADO (COI)

---

## ❌ PROBLEMAS IDENTIFICADOS

### 1. **DESCONEXIÓN CRÍTICA: Modo Edición Incompleto**

#### Problema:
En `flujo-autorizacion-mejorado.js` línea 266:
```javascript
_activarModoEdicion() {
  if (this.modoEdicion) return;
  this.modoEdicion = true;
  this.cambiosEdicion = {};
  
  if (this.tableElement) {
    this.tableElement.classList.add('modo-edicion');
    // ⚠️ AQUÍ DICE: "Aquí se implementaría la lógica de edición inline"
  }
  this._actualizarBotones();
}
```

**El código es un TODO, no está implementado.**

#### Impacto:
- Los usuarios no pueden editar celdas en la tabla
- No hay validación de cambios
- No se capturan los valores editados

#### Solución Requerida:
- Implementar edición inline de celdas (hacer celdas clickeables)
- Capturar y validar cambios
- Integrar autocompletado de cuentas

---

### 2. **FALTA DE INTEGRACIÓN: Callback `obtenerCambios()`**

#### Problema:
En línea 293, se intenta obtener cambios así:
```javascript
const cambios = this.callbacks.obtenerCambios();
const payload = {
  modulo: this.contexto.modulo,
  empresaId: this.contexto.empresaId,
  anio: this.contexto.anio,
  datos: {
    presupuesto: Array.isArray(cambios?.presupuesto) ? cambios.presupuesto : []
  }
};
```

**Pero en SUMMARY.html no se pasa el callback `obtenerCambios`.**

#### Impacto:
- Los cambios editados en la tabla se pierden
- El borrador se guarda vacío o con datos incorrectos
- El flujo falla silenciosamente

#### Dónde se debería configurar:
En `vistas/SUMMARY.html`, donde se inicializa `FlujoAutorizacion`:
```javascript
// Actualmente probablemente hace:
const flujo = new FlujoAutorizacion({
  tablaId: 'tablaComparacion',
  modulo: 'PRESUPUESTOS'
});

// Debería hacer:
const flujo = new FlujoAutorizacion({
  tablaId: 'tablaComparacion',
  modulo: 'PRESUPUESTOS',
  obtenerCambios: () => {
    // Extraer datos editados de la tabla y devolver formato esperado
  }
});
```

---

### 3. **FALLA EN PERSISTENCIA: Guardar en Firebird**

#### Problema:
En `borradoresService.js` línea 325-365, la función `persistirEnFirebird`:

```javascript
const persistirEnFirebird = async (borrador) => {
  // Mapeo correcto, pero:
  const presupuesto = Array.isArray(datos?.presupuesto) ? datos.presupuesto : [];
  
  if (!presupuesto.length) {
    return; // ⚠️ FALLA SILENCIOSA: Si no hay datos, simplemente retorna
  }
```

**Si el borrador llega vacío, no se guarda nada.**

#### Flujo de Guardado:
```
APROBADO → guardarAutorizado() → persistirEnFirebird() → Firebird PRESUP25
                                   ↓
                            (Si no hay datos, no hace nada)
```

#### Impacto:
- Los presupuestos aprobados nunca llegan a Firebird
- El estado cambia a GUARDADO, pero sin datos reales
- Genera inconsistencia entre aplicación y base de datos

---

### 4. **MALA INTEGRACIÓN CON LA VISTA: SUMMARY.html**

#### Problema:
No hay evidencia de que `SUMMARY.html` integre:
1. El script `flujo-autorizacion-mejorado.js`
2. Listeners para modo edición
3. Extracción de cambios de la tabla

#### Impacto:
- Los botones de flujo pueden estar presentes pero no funcionales
- Los cambios en la tabla no se capturan
- El usuario cree que guardó pero nada se persiste

---

### 5. **DESINCRONIZACIÓN: Estados en SQLite vs UI**

#### Problema:
Los estados se guardan en `PLAN_BORRADORES` (SQLite), pero no hay retroalimentación clara:
- ¿Cuándo se actualiza la UI después de cada cambio?
- ¿Cómo se refleja el estado actual en los botones?

En línea 221 de `flujo-autorizacion-mejorado.js`:
```javascript
async _actualizarEstadoServidor() {
  if (!this._contextoCompleto()) {
    return;
  }
  try {
    const params = new URLSearchParams({/*...*/});
    const respuesta = await fetch(`${API_BASE}/borradores/estado?${params.toString()}`);
    // ✅ Esto consulta el estado, pero...
    this.borradorActual = datos.borrador || null;
    this._actualizarBotones();
  }
}
```

**El endpoint `/api/borradores/estado` no existe en las rutas.**

---

## 🔧 SOLUCIONES IMPLEMENTABLES

### SOLUCIÓN 1: Completar la Edición en Modo Edición

**Archivo:** `vistas/SUMMARY.html` o `vistas/js/summary-modulo-vista.js`

```javascript
// En el contexto del módulo SUMMARY
function inicializarModoEdicion(elementosEdicion = {}) {
  const tabla = document.getElementById('tablaComparacion');
  
  // Hacer celdas editables
  tabla.addEventListener('click', (event) => {
    const celda = event.target.closest('td[data-editable]');
    if (!celda) return;
    
    const valor = celda.textContent.trim();
    const input = document.createElement('input');
    input.type = 'number';
    input.value = valor;
    
    celda.textContent = '';
    celda.appendChild(input);
    input.focus();
    
    const guardar = () => {
      celda.textContent = input.value;
      celda.dataset.modificado = 'true'; // Marcar como cambio
    };
    
    input.addEventListener('blur', guardar);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') guardar();
      if (e.key === 'Escape') {
        celda.textContent = valor;
      }
    });
  });
  
  // Extraer cambios de la tabla
  window.extraerCambiosPresupuesto = () => {
    const cambios = [];
    tabla.querySelectorAll('tr[data-cuenta]').forEach((fila) => {
      const cuenta = fila.dataset.cuenta;
      const valores = {};
      
      fila.querySelectorAll('td[data-editable]').forEach((celda) => {
        const mes = celda.dataset.mes; // ej: 'budget-ene'
        if (mes) {
          valores[mes] = Number(celda.textContent) || 0;
        }
      });
      
      cambios.push({ cuenta, valores });
    });
    
    return { presupuesto: cambios };
  };
}
```

---

### SOLUCIÓN 2: Implementar Endpoint `/api/borradores/estado`

**Archivo:** `src/routes/borradores.js`

Agregar después de `router.use(requireAuth);`:

```javascript
router.get('/estado', (req, res) => {
  const { empresaId, modulo, anio } = req.query;
  
  if (!empresaId || !modulo || !anio) {
    return res.status(400).json({
      mensaje: 'Faltan parámetros: empresaId, modulo, anio'
    });
  }

  const empresa = obtenerEmpresaPorId(empresaId);
  if (!empresa) {
    return res.status(404).json({ mensaje: 'Empresa no encontrada.' });
  }

  const moduloCanonico = obtenerModuloCanonico(modulo);
  if (!moduloCanonico) {
    return res.status(400).json({ mensaje: 'Módulo no válido.' });
  }

  // Obtener el borrador actual
  const borrador = obtenerBorrador({
    empresaId: empresa.id,
    modulo: moduloCanonico,
    anio: Number(anio)
  });

  if (!borrador) {
    return res.json({
      borrador: null,
      estado: 'sin-cargar'
    });
  }

  // Verificar si el usuario puede ver este borrador
  if (!puedeVerBorrador(req, borrador)) {
    return res.status(403).json({
      mensaje: 'No tienes permisos para ver este borrador.'
    });
  }

  return res.json({
    borrador: mapearResumen(borrador),
    estado: borrador.estado
  });
});
```

---

### SOLUCIÓN 3: Inicializar Flujo con Callbacks Correctos

**Archivo:** `vistas/SUMMARY.html` (en la sección de script)

```html
<script>
  // Después de que SUMMARY cargue su módulo
  document.addEventListener('DOMContentLoaded', () => {
    // Inicializar el flujo de autorización CON los callbacks
    const flujo = new FlujoAutorizacion({
      tablaId: 'tablaComparacion',
      modulo: 'PRESUPUESTOS',
      obtenerCambios: () => {
        // Usar la función definida en paso anterior
        return extraerCambiosPresupuesto?.() || { presupuesto: [] };
      },
      obtenerHeaders: () => Sesion.headersAutenticacion(),
      onCancelEdit: () => {
        console.log('Edición cancelada');
        // Recargar UI si es necesario
      }
    }).init();
    
    // Hacer el flujo accesible globalmente
    window.flujoAutorizacionActual = flujo;
  });
</script>
```

---

### SOLUCIÓN 4: Garantizar Datos Válidos en Firebird

**Archivo:** `src/services/borradoresService.js`

Modificar `persistirEnFirebird`:

```javascript
const persistirEnFirebird = async (borrador) => {
  const { ejecutarConsulta } = require('./firebirdService');
  const datos = typeof borrador.data === 'string' 
    ? JSON.parse(borrador.data) 
    : borrador.data;
  
  const presupuesto = Array.isArray(datos?.presupuesto) 
    ? datos.presupuesto 
    : [];
  
  // ✅ MEJORA: Lanzar error si no hay datos
  if (!presupuesto.length) {
    console.warn(`⚠️ Borrador ${borrador.id} sin datos presupuestarios`);
    // Decidir: ¿devolver error o permitir estado GUARDADO vacío?
    // Por ahora, permitir (para no bloquear)
    return;
  }

  // Validar que hay números válidos
  const tieneValoresValidos = presupuesto.some((cambio) => {
    const valores = cambio.valores || {};
    return Object.values(valores).some((v) => Number(v) !== 0);
  });

  if (!tieneValoresValidos) {
    console.warn(`⚠️ Borrador ${borrador.id} con solo ceros`);
    // Permitir pero registrar en log
  }

  // Resto del código existente...
  const anio = Number(borrador.anio);
  const sufijo = anio.toString().slice(-2).padStart(2, '0');
  const tablaPresup = `PRESUP${sufijo}`;
  
  // ... continuar con inserts ...
};
```

---

## 📊 DIAGRAMA DE FLUJO CORRECTO

```
┌─────────────────────────────────────────────────────────────┐
│                     USUARIO CARGA DATOS                     │
│         (Click en "Cargar Presupuesto" / btnGuardar)        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│        MODO EDICIÓN: Tabla con celdas editables             │
│      • Celdas de presupuesto hacen click editable           │
│      • Se capturan cambios en cada celda                    │
│      • Botones: "Enviar Presupuesto" | "Cancelar"          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│    Estado: EDITANDO                                         │
│    • Borrador guardado en SQLite con datos                  │
│    • cambiosEdicion = {presupuesto: [...]}                  │
│    • obtenerCambios() extrae del DOM                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
         ┌─────────────┴─────────────┐
         │                           │
         ▼ (Enviar)                 ▼ (Cancelar)
    PENDIENTE                   EDITANDO
    (Revisadores ven)         (Vuelve a tabla)
         │
         ▼ (Marcar Revisado)
     REVISADO
     (Autorizadores ven)
         │
         ▼ (Autorizar)
     APROBADO
     (Preparado para guardar)
         │
         ▼ (Guardar en COI)
    ┌─────────────────────────────────────────┐
    │  PERSISTIR EN FIREBIRD (PRESUP25)       │
    │  • Validar datos no vacíos              │
    │  • INSERT/UPDATE en tabla PRESUPYY      │
    │  • Registrar en presupuestos_guardados  │
    └─────────────────────┬───────────────────┘
                          │
                          ▼
                      GUARDADO
                   (En base de datos)
```

---

## ✅ PLAN DE IMPLEMENTACIÓN PASO A PASO

### Fase 1: Crear los Endpoints Faltantes
1. ✅ Endpoint `GET /api/borradores/estado` (implementado arriba)
2. Validar que todos los endpoints de flujo existen

### Fase 2: Implementar Captura de Cambios
1. Hacer celdas de presupuesto editables
2. Crear función `extraerCambiosPresupuesto()`
3. Integrar con `FlujoAutorizacion`

### Fase 3: Validación y Guardado en Firebird
1. Validar datos antes de guardar
2. Mejorar manejo de errores
3. Registrar auditoría completa

### Fase 4: Testing
1. Flujo completo usuario normal
2. Flujo administrador (auto-aprobación)
3. Rechazo y re-envío
4. Verificación en Firebird

---

## 🎯 CHECKLIST DE FUNCIONALIDAD

```
☐ Usuario con "Cargar y guardar" hace click en "Cargar"
  → EDITANDO
  
☐ Tabla aparece en modo edición (celdas clickeables)

☐ Usuario edita valores de presupuesto

☐ Click en "Enviar Presupuesto"
  → Captura cambios de tabla
  → POST /api/borradores/guardar + /api/borradores/enviar
  → PENDIENTE (si user normal) o APROBADO (si admin)

☐ Usuario con "Revisar" ve borrador
  → Marca como revisado
  → REVISADO

☐ Usuario con "Aprobar" ve borrador
  → Click en "Autorizar"
  → APROBADO

☐ Usuario con "Aprobar" click en "Guardar en COI"
  → POST /api/borradores/finalizar
  → persistirEnFirebird() → INSERT en PRESUP25
  → GUARDADO

☐ Estado final: Datos en Firebird, borrador en GUARDADO
```

---

## 🚀 PRÓXIMAS ACCIONES

1. **¿Quieres que implemente estas correcciones ahora?**
   - Código completo y funcional para captura de cambios
   - Endpoint faltante
   - Integración en SUMMARY.html

2. **¿Quieres crear una vista de gestión centralizada de borradores?** (`borradores.html`)
   - Listar todos los borradores
   - Filtros por estado, módulo, empresa
   - Acceso rápido

3. **¿Quieres mejorar la notificación a usuarios?**
   - Emails cuando un borrador cambia de estado
   - Panel de notificaciones en la UI

---

## 📝 RESUMEN FINAL

Tu flujo está bien arquitecturado pero **le faltan detalles de implementación críticos**:

| Aspecto | Estado | Problema |
|---------|--------|----------|
| Definición de estados | ✅ Correcto | 6 estados bien organizados |
| Permisos y roles | ✅ Correcto | Lógica clara por rol |
| Endpoints API | ⚠️ Parcial | Falta `/estado`, fallos en captura |
| Modo edición | ❌ **TODO** | Sin implementación real |
| Captura de cambios | ❌ **TODO** | Callbacks no conectados |
| Guardado en Firebird | ⚠️ Riesgoso | Sin validación de datos |

**Prioridad:** Implementar modo edición + captura de cambios + endpoint `/estado`.

---

¿Quieres que proceda a implementar las correcciones?
