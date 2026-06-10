import { describe, expect, it } from 'vitest';
import { awsUriEncode, computeSigV4, EMPTY_SHA256, signS3Request } from '../_sigv4.js';

describe('computeSigV4', () => {
  // AWS SigV4 test-suite, `get-vanilla` — the canonical known-answer vector.
  // https://docs.aws.amazon.com/general/latest/gr/signature-v4-test-suite.html
  it('matches the published AWS get-vanilla signature', () => {
    const result = computeSigV4({
      method: 'GET',
      canonicalPath: '/',
      query: [],
      headersToSign: { Host: 'example.amazonaws.com', 'X-Amz-Date': '20150830T123600Z' },
      payloadHash: EMPTY_SHA256,
      amzDate: '20150830T123600Z',
      region: 'us-east-1',
      service: 'service',
      accessKeyId: 'AKIDEXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
    });
    expect(result.signature).toBe(
      '5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31',
    );
    expect(result.signedHeaders).toBe('host;x-amz-date');
  });
});

describe('awsUriEncode', () => {
  it('preserves slashes in paths and encodes spaces + reserved chars', () => {
    expect(awsUriEncode('media/a b.jpg', false)).toBe('media/a%20b.jpg');
    expect(awsUriEncode('uploads/(x)+y&z', false)).toBe('uploads/%28x%29%2By%26z');
  });

  it('leaves unreserved chars (~) untouched', () => {
    expect(awsUriEncode('tilde~ok.txt', false)).toBe('tilde~ok.txt');
  });

  it('encodes slashes when encodeSlash=true (query values)', () => {
    expect(awsUriEncode('media/x', true)).toBe('media%2Fx');
  });
});

describe('signS3Request', () => {
  const creds = {
    accountId: 'acct-123',
    accessKeyId: 'AKIA-TEST',
    secretAccessKey: 'secret',
    region: 'auto',
  } as const;

  it('builds a path-style R2 URL with an auto/s3-scoped AWS4 Authorization', () => {
    const { url, headers } = signS3Request({
      method: 'PUT',
      bucket: 'media',
      key: 'uploads/a.bin',
      payloadHash: EMPTY_SHA256,
      now: new Date('2026-05-18T10:00:00.000Z'),
      ...creds,
    });
    expect(url).toBe('https://acct-123.r2.cloudflarestorage.com/media/uploads/a.bin');
    expect(headers.authorization).toContain(
      'AWS4-HMAC-SHA256 Credential=AKIA-TEST/20260518/auto/s3/aws4_request',
    );
    expect(headers['x-amz-date']).toBe('20260518T100000Z');
    expect(headers['x-amz-content-sha256']).toBe(EMPTY_SHA256);
  });

  it('sorts query params and drops undefined values', () => {
    const { url } = signS3Request({
      method: 'GET',
      bucket: 'media',
      query: {
        'list-type': '2',
        prefix: 'media/',
        'max-keys': '2',
        'continuation-token': undefined,
      },
      payloadHash: EMPTY_SHA256,
      now: new Date('2026-05-18T10:00:00.000Z'),
      ...creds,
    });
    expect(url).toBe(
      'https://acct-123.r2.cloudflarestorage.com/media?list-type=2&max-keys=2&prefix=media%2F',
    );
  });
});
