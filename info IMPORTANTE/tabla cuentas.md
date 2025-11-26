En  **Aspel-COI** , el **nombre de las cuentas contables** proviene de una sola tabla maestra:

# ✅ **Tabla origen del nombre de la cuenta: `CUENTASxx`**

En cada empresa hay una tabla por ejercicio llamada:

```
CUENTAS05
CUENTAS06
CUENTAS07
...
CUENTAS25
```

El sufijo indica el **ejercicio contable** (05 = 2005, 25 = 2025, etc.).

Dentro de esta tabla están **todas las cuentas contables** del catálogo.

Sus dos campos principales son:

| Campo                              | Significado                                                 |
| ---------------------------------- | ----------------------------------------------------------- |
| **CUENTA**                   | El código contable (ej.*102-001-000-00* )                |
| **NOMBRE**o**DESCRIP** | El**nombre de la cuenta**(ej. *Bancos Nacionales* ) |

Ese campo ( **NOMBRE/DESCRIP** ) es el que COI usa para mostrar el **nombre de la cuenta** en:

* Catálogo de cuentas
* Pólizas
* Auxiliares
* Balanza
* Reportes personalizados
* Interfaces de captura

# ¿Cómo lo usa COI?

### ✔ En una póliza (`AUXILIARxx`):

Las partidas guardan solo el código de la cuenta:

```
CUENTA = '102-001-000-00'
```

COI **NO** guarda el nombre aquí.

Cuando COI muestra la póliza, **hace un JOIN interno** así:

```
AUXILIARxx.CUENTA  →  CUENTASxx.CUENTA
```

y obtiene el campo:

```
CUENTASxx.NOMBRE   (o DESCRIP)
```

Ese es el nombre que ves en cualquier reporte.

# Resumen super claro

* El **nombre de la cuenta no viene de AUXILIAR** ni de POLIZAS.
* El nombre **siempre se toma** de la tabla del catálogo: `CUENTASxx`.
* El único campo que COI usa para ese nombre es  **NOMBRE/DESCRIP** .
