'use client';

import type React from 'react';
import { createContext, use, useCallback, useEffect, useReducer, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../utils/cn.js';

type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info';

type Toast = {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
};

type ToastAction = { type: 'ADD'; toast: Toast } | { type: 'REMOVE'; id: string };

function toastReducer(state: Toast[], action: ToastAction): Toast[] {
  switch (action.type) {
    case 'ADD':
      return [...state, action.toast];
    case 'REMOVE':
      return state.filter((t) => t.id !== action.id);
  }
}

type ToastContextValue = {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, dispatch] = useReducer(toastReducer, []);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = crypto.randomUUID();
    dispatch({ type: 'ADD', toast: { ...toast, id } });
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    dispatch({ type: 'REMOVE', id });
  }, []);

  return (
    <ToastContext value={{ toasts, addToast, removeToast }}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(<ToastList toasts={toasts} onRemove={removeToast} />, document.body)}
    </ToastContext>
  );
}

export function useToast(): Pick<ToastContextValue, 'addToast' | 'removeToast'> {
  const ctx = use(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

const variantClasses: Record<ToastVariant, string> = {
  default: 'bg-white dark:bg-zinc-800 ring-zinc-950/10 dark:ring-white/10',
  success: 'bg-white dark:bg-zinc-800 ring-green-500/30',
  error: 'bg-white dark:bg-zinc-800 ring-red-500/30',
  warning: 'bg-white dark:bg-zinc-800 ring-amber-500/30',
  info: 'bg-white dark:bg-zinc-800 ring-blue-500/30',
};

const variantIconClasses: Record<ToastVariant, string> = {
  default: 'hidden',
  success: 'text-green-500',
  error: 'text-red-500',
  warning: 'text-amber-500',
  info: 'text-blue-500',
};

const variantIcons: Record<ToastVariant, string> = {
  default: '',
  success: '✓',
  error: '✕',
  warning: '!',
  info: 'i',
};

function ToastList({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="assertive"
      className="pointer-events-none fixed inset-0 z-50 flex flex-col items-end justify-end gap-2 p-4 sm:p-6"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

const EXIT_DURATION_MS = 150;

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const variant = toast.variant ?? 'default';
  const [isExiting, setIsExiting] = useState(false);

  const handleRemove = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => onRemove(toast.id), EXIT_DURATION_MS);
  }, [onRemove, toast.id]);

  // Auto-dismiss triggers exit animation instead of instant removal
  useEffect(() => {
    const duration = toast.duration ?? 5000;
    if (duration <= 0) return;
    const timer = setTimeout(handleRemove, duration);
    return () => clearTimeout(timer);
  }, [toast.duration, handleRemove]);

  return (
    <div
      role="alert"
      className={cn(
        'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl p-4 shadow-lg ring-1 transition-all duration-200',
        variantClasses[variant],
        isExiting
          ? 'translate-y-2 opacity-0'
          : 'translate-y-0 opacity-100 animate-[slide-in-from-bottom_200ms_ease-out]',
      )}
    >
      {variant !== 'default' && (
        <span className={cn('mt-0.5 text-sm font-bold', variantIconClasses[variant])}>
          {variantIcons[variant]}
        </span>
      )}
      <div className="flex-1">
        <p className="text-sm font-semibold text-zinc-950 dark:text-white">{toast.title}</p>
        {toast.description && (
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{toast.description}</p>
        )}
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={handleRemove}
        className="shrink-0 rounded-md text-zinc-400 hover:text-zinc-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:text-zinc-500 dark:hover:text-zinc-300"
      >
        <span aria-hidden="true">✕</span>
      </button>
    </div>
  );
}
