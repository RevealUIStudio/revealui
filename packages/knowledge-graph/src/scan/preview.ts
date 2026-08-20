/**
 * Extract-only scan preview — no database connection.
 *
 * Used by `revkg scan --dry-run` and the default `revkg scan --fleet` path so
 * CI / PRs can exercise discovery + extractors without writing kg_*.
 */

import { additiveExtractors, tier1Extractors } from '../extractors/index.js';
import type { Extractor, ExtractorContext, ScanProduct } from '../extractors/types.js';
import { applyScan, ingestEpisode } from '../ingest/index.js';
import type { Embedder, KgExecutor, ScanApplyResult } from '../types.js';

export type ExtractorMode = 'scan' | 'additive';

export interface ExtractorPreview {
  name: string;
  mode: ExtractorMode;
  nodeCount: number;
  edgeCount: number;
}

export interface RepoScanPreview {
  repo: string;
  path: string;
  extractors: ExtractorPreview[];
  nodeCount: number;
  edgeCount: number;
}

export interface CollectedProduct {
  extractor: string;
  mode: ExtractorMode;
  product: ScanProduct;
}

export interface CollectedRepoScan {
  repo: string;
  path: string;
  siteId: string;
  products: CollectedProduct[];
}

export interface RepoScanPublishResult {
  repo: string;
  path: string;
  nodeCount: number;
  edgeCount: number;
  results: ScanApplyResult[];
}

async function collectFrom(
  extractors: readonly Extractor[],
  ctx: ExtractorContext,
  mode: ExtractorMode,
): Promise<CollectedProduct[]> {
  const out: CollectedProduct[] = [];
  for (const extractor of extractors) {
    const products = await extractor.extract(ctx);
    for (const product of products) {
      out.push({ extractor: extractor.name, mode, product });
    }
  }
  return out;
}

export async function collectRepoProducts(ctx: ExtractorContext): Promise<CollectedRepoScan> {
  const products = [
    ...(await collectFrom(tier1Extractors, ctx, 'scan')),
    ...(await collectFrom(additiveExtractors, ctx, 'additive')),
  ];
  return {
    repo: ctx.repo,
    path: ctx.repoRoot,
    siteId: ctx.siteId,
    products,
  };
}

export function summarizeCollected(collected: CollectedRepoScan): RepoScanPreview {
  const byExtractor = new Map<string, ExtractorPreview>();
  for (const item of collected.products) {
    const current = byExtractor.get(item.extractor) ?? {
      name: item.extractor,
      mode: item.mode,
      nodeCount: 0,
      edgeCount: 0,
    };
    current.nodeCount += item.product.nodes.length;
    current.edgeCount += item.product.edges.length;
    byExtractor.set(item.extractor, current);
  }
  const extractors = [...byExtractor.values()];
  return {
    repo: collected.repo,
    path: collected.path,
    extractors,
    nodeCount: extractors.reduce((n, e) => n + e.nodeCount, 0),
    edgeCount: extractors.reduce((n, e) => n + e.edgeCount, 0),
  };
}

export async function previewRepoScan(ctx: ExtractorContext): Promise<RepoScanPreview> {
  return summarizeCollected(await collectRepoProducts(ctx));
}

export interface PublishCollectedOptions {
  embedder?: Embedder;
  recordOutbox?: boolean;
}

export async function publishCollected(
  exec: KgExecutor,
  collected: CollectedRepoScan,
  options: PublishCollectedOptions = {},
): Promise<RepoScanPublishResult> {
  const results: ScanApplyResult[] = [];
  let nodeCount = 0;
  let edgeCount = 0;
  for (const item of collected.products) {
    const result =
      item.mode === 'scan'
        ? await applyScan(exec, item.product, {
            embedder: options.embedder,
            recordOutbox: options.recordOutbox ?? true,
          })
        : await ingestEpisode(exec, item.product, {
            embedder: options.embedder,
            recordOutbox: options.recordOutbox ?? true,
          });
    results.push(result);
    nodeCount += result.nodeCount;
    edgeCount += result.edgeCount;
  }
  return {
    repo: collected.repo,
    path: collected.path,
    nodeCount,
    edgeCount,
    results,
  };
}

export async function publishRepoScan(
  exec: KgExecutor,
  ctx: ExtractorContext,
  options: PublishCollectedOptions = {},
): Promise<RepoScanPublishResult> {
  return publishCollected(exec, await collectRepoProducts(ctx), options);
}
