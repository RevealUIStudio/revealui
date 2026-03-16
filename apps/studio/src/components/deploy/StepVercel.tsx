import type { StudioConfig, WizardData } from '../../types';
import Button from '../ui/Button';
import WizardStep from './WizardStep';

interface StepVercelProps {
  config: StudioConfig;
  data: WizardData;
  onUpdateData: (updates: Partial<WizardData>) => void;
  onUpdateConfig: (updates: Partial<StudioConfig>) => Promise<void>;
  onNext: () => Promise<void>;
}

// Params required by DeployWizard interface — will be used in full implementation.
export default function StepVercel({
  config: _config,
  data: _data,
  onUpdateData: _onUpdateData,
  onUpdateConfig: _onUpdateConfig,
  onNext,
}: StepVercelProps) {
  return (
    <WizardStep title="Connect Vercel" description="Link your Vercel account to deploy RevealUI.">
      <p className="text-neutral-400">Coming soon...</p>
      <Button variant="primary" onClick={onNext} className="mt-4">
        Next
      </Button>
    </WizardStep>
  );
}
