/**
 * Test script to verify modal functionality
 * Run this in the browser console or as a Node test
 */

// Mock setup for testing
const testResults = {
  modalsCreated: 0,
  listenersAttached: 0,
  promisesResolved: 0,
  errors: []
};

// Test 1: Verify _mostrarConfirmacion creates proper DOM
async function testMostrarConfirmacion() {
  console.log('=== TEST 1: _mostrarConfirmacion ===');
  
  // Count modals before
  const modalsBefore = document.querySelectorAll('.modal').length;
  
  // Mock the function call (assuming FlujoAutorizacion instance exists)
  if (!window.__flujoAutorizacionInstance) {
    console.warn('FlujoAutorizacion not initialized');
    return;
  }
  
  const instancia = window.__flujoAutorizacionInstance;
  const promise = instancia._mostrarConfirmacion({
    titulo: 'Test Modal',
    mensaje: 'Test message',
    etiquetaBoton: 'Confirmar'
  });
  
  // Wait for modal to be created
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const modalsAfter = document.querySelectorAll('.modal').length;
  const modal = document.querySelector('.modal-fade[id*="modal-confirmacion"]');
  
  if (modal) {
    testResults.modalsCreated++;
    console.log('✅ Modal created with ID:', modal.id);
    
    // Check for Bootstrap Modal class
    if (modal.classList.contains('fade')) {
      console.log('✅ Modal has fade class');
    }
    
    // Check for close button
    const closeBtn = modal.querySelector('.btn-close');
    if (closeBtn) {
      console.log('✅ Modal has close button (X)');
    }
    
    // Check for confirm button
    const confirmBtn = modal.querySelector('.btn-confirmar-modal');
    if (confirmBtn) {
      console.log('✅ Modal has confirm button');
    }
  } else {
    testResults.errors.push('Modal not created');
  }
  
  // Test cancellation (resolve false)
  const modal_test = document.querySelector('.modal-fade[id*="modal-confirmacion"]');
  if (modal_test) {
    const closeButton = modal_test.querySelector('[data-bs-dismiss="modal"]');
    if (closeButton) closeButton.click();
  }
  
  await new Promise(resolve => setTimeout(resolve, 500));
  console.log('✅ Modal test completed\n');
}

// Test 2: Verify _mostrarEntradaConfirmacion works
async function testMostrarEntradaConfirmacion() {
  console.log('=== TEST 2: _mostrarEntradaConfirmacion ===');
  
  if (!window.__flujoAutorizacionInstance) {
    console.warn('FlujoAutorizacion not initialized');
    return;
  }
  
  const instancia = window.__flujoAutorizacionInstance;
  const promise = instancia._mostrarEntradaConfirmacion({
    titulo: 'Test Input Modal',
    mensaje: 'Enter some text',
    placeholder: 'Type here...',
    etiquetaBoton: 'Confirmar'
  });
  
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const modal = document.querySelector('.modal-fade[id*="modal-entrada"]');
  if (modal) {
    testResults.modalsCreated++;
    console.log('✅ Input modal created');
    
    // Check for textarea
    const textarea = modal.querySelector('textarea');
    if (textarea) {
      console.log('✅ Modal has textarea');
    }
    
    // Check for confirm button
    const confirmBtn = modal.querySelector('.btn-confirmar-entrada');
    if (confirmBtn) {
      console.log('✅ Modal has confirm button');
    }
  } else {
    testResults.errors.push('Input modal not created');
  }
  
  // Test cancellation
  const modal_test = document.querySelector('.modal-fade[id*="modal-entrada"]');
  if (modal_test) {
    const closeButton = modal_test.querySelector('[data-bs-dismiss="modal"]');
    if (closeButton) closeButton.click();
  }
  
  await new Promise(resolve => setTimeout(resolve, 500));
  console.log('✅ Input modal test completed\n');
}

// Test 3: Check button listeners
function testButtonListeners() {
  console.log('=== TEST 3: Button Listeners ===');
  
  const buttons = {
    autorizar: document.getElementById('btnAutorizar'),
    rechazar: document.getElementById('btnRechazar'),
    descartar: document.getElementById('btnDescartarBorrador'),
    guardarCOI: document.getElementById('btnGuardarCOI')
  };
  
  for (const [name, btn] of Object.entries(buttons)) {
    if (btn) {
      const listeners = getEventListeners(btn)?.click || [];
      console.log(`✅ ${name}: ${listeners.length} listener(s)`);
      testResults.listenersAttached++;
    } else {
      console.warn(`❌ ${name}: not found`);
    }
  }
  
  console.log('');
}

// Test 4: Verify workflow toggle
function testWorkflowToggle() {
  console.log('=== TEST 4: Workflow Toggle ===');
  
  const toggleBtn = document.querySelector('.workflow-toggle');
  if (toggleBtn) {
    console.log('✅ Workflow toggle button found');
    const listeners = getEventListeners(toggleBtn)?.click || [];
    console.log(`✅ Workflow toggle has ${listeners.length} listener(s)`);
  } else {
    console.warn('❌ Workflow toggle not found');
  }
  
  console.log('');
}

// Main test runner
async function runAllTests() {
  console.log('\n========================================');
  console.log('   FLUJO AUTORIZACION - COMPREHENSIVE TEST');
  console.log('========================================\n');
  
  try {
    await testMostrarConfirmacion();
    await testMostrarEntradaConfirmacion();
    testButtonListeners();
    testWorkflowToggle();
    
    console.log('\n========================================');
    console.log('   TEST SUMMARY');
    console.log('========================================');
    console.log(`Modals created: ${testResults.modalsCreated}`);
    console.log(`Listeners attached: ${testResults.listenersAttached}`);
    console.log(`Errors: ${testResults.errors.length}`);
    if (testResults.errors.length > 0) {
      console.log('Errors:', testResults.errors);
    }
    console.log('========================================\n');
  } catch (error) {
    console.error('Test runner error:', error);
  }
}

// Run tests if in browser environment
if (typeof window !== 'undefined') {
  console.log('Copy the following command in the browser console:');
  console.log('runAllTests();');
  
  // Auto-run after page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runAllTests);
  } else {
    // Optionally uncomment to auto-run immediately
    // runAllTests();
  }
}
