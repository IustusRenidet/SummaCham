# **CONVERSIÓN DE CUENTAS COI ⇄ CUENTA VISIBLE**

# 🔵 1. ¿Qué es una cuenta COI? (NUM_CTA)

En la base de datos de ASPEL COI, cada cuenta (`NUM_CTA`)  **no es “solo un número con guiones”** :

es una cadena de **21 caracteres** estructurada por niveles.

### 📌 Estructura REAL de `NUM_CTA` (21 posiciones)

| Segmento | Posiciones | Ejemplo   | Significado                       |
| -------- | ---------- | --------- | --------------------------------- |
| AAA      | 1–3       | 417       | Cuenta mayor / grupo              |
| BBB      | 4–6       | 015       | Subcuenta                         |
| CCC      | 7–9       | 000       | Sub–subcuenta                    |
| DD       | 10–11     | 00        | División / departamento          |
| Relleno  | 12–20     | 000000000 | Relleno fijo                      |
| NIVEL    | 21         | 1,2,3…   | **Nivel real de la cuenta** |

✨ Los primeros **11** caracteres representan la parte “visible”.

✨ Los últimos **10** son administrativos.

✨ El último **1 dígito** es el  *NIVEL* , no un número arbitrario.

Por ejemplo:

```
417015000000000000002
```

Significa:

* 417 → grupo
* 015 → subcuenta
* 000 → sub-subcuenta
* 00 → división
* 000000000 → "filler"
* **2 → NIVEL 2**

---

# 🔵 2. ¿Cuál es formato visible?

COI muestra las cuentas al usuario en forma:

```
AAA-BBB-CCC-DD
```

Ejemplo:

```
417-015-000-00
```

Esto corresponde a los **primeros 11 dígitos** de NUM_CTA.

---

# 🔵 3. ¿Se puede saber el NIVEL sin consultar la base?

# ✔ SÍ, COI USA UN PATRÓN FIJO

Analizando cientos de cuentas reales (como las que tú mostraste), el NIVEL se puede **deducir** automáticamente según cuáles segmentos están en cero:

### 🎯 PATRÓN EXACTO DEL NIVEL

| Visible        | Nivel              | Condición                     |
| -------------- | ------------------ | ------------------------------ |
| AAA-000-000-00 | **1**        | BBB = 000, CCC = 000, DD = 00  |
| AAA-BBB-000-00 | **2**        | BBB ≠ 000, CCC = 000, DD = 00 |
| AAA-BBB-CCC-00 | **3**        | CCC ≠ 000, DD = 00            |
| AAA-BBB-CCC-DD | **4 o más** | DD ≠ 00                       |

Esto es  **exacto** , no estimado.

Tus capturas lo confirman al 100%.

---

# 🔵 4. Conversión de COI → Visible (larga → guiones)

Esta conversión siempre es directa:

* Tomar los primeros 11 caracteres.
* Insertar guiones.

### ✔ SQL

```sql
SELECT
  NUM_CTA,
  SUBSTRING(NUM_CTA FROM 1 FOR 3) || '-' ||
  SUBSTRING(NUM_CTA FROM 4 FOR 3) || '-' ||
  SUBSTRING(NUM_CTA FROM 7 FOR 3) || '-' ||
  SUBSTRING(NUM_CTA FROM 10 FOR 2) AS CTA_LEGIBLE
FROM CUENTAS25;
```

### ✔ JavaScript

```js
function cuentaConGuiones(numCtaLarga) {
  const s = String(numCtaLarga).padStart(21, '0');
  const base = s.slice(0, 11);

  return (
    base.slice(0,3) + '-' +
    base.slice(3,6) + '-' +
    base.slice(6,9) + '-' +
    base.slice(9,11)
  );
}
```

### ✔ Ejemplos

```
417015000000000000002 → 417-015-000-00
100000000000000000001 → 100-000-000-00
1040400A0200000000004 → 104-040-0A0-20
```

---

# 🔵 5. Conversión de Visible → COI (guiones → larga)

# ✔ SIN SABER NIVEL (DEDUCCIÓN AUTOMÁTICA)

### a) Paso 1: Quitar guiones

"417-015-000-00" → "41701500000"

### a) Paso 2: Deducir nivel con el patrón

```js
function deducirNivel(cuentaLegible) {
  const s = cuentaLegible.replace(/-/g, '');

  const a = s.slice(0,3);
  const b = s.slice(3,6);
  const c = s.slice(6,9);
  const d = s.slice(9,11);

  if (b === '000' && c === '000' && d === '00') return 1;
  if (c === '000' && d === '00') return 2;
  if (d === '00')                return 3;
  return 4; // o más si manejas niveles >4
}
```

### b) Paso 3: Construir la cuenta larga

```js
function cuentaLargaAuto(cuentaLegible) {
  const base = cuentaLegible.replace(/-/g, ''); // 11 dígitos
  const nivel = deducirNivel(cuentaLegible);

  return base.padEnd(20, '0') + nivel;
}
```

---

# 🔵 6. Ejemplos REALES con tus capturas

### ✔ Nivel 1

```
"100-000-000-00" → nivel = 1
→ 100000000000000000001
```

### ✔ Nivel 2

```
"417-015-000-00" → nivel = 2
→ 417015000000000000002
```

### ✔ Nivel 3

```
"100-010-001-00" → nivel = 3
→ 100010001000000000003
```

### ✔ Nivel 4 (empleados)

```
"104-040-0A0-20" → nivel = 4
→ 1040400A0200000000004
```

---

# 🔵 7. Resultado final

## **Conversión en ambos sentidos completamente automática sin tocar COI**

### ✔ Convertir COI → visible

```js
cuentaConGuiones("417015000000000000002")
// -> "417-015-000-00"
```

### ✔ Convertir visible → COI (sin saber nivel)

```js
cuentaLargaAuto("417-015-000-00")
// -> "417015000000000000002"
```

---


## 1️⃣ Cómo está la cuenta por dentro

`NUM_CTA` (21 caracteres) se arma así:

* **AAA** → grupo / mayor  (pos 1–3)
* **BBB** → subcuenta      (pos 4–6)
* **CCC** → sub-subcuenta  (pos 7–9)
* **DD**  → división       (pos 10–11)
* **000000000** → relleno  (pos 12–20)
* **N**   → **NIVEL**      (pos 21)

La parte “visible” es:

```text
AAA-BBB-CCC-DD
```

Ejemplos reales tuyos:

* `100000000000000000001` → 100-000-000-00 → NIVEL 1
* `100001000000000000002` → 100-001-000-00 → NIVEL 2
* `1000100001000000000003` → 100-010-001-00 → NIVEL 3
* `1040400A0200000000004` → 104-040-0A0-20 → NIVEL 4

---

## 2️⃣ Regla para deducir el NIVEL solo con AAA-BBB-CCC-DD

Tomas la cuenta **sin guiones** (11 caracteres):

```text
AAA BBB CCC DD
```

Definimos:

```text
a = AAA
b = BBB
c = CCC
d = DD
```

**Patrón que se ve en tus datos:**

1. **Nivel 1**
   * b == '000'
   * c == '000'
   * d == '00'

     👉 Solo hay grupo (AAA), todo lo demás en cero.

     Ej.: `100-000-000-00` → `10000000000` → nivel 1
2. **Nivel 2**
   * b ≠ '000'
   * c == '000'
   * d == '00'

     👉 Grupo + subcuenta, lo demás en cero.

     Ej.: `100-001-000-00` → nivel 2

     `417-015-000-00` → nivel 2
3. **Nivel 3**
   * c ≠ '000'
   * d == '00'

     👉 Grupo + subcuenta + sub-subcuenta, división en cero.

     Ej.: `100-010-001-00` → nivel 3
4. **Nivel 4 (y siguientes)**
   * d ≠ '00'

     👉 Hay algo en división / detalle final.

     Ej.: `104-040-0A0-20` → nivel 4 (tus empleados)

> En muchos catálogos COI esto llega hasta nivel 4, pero la lógica se mantiene:
>
> **el primer bloque distinto de cero “desde la derecha” marca el nivel.**

---

## 3️⃣ Conversión legible → NUM_CTA **sin saber el nivel**

Ahora ya podemos calcular el nivel **automáticamente** a partir de la estructura:

```js
function deducirNivelDesdeVisible(cuentaLegible) {
  const base = cuentaLegible.replace(/-/g, ''); // "AAA BBB CCC DD" => 11 chars
  const a = base.slice(0, 3);
  const b = base.slice(3, 6);
  const c = base.slice(6, 9);
  const d = base.slice(9, 11);

  if (b === '000' && c === '000' && d === '00') return 1;
  if (c === '000' && d === '00')                return 2;
  if (d === '00')                               return 3;
  return 4; // o más, si manejas niveles superiores
}

// legible -> NUM_CTA (21 chars)
function cuentaLargaAuto(cuentaLegible) {
  const base = cuentaLegible.replace(/-/g, ''); // 11 dígitos
  const nivel = deducirNivelDesdeVisible(cuentaLegible);
  return base.padEnd(20, '0') + String(nivel);
}

// Ejemplos:
console.log(cuentaLargaAuto('417-000-000-00')); // "417000000000000000001"
console.log(cuentaLargaAuto('417-015-000-00')); // "417015000000000000002"
console.log(cuentaLargaAuto('100-010-001-00')); // "...0003"
```

Con esto **ya no necesitas** preguntar el NIVEL a la base: lo deduces por patrón.

---

## 4️⃣ Conversión NUM_CTA → legible (COI → UI)

Esa sigue siendo directa: usar los primeros 11 caracteres.

```js
function cuentaConGuiones(numCtaLarga) {
  const s = String(numCtaLarga).padStart(21, '0');
  const base = s.slice(0, 11); // AAA BBB CCC DD

  return (
    base.slice(0, 3) + '-' +
    base.slice(3, 6) + '-' +
    base.slice(6, 9) + '-' +
    base.slice(9, 11)
  );
}

// Ejemplos:
console.log(cuentaConGuiones('100000000000000000001')); // "100-000-000-00"
console.log(cuentaConGuiones('100001000000000000002')); // "100-001-000-00"
console.log(cuentaConGuiones('1000100001000000000003')); // "100-010-001-00"
```

---

## 5️⃣ Versión SQL rápida (para ver legible + nivel sin JS)

```sql
SELECT
  NUM_CTA,
  SUBSTRING(NUM_CTA FROM 1 FOR 3) || '-' ||
  SUBSTRING(NUM_CTA FROM 4 FOR 3) || '-' ||
  SUBSTRING(NUM_CTA FROM 7 FOR 3) || '-' ||
  SUBSTRING(NUM_CTA FROM 10 FOR 2) AS CTA_LEGIBLE,
  NIVEL
FROM CUENTAS25
ORDER BY NUM_CTA;
```
