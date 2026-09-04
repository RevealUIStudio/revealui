export const CANVAS_WIDTH = 960;
export const CANVAS_HEIGHT = 480;
export const NODE_RADIUS = 16;
export const MAX_CANVAS_NODES = 200;

const PADDING = 48;

export type LayoutPoint = { x: number; y: number };

export function clampToCanvas(x: number, y: number): LayoutPoint {
  const min = NODE_RADIUS + 8;
  return {
    x: Math.min(CANVAS_WIDTH - min, Math.max(min, x)),
    y: Math.min(CANVAS_HEIGHT - min, Math.max(min, y)),
  };
}

/** Stable circle layout used when a node has no Yjs `layout:` position yet. */
export function fallbackCirclePosition(index: number, total: number): LayoutPoint {
  const n = Math.max(total, 1);
  const cx = CANVAS_WIDTH / 2;
  const cy = CANVAS_HEIGHT / 2;
  if (n === 1) return { x: cx, y: cy };
  const radius = Math.min(cx, cy) - PADDING;
  const angle = (index / n) * Math.PI * 2 - Math.PI / 2;
  return {
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius,
  };
}

/**
 * Overlay positions win when finite. Missing entries fall back to a
 * deterministic circle so the canvas is never a dark empty frame.
 */
export function resolveNodePositions(
  nodeIds: readonly string[],
  overlay: ReadonlyMap<string, LayoutPoint>,
): Map<string, LayoutPoint> {
  const positions = new Map<string, LayoutPoint>();
  const n = nodeIds.length;
  nodeIds.forEach((id, index) => {
    const stored = overlay.get(id);
    if (stored && Number.isFinite(stored.x) && Number.isFinite(stored.y)) {
      positions.set(id, clampToCanvas(stored.x, stored.y));
      return;
    }
    positions.set(id, fallbackCirclePosition(index, n));
  });
  return positions;
}

/** Cap the drawn set; keep the selected node if it would otherwise fall off. */
export function visibleCanvasNodes<T extends { id: string }>(
  nodes: readonly T[],
  selectedId: string | null,
  max = MAX_CANVAS_NODES,
): { visible: T[]; truncated: number } {
  if (nodes.length <= max) return { visible: [...nodes], truncated: 0 };
  const visible = nodes.slice(0, max);
  if (selectedId && !visible.some((n) => n.id === selectedId)) {
    const selected = nodes.find((n) => n.id === selectedId);
    if (selected) visible[max - 1] = selected;
  }
  return { visible, truncated: nodes.length - max };
}
