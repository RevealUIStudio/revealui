import { useStatusContext } from '../../hooks/use-status'
import StatusDot from '../ui/StatusDot'

export default function StatusBar() {
  const { system, mount, loading } = useStatusContext()

  return (
    <footer className="flex items-center gap-4 border-t border-neutral-800 bg-neutral-900 px-4 py-1.5 text-xs text-neutral-400">
      {loading ? (
        <span>Loading...</span>
      ) : (
        <>
          <StatusDot status={system?.wsl_running ? 'ok' : 'off'} />
          <span>WSL {system?.wsl_running ? 'Running' : 'Stopped'}</span>
          <span className="text-neutral-600">|</span>
          <span>Tier: {system?.tier ?? '?'}</span>
          <span className="text-neutral-600">|</span>
          <StatusDot status={mount?.mounted ? 'ok' : 'off'} />
          <span>Studio: {mount?.mounted ? 'Mounted' : 'Not Mounted'}</span>
        </>
      )}
    </footer>
  )
}
