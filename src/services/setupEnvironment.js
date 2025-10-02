/**
 * Environment Setup Module
 * Verifies and installs prerequisites for Solana program deployment
 */

const { exec } = require('child_process');
const util = require('util');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { SOLANA_CLI_PATH, ANCHOR_CLI_PATH, SOLANA_CONFIG_DIR } = require('../config/constants');

const execPromise = util.promisify(exec);

/**
 * Check if a command exists in the system
 * @param {string} command - Command to check
 * @returns {Promise<boolean>} True if command exists
 */
async function commandExists(command) {
  try {
    await execPromise(`which ${command}`);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Check if Rust is installed
 * @returns {Promise<Object>} Installation status and version
 */
async function checkRust() {
  try {
    const { stdout } = await execPromise('rustc --version');
    const version = stdout.trim();
    logger.info('Rust detected', { version });
    return { installed: true, version };
  } catch (error) {
    logger.warn('Rust not detected');
    return { installed: false, version: null };
  }
}

/**
 * Install Rust via rustup
 * @returns {Promise<void>}
 */
async function installRust() {
  logger.info('Installing Rust via rustup...');
  try {
    await execPromise('curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y', {
      timeout: 300000 // 5 minutes
    });
    
    // Source cargo env
    process.env.PATH = `${process.env.HOME}/.cargo/bin:${process.env.PATH}`;
    
    logger.info('Rust installed successfully');
  } catch (error) {
    logger.error('Failed to install Rust', { error: error.message });
    throw new Error(`Rust installation failed: ${error.message}`);
  }
}

/**
 * Check if Solana CLI is installed
 * @returns {Promise<Object>} Installation status and version
 */
async function checkSolanaCLI() {
  try {
    const { stdout } = await execPromise(`${SOLANA_CLI_PATH} --version`);
    const version = stdout.trim();
    logger.info('Solana CLI detected', { version });
    return { installed: true, version };
  } catch (error) {
    logger.warn('Solana CLI not detected');
    return { installed: false, version: null };
  }
}

/**
 * Install Solana CLI
 * @returns {Promise<void>}
 */
async function installSolanaCLI() {
  logger.info('Installing Solana CLI...');
  try {
    await execPromise('sh -c "$(curl -sSfL https://release.solana.com/stable/install)"', {
      timeout: 300000 // 5 minutes
    });
    
    // Add Solana to PATH
    process.env.PATH = `${process.env.HOME}/.local/share/solana/install/active_release/bin:${process.env.PATH}`;
    
    logger.info('Solana CLI installed successfully');
  } catch (error) {
    logger.error('Failed to install Solana CLI', { error: error.message });
    throw new Error(`Solana CLI installation failed: ${error.message}`);
  }
}

/**
 * Check if Anchor CLI is installed
 * @returns {Promise<Object>} Installation status and version
 */
async function checkAnchorCLI() {
  try {
    const { stdout } = await execPromise(`${ANCHOR_CLI_PATH} --version`);
    const version = stdout.trim();
    logger.info('Anchor CLI detected', { version });
    return { installed: true, version };
  } catch (error) {
    logger.warn('Anchor CLI not detected');
    return { installed: false, version: null };
  }
}

/**
 * Install Anchor CLI using cargo
 * @returns {Promise<void>}
 */
async function installAnchorCLI() {
  logger.info('Installing Anchor CLI from source...');
  try {
    // Install via avm (Anchor Version Manager) for easier management
    await execPromise('cargo install --git https://github.com/coral-xyz/anchor avm --locked --force', {
      timeout: 600000 // 10 minutes
    });
    
    // Install latest anchor version
    await execPromise('avm install latest', {
      timeout: 600000 // 10 minutes
    });
    
    await execPromise('avm use latest');
    
    logger.info('Anchor CLI installed successfully');
  } catch (error) {
    logger.error('Failed to install Anchor CLI', { error: error.message });
    throw new Error(`Anchor CLI installation failed: ${error.message}`);
  }
}

/**
 * Check and install system dependencies (Linux)
 * @returns {Promise<void>}
 */
async function checkSystemDependencies() {
  const platform = process.platform;
  
  logger.info('Checking system dependencies', { platform });
  
  if (platform === 'linux') {
    try {
      // Check if apt-get is available
      const hasApt = await commandExists('apt-get');
      
      if (hasApt) {
        logger.info('Installing system dependencies via apt-get...');
        await execPromise('sudo apt-get update && sudo apt-get install -y build-essential pkg-config libudev-dev llvm libclang-dev', {
          timeout: 300000 // 5 minutes
        });
        logger.info('System dependencies installed');
      }
    } catch (error) {
      logger.warn('Could not install system dependencies', { error: error.message });
      // Don't throw, as some systems might already have these
    }
  } else if (platform === 'darwin') {
    logger.info('macOS detected - assuming Xcode Command Line Tools are installed');
  }
}

/**
 * Ensure Solana config directory exists
 * @returns {Promise<void>}
 */
async function ensureConfigDirectory() {
  if (!fs.existsSync(SOLANA_CONFIG_DIR)) {
    logger.info('Creating Solana config directory', { path: SOLANA_CONFIG_DIR });
    fs.mkdirSync(SOLANA_CONFIG_DIR, { recursive: true });
  }
}

/**
 * Verify all prerequisites and install if missing
 * @param {boolean} autoInstall - Whether to automatically install missing components
 * @returns {Promise<Object>} Status of all components
 */
async function verifyEnvironment(autoInstall = false) {
  logger.info('Verifying environment prerequisites...');
  
  const status = {
    rust: await checkRust(),
    solanaCLI: await checkSolanaCLI(),
    anchorCLI: await checkAnchorCLI()
  };
  
  const allInstalled = status.rust.installed && 
                       status.solanaCLI.installed && 
                       status.anchorCLI.installed;
  
  if (!allInstalled) {
    if (!autoInstall) {
      logger.warn('Missing required components', { status });
      throw new Error('Environment setup incomplete. Please install missing components or set autoInstall=true');
    }
    
    // Install missing components
    if (!status.rust.installed) {
      await checkSystemDependencies();
      await installRust();
      status.rust = await checkRust();
    }
    
    if (!status.solanaCLI.installed) {
      await installSolanaCLI();
      status.solanaCLI = await checkSolanaCLI();
    }
    
    if (!status.anchorCLI.installed) {
      await installAnchorCLI();
      status.anchorCLI = await checkAnchorCLI();
    }
  }
  
  // Ensure config directory exists
  await ensureConfigDirectory();
  
  logger.info('Environment verification complete', { status });
  return status;
}

/**
 * Get environment information
 * @returns {Promise<Object>} Environment details
 */
async function getEnvironmentInfo() {
  const info = {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    rust: await checkRust(),
    solanaCLI: await checkSolanaCLI(),
    anchorCLI: await checkAnchorCLI()
  };
  
  return info;
}

module.exports = {
  verifyEnvironment,
  getEnvironmentInfo,
  checkRust,
  checkSolanaCLI,
  checkAnchorCLI,
  commandExists
};

