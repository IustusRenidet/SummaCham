# ⚡ Quick Guide: Personalizar Fórmulas de Secciones

> **Respuesta Rápida:** SÍ, puedes personalizar las fórmulas de EXPENSES y cualquier sección principal. Todo desde la interfaz visual.

---

## 🎯 En 3 Pasos

```
1. Gestor de Plantillas → Clic derecho en sección → "Editar Sección"
2. Pestaña "Fórmula" → Modificar términos
3. Guardar
```

---

## 🔧 Qué Puedes Hacer

| Acción | Ejemplo |
|--------|---------|
| ✅ **Cambiar operador** | `+ Committees` → `- Committees` |
| ✅ **Agregar término** | `+ 5000` (ajuste fijo) |
| ✅ **Eliminar término** | Quitar "Events" de la suma |
| ✅ **Multiplicar/Dividir** | `× 0.15` (15% de comisión) |
| ✅ **Restar cuenta** | `- 801-001-000-00` |
| ✅ **Sumar otra operación** | `+ CONSOLIDATED INCOME` |

---

## 📋 Operadores Disponibles

| Símbolo | Operación | Ejemplo |
|---------|-----------|---------|
| `+` | Suma | `+ Membership` |
| `-` | Resta | `- Committees` |
| `×` | Multiplicación | `× 1.16` (IVA) |
| `÷` | División | `÷ 12` (promedio mensual) |

---

## 🎨 Tipos de Términos

| Tipo | Descripción | Ejemplo |
|------|-------------|---------|
| **Sección/Suma** | Referencia a otra sección o subsección | `Membership`, `CDMX EXPENSE` |
| **Cuenta** | Cuenta contable individual | `801-001-000-00` |
| **Operación** | Resultado de otra operación | `CONSOLIDATED INCOME` |
| **Número** | Constante numérica | `5000`, `0.15`, `1.16` |

---

## 💡 Ejemplos Rápidos

### Restar en lugar de Sumar
```
ANTES:  + Committees
DESPUÉS: - Committees
```

### Agregar Ajuste Fijo
```
+ Membership
+ Events
- 5000  ← NUEVO
```

### Calcular Porcentaje
```
+ Ventas
× 0.15  ← 15% comisión
```

### Consolidar Regiones
```
+ CDMX EXPENSE
+ GDL EXPENSE
+ MTY EXPENSE
```

---

## 🚀 Fórmula Compleja Ejemplo

**Escenario:** EXPENSES con ajustes y descuento

```
+ Membership
+ Events
- Committees
- 5000
× 0.95
```

**Resultado:** `((Membership + Events - Committees - 5000) × 0.95)`

---

## 🎯 Acceso Rápido

### Opción 1: Clic Derecho
1. En plantilla, clic derecho sobre fila de sección
2. "Editar Sección"
3. Pestaña "Fórmula"

### Opción 2: Panel Lateral
1. Gestor de Plantillas → Lista de secciones
2. Botón "✏️" junto a la sección
3. Pestaña "Fórmula"

---

## 🔍 Herramientas Útiles

| Herramienta | Función |
|-------------|---------|
| **Vista Previa** | Ver fórmula como texto antes de guardar |
| **Mapa Visual** | Botón "🗺️ Mostrar Mapa" para ver jerarquía |
| **Validación** | Sistema detecta errores automáticamente |
| **+ Agregar Término** | Botón para añadir nuevo elemento |
| **🗑️ Eliminar** | Botón junto a cada término |

---

## 💾 Guardar y Aplicar

```
Guardar → Cambios se aplican INMEDIATAMENTE a la tabla
```

No necesitas recargar, los valores se recalculan automáticamente.

---

## ⚠️ Importante

- ✅ **Modo Edición:** Debe estar activado (botón en esquina superior)
- ✅ **Módulos:** RESUMEN y SUMMARY permiten edición completa
- ⚠️ **Backup:** Se recomienda guardar plantilla antes de cambios grandes
- 🔄 **Deshacer:** Puedes revertir editando nuevamente

---

## 🆘 Ayuda Rápida

### "No veo el botón Editar"
→ Activa "Modo Edición" en el Gestor de Plantillas

### "Los cambios no se guardan"
→ Verifica que todos los términos tengan valores válidos

### "La fórmula no calcula bien"
→ Usa "Mostrar Mapa" para verificar jerarquía

---

## 📚 Más Info

- 📖 Guía completa: `GUIA_PERSONALIZAR_FORMULAS_SECCIONES.md`
- 🔧 Referencia técnica: `REFERENCIA_TECNICA_FORMULAS.md`
- 🎨 Ejemplo interactivo: `EJEMPLO_PERSONALIZAR_EXPENSES.html`

---

## ✨ Resumen

**TODO SE HACE DESDE LA INTERFAZ VISUAL**

No necesitas tocar código. El Constructor de Fórmulas te permite personalizar completamente cómo se calculan las secciones principales y subsecciones.

```
Gestor de Plantillas → Editar Sección → Pestaña Fórmula → ¡Listo!
```

---

**Última actualización:** 4 de febrero de 2026
**Sistema:** SummaCham
