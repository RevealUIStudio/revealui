/**
 * Claims-evidence index (barrel).
 * Types, shared evidence refs, and sequential claim parts under ./claims-evidence/.
 */
export type {
  ClaimEntry,
  CoveredFile,
  EvidenceKind,
  EvidenceRef,
  ProofGrade,
} from './claims-evidence/types.js';
export {
  COVERED_FILES,
  CRITICAL_PROOF_FILES,
  effectiveProofGrade,
  isCriticalMarketingClaim,
  isProofGradeSufficient,
} from './claims-evidence/types.js';

import { blogBodyClaims } from './claims-evidence/blog-body-claims.js';
import { blogMetaClaims } from './claims-evidence/blog-meta-claims.js';
import { claimsPart1 } from './claims-evidence/claims-part-1.js';
import { claimsPart2 } from './claims-evidence/claims-part-2.js';
import { claimsPart3 } from './claims-evidence/claims-part-3.js';
import { claimsPart4 } from './claims-evidence/claims-part-4.js';
import { claimsPart5 } from './claims-evidence/claims-part-5.js';
import { claimsPart6 } from './claims-evidence/claims-part-6.js';
import { claimsPart7 } from './claims-evidence/claims-part-7.js';
import { claimsPart8 } from './claims-evidence/claims-part-8.js';
import type { ClaimEntry } from './claims-evidence/types.js';

export const CLAIMS: readonly ClaimEntry[] = [
  ...claimsPart1,
  ...claimsPart2,
  ...claimsPart3,
  ...claimsPart4,
  ...claimsPart5,
  ...claimsPart6,
  ...claimsPart7,
  ...claimsPart8,
  ...blogMetaClaims,
  ...blogBodyClaims,
];

export { BLOG_BODY_CLAIM_SLUGS } from './claims-evidence/blog-body-claims.js';

export { NON_COPY_KEYS } from './claims-evidence/non-copy-keys.js';
