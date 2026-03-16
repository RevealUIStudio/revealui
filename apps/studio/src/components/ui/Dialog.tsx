import type { ReactNode } from 'react';

const maxWidthMap = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
} as const;

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  actions?: ReactNode;
  maxWidth?: keyof typeof maxWidthMap;
}

export default function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  actions,
  maxWidth = 'md',
}: DialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div
        className={`w-full ${maxWidthMap[maxWidth]} rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            {description && <p className="mt-1 text-sm text-neutral-400">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-200"
            aria-label="Close"
          >
            <svg
              className="size-4"
              aria-hidden="true"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        {children && <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>}

        {/* Actions */}
        {actions && (
          <div className="flex items-center justify-end gap-3 border-t border-neutral-800 px-6 py-4">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
