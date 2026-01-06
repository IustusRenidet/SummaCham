// Verificar si existen layouts para 2022
const fetch = require('node-fetch');

async function checkLayouts() {
  try {
    const response = await fetch('http://localhost:3005/api/layouts/RESUMEN/anios', {
      headers: {
        'Authorization': 'Bearer test'
      }
    });
    
    const data = await response.json();
    console.log('Años disponibles para RESUMEN:', data.anios);
    
    // Verificar si 2022 existe
    if (data.anios && data.anios.includes(2022)) {
      console.log('✅ 2022 está disponible');
      
      // Obtener capítulos de 2022
      const capsRes = await fetch('http://localhost:3005/api/layouts/RESUMEN/2022/capitulos', {
        headers: {
          'Authorization': 'Bearer test'
        }
      });
      const capsData = await capsRes.json();
      console.log('Capítulos en 2022:', capsData.capitulos);
    } else {
      console.log('❌ 2022 NO está disponible');
      console.log('Años encontrados:', data.anios);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkLayouts();
