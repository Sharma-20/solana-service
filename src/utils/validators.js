/**
 * Input validation utilities using Joi
 */

const Joi = require('joi');
const { NETWORKS } = require('../config/constants');
const { ValidationError } = require('./errorHandler');

/**
 * Validate GitHub repository URL
 * @param {string} url - Repository URL
 * @returns {boolean} True if valid
 */
const isValidGitHubUrl = (url) => {
  const githubRegex = /^https?:\/\/(www\.)?github\.com\/[\w-]+\/[\w.-]+\/?$/;
  return githubRegex.test(url);
};

/**
 * Validate Solana network
 * @param {string} network - Network name
 * @returns {boolean} True if valid
 */
const isValidNetwork = (network) => {
  return Object.values(NETWORKS).includes(network);
};

/**
 * Validate Solana wallet address
 * @param {string} address - Wallet address
 * @returns {boolean} True if valid
 */
const isValidWalletAddress = (address) => {
  // Solana addresses are base58 encoded and typically 32-44 characters
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  return base58Regex.test(address);
};

/**
 * Validate Solana keypair array
 * @param {Array} keypair - Keypair array
 * @returns {boolean} True if valid
 */
const isValidKeypair = (keypair) => {
  return Array.isArray(keypair) && 
         keypair.length === 64 && 
         keypair.every(byte => typeof byte === 'number' && byte >= 0 && byte <= 255);
};

/**
 * Deployment request schema
 */
const deploymentSchema = Joi.object({
  repo_url: Joi.string()
    .required()
    .custom((value, helpers) => {
      if (!isValidGitHubUrl(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    })
    .messages({
      'any.required': 'repo_url is required',
      'any.invalid': 'Invalid GitHub repository URL. Must be in format: https://github.com/user/repo'
    }),
  
  network: Joi.string()
    .valid(...Object.values(NETWORKS))
    .default(NETWORKS.DEVNET)
    .messages({
      'any.only': `Network must be one of: ${Object.values(NETWORKS).join(', ')}`
    }),

  // Custom wallet options
  wallet_address: Joi.string()
    .optional()
    .custom((value, helpers) => {
      if (value && !isValidWalletAddress(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    })
    .messages({
      'any.invalid': 'Invalid Solana wallet address format'
    }),

  wallet_keypair: Joi.array()
    .items(Joi.number().integer().min(0).max(255))
    .length(64)
    .optional()
    .messages({
      'array.length': 'Keypair must be exactly 64 bytes',
      'array.items': 'Each keypair byte must be between 0-255'
    }),

  wallet_path: Joi.string()
    .optional()
    .custom((value, helpers) => {
      if (value && !isSafePath(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    })
    .messages({
      'any.invalid': 'Invalid wallet file path'
    })
}).custom((value, helpers) => {
  // Ensure only one wallet option is provided
  const walletOptions = [
    value.wallet_address,
    value.wallet_keypair,
    value.wallet_path
  ].filter(Boolean);

  if (walletOptions.length > 1) {
    return helpers.error('custom.multipleWalletOptions');
  }

  return value;
}).messages({
  'custom.multipleWalletOptions': 'Only one wallet option can be provided: wallet_address, wallet_keypair, or wallet_path'
});

/**
 * Validate deployment request payload
 * @param {Object} data - Request data
 * @returns {Object} Validated and sanitized data
 * @throws {ValidationError} If validation fails
 */
const validateDeploymentRequest = (data) => {
  const { error, value } = deploymentSchema.validate(data, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const details = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));
    
    throw new ValidationError('Invalid request payload', details);
  }

  return value;
};

/**
 * Sanitize command arguments to prevent injection
 * @param {string} input - User input
 * @returns {string} Sanitized input
 */
const sanitizeInput = (input) => {
  // Remove potentially dangerous characters
  return input.replace(/[;&|`$(){}[\]<>]/g, '');
};

/**
 * Validate file path to prevent directory traversal
 * @param {string} filePath - File path to validate
 * @returns {boolean} True if safe
 */
const isSafePath = (filePath) => {
  const normalized = filePath.replace(/\\/g, '/');
  return !normalized.includes('../') && !normalized.startsWith('/');
};

module.exports = {
  isValidGitHubUrl,
  isValidNetwork,
  isValidWalletAddress,
  isValidKeypair,
  validateDeploymentRequest,
  sanitizeInput,
  isSafePath,
  deploymentSchema
};

