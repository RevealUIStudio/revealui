/**
 * Public base URL for this API process (self origin).
 *
 * Used by:
 * - Governed MCP tool loopback (`mcp-endpoint` credentialsProvider → REST)
 * - OpenAPI server list (index.ts)
 *
 * Priority:
 * 1. explicit override (tests + DI)
 * 2. `REVEALUI_API_URL` (canonical hosted/server name)
 * 3. `NEXT_PUBLIC_API_URL` (parity twin used by admin/marketing)
 * 4. `API_URL` (legacy local/scripts)
 *
 * Trailing slashes are stripped. Empty string means "not configured".
 * Vault leaf: `revealui/prod/public/api-url` (synced onto revealui-api).
 */
export function resolveSelfApiBaseUrl(
  override?: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const raw =
    (override && override.trim()) ||
    env.REVEALUI_API_URL?.trim() ||
    env.NEXT_PUBLIC_API_URL?.trim() ||
    env.API_URL?.trim() ||
    '';
  return raw.replace(/\/+$/, '');
}

/** Loud missing-config message for the governed MCP credentialsProvider. */
export const MISSING_SELF_API_URL_MESSAGE =
  'governed MCP endpoint: REVEALUI_API_URL is not configured ' +
  '(set REVEALUI_API_URL to this API public origin; vault path ' +
  'revealui/prod/public/api-url; sync via scripts/sync/revvault-vercel.toml → revealui-api)';
