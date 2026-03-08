import type { ReactNode } from 'react'

interface PanelHeaderProps {
  title: string
  action?: ReactNode
}

export default function PanelHeader({ title, action }: PanelHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <h1 className="text-xl font-semibold">{title}</h1>
      {action}
    </div>
  )
}
