import { Routes, useRouter } from '@revealui/router';
import { useRef } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { RootLayout } from './layouts/RootLayout';
import { AboutPage } from './routes/AboutPage';
import { ContactPage } from './routes/ContactPage';
import { HomePage } from './routes/HomePage';
import { NotFoundPage } from './routes/NotFoundPage';
import { ServicesPage } from './routes/ServicesPage';

export function App() {
  const router = useRouter();
  const registered = useRef(false);

  if (!registered.current && router.getRoutes().length === 0) {
    router.registerRoutes([
      { path: '/', component: HomePage, meta: { title: 'RevealUI Studio' } },
      {
        path: '/services',
        component: ServicesPage,
        meta: { title: 'Services — RevealUI Studio' },
      },
      { path: '/about', component: AboutPage, meta: { title: 'About — RevealUI Studio' } },
      { path: '/contact', component: ContactPage, meta: { title: 'Contact — RevealUI Studio' } },
      { path: '/*notfound', component: NotFoundPage, meta: { title: '404 — RevealUI Studio' } },
    ]);
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
