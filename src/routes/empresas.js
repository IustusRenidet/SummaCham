const express = require('express');
const { EMPRESAS, obtenerEmpresaPorId } = require('../config/empresas');
const { probarConexion } = require('../services/firebirdService');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ empresas: EMPRESAS });
});

router.get('/:id', (req, res) => {
  const empresa = obtenerEmpresaPorId(req.params.id);
  if (!empresa) {
    return res.status(404).json({ mensaje: 'Empresa no encontrada' });
  }
  res.json({ empresa });
});

router.get('/:id/conexion', async (req, res) => {
  const empresa = obtenerEmpresaPorId(req.params.id);
  if (!empresa) {
    return res.status(404).json({ mensaje: 'Empresa no encontrada' });
  }

  const disponible = await probarConexion(req.params.id);
  res.json({ disponible });
});

module.exports = router;
