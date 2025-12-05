# SummaCham - Plan de Correcciones

## Estado General

- **Total de errores identificados** : 12
- **Correcciones pendientes** : 6
- **Prioridad** : Crítica

---

## Fase 1: Correcciones Críticas

### [/] 1.1 Corregir método `obtenerDatosUsuario` inexistente

- **Archivo** :

  flujo-autorizacion.js línea 379

- **Descripción** : `Sesion.obtenerDatosUsuario()` no existe, debe ser `Sesion.obtener()?.usuario`
- **Prioridad** : Alta

### [x] 1.2 Resolver conflicto de sistemas de workflow duplicados

- **Archivos** :

  planeacion-modulo-vista.js,

  flujo-autorizacion.js

- **Descripción** : Dos sistemas compiten - eliminar lógica de workflow de planeacion-modulo-vista.js
- **Pasos** :

- [ ] Identificar funciones de workflow en planeacion-modulo-vista.js
- [ ] Comentar/eliminar

  ejecutarAccionWorkflow()

- [ ] Mantener solo funciones de UI/año
- [ ] Verificar que flujo-autorizacion.js maneje todo

- **Prioridad** : Alta

### [ ] 1.3 Verificar orden de carga de scripts en todos los HTML

- **Archivos a revisar** :

- [ ] RESUMEN.html
- [ ] SUMMARY.html
- [ ] Finanzas.html
- [ ] Comites.html
- [ ] Comunicacion.html
- [ ] Direccion.html
- [ ] Eventos.html
- [ ] GtosCorporativos.html
- [ ] Membresia.html
- [ ] RH.html
- [ ] ServMembresia.html
- [ ] TIC.html
- [ ] VPE.html

- **Verificar** : Bootstrap antes de flujo-autorizacion.js
- **Prioridad** : Alta

---

## Fase 2: Integración de Módulos

### [x] 2.1 Corregir referencia a `addAccountBtn` en modal

- **Archivo** :

  cuentas-modulo.js línea 456

- **Descripción** : Variable no definida en el contexto
- **Prioridad** : Media

### [ ] 2.2 Verificar IDs de botones en todos los HTML

- **IDs requeridos por flujo-autorizacion.js** :
- `btnGuardarBorrador`
- `btnEnviarCambios`
- `btnCancelarEdicion`
- `btnMarcarRevisado`
- `btnAutorizar`
- `btnRechazar`
- `btnVerBorrador`
- `saveBudgetBtn`
- **Prioridad** : Alta

### [ ] 2.3 Verificar atributos de datos en celdas editables

- **Atributos requeridos en filas** : `data-cuenta21`, `data-cuenta`
- **Atributos requeridos en celdas** : `data-columna-clave`
- **Verificar en** :

- [ ] cuentas-modulo.js (generación dinámica)
- [ ] resumen-view.js (generación dinámica)
- [ ] summary-view.js (generación dinámica)

- **Prioridad** : Alta

### [ ] 2.4 Verificar emisión de evento de contexto

- **Evento** : `planeacion:contexto-actualizado`
- **Debe incluir** : { empresaId, anio, modulo }
- **Archivos que deben emitir** :

- [ ] planeacion-modulo-vista.js
- [ ] resumen-view.js
- [ ] summary-view.js

- **Prioridad** : Alta

---

## Fase 3: Refinamiento

### [x] 3.1 Eliminar ruta duplicada del backend

- **Archivo** :

  server.js línea 53

- **Descripción** : `/api/workflow/borradores` duplica `/api/borradores`
- **Prioridad** : Baja

### [x] 3.2 Corregir validación de permisos en ruta /enviar

- **Archivo** :

  src/routes/borradores.js

- **Descripción** : Debería requerir `Cargar y guardar`, no `Revisar`
- **Prioridad** : Media

### [x] 3.3 Agregar retry de contexto inicial

- **Archivo** :

  flujo-autorizacion.js método

  \_hidratarContextoInicial

- **Descripción** : Si el año no está disponible, reintentar con delay
- **Prioridad** : Media

### [ ] 3.4 Mejorar manejo de errores en llamadas API

- **Archivos a revisar** :

- [ ] flujo-autorizacion.js
- [ ] planeacion-modulo-vista.js
- [ ] cuentas-modulo.js

- **Prioridad** : Baja

---

## Verificación Final

### [ ] Tests de integración manual

- [ ] Login exitoso
- [ ] Selección de empresa
- [ ] Carga de módulo Presupuestos
- [ ] Activación modo edición
- [ ] Edición de celda
- [ ] Guardar borrador
- [ ] Enviar a revisión
- [ ] Marcar revisado
- [ ] Autorizar
- [ ] Guardar en COI
- [ ] Ver Centro de Borradores
- [ ] Ver Historial

### [ ] Tests por módulo

- [ ] Presupuestos
- [ ] RESUMEN
- [ ] SUMMARY
- [ ] Finanzas
- [ ] Comités
- [ ] Comunicación
- [ ] Dirección
- [ ] Eventos
- [ ] Gastos Corporativos
- [ ] Membresía
- [ ] Recursos Humanos
- [ ] Servicios Membresía
- [ ] TIC
- [ ] VPE

---

## Notas de Implementación

- Al hacer cambios, ejecutar `npm start` y verificar que no hay errores en consola
- Usar el script de verificación del apéndice del análisis
- Documentar cualquier problema nuevo encontrado
