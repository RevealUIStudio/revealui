/**
 * GAP-467 P2: body prose units for the three newest live blog posts.
 * Generated from extractBlogMdProseUnits — re-run generator when bodies change.
 */
import type { ClaimEntry } from './types.js';

/** Slugs whose markdown body is under claims-evidence hard-fail (P2). */
export const BLOG_BODY_CLAIM_SLUGS = [
  'open-runtime-for-fde-work',
  'shareable-upside',
  'ui-of-the-future',
] as const;

export const blogBodyClaimsP2: readonly ClaimEntry[] = [
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.0',
    text: 'title: "The open runtime for forward-deployed agent work" description: "Demos die at the customer wall. Forward deployed work only finishes when the customer still owns the runtime after you leave." visibility: public status: narrative audience: user author: Joshua Vaughn',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 0',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#open-runtime-for-fde-work body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.1',
    text: 'Most agent software is easy to demo and hard to leave behind. The customer has a working prototype, a real data boundary, and one fair question: if you walk away, what do they still own?',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 1',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#open-runtime-for-fde-work body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.2',
    text: 'Palantir coined the title for the people who answer that in the field. The rest of the industry caught up. OpenAI, Anthropic, Google, Databricks, Salesforce, and a long line of vertical AI companies hire forward deployed engineers because demos do not deploy themselves. a16z called the same motion the hottest job in startups for a reason: complex AI needs implementation.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 2',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#open-runtime-for-fde-work body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.3',
    text: "Most of those teams still leave a vendor-owned stack. RevealUI is the self-hosted runtime built for a different handoff. Your business and the agents that run it live under one roof. Every agent is a governed and audited user that lives on your infrastructure. Studio's job is the forward-deployed practice on that runtime: stamp, wire, hand over, leave the keys.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 3',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#open-runtime-for-fde-work body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.4',
    text: 'The job is bigger than one company',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 4',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#open-runtime-for-fde-work body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.5',
    text: 'Palantir named the role. By 2026 the hiring market owns it. Labs, data platforms, vertical AI companies, defense tech, and consultancies all staff people whose job is to make agent demos survive real data, real compliance, and real operators.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 5',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#open-runtime-for-fde-work body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.6',
    text: 'The same work shows up under different badges: Forward Deployed Engineer, Applied AI Engineer, Deployment Engineer. Filter on the scenario, not the title. A working agent demo dies at the customer wall: their data, their cloud, their compliance fear, and the fair question of who owns the system when the embed ends.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 6',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#open-runtime-for-fde-work body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.7',
    text: 'The failure mode is a vendor stack you cannot keep',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 7',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#open-runtime-for-fde-work body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.8',
    text: 'Most of those hires still land customers on infrastructure the vendor controls. The embed "succeeds" when the customer renews the vendor. That is a legitimate business model. It is not the only success condition.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 8',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#open-runtime-for-fde-work body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.9',
    text: 'A different one: the deployer leaves a runtime the **customer** owns. The agents keep running after the visit. The data stays where the customer put it. The record of what agents did is something the customer can inspect.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 9',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#open-runtime-for-fde-work body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.10',
    text: 'What has to be true for handoff',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 10',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#open-runtime-for-fde-work body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.11',
    text: 'Five things, not a slogan:',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 11',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#open-runtime-for-fde-work body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.12',
    text: '**Customer-owned deploy.** The product runs on infrastructure they control, not only on a hosted demo tenant.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 12',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#open-runtime-for-fde-work body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.13',
    text: '**Business primitives already in the runtime.** Auth, content, offers, payments, and agents are not a greenfield rewrite per engagement.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 13',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#open-runtime-for-fde-work body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.14',
    text: '**Agents as governed users.** Same identity and policy surface as people, not shadow scripts with a private side channel.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 14',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#open-runtime-for-fde-work body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.15',
    text: "**A receipt path the customer can inspect.** If an agent did it, there's a receipt. Soft foil only: no certification claims; Merkle root *delivery* is Max+; verification is never paid.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 15',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#open-runtime-for-fde-work body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.16',
    text: '**Provider choice.** The model is not the lock-in. Closed APIs stay opt-in adapters.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 16',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#open-runtime-for-fde-work body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.17',
    text: 'If any of those are missing, the handoff is a laptop dependency with a nicer name.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 17',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#open-runtime-for-fde-work body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.18',
    text: 'Owner-operators who *are* their own forward-deployed person',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 18',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#open-runtime-for-fde-work body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.19',
    text: "Independent deployers and small studios who will never be a lab's FDE headcount but do the same job",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 19',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#open-runtime-for-fde-work body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.20',
    text: 'Agencies and MSPs who productize the motion for clients',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 20',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#open-runtime-for-fde-work body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.21',
    text: 'Who this is not for: six-month enterprise POCs that need a certification stamp before a first install. That path exists elsewhere. It is not the first-mile product.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 21',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#open-runtime-for-fde-work body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.22',
    text: 'What Studio ships into the field',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 22',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#open-runtime-for-fde-work body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.23',
    text: 'RevealUI Studio productizes the motion on the runtime: Architecture Review, Fleet deployment, Custom Build, and related fixed-bid work. The product noun stays **runtime**. The homepage is for owner-operators who run their own business on it. Forward-deployed delivery is how field work enters, not a rename of the product.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 23',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#open-runtime-for-fde-work body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.24',
    text: 'You can read the runtime, run it, and check the claims against code. Used in production by the team that maintains it. That is the only production claim this post makes.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 24',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#open-runtime-for-fde-work body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.25',
    text: 'The industry already decided last-mile humans matter. The open question is what they leave behind.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 25',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#open-runtime-for-fde-work body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.26',
    text: "RevealUI's answer: a customer-owned runtime where your business and the agents that run it live under one roof, and every agent is a user with a receipt trail you can check.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 26',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#open-runtime-for-fde-work body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.27',
    text: 'Start with the source: [github.com/RevealUIStudio/revealui](https://github.com/RevealUIStudio/revealui). Or start a conversation about a fixed-bid engagement at [revealuistudio.com](https://revealuistudio.com).',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 27',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#open-runtime-for-fde-work body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.0',
    text: 'title: "I Built This So More People Could Own the Upside of AI" description: "AI is splitting outcomes. I spent the longer path building a self-hosted runtime so more people could own the tools, not only rent them." visibility: public status: narrative audience: user author: Joshua Vaughn',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 0' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#shareable-upside body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.1',
    text: 'I spent about ten years managing and training people in AT&T and T-Mobile authorized retail. High volume. Real customers. Teams that had to show up and perform whether the systems cooperated or not. That job taught me something software culture often forgets: if you cannot hand a system off to someone else and have it still work, you did not finish.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 1' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#shareable-upside body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.2',
    text: 'In 2019 I started teaching myself to code while running my own businesses. I was not chasing a credential. I was trying to stop renting every critical piece of a company from someone else. I built a fleet of software that began as a full-stack framework for multi-product businesses: the boring, load-bearing parts that every product needs before the product is allowed to exist.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 2' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#shareable-upside body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.3',
    text: 'Then generative AI stopped being a demo and started being a force that rewrites work. I could have bolted a chat box onto what I already had and called it a day. I did not. I rebuilt the fleet for that future. The result is RevealUI: a self-hosted runtime where your business and the AI agents that run it live under one roof. Every agent is a governed and audited user that lives on your infrastructure.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 3' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#shareable-upside body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.4',
    text: "If an agent did it, there's a receipt.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 4' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#shareable-upside body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.5',
    text: 'The split I refuse to ignore',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 5' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#shareable-upside body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.6',
    text: 'AI is advancing fast enough that outcomes are splitting. Some people will own the tools, the infrastructure, and the upside. Many will not. Economists call shapes like that K-shaped. You do not need a chart to feel it. You only need to watch who gets leverage from new models and who gets automated past without a path up.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 6' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#shareable-upside body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.7',
    text: "I did not want my life's work to be a private machine that makes me rich while that split widens. I wanted what I learned to be shareable and usable. Not a TED talk. Not a thread of advice with no floor under it. A system people can run.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 7' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#shareable-upside body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.8',
    text: 'That is why the extra years went into the fleet instead of the shortest path to a closed product and a quiet exit. Open and fair-source packages. Self-host on infrastructure you control. Provider choice so the model is not the lock-in. A studio practice built to deploy and hand off, not to keep you dependent forever.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 8' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#shareable-upside body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.9',
    text: 'I am still allowed to make a living. Paid work and public work can fund each other. The point is not purity theater. The point is that the default shape of the thing is shareable.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 9' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#shareable-upside body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.10',
    text: 'I will be direct. I do not have a wall of famous logos to hide behind. The honest stage of this work is: the code is real, the thesis is lived, and the commercial proof is still being earned. So yes, there is a leap of faith.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 10' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#shareable-upside body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.11',
    text: 'The leap is not "trust me forever." The leap is "give the work a fair look." Read the repo. Run what you can. Ask hard questions. If the craft holds, take the next step. If it does not, walk away. I would rather lose you on the merits than keep you with marketing.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 11' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#shareable-upside body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.12',
    text: 'What I will not do is pretend a slogan is the same as a handoff. Mission without a runnable path is a speech. Mission with a runnable path is an invitation.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 12' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#shareable-upside body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.13',
    text: 'What "shareable" means in practice',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 13' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#shareable-upside body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.14',
    text: 'Shareable is not a feeling. It is a set of choices.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 14' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#shareable-upside body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.15',
    text: '**You can read it.** Source is public for the open packages. Pro packages are fair source with a path that does not pretend secrecy is the product.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 15' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#shareable-upside body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.16',
    text: '**You can run it.** The runtime is meant to live on infrastructure you own or control, not only as a rented dashboard you cannot move.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 16' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#shareable-upside body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.17',
    text: '**You can choose the model.** Closed APIs are adapters. The business runtime should not die when a vendor changes a price or a policy.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 17' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#shareable-upside body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.18',
    text: "**You can be left with it.** RevealUI Studio's job, when you hire us, is forward-deployed in spirit: stamp, wire, train, hand over. You keep the runtime. I spent a decade training people in retail. I know what unfinished training looks like. I do not want to sell unfinished training with a prettier UI.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 18' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#shareable-upside body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.19',
    text: '**Agents are not a side script.** They are users of the same business system, with policy and a trail you can check. That is the only way "AI runs part of the business" stays something a human can supervise.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 19' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#shareable-upside body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.20',
    text: 'If you are a technical founder or a small team that wants to run your business and your agents on something you own, this is for you.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 20' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#shareable-upside body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.21',
    text: 'If you deploy systems for other people (the industry now calls that forward deployed work, under several job titles), this is a substrate you can leave behind when the engagement ends.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 21' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#shareable-upside body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.22',
    text: 'If you only want a magic button that prints money with no learning, this is not for you. The upward side of a K-shaped curve still requires a leap and then work. I can remove the false choice between "learn alone with nothing" and "rent everything forever." I cannot remove effort.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 22' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#shareable-upside body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.23',
    text: 'Retail manager and trainer for about a decade. Self-taught engineer from 2019 while running businesses. Builder of a software fleet that started as a full-stack framework and was rebuilt for the agent era. Founder of RevealUI Studio. Someone who wants more people on the upward side of what AI is doing to the economy, and who is willing to put years into a shareable system instead of only extracting the upside for himself.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 23' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#shareable-upside body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.24',
    text: 'Product: [revealui.com](https://revealui.com)',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 24' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#shareable-upside body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.25',
    text: 'Code: [github.com/RevealUIStudio/revealui](https://github.com/RevealUIStudio/revealui)',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 25' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#shareable-upside body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.26',
    text: 'Studio: [revealuistudio.com](https://revealuistudio.com)',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 26' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#shareable-upside body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.27',
    text: 'If it earns your trust, take the leap. Host it. Break it. Tell me where it fails. Hire the studio if you want a hand with the last mile. Or build on your own with the same discipline of putting real systems in real hands. The goal is not that every path runs through me. The goal is that more people own the upside.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 27' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#shareable-upside body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.28',
    text: 'I built this so you could keep the runtime.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 28' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#shareable-upside body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.0',
    text: 'title: "The UI of the Future Has Yet to Reveal Itself" description: "The interface of the AI era is not a smarter chat window. It is your business itself, run by agents you own." visibility: public status: narrative audience: user author: Joshua Vaughn',
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 0' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#ui-of-the-future body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.1',
    text: 'Everyone in software is asking the same question right now. What does the interface of the AI era look like? The industry keeps answering with variations of a chat window. A sidebar copilot. An autocomplete that got ambitious. A bot in the corner of a screen that was designed for clicking.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 1' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#ui-of-the-future body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.2',
    text: 'I think those are all wrong, and I think they are wrong in the same way. They assume the interface of the future is still a place where you go to do the work.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 2' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#ui-of-the-future body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.3',
    text: 'Here is my thesis. The UI of the future is not a screen. It is your business itself. You express what you want. A workforce of agents operates the machinery: the content, the offers, the payments, the follow-ups, the bookkeeping of it all. What you look at is not forms and dashboards. What you look at is outcomes, and the receipts that prove how they happened. The interface stops being where you do the work and becomes where you direct it and where you verify it.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 3' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#ui-of-the-future body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.4',
    text: 'That interface has not revealed itself yet. Not because the models are too weak. Because two preconditions are missing almost everywhere, and nobody wants to say it plainly.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 4' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#ui-of-the-future body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.5',
    text: 'I did not come to this the traditional way. Before software I spent ten years as a business manager and trainer, watching industries change and watching what happened to the products and people who refused to change with them. When I made the jump to engineering I taught myself, and then I started building the tool I wished had existed when I set out: a batteries-included full-stack framework whose education modules were built from its own codebase, a bootcamp that taught you the source from data structures and algorithms all the way up to the abstractions of the libraries and frameworks on top.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 5' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#ui-of-the-future body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.6',
    text: 'The month I finished it, the first LLMs hit the general market. I watched where the money was going and understood immediately that the industry had made a decisive pivot, and that radical acceptance was the best path forward. So I rewrote everything around what LLMs do to the software development lifecycle. The problem I wanted to solve did not change. The solution did.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 6' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#ui-of-the-future body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.7',
    text: 'I kept hearing leaders at the top AI companies say some version of the same thing in interviews: we cannot do what we set out to do and also handle the disruption of the markets we are creating, but somebody definitely should. I decided to be one of those people. I wanted to make a tool that does not require you to know as much as an engineer to use it, but that enhances an engineer at the same time. RevealUI is my way of helping people change as fast as this industry does.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 7' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#ui-of-the-future body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.8',
    text: 'The first precondition is proof',
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 8' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#ui-of-the-future body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.9',
    text: 'If agents are going to run real parts of a real business, "trust me" is not an answer. You would never hire an employee who refused to tell you what they did with your money and your customers. An agent should be held to the same standard, and it should be held to it structurally, not politely.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 9' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#ui-of-the-future body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.10',
    text: 'That means every agent is a governed and audited user that lives on your infrastructure. It gets an identity like a person. It gets permissions like a person. And every action it takes can land in a signed record you can check offline.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 10' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#ui-of-the-future body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.11',
    text: "If an agent did it, there's a receipt.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 11' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#ui-of-the-future body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.12',
    text: 'That standard carries more weight than any benchmark. A business you cannot inspect is a business you do not control, no matter how impressive the demo was.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 12' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#ui-of-the-future body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.13',
    text: 'The second precondition is ownership',
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 13' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#ui-of-the-future body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.14',
    text: "Almost every agent you can buy today lives in someone else's cloud. Your data goes to their servers. The memory your agents build up belongs to their product. The record of what happened is theirs to keep, theirs to price, and theirs to lose. You are not building a workforce. You are renting one, seat by seat, and the landlord can change the terms whenever it likes.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 14' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#ui-of-the-future body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.15',
    text: "You cannot build a life's work on a rented workforce.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 15' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#ui-of-the-future body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.16',
    text: 'So the second precondition is that the whole thing lives under your roof. RevealUI is the self-hosted runtime where your business and the AI agents that run it live under one roof. It runs on any AI provider you choose, including models on your own hardware, because the point of owning your business is not conditional on which lab shipped the best weights this quarter.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 16' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#ui-of-the-future body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.17',
    text: 'What this actually unlocks',
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 17' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#ui-of-the-future body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.18',
    text: 'Here is where I will say the part that sounds too big, because I believe it.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 18' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#ui-of-the-future body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.19',
    text: 'The reason to want owned, governed agents is not developer productivity. It is that they collapse the distance between having an interest and running a business.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 19' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#ui-of-the-future body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.20',
    text: 'Most people never start because the operating is the wall. Not the idea, not the craft, not the customers. The invoicing, the scheduling, the follow-up emails, the catalog updates, the hundred small operations that make a business a business. Big companies buy their way through that wall with headcount. Everyone else gives up or burns out.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 20' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#ui-of-the-future body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.21',
    text: 'Agents that you own and can verify tear that wall down. A person with a real interest and no operations team gets to run a real business. The human does the choosing. The agents do the operating. The receipts keep everyone honest. That is what I mean when I say humans and AI agents build businesses from creative expression. The expression is yours. The machinery finally is too.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 21' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#ui-of-the-future body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.22',
    text: "And because it all runs on infrastructure you own, it compounds. The memory your agents accumulate is yours. The content, the customer history, the audit record of every decision: yours. Today's work becomes an input to tomorrow's work instead of evaporating into a vendor's database. Do that for years and what you have is not a subscription you are afraid to cancel. It is an asset. Something you can hand to your kids, or sell, or just keep running. A digital legacy, built one creative expression at a time.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 22' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#ui-of-the-future body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.23',
    text: 'I want to be precise about the present tense, because this industry has a lying problem and I refuse to add to it.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 23' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#ui-of-the-future body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.24',
    text: 'Today, RevealUI is the runtime layer of that thesis. Five primitives that every business needs: People, Content, Offers, Payments, Agents. One permission model that covers humans and agents alike. A tamper-evident audit log. Local-first AI that runs on models you own, with any provider you choose as an option rather than a dependency. It is open source, and you can read every line.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 24' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#ui-of-the-future body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.25',
    text: 'Today, you still need to be the kind of person who can run your own infrastructure. The owner-operators come first: the founders and small teams who run their business on their own AI and want the receipts to prove what it did. They are who this is built with, right now, in production, by the one engineer in Tennessee writing this.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 25' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#ui-of-the-future body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.26',
    text: "I can tell you the receipts matter because I run on them. For the past several months this company has been operated by me and a fleet of AI agents working around the clock: agents that write code, review each other's pull requests, file the paperwork, and hand work to each other between sessions like a shift change. Hundreds of merged pull requests have moved through that system. And the moments that taught me the most were not the wins. Twice, an agent marked a bug as fixed because the code had merged, and the record showed that nobody had ever watched it actually work. The fix for that was not a smarter model. It was a rule that a claim without evidence does not close, and a ledger nobody can quietly edit. Just today, an agent refused an instruction that arrived through a side channel under my name, because the provenance did not check out. That is governance doing its job. I trust my agents the way I trusted the teams I managed for a decade: exactly as far as the records go.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 26' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#ui-of-the-future body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.27',
    text: 'The non-technical future I just described is the horizon, not the current release. I am not going to pretend otherwise. But every piece of it depends on the same two preconditions, and those are built. Proof and ownership do not get easier to retrofit later. They are the foundation or they are nowhere.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 27' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#ui-of-the-future body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.28',
    text: "The UI of the future has yet to reveal itself. When it does, I do not believe it will look like a smarter chat window in somebody else's cloud. It will look like your own business, running under your own roof, operated by a workforce you can audit, compounding into something that outlasts the tools that built it.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 28' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#ui-of-the-future body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.29',
    text: 'That is what we are building toward. One receipt, one primitive, one creative expression at a time.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 29' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#ui-of-the-future body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.30',
    text: 'If you want to see where it stands today, the code is public and the runtime is free to self-host. Start there. Read the receipts.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 30' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body-p2.test.ts#ui-of-the-future body prose units match extractor',
        note: 'extractor lockstep for P2 body corpus',
      },
    ],
  },
] as const;
