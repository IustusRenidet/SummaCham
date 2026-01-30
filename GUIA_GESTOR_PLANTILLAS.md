# Guia de uso - Gestor de Plantillas (modo manual)

## Objetivo
Esta guia explica el flujo basico del Gestor de Plantillas y el uso del modo masivo (bulk).
El gestor opera en modo manual: no autogenera ni ajusta operaciones sin que el usuario las defina.

---

## Acceso y permisos
- Abrir: `http://localhost:3000/plantillas.html`
- Requiere permisos de Layouts (o Admin Global).

---

## Flujo basico
1. Selecciona **Modulo**, **Anio** y **Capitulo**.
2. Click en **Cargar Layout**.
3. Edita el layout (Agregar, Editar, Eliminar, Reordenar, Vista previa).
4. Click en **Guardar**.
5. Verifica en el modulo final (RESUMEN / SUMMARY u otros).

---

## Agregar elementos
El alta de elementos es **solo en modo masivo** (bulk).
Llena una fila por elemento y confirma con **Agregar**.

---

## Modo masivo (bulk)
Activa el switch **Modo masivo** en el modal **Agregar Elemento**.
- Enter agrega una fila nueva.
- Llena solo las columnas que apliquen segun el tipo.
- Flechas navegan entre celdas (estilo Excel).
- Al confirmar, la tabla se limpia para evitar duplicados.
- Para **Seccion Principal**: Seccion es input libre.
- Para **Seccion Secundaria**: Seccion (principal) es select y Subseccion es input libre.
- Para **Cuenta** y **Operacion**: Seccion/Subseccion se eligen desde los selects existentes.

### Campos por tipo (modo masivo)

| Tipo | Campos requeridos | Campos opcionales | Campos ignorados | Notas |
| --- | --- | --- | --- | --- |
| seccion-principal | Seccion **o** Nombre | - | Subseccion, Cuenta, Signo, Formula | Crea un bloque principal. |
| seccion-secundaria | Seccion (principal) + Subseccion **o** Nombre | - | Cuenta, Signo, Formula | Crea una subseccion dentro de la principal. |
| cuenta | Cuenta + Nombre | Seccion (principal), Subseccion, Signo/Factor | Formula | Agrega una cuenta al layout. El signo afecta real, ppto y comparativo. |
| operacion | Nombre (si no hay, usa Seccion o Subseccion) | Seccion, Subseccion, Signo, Formula | Cuenta | Crea una operacion con etiqueta y/o formula. |

### Sintaxis de formula (operacion)
Usa formato simple:
- `A + B - C`
- Soporta:
  - **Secciones** (texto)
  - **Subsecciones** con `Principal||Subseccion`
  - **Cuentas** (empiezan con 3 digitos, ej: `401-001-000-00`)
  - **Operaciones** existentes (por nombre o id)
  - **Constantes** numericas (ej: `0.5`)

**Signo**: si se define, se guarda como factor de `sum-row` (+1 o -1).
**Signo/Factor (cuentas)**: si capturas `-1`, la cuenta resta en RESUMEN/SUMMARY; `1` suma (por default).

---

## Consejos rapidos
- Si el layout esta vacio, usa **Agregar** o **Copiar a otro anio**.
- Para ordenar, usa **Reordenar** o el panel de **Orden de la plantilla**.
- Si cambias etiquetas o cuentas, guarda y recarga el layout para validar el orden final.
