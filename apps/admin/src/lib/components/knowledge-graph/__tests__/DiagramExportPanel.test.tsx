// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DiagramExportPanel } from '../DiagramExportPanel';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            mermaid: 'flowchart TD\n  n0["admin (app)"]\n',
            svg: '<svg data-theme="minimal"/>',
            png: 'cG5n',
            graphHash: 'abc123def456',
            graphVersion: '2026-01-01T00:00:00.000Z',
            theme: 'minimal',
            honesty: 'architecture from your knowledge graph; not a public Architecture SKU',
          }),
      }),
    ),
  );
});

describe('DiagramExportPanel', () => {
  it('names RevMind and posts the diagram job', async () => {
    render(<DiagramExportPanel repo="revealui" selection={['n1']} />);

    expect(screen.getByText('RevMind export')).toBeInTheDocument();
    expect(screen.getByText(/architecture from your knowledge graph/i)).toBeInTheDocument();
    expect(screen.getByText(/not a public Architecture SKU/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Export diagram' }));

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      '/api/kg/diagram',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    const mermaid = await screen.findByLabelText('Mermaid source');
    expect(mermaid).toHaveValue('flowchart TD\n  n0["admin (app)"]\n');
    expect(screen.getByText('Download SVG')).toBeInTheDocument();
  });
});
