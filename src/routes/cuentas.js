const express = require('express');

const router = express.Router();

router.get('/catalogo', (_req, res) => {
  res.json({ cuentas: [] });
});

module.exports = router;
