const colorMap = {
  ok: 'bg-green-500',
  warn: 'bg-yellow-500',
  error: 'bg-red-500',
  off: 'bg-neutral-600',
} as const

const sizeMap = {
  sm: 'size-2',
  md: 'size-2.5',
} as const

interface StatusDotProps {
  status: keyof typeof colorMap
  size?: keyof typeof sizeMap
  pulse?: boolean
  className?: string
}

export default function StatusDot({
  status,
  size = 'sm',
  pulse = false,
  className = '',
}: StatusDotProps) {
  return (
    <span
      className={`inline-block shrink-0 rounded-full ${colorMap[status]} ${sizeMap[size]} ${pulse ? 'animate-pulse' : ''} ${className}`}
      aria-hidden="true"
    />
  )
}
