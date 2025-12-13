#!/usr/bin/env node
/**
 * Importa el layout 2025 de SUMMARY y RESUMEN hacia SQLite
 * Usa un archivo JSON con las cuentas por capítulo (por ejemplo "RESUMEN CUENTAS 2025.json")
 * y las operaciones desde "CUENTAS SUMMARY y RESUMEN.json".
 *
 * Uso:
 *   node scripts/import-layout-2025.js --cuentas "C:/ruta/RESUMEN CUENTAS 2025.json" --operaciones "info IMPORTANTE/CUENTAS SUMMARY y RESUMEN.json" --empresa EMPRESA01 --anio 2025
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const layoutService = require('../src/services/layoutService');

const ARGS = process.argv.slice(2);
const getArg = (flag, fallback = null) => {
  const idx = ARGS.findIndex((arg) => arg.toLowerCase() === flag.toLowerCase());
  if (idx >= 0 && ARGS[idx + 1]) {
    return ARGS[idx + 1];
  }
  return fallback;
};

const buscarArchivo = (opciones = []) => {
  for (const posible of opciones) {
    if (!posible) continue;
    const normalizado = path.resolve(posible);
    if (fs.existsSync(normalizado)) {
      return normalizado;
    }
  }
  return null;
};

const anioObjetivo = Number(getArg('--anio', '2025'));
const empresaObjetivo = getArg('--empresa', 'EMPRESA01');

const cuentasArchivo = buscarArchivo([
  getArg('--cuentas'),
  path.join(process.cwd(), 'info IMPORTANTE', 'RESUMEN CUENTAS 2025.json'),
  path.join(os.homedir(), 'Downloads', 'RESUMEN CUENTAS 2025.json')
]);

const operacionesArchivo = buscarArchivo([
  getArg('--operaciones'),
  path.join(process.cwd(), 'info IMPORTANTE', 'CUENTAS SUMMARY y RESUMEN.json')
]);

if (!cuentasArchivo) {
  console.error('❌ No se encontró archivo de cuentas (usa --cuentas "ruta").');
  process.exit(1);
}

if (!operacionesArchivo) {
  console.error('❌ No se encontró archivo de operaciones (usa --operaciones "ruta").');
  process.exit(1);
}

const leerJson = (ruta) => JSON.parse(fs.readFileSync(ruta, 'utf8'));

const cuentasData = leerJson(cuentasArchivo);
const operacionesData = leerJson(operacionesArchivo);

const MODULOS = ['SUMMARY', 'RESUMEN'];

const normalizarCuenta = (registro = {}, orden = 0) => {
  const capitulo = (registro.CAPITULO || '').toString().trim() || 'DEFAULT';
  const principal =
    registro['SECCIÓN Principal'] ||
    registro['SECCION Principal'] ||
    registro['SECCIàN Principal'] ||
    registro['SECCIÓN Principal'] ||
    '';
  const secundaria =
    registro['SECCION Secundaria'] ||
    registro['SECCIÓN Secundaria'] ||
    registro['SECCION'] ||
    '';

  return {
    CAPITULO: capitulo,
    CUENTA: (registro.CUENTA || '').toString().trim(),
    NOMBRE: (registro.NOMBRE || '').toString().trim(),
    SECCION: principal,
    'SECCION Secundaria': secundaria,
    orden
  };
};

const agruparPorCapitulo = (lista = []) => {
  const mapa = new Map();
  lista.forEach((registro, index) => {
    const normalizado = normalizarCuenta(registro, index);
    const cap = normalizado.CAPITULO || 'DEFAULT';
    if (!mapa.has(cap)) {
      mapa.set(cap, []);
    }
    mapa.get(cap).push(normalizado);
  });
  return mapa;
};

const operacionesPorModulo = (modulo) => {
  const lista = operacionesData['SUMA DE VARIAS SECCIONES'] || [];
  return lista.filter((op) => (op.HOJA || '').toUpperCase() === modulo.toUpperCase());
};

(async () => {
  try {
    for (const modulo of MODULOS) {
      const listaCuentas = cuentasData[modulo];
      if (!Array.isArray(listaCuentas) || !listaCuentas.length) {
        console.warn(`⚠️ No hay cuentas para ${modulo} en el archivo de entrada.`);
        continue;
      }

      console.log(`\n📦 Importando ${modulo} ${anioObjetivo} (${listaCuentas.length} cuentas)`);
      layoutService.eliminarLayout({
        empresaId: empresaObjetivo,
        modulo,
        anio: anioObjetivo
      });

      const porCapitulo = agruparPorCapitulo(listaCuentas);
      porCapitulo.forEach((cuentas, capitulo) => {
        layoutService.guardarCuentas({
          empresaId: empresaObjetivo,
          modulo,
          anio: anioObjetivo,
          capitulo,
          cuentas
        });
        console.log(`  ├─ ${capitulo}: ${cuentas.length} cuentas`);
      });

      const operaciones = operacionesPorModulo(modulo);
      if (operaciones.length) {
        layoutService.guardarOperaciones({
          empresaId: empresaObjetivo,
          modulo,
          anio: anioObjetivo,
          operaciones
        });
        console.log(`  └─ ${operaciones.length} operaciones registradas`);
      } else {
        console.warn(`  ⚠️ No se encontraron operaciones para ${modulo}`);
      }
    }

    console.log('\n✅ Layouts 2025 importados correctamente en SQLite.');
  } catch (err) {
    console.error('❌ Error importando layouts 2025:', err);
    process.exit(1);
  }
})();
