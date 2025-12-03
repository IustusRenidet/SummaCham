#### **1. Definición de COLUMNAS (Horizontal)**

El reporte se divide en dos grandes bloques temporales: **Mensual (Month)** y  **Acumulado (Year-To-Date / YTD)** .

| **Índice** | **Nombre Columna**      | **Descripción Técnica para la IA**                                                                                       | **Fuente de Datos**                            |
| ----------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **A**       | **Rubro / Concepto**    | Etiqueta de la fila (ej. "Membership", "Events"). Define la categoría de agrupación.                                           | Mapeo desde `CUENTAS SUMMARY.xlsx`                 |
| **B**       | **Month Actual**        | Importe Real del mes seleccionado.                                                                                               | `SALDOSxx.csv`(Columna `CARGO`-`ABONO`del mes) |
| **C**       | **Month Plan**          | Importe Presupuestado del mes seleccionado.                                                                                      | `PRESUPxx.csv`o Base de Datos de Presupuestos      |
| **D**       | **Month Prior Year**    | Importe Real del mismo mes del año anterior.                                                                                    | `SALDOS(Año-1).csv`                               |
| **E**       | **Month Var vs Plan %** | Variación porcentual contra presupuesto.``Fórmula Ingreso:`(Actual - Plan) / Plan` ``Fórmula Gasto:`(Plan - Actual) / Plan` | Calculado                                            |
| **F**       | **Month Var vs PY %**   | Variación porcentual contra año anterior.                                                                                      | Calculado                                            |
| **G**       | *(Espacio)*                 | Columna separadora vacía.                                                                                                       | N/A                                                  |
| **H**       | **YTD Actual**          | Suma acumulada desde Enero hasta el mes seleccionado (Real).                                                                     | `ACUMxx.csv`o Suma de `SALDOSxx`                 |
| **I**       | **YTD Plan**            | Suma acumulada desde Enero hasta el mes seleccionado (Presupuesto).                                                              | `PRESUPxx`acumulado                                |
| **J**       | **YTD Prior Year**      | Suma acumulada año anterior.                                                                                                    | `ACUM(Año-1).csv`                                 |
| **K**       | **YTD Var vs Plan %**   | Variación acumulada % (misma lógica que mes).                                                                                  | Calculado                                            |
| **L**       | **YTD Var vs PY %**     | Variación acumulada % (misma lógica que mes).                                                                                  | Calculado                                            |

> **Nota para la IA:** Los valores positivos en Ingresos son favorables (Better). Los valores positivos en Gastos (si `Plan > Actual`) son favorables (Better). El reporte suele mostrar `B/(W)` (Better/Worse).

---

### **2. Definición de FILAS (Vertical)**

Las filas son jerárquicas y agrupan cuentas contables específicas. No son cuentas individuales, sino "contenedores".

**Jerarquía Típica:**

1. **SECCIÓN (Header):** Agrupador principal.
   * *Ejemplos:* `CDMX Income`, `CDMX Expense`, `Guadalajara Income`.
   * *Comportamiento:* Suma aritmética de sus filas hijas.
2. **FILA DE DETALLE (Row):** El rubro específico a reportar.
   * *Ejemplos:* `Membership`, `Events`, `Committees`, `G&A` (Gastos Generales).
   * *Lógica de Mapeo:* Una fila agrupa un rango de cuentas contables.
     * `Membership` (Ingreso) = Suma de cuentas `401%` (Cuotas), `402%` (Socios Nuevos).
     * `Events` (Ingreso) = Suma de cuentas `407%`, `408%`.
     * `G&A` (Gasto) = Suma de cuentas `801%`, `901%`.
3. **TOTALES (Calculated Rows):** Filas de resultado matemático.
   * `CONSOLIDATED INCOME` = Suma de todos los  *Income Sections* .
   * `CONSOLIDATED EXPENSES` = Suma de todos los  *Expense Sections* .
   * `OPERATING RESULTS` (Utilidad Operativa) = `Income` - `Expense`.
   * `NET RESULTS` (Resultado Final) = `Operating Results` + `Other Income` (Intereses, Cambiaria).
