import { Routes, useRouter } from '@revealui/router';
import { useRef } from 'react';
import { RootLayout } from './layouts/RootLayout';
import { BlogIndexPage } from './routes/BlogIndexPage';
import { BlogPostPage } from './routes/BlogPostPage';
import { ComingSoonPage } from './routes/ComingSoonPage';
import { ContactPage } from './routes/ContactPage';
import { FairSourcePage } from './routes/FairSourcePage';
import { HomePage } from './routes/HomePage';
import { MarketplacePage } from './routes/MarketplacePage';
import { PricingPage } from './routes/PricingPage';
import { PrivacyPage } from './routes/PrivacyPage';
import { ProductsPage } from './routes/ProductsPage';
import { ServicesPage } from './routes/ServicesPage';
import { SponsorPage } from './routes/SponsorPage';
import { TermsPage } from './routes/TermsPage';

export function App() {
  const router = useRouter();
  const registered = useRef(false);

  // Register routes synchronously during the first render so <Routes /> can
  // match on the initial paint — avoids a 404 flash. The /*notfound wildcard
  // is added in chunk 4 (after NotFoundPage ports).
  if (!registered.current && router.getRoutes().length === 0) {
    router.registerRoutes([
      { path: '/', component: HomePage, meta: { title: 'RevealUI' } },
      { path: '/products', component: ProductsPage, meta: { title: 'Products — RevealUI' } },
      { path: '/services', component: ServicesPage, meta: { title: 'Services — RevealUI' } },
      {
        path: '/marketplace',
        component: MarketplacePage,
        meta: { title: 'Marketplace — RevealUI' },
      },
      { path: '/pricing', component: PricingPage, meta: { title: 'Pricing — RevealUI' } },
      { path: '/blog', component: BlogIndexPage, meta: { title: 'Blog — RevealUI' } },
      { path: '/blog/:slug', component: BlogPostPage, meta: { title: 'Blog — RevealUI' } },
      { path: '/contact', component: ContactPage, meta: { title: 'Contact — RevealUI' } },
      {
        path: '/fair-source',
        component: FairSourcePage,
        meta: { title: 'Fair Source — RevealUI' },
      },
      {
        path: '/coming-soon',
        component: ComingSoonPage,
        meta: { title: 'Roadmap — RevealUI' },
      },
      { path: '/sponsor', component: SponsorPage, meta: { title: 'Sponsor — RevealUI' } },
      { path: '/privacy', component: PrivacyPage, meta: { title: 'Privacy Policy — RevealUI' } },
      { path: '/terms', component: TermsPage, meta: { title: 'Terms of Service — RevealUI' } },
    ]);
    registered.current = true;
  }

  return (
    <RootLayout>
      <Routes />
    </RootLayout>
  );
}
