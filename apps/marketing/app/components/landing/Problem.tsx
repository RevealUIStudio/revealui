import { HOME_PROBLEM } from '../../content/home';

export function Problem() {
  return (
    <section className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-gray-500">
            {HOME_PROBLEM.eyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
            {HOME_PROBLEM.heading}
          </h2>
          <p className="mt-6 text-lg leading-8 text-gray-600">{HOME_PROBLEM.body}</p>
        </div>

        <div className="mx-auto mt-16 max-w-6xl overflow-hidden rounded-2xl ring-1 ring-gray-950/10 shadow-sm">
          <section
            // biome-ignore lint/a11y/noNoninteractiveTabindex: scrollable comparison table — axe-core scrollable-region-focusable requires tabIndex=0 so keyboard users can scroll horizontally on narrow viewports
            tabIndex={0}
            aria-label={HOME_PROBLEM.tableAriaLabel}
            className="overflow-x-auto"
          >
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs font-semibold uppercase tracking-widest text-gray-600">
                  <th scope="col" className="px-4 py-3 sm:px-6 sm:py-4">
                    {HOME_PROBLEM.columns.capability}
                  </th>
                  <th scope="col" className="px-4 py-3 sm:px-6 sm:py-4">
                    {HOME_PROBLEM.columns.sprawl}
                  </th>
                  <th scope="col" className="px-4 py-3 sm:px-6 sm:py-4">
                    {HOME_PROBLEM.columns.agentOnly}
                  </th>
                  <th
                    scope="col"
                    className="bg-emerald-50 px-4 py-3 text-emerald-800 sm:px-6 sm:py-4"
                  >
                    {HOME_PROBLEM.columns.revealui}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {HOME_PROBLEM.rows.map((r) => (
                  <tr key={r.capability} className="hover:bg-gray-50/60 transition">
                    <td className="px-4 py-4 font-medium text-gray-950 sm:px-6">{r.capability}</td>
                    <td className="px-4 py-4 text-gray-600 sm:px-6">{r.sprawl}</td>
                    <td className="px-4 py-4 text-gray-600 sm:px-6">{r.agentOnly}</td>
                    <td className="bg-emerald-50/40 px-4 py-4 font-medium text-emerald-900 sm:px-6">
                      {r.revealui}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>

        <p className="mx-auto mt-6 max-w-3xl text-center text-xs text-gray-500">
          {HOME_PROBLEM.footnote}
        </p>
      </div>
    </section>
  );
}
