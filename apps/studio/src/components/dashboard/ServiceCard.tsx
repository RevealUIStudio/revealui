interface ServiceCardProps {
  title: string
  status: 'running' | 'stopped' | 'degraded'
  detail: string
}

const STATUS_COLORS = {
  running: 'bg-green-500',
  stopped: 'bg-neutral-600',
  degraded: 'bg-yellow-500',
} as const

export default function ServiceCard({ title, status, detail }: ServiceCardProps) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex items-center gap-2">
        <span className={`inline-block size-2.5 rounded-full ${STATUS_COLORS[status]}`} />
        <h3 className="text-sm font-medium text-neutral-200">{title}</h3>
      </div>
      <p className="mt-2 text-xs text-neutral-400">{detail}</p>
      <p className="mt-1 text-xs capitalize text-neutral-500">{status}</p>
    </div>
  )
}
