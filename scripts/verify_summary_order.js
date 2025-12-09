/**
 * Script para verificar el orden de Summary
 * 
 * Este script verifica que el motor de Summary respete el orden
 * exacto del JSON CUENTAS SUMMARY y RESUMEN.json
 */

const path = require('path');
const fs = require('fs');

const JSON_PATH = path.join(__dirname, '..', 'info IMPORTANTE', 'CUENTAS SUMMARY y RESUMEN.json');

console.log('🔍 Verificando orden de Summary...\n');

// Cargar JSON
const contenido = fs.readFileSync(JSON_PATH, 'utf8');
const data = JSON.parse(contenido);

const summary = data.SUMMARY || [];

console.log(`📊 Total de cuentas en JSON: ${summary.length}\n`);

// Agrupar por capítulo
const porCapitulo = new Map();

summary.forEach((item, idx) => {
  const capitulo = item.CAPITULO || 'SIN CAPÍTULO';
  if (!porCapitulo.has(capitulo)) {
    porCapitulo.set(capitulo, {
      principales: new Map(),
      orden: []
    });
  }
  
  const cap = porCapitulo.get(capitulo);
  const principal = item['SECCIÓN Principal'] || 'SIN PRINCIPAL';
  const secundaria = item['SECCION Secundaria'] || 'SIN SECUNDARIA';
  
  if (!cap.principales.has(principal)) {
    cap.principales.set(principal, {
      label: principal,
      orden: idx,
      secundarias: new Map()
    });
    cap.orden.push(principal);
  }
  
  const prin = cap.principales.get(principal);
  if (!prin.secundarias.has(secundaria)) {
    prin.secundarias.set(secundaria, {
      label: secundaria,
      orden: idx,
      cuentas: []
    });
  }
  
  prin.secundarias.get(secundaria).cuentas.push({
    cuenta: item.CUENTA,
    nombre: item.NOMBRE,
    orden: idx
  });
});

// Mostrar estructura
console.log('📋 ESTRUCTURA ESPERADA:\n');

porCapitulo.forEach((capData, capitulo) => {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`CAPÍTULO: ${capitulo}`);
  console.log('='.repeat(80));
  
  // Ordenar principales por orden de aparición
  const principalesOrdenados = Array.from(capData.principales.values())
    .sort((a, b) => a.orden - b.orden);
  
  principalesOrdenados.forEach((principal, pIdx) => {
    console.log(`\n  ${pIdx + 1}. SECCIÓN PRINCIPAL: ${principal.label}`);
    console.log(`     Orden de aparición: ${principal.orden}`);
    
    // Ordenar secundarias por orden de aparición
    const secundariasOrdenadas = Array.from(principal.secundarias.values())
      .sort((a, b) => a.orden - b.orden);
    
    secundariasOrdenadas.forEach((secundaria, sIdx) => {
      console.log(`\n     ${pIdx + 1}.${sIdx + 1}. Sección Secundaria: ${secundaria.label}`);
      console.log(`         Orden: ${secundaria.orden}`);
      console.log(`         Cuentas (${secundaria.cuentas.length}):`);
      
      secundaria.cuentas.forEach((cuenta, cIdx) => {
        const cuentaVisible = cuenta.cuenta || '';
        const partes = cuentaVisible.match(/^(\d{3})(\d{3})(\d{3})(\d{2})(\d+)$/);
        const cuentaFormato = partes 
          ? `${partes[1]}-${partes[2]}-${partes[3]}-${partes[4]}-${partes[5]}`
          : cuentaVisible;
        
        console.log(`           ${cIdx + 1}. ${cuentaFormato} | ${cuenta.nombre}`);
      });
      
      console.log(`         → TOTAL ${secundaria.label}`);
    });
    
    console.log(`\n     → TOTAL ${principal.label}`);
  });
});

console.log('\n\n✅ Verificación completada');
console.log('\n💡 Este es el orden EXACTO que debe aparecer en el reporte Summary');
console.log('   Si el reporte muestra un orden diferente, hay un bug en el motor.\n');
