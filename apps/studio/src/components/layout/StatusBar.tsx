import { useStatusContext } from '../../hooks/use-status';
import StatusDot from '../ui/StatusDot';

/** Max characters for truncated error message in the status bar. */
const ERROR_TRUNCATE_LENGTH = 60;

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

export default function StatusBar() {
  const { system, mount, loading, error, refresh } = useStatusContext();

  return (
    <footer className="flex items-center gap-4 border-t border-neutral-800 bg-neutral-900 px-4 py-1.5 text-xs text-neutral-400">
      {error ? (
        <>
          <StatusDot status="error" pulse />
          <span className="text-red-400">{truncate(error, ERROR_TRUNCATE_LENGTH)}</span>
        </>
      ) : loading ? (
        <>
          <StatusDot status="warn" pulse />
          <span>Connecting...</span>
        </>
      ) : (
        <>
          <StatusDot status={system?.wsl_running ? 'ok' : 'off'} />
          <span>WSL {system?.wsl_running ? 'Running' : 'Stopped'}</span>
          <span className="text-neutral-600">|</span>
          <span>Tier: {system?.tier ?? '?'}</span>
          {system?.systemd_status ? (
            <>
              <span className="text-neutral-600">|</span>
              <span>systemd: {system.systemd_status}</span>
            </>
          ) : null}
          <span className="text-neutral-600">|</span>
          <StatusDot status={mount?.mounted ? 'ok' : 'off'} />
          <span>Studio: {mount?.mounted ? 'Mounted' : 'Not Mounted'}</span>
        </>
      )}
      <button
        type="button"
        className="ml-auto text-neutral-500 transition-colors hover:text-neutral-300"
        onClick={refresh}
        aria-label="Refresh status"
        title="Refresh status"
      >
        &#x21bb;
      </button>
    </footer>
  );
}
