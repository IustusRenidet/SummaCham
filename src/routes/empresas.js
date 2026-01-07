const express = require('express');
const { EMPRESAS, obtenerEmpresaPorId } = require('../config/empresas');
const { probarConexion } = require('../services/firebirdService');
const { requireAuth, tienePermisoEmpresa } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', (req, res) => {
  if (req.esAdmin) {
    return res.json({ empresas: EMPRESAS });
  }
  const empresas = EMPRESAS.filter((empresa) =>
    tienePermisoEmpresa(req.mapaPermisos, empresa.id)
  );
  res.json({ empresas });
});

router.get('/:id', (req, res) => {
  const empresa = obtenerEmpresaPorId(req.params.id);
  if (!empresa) {
    return res.status(404).json({ mensaje: 'Empresa no encontrada' });
  }
  if (!req.esAdmin && !tienePermisoEmpresa(req.mapaPermisos, empresa.id)) {
    return res.status(403).json({ mensaje: 'No cuentas con permisos para esta empresa.' });
  }
  res.json({ empresa });
});

router.get('/:id/conexion', async (req, res) => {
  const empresa = obtenerEmpresaPorId(req.params.id);
  if (!empresa) {
    return res.status(404).json({ mensaje: 'Empresa no encontrada' });
  }
  if (!req.esAdmin && !tienePermisoEmpresa(req.mapaPermisos, empresa.id)) {
    return res.status(403).json({ mensaje: 'No cuentas con permisos para esta empresa.' });
  }

  const disponible = await probarConexion(req.params.id);
  res.json({ disponible });
});

module.exports = router;
