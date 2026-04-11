import type { Metadata } from 'next';
import { ContactForm } from '@/components/ContactForm';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Contact  -  RevealUI',
  description:
    'Get in touch with the RevealUI team. Enterprise inquiries, partnership requests, and general questions.',
  openGraph: {
    title: 'Contact  -  RevealUI',
    description: 'Get in touch with the RevealUI team.',
    type: 'website',
  },
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white">
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-50 via-white to-gray-50 px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              Get in touch
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Questions about RevealUI? Interested in Enterprise or custom pricing? We would love to
              hear from you.
            </p>
          </div>

          <ContactForm />

          <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-3 text-center">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Community</h3>
              <p className="mt-2 text-sm text-gray-600">
                Join the conversation on{' '}
                <a
                  href="https://github.com/RevealUIStudio/revealui/discussions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-500 underline"
                >
                  GitHub Discussions
                </a>
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Support</h3>
              <p className="mt-2 text-sm text-gray-600">
                <a
                  href="mailto:support@revealui.com"
                  className="text-blue-600 hover:text-blue-500 underline"
                >
                  support@revealui.com
                </a>
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Bug Reports</h3>
              <p className="mt-2 text-sm text-gray-600">
                <a
                  href="https://github.com/RevealUIStudio/revealui/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-500 underline"
                >
                  GitHub Issues
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
