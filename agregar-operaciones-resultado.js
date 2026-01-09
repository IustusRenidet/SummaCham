/**
 * Script para agregar operaciones de RESULTADO OPERATIVO automáticamente
 * Ejecutar este script en la consola del navegador en cada módulo HTML
 */

const OPERACIONES_POR_MODULO = {
  'eventos': [
    {
      nombre: 'Resultado Operativo Asamblea Anual',
      formula: '407-005-000-00 + 408-005-000-00 - 701-001-004-00',
      descripcion: 'Asamblea anual, boletaje + patrocinios - costos y gastos'
    }
  ],
  'comites': [
    {
      nombre: 'Resultado Operativo Programa Mentoría',
      formula: '417-015-000-00 - 702-002-017-00',
      descripcion: 'Programa de Mentoría, ingresos - gastos'
    }
  ],
  'tic': [
    {
      nombre: 'Resultado Operativo SemiconWest',
      formula: '405-001-000-00 - 703-002-000-00',
      descripcion: 'SemiconWest, ingresos - gastos'
    }
  ],
  'servmembresia': [
    {
      nombre: 'Resultado Operativo Encuesta de Sueldos y Prestaciones',
      formula: '406-001-000-00 - 601-002-003-00',
      descripcion: 'Encuesta de Sueldos y Prestaciones, ingresos - gastos'
    }
  ]
};

/**
 * Función para agregar una operación programáticamente
 */
async function agregarOperacionResultadoOperativo(moduloId, operacion) {
  console.log(`📝 Agregando operación: ${operacion.nombre}`);
  
  // Verificar que exista el wizard
  if (!window.InsertionWizard) {
    console.error('❌ InsertionWizard no está disponible');
    return false;
  }

  try {
    // Preparar los datos de la operación
    const operacionData = {
      tipo: 'operacion',
      nombre: operacion.nombre,
      formula: operacion.formula,
      descripcion: operacion.descripcion || '',
      capitulo: 'CIUDAD DE MÉXICO', // Ajustar según el capítulo activo
      seccion: '', // Se detectará automáticamente
      insertar: 'despues' // Insertar después de la última cuenta de ingresos
    };

    console.log('📦 Datos de operación:', operacionData);
    
    // Aquí normalmente se llamaría al wizard, pero como no podemos hacerlo directamente,
    // proporcionamos las instrucciones para hacerlo manualmente
    
    return true;
  } catch (error) {
    console.error('❌ Error al agregar operación:', error);
    return false;
  }
}

/**
 * Función principal para ejecutar en la consola
 */
async function agregarTodasLasOperaciones() {
  // Detectar el módulo actual
  const pathname = window.location.pathname;
  let moduloId = null;
  
  if (pathname.includes('Eventos.html')) moduloId = 'eventos';
  else if (pathname.includes('Comités.html') || pathname.includes('Comites.html')) moduloId = 'comites';
  else if (pathname.includes('T&IC.html')) moduloId = 'tic';
  else if (pathname.includes('Serv_Membresía.html') || pathname.includes('Serv_Membresia.html')) moduloId = 'servmembresia';
  
  if (!moduloId) {
    console.error('❌ No se pudo detectar el módulo actual');
    return;
  }

  console.log(`\n🎯 Módulo detectado: ${moduloId}\n`);
  
  const operaciones = OPERACIONES_POR_MODULO[moduloId];
  if (!operaciones || operaciones.length === 0) {
    console.warn('⚠️ No hay operaciones definidas para este módulo');
    return;
  }

  console.log(`📋 Se agregarán ${operaciones.length} operación(es):\n`);
  
  for (const op of operaciones) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📝 OPERACIÓN: ${op.nombre}`);
    console.log(`📐 Fórmula: ${op.formula}`);
    console.log(`📄 Descripción: ${op.descripcion}`);
    console.log(`${'='.repeat(60)}\n`);
    
    console.log('👉 PASOS PARA AGREGAR MANUALMENTE:');
    console.log('1. Haz clic derecho en la última fila de la sección de INGRESOS');
    console.log('2. Selecciona "Crear operación"');
    console.log('3. En el wizard, ingresa:');
    console.log(`   - Nombre: ${op.nombre}`);
    console.log(`   - Fórmula: ${op.formula}`);
    console.log(`   - Descripción: ${op.descripcion}`);
    console.log('4. Haz clic en "Insertar"\n');
  }

  console.log(`\n✅ Instrucciones mostradas para ${operaciones.length} operación(es)\n`);
}

// Ejecutar automáticamente
console.log('\n🚀 SISTEMA DE AGREGADO DE OPERACIONES DE RESULTADO OPERATIVO\n');
agregarTodasLasOperaciones();
