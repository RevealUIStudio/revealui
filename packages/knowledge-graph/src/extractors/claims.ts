/**
 * Claims-evidence extractor (Tier-1, GAP-462 Phase 3).
 *
 * Parses `apps/marketing/app/content/claims-evidence.ts` with the TypeScript
 * compiler API (no regex, no hard import of marketing modules) and emits:
 *
 * - `concept` nodes with `proposedKind: 'claim'` per CLAIMS entry
 * - `file` nodes for the marketing content module and for path-shaped evidence
 * - `documents` edges (claim → evidence file) so `kgDrift` / `revkg drift` can
 *   report when code last-confirmed is newer than the claim scan
 *
 * Evidence kinds `code`, `test`, and `metric` that look like repo-relative paths
 * produce `documents` edges. `command` / `url` are recorded only on the claim
 * node attributes (no graph edge). Test refs may use `path#title`; the path
 * fragment before `#` is the code target.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import type { EdgeInput, NodeInput } from '../types.js';
import { claimKey, fileKey, readTextFile, scanEpisode, toPosix } from './shared.js';
import type { Extractor, ExtractorContext, ScanProduct } from './types.js';

/** Default location of the claims-evidence index in the revealui monorepo. */
export const CLAIMS_EVIDENCE_REL = 'apps/marketing/app/content/claims-evidence.ts';

const CONTENT_DIR = 'apps/marketing/app/content';

/** Path-shaped evidence kinds that feed `documents` edges. */
const PATH_EVIDENCE_KINDS = new Set(['code', 'test', 'metric']);

export interface ParsedEvidence {
  kind: string;
  ref: string;
  note?: string;
}

export interface ParsedClaim {
  file: string;
  exportPath: string;
  text: string;
  evidence: ParsedEvidence[];
}

export interface ClaimsCheckIssue {
  claimKey: string;
  exportPath: string;
  evidenceRef: string;
  reason: string;
}

function mapKey(kind: string, naturalKey: string): string {
  return `${kind}:${naturalKey}`;
}

function propertyName(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isPrivateIdentifier(name)) return name.text;
  if (ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)) return name.text;
  return null;
}

function stringFromExpression(expr: ts.Expression): string | undefined {
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
    return expr.text;
  }
  return undefined;
}

function objectStringProp(obj: ts.ObjectLiteralExpression, key: string): string | undefined {
  for (const prop of obj.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    const name = propertyName(prop.name);
    if (name !== key) continue;
    return stringFromExpression(prop.initializer);
  }
  return undefined;
}

function parseEvidenceObject(obj: ts.ObjectLiteralExpression): ParsedEvidence | null {
  const kind = objectStringProp(obj, 'kind');
  const ref = objectStringProp(obj, 'ref');
  if (!(kind && ref)) return null;
  const note = objectStringProp(obj, 'note');
  return note !== undefined ? { kind, ref, note } : { kind, ref };
}

/**
 * Collect const bindings that look like EvidenceRef object literals
 * (`kind` + `ref` string properties). Used to resolve identifier references
 * inside CLAIMS[].evidence arrays.
 */
function collectEvidenceConsts(source: ts.SourceFile): Map<string, ParsedEvidence> {
  const out = new Map<string, ParsedEvidence>();
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      let init: ts.Expression = node.initializer;
      while (
        ts.isAsExpression(init) ||
        ts.isSatisfiesExpression(init) ||
        ts.isTypeAssertionExpression(init)
      ) {
        init = init.expression;
      }
      if (ts.isObjectLiteralExpression(init)) {
        const parsed = parseEvidenceObject(init);
        if (parsed) out.set(node.name.text, parsed);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out;
}

function findClaimsArray(source: ts.SourceFile): ts.ArrayLiteralExpression | null {
  let found: ts.ArrayLiteralExpression | null = null;
  const visit = (node: ts.Node): void => {
    if (found) return;
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'CLAIMS'
    ) {
      let init = node.initializer;
      if (!init) return;
      while (
        ts.isAsExpression(init) ||
        ts.isSatisfiesExpression(init) ||
        ts.isTypeAssertionExpression(init)
      ) {
        init = init.expression;
      }
      if (ts.isArrayLiteralExpression(init)) {
        found = init;
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

function parseEvidenceElement(
  el: ts.Expression,
  consts: Map<string, ParsedEvidence>,
): ParsedEvidence | null {
  if (ts.isIdentifier(el)) {
    return consts.get(el.text) ?? null;
  }
  if (ts.isObjectLiteralExpression(el)) {
    return parseEvidenceObject(el);
  }
  if (ts.isAsExpression(el) || ts.isSatisfiesExpression(el)) {
    return parseEvidenceElement(el.expression, consts);
  }
  return null;
}

function parseClaimObject(
  obj: ts.ObjectLiteralExpression,
  consts: Map<string, ParsedEvidence>,
): ParsedClaim | null {
  const file = objectStringProp(obj, 'file');
  const exportPath = objectStringProp(obj, 'exportPath');
  const text = objectStringProp(obj, 'text');
  if (!(file && exportPath && text !== undefined)) return null;

  const evidence: ParsedEvidence[] = [];
  for (const prop of obj.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    if (propertyName(prop.name) !== 'evidence') continue;
    let init = prop.initializer;
    while (ts.isAsExpression(init) || ts.isSatisfiesExpression(init)) {
      init = init.expression;
    }
    if (!ts.isArrayLiteralExpression(init)) continue;
    for (const el of init.elements) {
      const parsed = parseEvidenceElement(el, consts);
      if (parsed) evidence.push(parsed);
    }
  }

  return { file, exportPath, text, evidence };
}

/**
 * Parse claims-evidence TypeScript source into claim entries.
 * Exported for unit tests and for `revkg claims-check` without full extract.
 */
export function parseClaimsEvidenceSource(
  sourceText: string,
  fileName = CLAIMS_EVIDENCE_REL,
): ParsedClaim[] {
  const source = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true);
  const consts = collectEvidenceConsts(source);
  const arr = findClaimsArray(source);
  if (!arr) return [];

  const claims: ParsedClaim[] = [];
  for (const el of arr.elements) {
    let expr: ts.Expression = el;
    while (ts.isAsExpression(expr) || ts.isSatisfiesExpression(expr)) {
      expr = expr.expression;
    }
    if (!ts.isObjectLiteralExpression(expr)) continue;
    const claim = parseClaimObject(expr, consts);
    if (claim) claims.push(claim);
  }
  return claims;
}

/**
 * Strip optional `#test title` suffix used by capability-claim test refs.
 * Returns the repo-relative path portion only.
 */
export function evidencePathFromRef(ref: string): string {
  const hash = ref.indexOf('#');
  if (hash === -1) return toPosix(ref);
  return toPosix(ref.slice(0, hash));
}

/** True when the kind+ref pair is a path we can attach a `documents` edge to. */
export function isPathEvidence(kind: string, ref: string): boolean {
  if (!PATH_EVIDENCE_KINDS.has(kind)) return false;
  if (ref.length === 0) return false;
  // URLs and absolute paths are not monorepo evidence.
  if (ref.includes('://') || ref.startsWith('/')) return false;
  return true;
}

/**
 * Filesystem check: every path-shaped evidence ref should exist under repoRoot
 * (file or directory). Used by `revkg claims-check` without a database.
 */
export function missingEvidencePaths(
  repoRoot: string,
  claims: readonly ParsedClaim[],
  repo: string,
): ClaimsCheckIssue[] {
  const issues: ClaimsCheckIssue[] = [];
  for (const claim of claims) {
    const ck = claimKey(repo, claim.file, claim.exportPath);
    for (const ev of claim.evidence) {
      if (!isPathEvidence(ev.kind, ev.ref)) continue;
      const rel = evidencePathFromRef(ev.ref);
      if (!existsSync(join(repoRoot, rel))) {
        issues.push({
          claimKey: ck,
          exportPath: claim.exportPath,
          evidenceRef: ev.ref,
          reason: `missing path: ${rel}`,
        });
      }
    }
  }
  return issues;
}

export const claimsExtractor: Extractor = {
  name: 'claims',
  async extract(ctx: ExtractorContext): Promise<ScanProduct[]> {
    const fullPath = join(ctx.repoRoot, CLAIMS_EVIDENCE_REL);
    const text = readTextFile(fullPath);
    if (text === null) return [];

    let claims: ParsedClaim[];
    try {
      claims = parseClaimsEvidenceSource(text, CLAIMS_EVIDENCE_REL);
    } catch {
      return [];
    }
    if (claims.length === 0) return [];

    const nodes = new Map<string, NodeInput>();
    const edges: EdgeInput[] = [];

    const indexNode: NodeInput = {
      kind: 'file',
      name: 'claims-evidence.ts',
      naturalKey: fileKey(ctx.repo, CLAIMS_EVIDENCE_REL),
      repo: ctx.repo,
      attributes: { path: CLAIMS_EVIDENCE_REL, language: 'typescript' },
      summary: 'Marketing claims-evidence index (sentence → proof)',
    };
    nodes.set(mapKey(indexNode.kind, indexNode.naturalKey), indexNode);

    for (const claim of claims) {
      const contentRel = toPosix(join(CONTENT_DIR, claim.file));
      const contentKey = fileKey(ctx.repo, contentRel);
      if (!nodes.has(mapKey('file', contentKey))) {
        const contentNode: NodeInput = {
          kind: 'file',
          name: claim.file,
          naturalKey: contentKey,
          repo: ctx.repo,
          attributes: { path: contentRel, language: 'typescript' },
        };
        nodes.set(mapKey('file', contentKey), contentNode);
      }

      const cKey = claimKey(ctx.repo, claim.file, claim.exportPath);
      const claimNode: NodeInput = {
        kind: 'concept',
        name: claim.exportPath,
        naturalKey: cKey,
        repo: ctx.repo,
        summary: claim.text.length > 240 ? `${claim.text.slice(0, 237)}...` : claim.text,
        attributes: {
          proposedKind: 'claim',
          contentFile: claim.file,
          exportPath: claim.exportPath,
          text: claim.text,
          path: contentRel,
        },
      };
      nodes.set(mapKey(claimNode.kind, claimNode.naturalKey), claimNode);

      edges.push({
        source: { kind: 'file', naturalKey: contentKey },
        target: { kind: 'concept', naturalKey: cKey },
        relation: 'contains',
        fact: `${claim.file} contains claim ${claim.exportPath}`,
        repo: ctx.repo,
      });

      edges.push({
        source: { kind: 'file', naturalKey: indexNode.naturalKey },
        target: { kind: 'concept', naturalKey: cKey },
        relation: 'mentions',
        fact: `claims-evidence indexes ${claim.exportPath}`,
        repo: ctx.repo,
      });

      for (const ev of claim.evidence) {
        if (!isPathEvidence(ev.kind, ev.ref)) continue;
        const rel = evidencePathFromRef(ev.ref);
        const codeKey = fileKey(ctx.repo, rel);
        if (!nodes.has(mapKey('file', codeKey))) {
          const codeNode: NodeInput = {
            kind: 'file',
            name: rel.split('/').pop() ?? rel,
            naturalKey: codeKey,
            repo: ctx.repo,
            attributes: {
              path: rel,
              evidenceKind: ev.kind,
              ...(ev.note ? { note: ev.note } : {}),
            },
          };
          nodes.set(mapKey('file', codeKey), codeNode);
        }

        // documents: DOC (claim) → CODE (evidence) per kgDrift direction convention
        edges.push({
          source: { kind: 'concept', naturalKey: cKey },
          target: { kind: 'file', naturalKey: codeKey },
          relation: 'documents',
          fact: `${claim.exportPath} documents ${rel}`,
          repo: ctx.repo,
          attributes: {
            evidenceKind: ev.kind,
            ...(ev.note ? { note: ev.note } : {}),
          },
        });
      }
    }

    return [
      {
        episode: scanEpisode(ctx, 'claims', { claims: claims.length }),
        nodes: [...nodes.values()],
        edges,
        scope: { repo: ctx.repo, extractor: 'claims' },
      },
    ];
  },
};
