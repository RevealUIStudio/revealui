export function ContactPage() {
  return (
    <section className="bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-6">
        <h1 className="text-4xl font-bold tracking-tight text-gray-950 sm:text-5xl">Contact</h1>
        <p className="mt-6 text-lg text-gray-600">
          We respond within 1-2 business days. For engagement inquiries, mention the service tier
          you're interested in (Forge Stamp / Custom Build / AI Integration) and a one-line
          description of what you're trying to build.
        </p>
        <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
            <h2 className="text-lg font-semibold text-gray-950">Email</h2>
            <p className="mt-2 text-sm text-gray-600">For all inquiries:</p>
            <a
              href="mailto:founder@revealui.com"
              className="mt-3 inline-flex items-center font-semibold text-gray-950 hover:underline"
            >
              founder@revealui.com
            </a>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
            <h2 className="text-lg font-semibold text-gray-950">Discovery call</h2>
            <p className="mt-2 text-sm text-gray-600">30-minute scoping call, no commitment.</p>
            <p className="mt-3 text-sm text-gray-500">
              Booking link coming in Phase 2 — for now, email and we'll schedule manually.
            </p>
          </div>
        </div>
        <div className="mt-12 rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <p className="text-sm font-semibold text-amber-900">Phase 1 placeholder</p>
          <p className="mt-2 text-sm text-amber-800">
            The full contact form (Cal.com booking, topic-tagged inquiries, automated routing) ships
            in Phase 2. For now, plain email is the fastest path.
          </p>
        </div>
      </div>
    </section>
  );
}
