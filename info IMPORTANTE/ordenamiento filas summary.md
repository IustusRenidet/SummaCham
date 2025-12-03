Basado en la lógica que describes ("las sumas van debajo de sus cuentas" y "se acumulan jerárquicamente hasta el final"), y cruzando la información de tus archivos `SUMA DE VARIAS SECCIONES.csv` y los detalles de las cuentas, he mapeado el orden exacto de las filas.

El algoritmo de ordenamiento funciona en "Cascada" (Waterfall): **Detalle **$\rightarrow$** Subtotal Sección **$\rightarrow$** Total Rubro **$\rightarrow$** Resultado Operativo **$\rightarrow$** Resultado Neto.**

Aquí tienes el mapa de ordenamiento lógico para generar el reporte:

### Estructura General del Mapeo (Lógica de Filas)

El sistema debe recorrer los datos en este orden de prioridad:

1. **Agrupador Principal:** (Primero INCOME, luego EXPENSE, luego OTHER).
2. **Agrupador Secundario:** (Membership, Events, Committees, etc.).
3. **Cuentas Individuales:** (Las filas 400..., 500..., etc.).
4. **`sum-row`:** La suma inmediata de la sección anterior.
5. **`sum-row-sumavarios`:** El cierre del bloque (ej. Total Income).
6. **`sum-row-operativo`:** El cálculo de Ingresos menos Gastos.
7. **`net-row` / `result-net-row`:** El resultado final después de partidas no operativas.

---

### Ejemplo Mapeado: CAPÍTULO CIUDAD DE MÉXICO (CDMX)

Basado en `SUMMARY.csv` y `SUMA DE VARIAS SECCIONES.csv`, así es como deben imprimirse las filas secuencialmente:

#### BLOQUE 1: INCOME (Ingresos)

1. **Sección Membership**
   * *Fila:* Cuenta 401... Cuotas Netas
   * *Fila:* Cuenta 402... Ingresos socios nuevos
   * ... (resto de cuentas)
   * **Fila SUMA:** `SUMA DE Membership` *(Columna sum-row)*
2. **Sección Events**
   * *Fila:* Cuenta 407... Eventos
   * *Fila:* Cuenta 408... Patrocinios
   * ...
   * **Fila SUMA:** `SUMA DE Events` *(Columna sum-row)*
3. **Sección Committees**
   * *Fila:* Cuentas...
   * **Fila SUMA:** `SUMA DE Committees` *(Columna sum-row)*
4. **Sección Services to Members**
   * *Fila:* Cuentas...
   * **Fila SUMA:** `SUMA DE Services to Members` *(Columna sum-row)*
5. **(Cierre de Bloque Ingresos)**
   * **Fila GRAN SUMA:** `CDMX Income` / `CONSOLIDATED INCOME` *(Columna sum-row-sumavarios)*

---

#### BLOQUE 2: EXPENSE (Gastos)

1. **Sección Membership** (Gastos)
   * *Fila:* Cuenta 500... / 600...
   * **Fila SUMA:** `SUMA DE Membership` *(Columna sum-row)*
2. **Sección Events** (Gastos)
   * *Fila:* Cuentas de costos de eventos...
   * **Fila SUMA:** `SUMA DE Events` *(Columna sum-row)*
3. **Sección Committees** (Gastos)
   * *Fila:* Cuentas...
   * **Fila SUMA:** `SUMA DE Committees` *(Columna sum-row)*
4. **Sección G&A / Payroll**
   * *Fila:* Nómina, Rentas, etc.
   * **Fila SUMA:** `SUMA DE Gastos G&A` / `Nómina`
5. **(Cierre de Bloque Gastos)**
   * **Fila GRAN SUMA:** `CDMX Expense` (o Total Expense) *(Implícito al cerrar el grupo Expense)*

---

#### BLOQUE 3: RESULTADOS (Cálculos Finales)

*Este bloque se inserta "al último del último elemento que suman" (después de Income y Expense).*

1. **Fila RESULTADO:** `OPERATING RESULTS MEXICO` / `CONSOLIDATED OPERATING RESULTS`
   * *Origen:* Columna `sum-row-operativo` en el CSV.
   * *Lógica:* (Total Bloque 1 - Total Bloque 2).
2. **Sección OTHER (Partidas no operativas)**
   * *Fila:* Otros Ingresos / Otros Gastos / Impuestos
   * **Fila SUMA:** `SUMA DE Other`
3. **Fila FINAL:** `NET RESULTS`
   * *Origen:* Columna `result-net-row` en el CSV.
   * *Ubicación:* Absolutamente al final de la hoja.

### Resumen Visual de la Jerarquía de Columnas (CSV)

Para programar o armar esto en Excel, debes seguir las columnas del archivo `SUMA DE VARIAS SECCIONES` de izquierda a derecha para saber cuándo "cortar" e insertar una suma:

| **Orden de Aparición** | **Columna CSV**  | **Descripción** | **Cuándo se inserta**                                      |
| ----------------------------- | ---------------------- | ---------------------- | ----------------------------------------------------------------- |
| **1**                   | `SECCION`            | Cuentas individuales   | Se listan primero.                                                |
| **2**                   | `sum-row`            | Subtotal Sección      | Al terminar las cuentas de una misma `SECCION`.                 |
| **3**                   | `sum-row-sumavarios` | Total Ingresos/Egresos | Al cambiar de `Clase`(Income a Expense) o al terminar el grupo. |
| **4**                   | `sum-row-operativo`  | Resultado Operativo    | Justo antes de empezar la sección "Other" o impuestos.           |
| **5**                   | `result-net-row`     | Utilidad Neta          | Al final de todos los datos.                                      |
