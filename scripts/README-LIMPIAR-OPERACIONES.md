# Análisis y Limpieza de Operaciones Huérfanas

## Problema

En el **Gestor** aparecen operaciones que no se muestran en los **Reportes/Módulos**. Esto sucede porque hay registros en `layout_operaciones` que:

1. **No tienen fórmula** (`formula_json` vacío o null)
2. **No son operaciones reales** (no tienen campos como `sum-row`, `net-row`, etc. con valores)
3. **Son metadata de posicionamiento** que se guardó incorrectamente

Estas operaciones "huérfanas" contaminan el Gestor y dificultan el mantenimiento.

---

## Scripts Disponibles

### 1. **ver-operaciones.sql** - Ver todas las operaciones

Consulta simple para ver qué operaciones existen en la base de datos.

**Uso:**
```powershell
cd "C:\Users\Frida Sophia\AppData\Roaming\panel-amcham\datos"
sqlite3 panel.sqlite ".read C:\Users\Frida Sophia\Desktop\DESARROLLOS\SummaCham\scripts\ver-operaciones.sql"
```

### 2. **analizar-operaciones.sql** - Análisis detallado

Genera un reporte completo con:
- Operaciones por módulo/capítulo
- Operaciones con fórmula (reales)
- Operaciones sin fórmula (huérfanas)
- Resumen por tipo

**Uso:**
```powershell
cd "C:\Users\Frida Sophia\AppData\Roaming\panel-amcham\datos"
sqlite3 panel.sqlite ".read C:\Users\Frida Sophia\Desktop\DESARROLLOS\SummaCham\scripts\analizar-operaciones.sql" > analisis.txt
notepad analisis.txt
```

### 3. **limpiar-operaciones-huerfanas.sql** - Limpiar base de datos

Elimina operaciones huérfanas de forma segura.

**IMPORTANTE: HACER BACKUP PRIMERO**

**Uso:**
```powershell
# 1. BACKUP
cd "C:\Users\Frida Sophia\AppData\Roaming\panel-amcham\datos"
Copy-Item panel.sqlite panel.sqlite.backup

# 2. REVISAR QUÉ SE VA A ELIMINAR (no ejecuta DELETE aún)
sqlite3 panel.sqlite

# Dentro de sqlite3:
.read C:\Users\Frida Sophia\Desktop\DESARROLLOS\SummaCham\scripts\limpiar-operaciones-huerfanas.sql

# 3. Si todo se ve bien, el script hace COMMIT automáticamente
# 4. Si algo salió mal, cerrar sqlite3 sin hacer COMMIT (Ctrl+C)
```

---

## Identificar Operaciones Problemáticas Manualmente

Si quieres ver específicamente qué operaciones están en el Gestor pero no en reportes:

```sql
-- Operaciones que aparecen en Gestor pero probablemente no se usan
SELECT
  modulo,
  capitulo,
  clase,
  operacion_etiqueta,
  COUNT(*) as filas
FROM layout_operaciones
WHERE empresa_id = 'EMPRESA01'
  AND anio = 2025
  AND modulo IN ('RESUMEN', 'SUMMARY')
  AND (
    formula_json IS NULL
    OR TRIM(formula_json) = ''
    OR formula_json = '[]'
  )
  AND operacion_tipo NOT IN (
    'sum-row',
    'sum-row-sumavarios',
    'sum-row-sumavarios-consolidado',
    'sum-row-operativo',
    'sum-row-operativo-consolidado',
    'result-row',
    'net-row',
    'net-row-adicional',
    'result-net-row',
    'free-operation',
    'parentSection',
    'parentSubsection'
  )
GROUP BY modulo, capitulo, clase
ORDER BY modulo, capitulo, clase;
```

---

## Proceso Recomendado

1. **Ejecutar `ver-operaciones.sql`**: Ver todas las operaciones existentes
2. **Comparar con el Gestor**: Identificar cuáles aparecen en Gestor pero no en reportes
3. **Ejecutar `analizar-operaciones.sql`**: Generar reporte detallado
4. **HACER BACKUP**: `Copy-Item panel.sqlite panel.sqlite.backup`
5. **Ejecutar `limpiar-operaciones-huerfanas.sql`**: Limpiar operaciones innecesarias
6. **Verificar en Gestor**: Confirmar que las operaciones problemáticas desaparecieron
7. **Verificar en Reportes**: Confirmar que los reportes siguen funcionando correctamente

---

## Restaurar Backup (si algo sale mal)

```powershell
cd "C:\Users\Frida Sophia\AppData\Roaming\panel-amcham\datos"
Copy-Item panel.sqlite.backup panel.sqlite -Force
```

---

## Qué NO se elimina

El script de limpieza **preserva**:
- Operaciones con `formula_json` válida (operaciones con fórmulas manuales)
- Operaciones con campos de configuración real (`sum-row`, `net-row`, etc.) aunque no tengan fórmula
- Metadata de posicionamiento (`parentSection`, `parentSubsection`)
- Operaciones libres (`free-operation`)

## Qué SÍ se elimina

- Operaciones sin fórmula
- Operaciones con tipos no reconocidos
- Operaciones legacy que ya no se usan
- Duplicados innecesarios

---

## Soporte

Si tienes dudas sobre alguna operación específica, compárteme:
- El nombre de la operación (clase/etiqueta)
- El capítulo donde aparece
- Si tiene fórmula o no

Y te ayudo a determinar si es seguro eliminarla.
