// Quick test for parsing logic used in extraerValoresNumericos
const parseValue = (text) => {
  let texto = (text || '').toString().replace(/[^0-9+.,-]/g, '');
  if (texto.indexOf(',') >= 0 && texto.indexOf('.') >= 0) {
    texto = texto.replace(/,/g, '');
  } else if (texto.indexOf(',') >= 0 && texto.indexOf('.') === -1) {
    texto = texto.replace(/,/g, '.');
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
  '5,385.24', // english thousands, dot decimal
  '5.385,24', // spanish thousands, comma decimal
  '5385.24',  // plain
  '5,385',    // 5385
  '1.234.567,89',
  '1,234,567.89',
  '$ 5,385.24',
  ' 5,385.24 ',
  '-'  ,
  '0'
];

samples.forEach(s => console.log(parseValue(s)));
