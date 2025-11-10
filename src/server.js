const express = require('express');
const helmet = require('helmet');
const { inicializarBaseDatos } = require('./db/sqlite');
const rutasAuth = require('./routes/auth');
const rutasUsuarios = require('./routes/usuarios');
const rutasEmpresas = require('./routes/empresas');
const rutasModulos = require('./routes/modulos');
const rutasPresupuestos = require('./routes/presupuestos');
const rutasComites = require('./routes/comitesRoutes');

let instanciaServidor = null;

const iniciarServidor = (puerto = Number(process.env.PORT || 3000)) => {
  if (instanciaServidor) {
    return instanciaServidor;
  }

  inicializarBaseDatos();

  const app = express();
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
