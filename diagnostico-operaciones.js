// Script de diagnóstico para verificar operaciones en el RESUMEN
// Ejecutar en la consola del navegador cuando estés en el Gestor de Plantillas

console.log("=== DIAGNÓSTICO DE OPERACIONES ===");
console.log("Módulo actual:", window.state?.modulo);
console.log("Año actual:", window.state?.anio);
console.log("Capítulo actual:", window.state?.capitulo);
console.log("Empresa ID:", window.state?.empresaId);

console.log("\n=== OPERACIONES CARGADAS ===");
const operaciones = window.state?.operaciones || [];
console.log(`Total operaciones: ${operaciones.length}`);

operaciones.forEach((op, idx) => {
  const opId = op.OperacionId || op.operacion_id || op.id || op.clase || op.Clase || '';
  const label = op.Etiqueta || op.operacion_etiqueta || op.Clase || op.clase || opId;
  const visible = op.visible !== false;
  const hoja = op.HOJA || '';
  const capitulo = op.CAPITULO || '';
  
  console.log(`\n[${idx + 1}] ${label}`);
  console.log(`   ID: ${opId}`);
  console.log(`   Visible: ${visible}`);
  console.log(`   HOJA: ${hoja}`);
  console.log(`   CAPITULO: ${capitulo}`);
  console.log(`   Fórmula: ${op.formula_json || 'Sin fórmula'}`);
});

// Buscar específicamente "EJEMPLO"
const ejemplo = operaciones.find(op => {
  const opId = (op.OperacionId || op.operacion_id || op.id || op.clase || op.Clase || '').toLowerCase();
  const label = (op.Etiqueta || op.operacion_etiqueta || op.Clase || op.clase || '').toLowerCase();
  return opId.includes('ejemplo') || label.includes('ejemplo');
});

if (ejemplo) {
  console.log("\n=== OPERACIÓN 'EJEMPLO' ENCONTRADA ===");
  console.log(JSON.stringify(ejemplo, null, 2));
} else {
  console.log("\n⚠️ OPERACIÓN 'EJEMPLO' NO ENCONTRADA");
}

// Verificar panel lateral
console.log("\n=== PANEL LATERAL ===");
const panel = document.getElementById('operationEditorPanel');
console.log("Panel existe:", !!panel);
console.log("Bootstrap Offcanvas disponible:", !!window.bootstrap?.Offcanvas);

// Verificar modal antiguo
const modalViejo = document.getElementById('modalEditar');
console.log("\n=== MODAL ANTIGUO ===");
console.log("Modal existe:", !!modalViejo);
console.log("Modal visible:", modalViejo?.classList.contains('show'));

console.log("\n=== FIN DIAGNÓSTICO ===");
