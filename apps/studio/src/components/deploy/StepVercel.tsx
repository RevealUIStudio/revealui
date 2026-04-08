import { useState } from 'react';
import { vercelCreateProject, vercelValidateToken } from '../../lib/deploy';
import type { StudioConfig, VercelProject, WizardData } from '../../types';
import Button from '../ui/Button';
import Input from '../ui/Input';
import WizardStep from './WizardStep';

const REQUIRED_PROJECTS = [
  { key: 'api' as const, name: 'revealui-api', framework: 'other', rootDir: 'apps/api' },
  { key: 'admin' as const, name: 'revealui-admin', framework: 'nextjs', rootDir: 'apps/admin' },
  {
    key: 'marketing' as const,
    name: 'revealui-marketing',
    framework: 'nextjs',
    rootDir: 'apps/marketing',
  },
];

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
  const [linkedProjects, setLinkedProjects] = useState<Record<string, string>>({});
  const [validated, setValidated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleValidate() {
    const trimmed = token.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);

    try {
      const existingProjects = await vercelValidateToken(trimmed);

      // Build a lookup of existing projects by name
      const existingByName = new Map<string, VercelProject>();
      for (const p of existingProjects) {
        existingByName.set(p.name, p);
      }

      // Link or create each required project
      const projectMap: Record<string, string> = {};
      const allProjects: VercelProject[] = [...existingProjects];

      for (const req of REQUIRED_PROJECTS) {
        const existing = existingByName.get(req.name);
        if (existing) {
          projectMap[req.key] = existing.id;
        } else {
          const created = await vercelCreateProject(trimmed, req.name, req.framework, req.rootDir);
          projectMap[req.key] = created.id;
          allProjects.push(created);
        }
      }

      // Extract teamId from any project's accountId
      const teamId = allProjects[0]?.accountId ?? '';

      setLinkedProjects(projectMap);
      setValidated(true);

      onUpdateData({
        vercelToken: trimmed,
        vercelProjects: {
          api: projectMap.api ?? '',
          admin: projectMap.admin ?? '',
          marketing: projectMap.marketing ?? '',
        },
      });

      await onUpdateConfig({
        deploy: {
          ...config.deploy,
          vercelTeamId: teamId,
          apps: {
            api: projectMap.api ?? '',
            admin: projectMap.admin ?? '',
            marketing: projectMap.marketing ?? '',
          },
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
              Connected — {Object.keys(linkedProjects).length} project
              {Object.keys(linkedProjects).length !== 1 ? 's' : ''} linked
            </span>
          )}
        </div>

        {validated && Object.keys(linkedProjects).length > 0 && (
          <ul className="mt-2 flex flex-col gap-1 text-sm text-zinc-300">
            {REQUIRED_PROJECTS.map((req) => (
              <li key={req.key} className="flex items-center gap-2">
                <span className="text-green-400">&#10003;</span>
                <span className="font-mono">{req.name}</span>
              </li>
            ))}
          </ul>
        )}

        <Button variant="primary" onClick={onNext} disabled={!validated} className="mt-4 self-end">
          Next
        </Button>
      </div>
    </WizardStep>
  );
}
