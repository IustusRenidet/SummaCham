-- ============================================================================
-- ANÁLISIS DE OPERACIONES EN LAYOUT
-- ============================================================================
-- Este script analiza las operaciones en layout_operaciones para identificar
-- cuáles son reales (usadas en reportes) y cuáles son huérfanas.

.mode column
.headers on
.width 30 20 15 10 60

-- ============================================================================
-- 1. OPERACIONES POR MÓDULO Y CAPÍTULO
-- ============================================================================
SELECT '============================================================================' as '';
SELECT 'OPERACIONES POR MÓDULO Y CAPÍTULO' as '';
SELECT '============================================================================' as '';

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
-- 2. OPERACIONES CON FÓRMULA MANUAL (REALES)
-- ============================================================================
SELECT '' as '';
SELECT '============================================================================' as '';
SELECT 'OPERACIONES CON FÓRMULA MANUAL (REALES - SE USAN EN REPORTES)' as '';
SELECT '============================================================================' as '';

SELECT
  modulo,
  capitulo,
  clase as operacion,
  operacion_etiqueta,
  COUNT(*) as filas,
  CASE
    WHEN formula_json IS NOT NULL AND TRIM(formula_json) != '' THEN '✓ formula_json'
    ELSE ''
  END as tiene_formula
FROM layout_operaciones
WHERE empresa_id = 'EMPRESA01'
  AND anio = 2025
  AND (
    formula_json IS NOT NULL
    AND TRIM(formula_json) != ''
    AND formula_json != '[]'
  )
GROUP BY modulo, capitulo, clase
ORDER BY modulo, capitulo, orden_presentacion;

-- ============================================================================
-- 3. OPERACIONES SIN FÓRMULA (POTENCIALMENTE HUÉRFANAS)
-- ============================================================================
SELECT '' as '';
SELECT '============================================================================' as '';
SELECT 'OPERACIONES SIN FÓRMULA (POTENCIALMENTE HUÉRFANAS)' as '';
SELECT '============================================================================' as '';

SELECT
  modulo,
  capitulo,
  clase as operacion,
  operacion_etiqueta,
  COUNT(*) as filas,
  GROUP_CONCAT(DISTINCT operacion_tipo) as tipos,
  visible
FROM layout_operaciones
WHERE empresa_id = 'EMPRESA01'
  AND anio = 2025
  AND (
    formula_json IS NULL
    OR TRIM(formula_json) = ''
    OR formula_json = '[]'
  )
  AND operacion_tipo != 'free-operation'
GROUP BY modulo, capitulo, clase
ORDER BY modulo, capitulo, clase;

-- ============================================================================
-- 4. DETALLE DE OPERACIONES HUÉRFANAS POR TIPO
-- ============================================================================
SELECT '' as '';
SELECT '============================================================================' as '';
SELECT 'DETALLE DE OPERACIONES HUÉRFANAS (CANDIDATAS PARA LIMPIEZA)' as '';
SELECT '============================================================================' as '';

SELECT
  modulo,
  capitulo,
  clase,
  operacion_tipo,
  operacion_label,
  visible,
  orden_presentacion
FROM layout_operaciones
WHERE empresa_id = 'EMPRESA01'
  AND anio = 2025
  AND (
    formula_json IS NULL
    OR TRIM(formula_json) = ''
    OR formula_json = '[]'
  )
  AND operacion_tipo NOT IN ('free-operation', 'parentSection', 'parentSubsection')
ORDER BY modulo, capitulo, orden_presentacion, clase, operacion_tipo;

-- ============================================================================
-- 5. OPERACIONES DE METADATA (parentSection/parentSubsection)
-- ============================================================================
SELECT '' as '';
SELECT '============================================================================' as '';
SELECT 'OPERACIONES DE METADATA (parentSection/parentSubsection)' as '';
SELECT '============================================================================' as '';

SELECT
  modulo,
  capitulo,
  clase as operacion,
  operacion_tipo,
  operacion_label,
  COUNT(*) as ocurrencias
FROM layout_operaciones
WHERE empresa_id = 'EMPRESA01'
  AND anio = 2025
  AND operacion_tipo IN ('parentSection', 'parentSubsection', 'parent_section', 'parent_subsection')
GROUP BY modulo, capitulo, clase, operacion_tipo, operacion_label
ORDER BY modulo, capitulo, clase;

-- ============================================================================
-- 6. RESUMEN DE TIPOS DE OPERACIÓN
-- ============================================================================
SELECT '' as '';
SELECT '============================================================================' as '';
SELECT 'RESUMEN DE TIPOS DE OPERACIÓN' as '';
SELECT '============================================================================' as '';

SELECT
  operacion_tipo,
  COUNT(DISTINCT clase) as operaciones_unicas,
  COUNT(*) as filas_totales,
  SUM(CASE WHEN formula_json IS NOT NULL AND TRIM(formula_json) != '' THEN 1 ELSE 0 END) as con_formula,
  modulo
FROM layout_operaciones
WHERE empresa_id = 'EMPRESA01'
  AND anio = 2025
GROUP BY operacion_tipo, modulo
ORDER BY modulo, operacion_tipo;

SELECT '' as '';
SELECT '============================================================================' as '';
SELECT 'FIN DEL ANÁLISIS' as '';
SELECT '============================================================================' as '';
