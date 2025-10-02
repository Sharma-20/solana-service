/**
 * Project Manager Module
 * Handles repository operations and temporary workspace management
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { CloneError, InvalidProjectError, TimeoutError } = require('../utils/errorHandler');
const { executeCommand } = require('./solanaCliWrapper');
const { 
  TEMP_DIR_PATH,
  GIT_CLONE_TIMEOUT_MS,
  MAX_REPO_SIZE_MB
} = require('../config/constants');

/**
 * Ensure temp directory exists
 */
function ensureTempDirectory() {
  if (!fs.existsSync(TEMP_DIR_PATH)) {
    fs.mkdirSync(TEMP_DIR_PATH, { recursive: true });
    logger.info('Created temp directory', { path: TEMP_DIR_PATH });
  }
}

/**
 * Generate unique deployment ID
 * @returns {string} Unique deployment identifier
 */
function generateDeploymentId() {
  return uuidv4();
}

/**
 * Clone GitHub repository to temp directory
 * @param {string} repoUrl - Repository URL
 * @param {string} deploymentId - Deployment identifier
 * @returns {Promise<string>} Path to cloned repository
 */
async function cloneRepository(repoUrl, deploymentId) {
  logger.deployment(deploymentId, 'info', 'Cloning repository', { repoUrl });
  
  try {
    ensureTempDirectory();
    
    const tempDir = path.join(TEMP_DIR_PATH, deploymentId);
    
    // Ensure target directory doesn't exist
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    
    // Clone repository with depth 1 for faster cloning
    const command = `git clone --depth 1 ${repoUrl} ${tempDir}`;
    
    await executeCommand(command, {
      timeout: GIT_CLONE_TIMEOUT_MS,
      stream: true
    });
    
    // Check directory size
    const size = await getDirectorySize(tempDir);
    const sizeMB = size / (1024 * 1024);
    
    if (sizeMB > MAX_REPO_SIZE_MB) {
      await cleanupDirectory(tempDir);
      throw new CloneError(
        `Repository size (${sizeMB.toFixed(2)}MB) exceeds maximum allowed (${MAX_REPO_SIZE_MB}MB)`,
        { size: sizeMB, maxSize: MAX_REPO_SIZE_MB }
      );
    }
    
    logger.deployment(deploymentId, 'info', 'Repository cloned successfully', { 
      path: tempDir,
      sizeMB: sizeMB.toFixed(2)
    });
    
    return tempDir;
  } catch (error) {
    logger.deployment(deploymentId, 'error', 'Failed to clone repository', { 
      error: error.message,
      repoUrl 
    });
    
    if (error instanceof CloneError) {
      throw error;
    }
    
    throw new CloneError('Failed to clone repository', error.message);
  }
}

/**
 * Get directory size recursively
 * @param {string} dirPath - Directory path
 * @returns {Promise<number>} Size in bytes
 */
async function getDirectorySize(dirPath) {
  let size = 0;
  
  const items = fs.readdirSync(dirPath, { withFileTypes: true });
  
  for (const item of items) {
    const itemPath = path.join(dirPath, item.name);
    
    if (item.isDirectory()) {
      size += await getDirectorySize(itemPath);
    } else {
      const stats = fs.statSync(itemPath);
      size += stats.size;
    }
  }
  
  return size;
}

/**
 * Validate that directory contains an Anchor project
 * @param {string} projectPath - Path to project directory
 * @param {string} deploymentId - Deployment identifier
 * @returns {Promise<Object>} Project configuration
 */
async function validateAnchorProject(projectPath, deploymentId) {
  logger.deployment(deploymentId, 'info', 'Validating Anchor project', { projectPath });
  
  try {
    // Check for Anchor.toml
    const anchorTomlPath = path.join(projectPath, 'Anchor.toml');
    
    if (!fs.existsSync(anchorTomlPath)) {
      throw new InvalidProjectError(
        'Not an Anchor project: Anchor.toml not found',
        { path: projectPath }
      );
    }
    
    // Check for programs directory
    const programsPath = path.join(projectPath, 'programs');
    
    if (!fs.existsSync(programsPath)) {
      throw new InvalidProjectError(
        'Not an Anchor project: programs directory not found',
        { path: projectPath }
      );
    }
    
    // Parse Anchor.toml
    const config = parseAnchorToml(anchorTomlPath);
    
    logger.deployment(deploymentId, 'info', 'Anchor project validated', { 
      projectPath,
      programs: config.programs
    });
    
    return config;
  } catch (error) {
    logger.deployment(deploymentId, 'error', 'Invalid Anchor project', { 
      error: error.message,
      projectPath 
    });
    
    if (error instanceof InvalidProjectError) {
      throw error;
    }
    
    throw new InvalidProjectError('Failed to validate Anchor project', error.message);
  }
}

/**
 * Parse Anchor.toml configuration file
 * @param {string} tomlPath - Path to Anchor.toml
 * @returns {Object} Parsed configuration
 */
function parseAnchorToml(tomlPath) {
  try {
    const content = fs.readFileSync(tomlPath, 'utf8');
    
    // Basic parsing (in production, use a TOML parser library)
    const config = {
      programs: [],
      provider: {},
      scripts: {},
      test: {}
    };
    
    // Extract program names from [programs.localnet] or [programs.devnet] section
    const programsMatch = content.match(/\[programs\.(localnet|devnet|mainnet)\]([\s\S]*?)(?=\[|$)/);
    if (programsMatch) {
      const programsSection = programsMatch[2];
      const programLines = programsSection.match(/(\w+)\s*=\s*"([^"]+)"/g);
      
      if (programLines) {
        programLines.forEach(line => {
          const match = line.match(/(\w+)\s*=\s*"([^"]+)"/);
          if (match) {
            config.programs.push({
              name: match[1],
              id: match[2]
            });
          }
        });
      }
    }
    
    return config;
  } catch (error) {
    logger.error('Failed to parse Anchor.toml', { error: error.message, path: tomlPath });
    throw new Error(`Failed to parse Anchor.toml: ${error.message}`);
  }
}

/**
 * Cleanup temporary directory
 * @param {string} dirPath - Directory to cleanup
 * @param {string} deploymentId - Deployment identifier (optional)
 */
async function cleanupDirectory(dirPath, deploymentId = null) {
  const logFn = deploymentId 
    ? (level, msg, meta) => logger.deployment(deploymentId, level, msg, meta)
    : (level, msg, meta) => logger[level](msg, meta);
  
  logFn('info', 'Cleaning up directory', { path: dirPath });
  
  try {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
      logFn('info', 'Directory cleaned up successfully', { path: dirPath });
    }
  } catch (error) {
    logFn('warn', 'Failed to cleanup directory', { 
      error: error.message,
      path: dirPath 
    });
    // Don't throw - cleanup is best effort
  }
}

/**
 * Cleanup old temporary directories (older than 24 hours)
 */
async function cleanupOldDirectories() {
  logger.info('Cleaning up old temporary directories');
  
  try {
    if (!fs.existsSync(TEMP_DIR_PATH)) {
      return;
    }
    
    const items = fs.readdirSync(TEMP_DIR_PATH);
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    let cleaned = 0;
    
    for (const item of items) {
      const itemPath = path.join(TEMP_DIR_PATH, item);
      const stats = fs.statSync(itemPath);
      
      if (stats.isDirectory() && (now - stats.mtimeMs) > maxAge) {
        await cleanupDirectory(itemPath);
        cleaned++;
      }
    }
    
    logger.info('Old directories cleaned up', { count: cleaned });
  } catch (error) {
    logger.warn('Failed to cleanup old directories', { error: error.message });
  }
}

/**
 * Check if directory exists
 * @param {string} dirPath - Directory path
 * @returns {boolean} True if exists
 */
function directoryExists(dirPath) {
  return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
}

/**
 * List files in directory
 * @param {string} dirPath - Directory path
 * @returns {Array<string>} List of files
 */
function listFiles(dirPath) {
  try {
    return fs.readdirSync(dirPath);
  } catch (error) {
    logger.error('Failed to list files', { error: error.message, path: dirPath });
    return [];
  }
}

module.exports = {
  generateDeploymentId,
  cloneRepository,
  validateAnchorProject,
  parseAnchorToml,
  cleanupDirectory,
  cleanupOldDirectories,
  directoryExists,
  listFiles,
  ensureTempDirectory
};

