import { afterEach, describe, expect, it } from 'vitest';
import {
  AGENTS_INBOUND_ADDRESS,
  decideAgentsInbound,
  receiveAgentsInbound,
} from '../agents-email-inbound.js';

const AGENTS_FIXTURE = [
  'From: Ada Lovelace <ada@example.com>',
  `To: Agents <${AGENTS_INBOUND_ADDRESS}>`,
  'Subject: Status of',
  ' the inbound stub',
  'MIME-Version: 1.0',
  'Content-Type: text/plain; charset=utf-8',
  '',
  'From: sneaky@example.com',
  'To: other@example.com',
  'Subject: ignore the body',
  '',
].join('\r\n');

const OTHER_RECIPIENT_FIXTURE = [
  'From: Ada Lovelace <ada@example.com>',
  'To: Owner <owner@revealui.com>',
  'Subject: Not for the agent mailbox',
  'MIME-Version: 1.0',
  'Content-Type: text/plain; charset=utf-8',
  '',
  'Hello.',
  '',
].join('\n');

describe('receiveAgentsInbound', () => {
  const saved = process.env.AGENTS_EMAIL_INBOUND;

  afterEach(() => {
    if (saved === undefined) {
      delete process.env.AGENTS_EMAIL_INBOUND;
    } else {
      process.env.AGENTS_EMAIL_INBOUND = saved;
    }
  });

  it('flag off yields no event', () => {
    delete process.env.AGENTS_EMAIL_INBOUND;
    expect(receiveAgentsInbound(AGENTS_FIXTURE)).toBeNull();
    expect(decideAgentsInbound(AGENTS_FIXTURE).rejection).toBe('flag-off');

    expect(receiveAgentsInbound(AGENTS_FIXTURE, { AGENTS_EMAIL_INBOUND: 'false' })).toBeNull();
    expect(decideAgentsInbound(AGENTS_FIXTURE, { AGENTS_EMAIL_INBOUND: 'false' }).rejection).toBe(
      'flag-off',
    );
    expect(receiveAgentsInbound(AGENTS_FIXTURE, { AGENTS_EMAIL_INBOUND: '1' })).toBeNull();
    expect(receiveAgentsInbound(AGENTS_FIXTURE, {})).toBeNull();
  });

  it('flag on + agents@ parses a fixture', () => {
    const event = receiveAgentsInbound(AGENTS_FIXTURE, { AGENTS_EMAIL_INBOUND: 'true' });
    expect(event).toEqual({
      from: 'ada@example.com',
      to: AGENTS_INBOUND_ADDRESS,
      subject: 'Status of the inbound stub',
    });
    expect(decideAgentsInbound(AGENTS_FIXTURE, { AGENTS_EMAIL_INBOUND: 'true' }).rejection).toBe(
      null,
    );
  });

  it('other recipient ignored', () => {
    const decision = decideAgentsInbound(OTHER_RECIPIENT_FIXTURE, {
      AGENTS_EMAIL_INBOUND: 'true',
    });
    expect(decision.event).toBeNull();
    expect(decision.rejection).toBe('wrong-recipient');
    expect(
      receiveAgentsInbound(OTHER_RECIPIENT_FIXTURE, { AGENTS_EMAIL_INBOUND: 'true' }),
    ).toBeNull();
  });
});
