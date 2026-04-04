// =====================================================
// CONTROLADOR DE UMAS
// =====================================================

const inventarioService = require('../services/inventarioService');

/**
 * Obtener todas las UMAs
 */
const getAllUmas = async (req, res) => {
  try {
    const umas = await inventarioService.getAllUmas();
    res.json({
      success: true,
      data: umas
    });
  } catch (error) {
    console.error('[Controller] Error obteniendo UMAs:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener UMAs'
    });
  }
};

/**
 * Obtener UMA por año
 */
const getUmaByAnio = async (req, res) => {
  try {
    const { anio } = req.params;
    const anioInt = parseInt(anio, 10);
    if (isNaN(anioInt)) {
      return res.status(400).json({
        success: false,
        message: 'Año inválido'
      });
    }
    const uma = await inventarioService.getUmaByAnio(anioInt);
    if (!uma) {
      return res.status(404).json({
        success: false,
        message: `No se encontró UMA para el año ${anio}`
      });
    }
    res.json({
      success: true,
      data: uma
    });
  } catch (error) {
    console.error('[Controller] Error obteniendo UMA:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener UMA'
    });
  }
};

/**
 * Crear o actualizar UMA
 */
const upsertUma = async (req, res) => {
  try {
    const { anio, valor } = req.body;
    
    if (!anio || !valor) {
      return res.status(400).json({
        success: false,
        message: 'Se requieren año y valor'
      });
    }
    
    const uma = await inventarioService.upsertUma(parseInt(anio, 10), parseFloat(valor));
    
    res.json({
      success: true,
      data: uma,
      message: 'UMA guardada exitosamente'
    });
  } catch (error) {
    console.error('[Controller] Error guardando UMA:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al guardar UMA'
    });
  }
};

/**
 * Calcular clasificación UMA para un item
 */
const calcularClasificacionUma = async (req, res) => {
  try {
    const { costo, anio } = req.query;
    if (!costo || !anio) {
      return res.status(400).json({
        success: false,
        message: 'Se requieren costo y año'
      });
    }
    const anioInt = parseInt(anio, 10);
    if (isNaN(anioInt)) {
      return res.status(400).json({
        success: false,
        message: 'Año inválido'
      });
    }
    const clasificacion = await inventarioService.calcularClasificacionUma(
      parseFloat(costo),
      anioInt
    );
    res.json({
      success: true,
      data: clasificacion
    });
  } catch (error) {
    console.error('[Controller] Error calculando clasificación UMA:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al calcular clasificación UMA'
    });
  }
};

module.exports = {
  getAllUmas,
  getUmaByAnio,
  upsertUma,
  calcularClasificacionUma
};
