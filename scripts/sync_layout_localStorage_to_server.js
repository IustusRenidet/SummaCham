/**
 * Script para sincronizar layouts desde localStorage (Electron) al servidor
 * Uso: node scripts/sync_layout_localStorage_to_server.js
 */

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n📋 SINCRONIZAR LAYOUT DE LOCALSTORAGE AL SERVIDOR\n');
console.log('Este script te ayudará a copiar el layout guardado en Electron al servidor.');
console.log('\nPasos:');
console.log('1. Abre Electron (donde ves el cambio correcto)');
console.log('2. Abre DevTools (Ctrl+Shift+I)');
console.log('3. Ve a la pestaña Console');
console.log('4. Ejecuta este comando para ver los layouts guardados:');
console.log('   Object.keys(localStorage).filter(k => k.startsWith("layout_")).forEach(k => console.log(k, localStorage.getItem(k).length, "bytes"))');
console.log('\n5. Copia el layout específico que necesitas:');
console.log('   console.log(localStorage.getItem("layout_finanzas_empresa1_2025"))');
console.log('\n6. Copia el JSON completo y pégalo aquí.\n');

rl.question('Pega el JSON del layout aquí (o presiona Ctrl+C para cancelar):\n', (jsonStr) => {
  try {
    const layout = JSON.parse(jsonStr);
    console.log('\n✅ JSON válido parseado');
    console.log(`📊 Contiene ${layout.filas?.length || 0} filas`);
    
    rl.question('\n¿Confirmar datos del layout?\nEmpresa ID (ejemplo: empresa1): ', (empresaId) => {
      rl.question('Módulo (ejemplo: finanzas): ', (modulo) => {
        rl.question('Año (ejemplo: 2025): ', (anio) => {
          
          const datos = {
            empresaId: empresaId.trim(),
            modulo: modulo.trim(),
            anio: parseInt(anio.trim()),
            datos: layout
          };

          console.log('\n📤 Enviando al servidor...');
          console.log(JSON.stringify(datos, null, 2));

          fetch('http://localhost:3005/api/layouts', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(datos)
          })
          .then(res => {
            if (!res.ok) {
              return res.json().then(data => {
                throw new Error(data.mensaje || `HTTP ${res.status}`);
              });
            }
            return res.json();
          })
          .then(data => {
            console.log('\n✅ Layout guardado exitosamente en el servidor');
            console.log(data);
            console.log('\n🔄 Ahora recarga localhost:3005 en el navegador (Ctrl+Shift+R)');
            rl.close();
            process.exit(0);
          })
          .catch(err => {
            console.error('\n❌ Error al guardar layout:', err.message);
            rl.close();
            process.exit(1);
          });
        });
      });
    });
    
  } catch (err) {
    console.error('\n❌ Error: El JSON no es válido');
    console.error(err.message);
    rl.close();
    process.exit(1);
  }
});
