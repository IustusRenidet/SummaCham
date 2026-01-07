#!/usr/bin/env node
/**
 * Script de preparación antes de publicar
 * Asegura que better-sqlite3 esté compilado correctamente para Electron
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const binaryPath = path.join(
  projectRoot,
  'node_modules',
  'better-sqlite3',
  'build',
  'Release',
  'better_sqlite3.node'
);

console.log('\n========================================');
console.log('  PREPARACIÓN PARA PUBLICACIÓN');
console.log('========================================\n');

// Verificar que estamos en el directorio correcto
if (!fs.existsSync(path.join(projectRoot, 'package.json'))) {
  console.error('❌ Error: No se encuentra package.json');
  process.exit(1);
}

try {
  // 1. Limpiar compilación anterior
  console.log('🧹 Limpiando compilación anterior...');
  if (fs.existsSync(binaryPath)) {
    fs.unlinkSync(binaryPath);
    console.log('   ✓ Binario anterior eliminado');
  }

  // 2. Recompilar para Electron
  console.log('\n🔨 Recompilando better-sqlite3 para Electron...');
  console.log('   (Esto puede tomar un momento)');
  
  execSync('npx @electron/rebuild -f -v 39.2.7', {
    cwd: projectRoot,
    stdio: 'inherit'
  });
  
  console.log('   ✓ Módulo recompilado para Electron 39.2.7');

  // 3. Verificar que el binario existe
  if (!fs.existsSync(binaryPath)) {
    throw new Error('El binario no fue generado');
  }

  // 4. Guardar versión Electron
  console.log('\n💾 Guardando binario para Electron...');
  execSync('npm run native:save-electron', {
    cwd: projectRoot,
    stdio: 'inherit'
  });

  // 5. Activar versión Electron
  console.log('\n✅ Activando binario Electron...');
  execSync('npm run native:use-electron', {
    cwd: projectRoot,
    stdio: 'inherit'
  });

  console.log('\n========================================');
  console.log('  ✓ PREPARACIÓN COMPLETADA');
  console.log('========================================\n');

} catch (error) {
  console.error('\n❌ Error durante la preparación:');
  console.error(error.message);
  console.error('\n⚠️  La publicación no puede continuar.');
  console.error('   Ejecuta manualmente: npm run rebuild-native\n');
  process.exit(1);
}
