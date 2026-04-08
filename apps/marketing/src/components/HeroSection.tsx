import { Badge, ButtonCVA } from '@revealui/presentation';
import { ProductMockup } from './ProductMockup';

const primitives = [
  {
    label: 'Users',
    icon: 'M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z',
  },
  {
    label: 'Content',
    icon: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z',
  },
  {
    label: 'Products',
    icon: 'M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z',
  },
  {
    label: 'Payments',
    icon: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z',
  },
  {
    label: 'Intelligence',
    icon: 'M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z',
  },
];

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-[#fafafa] px-6 pt-20 pb-12 sm:px-6 sm:pt-28 sm:pb-16 lg:px-8">
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />

      <div className="relative mx-auto max-w-7xl">
        {/* Headline block */}
        <div className="mx-auto max-w-3xl text-center mb-16">
          <Badge
            color="emerald"
            className="mb-6 gap-2 rounded-full px-4 py-1.5 ring-1 ring-emerald-200/80"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Open Source &middot; MIT Licensed
          </Badge>
          <p className="text-sm font-medium uppercase tracking-widest text-gray-500 mb-4 hero-stagger">
            Auth. Billing. Content. AI. Already wired together.
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-gray-950 sm:text-6xl lg:text-7xl hero-stagger">
            <span className="block">Ship Your SaaS,</span>
            <span className="block">Not Your</span>
            <span className="block">Infrastructure</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-xl font-semibold leading-8 text-gray-700">
            Build your business, not your boilerplate.
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-lg leading-8 text-gray-500">
            RevealUI is an open-source business runtime. Users, content, products, payments, and AI
            &mdash; five primitives, pre-wired into one deployable stack.
          </p>

          {/* Five primitives */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            {primitives.map((p) => (
              <Badge key={p.label} color="zinc" className="gap-2 rounded-lg px-4 py-2.5">
                <svg
                  className="h-4 w-4 text-gray-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <title>{p.label}</title>
                  <path strokeLinecap="round" strokeLinejoin="round" d={p.icon} />
                </svg>
                {p.label}
              </Badge>
            ))}
          </div>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <ButtonCVA asChild size="lg" className="w-full sm:w-auto">
              <a href="https://admin.revealui.com/signup">Get Started Free</a>
            </ButtonCVA>
            <ButtonCVA asChild variant="outline" size="lg" className="w-full sm:w-auto">
              <a href="https://docs.revealui.com" className="gap-1.5">
                View docs
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <title>Arrow</title>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                  />
                </svg>
              </a>
            </ButtonCVA>
          </div>

          {/* CLI quick-start */}
          <div className="mt-10 inline-flex items-center gap-3 rounded-xl bg-gray-950 px-5 py-3 font-mono text-sm shadow-lg ring-1 ring-white/10">
            <span className="select-none text-gray-400">$</span>
            <span className="text-emerald-400">npx</span>
            <span className="text-white">create-revealui@latest</span>
            <span className="text-blue-300">my-app</span>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-gray-500">
            {['MIT Licensed', 'Self-Hostable', 'No Vendor Lock-in', 'AI Built In'].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <svg className="h-4 w-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <title>Check</title>
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* Product mockup */}
        <div className="relative">
          <div className="absolute inset-0 -z-10 mx-auto max-w-5xl">
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#fafafa]" />
          </div>
          <ProductMockup />
        </div>
      </div>
    </section>
  );
}
