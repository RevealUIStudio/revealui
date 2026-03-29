import { cn, cva, type VariantProps } from '../utils/cn.js';

const badgeStyles = cva(
  'inline-flex items-center gap-1.5 rounded-md border text-xs font-medium transition-opacity hover:opacity-100',
  {
    variants: {
      size: {
        sm: 'px-2 py-1 text-[10px]',
        md: 'px-2.5 py-1.5 text-xs',
      },
      position: {
        'bottom-right': 'fixed bottom-4 right-4 z-40',
        'bottom-left': 'fixed bottom-4 left-4 z-40',
        'bottom-center': 'fixed bottom-4 left-1/2 -translate-x-1/2 z-40',
        inline: '',
      },
      colorScheme: {
        light: 'border-gray-200 bg-white/90 text-gray-500 opacity-75 backdrop-blur-sm',
        dark: 'border-gray-700 bg-gray-800/80 text-gray-300 opacity-90',
      },
    },
    defaultVariants: {
      size: 'sm',
      position: 'inline',
      colorScheme: 'light',
    },
  },
);

interface BuiltWithRevealUIProps extends VariantProps<typeof badgeStyles> {
  variant?: 'full' | 'logo';
  className?: string;
}

export function BuiltWithRevealUI({
  size,
  position,
  colorScheme,
  variant = 'full',
  className,
}: BuiltWithRevealUIProps) {
  return (
    <a
      href="https://revealui.com"
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        badgeStyles({ size, position, colorScheme }),
        'no-underline hover:no-underline',
        className,
      )}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect width="24" height="24" rx="4" fill="currentColor" fillOpacity="0.15" />
        <text x="12" y="16" textAnchor="middle" fill="currentColor" fontSize="12" fontWeight="700">
          R
        </text>
      </svg>
      {variant === 'full' && <span>Built with RevealUI</span>}
    </a>
  );
}
