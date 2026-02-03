import Redis, { Cluster } from 'ioredis';
import { logger } from '../utils/logger';

export class RedisService {
    private static cluster: Cluster;
    private static isInitialized = false;
    private static cacheStats = {
        hits: 0,
        misses: 0,
        sets: 0
    };

    static async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        try {
            const redisNodes = process.env.REDIS_NODES?.split(',') || [
                { host: 'localhost', port: 6379 }
            ];

            this.cluster = new Redis.Cluster(redisNodes, {
                enableReadyCheck: true,
                redisOptions: {
                    password: process.env.REDIS_PASSWORD,
                    maxRetriesPerRequest: 3,
                    lazyConnect: true,
                    keepAlive: 30000,
                },
                scaleReads: 'slave', // Read from slaves for better performance
                maxRedirections: 16,
                retryDelayOnClusterDown: 300,
                clusterRetryStrategy: (times) => {
                    const delay = Math.min(100 + times * 2, 2000);
                    return delay;
                }
            });

            // Connection event handlers
            this.cluster.on('connect', () => {
                logger.info('Redis cluster connected');
            });

            this.cluster.on('error', (error) => {
                logger.error('Redis cluster error:', error);
            });

            this.cluster.on('close', () => {
                logger.warn('Redis cluster connection closed');
            });

            // Test connection
            await this.cluster.ping();
            this.isInitialized = true;
            
            logger.info('Redis service initialized successfully');

        } catch (error) {
            logger.error('Failed to initialize Redis service:', error);
            throw error;
        }
    }

    // Generic cache operations with stats
    static async get<T = any>(key: string): Promise<T | null> {
        try {
            const value = await this.cluster.get(key);
            
            if (value) {
                this.cacheStats.hits++;
                return JSON.parse(value);
            } else {
                this.cacheStats.misses++;
                return null;
            }
        } catch (error) {
            logger.error(`Redis GET error for key ${key}:`, error);
            this.cacheStats.misses++;
            return null;
        }
    }

    static async set(key: string, value: any, ttl?: number): Promise<boolean> {
        try {
            const stringValue = JSON.stringify(value);
            
            if (ttl) {
                await this.cluster.setex(key, ttl, stringValue);
            } else {
                await this.cluster.set(key, stringValue);
            }
            
            this.cacheStats.sets++;
            return true;
        } catch (error) {
            logger.error(`Redis SET error for key ${key}:`, error);
            return false;
        }
    }

    static async del(pattern: string): Promise<number> {
        try {
            const keys = await this.cluster.keys(pattern);
            if (keys.length > 0) {
                return await this.cluster.del(...keys);
            }
            return 0;
        } catch (error) {
            logger.error(`Redis DEL error for pattern ${pattern}:`, error);
            return 0;
        }
    }

    // Specialized cache methods for inventory system
    
    // Cache coordinator statistics
    static async cacheCoordinatorStats(coordinatorId: number, stats: any, ttl: number = 300): Promise<void> {
        const key = `stats:coordinacion:${coordinatorId}:summary`;
        await this.set(key, stats, ttl);
    }

    static async getCoordinatorStats(coordinatorId: number): Promise<any | null> {
        const key = `stats:coordinacion:${coordinatorId}:summary`;
        return await this.get(key);
    }

    // Cache search results
    static async cacheSearchResults(
        searchHash: string, 
        page: number, 
        results: any[], 
        ttl: number = 120
    ): Promise<void> {
        const key = `search:${searchHash}:page:${page}`;
        await this.set(key, results, ttl);
    }

    static async getSearchResults(searchHash: string, page: number): Promise<any[] | null> {
        const key = `search:${searchHash}:page:${page}`;
        return await this.get(key);
    }

    // Cache catalog data (longer TTL)
    static async cacheCatalog(catalogType: string, data: any[], ttl: number = 3600): Promise<void> {
        const key = `catalog:${catalogType}:all`;
        await this.set(key, data, ttl);
    }

    static async getCatalog(catalogType: string): Promise<any[] | null> {
        const key = `catalog:${catalogType}:all`;
        return await this.get(key);
    }

    // Cache individual inventory items
    static async cacheInventoryItem(itemId: number, item: any, ttl: number = 600): Promise<void> {
        const key = `item:inventory:${itemId}:details`;
        await this.set(key, item, ttl);
    }

    static async getInventoryItem(itemId: number): Promise<any | null> {
        const key = `item:inventory:${itemId}:details`;
        return await this.get(key);
    }

    // Cache user permissions
    static async cacheUserPermissions(userId: number, permissions: any, ttl: number = 1800): Promise<void> {
        const key = `user:${userId}:permissions`;
        await this.set(key, permissions, ttl);
    }

    static async getUserPermissions(userId: number): Promise<any | null> {
        const key = `user:${userId}:permissions`;
        return await this.get(key);
    }

    // Invalidate related caches (called from PostgreSQL triggers)
    static async invalidateInventoryCache(coordinatorId: number): Promise<void> {
        const patterns = [
            `stats:coordinacion:${coordinatorId}:*`,
            `inventory:coordinacion:${coordinatorId}:*`,
            `search:*`,
            `stats:global:*`
        ];

        for (const pattern of patterns) {
            await this.del(pattern);
        }

        logger.info(`Cache invalidated for coordinator ${coordinatorId}`);
    }

    static async invalidateSearchCache(): Promise<void> {
        await this.del('search:*');
        logger.info('Search cache invalidated');
    }

    static async invalidateGlobalStats(): Promise<void> {
        await this.del('stats:global:*');
        logger.info('Global stats cache invalidated');
    }

    // Batch operations for efficiency
    static async mget(keys: string[]): Promise<(any | null)[]> {
        try {
            const values = await this.cluster.mget(...keys);
            return values.map(value => value ? JSON.parse(value) : null);
        } catch (error) {
            logger.error('Redis MGET error:', error);
            return keys.map(() => null);
        }
    }

    static async mset(keyValuePairs: Array<{ key: string; value: any; ttl?: number }>): Promise<boolean> {
        try {
            const pipeline = this.cluster.pipeline();
            
            for (const { key, value, ttl } of keyValuePairs) {
                const stringValue = JSON.stringify(value);
                if (ttl) {
                    pipeline.setex(key, ttl, stringValue);
                } else {
                    pipeline.set(key, stringValue);
                }
            }
            
            await pipeline.exec();
            this.cacheStats.sets += keyValuePairs.length;
            return true;
        } catch (error) {
            logger.error('Redis MSET error:', error);
            return false;
        }
    }

    // Cache warming for frequently accessed data
    static async warmCache(): Promise<void> {
        try {
            logger.info('Starting cache warm-up...');
            
            // Warm coordinator catalogs
            // This would be called at server startup or periodic intervals
            
            logger.info('Cache warm-up completed');
        } catch (error) {
            logger.error('Cache warm-up failed:', error);
        }
    }

    // Health check and statistics
    static async healthCheck(): Promise<any> {
        const start = Date.now();
        
        try {
            await this.cluster.ping();
            const latency = Date.now() - start;
            
            const info = await this.cluster.info();
            const memory = info.split('\n').find(line => line.startsWith('used_memory_human:'));
            
            return {
                status: 'healthy',
                latency,
                memory: memory?.split(':')[1]?.trim(),
                nodes: this.cluster.nodes().length,
                stats: this.getCacheStats()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error instanceof Error ? error.message : String(error),
                latency: Date.now() - start,
                stats: this.getCacheStats()
            };
        }
    }

    static getCacheStats(): any {
        const total = this.cacheStats.hits + this.cacheStats.misses;
        return {
            ...this.cacheStats,
            total: total,
            hitRate: total > 0 ? (this.cacheStats.hits / total * 100).toFixed(2) + '%' : '0%'
        };
    }

    static resetStats(): void {
        this.cacheStats = { hits: 0, misses: 0, sets: 0 };
    }

    static async disconnect(): Promise<void> {
        if (this.cluster) {
            await this.cluster.quit();
            this.isInitialized = false;
            logger.info('Redis cluster disconnected');
        }
    }
}