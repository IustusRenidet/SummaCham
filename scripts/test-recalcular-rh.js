// Test script for recalcularSumas result-row aggregation
'use strict';

const normalizarClave = (valor) => (valor || '').toString().replace(/[^A-Z0-9]/gi, '').toUpperCase();

function aggregateResultRows(secciones, longitud) {
  const acumulados = new Map();
  secciones.forEach((seccion) => {
    const claveRaw = seccion.resultRowTexto || '';
    const clave = normalizarClave(claveRaw);
    if (!clave) return;
    const origen = seccion.sumValues || Array.from({ length: longitud }, () => 0);
    const factor = Number.isFinite(seccion.factor) ? seccion.factor : 1;
    const prev = acumulados.get(clave) || Array.from({ length: longitud }, () => 0);
    origen.forEach((valor, idx) => {
      prev[idx] += (Number(valor) || 0) * factor;
    });
    acumulados.set(clave, prev);
  });
  return acumulados;
}

function arraysEqual(a,b){
  if (a.length !== b.length) return false;
  for (let i=0;i<a.length;i++) if (a[i] !== b[i]) return false;
  return true;
}

function runTest(){
  const longitud = 3;
  const secciones = [
    { resultRowTexto: 'Resultado RH', sumValues: [100,200,300], factor: 1 },
    { resultRowTexto: 'Resultado RH', sumValues: [50,100,150], factor: -1 }
  ];
  const acumulados = aggregateResultRows(secciones, longitud);
  const clave = 'RESULTADORH';
  const result = acumulados.get(clave);
  console.log('Aggregated for', clave, result);
  const expected = [50,100,150];
  if (!result) {
    console.error('No result found for key', clave);
    process.exit(1);
  }
  if (!arraysEqual(result, expected)){
    console.error('Test FAILED. Expected', expected, 'got', result);
    process.exit(2);
  }
  console.log('Test passed');
}

runTest();
