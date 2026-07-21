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
 *   second-most-recent READY production deployment, and re-points every
 *   alias currently on the newest (broken) deploy to that previous one.
 *
 * Usage:
 *   VERCEL_TOKEN=… VERCEL_TEAM_ID=team_… node scripts/deploy/vercel-rollback-previous-prod.mjs \
 *     --project-id prj_… [--app-label api]
 *
 * Exit codes:
 *   0 — previous deploy promoted (aliases reassigned) or nothing to do
 *   1 — hard failure (no history, API error, verify failed)
 *   2 — bad args / missing env
 */
import { parseArgs } from 'node:util';

const API = 'https://api.vercel.com';

function die(code, msg) {
  console.error(msg);
  process.exit(code);
}

const { values } = parseArgs({
  options: {
    'project-id': { type: 'string' },
    'app-label': { type: 'string', default: 'app' },
    'team-id': { type: 'string' },
    token: { type: 'string' },
    dry: { type: 'boolean', default: false },
  },
  allowPositionals: false,
});

const projectId = values['project-id'];
const appLabel = values['app-label'] || 'app';
const token = values.token || process.env.VERCEL_TOKEN;
// Prefer explicit flag, then VERCEL_TEAM_ID, then VERCEL_ORG_ID (fleet secret
// is the team id even when named ORG_ID — see deploy.yml / SECRETS.md).
const teamId =
  values['team-id'] || process.env.VERCEL_TEAM_ID || process.env.VERCEL_ORG_ID || '';

if (!projectId) die(2, 'missing --project-id');
if (!token) die(2, 'missing VERCEL_TOKEN / --token');
if (!teamId) {
  die(
    2,
    'missing team id: pass --team-id or set VERCEL_TEAM_ID / VERCEL_ORG_ID (team_… id, not TURBO_TEAM slug)',
  );
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
  console.log(`=== Rollback previous prod: ${appLabel} (${projectId}) team=${teamId} ===`);

  const deps = await listReadyProdDeployments();
  if (deps.length < 2) {
    die(
      1,
      `No previous READY production deployment for ${appLabel} (found ${deps.length}). Broken deploy may still be live.`,
    );
  }

  const broken = deps[0];
  const previous = deps[1];
  console.log(`Newest (broken candidate): ${broken.uid} https://${broken.url}`);
  console.log(`Previous (restore):        ${previous.uid} https://${previous.url}`);

  const aliases = await listAliasesForDeployment(broken.uid);
  if (aliases.length === 0) {
    // Newest deploy may not own custom aliases yet, or smoke failed before
    // alias assign. Still try to promote known production hostnames if any
    // point at broken via a second list of all aliases that look production.
    console.warn(
      'No aliases currently bound to newest deploy — nothing to reassign via alias list.',
    );
    // Promote previous by assigning its own URL as a no-op check, then exit 1
    // so humans notice: production alias may already be elsewhere.
    die(
      1,
      `Could not discover aliases on newest deploy for ${appLabel}. Manual check required.`,
    );
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

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
