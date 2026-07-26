'use client';

import type { NodeKind } from '@revealui/knowledge-graph/ontology';
import { NODE_KINDS } from '@revealui/knowledge-graph/ontology';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Select,
  Skeleton,
  Textarea,
} from '@revealui/presentation';
import type { KgEdgeRecord, KgNodeRecord } from '@revealui/sync';
import { ClientOnly, useKgViewDocument, useKnowledgeGraph } from '@revealui/sync';
import { useEffect, useMemo, useState } from 'react';
import { LicenseGate } from '@/lib/components/LicenseGate';

// =============================================================================
// Helpers
// =============================================================================

const SLUG_CHARS = new Set('abcdefghijklmnopqrstuvwxyz0123456789-');

/** Map a repo name (e.g. `.jv`, `revealui`) to a valid kg-view slug. No authored regex. */
function toViewSlug(repo: string | undefined): string {
  if (!repo) return 'fleet';
  const mapped = Array.from(repo.toLowerCase())
    .map((c) => (SLUG_CHARS.has(c) ? c : '-'))
    .join('');
  const trimmed = mapped
    .split('-')
    .filter((part) => part.length > 0)
    .join('-');
  return trimmed.length > 0 ? trimmed.slice(0, 64) : 'fleet';
}

function isEdgeLiveAt(edge: KgEdgeRecord, at: Date | null): boolean {
  if (!at) return edge.invalid_at === null;
  const validAt = new Date(edge.valid_at);
  if (validAt > at) return false;
  if (edge.invalid_at && new Date(edge.invalid_at) <= at) return false;
  return true;
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

// =============================================================================
// Page
// =============================================================================

export default function KnowledgeGraphPage() {
  return (
    <LicenseGate feature="ai">
      {/* Shape hooks need a browser origin (Electric requires an absolute URL). */}
      <ClientOnly>
        <KnowledgeGraphExplorer />
      </ClientOnly>
    </LicenseGate>
  );
}

function KnowledgeGraphExplorer() {
  const [availableRepos, setAvailableRepos] = useState<string[]>([]);
  const [reposLoading, setReposLoading] = useState(true);
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [kindFilter, setKindFilter] = useState<'all' | NodeKind>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [pointInTime, setPointInTime] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/kg/repos', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { repos: [] }))
      .then((data: { repos?: string[] }) => {
        if (!cancelled) setAvailableRepos(data.repos ?? []);
      })
      .catch(() => {
        if (!cancelled) setAvailableRepos([]);
      })
      .finally(() => {
        if (!cancelled) setReposLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { nodes, edges, edgeEpisodes, isLoading, error } = useKnowledgeGraph(
    selectedRepo || undefined,
  );

  const at = pointInTime ? new Date(pointInTime) : null;

  const filteredNodes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return nodes
      .filter((n) => kindFilter === 'all' || n.kind === kindFilter)
      .filter(
        (n) =>
          q.length === 0 ||
          n.name.toLowerCase().includes(q) ||
          n.natural_key.toLowerCase().includes(q),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [nodes, kindFilter, searchQuery]);

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const selectedNode = selectedNodeId ? (nodeById.get(selectedNodeId) ?? null) : null;

  return (
    <div className="min-h-screen">
      <div className="border-b border-border bg-card px-6 py-4">
        <h1 className="text-xl font-semibold text-foreground">Knowledge Graph</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Read-only, canonical-state view of the fleet knowledge graph (GAP-349). Curation
          annotations and pins are ephemeral until flushed to an episode; the graph itself is never
          written from this screen.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted px-6 py-3">
        <div className="w-48">
          <Select
            aria-label="Repo"
            value={selectedRepo}
            onChange={(e) => {
              setSelectedRepo(e.target.value);
              setSelectedNodeId(null);
            }}
            disabled={reposLoading}
          >
            <option value="">All repos</option>
            {availableRepos.map((repo) => (
              <option key={repo} value={repo}>
                {repo}
              </option>
            ))}
          </Select>
        </div>

        <div className="w-40">
          <Select
            aria-label="Node kind"
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as 'all' | NodeKind)}
          >
            <option value="all">All kinds</option>
            {NODE_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </Select>
        </div>

        <div className="w-64">
          <Input
            aria-label="Search by name"
            placeholder="Search by name or natural key"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="kg-point-in-time" className="text-xs text-muted-foreground">
            Point in time
          </label>
          <Input
            id="kg-point-in-time"
            type="date"
            value={pointInTime}
            onChange={(e) => setPointInTime(e.target.value)}
            className="rounded-lg border border-input bg-transparent px-2 py-1 text-sm text-foreground"
          />
          {pointInTime && (
            <Button appearance="ghost" variant="neutral" onClick={() => setPointInTime('')}>
              Clear
            </Button>
          )}
        </div>

        <span className="ml-auto text-xs text-muted-foreground">
          {filteredNodes.length} of {nodes.length} nodes
          {selectedRepo ? ` in ${selectedRepo}` : ' (all repos)'}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="border-r border-border p-4">
          {isLoading && nodes.length === 0 ? (
            <div className="flex flex-col gap-2" role="status" aria-label="Loading nodes">
              {Array.from({ length: 4 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : error ? (
            <div
              role="alert"
              className="rounded-lg border border-error/30 bg-error/10 p-4 text-sm text-error"
            >
              {error.message}
            </div>
          ) : filteredNodes.length === 0 ? (
            <EmptyState
              title={selectedRepo ? 'No nodes match' : 'Pick a repo or search'}
              description={
                selectedRepo
                  ? 'No nodes match the current filter in this repo.'
                  : 'Select a repo above, or search across the whole fleet graph.'
              }
            />
          ) : (
            <ul className="flex flex-col gap-1">
              {filteredNodes.map((node) => (
                <li key={node.id}>
                  <Button
                    type="button"
                    appearance="ghost"
                    variant="neutral"
                    onClick={() => setSelectedNodeId(node.id)}
                    aria-current={selectedNodeId === node.id}
                    className={`h-auto w-full rounded-lg border px-3 py-2 text-left ${
                      selectedNodeId === node.id
                        ? 'border-ring bg-card'
                        : 'border-transparent hover:border-border hover:bg-card'
                    }`}
                  >
                    <div className="flex w-full flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <Badge color="muted">{node.kind}</Badge>
                        <span className="truncate text-sm text-foreground">{node.name}</span>
                      </div>
                      <div className="truncate font-mono text-xs text-muted-foreground">
                        {node.natural_key}
                      </div>
                    </div>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-4">
          {selectedNode ? (
            <NodeDetailPane
              node={selectedNode}
              edges={edges}
              edgeEpisodes={edgeEpisodes}
              nodeById={nodeById}
              at={at}
              viewSlug={toViewSlug(selectedRepo || undefined)}
            />
          ) : (
            <EmptyState
              title="No node selected"
              description="Select a node from the list to see its detail."
            />
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Node detail pane
// =============================================================================

interface NodeDetailPaneProps {
  node: KgNodeRecord;
  edges: KgEdgeRecord[];
  edgeEpisodes: Array<{ edge_id: string; episode_id: string }>;
  nodeById: Map<string, KgNodeRecord>;
  at: Date | null;
  viewSlug: string;
}

function NodeDetailPane({
  node,
  edges,
  edgeEpisodes,
  nodeById,
  at,
  viewSlug,
}: NodeDetailPaneProps) {
  const overlay = useKgViewDocument(viewSlug);
  const [annotationDraft, setAnnotationDraft] = useState('');
  const [flushStatus, setFlushStatus] = useState<'idle' | 'flushing' | 'flushed' | 'error'>('idle');

  useEffect(() => {
    setAnnotationDraft(overlay.state.annotations.get(node.id)?.text ?? '');
    setFlushStatus('idle');
  }, [node.id, overlay.state.annotations]);

  const facts = useMemo(() => {
    return edges
      .filter((e) => e.source_id === node.id || e.target_id === node.id)
      .filter((e) => isEdgeLiveAt(e, at))
      .map((e) => {
        const otherId = e.source_id === node.id ? e.target_id : e.source_id;
        const other = nodeById.get(otherId);
        const provenance = edgeEpisodes
          .filter((ee) => ee.edge_id === e.id)
          .map((ee) => ee.episode_id);
        return { edge: e, other, provenance };
      })
      .sort((a, b) => b.edge.valid_at.localeCompare(a.edge.valid_at));
  }, [edges, node.id, at, nodeById, edgeEpisodes]);

  const isPinned = overlay.state.pins.has(node.id);

  async function handleAnnotate() {
    await overlay.annotate(node.id, annotationDraft, 'admin-explorer');
  }

  async function handleTogglePin() {
    await overlay.setPinned(node.id, !isPinned);
  }

  async function handleFlush() {
    setFlushStatus('flushing');
    try {
      const response = await fetch('/api/sync/kg-episodes', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          viewSlug,
          source: `kg-curation:${viewSlug}`,
          content: annotationDraft,
          nodes: [
            { kind: 'agent', name: 'admin-explorer', naturalKey: 'agent:admin-explorer' },
            {
              kind: node.kind,
              name: node.name,
              naturalKey: node.natural_key,
              repo: node.repo ?? undefined,
            },
          ],
          edges: [
            {
              source: { kind: 'agent', naturalKey: 'agent:admin-explorer' },
              target: { kind: node.kind, naturalKey: node.natural_key },
              relation: 'discovered',
              fact: annotationDraft,
              repo: node.repo ?? undefined,
            },
          ],
        }),
      });
      setFlushStatus(response.ok ? 'flushed' : 'error');
    } catch {
      setFlushStatus('error');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="p-4">
          <div className="flex items-center gap-2">
            <Badge color="muted">{node.kind}</Badge>
            <h2 className="text-lg font-semibold text-foreground">{node.name}</h2>
            {isPinned && <Badge color="warning">pinned</Badge>}
          </div>
          <div className="mt-1 font-mono text-xs text-muted-foreground">{node.natural_key}</div>
          {node.repo && <div className="mt-1 text-xs text-muted-foreground">repo: {node.repo}</div>}
          {node.summary && <p className="mt-3 text-sm text-foreground">{node.summary}</p>}
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <span>First seen: {formatTimestamp(node.first_seen_at)}</span>
            <span>Last confirmed: {formatTimestamp(node.last_confirmed_at)}</span>
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-4">
          <h3 className="text-sm font-medium text-foreground">Attributes</h3>
          {Object.keys(node.attributes ?? {}).length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">No attributes.</p>
          ) : (
            <pre className="mt-2 overflow-x-auto rounded-lg bg-muted p-3 text-xs text-foreground">
              {JSON.stringify(node.attributes, null, 2)}
            </pre>
          )}
        </div>
      </Card>

      <Card>
        <div className="p-4">
          <h3 className="text-sm font-medium text-foreground">
            Facts {at ? `as of ${at.toLocaleDateString()}` : '(current)'}
          </h3>
          {facts.length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">No facts.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {facts.map(({ edge, other, provenance }) => (
                <li key={edge.id} className="rounded-lg border border-border p-2 text-sm">
                  <div>
                    <Badge color="muted">{edge.relation}</Badge>{' '}
                    <span className="text-foreground">{edge.fact}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {other && (
                      <span>
                        {edge.source_id === node.id ? '→' : '←'} {other.name}
                      </span>
                    )}
                    <span>valid: {formatTimestamp(edge.valid_at)}</span>
                    <span>episodes: {provenance.length > 0 ? provenance.join(', ') : 'none'}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <Card>
        <div className="p-4">
          <h3 className="text-sm font-medium text-foreground">Curation (view: {viewSlug})</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Ephemeral until flushed. Never writes the graph directly.
          </p>
          <Textarea
            className="mt-2"
            rows={3}
            placeholder="Annotate this node…"
            value={annotationDraft}
            onChange={(e) => setAnnotationDraft(e.target.value)}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button onClick={handleAnnotate} disabled={!annotationDraft.trim()}>
              Save annotation
            </Button>
            <Button appearance="ghost" variant="neutral" onClick={handleTogglePin}>
              {isPinned ? 'Unpin' : 'Pin'}
            </Button>
            <Button
              appearance="outline"
              variant="neutral"
              onClick={handleFlush}
              disabled={!annotationDraft.trim() || flushStatus === 'flushing'}
            >
              {flushStatus === 'flushing' ? 'Flushing…' : 'Flush to episode'}
            </Button>
          </div>
          {flushStatus === 'flushed' && (
            <p className="mt-2 text-xs text-success">Flushed as a manual episode.</p>
          )}
          {flushStatus === 'error' && (
            <p className="mt-2 text-xs text-error">Flush failed — try again.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
