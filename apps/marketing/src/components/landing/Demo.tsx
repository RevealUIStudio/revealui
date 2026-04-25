import { ProductMockup } from '../ProductMockup';

const beats = [
  {
    n: '01',
    title: 'Spin up a stack.',
    body: 'One command. Auth, billing, content, admin UI, and agent layer running locally in 60 seconds.',
  },
  {
    n: '02',
    title: 'Real customer flow.',
    body: 'A user signs up, picks a plan, and pays. Stripe handles checkout. The admin UI shows the new account.',
  },
  {
    n: '03',
    title: 'Agent-native, by default.',
    body: 'A chat agent reads the customer, refunds the subscription, and writes a CMS post explaining why — same APIs.',
  },
];

export function Demo() {
  return (
    <section id="demo" className="bg-gray-50 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-gray-500">
            Watch it work
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
            From CLI to live business in 90 seconds.
          </h2>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            Three beats. No edits. The whole stack, end to end.
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-5xl">
          <div className="relative rounded-3xl bg-gray-950 p-2 ring-1 ring-gray-950/10 shadow-2xl">
            <div className="relative overflow-hidden rounded-2xl bg-white">
              <ProductMockup />
              {/* Play button overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-gray-950/30 backdrop-blur-[1px]">
                <button
                  type="button"
                  aria-label="Play 90-second demo"
                  className="group flex h-20 w-20 items-center justify-center rounded-full bg-white/95 shadow-xl ring-1 ring-white/40 transition hover:scale-105 hover:bg-white"
                >
                  <svg
                    className="h-8 w-8 translate-x-0.5 text-gray-950"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <title>Play</title>
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-gray-500">Recording coming soon.</p>
        </div>

        <div className="mx-auto mt-20 grid max-w-5xl grid-cols-1 gap-8 lg:grid-cols-3">
          {beats.map((b) => (
            <div key={b.n} className="rounded-2xl bg-white p-8 ring-1 ring-gray-950/5">
              <div className="font-mono text-xs font-semibold uppercase tracking-widest text-emerald-700">
                {b.n}
              </div>
              <h3 className="mt-3 text-lg font-semibold text-gray-950">{b.title}</h3>
              <p className="mt-3 text-sm leading-6 text-gray-600">{b.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
