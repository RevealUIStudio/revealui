import { useState } from 'react';
import { generateKek, generateSecret } from '../../lib/deploy';
import type { WizardData } from '../../types';
import Button from '../ui/Button';
import WizardStep from './WizardStep';

interface StepSecretsProps {
  data: WizardData;
  onUpdateData: (updates: Partial<WizardData>) => void;
  onNext: () => Promise<void>;
}

export default function StepSecrets({ data, onUpdateData, onNext }: StepSecretsProps) {
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(
    Boolean(data.revealuiSecret && data.revealuiKek && data.cronSecret),
  );
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);

    try {
      const [revealuiSecret, revealuiKek, cronSecret] = await Promise.all([
        generateSecret(48),
        generateKek(),
        generateSecret(48),
      ]);

      onUpdateData({ revealuiSecret, revealuiKek, cronSecret });
      setGenerated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate secrets');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <WizardStep
      title="Generate Secrets"
      description="Generate encryption keys and secrets for your deployment."
      error={error}
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-md border border-neutral-700 bg-neutral-900/50 p-4 text-sm text-neutral-400">
          <p className="mb-2 font-medium text-neutral-300">Three secrets will be generated:</p>
          <ul className="list-inside list-disc flex flex-col gap-1">
            <li>
              <span className="text-neutral-200">REVEALUI_SECRET</span> - session signing key
            </li>
            <li>
              <span className="text-neutral-200">REVEALUI_KEK</span> - key encryption key (AES-256)
            </li>
            <li>
              <span className="text-neutral-200">REVEALUI_CRON_SECRET</span> - cron job
              authentication
            </li>
          </ul>
        </div>

        {generated && (
          <div className="flex flex-col gap-2">
            <SecretRow label="REVEALUI_SECRET" />
            <SecretRow label="REVEALUI_KEK" />
            <SecretRow label="REVEALUI_CRON_SECRET" />
          </div>
        )}

        {!generated && (
          <Button
            variant="primary"
            onClick={handleGenerate}
            loading={generating}
            disabled={generating}
          >
            Generate All Secrets
          </Button>
        )}

        <Button variant="primary" onClick={onNext} disabled={!generated} className="mt-2 self-end">
          Next
        </Button>
      </div>
    </WizardStep>
  );
}

function SecretRow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-green-800/50 bg-green-950/30 px-3 py-2">
      <svg
        className="size-4 shrink-0 text-green-400"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
          clipRule="evenodd"
        />
      </svg>
      <span className="text-sm font-mono text-neutral-300">{label}</span>
      <span className="text-xs text-green-400">Generated</span>
    </div>
  );
}
