type MilestoneStatus = 'complete' | 'shelved';

interface Milestone {
  phase: string;
  title: string;
  status: MilestoneStatus;
  items: string[];
}

const milestones: Milestone[] = [
  {
    phase: 'Phase 0',
    title: 'On-chain artifact (deployed)',
    status: 'complete',
    items: [
      'Token-2022 mint deployed on Solana mainnet-beta',
      'Allocations distributed to custody accounts (no claims executed)',
      'Metadata pinned on Arweave',
      'Freeze authority permanently renounced',
    ],
  },
  {
    phase: 'Phase 1+',
    title: 'All further phases — shelved',
    status: 'shelved',
    items: [
      'Multi-sig migration: scripted but not executed; deferred until revenue allows hardware-wallet operational security',
      'Public distribution: not planned by RevealUI Studio',
      'Raydium pool seeding / DEX listing: not planned by RevealUI Studio',
      'Marketplace RVC payments: not planned in the current scope',
      'Governance / treasury votes: not planned in the current scope',
      'Re-activation of any item above requires explicit owner approval, revenue runway, and legal review',
    ],
  },
];

const statusStyles = {
  complete: 'bg-emerald-500',
  shelved: 'bg-zinc-400',
};

export function RoadmapSection() {
  return (
    <section className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-zinc-600">Status</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
            What's deployed, what's shelved
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
