/**
 * Process Health Monitoring
 *
 * Centralized system for tracking processes, detecting zombies,
 * managing cleanup, and monitoring system health.
 */

// Export types
export type * from './types';
export { DEFAULT_MONITORING_CONFIG } from './types';

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
} from './process-registry';

// Export zombie detector
export {
  zombieDetector,
  startZombieDetection,
  stopZombieDetection,
  scanForZombies,
  getZombieHistory,
  getZombieCount,
  onZombieDetected,
} from './zombie-detector';

// Export cleanup manager
export {
  cleanupManager,
  registerCleanupHandler,
  unregisterCleanupHandler,
  initiateCleanup,
  forceCleanup,
  getCleanupHandlers,
  isShutdownInProgress,
} from './cleanup-manager';

// Export health monitor
export { getHealthMetrics, getHealthStatus } from './health-monitor';

// Export alert system
export {
  alertManager,
  sendAlert,
  sendAlerts,
  getAlertStats,
  setAlertChannels,
} from './alerts';
