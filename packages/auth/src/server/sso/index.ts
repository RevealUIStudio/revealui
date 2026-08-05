/**
 * Enterprise SSO pure layer (GAP-464).
 *
 * OIDC discovery + id_token validation, code exchange, SAML SP helpers,
 * signed SSO state, group→role mapping, JIT user upsert. HTTP routes +
 * account entitlement gate live in apps/server.
 */

export {
  normalizeSsoUserRole,
  type UpsertSsoUserInput,
  upsertSsoUser,
} from './jit.js';
export {
  type BuildOidcAuthorizationUrlInput,
  buildOidcAuthorizationUrl,
  createOidcRemoteJwkSet,
  type ExchangeOidcCodeFailureReason,
  type ExchangeOidcCodeInput,
  type ExchangeOidcCodeResult,
  type ExchangeOidcCodeSuccess,
  exchangeOidcCode,
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
  type BuildSamlAuthorizeUrlFailureReason,
  type BuildSamlAuthorizeUrlResult,
  buildSamlAuthorizeUrl,
  buildSamlSpMetadata,
  fetchIdpMetadata,
  normalizeIdpCertPem,
  type ParseIdpMetadataFailureReason,
  type ParseIdpMetadataResult,
  parseIdpMetadataXml,
  type SamlSpConfig,
  type ValidatedSamlAssertion,
  type ValidateSamlResponseFailureReason,
  type ValidateSamlResponseResult,
  validateSamlPostResponse,
} from './saml.js';
export {
  type GenerateSsoStateInput,
  type GenerateSsoStateResult,
  generateSsoState,
  type SsoStatePayload,
  type VerifiedSsoState,
  verifySsoState,
} from './state.js';
