/**
 * React hook for querying RVUI token balance from Solana RPC.
 *
 * Reads the wallet address + network from StudioSettings (localStorage).
 * Queries the Token-2022 Associated Token Account for the RVUI mint.
 * Polls every 60 seconds. Returns zero gracefully if ATA doesn't exist.
 */

import { RVUI_MINT_ADDRESSES, RVUI_TOKEN_CONFIG } from '@revealui/contracts';
import { address, createSolanaRpc } from '@solana/kit';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSettingsContext } from './use-settings';

const POLL_INTERVAL_MS = 60_000;

const CLUSTER_URLS: Record<string, string> = {
  devnet: 'https://api.devnet.solana.com',
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
};

export interface RvuiBalanceState {
  /** Human-readable balance (e.g., "1,234.56 RVUI"). Null if not configured. */
  balance: string | null;
  /** Raw numeric balance for calculations. */
  uiAmount: number;
  /** Whether a query is in flight. */
  loading: boolean;
  /** Error message if the last query failed. */
  error: string | null;
  /** Whether a wallet address is configured. */
  configured: boolean;
  /** Trigger an immediate refresh. */
  refresh: () => void;
}

export function useRvuiBalance(): RvuiBalanceState {
  const { settings } = useSettingsContext();
  const [balance, setBalance] = useState<string | null>(null);
  const [uiAmount, setUiAmount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const walletAddress = settings.solanaWalletAddress;
  const network = settings.solanaNetwork;
  const configured = walletAddress.length > 0;

  const fetchBalance = useCallback(async () => {
    if (!walletAddress) return;

    const mintAddress = RVUI_MINT_ADDRESSES[network];
    if (!mintAddress) {
      setError(`RVUI not deployed on ${network}`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const rpcUrl = CLUSTER_URLS[network] ?? CLUSTER_URLS.devnet;
      const rpc = createSolanaRpc(rpcUrl);
      const wallet = address(walletAddress);
      const mint = address(mintAddress);

      const response = await rpc
        .getTokenAccountsByOwner(
          wallet,
          { mint },
          { encoding: 'jsonParsed', commitment: 'confirmed' },
        )
        .send();

      if (!mountedRef.current) return;

      if (response.value.length === 0) {
        setBalance('0');
        setUiAmount(0);
      } else {
        const accountData = response.value[0].account.data as {
          parsed: { info: { tokenAmount: { amount: string } } };
        };
        const raw = BigInt(accountData.parsed.info.tokenAmount.amount);
        const divisor = 10 ** RVUI_TOKEN_CONFIG.decimals;
        const amount = Number(raw) / divisor;

        setUiAmount(amount);
        setBalance(
          amount.toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
          }),
        );
      }
    } catch (err) {
      if (!mountedRef.current) return;
      const msg = err instanceof Error ? err.message : 'Failed to fetch RVUI balance';
      setError(msg);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [walletAddress, network]);

  // Initial fetch + polling
  useEffect(() => {
    mountedRef.current = true;

    if (!configured) {
      setBalance(null);
      setUiAmount(0);
      setError(null);
      return;
    }

    void fetchBalance();

    intervalRef.current = setInterval(() => {
      void fetchBalance();
    }, POLL_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [configured, fetchBalance]);

  const refresh = useCallback(() => {
    void fetchBalance();
  }, [fetchBalance]);

  return { balance, uiAmount, loading, error, configured, refresh };
}
