const projects = [
  {
    name: 'RevealUI',
    tagline: 'The native AI experience is Studio',
    description:
      'Desktop app (Tauri) for agent coordination, local inference via Ubuntu Inference Snaps, and multi-agent orchestration. Backend: users, content, products, payments, AI agents — all pre-wired.',
    license: 'MIT + Pro',
    icon: 'M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z',
    iconColor: 'text-emerald-400',
    href: 'https://github.com/RevealUIStudio/revealui',
  },
  {
    name: 'RevVault',
    tagline: 'Your secrets, locally encrypted',
    description:
      'Age-encrypted secret vault in Rust. Passage-compatible CLI, automated rotation engine, and Tauri desktop app. Credentials never leave your machine.',
    license: 'MIT CLI + Pro desktop',
    icon: 'M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z',
    iconColor: 'text-amber-400',
    href: 'https://github.com/RevealUIStudio/revvault',
  },
  {
    name: 'RevKit',
    tagline: 'One command, full environment',
    description:
      'Portable dev environment toolkit. Tiered WSL profiles, Docker orchestration, and the agent coordination protocol that Studio orchestrates.',
    license: 'MIT coordination + Max provisioning',
    icon: 'M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25Z',
    iconColor: 'text-cyan-400',
    href: 'https://github.com/RevealUIStudio/revkit',
  },
  {
    name: 'RevealCoin',
    tagline: 'Agents pay per task via HTTP 402',
    description:
      'Solana token for agent-native micropayments. Agents discover capabilities, authenticate, and pay per task — no accounts, no subscriptions. Powered by the x402 payment protocol.',
    license: 'Forge',
    icon: 'M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    iconColor: 'text-violet-400',
    href: undefined,
  },
];

export function EcosystemSection() {
  return (
    <section id="ecosystem" className="py-24 bg-gray-950 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-gray-400">
            The Ecosystem
          </p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Four projects, one mission
          </p>
          <p className="mt-4 text-base leading-7 text-gray-400">
            Each project stands alone. Together, they form a complete stack for building, securing,
            coordinating, and monetizing agentic software.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-4 lg:mx-0 lg:max-w-none lg:grid-cols-2">
          {projects.map((project) => {
            const content = (
              <div className="group flex flex-col rounded-2xl bg-gray-900 p-8 ring-1 ring-gray-800 hover:ring-gray-700 transition-all h-full">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-800 group-hover:bg-gray-700 transition-colors">
                    <svg
                      className={`h-5 w-5 ${project.iconColor}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <title>{project.name}</title>
                      <path strokeLinecap="round" strokeLinejoin="round" d={project.icon} />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">{project.name}</h3>
                    <p className="text-xs text-gray-400">{project.license}</p>
                  </div>
                </div>
                <p className="text-sm font-medium text-emerald-400 mb-2">{project.tagline}</p>
                <p className="text-sm leading-6 text-gray-400">{project.description}</p>
              </div>
            );

            if (project.href) {
              return (
                <a
                  key={project.name}
                  href={project.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  {content}
                </a>
              );
            }

            return <div key={project.name}>{content}</div>;
          })}
        </div>
      </div>
    </section>
  );
}
