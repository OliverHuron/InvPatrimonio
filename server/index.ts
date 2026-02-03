/*
  index.ts (server)
  - High-Performance InvPatrimonio Backend
  - Optimized for enterprise-grade inventory management
  - Features: Redis clustering, optimistic locking, keyset pagination
*/

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Import optimized routes
import saludoRoutes from './src/routes/saludo.routes';
import inventoryRoutes from './src/routes/inventory.routes';
import authRoutes from './src/routes/auth.routes';
import cacheRoutes from './src/routes/cache.routes';

// Import services
import { DatabaseService } from './src/services/database.service';
import { RedisService } from './src/services/redis.service';
import { logger } from './src/utils/logger';
import { errorHandler } from './src/middleware/error-handler';
import { requestLogger } from './src/middleware/request-logger';

// Load environment variables
dotenv.config();

// Create Express application
const app = express();
const PORT = process.env.PORT || 3000;

// Security and performance middlewares
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        }
    }
}));
app.use(compression());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs
    message: 'Too many requests from this IP',
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api', limiter);

// CORS configuration
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Request parsing and logging
// Request parsing and logging
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(requestLogger);

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/inventory', inventoryRoutes);
app.use('/api/v1/cache', cacheRoutes);
app.use('/api', saludoRoutes); // Legacy route

// Global error handler
app.use(errorHandler);

// Initialize services and start server
async function startServer() {
    try {
        // Initialize database connection
        await DatabaseService.initialize();
        logger.info('Database connected successfully');

        // Initialize Redis cluster
        await RedisService.initialize();
        logger.info('Redis cluster connected successfully');

        // Start Express server
        app.listen(PORT, () => {
            logger.info(`🚀 InvPatrimonio Server running on port ${PORT}`);
            logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
            logger.info(`📊 Health check: http://localhost:${PORT}/health`);
        });

    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully...');
    await DatabaseService.disconnect();
    await RedisService.disconnect();
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully...');
    await DatabaseService.disconnect();
    await RedisService.disconnect();
    process.exit(0);
});

startServer();
