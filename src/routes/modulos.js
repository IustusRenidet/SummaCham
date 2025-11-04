const express = require('express');
const { listarModulos, obtenerDatosModulo } = require('../services/modulosService');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ modulos: listarModulos() });
});

router.get('/:moduloId', (req, res) => {
  const moduloId = (req.params.moduloId || '').toLowerCase();
  const datos = obtenerDatosModulo(moduloId);
  if (!datos) {
    return res.status(404).json({ mensaje: 'Módulo no encontrado.' });
  }
  res.json(datos);
});

module.exports = router;
