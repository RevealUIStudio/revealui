'use client';

import { useState, useTransition } from 'react';

interface ActionFormProps {
  action: (formData: FormData) => Promise<string>;
}

export function ActionForm({ action }: ActionFormProps): React.ReactNode {
  const [result, setResult] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await action(formData);
      setResult(res);
    });
  }

  return (
    <div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <input
          type="text"
          name="message"
          placeholder="Type a message"
          style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px' }}
        />
        <button type="submit" disabled={isPending}>
          {isPending ? 'Sending…' : 'Send to server'}
        </button>
      </form>
      {result !== null && (
        <div
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
