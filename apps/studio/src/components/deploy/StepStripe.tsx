import { useState } from 'react';
import { generateRsaKeypair, stripeRunSeed, stripeValidateKeys } from '../../lib/deploy';
import type { StudioConfig, WizardData } from '../../types';
import Button from '../ui/Button';
import Input from '../ui/Input';
import WizardStep from './WizardStep';

type Phase = 'input' | 'validating' | 'generating-rsa' | 'seeding' | 'done';

const PHASE_LABELS: Record<Phase, string> = {
  input: '',
  validating: 'Validating keys...',
  'generating-rsa': 'Generating license keys...',
  seeding: 'Creating Stripe products, prices & syncing catalog...',
  done: 'Stripe connected',
};

interface StepStripeProps {
  config: StudioConfig;
  data: WizardData;
  onUpdateData: (updates: Partial<WizardData>) => void;
  onNext: () => Promise<void>;
}

export default function StepStripe({
  config: _config,
  data,
  onUpdateData,
  onNext,
}: StepStripeProps) {
  const [secretKey, setSecretKey] = useState(data.stripeSecretKey || '');
  const [publishableKey, setPublishableKey] = useState(data.stripePublishableKey || '');
  const [phase, setPhase] = useState<Phase>('input');
  const [error, setError] = useState<string | null>(null);

  const isRunning = phase !== 'input' && phase !== 'done';

  async function handleConnect() {
    const trimmedSecret = secretKey.trim();
    const trimmedPublishable = publishableKey.trim();
    if (!(trimmedSecret && trimmedPublishable)) return;

    setError(null);

    try {
      setPhase('validating');
      await stripeValidateKeys(trimmedSecret);

      setPhase('generating-rsa');
      const [privateKey, publicKey] = await generateRsaKeypair();

      setPhase('seeding');
      const seedOutput = await stripeRunSeed('.');

      let webhookSecret = '';
      let priceIds = { pro: '', max: '', enterprise: '' };
      try {
        const parsed = JSON.parse(seedOutput);
        if (parsed.envVars) {
          webhookSecret = parsed.envVars.STRIPE_WEBHOOK_SECRET ?? '';
          priceIds = {
            pro: parsed.envVars.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID ?? '',
            max: parsed.envVars.NEXT_PUBLIC_STRIPE_MAX_PRICE_ID ?? '',
            enterprise: parsed.envVars.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID ?? '',
          };
        }
      } catch {
        // Seed output may not be JSON  -  leave empty (user enters manually)
      }

      setPhase('done');
      onUpdateData({
        stripeSecretKey: trimmedSecret,
        stripePublishableKey: trimmedPublishable,
        stripeWebhookSecret: webhookSecret,
        stripePriceIds: priceIds,
        licensePrivateKey: privateKey,
        licensePublicKey: publicKey,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Stripe setup failed');
      setPhase('input');
    }
  }

  return (
    <WizardStep
      title="Connect Stripe"
      description="Connect your Stripe account for payments."
      error={error}
    >
      <div className="flex flex-col gap-4">
        <Input
          id="stripe-secret"
          label="Secret Key"
          hint="sk_test_... or sk_live_..."
          type="password"
          placeholder="sk_test_..."
          value={secretKey}
          onChange={(e) => setSecretKey(e.target.value)}
          disabled={isRunning || phase === 'done'}
          mono
        />

        <Input
          id="stripe-publishable"
          label="Publishable Key"
          hint="pk_test_... or pk_live_..."
          type="password"
          placeholder="pk_test_..."
          value={publishableKey}
          onChange={(e) => setPublishableKey(e.target.value)}
          disabled={isRunning || phase === 'done'}
          mono
        />

        {phase !== 'input' && phase !== 'done' && (
          <p className="text-sm text-orange-400">{PHASE_LABELS[phase]}</p>
        )}

        {phase === 'done' && <p className="text-sm text-green-400">{PHASE_LABELS.done}</p>}

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            onClick={handleConnect}
            loading={isRunning}
            disabled={!(secretKey.trim() && publishableKey.trim()) || isRunning || phase === 'done'}
          >
            Connect &amp; Configure
          </Button>
        </div>

        <Button
          variant="primary"
          onClick={onNext}
          disabled={phase !== 'done'}
          className="mt-2 self-end"
        >
          Next
        </Button>
      </div>
    </WizardStep>
  );
}
