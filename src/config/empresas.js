const fs = require('fs');
const path = require('path');

// Base por defecto (puede sobreescribirse con ASPEL_COI_BASE)
const ASPEL_BASE = process.env.ASPEL_COI_BASE || 'C:/Program Files (x86)/Common Files/Aspel/Sistemas Aspel';

// Lista carpetas COIXX.xx ordenadas por versión descendente (COI11.00 > COI10.00 > COI09.00)
function listarCarpetasCOI(baseDir = ASPEL_BASE) {
  try {
    const hijos = fs.readdirSync(baseDir, { withFileTypes: true });
    return hijos
      .filter((d) => d.isDirectory() && /^COI\d{2}\.\d{2}$/i.test(d.name))
      .map((d) => {
        const m = d.name.match(/^COI(\d{2})\.(\d{2})$/i);
        const major = parseInt(m[1], 10);
        const minor = parseInt(m[2], 10);
        return { name: d.name, major, minor };
      })
      .sort((a, b) => (b.major - a.major) || (b.minor - a.minor));
  } catch (_) {
    return [];
  }
}

// Intenta construir la ruta de BD para una empresa N usando la carpeta COI detectada
function construirRutaBD({ major, name }, empresaNumero) {
  // Ej: .../COI12.00/Datos/Empresa1/COI12EMPRE1.FDB
  const dirEmpresa = path.join(ASPEL_BASE, name, 'Datos', `Empresa${empresaNumero}`);
  const archivo = `COI${String(major)}EMPRE${empresaNumero}.FDB`;
  const ruta = path.join(dirEmpresa, archivo);
  return fs.existsSync(ruta) ? ruta : null;
}

// Fallback a COI10.00 si no se detecta una superior/disponible
function rutaFallback(empresaNumero) {
  const base = path.join(ASPEL_BASE, 'COI10.00', 'Datos', `Empresa${empresaNumero}`);
  const archivo = `COI10EMPRE${empresaNumero}.FDB`;
  const ruta = path.join(base, archivo);
  return fs.existsSync(ruta) ? ruta : null;
}

// Catálogo centralizado de empresas y sus respectivas bases de datos Firebird
const EMPRESAS_META = [
  { id: 'empresa1', nombre: 'Ciudad de México', etiqueta: 'Ciudad de México', numero: 1 },
  { id: 'empresa2', nombre: 'Guadalajara', etiqueta: 'Guadalajara', numero: 2 },
  { id: 'empresa3', nombre: 'Noreste', etiqueta: 'Noreste', numero: 3 },
  { id: 'empresa4', nombre: 'Noroeste', etiqueta: 'Noroeste', numero: 4 }
];

// Determinar rutas dinámicamente por empresa: elegir la carpeta COI de mayor versión que tenga el .FDB
const candidatasCOI = listarCarpetasCOI();
const EMPRESAS = EMPRESAS_META.map((e) => {
  let ruta = null;
  for (const carpeta of candidatasCOI) {
    ruta = construirRutaBD(carpeta, e.numero);
    if (ruta) break; // tomar la más alta que exista
  }
  // Si no hubo ninguna, intentar fallback COI10.00 solo si existe
  if (!ruta) ruta = rutaFallback(e.numero);
  return { id: e.id, nombre: e.nombre, etiqueta: e.etiqueta, rutaBaseDatos: ruta };
});

const obtenerEmpresaPorId = (id) => EMPRESAS.find((empresa) => empresa.id === id);

module.exports = { EMPRESAS, obtenerEmpresaPorId };
