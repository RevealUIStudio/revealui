import type React from 'react'
import { cn } from '@/lib/styles/classnames'

export interface StatItem {
  label: string
  value: string
  icon?: string
}

export interface StatsBlockProps {
  className?: string
  style: 'info' | 'warning' | 'error' | 'success'
  stats: StatItem[]
  id?: number | null
  blockName?: string | null
  blockType: 'stats'
}

export const StatsBlock: React.FC<StatsBlockProps> = ({ className, stats, style }) => {
  return (
    <div className={cn('mx-auto my-8 w-full', className)}>
      <div
        className={cn('border py-3 px-6 flex flex-col items-center rounded', {
          'border-border bg-card': style === 'info',
          'border-error bg-error/30': style === 'error',
          'border-success bg-success/30': style === 'success',
          'border-warning bg-warning/30': style === 'warning',
        })}
      >
        <div className="grid grid-cols-2 gap-4">
          {stats.map((stat, index) => (
            <div key={index} className="stat-item flex items-center space-x-4">
              {stat.icon && <img src={stat.icon} alt={`${stat.label} icon`} className="h-8 w-8" />}
              <div>
                <p className="text-xl font-bold">{stat.value}</p>
                <p className="text-sm">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
