import { useState } from 'react';
import { vercelValidateToken } from '../../lib/deploy';
import type { StudioConfig, VercelProject, WizardData } from '../../types';
import Button from '../ui/Button';
import Input from '../ui/Input';
import WizardStep from './WizardStep';

interface StepVercelProps {
  config: StudioConfig;
  data: WizardData;
  onUpdateData: (updates: Partial<WizardData>) => void;
  onUpdateConfig: (updates: Partial<StudioConfig>) => Promise<void>;
  onNext: () => Promise<void>;
}

export default function StepVercel({
  config,
  data,
  onUpdateData,
  onUpdateConfig,
  onNext,
}: StepVercelProps) {
  const [token, setToken] = useState(data.vercelToken || '');
  const [projects, setProjects] = useState<VercelProject[]>([]);
  const [validated, setValidated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleValidate() {
    const trimmed = token.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);

    try {
      const result = await vercelValidateToken(trimmed);
      setProjects(result);
      setValidated(true);
      onUpdateData({ vercelToken: trimmed });
      await onUpdateConfig({
        deploy: {
          ...config.deploy,
          supabaseEnabled: config.deploy?.supabaseEnabled ?? false,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to validate Vercel token');
      setValidated(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <WizardStep
      title="Connect Vercel"
      description="Link your Vercel account to deploy RevealUI."
      error={error}
    >
      <div className="flex flex-col gap-4">
        <Input
          id="vercel-token"
          label="Vercel API Token"
          hint="Settings → Tokens"
          type="password"
          placeholder="Enter your Vercel API token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          disabled={loading}
          mono
        />

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            onClick={handleValidate}
            loading={loading}
            disabled={!token.trim() || loading}
          >
            Validate Token
          </Button>

          {validated && (
            <span className="text-sm text-green-400">
              Connected — {projects.length} project{projects.length !== 1 ? 's' : ''} found
            </span>
          )}
        </div>

        <Button variant="primary" onClick={onNext} disabled={!validated} className="mt-4 self-end">
          Next
        </Button>
      </div>
    </WizardStep>
  );
}
