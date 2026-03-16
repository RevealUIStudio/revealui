import type { WizardData } from '../../types';
import Button from '../ui/Button';
import WizardStep from './WizardStep';

interface StepBlobProps {
  data: WizardData;
  onUpdateData: (updates: Partial<WizardData>) => void;
  onNext: () => Promise<void>;
}

// Params required by DeployWizard interface — will be used in full implementation.
export default function StepBlob({
  data: _data,
  onUpdateData: _onUpdateData,
  onNext,
}: StepBlobProps) {
  return (
    <WizardStep title="Blob Storage" description="Configure file storage for uploads.">
      <p className="text-neutral-400">Coming soon...</p>
      <Button variant="primary" onClick={onNext} className="mt-4">
        Next
      </Button>
    </WizardStep>
  );
}
