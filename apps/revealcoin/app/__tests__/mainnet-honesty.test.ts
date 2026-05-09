/**
 * Mainnet honesty invariants for the revealcoin dashboard.
 *
 * The audit at ~/revfleet/.jv/docs/audits/2026-05-08-charge-readiness-deep-audit.md
 * §5 Phase 0 Item 0.1 + 0.2 calls out: the dashboard previously claimed
 * "Deployed on Solana Mainnet" while `RVUI_MINT_ADDRESSES['mainnet-beta'] = ""`,
 * which made `MINT_ADDRESS` an empty string, `truncateAddress(MINT_ADDRESS)`
 * render `'...'`, and the explorer link a broken redirect to the explorer
 * homepage. Securities-law-adjacent.
 *
 * These tests lock in the invariants that prevent that drift:
 *   1. ACTIVE_NETWORK reflects the real state of the manifest.
 *   2. MINT_ADDRESS is never empty (devnet fallback when mainnet is undeployed).
 *   3. EXPLORER_URL points at the correct cluster.
 *   4. NETWORK_LABEL surfaces "Devnet preview" copy until mainnet ships.
 *
 * If a future change re-introduces the bug (e.g. someone hardcodes
 * MINT_ADDRESS = RVUI_MINT_ADDRESSES['mainnet-beta'] without the fallback),
 * these tests will fail at `pnpm test` time before the build ships.
 */

import { RVUI_MINT_ADDRESSES } from '@revealui/contracts';
import { describe, expect, it } from 'vitest';
import {
  ACTIVE_NETWORK,
  EXPLORER_URL,
  MAINNET_DEPLOY_DATE,
  MINT_ADDRESS,
  NETWORK_LABEL,
  SOLSCAN_URL,
  truncateAddress,
} from '../lib/constants';

describe('revealcoin dashboard mainnet honesty invariants', () => {
  const mainnetEntry = RVUI_MINT_ADDRESSES['mainnet-beta'];
  const devnetEntry = RVUI_MINT_ADDRESSES.devnet;
  const mainnetIsDeployed = mainnetEntry.length > 0;

  it('MINT_ADDRESS is never empty', () => {
    // The original bug: MINT_ADDRESS = RVUI_MINT_ADDRESSES['mainnet-beta'] = "".
    // Result: truncateAddress("") = "...." and EXPLORER_URL = ".../address/" (broken).
    expect(MINT_ADDRESS).not.toBe('');
    expect(MINT_ADDRESS.length).toBeGreaterThan(20);
  });

  it('truncateAddress(MINT_ADDRESS) does not render placeholder dots only', () => {
    const truncated = truncateAddress(MINT_ADDRESS, 6);
    // Pre-fix value would have been "......" — the bug we're preventing.
    expect(truncated).not.toBe('......');
    expect(truncated).not.toBe('...');
    expect(truncated).toMatch(/^.{6}\.{3}.{6}$/);
  });

  it('EXPLORER_URL points at a real address (no trailing-slash bug)', () => {
    // Pre-fix value: "https://explorer.solana.com/address/" (no address)
    expect(EXPLORER_URL).not.toMatch(/\/address\/(\?|$)/);
    expect(EXPLORER_URL).toContain(MINT_ADDRESS);
  });

  describe('when mainnet manifest entry is EMPTY (current state, until deploy)', () => {
    it('ACTIVE_NETWORK falls back to devnet', () => {
      if (mainnetIsDeployed) return;
      expect(ACTIVE_NETWORK).toBe('devnet');
    });

    it('MINT_ADDRESS resolves to the devnet mint', () => {
      if (mainnetIsDeployed) return;
      expect(MINT_ADDRESS).toBe(devnetEntry);
    });

    it('NETWORK_LABEL clearly signals non-mainnet status', () => {
      if (mainnetIsDeployed) return;
      // Must NOT just say "Mainnet"; must surface "Devnet" or "preview" so the UI
      // does not lie about deployment status. Securities-law-adjacent.
      expect(NETWORK_LABEL.toLowerCase()).not.toBe('mainnet');
      expect(NETWORK_LABEL.toLowerCase()).toMatch(/devnet|preview|testnet/);
    });

    it('EXPLORER_URL includes the devnet cluster query string', () => {
      if (mainnetIsDeployed) return;
      // Solana explorer requires ?cluster=devnet for non-mainnet addresses;
      // without it the page resolves but shows "address not found" on mainnet.
      expect(EXPLORER_URL).toContain('?cluster=devnet');
    });

    it('SOLSCAN_URL includes the devnet cluster query string', () => {
      if (mainnetIsDeployed) return;
      expect(SOLSCAN_URL).toContain('?cluster=devnet');
    });

    it('MAINNET_DEPLOY_DATE remains null until mainnet actually deploys', () => {
      if (mainnetIsDeployed) return;
      expect(MAINNET_DEPLOY_DATE).toBeNull();
    });
  });

  describe('when mainnet manifest entry is POPULATED (post-deploy)', () => {
    it('ACTIVE_NETWORK switches to mainnet-beta automatically', () => {
      if (!mainnetIsDeployed) return;
      expect(ACTIVE_NETWORK).toBe('mainnet-beta');
    });

    it('MINT_ADDRESS resolves to the mainnet mint', () => {
      if (!mainnetIsDeployed) return;
      expect(MINT_ADDRESS).toBe(mainnetEntry);
    });

    it('NETWORK_LABEL surfaces Mainnet', () => {
      if (!mainnetIsDeployed) return;
      expect(NETWORK_LABEL).toBe('Mainnet');
    });

    it('EXPLORER_URL omits the cluster query string (mainnet is the default)', () => {
      if (!mainnetIsDeployed) return;
      expect(EXPLORER_URL).not.toContain('?cluster=');
    });
  });
});
