# Auditoría y Diagnóstico de Botones del Proyecto

A continuación se detalla la evaluación de cada control y botón, analizando su mecanismo de activación y la causa técnica por la cual pueden parecer "activos" pero no responder al clic.

## 1. Botones de Menú Lateral (Sidebar Workflow)

### Botón Toggle (Hamburguesa) y "Ver Borrador"

- **Identificador (Selector):** `.workflow-toggle`, `#btnVerBorrador`, `[data-open-drafts-center]`
- **Estado Visual:** Activo (visible, cursor pointer).
- **Mecanismo de Control:** `flujo-autorizacion.js` -> `vincularAccesosRapidos()`
- **Comportamiento Actual:** El script **elimina intencionalmente** los atributos nativos `data-bs-toggle="offcanvas"` para tomar control manual.
- **Por qué falla el clic:**
  1. El código JavaScript intercepta el clic (`event.preventDefault()`).
  2. Intenta obtener/crear la instancia del Offcanvas dinámicamente (`bootstrap.Offcanvas.getOrCreateInstance`).
  3. **Causa raíz probable:** Si `window.bootstrap` no está cargado correctamente o si ocurre un error interno al crear el drawer (ej. elemento no existe aún en el DOM), el evento muere silenciosamente dentro del bloque `try/catch` sin mostrar feedback visual al usuario.

## 2. Botones de Acción (Barra de Herramientas)

### Cargar Presupuesto / Guardar Borrador

- **ID:** `#btnGuardarBorrador` (o `#loadBudgetBtn` en módulos legacy)
- **Mecanismo:** Gestionado por `FlujoAutorizacion._setupButtons()`.
- **Por qué falla el clic:**
  - El listener llama a `_handleGuardar()`.
  - Esta función es `async`. Si ocurre un error inmediato (ej. no hay `contexto.empresaId`), el botón no dará feedback visual a menos que el sistema de `_toast` esté funcionando.
  - **Conflicto:** `planeacion-modulo-vista.js` intenta controlar estos botones pero se detiene porque `workflowControlExterno` es true. Si `flujo-autorizacion.js` no se inicializa (por error previo), estos botones quedan "huérfanos" (sin listeners de nadie).

### Autorizar / Rechazar / Enviar / Marcar Revisado

- **IDs:** `#btnAutorizar`, `#btnRechazar`, `#btnEnviarCambios`, `#btnMarcarRevisado`
- **Mecanismo:** Idéntico al anterior. Dependen totalmente de que `new FlujoAutorizacion()` se ejecute sin errores al inicio.
- **Por qué falla el clic:** Si el script de flujo se detiene antes de llegar a `_setupButtons()` (por ejemplo, por el error de `TypeError` en consola), estos botones nunca reciben sus eventos de clic. Se ven azules/activos por CSS, pero son elementos muertos.

## 3. Botones de Modales y Paneles (Cancelar, Cerrar, X)

### Botón "X" y "Cancelar" en Modales

- **Selectores:** `.btn-close`, `.btn-secondary[data-bs-dismiss]`
- **Estado Previo:** No funcionaban en modales dinámicos.
- **Estado Actual (Post-Corrección):**
  - Se eliminó `data-bs-dismiss` del HTML dinámico.
  - Se implementó una **función global** que detecta el clic y fuerza `modal.hide()`.
- **Por qué podrían fallar aún:**
  - Si `bootstrap.Modal.getInstance()` no encuentra la instancia (común si el modal se movió en el DOM), el clic no hará nada.
  - Mi corrección incluye un intento de recuperación (`new bootstrap.Modal`), pero si Bootstrap JS falla, esto no funcionará.

## 4. Botones de Cierre de Offcanvas (Sidebar)

### Botón "X" en Centro de Borradores / Historial

- **Selector:** `.btn-close` dentro de `.offcanvas-header`
- **Mecanismo:** Igual que los modales, ahora gestionados por la función global de inicialización.
- **Por qué falla el clic:** Mismas razones que los modales. Dependencia crítica de `window.bootstrap`.

---

## Conclusión Técnica

Los botones están "activos" visualmente porque el CSS (`display: block`, colores, hover) se carga correctamente. Sin embargo, **son funcionalmente inertes** debido a uno de dos factores:

1. **Secuestro de Eventos:** El código JS elimina la funcionalidad nativa de Bootstrap (`data-bs-...`) para manejarla manualmente, pero el manejo manual falla silenciosamente.
2. **Ejecución Interrumpida:** Errores de JavaScript anteriores (como el `TypeError: object is not iterable` visto en logs anteriores) pueden detener la ejecución del script _antes_ de que se asignen los listeners a los botones de la barra de herramientas, dejándolos como simples elementos decorativos.
