/**
 * Logging utility using Winston
 * Provides structured logging with timestamps and log levels
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');
const { LOG_DIR_PATH, LOG_LEVEL } = require('../config/constants');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR_PATH)) {
  fs.mkdirSync(LOG_DIR_PATH, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Define console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: logFormat,
  transports: [
    // Write all logs to combined.log
    new winston.transports.File({
      filename: path.join(LOG_DIR_PATH, 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    // Write error logs to error.log
    new winston.transports.File({
      filename: path.join(LOG_DIR_PATH, 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    })
  ]
});

// Add console transport for non-production environments
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat
    })
  );
}

/**
 * Create a child logger with additional context
 * @param {Object} meta - Additional metadata to include in all logs
 * @returns {Object} Child logger instance
 */
logger.createChild = (meta) => {
  return logger.child(meta);
};

/**
 * Log deployment-specific events with correlation ID
 * @param {string} deploymentId - Unique deployment identifier
 * @param {string} level - Log level (info, warn, error, etc.)
 * @param {string} message - Log message
 * @param {Object} meta - Additional metadata
 */
logger.deployment = (deploymentId, level, message, meta = {}) => {
  logger.log(level, message, {
    deploymentId,
    ...meta
  });
};

module.exports = logger;

