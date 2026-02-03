import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { DatabaseService } from '../services/database.service';
import { RedisService } from '../services/redis.service';
import { catchAsync, AppErrorClass } from '../middleware/error-handler';
import { body, validationResult } from 'express-validator';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Login endpoint
router.post('/login', [
    body('email').isEmail(),
    body('password').isLength({ min: 6 })
], catchAsync(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new AppErrorClass('Invalid email or password format', 400);
    }

    const { email, password } = req.body;

    // Get user from database
    const users = await DatabaseService.query(`
        SELECT u.*, c.nombre as coordinacion_nombre, d.nombre as dependencia_nombre
        FROM usuarios u
        LEFT JOIN coordinaciones c ON u.coordinacion_id = c.id
        LEFT JOIN dependencias d ON u.dependencia_id = d.id  
        WHERE u.email = $1 AND u.activo = true
    `, [email]);

    if (users.length === 0) {
        throw new AppErrorClass('Invalid credentials', 401);
    }

    const user = users[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
        throw new AppErrorClass('Invalid credentials', 401);
    }

    // Generate JWT token
    const token = jwt.sign(
        { 
            userId: user.id,
            email: user.email,
            role: user.role,
            coordinacionId: user.coordinacion_id
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );

    // Cache user permissions
    const permissions = {
        role: user.role,
        coordinacionId: user.coordinacion_id,
        dependenciaId: user.dependencia_id,
        canManageInventory: ['admin', 'coordinador'].includes(user.role),
        canViewAllInventory: user.role === 'admin',
        canEditOwnInventory: ['admin', 'coordinador'].includes(user.role)
    };

    await RedisService.cacheUserPermissions(user.id, permissions, 3600); // 1 hour

    // Remove sensitive data
    const { password_hash, ...userResponse } = user;

    res.json({
        success: true,
        token,
        user: userResponse,
        permissions
    });
}));

// Get current user profile
router.get('/profile', authenticateToken, catchAsync(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;

    // Try cache first
    let permissions = await RedisService.getUserPermissions(userId);
    
    if (!permissions) {
        // Get from database
        const users = await DatabaseService.query(`
            SELECT u.*, c.nombre as coordinacion_nombre, d.nombre as dependencia_nombre
            FROM usuarios u
            LEFT JOIN coordinaciones c ON u.coordinacion_id = c.id
            LEFT JOIN dependencias d ON u.dependencia_id = d.id  
            WHERE u.id = $1
        `, [userId]);

        if (users.length === 0) {
            throw new AppErrorClass('User not found', 404);
        }

        const user = users[0];
        const { password_hash, ...userResponse } = user;

        permissions = {
            role: user.role,
            coordinacionId: user.coordinacion_id,
            dependenciaId: user.dependencia_id,
            canManageInventory: ['admin', 'coordinador'].includes(user.role),
            canViewAllInventory: user.role === 'admin',
            canEditOwnInventory: ['admin', 'coordinador'].includes(user.role)
        };

        await RedisService.cacheUserPermissions(userId, permissions, 3600);

        return res.json({
            success: true,
            user: userResponse,
            permissions
        });
    }

    res.json({
        success: true,
        permissions,
        cached: true
    });
}));

// Logout endpoint (invalidate token via blacklist)
router.post('/logout', authenticateToken, catchAsync(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (token) {
        // Add token to blacklist in Redis (expires when token would expire)
        await RedisService.set(`blacklist:${token}`, true, 24 * 60 * 60); // 24 hours
    }

    // Clear user permissions cache
    await RedisService.del(`user:${userId}:permissions`);

    res.json({
        success: true,
        message: 'Logged out successfully'
    });
}));

// Middleware to authenticate JWT tokens
function authenticateToken(req: Request, res: Response, next: any) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Access token required'
        });
    }

    jwt.verify(token, JWT_SECRET, async (err: any, user: any) => {
        if (err) {
            return res.status(403).json({
                success: false,
                message: 'Invalid or expired token'
            });
        }

        // Check if token is blacklisted
        const blacklisted = await RedisService.get(`blacklist:${token}`);
        if (blacklisted) {
            return res.status(403).json({
                success: false,
                message: 'Token has been invalidated'
            });
        }

        (req as any).user = user;
        
        // Set user context for database RLS
        process.env.CURRENT_USER_ID = user.userId.toString();
        
        next();
    });
}

// Export middleware for use in other routes
export { authenticateToken };

export default router;