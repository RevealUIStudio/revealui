import { PRODUCT_BLOG_HOPS, studioBlogPostHref } from '@revealui/contracts/nav-docs-boundary';
import { Routes, useParams, useRouter } from '@revealui/router';
import { useRef } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SITE } from './content/site';
import { RootLayout } from './layouts/RootLayout';
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
          title: 'Products | RevealUI',
          description: 'Compare self-hosted RevealUI licenses and supported features.',
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
          title: 'Pricing | RevealUI',
          description:
            'Compare Free, Pro, Max, and perpetual licenses. Hosting and model usage are separate costs.',
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
          title: 'Contact | RevealUI',
          description:
            'Ask about a RevealUI license, product support, or your deployment requirements.',
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
          title: 'Claims and evidence | RevealUI',
          description:
            'Covered marketing statements and their cited evidence, with the limits of our automated checks.',
        },
      },
      {
        path: '/privacy',
        component: PrivacyPage,
        meta: {
          title: 'Privacy Policy | RevealUI',
          description:
            'How RevealUI collects and uses personal information, and how to contact us about your rights.',
        },
      },
      {
        path: '/cookies',
        component: CookiesPage,
        meta: {
          title: 'Cookie Policy | RevealUI',
          description: 'The cookies and optional analytics used on revealui.com.',
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
          title: 'Terms of Service | RevealUI',
          description:
            'RevealUI software and subscription terms. Review license and renewal conditions before purchasing.',
        },
      },
      {
        path: '/security',
        component: SecurityPage,
        meta: {
          title: 'Security | RevealUI',
          description:
            'RevealUI security disclosures, reporting contacts, and deployment responsibilities.',
        },
      },
      {
        path: '/support',
        component: SupportPage,
        meta: {
          title: 'Support | RevealUI',
          description:
            'How to get RevealUI product support, published response commitments, and scope.',
        },
      },
      { path: '/sla', component: MovedSla, meta: { title: 'Moved | RevealUI' } },
      {
        path: '/refund-policy',
        component: RefundPolicyPage,
        meta: {
          title: 'Refund Policy | RevealUI',
          description: 'RevealUI product refund conditions and how to request a refund.',
        },
      },
      {
        path: '/status',
        component: StatusPage,
        meta: {
          title: 'Status | RevealUI',
          description:
            'Check current API health endpoint reachability and read the limits of the check.',
        },
      },
      {
        path: '/templates',
        component: TemplatesPage,
        meta: {
          title: 'Templates | RevealUI',
          description:
            'Supported RevealUI templates and the configuration each starting point needs.',
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
