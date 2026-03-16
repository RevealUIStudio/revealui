import type { StudioConfig, WizardData } from '../../types';
import Button from '../ui/Button';
import WizardStep from './WizardStep';

interface StepStripeProps {
  config: StudioConfig;
  data: WizardData;
  onUpdateData: (updates: Partial<WizardData>) => void;
  onNext: () => Promise<void>;
}

// Params required by DeployWizard interface — will be used in full implementation.
export default function StepStripe({
  config: _config,
  data: _data,
  onUpdateData: _onUpdateData,
  onNext,
}: StepStripeProps) {
  return (
    <WizardStep title="Connect Stripe" description="Connect your Stripe account for payments.">
      <p className="text-neutral-400">Coming soon...</p>
      <Button variant="primary" onClick={onNext} className="mt-4">
        Next
      </Button>
    </WizardStep>
  );
}
