/**
 * Provider Health Monitor
 *
 * Sliding window of last 100 calls per provider.
 * Tracks latency (p50) and error rate to rank fallback candidates.
 *
 * AnythingLLM lesson: no health checks → silent failures cascade.
 */

import type { LLMProviderType } from './client.js';

export interface ProviderHealth {
  provider: LLMProviderType;
  /** healthy | degraded | unhealthy */
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyP50Ms: number;
  errorRate: number; // 0–1
  sampleCount: number;
}

interface CallRecord {
  latencyMs: number;
  error: boolean;
  timestamp: number;
}

const WINDOW_SIZE = 100;
const DEGRADED_ERROR_RATE = 0.1; // 10%
const UNHEALTHY_ERROR_RATE = 0.3; // 30%
const DEGRADED_LATENCY_MS = 5_000;
const UNHEALTHY_LATENCY_MS = 15_000;

function p50(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted[mid] ?? 0;
}

export class ProviderHealthMonitor {
  private windows: Map<LLMProviderType, CallRecord[]> = new Map();

  private getWindow(provider: LLMProviderType): CallRecord[] {
    if (!this.windows.has(provider)) {
      this.windows.set(provider, []);
    }
    // biome-ignore lint/style/noNonNullAssertion: set above guarantees presence
    return this.windows.get(provider)!;
  }

  /**
   * Record a completed LLM API call.
   */
  recordCall(provider: LLMProviderType, latencyMs: number, error?: Error | null): void {
    const window = this.getWindow(provider);
    window.push({ latencyMs, error: error != null, timestamp: Date.now() });

    // Keep only the last WINDOW_SIZE records
    if (window.length > WINDOW_SIZE) {
      window.splice(0, window.length - WINDOW_SIZE);
    }
  }

  /**
   * Get health metrics for a provider.
   * Returns 'healthy' with 0 latency if no calls recorded yet.
   */
  getHealth(provider: LLMProviderType): ProviderHealth {
    const window = this.getWindow(provider);

    if (window.length === 0) {
      return {
        provider,
        status: 'healthy',
        latencyP50Ms: 0,
        errorRate: 0,
        sampleCount: 0,
      };
    }

    const errorCount = window.filter((r) => r.error).length;
    const errorRate = errorCount / window.length;
    const latencies = window.filter((r) => !r.error).map((r) => r.latencyMs);
    const latencyP50Ms = p50(latencies);

    let status: ProviderHealth['status'] = 'healthy';
    if (errorRate >= UNHEALTHY_ERROR_RATE || latencyP50Ms >= UNHEALTHY_LATENCY_MS) {
      status = 'unhealthy';
    } else if (errorRate >= DEGRADED_ERROR_RATE || latencyP50Ms >= DEGRADED_LATENCY_MS) {
      status = 'degraded';
    }

    return { provider, status, latencyP50Ms, errorRate, sampleCount: window.length };
  }

  /**
   * Pick the best provider from a set of candidates.
   * Prefers healthy > degraded > unhealthy, then by p50 latency.
   */
  getBestProvider(candidates: LLMProviderType[]): LLMProviderType {
    if (candidates.length === 0) throw new Error('No provider candidates provided');
    // biome-ignore lint/style/noNonNullAssertion: length === 1 guarantees element exists
    if (candidates.length === 1) return candidates[0]!;

    const ranked = candidates
      .map((p) => ({ provider: p, health: this.getHealth(p) }))
      .sort((a, b) => {
        const statusOrder = { healthy: 0, degraded: 1, unhealthy: 2 };
        const statusDiff = statusOrder[a.health.status] - statusOrder[b.health.status];
        if (statusDiff !== 0) return statusDiff;
        return a.health.latencyP50Ms - b.health.latencyP50Ms;
      });

    // biome-ignore lint/style/noNonNullAssertion: ranked has at least 2 elements (checked above)
    return ranked[0]!.provider;
  }

  /**
   * Reset health data for a provider (useful for testing).
   */
  reset(provider: LLMProviderType): void {
    this.windows.set(provider, []);
  }
}
