import { Routes, useRouter } from '@revealui/router';
import { useRef } from 'react';
import { RootLayout } from './layouts/RootLayout';
import { HomePage } from './routes/HomePage';

export function App() {
  const router = useRouter();
  const registered = useRef(false);

  // Register routes synchronously during the first render so <Routes /> can
  // match on the initial paint — avoids a 404 flash. Mirrors apps/docs.
  if (!registered.current && router.getRoutes().length === 0) {
    router.registerRoutes([
      { path: '/', component: HomePage, meta: { title: 'RevealCoin (RVC)' } },
    ]);
    registered.current = true;
  }

  return (
    <RootLayout>
      <Routes />
    </RootLayout>
  );
}
