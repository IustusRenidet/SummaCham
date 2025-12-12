const parseNumber = (text) => {
  let texto = (text || '').toString().replace(/[^0-9+.,-]/g, '');
  const hasComma = texto.indexOf(',') >= 0;
  const hasDot = texto.indexOf('.') >= 0;
  if (hasComma && hasDot) {
    const lastDot = texto.lastIndexOf('.');
    const lastComma = texto.lastIndexOf(',');
    if (lastDot > lastComma) {
      texto = texto.replace(/,/g, '');
    } else {
      texto = texto.replace(/\./g, '');
      texto = texto.replace(/,/g, '.');
    }
  } else if (hasComma && !hasDot) {
    const partes = texto.split(',');
    if (partes.length > 1 && partes[1].length === 3) {
      texto = texto.replace(/,/g, '');
    } else {
      texto = texto.replace(/,/g, '.');
    }
  }
  if ((texto.match(/\./g) || []).length > 1) {
    const partes = texto.split('.');
    const decimal = partes.pop();
    texto = partes.join('') + '.' + decimal;
  }
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : 0;
};

const aggregate = (sections, longitud) => {
  const acumulados = new Map();
  sections.forEach(sec => {
    const clave = (sec.resultRowTexto || '').toString().replace(/[^A-Z0-9]/gi,'').toUpperCase();
    if (!clave) return;
    const parsed = (sec.sumValues || []).map(v => Number.isFinite(Number(v)) ? Number(v) : parseNumber(v));
    const factor = Number.isFinite(sec.factor) ? sec.factor : 1;
    const prev = acumulados.get(clave) || Array.from({ length: longitud }, () => 0);
    parsed.forEach((val, idx) => { prev[idx] += val * factor; });
    acumulados.set(clave, prev);
  });
  return acumulados;
};

const secciones = [
  { resultRowTexto: 'Resultado RH', sumValues: ['100', '5,385.24', '300'], factor: 1 },
  { resultRowTexto: 'Resultado RH', sumValues: ['50', '100', '150'], factor: -1 }
];

const acumulados = aggregate(secciones, 3);
console.log('Aggregated:', acumulados.get('RESULTADORH'));
