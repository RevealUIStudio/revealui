import { ServiceTeasers } from '../components/agency/ServiceTeasers';

export function ServicesPage() {
  return (
    <>
      <section className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-6">
          <h1 className="text-4xl font-bold tracking-tight text-gray-950 sm:text-5xl">Services</h1>
          <p className="mt-6 text-lg text-gray-600">
            Three productized lanes for working with RevealUI Studio. Pricing posted; scope
            adjustable; discovery call required.
          </p>
        </div>
      </section>
      <ServiceTeasers />
      <section className="bg-white py-16">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <p className="text-sm text-gray-500">
            Looking for something else?{' '}
            <a href="/contact" className="font-semibold text-gray-950 hover:underline">
              Get in touch
            </a>{' '}
            and we'll tell you whether we're the right fit.
          </p>
        </div>
      </section>
    </>
  );
}
