/**
 * Process Health Monitoring
 *
 * Centralized system for tracking processes, detecting zombies,
 * managing cleanup, and monitoring system health.
 */

// Export types
export type * from './types.js';
export { DEFAULT_MONITORING_CONFIG } from './types.js';

// Export process registry
export {
  processRegistry,
  registerProcess,
  updateProcessStatus,
  markProcessZombie,
  getProcess,
  getAllProcesses,
  getRunningProcesses,
  getZombieProcesses,
  getProcessStats,
  getSpawnRate,
} from './process-registry.js';

// Export zombie detector
export {
  zombieDetector,
  startZombieDetection,
  stopZombieDetection,
  scanForZombies,
  getZombieHistory,
  getZombieCount,
  onZombieDetected,
} from './zombie-detector.js';

// Export cleanup manager
export {
  cleanupManager,
  registerCleanupHandler,
  unregisterCleanupHandler,
  initiateCleanup,
  forceCleanup,
  getCleanupHandlers,
  isShutdownInProgress,
} from './cleanup-manager.js';

// Export health monitor
export { getHealthMetrics, getHealthStatus } from './health-monitor.js';

// Export alert system
export {
  alertManager,
  sendAlert,
  sendAlerts,
  getAlertStats,
  setAlertChannels,
} from './alerts.js';
