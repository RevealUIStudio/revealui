import Image from 'next/image';
import { cn } from '@/lib/styles/classnames';

export interface StatItem {
  label: string;
  value: string;
  icon?: string;
}

export interface StatsBlockProps {
  className?: string;
  style: 'info' | 'warning' | 'error' | 'success';
  stats: StatItem[];
  id?: number | null;
  blockName?: string | null;
  blockType: 'stats';
}

export const StatsBlock = ({ className, stats, style }: StatsBlockProps) => {
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
          {stats.map((stat) => (
            <div
              key={`${stat.label}-${stat.value}`}
              className="stat-item flex items-center space-x-4"
            >
              {stat.icon ? (
                <Image
                  src={stat.icon}
                  alt={`${stat.label} icon`}
                  width={32}
                  height={32}
                  className="h-8 w-8"
                  unoptimized
                />
              ) : null}
              <div>
                <p className="text-xl font-bold">{stat.value}</p>
                <p className="text-sm">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
