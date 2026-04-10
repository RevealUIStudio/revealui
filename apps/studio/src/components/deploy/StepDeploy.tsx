import { useState } from 'react';
import { vercelDeploy, vercelGetDeployment, vercelSetEnv } from '../../lib/deploy';
import type { StudioConfig, WizardData } from '../../types';
import Button from '../ui/Button';
import WizardStep from './WizardStep';

interface StepDeployProps {
  config: StudioConfig;
  data: WizardData;
  onNext: () => Promise<void>;
}

type AppStatus = 'idle' | 'pushing-env' | 'deploying' | 'polling' | 'ready' | 'error';

interface AppState {
  status: AppStatus;
  error?: string;
  url?: string;
}

/** Max poll attempts (5s intervals) */
const MAX_POLL_ATTEMPTS = 60;
/** Poll interval in ms */
const POLL_INTERVAL_MS = 5_000;

function buildApiEnvVars(data: WizardData): Record<string, string> {
  const domain = data.domain;
  const vars: Record<string, string> = {
    POSTGRES_URL: data.postgresUrl,
    REVEALUI_SECRET: data.revealuiSecret,
    REVEALUI_KEK: data.revealuiKek,
    REVEALUI_CRON_SECRET: data.cronSecret,
    STRIPE_SECRET_KEY: data.stripeSecretKey,
    STRIPE_WEBHOOK_SECRET: data.stripeWebhookSecret,
    REVEALUI_LICENSE_PRIVATE_KEY: data.licensePrivateKey,
    REVEALUI_LICENSE_PUBLIC_KEY: data.licensePublicKey,
    NEXT_PUBLIC_SERVER_URL: `https://api.${domain}`,
    REVEALUI_PUBLIC_SERVER_URL: `https://api.${domain}`,
    CORS_ORIGIN: `https://admin.${domain},https://${domain}`,
    REVEALUI_SIGNUP_OPEN: String(data.signupOpen),
  };

  if (data.brandName) {
    vars.REVEALUI_BRAND_NAME = data.brandName;
  }
  if (data.signupWhitelist) {
    vars.REVEALUI_SIGNUP_WHITELIST = data.signupWhitelist;
  }
  if (data.brandColor) {
    vars.REVEALUI_BRAND_PRIMARY_COLOR = data.brandColor;
  }
  if (data.brandLogo) {
    vars.REVEALUI_BRAND_LOGO_URL = data.brandLogo;
  }

  if (data.googleServiceAccountEmail) {
    vars.GOOGLE_SERVICE_ACCOUNT_EMAIL = data.googleServiceAccountEmail;
  }
  if (data.googlePrivateKey) {
    vars.GOOGLE_PRIVATE_KEY = data.googlePrivateKey;
  }
  if (data.emailFrom) {
    vars.EMAIL_FROM = data.emailFrom;
  }

  // Supabase (when enabled)
  if (data.supabaseUrl) {
    vars.NEXT_PUBLIC_SUPABASE_URL = data.supabaseUrl;
  }
  if (data.supabasePublishableKey) {
    vars.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = data.supabasePublishableKey;
  }
  if (data.supabaseSecretKey) {
    vars.SUPABASE_SECRET_KEY = data.supabaseSecretKey;
  }

  return vars;
}

function buildAdminEnvVars(data: WizardData): Record<string, string> {
  const vars: Record<string, string> = {
    POSTGRES_URL: data.postgresUrl,
    REVEALUI_SECRET: data.revealuiSecret,
    REVEALUI_KEK: data.revealuiKek,
    NEXT_PUBLIC_SERVER_URL: `https://api.${data.domain}`,
    REVEALUI_PUBLIC_SERVER_URL: `https://api.${data.domain}`,
    BLOB_READ_WRITE_TOKEN: data.blobToken,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: data.stripePublishableKey,
    NEXT_PUBLIC_STRIPE_PRO_PRICE_ID: data.stripePriceIds.pro,
    NEXT_PUBLIC_STRIPE_MAX_PRICE_ID: data.stripePriceIds.max,
    NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID: data.stripePriceIds.enterprise,
    REVEALUI_LICENSE_PUBLIC_KEY: data.licensePublicKey,
  };

  // Email vars for admin password reset
  if (data.googleServiceAccountEmail) {
    vars.GOOGLE_SERVICE_ACCOUNT_EMAIL = data.googleServiceAccountEmail;
  }
  if (data.googlePrivateKey) {
    vars.GOOGLE_PRIVATE_KEY = data.googlePrivateKey;
  }
  if (data.emailFrom) {
    vars.EMAIL_FROM = data.emailFrom;
  }

  // Signup control
  vars.REVEALUI_SIGNUP_OPEN = String(data.signupOpen);

  // Supabase for admin AI features
  if (data.supabaseUrl) {
    vars.NEXT_PUBLIC_SUPABASE_URL = data.supabaseUrl;
    if (data.supabasePublishableKey)
      vars.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = data.supabasePublishableKey;
  }

  return vars;
}

function buildMarketingEnvVars(data: WizardData): Record<string, string> {
  return {
    NEXT_PUBLIC_SERVER_URL: `https://api.${data.domain}`,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: data.stripePublishableKey,
    NEXT_PUBLIC_STRIPE_PRO_PRICE_ID: data.stripePriceIds.pro,
    NEXT_PUBLIC_STRIPE_MAX_PRICE_ID: data.stripePriceIds.max,
    NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID: data.stripePriceIds.enterprise,
  };
}

async function pushEnvVars(
  token: string,
  projectId: string,
  vars: Record<string, string>,
): Promise<void> {
  for (const [key, value] of Object.entries(vars)) {
    if (!value) continue;
    await vercelSetEnv(token, projectId, key, value);
  }
}

async function deployApp(
  token: string,
  projectId: string,
  envVars: Record<string, string>,
  onStatus: (status: AppStatus) => void,
): Promise<string> {
  // Push env vars first (RC-6)
  onStatus('pushing-env');
  await pushEnvVars(token, projectId, envVars);

  // Deploy
  onStatus('deploying');
  const deploymentId = await vercelDeploy(token, projectId);

  // Poll until ready
  onStatus('polling');
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const deployment = await vercelGetDeployment(token, deploymentId);
    if (deployment.state === 'READY') {
      return deployment.url ?? deploymentId;
    }
    if (deployment.state === 'ERROR' || deployment.state === 'CANCELED') {
      throw new Error(`Deployment ${deployment.state.toLowerCase()}`);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error('Deployment timed out');
}

const APP_LABELS = { api: 'API', admin: 'Admin', marketing: 'Marketing' } as const;
type AppName = keyof typeof APP_LABELS;

const STATUS_LABELS: Record<AppStatus, string> = {
  idle: 'Waiting',
  'pushing-env': 'Pushing env vars...',
  deploying: 'Deploying...',
  polling: 'Waiting for deployment...',
  ready: 'Ready',
  error: 'Error',
};

export default function StepDeploy({ config, data, onNext }: StepDeployProps) {
  const [apps, setApps] = useState<Record<AppName, AppState>>({
    api: { status: 'idle' },
    admin: { status: 'idle' },
    marketing: { status: 'idle' },
  });
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allReady =
    apps.api.status === 'ready' &&
    apps.admin.status === 'ready' &&
    apps.marketing.status === 'ready';
  const hasErrors =
    apps.api.status === 'error' ||
    apps.admin.status === 'error' ||
    apps.marketing.status === 'error';

  function updateApp(name: AppName, update: Partial<AppState>) {
    setApps((prev) => ({ ...prev, [name]: { ...prev[name], ...update } }));
  }

  async function handleDeploy() {
    setDeploying(true);
    setError(null);

    const token = data.vercelToken;
    const apiProjectId = config.deploy?.apps?.api;
    const adminProjectId = config.deploy?.apps?.admin;
    const marketingProjectId = config.deploy?.apps?.marketing;

    if (!(apiProjectId && adminProjectId && marketingProjectId)) {
      setError('Missing project IDs. Go back to Vercel step.');
      setDeploying(false);
      return;
    }

    const deployments: Array<{
      name: AppName;
      projectId: string;
      envVars: Record<string, string>;
    }> = [
      { name: 'api', projectId: apiProjectId, envVars: buildApiEnvVars(data) },
      { name: 'admin', projectId: adminProjectId, envVars: buildAdminEnvVars(data) },
      { name: 'marketing', projectId: marketingProjectId, envVars: buildMarketingEnvVars(data) },
    ];

    const results = await Promise.allSettled(
      deployments.map(async ({ name, projectId, envVars }) => {
        try {
          const url = await deployApp(token, projectId, envVars, (status) =>
            updateApp(name, { status }),
          );
          updateApp(name, { status: 'ready', url });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Deploy failed';
          updateApp(name, { status: 'error', error: message });
          throw err;
        }
      }),
    );

    const failures = results.filter((r) => r.status === 'rejected');
    if (failures.length > 0) {
      setError(`${failures.length} deployment(s) failed. Check status below.`);
    }

    setDeploying(false);
  }

  return (
    <WizardStep title="Deploy" description="Deploy your RevealUI apps to Vercel." error={error}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          {(['api', 'admin', 'marketing'] as const).map((name) => (
            <AppCard key={name} name={name} state={apps[name]} />
          ))}
        </div>

        {!allReady && (
          <Button
            variant="primary"
            onClick={handleDeploy}
            loading={deploying}
            disabled={deploying || allReady}
          >
            {hasErrors ? 'Retry Failed' : 'Deploy All'}
          </Button>
        )}

        <Button variant="primary" onClick={onNext} disabled={!allReady} className="mt-2 self-end">
          Next
        </Button>
      </div>
    </WizardStep>
  );
}

function AppCard({ name, state }: { name: AppName; state: AppState }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-neutral-700 bg-neutral-900/50 px-4 py-3">
      <div className="flex items-center gap-3">
        <StatusDot status={state.status} />
        <div>
          <p className="text-sm font-medium text-neutral-200">{APP_LABELS[name]}</p>
          {state.url && <p className="text-xs font-mono text-neutral-400">{state.url}</p>}
          {state.error && <p className="text-xs text-red-400">{state.error}</p>}
        </div>
      </div>
      <span className="text-xs text-neutral-500">{STATUS_LABELS[state.status]}</span>
    </div>
  );
}

function StatusDot({ status }: { status: AppStatus }) {
  const colors: Record<AppStatus, string> = {
    idle: 'bg-neutral-600',
    'pushing-env': 'bg-yellow-500 animate-pulse',
    deploying: 'bg-orange-500 animate-pulse',
    polling: 'bg-orange-500 animate-pulse',
    ready: 'bg-green-500',
    error: 'bg-red-500',
  };

  return <span className={`inline-block size-2.5 rounded-full ${colors[status]}`} />;
}
