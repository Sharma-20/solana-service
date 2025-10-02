/**
 * Custom error classes and error handling utilities
 */

const logger = require('./logger');
const { ERROR_CODES } = require('../config/constants');

/**
 * Base class for custom errors
 */
class AppError extends Error {
  constructor(message, code, statusCode = 500, details = null, logs = []) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.logs = logs;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        logs: this.logs,
        timestamp: this.timestamp
      }
    };
  }
}

/**
 * Invalid input error
 */
class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, ERROR_CODES.INVALID_INPUT, 400, details);
  }
}

/**
 * Repository clone error
 */
class CloneError extends AppError {
  constructor(message, details = null, logs = []) {
    super(message, ERROR_CODES.CLONE_FAILED, 500, details, logs);
  }
}

/**
 * Not an Anchor project error
 */
class InvalidProjectError extends AppError {
  constructor(message, details = null) {
    super(message, ERROR_CODES.NOT_ANCHOR_PROJECT, 400, details);
  }
}

/**
 * Build failure error
 */
class BuildError extends AppError {
  constructor(message, details = null, logs = []) {
    super(message, ERROR_CODES.BUILD_FAILED, 500, details, logs);
  }
}

/**
 * Deployment failure error
 */
class DeploymentError extends AppError {
  constructor(message, details = null, logs = []) {
    super(message, ERROR_CODES.DEPLOY_FAILED, 500, details, logs);
  }
}

/**
 * Wallet-related error
 */
class WalletError extends AppError {
  constructor(message, details = null) {
    super(message, ERROR_CODES.WALLET_ERROR, 500, details);
  }
}

/**
 * Network-related error
 */
class NetworkError extends AppError {
  constructor(message, details = null) {
    super(message, ERROR_CODES.NETWORK_ERROR, 503, details);
  }
}

/**
 * Timeout error
 */
class TimeoutError extends AppError {
  constructor(message, details = null) {
    super(message, ERROR_CODES.TIMEOUT, 408, details);
  }
}

/**
 * Insufficient balance error
 */
class InsufficientBalanceError extends AppError {
  constructor(message, details = null) {
    super(message, ERROR_CODES.INSUFFICIENT_BALANCE, 500, details);
  }
}

/**
 * Express error handling middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const errorMiddleware = (err, req, res, next) => {
  // Log error
  logger.error('Request error', {
    error: err.message,
    code: err.code,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  // Handle custom app errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json(err.toJSON());
  }

  // Handle unknown errors
  const statusCode = err.statusCode || 500;
  const response = {
    success: false,
    error: {
      code: ERROR_CODES.SYSTEM_ERROR,
      message: process.env.NODE_ENV === 'production' 
        ? 'An unexpected error occurred' 
        : err.message,
      timestamp: new Date().toISOString()
    }
  };

  res.status(statusCode).json(response);
};

/**
 * Async route handler wrapper to catch errors
 * @param {Function} fn - Async route handler function
 * @returns {Function} Wrapped route handler
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  AppError,
  ValidationError,
  CloneError,
  InvalidProjectError,
  BuildError,
  DeploymentError,
  WalletError,
  NetworkError,
  TimeoutError,
  InsufficientBalanceError,
  errorMiddleware,
  asyncHandler
};

