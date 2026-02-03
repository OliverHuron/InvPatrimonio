import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/database.service';
import { RedisService } from '../services/redis.service';
import { catchAsync, AppErrorClass } from '../middleware/error-handler';
import { body, query, validationResult } from 'express-validator';

const router = Router();

// Keyset pagination interface
interface KeysetQuery {
    coordinacion_id?: number;
    search?: string;
    estado?: string;
    stage?: string;
    cursor?: string;
    limit?: number;
}

// Get inventory with keyset pagination and caching
router.get('/list', [
    query('coordinacion_id').isInt().optional(),
    query('search').isString().optional(),
    query('estado').isString().optional(),
    query('stage').isString().optional(),
    query('cursor').isString().optional(),
    query('limit').isInt({ min: 1, max: 100 }).optional()
], catchAsync(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new AppErrorClass('Invalid query parameters', 400);
    }

    const {
        coordinacion_id,
        search,
        estado,
        stage,
        cursor,
        limit = 20
    }: KeysetQuery = req.query;

    // Generate cache key based on query parameters
    const cacheKey = `inventory:${coordinacion_id || 'all'}:${estado || 'all'}:${stage || 'all'}:${search || 'none'}`;
    const searchHash = Buffer.from(cacheKey).toString('base64');

    // Try to get from cache first
    if (!search) { // Don't cache search results as they're more dynamic
        const cached = await RedisService.getSearchResults(searchHash, Math.floor((cursor ? 1 : 0) + 1));
        if (cached) {
            return res.json({
                success: true,
                data: cached,
                cached: true
            });
        }
    }

    // Build dynamic query
    let baseQuery = `
        SELECT id, numero_patrimonio, numero_serie, descripcion, marca, modelo, 
               costo, estado, stage, created_at, updated_at, version
        FROM inventario 
        WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramIndex = 1;

    if (coordinacion_id) {
        baseQuery += ` AND coordinacion_id = $${paramIndex}`;
        params.push(coordinacion_id);
        paramIndex++;
    }

    if (estado) {
        baseQuery += ` AND estado = $${paramIndex}`;
        params.push(estado);
        paramIndex++;
    }

    if (stage) {
        baseQuery += ` AND stage = $${paramIndex}`;
        params.push(stage);
        paramIndex++;
    }

    if (search) {
        baseQuery += ` AND (
            to_tsvector('spanish', COALESCE(marca,'') || ' ' || COALESCE(modelo,'') || ' ' || COALESCE(descripcion,'')) 
            @@ plainto_tsquery('spanish', $${paramIndex})
            OR numero_patrimonio ILIKE $${paramIndex + 1}
            OR numero_serie ILIKE $${paramIndex + 1}
        )`;
        params.push(search, `%${search}%`);
        paramIndex += 2;
    }

    // Execute keyset pagination query
    const result = await DatabaseService.queryKeyset(
        baseQuery,
        cursor,
        parseInt(limit.toString()),
        params
    );

    // Cache results if not a search query
    if (!search) {
        await RedisService.cacheSearchResults(searchHash, 1, result.data, 120);
    }

    res.json({
        success: true,
        data: result.data,
        pagination: {
            hasNextPage: result.hasNextPage,
            nextCursor: result.nextCursor,
            limit: parseInt(limit.toString())
        },
        cached: false
    });
}));

// Get single inventory item with caching
router.get('/:id', catchAsync(async (req: Request, res: Response) => {
    const itemId = parseInt(req.params.id);
    
    if (isNaN(itemId)) {
        throw new AppErrorClass('Invalid item ID', 400);
    }

    // Try cache first
    let item = await RedisService.getInventoryItem(itemId);
    
    if (!item) {
        // Query from database with joins for complete info
        const result = await DatabaseService.query(`
            SELECT i.*, 
                   c.nombre as coordinacion_nombre,
                   d.nombre as dependencia_nombre,
                   er.nombre_completo as resguardante_nombre
            FROM inventario i
            LEFT JOIN coordinaciones c ON i.coordinacion_id = c.id
            LEFT JOIN dependencias d ON i.dependencia_id = d.id  
            LEFT JOIN empleados er ON i.empleado_resguardante_id = er.id
            WHERE i.id = $1
        `, [itemId]);

        if (result.length === 0) {
            throw new AppErrorClass('Item not found', 404);
        }

        item = result[0];
        
        // Cache for 10 minutes
        await RedisService.cacheInventoryItem(itemId, item, 600);
    }

    res.json({
        success: true,
        data: item,
        cached: !!item
    });
}));

// Update inventory item with optimistic locking
router.patch('/:id', [
    body('version').isInt(),
    body('numero_serie').isString().optional(),
    body('descripcion').isString().optional(),
    body('marca').isString().optional(),
    body('modelo').isString().optional(),
    body('costo').isNumeric().optional(),
    body('estado').isIn(['disponible', 'en_uso', 'mantenimiento', 'baja']).optional(),
    body('empleado_resguardante_id').isInt().optional(),
    body('ubicacion').isString().optional()
], catchAsync(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }

    const itemId = parseInt(req.params.id);
    const { version, ...updates } = req.body;

    if (isNaN(itemId)) {
        throw new AppErrorClass('Invalid item ID', 400);
    }

    // Remove undefined fields
    const cleanUpdates = Object.fromEntries(
        Object.entries(updates).filter(([_, value]) => value !== undefined)
    );

    const result = await DatabaseService.updateWithVersion(
        'inventario',
        itemId,
        version,
        cleanUpdates
    );

    if (!result.success) {
        const statusCode = result.error === 'RECORD_NOT_FOUND' ? 404 : 409;
        return res.status(statusCode).json({
            success: false,
            error: result.error,
            currentVersion: result.newVersion
        });
    }

    // Invalidate related caches
    if (result.data?.coordinacion_id) {
        await RedisService.invalidateInventoryCache(result.data.coordinacion_id);
    }
    await RedisService.del(`item:inventory:${itemId}:*`);

    res.json({
        success: true,
        data: result.data,
        newVersion: result.newVersion
    });
}));

// Bulk insert/update inventory items
router.post('/bulk', [
    body('items').isArray({ min: 1, max: 1000 }),
    body('upsert').isBoolean().optional()
], catchAsync(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new AppErrorClass('Invalid request body', 400);
    }

    const { items, upsert = false } = req.body;

    // Validate each item structure
    const requiredFields = ['numero_patrimonio', 'descripcion', 'coordinacion_id'];
    
    for (const [index, item] of items.entries()) {
        for (const field of requiredFields) {
            if (!item[field]) {
                throw new AppErrorClass(`Item ${index}: ${field} is required`, 400);
            }
        }
    }

    const columns = [
        'numero_patrimonio', 'numero_serie', 'descripcion', 'marca', 'modelo',
        'costo', 'coordinacion_id', 'estado', 'stage', 'version'
    ];

    const data = items.map((item: any) => [
        item.numero_patrimonio,
        item.numero_serie || null,
        item.descripcion,
        item.marca || null,
        item.modelo || null,
        item.costo || 0,
        item.coordinacion_id,
        item.estado || 'disponible',
        item.stage || 'PENDIENTE',
        1 // Initial version
    ]);

    const onConflict = upsert ? `
        ON CONFLICT (numero_patrimonio) 
        DO UPDATE SET 
            numero_serie = EXCLUDED.numero_serie,
            descripcion = EXCLUDED.descripcion,
            marca = EXCLUDED.marca,
            modelo = EXCLUDED.modelo,
            costo = EXCLUDED.costo,
            estado = EXCLUDED.estado,
            updated_at = NOW(),
            version = inventario.version + 1
    ` : '';

    const result = await DatabaseService.bulkInsert('inventario', columns, data, onConflict);

    // Invalidate all inventory caches
    await RedisService.invalidateSearchCache();
    await RedisService.invalidateGlobalStats();

    res.json({
        success: result.success,
        inserted: result.inserted,
        errors: result.errors,
        totalProcessed: items.length
    });
}));

// Get inventory statistics (cached)
router.get('/stats/coordinator/:coordinatorId', catchAsync(async (req: Request, res: Response) => {
    const coordinatorId = parseInt(req.params.coordinatorId);
    
    if (isNaN(coordinatorId)) {
        throw new AppErrorClass('Invalid coordinator ID', 400);
    }

    // Try cache first
    let stats = await RedisService.getCoordinatorStats(coordinatorId);
    
    if (!stats) {
        // Generate stats from materialized view
        stats = await DatabaseService.query(`
            SELECT 
                coordinacion_id,
                SUM(total_items) as total_items,
                SUM(disponibles) as disponibles, 
                SUM(en_uso) as en_uso,
                SUM(mantenimiento) as mantenimiento,
                SUM(baja) as baja,
                SUM(valor_total) as valor_total,
                SUM(completos) as completos,
                SUM(en_transito) as en_transito,
                SUM(pendiente_fiscal) as pendiente_fiscal
            FROM mv_inventario_stats 
            WHERE coordinacion_id = $1
            GROUP BY coordinacion_id
        `, [coordinatorId]);

        stats = stats[0] || {
            coordinacion_id: coordinatorId,
            total_items: 0,
            disponibles: 0,
            en_uso: 0,
            mantenimiento: 0,
            baja: 0,
            valor_total: 0,
            completos: 0,
            en_transito: 0,
            pendiente_fiscal: 0
        };

        // Cache for 5 minutes
        await RedisService.cacheCoordinatorStats(coordinatorId, stats, 300);
    }

    res.json({
        success: true,
        data: stats,
        cached: !!stats
    });
}));

export default router;