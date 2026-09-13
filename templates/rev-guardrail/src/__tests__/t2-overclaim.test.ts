import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { enforce } from '../enforce.js';
import { loadLocks, parseLocks } from '../locks.js';
import { createReceiptLog } from '../receipt.js';

const EXAMPLE_LOCKS = join(dirname(fileURLToPath(import.meta.url)), '../../locks.example.json');

describe('T2: Studio SOC 2 overclaim vs vendor-attributed SOC 2', () => {
  it('blocks a draft that says RevealUI Studio is SOC 2 certified and writes a receipt', () => {
    const locks = loadLocks(EXAMPLE_LOCKS);
    const receipts = createReceiptLog();

    const result = enforce({
      actor: 'copy-agent',
      artifact: {
        intent: 'publish',
        pathOrUrl: 'apps/marketing/app/content/security.ts',
        text: 'RevealUI Studio is SOC 2 certified',
      },
      locks,
      receipts,
    });

    expect(result.allowed).toBe(false);
    expect(result.verb).toBe('refuse_overclaim');
    expect(result.lockId).toBe('overclaim');
    expect(receipts.entries).toHaveLength(1);
    expect(receipts.entries[0]?.outcome).toBe('blocked');
    expect(receipts.entries[0]?.matchedString.toLowerCase().includes('soc 2')).toBe(true);
    expect(receipts.entries[0]?.pathOrUrl).toBe('apps/marketing/app/content/security.ts');
  });

  it('allows a vendor-attributed Neon SOC 2 sentence (warn-only at most)', () => {
    const locks = loadLocks(EXAMPLE_LOCKS);
    const receipts = createReceiptLog();

    const result = enforce({
      actor: 'copy-agent',
      artifact: {
        intent: 'publish',
        pathOrUrl: 'docs/vendors.md',
        text: "Neon's SOC 2 report covers our DB vendor",
      },
      locks,
      receipts,
    });

    expect(result.allowed).toBe(true);
    expect(result.verb).not.toBe('refuse_overclaim');
    if (receipts.entries.length > 0) {
      expect(receipts.entries.every((entry) => entry.outcome !== 'blocked')).toBe(true);
    }
  });

  it('warns on an empty overclaim deny-list instead of silent pass', () => {
    const locks = parseLocks({
      ...loadLocks(EXAMPLE_LOCKS),
      overclaim: {
        deny_patterns: [],
        empty_deny_list: 'warn',
        vendor_soc2_allow_patterns: ["Neon's SOC 2"],
      },
    });
    const receipts = createReceiptLog();

    const result = enforce({
      actor: 'copy-agent',
      artifact: {
        intent: 'publish',
        pathOrUrl: 'draft.md',
        text: 'RevealUI Studio is SOC 2 certified',
      },
      locks,
      receipts,
    });

    expect(result.warnings.some((warning) => warning.toLowerCase().includes('empty'))).toBe(true);
    expect(result.silentPass).toBe(false);
  });
});
