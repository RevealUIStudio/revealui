import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { REV_GUARDRAIL_AGENT_SPEC } from '../agent-spec.js';
import { enforce } from '../enforce.js';
import { loadLocks, parseLocks } from '../locks.js';
import { createReceiptLog, hashArtifact } from '../receipt.js';
import type { EnforcementVerb, GuardrailReceipt } from '../types.js';

const EXAMPLE_LOCKS = join(dirname(fileURLToPath(import.meta.url)), '../../locks.example.json');

describe('required lock enforcement cannot disappear from the verb allowlist', () => {
  it.each<EnforcementVerb>(['require_snapshot', 'refuse_overclaim', 'needs_human'])(
    'rejects configured enforcement without %s',
    (missing) => {
      const locks = loadLocks(EXAMPLE_LOCKS);
      locks.banned_icp_phrases.mode = 'enforced';
      locks.enforcement_verbs = locks.enforcement_verbs.filter((verb) => verb !== missing);
      expect(() => parseLocks(locks)).toThrow();
    },
  );

  it('rejects a mutated runtime policy before returning permission', () => {
    const locks = loadLocks(EXAMPLE_LOCKS);
    locks.enforcement_verbs = ['block_publish'];
    expect(() =>
      enforce({
        actor: 'writer',
        artifact: {
          intent: 'checkpoint',
          hasSnapshot: false,
          pathOrUrl: 'draft.md',
          text: 'RevealUI Studio is SOC 2 certified',
        },
        locks,
        receipts: createReceiptLog(),
      }),
    ).toThrow();
  });

  it('permits omitted verbs only when their lock is inactive', () => {
    const locks = loadLocks(EXAMPLE_LOCKS);
    locks.snapshot_before_checkpoint = 'optional';
    locks.overclaim.deny_patterns = [];
    locks.banned_icp_phrases.mode = 'optional';
    locks.enforcement_verbs = ['block_publish'];
    expect(() => parseLocks(locks)).not.toThrow();
  });
});

describe('receipt storage remains append-only through its read surface', () => {
  it('prevents deletion, insertion and replacement through exposed entries', () => {
    const log = createReceiptLog();
    const receipt: GuardrailReceipt = {
      actor: 'writer',
      contentHash: hashArtifact('artifact'),
      lockId: 'overclaim',
      matchedString: 'SOC 2 certified',
      outcome: 'blocked',
      pathOrUrl: 'draft.md',
      timestamp: '2026-09-29T00:00:00.000Z',
    };
    log.append(receipt);
    const exposed = log.entries as GuardrailReceipt[];
    expect(() => exposed.splice(0, 1)).toThrow();
    expect(() => exposed.push(receipt)).toThrow();
    expect(() => {
      exposed[0] = { ...receipt, outcome: 'override' };
    }).toThrow();
    log.append({ ...receipt, actor: 'second' });
    expect(exposed).toHaveLength(1);
    expect(log.entries).toHaveLength(2);
    expect(log.entries[0]?.outcome).toBe('blocked');
  });
});

describe('public agent descriptors reflect implemented controls', () => {
  it('keeps JSON and TypeScript descriptions aligned', () => {
    const agent = JSON.parse(readFileSync(join(dirname(EXAMPLE_LOCKS), 'agent.json'), 'utf8'));
    expect(agent.description).toBe(REV_GUARDRAIL_AGENT_SPEC.description);
    expect(agent.description).toContain('not evaluated controls');
  });
});
