# IMPLEMENTACIÓN DE CORRECCIONES - INSERCIÓN DE FILAS Y CÁLCULO DE SUMAS

## CORRECCIÓN #1: Validación Mejorada en `renderizarSecciones()`

### Ubicación
`vistas/js/cuentas-modulo.js`, líneas 1246-1381

### Problema Actual
```javascript
secciones.forEach((lista, seccion) => {
  // Permite secciones vacías
  // No detecta duplicados
  // No valida placeholders
});
```

### Código Corregido
```javascript
const renderizarSecciones = ({
  registros,
  cuerpo,
  placeholdersPorFila,
  sheetName,
  capitulo,
  sumasPersonalizadas,
  resultadoForzado,
  mostrarCuentaVisible = false
}) => {
  // VALIDACIÓN 1: Verificar registros no vacía
  if (!Array.isArray(registros) || !registros.length) {
    console.warn('❌ renderizarSecciones: registros vacío o no es array');
    return {
      resultadoFilas: [],
      sumasSecciones: [],
      sumavarios: new Map(),
      faltantesNombre: []
    };
  }

  // VALIDACIÓN 2: Agrupar por sección
  const secciones = new Map();
  const cuentasVistas = new Set();  // Para detectar duplicados
  
  registros.forEach((item) => {
    const clave = item.seccion || 'SIN SECCION';
    const cuentaKey = `${clave}::${item.cuenta || 'unnamed'}`;
    
    // Detectar duplicado
    if (cuentasVistas.has(cuentaKey)) {
      console.warn(`⚠️ Cuenta duplicada en sección ${clave}: ${item.cuenta}`);
      return;  // Skip duplicado
    }
    cuentasVistas.add(cuentaKey);
    
    if (!secciones.has(clave)) {
      secciones.set(clave, []);
    }
    secciones.get(clave).push(item);
  });

  // VALIDACIÓN 3: Verificar que todas las secciones tengan al menos 1 cuenta
  const seccionesValidas = new Map();
  secciones.forEach((lista, seccion) => {
    if (!lista || lista.length === 0) {
      console.warn(`⚠️ Sección vacía será omitida: ${seccion}`);
      return;
    }
    seccionesValidas.set(seccion, lista);
  });

  // ... resto del código usa seccionesValidas en lugar de secciones
  
  secciones = seccionesValidas;

  const resultRows = new Map();
  const sumasSecciones = [];
  const sumavariosData = new Map();
  const forcedResultTexto = (resultadoForzado || '').toString().trim();

  // ... resto igual
};
```

---

## CORRECCIÓN #2: Validación en `crearSeccionDesdeFormulario()`

### Ubicación
`vistas/js/cuentas-modulo.js`, líneas 1766-1838

### Problema Actual
```javascript
const crearSeccionDesdeFormulario = ({
  referenciaFila,
  titulo,
  sumLabel,
  cuentas,
  sumavariosLabel,
  range
}) => {
  // No valida que cuentas tenga elementos
  // No valida idxInsercion
  // No valida anchor
};
```

### Código Corregido
```javascript
const crearSeccionDesdeFormulario = ({
  referenciaFila,
  titulo,
  sumLabel,
  cuentas,
  sumavariosLabel,
  range
}) => {
  // VALIDACIÓN 1: Verificar tabla existe
  if (!estadoModulo.tabla) {
    console.error('❌ No hay tabla disponible');
    return;
  }

  // VALIDACIÓN 2: Verificar cuerpo
  const cuerpo = estadoModulo.tabla.querySelector('tbody');
  if (!cuerpo) {
    console.error('❌ No hay tbody en tabla');
    return;
  }

  // VALIDACIÓN 3: Verificar título
  if (!titulo || typeof titulo !== 'string' || !titulo.trim()) {
    console.error('❌ Título de sección requerido y debe ser texto');
    return;
  }

  // VALIDACIÓN 4: Verificar cuentas
  if (!Array.isArray(cuentas) || cuentas.length === 0) {
    console.error('❌ Sección debe tener al menos 1 cuenta');
    return;
  }

  // VALIDACIÓN 5: Validar cada cuenta
  const cuentasValidas = cuentas.filter(datos => {
    if (!datos || typeof datos !== 'object') return false;
    if (!datos.cuenta || typeof datos.cuenta !== 'string') return false;
    return true;
  });

  if (cuentasValidas.length === 0) {
    console.error('❌ Ninguna de las cuentas es válida');
    return;
  }

  if (cuentasValidas.length < cuentas.length) {
    console.warn(`⚠️ ${cuentas.length - cuentasValidas.length} cuenta(s) inválida(s) fueron omitida(s)`);
  }

  // VALIDACIÓN 6: Calcular índice de inserción con seguridad
  let idxInsercion = estadoModulo.sumas.secciones.length;
  
  if (referenciaFila) {
    const metaBase = referenciaFila?.classList.contains('sum-row-sumavarios') 
      ? obtenerMetaPorSumavariosFila(referenciaFila)
      : obtenerMetaSeccionPorFila(referenciaFila);
    
    if (metaBase) {
      const idxTentativo = obtenerIndiceInsercionSeccion(metaBase);
      // Verificar que índice es válido
      if (Number.isInteger(idxTentativo) && idxTentativo >= 0 && idxTentativo <= estadoModulo.sumas.secciones.length) {
        idxInsercion = idxTentativo;
      } else {
        console.warn(`⚠️ Índice de inserción inválido: ${idxTentativo}, usando final`);
      }
    }
  }

  // VALIDACIÓN 7: Encontrar anchor con fallback seguro
  const referenciaMeta = estadoModulo.sumas.secciones[idxInsercion] 
    || estadoModulo.sumas.secciones[idxInsercion - 1] 
    || null;

  let anchor = null;
  if (referenciaMeta) {
    anchor = referenciaMeta.elementos?.sumRow 
      || referenciaMeta.filasCuenta?.[0] 
      || null;
  }
  if (!anchor) {
    anchor = obtenerPrimerResultadoFila();
  }

  const seccionClave = normalizarTexto(titulo);
  
  // Crear elementos
  const header = document.createElement('tr');
  header.className = 'section-header-row';
  const celdaHeader = document.createElement('td');
  celdaHeader.colSpan = estadoModulo.placeholdersPorFila + 2;
  celdaHeader.textContent = titulo;
  header.appendChild(celdaHeader);

  const cuentasFilas = cuentasValidas.map((datos) => 
    crearFilaCuentaDesdeDatos(datos, seccionClave)
  );

  const textoSumRow = (sumLabel && typeof sumLabel === 'string' && sumLabel.trim()) 
    ? sumLabel.trim()
    : `Suma ${titulo}`;

  const filaSumRow = agregarFilaResumen({
    texto: textoSumRow,
    clase: 'sum-row',
    cuerpo,
    placeholdersPorFila: estadoModulo.placeholdersPorFila
  });

  if (!filaSumRow) {
    console.warn('⚠️ No se pudo crear fila de suma');
    return;
  }

  // VALIDACIÓN 8: Insertar con seguridad
  try {
    if (anchor && anchor.parentNode === cuerpo) {
      cuerpo.insertBefore(header, anchor);
      cuentasFilas.forEach((fila) => cuerpo.insertBefore(fila, anchor));
      cuerpo.insertBefore(filaSumRow, anchor);
    } else {
      cuerpo.appendChild(header);
      cuentasFilas.forEach((fila) => cuerpo.appendChild(fila));
      cuerpo.appendChild(filaSumRow);
    }
  } catch (error) {
    console.error('❌ Error al insertar sección en DOM:', error);
    return;
  }

  // Crear meta
  const metaNueva = {
    seccion: seccionClave,
    tituloVisible: titulo,
    filasCuenta: cuentasFilas,
    sumRowTexto: normalizarTexto(textoSumRow),
    sumRowSumavariosTexto: '',
    sumRowSumavarios2Texto: '',
    sumRowSumavariosLabel: '',
    sumRowSumavarios2Label: '',
    resultRowTexto: '',
    resultRows: [],
    elementos: {
      header,
      sumRow: filaSumRow
    }
  };

  // VALIDACIÓN 9: Insertar en array con validación de índice
  try {
    if (idxInsercion >= 0 && idxInsercion <= estadoModulo.sumas.secciones.length) {
      estadoModulo.sumas.secciones.splice(idxInsercion, 0, metaNueva);
    } else {
      console.warn(`⚠️ Índice fuera de rango, insertando al final`);
      estadoModulo.sumas.secciones.push(metaNueva);
    }
  } catch (error) {
    console.error('❌ Error al insertar meta en secciones:', error);
    return;
  }

  // Actualizar sumavarios si aplica
  if (sumavariosLabel && range && Array.isArray(range)) {
    const indices = [];
    const rango = range;
    
    // VALIDACIÓN 10: Validar rango
    if (Number.isInteger(rango.start) && Number.isInteger(rango.end)) {
      for (let i = rango.start; i <= rango.end; i += 1) {
        if (i >= 0 && i < estadoModulo.sumas.secciones.length) {
          indices.push(i);
        }
      }
    }
    
    if (indices.length > 1) {  // Solo si hay >1 sección en rango
      actualizarSumavariosParaRango(sumavariosLabel, indices, idxInsercion);
    }
  }

  actualizarEstructuraDespuesCambio();
  console.log(`✅ Sección "${titulo}" creada en índice ${idxInsercion}`);
};
```

---

## CORRECCIÓN #3: Corregir `actualizarSumavariosParaRango()`

### Ubicación
`vistas/js/cuentas-modulo.js`, líneas 1738-1765

### Problema Actual
```javascript
const actualizarSumavariosParaRango = (label, indices, insertIdx) => {
  // Calcula índices ajustados de forma incorrecta
  // No valida que índices sean contiguos
  // No verifica que haya >1 sección
};
```

### Código Corregido
```javascript
const actualizarSumavariosParaRango = (label, indices, insertIdx) => {
  // VALIDACIÓN 1
  if (!label || !Array.isArray(indices) || indices.length < 2) {
    console.warn('⚠️ Sumavarios requiere al menos 2 secciones');
    return;
  }

  // VALIDACIÓN 2: Ordenar y validar índices
  const indicesOrdenados = [...new Set(indices)].sort((a, b) => a - b);
  
  if (indicesOrdenados.some(idx => !Number.isInteger(idx) || idx < 0 || idx >= estadoModulo.sumas.secciones.length)) {
    console.error('❌ Algunos índices no son válidos');
    return;
  }

  // VALIDACIÓN 3: Verificar tabla
  if (!estadoModulo.tabla) {
    console.error('❌ No hay tabla');
    return;
  }

  const cuerpo = estadoModulo.tabla.querySelector('tbody');
  if (!cuerpo) {
    console.error('❌ No hay tbody');
    return;
  }

  // VALIDACIÓN 4: Eliminar fila existente si hay
  const clave = normalizarTexto(label);
  const existente = estadoModulo.sumas.sumavariosRows?.get(clave);
  if (existente && existente.parentNode) {
    try {
      existente.parentNode.removeChild(existente);
      estadoModulo.sumas.sumavariosRows.delete(clave);
    } catch (error) {
      console.warn('⚠️ Error eliminando fila sumavarios existente:', error);
    }
  }

  // Crear nueva fila
  const filaSumario = agregarFilaResumen({
    texto: label,
    clase: 'sum-row-sumavarios',
    cuerpo,
    placeholdersPorFila: estadoModulo.placeholdersPorFila
  });

  if (!filaSumario) {
    console.warn('⚠️ No se pudo crear fila sumavarios');
    return;
  }

  // Inicializar Maps
  if (!estadoModulo.sumas.sumavariosRows) {
    estadoModulo.sumas.sumavariosRows = new Map();
  }

  estadoModulo.sumas.sumavariosRows.set(clave, filaSumario);

  // AJUSTE CORRECTO DE ÍNDICES POST-INSERCIÓN
  const metasAfectadas = [];
  indicesOrdenados.forEach((idx) => {
    // Ajustar solo si el índice está DESPUÉS de insertIdx
    const idxReal = idx >= insertIdx ? idx + 1 : idx;
    
    if (idxReal >= 0 && idxReal < estadoModulo.sumas.secciones.length) {
      const meta = estadoModulo.secciones[idxReal];
      if (meta) {
        metasAfectadas.push(meta);
      }
    }
  });

  // VALIDACIÓN 5: Verificar que tenemos >1 meta
  if (metasAfectadas.length < 2) {
    console.warn('⚠️ Menos de 2 secciones en sumavarios, cancelando');
    estadoModulo.sumas.sumavariosRows.delete(clave);
    filaSumario.remove();
    return;
  }

  // Actualizar metas con sumavarios
  metasAfectadas.forEach((meta) => {
    meta.sumRowSumavariosLabel = label;
    meta.sumRowSumavariosTexto = clave;
  });

  // Insertar fila después de última sección del rango
  const ultimaMeta = metasAfectadas[metasAfectadas.length - 1];
  const referencia = ultimaMeta?.elementos?.sumRow 
    || ultimaMeta?.filasCuenta?.[ultimaMeta.filasCuenta.length - 1]
    || null;

  if (referencia && referencia.parentNode) {
    try {
      referencia.parentNode.insertBefore(filaSumario, referencia.nextSibling);
    } catch (error) {
      console.warn('⚠️ Error insertando fila sumavarios en DOM:', error);
      cuerpo.appendChild(filaSumario);
    }
  } else {
    cuerpo.appendChild(filaSumario);
  }

  console.log(`✅ Sumavarios "${label}" creado para ${metasAfectadas.length} secciones`);
};
```

---

## CORRECCIÓN #4: Mejorar Validación en `recalcularSumas()`

### Ubicación
`vistas/js/cuentas-modulo.js`, líneas 2076-2145

### Problema Actual
```javascript
const recalcularSumas = () => {
  // No valida que meta exista
  // No verifica que filasCuenta sea array
  // No valida que sumRow exista en DOM
};
```

### Código Corregido
```javascript
const recalcularSumas = () => {
  const meta = estadoModulo.sumas;
  
  // VALIDACIÓN 1: Verificar meta y secciones
  if (!meta || !Array.isArray(meta.secciones) || meta.secciones.length === 0) {
    if (!meta.secciones) {
      console.warn('⚠️ recalcularSumas: meta.secciones no existe');
    }
    return;
  }

  const clavesOrdenadas = Object.entries(estadoModulo.columnas || {})
    .sort((a, b) => a[1] - b[1])
    .map(([clave]) => clave)
    .filter((clave) => clave !== 'year');

  const longitud = clavesOrdenadas.length;
  if (!longitud) {
    console.warn('⚠️ recalcularSumas: Sin columnas para calcular');
    return;
  }

  const secciones = meta.secciones;
  const erroresSilenciosos = [];

  // FASE 1: Sumar por sección
  secciones.forEach((seccion, idxSeccion) => {
    try {
      // VALIDACIÓN 2: Verificar estructura
      if (!seccion) {
        erroresSilenciosos.push(`Sección en índice ${idxSeccion} es null/undefined`);
        return;
      }

      if (!Array.isArray(seccion.filasCuenta) || seccion.filasCuenta.length === 0) {
        console.warn(`⚠️ Sección ${seccion.seccion} no tiene filas o filasCuenta no es array`);
        seccion.sumValues = Array(longitud).fill(0);
        return;
      }

      const valores = sumarListas(
        seccion.filasCuenta.map((fila) => {
          if (!fila || !fila.dataset) return Array(longitud).fill(0);
          
          const cuenta = fila.dataset.cuenta21 || '';
          const almacenados = estadoModulo.valoresPorCuenta?.get(cuenta);
          
          if (almacenados) {
            return clavesOrdenadas.map((clave) => almacenados[clave] ?? 0);
          }
          
          return extraerValoresNumericos(fila);
        }),
        longitud
      );

      seccion.sumValues = valores;

      // VALIDACIÓN 3: Verificar sumRow existe
      if (seccion.elementos?.sumRow && seccion.elementos.sumRow.parentNode) {
        asignarValoresNumericos(seccion.elementos.sumRow, valores);
      } else {
        console.warn(`⚠️ Sección ${seccion.seccion}: sumRow no existe en DOM`);
      }
    } catch (error) {
      erroresSilenciosos.push(`Error sumando sección ${idxSeccion}: ${error.message}`);
    }
  });

  if (erroresSilenciosos.length > 0) {
    console.warn('⚠️ Errores durante suma por sección:', erroresSilenciosos);
  }

  // FASE 2: Sumar sum-rows con misma etiqueta (sum-row-sumavarios)
  try {
    const acumuladosSumavarios = new Map();
    secciones.forEach((seccion) => {
      const clave = normalizarClave(seccion.sumRowSumavariosTexto || seccion.sumRowSumavarios2Texto);
      if (!clave) return;

      const prev = acumuladosSumavarios.get(clave) || Array(longitud).fill(0);
      (seccion.sumValues || []).forEach((valor, idx) => {
        prev[idx] += Number(valor) || 0;
      });
      acumuladosSumavarios.set(clave, prev);
    });

    // VALIDACIÓN 4: Asignar a sumavarios rows
    if (meta.sumavariosRows && meta.sumavariosRows instanceof Map) {
      meta.sumavariosRows.forEach((fila, clave) => {
        try {
          if (fila && fila.parentNode) {
            const valores = acumuladosSumavarios.get(clave) || Array(longitud).fill(0);
            asignarValoresNumericos(fila, valores);
          }
        } catch (error) {
          console.warn(`⚠️ Error actualizando sumavarios ${clave}:`, error);
        }
      });
    }
  } catch (error) {
    console.warn('⚠️ Error en suma sumavarios:', error);
  }

  // FASE 3: Sumar sum-rows con misma etiqueta resultado (result-row)
  try {
    const acumuladosResultado = new Map();
    secciones.forEach((seccion) => {
      const clave = normalizarClave(seccion.resultRowTexto);
      if (!clave) return;

      const origen = seccion.sumValues || Array(longitud).fill(0);
      const prev = acumuladosResultado.get(clave) || Array(longitud).fill(0);
      origen.forEach((valor, idx) => {
        prev[idx] += Number(valor) || 0;
      });
      acumuladosResultado.set(clave, prev);
    });

    // VALIDACIÓN 5: Asignar a result rows
    if (meta.resultRows && meta.resultRows instanceof Map) {
      meta.resultRows.forEach((fila, clave) => {
        try {
          if (fila && fila.parentNode) {
            const valores = acumuladosResultado.get(clave) || Array(longitud).fill(0);
            asignarValoresNumericos(fila, valores);
          }
        } catch (error) {
          console.warn(`⚠️ Error actualizando resultado ${clave}:`, error);
        }
      });
    }
  } catch (error) {
    console.warn('⚠️ Error en suma resultado:', error);
  }

  console.log('✅ Sumas recalculadas:', secciones.length, 'secciones');
};
```

---

## CORRECCIÓN #5: Persistencia en SUMMARY y RESUMEN

### Ubicación
`vistas/SUMMARY.html` y `vistas/RESUMEN.html`

### Problema Actual
```html
<!-- No hay inicialización de FlujoAutorizacion -->
<!-- Cambios de cuenta/descripción se registran pero NO se persisten -->
```

### Código Corregido para SUMMARY.html

Agregar antes del cierre `</body>`:

```html
<script>
  // Inicializar flujo de autorización para SUMMARY
  // NOTA: SUMMARY solo permite editar cuenta/descripción
  // Estos cambios se guardan localmente pero NO en Firebird
  
  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      // Obtener cambios de summary-view
      const obtenerCambiosSummary = () => {
        const cambios = window.CuentasModulo?.getCambios?.();
        if (!cambios) return { presupuesto: [], nombres: [] };
        
        // NOTA: summary-view.js solo captura cambios en cambiosPendientes Map
        // Estos se registran pero sin callback de persistencia
        console.log('📝 Cambios en SUMMARY (solo referencia, no guardados en Firebird):', cambios);
        
        return {
          presupuesto: [],  // SUMMARY no modifica datos de presupuesto
          nombres: cambios.nombres || []
        };
      };

      // Inicializar FlujoAutorizacion con callback informativo
      window.flujoAutorizacionActual = window.FlujoAutorizacion?.inicializar?.({
        empresaId: window.Sesion?.empresaActiva?.id,
        modulo: 'summary',
        anio: parseInt(document.getElementById('summaryYearSelect')?.value || new Date().getFullYear()),
        obtenerCambios: obtenerCambiosSummary,
        onEstadoChange: (estado) => {
          console.log('🔄 Estado SUMMARY:', estado);
          
          // ADVERTENCIA: SUMMARY es vista de lectura
          if (estado === 'GUARDADO') {
            console.warn('⚠️ SUMMARY: Cambios en descripción NO se guardaron en Firebird. Solo se almacenan localmente.');
          }
        }
      });

      console.log('✅ SUMMARY: Flujo de autorización inicializado (referencia local)');
    }, 500);
  });
</script>
```

### Código Corregido para RESUMEN.html

Agregar antes del cierre `</body>`:

```html
<script>
  // Inicializar flujo de autorización para RESUMEN
  // NOTA: RESUMEN es vista de lectura pura
  // NO permite ni captura ediciones de datos
  
  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      // RESUMEN no tiene callback de cambios - es solo lectura
      const obtenerCambiosResumen = () => {
        // resumen-view.js solo captura cambios en cambiosPorCuenta Map
        console.log('📝 RESUMEN: Solo lectura, cambios no permitidos');
        return { presupuesto: [], nombres: [] };
      };

      // Inicializar FlujoAutorizacion con callback informativo
      window.flujoAutorizacionActual = window.FlujoAutorizacion?.inicializar?.({
        empresaId: window.Sesion?.empresaActiva?.id,
        modulo: 'resumen',
        anio: parseInt(document.getElementById('resumenYearSelect')?.value || new Date().getFullYear()),
        obtenerCambios: obtenerCambiosResumen,
        onEstadoChange: (estado) => {
          console.log('🔄 Estado RESUMEN:', estado);
          
          if (estado === 'EDITANDO') {
            console.warn('⚠️ RESUMEN: Solo lectura. No se permiten ediciones de datos.');
          }
        }
      });

      console.log('✅ RESUMEN: Flujo de autorización inicializado (modo lectura)');
    }, 500);
  });
</script>
```

---

## CORRECCIÓN #6: Mejorar Visualización de Restricciones en SUMMARY

### Ubicación
`vistas/js/summary-view.js`, línea 438+

### Problema Actual
```javascript
const createEditableCell = (val, options = {}) => {
  const classList = ['editable-cell'];
  // No indica qué celdas son REALMENTE editables
};
```

### Código Corregido

```javascript
const createEditableCell = (val, options = {}) => {
  const {
    columnKey = '',
    tooltipKey = '',
    rowRole = '',
    classes = '',
    text = false
  } = options;

  // Determinar si la columna es REALMENTE editable
  const esEditableReal = columnKey === 'cuenta' || columnKey === 'descripcion' || columnKey === 'nombre';
  
  const classList = ['editable-cell'];
  classList.push(text ? 'text-start' : 'text-end');
  
  // MEJORA: Marcar visualmente si es editable
  if (esEditableReal) {
    classList.push('editable-real');  // Clase CSS nueva
  } else {
    classList.push('read-only-cell');  // Clase CSS nueva
  }
  
  if (classes) classList.push(classes);

  const attrs = [
    `class="${classList.join(' ')}"`,
    `data-valor-original="${text ? escapeAttr(val ?? '') : Number(val ?? 0)}"`,
    `data-editable-real="${esEditableReal}"`  // Atributo para referencia
  ];
  
  if (columnKey) {
    attrs.push(`data-columna-clave="${columnKey}"`);
  }

  // MEJORA: Tooltip indicando si es editable o no
  if (!esEditableReal && tooltipKey) {
    attrs.push(`title="Columna de solo lectura (${columnKey})"`);
    attrs.push(`data-bs-toggle="tooltip"`);
  }

  const content = text ? escapeAttr(val ?? '') : formatNumber(val);
  return `<td ${attrs.join(' ')}${columnTooltipAttr(tooltipKey)}${summaryRowTooltipAttr(rowRole)}>${content}</td>`;
};
```

### Agregar Estilos CSS

En `vistas/css/estilos.css` o `vistas/SUMMARY.html` en `<style>`:

```css
/* Celdas editables reales */
.editable-real {
  background-color: #e8f4f8;
  cursor: text;
  position: relative;
}

.editable-real:hover {
  background-color: #d0e8f0;
  box-shadow: inset 0 0 3px rgba(0, 100, 200, 0.3);
}

.editable-real::before {
  content: '✎';  /* Ícono de edición */
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.8rem;
  color: #0064c8;
  opacity: 0;
  transition: opacity 0.2s;
}

.editable-real:hover::before {
  opacity: 0.7;
}

/* Celdas de solo lectura */
.read-only-cell {
  background-color: #f5f5f5;
  cursor: not-allowed;
  color: #666;
}

.read-only-cell:hover {
  background-color: #eeeeee;
}

.read-only-cell::after {
  content: '🔒';  /* Ícono de candado */
  margin-left: 4px;
  font-size: 0.75rem;
  opacity: 0;
  transition: opacity 0.2s;
}

.read-only-cell:hover::after {
  opacity: 0.5;
}
```

---

## CORRECCIÓN #7: Mejora en `eliminarFilaSeleccionada()`

### Ubicación
`vistas/js/cuentas-modulo.js`, líneas 1881-1927

### Problema Actual
```javascript
const eliminarFilaSeleccionada = (fila) => {
  if ((meta.filasCuenta || []).length <= 1) {
    window.alert('La seccion debe tener al menos una cuenta.');
    return;
  }
  // No limpia sumavarios huérfanas
};
```

### Código Corregido

```javascript
const eliminarFilaSeleccionada = (fila) => {
  if (!fila) return;

  // CASO 1: Eliminar fila de cuenta
  if (fila.classList.contains('fila-cuenta')) {
    const meta = obtenerMetaSeccionPorFila(fila);
    if (!meta) {
      console.warn('⚠️ No se encontró meta de sección');
      return;
    }

    // VALIDACIÓN: Debe tener >1 cuenta
    if ((meta.filasCuenta || []).length <= 1) {
      window.alert('La sección debe tener al menos una cuenta.');
      return;
    }

    const cuenta = fila.dataset.cuenta21 || fila.dataset.cuenta;
    
    // Limpiar Maps
    if (cuenta) {
      estadoModulo.valoresPorCuenta?.delete(cuenta);
      estadoModulo.nombresPorCuenta?.delete(cuenta);
    }

    // Eliminar del DOM
    try {
      fila.remove();
    } catch (error) {
      console.warn('⚠️ Error eliminando fila del DOM:', error);
    }

    // Actualizar meta
    const idx = meta.filasCuenta.indexOf(fila);
    if (idx >= 0) {
      meta.filasCuenta.splice(idx, 1);
    }

    // MEJORA: Después de eliminar última fila de sección, NO limpiar sumavarios aún
    // Solo recalcular sumas
    actualizarEstructuraDespuesCambio();
    console.log(`✅ Fila de cuenta eliminada. Sección ${meta.seccion} ahora tiene ${meta.filasCuenta.length} cuenta(s)`);
    return;
  }

  // CASO 2: Eliminar fila sum-row-sumavarios
  if (fila.classList.contains('sum-row-sumavarios')) {
    const cuerpo = estadoModulo.tabla?.querySelector('tbody');
    if (!cuerpo) return;

    // Encontrar meta asociada
    let metaAux = null;
    let claveAux = '';
    
    // Buscar en secciones cuál usa este sumavarios
    (estadoModulo.sumas.secciones || []).forEach((meta) => {
      if (meta.elementos?.sumRow === fila) {
        metaAux = meta;
        claveAux = normalizarTexto(meta.sumRowSumavariosLabel || meta.sumRowSumavariosTexto);
      }
    });

    if (!claveAux) {
      console.warn('⚠️ No se encontró clave de sumavarios');
      return;
    }

    // Limpiar referencias
    (estadoModulo.sumas.secciones || []).forEach((meta) => {
      if (normalizarTexto(meta.sumRowSumavariosLabel) === claveAux) {
        meta.sumRowSumavariosLabel = '';
        meta.sumRowSumavariosTexto = '';
      }
    });

    estadoModulo.sumas.sumavariosRows?.delete(claveAux);

    try {
      fila.remove();
    } catch (error) {
      console.warn('⚠️ Error eliminando sumavarios del DOM:', error);
    }

    actualizarEstructuraDespuesCambio();
    console.log(`✅ Sumavarios "${claveAux}" eliminado`);
    return;
  }

  console.warn('⚠️ No se reconoce el tipo de fila a eliminar');
};
```

---

## CHECKLIST DE IMPLEMENTACIÓN

- [ ] Corrección #1: Validación en renderizarSecciones()
- [ ] Corrección #2: Validación en crearSeccionDesdeFormulario()
- [ ] Corrección #3: Corregir actualizarSumavariosParaRango()
- [ ] Corrección #4: Mejorar recalcularSumas()
- [ ] Corrección #5: Persistencia en SUMMARY/RESUMEN
- [ ] Corrección #6: Visualización mejorada en SUMMARY
- [ ] Corrección #7: Mejora en eliminarFilaSeleccionada()
- [ ] Pruebas: Inserción de secciones vacías (debe fallar)
- [ ] Pruebas: Edición de columnas no permitidas en SUMMARY (debe rechazarse)
- [ ] Pruebas: Suma de secciones múltiples (debe ser correcta)
- [ ] Pruebas: Eliminación de sección con sumavarios (debe limpiar)
- [ ] Documentación: Actualizar guías de usuario
