import type { LWWRegister, ORSet, PNCounter} from '@revealui/memory-core';
import { MemoryStore, TimestampResolver } from '@revealui/memory-core';

export interface AgentConfig {
  name: string;
  capabilities: string[];
  preferences: Record<string, any>;
}

export class CRDTMemoryManager {
  private memoryStore: MemoryStore;

  constructor(nodeId: string) {
    this.memoryStore = new MemoryStore(nodeId, new TimestampResolver());
  }

  // Agent configuration using LWW-Register
  createAgentConfig(agentId: string, initialConfig: AgentConfig): LWWRegister<AgentConfig> {
    return this.memoryStore.createLWWRegister(`agent-config-${agentId}`, initialConfig);
  }

  // Agent capabilities using OR-Set
  createAgentCapabilities(agentId: string): ORSet {
    return this.memoryStore.createORSet(`agent-capabilities-${agentId}`);
  }

  // Agent metrics using PN-Counter
  createAgentMetrics(agentId: string): PNCounter {
    return this.memoryStore.createPNCounter(`agent-metrics-${agentId}`);
  }

  // Get existing CRDT instances
  getAgentConfig(agentId: string): LWWRegister<AgentConfig> | undefined {
    return this.memoryStore.getCRDT(`agent-config-${agentId}`);
  }

  getAgentCapabilities(agentId: string): ORSet | undefined {
    return this.memoryStore.getCRDT(`agent-capabilities-${agentId}`);
  }

  getAgentMetrics(agentId: string): PNCounter | undefined {
    return this.memoryStore.getCRDT(`agent-metrics-${agentId}`);
  }

  // Example usage method
  async updateAgentConfig(agentId: string, updates: Partial<AgentConfig>): Promise<void> {
    const config = this.getAgentConfig(agentId);
    if (!config) {
      throw new Error(`Agent config for ${agentId} not found`);
    }

    const currentConfig = config.get();
    const newConfig = { ...currentConfig, ...updates };
    config.set(newConfig);
  }

  async addAgentCapability(agentId: string, capability: string): Promise<void> {
    const capabilities = this.getAgentCapabilities(agentId);
    if (!capabilities) {
      throw new Error(`Agent capabilities for ${agentId} not found`);
    }

    capabilities.add(capability);
  }

  async incrementAgentMetric(agentId: string, _metric: string, delta: number = 1): Promise<void> {
    const metrics = this.getAgentMetrics(agentId);
    if (!metrics) {
      throw new Error(`Agent metrics for ${agentId} not found`);
    }

    metrics.increment(delta);
  }
}
