#!/usr/bin/env node
/**
 * revkg — fleet knowledge graph CLI.
 *
 *   revkg scan [--root <path>] [--repo <name>] [--fleet]   full/deterministic scan
 *   revkg search <query> [--kind <k>] [--at <iso>] [--limit <n>]
 *   revkg node <naturalKey>
 *   revkg neighbors <naturalKey> [--depth <n>] [--at <iso>]
 *   revkg at <naturalKey> <iso>
 *
 * Connects to Neon via `@revealui/db` (POSTGRES_URL / DATABASE_URL). Embeddings,
 * when a local model is available, come from `@revealui/ai` — loaded lazily so
 * the graph still ingests (with NULL embeddings, deferred backfill) when it is
 * absent or Ollama is down.
 */

import { hostname } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { makePoolExecutor } from '../db/executor.js';
import { additiveExtractors, tier1Extractors } from '../extractors/index.js';
import { isDir, readJsonFile, readTextFile } from '../extractors/shared.js';
import { applyScan, ingestEpisode } from '../ingest/index.js';
import { resolveNaturalKey } from '../ingest/resolve.js';
import type { NodeKind } from '../ontology/index.js';
import { kgAtTime, kgNeighbors, kgSearch } from '../search/index.js';
import type { Embedder, KgExecutor } from '../types.js';

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
  const boolFlags = new Set(['fleet']);
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
  const pool = await import('@revealui/db/pool');
  const client = pool.getPool();
  return {
    exec: makePoolExecutor(client),
    close: () => client.end(),
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
    default:
      out('usage: revkg <scan|search|node|neighbors|at> [...]');
      process.exit(command ? 1 : 0);
  }
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
