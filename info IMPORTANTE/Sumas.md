
# ✅ **Tipos de filas y qué suma cada una**

## 🟦 **1. Cuenta normal (row de cuenta)**

**Qué es:**

Una línea individual con una cuenta contable (ej. 404-017-000-00).

**Qué suma:**

Nada. Ya hace lo que tiene que hacer

Es solo el valor de la cuenta por mes.

---

## 🟩 **2. SUMA ROW (suma por sección) sum-row**

**Qué es:**

La fila que aparece al final de una sección (por ejemplo: “Ingresos Comités”, “Membresías”, “Otros ingresos”).

**Qué suma:**

👉 **Suma todas las cuentas que pertenecen solo a esa sección.**

**Ejemplo:**

Si una sección tiene 5 cuentas adentro, la SUMA ROW es:

```
=SUM(D5:D9)
```

**Para qué sirve:**

Es el “subtotal” de esa sección y representa el total real de su bloque.

---

## 🟨 **3. SUMARIOS (suma de varias secciones) sum-row-sumavarios**

**Qué es:**

Una fila que agrupa **dos o más SUMA ROW** de secciones distintas.

**Qué suma:**

👉 **Suma varias SUMA ROW.**

No suma cuentas individuales.

**Ejemplo:**

Si hay 3 secciones:

* Ingresos CE/Board
* Ingresos Desarrollo de Negocios
* Otros ingresos

El SUMARIO es:

```
=SUM(D_SUMA_CE , D_SUMA_DN , D_SUMA_OTROS)
```

**Para qué sirve:**

Es un subtotal “administrativo” o “temático” que junta varias secciones.

**Importante:**

El SUMARIO **no debe** usarse para el total final porque ya contiene SUMA ROW adentro.

---

## 🔴 **4. RESULT ROW (total final del reporte) result-row**

**Qué es:**

La fila inferior que muestra **el total general** (total de ingresos, total de gastos, o resultado).

**Qué suma:**

👉 **Suma únicamente SUMA ROW** de todas las secciones.

❗ **NO** suma SUMARIOS (para evitar duplicar datos).

**Ejemplo correcto:**

```
=SUM( SUMA_ROW_1 , SUMA_ROW_2 , SUMA_ROW_3 , SUMA_ROW_4 )
```

**Ejemplo incorrecto (que causa duplicación):**

```
=SUM( SUMA_ROW + SUMARIOS )
```

**Para qué sirve:**

Es el número maestro: el total general usado en reportes ejecutivos y consolidados.

---

# 🎯 **Resumen ultra claro**

| Tipo de fila         | Qué representa                     | Qué suma                               |
| -------------------- | ----------------------------------- | --------------------------------------- |
| **Cuenta**     | Una cuenta contable individual      | Nada                                    |
| **SUMA ROW**   | Total de una sola sección          | Todas las cuentas dentro de la sección |
| **SUMARIOS**   | Total de varias secciones agrupadas | Sus SUMA ROW                            |
| **RESULT ROW** | Total general                       | Todas las SUMA ROW (no suma SUMARIOS)   |
