/**
 * Minimal mock SAML IdP for GAP-464 integration tests.
 * Self-signed X509 + xml-crypto enveloped signatures on Response + Assertion.
 */

import { randomBytes } from 'node:crypto';
import selfsigned from 'selfsigned';
import { SignedXml } from 'xml-crypto';

export interface MockSamlIdp {
  entityId: string;
  ssoUrl: string;
  certPem: string;
  privateKeyPem: string;
  /** Build IdP metadata XML consumed by parseIdpMetadataXml */
  metadataXml: string;
  /**
   * Build a base64 SAMLResponse (HTTP-POST) signed by this IdP.
   * When sign is false, returns an unsigned Response for reject tests.
   */
  buildPostResponse: (input: {
    spEntityId: string;
    acsUrl: string;
    nameId: string;
    groups?: string[];
    sign?: boolean;
    notOnOrAfterOffsetMs?: number;
  }) => string;
}

function stripPemHeaders(pem: string): string {
  const lines = pem.split('\n');
  const body: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('-----')) continue;
    body.push(t);
  }
  return body.join('');
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function createMockSamlIdp(options?: { entityId?: string }): MockSamlIdp {
  const entityId = options?.entityId ?? 'https://saml-idp.example.com';
  const ssoUrl = `${entityId}/sso`;

  const attrs = [{ name: 'commonName', value: 'mock-saml-idp' }];
  const pems = selfsigned.generate(attrs, {
    keySize: 2048,
    days: 1,
    algorithm: 'sha256',
  });

  const idpPrivateKeyPem = pems.private;
  const certPem = pems.cert;
  const certBody = stripPemHeaders(certPem);

  const metadataXml = `<?xml version="1.0"?>
<EntityDescriptor entityID="${escapeXml(entityId)}" xmlns="urn:oasis:names:tc:SAML:2.0:metadata">
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
      Location="${escapeXml(ssoUrl)}" />
  </IDPSSODescriptor>
</EntityDescriptor>`;

  function buildUnsignedAssertion(input: {
    spEntityId: string;
    acsUrl: string;
    nameId: string;
    groups: string[];
    issueInstant: string;
    notOnOrAfter: string;
    assertionId: string;
  }): string {
    const groupAttrs = input.groups
      .map(
        (g) =>
          `<saml:AttributeValue xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="xs:string">${escapeXml(g)}</saml:AttributeValue>`,
      )
      .join('');

    return `<saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" Version="2.0" ID="${input.assertionId}" IssueInstant="${input.issueInstant}">
  <saml:Issuer>${escapeXml(entityId)}</saml:Issuer>
  <saml:Subject>
    <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">${escapeXml(input.nameId)}</saml:NameID>
    <saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">
      <saml:SubjectConfirmationData NotOnOrAfter="${input.notOnOrAfter}" Recipient="${escapeXml(input.acsUrl)}" />
    </saml:SubjectConfirmation>
  </saml:Subject>
  <saml:Conditions NotBefore="${input.issueInstant}" NotOnOrAfter="${input.notOnOrAfter}">
    <saml:AudienceRestriction>
      <saml:Audience>${escapeXml(input.spEntityId)}</saml:Audience>
    </saml:AudienceRestriction>
  </saml:Conditions>
  <saml:AuthnStatement AuthnInstant="${input.issueInstant}" SessionIndex="_session1">
    <saml:AuthnContext>
      <saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef>
    </saml:AuthnContext>
  </saml:AuthnStatement>
  <saml:AttributeStatement>
    <saml:Attribute Name="email">
      <saml:AttributeValue>${escapeXml(input.nameId)}</saml:AttributeValue>
    </saml:Attribute>
    <saml:Attribute Name="groups">${groupAttrs}</saml:Attribute>
  </saml:AttributeStatement>
</saml:Assertion>`;
  }

  function signXmlEnveloped(xml: string, idAttr: string): string {
    // Place Signature immediately after Issuer (valid for both Assertion and Response)
    const issuerPath =
      "/*[local-name()='Assertion' or local-name()='Response']/*[local-name()='Issuer']";
    const refPath = `//*[@ID='${idAttr}']`;
    const sig = new SignedXml({
      privateKey: idpPrivateKeyPem,
      publicCert: certPem,
    });
    sig.addReference({
      xpath: refPath,
      transforms: [
        'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
        'http://www.w3.org/2001/10/xml-exc-c14n#',
      ],
      digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
    });
    sig.signatureAlgorithm = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
    sig.canonicalizationAlgorithm = 'http://www.w3.org/2001/10/xml-exc-c14n#';
    sig.computeSignature(xml, {
      location: { reference: issuerPath, action: 'after' },
      prefix: 'ds',
    });
    return sig.getSignedXml();
  }

  function buildPostResponse(input: {
    spEntityId: string;
    acsUrl: string;
    nameId: string;
    groups?: string[];
    sign?: boolean;
    notOnOrAfterOffsetMs?: number;
  }): string {
    const shouldSign = input.sign !== false;
    const now = new Date();
    const issueInstant = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
    const notOnOrAfter = new Date(now.getTime() + (input.notOnOrAfterOffsetMs ?? 5 * 60 * 1000))
      .toISOString()
      .replace(/\.\d{3}Z$/, 'Z');
    const responseId = `_resp_${randomBytes(8).toString('hex')}`;
    const assertionId = `_assert_${randomBytes(8).toString('hex')}`;
    const groups = input.groups ?? ['Engineering'];

    let assertion = buildUnsignedAssertion({
      spEntityId: input.spEntityId,
      acsUrl: input.acsUrl,
      nameId: input.nameId,
      groups,
      issueInstant,
      notOnOrAfter,
      assertionId,
    });

    if (shouldSign) {
      assertion = signXmlEnveloped(assertion, assertionId);
    }

    let response = `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" Version="2.0" ID="${responseId}" IssueInstant="${issueInstant}" Destination="${escapeXml(input.acsUrl)}">
  <saml:Issuer>${escapeXml(entityId)}</saml:Issuer>
  <samlp:Status>
    <samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/>
  </samlp:Status>
  ${assertion}
</samlp:Response>`;

    if (shouldSign) {
      response = signXmlEnveloped(response, responseId);
    }

    return Buffer.from(response, 'utf8').toString('base64');
  }

  return {
    entityId,
    ssoUrl,
    certPem,
    privateKeyPem: idpPrivateKeyPem,
    metadataXml,
    buildPostResponse,
  };
}
