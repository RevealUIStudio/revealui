export function AboutPage() {
  return (
    <section className="bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-6">
        <h1 className="text-4xl font-bold tracking-tight text-gray-950 sm:text-5xl">About</h1>
        <p className="mt-6 text-lg text-gray-600">
          RevealUI Studio is a Tennessee software studio building agent-first business systems
          on the open-source RevealUI runtime. We sell two things: stamped Forge deployments for
          customers who want a managed RevealUI instance, and bespoke engineering engagements for
          teams building something custom.
        </p>
        <div className="mt-12 rounded-2xl border border-gray-200 bg-gray-50 p-8">
          <h2 className="text-xl font-bold text-gray-950">Founder</h2>
          <p className="mt-3 text-gray-700">
            <strong>Joshua Vaughn</strong> — full-stack engineer, founder of RevealUI Studio. Built
            the open-source RevealUI platform (~31 packages, 2,400+ commits) before standing up
            the agency arm. Previously [bio placeholder — fill in].
          </p>
          <p className="mt-3 text-sm text-gray-600">
            Reach out at{' '}
            <a
              href="mailto:founder@revealui.com"
              className="font-semibold text-gray-950 hover:underline"
            >
              founder@revealui.com
            </a>
            .
          </p>
        </div>
        <div className="mt-12">
          <h2 className="text-xl font-bold text-gray-950">The Suite</h2>
          <p className="mt-3 text-gray-600">
            The Suite is the collection of software RevealUI Studio maintains:
          </p>
          <ul className="mt-4 grid grid-cols-1 gap-2 text-sm text-gray-700 sm:grid-cols-2">
            <li>
              <strong>RevealUI</strong> — the agent-first business runtime
            </li>
            <li>
              <strong>RevVault</strong> — secrets management
            </li>
            <li>
              <strong>Forge</strong> — enterprise / white-label tier
            </li>
            <li>
              <strong>RevealCoin</strong> — Solana token infrastructure
            </li>
            <li>
              <strong>RevCon</strong> — editor configurations
            </li>
            <li>
              <strong>RevDev</strong> — agent runtime + coordination
            </li>
            <li>
              <strong>RevSkills</strong> — Claude Code skills library
            </li>
            <li>
              <strong>RevKit</strong> — portable WSL dev kit
            </li>
          </ul>
          <p className="mt-4 text-sm text-gray-500">
            Most of the Suite is open source under MIT or Fair Source (FSL-1.1-MIT). Browse on{' '}
            <a
              href="https://github.com/RevealUIStudio"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-gray-950 hover:underline"
            >
              GitHub
            </a>{' '}
            or read the docs at{' '}
            <a
              href="https://docs.revealui.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-gray-950 hover:underline"
            >
              docs.revealui.com
            </a>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
