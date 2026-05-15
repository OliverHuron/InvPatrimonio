// =====================================================
// SERVICIO DE INVENTARIO — Modo API (UMICH)
// =====================================================

const patrimonioApiService = require('./patrimonioApiService');

const getDataSource = () => 'api';

// =====================================================
// INVENTARIO INTERNO
// =====================================================

const getInventarioInternoById = async (id, umichSessionId = null) =>
  patrimonioApiService.getPatrimoniociById(id, umichSessionId);

const getAllInventariosInternos = async (page = 1, limit = 500, filters = {}, umichSessionId = null) => {
  const codes = filters.ures
    ? String(filters.ures).split(',').map(s => s.trim()).filter(Boolean)
    : [];

  if (codes.length === 0) return { items: [], total: 0, page: 1, pages: 0 };

  const allItems = await patrimonioApiService.getAllPatrimonioByUres(codes, umichSessionId);

  // Filtrado en memoria — UMICH no soporta query params
  // Nota: estado NO se filtra aquí porque viene de SQLite (item_estados), lo aplica el controlador
  const q           = (filters.q          || '').toLowerCase().trim();
  const responsable  = (filters.responsable  || '').trim();
  const resguardante = (filters.resguardante || '').trim();
  const ubicacion    = (filters.ubicacion    || '').trim();
  const ejercicio    = filters.ejercicio ? String(filters.ejercicio).trim() : '';

  let filtered = allItems;

  if (q) {
    filtered = filtered.filter(item => {
      const hay = [
        item.descripcion, item.marca, item.modelo, item.numero_serie,
        item.numero_patrimonio, item.folio, item.usu_asig, item.ubicacion,
        item.id != null ? String(item.id) : null,
        item._raw?.clavePat, item._raw?.folio, item._raw?.persona,
        item._raw?.ubica, item._raw?.serie
      ].filter(Boolean).map(v => String(v).toLowerCase());
      return hay.some(v => v.includes(q));
    });
  }
  if (responsable) {
    filtered = filtered.filter(item =>
      String(item.usu_asig || item._raw?.persona || '').toLowerCase() === responsable.toLowerCase()
    );
  }
  if (resguardante) {
    filtered = filtered.filter(item =>
      String(item.usu_asig || item._raw?.persona || '').toLowerCase() === resguardante.toLowerCase()
    );
  }
  if (ubicacion) {
    filtered = filtered.filter(item =>
      String(item.ubicacion || item._raw?.ubica || '').toLowerCase() === ubicacion.toLowerCase()
    );
  }
  if (ejercicio) {
    filtered = filtered.filter(item =>
      String(item.ejercicio ?? item._raw?.ejercicio ?? '') === ejercicio
    );
  }

  const total  = filtered.length;
  const offset = (page - 1) * limit;
  const items  = filtered.slice(offset, offset + limit);
  return { items, total, page, pages: Math.ceil(total / limit) || 1, limit };
};

const createInventarioInterno = async (data, umichSessionId = null) =>
  patrimonioApiService.createPatrimonioci(data, umichSessionId);

const updateInventarioInterno = async (id, data, umichSessionId = null) =>
  patrimonioApiService.updatePatrimonioci(id, data, umichSessionId);

// =====================================================
// INVENTARIO EXTERNO
// =====================================================

const getInventarioExternoById = async (id, umichSessionId = null) =>
  patrimonioApiService.getPatrimonioById(id, umichSessionId);

const getAllInventariosExternos = async () => ({
  items: [], total: 0, page: 1, pages: 0,
  message: 'Listado no disponible en modo API'
});

const createInventarioExterno = async (data, umichSessionId = null) =>
  patrimonioApiService.createPatrimonio(data, umichSessionId);

const updateInventarioExterno = async (id, data, umichSessionId = null) =>
  patrimonioApiService.updatePatrimonio(id, data, umichSessionId);

// =====================================================
// FOTOS (no disponibles en modo API)
// =====================================================

const getFotosByItem = async () => [];
const addFotoToItem  = async () => { throw new Error('Fotos no disponibles en modo API'); };
const upsertFotoSlot = async () => { throw new Error('Fotos no disponibles en modo API'); };
const deleteFotoByOrden = async () => { throw new Error('Fotos no disponibles en modo API'); };

// =====================================================
// UTILIDADES
// =====================================================

const getDataSourceInfo = () => ({
  mode: 'api',
  description: 'Consumiendo API externa de UMICH',
  features: { listado: false, fotos: false, busqueda: false }
});

module.exports = {
  getInventarioInternoById,
  getAllInventariosInternos,
  createInventarioInterno,
  updateInventarioInterno,
  getInventarioExternoById,
  getAllInventariosExternos,
  createInventarioExterno,
  updateInventarioExterno,
  getFotosByItem,
  addFotoToItem,
  upsertFotoSlot,
  deleteFotoByOrden,
  getDataSourceInfo,
  getDataSource,
};
