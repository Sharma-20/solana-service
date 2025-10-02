/**
 * Anchor Build & Deploy Module
 * Core deployment functionality for Anchor programs
 */

const path = require('path');
const logger = require('../utils/logger');
const { BuildError, DeploymentError } = require('../utils/errorHandler');
const { executeCommand } = require('./solanaCliWrapper');
const { 
  ANCHOR_CLI_PATH,
  BUILD_TIMEOUT_MS,
  DEPLOYMENT_TIMEOUT_MS
} = require('../config/constants');

/**
 * Build Anchor program
 * @param {string} projectPath - Path to Anchor project
 * @param {string} deploymentId - Deployment identifier
 * @returns {Promise<Object>} Build result with logs
 */
async function buildProgram(projectPath, deploymentId) {
  logger.deployment(deploymentId, 'info', 'Building Anchor program', { projectPath });
  
  try {
    const command = `${ANCHOR_CLI_PATH} build`;
    
    const startTime = Date.now();
    const result = await executeCommand(command, {
      cwd: projectPath,
      timeout: BUILD_TIMEOUT_MS,
      stream: true
    });
    const buildDuration = Date.now() - startTime;
    
    logger.deployment(deploymentId, 'info', 'Program built successfully', { 
      projectPath,
      buildDurationMs: buildDuration
    });
    
    return {
      success: true,
      logs: result.logs,
      duration: buildDuration,
      stdout: result.stdout
    };
  } catch (error) {
    logger.deployment(deploymentId, 'error', 'Build failed', { 
      error: error.message,
      projectPath 
    });
    
    // Extract meaningful error messages from build logs
    const errorDetails = extractBuildErrors(error.message);
    
    throw new BuildError(
      'Failed to build Anchor program',
      errorDetails,
      error.message.split('\n')
    );
  }
}

/**
 * Deploy Anchor program
 * @param {string} projectPath - Path to Anchor project
 * @param {string} deploymentId - Deployment identifier
 * @returns {Promise<Object>} Deployment result
 */
async function deployProgram(projectPath, deploymentId) {
  logger.deployment(deploymentId, 'info', 'Deploying Anchor program', { projectPath });
  
  try {
    const command = `${ANCHOR_CLI_PATH} deploy`;
    
    const startTime = Date.now();
    const result = await executeCommand(command, {
      cwd: projectPath,
      timeout: DEPLOYMENT_TIMEOUT_MS,
      stream: true
    });
    const deployDuration = Date.now() - startTime;
    
    // Extract program ID and signature from deployment output
    const programId = extractProgramId(result.stdout);
    const signature = extractSignature(result.stdout);
    
    if (!programId) {
      throw new Error('Could not extract program ID from deployment output');
    }
    
    logger.deployment(deploymentId, 'info', 'Program deployed successfully', { 
      projectPath,
      programId,
      signature,
      deployDurationMs: deployDuration
    });
    
    return {
      success: true,
      programId,
      signature,
      logs: result.logs,
      duration: deployDuration,
      stdout: result.stdout
    };
  } catch (error) {
    logger.deployment(deploymentId, 'error', 'Deployment failed', { 
      error: error.message,
      projectPath 
    });
    
    // Extract meaningful error messages
    const errorDetails = extractDeploymentErrors(error.message);
    
    throw new DeploymentError(
      'Failed to deploy Anchor program',
      errorDetails,
      error.message.split('\n')
    );
  }
}

/**
 * Extract program ID from deployment output
 * @param {string} output - Deployment stdout
 * @returns {string|null} Program ID
 */
function extractProgramId(output) {
  // Try multiple patterns for different Anchor versions
  const patterns = [
    /Program Id:\s*([A-Za-z0-9]{32,44})/i,
    /Program:\s*([A-Za-z0-9]{32,44})/i,
    /Deployed:\s*([A-Za-z0-9]{32,44})/i,
    /program\s+id[:\s]+([A-Za-z0-9]{32,44})/i
  ];
  
  for (const pattern of patterns) {
    const match = output.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  // Try to find any base58 string that looks like a program ID
  const base58Pattern = /\b([1-9A-HJ-NP-Za-km-z]{32,44})\b/g;
  const matches = output.match(base58Pattern);
  
  if (matches && matches.length > 0) {
    // Return the first match (usually the program ID)
    return matches[0];
  }
  
  return null;
}

/**
 * Extract transaction signature from deployment output
 * @param {string} output - Deployment stdout
 * @returns {string|null} Transaction signature
 */
function extractSignature(output) {
  // Try multiple patterns
  const patterns = [
    /Signature:\s*([A-Za-z0-9]{64,88})/i,
    /signature[:\s]+([A-Za-z0-9]{64,88})/i,
    /tx[:\s]+([A-Za-z0-9]{64,88})/i
  ];
  
  for (const pattern of patterns) {
    const match = output.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  // Look for base58 strings that are longer (signatures are typically longer than addresses)
  const base58Pattern = /\b([1-9A-HJ-NP-Za-km-z]{64,88})\b/g;
  const matches = output.match(base58Pattern);
  
  if (matches && matches.length > 0) {
    return matches[0];
  }
  
  return null;
}

/**
 * Extract meaningful error messages from build output
 * @param {string} output - Build error output
 * @returns {string} Formatted error details
 */
function extractBuildErrors(output) {
  const lines = output.split('\n');
  const errors = [];
  
  for (const line of lines) {
    // Look for Rust compilation errors
    if (line.includes('error:') || line.includes('error[')) {
      errors.push(line.trim());
    }
    // Look for missing dependencies
    if (line.includes('could not find') || line.includes('cannot find')) {
      errors.push(line.trim());
    }
    // Look for Anchor-specific errors
    if (line.includes('Error:')) {
      errors.push(line.trim());
    }
  }
  
  return errors.length > 0 
    ? errors.join('\n') 
    : 'Build failed with unknown error';
}

/**
 * Extract meaningful error messages from deployment output
 * @param {string} output - Deployment error output
 * @returns {string} Formatted error details
 */
function extractDeploymentErrors(output) {
  const lines = output.split('\n');
  const errors = [];
  
  for (const line of lines) {
    // Look for deployment errors
    if (line.includes('Error:') || line.includes('error:')) {
      errors.push(line.trim());
    }
    // Look for RPC errors
    if (line.includes('RPC') || line.includes('rpc')) {
      errors.push(line.trim());
    }
    // Look for insufficient balance
    if (line.includes('insufficient') || line.includes('balance')) {
      errors.push(line.trim());
    }
  }
  
  return errors.length > 0 
    ? errors.join('\n') 
    : 'Deployment failed with unknown error';
}

/**
 * Run Anchor tests (optional)
 * @param {string} projectPath - Path to Anchor project
 * @param {string} deploymentId - Deployment identifier
 * @returns {Promise<Object>} Test result
 */
async function runTests(projectPath, deploymentId) {
  logger.deployment(deploymentId, 'info', 'Running Anchor tests', { projectPath });
  
  try {
    const command = `${ANCHOR_CLI_PATH} test --skip-local-validator`;
    
    const result = await executeCommand(command, {
      cwd: projectPath,
      timeout: BUILD_TIMEOUT_MS,
      stream: true
    });
    
    logger.deployment(deploymentId, 'info', 'Tests passed', { projectPath });
    
    return {
      success: true,
      logs: result.logs
    };
  } catch (error) {
    logger.deployment(deploymentId, 'warn', 'Tests failed', { 
      error: error.message,
      projectPath 
    });
    
    return {
      success: false,
      error: error.message,
      logs: error.message.split('\n')
    };
  }
}

/**
 * Get program keypair path from build
 * @param {string} projectPath - Path to Anchor project
 * @param {string} programName - Program name
 * @returns {string} Path to program keypair
 */
function getProgramKeypairPath(projectPath, programName) {
  return path.join(projectPath, 'target', 'deploy', `${programName}-keypair.json`);
}

/**
 * Verify program deployment
 * @param {string} programId - Program ID to verify
 * @param {string} deploymentId - Deployment identifier
 * @returns {Promise<boolean>} True if verified
 */
async function verifyDeployment(programId, deploymentId) {
  logger.deployment(deploymentId, 'info', 'Verifying program deployment', { programId });
  
  try {
    const command = `solana program show ${programId}`;
    
    await executeCommand(command, {
      timeout: 30000
    });
    
    logger.deployment(deploymentId, 'info', 'Program deployment verified', { programId });
    return true;
  } catch (error) {
    logger.deployment(deploymentId, 'warn', 'Program verification failed', { 
      error: error.message,
      programId 
    });
    return false;
  }
}

module.exports = {
  buildProgram,
  deployProgram,
  runTests,
  extractProgramId,
  extractSignature,
  getProgramKeypairPath,
  verifyDeployment
};

