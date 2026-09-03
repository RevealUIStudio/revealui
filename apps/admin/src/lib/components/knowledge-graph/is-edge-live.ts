import type { KgEdgeRecord } from '@revealui/sync';

/** True when the edge is current (no invalid_at) or was live at the given instant. */
export function isEdgeLiveAt(edge: KgEdgeRecord, at: Date | null): boolean {
  if (!at) return edge.invalid_at === null;
  const validAt = new Date(edge.valid_at);
  if (validAt > at) return false;
  if (edge.invalid_at && new Date(edge.invalid_at) <= at) return false;
  return true;
}
