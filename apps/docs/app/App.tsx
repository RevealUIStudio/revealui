import { Routes, useRouter } from '@revealui/router';
import { lazy, Suspense, useEffect } from 'react';
import { DocLayout } from './components/DocLayout';
import { LoadingSkeleton } from './components/LoadingSkeleton';

const HomePage = lazy(async () =>
  import('./routes/HomePage').then((mod) => ({ default: mod.HomePage })),
);
const ApiPage = lazy(async () =>
  import('./routes/ApiPage').then((mod) => ({ default: mod.ApiPage })),
);
const GuidesPage = lazy(async () =>
  import('./routes/GuidesPage').then((mod) => ({ default: mod.GuidesPage })),
);
const ProPage = lazy(async () =>
  import('./routes/ProPage').then((mod) => ({ default: mod.ProPage })),
);
const SectionPage = lazy(async () =>
  import('./routes/SectionPage').then((mod) => ({ default: mod.SectionPage })),
);

function RouteFallback() {
  return <LoadingSkeleton />;
}

function DocsRoute() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <SectionPage section="docs" title="Documentation" />
    </Suspense>
  );
}

function ApiRoute() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <ApiPage />
    </Suspense>
  );
}

function GuidesRoute() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <GuidesPage />
    </Suspense>
  );
}

function ProRoute() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <ProPage />
    </Suspense>
  );
}

export function App() {
  const router = useRouter();

  useEffect(() => {
    if (router.getRoutes().length > 0) return;

    router.registerRoutes([
      {
        path: '/',
        component: () => (
          <Suspense fallback={<RouteFallback />}>
            <HomePage />
          </Suspense>
        ),
      },
      { path: '/docs/*path', component: DocsRoute },
      { path: '/api/*path', component: ApiRoute },
      { path: '/guides/*path', component: GuidesRoute },
      { path: '/pro/*path', component: ProRoute },
    ]);
  }, [router]);

  return (
    <DocLayout>
      <Routes />
    </DocLayout>
  );
}
