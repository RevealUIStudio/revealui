import { PERSONA_CARD, PERSONA_SECTION } from '../../content/persona';

export function Persona() {
  return (
    <section className="bg-gray-50 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-gray-500">
            {PERSONA_SECTION.eyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
            {PERSONA_SECTION.heading}
          </h2>
        </div>

        <div className="mx-auto mt-16 max-w-3xl">
          <div className="rounded-2xl bg-white p-10 ring-1 ring-gray-950/5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
              {PERSONA_CARD.label}
            </p>
            <p className="mt-4 text-xl leading-8 italic text-gray-700">{PERSONA_CARD.quote}</p>

            <ul className="mt-10 space-y-4">
              {PERSONA_CARD.checklist.map((item) => (
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
          </div>

          <p className="mt-8 text-center text-sm text-gray-500">
            {PERSONA_CARD.footer.prefix}{' '}
            <span className="font-medium text-gray-700">{PERSONA_CARD.footer.sprawl}</span>{' '}
            {PERSONA_CARD.footer.sprawlNote}{' '}
            <span className="font-medium text-gray-700">{PERSONA_CARD.footer.studios}</span>{' '}
            {PERSONA_CARD.footer.studiosNote}
          </p>
        </div>
      </div>
    </section>
  );
}
