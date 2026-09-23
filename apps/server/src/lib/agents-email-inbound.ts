/**
 * GAP-146 — flagged stub for inbound mail at agents@revealui.com.
 *
 * Does not send mail, create a mailbox, or touch DNS. Gmail stays the human
 * and transactional sender (`email.ts` / `@revealui/services/email`). This
 * module never imports that sender.
 *
 * `AGENTS_EMAIL_INBOUND` is off unless the value is the exact string `true`.
 * Flag off is a documented rejection (`flag-off`): no event, and nothing is
 * enqueued. A To recipient other than agents@revealui.com is ignored.
 */

/** Only address this receiver accepts. */
export const AGENTS_INBOUND_ADDRESS = 'agents@revealui.com';

/** Env flag. Exact `true` enables; unset and every other value stay off. */
export const AGENTS_EMAIL_INBOUND_FLAG = 'AGENTS_EMAIL_INBOUND';

export interface AgentInboundEvent {
  from: string;
  to: string;
  subject: string;
}

/** Why the receiver produced no event and did not enqueue. */
export type AgentsInboundRejection = 'flag-off' | 'wrong-recipient' | 'missing-headers';

export interface AgentsInboundDecision {
  event: AgentInboundEvent | null;
  rejection: AgentsInboundRejection | null;
}

export interface AgentsEmailInboundEnv {
  AGENTS_EMAIL_INBOUND?: string;
}

export function isAgentsEmailInboundEnabled(env: AgentsEmailInboundEnv = process.env): boolean {
  return env.AGENTS_EMAIL_INBOUND === 'true';
}

/**
 * Parse one RFC822/MIME message. An event is produced only when the flag is
 * on and To includes agents@revealui.com. Otherwise null — no enqueue, no send.
 */
export function receiveAgentsInbound(
  rawMessage: string,
  env: AgentsEmailInboundEnv = process.env,
): AgentInboundEvent | null {
  return decideAgentsInbound(rawMessage, env).event;
}

/** Same decision as `receiveAgentsInbound`, including the rejection reason. */
export function decideAgentsInbound(
  rawMessage: string,
  env: AgentsEmailInboundEnv = process.env,
): AgentsInboundDecision {
  if (!isAgentsEmailInboundEnabled(env)) {
    return { event: null, rejection: 'flag-off' };
  }

  const headers = parseHeaders(rawMessage);
  const recipients = extractAddresses(headers.get('to') ?? '');
  const matched = recipients.find((addr) => addr.toLowerCase() === AGENTS_INBOUND_ADDRESS);
  if (matched === undefined) {
    return { event: null, rejection: 'wrong-recipient' };
  }

  const from = extractAddresses(headers.get('from') ?? '')[0];
  const subject = headers.get('subject')?.trim() ?? '';
  if (from === undefined || subject.length === 0) {
    return { event: null, rejection: 'missing-headers' };
  }

  return {
    event: {
      from,
      to: AGENTS_INBOUND_ADDRESS,
      subject,
    },
    rejection: null,
  };
}

function toLines(input: string): string[] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  return text.split('\n').map((line) => (line.endsWith('\r') ? line.slice(0, -1) : line));
}

/** Header block only. Folded lines join with a single space. Body is ignored. */
function parseHeaders(raw: string): Map<string, string> {
  const unfolded: string[] = [];
  for (const line of toLines(raw)) {
    if (line.length === 0) {
      break;
    }
    const previous = unfolded.at(-1);
    if ((line.startsWith(' ') || line.startsWith('\t')) && previous !== undefined) {
      unfolded[unfolded.length - 1] = `${previous.trimEnd()} ${line.trim()}`;
      continue;
    }
    unfolded.push(line);
  }

  const headers = new Map<string, string>();
  for (const line of unfolded) {
    const colon = line.indexOf(':');
    if (colon <= 0) {
      continue;
    }
    const name = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (!headers.has(name)) {
      headers.set(name, value);
    }
  }
  return headers;
}

function extractAddresses(value: string): string[] {
  const addresses: string[] = [];
  let angle: string | null = null;
  let bare = '';
  let inQuotes = false;

  const flushBare = (): void => {
    const token = lastAddrToken(bare);
    bare = '';
    if (token !== null) {
      addresses.push(token);
    }
  };

  for (const ch of value) {
    if (angle !== null) {
      if (ch === '>') {
        const token = angle.trim();
        angle = null;
        if (isAddrSpec(token)) {
          addresses.push(token);
        }
      } else {
        angle += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && ch === '<') {
      flushBare();
      angle = '';
      continue;
    }
    if (!inQuotes && ch === ',') {
      flushBare();
      continue;
    }
    bare += ch;
  }
  if (angle === null) {
    flushBare();
  }
  return addresses;
}

function lastAddrToken(buffer: string): string | null {
  let token = '';
  let found: string | null = null;
  const flush = (): void => {
    const trimmed = token.trim();
    token = '';
    if (isAddrSpec(trimmed)) {
      found = trimmed;
    }
  };
  for (const ch of buffer) {
    if (ch === ' ' || ch === '\t' || ch === '(' || ch === ')') {
      flush();
      continue;
    }
    token += ch;
  }
  flush();
  return found;
}

function isAddrSpec(value: string): boolean {
  if (value.length === 0) {
    return false;
  }
  const at = value.indexOf('@');
  if (at <= 0 || value.lastIndexOf('@') !== at) {
    return false;
  }
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  if (!(isDotAtom(local) && isDotAtom(domain))) {
    return false;
  }
  return domain.includes('.');
}

function isDotAtom(value: string): boolean {
  if (value.length === 0 || value.startsWith('.') || value.endsWith('.')) {
    return false;
  }
  let prevDot = false;
  for (const ch of value) {
    if (ch === '.') {
      if (prevDot) {
        return false;
      }
      prevDot = true;
      continue;
    }
    prevDot = false;
    if (!isAtomChar(ch)) {
      return false;
    }
  }
  return true;
}

function isAtomChar(ch: string): boolean {
  const code = ch.codePointAt(0);
  if (code === undefined) {
    return false;
  }
  if (code >= 48 && code <= 57) {
    return true;
  }
  if (code >= 65 && code <= 90) {
    return true;
  }
  if (code >= 97 && code <= 122) {
    return true;
  }
  return ch === '_' || ch === '+' || ch === '-' || ch === '%';
}
