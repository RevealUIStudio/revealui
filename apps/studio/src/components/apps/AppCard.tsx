import { open } from '@tauri-apps/plugin-shell'
import type { AppStatus } from '../../types'

interface AppCardProps {
  status: AppStatus
  isOperating: boolean
  onStart: () => void
  onStop: () => void
}

export default function AppCard({ status, isOperating, onStart, onStop }: AppCardProps) {
  const { app, running } = status

  const handleOpen = () => {
    open(app.url)
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block size-2 rounded-full ${running ? 'bg-green-500' : 'bg-neutral-600'}`}
          />
          <h3 className="text-sm font-medium">{app.display_name}</h3>
        </div>
        <span className="text-xs text-neutral-500">:{app.port}</span>
      </div>

      <p className="mt-1 text-xs text-neutral-500">
        {running ? `localhost:${app.port}` : 'Stopped'}
      </p>

      <div className="mt-3 flex gap-2">
        {running ? (
          <>
            <button
              type="button"
              onClick={handleOpen}
              className="rounded px-2.5 py-1 text-xs bg-orange-600 text-white transition-colors hover:bg-orange-500"
            >
              Open
            </button>
            <button
              type="button"
              onClick={onStop}
              disabled={isOperating}
              className="rounded px-2.5 py-1 text-xs bg-neutral-700 text-neutral-200 transition-colors hover:bg-neutral-600 disabled:opacity-50"
            >
              {isOperating ? 'Stopping...' : 'Stop'}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onStart}
            disabled={isOperating}
            className="rounded px-2.5 py-1 text-xs bg-neutral-700 text-neutral-200 transition-colors hover:bg-neutral-600 disabled:opacity-50"
          >
            {isOperating ? 'Starting...' : 'Start'}
          </button>
        )}
      </div>
    </div>
  )
}
