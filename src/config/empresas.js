const fs = require('fs');
const path = require('path');
const { obtenerRutaOverride } = require('../services/firebirdConfigService');

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

const EMPRESAS_COMPARATIVAS_META = [
  { id: 'empresa9', nombre: 'Empresa 9', etiqueta: 'Empresa 9 (Comparativa)', numero: 9 },
  { id: 'empresa10', nombre: 'Empresa 10', etiqueta: 'Empresa 10 (Comparativa)', numero: 10 },
  { id: 'empresa11', nombre: 'Empresa 11', etiqueta: 'Empresa 11 (Comparativa)', numero: 11 },
  { id: 'empresa12', nombre: 'Empresa 12', etiqueta: 'Empresa 12 (Comparativa)', numero: 12 }
];

const EMPRESAS_CONFIGURABLES = [...EMPRESAS_META, ...EMPRESAS_COMPARATIVAS_META];

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
  return {
    id: e.id,
    nombre: e.nombre,
    etiqueta: e.etiqueta,
    numero: e.numero,
    rutaBaseDatos: ruta,
  };
});

const EMPRESAS_COMPARATIVAS = new Set([9, 10, 11, 12]);
const EMPRESAS_COMPARATIVAS_RUTAS = {
  9: path.normalize(
    "C:/Program Files (x86)/Common Files/Aspel/Sistemas Aspel/COI10.00/Datos/Empresa9/COI10EMPRE9.FDB"
  ),
  10: path.normalize(
    "C:/Program Files (x86)/Common Files/Aspel/Sistemas Aspel/COI10.00/Datos/Empresa10/COI10EMPRE10.FDB"
  ),
  11: path.normalize(
    "C:/Program Files (x86)/Common Files/Aspel/Sistemas Aspel/COI10.00/Datos/Empresa11/COI10EMPRE11.FDB"
  ),
  12: path.normalize(
    "C:/Program Files (x86)/Common Files/Aspel/Sistemas Aspel/COI10.00/Datos/Empresa12/COI10EMPRE12.FDB"
  ),
};

const resolverRutaComparativa = (numero) => {
  const rutaDirecta = EMPRESAS_COMPARATIVAS_RUTAS[numero];
  if (rutaDirecta) {
    return rutaDirecta;
  }

  let ruta = null;
  for (const carpeta of candidatasCOI) {
    ruta = construirRutaBD(carpeta, numero);
    if (ruta) break;
  }
  if (!ruta) ruta = rutaFallback(numero);
  return ruta;
};

const obtenerEmpresaBasePorId = (id) => {
  const empresa = EMPRESAS.find((item) => item.id === id);
  if (empresa) return empresa;

  const match = (id || '').toString().match(/empresa(\d+)/i);
  if (!match) return undefined;

  const numero = parseInt(match[1], 10);
  if (!EMPRESAS_COMPARATIVAS.has(numero)) return undefined;

  const ruta = resolverRutaComparativa(numero);

  return {
    id: `empresa${numero}`,
    nombre: `Empresa ${numero}`,
    etiqueta: `Empresa ${numero}`,
    numero,
    rutaBaseDatos: ruta || null,
  };
};

const obtenerEmpresaPorId = (id) => {
  const base = obtenerEmpresaBasePorId(id);
  if (!base) return undefined;

  const override = obtenerRutaOverride(base.id);
  if (override) {
    return { ...base, rutaBaseDatos: override };
  }

  return base;
};

module.exports = {
  EMPRESAS,
  EMPRESAS_CONFIGURABLES,
  obtenerEmpresaPorId,
  obtenerEmpresaBasePorId,
};
