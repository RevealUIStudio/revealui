/**
 * Per-request LLM client resolver (GAP-360 PR-2).
 *
 * The single home for key resolution at every dispatch site (spec §5.2 / §5.4).
 * One resolver, consumed by all sites — no site-local copies.
 *
 * Resolution order (spec §5.2):
 *   1. Per-user BYOK        — createLLMClientForUser (preferred)
 *   2. Site inference config — workspace_inference_configs (hostedViable on hosted)
 *   3. Deployment env        — createLLMClientFromEnv (SELF-HOSTED ONLY)
 *   4. Hosted + nothing above → throw LLMNotConfiguredError (typed → HTTP 409)
 *
 * Security invariants (spec §6, guardrail-2):
 *   - §6.1 userId is authenticated-identity-scoped; the caller derives it from
 *     session/entitlement context — or, for the durable worker, the
 *     authenticated dispatcher captured server-side at enqueue time — never
 *     from request params/body, and never from a client-writable DB column
 *     (e.g. a ticket's `reporterId`, which has no ownership check on the
 *     general tickets API). The resolver takes userId as an argument and
 *     never reads it from a request.
 *   - §6.2 plaintext lifetime = request scope. The client is constructed per
 *     request; no key cache. Nothing here logs, serializes, or returns a key.
 *   - §6.3 decryption is server-side only via the existing decryptApiKey.
 *   - §6.4 the byok:key:accessed audit event fires inside createLLMClientForUser
 *     when an audit store is wired (ctx.auditStore).
 *   - §6.5 fail-closed: unknown provider / failed decrypt / a non-hostedViable
 *     provider on hosted resolves to LLMNotConfiguredError, never an env
 *     fallthrough on hosted (the exact silent-localhost defect class).
 *   - §6.6 no new secret surface.
 *
 * Feature flag (spec §7): HOSTED_BYOK_DISPATCH. Default ON for hosted, absent
 * (off) for self-hosted so self-hosted env-first behavior is byte-unchanged.
 * The flag is the one-release rollback lever.
 */

import { createLogger } from '@revealui/core/observability/logger';
import type { Database } from '@revealui/db/client';
import { decryptApiKey } from '@revealui/db/crypto';
import { workspaceInferenceConfigs } from '@revealui/db/schema';
import { eq } from 'drizzle-orm';
import type { AuditStore } from '../audit/store.js';
import {
  createLLMClientForUser,
  createLLMClientFromEnv,
  isHostedViable,
  LLMClient,
  type LLMProviderType,
} from './client.js';

const resolverLogger = createLogger({ component: 'resolveLLMClientForRequest' });
/** Emitted once per process when the hosted BYOK rollback lever is pulled. */
let warnedBreakGlass = false;

/**
 * Thrown when a hosted deployment has no usable LLM configuration for the
 * request. Maps to HTTP 409 (configuration is the remedy, not payment).
 * Callers name {@link settingsPath} in the machine-readable response body.
 */
export class LLMNotConfiguredError extends Error {
  /** Stable machine-readable code for API response bodies. */
  readonly code = 'LLM_NOT_CONFIGURED' as const;
  /** Where the account owner configures a key. */
  readonly settingsPath = '/settings/api-keys' as const;

  constructor(message = 'No LLM provider is configured for this account.') {
    super(message);
    this.name = 'LLMNotConfiguredError';
  }
}

/** The 409 response body every dispatch site returns for an unconfigured account. */
export interface LLMNotConfiguredBody {
  success: false;
  error: string;
  code: 'LLM_NOT_CONFIGURED';
  settingsPath: '/settings/api-keys';
}

/** Build the machine-readable 409 body for {@link LLMNotConfiguredError}. */
export function llmNotConfiguredBody(err: LLMNotConfiguredError): LLMNotConfiguredBody {
  return {
    success: false,
    error: err.message,
    code: err.code,
    settingsPath: err.settingsPath,
  };
}

export interface ResolveLLMContext {
  /**
   * True on the hosted revealui.com SaaS deployment. Derived by the caller from
   * the existing deployment-mode signal (server: detectDeploymentMode; admin:
   * REVEALUI_LICENSE_PRIVATE_KEY presence) — never sniffed here.
   */
  isHosted: boolean;
  /** Site id for step-2 site-level config lookup. Omit when the site has none. */
  workspaceId?: string;
  /**
   * Durable audit sink for the byok:key:accessed event (§6.4). Only `append` is
   * used, so a persistent store (DrizzleAuditStore) fits. Omit where none is
   * wired (e.g. the admin process, in-memory until GAP-338 closes).
   */
  auditStore?: Pick<AuditStore, 'append'>;
}

const FLAG_ON = new Set(['true', '1', 'on', 'yes']);
const FLAG_OFF = new Set(['false', '0', 'off', 'no']);

/**
 * Whether the BYOK dispatch order (spec §5.2) is active. Default follows the
 * deployment: ON when hosted, OFF when self-hosted. HOSTED_BYOK_DISPATCH
 * overrides explicitly; an unrecognized value falls back to the default.
 */
export function hostedByokDispatchEnabled(isHosted: boolean): boolean {
  const raw = process.env.HOSTED_BYOK_DISPATCH;
  if (raw === undefined || raw.trim() === '') return isHosted;
  const value = raw.trim().toLowerCase();
  if (FLAG_OFF.has(value)) return false;
  if (FLAG_ON.has(value)) return true;
  return isHosted;
}

/**
 * Resolve the LLM client for a single request.
 *
 * @param userId - Authenticated user id, from session/entitlement context for
 *   request-scoped callers, or the authenticated dispatcher captured
 *   server-side at enqueue time for the durable worker. Never a request
 *   param/body value, and never a client-writable DB column. Null when there
 *   is no authenticated user.
 * @param db - Drizzle client.
 * @param ctx - Deployment mode, optional site id, optional audit sink.
 */
export async function resolveLLMClientForRequest(
  userId: string | null,
  db: Database,
  ctx: ResolveLLMContext,
): Promise<LLMClient> {
  const hosted = ctx.isHosted;

  // Feature-flag gate. When disabled (self-hosted default), behavior is
  // byte-unchanged: env-first, exactly as before this PR.
  if (!hostedByokDispatchEnabled(hosted)) {
    if (hosted && !warnedBreakGlass) {
      warnedBreakGlass = true;
      // Break-glass: HOSTED_BYOK_DISPATCH is explicitly off on a hosted
      // deployment. Every account now shares the deployment env client while
      // this lever is pulled — a deliberate one-release rollback, but an
      // operator must know it is active.
      resolverLogger.warn(
        'HOSTED_BYOK_DISPATCH is disabled on a hosted deployment — all accounts are ' +
          'sharing the deployment env LLM client instead of per-account BYOK keys.',
      );
    }
    return createLLMClientFromEnv();
  }

  // 1. Per-user BYOK (preferred). On hosted, filter to hostedViable providers
  //    so a localhost-only BYOK key (e.g. ollama) can never yield a localhost
  //    client — that is the silent-localhost defect (§6.5, fail-closed).
  if (userId) {
    try {
      const byok = await createLLMClientForUser(userId, db, ctx.auditStore, {
        hostedViableOnly: hosted,
      });
      if (byok) return byok;
    } catch {
      // Failed decrypt / unknown-provider row / CHECK-violating row. Fail-closed
      // on hosted — never fall through to env. Self-hosted may continue.
      if (hosted) {
        throw new LLMNotConfiguredError(
          'Your stored API key could not be used. Re-add it under /settings/api-keys.',
        );
      }
    }
  }

  // 2. Site-level inference config.
  const siteClient = await resolveSiteInferenceClient(db, ctx.workspaceId, hosted);
  if (siteClient) return siteClient;

  // 3. Deployment env — SELF-HOSTED ONLY. Forbidden on hosted (§5.2 step 3).
  if (!hosted) {
    return createLLMClientFromEnv();
  }

  // 4. Hosted + nothing above → fail loud, actionable.
  throw new LLMNotConfiguredError();
}

/**
 * Build a client from the site's workspace_inference_configs row (spec §5.2
 * step 2). Returns null when the site has no config, or (on hosted) when its
 * provider is not hostedViable. Fail-closed: a malformed row throws on hosted
 * and is skipped on self-hosted.
 */
async function resolveSiteInferenceClient(
  db: Database,
  workspaceId: string | undefined,
  hosted: boolean,
): Promise<LLMClient | null> {
  if (!workspaceId) return null;

  const [config] = await db
    .select()
    .from(workspaceInferenceConfigs)
    .where(eq(workspaceInferenceConfigs.workspaceId, workspaceId))
    .limit(1);

  if (!config) return null;

  const provider = config.provider as LLMProviderType;

  // On hosted, only hostedViable providers are reachable. A non-viable site
  // config is skipped so resolution fails closed rather than hitting localhost.
  if (hosted && !isHostedViable(provider)) return null;

  try {
    // Keyless providers (ollama / inference-snaps) carry a NULL encrypted key
    // and use the provider name as the placeholder key — matches the env
    // factory. Keyed providers decrypt server-side at dispatch time (§6.3).
    const apiKey = config.encryptedApiKey ? decryptApiKey(config.encryptedApiKey) : provider;

    return new LLMClient({
      provider,
      apiKey,
      model: config.model ?? undefined,
      baseURL: config.baseURL ?? undefined,
      temperature: config.temperature ?? undefined,
      maxTokens: config.maxTokens ?? undefined,
    });
  } catch {
    // Unknown provider / failed decrypt. Fail-closed on hosted; skip on self-hosted.
    if (hosted) {
      throw new LLMNotConfiguredError(
        'This site’s inference configuration could not be used. Update it under /settings/api-keys.',
      );
    }
    return null;
  }
}
