import { Routes, useRouter } from '@revealui/router';
import { lazy, Suspense, useRef } from 'react';
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
const ShowcasePage = lazy(async () =>
  import('./routes/ShowcasePage').then((mod) => ({ default: mod.ShowcasePage })),
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

function ShowcaseRoute() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <ShowcasePage />
    </Suspense>
  );
}

export function App() {
  const router = useRouter();
  const registered = useRef(false);

  // Register routes synchronously during render (before first paint)
  // so Routes can match on the initial render  -  avoids flash of 404.
  if (!registered.current && router.getRoutes().length === 0) {
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
      { path: '/showcase', component: ShowcaseRoute },
      { path: '/showcase/*path', component: ShowcaseRoute },
    ]);
    registered.current = true;
  }

  return (
    <DocLayout>
      <Routes />
    </DocLayout>
  );
}
