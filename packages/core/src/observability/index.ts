/**
 * Observability Module
 *
 * Centralized exports for observability functionality including logging,
 * metrics, alerts, and health checks.
 *
 * In-memory `TracingSystem` was removed (fleet-redundancy C11, 2026-07-23):
 * unmounted, tests-only, zero app consumers. Prefer OpenTelemetry when
 * distributed tracing is wired.
 */

export * from './alerts.js';
export * from './cron-failure-alert.js';
export * from './health-check.js';
export * from './logger.js';
export * from './metrics.js';
