import type { StudioConfig, WizardData } from '../../types';
import Button from '../ui/Button';
import WizardStep from './WizardStep';

interface StepDomainProps {
  config: StudioConfig;
  data: WizardData;
  onUpdateData: (updates: Partial<WizardData>) => void;
  onUpdateConfig: (updates: Partial<StudioConfig>) => Promise<void>;
  onNext: () => Promise<void>;
}

// Params required by DeployWizard interface — will be used in full implementation.
export default function StepDomain({
  config: _config,
  data: _data,
  onUpdateData: _onUpdateData,
  onUpdateConfig: _onUpdateConfig,
  onNext,
}: StepDomainProps) {
  return (
    <WizardStep title="Domain & CORS" description="Configure your domain and security settings.">
      <p className="text-neutral-400">Coming soon...</p>
      <Button variant="primary" onClick={onNext} className="mt-4">
        Next
      </Button>
    </WizardStep>
  );
}
