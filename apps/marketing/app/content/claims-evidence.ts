/**
 * Claims-evidence index (barrel).
 * Types, shared evidence refs, and sequential claim parts under ./claims-evidence/.
 */
export type {
  ClaimEntry,
  CoveredFile,
  EvidenceKind,
  EvidenceRef,
} from './claims-evidence/types.js';
export { COVERED_FILES } from './claims-evidence/types.js';

import { blogBodyClaimsP2 } from './claims-evidence/blog-body-claims-p2.js';
import { blogMetaClaims } from './claims-evidence/blog-meta-claims.js';
import { claimsPart1 } from './claims-evidence/claims-part-1.js';
import { claimsPart2 } from './claims-evidence/claims-part-2.js';
import { claimsPart3 } from './claims-evidence/claims-part-3.js';
import { claimsPart4 } from './claims-evidence/claims-part-4.js';
import { claimsPart5 } from './claims-evidence/claims-part-5.js';
import { claimsPart6 } from './claims-evidence/claims-part-6.js';
import type { ClaimEntry } from './claims-evidence/types.js';

export const CLAIMS: readonly ClaimEntry[] = [
  ...claimsPart1,
  ...claimsPart2,
  ...claimsPart3,
  ...claimsPart4,
  ...claimsPart5,
  ...claimsPart6,
  ...blogMetaClaims,
  ...blogBodyClaimsP2,
];

export { BLOG_BODY_CLAIM_SLUGS } from './claims-evidence/blog-body-claims-p2.js';

export { NON_COPY_KEYS } from './claims-evidence/non-copy-keys.js';
