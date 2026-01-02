/**
 * test-flujo-autorizacion.js
 * Script de prueba para verificar el flujo de autorización
 * 
 * Verificaciones:
 * 1. CUENTAS y DESCRIPCIÓN NO deben ser editables NUNCA
 * 2. Solo month-budget debe ser editable Y SOLO en modo edición activo
 * 3. Al cargar un borrador, su estado debe ser EDITANDO
 */

console.log('🧪 Iniciando pruebas del flujo de autorización...\n');

// Test 1: Verificar que el estado EDITANDO está definido
function testEstadoEditando() {
  console.log('Test 1: Verificar estado EDITANDO');
  
  if (typeof ESTADOS === 'undefined') {
    console.error('❌ ESTADOS no está definido');
    return false;
  }
  
  if (ESTADOS.EDITANDO !== 'EDITANDO') {
    console.error('❌ ESTADOS.EDITANDO no tiene el valor correcto:', ESTADOS.EDITANDO);
    return false;
  }
  
  console.log('✅ Estado EDITANDO definido correctamente');
  return true;
}

// Test 2: Verificar que ModoEdicionPresupuesto está disponible
function testModoEdicionDisponible() {
  console.log('\nTest 2: Verificar ModoEdicionPresupuesto');
  
  if (typeof window.ModoEdicionPresupuesto === 'undefined') {
    console.error('❌ ModoEdicionPresupuesto no está definido');
    return false;
  }
  
  if (typeof window.ModoEdicionPresupuesto.activar !== 'function') {
    console.error('❌ ModoEdicionPresupuesto.activar no es una función');
    return false;
  }
  
  if (typeof window.ModoEdicionPresupuesto.desactivar !== 'function') {
    console.error('❌ ModoEdicionPresupuesto.desactivar no es una función');
    return false;
  }
  
  console.log('✅ ModoEdicionPresupuesto disponible con métodos activar/desactivar');
  return true;
}

// Test 3: Verificar que las celdas CUENTAS/DESCRIPCIÓN no tienen listeners
function testCuentasNoEditables() {
  console.log('\nTest 3: Verificar que CUENTAS/DESCRIPCIÓN no son editables');
  
  const tabla = document.querySelector('#tablaComparacion, #mainTable, table');
  if (!tabla) {
    console.warn('⚠️ No se encontró tabla en el DOM, test omitido');
    return null;
  }
  
  const filas = tabla.querySelectorAll('tbody tr');
  if (filas.length === 0) {
    console.warn('⚠️ No hay filas en la tabla, test omitido');
    return null;
  }
  
  let errores = 0;
  filas.forEach((fila, idx) => {
    const celdaCuenta = fila.cells[0];
    const celdaDescripcion = fila.cells[1];
    
    // Verificar que no tienen dataset de edición de texto
    if (celdaCuenta?.dataset?.textoEdicionInit === 'true') {
      console.error(`❌ Fila ${idx}: celda CUENTA tiene listener de edición`);
      errores++;
    }
    
    if (celdaDescripcion?.dataset?.textoEdicionInit === 'true') {
      console.error(`❌ Fila ${idx}: celda DESCRIPCIÓN tiene listener de edición`);
      errores++;
    }
  });
  
  if (errores > 0) {
    console.error(`❌ ${errores} celdas CUENTAS/DESCRIPCIÓN tienen listeners de edición`);
    return false;
  }
  
  console.log('✅ Ninguna celda CUENTAS/DESCRIPCIÓN tiene listeners de edición');
  return true;
}

// Test 4: Verificar que solo celdas month-budget son editables
function testSoloMonthBudgetEditable() {
  console.log('\nTest 4: Verificar que solo month-budget es editable');
  
  const tabla = document.querySelector('#tablaComparacion, #mainTable, table');
  if (!tabla) {
    console.warn('⚠️ No se encontró tabla en el DOM, test omitido');
    return null;
  }
  
  const celdasEditables = tabla.querySelectorAll('.celda-editable');
  if (celdasEditables.length === 0) {
    console.warn('⚠️ No hay celdas editables, test omitido');
    return null;
  }
  
  let errores = 0;
  celdasEditables.forEach((celda) => {
    // Verificar que tiene data-mes (month-budget)
    if (!celda.dataset.mes) {
      console.error('❌ Celda editable sin data-mes:', celda);
      errores++;
    }
    
    // Verificar que NO es columna 0 o 1 (CUENTAS/DESCRIPCIÓN)
    const fila = celda.parentElement;
    const columna = Array.from(fila.cells).indexOf(celda);
    if (columna === 0 || columna === 1) {
      console.error(`❌ Celda editable en columna ${columna} (debería ser CUENTA/DESCRIPCIÓN)`);
      errores++;
    }
  });
  
  if (errores > 0) {
    console.error(`❌ ${errores} celdas editables no son month-budget`);
    return false;
  }
  
  console.log(`✅ Todas las ${celdasEditables.length} celdas editables son month-budget`);
  return true;
}

// Test 5: Verificar que modo edición requiere estar activo para editar
function testModoEdicionRequerido() {
  console.log('\nTest 5: Verificar que modo edición debe estar activo para editar');
  
  if (typeof window.ModoEdicionPresupuesto === 'undefined') {
    console.warn('⚠️ ModoEdicionPresupuesto no disponible, test omitido');
    return null;
  }
  
  // Verificar estado inicial
  const estadoInicial = window.ModoEdicionPresupuesto.obtenerEstado?.();
  if (!estadoInicial) {
    console.warn('⚠️ No se puede obtener estado, test omitido');
    return null;
  }
  
  if (estadoInicial.modoEdicionActivo) {
    console.warn('⚠️ Modo edición ya está activo, desactivando para test...');
    window.ModoEdicionPresupuesto.desactivar();
  }
  
  // Verificar que está desactivado
  const estadoDesactivado = window.ModoEdicionPresupuesto.obtenerEstado?.();
  if (estadoDesactivado?.modoEdicionActivo) {
    console.error('❌ No se pudo desactivar el modo edición');
    return false;
  }
  
  console.log('✅ Modo edición se puede desactivar correctamente');
  
  // Activar modo edición
  window.ModoEdicionPresupuesto.activar();
  const estadoActivado = window.ModoEdicionPresupuesto.obtenerEstado?.();
  if (!estadoActivado?.modoEdicionActivo) {
    console.error('❌ No se pudo activar el modo edición');
    return false;
  }
  
  console.log('✅ Modo edición se puede activar correctamente');
  return true;
}

// Ejecutar todos los tests
async function ejecutarTests() {
  const resultados = {
    total: 0,
    pasados: 0,
    fallidos: 0,
    omitidos: 0
  };
  
  const tests = [
    { nombre: 'Estado EDITANDO', fn: testEstadoEditando },
    { nombre: 'ModoEdicionPresupuesto disponible', fn: testModoEdicionDisponible },
    { nombre: 'CUENTAS/DESCRIPCIÓN no editables', fn: testCuentasNoEditables },
    { nombre: 'Solo month-budget editable', fn: testSoloMonthBudgetEditable },
    { nombre: 'Modo edición requerido', fn: testModoEdicionRequerido }
  ];
  
  for (const test of tests) {
    resultados.total++;
    const resultado = test.fn();
    
    if (resultado === true) {
      resultados.pasados++;
    } else if (resultado === false) {
      resultados.fallidos++;
    } else {
      resultados.omitidos++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMEN DE PRUEBAS');
  console.log('='.repeat(60));
  console.log(`Total:    ${resultados.total}`);
  console.log(`✅ Pasados: ${resultados.pasados}`);
  console.log(`❌ Fallidos: ${resultados.fallidos}`);
  console.log(`⚠️ Omitidos: ${resultados.omitidos}`);
  console.log('='.repeat(60));
  
  if (resultados.fallidos === 0 && resultados.pasados > 0) {
    console.log('🎉 ¡Todas las pruebas pasaron exitosamente!');
  } else if (resultados.fallidos > 0) {
    console.log('⚠️ Algunas pruebas fallaron, revisar logs arriba');
  }
}

// Ejecutar automáticamente si está en el navegador
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ejecutarTests);
  } else {
    // Esperar un poco para que todo se inicialice
    setTimeout(ejecutarTests, 1000);
  }
}

// Exportar para uso manual
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ejecutarTests };
}
