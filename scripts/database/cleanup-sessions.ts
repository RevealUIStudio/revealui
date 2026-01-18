/**
 * Session Cleanup Job
 *
 * Removes expired sessions from the database.
 * Run this daily via cron job or scheduled task.
 */

import { getClient } from '@revealui/db/client'
import { sessions } from '@revealui/db/schema'
import { lt } from 'drizzle-orm'

async function cleanupExpiredSessions() {
  try {
    const db = getClient()
    const now = new Date()

    // Delete expired sessions
    const result = await db
      .delete(sessions)
      .where(lt(sessions.expiresAt, now))

    console.log(`Cleaned up ${result.rowCount || 0} expired sessions`)
    return result.rowCount || 0
  } catch (error) {
    console.error('Error cleaning up sessions:', error)
    throw error
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupExpiredSessions()
    .then((count) => {
      console.log(`✅ Cleanup complete: ${count} sessions removed`)
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Cleanup failed:', error)
      process.exit(1)
    })
}

export { cleanupExpiredSessions }
