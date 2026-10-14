#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
/**
 * API readiness probe for https://api.revealui.com/health/ready.
 *
 * The route in apps/server/src/routes/health.ts returns 200 JSON
 * { status, timestamp, uptime, checks } when the process is ready.
 * status is "healthy" or "degraded". A non-empty body is not enough:
 * a 302 to vercel.com/sso-api, any other 3xx, and the authentication
 * page do not pass.
 *
 * Usage:
 *   node scripts/deploy/api-readiness-probe.mjs --url https://api.revealui.com/health/ready
 */
import {
  fetchProbe,
  headerMap,
  headerValues,
  mediaType,
  rejectUntrustedResponse,
  runUrlProbe,
} from './smoke-probe-response.mjs';

/** Ready statuses that the route serves with HTTP 200. */
export const READY_HEALTH_STATUSES = ['healthy', 'degraded'];

/** Readiness probe budget. */
export const READINESS_PROBE_TIMEOUT_MS = 10_000;

/**
 * @param {string} body
 * @returns {boolean}
 */
export function isReadyHealthBody(body) {
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    return false;
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
  if (!READY_HEALTH_STATUSES.includes(parsed.status)) return false;
  if (typeof parsed.timestamp !== 'string' || parsed.timestamp.trim() === '') return false;
  if (typeof parsed.uptime !== 'number' || !Number.isFinite(parsed.uptime)) return false;
  if (parsed.checks === null || typeof parsed.checks !== 'object' || Array.isArray(parsed.checks)) {
    return false;
  }
  return true;
}

/**
 * @param {{
 *   status?: number,
 *   headers?: unknown,
 *   body?: string,
 *   timedOut?: boolean,
 * }} response
 * @returns {{ pass: boolean, reason: string }}
 */
export function classifyApiReadinessProbe(response) {
  const rejected = rejectUntrustedResponse(response);
  if (rejected) return rejected;

  if (response.status !== 200) return { pass: false, reason: 'unexpected-status' };

  const type = mediaType(headerValues(headerMap(response.headers), 'content-type')[0] ?? '');
  if (type !== 'application/json') return { pass: false, reason: 'not-json' };
  if (!isReadyHealthBody(response.body ?? '')) return { pass: false, reason: 'unexpected-body' };

  return { pass: true, reason: 'api-ready' };
}

/**
 * @param {string} url
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number }} [options]
 * @returns {Promise<{ pass: boolean, reason: string }>}
 */
export async function probeApiReadiness(url, options = {}) {
  try {
    const response = await fetchProbe(url, {
      ...options,
      timeoutMs: options.timeoutMs ?? READINESS_PROBE_TIMEOUT_MS,
    });
    return classifyApiReadinessProbe(response);
  } catch {
    return { pass: false, reason: 'request-failed' };
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  runUrlProbe(process.argv.slice(2), (url) => probeApiReadiness(url), 'api readiness probe')
    .then((code) => {
      process.exit(code);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
