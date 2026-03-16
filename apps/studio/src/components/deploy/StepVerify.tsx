import type { StudioConfig, WizardData } from '../../types';
import Button from '../ui/Button';
import WizardStep from './WizardStep';

interface StepVerifyProps {
  config: StudioConfig;
  data: WizardData;
  onComplete: () => void;
}

// Params required by DeployWizard interface — will be used in full implementation.
export default function StepVerify({ config: _config, data: _data, onComplete }: StepVerifyProps) {
  return (
    <WizardStep title="Verify" description="Verify your deployment is working correctly.">
      <p className="text-neutral-400">Coming soon...</p>
      <Button variant="primary" onClick={onComplete} className="mt-4">
        Complete
      </Button>
    </WizardStep>
  );
}
