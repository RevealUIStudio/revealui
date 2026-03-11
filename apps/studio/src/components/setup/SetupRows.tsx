import { open } from '@tauri-apps/plugin-shell';
import { useCallback, useEffect, useState } from 'react';
import type { useSetup } from '../../hooks/use-setup';
import { useTunnel } from '../../hooks/use-tunnel';
import { vaultInit, vaultIsInitialized } from '../../lib/invoke';
import Button from '../ui/Button';
import ErrorAlert from '../ui/ErrorAlert';
import Input from '../ui/Input';
import StatusDot from '../ui/StatusDot';

const SETUP_DONE_KEY = 'revealui_project_setup_done';
const SETUP_CMD = 'pnpm setup:env';

// ── Shared primitives ────────────────────────────────────────────────────────

interface SetupRowProps {
  label: string;
  done: boolean;
  doneText: string;
  pendingText: string;
  action?: React.ReactNode;
}

export function SetupRow({ label, done, doneText, pendingText, action }: SetupRowProps) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusDot status={done ? 'ok' : 'off'} size="md" />
          <span className="text-sm font-medium">{label}</span>
        </div>
        {action}
      </div>
      <p className="mt-1 text-xs text-neutral-500">{done ? doneText : pendingText}</p>
    </div>
  );
}

// ── Vault hook ───────────────────────────────────────────────────────────────

export function useVaultSetup() {
  const [vaultInitialized, setVaultInitialized] = useState<boolean | null>(null);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [vaultError, setVaultError] = useState<string | null>(null);

  const checkVault = useCallback(async () => {
    try {
      const initialized = await vaultIsInitialized();
      setVaultInitialized(initialized);
    } catch {
      setVaultInitialized(false);
    }
  }, []);

  useEffect(() => {
    checkVault();
  }, [checkVault]);

  const handleInitVault = async () => {
    setVaultLoading(true);
    setVaultError(null);
    try {
      await vaultInit();
      setVaultInitialized(true);
    } catch (err) {
      setVaultError(err instanceof Error ? err.message : String(err));
    } finally {
      setVaultLoading(false);
    }
  };

  return { vaultInitialized, vaultLoading, vaultError, handleInitVault };
}

// ── Composite rows ───────────────────────────────────────────────────────────

type SetupHook = ReturnType<typeof useSetup>;

interface SetupStepsProps {
  setup: SetupHook;
}

export function WslRow({ setup }: SetupStepsProps) {
  return (
    <SetupRow
      label="WSL"
      done={setup.status?.wsl_running ?? false}
      doneText="Ubuntu running"
      pendingText="WSL not detected — install WSL from the Microsoft Store"
    />
  );
}

export function NixRow({ setup }: SetupStepsProps) {
  return (
    <SetupRow
      label="Nix"
      done={setup.status?.nix_installed ?? false}
      doneText="Nix installed"
      pendingText="Nix not found in WSL"
      action={
        !setup.status?.nix_installed ? (
          <Button size="sm" onClick={() => open('https://nixos.org/download/')}>
            Install Nix ↗
          </Button>
        ) : null
      }
    />
  );
}

export function DevPodRow({ setup }: SetupStepsProps) {
  return (
    <SetupRow
      label="DevPod"
      done={setup.status?.devbox_mounted ?? false}
      doneText="Studio drive mounted"
      pendingText="Studio drive not mounted"
      action={
        !setup.status?.devbox_mounted ? (
          <Button variant="primary" size="sm" onClick={setup.doMount} loading={setup.mounting}>
            Mount
          </Button>
        ) : null
      }
    />
  );
}

export function GitIdentityRow({ setup }: SetupStepsProps) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-4">
      <div className="mb-3 flex items-center gap-2">
        <StatusDot
          status={setup.status?.git_name && setup.status?.git_email ? 'ok' : 'off'}
          size="md"
        />
        <span className="text-sm font-medium">Git Identity</span>
      </div>
      <div className="space-y-2">
        <Input
          value={setup.gitName}
          onChange={(e) => setup.setGitName(e.target.value)}
          placeholder="Full name"
        />
        <Input
          type="email"
          value={setup.gitEmail}
          onChange={(e) => setup.setGitEmail(e.target.value)}
          placeholder="Email address"
        />
        <Button
          size="sm"
          onClick={setup.saveGitIdentity}
          disabled={!(setup.gitName.trim() && setup.gitEmail.trim())}
          loading={setup.saving}
        >
          Save Git Config
        </Button>
      </div>
    </div>
  );
}

export function VaultRow() {
  const { vaultInitialized, vaultLoading, vaultError, handleInitVault } = useVaultSetup();

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusDot status={vaultInitialized === true ? 'ok' : 'off'} size="md" />
          <span className="text-sm font-medium">Vault</span>
        </div>
        {vaultInitialized === false && (
          <Button variant="primary" size="sm" onClick={handleInitVault} loading={vaultLoading}>
            Initialize Vault
          </Button>
        )}
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        {vaultInitialized === true
          ? 'Passage-store ready at ~/.revealui/passage-store/'
          : vaultInitialized === false
            ? 'Vault not found — initialize to start managing secrets'
            : 'Checking vault...'}
      </p>
      <ErrorAlert message={vaultError} />
    </div>
  );
}

export function TailscaleRow() {
  const { status: tunnelStatus } = useTunnel();

  return (
    <SetupRow
      label="Tailscale"
      done={tunnelStatus?.running ?? false}
      doneText={`Connected — ${tunnelStatus?.ip ?? 'no IP'} (${tunnelStatus?.hostname ?? 'unknown'})`}
      pendingText="Tailscale not running — start it to enable VPN tunnel to your tailnet"
    />
  );
}

export function ProjectSetupRow() {
  const [done, setDone] = useState(() => localStorage.getItem(SETUP_DONE_KEY) === 'true');
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(SETUP_CMD);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const markDone = () => {
    localStorage.setItem(SETUP_DONE_KEY, 'true');
    setDone(true);
  };

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusDot status={done ? 'ok' : 'off'} size="md" />
          <span className="text-sm font-medium">Project Setup</span>
        </div>
        {!done && (
          <Button variant="ghost" size="sm" onClick={markDone}>
            Mark done
          </Button>
        )}
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        {done ? (
          'Environment variables configured.'
        ) : (
          <>Run in your project directory to configure Stripe, Postgres, and Blob credentials:</>
        )}
      </p>
      {!done && (
        <div className="mt-2 flex items-center gap-2">
          <code className="rounded bg-neutral-800 px-2 py-1 font-mono text-xs text-neutral-300">
            {SETUP_CMD}
          </code>
          <Button variant="ghost" size="sm" onClick={copy}>
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>
      )}
    </div>
  );
}
