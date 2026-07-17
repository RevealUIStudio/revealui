import { Routes, useRouter } from '@revealui/router';
import { useRef } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { RootLayout } from './layouts/RootLayout';
import { BlogIndexPage } from './routes/BlogIndexPage';
import { BlogPostPage } from './routes/BlogPostPage';
import { ClaimsPage } from './routes/ClaimsPage';
import { ContactPage } from './routes/ContactPage';
import { FairSourcePage } from './routes/FairSourcePage';
import { ForOperatorsHowItWorksPage } from './routes/ForOperatorsHowItWorksPage';
import { ForOperatorsManagedPage } from './routes/ForOperatorsManagedPage';
import { HomePage } from './routes/HomePage';
import { LocalAiPage } from './routes/LocalAiPage';
import { NotFoundPage } from './routes/NotFoundPage';
import { PhilosophyPage } from './routes/PhilosophyPage';
import { PricingPage } from './routes/PricingPage';
import { PrivacyPage } from './routes/PrivacyPage';
import { ProductsPage } from './routes/ProductsPage';
import { RefundPolicyPage } from './routes/RefundPolicyPage';
import { RoadmapPage } from './routes/RoadmapPage';
import { SecurityPage } from './routes/SecurityPage';
import { ServicesPage } from './routes/ServicesPage';
import { SlaPage } from './routes/SlaPage';
import { StatusPage } from './routes/StatusPage';
import { SubprocessorsPage } from './routes/SubprocessorsPage';
import { SupportPage } from './routes/SupportPage';
import { TermsPage } from './routes/TermsPage';

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
        component: PhilosophyPage,
        meta: { title: 'Why RevealUI exists | RevealUI' },
      },
      {
        path: '/local-ai',
        component: LocalAiPage,
        meta: { title: 'Local-first AI | RevealUI' },
      },
      { path: '/pricing', component: PricingPage, meta: { title: 'Pricing | RevealUI' } },
      {
        path: '/services',
        component: ServicesPage,
        meta: { title: 'Services | RevealUI Studio' },
      },
      { path: '/blog', component: BlogIndexPage, meta: { title: 'Blog | RevealUI' } },
      { path: '/blog/:slug', component: BlogPostPage, meta: { title: 'Blog | RevealUI' } },
      { path: '/contact', component: ContactPage, meta: { title: 'Contact | RevealUI' } },
      {
        path: '/fair-source',
        component: FairSourcePage,
        meta: { title: 'Fair Source | RevealUI' },
      },
      {
        path: '/for-operators/how-it-works',
        component: ForOperatorsHowItWorksPage,
        meta: { title: 'How it works | RevealUI Studio' },
      },
      {
        path: '/for-operators/managed',
        component: ForOperatorsManagedPage,
        meta: { title: 'RevealUI Cloud (roadmap) | RevealUI Studio' },
      },
      { path: '/roadmap', component: RoadmapPage, meta: { title: 'Roadmap | RevealUI' } },
      {
        path: '/claims',
        component: ClaimsPage,
        meta: { title: 'The claims ledger | RevealUI' },
      },
      { path: '/privacy', component: PrivacyPage, meta: { title: 'Privacy Policy | RevealUI' } },
      { path: '/terms', component: TermsPage, meta: { title: 'Terms of Service | RevealUI' } },
      { path: '/security', component: SecurityPage, meta: { title: 'Security | RevealUI' } },
      { path: '/support', component: SupportPage, meta: { title: 'Support | RevealUI' } },
      { path: '/sla', component: SlaPage, meta: { title: 'Service Level Commitments | RevealUI' } },
      {
        path: '/refund-policy',
        component: RefundPolicyPage,
        meta: { title: 'Refund Policy | RevealUI' },
      },
      { path: '/status', component: StatusPage, meta: { title: 'Status | RevealUI' } },
      {
        path: '/legal/subprocessors',
        component: SubprocessorsPage,
        meta: { title: 'Subprocessors | RevealUI' },
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
