// @vitest-environment jsdom

/**
 * KG UI gate (GAP-300 / #2884 dual-gate honesty).
 *
 * The explorer page mocks LicenseGate so canvas tests can run. This file
 * exercises the real LicenseGate: fleet-operator / Unlimited must not see the
 * Pro card; Free stays locked. Shape AuthZ (`canAccessKgShapes`) is the
 * second gate and is covered in shape-authz + kg route tests.
 */

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseLicense = vi.fn();
vi.mock('@/lib/providers/LicenseProvider', () => ({
  useLicense: () => mockUseLicense(),
}));

vi.mock('@revealui/sync', () => ({
  ClientOnly: ({ children }: { children: ReactNode }) => children,
  useKnowledgeGraph: () => ({
    nodes: [],
    edges: [],
    edgeEpisodes: [],
    isLoading: false,
    error: null,
  }),
  useKgViewDocument: () => ({
    documentId: 'kg-view-fleet',
    state: {
      annotations: new Map(),
      pins: new Set(),
      layout: new Map(),
      presence: new Map(),
    },
    connectedClients: 0,
    isLoading: false,
    error: null,
    annotate: vi.fn(),
    setPinned: vi.fn(),
    setLayout: vi.fn(),
    touchPresence: vi.fn(),
  }),
}));

import KnowledgeGraphPage from './page';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ repos: [] }) })),
  );
});

describe('KnowledgeGraphPage license honesty', () => {
  it('lets a fleet-operator / Unlimited session reach the KG explorer', () => {
    mockUseLicense.mockReturnValue({
      features: { ai: false },
      isLoading: false,
      tier: 'free',
      isFleetOperator: true,
    });
    render(<KnowledgeGraphPage />);
    expect(screen.queryByText(/requires a Pro license/)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Knowledge Graph' })).toBeInTheDocument();
  });

  it('keeps Free honestly locked (dual-gate still fail-closed without entitlement)', () => {
    mockUseLicense.mockReturnValue({
      features: { ai: false, aiLocal: true },
      isLoading: false,
      tier: 'free',
    });
    render(<KnowledgeGraphPage />);
    expect(screen.getByText(/requires a Pro license/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Knowledge Graph' })).not.toBeInTheDocument();
  });
});
