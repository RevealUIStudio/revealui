'use client';

import { Button } from '@revealui/presentation';
import { useState } from 'react';

function Bomb(): React.ReactNode {
  throw new Error('client render boom (dogfood)');
}

export function ErrorsClient(): React.ReactNode {
  const [explode, setExplode] = useState(false);

  return (
    <section style={{ marginTop: 24 }}>
      <h2>Client render throw</h2>
      <Button
        type="button"
        variant="danger"
        appearance="outline"
        size="sm"
        onClick={() => setExplode(true)}
        data-errors-client-boom=""
      >
        Throw in client tree
      </Button>
      {explode ? <Bomb /> : null}
    </section>
  );
}
