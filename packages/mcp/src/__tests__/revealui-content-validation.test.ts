/**
 * Tests for runtime Zod validation in the revealui-content MCP server factory.
 *
 * Coverage targets:
 *   - Per-tool: valid args pass through; missing required fields, wrong types,
 *     extra fields are rejected.
 *   - Fully-optional tools accept empty args {}.
 */

import { describe, expect, it } from 'vitest';
import {
  GetContentArgsSchema,
  ListContentArgsSchema,
  ListSitesArgsSchema,
  ListUsersArgsSchema,
  SiteStatsArgsSchema,
} from '../servers/factories/revealui-content.js';
import { validateToolArgs } from '../validate-tool-args.js';

describe('revealui_list_sites args', () => {
  it('accepts empty args (all optional)', () => {
    const r = validateToolArgs(ListSitesArgsSchema, {}, 'revealui_list_sites');
    expect(r.ok).toBe(true);
  });

  it('accepts valid limit and page', () => {
    const r = validateToolArgs(ListSitesArgsSchema, { limit: 10, page: 2 }, 'revealui_list_sites');
    expect(r.ok).toBe(true);
  });

  it('rejects unknown field', () => {
    const r = validateToolArgs(ListSitesArgsSchema, { bogus: true }, 'revealui_list_sites');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.isError).toBe(true);
  });

  it('rejects wrong type for limit', () => {
    const r = validateToolArgs(ListSitesArgsSchema, { limit: 'twenty' }, 'revealui_list_sites');
    expect(r.ok).toBe(false);
  });
});

describe('revealui_list_content args', () => {
  it('accepts required collection only', () => {
    const r = validateToolArgs(
      ListContentArgsSchema,
      { collection: 'posts' },
      'revealui_list_content',
    );
    expect(r.ok).toBe(true);
  });

  it('accepts all optional fields alongside collection', () => {
    const r = validateToolArgs(
      ListContentArgsSchema,
      { collection: 'pages', site_id: 'site-1', limit: 5, page: 1, status: 'published' },
      'revealui_list_content',
    );
    expect(r.ok).toBe(true);
  });

  it('rejects missing collection', () => {
    const r = validateToolArgs(ListContentArgsSchema, {}, 'revealui_list_content');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.content[0].text).toContain('revealui_list_content');
  });

  it('rejects empty string collection', () => {
    const r = validateToolArgs(ListContentArgsSchema, { collection: '' }, 'revealui_list_content');
    expect(r.ok).toBe(false);
  });

  it('rejects unknown field', () => {
    const r = validateToolArgs(
      ListContentArgsSchema,
      { collection: 'posts', extra: 'oops' },
      'revealui_list_content',
    );
    expect(r.ok).toBe(false);
  });
});

describe('revealui_get_content args', () => {
  it('accepts valid collection and id', () => {
    const r = validateToolArgs(
      GetContentArgsSchema,
      { collection: 'posts', id: 'abc123' },
      'revealui_get_content',
    );
    expect(r.ok).toBe(true);
  });

  it('rejects missing id', () => {
    const r = validateToolArgs(
      GetContentArgsSchema,
      { collection: 'posts' },
      'revealui_get_content',
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.content[0].text).toContain('revealui_get_content');
  });

  it('rejects missing collection', () => {
    const r = validateToolArgs(GetContentArgsSchema, { id: 'abc123' }, 'revealui_get_content');
    expect(r.ok).toBe(false);
  });

  it('rejects empty string id', () => {
    const r = validateToolArgs(
      GetContentArgsSchema,
      { collection: 'posts', id: '' },
      'revealui_get_content',
    );
    expect(r.ok).toBe(false);
  });
});

describe('revealui_list_users args', () => {
  it('accepts empty args (all optional)', () => {
    const r = validateToolArgs(ListUsersArgsSchema, {}, 'revealui_list_users');
    expect(r.ok).toBe(true);
  });

  it('accepts site_id with pagination', () => {
    const r = validateToolArgs(
      ListUsersArgsSchema,
      { site_id: 'site-abc', limit: 50, page: 3 },
      'revealui_list_users',
    );
    expect(r.ok).toBe(true);
  });

  it('rejects unknown field', () => {
    const r = validateToolArgs(ListUsersArgsSchema, { filter: 'admin' }, 'revealui_list_users');
    expect(r.ok).toBe(false);
  });
});

describe('revealui_site_stats args', () => {
  it('accepts empty args (all optional)', () => {
    const r = validateToolArgs(SiteStatsArgsSchema, {}, 'revealui_site_stats');
    expect(r.ok).toBe(true);
  });

  it('accepts site_id', () => {
    const r = validateToolArgs(SiteStatsArgsSchema, { site_id: 'site-xyz' }, 'revealui_site_stats');
    expect(r.ok).toBe(true);
  });

  it('rejects null args', () => {
    const r = validateToolArgs(SiteStatsArgsSchema, null, 'revealui_site_stats');
    expect(r.ok).toBe(false);
  });

  it('rejects unknown field', () => {
    const r = validateToolArgs(SiteStatsArgsSchema, { region: 'us-east' }, 'revealui_site_stats');
    expect(r.ok).toBe(false);
  });
});
