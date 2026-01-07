const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Genera un secreto seguro aleatorio
 * @param {number} length - Longitud del secreto en bytes (default: 32)
 * @returns {string} Secreto en formato hexadecimal
 */
const generarSecretoSeguro = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Obtiene o genera secretos seguros para la aplicación
 * Si no existen, los genera y los guarda en un archivo .env.secrets
 * @param {string} appDataPath - Ruta donde guardar los secretos
 * @returns {Object} Objeto con los secretos
 */
const obtenerSecretos = (appDataPath) => {
  const secretsPath = path.join(appDataPath, '.env.secrets');
  
  // Intentar cargar secretos existentes
  if (fs.existsSync(secretsPath)) {
    try {
      const contenido = fs.readFileSync(secretsPath, 'utf-8');
      const secretos = {};
      
      contenido.split('\n').forEach(linea => {
        const [clave, valor] = linea.split('=');
        if (clave && valor) {
          secretos[clave.trim()] = valor.trim();
        }
      });
      
      // Verificar que existan todos los secretos necesarios
      if (secretos.PANELAMCHAM_JWT_SECRET && 
          secretos.SESSION_SECRET && 
          secretos.PANELAMCHAM_REFRESH_SECRET) {
        console.log('✓ Secretos cargados desde:', secretsPath);
        return secretos;
      }
    } catch (err) {
      console.warn('⚠️ Error leyendo secretos existentes:', err.message);
    }
  }
  
  // Generar nuevos secretos
  console.log('🔐 Generando secretos seguros...');
  const secretos = {
    PANELAMCHAM_JWT_SECRET: generarSecretoSeguro(32),
    SESSION_SECRET: generarSecretoSeguro(32),
    PANELAMCHAM_REFRESH_SECRET: generarSecretoSeguro(32)
  };
  
  // Guardar secretos en archivo
  try {
    const contenido = Object.entries(secretos)
      .map(([clave, valor]) => `${clave}=${valor}`)
      .join('\n');
    
    // Asegurar que el directorio existe
    if (!fs.existsSync(appDataPath)) {
      fs.mkdirSync(appDataPath, { recursive: true });
    }
    
    fs.writeFileSync(secretsPath, contenido, { mode: 0o600 });
    console.log('✓ Secretos guardados en:', secretsPath);
  } catch (err) {
    console.error('❌ Error guardando secretos:', err.message);
  }
  
  return secretos;
};

/**
 * Inicializa las variables de entorno con secretos seguros
 * @param {string} appDataPath - Ruta donde guardar/cargar los secretos
 */
const inicializarSecretos = (appDataPath) => {
  const secretos = obtenerSecretos(appDataPath);
  
  // Establecer en process.env solo si no están ya definidos
  Object.entries(secretos).forEach(([clave, valor]) => {
    if (!process.env[clave]) {
      process.env[clave] = valor;
    }
  });
  
  console.log('✓ Secretos inicializados correctamente');
  return secretos;
};

module.exports = {
  generarSecretoSeguro,
  obtenerSecretos,
  inicializarSecretos
};
