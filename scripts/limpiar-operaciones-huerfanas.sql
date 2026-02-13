-- ============================================================================
-- SCRIPT DE LIMPIEZA DE OPERACIONES HUÉRFANAS
-- ============================================================================
-- PASO 1: Crear backup antes de ejecutar
-- En Windows PowerShell:
--   Copy-Item "C:\Users\Frida Sophia\AppData\Roaming\panel-amcham\datos\panel.sqlite" "C:\Users\Frida Sophia\AppData\Roaming\panel-amcham\datos\panel.sqlite.backup"
--
-- PASO 2: Abrir la base de datos y ejecutar este script
--   cd "C:\Users\Frida Sophia\AppData\Roaming\panel-amcham\datos"
--   sqlite3 panel.sqlite
--   .read limpiar-operaciones-huerfanas.sql
-- ============================================================================

BEGIN TRANSACTION;

-- ============================================================================
-- ANÁLISIS PREVIO: Ver qué se va a eliminar
-- ============================================================================

.mode column
.headers on

SELECT '============================================================================';
SELECT 'OPERACIONES QUE SE ELIMINARÁN (SIN FÓRMULA Y NO SON METADATA)';
SELECT '============================================================================';

SELECT
  modulo,
  capitulo,
  clase,
  operacion_tipo,
  operacion_label,
  COUNT(*) as filas
FROM layout_operaciones
WHERE empresa_id = 'EMPRESA01'
  AND anio = 2025
  AND (
    formula_json IS NULL
    OR TRIM(formula_json) = ''
    OR formula_json = '[]'
  )
  AND operacion_tipo NOT IN (
    'free-operation',
    'parentSection',
    'parentSubsection',
    'parent_section',
    'parent_subsection'
  )
  -- Excluir operaciones que son parte de la configuración real
  AND operacion_tipo NOT IN (
    'sum-row',
    'sum-row-sumavarios',
    'sum-row-sumavarios-consolidado',
    'sum-row-operativo',
    'sum-row-operativo-consolidado',
    'result-row',
    'net-row',
    'net-row-adicional',
    'result-net-row'
  )
GROUP BY modulo, capitulo, clase, operacion_tipo
ORDER BY modulo, capitulo, clase;

-- ============================================================================
-- LIMPIEZA: Eliminar operaciones huérfanas
-- ============================================================================

-- Operaciones sin fórmula y que no son metadata ni configuración real
DELETE FROM layout_operaciones
WHERE empresa_id = 'EMPRESA01'
  AND anio = 2025
  AND (
    formula_json IS NULL
    OR TRIM(formula_json) = ''
    OR formula_json = '[]'
  )
  AND operacion_tipo NOT IN (
    'free-operation',
    'parentSection',
    'parentSubsection',
    'parent_section',
    'parent_subsection',
    -- Mantener configuración real aunque no tenga fórmula
    'sum-row',
    'sum-row-sumavarios',
    'sum-row-sumavarios-consolidado',
    'sum-row-operativo',
    'sum-row-operativo-consolidado',
    'result-row',
    'net-row',
    'net-row-adicional',
    'result-net-row'
  );

-- ============================================================================
-- VERIFICACIÓN POST-LIMPIEZA
-- ============================================================================

SELECT '';
SELECT '============================================================================';
SELECT 'OPERACIONES RESTANTES DESPUÉS DE LA LIMPIEZA';
SELECT '============================================================================';

SELECT
  modulo,
  capitulo,
  COUNT(DISTINCT clase) as operaciones_unicas,
  COUNT(*) as filas_totales
FROM layout_operaciones
WHERE empresa_id = 'EMPRESA01'
  AND anio = 2025
GROUP BY modulo, capitulo
ORDER BY modulo, capitulo;

-- ============================================================================
-- IMPORTANTE: Revisar el resultado antes de hacer COMMIT
-- ============================================================================
-- Si todo se ve bien:
COMMIT;

-- Si algo salió mal:
-- ROLLBACK;
