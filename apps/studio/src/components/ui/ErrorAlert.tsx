interface ErrorAlertProps {
  message: string | null | undefined
  className?: string
}

export default function ErrorAlert({ message, className = '' }: ErrorAlertProps) {
  if (!message) return null

  return (
    <div
      className={`rounded-md border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-400 ${className}`}
      role="alert"
    >
      {message}
    </div>
  )
}
