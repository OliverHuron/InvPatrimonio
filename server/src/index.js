const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Trust proxy for production
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Rate limiting
const limiter = rateLimit({
  windowMs: process.env.RATE_LIMIT_WINDOW_MS || 1 * 60 * 1000,
  max: process.env.RATE_LIMIT_MAX_REQUESTS || 1000000,
  message: {
    success: false,
    message: 'Demasiadas solicitudes, intenta de nuevo más tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req, res) => {
    if (req.path === '/api/health') {
      return true;
    }
    return false;
  }
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
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
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use(express.json({ charset: 'utf-8', limit: '500mb' }));
app.use(express.urlencoded({ extended: true, charset: 'utf-8', limit: '500mb' }));

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
const { initializeDatabase } = require('./config/database');
const { initializeRedis } = require('./services/redis.service');

// Routes
const patrimonioApiRoutes = require('./routes/patrimonioApi.routes'); // API Externa UMICH

app.use('/api/patrimonio-api', patrimonioApiRoutes); // API Externa (nuevo)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'InvPatrimonio API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

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
    await initializeDatabase();
    console.log('Base de datos conectada');

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
