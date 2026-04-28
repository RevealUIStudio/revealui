type MilestoneStatus = 'current' | 'upcoming' | 'complete';

interface Milestone {
  phase: string;
  title: string;
  status: MilestoneStatus;
  items: string[];
}

const milestones: Milestone[] = [
  {
    phase: 'Phase 0',
    title: 'Foundation',
    status: 'current',
    items: [
      'Token-2022 mint deployed',
      'Allocations defined + custody-enforced vesting',
      'Metadata on Arweave',
      'On-chain vesting migration (in design)',
      'Multi-sig on mint authority (pending)',
    ],
  },
  {
    phase: 'Phase 1',
    title: 'Public Distribution',
    status: 'upcoming',
    items: [
      'Gated on: on-chain vesting + multi-sig complete',
      'Initial liquidity seeding',
      'Community channels + public communication',
    ],
  },
  {
    phase: 'Phase 2',
    title: 'Liquidity & Trading',
    status: 'upcoming',
    items: ['Raydium CPMM pool creation', 'Jupiter aggregator listing', 'Price oracle (TWAP)'],
  },
  {
    phase: 'Phase 3',
    title: 'Marketplace Integration',
    status: 'upcoming',
    items: [
      'RVC payments in RevealUI marketplace',
      'x402 micropayment protocol',
      'Creator earnings in RVC',
    ],
  },
  {
    phase: 'Phase 4',
    title: 'Governance',
    status: 'upcoming',
    items: [
      'Proposal creation & voting',
      'Treasury spend visibility',
      'Multi-sig authority transfer',
    ],
  },
];

const statusStyles = {
  complete: 'bg-emerald-500',
  current: 'bg-violet-500 animate-pulse',
  upcoming: 'bg-gray-300',
};

export function RoadmapSection() {
  return (
    <section className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-violet-600">Roadmap</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
            Building in the open
          </h2>
        </div>

        <div className="mx-auto mt-16 max-w-3xl">
          <div className="space-y-8">
            {milestones.map((milestone) => (
              <div key={milestone.phase} className="relative flex gap-6">
                {/* Timeline dot */}
                <div className="flex flex-col items-center">
                  <div className={`h-3 w-3 rounded-full ${statusStyles[milestone.status]}`} />
                  <div className="w-px flex-1 bg-gray-200" />
                </div>

                {/* Content */}
                <div className="pb-8">
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                    {milestone.phase}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-gray-950">{milestone.title}</h3>
                  <ul className="mt-3 space-y-2">
                    {milestone.items.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-sm text-gray-600">
                        {milestone.status === 'complete' ? (
                          <svg
                            className="h-4 w-4 shrink-0 text-emerald-500"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <title>Done</title>
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                        ) : (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gray-300" />
                        )}
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
