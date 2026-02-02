/**
 * Optimized Database Connection Pool
 *
 * Configured for high performance and reliability
 */

import { Pool, PoolConfig } from 'pg'

/**
 * Connection pool configuration optimized for performance
 */
const poolConfig: PoolConfig = {
  // Connection details
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,

  // SSL configuration
  ssl: process.env.DATABASE_SSL === 'true'
    ? {
        rejectUnauthorized: false, // For development
      }
    : false,

  // ===========================================================================
  // CONNECTION POOL SETTINGS
  // ===========================================================================

  // Maximum number of clients in the pool
  // Higher for high-traffic applications
  max: parseInt(process.env.DATABASE_POOL_MAX || '20'),

  // Minimum number of clients in the pool
  // Keeps connections warm
  min: parseInt(process.env.DATABASE_POOL_MIN || '5'),

  // Maximum time (ms) a client can be idle before being closed
  // Lower value = more aggressive cleanup
  idleTimeoutMillis: parseInt(process.env.DATABASE_IDLE_TIMEOUT || '30000'), // 30 seconds

  // Maximum time (ms) to wait for a connection
  // Fail fast if pool is exhausted
  connectionTimeoutMillis: parseInt(process.env.DATABASE_CONNECTION_TIMEOUT || '5000'), // 5 seconds

  // ===========================================================================
  // QUERY SETTINGS
  // ===========================================================================

  // Maximum execution time for queries (PostgreSQL setting)
  // Prevents long-running queries from blocking
  statement_timeout: parseInt(process.env.DATABASE_STATEMENT_TIMEOUT || '10000'), // 10 seconds

  // Maximum execution time for queries (Node.js setting)
  query_timeout: parseInt(process.env.DATABASE_QUERY_TIMEOUT || '10000'), // 10 seconds

  // ===========================================================================
  // PERFORMANCE SETTINGS
  // ===========================================================================

  // Allow the pool to close when all clients are idle
  // Good for serverless/lambda environments
  allowExitOnIdle: process.env.NODE_ENV !== 'production',

  // Application name (shows in pg_stat_activity)
  application_name: process.env.APP_NAME || 'revealui',
}

/**
 * Create connection pool
 */
export const pool = new Pool(poolConfig)

// ===========================================================================
// ERROR HANDLING
// ===========================================================================

pool.on('error', (err, _client) => {
  console.error('Unexpected error on idle database client:', err)
})

pool.on('connect', async (client) => {
  const pid = (client as any).processID
  console.log(`Database connection established (PID: ${pid})`)

  try {
    // Set timezone
    await client.query("SET timezone TO 'UTC'")

    // Set statement timeout
    await client.query(`SET statement_timeout TO ${poolConfig.statement_timeout || 10000}`)

    // Enable query statistics
    await client.query('SET track_io_timing = on')
  } catch (error) {
    console.error('Error initializing database client:', error)
  }
})

pool.on('acquire', (client) => {
  const pid = (client as any).processID
  console.debug(`Database client acquired (PID: ${pid})`)
})

pool.on('remove', (client) => {
  const pid = (client as any).processID
  console.log(`Database client removed (PID: ${pid})`)
})

// ===========================================================================
// GRACEFUL SHUTDOWN
// ===========================================================================

async function gracefulShutdown(signal: string) {
  console.log(`Received ${signal}, closing database pool...`)

  try {
    await pool.end()
    console.log('Database pool closed successfully')
    process.exit(0)
  } catch (error) {
    console.error('Error closing database pool:', error)
    process.exit(1)
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

// ===========================================================================
// HEALTH CHECK
// ===========================================================================

export async function checkDatabaseHealth(): Promise<{
  healthy: boolean
  stats: {
    totalCount: number
    idleCount: number
    waitingCount: number
  }
}> {
  try {
    // Test connection
    const client = await pool.connect()
    await client.query('SELECT 1')
    client.release()

    // Get pool stats
    const stats = {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
    }

    return {
      healthy: true,
      stats,
    }
  } catch (error) {
    console.error('Database health check failed:', error)
    return {
      healthy: false,
      stats: {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount,
      },
    }
  }
}

// ===========================================================================
// POOL MONITORING
// ===========================================================================

export function getPoolStats() {
  return {
    totalCount: pool.totalCount, // Total clients
    idleCount: pool.idleCount, // Idle clients
    waitingCount: pool.waitingCount, // Waiting requests
    maxConnections: poolConfig.max,
    minConnections: poolConfig.min,
    utilization: ((pool.totalCount - pool.idleCount) / (poolConfig.max || 20)) * 100,
  }
}

/**
 * Log pool stats periodically
 */
export function startPoolMonitoring(intervalMs: number = 60000) {
  setInterval(() => {
    const stats = getPoolStats()
    console.log('Database pool stats:', {
      ...stats,
      utilizationPercent: `${stats.utilization.toFixed(1)}%`,
      timestamp: new Date().toISOString(),
    })

    // Warn if pool is near capacity
    if (stats.utilization > 80) {
      console.warn('Database pool utilization high:', stats.utilization)
    }

    // Warn if many requests are waiting
    if (stats.waitingCount > 5) {
      console.warn('Many requests waiting for database connection:', stats.waitingCount)
    }
  }, intervalMs)
}

// ===========================================================================
// CONNECTION WARMUP
// ===========================================================================

/**
 * Pre-warm the connection pool
 */
export async function warmupPool() {
  console.log('Warming up database pool...')

  const warmupConnections = Math.min(poolConfig.min || 5, poolConfig.max || 20)
  const clients = []

  try {
    // Acquire minimum connections
    for (let i = 0; i < warmupConnections; i++) {
      const client = await pool.connect()
      clients.push(client)
    }

    console.log(`Warmed up ${warmupConnections} database connections`)

    // Release all clients
    for (const client of clients) {
      client.release()
    }
  } catch (error) {
    console.error('Error warming up pool:', error)

    // Release any acquired clients
    for (const client of clients) {
      client.release()
    }

    throw error
  }
}

// ===========================================================================
// EXPORTS
// ===========================================================================

export default pool
