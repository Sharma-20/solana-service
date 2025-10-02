/**
 * Configuration constants for the Solana Program Deployer Service
 */

require('dotenv').config();

module.exports = {
  // Server configuration
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Rate limiting
  RATE_LIMIT_PER_IP: parseInt(process.env.RATE_LIMIT_PER_IP || '10', 10),
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  
  // Deployment configuration
  MAX_CONCURRENT_DEPLOYMENTS: parseInt(process.env.MAX_CONCURRENT_DEPLOYMENTS || '5', 10),
  DEPLOYMENT_TIMEOUT_MS: parseInt(process.env.DEPLOYMENT_TIMEOUT_MS || '600000', 10), // 10 minutes
  BUILD_TIMEOUT_MS: parseInt(process.env.BUILD_TIMEOUT_MS || '300000', 10), // 5 minutes
  
  // Paths
  TEMP_DIR_PATH: process.env.TEMP_DIR_PATH || './temp',
  LOG_DIR_PATH: process.env.LOG_DIR_PATH || './logs',
  SOLANA_CLI_PATH: process.env.SOLANA_CLI_PATH || 'solana',
  ANCHOR_CLI_PATH: process.env.ANCHOR_CLI_PATH || 'anchor',
  
  // Solana configuration
  SOLANA_CONFIG_DIR: process.env.SOLANA_CONFIG_DIR || `${process.env.HOME}/.config/solana`,
  DEVNET_RPC_URL: process.env.DEVNET_RPC_URL || 'https://api.devnet.solana.com',
  MAINNET_RPC_URL: process.env.MAINNET_RPC_URL || 'https://api.mainnet-beta.solana.com',
  
  // Wallet configuration
  MIN_SOL_BALANCE: parseFloat(process.env.MIN_SOL_BALANCE || '2.0'),
  AIRDROP_AMOUNT: parseFloat(process.env.AIRDROP_AMOUNT || '2.0'),
  AIRDROP_MAX_RETRIES: parseInt(process.env.AIRDROP_MAX_RETRIES || '3', 10),
  
  // Repository configuration
  MAX_REPO_SIZE_MB: parseInt(process.env.MAX_REPO_SIZE_MB || '500', 10),
  GIT_CLONE_TIMEOUT_MS: parseInt(process.env.GIT_CLONE_TIMEOUT_MS || '120000', 10), // 2 minutes
  
  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  
  // Network types
  NETWORKS: {
    DEVNET: 'devnet',
    MAINNET: 'mainnet-beta'
  },
  
  // Error codes
  ERROR_CODES: {
    INVALID_INPUT: 'INVALID_INPUT',
    CLONE_FAILED: 'CLONE_FAILED',
    NOT_ANCHOR_PROJECT: 'NOT_ANCHOR_PROJECT',
    BUILD_FAILED: 'BUILD_FAILED',
    DEPLOY_FAILED: 'DEPLOY_FAILED',
    WALLET_ERROR: 'WALLET_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
    TIMEOUT: 'TIMEOUT',
    SYSTEM_ERROR: 'SYSTEM_ERROR',
    INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE'
  }
};

