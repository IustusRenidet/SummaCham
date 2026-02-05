# 📸 Guía Visual: Interfaz del Constructor de Fórmulas

## 🖥️ Pantalla 1: Vista de la Tabla

```
┌─────────────────────────────────────────────────────────────────────┐
│ RESUMEN - Ciudad de México                              [Editar ✏️] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ▼ INCOME                                              $1,250,000   │
│    ├─ Membership                                         $450,000   │
│    ├─ Events                                             $380,000   │
│    ├─ Committees                                         $270,000   │
│    └─ Other Income                                       $150,000   │
│                                                                      │
│  ▼ EXPENSES ◄─────────────────────── [Clic derecho aquí]           │
│    ├─ Membership                                        ($120,000)  │
│    ├─ Events                                            ($210,000)  │
│    ├─ Committees                                         ($85,000)  │
│    └─ Operating Expenses                                ($340,000)  │
│                                                                      │
│  ═══════════════════════════════════════════════════════════════   │
│  OPERATING RESULTS                                       $495,000   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Acción:** Clic derecho en "EXPENSES" → Aparece menú contextual

---

## 🖱️ Pantalla 2: Menú Contextual

```
┌─────────────────────────────────────┐
│  EXPENSES                           │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ ✏️  Editar Sección           │ │ ◄─── Clic aquí
│  │ ➕  Agregar Subsección       │ │
│  │ 📋  Copiar                   │ │
│  │ 🗑️  Eliminar                 │ │
│  └───────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
```

**Resultado:** Se abre el panel lateral de edición

---

## 📝 Pantalla 3: Editor de Operación (Panel Lateral)

```
╔════════════════════════════════════════════════════════════════════╗
║  Editar: EXPENSES (SECPRIN_EXPENSES)                          [×]  ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                     ║
║  [Datos] [Fórmula] [Aparición]  ◄─── Pestañas                     ║
║                                                                     ║
║  ┌─────────────────────────────────────────────────────────────┐  ║
║  │ 📐 Constructor de Fórmulas                                  │  ║
║  ├─────────────────────────────────────────────────────────────┤  ║
║  │                                                              │  ║
║  │  Término 1:                                                 │  ║
║  │  ┌────┐ ┌──────────────┐ ┌─────────────────────────────┐  │  ║
║  │  │ +  │ │ Sección/Suma │ │ Membership              ▼  │  │  ║
║  │  └────┘ └──────────────┘ └─────────────────────────────┘  │  ║
║  │                                                       [🗑️] │  ║
║  │                                                              │  ║
║  │  Término 2:                                                 │  ║
║  │  ┌────┐ ┌──────────────┐ ┌─────────────────────────────┐  │  ║
║  │  │ +  │ │ Sección/Suma │ │ Events                  ▼  │  │  ║
║  │  └────┘ └──────────────┘ └─────────────────────────────┘  │  ║
║  │                                                       [🗑️] │  ║
║  │                                                              │  ║
║  │  Término 3:                                                 │  ║
║  │  ┌────┐ ┌──────────────┐ ┌─────────────────────────────┐  │  ║
║  │  │ -  │ │ Sección/Suma │ │ Committees              ▼  │  │  ║
║  │  └────┘ └──────────────┘ └─────────────────────────────┘  │  ║
║  │                                                       [🗑️] │  ║
║  │                                                              │  ║
║  │  Término 4:                                                 │  ║
║  │  ┌────┐ ┌──────────────┐ ┌─────────────────────────────┐  │  ║
║  │  │ +  │ │ Sección/Suma │ │ Operating Expenses      ▼  │  │  ║
║  │  └────┘ └──────────────┘ └─────────────────────────────┘  │  ║
║  │                                                       [🗑️] │  ║
║  │                                                              │  ║
║  │  [+ Agregar Término]                                        │  ║
║  │                                                              │  ║
║  └─────────────────────────────────────────────────────────────┘  ║
║                                                                     ║
║  ┌─────────────────────────────────────────────────────────────┐  ║
║  │ 👁️ Vista Previa:                                            │  ║
║  │                                                              │  ║
║  │  EXPENSES = Membership + Events - Committees +              │  ║
║  │             Operating Expenses                              │  ║
║  │                                                              │  ║
║  └─────────────────────────────────────────────────────────────┘  ║
║                                                                     ║
║  [🗑️ Eliminar]                        [Cerrar]  [💾 Guardar]      ║
║                                                                     ║
╚════════════════════════════════════════════════════════════════════╝
```

---

## 🔄 Pantalla 4: Cambiando el Operador

```
╔════════════════════════════════════════════════════════════════════╗
║  Término 3: Committees                                              ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                     ║
║  Operador:                                                          ║
║  ┌────────────────┐                                                ║
║  │ +  Sumar      │ ◄─── Antes: suma                               ║
║  │ -  Restar     │ ◄─── Clic aquí para cambiar a resta           ║
║  │ ×  Multiplicar│                                                ║
║  │ ÷  Dividir    │                                                ║
║  └────────────────┘                                                ║
║                                                                     ║
╚════════════════════════════════════════════════════════════════════╝
```

**Resultado:** El operador cambia de `+` a `-`

---

## ➕ Pantalla 5: Agregando un Nuevo Término

```
╔════════════════════════════════════════════════════════════════════╗
║  [+ Agregar Término]  ◄─── Clic aquí                               ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                     ║
║  Nuevo término aparece:                                            ║
║                                                                     ║
║  Término 5:  (NUEVO)                                               ║
║  ┌────┐ ┌──────────────┐ ┌─────────────────────────────┐         ║
║  │ +  │ │ Sección/Suma │ │ Seleccionar...          ▼  │         ║
║  └────┘ └──────────────┘ └─────────────────────────────┘         ║
║                                                       [🗑️]         ║
║                                                                     ║
╚════════════════════════════════════════════════════════════════════╝
```

---

## 🔢 Pantalla 6: Seleccionando Tipo "Número"

```
╔════════════════════════════════════════════════════════════════════╗
║  Término 5:                                                         ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                     ║
║  Tipo:                                                              ║
║  ┌──────────────────┐                                              ║
║  │ Sección/Suma    │                                               ║
║  │ Cuenta          │                                               ║
║  │ Operación       │                                               ║
║  │ Número          │ ◄─── Selecciona esto                         ║
║  └──────────────────┘                                              ║
║                                                                     ║
║  Valor:                                                             ║
║  ┌──────────────────┐                                              ║
║  │ 5000            │ ◄─── Escribe el número                       ║
║  └──────────────────┘                                              ║
║                                                                     ║
║  Operador:                                                          ║
║  ┌────┐                                                            ║
║  │ -  │ ◄─── Cambia a resta                                       ║
║  └────┘                                                            ║
║                                                                     ║
╚════════════════════════════════════════════════════════════════════╝
```

**Resultado:** Nuevo término: `- 5000` (ajuste fijo)

---

## 🎯 Pantalla 7: Fórmula Completa Personalizada

```
╔════════════════════════════════════════════════════════════════════╗
║  📐 Constructor de Fórmulas - EXPENSES                             ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                     ║
║  [+] [Sección/Suma] [Membership            ▼] [🗑️]                ║
║  [+] [Sección/Suma] [Events                ▼] [🗑️]                ║
║  [-] [Sección/Suma] [Committees            ▼] [🗑️] ◄─── Resta     ║
║  [+] [Sección/Suma] [Operating Expenses    ▼] [🗑️]                ║
║  [-] [Número       ] [5000                  ] [🗑️] ◄─── Ajuste    ║
║  [×] [Número       ] [0.95                  ] [🗑️] ◄─── Descuento ║
║                                                                     ║
║  [+ Agregar Término]  [🗺️ Mostrar Mapa]                            ║
║                                                                     ║
║  ┌──────────────────────────────────────────────────────────────┐ ║
║  │ 👁️ Vista Previa:                                              │ ║
║  │                                                                │ ║
║  │  EXPENSES = (Membership + Events - Committees +               │ ║
║  │              Operating Expenses - 5000) × 0.95                │ ║
║  │                                                                │ ║
║  │  ✅ Fórmula válida                                             │ ║
║  └──────────────────────────────────────────────────────────────┘ ║
║                                                                     ║
║  [🗑️ Eliminar]                        [Cerrar]  [💾 Guardar]      ║
║                                                                     ║
╚════════════════════════════════════════════════════════════════════╝
```

---

## 🗺️ Pantalla 8: Mapa Visual de la Operación

```
╔════════════════════════════════════════════════════════════════════╗
║  🗺️ Mapa de Operación: EXPENSES                                    ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                     ║
║           ┌─────────────────────────────────┐                      ║
║           │      EXPENSES                   │                      ║
║           │    ($755,000)                   │                      ║
║           └───────────┬─────────────────────┘                      ║
║                       │                                             ║
║         ┌─────────────┼─────────────┬──────────────┐               ║
║         │             │             │              │               ║
║         ▼             ▼             ▼              ▼               ║
║   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐         ║
║   │Membership│  │  Events  │  │Committees│  │Operating │         ║
║   │ $120,000 │  │ $210,000 │  │(-$85,000)│  │ $340,000 │         ║
║   │    [+]   │  │    [+]   │  │    [-]   │  │    [+]   │         ║
║   └──────────┘  └──────────┘  └──────────┘  └──────────┘         ║
║                                                                     ║
║         │             │             │              │               ║
║         └─────────────┴─────────────┴──────────────┘               ║
║                       │                                             ║
║                       ▼                                             ║
║                  $585,000                                          ║
║                       │                                             ║
║                       ▼                                             ║
║                  - 5,000  ◄─── Ajuste fijo                         ║
║                       │                                             ║
║                       ▼                                             ║
║                  $580,000                                          ║
║                       │                                             ║
║                       ▼                                             ║
║                  × 0.95   ◄─── Descuento 5%                        ║
║                       │                                             ║
║                       ▼                                             ║
║           ┌───────────────────────┐                                ║
║           │   RESULTADO FINAL     │                                ║
║           │     $551,000          │                                ║
║           └───────────────────────┘                                ║
║                                                                     ║
║                                      [Cerrar]                      ║
╚════════════════════════════════════════════════════════════════════╝
```

---

## ✅ Pantalla 9: Después de Guardar

```
┌─────────────────────────────────────────────────────────────────────┐
│ ✅ Cambios guardados correctamente                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ▼ INCOME                                              $1,250,000   │
│    ├─ Membership                                         $450,000   │
│    ├─ Events                                             $380,000   │
│    ├─ Committees                                         $270,000   │
│    └─ Other Income                                       $150,000   │
│                                                                      │
│  ▼ EXPENSES                                             ($551,000) ◄│
│    ├─ Membership                                        ($120,000)  │
│    ├─ Events                                            ($210,000)  │
│    ├─ Committees                                          $85,000  ◄│
│    ├─ Operating Expenses                                ($340,000)  │
│    ├─ Ajuste                                              ($5,000) ◄│
│    └─ Factor (×0.95)                                     Aplicado  ◄│
│                                                                      │
│  ═══════════════════════════════════════════════════════════════   │
│  OPERATING RESULTS                                       $699,000  ◄│
│                                                         ↑ Actualizado│
└─────────────────────────────────────────────────────────────────────┘
```

**Nota:** Los valores se recalculan automáticamente

---

## 📊 Comparación Antes/Después

### ANTES de Personalizar:

```
EXPENSES = Membership + Events + Committees + Operating Expenses
         = $120,000 + $210,000 + $85,000 + $340,000
         = $755,000
```

### DESPUÉS de Personalizar:

```
EXPENSES = (Membership + Events - Committees + Operating Expenses - 5000) × 0.95
         = ($120,000 + $210,000 - $85,000 + $340,000 - $5,000) × 0.95
         = $580,000 × 0.95
         = $551,000
```

**Diferencia:** $204,000 menos (27% reducción)

---

## 🎮 Controles y Acciones

```
┌────────────────────────────────────────────────────────────┐
│ Elemento              │ Acción                             │
├────────────────────────────────────────────────────────────┤
│ [+][-][×][÷] Dropdown │ Clic para cambiar operador         │
│ [Tipo] Dropdown       │ Cambiar entre Sección/Cuenta/etc.  │
│ [Valor] Input/Select  │ Escribir o seleccionar valor       │
│ [🗑️] Botón           │ Eliminar este término              │
│ [+ Agregar Término]   │ Añadir nuevo término a la fórmula  │
│ [🗺️ Mostrar Mapa]    │ Ver jerarquía visual               │
│ [💾 Guardar]         │ Aplicar cambios                    │
│ [Cerrar]              │ Cerrar sin guardar                 │
└────────────────────────────────────────────────────────────┘
```

---

## 🎨 Estados Visuales

### Término Normal
```
[+] [Sección/Suma] [Membership ▼] [🗑️]
```

### Término con Error
```
[+] [Sección/Suma] [(vacío)    ▼] [🗑️]
     ▲─── ⚠️ Error: debe seleccionar un valor
```

### Término Nuevo (destacado)
```
[+] [Sección/Suma] [Seleccionar... ▼] [🗑️]
 ▲─── ✨ Nuevo término agregado
```

### Término Modificado
```
[-] [Sección/Suma] [Committees ▼] [🗑️]
 ▲─── 🔄 Cambiado de '+' a '-'
```

---

## 🔍 Tooltips (Al pasar el mouse)

```
     [+]  ◄─── "Sumar este término"
     
     [Sección/Suma]  ◄─── "Tipo de elemento: Sección o Subsección"
     
     [Membership ▼]  ◄─── "Valor: Membership
                            Real: $120,000
                            Plan: $115,000"
     
     [🗑️]  ◄─── "Eliminar este término"
```

---

## 🎯 Flujo Completo (Diagrama)

```
┌────────────────┐
│  Abrir Tabla   │
│    RESUMEN     │
└───────┬────────┘
        │
        ▼
┌────────────────────┐
│ Clic derecho en    │
│     EXPENSES       │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ "Editar Sección"   │
└────────┬───────────┘
         │
         ▼
┌────────────────────────────┐
│  Panel Editor Lateral      │
│  Pestaña "Fórmula"         │
└────────┬───────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Constructor de Fórmulas        │
│  - Ver términos actuales        │
│  - Modificar operadores         │
│  - Agregar/eliminar términos    │
│  - Cambiar tipos y valores      │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────┐
│  Revisar Vista      │
│     Previa          │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  Clic en "Guardar"  │
└────────┬────────────┘
         │
         ▼
┌────────────────────────────┐
│  ✅ Cambios Aplicados       │
│  Valores recalculados      │
│  Tabla actualizada         │
└────────────────────────────┘
```

---

## 📝 Notas Importantes

```
╔═══════════════════════════════════════════════════════════════╗
║  💡 TIPS                                                      ║
╠═══════════════════════════════════════════════════════════════╣
║                                                                ║
║  • Activa "Modo Edición" antes de editar                      ║
║  • Usa "Vista Previa" para verificar fórmula                  ║
║  • "Mapa Visual" ayuda con fórmulas complejas                 ║
║  • Guarda frecuentemente                                      ║
║  • Los cambios se aplican de inmediato                        ║
║                                                                ║
╚═══════════════════════════════════════════════════════════════╝
```

---

**Guía Visual creada:** 4 de febrero de 2026
**Sistema:** SummaCham - Constructor de Fórmulas
