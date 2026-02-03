import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger';

export class DatabaseService {
    private static pool: Pool;
    private static isInitialized = false;

    static async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        try {
            this.pool = new Pool({
                host: process.env.DB_HOST || 'localhost',
                port: parseInt(process.env.DB_PORT || '5432'),
                database: process.env.DB_NAME || 'invpatrimonio',
                user: process.env.DB_USER || 'postgres',
                password: process.env.DB_PASSWORD,
                ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
                
                // Connection pool optimization
                max: parseInt(process.env.DB_POOL_MAX || '20'), // Maximum pool size
                min: parseInt(process.env.DB_POOL_MIN || '5'),  // Minimum pool size
                idleTimeoutMillis: 30000, // 30 seconds
                connectionTimeoutMillis: 10000, // 10 seconds
                
                // Performance settings
                application_name: 'InvPatrimonio',
                statement_timeout: 30000, // 30 seconds
                query_timeout: 30000,
                
                // Connection validation
                allowExitOnIdle: false,
            });

            // Test connection
            const client = await this.pool.connect();
            await client.query('SELECT NOW()');
            client.release();

            // Set up optimized PostgreSQL session settings
            this.pool.on('connect', async (client: PoolClient) => {
                try {
                    await client.query(`
                        SET search_path TO public;
                        SET work_mem TO '256MB';
                        SET effective_cache_size TO '4GB';
                        SET random_page_cost TO 1.1;
                        SET seq_page_cost TO 1.0;
                    `);
                } catch (error) {
                    logger.error('Error setting session parameters:', error);
                }
            });

            this.isInitialized = true;
            logger.info('Database service initialized successfully');

        } catch (error) {
            logger.error('Failed to initialize database service:', error);
            throw error;
        }
    }

    static async query<T = any>(text: string, params?: any[]): Promise<T[]> {
        const start = Date.now();
        const client = await this.pool.connect();
        
        try {
            // Set context for RLS if user provided
            if (process.env.CURRENT_USER_ID) {
                await client.query(`SELECT set_config('app.current_user_id', $1, false)`, [process.env.CURRENT_USER_ID]);
            }

            const result = await client.query(text, params);
            const duration = Date.now() - start;
            
            if (duration > 1000) { // Log slow queries
                logger.warn('Slow query detected', {
                    query: text.substring(0, 100),
                    duration,
                    params: params?.length
                });
            }

            return result.rows;
        } finally {
            client.release();
        }
    }

    // Optimized keyset pagination
    static async queryKeyset<T = any>(
        baseQuery: string,
        cursor?: string,
        limit: number = 20,
        params?: any[]
    ): Promise<{ data: T[]; nextCursor?: string; hasNextPage: boolean }> {
        let query = baseQuery;
        let queryParams = [...(params || [])];

        if (cursor) {
            const [created_at, id] = Buffer.from(cursor, 'base64').toString().split(':');
            query += ` AND (created_at, id) < ($${queryParams.length + 1}, $${queryParams.length + 2})`;
            queryParams.push(created_at, parseInt(id));
        }

        query += ` ORDER BY created_at DESC, id DESC LIMIT $${queryParams.length + 1}`;
        queryParams.push(limit + 1);

        const rows = await this.query<T>(query, queryParams);
        const hasNextPage = rows.length > limit;
        
        if (hasNextPage) {
            rows.pop(); // Remove extra row
        }

        let nextCursor: string | undefined;
        if (hasNextPage && rows.length > 0) {
            const lastRow = rows[rows.length - 1] as any;
            nextCursor = Buffer.from(`${lastRow.created_at}:${lastRow.id}`).toString('base64');
        }

        return {
            data: rows,
            nextCursor,
            hasNextPage
        };
    }

    // Optimistic locking update
    static async updateWithVersion<T = any>(
        table: string,
        id: number,
        expectedVersion: number,
        updates: Record<string, any>
    ): Promise<{ success: boolean; newVersion?: number; error?: string; data?: T }> {
        const client = await this.pool.connect();
        
        try {
            await client.query('BEGIN');

            // Check current version
            const versionCheck = await client.query(
                `SELECT version FROM ${table} WHERE id = $1`,
                [id]
            );

            if (versionCheck.rows.length === 0) {
                await client.query('ROLLBACK');
                return { success: false, error: 'RECORD_NOT_FOUND' };
            }

            const currentVersion = versionCheck.rows[0].version;
            if (currentVersion !== expectedVersion) {
                await client.query('ROLLBACK');
                return { 
                    success: false, 
                    error: 'VERSION_CONFLICT',
                    newVersion: currentVersion
                };
            }

            // Build update query
            const updateFields = Object.keys(updates);
            const setClause = updateFields.map((field, index) => `${field} = $${index + 3}`).join(', ');
            const values = [id, expectedVersion, ...Object.values(updates)];

            const updateQuery = `
                UPDATE ${table} 
                SET ${setClause}, version = version + 1, updated_at = NOW() 
                WHERE id = $1 AND version = $2 
                RETURNING *
            `;

            const result = await client.query(updateQuery, values);
            
            if (result.rows.length === 0) {
                await client.query('ROLLBACK');
                return { success: false, error: 'CONCURRENT_MODIFICATION' };
            }

            await client.query('COMMIT');
            
            return {
                success: true,
                newVersion: result.rows[0].version,
                data: result.rows[0]
            };

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // Bulk insert with validation
    static async bulkInsert<T = any>(
        table: string,
        columns: string[],
        data: any[][],
        onConflict?: string
    ): Promise<{ success: boolean; inserted: number; errors: any[] }> {
        const client = await this.pool.connect();
        
        try {
            await client.query('BEGIN');

            let inserted = 0;
            const errors: any[] = [];
            const batchSize = 1000;

            for (let i = 0; i < data.length; i += batchSize) {
                const batch = data.slice(i, i + batchSize);
                
                try {
                    const placeholders = batch.map((_, rowIndex) => 
                        `(${columns.map((_, colIndex) => 
                            `$${rowIndex * columns.length + colIndex + 1}`
                        ).join(', ')})`
                    ).join(', ');

                    const flatValues = batch.flat();
                    
                    let query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders}`;
                    
                    if (onConflict) {
                        query += ` ${onConflict}`;
                    }

                    const result = await client.query(query, flatValues);
                    inserted += result.rowCount || 0;

                } catch (error) {
                    errors.push({ batch: i / batchSize + 1, error: error instanceof Error ? error.message : String(error) });
                }
            }

            await client.query('COMMIT');
            
            return {
                success: errors.length === 0,
                inserted,
                errors
            };

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    static async getPool(): Promise<Pool> {
        if (!this.isInitialized) {
            await this.initialize();
        }
        return this.pool;
    }

    static async disconnect(): Promise<void> {
        if (this.pool) {
            await this.pool.end();
            this.isInitialized = false;
            logger.info('Database connection pool closed');
        }
    }

    // Health check
    static async healthCheck(): Promise<{ status: string; latency: number; connections: any }> {
        const start = Date.now();
        
        try {
            await this.query('SELECT 1');
            const latency = Date.now() - start;
            
            return {
                status: 'healthy',
                latency,
                connections: {
                    total: this.pool.totalCount,
                    idle: this.pool.idleCount,
                    waiting: this.pool.waitingCount
                }
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                latency: Date.now() - start,
                connections: {
                    total: 0,
                    idle: 0,
                    waiting: 0
                }
            };
        }
    }
}