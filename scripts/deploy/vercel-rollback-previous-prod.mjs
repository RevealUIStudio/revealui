#!/usr/bin/env node
/**
 * Durable production rollback for Vercel apps.
 *
 * Why this exists (2026-07-21 #2027 outage):
 * - deploy.yml used `vercel ls --prod | grep | sed -n '2p'` which returned
 *   empty under the wrong team slug (TURBO_TEAM ≠ project team), so auto-
 *   rollback printed "No previous deployment found" and left the broken
 *   deploy on the production alias.
 * - This script uses the Vercel REST API with an explicit team id, finds the
 *   second-most-recent READY production deployment, and re-points the
 *   allowlisted production hostnames on the newest (broken) deploy to that
 *   previous one. Other aliases (preview or nested test names) stay put.
 *   A failure moving a non-production alias must not fail the rollback.
 *
 * Usage:
 *   VERCEL_TOKEN=… VERCEL_TEAM_ID=team_… node scripts/deploy/vercel-rollback-previous-prod.mjs \
 *     --project-id prj_… [--app-label api] \
 *     [--admin-rollback-floor dpl_…] [--target-deployment-id dpl_…]
 *
 * Admin floor override: --admin-rollback-floor or ADMIN_ROLLBACK_FLOOR_DEPLOYMENT_ID.
 * Explicit rollback target: --target-deployment-id or ROLLBACK_TARGET_DEPLOYMENT_ID.
 * An explicit target is used as given. Automatic admin selection skips
 * candidates created before the floor and does not roll back when none remain.
 *
 * Exit codes:
 *   0 — previous deploy promoted (aliases reassigned) or nothing to do
 *   1 — hard failure (no history, API error, verify failed)
 *   2 — bad args / missing env
 */
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

const API = 'https://api.vercel.com';

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

/** minimum admin deployment eligible for automatic rollback */
export const DEFAULT_ADMIN_ROLLBACK_FLOOR_DEPLOYMENT_ID = 'dpl_E53yHRcF354kyvXCs2svwNA6iUkY';

/** Create time of the default floor deployment: 2026-10-06, about 16:37 UTC. */
export const DEFAULT_ADMIN_ROLLBACK_FLOOR_CREATED_AT_MS = Date.parse('2026-10-06T16:37:00.000Z');

const EPOCH_MS_THRESHOLD = 1_000_000_000_000;

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

function deploymentId(deployment) {
  if (!deployment || typeof deployment !== 'object') return '';
  if (typeof deployment.uid === 'string' && deployment.uid.length > 0) return deployment.uid;
  if (typeof deployment.id === 'string' && deployment.id.length > 0) return deployment.id;
  return '';
}

function asEpochMs(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value > 0 && value < EPOCH_MS_THRESHOLD) return value * 1000;
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) return asEpochMs(asNumber);
  }
  return null;
}

function deploymentCreatedMs(deployment) {
  if (!deployment || typeof deployment !== 'object') return null;
  return asEpochMs(deployment.createdAt ?? deployment.created);
}

function resolveFloorCreatedAt(deployments, floorDeploymentId, fallbackCreatedAt) {
  const list = Array.isArray(deployments) ? deployments : [];
  const match = list.find((deployment) => deploymentId(deployment) === floorDeploymentId);
  const fromRecord = match ? deploymentCreatedMs(match) : null;
  if (fromRecord != null) return fromRecord;
  if (typeof fallbackCreatedAt === 'number' && Number.isFinite(fallbackCreatedAt)) {
    return fallbackCreatedAt;
  }
  if (floorDeploymentId === DEFAULT_ADMIN_ROLLBACK_FLOOR_DEPLOYMENT_ID) {
    return DEFAULT_ADMIN_ROLLBACK_FLOOR_CREATED_AT_MS;
  }
  return null;
}

function isAtOrAfterAdminFloor(candidate, floorDeploymentId, floorCreatedAt) {
  if (deploymentId(candidate) === floorDeploymentId) return true;
  const created = deploymentCreatedMs(candidate);
  if (created == null || floorCreatedAt == null) return false;
  return created >= floorCreatedAt;
}

/**
 * Choose the READY production deployment a rollback may restore.
 * `deployments` is newest-first. Index 0 is the current deploy.
 * An explicit target id wins when that deployment is in the list.
 */
export function selectRollbackTarget(deployments, options = {}) {
  const list = Array.isArray(deployments) ? deployments : [];
  const appLabel = trimmed(options.appLabel) || 'app';
  const explicitTargetId = trimmed(options.explicitTargetId);
  const floorDeploymentId =
    trimmed(options.floorDeploymentId) || DEFAULT_ADMIN_ROLLBACK_FLOOR_DEPLOYMENT_ID;

  if (explicitTargetId) {
    const found = list.find((deployment) => deploymentId(deployment) === explicitTargetId) || null;
    return {
      target: found,
      rollback: Boolean(found),
      reason: found ? 'explicit-target' : 'explicit-target-missing',
    };
  }

  if (list.length < 2) {
    return { target: null, rollback: false, reason: 'no-previous' };
  }

  if (appLabel !== 'admin') {
    return { target: list[1], rollback: true, reason: 'previous' };
  }

  const floorCreatedAt = resolveFloorCreatedAt(list, floorDeploymentId, options.floorCreatedAt);
  for (const candidate of list.slice(1)) {
    if (isAtOrAfterAdminFloor(candidate, floorDeploymentId, floorCreatedAt)) {
      return { target: candidate, rollback: true, reason: 'at-or-after-floor' };
    }
  }
  return { target: null, rollback: false, reason: 'below-floor' };
}

export function rollbackRefusalMessage(decision, context = {}) {
  const appLabel = context.appLabel || 'app';
  if (decision?.reason === 'below-floor') {
    return `No admin production deployment at or after floor ${context.floorDeploymentId} is eligible for automatic rollback. No rollback was performed.`;
  }
  if (decision?.reason === 'explicit-target-missing') {
    return `Explicit rollback target ${context.explicitTargetId} is not a READY production deployment for ${appLabel}. No rollback was performed.`;
  }
  const foundCount = context.foundCount ?? 0;
  return `No previous READY production deployment for ${appLabel} (found ${foundCount}). Broken deploy may still be live.`;
}

function readOverride(flagValue, envValue, fallback = '') {
  const flag = trimmed(flagValue);
  if (flag) return flag;
  const env = trimmed(envValue);
  if (env) return env;
  return fallback;
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
      'admin-rollback-floor': { type: 'string' },
      'target-deployment-id': { type: 'string' },
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

async function api(path, init = {}) {
  const url = new URL(path.startsWith('http') ? path : `${API}${path}`);
  if (!url.searchParams.has('teamId')) url.searchParams.set('teamId', teamId);
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
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

async function lookupDeploymentCreatedAt(id) {
  try {
    const data = await api(`/v13/deployments/${encodeURIComponent(id)}`);
    return deploymentCreatedMs(data);
  } catch {
    return null;
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

  const deps = await listReadyProdDeployments();
  const explicitTargetId = readOverride(
    values['target-deployment-id'],
    process.env.ROLLBACK_TARGET_DEPLOYMENT_ID,
  );
  const floorDeploymentId =
    appLabel === 'admin'
      ? readOverride(
          values['admin-rollback-floor'],
          process.env.ADMIN_ROLLBACK_FLOOR_DEPLOYMENT_ID,
          DEFAULT_ADMIN_ROLLBACK_FLOOR_DEPLOYMENT_ID,
        )
      : '';

  let floorCreatedAt;
  if (appLabel === 'admin' && !explicitTargetId) {
    floorCreatedAt = resolveFloorCreatedAt(deps, floorDeploymentId);
    if (floorCreatedAt == null) {
      floorCreatedAt = await lookupDeploymentCreatedAt(floorDeploymentId);
      if (floorCreatedAt == null) {
        die(
          1,
          `Admin rollback floor ${floorDeploymentId} was not found. No rollback was performed.`,
        );
      }
    }
  }

  const decision = selectRollbackTarget(deps, {
    appLabel,
    explicitTargetId,
    floorDeploymentId,
    floorCreatedAt,
  });
  if (!decision.rollback || !decision.target) {
    die(
      1,
      rollbackRefusalMessage(decision, {
        appLabel,
        floorDeploymentId,
        explicitTargetId,
        foundCount: deps.length,
      }),
    );
  }

  const broken = deps[0];
  const previous = decision.target;
  if (!broken?.uid || !previous.uid) {
    die(1, `Rollback target for ${appLabel} is missing a deployment id. No rollback was performed.`);
  }
  console.log(`Newest (broken candidate): ${broken.uid} https://${broken.url}`);
  console.log(`Restore target:            ${previous.uid} https://${previous.url}`);
  if (appLabel === 'admin' && !explicitTargetId) {
    console.log(`Admin rollback floor:      ${floorDeploymentId}`);
  }

  if (!PRODUCTION_ALIASES[appLabel]) {
    die(
      1,
      `No production alias allowlist for ${appLabel}. Refusing to move every alias.`,
    );
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

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
