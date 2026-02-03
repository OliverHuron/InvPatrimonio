import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
    const start = Date.now();
    const { method, originalUrl, ip } = req;
    const userAgent = req.get('User-Agent') || '';

    // Log request start
    logger.info('Request started:', {
        method,
        url: originalUrl,
        ip,
        userAgent: userAgent.substring(0, 100) // Truncate user agent
    });

    // Override res.end to capture response time and status
    const originalEnd = res.end;
    res.end = function(this: Response, ...args: any[]) {
        const duration = Date.now() - start;
        const { statusCode } = this;
        
        // Log request completion
        logger.info('Request completed:', {
            method,
            url: originalUrl,
            statusCode,
            duration: `${duration}ms`,
            ip
        });

        // Log slow requests as warnings
        if (duration > 1000) {
            logger.warn('Slow request detected:', {
                method,
                url: originalUrl,
                duration: `${duration}ms`,
                statusCode
            });
        }

        originalEnd.apply(this, args);
    };

    next();
};