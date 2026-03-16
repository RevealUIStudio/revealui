import { useState } from 'react';
import { neonTestConnection, runDbMigrate, runDbSeed } from '../../lib/deploy';
import type { StudioConfig, WizardData } from '../../types';
import Button from '../ui/Button';
import Input from '../ui/Input';
import WizardStep from './WizardStep';

type Phase = 'input' | 'testing' | 'migrating' | 'seeding' | 'done';

const PHASE_LABELS: Record<Phase, string> = {
  input: '',
  testing: 'Testing connection...',
  migrating: 'Running migrations...',
  seeding: 'Seeding database...',
  done: 'Database ready',
};

interface StepDatabaseProps {
  config: StudioConfig;
  data: WizardData;
  onUpdateData: (updates: Partial<WizardData>) => void;
  onNext: () => Promise<void>;
}

export default function StepDatabase({
  config: _config,
  data,
  onUpdateData,
  onNext,
}: StepDatabaseProps) {
  const [postgresUrl, setPostgresUrl] = useState(data.postgresUrl || '');
  const [supabaseEnabled, setSupabaseEnabled] = useState(!!data.supabaseUrl);
  const [supabaseUrl, setSupabaseUrl] = useState(data.supabaseUrl || '');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(data.supabaseAnonKey || '');
  const [supabaseServiceKey, setSupabaseServiceKey] = useState(data.supabaseServiceKey || '');
  const [phase, setPhase] = useState<Phase>('input');
  const [error, setError] = useState<string | null>(null);

  const isRunning = phase !== 'input' && phase !== 'done';

  async function handleConnect() {
    if (!postgresUrl.trim()) return;

    setError(null);

    try {
      setPhase('testing');
      await neonTestConnection(postgresUrl.trim());

      setPhase('migrating');
      await runDbMigrate('.');

      setPhase('seeding');
      await runDbSeed('.');

      setPhase('done');
      onUpdateData({
        postgresUrl: postgresUrl.trim(),
        ...(supabaseEnabled
          ? {
              supabaseUrl: supabaseUrl.trim(),
              supabaseAnonKey: supabaseAnonKey.trim(),
              supabaseServiceKey: supabaseServiceKey.trim(),
            }
          : {}),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Database setup failed');
      setPhase('input');
    }
  }

  return (
    <WizardStep
      title="Provision Database"
      description="Set up your PostgreSQL database."
      error={error}
    >
      <div className="flex flex-col gap-4">
        <Input
          id="postgres-url"
          label="PostgreSQL Connection String"
          hint="from Neon dashboard"
          type="password"
          placeholder="postgres://user:pass@host/db?sslmode=require"
          value={postgresUrl}
          onChange={(e) => setPostgresUrl(e.target.value)}
          disabled={isRunning || phase === 'done'}
          mono
        />

        <label className="flex items-center gap-2 text-sm text-neutral-300">
          <input
            type="checkbox"
            checked={supabaseEnabled}
            onChange={(e) => setSupabaseEnabled(e.target.checked)}
            disabled={isRunning || phase === 'done'}
            className="rounded border-neutral-600 bg-neutral-800"
          />
          Enable AI features (requires Supabase)
        </label>

        {supabaseEnabled && (
          <div className="flex flex-col gap-3 rounded-md border border-neutral-700 bg-neutral-900/50 p-4">
            <Input
              id="supabase-url"
              label="Supabase URL"
              type="text"
              placeholder="https://your-project.supabase.co"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              disabled={isRunning || phase === 'done'}
              mono
            />
            <Input
              id="supabase-anon-key"
              label="Supabase Anon Key"
              type="password"
              placeholder="eyJ..."
              value={supabaseAnonKey}
              onChange={(e) => setSupabaseAnonKey(e.target.value)}
              disabled={isRunning || phase === 'done'}
              mono
            />
            <Input
              id="supabase-service-key"
              label="Supabase Service Key"
              type="password"
              placeholder="eyJ..."
              value={supabaseServiceKey}
              onChange={(e) => setSupabaseServiceKey(e.target.value)}
              disabled={isRunning || phase === 'done'}
              mono
            />
          </div>
        )}

        {phase !== 'input' && phase !== 'done' && (
          <p className="text-sm text-orange-400">{PHASE_LABELS[phase]}</p>
        )}

        {phase === 'done' && <p className="text-sm text-green-400">{PHASE_LABELS.done}</p>}

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            onClick={handleConnect}
            loading={isRunning}
            disabled={!postgresUrl.trim() || isRunning || phase === 'done'}
          >
            Connect &amp; Migrate
          </Button>
        </div>

        <Button
          variant="primary"
          onClick={onNext}
          disabled={phase !== 'done'}
          className="mt-2 self-end"
        >
          Next
        </Button>
      </div>
    </WizardStep>
  );
}
