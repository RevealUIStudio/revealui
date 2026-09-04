'use client';

import { Button, EmptyState, Skeleton } from '@revealui/presentation';
import type { KgEdgeRecord, KgNodeRecord } from '@revealui/sync';
import { type PointerEvent, useCallback, useMemo, useRef, useState } from 'react';
import { isEdgeLiveAt } from './knowledge-graph/is-edge-live';
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  clampToCanvas,
  NODE_RADIUS,
  resolveNodePositions,
  visibleCanvasNodes,
} from './knowledge-graph/layout-positions';

export interface KnowledgeGraphCanvasProps {
  nodes: KgNodeRecord[];
  edges: KgEdgeRecord[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  layout: ReadonlyMap<string, { x: number; y: number }>;
  pins: ReadonlySet<string>;
  onSetLayout: (nodeId: string, x: number, y: number) => Promise<boolean>;
  at: Date | null;
  isLoading: boolean;
  error: Error | null;
}

type DragState = {
  nodeId: string;
  originX: number;
  originY: number;
  startClientX: number;
  startClientY: number;
  x: number;
  y: number;
  moved: boolean;
};

function labelFor(node: KgNodeRecord): string {
  return node.name.length > 22 ? `${node.name.slice(0, 20)}…` : node.name;
}

export function KnowledgeGraphCanvas({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  layout,
  pins,
  onSetLayout,
  at,
  isLoading,
  error,
}: KnowledgeGraphCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  const { visible, truncated } = useMemo(
    () => visibleCanvasNodes(nodes, selectedNodeId),
    [nodes, selectedNodeId],
  );

  const positions = useMemo(() => {
    const resolved = resolveNodePositions(
      visible.map((n) => n.id),
      layout,
    );
    if (drag) resolved.set(drag.nodeId, { x: drag.x, y: drag.y });
    return resolved;
  }, [visible, layout, drag]);

  const visibleIds = useMemo(() => new Set(visible.map((n) => n.id)), [visible]);

  const liveEdges = useMemo(
    () =>
      edges.filter(
        (e) => isEdgeLiveAt(e, at) && visibleIds.has(e.source_id) && visibleIds.has(e.target_id),
      ),
    [edges, at, visibleIds],
  );

  const scaleFromRect = useCallback(() => {
    const rect = svgRef.current?.getBoundingClientRect();
    const width = rect?.width ?? 0;
    const height = rect?.height ?? 0;
    return {
      scaleX: width > 0 ? CANVAS_WIDTH / width : 1,
      scaleY: height > 0 ? CANVAS_HEIGHT / height : 1,
    };
  }, []);

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>, nodeId: string) {
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // jsdom and already-released captures
    }
    const pos = positions.get(nodeId) ?? { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
    const next: DragState = {
      nodeId,
      originX: pos.x,
      originY: pos.y,
      startClientX: event.clientX,
      startClientY: event.clientY,
      x: pos.x,
      y: pos.y,
      moved: false,
    };
    dragRef.current = next;
    setDrag(next);
    onSelectNode(nodeId);
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    const nodeId = event.currentTarget.dataset.nodeId;
    const clientX = event.clientX;
    const clientY = event.clientY;
    setDrag((prev) => {
      if (!prev || prev.nodeId !== nodeId) return prev;
      const { scaleX, scaleY } = scaleFromRect();
      const next = clampToCanvas(
        prev.originX + (clientX - prev.startClientX) * scaleX,
        prev.originY + (clientY - prev.startClientY) * scaleY,
      );
      const moved =
        prev.moved || Math.abs(next.x - prev.originX) > 3 || Math.abs(next.y - prev.originY) > 3;
      const updated = { ...prev, x: next.x, y: next.y, moved };
      dragRef.current = updated;
      return updated;
    });
  }

  function handlePointerUp(event: PointerEvent<HTMLButtonElement>) {
    const current = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // jsdom and already-released captures
    }
    if (current?.moved) {
      void onSetLayout(current.nodeId, current.x, current.y);
    }
  }

  if (isLoading && nodes.length === 0) {
    return (
      <section className="border-b border-border px-6 py-4" aria-label="Knowledge graph canvas">
        <div className="flex flex-col gap-2" role="status">
          <span className="text-xs text-muted-foreground">Loading the graph.</span>
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="border-b border-border px-6 py-4" aria-label="Knowledge graph canvas">
        <div
          role="alert"
          className="rounded-lg border border-error/30 bg-error/10 p-4 text-sm text-error"
        >
          {error.message}
        </div>
      </section>
    );
  }

  if (visible.length === 0) {
    return (
      <section className="border-b border-border px-6 py-4" aria-label="Knowledge graph canvas">
        <EmptyState
          className="py-10"
          title="No graph to draw"
          description="Select a repo or search so nodes appear. The canvas shows Electric data only. It does not invent nodes."
        />
      </section>
    );
  }

  return (
    <section className="border-b border-border px-6 py-4" aria-label="Knowledge graph canvas">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium text-foreground">Graph</h2>
        <p className="text-xs text-muted-foreground">
          Drag a node to save its position in this view.
          {truncated > 0
            ? ` Showing ${visible.length} of ${nodes.length} nodes. Narrow the filter to see the rest.`
            : null}
        </p>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <svg
          ref={svgRef}
          role="img"
          aria-label={`Knowledge graph with ${visible.length} nodes`}
          viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
          className="h-72 w-full touch-none md:h-96"
        >
          <title>Knowledge graph</title>
          {liveEdges.map((edge) => {
            const from = positions.get(edge.source_id);
            const to = positions.get(edge.target_id);
            if (!(from && to)) return null;
            return (
              <line
                key={edge.id}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                className="stroke-border"
                strokeWidth={1.5}
                data-edge-id={edge.id}
              />
            );
          })}
          {visible.map((node) => {
            const pos = positions.get(node.id);
            if (!pos) return null;
            const selected = node.id === selectedNodeId;
            const pinned = pins.has(node.id);
            return (
              <g key={node.id} data-node-id={node.id} transform={`translate(${pos.x} ${pos.y})`}>
                <circle
                  r={NODE_RADIUS}
                  className={
                    selected
                      ? 'fill-primary stroke-primary'
                      : pinned
                        ? 'fill-card stroke-warning'
                        : 'fill-muted stroke-border'
                  }
                  strokeWidth={selected || pinned ? 3 : 1.5}
                  pointerEvents="none"
                />
                <text
                  y={NODE_RADIUS + 14}
                  textAnchor="middle"
                  className="fill-foreground"
                  style={{ fontSize: 11 }}
                  pointerEvents="none"
                >
                  {labelFor(node)}
                </text>
                <foreignObject
                  x={-NODE_RADIUS}
                  y={-NODE_RADIUS}
                  width={NODE_RADIUS * 2}
                  height={NODE_RADIUS * 2}
                >
                  <Button
                    type="button"
                    size="clear"
                    appearance="ghost"
                    variant="neutral"
                    data-node-id={node.id}
                    aria-pressed={selected}
                    aria-label={`${node.kind} ${node.name}`}
                    className="size-full cursor-grab rounded-full bg-transparent p-0"
                    onPointerDown={(event) => handlePointerDown(event, node.id)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                  />
                </foreignObject>
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}
