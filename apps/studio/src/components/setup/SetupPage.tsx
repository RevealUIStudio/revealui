import { open } from '@tauri-apps/plugin-shell'
import { useCallback, useEffect, useState } from 'react'
import { useSetup } from '../../hooks/use-setup'
import { useTunnel } from '../../hooks/use-tunnel'
import { vaultInit, vaultIsInitialized } from '../../lib/invoke'

/** Full-page version of setup — shown when navigating to the Setup page after first-run. */
export default function SetupPage() {
  const {
    status,
    loading,
    error,
    gitName,
    gitEmail,
    saving,
    mounting,
    saveGitIdentity,
    doMount,
    setGitName,
    setGitEmail,
    refresh,
  } = useSetup()

  const { status: tunnelStatus } = useTunnel()

  const [vaultInitialized, setVaultInitialized] = useState<boolean | null>(null)
  const [vaultLoading, setVaultLoading] = useState(false)
  const [vaultError, setVaultError] = useState<string | null>(null)

  const checkVault = useCallback(async () => {
    try {
      const initialized = await vaultIsInitialized()
      setVaultInitialized(initialized)
    } catch {
      setVaultInitialized(false)
    }
  }, [])

  useEffect(() => {
    checkVault()
  }, [checkVault])

  const handleInitVault = async () => {
    setVaultLoading(true)
    setVaultError(null)
    try {
      await vaultInit()
      setVaultInitialized(true)
    } catch (err) {
      setVaultError(err instanceof Error ? err.message : String(err))
    } finally {
      setVaultLoading(false)
    }
  }

  const openNixInstall = () => {
    open('https://nixos.org/download/')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Setup</h1>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="rounded-md bg-neutral-800 px-3 py-1.5 text-sm text-neutral-300 transition-colors hover:bg-neutral-700 disabled:opacity-50"
        >
          {loading ? 'Checking…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {/* WSL */}
        <SetupRow
          label="WSL"
          done={status?.wsl_running ?? false}
          doneText="Ubuntu running"
          pendingText="WSL not detected — install WSL from the Microsoft Store"
        />

        {/* Nix */}
        <SetupRow
          label="Nix"
          done={status?.nix_installed ?? false}
          doneText="Nix installed"
          pendingText="Nix not found in WSL"
          action={
            !status?.nix_installed ? (
              <button
                type="button"
                onClick={openNixInstall}
                className="rounded px-2.5 py-1 text-xs bg-neutral-700 text-neutral-200 transition-colors hover:bg-neutral-600"
              >
                Install Nix ↗
              </button>
            ) : null
          }
        />

        {/* DevPod */}
        <SetupRow
          label="DevPod"
          done={status?.devbox_mounted ?? false}
          doneText="Studio drive mounted"
          pendingText="Studio drive not mounted"
          action={
            !status?.devbox_mounted ? (
              <button
                type="button"
                onClick={doMount}
                disabled={mounting}
                className="rounded px-2.5 py-1 text-xs bg-orange-600 text-white transition-colors hover:bg-orange-500 disabled:opacity-50"
              >
                {mounting ? 'Mounting…' : 'Mount'}
              </button>
            ) : null
          }
        />

        {/* Git identity */}
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-4">
          <div className="mb-3 flex items-center gap-2">
            <StatusDot done={!!(status?.git_name && status?.git_email)} />
            <span className="text-sm font-medium">Git Identity</span>
          </div>
          <div className="space-y-2">
            <input
              type="text"
              value={gitName}
              onChange={(e) => setGitName(e.target.value)}
              placeholder="Full name"
              className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-100 placeholder-neutral-500 focus:border-orange-500 focus:outline-none"
            />
            <input
              type="email"
              value={gitEmail}
              onChange={(e) => setGitEmail(e.target.value)}
              placeholder="Email address"
              className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-100 placeholder-neutral-500 focus:border-orange-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={saveGitIdentity}
              disabled={saving || !gitName.trim() || !gitEmail.trim()}
              className="rounded px-3 py-1.5 text-sm bg-neutral-700 text-neutral-200 transition-colors hover:bg-neutral-600 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Git Config'}
            </button>
          </div>
        </div>

        {/* Vault */}
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StatusDot done={vaultInitialized === true} />
              <span className="text-sm font-medium">Vault</span>
            </div>
            {vaultInitialized === false && (
              <button
                type="button"
                onClick={handleInitVault}
                disabled={vaultLoading}
                className="rounded px-2.5 py-1 text-xs bg-orange-600 text-white transition-colors hover:bg-orange-500 disabled:opacity-50"
              >
                {vaultLoading ? 'Initializing…' : 'Initialize Vault'}
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            {vaultInitialized === true
              ? 'Passage-store initialized at ~/.revealui/passage-store/'
              : vaultInitialized === false
                ? 'Vault not found — initialize to start managing secrets'
                : 'Checking vault status…'}
          </p>
          {vaultError && <p className="mt-1 text-xs text-red-400">{vaultError}</p>}
        </div>

        {/* Tailscale */}
        <SetupRow
          label="Tailscale"
          done={tunnelStatus?.running ?? false}
          doneText={`Connected — ${tunnelStatus?.ip ?? 'no IP'} (${tunnelStatus?.hostname ?? 'unknown'})`}
          pendingText="Tailscale not running — start it to enable VPN tunnel to your tailnet"
        />

        {/* Project Setup */}
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3">
          <div className="flex items-center gap-2">
            <StatusDot done={false} />
            <span className="text-sm font-medium">Project Setup</span>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            Run{' '}
            <code className="rounded bg-neutral-800 px-1 py-0.5 font-mono text-neutral-300">
              pnpm setup
            </code>{' '}
            in your RevealUI project directory to configure environment variables (Stripe, Postgres,
            Blob).
          </p>
        </div>
      </div>
    </div>
  )
}

interface SetupRowProps {
  label: string
  done: boolean
  doneText: string
  pendingText: string
  action?: React.ReactNode
}

function SetupRow({ label, done, doneText, pendingText, action }: SetupRowProps) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusDot done={done} />
          <span className="text-sm font-medium">{label}</span>
        </div>
        {action}
      </div>
      <p className="mt-1 text-xs text-neutral-500">{done ? doneText : pendingText}</p>
    </div>
  )
}

function StatusDot({ done }: { done: boolean }) {
  return (
    <span
      className={`inline-flex size-4 items-center justify-center rounded-full text-xs ${
        done ? 'bg-green-600 text-white' : 'bg-neutral-700 text-neutral-400'
      }`}
    >
      {done ? '✓' : '○'}
    </span>
  )
}
