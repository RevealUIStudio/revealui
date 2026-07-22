/**
 * Edit session API routes  -  the visual-edit-sessions engine (P1 slice 1).
 *
 * An edit session is a durable draft workspace over live content docs. Editors
 * open a session, patch draft overlays (autosave), then publish atomically or
 * discard. Every action appends to an auditable event log.
 *
 * Phase-1 slice: `doc_type` `page` is fully implemented. `global` / `post`
 * overlays are accepted by the schema but PATCH / publish reject them with a
 * clear 400 until a later slice.
 *
 * SECURITY: every route here exposes DRAFT content, so every route  -  GETs
 * included  -  requires an authenticated user holding the content `update`
 * permission. The `/api/content/*` mount only gates POST/PATCH/DELETE by verb;
 * GET is public-read there, so these routes enforce authz explicitly.
 */

import {
  FLEET_MARKETING_VOICE_RULES,
  type MarketingBlock,
  UnmappedBlockTypeError,
  type Violation,
  validateMarketingBlock,
} from '@revealui/contracts/marketing-voice';
import * as sessionQueries from '@revealui/db/queries/edit-sessions';
import * as siteQueries from '@revealui/db/queries/sites';
import type { EditSession, EditSessionDoc, EditSessionEvent, Page } from '@revealui/db/schema';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { HTTPException } from 'hono/http-exception';
import { authorizationSystem } from '../../middleware/authorization.js';
import { IdParam } from '../_helpers/content-schemas.js';
import { dateToString, nullableDateToString } from '../_helpers/serialize.js';
import {
  getPreviewTokenSecret,
  mintPreviewToken,
  PREVIEW_TOKEN_TTL_SECONDS,
  verifyPreviewToken,
} from './_helpers/preview-token.js';
import type { ContentVariables } from './index.js';

/** Site slug whose session patches are gated by the fleet marketing-voice engine. */
const FLEET_MARKETING_SITE_SLUG = 'fleet-marketing';

const app = new OpenAPIHono<{ Variables: ContentVariables }>();

const MAX_REVISIONS_PER_DOC = 50;
const RECENT_EVENTS_LIMIT = 50;
const EVENTS_PAGE_LIMIT = 200;

// =============================================================================
// Authz  -  draft exposure requires an authenticated content editor everywhere
// =============================================================================

interface SessionUser {
  id: string;
  role: string;
}

/**
 * Open / list / patch / discard: human editors (`content:update`) or agents
 * proposing into a session (`content:propose`). Publish stays human-only via
 * `requireContentPublisher`.
 */
function requireContentEditor(user: SessionUser | undefined): SessionUser {
  if (!user) {
    throw new HTTPException(401, { message: 'Authentication required' });
  }
  const canUpdate = authorizationSystem.hasPermission([user.role], 'content', 'update');
  const canPropose = authorizationSystem.hasPermission([user.role], 'content', 'propose');
  if (!(canUpdate || canPropose)) {
    throw new HTTPException(403, {
      message: 'Permission denied: content:update or content:propose',
    });
  }
  return user;
}

/** Publish remains a human (or editor) act — never content:propose alone. */
function requireContentPublisher(user: SessionUser | undefined): SessionUser {
  if (!user) {
    throw new HTTPException(401, { message: 'Authentication required' });
  }
  if (!authorizationSystem.hasPermission([user.role], 'content', 'update')) {
    throw new HTTPException(403, {
      message: 'Permission denied: content:update required to publish',
    });
  }
  return user;
}

function actorKindFor(user: SessionUser): 'human' | 'agent' {
  return user.role === 'agent' ? 'agent' : 'human';
}

// =============================================================================
// Typed draft patch setter (no regex, prototype-pollution guarded, structural)
//
// The patch path must resolve through EXISTING draft structure inside an
// allowlisted writable root: `title` (leaf), `seo` (whole object or an
// existing leaf), or `blocks.<i>.data` and deeper. Everything else — page
// identity and publish-shape invariants (id/slug/path/version/status),
// whole-blocks or whole-block writes, block `type`/`id` — is rejected with a
// 400 naming the offending segment, and nothing is written. Intermediate
// containers are never created: silent structure creation is exactly how a
// path typo (or a misbehaving agent caller) corrupts published page JSON.
// A NEW final key is allowed only where its parent object already exists
// inside a block's `data` subtree; array writes never extend the array.
// =============================================================================

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const UNPATCHABLE_ROOT_HINT =
  "not a writable root (writable: 'title', 'seo', 'theme', 'blocks.<i>.data...')";

/** Allowlisted design-token CSS variables (matches @revealui/editor field-kind). */
const EDITABLE_THEME_TOKEN_NAMES = new Set([
  '--rvui-brand',
  '--rvui-brand-glow',
  '--rvui-accent',
  '--rvui-radius-md',
]);

function isArrayIndex(segment: string): boolean {
  if (segment.length === 0) return false;
  for (let i = 0; i < segment.length; i++) {
    const code = segment.charCodeAt(i);
    if (code < 48 || code > 57) return false;
  }
  return true;
}

function pathError(offender: string, reason: string): HTTPException {
  return new HTTPException(400, {
    message: `Invalid patch path at '${offender}': ${reason}`,
  });
}

/**
 * Descend `segments` (from index `start`) through existing containers only,
 * then set `value` on the final segment. `allowNewFinal` permits a new key
 * when the final segment's parent is an existing plain object (the
 * blocks.<i>.data carve-out); array indices must be in range everywhere —
 * appends are a P2 block-operations concern, not a patch.
 */
function setThroughExisting(
  root: Record<string, unknown> | unknown[],
  segments: string[],
  start: number,
  value: unknown,
  allowNewFinal: boolean,
): void {
  let cursor: Record<string, unknown> | unknown[] = root;
  for (let i = start; i < segments.length - 1; i++) {
    const segment = segments[i];
    let child: unknown;
    if (Array.isArray(cursor)) {
      if (!isArrayIndex(segment)) throw pathError(segment, 'expected an array index');
      if (Number(segment) >= cursor.length) throw pathError(segment, 'array index out of range');
      child = cursor[Number(segment)];
    } else {
      if (!Object.hasOwn(cursor, segment)) {
        throw pathError(segment, 'does not resolve through existing draft structure');
      }
      child = cursor[segment];
    }
    if (child === null || typeof child !== 'object') {
      throw pathError(segment, 'is not a container in the draft');
    }
    cursor = child as Record<string, unknown> | unknown[];
  }

  const final = segments[segments.length - 1];
  if (Array.isArray(cursor)) {
    if (!isArrayIndex(final)) throw pathError(final, 'expected an array index');
    if (Number(final) >= cursor.length) throw pathError(final, 'array index out of range');
    cursor[Number(final)] = value;
    return;
  }
  if (!(Object.hasOwn(cursor, final) || allowNewFinal)) {
    throw pathError(final, 'does not exist (new keys are only allowed inside block data)');
  }
  cursor[final] = value;
}

/** Apply a validated patch to a draft, or throw a 400 naming the offending segment. */
function applyDraftPatch(draft: Record<string, unknown>, path: string, value: unknown): void {
  const segments = path.split('.');
  for (const segment of segments) {
    if (segment.length === 0) {
      throw new HTTPException(400, { message: 'Patch path has an empty segment' });
    }
    if (DANGEROUS_KEYS.has(segment)) {
      throw new HTTPException(400, { message: `Illegal path segment: ${segment}` });
    }
  }

  const root = segments[0];

  if (root === 'title') {
    if (segments.length !== 1) throw pathError(segments[1], "'title' is a leaf value");
    draft.title = value;
    return;
  }

  if (root === 'seo') {
    if (segments.length === 1) {
      draft.seo = value;
      return;
    }
    setThroughExisting(draft, segments, 0, value, false);
    return;
  }

  if (root === 'theme') {
    // P2 token theming: draft.theme is a map of allowlisted --rvui-* CSS vars.
    if (segments.length === 1) {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new HTTPException(400, { message: 'theme must be an object of token → value' });
      }
      const next: Record<string, string> = {};
      for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        if (!EDITABLE_THEME_TOKEN_NAMES.has(key)) {
          throw pathError(key, 'not an allowlisted design token');
        }
        if (typeof val !== 'string') {
          throw new HTTPException(400, { message: `theme.${key} must be a string` });
        }
        if (val.includes(';') || val.includes('{') || val.includes('}')) {
          throw new HTTPException(400, { message: `theme.${key} contains illegal CSS` });
        }
        next[key] = val;
      }
      draft.theme = next;
      return;
    }
    if (segments.length !== 2) {
      throw pathError(segments.slice(1).join('.'), 'theme paths are theme.<token> only');
    }
    const token = segments[1];
    if (!token || !EDITABLE_THEME_TOKEN_NAMES.has(token)) {
      throw pathError(token ?? 'theme', 'not an allowlisted design token');
    }
    if (typeof value !== 'string') {
      throw new HTTPException(400, { message: `theme.${token} must be a string` });
    }
    if (value.includes(';') || value.includes('{') || value.includes('}')) {
      throw new HTTPException(400, { message: `theme.${token} contains illegal CSS` });
    }
    const existing =
      typeof draft.theme === 'object' && draft.theme !== null && !Array.isArray(draft.theme)
        ? { ...(draft.theme as Record<string, string>) }
        : {};
    existing[token] = value;
    draft.theme = existing;
    return;
  }

  if (root === 'blocks') {
    if (segments.length === 1) {
      throw pathError('blocks', 'the blocks array is not writable as a whole');
    }
    if (segments.length === 2) {
      throw pathError(`blocks.${segments[1]}`, 'a whole block is not writable');
    }
    if (segments[2] !== 'data') {
      throw pathError(segments[2], "only a block's 'data' subtree is writable");
    }
    setThroughExisting(draft, segments, 0, value, true);
    return;
  }

  throw pathError(root, UNPATCHABLE_ROOT_HINT);
}

// =============================================================================
// Block array ops (P2) — insert / remove / move on the blocks array only
// =============================================================================

type BlockOp =
  | { op: 'blocks.insert'; index: number; block: Record<string, unknown> }
  | { op: 'blocks.remove'; index: number }
  | { op: 'blocks.move'; from: number; to: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getBlocksArray(draft: Record<string, unknown>): unknown[] {
  if (!Array.isArray(draft.blocks)) {
    throw new HTTPException(400, { message: 'Draft has no blocks array' });
  }
  return draft.blocks;
}

/** Apply a structural block-array operation. Mutates `draft.blocks` in place. */
function applyBlockOp(draft: Record<string, unknown>, op: BlockOp): void {
  const blocks = getBlocksArray(draft);
  if (op.op === 'blocks.insert') {
    if (op.index < 0 || op.index > blocks.length) {
      throw pathError(String(op.index), 'insert index out of range');
    }
    if (!isRecord(op.block)) {
      throw new HTTPException(400, { message: 'blocks.insert requires a block object' });
    }
    // Identity + type are required; reject prototype-dangerous keys on the block.
    for (const key of Object.keys(op.block)) {
      if (DANGEROUS_KEYS.has(key)) {
        throw new HTTPException(400, { message: `Illegal block key: ${key}` });
      }
    }
    if (typeof op.block.type !== 'string' || op.block.type.length === 0) {
      throw new HTTPException(400, { message: 'blocks.insert requires block.type' });
    }
    if (typeof op.block.id !== 'string' || op.block.id.length === 0) {
      throw new HTTPException(400, { message: 'blocks.insert requires block.id' });
    }
    if (!isRecord(op.block.data)) {
      throw new HTTPException(400, { message: 'blocks.insert requires block.data object' });
    }
    blocks.splice(op.index, 0, structuredClone(op.block));
    return;
  }
  if (op.op === 'blocks.remove') {
    if (op.index < 0 || op.index >= blocks.length) {
      throw pathError(String(op.index), 'remove index out of range');
    }
    if (blocks.length <= 1) {
      throw new HTTPException(400, {
        message: 'Cannot remove the last block (page must keep at least one)',
      });
    }
    blocks.splice(op.index, 1);
    return;
  }
  // blocks.move
  if (op.from < 0 || op.from >= blocks.length) {
    throw pathError(String(op.from), 'move from-index out of range');
  }
  if (op.to < 0 || op.to >= blocks.length) {
    throw pathError(String(op.to), 'move to-index out of range');
  }
  if (op.from === op.to) return;
  const [item] = blocks.splice(op.from, 1);
  blocks.splice(op.to, 0, item);
}

// =============================================================================
// Fleet-marketing voice gate (P2) — Tier-1 hard reject on session.patch
// =============================================================================

/**
 * Adapt a page block (VES contracts shape OR admin Lexical shape) into the
 * marketing-voice engine's MarketingBlock view.
 */
function toMarketingBlock(raw: unknown): MarketingBlock | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.blockType === 'string') {
    return raw as MarketingBlock;
  }
  if (typeof raw.type === 'string') {
    return { blockType: raw.type, ...raw };
  }
  return null;
}

interface VoiceViolation extends Violation {
  blockIndex: number;
}

/**
 * Run Tier-1 marketing-voice validation over every block in the draft when the
 * session targets the fleet-marketing site. Returns violations (empty = pass).
 * Throws HTTPException 422 only via the caller's response construction for
 * unmapped block types (fail-closed).
 */
function collectVoiceViolations(draft: Record<string, unknown>): VoiceViolation[] {
  const blocks = Array.isArray(draft.blocks) ? draft.blocks : [];
  const violations: VoiceViolation[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const mb = toMarketingBlock(blocks[i]);
    if (!mb) continue;
    try {
      const report = validateMarketingBlock(mb, FLEET_MARKETING_VOICE_RULES);
      if (!report.tier1.passed) {
        for (const v of report.tier1.violations) {
          violations.push({ ...v, blockIndex: i });
        }
      }
    } catch (err) {
      if (err instanceof UnmappedBlockTypeError) {
        throw new HTTPException(422, {
          message: `Voice gate: unmapped blockType at blocks[${i}]: ${err.blockType}`,
        });
      }
      throw err;
    }
  }
  return violations;
}

/**
 * Build the initial draft overlay from a live page. This is a FULL editable-doc
 * snapshot (title + blocks + seo all captured), so at publish time the
 * `draft.title/blocks/seo` fallbacks to the live page are belt-and-braces only  -
 * a materialized draft always carries these fields.
 */
function materializePageDraft(page: Page): Record<string, unknown> {
  return {
    id: page.id,
    siteId: page.siteId,
    parentId: page.parentId,
    templateId: page.templateId,
    title: page.title,
    slug: page.slug,
    path: page.path,
    status: page.status,
    blocks: page.blocks ?? [],
    seo: page.seo ?? null,
    version: page.version,
  };
}

/**
 * Undo the page writes from a failed publish attempt (called on a mid-flight
 * guard miss). For each already-written doc, restore its exact prior row, guarded
 * on the version this attempt set. A successful restore leaves the page identical
 * to before the attempt, so a retry's optimistic pre-flight passes and converges.
 * If a restore itself misses (the page moved again), that doc stays live: it is
 * returned so the caller can report it, and its overlay base_version is advanced
 * to the current version so the retry does not phantom-conflict on this session's
 * own write.
 */
async function compensatePublish(
  db: Parameters<typeof sessionQueries.restorePageContent>[0],
  written: Array<{ docId: string; overlayId: string; revisionId: string; original: Page }>,
): Promise<string[]> {
  const stillPublished: string[] = [];
  for (let i = written.length - 1; i >= 0; i--) {
    const w = written[i];
    const restored = await sessionQueries.restorePageContent(db, {
      pageId: w.docId,
      expectedVersion: w.original.version + 1,
      original: w.original,
    });
    if (restored) {
      await sessionQueries.deletePageRevisionById(db, w.revisionId);
    } else {
      stillPublished.push(w.docId);
      const current = await sessionQueries.getLivePage(db, w.docId);
      if (current) {
        await sessionQueries.setSessionDocBaseVersion(db, w.overlayId, current.version);
      }
    }
  }
  return stillPublished;
}

// =============================================================================
// Serializers + response schemas
// =============================================================================

const DateTime = z.string().openapi({ type: 'string', format: 'date-time' });

const SessionSchema = z
  .object({
    id: z.string(),
    siteId: z.string(),
    title: z.string(),
    status: z.string(),
    createdBy: z.string().nullable(),
    createdAt: DateTime,
    updatedAt: DateTime,
    publishedAt: z.string().nullable().openapi({ type: 'string', format: 'date-time' }),
  })
  .openapi('EditSession');

const SessionDocSchema = z
  .object({
    id: z.string(),
    sessionId: z.string(),
    docType: z.string(),
    docId: z.string(),
    draft: z.unknown(),
    baseVersion: z.number(),
    updatedBy: z.string().nullable(),
    updatedAt: DateTime,
  })
  .openapi('EditSessionDoc');

const SessionEventSchema = z
  .object({
    id: z.number(),
    sessionId: z.string(),
    actorId: z.string().nullable(),
    actorKind: z.string(),
    type: z.string(),
    payload: z.unknown().nullable(),
    createdAt: DateTime,
  })
  .openapi('EditSessionEvent');

const ErrorSchema = z.object({ success: z.literal(false), error: z.string() });
const ConflictSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  conflicts: z.array(z.record(z.string(), z.unknown())),
  // Present only when a mid-flight conflict left some docs live and compensation
  // could not fully revert them. Empty/absent means nothing was published.
  partiallyPublished: z.array(z.string()).optional(),
});

function serializeSession(row: EditSession): z.infer<typeof SessionSchema> {
  return {
    id: row.id,
    siteId: row.siteId,
    title: row.title,
    status: row.status,
    createdBy: row.createdBy,
    createdAt: dateToString(row.createdAt),
    updatedAt: dateToString(row.updatedAt),
    publishedAt: nullableDateToString(row.publishedAt),
  };
}

function serializeDoc(row: EditSessionDoc): z.infer<typeof SessionDocSchema> {
  return {
    id: row.id,
    sessionId: row.sessionId,
    docType: row.docType,
    docId: row.docId,
    draft: row.draft,
    baseVersion: row.baseVersion,
    updatedBy: row.updatedBy,
    updatedAt: dateToString(row.updatedAt),
  };
}

function serializeEvent(row: EditSessionEvent): z.infer<typeof SessionEventSchema> {
  return {
    id: row.id,
    sessionId: row.sessionId,
    actorId: row.actorId,
    actorKind: row.actorKind,
    type: row.type,
    payload: row.payload ?? null,
    createdAt: dateToString(row.createdAt),
  };
}

// =============================================================================
// POST /sessions  -  open a session
// =============================================================================

app.openapi(
  createRoute({
    method: 'post',
    path: '/sessions',
    tags: ['content'],
    summary: 'Open an edit session',
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({ siteId: z.string().min(1), title: z.string().min(1).max(500) }),
          },
        },
      },
    },
    responses: {
      201: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: SessionSchema }),
          },
        },
        description: 'Session opened',
      },
      404: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: 'Site not found',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = requireContentEditor(c.get('user'));
    const { siteId, title } = c.req.valid('json');

    const site = await siteQueries.getSiteById(db, siteId);
    if (!site) throw new HTTPException(404, { message: 'Site not found' });

    const id = crypto.randomUUID();
    const session = await sessionQueries.createEditSession(db, {
      id,
      siteId,
      title,
      createdBy: user.id,
    });
    if (!session) throw new HTTPException(500, { message: 'Failed to open session' });

    await sessionQueries.insertSessionEvent(db, {
      sessionId: id,
      actorId: user.id,
      actorKind: actorKindFor(user),
      type: 'opened',
      payload: { siteId, title },
    });

    return c.json({ success: true as const, data: serializeSession(session) }, 201);
  },
);

// =============================================================================
// GET /sessions  -  list (filter by status / site)
// =============================================================================

app.openapi(
  createRoute({
    method: 'get',
    path: '/sessions',
    tags: ['content'],
    summary: 'List edit sessions',
    request: {
      query: z.object({
        status: z.enum(['open', 'published', 'discarded']).optional(),
        siteId: z.string().optional(),
      }),
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: z.array(SessionSchema) }),
          },
        },
        description: 'Session list',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    requireContentEditor(c.get('user'));
    const { status, siteId } = c.req.valid('query');
    const rows = await sessionQueries.listEditSessions(db, { status, siteId });
    return c.json({ success: true as const, data: rows.map(serializeSession) }, 200);
  },
);

// =============================================================================
// GET /sessions/:id  -  session + docs + recent events
// =============================================================================

app.openapi(
  createRoute({
    method: 'get',
    path: '/sessions/{id}',
    tags: ['content'],
    summary: 'Get an edit session with its docs and recent events',
    request: { params: IdParam },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.literal(true),
              data: z.object({
                session: SessionSchema,
                docs: z.array(SessionDocSchema),
                events: z.array(SessionEventSchema),
              }),
            }),
          },
        },
        description: 'Session detail',
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const db = c.get('db');
    requireContentEditor(c.get('user'));
    const { id } = c.req.valid('param');

    const session = await sessionQueries.getEditSessionById(db, id);
    if (!session) throw new HTTPException(404, { message: 'Session not found' });

    const docs = await sessionQueries.getSessionDocs(db, id);
    const recent = await sessionQueries.getRecentSessionEvents(db, id, RECENT_EVENTS_LIMIT);
    recent.reverse(); // chronological for display

    return c.json(
      {
        success: true as const,
        data: {
          session: serializeSession(session),
          docs: docs.map(serializeDoc),
          events: recent.map(serializeEvent),
        },
      },
      200,
    );
  },
);

// =============================================================================
// GET /sessions/:id/events  -  poll for events after a cursor (id-ordered)
// =============================================================================

app.openapi(
  createRoute({
    method: 'get',
    path: '/sessions/{id}/events',
    tags: ['content'],
    summary: 'Poll session events after a cursor',
    request: {
      params: IdParam,
      query: z.object({ after: z.coerce.number().int().nonnegative().optional() }),
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.literal(true),
              data: z.array(SessionEventSchema),
              nextCursor: z.number(),
            }),
          },
        },
        description: 'Events after the cursor',
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const db = c.get('db');
    requireContentEditor(c.get('user'));
    const { id } = c.req.valid('param');
    const { after } = c.req.valid('query');

    const session = await sessionQueries.getEditSessionById(db, id);
    if (!session) throw new HTTPException(404, { message: 'Session not found' });

    const cursor = after ?? 0;
    const events = await sessionQueries.getSessionEventsAfter(db, id, cursor, EVENTS_PAGE_LIMIT);
    const nextCursor = events.length > 0 ? events[events.length - 1].id : cursor;

    return c.json({ success: true as const, data: events.map(serializeEvent), nextCursor }, 200);
  },
);

// =============================================================================
// PATCH /sessions/:id/docs/:docType/:docId  -  field patch or block op (autosave)
// =============================================================================

const FieldPatchBody = z
  .object({ path: z.string().min(1), value: z.unknown() })
  .openapi('EditSessionFieldPatch');

const BlockInsertBody = z
  .object({
    op: z.literal('blocks.insert'),
    index: z.number().int().nonnegative(),
    block: z.record(z.string(), z.unknown()),
  })
  .openapi('EditSessionBlockInsert');

const BlockRemoveBody = z
  .object({
    op: z.literal('blocks.remove'),
    index: z.number().int().nonnegative(),
  })
  .openapi('EditSessionBlockRemove');

const BlockMoveBody = z
  .object({
    op: z.literal('blocks.move'),
    from: z.number().int().nonnegative(),
    to: z.number().int().nonnegative(),
  })
  .openapi('EditSessionBlockMove');

const PatchBody = z.union([FieldPatchBody, BlockInsertBody, BlockRemoveBody, BlockMoveBody]);

const VoiceRejectSchema = z.object({
  success: z.literal(false),
  rejected: z.literal(true),
  violations: z.array(z.record(z.string(), z.unknown())),
});

function isBlockOpBody(
  body: z.infer<typeof PatchBody>,
): body is z.infer<typeof BlockInsertBody | typeof BlockRemoveBody | typeof BlockMoveBody> {
  return 'op' in body;
}

app.openapi(
  createRoute({
    method: 'patch',
    path: '/sessions/{id}/docs/{docType}/{docId}',
    tags: ['content'],
    summary: 'Patch a draft field or apply a block-array op in an edit session',
    request: {
      params: z.object({
        id: z.string().openapi({ param: { name: 'id', in: 'path' } }),
        docType: z.string().openapi({ param: { name: 'docType', in: 'path' } }),
        docId: z.string().openapi({ param: { name: 'docId', in: 'path' } }),
      }),
      body: {
        content: {
          'application/json': {
            schema: PatchBody,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: SessionDocSchema }),
          },
        },
        description: 'Draft patched',
      },
      400: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Bad request' },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
      409: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: 'Session not open',
      },
      422: {
        content: { 'application/json': { schema: VoiceRejectSchema } },
        description: 'Voice validation rejected the patch (fleet-marketing only)',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = requireContentEditor(c.get('user'));
    const { id, docType, docId } = c.req.valid('param');
    const body = c.req.valid('json');

    const session = await sessionQueries.getEditSessionById(db, id);
    if (!session) throw new HTTPException(404, { message: 'Session not found' });
    if (session.status !== 'open') {
      throw new HTTPException(409, { message: 'Session is not open' });
    }
    if (docType !== 'page') {
      throw new HTTPException(400, {
        message: `Editing '${docType}' docs is supported in a later slice`,
      });
    }

    // Validate + apply against the in-memory draft BEFORE any write: a 400 on
    // the first patch must not materialize an overlay row.
    const doc = await sessionQueries.getSessionDoc(db, id, docType, docId);
    let nextDraft: Record<string, unknown>;
    let materializeBaseVersion: number | null = null;
    if (doc) {
      nextDraft = structuredClone(doc.draft);
    } else {
      const page = await sessionQueries.getLivePage(db, docId);
      if (!page) throw new HTTPException(404, { message: 'Page not found' });
      nextDraft = materializePageDraft(page);
      materializeBaseVersion = page.version;
    }

    if (isBlockOpBody(body)) {
      applyBlockOp(nextDraft, body);
    } else {
      applyDraftPatch(nextDraft, body.path, body.value);
    }

    // Fleet-marketing only: Tier-1 marketing-voice hard-reject before any write.
    const site = await siteQueries.getSiteById(db, session.siteId);
    if (site?.slug === FLEET_MARKETING_SITE_SLUG) {
      const violations = collectVoiceViolations(nextDraft);
      if (violations.length > 0) {
        return c.json(
          {
            success: false as const,
            rejected: true as const,
            violations: violations as unknown as Array<Record<string, unknown>>,
          },
          422,
        );
      }
    }

    let updated: EditSessionDoc | null;
    if (doc) {
      updated = await sessionQueries.updateSessionDocDraft(db, doc.id, {
        draft: nextDraft,
        updatedBy: user.id,
      });
    } else {
      updated = await sessionQueries.insertSessionDoc(db, {
        id: crypto.randomUUID(),
        sessionId: id,
        docType,
        docId,
        draft: nextDraft,
        baseVersion: materializeBaseVersion ?? 1,
        updatedBy: user.id,
      });
    }
    if (!updated) throw new HTTPException(500, { message: 'Failed to save draft' });

    const eventPayload: Record<string, unknown> = { docType, docId };
    if (isBlockOpBody(body)) {
      eventPayload.op = body.op;
    } else {
      eventPayload.path = body.path;
    }

    await sessionQueries.insertSessionEvent(db, {
      sessionId: id,
      actorId: user.id,
      actorKind: actorKindFor(user),
      type: 'patched',
      payload: eventPayload,
    });

    return c.json({ success: true as const, data: serializeDoc(updated) }, 200);
  },
);

// =============================================================================
// POST /sessions/:id/publish  -  optimistic, all-or-nothing publish
// =============================================================================

app.openapi(
  createRoute({
    method: 'post',
    path: '/sessions/{id}/publish',
    tags: ['content'],
    summary: 'Publish an edit session',
    request: { params: IdParam },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.literal(true),
              data: SessionSchema,
              publishedDocs: z.number(),
            }),
          },
        },
        description: 'Session published',
      },
      400: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: 'Unsupported doc type',
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
      409: {
        content: { 'application/json': { schema: ConflictSchema } },
        description: 'Version conflict or session not open',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    // Publish is human/editor only — agents with content:propose cannot publish.
    const user = requireContentPublisher(c.get('user'));
    const { id } = c.req.valid('param');

    const session = await sessionQueries.getEditSessionById(db, id);
    if (!session) throw new HTTPException(404, { message: 'Session not found' });
    if (session.status !== 'open') {
      throw new HTTPException(409, { message: 'Session is not open' });
    }

    const docs = await sessionQueries.getSessionDocs(db, id);

    const unsupported = docs.find((d) => d.docType !== 'page');
    if (unsupported) {
      throw new HTTPException(400, {
        message: `Publishing '${unsupported.docType}' docs is supported in a later slice`,
      });
    }

    const publishedAt = new Date();

    // Phase 1  -  read + verify every doc's base version before any write.
    // Any conflict fails the whole publish with per-doc detail (no partial publish).
    const live = new Map<string, Page>();
    const conflicts: Array<Record<string, unknown>> = [];
    for (const doc of docs) {
      const page = await sessionQueries.getLivePage(db, doc.docId);
      if (!page) {
        conflicts.push({ docType: doc.docType, docId: doc.docId, reason: 'not_found' });
        continue;
      }
      if (page.version !== doc.baseVersion) {
        conflicts.push({
          docType: doc.docType,
          docId: doc.docId,
          reason: 'version_conflict',
          baseVersion: doc.baseVersion,
          currentVersion: page.version,
        });
        continue;
      }
      live.set(doc.docId, page);
    }
    if (conflicts.length > 0) {
      return c.json({ success: false as const, error: 'publish_conflict', conflicts }, 409);
    }

    // Phase 2  -  guarded writes. Each update is version-guarded (WHERE version =
    // baseVersion); a guard miss means a writer slipped in after the read phase.
    // On a mid-flight miss we compensate the docs already written this attempt
    // (restore their exact prior row + delete the revision we inserted) so the
    // publish stays all-or-nothing. If a compensation write itself misses, that
    // doc stays live and is reported via `partiallyPublished`, and its overlay
    // base_version is advanced so a later retry does not phantom-conflict.
    const written: Array<{ docId: string; overlayId: string; revisionId: string; original: Page }> =
      [];
    for (const doc of docs) {
      const draft = doc.draft;
      const basePage = live.get(doc.docId) as Page;
      const title = typeof draft.title === 'string' ? draft.title : basePage.title;
      const blocks = Array.isArray(draft.blocks) ? (draft.blocks as unknown[]) : null;
      const seo = draft.seo ?? null;

      const updatedPage = await sessionQueries.publishDraftToPage(db, {
        pageId: doc.docId,
        expectedVersion: doc.baseVersion,
        title,
        blocks,
        seo,
        publishedAt,
      });
      if (!updatedPage) {
        const partiallyPublished = await compensatePublish(db, written);
        return c.json(
          {
            success: false as const,
            error: 'publish_conflict',
            conflicts: [{ docType: doc.docType, docId: doc.docId, reason: 'version_conflict' }],
            ...(partiallyPublished.length > 0 ? { partiallyPublished } : {}),
          },
          409,
        );
      }

      const revisionNumber = await sessionQueries.nextPageRevisionNumber(db, doc.docId);
      const revisionId = crypto.randomUUID();
      await sessionQueries.insertPageRevision(db, {
        id: revisionId,
        pageId: doc.docId,
        createdBy: user.id,
        revisionNumber,
        title: updatedPage.title,
        blocks: updatedPage.blocks ?? null,
        seo: updatedPage.seo ?? null,
        changeDescription: `Published via edit session ${id}`,
      });
      await sessionQueries.prunePageRevisions(db, doc.docId, MAX_REVISIONS_PER_DOC);
      written.push({ docId: doc.docId, overlayId: doc.id, revisionId, original: basePage });
    }

    const publishedSession = await sessionQueries.setEditSessionStatus(db, id, {
      status: 'published',
      publishedAt,
    });
    if (!publishedSession) throw new HTTPException(500, { message: 'Failed to publish session' });

    await sessionQueries.insertSessionEvent(db, {
      sessionId: id,
      actorId: user.id,
      actorKind: actorKindFor(user),
      type: 'published',
      payload: { docCount: docs.length },
    });

    return c.json(
      {
        success: true as const,
        data: serializeSession(publishedSession),
        publishedDocs: docs.length,
      },
      200,
    );
  },
);

// =============================================================================
// POST /sessions/:id/discard  -  discard (overlay rows retained for audit)
// =============================================================================
// A POST (not DELETE) so discard rides the content `update` permission like
// open / patch / publish. The `/api/content/*` mount maps DELETE -> content
// `delete` (admin only), which is wrong for abandoning your own draft.

app.openapi(
  createRoute({
    method: 'post',
    path: '/sessions/{id}/discard',
    tags: ['content'],
    summary: 'Discard an edit session',
    request: { params: IdParam },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: SessionSchema }),
          },
        },
        description: 'Session discarded',
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
      409: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: 'Session not open',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = requireContentEditor(c.get('user'));
    const { id } = c.req.valid('param');

    const session = await sessionQueries.getEditSessionById(db, id);
    if (!session) throw new HTTPException(404, { message: 'Session not found' });
    if (session.status !== 'open') {
      throw new HTTPException(409, { message: 'Session is not open' });
    }

    const discarded = await sessionQueries.setEditSessionStatus(db, id, {
      status: 'discarded',
      publishedAt: session.publishedAt,
    });
    if (!discarded) throw new HTTPException(500, { message: 'Failed to discard session' });

    await sessionQueries.insertSessionEvent(db, {
      sessionId: id,
      actorId: user.id,
      actorKind: actorKindFor(user),
      type: 'discarded',
      payload: null,
    });

    return c.json({ success: true as const, data: serializeSession(discarded) }, 200);
  },
);

// =============================================================================
// Preview tokens  -  cross-origin, read-only draft access for the marketing
// preview iframe. Tokens authorize the GET /preview read and NOTHING else; no
// mutating route here reads or accepts them.
// =============================================================================

/**
 * The public marketing origin the preview iframe loads from. Server config, not
 * request input  -  the previewUrl we hand back is built against this trusted
 * base, so the canvas can pin postMessage to its origin.
 */
function marketingBaseUrl(): string {
  const raw = process.env.REVEALUI_PUBLIC_SERVER_URL ?? process.env.NEXT_PUBLIC_SERVER_URL;
  if (!raw || raw.length === 0) {
    throw new HTTPException(500, {
      message: 'REVEALUI_PUBLIC_SERVER_URL is not configured; cannot build a preview URL',
    });
  }
  return raw;
}

/**
 * The dashboard origin the preview runtime pins its postMessage channel to.
 * Server config, never the URL  -  this is the origin allowlist the runtime
 * trusts, so it must come from a source the browser cannot influence.
 */
function adminOrigin(): string {
  const raw = process.env.ADMIN_URL ?? process.env.NEXT_PUBLIC_ADMIN_URL;
  if (!raw || raw.length === 0) {
    throw new HTTPException(500, {
      message: 'ADMIN_URL is not configured; cannot pin the preview origin',
    });
  }
  return new URL(raw).origin;
}

const PreviewTokenSchema = z
  .object({
    token: z.string(),
    expiresAt: DateTime,
    previewUrl: z.string(),
  })
  .openapi('EditSessionPreviewToken');

const PreviewDocSchema = z.object({
  docType: z.string(),
  docId: z.string(),
  draft: z.unknown(),
});

const PreviewPayloadSchema = z
  .object({
    siteId: z.string(),
    adminOrigin: z.string(),
    docs: z.array(PreviewDocSchema),
  })
  .openapi('EditSessionPreviewPayload');

// -----------------------------------------------------------------------------
// POST /sessions/:id/preview-token  -  mint a short-lived preview token
// -----------------------------------------------------------------------------

app.openapi(
  createRoute({
    method: 'post',
    path: '/sessions/{id}/preview-token',
    tags: ['content'],
    summary: 'Mint a preview token for an edit session',
    request: {
      params: IdParam,
      query: z.object({ pageId: z.string().min(1).optional() }),
    },
    responses: {
      201: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: PreviewTokenSchema }),
          },
        },
        description: 'Preview token minted',
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
      409: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: 'Session not open',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    requireContentEditor(c.get('user'));
    const { id } = c.req.valid('param');
    const { pageId } = c.req.valid('query');

    const session = await sessionQueries.getEditSessionById(db, id);
    if (!session) throw new HTTPException(404, { message: 'Session not found' });
    if (session.status !== 'open') {
      throw new HTTPException(409, { message: 'Session is not open' });
    }

    // Resolve the page path to land the iframe on. A pageId must belong to this
    // session's site; otherwise fall back to the site root.
    let path = '/';
    if (pageId) {
      const page = await sessionQueries.getLivePage(db, pageId);
      if (!page || page.siteId !== session.siteId) {
        throw new HTTPException(404, { message: 'Page not found in this session site' });
      }
      path = page.path;
    }

    const { token, exp } = mintPreviewToken(getPreviewTokenSecret(), id, PREVIEW_TOKEN_TTL_SECONDS);

    const url = new URL(path, marketingBaseUrl());
    url.searchParams.set('rvui-edit', token);
    url.searchParams.set('rvui-session', id);

    return c.json(
      {
        success: true as const,
        data: {
          token,
          expiresAt: new Date(exp * 1000).toISOString(),
          previewUrl: url.toString(),
        },
      },
      201,
    );
  },
);

// -----------------------------------------------------------------------------
// GET /sessions/:id/preview?token=...  -  read-only draft overlays, token-auth'd
// -----------------------------------------------------------------------------
// NO cookie auth: the marketing iframe is a different origin and holds only the
// signed token. The token grants this read and nothing else.

app.openapi(
  createRoute({
    method: 'get',
    path: '/sessions/{id}/preview',
    tags: ['content'],
    summary: 'Read edit session draft overlays with a preview token',
    request: {
      params: IdParam,
      query: z.object({ token: z.string().min(1) }),
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: PreviewPayloadSchema }),
          },
        },
        description: 'Draft overlays for the session',
      },
      401: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: 'Invalid or expired token',
      },
      403: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: 'Token does not authorize this session',
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
      409: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: 'Session not open',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const { id } = c.req.valid('param');
    const { token } = c.req.valid('query');

    // Verify the token BEFORE touching any draft data, so an invalid token never
    // leaks a doc.
    const verified = verifyPreviewToken(getPreviewTokenSecret(), token);
    if (!verified.ok) {
      throw new HTTPException(401, { message: `Invalid preview token: ${verified.reason}` });
    }
    if (verified.sid !== id) {
      throw new HTTPException(403, { message: 'Token does not authorize this session' });
    }

    const session = await sessionQueries.getEditSessionById(db, id);
    if (!session) throw new HTTPException(404, { message: 'Session not found' });
    if (session.status !== 'open') {
      throw new HTTPException(409, { message: 'Session is not open' });
    }

    const docs = await sessionQueries.getSessionDocs(db, id);

    // Read-only, never cached (belt-and-braces on top of the mount-level noStore).
    c.header('Cache-Control', 'no-store, no-cache, must-revalidate');
    c.header('Pragma', 'no-cache');

    return c.json(
      {
        success: true as const,
        data: {
          siteId: session.siteId,
          adminOrigin: adminOrigin(),
          docs: docs.map((d) => ({ docType: d.docType, docId: d.docId, draft: d.draft })),
        },
      },
      200,
    );
  },
);

export default app;
