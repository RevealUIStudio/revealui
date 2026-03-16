import type { ReactNode } from 'react';
import ErrorAlert from '../ui/ErrorAlert';

interface WizardStepProps {
  title: string;
  description: string;
  children: ReactNode;
  error?: string | null;
}

export default function WizardStep({ title, description, children, error }: WizardStepProps) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <p className="mt-1 text-sm text-neutral-400">{description}</p>
      </div>
      {error && <ErrorAlert message={error} />}
      <div className="flex-1">{children}</div>
    </div>
  );
}
