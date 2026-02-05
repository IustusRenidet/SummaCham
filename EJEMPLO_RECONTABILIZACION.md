# 🔄 Comportamiento de Recontabilización - ACTUALIZADO

## ✅ CAMBIO IMPLEMENTADO

Ahora el sistema **respeta las ediciones manuales** en cuentas acumulativas.

---

## 📋 Ejemplo Práctico

### Escenario:

```
400-000-000-00 (ACUMULATIVA)
├── 401-001-000-00 (Detalle) = $10,000
├── 402-001-000-00 (Detalle) = $5,000
└── 403-001-000-00 (Detalle) = $3,000
```

### ❌ ANTES del Cambio:

1. **Estado inicial:**
   - 400-000-000-00 = $18,000 (suma automática de hijas)

2. **Editas manualmente la acumulativa:**
   - 400-000-000-00 = $25,000 (agregaste $7,000 manual)

3. **Al guardar/recontabilizar:**
   - Sistema detecta: $25,000 - $18,000 = $7,000 manual
   - Recalcula: $18,000 (suma hijas) + $7,000 (manual) = $25,000 ✅
   
4. **Si cambias una hija:**
   - 401-001-000-00 = $12,000 (cambiaste de $10,000 a $12,000)
   - Nueva suma hijas: $20,000
   - **PROBLEMA:** Recalcula 400-000-000-00 = $20,000 + $7,000 = $27,000
   - Tu edición de $25,000 se perdió ❌

---

### ✅ DESPUÉS del Cambio:

1. **Estado inicial:**
   - 400-000-000-00 = $18,000 (suma automática de hijas)

2. **Editas manualmente la acumulativa:**
   - 400-000-000-00 = $25,000

3. **Al guardar:**
   - ✅ Sistema detecta que editaste 400-000-000-00
   - ✅ **NO recalcula**, respeta tu valor de $25,000
   - ✅ El valor $25,000 se guarda sin cambios

4. **Si cambias una hija:**
   - 401-001-000-00 = $12,000
   - Nueva suma hijas: $20,000
   - **AHORA:** 400-000-000-00 = $25,000 (sin cambios)
   - ✅ Se respeta tu edición manual

---

## 🔧 Cómo Funciona

### En `borradoresService.js`:

```javascript
// Al procesar cada cuenta padre (acumulativa)
const fueEditadaManualmente = presupuestosEditados && presupuestosEditados.has(numCta);

if (fueEditadaManualmente) {
  console.log(`🔒 Cuenta editada manualmente - Se respeta el valor sin recalcular`);
  contadorEditadasManualmente++;
  continue; // ⬅️ OMITE el recálculo
}

// Solo si NO fue editada manualmente, recalcula sumando las hijas
```

---

## 📊 Logs que Verás

Cuando guardes un borrador con cuentas acumulativas editadas:

```
📊 ============================================
📊 RESUMEN DE ACTUALIZACIÓN:
   ✅ Actualizadas (recalculadas): 25
   🔒 Editadas manualmente (respetadas): 3  ⬅️ TUS ACUMULATIVAS
   ⚠️ Sin hijas: 2
   ⚠️ Sin valores: 0
   📊 Total procesadas: 30
📊 ============================================
```

---

## 🎯 Cuándo se Respetan las Ediciones

### ✅ Se Respetan:
- Al guardar un borrador (`POST /api/borradores/guardar`)
- Al enviar a revisión (`POST /api/borradores/enviar-revision`)
- Al aprobar cambios (`POST /api/borradores/aprobar`)

### ⚠️ Se Recalculan TODO:
- Al recontabilizar manualmente (`POST /api/borradores/recontabilizar`)
- Al recontabilizar todas las empresas (`POST /api/borradores/recontabilizar/todas`)
- **Propósito:** Limpiar y recalcular TODA la jerarquía desde cero

---

## 💡 Recomendaciones

1. **Edita acumulativas solo cuando:**
   - Necesitas ajustes manuales específicos
   - Las hijas no reflejan el total correcto por alguna razón de negocio

2. **Edita las hijas (detalle) cuando:**
   - Quieres que la acumulativa refleje automáticamente los cambios
   - Es el flujo normal de trabajo

3. **Usa recontabilizar cuando:**
   - Necesitas "limpiar" y recalcular todo desde cero
   - Has hecho cambios masivos y quieres sincronizar todo

---

## 🔍 Para Verificar

1. Edita una cuenta acumulativa
2. Guarda el borrador
3. Ve a los logs del servidor
4. Busca: `🔒 Cuenta editada manualmente - Se respeta el valor sin recalcular`
5. Verifica que el valor guardado sea el que editaste

---

**Cambio implementado por:** GitHub Copilot  
**Fecha:** 5 de febrero de 2026
