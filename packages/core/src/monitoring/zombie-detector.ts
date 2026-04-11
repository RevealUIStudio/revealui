/**
 * Zombie Process Detector
 *
 * Periodically scans for defunct (zombie) processes and attempts automatic cleanup.
 * Zombie processes are dead processes that haven't been reaped by their parent.
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { logger } from '../utils/logger-server.js';
import { processRegistry } from './process-registry.js';
import type { ZombieProcess } from './types.js';
import { DEFAULT_MONITORING_CONFIG } from './types.js';

const execAsync = promisify(exec);

/**
 * Zombie detector class
 */
class ZombieDetector {
  private interval: NodeJS.Timeout | null = null;
  private zombieHistory: ZombieProcess[] = [];
  private enabled: boolean = DEFAULT_MONITORING_CONFIG.enabled;
  private detectionInterval: number = DEFAULT_MONITORING_CONFIG.zombieDetectionInterval;
  private maxHistory: number = DEFAULT_MONITORING_CONFIG.maxZombieHistory;
  private onZombieDetected?: (zombie: ZombieProcess) => void;

  /**
   * Start zombie detection
   */
  start(): void {
    if (!this.enabled || this.interval) return;

    // Skip on serverless environments where ps is unavailable or meaningless
    if (process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME) {
      logger.debug('Zombie detection skipped  -  serverless environment detected');
      return;
    }

    logger.info('Starting zombie process detector', {
      interval: this.detectionInterval,
    });

    this.interval = setInterval(() => {
      this.scan().catch((error) => {
        logger.error('Zombie detection scan failed', { error });
      });
    }, this.detectionInterval);

    // Prevent interval from keeping process alive
    this.interval.unref();
  }

  /**
   * Stop zombie detection
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      logger.info('Stopped zombie process detector');
    }
  }

  /**
   * Perform a single scan for zombie processes
   */
  async scan(): Promise<ZombieProcess[]> {
    if (!this.enabled) return [];

    try {
      // Use ps to find defunct processes
      // Format: PID PPID COMMAND STATE
      const { stdout } = await execAsync("ps axo pid,ppid,comm,state | grep -E ' (Z|z)' || true");

      const zombies: ZombieProcess[] = [];

      if (stdout.trim()) {
        const lines = stdout.trim().split('\n');

        for (const line of lines) {
          const match = line.trim().match(/^(\d+)\s+(\d+)\s+(\S+)\s+[Zz]/);
          if (match?.[1] && match[2] && match[3]) {
            const pid = parseInt(match[1], 10);
            const ppid = parseInt(match[2], 10);
            const command = match[3];

            const zombie: ZombieProcess = {
              pid,
              ppid,
              command,
              detectedAt: Date.now(),
              trackedProcess: processRegistry.get(pid),
            };

            zombies.push(zombie);

            // Mark in registry
            processRegistry.markZombie(pid);

            // Add to history
            this.addToHistory(zombie);

            // Log detection
            logger.warn('Zombie process detected', {
              pid,
              ppid,
              command,
            });

            // Attempt cleanup
            await this.attemptCleanup(zombie);

            // Notify callback
            if (this.onZombieDetected) {
              this.onZombieDetected(zombie);
            }
          }
        }
      }

      return zombies;
    } catch (error) {
      logger.error('Failed to scan for zombie processes', { error });
      return [];
    }
  }

  /**
   * Attempt to clean up a zombie process
   */
  private async attemptCleanup(zombie: ZombieProcess): Promise<boolean> {
    try {
      // Zombies can't be killed directly - need to signal parent to reap them
      // Try sending SIGCHLD to parent process
      logger.info('Attempting zombie cleanup by signaling parent', {
        zombie: zombie.pid,
        parent: zombie.ppid,
      });

      // Check if parent exists
      const { stdout: parentExists } = await execAsync(`ps -p ${zombie.ppid} -o pid= || true`);

      if (!parentExists.trim()) {
        logger.warn('Zombie parent process does not exist', {
          zombie: zombie.pid,
          parent: zombie.ppid,
        });
        return false;
      }

      // Send SIGCHLD to parent
      process.kill(zombie.ppid, 'SIGCHLD');

      // Wait a moment and check if zombie is gone
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const { stdout: zombieStillExists } = await execAsync(
        `ps -p ${zombie.pid} -o state= || true`,
      );

      if (!zombieStillExists.trim()) {
        logger.info('Zombie process successfully reaped', {
          pid: zombie.pid,
        });
        return true;
      }

      logger.warn('Zombie process persists after cleanup attempt', {
        pid: zombie.pid,
        ppid: zombie.ppid,
      });

      return false;
    } catch (error) {
      logger.error('Failed to cleanup zombie process', {
        zombie: zombie.pid,
        error,
      });
      return false;
    }
  }

  /**
   * Add zombie to history
   */
  private addToHistory(zombie: ZombieProcess): void {
    this.zombieHistory.unshift(zombie);

    // Trim history
    if (this.zombieHistory.length > this.maxHistory) {
      this.zombieHistory = this.zombieHistory.slice(0, this.maxHistory);
    }
  }

  /**
   * Get zombie history
   */
  getHistory(): ZombieProcess[] {
    return [...this.zombieHistory];
  }

  /**
   * Get current zombie count
   */
  getCount(): number {
    return processRegistry.getZombies().length;
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.zombieHistory = [];
  }

  /**
   * Set zombie detection callback
   */
  onZombie(callback: (zombie: ZombieProcess) => void): void {
    this.onZombieDetected = callback;
  }

  /**
   * Enable or disable detection
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;

    if (!enabled && this.interval) {
      this.stop();
    } else if (enabled && !this.interval) {
      this.start();
    }
  }

  /**
   * Check if detection is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Check if detector is running
   */
  isRunning(): boolean {
    return this.interval !== null;
  }
}

/**
 * Singleton instance
 */
export const zombieDetector = new ZombieDetector();

/**
 * Convenience functions
 */

export function startZombieDetection(): void {
  zombieDetector.start();
}

export function stopZombieDetection(): void {
  zombieDetector.stop();
}

export function scanForZombies(): Promise<ZombieProcess[]> {
  return zombieDetector.scan();
}

export function getZombieHistory(): ZombieProcess[] {
  return zombieDetector.getHistory();
}

export function getZombieCount(): number {
  return zombieDetector.getCount();
}

export function onZombieDetected(callback: (zombie: ZombieProcess) => void): void {
  zombieDetector.onZombie(callback);
}
