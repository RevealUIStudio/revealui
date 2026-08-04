/**
 * Enterprise SSO pure layer (GAP-464).
 *
 * OIDC discovery + id_token validation, signed SSO state, group→role mapping.
 * HTTP routes / JIT / entitlement gate land in follow-up PRs.
 */

export {
  type BuildOidcAuthorizationUrlInput,
  buildOidcAuthorizationUrl,
  createOidcRemoteJwkSet,
  type FetchOidcDiscoveryOptions,
  type FetchOidcDiscoveryResult,
  fetchOidcDiscovery,
  type JWTPayload,
  type JWTVerifyGetKey,
  type KeyLike,
  type OidcDiscoveryDocument,
  type OidcDiscoveryFailureReason,
  type ValidatedIdTokenClaims,
  type ValidateIdTokenFailureReason,
  type ValidateIdTokenResult,
  type ValidateOidcIdTokenOptions,
  validateOidcIdToken,
} from './oidc.js';

export {
  extractGroupsFromClaim,
  type MapSsoGroupsFailureReason,
  type MapSsoGroupsInput,
  type MapSsoGroupsResult,
  mapSsoGroupsToRole,
} from './roles.js';

export {
  type GenerateSsoStateInput,
  type GenerateSsoStateResult,
  generateSsoState,
  type SsoStatePayload,
  type VerifiedSsoState,
  verifySsoState,
} from './state.js';
