// Copy of logic from vistas/js/cuentas-modulo.js extraerValoresNumericos
const parseValue = (text) => {
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
  return { original: text, cleaned: texto, parsed: Number.isFinite(numero) ? numero : 0 };
};

const samples = [
  '5,385.24',
  '5.385,24',
  '5385.24',
  '5,385',
  '1.234.567,89',
  '1,234,567.89',
  '$ 5,385.24',
  ' 5,385.24 ',
  '-',
  '0'
];

samples.forEach(s => console.log(parseValue(s)));
