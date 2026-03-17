import { ButtonCVA } from '@revealui/presentation';

export function GetStarted() {
  return (
    <section className="py-24 bg-gray-950 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Ready to build?
          </h2>
          <p className="mt-6 text-lg leading-8 text-gray-400">
            Users, content, products, payments, and AI — pre-wired and ready to deploy. Start
            building your business in minutes.
          </p>
          <div className="mt-10">
            <ButtonCVA asChild size="lg">
              <a href="https://cms.revealui.com/signup">Get Started Free</a>
            </ButtonCVA>
          </div>
        </div>
      </div>
    </section>
  );
}
