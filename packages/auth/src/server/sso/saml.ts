/**
 * Enterprise SAML 2.0 SP helpers (GAP-464 Phase 3).
 *
 * Wraps @node-saml/node-saml so HTTP routes get typed ok/err results matching
 * the OIDC pure layer. Hardlines:
 * - Never accept a Response without IdP certificate material (signature path).
 * - SP-initiated AuthnRequest only for MVP (IdP-initiated is a follow-up).
 * - InResponseTo checked when present (replay resistance).
 */

import { SAML, ValidateInResponseTo, type Profile } from '@node-saml/node-saml';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SamlSpConfig {
  /** Service Provider entity ID (audience) */
  spEntityId: string;
  /** ACS callback URL (POST) */
  callbackUrl: string;
  /** IdP SingleSignOnService HTTP-Redirect or HTTP-POST location */
  entryPoint: string;
  /**
   * IdP signing certificate PEM (CERTIFICATE or PUBLIC KEY).
   * REQUIRED for validation — unsigned responses are rejected.
   */
  idpCertPem: string;
  /** Optional SP signing private key PEM (signed AuthnRequest) */
  spPrivateKeyPem?: string;
  /** Optional SP public cert PEM (metadata + request signing) */
  spPublicCertPem?: string;
  /** Clock skew for NotOnOrAfter (ms, default 5 minutes) */
  acceptedClockSkewMs?: number;
}

export type ParseIdpMetadataFailureReason =
  | 'missing_xml'
  | 'missing_entity_id'
  | 'missing_sso_url'
  | 'missing_cert';

export type ParseIdpMetadataResult =
  | {
      ok: true;
      entityId: string;
      entryPoint: string;
      idpCertPem: string;
    }
  | { ok: false; reason: ParseIdpMetadataFailureReason; message: string };

export type BuildSamlAuthorizeUrlFailureReason = 'missing_config' | 'missing_cert' | 'build_failed';

export type BuildSamlAuthorizeUrlResult =
  | { ok: true; url: string }
  | { ok: false; reason: BuildSamlAuthorizeUrlFailureReason; message: string };

export type ValidateSamlResponseFailureReason =
  | 'missing_response'
  | 'missing_cert'
  | 'invalid_signature'
  | 'expired'
  | 'audience_mismatch'
  | 'replay'
  | 'missing_name_id'
  | 'logged_out'
  | 'validation_failed';

export interface ValidatedSamlAssertion {
  /** NameID value (maps to SSO subject) */
  subject: string;
  email?: string;
  name?: string;
  /** Attribute bag for group mapping (keys as claim names) */
  attributes: Record<string, unknown>;
  /** Full node-saml profile for advanced callers */
  profile: Profile;
}

export type ValidateSamlResponseResult =
  | { ok: true; assertion: ValidatedSamlAssertion }
  | { ok: false; reason: ValidateSamlResponseFailureReason; message: string };

// ---------------------------------------------------------------------------
// PEM helpers
// ---------------------------------------------------------------------------

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Normalize a certificate string to PEM CERTIFICATE block if bare base64.
 */
export function normalizeIdpCertPem(cert: string): string {
  const trimmed = cert.trim();
  if (trimmed.includes('BEGIN CERTIFICATE') || trimmed.includes('BEGIN PUBLIC KEY')) {
    return trimmed;
  }
  // Strip whitespace from bare base64
  let compact = '';
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i] as string;
    if (ch !== ' ' && ch !== '\n' && ch !== '\r' && ch !== '\t') {
      compact += ch;
    }
  }
  const lines: string[] = [];
  for (let i = 0; i < compact.length; i += 64) {
    lines.push(compact.slice(i, i + 64));
  }
  return `-----BEGIN CERTIFICATE-----\n${lines.join('\n')}\n-----END CERTIFICATE-----`;
}

// ---------------------------------------------------------------------------
// IdP metadata parse (string scans; no authored regex)
// ---------------------------------------------------------------------------

function extractXmlAttribute(xml: string, tagHint: string, attrName: string): string | null {
  // Find a tag containing tagHint, then attrName="..."
  let searchFrom = 0;
  while (searchFrom < xml.length) {
    const tagStart = xml.indexOf('<', searchFrom);
    if (tagStart === -1) return null;
    const tagEnd = xml.indexOf('>', tagStart);
    if (tagEnd === -1) return null;
    const tag = xml.slice(tagStart, tagEnd + 1);
    if (tag.includes(tagHint) && !tag.startsWith('</') && !tag.startsWith('<!--')) {
      const attrKey = `${attrName}="`;
      const attrPos = tag.indexOf(attrKey);
      if (attrPos !== -1) {
        const valueStart = attrPos + attrKey.length;
        const valueEnd = tag.indexOf('"', valueStart);
        if (valueEnd !== -1) {
          return tag.slice(valueStart, valueEnd);
        }
      }
    }
    searchFrom = tagEnd + 1;
  }
  return null;
}

function extractFirstX509Certificate(xml: string): string | null {
  const open = '<X509Certificate>';
  const openAlt = '<ds:X509Certificate>';
  let start = xml.indexOf(open);
  let openLen = open.length;
  if (start === -1) {
    start = xml.indexOf(openAlt);
    openLen = openAlt.length;
  }
  if (start === -1) return null;
  const contentStart = start + openLen;
  const close = xml.indexOf('</', contentStart);
  if (close === -1) return null;
  return xml.slice(contentStart, close).trim();
}

function extractSsoLocation(xml: string): string | null {
  // Prefer HTTP-Redirect SingleSignOnService Location
  let searchFrom = 0;
  let fallback: string | null = null;
  while (searchFrom < xml.length) {
    const tagStart = xml.indexOf('SingleSignOnService', searchFrom);
    if (tagStart === -1) break;
    // Walk back to '<'
    let open = tagStart;
    while (open > 0 && xml[open] !== '<') open--;
    const tagEnd = xml.indexOf('>', tagStart);
    if (tagEnd === -1) break;
    const tag = xml.slice(open, tagEnd + 1);
    const bindingKey = 'Binding="';
    const locKey = 'Location="';
    const bindingPos = tag.indexOf(bindingKey);
    const locPos = tag.indexOf(locKey);
    if (locPos !== -1) {
      const valueStart = locPos + locKey.length;
      const valueEnd = tag.indexOf('"', valueStart);
      if (valueEnd !== -1) {
        const location = tag.slice(valueStart, valueEnd);
        if (bindingPos !== -1) {
          const bStart = bindingPos + bindingKey.length;
          const bEnd = tag.indexOf('"', bStart);
          const binding = bEnd !== -1 ? tag.slice(bStart, bEnd) : '';
          if (binding.includes('HTTP-Redirect')) {
            return location;
          }
          if (!fallback) fallback = location;
        } else if (!fallback) {
          fallback = location;
        }
      }
    }
    searchFrom = tagEnd + 1;
  }
  return fallback;
}

/**
 * Parse IdP metadata XML for entityID, SSO entry point, and signing cert.
 * Uses linear string scans (no authored regex) for CodeQL / no-regex hardline.
 */
export function parseIdpMetadataXml(xml: string): ParseIdpMetadataResult {
  if (!isNonEmptyString(xml)) {
    return { ok: false, reason: 'missing_xml', message: 'IdP metadata XML is required' };
  }

  const entityId =
    extractXmlAttribute(xml, 'EntityDescriptor', 'entityID') ||
    extractXmlAttribute(xml, 'md:EntityDescriptor', 'entityID');
  if (!entityId) {
    return {
      ok: false,
      reason: 'missing_entity_id',
      message: 'IdP metadata missing EntityDescriptor entityID',
    };
  }

  const entryPoint = extractSsoLocation(xml);
  if (!entryPoint) {
    return {
      ok: false,
      reason: 'missing_sso_url',
      message: 'IdP metadata missing SingleSignOnService Location',
    };
  }

  const rawCert = extractFirstX509Certificate(xml);
  if (!rawCert) {
    return {
      ok: false,
      reason: 'missing_cert',
      message: 'IdP metadata missing X509Certificate',
    };
  }

  return {
    ok: true,
    entityId,
    entryPoint,
    idpCertPem: normalizeIdpCertPem(rawCert),
  };
}

// ---------------------------------------------------------------------------
// SAML service construction
// ---------------------------------------------------------------------------

function createSamlInstance(config: SamlSpConfig): SAML {
  const idpCert = normalizeIdpCertPem(config.idpCertPem);
  const options: ConstructorParameters<typeof SAML>[0] = {
    callbackUrl: config.callbackUrl,
    entryPoint: config.entryPoint,
    issuer: config.spEntityId,
    idpCert,
    audience: config.spEntityId,
    wantAssertionsSigned: true,
    wantAuthnResponseSigned: true,
    validateInResponseTo: ValidateInResponseTo.ifPresent,
    acceptedClockSkewMs: config.acceptedClockSkewMs ?? 5 * 60 * 1000,
    identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
  };
  if (config.spPrivateKeyPem) {
    options.privateKey = config.spPrivateKeyPem;
  }
  if (config.spPublicCertPem) {
    options.publicCert = config.spPublicCertPem;
  }
  return new SAML(options);
}

// ---------------------------------------------------------------------------
// SP metadata + AuthnRequest redirect
// ---------------------------------------------------------------------------

/**
 * Generate SP metadata XML for customer IdP configuration.
 */
export function buildSamlSpMetadata(config: SamlSpConfig): string {
  if (!isNonEmptyString(config.idpCertPem)) {
    throw new Error('idpCertPem is required to construct SP metadata service');
  }
  const saml = createSamlInstance(config);
  // decryptionCert null when no encryption; publicCert optional for signing
  return saml.generateServiceProviderMetadata(
    null,
    config.spPublicCertPem ? config.spPublicCertPem : null,
  );
}

/**
 * Build SP-initiated AuthnRequest redirect URL (HTTP-Redirect binding).
 * `relayState` should be the signed SSO state token (CSRF + account binding).
 */
export async function buildSamlAuthorizeUrl(
  config: SamlSpConfig,
  relayState: string,
): Promise<BuildSamlAuthorizeUrlResult> {
  if (!isNonEmptyString(config.callbackUrl) || !isNonEmptyString(config.entryPoint)) {
    return {
      ok: false,
      reason: 'missing_config',
      message: 'callbackUrl and entryPoint are required',
    };
  }
  if (!isNonEmptyString(config.idpCertPem)) {
    return {
      ok: false,
      reason: 'missing_cert',
      message: 'IdP signing certificate is required',
    };
  }
  if (!isNonEmptyString(config.spEntityId)) {
    return {
      ok: false,
      reason: 'missing_config',
      message: 'spEntityId is required',
    };
  }

  try {
    const saml = createSamlInstance(config);
    const url = await saml.getAuthorizeUrlAsync(relayState, undefined, {});
    return { ok: true, url };
  } catch (err) {
    return {
      ok: false,
      reason: 'build_failed',
      message: err instanceof Error ? err.message : 'Failed to build SAML AuthnRequest URL',
    };
  }
}

// ---------------------------------------------------------------------------
// Response validation
// ---------------------------------------------------------------------------

function mapValidateError(err: unknown): {
  reason: ValidateSamlResponseFailureReason;
  message: string;
} {
  const message = err instanceof Error ? err.message : 'SAML response validation failed';
  const lower = message.toLowerCase();

  if (lower.includes('signature') || lower.includes('invalid document')) {
    return { reason: 'invalid_signature', message };
  }
  if (lower.includes('expired') || lower.includes('notonorafter') || lower.includes('not before')) {
    return { reason: 'expired', message };
  }
  if (lower.includes('audience')) {
    return { reason: 'audience_mismatch', message };
  }
  if (lower.includes('inresponseto') || lower.includes('replay')) {
    return { reason: 'replay', message };
  }
  return { reason: 'validation_failed', message };
}

function profileToAssertion(profile: Profile): ValidatedSamlAssertion | null {
  const subject = typeof profile.nameID === 'string' ? profile.nameID.trim() : '';
  if (!subject) return null;

  const attributes: Record<string, unknown> = {};
  // Profile is a claim bag ([attributeName: string]: unknown) plus fixed fields
  for (const [key, value] of Object.entries(profile)) {
    if (key === 'getAssertionXml' || key === 'getAssertion' || key === 'getSamlResponseXml') {
      continue;
    }
    if (typeof value === 'function') continue;
    attributes[key] = value;
  }

  if (typeof profile.email === 'string') {
    attributes.email = profile.email;
  }
  const msGroups = profile['http://schemas.microsoft.com/ws/2008/06/identity/claims/groups'];
  if (Array.isArray(msGroups)) {
    attributes.groups = msGroups;
  }
  if (typeof profile.mail === 'string') {
    attributes.mail = profile.mail;
  }

  const email =
    (typeof profile.email === 'string' && profile.email) ||
    (typeof profile.mail === 'string' && profile.mail) ||
    (subject.includes('@') ? subject : undefined);

  const displayName = profile.displayName;
  const cn = profile.cn;
  const name =
    (typeof displayName === 'string' && displayName) || (typeof cn === 'string' && cn) || undefined;

  return {
    subject,
    email,
    name,
    attributes,
    profile,
  };
}

/**
 * Validate a SAMLResponse from HTTP-POST binding.
 * Requires IdP cert; rejects unsigned / bad-signature responses.
 */
export async function validateSamlPostResponse(
  config: SamlSpConfig,
  samlResponseBase64: string,
): Promise<ValidateSamlResponseResult> {
  if (!isNonEmptyString(samlResponseBase64)) {
    return {
      ok: false,
      reason: 'missing_response',
      message: 'SAMLResponse is required',
    };
  }
  if (!isNonEmptyString(config.idpCertPem)) {
    return {
      ok: false,
      reason: 'missing_cert',
      message: 'IdP signing certificate is required; unsigned responses are rejected',
    };
  }

  try {
    const saml = createSamlInstance(config);
    const { profile, loggedOut } = await saml.validatePostResponseAsync({
      SAMLResponse: samlResponseBase64,
    });

    if (loggedOut) {
      return {
        ok: false,
        reason: 'logged_out',
        message: 'SAML response was a logout response',
      };
    }
    if (!profile) {
      return {
        ok: false,
        reason: 'validation_failed',
        message: 'SAML validation returned no profile',
      };
    }

    const assertion = profileToAssertion(profile);
    if (!assertion) {
      return {
        ok: false,
        reason: 'missing_name_id',
        message: 'SAML assertion missing NameID / subject',
      };
    }

    return { ok: true, assertion };
  } catch (err) {
    const mapped = mapValidateError(err);
    return { ok: false, reason: mapped.reason, message: mapped.message };
  }
}

/**
 * Fetch and parse IdP metadata from a URL (test-connection + seed entryPoint/cert).
 */
export async function fetchIdpMetadata(
  metadataUrl: string,
  options?: { fetchImpl?: typeof fetch; timeoutMs?: number },
): Promise<ParseIdpMetadataResult> {
  if (!isNonEmptyString(metadataUrl)) {
    return { ok: false, reason: 'missing_xml', message: 'metadata URL is required' };
  }
  const fetchImpl = options?.fetchImpl ?? fetch;
  const timeoutMs = options?.timeoutMs ?? 10_000;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(metadataUrl, { signal: controller.signal });
      if (!res.ok) {
        return {
          ok: false,
          reason: 'missing_xml',
          message: `IdP metadata fetch failed with HTTP ${res.status}`,
        };
      }
      const text = await res.text();
      return parseIdpMetadataXml(text);
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    return {
      ok: false,
      reason: 'missing_xml',
      message: err instanceof Error ? err.message : 'IdP metadata fetch failed',
    };
  }
}
