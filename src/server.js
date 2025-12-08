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

const iniciarServidor = (puerto = Number(process.env.PORT || 3000)) => {
  if (instanciaServidor) {
    return instanciaServidor;
  }

  inicializarBaseDatos();

  const app = express();
  // CORS restringido: permitir orígenes configurados (por defecto localhost y file:// -> null origin)
  const allowedOrigins = (process.env.PANELAMCHAM_ALLOW_ORIGINS || 'http://localhost:3000,https://panelamcham.iconetcloud.com.mx,null,file://')
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
  
  // Configuración de sesiones
  app.use(session({
    secret: process.env.SESSION_SECRET || 'cambia-este-secreto-de-sesion-en-produccion',
    name: 'panelamcham.sid',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production', // true en HTTPS
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
      sameSite: 'lax'
    }
  }));
  
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));

  // Servir archivos estáticos de la carpeta vistas
  const vistasPath = path.join(__dirname, '..', 'vistas');
  app.use(express.static(vistasPath));

  // Ruta raíz para verificar que el servidor está funcionando
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

  // Ruta para servir app.html en la raíz
  app.get('/', (req, res) => {
    res.sendFile(path.join(vistasPath, 'app.html'));
  });

  app.use((req, res) => {
    res.status(404).json({ mensaje: 'Recurso no encontrado.' });
  });

  app.use((error, req, res, next) => { // eslint-disable-line no-unused-vars
    console.error('Error no controlado:', error);
    res.status(500).json({ mensaje: 'Ocurrió un error inesperado.' });
  });

  instanciaServidor = app.listen(puerto, '127.0.0.1', () => {
    console.log(`API interna escuchando en http://127.0.0.1:${puerto}`);
    console.log(`Túnel público: https://panelamcham.iconetcloud.com.mx`);
  });

  return instanciaServidor;
};

module.exports = iniciarServidor;

if (require.main === module) {
  iniciarServidor();
}
