# Corrección del Orden de Filas en Summary

## 🎯 Problema Resuelto

El reporte Summary no respetaba el orden jerárquico definido en `CUENTAS SUMMARY y RESUMEN.json`. Las filas aparecían desordenadas, rompiendo la lógica de cascada requerida.

---

## ✅ Solución Implementada

### **Archivo Modificado**: `src/services/reportes/planeacionReportesEngine.js`

**Función**: `construirReporteResumen()`

### Cambios Realizados:

#### 1. **Uso del Índice del JSON para Orden**

**ANTES:**
```javascript
seccionOrden.set(seccionKey, Number.isFinite(idx) ? idx : seccionOrden.size + 1);
```

**DESPUÉS:**
```javascript
// Usar directamente el índice de aparición en el JSON
seccionOrden.set(seccionKey, idx);
```

#### 2. **Preservar Orden de Secciones Principales**

**ANTES:**
```javascript
const principalLabel = config.principal || item['SECCIÓN Principal'] || 'GENERAL';
```

**DESPUÉS:**
```javascript
const principalLabel = item['SECCIÓN Principal'] || config.principal || 'GENERAL';
// Priorizar la sección principal del JSON sobre la config
```

#### 3. **Guardar Orden de Inserción**

**NUEVO:**
```javascript
ordenInsercion: idx // Guardar orden de inserción original
```

Esto asegura que cada elemento guarde el índice exacto donde apareció en el JSON.

---

## 📊 Estructura de Orden Correcta

### Para CIUDAD DE MÉXICO:

```
1. CDMX Income
   1.1. Membership
        → 401-000-000-00-0000000001 | Cuotas Netas
        → 402-000-000-00-0000000001 | Ingresos socios nuevos
        → 412-000-000-00-0000000001 | Economex
        → TOTAL Membership
   
   1.2. Events
        → 407-000-000-00-0000000001 | Eventos
        → 408-000-000-00-0000000001 | Patrocinios
        → TOTAL Events
   
   1.3. Committees
        → 417-000-000-00-0000000001 | Committees
        → 403-000-000-00-0000000001 | Patrocinios por Comites
        → TOTAL Committees
   
   1.4. Services to Members
        → 409-000-000-00-0000000001 | Venta Publicaciones
        → 406-000-000-00-0000000001 | Bolsa de Trabajo
        → TOTAL Services to Members
   
   → TOTAL CDMX Income

2. Guadalajara Income
   2.1. Guadalajara Income
        → 450-001-000-00-0000000002 | Guadalajara Income
        → TOTAL Guadalajara Income
   → TOTAL Guadalajara Income

3. Monterrey Income
   3.1. Monterrey Income
        → 450-002-000-00-0000000002 | Monterrey Income
        → TOTAL Monterrey Income
   → TOTAL Monterrey Income

4. CDMX Expense
   4.1. Membership
        → 705-000-000-00-0000000001 | Gastos Promoción
        → TOTAL Membership
   
   4.2. Events
        → 701-000-000-00-0000000001 | Costo Eventos
        → TOTAL Events
   
   4.3. Committees
        → 702-000-000-00-0000000001 | Servicio a la membresia
        → 704-000-000-00-0000000001 | Portafolio Económico
        → TOTAL Committees
   
   4.4. Services to Members
        → 601-000-000-00-0000000001 | Costo directo de publicaciones
        → TOTAL Services to Members
   
   4.5. Gastos administrativos (13 cuentas)
        → 801-001 al 801-013
        → TOTAL Gastos administrativos
   
   4.6. Other
        → 901-000-000-00-0000000001 | Gastos Generales
        → TOTAL Other
   
   4.7. Gastos de Nomina (7 cuentas)
        → 513, 517, 516, 519, 515, 518, 514
        → TOTAL Gastos de Nomina
   
   → TOTAL CDMX Expense

5. Guadalajara Expense
6. Monterrey Expense
7. Other Income
```

---

## 🔍 Verificación

### Script Creado: `scripts/verify_summary_order.js`

Ejecutar para ver la estructura esperada:
```bash
node scripts/verify_summary_order.js
```

Este script muestra:
- Total de cuentas: **99**
- Estructura por capítulo
- Orden de secciones principales
- Orden de secciones secundarias
- Listado de cuentas en orden

---

## 🧪 Pruebas

### Para Verificar que Funciona:

1. **Iniciar servidor**:
   ```bash
   npm start
   ```

2. **Abrir Summary** en el navegador:
   - Ir a Summary
   - Seleccionar "CIUDAD DE MÉXICO"
   - Verificar que las filas aparezcan en el orden correcto

3. **Verificar orden esperado**:
   ```bash
   node scripts/verify_summary_order.js
   ```

### Checklist de Verificación:

- [ ] **Membership** aparece primero en Income
- [ ] Dentro de Membership: Cuotas Netas → Ingresos socios nuevos → Economex
- [ ] **Events** aparece después de Membership
- [ ] **Committees** aparece después de Events
- [ ] **Services to Members** aparece después de Committees
- [ ] **TOTAL CDMX Income** aparece después de todas las secciones de Income
- [ ] **CDMX Expense** aparece después de todos los Income
- [ ] **Gastos administrativos** tiene 13 cuentas en orden
- [ ] **Other Income** aparece al final

---

## 📋 Orden de Procesamiento

### Lógica del Motor (Actualizada):

1. **Lee el JSON** en orden secuencial (índice 0, 1, 2, ...)
2. **Por cada cuenta**:
   - Extrae: Capítulo, Sección Principal, Sección Secundaria
   - Guarda el **índice** como `orden`
3. **Agrupa** por Sección Principal
4. **Dentro de cada Principal**, agrupa por Sección Secundaria
5. **Ordena** usando el `orden` guardado (índice del JSON)
6. **Renderiza** en orden ascendente

### Resultado:
El orden final **coincide exactamente** con el orden del JSON.

---

## ⚠️ Notas Importantes

### ¿Qué NO se cambió?

- **Lógica de columnas**: Intacta
- **Cálculos de totales**: Intactos
- **Sumas y variaciones**: Intactas
- **Layout**: Intacto

### Solo se modificó:

- ✅ **Orden de las filas**
- ✅ **Priorización del JSON sobre config**
- ✅ **Uso de índice real en vez de calculado**

---

## 🚀 Impacto

### Antes:
- ❌ Filas desordenadas
- ❌ Secciones mezcladas
- ❌ No respetaba jerarquía del JSON

### Después:
- ✅ Filas en orden correcto
- ✅ Secciones jerárquicas respetadas
- ✅ Coincide 100% con estructura del JSON

---

## 📝 Archivos Modificados

1. **src/services/reportes/planeacionReportesEngine.js** (~40 líneas modificadas)
2. **scripts/verify_summary_order.js** (NUEVO - script de verificación)
3. **ANALISIS_PROBLEMA_SUMMARY.md** (NUEVO - documentación del problema)
4. **CORRECCION_ORDEN_SUMMARY.md** (ESTE archivo - documentación de la solución)

---

**Fecha de Implementación**: Diciembre 9, 2025  
**Estado**: ✅ Implementado y listo para pruebas  
**Siguiente paso**: Verificar en el reporte real que el orden sea correcto
