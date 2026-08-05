import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  buildSamlAuthorizeUrl,
  buildSamlSpMetadata,
  fetchIdpMetadata,
  normalizeIdpCertPem,
  parseIdpMetadataXml,
  type SamlSpConfig,
  validateSamlPostResponse,
} from '../saml.js';

const SP_ENTITY = 'https://app.example.com/sp';
const CALLBACK = 'https://api.example.com/api/auth/sso/prov-1/callback';
const ENTRY = 'https://idp.example.com/sso';

function makeRsaCertPair(): { certPem: string; privateKeyPem: string } {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  // node-saml expects CERTIFICATE for idpCert; SPKI public key is accepted as PUBLIC KEY
  // Convert SPKI to a self-signed-looking CERT is heavy; PUBLIC KEY PEM works for some paths.
  // Use publicKey as cert body with CERTIFICATE label only when base64 — normalizeIdpCertPem
  // wraps bare base64. For generateKeyPairSync SPKI, pass as PUBLIC KEY via normalize:
  return { certPem: publicKey, privateKeyPem: privateKey };
}

function sampleMetadata(entityId: string, ssoUrl: string, certBody: string): string {
  return `<?xml version="1.0"?>
<EntityDescriptor entityID="${entityId}" xmlns="urn:oasis:names:tc:SAML:2.0:metadata">
  <IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <KeyDescriptor use="signing">
      <KeyInfo xmlns="http://www.w3.org/2000/09/xmldsig#">
        <X509Data>
          <X509Certificate>${certBody}</X509Certificate>
        </X509Data>
      </KeyInfo>
    </KeyDescriptor>
    <SingleSignOnService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
      Location="${ssoUrl}" />
  </IDPSSODescriptor>
</EntityDescriptor>`;
}

describe('normalizeIdpCertPem', () => {
  it('passes through existing PEM blocks', () => {
    const pem = '-----BEGIN CERTIFICATE-----\nABC\n-----END CERTIFICATE-----';
    expect(normalizeIdpCertPem(pem)).toBe(pem);
  });

  it('wraps bare base64 in a CERTIFICATE PEM block', () => {
    const bare = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A';
    const out = normalizeIdpCertPem(bare);
    expect(out.includes('BEGIN CERTIFICATE')).toBe(true);
    expect(out.includes(bare)).toBe(true);
  });
});

describe('parseIdpMetadataXml', () => {
  it('extracts entityID, HTTP-Redirect SSO Location, and cert', () => {
    const certBody = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA';
    const xml = sampleMetadata('https://idp.example.com', ENTRY, certBody);
    const result = parseIdpMetadataXml(xml);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entityId).toBe('https://idp.example.com');
      expect(result.entryPoint).toBe(ENTRY);
      expect(result.idpCertPem.includes('BEGIN CERTIFICATE')).toBe(true);
    }
  });

  it('rejects empty xml', () => {
    const result = parseIdpMetadataXml('');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('missing_xml');
  });

  it('rejects metadata without entityID', () => {
    const result = parseIdpMetadataXml('<EntityDescriptor></EntityDescriptor>');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('missing_entity_id');
  });

  it('rejects metadata without SSO location', () => {
    const xml = `<EntityDescriptor entityID="https://idp.example.com"></EntityDescriptor>`;
    const result = parseIdpMetadataXml(xml);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('missing_sso_url');
  });

  it('rejects metadata without certificate', () => {
    const xml = `<?xml version="1.0"?>
<EntityDescriptor entityID="https://idp.example.com">
  <IDPSSODescriptor>
    <SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="${ENTRY}" />
  </IDPSSODescriptor>
</EntityDescriptor>`;
    const result = parseIdpMetadataXml(xml);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('missing_cert');
  });
});

describe('fetchIdpMetadata', () => {
  it('fetches and parses metadata', async () => {
    const certBody = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA';
    const xml = sampleMetadata('https://idp.example.com', ENTRY, certBody);
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => xml,
    });
    const result = await fetchIdpMetadata('https://idp.example.com/metadata', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entityId).toBe('https://idp.example.com');
      expect(result.entryPoint).toBe(ENTRY);
    }
  });

  it('fails closed on HTTP error', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    const result = await fetchIdpMetadata('https://idp.example.com/metadata', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.ok).toBe(false);
  });
});

describe('buildSamlSpMetadata + authorize URL', () => {
  const { certPem } = makeRsaCertPair();

  const config: SamlSpConfig = {
    spEntityId: SP_ENTITY,
    callbackUrl: CALLBACK,
    entryPoint: ENTRY,
    idpCertPem: certPem,
  };

  it('builds SP metadata containing entityID and ACS', () => {
    const meta = buildSamlSpMetadata(config);
    expect(meta.includes('EntityDescriptor')).toBe(true);
    expect(meta.includes(SP_ENTITY)).toBe(true);
    expect(meta.includes(CALLBACK) || meta.includes('AssertionConsumerService')).toBe(true);
  });

  it('builds an HTTP-Redirect AuthnRequest URL against the IdP entryPoint', async () => {
    const result = await buildSamlAuthorizeUrl(config, 'relay-state-token');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.url.startsWith(ENTRY)).toBe(true);
      expect(result.url.includes('SAMLRequest=')).toBe(true);
      expect(result.url.includes('RelayState=')).toBe(true);
    }
  });

  it('rejects authorize URL without IdP cert', async () => {
    const result = await buildSamlAuthorizeUrl({ ...config, idpCertPem: '' }, 'relay');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('missing_cert');
  });
});

describe('validateSamlPostResponse', () => {
  const { certPem } = makeRsaCertPair();
  const config: SamlSpConfig = {
    spEntityId: SP_ENTITY,
    callbackUrl: CALLBACK,
    entryPoint: ENTRY,
    idpCertPem: certPem,
  };

  it('rejects missing SAMLResponse', async () => {
    const result = await validateSamlPostResponse(config, '');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('missing_response');
  });

  it('rejects missing IdP cert', async () => {
    const result = await validateSamlPostResponse(
      { ...config, idpCertPem: '' },
      Buffer.from('<Response/>').toString('base64'),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('missing_cert');
  });

  it('rejects unsigned / garbage SAMLResponse (signature hardline)', async () => {
    const unsigned = Buffer.from(
      `<?xml version="1.0"?>
      <samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
        ID="_r1" Version="2.0" IssueInstant="2020-01-01T00:00:00Z"
        Destination="${CALLBACK}">
        <saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">https://idp.example.com</saml:Issuer>
        <samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>
      </samlp:Response>`,
    ).toString('base64');
    const result = await validateSamlPostResponse(config, unsigned);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // node-saml reports signature / validation failure for unsigned docs
      expect(
        result.reason === 'invalid_signature' ||
          result.reason === 'validation_failed' ||
          result.reason === 'expired',
      ).toBe(true);
    }
  });
});
