const principles = [
  {
    letter: 'J',
    word: 'Justifiable',
    description:
      "Every default earns its place. No magic, no hidden complexity, no decisions you can't explain to your team.",
    accent: 'text-emerald-600',
    border: 'border-emerald-500/30',
  },
  {
    letter: 'O',
    word: 'Orthogonal',
    description:
      "Clean separation of concerns across 25 packages. Use what you need, replace what you don't. Zero circular dependencies.",
    accent: 'text-cyan-600',
    border: 'border-cyan-500/30',
  },
  {
    letter: 'S',
    word: 'Sovereign',
    description:
      'Your infrastructure, your data, your rules. Deploy anywhere. Fork anything. No vendor holds your business hostage.',
    accent: 'text-violet-600',
    border: 'border-violet-500/30',
  },
  {
    letter: 'H',
    word: 'Hermetic',
    description:
      "Auth doesn't leak into billing. Content doesn't tangle with payments. Sealed boundaries, clean contracts between every layer.",
    accent: 'text-amber-600',
    border: 'border-amber-500/30',
  },
  {
    letter: 'U',
    word: 'Unified',
    description:
      'One Zod schema defines the truth. Types, validation, and API flow from database to server to UI with zero drift.',
    accent: 'text-rose-600',
    border: 'border-rose-500/30',
  },
  {
    letter: 'A',
    word: 'Adaptive',
    description:
      'AI agents, MCP servers, and workflows are built into the foundation. Open-model inference, sovereign by design, evolving with your business.',
    accent: 'text-blue-600',
    border: 'border-blue-500/30',
  },
];

export function JoshuaStack() {
  return (
    <section className="py-24 bg-[#fafafa] sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-gray-500">
            Philosophy
          </p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
            The JOSHUA Stack
          </p>
          <p className="mt-4 text-base leading-7 text-gray-500">
            Not the only way to build software, but a proven way. Six principles that give you a
            defensible starting point. Evolve them as your product grows.
          </p>
        </div>
        <div className="mx-auto mt-10 max-w-xs border-t border-gray-200" />

        <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2 lg:mx-0 lg:max-w-none lg:grid-cols-3">
          {principles.map((p) => (
            <div
              key={p.letter}
              className={`group flex flex-col rounded-2xl bg-gray-50 p-8 ring-1 ring-gray-200 hover:ring-gray-300 transition-all border-l-2 ${p.border}`}
            >
              <div className="mb-4 flex items-baseline gap-3">
                <span
                  className={`font-mono text-3xl font-bold ${p.accent} opacity-70 group-hover:opacity-100 transition-opacity`}
                >
                  {p.letter}
                </span>
                <h3 className="text-lg font-semibold text-gray-950">{p.word}</h3>
              </div>
              <p className="text-sm leading-6 text-gray-500">{p.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
