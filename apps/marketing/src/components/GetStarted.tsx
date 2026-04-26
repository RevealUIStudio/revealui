import { ButtonCVA } from '@revealui/presentation';
import { NewsletterSignup } from './NewsletterSignup';

export function GetStarted() {
  return (
    <section className="py-24 bg-gray-950 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Ready to build?
          </h2>
          <p className="mt-6 text-lg leading-8 text-gray-400">
            Users, content, products, payments, and AI, pre-wired. Start building locally in
            minutes; flip to live mode when you are ready.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <ButtonCVA asChild size="lg" className="bg-white text-gray-950 hover:bg-gray-100">
              <a href="https://admin.revealui.com/signup">Get Started Free</a>
            </ButtonCVA>
            <ButtonCVA
              asChild
              variant="outline"
              size="lg"
              className="border-gray-700 text-gray-300 hover:text-white hover:border-gray-500"
            >
              <a href="https://docs.revealui.com">
                Read the docs
                <svg
                  className="h-4 w-4 ml-1.5"
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

          {/* Newsletter */}
          <div className="mt-16 pt-10 border-t border-gray-800">
            <p className="text-sm font-medium text-gray-400 mb-4">
              Not ready to start? Get product updates and engineering insights.
            </p>
            <NewsletterSignup variant="stacked" />
          </div>
        </div>
      </div>
    </section>
  );
}
