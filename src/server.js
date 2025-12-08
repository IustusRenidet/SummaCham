const express = require('express');
const helmet = require('helmet');
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
  const allowedOrigins = (process.env.PANELAMCHAM_ALLOW_ORIGINS || 'http://localhost:3000,null,file://')
    .split(',')
    .map((o) => o.trim());
  app.use((req, res, next) => {
    const origin = req.headers.origin || 'null';
    if (allowedOrigins.includes(origin) || (origin === 'null' && allowedOrigins.includes('file://'))) {
      res.header('Access-Control-Allow-Origin', origin);
    }
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, X-Usuario-Actual, X-Empresa-Activa, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));

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

  app.use((req, res) => {
    res.status(404).json({ mensaje: 'Recurso no encontrado.' });
  });

  app.use((error, req, res, next) => { // eslint-disable-line no-unused-vars
    console.error('Error no controlado:', error);
    res.status(500).json({ mensaje: 'Ocurrió un error inesperado.' });
  });

  instanciaServidor = app.listen(puerto, () => {
    console.log(`API interna escuchando en el puerto ${puerto}`);
  });

  return instanciaServidor;
};

module.exports = iniciarServidor;

if (require.main === module) {
  iniciarServidor();
}
