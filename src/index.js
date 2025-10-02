/**
 * Solana Program Deployer Service
 * Main Express server entry point
 */

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');
const { errorMiddleware } = require('./utils/errorHandler');
const { PORT, RATE_LIMIT_PER_IP, RATE_LIMIT_WINDOW_MS } = require('./config/constants');
const deployRouter = require('./routes/deploy');
const { cleanupOldDirectories } = require('./services/projectManager');
const { verifyEnvironment, getEnvironmentInfo } = require('./services/setupEnvironment');

// Create Express app
const app = express();

// Security middleware
app.use(helmet());

// CORS middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_PER_IP,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP, please try again later'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/deploy', limiter);

// Request logging middleware
app.use((req, res, next) => {
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// Routes
app.get('/', (req, res) => {
  res.json({
    service: 'Solana Program Deployer',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      deploy: 'POST /deploy',
      health: 'GET /deploy/health',
      status: 'GET /deploy/status/:deploymentId'
    }
  });
});

app.use('/deploy', deployRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found'
    }
  });
});

// Error handling middleware (must be last)
app.use(errorMiddleware);

/**
 * Initialize server
 */
async function initialize() {
  try {
    logger.info('Initializing Solana Program Deployer Service...');
    
    // Get environment information
    const envInfo = await getEnvironmentInfo();
    logger.info('Environment information', envInfo);
    
    // Check if all required tools are installed
    const allInstalled = envInfo.rust.installed && 
                        envInfo.solanaCLI.installed && 
                        envInfo.anchorCLI.installed;
    
    if (!allInstalled) {
      logger.warn('Some required tools are not installed', envInfo);
      logger.warn('The service will attempt to install them on first use');
      logger.warn('For better performance, install them manually:');
      if (!envInfo.rust.installed) logger.warn('  - Install Rust: https://rustup.rs/');
      if (!envInfo.solanaCLI.installed) logger.warn('  - Install Solana CLI: https://docs.solana.com/cli/install-solana-cli-tools');
      if (!envInfo.anchorCLI.installed) logger.warn('  - Install Anchor CLI: https://www.anchor-lang.com/docs/installation');
    }
    
    // Cleanup old temporary directories on startup
    await cleanupOldDirectories();
    
    // Schedule periodic cleanup (every 6 hours)
    setInterval(() => {
      cleanupOldDirectories().catch(err => {
        logger.error('Scheduled cleanup failed', { error: err.message });
      });
    }, 6 * 60 * 60 * 1000);
    
    logger.info('Initialization complete');
  } catch (error) {
    logger.error('Initialization failed', { error: error.message, stack: error.stack });
    // Don't exit - service can still function with manual tool installation
  }
}

/**
 * Start server
 */
async function start() {
  try {
    // Initialize
    await initialize();
    
    // Start listening
    const server = app.listen(PORT, () => {
      logger.info(`Server started on port ${PORT}`, {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version
      });
      
      console.log(`\n🚀 Solana Program Deployer Service`);
      console.log(`📡 Server running on http://localhost:${PORT}`);
      console.log(`📚 API Documentation: http://localhost:${PORT}/`);
      console.log(`🏥 Health Check: http://localhost:${PORT}/deploy/health\n`);
    });
    
    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });
    
    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error: error.message, stack: error.stack });
      process.exit(1);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection', { reason, promise });
      process.exit(1);
    });
    
  } catch (error) {
    logger.error('Failed to start server', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

// Start server if this is the main module
if (require.main === module) {
  start();
}

module.exports = app;

