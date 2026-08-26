import { Routes, useRouter } from '@revealui/router';
import { useRef } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SITE } from './content/site';
import { RootLayout } from './layouts/RootLayout';
import { ContactPage } from './routes/ContactPage';
import { CookiesPage } from './routes/CookiesPage';
import { HomePage } from './routes/HomePage';
import { MovedPage } from './routes/MovedPage';
import { NotFoundPage } from './routes/NotFoundPage';
import { PricingPage } from './routes/PricingPage';
import { PrivacyPage } from './routes/PrivacyPage';
import { ProductsPage } from './routes/ProductsPage';
import { RefundPolicyPage } from './routes/RefundPolicyPage';
import { StatusPage } from './routes/StatusPage';
import { SupportPage } from './routes/SupportPage';
import { TermsPage } from './routes/TermsPage';

const DOCS = SITE.urls.docs;

function moved(to: string) {
  return function MovedRoute() {
    return <MovedPage to={to} />;
  };
}

const MovedPhilosophy = moved(`${DOCS}/blog/01-why-we-built-revealui`);
const MovedLocalAi = moved(`${DOCS}/local-first`);
const MovedServices = moved('/pricing');
const MovedUpgrade = moved('https://admin.revealui.com/signup?plan=pro');
const MovedHowItWorks = moved(`${DOCS}/build-your-business`);
const MovedManaged = moved(`${DOCS}/roadmap`);
const MovedBlog = moved(`${DOCS}/blog/16-ui-of-the-future`);
const MovedFairSource = moved(`${DOCS}/fair-source`);
const MovedRoadmap = moved(`${DOCS}/roadmap`);
const MovedClaims = moved(DOCS);
const MovedSla = moved(`${DOCS}/sla`);
const MovedHipaa = moved(DOCS);
const MovedSecurity = moved(DOCS);
const MovedSubprocessors = moved(DOCS);

function MovedBlogPost() {
  return <MovedPage to={`${DOCS}/blog/16-ui-of-the-future`} />;
}

export function App() {
  const router = useRouter();
  const registered = useRef(false);

  // Register routes synchronously during the first render so <Routes /> can
  // match on the initial paint, avoiding a 404 flash. The /*notfound wildcard
  // MUST be registered last so it only matches when no specific route does.
  if (!registered.current && router.getRoutes().length === 0) {
    router.registerRoutes([
      { path: '/', component: HomePage, meta: { title: 'RevealUI' } },
      { path: '/products', component: ProductsPage, meta: { title: 'Products | RevealUI' } },
      {
        path: '/philosophy',
        component: MovedPhilosophy,
        meta: { title: 'Moved | RevealUI' },
      },
      {
        path: '/local-ai',
        component: MovedLocalAi,
        meta: { title: 'Moved | RevealUI' },
      },
      { path: '/pricing', component: PricingPage, meta: { title: 'Pricing | RevealUI' } },
      {
        path: '/upgrade',
        component: MovedUpgrade,
        meta: { title: 'Upgrade | RevealUI' },
      },
      {
        path: '/services',
        component: MovedServices,
        meta: { title: 'Moved | RevealUI' },
      },
      {
        path: '/for-operators',
        component: MovedServices,
        meta: { title: 'Moved | RevealUI' },
      },
      { path: '/blog', component: MovedBlog, meta: { title: 'Moved | RevealUI' } },
      { path: '/blog/:slug', component: MovedBlogPost, meta: { title: 'Moved | RevealUI' } },
      { path: '/contact', component: ContactPage, meta: { title: 'Contact | RevealUI' } },
      {
        path: '/fair-source',
        component: MovedFairSource,
        meta: { title: 'Moved | RevealUI' },
      },
      {
        path: '/for-operators/how-it-works',
        component: MovedHowItWorks,
        meta: { title: 'Moved | RevealUI' },
      },
      {
        path: '/for-operators/managed',
        component: MovedManaged,
        meta: { title: 'Moved | RevealUI' },
      },
      { path: '/roadmap', component: MovedRoadmap, meta: { title: 'Moved | RevealUI' } },
      {
        path: '/claims',
        component: MovedClaims,
        meta: { title: 'Moved | RevealUI' },
      },
      { path: '/privacy', component: PrivacyPage, meta: { title: 'Privacy Policy | RevealUI' } },
      { path: '/cookies', component: CookiesPage, meta: { title: 'Cookie Policy | RevealUI' } },
      {
        path: '/legal/hipaa',
        component: MovedHipaa,
        meta: { title: 'Moved | RevealUI' },
      },
      { path: '/terms', component: TermsPage, meta: { title: 'Terms of Service | RevealUI' } },
      { path: '/security', component: MovedSecurity, meta: { title: 'Moved | RevealUI' } },
      { path: '/support', component: SupportPage, meta: { title: 'Support | RevealUI' } },
      { path: '/sla', component: MovedSla, meta: { title: 'Moved | RevealUI' } },
      {
        path: '/refund-policy',
        component: RefundPolicyPage,
        meta: { title: 'Refund Policy | RevealUI' },
      },
      { path: '/status', component: StatusPage, meta: { title: 'Status | RevealUI' } },
      {
        path: '/legal/subprocessors',
        component: MovedSubprocessors,
        meta: { title: 'Moved | RevealUI' },
      },
      { path: '/*notfound', component: NotFoundPage, meta: { title: '404 | RevealUI' } },
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
