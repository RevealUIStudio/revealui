const faqs = [
  {
    q: 'How is this different from Supabase, Convex, Clerk, or Trigger?',
    a: 'Convex gives you real-time DB + functions. Supabase gives you Postgres + auth. Clerk gives you sessions. Trigger runs background jobs. Each one is a slice. RevealUI is the whole runtime — auth, content, billing, admin UI, and an agent layer governed by one RBAC policy and one tamper-evident audit chain. Self-hosted at every tier. (Vercel and Cloudflare are deploy targets, not competitors — RevealUI runs on both.)',
  },
  {
    q: 'Can I self-host?',
    a: 'Yes. 24 of 26 packages are MIT and stay MIT — forever. The 2 Pro packages are Fair Source (FSL-1.1-MIT) and auto-convert to MIT two years after each release. Self-host the entire stack on your own infra at any tier — no vendor-specific edge runtimes, no proprietary database.',
  },
  {
    q: 'What does "agent-native" actually mean in code?',
    a: 'Every collection is an MCP tool AND a REST endpoint AND a typed SDK call — gated by the same RBAC + ABAC policy. Agents are first-class principals: scope one to a collection, give it a budget, watch every action sign into the audit chain, revoke when done. The runtime is the contract, not a glue layer.',
  },
  {
    q: "What's the lock-in story?",
    a: 'Open standards, end-to-end. OAuth, JWT, Stripe webhooks, MCP, OpenAPI. Postgres for data. Deploy anywhere Next.js and Hono run — Vercel, Cloudflare, Railway, Hetzner, your own metal. Your data, your code, your infra. RevealUI is the runtime, not the prison.',
  },
  {
    q: 'Production-ready?',
    a: 'Behind a 3-phase CI gate: Biome lint, Vitest unit + integration, Playwright E2E, CodeQL, Gitleaks, claim-drift validator. Every PR runs the gate before it can land. The marketing site you are reading runs on @revealui/router and @revealui/presentation; the agency site at revealuistudio.com runs on the same packages. View the source on GitHub.',
  },
  {
    q: "What's the rest of RevFleet?",
    a: 'RevFleet is the umbrella. RevealUI is the runtime. RevVault encrypts secrets (CLI MIT, desktop Pro). RevDev is the engineering harness (multi-agent coordination across Claude / Cursor / Copilot). RevCon syncs editor configs. RevSkills is the skills library. RevForge is the operator-side stamping tool that produces white-label trial kits. RevealCoin is x402-compatible payments — deployed on Solana mainnet but pre-launch (see RevealCoin README for blockers). RevKit is the portable WSL dev environment. Use RevealUI standalone, or compose what you need.',
  },
  {
    q: 'How does AI inference work?',
    a: 'Bring your own model. Default ships open-weight (Llama 4, Gemma 3, Qwen 3, DeepSeek R1) via Ollama or Ubuntu Inference Snaps — your bill does not scale with usage. Switch to Claude, GPT, or any provider in one config line. The runtime is provider-agnostic; the default is sovereignty-friendly.',
  },
  {
    q: 'How do agent payments work?',
    a: "x402-native. RevealUI implements the HTTP 402 payment protocol — compatible with Amazon Bedrock AgentCore Payments, Coinbase, and Cloudflare's x402 Foundation. Agents pay agents over standard HTTP. RevealCoin is one optional Solana implementation; the protocol is what is load-bearing. RevealCoin itself is pre-launch — see the RevealCoin README for the open prerequisites.",
  },
];

export function Faq() {
  return (
    <section className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-gray-500">FAQ</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
            Common questions.
          </h2>
        </div>

        <div className="mx-auto mt-16 max-w-3xl divide-y divide-gray-200">
          {faqs.map((item) => (
            <details key={item.q} className="group py-6">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-left">
                <h3 className="text-lg font-semibold leading-7 text-gray-950">{item.q}</h3>
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
              <div className="mt-4 pr-9 text-base leading-7 text-gray-600">{item.a}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
