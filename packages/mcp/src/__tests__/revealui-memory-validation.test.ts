/**
 * Tests for runtime Zod validation in the revealui-memory MCP server.
 *
 * Coverage targets:
 *   - Per-tool: valid args pass through; missing required fields, wrong types,
 *     enum out-of-range, and extra fields are rejected.
 */

import { describe, expect, it } from 'vitest';
import {
  CreateScratchpadArgsSchema,
  ListFactsArgsSchema,
  ListSharedArgsSchema,
  PatchScratchpadArgsSchema,
  PublishFactArgsSchema,
  ReadScratchpadArgsSchema,
  ReconcileArgsSchema,
  ShareMemoryArgsSchema,
} from '../servers/revealui-memory.js';
import { validateToolArgs } from '../validate-tool-args.js';

describe('memory_publish_fact args', () => {
  it('accepts valid required fields', () => {
    const r = validateToolArgs(
      PublishFactArgsSchema,
      {
        session_id: 'sess-1',
        agent_id: 'agent-a',
        content: 'Found a bug',
        fact_type: 'bug',
      },
      'memory_publish_fact',
    );
    expect(r.ok).toBe(true);
  });

  it('accepts all optional fields', () => {
    const r = validateToolArgs(
      PublishFactArgsSchema,
      {
        session_id: 'sess-1',
        agent_id: 'agent-a',
        content: 'Decision made',
        fact_type: 'decision',
        confidence: 0.9,
        tags: ['arch', 'phase-3'],
        source_ref: { file: 'src/foo.ts', line: 42 },
      },
      'memory_publish_fact',
    );
    expect(r.ok).toBe(true);
  });

  it('rejects invalid fact_type enum', () => {
    const r = validateToolArgs(
      PublishFactArgsSchema,
      { session_id: 'sess-1', agent_id: 'a', content: 'x', fact_type: 'opinion' },
      'memory_publish_fact',
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.content[0].text).toContain('memory_publish_fact');
  });

  it('rejects missing fact_type', () => {
    const r = validateToolArgs(
      PublishFactArgsSchema,
      { session_id: 'sess-1', agent_id: 'a', content: 'x' },
      'memory_publish_fact',
    );
    expect(r.ok).toBe(false);
  });

  it('rejects unknown field', () => {
    const r = validateToolArgs(
      PublishFactArgsSchema,
      {
        session_id: 'sess-1',
        agent_id: 'a',
        content: 'x',
        fact_type: 'discovery',
        extra: true,
      },
      'memory_publish_fact',
    );
    expect(r.ok).toBe(false);
  });
});

describe('memory_list_facts args', () => {
  it('accepts valid session_id', () => {
    const r = validateToolArgs(
      ListFactsArgsSchema,
      { session_id: 'sess-abc' },
      'memory_list_facts',
    );
    expect(r.ok).toBe(true);
  });

  it('rejects missing session_id', () => {
    const r = validateToolArgs(ListFactsArgsSchema, {}, 'memory_list_facts');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.content[0].text).toContain('memory_list_facts');
  });
});

describe('memory_create_scratchpad args', () => {
  it('accepts required fields only', () => {
    const r = validateToolArgs(
      CreateScratchpadArgsSchema,
      { document_id: 'doc-1', agent_id: 'agent-b' },
      'memory_create_scratchpad',
    );
    expect(r.ok).toBe(true);
  });

  it('accepts optional title', () => {
    const r = validateToolArgs(
      CreateScratchpadArgsSchema,
      { document_id: 'doc-1', agent_id: 'agent-b', title: 'My Plan' },
      'memory_create_scratchpad',
    );
    expect(r.ok).toBe(true);
  });

  it('rejects missing document_id', () => {
    const r = validateToolArgs(
      CreateScratchpadArgsSchema,
      { agent_id: 'agent-b' },
      'memory_create_scratchpad',
    );
    expect(r.ok).toBe(false);
  });
});

describe('memory_patch_scratchpad args', () => {
  it('accepts valid patch', () => {
    const r = validateToolArgs(
      PatchScratchpadArgsSchema,
      {
        document_id: 'doc-1',
        agent_id: 'agent-a',
        patch_type: 'append_section',
        path: 'findings',
        content: 'New finding',
      },
      'memory_patch_scratchpad',
    );
    expect(r.ok).toBe(true);
  });

  it('rejects invalid patch_type enum', () => {
    const r = validateToolArgs(
      PatchScratchpadArgsSchema,
      {
        document_id: 'doc-1',
        agent_id: 'agent-a',
        patch_type: 'delete_all',
        path: 'findings',
        content: 'x',
      },
      'memory_patch_scratchpad',
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.content[0].text).toContain('memory_patch_scratchpad');
  });

  it('rejects missing content', () => {
    const r = validateToolArgs(
      PatchScratchpadArgsSchema,
      {
        document_id: 'doc-1',
        agent_id: 'agent-a',
        patch_type: 'set_key',
        path: 'title',
      },
      'memory_patch_scratchpad',
    );
    expect(r.ok).toBe(false);
  });
});

describe('memory_read_scratchpad args', () => {
  it('accepts valid document_id', () => {
    const r = validateToolArgs(
      ReadScratchpadArgsSchema,
      { document_id: 'doc-42' },
      'memory_read_scratchpad',
    );
    expect(r.ok).toBe(true);
  });

  it('rejects missing document_id', () => {
    const r = validateToolArgs(ReadScratchpadArgsSchema, {}, 'memory_read_scratchpad');
    expect(r.ok).toBe(false);
  });
});

describe('memory_share args', () => {
  it('accepts valid required fields', () => {
    const r = validateToolArgs(
      ShareMemoryArgsSchema,
      {
        session_scope: 'scope-1',
        agent_id: 'agent-a',
        site_id: 'site-xyz',
        content: 'Remember this',
        type: 'fact',
        source: { tool: 'grep', file: 'src/foo.ts' },
      },
      'memory_share',
    );
    expect(r.ok).toBe(true);
  });

  it('rejects invalid type enum', () => {
    const r = validateToolArgs(
      ShareMemoryArgsSchema,
      {
        session_scope: 'scope-1',
        agent_id: 'a',
        site_id: 'site-1',
        content: 'x',
        type: 'thought',
        source: {},
      },
      'memory_share',
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.content[0].text).toContain('memory_share');
  });

  it('rejects missing source', () => {
    const r = validateToolArgs(
      ShareMemoryArgsSchema,
      {
        session_scope: 'scope-1',
        agent_id: 'a',
        site_id: 'site-1',
        content: 'x',
        type: 'preference',
      },
      'memory_share',
    );
    expect(r.ok).toBe(false);
  });
});

describe('memory_list_shared args', () => {
  it('accepts valid session_scope', () => {
    const r = validateToolArgs(
      ListSharedArgsSchema,
      { session_scope: 'scope-abc' },
      'memory_list_shared',
    );
    expect(r.ok).toBe(true);
  });

  it('rejects missing session_scope', () => {
    const r = validateToolArgs(ListSharedArgsSchema, {}, 'memory_list_shared');
    expect(r.ok).toBe(false);
  });
});

describe('memory_reconcile args', () => {
  it('accepts valid session_id and site_id', () => {
    const r = validateToolArgs(
      ReconcileArgsSchema,
      { session_id: 'sess-1', site_id: 'site-1' },
      'memory_reconcile',
    );
    expect(r.ok).toBe(true);
  });

  it('rejects missing site_id', () => {
    const r = validateToolArgs(ReconcileArgsSchema, { session_id: 'sess-1' }, 'memory_reconcile');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.content[0].text).toContain('memory_reconcile');
  });

  it('rejects unknown field', () => {
    const r = validateToolArgs(
      ReconcileArgsSchema,
      { session_id: 'sess-1', site_id: 'site-1', force: true },
      'memory_reconcile',
    );
    expect(r.ok).toBe(false);
  });
});
