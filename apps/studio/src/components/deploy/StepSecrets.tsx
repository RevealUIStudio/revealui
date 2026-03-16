import type { WizardData } from '../../types';
import Button from '../ui/Button';
import WizardStep from './WizardStep';

interface StepSecretsProps {
  data: WizardData;
  onUpdateData: (updates: Partial<WizardData>) => void;
  onNext: () => Promise<void>;
}

// Params required by DeployWizard interface — will be used in full implementation.
export default function StepSecrets({
  data: _data,
  onUpdateData: _onUpdateData,
  onNext,
}: StepSecretsProps) {
  return (
    <WizardStep title="Generate Secrets" description="Generate encryption keys and secrets.">
      <p className="text-neutral-400">Coming soon...</p>
      <Button variant="primary" onClick={onNext} className="mt-4">
        Next
      </Button>
    </WizardStep>
  );
}
