/**
 * migrar-json-a-sqlite.js
 * Script para migrar layouts desde archivos JSON a SQLite
 * 
 * Uso:
 * node scripts/migrar-json-a-sqlite.js
 */

const path = require('path');
const fs = require('fs');
const layoutService = require('../src/services/layoutService');

// Rutas a los archivos JSON
const BASE_PATH = path.join(__dirname, '../info IMPORTANTE');
const SUMMARY_RESUMEN_2022_2024 = path.join(BASE_PATH, 'CUENTAS SUMMARY y RESUMEN 2022-2024.json');
const SUMMARY_RESUMEN_2025 = path.join(BASE_PATH, 'CUENTAS SUMMARY y RESUMEN 2025.json');
const MODULOS_JSON = path.join(BASE_PATH, 'CUENTAS.json');

/**
 * Cargar y parsear JSON
 */
const cargarJSON = (rutaArchivo) => {
  if (!fs.existsSync(rutaArchivo)) {
    console.warn(`⚠️  Archivo no encontrado: ${rutaArchivo}`);
    return null;
  }
  
  const contenido = fs.readFileSync(rutaArchivo, 'utf-8');
  return JSON.parse(contenido);
};

/**
 * Normalizar nombre de módulo
 */
const normalizarModulo = (nombre) => {
  const mapa = {
    'SUMMARY': 'SUMMARY',
    'RESUMEN': 'RESUMEN',
    'MEMBRESIA': 'Membresía',
    'EVENTOS': 'Eventos',
    'COMUNICACION': 'Comunicación',
    'DIRECCION': 'Dirección',
    'SERV_MEMBRESIA': 'Serv Membresía',
    'COMITES': 'Comités',
    'TIC': 'T&IC',
    'RH': 'RH',
    'VPE': 'VPE',
    'FINANZAS': 'Finanzas',
    'GTOS_CORPORATIVOS': 'Gtos Corporativos',
    'PRESUPUESTOS': 'Presupuestos'
  };
  
  const normalizado = nombre.toString().trim().toUpperCase().replace(/[_\s]+/g, '_');
  return mapa[normalizado] || nombre;
};

/**
 * Migrar SUMMARY y RESUMEN para años específicos
 */
const migrarSummaryResumen = (jsonData, modulo, anios, empresaId = 'EMPRESA01') => {
  if (!jsonData || !jsonData[modulo]) {
    console.log(`⚠️  No hay datos para ${modulo}`);
    return;
  }

  console.log(`\n📦 Migrando ${modulo}...`);

  // Agrupar cuentas por capítulo
  const cuentasPorCapitulo = {};
  jsonData[modulo].forEach(cuenta => {
    const capitulo = cuenta.CAPITULO;
    if (!cuentasPorCapitulo[capitulo]) {
      cuentasPorCapitulo[capitulo] = [];
    }
    cuentasPorCapitulo[capitulo].push(cuenta);
  });

  // Guardar para cada año
  anios.forEach(anio => {
    console.log(`  → Año ${anio}`);
    
    // Guardar cuentas por capítulo
    Object.entries(cuentasPorCapitulo).forEach(([capitulo, cuentas]) => {
      const resultado = layoutService.guardarCuentas({
        empresaId,
        modulo,
        anio,
        capitulo,
        cuentas
      });
      console.log(`    ✓ ${capitulo}: ${resultado.insertadas} cuentas`);
    });

    // Guardar operaciones
    if (jsonData['SUMA DE VARIAS SECCIONES']) {
      const resultado = layoutService.guardarOperaciones({
        empresaId,
        modulo,
        anio,
        operaciones: jsonData['SUMA DE VARIAS SECCIONES']
      });
      console.log(`    ✓ Operaciones: ${resultado.insertadas} configuraciones`);
    }
  });

  // Estadísticas finales
  anios.forEach(anio => {
    const stats = layoutService.obtenerEstadisticasLayout({ empresaId, modulo, anio });
    console.log(`  📊 Estadísticas ${anio}:`, stats);
  });
};

/**
 * Migrar módulos operativos (11 módulos)
 */
const migrarModulosOperativos = (jsonData, empresaId = 'EMPRESA01') => {
  if (!jsonData) {
    console.log('⚠️  No hay datos de módulos operativos');
    return;
  }

  const modulos = [
    'Membresía', 'Eventos', 'Comunicación', 'Dirección',
    'Serv Membresía', 'Comités', 'T&IC', 'RH', 'VPE',
    'Finanzas', 'Gtos Corporativos'
  ];

  // Determinar años disponibles (asumimos 2022-2025)
  const anios = [2022, 2023, 2024, 2025];

  modulos.forEach(modulo => {
    console.log(`\n📦 Migrando ${modulo}...`);
    
    // Buscar clave en JSON (puede variar)
    const claveModulo = Object.keys(jsonData).find(k => 
      k.toLowerCase().replace(/[_\s]+/g, '').includes(modulo.toLowerCase().replace(/[_\s]+/g, ''))
    );

    if (!claveModulo || !jsonData[claveModulo]) {
      console.log(`  ⚠️  No encontrado en JSON`);
      return;
    }

    const cuentas = jsonData[claveModulo];
    
    // Agrupar por capítulo (si existe, sino usar "DEFAULT")
    const cuentasPorCapitulo = {};
    cuentas.forEach(cuenta => {
      const capitulo = cuenta.CAPITULO || 'DEFAULT';
      if (!cuentasPorCapitulo[capitulo]) {
        cuentasPorCapitulo[capitulo] = [];
      }
      cuentasPorCapitulo[capitulo].push(cuenta);
    });

    // Guardar para cada año
    anios.forEach(anio => {
      console.log(`  → Año ${anio}`);
      
      Object.entries(cuentasPorCapitulo).forEach(([capitulo, cuentasCapitulo]) => {
        const resultado = layoutService.guardarCuentas({
          empresaId,
          modulo,
          anio,
          capitulo,
          cuentas: cuentasCapitulo
        });
        console.log(`    ✓ ${capitulo}: ${resultado.insertadas} cuentas`);
      });
    });

    // Estadísticas finales
    const stats = layoutService.obtenerEstadisticasLayout({ empresaId, modulo, anio: 2025 });
    console.log(`  📊 Estadísticas:`, stats);
  });
};

/**
 * Ejecutar migración completa
 */
const ejecutarMigracion = () => {
  console.log('🚀 Iniciando migración de layouts JSON → SQLite\n');
  console.log('='.repeat(60));

  try {
    // 1. Migrar SUMMARY y RESUMEN 2022-2024
    console.log('\n📂 Cargando CUENTAS SUMMARY y RESUMEN 2022-2024.json...');
    const json2022_2024 = cargarJSON(SUMMARY_RESUMEN_2022_2024);
    if (json2022_2024) {
      migrarSummaryResumen(json2022_2024, 'SUMMARY', [2022, 2023, 2024]);
      migrarSummaryResumen(json2022_2024, 'RESUMEN', [2022, 2023, 2024]);
    }

    // 2. Migrar SUMMARY y RESUMEN 2025
    console.log('\n📂 Cargando CUENTAS SUMMARY y RESUMEN 2025.json...');
    const json2025 = cargarJSON(SUMMARY_RESUMEN_2025);
    if (json2025) {
      migrarSummaryResumen(json2025, 'SUMMARY', [2025]);
      migrarSummaryResumen(json2025, 'RESUMEN', [2025]);
    }

    // 3. Migrar módulos operativos
    console.log('\n📂 Cargando CUENTAS.json (11 módulos operativos)...');
    const jsonModulos = cargarJSON(MODULOS_JSON);
    if (jsonModulos) {
      migrarModulosOperativos(jsonModulos);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Migración completada exitosamente\n');

    // Resumen final
    console.log('📊 RESUMEN FINAL:');
    const modulos = ['SUMMARY', 'RESUMEN', 'Membresía', 'Eventos', 'Finanzas'];
    modulos.forEach(modulo => {
      const anios = layoutService.obtenerAniosDisponibles({ modulo });
      if (anios.length > 0) {
        console.log(`  ${modulo}: ${anios.join(', ')}`);
      }
    });

  } catch (error) {
    console.error('\n❌ Error durante la migración:', error);
    console.error(error.stack);
    process.exit(1);
  }
};

// Ejecutar si se llama directamente
if (require.main === module) {
  ejecutarMigracion();
}

module.exports = { ejecutarMigracion };
