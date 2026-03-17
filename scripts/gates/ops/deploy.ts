#!/usr/bin/env tsx

/**
 * Deployment Script for RevealUI Framework
 *
 * Builds and deploys the application to Vercel.
 *
 * Usage:
 *   pnpm tsx scripts/dev/deploy.ts
 *
 * @dependencies
 * - scripts/lib/errors.ts - ErrorCode enum for exit codes
 * - scripts/utils/base.ts - Base utilities (createLogger, getProjectRoot)
 * - dotenv - Environment variable loading (config)
 * - node:child_process - Command execution (spawn)
 *
 * @requires
 * - Environment: VERCEL_TOKEN or VERCEL_API_TOKEN (Vercel deployment authentication)
 * - External: vercel - Vercel CLI tool
 */

import { spawn } from 'node:child_process';
import { ErrorCode } from '@revealui/scripts/errors.js';
import { config } from 'dotenv';
import { createLogger, getProjectRoot } from '../../utils/base.ts';

const logger = createLogger();

// Load environment variables
config();

async function deploy() {
  try {
    await getProjectRoot(import.meta.url);
    logger.header('RevealUI Deployment');

    // Check for required environment variables for deployment
    const vercelToken = process.env.VERCEL_TOKEN || process.env.VERCEL_API_TOKEN;

    if (!vercelToken) {
      logger.error('VERCEL_TOKEN or VERCEL_API_TOKEN environment variable is required');
      logger.error('   Get your token from: https://vercel.com/account/tokens');
      logger.error('   Add it to your .env file as VERCEL_TOKEN=your_token_here\n');
      process.exit(ErrorCode.CONFIG_ERROR);
    }

    logger.success('Environment validation passed');
    logger.info(`   Vercel Token: ${vercelToken.substring(0, 8)}...`);
    logger.info('');

    // Build the project first
    logger.info('🔨 Building project...');
    const buildProcess = spawn('pnpm', ['build'], {
      stdio: 'inherit',
      env: process.env,
    });

    buildProcess.on('close', (code) => {
      if (code !== 0) {
        logger.error(`Build failed with exit code ${code}`);
        process.exit(ErrorCode.CONFIG_ERROR);
      }

      logger.success('Build completed successfully\n');

      // Now deploy to Vercel
      logger.info('📦 Deploying to Vercel...');
      const deployProcess = spawn('vercel', ['--prod', '--yes'], {
        stdio: 'inherit',
        env: {
          ...process.env,
          VERCEL_TOKEN: vercelToken,
        },
      });

      deployProcess.on('close', (deployCode) => {
        if (deployCode === 0) {
          logger.success('\n🎉 Deployment completed successfully!');
          logger.info('   Your app is now live on Vercel');
        } else {
          logger.error(`\n❌ Deployment failed with exit code ${deployCode}`);
          process.exit(ErrorCode.CONFIG_ERROR);
        }
      });

      deployProcess.on('error', (error) => {
        logger.error(`Failed to start Vercel deployment: ${error.message}`);
        process.exit(ErrorCode.CONFIG_ERROR);
      });
    });

    buildProcess.on('error', (error) => {
      logger.error(`Failed to start build process: ${error.message}`);
      process.exit(ErrorCode.CONFIG_ERROR);
    });
  } catch (error) {
    logger.error(`Deployment failed: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`);
    }
    process.exit(ErrorCode.EXECUTION_ERROR);
  }
}

/**
 * Main function
 */
async function main() {
  try {
    await deploy();
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(ErrorCode.EXECUTION_ERROR);
  }
}

main();
