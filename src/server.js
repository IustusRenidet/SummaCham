const express = require('express');
const helmet = require('helmet');
const path = require('path');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const { inicializarBaseDatos } = require('./db/sqlite');
const rutasAuth = require('./routes/auth');
const rutasUsuarios = require('./routes/usuarios');
const rutasEmpresas = require('./routes/empresas');
const rutasModulos = require('./routes/modulos');
const rutasPresupuestos = require('./routes/presupuestos');
const rutasComites = require('./routes/comitesRoutes');
const rutasPlaneacion = require('./routes/planeacion');
const rutasLayouts = require('./routes/layouts');
const rutasNotificaciones = require('./routes/notificaciones');
const rutasSaldos = require('./routes/saldos');
const rutasCuentas = require('./routes/cuentas');
const rutasReportes = require('./routes/reportes');
const rutasBorradores = require('./routes/borradores');

let instanciaServidor = null;

const iniciarServidor = (puerto = Number(process.env.PORT || 3005)) => {
  if (instanciaServidor) {
    console.log("⚠️ Servidor ya está ejecutándose, retornando instancia existente");
    return instanciaServidor;
  }

  console.log("🚀 Iniciando servidor Express...");
  console.log("  Puerto configurado:", puerto);
  console.log("  NODE_ENV:", process.env.NODE_ENV || 'development');

  inicializarBaseDatos();
  console.log("✓ Base de datos SQLite inicializada");

  const app = express();
  
  // Confiar en proxy reverso (para túneles HTTPS como cloudflare, ngrok, etc.)
  app.set('trust proxy', 1);
  // CORS restringido: permitir orígenes configurados (por defecto localhost y file:// -> null origin)
  const allowedOrigins = (process.env.PANELAMCHAM_ALLOW_ORIGINS || 'http://localhost:3005,https://panelamcham.iconetcloud.com.mx,null,file://')
    .split(',')
    .map((o) => o.trim());
  app.use((req, res, next) => {
    const origin = req.headers.origin || 'null';
    if (allowedOrigins.includes(origin) || (origin === 'null' && allowedOrigins.includes('file://'))) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
    }
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, X-Usuario-Actual, X-Empresa-Activa, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });
  
  app.use(cookieParser());
  
  // Configuración de sesiones para múltiples usuarios simultáneos
  app.use(session({
    secret: process.env.SESSION_SECRET || 'cambia-este-secreto-de-sesion-en-produccion',
    name: 'panelamcham.sid',
    resave: false,
    saveUninitialized: false,
    cookie: {
      // Habilitar secure solo si viene por HTTPS (túnel)
      secure: process.env.NODE_ENV === 'production' ? 'auto' : false,
      httpOnly: true,
      maxAge: 30 * 60 * 1000, // 30 minutos de persistencia
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' permite cookies cross-site en HTTPS
      domain: process.env.COOKIE_DOMAIN || undefined // Para túnel: '.iconetcloud.com.mx'
    },
    // Store en memoria (para producción considera usar connect-sqlite3 o redis)
    // Esto permite múltiples usuarios con sesiones independientes
  }));
  
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));

  // Ruta raíz para servir la interfaz web
  const vistasPath = path.join(__dirname, '..', 'vistas');
  const iconoPath = path.join(__dirname, '..', 'icono');
  
  app.get('/', (req, res) => {
    res.sendFile(path.join(vistasPath, 'app.html'));
  });

  // Servir archivos estáticos de la carpeta vistas (CSS, JS, imágenes, otras vistas HTML)
  app.use(express.static(vistasPath));
  
  // Servir archivos estáticos de la carpeta icono (logos, íconos)
  app.use('/icono', express.static(iconoPath));

  // Info de la API
  app.get('/api', (req, res) => {
    res.json({ 
      aplicacion: 'Panel AMCHAM',
      version: '1.0.1',
      estado: 'activo',
      mensaje: 'API funcionando correctamente',
      endpoints: {
        salud: '/api/salud',
        autenticacion: '/api/auth',
        usuarios: '/api/usuarios',
        empresas: '/api/empresas',
        modulos: '/api/modulos',
        presupuestos: '/api/presupuestos',
        planeacion: '/api/planeacion',
        reportes: '/api/reportes'
      }
    });
  });

  app.get('/api/salud', (req, res) => {
    res.json({ estado: 'ok' });
  });

  app.use('/api/auth', rutasAuth);
  app.use('/api/usuarios', rutasUsuarios);
  app.use('/api/empresas', rutasEmpresas);
  app.use('/api/modulos', rutasModulos);
  app.use('/api/presupuestos', rutasPresupuestos);
  app.use('/api/comites', rutasComites);
  app.use('/api/planeacion', rutasPlaneacion);
  app.use('/api/layouts', rutasLayouts);
  app.use('/api/borradores', rutasBorradores);
  app.use('/api/notificaciones', rutasNotificaciones);
  app.use('/api/reportes', rutasReportes);
  app.use('/api/saldos', rutasSaldos);
  app.use('/api/cuentas', rutasCuentas);

  // 404 para rutas no encontradas
  app.use((req, res) => {
    // Si es una petición a /api/*, devolver JSON
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ mensaje: 'Recurso no encontrado.' });
    }
    // Para otras rutas, redirigir a la raíz (SPA)
    res.redirect('/');
  });

  app.use((error, req, res, next) => { // eslint-disable-line no-unused-vars
    console.error('Error no controlado:', error);
    res.status(500).json({ mensaje: 'Ocurrió un error inesperado.' });
  });

  // Escuchar en 0.0.0.0 para permitir acceso externo vía túnel
  instanciaServidor = app.listen(puerto, '0.0.0.0', () => {
    console.log('✓✓✓ SERVIDOR NODE.JS INICIADO EXITOSAMENTE ✓✓✓');
    console.log(`  → Servidor corriendo en http://localhost:${puerto}`);
    console.log(`  → Acceso local: http://localhost:${puerto}`);
    console.log(`  → Acceso público: https://panelamcham.iconetcloud.com.mx`);
    console.log(`  → Soporta múltiples usuarios simultáneos con sesiones independientes`);
    console.log(`  → Sesiones expiran después de 30 minutos de inactividad`);
    console.log(`  → O abre la app Electron con: npm start`);
  });

  instanciaServidor.on('error', (error) => {
    console.error('❌ Error en el servidor:', error);
    if (error.code === 'EADDRINUSE') {
      console.error(`  ❌ CRÍTICO: El puerto ${puerto} ya está en uso.`);
      console.error(`  → Cierre otras instancias de la aplicación o procesos usando el puerto ${puerto}`);
    }
    throw error;
  });

  return instanciaServidor;
};

module.exports = iniciarServidor;

if (require.main === module) {
  try {
    iniciarServidor();
  } catch (error) {
    console.error('Error al iniciar servidor:', error);
    process.exit(1);
  }
}
