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
 *     --project-id prj_… [--app-label api]
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

/** Aliases on the newest deploy that this app is allowed to move. */
export function aliasesToMove(appLabel, aliasesOnNewest) {
  const allow = PRODUCTION_ALIASES[appLabel];
  if (!allow) return null;
  const allowed = new Set(allow);
  return (aliasesOnNewest || []).filter((a) => a?.alias && allowed.has(a.alias));
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
  initCli();
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
