'use client';

import { useState } from 'react';

function Bomb(): React.ReactNode {
  throw new Error('client render boom (dogfood)');
}

export function ErrorsClient(): React.ReactNode {
  const [explode, setExplode] = useState(false);

  return (
    <section style={{ marginTop: 24 }}>
      <h2>Client render throw</h2>
      <button type="button" onClick={() => setExplode(true)} data-errors-client-boom="">
        Throw in client tree
      </button>
      {explode ? <Bomb /> : null}
    </section>
  );
}
