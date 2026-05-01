/**
 * Tests for file discovery utilities
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiscoveredFile } from '../../app/utils/file-discovery';
import { discoverFiles, generateIndexMarkdown } from '../../app/utils/file-discovery';

// Mock fetch globally
global.fetch = vi.fn();

describe('discoverFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns manifest files when manifest exists', async () => {
    const manifestFiles: DiscoveredFile[] = [
      { path: 'getting-started.md', name: 'Getting Started' },
      { path: 'deployment.md', name: 'Deployment' },
    ];

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ files: manifestFiles }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await discoverFiles('guides');

    expect(fetch).toHaveBeenCalledWith('/guides/.manifest.json');
    expect(result).toEqual(manifestFiles);
  });

  it('returns empty array from manifest when files property is missing', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await discoverFiles('guides');

    expect(result).toEqual([]);
  });

  it('falls back to discovery when manifest is not found', async () => {
    // Manifest fetch returns 404
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Not Found', { status: 404 }));

    // Guide file probes - only getting-started and installation exist
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response('', { status: 200 })) // getting-started
      .mockResolvedValueOnce(new Response('', { status: 200 })) // installation
      .mockResolvedValueOnce(new Response('', { status: 404 })) // configuration
      .mockResolvedValueOnce(new Response('', { status: 404 })) // deployment
      .mockResolvedValueOnce(new Response('', { status: 404 })); // usage

    const result = await discoverFiles('guides');

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      path: 'getting-started.md',
      name: 'Getting Started',
    });
    expect(result[1]).toEqual({
      path: 'installation.md',
      name: 'Installation',
    });
  });

  it('discovers API packages via HEAD requests', async () => {
    // Manifest fetch fails
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Not Found', { status: 404 }));

    // API package probes
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response('', { status: 200 })) // revealui-core
      .mockResolvedValueOnce(new Response('', { status: 404 })) // revealui-schema
      .mockResolvedValueOnce(new Response('', { status: 200 })); // revealui-db

    const result = await discoverFiles('api');

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      path: 'revealui-core/README.md',
      name: 'Revealui Core',
      isDirectory: true,
    });
    expect(result[1]).toEqual({
      path: 'revealui-db/README.md',
      name: 'Revealui Db',
      isDirectory: true,
    });
  });

  it('returns empty array for reference section fallback (no common files)', async () => {
    // Manifest not found
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Not Found', { status: 404 }));

    const result = await discoverFiles('reference');

    expect(result).toEqual([]);
  });

  it('handles manifest fetch error gracefully', async () => {
    // Manifest fetch throws
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

    // No fallback files will be probed for reference
    const result = await discoverFiles('reference');

    expect(result).toEqual([]);
  });

  it('handles probe fetch error gracefully for guides', async () => {
    // Manifest not found
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Not Found', { status: 404 }));

    // All probes throw errors
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error('timeout'))
      .mockRejectedValueOnce(new Error('timeout'))
      .mockRejectedValueOnce(new Error('timeout'))
      .mockRejectedValueOnce(new Error('timeout'))
      .mockRejectedValueOnce(new Error('timeout'));

    const result = await discoverFiles('guides');

    expect(result).toEqual([]);
  });

  it('uses HEAD method for file probes', async () => {
    // Manifest not found
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Not Found', { status: 404 }));

    // All probes fail
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(new Response('', { status: 404 }));

    await discoverFiles('guides');

    // Second call onwards should use HEAD method
    const headCalls = vi
      .mocked(fetch)
      .mock.calls.filter((call) => typeof call[1] === 'object' && call[1]?.method === 'HEAD');
    expect(headCalls.length).toBeGreaterThan(0);
  });
});

describe('generateIndexMarkdown', () => {
  it('generates markdown with file links', () => {
    const files: DiscoveredFile[] = [
      { path: 'getting-started.md', name: 'Getting Started' },
      { path: 'deployment.md', name: 'Deployment' },
    ];

    const result = generateIndexMarkdown('guides', files);

    expect(result).toContain('# Guides');
    expect(result).toContain('## Available Guides');
    expect(result).toContain('- [Getting Started](./getting-started)');
    expect(result).toContain('- [Deployment](./deployment)');
    expect(result).toContain('auto-generated');
  });

  it('generates empty state when no files', () => {
    const result = generateIndexMarkdown('guides', []);

    expect(result).toContain('# Guides');
    expect(result).toContain('No guides found');
    expect(result).not.toContain('## Available');
  });

  it('handles directory entries correctly', () => {
    const files: DiscoveredFile[] = [
      { path: 'revealui-core/README.md', name: 'Revealui Core', isDirectory: true },
    ];

    const result = generateIndexMarkdown('api', files);

    expect(result).toContain('# Api');
    expect(result).toContain('- [Revealui Core](./revealui-core)');
  });

  it('capitalizes section title', () => {
    const result = generateIndexMarkdown('reference', []);
    expect(result).toContain('# Reference');
  });

  it('generates valid markdown structure', () => {
    const files: DiscoveredFile[] = [{ path: 'overview.md', name: 'Overview' }];

    const result = generateIndexMarkdown('api', files);

    // Should have heading, available section, file links, and footer
    expect(result).toContain('# Api');
    expect(result).toContain('## Available Api');
    expect(result).toContain('---');
    expect(result).toContain('auto-generated');
  });
});
