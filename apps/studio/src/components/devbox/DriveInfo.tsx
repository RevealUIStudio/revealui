import type { MountStatus } from '../../types'

interface DriveInfoProps {
  mount: MountStatus
}

export default function DriveInfo({ mount }: DriveInfoProps) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <h2 className="text-sm font-medium text-neutral-200">Drive Info</h2>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-neutral-500">Status</dt>
        <dd className={mount.mounted ? 'text-green-400' : 'text-neutral-400'}>
          {mount.mounted ? 'Mounted' : 'Not Mounted'}
        </dd>
        <dt className="text-neutral-500">Mount Point</dt>
        <dd className="text-neutral-300">{mount.mount_point}</dd>
        {mount.device && (
          <>
            <dt className="text-neutral-500">Device</dt>
            <dd className="font-mono text-neutral-300">{mount.device}</dd>
          </>
        )}
        {mount.size_total && (
          <>
            <dt className="text-neutral-500">Total</dt>
            <dd className="text-neutral-300">{mount.size_total}</dd>
            <dt className="text-neutral-500">Used</dt>
            <dd className="text-neutral-300">
              {mount.size_used} ({mount.use_percent})
            </dd>
            <dt className="text-neutral-500">Available</dt>
            <dd className="text-neutral-300">{mount.size_available}</dd>
          </>
        )}
      </dl>
    </div>
  )
}
