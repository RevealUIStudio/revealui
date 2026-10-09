#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
/**
 * Durable production rollback for Vercel apps.
 *
 * Why this exists (2026-07-21 #2027 outage):
 * - deploy.yml used `vercel ls --prod | grep | sed -n '2p'` which returned
 *   empty under the wrong team slug (TURBO_TEAM ≠ project team), so auto-
 *   rollback printed "No previous deployment found" and left the broken
 *   deploy on the production alias.
 * - This script uses the Vercel REST API with an explicit team id, finds the
 *   restore target, and re-points the allowlisted production hostnames on the
 *   newest (broken) deploy to that target. Api and admin use the newest READY
 *   production deployment at or after a per-project rollback floor. Other apps
 *   use the second-most-recent READY production deployment. Other aliases
 *   (preview or nested test names) stay put. A failure moving a non-production
 *   alias must not fail the rollback.
 *
 * Usage:
 *   VERCEL_TOKEN=… VERCEL_TEAM_ID=team_… node scripts/deploy/vercel-rollback-previous-prod.mjs \
 *     --project-id prj_… [--app-label api]
 *
 * Api and admin rollbacks require a per-project floor repository variable:
 * API_ROLLBACK_FLOOR_DEPLOYMENT_ID or ADMIN_ROLLBACK_FLOOR_DEPLOYMENT_ID.
 * The script loads that deployment by id and uses its createdAt as the floor.
 * The deployment must belong to the expected project, target production, and
 * be READY. Candidates are compared by createdAt, never by id string. Targets
 * created before the floor are refused. The floor deployment itself stays
 * eligible. If the variable is unset, the floor cannot be resolved, the floor
 * fails those checks, or no eligible target remains, the script does not move
 * aliases, reports that the live build was left in place, and exits 1.
 *
 * Exit codes:
 *   0 — previous deploy promoted (aliases reassigned) or nothing to do
 *   1 — hard failure (no history, floor refusal, API error, verify failed)
 *   2 — bad args / missing env
 */
import { parseArgs } from 'node:util';

const API = 'https://api.vercel.com';

/** One Vercel API request gives up after this many milliseconds. */
export const VERCEL_API_TIMEOUT_MS = 10_000;

/**
 * Fetch with an AbortController deadline. A request that is still open when
 * `timeoutMs` elapses rejects instead of waiting for the job timeout.
 */
export async function fetchWithTimeout(
  url,
  init = {},
  timeoutMs = VERCEL_API_TIMEOUT_MS,
  fetchImpl = fetch,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  try {
    return await fetchImpl(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Vercel API request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Hostnames a production rollback may move. Single-label names covered by
 * Cloudflare Universal SSL (`*.revealui.com`), plus each app's production
 * `*.vercel.app` alias. Nested names such as `test.api.revealui.com` are
 * excluded: they are not on that certificate and must not ride prod rollback.
 */
export const PRODUCTION_ALIASES = {
  api: ['api.revealui.com', 'revealui-api.vercel.app'],
  admin: ['admin.revealui.com'],
  marketing: [
    'revealui.com',
    'www.revealui.com',
    'community.revealui.com',
    'revealui-landing.vercel.app',
  ],
  docs: ['docs.revealui.com', 'docs-gold-three.vercel.app'],
};

/** Aliases on the newest deploy that this app is allowed to move. */
export function aliasesToMove(appLabel, aliasesOnNewest) {
  const allow = PRODUCTION_ALIASES[appLabel];
  if (!allow) return null;
  const allowed = new Set(allow);
  return (aliasesOnNewest || []).filter((a) => a?.alias && allowed.has(a.alias));
}

function trimmed(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Repository variable that holds each floored app's deployment id.
 * Apps absent from this map restore the previous READY production deployment.
 */
export const ROLLBACK_FLOOR_ENV = {
  api: 'API_ROLLBACK_FLOOR_DEPLOYMENT_ID',
  admin: 'ADMIN_ROLLBACK_FLOOR_DEPLOYMENT_ID',
};

export function rollbackFloorEnvName(appLabel) {
  const label = trimmed(appLabel);
  if (Object.hasOwn(ROLLBACK_FLOOR_ENV, label)) return ROLLBACK_FLOOR_ENV[label];
  return '';
}

function asEpochMs(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value === 'string') {
    const text = value.trim();
    if (text.length === 0) return null;
    const parsed = Date.parse(text);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
    const asNumber = Number(text);
    if (Number.isFinite(asNumber) && asNumber > 0) return asNumber;
  }
  return null;
}

function deploymentCreatedMs(deployment) {
  if (!deployment || typeof deployment !== 'object') return null;
  const direct = asEpochMs(deployment.createdAt ?? deployment.created);
  if (direct != null) return direct;
  const nested = deployment.deployment;
  if (nested && typeof nested === 'object') {
    return asEpochMs(nested.createdAt ?? nested.created);
  }
  return null;
}

function hasFloorCreatedAt(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * Prefer the record that carries createdAt. A wrapped `{ deployment }` body
 * is read from the inner object when the top level has no timestamp.
 */
function floorRecord(body) {
  if (!body || typeof body !== 'object') return null;
  if (asEpochMs(body.createdAt ?? body.created) != null) return body;
  if (body.deployment && typeof body.deployment === 'object') return body.deployment;
  return body;
}

function readLookupProjectId(record) {
  if (!record || typeof record !== 'object') return '';
  const direct = trimmed(record.projectId);
  const nested =
    record.project && typeof record.project === 'object' ? trimmed(record.project.id) : '';
  if (direct && nested && direct !== nested) return '';
  return direct || nested;
}

function isReadyLookup(record) {
  if (!record || typeof record !== 'object') return false;
  const readyState = trimmed(record.readyState);
  const state = trimmed(record.state);
  if (!readyState && !state) return false;
  if (readyState && readyState !== 'READY') return false;
  if (state && state !== 'READY') return false;
  return true;
}

function refusedFloor(reason, floorDeploymentId, extra = {}) {
  return {
    ok: false,
    reason,
    floorDeploymentId,
    floorCreatedAt: null,
    ...extra,
  };
}

/**
 * Interpret a Vercel deployment lookup for a per-project rollback floor.
 * A blank id is unset. A body without createdAt cannot be resolved. A
 * resolved deployment must belong to `options.projectId`, target production,
 * and be READY. Otherwise the floor is refused.
 */
export function floorFromLookup(floorDeploymentId, lookupBody, options = {}) {
  const id = trimmed(floorDeploymentId);
  if (!id) {
    return refusedFloor('floor-unset', '');
  }
  const floorCreatedAt = deploymentCreatedMs(lookupBody);
  if (!hasFloorCreatedAt(floorCreatedAt)) {
    return refusedFloor('floor-unresolvable', id);
  }
  const record = floorRecord(lookupBody);
  const expectedProjectId = trimmed(options.projectId);
  const projectId = readLookupProjectId(record);
  if (!expectedProjectId || !projectId || projectId !== expectedProjectId) {
    return refusedFloor('floor-wrong-project', id, { projectId, expectedProjectId });
  }
  if (trimmed(record?.target) !== 'production') {
    return refusedFloor('floor-not-production', id, { projectId, expectedProjectId });
  }
  if (!isReadyLookup(record)) {
    return refusedFloor('floor-not-ready', id, { projectId, expectedProjectId });
  }
  return { ok: true, reason: 'resolved', floorDeploymentId: id, floorCreatedAt, projectId };
}

function isAtOrAfterFloor(candidate, floorCreatedAt) {
  const created = deploymentCreatedMs(candidate);
  if (!(hasFloorCreatedAt(created) && hasFloorCreatedAt(floorCreatedAt))) return false;
  return created >= floorCreatedAt;
}

/**
 * Choose the READY production deployment a rollback may restore.
 * Index 0 is the current deploy and is never a restore target. Floored apps
 * require a resolved floor createdAt. Eligible candidates are ordered by
 * createdAt, newest first. Deployment id strings are not compared.
 */
export function selectRollbackTarget(deployments, options = {}) {
  const list = Array.isArray(deployments) ? deployments : [];
  const appLabel = trimmed(options.appLabel) || 'app';

  if (!rollbackFloorEnvName(appLabel)) {
    if (list.length < 2) {
      return { target: null, rollback: false, reason: 'no-previous' };
    }
    return { target: list[1], rollback: true, reason: 'previous' };
  }

  const floorDeploymentId = trimmed(options.floorDeploymentId);
  if (!floorDeploymentId) {
    return { target: null, rollback: false, reason: 'floor-unset' };
  }
  if (!hasFloorCreatedAt(options.floorCreatedAt)) {
    return { target: null, rollback: false, reason: 'floor-unresolvable' };
  }

  const eligible = list
    .slice(1)
    .filter((candidate) => isAtOrAfterFloor(candidate, options.floorCreatedAt));
  eligible.sort((left, right) => {
    const leftCreated = deploymentCreatedMs(left) ?? 0;
    const rightCreated = deploymentCreatedMs(right) ?? 0;
    return rightCreated - leftCreated;
  });
  const target = eligible[0];
  if (!target) {
    return { target: null, rollback: false, reason: 'no-eligible-target' };
  }
  return { target, rollback: true, reason: 'at-or-after-floor' };
}

export function rollbackRefusalMessage(decision, context = {}) {
  const appLabel = context.appLabel || 'app';
  const floorDeploymentId = context.floorDeploymentId || decision?.floorDeploymentId || '';
  const leftInPlace = 'No rollback was performed. The live build was left in place.';
  const variable = context.floorVariable || rollbackFloorEnvName(appLabel);
  if (decision?.reason === 'floor-unset') {
    const name = variable || 'ROLLBACK_FLOOR_DEPLOYMENT_ID';
    return `${name} is unset. Refusing an unbounded ${appLabel} rollback. ${leftInPlace}`;
  }
  if (decision?.reason === 'floor-unresolvable') {
    return (
      `Rollback floor ${floorDeploymentId} for ${appLabel} could not be resolved from the Vercel API. ` +
      leftInPlace
    );
  }
  if (decision?.reason === 'floor-wrong-project') {
    const expected = context.projectId || decision?.expectedProjectId || 'the expected project';
    const actual = decision?.projectId || 'unknown';
    return (
      `Rollback floor ${floorDeploymentId} for ${appLabel} belongs to project ${actual}, not ${expected}. ` +
      leftInPlace
    );
  }
  if (decision?.reason === 'floor-not-ready') {
    return `Rollback floor ${floorDeploymentId} for ${appLabel} is not READY. ${leftInPlace}`;
  }
  if (decision?.reason === 'floor-not-production') {
    return (
      `Rollback floor ${floorDeploymentId} for ${appLabel} does not target production. ${leftInPlace}`
    );
  }
  if (decision?.reason === 'no-eligible-target') {
    return (
      `No READY production deployment for ${appLabel} at or after floor ${floorDeploymentId} ` +
      `is eligible for rollback. ${leftInPlace}`
    );
  }
  const foundCount = context.foundCount ?? 0;
  return (
    `No previous READY production deployment for ${appLabel} (found ${foundCount}). ` +
    'Broken deploy may still be live.'
  );
}

function die(code, msg) {
  console.error(msg);
  process.exit(code);
}

let values;
let projectId;
let appLabel;
let token;
let teamId;

function initCli() {
  const parsed = parseArgs({
    options: {
      'project-id': { type: 'string' },
      'app-label': { type: 'string', default: 'app' },
      'team-id': { type: 'string' },
      token: { type: 'string' },
      dry: { type: 'boolean', default: false },
    },
    allowPositionals: false,
  });
  values = parsed.values;
  projectId = values['project-id'];
  appLabel = values['app-label'] || 'app';
  token = values.token || process.env.VERCEL_TOKEN;
  // Prefer explicit flag, then VERCEL_TEAM_ID, then VERCEL_ORG_ID (fleet secret
  // is the team id even when named ORG_ID — see deploy.yml / SECRETS.md).
  teamId = values['team-id'] || process.env.VERCEL_TEAM_ID || process.env.VERCEL_ORG_ID || '';
  if (!projectId) die(2, 'missing --project-id');
  if (!token) die(2, 'missing VERCEL_TOKEN / --token');
  if (!teamId) {
    die(
      2,
      'missing team id: pass --team-id or set VERCEL_TEAM_ID / VERCEL_ORG_ID (team_… id, not TURBO_TEAM slug)',
    );
  }
}

async function api(path, init = {}, timeoutMs = VERCEL_API_TIMEOUT_MS) {
  const url = new URL(path.startsWith('http') ? path : `${API}${path}`);
  if (!url.searchParams.has('teamId')) url.searchParams.set('teamId', teamId);
  const request = {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  };
  const deadline = timeoutMs > 0 ? timeoutMs : VERCEL_API_TIMEOUT_MS;
  const res = await fetchWithTimeout(url, request, deadline);
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(
      `Vercel API ${res.status} ${url.pathname}: ${JSON.stringify(body?.error || body).slice(0, 400)}`,
    );
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

async function resolveFloor(rawFloorDeploymentId, expectedProjectId, appLabel) {
  const preview = floorFromLookup(rawFloorDeploymentId, null, { projectId: expectedProjectId });
  if (preview.reason === 'floor-unset') return preview;
  try {
    const body = await api(
      `/v13/deployments/${encodeURIComponent(preview.floorDeploymentId)}`,
      {},
      VERCEL_API_TIMEOUT_MS,
    );
    return floorFromLookup(preview.floorDeploymentId, body, { projectId: expectedProjectId });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown error';
    console.error(
      `Rollback floor lookup failed for ${appLabel} ${preview.floorDeploymentId}: ${detail}`,
    );
    return floorFromLookup(preview.floorDeploymentId, null, { projectId: expectedProjectId });
  }
}

async function listReadyProdDeployments() {
  // v6 deployments: newest first
  const data = await api(
    `/v6/deployments?projectId=${encodeURIComponent(projectId)}&target=production&limit=20&state=READY`,
  );
  const list = (data.deployments || []).filter(
    (d) => (d.readyState || d.state) === 'READY' || !d.readyState,
  );
  // Prefer readyState READY when present
  return list.filter((d) => !d.readyState || d.readyState === 'READY');
}

async function listAliasesForDeployment(deploymentId) {
  // Paginate aliases for the project; filter to those currently on deploymentId
  const aliases = [];
  let until;
  for (let page = 0; page < 10; page++) {
    let path = `/v2/aliases?projectId=${encodeURIComponent(projectId)}&limit=100`;
    if (until) path += `&until=${until}`;
    const data = await api(path);
    const batch = data.aliases || [];
    for (const a of batch) {
      if (a.deploymentId === deploymentId) aliases.push(a);
    }
    if (batch.length < 100) break;
    const last = batch[batch.length - 1];
    until = last?.createdAt;
    if (!until) break;
  }
  return aliases;
}

async function assignAlias(deploymentId, alias) {
  return api(`/v2/deployments/${deploymentId}/aliases`, {
    method: 'POST',
    body: JSON.stringify({ alias }),
  });
}

async function main() {
  initCli();
  console.log(`=== Rollback previous prod: ${appLabel} (${projectId}) team=${teamId} ===`);

  let floorDeploymentId = '';
  let floorCreatedAt = null;
  const floorVariable = rollbackFloorEnvName(appLabel);
  if (floorVariable) {
    const floor = await resolveFloor(process.env[floorVariable], projectId, appLabel);
    floorDeploymentId = floor.floorDeploymentId;
    floorCreatedAt = floor.floorCreatedAt;
    if (!floor.ok) {
      die(
        1,
        rollbackRefusalMessage(floor, {
          appLabel,
          floorDeploymentId,
          projectId,
          floorVariable,
        }),
      );
    }
  }

  const deps = await listReadyProdDeployments();
  const decision = selectRollbackTarget(deps, {
    appLabel,
    floorDeploymentId,
    floorCreatedAt,
  });
  if (!(decision.rollback && decision.target)) {
    die(
      1,
      rollbackRefusalMessage(decision, {
        appLabel,
        floorDeploymentId,
        foundCount: deps.length,
      }),
    );
  }

  const broken = deps[0];
  const previous = decision.target;
  if (!(broken?.uid && previous.uid)) {
    die(
      1,
      `Rollback target for ${appLabel} is missing a deployment id. ` +
        'No rollback was performed. The live build was left in place.',
    );
  }
  console.log(`Newest (broken candidate): ${broken.uid} https://${broken.url}`);
  console.log(`Restore target:            ${previous.uid} https://${previous.url}`);
  if (floorVariable) {
    console.log(`Rollback floor (${floorVariable}): ${floorDeploymentId}`);
  }

  if (!PRODUCTION_ALIASES[appLabel]) {
    die(1, `No production alias allowlist for ${appLabel}. Refusing to move every alias.`);
  }

  const onNewest = await listAliasesForDeployment(broken.uid);
  const aliases = aliasesToMove(appLabel, onNewest);
  if (aliases.length === 0) {
    console.log(
      `No allowlisted production aliases on newest deploy for ${appLabel}. Other hostnames were left in place.`,
    );
    return;
  }

  console.log(`Reassigning ${aliases.length} alias(es) to previous deploy…`);
  const failures = [];
  for (const a of aliases) {
    const name = a.alias;
    if (!name) continue;
    console.log(`  → ${name}`);
    if (values.dry) continue;
    try {
      await assignAlias(previous.uid, name);
    } catch (e) {
      console.error(`  FAIL ${name}: ${e.message}`);
      failures.push(name);
    }
  }

  if (values.dry) {
    console.log('dry-run: no changes applied');
    process.exit(0);
  }

  if (failures.length > 0) {
    die(1, `Rollback incomplete for ${appLabel}: failed aliases: ${failures.join(', ')}`);
  }

  // Verify: production custom domains (non-vercel.app automatic) now point at previous
  const verify = await listAliasesForDeployment(previous.uid);
  const restored = new Set(verify.map((a) => a.alias));
  const missing = aliases.map((a) => a.alias).filter((n) => n && !restored.has(n));
  if (missing.length > 0) {
    die(
      1,
      `Rollback issued but verification incomplete for ${appLabel}: still missing on previous: ${missing.join(', ')}`,
    );
  }

  console.log(
    `✅ Rollback verified: ${appLabel} production aliases now on ${previous.uid} (https://${previous.url})`,
  );
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
