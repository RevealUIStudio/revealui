/**
 * Thin fetch wrappers for the RevealCoin endpoints exposed by apps/server.
 *
 * URL is resolved from VITE_API_URL at build time (set per Vercel
 * environment). Falls back to api.revealui.com in production builds and
 * localhost:3004 in development.
 */

const DEFAULT_API_URL = import.meta.env.PROD ? 'https://api.revealui.com' : 'http://localhost:3004';

const API_URL = import.meta.env.VITE_API_URL ?? DEFAULT_API_URL;

export interface CoinSupply {
  totalSupply: string;
  decimals: number;
  raw: string;
}

export interface CoinAllocation {
  name: string;
  percentage: number;
  totalAmount: number;
  wallet: string;
  balance: number;
  vestingDescription: string;
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`);
  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

export function fetchCoinHealth(): Promise<{ status: string; service: string; timestamp: string }> {
  return fetchJson('/api/coin/health');
}

export function fetchCoinSupply(): Promise<CoinSupply> {
  return fetchJson<CoinSupply>('/api/coin/supply');
}

export function fetchCoinAllocations(): Promise<{ allocations: CoinAllocation[] }> {
  return fetchJson<{ allocations: CoinAllocation[] }>('/api/coin/allocations');
}
