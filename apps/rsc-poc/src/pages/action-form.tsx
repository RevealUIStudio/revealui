'use client';

import { useState } from 'react';

interface ActionFormProps {
  /** Server action — used as React 19 form `action` (JS + progressive enhancement). */
  action: (formData: FormData) => Promise<string>;
}

/**
 * Progressive-enhancement form (2.2.4 / ADR D2).
 * - With JS: React form actions → `x-rsc-action` flight path.
 * - Without JS: native POST → router `decodeFormAction` → HTML + formState.
 */
export function ActionForm({ action }: ActionFormProps): React.ReactNode {
  const [result, setResult] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function formAction(formData: FormData): Promise<void> {
    setPending(true);
    try {
      const res = await action(formData);
      setResult(res);
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <form action={formAction} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <input
          type="text"
          name="message"
          placeholder="Type a message"
          style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px' }}
        />
        <button type="submit" disabled={pending}>
          {pending ? 'Sending…' : 'Send to server'}
        </button>
      </form>
      {result !== null && (
        <div
          data-action-result=""
          style={{
            padding: '10px 14px',
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '4px',
          }}
        >
          {result}
        </div>
      )}
    </div>
  );
}
