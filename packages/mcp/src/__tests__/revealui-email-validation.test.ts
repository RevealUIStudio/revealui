/**
 * Tests for runtime Zod validation in the revealui-email MCP server.
 *
 * Coverage targets:
 *   - email_send: string and array recipient; missing required; body-less pass-through.
 *   - email_send_batch: valid batch; batch over 100; missing required item fields.
 */

import { describe, expect, it } from 'vitest';
import { EmailSendArgsSchema, EmailSendBatchArgsSchema } from '../servers/revealui-email.js';
import { validateToolArgs } from '../validate-tool-args.js';

describe('email_send args', () => {
  it('accepts string recipient', () => {
    const r = validateToolArgs(
      EmailSendArgsSchema,
      { to: 'user@example.com', subject: 'Hello' },
      'email_send',
    );
    expect(r.ok).toBe(true);
  });

  it('accepts array of recipients', () => {
    const r = validateToolArgs(
      EmailSendArgsSchema,
      { to: ['a@example.com', 'b@example.com'], subject: 'Batch hello' },
      'email_send',
    );
    expect(r.ok).toBe(true);
  });

  it('accepts all optional fields', () => {
    const r = validateToolArgs(
      EmailSendArgsSchema,
      {
        to: 'user@example.com',
        subject: 'Hi',
        html: '<p>Hello</p>',
        text: 'Hello',
        from: 'noreply@revealui.com',
        reply_to: 'support@revealui.com',
      },
      'email_send',
    );
    expect(r.ok).toBe(true);
  });

  it('rejects missing to', () => {
    const r = validateToolArgs(EmailSendArgsSchema, { subject: 'No recipient' }, 'email_send');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.content[0].text).toContain('email_send');
  });

  it('rejects missing subject', () => {
    const r = validateToolArgs(EmailSendArgsSchema, { to: 'user@example.com' }, 'email_send');
    expect(r.ok).toBe(false);
  });

  it('rejects non-string non-array to', () => {
    const r = validateToolArgs(
      EmailSendArgsSchema,
      { to: 42, subject: 'Bad to field' },
      'email_send',
    );
    expect(r.ok).toBe(false);
  });

  it('rejects unknown field', () => {
    const r = validateToolArgs(
      EmailSendArgsSchema,
      { to: 'user@example.com', subject: 'Hi', priority: 'high' },
      'email_send',
    );
    expect(r.ok).toBe(false);
  });
});

describe('email_send_batch args', () => {
  it('accepts valid batch of one', () => {
    const r = validateToolArgs(
      EmailSendBatchArgsSchema,
      { emails: [{ to: 'a@b.com', subject: 'Test' }] },
      'email_send_batch',
    );
    expect(r.ok).toBe(true);
  });

  it('accepts batch with optional fields on items', () => {
    const r = validateToolArgs(
      EmailSendBatchArgsSchema,
      {
        emails: [
          { to: 'a@b.com', subject: 'S1', html: '<p>Hi</p>', text: 'Hi' },
          { to: 'b@b.com', subject: 'S2', from: 'no-reply@foo.com' },
        ],
      },
      'email_send_batch',
    );
    expect(r.ok).toBe(true);
  });

  it('rejects batch over 100 items', () => {
    const emails = Array.from({ length: 101 }, (_, i) => ({
      to: `user${i}@example.com`,
      subject: `msg ${i}`,
    }));
    const r = validateToolArgs(EmailSendBatchArgsSchema, { emails }, 'email_send_batch');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.content[0].text).toContain('email_send_batch');
  });

  it('rejects item missing to', () => {
    const r = validateToolArgs(
      EmailSendBatchArgsSchema,
      { emails: [{ subject: 'No recipient' }] },
      'email_send_batch',
    );
    expect(r.ok).toBe(false);
  });

  it('rejects item missing subject', () => {
    const r = validateToolArgs(
      EmailSendBatchArgsSchema,
      { emails: [{ to: 'a@b.com' }] },
      'email_send_batch',
    );
    expect(r.ok).toBe(false);
  });

  it('rejects missing emails array', () => {
    const r = validateToolArgs(EmailSendBatchArgsSchema, {}, 'email_send_batch');
    expect(r.ok).toBe(false);
  });

  it('rejects item unknown field', () => {
    const r = validateToolArgs(
      EmailSendBatchArgsSchema,
      { emails: [{ to: 'a@b.com', subject: 'Hi', priority: 'urgent' }] },
      'email_send_batch',
    );
    expect(r.ok).toBe(false);
  });
});
