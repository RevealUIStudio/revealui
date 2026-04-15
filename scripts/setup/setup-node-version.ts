#!/usr/bin/env tsx

/**
 * Node Version Setup Script
 * Ensures the correct Node.js version is being used
 *
 * @dependencies
 * - scripts/lib/errors.ts - ErrorCode enum for exit codes
 * - scripts/lib/logger.ts - Logger utility
 * - scripts/lib/paths.ts - Project root utilities
 * - node:child_process - Process execution (execSync)
 *
 * @requires
 * - External: node, nvm (optional)
 * - File: .nvmrc (optional)
 *
 * Usage:
 *   pnpm setup:node
 *   pnpm tsx scripts/setup/setup-node-version.ts
 */

import { execSync } from 'node:child_process';
import { ErrorCode } from '@revealui/scripts/errors.js';
import { createLogger } from '@revealui/scripts/logger.js';
import { getProjectRoot } from '@revealui/scripts/paths.js';

const logger = createLogger();

async function setupNodeVersion() {
  try {
    const projectRoot = await getProjectRoot(import.meta.url);
    logger.header('Node Version Setup');

    // Check current Node version
    const currentVersion = execSync('node --version', {
      encoding: 'utf8',
    }).trim();
    logger.info(`Current Node version: ${currentVersion}`);

    // Check required version from package.json
    const packageJson = require(`${projectRoot}/package.json`);
    const requiredVersion = packageJson.engines?.node || '>=24.13.0';
    logger.info(`Required Node version: ${requiredVersion}`);

    // Check if nvm is available
    try {
      execSync('nvm --version', { stdio: 'pipe' });
      logger.info('✅ nvm is available');

      // Check if .nvmrc exists
      const nvmrcPath = `${projectRoot}/.nvmrc`;
      const fs = require('node:fs');
      if (fs.existsSync(nvmrcPath)) {
        const nvmrcVersion = fs.readFileSync(nvmrcPath, 'utf8').trim();
        logger.info(`✅ .nvmrc found: ${nvmrcVersion}`);

        // Validate version format before passing to shell (prevent injection via crafted .nvmrc)
        if (!/^v?\d+(\.\d+)*$/.test(nvmrcVersion)) {
          logger.warn(`Invalid .nvmrc version format: ${nvmrcVersion}`);
          return;
        }

        // Try to use the version specified in .nvmrc
        try {
          execSync(['nvm', 'use', nvmrcVersion].join(' '), { stdio: 'inherit' });
          const newVersion = execSync('node --version', {
            encoding: 'utf8',
          }).trim();
          logger.success(`Switched to Node ${newVersion}`);
        } catch (_error) {
          logger.warn(`Could not switch to Node ${nvmrcVersion} using nvm`);
          logger.warn('Make sure the version is installed: nvm install 24.13.0');
        }
      } else {
        logger.warn('No .nvmrc file found');
      }
    } catch (_error) {
      logger.warn('nvm not found in PATH');
      logger.info('Install nvm: https://github.com/nvm-sh/nvm');
    }

    // Verify Node version meets requirements
    const versionMatch = currentVersion.match(/v(\d+)\.(\d+)\.(\d+)/);
    if (versionMatch) {
      const [major, minor, patch] = versionMatch.slice(1).map(Number);
      const current = major * 10000 + minor * 100 + patch;
      const required = 24 * 10000 + 13 * 100 + 0; // 24.13.0

      if (current >= required) {
        logger.success(`✅ Node version ${currentVersion} meets requirements`);
      } else {
        logger.error(`❌ Node version ${currentVersion} is too old`);
        logger.error(`Required: Node.js >=24.13.0`);
        logger.error('Please upgrade Node.js or use nvm to switch versions');
        process.exit(ErrorCode.CONFIG_ERROR);
      }
    }

    // Check pnpm version
    try {
      const pnpmVersion = execSync('pnpm --version', {
        encoding: 'utf8',
      }).trim();
      logger.info(`pnpm version: ${pnpmVersion}`);
    } catch (_error) {
      logger.warn('pnpm not found');
    }
  } catch (error) {
    logger.error(`Node version setup failed: ${error}`);
    process.exit(ErrorCode.EXECUTION_ERROR);
  }
}

setupNodeVersion();
