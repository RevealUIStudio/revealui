'use client';

import { useShape } from '@electric-sql/react';
import { fetchWithTimeout } from '../fetch-with-timeout.js';
import { useElectricConfig } from '../provider/index.js';
import { toRecords } from '../shape-utils.js';

/**
 * `useKnowledgeGraph` — read-only Electric shapes over the fleet knowledge
 * graph (GAP-349 P4, design spec §8.2/§9). Backs `/api/shapes/kg-nodes`,
 * `/api/shapes/kg-edges`, and `/api/shapes/kg-edge-episodes`.
 *
 * Deliberately NO mutation functions: Electric sync is read-only for this
 * graph. Writes go through the additive `POST /api/sync/kg-episodes` route
 * (`ingestEpisode`), never through a direct table mutation — see the design
 * spec §8.2 "Down: Electric shapes... Up: write-through API".
 */

export interface KgNodeRecord {
  id: string;
  kind: string;
  name: string;
  natural_key: string;
  repo: string | null;
  summary: string | null;
  attributes: Record<string, unknown>;
  attributes_clock: Record<string, unknown>;
  embedding: number[] | null;
  first_seen_at: string;
  last_confirmed_at: string;
  deleted_at: string | null;
  created_at: string;
}

export interface KgEdgeRecord {
  id: string;
  source_id: string;
  target_id: string;
  relation: string;
  fact: string;
  repo: string | null;
  attributes: Record<string, unknown>;
  embedding: number[] | null;
  valid_at: string;
  invalid_at: string | null;
  created_at: string;
  expired_at: string | null;
}

export interface KgEdgeEpisodeRecord {
  edge_id: string;
  episode_id: string;
}

export interface UseKgNodesResult {
  nodes: KgNodeRecord[];
  isLoading: boolean;
  error: Error | null;
}

export interface UseKgEdgesResult {
  edges: KgEdgeRecord[];
  isLoading: boolean;
  error: Error | null;
}

export interface UseKgEdgeEpisodesResult {
  edgeEpisodes: KgEdgeEpisodeRecord[];
  isLoading: boolean;
  error: Error | null;
}

export interface UseKnowledgeGraphResult {
  nodes: KgNodeRecord[];
  edges: KgEdgeRecord[];
  edgeEpisodes: KgEdgeEpisodeRecord[];
  isLoading: boolean;
  error: Error | null;
}

/** Nodes in the fleet graph, optionally partitioned by `repo`. Omit `repo` to sync the whole fleet. */
export function useKgNodes(repo?: string): UseKgNodesResult {
  const { proxyBaseUrl } = useElectricConfig();
  const { data, isLoading, error } = useShape({
    url: `${proxyBaseUrl}/api/shapes/kg-nodes`,
    params: repo ? { repo } : {},
    fetchClient: fetchWithTimeout,
  });

  return {
    nodes: toRecords<KgNodeRecord>(data),
    isLoading,
    error: error || null,
  };
}

/** Edges (bi-temporal facts) in the fleet graph, optionally partitioned by `repo`. */
export function useKgEdges(repo?: string): UseKgEdgesResult {
  const { proxyBaseUrl } = useElectricConfig();
  const { data, isLoading, error } = useShape({
    url: `${proxyBaseUrl}/api/shapes/kg-edges`,
    params: repo ? { repo } : {},
    fetchClient: fetchWithTimeout,
  });

  return {
    edges: toRecords<KgEdgeRecord>(data),
    isLoading,
    error: error || null,
  };
}

/**
 * The edge -> episode provenance join. Not repo-partitioned — the join
 * table carries no `repo` column (see the `kg-edge-episodes` shape route's
 * header comment for why).
 */
export function useKgEdgeEpisodes(): UseKgEdgeEpisodesResult {
  const { proxyBaseUrl } = useElectricConfig();
  const { data, isLoading, error } = useShape({
    url: `${proxyBaseUrl}/api/shapes/kg-edge-episodes`,
    fetchClient: fetchWithTimeout,
  });

  return {
    edgeEpisodes: toRecords<KgEdgeEpisodeRecord>(data),
    isLoading,
    error: error || null,
  };
}

/** Composite convenience hook: nodes + edges + edge-episode provenance for one `repo` (or the whole fleet). */
export function useKnowledgeGraph(repo?: string): UseKnowledgeGraphResult {
  const { nodes, isLoading: nodesLoading, error: nodesError } = useKgNodes(repo);
  const { edges, isLoading: edgesLoading, error: edgesError } = useKgEdges(repo);
  const {
    edgeEpisodes,
    isLoading: edgeEpisodesLoading,
    error: edgeEpisodesError,
  } = useKgEdgeEpisodes();

  return {
    nodes,
    edges,
    edgeEpisodes,
    isLoading: nodesLoading || edgesLoading || edgeEpisodesLoading,
    error: nodesError || edgesError || edgeEpisodesError,
  };
}
