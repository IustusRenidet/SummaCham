/**
 * env-config.js
 * Carga variables de entorno según NODE_ENV
 * Soporta desarrollo (.env.development) y producción (.env.production)
 */

const fs = require('fs');
const path = require('path');

/**
 * Carga archivo .env y parsea variables
 */
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️ Archivo no encontrado: ${filePath}`);
    return {};
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const vars = {};

    content.split('\n').forEach(line => {
      line = line.trim();
      
      // Ignorar comentarios y líneas vacías
      if (!line || line.startsWith('#')) return;

      // Parsear KEY=VALUE
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        
        // Remover comillas si existen
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        
        vars[key] = value;
      }
    });

    return vars;
  } catch (error) {
    console.error(`❌ Error leyendo ${filePath}:`, error.message);
    return {};
  }
}

/**
 * Configura variables de entorno según modo
 */
function setupEnvironment() {
  // Detectar modo: NODE_ENV tiene prioridad, luego verificamos si estamos empaquetados
  let isPackaged = false;
  try {
    isPackaged = require('electron').app?.isPackaged ?? false;
  } catch (e) {
    // Si falla, asumimos que estamos en desarrollo
    isPackaged = false;
  }
  
  // NODE_ENV tiene prioridad sobre isPackaged
  const isDevelopment = process.env.NODE_ENV === 'development' || (!process.env.NODE_ENV && !isPackaged);

  // Determinar ruta base
  const appPath = isPackaged 
    ? path.dirname(process.execPath)
    : __dirname;

  // Determinar archivo .env a usar
  const envMode = isDevelopment ? 'development' : 'production';
  const envFile = path.join(appPath, `.env.${envMode}`);
  
  console.log(`\n🔧 Configurando entorno: ${envMode.toUpperCase()}`);
  console.log(`📂 Ruta base: ${appPath}`);
  console.log(`📄 Archivo .env: ${envFile}`);

  // Cargar variables
  const envVars = loadEnvFile(envFile);

  // Aplicar variables (no sobrescribir si ya existen)
  Object.entries(envVars).forEach(([key, value]) => {
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });

  // Valores por defecto si no se especificaron
  const defaults = {
    NODE_ENV: envMode,
    FIREBIRD_HOST: '127.0.0.1',
    FIREBIRD_PORT: isDevelopment ? '3050' : '15350',
    FIREBIRD_USER: 'sysdba',
    FIREBIRD_PASSWORD: 'masterkey',
    SERVER_PORT: '3005'
  };

  Object.entries(defaults).forEach(([key, value]) => {
    if (!process.env[key]) {
      process.env[key] = value;
      console.log(`⚙️ Usando valor por defecto: ${key}=${value}`);
    }
  });

  // Log de configuración final
  console.log('\n✅ Variables de entorno configuradas:');
  console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`   FIREBIRD_HOST: ${process.env.FIREBIRD_HOST}`);
  console.log(`   FIREBIRD_PORT: ${process.env.FIREBIRD_PORT}`);
  console.log(`   FIREBIRD_USER: ${process.env.FIREBIRD_USER}`);
  console.log(`   SERVER_PORT: ${process.env.SERVER_PORT}`);
  console.log('');

  return {
    isDevelopment,
    isProduction: !isDevelopment,
    firebird: {
      host: process.env.FIREBIRD_HOST,
      port: Number(process.env.FIREBIRD_PORT),
      user: process.env.FIREBIRD_USER,
      password: process.env.FIREBIRD_PASSWORD
    },
    server: {
      port: Number(process.env.SERVER_PORT)
    }
  };
}

module.exports = { setupEnvironment };
