import { Routes, useRouter } from '@revealui/router';
import { useRef } from 'react';
import { RootLayout } from './layouts/RootLayout';
import { ExplorerPage } from './routes/ExplorerPage';
import { HomePage } from './routes/HomePage';
import { TokenomicsPage } from './routes/TokenomicsPage';
import { WhitepaperPage } from './routes/WhitepaperPage';

export function App() {
  const router = useRouter();
  const registered = useRef(false);

  // Register routes synchronously during the first render so <Routes /> can
  // match on the initial paint — avoids a 404 flash. Mirrors apps/docs.
  if (!registered.current && router.getRoutes().length === 0) {
    router.registerRoutes([
      { path: '/', component: HomePage, meta: { title: 'RevealCoin (RVC)' } },
      {
        path: '/tokenomics',
        component: TokenomicsPage,
        meta: { title: 'Tokenomics — RevealCoin' },
      },
      { path: '/explorer', component: ExplorerPage, meta: { title: 'Explorer — RevealCoin' } },
      {
        path: '/whitepaper',
        component: WhitepaperPage,
        meta: { title: 'Whitepaper — RevealCoin' },
      },
    ]);
    registered.current = true;
  }

  return (
    <RootLayout>
      <Routes />
    </RootLayout>
  );
}
