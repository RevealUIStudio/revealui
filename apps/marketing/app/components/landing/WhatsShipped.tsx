import { CAPABILITIES, CAPABILITIES_SECTION } from '../../content/capabilities';

export function WhatsShipped() {
  return (
    <section className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            {CAPABILITIES_SECTION.eyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
            {CAPABILITIES_SECTION.heading}
          </h2>
          <p className="mt-6 text-lg leading-8 text-gray-600">{CAPABILITIES_SECTION.body}</p>
        </div>

        <div className="mx-auto mt-16 grid max-w-6xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((c) => (
            <a
              key={c.path}
              href={c.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col rounded-2xl bg-gray-50 p-6 ring-1 ring-gray-200 no-underline transition hover:bg-white hover:ring-gray-950/10 hover:shadow-sm"
            >
              <h3 className="text-base font-semibold text-gray-950 group-hover:text-emerald-800">
                {c.title}
              </h3>
              <p className="mt-2 flex-1 text-sm leading-6 text-gray-600">{c.body}</p>
              <code className="mt-4 inline-block self-start rounded bg-white px-2 py-1 font-mono text-[11px] text-emerald-800 ring-1 ring-emerald-200 group-hover:bg-emerald-50">
                {c.path}
              </code>
            </a>
          ))}
        </div>

        <p className="mx-auto mt-10 max-w-2xl text-center text-xs text-muted-foreground">
          {CAPABILITIES_SECTION.footnote}
        </p>
      </div>
    </section>
  );
}
