import { useStatus } from '../../hooks/use-status'

export default function StatusBar() {
  const { system, mount, loading } = useStatus()

  return (
    <footer className="flex items-center gap-4 border-t border-neutral-800 bg-neutral-900 px-4 py-1.5 text-xs text-neutral-400">
      {loading ? (
        <span>Loading...</span>
      ) : (
        <>
          <StatusDot ok={system?.wsl_running ?? false} />
          <span>WSL {system?.wsl_running ? 'Running' : 'Stopped'}</span>
          <span className="text-neutral-600">|</span>
          <span>Tier: {system?.tier ?? '?'}</span>
          <span className="text-neutral-600">|</span>
          <StatusDot ok={mount?.mounted ?? false} />
          <span>Studio: {mount?.mounted ? 'Mounted' : 'Not Mounted'}</span>
        </>
      )}
    </footer>
  )
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block size-2 rounded-full ${ok ? 'bg-green-500' : 'bg-neutral-600'}`}
    />
  )
}
