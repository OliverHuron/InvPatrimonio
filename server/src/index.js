const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();

// Trust proxy for production
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Rate limiting — desactivado en desarrollo para no interferir con el trabajo local
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 300,
  message: {
    success: false,
    message: 'Demasiadas solicitudes, intenta de nuevo más tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // En desarrollo no limitamos para no interferir con recargas frecuentes
    if (process.env.NODE_ENV !== 'production') return true;
    if (req.path === '/api/health') return true;
    return false;
  }
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production'
    ? {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'none'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: [],
        }
      }
    : false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    const allowedOrigins = process.env.CLIENT_URL ?
      process.env.CLIENT_URL.split(',').map(url => url.trim()) :
      ['http://localhost:3000', 'http://localhost:5173'];

    console.log('Intento de conexion desde:', origin);
    console.log('Origenes permitidos:', allowedOrigins);

    if (allowedOrigins.indexOf(origin) !== -1) {
      console.log('CORS: Origen aceptado');
      callback(null, true);
    } else {
      console.log('CORS: Origen bloqueado ->', origin);
      console.log('Agrega esta URL exacta a CLIENT_URL en tu .env');
      callback(new Error(`CORS bloqueo el origen: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-UMICH-Session']
};

app.use(cors(corsOptions));
app.use(cookieParser());
app.use(compression({
  filter: (req, res) => {
    // No comprimir SSE — bufferea los eventos y rompe el realtime
    if (req.path && req.path.includes('/stream')) return false;
    if (res.getHeader('Content-Type')?.toString().includes('text/event-stream')) return false;
    return compression.filter(req, res);
  }
}));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use(express.json({ charset: 'utf-8', limit: '10mb' }));
app.use(express.urlencoded({ extended: true, charset: 'utf-8', limit: '10mb' }));

// Serve uploaded files
const path = require('path');
const uploadsPath = path.join(__dirname, '..', 'uploads');
console.log('Serving static files from:', uploadsPath);
app.use('/uploads', express.static(uploadsPath, { 
  maxAge: '1d',
  setHeaders: (res, filepath) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
    console.log('Serving file:', filepath);
  }
}));

// Configuración para UTF-8 - SOLO para rutas de API
app.use('/api', (req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

// Initialize services
const { initializeRedis } = require('./services/redis.service');

// Health check (register before mounting other /api routes to avoid conflicts)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'InvPatrimonio API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Routes
const patrimonioApiRoutes = require('./routes/patrimonioApi.routes'); // API Inventario/Auth
const auditoriaRoutes     = require('./routes/auditoria.routes');     // Auditoría de Campo

// Ruta principal limpia
app.use('/api', patrimonioApiRoutes);
// Compatibilidad temporal con clientes antiguos
app.use('/api/patrimonio-api', patrimonioApiRoutes);

// Auditoría de Campo (rutas públicas + admin)
app.use('/api/auditoria', auditoriaRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada'
  });
});

// Initialize services and start server
async function startServer() {
  try {

    try {
      await initializeRedis();
      console.log('Redis conectado');
    } catch (error) {
      console.log('Redis no disponible, continuando sin cache:', error.message);
    }

    const PORT = process.env.PORT || 5000;

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`InvPatrimonio Server corriendo en puerto ${PORT}`);
      console.log(`Modo: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Cliente URL: ${process.env.CLIENT_URL || 'http://localhost:3000'}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
    });

  } catch (error) {
    console.error('Error al iniciar servidor:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM recibido, cerrando servidor...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT recibido, cerrando servidor...');
  process.exit(0);
});

startServer();

module.exports = app;
