/**
 * Audit Observer
 *
 * The central human-facing audit system. This is the ONLY component
 * that has full read/write access to the audit trail. Agents never
 * receive a reference to this object.
 *
 * Responsibilities:
 * - Receives events from agent emitters
 * - Stores entries in the append-only store
 * - Evaluates policies and generates alerts
 * - Tracks agent halt status
 * - Provides query interface for human review
 */

import { randomUUID } from 'node:crypto';
import { type AuditEmitHandler, type AuditEmitter, createAuditEmitter } from './emitter.js';
import { AuditPolicyEngine } from './policy.js';
import type { AuditStore } from './store.js';
import type {
  AuditAgentStatus,
  AuditAlert,
  AuditEntry,
  AuditEventType,
  AuditFilter,
  AuditPolicy,
  AuditSeverity,
} from './types.js';

// ─── Observer Configuration ─────────────────────────────────────────────────

export interface AuditObserverConfig {
  /** Audit store backend */
  store: AuditStore;
  /** Number of recent entries to keep in memory for policy evaluation */
  recentHistorySize?: number;
  /** Callback when an alert is generated */
  onAlert?: (alert: AuditAlert) => void;
  /** Callback when an agent is halted */
  onAgentHalted?: (agentId: string, reason: string) => void;
  /** Callback when the entire fleet is halted */
  onFleetHalted?: (reason: string) => void;
}

// ─── Audit Observer ─────────────────────────────────────────────────────────

export class AuditObserver {
  private store: AuditStore;
  private policyEngine: AuditPolicyEngine;
  private recentHistory: AuditEntry[] = [];
  private recentHistorySize: number;
  private agentStatus: Map<string, AuditAgentStatus> = new Map();
  private fleetHalted = false;
  private onAlert?: (alert: AuditAlert) => void;
  private onAgentHalted?: (agentId: string, reason: string) => void;
  private onFleetHalted?: (reason: string) => void;

  constructor(config: AuditObserverConfig) {
    this.store = config.store;
    this.policyEngine = new AuditPolicyEngine();
    this.recentHistorySize = config.recentHistorySize ?? 1000;
    this.onAlert = config.onAlert;
    this.onAgentHalted = config.onAgentHalted;
    this.onFleetHalted = config.onFleetHalted;
  }

  // ── Emitter Factory (for agents) ────────────────────────────────────────

  /**
   * Create a write-only AuditEmitter for an agent.
   * This is the only audit API agents should ever receive.
   */
  createEmitterForAgent(agentId: string): AuditEmitter {
    // Initialize agent status tracking
    if (!this.agentStatus.has(agentId)) {
      this.agentStatus.set(agentId, {
        agentId,
        halted: false,
        totalEvents: 0,
        totalViolations: 0,
      });
    }

    const handler: AuditEmitHandler = (
      emitterAgentId: string,
      eventType: AuditEventType,
      payload: Record<string, unknown>,
      severity: AuditSeverity,
    ) => {
      // Drop events from halted agents (they shouldn't be running)
      const status = this.agentStatus.get(emitterAgentId);
      if (status?.halted || this.fleetHalted) return;

      void this.handleEvent(emitterAgentId, eventType, payload, severity);
    };

    return createAuditEmitter(agentId, handler);
  }

  // ── Internal Event Handling ─────────────────────────────────────────────

  private async handleEvent(
    agentId: string,
    eventType: AuditEventType,
    payload: Record<string, unknown>,
    severity: AuditSeverity,
  ): Promise<void> {
    const entry: AuditEntry = {
      id: randomUUID(),
      timestamp: new Date(),
      eventType,
      severity,
      agentId,
      taskId: typeof payload.taskId === 'string' ? payload.taskId : undefined,
      sessionId: typeof payload.sessionId === 'string' ? payload.sessionId : undefined,
      payload,
      policyViolations: [],
    };

    // Evaluate policies
    const { violations, alerts, shouldHaltAgent, shouldHaltAll } = this.policyEngine.evaluate(
      entry,
      this.recentHistory,
    );

    entry.policyViolations = violations;

    // Update severity if policy violations are more severe
    if (violations.length > 0) {
      const maxSeverity = alerts.reduce<AuditSeverity>((max, a) => {
        const rank = { info: 0, warn: 1, critical: 2 };
        return rank[a.severity] > rank[max] ? a.severity : max;
      }, entry.severity);
      entry.severity = maxSeverity;
    }

    // Persist entry
    await this.store.append(entry);

    // Update recent history
    this.recentHistory.push(entry);
    if (this.recentHistory.length > this.recentHistorySize) {
      this.recentHistory = this.recentHistory.slice(-this.recentHistorySize);
    }

    // Update agent status
    const status = this.agentStatus.get(agentId);
    if (status) {
      status.totalEvents++;
      status.lastEventAt = entry.timestamp;
      if (violations.length > 0) {
        status.totalViolations += violations.length;
      }
    }

    // Fire alert callbacks
    for (const alert of alerts) {
      this.onAlert?.(alert);
    }

    // Execute halt actions
    if (shouldHaltAll) {
      this.haltFleet('system', `Policy violation by agent ${agentId}`);
    } else if (shouldHaltAgent) {
      this.haltAgent(agentId, 'system', `Policy violation: ${violations.join(', ')}`);
    }
  }

  // ── Human Control Interface ─────────────────────────────────────────────

  /**
   * Halt a specific agent. Only humans should call this.
   */
  haltAgent(agentId: string, haltedBy: string, reason: string): void {
    const status = this.agentStatus.get(agentId) ?? {
      agentId,
      halted: false,
      totalEvents: 0,
      totalViolations: 0,
    };

    status.halted = true;
    status.haltedBy = haltedBy;
    status.haltedAt = new Date();
    status.haltReason = reason;
    this.agentStatus.set(agentId, status);

    // Log the human action
    void this.handleEvent(
      'system',
      'human:agent:halted',
      {
        targetAgentId: agentId,
        haltedBy,
        reason,
      },
      'critical',
    );

    this.onAgentHalted?.(agentId, reason);
  }

  /**
   * Resume a halted agent. Only humans should call this.
   */
  resumeAgent(agentId: string, resumedBy: string): void {
    const status = this.agentStatus.get(agentId);
    if (!status) return;

    status.halted = false;
    status.haltedBy = undefined;
    status.haltedAt = undefined;
    status.haltReason = undefined;

    void this.handleEvent(
      'system',
      'human:agent:resumed',
      {
        targetAgentId: agentId,
        resumedBy,
      },
      'info',
    );
  }

  /**
   * Halt the entire agent fleet. Emergency stop.
   */
  haltFleet(haltedBy: string, reason: string): void {
    this.fleetHalted = true;

    for (const status of this.agentStatus.values()) {
      status.halted = true;
      status.haltedBy = haltedBy;
      status.haltedAt = new Date();
      status.haltReason = reason;
    }

    void this.handleEvent(
      'system',
      'human:fleet:halted',
      {
        haltedBy,
        reason,
      },
      'critical',
    );

    this.onFleetHalted?.(reason);
  }

  /**
   * Resume the entire fleet. Only humans should call this.
   */
  resumeFleet(resumedBy: string): void {
    this.fleetHalted = false;

    for (const status of this.agentStatus.values()) {
      status.halted = false;
      status.haltedBy = undefined;
      status.haltedAt = undefined;
      status.haltReason = undefined;
    }

    void this.handleEvent(
      'system',
      'human:fleet:resumed',
      {
        resumedBy,
      },
      'info',
    );
  }

  /**
   * Check if an agent is halted
   */
  isAgentHalted(agentId: string): boolean {
    if (this.fleetHalted) return true;
    return this.agentStatus.get(agentId)?.halted ?? false;
  }

  /**
   * Check if the entire fleet is halted
   */
  isFleetHalted(): boolean {
    return this.fleetHalted;
  }

  // ── Policy Management ───────────────────────────────────────────────────

  /**
   * Add a human-defined policy
   */
  addPolicy(policy: AuditPolicy): void {
    this.policyEngine.addPolicy(policy);

    void this.handleEvent(
      'system',
      'human:policy:added',
      {
        policyId: policy.id,
        policyName: policy.name,
        createdBy: policy.createdBy,
      },
      'info',
    );
  }

  /**
   * Remove a policy
   */
  removePolicy(policyId: string, removedBy: string): void {
    this.policyEngine.removePolicy(policyId);

    void this.handleEvent(
      'system',
      'human:policy:removed',
      {
        policyId,
        removedBy,
      },
      'info',
    );
  }

  /**
   * Get all active policies
   */
  getPolicies(): AuditPolicy[] {
    return this.policyEngine.getPolicies();
  }

  // ── Query Interface ─────────────────────────────────────────────────────

  /**
   * Query audit entries
   */
  async query(filter: AuditFilter): Promise<AuditEntry[]> {
    return this.store.query(filter);
  }

  /**
   * Get all alerts
   */
  getAlerts(unacknowledgedOnly = false): AuditAlert[] {
    return this.policyEngine.getAlerts(unacknowledgedOnly);
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    const result = this.policyEngine.acknowledgeAlert(alertId, acknowledgedBy);

    if (result) {
      void this.handleEvent(
        'system',
        'human:alert:acknowledged',
        {
          alertId,
          acknowledgedBy,
        },
        'info',
      );
    }

    return result;
  }

  /**
   * Get status of all tracked agents
   */
  getAgentStatuses(): AuditAgentStatus[] {
    return Array.from(this.agentStatus.values());
  }

  /**
   * Get status of a specific agent
   */
  getAgentStatus(agentId: string): AuditAgentStatus | undefined {
    return this.agentStatus.get(agentId);
  }

  /**
   * Get total entry count
   */
  async getTotalEntries(): Promise<number> {
    return this.store.count();
  }
}
