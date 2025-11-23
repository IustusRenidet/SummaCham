
# **Cómo se agregan cuentas, secciones y filas especiales**

## **1. Encabezado de sección**

* El usuario escribe libremente el nombre de la sección.

  Ejemplo: **"Ingresos Comités"**
* Crear un encabezado  **inicia una sección nueva** .
* Si una sección no tiene *sum-row* al final, el sistema  **lo agregará automáticamente** .

---

## **2. Cuentas**

* Cada cuenta debe estar dentro de alguna sección existente.
* Si el usuario intenta agregar una cuenta sin haber creado un encabezado antes:

  ➝  **El sistema exige crear primero una sección** .
* Las cuentas pertenecen a la sección más reciente.

---

## **3. Sum-row (suma de una sola sección)**

* El usuario escribe la etiqueta libremente.

  Ejemplo: **"Suma de Ingresos Comités"**
* Solo puede existir  **un sum-row por sección** .
* El sistema lo vincula automáticamente a la  **sección actual** .

---

## **4. Sum-row-sumavarios (suma de varias secciones)**

* El usuario escribe:
  * La etiqueta

    Ejemplo: "Total Comités"
  * Las secciones a sumar, separadas por coma

    Ejemplo: `"Ingresos Comités, Gastos Comités"`
* El sistema valida:
  * Que todas las secciones existan.
  * Que sean  **contiguas**  (Si entre las secciones elegidas aparece  **otra sección que no está en la lista** , entonces NO son contiguas.)).
* Si no cumple ➝  **se muestra error y no se guarda** .

---

## **5. Result-row (resultado final)**

* El usuario escribe la etiqueta libremente.

  Ejemplo: **"Resultado General"**
* Solo puede existir  **uno por tabla** .
* Siempre va  **al final** .
* No se permite agregar filas después de él.

---

## **6. Persistencia**

La estructura completa (secciones, cuentas, sum-rows, result-row) se guarda en:

```
planeacion-layout:{empresaId}:{anio}:{modulo}
```

usando  **localStorage** .

---

Si quieres, puedo convertir esto en un  **diagrama** , un  **JSON de guía** , o una  **validación paso a paso para el front-end** .
