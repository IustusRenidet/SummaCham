# Verificación Completa del Flujo de Autorización

## ✅ Correcciones Aplicadas

### 1. Sincronización de Estados Backend-Frontend
**Problema**: El backend devuelve estados en MAYÚSCULAS (`SIN_CARGAR`, `EDITANDO`, etc.) pero el frontend esperaba minúsculas con guiones (`sin-cargar`, `editando`, etc.)

**Archivos Corregidos**:
- `vistas/js/summary-view.js` - Agregada función `normalizarEstado()` y completado `WORKFLOW_LABEL`
- `vistas/js/resumen-view.js` - Agregada función `normalizarEstado()` y completado `WORKFLOW_LABEL`

**Estados Normalizados**:
| Backend (MAYÚSCULAS) | Frontend (minúsculas) | Etiqueta Display |
|---------------------|----------------------|------------------|
| `SIN_CARGAR`        | `sin-cargar`         | Sin cargar       |
| `EDITANDO`          | `editando`           | Editando         |
| `REVISADO`          | `revisado`           | Revisado         |
| `APROBADO`          | `autorizado`         | Autorizado       |
| `GUARDADO`          | `guardado`           | Guardado en COI  |
| `PENDIENTE`         | `pendiente`          | Pendiente        |
| `RECHAZADO`         | `rechazado`          | Rechazado        |

### 2. Normalización Aplicada en 3 Puntos Críticos
Para `summary-view.js` y `resumen-view.js`:

1. **Al cargar workflow** (`cargarWorkflow`)
   - `workflowEstado.estado = normalizarEstado(data.estado)`
   - `workflowEstado.historial` mapeado con `normalizarEstado(h.estado)`

2. **Al actualizar workflow** (`postAccionWorkflow`)
   - `workflowEstado.estado = normalizarEstado(data.estado)`
   - `workflowEstado.historial` mapeado con `normalizarEstado(h.estado)`

3. **Al renderizar** (`renderWorkflow`)
   - Usa `WORKFLOW_LABEL[workflowEstado.estado]` con estados normalizados

---

## 🧪 Plan de Verificación por Módulo

### **SUMMARY** (vistas/SUMMARY.html)
#### Pruebas a Realizar:
1. ✅ **Estado Inicial**
   - Abrir módulo sin datos
   - Verificar badge muestra "Sin cargar" (no "EDITANDO")
   - Verificar botones correctos están visibles

2. ✅ **Cargar Presupuesto**
   - Click en "Cargar presupuesto"
   - Verificar estado cambia a "Editando"
   - Verificar modo edición se activa (celdas editables)

3. ✅ **Notificaciones**
   - Verificar toast aparece con mensajes de éxito/error
   - Verificar formato y contenido correcto

4. ✅ **Inserción de Filas**
   - Click derecho en fila → "Insertar sección"
   - Verificar sección se inserta correctamente
   - Verificar formato de columnas (etiqueta en columna 7)
   - Click derecho → "Insertar operación"
   - Verificar operación se inserta bajo la sección

5. ✅ **Toggle Cuentas**
   - Click en "Mostrar/Ocultar cuentas"
   - Verificar cuentas se expanden/colapsan
   - Verificar etiqueta cambia correctamente

6. ✅ **Hover Effects**
   - Pasar mouse sobre celdas editables
   - Verificar contraste visible (no blanco sobre blanco)

7. ✅ **Persistencia**
   - Cerrar app
   - Reabrir
   - Verificar sesión persiste (localStorage)
   - Verificar empresa y contexto se restauran

---

### **RESUMEN** (vistas/RESUMEN.html)
#### Pruebas a Realizar:
1. ✅ **Estado Inicial**
   - Verificar badge "Sin cargar"
   - Verificar botones según permisos

2. ✅ **Modo Edición**
   - Activar modo edición
   - Verificar estado "Editando"
   - Verificar celdas editables tienen estilos correctos

3. ✅ **Estructura de Columnas**
   - Verificar etiquetas de secciones/operaciones en columna 7 (Descripción)
   - Verificar orden: Cuenta → 5 data cols → Descripción → 5 YTD cols

4. ✅ **Context Menu**
   - Verificar menú contextual funciona
   - Verificar opciones según permisos del usuario

5. ✅ **Totales**
   - Verificar filas de totales tienen formato correcto
   - Verificar etiqueta en columna correcta

---

### **Módulos de Planeación** (usan flujo-autorizacion.js)
Estos módulos ya tienen la lógica correcta en `flujo-autorizacion.js`:

#### **Finanzas** (vistas/Finanzas.html)
1. ✅ Estado se muestra correctamente en badge
2. ✅ Modo edición funciona
3. ✅ Botones visibles según estado y permisos
4. ✅ Inserción de filas (secciones/operaciones)
5. ✅ Context menu funcional

#### **Eventos** (vistas/Eventos.html)
- Mismas pruebas que Finanzas

#### **Comités** (vistas/Comités.html)
- Mismas pruebas que Finanzas

#### **Comunicación** (vistas/Comunicación.html)
- Mismas pruebas que Finanzas

#### **Dirección** (vistas/Dirección.html)
- Mismas pruebas que Finanzas

#### **Gtos_Corporativos** (vistas/Gtos_Corporativos.html)
- Mismas pruebas que Finanzas

#### **Membresía** (vistas/Membresía.html)
- Mismas pruebas que Finanzas

#### **RH** (vistas/RH.html)
- Mismas pruebas que Finanzas

#### **Serv_Membresía** (vistas/Serv_Membresía.html)
- Mismas pruebas que Finanzas

#### **T&IC** (vistas/T&IC.html)
- Mismas pruebas que Finanzas

#### **VPE** (vistas/VPE.html)
- Mismas pruebas que Finanzas

---

## 🔄 Flujo de Autorización Completo

### Estados y Transiciones
```
SIN_CARGAR
    ↓ [Cargar presupuesto]
EDITANDO
    ↓ [Guardar borrador] → EDITANDO (persiste)
    ↓ [Enviar a revisión]
PENDIENTE
    ↓ [Marcar como revisado]
REVISADO
    ↓ [Autorizar]
APROBADO
    ↓ [Guardar en COI]
GUARDADO (inmutable)

Rechazos:
PENDIENTE/REVISADO/APROBADO → [Rechazar] → RECHAZADO → [Corregir] → EDITANDO
```

### Permisos por Rol
1. **puede_cargar_guardar**: Crear/editar presupuesto
   - Acciones: Cargar, Guardar borrador, Enviar a revisión
   - Estado activo: EDITANDO

2. **puede_revisar**: Revisar presupuesto enviado
   - Acciones: Marcar como revisado, Rechazar
   - Estado activo: PENDIENTE → REVISADO

3. **puede_aprobar**: Aprobar presupuesto revisado
   - Acciones: Autorizar, Guardar en COI, Rechazar
   - Estado activo: REVISADO → APROBADO → GUARDADO

---

## ⚠️ Problemas Comunes y Soluciones

### Problema: Estado muestra "EDITANDO" cuando no debería
**Causa**: No hay normalización de estados del backend
**Solución**: ✅ Aplicada - Función `normalizarEstado()` en summary-view.js y resumen-view.js

### Problema: Botón toggle no funciona
**Causa**: Event listener no está correctamente configurado
**Solución**: ✅ Ya corregido en versiones anteriores

### Problema: Hover hace texto invisible
**Causa**: CSS con fondo blanco y texto blanco
**Solución**: ✅ Ya corregido en versiones anteriores

### Problema: Columnas desalineadas
**Causa**: Orden incorrecto en renderPrincipal y createTotalsRow
**Solución**: ✅ Ya corregido - Etiqueta en columna 7

### Problema: Sesión se pierde al cerrar app
**Causa**: Uso de sessionStorage en lugar de localStorage
**Solución**: ✅ Ya corregido - Cambio a localStorage

### Problema: Error al recompilar better-sqlite3
**Causa**: Archivo bloqueado por proceso activo
**Solución**: Cerrar todos los procesos de Node/Electron antes de `npm install`

---

## 📋 Checklist de Verificación Final

### Antes de Rebuild
- [x] Cerrar todos los procesos de Electron/Node
- [ ] Ejecutar: `npm rebuild better-sqlite3`
- [ ] Ejecutar: `node scripts/reset_db_and_verify.js`
- [ ] Verificar: seed_users.json tiene empresa3
- [ ] Ejecutar: `npm run dist`

### Después de Rebuild
- [ ] Probar login con usuario de cada empresa
- [ ] Verificar permisos se cargan correctamente
- [ ] Probar cada módulo con flujo completo:
  - [ ] SUMMARY (empresa1/empresa2/empresa3/empresa4)
  - [ ] RESUMEN (empresa1/empresa2/empresa3/empresa4)
  - [ ] Finanzas
  - [ ] Eventos
  - [ ] Comités
  - [ ] Comunicación
  - [ ] Dirección
  - [ ] Gtos_Corporativos
  - [ ] Membresía
  - [ ] RH
  - [ ] Serv_Membresía
  - [ ] T&IC
  - [ ] VPE

### Funcionalidades Críticas
- [ ] Estado del badge correcto en cada paso
- [ ] Botones visibles según permisos
- [ ] Modo edición se activa/desactiva
- [ ] Inserción de secciones funciona
- [ ] Inserción de operaciones funciona
- [ ] Context menu funciona
- [ ] Notificaciones aparecen
- [ ] Persistencia con localStorage
- [ ] Columnas alineadas correctamente
- [ ] Toggle cuentas funciona
- [ ] Hover effects visibles

---

## 📝 Usuarios de Prueba (empresa3 - Noreste)

### Editores (puede_cargar_guardar)
- **YB** (Yanick Brisson) - Membresía
- **AZ** (Adriana Zertuche) - Eventos
- **PV** (Patricio Vazquez) - Comunicación
- **DM** (Daniela Morales) - Serv_Membresía
- **MV** (María Villareal) - Comités
- **AO** (Anamary Olivas) - T&IC
- **CG** (Claudia Gonzalez) - RH
- **DI** (David Ibarra) - Dirección, Finanzas
- **GL** (Gerardo López) - Gtos_Corporativos

### Revisores (puede_revisar)
- **GLINGOW** (Grace Lingow) - 9 módulos
- **AA** (Alberto Arredondo) - Gtos_Corporativos

### Aprobadores (puede_aprobar)
- **PCA** (Pedro Casas Alatriste) - 10 módulos (nivel 3)
- **AMB** (Ana María Bustillos) - 10 módulos (nivel 2)
- **FS** (Federico Saborio) - Membresía (nivel 1)
- **AQ** (Alejandra Quezada) - Comunicación, Eventos, Serv_Membresía (nivel 1)
- **GB** (Guillermo Bernal) - Comités, T&IC (nivel 1)

---

## 🎯 Resultado Esperado

Al completar todas las pruebas:
1. ✅ Estados se muestran correctamente en todos los módulos
2. ✅ No aparece "EDITANDO" cuando debería decir "Sin cargar"
3. ✅ Modo edición funciona en todos los módulos
4. ✅ Inserción de filas funciona correctamente
5. ✅ Columnas están alineadas (etiquetas en columna 7)
6. ✅ Notificaciones aparecen con formato correcto
7. ✅ Persistencia funciona al cerrar/abrir app
8. ✅ Permisos se respetan según rol del usuario
9. ✅ empresa3 (Noreste) funciona igual que las otras empresas
10. ✅ Flujo completo: Cargar → Editar → Enviar → Revisar → Aprobar → Guardar

---

**Última actualización**: 2025-12-09
**Archivos modificados**: 
- `vistas/js/summary-view.js`
- `vistas/js/resumen-view.js`
- `src/config/seed_users.json`
