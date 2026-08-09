#!/usr/bin/env node
/**
 * revkg — fleet knowledge graph CLI.
 *
 *   revkg scan [--root <path>] [--repo <name>] [--fleet]   full/deterministic scan
 *   revkg search <query> [--kind <k>] [--at <iso>] [--limit <n>]
 *   revkg node <naturalKey>
 *   revkg neighbors <naturalKey> [--depth <n>] [--at <iso>]
 *   revkg at <naturalKey> <iso>
 *   revkg drift [--repo <name>] [--json]                   doc-currency drift report (spec §8.5)
 *   revkg claims-check [--root] [--repo] [--fleet] [--publish] [--json]
 *       Parse claims-evidence, verify path evidence exists; with --publish ingest
 *       claim-scan documents edges into the graph (GAP-462 Phase 3).
 *   revkg extract [--file <path>] [--source <s>] [--dry-run] [--json] [--no-invalidate]
 *       P3 LLM structured extraction from free text (stdin if no --file);
 *       ingests via ingestEpisode unless --dry-run. Requires @revealui/ai +
 *       local/env LLM (Ollama / snaps). Completer is dynamic-import only.
 *       By default invalidates prior edges with same endpoints+relation but
 *       different fact (P3 contradiction ladder).
 *   revkg ingest-handoffs --dir <path> [--limit n] [--dry-run] [--json] [--no-invalidate]
 *       P3 deterministic handoff/memory markdown → episodes (no LLM). Explicit
 *       publish only; default path is rolling handoffs when --dir omitted.
 *
 * Connects to Neon via its own pool (`@revealui/db`'s `createPool`, DATABASE_URL
 * / POSTGRES_URL resolved by `getConnectionIdentity`) rather than the shared
 * app pool: the shared pool's server-tuned defaults (5s connect timeout, 10s
 * query/statement timeout) are wrong for a long-running ingest — they killed
 * real fleet scans against a cold Neon compute (a connect timeout, then a
 * mid-scan "Query read timeout" on the largest repo). This pool uses a much
 * longer connect timeout and a 5-minute query/statement budget, and a small
 * `max` since a CLI scan is a single-threaded ingest, not a request-serving
 * pool. `createPool` (not a direct `pg` import — the raw-SQL `direct-import`
 * gate only allows `pg` inside `packages/db/src/`) is the sanctioned way for
 * this package to get a `pg.Pool`. Embeddings, when a local model is
 * available, come from `@revealui/ai` — loaded lazily so the graph still
 * ingests (with NULL embeddings, deferred backfill) when it is absent or
 * Ollama is down.
 */

import { hostname } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { makePoolExecutor } from '../db/executor.js';
import {
  additiveExtractors,
  CLAIMS_EVIDENCE_REL,
  claimsExtractor,
  missingEvidencePaths,
  parseClaimsEvidenceSource,
  tier1Extractors,
} from '../extractors/index.js';
import { isDir, readJsonFile, readTextFile } from '../extractors/shared.js';
import { applyScan, ingestEpisode } from '../ingest/index.js';
import { resolveNaturalKey } from '../ingest/resolve.js';
import type { NodeKind } from '../ontology/index.js';
import { type DriftCandidate, kgAtTime, kgDrift, kgNeighbors, kgSearch } from '../search/index.js';
import type { Embedder, KgExecutor } from '../types.js';

/** Long-running-ingest pool tuning (spec: cold Neon compute + big-repo scans). */
const CLI_POOL_CONNECT_TIMEOUT_MS = 30_000;
const CLI_POOL_QUERY_TIMEOUT_MS = 300_000;
const CLI_POOL_MAX_CLIENTS = 5;

/** Target host to surface on a connection error, without ever printing the full URL/credentials. */
let lastTargetHost: string | undefined;

function describeTargetHost(identity: { connectionString?: string; host?: string }): string {
  if (identity.connectionString) {
    try {
      return new URL(identity.connectionString).hostname;
    } catch {
      return '(unparseable connection string)';
    }
  }
  return identity.host ?? 'localhost';
}

function out(line: string): void {
  process.stdout.write(`${line}\n`);
}

function fail(message: string): never {
  process.stderr.write(`revkg: ${message}\n`);
  process.exit(1);
}

interface ParsedArgs {
  positionals: string[];
  flags: Map<string, string>;
  bools: Set<string>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags = new Map<string, string>();
  const bools = new Set<string>();
  const boolFlags = new Set(['fleet', 'json', 'publish', 'dry-run', 'no-invalidate']);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) continue;
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (boolFlags.has(key)) {
        bools.add(key);
      } else {
        const value = argv[i + 1];
        if (value !== undefined) {
          flags.set(key, value);
          i++;
        }
      }
    } else {
      positionals.push(arg);
    }
  }
  return { positionals, flags, bools };
}

async function getExecutor(): Promise<{ exec: KgExecutor; close: () => Promise<void> }> {
  const { createPool, getConnectionIdentity } = await import('@revealui/db/pool');
  const identity = getConnectionIdentity();
  lastTargetHost = describeTargetHost(identity);

  const pool = createPool({
    connectionTimeoutMillis: CLI_POOL_CONNECT_TIMEOUT_MS,
    queryTimeoutMillis: CLI_POOL_QUERY_TIMEOUT_MS,
    statementTimeoutMillis: CLI_POOL_QUERY_TIMEOUT_MS,
    max: CLI_POOL_MAX_CLIENTS,
  });
  pool.on('error', (error) => {
    process.stderr.write(
      `revkg: pool error (host: ${lastTargetHost}): ${error instanceof Error ? error.message : String(error)}\n`,
    );
  });

  return {
    exec: makePoolExecutor(pool),
    close: () => pool.end(),
  };
}

interface EmbeddingModule {
  generateEmbedding(text: string): Promise<{ vector: number[] }>;
}

async function loadEmbedder(): Promise<Embedder | undefined> {
  try {
    // Non-literal specifier: `@revealui/ai` is an optional (Pro) dependency, so
    // the core package must not carry a hard type/import edge to it.
    const specifier = '@revealui/ai/embeddings';
    const ai = (await import(specifier)) as EmbeddingModule;
    return async (text: string): Promise<number[]> => {
      const result = await ai.generateEmbedding(text);
      return result.vector;
    };
  } catch {
    return undefined;
  }
}

function isRepoRoot(path: string): boolean {
  return (
    isDir(join(path, '.git')) ||
    readTextFile(join(path, 'pnpm-workspace.yaml')) !== null ||
    readJsonFile(join(path, 'package.json')) !== null
  );
}

async function scanRepo(
  exec: KgExecutor,
  repoRoot: string,
  repo: string,
  embedder: Embedder | undefined,
): Promise<void> {
  const ctx = { repoRoot, repo, siteId: hostname(), now: new Date() };
  let nodes = 0;
  let edges = 0;
  for (const extractor of tier1Extractors) {
    const products = await extractor.extract(ctx);
    for (const product of products) {
      const result = await applyScan(exec, product, { embedder, recordOutbox: true });
      nodes += result.nodeCount;
      edges += result.edgeCount;
    }
  }
  for (const extractor of additiveExtractors) {
    const products = await extractor.extract(ctx);
    for (const product of products) {
      const result = await ingestEpisode(exec, product, { embedder, recordOutbox: true });
      nodes += result.nodeCount;
      edges += result.edgeCount;
    }
  }
  out(`  ${repo}: ${nodes} nodes, ${edges} edges`);
}

async function cmdScan(args: ParsedArgs): Promise<void> {
  const root = args.flags.get('root') ?? process.cwd();
  const { exec, close } = await getExecutor();
  const embedder = await loadEmbedder();
  if (!embedder) out('  (no embedder available — embeddings deferred)');
  try {
    if (args.bools.has('fleet')) {
      const parent = dirname(root);
      const { readdirSync } = await import('node:fs');
      const entries = readdirSync(parent).filter((e) => !e.startsWith('.'));
      for (const entry of entries) {
        const path = join(parent, entry);
        if (isDir(path) && isRepoRoot(path)) {
          await scanRepo(exec, path, entry, embedder);
        }
      }
    } else {
      const repo = args.flags.get('repo') ?? basename(root);
      if (!isRepoRoot(root)) fail(`${root} does not look like a repo root`);
      await scanRepo(exec, root, repo, embedder);
    }
  } finally {
    await close();
  }
}

async function cmdSearch(args: ParsedArgs): Promise<void> {
  const query = args.positionals.join(' ');
  if (!query) fail('search requires a query');
  const { exec, close } = await getExecutor();
  try {
    const kind = args.flags.get('kind');
    const atRaw = args.flags.get('at');
    const result = await kgSearch(exec, {
      query,
      kinds: kind ? [kind as NodeKind] : undefined,
      at: atRaw ? new Date(atRaw) : undefined,
      limit: args.flags.has('limit') ? Number(args.flags.get('limit')) : 20,
    });
    out(`nodes (${result.nodes.length}):`);
    for (const n of result.nodes) {
      out(`  [${n.kind}] ${n.name}  ${n.naturalKey}  score=${n.score.toFixed(4)}`);
    }
    out(`facts (${result.facts.length}):`);
    for (const f of result.facts) {
      out(`  (${f.relation}) ${f.fact}  mentions=${f.mentions}`);
    }
  } finally {
    await close();
  }
}

async function resolveOrFail(exec: KgExecutor, naturalKey: string): Promise<string> {
  const id = await resolveNaturalKey(exec, naturalKey);
  if (!id) fail(`no node with natural key: ${naturalKey}`);
  return id;
}

async function cmdNode(args: ParsedArgs): Promise<void> {
  const naturalKey = args.positionals[0];
  if (!naturalKey) fail('node requires a natural key');
  const { exec, close } = await getExecutor();
  try {
    const id = await resolveOrFail(exec, naturalKey);
    const rows = await exec.query<{ kind: string; name: string; summary: string | null }>(
      `SELECT kind, name, summary FROM kg_nodes WHERE id = $1`,
      [id],
    );
    const node = rows[0];
    if (!node) fail(`node ${id} vanished`);
    out(`[${node.kind}] ${node.name}`);
    if (node.summary) out(`  ${node.summary}`);
    const facts = await kgAtTime(exec, id, new Date());
    out(`current facts (${facts.length}):`);
    for (const f of facts) out(`  (${f.relation}) ${f.fact}`);
  } finally {
    await close();
  }
}

async function cmdNeighbors(args: ParsedArgs): Promise<void> {
  const naturalKey = args.positionals[0];
  if (!naturalKey) fail('neighbors requires a natural key');
  const { exec, close } = await getExecutor();
  try {
    const id = await resolveOrFail(exec, naturalKey);
    const atRaw = args.flags.get('at');
    const result = await kgNeighbors(exec, id, {
      depth: args.flags.has('depth') ? Number(args.flags.get('depth')) : 1,
      at: atRaw ? new Date(atRaw) : undefined,
    });
    out(`neighbors (${result.nodes.length}):`);
    for (const n of result.nodes) {
      out(`  [${n.kind}] ${n.name}  (${n.distance} hop)`);
    }
  } finally {
    await close();
  }
}

async function cmdAt(args: ParsedArgs): Promise<void> {
  const naturalKey = args.positionals[0];
  const iso = args.positionals[1];
  if (!(naturalKey && iso)) fail('at requires <naturalKey> <iso>');
  const { exec, close } = await getExecutor();
  try {
    const id = await resolveOrFail(exec, naturalKey);
    const facts = await kgAtTime(exec, id, new Date(iso));
    out(`facts as of ${iso} (${facts.length}):`);
    for (const f of facts) out(`  (${f.relation}) ${f.fact}`);
  } finally {
    await close();
  }
}

function formatDriftRow(c: DriftCandidate): string {
  const days = (c.deltaSeconds / 86_400).toFixed(1);
  const episodes = c.episodeIds.length > 0 ? c.episodeIds.join(',') : 'none';
  return `  +${days}d  doc=[${c.docKind}] ${c.docNaturalKey}  code=[${c.codeKind}] ${c.codeNaturalKey}  episodes=${episodes}`;
}

async function cmdDrift(args: ParsedArgs): Promise<void> {
  const repo = args.flags.get('repo');
  const { exec, close } = await getExecutor();
  try {
    const candidates = await kgDrift(exec, { repo });
    if (args.bools.has('json')) {
      out(JSON.stringify(candidates, null, 2));
      return;
    }
    out(`drift candidates (${candidates.length}):`);
    for (const c of candidates) out(formatDriftRow(c));
  } finally {
    await close();
  }
}

interface ClaimsCheckSummary {
  repo: string;
  root: string;
  claims: number;
  documentsEdges: number;
  missingEvidence: number;
  published: boolean;
  issues: ReturnType<typeof missingEvidencePaths>;
}

async function claimsCheckOne(
  root: string,
  repo: string,
  publish: boolean,
  embedder: Embedder | undefined,
  exec: KgExecutor | undefined,
): Promise<ClaimsCheckSummary> {
  const text = readTextFile(join(root, CLAIMS_EVIDENCE_REL));
  if (text === null) {
    return {
      repo,
      root,
      claims: 0,
      documentsEdges: 0,
      missingEvidence: 0,
      published: false,
      issues: [],
    };
  }

  const claims = parseClaimsEvidenceSource(text, CLAIMS_EVIDENCE_REL);
  const issues = missingEvidencePaths(root, claims, repo);

  const products = await claimsExtractor.extract({
    repoRoot: root,
    repo,
    siteId: hostname(),
    now: new Date(),
  });
  const documentsEdges = products.reduce(
    (n, p) => n + p.edges.filter((e) => e.relation === 'documents').length,
    0,
  );

  let published = false;
  if (publish) {
    if (!exec) fail('claims-check --publish requires a database connection');
    for (const product of products) {
      await applyScan(exec, product, { embedder, recordOutbox: true });
    }
    published = products.length > 0;
  }

  return {
    repo,
    root,
    claims: claims.length,
    documentsEdges,
    missingEvidence: issues.length,
    published,
    issues,
  };
}

async function cmdClaimsCheck(args: ParsedArgs): Promise<void> {
  const root = args.flags.get('root') ?? process.cwd();
  const publish = args.bools.has('publish');
  const summaries: ClaimsCheckSummary[] = [];

  let exec: KgExecutor | undefined;
  let close: (() => Promise<void>) | undefined;
  let embedder: Embedder | undefined;
  if (publish) {
    const pool = await getExecutor();
    exec = pool.exec;
    close = pool.close;
    embedder = await loadEmbedder();
    if (!embedder) out('  (no embedder available — embeddings deferred)');
  }

  try {
    if (args.bools.has('fleet')) {
      const parent = dirname(root);
      const { readdirSync } = await import('node:fs');
      const entries = readdirSync(parent).filter((e) => !e.startsWith('.'));
      for (const entry of entries) {
        const path = join(parent, entry);
        if (!(isDir(path) && isRepoRoot(path))) continue;
        const evidence = join(path, CLAIMS_EVIDENCE_REL);
        if (readTextFile(evidence) === null) continue;
        summaries.push(await claimsCheckOne(path, entry, publish, embedder, exec));
      }
    } else {
      const repo = args.flags.get('repo') ?? basename(root);
      if (!isRepoRoot(root)) fail(`${root} does not look like a repo root`);
      summaries.push(await claimsCheckOne(root, repo, publish, embedder, exec));
    }
  } finally {
    if (close) await close();
  }

  if (args.bools.has('json')) {
    out(JSON.stringify(summaries, null, 2));
  } else {
    for (const s of summaries) {
      out(
        `${s.repo}: ${s.claims} claims, ${s.documentsEdges} documents edges, ${s.missingEvidence} missing evidence${s.published ? ' (published)' : ''}`,
      );
      for (const issue of s.issues.slice(0, 20)) {
        out(`  missing  ${issue.exportPath}  ${issue.evidenceRef}`);
      }
      if (s.issues.length > 20) out(`  … ${s.issues.length - 20} more`);
    }
  }

  const totalMissing = summaries.reduce((n, s) => n + s.missingEvidence, 0);
  if (totalMissing > 0) process.exit(1);
  if (summaries.length === 0) {
    out('claims-check: no claims-evidence.ts found');
    process.exit(1);
  }
}

async function cmdExtract(args: ParsedArgs): Promise<void> {
  const file = args.flags.get('file');
  let text: string;
  if (file) {
    const body = readTextFile(file);
    if (body === null) fail(`cannot read ${file}`);
    text = body;
  } else if (args.positionals.length > 0) {
    text = args.positionals.join(' ');
  } else {
    // stdin
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    }
    text = Buffer.concat(chunks).toString('utf8');
  }
  if (!text.trim()) fail('extract requires text (--file, positionals, or stdin)');

  const { extractEpisodeFromText } = await import('../extractors/llm-episode.js');
  const source = args.flags.get('source') ?? 'revkg-extract';
  const siteId = args.flags.get('site') ?? hostname();
  const dryRun = args.bools.has('dry-run');

  const complete = await loadLlmCompleter();
  const { extraction, ingest } = await extractEpisodeFromText(text, {
    complete,
    source,
    siteId,
    episodeType: 'agent-fact',
  });

  if (args.bools.has('json')) {
    out(JSON.stringify({ extraction, dryRun }, null, 2));
  } else {
    out(`extracted ${extraction.nodes.length} nodes, ${extraction.edges.length} edges`);
    for (const n of extraction.nodes.slice(0, 20)) {
      out(`  [${n.kind}] ${n.naturalKey}`);
    }
    for (const e of extraction.edges.slice(0, 20)) {
      out(`  (${e.relation}) ${e.fact.slice(0, 80)}`);
    }
  }

  if (dryRun) {
    out('dry-run: not ingested');
    return;
  }

  const { exec, close } = await getExecutor();
  try {
    const embedder = await loadEmbedder();
    const invalidate = !args.bools.has('no-invalidate');
    const result = await ingestEpisode(exec, ingest, {
      embedder,
      recordOutbox: true,
      invalidateContradictions: invalidate,
    });
    out(
      `ingested episodeId=${result.episodeId} nodes=${result.nodeCount} edges=${result.edgeCount} invalidated=${result.invalidatedEdgeIds.length}`,
    );
  } finally {
    await close();
  }
}

/**
 * Deterministic handoff/memory ingest (no LLM). Explicit publish only.
 * Default dir: REVFLEET_HANDOFFS or ~/revfleet/.jv/docs/handoffs/rolling.
 */
async function cmdIngestHandoffs(args: ParsedArgs): Promise<void> {
  const { loadMarkdownSources, textSourceToEpisode } = await import(
    '../extractors/handoff-memory.js'
  );
  const defaultDir =
    process.env.REVFLEET_HANDOFFS ??
    join(process.env.HOME ?? '', 'revfleet/.jv/docs/handoffs/rolling');
  const dir = args.flags.get('dir') ?? defaultDir;
  const limitRaw = args.flags.get('limit');
  const limit = limitRaw !== undefined ? Number.parseInt(limitRaw, 10) : 50;
  if (!Number.isFinite(limit) || limit < 1) fail('--limit must be a positive integer');

  const sources = loadMarkdownSources(dir, { limit });
  if (sources.length === 0) {
    out(`no markdown sources under ${dir}`);
    return;
  }

  const siteId = args.flags.get('site') ?? hostname();
  const dryRun = args.bools.has('dry-run');
  const invalidate = !args.bools.has('no-invalidate');
  const episodes = sources.map((s) =>
    textSourceToEpisode(s, { siteId, sourceLabel: `handoff:${s.path}` }),
  );

  if (args.bools.has('json')) {
    out(
      JSON.stringify(
        {
          dir,
          dryRun,
          count: episodes.length,
          episodes: episodes.map((e) => ({
            source: e.episode.source,
            nodes: e.nodes.length,
            edges: e.edges.length,
          })),
        },
        null,
        2,
      ),
    );
  } else {
    out(`handoffs: ${episodes.length} file(s) from ${dir}`);
    for (const e of episodes.slice(0, 20)) {
      out(`  ${e.episode.source} → ${e.nodes.length}n/${e.edges.length}e`);
    }
  }

  if (dryRun) {
    out('dry-run: not ingested');
    return;
  }

  const { exec, close } = await getExecutor();
  try {
    const embedder = await loadEmbedder();
    let nodes = 0;
    let edges = 0;
    let invalidated = 0;
    for (const ep of episodes) {
      const result = await ingestEpisode(exec, ep, {
        embedder,
        recordOutbox: true,
        invalidateContradictions: invalidate,
      });
      nodes += result.nodeCount;
      edges += result.edgeCount;
      invalidated += result.invalidatedEdgeIds.length;
    }
    out(`ingested nodes=${nodes} edges=${edges} invalidated=${invalidated}`);
  } finally {
    await close();
  }
}

/** Dynamic @revealui/ai chat → JSON string completer for P3 extract. */
async function loadLlmCompleter(): Promise<(prompt: string, userText: string) => Promise<string>> {
  try {
    const specifier = '@revealui/ai';
    const ai = (await import(specifier)) as {
      createLLMClientFromEnv: () => {
        chat(
          messages: Array<{ role: string; content: string }>,
          options?: { temperature?: number; maxTokens?: number },
        ): Promise<{ content?: string; text?: string; message?: { content?: string } }>;
      };
    };
    const client = ai.createLLMClientFromEnv();
    return async (prompt: string, userText: string): Promise<string> => {
      const res = await client.chat(
        [
          { role: 'system', content: prompt },
          { role: 'user', content: userText },
        ],
        { temperature: 0.1, maxTokens: 4096 },
      );
      if (typeof res.content !== 'string' || !res.content.trim()) {
        throw new Error('LLM returned empty content for extract');
      }
      return res.content;
    };
  } catch (err) {
    fail(
      `extract requires @revealui/ai + LLM env (Ollama/snaps): ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  switch (command) {
    case 'scan':
      await cmdScan(args);
      break;
    case 'search':
      await cmdSearch(args);
      break;
    case 'node':
      await cmdNode(args);
      break;
    case 'neighbors':
      await cmdNeighbors(args);
      break;
    case 'at':
      await cmdAt(args);
      break;
    case 'drift':
      await cmdDrift(args);
      break;
    case 'claims-check':
      await cmdClaimsCheck(args);
      break;
    case 'extract':
      await cmdExtract(args);
      break;
    case 'ingest-handoffs':
      await cmdIngestHandoffs(args);
      break;
    default:
      out(
        'usage: revkg <scan|search|node|neighbors|at|drift|claims-check|extract|ingest-handoffs> [...]',
      );
      process.exit(command ? 1 : 0);
  }
}

main().catch((error: unknown) => {
  const hostSuffix = lastTargetHost ? ` (target host: ${lastTargetHost})` : '';
  fail(`${error instanceof Error ? error.message : String(error)}${hostSuffix}`);
});
