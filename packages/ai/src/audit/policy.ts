/**
 * Audit Policy Engine
 *
 * Human-defined rules that evaluate audit entries and trigger alerts.
 * Policies are configured by humans, not agents. They define what
 * constitutes suspicious or dangerous behavior and what action to take.
 */

import type { AuditAlert, AuditEntry, AuditPolicy } from './types.js';

// ─── Policy Engine ──────────────────────────────────────────────────────────

export class AuditPolicyEngine {
  private policies: Map<string, AuditPolicy> = new Map();
  private alerts: AuditAlert[] = [];
  private alertCounter = 0;

  /**
   * Add a human-defined policy
   */
  addPolicy(policy: AuditPolicy): void {
    this.policies.set(policy.id, policy);
  }

  /**
   * Remove a policy by ID
   */
  removePolicy(policyId: string): void {
    this.policies.delete(policyId);
  }

  /**
   * Get all active policies
   */
  getPolicies(): AuditPolicy[] {
    return Array.from(this.policies.values());
  }

  /**
   * Evaluate an entry against all active policies.
   * Returns the IDs of violated policies and any alerts generated.
   */
  evaluate(
    entry: AuditEntry,
    recentHistory: AuditEntry[],
  ): {
    violations: string[];
    alerts: AuditAlert[];
    shouldHaltAgent: boolean;
    shouldHaltAll: boolean;
  } {
    const violations: string[] = [];
    const newAlerts: AuditAlert[] = [];
    let shouldHaltAgent = false;
    let shouldHaltAll = false;

    for (const policy of this.policies.values()) {
      if (!policy.enabled) continue;

      try {
        if (policy.condition(entry, recentHistory)) {
          violations.push(policy.id);

          const alert: AuditAlert = {
            id: `alert-${++this.alertCounter}`,
            policyId: policy.id,
            policyName: policy.name,
            triggeringEntryId: entry.id,
            agentId: entry.agentId,
            severity: policy.severity,
            action: policy.action,
            createdAt: new Date(),
            acknowledged: false,
          };

          newAlerts.push(alert);
          this.alerts.push(alert);

          if (policy.action === 'halt_agent') shouldHaltAgent = true;
          if (policy.action === 'halt_all') shouldHaltAll = true;
        }
      } catch {
        // Policy evaluation errors should never crash the system
      }
    }

    return { violations, alerts: newAlerts, shouldHaltAgent, shouldHaltAll };
  }

  /**
   * Get all alerts (newest first)
   */
  getAlerts(unacknowledgedOnly = false): AuditAlert[] {
    const result = unacknowledgedOnly ? this.alerts.filter((a) => !a.acknowledged) : this.alerts;

    return [...result].reverse();
  }

  /**
   * Acknowledge an alert (human action)
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (!alert) return false;

    alert.acknowledged = true;
    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgedAt = new Date();
    return true;
  }
}

// ─── Built-in Policies ──────────────────────────────────────────────────────

/**
 * Pre-built policies for common safety patterns.
 * Humans can use these as-is or as templates for custom policies.
 */
export const builtinPolicies = {
  /**
   * Alert when an agent exceeds a tool call rate limit
   */
  toolCallRateLimit(maxCallsPerMinute: number, createdBy: string): AuditPolicy {
    return {
      id: 'builtin:tool-call-rate-limit',
      name: 'Tool Call Rate Limit',
      description: `Alert when an agent exceeds ${maxCallsPerMinute} tool calls per minute`,
      severity: 'warn',
      action: 'alert',
      enabled: true,
      createdBy,
      createdAt: new Date(),
      condition: (entry, history) => {
        if (entry.eventType !== 'agent:tool:called') return false;
        const oneMinuteAgo = new Date(Date.now() - 60_000);
        const recentCalls = history.filter(
          (e) =>
            e.agentId === entry.agentId &&
            e.eventType === 'agent:tool:called' &&
            e.timestamp >= oneMinuteAgo,
        );
        return recentCalls.length >= maxCallsPerMinute;
      },
    };
  },

  /**
   * Halt agent that attempts to modify its own instructions
   */
  selfModificationBlock(createdBy: string): AuditPolicy {
    return {
      id: 'builtin:self-modification-block',
      name: 'Self-Modification Block',
      description: 'Halt any agent that attempts to modify its own instructions or specification',
      severity: 'critical',
      action: 'halt_agent',
      enabled: true,
      createdBy,
      createdAt: new Date(),
      condition: (entry) => {
        if (entry.eventType !== 'agent:tool:called') return false;
        const toolName = String(entry.payload.toolName ?? '');
        const args = String(entry.payload.arguments ?? '');
        return (
          toolName.includes('modify_spec') ||
          toolName.includes('update_instructions') ||
          args.includes('self_modify') ||
          args.includes('update_own_prompt')
        );
      },
    };
  },

  /**
   * Alert on consecutive task failures
   */
  consecutiveFailures(maxConsecutive: number, createdBy: string): AuditPolicy {
    return {
      id: 'builtin:consecutive-failures',
      name: 'Consecutive Failure Limit',
      description: `Alert when an agent fails ${maxConsecutive} consecutive tasks`,
      severity: 'warn',
      action: 'alert',
      enabled: true,
      createdBy,
      createdAt: new Date(),
      condition: (entry, history) => {
        if (entry.eventType !== 'agent:task:failed') return false;
        const agentHistory = history
          .filter(
            (e) =>
              e.agentId === entry.agentId &&
              (e.eventType === 'agent:task:completed' || e.eventType === 'agent:task:failed'),
          )
          .slice(-maxConsecutive);
        return (
          agentHistory.length >= maxConsecutive &&
          agentHistory.every((e) => e.eventType === 'agent:task:failed')
        );
      },
    };
  },

  /**
   * Emergency halt if any agent accesses denied tools
   */
  deniedToolAccess(createdBy: string): AuditPolicy {
    return {
      id: 'builtin:denied-tool-access',
      name: 'Denied Tool Access',
      description: 'Halt agent that attempts to use a denied tool',
      severity: 'critical',
      action: 'halt_agent',
      enabled: true,
      createdBy,
      createdAt: new Date(),
      condition: (entry) => {
        return entry.eventType === 'agent:tool:denied';
      },
    };
  },

  /**
   * Fleet-wide emergency stop on excessive memory writes
   */
  fleetMemoryFlood(maxWritesPerMinute: number, createdBy: string): AuditPolicy {
    return {
      id: 'builtin:fleet-memory-flood',
      name: 'Fleet Memory Flood Protection',
      description: `Halt all agents if total memory writes exceed ${maxWritesPerMinute}/min across fleet`,
      severity: 'critical',
      action: 'halt_all',
      enabled: true,
      createdBy,
      createdAt: new Date(),
      condition: (_entry, history) => {
        const oneMinuteAgo = new Date(Date.now() - 60_000);
        const recentWrites = history.filter(
          (e) => e.eventType === 'agent:memory:write' && e.timestamp >= oneMinuteAgo,
        );
        return recentWrites.length >= maxWritesPerMinute;
      },
    };
  },
} as const;
