Basado en el análisis del archivo **`info IMPORTANTE/CUENTAS SUMMARY y RESUMEN.xlsx - RESUMEN.csv`** que acabas de subir, este archivo cumple una función diferente al anterior. Mientras que el "Summary" es un Estado de Resultados detallado, el **RESUMEN** es una  **guía de agrupación de alto nivel** .

Aquí tienes la explicación técnica estructurada para que una IA entienda cómo construir el reporte  **RESUMEN** .

---

### **Estructura del Reporte: RESUMEN (Vista Ejecutiva)**

Este archivo (`RESUMEN.csv`) no contiene datos numéricos; es un  **Mapeo de Categorización (Mapping Table)** . Su función es traducir el plan de cuentas contable (miles de cuentas) en una vista ejecutiva compacta (pocas filas).

#### **1. Definición de COLUMNAS del Archivo de Configuración**

La IA debe leer este archivo fila por fila para entender "dónde guardar" cada centavo que encuentre en la balanza.

| **Columna en CSV**         | **Significado Técnico para la IA** | **Ejemplo / Lógica**                                                                                                                                                                                                                                                                              |
| -------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A: CAPITULO**            | **Filtro de Entidad**               | Define a qué Unidad de Negocio aplica la regla.``*Ejemplos:* `CIUDAD DE MÉXICO`,`GUADALAJARA`,`NORESTE`.``**Regla:**Si estás procesando datos de la empresa "Monterrey", ignora las filas que digan "CIUDAD DE MÉXICO".                                                        |
| **B: SECCIÓN Principal**  | **Agrupador Nivel 1 (Padre)**       | Es la categoría macro del reporte.``*Valores:* `INCOME`(Ingresos),`EXPENSE`(Gastos),`OPERATING RESULTS`(Resultados Operativos).                                                                                                                                                          |
| **C: SECCIÓN Secundaria** | **Agrupador Nivel 2 (Hijo/Fila)**   | Es la fila visible en el reporte final. La IA debe sumar todas las cuentas que compartan este nombre.``*Ejemplos:* `Membership`,`Events`,`G&A`,`Nómina`.                                                                                                                               |
| **D: CUENTA**              | **Llave Primaria (ID)**             | El número de cuenta contable específico que se debe buscar en los archivos de saldos (`SALDOSxx.csv`).``*Formato:* `401-000-000-00`.``**Nota Crítica:**La IA debe "normalizar" este dato (quitar guiones) para que coincida con la base de datos (que suele ser `40100000...`). |
| **E: NOMBRE**              | **Descripción (Metadato)**         | Nombre humano de la cuenta. Sirve para validación o depuración, pero el ID clave es la columna D.                                                                                                                                                                                                      |

---

### **2. Lógica de Cálculo (El Algoritmo)**

Para generar el reporte  **RESUMEN** , la IA debe seguir este proceso de agregación:

1. **Iterar** sobre todas las transacciones/saldos del mes (`SALDOSxx.csv`).
2. **Identificar** a qué `CAPITULO` pertenece el saldo (basado en el ID de la empresa).
3. **Buscar** el número de cuenta en este archivo `RESUMEN.csv` (columna D).
4. **Asignar** el monto a la `SECCION Secundaria` correspondiente (Columna C).
   * *Ejemplo:* Si encuentra saldo en la cuenta `401-000-000-00` y `402-000-000-00`, ambos montos se suman en la fila única  **"Membership"** .
5. **Agrupar** finalmente por `SECCIÓN Principal` para obtener subtotales (Total Income, Total Expense).

---

### **Instrucción (Prompt) para la IA**

Copia y pega esto para explicarle a tu modelo cómo procesar este archivo:

> *"El archivo `RESUMEN.csv` actúa como un  **Árbol de Jerarquías** . No contiene saldos, sino reglas de agrupación.
>
> **Tu tarea es:**
>
> 1. Leer el archivo de `SALDOS` (que tiene dinero real).
> 2. Para cada cuenta con saldo, buscar su código en la columna `CUENTA` del archivo `RESUMEN.csv`.
> 3. Si encuentras coincidencia, suma ese valor a la categoría definida en la columna `SECCION Secundaria` (Ej: 'Membership').
> 4. Ten cuidado con el formato de la cuenta: en el CSV de mapeo vienen con guiones (`401-000...`) pero en los Saldos pueden venir limpios (`401000...`). Debes normalizarlos eliminando guiones antes de comparar.
> 5. Genera una matriz donde las Filas sean las `SECCION Secundaria` únicas y las Columnas sean los periodos de tiempo (Mes Actual, Acumulado, Presupuesto)."*

### **Diferencia Clave con el "SUMMARY"**

* **SUMMARY:** Es detallado. Muestra filas específicas como "Cuotas Netas", "Socios Nuevos".
* **RESUMEN:** Es consolidado. Toma "Cuotas Netas" + "Socios Nuevos" y las colapsa en una sola fila llamada **"Membership"** (Membresía). Es una vista de "gran altura" para directivos.
