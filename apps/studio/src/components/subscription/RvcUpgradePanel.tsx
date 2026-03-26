/**
 * RVC payment option for Pro/Max subscription upgrades.
 *
 * Shows the 15% discount when paying with RevealCoin,
 * collects a transaction signature, and submits for verification.
 */

import { RVC_DISCOUNT_RATES } from '@revealui/contracts';
import { useCallback, useState } from 'react';
import { useRvcBalance } from '../../hooks/use-rvc-balance';
import { useSettingsContext } from '../../hooks/use-settings';
import Button from '../ui/Button';

interface RvcUpgradePanelProps {
  /** Current user tier for display context. */
  currentTier?: string;
  /** API URL for payment verification. */
  apiUrl: string;
}

type PaymentState = 'idle' | 'submitting' | 'success' | 'error';

const discountPercent = RVC_DISCOUNT_RATES.subscription?.discountPercent ?? 15;

export default function RvcUpgradePanel({ currentTier, apiUrl }: RvcUpgradePanelProps) {
  const { balance, configured } = useRvcBalance();
  const { settings } = useSettingsContext();
  const [selectedTier, setSelectedTier] = useState<'Pro' | 'Max'>('Pro');
  const [txSignature, setTxSignature] = useState('');
  const [paymentState, setPaymentState] = useState<PaymentState>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = useCallback(async () => {
    if (!txSignature.trim()) return;

    setPaymentState('submitting');
    setErrorMessage('');

    try {
      const response = await fetch(`${apiUrl}/api/billing/rvc-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txSignature: txSignature.trim(),
          tier: selectedTier,
          walletAddress: settings.solanaWalletAddress,
          network: settings.solanaNetwork,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? `Payment verification failed (${response.status})`);
      }

      setPaymentState('success');
      setTxSignature('');
    } catch (err) {
      setPaymentState('error');
      setErrorMessage(err instanceof Error ? err.message : 'Payment verification failed');
    }
  }, [txSignature, selectedTier, settings.solanaWalletAddress, settings.solanaNetwork, apiUrl]);

  if (!configured) {
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
        <h3 className="text-sm font-medium text-neutral-200">Pay with RevealCoin</h3>
        <p className="mt-2 text-xs text-neutral-500">
          Configure your Solana wallet address in Settings to pay with RVC and save{' '}
          {discountPercent}%.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-neutral-200">Pay with RevealCoin</h3>
        <span className="rounded-full bg-green-900/30 px-2 py-0.5 text-xs font-medium text-green-400">
          {discountPercent}% off
        </span>
      </div>

      {currentTier && (
        <p className="mt-1 text-xs text-neutral-500">
          Current plan: <span className="text-neutral-300">{currentTier}</span>
        </p>
      )}

      {/* Tier selection */}
      <div className="mt-4 flex gap-2">
        {(['Pro', 'Max'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setSelectedTier(t)}
            className={`flex-1 rounded-md px-3 py-2 text-sm transition-colors ${
              selectedTier === t
                ? 'bg-orange-600/20 text-orange-400 ring-1 ring-orange-600/50'
                : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Discount info */}
      <div className="mt-4 rounded-md bg-green-900/10 border border-green-900/20 px-3 py-2">
        <p className="text-xs text-green-400">
          Pay with RVC for {selectedTier} and save {discountPercent}% on your monthly subscription.
          The equivalent USD amount is calculated using the current TWAP price.
        </p>
      </div>

      {/* Balance display */}
      <p className="mt-3 text-xs text-neutral-500">
        Wallet balance:{' '}
        <span className="text-neutral-300 tabular-nums">{balance ?? '...'} RVC</span>
      </p>

      {/* Transaction signature input */}
      <div className="mt-4">
        <label htmlFor="rvc-tx-sig" className="block text-xs font-medium text-neutral-400">
          Transaction signature
        </label>
        <p className="mt-0.5 text-xs text-neutral-600">
          Send the equivalent RVC to the platform wallet, then paste the tx signature here.
        </p>
        <input
          id="rvc-tx-sig"
          type="text"
          value={txSignature}
          onChange={(e) => setTxSignature(e.target.value)}
          placeholder="Paste Solana transaction signature..."
          disabled={paymentState === 'submitting'}
          className="mt-1.5 w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-200 placeholder:text-neutral-600 focus:border-orange-600 focus:outline-none focus:ring-1 focus:ring-orange-600 disabled:opacity-50"
        />
      </div>

      {/* Submit */}
      <Button
        variant="primary"
        size="lg"
        className="mt-4 w-full"
        loading={paymentState === 'submitting'}
        disabled={!txSignature.trim() || paymentState === 'submitting'}
        onClick={handleSubmit}
      >
        Verify Payment
      </Button>

      {/* Status messages */}
      {paymentState === 'success' && (
        <p className="mt-3 text-xs text-green-400">
          Payment verified. Your {selectedTier} subscription is now active.
        </p>
      )}
      {paymentState === 'error' && <p className="mt-3 text-xs text-red-400">{errorMessage}</p>}
    </div>
  );
}
