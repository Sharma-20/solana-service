/**
 * Deploy Route Handler
 * Handles program deployment requests
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { asyncHandler } = require('../utils/errorHandler');
const { validateDeploymentRequest } = require('../utils/validators');
const { 
  generateDeploymentId,
  cloneRepository,
  validateAnchorProject,
  cleanupDirectory
} = require('../services/projectManager');
const { setupWallet, cleanupWallet } = require('../services/walletManager');
const { configureCluster, ensureFunding, getBalance } = require('../services/solanaCliWrapper');
const { buildProgram, deployProgram, verifyDeployment } = require('../services/anchorDeployer');

/**
 * Main deployment orchestrator
 * @param {string} repoUrl - GitHub repository URL
 * @param {string} network - Target network
 * @param {string} deploymentId - Unique deployment identifier
 * @returns {Promise<Object>} Deployment result
 */
async function orchestrateDeployment(repoUrl, network, deploymentId) {
  let projectPath = null;
  let keypairPath = null;
  let walletAddress = null;
  
  const startTime = Date.now();
  
  try {
    logger.deployment(deploymentId, 'info', 'Starting deployment orchestration', {
      repoUrl,
      network
    });
    
    // Step 1: Clone repository
    logger.deployment(deploymentId, 'info', 'Step 1/6: Cloning repository');
    projectPath = await cloneRepository(repoUrl, deploymentId);
    
    // Step 2: Validate Anchor project
    logger.deployment(deploymentId, 'info', 'Step 2/6: Validating Anchor project');
    const projectConfig = await validateAnchorProject(projectPath, deploymentId);
    
    // Step 3: Configure Solana cluster
    logger.deployment(deploymentId, 'info', 'Step 3/6: Configuring Solana cluster');
    await configureCluster(network, deploymentId);
    
    // Step 4: Setup and fund wallet
    logger.deployment(deploymentId, 'info', 'Step 4/6: Setting up wallet');
    const walletInfo = await setupWallet(deploymentId, network);
    keypairPath = walletInfo.keypairPath;
    walletAddress = walletInfo.address;
    
    // Ensure wallet has sufficient funds
    const balance = await ensureFunding(walletAddress, network, deploymentId);
    logger.deployment(deploymentId, 'info', 'Wallet funded', { 
      address: walletAddress,
      balance 
    });
    
    // Step 5: Build program
    logger.deployment(deploymentId, 'info', 'Step 5/6: Building Anchor program');
    const buildResult = await buildProgram(projectPath, deploymentId);
    
    // Step 6: Deploy program
    logger.deployment(deploymentId, 'info', 'Step 6/6: Deploying Anchor program');
    const deployResult = await deployProgram(projectPath, deploymentId);
    
    // Verify deployment (optional, best effort)
    const verified = await verifyDeployment(deployResult.programId, deploymentId);
    
    const totalDuration = Date.now() - startTime;
    
    logger.deployment(deploymentId, 'info', 'Deployment completed successfully', {
      programId: deployResult.programId,
      signature: deployResult.signature,
      totalDurationMs: totalDuration
    });
    
    return {
      success: true,
      data: {
        program_id: deployResult.programId,
        signature: deployResult.signature,
        network: network,
        wallet_address: walletAddress,
        deployment_time: new Date().toISOString(),
        build_duration_ms: buildResult.duration,
        deploy_duration_ms: deployResult.duration,
        total_duration_ms: totalDuration,
        verified: verified,
        build_logs: buildResult.logs.slice(-50), // Last 50 lines
        deploy_logs: deployResult.logs.slice(-50) // Last 50 lines
      }
    };
  } catch (error) {
    logger.deployment(deploymentId, 'error', 'Deployment failed', {
      error: error.message,
      stack: error.stack
    });
    
    throw error;
  } finally {
    // Cleanup
    logger.deployment(deploymentId, 'info', 'Cleaning up resources');
    
    if (projectPath) {
      await cleanupDirectory(projectPath, deploymentId);
    }
    
    if (keypairPath) {
      cleanupWallet(keypairPath);
    }
  }
}

/**
 * POST /deploy
 * Deploy Solana program from GitHub repository
 */
router.post('/', asyncHandler(async (req, res) => {
  // Validate request
  const { repo_url, network } = validateDeploymentRequest(req.body);
  
  // Generate unique deployment ID
  const deploymentId = generateDeploymentId();
  
  // Log request
  logger.info('Deployment request received', {
    deploymentId,
    repoUrl: repo_url,
    network,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  
  try {
    // Execute deployment
    const result = await orchestrateDeployment(repo_url, network, deploymentId);
    
    // Return success response
    res.status(200).json({
      ...result,
      deployment_id: deploymentId
    });
  } catch (error) {
    // Error is handled by error middleware
    throw error;
  }
}));

/**
 * GET /health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/**
 * GET /status/:deploymentId
 * Get deployment status (placeholder for future queue implementation)
 */
router.get('/status/:deploymentId', asyncHandler(async (req, res) => {
  const { deploymentId } = req.params;
  
  // This is a placeholder - in production, you'd query a database or cache
  res.status(200).json({
    deployment_id: deploymentId,
    status: 'unknown',
    message: 'Status tracking not yet implemented'
  });
}));

module.exports = router;

