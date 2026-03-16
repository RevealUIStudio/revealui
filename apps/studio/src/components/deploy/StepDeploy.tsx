import type { StudioConfig, WizardData } from '../../types';
import Button from '../ui/Button';
import WizardStep from './WizardStep';

interface StepDeployProps {
  config: StudioConfig;
  data: WizardData;
  onNext: () => Promise<void>;
}

// Params required by DeployWizard interface — will be used in full implementation.
export default function StepDeploy({ config: _config, data: _data, onNext }: StepDeployProps) {
  return (
    <WizardStep title="Deploy" description="Deploy your RevealUI apps to Vercel.">
      <p className="text-neutral-400">Coming soon...</p>
      <Button variant="primary" onClick={onNext} className="mt-4">
        Next
      </Button>
    </WizardStep>
  );
}
