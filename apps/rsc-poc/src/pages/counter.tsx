'use client';

import { Button } from '@revealui/presentation';
import { useState } from 'react';

export function Counter(): React.ReactNode {
  const [count, setCount] = useState(0);

  function decrement(): void {
    setCount((c) => c - 1);
  }

  function increment(): void {
    setCount((c) => c + 1);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <Button type="button" variant="neutral" appearance="outline" size="sm" onClick={decrement}>
        -
      </Button>
      <span>Count: {count}</span>
      <Button type="button" variant="neutral" appearance="outline" size="sm" onClick={increment}>
        +
      </Button>
    </div>
  );
}

export function CounterPage(): React.ReactNode {
  return (
    <div>
      <h1>Counter — Client Component</h1>
      <p>
        This component uses <code>useState</code> and runs in the browser. Clicking the buttons
        below proves hydration is working.
      </p>
      <Counter />
    </div>
  );
}
