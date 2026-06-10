import { describe, expect, it } from 'vitest';
import { parseListObjectsV2, s3ErrorFields } from '../_xml.js';

const LIST_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult>
  <Name>media</Name>
  <Prefix>media/</Prefix>
  <IsTruncated>true</IsTruncated>
  <NextContinuationToken>next-cursor</NextContinuationToken>
  <Contents><Key>media/a.jpg</Key><LastModified>2026-05-18T10:00:00.000Z</LastModified><Size>1024</Size></Contents>
  <Contents><Key>media/b.jpg</Key><LastModified>2026-05-18T11:00:00.000Z</LastModified><Size>2048</Size></Contents>
</ListBucketResult>`;

describe('parseListObjectsV2', () => {
  it('maps objects + truncation flag + continuation token', () => {
    const result = parseListObjectsV2(LIST_XML);
    expect(result.isTruncated).toBe(true);
    expect(result.nextContinuationToken).toBe('next-cursor');
    expect(result.objects).toEqual([
      { key: 'media/a.jpg', size: 1024, lastModified: new Date('2026-05-18T10:00:00.000Z') },
      { key: 'media/b.jpg', size: 2048, lastModified: new Date('2026-05-18T11:00:00.000Z') },
    ]);
  });

  it('handles an empty result', () => {
    const result = parseListObjectsV2(
      '<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>',
    );
    expect(result.objects).toEqual([]);
    expect(result.isTruncated).toBe(false);
    expect(result.nextContinuationToken).toBeUndefined();
  });

  it('defaults a missing Size to 0 and a missing LastModified to the epoch', () => {
    const result = parseListObjectsV2(
      '<ListBucketResult><IsTruncated>false</IsTruncated><Contents><Key>a</Key></Contents></ListBucketResult>',
    );
    expect(result.objects[0]).toEqual({ key: 'a', size: 0, lastModified: new Date(0) });
  });

  it('omits Contents rows without a Key', () => {
    const result = parseListObjectsV2(
      '<ListBucketResult><IsTruncated>false</IsTruncated><Contents><Size>5</Size></Contents></ListBucketResult>',
    );
    expect(result.objects).toEqual([]);
  });

  it('decodes XML entities in keys', () => {
    const result = parseListObjectsV2(
      '<ListBucketResult><IsTruncated>false</IsTruncated><Contents><Key>a&amp;b/c.jpg</Key><Size>1</Size></Contents></ListBucketResult>',
    );
    expect(result.objects[0].key).toBe('a&b/c.jpg');
  });
});

describe('s3ErrorFields', () => {
  it('extracts Code + Message from an Error body', () => {
    const { code, message } = s3ErrorFields(
      '<Error><Code>NoSuchKey</Code><Message>The key does not exist.</Message></Error>',
    );
    expect(code).toBe('NoSuchKey');
    expect(message).toBe('The key does not exist.');
  });

  it('returns undefined fields for a non-error body', () => {
    expect(s3ErrorFields('<ok/>')).toEqual({ code: undefined, message: undefined });
  });
});
