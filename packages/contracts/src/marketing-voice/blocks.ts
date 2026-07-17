import { isAdrCitePath } from './predicates.js';

/**
 * Minimal structural view of a marketing block for the voice engine. This is
 * NOT the Phase-B admin Zod schema — the engine deliberately depends only on
 * the shape it actually reads (`blockType` + prose fields holding Lexical
 * editor state) so it does not block on the block-schema work.
 *
 * The real, shipped block shape stores prose as a Lexical `richText` editor
 * state inside a `blockType`-discriminated block (see the fleet-marketing seed:
 * a `blockType: 'hero'` block whose `richText.root.children` is a heading + a
 * paragraph). The spec's named-slot model (`Hero.h1`, `Hero.subhead`) was never
 * built; per code-over-docs the engine targets the real shape.
 */
export interface MarketingBlock {
  blockType: string;
  [field: string]: unknown;
}

/** A Lexical node as the walker reads it — only the fields the engine touches. */
export interface LexicalNodeLike {
  type: string;
  tag?: string;
  text?: string;
  url?: string;
  fields?: { url?: string; newTab?: boolean; linkType?: string };
  listType?: string;
  children?: LexicalNodeLike[];
}

/** The `SerializedEditorState` container shape: `{ root: { children: [...] } }`. */
export interface LexicalRootLike {
  root: { type?: string; children?: LexicalNodeLike[] };
}

/** One voice-validated prose field of a block, with its owning field path. */
export interface ProseSlot {
  field: string;
  value: LexicalRootLike | string;
}

/**
 * Thrown when a block's `blockType` has no `MARKETING_PROSE_SLOTS` entry. A
 * block the engine cannot introspect is a block it cannot clear, so this fails
 * closed (loud error) rather than silently skipping validation.
 */
export class UnmappedBlockTypeError extends Error {
  readonly blockType: string;
  constructor(blockType: string) {
    super(
      `Unmapped marketing blockType '${blockType}': no MARKETING_PROSE_SLOTS entry. ` +
        'A block the voice engine cannot introspect cannot be cleared — register its ' +
        'prose slots in MARKETING_PROSE_SLOTS.',
    );
    this.name = 'UnmappedBlockTypeError';
    this.blockType = blockType;
  }
}

/**
 * Source of truth mapping a REAL `blockType` to the field paths that hold voice-
 * validated prose. Keyed on the shipped block-type values, pointing at the real
 * `richText` Lexical fields — NOT the spec's aspirational `Hero.h1` named slots.
 *
 * Phase B block types register here. Field paths may use a single array-glob
 * segment (e.g. `items[].q`) resolved by `resolveFieldPath`.
 */
export const MARKETING_PROSE_SLOTS: Record<string, string[]> = {
  hero: ['richText'],
  content: ['richText'],
  cta: ['richText'],
};

const PROSE_CONTAINER_TYPES = new Set(['paragraph', 'heading', 'listitem', 'quote']);
const CODE_NODE_TYPES = new Set(['code', 'codehighlight']);
/** Depth cap, mirroring the existing content validator posture (maxDepth 20). */
const MAX_DEPTH = 20;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asLexicalRoot(value: LexicalRootLike | string): LexicalNodeLike {
  if (typeof value === 'string') {
    // A plain-text slot normalizes to one synthetic paragraph so it flows
    // through the same walker as Lexical slots.
    return {
      type: 'root',
      children: [{ type: 'paragraph', children: [{ type: 'text', text: value }] }],
    };
  }
  const root = value.root;
  return { type: 'root', children: root?.children ?? [] };
}

/**
 * Resolve a field path against a block. Supports plain fields (`richText`) and a
 * single array-glob segment (`items[].q` → the `q` of every element of `items`).
 * Returns every matching value (empty array when the path does not resolve).
 */
function resolveFieldPath(block: MarketingBlock, path: string): unknown[] {
  const segments = path.split('.');
  let current: unknown[] = [block];
  for (const segment of segments) {
    const next: unknown[] = [];
    const isGlob = segment.endsWith('[]');
    const key = isGlob ? segment.slice(0, -2) : segment;
    for (const node of current) {
      if (!isRecord(node)) continue;
      const value = node[key];
      if (isGlob) {
        if (Array.isArray(value)) next.push(...value);
      } else if (value !== undefined) {
        next.push(value);
      }
    }
    current = next;
  }
  return current;
}

function isProseSlotValue(value: unknown): value is LexicalRootLike | string {
  return typeof value === 'string' || (isRecord(value) && isRecord(value.root));
}

/**
 * Enumerate a block's voice-validated prose slots, with field attribution
 * preserved. Throws `UnmappedBlockTypeError` for an unregistered `blockType`
 * (fail-closed). A registered field that is present but not a prose value
 * (string or `{root}`) is skipped — it carries no prose to validate.
 */
export function getProseSlots(block: MarketingBlock): ProseSlot[] {
  const fieldPaths = MARKETING_PROSE_SLOTS[block.blockType];
  if (fieldPaths === undefined) throw new UnmappedBlockTypeError(block.blockType);
  const slots: ProseSlot[] = [];
  for (const path of fieldPaths) {
    for (const value of resolveFieldPath(block, path)) {
      if (isProseSlotValue(value)) slots.push({ field: path, value });
    }
  }
  return slots;
}

function* walkNodes(nodes: LexicalNodeLike[], depth: number): Generator<LexicalNodeLike> {
  if (depth > MAX_DEPTH) return;
  for (const node of nodes) {
    if (!isRecord(node) || typeof node.type !== 'string') continue;
    if (CODE_NODE_TYPES.has(node.type)) continue; // prune code subtrees structurally
    yield node;
    if (Array.isArray(node.children)) yield* walkNodes(node.children, depth + 1);
  }
}

/**
 * Yield every descendant node across a block's prose slots, EXCEPT nodes inside
 * a code subtree (pruned structurally — no fenced-code preprocessing). Callers
 * filter by `node.type`: prose-text extraction filters to containers, ADR-cite
 * detection filters to `link`.
 */
export function* walkLexicalAst(block: MarketingBlock): Generator<LexicalNodeLike> {
  for (const slot of getProseSlots(block)) {
    const root = asLexicalRoot(slot.value);
    yield* walkNodes(root.children ?? [], 0);
  }
}

/**
 * Yield the top-most prose containers of a slot root (headings, paragraphs,
 * quotes, and each list's `listitem`s), descending through non-container
 * wrappers (`root`, `list`) but never into a container once found — so a
 * paragraph nested in a quote is covered by the quote, not counted twice. Code
 * subtrees are pruned.
 */
function* proseContainers(root: LexicalNodeLike, depth: number): Generator<LexicalNodeLike> {
  if (depth > MAX_DEPTH) return;
  for (const node of root.children ?? []) {
    if (!isRecord(node) || typeof node.type !== 'string') continue;
    if (CODE_NODE_TYPES.has(node.type)) continue;
    if (PROSE_CONTAINER_TYPES.has(node.type)) {
      yield node;
    } else if (Array.isArray(node.children)) {
      yield* proseContainers(node, depth + 1);
    }
  }
}

/**
 * Concatenate the text of a container's descendant `text` nodes (including text
 * inside `link` nodes), left-to-right, stopping at code descendants. This is the
 * text stream the token rules run over — a whole prose container, so a
 * bold-split `**RVC**` and a later `$0.10` in the same paragraph are one stream.
 */
function nodeText(node: LexicalNodeLike, depth: number): string {
  if (depth > MAX_DEPTH) return '';
  if (CODE_NODE_TYPES.has(node.type)) return '';
  let out = typeof node.text === 'string' ? node.text : '';
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      if (isRecord(child) && typeof child.type === 'string') out += nodeText(child, depth + 1);
    }
  }
  return out;
}

/** A prose container paired with its text and node type, for rule evaluation. */
export interface ProseContainer {
  field: string;
  nodeType: string;
  tag?: string;
  text: string;
}

/**
 * Enumerate every prose container of a block, with field attribution and the
 * container's flattened text. This is what `runTier1`/`runTier2` iterate.
 */
export function getProseContainers(block: MarketingBlock): ProseContainer[] {
  const out: ProseContainer[] = [];
  for (const slot of getProseSlots(block)) {
    const root = asLexicalRoot(slot.value);
    for (const container of proseContainers(root, 0)) {
      out.push({
        field: slot.field,
        nodeType: container.type,
        ...(typeof container.tag === 'string' ? { tag: container.tag } : {}),
        text: nodeText(container, 0),
      });
    }
  }
  return out;
}

/**
 * Find any ADR-cite link anywhere in the block (block-level exoneration). Any
 * ADR link in the block exonerates the whole block for the pricing rules.
 */
export function findAdrCiteInBlock(block: MarketingBlock): LexicalNodeLike | null {
  for (const node of walkLexicalAst(block)) {
    if (node.type !== 'link') continue;
    const url = typeof node.url === 'string' ? node.url : node.fields?.url;
    if (typeof url === 'string' && isAdrCitePath(url)) return node;
  }
  return null;
}
