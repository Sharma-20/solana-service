/**
 * Solana CLI Wrapper Module
 * Wraps Solana CLI commands with proper error handling and logging
 */

const { exec, spawn } = require('child_process');
const util = require('util');
const logger = require('../utils/logger');
const { NetworkError, InsufficientBalanceError, TimeoutError } = require('../utils/errorHandler');
const { 
  SOLANA_CLI_PATH,
  NETWORKS,
  DEVNET_RPC_URL,
  MAINNET_RPC_URL,
  MIN_SOL_BALANCE,
  AIRDROP_AMOUNT,
  AIRDROP_MAX_RETRIES
} = require('../config/constants');

const execPromise = util.promisify(exec);

/**
 * Execute a command with timeout and log streaming
 * @param {string} command - Command to execute
 * @param {Object} options - Execution options
 * @returns {Promise<Object>} Result with stdout, stderr, and logs
 */
async function executeCommand(command, options = {}) {
  const timeout = options.timeout || 60000; // 1 minute default
  const logs = [];
  
  return new Promise((resolve, reject) => {
    const child = spawn(command, [], { 
      shell: true,
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, ...options.env }
    });
    
    const timer = setTimeout(() => {
      child.kill();
      reject(new TimeoutError(`Command timeout: ${command}`));
    }, timeout);
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      logs.push(output);
      if (options.stream) {
        logger.debug(output.trim());
      }
    });
    
    child.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      logs.push(output);
      if (options.stream) {
        logger.debug(output.trim());
      }
    });
    
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`Command failed with code ${code}: ${command}\n${stderr}`));
      } else {
        resolve({ code, stdout, stderr, logs });
      }
    });
    
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

/**
 * Get RPC URL for network
 * @param {string} network - Network name
 * @returns {string} RPC URL
 */
function getRpcUrl(network) {
  switch (network) {
    case NETWORKS.DEVNET:
      return DEVNET_RPC_URL;
    case NETWORKS.MAINNET:
      return MAINNET_RPC_URL;
    default:
      return DEVNET_RPC_URL;
  }
}

/**
 * Configure Solana CLI cluster
 * @param {string} network - Target network
 * @param {string} deploymentId - Deployment identifier for logging
 * @returns {Promise<void>}
 */
async function configureCluster(network, deploymentId) {
  logger.deployment(deploymentId, 'info', 'Configuring Solana cluster', { network });
  
  try {
    const rpcUrl = getRpcUrl(network);
    const command = `${SOLANA_CLI_PATH} config set --url ${rpcUrl}`;
    
    const result = await executeCommand(command, { timeout: 30000 });
    
    logger.deployment(deploymentId, 'info', 'Cluster configured successfully', { 
      network, 
      rpcUrl 
    });
    
    return result;
  } catch (error) {
    logger.deployment(deploymentId, 'error', 'Failed to configure cluster', { 
      error: error.message,
      network 
    });
    throw new NetworkError('Failed to configure Solana cluster', error.message);
  }
}

/**
 * Get wallet balance
 * @param {string} address - Wallet address
 * @param {string} deploymentId - Deployment identifier for logging
 * @returns {Promise<number>} Balance in SOL
 */
async function getBalance(address, deploymentId) {
  logger.deployment(deploymentId, 'info', 'Checking wallet balance', { address });
  
  try {
    const command = `${SOLANA_CLI_PATH} balance ${address}`;
    const result = await executeCommand(command, { timeout: 30000 });
    
    // Parse balance from output (format: "X.XXXXXXXXX SOL")
    const balanceMatch = result.stdout.match(/(\d+\.?\d*)\s+SOL/);
    const balance = balanceMatch ? parseFloat(balanceMatch[1]) : 0;
    
    logger.deployment(deploymentId, 'info', 'Balance retrieved', { 
      address, 
      balance 
    });
    
    return balance;
  } catch (error) {
    logger.deployment(deploymentId, 'error', 'Failed to get balance', { 
      error: error.message,
      address 
    });
    throw new NetworkError('Failed to get wallet balance', error.message);
  }
}

/**
 * Request airdrop with retry logic
 * @param {string} address - Wallet address
 * @param {number} amount - Amount of SOL to airdrop
 * @param {string} deploymentId - Deployment identifier for logging
 * @param {number} retries - Number of retries remaining
 * @returns {Promise<string>} Transaction signature
 */
async function requestAirdrop(address, amount, deploymentId, retries = AIRDROP_MAX_RETRIES) {
  logger.deployment(deploymentId, 'info', 'Requesting airdrop', { 
    address, 
    amount,
    retriesRemaining: retries
  });
  
  try {
    const command = `${SOLANA_CLI_PATH} airdrop ${amount} ${address}`;
    const result = await executeCommand(command, { timeout: 60000 });
    
    // Extract signature from output
    const signatureMatch = result.stdout.match(/Signature: ([A-Za-z0-9]+)/);
    const signature = signatureMatch ? signatureMatch[1] : null;
    
    // Wait a bit for airdrop to be processed
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Verify balance increased
    const balance = await getBalance(address, deploymentId);
    
    if (balance < amount * 0.9) { // Allow 10% margin
      throw new Error('Airdrop did not reflect in balance');
    }
    
    logger.deployment(deploymentId, 'info', 'Airdrop successful', { 
      address, 
      amount,
      signature,
      newBalance: balance
    });
    
    return signature;
  } catch (error) {
    if (retries > 0) {
      logger.deployment(deploymentId, 'warn', 'Airdrop failed, retrying...', { 
        error: error.message,
        retriesRemaining: retries - 1
      });
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      return requestAirdrop(address, amount, deploymentId, retries - 1);
    }
    
    logger.deployment(deploymentId, 'error', 'Airdrop failed after all retries', { 
      error: error.message,
      address,
      amount
    });
    
    throw new NetworkError('Failed to request airdrop after multiple attempts', error.message);
  }
}

/**
 * Ensure wallet has sufficient balance
 * @param {string} address - Wallet address
 * @param {string} network - Target network
 * @param {string} deploymentId - Deployment identifier for logging
 * @returns {Promise<number>} Final balance
 */
async function ensureFunding(address, network, deploymentId) {
  logger.deployment(deploymentId, 'info', 'Ensuring wallet has sufficient funds', { 
    address, 
    network,
    minBalance: MIN_SOL_BALANCE
  });
  
  try {
    // Check current balance
    let balance = await getBalance(address, deploymentId);
    
    // If balance is sufficient, return
    if (balance >= MIN_SOL_BALANCE) {
      logger.deployment(deploymentId, 'info', 'Wallet has sufficient balance', { 
        address, 
        balance 
      });
      return balance;
    }
    
    // Only devnet supports airdrops
    if (network !== NETWORKS.DEVNET) {
      throw new InsufficientBalanceError(
        `Insufficient balance for mainnet deployment. Required: ${MIN_SOL_BALANCE} SOL, Current: ${balance} SOL`,
        { address, balance, required: MIN_SOL_BALANCE }
      );
    }
    
    // Request airdrop on devnet
    logger.deployment(deploymentId, 'info', 'Requesting devnet airdrop', { 
      address,
      amount: AIRDROP_AMOUNT
    });
    
    await requestAirdrop(address, AIRDROP_AMOUNT, deploymentId);
    
    // Get updated balance
    balance = await getBalance(address, deploymentId);
    
    if (balance < MIN_SOL_BALANCE) {
      throw new InsufficientBalanceError(
        `Insufficient balance after airdrop. Required: ${MIN_SOL_BALANCE} SOL, Current: ${balance} SOL`,
        { address, balance, required: MIN_SOL_BALANCE }
      );
    }
    
    logger.deployment(deploymentId, 'info', 'Wallet funded successfully', { 
      address, 
      balance 
    });
    
    return balance;
  } catch (error) {
    if (error instanceof InsufficientBalanceError) {
      throw error;
    }
    
    logger.deployment(deploymentId, 'error', 'Failed to ensure funding', { 
      error: error.message,
      address,
      network
    });
    
    throw new NetworkError('Failed to ensure wallet funding', error.message);
  }
}

/**
 * Confirm transaction
 * @param {string} signature - Transaction signature
 * @param {string} deploymentId - Deployment identifier for logging
 * @returns {Promise<boolean>} True if confirmed
 */
async function confirmTransaction(signature, deploymentId) {
  logger.deployment(deploymentId, 'info', 'Confirming transaction', { signature });
  
  try {
    const command = `${SOLANA_CLI_PATH} confirm ${signature}`;
    await executeCommand(command, { timeout: 60000 });
    
    logger.deployment(deploymentId, 'info', 'Transaction confirmed', { signature });
    return true;
  } catch (error) {
    logger.deployment(deploymentId, 'warn', 'Transaction confirmation failed', { 
      error: error.message,
      signature
    });
    return false;
  }
}

module.exports = {
  executeCommand,
  configureCluster,
  getBalance,
  requestAirdrop,
  ensureFunding,
  confirmTransaction,
  getRpcUrl
};

