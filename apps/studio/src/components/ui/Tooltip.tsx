import type { ReactNode } from 'react';

const positionStyles = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
} as const;

export type TooltipPosition = keyof typeof positionStyles;

interface TooltipProps {
  content: string;
  position?: TooltipPosition;
  children: ReactNode;
}

export default function Tooltip({ content, position = 'top', children }: TooltipProps) {
  return (
    <div className="group relative inline-flex">
      {children}
      <div
        role="tooltip"
        className={`pointer-events-none absolute z-50 whitespace-nowrap rounded-md bg-neutral-800 px-2.5 py-1.5 text-xs text-neutral-200 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 ${positionStyles[position]}`}
      >
        {content}
      </div>
    </div>
  );
}
