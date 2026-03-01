import { useDevBox } from '../../hooks/use-devbox'
import { useStatus } from '../../hooks/use-status'
import DriveInfo from './DriveInfo'
import MountLog from './MountLog'

export default function DevBoxPanel() {
  const { mount, refresh } = useStatus()
  const { operating, log, error, mount: doMount, unmount: doUnmount } = useDevBox()

  const handleMount = async () => {
    await doMount()
    refresh()
  }

  const handleUnmount = async () => {
    await doUnmount()
    refresh()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">DevBox</h1>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleMount}
          disabled={operating || (mount?.mounted ?? false)}
          className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-500 disabled:opacity-50"
        >
          Mount
        </button>
        <button
          type="button"
          onClick={handleUnmount}
          disabled={operating || !(mount?.mounted ?? false)}
          className="rounded-md bg-neutral-700 px-4 py-2 text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-600 disabled:opacity-50"
        >
          Unmount
        </button>
        {operating && <span className="text-sm text-neutral-400">Working...</span>}
      </div>

      {error && (
        <div className="rounded-md border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {mount && <DriveInfo mount={mount} />}

      {log.length > 0 && <MountLog entries={log} />}
    </div>
  )
}
