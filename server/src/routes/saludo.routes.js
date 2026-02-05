const express = require('express');
const router = express.Router();

// Ruta simple de saludo
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: '¡Hola desde InvPatrimonio API!',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

router.get('/status', (req, res) => {
  res.json({
    success: true,
    message: 'API funcionando correctamente',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  });
});

module.exports = router;