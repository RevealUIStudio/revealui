import { Routes, useRouter } from '@revealui/router';
import { useRef } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { RootLayout } from './layouts/RootLayout';
import { REVEALCOIN_PARKED, REVEALCOIN_RESUME_TARGET } from './lib/parked-config';
import { ExplorerPage } from './routes/ExplorerPage';
import { HomePage } from './routes/HomePage';
import { NotFoundPage } from './routes/NotFoundPage';
import { ParkedPage } from './routes/ParkedPage';
import { TokenomicsPage } from './routes/TokenomicsPage';
import { WhitepaperPage } from './routes/WhitepaperPage';

const PARKED_TITLE = `RevealCoin — Parked until ${REVEALCOIN_RESUME_TARGET}`;

export function App() {
  const router = useRouter();
  const registered = useRef(false);

  // Register routes synchronously during the first render so <Routes /> can
  // match on the initial paint — avoids a 404 flash. Mirrors apps/docs.
  // The `/*notfound` wildcard MUST be registered last so it only matches when
  // no specific route does.
  if (!registered.current && router.getRoutes().length === 0) {
    if (REVEALCOIN_PARKED) {
      // Parked: every route renders the parked notice. Historical pages
      // remain on disk so un-parking is a single-flag flip in
      // `lib/parked-config.ts` — see audit
      // ~/revfleet/.jv/docs/audits/2026-05-08-charge-readiness-deep-audit.md
      // §5 Phase 4 for the resumption preconditions.
      router.registerRoutes([
        { path: '/', component: ParkedPage, meta: { title: PARKED_TITLE } },
        { path: '/*notfound', component: ParkedPage, meta: { title: PARKED_TITLE } },
      ]);
    } else {
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
        { path: '/*notfound', component: NotFoundPage, meta: { title: '404 — RevealCoin' } },
      ]);
    }
    registered.current = true;
  }

  return (
    <ErrorBoundary>
      <RootLayout>
        <Routes />
      </RootLayout>
    </ErrorBoundary>
  );
}
