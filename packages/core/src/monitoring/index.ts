/**
 * Process Health Monitoring
 *
 * Centralized system for tracking processes, detecting zombies,
 * managing cleanup, and monitoring system health.
 */

// Export alert system
export {
  alertManager,
  getAlertStats,
  sendAlert,
  sendAlerts,
  setAlertChannels,
} from './alerts.js'
// Export cleanup manager
export {
  cleanupManager,
  forceCleanup,
  getCleanupHandlers,
  initiateCleanup,
  isShutdownInProgress,
  registerCleanupHandler,
  unregisterCleanupHandler,
} from './cleanup-manager.js'
// Export health monitor
export { getHealthMetrics, getHealthStatus } from './health-monitor.js'
// Export process registry
export {
  getAllProcesses,
  getProcess,
  getProcessStats,
  getRunningProcesses,
  getSpawnRate,
  getZombieProcesses,
  markProcessZombie,
  processRegistry,
  registerProcess,
  updateProcessStatus,
} from './process-registry.js'
// Export types
export type * from './types.js'
export { DEFAULT_MONITORING_CONFIG } from './types.js'
// Export zombie detector
export {
  getZombieCount,
  getZombieHistory,
  onZombieDetected,
  scanForZombies,
  startZombieDetection,
  stopZombieDetection,
  zombieDetector,
} from './zombie-detector.js'
