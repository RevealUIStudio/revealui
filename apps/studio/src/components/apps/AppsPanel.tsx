import { useApps } from '../../hooks/use-apps'
import Button from '../ui/Button'
import ErrorAlert from '../ui/ErrorAlert'
import PanelHeader from '../ui/PanelHeader'
import AppCard from './AppCard'

export default function AppsPanel() {
  const { apps, loading, error, operating, refresh, start, stop } = useApps()

  return (
    <div className="space-y-6">
      <PanelHeader
        title="App Launcher"
        action={
          <Button variant="secondary" onClick={refresh} loading={loading}>
            Refresh
          </Button>
        }
      />

      <ErrorAlert message={error} />

      {apps.length === 0 && loading && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-neutral-800/50" />
          ))}
        </div>
      )}

      {apps.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map((status) => (
            <AppCard
              key={status.app.name}
              status={status}
              isOperating={operating[status.app.name] ?? false}
              onStart={() => start(status.app.name)}
              onStop={() => stop(status.app.name)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
