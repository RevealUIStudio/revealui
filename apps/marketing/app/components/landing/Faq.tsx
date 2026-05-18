import { HOME_FAQ } from '../../content/home';

export function Faq() {
  return (
    <section className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-gray-500">
            {HOME_FAQ.eyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
            {HOME_FAQ.heading}
          </h2>
        </div>

        <div className="mx-auto mt-16 max-w-3xl divide-y divide-gray-200">
          {HOME_FAQ.items.map((item) => (
            <details key={item.question} className="group py-6">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-left">
                <h3 className="text-lg font-semibold leading-7 text-gray-950">{item.question}</h3>

                <span className="ml-2 mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-700 transition group-open:rotate-45 group-open:bg-emerald-50 group-open:text-emerald-700">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <title>Toggle</title>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </span>
              </summary>
              <div className="mt-4 pr-9 text-base leading-7 text-gray-600">{item.answer}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
