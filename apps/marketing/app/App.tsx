import { PRODUCT_BLOG_HOPS, studioBlogPostHref } from '@revealui/contracts/nav-docs-boundary';
import { Routes, useParams, useRouter } from '@revealui/router';
import { useRef } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SITE } from './content/site';
import { RootLayout } from './layouts/RootLayout';
import { routeHead } from './lib/route-heads';
import { useRouteMetaTitle } from './lib/use-route-meta-title';
import { ClaimsPage } from './routes/ClaimsPage';
import { ContactPage } from './routes/ContactPage';
import { CookiesPage } from './routes/CookiesPage';
import { HomePage } from './routes/HomePage';
import { MovedPage } from './routes/MovedPage';
import { NotFoundPage } from './routes/NotFoundPage';
import { PricingPage } from './routes/PricingPage';
import { PrivacyPage } from './routes/PrivacyPage';
import { ProductsPage } from './routes/ProductsPage';
import { RefundPolicyPage } from './routes/RefundPolicyPage';
import { SecurityPage } from './routes/SecurityPage';
import { StatusPage } from './routes/StatusPage';
import { SupportPage } from './routes/SupportPage';
import { TemplatesPage } from './routes/TemplatesPage';
import { TermsPage } from './routes/TermsPage';

const DOCS = SITE.urls.docs;

function moved(to: string) {
  return function MovedRoute() {
    return <MovedPage to={to} />;
  };
}

const MovedPhilosophy = moved(PRODUCT_BLOG_HOPS.philosophy);
const MovedLocalAi = moved(`${DOCS}/local-first`);
const MovedServices = moved('/pricing');
const MovedUpgrade = moved('https://admin.revealui.com/signup?plan=pro');
const MovedHowItWorks = moved(`${DOCS}/build-your-business`);
const MovedManaged = moved(`${DOCS}/roadmap`);
const MovedBlog = moved(PRODUCT_BLOG_HOPS.index);
const MovedFairSource = moved(`${DOCS}/fair-source`);
const MovedRoadmap = moved(`${DOCS}/roadmap`);
const MovedSla = moved(`${DOCS}/sla`);
function MovedHipaa() {
  return (
    <MovedPage
      to="/security"
      notice="A dedicated current HIPAA guide is not available here. Read our security disclosures and contact us about your deployment requirements."
    />
  );
}
function MovedSubprocessors() {
  return (
    <MovedPage
      to="/privacy"
      notice="A dedicated current subprocessor registry is not available here. Read our privacy disclosures and contact us for your procurement review."
    />
  );
}

function MovedBlogPost() {
  const { slug } = useParams<{ slug?: string }>();
  const to = slug ? studioBlogPostHref(slug) : PRODUCT_BLOG_HOPS.index;
  return <MovedPage to={to} />;
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
      {
        path: '/products',
        component: ProductsPage,
        meta: {
          title: routeHead('/products').title,
          description: routeHead('/products').description,
        },
      },
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
      {
        path: '/pricing',
        component: PricingPage,
        meta: {
          title: routeHead('/pricing').title,
          description: routeHead('/pricing').description,
        },
      },
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
      {
        path: '/contact',
        component: ContactPage,
        meta: {
          title: routeHead('/contact').title,
          description: routeHead('/contact').description,
        },
      },
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
        component: ClaimsPage,
        meta: {
          title: routeHead('/claims').title,
          description: routeHead('/claims').description,
        },
      },
      {
        path: '/privacy',
        component: PrivacyPage,
        meta: {
          title: routeHead('/privacy').title,
          description: routeHead('/privacy').description,
        },
      },
      {
        path: '/cookies',
        component: CookiesPage,
        meta: {
          title: routeHead('/cookies').title,
          description: routeHead('/cookies').description,
        },
      },
      {
        path: '/legal/hipaa',
        component: MovedHipaa,
        meta: { title: 'Moved | RevealUI' },
      },
      {
        path: '/terms',
        component: TermsPage,
        meta: {
          title: routeHead('/terms').title,
          description: routeHead('/terms').description,
        },
      },
      {
        path: '/security',
        component: SecurityPage,
        meta: {
          title: routeHead('/security').title,
          description: routeHead('/security').description,
        },
      },
      {
        path: '/support',
        component: SupportPage,
        meta: {
          title: routeHead('/support').title,
          description: routeHead('/support').description,
        },
      },
      { path: '/sla', component: MovedSla, meta: { title: 'Moved | RevealUI' } },
      {
        path: '/refund-policy',
        component: RefundPolicyPage,
        meta: {
          title: routeHead('/refund-policy').title,
          description: routeHead('/refund-policy').description,
        },
      },
      {
        path: '/status',
        component: StatusPage,
        meta: {
          title: routeHead('/status').title,
          description: routeHead('/status').description,
        },
      },
      {
        path: '/templates',
        component: TemplatesPage,
        meta: {
          title: routeHead('/templates').title,
          description: routeHead('/templates').description,
        },
      },
      {
        path: '/legal/subprocessors',
        component: MovedSubprocessors,
        meta: { title: 'Moved | RevealUI' },
      },
      { path: '/*notfound', component: NotFoundPage, meta: { title: '404 | RevealUI' } },
    ]);
    registered.current = true;
  }

  // After registerRoutes so the first match sees /templates (and other paths).
  useRouteMetaTitle();

  return (
    <ErrorBoundary>
      <RootLayout>
        <Routes />
      </RootLayout>
    </ErrorBoundary>
  );
}
