export interface GetOpts {
  /** Worker / fixture env map. Defaults to process.env. */
  source?: Record<string, string | undefined>;
}

export interface SecretProvider {
  readonly id: string;
  get(name: string, opts?: GetOpts): Promise<string>;
}

export type AuditHook = (event: { name: string; provider: string; cached: boolean }) => void;

export interface SecretsConfig {
  /** Cache TTL for revvault hits (default 5 minutes). */
  revvaultCacheTtlMs: number;
  /** Cache TTL for env hits (default 0 — env is already in-memory). */
  envCacheTtlMs: number;
  /** Cache TTL for file hits (default 30 seconds). */
  fileCacheTtlMs: number;
  onAudit?: AuditHook;
}

export const DEFAULT_SECRETS_CONFIG: SecretsConfig = {
  revvaultCacheTtlMs: 5 * 60 * 1000,
  envCacheTtlMs: 0,
  fileCacheTtlMs: 30 * 1000,
};

export class SecretNotFoundError extends Error {
  readonly name = 'SecretNotFoundError';
  constructor(
    public readonly secretName: string,
    public readonly provider: string,
  ) {
    super(`Secret "${secretName}" not found via ${provider}`);
  }
}
