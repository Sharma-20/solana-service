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
    })
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
  validateDeploymentRequest,
  sanitizeInput,
  isSafePath,
  deploymentSchema
};

