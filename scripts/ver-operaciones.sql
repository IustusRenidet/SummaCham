-- ============================================================================
-- CONSULTA SIMPLE: Ver operaciones que aparecen en Gestor
-- ============================================================================
-- Para ejecutar:
--   cd "C:\Users\Frida Sophia\AppData\Roaming\panel-amcham\datos"
--   sqlite3 panel.sqlite < este_archivo.sql
-- ============================================================================

.mode box
.headers on

-- Ver todas las operaciones con su configuración
SELECT
  modulo,
  capitulo,
  clase as 'Operación',
  operacion_etiqueta as 'Etiqueta',
  operacion_tipo as 'Tipo',
  operacion_label as 'Label',
  CASE
    WHEN formula_json IS NOT NULL AND TRIM(formula_json) != '' AND formula_json != '[]'
    THEN '✓ Sí'
    ELSE '✗ No'
  END as 'Tiene Fórmula',
  visible as 'Visible',
  orden_presentacion as 'Orden'
FROM layout_operaciones
WHERE empresa_id = 'EMPRESA01'
  AND anio = 2025
  AND modulo IN ('RESUMEN', 'SUMMARY')
ORDER BY modulo, capitulo, orden_presentacion, clase, operacion_tipo;
