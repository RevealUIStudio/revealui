/**
 * Agent task quota middleware (Track B — metered billing).
 *
 * For authenticated users:
 *   - Looks up current billing cycle row in agent_task_usage
 *   - Returns 429 if count >= tier quota
 *   - Atomically increments count before passing through
 *
 * For unauthenticated requests: passes through (feature gate handles auth separately).
 * For enterprise (Forge) tier: increments for metering but never blocks.
 */

import { getMaxAgentTasks } from '@revealui/core/license'
import { getClient } from '@revealui/db'
import { agentTaskUsage } from '@revealui/db/schema'
import { and, eq, sql } from 'drizzle-orm'
import type { Context, Next } from 'hono'

interface UserContext {
  id: string
  email: string | null
  name: string
  role: string
}

/** Returns the UTC timestamp for the start of the current calendar month. */
function cycleStart(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

export async function requireTaskQuota(
  c: Context<{ Variables: { user: UserContext | undefined } }>,
  next: Next,
): Promise<Response | void> {
  const user = c.get('user')
  if (!user) {
    // No auth — feature gate already handles this; just pass through
    return next()
  }

  const quota = getMaxAgentTasks()
  const db = getClient()
  const cycle = cycleStart()

  if (quota === Infinity) {
    // Enterprise/Forge: increment for metering, never block
    void db
      .insert(agentTaskUsage)
      .values({ userId: user.id, cycleStart: cycle, count: 1, overage: 0 })
      .onConflictDoUpdate({
        target: [agentTaskUsage.userId, agentTaskUsage.cycleStart],
        set: { count: sql`${agentTaskUsage.count} + 1`, updatedAt: new Date() },
      })
      .catch(() => {
        // Non-fatal
      })
    return next()
  }

  // Fetch current count for this billing cycle
  const [row] = await db
    .select({ count: agentTaskUsage.count })
    .from(agentTaskUsage)
    .where(and(eq(agentTaskUsage.userId, user.id), eq(agentTaskUsage.cycleStart, cycle)))
    .limit(1)

  const current = row?.count ?? 0

  if (current >= quota) {
    // Track overage for billing reports (fire-and-forget — does not block the 429)
    void db
      .insert(agentTaskUsage)
      .values({ userId: user.id, cycleStart: cycle, count: current, overage: 1 })
      .onConflictDoUpdate({
        target: [agentTaskUsage.userId, agentTaskUsage.cycleStart],
        set: { overage: sql`${agentTaskUsage.overage} + 1`, updatedAt: new Date() },
      })
      .catch(() => {
        // Non-fatal
      })

    return c.json(
      {
        error: 'Agent task quota exceeded for this billing cycle.',
        used: current,
        quota,
        resetAt: new Date(
          Date.UTC(cycle.getUTCFullYear(), cycle.getUTCMonth() + 1, 1),
        ).toISOString(),
      },
      429,
    )
  }

  // Increment atomically (fire-and-forget — task proceeds regardless of DB write result)
  void db
    .insert(agentTaskUsage)
    .values({ userId: user.id, cycleStart: cycle, count: 1, overage: 0 })
    .onConflictDoUpdate({
      target: [agentTaskUsage.userId, agentTaskUsage.cycleStart],
      set: { count: sql`${agentTaskUsage.count} + 1`, updatedAt: new Date() },
    })
    .catch(() => {
      // Non-fatal — task proceeds
    })

  return next()
}
