import { createHmac, timingSafeEqual } from 'node:crypto';
import { GITHUB_APP_WEBHOOK_EVENTS } from './github-app-policy.js';

export const MAX_WEBHOOK_BYTES = 1024 * 1024;
export const ALLOWED_WEBHOOK_EVENTS = new Set<string>(GITHUB_APP_WEBHOOK_EVENTS);

export type WebhookFailure =
  | 'missing_secret'
  | 'missing_headers'
  | 'bad_signature_format'
  | 'bad_signature'
  | 'body_too_large'
  | 'invalid_json'
  | 'invalid_delivery'
  | 'unsupported_event'
  | 'invalid_payload';

export interface AcceptedWebhook {
  deliveryId: string;
  repositoryId: number;
  installationId: number;
  event: string;
  payload: Record<string, unknown>;
  receivedAt: string;
}

export interface AcceptedPing {
  appId: number;
  hookId: number;
}

export interface IgnoredWebhook {
  installationId: number;
  repositoryId?: number;
  appId?: number;
}

export function verifyGitHubWebhook(input: {
  secret: string;
  signature: string | undefined;
  deliveryId: string | undefined;
  event: string | undefined;
  rawBody: string;
  now?: Date;
}):
  | { ok: true; webhook: AcceptedWebhook; ping?: never; ignored?: never }
  | { ok: true; ping: AcceptedPing; webhook?: never; ignored?: never }
  | { ok: true; ignored: IgnoredWebhook; webhook?: never; ping?: never }
  | { ok: false; reason: WebhookFailure } {
  if (input.secret.length < 32) return { ok: false, reason: 'missing_secret' };
  if (!(input.signature && input.deliveryId && input.event))
    return { ok: false, reason: 'missing_headers' };
  if (!/^sha256=[a-f0-9]{64}$/.test(input.signature))
    return { ok: false, reason: 'bad_signature_format' };
  if (Buffer.byteLength(input.rawBody, 'utf8') > MAX_WEBHOOK_BYTES)
    return { ok: false, reason: 'body_too_large' };
  if (!/^[a-f0-9-]{16,128}$/i.test(input.deliveryId))
    return { ok: false, reason: 'invalid_delivery' };
  if (
    input.event !== 'ping' &&
    input.event !== 'installation' &&
    input.event !== 'installation_repositories' &&
    !ALLOWED_WEBHOOK_EVENTS.has(input.event)
  )
    return { ok: false, reason: 'unsupported_event' };

  const expected = `sha256=${createHmac('sha256', input.secret).update(input.rawBody, 'utf8').digest('hex')}`;
  const actualBytes = Buffer.from(input.signature, 'ascii');
  const expectedBytes = Buffer.from(expected, 'ascii');
  if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes))
    return { ok: false, reason: 'bad_signature' };

  let payload: unknown;
  try {
    payload = JSON.parse(input.rawBody);
  } catch {
    return { ok: false, reason: 'invalid_json' };
  }
  if (input.event === 'ping') {
    if (!(isRecord(payload) && isRecord(payload.hook)))
      return { ok: false, reason: 'invalid_payload' };
    if (
      payload.hook.type !== 'App' ||
      !Number.isSafeInteger(payload.hook_id) ||
      Number(payload.hook_id) <= 0 ||
      payload.hook.id !== payload.hook_id ||
      !Number.isSafeInteger(payload.hook.app_id) ||
      Number(payload.hook.app_id) <= 0
    )
      return { ok: false, reason: 'invalid_payload' };
    return {
      ok: true,
      ping: { appId: Number(payload.hook.app_id), hookId: Number(payload.hook_id) },
    };
  }
  if (input.event === 'installation' || input.event === 'installation_repositories') {
    if (!(isRecord(payload) && isRecord(payload.installation)))
      return { ok: false, reason: 'invalid_payload' };
    if (
      !Number.isSafeInteger(payload.installation.id) ||
      Number(payload.installation.id) <= 0 ||
      !Number.isSafeInteger(payload.installation.app_id) ||
      Number(payload.installation.app_id) <= 0 ||
      typeof payload.action !== 'string'
    )
      return { ok: false, reason: 'invalid_payload' };
    return {
      ok: true,
      ignored: {
        installationId: Number(payload.installation.id),
        appId: Number(payload.installation.app_id),
      },
    };
  }
  if (!isRecord(payload)) return { ok: false, reason: 'invalid_payload' };
  const classification = classifyEventPayload(input.event, payload);
  if (classification === 'invalid') return { ok: false, reason: 'invalid_payload' };
  if (classification === 'ignored')
    return {
      ok: true,
      ignored: {
        installationId: Number((payload.installation as Record<string, unknown>).id),
        repositoryId: Number((payload.repository as Record<string, unknown>).id),
      },
    };
  const receivedAt = input.now ?? new Date();
  if (!Number.isFinite(receivedAt.getTime())) return { ok: false, reason: 'invalid_payload' };
  return {
    ok: true,
    webhook: {
      deliveryId: input.deliveryId.toLowerCase(),
      repositoryId: Number((payload.repository as Record<string, unknown>).id),
      installationId: Number((payload.installation as Record<string, unknown>).id),
      event: input.event,
      payload,
      receivedAt: receivedAt.toISOString(),
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function classifyEventPayload(
  event: string,
  payload: Record<string, unknown>,
): 'process' | 'ignored' | 'invalid' {
  if (
    !(
      isRecord(payload.repository) &&
      Number.isSafeInteger(payload.repository.id) &&
      Number(payload.repository.id) > 0 &&
      isRecord(payload.installation) &&
      Number.isSafeInteger(payload.installation.id) &&
      Number(payload.installation.id) > 0
    )
  )
    return 'invalid';
  const repoName = payload.repository.full_name;
  if (typeof repoName !== 'string' || !/^[^/\s]+\/[^/\s]+$/.test(repoName)) return 'invalid';
  const action = payload.action;
  if (typeof action !== 'string') return 'invalid';
  if (event === 'pull_request' || event === 'pull_request_review') {
    const allowedActions =
      event === 'pull_request'
        ? ['opened', 'synchronize', 'reopened', 'ready_for_review', 'converted_to_draft', 'closed']
        : ['submitted', 'edited', 'dismissed'];
    if (!(isRecord(payload.pull_request) && Number.isSafeInteger(payload.pull_request.number)))
      return 'invalid';
    if (
      Number(payload.pull_request.number) <= 0 ||
      (event === 'pull_request_review' && !isRecord(payload.review))
    )
      return 'invalid';
    return allowedActions.includes(action) ? 'process' : 'ignored';
  }
  if (event === 'merge_group')
    return !isRecord(payload.merge_group)
      ? 'invalid'
      : action === 'checks_requested'
        ? 'process'
        : 'ignored';
  if (event === 'check_run')
    return !isRecord(payload.check_run)
      ? 'invalid'
      : ['completed', 'requested_action'].includes(action)
        ? 'process'
        : 'ignored';
  if (event !== 'check_suite' || !isRecord(payload.check_suite)) return 'invalid';
  return ['completed', 'requested'].includes(action) ? 'process' : 'ignored';
}
