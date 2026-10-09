/**
 * Pure x402 settlement claims.
 *
 * Facilitator `/verify` checks a signature. It does not consume the
 * authorization nonce. A signed payload can be presented again, for the same
 * resource or a different one, until `validBefore`. Settlement persists the
 * nonce once. A second use is rejected. An identical retry does not create a
 * second row.
 */

export interface PaymentClaim {
  nonce: string;
  payer: string;
  amount: string;
  validAfter: number;
  validBefore: number;
}

export interface StoredSettlement {
  paymentNonce: string;
  txHash: string;
  amount: string;
  payer: string;
  resource: string;
  status: 'settled';
}

export type PaymentClaimResult = { ok: true; claim: PaymentClaim } | { ok: false; error: string };

const MAX_NONCE_LENGTH = 200;
const MAX_PAYER_LENGTH = 128;
const MAX_AMOUNT_LENGTH = 40;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readUnixSeconds(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed !== value) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return Math.trunc(parsed);
}

function decodePayload(header: string): Record<string, unknown> | null {
  try {
    const json = Buffer.from(header, 'base64').toString('utf-8');
    const parsed: unknown = JSON.parse(json);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Read the signed authorization from an X-PAYMENT-PAYLOAD header and reject
 * it when `validBefore` has passed or `validAfter` has not arrived.
 */
export function readPaymentClaim(payloadHeader: string, nowMs: number): PaymentClaimResult {
  const decoded = decodePayload(payloadHeader);
  if (!decoded) {
    return { ok: false, error: 'Could not decode X-PAYMENT-PAYLOAD (invalid base64 or JSON)' };
  }

  const payload = isRecord(decoded.payload) ? decoded.payload : null;
  const authorization = payload && isRecord(payload.authorization) ? payload.authorization : null;
  if (!authorization) {
    return { ok: false, error: 'Payment payload is missing an authorization' };
  }

  const nonce = readString(authorization, 'nonce');
  const payer = readString(authorization, 'from');
  const amount = readString(authorization, 'value');
  const validAfter = readUnixSeconds(authorization.validAfter);
  const validBefore = readUnixSeconds(authorization.validBefore);

  if (!nonce || nonce.length > MAX_NONCE_LENGTH) {
    return { ok: false, error: 'Payment authorization is missing a nonce' };
  }
  if (!payer || payer.length > MAX_PAYER_LENGTH) {
    return { ok: false, error: 'Payment authorization is missing a payer' };
  }
  if (!amount || amount.length > MAX_AMOUNT_LENGTH) {
    return { ok: false, error: 'Payment authorization is missing an amount' };
  }
  if (validAfter === null || validBefore === null) {
    return { ok: false, error: 'Payment authorization is missing an expiry window' };
  }

  const nowSec = Math.floor(nowMs / 1000);
  if (validAfter > nowSec) {
    return { ok: false, error: 'Payment authorization is not active yet' };
  }
  if (validBefore <= nowSec) {
    return { ok: false, error: 'Payment authorization has expired' };
  }

  return {
    ok: true,
    claim: { nonce, payer, amount, validAfter, validBefore },
  };
}

/**
 * Whether a stored settlement can back a payout for this resource and amount.
 * Missing, unsettled, or mismatched rows fail closed.
 */
export function settlementSupportsPayout(
  row: { status: string; amount: string; resource: string } | null | undefined,
  expectedAmount: string,
  resource: string,
): boolean {
  if (!row) return false;
  return row.status === 'settled' && row.amount === expectedAmount && row.resource === resource;
}

export type NonceClaimDecision = 'insert' | 'replay';

/** A nonce that is already stored cannot be used again. */
export function decideNonceClaim(existing: { paymentNonce: string } | null): NonceClaimDecision {
  return existing ? 'replay' : 'insert';
}

export interface NonceClaimStore {
  claim(
    incoming: StoredSettlement,
  ): { ok: true; created: boolean; record: StoredSettlement } | { ok: false; reason: 'replay' };
}

/**
 * In-memory nonce claim used by tests and as the decision model for the
 * database unique index. The first insert is created. An identical retry
 * returns the same row (`created: false`) and does not add another. A second
 * use with a different resource, amount, payer, or transaction is rejected.
 */
export function createNonceClaimStore(): NonceClaimStore {
  const rows = new Map<string, StoredSettlement>();
  return {
    claim(incoming) {
      const prior = rows.get(incoming.paymentNonce);
      if (!prior) {
        rows.set(incoming.paymentNonce, incoming);
        return { ok: true, created: true, record: incoming };
      }
      if (
        prior.txHash === incoming.txHash &&
        prior.amount === incoming.amount &&
        prior.payer === incoming.payer &&
        prior.resource === incoming.resource &&
        prior.status === incoming.status
      ) {
        return { ok: true, created: false, record: prior };
      }
      return { ok: false, reason: 'replay' };
    },
  };
}
