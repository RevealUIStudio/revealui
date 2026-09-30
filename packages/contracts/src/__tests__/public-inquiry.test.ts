import { describe, expect, it } from 'vitest';
import { ContactInquirySchema } from '../public-inquiry.js';

const inquiry = {
  topic: 'general',
  name: 'Jo',
  email: 'jo@example.com',
  message: 'A question about setup.',
};
describe('public inquiry contract', () => {
  it('validates trimmed boundaries for both sources', () => {
    for (const source of ['marketing', 'agency']) {
      expect(ContactInquirySchema.safeParse({ ...inquiry, source }).success).toBe(true);
      expect(ContactInquirySchema.safeParse({ ...inquiry, source, name: ' J ' }).success).toBe(
        false,
      );
      expect(
        ContactInquirySchema.safeParse({ ...inquiry, source, message: ' '.repeat(20) }).success,
      ).toBe(false);
      expect(
        ContactInquirySchema.safeParse({ ...inquiry, source, message: 'x'.repeat(19) }).success,
      ).toBe(false);
      expect(
        ContactInquirySchema.safeParse({ ...inquiry, source, message: 'x'.repeat(20) }).success,
      ).toBe(true);
    }
    expect(ContactInquirySchema.safeParse({ ...inquiry, source: 'marketing-site' }).success).toBe(
      false,
    );
  });
  it('caps inputs and lets the delivery endpoint discard a filled honeypot', () => {
    expect(ContactInquirySchema.safeParse({ ...inquiry, name: 'x'.repeat(121) }).success).toBe(
      false,
    );
    expect(ContactInquirySchema.safeParse({ ...inquiry, message: 'x'.repeat(5001) }).success).toBe(
      false,
    );
    expect(
      ContactInquirySchema.safeParse({ ...inquiry, website: 'https://spam.example' }).success,
    ).toBe(true);
  });
});
