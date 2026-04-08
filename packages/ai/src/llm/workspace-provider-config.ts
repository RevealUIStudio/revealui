/**
 * Per-Workspace LLM Provider Configuration
 *
 * Allows workspaces to override the default LLM provider/model.
 * Extends the existing createLLMClientForUser() BYOK pattern.
 */

import { LLMClient, type LLMClientConfig, type LLMProviderType } from './client.js';

export interface WorkspaceProviderConfig {
  workspaceId: string;
  provider: LLMProviderType;
  apiKey: string;
  model?: string;
  baseURL?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * In-memory registry of workspace-level LLM provider overrides.
 * In production, these should be loaded from the database on startup
 * and refreshed when workspace settings change.
 */
export class WorkspaceProviderRegistry {
  private configs: Map<string, WorkspaceProviderConfig> = new Map();

  set(config: WorkspaceProviderConfig): void {
    this.configs.set(config.workspaceId, config);
  }

  get(workspaceId: string): WorkspaceProviderConfig | undefined {
    return this.configs.get(workspaceId);
  }

  delete(workspaceId: string): void {
    this.configs.delete(workspaceId);
  }

  /**
   * Create an LLMClient for the given workspace.
   * If no workspace-specific config exists, returns the fallback client.
   *
   * @param workspaceId - Workspace ID to look up
   * @param fallback - Client to use if no workspace override is set
   */
  createClientForWorkspace(workspaceId: string, fallback: LLMClient): LLMClient {
    const config = this.configs.get(workspaceId);
    if (!config) return fallback;

    const clientConfig: LLMClientConfig = {
      provider: config.provider,
      apiKey: config.apiKey,
      model: config.model,
      baseURL: config.baseURL,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    };

    return new LLMClient(clientConfig);
  }
}

/** Singleton registry — use this in API route handlers */
export const workspaceProviderRegistry = new WorkspaceProviderRegistry();
