'use client';

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
      <button type="button" onClick={decrement}>
        -
      </button>
      <span>Count: {count}</span>
      <button type="button" onClick={increment}>
        +
      </button>
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
