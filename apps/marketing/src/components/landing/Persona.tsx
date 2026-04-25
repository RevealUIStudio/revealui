const checklist = [
  'Drop in user accounts and orgs in five lines of config',
  'Wire Stripe billing without writing a single webhook handler',
  'Edit prompts and content through a real admin UI',
  'Expose every API to your agents via MCP, automatically',
];

export function Persona() {
  return (
    <section className="bg-gray-50 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-gray-500">
            Who it&apos;s for
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
            AI product teams shipping their first paid tier.
          </h2>
        </div>

        <div className="mx-auto mt-16 max-w-3xl">
          <figure className="rounded-2xl bg-white p-10 ring-1 ring-gray-950/5 shadow-sm">
            <svg
              className="h-8 w-8 text-emerald-500"
              fill="currentColor"
              viewBox="0 0 32 32"
              aria-hidden="true"
            >
              <title>Quote</title>
              <path d="M9.352 4C4.456 7.456 1 13.12 1 19.36c0 5.088 3.072 8.064 6.624 8.064 3.36 0 5.856-2.688 5.856-5.856 0-3.168-2.208-5.472-5.088-5.472-.576 0-1.344.096-1.536.192.48-3.264 3.552-7.104 6.624-9.024L9.352 4Zm16.512 0c-4.8 3.456-8.256 9.12-8.256 15.36 0 5.088 3.072 8.064 6.624 8.064 3.264 0 5.856-2.688 5.856-5.856 0-3.168-2.304-5.472-5.184-5.472-.576 0-1.248.096-1.44.192.48-3.264 3.456-7.104 6.528-9.024L25.864 4Z" />
            </svg>
            <blockquote className="mt-6 text-xl leading-8 font-medium text-gray-900">
              &ldquo;You have a working agent demo. Now you need accounts, billing, a CMS for
              prompts, and an admin UI &mdash; without spending Q2 on plumbing.&rdquo;
            </blockquote>

            <ul className="mt-10 space-y-4">
              {checklist.map((item) => (
                <li key={item} className="flex items-start gap-3 text-base text-gray-700">
                  <svg
                    className="mt-1 h-5 w-5 flex-shrink-0 text-emerald-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <title>Check</title>
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </figure>

          <p className="mt-8 text-center text-sm text-gray-500">
            Also a fit for <span className="font-medium text-gray-700">indie founders</span>{' '}
            shipping their first SaaS, and{' '}
            <span className="font-medium text-gray-700">agencies</span> building agent-augmented
            MVPs.
          </p>
        </div>
      </div>
    </section>
  );
}
