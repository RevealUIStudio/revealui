/**
 * Optimized Database Connection Pool
 *
 * Configured for high performance and reliability
 */

import { getSSLConfig } from '@revealui/utils/database';
import { logger } from '@revealui/utils/logger';
import { Pool, type PoolClient, type PoolConfig } from 'pg';

// Extend PoolClient to include processID which exists at runtime but not in types
interface PoolClientWithPID extends PoolClient {
  processID?: number;
}

/**
 * Get SSL configuration based on environment
 */
function getPoolSSLConfig(): PoolConfig['ssl'] {
  // If DATABASE_URL is available, use it to determine SSL config
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (databaseUrl) {
    return getSSLConfig(databaseUrl);
  }

  // Fallback to legacy DATABASE_SSL environment variable
  return process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : false;
}

/**
 * Connection pool configuration optimized for performance
 *
 * Validation is deferred to first pool usage (getPool) to avoid crashing
 * modules that transitively import this file without needing the pool.
 */
function assertProductionConfig(): void {
  if (
    process.env.NODE_ENV === 'production' &&
    !process.env.DATABASE_HOST &&
    !process.env.DATABASE_URL &&
    !process.env.POSTGRES_URL
  ) {
    throw new Error('DATABASE_HOST (or DATABASE_URL / POSTGRES_URL) must be set in production');
  }
}

const poolConfig: PoolConfig = {
  // Connection details
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,

  // SSL configuration (auto-detected from connection string if available)
  ssl: getPoolSSLConfig(),

  // ===========================================================================
  // CONNECTION POOL SETTINGS
  // ===========================================================================

  // Maximum number of clients in the pool
  // Higher for high-traffic applications
  max: parseInt(process.env.DATABASE_POOL_MAX || '20', 10),

  // Minimum number of clients in the pool
  // Keeps connections warm
  min: parseInt(process.env.DATABASE_POOL_MIN || '5', 10),

  // Maximum time (ms) a client can be idle before being closed
  // Lower value = more aggressive cleanup
  idleTimeoutMillis: parseInt(process.env.DATABASE_IDLE_TIMEOUT || '30000', 10), // 30 seconds

  // Maximum time (ms) to wait for a connection
  // Fail fast if pool is exhausted
  connectionTimeoutMillis: parseInt(process.env.DATABASE_CONNECTION_TIMEOUT || '5000', 10), // 5 seconds

  // ===========================================================================
  // QUERY SETTINGS
  // ===========================================================================

  // Maximum execution time for queries (PostgreSQL setting)
  // Prevents long-running queries from blocking
  statement_timeout: parseInt(process.env.DATABASE_STATEMENT_TIMEOUT || '10000', 10), // 10 seconds

  // Maximum execution time for queries (Node.js setting)
  query_timeout: parseInt(process.env.DATABASE_QUERY_TIMEOUT || '10000', 10), // 10 seconds

  // ===========================================================================
  // PERFORMANCE SETTINGS
  // ===========================================================================

  // Allow the pool to close when all clients are idle
  // Good for serverless/lambda environments
  allowExitOnIdle: process.env.NODE_ENV !== 'production',

  // Application name (shows in pg_stat_activity)
  application_name: process.env.APP_NAME || 'revealui',
};

/**
 * Create connection pool lazily.
 *
 * assertProductionConfig() is called when getPool() is first invoked,
 * not at module-parse time, so tree-shaking and type-only imports don't crash.
 */
let _pool: Pool | null = null;

export function getPool(): Pool {
  if (!_pool) {
    assertProductionConfig();
    _pool = new Pool(poolConfig);
    _pool.on('error', onPoolError);
    _pool.on('connect', onPoolConnect);
    _pool.on('acquire', onPoolAcquire);
    _pool.on('remove', onPoolRemove);
    registerShutdown();
  }
  return _pool;
}

// ===========================================================================
// ERROR HANDLING
// ===========================================================================

function onPoolError(err: Error) {
  logger.error(
    'Unexpected error on idle database client',
    err instanceof Error ? err : new Error(String(err)),
  );
}

function onPoolConnect(client: PoolClient) {
  const pid = (client as PoolClientWithPID).processID;
  logger.info(`Database connection established (PID: ${pid})`);

  void (async () => {
    try {
      // Set timezone
      await client.query("SET timezone TO 'UTC'");

      // Set statement timeout (parameterized to prevent injection)
      await client.query('SET statement_timeout TO $1', [poolConfig.statement_timeout || 10000]);

      // Enable query statistics
      await client.query('SET track_io_timing = on');
    } catch (error) {
      logger.error(
        'Error initializing database client',
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  })();
}

function onPoolAcquire(client: PoolClient) {
  const pid = (client as PoolClientWithPID).processID;
  logger.debug(`Database client acquired (PID: ${pid})`);
}

function onPoolRemove(client: PoolClient) {
  const pid = (client as PoolClientWithPID).processID;
  logger.info(`Database client removed (PID: ${pid})`);
}

// ===========================================================================
// GRACEFUL SHUTDOWN
// ===========================================================================

async function gracefulShutdown(signal: string) {
  if (!_pool) return;
  logger.info('Closing database pool', { signal });

  try {
    await _pool.end();
    logger.info('Database pool closed successfully');
  } catch (error) {
    logger.error(
      'Error closing database pool',
      error instanceof Error ? error : new Error(String(error)),
    );
  }
}

let _shutdownRegistered = false;
function registerShutdown() {
  if (_shutdownRegistered) return;
  _shutdownRegistered = true;
  process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
}

// ===========================================================================
// HEALTH CHECK
// ===========================================================================

export async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  stats: {
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  };
}> {
  const p = getPool();
  try {
    // Test connection
    const client = await p.connect();
    await client.query('SELECT 1');
    client.release();

    // Get pool stats
    const stats = {
      totalCount: p.totalCount,
      idleCount: p.idleCount,
      waitingCount: p.waitingCount,
    };

    return {
      healthy: true,
      stats,
    };
  } catch (error) {
    logger.error(
      'Database health check failed',
      error instanceof Error ? error : new Error(String(error)),
    );
    return {
      healthy: false,
      stats: {
        totalCount: p.totalCount,
        idleCount: p.idleCount,
        waitingCount: p.waitingCount,
      },
    };
  }
}

// ===========================================================================
// POOL MONITORING
// ===========================================================================

export function getPoolStats(): {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
  maxConnections: number | undefined;
  minConnections: number | undefined;
  utilization: number;
} {
  const p = getPool();
  return {
    totalCount: p.totalCount, // Total clients
    idleCount: p.idleCount, // Idle clients
    waitingCount: p.waitingCount, // Waiting requests
    maxConnections: poolConfig.max,
    minConnections: poolConfig.min,
    utilization: ((p.totalCount - p.idleCount) / (poolConfig.max || 20)) * 100,
  };
}

/**
 * Log pool stats periodically
 */
export function startPoolMonitoring(intervalMs: number = 60000): ReturnType<typeof setInterval> {
  return setInterval(() => {
    const stats = getPoolStats();
    logger.info('Database pool stats', {
      ...stats,
      utilizationPercent: `${stats.utilization.toFixed(1)}%`,
      timestamp: new Date().toISOString(),
    });

    // Warn if pool is near capacity
    if (stats.utilization > 80) {
      logger.warn('Database pool utilization high', { utilization: stats.utilization });
    }

    // Warn if many requests are waiting
    if (stats.waitingCount > 5) {
      logger.warn('Many requests waiting for database connection', {
        waitingCount: stats.waitingCount,
      });
    }
  }, intervalMs);
}

// ===========================================================================
// CONNECTION WARMUP
// ===========================================================================

/**
 * Pre-warm the connection pool
 */
export async function warmupPool(): Promise<void> {
  logger.info('Warming up database pool');

  const warmupConnections = Math.min(poolConfig.min || 5, poolConfig.max || 20);
  const clients = [];
  const p = getPool();

  try {
    // Acquire minimum connections
    for (let i = 0; i < warmupConnections; i++) {
      const client = await p.connect();
      clients.push(client);
    }

    logger.info(`Warmed up ${warmupConnections} database connections`);

    // Release all clients
    for (const client of clients) {
      client.release();
    }
  } catch (error) {
    logger.error(
      'Error warming up pool',
      error instanceof Error ? error : new Error(String(error)),
    );

    // Release any acquired clients
    for (const client of clients) {
      client.release();
    }

    throw error;
  }
}
