import { useState } from 'react';
import { healthCheck, vercelSetEnv } from '../../lib/deploy';
import type { StudioConfig, WizardData } from '../../types';
import Button from '../ui/Button';
import Input from '../ui/Input';
import WizardStep from './WizardStep';

interface StepVerifyProps {
  config: StudioConfig;
  data: WizardData;
  onComplete: () => void;
}

type CheckStatus = 'idle' | 'checking' | 'pass' | 'fail';

interface CheckState {
  label: string;
  status: CheckStatus;
  detail?: string;
}

export default function StepVerify({ config, data, onComplete }: StepVerifyProps) {
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checks, setChecks] = useState<CheckState[]>([
    { label: 'API Health', status: 'idle' },
    { label: 'CMS', status: 'idle' },
    { label: 'Marketing', status: 'idle' },
    { label: 'Database (via API)', status: 'idle' },
  ]);

  const domain = data.domain;
  const allPassed = checks.every((c) => c.status === 'pass');

  function updateCheck(index: number, update: Partial<CheckState>) {
    setChecks((prev) => prev.map((c, i) => (i === index ? { ...c, ...update } : c)));
  }

  async function handleRunChecks() {
    const trimmedEmail = adminEmail.trim();
    const trimmedPassword = adminPassword.trim();

    if (!(trimmedEmail && trimmedPassword)) return;

    setRunning(true);
    setError(null);

    // Reset all checks
    setChecks((prev) =>
      prev.map((c) => ({ ...c, status: 'checking' as const, detail: undefined })),
    );

    try {
      // RC-7: Push admin env vars first
      const apiProjectId = config.deploy?.apps?.api;
      if (apiProjectId) {
        await vercelSetEnv(data.vercelToken, apiProjectId, 'REVEALUI_ADMIN_EMAIL', trimmedEmail);
        await vercelSetEnv(
          data.vercelToken,
          apiProjectId,
          'REVEALUI_ADMIN_PASSWORD',
          trimmedPassword,
        );
      }

      // Health checks
      const endpoints = [
        `https://api.${domain}/health/ready`,
        `https://cms.${domain}`,
        `https://${domain}`,
        `https://api.${domain}/health/live`,
      ];

      const results = await Promise.allSettled(endpoints.map((url) => healthCheck(url)));

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.status === 'fulfilled') {
          const statusCode = result.value;
          const ok = statusCode >= 200 && statusCode < 400;
          updateCheck(i, {
            status: ok ? 'pass' : 'fail',
            detail: ok ? `HTTP ${statusCode}` : `HTTP ${statusCode}`,
          });
        } else {
          updateCheck(i, {
            status: 'fail',
            detail: result.reason instanceof Error ? result.reason.message : 'Request failed',
          });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setRunning(false);
    }
  }

  return (
    <WizardStep
      title="Bootstrap & Verify"
      description="Create admin account and verify your deployment."
      error={error}
    >
      <div className="flex flex-col gap-4">
        <Input
          id="admin-email"
          label="Admin Email"
          type="email"
          placeholder="admin@example.com"
          value={adminEmail}
          onChange={(e) => setAdminEmail(e.target.value)}
          disabled={running || allPassed}
        />

        <Input
          id="admin-password"
          label="Admin Password"
          type="password"
          placeholder="Strong password"
          value={adminPassword}
          onChange={(e) => setAdminPassword(e.target.value)}
          disabled={running || allPassed}
        />

        <div className="flex flex-col gap-2">
          {checks.map((check) => (
            <CheckRow key={check.label} check={check} />
          ))}
        </div>

        {!allPassed && (
          <Button
            variant="primary"
            onClick={handleRunChecks}
            loading={running}
            disabled={!(adminEmail.trim() && adminPassword.trim()) || running}
          >
            Run Checks
          </Button>
        )}

        {allPassed && (
          <div className="rounded-md border border-green-800/50 bg-green-950/30 p-4">
            <p className="mb-2 text-sm font-medium text-green-400">
              All checks passed! Your RevealUI instance is live.
            </p>
            <div className="flex flex-col gap-1 text-sm font-mono text-neutral-300">
              <p>
                API: <span className="text-neutral-200">https://api.{domain}</span>
              </p>
              <p>
                CMS: <span className="text-neutral-200">https://cms.{domain}</span>
              </p>
              <p>
                Site: <span className="text-neutral-200">https://{domain}</span>
              </p>
            </div>
          </div>
        )}

        <Button
          variant="success"
          onClick={onComplete}
          disabled={!allPassed}
          className="mt-2 self-end"
        >
          Complete Setup
        </Button>
      </div>
    </WizardStep>
  );
}

function CheckRow({ check }: { check: CheckState }) {
  const icons: Record<CheckStatus, { color: string; symbol: string }> = {
    idle: { color: 'text-neutral-600', symbol: '\u25CB' },
    checking: { color: 'text-orange-400 animate-pulse', symbol: '\u25CF' },
    pass: { color: 'text-green-400', symbol: '\u2713' },
    fail: { color: 'text-red-400', symbol: '\u2717' },
  };

  const icon = icons[check.status];

  return (
    <div className="flex items-center gap-2 rounded-md border border-neutral-700 bg-neutral-900/50 px-3 py-2">
      <span className={`text-sm font-bold ${icon.color}`}>{icon.symbol}</span>
      <span className="text-sm text-neutral-300">{check.label}</span>
      {check.detail && <span className="ml-auto text-xs text-neutral-500">{check.detail}</span>}
    </div>
  );
}
