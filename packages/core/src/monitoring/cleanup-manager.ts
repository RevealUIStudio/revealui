'use server'

/**
 * Cleanup Manager
 *
 * Global cleanup handler registry and graceful shutdown coordination.
 * Ensures all resources are properly released when the process exits.
 */

import { logger } from '../utils/logger-server.js'
import type { CleanupHandler, CleanupRegistration } from './types.js'

/**
 * Cleanup manager class
 */
class CleanupManager {
  private handlers: Map<string, CleanupRegistration> = new Map()
  private isShuttingDown = false
  private shutdownTimeout = 30_000 // 30 seconds
  private signalHandlersRegistered = false

  /**
   * Register a cleanup handler
   */
  register(id: string, handler: CleanupHandler, description: string, priority = 0): void {
    if (this.handlers.has(id)) {
      logger.warn('Cleanup handler already registered', { id })
      return
    }

    this.handlers.set(id, {
      id,
      handler,
      priority,
      description,
    })

    logger.debug('Registered cleanup handler', { id, description, priority })

    // Register signal handlers on first handler registration
    if (!this.signalHandlersRegistered) {
      this.registerSignalHandlers()
    }
  }

  /**
   * Unregister a cleanup handler
   */
  unregister(id: string): void {
    if (this.handlers.delete(id)) {
      logger.debug('Unregistered cleanup handler', { id })
    }
  }

  /**
   * Execute all cleanup handlers
   */
  async cleanup(signal?: string): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('Cleanup already in progress')
      return
    }

    this.isShuttingDown = true

    logger.info('Starting graceful shutdown', {
      signal,
      handlers: this.handlers.size,
    })

    // Sort handlers by priority (highest first)
    const sortedHandlers = Array.from(this.handlers.values()).sort(
      (a, b) => b.priority - a.priority,
    )

    const results: Array<{ id: string; success: boolean; error?: unknown }> = []

    // Execute handlers with timeout
    const cleanupPromise = this.executeHandlers(sortedHandlers, results)

    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(() => {
        logger.error('Cleanup timeout exceeded, forcing shutdown', {
          timeout: this.shutdownTimeout,
        })
        resolve()
      }, this.shutdownTimeout)
    })

    await Promise.race([cleanupPromise, timeoutPromise])

    // Log results
    const successCount = results.filter((r) => r.success).length
    const failureCount = results.filter((r) => !r.success).length

    logger.info('Cleanup complete', {
      total: results.length,
      success: successCount,
      failures: failureCount,
    })

    if (failureCount > 0) {
      logger.error('Some cleanup handlers failed', {
        failures: results.filter((r) => !r.success),
      })
    }
  }

  /**
   * Execute cleanup handlers in sequence
   */
  private async executeHandlers(
    handlers: CleanupRegistration[],
    results: Array<{ id: string; success: boolean; error?: unknown }>,
  ): Promise<void> {
    for (const registration of handlers) {
      try {
        logger.debug('Executing cleanup handler', {
          id: registration.id,
          description: registration.description,
        })

        const handlerPromise = Promise.resolve(registration.handler())

        // Individual handler timeout (10 seconds)
        const handlerTimeout = new Promise<void>((_, reject) => {
          setTimeout(() => {
            reject(new Error('Handler timeout'))
          }, 10_000)
        })

        await Promise.race([handlerPromise, handlerTimeout])

        results.push({ id: registration.id, success: true })

        logger.debug('Cleanup handler completed', {
          id: registration.id,
        })
      } catch (error) {
        logger.error('Cleanup handler failed', {
          id: registration.id,
          error,
        })

        results.push({ id: registration.id, success: false, error })
      }
    }
  }

  /**
   * Register signal handlers for graceful shutdown
   */
  private registerSignalHandlers(): void {
    if (this.signalHandlersRegistered) return

    const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT', 'SIGHUP']

    for (const signal of signals) {
      process.on(signal, () => {
        logger.info('Received signal, initiating cleanup', { signal })

        this.cleanup(signal)
          .then(() => {
            logger.info('Cleanup successful, exiting', { signal })
            process.exit(0)
          })
          .catch((error) => {
            logger.error('Cleanup failed, forcing exit', { signal, error })
            process.exit(1)
          })
      })
    }

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception, initiating cleanup', { error })

      this.cleanup('uncaughtException')
        .then(() => {
          process.exit(1)
        })
        .catch(() => {
          process.exit(1)
        })
    })

    // Handle unhandled rejections
    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection, initiating cleanup', { reason })

      this.cleanup('unhandledRejection')
        .then(() => {
          process.exit(1)
        })
        .catch(() => {
          process.exit(1)
        })
    })

    this.signalHandlersRegistered = true
    logger.debug('Signal handlers registered', { signals })
  }

  /**
   * Force immediate cleanup (skip timeout)
   */
  async forceCleanup(): Promise<void> {
    const originalTimeout = this.shutdownTimeout
    this.shutdownTimeout = 0

    try {
      await this.cleanup('force')
    } finally {
      this.shutdownTimeout = originalTimeout
    }
  }

  /**
   * Get registered handlers
   */
  getHandlers(): CleanupRegistration[] {
    return Array.from(this.handlers.values())
  }

  /**
   * Check if shutdown is in progress
   */
  isShutdownInProgress(): boolean {
    return this.isShuttingDown
  }

  /**
   * Set shutdown timeout
   */
  setShutdownTimeout(ms: number): void {
    this.shutdownTimeout = ms
  }

  /**
   * Clear all handlers
   */
  clear(): void {
    this.handlers.clear()
    this.isShuttingDown = false
  }
}

/**
 * Singleton instance
 */
export const cleanupManager = new CleanupManager()

/**
 * Convenience functions
 */

export function registerCleanupHandler(
  id: string,
  handler: CleanupHandler,
  description: string,
  priority = 0,
): void {
  cleanupManager.register(id, handler, description, priority)
}

export function unregisterCleanupHandler(id: string): void {
  cleanupManager.unregister(id)
}

export function initiateCleanup(signal?: string): Promise<void> {
  return cleanupManager.cleanup(signal)
}

export function forceCleanup(): Promise<void> {
  return cleanupManager.forceCleanup()
}

export function getCleanupHandlers(): CleanupRegistration[] {
  return cleanupManager.getHandlers()
}

export function isShutdownInProgress(): boolean {
  return cleanupManager.isShutdownInProgress()
}
