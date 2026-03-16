import { useState } from 'react';
import { useConfig } from '../../hooks/use-config';
import { useDeployWizard } from '../../hooks/use-deploy-wizard';
import type { WizardData } from '../../types';
import Button from '../ui/Button';
import StepBlob from './StepBlob';
import StepDatabase from './StepDatabase';
import StepDeploy from './StepDeploy';
import StepDomain from './StepDomain';
import StepEmail from './StepEmail';
import StepSecrets from './StepSecrets';
import StepStripe from './StepStripe';
import StepVercel from './StepVercel';
import StepVerify from './StepVerify';

interface DeployWizardProps {
  onComplete: () => void;
}

const EMPTY_WIZARD_DATA: WizardData = {
  vercelToken: '',
  vercelProjects: { api: '', cms: '', marketing: '' },
  postgresUrl: '',
  stripeSecretKey: '',
  stripePublishableKey: '',
  stripeWebhookSecret: '',
  stripePriceIds: { pro: '', max: '', enterprise: '' },
  licensePrivateKey: '',
  licensePublicKey: '',
  emailProvider: 'resend',
  blobToken: '',
  revealuiSecret: '',
  revealuiKek: '',
  cronSecret: '',
  domain: '',
  signupOpen: true,
  signupWhitelist: undefined,
  brandColor: undefined,
  brandLogo: undefined,
};

export default function DeployWizard({ onComplete }: DeployWizardProps) {
  const { config, updateConfig } = useConfig();
  const [data, setData] = useState<WizardData>(EMPTY_WIZARD_DATA);
  const wizard = useDeployWizard(config);

  if (!config) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-950">
        <div className="text-neutral-400">Loading...</div>
      </div>
    );
  }

  const updateData = (updates: Partial<WizardData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  };

  const stepComponents: Record<string, React.ReactNode> = {
    vercel: (
      <StepVercel
        config={config}
        data={data}
        onUpdateData={updateData}
        onUpdateConfig={updateConfig}
        onNext={wizard.next}
      />
    ),
    database: (
      <StepDatabase config={config} data={data} onUpdateData={updateData} onNext={wizard.next} />
    ),
    stripe: (
      <StepStripe config={config} data={data} onUpdateData={updateData} onNext={wizard.next} />
    ),
    email: (
      <StepEmail
        config={config}
        data={data}
        onUpdateData={updateData}
        onUpdateConfig={updateConfig}
        onNext={wizard.next}
      />
    ),
    blob: <StepBlob data={data} onUpdateData={updateData} onNext={wizard.next} />,
    secrets: <StepSecrets data={data} onUpdateData={updateData} onNext={wizard.next} />,
    domain: (
      <StepDomain
        config={config}
        data={data}
        onUpdateData={updateData}
        onUpdateConfig={updateConfig}
        onNext={wizard.next}
      />
    ),
    deploy: <StepDeploy config={config} data={data} onNext={wizard.next} />,
    verify: <StepVerify config={config} data={data} onComplete={onComplete} />,
  };

  return (
    <div className="fixed inset-0 z-50 flex bg-neutral-950">
      <div className="w-64 border-r border-neutral-800 bg-neutral-900 p-4">
        <h1 className="mb-6 text-lg font-bold text-white">Deploy RevealUI</h1>
        <nav className="flex flex-col gap-1">
          {wizard.steps.map((s, i) => {
            const done = wizard.isStepDone(s.id);
            const active = i === wizard.currentStep;
            return (
              <button
                type="button"
                key={s.id}
                onClick={() => wizard.goTo(i)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                  active
                    ? 'bg-neutral-800 text-white'
                    : done
                      ? 'text-green-400 hover:bg-neutral-800'
                      : 'text-neutral-500 hover:bg-neutral-800'
                }`}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-current text-xs">
                  {done ? '\u2713' : i + 1}
                </span>
                {s.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="flex flex-1 flex-col p-8">
        <div className="flex-1 overflow-y-auto">
          {wizard.step && stepComponents[wizard.step.id]}
        </div>

        <div className="mt-6 flex justify-between border-t border-neutral-800 pt-4">
          <Button variant="ghost" disabled={wizard.isFirst} onClick={wizard.back}>
            Back
          </Button>
          <div className="text-sm text-neutral-500">
            Step {wizard.currentStep + 1} of {wizard.steps.length}
          </div>
        </div>
      </div>
    </div>
  );
}
