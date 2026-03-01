import AppsPanel from '../apps/AppsPanel'
import DevBoxPanel from '../devbox/DevBoxPanel'

export default function InfrastructurePanel() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-4 text-base font-semibold text-neutral-300">DevBox</h2>
        <DevBoxPanel />
      </div>
      <div>
        <h2 className="mb-4 text-base font-semibold text-neutral-300">App Launcher</h2>
        <AppsPanel />
      </div>
    </div>
  )
}
