Para la hoja  **RESUMEN** , la lógica es idéntica en comportamiento pero cambia ligeramente en la estructura de las cuentas (especialmente para CDMX que consolida).

He cruzado tu archivo `RESUMEN.csv` (detalle de cuentas) con las filas marcadas como `RESUMEN` en el archivo `SUMA DE VARIAS SECCIONES.csv`.

Aquí tienes el mapeo del ordenamiento de filas para el reporte  **RESUMEN** :

### Algoritmo de Ordenamiento ("Cascada")

El reporte debe generarse imprimiendo fila por fila en este orden estricto:

1. **Cuentas Detalle** (del bloque actual).
2. **`sum-row`** (Subtotal de esa sección específica).
3. **`sum-row-sumavarios`** (Total Ingresos o Total Gastos - solo al final del bloque).
4. **`sum-row-operativo`** (Resultado Operativo - solo después de Gastos).
5. **`net-row`** (Resultado Final - al puro final).

---

### Mapeo Detallado por Capítulo

#### 1. CIUDAD DE MÉXICO (Consolidador)

A. BLOQUE INCOME (INGRESOS)

Se imprimen las cuentas individuales seguidas de su suma inmediata:

1. Sección **Membership** (Cuentas 401...) **$\rightarrow$** `SUMA DE Membership`
2. Sección **Events** (Cuentas 407...) **$\rightarrow$** `SUMA DE Events`
3. Sección **Committees** (Cuentas 417...) **$\rightarrow$** `SUMA DE Committees`
4. Sección **T&IC** (Cuentas 405...) **$\rightarrow$** `SUMA DE T&IC`
5. Sección **Services to Members** **$\rightarrow$** `SUMA DE Services to Members`
6. Sección **Guadalajara Income** (Cuenta 450-001) **$\rightarrow$** `SUMA DE Guadalajara Income`
7. Sección **Monterrey Income** **$\rightarrow$** `SUMA DE Monterrey Income`
8. Sección **Northwest Income** **$\rightarrow$** `SUMA DE Northwest Income`
   * *CIERRE DE BLOQUE:* Al terminar la última sección de ingresos, insertar:
   * **Fila:** `INCOME` (Total CDMX)
   * **Fila:** `CONSOLIDATED INCOME` (Total Nacional)

**B. BLOQUE EXPENSE (GASTOS)**

1. Sección **Membership** (Cuentas 705...) **$\rightarrow$** `SUMA DE Membership`
2. Sección **Events** **$\rightarrow$** `SUMA DE Events`
3. Sección **Committees** **$\rightarrow$** `SUMA DE Committees`
4. Sección **T&IC** **$\rightarrow$** `SUMA DE T&IC`
5. Sección **Services to Members** **$\rightarrow$** `SUMA DE Services to Members`
6. Sección **Gastos Administrativos** (Cuentas 801...) **$\rightarrow$** `SUMA DE Gastos Administrativos`
7. Sección **Gastos Generales** (Cuentas 901...) **$\rightarrow$** `SUMA DE Gastos Generales`
8. Sección **Nómina** (Cuentas 513...) **$\rightarrow$** `SUMA DE Nómina`
9. Sección **Gastos Corporativos** **$\rightarrow$** `SUMA DE Gastos Corporativos`
10. Sección **Guadalajara/Monterrey/Northwest Expense** **$\rightarrow$** `SUMA DE [City] Expense`
    * *CIERRE DE BLOQUE:* Insertar fila:
    * **Fila:** `EXPENSE` (Total Gastos CDMX)
    * **Fila:** `CONSOLIDATED EXPENSES` (Total Gastos Nacional)

C. RESULTADO OPERATIVO (Corte)

Justo aquí, antes de pasar a "Other", se calculan las diferencias:

1. **Fila:** `OPERATING RESULTS MEXICO` (Income - Expense CDMX)
2. Fila: CONSOLIDATED OPERATING RESULTS (Consolidado)
   (Nota: El archivo CSV también sugiere filas para resultados operativos de GDL, MTY y NW aquí si se requiere desglose).

**D. BLOQUE OTHER / MORE**

1. Sección **Member Centricity** **$\rightarrow$** `SUMA DE Member Centricity`
2. Sección **Other** (Intereses, etc.) **$\rightarrow$** `SUMA DE Other`
3. Sección **[City] Other Income** **$\rightarrow$** `SUMA DE [City] Other Income`

E. RESULTADO NETO (Final)

Al final de todo el reporte CDMX:

1. **Fila:** `NET RESULTS MEXICO`
2. **Fila:** `CONSOLIDATED NET RESULTS`

---

#### 2. SUCURSALES (GUADALAJARA / NORESTE / NOROESTE)

*La estructura es más lineal.*

**A. INCOME**

1. Membership **$\rightarrow$** Suma
2. Events **$\rightarrow$** Suma
3. Committees **$\rightarrow$** Suma
4. T&IC **$\rightarrow$** Suma
5. Services to Members **$\rightarrow$** Suma
   * *CIERRE:* **Fila:** `INCOME`

**B. EXPENSE**

1. Membership **$\rightarrow$** Suma
2. Events **$\rightarrow$** Suma
3. Committees **$\rightarrow$** Suma
4. T&IC **$\rightarrow$** Suma
5. Services to Members **$\rightarrow$** Suma
6. Gastos G&A (o Administrativos) **$\rightarrow$** `SUMA DE Gastos G&A`
7. Nómina **$\rightarrow$** `SUMA DE Nómina`
8. Gastos Corporativos **$\rightarrow$** Suma
9. Cargos Administrativos **$\rightarrow$** `SUMA DE Cargos Administrativos`
   * *CIERRE:* **Fila:** `EXPENSE`

**C. RESULTADO OPERATIVO**

* **Fila:** `OPERATING RESULTS` (Columna `sum-row-operativo`)

**D. OTHER**

1. Member Centricity **$\rightarrow$** Suma
2. Other (Utilidad cambiaria, etc.) **$\rightarrow$** Suma

**E. RESULTADO NETO**

* **Fila:** `NET RESULTS` (Columna `result-net-row`)

### Resumen de Columnas Clave para Programación

Para armar el reporte automáticamente, tu código debe leer el archivo `SUMA DE VARIAS SECCIONES` y usar estos "triggers" (disparadores) para insertar las filas de suma:

| **Columna CSV**  | **Cuándo insertar la fila**                             | **Etiqueta Típica** |
| ---------------------- | -------------------------------------------------------------- | -------------------------- |
| `sum-row`            | Al cambiar de valor en la columna `SECCION`.                 | "SUMA DE [Sección]"       |
| `sum-row-sumavarios` | Al cambiar de valor en la columna `Clase`(Income a Expense). | "INCOME" / "EXPENSE"       |
| `sum-row-operativo`  | Justo después de cerrar el grupo `EXPENSE`.                 | "OPERATING RESULTS"        |
| `net-row`            | Al final de la última cuenta del grupo `OTHER`.             | "NET RESULTS"              |
