import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  mono?: boolean;
}

export default function Input({
  label,
  hint,
  mono = false,
  id,
  className = '',
  ...props
}: InputProps) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className="mb-1 block text-xs font-medium text-neutral-400">
          {label}
          {hint && <span className="ml-1 text-neutral-500">({hint})</span>}
        </label>
      )}
      <input
        id={id}
        className={`w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-500 focus:border-orange-500 focus:outline-none ${mono ? 'font-mono' : ''} ${className}`}
        {...props}
      />
    </div>
  );
}
