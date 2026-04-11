import { open } from '@tauri-apps/plugin-shell';
import { useCallback, useEffect, useState } from 'react';

const COPY_FEEDBACK_MS = 2_000;

import type { useSetup } from '../../hooks/use-setup';
import { useTunnel } from '../../hooks/use-tunnel';
import {
  inferenceSnapInstall,
  inferenceSnapList,
  terminalDetect,
  terminalInstall,
  vaultInit,
  vaultIsInitialized,
} from '../../lib/invoke';
import type { SnapModel, TerminalProfile } from '../../types';
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
      pendingText="WSL not detected  -  install WSL from the Microsoft Store"
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
            ? 'Vault not found  -  initialize to start managing secrets'
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
      pendingText="Tailscale not running  -  start it to enable VPN tunnel to your tailnet"
    />
  );
}

export function ProjectSetupRow() {
  const [done, setDone] = useState(() => localStorage.getItem(SETUP_DONE_KEY) === 'true');
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(SETUP_CMD);
    setCopied(true);
    setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
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

// ── Terminal profiles (Tauri-powered) ────────────────────────────────────────

function useTerminalProfiles() {
  const [profiles, setProfiles] = useState<TerminalProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const detect = useCallback(async () => {
    setLoading(true);
    try {
      const result = await terminalDetect();
      setProfiles(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to detect terminals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    detect();
  }, [detect]);

  const install = async (terminalId: string) => {
    setInstalling(terminalId);
    try {
      // In dev, configs are relative to CWD; in production, bundled with the app
      const repoConfigDir = 'config/terminal';
      const updated = await terminalInstall(terminalId, repoConfigDir);
      setProfiles((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to install profile');
    } finally {
      setInstalling(null);
    }
  };

  const allInstalled = profiles.length > 0 && profiles.every((p) => p.installed);

  return { profiles, loading, installing, error, install, allInstalled };
}

export function TerminalProfileRow() {
  const { profiles, loading, installing, error, install, allInstalled } = useTerminalProfiles();

  if (loading && profiles.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3">
        <div className="flex items-center gap-2">
          <StatusDot status="off" size="md" />
          <span className="text-sm font-medium">Terminal Profiles</span>
          <span className="text-xs text-neutral-500">Detecting terminals...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3">
      <div className="flex items-center gap-2">
        <StatusDot status={allInstalled ? 'ok' : 'off'} size="md" />
        <span className="text-sm font-medium">Terminal Profiles</span>
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        {allInstalled
          ? 'RevealUI color scheme installed for all detected terminals.'
          : 'Install the RevealUI dark theme for your terminal emulators.'}
      </p>
      {error && <ErrorAlert message={error} className="mt-2" />}
      {profiles.length === 0 && !loading && (
        <p className="mt-2 text-xs text-neutral-600">No supported terminal emulators detected.</p>
      )}
      {profiles.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {profiles.map((profile) => (
            <div key={profile.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block size-1.5 rounded-full ${
                    profile.installed ? 'bg-emerald-500' : 'bg-neutral-600'
                  }`}
                />
                <span className="text-xs text-neutral-300">{profile.name}</span>
              </div>
              {!profile.installed && profile.config_file && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={installing === profile.id}
                  onClick={() => install(profile.id)}
                >
                  {installing === profile.id ? 'Installing...' : 'Install'}
                </Button>
              )}
              {profile.installed && <span className="text-xs text-emerald-500">Installed</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Inference Snaps ─────────────────────────────────────────────────────────

function useInferenceSnaps() {
  const [models, setModels] = useState<SnapModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await inferenceSnapList();
      setModels(list);
    } catch {
      setModels([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const install = async (snapName: string) => {
    setInstalling(snapName);
    setError(null);
    try {
      const result = await inferenceSnapInstall(snapName);
      if (!result.success) {
        setError(result.message);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setInstalling(null);
    }
  };

  const hasAnyInstalled = models.some((m) => m.installed);

  return { models, loading, installing, error, install, hasAnyInstalled };
}

export function InferenceSnapsRow() {
  const { models, loading, installing, error, install, hasAnyInstalled } = useInferenceSnaps();
  const [copied, setCopied] = useState(false);
  const installCmd = 'sudo snap install nemotron-3-nano';

  const copyCmd = async () => {
    await navigator.clipboard.writeText(installCmd);
    setCopied(true);
    setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
  };

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusDot status={hasAnyInstalled ? 'ok' : 'off'} size="md" />
          <span className="text-sm font-medium">AI Inference</span>
        </div>
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        {loading
          ? 'Detecting inference snaps...'
          : hasAnyInstalled
            ? `${models.filter((m) => m.installed).length} model${models.filter((m) => m.installed).length === 1 ? '' : 's'} installed via Ubuntu Inference Snaps`
            : 'No inference snaps detected. Install one for local AI inference (recommended: nemotron-3-nano).'}
      </p>

      {!loading && (
        <div className="mt-3 space-y-2">
          {models.map((model) => (
            <div
              key={model.name}
              className="flex items-center justify-between rounded border border-neutral-700 bg-neutral-800/50 px-3 py-2"
            >
              <div>
                <span className="text-sm font-medium text-neutral-200">{model.name}</span>
                <p className="text-xs text-neutral-500">{model.description}</p>
              </div>
              {model.installed ? (
                <span className="text-xs font-medium text-green-400">Installed</span>
              ) : (
                <Button
                  size="sm"
                  onClick={() => install(model.name)}
                  loading={installing === model.name}
                  disabled={installing !== null}
                >
                  Install
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {!(hasAnyInstalled || loading) && (
        <div className="mt-2 flex items-center gap-2">
          <code className="rounded bg-neutral-800 px-2 py-1 font-mono text-xs text-neutral-300">
            {installCmd}
          </code>
          <Button variant="ghost" size="sm" onClick={copyCmd}>
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>
      )}

      <ErrorAlert message={error} />
    </div>
  );
}
