import { ProductMockup } from '../ProductMockup';

const beats = [
  {
    n: '01',
    title: 'Spin up a stack.',
    body: 'One command. Auth, content, admin UI, the Stripe webhook handler, and MCP server scaffolding all running locally in 60 seconds.',
  },
  {
    n: '02',
    title: 'Customer flow, end to end.',
    body: 'A user signs up, picks a plan, and Stripe test-mode checkout completes. The admin UI shows the new account. Switch to live mode when you are ready to take real money.',
  },
  {
    n: '03',
    title: 'Agent-native, by default.',
    body: 'Every primitive ships with a matching MCP server. Wire an LLM provider and your agents read customers, refund subscriptions, and write content through the same APIs your app uses.',
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
            From CLI to a working stack in 90 seconds.
          </h2>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            Three beats. Local in 60 seconds. Test-mode Stripe by default. Agents wired in via MCP.
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-5xl">
          <div className="relative rounded-3xl bg-gray-950 p-2 ring-1 ring-gray-950/10 shadow-2xl">
            <div className="relative overflow-hidden rounded-2xl bg-white">
              <ProductMockup />
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-gray-500">
            Local screenshot from a fresh{' '}
            <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-700">
              npx create-revealui
            </code>
            . The three beats below describe the steps.
          </p>
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
