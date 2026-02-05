const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryControllerOptimized');

// =====================================================
// RUTAS OPTIMIZADAS DE INVENTARIO CON IMÁGENES
// =====================================================

// Obtener todos los inventarios (con paginación optimizada)
router.get('/', inventoryController.getAllInventarios);

// Búsqueda de texto completo optimizada
router.get('/search', inventoryController.searchInventarios);

// Estadísticas del dashboard
router.get('/stats', inventoryController.getDashboardStats);

// Obtener marcas únicas para filtros
router.get('/marcas', inventoryController.getAvailableMarcas);

// Obtener ubicaciones únicas para filtros  
router.get('/ubicaciones', inventoryController.getAvailableUbicaciones);

// Verificar duplicados
router.get('/check-duplicate/:field/:value', inventoryController.checkDuplicate);

// Obtener un inventario específico (DEBE IR AL FINAL)
router.get('/:id', inventoryController.getInventarioById);

// Crear nuevo inventario con imágenes
router.post('/', 
  inventoryController.handleImageUpload,
  inventoryController.createInventario
);

// Actualizar inventario con imágenes
router.put('/:id', 
  inventoryController.handleImageUpload,
  inventoryController.updateInventario
);

// Eliminar inventario (soft delete)
router.delete('/:id', inventoryController.deleteInventario);

module.exports = router;