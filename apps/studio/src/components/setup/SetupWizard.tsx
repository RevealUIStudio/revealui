import { open } from '@tauri-apps/plugin-shell'
import { markSetupComplete, useSetup } from '../../hooks/use-setup'

interface SetupWizardProps {
  onClose: () => void
}

export default function SetupWizard({ onClose }: SetupWizardProps) {
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
  } = useSetup()

  const handleComplete = () => {
    markSetupComplete()
    onClose()
  }

  const openNixInstall = () => {
    open('https://nixos.org/download/')
  }

  const allDone =
    status?.wsl_running &&
    status?.nix_installed &&
    status?.devbox_mounted &&
    !!status?.git_name &&
    !!status?.git_email

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-lg rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
          <h2 className="text-base font-semibold">Setup RevealUI Studio</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-200"
            aria-label="Close"
          >
            <svg
              className="size-4"
              aria-hidden="true"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-5">
          {loading && !status && (
            <p className="text-sm text-neutral-400">Checking environment...</p>
          )}

          {error && (
            <div className="rounded-md border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Step 1: WSL */}
          <SetupRow
            label="WSL"
            done={status?.wsl_running ?? false}
            doneText={`Ubuntu running`}
            pendingText="WSL not detected — install WSL from the Microsoft Store"
          />

          {/* Step 2: Nix */}
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

          {/* Step 3: DevBox */}
          <SetupRow
            label="DevBox"
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
                  {mounting ? 'Mounting...' : 'Mount'}
                </button>
              ) : null
            }
          />

          {/* Step 4: Git identity */}
          <div className="rounded-lg border border-neutral-800 bg-neutral-950/40 px-4 py-3">
            <div className="flex items-center gap-2">
              <StatusDot done={!!(status?.git_name && status?.git_email)} />
              <span className="text-sm font-medium">Git Identity</span>
            </div>
            <div className="mt-3 space-y-2">
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
                className="rounded px-3 py-1.5 text-xs bg-neutral-700 text-neutral-200 transition-colors hover:bg-neutral-600 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Git Config'}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-neutral-800 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm text-neutral-400 transition-colors hover:text-neutral-200"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={handleComplete}
            disabled={!allDone}
            className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Complete Setup
          </button>
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
    <div className="rounded-lg border border-neutral-800 bg-neutral-950/40 px-4 py-3">
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
