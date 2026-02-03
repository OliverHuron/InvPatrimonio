import { Router, Request, Response } from 'express';
import { RedisService } from '../services/redis.service';
import { DatabaseService } from '../services/database.service';
import { catchAsync } from '../middleware/error-handler';

const router = Router();

// Get cache statistics
router.get('/stats', catchAsync(async (req: Request, res: Response) => {
    const redisHealth = await RedisService.healthCheck();
    const dbHealth = await DatabaseService.healthCheck();
    
    res.json({
        success: true,
        redis: redisHealth,
        database: dbHealth,
        timestamp: new Date().toISOString()
    });
}));

// Manually invalidate cache patterns
router.delete('/invalidate', catchAsync(async (req: Request, res: Response) => {
    const { pattern, coordinatorId } = req.body;
    
    let deletedKeys = 0;
    
    if (pattern) {
        deletedKeys = await RedisService.del(pattern);
    } else if (coordinatorId) {
        await RedisService.invalidateInventoryCache(coordinatorId);
        deletedKeys = 1;
    } else {
        // Invalidate all inventory related caches
        await RedisService.invalidateSearchCache();
        await RedisService.invalidateGlobalStats();
        deletedKeys = 1;
    }
    
    res.json({
        success: true,
        deletedKeys,
        message: 'Cache invalidated successfully'
    });
}));

// Warm up cache with frequently accessed data
router.post('/warmup', catchAsync(async (req: Request, res: Response) => {
    await RedisService.warmCache();
    
    res.json({
        success: true,
        message: 'Cache warm-up completed'
    });
}));

// Get specific cache key
router.get('/key/:key', catchAsync(async (req: Request, res: Response) => {
    const key = Array.isArray(req.params.key) ? req.params.key[0] : req.params.key;
    const value = await RedisService.get(key);
    
    res.json({
        success: true,
        key,
        value,
        exists: value !== null
    });
}));

// Set cache key (for debugging/testing)
router.post('/key/:key', catchAsync(async (req: Request, res: Response) => {
    const key = Array.isArray(req.params.key) ? req.params.key[0] : req.params.key;
    const { value, ttl } = req.body;
    
    const success = await RedisService.set(key, value, ttl);
    
    res.json({
        success,
        key,
        message: success ? 'Key set successfully' : 'Failed to set key'
    });
}));

export default router;