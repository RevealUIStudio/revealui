/**
 * Backward-compat re-export after GAP-467 P3 renamed the corpus module.
 * Prefer `blog-body-claims.ts`.
 */
export {
  BLOG_BODY_CLAIM_SLUGS,
  blogBodyClaims as blogBodyClaimsP2,
  blogBodyClaims,
} from './blog-body-claims.js';
