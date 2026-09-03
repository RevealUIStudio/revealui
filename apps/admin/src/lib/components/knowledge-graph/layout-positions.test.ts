import { describe, expect, it } from 'vitest';
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  clampToCanvas,
  fallbackCirclePosition,
  MAX_CANVAS_NODES,
  NODE_RADIUS,
  resolveNodePositions,
  visibleCanvasNodes,
} from './layout-positions';

describe('clampToCanvas', () => {
  it('keeps in-bounds points', () => {
    expect(clampToCanvas(100, 80)).toEqual({ x: 100, y: 80 });
  });

  it('clamps to the padded canvas', () => {
    const min = NODE_RADIUS + 8;
    expect(clampToCanvas(-10, 9999)).toEqual({ x: min, y: CANVAS_HEIGHT - min });
  });
});

describe('fallbackCirclePosition', () => {
  it('centers a single node', () => {
    expect(fallbackCirclePosition(0, 1)).toEqual({
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT / 2,
    });
  });

  it('places two nodes on opposite sides of a circle', () => {
    const a = fallbackCirclePosition(0, 2);
    const b = fallbackCirclePosition(1, 2);
    expect(a.x).toBeCloseTo(CANVAS_WIDTH / 2);
    expect(b.x).toBeCloseTo(CANVAS_WIDTH / 2);
    expect(a.y).toBeLessThan(CANVAS_HEIGHT / 2);
    expect(b.y).toBeGreaterThan(CANVAS_HEIGHT / 2);
  });
});

describe('resolveNodePositions', () => {
  it('prefers finite overlay positions and falls back for the rest', () => {
    const overlay = new Map([
      ['kept', { x: 120, y: 80 }],
      ['bad', { x: Number.NaN, y: 1 }],
    ]);
    const positions = resolveNodePositions(['kept', 'missing', 'bad'], overlay);
    expect(positions.get('kept')).toEqual({ x: 120, y: 80 });
    expect(positions.get('missing')).toEqual(fallbackCirclePosition(1, 3));
    expect(positions.get('bad')).toEqual(fallbackCirclePosition(2, 3));
  });
});

describe('visibleCanvasNodes', () => {
  it('returns the full set when under the cap', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }];
    expect(visibleCanvasNodes(nodes, null)).toEqual({ visible: nodes, truncated: 0 });
  });

  it('keeps the selected node when truncating', () => {
    const nodes = Array.from({ length: MAX_CANVAS_NODES + 5 }, (_, i) => ({ id: `n${i}` }));
    const selectedId = `n${MAX_CANVAS_NODES + 2}`;
    const { visible, truncated } = visibleCanvasNodes(nodes, selectedId);
    expect(visible).toHaveLength(MAX_CANVAS_NODES);
    expect(truncated).toBe(5);
    expect(visible.some((n) => n.id === selectedId)).toBe(true);
  });
});
