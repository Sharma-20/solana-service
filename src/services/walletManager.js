/**
 * Wallet Manager Module
 * Manages Solana wallet operations including generation, funding, and balance checks
 */

const { Keypair } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { WalletError } = require('../utils/errorHandler');
const { 
  SOLANA_CONFIG_DIR, 
  MIN_SOL_BALANCE,
  AIRDROP_AMOUNT,
  AIRDROP_MAX_RETRIES
} = require('../config/constants');

/**
 * Generate a new Solana keypair
 * @returns {Keypair} New keypair
 */
function generateKeypair() {
  try {
    const keypair = Keypair.generate();
    logger.info('Generated new keypair', { 
      publicKey: keypair.publicKey.toBase58() 
    });
    return keypair;
  } catch (error) {
    logger.error('Failed to generate keypair', { error: error.message });
    throw new WalletError('Failed to generate wallet keypair', error.message);
  }
}

/**
 * Save keypair to file
 * @param {Keypair} keypair - Keypair to save
 * @param {string} deploymentId - Unique deployment identifier
 * @returns {string} Path to saved keypair file
 */
function saveKeypair(keypair, deploymentId) {
  try {
    // Ensure config directory exists
    if (!fs.existsSync(SOLANA_CONFIG_DIR)) {
      fs.mkdirSync(SOLANA_CONFIG_DIR, { recursive: true });
    }
    
    // Use deployment-specific keypair file
    const keypairPath = path.join(SOLANA_CONFIG_DIR, `deployer-${deploymentId}.json`);
    
    // Convert keypair to array format expected by Solana CLI
    const keypairArray = Array.from(keypair.secretKey);
    
    fs.writeFileSync(keypairPath, JSON.stringify(keypairArray), {
      mode: 0o600 // Read/write for owner only
    });
    
    logger.info('Saved keypair to file', { 
      path: keypairPath,
      publicKey: keypair.publicKey.toBase58()
    });
    
    return keypairPath;
  } catch (error) {
    logger.error('Failed to save keypair', { error: error.message });
    throw new WalletError('Failed to save wallet keypair', error.message);
  }
}

/**
 * Load keypair from file
 * @param {string} keypairPath - Path to keypair file
 * @returns {Keypair} Loaded keypair
 */
function loadKeypair(keypairPath) {
  try {
    const secretKeyString = fs.readFileSync(keypairPath, 'utf8');
    const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
    const keypair = Keypair.fromSecretKey(secretKey);
    
    logger.info('Loaded keypair from file', { 
      path: keypairPath,
      publicKey: keypair.publicKey.toBase58()
    });
    
    return keypair;
  } catch (error) {
    logger.error('Failed to load keypair', { error: error.message, path: keypairPath });
    throw new WalletError('Failed to load wallet keypair', error.message);
  }
}

/**
 * Delete keypair file
 * @param {string} keypairPath - Path to keypair file
 */
function deleteKeypair(keypairPath) {
  try {
    if (fs.existsSync(keypairPath)) {
      fs.unlinkSync(keypairPath);
      logger.info('Deleted keypair file', { path: keypairPath });
    }
  } catch (error) {
    logger.warn('Failed to delete keypair file', { 
      error: error.message, 
      path: keypairPath 
    });
    // Don't throw - cleanup is best effort
  }
}

/**
 * Create default keypair symlink for Solana CLI
 * @param {string} keypairPath - Path to actual keypair file
 * @returns {string} Path to default keypair location
 */
function setDefaultKeypair(keypairPath) {
  try {
    const defaultKeypairPath = path.join(SOLANA_CONFIG_DIR, 'id.json');
    
    // Remove existing default keypair if it exists
    if (fs.existsSync(defaultKeypairPath)) {
      fs.unlinkSync(defaultKeypairPath);
    }
    
    // Copy keypair to default location (safer than symlink)
    fs.copyFileSync(keypairPath, defaultKeypairPath);
    
    logger.info('Set default keypair', { 
      source: keypairPath,
      destination: defaultKeypairPath
    });
    
    return defaultKeypairPath;
  } catch (error) {
    logger.error('Failed to set default keypair', { error: error.message });
    throw new WalletError('Failed to set default wallet', error.message);
  }
}

/**
 * Setup wallet for deployment
 * Creates a new keypair and saves it for use in deployment
 * @param {string} deploymentId - Unique deployment identifier
 * @param {string} network - Target network (devnet or mainnet-beta)
 * @returns {Promise<Object>} Wallet information
 */
async function setupWallet(deploymentId, network) {
  logger.info('Setting up wallet for deployment', { deploymentId, network });
  
  try {
    // Generate new keypair
    const keypair = generateKeypair();
    const publicKey = keypair.publicKey.toBase58();
    
    // Save keypair
    const keypairPath = saveKeypair(keypair, deploymentId);
    
    // Set as default keypair for Solana CLI
    setDefaultKeypair(keypairPath);
    
    const walletInfo = {
      address: publicKey,
      keypairPath,
      network
    };
    
    logger.info('Wallet setup complete', walletInfo);
    
    return walletInfo;
  } catch (error) {
    logger.error('Failed to setup wallet', { 
      error: error.message, 
      deploymentId 
    });
    throw error;
  }
}

/**
 * Cleanup wallet files after deployment
 * @param {string} keypairPath - Path to keypair file
 */
function cleanupWallet(keypairPath) {
  logger.info('Cleaning up wallet', { keypairPath });
  
  try {
    // Delete deployment-specific keypair
    deleteKeypair(keypairPath);
    
    // Optionally clear default keypair
    const defaultKeypairPath = path.join(SOLANA_CONFIG_DIR, 'id.json');
    deleteKeypair(defaultKeypairPath);
    
    logger.info('Wallet cleanup complete');
  } catch (error) {
    logger.warn('Wallet cleanup failed', { error: error.message });
    // Don't throw - cleanup is best effort
  }
}

/**
 * Validate wallet address format
 * @param {string} address - Wallet address to validate
 * @returns {boolean} True if valid
 */
function isValidAddress(address) {
  // Solana addresses are base58 encoded and typically 32-44 characters
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  return base58Regex.test(address);
}

/**
 * Wait for a specified duration
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  generateKeypair,
  saveKeypair,
  loadKeypair,
  deleteKeypair,
  setupWallet,
  cleanupWallet,
  setDefaultKeypair,
  isValidAddress,
  sleep
};

