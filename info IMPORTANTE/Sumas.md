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

# ✅ **Qué es SUMA VARIOS**

`sumavarios` =  **una fila que suma varias secciones completas** .

Pero solo funciona  **si las secciones que vas a sumar están una después de la otra** , sin nada en medio.

---

### 👉 **SUMA VARIOS solo se coloca al final del bloque exacto que engloba.**

### 👉 **Y solo funciona si las secciones son consecutivas.**

**Ejemplo correcto:**

```
SECCIÓN A
SECCIÓN B
SECCIÓN C
SUMA VARIOS (A + B + C)
```

---

# 🟦 **Regla clara para que no duplique nunca**

### ✔ **1. El sumavarios debe estar SOLO al final del bloque.**

### ✔ **2. El bloque debe tener secciones consecutivas sin interrupciones.**

### Bloque 1 – Ingresos Membresía

```
Ingresos Membresía → SUMA ROW
Resultado Operativo Membresía → SUMA VARIOS
```

### Bloque 2 – Gastos Membresía

```
Gastos Membresía → SUMA ROW
Resultado Operativo Membresía → SUMA VARIOS
```

Si colocas un sumavarios aquí:

```
Ingresos Membresía
SUMA INGRESOS
Resultado Operativo  ← SUMAVARIOS
Gastos Membresía
SUMA GASTOS
Resultado Operativo  ← SUMAVARIOS
```

👉 Esto está mal, sin duplicar

# 🎯 **Resumen ultra claro**

| Tipo de fila         | Qué representa                     | Qué suma                               |
| -------------------- | ----------------------------------- | --------------------------------------- |
| **Cuenta**     | Una cuenta contable individual      | Nada                                    |
| **SUMA ROW**   | Total de una sola sección          | Todas las cuentas dentro de la sección |
| **SUMARIOS**   | Total de varias secciones agrupadas | Sus SUMA ROW                            |
| **RESULT ROW** | Total general                       | Todas las SUMA ROW (no suma SUMARIOS)   |
